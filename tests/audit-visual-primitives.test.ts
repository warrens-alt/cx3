import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';
import EvidenceTrace, { AuditDimensions } from '../src/shared/evidence/EvidenceTrace';
import MetricAnatomy from '../src/shared/evidence/MetricAnatomy';
import EvidenceCoverage from '../src/shared/evidence/EvidenceCoverage';
import EvidenceExclusions from '../src/shared/evidence/EvidenceExclusions';
import ReconciliationView from '../src/shared/evidence/ReconciliationView';
import AuditDependencyMap from '../src/shared/evidence/AuditDependencyMap';
import EvidenceMatrix from '../src/shared/visuals/EvidenceMatrix';
import { canComposeCoverage, exactAuditDelta, formatAuditValue, requiredInputAvailability, type AuditAction, type AuditPopulation, type EvidenceCoverageModel, type EvidenceTraceNode } from '../src/shared/evidence/auditVisualModel';

const documentFor = (element: React.ReactElement) => new JSDOM(renderToStaticMarkup(element)).window.document;
const population = (key: string, value: number | string | null, label = key): AuditPopulation => ({ key, label, value });
const approvedAction: AuditAction = { label: 'Inspect exact records', onClick() {}, supported: true, authorized: true };

test('evidence trace preserves the supplied sequence and unavailable node without creating absent lineage', () => {
  const nodes: EvidenceTraceNode[] = [
    { key: 'field', type: 'field', label: 'Captured identity', value: 'lead_id', state: 'mapped' },
    { key: 'source', type: 'source', label: 'Source read', value: null, state: 'unavailable' },
    { key: 'display', type: 'display', label: 'Returned result', value: 0, state: 'observed' },
  ];
  const snapshot = JSON.stringify(nodes);
  const doc = documentFor(React.createElement(EvidenceTrace, { nodes }));
  const items = [...doc.querySelectorAll('ol>li')];
  assert.deepEqual(items.map(item => item.getAttribute('data-node-type')), ['field', 'source', 'display']);
  assert.match(items[1].getAttribute('aria-label')!, /Unavailable/);
  assert.equal(items[1].querySelector('.cx-audit-exact-value')?.textContent, 'Unavailable');
  assert.equal(items[2].querySelector('.cx-audit-exact-value')?.textContent, '0');
  assert.equal(doc.querySelector('[data-node-type=api]'), null);
  assert.equal(doc.querySelector('[data-node-type=reconciliation]'), null);
  assert.equal(JSON.stringify(nodes), snapshot);
});

test('evidence trace hides an absent trace rather than filling it with placeholder steps', () => {
  assert.equal(renderToStaticMarkup(React.createElement(EvidenceTrace, { nodes: [] })), '');
});

test('independent dimensions retain unlike states without an overall status or score', () => {
  const doc = documentFor(React.createElement(AuditDimensions, { dimensions: [
    { key: 'mapping', label: 'Mapping', state: 'mapped' }, { key: 'business', label: 'Business meaning', state: 'not_verified' },
    { key: 'source', label: 'Source', state: 'observed' }, { key: 'reconciliation', label: 'Reconciliation', state: 'unavailable' },
  ] }));
  assert.deepEqual([...doc.querySelectorAll('[data-audit-state]')].map(element => element.getAttribute('data-audit-state')), ['mapped', 'not_verified', 'observed', 'unavailable']);
  assert.doesNotMatch(doc.body.textContent!, /score|confidence|\d+%/i);
});

test('ratio anatomy displays exact components and measured zero with explicitly declared percentage scaling', () => {
  const doc = documentFor(React.createElement(MetricAnatomy, { model: { kind: 'ratio', label: 'RPC rate', value: 0, unit: '%', scaling: 'percentage_value', numerator: population('positive', 0, 'Positive RPC'), denominator: population('qualified', 12801, 'Qualified dialled leads') } }));
  const values = [...doc.querySelectorAll('.cx-anatomy-population>.cx-audit-exact-value')].map(node => node.textContent);
  assert.deepEqual(values, ['0', '12,801']);
  assert.match(doc.querySelector('.cx-anatomy-formula')!.textContent!, /0 \/ 12,801 × 100 = 0 %/);
  assert.equal((doc.querySelector('.cx-anatomy-population .cx-audit-bar-track>span') as HTMLElement).style.width, '0%');
});

