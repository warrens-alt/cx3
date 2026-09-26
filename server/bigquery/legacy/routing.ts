import { getBigQueryClient } from '../client';
import { getClientConfig } from '../config';
import { getBaseSemanticLayer } from '../views';
import type { BaseQueryParams } from './types';
import { buildWhereClause } from './types';

export async function getOutcomesStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_leads');
  const { sql: vendorTxSql, queryParams: vendorTxParams } = buildWhereClause(params, 'vw_lead_vendor_transactions');
  
  const summaryQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      COUNTIF(has_activation = true) as total_activations,
      SUM(total_revenue) as total_revenue
    FROM vw_leads
    ${sql}
  `;

  const timeseriesQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      CAST(DATE(capture_timestamp) AS STRING) as date,
      COUNTIF(has_activation = true) as activations,
      SUM(total_revenue) as revenue
    FROM vw_leads
    ${sql}
    GROUP BY date
    ORDER BY date ASC
  `;

  const sourcesQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      source,
      COUNTIF(has_activation = true) as activations,
      SUM(total_revenue) as total_revenue
    FROM vw_leads
    ${sql}
    GROUP BY source
    ORDER BY total_revenue DESC
    LIMIT 20
  `;
  
  const vendorsQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      COALESCE(vendor, 'Unknown') as vendor,
      COUNTIF(activation = true) as activations,
      SUM(IFNULL(revenue, 0)) as total_revenue
    FROM vw_lead_vendor_transactions
    ${vendorTxSql ? vendorTxSql + ' AND' : 'WHERE'} vendor IS NOT NULL
    GROUP BY vendor
    ORDER BY total_revenue DESC
    LIMIT 20
  `;

  const [
    [summaryRows],
    [timeseriesRows],
    [sourcesRows],
    [vendorsRows]
  ] = await Promise.all([
    bq.query({ query: summaryQuery, params: queryParams }),
    bq.query({ query: timeseriesQuery, params: queryParams }),
    bq.query({ query: sourcesQuery, params: queryParams }),
    bq.query({ query: vendorsQuery, params: vendorTxParams }).catch(() => [[]])
  ]);

  return {
    summary: summaryRows[0] || { total_activations: 0, total_revenue: 0 },
    timeseries: timeseriesRows || [],
    sources: sourcesRows || [],
    vendors: vendorsRows || []
  };
}

