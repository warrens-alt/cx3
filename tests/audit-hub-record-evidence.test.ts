import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import { AUTHORITATIVE_METRICS } from '../contracts/metricRegistry';
import { metricsDependentOnSource, metricDefinitionEvidence, sourceObservationEvidence } from '../src/features/trust/sourceMetricEvidence';
import { pinnedAuditEvidence, pinnedAuditScope } from '../src/features/investigation/pinnedAuditEvidence';
import type { InvestigationModel } from '../src/features/investigation/investigationModel';
import { buildScopeSearch, auditDestination, canShareAuditScope } from '../src/shared/evidence/auditPresentation';
import { buildLedgerTimeline } from '../src/features/leadLedger/timeline';
import { recordEventAuditEvidence } from '../src/features/leadLedger/recordAuditEvidence';
import LedgerFieldCoverage from '../src/features/leadLedger/LedgerFieldCoverage';

const model: InvestigationModel = { type: 'exception', label: 'Awaiting first dial', drill: 'awaiting-first-dial', drillValue: '', metric: '', clientId: 'tenant-a', clientLabel: 'Tenant A', startDate: '2026-09-01', endDate: '2026-09-30', filters: { vendor: { operator: 'in', values: ['A', 'B'] } }, segments: [{ key: 'segmentSource', label: 'Source', value: 'Narrow source' }, { key: 'segmentGrade', label: 'Grade', value: 'A' }], validationStatus: 'NOT_VERIFIED', dateBasis: 'Lead capture cohort', countingGrain: 'Distinct lead' };
const pin = { kind: 'metric' as const, label: 'Awaiting first dial', value: '214 leads', definition: 'The supplied case population.', provenance: '/api/analytics/offernet/exceptions', identifier: 'awaiting-first-dial', scope: model };

test('source dependencies use exact declared logical roles and never manufacture unregistered relationships', () => {
  assert.deepEqual(metricsDependentOnSource('calls').map(metric => metric.id), Object.values(AUTHORITATIVE_METRICS).filter(metric => metric.source.split('.')[0] === 'calls' || metric.dependencies.includes('calls')).map(metric => metric.id));
  assert.deepEqual(metricsDependentOnSource('diallerRealtime'), []);
  assert.deepEqual(metricsDependentOnSource('activationLifecycle'), []);
  assert.equal(metricsDependentOnSource('leads').length, Object.keys(AUTHORITATIVE_METRICS).length);
});

test('metric definition audit supplies metadata without inventing a scoped value or reconciliation', () => {
  const content = metricDefinitionEvidence(AUTHORITATIVE_METRICS.dialled_leads, { clientId: model.clientId, startDate: model.startDate, endDate: model.endDate, filters: model.filters });
  assert.equal(content.value, null);
  assert.deepEqual(content.trace?.map(node => node.type), ['source', 'field', 'normalization', 'qualification', 'metric']);
  assert.equal(content.trace?.at(-1)?.state, 'unavailable');
  assert.equal(content.dimensions?.find(item => item.key === 'scope')?.state, 'unavailable');
  assert.equal(content.dimensions?.find(item => item.key === 'reconciliation')?.state, 'not_verified');
  assert.equal(content.recordDrill, undefined);
  assert.equal(content.dependencies?.inputs.some(input => input.available !== undefined), false);
});

test('source audit preserves tenant-wide observation grain and measured zero independently of cohort scope', () => {
  const content = sourceObservationEvidence({ key: 'leads', label: 'Ledger', status: 'OBSERVED', table: 'p.d.ledger', latestRecordAt: null, ageHours: 0, rowCount: 0, detail: 'Timestamp unavailable.' }, 'tenant-a');
  assert.equal(content.value, 0);
  assert.deepEqual(content.scope, { clientId: 'tenant-a', narrowing: {} });
  assert.match(content.definition?.dateBasis || '', /independent of the selected capture cohort/);
  assert.equal(content.dimensions?.find(item => item.key === 'coverage')?.state, 'unavailable');
  assert.equal(content.dimensions?.find(item => item.key === 'reconciliation')?.state, 'not_verified');
  assert.equal(content.trace?.find(node => node.type === 'display')?.state, 'presentation_consistent');
  assert.equal(content.trace?.some(node => node.type === 'reconciliation'), false);
});

test('pinned metric audits preserve exact original tenant, dates, filters and case narrowing after context changes', () => {
  const content = pinnedAuditEvidence(pin);
  const params = new URL(auditDestination('/lead-explorer?drill=awaiting-first-dial', '?clientId=new-tenant&startDate=2026-10-01&drill=other&segmentVendor=Other', content.scope), 'https://scope.invalid').searchParams;
  assert.equal(params.get('clientId'), 'tenant-a');
  assert.equal(params.get('startDate'), '2026-09-01');
  assert.equal(params.get('endDate'), '2026-09-30');
  assert.deepEqual(JSON.parse(params.get('filters')!), model.filters);
  assert.equal(params.get('drill'), 'awaiting-first-dial');
  assert.equal(params.get('segmentSource'), 'Narrow source');
  assert.equal(params.get('segmentGrade'), 'A');
  assert.equal(params.has('segmentVendor'), false);
  assert.equal(params.has('leadId'), false);
  assert.equal(content.value, '214 leads');
  assert.deepEqual(content.recordDrill, { drill: 'awaiting-first-dial' });
  assert.equal(content.dimensions?.find(item => item.key === 'reconciliation')?.state, 'not_verified');
});

