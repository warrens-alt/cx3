import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import {
  computeAnalyticalSessionKey,
  getAnalyticalSessionKey,
  getAnalyticalSessionGeneration,
  updateAnalyticalSession,
  registerQueryClientForSessionIsolation,
  subscribeToAnalyticalSession,
  _resetAnalyticalSessionForTesting,
} from '../src/lib/analyticalSession';
import {
  fetchOffernetJson,
  memoryCache,
  invalidateOffernetCache,
} from '../src/lib/offernet/cache';
import { operationalQueryOptions, operationalQueryView } from '../src/lib/operationalQueries';
import { authAccess } from '../src/lib/authAccess';
import { scopedAnalysisRows } from '../src/lib/analysisExport';

test('computeAnalyticalSessionKey generates stable, non-secret access boundary keys', () => {
  // Inactive / unauthenticated
  assert.equal(computeAnalyticalSessionKey(null), 'unauthenticated');
  assert.equal(computeAnalyticalSessionKey({ uid: 'u1', role: 'admin', status: 'pending', allowedTenants: ['*'], isAdmin: false, isActive: false }), 'unauthenticated');
  assert.equal(computeAnalyticalSessionKey({ uid: 'u1', role: 'admin', status: 'suspended', allowedTenants: ['*'], isAdmin: false, isActive: false }), 'unauthenticated');

  // Active admin
  const adminKey = computeAnalyticalSessionKey({ uid: 'u1', role: 'admin', status: 'active', allowedTenants: ['*'], isAdmin: true, isActive: true });
  assert.equal(adminKey, 'u:u1:r:admin:t:*:a:1');

  // Active viewer with sorted tenants
  const viewerKey = computeAnalyticalSessionKey({ uid: 'u2', role: 'viewer', status: 'active', allowedTenants: ['mtn', 'blc'], isAdmin: false, isActive: true });
  assert.equal(viewerKey, 'u:u2:r:viewer:t:blc,mtn:a:0');
});

test('routine token refresh or profile timestamp update does not reset session or clear cache', () => {
  _resetAnalyticalSessionForTesting();
  const identity = { uid: 'u1', role: 'viewer', status: 'active', allowedTenants: ['mtn'], isAdmin: false, isActive: true };

  const changedFirst = updateAnalyticalSession(identity);
  assert.equal(changedFirst, true);
  const gen1 = getAnalyticalSessionGeneration();

  // Subsequent call with identical effective access
  const changedSecond = updateAnalyticalSession({ ...identity });
  assert.equal(changedSecond, false);
  assert.equal(getAnalyticalSessionGeneration(), gen1, 'Generation must not increment on routine update');
});

test('Administrator A logs out and Viewer B logs in on the same browser', () => {
  _resetAnalyticalSessionForTesting();
  const queryClient = new QueryClient();
  registerQueryClientForSessionIsolation(queryClient);

  // Admin A logs in
  updateAnalyticalSession({ uid: 'admin_a', role: 'admin', status: 'active', allowedTenants: ['*'], isAdmin: true, isActive: true });
  const adminSessionKey = getAnalyticalSessionKey();
  assert.equal(adminSessionKey, 'u:admin_a:r:admin:t:*:a:1');

  // Seed React Query cache
  queryClient.setQueryData(['offernet-view', adminSessionKey, 'overview', { clientId: 'mtn' }], { secretAdminData: 100 });
  memoryCache.set('/api/analytics/offernet/overview?clientId=mtn', { data: { secretAdminData: 100 }, timestamp: Date.now() });

  assert.ok(queryClient.getQueryData(['offernet-view', adminSessionKey, 'overview', { clientId: 'mtn' }]));
  assert.ok(memoryCache.has('/api/analytics/offernet/overview?clientId=mtn'));

  // Admin A logs out
  updateAnalyticalSession(null);
  assert.equal(getAnalyticalSessionKey(), 'unauthenticated');
  assert.equal(queryClient.getQueryData(['offernet-view', adminSessionKey, 'overview', { clientId: 'mtn' }]), undefined);
  assert.equal(memoryCache.size, 0);

  // Viewer B logs in
  updateAnalyticalSession({ uid: 'viewer_b', role: 'viewer', status: 'active', allowedTenants: ['mtn'], isAdmin: false, isActive: true });
  const viewerSessionKey = getAnalyticalSessionKey();
  assert.equal(viewerSessionKey, 'u:viewer_b:r:viewer:t:mtn:a:0');

  // Viewer B cannot see Admin A query data
  const viewerQuery = queryClient.getQueryData(['offernet-view', viewerSessionKey, 'overview', { clientId: 'mtn' }]);
  assert.equal(viewerQuery, undefined);
  assert.equal(memoryCache.has('/api/analytics/offernet/overview?clientId=mtn'), false);

  queryClient.clear();
});

