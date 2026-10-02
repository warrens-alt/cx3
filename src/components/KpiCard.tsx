import React, { Suspense, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, ArrowRight, Info, Search, Table as TableIcon } from 'lucide-react';
import { formatKpiValue } from '../lib/formatters';

const DataAuditDrawer = React.lazy(() => import('./DataAuditDrawer'));
const MetricLineageDrawer = React.lazy(() => import('./MetricLineageDrawer'));

interface KpiCardProps {
  title: string;
  value: string | number | null;
  change?: number;
  changeLabel?: string;
  isPositiveGood?: boolean;
  prefix?: string;
  suffix?: string;
  loading?: boolean;
  subtitle?: string;
  lineage?: any;
  metadata?: any;
  onAnalyse?: () => void;
  onWhyChanged?: () => void;
}

export default function KpiCard({
  title,
  value,
  change,
  changeLabel = 'vs baseline',
  isPositiveGood = true,
  prefix = '',
  suffix = '',
  loading = false,
  subtitle,
  lineage,
  metadata,
  onAnalyse,
  onWhyChanged,
}: KpiCardProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  if (loading) {
    return (
      <div className="cx-kpi cx-metric-card" role="status" aria-label={`Loading ${title}`}>
        <div className="animate-pulse h-4 bg-surface-subtle border border-border-subtle rounded mb-4" />
        <div className="animate-pulse h-8 bg-surface-subtle border border-border-subtle rounded w-1/2 mb-2" />
        <div className="animate-pulse h-3 bg-surface-subtle border border-border-subtle rounded w-1/3" />
      </div>
    );
  }

  const missing = value === null || value === undefined || value === 'Unavailable';
  const hasChange = typeof change === 'number' && Number.isFinite(change);
  const positive = hasChange && (change! > 0 ? isPositiveGood : !isPositiveGood);
  const Icon = change === 0 ? Minus : change! > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <>
      <article className="cx-kpi cx-metric-card">
        <div>
          <div className="flex items-center justify-between gap-1 mb-1">
            <h3 className="cx-metric-label">{title}</h3>
            <div className="flex items-center gap-0.5">
              {lineage && (
                <>
                  <button
                    type="button"
                    className="text-text-mute hover:text-brand-primary p-0.5 rounded transition-colors cursor-pointer"
                    aria-label={`Definition of ${title}`}
                    title="Metric definition & lineage"
                    onClick={() => setDrawerOpen(true)}
                  >
                    <Info size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="text-text-mute hover:text-brand-primary p-0.5 rounded transition-colors cursor-pointer"
                    aria-label={`Inspect selected lead population for ${title}`}
                    title="Selected lead population"
                    onClick={() => setAuditOpen(true)}
                  >
                    <TableIcon size={13} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="my-1.5">
            {!missing && prefix && <small className="text-text-sec font-medium text-xs mr-1">{prefix}</small>}
            <strong className="cx-metric-value text-2xl lg:text-[28px] font-bold tracking-tight text-text-main tabular-nums leading-tight">
              {missing ? 'Unavailable' : typeof value === 'number' ? formatKpiValue(value) : value}
            </strong>
            {!missing && suffix && <small className="text-text-sec font-medium text-xs ml-1">{suffix}</small>}
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs mt-1">
            {hasChange ? (
              <div className="inline-flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-text-sec text-[11px]">{changeLabel}</span>
                <span
                  className={`inline-flex items-center gap-0.5 font-semibold text-[11px] px-1.5 py-0.5 rounded tabular-nums ${
                    change === 0
                      ? 'text-text-mute bg-surface-subtle border border-border-subtle'
                      : positive
                      ? 'text-semantic-pos bg-semantic-pos/10'
                      : 'text-semantic-neg bg-semantic-neg/10'
                  }`}
                >
                  <Icon size={11} className="shrink-0" aria-hidden="true" />
                  {change! > 0 ? `+${change!.toFixed(2)}%` : `${change!.toFixed(2)}%`}
                </span>
              </div>
            ) : (
              <span className="text-text-mute text-xs text-[11px]">{subtitle || 'Observed operational population'}</span>
            )}
          </div>
        </div>

        {(onAnalyse || onWhyChanged) ? (
          <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-border-subtle text-[11px] min-h-[29px] flex-wrap">
            {onWhyChanged && (
              <button
                type="button"
                className="cx-why-btn"
                onClick={onWhyChanged}
                title={`Investigate why ${title.toLowerCase()} changed`}
              >
                <span>Why changed?</span>
                <Search size={10} aria-hidden="true" />
              </button>
            )}
            {onWhyChanged && onAnalyse && (
              <span className="text-border-strong text-[10px]" aria-hidden="true">·</span>
            )}
            {onAnalyse && (
              <button
                type="button"
                className="cx-inspect-btn"
                onClick={onAnalyse}
                title={`Inspect & analyse ${title}`}
              >
                <span>Inspect</span>
                <ArrowRight size={10} aria-hidden="true" />
              </button>
            )}
          </div>
        ) : null}
      </article>

      {lineage && (auditOpen || drawerOpen) && (
        <Suspense fallback={<span role="status" className="sr-only">Loading details…</span>}>
          {auditOpen && (
            <DataAuditDrawer
              isOpen
              onClose={() => setAuditOpen(false)}
              title={`Selected Lead Population: ${title}`}
              contextFilters={{}}
            />
          )}
          {drawerOpen && (
            <MetricLineageDrawer
              isOpen
              onClose={() => setDrawerOpen(false)}
              title={title}
              lineage={lineage}
              metadata={metadata}
            />
          )}
        </Suspense>
      )}
    </>
  );
}
