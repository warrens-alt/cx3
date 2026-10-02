import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { buildOffernetQueryParams } from '../server/analytics/requestScope';
import { RequestError, type QueryScope } from '../server/bigquery/filters';

function request(method: string, query: Record<string, unknown> = {}, body: Record<string, unknown> = {}, path = '/offernet/raw-leads') {
  const scope: QueryScope = {
    clientId: 'mtn', startDate: '2026-09-01', endDate: '2026-09-30',
    filters: { vendor: { operator: 'in', values: ['Vendor A'] }, source: { operator: 'equals', value: 'Paid' } },
  };
  const req = { method, query, body, path } as Request;
  const res = { locals: { scope } } as Response;
  return { req, res, scope };
}

test('operational request parsing preserves authorized workspace and canonical scope for records and metadata', () => {
  const { req, res, scope } = request('GET', {
    clientId: 'other', startDate: '2000-01-01', vendor: 'other',
    search: 'private record query', drill: 'awaiting-first-dial', drillValue: '0',
    segmentVendor: 'Vendor B', segmentSource: 'Web', segmentGrade: 'A', segmentLeadAge: 'Undialled',
    metric: 'dialRate', question: 'What remains unknown?', limit: '75', offset: '150',
  });
  const parsed = buildOffernetQueryParams(req, res);
  assert.deepEqual(parsed, {
    clientId: 'mtn', startDate: '2026-09-01', endDate: '2026-09-30', vendor: 'Vendor A', source: 'Paid',
    filters: { vendor: { operator: 'equals', value: 'Vendor A' }, source: { operator: 'equals', value: 'Paid' } },
    search: 'private record query', drill: 'awaiting-first-dial', drillValue: '0',
    segmentVendor: 'Vendor B', segmentSource: 'Web', segmentGrade: 'A', segmentLeadAge: 'Undialled',
    metric: 'dialRate', question: 'What remains unknown?', limit: 75, offset: 150,
  });
  assert.equal(scope.filters, parsed.filters, 'Response metadata must use the same canonical filters as the analytical request');
});

test('POST investigation scope accepts matching query/body narrowing and rejects each conflicting dimension', () => {
  for (const name of ['search', 'drill', 'drillValue', 'segmentVendor', 'segmentSource', 'segmentGrade', 'segmentLeadAge', 'metric']) {
    const matching = request('POST', { [name]: 'A' }, { [name]: 'A' }, '/explain');
    assert.equal((buildOffernetQueryParams(matching.req, matching.res) as any)[name], 'A');
    const bodyOnly = request('POST', {}, { [name]: 'B' }, '/explain');
    assert.equal((buildOffernetQueryParams(bodyOnly.req, bodyOnly.res) as any)[name], 'B');
    const conflicting = request('POST', { [name]: 'A' }, { [name]: 'B' }, '/explain');
    assert.throws(() => buildOffernetQueryParams(conflicting.req, conflicting.res), error =>
      error instanceof RequestError && error.status === 422 && error.message.includes(`Conflicting ${name}`));
  }
});

test('GET ignores request-body narrowing and rejects repeated or overlong scalar values', () => {
  const read = request('GET', { segmentVendor: 'A' }, { segmentVendor: 'B', search: 'body search' });
  const parsed = buildOffernetQueryParams(read.req, read.res);
  assert.equal(parsed.segmentVendor, 'A');
  assert.equal(parsed.search, undefined);
  for (const query of [{ segmentVendor: ['A', 'B'] }, { search: 'x'.repeat(201) }, { question: 'x'.repeat(1001) }]) {
    const invalid = request('GET', query);
    assert.throws(() => buildOffernetQueryParams(invalid.req, invalid.res), RequestError);
  }
});

test('unsupported operational filters fail closed rather than disappearing from investigation scope', () => {
  const { req, res, scope } = request('GET');
  scope.filters = { campaign: { operator: 'equals', value: 'Campaign A' } };
  assert.throws(() => buildOffernetQueryParams(req, res), error => error instanceof RequestError && error.status === 422);
  assert.deepEqual(scope.filters, { campaign: { operator: 'equals', value: 'Campaign A' } });
});

test('record pagination retains its existing defaults and strict bounds', () => {
  const initial = request('GET');
  assert.equal(buildOffernetQueryParams(initial.req, initial.res).limit, 50);
  assert.equal(buildOffernetQueryParams(initial.req, initial.res).offset, 0);
  for (const query of [{ limit: '201' }, { limit: '9' }, { offset: '-1' }, { offset: '100001' }]) {
    const invalid = request('GET', query);
    assert.throws(() => buildOffernetQueryParams(invalid.req, invalid.res), RequestError);
  }
});
