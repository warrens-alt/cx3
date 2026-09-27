import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptJourneyData } from '../src/features/journey/model/journeyAdapter';
import type { JourneyData } from '../src/features/journey/model/useJourneyModel';
import { buildDispositionExportRows, serializeCsv, type DispositionExportMetadata } from '../src/lib/analysisExport';
import {
  DISPOSITION_REPORT_VERSION,
  presentMappingStatus,
  type ContactDispositionsData,
  type DetailedDispositionRow,
} from '../contracts/vendorDispositions';
import {
  buildVendorSelectedExport,
  filterDispositionRows,
  calculateGroupTotals,
} from '../src/features/contact/model/dispositionSelection';
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

const sampleReportFixture: ContactDispositionsData = {
  reportVersion: DISPOSITION_REPORT_VERSION,
  mode: 'lead_status',
  modeHeading: 'Current recorded status for the selected capture cohort',
  modeDescription: 'Reconciles repeated HLC records deterministically per lead-vendor pair.',
  dateBasis: 'lead_capture_cohort',
  countingGrain: 'lead_vendor_pairs',
  clientId: 'tenant-omega',
  timezone: 'Africa/Johannesburg',
  summary: {
    totalEntities: 500,
    dialledEntities: 400,
    zeroCallEntities: 60,
    unrecordedActivityEntities: 40,
    conflictingEntities: 20,
    recordedDispositions: 350,
    missingDispositions: 50,
    unmappedDispositions: 30,
    dispositionCoveragePct: 87.5,
    mappingCoveragePct: 91.4,
    rpcCount: 150,
    saleCount: 50,
    callbackCount: 30,
  },
  vendorSummaries: [
    {
      vendor: 'CallForce',
      totalPopulation: 300,
      dialledCount: 250,
      recordedDispositionCount: 220,
      missingDispositionCount: 30,
      unmappedDispositionCount: 20,
      dispositionCoveragePct: 88.0,
      mappingCoveragePct: 90.9,
      rpcCount: 100,
      saleCount: 35,
      callbackCount: 20,
      sourceTable: 'clustered_lead_ledger.hlc_details',
      dateBasis: 'lead_capture_cohort',
      latestObservedFeedback: null,
      coverageLimitations: [],
    },
    {
      vendor: 'Mondo',
      totalPopulation: 200,
      dialledCount: 150,
      recordedDispositionCount: 130,
      missingDispositionCount: 20,
      unmappedDispositionCount: 10,
      dispositionCoveragePct: 86.7,
      mappingCoveragePct: 92.3,
      rpcCount: 50,
      saleCount: 15,
      callbackCount: 10,
      sourceTable: 'clustered_lead_ledger.hlc_details',
      dateBasis: 'lead_capture_cohort',
      latestObservedFeedback: null,
      coverageLimitations: [],
    },
  ],
  breakdown: [
    {
      vendor: 'CallForce',
      rawDisposition: 'RPC_HUMAN',
      rawDescription: 'Right Party Contact Human',
      approvedGroup: 'CONTACTED_RPC',
      approvedGroupLabel: 'Contacted / RPC',
      count: 60,
      percentOfBase: 24.0,
      distinctLeadVendorPairs: 60,
      rpcCount: 60,
      saleCount: 0,
      callbackCount: 0,
      avgDurationSec: null,
      validDurationCount: null,
      latestObservation: null,
      mappingStatus: 'APPROVED',
    },
    {
      vendor: 'CallForce',
      rawDisposition: 'RPC_CALLBACK',
      rawDescription: 'Customer Requested Callback',
      approvedGroup: 'CONTACTED_RPC',
      approvedGroupLabel: 'Contacted / RPC',
      count: 40,
      percentOfBase: 16.0,
      distinctLeadVendorPairs: 40,
      rpcCount: 40,
      saleCount: 0,
      callbackCount: 20,
      avgDurationSec: null,
      validDurationCount: null,
      latestObservation: null,
      mappingStatus: 'APPROVED',
    },
    {
      vendor: 'CallForce',
      rawDisposition: 'SALE_MADE',
      rawDescription: 'Sale Closed Deal',
      approvedGroup: 'REPORTED_SALE',
      approvedGroupLabel: 'Reported Sale',
      count: 35,
      percentOfBase: 14.0,
      distinctLeadVendorPairs: 35,
      rpcCount: 35,
      saleCount: 35,
      callbackCount: 0,
      avgDurationSec: null,
      validDurationCount: null,
      latestObservation: null,
      mappingStatus: 'APPROVED',
    },
    {
      vendor: 'CallForce',
      rawDisposition: 'UNMAPPED_RAW_X',
      rawDescription: 'Unknown code from CallForce',
      approvedGroup: 'UNMAPPED',
      approvedGroupLabel: 'Unmapped Disposition',
      count: 20,
      percentOfBase: 8.0,
      distinctLeadVendorPairs: 20,
      rpcCount: 0,
      saleCount: 0,
      callbackCount: 0,
      avgDurationSec: null,
      validDurationCount: null,
      latestObservation: null,
      isUnmapped: true,
      mappingStatus: 'UNMAPPED',
    },
    {
      vendor: 'CallForce',
      rawDisposition: 'MISSING_DISPOSITION',
      rawDescription: 'Missing disposition code',
      approvedGroup: 'MISSING_DISPOSITION',
      approvedGroupLabel: 'Missing Disposition',
      count: 30,
      percentOfBase: 12.0,
      distinctLeadVendorPairs: 30,
      rpcCount: 0,
      saleCount: 0,
      callbackCount: 0,
      avgDurationSec: null,
      validDurationCount: null,
      latestObservation: null,
      mappingStatus: 'MISSING',
    },
    {
      vendor: 'CallForce',
      rawDisposition: 'CONFLICTING_EVIDENCE',
      rawDescription: 'Contradictory status observations',
      approvedGroup: 'CONFLICTING_EVIDENCE',
      approvedGroupLabel: 'Conflicting Evidence',
      count: 20,
      percentOfBase: 8.0,
      distinctLeadVendorPairs: 20,
      rpcCount: 5,
      saleCount: 0,
      callbackCount: 0,
      avgDurationSec: null,
      validDurationCount: null,
      latestObservation: null,
      mappingStatus: 'CONFLICTING',
    },
    {
      vendor: 'CallForce',
      rawDisposition: 'UNKNOWN_CUSTOM_CODE',
      rawDescription: 'Unclassified operational code',
      approvedGroup: 'OTHER',
      approvedGroupLabel: 'Other',
      count: 10,
      percentOfBase: 4.0,
      distinctLeadVendorPairs: 10,
      rpcCount: 0,
      saleCount: 0,
      callbackCount: 0,
      avgDurationSec: null,
      validDurationCount: null,
      latestObservation: null,
      mappingStatus: undefined, // Absent status
    },
    {
      vendor: 'CallForce',
      rawDisposition: 'CONTRADICTORY_CODE',
      rawDescription: 'Marked approved but flagged unmapped',
      approvedGroup: 'OTHER',
      approvedGroupLabel: 'Other',
      count: 5,
      percentOfBase: 2.0,
      distinctLeadVendorPairs: 5,
      rpcCount: 0,
      saleCount: 0,
      callbackCount: 0,
      avgDurationSec: null,
      validDurationCount: null,
      latestObservation: null,
      isUnmapped: true,
      mappingStatus: 'APPROVED', // Contradictory fields!
    },
    {
      vendor: 'Mondo',
      rawDisposition: 'SALE',
      rawDescription: 'Approved Deal',
      approvedGroup: 'REPORTED_SALE',
      approvedGroupLabel: 'Reported Sale',
      count: 15,
      percentOfBase: 10.0,
      distinctLeadVendorPairs: 15,
      rpcCount: 15,
      saleCount: 15,
      callbackCount: 0,
      avgDurationSec: null,
      validDurationCount: null,
      latestObservation: null,
      mappingStatus: 'APPROVED',
    },
  ],
  matrix: [],
  trends: [],
  comparableGroups: [],
  capabilities: {
    leadStatusSupported: true,
    callRecordsSupported: true,
    supportedFilters: [],
    unsupportedFilters: [],
  },
  methodology: 'Test',
  evaluatedAt: '2026-09-27T10:00:00.000Z',
};

