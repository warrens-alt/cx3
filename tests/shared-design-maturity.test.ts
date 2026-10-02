import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM, VirtualConsole } from 'jsdom';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildAcceptanceFixture } from '../scripts/build-frontend-acceptance-fixture.mjs';
import PercentileRail from '../src/shared/visuals/PercentileRail';

test('colliding percentile markers keep returned zeros, separate lanes, and input order without estimating missing points', () => {
  const points = Object.freeze([
    Object.freeze({ key: 'p90', label: 'P90', value: 100, displayValue: '1m 40s' }),
    Object.freeze({ key: 'p75', label: 'P75', value: 0, displayValue: '0s' }),
    Object.freeze({ key: 'p50', label: 'Median', value: 0, displayValue: '0s' }),
    Object.freeze({ key: 'p99', label: 'P99', value: null, displayValue: 'Unavailable' }),
  ]);
  const before = JSON.stringify(points);
  const doc = new JSDOM(renderToStaticMarkup(React.createElement(PercentileRail, { title: 'Timing', unitLabel: 's', points: points as any }))).window.document;
  const markers = [...doc.querySelectorAll<HTMLElement>('.cx-percentile-mark')];
  assert.equal(markers.length, 3);
  assert.deepEqual(markers.map(marker => marker.style.left), ['0%', '0%', '100%']);
  assert.notEqual(markers[0].style.getPropertyValue('--cx-marker-lane'), markers[1].style.getPropertyValue('--cx-marker-lane'));
  assert.deepEqual([...doc.querySelectorAll('.cx-percentile-values dd')].map(node => node.textContent), ['1m 40s', '0s', '0s', 'Unavailable']);
  assert.equal(doc.querySelector('.cx-percentile-values>div:last-child')?.getAttribute('data-state'), 'unavailable');
  assert.equal(JSON.stringify(points), before);
  assert.doesNotMatch(doc.body.textContent!, /NaN|Infinity/);
});

const bundle = await build({
  stdin: { contents: `import React,{useEffect,useState} from 'react';import{createRoot}from'react-dom/client';import ChartFrame from './src/shared/visuals/ChartFrame';import LifecyclePath from './src/shared/visuals/LifecyclePath';import{AuditMetadata,AuditModeControl}from'./src/shared/evidence/AuditMode';
    const stages=Object.freeze([Object.freeze({key:'rpc',volume:10}),Object.freeze({key:'sales',volume:40}),Object.freeze({key:'activated',volume:0})]);
    const transition=Object.freeze({from:'RPC',to:'Sale',population:10,converted:3,lost:7,conversionRate:30,lossRate:70,deteriorationPp:null,status:'NON_NESTED'});
    function StatefulEvidence(){const[note,setNote]=useState('Evidence note');useEffect(()=>{window.__shared.mounts++;return()=>window.__shared.unmounts++},[]);return <><label>Local evidence note<input value={note} onChange={e=>setNote(e.target.value)}/></label><button type='button'>Last evidence action</button></>}
    function App(){return <main className='cx-main'><button type='button' id='outside'>Outside action</button><ChartFrame title='Evidence focus' scope={<span>Applied scope</span>}><StatefulEvidence/></ChartFrame><LifecyclePath stages={stages} transitions={[transition]} onSelectStage={key=>window.__shared.stage=key} onSelectTransition={(value,key)=>{window.__shared.transition=value;window.__shared.lossKey=key;window.__shared.exactTransition=value===transition}}/><AuditModeControl/><AuditMetadata metricId='synthetic.metric' grain='Distinct lead' dateBasis='Capture cohort' validationStatus='NOT_VERIFIED' definitionVersion='v-test' generatedAt='2026-09-28T10:00:00Z' source='synthetic source'/></main>}
    const root=createRoot(document.getElementById('root'));window.__shared.unmount=()=>root.unmount();root.render(<App/>);`, resolveDir: process.cwd(), sourcefile: 'shared-design-maturity-harness.tsx', loader: 'tsx' },
  bundle: true, write: false, format: 'iife', platform: 'browser', loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"test"' },
  plugins: [{ name: 'shared-scope-fixture', setup(b) {
    b.onResolve({ filter: /\/ReportingScopeSummary$/ }, () => ({ path: 'scope', namespace: 'shared-scope' }));
    b.onLoad({ filter: /.*/, namespace: 'shared-scope' }, () => ({ contents: "import React from 'react';export default function Scope(){return <span>Applied lifecycle scope</span>}", loader: 'tsx', resolveDir: process.cwd() }));
  } }],
});

