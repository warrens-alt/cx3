import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';
import { searchNavigation } from '../src/lib/navigation';
import { BUSINESS_AREAS, getAreaForPath, getRouteItem } from '../src/app/routeManifest';
import { SIDEBAR_COLLAPSED_KEY } from '../src/lib/presentation';

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

async function mount(route: string, admin = false, collapsed = false) {
  const errors: string[] = [];
  const console = new VirtualConsole();
  console.on('jsdomError', (error: Error) => errors.push(error.message));
  console.on('error', (...args: unknown[]) => errors.push(args.map(String).join(' ')));
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://synthetic.invalid', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console,
  });
  const w = dom.window as any;
  w.__navigation = { route, admin };
  if (collapsed) w.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true');
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

test('persistent sidebar exposes exactly seven canonical business areas for every role', async () => {
  for (const admin of [false, true]) {
    const app = await mount('/journey/cohorts' + scope, admin);
    try {
      const nav = app.find('nav[aria-label="Main navigation"]');
      const links = [...nav.querySelectorAll('a')] as HTMLAnchorElement[];
      assert.deepEqual(links.map(link => new URL(link.href).pathname), BUSINESS_AREAS.map(area => area.landingPath));
      assert.deepEqual(links.map(link => link.getAttribute('aria-label')), BUSINESS_AREAS.map(area => area.name));
      assert.equal(nav.querySelectorAll('a[aria-current]').length, 1);
      assert.equal(nav.querySelector('a[href*="/journey"]').getAttribute('aria-current'), 'location');
      assert.equal(nav.querySelectorAll('small').length, 0, 'Descriptions do not compete with the area labels');
      for (const path of ['/lead-explorer', '/evidence/releases', '/lead-ledger', '/evidence/vendors', '/evidence/warehouse', '/access-control']) {
        assert.equal(nav.querySelector(`a[href*="${path}"]`), null, `${path} belongs inside its area`);
      }
      assert.equal(app.w.document.querySelectorAll('.cx-sidebar-review button').length, 1);
      assert.equal(app.w.document.querySelectorAll('.cx-sidebar-search').length, 0, 'Desktop search has one topbar owner');
    } finally { app.close(); }
  }
});

test('collapsed desktop rail retains every area, label and active state and persists only presentation', async () => {
  const app = await mount('/operations/response' + scope);
  try {
    const trigger = await app.click('button', 'Collapse navigation');
    const rail = app.find('#desktop-navigation');
    assert.equal(rail.dataset.collapsed, 'true');
    assert.equal(rail.hasAttribute('inert'), false);
    assert.equal(rail.getAttribute('aria-hidden'), null);
    assert.equal(rail.querySelectorAll('.cx-nav-link').length, 7);
    for (const link of rail.querySelectorAll('.cx-nav-link')) assert.equal(link.title, link.getAttribute('aria-label'));
    assert.equal(rail.querySelector('.cx-nav-link[aria-current]').dataset.navigationArea, 'contact');
    assert.equal(app.w.localStorage.getItem(SIDEBAR_COLLAPSED_KEY), 'true');
    assert.equal(app.w.__navigation.location, '/operations/response' + scope);
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    await app.click('button', 'Expand navigation');
    assert.equal(rail.dataset.collapsed, 'false');
    assert.equal(app.w.localStorage.getItem(SIDEBAR_COLLAPSED_KEY), 'false');
  } finally { app.close(); }
  const restored = await mount('/command' + scope, false, true);
  try { assert.equal(restored.find('#desktop-navigation').dataset.collapsed, 'true'); }
  finally { restored.close(); }
});

