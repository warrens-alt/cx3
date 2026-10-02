import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';
import InvestigationRecordList, { type InvestigationLead, type InvestigationRecordPreset } from '../src/features/investigation/InvestigationRecordList';

const lead: InvestigationLead = {
  lead_id: 'LEAD-private-0001', consumer_id: '9007199254740993', vendor: 'Returned vendor',
  source: 'Returned source', grade: 'A', vetting: null, valid_idno: 2, phone_valid: null,
  fetched: '2026-09-28T07:00:00Z', delivered_time: '2026-09-28T08:00:00Z',
  first_call_time: '2026-09-28T08:10:00Z', dialled: false, contacted: '0',
  sale: null, activated: true, total_calls: '0', last_dialer_status: null,
  revenue: '1234567890.123456789',
  investigationReason: { label: 'Returned inclusion reason', detail: 'The supplied predicate explanation.' },
};
const rows = [lead];
const render = (preset: InvestigationRecordPreset, suppliedRows = rows) => new JSDOM(renderToStaticMarkup(React.createElement(InvestigationRecordList, {
  rows: suppliedRows, preset, selectedLeadId: lead.lead_id, dossierId: 'lead-dossier', investigation: 'awaiting-first-dial', onSelect() {},
}))).window.document;

test('Full analytical preserves the old table field set as 17 columns with one selectable row and exact values', () => {
  const doc = render('full');
  const headers = [...doc.querySelectorAll('thead th')].map(element => element.textContent);
  assert.deepEqual(headers, ['Lead ID', 'Consumer ID', 'Fetched', 'Source', 'Vendor', 'Grade', 'Vetting', 'ID valid', 'Phone valid', 'Dialled', 'RPC', 'Calls', 'Last disposition', 'Sale', 'Activation', 'Source-recorded revenue', 'Action']);
  const cells = [...doc.querySelectorAll('tbody tr>th,tbody tr>td')].map(element => element.textContent);
  assert.deepEqual(cells.slice(1, 16), ['9007199254740993', '2026-09-28T07:00:00Z', 'Returned source', 'Returned vendor', 'A', 'Unavailable', 'Invalid (2)', 'Unavailable', 'Not recorded', 'Not recorded', '0', 'Unavailable', 'Unavailable', 'Recorded', 'R 1234567890.123456789']);
  assert.equal(doc.querySelectorAll('button[aria-label^="Open dossier"]').length, 1, 'Full mode renders one table rather than duplicating 17 fields and actions in mobile cards');
  assert.equal(doc.querySelectorAll('button[aria-label^="Copy lead ID"]').length, 1);
  assert.equal(doc.querySelector('.cx-investigation-record-cards'), null);
  assert.equal(doc.querySelector('[role="region"]')?.getAttribute('tabindex'), '0', 'Keyboard users can focus and scroll the wide analytical table');
  assert.equal(doc.querySelector('tbody th')?.getAttribute('scope'), 'row');
  assert.equal(doc.querySelector('tbody tr')?.getAttribute('data-selected'), 'true');
  assert.equal(doc.querySelector('button[aria-label^="Open dossier"]')?.getAttribute('aria-controls'), 'lead-dossier');
});

test('Journey and Outcomes show independent recorded outcomes without treating missing evidence as negative or zero', () => {
  const journey = render('journey');
  assert.deepEqual([...journey.querySelectorAll('thead th')].map(element => element.textContent), ['Lead / current state', 'Fetched', 'Delivered', 'First dial', 'RPC', 'Sale', 'Activation', 'Evidence']);
  assert.deepEqual([...journey.querySelectorAll('tbody td')].slice(3, 6).map(element => element.textContent), ['Not recorded', 'Unavailable', 'Recorded']);
  const absent = render('outcomes', [{ ...lead, revenue: null, contacted: null, activated: '2' }]);
  assert.deepEqual([...absent.querySelectorAll('tbody td')].slice(0, 4).map(element => element.textContent), ['Unavailable', 'Unavailable', 'Unavailable', 'Unavailable']);
  const zero = render('outcomes', [{ ...lead, revenue: 0, sale: 0, activated: false }]);
  assert.deepEqual([...zero.querySelectorAll('tbody td')].slice(0, 4).map(element => element.textContent), ['Not recorded', 'Not recorded', 'Not recorded', 'R 0']);
});

