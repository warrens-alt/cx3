import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { formatDuration } from '../common/types';
import { configuredSourceTable } from '../common/warehouse';
import { buildFilterClause } from '../common/scope';

// 5. VENDOR & LEAD QUALITY
export async function getVendorQualityAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const { whereSql, queryParams } = buildFilterClause(params);

  const query = `
    WITH base AS (
      SELECT
        l.lead_id,
        COALESCE(hlc.vendor, 'Unknown') AS vendor,
        COALESCE(l.offershop_source, 'Unknown') AS source,
        COALESCE(l.offershop_grade, 'Standard') AS grade,
        COALESCE(l.offershop_color_vetting, 'Unvetted') AS vetting,
        l.valid_idno,
        l.phone_valid,
        hlc.delivered IS NOT NULL AND hlc.delivered NOT LIKE '1900%' AND hlc.delivered NOT LIKE '1970%' AS is_delivered,
        hlc.first_call_date IS NOT NULL AND hlc.first_call_date NOT LIKE '1900%' AND hlc.first_call_date NOT LIKE '1970%' AS is_dialled,
        SAFE_CAST(hlc.rpc AS INT64) > 0 AS is_rpc,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' AS is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' AS is_activated,
        COALESCE(hlc.total_calls, 0) AS total_calls,
        COALESCE(hlc.revenue_generated, 0) AS revenue,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.first_call_date AS TIMESTAMP), SAFE_CAST(hlc.delivered AS TIMESTAMP), SECOND) AS deliv_to_dial_sec
      FROM ${configuredSourceTable(params.clientId, 'leads')} l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
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
        COUNT(DISTINCT CASE WHEN valid_idno = '0' OR valid_idno = 'false' OR phone_valid = '0' OR phone_valid = 'false' THEN lead_id END) AS invalid_leads,
        SUM(total_calls) AS total_calls,
        ROUND(SUM(revenue), 2) AS revenue,
        APPROX_QUANTILES(CASE WHEN deliv_to_dial_sec >= 0 THEN deliv_to_dial_sec END, 100)[OFFSET(50)] AS med_first_dial_sec
      FROM base
      GROUP BY vendor
      ORDER BY leads DESC
      LIMIT 15
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
        COUNT(DISTINCT CASE WHEN valid_idno = '0' OR valid_idno = 'false' OR phone_valid = '0' OR phone_valid = 'false' THEN lead_id END) AS invalid_leads
      FROM base
      GROUP BY source
      ORDER BY leads DESC
      LIMIT 15
    ),
    grade_matrix AS (
      SELECT
        grade,
        COUNT(DISTINCT lead_id) AS leads,
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
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activations
      FROM base
      GROUP BY 1
      ORDER BY leads DESC
    )
    SELECT
      ARRAY(SELECT AS STRUCT * FROM vendor_matrix) AS vendors,
      ARRAY(SELECT AS STRUCT * FROM source_matrix) AS sources,
      ARRAY(SELECT AS STRUCT * FROM grade_matrix) AS grades,
      ARRAY(SELECT AS STRUCT * FROM vetting_matrix) AS vetting
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const data = rows[0] || { vendors: [], sources: [], grades: [], vetting: [] };

  const vendors = (data.vendors || []).map((v: any) => {
    const leads = Number(v.leads || 0), delivered = Number(v.delivered || 0), dialled = Number(v.dialled || 0);
    const contacted = Number(v.contacted || 0), sales = Number(v.sales || 0), activations = Number(v.activations || 0);
    const invalid = Number(v.invalid_leads || 0), totalCalls = Number(v.total_calls || 0), revenue = Number(v.revenue || 0);
    const medianFirstDialSec = v.med_first_dial_sec === null || v.med_first_dial_sec === undefined ? null : Number(v.med_first_dial_sec);
    return {
      vendor: v.vendor,
      leads,
      deliveryRate: leads > 0 ? Number(((delivered / leads) * 100).toFixed(1)) : 0,
      dialRate: delivered > 0 ? Number(((dialled / delivered) * 100).toFixed(1)) : 0,
      contactRate: dialled > 0 ? Number(((contacted / dialled) * 100).toFixed(1)) : 0,
      saleRate: contacted > 0 ? Number(((sales / contacted) * 100).toFixed(2)) : 0,
      activationRate: sales > 0 ? Number(((activations / sales) * 100).toFixed(1)) : 0,
      medianFirstDial: formatDuration(medianFirstDialSec),
      medianFirstDialSec,
      callsPerLead: leads > 0 ? Number((totalCalls / leads).toFixed(1)) : 0,
      invalidRate: leads > 0 ? Number(((invalid / leads) * 100).toFixed(1)) : 0,
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
      deliveryRate: leads > 0 ? Number(((delivered / leads) * 100).toFixed(1)) : 0,
      dialRate: delivered > 0 ? Number(((dialled / delivered) * 100).toFixed(1)) : 0,
      contactRate: dialled > 0 ? Number(((contacted / dialled) * 100).toFixed(1)) : 0,
      leadToSaleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
      activationRate: sales > 0 ? Number(((activations / sales) * 100).toFixed(1)) : 0,
      invalidRate: leads > 0 ? Number(((invalid / leads) * 100).toFixed(1)) : 0,
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
      contactRate: leads > 0 ? Number(((contacted / leads) * 100).toFixed(1)) : 0,
      leadToSaleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
      activationRate: sales > 0 ? Number(((activations / sales) * 100).toFixed(1)) : 0,
    };
  };

  return {
    vendors,
    sources,
    grades: (data.grades || []).map((row: any) => outcomeRates(row, 'grade')),
    vetting: (data.vetting || []).map((row: any) => outcomeRates(row, 'vetting_color')),
    commercialStatus: 'UNAVAILABLE',
    commercialReason: 'Vendor contribution and margin are withheld until approved cost contracts are configured.'
  };
}
