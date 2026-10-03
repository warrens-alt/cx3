import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';
import AnalyticalColumnManager from '../src/features/investigation/AnalyticalColumnManager';
import { analyticalParameter, discoverAnalyticalParameters } from '../src/features/investigation/analyticalParameters';

const rows = [{ lead_id: 'LEAD-9007199254740993', revenue: '123.4500', currency: 'USD', unknown_nullable: null }, { lead_id: 'LEAD-2', source: 'Returned source' }];
const fields = discoverAnalyticalParameters(rows);
const fieldKeys = fields.map(field => field.key);

test('column manager describes the loaded-page union and presentation-only scope without claiming preset-derived values are returned', () => {
  const markup = (includePreset: boolean) => renderToStaticMarkup(React.createElement(AnalyticalColumnManager, { fields: includePreset ? [...fields, { ...analyticalParameter('@delay'), label: 'Age / delay', group: 'timing' }] : fields, selected: fieldKeys, returnedFieldCount: fields.length, presetLabel: 'Full analytical', onChange() {}, onRestore() {} }));
  const full = new JSDOM(markup(false)).window.document;
  assert.match(full.body.textContent!, /Column selection affects presentation only\. It does not change the analytical population or request new data\./);
  assert.match(full.body.textContent!, /union of analytical fields returned for the currently loaded page/);
  assert.doesNotMatch(full.body.textContent!, /milestone-derived/);
  const input = full.querySelector('input[type=search]')!;
  assert.ok(full.querySelector(`label[for="${input.id}"]`));
  assert.match(full.getElementById(input.getAttribute('aria-describedby')!)!.textContent!, /currently loaded page/);
  assert.match(full.querySelector('.cx-analytical-column-count')!.textContent!, /5 selected · 5 of 5 available columns/);
  assert.match(new JSDOM(markup(true)).window.document.body.textContent!, /Preset fields may also show unavailable values or supported milestone-derived timing/);
});

const bundle = await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Manager from './src/features/investigation/AnalyticalColumnManager';
    function Harness(){const data=window.__columns;const [selected,setSelected]=React.useState(data.fields.map(field=>field.key));return <Manager fields={data.fields} selected={selected} returnedFieldCount={data.fields.length} presetLabel="Full analytical" onChange={keys=>{data.changes.push(keys);setSelected(keys)}} onRestore={()=>setSelected(data.fields.map(field=>field.key))}/>}
    const root=createRoot(document.getElementById('root'));window.__columns.unmount=()=>root.unmount();root.render(<Harness/>);`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'process.env.NODE_ENV': '"test"' },
});

test('column manager counts and grouped search reflect local selection, preserve identity, restore Full and return focus on Escape', async () => {
  const errors: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  virtualConsole.on('error', (...args) => errors.push(args.join(' ')));
  const dom = new JSDOM('<div id="root"></div>', { runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const w = dom.window as any;
  w.__columns = { fields, changes: [], requests: [], rows };
  w.fetch = (...args: unknown[]) => { w.__columns.requests.push(args); throw new Error('Columns are local presentation'); };
  const original = JSON.stringify(rows);
  const wait = async (condition: () => unknown) => { for (let index = 0; index < 100; index++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('Column condition not reached'); };
  w.eval(bundle.outputFiles[0].text);
  try {
    await wait(() => w.document.querySelector('.cx-analytical-column-manager'));
    const manager = w.document.querySelector('.cx-analytical-column-manager');
    const trigger = manager.querySelector('summary');
    trigger.click(); assert.equal(manager.open, true);
    assert.equal(trigger.querySelector('span').getAttribute('aria-label'), '5 selected columns');
    assert.deepEqual([...manager.querySelectorAll('legend')].map((element: any) => element.textContent), ['Identity', 'Acquisition', 'Commercial', 'Additional returned fields']);
    const checked = () => [...manager.querySelectorAll('input[type=checkbox]:checked')].length;
    const action = async (name: string) => { const button = [...manager.querySelectorAll('button')].find((element: any) => element.textContent === name) as any; assert.ok(button, name); button.click(); await new Promise(resolve => setTimeout(resolve, 20)); };
    const input = manager.querySelector('input[type=search]');
    const search = async (query: string) => { Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value')!.set!.call(input, query); input.dispatchEvent(new w.Event('input', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 20)); };
    await search('commercial');
    assert.equal(manager.querySelectorAll('input[type=checkbox]').length, 2);
    assert.match(manager.querySelector('.cx-analytical-column-count').textContent, /5 selected · 2 of 5 available columns match this search/);
    const revenue = manager.querySelector('input[type=checkbox]');
    revenue.focus(); revenue.click();
    await wait(() => checked() === 1);
    assert.equal(trigger.querySelector('span').getAttribute('aria-label'), '4 selected columns');
    await action('Clear optional fields');
    assert.deepEqual(Array.from(w.__columns.changes.at(-1)), ['lead_id']);
    assert.match(manager.querySelector('.cx-analytical-column-count').textContent, /1 selected/);
    await action('Select all');
    assert.deepEqual(Array.from(w.__columns.changes.at(-1)), fieldKeys);
    await action('Clear optional fields');
    await action('Restore Full analytical preset');
    assert.equal(trigger.querySelector('span').getAttribute('aria-label'), '5 selected columns');
    await search('');
    assert.equal(checked(), fields.length);
    assert.equal(manager.querySelector('input[type=checkbox]').disabled, true);
    input.focus(); input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(manager.open, false); assert.equal(w.document.activeElement, trigger);
    assert.equal(w.__columns.requests.length, 0);
    assert.equal(JSON.stringify(rows), original);
  } finally { w.__columns.unmount(); dom.window.close(); assert.deepEqual(errors, []); }
});