test('the same user is demoted from administrator to viewer', () => {
  _resetAnalyticalSessionForTesting();
  const queryClient = new QueryClient();
  registerQueryClientForSessionIsolation(queryClient);

  // User starts as administrator
  updateAnalyticalSession({ uid: 'user_x', role: 'admin', status: 'active', allowedTenants: ['*'], isAdmin: true, isActive: true });
  const adminKey = getAnalyticalSessionKey();
  assert.equal(adminKey, 'u:user_x:r:admin:t:*:a:1');
  queryClient.setQueryData(['offernet-view', adminKey, 'raw-leads', { clientId: 'mtn' }], { rawLeads: ['confidential'] });

  // User is demoted to viewer
  const changed = updateAnalyticalSession({ uid: 'user_x', role: 'viewer', status: 'active', allowedTenants: ['mtn'], isAdmin: false, isActive: true });
  assert.equal(changed, true);
  const viewerKey = getAnalyticalSessionKey();
  assert.equal(viewerKey, 'u:user_x:r:viewer:t:mtn:a:0');

  // React Query cache was cleared and query keys no longer match
  assert.equal(queryClient.getQueryData(['offernet-view', adminKey, 'raw-leads', { clientId: 'mtn' }]), undefined);
  assert.equal(queryClient.getQueryData(['offernet-view', viewerKey, 'raw-leads', { clientId: 'mtn' }]), undefined);

  queryClient.clear();
});

test('tenant access is revoked while an analytical page is open', () => {
  _resetAnalyticalSessionForTesting();
  let sessionNotified = false;
  const unsubscribe = subscribeToAnalyticalSession((newKey, oldKey) => {
    sessionNotified = true;
    assert.notEqual(newKey, oldKey);
  });

  // User has access to ['blc', 'mtn']
  updateAnalyticalSession({ uid: 'user_y', role: 'viewer', status: 'active', allowedTenants: ['blc', 'mtn'], isAdmin: false, isActive: true });
  const initialKey = getAnalyticalSessionKey();
  assert.equal(initialKey, 'u:user_y:r:viewer:t:blc,mtn:a:0');

  // Access to 'blc' is revoked
  sessionNotified = false;
  const changed = updateAnalyticalSession({ uid: 'user_y', role: 'viewer', status: 'active', allowedTenants: ['mtn'], isAdmin: false, isActive: true });
  assert.equal(changed, true);
  assert.equal(sessionNotified, true);
  assert.equal(getAnalyticalSessionKey(), 'u:user_y:r:viewer:t:mtn:a:0');

  unsubscribe();
});

