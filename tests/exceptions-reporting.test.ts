import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createReportingRouter } from '../server/reporting/router';
import { exceptionCatalogue, EXCEPTION_CONTRACT_VERSION } from '../contracts/operations';

test('exceptionCatalogue returns structured operational exception rules with versioning', () => {
  const rules = exceptionCatalogue([], []);
  assert.equal(rules.length > 0, true);
  assert.ok(rules.some(r => r.id === 'delivered_not_dialled_sla'));
  assert.ok(rules.some(r => r.id === 'source_feed_stale'));
  assert.equal(EXCEPTION_CONTRACT_VERSION, 'cx.exceptions.1.0.0');
});

test('Reporting router /exceptions endpoint responds with available status and rules', async () => {
  const mockRepo: any = {
    configured: true,
    release: async () => ({
      releaseId: 'rel_fixture',
      cutoff: '2026-08-31T23:59:59Z',
      sourceBatchIds: {},
      sources: [
        { fact: 'leads', status: 'COMPLETE' },
        { fact: 'calls', status: 'COMPLETE' },
        { fact: 'transactions', status: 'COMPLETE' },
      ],
      checks: [
        { id: 'delivered_not_dialled_sla', status: 'PASS', observed: '0', expected: '0', jobId: 'test' },
        { id: 'source_feed_stale', status: 'PASS', observed: '0', expected: '0', jobId: 'test' }
      ],
      approvedBy: 'fixture',
      approvalReference: 'test-only'
    }),
    assertSnapshots: async () => {},
  };

  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.locals.principal = { subject: 'test', email: 'test@example.com', role: 'viewer', tenants: ['default_tenant'] };
    next();
  });
  app.use('/api/reporting', createReportingRouter(mockRepo));

  const server = app.listen(0);
  const address = server.address() as { port: number };

  try {
    const res = await fetch(`http://127.0.0.1:${address.port}/api/reporting/exceptions?tenantId=default_tenant`);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.data.available, true);
    assert.ok(Array.isArray(data.data.rules));
    assert.ok(data.data.rules.length > 0);

    const rule = data.data.rules.find((r: any) => r.id === 'delivered_not_dialled_sla');
    assert.ok(rule);
    assert.equal(rule.severity, 'high');
  } finally {
    server.close();
  }
});
