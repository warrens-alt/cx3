import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISPOSITION_REPORT_VERSION,
  APPROVED_DISPOSITION_GROUPS,
  resolveApprovedGroup,
  type ApprovedDispositionGroup,
} from '../../contracts/vendorDispositions';
import {
  buildLeadStatusResult,
  buildCallRecordsResult,
  getFallbackDispositions,
  getContactDispositionsAnalytics,
} from '../../server/analytics/contact/dispositions';
import { buildDispositionExportRows, serializeCsv } from '../../src/lib/analysisExport';

test('vendor-dispositions: version and taxonomy integrity', () => {
  assert.equal(DISPOSITION_REPORT_VERSION, 'cx.dispositions.1.1.0');
  assert.ok(APPROVED_DISPOSITION_GROUPS.CONTACTED_RPC);
  assert.ok(APPROVED_DISPOSITION_GROUPS.REPORTED_SALE);
  assert.ok(APPROVED_DISPOSITION_GROUPS.NO_ANSWER);
  assert.ok(APPROVED_DISPOSITION_GROUPS.BUSY);
  assert.ok(APPROVED_DISPOSITION_GROUPS.VOICEMAIL);
  assert.ok(APPROVED_DISPOSITION_GROUPS.CALLBACK_REQUESTED);
  assert.ok(APPROVED_DISPOSITION_GROUPS.NOT_INTERESTED);
  assert.ok(APPROVED_DISPOSITION_GROUPS.INVALID_WRONG_NUMBER);
  assert.ok(APPROVED_DISPOSITION_GROUPS.DO_NOT_CONTACT);
  assert.ok(APPROVED_DISPOSITION_GROUPS.TECHNICAL_FAILURE);
  assert.ok(APPROVED_DISPOSITION_GROUPS.OTHER);
  assert.ok(APPROVED_DISPOSITION_GROUPS.UNMAPPED);
  assert.ok(APPROVED_DISPOSITION_GROUPS.MISSING_DISPOSITION);
  assert.ok(APPROVED_DISPOSITION_GROUPS.ZERO_CALLS);
  assert.ok(APPROVED_DISPOSITION_GROUPS.UNRECORDED_ACTIVITY);
});

test('vendor-dispositions: versioned mapping deterministically classifies known codes', () => {
  // BLC exact mapping
  const blcSale = resolveApprovedGroup('BLC', 'SALE');
  assert.equal(blcSale.group, 'REPORTED_SALE');
  assert.equal(blcSale.isUnmapped, false);

  const blcCallbk = resolveApprovedGroup('BLC', 'CALLBK');
  assert.equal(blcCallbk.group, 'CALLBACK_REQUESTED');

  const blcNa = resolveApprovedGroup('BLC', 'NA');
  assert.equal(blcNa.group, 'NO_ANSWER');

  const blcNi = resolveApprovedGroup('BLC', 'NI');
  assert.equal(blcNi.group, 'NOT_INTERESTED');

  // Mondo exact mapping
  const mondoVm = resolveApprovedGroup('Mondo', 'VM');
  assert.equal(mondoVm.group, 'VOICEMAIL');

  const mondoDec = resolveApprovedGroup('Mondo', 'DEC');
  assert.equal(mondoDec.group, 'NOT_INTERESTED');
});

test('vendor-dispositions: unmapped dispositions are kept strictly separate from missing dispositions', () => {
  // Blank or null status resolves to MISSING_DISPOSITION
  const missingNull = resolveApprovedGroup('BLC', null);
  assert.equal(missingNull.group, 'MISSING_DISPOSITION');
  assert.equal(missingNull.isUnmapped, false);

  const missingEmpty = resolveApprovedGroup('BLC', '   ');
  assert.equal(missingEmpty.group, 'MISSING_DISPOSITION');
  assert.equal(missingEmpty.isUnmapped, false);

  // Unknown non-blank code resolves to UNMAPPED
  const unmappedCode = resolveApprovedGroup('BLC', 'UNKNOWN_CUSTOM_XY99');
  assert.equal(unmappedCode.group, 'UNMAPPED');
  assert.equal(unmappedCode.isUnmapped, true);
  assert.ok(unmappedCode.description.includes('UNKNOWN_CUSTOM_XY99'));
});

