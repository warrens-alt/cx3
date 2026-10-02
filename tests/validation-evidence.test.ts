import test from 'node:test';
import assert from 'node:assert/strict';
import { validationUnavailable } from '../server/bigquery/reporting';
import { buildValidationReferenceCsv } from '../contracts/validationEvidence';

test('static comparison values are reference evidence and never current verification', () => {
  const evidence = validationUnavailable();
  assert.equal(evidence.status, 'NOT_VERIFIED');
  assert.equal(evidence.overallStatus, 'NOT_VERIFIED');
  assert.equal(evidence.evidenceKind, 'HISTORICAL_REFERENCE');
  assert.equal(evidence.independentVerificationStatus, 'UNAVAILABLE');
  assert.equal(evidence.currentWarehouseEvidenceStatus, 'UNAVAILABLE');
  assert.equal(evidence.tenant, null, 'Unrecorded historical scope must not become all tenants');
  assert.match(evidence.referenceScope, /do not describe the selected workspace/);
  assert.match(evidence.message, /Independent live reconciliation has not been performed/);
  assert.ok(evidence.metrics.length > 0);
  for (const metric of evidence.metrics) {
    assert.equal(metric.status, 'NOT_VERIFIED');
    assert.equal(metric.evidenceKind, 'HISTORICAL_REFERENCE');
    assert.match(metric.discrepancy, /^Unverified historical reference note:/);
  }
});

test('refreshing static evidence never generates a verification or reconciliation timestamp', context => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-02T08:00:00Z') });
  const earlier = validationUnavailable();
  context.mock.timers.setTime(new Date('2026-10-03T09:00:00Z').valueOf());
  const later = validationUnavailable();
  assert.equal(earlier.verifiedAt, null);
  assert.equal(earlier.reconciledAt, null);
  assert.deepEqual(later, earlier);
});

test('reference CSV carries real statuses, missing timestamps and evidence boundaries', () => {
  const evidence = validationUnavailable();
  const csv = buildValidationReferenceCsv(evidence);
  const lines = csv.split('\n');
  assert.equal(lines.length, evidence.metrics.length + 1);
  assert.match(lines[0], /"Validation status","Overall validation status","Verified at","Reconciled at"/);
  for (const line of lines.slice(1)) {
    assert.match(line, /"HISTORICAL_REFERENCE"/);
    assert.match(line, /"NOT_VERIFIED","NOT_VERIFIED","",""/);
    assert.match(line, /"UNAVAILABLE","UNAVAILABLE"$/);
    assert.doesNotMatch(line, /"VERIFIED"|EVIDENCE_CHECKED|2026-10-/);
  }
});

test('reference CSV preserves zero, missing values and quoted notes without inventing measurements', () => {
  const evidence = validationUnavailable();
  evidence.metrics = [{ ...evidence.metrics[0], metric: 'Quoted "metric", reference', rawBigQuery: 0, semanticModel: null, discrepancy: 'Reference "only"' }];
  const csv = buildValidationReferenceCsv(evidence);
  assert.match(csv, /"Quoted ""metric"", reference","HISTORICAL_REFERENCE","0","Not measured"/);
  assert.match(csv, /"Reference ""only"""/);
});
