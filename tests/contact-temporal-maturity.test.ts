import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { JSDOM, VirtualConsole } from 'jsdom';
import { buildAcceptanceFixture } from '../scripts/build-frontend-acceptance-fixture.mjs';
import { convergencePayloads } from './frontend/convergenceFixtures';

const output = await mkdtemp(path.join(tmpdir(), 'cx3-contact-maturity-'));
await buildAcceptanceFixture(output);
const script = await readFile(path.join(output, 'fixture.js'), 'utf8');
test.after(() => rm(output, { recursive: true, force: true }));
const scope = '?clientId=synthetic-a&startDate=2026-09-28&endDate=2026-09-28';

async function mount(route: string) {
  const errors: string[] = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => { if (!error.message.includes('navigation')) errors.push(error.message); });
  console.on('error', (...args) => errors.push(args.map(String).join(' ')));
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://synthetic.invalid', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console });
  const w = dom.window as any;
  Object.assign(w, { Response, Request, Headers, AbortController, TextEncoder, TextDecoder, ReadableStream, ResizeObserver: class { observe() {} unobserve() {} disconnect() {} }, __fixture: { initialRoute: route + scope, payloads: convergencePayloads } });
  w.matchMedia = (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLElement.prototype.scrollTo = () => {};
  w.scrollTo = () => {};
  w.HTMLElement.prototype.getClientRects = function () {
    if (!this.isConnected || this.closest('[hidden]')) return [];
    return [new w.DOMRect(0, 0, 100, 30)];
  };
  w.eval(script);
  const wait = async (check: () => unknown) => {
    for (let i = 0; i < 200; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
    throw new Error(`Expected UI: ${w.document.body.textContent?.slice(0, 1000)}. Errors: ${errors.join('\n')}`);
  };
  const click = async (selector: string) => { const element = w.document.querySelector(selector); assert.ok(element, selector); element.focus(); element.click(); await new Promise(resolve => setTimeout(resolve, 40)); return element; };
  const close = () => { w.__fixture.unmount(); dom.window.close(); };
  await wait(() => w.document.querySelector('main h1'));
  return { w, errors, wait, click, close };
}

test('call-effort selection links visual and exact row without opening an inspector or changing scope', async () => {
  const app = await mount('/contact-strategy');
  try {
    await app.wait(() => app.w.document.querySelector('.cx-effort-distribution .cx-evidence-bar-row'));
    const beforeRequests = [...app.w.__fixture.requests];
    const beforeScope = app.w.__fixture.location;
    const beforeData = JSON.stringify(app.w.__fixture.payloads['/api/analytics/offernet/contact-strategy']);
    await app.click('.cx-effort-distribution button[aria-label="Select 1 call: 80"]');
    assert.equal(app.w.document.querySelector('.cx-contact-selection strong')?.textContent, '1 call');
    assert.equal(app.w.document.querySelector('tr[data-bucket="1 call"]')?.getAttribute('data-selected'), 'true');
    assert.equal(app.w.document.querySelector('[role="dialog"]'), null);
    await app.click('button[aria-label="Select 0 calls in call-effort visual"]');
    assert.equal(app.w.document.querySelector('.cx-effort-distribution button[aria-label="Select 0 calls: 20"]')?.getAttribute('aria-pressed'), 'true');
    assert.equal(app.w.document.querySelector('.cx-contact-selection strong')?.textContent, '0 calls');
    assert.deepEqual([...app.w.__fixture.requests], beforeRequests);
    assert.equal(app.w.__fixture.location, beforeScope);
    assert.equal(JSON.stringify(app.w.__fixture.payloads['/api/analytics/offernet/contact-strategy']), beforeData);
    assert.deepEqual(app.errors, []);
  } finally { app.close(); }
});

test('temporal keyboard selection updates one day, one hour and persistent zero/unavailable values without requests', async () => {
  const app = await mount('/temporal');
  try {
    await app.wait(() => app.w.document.querySelectorAll('.cx-temporal-cell').length === 168);
    const beforeRequests = [...app.w.__fixture.requests];
    const beforeScope = app.w.__fixture.location;
    const beforeData = JSON.stringify(app.w.__fixture.payloads['/api/analytics/offernet/temporal']);
    assert.match(app.w.document.querySelector('.cx-temporal-cell-detail').textContent, /Leads0/);
    const first = app.w.document.querySelector('.cx-temporal-cell');
    first.focus();
    first.dispatchEvent(new app.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await app.wait(() => app.w.document.querySelector('.cx-temporal-cell[aria-pressed="true"]')?.getAttribute('aria-label')?.includes('Monday 01:00'));
    assert.equal(app.w.document.querySelectorAll('.cx-temporal-cell[data-selected-day="true"]').length, 24);
    assert.equal(app.w.document.querySelectorAll('.cx-temporal-cell[data-selected-hour="true"]').length, 7);
    assert.equal(app.w.document.querySelectorAll('.cx-temporal-cell[aria-pressed="true"]').length, 1);
    assert.equal(app.w.document.querySelector('.cx-temporal-day[data-selected="true"]')?.textContent, 'Mon');
    assert.equal(app.w.document.querySelector('.cx-temporal-hour[data-selected="true"]')?.textContent, '01');
    assert.match(app.w.document.querySelector('.cx-temporal-cell-detail').textContent, /Selected windowMonday · 01:00–02:00/);
    assert.match(app.w.document.querySelector('.cx-temporal-cell-detail').textContent, /RPC rateUnavailable/);
    assert.deepEqual([...app.w.__fixture.requests], beforeRequests);
    assert.equal(app.w.__fixture.location, beforeScope);
    assert.equal(JSON.stringify(app.w.__fixture.payloads['/api/analytics/offernet/temporal']), beforeData);
    assert.deepEqual(app.errors, []);
  } finally { app.close(); }
});

test('temporal focus keeps selected evidence mounted, shows exact scope and restores focus without requests', async () => {
  const app = await mount('/temporal');
  try {
    await app.wait(() => app.w.document.querySelectorAll('.cx-temporal-cell').length === 168);
    const beforeRequests = [...app.w.__fixture.requests];
    const originalCell = app.w.document.querySelector('.cx-temporal-cell');
    const trigger = await app.click('button[aria-label="Focus: Day × hour matrix"]');
    await app.wait(() => app.w.document.querySelector('.cx-temporal-hero[role="dialog"]'));
    assert.equal(app.w.document.querySelector('.cx-temporal-cell'), originalCell);
    assert.equal(app.w.document.querySelectorAll('.cx-temporal-cell').length, 168);
    assert.match(app.w.document.querySelector('.cx-chart-focus-scope').textContent, /Synthetic workspace A.*2026-09-28.*All vendors.*All sources/);
    app.w.document.dispatchEvent(new app.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await app.wait(() => !app.w.document.querySelector('.cx-temporal-hero[role="dialog"]'));
    assert.equal(app.w.document.activeElement, trigger);
    assert.equal(app.w.document.querySelector('.cx-temporal-cell'), originalCell);
    assert.deepEqual([...app.w.__fixture.requests], beforeRequests);
    assert.deepEqual(app.errors, []);
  } finally { app.close(); }
});