test('single Display preferences retains explicit theme and table spacing actions with Escape focus return', async () => {
  const app = await mount('/command' + scope);
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

test('mobile destinations stay stable and More opens only the remaining areas with scope and focus preserved', async () => {
  for (const route of ['/command', '/journey', '/operations/contact', '/investigate', '/journey/outcomes', '/commercial', '/commercial/reconciliation', '/admin']) {
    const app = await mount(route + scope + '&drill=obsolete&search=obsolete');
    try {
      const nav = app.find('nav[aria-label="Mobile navigation"]');
      const items = [...nav.querySelector('.cx-mobile-nav-items').children] as HTMLElement[];
      assert.deepEqual(items.map(item => item.querySelector('span')!.textContent), ['Command', 'Journey', 'Operations', 'Investigate', 'More']);
      const more = items[4];
      assert.equal(more.tagName, 'BUTTON');
      assert.equal(more.getAttribute('aria-haspopup'), 'dialog');
      more.focus(); more.click();
      await app.wait(() => app.find('[role="dialog"]', 'More areas'));
      const drawer = app.find('[role="dialog"]', 'More areas');
      assert.deepEqual([...drawer.querySelectorAll('.cx-nav-link')].map((link: any) => link.dataset.navigationArea), ['commercial', 'evidence', 'settings']);
      app.w.document.dispatchEvent(new app.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await app.wait(() => !app.find('[role="dialog"]'));
      assert.equal(app.w.document.activeElement, more);
      more.click();
      await app.wait(() => app.find('[role="dialog"]', 'More areas'));
      const destination = app.find('[role="dialog"]', 'More areas').querySelector('a[href*="/commercial"]');
      const href = destination.getAttribute('href');
      destination.click();
      await app.wait(() => app.w.__navigation.location === href);
      await app.wait(() => !app.find('[role="dialog"]'));
      const url = new URL(app.w.__navigation.location, 'https://synthetic.invalid');
      assert.equal(url.searchParams.get('startDate'), '2026-09-01');
      assert.deepEqual(url.searchParams.getAll('workspace'), ['one', 'two']);
      assert.equal(url.searchParams.get('drill'), null);
      assert.equal(url.searchParams.get('search'), null);
    } finally { app.close(); }
  }
});

test('More analyses retains native links, scoped navigation, Escape and route/history dismissal', async () => {
  const app = await mount('/operations/response' + scope);
  try {
    const trigger = await app.click('button', 'More analyses');
    const group = app.find('[role="group"]', 'More analyses');
    assert.ok(group.querySelector('a[href*="/operations/agents"]'));
    assert.equal(group.querySelectorAll('[role="menuitem"]').length, 0);
    app.w.document.dispatchEvent(new app.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await app.wait(() => !app.find('[role="group"]', 'More analyses'));
    assert.equal(app.w.document.activeElement === trigger, true);
    await app.click('button', 'More analyses');
    app.find('[role="group"]', 'More analyses').querySelector('a[href*="/operations/agents"]').click();
    await app.wait(() => app.w.__navigation.location.startsWith('/operations/agents'));
    await app.wait(() => app.w.document.activeElement === app.find('#main-content'));
    assert.equal(app.find('[role="group"]', 'More analyses'), undefined);
    assert.equal(new URL(app.w.__navigation.location, 'https://synthetic.invalid').searchParams.get('startDate'), '2026-09-01');
    await app.click('button', 'More analyses');
    app.w.__navigation.navigate(-1);
    await app.wait(() => app.w.__navigation.location.startsWith('/operations/response'));
    await app.wait(() => !app.find('[role="group"]', 'More analyses'));
  } finally { app.close(); }
});

test('palette area headings preserve option indexes, intent searches and admin visibility', async () => {
  for (const admin of [false, true]) {
    const app = await mount('/command' + scope, admin);
    try {
      await app.click('button', 'Search workspaces');
      const input = app.find('input', 'Search pages and navigation');
      await app.wait(() => app.find('[role="option"]'));
      assert.equal(app.w.document.querySelectorAll('.cx-command-group-label').length, 1);
      assert.equal(app.find('.cx-command-group-label').textContent, 'Suggested');
      const options = [...app.w.document.querySelectorAll('[role="option"]')] as HTMLElement[];
      assert.deepEqual(options.map(option => option.querySelector('strong')!.textContent), ['Command', 'Journey', 'Operations', 'Investigate', 'Commercial', 'Evidence']);
      assert.deepEqual(options.map(option => option.dataset.navigationArea), ['overview', 'journey', 'contact', 'investigate', 'commercial', 'evidence']);
      assert.ok(options.every(option => option.querySelector('.cx-command-area-icon[aria-hidden="true"]')));
      input.dispatchEvent(new app.w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await app.wait(() => options[1].getAttribute('aria-selected') === 'true');
      assert.equal(input.getAttribute('aria-activedescendant'), options[1].id);
      input.dispatchEvent(new app.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await app.wait(() => app.w.__navigation.location.startsWith(searchNavigation('', admin)[1].path));
      await app.wait(() => app.w.document.activeElement === app.find('#main-content'));
      await app.click('button', 'Search workspaces');
      await app.input(app.find('input', 'Search pages and navigation'), 'Lead ledger');
      assert.equal(app.w.document.querySelectorAll('[role="option"]').length, admin ? 1 : 0);
      if (admin) {
        assert.equal(app.find('[role="option"] strong').textContent, 'Lead Evidence');
        app.find('[role="option"]').click();
        await app.wait(() => app.w.__navigation.location.startsWith('/lead-explorer?'));
        const destination = new URL(app.w.__navigation.location, 'https://synthetic.invalid');
        assert.equal(destination.searchParams.get('clientId'), 'synthetic');
        assert.deepEqual(destination.searchParams.getAll('workspace'), ['one', 'two']);
      }
    } finally { app.close(); }
  }
  for (const [query, destination] of [
    ['Why is conversion down?', '/command'], ['First call', '/operations/response'],
    ['Revenue', '/commercial'], ['Vendor quality', '/journey/vendors'], ['Campaign', '/journey/acquisition'],
  ]) assert.ok(searchNavigation(query, false).some(page => page.path === destination), query);
});

test('palette appearance group retains Dark theme keyboard action', async () => {
  const app = await mount('/command' + scope);
  try {
    await app.click('button', 'Search workspaces');
    const input = app.find('input', 'Search pages and navigation');
    await app.input(input, 'Dark theme');
    assert.equal(app.find('.cx-command-group-label').textContent, 'Display preferences');
    assert.equal(app.find('[role="option"]').getAttribute('data-navigation-area'), null);
    input.dispatchEvent(new app.w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await app.wait(() => app.find('[role="option"][aria-selected="true"]').textContent.includes('Dark Theme'));
    input.dispatchEvent(new app.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await app.wait(() => app.w.document.documentElement.dataset.theme === 'dark');
    assert.equal(app.w.__navigation.location, '/command' + scope);
    assert.equal(app.find('[role="dialog"]'), undefined);
  } finally { app.close(); }
});

test('canonical and alias routes agree across area links, contextual navigation and compact breadcrumb', async () => {
  for (const route of ['/insights', '/acquisition', '/calls', '/outcomes', '/commercial/reconciliation', '/explorer', '/lead-ledger', '/settings', '/validation', '/ai-insights']) {
    const app = await mount(route + scope, true);
    try {
      const area = getAreaForPath(route);
      const page = getRouteItem(route)!;
      const selected = app.find('.cx-navigation a[aria-current]');
      assert.equal(selected.dataset.navigationArea, area.id, route);
      assert.equal(selected.getAttribute('aria-current'), page.path === area.landingPath ? 'page' : 'location', route);
      assert.equal(app.find('.cx-area-nav').dataset.navigationArea, area.id, route);
      const breadcrumb = app.find('.cx-breadcrumb');
      assert.equal(breadcrumb.dataset.navigationArea, area.id, route);
      assert.match(breadcrumb.textContent, new RegExp(area.name.replace('&', '&')));
      assert.ok(breadcrumb.textContent.includes(page.name));
      assert.equal(breadcrumb.querySelectorAll('a').length, 1, 'Brand is not repeated in the breadcrumb');
      assert.equal(app.find('.cx-mobile-nav-active').dataset.navigationArea, area.id, route);
      assert.ok(app.find('.cx-mobile-nav-active .cx-mobile-nav-dot[aria-hidden="true"]'));
      assert.equal(app.find('#main-content').closest('[data-navigation-area]'), null, 'Area colour must not cascade into analysis');
      assert.equal(app.find('.cx-app').getAttribute('data-navigation-area'), null);
    } finally { app.close(); }
  }
});

test('contextual pages have one area owner and retain administrative visibility', async () => {
  for (const admin of [false, true]) {
    for (const route of ['/journey/outcomes', '/commercial', '/admin', '/investigate']) {
      const app = await mount(route + scope, admin);
      try {
        const nav = app.find('.cx-area-nav');
        const area = getAreaForPath(route);
        const trigger = nav.querySelector('.cx-area-more-trigger');
        if (trigger) { trigger.click(); await app.wait(() => nav.querySelector('.cx-area-more-menu')); }
        for (const link of nav.querySelectorAll('a')) {
          const page = getRouteItem(new URL(link.href).pathname)!;
          assert.equal(page.area, area.id, `${route} must not borrow ${page.path}`);
          assert.ok(admin || !page.adminOnly, `${page.path} must remain hidden from ordinary viewers`);
        }
        if (route === '/admin') {
          assert.equal(Boolean(nav.querySelector('a[href*="/access-control"]')), admin);
          assert.equal(Boolean(nav.querySelector('a[href*="/validation"]')), admin);
          assert.equal(nav.querySelector('a[href*="/evidence/warehouse"]'), null, 'Warehouse belongs to Evidence');
        }
      } finally { app.close(); }
    }
  }
});

test('More analyses carries its parent area label and selected link semantics', async () => {
  const app = await mount('/quality' + scope);
  try {
    const trigger = await app.click('button', 'More analyses');
    assert.equal(trigger.dataset.currentSection, 'true');
    assert.equal(app.find('.cx-area-more-heading').textContent, 'More Journey analysis');
    const current = app.find('.cx-area-more-item[aria-current="page"]');
    assert.match(current.textContent, /Vendor quality/);
    assert.equal(current.closest('[data-navigation-area]').dataset.navigationArea, 'journey');
    assert.ok(current.querySelector('.cx-area-more-indicator[aria-hidden="true"]'));
    app.w.document.dispatchEvent(new app.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await app.wait(() => !app.find('.cx-area-more-heading'));
    assert.equal(app.w.document.activeElement, trigger);
  } finally { app.close(); }
});
