import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSavedInvestigationDraft, parseSavedInvestigationDefinition, SAVED_INVESTIGATION_VERSION, type SavedInvestigationDraft, type SavedInvestigationDefinition } from '../contracts/savedAnalysis';
import { buildSavedInvestigationDraft, savedInvestigationPath } from '../src/features/investigation/savedInvestigationModel';
import type { InvestigationModel } from '../src/features/investigation/investigationModel';

const draft = (): SavedInvestigationDraft => ({
  version: SAVED_INVESTIGATION_VERSION, report: 'investigation', name: 'Delivered population',
  scope: { tenantId: 'tenant-a', startDate: '2026-09-01', endDate: '2026-09-30', dateBasis: 'intake_cohort', countingGrain: 'lead', filters: { vendor: { operator: 'equals', value: 'Vendor & Co' }, source: { operator: 'equals', value: 'Paid:Social / α' }, medium: { operator: 'equals', value: 'CPC' }, grade: { operator: 'equals', value: 'A' } } },
  investigation: { drill: 'funnel-loss', drillValue: 'delivered-to-dialled', metric: 'dialRate', segmentVendor: 'BLC', segmentSource: 'Paid:Social / α', segmentGrade: 'A', segmentLeadAge: '24h+' },
  release: { mode: 'current_observations', releaseId: null },
});
const definition = (input = draft()): SavedInvestigationDefinition => ({ ...input, id: 'saved-1', ownerSubject: 'owner-a', createdAt: '2026-10-02T08:00:00.000Z', updatedAt: '2026-10-02T08:00:00.000Z', revision: 1 });
const model = (): InvestigationModel => ({ type: 'exception', label: 'Awaiting first dial', drill: 'awaiting-first-dial', drillValue: '', metric: '', clientId: 'tenant-a', clientLabel: 'Tenant A', startDate: '2026-09-01', endDate: '2026-09-30', filters: { vendor: { operator: 'in', values: ['Vendor & Co'] } }, segments: [], validationStatus: 'NOT_VERIFIED', dateBasis: 'intake_cohort', countingGrain: 'lead' });
const params = () => new URLSearchParams({ clientId: 'tenant-a', startDate: '2026-09-01', endDate: '2026-09-30', drill: 'awaiting-first-dial', vendor: 'Vendor & Co' });

test('saved definition round trip preserves every supported scope restriction and replaces the destination query', () => {
  const saved = parseSavedInvestigationDefinition(definition());
  const reopened = new URL(savedInvestigationPath(saved), 'https://app.invalid/lead-explorer?clientId=other&startDate=2025-01-01&search=PRIVATE&leadId=PRIVATE&vendor=Other&segmentSource=Other&page=8');
  assert.equal(reopened.pathname, '/investigate');
  assert.deepEqual(Object.fromEntries(reopened.searchParams), {
    clientId: 'tenant-a', startDate: '2026-09-01', endDate: '2026-09-30', filters: JSON.stringify(saved.scope.filters),
    drill: 'funnel-loss', drillValue: 'delivered-to-dialled', investigationMetric: 'dialRate', segmentVendor: 'BLC', segmentSource: 'Paid:Social / α', segmentGrade: 'A', segmentLeadAge: '24h+',
  });
  assert.deepEqual(JSON.parse(reopened.searchParams.get('filters')!), saved.scope.filters);
  for (const forbidden of ['ownerSubject', 'id', 'revision', 'search', 'leadId', 'vendor', 'page', 'release']) assert.equal(reopened.searchParams.has(forbidden), false, forbidden);
});

test('all-time and one-sided date scopes are saved as explicit open bounds and reopened without invented dates', () => {
  for (const [start, end] of [[null, null], ['2026-09-01', null], [null, '2026-09-30']] as const) {
    const current = { ...model(), startDate: start || '', endDate: end || '' };
    const url = params(); url.delete('startDate'); url.delete('endDate');
    if (start) url.set('startDate', start); if (end) url.set('endDate', end);
    const saved = buildSavedInvestigationDraft(current, url, 'Open cohort');
    assert.equal(saved.scope.startDate, start); assert.equal(saved.scope.endDate, end);
    const restored = new URL(savedInvestigationPath(definition(saved)), 'https://app.invalid');
    assert.equal(restored.searchParams.get('startDate'), start); assert.equal(restored.searchParams.get('endDate'), end);
    assert.equal(restored.searchParams.get('drill'), 'awaiting-first-dial');
  }
});

