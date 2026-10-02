import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReleaseManifest } from '../contracts/reporting';
import CatalogueDatasetExplorer from '../src/features/evidenceWorkspace/CatalogueDatasetExplorer';
import ReleaseEvidence from '../src/features/evidenceWorkspace/ReleaseEvidence';
import InsightWorkbench from '../src/features/evidenceWorkspace/InsightWorkbench';

const release = {
  releaseId: 'release-full-identifier-do-not-truncate', tenantId: 'test', status: 'PUBLISHED',
  modelVersion: 'model-test', metricVersion: 'metric-test', engineHash: 'hash-test',
  builtAt: '2026-09-28T13:00:00Z', cutoff: '2026-09-28T00:00:00Z',
  approvedBy: '', approvalReference: 'approval-test', sourceBatchIds: [],
  snapshots: { leads: { table: 'test.snapshot.leads', createdAt: '2026-09-28T12:00:00Z', snapshotTime: '2026-09-28T11:00:00Z' } },
  sources: [{ fact: 'leads', status: 'PARTIAL', completeThrough: null }],
  checks: [{ id: 'passed-check', status: 'PASS', observed: '0', expected: '0', jobId: 'job-1' },
    { id: 'failed-check', status: 'FAIL', observed: '4', expected: '0', jobId: 'job-2' },
    { id: 'pending-check', status: 'NOT_RUN', observed: '', expected: '1', jobId: 'job-3' }],
} as unknown as ReleaseManifest;
const render = (element: React.ReactElement) => renderToStaticMarkup(element);
const read = (path: string) => fs.readFileSync(path, 'utf8');

test('release checks render actual PASS, FAIL and NOT_RUN evidence', () => {
  const html = render(React.createElement(ReleaseEvidence, { release }));
  for (const state of ['PASS', 'FAIL', 'NOT_RUN']) assert.ok(html.includes(`data-state="${state}"`));
  assert.ok(html.includes('job-2'));
  assert.ok(html.includes('passed-check'));
});
test('release presentation retains full identifiers and distinguishes missing approver', () => {
  const html = render(React.createElement(ReleaseEvidence, { release }));
  assert.ok(html.includes(release.releaseId));
  assert.ok(html.includes('Not reported'));
  assert.doesNotMatch(html, /System Auditor|class="[^"]*truncate/);
});
test('snapshot date is separate from source completeness and observation cutoff', () => {
  const html = render(React.createElement(ReleaseEvidence, { release }));
  assert.ok(html.includes('PARTIAL'));
  assert.ok(html.includes('2026-09-28T11:00:00.000Z'));
  assert.ok(html.includes('2026-09-28T00:00:00.000Z'));
  assert.ok(html.includes('Complete through'));
});
test('empty audit checks do not become a pass', () => {
  const html = render(React.createElement(ReleaseEvidence, { release: { ...release, checks: [] } }));
  assert.ok(html.includes('No audit checks were supplied'));
  assert.doesNotMatch(html, /data-state="PASS"/);
});
test('catalogue bars represent supplied objects and preserve zero', () => {
  const html = render(React.createElement(CatalogueDatasetExplorer, { datasets: [
    { project: 'test', dataset: 'empty', totalObjects: 0, totalColumns: 0 },
    { project: 'test', dataset: 'populated', totalObjects: 8, totalColumns: 24 },
  ] as any, onBrowse: () => {} }));
  assert.ok(html.includes('width:0%'));
  assert.ok(html.includes('width:100%'));
  assert.ok(html.includes('not leads, source rows or connectivity'));
  assert.ok(html.includes('Not checked'));
});
test('catalogue search and evidence inspection have complete accessible identifiers', () => {
  const html = render(React.createElement(CatalogueDatasetExplorer, { datasets: [{ project: 'test-project', dataset: 'lead_data', totalObjects: 8, totalColumns: 24 }] as any, onBrowse: () => {} }));
  assert.match(html, /aria-label="Search datasets"/);
  assert.match(html, /Inspect evidence for test-project.lead_data/);
});
test('finding text and references are escaped, never treated as executable markup', () => {
  const html = render(React.createElement(InsightWorkbench, { insights: [{ category: 'Unusual coverage', severity: 'HIGH', finding: '<script>not executed</script>', directive: 'Check the returned source', metricReference: '<unknown-reference>' }], severity: 'ALL', onSeverity: () => {} }));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;unknown-reference&gt;'));
  assert.doesNotMatch(html, /<script>/);
});
test('empty findings and missing references are not certified', () => {
  const html = render(React.createElement(InsightWorkbench, { insights: [], severity: 'ALL', onSeverity: () => {} }));
  assert.ok(html.includes('No findings were returned'));
  assert.ok(html.includes('not independently verified conclusions'));
});
test('AI display does not fabricate model identity or successful engine status', () => {
  const page = read('src/pages/AiOperationalInsights.tsx');
  assert.doesNotMatch(page, /gemini-3\.8-flash|Gemini 3\.8 Flash|title="Operational"/);
  assert.ok(page.includes("{data?.model || 'Not reported'}"));
  assert.ok(page.includes("askGeminiAnalytics(promptToAsk, queryParams)"));
});
test('reports retain the existing query key and endpoint while composing the immutable executor', () => {
  const page = read('src/pages/VersionedReports.tsx');
  assert.ok(page.includes("['versioned-reports', sessionKey, clientId, requestedRelease, releases.length]"));
  assert.ok(page.includes('fetchReportingCatalogue(clientId, signal, requestedRelease)'));
  assert.ok(page.includes('ReportExecutionWorkspace'));
  assert.ok(page.includes('does not independently reconcile'));
});
test('settings and warehouse keep runtime calls and permission guard intact', () => {
  const reader = read('src/components/warehouse/WarehouseDataPuller.tsx');
  assert.ok(reader.includes("isAdmin && selectedClient === 'default_tenant' && ready"));
  assert.ok(reader.includes('pullWarehouseTableData({ clientId: selectedClient, ...selection, startDate: dates.start, endDate: dates.end, dateField: field, limit, offset }, controller.signal)'));
  assert.ok(read('src/pages/Settings.tsx').includes("useOperationalData('workspace-service-diagnostics', { clientId: selectedClient }, fetchWorkspaceDiagnostics)"));
});
test('visual components introduce no requests, storage writes or metric substitutions', () => {
  for (const file of ['CatalogueDatasetExplorer', 'ReleaseEvidence', 'InsightWorkbench']) {
    assert.doesNotMatch(read(`src/features/evidenceWorkspace/${file}.tsx`), /\bfetch\(|localStorage|sessionStorage|dangerouslySetInnerHTML/);
  }
  const css = read('src/styles/evidenceWorkspaces.css');
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
  assert.match(css, /position:sticky/);
});
