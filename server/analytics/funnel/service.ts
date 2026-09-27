import type { OffernetQueryParams } from '../common/types';
import { formatDuration } from '../common/types';
import { getLifecycleDiagnostics } from '../common/lifecycleDiagnostics';

export function buildFunnelResult(data: any) {
  const v = data?.velocity || {};
  const fetchSec = v.avg_fetch_delivery_sec !== undefined ? v.avg_fetch_delivery_sec : v.captureToDeliverySec;
  const delivSec = v.avg_deliv_dial_sec !== undefined ? v.avg_deliv_dial_sec : v.deliveryToDialSec;
  const dialToSaleSec = v.avg_dial_to_sale_sec !== undefined ? v.avg_dial_to_sale_sec : v.dialToSaleSec;
  const saleToActSec = v.avg_sale_to_act_sec !== undefined ? v.avg_sale_to_act_sec : v.saleToActivationSec;

  return {
    ...(data?.lifecycle ? { lifecycle: data.lifecycle } : {}),
    velocity: {
      fetchToDelivery: formatDuration(fetchSec),
      deliveryToFirstDial: formatDuration(delivSec),
      firstDialToContact: 'Unavailable',
      contactToSale: formatDuration(dialToSaleSec),
      saleToActivation: formatDuration(saleToActSec)
    },
    byVendor: data?.byVendor || data?.vendors || [],
    bySource: data?.bySource || data?.sources || [],
    byGrade: data?.byGrade || data?.grades || []
  };
}

// 2. FUNNEL INTELLIGENCE
export async function getFunnelIntelligence(params: OffernetQueryParams) {
  const lifecycle = await getLifecycleDiagnostics(params);
  const segments = (dimension: string) => (lifecycle.segments[dimension] || []).map(row => ({ [dimension]: row.key, leads: row.fetched, delivered: row.delivered, dialled: row.dialled, contacted: row.rpc, sales: row.sales, activations: row.activations }));
  return buildFunnelResult({
    lifecycle,
    velocity: lifecycle.velocity,
    byVendor: segments('vendor'),
    bySource: segments('source'),
    byGrade: segments('grade')
  });
}
