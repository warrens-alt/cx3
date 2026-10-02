import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { analyticsRouter } from '../server/api';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig } from '../server/bigquery/config';

test('HTTP exceptions preserve supported scope while record access and tenant scope remain administrator governed', async t => {
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  const queries: any[] = [];
  t.mock.method(client, 'query', async options => { queries.push(options); return [[]]; });
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => { res.locals.principal = { subject: 'exception-viewer', role: 'viewer', tenants: ['default_tenant'] }; next(); });
  app.use('/api/analytics', analyticsRouter);
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/analytics`;
    const params = new URLSearchParams({ clientId: 'default_tenant', startDate: '2026-09-08', endDate: '2026-09-14', vendor: 'MTN', source: 'web' });
    const response = await fetch(`${base}/offernet/exceptions?${params}`);
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.metadata.validationStatus, 'NOT_VERIFIED');
    assert.equal(body.metadata.dateBasis, 'lead_capture_cohort');
    assert.equal(body.data.exceptions.length, 13);
    assert.equal(queries.length, 1);
    assert.equal(queries[0].params.vendor, 'MTN');
    assert.equal(queries[0].params.source, 'web');
    assert.equal(queries[0].params.startDate, '2026-09-01');
    assert.equal(queries[0].params.currentStartDate, '2026-09-08');
    for (const path of ['raw-leads', 'lead-timeline/L']) assert.equal((await fetch(`${base}/offernet/${path}?${params}`)).status, 403);
    assert.equal((await fetch(`${base}/offernet/exceptions?clientId=mtn`)).status, 403);
    params.set('campaign', 'unsupported');
    assert.equal((await fetch(`${base}/offernet/exceptions?${params}`)).status, 422);
    assert.equal(queries.length, 1, 'Denied requests must not query warehouse sources');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('HTTP investigation narrowing and full timeline scope survive parsing and cache keys without exposing records to viewers', async t => {
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  const queries: any[] = [];
  t.mock.method(client, 'query', async options => {
    queries.push(options);
    if (options.query.includes('investigation_population AS')) return [[{
      population_count: 1, missing_call_counters: 0, unknown_rpc: 1,
      vendors: [{ name: 'A', count: 1 }], sources: [{ name: 'Paid', count: 1 }], first_dial_ages: [{ name: 'Undialled', count: 1 }],
    }]];
    if (options.query.includes('JOIN qualified_evidence population')) return [options.params.segmentVendor === 'A' ? [{ lead_id: 'PRIVATE-LEAD', vendor: 'A', fetched: '2026-09-08T12:00:00Z', delivered: '2026-09-08T13:00:00Z' }] : []];
    return [[{ total_count: 1, evidence_rows: [{ lead_id: 'PRIVATE-LEAD', vendor: 'A', total_calls: 0 }] }]];
  });
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { res.locals.principal = { subject: `investigation-${req.headers['x-test-role'] || 'viewer'}`, role: req.headers['x-test-role'] === 'admin' ? 'admin' : 'viewer', tenants: ['default_tenant'] }; next(); });
  app.use('/api/analytics', analyticsRouter);
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/analytics/offernet`;
    const params = new URLSearchParams({ clientId: 'default_tenant', startDate: '2026-09-08', endDate: '2026-09-14', vendor: 'A', source: 'Paid', grade: 'A', medium: 'web', drill: 'awaiting-first-dial', segmentVendor: 'A', segmentLeadAge: 'Undialled' });
    const admin = { headers: { 'x-test-role': 'admin' } };
    const raw = await fetch(`${base}/raw-leads?${params}`, admin);
    assert.equal(raw.status, 200);
    const records = await raw.json();
    assert.equal(records.data.rows[0].investigationReason.code, 'AWAITING_FIRST_DIAL');
    assert.equal(records.data.segmentVendor, 'A');
    assert.equal(queries.at(-1).params.source, 'Paid');
    assert.equal(queries.at(-1).params.segmentLeadAge, 'Undialled');
    assert.equal((await fetch(`${base}/raw-leads?${params}`)).status, 403);
    assert.equal((await fetch(`${base}/lead-timeline/PRIVATE-LEAD?${params}`)).status, 403);
    const firstTimeline = await fetch(`${base}/lead-timeline/PRIVATE-LEAD?${params}`, admin);
    assert.equal(firstTimeline.status, 200);
    assert.equal((await firstTimeline.json()).data.leadId, 'PRIVATE-LEAD');
    assert.equal(queries.at(-1).params.startDate, '2026-09-08');
    assert.equal(queries.at(-1).params.grade, 'A');
    assert.equal(queries.at(-1).params.medium, 'web');
    params.set('segmentVendor', 'B');
    const secondTimeline = await fetch(`${base}/lead-timeline/PRIVATE-LEAD?${params}`, admin);
    assert.equal(secondTimeline.status, 200);
    assert.equal((await secondTimeline.json()).data, null, 'A lead outside the new segment cannot reuse the previous timeline response');
    assert.equal(queries.at(-1).params.segmentVendor, 'B');
    params.set('segmentVendor', 'A');
    params.set('question', 'What evidence is missing?');
    const aiResponse = await fetch(`${base}/ai-insights?${params}`);
    assert.equal(aiResponse.status, 200);
    const ai = await aiResponse.json();
    assert.equal(ai.data.scope.segmentVendor, 'A');
    assert.equal(ai.data.scope.filters.medium.value, 'web');
    assert.equal(ai.data.requestedQuestion, 'What evidence is missing?');
    assert.equal(ai.data.validationStatus, 'NOT_VERIFIED');
    assert.equal(JSON.stringify(ai).includes('PRIVATE-LEAD'), false);
    const beforeQuestion = queries.length;
    const scopedQuestion = await fetch(`${base.replace('/offernet', '')}/google/ask?${params}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'Explain the evidence gaps in this population.' }),
    });
    assert.equal(scopedQuestion.status, 200);
    const scopedAnswer = await scopedQuestion.json();
    assert.equal(scopedAnswer.data.scope.drill, 'awaiting-first-dial');
    assert.equal(scopedAnswer.data.scope.segmentVendor, 'A');
    assert.equal(scopedAnswer.data.validationStatus, 'NOT_VERIFIED');
    assert.ok(scopedAnswer.data.citations.every((reference: string) => reference.startsWith('investigation.')));
    assert.equal(queries.length, beforeQuestion + 1, 'Scoped Q&A must perform only the exact aggregate query, never a broader queue, driver or warehouse query');
    assert.equal(JSON.stringify(scopedAnswer).includes('PRIVATE-LEAD'), false);
    const bodyScope = { clientId: 'default_tenant', startDate: '2026-09-08', endDate: '2026-09-14', drill: 'awaiting-first-dial', segmentVendor: 'A', segmentLeadAge: 'Undialled', question: 'Inspect this exact body scope.' };
    for (const route of ['google/ask', 'explain']) {
      const beforeBody = queries.length;
      const response = await fetch(`${base.replace('/offernet', '')}/${route}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyScope),
      });
      assert.equal(response.status, 200, route);
      const body = await response.json();
      assert.equal(body.data.scope.drill, 'awaiting-first-dial');
      assert.equal(body.data.scope.segmentVendor, 'A');
      assert.equal(body.data.scope.segmentLeadAge, 'Undialled');
      assert.equal(queries.length, beforeBody + 1, `${route} must honor body investigation scope with one exact query`);
    }
    const beforeConflicts = queries.length;
    const conflicting = await fetch(`${base.replace('/offernet', '')}/google/ask?clientId=default_tenant&segmentVendor=B`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyScope),
    });
    assert.equal(conflicting.status, 422, 'Conflicting query/body narrowing must not choose one population');
    const repeated = await fetch(`${base}/ai-insights?${params}&segmentVendor=B`);
    assert.equal(repeated.status, 400, 'Repeated scalar investigation parameters must fail before warehouse execution');
    assert.equal(queries.length, beforeConflicts);
    const beforeExport = queries.length;
    const broadExport = await fetch(`${base.replace('/offernet', '')}/export?${params}&format=json`, admin);
    assert.equal(broadExport.status, 422, 'Generic exports must reject investigation narrowing they cannot apply');
    assert.equal(queries.length, beforeExport);
    params.set('drill', 'not-supported');
    const before = queries.length;
    assert.equal((await fetch(`${base}/ai-insights?${params}`)).status, 422);
    assert.equal(queries.length, before, 'Unsupported population must fail before warehouse execution');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