test('vendor-dispositions: lead-status aggregation preserves lead–vendor grain and separates zero calls from missing disposition', () => {
  const sampleRows = [
    // Vendor A: 100 leads dialled with SALE
    { vendor: 'VendorA', current_status: 'SALE', is_dialled: true, total_calls: 2, is_rpc: true, is_sale: true, pair_count: 100 },
    // Vendor A: 50 leads dialled but missing disposition code
    { vendor: 'VendorA', current_status: null, is_dialled: true, total_calls: 1, is_rpc: false, is_sale: false, pair_count: 50 },
    // Vendor A: 30 leads explicitly recorded zero calls (activity state, NOT missing disposition)
    { vendor: 'VendorA', current_status: null, is_dialled: false, total_calls: 0, is_rpc: false, is_sale: false, pair_count: 30 },
    // Vendor A: 20 leads with indeterminate/unrecorded call counts
    { vendor: 'VendorA', current_status: null, is_dialled: false, total_calls: null, is_rpc: false, is_sale: false, pair_count: 20 },
    // Vendor A: 10 leads dialled with an unmapped raw code
    { vendor: 'VendorA', current_status: 'MYSTERY_CODE', is_dialled: true, total_calls: 1, is_rpc: false, is_sale: false, pair_count: 10 },
  ];

  const result = buildLeadStatusResult(sampleRows, { clientId: 'test' });

  assert.equal(result.mode, 'lead_status');
  assert.equal(result.countingGrain, 'lead_vendor_pairs');
  assert.equal(result.dateBasis, 'lead_capture_cohort');

  // Total population = 100 + 50 + 30 + 20 + 10 = 210
  assert.equal(result.summary.totalEntities, 210);
  // Dialled = 100 + 50 + 10 = 160
  assert.equal(result.summary.dialledEntities, 160);
  // Recorded = 100 + 10 = 110
  assert.equal(result.summary.recordedDispositions, 110);
  // Missing dispositions = 50 (dialled with null)
  assert.equal(result.summary.missingDispositions, 50);
  // Unmapped dispositions = 10 (MYSTERY_CODE)
  assert.equal(result.summary.unmappedDispositions, 10);

  const vendorA = result.vendorSummaries.find((v) => v.vendor === 'VendorA');
  assert.ok(vendorA);
  assert.equal(vendorA.totalPopulation, 210);
  assert.equal(vendorA.dialledCount, 160);
  assert.equal(vendorA.zeroCallCount, 30);
  assert.equal(vendorA.unrecordedActivityCount, 20);
  assert.equal(vendorA.recordedDispositionCount, 110);
  assert.equal(vendorA.missingDispositionCount, 50);
  assert.equal(vendorA.unmappedDispositionCount, 10);

  // Disposition coverage = 110 / 160 = 68.8%
  assert.equal(vendorA.dispositionCoveragePct, 68.8);
  // Mapping coverage = (110 - 10) / 110 = 90.9%
  assert.equal(vendorA.mappingCoveragePct, 90.9);
});

