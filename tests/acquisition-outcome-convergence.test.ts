import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import SalesOutcomeMap from '../src/features/sales/components/SalesOutcomeMap';
import ActivationAgeing from '../src/features/sales/components/ActivationAgeing';
import SalesSegmentComparison from '../src/features/sales/components/SalesSegmentComparison';
import CommercialEvidenceBridge from '../src/features/commercial/CommercialEvidenceBridge';
import AcquisitionFlow from '../src/features/campaigns/AcquisitionFlow';
import VendorComparison from '../src/features/vendors/components/VendorComparison';
import { lifecyclePresentation } from '../src/shared/visuals/lifecyclePresentation';
import type { AdaptedSalesActivation } from '../src/features/sales/model/salesActivationAdapter';
import type { CampaignData, CommercialData, VendorQualityData } from '../src/lib/offernetClient';

const documentFor = (element: React.ReactElement) => new JSDOM(renderToStaticMarkup(element)).window.document;
const salesModel = (summary = {}): AdaptedSalesActivation => ({
  summary: { totalSales: 10, totalActivations: 14, activationRatio: 140, salesWithoutActivation: 3, validPendingActivation: 2, invalidFutureSales: 1,
    realizedRevenue: null, salesWithRecordedRevenue: null, unbilledSales: 0, unrecordedRevenueSales: 10, currency: 'ZAR', ...summary },
  ageing: { buckets: [
    { bucket: '0–3d', sales: 2, shareOfUnactivated: 66.7, isInvalidFuture: false, description: '0 to 3 completed days', drillSupported: false },
    { bucket: 'Invalid future sale', sales: 1, shareOfUnactivated: 33.3, isInvalidFuture: true, description: 'Future timestamp', drillSupported: false },
  ], totalUnactivated: 3, validAwaiting: 2, invalidFuture: 1, hasInvalidFuture: true },
  segments: { vendor: [], source: [], grade: [] }, timing: { avgTimeToSale: '—', avgTimeToActivation: '—', medianTimeToSale: '—', medianTimeToActivation: '—' },
  maturation: { status: 'UNAVAILABLE', reason: 'Unavailable', curve: [] }, methodology: { revenueEvidence: 'Recorded evidence', segmentMethodology: 'Independent counts', dateBasis: 'Intake' },
});
const commercial = (overrides = {}): CommercialData => ({
  status: 'PARTIAL', reason: 'Costs unavailable', currency: 'ZAR',
  baseline: { mediaSpend: 0, revenue: null, cpl: 0, cpc: null, cpm: null } as CommercialData['baseline'],
  media: { status: 'PARTIAL', reason: 'Missing costs', spendSourceColumn: 'spend', spendSourceTable: 'marketing', platformLeads: 5, platformClicks: 8, platformImpressions: 80 },
  pAndLBreakdown: [], ...overrides,
});
const campaign = (summary = {}, extra = {}): CampaignData => ({
  summary: { spend: null, impressions: 1000, clicks: 100, outboundClicks: 40, leads: 8, ctr: 10, clickToLeadRate: 20, reach: null, frequency: null, outboundCtr: 4, cpc: null, cpm: null, cpl: null, ...summary },
  campaigns: [], attribution: { status: 'ACTIVE' }, ...extra,
});

test('sales branches remain independent when activation population exceeds sales', () => {
  const doc = documentFor(React.createElement(SalesOutcomeMap, { model: salesModel(), onInspect: () => {} }));
  assert.match(doc.body.textContent!, /Independent evidence views/);
  assert.match(doc.body.textContent!, /140.0% activation \/ sale ratio/);
  assert.equal(doc.querySelectorAll('.cx-outcome-branches > li').length, 3);
  assert.equal(doc.querySelectorAll('.cx-outcome-branch-node').length, 4);
  assert.equal(doc.querySelector('.cx-outcome-branch-anchor strong')?.textContent, '10');
  assert.match(doc.querySelectorAll('.cx-outcome-branch-node')[1].getAttribute('style')!, /--cx-data-activation/);
  assert.equal(doc.querySelectorAll('[data-state="unavailable"]').length, 1);
});

test('ageing bars offer keyboard buttons and future anomalies are outside the chronological distribution', () => {
  const doc = documentFor(React.createElement(ActivationAgeing, { model: salesModel(), onInspectBucket: () => {}, onExportAgeing: () => {} }));
  const histogram = doc.querySelector('.cx-evidence-bar-list')!;
  assert.equal(histogram.querySelectorAll('button').length, 1);
  assert.doesNotMatch(histogram.textContent!, /future/i);
  assert.match(doc.querySelector('.cx-sales-ageing-anomaly')?.textContent!, /Future sale timestamps.*1/);
  assert.equal(doc.querySelector('.cx-sales-ageing-anomaly')?.getAttribute('data-state'), 'anomaly');
  assert.equal(doc.querySelector('details')?.hasAttribute('open'), false);
});

test('missing queue data never renders adapter empty buckets as an observed zero histogram', () => {
  const doc = documentFor(React.createElement(ActivationAgeing, { model: salesModel({ salesWithoutActivation: null }), onInspectBucket: () => {}, onExportAgeing: () => {} }));
  assert.match(doc.body.textContent!, /Activation queue evidence unavailable/);
  assert.equal(doc.querySelector('.cx-evidence-bar-list'), null);
  assert.equal(doc.querySelector('table'), null);
});

