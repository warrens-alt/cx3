import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLeadEvidenceExport, LEAD_EVIDENCE_COLUMNS, LEAD_EVIDENCE_AUDIT_COLUMNS, INVESTIGATION_NARROWING_AUDIT_COLUMNS } from '../src/lib/analysisExport';

function evidence() {
  return {
    rows: [{ lead_id: 'L1', contacted: false, dialled: undefined, sale: null, activated: true, revenue: null,
      investigationReason: { code: 'AWAITING_FIRST_DIAL', label: 'Delivered · no recorded first dial', detail: 'Investigation narrowing: Vendor = A.' } }],
    totalCount: 1, limit: 50, offset: 0, clientId: 'mtn', startDate: '2026-09-01', endDate: '2026-09-30',
    filters: { vendor: { operator: 'equals', value: 'Global vendor' } }, search: 'record search', drill: 'awaiting-first-dial', drillValue: null,
    segmentVendor: 'A', segmentSource: 'Unrecorded', segmentGrade: null, segmentLeadAge: 'Undialled',
    timezone: 'Africa/Johannesburg', dateBasis: 'intake_cohort', definitionVersion: 'registry-version', metricId: 'awaiting-first-dial', countingGrain: 'lead',
    validationStatus: 'NOT_VERIFIED', generatedAt: '2026-10-02T12:00:00Z', sourceCutoff: null,
  };
}

test('record export preserves server inclusion evidence and independent global and additive scope', () => {
  const source = evidence();
  const exported = buildLeadEvidenceExport(source, { clientId: 'stale-client', filters: { vendor: 'stale' }, investigation: 'User display label' });
  assert.deepEqual(exported.headers, [...LEAD_EVIDENCE_COLUMNS, ...LEAD_EVIDENCE_AUDIT_COLUMNS, ...INVESTIGATION_NARROWING_AUDIT_COLUMNS]);
  const at = (header: string) => exported.rows[1][exported.headers.indexOf(header)];
  assert.equal(at('Scope client'), 'mtn');
  assert.equal(at('Filters'), JSON.stringify(source.filters));
  assert.equal(at('Investigation predicate'), 'awaiting-first-dial');
  assert.equal(at('Investigation vendor'), 'A');
  assert.equal(at('Investigation source'), 'Unrecorded');
  assert.equal(at('Investigation grade'), 'No narrowing');
  assert.equal(at('Investigation first-dial age'), 'Undialled');
  assert.equal(at('Applied search'), 'record search');
  assert.equal(at('Why included'), source.rows[0].investigationReason.label);
  assert.equal(at('Inclusion reason code'), 'AWAITING_FIRST_DIAL');
  assert.equal(at('Inclusion reason detail'), source.rows[0].investigationReason.detail);
  assert.equal(at('Dialled'), 'Unavailable');
  assert.equal(at('RPC'), 'No');
  assert.equal(at('Sale'), 'Unavailable');
  assert.equal(at('Activated'), 'Yes');
  assert.equal(at('Revenue'), null);
  assert.equal(at('Validation status'), 'NOT_VERIFIED');
  assert.deepEqual(exported.metadata.narrowing, { segmentVendor: 'A', segmentSource: 'Unrecorded', segmentGrade: null, segmentLeadAge: 'Undialled' });
  assert.equal(exported.metadata.filters.vendor.value, 'Global vendor');
});

test('missing export reason or narrowing remains unavailable and malformed returned evidence fails closed', () => {
  const source: any = evidence();
  delete source.segmentVendor;
  delete source.rows[0].investigationReason;
  const exported = buildLeadEvidenceExport(source);
  const at = (header: string) => exported.rows[1][exported.headers.indexOf(header)];
  assert.equal(at('Why included'), 'Unavailable');
  assert.equal(at('Investigation vendor'), 'Unavailable');
  assert.equal(exported.metadata.narrowing.segmentVendor, undefined);
  assert.throws(() => buildLeadEvidenceExport({ ...source, segmentVendor: ['A'] } as any), /segmentVendor/);
  assert.throws(() => buildLeadEvidenceExport({ ...source, rows: [{ lead_id: 'L1', investigationReason: { code: 'CODE' } }] }), /malformed returned inclusion reason/);
});

test('inclusion labels and narrowing use the existing formula-safe CSV serializer', () => {
  const source = evidence();
  source.segmentVendor = '=MALICIOUS()';
  source.rows[0].investigationReason.label = '=HYPERLINK("https://example.invalid")';
  const exported = buildLeadEvidenceExport(source);
  assert.ok(exported.csv.includes("'=MALICIOUS()"));
  assert.ok(exported.csv.includes("'=HYPERLINK"));
});
