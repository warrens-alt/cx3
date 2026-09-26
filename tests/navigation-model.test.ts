import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NAVIGATION_PAGES, navigationPage, relatedPages, searchNavigation } from '../src/lib/navigation';

test('plain-language searches and legacy acronyms find the intended page', () => {
  for (const [query, path] of [
    ['first call', '/speed-to-lead'], ['caller id', '/cli-performance'], ['CLI', '/cli-performance'],
    ['agent performance', '/agent-performance'], ['appearance', '/admin'], ['media spend', '/campaigns'],
  ]) {
    assert.ok(searchNavigation(query, false).some(page => page.path === path), query);
  }
  assert.deepEqual(searchNavigation('page that does not exist', true), []);
  assert.equal(searchNavigation('sales activation', false)[0].path, '/sales-activation', 'A page-title match precedes broader description matches');
  assert.equal(searchNavigation('caller ID performance', false)[0].path, '/cli-performance');
});

test('administrative search and related links retain role-based visibility', () => {
  assert.ok(searchNavigation('users', true).some(page => page.path === '/access-control'));
  assert.ok(!searchNavigation('users', false).some(page => page.path === '/access-control'));
  assert.ok(!searchNavigation('', false).some(page => page.adminOnly));
  assert.ok(!relatedPages('settings', false).some(page => page.adminOnly));
  assert.ok(relatedPages('settings', true).some(page => page.path === '/access-control'));
});

test('related navigation follows canonical sections while all destinations resolve to existing routes', () => {
  assert.equal(navigationPage('/')?.path, '/overview');
  assert.equal(navigationPage('/users')?.path, '/access-control');
  assert.equal(navigationPage('/settings')?.path, '/admin');
  assert.equal(navigationPage('/cohorts')?.section, 'funnel');
  assert.equal(navigationPage('/agent-performance')?.section, 'contact');
  assert.equal(navigationPage('/campaigns')?.section, 'performance');
  assert.equal(navigationPage('/data-integrity')?.section, 'evidence');
  assert.ok(relatedPages('contact', false).some(page => page.path === '/speed-to-lead'));
  assert.ok(!relatedPages('contact', false).some(page => page.path === '/commercial'));
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const paths = new Set(Array.from(app.matchAll(/<Route path="([^"]+)"/g), match => match[1]));
  assert.equal(new Set(NAVIGATION_PAGES.map(page => page.path)).size, NAVIGATION_PAGES.length);
  for (const page of NAVIGATION_PAGES) assert.ok(paths.has(page.path), `${page.path} must be an existing route`);
});
