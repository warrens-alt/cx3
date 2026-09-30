import type { InspectorContent } from '../../shared/evidence/InspectorHost';
import type { AgentPerformanceData, CampaignData, VendorQualityData } from '../../lib/offernetClient';
import { formatPercent, formatTableNumber } from '../../lib/formatters';

/** Copy only metadata present in this response; availability/ranking states are not validation. */
export function suppliedProvenance(value: unknown): NonNullable<InspectorContent['provenance']> {
  const data = value && typeof value === 'object' ? value as Record<string, any> : {};
  const metadata = data.metadata && typeof data.metadata === 'object' ? data.metadata : {};
  const evidence: Record<string, string> = {};
  for (const key of ['validationStatus', 'dateBasis', 'countingGrain', 'generatedAt', 'evaluatedAt', 'queryJobId', 'reportVersion', 'metricVersion', 'observationCutoff', 'timezone', 'modelVersion', 'sourceCompleteness']) {
    const supplied = data[key] ?? metadata[key];
    if (typeof supplied === 'string' && supplied.trim()) evidence[key] = supplied;
  }
  return evidence;
}

export const agentMeasures = {
  calls: { label: 'Recorded calls', meaning: 'Recorded dialler call events for this returned agent/vendor group.', calculation: 'Count of recorded call events.' },
  contactRate: { label: 'RPC / calls', meaning: 'Recorded RPC calls divided by recorded calls for this agent/vendor group.', calculation: 'RPC calls / calls × 100.' },
  saleRate: { label: 'Sold RPC / RPC', meaning: 'Call rows marked both RPC and sale divided by recorded RPC calls.', calculation: 'Sold RPC calls / RPC calls × 100.' },
} as const;
export function agentAudit(row: AgentPerformanceData['agents'][number], metric: keyof typeof agentMeasures, scope: InspectorContent['scope'], data: unknown): InspectorContent {
  const measure = agentMeasures[metric];
  const value = metric === 'calls' ? row.totalCalls : metric === 'contactRate' ? row.contactRate : row.saleRate;
  return { type: 'segment', title: `${row.agentId} · ${measure.label}`, subtitle: row.vendor || 'Vendor unavailable', value: metric === 'calls' ? formatTableNumber(value) : formatPercent(value, 2), scope,
    definition: { meaning: measure.meaning, grain: 'Call event, grouped by agent and vendor', dateBasis: 'Call start date', nullMeaning: 'Unavailable call evidence is not a recorded zero.', calculation: measure.calculation },
    provenance: suppliedProvenance(data),
    ...(metric !== 'calls' ? { numeratorCount: metric === 'contactRate' ? row.contactCount : row.rpcSalesCount, numeratorLabel: metric === 'contactRate' ? 'RPC calls' : 'Sold RPC calls', denominatorCount: metric === 'contactRate' ? row.totalCalls : row.contactCount, denominatorLabel: metric === 'contactRate' ? 'Recorded calls' : 'RPC calls' } : {}),
    detailLimitation: 'A supporting call-event drill is not supplied for this agent aggregate. Lead-cohort rates describe a different population.', reportPath: '/agent-performance',
  };
}

export const vendorMeasures = { leads: 'Fetched leads', deliveryRate: 'Delivery rate', dialRate: 'Dial / delivered', contactRate: 'RPC / dialled', saleRate: 'Sale / RPC', activationRate: 'Activation / sale' } as const;
export function vendorAudit(row: VendorQualityData['vendors'][number], metric: keyof typeof vendorMeasures, scope: InspectorContent['scope'], data: unknown): InspectorContent {
  return { type: 'segment', title: `${row.vendor} · ${vendorMeasures[metric]}`, value: metric === 'leads' ? formatTableNumber(row.leads) : formatPercent(row[metric]), scope,
    definition: { meaning: `Returned ${vendorMeasures[metric].toLowerCase()} for this vendor in the selected intake cohort.`, grain: 'Lead within the vendor group', dateBasis: 'Lead intake cohort', nullMeaning: 'Unavailable vendor evidence is not zero.', limitations: ['Vendor populations may overlap; adding vendor counts does not establish a distinct portfolio population.'] },
    provenance: suppliedProvenance(data), recordDrill: { drill: 'lifecycle-vendor', drillValue: row.vendor, label: 'Inspect supporting vendor records' }, reportPath: '/vendor-quality',
    detailLimitation: metric === 'leads' ? undefined : 'The response supplies the percentage but does not supply its numerator and denominator counts in this vendor row. Supporting records cover the vendor population.',
  };
}

