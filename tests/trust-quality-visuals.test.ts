import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import fs from 'node:fs';
import SourceEvidenceMatrix, { EvidenceStatus, sourceStatusTone } from '../src/features/trust/components/SourceEvidenceMatrix';
import IntegrityCheckComparison from '../src/features/trust/components/IntegrityCheckComparison';
import ExceptionWorkbench from '../src/features/trust/components/ExceptionWorkbench';
import VendorComparison, { rateIntensity } from '../src/features/vendors/components/VendorComparison';
import type { VendorQualityData, DataIntegrityData } from '../src/lib/offernetClient';
import type { ExceptionPopulation } from '../contracts/exceptionAnalytics';

const render = (node: React.ReactNode) => renderToStaticMarkup(React.createElement(MemoryRouter, null, node));
const vendor = (name: string, overrides = {}): VendorQualityData['vendors'][number] => ({
  vendor: name, leads: 18, deliveryRate: 75, dialRate: 30, contactRate: 0, saleRate: null, activationRate: 20,
  medianFirstDial: '8m', medianFirstDialSec: 480, callsPerLead: 1.2, invalidRate: 0, revenue: 0,
  directCost: null, deliveryCost: null, contribution: null, marginPct: null, ...overrides,
});
const exception: ExceptionPopulation = {
  id: 'test-exact', title: 'Unrecorded disposition', severity: 'high', count: 8,
  previousCount: null, absoluteChange: null, percentageChange: null, detail: 'Source feedback is not complete.',
  byVendor: [{ name: ' A / B ', count: 8 }], bySource: [{ name: '<source>', count: 8 }],
};

test('source matrix preserves returned zero, unknown, status and timestamp without a health score', () => {
  const sources = [{ key: 'test', label: 'Ledger', status: 'OBSERVED', table: 'project.dataset.table', latestRecordAt: '2026-09-28T00:00:00Z', ageHours: 0, rowCount: 0, detail: 'Ingestion not verified.' },
    { key: 'missing', label: 'Missing source', status: 'UNCONFIGURED', table: null, latestRecordAt: null, ageHours: null, rowCount: null, detail: 'Configure an approved source.' }];
  const html = render(React.createElement(SourceEvidenceMatrix, { sources }));
  assert.match(html, /<time dateTime="2026-09-28T00:00:00Z">2026-09-28T00:00:00Z<\/time>/);
  assert.equal((html.match(/class="cx-trust-number">0<\/td>/g) || []).length, 2);
  assert.match(html, /data-status="UNCONFIGURED"/);
  assert.match(html, /Not recorded/);
  assert.match(html, /not proof of a current feed/);
});

test('unknown source states are neutral, never silently treated as healthy', () => {
  assert.equal(sourceStatusTone('NEW_VENDOR_STATE'), 'neutral');
  assert.equal(sourceStatusTone('WARNING'), 'attention');
  assert.equal(sourceStatusTone('OBSERVED'), 'observed');
  assert.match(render(React.createElement(EvidenceStatus, { status: 'NEW_VENDOR_STATE' })), /New vendor state/);
  assert.match(render(React.createElement(EvidenceStatus, {})), /Not reported/);
});

test('missing sources and a measured empty source list are explicitly different', () => {
  assert.match(render(React.createElement(SourceEvidenceMatrix, { sources: undefined })), /not supplied/);
  assert.match(render(React.createElement(SourceEvidenceMatrix, { sources: [] })), /No source observations returned/);
});

test('check comparison retains zero and unknown counts and original arrays', () => {
  const checks: DataIntegrityData['checks'] = [
    { checkName: 'Not tested', category: 'Schema', status: 'UNKNOWN', evidence: 'untested', discrepancyCount: null, detail: 'Awaiting contract' },
    { checkName: 'No gaps', category: 'Identity', status: 'HEALTHY', evidence: 'id', discrepancyCount: 0, detail: 'Measured zero gaps' },
    { checkName: 'Measured gaps', category: 'Calls', status: 'WARNING', evidence: 'calls', discrepancyCount: 9, detail: 'Missing calls' },
  ];
  const before = JSON.stringify(checks);
  const html = render(React.createElement(IntegrityCheckComparison, { checks }));
  assert.equal(JSON.stringify(checks), before);
  assert.match(html, /data-state="unknown"/); assert.match(html, /data-state="zero"/);
  assert.match(html, /Selected check · Calls/); assert.match(html, /Missing calls/);
  assert.match(html, /Populations can overlap/);
});