test('Investigation retains the supplied inclusion reason and removes the metadata-only Source preset', () => {
  const doc = render('investigation');
  assert.equal(doc.querySelector('tbody td span[title]')?.textContent, 'Returned inclusion reason');
  assert.equal(doc.querySelector('tbody td span[title]')?.getAttribute('title'), 'The supplied predicate explanation.');
  assert.deepEqual([...doc.querySelectorAll('select option')].map(element => element.getAttribute('value')), ['investigation', 'journey', 'contact', 'outcomes', 'full']);
  assert.equal([...doc.querySelectorAll('select option')].some(element => element.textContent === 'Source'), false);
  const missing = render('investigation', [{ ...lead, investigationReason: null }]);
  assert.match(missing.querySelector('tbody')!.textContent!, /Inclusion explanation unavailable/);
  assert.equal(doc.querySelectorAll('tbody [data-evidence-stage]').length, 6);
  assert.match(doc.querySelector('tbody [data-evidence-stage="rpc"]')!.getAttribute('aria-label')!, /Not recorded/);
  assert.match(doc.querySelector('tbody [data-evidence-stage="sale"]')!.getAttribute('aria-label')!, /Unavailable/);
  assert.equal(render('full').querySelector('[data-evidence-stage]'), null, 'Full analytical retains its exact original table presentation');
});