test('anatomy never equates missing or zero denominators to a supplied rate', () => {
  for (const denominator of [null, 0, '—', 'Unavailable']) {
    const doc = documentFor(React.createElement(MetricAnatomy, { model: { kind: 'ratio', label: 'Rate', value: 'Unavailable', unit: '%', scaling: 'percentage_value', numerator: population('n', 0), denominator: population('d', denominator) } }));
    assert.doesNotMatch(doc.querySelector('.cx-anatomy-formula')!.textContent!, / = /);
    assert.match(doc.body.textContent!, /Denominator unavailable|denominator is zero/);
    assert.equal(doc.querySelector('.cx-anatomy-result strong')?.textContent, 'Unavailable');
  }
  const supplied = documentFor(React.createElement(MetricAnatomy, { model: { kind: 'ratio', label: 'Rate', value: 5, unit: '%', scaling: 'percentage_value', numerator: population('n', null), denominator: population('d', null) } }));
  assert.match(supplied.querySelector('.cx-anatomy-formula')!.textContent!, /Supplied result: 5 %/);
  assert.doesNotMatch(supplied.querySelector('.cx-anatomy-formula')!.textContent!, / = /);
});

test('anatomy keeps independent-ratio wording and supplied populations that are not nested', () => {
  const doc = documentFor(React.createElement(MetricAnatomy, { model: { kind: 'independent_ratio', label: 'Activations / sales', value: 150, unit: '%', numerator: population('activations', 30), denominator: population('sales', 20) } }));
  assert.match(doc.body.textContent!, /Independent population ratio/);
  assert.match(doc.body.textContent!, /separately recorded populations/);
  assert.match(doc.body.textContent!, /not a cohort conversion rate/);
  assert.deepEqual([...doc.querySelectorAll('.cx-anatomy-population>.cx-audit-exact-value')].map(node => node.textContent), ['30', '20']);
  assert.match(doc.querySelector('.cx-anatomy-formula')!.textContent!, /Supplied result: 150 %/);
});

test('financial anatomy shows explicit completeness and preserves decimal precision without a denominator', () => {
  const value = '9007199254740993.000000001';
  const doc = documentFor(React.createElement(MetricAnatomy, { model: { kind: 'financial', label: 'Source-recorded revenue', value, unit: 'ZAR', completeness: { key: 'coverage', label: 'Revenue evidence', state: 'partial', detail: 'Missing rows are not assumed to be zero.' } } }));
  assert.equal(doc.querySelector('.cx-anatomy-result strong')?.textContent, value + ' ZAR');
  assert.equal(doc.querySelector('.cx-anatomy-formula'), null);
  assert.match(doc.body.textContent!, /no denominator is implied/);
  assert.equal(doc.querySelector('[data-audit-state]')?.getAttribute('data-audit-state'), 'partial');
});

test('neutral value anatomy does not invent a counting grain or denominator for an untyped result', () => {
  const doc = documentFor(React.createElement(MetricAnatomy, { model: { kind: 'value', label: 'Returned duration', value: '7m 12s', detail: 'A duration value returned by the response.' } }));
  assert.equal(doc.querySelector('.cx-anatomy-result strong')?.textContent, '7m 12s');
  assert.equal(doc.querySelector('.cx-anatomy-formula'), null);
  assert.doesNotMatch(doc.body.textContent!, /Count of|denominator|financial value/i);
});

test('coverage distinguishes explicit zero and unavailable counts and defaults to separate bars', () => {
  const doc = documentFor(React.createElement(EvidenceCoverage, { model: { label: 'Revenue evidence', categories: [population('recorded', 704), population('zero', 0, 'Explicit zero'), population('missing', null, 'Missing count')] } }));
  assert.equal(doc.querySelector('section')?.getAttribute('data-composition'), 'separate');
  assert.deepEqual([...doc.querySelectorAll('li>strong')].map(node => node.textContent), ['704', '0', 'Unavailable']);
  assert.equal(doc.querySelectorAll('.cx-audit-bar-track>span').length, 2);
  assert.equal(doc.querySelector('.cx-audit-coverage-stack'), null);
});

