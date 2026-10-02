import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { buildLeadLedgerDestination, buildPreservedDestination, EXPLORE_REPORT_PARAMS, UNIVERSAL_SCOPE_PARAMS } from '../src/app/navigation/ScopePreservingRedirect';
import { BUSINESS_AREAS } from '../src/app/routeManifest';
import { navigationTarget } from '../src/lib/presentation';
import { readFilters } from '../src/lib/FilterContext';
import { canShareAuditScope, scopedViewPath } from '../src/shared/evidence/auditPresentation';
import { investigationPath, shareableInvestigationPath } from '../src/features/investigation/investigationModel';
import { driverSegmentLink } from '../src/features/investigation/driverAnalysisModel';

const filters = { vendor: { operator: 'not_equals', value: 'Excluded' }, source: { operator: 'in', values: ['Paid / α', 'Organic'] } };
const query = new URLSearchParams({ clientId: 'tenant-a', startDate: '2026-09-01', endDate: '2026-09-30', filters: JSON.stringify(filters), drill: 'awaiting-first-dial', segmentGrade: 'A', search: 'PRIVATE ANALYTICAL', preset: 'journey', sourceMode: 'rich', leadId: 'PRIVATE SELECTED', selectedIDs: 'PRIVATE SELECTED' });
query.append('workspace', 'one'); query.append('workspace', 'two');

test('Ledger compatibility restores source mode and both existing manual search scopes without selected identity', () => {
  const target = new URL(buildLeadLedgerDestination(query.toString()), 'https://synthetic.invalid');
  assert.equal(target.pathname, '/lead-explorer');
  assert.equal(target.searchParams.get('view'), 'source');
  assert.equal(target.searchParams.get('search'), 'PRIVATE ANALYTICAL');
  assert.equal(target.searchParams.get('sourceSearch'), 'PRIVATE ANALYTICAL');
  assert.equal(target.searchParams.get('sourceMode'), 'rich');
  assert.deepEqual(target.searchParams.getAll('workspace'), ['one', 'two']);
  assert.deepEqual(JSON.parse(target.searchParams.get('filters')!), filters);
  for (const key of ['clientId', 'startDate', 'endDate', 'drill', 'segmentGrade', 'preset']) assert.equal(target.searchParams.get(key), query.get(key));
  for (const key of ['leadId', 'selectedIDs']) assert.equal(target.searchParams.has(key), false);
  const separate = new URLSearchParams(query); separate.set('sourceSearch', 'PRIVATE SOURCE'); separate.set('view', 'population');
  const restored = new URL(buildLeadLedgerDestination(separate.toString()), 'https://synthetic.invalid');
  assert.equal(restored.searchParams.get('sourceSearch'), 'PRIVATE SOURCE');
  assert.equal(restored.searchParams.get('search'), 'PRIVATE ANALYTICAL');
  assert.equal(restored.searchParams.get('view'), 'source');
});

test('Lead Evidence view keys survive local navigation but never become global reporting filters', () => {
  const local = ['view', 'preset', 'sourceSearch', 'sourceMode'];
  for (const key of local) { assert.equal(EXPLORE_REPORT_PARAMS.has(key), true); assert.equal(UNIVERSAL_SCOPE_PARAMS.has(key), false); }
  const input = query.toString() + '&view=source&sourceSearch=PRIVATE+SOURCE';
  assert.deepEqual({ ...readFilters(new URLSearchParams(input)) }, filters, 'Manual mode/search/preset state does not alter analytical filters');
  const canonical = new URL(buildPreservedDestination('/lead-explorer', input), 'https://synthetic.invalid');
  assert.equal(canonical.searchParams.get('view'), 'source');
  assert.equal(canonical.searchParams.get('sourceSearch'), 'PRIVATE SOURCE');
  for (const target of ['/overview', '/speed-to-lead', '/sales-activation', '/commercial', '/data-integrity']) {
    const scoped = new URL(buildPreservedDestination(target, input), 'https://synthetic.invalid');
    for (const key of local) assert.equal(scoped.searchParams.has(key), false, `${target}: ${key}`);
    assert.deepEqual(JSON.parse(scoped.searchParams.get('filters')!), filters);
  }
  const nav = navigationTarget('/lead-explorer?view=source', '/data-integrity', input);
  assert.equal(new URLSearchParams(nav.search).get('view'), 'source');
  assert.equal(new URLSearchParams(nav.search).has('sourceSearch'), false, 'An area link carries report scope, not private page-local search');
});

