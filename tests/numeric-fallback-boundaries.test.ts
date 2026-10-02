import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { DataIntakePanel } from '../src/components/DataIntakePanel';
import { getAllClients, getClientConfig } from '../server/bigquery/config';
import { leadSourceRelation } from '../server/bigquery/leadSource';
import { scopedAnalysisRows, serializeCsv } from '../src/lib/analysisExport';

test('source inventory starts unavailable rather than manufacturing catalogue counts', () => {
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null,
    React.createElement(DataIntakePanel, { clientId: 'mtn', isAdmin: true })));
  assert.match(html, /Inventory \(—\)/);
  assert.doesNotMatch(html, /Inventory \(65\)/);
  const source = readFileSync('src/components/DataIntakePanel.tsx', 'utf8');
  assert.doesNotMatch(source, /inventory[^\n]*\|\|\s*(?:65|18|47)/);
  assert.match(source, /setInventory\(null\)/);
});

test('tenant operational definitions stop at recorded source evidence', () => {
  for (const client of getAllClients()) {
    assert.match(client.operationalConfig!.salesDefinition, /Recorded sale/);
    assert.match(client.operationalConfig!.salesDefinition, /not inferred/);
    assert.match(client.operationalConfig!.activationDefinition, /Recorded activation/);
    assert.doesNotMatch(client.operationalConfig!.salesDefinition, /Policy Issued|Contract Verified|QA Passed/);
  }
});

test('flat revenue normalization avoids an unnecessary binary floating conversion', () => {
  const sql = leadSourceRelation(getClientConfig('mtn'));
  assert.match(sql, /SAFE_CAST\(src\.revenue_generated AS NUMERIC\)/);
  assert.doesNotMatch(sql, /revenue_generated AS FLOAT64/);
});

test('aggregate exports retain exact supplied decimal strings and audit provenance', () => {
  const rows = scopedAnalysisRows([['Source-recorded revenue'], ['9007199254740993.123456789'], [0], [null]], {
    clientId: 'mtn', startDate: '2026-09-01', endDate: '2026-09-30',
    filters: { vendor: { operator: 'equals', value: 'MTN' } },
    dateBasis: 'lead_capture_cohort', definitionVersion: 'metric-test-v1',
    countingGrain: 'distinct scoped lead', timezone: 'Africa/Johannesburg',
    generatedAt: '2026-10-02T10:00:00Z', validationStatus: 'NOT_VERIFIED', truncated: false,
  });
  const at = (label: string) => rows[1][rows[0].indexOf(label)];
  assert.equal(rows[1][0], '9007199254740993.123456789');
  assert.equal(rows[2][0], 0);
  assert.equal(rows[3][0], null);
  assert.equal(at('Definition version'), 'metric-test-v1');
  assert.equal(at('Counting grain'), 'distinct scoped lead');
  assert.equal(at('Reporting timezone'), 'Africa/Johannesburg');
  assert.equal(at('Server generated at'), '2026-10-02T10:00:00Z');
  assert.equal(at('Detail truncated'), false);
  assert.equal(at('Validation status'), 'NOT_VERIFIED');
  assert.equal(at('Source cutoff'), null);
  assert.ok(Number.isFinite(Date.parse(String(at('Export generated at')))));
  assert.match(serializeCsv(rows), /9007199254740993\.123456789/);
});

test('aggregate exports do not fabricate server provenance or completeness when absent', () => {
  const rows = scopedAnalysisRows([['Metric'], [null]], { clientId: 'mtn' });
  for (const column of ['Definition version', 'Counting grain', 'Reporting timezone', 'Server generated at', 'Detail truncated']) {
    assert.equal(rows[1][rows[0].indexOf(column)], null, column);
  }
});

test('Overview export carries unknown call counts separately from measured zero', () => {
  const source = readFileSync('src/features/overview/OverviewPage.tsx', 'utf8');
  for (const field of ['unrecordedCallLeads', 'zeroCallLeads', 'dialledUnrecordedCallLeads', 'dialledUnrecordedCallSharePct']) {
    assert.ok(source.includes(field));
  }
  assert.match(source, /summary\.zeroCallLeads \?\? null/);
  assert.match(source, /summary\.unrecordedCallLeads \?\? null/);
});
