import TelemetryRail from '../../../shared/visuals/TelemetryRail';
import { AuditMetadata } from '../../../shared/evidence/AuditMode';
import React from 'react';
import { lifecyclePresentation } from '../../../shared/visuals/lifecyclePresentation';
import MetricSparkline from '../../../shared/visuals/MetricSparkline';
import { adaptDailyTrends } from './PerformanceTrend';
import { TrendingUp, TrendingDown, ArrowRight, Search } from 'lucide-react';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import type { OverviewData } from '../../../lib/offernetClient';
import type { LifecycleExtension } from '../../../../contracts/lifecycleAnalytics';
import type { InspectorContent } from '../../../shared/evidence/InspectorHost';
import { lifecycleVisualAudit } from '../../evidenceWorkspace/metricVisualAudit';

export type RootMetric = 'fetchedLeads' | 'deliveryRate' | 'dialRate' | 'contactRate' | 'leadToSaleRate' | 'activationRate';

interface OutcomeStripProps {
  data: OverviewData & LifecycleExtension;
  onInspect: (content: InspectorContent) => void;
  onWhyChanged?: (metric: RootMetric) => void;
  isAdmin: boolean;
  hasComparison?: boolean;
  includeUnavailableStages?: boolean;
}

// Presentation only: keep each outcome aligned with the established chart series.
const outcomePresentation = {
  fetched_leads: { icon: lifecyclePresentation.fetched.Icon, metric: 'leads', series: 'fetched' },
  delivered_leads: { icon: lifecyclePresentation.delivered.Icon, metric: 'delivered', series: 'delivered' },
  dialled_leads: { icon: lifecyclePresentation.dialled.Icon, metric: 'dialled', series: 'dialled' },
  rpc_leads: { icon: lifecyclePresentation.rpc.Icon, metric: 'contacted', series: 'rpc' },
  recorded_sales: { icon: lifecyclePresentation.sales.Icon, metric: 'sales', series: 'sales' },
  activations: { icon: lifecyclePresentation.activated.Icon, metric: 'activations', series: 'activation' },
} as const;

const fmt = (v: number | string | null | undefined) => formatTableNumber(v);

function DeltaBadge({ delta, unit = '%' }: { delta?: number | null; unit?: string }) {
  if (delta == null || !Number.isFinite(delta)) return null;
  const isPositive = delta > 0;
  const isZero = delta === 0;
  const Icon = isPositive ? TrendingUp : isZero ? ArrowRight : TrendingDown;
  return (
    <span
      className={`cx-outcome-delta cx-tabular ${
        isPositive
          ? 'text-semantic-pos'
          : isZero
          ? 'text-text-mute'
          : 'text-semantic-neg'
      }`}
    >
      <Icon size={11} aria-hidden="true" />
      <span>
        {isPositive ? '+' : ''}
        {delta}
        {unit}
      </span>
    </span>
  );
}

