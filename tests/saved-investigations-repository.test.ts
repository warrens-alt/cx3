import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  DurableSavedInvestigationRepository, MAX_SAVED_INVESTIGATIONS,
  savedInvestigationObjectName, validateSavedInvestigationCollection,
} from '../server/savedAnalyses/repository';
import { savedDraft, TestSavedBackend } from './helpers/savedInvestigations';

test('definitions persist between fresh repository instances with exact scope and owner/tenant isolation', async () => {
  const backend = new TestSavedBackend();
  const created = await new DurableSavedInvestigationRepository(backend).create('owner-a', 'tenant_a', savedDraft());
  assert.equal(created.revision, 1);
  assert.equal(created.ownerSubject, 'owner-a');
  assert.deepEqual(created.investigation, savedDraft().investigation);
  const fresh = new DurableSavedInvestigationRepository(backend);
  assert.deepEqual(await fresh.list('owner-a', 'tenant_a'), [created]);
  assert.deepEqual(await fresh.list('owner-b', 'tenant_a'), []);
  assert.deepEqual(await fresh.list('owner-a', 'tenant_b'), []);
  for (const [owner, tenant] of [['owner-b', 'tenant_a'], ['owner-a', 'tenant_b']]) {
    await assert.rejects(fresh.remove(owner, tenant, created.id, created.revision), { status: 404 });
  }
  assert.equal(backend.writes, 1);
});

test('update preserves identity/creation and stale updates or deletes leave the current definition intact', async () => {
  const backend = new TestSavedBackend(), repository = new DurableSavedInvestigationRepository(backend);
  const original = await repository.create('owner', 'tenant_a', savedDraft());
  const updated = await repository.update('owner', 'tenant_a', original.id, 1, savedDraft('tenant_a', 'Renamed'));
  assert.equal(updated.revision, 2);
  assert.equal(updated.createdAt, original.createdAt);
  assert.equal(updated.id, original.id);
  await assert.rejects(repository.update('owner', 'tenant_a', original.id, 1, savedDraft()), { status: 409 });
  await assert.rejects(repository.remove('owner', 'tenant_a', original.id, 1), { status: 409 });
  assert.deepEqual(await repository.list('owner', 'tenant_a'), [updated]);
  await repository.remove('owner', 'tenant_a', original.id, 2);
  assert.deepEqual(await new DurableSavedInvestigationRepository(backend).list('owner', 'tenant_a'), []);
});

