import type { MetricResult, ReportResult } from '../../contracts/reporting';

export function exactMovement(current: string | null | undefined, previous: string | null | undefined): string | null {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return null;
  }
  const curr = parseFloat(current);
  const prev = parseFloat(previous);
  if (Number.isNaN(curr) || Number.isNaN(prev) || prev === 0) {
    return null;
  }
  const pct = ((curr - prev) / prev) * 100;
  return pct.toFixed(1);
}

export function metricValue(report: ReportResult | null | undefined, metricId: string, group?: string | null): MetricResult | null {
  if (!report) return null;
  if (group !== undefined && group !== null) {
    const match = report.groups?.find((m: MetricResult) => m.metricId === metricId && m.group === group);
    if (match) return match;
  }
  const totalMatch = report.totals?.find((m: MetricResult) => m.metricId === metricId);
  if (totalMatch) return totalMatch;

  const fallback = report.groups?.find((m: MetricResult) => m.metricId === metricId);
  return fallback ?? null;
}

export interface ReportPivotRow {
  key: string;
  group: string;
  rawGroup: any;
  metrics: Record<string, MetricResult>;
}

export function pivotReportGroups(report: ReportResult | null | undefined, _metrics?: string[]): ReportPivotRow[] {
  if (!report) return [];
  const list = report.groups && report.groups.length > 0 ? report.groups : report.totals || [];
  const groupsMap = new Map<string, ReportPivotRow>();
  for (const m of list) {
    const raw = m.group ?? 'Total';
    const grp = String(raw);
    if (!groupsMap.has(grp)) {
      groupsMap.set(grp, {
        key: grp,
        group: grp,
        rawGroup: m.group,
        metrics: {},
      });
    }
    groupsMap.get(grp)!.metrics[m.metricId] = m;
  }
  return Array.from(groupsMap.values());
}
