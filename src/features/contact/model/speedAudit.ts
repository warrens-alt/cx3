import type { SpeedToLeadData } from '../../../lib/offernetClient';
import type { InspectorContent } from '../../../shared/evidence/InspectorHost';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import { suppliedCount } from '../../evidenceWorkspace/metricVisualAudit';

export function speedCohortAudit(row: SpeedToLeadData['cohorts'][number], measure: 'leads' | 'rpc' | 'sales' | 'activations', scope: InspectorContent['scope'], methodology?: string): InspectorContent {
  const label = measure === 'leads' ? 'Lead population' : measure === 'rpc' ? 'RPC / dialled' : measure === 'sales' ? 'Sales / leads' : 'Activations / sales';
  const numerator = suppliedCount(measure === 'leads' ? row.leads : measure === 'rpc' ? row.contacted : measure === 'sales' ? row.sales : row.activations);
  const denominator = measure === 'rpc' ? null : suppliedCount(measure === 'sales' ? row.leads : row.sales);
  const value = measure === 'leads' ? formatTableNumber(row.leads) : formatPercent(measure === 'rpc' ? row.contactRate : measure === 'sales' ? row.saleRate : row.activationRate, measure === 'sales' ? 2 : 1);
  const numeratorLabel = measure === 'leads' ? 'Leads in returned timing group' : measure === 'rpc' ? 'RPC leads' : measure === 'sales' ? 'Recorded sales' : 'Recorded activations';
  const denominatorLabel = measure === 'rpc' ? 'Qualified dialled leads (not supplied)' : measure === 'sales' ? 'Leads in returned timing group' : 'Recorded sales';
  return {
    type: 'custom', title: `${row.cohort} · ${label}`, value, scope,
    definition: { meaning: methodology || 'Returned outcome associations for this first-dial timing group.', grain: 'Leads in the returned timing group', dateBasis: 'Lead capture cohort', calculation: measure === 'leads' ? 'Returned lead count.' : `${numeratorLabel} / ${denominatorLabel} × 100.`, nullMeaning: 'An unavailable count or rate is not zero.', limitations: ['Timing groups describe association with outcomes; they do not establish causation.'] },
    anatomy: { kind: measure === 'leads' ? 'count' : measure === 'activations' ? 'independent_ratio' : 'ratio', label, value, numerator: { key: 'numerator', label: numeratorLabel, value: numerator }, ...(measure === 'leads' ? {} : { denominator: { key: 'denominator', label: denominatorLabel, value: denominator }, scaling: 'percentage_value' }), detail: measure === 'rpc' ? 'The response supplies this RPC rate and RPC count, but its qualified dialled denominator is not returned. The rate is displayed as supplied; no denominator is reconstructed.' : measure === 'activations' ? 'Recorded activation and sale populations are counted independently.' : undefined },
    numeratorCount: numerator, numeratorLabel,
    ...(measure === 'leads' ? {} : { denominatorCount: denominator, denominatorLabel }),
    detailLimitation: 'No exact timing-cohort record drill is supplied by the current Lead Explorer route.',
  };
}
