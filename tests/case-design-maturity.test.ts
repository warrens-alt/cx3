import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM, VirtualConsole } from 'jsdom';
import LeadJourney from '../src/features/leadLedger/LeadJourney';
import SourceEvidenceMatrix from '../src/features/trust/components/SourceEvidenceMatrix';
import { buildLedgerTimeline } from '../src/features/leadLedger/timeline';
import { buildAcceptanceFixture } from '../scripts/build-frontend-acceptance-fixture.mjs';

test('forensic rows align existing raw timestamps separately from stage copy and retain model elapsed labels', () => {
  const row = { lead_id: 'forensic', fetched: '2026-09-28T09:04:13Z', delivered_time: '2026-09-28T09:11:24Z', first_call_time: '2026-09-28T09:10:00Z', dialled: true, contacted: true, sale: true, activated: true };
  const doc = new JSDOM(renderToStaticMarkup(React.createElement(LeadJourney, { row }))).window.document;
  const timeline = buildLedgerTimeline(row);
  const nodes = [...doc.querySelectorAll('.cx-journey-spine .cx-journey-event')];
  assert.equal(nodes.length, timeline.milestones.length);
  nodes.forEach((node, index) => {
    assert.equal(node.firstElementChild?.className, 'cx-journey-time-column');
    assert.equal(node.querySelector('time')?.getAttribute('datetime') ?? null, timeline.milestones[index].timestamp);
    assert.equal(node.querySelector('.cx-journey-event-copy strong')?.textContent, timeline.milestones[index].title);
    assert.ok(node.querySelector('.cx-journey-node svg'));
  });
  assert.deepEqual([...doc.querySelectorAll('.cx-journey-elapsed')].map(node => node.textContent), timeline.milestones.slice(1).map(event => timeline.transitions.find(item => item.toId === event.id)?.label || 'Time unavailable'));
  assert.match(doc.querySelector('.cx-journey-spine [data-stage=call] .cx-journey-inline-anomaly')!.textContent!, /precedes delivered/);
  assert.equal(doc.querySelectorAll('.cx-journey-spine .cx-journey-untimed').length, 3);
});

test('compact source observability keeps unavailable contracts neutral, zero explicit and exact source evidence accessible', () => {
  const doc = new JSDOM(renderToStaticMarkup(React.createElement(SourceEvidenceMatrix, { sources: [
    { key: 'missing', label: 'Timestamp contract absent', table: null, status: 'TIMESTAMP_CONTRACT_REQUIRED', latestRecordAt: null, ageHours: null, rowCount: null, detail: 'No timestamp contract supplied' },
    { key: 'zero', label: 'Returned zero', table: 'tenant.source', status: 'OBSERVED', latestRecordAt: '2026-09-28T09:04:13Z', ageHours: 0, rowCount: 0, detail: 'Returned source evidence' },
  ] }))).window.document;
  assert.match(doc.querySelector('.cx-chart-frame-header')!.textContent!, /independent of the selected capture cohort/);
  const rows = doc.querySelectorAll('.cx-evidence-matrix tbody tr');
  assert.equal(rows[0].querySelectorAll('td[data-state=unavailable]').length, 3);
  assert.equal(rows[0].querySelectorAll('td[data-state=issue]').length, 0);
  assert.match(rows[1].textContent!, /0 rows.*0h returned age/);
  assert.equal(doc.querySelector('.cx-source-exact-evidence time')!.getAttribute('datetime'), '2026-09-28T09:04:13Z');
  assert.ok(doc.querySelector('button[aria-label="Focus: Source evidence at a glance"]'));
});

const output = await mkdtemp(path.join(tmpdir(), 'cx3-case-maturity-'));
await buildAcceptanceFixture(output);
const script = await readFile(path.join(output, 'fixture.js'), 'utf8');
test.after(() => rm(output, { recursive: true, force: true }));