test('coverage stacks only explicitly mutually exclusive available populations', () => {
  const model: EvidenceCoverageModel = { label: 'RPC evidence', composition: 'mutually-exclusive', categories: [population('positive', 6), population('negative', 3), population('unknown', 1)] };
  const doc = documentFor(React.createElement(EvidenceCoverage, { model }));
  assert.equal(canComposeCoverage(model), true);
  assert.equal(doc.querySelector('section')?.getAttribute('data-composition'), 'stacked');
  assert.deepEqual([...doc.querySelectorAll<HTMLElement>('.cx-audit-coverage-stack>span')].map(node => Math.round(Number.parseFloat(node.style.width))), [60, 30, 10]);
  for (const value of [null, -1, 'Unavailable']) {
    const incomplete = { ...model, categories: [population('n', 5), population('u', value)] };
    assert.equal(canComposeCoverage(incomplete), false);
    assert.equal(documentFor(React.createElement(EvidenceCoverage, { model: incomplete })).querySelector('.cx-audit-coverage-stack'), null);
  }
});

test('all-zero composition and extreme magnitudes produce finite coordinates without changing exact text', () => {
  for (const categories of [[population('a', 0), population('b', 0)], [population('a', 1e308), population('b', 1e308)]]) {
    const doc = documentFor(React.createElement(EvidenceCoverage, { model: { label: 'Scoped coverage', composition: 'mutually-exclusive', categories } }));
    assert.doesNotMatch(doc.body.innerHTML, /NaN|Infinity/);
    assert.equal(doc.querySelectorAll('.cx-audit-coverage-stack>span').length, 2);
  }
});

test('exclusions retain supplied exact totals and reasons without subtracting or adding overlapping groups', () => {
  const doc = documentFor(React.createElement(EvidenceExclusions, { model: { label: 'Dial qualification', recorded: population('recorded', 20), qualified: population('qualified', 14), excluded: population('excluded', null), reasons: [population('beforeCapture', 5), population('beforeDelivery', 5)] } }));
  assert.deepEqual([...doc.querySelectorAll('.cx-audit-qualification-summary>li>strong')].map(node => node.textContent), ['20', '14', 'Unavailable']);
  assert.deepEqual([...doc.querySelectorAll('.cx-audit-population-list:not(.cx-audit-qualification-summary)>li>strong')].map(node => node.textContent), ['5', '5']);
  assert.match(doc.body.textContent!, /Reasons may overlap/);
  assert.doesNotMatch(doc.body.textContent!, /Excluded total.*10|Excluded total.*6/);
});

test('exclusion and trace actions require explicit supported semantics and authorization', () => {
  const unauthorized = { ...approvedAction, authorized: false } as unknown as AuditAction;
  const unsupported = { ...approvedAction, supported: false } as unknown as AuditAction;
  const doc = documentFor(React.createElement(EvidenceExclusions, { model: { label: 'Exclusions', reasons: [
    { ...population('exact', 2), action: approvedAction }, { ...population('unauthorized', 3), action: unauthorized }, { ...population('unsupported', 4), action: unsupported }, population('absent', 5),
  ] } }));
  assert.equal(doc.querySelectorAll('button').length, 1);
  assert.match(doc.querySelector('button')!.getAttribute('aria-label')!, /exact, 2/);
  const trace = documentFor(React.createElement(EvidenceTrace, { nodes: [{ key: 'x', type: 'source', label: 'Source', state: 'mapped', action: unauthorized }] }));
  assert.equal(trace.querySelector('button'), null);
});

test('exact reconciliation deltas preserve zero, both signs, huge integers and tiny warehouse decimals', () => {
  assert.equal(exactAuditDelta('12801', '12801'), '0');
  assert.equal(exactAuditDelta(45, 42), '+3');
  assert.equal(exactAuditDelta(0, 42), '-42');
  assert.equal(exactAuditDelta('9007199254740993.000000002', '9007199254740993.000000001'), '+0.000000001');
  assert.equal(exactAuditDelta('9007199254740993', '9007199254740991'), '+2');
  assert.equal(exactAuditDelta(null, 0), null);
  assert.equal(exactAuditDelta('—', '0'), null);
  assert.equal(exactAuditDelta(Number.MAX_SAFE_INTEGER + 1, 0), null);
});

