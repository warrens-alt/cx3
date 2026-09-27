import React from 'react';
import { Info, ArrowUpRight, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import type { OverviewData } from '../../../lib/offernetClient';
import type { InspectorContent } from '../../../shared/evidence/InspectorHost';

interface OutcomeStripProps {
  data: OverviewData;
  onInspect: (content: InspectorContent) => void;
  isAdmin: boolean;
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
      <span>{isPositive ? '+' : ''}{delta}{unit}</span>
    </span>
  );
}

export default function OutcomeStrip({ data, onInspect, isAdmin }: OutcomeStripProps) {
  const kpis = data.kpis;
  const comparison = data.comparison;

  const outcomes = [
    {
      id: 'fetched_leads',
      label: 'Fetched leads',
      value: fmt(kpis.fetchedLeads),
      delta: comparison?.fetchedDelta,
      deltaUnit: '%',
      subnote: 'Total acquired demand',
      inspectContent: {
        type: 'metric' as const,
        metricId: 'fetched_leads',
        title: 'Fetched leads',
        subtitle: 'Total volume of unique customer leads received into the platform.',
        value: fmt(kpis.fetchedLeads),
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
      subnote: `${formatPercent(kpis.deliveryRate)} of fetched demand`,
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
      subnote: `${formatPercent(kpis.leadToSaleRate)} lead-to-sale rate`,
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
      value: fmt((data as any).kpis?.activatedLeads ?? (data as any).kpis?.activationLeads ?? null) !== '—' 
        ? fmt((data as any).kpis?.activatedLeads ?? (data as any).kpis?.activationLeads) 
        : formatPercent(kpis.activationRate),
      rateValue: formatPercent(kpis.activationRate),
      delta: comparison?.activationRateDelta,
      deltaUnit: 'pp',
      subnote: `${formatPercent(kpis.activationRate)} of recorded sales`,
      inspectContent: {
        type: 'metric' as const,
        metricId: 'activation_rate',
        title: 'Activations & activation rate',
        subtitle: 'Fulfilled sales converted to active recurring commercial status.',
        value: formatPercent(kpis.activationRate),
        numeratorCount: (data as any).kpis?.activatedLeads ?? null,
        numeratorLabel: 'Activated leads (numerator)',
        denominatorCount: kpis.saleLeads,
        denominatorLabel: 'Recorded sales (denominator)',
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
          className="cx-card p-4 flex flex-col justify-between hover:border-brand-primary/40 transition-colors"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-text-sec uppercase tracking-wider">
              {item.label}
            </span>
            <button
              type="button"
              onClick={() => onInspect(item.inspectContent)}
              className="text-text-mute hover:text-brand-primary p-1 rounded transition-colors cursor-pointer"
              title={`Inspect ${item.label} definition and evidence`}
              aria-label={`Inspect ${item.label} definition`}
            >
              <Info size={14} />
            </button>
          </div>

          <div className="my-2">
            <div className="text-2xl lg:text-3xl font-extrabold cx-tabular text-text-main">
              {item.value}
            </div>
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
            {isAdmin && item.inspectContent.recordDrill && (
              <span className="text-[11px] text-text-mute">Admin records ready</span>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
