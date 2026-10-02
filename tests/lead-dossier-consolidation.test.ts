import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';
import { analyseLedgerLead, LEDGER_HEADERS, type LedgerReplicaReport } from '../contracts/leadLedgerReplica';
import { buildDossierAuditEvidence } from '../src/features/investigation/dossierAuditEvidence';
import type { RawLeadsData } from '../src/lib/offernetClient';

const leadId = 'PRIVATE-DOSSIER-IDENTITY';
const row = { lead_id: leadId, vendor: 'Representative vendor', source: 'Normalized source', fetched: '2026-09-28T00:00:00Z', delivered_time: '2026-09-28T00:10:00Z', first_call_time: '2026-09-28T00:05:00Z', qualified_delivery: true, dialled: false, qualified_activation: null, total_calls: 0, contacted: false, sale: null, activated: false, revenue: null };
const result = { clientId: 'synthetic-a', rows: [row], validationStatus: 'NOT_VERIFIED', generatedAt: '2026-09-30T06:00:00Z', countingGrain: 'lead', totalCount: 1 } as RawLeadsData;
const raw = Object.fromEntries(LEDGER_HEADERS.map(field => [field, field === 'Lead ID' ? leadId : field === 'HLC Revenue Generated' ? '1234567890.123456789' : field === 'HLC Total Calls' ? 0 : null]));
const lead = analyseLedgerLead('selected-source-key', [{ ...raw, 'HLC Vendor': 'First vendor', 'HLC Transaction ID': 'first' }, { ...raw, 'HLC Vendor': 'Second vendor', 'HLC Transaction ID': 'second' }], Date.parse('2026-09-30T06:00:00Z'));
const report = { leads: [lead], summary: { leads: 1, rows: 2, leadOnlyRows: 0, duplicateKeyRows: 0, revenue: [] }, vendors: [], metadata: { version: 'synthetic', coverage: { source: 'Original synthetic source', available: LEDGER_HEADERS, missing: [], compatible: true, richViewEnabled: false }, clientId: 'synthetic-a', startDate: '2026-09-28', endDate: '2026-09-28', filters: {}, search: '', generatedAt: '2026-09-30T06:00:00Z', queryJobId: null, offset: 0, pageSize: 25, hasMore: false, validationStatus: 'NOT_VERIFIED', dateBasis: 'fetched_cohort', timestampInterpretation: 'Naive timestamps are UTC', pagination: 'Distinct lead pagination' } } as LedgerReplicaReport;

test('dossier audit preserves supplied false, missing qualifications, anomalies and independent grain states', () => {
  const evidence = buildDossierAuditEvidence(row, result, lead, report);
  assert.equal(evidence.qualifications.find(item => item.field === 'dialled')?.value, 'Excluded from qualified progression');
  assert.equal(evidence.qualifications.find(item => item.field === 'qualified_activation')?.value, 'Qualification not supplied');
  assert.equal(evidence.dimensions.find(item => item.key === 'qualification')?.state, 'partial');
  assert.ok(evidence.chronology.some(item => item.includes('precedes')));
  assert.equal(evidence.dimensions.find(item => item.key === 'reconciliation')?.state, 'not_verified');
  assert.equal(evidence.dimensions.find(item => item.key === 'business')?.state, 'not_verified');
  assert.equal(evidence.trace.find(item => item.key === 'display')?.value, '1 normalized lead row');
  assert.match(evidence.dimensions.find(item => item.key === 'source')!.detail!, /2 original source records/);
});

test('source-only audit cannot derive normalized qualifications or reconciliation from original values', () => {
  const evidence = buildDossierAuditEvidence(undefined, undefined, lead, report);
  assert.equal(evidence.dimensions.find(item => item.key === 'source')?.state, 'observed');
  assert.equal(evidence.dimensions.find(item => item.key === 'analytical')?.state, 'unavailable');
  assert.equal(evidence.dimensions.find(item => item.key === 'qualification')?.state, 'unavailable');
  assert.ok(evidence.qualifications.every(item => item.value === 'Qualification not supplied'));
  assert.equal(evidence.trace.find(item => item.key === 'normalized')?.value, null);
  assert.equal(evidence.trace.find(item => item.key === 'reconciliation')?.state, 'not_verified');
});