test('delivery consistency distinguishes arithmetic agreement from independently reconciled or approved evidence', () => {
  const doc = documentFor(React.createElement(ReconciliationView, { model: { label: 'Metric comparison', kind: 'delivery_consistency', state: 'not_verified', values: [population('api', 12801), population('ui', 12801)], comparisons: [{ key: 'delivery', label: 'API → display', observed: 12801, expected: 12801 }] } }));
  assert.match(doc.body.textContent!, /Delivery consistency check/);
  assert.equal(doc.querySelector('td:last-child>strong')?.textContent, '0');
  assert.equal(doc.querySelector('[data-audit-state]')?.getAttribute('data-audit-state'), 'not_verified');
  assert.equal(doc.querySelector('[data-audit-state=reconciled]'), null);
  assert.equal(doc.querySelector('[data-audit-state=business_verified]'), null);
  assert.match(doc.body.textContent!, /does not establish independent source reconciliation/);
});

test('reconciliation exposes exact expected/observed/delta text with accessible zero and diverging direction', () => {
  const doc = documentFor(React.createElement(ReconciliationView, { model: { label: 'Scope reconciliation', kind: 'source_reconciliation', state: 'mismatch', scopeDescription: 'Tenant A / 28 Sep', values: [], comparisons: [
    { key: 'negative', label: 'A', observed: 0, expected: 42 }, { key: 'positive', label: 'B', observed: 45, expected: 42 },
    { key: 'zero', label: 'C', observed: '0.00', expected: '0' }, { key: 'missing', label: 'D', observed: null, expected: 0 },
  ] } }));
  assert.deepEqual([...doc.querySelectorAll('td:last-child>strong')].map(node => node.textContent), ['-42', '+3', '0', 'Unavailable']);
  assert.deepEqual([...doc.querySelectorAll('[data-direction]')].map(node => node.getAttribute('data-direction')), ['negative', 'positive', 'zero']);
  assert.match(doc.querySelector('caption')!.textContent!, /observed minus expected/);
  assert.match(doc.body.textContent!, /Tenant A \/ 28 Sep/);
  assert.doesNotMatch(doc.body.innerHTML, /NaN|Infinity/);
});

test('unavailable reconciliation never becomes verified and does not invent comparison rows', () => {
  const doc = documentFor(React.createElement(ReconciliationView, { model: { label: 'Reconciliation evidence', kind: 'source_reconciliation', state: 'unavailable', values: [] } }));
  assert.equal(doc.querySelector('table'), null);
  assert.equal(doc.querySelector('[data-audit-state]')?.getAttribute('data-audit-state'), 'unavailable');
  assert.doesNotMatch(doc.body.textContent!, /VERIFIED|0 difference/);
});

test('required-input availability counts only explicit required booleans and never estimates confidence', () => {
  const inputs = [
    { ...population('spend', null), required: true, available: true }, { ...population('revenue', 0), required: true, available: true },
    { ...population('telephony', null), required: true, available: false }, { ...population('optional', 0), required: false, available: true },
  ];
  assert.deepEqual(requiredInputAvailability(inputs), { available: 2, total: 3 });
  assert.equal(requiredInputAvailability([{ ...population('unknown', null), required: true }]), null);
  const doc = documentFor(React.createElement(AuditDependencyMap, { model: { label: 'Profit inputs', inputs } }));
  assert.match(doc.body.textContent!, /2 of 3 required inputs available/);
  assert.doesNotMatch(doc.body.textContent!, /confidence|67%/i);
});

test('metric evidence matrix keeps independent mapped/scoped states and existing unavailable cells', () => {
  const doc = documentFor(React.createElement(EvidenceMatrix, { label: 'Metric evidence', rowHeading: 'Metric', columns: [{ key: 'mapping', label: 'Mapping' }, { key: 'scope', label: 'Scope' }, { key: 'business', label: 'Business' }], rows: [{ key: 'fetched', label: 'Fetched', cells: { mapping: { state: 'mapped', label: 'Declared mapping' }, scope: { state: 'scoped', label: 'Exact query scope' } } }] }));
  assert.equal(doc.querySelector('thead th')?.textContent, 'Metric');
  assert.deepEqual([...doc.querySelectorAll('tbody td')].map(cell => cell.getAttribute('data-state')), ['mapped', 'scoped', 'unavailable']);
  assert.match(doc.body.textContent!, /Mapping defined/);
});

