import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTHORITATIVE_METRICS } from '../contracts/metricRegistry';
import { adaptDailyTrends, dailyTrendAudit } from '../src/features/overview/components/PerformanceTrend';
import { resultState } from '../src/shared/evidence/auditPresentation';

test('Command trend audit counts observed daily values including zero without summing a population', () => {
  const points = adaptDailyTrends([{ date: '2026-09-01', leads: 100 }, { date: '2026-09-02', leads: 0 }, { date: '2026-09-03' }]);
  const audit = dailyTrendAudit(points, 'leads');
  assert.equal(audit.value, 2);
  assert.equal(audit.unit, 'daily observations');
  assert.equal(resultState(audit.value), 'Observed');
  assert.equal(audit.metricId, 'fetched_leads');
  assert.ok(AUTHORITATIVE_METRICS[audit.metricId!]);
  assert.equal(audit.dimensions?.[0].state, 'observed');
  assert.equal(audit.anatomy?.secondary?.find(item => item.key === 'unavailable')?.value, 1);
  assert.match(audit.definition?.grain || '', /per lead capture date/);
  assert.match(audit.definition?.meaning || '', /not a summed lead population/);
});

test('Command trend audit retains unavailable series and excludes invalid numeric values', () => {
  const points = adaptDailyTrends([{ date: '2026-09-01', revenue: null }, { date: '2026-09-02', revenue: NaN }, { date: '2026-09-03' }]);
  const audit = dailyTrendAudit(points, 'revenue');
  assert.equal(audit.value, null);
  assert.equal(resultState(audit.value), 'Unavailable');
  assert.equal(audit.dimensions?.[0].state, 'unavailable');
  assert.equal(audit.anatomy?.secondary?.find(item => item.key === 'unavailable')?.value, 3);
  assert.equal(dailyTrendAudit([], 'leads').value, null);
});

test('Command revenue audit uses an explicit series definition without inventing a registry identity', () => {
  const audit = dailyTrendAudit(adaptDailyTrends([{ date: '2026-09-01', revenue: 0 }, { date: '2026-09-02', revenue: 23.5 }]), 'revenue');
  assert.equal(audit.value, 2);
  assert.equal(audit.metricId, undefined);
  assert.match(audit.definition?.grain || '', /recorded revenue aggregate per lead capture date/);
  assert.match(audit.definition?.limitations?.join(' ') || '', /does not establish billing, collected cash/);
  assert.equal(audit.dimensions?.[1].state, 'not_verified');
});
