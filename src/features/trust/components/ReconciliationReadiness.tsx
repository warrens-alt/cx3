import React, { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, FileInput, Trash2 } from 'lucide-react';
import { useAuth } from '../../../lib/AuthContext';
import { useClient } from '../../../lib/ClientContext';
import { useFilters } from '../../../lib/FilterContext';
import ReconciliationView from '../../../shared/evidence/ReconciliationView';
import EvidenceTrace from '../../../shared/evidence/EvidenceTrace';
import {
  parseReconciliationEvidence, prepareReconciliationScope, reconciliationCommand, reconciliationScopeKey,
  RECONCILIATION_FILE_LIMIT, RECONCILIATION_PERSISTENCE,
  type ImportedReconciliationEvidence, type ReconciliationRunMode, type ReconciliationScope,
} from '../../../../contracts/reconciliationEvidence';

const allowedParameters = new Set(['clientId', 'startDate', 'endDate', 'filters', 'vendor', 'source', 'grade']);

function OperatorWorkflow({ scope }: { scope: ReconciliationScope }) {
  const [mode, setMode] = useState<ReconciliationRunMode>('dry-run');
  const [evidence, setEvidence] = useState<ImportedReconciliationEvidence | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const importRevision = useRef(0);
  const command = reconciliationCommand(scope, mode);
  const scopeDescription = `${scope.tenant} · ${scope.startDate} to ${scope.endDate} · ${Object.entries(scope.filters).map(([key, value]) => `${key}=${value}`).join(' · ') || 'No filters'}`;
  const clear = () => { importRevision.current++; setEvidence(null); setMessage('Local evidence cleared.'); setError(''); };

  return <div className="space-y-4">
    <p><strong>Exact run scope:</strong> {scopeDescription}</p>
    <label className="flex flex-col gap-1 text-sm">Operator run
      <select className="min-h-10 w-full rounded border border-control-border bg-surface px-3 text-text-main" value={mode} onChange={event => setMode(event.target.value as ReconciliationRunMode)}>
        <option value="dry-run">Dry run · validate warehouse query</option>
        <option value="warehouse">Measure warehouse only</option>
        <option value="compare">Measure and compare with service</option>
      </select>
    </label>
    <pre className="whitespace-pre-wrap break-all rounded border border-border-subtle bg-surface-subtle p-3 text-xs" aria-label="Reconciliation command">{command}</pre>
    <p className="text-sm text-text-sec">Run this command from the repository using an approved operator identity with BigQuery read access. The harness checks source-specific filter support, including grade availability, before querying and enforces the configured byte ceiling. This browser prepares the command; it executes no warehouse job. Save only the JSON output for import below.</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" className="cx-button-secondary" onClick={async () => {
        try { await navigator.clipboard.writeText(command); setMessage('Command copied. No reconciliation has run.'); setError(''); }
        catch { setError('Clipboard unavailable. Select and copy the command above.'); }
      }}><Copy size={14} aria-hidden="true"/> Copy command</button>
      <label className="flex min-w-0 max-w-full flex-col gap-2 text-sm"><span className="inline-flex items-center gap-2"><FileInput size={14} aria-hidden="true"/> Import local harness JSON</span>
        <input type="file" accept="application/json,.json" className="block min-h-10 w-full min-w-0 max-w-full text-xs" aria-label="Import reconciliation harness JSON" onChange={async event => {
          const file = event.target.files?.[0];
          const revision = ++importRevision.current;
          setEvidence(null); setError(''); setMessage('');
          if (!file) return;
          try {
            if (file.size > RECONCILIATION_FILE_LIMIT) throw new Error('Reconciliation file exceeds 128 KiB.');
            const result = parseReconciliationEvidence(await file.text(), scope);
            if (revision !== importRevision.current) return;
            setEvidence(result); setMessage('Operator file loaded locally. Its origin is not cryptographically attested.');
          } catch (failure) {
            if (revision === importRevision.current) setError(failure instanceof Error ? failure.message : 'Invalid reconciliation evidence.');
          } finally { event.target.value = ''; }
        }}/>
      </label>
      {evidence && <button type="button" className="cx-button-secondary" onClick={clear}><Trash2 size={14} aria-hidden="true"/> Clear local evidence</button>}
    </div>
    {message && <p role="status">{message}</p>}
    {error && <p className="text-semantic-neg" role="alert">{error}</p>}
    <dl className="grid gap-3 sm:grid-cols-2" aria-label="Reconciliation readiness">
      <div><dt>Operator file state</dt><dd><strong>{evidence?.state || 'Not run'}</strong></dd></div>
      <div><dt>Service comparison</dt><dd>{evidence?.comparisons.length ? 'Compared with service · listed metrics only' : 'Not compared'}</dd></div>
      <div><dt>Declared scope evidence</dt><dd>{evidence?.declaredStatus || 'LIVE_RECONCILIATION_PENDING'}</dd></div>
      <div><dt>Production verification</dt><dd>NOT_VERIFIED · local import is not trusted certification</dd></div>
      <div><dt>Persistence</dt><dd>{RECONCILIATION_PERSISTENCE.status}</dd></div>
      <div><dt>Business meaning</dt><dd>BUSINESS_MEANING_NOT_VERIFIED</dd></div>
    </dl>
    <p className="text-sm text-text-sec">{RECONCILIATION_PERSISTENCE.reason} An imported match applies only to the listed tenant, dates, filters, metric definitions and run time. It does not change any application metric's reconciliation state.</p>
    {evidence && <>
      <EvidenceTrace label="Imported reconciliation evidence" nodes={[
        { key: 'source', type: 'source', label: evidence.sourceTables.join(', '), state: 'not_verified', detail: 'Declared by the operator file; source access and provenance have not been independently attested here.' },
        { key: 'scope', type: 'qualification', label: scopeDescription, state: 'scoped', detail: evidence.countingGrain },
        { key: 'comparison', type: 'reconciliation', label: `Operator file: ${evidence.state}`, state: evidence.state === 'Mismatch detected' ? 'mismatch' : 'not_verified', detail: 'Exact arithmetic and scope are validated locally. This is separate from independent provenance verification.' },
      ]}/>
      <ReconciliationView model={{ kind: 'source_reconciliation', state: evidence.state === 'Mismatch detected' ? 'mismatch' : 'not_verified',
        label: 'Operator-supplied comparison · unattested', scopeDescription, values: [],
        comparisons: evidence.comparisons.map(row => ({ key: row.metric, label: row.metric, expected: row.warehouse, observed: row.service, detail: `Warehouse → service · ${row.status}` })),
        detail: 'Matching counts are reproducible arithmetic in this imported file. The browser cannot attest that its source jobs ran or that source meaning was approved.' }}/>
      <details className="cx-report-disclosure"><summary>Inspect imported scope, provenance and exact measurements</summary>
        <dl className="grid gap-3 p-3 sm:grid-cols-2">
          <div><dt>Generated / as of</dt><dd>{evidence.generatedAt} / {evidence.asOf}</dd></div>
          <div><dt>Definition / harness</dt><dd>{evidence.definitionVersion} / {evidence.harnessVersion}</dd></div>
          <div><dt>Date basis / timezone</dt><dd>{evidence.dateBasis} / {evidence.timezone}</dd></div>
          <div><dt>Warehouse job</dt><dd className="break-all">{evidence.warehouseQueryId || 'Not supplied'}</dd></div>
          <div><dt>Maximum bytes billed</dt><dd>{evidence.maximumBytesBilled}</dd></div>
          <div><dt>Dry-run estimated bytes</dt><dd>{evidence.dryRunBytes ?? 'Unavailable'}</dd></div>
        </dl>
        <div className="cx-performance-table-wrap" role="region" aria-label="Exact imported warehouse measurements" tabIndex={0}>
          <table className="cx-performance-table"><thead><tr><th scope="col">Measurement</th><th scope="col">Exact warehouse value</th></tr></thead><tbody>{Object.entries(evidence.metrics).map(([metric, value]) => <tr key={metric}><th scope="row">{metric}</th><td>{value ?? 'Unavailable'}</td></tr>)}</tbody></table>
        </div>
      </details>
    </>}
  </div>;
}

