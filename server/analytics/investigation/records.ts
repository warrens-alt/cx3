import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import { configuredSourceTable } from '../common/warehouse';
import { RequestError } from '../../bigquery/filters';
import { validTimestampSql } from '../../bigquery/integrity';
import { buildFilterClause } from '../common/scope';
import { operationalLeadCtes } from '../common/leadMetrics';
import { buildInvestigationPredicate } from './exceptionPredicates';
import { investigationScopeReason } from '../../../contracts/investigation';
import { METRIC_REGISTRY_VERSION } from '../../../contracts/metricRegistry';
import { normalizeOperationalParams } from '../../offernetScope';
import type { OffernetQueryParams } from '../common/types';

export function buildQualifiedInvestigationEvidence(params: OffernetQueryParams, leadId?: string) {
  const { params: normalizedParams, effectiveFilters, filterValues } = normalizeOperationalParams(params, '/offernet/raw-leads');
  const clientConfig = getClientConfig(normalizedParams.clientId);
  const limit = Math.min(Math.max(Number(normalizedParams.limit) || 50, 10), 200);
  const offset = Math.max(Number(normalizedParams.offset) || 0, 0);
  const { whereSql, queryParams } = buildFilterClause(normalizedParams);
  // Every drill predicate must inspect the same vendor population as the outer row.
  const vendorPredicates: string[] = [];
  if (queryParams.tenantVendors) vendorPredicates.push('LOWER(h.vendor) IN UNNEST(@tenantVendors)');
  if (queryParams.vendor) vendorPredicates.push('LOWER(h.vendor) = LOWER(@vendor)');

  let searchCondition = '';
  if (normalizedParams.search) {
    searchCondition = `AND (
      LOWER(l.lead_id) LIKE LOWER(@search)
      OR CAST(l.consumer_id AS STRING) LIKE @search
      OR LOWER(hlc.vendor) LIKE LOWER(@search)
      OR LOWER(l.offershop_source) LIKE LOWER(@search)
      OR LOWER(hlc.last_dialer_status) LIKE LOWER(@search)
    )`;
    queryParams.search = `%${normalizedParams.search}%`;
  }

  const predicate = buildInvestigationPredicate(normalizedParams, queryParams);
  const drillCondition = predicate ? `AND (${predicate})` : '';

  if (leadId !== undefined) queryParams.investigationLeadId = leadId;
  const qualifiedSql = `
    WITH scoped_leads AS (
      SELECT l.* REPLACE (
        ARRAY(SELECT AS STRUCT h.* FROM UNNEST(l.hlc_details) h
          WHERE ${vendorPredicates.length ? vendorPredicates.join(' AND ') : 'TRUE'}) AS hlc_details
      )
      FROM ${configuredSourceTable(normalizedParams.clientId, 'leads')} l
    ), ${operationalLeadCtes(normalizedParams, false, 'scoped_leads')},
    qualified_evidence AS (
    SELECT
      l.lead_id,
      l.consumer_id,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', m.fetched_ts) as fetched,
      COALESCE(l.offershop_source, 'Unknown') as source,
      COALESCE(l.offernet_medium, 'Unknown') as medium,
      COALESCE(l.offershop_grade, 'Unknown') as grade,
      COALESCE(l.offershop_color_vetting, 'Unvetted') as vetting,
      l.valid_lead,
      l.valid_idno,
      l.phone_valid,
      hlc.vendor,
      hlc.transaction_id,
      hlc.status,
      hlc.last_dialer_status,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', m.delivered_ts) as delivered_time,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', m.first_call_ts) as first_call_time,
      m.recorded_call_count as total_calls,
      m.is_dialled as dialled,
      m.is_rpc as contacted,
      m.is_sale as sale,
      m.is_activated as activated,
      m.revenue as revenue,
      m.fetched_ts as fetched_ts
    FROM scoped_leads l
    JOIN operational_leads m ON l.lead_id = m.lead_id
    LEFT JOIN UNNEST(l.hlc_details) hlc
    ${whereSql}
    ${searchCondition}
    ${drillCondition}
    ${leadId === undefined ? '' : 'AND l.lead_id = @investigationLeadId'}
    QUALIFY ROW_NUMBER() OVER (
      PARTITION BY l.lead_id
      ORDER BY ${validTimestampSql('hlc.delivered')} DESC NULLS LAST, hlc.transaction_id ASC NULLS LAST
    ) = 1
    )`;
  return { qualifiedSql, queryParams, normalizedParams, effectiveFilters, filterValues, clientConfig, limit, offset };
}

