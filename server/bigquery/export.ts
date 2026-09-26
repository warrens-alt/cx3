import { exportColumnDefinitions } from '../../contracts/exportLabels';
import { getBigQueryClient } from './client';
import { getClientConfig } from './config';
import { getBaseSemanticLayer } from './views';
import { buildLeadWhere, boundedInteger, RequestError, validateScope, type QueryScope } from './filters';
import { MODEL_VERSION, safeCsvCell } from './integrity';
import { withAnalyticsScope } from '../analyticsContext';
export function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const cell = (input: unknown) => {
    let value = input;
    if (value && typeof value === 'object' && 'value' in value) value = (value as { value: unknown }).value;
    else if (value && typeof value === 'object') value = JSON.stringify(value);
    return `"${String(safeCsvCell(value) ?? '').replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + [headers.map(cell).join(','), ...rows.map(row => headers.map(h => cell(row[h])).join(','))].join('\r\n');
}
export async function exportData(input: QueryScope & { grain: string; format?: string; limit?: number }) {
  const scope = validateScope(input);
  return withAnalyticsScope(scope, async () => {
    if (input.grain === 'cli') {
      const { getTenantImport } = await import('./cli_analytics');
      const tenantImport = getTenantImport(scope.clientId);
      const records = tenantImport?.records || [];
      const columns = [
        'CLI Number',
        'Campaign',
        'Vendor',
        'Total Calls',
        'Distinct Leads',
        'Calls Per Lead',
        'Answered Calls',
        'Right Party Contacts',
        'Right Party Contact Rate %',
        'Sales',
        'Sale Rate %',
        'Avg Duration Seconds',
        'Avg Lead Age Days'
      ];
      const rows = records.map(r => ({
        'CLI Number': r.cli,
        'Campaign': r.campaign || 'N/A',
        'Vendor': r.vendor || 'N/A',
        'Total Calls': r.totalCalls,
        'Distinct Leads': r.distinctLeads,
        'Calls Per Lead': r.callsPerLead,
        'Answered Calls': r.answeredCount ?? 'N/A',
        'Right Party Contacts': r.contactCount,
        'Right Party Contact Rate %': r.contactRate,
        'Sales': r.saleCount,
        'Sale Rate %': r.salePerCallRate,
        'Avg Duration Seconds': r.avgDurationSeconds,
        'Avg Lead Age Days': r.avgLeadAgeDays ?? 'N/A',
      }));
      const metadata = {
        grain: 'cli',
        dataSource: 'IMPORTED REPORT',
        rowCount: rows.length,
        truncated: false,
        generatedAt: new Date().toISOString(),
      };
      return { rows, metadata, csv: toCsv(rows, columns) };
    }
    if (!['lead', 'semantic', 'transaction'].includes(input.grain)) throw new RequestError('Raw source exports are disabled until a reviewed redaction policy is configured', 422);
    const client = getClientConfig(scope.clientId), { sql, queryParams } = buildLeadWhere(scope), base = getBaseSemanticLayer(client);
    const limit = boundedInteger(input.limit, 10000, 50000, 1);
    const columns = input.grain === 'transaction'
      ? ['lead_id', 'vendor', 'transaction_id', 'attempted_delivery_timestamp', 'delivery_timestamp', 'first_call_timestamp', 'last_call_timestamp', 'latest_dialer_status', 'total_calls', 'total_call_duration_seconds', 'rpc', 'sale', 'activation', 'revenue']
      : ['lead_id', 'consumer_id', 'capture_date', 'source', 'medium', 'valid_lead', 'valid_idno', 'phone_valid', 'grade', 'vetting', 'vendor_count', 'total_transactions', 'has_delivery', 'has_call', 'has_rpc', 'has_sale', 'has_activation', 'total_revenue', 'total_calls'];
    const query = input.grain === 'transaction'
      ? `${base}, selected_leads AS (SELECT lead_id FROM vw_leads ${sql}) SELECT ${columns.map(c => `t.${c}`).join(', ')} FROM vw_lead_vendor_transactions t JOIN selected_leads USING(lead_id) ORDER BY t.capture_timestamp, t.lead_id, t.hlc_record_number LIMIT @exportLimit`
      : `${base} SELECT ${columns.join(', ')} FROM vw_leads ${sql} ORDER BY capture_timestamp, lead_id LIMIT @exportLimit`;
    const [result] = await getBigQueryClient(client.bigQueryProject).query({ query, params: { ...queryParams, exportLimit: limit + 1 } });
    const metadata = { modelVersion: MODEL_VERSION, clientId: scope.clientId, startDate: scope.startDate ?? null, endDate: scope.endDate ?? null,
      filters: scope.filters, ...exportColumnDefinitions(columns, input.grain), grain: input.grain, rowCount: Math.min(result.length, limit), truncated: result.length > limit,
      attribution: 'selected_vendor_transactions', dateBasis: 'lead_capture_cohort', generatedAt: new Date().toISOString(), validationStatus: 'NOT_VERIFIED' };
    const audit = { report_start: metadata.startDate, report_end: metadata.endDate, report_filters: JSON.stringify(metadata.filters),
      report_model: MODEL_VERSION, report_naming_version: metadata.namingVersion, report_record_unit: metadata.recordUnit, report_truncated: metadata.truncated, report_validation: metadata.validationStatus };
    const rows = result.slice(0, limit).map(row => ({ ...row, ...audit }));
    return { rows, metadata, csv: toCsv(rows, [...columns, ...Object.keys(audit)]) };
  });
}
