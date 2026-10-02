import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';
import { SAVED_INVESTIGATION_VERSION, type SavedInvestigationDefinition } from '../contracts/savedAnalysis';

const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,useNavigate,useLocation} from 'react-router-dom';import {FilterProvider} from './src/lib/FilterContext';import SavedInvestigations from './src/features/investigation/SavedInvestigations';import {updateAnalyticalSession} from './src/lib/analyticalSession';
window.__saved.setSession=uid=>updateAnalyticalSession({uid,role:'analyst',status:'active',allowedTenants:['tenant-a','tenant-b'],isAdmin:false,isActive:!!uid});window.__saved.setSession('owner');
function Harness(){window.__saved.navigate=useNavigate();window.__saved.location=useLocation();return <FilterProvider><SavedInvestigations/></FilterProvider>}
const root=createRoot(document.getElementById('root'));window.__saved.unmount=()=>root.unmount();root.render(<MemoryRouter initialEntries={[window.__saved.route]}><Harness/></MemoryRouter>);`;
const bundle = await build({ stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: 'saved-ui-harness.tsx', loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"test"' }, plugins: [{ name: 'saved-context', setup(builder) {
  builder.onResolve({ filter: /\/ClientContext$/ }, () => ({ path: 'ClientContext', namespace: 'saved-mock' }));
  builder.onLoad({ filter: /.*/, namespace: 'saved-mock' }, () => ({ contents: `import{useSearchParams}from'react-router-dom';export function useClient(){const[p]=useSearchParams();const selectedClient=p.get('clientId')||'';return{selectedClient,clientConfig:{name:selectedClient},ready:!!selectedClient}}`, loader: 'tsx', resolveDir: process.cwd() }));
} }] });

const definition = (name = 'Awaiting dial', tenantId = 'tenant-a'): SavedInvestigationDefinition => ({
  version: SAVED_INVESTIGATION_VERSION, report: 'investigation', id: 'saved-1', ownerSubject: 'owner', name,
  scope: { tenantId, startDate: null, endDate: null, dateBasis: 'intake_cohort', countingGrain: 'lead', filters: { vendor: { operator: 'equals', value: 'Saved vendor' } } },
  investigation: { drill: 'awaiting-first-dial', segmentSource: 'Saved source', metric: 'fetchedLeads' },
  release: { mode: 'current_observations', releaseId: null }, revision: 1, createdAt: '2026-10-02T10:00:00.000Z', updatedAt: '2026-10-02T10:00:00.000Z',
});

async function mount(options: { route?: string; definitions?: SavedInvestigationDefinition[]; configured?: boolean; error?: string; defer?: string[] } = {}) {
  const errors: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  virtualConsole.on('error', (...args) => errors.push(args.map(String).join(' ')));
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://saved.invalid', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const w = dom.window as any;
  Object.assign(w, { Response, Headers, Request, AbortController, structuredClone });
  w.__saved = { route: options.route || '/investigate?clientId=tenant-a', requests: [], stalled: [], defer: options.defer || [], configured: options.configured !== false, definitions: options.definitions || [], error: options.error || '' };
  w.fetch = async (url: string, init: RequestInit) => {
    const parsed = new URL(url, 'https://saved.invalid');
    const body = init.body ? JSON.parse(String(init.body)) : null;
    const request = { method: init.method, url: parsed, body, signal: init.signal };
    w.__saved.requests.push(request);
    let data: unknown;
    if (w.__saved.defer.includes(init.method)) {
      data = await new Promise(resolve => w.__saved.stalled.push({ ...request, resolve }));
    } else if (w.__saved.error) {
      return new Response(JSON.stringify({ success: false, error: w.__saved.error }), { status: 503, headers: { 'content-type': 'application/json' } });
    } else if (init.method === 'GET') {
      data = { configured: w.__saved.configured, definitions: w.__saved.definitions.filter((d: SavedInvestigationDefinition) => d.scope.tenantId === parsed.searchParams.get('clientId')), limit: 50 };
    } else if (init.method === 'POST') {
      data = { ...definition(body.definition.name, body.clientId), ...body.definition, id: 'saved-new' };
      w.__saved.definitions.push(data);
    } else if (init.method === 'PUT') {
      const previous = w.__saved.definitions.find((d: SavedInvestigationDefinition) => parsed.pathname.endsWith('/' + d.id));
      data = { ...previous, ...body.definition, revision: body.revision + 1, updatedAt: '2026-10-02T11:00:00.000Z' };
      w.__saved.definitions = w.__saved.definitions.map((d: SavedInvestigationDefinition) => d.id === previous.id ? data : d);
    } else {
      w.__saved.definitions = w.__saved.definitions.filter((d: SavedInvestigationDefinition) => !parsed.pathname.endsWith('/' + d.id));
      data = { deleted: true };
    }
    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const find = (selector: string, text = '') => [...w.document.querySelectorAll(selector)].find((element: any) => (element.getAttribute('aria-label') || element.textContent || '').includes(text)) as any;
  const wait = async (condition: () => unknown) => { for (let index = 0; index < 120; index++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error(`Saved UI did not settle: ${w.document.body.textContent} / ${errors.join(';')}`); };
  const input = (element: HTMLInputElement, value: string) => { Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value')!.set!.call(element, value); element.dispatchEvent(new w.Event('input', { bubbles: true })); };
  const open = async () => { const details = find('details'); details.open = true; details.dispatchEvent(new w.Event('toggle')); await wait(() => w.__saved.requests.length > 0 || find('p', 'Select an authorised')); };
  w.eval(bundle.outputFiles[0].text);
  await wait(() => find('summary', 'Saved investigations'));
  return { w, find, wait, input, open, text: () => w.document.body.textContent as string, close: () => { w.__saved.unmount(); dom.window.close(); assert.deepEqual(errors, []); } };
}

test('saved definitions load lazily and save the exact scope with open date bounds', async () => {
  const route = '/investigate?clientId=tenant-a&startDate=2026-09-01&vendor=Original&drill=awaiting-first-dial&segmentSource=Paid&segmentGrade=A&investigationMetric=fetchedLeads';
  const app = await mount({ route });
  try {
    assert.equal(app.w.__saved.requests.length, 0);
    await app.open(); await app.wait(() => app.find('input'));
    assert.match(app.text(), /2026-09-01 – Open end/);
    app.input(app.find('input'), 'September investigation'); await app.wait(() => app.find('input').value === 'September investigation');
    app.find('button', 'Save investigation').click();
    await app.wait(() => app.find('button', 'Open September investigation'));
    const draft = app.w.__saved.requests.find((r: any) => r.method === 'POST').body.definition;
    assert.equal(draft.scope.startDate, '2026-09-01'); assert.equal(draft.scope.endDate, null);
    assert.deepEqual(draft.scope.filters, { vendor: { operator: 'equals', value: 'Original' } });
    assert.deepEqual(draft.investigation, { drill: 'awaiting-first-dial', metric: 'fetchedLeads', segmentSource: 'Paid', segmentGrade: 'A' });
    assert.deepEqual(Object.keys(draft).sort(), ['investigation', 'name', 'release', 'report', 'scope', 'version']);
    assert.match(app.text(), /do not freeze a result or save record data, searches, evidence pins, or notes/);
  } finally { app.close(); }
});

test('open replaces current scope atomically and preserves saved all-time semantics', async () => {
  const app = await mount({ route: '/investigate?clientId=tenant-a&startDate=2026-10-01&endDate=2026-10-02&source=Old&drill=one-call-only&segmentVendor=Old&search=private&page=8&leadId=private', definitions: [definition()] });
  try {
    await app.open(); await app.wait(() => app.find('button', 'Open Awaiting dial'));
    assert.match(app.find('.cx-saved-investigation-list').textContent, /All time/);
    assert.equal(app.find('button', 'Save investigation').disabled, true);
    app.find('button', 'Open Awaiting dial').click(); await app.wait(() => !app.w.__saved.location.search.includes('search='));
    const params = new URLSearchParams(app.w.__saved.location.search);
    assert.equal(app.w.__saved.location.pathname, '/investigate'); assert.equal(params.get('drill'), 'awaiting-first-dial'); assert.equal(params.get('segmentSource'), 'Saved source'); assert.equal(params.get('investigationMetric'), 'fetchedLeads');
    assert.deepEqual(JSON.parse(params.get('filters')!), definition().scope.filters);
    for (const key of ['startDate', 'endDate', 'source', 'segmentVendor', 'search', 'page', 'leadId']) assert.equal(params.has(key), false, key);
  } finally { app.close(); }
});

test('renaming retains stored scope and revision, and delete removes only the saved definition', async () => {
  const app = await mount({ route: '/investigate?clientId=tenant-a&grade=Current', definitions: [definition()] });
  try {
    await app.open(); await app.wait(() => app.find('button', 'Rename Awaiting dial')); app.find('button', 'Rename Awaiting dial').click();
    await app.wait(() => app.find('form', 'Rename Awaiting dial'));
    app.input(app.find('form', 'Rename Awaiting dial').querySelector('input'), 'Vendor follow-up');
    app.find('button', 'Save name').click(); await app.wait(() => app.find('button', 'Open Vendor follow-up'));
    const update = app.w.__saved.requests.find((r: any) => r.method === 'PUT');
    assert.equal(update.body.revision, 1); assert.deepEqual(update.body.definition.scope, definition().scope); assert.deepEqual(update.body.definition.investigation, definition().investigation);
    app.find('button', 'Delete Vendor follow-up').click(); await app.wait(() => app.text().includes('No saved investigations'));
    const removed = app.w.__saved.requests.find((r: any) => r.method === 'DELETE');
    assert.equal(removed.url.searchParams.get('revision'), '2'); assert.equal(removed.url.searchParams.get('clientId'), 'tenant-a');
    assert.equal(new URLSearchParams(app.w.__saved.location.search).get('grade'), 'Current');
  } finally { app.close(); }
});

test('unsupported or private scope cannot be saved as a broader definition', async () => {
  for (const query of ['search=private', 'drill=one-call-only&drill=awaiting-first-dial', 'startDate=2026-10-31&endDate=2026-10-01', 'filters=' + encodeURIComponent(JSON.stringify({ lead_id: { operator: 'equals', value: 'private' } })), 'filters=' + encodeURIComponent(JSON.stringify({ vendor: { operator: 'not_in', values: ['Blocked'] } }))]) {
    const app = await mount({ route: '/investigate?clientId=tenant-a&' + query });
    try { await app.open(); await app.wait(() => app.find('button', 'Save investigation')); assert.equal(app.find('button', 'Save investigation').disabled, true); assert.match(app.text(), /scope cannot be saved/); assert.equal(app.w.__saved.requests.some((r: any) => r.method === 'POST'), false); }
    finally { app.close(); }
  }
});

test('storage not configured and request failures remain distinct from an empty list', async () => {
  for (const options of [{ configured: false }, { error: 'Storage temporarily unavailable' }]) {
    const app = await mount(options);
    try { await app.open(); await app.wait(() => !app.text().includes('Loading saved')); assert.doesNotMatch(app.text(), /No saved investigations/); assert.equal(app.find('button', 'Save investigation'), undefined); assert.match(app.text(), options.configured === false ? /not configured/ : /Storage temporarily unavailable/); }
    finally { app.close(); }
  }
});

test('late list results are discarded across workspace and account boundaries', async () => {
  for (const change of ['workspace', 'account']) {
    const app = await mount({ defer: ['GET'] });
    try {
      await app.open(); await app.wait(() => app.w.__saved.stalled.length === 1); const old = app.w.__saved.stalled[0];
      if (change === 'workspace') app.w.__saved.navigate('/investigate?clientId=tenant-b'); else app.w.__saved.setSession('other-owner');
      await app.wait(() => !app.find('details').open);
      assert.equal(old.signal.aborted, true);
      old.resolve({ configured: true, definitions: [definition('Old private name')], limit: 50 });
      app.w.__saved.defer = []; await app.open(); await app.wait(() => app.text().includes('No saved investigations'));
      assert.doesNotMatch(app.text(), /Old private name/);
    } finally { app.close(); }
  }
});

test('a pending save cannot populate a changed scope or show a stale success', async () => {
  const app = await mount({ defer: ['POST'] });
  try {
    await app.open(); await app.wait(() => app.find('input')); app.input(app.find('input'), 'Old scope'); app.find('button', 'Save investigation').click(); await app.wait(() => app.w.__saved.stalled.length === 1);
    const old = app.w.__saved.stalled[0]; app.w.__saved.navigate('/investigate?clientId=tenant-a&vendor=New');
    await app.wait(() => app.find('input').value === '' && old.signal.aborted);
    old.resolve({ ...definition('Old scope'), ...old.body.definition });
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.doesNotMatch(app.text(), /Saved “Old scope”/); assert.equal(app.find('button', 'Open Old scope'), undefined); assert.equal(app.find('button', 'Save investigation').disabled, false);
  } finally { app.close(); }
});

test('a failed mutation keeps the stored entry and can reload the latest revision', async () => {
  const app = await mount({ definitions: [definition()] });
  try {
    await app.open(); await app.wait(() => app.find('button', 'Delete Awaiting dial'));
    app.w.__saved.error = 'This definition changed. Refresh before retrying.';
    app.find('button', 'Delete Awaiting dial').click();
    await app.wait(() => app.find('[role="alert"]'));
    assert.equal(app.find('button', 'Open Awaiting dial') !== undefined, true);
    assert.doesNotMatch(app.text(), /Deleted saved definition/);
    app.w.__saved.error = '';
    app.w.__saved.definitions = [{ ...definition('Updated elsewhere'), revision: 2, updatedAt: '2026-10-02T11:00:00.000Z' }];
    app.find('button', 'Refresh saved list').click(); await app.wait(() => app.find('button', 'Open Updated elsewhere'));
    assert.equal(app.find('[role="alert"]'), undefined);
    assert.equal(app.find('button', 'Open Awaiting dial'), undefined);
  } finally { app.close(); }
});
