import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';

// Render the real timeline and evidence controls. Only authentication is fixed;
// all presentation interactions must use the supplied row without fetching.
const bundle = await build({
  stdin: {
    contents: `import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {MemoryRouter} from 'react-router-dom';
      import LeadJourney from './src/features/leadLedger/LeadJourney';
      const f=window.__timeline,root=createRoot(document.getElementById('root'));
      f.unmount=()=>root.unmount();
      root.render(<MemoryRouter><LeadJourney row={f.row} validationStatus="NOT_VERIFIED"
        onViewSource={fields=>f.sources.push(fields)} onPinEvent={event=>f.pins.push(event)}/></MemoryRouter>);`,
    resolveDir: process.cwd(), loader: 'tsx',
  },
  bundle: true, write: false, platform: 'browser', format: 'iife',
  define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': '{}' },
  loader: { '.css': 'empty' },
  plugins: [{ name: 'timeline-auth-fixture', setup(builder) {
    builder.onResolve({ filter: /\/AuthContext$/ }, () => ({ path: 'auth', namespace: 'timeline-fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'timeline-fixture' }, () => ({ contents: 'export const useAuth=()=>({isAdmin:true,isActive:true,profile:{role:"admin",status:"active"}});' }));
  } }],
});

const complete = {
  lead_id: 'SYN-TIMELINE-PRESENTATION', fetched: '2026-09-28T09:04:00Z',
  delivered_time: '2026-09-28T09:11:00Z', first_call_time: '2026-09-28T09:29:00Z',
  dialled: true, contacted: true, sale: true, activated: true, total_calls: 5,
};

async function mount(row: Record<string, unknown> = complete) {
  const errors: string[] = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  console.on('error', (...args) => errors.push(args.map(String).join(' ')));
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://synthetic.invalid', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console,
  });
  const w = dom.window as any;
  w.__timeline = { row, sources: [], pins: [], requests: [], copied: [] };
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.fetch = (...args: unknown[]) => { w.__timeline.requests.push(args); throw new Error('Timeline presentation must not fetch'); };
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (value: string) => w.__timeline.copied.push(value) } });
  w.eval(bundle.outputFiles[0].text);
  const find = (selector: string): any => w.document.querySelector(selector);
  const wait = async (condition: () => unknown) => {
    for (let i = 0; i < 100; i++) {
      if (condition()) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error(`Timeline did not settle: ${errors.join('; ')}`);
  };
  const click = async (selector: string) => {
    const element = find(selector); assert.ok(element, `Missing ${selector}`);
    element.click(); await new Promise(resolve => setTimeout(resolve, 30));
    return element;
  };
  await wait(() => find('.cx-ledger-journey'));
  return { w, find, wait, click, close() { w.__timeline.unmount(); dom.window.close(); assert.deepEqual(errors, []); } };
}

test('chronology retains timed order and durations while untimed outcomes have an independent evidence list', async () => {
  const app = await mount();
  try {
    const spine = app.find('.cx-journey-spine');
    assert.equal(spine.getAttribute('aria-label'), 'Observed chronology');
    assert.deepEqual(Array.from(spine.querySelectorAll('time'), (el: any) => el.dateTime), [
      '2026-09-28T09:04:00.000Z', '2026-09-28T09:11:00.000Z', '2026-09-28T09:29:00.000Z',
    ]);
    assert.deepEqual(Array.from(spine.querySelectorAll('.cx-journey-elapsed'), (el: any) => el.textContent), ['7m', '18m']);
    const untimed = app.find('[aria-label="Recorded stages without timestamps"]');
    assert.equal(untimed.querySelector('h3').textContent, 'Recorded stages — time unavailable');
    assert.match(untimed.textContent, /no known chronological order/);
    assert.equal(untimed.querySelectorAll('ol,time,.cx-journey-spine,.cx-journey-elapsed,.cx-journey-time-column').length, 0);
    assert.deepEqual(Array.from(untimed.querySelectorAll('ul > li button'), (el: any) => el.dataset.stage), ['rpc', 'sale', 'activation']);
    assert.ok(Array.from(untimed.querySelectorAll('small'), (el: any) => el.textContent).every(text => text === 'Recorded, timestamp unavailable'));
    await app.click('[role="tab"][id$="-events-tab"]');
    assert.equal(app.find('[id$="-events-panel"]').hidden, false);
    assert.deepEqual(Array.from(app.find('.cx-journey-date').querySelectorAll('strong'), (el: any) => el.textContent), ['Captured', 'Delivered', 'First dial']);
    assert.equal(app.find('[id$="-events-panel"]').querySelectorAll('.cx-journey-elapsed').length, 0);
    assert.deepEqual(app.w.__timeline.requests, []);
  } finally { app.close(); }
});