const bundle = await build({
  stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import RecordList from ${JSON.stringify(path.resolve('src/features/investigation/InvestigationRecordList.tsx'))};
      function Harness(){
        const fixture=window.__fixture;
        const [rows,setRows]=React.useState(fixture.rows);
        const [preset,setPreset]=React.useState('investigation');
        const [selected,setSelected]=React.useState(null);
        fixture.replaceRows=setRows;
        fixture.changePreset=setPreset;
        return <RecordList rows={rows} preset={preset} onPresetChange={next=>{fixture.presetChanges.push(next);setPreset(next)}} selectedLeadId={selected} dossierId="lead-dossier" onSelect={(row,trigger)=>{fixture.selections.push({row,trigger});setSelected(String(row.lead_id))}}/>;
      }
      const root=createRoot(document.getElementById('root'));window.__fixture.unmount=()=>root.unmount();root.render(<Harness/>);`,
    resolveDir: process.cwd(), loader: 'tsx',
  },
  bundle: true, format: 'iife', platform: 'browser', write: false, define: { 'process.env.NODE_ENV': '"test"' },
});

async function mount() {
  const errors: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  virtualConsole.on('error', (...args) => errors.push(args.join(' ')));
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://test.invalid', virtualConsole });
  const w = dom.window as any;
  const fixture = w.__fixture = { rows, selections: [], presetChanges: [], requests: [], copied: [], clipboardMode: 'success' };
  w.fetch = (...args: unknown[]) => { fixture.requests.push(args); throw new Error('Presets must not fetch evidence'); };
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (value: string) => {
    fixture.copied.push(value);
    if (fixture.clipboardMode === 'failure') throw new Error('Clipboard access denied');
    if (fixture.clipboardMode === 'pending') await new Promise(resolve => { fixture.resolveCopy = resolve; });
  } } });
  w.eval(bundle.outputFiles[0].text);
  const wait = async (check: () => unknown) => {
    for (let attempt = 0; attempt < 80; attempt++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
    throw new Error(`List condition not reached: ${w.document.body.textContent}; ${errors.join('; ')}`);
  };
  await wait(() => w.document.querySelector('select'));
  const changePreset = async (preset: InvestigationRecordPreset) => {
    const select = w.document.querySelector('select'); select.value = preset; select.dispatchEvent(new w.Event('change', { bubbles: true }));
    await wait(() => w.document.querySelector('table')?.dataset.preset === preset);
  };
  const click = (label: string) => { const button = w.document.querySelector(`button[aria-label="${label}"]`); assert.ok(button, label); button.click(); return button; };
  return { w, fixture, wait, changePreset, click, close() { fixture.unmount(); dom.window.close(); assert.deepEqual(errors, []); } };
}

test('controlled presentation changes preserve the exact loaded selection and do not request analytics', async () => {
  const app = await mount();
  const original = JSON.stringify(rows);
  try {
    const trigger = app.click(`Open dossier for lead ${lead.lead_id}`);
    await app.wait(() => app.w.document.querySelector('tbody tr')?.dataset.selected === 'true');
    assert.equal(app.fixture.selections[0].row, lead);
    assert.equal(app.fixture.selections[0].trigger, trigger);
    for (const preset of ['journey', 'contact', 'outcomes', 'full', 'investigation'] as InvestigationRecordPreset[]) {
      await app.changePreset(preset);
      assert.equal(app.w.document.querySelector('tbody tr')?.dataset.selected, 'true');
      assert.equal(app.w.document.querySelector('button[aria-label^="Open dossier"]')?.getAttribute('aria-pressed'), 'true');
    }
    assert.deepEqual(Array.from(app.fixture.presetChanges), ['journey', 'contact', 'outcomes', 'full', 'investigation']);
    assert.equal(app.fixture.selections.length, 1);
    assert.equal(JSON.stringify(rows), original);
    assert.equal(app.fixture.requests.length, 0);
  } finally { app.close(); }
});

test('copying a lead ID gives success or failure feedback without selecting or changing evidence', async () => {
  const app = await mount();
  try {
    app.click(`Copy lead ID ${lead.lead_id}`);
    await app.wait(() => app.w.document.querySelector('[role="status"]')?.textContent === 'Lead ID copied.');
    assert.deepEqual(Array.from(app.fixture.copied), [lead.lead_id]);
    assert.equal(app.fixture.selections.length, 0);
    assert.ok(app.w.document.querySelector('button[aria-label^="Copy lead ID"]')?.getAttribute('aria-describedby'));
    app.fixture.clipboardMode = 'failure';
    app.click(`Copy lead ID ${lead.lead_id}`);
    await app.wait(() => app.w.document.querySelector('[role="status"]')?.textContent.includes('Could not copy'));
    assert.equal(app.fixture.requests.length, 0);
    assert.equal(app.fixture.selections.length, 0);
  } finally { app.close(); }
});

test('a pending clipboard result cannot announce an old identity after loaded rows change', async () => {
  const app = await mount();
  try {
    app.fixture.clipboardMode = 'pending';
    app.click(`Copy lead ID ${lead.lead_id}`);
    await app.wait(() => app.fixture.resolveCopy);
    app.fixture.replaceRows([{ ...lead, lead_id: 'LEAD-new-scope-0002' }]);
    await app.wait(() => app.w.document.querySelector('tbody')?.textContent.includes('LEAD-new-scope-0002'));
    app.fixture.resolveCopy();
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(app.w.document.querySelector('[role="status"]')?.textContent, '');
    assert.equal(app.w.document.querySelector('button[aria-label^="Copy lead ID"]')?.getAttribute('aria-describedby'), null);
    app.fixture.replaceRows(rows);
    await app.wait(() => app.w.document.querySelector('tbody')?.textContent.includes(lead.lead_id));
    assert.equal(app.w.document.querySelector('[role="status"]')?.textContent, '', 'Returning to cached rows does not revive an obsolete clipboard result');
  } finally { app.close(); }
});
