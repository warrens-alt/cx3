import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { reportingFilters, reportingScopeError, reportLocalScopeError } from '../src/lib/reportingScope';
import { validateReportResponse, createEvidenceReport, replayEvidenceReport } from '../src/lib/reportingClient';
import { reportDimensions, reportMetricInspector } from '../src/features/evidenceWorkspace/reportEvidenceModel';
import MetricAnatomy from '../src/shared/evidence/MetricAnatomy';
import { fixtureRelease, fixtureRepository, principal, request } from './reporting-fixtures';
import { executeReport } from '../server/reporting/service';

const result = () => executeReport(fixtureRepository().repository, principal, request);

test('report scope preserves exact inclusion values and refuses unsupported/private/operator scope', () => {
  assert.deepEqual(reportingFilters({ vendor: { operator: 'in', values: ['B', 'A', 'A'] }, source: { operator: 'equals', value: 'literal source' } }), { vendor: ['A', 'B'], source: ['literal source'] });
  for (const key of ['grade', 'lead_id', 'consumer_id', 'campaign']) assert.throws(() => reportingFilters({ [key]: { operator: 'equals', value: 'private' } }), /do not support/);
  assert.throws(() => reportingFilters({ vendor: { operator: 'not_equals', value: 'A' } }), /equality or inclusion/);
  assert.throws(() => reportingFilters({ source: { operator: 'in', values: [] } }), /equality or inclusion/);
});

test('report controls fail closed for missing release contract, invalid dates, unsupported metrics and filters', () => {
  const release = fixtureRelease();
  assert.equal(reportingScopeError(request, release), null);
  assert.match(reportingScopeError({ ...request, startDate: '' }, release)!, /explicit/);
  assert.match(reportingScopeError({ ...request, startDate: '2026-02-30' }, release)!, /Invalid/);
  assert.match(reportingScopeError(request, { ...release, execution: undefined })!, /no approved/);
  assert.match(reportingScopeError({ ...request, filters: { medium: ['m'] } }, release)!, /does not support/);
  assert.match(reportingScopeError({ ...request, metrics: ['sale_events'] }, release)!, /Choose metrics/);
  assert.match(reportingScopeError({ ...request, endDate: '2026-09-10' }, release)!, /beyond/);
});

test('private and unsupported investigation URL scope cannot silently broaden a report', () => {
  for (const key of ['search', 'sourceSearch', 'leadId', 'lead_id', 'consumer_id', 'transaction_id', 'selectedLeadId', 'selectedIDs', 'investigationMetric', 'drill', 'segmentVendor', 'segmentSource', 'snapshot', 'arbitrary']) assert.match(reportLocalScopeError(`?${key}=private` )!, /cannot apply/);
  assert.equal(reportLocalScopeError('?clientId=tenant_a&startDate=2026-09-01&release=release_fixture'), null);
});

test('client refuses cross-tenant, changed dates, filters and definition-mismatched result evidence', async () => {
  const report = await result();
  assert.equal(validateReportResponse(report, request, request.releaseId), report);
  assert.throws(() => validateReportResponse({ ...report, request: { ...report.request, tenantId: 'tenant_b' } }, request, request.releaseId), /workspace/);
  assert.throws(() => validateReportResponse({ ...report, request: { ...report.request, startDate: '2026-08-01' } }, request, request.releaseId), /scope/);
  assert.throws(() => validateReportResponse({ ...report, request: { ...report.request, filters: { vendor: ['outside'] } } }, request, request.releaseId), /filters/);
  assert.throws(() => validateReportResponse({ ...report, totals: [{ ...report.totals[0], evidence: { ...report.totals[0].evidence, definitionVersion: 'other' } }] }, request, request.releaseId), /evidence/);
});

test('client execution transmits explicit version/release and retains cancellation', async () => {
  const previous = globalThis.fetch; const report = await result(); const controller = new AbortController();
  try {
    globalThis.fetch = (async (url, init) => {
      assert.equal(url, '/api/reporting'); assert.equal(init?.signal, controller.signal);
      assert.deepEqual(JSON.parse(String(init?.body)), request);
      return new Response(JSON.stringify({ success: true, data: report }), { status: 200 });
    }) as typeof fetch;
    assert.equal((await createEvidenceReport(request, request.releaseId, controller.signal)).totals[0].value, '9007199254740993');
  } finally { globalThis.fetch = previous; }
});

test('exact metric anatomy preserves unsafe-number decimal strings and independent evidence states', async () => {
  const report = await result(), content = reportMetricInspector(report, report.totals[0]);
  const html = renderToStaticMarkup(React.createElement(MetricAnatomy, { model: content.anatomy! }));
  assert.ok(html.includes('9007199254740993')); assert.doesNotMatch(html, /9007199254740992/);
  assert.equal(content.recordDrill, undefined);
  const dimensions = reportDimensions(report, true);
  assert.equal(dimensions.find(item => item.key === 'reconciliation')?.state, 'not_verified');
  assert.equal(dimensions.find(item => item.key === 'business')?.state, 'not_verified');
  assert.equal(dimensions.find(item => item.key === 'reproduced')?.state, 'reproduced');
  const unavailable = reportMetricInspector(report, { ...report.totals[0], value: null, calculationStatus: 'UNAVAILABLE' });
  assert.equal(unavailable.dimensions?.find(item => item.key === 'source')?.state, 'unavailable');
});

test('client rejects malformed success and cross-tenant replay descriptors', async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({ success: false, data: {} }), { status: 200 })) as typeof fetch;
    await assert.rejects(() => createEvidenceReport(request, request.releaseId), /failed/);
    globalThis.fetch = (async () => new Response(JSON.stringify({ success: true, data: { contractVersion: 'cx.report-replay.1', status: 'MATCH', comparisonKind: 'IMMUTABLE_REPRODUCTION', reconciliationStatus: 'NOT_VERIFIED', original: { request: { tenantId: 'other' }, totals: [], groups: [] }, replayed: null } }), { status: 200 })) as typeof fetch;
    await assert.rejects(() => replayEvidenceReport(request.tenantId, 'synthetic'), /outside/);
  } finally { globalThis.fetch = previous; }
});

test('inherited versioned report views preserve exact values and never substitute total for an absent group', async () => {
  const { formatReportValue } = await import('../src/lib/reportPreflight');
  const { exactMovement, metricValue, pivotReportGroups } = await import('../src/lib/evidenceWorkspace');
  const report = await result();
  assert.equal(formatReportValue(report.totals[0]), '9,007,199,254,740,993');
  assert.equal(formatReportValue({ ...report.totals[0], unit: 'currency', value: '1234567890.123456789' }, 'ZAR'), 'R1,234,567,890.123456789');
  assert.equal(formatReportValue({ ...report.totals[0], value: null }), 'Unavailable');
  assert.equal(formatReportValue({ ...report.totals[0], value: '0' }), '0');
  assert.equal(exactMovement('9007199254740993', '9007199254740992'), '0.0');
  assert.equal(exactMovement('3', '2'), '50.0');
  assert.equal(exactMovement('1', '0'), null);
  assert.equal(metricValue(report, 'fetched_leads', 'missing vendor'), null);
  assert.equal(metricValue({ ...report, totals: [], groups: [{ ...report.totals[0], group: 'A' }] }, 'fetched_leads'), null);
  assert.deepEqual(pivotReportGroups({ ...report, request: { ...report.request, grouping: 'vendor' } }), []);
  assert.equal(reportMetricInspector(report, report.totals[0]).shareable, false);
});
