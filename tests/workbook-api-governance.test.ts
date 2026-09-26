import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { analyticsRouter } from '../server/api';
import { AnalyticsBigQueryClient, getBigQueryClient, guardedQueryOptions } from '../server/bigquery/client';
import { getClientConfig } from '../server/bigquery/config';
import { serverQueryCache } from '../server/cache';
import type { Principal } from '../server/securityPolicy';

async function withApi(principal: Principal, work: (url: string) => Promise<void>, onRequest?: () => void) {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => { onRequest?.(); res.locals.principal = principal; next(); });
  app.use('/api/analytics', analyticsRouter);
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status || 500).json({ success: false, error: error.message });
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await work(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/analytics`); }
  finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

const viewer: Principal = { subject: 'workbook-fixture', email: 'fixture@example.invalid', role: 'viewer', tenants: ['mtn', 'ontact_blc'] };

// Workbook 2_API_Endpoints!A2 documents this header as a workspace selector.
test('X-Client-Id selects an authorized tenant and canonical aliases agree', async () => {
  await withApi(viewer, async url => {
    const headerOnly = await fetch(`${url}/offernet/client-config`, { headers: { 'X-Client-Id': 'mtn' } });
    assert.equal(headerOnly.status, 200);
    assert.equal((await headerOnly.json()).data.id, 'mtn');
    const alias = await fetch(`${url}/offernet/client-config?clientId=ontact_blc`, { headers: { 'X-Client-Id': 'blc' } });
    assert.equal(alias.status, 200);
    assert.equal((await alias.json()).data.id, 'ontact_blc');
    const denied = await fetch(`${url}/offernet/client-config`, { headers: { 'X-Client-Id': 'default_tenant' } });
    assert.equal(denied.status, 403, 'A header never grants access to another workspace');
  });
});

test('conflicting query, body and header selectors fail before analytical work', async () => {
  await withApi(viewer, async url => {
    const conflict = await fetch(`${url}/offernet/client-config?clientId=mtn`, { headers: { 'X-Client-Id': 'blc' } });
    assert.equal(conflict.status, 400);
    assert.match((await conflict.json()).error, /Conflicting clientId/);
    const bodyConflict = await fetch(`${url}/explain?clientId=mtn`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Client-Id': 'mtn' }, body: JSON.stringify({ clientId: 'blc' }),
    });
    assert.equal(bodyConflict.status, 400);
    assert.match((await bodyConflict.json()).error, /Conflicting clientId/);
    assert.equal((await fetch(`${url}/offernet/client-config`, { headers: { 'X-Client-Id': 'mtn,blc' } })).status, 400);
  });
});

// Workbook GR-07 takes precedence over its broad "All Roles" export description.
test('workbook integrations preserve administrator-only lead records, timelines and exports', async () => {
  await withApi(viewer, async url => {
    for (const path of ['/offernet/raw-leads', '/offernet/lead-timeline/synthetic-lead', '/export?grain=lead']) {
      const response = await fetch(`${url}${path}`, { headers: { 'X-Client-Id': 'mtn' } });
      assert.equal(response.status, 403, path);
    }
  });
});

test('OfferNet query results expire with the documented 60-second response cache', async context => {
  let clock = Date.now();
  let queryCalls = 0;
  context.mock.method(Date, 'now', () => clock);
  context.mock.method(getBigQueryClient(getClientConfig('mtn').bigQueryProject), 'query', async () => {
    queryCalls++;
    return [[]];
  });
  serverQueryCache.clear();
  try {
    await withApi(viewer, async url => {
      const read = () => fetch(`${url}/offernet/contact-strategy`, { headers: { 'X-Client-Id': 'mtn' } });
      assert.equal((await read()).status, 200);
      assert.equal(queryCalls, 1);
      clock += 30_000;
      assert.equal((await read()).status, 200);
      assert.equal(queryCalls, 1, 'The fresh response reuses the original query');
      clock += 31_000;
      assert.equal((await read()).status, 200);
      assert.equal(queryCalls, 2, 'An expired response must not reuse a stale 120-second query result');
    });
  } finally { serverQueryCache.clear(); }
});

test('equivalent tenant selectors cannot renew an ageing nested query result', async context => {
  let clock = Date.now();
  let queryCalls = 0;
  context.mock.method(Date, 'now', () => clock);
  context.mock.method(getBigQueryClient(getClientConfig('mtn').bigQueryProject), 'query', async () => {
    queryCalls++;
    return [[]];
  });
  serverQueryCache.clear();
  try {
    await withApi(viewer, async url => {
      const read = (suffix = '') => fetch(`${url}/offernet/contact-strategy${suffix}`, { headers: { 'X-Client-Id': 'mtn' } });
      assert.equal((await read()).status, 200);
      assert.equal(queryCalls, 1);
      clock += 59_000;
      assert.equal((await read('?clientId=mtn')).status, 200);
      assert.equal(queryCalls, 2, 'A new response entry must not reset the TTL of a 59-second-old nested result');
      clock += 2_000;
      assert.equal((await read('?clientId=mtn')).headers.get('X-Cache'), 'HIT');
      assert.equal(queryCalls, 2, 'This entry contains the query result from two seconds ago');
      clock += 59_000;
      assert.equal((await read('?clientId=mtn')).status, 200);
      assert.equal(queryCalls, 3);
    });
  } finally { serverQueryCache.clear(); }
});

test('OfferNet still deduplicates equivalent requests while analytical work is in flight', { timeout: 5000 }, async context => {
  let queryCalls = 0;
  let acceptedRequests = 0;
  let release!: (value: any) => void;
  context.mock.method(getBigQueryClient(getClientConfig('mtn').bigQueryProject), 'query', async () => {
    queryCalls++;
    return new Promise(resolve => { release = resolve; });
  });
  serverQueryCache.clear();
  try {
    await withApi(viewer, async url => {
      const options = { headers: { 'X-Client-Id': 'mtn' } };
      const first = fetch(`${url}/offernet/contact-strategy`, options);
      while (!release) await new Promise(resolve => setImmediate(resolve));
      const second = fetch(`${url}/offernet/contact-strategy?clientId=mtn`, options);
      while (acceptedRequests < 2) await new Promise(resolve => setImmediate(resolve));
      assert.equal(queryCalls, 1);
      release([[]]);
      assert.deepEqual((await Promise.all([first, second])).map(response => response.status), [200, 200]);
      assert.equal(queryCalls, 1);
    }, () => { acceptedRequests++; });
  } finally { release?.([[]]); serverQueryCache.clear(); }
});

test('read-only warehouse boundary blocks destination writes and non-query statements before SDK calls', async () => {
  let calls = 0;
  const client = new AnalyticsBigQueryClient({
    query: async () => { calls++; return [[]]; },
    createQueryJob: async () => { calls++; return [{}]; },
  } as any);
  for (const options of [
    { query: 'SELECT 1', destination: 'project.dataset.output' },
    { query: 'SELECT 1', writeDisposition: 'WRITE_TRUNCATE' },
    { query: 'SELECT 1', createDisposition: 'CREATE_IF_NEEDED' },
    { query: "EXPORT DATA OPTIONS(uri='gs://bucket/file.csv',format='CSV') AS SELECT 1" },
    { query: 'CALL project.dataset.procedure()' },
    { query: "EXECUTE IMMEDIATE 'SELECT 1'" },
    { query: 'SELECT 1; DELETE FROM `project.dataset.table` WHERE TRUE' },
    { query: 'WITH rows AS (SELECT 1) INSERT INTO `project.dataset.table` SELECT * FROM rows' },
    { query: 'SELECT 1; SELECT 2' },
    { query: '/* unterminated' },
  ]) {
    await assert.rejects(client.query(options as any), /Read-only|Unterminated/);
    assert.throws(() => client.createQueryJob(options as any), /Read-only|Unterminated/);
  }
  assert.equal(calls, 0);
});

test('query boundary allows literal keyword labels, quoted identifiers and ordinary generated CTEs', () => {
  for (const query of [
    "-- DELETE is a comment\nSELECT 'CREATE; UPDATE' AS description",
    "WITH data AS (SELECT 1 AS n) SELECT n FROM data; /* export */",
    'SELECT `update` FROM `project.dataset.table`',
    'SELECT """DROP; TABLE""" AS description',
    "SELECT REGEXP_CONTAINS('1970-01-01', r'^(1900|1970)(-|$)')",
  ]) assert.equal(guardedQueryOptions({ query }).query, query);
});
