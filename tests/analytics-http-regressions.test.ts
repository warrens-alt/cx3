import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { analyticsRouter } from '../server/api';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig } from '../server/bigquery/config';
import { clearTenantImport, parseAndValidateCliCsv, setTenantImport } from '../server/bigquery/cli_analytics';

async function withApi(work: (url: string) => Promise<void>) {
  const app = express();
  app.use((_req, res, next) => {
    res.locals.principal = { subject: 'http-regression', role: 'admin', tenants: ['default_tenant'] };
    next();
  });
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

test('HTTP CLI export keeps URL dates, exact filters and table search through every route layer', async context => {
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  context.mock.method(client, 'dataset', (() => ({ table: () => ({ getMetadata: async () => [{ type: 'TABLE', schema: { fields: [] } }] }) })) as any);
  context.mock.method(client, 'query', async () => { throw new Error('Unexpected warehouse query'); });
  context.mock.method(client, 'createQueryJob', async () => { throw new Error('Unexpected warehouse job'); });
  const parsed = parseAndValidateCliCsv([
    'cli_number,campaign_code,report_date,total_calls,contact_count,sale_count,vendor',
    '0875501001,Campaign A,2026-09-20,100,20,2,MTN',
    '0875501002,Campaign A,2026-09-20,200,40,4,MTN',
    '0875501002,Campaign A,2026-09-21,300,60,6,MTN',
    '0875501002,Campaign B,2026-09-20,400,80,8,Mondo',
  ].join('\n'));
  assert.deepEqual(parsed.errors, []);
  setTenantImport('default_tenant', { ...parsed, filename: 'http-fixture.csv', uploadedAt: '2026-09-26T00:00:00Z' });
  try {
    await withApi(async url => {
      const params = new URLSearchParams({
        clientId: 'default', startDate: '2026-09-20', endDate: '2026-09-20',
        grain: 'cli', format: 'json', search: '1002',
        filters: JSON.stringify({ vendor: { operator: 'equals', value: 'MTN' }, campaign: { operator: 'equals', value: 'Campaign A' } }),
      });
      const response = await fetch(`${url}/export?${params}`);
      const body = await response.json();
      assert.equal(response.status, 200, JSON.stringify(body));
      assert.equal(body.metadata.clientId, 'default_tenant');
      assert.equal(body.metadata.search, '1002');
      assert.equal(body.metadata.truncated, false);
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0]['CLI Number'], '0875501002');
      assert.equal(body.data[0]['Total Calls'], '200');
    });
  } finally { clearTenantImport('default_tenant'); }
});

test('HTTP operational requests reject unsupported scope before querying and preserve supported values', async context => {
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  const queries: any[] = [];
  context.mock.method(client, 'query', async (query: any) => { queries.push(query); return [[]] as any; });
  await withApi(async url => {
    const params = new URLSearchParams({ clientId: 'default_tenant', startDate: '2026-09-01', endDate: '2026-09-26' });
    for (const filters of [
      { vendor: { operator: 'in', values: ['MTN', 'Mondo'] } },
      { sale: { operator: 'equals', value: true } },
    ]) {
      params.set('filters', JSON.stringify(filters));
      assert.equal((await fetch(`${url}/offernet/raw-leads?${params}`)).status, 422);
    }
    assert.equal(queries.length, 0);
    params.set('filters', JSON.stringify({ vendor: { operator: 'equals', value: 'MTN' }, source: { operator: 'equals', value: 'Web' } }));
    const response = await fetch(`${url}/offernet/raw-leads?${params}`);
    assert.equal(response.status, 200, await response.text());
    assert.equal(queries.length, 1);
    assert.equal(queries[0].params.vendor, 'MTN');
    assert.equal(queries[0].params.source, 'Web');
  });
});
