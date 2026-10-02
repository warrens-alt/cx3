import test from 'node:test';
import assert from 'node:assert/strict';
import { AnalyticsBigQueryClient } from '../server/bigquery/client';
import { getDataIntegrityAnalytics } from '../server/analytics/integrity/completeness';

const scope = { clientId: 'default_tenant', startDate: '2026-09-01', endDate: '2026-09-30', vendor: 'Scoped vendor' };
test('Data Confidence exposes all five canonical chronology populations, overlapping evidence and no certification score', async context => {
  context.mock.method(AnalyticsBigQueryClient.prototype, 'dataset', () => ({ table: () => ({ getMetadata: async () => [{ schema: { fields: [] } }] }) }) as any);
  context.mock.method(AnalyticsBigQueryClient.prototype, 'createQueryJob', async () => { throw new Error('Unexpected warehouse job in offline fixture'); });
  const queries: any[] = [];
  let counts: Record<string, number | null> = { delivery_before_capture: 1, first_dial_before_capture: 2, first_dial_before_delivery: 3, sale_before_capture: 0, activation_before_sale: 4 };
  context.mock.method(AnalyticsBigQueryClient.prototype, 'query', async (request: any) => {
    queries.push(request);
    if (request.query.includes('lead_quality AS (')) return [[{ total_leads: 10, out_of_order_timestamps: 5, ...counts }]] as any;
    return [[]] as any;
  });
  const result = await getDataIntegrityAnalytics(scope);
  const labels = ['Delivery Before Capture', 'First Dial Before Capture', 'First Dial Before Delivery', 'Sale Before Capture', 'Activation Before Sale'];
  assert.deepEqual(labels.map(label => result.checks.find(check => check.checkName === label)?.discrepancyCount), [1, 2, 3, 0, 4]);
  assert.equal(result.checks.find(check => check.checkName === 'Out-of-order Lifecycle Timestamps')?.discrepancyCount, 5, 'overlapping anomalies are not summed into a misleading total');
  assert.equal(result.checks.find(check => check.checkName === 'Sale Before Capture')?.status, 'HEALTHY', 'measured zero is retained');
  assert.equal(result.overallHealthScore, null);
  assert.equal(result.healthGrade, 'NOT_VERIFIED');
  assert.equal(result.validationStatus, 'NOT_VERIFIED');
  const query = queries.find(request => request.query.includes('lead_quality AS ('));
  assert.equal(query.params.vendor, 'Scoped vendor');
  assert.equal(query.params.startDate, scope.startDate);
  assert.match(query.query, /operational_leads AS/);
  for (const field of Object.keys(counts)) assert.ok(query.query.includes(`SELECT COUNTIF(${field}) FROM operational_leads`));
  assert.match(query.query, /SELECT COUNTIF\(is_dialled AND NOT has_disposition\) FROM operational_leads/);
  counts = { delivery_before_capture: null };
  const unavailable = await getDataIntegrityAnalytics(scope);
  for (const label of labels) {
    const check = unavailable.checks.find(check => check.checkName === label)!;
    assert.equal(check.discrepancyCount, null, label);
    assert.equal(check.status, 'UNAVAILABLE', label);
  }
});
