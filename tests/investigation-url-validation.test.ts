import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';
import { INVESTIGATION_URL_QUERY_KEYS, duplicateInvestigationScopeKeys, resetAmbiguousInvestigationUrlScope, validateInvestigationUrlScope } from '../contracts/investigation';
import { readFilters } from '../src/lib/FilterContext';

const ordinaryScope = 'clientId=synthetic-a&startDate=2026-09-01&endDate=2026-09-07&vendor=Global&workspace=one&workspace=two';
test('all investigation scalar parameters reject repeated values, including identical repetitions', () => {
  for (const key of INVESTIGATION_URL_QUERY_KEYS) {
    for (const second of ['first', 'second']) {
      const params = new URLSearchParams(ordinaryScope);
      params.append(key, 'first'); params.append(key, second);
      assert.deepEqual(duplicateInvestigationScopeKeys(params), [key]);
      assert.throws(() => validateInvestigationUrlScope(params), /repeated scope parameters/);
      assert.throws(() => readFilters(params), /Each must appear once/);
    }
  }
});
test('scalar reporting identity, bounds and filters also reject duplicates without changing supported multi-value filters', () => {
  for (const key of ['clientId', 'startDate', 'endDate', 'filters', 'vendor', 'source']) {
    const params = new URLSearchParams(`${key}=first&${key}=second`);
    assert.throws(() => validateInvestigationUrlScope(params), /no value has been chosen/);
  }
  const valid = new URLSearchParams(ordinaryScope);
  valid.set('vendor', 'A,B');
  assert.doesNotThrow(() => validateInvestigationUrlScope(valid));
  assert.deepEqual(readFilters(valid).vendor, { operator: 'in', values: ['A', 'B'] });
  assert.deepEqual(valid.getAll('workspace'), ['one', 'two']);
});
test('deliberate investigation reset removes ambiguous predicate/value/narrowing as one definition while preserving reporting scope', () => {
  const params = new URLSearchParams(ordinaryScope + '&drill=funnel-loss&drillValue=fetched-to-delivered&drillValue=delivered-to-dialled&segmentVendor=Narrow&page=8&leadId=private');
  const reset = resetAmbiguousInvestigationUrlScope(params);
  assert.doesNotThrow(() => validateInvestigationUrlScope(reset));
  for (const key of ['clientId', 'startDate', 'endDate', 'vendor']) assert.equal(reset.get(key), params.get(key));
  assert.deepEqual(reset.getAll('workspace'), ['one', 'two']);
  for (const key of [...INVESTIGATION_URL_QUERY_KEYS, 'page', 'leadId']) assert.equal(reset.has(key), false);
  assert.equal(params.getAll('drillValue').length, 2, 'The original URL object is not mutated');
});
test('ambiguous workspace identity cannot be repaired by silently selecting a first or fallback tenant', () => {
  const params = new URLSearchParams(ordinaryScope + '&clientId=synthetic-b&search=first&search=second');
  const reset = resetAmbiguousInvestigationUrlScope(params);
  assert.deepEqual(reset.getAll('clientId'), ['synthetic-a', 'synthetic-b']);
  assert.equal(reset.has('search'), false);
  assert.throws(() => validateInvestigationUrlScope(reset), /Choose one workspace explicitly/);
});

