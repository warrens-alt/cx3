/** Historical comparison fields are reference material, never a live validation run. */
export interface ValidationReferenceMetric {
  metric: string;
  rawBigQuery: number | string | null;
  semanticModel: number | string | null;
  apiPayload: number | string | null;
  uiRendered: number | string | null;
  status: 'NOT_VERIFIED';
  evidenceKind: 'HISTORICAL_REFERENCE';
  discrepancy: string;
  grain: string;
}

export interface ValidationReferenceEvidence {
  status: 'NOT_VERIFIED';
  overallStatus: 'NOT_VERIFIED';
  evidenceKind: 'HISTORICAL_REFERENCE';
  message: string;
  chain: string;
  verifiedAt: null;
  reconciledAt: null;
  tenant: null;
  referenceScope: string;
  independentVerificationStatus: 'UNAVAILABLE';
  currentWarehouseEvidenceStatus: 'UNAVAILABLE';
  metrics: ValidationReferenceMetric[];
}

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

/** Export the same evidence boundary and statuses shown in Validation evidence. */
export function buildValidationReferenceCsv(data: ValidationReferenceEvidence): string {
  const headers = [
    'Metric', 'Evidence kind', 'Raw BigQuery reference', 'Semantic model reference',
    'API payload reference', 'UI rendered reference', 'Validation status',
    'Overall validation status', 'Verified at', 'Reconciled at',
    'Reference note (unverified)', 'Analytical grain', 'Reference scope',
    'Independent verification status', 'Current warehouse evidence status',
  ];
  const rows = data.metrics.map(metric => [
    metric.metric, metric.evidenceKind, metric.rawBigQuery ?? 'Not measured',
    metric.semanticModel ?? 'Not measured', metric.apiPayload ?? 'Not measured',
    metric.uiRendered ?? 'Not measured', metric.status, data.overallStatus,
    data.verifiedAt, data.reconciledAt, metric.discrepancy, metric.grain,
    data.referenceScope, data.independentVerificationStatus, data.currentWarehouseEvidenceStatus,
  ]);
  return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
}
