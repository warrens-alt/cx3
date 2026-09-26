import { getBigQueryClient } from '../client';
import { getClientConfig } from '../config';
import { getBaseSemanticLayer } from '../views';
import type { BaseQueryParams } from './types';
import { buildWhereClause } from './types';

export async function getLeads(params: BaseQueryParams & { limit?: number; offset?: number }) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_leads');
  
  const query = `
    ${getBaseSemanticLayer(client)}
    SELECT
      lead_id as id,
      capture_timestamp as captured,
      source,
      medium as campaign,
      CAST(total_calls AS STRING) as calls,
      CASE
        WHEN has_activation = true THEN 'Activated'
        WHEN has_sale = true THEN 'Sale'
        WHEN has_rpc = true THEN 'Contacted'
        WHEN has_call = true THEN 'Called'
        WHEN has_delivery = true THEN 'Delivered'
        ELSE 'Captured'
      END as status,
      IFNULL(CAST(total_revenue AS STRING), '$0') as value,
      'Valid' as quality
    FROM vw_leads
    ${sql}
    ORDER BY capture_timestamp DESC
    LIMIT ${params.limit || 100} OFFSET ${params.offset || 0}
  `;
  const [rows] = await bq.query({ query, params: queryParams });
  return rows;
}

export async function getFilterOptions(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  
  const dateParams: any = {};
  let dateClauses = [];
  if (params.startDate) {
    dateClauses.push(`capture_date >= @startDate`);
    dateParams.startDate = params.startDate;
  }
  if (params.endDate) {
    dateClauses.push(`capture_date <= @endDate`);
    dateParams.endDate = params.endDate;
  }
  const where = dateClauses.length > 0 ? 'WHERE ' + dateClauses.join(' AND ') : '';

  const query = `
    ${getBaseSemanticLayer(client)}
    SELECT DISTINCT 
      source,
      medium,
      grade,
      vetting
    FROM vw_lead_vendor_transactions
    ${where}
    LIMIT 1000
  `;
  
  const vendorQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT 
      vendor as value,
      vendor as label,
      COUNT(DISTINCT lead_id) as uniqueLeads,
      COUNT(1) as transactions
    FROM vw_lead_vendor_transactions
    ${where}
    GROUP BY vendor
    ORDER BY uniqueLeads DESC
    LIMIT 60
  `;
  
  try {
    const [[rows], [vendorRows]] = await Promise.all([
      bq.query({ query, params: dateParams }).catch(err => {
        console.warn('Filter options metadata query error:', err.message);
        return [[]];
      }),
      bq.query({ query: vendorQuery, params: dateParams }).catch(err => {
        console.warn('Vendor options query error:', err.message);
        return [[]];
      })
    ]);
    
    const sources = new Set<string>();
    const mediums = new Set<string>();
    const grades = new Set<string>();
    const vettings = new Set<string>();
    
    (rows || []).forEach((r: any) => {
      if (r.source) sources.add(r.source);
      if (r.medium) mediums.add(r.medium);
      if (r.grade) grades.add(r.grade);
      if (r.vetting) vettings.add(r.vetting);
    });

    return {
      sources: Array.from(sources).sort(),
      mediums: Array.from(mediums).sort(),
      vendors: (vendorRows || []).filter((v: any) => v && v.value),
      grades: Array.from(grades).sort(),
      vettings: Array.from(vettings).sort(),
    };
  } catch (err: any) {
    console.error('Failed in getFilterOptions:', err.message);
    return {
      sources: [],
      mediums: [],
      vendors: [],
      grades: [],
      vettings: [],
    };
  }
}

export async function getLeadTimeline(params: BaseQueryParams & { leadId: string }) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  
  const query = `
    ${getBaseSemanticLayer(client)}
    SELECT
      capture_timestamp,
      delivery_timestamp,
      first_call_timestamp,
      sale_timestamp,
      activation_timestamp,
      vendor,
      transaction_id,
      rpc,
      sale,
      activation,
      total_calls,
      latest_dialer_status
    FROM vw_lead_vendor_transactions
    WHERE lead_id = @leadId
    ORDER BY capture_timestamp ASC, delivery_timestamp ASC
  `;

  const [rows] = await bq.query({ query, params: { leadId: params.leadId } });
  return rows;
}

export async function getConsumerReentryStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql: consumersSql, queryParams: consumersParams } = buildWhereClause(params, 'vw_consumers');
  const { sql: leadsSql, queryParams: leadsParams } = buildWhereClause(params, 'vw_leads');

  const overviewQuery = `
    ${getBaseSemanticLayer(client)},
    consumer_summary AS (
      SELECT
        COUNT(DISTINCT consumer_id) as total_consumers,
        SUM(lead_count) as total_leads,
        COUNT(DISTINCT CASE WHEN lead_count = 1 THEN consumer_id END) as single_lead_consumers,
        COUNT(DISTINCT CASE WHEN lead_count >= 2 THEN consumer_id END) as repeat_consumers,
        COUNT(DISTINCT CASE WHEN lead_count = 1 AND has_sale THEN consumer_id END) as single_consumers_with_sale,
        COUNT(DISTINCT CASE WHEN lead_count >= 2 AND has_sale THEN consumer_id END) as repeat_consumers_with_sale,
        COUNT(DISTINCT CASE WHEN lead_count = 1 AND has_billable_sale THEN consumer_id END) as single_consumers_with_billable_sale,
        COUNT(DISTINCT CASE WHEN lead_count >= 2 AND has_billable_sale THEN consumer_id END) as repeat_consumers_with_billable_sale,
        SUM(CASE WHEN lead_count = 1 THEN total_revenue ELSE 0 END) as single_consumer_revenue,
        SUM(CASE WHEN lead_count >= 2 THEN total_revenue ELSE 0 END) as repeat_consumer_revenue,
        SUM(total_revenue) as total_revenue
      FROM vw_consumers
      ${consumersSql}
    )
    SELECT
      total_consumers,
      total_leads,
      SAFE_DIVIDE(total_leads, total_consumers) as avg_leads_per_consumer,
      single_lead_consumers,
      repeat_consumers,
      SAFE_DIVIDE(repeat_consumers, total_consumers) * 100 as repeat_consumer_share_pct,
      single_consumers_with_sale,
      repeat_consumers_with_sale,
      SAFE_DIVIDE(single_consumers_with_sale, single_lead_consumers) * 100 as single_sale_rate_pct,
      SAFE_DIVIDE(repeat_consumers_with_sale, repeat_consumers) * 100 as repeat_sale_rate_pct,
      single_consumers_with_billable_sale,
      repeat_consumers_with_billable_sale,
      SAFE_DIVIDE(single_consumers_with_billable_sale, single_lead_consumers) * 100 as single_billable_sale_rate_pct,
      SAFE_DIVIDE(repeat_consumers_with_billable_sale, repeat_consumers) * 100 as repeat_billable_sale_rate_pct,
      single_consumer_revenue,
      repeat_consumer_revenue,
      total_revenue,
      SAFE_DIVIDE(single_consumer_revenue, single_lead_consumers) as rev_per_single_consumer,
      SAFE_DIVIDE(repeat_consumer_revenue, repeat_consumers) as rev_per_repeat_consumer
    FROM consumer_summary
  `;

  const tierQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT 
      CASE 
        WHEN lead_count = 1 THEN '1 Lead'
        WHEN lead_count = 2 THEN '2 Leads'
        WHEN lead_count = 3 THEN '3 Leads'
        WHEN lead_count BETWEEN 4 AND 5 THEN '4-5 Leads'
        ELSE '6+ Leads'
      END as lead_tier,
      COUNT(DISTINCT consumer_id) as consumer_count,
      SAFE_DIVIDE(COUNT(DISTINCT consumer_id), (SELECT COUNT(DISTINCT consumer_id) FROM vw_consumers ${consumersSql})) * 100 as consumer_share_pct,
      SUM(lead_count) as total_leads,
      COUNT(DISTINCT CASE WHEN has_sale THEN consumer_id END) as consumers_with_sale,
      SAFE_DIVIDE(COUNT(DISTINCT CASE WHEN has_sale THEN consumer_id END), COUNT(DISTINCT consumer_id)) * 100 as sale_rate_pct,
      COUNT(DISTINCT CASE WHEN has_billable_sale THEN consumer_id END) as consumers_with_billable_sale,
      SAFE_DIVIDE(COUNT(DISTINCT CASE WHEN has_billable_sale THEN consumer_id END), COUNT(DISTINCT consumer_id)) * 100 as billable_sale_rate_pct,
      SUM(total_revenue) as total_revenue,
      SAFE_DIVIDE(SUM(total_revenue), COUNT(DISTINCT consumer_id)) as rev_per_consumer,
      SAFE_DIVIDE(SUM(total_revenue), SUM(lead_count)) as rev_per_lead
    FROM vw_consumers
    ${consumersSql}
    GROUP BY lead_tier
    ORDER BY total_leads DESC
  `;

  const sequenceQuery = `
    ${getBaseSemanticLayer(client)},
    consumer_lead_orders AS (
      SELECT 
        lead_id,
        consumer_id,
        capture_timestamp,
        ROW_NUMBER() OVER(PARTITION BY consumer_id ORDER BY capture_timestamp ASC) as lead_sequence,
        has_delivery,
        has_call,
        has_rpc,
        has_sale,
        has_billable_sale,
        total_revenue
      FROM vw_leads
      WHERE consumer_id > 0
      ${leadsSql ? `AND ${leadsSql.replace('WHERE', '')}` : ''}
    )
    SELECT 
      CASE 
        WHEN lead_sequence = 1 THEN '1st Entry'
        WHEN lead_sequence = 2 THEN '2nd Entry'
        WHEN lead_sequence = 3 THEN '3rd Entry'
        ELSE '4th+ Entry'
      END as entry_stage,
      lead_sequence,
      COUNT(*) as leads,
      SAFE_DIVIDE(COUNT(CASE WHEN has_delivery THEN 1 END), COUNT(*)) * 100 as delivery_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_call THEN 1 END), COUNT(*)) * 100 as call_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_rpc THEN 1 END), COUNT(*)) * 100 as rpc_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_sale THEN 1 END), COUNT(*)) * 100 as sale_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_billable_sale THEN 1 END), COUNT(*)) * 100 as billable_sale_rate_pct,
      SUM(total_revenue) as total_revenue,
      SAFE_DIVIDE(SUM(total_revenue), COUNT(*)) as rev_per_lead
    FROM consumer_lead_orders
    GROUP BY entry_stage, lead_sequence
    ORDER BY lead_sequence ASC
    LIMIT 4
  `;

  const sampleQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      consumer_id,
      first_lead_date,
      latest_lead_date,
      lead_count,
      unique_source_count,
      unique_vendor_count,
      transaction_count,
      has_sale,
      has_billable_sale,
      has_activation,
      total_revenue
    FROM vw_consumers
    WHERE lead_count >= 2
    ${consumersSql ? `AND ${consumersSql.replace('WHERE', '')}` : ''}
    ORDER BY total_revenue DESC, lead_count DESC
    LIMIT 25
  `;

  const [
    [overviewRows],
    [tierRows],
    [sequenceRows],
    [sampleRows]
  ] = await Promise.all([
    bq.query({ query: overviewQuery, params: consumersParams }),
    bq.query({ query: tierQuery, params: consumersParams }),
    bq.query({ query: sequenceQuery, params: leadsParams }),
    bq.query({ query: sampleQuery, params: consumersParams })
  ]);

  return {
    overview: overviewRows[0] || {},
    tiers: tierRows || [],
    sequenceEconomics: sequenceRows || [],
    repeatConsumersSample: sampleRows || []
  };
}
