import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import { operationalLeadCtes } from '../common/leadMetrics';
import { buildFilterClause } from '../common/scope';
import type { OffernetQueryParams } from '../common/types';
import type { ExceptionAnalyticsData } from '../../../contracts/exceptionAnalytics';
import { matchedPeriodWindow, compareMetric } from '../../../contracts/periodComparison';
import { EXCEPTION_DEFINITIONS, exceptionPredicate } from './exceptionPredicates';
import { currentAnalyticsScope } from '../../analyticsContext';

const pendingExceptions = new Map<string, Promise<ExceptionAnalyticsData>>();

/** Share overlapping Exceptions/AI reads only; every completed read leaves the next request fresh. */
export async function getExceptionAnalytics(params: OffernetQueryParams): Promise<ExceptionAnalyticsData> {
  // Configuration and ambient bindings can change the population even when request fields match.
  const key = JSON.stringify([
    Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
    getClientConfig(params.clientId),
    currentAnalyticsScope(),
  ]);
  const existing = pendingExceptions.get(key);
  if (existing) return existing;
  const pending = loadExceptionAnalytics(params).finally(() => pendingExceptions.delete(key));
  pendingExceptions.set(key, pending);
  return pending;
}

async function loadExceptionAnalytics(params: OffernetQueryParams): Promise<ExceptionAnalyticsData> {
  const config = getClientConfig(params.clientId);
  const comparison = matchedPeriodWindow(params.startDate, params.endDate);
  const scope = comparison ? { ...params, startDate: comparison.previous.startDate } : params;
  const { queryParams } = buildFilterClause(scope);
  const [rows] = await getBigQueryClient(config.bigQueryProject).query({
    query: `WITH ${operationalLeadCtes(scope)}, populations AS (
      SELECT m.vendor, m.source, ${comparison ? "IF(DATE(m.fetched_ts, @exceptionTimezone) >= @currentStartDate, 'current', 'previous')" : "'current'"} AS comparison_period,
        [${EXCEPTION_DEFINITIONS.map(item => `STRUCT('${item.id}' AS id, (${exceptionPredicate(item.id)}) AS affected)`).join(',\n')} ] AS exceptions
      FROM operational_leads m
    )
    SELECT comparison_period, e.id, vendor, source, COUNT(*) AS affected_count
    FROM populations CROSS JOIN UNNEST(exceptions) e
    WHERE e.affected
    GROUP BY comparison_period, e.id, vendor, source`,
    params: { ...queryParams, ...(comparison ? { currentStartDate: comparison.current.startDate, exceptionTimezone: config.timezone } : {}) },
  });
  const exceptions = EXCEPTION_DEFINITIONS.map(definition => {
    const current = rows.filter((r: any) => r.id === definition.id && r.comparison_period === 'current');
    const previous = rows.filter((r: any) => r.id === definition.id && r.comparison_period === 'previous');
    const total = (items: any[]) => items.reduce((sum, row) => sum + Number(row.affected_count || 0), 0);
    const breakdown = (dimension: 'vendor' | 'source') => {
      const groups = new Map<string, number>();
      for (const row of current) {
        const name = String(row[dimension] || 'Unknown');
        groups.set(name, (groups.get(name) || 0) + Number(row.affected_count || 0));
      }
      return [...groups].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    };
    const change = compareMetric(total(current), comparison ? total(previous) : null, 'count');
    return { ...definition, count: total(current), previousCount: change.previous, absoluteChange: change.absoluteChange,
      percentageChange: change.percentageChange, byVendor: breakdown('vendor'), bySource: breakdown('source') };
  });
  return { validationStatus: 'NOT_VERIFIED', generatedAt: new Date().toISOString(), comparison,
    comparisonReason: comparison ? 'Equal-length capture cohorts measured at query time. Backlogs and ageing are current snapshots of each cohort, not reconstructed historical queue states.' : 'Select both dates for an immediately preceding equal-length cohort comparison.',
    exceptions, populationNote: 'Distinct scoped leads; exception types overlap and must not be added. Severity describes the operational rule, not a model score. Record access remains administrator governed.' };
}
