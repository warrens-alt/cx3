import type { MetricResult, ReportResult } from '../../contracts/reporting';
import { exactDecimal, exactPercent, subtractExactDecimals } from '../../contracts/exactDecimal';

export function exactMovement(current: string | null | undefined, previous: string | null | undefined): string | null {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return null;
  }
  const curr = exactDecimal(current), prev = exactDecimal(previous);
  return curr === null || prev === null ? null : exactPercent(subtractExactDecimals(curr, prev), prev, 1);
}

export function metricValue(report: ReportResult | null | undefined, metricId: string, group?: string | null): MetricResult | null {
  if (!report) return null;
  if (group !== undefined) return report.groups?.find(row => row.metricId === metricId && row.group === group) ?? null;
  return report.totals?.find(row => row.metricId === metricId) ?? null;
}

export interface ReportPivotRow {
  key: string;
  group: string;
  rawGroup: any;
  metrics: Record<string, MetricResult>;
}

export function pivotReportGroups(report: ReportResult | null | undefined, _metrics?: string[]): ReportPivotRow[] {
  if (!report) return [];
  const list = report.request.grouping === 'none' ? report.totals || [] : report.groups || [];
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
