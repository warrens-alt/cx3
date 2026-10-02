import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SalesOutcomeMap from '../src/features/sales/components/SalesOutcomeMap';
import CommercialEvidenceMap from '../src/features/commercial/CommercialEvidenceMap';

const model = {
  summary: {
    totalSales: 570,
    totalActivations: 0,
    activationRatio: 0,
    salesWithoutActivation: 570,
    validPendingActivation: 570,
    invalidFutureSales: 0,
    realizedRevenue: null,
    salesWithRecordedRevenue: 525,
    unbilledSales: 0,
    unrecordedRevenueSales: 45,
    currency: 'ZAR',
  },
  ageing: { buckets: [], totalUnactivated: 570, validAwaiting: 570, invalidFuture: 0, hasInvalidFuture: false },
  segments: { vendor: [], source: [], grade: [] },
  timing: { avgTimeToSale: '3.3h', avgTimeToActivation: '—', medianTimeToSale: '2.4h', medianTimeToActivation: '—' },
  maturation: { status: 'UNAVAILABLE', reason: 'Not independently validated', curve: [] },
  methodology: { revenueEvidence: 'Recorded evidence', segmentMethodology: 'Observed', timezone: 'Africa/Johannesburg', dateBasis: 'Operational intake cohort' },
} as any;

test('sales outcome map preserves independent populations and measured zero', () => {
  const html = renderToStaticMarkup(React.createElement(SalesOutcomeMap, { model, onInspect: () => {} }));
  for (const text of ['Recorded sales', '570', 'Recorded activations', '>0<', 'Awaiting activation evidence', 'Sales with recorded revenue', '525', '45 missing']) {
    assert.ok(html.includes(text), text);
  }
  assert.match(html, /does not imply that every population is a nested transition/);
  assert.doesNotMatch(html, /totalSales\s*-\s*totalActivations/);
});

test('commercial evidence map distinguishes available, incomplete and unavailable', () => {
  const html = renderToStaticMarkup(React.createElement(CommercialEvidenceMap, { items: [
    { label: 'Marketing activity', state: 'available', detail: 'Measured activity exists.' },
    { label: 'Recorded operational revenue', state: 'incomplete', detail: 'Missing financial values remain.' },
    { label: 'Profitability / P&L', state: 'unavailable', detail: 'No approved rate-card evidence.' },
  ] }));
  assert.match(html, /data-state="available"/);
  assert.match(html, /data-state="incomplete"/);
  assert.match(html, /data-state="unavailable"/);
  assert.match(html, /No approved rate-card evidence/);
});

test('sales and commercial pages mount visual maps without changing data hooks', () => {
  const sales = fs.readFileSync('src/features/sales/SalesActivationPage.tsx', 'utf8');
  const commercial = fs.readFileSync('src/pages/CommercialIntelligence.tsx', 'utf8');
  assert.match(sales, /<SalesOutcomeMap/);
  assert.match(sales, /useSalesActivationModel\(\)/);
  assert.match(commercial, /<CommercialEvidenceMap/);
  assert.match(commercial, /useOperationalData\('commercial'/);
  assert.match(commercial, /fetchCommercial/);
});

test('commercial evidence states use existing returned evidence only', () => {
  const commercial = fs.readFileSync('src/pages/CommercialIntelligence.tsx', 'utf8');
  assert.match(commercial, /baseline\.mediaSpend != null/);
  assert.match(commercial, /baseline\.revenue != null/);
  assert.match(commercial, /attribution\?\.status === 'AVAILABLE'/);
  assert.match(commercial, /budget is never substituted/);
  assert.match(commercial, /Profitability \/ P&L/);
});

test('new visual CSS is scoped, responsive and keeps table evidence readable', () => {
  const css = fs.readFileSync('src/styles/salesCommercialVisuals.css', 'utf8');
  for (const selector of ['.cx-sales-page', '.cx-commercial-page', '.cx-sales-evidence-map', '.cx-commercial-evidence-map']) {
    assert.ok(css.includes(selector));
  }
  assert.match(css, /position:sticky/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.doesNotMatch(css, /https?:|@import|url\(/);
});

test('stylesheet is loaded after the established visual system', () => {
  const main = fs.readFileSync('src/main.tsx', 'utf8');
  const base = main.indexOf("import './styles/reporting.css';");
  const phase = main.indexOf("import './styles/salesCommercialVisuals.css';");
  assert.ok(base >= 0 && phase > base);
});