test('vendor disposition export: select vendor + group + raw-code search synchronizes drawer rows and export output in data, status labels and order', () => {
  const allCallForceRows = sampleReportFixture.breakdown.filter((r) => r.vendor === 'CallForce');

  // Exercise real path: select vendor CallForce, group CONTACTED_RPC, search "HUMAN"
  const drawerRows = filterDispositionRows(allCallForceRows, 'CONTACTED_RPC', 'HUMAN');
  assert.equal(drawerRows.length, 1);
  assert.equal(drawerRows[0].rawDisposition, 'RPC_HUMAN');

  const exportResult = buildVendorSelectedExport({
    report: sampleReportFixture,
    requestContext: {
      clientId: 'tenant-omega',
      startDate: '2026-09-01',
      endDate: '2026-09-15',
    },
    selection: {
      vendor: 'CallForce',
      groupFilter: 'CONTACTED_RPC',
      searchQuery: 'HUMAN',
    },
  });

  // Drawer rows and export rows match in data and row count
  assert.equal(exportResult.selectedRows.length, drawerRows.length);
  assert.equal(exportResult.selectedRows[0].rawDisposition, drawerRows[0].rawDisposition);
  assert.equal(exportResult.selectedRows[0].count, drawerRows[0].count);

  // Status label matches exactly between drawer presenter and CSV output
  const drawerStatus = presentMappingStatus(drawerRows[0]);
  assert.equal(drawerStatus.label, 'Approved mapping');

  const dataRow = exportResult.dataRows[1];
  assert.equal(dataRow[0], 'CallForce');
  assert.equal(dataRow[1], 'RPC_HUMAN');
  assert.equal(dataRow[7], 'Approved mapping'); // Mapping Status column

  // CSV output contains the identical label
  assert.ok(exportResult.csv.includes('"Approved mapping"'));
  assert.ok(exportResult.csv.includes('"RPC_HUMAN"'));
});