test('case identity and local driver selection survive focus without scope mutation or new requests', async () => {
  const errors: string[] = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  console.on('error', (...args) => errors.push(args.join(' ')));
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://synthetic.invalid', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console });
  const w = dom.window as any;
  const route = '/investigate?clientId=synthetic-a&startDate=2026-09-28&endDate=2026-09-28&vendor=Vendor+A&drill=awaiting-first-dial&segmentSource=Source+A';
  Object.assign(w, { Response, Request, Headers, AbortController, TextEncoder, TextDecoder, ReadableStream, structuredClone,
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    __fixture: { initialRoute: route, payloads: { '/api/analytics/offernet/exceptions': { validationStatus: 'NOT_VERIFIED', populationNote: 'Synthetic evidence', comparison: { current: { startDate: '2026-09-28', endDate: '2026-09-28' }, previous: { startDate: '2026-09-27', endDate: '2026-09-27' }, days: 1 }, exceptions: [{ id: 'awaiting-first-dial', title: 'Awaiting first dial', count: 20, previousCount: 15, absoluteChange: 5, percentageChange: 100 / 3, severity: 'medium', description: 'Returned case', byVendor: [{ name: 'Vendor A', count: 20 }], bySource: [{ name: 'Source A', count: 20 }] }] } } } });
  w.matchMedia = (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {}; w.HTMLElement.prototype.scrollTo = () => {}; w.scrollTo = () => {};
  w.HTMLElement.prototype.getClientRects = function () { return this.isConnected && !this.closest('[hidden]') ? [new w.DOMRect(0, 0, 100, 30)] : []; };
  const wait = async (check: () => unknown) => { for (let i = 0; i < 150; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); } throw new Error('Case maturity UI did not settle: ' + errors.join('; ')); };
  const doc = w.document;
  try {
    w.eval(script);
    await wait(() => doc.querySelector('.cx-driver-bar-select'));
    const context = doc.querySelector('[aria-label="Investigation context"]');
    const caseScope = context.querySelector('[aria-label="Current case scope"]');
    assert.equal(caseScope.closest('details'), null);
    assert.match(caseScope.textContent, /Synthetic workspace.*2026-09-28.*vendor:.*Vendor A/);
    assert.match(context.querySelector('.cx-investigation-heading').textContent, /Awaiting first dial.*20 affected leads/);
    const narrowing = context.querySelector('[aria-label="Investigation predicate and narrowing"]');
    assert.match(narrowing.textContent, /Source: Source A/);
    assert.doesNotMatch(narrowing.textContent, /20|15|5 leads/);
    const before = JSON.stringify(w.__fixture.requests);
    const url = w.__fixture.location;
    const highlight = doc.querySelector('button[aria-label="Highlight Vendor A evidence"]');
    highlight.click();
    await wait(() => highlight.getAttribute('aria-pressed') === 'true');
    const row = doc.querySelector('.cx-driver-table tr[data-selected=true]');
    assert.match(row.textContent, /Vendor A.*20/);
    const focus = doc.querySelector('.cx-driver-analysis .cx-chart-focus-toggle');
    focus.focus(); focus.click();
    await wait(() => doc.querySelector('.cx-driver-analysis [role=dialog]'));
    assert.equal(doc.querySelector('.cx-driver-table tr[data-selected=true]'), row, 'Focus retains the same selected evidence subtree');
    assert.match(doc.querySelector('.cx-chart-focus-scope').textContent, /Synthetic workspace A.*2026-09-28.*Vendor A/);
    assert.match(doc.querySelector('.cx-chart-focus-scope').textContent, /Investigation: Awaiting first dial.*Source: Source A/);
    doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(() => !doc.querySelector('.cx-driver-analysis [role=dialog]'));
    assert.equal(doc.activeElement, focus);
    assert.equal(JSON.stringify(w.__fixture.requests), before);
    assert.equal(w.__fixture.location, url);
    highlight.click(); await wait(() => highlight.getAttribute('aria-pressed') === 'false');
    assert.equal(doc.querySelector('.cx-driver-table tr[data-selected=true]'), null);
  } finally { w.__fixture.unmount?.(); dom.window.close(); }
  assert.deepEqual(errors, []);
});
