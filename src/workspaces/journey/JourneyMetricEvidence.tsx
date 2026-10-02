import React from 'react';
import type { LifecycleDiagnostics } from '../../../contracts/lifecycleAnalytics';
import type { JourneyStageItem } from '../../features/journey/model/journeyAdapter';
import type { InspectorContent } from '../../shared/evidence/InspectorHost';
import { AuditMetadata } from '../../shared/evidence/AuditMode';
import { formatPercent, formatTableNumber } from '../../lib/formatters';

const count = (value: number | null | undefined) => value == null ? 'Unavailable' : formatTableNumber(value);

/** Keep exact metric anatomy available without rebuilding rates in the browser. */
export default function JourneyMetricEvidence({ stages, lifecycle, scope, onInspect }: {
  stages: JourneyStageItem[];
  lifecycle?: LifecycleDiagnostics;
  scope: InspectorContent['scope'];
  onInspect: (content: InspectorContent) => void;
}) {
  const population = (stage: JourneyStageItem['key']) => stages.find(item => item.key === stage)?.volume ?? null;
  const suppliedRate = (key: string) => lifecycle?.comparisons[key]?.current == null ? 'Unavailable' : formatPercent(lifecycle.comparisons[key].current);
  const rows = [
    { label: 'Acquired demand', metricId: 'fetched_leads', stage: 'fetched', value: count(population('fetched')), numerator: population('fetched'), denominator: null, basis: 'Intake cohort' },
    { label: 'Delivery rate', metricId: 'delivery_rate', stage: 'delivered', value: suppliedRate('deliveryRate'), numerator: population('delivered'), denominator: population('fetched'), basis: 'Delivered / fetched' },
    { label: 'Dial coverage', metricId: 'dial_rate', stage: 'dialled', value: suppliedRate('dialRate'), numerator: population('dialled'), denominator: population('delivered'), basis: 'Dialled / delivered' },
    { label: 'Contact rate (RPC)', metricId: 'rpc_rate', stage: 'rpc', value: suppliedRate('rpcRate'), numerator: population('rpc'), denominator: population('dialled'), basis: 'RPC / dialled' },
    { label: 'Lead → Sale', metricId: 'sales_per_fetched_rate', stage: 'sales', value: suppliedRate('saleRate'), numerator: population('sales'), denominator: population('fetched'), basis: 'Sales / fetched' },
    { label: 'Activations', metricId: 'activated_leads', stage: 'activated', value: count(population('activated')), numerator: population('activated'), denominator: null, basis: 'Recorded activations' },
  ];
  return <details className="cx-report-disclosure">
    <summary>View stage metrics and rate definitions</summary>
    <div className="cx-viz-table-scroll" role="region" aria-label="Stage metric evidence" tabIndex={0}>
      <table className="cx-viz-table"><caption className="sr-only">Independent stage metrics retain their original numerator and denominator definitions. Rates are displayed only when supplied.</caption>
        <thead><tr><th scope="col">Measure</th><th scope="col">Value</th><th scope="col">Numerator</th><th scope="col">Denominator</th><th scope="col">Basis</th></tr></thead>
        <tbody>{rows.map(item => <tr key={item.metricId}><th scope="row"><button type="button" className="cx-button-quiet" aria-label={`Audit evidence: ${item.label}`} onClick={() => onInspect({
          type: 'metric', metricId: item.metricId, title: item.label, value: item.value,
          numeratorCount: item.numerator, denominatorCount: item.denominator,
          anatomy: { kind: item.basis.includes(' / ') ? 'ratio' : 'count', label: item.label, value: item.value, numerator: { key: 'numerator', label: item.basis.includes(' / ') ? item.basis.split(' / ')[0] : item.label, value: item.numerator }, ...(item.basis.includes(' / ') ? { denominator: { key: 'denominator', label: item.basis.split(' / ')[1], value: item.denominator } } : {}), detail: item.basis },
          scope, provenance: { validationStatus: lifecycle?.validationStatus }, recordDrill: { drill: 'funnel-stage', drillValue: item.stage },
        })}>{item.label}</button><AuditMetadata metricId={item.metricId} /></th><td>{item.value}</td><td>{count(item.numerator)}</td><td>{item.basis.includes(' / ') ? count(item.denominator) : 'Not applicable'}</td><td>{item.basis}</td></tr>)}</tbody>
      </table>
    </div>
  </details>;
}