test('save canonicalizes supported singleton filters and matching vendor aliases without changing their scope', () => {
  const current = model();
  current.filters = { partner: { operator: 'in', values: [' Vendor & Co '] }, ror_partner: { operator: 'equals', value: 'Vendor & Co' }, source: { operator: 'equals', value: 'Paid:Social / α' }, grade: { operator: 'in', values: ['A'] } };
  const url = params(); url.delete('vendor'); url.set('partner', 'Vendor & Co'); url.set('filters', JSON.stringify(current.filters));
  const saved = buildSavedInvestigationDraft(current, url, 'Matched scope');
  assert.deepEqual(saved.scope.filters, { vendor: { operator: 'equals', value: 'Vendor & Co' }, source: { operator: 'equals', value: 'Paid:Social / α' }, grade: { operator: 'equals', value: 'A' } });
  assert.equal(Object.hasOwn(saved.scope.filters, 'partner'), false);
});

test('privacy and schema violations at every persistence layer are rejected rather than stripped', () => {
  const changes: Array<[string, (value: any) => void]> = [
    ['top-level search', value => { value.search = 'PRIVATE'; }], ['top-level record', value => { value.record = { lead_id: 'PRIVATE' }; }],
    ['owner injection', value => { value.ownerSubject = 'someone-else'; }], ['identifier injection', value => { value.id = 'someone-elses-id'; }],
    ['scope private ID', value => { value.scope.leadId = 'PRIVATE'; }], ['identity filter', value => { value.scope.filters.lead_id = { operator: 'equals', value: 'PRIVATE' }; }],
    ['nested filter secret', value => { value.scope.filters.vendor.search = 'PRIVATE'; }], ['nested filter alternate values', value => { value.scope.filters.vendor.values = ['OTHER']; }],
    ['investigation selection', value => { value.investigation.selectedLead = 'PRIVATE'; }], ['investigation search', value => { value.investigation.search = 'PRIVATE'; }],
    ['release evidence', value => { value.release.records = [{ lead_id: 'PRIVATE' }]; }], ['local notes', value => { value.conclusion = 'PRIVATE'; }],
    ['local tray', value => { value.items = [{ kind: 'lead', identifier: 'PRIVATE' }]; }], ['result certification', value => { value.validationStatus = 'VERIFIED'; }],
    ['unknown filter', value => { value.scope.filters.unrecognized = { operator: 'equals', value: 'x' }; }],
  ];
  for (const [label, mutate] of changes) { const input: unknown = structuredClone(draft()); mutate(input); assert.throws(() => parseSavedInvestigationDraft(input), { status: 422 }, label); }
  const persisted: any = definition(); persisted.scope.filters.vendor.credentials = 'PRIVATE';
  assert.throws(() => parseSavedInvestigationDefinition(persisted), { status: 422 });
});

test('saved definitions reject invalid population, metric, date, release and revision semantics', () => {
  const cases: Array<[string, (value: any) => void]> = [
    ['unknown version', value => { value.version = 'future'; }], ['missing tenant', value => { delete value.scope.tenantId; }], ['empty tenant', value => { value.scope.tenantId = ''; }],
    ['invalid date', value => { value.scope.startDate = '2026-02-30'; }], ['reversed window', value => { value.scope.startDate = '2026-10-01'; }], ['implicit open date', value => { value.scope.startDate = ''; }],
    ['other date basis', value => { value.scope.dateBasis = 'activity'; }], ['other grain', value => { value.scope.countingGrain = 'call'; }],
    ['unknown predicate', value => { value.investigation.drill = 'constructor'; }], ['missing predicate value', value => { delete value.investigation.drillValue; }],
    ['orphan predicate value', value => { delete value.investigation.drill; }], ['extra exception value', value => { value.investigation = { drill: 'one-call-only', drillValue: 'made-up' }; }],
    ['unknown stage', value => { value.investigation = { drill: 'funnel-stage', drillValue: 'qualified' }; }], ['invalid segment dimension', value => { value.investigation = { drill: 'lifecycle-segment', drillValue: 'lead_id:PRIVATE' }; }],
    ['unsupported age', value => { value.investigation.segmentLeadAge = '1–3h'; }], ['unsupported metric', value => { value.investigation.metric = 'privateRecordCount'; }],
    ['multivalue filter', value => { value.scope.filters.vendor = { operator: 'in', values: ['A', 'B'] }; }], ['all sentinel', value => { value.scope.filters.vendor.value = 'all vendors'; }],
    ['frozen release', value => { value.release = { mode: 'pinned_release', releaseId: 'release-1' }; }], ['release ID on live view', value => { value.release.releaseId = 'release-1'; }],
  ];
  for (const [label, mutate] of cases) { const input = structuredClone(draft()); mutate(input); assert.throws(() => parseSavedInvestigationDraft(input), { status: 422 }, label); }
  for (const invalid of [{ revision: 0 }, { revision: 1.5 }, { updatedAt: '2026-10-01T00:00:00.000Z' }, { createdAt: '2026-02-30T00:00:00.000Z' }]) assert.throws(() => parseSavedInvestigationDefinition({ ...definition(), ...invalid }), { status: 422 });
});