test('an account is suspended during an in-flight request', async context => {
  _resetAnalyticalSessionForTesting();
  invalidateOffernetCache();

  // Active session
  updateAnalyticalSession({ uid: 'user_z', role: 'viewer', status: 'active', allowedTenants: ['mtn'], isAdmin: false, isActive: true });
  const url = 'http://localhost/api/analytics/offernet/overview?clientId=mtn';

  let resolveFetch!: (res: Response) => void;
  const slowResponse = new Promise<Response>(res => { resolveFetch = res; });
  context.mock.method(globalThis, 'fetch', async () => slowResponse);

  const pendingRequest = fetchOffernetJson(url);

  // Account suspended in flight
  updateAnalyticalSession({ uid: 'user_z', role: 'viewer', status: 'suspended', allowedTenants: ['mtn'], isAdmin: false, isActive: false });
  assert.equal(getAnalyticalSessionKey(), 'unauthenticated');

  // Late network resolution
  resolveFetch(new Response(JSON.stringify({ success: true, data: { status: 'OK' } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));

  await assert.rejects(pendingRequest, /cancelled|AbortError/);
  assert.equal(memoryCache.has(url), false, 'Suspended session request must not populate cache');
});

test('a request from the previous session resolves after the new session starts', async context => {
  _resetAnalyticalSessionForTesting();
  invalidateOffernetCache();

  // Session A
  updateAnalyticalSession({ uid: 'user_a', role: 'admin', status: 'active', allowedTenants: ['*'], isAdmin: true, isActive: true });
  const url = 'http://localhost/api/analytics/offernet/overview?clientId=mtn';

  let resolveFetchA!: (res: Response) => void;
  const slowFetchA = new Promise<Response>(res => { resolveFetchA = res; });
  context.mock.method(globalThis, 'fetch', async () => slowFetchA);

  const requestA = fetchOffernetJson(url);

  // User A logs out, User B logs in
  updateAnalyticalSession(null);
  updateAnalyticalSession({ uid: 'user_b', role: 'viewer', status: 'active', allowedTenants: ['mtn'], isAdmin: false, isActive: true });

  // Session A's request now resolves
  resolveFetchA(new Response(JSON.stringify({ success: true, data: { userAData: 42 } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));

  // Request A must be rejected for the caller and NOT write to memoryCache
  await assert.rejects(requestA, /cancelled|AbortError/);
  assert.equal(memoryCache.has(url), false, 'Late resolving request from previous session cannot populate cache');
});

test('an authorised user changes workspace without receiving another workspace data', async () => {
  _resetAnalyticalSessionForTesting();
  const client = new QueryClient();

  // User authorised for multiple tenants
  updateAnalyticalSession({ uid: 'multi_tenant_user', role: 'viewer', status: 'active', allowedTenants: ['mtn', 'blc'], isAdmin: false, isActive: true });
  const sessionKey = getAnalyticalSessionKey();

  const fetcher = async (params: Record<string, any>) => ({
    workspace: params.clientId,
    leads: params.clientId === 'mtn' ? 100 : 250,
  });

  const mtnOptions = operationalQueryOptions('overview', { clientId: 'mtn' }, fetcher, true, sessionKey);
  const blcOptions = operationalQueryOptions('overview', { clientId: 'blc' }, fetcher, true, sessionKey);

  // QueryKeys must be distinct
  assert.notDeepEqual(mtnOptions.queryKey, blcOptions.queryKey);

  const mtnObserver = new QueryObserver(client, mtnOptions);
  const blcObserver = new QueryObserver(client, blcOptions);

  const unsubMtn = mtnObserver.subscribe(() => {});
  const unsubBlc = blcObserver.subscribe(() => {});

  try {
    const mtnRes = await mtnObserver.refetch();
    const blcRes = await blcObserver.refetch();

    assert.equal(operationalQueryView(mtnRes).data?.workspace, 'mtn');
    assert.equal(operationalQueryView(mtnRes).data?.leads, 100);

    assert.equal(operationalQueryView(blcRes).data?.workspace, 'blc');
    assert.equal(operationalQueryView(blcRes).data?.leads, 250);
  } finally {
    unsubMtn();
    unsubBlc();
    client.clear();
  }
});

test('Lead Ledger export preserves unknowns and attaches audit metadata', () => {
  const rawRows: (string | number | null | undefined)[][] = [
    [
      'Lead ID', 'Consumer ID', 'Fetched Date', 'Offershop Source', 'Vendor',
      'Medium', 'Grade', 'Vetting', 'Valid ID', 'Valid Phone', 'Dialled',
      'Contacted (RPC)', 'Total Calls', 'Last Disposition', 'Sale', 'Activated', 'Revenue',
    ],
    // Row 1: completely unknown outcome data
    [
      'lead-1', 'c-1', '2026-09-20', 'SOURCE_A', 'Vendor 1',
      'cpc', 'A', 'Unvetted',
      'Unknown', // valid_idno was null
      'Unknown', // phone_valid was null
      'UNKNOWN', // dialled was null
      'UNKNOWN', // contacted was null
      '',        // total_calls was null, preserved as empty string (not 0)
      '',
      'UNKNOWN', // sale was null
      'UNKNOWN', // activated was null
      '',
    ],
    // Row 2: valid observed data
    [
      'lead-2', 'c-2', '2026-09-20', 'SOURCE_A', 'Vendor 1',
      'cpc', 'A', 'Green',
      'Valid (1)',
      'Valid (1)',
      'TRUE',
      'TRUE',
      3,
      'Sale Made',
      'TRUE',
      'TRUE',
      '1500.00',
    ],
  ];

  const scoped = scopedAnalysisRows(rawRows, {
    clientId: 'mtn',
    startDate: '2026-09-01',
    endDate: '2026-09-20',
    filters: { vendor: { operator: 'equals', value: 'Vendor 1' } },
    validationStatus: 'NOT_VERIFIED',
    dateBasis: 'lead_capture_cohort',
    definitions: 'Lead Ledger analytical records',
    truncated: true,
  });

  const header = scoped[0];
  assert.ok(header.includes('Scope client'));
  assert.ok(header.includes('Period start'));
  assert.ok(header.includes('Period end'));
  assert.ok(header.includes('Filters'));
  assert.ok(header.includes('Validation status'));
  assert.ok(header.includes('Detail truncated'));

  const row1 = scoped[1];
  // Verify row 1 preserved unknowns and did not fabricate invalid/false/0
  assert.equal(row1[8], 'Unknown');
  assert.equal(row1[9], 'Unknown');
  assert.equal(row1[10], 'UNKNOWN');
  assert.equal(row1[11], 'UNKNOWN');
  assert.equal(row1[12], ''); // Empty, not 0!
  assert.equal(row1[14], 'UNKNOWN');
  assert.equal(row1[15], 'UNKNOWN');

  // Verify attached audit columns on row 1
  assert.equal(row1[header.indexOf('Scope client')], 'mtn');
  assert.equal(row1[header.indexOf('Period start')], '2026-09-01');
  assert.equal(row1[header.indexOf('Period end')], '2026-09-20');
  assert.equal(row1[header.indexOf('Detail truncated')], true);
});