async function mount() {
  const errors: string[] = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message)); console.on('error', (...args) => errors.push(args.join(' ')));
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://synthetic.invalid', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console });
  const w = dom.window as any;
  w.__shared = { mounts: 0, unmounts: 0, requests: 0 };
  w.fetch = () => { w.__shared.requests++; throw new Error('Presentation must not fetch'); };
  w.HTMLElement.prototype.getClientRects = function () { return this.isConnected && !this.closest('[hidden]') ? [new w.DOMRect(0, 0, 100, 30)] : []; };
  const wait = async (check: () => unknown) => { for (let i = 0; i < 100; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('Shared UI did not settle: ' + errors.join('; ')); };
  w.eval(bundle.outputFiles[0].text); await wait(() => w.__shared.mounts === 1);
  return { w, doc: w.document, wait, close() { w.__shared.unmount(); dom.window.close(); assert.deepEqual(errors, []); } };
}

test('ChartFrame focus preserves mounted input state, traps keyboard focus, restores trigger, and never requests data', async () => {
  const app = await mount();
  try {
    const { doc, w, wait } = app;
    const input = doc.querySelector('input');
    Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value')!.set!.call(input, 'Retained analyst note');
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
    const trigger = doc.querySelector('button[aria-label="Focus: Evidence focus"]');
    trigger.focus(); trigger.click(); await wait(() => doc.querySelector('[role=dialog][aria-label="Evidence focus"]'));
    assert.equal(doc.querySelector('input'), input); assert.equal(input.value, 'Retained analyst note');
    assert.equal(w.__shared.mounts, 1); assert.equal(w.__shared.unmounts, 0);
    assert.equal(doc.querySelector('#outside').inert, true);
    const dialog = doc.querySelector('[role=dialog][aria-label="Evidence focus"]');
    const last = [...dialog.querySelectorAll('button')].at(-1) as any;
    last.focus(); doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    assert.equal(doc.activeElement, trigger);
    trigger.focus(); doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    assert.equal(doc.activeElement, last);
    doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(() => !doc.querySelector('[role=dialog]'));
    assert.equal(doc.activeElement, trigger); assert.equal(doc.querySelector('input'), input);
    assert.equal(input.value, 'Retained analyst note'); assert.equal(w.__shared.requests, 0);
    assert.equal(doc.querySelector('.cx-main').style.overflow, '');
  } finally { app.close(); }
});

test('lifecycle selection keeps independent values and returns the exact qualified transition object', async () => {
  const app = await mount();
  try {
    const { doc, w, wait } = app;
    const values = () => [...doc.querySelectorAll('.cx-lifecycle-node strong')].map((node: any) => node.textContent);
    assert.deepEqual(values(), ['10', '40', '0']);
    const sales = doc.querySelector('li[data-stage=sales] .cx-lifecycle-node'); sales.click();
    await wait(() => sales.getAttribute('aria-pressed') === 'true');
    assert.equal(w.__shared.stage, 'sales'); assert.deepEqual(values(), ['10', '40', '0']);
    const loss = doc.querySelector('li[data-stage=rpc] .cx-lifecycle-loss'); loss.click();
    await wait(() => loss.getAttribute('aria-pressed') === 'true');
    assert.equal(w.__shared.lossKey, 'rpc-to-sales'); assert.equal(w.__shared.exactTransition, true);
    assert.equal(sales.getAttribute('aria-pressed'), 'false'); assert.deepEqual(values(), ['10', '40', '0']);
    assert.match(doc.querySelector('li[data-stage=rpc]').textContent, /3 of 10 with both events.*7 no recorded progression.*Non-nested/);
    assert.equal(doc.querySelector('li[data-stage=sales]').getAttribute('data-transition'), 'unavailable');
    assert.equal(w.__shared.requests, 0);
  } finally { app.close(); }
});

test('audit metadata labels response generation truthfully, preserves unknown validation, and remains local', async () => {
  const app = await mount();
  try {
    const { doc, w, wait } = app;
    assert.equal(doc.querySelector('[aria-label="Audit metadata"]'), null);
    const buttons = doc.querySelectorAll('[aria-label="Audit mode"] button'); buttons[1].click();
    await wait(() => doc.querySelector('[aria-label="Audit metadata"]'));
    const metadata = doc.querySelector('[aria-label="Audit metadata"]');
    assert.match(metadata.textContent, /Response generated2026-09-28T10:00:00Z/);
    assert.match(metadata.textContent, /Response timing does not establish source freshness/);
    assert.match(metadata.textContent, /ValidationNOT_VERIFIED/);
    assert.equal(w.localStorage.getItem('cx.presentation.audit-mode.v1'), 'on');
    assert.equal(w.__shared.requests, 0);
    buttons[0].click(); await wait(() => !doc.querySelector('[aria-label="Audit metadata"]'));
  } finally { app.close(); }
});