test('concurrent creates retain both definitions, while concurrent updates of one revision have one winner', async () => {
  const backend = new TestSavedBackend(), first = new DurableSavedInvestigationRepository(backend), second = new DurableSavedInvestigationRepository(backend);
  const created = await Promise.all([first.create('owner', 'tenant_a', savedDraft()), second.create('owner', 'tenant_a', savedDraft('tenant_a', 'Another'))]);
  assert.equal((await first.list('owner', 'tenant_a')).length, 2);
  const results = await Promise.allSettled([
    first.update('owner', 'tenant_a', created[0].id, 1, savedDraft('tenant_a', 'First')),
    second.update('owner', 'tenant_a', created[0].id, 1, savedDraft('tenant_a', 'Second')),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
  assert.equal(rejected.reason.status, 409);
  assert.equal((await first.list('owner', 'tenant_a')).length, 2);
});

test('persistent CAS failure stops after bounded attempts without claiming a saved definition', async () => {
  const backend = new TestSavedBackend();
  backend.compareAndSwap = async () => { backend.writes++; return false; };
  await assert.rejects(new DurableSavedInvestigationRepository(backend).create('owner', 'tenant_a', savedDraft()), { status: 409 });
  assert.equal(backend.writes, 5);
  assert.equal(backend.data.size, 0);
});

test('private fields, tenant changes, malformed IDs and revisions fail before reads', async () => {
  const backend = new TestSavedBackend(), repository = new DurableSavedInvestigationRepository(backend);
  await assert.rejects(repository.create('owner', 'tenant_a', { ...savedDraft(), search: 'private' } as any), { status: 422 });
  await assert.rejects(repository.create('owner', 'tenant_a', savedDraft('tenant_b')), { status: 422 });
  await assert.rejects(repository.update('owner', 'tenant_a', '../id', 1, savedDraft()), { status: 400 });
  await assert.rejects(repository.remove('owner', 'tenant_a', randomUUID(), 0), { status: 400 });
  assert.equal(backend.reads, 0);
});

test('stored cross-owner, cross-tenant, duplicated and extra-field collections fail closed', async () => {
  const backend = new TestSavedBackend(), repository = new DurableSavedInvestigationRepository(backend);
  const definition = await repository.create('owner', 'tenant_a', savedDraft());
  const valid = { version: 1 as const, ownerSubject: 'owner', tenantId: 'tenant_a', definitions: [definition] };
  for (const invalid of [
    { ...valid, ownerSubject: 'other' }, { ...valid, tenantId: 'tenant_b' }, { ...valid, leadIds: ['private'] },
    { ...valid, definitions: [definition, definition] },
    { ...valid, definitions: [{ ...definition, ownerSubject: 'other' }] },
    { ...valid, definitions: [{ ...definition, scope: { ...definition.scope, tenantId: 'tenant_b' } }] },
    { ...valid, definitions: [{ ...definition, records: [] }] },
  ]) assert.throws(() => validateSavedInvestigationCollection(invalid, 'owner', 'tenant_a'), { status: 503 });
  backend.data.set(savedInvestigationObjectName('owner', 'tenant_a'), { collection: { ...valid, ownerSubject: 'other' }, generation: '2' });
  await assert.rejects(repository.list('owner', 'tenant_a'), { status: 503 });
  await assert.rejects(repository.remove('owner', 'tenant_a', definition.id, 1), { status: 503 });
  assert.equal(backend.writes, 1);
});

test('definition limit prevents a new write without replacing saved definitions', async () => {
  const backend = new TestSavedBackend(), repository = new DurableSavedInvestigationRepository(backend);
  const definition = await repository.create('owner', 'tenant_a', savedDraft());
  const current = backend.data.get(savedInvestigationObjectName('owner', 'tenant_a'))!;
  current.collection.definitions = Array.from({ length: MAX_SAVED_INVESTIGATIONS }, () => ({ ...definition, id: randomUUID() }));
  await assert.rejects(repository.create('owner', 'tenant_a', savedDraft()), { code: 'SAVED_INVESTIGATION_LIMIT', status: 409 });
  assert.equal(backend.writes, 1);
});

test('stored safe opaque IDs that cannot be mutated through the API are rejected as corruption', async () => {
  const backend = new TestSavedBackend(), repository = new DurableSavedInvestigationRepository(backend);
  const definition = await repository.create('owner', 'tenant_a', savedDraft());
  const current = backend.data.get(savedInvestigationObjectName('owner', 'tenant_a'))!;
  current.collection.definitions = [{ ...definition, id: 'safe-but-not-a-uuid' }];
  await assert.rejects(repository.list('owner', 'tenant_a'), { code: 'SAVED_COLLECTION_INVALID', status: 503 });
  await assert.rejects(repository.create('owner', 'tenant_a', savedDraft()), { code: 'SAVED_COLLECTION_INVALID', status: 503 });
  assert.equal(backend.writes, 1);
  assert.equal(current.collection.definitions[0].id, 'safe-but-not-a-uuid');
});

test('all-time, one-sided and unfiltered reporting scopes remain explicit', async () => {
  const backend = new TestSavedBackend(), repository = new DurableSavedInvestigationRepository(backend);
  for (const [startDate, endDate] of [[null, null], ['2026-09-01', null], [null, '2026-09-30']]) {
    const draft = savedDraft(); draft.scope = { ...draft.scope, startDate, endDate, filters: {} }; draft.investigation = {};
    const saved = await repository.create('owner', 'tenant_a', draft);
    assert.deepEqual(saved.scope, draft.scope); assert.deepEqual(saved.investigation, {});
  }
});
