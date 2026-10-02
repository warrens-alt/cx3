import React, { useId, useState } from 'react';
import { Search, FileText, ListChecks, Database } from 'lucide-react';
import CopyEvidenceButton from '../../shared/evidence/CopyEvidenceButton';
import type { ReleaseManifest } from '../../../contracts/reporting';

function time(value: string | undefined) {
  return value && Number.isFinite(Date.parse(value)) ? `${value}${value.endsWith('Z') ? ' (UTC)' : ' (supplied offset)'}` : value || 'Not reported';
}

export function CopyReleaseValue({ label, value }: { label: string; value: string | undefined }) {
  return <div className="cx-release-copy-value"><span>{value || 'Not reported'}</span>{value && <CopyEvidenceButton value={value} label={`Copy ${label}`} />}</div>;
}

/** Read-only view of the supplied manifest; no approval, execution or status inference. */
export default function ReleaseEvidence({ release }: { release: ReleaseManifest }) {
  const id = useId();
  const [checkFilter, setCheckFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const checks = (release.checks || []).filter(c => checkFilter === 'ALL' || c.status === checkFilter);
  const snapshots = Object.entries(release.snapshots || {}).filter(([fact, s]) => `${fact} ${s.table}`.toLowerCase().includes(search.trim().toLowerCase()));
  const fields = [['Release ID', release.releaseId], ['Workspace / tenant', release.tenantId], ['Model version', release.modelVersion], ['Metric version', release.metricVersion], ['Approved by', release.approvedBy], ['Approval reference', release.approvalReference], ['Built at', time(release.builtAt)], ['Observation cutoff', time(release.cutoff)]];
  return <>
    <nav className="cx-release-nav" aria-label="Release audit journey"><a href={`#${id}-release`}>Release</a><a href={`#${id}-checks`}>Audit checks</a><a href={`#${id}-snapshots`}>Source snapshots</a><a href={`#${id}-technical`}>Technical manifest</a></nav>
    <div className="cx-release-layout">
      <aside id={`${id}-release`} className="cx-admin-panel cx-release-manifest" aria-label="Release manifest"><h2><FileText size={17} aria-hidden="true" />Release manifest</h2><span className="cx-admin-status">{release.status}</span>
        <p>Immutable published release evidence. Its supplied publication state is shown separately from each audit-check result.</p>
        <dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{['Release ID', 'Approval reference'].includes(label) ? <CopyReleaseValue label={label} value={value} /> : value || 'Not reported'}</dd></div>)}</dl>
      </aside>
      <div className="cx-release-evidence">
        <section id={`${id}-checks`} className="cx-admin-panel" aria-label="Release audit checks"><header className="cx-admin-panel-heading"><div><h2><ListChecks size={17} aria-hidden="true" />Audit checks</h2><p>Statuses are copied from the manifest. NOT_RUN means the check was not run; a listed check is not automatically a pass.</p></div></header>
          <div className="cx-admin-toolbar"><div className="cx-admin-switch" role="group" aria-label="Audit check status">{['ALL', 'PASS', 'FAIL', 'NOT_RUN'].map(s => <button type="button" key={s} aria-pressed={checkFilter === s} onClick={() => setCheckFilter(s)}>{s === 'ALL' ? 'All checks' : s === 'NOT_RUN' ? 'Not run' : s === 'PASS' ? 'Pass' : 'Fail'}</button>)}</div><span role="status">{checks.length} of {release.checks?.length || 0} checks</span></div>
          <div className="cx-admin-table-scroll" role="region" aria-label="Audit check evidence" tabIndex={0}><table className="cx-admin-table"><thead><tr><th scope="col">Check</th><th scope="col">Status</th><th scope="col">Observed</th><th scope="col">Expected</th><th scope="col">Job reference</th></tr></thead><tbody>{checks.map(c => <tr key={c.id}><th scope="row">{c.id}</th><td><span className="cx-admin-status" data-state={c.status}>{c.status}</span></td><td>{c.observed || 'Not reported'}</td><td>{c.expected || 'Not reported'}</td><td><CopyReleaseValue label={`job reference for ${c.id}`} value={c.jobId} /></td></tr>)}</tbody></table></div>
          {!checks.length && <p className="cx-admin-empty">{release.checks?.length ? 'No checks match this status.' : 'No audit checks were supplied. No pass is inferred.'}</p>}
        </section>
        <section id={`${id}-snapshots`} className="cx-admin-panel" aria-label="Release source snapshots"><header className="cx-admin-panel-heading"><div><h2><Database size={17} aria-hidden="true" />Source snapshots</h2><p>Snapshot time, source completeness and the release cutoff describe different evidence. Execution requires a separately approved aggregate snapshot.</p></div></header>
          <label className="cx-admin-search"><Search size={15} aria-hidden="true" /><input aria-label="Search snapshots" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a fact or snapshot table…" /></label>
          <div className="cx-admin-table-scroll" role="region" aria-label="Source snapshot evidence" tabIndex={0}><table className="cx-admin-table"><thead><tr><th scope="col">Fact / snapshot table</th><th scope="col">Source completeness</th><th scope="col">Snapshot time</th><th scope="col">Complete through</th></tr></thead><tbody>{snapshots.map(([fact, snap]) => {
            const source = release.sources?.find(s => s.fact === fact);
            return <tr key={fact}><th scope="row"><strong>{fact}</strong><CopyReleaseValue label={`${fact} snapshot table`} value={snap.table} /></th><td><span className="cx-admin-status" data-state={source?.status}>{source?.status || 'Not reported'}</span></td><td>{time(snap.snapshotTime)}</td><td>{time(source?.completeThrough || undefined)}</td></tr>;
          })}</tbody></table></div>
          {!snapshots.length && <p className="cx-admin-empty">No snapshot entries match this selection.</p>}
        </section>
        <details id={`${id}-technical`} className="cx-admin-panel cx-release-manifest"><summary>Technical manifest</summary>
          <dl><div><dt>Engine hash</dt><dd><CopyReleaseValue label="Engine hash" value={release.engineHash} /></dd></div><div><dt>Source batch identifiers</dt><dd>{release.sourceBatchIds?.length ? release.sourceBatchIds.map(value => <CopyReleaseValue key={value} label="Source batch ID" value={value} />) : 'None reported'}</dd></div></dl>
          <h3>Snapshot registration</h3><dl>{Object.entries(release.snapshots || {}).map(([fact, snapshot]) => <div key={fact}><dt>{fact}</dt><dd>{snapshot.table}<br />Created at: {time(snapshot.createdAt)}<br />Snapshot time: {time(snapshot.snapshotTime)}</dd></div>)}</dl>
          <h3>Provenance references</h3><dl>{Object.entries(release.provenance || {}).map(([kind, reference]) => <div key={kind}><dt>{kind}</dt><dd><CopyReleaseValue label={`${kind} provenance table`} value={reference.table} />Created at: {time(reference.createdAt)}<br />Snapshot time: {time(reference.snapshotTime)}</dd></div>)}</dl>
          <h3>Source contracts and completeness</h3><dl>{(release.sources || []).map(source => <div key={source.fact}><dt>{source.fact} · {source.status}</dt><dd>Contract version: {source.contractVersion || 'Not reported'}<br />Owner: {source.owner || 'Not reported'}<br />Earliest available: {time(source.earliestAvailable || undefined)}<br />Complete through: {time(source.completeThrough || undefined)}<br /><CopyReleaseValue label={`${source.fact} source approval reference`} value={source.approvalReference} /></dd></div>)}</dl>
        </details>
      </div>
    </div>
  </>;
}
