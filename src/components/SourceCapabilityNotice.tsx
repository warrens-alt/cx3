import { useLocation } from 'react-router-dom';
import { FLAT_LEAD_TENANT_TABLES, WAREHOUSE_SCHEMA_SNAPSHOT_DATE } from '../../contracts/warehouseSchemaSnapshot';
import { useClient } from '../lib/ClientContext';
import { useFilters } from '../lib/FilterContext';

const leadViews = new Set(['', 'overview', 'funnel', 'speed-to-lead', 'contact-strategy', 'vendor-quality', 'sales-activation', 'temporal', 'cohorts', 'routing', 'data-integrity', 'exceptions', 'lead-explorer']);

/** Schema evidence is labelled separately from the freshness of live results. */
export default function SourceCapabilityNotice({ warningsOnly = false }: { warningsOnly?: boolean }) {
  const { selectedClient } = useClient();
  const { filters, setFilter } = useFilters();
  const domain = useLocation().pathname.split('/')[1] || '';
  if (!FLAT_LEAD_TENANT_TABLES[selectedClient] || !leadViews.has(domain)) return null;
  const unsupported = ['grade', 'medium'].filter(key => filters[key]);
  if (warningsOnly && unsupported.length === 0 && domain !== 'routing') return null;
  return <aside className="rounded-[var(--cx-radius-md)] border border-border bg-surface-subtle px-4 py-3 text-sm text-text-main" role="note" aria-label="Source data limitations">
    <strong>Grade, medium and routing history are not supplied by this tenant view.</strong>
    <p className="mt-1">Lead counts combine the recorded vendor transactions by lead ID. Validation flags are also unavailable; an absent field is not a failed check or a measured zero.</p>
    {domain === 'routing' && <p className="mt-1 font-medium">This source cannot establish a routing sequence. Do not interpret a missing route result as proof that no routing occurred.</p>}
    <p className="mt-1 text-xs text-text-sec">Schema reference: {WAREHOUSE_SCHEMA_SNAPSHOT_DATE}. This is not a live data cutoff or an independently reconciled result.</p>
    {unsupported.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{unsupported.map(key => <button key={key} type="button" className="cx-button-secondary" onClick={() => setFilter(key, null)}>Remove unsupported {key} filter</button>)}</div>}
  </aside>;
}
