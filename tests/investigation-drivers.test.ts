import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { driverMetricKind, driverSegmentLink } from '../src/features/investigation/driverAnalysisModel';
import { navigationTarget } from '../src/lib/presentation';
import { buildPreservedDestination } from '../src/app/navigation/ScopePreservingRedirect';
import { getRootCauseAnalysis } from '../server/analytics/investigation/rootCause';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig } from '../server/bigquery/config';

const scope = '?clientId=synthetic&startDate=2026-09-08&endDate=2026-09-14&vendor=Original&drill=awaiting-first-dial&segmentSource=Paid';
test('only exact supported metrics are decomposed, without a fallback rate', () => {
  for (const id of ['fetchedLeads', 'deliveryRate', 'dialRate', 'contactRate', 'leadToSaleRate', 'activationRate']) assert.equal(driverMetricKind(id), 'operational');
  for (const id of ['spend', 'cpc', 'cpm', 'cpl', 'ctr', 'leads']) assert.equal(driverMetricKind(id), 'marketing');
  for (const id of ['revenue', 'totalSales', 'sla15m', 'callCoverage', 'unknown', null]) assert.equal(driverMetricKind(id), null);
});
test('segment links intersect narrowing, preserve globals and original predicate, and drop private selection', () => {
  const params = new URLSearchParams(scope + '&filters=' + encodeURIComponent(JSON.stringify({ vendor: { operator: 'not_in', values: ['Blocked'] } })) + '&leadId=private&page=8');
  const link = new URL(driverSegmentLink(params, 'vendor', 'Other', true, 'fetchedLeads'), 'https://synthetic.invalid');
  assert.equal(link.pathname, '/lead-explorer');
  for (const key of ['clientId', 'startDate', 'endDate', 'vendor', 'filters', 'drill', 'segmentSource']) assert.equal(link.searchParams.get(key), params.get(key));
  assert.equal(link.searchParams.get('segmentVendor'), 'Other');
  assert.equal(link.searchParams.get('investigationMetric'), 'fetchedLeads');
  assert.equal(link.searchParams.has('leadId'), false);
  assert.equal(link.searchParams.has('page'), false);
  assert.match(driverSegmentLink(params, 'leadAge', 'Not delivered', false), /^\/investigate\?/);
  assert.equal(new URL(driverSegmentLink(params, 'source', 'null', true), 'https://synthetic.invalid').searchParams.get('segmentSource'), 'null', 'A literal source name must not become missing evidence');
});
test('investigation navigation keeps analytical context while unrelated destinations isolate local scope', () => {
  const input = scope + '&investigationMetric=fetchedLeads&leadId=private&search=private&page=4&workspace=one&workspace=two';
  for (const destination of ['/investigate', '/exceptions', '/lead-explorer', '/data-integrity', '/ai-insights', '/lead-ledger']) {
    const target = navigationTarget(destination, '/exceptions', input);
    const params = new URLSearchParams(target.search);
    for (const key of ['drill', 'segmentSource', 'investigationMetric', 'vendor']) assert.equal(params.get(key), new URLSearchParams(input).get(key));
    assert.deepEqual(params.getAll('workspace'), ['one', 'two']);
    for (const key of ['leadId', 'search', 'page']) assert.equal(params.has(key), false);
  }
  assert.equal(new URLSearchParams(navigationTarget('/funnel', '/investigate', input).search).has('drill'), false);
  assert.equal(new URL(buildPreservedDestination('/lead-explorer', input), 'https://synthetic.invalid').searchParams.has('leadId'), false);
});
test('root-cause intersects the same drill and narrowing with the existing matched-period global scope', async t => {
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  let query: any;
  t.mock.method(client, 'query', async options => { query = options; return [[]]; });
  const data = await getRootCauseAnalysis({ clientId: 'default_tenant', startDate: '2026-09-08', endDate: '2026-09-14', metric: 'fetchedLeads', vendor: 'Original', drill: 'awaiting-first-dial', segmentVendor: 'Other', segmentSource: 'Paid', segmentLeadAge: 'Undialled' });
  await assert.rejects(getRootCauseAnalysis({ clientId: 'default_tenant', startDate: '2026-09-08', endDate: '2026-09-14', metric: 'fetchedLeads', search: 'record-identity' }), /does not support record-text search/);
  assert.deepEqual(data.previousWindow, { startDate: '2026-09-01', endDate: '2026-09-07' });
  assert.equal(query.params.vendor, 'Original');
  assert.ok(Object.values(query.params).includes('Other'));
  assert.ok(Object.values(query.params).includes('Paid'));
  assert.match(query.query, /WHERE .*m\.is_delivered AND NOT m\.is_dialled/s);
  assert.match(query.query, /FROM operational_leads m/);
  assert.match(query.query, /'Not delivered'.*'Undialled'/s);
  assert.match(query.query, /COALESCE\(NULLIF\(TRIM\(source\), ''\), 'Unrecorded'\)/);
});