export const campaignMeasures = { spend: 'Recorded media spend', cpl: 'Platform CPL', cpc: 'CPC', cpm: 'CPM', leads: 'Platform lead events', ctr: 'CTR' } as const;
export type CampaignAuditMeasure = keyof typeof campaignMeasures;
export function campaignAudit(data: CampaignData, row: NonNullable<CampaignData['summary']> | CampaignData['campaigns'][number], metric: CampaignAuditMeasure, scope: InspectorContent['scope']): InspectorContent {
  const isCount = metric === 'leads';
  const value = row[metric];
  const title = 'campaign' in row ? `${row.campaign} · ${campaignMeasures[metric]}` : campaignMeasures[metric];
  const denominator = metric === 'cpl' ? row.leads : metric === 'cpc' ? row.clicks : metric === 'cpm' || metric === 'ctr' ? row.impressions : undefined;
  const denominatorLabel = metric === 'cpl' ? 'Platform lead events' : metric === 'cpc' ? 'Clicks' : 'Impressions';
  return { type: 'metric', title, subtitle: 'campaign' in row ? `${row.channel} · ${row.adset}` : 'Full selected marketing scope', value: isCount ? formatTableNumber(value) : metric === 'ctr' ? formatPercent(value) : value == null ? '—' : `R ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, scope,
    definition: { meaning: metric === 'leads' ? 'Platform lead events reported by the marketing response; these are not warehouse fetched leads.' : metric === 'spend' ? 'Observed spend from the approved marketing field. Budget is a separate planning value.' : `${campaignMeasures[metric]} uses reported marketing spend or clicks and the matching platform denominator.`, grain: data.grainDiagnostics?.fields?.join(' × ') || undefined, dateBasis: 'Marketing reporting date', nullMeaning: 'Missing spend or denominators remain unavailable; budget is never substituted.', calculation: metric === 'cpm' ? 'Spend / impressions × 1,000.' : metric === 'ctr' ? 'Clicks / impressions × 100.' : metric === 'cpl' ? 'Spend / platform lead events.' : metric === 'cpc' ? 'Spend / clicks.' : undefined },
    provenance: { ...suppliedProvenance(data), ...(metric !== 'leads' && metric !== 'ctr' && data.spendSource?.table ? { source: data.spendSource.table } : {}) },
    ...(denominator !== undefined ? { numeratorCount: metric === 'ctr' ? row.clicks : row.spend, numeratorLabel: metric === 'ctr' ? 'Clicks' : 'Observed spend', denominatorCount: denominator, denominatorLabel } : {}),
    reportPath: '/campaigns', detailLimitation: 'Individual supporting marketing records are not exposed by this aggregate response. Campaign/adset rows remain available in this report.',
  };
}

export function salesAudit(content: InspectorContent | null, data: unknown): InspectorContent | null {
  if (!content) return null;
  const unactivatedSummary = content.title === 'Sales without recorded activation';
  const metricId = content.title === 'Recorded sales' ? 'sale_leads' : content.title === 'Recorded activations' ? 'activated_leads' : undefined;
  return { ...content, metricId, provenance: suppliedProvenance(data),
    ...(unactivatedSummary ? { recordDrill: undefined, detailLimitation: 'This result covers sales without activation at every age. The existing unactivated-sales drill covers only age >14 days; use the supported ageing buckets for that narrower population.' } : {}),
  };
}

const exceptionDrills = new Set(['awaiting-first-dial', 'waiting-over-hour', 'sla-breach', 'missing-disposition', 'zero-call-leads', 'one-call-only', 'high-attempt-no-rpc', 'sales-awaiting-activation', 'unactivated-sales', 'missing-source', 'missing-vendor', 'missing-grade', 'invalid-timestamps']);
export function exceptionAudit(item: { id: string; title: string; count: number; detail: string }, scope: InspectorContent['scope'], data: unknown): InspectorContent {
  return { type: 'metric', title: item.title, value: item.count, unit: 'affected leads', scope, definition: { meaning: item.detail, grain: 'Distinct lead', dateBasis: 'Lead capture cohort', nullMeaning: 'Missing observations are handled by the stated exception rule; unavailable is not zero.' }, provenance: suppliedProvenance(data), recordDrill: exceptionDrills.has(item.id) ? { drill: item.id } : undefined, reportPath: '/exceptions', detailLimitation: exceptionDrills.has(item.id) ? undefined : 'No supported affected-record drill is registered for this returned check.' };
}
