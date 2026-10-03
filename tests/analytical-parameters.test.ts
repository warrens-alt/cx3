import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';
import AnalyticalAllParameters from '../src/features/investigation/AnalyticalAllParameters';
import { analyticalParameter, analyticalParameterExport, analyticalParameterJson, analyticalParameterText, discoverAnalyticalParameters, groupAnalyticalParameters } from '../src/features/investigation/analyticalParameters';

const row = {
  lead_id: 'PRIVATE-LEAD-1', consumer_id: '9007199254740993', transaction_id: 'TX-1',
  source: 'Source A', medium: null, fetched: '2026-10-01T09:00:00Z', grade: 'A', valid_idno: 2,
  vendor: 'Vendor A', qualified_delivery: false, dialled: false, total_calls: 0, contacted: null,
  sale: 0, activated: null, revenue: '1234567890.123456789', currency: 'ZAR', sale_time: null,
  investigationReason: { code: 'RETURNED', label: 'Returned population', detail: 'Exact predicate description.' },
  delivery_before_capture: false, metadata: { validation: null, values: [1, 2] },
  unknown_nested: { note: '<img src=x onerror=alert(1)>', nested: [{ value: 0 }] }, unknown_null: null,
};

test('the shared schema includes every own returned key exactly once, with known groups and safe fallback', () => {
  const fields = discoverAnalyticalParameters([row, { lead_id: 'PRIVATE-LEAD-2', extra_number: 0 }]);
  assert.deepEqual(fields.map(field => field.key).sort(), [...Object.keys(row), 'extra_number'].sort());
  const groups = new Map(groupAnalyticalParameters(fields).map(group => [group.id, group.fields.map(field => field.key)]));
  for (const [group, key] of [['identity', 'transaction_id'], ['acquisition', 'medium'], ['qualification', 'valid_idno'], ['delivery', 'qualified_delivery'], ['contact', 'total_calls'], ['outcomes', 'sale'], ['commercial', 'revenue'], ['timing', 'sale_time'], ['investigation', 'investigationReason'], ['audit', 'delivery_before_capture'], ['additional', 'unknown_nested']]) assert.ok(groups.get(group as any)?.includes(key), `${key} in ${group}`);
  assert.equal(fields.find(field => field.key === 'extra_number')?.numeric, true);
  assert.equal(fields.find(field => field.key === 'consumer_id')?.numeric, false, 'Identifiers retain exact string presentation');
  assert.equal(fields.some(field => field.key === 'activation_time'), false, 'No field is fabricated from the canonical registry');
});

test('presentation preserves null, absent, zero, negative and exact decimal evidence without borrowing alias values', () => {
  const value = (key: string, data = row as Record<string, unknown>) => analyticalParameterText(data, analyticalParameter(key));
  assert.equal(value('total_calls'), '0'); assert.equal(value('dialled'), 'Not recorded');
  assert.equal(value('medium'), 'Unavailable'); assert.equal(value('activation_time'), 'Not supplied');
  assert.equal(value('valid_idno'), 'Invalid (2)'); assert.equal(value('qualified_delivery'), 'false');
  assert.equal(value('revenue'), '1234567890.123456789 ZAR'); assert.equal(value('consumer_id'), '9007199254740993');
  assert.equal(value('investigationReason'), 'Returned population'); assert.equal(value('unknown_nested'), '2 returned fields');
  assert.equal(value('source', { source: null, offershop_source: 'Different field' }), 'Unavailable');
  assert.equal(value('revenue', { revenue: '-0.12500000000000001' }), '-0.12500000000000001');
  assert.equal(value('revenue', { revenue: '12.3400', currency: 'USD' }), '12.3400 USD');
});

test('complete export projection is reusable without truncating fields or changing established audited export contracts', () => {
  const projected = analyticalParameterExport([row, { lead_id: 'PRIVATE-LEAD-2', extra: false }]);
  assert.deepEqual([...projected.headers].sort(), [...Object.keys(row), 'extra'].sort());
  const column = (key: string) => projected.headers.indexOf(key);
  assert.equal(projected.rows[0][column('consumer_id')], '9007199254740993');
  assert.equal(projected.rows[0][column('revenue')], '1234567890.123456789');
  assert.equal(projected.rows[0][column('medium')], 'Unavailable');
  assert.equal(projected.rows[0][column('extra')], 'Not supplied');
  assert.equal(projected.rows[1][column('extra')], 'false');
  assert.deepEqual(JSON.parse(projected.rows[0][column('metadata')]), row.metadata);
});

test('All parameters represents null and unknown keys, escapes markup and keeps raw JSON secondary', () => {
  const document = new JSDOM(renderToStaticMarkup(React.createElement(AnalyticalAllParameters, { row }))).window.document;
  assert.deepEqual([...document.querySelectorAll('[data-parameter-key]')].map(element => element.getAttribute('data-parameter-key')).sort(), Object.keys(row).sort());
  assert.match(document.querySelector('[data-parameter-key="unknown_null"]')!.textContent!, /Unavailable/);
  assert.equal(document.querySelector('img'), null); assert.doesNotMatch(document.body.textContent!, /\[object Object\]/);
  assert.ok([...document.querySelectorAll('summary')].some(element => element.textContent === 'Returned analytical row (JSON)'));
  const cyclic: Record<string, unknown> = { exact: 9007199254740993n }; cyclic.self = cyclic;
  assert.match(analyticalParameterJson(cyclic), /9007199254740993.*Circular value/s);
  const shared = { value: 0 }; assert.doesNotMatch(analyticalParameterJson({ first: shared, second: shared }), /Circular/);
});

const bundle = await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import AllParameters from ${JSON.stringify(path.resolve('src/features/investigation/AnalyticalAllParameters.tsx'))};const root=createRoot(document.getElementById('root'));window.__unmount=()=>root.unmount();root.render(<AllParameters row={window.__row}/>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, format: 'iife', platform: 'browser', write: false, define: { 'process.env.NODE_ENV': '"test"' } });
test('parameter search matches names and groups, expands matching sections and restores every field when cleared', async () => {
  const errors: string[] = []; const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message)); virtualConsole.on('error', (...args) => errors.push(args.join(' ')));
  const dom = new JSDOM('<div id="root"></div>', { runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const w = dom.window as any; w.__row = row;
  w.fetch = () => { throw new Error('Parameter presentation must not fetch data'); };
  const wait = async (condition: () => unknown) => { for (let i = 0; i < 100; i++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('Parameter condition not reached'); };
  w.eval(bundle.outputFiles[0].text);
  try {
    await wait(() => w.document.querySelector('input'));
    const search = async (value: string) => { const input = w.document.querySelector('input'); Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new w.Event('input', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 20)); };
    await search('contact');
    assert.deepEqual([...w.document.querySelectorAll('[data-parameter-key]')].map((item: any) => item.dataset.parameterKey).sort(), ['contacted', 'dialled', 'total_calls']);
    assert.equal(w.document.querySelector('.cx-analytical-parameter-group').open, true);
    await search('unknown_null'); assert.equal(w.document.querySelectorAll('[data-parameter-key]').length, 1);
    await search('no-such-field'); assert.match(w.document.body.textContent, /No returned parameter names match/);
    await search(''); assert.equal(w.document.querySelectorAll('[data-parameter-key]').length, Object.keys(row).length);
  } finally { w.__unmount(); dom.window.close(); assert.deepEqual(errors, []); }
});
