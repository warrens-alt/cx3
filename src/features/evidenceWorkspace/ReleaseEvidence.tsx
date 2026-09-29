import React, { useState } from 'react';
import { Search, FileText, ListChecks, Database } from 'lucide-react';
import type { ReleaseManifest } from '../../../contracts/reporting';

function time(value: string | undefined) {
  return value && Number.isFinite(Date.parse(value)) ? `${new Date(value).toISOString()} (UTC)` : 'Not reported';
}

/** Read-only view of the supplied manifest; no approval, execution or status inference. */
export default function ReleaseEvidence({ release }: { release: ReleaseManifest }) {
  const [checkFilter, setCheckFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const checks = (release.checks || []).filter(c => checkFilter === 'ALL' || c.status === checkFilter);
  const snapshots = Object.entries(release.snapshots || {}).filter(([fact, s]) => `${fact} ${s.table}`.toLowerCase().includes(search.trim().toLowerCase()));
  const fields = [['Release ID', release.releaseId], ['Model version', release.modelVersion], ['Metric version', release.metricVersion], ['Approved by', release.approvedBy || 'Not reported'], ['Approval reference', release.approvalReference || 'Not reported'], ['Built at', time(release.builtAt)], ['Observation cutoff', time(release.cutoff)]];
  return <div className="cx-release-layout">
    <aside className="cx-admin-panel cx-release-manifest" aria-label="Release manifest"><h2><FileText size={17} aria-hidden="true" />Release manifest</h2><span className="cx-admin-status">{release.status}</span>
      <dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <details><summary>Engine and source batches</summary><dl><div><dt>Engine hash</dt><dd>{release.engineHash || 'Not reported'}</dd></div><div><dt>Source batch identifiers</dt><dd>{release.sourceBatchIds?.length ? release.sourceBatchIds.join(', ') : 'None reported'}</dd></div></dl></details>
    </aside>
    <div className="cx-release-evidence">
      <section className="cx-admin-panel" aria-label="Release audit checks"><header className="cx-admin-panel-heading"><div><h2><ListChecks size={17} aria-hidden="true" />Audit checks</h2><p>Statuses are copied from the manifest. A listed check is not automatically a pass.</p></div></header>
        <div className="cx-admin-toolbar"><div className="cx-admin-switch" role="group" aria-label="Audit check status">{['ALL', 'PASS', 'FAIL', 'NOT_RUN'].map(s => <button type="button" key={s} aria-pressed={checkFilter === s} onClick={() => setCheckFilter(s)}>{s === 'ALL' ? 'All checks' : s === 'NOT_RUN' ? 'Not run' : s === 'PASS' ? 'Pass' : 'Fail'}</button>)}</div><span role="status">{checks.length} of {release.checks?.length || 0} checks</span></div>
        <div className="cx-admin-table-scroll" role="region" aria-label="Audit check evidence" tabIndex={0}><table className="cx-admin-table"><thead><tr><th scope="col">Check</th><th scope="col">Status</th><th scope="col">Observed</th><th scope="col">Expected</th><th scope="col">Job reference</th></tr></thead><tbody>{checks.map(c => <tr key={c.id}><th scope="row">{c.id}</th><td><span className="cx-admin-status" data-state={c.status}>{c.status === 'NOT_RUN' ? 'Not run' : c.status}</span></td><td>{c.observed || 'Not reported'}</td><td>{c.expected || 'Not reported'}</td><td><code>{c.jobId || 'Not reported'}</code></td></tr>)}</tbody></table></div>
        {!checks.length && <p className="cx-admin-empty">{release.checks?.length ? 'No checks match this status.' : 'No audit checks were supplied. No pass is inferred.'}</p>}
      </section>
      <section className="cx-admin-panel" aria-label="Release source snapshots"><header className="cx-admin-panel-heading"><div><h2><Database size={17} aria-hidden="true" />Source snapshots</h2><p>Snapshot time, source completeness and the release cutoff describe different evidence. Report execution remains deferred.</p></div></header>
        <label className="cx-admin-search"><Search size={15} aria-hidden="true" /><input aria-label="Search snapshots" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a fact or snapshot table…" /></label>
        <div className="cx-admin-table-scroll" role="region" aria-label="Source snapshot evidence" tabIndex={0}><table className="cx-admin-table"><thead><tr><th scope="col">Fact / snapshot table</th><th scope="col">Source completeness</th><th scope="col">Snapshot time</th><th scope="col">Complete through</th></tr></thead><tbody>{snapshots.map(([fact, snap]) => {
          const source = release.sources?.find(s => s.fact === fact);
          return <tr key={fact}><th scope="row"><strong>{fact}</strong><small>{snap.table}</small></th><td><span className="cx-admin-status" data-state={source?.status}>{source?.status || 'Not reported'}</span></td><td>{time(snap.snapshotTime)}</td><td>{time(source?.completeThrough || undefined)}</td></tr>;
        })}</tbody></table></div>
        {!snapshots.length && <p className="cx-admin-empty">No snapshot entries match this selection.</p>}
      </section>
    </div>
  </div>;
}
