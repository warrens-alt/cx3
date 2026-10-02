import React from 'react';
import { fetchRawLeads, type RawLeadsData } from '../../lib/offernetClient';
import { useOperationalData } from '../../lib/useOperationalData';
import { useAuth } from '../../lib/AuthContext';

/** Mount only after an explicit request. The existing API retains authorization and drill semantics. */
export default function SupportingRecordPreview({ recordPath }: { recordPath: string }) {
  const { isAdmin } = useAuth();
  const search = new URL(recordPath, 'https://scope.invalid').searchParams;
  const params: Record<string, string | number> = Object.fromEntries(search);
  // Existing raw-leads API minimum page size is ten; render at most five masked records.
  params.limit = 10;
  params.offset = 0;
  const { data, loading, error, loadData } = useOperationalData<RawLeadsData>('audit-supporting-records', params, fetchRawLeads, isAdmin && !!params.clientId && !!params.drill);
  if (!isAdmin) return null;
  if (loading) return <p role="status">Loading supporting records…</p>;
  if (error) return <div role="status"><p>Supporting records unavailable: {error}</p><button type="button" className="cx-button-secondary" onClick={() => void loadData()}>Retry supporting preview</button></div>;
  if (!data) return <p>Supporting records unavailable for this scope.</p>;
  if (!data.rows?.length) return <p>No supporting records returned for this exact drill and scope.</p>;
  const text = (value: unknown) => value == null || value === '' ? 'Unavailable' : String(value);
  const masked = (value: unknown) => value == null ? 'Unavailable' : `•••${String(value).slice(-4)}`;
  return <div className="cx-audit-record-preview"><p>Up to five returned records. This preview does not measure source completeness or reconcile the aggregate.</p><div role="region" aria-label="Supporting record preview" tabIndex={0}><table><caption className="sr-only">Masked supporting records for the displayed metric and scope</caption><thead><tr><th scope="col">Lead</th><th scope="col">Delivered</th><th scope="col">First dial</th><th scope="col">Evidence</th></tr></thead><tbody>{data.rows.slice(0, 5).map((row, index) => <tr key={index}><th scope="row">{masked(row.lead_id)}</th><td>{text(row.delivered_time)}</td><td>{text(row.first_call_time)}</td><td>{text(row.investigationReason?.label || 'Matches requested record population')}</td></tr>)}</tbody></table></div></div>;
}
