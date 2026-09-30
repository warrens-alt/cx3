import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';
import { searchNavigation } from '../src/lib/navigation';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Render the production shell with static, explicit workspace/role contexts.
// The harness has no router pages or analytical data hooks to issue requests.
const bundle = await build({
  stdin: {
    contents: `import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {MemoryRouter,useLocation,useNavigate} from 'react-router-dom';
      import AppShell from './src/app/layouts/AppShell';
      import {ThemeProvider} from './src/lib/ThemeContext';
      function Harness(){const location=useLocation();const navigate=useNavigate();
        window.__navigation.location=location.pathname+location.search;
        window.__navigation.navigate=navigate;
        return <AppShell><h1>Selected analysis</h1></AppShell>;}
      const root=createRoot(document.getElementById('root'));
      window.__navigation.unmount=()=>root.unmount();
      root.render(<MemoryRouter initialEntries={[window.__navigation.route]}><ThemeProvider><Harness/></ThemeProvider></MemoryRouter>);`,
    resolveDir: root,
    sourcefile: 'navigation-harness.tsx',
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  loader: { '.css': 'empty' },
  define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': '{}' },
  plugins: [{ name: 'navigation-test-contexts', setup(b) {
    const mocks: Record<string, string> = {
      AuthContext: `export function useAuth(){return {user:{uid:'synthetic',displayName:'Synthetic reviewer'},profile:{role:window.__navigation.admin?'admin':'viewer'},isAdmin:window.__navigation.admin,signOut:()=>{}}}`,
      ClientContext: `export function useClient(){return {selectedClient:'synthetic',clientConfig:{name:'Synthetic workspace'},clients:[{id:'synthetic',name:'Synthetic workspace'}],ready:true,loading:false,error:null,retry:()=>{},setSelectedClient:()=>{}}}`,
      FilterContext: `export function useFilters(){return {filterError:null,resetScope:()=>{}}}export const extractOffernetFilters=()=>({});`,
      firebase: `export const db={};export const auth={};export const app={};export const googleProvider={};`,
      firestore: `export const collection=()=>{};export const query=()=>{};export const orderBy=()=>{};export const limit=()=>{};export const onSnapshot=()=>()=>{};`,
    };
    b.onResolve({ filter: /\/(AuthContext|ClientContext|FilterContext|firebase)$/ }, a => ({ path: a.path.split('/').at(-1)!, namespace: 'navigation-test' }));
    b.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: 'firestore', namespace: 'navigation-test' }));
    b.onLoad({ filter: /.*/, namespace: 'navigation-test' }, a => ({ contents: mocks[a.path], loader: 'tsx', resolveDir: root }));
  } }],
});
const scope = '?clientId=synthetic&workspace=one&workspace=two&startDate=2026-09-01&endDate=2026-09-28';

async function mount(route: string, admin = false) {
  const errors: string[] = [];
  const console = new VirtualConsole();
  console.on('jsdomError', (error: Error) => errors.push(error.message));
  console.on('error', (...args: unknown[]) => errors.push(args.map(String).join(' ')));
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://synthetic.invalid', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console,
  });
  const w = dom.window as any;
  w.__navigation = { route, admin };
  w.matchMedia = (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLElement.prototype.scrollTo = () => {};
  w.HTMLElement.prototype.getClientRects = function () { return this.isConnected ? [new w.DOMRect(0, 0, 100, 30)] : []; };
  w.scrollTo = () => {};
  let requests = 0;
  w.fetch = () => { requests++; throw new Error('Shell presentation must not request analytical data'); };
  w.eval(bundle.outputFiles[0].text);
  const wait = async (check: () => unknown) => {
    for (let i = 0; i < 100; i++) {
      if (check()) return;
      await new Promise(resolve => setTimeout(resolve, 15));
    }
    throw new Error(`Navigation UI did not settle: ${errors.join('; ')}`);
  };
  const find = (selector: string, name?: string): any => [...w.document.querySelectorAll(selector)].find((el: any) => name === undefined || (el.getAttribute('aria-label') || el.textContent || '').trim() === name);
  const click = async (selector: string, name?: string) => {
    const el = find(selector, name); assert.ok(el, `Missing ${selector}: ${name}`);
    el.focus(); el.click(); await new Promise(resolve => setTimeout(resolve, 25)); return el;
  };
  const input = async (el: any, value: string) => {
    Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 25));
  };
  try { await wait(() => w.document.querySelector('#main-content h1') && w.document.activeElement === w.document.querySelector('#main-content')); }
  catch (error) { w.__navigation.unmount(); dom.window.close(); throw error; }
  return { w, find, wait, click, input, close() {
    w.__navigation.unmount(); dom.window.close();
    assert.equal(requests, 0); assert.deepEqual(errors, []);
  } };
}