const bundle = await build({
  stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter,useNavigate,useLocation}from'react-router-dom';import DriverAnalysis from './src/features/investigation/DriverAnalysis';
    function Harness(){window.__drivers.navigate=useNavigate();window.__drivers.location=useLocation();return <DriverAnalysis metric={window.__drivers.metric} onPin={item=>window.__drivers.pins.push(item)}/>;}
    const root=createRoot(document.getElementById('root'));window.__drivers.unmount=()=>root.unmount();root.render(<MemoryRouter initialEntries={[window.__drivers.route]}><Harness/></MemoryRouter>);`, resolveDir: process.cwd(), sourcefile: 'drivers-harness.tsx', loader: 'tsx' },
  bundle: true, write: false, format: 'iife', platform: 'browser', loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"test"' },
  plugins: [{ name: 'drivers-contexts', setup(b) {
    const mocks: Record<string, string> = {
      AuthContext: `export const useAuth=()=>({isAdmin:window.__drivers.admin});`,
      ClientContext: `export const useClient=()=>({selectedClient:'synthetic'});`,
      FilterContext: `import{useSearchParams}from'react-router-dom';export function useFilters(){const[p]=useSearchParams();return{startDate:p.get('startDate')||'',endDate:p.get('endDate')||'',filters:{vendor:{operator:'not_in',values:['Blocked']}},filterError:null}}export const extractOffernetFilters=f=>({filters:JSON.stringify(f)});`,
      offernetClient: `const fetcher=(kind,p,_refresh,signal)=>{window.__drivers.requests.push({kind,params:p});return Promise.resolve(window.__drivers[kind])};export const fetchRootCause=(...a)=>fetcher('operational',...a);export const fetchMarketingRootCause=(...a)=>fetcher('marketing',...a);export const fetchExceptions=(...a)=>fetcher('exceptions',...a);`,
    };
    b.onResolve({ filter: /\/(AuthContext|ClientContext|FilterContext|offernetClient)$/ }, a => ({ path: a.path.split('/').at(-1)!, namespace: 'drivers-mock' }));
    b.onLoad({ filter: /.*/, namespace: 'drivers-mock' }, a => ({ contents: mocks[a.path], loader: 'tsx', resolveDir: process.cwd() }));
  } }],
});
const operational = { metric: { id: 'fetchedLeads', label: 'Fetched leads', kind: 'volume', currentValue: 12, previousValue: 10, delta: 2, deltaUnit: 'leads' }, currentWindow: { startDate: '2026-09-08', endDate: '2026-09-14' }, previousWindow: { startDate: '2026-09-01', endDate: '2026-09-07' }, dimensions: [{ key: 'vendor', label: 'Vendor', reconciliationStatus: 'RECONCILED', residual: 0, segments: [{ name: 'Original', currentValue: 12, previousValue: 10, currentNumerator: 12, previousNumerator: 10, currentDenominator: 12, previousDenominator: 10, contribution: 2, shareOfDelta: 100 }] }], drivers: [], methodology: 'Each dimension is descriptive rather than causal.', validationStatus: 'NOT_VERIFIED' };
async function mount(metric: string | null, route = '/investigate' + scope, admin = true, percentageChange: number | null = 20, metricResult = operational) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://synthetic.invalid', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window as any;
  w.__drivers = { metric, route, admin, requests: [], pins: [], operational: metricResult, exceptions: { validationStatus: 'NOT_VERIFIED', comparison: { current: operational.currentWindow, previous: operational.previousWindow, days: 7 }, comparisonReason: 'Cohorts are measured at query time.', populationNote: 'Exception types overlap.', exceptions: [{ id: 'awaiting-first-dial', title: 'Awaiting first dial', count: 12, previousCount: 10, absoluteChange: 2, percentageChange, byVendor: [{ name: 'Original', count: 12 }], bySource: [{ name: 'Paid', count: 12 }] }] } };
  w.eval(bundle.outputFiles[0].text);
  const wait = async (condition: () => boolean) => { for (let i=0;i<100;i++) { if(condition()) return; await new Promise(resolve=>setTimeout(resolve,10)); } throw new Error('Driver UI did not settle'); };
  await wait(() => Boolean(w.document.querySelector('h2')));
  return { w, wait, text: () => w.document.body.textContent as string, close: () => { w.__drivers.unmount(); dom.window.close(); } };
}
test('rendered analysis shows exact matched dates, noncausal semantics and preserves scope on record links', async () => {
  const app = await mount('fetchedLeads'); try {
    await app.wait(() => Boolean(app.w.document.querySelector('table')));
    assert.match(app.text(), /2026-09-01 → 2026-09-07/);
    assert.match(app.text(), /do not establish a cause/);
    assert.match(app.text(), /NOT_VERIFIED/);
    assert.match(app.w.document.querySelector('table').textContent, /Segment change.*Descriptive contribution.*Share of delta/);
    assert.match(app.w.document.querySelector('tbody').textContent, /\+2 leads.*\+2 leads.*100%/);
    assert.equal(app.w.__drivers.requests[0].params.drill, 'awaiting-first-dial');
    assert.equal(app.w.__drivers.requests[0].params.segmentSource, 'Paid');
    const region = app.w.document.querySelector('[aria-label="Vendor exact breakdown"]');region.focus();assert.equal(app.w.document.activeElement, region);
    const link = new URL(region.querySelector('a').href);
    assert.equal(link.searchParams.get('vendor'), 'Original');assert.equal(link.searchParams.get('segmentVendor'), 'Original');assert.equal(link.searchParams.get('drill'), 'awaiting-first-dial');
    region.querySelector('button[aria-label="Pin Original evidence"]').click();
    assert.equal(app.w.__drivers.pins[0].kind, 'driver');
    assert.match(app.w.__drivers.pins[0].value, /\+2 leads contribution/);
  } finally { app.close(); }
});
test('unsupported metrics and implicit date scopes do not request a substituted population', async () => {
  for (const [metric, route] of [['revenue', '/investigate'+scope], ['fetchedLeads', '/investigate?clientId=synthetic']]) {
    const app = await mount(metric, route); try { assert.equal(app.w.__drivers.requests.length, 0);assert.match(app.text(), /unavailable|explicit start and end/); } finally { app.close(); }
  }
});
test('exception concentration does not invent segment comparisons or grade/age breakdowns and respects admin links', async () => {
  const app = await mount(null, '/investigate'+scope, false); try {
    await app.wait(() => Boolean(app.w.document.querySelector('table')));
    assert.equal(app.w.__drivers.requests[0].kind, 'exceptions');
    assert.deepEqual([...app.w.document.querySelectorAll('.cx-driver-dimensions button')].map((b:any)=>b.textContent), ['Vendor','Source']);
    assert.match(app.text(), /Segment comparisons, grade and age breakdowns are unavailable/);
    assert.match(app.w.document.querySelector('.cx-driver-summary').textContent, /Affected distinct leads · Percentage change: \+20%/);
    assert.doesNotMatch(app.w.document.querySelector('table').textContent, /Previous/);
    assert.equal(new URL(app.w.document.querySelector('table a').href).pathname, '/investigate');
  } finally { app.close(); }
});

test('exception relative change uses the supplied percentage and keeps null unavailable', async () => {
  for (const [percentageChange, label] of [[null, 'Unavailable'], [-12.5, '-12.5%']] as const) {
    const app = await mount(null, '/investigate'+scope, false, percentageChange); try {
      await app.wait(() => Boolean(app.w.document.querySelector('table')));
      const change = app.w.document.querySelector('.cx-driver-summary > div:nth-child(3)');
      assert.equal(change.querySelector('strong').textContent, '+2 leads');
      assert.equal(change.querySelector('small').textContent, `Affected distinct leads · Percentage change: ${label}`);
    } finally { app.close(); }
  }
});

test('metric rate changes retain percentage-point semantics without an exception percentage label', async () => {
  const result = { ...operational, metric: { ...operational.metric, id: 'contactRate', label: 'RPC rate', kind: 'rate', deltaUnit: 'pp' } };
  const app = await mount('contactRate', '/investigate'+scope, true, 20, result); try {
    await app.wait(() => Boolean(app.w.document.querySelector('table')));
    const change = app.w.document.querySelector('.cx-driver-summary > div:nth-child(3)');
    assert.equal(change.querySelector('strong').textContent, '+2 pp');
    assert.equal(change.querySelector('small').textContent, 'Returned metric difference');
    assert.doesNotMatch(app.w.document.querySelector('.cx-driver-summary').textContent, /Percentage change/);
  } finally { app.close(); }
});
