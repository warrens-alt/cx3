import React from 'react';
import { LEDGER_COLUMNS, type LedgerCoverage } from '../../../contracts/leadLedgerReplica';
import { AUTHORITATIVE_METRICS } from '../../../contracts/metricRegistry';
import EvidenceMatrix from '../../shared/visuals/EvidenceMatrix';

const auditFields = new Set(['lead_id', 'fetched', 'attempted_to_deliver', 'delivered', 'first_call_date', 'total_calls', 'rpc', 'sale', 'activated', 'revenue_generated', 'currency']);

/** Schema availability is supplied by the source API. Population completeness is never sampled. */
export default function LedgerFieldCoverage({ coverage }: { coverage: LedgerCoverage }) {
  const available = new Set(coverage.available), missing = new Set(coverage.missing);
  const rows = LEDGER_COLUMNS.filter(column => auditFields.has(column.field)).map(column => {
    const registryField = column.scope === 'hlc' ? `hlc.${column.field}` : column.field;
    const metrics = Object.values(AUTHORITATIVE_METRICS).filter(metric => metric.fields.includes(registryField));
    return { column, metrics };
  });
  return <section className="cx-ledger-field-coverage" aria-labelledby="ledger-field-coverage-heading"><h3 id="ledger-field-coverage-heading">Source field availability</h3><p>Available and missing fields are supplied by the source coverage API for {coverage.source}. Populated counts are unavailable; the displayed page is never used to estimate completeness.</p>
    <EvidenceMatrix label="Source field availability and declared metric use" rowHeading="Field" columns={[{ key: 'available', label: 'Source field' }, { key: 'populated', label: 'Populated' }, { key: 'used', label: 'Used by metric' }]} rows={rows.map(({ column, metrics }) => ({ key: column.label, label: column.label, detail: column.scope === 'hlc' ? `hlc.${column.field}` : column.field, cells: {
      available: available.has(column.label) ? { state: 'observed', label: 'Available', detail: 'Returned source schema availability' } : { state: 'unavailable', label: missing.has(column.label) ? 'Unavailable' : 'Not supplied', detail: missing.has(column.label) ? 'Returned missing field' : 'No availability entry returned' },
      populated: { state: 'unavailable', label: 'Not supplied', detail: 'No full-population field coverage measurement' },
      used: metrics.length ? { state: 'mapped', label: `${metrics.length} declared ${metrics.length === 1 ? 'definition' : 'definitions'}`, detail: metrics.map(metric => metric.businessLabel).join(' · ') } : { state: 'unavailable', label: 'Not declared here', detail: 'No field use is declared by this metric registry. Other report contracts may supply their own definitions.' },
    } }))} />
  </section>;
}
