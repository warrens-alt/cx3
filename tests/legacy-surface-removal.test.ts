import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ROUTE_MANIFEST } from '../src/app/routeManifest';
import { NAVIGATION_PAGES, navigationPage, searchNavigation } from '../src/lib/navigation';

test('legacy Lead Engine has no route, navigation, search or alias entry', () => {
  const app = readFileSync('src/app/AppRouter.tsx', 'utf8');
  assert.doesNotMatch(app, /lead-engine|leadEngine|LeadEngine/);
  for (const route of ROUTE_MANIFEST) {
    assert.notEqual(route.path, '/lead-engine');
    assert.ok(!route.urlAliases?.includes('/lead-engine'));
  }
  assert.ok(!NAVIGATION_PAGES.some(page => /lead.?engine/i.test(`${page.path} ${page.name}`)));
  assert.equal(navigationPage('/lead-engine'), undefined);
  for (const admin of [true, false]) {
    assert.equal(searchNavigation('Lead Engine', admin).length, 0);
    assert.ok(!searchNavigation('', admin).some(page => page.path === '/lead-engine'));
  }
});

test('unused Lead Engine frontend and backend packages are deleted', () => {
  assert.equal(existsSync('src/leadEngine'), false);
  assert.equal(existsSync('server/leadEngine'), false);
});
