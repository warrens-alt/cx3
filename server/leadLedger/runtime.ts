import { LEDGER_COLUMNS, LEDGER_REPLICA_VERSION, analyseLedgerLead, type LedgerRow, type LedgerReplicaReport } from '../../contracts/leadLedgerReplica';
import { getClientConfig } from '../bigquery/config';
import { getBigQueryClient } from '../bigquery/client';
import { buildLedgerQuery, inspectLedgerSchema, selectLedgerTable, LedgerError, type LedgerScope, type LedgerOptions, type SchemaField } from './query';
import { prepareLedgerExport } from './stream';

async function sourceFor(scope: LedgerScope, options: LedgerOptions) {
  const client = getClientConfig(scope.clientId);
  const selected = selectLedgerTable(client, options.sourceMode, process.env.CX_LEAD_LEDGER_RICH_VIEW_APPROVED === 'true');
  const [project, dataset, table] = selected.table.split('.');
  const bq = getBigQueryClient(project);
  const [metadata] = await bq.dataset(dataset).table(table).getMetadata();
  const source = inspectLedgerSchema(selected.table, (metadata.schema?.fields || []) as SchemaField[], selected.richViewEnabled);
  return { client, bq, source };
}
export async function ledgerCoverage(scope: LedgerScope, options: LedgerOptions) {
  return (await sourceFor(scope, options)).source.coverage;
}
export async function getLedgerReplica(scope: LedgerScope, options: LedgerOptions): Promise<LedgerReplicaReport> {
  const { client, bq, source } = await sourceFor(scope, options);
  const plan = buildLedgerQuery(source, scope, options);
  const [job] = await bq.createQueryJob({ query: plan.query, params: plan.params });
  const [rows] = await job.getQueryResults({ autoPaginate: false, maxResults: 1 });
  const result = rows[0];
  if (!result || !Array.isArray(result.leads)) throw new LedgerError('The LeadLedger query returned an invalid report shape.', 502);
  const generatedAt = new Date().toISOString();
  const leads = result.leads.map((lead: { _lead_key: string; records: Record<string, unknown>[] }) => {
    if (!Array.isArray(lead.records) || lead.records.length > 10000) throw new LedgerError('A lead exceeds the interactive record ceiling. Use the complete export to inspect it.', 413);
    const records = lead.records.map(record => Object.fromEntries(LEDGER_COLUMNS.map((column, index) => [column.label, record[`c${index}`] ?? null])) as LedgerRow);
    return analyseLedgerLead(lead._lead_key, records, Date.parse(generatedAt));
  });
  const count = (input: unknown) => {
    const value = Number(input);
    if (!Number.isSafeInteger(value) || value < 0) throw new LedgerError('The report returned an invalid count.', 502);
    return value;
  };
  const totalLeads = count(result.total_leads);
  return {
    leads,
    summary: {
      leads: totalLeads, rows: count(result.total_rows), leadOnlyRows: count(result.lead_only_rows),
      duplicateKeyRows: count(result.duplicate_key_rows),
      revenue: (result.revenue || []).map((row: { currency: string; amount: string | null; missing_amounts: number }) => ({ currency: row.currency, amount: row.amount, missingAmounts: count(row.missing_amounts) })),
    },
    vendors: (result.vendors || []).map((row: { vendor: string; leads: number; rows: number }) => ({ vendor: row.vendor, leads: count(row.leads), rows: count(row.rows) })),
    metadata: {
      version: LEDGER_REPLICA_VERSION, coverage: source.coverage, clientId: client.id,
      startDate: plan.dates.startDate, endDate: plan.dates.endDate, filters: scope.filters || {}, search: plan.search,
      generatedAt, queryJobId: job.id || null, offset: plan.offset, pageSize: plan.limit,
      hasMore: plan.offset + leads.length < totalLeads, validationStatus: 'NOT_VERIFIED',
      dateBasis: 'fetched_cohort', timestampInterpretation: 'Naive source timestamps are interpreted as UTC; upstream timezone semantics are not independently verified.',
      pagination: `Each interactive page is a new query snapshot. Refresh may change results. ${count(result.redacted_values)} process-field values were redacted because they were not timestamp-shaped.`,
    },
  };
}
export async function exportLedgerReplica(scope: LedgerScope, options: LedgerOptions, mode: string, signal?: AbortSignal) {
  if (!['compatible', 'available'].includes(mode)) throw new LedgerError('Use compatible or available export mode.');
  const { client, bq, source } = await sourceFor(scope, options);
  if (mode === 'compatible' && !source.coverage.compatible) throw new LedgerError(`A compatible export requires all 63 fields. This source is missing: ${source.coverage.missing.join(', ')}. Use the explicitly partial available-fields export or an approved richer source.`);
  const maxRows = Number(process.env.CX_LEAD_LEDGER_MAX_EXPORT_ROWS || 1000000);
  if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 5000000) throw new LedgerError('CX_LEAD_LEDGER_MAX_EXPORT_ROWS must be an integer from 1 to 5000000.', 503);
  const plan = buildLedgerQuery(source, scope, options, true);
  const [job] = await bq.createQueryJob({ query: plan.query, params: plan.params });
  const prepared = await prepareLedgerExport(job, maxRows, signal);
  return { ...prepared, coverage: source.coverage, clientId: client.id, dates: plan.dates, mode };
}
