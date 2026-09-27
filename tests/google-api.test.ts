import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { analyticsRouter } from '../server/api';
import {
  parseBigQueryCredentials,
  checkBigQueryHealth,
  getBigQueryClient,
  AnalyticsBigQueryClient,
} from '../server/bigquery/client';
import { getClientConfig } from '../server/bigquery/config';
import {
  checkGeminiHealth,
  generateGroundedAiInsights,
  askGeminiAnalytics,
  type OperationalContext,
  type GroundedAiInsightsResult,
} from '../server/gemini/client';

test('parseBigQueryCredentials handles direct JSON and base64 encoded strings', () => {
  const direct = JSON.stringify({ type: 'service_account', project_id: 'test-proj' });
  const parsed1 = parseBigQueryCredentials(direct);
  assert.equal(parsed1.project_id, 'test-proj');

  const b64 = Buffer.from(direct).toString('base64');
  const parsed2 = parseBigQueryCredentials(b64);
  assert.equal(parsed2.project_id, 'test-proj');

  assert.throws(() => parseBigQueryCredentials('not-valid-json-or-base64-json'));
});

test('checkBigQueryHealth measures query latency and returns structured diagnostics', async t => {
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  t.mock.method(client, 'query', async () => [[{ latest: '2026-09-20T12:00:00Z' }]]);

  const health = await checkBigQueryHealth('test-proj', 'test_dataset', 'leads', client);
  assert.equal(health.status, 'Connected');
  assert.equal(health.latestData, '2026-09-20T12:00:00Z');
  assert.equal(health.engine, 'Google BigQuery');
  assert.equal(typeof health.latencyMs, 'number');
  assert.ok(health.latencyMs! >= 0);
  assert.equal(health.projectId, 'test-proj');
});

test('checkBigQueryHealth catches query errors and returns graceful Error status', async t => {
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  t.mock.method(client, 'query', async () => {
    throw new Error('Access denied to dataset');
  });

  const health = await checkBigQueryHealth('test-proj', 'test_dataset', 'leads', client);
  assert.equal(health.status, 'Error');
  assert.equal(health.latestData, null);
  assert.match(health.error || '', /Access denied/);
});

test('checkGeminiHealth reports Not Configured when GEMINI_API_KEY is absent', async () => {
  const prev = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    const status = await checkGeminiHealth();
    assert.equal(status.status, 'Not Configured');
    assert.equal(status.model, 'gemini-3.8-flash');
    assert.equal(status.hasKey, false);
  } finally {
    if (prev) process.env.GEMINI_API_KEY = prev;
  }
});

test('generateGroundedAiInsights falls back cleanly to deterministic summaries without hallucinating', async () => {
  const context: OperationalContext = {
    clientName: 'Test Client',
    exceptions: [{ id: 'zero-call-leads', title: 'Zero-call leads', count: 42, severity: 'HIGH', detail: 'Pending dialler' }],
  };
  const fallback: GroundedAiInsightsResult = {
    executiveSummary: 'Test Client recorded 42 zero-call leads.',
    strategicFocus: 'Expedite first dial turnaround.',
    insights: [{
      category: 'Exception queue',
      severity: 'HIGH',
      finding: 'Zero-call leads: 42 scoped leads.',
      metricReference: 'exceptions.zero-call-leads.count=42',
      directive: 'Inspect queue in Exceptions.',
    }],
  };

  const prev = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    const { result, source } = await generateGroundedAiInsights(context, fallback);
    assert.equal(source, 'DETERMINISTIC_MEASURED_ANALYTICS');
    assert.equal(result.executiveSummary, 'Test Client recorded 42 zero-call leads.');
    assert.equal(result.insights.length, 1);
    assert.equal(result.insights[0].metricReference, 'exceptions.zero-call-leads.count=42');
  } finally {
    if (prev) process.env.GEMINI_API_KEY = prev;
  }
});

test('askGeminiAnalytics provides grounded responses citing verified records', async () => {
  const context: OperationalContext = {
    clientName: 'Test Client',
    exceptions: [{ id: 'zero-call-leads', title: 'Zero-call leads', count: 120, severity: 'HIGH', detail: 'Pending dialler' }],
  };

  const prev = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    const res = await askGeminiAnalytics('Why are leads undialled?', context);
    assert.ok(res.answer.includes('Test Client'));
    assert.ok(res.citations.some(c => c.includes('Zero-call leads')));
  } finally {
    if (prev) process.env.GEMINI_API_KEY = prev;
  }
});

test('Google HTTP API endpoints /google/status, /google/ask and /offernet/ai-insights', async t => {
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  t.mock.method(client, 'query', async () => [[{ latest: '2026-09-21T00:00:00Z', affected_count: 5, id: 'zero-call-leads' }]]);

  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.locals.principal = { subject: 'test-user', email: 'test@example.com', role: 'admin', tenants: ['default_tenant'] };
    next();
  });
  app.use('/api/analytics', analyticsRouter);

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/analytics`;

    // 1. GET /google/status
    const statusRes = await fetch(`${base}/google/status?clientId=default_tenant`);
    assert.equal(statusRes.status, 200);
    const statusBody = await statusRes.json();
    assert.equal(statusBody.success, true);
    assert.ok(statusBody.data.bigquery);
    assert.equal(statusBody.data.bigquery.engine, 'Google BigQuery');
    assert.ok(statusBody.data.gemini);
    assert.equal(statusBody.data.gemini.model, 'gemini-3.8-flash');
    assert.ok(statusBody.data.identity);

    // 2. POST /google/ask validation
    const badAskRes = await fetch(`${base}/google/ask?clientId=default_tenant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(badAskRes.status, 400);

    const goodAskRes = await fetch(`${base}/google/ask?clientId=default_tenant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Summarize current exceptions' }),
    });
    assert.equal(goodAskRes.status, 200);
    const askBody = await goodAskRes.json();
    assert.equal(askBody.success, true);
    assert.ok(askBody.data.answer);

    // 3. GET /offernet/ai-insights
    const insightsRes = await fetch(`${base}/offernet/ai-insights?clientId=default_tenant`);
    assert.equal(insightsRes.status, 200);
    const insightsBody = await insightsRes.json();
    assert.equal(insightsBody.success, true);
    assert.ok(insightsBody.data.executiveSummary);
    assert.ok(insightsBody.data.strategicFocus);
    assert.ok(Array.isArray(insightsBody.data.insights));
    assert.equal(insightsBody.metadata.validationStatus, 'NOT_VERIFIED');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
