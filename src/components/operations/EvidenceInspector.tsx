import React from 'react';
import type { MetricResult, ReportResult } from '../../../contracts/reporting';
import { METRIC_BY_ID } from '../../../contracts/reporting';
import InspectorHost, { type InspectorContent } from '../../shared/evidence/InspectorHost';
import { reportMetricInspector } from '../../features/evidenceWorkspace/reportEvidenceModel';

export interface EvidenceSelection {
  metric?: MetricResult; metricId?: string; metricLabel?: string; label?: string;
  group?: string; rawGroup?: unknown; groupIsNull?: boolean;
}
export interface EvidenceInspectorProps {
  report?: ReportResult | null; selection: EvidenceSelection | null;
  onClose: () => void; currency?: string;
}

/** Compatibility adapter: all reporting inspection uses the canonical audit/focus boundary. */
export default function EvidenceInspector({ report, selection, onClose }: EvidenceInspectorProps) {
  const metricId = selection?.metric?.metricId || selection?.metricId;
  const metric = selection?.metric || (metricId && [...(report?.totals || []), ...(report?.groups || [])].find(row => row.metricId === metricId && (selection?.group === undefined || row.group === selection.group)));
  const label = selection?.metricLabel || selection?.label || (metricId ? METRIC_BY_ID[metricId]?.label : undefined) || 'Metric evidence';
  const content: InspectorContent | null = !selection ? null : report && metric
    ? { ...reportMetricInspector(report, metric), title: label, ...(selection.group ? { subtitle: `Group: ${selection.group} · calculation and verification are separate.` } : {}) }
    : { type: 'custom', title: label, value: null, detailLimitation: 'No exact immutable metric evidence was returned for this selection. No verification is inferred.' };
  return <InspectorHost open={!!selection} content={content} onClose={onClose} />;
}
