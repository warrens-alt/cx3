import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { analyticsRouter } from '../server/api';
import {
  METRIC_REGISTRY_VERSION,
  AUTHORITATIVE_METRICS,
  type AuthoritativeMetricDefinition,
} from '../contracts/metricRegistry';

test('authoritative metrics: contract specifications and integrity', () => {
  assert.equal(METRIC_REGISTRY_VERSION, 'cx.metric.2.0.0');

  const metricKeys = Object.keys(AUTHORITATIVE_METRICS);
  assert.equal(metricKeys.length, 15, 'Must contain exactly 15 authoritative metric definitions');

  const expectedMetrics = [
    'fetched_leads',
    'attempted_delivery_leads',
    'delivered_leads',
    'delivery_rate',
    'dialled_leads',
    'dial_rate',
    'rpc_leads',
    'rpc_rate',
    'sale_leads',
    'sales_per_fetched_rate',
    'sales_per_rpc_rate',
    'activated_leads',
    'activation_rate',
    'one_call_dialled_share',
    'sla_15m_rate',
  ];

  for (const key of expectedMetrics) {
    const metric = AUTHORITATIVE_METRICS[key];
    assert.ok(metric, `Metric ${key} must exist`);
    assert.equal(metric.id, key);
    assert.equal(metric.version, 'cx.metric.2.0.0');
    assert.ok(metric.businessLabel, `${key} must have a businessLabel`);
    assert.ok(metric.technicalLabel, `${key} must have a technicalLabel`);
    assert.ok(metric.plainDefinition, `${key} must have a plainDefinition`);
    assert.ok(metric.numerator, `${key} must have a numerator expression`);
    assert.ok(metric.numeratorDescription, `${key} must have a numerator description`);
    assert.ok(metric.countingGrain, `${key} must declare a countingGrain`);
    assert.ok(metric.distinctIdentity, `${key} must declare a distinctIdentity`);
    assert.ok(metric.dateBasis, `${key} must declare a dateBasis`);
    assert.ok(metric.treatmentOfUnknown, `${key} must declare treatmentOfUnknown`);
  }

  // Rate metrics validation
  const rateKeys = [
    'delivery_rate',
    'dial_rate',
    'rpc_rate',
    'sales_per_fetched_rate',
    'sales_per_rpc_rate',
    'activation_rate',
    'one_call_dialled_share',
    'sla_15m_rate',
  ];

  for (const rk of rateKeys) {
    const metric = AUTHORITATIVE_METRICS[rk];
    assert.equal(metric.unit, 'percent');
    assert.equal(metric.scaling, 'percentage_value');
    assert.equal(metric.additive, false, 'Rates must be non-additive');
    assert.ok(metric.denominator, `Rate ${rk} must have a declared denominator`);
  }

  // Absolute volume metrics validation
  const volumeKeys = [
    'fetched_leads',
    'attempted_delivery_leads',
    'delivered_leads',
    'dialled_leads',
    'rpc_leads',
    'sale_leads',
    'activated_leads',
  ];

  for (const vk of volumeKeys) {
    const metric = AUTHORITATIVE_METRICS[vk];
    assert.equal(metric.unit, 'records');
    assert.equal(metric.scaling, 'none');
    assert.equal(metric.denominator, null, 'Volume counts do not have a denominator');
    assert.equal(metric.additive, true, 'Discrete volume counts must be additive');
  }

  // Denominator relationships
  assert.equal(AUTHORITATIVE_METRICS.delivery_rate.denominator, 'fetched_leads');
  assert.equal(AUTHORITATIVE_METRICS.dial_rate.denominator, 'delivered_leads');
  assert.equal(AUTHORITATIVE_METRICS.rpc_rate.denominator, 'dialled_leads');
  assert.equal(AUTHORITATIVE_METRICS.sales_per_fetched_rate.denominator, 'fetched_leads');
  assert.equal(AUTHORITATIVE_METRICS.sales_per_rpc_rate.denominator, 'rpc_leads');
  assert.equal(AUTHORITATIVE_METRICS.activation_rate.denominator, 'sale_leads');
  assert.equal(AUTHORITATIVE_METRICS.one_call_dialled_share.denominator, 'dialled_leads');
  assert.equal(AUTHORITATIVE_METRICS.sla_15m_rate.denominator, 'delivered_leads');
});

function createTestApiApp(role = 'admin', tenant = 'default_tenant', denyAuth = false) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (denyAuth) {
      return next();
    }
    res.locals.principal = {
      subject: 'test-agent',
      email: 'test@bastionflowe.com',
      role,
      tenants: [tenant, 'mtn', 'mondo', 'ontact_blc'],
    };
    next();
  });
  app.use('/api/analytics', analyticsRouter);
  return app;
}

test('GET /api/analytics/metrics/registry serves authoritative contracts', async () => {
  const app = createTestApiApp('viewer', 'default_tenant');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/analytics/metrics/registry?clientId=default_tenant`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.success, true);
    assert.equal(body.version, 'cx.metric.2.0.0');
    assert.equal(body.totalMetrics, 15);
    assert.ok(body.data.fetched_leads);
    assert.ok(body.data.sales_per_fetched_rate);
    assert.equal(body.data.sales_per_fetched_rate.scaling, 'percentage_value');
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('GET /api/analytics/metrics/authoritative returns identical registry payload', async () => {
  const app = createTestApiApp('admin', 'default_tenant');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/analytics/metrics/authoritative?clientId=default_tenant`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.success, true);
    assert.equal(body.version, 'cx.metric.2.0.0');
    assert.equal(body.totalMetrics, 15);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('GET /api/analytics/metrics/registry fails closed when unauthenticated', async () => {
  const app = createTestApiApp('viewer', 'default_tenant', true);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/analytics/metrics/registry?clientId=default_tenant`);
    assert.equal(res.status, 401);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
