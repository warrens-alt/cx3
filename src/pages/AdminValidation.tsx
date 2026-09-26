import React from 'react';
import { PageShell } from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import { DataState, displayNumber } from '../components/DataState';
import { useAnalyticsData } from '../lib/useAnalyticsData';
export default function AdminValidation() {
  const { data, loading, error, refetch } = useAnalyticsData('validation');
  if (loading || error || !data) return <PageShell><PageHeader title="Validation Evidence" /><DataState loading={loading} error={error} empty={!data} retry={refetch} /></PageShell>;
  const value = (v: unknown) => v === null || v === undefined ? 'Not measured' : displayNumber(v, 2);
  return <PageShell><PageHeader title="Validation Evidence" description="Only independently obtained measurements are compared. Missing evidence cannot pass validation." />
    <div className="enterprise-card p-5 space-y-3"><h2 className="font-semibold">Overall: {data.overallStatus}</h2><p>{data.chain}</p><p>Check generated: {data.reconciledAt}. This is not a warehouse refresh timestamp.</p></div>
    <div className="enterprise-card mt-5 overflow-x-auto"><table className="enterprise-table w-full"><thead><tr>{['Metric', 'Raw query', 'Semantic model', 'API independently checked', 'UI independently checked', 'Result', 'Evidence'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>
      {(data.metrics || []).map((m: any) => <tr key={m.metric}><th scope="row">{m.metric}</th><td>{value(m.rawBigQuery)}</td><td>{value(m.semanticModel)}</td><td>{value(m.apiPayload)}</td><td>{value(m.uiRendered)}</td><td>{m.status}</td><td>{m.discrepancy}<br />{m.grain}</td></tr>)}
    </tbody></table></div>
  </PageShell>;
}
