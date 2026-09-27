import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { createVettingRouter } from '../server/vetting/router';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig } from '../server/bigquery/config';

test('GET /vetting returns full VettingReport including scope with previousStart and previousEnd', async t => {
  const config = getClientConfig('default_tenant');
  const client = getBigQueryClient(config.bigQueryProject);

  // Mock table metadata and createQueryJob
  t.mock.method(client, 'dataset', () => ({
    table: () => ({
      getMetadata: async () => [{
        schema: {
          fields: [
            { name: 'lead_id', type: 'STRING' },
            { name: 'fetched', type: 'TIMESTAMP' },
            { name: 'offershop_grade', type: 'STRING' },
            { name: 'offershop_color_vetting', type: 'STRING' },
            { name: 'offershop_grade_date', type: 'TIMESTAMP' },
            { name: 'offershop_color_vetting_date', type: 'TIMESTAMP' },
            { name: 'offershop_source', type: 'STRING' },
            { name: 'offernet_medium', type: 'STRING' },
            { name: 'valid_lead', type: 'BOOLEAN' },
            { name: 'valid_idno', type: 'BOOLEAN' },
            { name: 'phone_valid', type: 'BOOLEAN' },
            {
              name: 'hlc_details',
              type: 'RECORD',
              mode: 'REPEATED',
              fields: [
                { name: 'vendor', type: 'STRING' },
                { name: 'delivered', type: 'TIMESTAMP' },
                { name: 'first_call_date', type: 'TIMESTAMP' },
                { name: 'rpc', type: 'STRING' },
                { name: 'sale', type: 'TIMESTAMP' },
                { name: 'activated', type: 'TIMESTAMP' },
              ],
            },
          ],
        },
      }],
    }),
  }));

  const mockQueryResult = {
    current: {
      leads: '150',
      classRecorded: '120',
      recognisedClass: '110',
      colourRecorded: '100',
      namedColour: '90',
      bothRecorded: '85',
      withHlc: '140',
      valid: '130',
      invalid: '10',
      unknownValidity: '10',
      delivered: '140',
      called: '135',
      rpc: '95',
      sales: '40',
      activations: '30',
      classTimed: '115',
      colourTimed: '95',
      classBeforeCapture: '0',
      colourBeforeCapture: '0',
      classInvalidTime: '0',
      colourInvalidTime: '0',
      classFutureTime: '0',
      colourFutureTime: '0',
      classMeanSeconds: '12.5',
      colourMeanSeconds: '14.2',
    },
    previous: {
      leads: '140',
      classRecorded: '110',
      recognisedClass: '100',
      colourRecorded: '95',
      namedColour: '85',
      bothRecorded: '80',
      withHlc: '130',
      valid: '120',
      invalid: '10',
      unknownValidity: '10',
      delivered: '130',
      called: '125',
      rpc: '90',
      sales: '35',
      activations: '25',
      classTimed: '105',
      colourTimed: '90',
      classBeforeCapture: '0',
      colourBeforeCapture: '0',
      classInvalidTime: '0',
      colourInvalidTime: '0',
      classFutureTime: '0',
      colourFutureTime: '0',
      classMeanSeconds: '13.1',
      colourMeanSeconds: '15.0',
    },
    groups: [],
    diagnostics: [
      {
        period: 'current',
        sourceRows: '150',
        missingIdRows: '0',
        conflictingLeads: '0',
        conflictingRows: '0',
        duplicateRowsCollapsed: '0',
        eligibleUniqueLeads: '150',
      },
    ],
    timing: [
      {
        kind: 'Class',
        sample: '115',
        meanSeconds: '12.5',
        medianSeconds: '10.0',
        p90Seconds: '25.0',
      },
    ],
    generatedAt: '2026-09-26T20:00:00.000Z',
  };

  t.mock.method(client, 'createQueryJob', async () => [{
    id: 'mock-vetting-job-123',
    getQueryResults: async () => [[mockQueryResult]],
    getMetadata: async () => [{
      statistics: {
        query: {
          totalBytesProcessed: '1024000',
          referencedTables: [{ projectId: config.bigQueryProject, datasetId: config.bigQueryDatasets[0], tableId: 'clustered_lead_ledger' }],
        },
      },
    }],
  }]);

  const app = express();
  app.use((_req, res, next) => {
    res.locals.principal = { subject: 'test-admin', role: 'admin', tenants: ['default_tenant'] };
    res.locals.scope = { clientId: 'default_tenant', startDate: '2026-09-01', endDate: '2026-09-14', filters: {} };
    next();
  });
  app.use('/api/analytics', createVettingRouter());

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const port = (server.address() as AddressInfo).port;
    const res = await fetch(`http://127.0.0.1:${port}/api/analytics/vetting?interval=week`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data, 'Expected data to be returned');

    // Verify scope contract
    assert.ok(json.data.scope, 'Expected scope to be present in VettingReport');
    assert.equal(json.data.scope.startDate, '2026-09-01');
    assert.equal(json.data.scope.endDate, '2026-09-14');
    assert.equal(json.data.scope.previousStart, '2026-08-18');
    assert.equal(json.data.scope.previousEnd, '2026-08-31');
    assert.equal(json.data.scope.days, 14);
    assert.equal(json.data.scope.interval, 'week');

    // Verify evidence and fields
    assert.ok(json.data.evidence, 'Expected evidence to be present');
    assert.equal(json.data.evidence.jobId, 'mock-vetting-job-123');
    assert.ok(json.data.fields, 'Expected fields mapping to be present');
    assert.ok(json.data.notes?.length, 'Expected notes array to be present');

    // Verify data metrics
    assert.equal(json.data.current.leads, '150');
    assert.equal(json.data.previous.leads, '140');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