test('unavailable sentinels and nonfinite numbers never masquerade as observations while measured zero survives', () => {
  for (const value of [null, undefined, '', '—', '— (Unavailable)', 'Unavailable', 'Not recorded', Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(formatAuditValue(value), 'Unavailable');
  for (const value of [0, '0', '0.000000000']) assert.notEqual(formatAuditValue(value), 'Unavailable');
});

test('numeric audit text preserves tiny nonzero values beside exact reconciliation deltas', () => {
  for (const value of [1e-21, -1e-21, Number.MIN_VALUE]) {
    assert.notEqual(formatAuditValue(value), '0');
    assert.equal(Number(formatAuditValue(value)), value);
    const doc = documentFor(React.createElement(ReconciliationView, { model: { label: 'Tiny comparison', kind: 'delivery_consistency', state: 'not_verified', values: [], comparisons: [{ key: 'tiny', label: 'Returned precision', observed: value, expected: 0 }] } }));
    assert.match(doc.body.textContent!, new RegExp(formatAuditValue(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(doc.querySelector('td:last-child>strong')?.textContent, exactAuditDelta(value, 0));
  }
});

const bundle = await build({
  stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import AuditDependencyMap from './src/shared/evidence/AuditDependencyMap';import EvidenceExclusions from './src/shared/evidence/EvidenceExclusions';
    const action={label:'Inspect supported records',supported:true,authorized:true,onClick:()=>{window.__audit.clicked++}};
    const root=createRoot(document.getElementById('root'));window.__audit.unmount=()=>root.unmount();root.render(<><AuditDependencyMap model={{label:'Declared dependencies',inputs:[{key:'ledger',label:'Ledger',value:null,state:'mapped'},{key:'media',label:'Media',value:null,state:'mapped'}],outputs:[{key:'revenue',label:'Revenue',value:null,state:'not_verified',dependencies:['ledger'],action},{key:'cpl',label:'CPL',value:null,state:'not_verified',dependencies:['ledger','media']}]}}/><EvidenceExclusions model={{label:'Exact exclusions',reasons:[{key:'before',label:'Before capture',value:2,action}]}}/></>);`, resolveDir: process.cwd(), sourcefile: 'audit-primitives-harness.tsx', loader: 'tsx' },
  bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'process.env.NODE_ENV': '"test"' },
});

test('dependency selection uses declared multiple-source edges and supported actions without fetching', async () => {
  const errors: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  virtualConsole.on('error', (...args) => errors.push(args.join(' ')));
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://synthetic.invalid', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const w = dom.window as any;
  w.__audit = { clicked: 0, requests: 0 };
  w.fetch = () => { w.__audit.requests++; throw new Error('Presentation must not fetch'); };
  const wait = async (check: () => unknown) => { for (let i = 0; i < 100; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('Audit UI did not settle: ' + errors.join('; ')); };
  try {
    w.eval(bundle.outputFiles[0].text);
    await wait(() => w.document.querySelectorAll('.cx-audit-dependency-columns button').length === 3);
    const buttons = w.document.querySelectorAll('.cx-audit-dependency-node button');
    buttons[1].focus(); buttons[1].click();
    await wait(() => buttons[1].getAttribute('aria-pressed') === 'true');
    const dependentMetrics = () => [...w.document.querySelectorAll('.cx-audit-dependency-columns>div:last-child .cx-audit-dependency-node>strong')].map((node: any) => node.textContent);
    assert.deepEqual(dependentMetrics(), ['CPL']);
    assert.match(w.document.querySelector('.cx-audit-dependency-columns>div:last-child').textContent, /Declared inputs: Ledger, Media/);
    assert.equal(w.document.activeElement, buttons[1]);
    [...w.document.querySelectorAll('button')].find((button: any) => button.textContent === 'Show all dependent metrics').click();
    await wait(() => dependentMetrics().length === 2);
    w.document.querySelector('.cx-audit-exclusion-action').focus(); w.document.querySelector('.cx-audit-exclusion-action').click();
    assert.equal(w.__audit.clicked, 1);
    assert.equal(w.__audit.requests, 0);
  } finally { w.__audit.unmount(); w.close(); }
  assert.deepEqual(errors, []);
});

test('finite numeric deltas retain available tiny exponent-form evidence without rounding', () => {
  assert.equal(exactAuditDelta(0.0000001, 0), '+0.0000001');
  assert.equal(exactAuditDelta(-0.0000001, 0), '-0.0000001');
  assert.equal(exactAuditDelta(1e-7, 1e-7), '0');
});