test('light and dark themes provide the same lifecycle and categorical identities without changing the canonical six stage tokens', async () => {
  const css = await readFile('src/styles/tokens.css', 'utf8');
  const split = css.indexOf('[data-theme="dark"]');
  const tokens = (part: string) => new Map([...part.matchAll(/(--cx-(?:data|chart-category)-[\w-]+)\s*:\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]));
  const light = tokens(css.slice(0, split)), dark = tokens(css.slice(split));
  assert.deepEqual([...light.keys()].sort(), [...dark.keys()].sort());
  for (const stage of ['fetched', 'delivered', 'dialled', 'rpc', 'sales', 'activation']) {
    assert.match(light.get(`--cx-data-${stage}`)!, /^#[0-9a-f]{6}$/i);
    assert.match(dark.get(`--cx-data-${stage}`)!, /^#[0-9a-f]{6}$/i);
  }
  assert.equal([...light.keys()].filter(key => key.startsWith('--cx-chart-category-')).length, 8);
});

const routedOutput = await mkdtemp(path.join(tmpdir(), 'cx3-shared-maturity-'));
await buildAcceptanceFixture(routedOutput);
const routedScript = await readFile(path.join(routedOutput, 'fixture.js'), 'utf8');
test.after(() => rm(routedOutput, { recursive: true, force: true }));

test('Journey has one six-stage visualization with disclosed exact metrics, while sticky scope retains the same controls and exact exclusions', async () => {
  const errors: string[] = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message)); console.on('error', (...args) => errors.push(args.join(' ')));
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://synthetic.invalid', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console });
  const w = dom.window as any;
  const filters = { vendor: { operator: 'not_equals', value: 'Blocked A' }, source: { operator: 'equals', value: 'Returned source' } };
  const route = '/funnel?clientId=synthetic-a&startDate=2026-09-28&endDate=2026-09-30&filters=' + encodeURIComponent(JSON.stringify(filters));
  const lifecycle = { comparisons: Object.fromEntries(['fetched', 'delivered', 'dialled', 'rpc', 'sales', 'activations'].map((key, index) => [key, { current: [120, 100, 80, 12, 30, 0][index] }])), transitions: [], segments: {}, validationStatus: 'NOT_VERIFIED' };
  Object.assign(w, { Response, Request, Headers, AbortController, TextEncoder, TextDecoder, ReadableStream, structuredClone,
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    __observers: [], __fixture: { initialRoute: route, payloads: { '/api/analytics/offernet/funnel': { lifecycle, byVendor: [], bySource: [], byGrade: [] } } } });
  w.IntersectionObserver = class { callback: any; target: any; constructor(callback: any) { this.callback = callback; w.__observers.push(this); } observe(target: any) { this.target = target; } disconnect() {} unobserve() {} };
  w.matchMedia = (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {}; w.HTMLElement.prototype.scrollTo = () => {}; w.scrollTo = () => {};
  const wait = async (check: () => unknown) => { for (let i = 0; i < 150; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); } throw new Error('Journey UI did not settle: ' + errors.join('; ') + '\n' + w.document.body.textContent + '\n' + JSON.stringify(w.__fixture.requests)); };
  const doc = w.document;
  try {
    w.eval(routedScript); await wait(() => doc.querySelectorAll('#journey-progression .cx-lifecycle-node').length === 6);
    assert.deepEqual([...doc.querySelectorAll('#journey-progression .cx-lifecycle-node strong')].map((node: any) => node.textContent), ['120', '100', '80', '12', '30', '0']);
    assert.equal(doc.querySelectorAll('.cx-journey-visual-workspace .cx-unified-metric').length, 0);
    const rates = doc.querySelector('[aria-label="Stage metric evidence"]');
    assert.ok(rates.closest('details')); assert.equal(rates.closest('details').open, false);
    assert.equal(rates.querySelectorAll('tbody tr').length, 6);
    assert.match(rates.querySelectorAll('tbody tr')[3].textContent, /Contact rate \(RPC\).*12.*80.*RPC \/ dialled/);
    const scope = doc.querySelector('.cx-scope-controls');
    const vendor = scope.querySelector('select[aria-label="Vendor"]');
    const before = JSON.stringify(w.__fixture.requests), beforeUrl = w.__fixture.location;
    const observer = w.__observers.find((item: any) => item.target?.classList.contains('cx-scope-sentinel'));
    assert.ok(observer);
    observer.callback([{ isIntersecting: false, boundingClientRect: { top: -10 }, rootBounds: { top: 0 } }]);
    await wait(() => scope.getAttribute('data-stuck') === 'true');
    assert.equal(doc.querySelectorAll('.cx-scope-controls').length, 1);
    assert.equal(doc.querySelector('select[aria-label="Vendor"]'), vendor);
    assert.match(scope.querySelector('.cx-scope-summary').textContent, /Synthetic workspace A.*28 Sept.*30 Sept.*Not Blocked A.*Returned source/);
    assert.equal(JSON.stringify(w.__fixture.requests), before); assert.equal(w.__fixture.location, beforeUrl);
    observer.callback([{ isIntersecting: true, boundingClientRect: { top: 10 }, rootBounds: { top: 0 } }]);
    await wait(() => !scope.hasAttribute('data-stuck'));
    assert.equal(doc.querySelector('select[aria-label="Vendor"]'), vendor);
  } finally { w.__fixture.unmount?.(); dom.window.close(); }
  assert.deepEqual(errors, []);
});