test('vendor-dispositions: call dispositions mode uses call-start date and reports dialler record caveats', () => {
  const callRows = [
    { vendor: 'BLC', raw_code: 'SALE', status_name: 'Sale Made', call_count: 500, distinct_leads: 450, rpc_count: 500, sale_count: 500, callback_count: 0, avg_duration_sec: 320.5, valid_duration_count: 500, latest_observation: '2026-09-27T00:00:00Z' },
    { vendor: 'BLC', raw_code: 'CALLBK', status_name: 'Call Back', call_count: 800, distinct_leads: 700, rpc_count: 800, sale_count: 0, callback_count: 800, avg_duration_sec: 90.0, valid_duration_count: 800, latest_observation: '2026-09-27T00:00:00Z' },
    { vendor: 'BLC', raw_code: 'NA', status_name: 'No Answer', call_count: 2000, distinct_leads: 1200, rpc_count: 0, sale_count: 0, callback_count: 0, avg_duration_sec: 20.0, valid_duration_count: 2000, latest_observation: '2026-09-27T00:00:00Z' },
    { vendor: 'BLC', raw_code: 'UNKNOWN', status_name: null, call_count: 100, distinct_leads: 90, rpc_count: 0, sale_count: 0, callback_count: 0, avg_duration_sec: 0, valid_duration_count: 0, latest_observation: '2026-09-27T00:00:00Z' },
  ];

  const result = buildCallRecordsResult(callRows, { clientId: 'test' });

  assert.equal(result.mode, 'call_records');
  assert.equal(result.countingGrain, 'dialler_records');
  assert.equal(result.dateBasis, 'call_start_date');

  // Total calls = 500 + 800 + 2000 + 100 = 3400
  assert.equal(result.summary.totalEntities, 3400);
  assert.equal(result.summary.dialledEntities, 3400);
  // Recorded = 500 + 800 + 2000 = 3300
  assert.equal(result.summary.recordedDispositions, 3300);
  // Missing = 100
  assert.equal(result.summary.missingDispositions, 100);
  // Unmapped = 0
  assert.equal(result.summary.unmappedDispositions, 0);

  const blc = result.vendorSummaries.find((v) => v.vendor === 'BLC');
  assert.ok(blc);
  assert.ok(blc.coverageLimitations.some((lim) => lim.includes('Dialler records')));
  assert.equal(blc.sourceTable, 'lead_ledger_all_vicidial_insights');
});

test('vendor-dispositions: metric calculations handle zero denominator safely without NaN or false 0%', () => {
  const emptyRows: any[] = [];
  const result = buildLeadStatusResult(emptyRows, { clientId: 'empty' });

  assert.equal(result.summary.totalEntities, 0);
  assert.equal(result.summary.dialledEntities, 0);
  assert.equal(result.summary.dispositionCoveragePct, null);
  assert.deepEqual(result.vendorSummaries, []);
});

test('vendor-dispositions: query failure throws an explicit error and does not return fallback vendor figures', async () => {
  await assert.rejects(async () => {
    await getContactDispositionsAnalytics({ clientId: 'nonexistent_client_fail_closed' });
  });
});

test('vendor-dispositions: multi-vendor lead isolation preserves distinct vendor pairs and prevents cross-vendor count inflation', () => {
  // 1 lead sent to both VendorA and VendorB
  // VendorA recorded SALE, VendorB recorded NO_ANSWER
  const multiVendorRows = [
    { vendor: 'VendorA', current_status: 'SALE', is_dialled: true, total_calls: 2, is_rpc: true, is_sale: true, pair_count: 1 },
    { vendor: 'VendorB', current_status: 'NA', is_dialled: true, total_calls: 1, is_rpc: false, is_sale: false, pair_count: 1 },
  ];

  const result = buildLeadStatusResult(multiVendorRows, { clientId: 'test' });
  // Total pairs = 2 (exceeds distinct lead count of 1)
  assert.equal(result.summary.totalEntities, 2);
  assert.equal(result.summary.dialledEntities, 2);

  const vendorA = result.vendorSummaries.find((v) => v.vendor === 'VendorA')!;
  const vendorB = result.vendorSummaries.find((v) => v.vendor === 'VendorB')!;

  assert.equal(vendorA.totalPopulation, 1);
  assert.equal(vendorA.saleCount, 1);
  assert.equal(vendorA.rpcCount, 1);

  assert.equal(vendorB.totalPopulation, 1);
  assert.equal(vendorB.saleCount, 0);
  assert.equal(vendorB.rpcCount, 0);

  // Vendor outcomes are isolated
  const breakdownA = result.breakdown.filter((r) => r.vendor === 'VendorA');
  const breakdownB = result.breakdown.filter((r) => r.vendor === 'VendorB');
  assert.equal(breakdownA[0].approvedGroup, 'REPORTED_SALE');
  assert.equal(breakdownB[0].approvedGroup, 'NO_ANSWER');
});