test('segment comparison exposes supplied metric choices and keeps exact evidence collapsed', () => {
  const doc = documentFor(React.createElement(SalesSegmentComparison, { model: salesModel(), activeDimension: 'vendor', onSelectDimension: () => {}, search: '', onSearchChange: () => {}, showAllInChart: false, onToggleShowAllInChart: () => {}, onInspectRow: () => {}, onExportSegment: () => {} }));
  assert.deepEqual([...doc.querySelectorAll('select option')].map(option => option.getAttribute('value')), ['sales', 'activations', 'activationRatio', 'revenuePerSale']);
  assert.match(doc.querySelector('details summary')?.textContent!, /exact segment evidence/);
});

test('commercial bridge preserves observed zero, missing revenue and non-calculable profitability', () => {
  const doc = documentFor(React.createElement(CommercialEvidenceBridge, { data: commercial(), currency: 'ZAR' }));
  assert.match(doc.body.textContent!, /Observed zero/);
  assert.match(doc.body.textContent!, /Revenue evidence unavailable/);
  assert.match(doc.body.textContent!, /Not calculable/);
  assert.equal(doc.querySelector('.cx-commercial-not-calculable strong')?.textContent, 'Not calculable');
  assert.equal(doc.querySelector('.cx-attribution-boundary')?.getAttribute('data-state'), 'unavailable');
  assert.equal(doc.querySelectorAll('.cx-commercial-missing-inputs small').length, 4);
});

test('available attribution with no matched keys is never presented as an approved match', () => {
  const attribution = { status: 'AVAILABLE', reason: 'No matches', rows: [], summary: { totalSpend: 0, matchedSpend: 0, unmatchedMarketingSpend: 0, matchedSpendSharePct: null, matchedKeys: 0, marketingOnlyKeys: 1, operationsOnlyKeys: 2 } };
  const doc = documentFor(React.createElement(CommercialEvidenceBridge, { data: commercial({ attribution }) }));
  assert.equal(doc.querySelector('.cx-attribution-boundary')?.getAttribute('data-state'), 'unverified');
  assert.match(doc.body.textContent!, /No matched keys recorded/);
  assert.doesNotMatch(doc.body.textContent!, /Approved matched keys/);
});

test('partially matched commercial evidence reports coverage without treating the full cohort as matched', () => {
  const attribution = { status: 'AVAILABLE', rows: [], summary: { matchedKeys: 3, marketingOnlyKeys: 1, operationsOnlyKeys: 0 } };
  const doc = documentFor(React.createElement(CommercialEvidenceBridge, { data: commercial({ attribution }) }));
  assert.equal(doc.querySelector('.cx-attribution-boundary')?.getAttribute('data-state'), 'partial');
  assert.match(doc.body.textContent!, /3 matched keys · 1 marketing only · 0 operations only/);
  assert.match(doc.body.textContent!, /Approved matching keys only/);
});

test('campaign flow preserves the returned outbound-click denominator and never invents a linking ratio', () => {
  const doc = documentFor(React.createElement(AcquisitionFlow, { data: campaign() }));
  const nodes = [...doc.querySelectorAll('.cx-platform-flow > li')];
  assert.equal(nodes.length, 4);
  assert.match(nodes[2].textContent!, /Outbound clicks40.*20.0%.*events \/ outbound clicks/);
  assert.equal(nodes[1].querySelector('.cx-platform-transition b'), null);
  assert.equal(doc.querySelector('.cx-attribution-boundary')?.getAttribute('data-state'), 'unverified');
});

test('campaign missing counts remain unavailable and active source mapping does not override unavailable detail attribution', () => {
  const doc = documentFor(React.createElement(AcquisitionFlow, { data: campaign({ impressions: null, ctr: null, outboundClicks: null }, { funnelStatus: { status: 'UNAVAILABLE', reason: 'Campaign grain is not matched' } }) }));
  assert.equal(doc.querySelectorAll('.cx-platform-flow > li').length, 3);
  assert.match(doc.querySelector('.cx-platform-flow > li')?.textContent!, /Unavailable/);
  assert.equal(doc.querySelector('.cx-attribution-boundary')?.getAttribute('data-state'), 'unavailable');
  assert.match(doc.body.textContent!, /Campaign grain is not matched/);
});

test('vendor stage matrix uses canonical colours and preserves missing, zero and outside-scale rates', () => {
  const vendors = [{ vendor: 'Vendor A', leads: 24, deliveryRate: 80, dialRate: 0, contactRate: null, saleRate: 25, activationRate: 140, medianFirstDial: '—', callsPerLead: null, invalidRate: null }] as VendorQualityData['vendors'];
  const doc = documentFor(React.createElement(VendorComparison, { vendors, onSelectVendor: () => {} }));
  const matrix = doc.querySelector('.cx-vendor-lifecycle-matrix')!;
  assert.match(matrix.innerHTML, /var\(--cx-data-delivered\)/);
  assert.match(matrix.innerHTML, /var\(--cx-data-sales\)/);
  assert.equal(matrix.querySelectorAll('[data-state="zero"]').length, 1);
  assert.equal(matrix.querySelectorAll('[data-state="unknown"]').length, 1);
  assert.equal(matrix.querySelectorAll('[data-state="outside-scale"]').length, 1);
  assert.match(matrix.textContent!, /140.0%.*Outside 0–100% scale/);
  assert.equal(lifecyclePresentation.activated.color, 'var(--cx-data-activation)');
});
