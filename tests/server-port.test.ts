import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { resolvePort, validatePortNumber, createApp } from '../server';

test('validatePortNumber rejects missing, malformed, fractional, negative, or out-of-range values', () => {
  // Empty / missing
  assert.throws(() => validatePortNumber('', 'test'), /empty port value/);
  assert.throws(() => validatePortNumber(undefined, 'test'), /empty port value/);

  // Non-numeric strings
  assert.throws(() => validatePortNumber('abc', 'test'), /not a valid integer port/);
  assert.throws(() => validatePortNumber('3000a', 'test'), /not a valid integer port/);

  // Fractions
  assert.throws(() => validatePortNumber('3000.5', 'test'), /not a valid integer port/);

  // Negatives
  assert.throws(() => validatePortNumber('-3000', 'test'), /not a valid integer port/);
  assert.throws(() => validatePortNumber('0', 'test'), /out of TCP port range/);

  // Out of range (>65535)
  assert.throws(() => validatePortNumber('65536', 'test'), /out of TCP port range/);
  assert.throws(() => validatePortNumber('99999', 'test'), /out of TCP port range/);

  // Valid values
  assert.equal(validatePortNumber('3000', 'test'), 3000);
  assert.equal(validatePortNumber('8080', 'test'), 8080);
  assert.equal(validatePortNumber('1', 'test'), 1);
  assert.equal(validatePortNumber('65535', 'test'), 65535);
  assert.equal(validatePortNumber(8080, 'test'), 8080);
});

test('resolvePort returns default 3000 when no port is specified', () => {
  const port = resolvePort(['node', 'server.ts'], {});
  assert.equal(port, 3000);
});

test('resolvePort honours valid PORT environment variable, including PORT=8080', () => {
  assert.equal(resolvePort(['node', 'server.ts'], { PORT: '8080' }), 8080);
  assert.equal(resolvePort(['node', 'server.ts'], { PORT: '4000' }), 4000);
});

test('resolvePort honours command-line --port flag with precedence over PORT', () => {
  const port = resolvePort(
    ['node', 'server.ts', '--port', '5050'],
    { PORT: '8080' }
  );
  assert.equal(port, 5050);
});

test('resolvePort rejects missing --port argument value', () => {
  assert.throws(
    () => resolvePort(['node', 'server.ts', '--port'], {}),
    /Missing value for --port argument/
  );
  assert.throws(
    () => resolvePort(['node', 'server.ts', '--port', '--host', '0.0.0.0'], {}),
    /Missing value for --port argument/
  );
});

test('resolvePort fails closed on invalid PORT or --port rather than falling back', () => {
  assert.throws(
    () => resolvePort(['node', 'server.ts'], { PORT: 'invalid' }),
    /Invalid PORT environment variable: "invalid" is not a valid integer port/
  );
  assert.throws(
    () => resolvePort(['node', 'server.ts', '--port', '99999'], {}),
    /out of TCP port range/
  );
});

test('server smoke request on a dynamic test port', async () => {
  const express = (await import('express')).default;
  const { mountApi } = await import('../server/apiApp');
  const app = express();
  await mountApi(app);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as AddressInfo).port;
  assert.ok(port > 0);

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/analytics/clients`);
    // Authentication / client route behaves predictably
    assert.ok(res.status === 200 || res.status === 401 || res.status === 403);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