test('vendor-dispositions: status ambiguity resolves to explicit CONFLICTING_EVIDENCE category without favorable bias', () => {
  const conflictRows = [
    {
      vendor: 'VendorA',
      current_status: 'CONFLICTING_EVIDENCE',
      is_dialled: true,
      total_calls: 3,
      is_rpc: true,
      is_sale: false,
      pair_count: 15,
    },
  ];

  const result = buildLeadStatusResult(conflictRows, { clientId: 'test' });
  assert.equal(result.summary.conflictingEntities, 15);

  const vendorA = result.vendorSummaries.find((v) => v.vendor === 'VendorA')!;
  assert.equal(vendorA.conflictingCount, 15);

  const breakdownRow = result.breakdown.find((r) => r.vendor === 'VendorA' && r.rawDisposition === 'CONFLICTING_EVIDENCE')!;
  assert.ok(breakdownRow);
  assert.equal(breakdownRow.approvedGroup, 'CONFLICTING_EVIDENCE');
  assert.equal(breakdownRow.isUnmapped, false);
  assert.equal(breakdownRow.mappingStatus, 'CONFLICTING');
});

test('vendor-dispositions: call outcomes mode rejects unsupported operational dimension filters with 422', async () => {
  // Passing 'grade' or 'source' to call outcomes must be rejected before querying
  await assert.rejects(
    async () => {
      await getContactDispositionsAnalytics({ clientId: 'default_tenant', mode: 'call_records', grade: 'A' } as any);
    },
    (err: any) => {
      assert.equal(err.status, 422);
      assert.ok(err.message.includes('Call dispositions mode supports date, tenant, and vendor filters only'));
      return true;
    }
  );
});

test('vendor-dispositions: export metadata and serialization preserves complete scope, denominators and taxonomy version', () => {
  const meta = {
    clientId: 'default_tenant',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    filters: { vendor: 'BLC' },
    timezone: 'Africa/Johannesburg',
    mode: 'lead_status' as const,
    dateBasis: 'lead_capture_cohort',
    countingGrain: 'lead_vendor_pairs',
    totalPopulation: 2500,
    denominatorDefinition: 'Dialled lead–vendor pairs (reconciled HLC records)',
    isTruncated: false,
    taxonomyVersion: DISPOSITION_REPORT_VERSION,
    userRole: 'administrator',
    userEmail: 'admin@conversionx.test',
    generatedAt: '2026-09-27T12:00:00Z',
  };

  const sampleDataRows = [
    ['Vendor', 'Total Population', 'Dialled Count', 'Recorded Dispositions'],
    ['BLC', 2500, 2100, 1950],
  ];

  const exportRows = buildDispositionExportRows(sampleDataRows, meta);
  assert.equal(exportRows.length, 2);

  const header = exportRows[0];
  assert.ok(header.includes('Scope client'));
  assert.ok(header.includes('Reporting mode'));
  assert.ok(header.includes('Denominator definition'));
  assert.ok(header.includes('Taxonomy version'));

  const row = exportRows[1];
  assert.equal(row[0], 'BLC');
  assert.equal(row[4], 'default_tenant'); // Scope client
  assert.equal(row[7], 'lead_status'); // Reporting mode
  assert.equal(row[10], 2500); // Total population
  assert.equal(row[14], DISPOSITION_REPORT_VERSION); // Taxonomy version

  const csv = serializeCsv(exportRows);
  assert.ok(csv.startsWith('\uFEFF')); // BOM
  assert.ok(csv.includes('"BLC"'));
  assert.ok(csv.includes('"cx.dispositions.1.1.0"'));
});