test('pinned private search remains exact locally and unavailable for shareable navigation', () => {
  const scope = pinnedAuditScope({ ...model, search: 'private-record-search' });
  const query = buildScopeSearch(scope);
  assert.equal(new URLSearchParams(query).get('search'), 'private-record-search');
  assert.equal(canShareAuditScope(query), false);
  assert.equal(canShareAuditScope(buildScopeSearch(pinnedAuditScope(model))), true);
  const content = pinnedAuditEvidence({ ...pin, kind: 'lead', identifier: 'PRIVATE-LEAD-ID' });
  assert.equal(content.recordDrill, undefined);
  assert.equal(buildScopeSearch(content.scope).includes('PRIVATE-LEAD-ID'), false);
});

test('breakdown pins cannot broaden their displayed segment into a whole-case record drill', () => {
  for (const kind of ['driver', 'segment', 'lead', 'timeline-event'] as const) {
    assert.equal(pinnedAuditEvidence({ ...pin, kind, identifier: 'vendor:extra-segment' }).recordDrill, undefined);
  }
});

test('unavailable pinned display values remain unavailable while their exact original text is retained', () => {
  for (const value of ['Unavailable', 'Unavailable%', 'Unavailable contribution', 'Timestamp unavailable']) {
    const content = pinnedAuditEvidence({ ...pin, value });
    assert.equal(content.value, value);
    assert.equal(content.trace?.find(node => node.key === 'result')?.state, 'unavailable');
    assert.equal(content.trace?.find(node => node.key === 'display')?.state, 'unavailable');
  }
  assert.equal(pinnedAuditEvidence({ ...pin, value: '0%' }).trace?.find(node => node.key === 'result')?.state, 'observed');
});

test('schema coverage uses actual API availability and leaves populated counts unavailable', () => {
  const html = renderToStaticMarkup(React.createElement(LedgerFieldCoverage, { coverage: { source: 'p.d.ledger', available: ['Lead ID', 'Fetched', 'HLC RPC'], missing: ['HLC Delivered', 'HLC First Call Date'], compatible: false, richViewEnabled: false } }));
  assert.match(html, /<th scope="col">Field<\/th>/);
  assert.match(html, /Returned source schema availability/);
  assert.match(html, /Returned missing field/);
  assert.match(html, /No full-population field coverage measurement/);
  assert.match(html, /data-state="mapped"/);
  assert.doesNotMatch(html, /100%|confidence score|populated rows/);
});

test('selected record audit reuses real milestones and supplied qualification without manufacturing event times', () => {
  const row = { lead_id: 'PRIVATE-LEAD', fetched: '2026-09-28T09:00:00Z', delivered_time: '2026-09-28T10:00:00Z', first_call_time: '2026-09-28T09:30:00Z', dialled: false, sale: true };
  const journey = buildLedgerTimeline(row, Date.parse('2026-10-01T00:00:00Z'));
  const call = journey.milestones.find(event => event.kind === 'call')!;
  const content = recordEventAuditEvidence(row, call, journey, 'NOT_VERIFIED', pinnedAuditScope(model));
  assert.equal(content.value, '2026-09-28T09:30:00.000Z');
  assert.equal(content.trace?.find(node => node.type === 'qualification')?.value, 'Excluded from qualified progression');
  assert.equal(content.dimensions?.find(item => item.key === 'chronology')?.state, 'partial');
  assert.equal(content.recordDrill, undefined);
  assert.equal(buildScopeSearch(content.scope).includes('PRIVATE-LEAD'), false);
  const sale = journey.milestones.find(event => event.kind === 'sale')!;
  const untimed = recordEventAuditEvidence(row, sale, journey, 'NOT_VERIFIED');
  assert.equal(untimed.value, 'Recorded · timestamp unavailable');
  assert.equal(untimed.trace?.find(node => node.type === 'display')?.value, 'Recorded · untimed');
  assert.equal(untimed.trace?.find(node => node.type === 'qualification')?.state, 'unavailable');
});

test('new hub, pin and record audit presentation does not load or infer analytical evidence', () => {
  for (const path of ['src/features/trust/components/MetricEvidenceHub.tsx', 'src/features/trust/sourceMetricEvidence.ts', 'src/features/investigation/pinnedAuditEvidence.ts', 'src/features/leadLedger/recordAuditEvidence.ts', 'src/features/leadLedger/LedgerFieldCoverage.tsx']) {
    assert.doesNotMatch(fs.readFileSync(path, 'utf8'), /\bfetch\(|useQuery\(|Date\.now\(|new Date\(|localStorage/);
  }
});
