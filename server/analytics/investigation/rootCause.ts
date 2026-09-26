import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import { RequestError } from '../../bigquery/filters';
import type { OffernetQueryParams } from '../common/types';
import { operationalLeadCtes } from '../common/leadMetrics';
import { matchedPeriodWindow } from '../../../contracts/periodComparison';
import { buildFilterClause } from '../common/scope';

// Deterministic root-cause decomposition for matched periods.
// Dimensions are reduced to one value per lead so each dimension reconciles to the selected metric.
export async function getRootCauseAnalysis(params: OffernetQueryParams) {
  const allowedMetrics = new Set(['fetchedLeads', 'deliveryRate', 'dialRate', 'contactRate', 'leadToSaleRate', 'activationRate']);
  const metric = params.metric || 'leadToSaleRate';
  if (!allowedMetrics.has(metric)) throw new RequestError('Unsupported root-cause metric', 422);
  if (!params.startDate || !params.endDate) throw new RequestError('Root-cause analysis requires an explicit startDate and endDate', 422);

  const comparison = matchedPeriodWindow(params.startDate, params.endDate);
  if (!comparison) throw new RequestError('Root-cause date range must be between 1 and 366 valid calendar days', 422);
  const previousStartDate = comparison.previous.startDate;
  const previousEndDate = comparison.previous.endDate;
  const config = getClientConfig(params.clientId);
  const client = getBigQueryClient(config.bigQueryProject);
  const expandedScope = { ...params, startDate: previousStartDate };
  const queryParams = {
    ...buildFilterClause(expandedScope).queryParams,
    currentStartDate: params.startDate, currentEndDate: params.endDate,
    previousStartDate, previousEndDate, rootCauseTimezone: config.timezone,
  };

  const query = `
    WITH ${operationalLeadCtes(expandedScope)}, lead_level AS (
      SELECT *, DATE(fetched_ts, @rootCauseTimezone) AS fetched_date, delivered_ts AS first_delivery_ts
      FROM operational_leads
    ),
    periodized AS (
      SELECT
        *,
        CASE
          WHEN fetched_date BETWEEN @currentStartDate AND @currentEndDate THEN 'current'
          WHEN fetched_date BETWEEN @previousStartDate AND @previousEndDate THEN 'previous'
          ELSE NULL
        END AS period,
        CASE
          WHEN first_delivery_ts IS NULL THEN 'Not delivered'
          WHEN first_call_ts IS NULL THEN 'Undialled'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) < 0 THEN 'Invalid timing'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 300 THEN '0–5m'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 900 THEN '5–15m'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 1800 THEN '15–30m'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 3600 THEN '30–60m'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 21600 THEN '1–6h'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 86400 THEN '6–24h'
          ELSE '24h+'
        END AS lead_age
      FROM lead_level
    ),
    dimensional AS (
      SELECT period, 'vendor' AS dimension, vendor AS segment,
        COUNT(*) AS fetched, COUNTIF(is_delivered) AS delivered, COUNTIF(is_dialled) AS dialled,
        COUNTIF(is_rpc) AS rpc, COUNTIF(is_sale) AS sales, COUNTIF(is_activated) AS activated, COUNTIF(is_dialled AND is_rpc IS NULL) AS unknown_rpc
      FROM periodized WHERE period IS NOT NULL GROUP BY period, vendor
      UNION ALL
      SELECT period, 'source', source,
        COUNT(*), COUNTIF(is_delivered), COUNTIF(is_dialled), COUNTIF(is_rpc), COUNTIF(is_sale), COUNTIF(is_activated), COUNTIF(is_dialled AND is_rpc IS NULL)
      FROM periodized WHERE period IS NOT NULL GROUP BY period, source
      UNION ALL
      SELECT period, 'grade', grade,
        COUNT(*), COUNTIF(is_delivered), COUNTIF(is_dialled), COUNTIF(is_rpc), COUNTIF(is_sale), COUNTIF(is_activated), COUNTIF(is_dialled AND is_rpc IS NULL)
      FROM periodized WHERE period IS NOT NULL GROUP BY period, grade
      UNION ALL
      SELECT period, 'leadAge', lead_age,
        COUNT(*), COUNTIF(is_delivered), COUNTIF(is_dialled), COUNTIF(is_rpc), COUNTIF(is_sale), COUNTIF(is_activated), COUNTIF(is_dialled AND is_rpc IS NULL)
      FROM periodized WHERE period IS NOT NULL GROUP BY period, lead_age
      UNION ALL
      SELECT period, 'overall', 'All',
        COUNT(*), COUNTIF(is_delivered), COUNTIF(is_dialled), COUNTIF(is_rpc), COUNTIF(is_sale), COUNTIF(is_activated), COUNTIF(is_dialled AND is_rpc IS NULL)
      FROM periodized WHERE period IS NOT NULL GROUP BY period
    )
    SELECT * FROM dimensional
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const numeric = (row: any, key: string) => Number(row?.[key] || 0);
  const parts = (row: any) => {
    switch (metric) {
      case 'fetchedLeads': return { numerator: numeric(row, 'fetched'), denominator: 1, kind: 'volume' as const };
      case 'deliveryRate': return { numerator: numeric(row, 'delivered'), denominator: numeric(row, 'fetched'), kind: 'rate' as const };
      case 'dialRate': return { numerator: numeric(row, 'dialled'), denominator: numeric(row, 'delivered'), kind: 'rate' as const };
      case 'contactRate': return { numerator: numeric(row, 'rpc'), denominator: numeric(row, 'dialled'), kind: 'rate' as const };
      case 'activationRate': return { numerator: numeric(row, 'activated'), denominator: numeric(row, 'sales'), kind: 'rate' as const };
      default: return { numerator: numeric(row, 'sales'), denominator: numeric(row, 'fetched'), kind: 'rate' as const };
    }
  };
  const value = (row: any) => {
    const p = parts(row);
    if (p.kind === 'volume') return p.numerator;
    if (metric === 'contactRate' && numeric(row, 'unknown_rpc') > 0) return null;
    return p.denominator > 0 ? (p.numerator / p.denominator) * 100 : null;
  };

  const currentOverall = rows.find((row: any) => row.dimension === 'overall' && row.period === 'current') || {};
  const previousOverall = rows.find((row: any) => row.dimension === 'overall' && row.period === 'previous') || {};
  const currentValue = value(currentOverall);
  const previousValue = value(previousOverall);
  const delta = currentValue === null || previousValue === null ? null : currentValue - previousValue;
  const currentParts = parts(currentOverall);
  const previousParts = parts(previousOverall);

  const labels: Record<string, string> = {
    fetchedLeads: 'Fetched leads',
    deliveryRate: 'Delivery rate',
    dialRate: 'Dial coverage',
    contactRate: 'RPC rate',
    leadToSaleRate: 'Sale / fetched',
    activationRate: 'Activation / sale',
  };
  const dimensionLabels: Record<string, string> = {
    vendor: 'Vendor',
    source: 'Source',
    grade: 'Grade',
    leadAge: 'First-dial age',
  };

  const dimensions = ['vendor', 'source', 'grade', 'leadAge'].map(dimension => {
    const current = new Map(rows.filter((row: any) => row.dimension === dimension && row.period === 'current').map((row: any) => [String(row.segment), row]));
    const previous = new Map(rows.filter((row: any) => row.dimension === dimension && row.period === 'previous').map((row: any) => [String(row.segment), row]));
    const names = Array.from(new Set([...current.keys(), ...previous.keys()]));

    const segments = names.map(name => {
      const currentRow: any = current.get(name) || {};
      const previousRow: any = previous.get(name) || {};
      const cp = parts(currentRow), pp = parts(previousRow);
      const currentSegmentValue = value(currentRow);
      const previousSegmentValue = value(previousRow);
      const contribution = delta === null ? null : cp.kind === 'volume'
        ? cp.numerator - pp.numerator
        : ((cp.numerator / currentParts.denominator) - (pp.numerator / previousParts.denominator)) * 100;
      return {
        name,
        currentValue: currentSegmentValue,
        previousValue: previousSegmentValue,
        currentNumerator: cp.numerator,
        currentDenominator: cp.kind === 'volume' ? cp.numerator : cp.denominator,
        previousNumerator: pp.numerator,
        previousDenominator: pp.kind === 'volume' ? pp.numerator : pp.denominator,
        contribution,
        shareOfDelta: delta !== null && delta !== 0 && contribution !== null ? (contribution / delta) * 100 : null,
      };
    }).sort((a, b) => Math.abs(b.contribution ?? 0) - Math.abs(a.contribution ?? 0));

    const residual = delta === null ? null : delta - segments.reduce((sum, segment) => sum + (segment.contribution ?? 0), 0);
    const reconciled = residual !== null && Math.abs(residual) < 1e-9;
    return {
      reconciliationStatus: reconciled ? 'RECONCILED' : 'UNAVAILABLE',
      residual,
      key: dimension,
      label: dimensionLabels[dimension],
      segments: reconciled ? segments : segments.map(segment => ({ ...segment, contribution: null, shareOfDelta: null })),
    };
  });

  // Driver summary uses a single exclusive dimension; dimensions describe the same population.
  const drivers = (dimensions[0]?.segments || []).filter(segment => segment.contribution !== null)
    .map(segment => ({ ...segment, dimension: dimensions[0].key, dimensionLabel: dimensions[0].label }));

  return {
    metric: {
      id: metric,
      label: labels[metric],
      kind: metric === 'fetchedLeads' ? 'volume' : 'rate',
      currentValue,
      previousValue,
      delta,
      deltaUnit: metric === 'fetchedLeads' ? 'leads' : 'pp',
    },
    currentWindow: { startDate: params.startDate, endDate: params.endDate },
    previousWindow: { startDate: previousStartDate, endDate: previousEndDate },
    dimensions,
    drivers,
    methodology: metric === 'fetchedLeads'
      ? 'Segment contributions are current lead volume minus matched-period lead volume. Each dimension is an alternative decomposition; never add dimensions together. All segments are retained.'
      : 'Segment contribution is current segment numerator / current total denominator minus previous segment numerator / previous total denominator. Segment contributions within each exclusive dimension reconcile, include population mix, and are descriptive rather than causal. All segments are retained; dimensions must not be added together. Missing denominators or incomplete RPC evidence withhold rate contributions.',
    validationStatus: 'NOT_VERIFIED',
  };
}
