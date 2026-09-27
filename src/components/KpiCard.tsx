import React, { Suspense, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, ArrowRight, Info, Table as TableIcon } from 'lucide-react';
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
      <div className="enterprise-card cx-kpi" role="status" aria-label={`Loading ${title}`}>
        <div className="animate-pulse h-4 bg-slate-100 rounded mb-4" />
        <div className="animate-pulse h-9 bg-slate-100 rounded w-1/2" />
      </div>
    );
  }

  const missing = value === null || value === undefined || value === 'Unavailable';
  const hasChange = typeof change === 'number' && Number.isFinite(change);
  const positive = hasChange && (change! > 0 ? isPositiveGood : !isPositiveGood);
  const Icon = change === 0 ? Minus : change! > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <>
      <article className="enterprise-card cx-kpi">
        <div className="cx-kpi-heading">
          <h3 className="text-slate-600 dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider font-mono">{title}</h3>
          {lineage && (
            <div className="cx-kpi-tools">
              <button
                type="button"
                className="cx-kpi-action hover:bg-slate-100 dark:hover:bg-slate-800 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                aria-label={`Definition of ${title}`}
                title="Metric definition"
                onClick={() => setDrawerOpen(true)}
              >
                <Info size={13} />
              </button>
              <button
                type="button"
                className="cx-kpi-action hover:bg-slate-100 dark:hover:bg-slate-800 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                aria-label={`Inspect selected lead population for ${title}`}
                title="Selected lead population (legacy)"
                onClick={() => setAuditOpen(true)}
              >
                <TableIcon size={13} />
              </button>
            </div>
          )}
        </div>

        <div className="cx-kpi-amount my-2">
          {!missing && prefix && <small className="text-slate-500 dark:text-slate-400 font-medium text-xs mr-1">{prefix}</small>}
          <strong className="text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono tabular-nums leading-none">
            {missing ? 'Unavailable' : typeof value === 'number' ? formatKpiValue(value) : value}
          </strong>
          {!missing && suffix && <small className="text-slate-500 dark:text-slate-400 font-medium text-xs ml-1">{suffix}</small>}
        </div>

        <div className="cx-kpi-note mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
          {hasChange ? (
            <div className="inline-flex flex-wrap items-center gap-1.5 text-xs font-mono">
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">{changeLabel}</span>
              <span
                className={`inline-flex items-center gap-0.5 font-semibold text-[11px] tabular-nums ${
                  change === 0
                    ? 'text-slate-500 dark:text-slate-400'
                    : positive
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                <Icon size={12} className="shrink-0" />
                {change! > 0 ? `+${change!.toFixed(2)}%` : `${change!.toFixed(2)}%`}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 text-xs font-mono text-[11px]">{subtitle || 'No comparison supplied'}</span>
          )}
        </div>

        {(onAnalyse || onWhyChanged) && (
          <footer className="cx-kpi-footer">
            {onWhyChanged && (
              <button type="button" className="cx-link-button" onClick={onWhyChanged}>
                Why changed?
              </button>
            )}
            {onAnalyse && (
              <button type="button" className="cx-link-button ml-auto" onClick={onAnalyse}>
                Analyse <ArrowRight size={14} />
              </button>
            )}
          </footer>
        )}
      </article>

      {lineage && (auditOpen || drawerOpen) && (
        <Suspense fallback={<span role="status" className="sr-only">Loading details…</span>}>
          {auditOpen&&<DataAuditDrawer
            isOpen
            onClose={() => setAuditOpen(false)}
            title={`Selected Lead Population: ${title}`}
            contextFilters={{}}
          />}
          {drawerOpen&&<MetricLineageDrawer
            isOpen
            onClose={() => setDrawerOpen(false)}
            title={title}
            lineage={lineage}
            metadata={metadata}
          />}
        </Suspense>
      )}
    </>
  );
}
