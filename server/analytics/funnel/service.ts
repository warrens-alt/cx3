import type { OffernetQueryParams } from '../common/types';
import { formatDuration } from '../common/types';
import { getLifecycleDiagnostics } from '../common/lifecycleDiagnostics';

// 2. FUNNEL INTELLIGENCE
export async function getFunnelIntelligence(params: OffernetQueryParams) {
  const lifecycle = await getLifecycleDiagnostics(params);
  const segments = (dimension: string) => lifecycle.segments[dimension].map(row => ({ [dimension]: row.key, leads: row.fetched, delivered: row.delivered, dialled: row.dialled, contacted: row.rpc, sales: row.sales, activations: row.activations }));
  return {
    lifecycle,
    velocity: {
      fetchToDelivery: formatDuration(lifecycle.velocity.captureToDeliverySec),
      deliveryToFirstDial: formatDuration(lifecycle.velocity.deliveryToDialSec),
      firstDialToContact: 'Unavailable',
      contactToSale: formatDuration(lifecycle.velocity.dialToSaleSec),
      saleToActivation: formatDuration(lifecycle.velocity.saleToActivationSec)
    },
    byVendor: segments('vendor'),
    bySource: segments('source'),
    byGrade: segments('grade')
  };
}