test('vendor disposition export: mapping status presenter and export output exercise all explicit mapping-status variants without favorable bias', () => {
  // Test shared presenter with all 5 variants
  const approved = presentMappingStatus({ mappingStatus: 'APPROVED' });
  assert.equal(approved.status, 'APPROVED');
  assert.equal(approved.label, 'Approved mapping');

  const unmapped = presentMappingStatus({ mappingStatus: 'UNMAPPED' });
  assert.equal(unmapped.status, 'UNMAPPED');
  assert.equal(unmapped.label, 'Unmapped code');

  const missing = presentMappingStatus({ mappingStatus: 'MISSING' });
  assert.equal(missing.status, 'MISSING');
  assert.equal(missing.label, 'Missing disposition');

  const conflicting = presentMappingStatus({ mappingStatus: 'CONFLICTING' });
  assert.equal(conflicting.status, 'CONFLICTING');
  assert.equal(conflicting.label, 'Conflicting evidence');

  const unknown = presentMappingStatus({ mappingStatus: 'SOME_UNKNOWN_CODE' as any });
  assert.equal(unknown.status, 'UNAVAILABLE');
  assert.equal(unknown.label, 'Mapping status unavailable');

  const absent = presentMappingStatus({});
  assert.equal(absent.status, 'UNAVAILABLE');
  assert.equal(absent.label, 'Mapping status unavailable');

  // Contradictory status fields are handled explicitly rather than silently choosing Approved
  const contradictory = presentMappingStatus({ mappingStatus: 'APPROVED', isUnmapped: true });
  assert.equal(contradictory.status, 'CONFLICTING');
  assert.equal(contradictory.label, 'Conflicting evidence');

  // Documented contract alternatives when mappingStatus is absent
  const documentedUnmapped = presentMappingStatus({ isUnmapped: true });
  assert.equal(documentedUnmapped.status, 'UNMAPPED');
  assert.equal(documentedUnmapped.label, 'Unmapped code');

  const documentedMissing = presentMappingStatus({ approvedGroup: 'MISSING_DISPOSITION' });
  assert.equal(documentedMissing.status, 'MISSING');
  assert.equal(documentedMissing.label, 'Missing disposition');

  // Full export of CallForce exercises all variants in CSV
  const exportResult = buildVendorSelectedExport({
    report: sampleReportFixture,
    requestContext: { clientId: 'tenant-omega' },
    selection: { vendor: 'CallForce', groupFilter: 'ALL', searchQuery: '' },
  });

  const headers = exportResult.dataRows[0];
  const statusIdx = headers.indexOf('Mapping Status');
  assert.ok(statusIdx >= 0);

  const statusLabelsInCsv = exportResult.dataRows.slice(1).map((r) => r[statusIdx]);
  assert.ok(statusLabelsInCsv.includes('Approved mapping'));
  assert.ok(statusLabelsInCsv.includes('Unmapped code'));
  assert.ok(statusLabelsInCsv.includes('Missing disposition'));
  assert.ok(statusLabelsInCsv.includes('Conflicting evidence'));
  assert.ok(statusLabelsInCsv.includes('Mapping status unavailable'));
});

