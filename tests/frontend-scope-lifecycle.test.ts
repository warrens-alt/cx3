import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { extractOffernetFilters, readFilters, singleFilterValue } from '../src/lib/FilterContext';
import { buildQueryString } from '../src/lib/offernet/cache';
import { navigationTarget } from '../src/lib/presentation';
import { selectAuthorizedClient } from '../src/lib/clientSelection';
import { operationalQueryOptions, operationalQueryView } from '../src/lib/operationalQueries';
import type { Filters } from '../server/bigquery/filters';
import { cliExportUrl } from '../src/lib/cliExport';

test('navigation and operational requests retain every condition and value', () => {
  const filters: Filters = {
    sale: { operator: 'equals', value: true },
    calls: { operator: 'between', min: 0, max: 5 },
    vendor: { operator: 'in', values: ['Vendor A', 'Vendor B'] },
    grade: { operator: 'not_equals', value: 'Unqualified' },
  };
  const search = '?clientId=tenant&filters=' + encodeURIComponent(JSON.stringify(filters));
  const location = navigationTarget('/overview', '/vetting', search);
  const scope = readFilters(new URLSearchParams(location.search));
  const request = new URLSearchParams(buildQueryString({ clientId: 'tenant', ...extractOffernetFilters(scope) }));
  assert.deepEqual(JSON.parse(request.get('filters')!), filters);
  assert.equal(request.has('vendor'), false, 'No scalar override may truncate the canonical scope');
  assert.equal(singleFilterValue(filters.vendor), undefined, 'A local selector must not represent a multivalue scope as one value');
  assert.equal(singleFilterValue({ operator: 'equals', value: 'Vendor A' }), 'Vendor A');
});

test('malformed and invalid encoded filters reach the scope error boundary', () => {
  assert.throws(() => readFilters(new URLSearchParams({ filters: '{"vendor":' })), /valid JSON/);
  assert.throws(() => readFilters(new URLSearchParams({ filters: JSON.stringify({ vendor: { operator: 'in', values: [] } }) })), /Invalid values/);
  assert.throws(() => readFilters(new URLSearchParams({ filters: JSON.stringify({ unknown: { operator: 'equals', value: 'x' } }) })), /Unsupported filter/);
});

test('CLI export retains canonical scope and the table campaign, vendor and substring search', () => {
  const url = cliExportUrl({
    clientId: 'tenant', startDate: '2026-09-01', endDate: '2026-09-26',
    filters: { cli: { operator: 'not_equals', value: 'blocked' }, campaign: { operator: 'in', values: ['A', 'B'] } },
  }, { campaign: 'B', vendor: 'Vendor & Co', search: '  123  ' });
  const params = new URL(url, 'https://example.test').searchParams;
  assert.equal(params.get('startDate'), '2026-09-01');
  assert.equal(params.get('endDate'), '2026-09-26');
  assert.equal(params.get('clientId'), 'tenant');
  assert.equal(params.get('search'), '123');
  assert.deepEqual(JSON.parse(params.get('filters')!), {
    cli: { operator: 'not_equals', value: 'blocked' },
    campaign: { operator: 'equals', value: 'B' },
    vendor: { operator: 'equals', value: 'Vendor & Co' },
  });
  assert.throws(() => cliExportUrl({
    clientId: 'tenant', startDate: '', endDate: '', filters: { campaign: { operator: 'equals', value: 'A' } },
  }, { campaign: 'B', vendor: 'all', search: '' }), /conflicts with the reporting scope/);
});

test('workspace selection follows authorized URLs and preserves selection when navigation omits clientId', () => {
  const clients = [{ id: 'one' }, { id: 'two' }];
  assert.equal(selectAuthorizedClient(clients, 'two', 'one')?.id, 'two');
  assert.equal(selectAuthorizedClient(clients, null, 'two')?.id, 'two');
  assert.equal(selectAuthorizedClient(clients, 'unauthorized', 'two')?.id, 'two');
  assert.equal(selectAuthorizedClient(clients, null, 'revoked')?.id, 'one');
  assert.equal(selectAuthorizedClient([], 'two', 'two'), null);
});

const settle = () => new Promise<void>(resolve => setImmediate(resolve));

for (const dimension of ['offset', 'filters', 'leadId']) {
  test(`an obsolete ${dimension} request cannot replace the active result`, async () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    const pending = new Map<string, (value: { identity: string }) => void>();
    const fetcher = (params: Record<string, any>, forceRefresh?: boolean) => {
      assert.equal(forceRefresh, true, 'Explicit query refresh bypasses the secondary cache');
      return new Promise<{ identity: string }>(resolve => pending.set(String(params[dimension]), resolve));
    };
    const options = (identity: string) => operationalQueryOptions('regression', { clientId: 'tenant', [dimension]: identity }, fetcher);
    const observer = new QueryObserver(client, options('old'));
    const unsubscribe = observer.subscribe(() => {});
    try {
      observer.setOptions(options('current'));
      assert.equal(operationalQueryView(observer.getCurrentResult()).data, null);
      pending.get('current')!({ identity: 'current' });
      await settle();
      assert.deepEqual(observer.getCurrentResult().data, { identity: 'current' });
      pending.get('old')!({ identity: 'old' });
      await settle();
      assert.deepEqual(observer.getCurrentResult().data, { identity: 'current' });
    } finally {
      unsubscribe();
      client.clear();
    }
  });
}

test('a rejected refresh hides cached values instead of displaying them beside a scope error', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  let reject = false;
  const observer = new QueryObserver(client, operationalQueryOptions('regression', { clientId: 'tenant' }, async () => {
    if (reject) throw new Error('Unsupported operational filter: sale');
    return { total: 123 };
  }));
  const unsubscribe = observer.subscribe(() => {});
  try {
    await observer.refetch();
    assert.deepEqual(operationalQueryView(observer.getCurrentResult()).data, { total: 123 });
    reject = true;
    await observer.refetch();
    const view = operationalQueryView(observer.getCurrentResult());
    assert.equal(view.data, null);
    assert.match(view.error!, /Unsupported operational filter/);
  } finally {
    unsubscribe();
    client.clear();
  }
});