export default function ReconciliationReadiness() {
  const { isAdmin, user } = useAuth();
  const { selectedClient } = useClient();
  const { startDate, endDate, filters, filterError } = useFilters();
  const [params] = useSearchParams();
  if (!isAdmin) return <section className="cx-command-panel p-5" aria-label="Reconciliation operator access"><h2>Reconciliation operator workflow</h2><p>Administrator access is required to prepare or inspect reconciliation evidence.</p></section>;
  let scope: ReconciliationScope | null = null, error = '';
  try {
    if (filterError) throw new Error(filterError);
    scope = prepareReconciliationScope({ tenant: selectedClient, startDate, endDate, filters,
      unsupportedParameters: [...new Set(params.keys())].filter(key => !allowedParameters.has(key)) });
  } catch (failure) { error = failure instanceof Error ? failure.message : 'Unsupported reporting scope.'; }
  return <section className="cx-command-panel p-5 space-y-4" aria-label="Reconciliation operator workflow">
    <div><h2 className="text-base font-semibold">Reconciliation operator workflow</h2><p>Prepare an explicit scope, run the existing read-only harness, then inspect its local evidence.</p></div>
    {scope ? <OperatorWorkflow key={`${user?.uid || 'admin'}:${reconciliationScopeKey(scope)}`} scope={scope}/> : <p role="status">Command unavailable: {error} Set supported reporting dates and filters explicitly; no scope is dropped automatically.</p>}
  </section>;
}
