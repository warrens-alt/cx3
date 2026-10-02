import test from 'node:test';
import assert from 'node:assert/strict';
import fs, { readFileSync } from 'node:fs';
import { NAV_GROUPS, NAVIGATION_PAGES, navigationPage, primarySection, relatedPages, searchNavigation } from '../src/lib/navigation';

test('plain-language questions and legacy acronyms find the intended page', () => {
  for (const [query, path] of [['first call', '/operations/response'], ['caller id', '/operations/cli'], ['CLI', '/operations/cli'], ['agent performance', '/operations/agents'], ['appearance', '/admin'], ['media spend', '/journey/acquisition'], ['why is conversion down', '/command'], ['stuck sales', '/journey/outcomes']]) {
    assert.ok(searchNavigation(query, false).some(page => page.path === path), query);
  }
  assert.deepEqual(searchNavigation('page that does not exist', true), []);
  assert.equal(searchNavigation('sales activation', false)[0].path, '/journey/outcomes');
  assert.equal(searchNavigation('caller ID performance', false)[0].path, '/operations/cli');
});
test('administrative and record-level links retain role-based visibility', () => {
  assert.ok(searchNavigation('users', true).some(page => page.path === '/access-control'));
  assert.ok(!searchNavigation('users', false).some(page => page.path === '/access-control'));
  assert.ok(!searchNavigation('', false).some(page => page.adminOnly));
  assert.ok(!relatedPages('settings', false).some(page => page.adminOnly));
  assert.ok(relatedPages('settings', true).some(page => page.path === '/access-control'));
  assert.ok(!relatedPages('exceptions', false).some(page => page.path === '/lead-explorer'));
  assert.ok(relatedPages('exceptions', true).some(page => page.path === '/lead-explorer'));
});
test('Lead Evidence is one destination for both current and legacy record searches', () => {
  for (const query of ['Lead Evidence', 'Lead Ledger', 'ledger', 'source ledger', 'analytical ledger', 'raw source', 'record explorer', 'timeline']) {
    const results = searchNavigation(query, true);
    assert.equal(results.filter(page => page.path === '/lead-explorer').length, 1, query);
    assert.ok(!results.some(page => page.path === '/lead-ledger'), query);
    assert.ok(!searchNavigation(query, false).some(page => page.path === '/lead-explorer'), query);
  }
  assert.equal(navigationPage('/lead-ledger')?.path, '/lead-explorer');
  assert.equal(navigationPage('/lead-ledger')?.name, 'Lead Evidence');
  assert.ok(!relatedPages('exceptions', true).some(page => page.path === '/lead-ledger'));
  assert.equal(NAVIGATION_PAGES.find(page => page.path === '/lead-explorer')?.description, 'Inspect analytical lead populations, journeys, outcomes, audit evidence and original source records.');
});
test('six business destinations replace competing primary dashboards without retiring routes', () => {
  assert.deepEqual(NAV_GROUPS[0].items.map(item => item.name), ['Command', 'Journey', 'Operations', 'Investigate', 'Commercial', 'Evidence']);
  assert.equal(navigationPage('/')?.path, '/command');
  assert.equal(navigationPage('/users')?.path, '/access-control');
  assert.equal(navigationPage('/settings')?.path, '/admin');
  assert.equal(navigationPage('/journey/cohorts')?.section, 'funnel');
  assert.equal(navigationPage('/operations/agents')?.section, 'contact');
  assert.equal(navigationPage('/journey/acquisition')?.section, 'funnel');
  assert.equal(navigationPage('/journey/outcomes')?.section, 'funnel');
  assert.equal(navigationPage('/commercial')?.section, 'commercial');
  assert.equal(primarySection('performance'), 'funnel');
  assert.equal(primarySection('evidence'), 'evidence');
  assert.ok(relatedPages('funnel', false).some(page => page.path === '/journey/vendors'));
  assert.ok(!relatedPages('contact', false).some(page => page.path === '/commercial'));
  const routerFile = fs.existsSync(new URL('../src/app/AppRouter.tsx', import.meta.url))
    ? '../src/app/AppRouter.tsx'
    : '../src/App.tsx';
  const app = readFileSync(new URL(routerFile, import.meta.url), 'utf8');
  const paths = new Set(Array.from(app.matchAll(/<Route path="([^"]+)"/g), match => match[1]));
  assert.equal(new Set(NAVIGATION_PAGES.map(page => page.path)).size, NAVIGATION_PAGES.length);
  for (const page of NAVIGATION_PAGES) assert.ok(paths.has(page.path), `${page.path} must be an existing route`);
});

test('every supported route is searchable under one canonical area and contextual pages never borrow another area', async () => {
  const { BUSINESS_AREAS, ROUTE_MANIFEST, getAreaForPath } = await import('../src/app/routeManifest');
  for (const route of ROUTE_MANIFEST) {
    assert.ok(searchNavigation(route.name, true).some(page => page.path === route.path), route.path);
    assert.equal(navigationPage(route.path)?.name, route.name);
    for (const alias of route.urlAliases || []) {
      assert.equal(navigationPage(alias)?.path, route.path, alias);
      assert.equal(getAreaForPath(alias).id, route.area, alias);
    }
    const owners = BUSINESS_AREAS.filter(area => [...area.primaryTabs, ...area.moreViews].some(page => page.path === route.path));
    assert.deepEqual(owners.map(area => area.id), route.isPrimaryTab || route.isMoreView ? [route.area] : []);
  }
  assert.equal(navigationPage('/evidence/warehouse')?.section, 'evidence');
  assert.equal(navigationPage('/ai-insights')?.section, 'exceptions');
  assert.ok(!searchNavigation('Validation suite', false).some(page => page.path === '/validation'));
  assert.ok(searchNavigation('Validation suite', true).some(page => page.path === '/validation'));
});
