import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, TrendingUp, TrendingDown, ArrowRight, Search, Inbox, Send, BadgeCheck, Zap } from 'lucide-react';
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
        metricId: 'delivery_rate',
        title: 'Delivered leads & delivery rate',
        subtitle: 'Proportion of fetched intake successfully delivered to receiving vendors.',
        value: formatPercent(kpis.deliveryRate),
        numeratorCount: kpis.deliveredLeads,
        numeratorLabel: 'Delivered leads (numerator)',
        denominatorCount: kpis.fetchedLeads,
        denominatorLabel: 'Fetched leads (denominator)',
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
        metricId: 'sales_per_fetched_rate',
        title: 'Recorded sales',
        subtitle: 'Unique leads with confirmed sales recorded by receiving contact operations.',
        value: fmt(kpis.saleLeads),
        numeratorCount: kpis.saleLeads,
        numeratorLabel: 'Sale leads (numerator)',
        denominatorCount: kpis.fetchedLeads,
        denominatorLabel: 'Fetched leads (denominator)',
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
        metricId: 'activation_rate',
        title: 'Activations & activation rate',
        subtitle: 'Fulfilled sales converted to active recurring commercial status.',
        value: formatPercent(kpis.activationRate),
        numeratorCount: kpis.activatedLeads,
        numeratorLabel: 'Activated leads (numerator)',
        denominatorCount: kpis.saleLeads,
        denominatorLabel: 'Recorded sales (denominator)',
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
          className="cx-outcome-card enterprise-card bg-surface border border-border hover:border-action/50 rounded-xl p-5 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between group"
        >
          <div className="cx-outcome-heading flex items-start justify-between">
            <span className="text-[11px] font-bold text-text-sec uppercase tracking-wider">
              {item.label}
            </span>
            <span className="cx-outcome-icon" aria-hidden="true"><Icon size={16} strokeWidth={1.8} /></span>
          </div>

          <div className="my-3">
            {isAdmin ? (
              <Link
                to={scoped(`/lead-explorer?drill=funnel-stage&drillValue=${item.recordDrillValue}`)}
                className="cx-outcome-value text-3xl lg:text-[34px] font-bold cx-tabular text-text-main block hover:text-action transition-colors font-mono tracking-tight leading-tight"
                title={`Inspect ${item.label} records in Lead Explorer`}
              >
                {item.value}
              </Link>
            ) : (
              <Link
                to={scoped(item.reportPath)}
                className="cx-outcome-value text-3xl lg:text-[34px] font-bold cx-tabular text-text-main block hover:text-action transition-colors font-mono tracking-tight leading-tight"
                title={`Open ${item.label} report`}
              >
                {item.value}
              </Link>
            )}

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs text-text-sec font-medium">{item.subnote}</span>
              <DeltaBadge delta={item.delta} unit={item.deltaUnit} />
            </div>
          </div>

          <div className="cx-outcome-actions pt-3 border-t border-border-subtle flex items-center justify-between text-xs text-text-mute">
            <button
              type="button"
              onClick={() => onInspect(item.inspectContent)}
              className="inline-flex items-center gap-1 font-semibold text-text-sec hover:text-action transition-colors cursor-pointer"
            >
              <span>Inspect definition</span>
              <ArrowUpRight size={13} />
            </button>

            {onWhyChanged && (
              <button
                type="button"
                onClick={() => onWhyChanged(item.rootMetric)}
                className="inline-flex items-center gap-1 font-semibold hover:text-action transition-colors cursor-pointer"
                title={`Investigate why ${item.label.toLowerCase()} changed`}
              >
                <span>Why changed?</span>
                <Search size={12} />
              </button>
            )}
          </div>
        </article>
        );
      })}
    </section>
  );
}
