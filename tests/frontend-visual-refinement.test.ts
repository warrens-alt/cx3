import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import UnifiedMetricCard from '../src/components/UnifiedMetricCard';
import OutcomeStrip from '../src/features/overview/components/OutcomeStrip';
import PerformanceTrend, { adaptDailyTrends } from '../src/features/overview/components/PerformanceTrend';
import AttentionList from '../src/features/overview/components/AttentionList';

function render(node: React.ReactNode) {
  return renderToStaticMarkup(React.createElement(MemoryRouter, {
    initialEntries: ['/overview?clientId=default_tenant&startDate=2026-09-22&endDate=2026-09-28'],
  }, node));
}
const data = {
  kpis: { fetchedLeads: 1280, deliveredLeads: 1100, saleLeads: 180, activatedLeads: 0,
    deliveryRate: 85.9, leadToSaleRate: 14.1, activationRate: 0 },
  comparison: null,
} as React.ComponentProps<typeof OutcomeStrip>['data'];

test('refined outcome cards preserve numbers, complete labels and the four series', () => {
  const html = render(React.createElement(OutcomeStrip, { data, isAdmin: true, onInspect: () => {} }));
  for (const text of ['1,280', '1,100', '180', 'Fetched leads', 'Delivered leads', 'Recorded sales', 'Activations']) assert.ok(html.includes(text));
  for (const series of ['fetched', 'delivered', 'sales', 'activation']) assert.ok(html.includes(`data-series="${series}"`));
  assert.equal((html.match(/cx-outcome-icon/g) || []).length, 4);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /class="[^"]*cx-outcome-value[^>]+>0<\/button>/);
  assert.ok(!html.includes('NaN'));
});

test('outcome presentation offers audit-first buttons to administrators and viewers', () => {
  for (const isAdmin of [true, false]) {
    const html = render(React.createElement(OutcomeStrip, { data, isAdmin, onInspect: () => {} }));
    assert.doesNotMatch(html, /href="\/lead-explorer\?/);
    assert.equal((html.match(/aria-label="Inspect evidence:/g) || []).length, 4);
    assert.equal((html.match(/>Inspect evidence</g) || []).length, 0);
    assert.equal((html.match(/cx-metric-primary/g) || []).length, 4);
  }
});

test('refined common metric cards distinguish zero, unavailable and loading', () => {
  const zero = render(React.createElement(UnifiedMetricCard, { label: 'Observed zero', value: 0 }));
  const absent = render(React.createElement(UnifiedMetricCard, { label: 'Missing evidence', value: null }));
  const loading = render(React.createElement(UnifiedMetricCard, { label: 'Loading evidence', value: null, loading: true }));
  assert.match(zero, /class="cx-metric-value[^>]+>0<\/strong>/);
  assert.match(absent, /class="cx-metric-value[^>]+>—<\/strong>/);
  assert.match(loading, /role="status"/);
  assert.doesNotMatch(loading, /cx-metric-value/);
});

test('long metric labels stay complete, escaped and not line-clamped', () => {
  const label = 'Recorded outcomes with incomplete downstream evidence <untrusted>';
  const html = render(React.createElement(UnifiedMetricCard, { label, value: null }));
  assert.ok(html.includes('Recorded outcomes with incomplete downstream evidence &lt;untrusted&gt;'));
  assert.doesNotMatch(html, /line-clamp|<untrusted>/);
});

test('trend tablist exposes linked panels and only the selected tab is tabbable', () => {
  const html = render(React.createElement(PerformanceTrend, { data: [] }));
  assert.equal((html.match(/role="tab"/g) || []).length, 3);
  assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
  assert.equal((html.match(/tabindex="0"/gi) || []).length, 1);
  assert.equal((html.match(/tabindex="-1"/gi) || []).length, 2);
  assert.match(html, /role="tabpanel"/);
  assert.match(html, /aria-controls=/);
  assert.match(html, /No daily trend data available in this scope/);
});

test('trend presentation leaves the existing adapter semantics and input data intact', () => {
  const rows = Object.freeze([Object.freeze({ date: '2026-09-28', fetchedLeads: 0, deliveredLeads: 2, revenue: null })]);
  const [point] = adaptDailyTrends(rows as any);
  assert.equal(point.leads, 0);
  assert.equal(point.delivered, 2);
  assert.equal(point.sales, undefined);
  assert.equal(point.revenue, null);
  assert.deepEqual(rows, [{ date: '2026-09-28', fetchedLeads: 0, deliveredLeads: 2, revenue: null }]);
});

test('attention presentation retains exact supplied counts and complete evidence detail', () => {
  const html = render(React.createElement(AttentionList, { isAdmin: false, items: [
    { id: 'test', title: 'A long evidence exception that must remain visible', detail: 'Calls exist but the latest source disposition is unavailable', value: 0, severity: 'high', path: '/exceptions' },
  ] }));
  assert.match(html, /A long evidence exception that must remain visible/);
  assert.match(html, /Calls exist but the latest source disposition is unavailable/);
  assert.doesNotMatch(html, /truncate/);
  assert.match(html, /data-severity="high"/);
});

test('canonical Overview styles stay scoped and preserve series, focus and reduced motion', () => {
  const css = fs.readFileSync('src/styles/product.css', 'utf8');
  const lateCss = fs.readFileSync('src/styles/visualRefinement.css', 'utf8');
  const chart = fs.readFileSync('src/features/overview/components/PerformanceTrend.tsx', 'utf8');
  for (const token of ['--cx-data-fetched', '--cx-data-delivered', '--cx-data-sales']) assert.ok(chart.includes(token));
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
  assert.match(css, /\.cx-app/);
  assert.doesNotMatch(lateCss, /\.cx-(?:outcome|change-rail|trend-|attention-)/);
  assert.doesNotMatch(css, /@import|https?:|url\(/);
  assert.match(chart, /connectNulls=\{true\}/);
  assert.match(chart, /isAnimationActive=\{false\}/);
});
