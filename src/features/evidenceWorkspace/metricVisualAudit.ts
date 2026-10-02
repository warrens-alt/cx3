import type { LifecycleDiagnostics } from '../../../contracts/lifecycleAnalytics';
import type { SalesActivationData } from '../../lib/offernetClient';
import type { InspectorContent } from '../../shared/evidence/InspectorHost';

/** Presentation allowlist. Omitted response counts stay unavailable, including real zero. */
export function suppliedCount(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function lifecycleVisualAudit(content: InspectorContent, count: number | null | undefined, stage?: string, lifecycle?: LifecycleDiagnostics): InspectorContent {
  const observedCount = suppliedCount(count);
  const recorded = stage === 'delivered' || stage === 'dialled' || stage === 'rpc'
    ? lifecycle?.recordedEvidence?.[stage] : undefined;
  return {
    ...content,
    anatomy: { kind: 'count', label: content.title, value: observedCount, numerator: { key: 'population', label: 'Distinct scoped leads', value: observedCount }, detail: 'The returned stage count is shown at its declared grain. Independent stage populations are not subtracted to construct a loss population.' },
    ...(recorded !== undefined ? {
      qualification: {
        label: `${content.title} qualification`,
        recorded: { key: 'recorded', label: 'Recorded source evidence', value: suppliedCount(recorded) },
        qualified: { key: 'qualified', label: 'Qualified lifecycle population', value: observedCount },
        reasons: [],
        detail: 'These are the returned recorded and qualified populations. Per-reason exclusion counts are not supplied by this response; no exclusion population or record drill is inferred.',
      },
    } : {}),
  };
}

export function salesVisualAudit(content: InspectorContent | null, data?: SalesActivationData | null): InspectorContent | null {
  if (!content || !data) return content;
  const returned = data.reconciliation;
  if (content.title === 'Source-recorded revenue') {
    const missing = suppliedCount(returned.unrecordedRevenueSales);
    return {
      ...content,
      anatomy: { kind: 'financial', label: content.title, value: suppliedCount(returned.realizedRevenue), unit: data.currency || data.metadata?.currency, completeness: { key: 'coverage', label: 'Recorded-sale revenue coverage', state: missing === null ? 'unavailable' : missing > 0 ? 'partial' : 'observed', detail: missing === null ? 'The missing-revenue count was not supplied.' : `${missing.toLocaleString()} recorded sales have missing revenue.` }, detail: data.revenueEvidence || 'Sum of available source-recorded revenue, including real zero. This does not establish invoice, cash settlement or earned revenue.' },
      coverage: {
        label: 'Revenue evidence on recorded sales', composition: 'separate',
        categories: [
          { key: 'recorded', label: 'Sales with recorded revenue (includes zero)', value: suppliedCount(returned.salesWithRecordedRevenue) },
          { key: 'zero', label: 'Sales with explicit zero revenue', value: suppliedCount(returned.unbilledSales) },
          { key: 'missing', label: 'Sales missing revenue', value: missing, state: missing === null ? 'unavailable' : missing > 0 ? 'partial' : 'observed' },
        ],
        detail: 'Explicit zero is part of the recorded-revenue population. These overlapping counts use separate bars; no non-zero population is inferred.',
      },
      details: 'The coverage above uses the raw returned counts. Omitted completeness counts remain unavailable. Source-recorded revenue does not certify billable, invoiced, collected or earned revenue.',
    };
  }
  if (content.title === 'Activations / recorded sales') return {
    ...content,
    metricId: 'activation_rate',
    anatomy: { kind: 'independent_ratio', label: content.title, value: content.value ?? suppliedCount(returned.activationRate), numerator: { key: 'activations', label: 'Recorded activations', value: suppliedCount(returned.totalActivations) }, denominator: { key: 'sales', label: 'Recorded sales', value: suppliedCount(returned.totalSales) }, scaling: 'percentage_value', formula: 'Recorded activations / recorded sales × 100', detail: 'The displayed rate retains the existing adapter result. The populations are independently recorded; this ratio does not establish a linked sale-to-activation transition.' },
  };
  if (content.title === 'Recorded sales' || content.title === 'Recorded activations') return {
    ...content,
    anatomy: { kind: 'count', label: content.title, value: suppliedCount(content.title === 'Recorded sales' ? returned.totalSales : returned.totalActivations), numerator: { key: 'population', label: content.title, value: suppliedCount(content.title === 'Recorded sales' ? returned.totalSales : returned.totalActivations) } },
  };
  if (content.title === 'Sales without recorded activation') return {
    ...content,
    ...(Array.isArray(data.activationAgeing) && data.activationAgeing.length ? {
      coverage: { label: 'Returned sale-age evidence', composition: 'mutually-exclusive', categories: data.activationAgeing.map((row, index) => ({ key: `${row.bucket}-${index}`, label: row.bucket, value: suppliedCount(row.sales) })), detail: 'Returned completed-day age buckets and future timestamp anomalies remain separate. No absent age bucket is filled with zero.' },
      details: 'The displayed queue uses the existing returned age-bucket aggregate. Use supported ageing buckets to inspect their exact records; the all-age queue has no matching existing record drill.',
    } : { details: 'The response does not supply age-bucket evidence for this queue. Missing age coverage is unavailable.' }),
  };
  return content;
}
