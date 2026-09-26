import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import { RequestError } from '../../bigquery/filters';
import type { OffernetQueryParams } from '../common/types';
import { configuredSourceTable } from '../common/warehouse';
import { buildFilterClause } from '../common/scope';

// Deterministic root-cause decomposition for matched periods.
// Dimensions are reduced to one value per lead so each dimension reconciles to the selected metric.
export async function getRootCauseAnalysis(params: OffernetQueryParams) {
  const allowedMetrics = new Set(['fetchedLeads', 'deliveryRate', 'dialRate', 'contactRate', 'leadToSaleRate', 'activationRate']);
  const metric = params.metric || 'leadToSaleRate';
  if (!allowedMetrics.has(metric)) throw new RequestError('Unsupported root-cause metric', 422);
  if (!params.startDate || !params.endDate) throw new RequestError('Root-cause analysis requires an explicit startDate and endDate', 422);

  const startMs = Date.parse(params.startDate + 'T00:00:00Z');
  const endMs = Date.parse(params.endDate + 'T00:00:00Z');
  const days = Math.floor((endMs - startMs) / 86400000) + 1;
  if (!Number.isFinite(days) || days <= 0 || days > 366) throw new RequestError('Root-cause date range must be between 1 and 366 days', 422);

  const previousEnd = new Date(startMs - 86400000);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86400000);
  const previousStartDate = previousStart.toISOString().slice(0, 10);
  const previousEndDate = previousEnd.toISOString().slice(0, 10);

  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const baseScope = buildFilterClause({ ...params, startDate: undefined, endDate: undefined, metric: undefined });
  const queryParams = {
    ...baseScope.queryParams,
    currentStartDate: params.startDate,
    currentEndDate: params.endDate,
    previousStartDate,
    previousEndDate,
  };

  const query = `
    WITH scoped_rows AS (
      SELECT
        l.lead_id,
        DATE(SAFE_CAST(l.fetched AS TIMESTAMP)) AS fetched_date,
        COALESCE(l.offershop_source, 'Unknown') AS source,
        COALESCE(l.offershop_grade, 'Unknown') AS grade,
        hlc.vendor,
        SAFE_CAST(hlc.delivered AS TIMESTAMP) AS delivered_ts,
        SAFE_CAST(hlc.first_call_date AS TIMESTAMP) AS first_call_ts,
        SAFE_CAST(hlc.rpc AS INT64) > 0 AS is_rpc,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' AS is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' AS is_activated
      FROM ${configuredSourceTable(params.clientId, 'leads')} l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${baseScope.whereSql}
    ),
    lead_level AS (
      SELECT
        lead_id,
        fetched_date,
        ANY_VALUE(source) AS source,
        ANY_VALUE(grade) AS grade,
        COALESCE(
          ARRAY_AGG(vendor IGNORE NULLS ORDER BY IF(delivered_ts IS NULL, 1, 0), delivered_ts ASC LIMIT 1)[SAFE_OFFSET(0)],
          'Unknown'
        ) AS vendor,
        COUNTIF(delivered_ts IS NOT NULL) > 0 AS is_delivered,
        COUNTIF(first_call_ts IS NOT NULL) > 0 AS is_dialled,
        COUNTIF(is_rpc) > 0 AS is_rpc,
        COUNTIF(is_sale) > 0 AS is_sale,
        COUNTIF(is_activated) > 0 AS is_activated,
        MIN(delivered_ts) AS first_delivery_ts,
        MIN(first_call_ts) AS first_call_ts
      FROM scoped_rows
      WHERE fetched_date BETWEEN @previousStartDate AND @currentEndDate
      GROUP BY lead_id, fetched_date
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
        COUNTIF(is_rpc) AS rpc, COUNTIF(is_sale) AS sales, COUNTIF(is_activated) AS activated
      FROM periodized WHERE period IS NOT NULL GROUP BY period, vendor
      UNION ALL
      SELECT period, 'source', source,
        COUNT(*), COUNTIF(is_delivered), COUNTIF(is_dialled), COUNTIF(is_rpc), COUNTIF(is_sale), COUNTIF(is_activated)
      FROM periodized WHERE period IS NOT NULL GROUP BY period, source
      UNION ALL
      SELECT period, 'grade', grade,
        COUNT(*), COUNTIF(is_delivered), COUNTIF(is_dialled), COUNTIF(is_rpc), COUNTIF(is_sale), COUNTIF(is_activated)
      FROM periodized WHERE period IS NOT NULL GROUP BY period, grade
      UNION ALL
      SELECT period, 'leadAge', lead_age,
        COUNT(*), COUNTIF(is_delivered), COUNTIF(is_dialled), COUNTIF(is_rpc), COUNTIF(is_sale), COUNTIF(is_activated)
      FROM periodized WHERE period IS NOT NULL GROUP BY period, lead_age
      UNION ALL
      SELECT period, 'overall', 'All',
        COUNT(*), COUNTIF(is_delivered), COUNTIF(is_dialled), COUNTIF(is_rpc), COUNTIF(is_sale), COUNTIF(is_activated)
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
    return p.denominator > 0 ? Number(((p.numerator / p.denominator) * 100).toFixed(2)) : 0;
  };

  const currentOverall = rows.find((row: any) => row.dimension === 'overall' && row.period === 'current') || {};
  const previousOverall = rows.find((row: any) => row.dimension === 'overall' && row.period === 'previous') || {};
  const currentValue = value(currentOverall);
  const previousValue = value(previousOverall);
  const delta = Number((currentValue - previousValue).toFixed(2));
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
      const contribution = cp.kind === 'volume'
        ? cp.numerator - pp.numerator
        : Number(((
            (currentParts.denominator > 0 ? cp.numerator / currentParts.denominator : 0)
            - (previousParts.denominator > 0 ? pp.numerator / previousParts.denominator : 0)
          ) * 100).toFixed(2));
      return {
        name,
        currentValue: currentSegmentValue,
        previousValue: previousSegmentValue,
        currentNumerator: cp.numerator,
        currentDenominator: cp.kind === 'volume' ? cp.numerator : cp.denominator,
        previousNumerator: pp.numerator,
        previousDenominator: pp.kind === 'volume' ? pp.numerator : pp.denominator,
        contribution,
        shareOfDelta: delta !== 0 ? Number(((contribution / delta) * 100).toFixed(1)) : null,
      };
    }).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    return {
      key: dimension,
      label: dimensionLabels[dimension],
      segments: segments.slice(0, 12),
    };
  });

  const drivers = dimensions
    .flatMap(dimension => dimension.segments.slice(0, 4).map(segment => ({ ...segment, dimension: dimension.key, dimensionLabel: dimension.label })))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 8);

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
      ? 'Segment contributions are current lead volume minus matched-period lead volume.'
      : 'Segment contribution is the change in that segment numerator divided by the full-period denominator, so contributions within each exclusive dimension reconcile to the overall percentage-point change.',
    validationStatus: 'NOT_VERIFIED',
  };
}
