import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  isChunkLoadError,
  attemptChunkRecovery,
  registerVitePreloadRecovery,
  CHUNK_RELOAD_STORAGE_KEY,
  CHUNK_RELOAD_GUARD_MS,
} from '../src/lib/chunkRecovery';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('normal application errors are not treated as chunk errors', () => {
  assert.equal(isChunkLoadError(null), false);
  assert.equal(isChunkLoadError(undefined), false);
  assert.equal(isChunkLoadError(new Error('Cannot read properties of undefined (reading "map")')), false);
  assert.equal(isChunkLoadError(new TypeError('x is not a function')), false);
  assert.equal(isChunkLoadError('Network timeout on API request'), false);
  assert.equal(isChunkLoadError({ name: 'ValidationError', message: 'Invalid tenant' }), false);
});

test('known chunk-fetch failures are recognized', () => {
  assert.equal(isChunkLoadError(new Error('Failed to fetch dynamically imported module: /assets/CliPerformance-xyz.js')), true);
  assert.equal(isChunkLoadError(new Error('error loading dynamically imported module')), true);
  assert.equal(isChunkLoadError(new Error('Failed to fetch')), true);
  assert.equal(isChunkLoadError(new Error('Loading chunk 42 failed')), true);
  assert.equal(isChunkLoadError(new Error('Unable to preload CSS for /assets/index.css')), true);
  assert.equal(isChunkLoadError({ name: 'ChunkLoadError', message: 'Chunk failed' }), true);
  assert.equal(isChunkLoadError('Loading chunk 5 failed'), true);
});

test('reload looping is guarded and session-storage timestamp is respected', () => {
  const store = new Map<string, string>();
  const mockStorage: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => { store.set(key, String(val)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    length: store.size,
  };

  let reloads = 0;
  const reloadFn = () => { reloads++; };

  // First call with empty storage: should trigger recovery
  const recovered1 = attemptChunkRecovery(CHUNK_RELOAD_GUARD_MS, mockStorage, reloadFn);
  assert.equal(recovered1, true);
  assert.equal(reloads, 1);
  assert.ok(mockStorage.getItem(CHUNK_RELOAD_STORAGE_KEY));

  // Immediate second call: must be guarded against infinite reload loop
  const recovered2 = attemptChunkRecovery(CHUNK_RELOAD_GUARD_MS, mockStorage, reloadFn);
  assert.equal(recovered2, false);
  assert.equal(reloads, 1, 'reload should not fire within the guard window');

  // After the guard window expires: should be allowed to reload again
  const pastTimestamp = Date.now() - (CHUNK_RELOAD_GUARD_MS + 1000);
  mockStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(pastTimestamp));

  const recovered3 = attemptChunkRecovery(CHUNK_RELOAD_GUARD_MS, mockStorage, reloadFn);
  assert.equal(recovered3, true);
  assert.equal(reloads, 2);
});

test('registerVitePreloadRecovery attaches and cleans up event listener', () => {
  const listeners: Record<string, EventListener[]> = {};
  const mockTarget: EventTarget = {
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(listener as EventListener);
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      listeners[type] = (listeners[type] || []).filter(l => l !== listener);
    },
    dispatchEvent: (_event: Event) => true,
  };

  const cleanup = registerVitePreloadRecovery(CHUNK_RELOAD_GUARD_MS, mockTarget);
  assert.equal(listeners['vite:preloadError']?.length, 1);

  cleanup();
  assert.equal(listeners['vite:preloadError']?.length, 0);
});

test('server static caching sets no-cache for HTML and immutable caching for hashed assets', () => {
  const server = read('server.ts');
  assert.match(server, /res\.setHeader\('Cache-Control',\s*'no-cache,\s*no-store,\s*must-revalidate'\)/);
  assert.match(server, /res\.setHeader\('Cache-Control',\s*'public,\s*max-age=31536000,\s*immutable'\)/);
});
