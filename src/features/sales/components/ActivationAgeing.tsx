import React from 'react';
import EvidenceBars from '../../../shared/visuals/EvidenceBars';
import { Clock3, AlertTriangle, Download, ExternalLink } from 'lucide-react';
import type { AdaptedAgeingBucket, AdaptedSalesActivation } from '../model/salesActivationAdapter';
import { formatTableNumber, formatPercent } from '../../../lib/formatters';

interface ActivationAgeingProps {
  model: AdaptedSalesActivation;
  onInspectBucket: (bucket: AdaptedAgeingBucket) => void;
  onExportAgeing: () => void;
}

const BUCKET_COLORS: Record<string, string> = {
  '0–3d': 'var(--cx-text-muted)',
  '4–7d': 'var(--cx-text-secondary)',
  '8–14d': 'color-mix(in srgb, var(--cx-warning) 65%, var(--cx-surface))',
  '15–30d': 'color-mix(in srgb, var(--cx-warning) 85%, var(--cx-surface))',
  '30d+': 'var(--cx-warning)',
  'Invalid future sale': 'var(--cx-negative)',
};

export default function ActivationAgeing({
  model,
  onInspectBucket,
  onExportAgeing,
}: ActivationAgeingProps) {
  const { ageing } = model;
  const buckets = ageing.buckets;

  return (
    <section className="enterprise-card cx-analytics-card" aria-label="Activation ageing queue">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-4 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2">
            <span className="cx-command-section-kicker">Post-sale queue</span>
            <Clock3 size={15} className="text-text-mute" />
          </div>
          <h2 className="text-base font-semibold text-text-main">Sales awaiting activation by completed age</h2>
          <p className="text-xs text-text-sec">
            Non-overlapping completed-day age cohorts measured from recorded sale timestamp. Total unactivated:{' '}
            <strong className="text-text-main">{model.summary.salesWithoutActivation == null ? 'Unavailable' : formatTableNumber(ageing.totalUnactivated)}</strong>
            {ageing.hasInvalidFuture && (
              <span className="text-semantic-neg ml-1.5 font-medium">
                ({formatTableNumber(ageing.invalidFuture)} future timestamp anomaly)
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cx-button-secondary text-xs flex items-center gap-1.5 py-1 px-2.5"
            onClick={onExportAgeing}
            title="Download ageing distribution CSV"
          >
            <Download size={13} />
            <span>Export ageing</span>
          </button>
        </div>
      </header>

      <div className="cx-sales-ageing-histogram">
        {model.summary.salesWithoutActivation == null ? <p className="cx-viz-empty">Activation queue evidence unavailable.</p> : <>
          <EvidenceBars title="Completed-day distribution" description="Each recorded sale appears in one age cohort. Bar length shows the returned count; colour indicates age, not a performance target."
            items={buckets.filter(bucket => !bucket.isInvalidFuture).map(bucket => ({ key: bucket.bucket, label: bucket.bucket, value: bucket.sales,
              detail: bucket.shareOfUnactivated == null ? 'Share unavailable' : `${formatPercent(bucket.shareOfUnactivated)} of observed backlog`, color: BUCKET_COLORS[bucket.bucket] }))}
            onSelect={key => { const bucket = buckets.find(item => item.bucket === key); if (bucket) onInspectBucket(bucket); }} />
          {buckets.filter(bucket => bucket.isInvalidFuture).map(bucket => <button type="button" key={bucket.bucket} className="cx-sales-ageing-anomaly" data-state={bucket.sales > 0 ? 'anomaly' : 'zero'} onClick={() => onInspectBucket(bucket)}>
            <AlertTriangle size={18} aria-hidden="true" /><span><strong>Future sale timestamps</strong><small>Chronology evidence, excluded from the completed-age distribution above</small></span><b>{formatTableNumber(bucket.sales)}</b>
          </button>)}
        </>}
      </div>

      {model.summary.salesWithoutActivation != null && <details className="cx-evidence-disclosure"><summary>View exact ageing evidence</summary>
      {/* Precise Supporting Table in Unified Analytical Region */}
      <div className="cx-performance-table-wrap">
        <table className="cx-performance-table w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="py-2.5 px-3 text-xs font-semibold text-text-sec">Completed age cohort</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-text-sec">Cohort definition</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-text-sec text-right">Sales awaiting activation</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-text-sec text-right">Share of backlog</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-text-sec text-right">Status / Evidence</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr
                key={b.bucket}
                onClick={() => onInspectBucket(b)}
                className={`cursor-pointer transition-colors hover:bg-surface-subtle ${
                  b.isInvalidFuture && b.sales > 0 ? 'bg-semantic-neg-bg hover:bg-semantic-neg-bg' : ''
                }`}
              >
                <th className="py-2.5 px-3 text-xs font-semibold text-text-main flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                    style={{ background: BUCKET_COLORS[b.bucket] || 'var(--cx-text-muted)' }}
                  />
                  <button type="button" onClick={event => { event.stopPropagation(); onInspectBucket(b); }} className="cx-admin-text-button" aria-label={`Inspect ${b.bucket} activation ageing`}>{b.bucket}</button>
                </th>
                <td className="py-2.5 px-3 text-xs text-text-sec">
                  {b.description}
                </td>
                <td className="py-2.5 px-3 text-xs font-mono font-medium text-text-main text-right">
                  {formatTableNumber(b.sales)}
                </td>
                <td className="py-2.5 px-3 text-xs text-text-sec text-right">
                  {b.shareOfUnactivated !== null ? formatPercent(b.shareOfUnactivated) : '—'}
                </td>
                <td className="py-2.5 px-3 text-xs text-right">
                  {b.isInvalidFuture && b.sales > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-semantic-neg">
                      <AlertTriangle size={11} /> Timestamp error
                    </span>
                  ) : b.drillSupported ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-action hover:text-action-hover">
                      Record drill available <ExternalLink size={10} />
                    </span>
                  ) : (
                    <span className="text-[11px] text-text-disabled">Aggregate only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-surface-subtle font-bold text-text-main">
              <th className="py-2.5 px-3 text-xs">Total observed backlog</th>
              <td className="py-2.5 px-3 text-xs text-text-sec">Complete non-overlapping age queue</td>
              <td className="py-2.5 px-3 text-xs font-mono text-right">{formatTableNumber(ageing.totalUnactivated)}</td>
              <td className="py-2.5 px-3 text-xs text-right">{ageing.totalUnactivated > 0 ? '100.0%' : '—'}</td>
              <td className="py-2.5 px-3 text-xs text-right text-text-sec">
                {ageing.hasInvalidFuture ? `${formatTableNumber(ageing.invalidFuture)} anomalies` : 'No future timestamps recorded'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      </details>}
    </section>
  );
}