export async function getRoutingIntelligenceStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql: leadsSql, queryParams: leadsParams } = buildWhereClause(params, 'vw_leads');
  const { sql: rorSql, queryParams: rorParams } = buildWhereClause(params, 'vw_ror_events');

  const overviewQuery = `
    ${getBaseSemanticLayer(client)},
    lead_summary AS (
      SELECT
        COUNT(DISTINCT lead_id) as total_leads,
        COUNT(DISTINCT CASE WHEN routing_depth > 0 THEN lead_id END) as total_routed_leads,
        COUNT(DISTINCT CASE WHEN routing_depth = 1 THEN lead_id END) as single_route_leads,
        COUNT(DISTINCT CASE WHEN routing_depth > 1 THEN lead_id END) as multi_route_leads,
        COUNT(DISTINCT CASE WHEN routing_depth > 0 AND total_transactions > 0 THEN lead_id END) as handoff_leads,
        COUNT(DISTINCT CASE WHEN routing_depth > 0 AND total_transactions = 0 THEN lead_id END) as missing_handoff_leads,
        COUNT(DISTINCT CASE WHEN routing_depth > 0 AND has_sale THEN lead_id END) as routed_sale_leads,
        COUNT(DISTINCT CASE WHEN routing_depth > 0 AND has_billable_sale THEN lead_id END) as routed_billable_sale_leads,
        SUM(CASE WHEN routing_depth > 0 THEN total_revenue ELSE 0 END) as routed_revenue,
        SUM(total_revenue) as total_revenue,
        AVG(CASE WHEN routing_depth > 0 THEN routing_depth END) as avg_routing_depth
      FROM vw_leads
      ${leadsSql}
    )
    SELECT
      total_leads,
      total_routed_leads,
      SAFE_DIVIDE(total_routed_leads, total_leads) * 100 as routed_lead_share_pct,
      single_route_leads,
      multi_route_leads,
      handoff_leads,
      missing_handoff_leads,
      SAFE_DIVIDE(handoff_leads, total_routed_leads) * 100 as handoff_rate_pct,
      SAFE_DIVIDE(missing_handoff_leads, total_routed_leads) * 100 as missing_handoff_rate_pct,
      routed_sale_leads,
      routed_billable_sale_leads,
      SAFE_DIVIDE(routed_sale_leads, total_routed_leads) * 100 as routed_sale_rate_pct,
      SAFE_DIVIDE(routed_billable_sale_leads, total_routed_leads) * 100 as routed_billable_sale_rate_pct,
      routed_revenue,
      total_revenue,
      SAFE_DIVIDE(routed_revenue, total_routed_leads) as rev_per_routed_lead,
      avg_routing_depth
    FROM lead_summary
  `;

  const depthQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      CASE 
        WHEN routing_depth = 0 THEN '0 Routes (Unrouted)'
        WHEN routing_depth = 1 THEN '1 Partner Route'
        WHEN routing_depth = 2 THEN '2 Partner Routes'
        WHEN routing_depth = 3 THEN '3 Partner Routes'
        WHEN routing_depth = 4 THEN '4 Partner Routes'
        ELSE '5+ Partner Routes'
      END as depth_bucket,
      routing_depth,
      COUNT(DISTINCT lead_id) as leads,
      SAFE_DIVIDE(COUNT(DISTINCT lead_id), (SELECT COUNT(DISTINCT lead_id) FROM vw_leads ${leadsSql})) * 100 as lead_share_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN total_transactions > 0 THEN 1 END), COUNT(*)) * 100 as handoff_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_delivery THEN 1 END), COUNT(*)) * 100 as delivery_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_call THEN 1 END), COUNT(*)) * 100 as call_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_rpc THEN 1 END), COUNT(*)) * 100 as rpc_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_sale THEN 1 END), COUNT(*)) * 100 as sale_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_billable_sale THEN 1 END), COUNT(*)) * 100 as billable_sale_rate_pct,
      SUM(total_revenue) as total_revenue,
      SAFE_DIVIDE(SUM(total_revenue), COUNT(*)) as rev_per_lead
    FROM vw_leads
    ${leadsSql}
    GROUP BY depth_bucket, routing_depth
    ORDER BY routing_depth ASC
  `;

  const partnerQuery = `
    ${getBaseSemanticLayer(client)},
    filtered_ror AS (
      SELECT * FROM vw_ror_events
      ${rorSql}
    ),
    partner_handoff AS (
      SELECT 
        r.partner,
        COUNT(DISTINCT r.lead_id) as routed_leads,
        COUNT(DISTINCT CASE WHEN r.route_sequence = 1 THEN r.lead_id END) as first_route_leads,
        COUNT(DISTINCT CASE WHEN r.route_sequence > 1 THEN r.lead_id END) as cascade_route_leads,
        AVG(r.time_from_previous_route_sec) as avg_cascade_delay_sec,
        COUNT(DISTINCT CASE WHEN t.transaction_id IS NOT NULL THEN r.lead_id END) as handoff_leads,
        COUNT(DISTINCT CASE WHEN t.delivery_timestamp IS NOT NULL THEN r.lead_id END) as delivered_leads,
        COUNT(DISTINCT CASE WHEN t.sale THEN r.lead_id END) as sale_leads,
        COUNT(DISTINCT CASE WHEN t.is_billable_sale THEN r.lead_id END) as billable_sale_leads,
        SUM(t.revenue) as total_revenue,
        AVG(TIMESTAMP_DIFF(t.delivery_timestamp, r.ror_timestamp, SECOND)) as avg_handoff_latency_sec
      FROM filtered_ror r
      LEFT JOIN vw_lead_vendor_transactions t ON r.lead_id = t.lead_id
      GROUP BY r.partner
    )
    SELECT
      partner,
      routed_leads,
      first_route_leads,
      cascade_route_leads,
      avg_cascade_delay_sec,
      handoff_leads,
      (routed_leads - handoff_leads) as missing_handoff_leads,
      SAFE_DIVIDE(handoff_leads, routed_leads) * 100 as handoff_rate_pct,
      SAFE_DIVIDE(delivered_leads, routed_leads) * 100 as delivery_rate_pct,
      SAFE_DIVIDE(sale_leads, routed_leads) * 100 as sale_rate_pct,
      SAFE_DIVIDE(billable_sale_leads, routed_leads) * 100 as billable_sale_rate_pct,
      total_revenue,
      SAFE_DIVIDE(total_revenue, routed_leads) as rev_per_lead,
      avg_handoff_latency_sec
    FROM partner_handoff
    ORDER BY routed_leads DESC
  `;

  const pathsQuery = `
    ${getBaseSemanticLayer(client)},
    lead_paths AS (
      SELECT 
        lead_id,
        STRING_AGG(partner, ' -> ' ORDER BY route_sequence ASC) as route_path,
        COUNT(*) as partner_count
      FROM vw_ror_events
      ${rorSql}
      GROUP BY lead_id
    )
    SELECT 
      p.route_path,
      p.partner_count,
      COUNT(DISTINCT l.lead_id) as leads,
      SAFE_DIVIDE(COUNT(DISTINCT l.lead_id), (SELECT COUNT(DISTINCT lead_id) FROM lead_paths)) * 100 as share_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN l.has_delivery THEN 1 END), COUNT(*)) * 100 as deliv_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN l.has_call THEN 1 END), COUNT(*)) * 100 as call_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN l.has_sale THEN 1 END), COUNT(*)) * 100 as sale_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN l.has_billable_sale THEN 1 END), COUNT(*)) * 100 as billable_sale_pct,
      SUM(l.total_revenue) as total_revenue,
      SAFE_DIVIDE(SUM(l.total_revenue), COUNT(*)) as rev_per_lead
    FROM lead_paths p
    JOIN vw_leads l ON p.lead_id = l.lead_id
    GROUP BY p.route_path, p.partner_count
    ORDER BY leads DESC
    LIMIT 12
  `;

  const missingSampleQuery = `
    ${getBaseSemanticLayer(client)},
    filtered_ror_missing AS (
      SELECT * FROM vw_ror_events
      ${rorSql}
    )
    SELECT 
      r.lead_id,
      r.consumer_id,
      r.partner,
      r.ror_timestamp,
      r.route_sequence,
      l.source,
      l.medium,
      l.capture_timestamp
    FROM filtered_ror_missing r
    JOIN vw_leads l ON r.lead_id = l.lead_id
    WHERE l.total_transactions = 0
    ORDER BY r.capture_timestamp DESC
    LIMIT 20
  `;

  const [
    [overviewRows],
    [depthRows],
    [partnerRows],
    [pathsRows],
    [missingSampleRows]
  ] = await Promise.all([
    bq.query({ query: overviewQuery, params: leadsParams }),
    bq.query({ query: depthQuery, params: leadsParams }),
    bq.query({ query: partnerQuery, params: rorParams }),
    bq.query({ query: pathsQuery, params: rorParams }),
    bq.query({ query: missingSampleQuery, params: rorParams })
  ]);

  return {
    overview: overviewRows[0] || {},
    depthBreakdown: depthRows || [],
    partnerHandoff: partnerRows || [],
    topRoutePaths: pathsRows || [],
    missingSample: missingSampleRows || []
  };
}

export async function getRevettingStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_leads');

  const comparisonQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      is_revetted,
      COUNT(DISTINCT lead_id) as leads,
      SAFE_DIVIDE(COUNT(DISTINCT lead_id), (SELECT COUNT(DISTINCT lead_id) FROM vw_leads ${sql})) * 100 as lead_share_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_delivery THEN 1 END), COUNT(*)) * 100 as delivery_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_call THEN 1 END), COUNT(*)) * 100 as call_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_rpc THEN 1 END), COUNT(*)) * 100 as rpc_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_sale THEN 1 END), COUNT(*)) * 100 as sale_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_billable_sale THEN 1 END), COUNT(*)) * 100 as billable_sale_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_activation THEN 1 END), COUNT(*)) * 100 as activation_rate_pct,
      SUM(total_revenue) as total_revenue,
      SAFE_DIVIDE(SUM(total_revenue), COUNT(*)) as rev_per_lead
    FROM vw_leads
    ${sql}
    GROUP BY is_revetted
    ORDER BY is_revetted ASC
  `;

  const vettingColorQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      vetting,
      is_revetted,
      COUNT(DISTINCT lead_id) as leads,
      SAFE_DIVIDE(COUNT(CASE WHEN has_sale THEN 1 END), COUNT(*)) * 100 as sale_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_billable_sale THEN 1 END), COUNT(*)) * 100 as billable_sale_rate_pct,
      SUM(total_revenue) as total_revenue,
      SAFE_DIVIDE(SUM(total_revenue), COUNT(*)) as rev_per_lead
    FROM vw_leads
    ${sql}
    GROUP BY vetting, is_revetted
    ORDER BY leads DESC
  `;

  const [
    [comparisonRows],
    [vettingColorRows]
  ] = await Promise.all([
    bq.query({ query: comparisonQuery, params: queryParams }),
    bq.query({ query: vettingColorQuery, params: queryParams })
  ]);

  return {
    comparison: comparisonRows || [],
    vettingColorBreakdown: vettingColorRows || []
  };
}

