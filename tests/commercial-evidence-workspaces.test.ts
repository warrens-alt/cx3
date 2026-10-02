import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { commercialOutcomeStages } from '../src/workspaces/commercial/commercialBridgeModel';
import CommercialOutcomeRail from '../src/workspaces/commercial/CommercialOutcomeRail';
import { commercialNodeAudit } from '../src/features/commercial/commercialAudit';
import { operationalEvidenceDimensions } from '../src/workspaces/evidence/EvidenceStateGuide';
import EvidenceLineageExplorer from '../src/workspaces/evidence/EvidenceLineageExplorer';
import { warehouseAnalysisReturn } from '../src/features/evidenceWorkspace/warehouseAuditNavigation';
import type { CommercialData, DataIntegrityData } from '../src/lib/offernetClient';

const commercial = (overrides: Partial<CommercialData> = {}): CommercialData => ({
  status: 'PARTIAL', reason: 'Synthetic scoped evidence', currency: 'ZAR',
  baseline: { volume: 950, mediaSpend: 0, revenue: 8000 } as CommercialData['baseline'],
  media: { status: 'OBSERVED', reason: 'Approved field', platformLeads: 300 } as CommercialData['media'],
  economics: { status: 'AVAILABLE', reason: 'Approved matched keys', fetched: 100, delivered: 80, dialled: 40, rpc: 0, sales: 8, activations: null, recordedRevenue: 700 } as CommercialData['economics'],
  pAndLBreakdown: [], ...overrides,
});
const scope = { clientId: 'tenant_a', startDate: '2026-09-01', endDate: '2026-09-30', filters: { vendor: { operator: 'equals', value: 'Exact vendor' } } };

test('commercial bridge uses matched stage values and retains unknown qualification and activation', () => {
  const data = commercial(), before = structuredClone(data), stages = commercialOutcomeStages(data);
  assert.deepEqual(stages.map(stage => [stage.key, stage.value]), [['fetched', 100], ['qualified', null], ['delivered', 80], ['dialled', 40], ['rpc', 0], ['sales', 8], ['activations', null]]);
  assert.equal(stages[0].value === data.baseline.volume, false);
  assert.match(stages[1].detail, /does not return a qualified population/);
  assert.deepEqual(data, before);
});

test('unavailable economics never exposes stale matched values or borrows a cohort total', () => {
  const data = commercial();
  data.economics = { ...data.economics!, status: 'UNAVAILABLE' };
  assert.ok(commercialOutcomeStages(data).every(stage => stage.value === null));
  assert.ok(commercialOutcomeStages(commercial({ economics: undefined })).every(stage => stage.state === 'unavailable'));
});

test('commercial stage audit keeps exact scope and values with independent validation states', () => {
  const data = commercial();
  for (const stage of commercialOutcomeStages(data)) {
    const audit = commercialNodeAudit(data, stage.auditNode, scope, 'ZAR');
    assert.equal(audit.value, stage.value);
    assert.deepEqual(audit.scope, scope);
    assert.equal(audit.dimensions?.find(item => item.key === 'reconciliation')?.state, 'not_verified');
    assert.equal(audit.recordDrill, undefined);
  }
});

test('billing and collection inspectors never reuse operational recorded revenue', () => {
  for (const node of ['billing', 'collections'] as const) {
    const audit = commercialNodeAudit(commercial(), node, scope);
    assert.equal(audit.value, null);
    assert.match(audit.definition?.meaning || '', /no billing or settlement ledger/);
    assert.match(audit.definition?.limitations?.join(' ') || '', /does not establish collected cash/);
    assert.equal(audit.reportPath, '/commercial/reconciliation');
  }
});

test('stage visual makes supplied zero distinct from unavailable and supplies every node an evidence action', () => {
  const html = renderToStaticMarkup(React.createElement(CommercialOutcomeRail, { stages: commercialOutcomeStages(commercial()), onInspect: () => {} }));
  const doc = new JSDOM(html).window.document;
  assert.equal(doc.querySelector('[data-stage="rpc"] strong')?.textContent, '0');
  assert.equal(doc.querySelector('[data-stage="qualified"] strong')?.textContent, 'UNAVAILABLE');
  assert.equal(doc.querySelector('[data-stage="activations"] strong')?.textContent, 'UNAVAILABLE');
  assert.equal(doc.querySelectorAll('button[aria-label^="Audit evidence:"]').length, 7);
});

test('source zero establishes observation but never replay, reconciliation or business approval', () => {
  const data = { checks: [], sources: [{ rowCount: 0 }] } as DataIntegrityData;
  const dimensions = operationalEvidenceDimensions(data);
  assert.equal(dimensions.find(item => item.key === 'source')?.state, 'observed');
  for (const key of ['reproduction', 'reconciliation', 'business']) assert.equal(dimensions.find(item => item.key === key)?.state, 'not_verified');
  assert.equal(operationalEvidenceDimensions(null).find(item => item.key === 'source')?.state, 'unavailable');
  assert.equal(operationalEvidenceDimensions({ checks: [], sources: [] } as unknown as DataIntegrityData).find(item => item.key === 'source')?.state, 'unavailable');
});

test('lineage explorer exposes maintained registry nodes and does not invent a measured metric', () => {
  const html = renderToStaticMarkup(React.createElement(EvidenceLineageExplorer, { scope, onInspect: () => {} }));
  const doc = new JSDOM(html).window.document;
  assert.equal(doc.querySelectorAll('.cx-evidence-trace-nodes>li').length, 5);
  assert.equal(doc.querySelector('[data-node-type="metric"] .cx-audit-exact-value')?.textContent, 'Unavailable');
  assert.equal(doc.querySelectorAll('.cx-audit-node-action').length, 5);
  assert.match(doc.body.textContent!, /does not establish a physical source read/);
});

test('warehouse return accepts only exact originating Evidence paths and strips private identities', () => {
  for (const path of ['/evidence', '/evidence/sources', '/evidence/metrics', '/evidence/reconciliation', '/data-integrity']) {
    const result = warehouseAnalysisReturn(`${path}?clientId=tenant_a&startDate=2026-09-01&leadId=private&selectedLeadId=private`);
    assert.equal(result, `${path}?clientId=tenant_a&startDate=2026-09-01`);
  }
  for (const path of ['https://outside.example/evidence', '//outside.example/evidence', '/evidence/warehouse', '/evidence-other', '/commercial', '/evidence/sources/extra']) assert.equal(warehouseAnalysisReturn(path), null);
});
