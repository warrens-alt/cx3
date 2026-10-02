import type { CommercialData } from '../../lib/offernetClient';
import type { CommercialAuditNode } from '../../features/commercial/commercialAudit';

export interface CommercialBridgeStage {
  key: string;
  label: string;
  value: number | null;
  state: 'observed' | 'unavailable';
  scope: string;
  detail: string;
  auditNode: CommercialAuditNode;
}

/** Presentation projection only: never substitute cohort totals for matched evidence. */
export function commercialOutcomeStages(data: CommercialData): CommercialBridgeStage[] {
  const economics = data.economics;
  const stages = [
    ['fetched', 'Captured leads', economics?.fetched, 'fetched'],
    ['qualified', 'Qualified leads', null, 'qualified'],
    ['delivered', 'Delivered leads', economics?.delivered, 'delivered'],
    ['dialled', 'Dialled leads', economics?.dialled, 'dialled'],
    ['rpc', 'RPC', economics?.rpc, 'rpc'],
    ['sales', 'Recorded sales', economics?.sales, 'sales'],
    ['activations', 'Recorded activations', economics?.activations, 'activations'],
  ] as const;
  return stages.map(([key, label, supplied, auditNode]) => {
    const value = economics?.status === 'AVAILABLE' && typeof supplied === 'number' && Number.isFinite(supplied) ? supplied : null;
    return {
      key, label, value, state: value === null ? 'unavailable' : 'observed', auditNode,
      scope: key === 'qualified' ? 'Qualification evidence not supplied' : 'Approved matched attribution keys',
      detail: key === 'qualified'
        ? 'This commercial contract does not return a qualified population. Captured or delivered counts are not a substitute.'
        : value === null ? economics?.reason || 'No approved matched population returned.'
          : 'Independent recorded population. Adjacent values do not establish a nested conversion or a financial settlement.',
    };
  });
}
