import React, { useRef } from 'react';
import { X, ExternalLink, ShieldCheck, Info, FileText, ArrowRight } from 'lucide-react';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';
import { AUTHORITATIVE_METRICS, type AuthoritativeMetricDefinition } from '../../../contracts/metricRegistry';
import { useAuth } from '../../lib/AuthContext';
import { Link } from 'react-router-dom';
import { useScopedNavigationTarget } from '../../hooks/useScopedNavigationTarget';

export interface InspectorContent {
  type: 'metric' | 'stage' | 'segment' | 'custom';
  metricId?: string;
  title: string;
  subtitle?: string;
  value?: string | number | null;
  unit?: string;
  numeratorCount?: number | null;
  numeratorLabel?: string;
  denominatorCount?: number | null;
  denominatorLabel?: string;
  rate?: number | null;
  reportPath?: string;
  reportLabel?: string;
  recordDrill?: {
    drill: string;
    drillValue?: string;
    label?: string;
  };
  details?: React.ReactNode;
}

interface InspectorHostProps {
  open: boolean;
  onClose: () => void;
  content: InspectorContent | null;
}

export default function InspectorHost({ open, onClose, content }: InspectorHostProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility(open, onClose);
  const { isAdmin } = useAuth();
  const scoped = useScopedNavigationTarget();

  if (!open || !content) return null;

  const authMetric: AuthoritativeMetricDefinition | undefined = content.metricId
    ? AUTHORITATIVE_METRICS[content.metricId]
    : undefined;

  const drillPath = content.recordDrill
    ? `/lead-explorer?drill=${encodeURIComponent(content.recordDrill.drill)}${
        content.recordDrill.drillValue
          ? `&drillValue=${encodeURIComponent(content.recordDrill.drillValue)}`
          : ''
      }`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity"
      aria-modal="true"
      role="dialog"
      aria-labelledby="inspector-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl h-full bg-surface border-l border-border-default shadow-drawer flex flex-col overflow-y-auto animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface-sec sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-mute">
                Evidence Inspector
              </span>
              {authMetric && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-primary bg-brand-soft px-1.5 py-0.5 rounded">
                  <ShieldCheck size={11} />
                  Authoritative
                </span>
              )}
            </div>
            <h2 id="inspector-title" className="text-lg font-bold text-text-main mt-0.5">
              {content.title}
            </h2>
            {content.subtitle && (
              <p className="text-xs text-text-sec mt-0.5">{content.subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-mute hover:text-text-main hover:bg-surface rounded-md transition-colors cursor-pointer"
            aria-label="Close inspector"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 flex-1 text-sm text-text-main">
          {/* Headline Measure */}
          {content.value !== undefined && (
            <div className="p-4 rounded-lg bg-surface-subtle border border-border-subtle">
              <span className="text-xs text-text-mute uppercase tracking-wider font-semibold">
                Observed Result
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold cx-tabular text-text-main">
                  {content.value}
                </span>
                {content.unit && (
                  <span className="text-sm font-medium text-text-mute">{content.unit}</span>
                )}
              </div>
            </div>
          )}

          {/* Ratio Breakdown if Numerator / Denominator provided */}
          {(content.numeratorCount != null || content.denominatorCount != null) && (
            <div className="space-y-2 p-4 rounded-lg bg-surface border border-border-subtle">
              <h3 className="text-xs font-semibold text-text-mute uppercase tracking-wider">
                Evidence Ratio Components
              </h3>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="p-3 bg-surface-subtle rounded border border-border-subtle">
                  <div className="text-xs text-text-sec">
                    {content.numeratorLabel || 'Numerator population'}
                  </div>
                  <div className="text-xl font-bold cx-tabular text-text-main mt-1">
                    {content.numeratorCount?.toLocaleString() ?? '—'}
                  </div>
                </div>
                <div className="p-3 bg-surface-subtle rounded border border-border-subtle">
                  <div className="text-xs text-text-sec">
                    {content.denominatorLabel || 'Denominator population'}
                  </div>
                  <div className="text-xl font-bold cx-tabular text-text-main mt-1">
                    {content.denominatorCount?.toLocaleString() ?? '—'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Authoritative Metric Contract Details */}
          {authMetric && (
            <div className="space-y-3 p-4 rounded-lg bg-surface border border-border-subtle">
              <h3 className="text-xs font-semibold text-text-mute uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={13} className="text-brand-primary" />
                Specification & Contract
              </h3>
              <div className="text-xs text-text-sec space-y-2">
                <div>
                  <span className="font-semibold text-text-main">Metric ID: </span>
                  <code className="bg-surface-sec px-1 py-0.5 rounded font-mono text-[11px]">
                    {authMetric.id}
                  </code>
                </div>
                <div>
                  <span className="font-semibold text-text-main">Counting Grain: </span>
                  <span>{authMetric.countingGrain}</span>
                </div>
                <div>
                  <span className="font-semibold text-text-main">Numerator / Denominator: </span>
                  <div className="bg-surface-sec px-2 py-1 rounded font-mono text-[11px] mt-1 space-y-0.5">
                    <div>Num: {authMetric.numerator}</div>
                    {authMetric.denominator && <div>Denom: {authMetric.denominator}</div>}
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-text-main">Treatment of Unknown: </span>
                  <span>{authMetric.treatmentOfUnknown}</span>
                </div>
                {authMetric.caveats?.length > 0 && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-800 dark:text-amber-300 mt-2 space-y-1">
                    <span className="font-semibold">Caveats & Limitations: </span>
                    <ul className="list-disc list-inside">
                      {authMetric.caveats.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Custom Details slot */}
          {content.details}

          {/* Record-Level Evidence Action */}
          <div className="pt-4 border-t border-border-subtle space-y-3">
            {isAdmin && drillPath ? (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-text-mute uppercase tracking-wider">
                  Inspect Supporting Records
                </span>
                <p className="text-xs text-text-sec">
                  As an authorized administrator, you can inspect individual matching lead records and event timelines in Lead Explorer with current scope preserved.
                </p>
                <Link
                  to={scoped(drillPath)}
                  onClick={onClose}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-md text-xs font-semibold hover:bg-brand-hover transition-colors"
                >
                  <span>{content.recordDrill?.label || 'View matching lead records'}</span>
                  <ExternalLink size={13} />
                </Link>
              </div>
            ) : (
              <div className="text-xs text-text-mute bg-surface-subtle p-3 rounded border border-border-subtle">
                <div className="flex items-center gap-1.5 font-semibold text-text-sec mb-1">
                  <Info size={13} />
                  <span>Record Access Policy</span>
                </div>
                <p>
                  Aggregate calculations reflect the authorized tenant scope. Individual lead records and timeline events are restricted to platform administrators in accordance with security specifications.
                </p>
              </div>
            )}

            {/* Operational Report Link */}
            {content.reportPath && (
              <div className="pt-2">
                <Link
                  to={scoped(content.reportPath)}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 text-xs text-brand-primary font-medium hover:underline"
                >
                  <span>{content.reportLabel || 'Open dedicated operational workspace'}</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle bg-surface-sec flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-text-sec bg-surface border border-border-subtle rounded-md hover:bg-surface-subtle hover:text-text-main transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
