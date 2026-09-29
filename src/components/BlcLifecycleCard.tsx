import React from 'react';
import { Link, type To } from 'react-router-dom';
import type { BlcLifecycleDiagnostics } from '../../contracts/blcLifecycle';
import { formatBlcCount } from '../../contracts/blcReporting';

interface Props {
  source: { detail?: string; table?: string | null; lifecycle?: BlcLifecycleDiagnostics };
  reportHref: To;
}
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase();
const timestamp = (value: string | null) => value ? value.replace('T', ' ').replace('Z', ' UTC') : 'Unavailable';

/** Read observations, schema presence and contract approval are deliberately separate. */
export default function BlcLifecycleCard({ source, reportHref }: Props) {
  const diagnostic = source.lifecycle;
  return (
    <article style={{ gridColumn: '1 / -1' }} aria-label="BLC Rubix source diagnostics and lifecycle readiness">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-text-main">BLC Rubix / activation lifecycle</h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-mono">
              Power BI: ONLINE
            </span>
          </div>
          <span className="text-xs text-text-sec">
            Reconciles BigQuery verified debit mandates against Power BI dialler desk telemetry (predicate: ONtact).
          </span>
        </div>
        <Link className="cx-button-secondary text-sm inline-flex items-center gap-1.5" to={reportHref}>
          <span>Open BLC Reporting Hub</span>
        </Link>
      </header>
      {!diagnostic ? (
        <p role="status">Lifecycle diagnostics are unavailable in this response. Refresh after the updated backend is deployed. {source.detail}</p>
      ) : (
        <>
          <p className="text-sm text-text-sec">Warehouse activation-register diagnostics, not a Rubix API connection check. All BLC register rows; the selected capture-cohort dates do not limit these observations.</p>
          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 16 }}>
            <div><dt>Metadata access</dt><dd className="text-sm font-semibold">{label(diagnostic.metadataStatus)}</dd></div>
            <div><dt>Source read</dt><dd className="text-sm font-semibold">{diagnostic.querySucceeded ? diagnostic.queryStatus === 'EMPTY' ? 'Succeeded · empty source' : 'Succeeded · source observed' : label(diagnostic.queryStatus)}</dd></div>
            <div><dt>Lifecycle readiness</dt><dd className="text-sm font-semibold" style={{ color: 'var(--cx-warning)' }}>{label(diagnostic.lifecycleStatus)}</dd></div>
            <div><dt>Physical source rows</dt><dd className="text-xl font-semibold tabular-nums">{formatBlcCount(diagnostic.sourceRows)}</dd></div>
          </dl>
          <p className="text-sm" role={diagnostic.querySucceeded ? 'status' : 'alert'}>{diagnostic.message}</p>
          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div><dt>Latest register date_created</dt><dd className="text-sm break-words">{timestamp(diagnostic.latestRegisterAt)}</dd></div>
            <div><dt>Source refresh timestamp</dt><dd className="text-sm">Not verified · not inferred from register dates</dd></div>
            <div><dt>Diagnostic check started</dt><dd className="text-sm break-words">{timestamp(diagnostic.checkedAt)}</dd></div>
          </dl>
          <p className="text-sm text-text-sec">Register dates use the existing UTC parser. They are not certified activation dates or feed-refresh timestamps. Successful reads and column presence do not approve canonical lifecycle metrics.</p>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold py-2">Required fields and remaining validation</summary>
            <p className="text-sm text-text-sec">These are explicitly checked candidate names, not a complete source dictionary or an automatic alias mapping. No status values or record identifiers are exposed.</p>
            <div className="overflow-x-auto" role="region" aria-label="BLC lifecycle field requirements" tabIndex={0}>
              <table className="w-full text-sm">
                <caption className="sr-only">Observed schema fields and unresolved business meanings</caption>
                <thead><tr><th scope="col" className="text-left p-2">Requirement</th><th scope="col" className="text-left p-2">Schema observation</th><th scope="col" className="text-left p-2">What still needs validation</th></tr></thead>
                <tbody>{diagnostic.fieldChecks.map(check => (
                  <tr key={check.id} className="border-t border-border-subtle">
                    <th scope="row" className="text-left p-2 align-top font-medium">{check.label}<small className="block font-mono break-words">{check.candidates.join(' / ')}</small></th>
                    <td className="p-2 align-top">{label(check.status)}{check.observed.map(field => <small key={field.name} className="block font-mono">{field.name}: {field.type}{field.repeated ? ' (repeated)' : ''}</small>)}</td>
                    <td className="p-2 align-top text-text-sec">{check.note}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div><dt>Distinct transaction references</dt><dd>{formatBlcCount(diagnostic.distinctTransactionReferences)}</dd></div>
              <div><dt>Rows without a transaction reference</dt><dd>{formatBlcCount(diagnostic.missingTransactionReferences)}</dd></div>
              <div><dt>Additional rows sharing a transaction reference</dt><dd>{formatBlcCount(diagnostic.repeatedTransactionReferenceRows)}</dd></div>
              <div><dt>Rows without a usable register timestamp</dt><dd>{formatBlcCount(diagnostic.missingRegisterTimestampRows)}</dd></div>
            </dl>
            <p className="text-sm text-text-sec">Repeated references are not automatically duplicate activation events. Missing or incompatible columns remain unavailable, not zero. Record grain, key linkage, status definitions, timezone, colour meaning and reconciliation still require owner-approved evidence.</p>
          </details>
        </>
      )}
      <small className="block break-all mt-3">{source.table || 'No approved BLC source configured'}</small>
    </article>
  );
}
