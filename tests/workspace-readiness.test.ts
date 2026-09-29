import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseWorkspaceEvidence, sourcePresentation, sourcePurpose, observedTimestamp, servicePresentation, diagnosticLatency } from '../src/lib/workspaceReadiness';

const checkedAt = '2026-09-29T06:00:00.000Z';
function fixture() {
  return { success: true, metadata: { clientId: 'tenant-test' }, data: { generatedAt: checkedAt, sources: [
    { key: 'leads', label: 'Lead ledger', status: 'OBSERVED', rowCount: 12, missingTimestampRows: 2, latestRecordAt: '2026-09-28T08:00:00Z', table: 'private.table', detail: 'private diagnostic', private_key: 'do-not-forward' },
    { key: 'calls', label: 'Calls', status: 'EMPTY', rowCount: 0, missingTimestampRows: 0, latestRecordAt: null },
  ] } };
}

test('readiness uses returned workspace identity and an allowlisted evidence projection', () => {
  const report = parseWorkspaceEvidence(fixture(), 'tenant-test');
  assert.equal(report.clientId, 'tenant-test');
  assert.equal(report.checkedAt, checkedAt);
  assert.equal(report.sources[0].rowCount, 12);
  assert.equal(report.sources[1].rowCount, 0);
  assert.equal(report.sources[1].missingTimestampRows, 0);
  assert.equal(report.sources[1].latestRecordAt, null);
  assert.doesNotMatch(JSON.stringify(report), /private\.table|private diagnostic|private_key|do-not-forward/);
});

test('readiness rejects failed, absent or contradictory scope envelopes', () => {
  assert.throws(() => parseWorkspaceEvidence({ ...fixture(), success: false }, 'tenant-test'));
  assert.throws(() => parseWorkspaceEvidence({ data: fixture().data }, 'tenant-test'));
  assert.throws(() => parseWorkspaceEvidence(fixture(), 'other-tenant'));
  assert.throws(() => parseWorkspaceEvidence({ ...fixture(), data: { ...fixture().data, clientId: 'other-tenant' } }, 'tenant-test'));
  assert.throws(() => parseWorkspaceEvidence({ ...fixture(), metadata: { clientId: 'other-tenant' }, data: { ...fixture().data, clientId: 'tenant-test' } }, 'tenant-test'));
});

test('readiness refuses repeated keys, malformed lists and invented check times', () => {
  const base = fixture();
  assert.throws(() => parseWorkspaceEvidence({ ...base, data: { ...base.data, sources: [base.data.sources[0], base.data.sources[0]] } }, 'tenant-test'));
  assert.throws(() => parseWorkspaceEvidence({ ...base, data: { ...base.data, sources: null } }, 'tenant-test'));
  assert.throws(() => parseWorkspaceEvidence({ ...base, data: { ...base.data, generatedAt: 'not-a-date' } }, 'tenant-test'));
});

test('missing, unsafe and malformed counts remain unknown rather than measured zero', () => {
  for (const value of [null, undefined, -1, 1.5, NaN, Infinity, '99', 9007199254740992]) {
    const base = fixture();
    const report = parseWorkspaceEvidence({ ...base, data: { ...base.data, sources: [{ ...base.data.sources[0], rowCount: value, missingTimestampRows: value }] } }, 'tenant-test');
    assert.equal(report.sources[0].rowCount, null);
    assert.equal(report.sources[0].missingTimestampRows, null);
  }
});

test('source availability distinguishes empty, missing configuration, denied access and incomplete evidence', () => {
  assert.equal(sourcePresentation('OBSERVED').label, 'Source readable');
  assert.match(sourcePresentation('OBSERVED').explanation, /does not certify/);
  assert.equal(sourcePresentation('EMPTY').label, 'Source empty');
  assert.equal(sourcePresentation('UNCONFIGURED').label, 'Not configured');
  assert.equal(sourcePresentation('MAPPING_REQUIRED').label, 'Mapping required');
  assert.equal(sourcePresentation('ACCESS_DENIED').label, 'Access denied');
  assert.equal(sourcePresentation('SCHEMA_MISMATCH').label, 'Incomplete evidence');
  assert.equal(sourcePresentation('UNAVAILABLE').label, 'Evidence unavailable');
  assert.equal(sourcePresentation('UNRECOGNISED_SUCCESS').label, 'Not verified');
});

test('event timestamps are not ingestion freshness and future events remain anomalous', () => {
  assert.equal(observedTimestamp(null, checkedAt), 'No usable event timestamp');
  assert.match(observedTimestamp('2026-09-30T06:00:00Z', checkedAt), /Future event timestamp/);
  assert.match(observedTimestamp('2026-09-28T06:00:00Z', checkedAt), /UTC/);
  assert.match(sourcePurpose('diallerRealtime'), /historical calls are not live/);
  assert.match(sourcePurpose('marketing'), /observed spend and approved matching keys/);
});

test('diagnostic status never infers success from a key and zero latency is preserved', () => {
  assert.equal(servicePresentation('Error').label, 'Check failed');
  assert.equal(servicePresentation('Not Configured').label, 'Not configured');
  assert.equal(servicePresentation(undefined).label, 'Not checked');
  assert.equal(servicePresentation({ hasKey: true }).label, 'Not checked');
  assert.equal(diagnosticLatency(0), '0 ms');
  assert.equal(diagnosticLatency(817), '817 ms');
  for (const value of [null, undefined, -1, NaN, Infinity, '817']) assert.equal(diagnosticLatency(value), 'Unavailable');
});

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('readiness is mounted once on active routes without adding a new route or warehouse API', () => {
  const router = read('src/app/AppRouter.tsx'), panel = read('src/shared/reporting/AnalyticsReadinessPanel.tsx');
  assert.equal((router.match(/<AnalyticsReadinessPanel\s*\/>/g) || []).length, 1);
  assert.match(panel, /route\?\.scopePolicy !== 'operational'/);
  assert.match(panel, /get\('mode'\) === 'demo'/);
  assert.match(panel, /fetchWorkspaceEvidence, expanded/);
  assert.match(panel, /new URLSearchParams\(\{ clientId \}\)/);
  assert.doesNotMatch(panel, /startDate:|endDate:|process\.env|setInterval/);
});

test('settings uses identity-scoped query state and cannot retain earlier successful diagnostics after a failure', () => {
  const settings = read('src/pages/Settings.tsx');
  assert.match(settings, /useOperationalData\('workspace-service-diagnostics'/);
  assert.match(settings, /!query\.loading && !query\.error && query\.data\?\.clientId === selectedClient/);
  assert.doesNotMatch(settings, /Verified \(817ms\)|Provisioned & Active|setGoogleStatus|hasKey\s*\?/);
  assert.match(settings, /No previous success is being presented as current/);
});

test('commercial investigations cannot substitute sale rate for revenue, costs or attributed counts', () => {
  const commercial = read('src/pages/CommercialIntelligence.tsx');
  assert.match(commercial, /useState<'spend' \| 'cpl' \| null>/);
  assert.doesNotMatch(commercial, /setRootMetric\('leadToSaleRate'\)|setRootMetric\('fetchedLeads'\)/);
  assert.match(commercial, /Revenue decomposition is not available/);
  assert.match(commercial, /item\.metric &&/);
  assert.match(commercial, /!canCompareMedia \|\| !item\.available/);
  assert.match(commercial, /data\?\.currency \|\| clientConfig\?\.currency/);
  assert.match(commercial, /row\.hasMarketing && row\.hasOperations/);
});