const bundle = await build({
  stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter,useLocation}from'react-router-dom';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';
    import{ClientProvider,useClient}from'./src/lib/ClientContext';import{FilterProvider,useFilters,extractOffernetFilters}from'./src/lib/FilterContext';import{useOperationalData}from'./src/lib/useOperationalData';
    const queryClient=new QueryClient();const fetcher=async params=>{window.__scope.requests.push(params);return{ok:true}};
    function Harness(){const f=useFilters();const c=useClient();const location=useLocation();const params=new URLSearchParams(location.search);
      window.__scope.location=location.pathname+location.search;window.__scope.ready=c.ready;window.__scope.selectedClient=c.selectedClient;
      useOperationalData('scope-validation',{clientId:c.selectedClient,startDate:f.startDate||undefined,endDate:f.endDate||undefined,...extractOffernetFilters(f.filters),drill:params.get('drill')||undefined,search:params.get('search')||undefined},fetcher);
      return <><p data-ready={c.ready}>{f.filterError||'Valid scope'}</p><button onClick={f.resetScope}>Reset reporting scope</button><button onClick={()=>c.setSelectedClient('synthetic-b')}>Choose workspace B</button></>;}
    const root=createRoot(document.getElementById('root'));window.__scope.unmount=()=>{root.unmount();queryClient.clear()};
    root.render(<MemoryRouter initialEntries={[window.__scope.route]}><QueryClientProvider client={queryClient}><ClientProvider><FilterProvider><Harness/></FilterProvider></ClientProvider></QueryClientProvider></MemoryRouter>);`,
    resolveDir: process.cwd(), sourcefile: 'scope-harness.tsx', loader: 'tsx',
  }, bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"test"'},
});
async function mount(query: string) {
  const errors: string[] = [];
  const console = new VirtualConsole();console.on('jsdomError', error=>errors.push(error.message));console.on('error',(...args)=>errors.push(args.map(String).join(' ')));
  const dom = new JSDOM('<div id="root"></div>', { url:'https://synthetic.invalid',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console });
  const w = dom.window as any;
  w.__scope={route:'/investigate?'+query,requests:[]};
  w.fetch=async(url:string)=>{assert.equal(url,'/api/analytics/clients');return{ok:true,json:async()=>({success:true,data:[{id:'synthetic-a',name:'A'},{id:'synthetic-b',name:'B'}]})}};
  w.eval(bundle.outputFiles[0].text);
  const wait=async(check:()=>boolean)=>{for(let i=0;i<100;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,10))}throw new Error('Scope UI did not settle: '+w.document.body.textContent)};
  await wait(()=>w.__scope.ready===true);
  return{w,wait,params:()=>new URLSearchParams(w.__scope.location.split('?')[1]),text:()=>w.document.body.textContent,click:(label:string)=>[...w.document.querySelectorAll('button')].find((button:any)=>button.textContent===label).click(),close(){w.__scope.unmount();dom.window.close();assert.deepEqual(errors,[])}};
}
test('actual providers suppress analytical requests for duplicated investigation URLs and recover after reset', async () => {
  for(const key of INVESTIGATION_URL_QUERY_KEYS){
    const app=await mount(ordinaryScope+`&${key}=first&${key}=second`);try{
      assert.match(app.text(),/repeated scope parameters/);assert.equal(app.w.__scope.requests.length,0,key);
      app.click('Reset reporting scope');
      await app.wait(()=>app.w.__scope.requests.length===1);
      assert.match(app.text(),/Valid scope/);
      assert.equal(app.params().get('vendor'),'Global');assert.equal(app.params().get('startDate'),'2026-09-01');assert.equal(app.params().get('endDate'),'2026-09-07');
      for(const parameter of INVESTIGATION_URL_QUERY_KEYS)assert.equal(app.params().has(parameter),false);
    }finally{app.close()}
  }
});
test('duplicate dates block requests until reset and normal reset retains its established semantics', async () => {
  const invalid=await mount(ordinaryScope+'&startDate=2026-08-01');try{
    assert.equal(invalid.w.__scope.requests.length,0);invalid.click('Reset reporting scope');await invalid.wait(()=>invalid.w.__scope.requests.length===1);
    assert.equal(invalid.params().has('startDate'),false);assert.equal(invalid.params().has('endDate'),false);assert.equal(invalid.params().get('vendor'),'Global');
  }finally{invalid.close()}
  const normal=await mount(ordinaryScope+'&drill=awaiting-first-dial&segmentSource=Paid');try{
    await normal.wait(()=>normal.w.__scope.requests.length===1);normal.click('Reset reporting scope');await normal.wait(()=>normal.w.__scope.requests.length===2);
    for(const key of ['vendor','startDate','endDate'])assert.equal(normal.params().has(key),false);
    assert.equal(normal.params().get('drill'),'awaiting-first-dial');assert.equal(normal.params().get('segmentSource'),'Paid');
  }finally{normal.close()}
});
test('actual ClientProvider does not collapse an ambiguous unauthorized-first tenant URL; explicit selection recovers',async()=>{
  const app=await mount('clientId=unauthorized&clientId=synthetic-b&startDate=2026-09-01&endDate=2026-09-07');try{
    assert.deepEqual(app.params().getAll('clientId'),['unauthorized','synthetic-b']);assert.equal(app.w.__scope.selectedClient,'');assert.equal(app.w.__scope.requests.length,0);
    app.click('Reset reporting scope');await new Promise(resolve=>setTimeout(resolve,20));
    assert.equal(app.w.__scope.requests.length,0);assert.match(app.text(),/Choose one workspace explicitly/);
    app.click('Choose workspace B');await app.wait(()=>app.w.__scope.requests.length===1);
    assert.deepEqual(app.params().getAll('clientId'),['synthetic-b']);assert.equal(app.w.__scope.requests[0].clientId,'synthetic-b');
  }finally{app.close()}
});
