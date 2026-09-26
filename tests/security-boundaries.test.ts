import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('production authentication is fail closed and local bypass is explicit', () => {
  const server = read('server.ts');
  assert.ok(server.includes("process.env.NODE_ENV !== 'production' && process.env.CX_ALLOW_DEV_AUTH === 'true'"));
  assert.ok(server.includes(': authenticate();'));
});

test('arbitrary BigQuery browsing is retired', () => {
  const server = read('server.ts');
  assert.doesNotMatch(server, /app\.get\('\/api\/bq\/(?:projects|datasets|tables|preview|filter-options)'/);
  assert.match(server, /app\.use\('\/api\/bq'[\s\S]*?410/);
});

test('operational analytics are never globally stamped VERIFIED', () => {
  const server = read('server.ts');
  assert.doesNotMatch(server, /X-Analytics-Status['"],\s*['"]VERIFIED/);
  assert.match(server, /X-Analytics-Status['"],\s*['"]UNVERIFIED/);
});

test('known manufactured analytics are absent', () => {
  const analytics = read('server/bigquery/offernet_analytics.ts');
  assert.doesNotMatch(analytics, /overallHealthScore:\s*94\.6/);
  assert.doesNotMatch(analytics, /SUM\(budget\)\s+AS\s+total_spend/i);
  assert.doesNotMatch(analytics, /const unitLeadCost\s*=\s*45/);
  assert.doesNotMatch(analytics, /carrier spam reputation risk by 34/i);
  assert.doesNotMatch(analytics, /Business hours contact rate:\s*31\.4/i);
});

test('new Firebase profiles cannot self-activate', () => {
  const rules = read('firestore.rules');
  assert.match(rules, /data\.status == 'pending'/);
  assert.doesNotMatch(rules, /data\.status in \['pending', 'active'\]/);
});

test('production start executes only the generated dist bundle', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.start, 'node dist/server/server.mjs');
  assert.equal(fs.existsSync('server.js'), false);
});
