import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { formatDuration } from '../common/types';
import { buildFilterClause } from '../common/scope';
import { operationalLeadCtes, metricPercent } from '../common/leadMetrics';
import { getLifecycleDiagnostics } from '../common/lifecycleDiagnostics';

// 5. VENDOR & LEAD QUALITY
export async function getVendorQualityAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const { queryParams } = buildFilterClause(params);

  const query = `
    WITH ${operationalLeadCtes(params, true)},
    base AS (
      SELECT * EXCEPT(source, grade),
        COALESCE(NULLIF(source, ''), 'Unknown') AS source,
        COALESCE(NULLIF(grade, ''), 'Unrecorded') AS grade, recorded_call_count AS total_calls,
        TIMESTAMP_DIFF(first_call_ts, delivered_ts, SECOND) AS deliv_to_dial_sec
      FROM operational_leads
    ),
    vendor_matrix AS (
      SELECT
        vendor,
        COUNT(DISTINCT lead_id) AS leads,
        COUNT(DISTINCT CASE WHEN is_delivered THEN lead_id END) AS delivered,
        COUNT(DISTINCT CASE WHEN is_dialled THEN lead_id END) AS dialled,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activations,
        COUNT(DISTINCT CASE WHEN is_invalid THEN lead_id END) AS invalid_leads,
        CASE WHEN COUNTIF(total_calls IS NULL) > 0 THEN NULL ELSE SUM(total_calls) END AS total_calls,
        ROUND(SUM(revenue), 2) AS revenue,
        APPROX_QUANTILES(CASE WHEN deliv_to_dial_sec >= 0 THEN deliv_to_dial_sec END, 100)[OFFSET(50)] AS med_first_dial_sec
      FROM base
      GROUP BY vendor
      ORDER BY leads DESC
      LIMIT 15
    ),
    vendor_grades AS (
      SELECT vendor, grade, COUNT(*) AS leads FROM base GROUP BY vendor, grade
    ),
    source_matrix AS (
      SELECT
        source,
        COUNT(DISTINCT lead_id) AS leads,
        COUNT(DISTINCT CASE WHEN is_delivered THEN lead_id END) AS delivered,
        COUNT(DISTINCT CASE WHEN is_dialled THEN lead_id END) AS dialled,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activations,
        COUNT(DISTINCT CASE WHEN is_invalid THEN lead_id END) AS invalid_leads
      FROM base
      GROUP BY source
      ORDER BY leads DESC
      LIMIT 15
    ),
    grade_matrix AS (
      SELECT
        grade,
        COUNT(DISTINCT lead_id) AS leads,
        COUNT(DISTINCT CASE WHEN is_dialled THEN lead_id END) AS dialled,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activations
      FROM base
      GROUP BY grade
      ORDER BY leads DESC
      LIMIT 10
    ),
    vetting_matrix AS (
      SELECT
        CASE
          WHEN vetting LIKE 'Orange%' THEN 'Orange'
          WHEN vetting LIKE 'Charcoal%' THEN 'Charcoal'
          WHEN vetting LIKE 'Blue%' THEN 'Blue'
          WHEN vetting LIKE 'Green%' THEN 'Green'
          ELSE 'Other / Unvetted'
        END AS vetting_color,
        COUNT(DISTINCT lead_id) AS leads,
        COUNT(DISTINCT CASE WHEN is_dialled THEN lead_id END) AS dialled,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activations
      FROM base
      GROUP BY 1
      ORDER BY leads DESC
    )
    SELECT
      ARRAY(SELECT AS STRUCT * FROM vendor_matrix) AS vendors,
      ARRAY(SELECT AS STRUCT * FROM vendor_grades ORDER BY vendor, leads DESC) AS vendor_grades,
      ARRAY(SELECT AS STRUCT * FROM source_matrix) AS sources,
      ARRAY(SELECT AS STRUCT * FROM grade_matrix) AS grades,
      ARRAY(SELECT AS STRUCT * FROM vetting_matrix) AS vetting
  `;

  const [[rows], lifecycle] = await Promise.all([client.query({ query, params: queryParams }), getLifecycleDiagnostics(params)]);
  const data = rows[0] || { vendors: [], sources: [], grades: [], vetting: [] };

  const vendors = (data.vendors || []).map((v: any) => {
    const leads = Number(v.leads || 0), delivered = Number(v.delivered || 0), dialled = Number(v.dialled || 0);
    const contacted = Number(v.contacted || 0), sales = Number(v.sales || 0), activations = Number(v.activations || 0);
    const invalid = Number(v.invalid_leads || 0), totalCalls = v.total_calls == null ? null : Number(v.total_calls), revenue = v.revenue == null ? null : Number(v.revenue);
    const medianFirstDialSec = v.med_first_dial_sec === null || v.med_first_dial_sec === undefined ? null : Number(v.med_first_dial_sec);
    return {
      vendor: v.vendor,
      leads, delivered, dialled, contacted, sales, activations,
      leadToSaleRate: metricPercent(sales, leads, 2),
      deliveryRate: metricPercent(delivered, leads, 1),
      dialRate: metricPercent(dialled, delivered, 1),
      contactRate: metricPercent(contacted, dialled, 1),
      saleRate: metricPercent(sales, contacted, 2),
      activationRate: metricPercent(activations, sales, 1),
      medianFirstDial: formatDuration(medianFirstDialSec),
      medianFirstDialSec,
      callsPerLead: totalCalls !== null && leads > 0 ? Number((totalCalls / leads).toFixed(1)) : null,
      invalidRate: metricPercent(invalid, leads, 1),
      revenue,
      directCost: null,
      deliveryCost: null,
      contribution: null,
      marginPct: null
    };
  });

  const sources = (data.sources || []).map((s: any) => {
    const leads = Number(s.leads || 0), delivered = Number(s.delivered || 0), dialled = Number(s.dialled || 0);
    const contacted = Number(s.contacted || 0), sales = Number(s.sales || 0), activations = Number(s.activations || 0), invalid = Number(s.invalid_leads || 0);
    return {
      source: s.source,
      leads,
      delivered,
      dialled,
      contacted,
      sales,
      activations,
      deliveryRate: metricPercent(delivered, leads, 1),
      dialRate: metricPercent(dialled, delivered, 1),
      contactRate: metricPercent(contacted, dialled, 1),
      leadToSaleRate: metricPercent(sales, leads, 2),
      activationRate: metricPercent(activations, sales, 1),
      invalidRate: metricPercent(invalid, leads, 1),
    };
  });

  const outcomeRates = (row: any, labelKey: 'grade' | 'vetting_color') => {
    const leads = Number(row.leads || 0), contacted = Number(row.contacted || 0), sales = Number(row.sales || 0), activations = Number(row.activations || 0);
    return {
      [labelKey]: row[labelKey],
      leads,
      contacted,
      sales,
      activations,
      contactRate: metricPercent(contacted, Number(row.dialled || 0), 1),
      leadToSaleRate: metricPercent(sales, leads, 2),
      activationRate: metricPercent(activations, sales, 1),
    };
  };

  return {
    lifecycle,
    vendors,
    vendorGrades: data.vendor_grades || [],
    qualityEvidence: 'Vendor activity includes one row per lead/vendor and can overlap across vendors. Grade and invalid-lead flags come from the lead ledger; duplicate lead identity needs an approved identity contract and is unavailable.',
    sources,
    grades: (data.grades || []).map((row: any) => outcomeRates(row, 'grade')),
    vetting: (data.vetting || []).map((row: any) => outcomeRates(row, 'vetting_color')),
    commercialStatus: 'UNAVAILABLE',
    commercialReason: 'Vendor contribution and margin are withheld until approved cost contracts are configured.'
  };
}
