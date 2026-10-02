import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { METRIC_BY_ID, type EvidenceReportResult, type ReportReplayResult } from '../../../contracts/reporting';
import { replayEvidenceReport } from '../../lib/reportingClient';
import ReconciliationView from '../../shared/evidence/ReconciliationView';
import CopyEvidenceButton from '../../shared/evidence/CopyEvidenceButton';

export default function ReportReplay({ tenantId, report, onCompared }: { tenantId: string; report: EvidenceReportResult | null; onCompared?: (matches: boolean) => void }) {
  const [token, setToken] = useState('');
  const [result, setResult] = useState<ReportReplayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  useEffect(() => { sequence.current += 1; pending.current?.abort(); setToken(report?.token || ''); setResult(null); setError(null); setBusy(false); return () => { sequence.current += 1; pending.current?.abort(); }; }, [report?.executionId, tenantId]);
  const replay = async () => {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller; const current = ++sequence.current;
    setBusy(true); setError(null); setResult(null); onCompared?.(false);
    try {
      const value = await replayEvidenceReport(tenantId, token.trim(), controller.signal);
      if (!controller.signal.aborted && current === sequence.current) { setResult(value); onCompared?.(value.status === 'MATCH' && value.original?.resultHash === report?.resultHash); }
    } catch (err) { if (!controller.signal.aborted && current === sequence.current) setError(err instanceof Error ? err.message : 'Replay failed.'); }
    finally { if (!controller.signal.aborted && current === sequence.current) setBusy(false); }
  };
  const original = result?.original, replayed = result?.replayed;
  const rows = original ? [...original.totals, ...original.groups].map(row => ({
    key: JSON.stringify([row.metricId, row.group]), label: `${METRIC_BY_ID[row.metricId]?.label || row.metricId}${row.group === null ? ' · Total' : ` · ${row.group}`}`,
    expected: row.value, observed: [...(replayed?.totals || []), ...(replayed?.groups || [])].find(candidate => candidate.metricId === row.metricId && candidate.group === row.group)?.value ?? null,
    detail: `${row.unit} · Original immutable result / Replayed immutable result`,
  })) : [];
  return <section className="cx-report-replay cx-admin-panel" aria-label="Replay immutable evidence">
    <h2>Replay and compare</h2><p>A signed descriptor reproduces its original release, metric definitions and exact scope. Replay requires current tenant authority. Tokens contain aggregate evidence and scope; keep them with the intended evidence recipients.</p>
    {report && <p>Replay availability: <strong>{report.replay.status}</strong>{report.replay.reason ? ` · ${report.replay.reason}` : ''}{report.replay.expiresAt ? ` · Expires ${report.replay.expiresAt}` : ''}</p>}
    <label>Signed replay token<textarea aria-label="Signed replay token" rows={3} spellCheck={false} autoComplete="off" value={token} onChange={event => { sequence.current += 1; pending.current?.abort(); setBusy(false); setToken(event.target.value); setResult(null); setError(null); onCompared?.(false); }} /></label>
    <div className="cx-report-actions"><button type="button" className="cx-button-secondary" onClick={replay} disabled={busy || !token.trim()}><RotateCcw size={15} aria-hidden="true" />{busy ? 'Replaying…' : 'Replay and compare'}</button>{token && <CopyEvidenceButton value={token} label="Copy signed replay token" />}</div>
    {error && <p role="alert">{error}</p>}
    {result && <div aria-live="polite"><h3>{result.status}</h3><p>{result.reason}</p><p>Independent reconciliation: <strong>{result.reconciliationStatus}</strong> · Business meaning: <strong>{result.businessMeaningStatus}</strong></p>
      {original && <dl><div><dt>Original immutable result</dt><dd>{original.resultHash}<br />Generated {original.generatedAt}</dd></div><div><dt>Replayed immutable result</dt><dd>{replayed?.resultHash || 'Unavailable'}<br />{replayed ? `Generated ${replayed.generatedAt}` : 'No replayed result'}</dd></div><div><dt>Original scope</dt><dd>{original.request.tenantId} · {original.request.startDate} → {original.request.endDate} · {original.request.dateBasis} · {JSON.stringify(original.request.filters)}</dd></div></dl>}
      <ReconciliationView model={{ label: 'Immutable result comparison', kind: 'delivery_consistency', state: result.status === 'MATCH' ? 'api_consistent' : result.status === 'MISMATCH' ? 'mismatch' : 'unavailable', values: [], comparisons: rows, detail: 'MATCH compares signed immutable result content, including evidence metadata. This is reproducibility evidence, not independent source reconciliation.' }} />
    </div>}
  </section>;
}