test('audit and Investigation sharing reject source search and selected identity scopes', () => {
  for (const key of ['search', 'sourceSearch', 'selectedLead', 'selectedLeadId', 'selectedIDs', 'leadId']) {
    const privateScope = new URLSearchParams({ clientId: 'tenant-a', view: 'source', [key]: 'PRIVATE' });
    assert.equal(canShareAuditScope(privateScope.toString()), false, key);
    assert.equal(shareableInvestigationPath('/lead-explorer', privateScope), null, key);
  }
  const publicScope = new URLSearchParams({ clientId: 'tenant-a', view: 'source', sourceMode: 'configured', preset: 'outcomes' });
  assert.equal(canShareAuditScope(publicScope.toString()), true);
  assert.equal(new URL(scopedViewPath('/lead-explorer', publicScope.toString()), 'https://synthetic.invalid').searchParams.get('view'), 'source');
  assert.equal(new URL(shareableInvestigationPath('/lead-explorer', publicScope)!, 'https://synthetic.invalid').searchParams.get('view'), 'source');
});

test('analytical record and driver actions explicitly open Population with unchanged Investigation predicates', () => {
  const source = new URLSearchParams(query); source.set('view', 'source'); source.set('sourceSearch', 'PRIVATE SOURCE');
  const record = new URL(investigationPath('/lead-explorer', source), 'https://synthetic.invalid');
  assert.equal(record.searchParams.get('view'), 'population');
  assert.equal(record.searchParams.get('drill'), query.get('drill'));
  assert.equal(record.searchParams.get('segmentGrade'), 'A');
  assert.equal(record.searchParams.has('selectedIDs'), false);
  const driver = new URL(driverSegmentLink(source, 'vendor', 'Returned vendor', true, 'fetchedLeads'), 'https://synthetic.invalid');
  assert.equal(driver.searchParams.get('view'), 'population');
  assert.equal(driver.searchParams.get('drill'), query.get('drill'));
  assert.equal(driver.searchParams.get('segmentGrade'), 'A');
  assert.equal(driver.searchParams.get('segmentVendor'), 'Returned vendor');
  for (const key of ['sourceSearch', 'sourceMode', 'selectedIDs', 'leadId', 'search']) assert.equal(driver.searchParams.has(key), false);
});

test('Investigate navigation has one Lead Evidence primary tab and only release evidence in More', () => {
  const area = BUSINESS_AREAS.find(item => item.id === 'investigate')!;
  assert.deepEqual(area.primaryTabs.map(item => item.name), ['Investigation inbox', 'Lead Evidence', 'Data confidence']);
  assert.deepEqual(area.moreViews.map(item => item.name), ['Evidence reports', 'Vendor evidence']);
  const router = readFileSync(new URL('../src/app/AppRouter.tsx', import.meta.url), 'utf8');
  assert.match(router, /path="\/lead-ledger" element={<LeadLedgerCompatibilityRedirect/);
  assert.doesNotMatch(router, /path="\/lead-ledger" element={<LeadLedger\b/);
});

const bundle = await build({
  stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter,Routes,Route,useLocation,useNavigate}from'react-router-dom';import Redirect,{LeadLedgerCompatibilityRedirect}from'./src/app/navigation/ScopePreservingRedirect';
    function Current(){const location=useLocation();window.__route.current=location.pathname+location.search;window.__route.navigate=useNavigate();return <output>{location.pathname}</output>}
    const root=createRoot(document.getElementById('root'));window.__route.unmount=()=>root.unmount();root.render(<MemoryRouter initialEntries={['/overview',window.__route.initial]} initialIndex={1}><Current/><Routes><Route path='/lead-ledger' element={<LeadLedgerCompatibilityRedirect/>}/>{['/explore','/explorer','/leads'].map(path=><Route key={path} path={path} element={<Redirect to='/lead-explorer' extraParams={{view:'population'}} replace/>}/>)}<Route path='*' element={null}/></Routes></MemoryRouter>);`, sourcefile: 'lead-evidence-route-harness.tsx', resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'process.env.NODE_ENV': '"test"' },
});

test('compatibility redirects replace history and aliases open the correct mode without a data request', async () => {
  for (const [path, expected] of [['/lead-ledger', 'source'], ['/explore', 'population'], ['/explorer', 'population'], ['/leads', 'population']]) {
    const dom = new JSDOM('<div id="root"></div>', { url: 'https://synthetic.invalid', runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window as any;
    w.__route = { initial: path + '?' + query + '&view=source' };
    let requests = 0; w.fetch = () => { requests++; throw new Error('Redirect must not request data'); };
    const wait = async (predicate: () => boolean) => { for (let i = 0; i < 80; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('Redirect did not settle'); };
    try {
      w.eval(bundle.outputFiles[0].text);
      await wait(() => w.__route.current?.startsWith('/lead-explorer?'));
      const current = new URL(w.__route.current, 'https://synthetic.invalid');
      assert.equal(current.searchParams.get('view'), expected);
      assert.deepEqual(current.searchParams.getAll('workspace'), ['one', 'two']);
      assert.deepEqual(JSON.parse(current.searchParams.get('filters')!), filters);
      assert.equal(current.searchParams.has('leadId'), false); assert.equal(current.searchParams.has('selectedIDs'), false);
      w.__route.navigate(-1); await wait(() => w.__route.current === '/overview');
      assert.equal(requests, 0);
    } finally { w.__route.unmount?.(); dom.window.close(); }
  }
});