const bundle = await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import LeadDossier from './src/features/investigation/LeadDossier';const root=createRoot(document.getElementById('root'));window.__dossier.render=(props)=>root.render(<MemoryRouter initialEntries={['/lead-explorer?drill=awaiting-first-dial']}><LeadDossier id="selected-dossier" scopeKey="fixed-scope" onClose={()=>{}} {...props}/></MemoryRouter>);window.__dossier.unmount=()=>root.unmount();window.__dossier.render(window.__dossier.props);`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, format: 'iife', platform: 'browser', loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': '{}' },
  plugins: [{ name: 'isolated-dossier-contexts', setup(b) {
    b.onResolve({ filter: /\/(AuthContext|ClientContext|FilterContext|useOperationalData)$/ }, args => ({ path: args.path.split('/').at(-1)!, namespace: 'dossier-test' }));
    b.onLoad({ filter: /.*/, namespace: 'dossier-test' }, args => ({ loader: 'tsx', contents: {
      AuthContext: `export const useAuth=()=>({isAdmin:!window.__dossier.nonAdmin});`,
      ClientContext: `export const useClient=()=>({selectedClient:'synthetic-a',clientConfig:{name:'Synthetic workspace'}});`,
      FilterContext: `export const useFilters=()=>({startDate:'2026-09-28',endDate:'2026-09-28',filters:window.__dossier.filters||{}});`,
      useOperationalData: `import {useEffect} from 'react';export function useOperationalData(name,params,fetcher,enabled){useEffect(()=>{if(enabled)window.__dossier.loads.push({name,params});},[name,JSON.stringify(params),enabled]);return {data:window.__dossier.sourceData,loading:false,error:null};}`,
    }[args.path]!, resolveDir: process.cwd() }));
  } }],
});
const script = bundle.outputFiles[0].text;

async function mount(props: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const errors: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  virtualConsole.on('error', (...items) => errors.push(items.map(String).join(' ')));
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://synthetic.invalid', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const w = dom.window as any;
  Object.assign(w, { structuredClone, __dossier: { props, loads: [], ...extra } });
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.eval(script);
  const wait = async (check: () => unknown) => { for (let index = 0; index < 80; index++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error(`Dossier condition not reached: ${w.document.body.textContent}\n${errors.join('; ')}`); };
  await wait(() => w.document.querySelector('.cx-lead-dossier'));
  const click = async (label: string) => { const button = [...w.document.querySelectorAll('button')].find((item: any) => item.textContent === label) as any; assert.ok(button, `Missing button ${label}`); button.click(); await new Promise(resolve => setTimeout(resolve, 20)); };
  return { w, wait, click, text: () => w.document.body.textContent || '', close() { w.__dossier.unmount(); dom.window.close(); assert.deepEqual(errors, []); } };
}

test('source mode supplies one canonical dossier and reuses all original records without a source load', async () => {
  const app = await mount({ sourceLead: lead, sourceReport: report, sourceResolved: true, initialTab: 'Source', sourceFocusFields: ['HLC Revenue Generated'] });
  try {
    assert.equal(app.w.document.querySelectorAll('.cx-lead-dossier').length, 1);
    assert.equal(app.w.document.querySelectorAll('.cx-ledger-raw-record').length, 2);
    assert.equal(app.w.document.querySelector('[data-raw-field="HLC Revenue Generated"] dd').textContent, '1234567890.123456789');
    assert.equal(app.w.document.querySelectorAll('[data-source-highlight="true"]').length, 2);
    assert.equal(app.w.__dossier.loads.length, 0);
    assert.equal(app.w.document.querySelector('.cx-dossier-tabs').textContent, 'SummaryJourneyCallsOutcomesAuditSource');
    await app.click('Journey');
    assert.match(app.text(), /Normalized analytical evidence is unavailable/);
    assert.equal(app.w.document.querySelector('.cx-lead-journey'), null);
    await app.click('Audit');
    assert.ok(app.w.document.querySelector('[aria-label="Selected evidence lineage"]'));
    assert.match(app.text(), /Independent reconciliation.*Not verified/);
    assert.equal(app.w.__dossier.loads.length, 0);
  } finally { app.close(); }
});

test('source resolution with no exact match never mounts a fallback query or substitutes another identity', async () => {
  const other = { ...lead, leadId: 'OTHER-IDENTITY' };
  const app = await mount({ row, result, sourceLead: other, sourceReport: report, sourceResolved: true, initialTab: 'Source' });
  try {
    assert.match(app.text(), /No exact source lead match/);
    assert.equal(app.text().includes('OTHER-IDENTITY'), false);
    assert.equal(app.w.__dossier.loads.length, 0);
    assert.equal(app.w.document.querySelector('.cx-ledger-raw-record'), null);
  } finally { app.close(); }
});

test('an unresolved source lead keeps its raw records without creating an analytical identity', async () => {
  const unresolved = { ...lead, leadId: null } as unknown as typeof lead;
  const app = await mount({ sourceLead: unresolved, sourceReport: { ...report, leads: [unresolved] }, sourceResolved: true, initialTab: 'Source', onOpenSource: () => {} });
  try {
    assert.equal(app.w.document.querySelector('.cx-lead-dossier h2').textContent, 'Unresolved source lead');
    assert.equal(app.w.document.querySelectorAll('.cx-ledger-raw-record').length, 2);
    assert.equal([...app.w.document.querySelectorAll('button')].some((button: any) => button.textContent === 'Open in Source Evidence'), false);
    assert.equal(app.w.__dossier.loads.length, 0);
  } finally { app.close(); }
});

test('Population source loading stays lazy and exact while Audit and analytical tabs add no loads', async () => {
  const filters = { vendor: { operator: 'equals', value: 'First vendor' } };
  const app = await mount({ row, result }, { filters, sourceData: report });
  try {
    await app.click('Audit');
    await app.click('Calls');
    await app.click('Outcomes');
    assert.equal(app.w.__dossier.loads.length, 0);
    await app.click('Source');
    await app.wait(() => app.w.__dossier.loads.length === 1);
    const request = app.w.__dossier.loads[0];
    assert.equal(request.name, 'dossier-source');
    assert.deepEqual(JSON.parse(request.params.filters), { ...filters, lead_id: { operator: 'equals', value: leadId } });
    assert.equal(request.params.search, leadId);
    assert.equal(request.params.investigationScope, 'fixed-scope');
    assert.equal(app.w.location.search, '', 'The private selected lead never becomes URL state');
  } finally { app.close(); }
});

test('source-only analytical loading is explicit and Open analytical lead requires an exact loaded pair', async () => {
  const app = await mount({ sourceLead: lead, sourceReport: report, sourceResolved: true, onRequestAnalytical: () => {}, onOpenAnalytical: () => {} });
  try {
    assert.equal([...app.w.document.querySelectorAll('button')].some((button: any) => button.textContent === 'Open analytical lead'), false);
    assert.ok([...app.w.document.querySelectorAll('button')].some((button: any) => button.textContent === 'Load analytical evidence'));
    assert.equal(app.w.__dossier.loads.length, 0);
  } finally { app.close(); }
});

test('a row outside the returned analytical result cannot enable an analytical handoff', async () => {
  const app = await mount({ row, result: { ...result, rows: [] }, sourceLead: lead, sourceReport: report, sourceResolved: true, onOpenAnalytical: () => {} });
  try {
    assert.match(app.text(), /Analytical inclusion has not been established/);
    assert.equal([...app.w.document.querySelectorAll('button')].some((button: any) => button.textContent === 'Open analytical lead'), false);
  } finally { app.close(); }
});

test('source workspace handoff preserves the selected identity and original field focus only in callbacks', async () => {
  const calls: unknown[][] = [];
  const app = await mount({ row, result, onOpenSource: (...args: unknown[]) => calls.push(args) });
  try {
    await app.click('Calls');
    await app.click('View call source fields');
    await app.click('Open in Source Evidence');
    assert.deepEqual(JSON.parse(JSON.stringify(calls)), [[leadId, ['HLC Total Calls', 'HLC First Call Date', 'HLC Last Dialer Status', 'HLC RPC']]]);
    assert.equal(app.w.location.search, '');
  } finally { app.close(); }
});

test('removed record permission hides both evidence grains and prevents source loading', async () => {
  const app = await mount({ row, result, sourceLead: lead, sourceReport: report, initialTab: 'Source' }, { nonAdmin: true });
  try {
    assert.match(app.text(), /restricted to authorised administrators/);
    assert.equal(app.text().includes(leadId), false);
    assert.equal(app.w.document.querySelector('.cx-dossier-body'), null);
    assert.equal(app.w.__dossier.loads.length, 0);
  } finally { app.close(); }
});
