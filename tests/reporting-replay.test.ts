import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import express from 'express';
import { REPORT_REPLAY_VERSION } from '../contracts/reporting';
import { attachReplayToken, replayReport } from '../server/reporting/replay';
import { executeReport } from '../server/reporting/service';
import { createReportingRouter } from '../server/reporting/router';
import { apiErrorHandler } from '../server/apiErrors';
import { fixtureRelease, fixtureRepository, fixtureRow, principal, request } from './reporting-fixtures';

const key = 'synthetic-test-signing-key-32-bytes-only';
const now = new Date('2026-10-02T12:00:00.000Z');
const options = { signingKey: key, now };
const replayBody = (token: string, tenantId = request.tenantId) => ({ contractVersion: REPORT_REPLAY_VERSION, tenantId, token });
async function report() { return attachReplayToken(await executeReport(fixtureRepository().repository, principal, request), key, now); }
function resign(token: string, change: (payload: any) => void): string {
  const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()); change(payload);
  const serialized = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${serialized}.${createHmac('sha256', key).update(serialized).digest('base64url')}`;
}

test('report signing explicitly reports missing or weak configuration and unavailable results', async () => {
  const original = await executeReport(fixtureRepository().repository, principal, request);
  for (const invalidKey of ['', 'short']) {
    const result = attachReplayToken(original, invalidKey, now);
    assert.equal(result.token, null); assert.equal(result.replay.status, 'NOT_CONFIGURED');
  }
  const unavailable = attachReplayToken({ ...original, status: 'UNAVAILABLE' }, key, now);
  assert.equal(unavailable.token, null); assert.equal(unavailable.replay.status, 'NOT_REPLAYABLE');
  const result = await replayReport(fixtureRepository().repository, principal, replayBody('anything'), { signingKey: '', now });
  assert.equal(result.status, 'NOT_REPLAYABLE');
});

test('signed descriptor binds original exact scope, release, snapshots and generation contract without SQL or credentials', async () => {
  const result = await report(); assert.equal(result.replay.status, 'AVAILABLE'); assert.ok(result.token);
  const descriptor = JSON.parse(Buffer.from(result.token!.split('.')[0], 'base64url').toString());
  assert.deepEqual(descriptor.original.request, request);
  assert.equal(descriptor.manifestHash, result.manifestHash);
  assert.deepEqual(descriptor.snapshot, result.snapshot);
  assert.equal(descriptor.original.resultHash, result.resultHash);
  assert.equal(descriptor.original.totals[0].value, '9007199254740993');
  assert.equal(descriptor.expiresAt, '2026-11-01T12:00:00.000Z');
  assert.doesNotMatch(JSON.stringify(descriptor), /SELECT|BIGQUERY_CREDENTIALS|signing.key|private_key|lead_id/);
});

test('invalid signature, tampering, expiry, future issuance and unsupported descriptor versions fail before release access', async () => {
  const original = await report(), token = original.token!;
  const invalid = [
    `${token.slice(0, -3)}xxx`,
    `x${token}`,
    'x'.repeat(56_001),
    resign(token, payload => { payload.contractVersion = 'future'; }),
    resign(token, payload => { payload.expiresAt = '2026-10-01T00:00:00Z'; }),
    resign(token, payload => { payload.issuedAt = '2026-10-04T00:00:00Z'; }),
    resign(token, payload => { payload.original.request.filters = { lead_id: ['private'] }; }),
    resign(token, payload => { payload.original.request.metrics = ['unknown_metric']; }),
    resign(token, payload => { payload.original.totals[0].value = 9007199254740992; }),
  ];
  for (const candidate of invalid) {
    const { repository, calls } = fixtureRepository();
    const result = await replayReport(repository, principal, replayBody(candidate), options);
    assert.equal(result.status, 'REPLAY_INVALID'); assert.equal(result.original, null);
    assert.equal(calls.releases, 0); assert.equal(calls.queries.length, 0);
  }
});

test('replay reauthorises both caller tenant and signed tenant with no cross-tenant disclosure', async () => {
  const token = (await report()).token!;
  const { repository, calls } = fixtureRepository();
  await assert.rejects(replayReport(repository, undefined, replayBody(token), options), { status: 401 });
  await assert.rejects(replayReport(repository, { ...principal, tenants: ['tenant_b'] }, replayBody(token), options), { status: 403 });
  await assert.rejects(replayReport(repository, { ...principal, tenants: ['tenant_a', 'tenant_b'] }, replayBody(token, 'tenant_b'), options), { status: 403 });
  assert.equal(calls.releases, 0);
});

test('missing, revoked and unreadable release snapshots have an explicit RELEASE_UNAVAILABLE state', async () => {
  const token = (await report()).token!;
  for (const release of [null, { ...fixtureRelease(), status: 'REVOKED' as const }]) {
    const result = await replayReport(fixtureRepository(release).repository, principal, replayBody(token), options);
    assert.equal(result.status, 'RELEASE_UNAVAILABLE'); assert.ok(result.original); assert.equal(result.replayed, null);
  }
  const { repository } = fixtureRepository(); repository.assertSnapshots = async () => { throw new Error('Missing snapshot'); };
  assert.equal((await replayReport(repository, principal, replayBody(token), options)).status, 'RELEASE_UNAVAILABLE');
});

test('changed immutable manifest, definition and snapshot identity refuse replay before query', async () => {
  const token = (await report()).token!;
  for (const change of [(release: any) => { release.approvalReference = 'changed'; }, (release: any) => { release.metricVersion = 'changed'; }, (release: any) => { release.execution.snapshot.snapshotTime = '2026-09-03T00:00:01Z'; }]) {
    const release = fixtureRelease(); change(release);
    const { repository, calls } = fixtureRepository(release);
    assert.equal((await replayReport(repository, principal, replayBody(token), options)).status, 'REPLAY_INVALID');
    assert.equal(calls.queries.length, 0);
  }
});

test('successful replay compares original and reproduced evidence without labelling a match reconciliation', async () => {
  const original = await report();
  const result = await replayReport(fixtureRepository().repository, principal, replayBody(original.token!), options);
  assert.equal(result.status, 'MATCH'); assert.equal(result.original!.resultHash, result.replayed!.resultHash);
  assert.deepEqual(result.original!.totals, result.replayed!.totals);
  assert.equal(result.comparisonKind, 'IMMUTABLE_REPRODUCTION');
  assert.equal(result.reconciliationStatus, 'NOT_VERIFIED'); assert.equal(result.businessMeaningStatus, 'NOT_VERIFIED');
  assert.match(result.reason, /not independent source reconciliation/);
});

test('changed aggregate values produce exact original/replay comparison and MISMATCH', async () => {
  const original = await report();
  const row = { ...fixtureRow(), value: '9007199254740994', numerator: '9007199254740994' };
  const result = await replayReport(fixtureRepository(fixtureRelease(), [row]).repository, principal, replayBody(original.token!), options);
  assert.equal(result.status, 'MISMATCH'); assert.equal(result.original!.totals[0].value, '9007199254740993');
  assert.equal(result.replayed!.totals[0].value, '9007199254740994'); assert.equal(result.reconciliationStatus, 'NOT_VERIFIED');
});

test('token expiry and signing key rotation invalidate old descriptors', async () => {
  const token = (await report()).token!;
  const { repository, calls } = fixtureRepository();
  assert.equal((await replayReport(repository, principal, replayBody(token), { ...options, now: new Date('2026-11-01T12:00:00Z') })).status, 'REPLAY_INVALID');
  assert.equal((await replayReport(repository, principal, replayBody(token), { ...options, signingKey: 'rotated-synthetic-key-32-bytes-or-more' })).status, 'REPLAY_INVALID');
  assert.equal(calls.queries.length, 0);
});

test('HTTP execution issues a signed token and replay returns MATCH through the same authorised router', async () => {
  const priorKey = process.env.CX_REPORT_SIGNING_KEY; process.env.CX_REPORT_SIGNING_KEY = key;
  const app = express(); app.use(express.json()); app.use((_req, res, next) => { res.locals.principal = principal; next(); });
  app.use('/api/reporting', createReportingRouter(fixtureRepository().repository)); app.use(apiErrorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  const send = (path: string, body: unknown) => fetch(`${origin}/api/reporting${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const created = await send('', request); assert.equal(created.status, 200);
    const { data } = await created.json(); assert.ok(data.token); assert.equal(data.replay.status, 'AVAILABLE');
    const replayed = await send('/replay', replayBody(data.token)); assert.equal(replayed.status, 200); assert.equal((await replayed.json()).data.status, 'MATCH');
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (priorKey === undefined) delete process.env.CX_REPORT_SIGNING_KEY; else process.env.CX_REPORT_SIGNING_KEY = priorKey;
  }
});
