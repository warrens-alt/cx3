import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptJourneyData } from '../src/features/journey/model/journeyAdapter';
import type { JourneyData } from '../src/features/journey/model/useJourneyModel';
import { buildDispositionExportRows, serializeCsv, type DispositionExportMetadata } from '../src/lib/analysisExport';
import { DISPOSITION_REPORT_VERSION, type DetailedDispositionRow } from '../contracts/vendorDispositions';
import { getRawLeads } from '../server/analytics/investigation/records';

test('adaptJourneyData: acceptance fixture separates independent stage totals from transition intersections', () => {
  // Acceptance fixture:
  // 10 fetched leads (lead_1 .. lead_10)
  // 8 delivered (lead_1 .. lead_8)
  // 7 dialled (lead_1 .. lead_6, lead_9) -> note lead_9 dialled without delivery
  // 6 in delivered-and-dialled (lead_1 .. lead_6)
  // 4 RPC (lead_1 .. lead_4)
  // 3 sales (lead_1, lead_2, lead_5) -> note lead_5 has sale without RPC
  // 2 in RPC-and-sale (lead_1, lead_2)
  // 2 activations (lead_1, lead_2)
  // 2 in sale-and-activation (lead_1, lead_2)

  const fixtureData: JourneyData = {
    velocity: {
      fetchToDelivery: '10s',
      deliveryToFirstDial: '20s',
      firstDialToContact: 'Unavailable',
      contactToSale: '30s',
      saleToActivation: '40s',
    },
    byVendor: [
      { vendor: 'VendorA', leads: 6, delivered: 5, dialled: 4, contacted: 3, sales: 2, activations: 1 },
      { vendor: 'VendorB', leads: 5, delivered: 4, dialled: 3, contacted: 2, sales: 2, activations: 1 },
      // Note: vendor rows sum to 11 leads (overlapping), establishing why summing byVendor rows is invalid!
    ],
    bySource: [],
    byGrade: [],
    lifecycle: {
      period: null,
      comparisons: {
        fetched: { current: 10, previous: null, kind: 'count', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        delivered: { current: 8, previous: null, kind: 'count', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        dialled: { current: 7, previous: null, kind: 'count', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        rpc: { current: 4, previous: null, kind: 'count', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        sales: { current: 3, previous: null, kind: 'count', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        activations: { current: 2, previous: null, kind: 'count', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        deliveryRate: { current: 80.0, previous: null, kind: 'rate', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        dialRate: { current: 87.5, previous: null, kind: 'rate', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        rpcRate: { current: 57.14, previous: null, kind: 'rate', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        saleRate: { current: 30.0, previous: null, kind: 'rate', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        activationRate: { current: 66.67, previous: null, kind: 'rate', absoluteChange: null, percentageChange: null, percentagePointChange: null },
      },
      transitions: [
        { from: 'Capture', to: 'Delivery', population: 10, converted: 8, lost: 2, conversionRate: 80.0, lossRate: 20.0, deteriorationPp: null, status: 'OBSERVED' },
        { from: 'Delivery', to: 'Dial', population: 8, converted: 6, lost: 2, conversionRate: 75.0, lossRate: 25.0, deteriorationPp: null, status: 'NON_NESTED' },
        { from: 'Dial', to: 'RPC', population: 7, converted: 4, lost: 3, conversionRate: 57.14, lossRate: 42.86, deteriorationPp: null, status: 'OBSERVED' },
        { from: 'RPC', to: 'Sale', population: 4, converted: 2, lost: 2, conversionRate: 50.0, lossRate: 50.0, deteriorationPp: null, status: 'NON_NESTED' },
        { from: 'Sale', to: 'Activation', population: 3, converted: 2, lost: 1, conversionRate: 66.67, lossRate: 33.33, deteriorationPp: null, status: 'OBSERVED' },
      ],
      largestLeakage: null,
      largestDeterioration: null,
      segments: {},
      priorSegments: {},
      rateContributions: {},
      velocity: { captureToDeliverySec: 10, deliveryToDialSec: 20, dialToSaleSec: 30, saleToActivationSec: 40 },
      validationStatus: 'NOT_VERIFIED',
      methodology: 'Test',
      unsupportedDimensions: [],
    },
  };

  const adapted = adaptJourneyData(fixtureData);

  // 1. Dialled stage must show 7, NOT 6 (which is transition converted)
  assert.equal(adapted.headline.dialledVolume, 7);
  const dialStage = adapted.stages.find(s => s.key === 'dialled');
  assert.ok(dialStage);
  assert.equal(dialStage.volume, 7);

  // 2. Recorded sales must show 3, NOT 2 (which is RPC-and-sale converted)
  assert.equal(adapted.headline.salesVolume, 3);
  const saleStage = adapted.stages.find(s => s.key === 'sales');
  assert.ok(saleStage);
  assert.equal(saleStage.volume, 3);

  // 3. Delivery -> Dial conversion must be 6/8 = 75%, not a ratio using preceding displayed intersection
  const delivToDial = adapted.transitions.find(t => t.from === 'Delivery' && t.to === 'Dial');
  assert.ok(delivToDial);
  assert.equal(delivToDial.population, 8);
  assert.equal(delivToDial.converted, 6);
  assert.equal(delivToDial.conversionRate, 75.0);
  assert.equal(dialStage.conversionRate, 75.0);

  // 4. All 6 stages have explicit typed keys and names
  assert.deepEqual(adapted.stages.map(s => s.key), ['fetched', 'delivered', 'dialled', 'rpc', 'sales', 'activated']);
  assert.deepEqual(adapted.stages.map(s => s.name), ['Intake (Capture)', 'Delivery', 'Dial', 'RPC', 'Sale', 'Activation']);
  assert.deepEqual(adapted.stages.map(s => s.volume), [10, 8, 7, 4, 3, 2]);
});

test('adaptJourneyData: absent lifecycle total never becomes duplicated sum of multi-vendor rows', () => {
  const dataWithoutLifecycle: JourneyData = {
    velocity: {
      fetchToDelivery: 'Unavailable',
      deliveryToFirstDial: 'Unavailable',
      firstDialToContact: 'Unavailable',
      contactToSale: 'Unavailable',
      saleToActivation: 'Unavailable',
    },
    byVendor: [
      { vendor: 'Vendor1', leads: 100, delivered: 80, dialled: 70, contacted: 40, sales: 10, activations: 5 },
      { vendor: 'Vendor2', leads: 150, delivered: 120, dialled: 90, contacted: 50, sales: 15, activations: 8 },
    ],
    bySource: [],
    byGrade: [],
  };

  const adapted = adaptJourneyData(dataWithoutLifecycle);

  // Absent total volume must be null/unavailable, NEVER 250 (100 + 150)
  assert.equal(adapted.headline.totalVolume, null);
  assert.equal(adapted.headline.deliveredVolume, null);
  assert.equal(adapted.headline.dialledVolume, null);
  assert.equal(adapted.headline.salesVolume, null);
  assert.equal(adapted.headline.deliveryPct, null);
  assert.equal(adapted.headline.salePct, null);
  assert.equal(adapted.stages[0].volume, null);
});

test('adaptJourneyData: empty eligible population has null rates and measured zero remains zero', () => {
  const zeroData: JourneyData = {
    velocity: {
      fetchToDelivery: '0s',
      deliveryToFirstDial: '0s',
      firstDialToContact: 'Unavailable',
      contactToSale: '0s',
      saleToActivation: '0s',
    },
    byVendor: [],
    bySource: [],
    byGrade: [],
    lifecycle: {
      period: null,
      comparisons: {
        fetched: { current: 0, previous: null, kind: 'count', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        delivered: { current: 0, previous: null, kind: 'count', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        dialled: { current: 0, previous: null, kind: 'count', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        rpc: { current: 0, previous: null, kind: 'count', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        sales: { current: 0, previous: null, kind: 'count', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        activations: { current: 0, previous: null, kind: 'count', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        deliveryRate: { current: null, previous: null, kind: 'rate', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        dialRate: { current: null, previous: null, kind: 'rate', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        rpcRate: { current: null, previous: null, kind: 'rate', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        saleRate: { current: null, previous: null, kind: 'rate', absoluteChange: null, percentageChange: null, percentagePointChange: null },
        activationRate: { current: null, previous: null, kind: 'rate', absoluteChange: null, percentageChange: null, percentagePointChange: null },
      },
      transitions: [
        { from: 'Capture', to: 'Delivery', population: 0, converted: 0, lost: 0, conversionRate: null, lossRate: null, deteriorationPp: null, status: 'OBSERVED' },
        { from: 'Delivery', to: 'Dial', population: 0, converted: 0, lost: null, conversionRate: null, lossRate: null, deteriorationPp: null, status: 'OBSERVED' },
      ],
      largestLeakage: null,
      largestDeterioration: null,
      segments: {},
      priorSegments: {},
      rateContributions: {},
      velocity: { captureToDeliverySec: null, deliveryToDialSec: null, dialToSaleSec: null, saleToActivationSec: null },
      validationStatus: 'NOT_VERIFIED',
      methodology: 'Test',
      unsupportedDimensions: [],
    },
  };

  const adapted = adaptJourneyData(zeroData);

  // Measured zero remains 0 (not null)
  assert.equal(adapted.headline.totalVolume, 0);
  assert.equal(adapted.headline.deliveredVolume, 0);
  assert.equal(adapted.headline.dialledVolume, 0);
  assert.equal(adapted.headline.salesVolume, 0);
  assert.equal(adapted.stages[0].volume, 0);
  assert.equal(adapted.stages[1].volume, 0);

  // Rates with 0 denominator must be null
  assert.equal(adapted.headline.deliveryPct, null);
  assert.equal(adapted.headline.dialPct, null);
  assert.equal(adapted.headline.salePct, null);

  // Unknown lost remains null (transition 1 lost is null)
  assert.equal(adapted.transitions[1].lost, null);
});

test('vendor disposition export: buildDispositionExportRows binds result selection metadata', () => {
  const meta: DispositionExportMetadata = {
    clientId: 'tenant-omega',
    startDate: '2026-09-01',
    endDate: '2026-09-15',
    filters: { campaign: 'Brand_Direct' },
    mode: 'lead_status',
    dateBasis: 'lead_capture_cohort',
    countingGrain: 'lead_record',
    totalPopulation: 142,
    denominatorDefinition: 'Dialled leads recorded for vendor CallForce',
    isTruncated: false,
    taxonomyVersion: DISPOSITION_REPORT_VERSION,
    userRole: 'analyst',
    userEmail: 'analyst@cx3.test',
    generatedAt: '2026-09-27T10:00:00.000Z',
    inspectedVendor: 'CallForce',
    activeGroupFilter: 'CONTACTED_RPC',
    searchQuery: 'SALE',
    returnedRowCount: 1,
  };

  const sampleDataRows = [
    [
      'Vendor',
      'Raw Disposition Code',
      'Description',
      'Approved Outcome Group',
      'Volume',
      'Share of Group %',
      'Share of Vendor %',
      'Mapping Status',
      'RPC',
      'Sales',
      'Callbacks',
    ],
    [
      'CallForce',
      'SALE',
      'Sale Made',
      'Reported Sale',
      142,
      '100.0%',
      '24.5%',
      'APPROVED',
      142,
      142,
      0,
    ],
  ];

  const exportRows = buildDispositionExportRows(sampleDataRows, meta);
  assert.equal(exportRows.length, 2);

  const header = exportRows[0];
  // Verify standard audit columns
  assert.ok(header.includes('Scope client'));
  assert.ok(header.includes('Reporting mode'));
  assert.ok(header.includes('Date basis'));
  assert.ok(header.includes('Counting grain'));
  assert.ok(header.includes('Taxonomy version'));
  // Verify new selection-bound audit columns
  assert.ok(header.includes('Inspected vendor'));
  assert.ok(header.includes('Active group filter'));
  assert.ok(header.includes('Search query'));
  assert.ok(header.includes('Returned row count'));

  const row = exportRows[1];
  assert.equal(row[0], 'CallForce');
  assert.equal(row[1], 'SALE');
  assert.equal(row[4], 142); // Volume

  // Positional audit column verification (compatible with earlier contract tests)
  const clientIdx = header.indexOf('Scope client');
  assert.equal(row[clientIdx], 'tenant-omega');

  const vendorIdx = header.indexOf('Inspected vendor');
  assert.equal(row[vendorIdx], 'CallForce');

  const groupIdx = header.indexOf('Active group filter');
  assert.equal(row[groupIdx], 'CONTACTED_RPC');

  const searchIdx = header.indexOf('Search query');
  assert.equal(row[searchIdx], 'SALE');

  const rowCountIdx = header.indexOf('Returned row count');
  assert.equal(row[rowCountIdx], 1);

  const csv = serializeCsv(exportRows);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"CallForce"'));
  assert.ok(csv.includes('"CONTACTED_RPC"'));
});

test('vendor disposition export: empty filtered rows returns empty breakdown with header and metadata', () => {
  const meta: DispositionExportMetadata = {
    clientId: 'tenant-omega',
    startDate: '2026-09-01',
    endDate: '2026-09-15',
    filters: {},
    mode: 'call_records',
    dateBasis: 'call_event_timestamp',
    countingGrain: 'call_event',
    totalPopulation: 0,
    denominatorDefinition: 'Call attempts recorded for vendor Mondo',
    isTruncated: false,
    taxonomyVersion: DISPOSITION_REPORT_VERSION,
    inspectedVendor: 'Mondo',
    activeGroupFilter: 'VOICEMAIL',
    searchQuery: 'nonexistent_code',
    returnedRowCount: 0,
  };

  const emptyDataRows = [
    [
      'Vendor',
      'Raw Disposition Code',
      'Description',
      'Approved Outcome Group',
      'Volume',
      'Share of Group %',
      'Share of Vendor %',
      'Mapping Status',
      'RPC',
      'Sales',
      'Callbacks',
    ],
  ];

  const exportRows = buildDispositionExportRows(emptyDataRows, meta);
  // Contains only the header row, no data rows
  assert.equal(exportRows.length, 1);
  assert.equal(exportRows[0][0], 'Vendor');
  assert.ok(exportRows[0].includes('Inspected vendor'));

  const csv = serializeCsv(exportRows);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Vendor"'));
});

test('investigation records: getRawLeads handles call-effort and funnel-stage drills correctly', async t => {
  const { getBigQueryClient } = await import('../server/bigquery/client');
  const { getClientConfig } = await import('../server/bigquery/config');
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  const queries: any[] = [];
  t.mock.method(client, 'query', async (options: any) => {
    queries.push(options);
    return [[{ total_count: 0, evidence_rows: [] }]];
  });

  // Test that getRawLeads correctly rejects invalid call-effort bucket with 422
  await assert.rejects(
    async () => {
      await getRawLeads({
        clientId: 'default_tenant',
        drill: 'call-effort',
        drillValue: 'invalid_bucket_name',
      });
    },
    {
      name: 'RequestError',
      status: 422,
    }
  );

  // Test that arbitrary unallowlisted drill is rejected with 422
  await assert.rejects(
    async () => {
      await getRawLeads({
        clientId: 'default_tenant',
        drill: 'contact-effort', // ContactPage previously emitted this invented drill
        drillValue: '2 calls',
      });
    },
    {
      name: 'RequestError',
      status: 422,
    }
  );

  // Test that getRawLeads compiles exact predicates for all valid call-effort buckets
  const bucketExpectedPredicates: Record<string, string> = {
    '0 calls': 'm.recorded_call_count = 0',
    '1 call': 'm.recorded_call_count = 1',
    '2 calls': 'm.recorded_call_count = 2',
    '3 calls': 'm.recorded_call_count = 3',
    '4 calls': 'm.recorded_call_count = 4',
    '5+ calls': 'm.recorded_call_count >= 5',
    'Unrecorded': 'm.recorded_call_count IS NULL',
  };

  for (const [bucket, expectedPredicate] of Object.entries(bucketExpectedPredicates)) {
    await getRawLeads({
      clientId: 'default_tenant',
      drill: 'call-effort',
      drillValue: bucket,
    });
    const lastQuery = queries.at(-1)?.query;
    assert.ok(
      lastQuery.includes(`AND (${expectedPredicate})`),
      `Expected query for bucket '${bucket}' to include 'AND (${expectedPredicate})'`
    );
  }

  // Test that getRawLeads compiles exact predicates for funnel-stage
  // sales compiles to 'm.is_sale' (all recorded sales, not just those with RPC!)
  await getRawLeads({
    clientId: 'default_tenant',
    drill: 'funnel-stage',
    drillValue: 'sales',
  });
  assert.ok(queries.at(-1)?.query.includes('AND (m.is_sale)'), 'Sales stage must drill all sales leads');

  // dialled compiles to 'm.is_dialled'
  await getRawLeads({
    clientId: 'default_tenant',
    drill: 'funnel-stage',
    drillValue: 'dialled',
  });
  assert.ok(queries.at(-1)?.query.includes('AND (m.is_dialled)'), 'Dialled stage must drill all dialled leads');

  // dialled-to-rpc loss includes unrecorded RPC to match transition residual population
  await getRawLeads({
    clientId: 'default_tenant',
    drill: 'funnel-loss',
    drillValue: 'dialled-to-rpc',
  });
  assert.ok(
    queries.at(-1)?.query.includes('AND (m.is_dialled AND (m.is_rpc IS FALSE OR m.is_rpc IS NULL))'),
    'dialled-to-rpc loss must include unrecorded RPC outcomes'
  );

  // Invalid stage name throws 422
  await assert.rejects(
    async () => {
      await getRawLeads({
        clientId: 'default_tenant',
        drill: 'funnel-stage',
        drillValue: 'sale', // old unmapped label key
      });
    },
    {
      name: 'RequestError',
      status: 422,
    }
  );
});
