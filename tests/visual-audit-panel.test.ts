import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuditPanelModel } from '../src/shared/evidence/auditPanelModel';
import { auditDestination, auditScopeSearch, canShareAuditScope, scopedViewPath } from '../src/shared/evidence/auditPresentation';
import type { InspectorContent } from '../src/shared/evidence/InspectorHost';

const scope = { clientId: 'tenant-a', startDate: '2026-09-01', endDate: '2026-09-30', filters: { vendor: { operator: 'in', values: ['Vendor A', 'Vendor B'] } } };
test('unmeasured and incalculable results remain unavailable across panel dimensions and trace', () => {
  for (const value of ['Not measured', 'Not calculable']) {
    const model = buildAuditPanelModel({ type: 'custom', title: 'Missing result', value, scope }, 'tenant-a');
    assert.equal(model.dimensions.find(item => item.key === 'source')?.state, 'unavailable');
    assert.equal(model.trace.at(-1)?.state, 'unavailable');
    assert.equal(model.trace.at(-1)?.value, null);
  }
});
test('canonical panel separates source observation, mapping and scope from independent verification', () => {
  const model = buildAuditPanelModel({ type: 'metric', metricId: 'dialled_leads', title: 'Dialled leads', value: 0, scope }, 'tenant-a · September');
  assert.equal(model.dimensions.find(item => item.key === 'source')?.state, 'observed');
  assert.equal(model.dimensions.find(item => item.key === 'mapping')?.state, 'mapped');
  assert.equal(model.dimensions.find(item => item.key === 'scope')?.state, 'scoped');
  assert.equal(model.dimensions.find(item => item.key === 'business')?.state, 'not_verified');
  assert.equal(model.dimensions.find(item => item.key === 'reconciliation')?.state, 'not_verified');
  assert.equal(model.reconciliation.state, 'not_verified');
  assert.equal(model.anatomy.numerator?.value, 0);
  assert.equal(model.trace.some(node => node.type === 'api'), false, 'No endpoint or API node inferred');
  assert.equal(model.trace.some(node => node.type === 'reconciliation'), false);
});
test('ratio anatomy preserves zero numerator and missing denominator without reconstructing populations', () => {
  const content: InspectorContent = { type: 'metric', metricId: 'rpc_rate', title: 'RPC rate', value: null, numeratorCount: 0, denominatorCount: null, scope };
  const model = buildAuditPanelModel(content, 'tenant-a');
  assert.equal(model.anatomy.kind, 'ratio');
  assert.equal(model.anatomy.numerator?.value, 0);
  assert.equal(model.anatomy.denominator?.value, null);
  assert.equal(model.trace.at(-1)?.state, 'unavailable');
  assert.equal(model.trace.at(-1)?.value, null);
});
test('registered independent populations retain independent-ratio wording', () => {
  const model = buildAuditPanelModel({ type: 'metric', metricId: 'activation_rate', title: 'Activations / sales', value: '120%', numeratorCount: 12, denominatorCount: 10, scope }, 'tenant-a');
  assert.equal(model.anatomy.kind, 'independent_ratio');
  assert.equal(model.anatomy.numerator?.value, 12);
  assert.equal(model.anatomy.denominator?.value, 10);
});
test('explicit trace is used in supplied order without generating extra API nodes', () => {
  const trace = [{ key: 'missing', type: 'source' as const, label: 'Missing source', state: 'unavailable' as const, value: null }];
  assert.deepEqual(buildAuditPanelModel({ type: 'custom', title: 'Absent', value: null, trace }, '').trace, trace);
});
test('saved Investigation scope overrides newer dates, filters and case narrowing in record navigation', () => {
  const saved = { ...scope, narrowing: { drill: 'awaiting-first-dial', segmentSource: 'source-a', search: 'private query' } };
  const path = auditDestination('/lead-explorer', '?clientId=wrong&workspace=alpha&workspace=beta&startDate=2025-01-01&drill=stale&segmentVendor=stale&leadId=private&filters=%7B%7D', saved);
  const params = new URL(path, 'https://scope.invalid').searchParams;
  assert.equal(params.get('clientId'), 'tenant-a');
  assert.equal(params.get('startDate'), scope.startDate);
  assert.equal(params.get('endDate'), scope.endDate);
  assert.deepEqual(params.getAll('workspace'), ['alpha', 'beta']);
  assert.deepEqual(JSON.parse(params.get('filters')!), scope.filters);
  assert.equal(params.get('drill'), 'awaiting-first-dial');
  assert.equal(params.get('segmentSource'), 'source-a');
  assert.equal(params.get('segmentVendor'), null);
  assert.equal(params.get('search'), 'private query');
  assert.equal(params.get('leadId'), null);
  assert.equal(canShareAuditScope(params.toString()), false);
});
test('an empty saved narrowing clears the current case while destination policy retains valid scope only', () => {
  const saved = { ...scope, narrowing: {} };
  const query = '?workspace=alpha&drill=old&search=old&segmentGrade=A&lead_id=private';
  const search = new URLSearchParams(auditScopeSearch(query, saved));
  for (const key of ['drill', 'search', 'segmentGrade', 'lead_id']) assert.equal(search.has(key), false);
  assert.equal(canShareAuditScope(search.toString()), true);
  const path = scopedViewPath('/overview', query, saved);
  assert.equal(new URL(path, 'https://scope.invalid').searchParams.get('workspace'), 'alpha');
});
test('private identifier filters and malformed filters cannot produce shareable audit links', () => {
  for (const filters of [{ lead_id: { operator: 'equals', value: 'PRIVATE' } }, { consumer_id: { operator: 'equals', value: 'PRIVATE' } }, { transaction_id: { operator: 'equals', value: 'PRIVATE' } }]) {
    assert.equal(canShareAuditScope(new URLSearchParams({ filters: JSON.stringify(filters) }).toString()), false);
  }
  assert.equal(canShareAuditScope('filters=%7Bbad'), false);
});
test('a supplied independent comparison can establish only its explicitly declared dimension', () => {
  const reconciliation = { label:'Exact scope source comparison',kind:'source_reconciliation' as const,state:'reconciled' as const,values:[],scopeDescription:'tenant-a · September',detail:'Explicit independent comparison supplied for this scope' };
  const model=buildAuditPanelModel({type:'metric',title:'Count',value:0,scope,reconciliation},'tenant-a · September');
  assert.equal(model.dimensions.find(item=>item.key==='reconciliation')?.state,'reconciled');
  assert.equal(model.dimensions.find(item=>item.key==='business')?.state,'not_verified');
  const delivery=buildAuditPanelModel({type:'metric',title:'Count',value:0,scope,reconciliation:{...reconciliation,kind:'delivery_consistency',state:'presentation_consistent'}},'tenant-a');
  assert.equal(delivery.dimensions.find(item=>item.key==='reconciliation')?.state,'not_verified');
});
