import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateExactRate,
  type CliPerformanceRecord,
} from '../contracts/cliPerformance';
import {
  parseAndValidateCliCsv,
  generateBenchmarkCliDataset,
  setTenantImport,
  getTenantImport,
  clearTenantImport,
} from '../server/bigquery/cli_analytics';
import { exportData } from '../server/bigquery/export';

test('calculateExactRate calculates precise exact decimal percentages without float drift', () => {
  // 1/3 = 33.33%
  assert.equal(calculateExactRate('1', '3'), '33.33');
  // 0 denominator returns null
  assert.equal(calculateExactRate('10', '0'), null);
  // null numerator returns null
  assert.equal(calculateExactRate(null, '100'), null);
  // exact 50%
  assert.equal(calculateExactRate('50', '100'), '50.00');
  // 100%
  assert.equal(calculateExactRate('250', '250'), '100.00');
});

test('CLI CSV parser validates required headers and rejects missing columns', () => {
  const invalidCsv = `campaign_code,answered_count\nBLC_SALES,120`;
  const result = parseAndValidateCliCsv(invalidCsv, 'invalid.csv');
  assert.equal(result.errors.length > 0, true);
  assert.ok(result.errors.some(e => e.includes('Missing required')));
});

test('CLI CSV parser detects data anomalies such as sales exceeding contacts', () => {
  const anomalyCsv = `cli_number,campaign_code,report_date,vendor_id,total_calls,distinct_leads,contact_count,sale_count,length_in_sec,duration_ge_5m_count
0871112222,BLC_MIGRATION,2026-09-20,BLC_DIRECT,100,80,5,10,3500,2`;
  const result = parseAndValidateCliCsv(anomalyCsv, 'anomaly.csv');
  assert.equal(result.errors.length, 0);
  assert.equal(result.records.length, 1);
  assert.equal(result.anomalies.length > 0, true);
  assert.ok(result.anomalies.some(a => a.type === 'SALES_EXCEED_CONTACTS'));
});

test('CLI CSV parser correctly parses valid dialler reports with duration bands and rates', () => {
  const validCsv = `cli_number,campaign_code,report_date,vendor_id,total_calls,distinct_leads,asr_count,answered_count,contact_count,sale_count,length_in_sec,duration_ge_1m_count,duration_ge_5m_count,duration_ge_15m_count,avg_lead_age_days
0875501001,MTN_DIRECT,2026-09-20,MTN_SA,1500,1200,900,800,450,45,180000,600,200,30,0.85
0875501002,MTN_UPSELL,2026-09-21,MTN_SA,2500,2000,1600,1400,750,90,320000,1050,380,50,1.20`;

  const result = parseAndValidateCliCsv(validCsv, 'valid.csv');
  assert.equal(result.errors.length, 0);
  assert.equal(result.records.length, 2);

  const r1 = result.records.find(r => r.cli === '0875501001')!;
  assert.equal(r1.totalCalls, '1500');
  assert.equal(r1.distinctLeads, '1200');
  assert.equal(r1.contactRate, '30.00'); // 450 / 1500 = 30.00%
  assert.equal(r1.salePerCallRate, '3.00'); // 45 / 1500 = 3.00%
  assert.equal(r1.salePerContactRate, '10.00'); // 45 / 450 = 10.00%
  assert.equal(r1.durationGe5mPct, '13.33'); // 200 / 1500 = 13.33%
});

test('Benchmark CLI dataset stays isolated to explicit sample data without inventing imported lead-age distributions', () => {
  const sample = generateBenchmarkCliDataset();
  assert.ok(sample.records.length >= 10);
  assert.ok(sample.trend.length >= 14);
  assert.equal(sample.leadAgeBands.bands.every(band => Number(band.callCount) === 0), true);
  assert.equal(sample.leadAgeBands.disclaimer.includes('does not infer a lead-age distribution'), true);
});

test('Tenant import lifecycle maintains isolation and can be cleared', () => {
  const tenant = 'test_tenant_cli';
  const sample = generateBenchmarkCliDataset();

  setTenantImport(tenant, {
    uploadedAt: new Date().toISOString(),
    filename: 'test_report.csv',
    records: sample.records,
    trend: sample.trend,
    leadAgeBands: sample.leadAgeBands,
    anomalies: sample.anomalies,
  });

  const cached = getTenantImport(tenant);
  assert.ok(cached);
  assert.equal(cached.filename, 'test_report.csv');
  assert.equal(cached.records.length, sample.records.length);

  clearTenantImport(tenant);
  assert.equal(getTenantImport(tenant), null);
});

test('Export with grain: cli returns enriched rows with data source provenance and metadata', async () => {
  const tenant = 'default_tenant';
  const sample = generateBenchmarkCliDataset();
  setTenantImport(tenant, {
    uploadedAt: new Date().toISOString(),
    filename: 'export_test.csv',
    records: sample.records,
    trend: sample.trend,
    leadAgeBands: sample.leadAgeBands,
    anomalies: sample.anomalies,
  });

  const exportResult = await exportData({
    clientId: tenant,
    grain: 'cli',
  });

  assert.ok(exportResult.rows.length > 0);
  assert.equal(exportResult.metadata.grain, 'cli');
  assert.equal(exportResult.metadata.dataSource, 'IMPORTED REPORT');
  assert.ok(exportResult.csv.includes('CLI Number'));
  assert.ok(exportResult.csv.includes('Total Calls'));
  assert.ok(exportResult.csv.includes('Right Party Contact Rate %'));

  clearTenantImport(tenant);
});
