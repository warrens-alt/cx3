import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SourceEvidenceCards from '../src/shared/reporting/SourceEvidenceCards';
import { parseWorkspaceEvidence } from '../src/lib/workspaceReadiness';

const report = parseWorkspaceEvidence({ success: true, metadata: { clientId: 'synthetic' }, data: {
  generatedAt: '2026-09-29T06:00:00Z', sources: [
    { key: 'leads', label: 'Lead ledger', status: 'OBSERVED', rowCount: 10, missingTimestampRows: 0, latestRecordAt: '2026-09-28T06:00:00Z' },
    { key: 'calls', label: 'Call source', status: 'EMPTY', rowCount: 0, missingTimestampRows: 0, latestRecordAt: null },
    { key: 'marketing', label: 'Marketing', status: 'MAPPING_REQUIRED', rowCount: null, missingTimestampRows: null, latestRecordAt: null },
    { key: 'diallerRealtime', label: 'Live dialler', status: 'UNCONFIGURED', rowCount: null, latestRecordAt: null },
  ],
} }, 'synthetic');

test('rendered source cards preserve genuine zero, unknown evidence and source-wide scope', () => {
  const html = renderToStaticMarkup(React.createElement(SourceEvidenceCards, { report }));
  assert.match(html, /Workspace-wide source evidence, independent of the report dates and filters/);
  assert.match(html, /Source empty/);
  assert.match(html, /<dd>0<\/dd>/);
  assert.match(html, /<dd>Unavailable<\/dd>/);
  assert.match(html, /Mapping required/);
  assert.match(html, /Not configured/);
  assert.doesNotMatch(html, /financially verified|Feed healthy|100%|private_key/);
});

test('rendered source labels are escaped and cannot inject markup', () => {
  const html = renderToStaticMarkup(React.createElement(SourceEvidenceCards, { report: { ...report, sources: [{ ...report.sources[0], label: '<script>alert(1)</script>' }] } }));
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('rendered empty list and future timestamps do not become healthy-source claims', () => {
  const empty = renderToStaticMarkup(React.createElement(SourceEvidenceCards, { report: { ...report, sources: [] } }));
  assert.match(empty, /No source evidence was returned/);
  const future = renderToStaticMarkup(React.createElement(SourceEvidenceCards, { report: { ...report, sources: [{ ...report.sources[0], latestRecordAt: '2026-10-01T00:00:00Z' }] } }));
  assert.match(future, /Future event timestamp/);
});
