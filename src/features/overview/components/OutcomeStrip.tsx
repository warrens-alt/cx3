import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, TrendingUp, TrendingDown, ArrowRight, Search } from 'lucide-react';
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

const fmt = (v: number | string | null | undefined) => formatTableNumber(v);

function DeltaBadge({ delta, unit = '%' }: { delta?: number | null; unit?: string }) {
  if (delta == null || !Number.isFinite(delta)) return null;
  const isPositive = delta > 0;
  const isZero = delta === 0;
  const Icon = isPositive ? TrendingUp : isZero ? ArrowRight : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold cx-tabular ${
        isPositive ? 'text-semantic-pos' : isZero ? 'text-text-mute' : 'text-semantic-neg'
      }`}
    >
      <Icon size={12} aria-hidden="true" />
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
    <section aria-label="Principal operational outcomes" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {outcomes.map(item => (
        <article
          key={item.id}
          className="cx-card p-4 flex flex-col justify-between hover:border-brand-primary/40 transition-colors group"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-text-sec">
              {item.label}
            </span>
          </div>

          <div className="my-2">
            {isAdmin ? (
              <Link
                to={scoped(`/lead-explorer?drill=funnel-stage&drillValue=${item.recordDrillValue}`)}
                className="text-2xl lg:text-3xl font-extrabold cx-tabular text-text-main block hover:text-brand-primary transition-colors"
                title={`Inspect ${item.label} records in Lead Explorer`}
              >
                {item.value}
              </Link>
            ) : (
              <Link
                to={scoped(item.reportPath)}
                className="text-2xl lg:text-3xl font-extrabold cx-tabular text-text-main block hover:text-brand-primary transition-colors"
                title={`Open ${item.label} report`}
              >
                {item.value}
              </Link>
            )}

            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-text-mute">{item.subnote}</span>
              <DeltaBadge delta={item.delta} unit={item.deltaUnit} />
            </div>
          </div>

          <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => onInspect(item.inspectContent)}
              className="inline-flex items-center gap-1 text-brand-primary font-medium hover:underline cursor-pointer"
            >
              <span>Inspect definition</span>
              <ArrowUpRight size={12} />
            </button>

            {hasComparison && onWhyChanged && item.delta != null && (
              <button
                type="button"
                onClick={() => onWhyChanged(item.rootMetric)}
                className="inline-flex items-center gap-1 text-text-sec hover:text-brand-primary font-medium cursor-pointer"
                title={`Investigate why ${item.label.toLowerCase()} changed`}
              >
                <span>Why?</span>
                <Search size={11} />
              </button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