test('vendor disposition export: missing report metadata fails cleanly with explicit readable error and produces no download', () => {
  const reqContext = { clientId: 'tenant-omega' };
  const selection = { vendor: 'CallForce', groupFilter: 'ALL', searchQuery: '' };

  // Missing report
  assert.throws(
    () => buildVendorSelectedExport({ report: null, requestContext: reqContext, selection }),
    /No disposition report data is available/
  );

  // Missing reportVersion
  assert.throws(
    () =>
      buildVendorSelectedExport({
        report: { ...sampleReportFixture, reportVersion: '' },
        requestContext: reqContext,
        selection,
      }),
    /Missing required reportVersion/
  );

  // Missing mode
  assert.throws(
    () =>
      buildVendorSelectedExport({
        report: { ...sampleReportFixture, mode: '' as any },
        requestContext: reqContext,
        selection,
      }),
    /Missing or invalid mode/
  );

  // Missing dateBasis
  assert.throws(
    () =>
      buildVendorSelectedExport({
        report: { ...sampleReportFixture, dateBasis: '' },
        requestContext: reqContext,
        selection,
      }),
    /Missing required dateBasis/
  );

  // Missing countingGrain
  assert.throws(
    () =>
      buildVendorSelectedExport({
        report: { ...sampleReportFixture, countingGrain: '' },
        requestContext: reqContext,
        selection,
      }),
    /Missing required countingGrain/
  );

  // Missing totalEntities population
  assert.throws(
    () =>
      buildVendorSelectedExport({
        report: {
          ...sampleReportFixture,
          summary: { ...sampleReportFixture.summary, totalEntities: null as any },
        },
        requestContext: reqContext,
        selection,
      }),
    /Missing required totalEntities population/
  );

  // Missing evaluatedAt
  assert.throws(
    () =>
      buildVendorSelectedExport({
        report: { ...sampleReportFixture, evaluatedAt: '' },
        requestContext: reqContext,
        selection,
      }),
    /Missing required evaluatedAt timestamp/
  );

  // Measured zero is valid (not missing!)
  const zeroReport: ContactDispositionsData = {
    ...sampleReportFixture,
    summary: { ...sampleReportFixture.summary, totalEntities: 0 },
    vendorSummaries: [{ ...sampleReportFixture.vendorSummaries[0], totalPopulation: 0, dialledCount: 0 }],
    breakdown: [],
  };
  const zeroResult = buildVendorSelectedExport({
    report: zeroReport,
    requestContext: reqContext,
    selection,
  });
  assert.equal(zeroResult.metadata.totalPopulation, 0);
  assert.equal(zeroResult.metadata.reportPopulation, 0);
  assert.equal(zeroResult.isEmptyMatch, true);
});

