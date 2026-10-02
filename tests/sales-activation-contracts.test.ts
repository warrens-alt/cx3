import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  adaptSalesActivationData,
  CANONICAL_AGEING_BUCKETS,
  formatWorkspaceCurrency,
} from '../src/features/sales/model/salesActivationAdapter';
import type { SalesActivationData } from '../src/lib/offernetClient';
import {
  exportSegmentAnalysis,
  exportAgeingAnalysis,
  exportSalesActivationWorkbook,
} from '../src/features/sales/model/salesActivationExport';

test('sales-activation adapter: preserves independent sales and activation counts without assuming subset', () => {
  const mockData: SalesActivationData = {
    reconciliation: {
      totalSales: 100,
      billableSales: 80,
      salesWithRecordedRevenue: 85,
      unbilledSales: 15,
      unrecordedRevenueSales: 0,
      totalActivations: 70,
      activationRate: 70.0,
      realizedRevenue: 150000,
      avgTimeToSale: '2.5h',
      avgTimeToActivation: '3.2d',
      medianTimeToSale: '1.2h',
      medianTimeToActivation: '2.0d',
    },
    maturationCurve: [],
    maturationStatus: 'UNAVAILABLE',
    maturationReason: 'Activation maturation is withheld until event-level activation joins are independently validated.',
    byVendor: [
      { vendor: 'Partner A', sales: 60, activations: 45, revenue: 90000, unrecorded_revenue_sales: 0 },
      { vendor: 'Partner B', sales: 40, activations: 25, revenue: 60000, unrecorded_revenue_sales: 0 },
    ],
    bySource: [
      { dimension: 'source', segment: 'Google PPC', sales: 70, activations: 50, revenue: 105000, unrecorded_revenue_sales: 0 },
      { dimension: 'source', segment: 'Facebook', sales: 30, activations: 20, revenue: 45000, unrecorded_revenue_sales: 0 },
    ],
    byGrade: [
      { dimension: 'grade', segment: 'Tier 1', sales: 80, activations: 60, revenue: 120000, unrecorded_revenue_sales: 0 },
      { dimension: 'grade', segment: 'Tier 2', sales: 20, activations: 10, revenue: 30000, unrecorded_revenue_sales: 0 },
    ],
    activationAgeing: [
      { bucket: '0–3d', sales: 12 },
      { bucket: '4–7d', sales: 8 },
      { bucket: '8–14d', sales: 6 },
      { bucket: '15–30d', sales: 4 },
      { bucket: '30d+', sales: 3 },
      { bucket: 'Invalid future sale', sales: 2 },
    ],
    revenueEvidence: 'Recorded revenue is the sum of available source values.',
    segmentMethodology: 'One lead per segment.',
  };

  const adapted = adaptSalesActivationData(mockData, 'USD');
  assert.ok(adapted);

  // Independent counts preserved
  assert.equal(adapted.summary.totalSales, 100);
  assert.equal(adapted.summary.totalActivations, 70);
  assert.equal(adapted.summary.activationRatio, 70.0);

  // Critical: sales without activation is 35 (the sum of all ageing buckets: 12+8+6+4+3+2 = 35)
  // It is NOT 100 - 70 = 30!
  assert.equal(adapted.summary.salesWithoutActivation, 35);
  assert.equal(adapted.summary.validPendingActivation, 33); // 12+8+6+4+3
  assert.equal(adapted.summary.invalidFutureSales, 2);

  // Currency resolution: uses passed currency (USD), not hardcoded R/ZAR
  assert.equal(adapted.summary.currency, 'USD');
  assert.equal(formatWorkspaceCurrency(adapted.summary.realizedRevenue, adapted.summary.currency), '$ 150,000.00');

  // Revenue completeness preserved without fallback to billableSales
  assert.equal(adapted.summary.salesWithRecordedRevenue, 85);
  assert.equal(adapted.summary.unbilledSales, 15);
  assert.equal(adapted.summary.unrecordedRevenueSales, 0);
});

test('sales-activation adapter: empty/missing ageing yields unavailable backlog, never assumed zero', () => {
  const mockData: SalesActivationData = {
    reconciliation: {
      totalSales: 50,
      billableSales: 40,
      unbilledSales: 10,
      totalActivations: 30,
      activationRate: 60.0,
      realizedRevenue: 80000,
      avgTimeToSale: '1.0d',
      avgTimeToActivation: '2.0d',
    },
    maturationCurve: [],
    maturationStatus: 'UNAVAILABLE',
    maturationReason: 'Withheld',
    byVendor: [],
    // activationAgeing omitted
  };

  const adapted = adaptSalesActivationData(mockData, null);
  assert.ok(adapted);
  assert.equal(adapted.summary.salesWithoutActivation, null, 'missing ageing must yield null, not 0 or subtraction');
  assert.equal(adapted.summary.currency, '', 'unspecified currency must not default to ZAR');
  assert.equal(formatWorkspaceCurrency(1250, adapted.summary.currency), '1,250.00');
});