test('rendered sidebar separates Operations, Investigate and Administration without exposing admin links', async () => {
  for (const admin of [false, true]) {
    const app = await mount('/cohorts' + scope, admin);
    try {
      const nav = app.find('nav[aria-label="Main navigation"]');
      const sections = [...nav.querySelectorAll(':scope > section')] as Element[];
      assert.deepEqual(sections.map(section => section.getAttribute('aria-label')), ['Operations', 'Investigate', 'Administration']);
      assert.deepEqual(sections.map(section => section.querySelectorAll('a').length), [5, 1, admin ? 3 : 2]);
      assert.match(sections[0].textContent!, /Progression & acquisition/);
      assert.match(sections[1].textContent!, /Exceptions, records & data quality/);
      assert.equal(nav.querySelector('a[href*="/funnel"]').getAttribute('aria-current'), 'location');
      assert.equal(Boolean(nav.querySelector('a[href*="/access-control"]')), admin);
      assert.equal(app.w.document.querySelectorAll('.cx-sidebar-review button').length, 1);
      assert.equal(app.w.document.querySelectorAll('.cx-theme-toggle').length, 0);
    } finally { app.close(); }
  }
});

test('single Display preferences retains explicit theme and table spacing actions with Escape focus return', async () => {
  const app = await mount('/overview' + scope);
  try {
    const trigger = await app.click('button', 'Display preferences');
    assert.equal(app.w.document.querySelectorAll('[aria-label="Theme selector"]').length, 1);
    await app.click('button', 'Compact table spacing');
    assert.equal(app.find('.cx-app').dataset.density, 'compact');
    await app.click('button', 'Compact table spacing');
    assert.equal(app.find('.cx-app').dataset.density, 'compact');
    await app.click('button', 'Comfortable table spacing');
    assert.equal(app.find('.cx-app').dataset.density, 'comfortable');
    for (const theme of ['Dark', 'Light', 'System']) {
      await app.click('[aria-label="Theme selector"] button', theme);
      assert.equal(app.w.localStorage.getItem('cx-theme'), theme.toLowerCase());
      assert.equal(app.find('[aria-label="Theme selector"] button', theme).getAttribute('aria-pressed'), 'true');
    }
    app.w.document.dispatchEvent(new app.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await app.wait(() => !app.find('[aria-label="Theme selector"]'));
    assert.equal(app.w.document.activeElement === trigger, true);
  } finally { app.close(); }
});

test('mobile fifth position identifies Sales and Commercial and preserves scope on secondary-area navigation', async () => {
  for (const [route, label, current, landing] of [
    ['/sales-activation', 'Sales', 'page', '/sales-activation'],
    ['/commercial', 'Commercial', 'page', '/commercial'],
    ['/reconciliation', 'Commercial', 'location', '/commercial'],
  ]) {
    const app = await mount(route + scope + '&drill=obsolete&search=obsolete');
    try {
      const nav = app.find('nav[aria-label="Mobile navigation"]');
      const fifth = nav.querySelector('.grid').lastElementChild;
      assert.equal(fifth.tagName, 'A'); assert.match(fifth.textContent, new RegExp(label));
      assert.equal(fifth.getAttribute('aria-current'), current);
      fifth.focus(); fifth.click();
      await app.wait(() => app.w.__navigation.location === fifth.getAttribute('href'));
      // Wait for the route's overlay-reset and focus effect before opening navigation.
      if (route !== landing) await app.wait(() => app.w.document.activeElement === app.w.document.querySelector('#main-content'));
      const url = new URL(app.w.__navigation.location, 'https://synthetic.invalid');
      assert.equal(url.searchParams.get('startDate'), '2026-09-01');
      assert.deepEqual(url.searchParams.getAll('workspace'), ['one', 'two']);
      assert.equal(url.searchParams.get('drill'), null); assert.equal(url.searchParams.get('search'), null);
      await app.click('button', 'Open navigation');
      await app.wait(() => app.find('[role="dialog"]', 'Navigation'));
    } finally { app.close(); }
  }
  const app = await mount('/admin?clientId=synthetic');
  try {
    const more = app.find('nav[aria-label="Mobile navigation"] button');
    assert.equal(more.textContent.trim(), 'More');
    assert.equal(more.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(more.getAttribute('aria-current'), null);
  } finally { app.close(); }
});

test('More analyses retains native links, scoped navigation, Escape and route/history dismissal', async () => {
  const app = await mount('/speed-to-lead' + scope);
  try {
    const trigger = await app.click('button', 'More analyses');
    const group = app.find('[role="group"]', 'More analyses');
    assert.ok(group.querySelector('a[href*="/agent-performance"]'));
    assert.equal(group.querySelectorAll('[role="menuitem"]').length, 0);
    app.w.document.dispatchEvent(new app.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await app.wait(() => !app.find('[role="group"]', 'More analyses'));
    assert.equal(app.w.document.activeElement === trigger, true);
    await app.click('button', 'More analyses');
    app.find('[role="group"]', 'More analyses').querySelector('a[href*="/agent-performance"]').click();
    await app.wait(() => app.w.__navigation.location.startsWith('/agent-performance'));
    await app.wait(() => app.w.document.activeElement === app.find('#main-content'));
    assert.equal(app.find('[role="group"]', 'More analyses'), undefined);
    assert.equal(new URL(app.w.__navigation.location, 'https://synthetic.invalid').searchParams.get('startDate'), '2026-09-01');
    await app.click('button', 'More analyses');
    app.w.__navigation.navigate(-1);
    await app.wait(() => app.w.__navigation.location.startsWith('/speed-to-lead'));
    await app.wait(() => !app.find('[role="group"]', 'More analyses'));
  } finally { app.close(); }
});

test('palette area headings preserve option indexes, intent searches and admin visibility', async () => {
  for (const admin of [false, true]) {
    const app = await mount('/overview' + scope, admin);
    try {
      await app.click('button', 'Search pages');
      const input = app.find('input', 'Search pages and navigation');
      await app.wait(() => app.find('[role="option"]'));
      assert.ok(app.w.document.querySelectorAll('.cx-command-group-label').length > 1);
      const options = [...app.w.document.querySelectorAll('[role="option"]')] as HTMLElement[];
      assert.deepEqual(options.map(option => option.querySelector('strong')!.textContent), searchNavigation('', admin).map(page => page.name));
      input.dispatchEvent(new app.w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await app.wait(() => options[1].getAttribute('aria-selected') === 'true');
      assert.equal(input.getAttribute('aria-activedescendant'), options[1].id);
      input.dispatchEvent(new app.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await app.wait(() => app.w.__navigation.location.startsWith(searchNavigation('', admin)[1].path));
      await app.wait(() => app.w.document.activeElement === app.find('#main-content'));
      await app.click('button', 'Search pages');
      await app.input(app.find('input', 'Search pages and navigation'), 'Lead ledger');
      assert.equal(app.w.document.querySelectorAll('[role="option"]').length, admin ? 1 : 0);
    } finally { app.close(); }
  }
  for (const [query, destination] of [
    ['Why is conversion down?', '/overview'], ['First call', '/speed-to-lead'],
    ['Revenue', '/commercial'], ['Vendor quality', '/vendor-quality'], ['Campaign', '/campaigns'],
  ]) assert.ok(searchNavigation(query, false).some(page => page.path === destination), query);
});

test('palette appearance group retains Dark theme keyboard action', async () => {
  const app = await mount('/overview' + scope);
  try {
    await app.click('button', 'Search pages');
    const input = app.find('input', 'Search pages and navigation');
    await app.input(input, 'Dark theme');
    assert.equal(app.find('.cx-command-group-label').textContent, 'Display preferences');
    input.dispatchEvent(new app.w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await app.wait(() => app.find('[role="option"][aria-selected="true"]').textContent.includes('Dark Theme'));
    input.dispatchEvent(new app.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await app.wait(() => app.w.document.documentElement.dataset.theme === 'dark');
    assert.equal(app.w.__navigation.location, '/overview' + scope);
    assert.equal(app.find('[role="dialog"]'), undefined);
  } finally { app.close(); }
});