test('vendor disposition export: selected export CSV distinctly labels all five population metrics without overloading', () => {
  const exportResult = buildVendorSelectedExport({
    report: sampleReportFixture,
    requestContext: { clientId: 'tenant-omega' },
    selection: { vendor: 'CallForce', groupFilter: 'CONTACTED_RPC', searchQuery: 'HUMAN' },
  });

  const headers = exportResult.fullRows[0];

  // Verify all 5 distinct population columns exist in the CSV header
  assert.ok(headers.includes('Report population'));
  assert.ok(headers.includes('Counting grain'));
  assert.ok(headers.includes('Vendor population'));
  assert.ok(headers.includes('Vendor base'));
  assert.ok(headers.includes('Pre-search group population'));
  assert.ok(headers.includes('Selected volume'));
  assert.ok(headers.includes('Returned row count'));

  const row = exportResult.fullRows[1];
  const reportPopIdx = headers.indexOf('Report population');
  const totalPopIdx = headers.indexOf('Total population');
  const grainIdx = headers.indexOf('Counting grain');
  const vendorPopIdx = headers.indexOf('Vendor population');
  const vendorBaseIdx = headers.indexOf('Vendor base');
  const preSearchGrpIdx = headers.indexOf('Pre-search group population');
  const selectedVolIdx = headers.indexOf('Selected volume');
  const returnedRowIdx = headers.indexOf('Returned row count');

  // 1. Full report population and counting grain
  assert.equal(row[reportPopIdx], 500);
  assert.equal(row[totalPopIdx], 500); // Preserves report total, NOT selected volume!
  assert.equal(row[grainIdx], 'lead_vendor_pairs');

  // 2. Selected vendor population and actual percentage base
  assert.equal(row[vendorPopIdx], 300);
  assert.equal(row[vendorBaseIdx], 250); // dialledCount in lead_status mode

  // 3. Selected outcome-group population before table search (60 + 40 = 100 for CONTACTED_RPC)
  assert.equal(row[preSearchGrpIdx], 100);

  // 4. Volume represented by the searched/selected rows (only RPC_HUMAN = 60)
  assert.equal(row[selectedVolIdx], 60);

  // 5. Number of raw-code rows exported
  assert.equal(row[returnedRowIdx], 1);
});

test('vendor disposition export: share of group uses pre-search group volume as denominator, and share of vendor retains report base and percentOfBase', () => {
  // CONTACTED_RPC has 2 rows: RPC_HUMAN (60) and RPC_CALLBACK (40). Total = 100.
  // Search for "HUMAN" -> returns only RPC_HUMAN (60).
  const exportResult = buildVendorSelectedExport({
    report: sampleReportFixture,
    requestContext: { clientId: 'tenant-omega' },
    selection: { vendor: 'CallForce', groupFilter: 'CONTACTED_RPC', searchQuery: 'HUMAN' },
  });

  assert.equal(exportResult.selectedRows.length, 1);
  const dataRow = exportResult.dataRows[1];

  // Share of Group % must use 100 as denominator, so 60 / 100 = 60.0% (NOT 100%!)
  const headers = exportResult.dataRows[0];
  const shareOfGrpIdx = headers.indexOf('Share of Group %');
  const shareOfVendorIdx = headers.indexOf('Share of Vendor %');

  assert.equal(dataRow[shareOfGrpIdx], '60.0%');

  // Share of Vendor % retains the report's percentOfBase (24.0%) based on dialled leads 250
  assert.equal(dataRow[shareOfVendorIdx], '24%');
});