export async function getRawLeads(params: OffernetQueryParams) {
  const { qualifiedSql, queryParams, normalizedParams, effectiveFilters, filterValues, clientConfig, limit, offset } = buildQualifiedInvestigationEvidence(params);
  const client = getBigQueryClient(clientConfig.bigQueryProject);
  const query = `${qualifiedSql},
    evidence_stats AS (
      SELECT COUNT(*) AS total_count FROM qualified_evidence
    ),
    evidence_page AS (
      SELECT * FROM qualified_evidence
      ORDER BY fetched_ts DESC NULLS LAST, lead_id ASC
      LIMIT ${limit}
      OFFSET ${offset}
    )
    SELECT
      total_count,
      ARRAY(
        SELECT AS STRUCT * EXCEPT(fetched_ts) FROM evidence_page
        ORDER BY fetched_ts DESC NULLS LAST, lead_id ASC
      ) AS evidence_rows
    FROM evidence_stats
  `;

  const [rows] = await client.query({ query, params: queryParams });

  // 1. Strict validation of aggregate row response envelope
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new RequestError('Upstream warehouse returned invalid evidence query response shape', 502);
  }

  const aggregateRow = rows[0];
  if (!aggregateRow || typeof aggregateRow !== 'object' || Array.isArray(aggregateRow)) {
    throw new RequestError('Upstream warehouse returned non-object evidence aggregate row', 502);
  }
  if (!('total_count' in aggregateRow) || !('evidence_rows' in aggregateRow)) {
    throw new RequestError('Upstream warehouse evidence response missing required total_count or evidence_rows', 502);
  }

  // 2. Strict validation of total_count
  let totalCount: number;
  const rawTotal = aggregateRow.total_count;
  if (rawTotal === null || rawTotal === undefined) {
    throw new RequestError('Upstream warehouse returned missing or null evidence total_count', 502);
  } else if (typeof rawTotal === 'number') {
    if (!Number.isInteger(rawTotal) || rawTotal < 0 || !Number.isSafeInteger(rawTotal)) {
      throw new RequestError(`Upstream warehouse returned invalid total_count value: ${rawTotal}`, 502);
    }
    totalCount = rawTotal;
  } else if (typeof rawTotal === 'string') {
    const trimmed = rawTotal.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new RequestError(`Upstream warehouse returned non-integer total_count string: "${rawTotal}"`, 502);
    }
    const num = Number(trimmed);
    if (!Number.isSafeInteger(num)) {
      throw new RequestError(`Upstream warehouse total_count exceeds safe precision: "${rawTotal}"`, 502);
    }
    totalCount = num;
  } else if (typeof rawTotal === 'bigint') {
    if (rawTotal < 0n || rawTotal > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new RequestError(`Upstream warehouse returned out-of-range bigint total_count: ${rawTotal}`, 502);
    }
    totalCount = Number(rawTotal);
  } else if (typeof rawTotal === 'object' && rawTotal !== null && 'value' in rawTotal) {
    const strVal = String(rawTotal.value).trim();
    if (!/^\d+$/.test(strVal)) {
      throw new RequestError(`Upstream warehouse returned invalid total_count wrapper: ${strVal}`, 502);
    }
    const num = Number(strVal);
    if (!Number.isSafeInteger(num)) {
      throw new RequestError(`Upstream warehouse total_count wrapper exceeds safe precision: ${strVal}`, 502);
    }
    totalCount = num;
  } else {
    throw new RequestError('Upstream warehouse returned unsupported total_count type', 502);
  }

  // 3. Strict validation of evidence_rows array and unique lead IDs
  if (!Array.isArray(aggregateRow.evidence_rows)) {
    throw new RequestError('Upstream warehouse returned non-array evidence_rows', 502);
  }
  const pageRows: any[] = aggregateRow.evidence_rows;
  const seenLeadIds = new Set<string>();
  for (const row of pageRows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new RequestError('Upstream warehouse returned non-object evidence row', 502);
    }
    if (row.lead_id === undefined || row.lead_id === null || String(row.lead_id).trim() === '') {
      throw new RequestError('Upstream warehouse evidence row missing lead_id', 502);
    }
    const leadIdStr = String(row.lead_id);
    if (seenLeadIds.has(leadIdStr)) {
      throw new RequestError(`Upstream warehouse returned duplicate lead_id "${leadIdStr}" in evidence page`, 502);
    }
    seenLeadIds.add(leadIdStr);
  }

  // 4. Validate page/count invariants against effective limit and offset
  if (pageRows.length > limit) {
    throw new RequestError(`Evidence page row count (${pageRows.length}) exceeds requested limit (${limit})`, 502);
  }
  if (totalCount === 0 && pageRows.length > 0) {
    throw new RequestError(`Evidence page contains ${pageRows.length} rows but total_count is 0`, 502);
  }
  if (offset >= totalCount && totalCount > 0 && pageRows.length > 0) {
    throw new RequestError(`Evidence page contains ${pageRows.length} rows at offset ${offset} beyond total_count ${totalCount}`, 502);
  }
  const expectedPageRows = Math.min(limit, Math.max(0, totalCount - offset));
  if (pageRows.length !== expectedPageRows) {
    throw new RequestError(
      `Evidence page contains ${pageRows.length} rows, expected complete page of ${expectedPageRows} rows for total_count ${totalCount}, limit ${limit}, offset ${offset}`,
      502
    );
  }

  const investigationReason = investigationScopeReason(normalizedParams);
  const cleanRows = pageRows.map(({ fetched_ts, full_evidence_total, ...r }: any) => ({ ...r, ...(investigationReason ? { investigationReason } : {}) }));
  const metricId = normalizedParams.drill === 'funnel-stage' && normalizedParams.drillValue === 'delivered'
    ? 'delivered_leads'
    : normalizedParams.drill === 'funnel-stage' && normalizedParams.drillValue === 'fetched'
    ? 'fetched_leads'
    : normalizedParams.drill || 'lead_records';

  return {
    rows: cleanRows,
    totalCount,
    limit,
    offset,
    drill: normalizedParams.drill || null,
    drillValue: normalizedParams.drillValue || null,
    search: normalizedParams.search || null,
    segmentVendor: normalizedParams.segmentVendor || null,
    segmentSource: normalizedParams.segmentSource || null,
    segmentGrade: normalizedParams.segmentGrade || null,
    segmentLeadAge: normalizedParams.segmentLeadAge || null,
    clientId: normalizedParams.clientId,
    startDate: normalizedParams.startDate || null,
    endDate: normalizedParams.endDate || null,
    vendor: filterValues.vendor || null,
    source: filterValues.source || null,
    medium: filterValues.medium || null,
    grade: filterValues.grade || null,
    filters: effectiveFilters,
    timezone: clientConfig?.timezone || 'Africa/Johannesburg',
    dateBasis: 'intake_cohort',
    definitionVersion: METRIC_REGISTRY_VERSION,
    metricId,
    countingGrain: 'lead',
    validationStatus: 'NOT_VERIFIED',
    sourceCutoff: null,
    generatedAt: new Date().toISOString(),
  };
}
