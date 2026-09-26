import { getBigQueryClient } from '../client';
import { getClientConfig } from '../config';
import { getBaseSemanticLayer } from '../views';
import { METRIC_DEFINITIONS } from '../metrics';
import type { BaseQueryParams } from './types';
import { buildWhereClause } from './types';
import { percentOrNull } from '../../analytics/common/metrics';

export async function getFunnelStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_leads');
  
  const query = `
    ${getBaseSemanticLayer(client)}
    SELECT
      COUNT(DISTINCT lead_id) as captured,
      COUNTIF(valid_lead = true) as valid,
      ${METRIC_DEFINITIONS.delivered_leads.numerator} as delivered,
      ${METRIC_DEFINITIONS.called_leads.numerator} as called,
      ${METRIC_DEFINITIONS.rpcs.numerator} as rpc,
      ${METRIC_DEFINITIONS.sales.numerator} as sale,
      COUNTIF(has_billable_sale = true) as billable_sale,
      ${METRIC_DEFINITIONS.activations.numerator} as activated,
      SUM(IFNULL(total_revenue, 0)) as revenue
    FROM vw_leads
    ${sql}
  `;
  
  const [rows] = await bq.query({ query, params: queryParams });
  const stats = rows[0] || {};
  
  const captured = Number(stats.captured) || 0;
  const valid = Number(stats.valid) || 0;
  const delivered = Number(stats.delivered) || 0;
  const called = Number(stats.called) || 0;
  const rpc = Number(stats.rpc) || 0;
  const sale = Number(stats.sale) || 0;
  const billableSale = Number(stats.billable_sale) || 0;
  const activated = Number(stats.activated) || 0;

  return [
    { stage: 'Fetched Leads', count: captured, rate: 100, itemNo: 22, costMetric: 'CPL.Fetched' },
    { stage: 'Standardised Leads', count: valid, rate: percentOrNull(valid, captured, 1), itemNo: 23, costMetric: 'CPL.Standardised' },
    { stage: 'Delivered Leads', count: delivered, rate: percentOrNull(delivered, valid, 1), itemNo: 33, costMetric: 'CPL.Delivered' },
    { stage: 'Dialed Leads', count: called, rate: percentOrNull(called, delivered, 1), itemNo: 37, costMetric: 'CPL.Dialed' },
    { stage: 'Right Party Contact', count: rpc, rate: percentOrNull(rpc, called, 1), itemNo: 39, costMetric: 'CP.RPC' },
    { stage: 'Sales', count: sale, rate: percentOrNull(sale, rpc, 1), itemNo: 40, costMetric: 'CP.Sale' },
    { stage: 'Delivered Sales', count: billableSale, rate: percentOrNull(billableSale, sale, 1), itemNo: 45, costMetric: 'CPS.Delivered' },
    { stage: 'Activated Sales', count: activated, rate: percentOrNull(activated, billableSale, 1), itemNo: 46, costMetric: 'CPS.Activated' }
  ];
}
