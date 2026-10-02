import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import OutcomeStrip from '../src/features/overview/components/OutcomeStrip';
import { concentrationRows } from '../src/workspaces/command/ConcentrationPanel';
import { navigationTarget } from '../src/lib/presentation';
import { reportLocalScopeError, reportingFilters } from '../src/lib/reportingScope';
import { getRouteItem, BUSINESS_AREAS } from '../src/app/routeManifest';

test('Command renders eight lifecycle positions with unavailable qualification/routing and literal observed zero', () => {
  const data = { kpis: { fetchedLeads: 100, qualifiedLeads: null, deliveredLeads: null, dialledLeads: 20, contactedLeads: 0, saleLeads: 3, activatedLeads: 0, deliveryRate: null, dialRate: null, contactRate: 0, leadToSaleRate: 3, activationRate: 0 }, comparison: null, dailyTrends: [] } as any;
  const original = JSON.stringify(data);
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(OutcomeStrip, { data, isAdmin: false, includeUnavailableStages: true, onInspect() {} })));
  assert.equal((html.match(/<article/g) || []).length, 8);
  assert.equal((html.match(/No authoritative stage population supplied/g) || []).length, 2);
  assert.match(html, /Qualified/); assert.match(html, /Routed/);
  assert.match(html, /Inspect evidence: Right-party contact \(RPC\)">0</);
  assert.doesNotMatch(html, /NaN|Infinity/);
  assert.equal(JSON.stringify(data), original);
});

test('concentration keeps missing counts unknown and accepts explicit zero without deriving rates', () => {
  const lifecycle = { segments: { vendor: [{ key: 'Missing', fetched: null }, { key: 'Zero', fetched: 0 }, { key: 'Observed', fetched: 4 }] }, unsupportedDimensions: [] } as any;
  const before = JSON.stringify(lifecycle);
  assert.deepEqual(concentrationRows(lifecycle, 'vendor').map(row => [row.key, row.value]), [['Observed', 4], ['Zero', 0], ['Missing', null]]);
  assert.deepEqual(concentrationRows({ ...lifecycle, unsupportedDimensions: ['vendor'] }, 'vendor'), []);
  assert.equal(JSON.stringify(lifecycle), before);
});

test('six primary workspaces retain every legacy identity and separate administration', () => {
  assert.deepEqual(BUSINESS_AREAS.filter(area => area.id !== 'settings').map(area => area.name), ['Command', 'Journey', 'Operations', 'Investigate', 'Commercial', 'Evidence']);
  for (const [old, next] of [['/overview','/command'],['/funnel','/journey'],['/contact-strategy','/operations/contact'],['/reports','/evidence/releases'],['/reconciliation','/commercial/reconciliation'],['/warehouse','/evidence/warehouse']]) {
    assert.equal(getRouteItem(old)?.path, next);
  }
});

test('release navigation preserves exact dates/filters and frozen identity without carrying private records', () => {
  const source = '?clientId=tenant&startDate=2026-09-01&endDate=2026-09-02&vendor=A&release=frozen&search=PRIVATE&leadId=PRIVATE';
  for (const path of ['/reports', '/evidence/releases', '/evidence/vendors', '/reconciliation', '/commercial/reconciliation']) {
    const target = navigationTarget(path, '/evidence/releases', source);
    const query = new URLSearchParams(target.search);
    assert.equal(query.get('release'), 'frozen'); assert.equal(query.get('vendor'), 'A');
    assert.equal(query.get('startDate'), '2026-09-01'); assert.equal(query.get('endDate'), '2026-09-02');
    assert.equal(query.has('search'), false); assert.equal(query.has('leadId'), false);
    assert.equal(reportLocalScopeError(target.search), null);
  }
  const operational = new URLSearchParams(navigationTarget('/command','/evidence/releases',source).search);
  assert.equal(operational.get('vendor'), 'A'); assert.equal(operational.get('startDate'), '2026-09-01'); assert.equal(operational.has('release'), false);
  const unsupported = navigationTarget('/evidence/releases','/command','?grade=A&startDate=2026-09-01&endDate=2026-09-02');
  assert.equal(new URLSearchParams(unsupported.search).get('grade'), 'A');
  assert.throws(() => reportingFilters({ grade: { operator: 'equals', value: 'A' } }), /do not support the grade filter/);
});
