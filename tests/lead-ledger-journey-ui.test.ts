import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { buildLedgerTimelineFixture } from '../scripts/build-ledger-timeline-fixture.mjs';

const output = await mkdtemp(path.join(tmpdir(), 'cx3-ledger-journey-ui-'));
await buildLedgerTimelineFixture(output, { includeProductionCss: false });
const script = await readFile(path.join(output, 'fixture.js'), 'utf8');
test.after(() => rm(output, { recursive: true, force: true }));
const scope = '?clientId=synthetic-a&startDate=2026-09-15&endDate=2026-09-30';
const replicaPath = '/api/analytics/lead-ledger/replica';
const operationalPath = '/api/analytics/offernet/raw-leads';

async function mount(query = scope) {
  const errors: string[] = [];
  const console = new VirtualConsole();
  console.on('jsdomError', (error: Error) => { if (!error.message.includes('navigation')) errors.push(error.message); });
  console.on('error', (...args: unknown[]) => errors.push(args.map(String).join(' ')));
  // Geometry is covered by browser QA. Hide the mobile duplicate source view so
  // the real source-field focus effect can be exercised with desktop semantics.
  const dom = new JSDOM('<!doctype html><html><head><style>.cx-ledger-mobile-list{display:none}</style></head><body><div id="root"></div></body></html>', {
    url: 'https://synthetic.invalid/lead-explorer' + query + '&view=population&preset=journey', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console,
  });
  const w = dom.window as any;
  Object.assign(w, { Response, Request, Headers, AbortController, TextEncoder, TextDecoder, ReadableStream, structuredClone, ResizeObserver: class { observe() {} unobserve() {} disconnect() {} }, __fixture: {} });
  w.matchMedia = (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {}; w.HTMLElement.prototype.scrollTo = () => {}; w.scrollTo = () => {};
  w.HTMLElement.prototype.getClientRects = function () {
    if (!this.isConnected || this.closest('[hidden]')) return [];
    for (let element = this; element; element = element.parentElement) if (w.getComputedStyle(element).display === 'none') return [];
    return [new w.DOMRect(0, 0, 100, 30)];
  };
  const copied: string[] = [];
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (value: string) => { copied.push(value); } } });
  w.eval(script);
  const text = () => w.document.body.textContent || '';
  const find = (selector: string, label?: string): any => [...w.document.querySelectorAll(selector)].find((element: any) => label === undefined || (element.getAttribute('aria-label') || element.textContent || '').includes(label));
  const wait = async (check: () => unknown, label = 'Expected journey presentation') => {
    for (let i = 0; i < 150; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
    throw new Error(`${label}\n${text().slice(-4000)}\nErrors: ${errors.join('; ')}`);
  };
  const click = async (selector: string, label?: string) => {
    const element = find(selector, label); assert.ok(element, `Missing ${selector}: ${label}`);
    element.focus(); element.click(); await new Promise(resolve => setTimeout(resolve, 30)); return element;
  };
  const key = async (element: any, value: string) => {
    element.dispatchEvent(new w.KeyboardEvent('keydown', { key: value, bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 25));
  };
  const requests = () => Array.from(w.__fixture.requests) as string[];
  const close = () => { w.__fixture.unmount(); dom.window.close(); assert.deepEqual(errors, []); };
  try { await wait(() => find('.cx-investigation-records tbody tr')); }
  catch (error) { close(); throw error; }
  return { w, text, find, wait, click, key, requests, copied, close };
}

async function openOperational(app: Awaited<ReturnType<typeof mount>>) {
  await app.wait(() => app.find('.cx-investigation-records tbody tr button.cx-record-open'));
  assert.equal(new URL(app.w.__fixture.location, 'https://synthetic.invalid').pathname, '/lead-explorer');
  assert.equal(app.requests().some(request => request.startsWith(replicaPath)), false);
}

async function selectLead(app: Awaited<ReturnType<typeof mount>>, leadId: string) {
  const trigger = await app.click('.cx-investigation-records tbody tr button.cx-record-open', leadId);
  await app.wait(() => app.find('.cx-lead-dossier h2')?.textContent === leadId && app.w.document.activeElement === app.find('.cx-lead-dossier'));
  await app.click('.cx-dossier-tabs [role="tab"]', 'Journey');
  await app.wait(() => app.find('.cx-ledger-journey'));
  return trigger;
}

test('the actual operational page renders the loaded journey and all investigation controls stay request-free', async () => {
  const app = await mount();
  try {
    await openOperational(app);
    assert.equal(app.requests().filter(request => request.startsWith(operationalPath)).length, 1);
    const trigger = await selectLead(app, 'SYN-COMPLETE');
    const before = app.requests();
    assert.equal(trigger.getAttribute('aria-pressed'), 'true');
    assert.equal(app.find('.cx-dossier-tabs [aria-selected="true"]').textContent, 'Journey');
    assert.equal(app.find('.cx-journey-spine').children.length, 6);
    assert.match(app.find('.cx-journey-summary').textContent, /Furthest recorded stageActivation/);
    assert.match(app.find('.cx-journey-summary').textContent, /Recorded attempts5/);
    assert.deepEqual(Array.from(app.w.document.querySelectorAll('.cx-journey-spine time'), (element: any) => element.dateTime), ['2026-09-28T09:04:13.000Z', '2026-09-28T09:11:24.000Z', '2026-09-28T09:29:51.000Z']);
    assert.equal(app.w.document.querySelectorAll('.cx-journey-spine [data-certainty="unavailable"]').length, 3);

    const journeyTab = app.find('.cx-journey-tabs [role="tab"]', 'Journey');
    const eventsTab = app.find('.cx-journey-tabs [role="tab"]', 'Events');
    journeyTab.focus();
    await app.key(journeyTab, 'ArrowRight');
    assert.equal(eventsTab.getAttribute('aria-selected'), 'true');
    assert.equal(eventsTab.tabIndex, 0);
    assert.equal(journeyTab.tabIndex, -1);
    assert.equal(app.w.document.activeElement, eventsTab);
    const eventsPanel = app.w.document.getElementById(eventsTab.getAttribute('aria-controls'));
    const journeyPanel = app.w.document.getElementById(journeyTab.getAttribute('aria-controls'));
    assert.equal(eventsPanel.hidden, false);
    assert.equal(journeyPanel.hidden, true);
    assert.equal(eventsPanel.querySelectorAll('.cx-journey-date').length, 1);
    assert.deepEqual(Array.from(eventsPanel.querySelectorAll('.cx-journey-date .cx-journey-event strong'), (element: any) => element.textContent), ['Captured', 'Delivered', 'First dial']);
    assert.match(eventsPanel.querySelector('.cx-journey-undated').textContent, /no known chronological order/);
    await app.key(eventsTab, 'Home');
    assert.equal(journeyTab.getAttribute('aria-selected'), 'true');
    await app.key(journeyTab, 'End');
    assert.equal(eventsTab.getAttribute('aria-selected'), 'true');
    await app.key(eventsTab, 'ArrowLeft');
    assert.equal(journeyTab.getAttribute('aria-selected'), 'true');

    await app.click('.cx-journey-calls summary');
    assert.equal(app.find('.cx-journey-calls').open, true);
    assert.match(app.find('.cx-journey-calls').textContent, /5 recorded attempts/);
    assert.match(app.find('.cx-journey-calls').textContent, /Individual timestamps unavailable/);
    assert.match(app.find('.cx-journey-calls').textContent, /RPC attempt number unavailable/);
    assert.equal(app.find('.cx-journey-calls').querySelectorAll('time').length, 0);

    await app.click('.cx-journey-spine button', 'Sale');
    await app.wait(() => app.w.document.activeElement === app.find('.cx-journey-evidence'));
    assert.match(app.find('.cx-journey-evidence').textContent, /Timestamp unavailable · Not verified/);
    assert.equal(app.find('.cx-journey-evidence dt').textContent, 'sale');
    assert.equal(app.find('.cx-journey-evidence dd').textContent, 'true');
    await app.click('.cx-journey-evidence button', 'Copy evidence');
    await app.wait(() => app.copied.length === 1 && app.find('.cx-audit-copy [role="status"]').textContent === 'Copied');
    assert.match(app.copied[0], /^Lead ID: SYN-COMPLETE\nSale\nTimestamp unavailable\nValidation: Not verified/);
    assert.match(app.copied[0], /Layer: Normalised operational evidence/);
    assert.match(app.copied[0], /sale: true/);
    assert.equal(app.copied[0].includes('Synthetic vendor'), false, 'A representative vendor is not copied as sale ownership');
    assert.deepEqual(app.requests(), before, 'Selecting, changing tabs, expanding calls and copying evidence all use already-loaded data');
    assert.equal(app.requests().filter(request => request.includes('lead-timeline')).length, 1, 'Canonical dossier reuses the existing scoped selected-lead request');
    await app.click('button', 'Close lead dossier');
    assert.equal(app.w.document.activeElement, trigger);
    assert.equal(app.find('.cx-ledger-journey'), undefined);
  } finally { app.close(); }
});

test('source handoff preserves scope, sends one exact existing source search and focuses original fields', async () => {
  const filters = { vendor: { operator: 'in', values: ['Synthetic vendor'] }, grade: { operator: 'not_equals', value: 'D' } };
  const app = await mount(scope + '&workspace=alpha&workspace=beta&filters=' + encodeURIComponent(JSON.stringify(filters)) + '&drill=awaiting-first-dial&drillValue=obsolete');
  try {
    await openOperational(app);
    await selectLead(app, 'SYN-COMPLETE');
    await app.click('.cx-journey-spine button', 'Delivered');
    assert.deepEqual(Array.from(app.find('.cx-journey-evidence').querySelectorAll('dt'), (element: any) => element.textContent), ['delivered_time']);
    const before = app.requests().length;
    await app.click('.cx-journey-evidence button', 'View source fields');
    await app.wait(() => app.find('.cx-lead-dossier [data-source-highlight="true"]'));
    assert.equal(app.requests().slice(before).filter(request => request.startsWith(replicaPath + '?')).length, 1, 'Population Source tab loads one exact selected-lead query');
    const beforeMode = app.requests().length;
    await app.click('button', 'Open in Source Evidence');
    await app.wait(() => app.find('#ledger-search')?.value === 'SYN-COMPLETE' && app.find('.cx-lead-dossier [data-source-highlight="true"]'));
    const current = new URL(app.w.__fixture.location, 'https://synthetic.invalid');
    assert.equal(current.pathname, '/lead-explorer');
    assert.equal(current.searchParams.get('view'), 'source');
    assert.equal(current.searchParams.get('clientId'), 'synthetic-a');
    assert.equal(current.searchParams.get('startDate'), '2026-09-15');
    assert.equal(current.searchParams.get('endDate'), '2026-09-30');
    assert.deepEqual(current.searchParams.getAll('workspace'), ['alpha', 'beta']);
    assert.deepEqual(JSON.parse(current.searchParams.get('filters')!), filters);
    assert.equal(current.searchParams.has('search'), false, 'Selected identity remains session-local');
    assert.equal(current.searchParams.has('sourceSearch'), false);
    assert.equal(current.searchParams.get('drill'), 'awaiting-first-dial');
    assert.equal(current.searchParams.get('drillValue'), 'obsolete');
    const expected = replicaPath + '?' + new URLSearchParams({ clientId: 'synthetic-a', startDate: '2026-09-15', endDate: '2026-09-30', filters: JSON.stringify({ ...filters, lead_id: { operator: 'equals', value: 'SYN-COMPLETE' } }), sourceMode: 'configured', search: 'SYN-COMPLETE', limit: '25', offset: '0' });
    assert.deepEqual(app.requests().slice(beforeMode).filter(request => request.startsWith(replicaPath + '?')), [expected]);
    assert.equal(app.find('.cx-ledger-source-table tbody').children.length, 1);
    assert.equal(app.find('.cx-lead-dossier h2').textContent, 'SYN-COMPLETE');
    const highlights = [...app.w.document.querySelectorAll('.cx-lead-dossier [data-source-highlight="true"]')] as any[];
    assert.deepEqual(highlights.map(element => element.dataset.rawField), ['HLC Delivered']);
    assert.equal(highlights[0].querySelector('dd').textContent, '2026-09-28T09:11:24Z');
    assert.equal(app.find('.cx-lead-dossier .cx-ledger-raw-record').querySelectorAll('[data-raw-field]').length, 63);
    assert.equal(highlights[0].closest('details').open, true);
    await app.wait(() => app.w.document.activeElement === highlights[0]);
    assert.equal(app.requests().filter(request => request.includes('lead-timeline')).length, 1);
  } finally { app.close(); }
});

test('selected Lead Journey audit opens the canonical record trace without requesting records and restores focus', async () => {
  const app = await mount();
  try {
    await openOperational(app);
    await selectLead(app, 'SYN-COMPLETE');
    await app.click('.cx-journey-spine button', 'First dial');
    await app.wait(() => app.find('.cx-journey-evidence').textContent.includes('Audit evidence'));
    const before = app.requests();
    const trigger = await app.click('.cx-journey-evidence button', 'Audit evidence');
    await app.wait(() => app.find('[role="dialog"]'));
    const dialog = app.find('[role="dialog"]');
    assert.equal(dialog.closest('.cx-lead-dossier'), null, 'Canonical audit modal is portalled outside the dossier stacking context');
    assert.match(dialog.textContent, /2026-09-28T09:29:51.000Z/);
    assert.match(dialog.textContent, /HLC First Call Date/);
    assert.match(dialog.textContent, /dialled: Qualified/);
    assert.match(dialog.textContent, /Independent reconciliation/);
    assert.equal(dialog.querySelector('.cx-metric-anatomy'), null, 'Timestamp evidence has no count or ratio anatomy');
    assert.equal(dialog.querySelector('a[href*="lead-explorer"]'), null, 'A selected identity cannot create a population drill');
    assert.deepEqual(app.requests(), before);
    assert.equal(app.requests().filter(request => request.includes('lead-timeline')).length, 1);
    await app.click('button', 'Close inspector');
    await app.wait(() => app.w.document.activeElement === trigger);
  } finally { app.close(); }
});

test('missing, partial, zero and untimed evidence remain distinct in the selected inspector', async () => {
  const app = await mount();
  try {
    await openOperational(app);
    const before = app.requests();
    await selectLead(app, 'SYN-PARTIAL');
    assert.equal(app.find('.cx-journey-spine').children.length, 3);
    const outcomes = () => Array.from(app.find('.cx-journey-outcomes').querySelectorAll('dd'), (element: any) => element.textContent);
    assert.deepEqual(outcomes(), ['Not recorded in returned evidence', 'Evidence unavailable', 'Evidence unavailable']);
    assert.match(app.find('.cx-journey-summary').textContent, /Recorded attempts3/);
    assert.equal(app.find('.cx-journey-spine [data-stage="sale"]'), undefined);

    await selectLead(app, 'SYN-SALE-NO-ACTIVATION');
    assert.equal(app.find('.cx-journey-spine button[data-stage="sale"]').getAttribute('data-certainty'), 'unavailable');
    assert.equal(app.find('.cx-journey-spine button[data-stage="activation"]'), undefined);
    assert.deepEqual(outcomes(), ['Recorded', 'Recorded', 'Evidence unavailable']);

    await selectLead(app, 'SYN-ZERO-CALLS');
    assert.match(app.find('.cx-journey-summary').textContent, /Recorded attempts0/);
    assert.equal(app.find('.cx-journey-spine button[data-stage="call"]'), undefined);
    assert.deepEqual(outcomes(), ['Not recorded in returned evidence', 'Not recorded in returned evidence', 'Not recorded in returned evidence']);

    await selectLead(app, 'SYN-NO-TIMELINE');
    assert.match(app.find('.cx-journey-empty').textContent, /Timeline unavailable/);
    assert.equal(app.find('.cx-journey-spine'), undefined);
    assert.equal(app.find('.cx-journey-date'), undefined);
    assert.match(app.find('.cx-journey-summary').textContent, /Recorded attemptsUnavailable/);
    assert.deepEqual(outcomes(), ['Evidence unavailable', 'Evidence unavailable', 'Evidence unavailable']);

    await selectLead(app, 'SYN-UNTIMED');
    assert.match(app.find('.cx-journey-empty').textContent, /Timeline unavailable/);
    assert.equal(app.find('.cx-journey-spine'), undefined);
    const journeyPanel = app.w.document.getElementById(app.find('.cx-journey-tabs [role="tab"]', 'Journey').getAttribute('aria-controls'));
    assert.equal(journeyPanel.querySelectorAll('.cx-journey-undated button').length, 4);
    assert.equal(app.find('.cx-ledger-journey').querySelectorAll('time').length, 0, 'No generated time or source cutoff is substituted');
    assert.equal(app.find('.cx-journey-summary').textContent.includes('Observed time span'), false);
    assert.equal(app.find('.cx-ledger-journey').textContent.toLowerCase().includes('failed'), false);
    assert.deepEqual(app.requests().filter(request => !request.includes('lead-timeline')), before.filter(request => !request.includes('lead-timeline')));
  } finally { app.close(); }
});

test('anomalous timestamps are called out, valid Events sort chronologically and long spans stay descriptive', async () => {
  const app = await mount();
  try {
    await openOperational(app);
    const before = app.requests();
    await selectLead(app, 'SYN-FUTURE');
    assert.match(app.find('.cx-journey-anomalies').textContent, /future timestamp excluded from chronology/);
    assert.equal(app.find('.cx-journey-spine button[data-stage="delivery"]'), undefined);
    assert.ok(Array.from(app.find('.cx-ledger-journey').querySelectorAll('time'), (element: any) => element.dateTime).every((timestamp: any) => !timestamp.startsWith('2999')));
    assert.equal(app.find('.cx-journey-summary').textContent.includes('Observed time span'), false);

    await selectLead(app, 'SYN-REVERSED-TIME');
    assert.match(app.find('.cx-journey-anomalies').textContent, /First dial precedes delivered/);
    assert.equal(app.find('.cx-journey-spine [data-connector="anomaly"] .cx-journey-elapsed').textContent, 'Timing anomaly');
    await app.click('.cx-journey-tabs [role="tab"]', 'Events');
    const eventsPanel = app.w.document.getElementById(app.find('.cx-journey-tabs [role="tab"]', 'Events').getAttribute('aria-controls'));
    assert.deepEqual(Array.from(eventsPanel.querySelectorAll('.cx-journey-date .cx-journey-event strong'), (element: any) => element.textContent), ['Captured', 'First dial', 'Delivered']);

    await selectLead(app, 'SYN-INVALID-TIME');
    assert.match(app.find('.cx-journey-empty').textContent, /Timeline unavailable/);
    assert.equal(app.find('.cx-ledger-journey').querySelectorAll('time').length, 0);
    assert.match(app.find('.cx-journey-anomalies').textContent, /invalid timestamp excluded from chronology/);

    await selectLead(app, 'SYN-LONG-JOURNEY');
    assert.match(app.find('.cx-journey-summary').textContent, /Observed time span14d 1h/);
    await app.click('.cx-journey-tabs [role="tab"]', 'Events');
    const dates = app.w.document.querySelectorAll('.cx-journey-date');
    assert.equal(dates.length, 3);
    assert.match(dates[0].textContent, /15 Sept 2026/);
    assert.match(dates[2].textContent, /29 Sept 2026/);
    assert.equal(app.find('.cx-ledger-journey').textContent.includes('SLA exceeded'), false);
    assert.deepEqual(app.requests().filter(request => !request.includes('lead-timeline')), before.filter(request => !request.includes('lead-timeline')));
  } finally { app.close(); }
});