export default function OutcomeStrip({
  data,
  onInspect,
  onWhyChanged,
  isAdmin,
  hasComparison = false,
  includeUnavailableStages = false,
}: OutcomeStripProps) {
  const kpis = data.kpis;
  const comparison = data.comparison;
  const trend = adaptDailyTrends(data.dailyTrends);

  const outcomes = [
    {
      id: 'fetched_leads',
      label: 'Fetched leads',
      value: fmt(kpis.fetchedLeads),
      delta: comparison?.fetchedDelta,
      deltaUnit: '%',
      rootMetric: 'fetchedLeads' as RootMetric,
      subnote: 'Total acquired demand',
      reportPath: '/funnel',
      recordDrillValue: 'fetched',
      inspectContent: {
        type: 'metric' as const,
        metricId: 'fetched_leads',
        title: 'Fetched leads',
        subtitle: 'Total volume of unique customer leads received into the platform.',
        value: fmt(kpis.fetchedLeads),
        unit: 'records',
        reportPath: '/funnel',
        reportLabel: 'Open progression funnel',
        recordDrill: {
          drill: 'funnel-stage',
          drillValue: 'fetched',
          label: 'Inspect fetched lead records',
        },
      },
    },
    {
      id: 'delivered_leads',
      label: 'Delivered leads',
      value: fmt(kpis.deliveredLeads),
      rateValue: formatPercent(kpis.deliveryRate),
      delta: comparison?.deliveryRateDelta,
      deltaUnit: 'pp',
      rootMetric: 'deliveryRate' as RootMetric,
      subnote: `${formatPercent(kpis.deliveryRate)} delivery rate`,
      reportPath: '/funnel',
      recordDrillValue: 'delivered',
      inspectContent: {
        type: 'metric' as const,
        metricId: 'delivered_leads',
        title: 'Delivered leads',
        subtitle: 'Distinct fetched leads with delivery evidence in the selected cohort.',
        value: fmt(kpis.deliveredLeads),
        relatedValue: { label: 'Delivered / fetched', value: formatPercent(kpis.deliveryRate) },
        reportPath: '/funnel',
        reportLabel: 'Open delivery breakdown',
        recordDrill: {
          drill: 'funnel-stage',
          drillValue: 'delivered',
          label: 'Inspect delivered lead records',
        },
      },
    },
    {
      id: 'dialled_leads',
      label: 'Dialled leads',
      value: fmt(kpis.dialledLeads),
      rateValue: formatPercent(kpis.dialRate),
      delta: comparison?.dialRateDelta,
      deltaUnit: 'pp',
      rootMetric: 'dialRate' as RootMetric,
      subnote: `${formatPercent(kpis.dialRate)} of delivered leads`,
      reportPath: '/funnel',
      recordDrillValue: 'dialled',
      inspectContent: {
        type: 'metric' as const,
        metricId: 'dialled_leads',
        title: 'Dialled leads',
        subtitle: 'Qualified delivered leads with a chronologically consistent first-dial timestamp.',
        value: fmt(kpis.dialledLeads),
        relatedValue: { label: 'Dialled / delivered', value: formatPercent(kpis.dialRate) },
        reportPath: '/funnel',
        reportLabel: 'Open dial coverage',
        recordDrill: { drill: 'funnel-stage', drillValue: 'dialled', label: 'Inspect dialled lead records' },
      },
    },
    {
      id: 'rpc_leads',
      label: 'Right-party contact (RPC)',
      value: fmt(kpis.contactedLeads),
      rateValue: formatPercent(kpis.contactRate),
      delta: comparison?.contactRateDelta,
      deltaUnit: 'pp',
      rootMetric: 'contactRate' as RootMetric,
      subnote: `${formatPercent(kpis.contactRate)} of dialled leads`,
      reportPath: '/funnel',
      recordDrillValue: 'rpc',
      inspectContent: {
        type: 'metric' as const,
        metricId: 'rpc_leads',
        title: 'Right-party contact (RPC)',
        subtitle: 'Qualified dialled leads with positive source-recorded RPC evidence.',
        value: fmt(kpis.contactedLeads),
        relatedValue: { label: 'RPC / dialled', value: formatPercent(kpis.contactRate) },
        reportPath: '/funnel',
        reportLabel: 'Open contact coverage',
        recordDrill: { drill: 'funnel-stage', drillValue: 'rpc', label: 'Inspect right-party contact records' },
      },
    },
    {
      id: 'recorded_sales',
      label: 'Recorded sales',
      value: fmt(kpis.saleLeads),
      rateValue: formatPercent(kpis.leadToSaleRate),
      delta: comparison?.saleRateDelta,
      deltaUnit: 'pp',
      rootMetric: 'leadToSaleRate' as RootMetric,
      subnote: `${formatPercent(kpis.leadToSaleRate)} lead-to-sale rate`,
      reportPath: '/sales-activation',
      recordDrillValue: 'sales',
      inspectContent: {
        type: 'metric' as const,
        metricId: 'sale_leads',
        title: 'Recorded sales',
        subtitle: 'Unique leads with confirmed sales recorded by receiving contact operations.',
        value: fmt(kpis.saleLeads),
        relatedValue: { label: 'Sales / fetched', value: formatPercent(kpis.leadToSaleRate) },
        reportPath: '/sales-activation',
        reportLabel: 'Open sales activation',
        recordDrill: {
          drill: 'funnel-stage',
          drillValue: 'sales',
          label: 'Inspect recorded sales records',
        },
      },
    },
    {
      id: 'activations',
      label: 'Activations',
      value: fmt(kpis.activatedLeads),
      rateValue: formatPercent(kpis.activationRate),
      delta: comparison?.activationRateDelta,
      deltaUnit: 'pp',
      rootMetric: 'activationRate' as RootMetric,
      subnote: `${formatPercent(kpis.activationRate)} of recorded sales`,
      reportPath: '/sales-activation',
      recordDrillValue: 'activated',
      inspectContent: {
        type: 'metric' as const,
        metricId: 'activated_leads',
        title: 'Activations',
        subtitle: 'Independently recorded activation timestamps within the selected intake cohort.',
        value: fmt(kpis.activatedLeads),
        relatedValue: { label: 'Activations / recorded sales', value: formatPercent(kpis.activationRate) },
        reportPath: '/sales-activation',
        reportLabel: 'Open activation workspace',
        recordDrill: {
          drill: 'funnel-stage',
          drillValue: 'activated',
          label: 'Inspect activated lead records',
        },
      },
    },
  ];

  return (
    <TelemetryRail label="Principal operational outcomes" className={`cx-outcome-strip${includeUnavailableStages ? ' cx-command-lifecycle' : ''}`}>
      <header className="cx-outcome-rail-heading"><h2>Lead lifecycle</h2><p>Observed stage populations · recorded sales and activations remain independent evidence.</p></header>
      {outcomes.map(item => {
        const presentation = outcomePresentation[item.id as keyof typeof outcomePresentation];
        const Icon = presentation.icon;
        const count = item.id === 'fetched_leads' ? kpis.fetchedLeads : item.id === 'delivered_leads' ? kpis.deliveredLeads : item.id === 'dialled_leads' ? kpis.dialledLeads : item.id === 'rpc_leads' ? kpis.contactedLeads : item.id === 'recorded_sales' ? kpis.saleLeads : kpis.activatedLeads;
        const denominator = item.id === 'dialled_leads' ? kpis.deliveredLeads : item.id === 'rpc_leads' ? kpis.dialledLeads : item.id === 'activations' ? kpis.saleLeads : kpis.fetchedLeads;
        const denominatorLabel = item.id === 'dialled_leads' ? 'Delivered leads' : item.id === 'rpc_leads' ? 'Dialled leads' : item.id === 'activations' ? 'Recorded sales' : 'Fetched leads';
        const rateMetricId = item.id === 'delivered_leads' ? 'delivery_rate' : item.id === 'dialled_leads' ? 'dial_rate' : item.id === 'rpc_leads' ? 'rpc_rate' : item.id === 'recorded_sales' ? 'sales_per_fetched_rate' : 'activation_rate';
        const rateTitle = item.id === 'delivered_leads' ? 'Delivery rate' : item.id === 'dialled_leads' ? 'Dialled / delivered' : item.id === 'rpc_leads' ? 'RPC / dialled' : item.id === 'recorded_sales' ? 'Lead-to-sale rate' : 'Activations / recorded sales';
        const countEvidence = lifecycleVisualAudit(item.inspectContent, count, item.recordDrillValue, data.lifecycle);
        const rateEvidence: InspectorContent | null = item.id === 'fetched_leads' ? null : {
          ...item.inspectContent,
          metricId: rateMetricId,
          title: rateTitle,
          value: item.rateValue,
          numeratorCount: count,
          numeratorLabel: item.label,
          denominatorCount: denominator,
          denominatorLabel,
          anatomy: { kind: item.id === 'activations' ? 'independent_ratio' : 'ratio', label: item.id === 'activations' ? 'Activations / recorded sales' : item.subnote, value: item.rateValue, numerator: { key: 'numerator', label: item.label, value: count }, denominator: { key: 'denominator', label: denominatorLabel, value: denominator } },
        };
        return (
        <React.Fragment key={item.id}>
        {includeUnavailableStages && item.id === 'delivered_leads' && ['Qualified', 'Routed'].map(label => <article className="cx-command-stage-unavailable" key={label} data-evidence="unavailable">
          <span className="cx-metric-label">{label}</span><strong>Unavailable</strong>
          <p>No authoritative stage population supplied.</p>
          <button type="button" className="cx-audit-evidence-control" aria-label={`Audit evidence: ${label}`} onClick={() => onInspect({ type: 'stage', title: `${label} population`, value: 'Unavailable', subtitle: 'This operational response does not supply an authoritative population for this stage.', reportPath: label === 'Qualified' ? '/journey/qualification' : '/journey/routing', reportLabel: `Open ${label === 'Qualified' ? 'qualification' : 'routing'} evidence` })}>Audit evidence</button>
        </article>)}
        <article
          data-series={presentation.series}
          className="cx-outcome-card cx-metric-card"
        >
          <div className="cx-outcome-heading">
            <span className="cx-metric-label">
              {item.label}
            </span>
            <span className="cx-outcome-icon" aria-hidden="true"><Icon size={16} strokeWidth={1.8} /></span>
          </div>

          <div className="cx-outcome-measure">
            <button type="button" onClick={() => onInspect(countEvidence)} className="cx-metric-primary cx-outcome-value cx-tabular" aria-label={`Inspect evidence: ${item.label}`}>{item.value}</button>

            <div className="cx-outcome-context">
              {rateEvidence ? <button type="button" className="cx-button-quiet cx-outcome-rate" onClick={() => onInspect(rateEvidence)} aria-label={`Audit evidence: ${rateEvidence.title}`}>{item.subnote}</button> : <span>{item.subnote}</span>}
              {hasComparison && onWhyChanged && Number.isFinite(item.delta) ? <button type="button" className="cx-command-movement" onClick={() => onWhyChanged(item.rootMetric)} aria-label={`Investigate ${item.label} movement`}><DeltaBadge delta={item.delta} unit={item.deltaUnit} /><Search size={11} aria-hidden="true" /></button> : <DeltaBadge delta={item.delta} unit={item.deltaUnit} />}
            </div>
          </div>

          <MetricSparkline label={item.label} color={`var(--cx-data-${presentation.series})`} points={trend.map(point => ({ date: point.date, value: point[presentation.metric] }))} />
          <AuditMetadata metricId={item.inspectContent.metricId} />
          <button type="button" className="cx-audit-evidence-control" onClick={() => onInspect(countEvidence)} aria-label={`Audit evidence: ${item.label}`}>Audit evidence</button>
          <ArrowRight className="cx-metric-chevron" size={14} aria-hidden="true" />
          {hasComparison && onWhyChanged && Number.isFinite(item.delta) && <button type="button" className="cx-why-btn cx-metric-context-action" onClick={() => onWhyChanged(item.rootMetric)} title={`Investigate why ${item.label.toLowerCase()} changed`}>Why changed? <Search size={12} aria-hidden="true" /></button>}
        </article></React.Fragment>
        );
      })}
    </TelemetryRail>
  );
}
