import React from 'react';
import { X, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { MetricResult, ReportResult } from '../../../contracts/reporting';
import { METRIC_BY_ID } from '../../../contracts/reporting';

export interface EvidenceSelection {
  metric?: MetricResult;
  metricId?: string;
  metricLabel?: string;
  label?: string;
  group?: string;
  rawGroup?: any;
  groupIsNull?: boolean;
}

export interface EvidenceInspectorProps {
  report?: ReportResult | null;
  selection: EvidenceSelection | null;
  onClose: () => void;
  currency?: string;
}

export default function EvidenceInspector({ report, selection, onClose, currency = 'ZAR' }: EvidenceInspectorProps) {
  if (!selection) return null;

  const { metric: selMetric, metricId, metricLabel, label: selLabel, group } = selection;
  const metric = selMetric || (metricId && (
    report?.totals?.find(m => m.metricId === metricId && (group === undefined || m.group === group)) ||
    report?.groups?.find(m => m.metricId === metricId && (group === undefined || m.group === group))
  ));
  const label = metricLabel || selLabel || (metricId ? METRIC_BY_ID[metricId]?.label : undefined) || metric?.metricId || 'Metric';

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-900 text-sm">Evidence Inspection</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition"
          aria-label="Close inspection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 flex-1 overflow-y-auto space-y-5 text-sm">
        <div>
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Metric</span>
          <p className="text-base font-medium text-slate-900 mt-0.5">{label}</p>
          {group && <p className="text-xs text-slate-500 mt-0.5">Group: {group}</p>}
        </div>

        {metric ? (
          <>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500">Value</span>
              <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
                {metric.value ?? 'Unavailable'}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                {metric.calculationStatus === 'CHECKED' ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                    <CheckCircle className="w-3.5 h-3.5" /> Verified Fact
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" /> {metric.calculationStatus}
                  </span>
                )}
              </div>
            </div>

            {metric.numerator && metric.denominator && (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">Numerator</span>
                  <span className="font-mono text-slate-900">{metric.numerator}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">Denominator</span>
                  <span className="font-mono text-slate-900">{metric.denominator}</span>
                </div>
              </div>
            )}

            {metric.reason && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                <strong>Audit Note:</strong> {metric.reason}
              </div>
            )}
          </>
        ) : (
          <div className="p-4 bg-slate-50 rounded text-xs text-slate-500">
            No exact metric details returned for this selection.
          </div>
        )}
      </div>
    </div>
  );
}