test('sales-activation adapter: preserves canonical chronological ageing bucket order and isolates future anomalies', () => {
  const mockData: SalesActivationData = {
    reconciliation: {
      totalSales: 20,
      billableSales: 20,
      unbilledSales: 0,
      totalActivations: 5,
      activationRate: 25.0,
      realizedRevenue: 30000,
      avgTimeToSale: '—',
      avgTimeToActivation: '—',
    },
    maturationCurve: [],
    maturationStatus: 'UNAVAILABLE',
    maturationReason: 'Withheld',
    byVendor: [],
    // Out-of-order backend response
    activationAgeing: [
      { bucket: '30d+', sales: 5 },
      { bucket: 'Invalid future sale', sales: 1 },
      { bucket: '0–3d', sales: 4 },
      { bucket: '15–30d', sales: 2 },
      { bucket: '4–7d', sales: 3 },
      { bucket: '8–14d', sales: 0 },
    ],
  };

  const adapted = adaptSalesActivationData(mockData);
  assert.ok(adapted);

  const bucketKeys = adapted.ageing.buckets.map(b => b.bucket);
  assert.deepEqual(bucketKeys, [
    '0–3d',
    '4–7d',
    '8–14d',
    '15–30d',
    '30d+',
    'Invalid future sale',
  ], 'ageing buckets must strictly follow canonical chronological order');

  const invalidBucket = adapted.ageing.buckets.find(b => b.bucket === 'Invalid future sale');
  assert.ok(invalidBucket?.isInvalidFuture, 'Invalid future sale bucket must be flagged as anomaly');
  assert.equal(invalidBucket?.sales, 1);
  assert.equal(adapted.ageing.hasInvalidFuture, true);
  assert.equal(adapted.ageing.validAwaiting, 14); // 4+3+0+2+5
  assert.equal(adapted.ageing.totalUnactivated, 15);
});

test('sales-activation adapter: segments maintain distinct dimensions without merging and compute revenue per sale', () => {
  const mockData: SalesActivationData = {
    reconciliation: {
      totalSales: 10,
      billableSales: 10,
      unbilledSales: 0,
      totalActivations: 8,
      activationRate: 80.0,
      realizedRevenue: 20000,
      avgTimeToSale: '—',
      avgTimeToActivation: '—',
    },
    maturationCurve: [],
    maturationStatus: 'UNAVAILABLE',
    maturationReason: 'Withheld',
    byVendor: [
      { vendor: '  Vendor Whitespace  ', sales: 6, activations: 5, revenue: 12000, unrecorded_revenue_sales: 1 },
      { vendor: 'Unrecorded', sales: 4, activations: 3, revenue: 8000, unrecorded_revenue_sales: 0 },
    ],
    bySource: [
      { dimension: 'source', segment: 'Direct', sales: 10, activations: 8, revenue: null, unrecorded_revenue_sales: 10 },
    ],
    byGrade: [],
  };

  const adapted = adaptSalesActivationData(mockData, 'ZAR');
  assert.ok(adapted);

  // Preserves exact whitespace and unrecorded casing
  assert.equal(adapted.segments.vendor[0].name, '  Vendor Whitespace  ');
  assert.equal(adapted.segments.vendor[0].sales, 6);
  assert.equal(adapted.segments.vendor[0].activations, 5);
  assert.equal(adapted.segments.vendor[0].revenuePerSale, 2000); // 12000 / 6
  assert.equal(adapted.segments.vendor[0].unrecordedRevenueSales, 1);

  // Null revenue handled cleanly
  assert.equal(adapted.segments.source[0].revenue, null);
  assert.equal(adapted.segments.source[0].revenuePerSale, null);
  assert.equal(adapted.segments.source[0].unrecordedRevenueSales, 10);
});

test('sales-activation adapter: maturation curve is withheld and displays explicit UNAVAILABLE reason', () => {
  const mockData: SalesActivationData = {
    reconciliation: {
      totalSales: 10,
      billableSales: 10,
      unbilledSales: 0,
      totalActivations: 5,
      activationRate: 50.0,
      realizedRevenue: 10000,
      avgTimeToSale: '—',
      avgTimeToActivation: '—',
    },
    maturationCurve: [],
    maturationStatus: 'UNAVAILABLE',
    maturationReason: 'Activation maturation is withheld until event-level activation joins are independently validated.',
    byVendor: [],
  };

  const adapted = adaptSalesActivationData(mockData);
  assert.ok(adapted);
  assert.equal(adapted.maturation.status, 'UNAVAILABLE');
  assert.ok(adapted.maturation.reason.includes('withheld'));
  assert.equal(adapted.maturation.curve.length, 0, 'must not fabricate synthetic D7/D14 curve');
});

test('sales-activation router & compatibility: Journey Outcomes mounts the canonical SalesActivationPage and preserves aliases', () => {
  const appRouterSource = fs.readFileSync(path.join(process.cwd(), 'src/app/AppRouter.tsx'), 'utf-8');
  const journeyWorkspaceSource = fs.readFileSync(path.join(process.cwd(), 'src/workspaces/journey/JourneyWorkspace.tsx'), 'utf-8');

  // Both public routes use the same lazy feature owner through the workspace lens.
  assert.ok(
    appRouterSource.includes('<Route path="/sales-activation" element={<JourneyWorkspace key={selectedClient} lens="outcomes" />} />'),
    'AppRouter must retain /sales-activation as the Outcomes lens with key={selectedClient}'
  );
  assert.ok(appRouterSource.includes('<Route path="/journey/outcomes" element={<JourneyWorkspace key={selectedClient} />} />'));

  // Verify /outcomes scope-preserving alias
  assert.ok(
    appRouterSource.includes('path="/outcomes" element={<ScopePreservingRedirect to="/sales-activation" replace />}'),
    'AppRouter must preserve /outcomes alias to /sales-activation'
  );

  assert.ok(journeyWorkspaceSource.includes("const Outcomes = lazy(() => import('../../features/sales/SalesActivationPage'))"));
  assert.match(journeyWorkspaceSource, /outcomes: Outcomes/);
  assert.match(journeyWorkspaceSource, /const active = lens \|\| location.pathname.split\('\/'\)\[2\]/);
  assert.match(journeyWorkspaceSource, /const Specialist = specialists\[active\]/);
  assert.match(journeyWorkspaceSource, /Specialist \? <Specialist \/>/);
});
