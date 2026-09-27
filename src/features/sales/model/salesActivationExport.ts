import { downloadAnalysisCsv, type AnalysisCell } from '../../../lib/analysisExport';
import type { AdaptedSalesActivation, SegmentDimension, AdaptedSegmentRow } from './salesActivationAdapter';

export interface SalesExportScope {
  clientId: string;
  startDate?: string;
  endDate?: string;
  filters?: Record<string, any>;
  timezone?: string;
  currency?: string;
}

export function exportSegmentAnalysis(
  dimension: SegmentDimension,
  rows: AdaptedSegmentRow[],
  scope: SalesExportScope,
  methodology?: string
): void {
  const dimensionTitle = dimension.charAt(0).toUpperCase() + dimension.slice(1);
  const filename = `sales_activation_${dimension}_${scope.clientId}_${scope.startDate || 'all'}_${scope.endDate || 'all'}`;

  const header: AnalysisCell[] = [
    'Dimension',
    dimensionTitle,
    'Recorded sales',
    'Recorded activations',
    'Activation / sale ratio (%)',
    'Source-recorded revenue',
    'Revenue / sale',
    'Sales missing revenue',
  ];

  const dataRows: AnalysisCell[][] = rows.map((r) => [
    dimensionTitle,
    r.name,
    r.sales,
    r.activations,
    r.activationRatio !== null ? Number(r.activationRatio.toFixed(2)) : null,
    r.revenue,
    r.revenuePerSale !== null ? Number(r.revenuePerSale.toFixed(2)) : null,
    r.unrecordedRevenueSales,
  ]);

  downloadAnalysisCsv(
    filename,
    [header, ...dataRows],
    {
      clientId: scope.clientId,
      startDate: scope.startDate,
      endDate: scope.endDate,
      filters: scope.filters,
      timezone: scope.timezone,
      dateBasis: 'Operational intake cohort',
      definitions: [
        methodology || 'Recorded sales and activations in selected operational intake cohort.',
        'Independent counts: activations are counted independently of sales within the intake window.',
        'Revenue is source-recorded revenue only; does not certify invoiced/collected amounts.',
      ],
      validationStatus: 'NOT_VERIFIED',
    }
  );
}

export function exportAgeingAnalysis(
  model: AdaptedSalesActivation,
  scope: SalesExportScope
): void {
  const filename = `activation_ageing_${scope.clientId}_${scope.startDate || 'all'}_${scope.endDate || 'all'}`;

  const header: AnalysisCell[] = [
    'Completed age bucket',
    'Sales awaiting activation',
    'Share of unactivated sales (%)',
    'Queue status',
    'Description',
  ];

  const dataRows: AnalysisCell[][] = model.ageing.buckets.map((b) => [
    b.bucket,
    b.sales,
    b.shareOfUnactivated !== null ? Number(b.shareOfUnactivated.toFixed(2)) : null,
    b.isInvalidFuture ? 'INTEGRITY_CHECK_REQUIRED' : 'NORMAL_AGEING',
    b.description,
  ]);

  downloadAnalysisCsv(
    filename,
    [header, ...dataRows],
    {
      clientId: scope.clientId,
      startDate: scope.startDate,
      endDate: scope.endDate,
      filters: scope.filters,
      timezone: scope.timezone,
      dateBasis: 'Operational intake cohort',
      definitions: [
        'Non-overlapping completed-day age cohorts measured from recorded sale timestamp.',
        'Population: is_sale AND NOT is_activated.',
        'Invalid future sale timestamps occur after the evaluation cutoff timestamp.',
      ],
      validationStatus: 'NOT_VERIFIED',
    }
  );
}

export function exportSalesActivationWorkbook(
  model: AdaptedSalesActivation,
  activeDimension: SegmentDimension,
  scope: SalesExportScope
): void {
  const filename = `sales_activation_outcomes_${scope.clientId}_${scope.startDate || 'all'}_${scope.endDate || 'all'}`;

  const rows: AnalysisCell[][] = [
    ['--- SUMMARY METRICS ---'],
    ['Metric', 'Value', 'Completeness / Note'],
    ['Recorded sales', model.summary.totalSales, 'Observed sale events in selected intake cohort'],
    ['Recorded activations', model.summary.totalActivations, 'Independent count of activated leads'],
    ['Activation / sale ratio (%)', model.summary.activationRatio !== null ? Number(model.summary.activationRatio.toFixed(2)) : null, 'Ratio of independent activation to sale counts'],
    ['Sales without recorded activation', model.summary.salesWithoutActivation, `Valid pending: ${model.summary.validPendingActivation ?? 0}; Invalid future: ${model.summary.invalidFutureSales}`],
    ['Source-recorded revenue', model.summary.realizedRevenue, `Currency: ${scope.currency || 'unspecified'}; ${model.summary.salesWithRecordedRevenue ?? 0} with revenue; ${model.summary.unbilledSales} recorded zero; ${model.summary.unrecordedRevenueSales} missing revenue`],
    ['Average time to sale', model.timing.avgTimeToSale, 'Lead intake to recorded sale'],
    ['Average sale to activation', model.timing.avgTimeToActivation, 'Recorded sale to recorded activation'],
    ['Median time to sale', model.timing.medianTimeToSale, 'Lead intake to recorded sale'],
    ['Median sale to activation', model.timing.medianTimeToActivation, 'Recorded sale to recorded activation'],
    ['Maturation status', model.maturation.status, model.maturation.reason],
    [],
    ['--- ACTIVATION AGEING QUEUE ---'],
    ['Bucket', 'Sales awaiting activation', 'Share (%)', 'Queue status'],
    ...model.ageing.buckets.map(b => [
      b.bucket,
      b.sales,
      b.shareOfUnactivated !== null ? Number(b.shareOfUnactivated.toFixed(2)) : null,
      b.isInvalidFuture ? 'INTEGRITY_CHECK_REQUIRED' : 'NORMAL_AGEING',
    ]),
    [],
    [`--- SEGMENT COMPARISON (${activeDimension.toUpperCase()}) ---`],
    ['Segment', 'Recorded sales', 'Recorded activations', 'Activation / sale ratio (%)', 'Source-recorded revenue', 'Revenue / sale', 'Sales missing revenue'],
    ...model.segments[activeDimension].map(r => [
      r.name,
      r.sales,
      r.activations,
      r.activationRatio !== null ? Number(r.activationRatio.toFixed(2)) : null,
      r.revenue,
      r.revenuePerSale !== null ? Number(r.revenuePerSale.toFixed(2)) : null,
      r.unrecordedRevenueSales,
    ]),
  ];

  downloadAnalysisCsv(
    filename,
    rows,
    {
      clientId: scope.clientId,
      startDate: scope.startDate,
      endDate: scope.endDate,
      filters: scope.filters,
      timezone: scope.timezone,
      dateBasis: 'Operational intake cohort',
      definitions: [
        'Complete sales & activation outcomes export.',
        model.methodology.revenueEvidence,
        model.methodology.segmentMethodology,
      ],
      validationStatus: 'NOT_VERIFIED',
    }
  );
}