test('draft creation never broadens private, duplicate, conflicting or unsupported current scope', () => {
  for (const key of ['search', 'leadId', 'lead_id', 'consumerId', 'consumer-id', 'transaction_id', 'selectedLeadId']) {
    const url = params(); url.set(key, 'PRIVATE'); assert.throws(() => buildSavedInvestigationDraft(model(), url, 'Unsafe'), /private|identifier/i, key);
  }
  assert.throws(() => buildSavedInvestigationDraft({ ...model(), search: 'PRIVATE' }, params(), 'Unsafe'), /private|identifier/i);
  for (const key of ['clientId', 'startDate', 'filters', 'drill', 'drillValue', 'investigationMetric', 'segmentVendor', 'segmentSource', 'segmentGrade', 'segmentLeadAge']) {
    const url = params(); url.append(key, url.get(key) || 'first'); if (url.getAll(key).length === 1) url.append(key, 'second');
    assert.throws(() => buildSavedInvestigationDraft(model(), url, 'Ambiguous'), /repeated/i, key);
  }
  const conflicts = [
    { ...model(), filters: { vendor: { operator: 'equals', value: 'A' }, partner: { operator: 'equals', value: 'B' } } },
    { ...model(), filters: { vendor: { operator: 'in', values: ['A', 'B'] } } },
    { ...model(), filters: { grade: { operator: 'not_equals', value: 'D' } } },
    { ...model(), filters: { consumer_id: { operator: 'equals', value: 12 } } },
  ];
  for (const current of conflicts) assert.throws(() => buildSavedInvestigationDraft(current as InvestigationModel, params(), 'Unsafe'));
  const conflictingUrl = params(); conflictingUrl.set('filters', JSON.stringify({ vendor: { operator: 'equals', value: 'Other' } }));
  assert.throws(() => buildSavedInvestigationDraft(model(), conflictingUrl, 'Conflict'), /conflicting/i);
  const extraFilterField = params(); extraFilterField.set('filters', JSON.stringify({ vendor: { operator: 'equals', value: 'Vendor & Co', secret: 'PRIVATE' } }));
  assert.throws(() => buildSavedInvestigationDraft(model(), extraFilterField, 'Unsafe'), /unsupported/i);
  const wrongClient = params(); wrongClient.set('clientId', 'tenant-b'); assert.throws(() => buildSavedInvestigationDraft(model(), wrongClient, 'Mismatch'), /workspace/i);
  const wrongDate = params(); wrongDate.set('startDate', '2026-09-02'); assert.throws(() => buildSavedInvestigationDraft(model(), wrongDate, 'Mismatch'), /dates/i);
});

test('safe definition projection excludes local lead pins, search-free notes and observed result values', () => {
  const current = { ...model(), selectedLead: 'PRIVATE', items: [{ identifier: 'PRIVATE' }], conclusion: 'PRIVATE', populationCount: 900, validationStatus: 'VERIFIED' };
  const saved = buildSavedInvestigationDraft(current, params(), 'Population view');
  assert.deepEqual(Object.keys(saved).sort(), ['investigation', 'name', 'release', 'report', 'scope', 'version']);
  assert.doesNotMatch(JSON.stringify(saved), /PRIVATE|900|VERIFIED/);
  assert.equal(saved.release.mode, 'current_observations');
});