test('selected event evidence separates timing, validation and source layers and preserves source, pin and copy actions', async () => {
  const app = await mount();
  try {
    await app.click('.cx-journey-spine button[data-stage="call"]');
    const panel = app.find('[aria-label="Selected event evidence"]');
    await app.wait(() => app.w.document.activeElement === panel);
    assert.equal(panel.querySelector('header span').textContent, 'Selected event');
    assert.equal(panel.querySelector('header h3').textContent, 'First dial');
    assert.equal(panel.querySelector('.cx-journey-evidence-status > span').textContent, 'Observed timestamp');
    assert.equal(panel.querySelector('.cx-journey-evidence-state').textContent, 'Validation: Not verified');
    assert.equal(panel.querySelector('time').dateTime, '2026-09-28T09:29:00.000Z');
    assert.equal(panel.querySelector('[aria-label="Normalized event evidence"] dt').textContent, 'first_call_time');
    assert.equal(panel.querySelector('[aria-label="Normalized event evidence"] dd').textContent, complete.first_call_time);
    assert.equal(panel.querySelector('[aria-label="Original event source fields"] li').textContent, 'HLC First Call Date');
    const actions = Array.from(panel.querySelectorAll('.cx-journey-evidence-actions button')) as HTMLButtonElement[];
    assert.deepEqual(actions.map(button => button.textContent), ['Audit evidence', 'View source fields', 'Pin timeline event', 'Copy evidence']);
    actions[1].click(); actions[2].click(); actions[3].click();
    await app.wait(() => app.w.__timeline.copied.length === 1);
    assert.deepEqual(Array.from(app.w.__timeline.sources[0]), ['HLC First Call Date']);
    assert.equal(app.w.__timeline.pins[0].kind, 'call');
    assert.equal(app.w.__timeline.pins[0].timestamp, '2026-09-28T09:29:00.000Z');
    assert.match(app.w.__timeline.copied[0], /First dial\n2026-09-28T09:29:00.000Z\nValidation: Not verified/);
    assert.match(app.w.__timeline.copied[0], /first_call_time: 2026-09-28T09:29:00Z/);
    await app.click('[id$="-journey-panel"] .cx-journey-undated button[data-stage="sale"]');
    assert.equal(panel.querySelector('.cx-journey-evidence-status > span').textContent, 'Recorded · untimed');
    assert.equal(panel.querySelector('.cx-journey-evidence-time').textContent, 'Timestamp unavailable');
    assert.equal(panel.querySelector('time'), null);
    assert.deepEqual(app.w.__timeline.requests, []);
  } finally { app.close(); }
});

test('selected timing anomalies retain warning evidence without replacing chronological order', async () => {
  const app = await mount({ ...complete, first_call_time: '2026-09-28T09:06:00Z' });
  try {
    assert.deepEqual(Array.from(app.find('.cx-journey-spine').querySelectorAll('button'), (el: any) => el.dataset.stage), ['capture', 'call', 'delivery']);
    const call = await app.click('.cx-journey-spine button[data-stage="call"]');
    assert.equal(call.getAttribute('aria-pressed'), 'true');
    assert.equal(call.dataset.anomaly, 'true');
    assert.match(call.querySelector('.cx-journey-inline-anomaly').textContent, /precedes delivered/);
    assert.match(app.find('[aria-label="Timeline anomalies"]').textContent, /First dial precedes delivered/);
    assert.equal(app.find('[aria-label="Selected event evidence"] time').dateTime, '2026-09-28T09:06:00.000Z');
    assert.deepEqual(app.w.__timeline.requests, []);
  } finally { app.close(); }
});

