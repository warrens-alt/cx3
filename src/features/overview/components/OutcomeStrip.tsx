import TelemetryRail from '../../../shared/visuals/TelemetryRail';
import { AuditMetadata } from '../../../shared/evidence/AuditMode';
import React from 'react';
import { lifecyclePresentation } from '../../../shared/visuals/lifecyclePresentation';
import MetricSparkline from '../../../shared/visuals/MetricSparkline';
import { adaptDailyTrends } from './PerformanceTrend';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, ArrowRight, Search, Inbox, Send, BadgeCheck, Zap } from 'lucide-react';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import type { OverviewData } from '../../../lib/offernetClient';
import type { LifecycleExtension } from '../../../../contracts/lifecycleAnalytics';
import type { InspectorContent } from '../../../shared/evidence/InspectorHost';
import { useScopedNavigationTarget } from '../../../hooks/useScopedNavigationTarget';
import { lifecycleVisualAudit } from '../../evidenceWorkspace/metricVisualAudit';

export type RootMetric = 'fetchedLeads' | 'deliveryRate' | 'dialRate' | 'contactRate' | 'leadToSaleRate' | 'activationRate';

interface OutcomeStripProps {
  data: OverviewData & LifecycleExtension;
  onInspect: (content: InspectorContent) => void;
  onWhyChanged?: (metric: RootMetric) => void;
  isAdmin: boolean;
  hasComparison?: boolean;
}

// Presentation only: keep each outcome aligned with the established chart series.
const outcomePresentation = {
  fetched_leads: { icon: lifecyclePresentation.fetched.Icon, metric: 'leads', series: 'fetched' },
  delivered_leads: { icon: lifecyclePresentation.delivered.Icon, metric: 'delivered', series: 'delivered' },
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
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11.5px] font-semibold cx-tabular leading-none ${
        isPositive
          ? 'text-semantic-pos bg-semantic-pos/10'
          : isZero
          ? 'text-text-mute bg-surface-subtle border border-border-subtle'
          : 'text-semantic-neg bg-semantic-neg/10'
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
}: OutcomeStripProps) {
  const scoped = useScopedNavigationTarget();
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
    <TelemetryRail label="Principal operational outcomes" className="cx-outcome-strip">
      {outcomes.map(item => {
        const presentation = outcomePresentation[item.id as keyof typeof outcomePresentation];
        const Icon = presentation.icon;
        const count = item.id === 'fetched_leads' ? kpis.fetchedLeads : item.id === 'delivered_leads' ? kpis.deliveredLeads : item.id === 'recorded_sales' ? kpis.saleLeads : kpis.activatedLeads;
        const countEvidence = lifecycleVisualAudit(item.inspectContent, count, item.recordDrillValue, data.lifecycle);
        const rateEvidence: InspectorContent | null = item.id === 'fetched_leads' ? null : {
          ...item.inspectContent,
          metricId: item.id === 'delivered_leads' ? 'delivery_rate' : item.id === 'recorded_sales' ? 'sales_per_fetched_rate' : 'activation_rate',
          title: item.id === 'delivered_leads' ? 'Delivery rate' : item.id === 'recorded_sales' ? 'Lead-to-sale rate' : 'Activations / recorded sales',
          value: item.rateValue,
          numeratorCount: count,
          numeratorLabel: item.label,
          denominatorCount: item.id === 'activations' ? kpis.saleLeads : kpis.fetchedLeads,
          denominatorLabel: item.id === 'activations' ? 'Recorded sales' : 'Fetched leads',
          anatomy: { kind: item.id === 'activations' ? 'independent_ratio' : 'ratio', label: item.id === 'activations' ? 'Activations / recorded sales' : item.subnote, value: item.rateValue, numerator: { key: 'numerator', label: item.label, value: count }, denominator: { key: 'denominator', label: item.id === 'activations' ? 'Recorded sales' : 'Fetched leads', value: item.id === 'activations' ? kpis.saleLeads : kpis.fetchedLeads } },
        };
        return (
        <article
          key={item.id}
          data-series={presentation.series}
          className="cx-outcome-card cx-metric-card"
        >
          <div className="cx-outcome-heading flex items-start justify-between">
            <span className="cx-metric-label">
              {item.label}
            </span>
            <span className="cx-outcome-icon" aria-hidden="true"><Icon size={16} strokeWidth={1.8} /></span>
          </div>

          <div className="my-3">
            <button type="button" onClick={() => onInspect(countEvidence)} className="cx-metric-primary cx-outcome-value text-3xl lg:text-[34px] font-bold cx-tabular text-text-main block hover:text-action transition-colors tracking-tight leading-tight" aria-label={`Inspect evidence: ${item.label}`}>{item.value}</button>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {rateEvidence ? <button type="button" className="cx-button-quiet text-xs text-text-sec font-medium" onClick={() => onInspect(rateEvidence)} aria-label={`Audit evidence: ${rateEvidence.title}`}>{item.subnote}</button> : <span className="text-xs text-text-sec font-medium">{item.subnote}</span>}
              <DeltaBadge delta={item.delta} unit={item.deltaUnit} />
            </div>
          </div>

          <MetricSparkline label={item.label} color={`var(--cx-data-${presentation.series})`} points={trend.map(point => ({ date: point.date, value: point[presentation.metric] }))} />
          <AuditMetadata metricId={item.inspectContent.metricId} />
          <button type="button" className="cx-audit-evidence-control" onClick={() => onInspect(countEvidence)} aria-label={`Audit evidence: ${item.label}`}>Audit evidence</button>
          <ArrowRight className="cx-metric-chevron" size={14} aria-hidden="true" />
          {hasComparison && item.id === 'fetched_leads' && onWhyChanged && Number.isFinite(item.delta) && <button type="button" className="cx-why-btn cx-metric-context-action" onClick={() => onWhyChanged(item.rootMetric)} title={`Investigate why ${item.label.toLowerCase()} changed`}>Why changed? <Search size={12} aria-hidden="true" /></button>}
        </article>
        );
      })}
    </TelemetryRail>
  );
}