test('exception investigation uses exact evidence href, preserves comparison absence and escapes input', () => {
  const href = '/lead-explorer?clientId=default_tenant&startDate=2026-09-28&drill=test-exact';
  const html = render(React.createElement(ExceptionWorkbench, { items: [exception], isAdmin: true, evidenceHref: id => { assert.equal(id, 'test-exact'); return href; } }));
  assert.match(html, /Inspect records/); assert.match(html, /drill=test-exact/);
  assert.match(html, /aria-pressed="true"/); assert.match(html, /Unavailable/);
  assert.match(html, /&lt;source&gt;/); assert.doesNotMatch(html, /<source>/);
});

test('viewer exception action retains safe caller-provided data integrity destination', () => {
  const html = render(React.createElement(ExceptionWorkbench, { items: [exception], isAdmin: false, evidenceHref: () => '/data-integrity?clientId=mtn' }));
  assert.match(html, /Open data integrity/); assert.doesNotMatch(html, /lead-explorer/);
});

test('empty exception response is not invented as a passing health score', () => {
  const html = render(React.createElement(ExceptionWorkbench, { items: [], isAdmin: false, evidenceHref: () => '/data-integrity' }));
  assert.match(html, /Select a returned exception/); assert.doesNotMatch(html, /All healthy|100% healthy/);
});

test('vendor matrix preserves independent rates, missing values and all ten original measures', () => {
  const html = render(React.createElement(VendorComparison, { vendors: [vendor('Long vendor / exact key')], onSelectVendor: () => {} }));
  for (const text of ['Delivery', 'Dial / delivered', 'RPC / dialled', 'Sale / RPC', 'Activation / sale', 'Median first dial', 'Calls / lead', 'Invalid', '8m', '1.2']) assert.ok(html.includes(text), text);
  assert.match(html, /data-state="zero"/); assert.match(html, /data-state="unknown"/);
  assert.match(html, /Filter to vendor Long vendor \/ exact key/);
});

test('vendor ordering is presentation-only and leaves incoming records unchanged', () => {
  const vendors = [vendor('Small', { leads: 3 }), vendor('Larger', { leads: 20 })];
  const before = JSON.stringify(vendors);
  const html = render(React.createElement(VendorComparison, { vendors, onSelectVendor: () => {} }));
  assert.equal(JSON.stringify(vendors), before);
  assert.ok(html.indexOf('Inspect Larger') < html.indexOf('Inspect Small'));
});

test('rate shading is fixed-scale and does not clamp or rewrite displayed out-of-range values', () => {
  assert.equal(rateIntensity(0), 0); assert.equal(rateIntensity(50), .5); assert.equal(rateIntensity(100), 1);
  for (const value of [null, undefined, NaN, Infinity, -1, 140]) assert.equal(rateIntensity(value), null);
  const html = render(React.createElement(VendorComparison, { vendors: [vendor('A', { activationRate: 140 })], onSelectVendor: () => {} }));
  assert.match(html, /140.0%/); assert.match(html, /Outside 0–100% scale/);
});

test('new visual components do not fetch, export, or own backend configuration', () => {
  for (const path of ['src/features/trust/components/SourceEvidenceMatrix.tsx', 'src/features/trust/components/IntegrityCheckComparison.tsx', 'src/features/trust/components/ExceptionWorkbench.tsx', 'src/features/vendors/components/VendorComparison.tsx']) {
    const source = fs.readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /\bfetch\(|useQuery\(|process\.env|localStorage|Date\.now\(/);
  }
});

test('page integrations retain existing data calls and exact vendor filter contract', () => {
  const vendorPage = fs.readFileSync('src/pages/VendorLeadQuality.tsx', 'utf8');
  assert.match(vendorPage, /setFilter\('vendor', \{ operator: 'in', values: \[vendor\] \}\)/);
  assert.match(vendorPage, /fetchVendorQuality/);
  const exceptions = fs.readFileSync('src/pages/Exceptions.tsx', 'utf8');
  assert.match(exceptions, /isAdmin \? recordLink\(id\) : scoped\('\/data-integrity'\)/);
  assert.match(exceptions, /fetchExceptions/); assert.match(exceptions, /ExportAnalysisButton/);
  const integrity = fs.readFileSync('src/pages/DataIntegrityIntelligence.tsx', 'utf8');
  assert.match(integrity, /fetchDataIntegrity/); assert.match(integrity, /<BlcLifecycleCard/);
});

test('trust styles contain accessible focus, responsive scroll and reduced motion without external assets', () => {
  const css = fs.readFileSync('src/styles/trustQualityVisuals.css', 'utf8');
  for (const rule of ['focus-visible', 'prefers-reduced-motion', 'position:sticky', 'overflow:auto', 'max-width:639px']) assert.ok(css.includes(rule));
  assert.doesNotMatch(css, /https?:|@import|url\(/);
});
