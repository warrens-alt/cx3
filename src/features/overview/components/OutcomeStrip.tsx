import { AuditMetadata } from '../../../shared/evidence/AuditMode';
import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, ArrowRight, Search, Inbox, Send, BadgeCheck, Zap } from 'lucide-react';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import type { OverviewData } from '../../../lib/offernetClient';
import type { InspectorContent } from '../../../shared/evidence/InspectorHost';
import { useScopedNavigationTarget } from '../../../hooks/useScopedNavigationTarget';

export type RootMetric = 'fetchedLeads' | 'deliveryRate' | 'dialRate' | 'contactRate' | 'leadToSaleRate' | 'activationRate';

interface OutcomeStripProps {
  data: OverviewData;
  onInspect: (content: InspectorContent) => void;
  onWhyChanged?: (metric: RootMetric) => void;
  isAdmin: boolean;
  hasComparison?: boolean;
}

// Presentation only: keep each outcome aligned with the established chart series.
const outcomePresentation = {
  fetched_leads: { icon: Inbox, series: 'fetched' },
  delivered_leads: { icon: Send, series: 'delivered' },
  recorded_sales: { icon: BadgeCheck, series: 'sales' },
  activations: { icon: Zap, series: 'activation' },
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
        subtitle: 'Fulfilled sales converted to active recurring commercial status.',
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
    <section aria-label="Principal operational outcomes" className="cx-outcome-strip grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {outcomes.map(item => {
        const presentation = outcomePresentation[item.id as keyof typeof outcomePresentation];
        const Icon = presentation.icon;
        return (
        <article
          key={item.id}
          data-series={presentation.series}
          className="cx-outcome-card cx-metric-card enterprise-card bg-surface border border-border hover:border-action/50 rounded-xl p-5 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between group"
        >
          <div className="cx-outcome-heading flex items-start justify-between">
            <span className="text-[11px] font-semibold text-text-sec">
              {item.label}
            </span>
            <span className="cx-outcome-icon" aria-hidden="true"><Icon size={16} strokeWidth={1.8} /></span>
          </div>

          <div className="my-3">
            <button type="button" onClick={() => onInspect(item.inspectContent)} className="cx-metric-primary cx-outcome-value text-3xl lg:text-[34px] font-bold cx-tabular text-text-main block hover:text-action transition-colors font-mono tracking-tight leading-tight" aria-label={`Inspect evidence: ${item.label}`}>{item.value}</button>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs text-text-sec font-medium">{item.subnote}</span>
              <DeltaBadge delta={item.delta} unit={item.deltaUnit} />
            </div>
          </div>

          <AuditMetadata metricId={item.inspectContent.metricId} />
          <ArrowRight className="cx-metric-chevron" size={14} aria-hidden="true" />
          {hasComparison && item.id === 'fetched_leads' && onWhyChanged && Number.isFinite(item.delta) && <button type="button" className="cx-why-btn cx-metric-context-action" onClick={() => onWhyChanged(item.rootMetric)} title={`Investigate why ${item.label.toLowerCase()} changed`}>Why changed? <Search size={12} aria-hidden="true" /></button>}
        </article>
        );
      })}
    </section>
  );
}