test('vendor disposition export: empty search match yields explicit empty state and cannot be downloaded as all outcomes or corrupt file', () => {
  const exportResult = buildVendorSelectedExport({
    report: sampleReportFixture,
    requestContext: { clientId: 'tenant-omega' },
    selection: { vendor: 'CallForce', groupFilter: 'CONTACTED_RPC', searchQuery: 'NON_EXISTENT_QUERY' },
  });

  assert.equal(exportResult.isEmptyMatch, true);
  assert.equal(exportResult.selectedRows.length, 0);
  assert.equal(exportResult.metadata.returnedRowCount, 0);
  assert.equal(exportResult.metadata.selectedVolume, 0);

  // Contains header row only; no data rows, no fake rows, no fallback to all outcomes
  assert.equal(exportResult.dataRows.length, 1);
  assert.equal(exportResult.fullRows.length, 1);
  assert.equal(exportResult.dataRows[0][0], 'Vendor');

  const csv = exportResult.csv;
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Vendor"'));
  assert.ok(!csv.includes('"RPC_HUMAN"'));
  assert.ok(!csv.includes('"SALE_MADE"'));
});

test('vendor disposition export: changing group or search query updates rendered table rows and export data simultaneously', () => {
  const allCallForceRows = sampleReportFixture.breakdown.filter((r) => r.vendor === 'CallForce');

  // 1. Initial view: group ALL, no search query
  const view1Drawer = filterDispositionRows(allCallForceRows, 'ALL', '');
  const view1Export = buildVendorSelectedExport({
    report: sampleReportFixture,
    requestContext: { clientId: 'tenant-omega' },
    selection: { vendor: 'CallForce', groupFilter: 'ALL', searchQuery: '' },
  });
  assert.equal(view1Drawer.length, 8);
  assert.equal(view1Export.selectedRows.length, 8);

  // 2. Change group to REPORTED_SALE: both table and export update together
  const view2Drawer = filterDispositionRows(allCallForceRows, 'REPORTED_SALE', '');
  const view2Export = buildVendorSelectedExport({
    report: sampleReportFixture,
    requestContext: { clientId: 'tenant-omega' },
    selection: { vendor: 'CallForce', groupFilter: 'REPORTED_SALE', searchQuery: '' },
  });
  assert.equal(view2Drawer.length, 1);
  assert.equal(view2Export.selectedRows.length, 1);
  assert.equal(view2Drawer[0].rawDisposition, 'SALE_MADE');
  assert.equal(view2Export.selectedRows[0].rawDisposition, 'SALE_MADE');

  // 3. Change search query to "Deal": both table and export update together
  const view3Drawer = filterDispositionRows(allCallForceRows, 'ALL', 'Deal');
  const view3Export = buildVendorSelectedExport({
    report: sampleReportFixture,
    requestContext: { clientId: 'tenant-omega' },
    selection: { vendor: 'CallForce', groupFilter: 'ALL', searchQuery: 'Deal' },
  });
  assert.equal(view3Drawer.length, 1);
  assert.equal(view3Export.selectedRows.length, 1);
  assert.equal(view3Drawer[0].rawDisposition, 'SALE_MADE');
  assert.equal(view3Export.selectedRows[0].rawDisposition, 'SALE_MADE');

  // 4. Change vendor to Mondo: both table and export update together
  const allMondoRows = sampleReportFixture.breakdown.filter((r) => r.vendor === 'Mondo');
  const view4Drawer = filterDispositionRows(allMondoRows, 'ALL', '');
  const view4Export = buildVendorSelectedExport({
    report: sampleReportFixture,
    requestContext: { clientId: 'tenant-omega' },
    selection: { vendor: 'Mondo', groupFilter: 'ALL', searchQuery: '' },
  });
  assert.equal(view4Drawer.length, 1);
  assert.equal(view4Export.selectedRows.length, 1);
  assert.equal(view4Drawer[0].rawDisposition, 'SALE');
  assert.equal(view4Export.selectedRows[0].rawDisposition, 'SALE');
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
