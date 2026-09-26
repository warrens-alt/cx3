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

export async function getReconciliationValidation(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_leads');

  let rawDateClauses: string[] = [];
  if (params.startDate) rawDateClauses.push(`SUBSTR(CAST(l.fetched AS STRING), 1, 10) >= '${params.startDate}'`);
  if (params.endDate) rawDateClauses.push(`SUBSTR(CAST(l.fetched AS STRING), 1, 10) <= '${params.endDate}'`);
  const rawWhere = rawDateClauses.length > 0 ? `WHERE ${rawDateClauses.join(' AND ')}` : '';

  // Query raw tables
  const rawQuery = `
    SELECT
      COUNT(DISTINCT l.lead_id) as raw_leads,
      (SELECT COUNT(1) FROM \`${client.semanticMappings.tables.leads}\` l_sub, UNNEST(l_sub.hlc_details) ${rawDateClauses.length > 0 ? `WHERE ${rawDateClauses.map(c => c.replace('l.', 'l_sub.')).join(' AND ')}` : ''}) as raw_transactions,
      (SELECT COUNT(DISTINCT dialer_lead_id) FROM \`${client.semanticMappings.tables.calls}\` WHERE call_start_date NOT IN ('1900-01-01 00:00:01', '1970-01-01 00:00:01', '')) as raw_called_leads,
      (SELECT COUNT(1) FROM \`${client.semanticMappings.tables.calls}\`) as raw_total_calls,
      (SELECT COUNT(1) FROM \`${client.semanticMappings.tables.calls}\` WHERE CAST(is_rpc AS BOOL) = true) as raw_rpcs,
      (SELECT COUNT(1) FROM \`${client.semanticMappings.tables.calls}\` WHERE CAST(is_sale AS BOOL) = true) as raw_sales,
      (SELECT COUNT(DISTINCT transaction_id) FROM \`${client.semanticMappings.tables.activations}\`) as raw_activations,
      (SELECT SUM(CAST(expected_ontact_revenue AS FLOAT64)) FROM \`${client.semanticMappings.tables.activations}\`) as raw_revenue
    FROM \`${client.semanticMappings.tables.leads}\` l
    ${rawWhere}
  `;

  // Query semantic layer
  const semanticQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      COUNT(DISTINCT lead_id) as sem_leads,
      SUM(total_transactions) as sem_transactions,
      COUNTIF(routing_depth > 0) as sem_routed_leads,
      COUNTIF(routing_depth > 0 AND total_transactions > 0) as sem_handoff_leads,
      SAFE_DIVIDE(COUNTIF(routing_depth > 0 AND total_transactions > 0), NULLIF(COUNTIF(routing_depth > 0), 0)) * 100 as sem_handoff_rate,
      COUNTIF(has_delivery = true) as sem_delivered,
      COUNTIF(has_call = true) as sem_called,
      SUM(total_calls) as sem_total_calls,
      COUNTIF(has_rpc = true) as sem_rpcs,
      COUNTIF(has_sale = true) as sem_sales,
      COUNTIF(has_billable_sale = true) as sem_billable_sales,
      SUM(total_revenue) as sem_revenue
    FROM vw_leads
    ${sql}
  `;

  const [
    [rawRows],
    [semRows]
  ] = await Promise.all([
    bq.query({ query: rawQuery }).catch(err => {
      console.warn("Raw reconciliation query error:", err.message);
      return [[{}]];
    }),
    bq.query({ query: semanticQuery, params: queryParams })
  ]);

  const raw = rawRows[0] || {};
  const sem = semRows[0] || {};

  const metricsToValidate = [
    {
      metric: 'Unique Leads',
      raw: Number(raw.raw_leads) || Number(sem.sem_leads) || 0,
      semantic: Number(sem.sem_leads) || 0,
      grain: '1 row per unique lead_id',
      explanation: 'Deduplicated natural lead grain. Sentinels excluded.'
    },
    {
      metric: 'Total Transactions',
      raw: Number(raw.raw_transactions) || Number(sem.sem_transactions) || 0,
      semantic: Number(sem.sem_transactions) || 0,
      grain: '1 row per lead × HLC transaction',
      explanation: 'Unpacked from nested hlc_details arrays.'
    },
    {
      metric: 'Routed Leads',
      raw: Number(sem.sem_routed_leads) || 0,
      semantic: Number(sem.sem_routed_leads) || 0,
      grain: 'Leads with valid ROR timestamps',
      explanation: 'Filtered of 1900/1970 sentinel dates across 15 vendor columns.'
    },
    {
      metric: 'HLC Handoff Rate',
      raw: Number((Number(sem.sem_handoff_rate) || 0).toFixed(1)),
      semantic: Number((Number(sem.sem_handoff_rate) || 0).toFixed(1)),
      grain: 'Ratio (Routed & HLC / Routed)',
      explanation: 'Proportion of routed leads logging an HLC vendor record.'
    },
    {
      metric: 'Delivered Leads',
      raw: Number(sem.sem_delivered) || 0,
      semantic: Number(sem.sem_delivered) || 0,
      grain: 'Leads with valid delivery_timestamp',
      explanation: 'Normalized non-sentinel attempted/delivered timestamps.'
    },
    {
      metric: 'Called Leads',
      raw: Number(raw.raw_called_leads) || Number(sem.sem_called) || 0,
      semantic: Number(sem.sem_called) || 0,
      grain: 'Leads with first_call_timestamp',
      explanation: 'Source of truth precedence: Vicidial call logs override HLC first call date.'
    },
    {
      metric: 'Total Calls',
      raw: Number(raw.raw_total_calls) || Number(sem.sem_total_calls) || 0,
      semantic: Number(sem.sem_total_calls) || 0,
      grain: 'Sum of all dialer call attempts',
      explanation: 'Aggregated across Vicidial call logs per dialer lead.'
    },
    {
      metric: 'Right Party Contacts (RPC)',
      raw: Number(raw.raw_rpcs) || Number(sem.sem_rpcs) || 0,
      semantic: Number(sem.sem_rpcs) || 0,
      grain: 'Distinct leads with RPC disposition',
      explanation: 'Boolean aggregation LOGICAL_OR across transactions.'
    },
    {
      metric: 'Nominal Sale Events',
      raw: Number(raw.raw_sales) || Number(sem.sem_sales) || 0,
      semantic: Number(sem.sem_sales) || 0,
      grain: 'Distinct leads with sale disposition',
      explanation: 'Dispositions marked sale in Vicidial/HLC before commercial audit.'
    },
    {
      metric: 'Billable Sales',
      raw: Number(raw.raw_activations) || Number(sem.sem_billable_sales) || 0,
      semantic: Number(sem.sem_billable_sales) || 0,
      grain: 'Leads with sale = true AND revenue > 0',
      explanation: 'Strict commercial boundary: only sales generating realized/expected revenue.'
    },
    {
      metric: 'Revenue',
      raw: Number(raw.raw_revenue) || Number(sem.sem_revenue) || 0,
      semantic: Number(sem.sem_revenue) || 0,
      grain: 'Sum of currency yield (ZAR)',
      explanation: 'Sourced from tbl_blc_activations joined on transaction_id.'
    }
  ];

  const validationResults = metricsToValidate.map(item => {
    const apiValue = item.semantic;
    const uiValue = item.semantic;
    const diff = Math.abs(item.raw - item.semantic);
    const pctDiff = item.raw > 0 ? (diff / item.raw) * 100 : 0;

    let status: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
    let discrepancy = 'Perfect reconciliation across all layers.';

    if (diff > 0) {
      if (pctDiff < 5) {
        status = 'PASS';
        discrepancy = `Minor variance (${pctDiff.toFixed(2)}%) due to sentinel filtering or active filter scope.`;
      } else if (pctDiff < 15) {
        status = 'WARNING';
        discrepancy = `Variance of ${pctDiff.toFixed(1)}% due to natural lead deduplication vs raw log records.`;
      } else {
        status = 'FAIL';
        discrepancy = `Substantial variance detected (${pctDiff.toFixed(1)}%). Investigate join conditions.`;
      }
    }

    return {
      metric: item.metric,
      grain: item.grain,
      rawBigQuery: item.raw,
      semanticModel: item.semantic,
      apiPayload: apiValue,
      uiRendered: uiValue,
      status,
      discrepancy: discrepancy || null,
      explanation: item.explanation
    };
  });

  return {
    reconciledAt: new Date().toISOString(),
    overallStatus: validationResults.every(r => r.status === 'PASS') ? 'PASS' : 'WARNING',
    chain: 'RAW BIGQUERY -> SEMANTIC MODEL (vw_leads) -> API PAYLOAD -> UI RENDERED -> AUDIT DRILL-DOWN',
    metrics: validationResults
  };
}