test('event selection reveals its heading below a live wrapped dossier header while retaining evidence focus', async () => {
  const app = await mount();
  try {
    const main = app.w.document.createElement('main'); main.className = 'cx-main';
    const dossier = app.w.document.createElement('aside'); dossier.className = 'cx-lead-dossier';
    const header = app.w.document.createElement('header'); header.className = 'cx-dossier-heading';
    app.w.document.body.append(main); main.append(dossier); dossier.append(header, app.find('#root'));
    Object.defineProperties(dossier, { clientHeight: { value: 600 }, scrollHeight: { value: 2400 } });
    let headerHeight = 140;
    main.getBoundingClientRect = () => new app.w.DOMRect(0, 80, 1440, 820);
    dossier.getBoundingClientRect = () => new app.w.DOMRect(940, 260, 440, 600);
    header.getBoundingClientRect = () => new app.w.DOMRect(940, 260, 440, headerHeight);
    const panel = app.find('.cx-journey-evidence');
    panel.getBoundingClientRect = () => new app.w.DOMRect(956, 1700 - dossier.scrollTop, 408, 520);
    const originalBounds = app.w.HTMLElement.prototype.getBoundingClientRect;
    app.w.HTMLElement.prototype.getBoundingClientRect = function () {
      return this.classList.contains('cx-journey-evidence-heading')
        ? new app.w.DOMRect(972, panel.getBoundingClientRect().top + 16, 376, 50)
        : originalBounds.call(this);
    };
    main.scrollTop = 250;
    for (const stage of ['call', 'sale']) {
      await app.click(`[id$="-journey-panel"] button[data-stage="${stage}"]`);
      await app.wait(() => app.w.document.activeElement === panel);
      const heading = panel.querySelector('.cx-journey-evidence-heading');
      // Allow both animation-frame measurements to complete.
      await new Promise(resolve => setTimeout(resolve, 45));
      assert.equal(panel.getBoundingClientRect().top, header.getBoundingClientRect().bottom + 12);
      assert.ok(heading.getBoundingClientRect().top > header.getBoundingClientRect().bottom);
      assert.equal(main.scrollTop, 250, 'An already visible dossier does not move its population');
      assert.equal(app.w.document.activeElement, panel);
      headerHeight = 220;
    }
    assert.deepEqual(app.w.__timeline.requests, []);
  } finally { app.close(); }
});

test('responsive event selection clears the outer sticky context after its height changes during scroll', async () => {
  const app = await mount();
  try {
    const main = app.w.document.createElement('main'); main.className = 'cx-main';
    const scope = app.w.document.createElement('section'); scope.className = 'cx-scope-controls'; scope.style.cssText = 'position:sticky;top:0';
    const context = app.w.document.createElement('section'); context.className = 'cx-investigation-context'; context.dataset.compact = 'true'; context.style.cssText = 'position:sticky;top:44px';
    const dossier = app.w.document.createElement('aside'); dossier.className = 'cx-lead-dossier';
    app.w.document.body.append(main); main.append(scope, context, dossier); dossier.append(app.find('#root'));
    Object.defineProperties(dossier, { clientHeight: { value: 1800 }, scrollHeight: { value: 1800 } });
    let scrollTop = 0;
    let contextHeight = 136;
    Object.defineProperty(main, 'scrollTop', { get: () => scrollTop, set: (value: number) => { scrollTop = value; contextHeight = 200; } });
    main.getBoundingClientRect = () => new app.w.DOMRect(0, 80, 820, 700);
    scope.getBoundingClientRect = () => new app.w.DOMRect(0, 80, 820, 44);
    context.getBoundingClientRect = () => new app.w.DOMRect(0, 124, 820, contextHeight);
    const panel = app.find('.cx-journey-evidence');
    panel.getBoundingClientRect = () => new app.w.DOMRect(16, 1800 - scrollTop, 788, 520);
    // Give newly rendered headings live geometry before the selection frame runs.
    const originalBounds = app.w.HTMLElement.prototype.getBoundingClientRect;
    app.w.HTMLElement.prototype.getBoundingClientRect = function () {
      return this.classList.contains('cx-journey-evidence-heading')
        ? new app.w.DOMRect(32, 1816 - scrollTop, 756, 50)
        : originalBounds.call(this);
    };
    await app.click('.cx-journey-spine button[data-stage="call"]');
    await app.wait(() => scrollTop === 1480);
    const heading = panel.querySelector('.cx-journey-evidence-heading').getBoundingClientRect();
    assert.equal(heading.top, context.getBoundingClientRect().bottom + 12);
    assert.ok(heading.bottom <= main.getBoundingClientRect().bottom);
    assert.equal(dossier.scrollTop, 0, 'A full-height responsive dossier uses only the outer scrollport');
    assert.equal(app.w.document.activeElement, panel);
    assert.deepEqual(app.w.__timeline.requests, []);
  } finally { app.close(); }
});
