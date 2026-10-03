import { reductionPayloads } from './frontend/reductionFixtures';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {JSDOM,VirtualConsole} from 'jsdom';
import {buildAcceptanceFixture} from '../scripts/build-frontend-acceptance-fixture.mjs';
import {navigationTarget} from '../src/lib/presentation';
import {chartCoordinate} from '../src/lib/chartPresentation';
import {buildLeadLedgerExport} from '../src/lib/leadLedgerExport';
import {LEDGER_HEADERS} from '../contracts/leadLedgerReplica';
import {FLAT_LEAD_TENANT_TABLES} from '../contracts/warehouseSchemaSnapshot';
import {getRouteItem} from '../src/app/routeManifest';

const output=await mkdtemp(path.join(tmpdir(),'cx3-routed-acceptance-'));
await buildAcceptanceFixture(output);
const script=await readFile(path.join(output,'fixture.js'),'utf8');
test.after(()=>rm(output,{recursive:true,force:true}));
const scope='?clientId=synthetic-a&startDate=2026-09-28&endDate=2026-09-28';
async function mount(route:string,options:any={}) {
  const errors:string[]=[];
  const console=new VirtualConsole();
  console.on('jsdomError',(e:any)=>{if(!e.message.includes('navigation'))errors.push(e.message);});
  console.on('error',(...args:any[])=>errors.push(args.map(String).join(' ')));
  const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'https://synthetic.invalid',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console});
  const w=dom.window as any;
  Object.assign(w,{Response,Request,Headers,AbortController,TextEncoder,TextDecoder,ReadableStream,structuredClone,ResizeObserver:class {observe(){}unobserve(){}disconnect(){}},__fixture:{initialRoute:route,...options}});
  w.matchMedia=(query:string)=>({matches:false,media:query,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
  w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLElement.prototype.scrollTo=()=>{}; w.scrollTo=()=>{};
  // JSDOM has no layout. Model rendered boxes for focus visibility; real geometry is browser-tested.
  w.HTMLElement.prototype.getClientRects=function(){
    if(!this.isConnected||this.closest('[hidden]'))return [];
    for(let el=this;el;el=el.parentElement)if(w.getComputedStyle(el).display==='none')return [];
    return [new w.DOMRect(0,0,100,30)];
  };
  const blobs:any[]=[];
  w.URL.createObjectURL=(blob:any)=>{blobs.push(blob);return 'blob:synthetic';};w.URL.revokeObjectURL=()=>{};
  w.eval(script);
  const text=()=>w.document.querySelector('main')?.textContent||w.document.body.textContent||'';
  const find=(selector:string,label?:string)=>[...w.document.querySelectorAll(selector)].find((e:any)=>label===undefined||((e.getAttribute('aria-label')||e.textContent||'').includes(label))) as any;
  const wait=async(check:()=>any,message='Expected routed UI')=>{for(let i=0;i<150;i++){if(check())return;await new Promise(r=>setTimeout(r,20));}throw new Error(message+'\n'+text().slice(0,4000)+'\nErrors: '+errors.join('\n'));};
  const click=async(selector:string,label?:string)=>{const el=find(selector,label);assert.ok(el,`Missing ${selector} ${label}`);el.focus();el.click();await new Promise(r=>setTimeout(r,30));return el;};
  const input=async(el:any,value:string)=>{assert.ok(el);Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new w.Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,30));};
  try { await wait(()=>!text().includes('Opening ')&&!!w.document.querySelector('main, .cx-auth-gate')); } catch(e) { w.__fixture.unmount(); dom.window.close(); throw e; }
  return {w,text,find,wait,click,input,blobs,errors,close(){w.__fixture.unmount();dom.window.close();}};
}

test('navigation uses destination scope policies and preserves repeated workspace values',()=>{
  const query='?clientId=a&workspace=x&workspace=y&startDate=2026-09-28&drill=old&search=old&tab=old';
  assert.equal(navigationTarget('/admin','/lead-explorer',query).search,'?clientId=a&workspace=x&workspace=y');
  const destination=navigationTarget('/lead-explorer?drill=awaiting-first-dial','/speed-to-lead',query);
  assert.equal(new URLSearchParams(destination.search).get('drill'),'awaiting-first-dial');
  assert.equal(new URLSearchParams(destination.search).get('search'),null);
  assert.equal(new URLSearchParams(navigationTarget('/vendors','/overview',query).search).get('startDate'),'2026-09-28');
  assert.equal(new URLSearchParams(navigationTarget('/overview','/reports',query+'&release=r1').search).get('startDate'),'2026-09-28');
});

test('quick navigation opens the single Lead Evidence destination by its Ledger alias and retains reporting scope',async()=>{
  const app=await mount('/lead-explorer'+scope+'&workspace=alpha&workspace=beta&drill=awaiting-first-dial&search=old');try{
    await app.click('button','Search workspaces');
    await app.wait(()=>app.find('input','Search pages and navigation'));
    const input=app.find('input','Search pages and navigation');
    await app.input(input,'Lead Ledger');
    await app.wait(()=>app.find('[role="option"]','Lead Evidence'),'Lead Evidence must appear for the Ledger alias in quick navigation');
    assert.equal(app.w.document.querySelectorAll('[role="option"]').length,1);
    input.dispatchEvent(new app.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    await app.wait(()=>app.w.__fixture.location.startsWith('/lead-explorer?')&&!!app.find('.cx-investigation-records'));
    assert.equal(app.find('[role="dialog"]'),undefined);
    const params=new URL(app.w.__fixture.location,'https://synthetic.invalid').searchParams;
    assert.equal(params.get('clientId'),'synthetic-a');
    assert.equal(params.get('startDate'),'2026-09-28');
    assert.equal(params.get('endDate'),'2026-09-28');
    assert.deepEqual(params.getAll('workspace'),['alpha','beta']);
    assert.equal(params.get('drill'),'awaiting-first-dial');
    assert.equal(params.get('search'),null);
  }finally{app.close();}
});

test('successful filter-choice retry clears its error without refreshing records or losing scope',async()=>{
  const app=await mount('/lead-explorer'+scope+'&vendor=Synthetic+vendor');try{
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    app.w.__fixture.fail=['filter-options'];
    await app.click('button','Refresh current view');
    await app.wait(()=>app.find('button','Retry filter choices')&&app.find('button','Refresh current view'));
    assert.match(app.text(),/Filter choices are unavailable/);
    assert.ok(app.text().includes('SYNTHETIC-LEAD-0001'));
    const before=app.w.__fixture.requests.length;
    const location=app.w.__fixture.location;
    app.w.__fixture.fail=[];
    await app.click('button','Retry filter choices');
    await app.wait(()=>!app.find('button','Retry filter choices'));
    assert.equal(app.w.document.querySelectorAll('.cx-scopebar [role="alert"]').length,0);
    const requests=app.w.__fixture.requests.slice(before);
    assert.equal(requests.filter((r:string)=>r.includes('filter-options')).length,1);
    assert.equal(requests.filter((r:string)=>r.includes('raw-leads')).length,0);
    assert.equal(app.w.__fixture.location,location);
    assert.ok(app.text().includes('SYNTHETIC-LEAD-0001'));
  }finally{app.close();}
});

test('actual Speed route exposes numeric timing, zero geometry and existing controls',async()=>{
  const app=await mount('/speed-to-lead'+scope);try{
    await app.wait(()=>app.text().includes('Median latency by stage'));
    assert.ok(app.find('.cx-speed-page'));
    assert.equal(app.find('button','Why changed?'),undefined);
    assert.match(app.text(),/42m/);
    const zero=app.w.document.querySelector('.cx-evidence-bar-track[data-state="zero"] .cx-evidence-bar-fill');
    assert.equal(zero.style.width,'0%');
    const requests=app.w.__fixture.requests.filter((r:string)=>r.includes('speed-to-lead'));
    assert.equal(requests.length,1);
    const disclosure=app.find('summary','Operating');assert.ok(disclosure);disclosure.click();
    await app.wait(()=>disclosure.parentElement.open);
    await app.click('button','Inspect evidence: Awaiting First Dial');
    await app.wait(()=>app.find('[role="dialog"]'));
    assert.ok([...app.w.document.querySelectorAll('a')].some((a:any)=>a.href.includes('drill=awaiting-first-dial')));
  }finally{app.close();}
});

test('Source Evidence and Population retain distinct grains in one Lead Evidence workspace',async()=>{
  const app=await mount('/lead-ledger'+scope);try{
    await app.wait(()=>app.find('.cx-ledger-source-table tbody tr'));
    await app.click('.cx-ledger-source-table button','Inspect source lead SYNTHETIC-LEAD-0001');
    await app.wait(()=>app.text().includes('1234567890.123456789'));
    assert.match(app.text(),/repeated|duplicate/i);
    await app.click('[role="tab"]','Population');
    await app.wait(()=>app.find('input','Search lead records'));
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    assert.ok(!app.find('.cx-ledger-source-table'));
    assert.match(app.text(),/Unavailable/);
  }finally{app.close();}
});

test('source Ledger paging and submitted search preserve full filtered summary counts',async()=>{
  const app=await mount('/lead-ledger'+scope,{sourceLeadCount:26});try{
    await app.wait(()=>app.w.document.querySelectorAll('.cx-ledger-source-table tbody tr').length===25);
    assert.match(app.text(),/26 leads in scope/);
    for(const [metric,value] of [['leads','26'],['rows','27'],['lead-only','25'],['exceptions','2']])assert.equal(app.find(`[data-metric="${metric}"] strong`).textContent,value);
    await app.click('button','Next');
    await app.wait(()=>app.w.document.querySelectorAll('.cx-ledger-source-table tbody tr').length===1);
    assert.match(app.text(),/SYNTHETIC-SOURCE-0026/);
    assert.match(app.text(),/26 leads in scope/);
    for(const [metric,value] of [['leads','26'],['rows','27'],['lead-only','25'],['exceptions','2']])assert.equal(app.find(`[data-metric="${metric}"] strong`).textContent,value);
    await app.input(app.find('#ledger-search'),'SYNTHETIC-SOURCE-0026');
    app.find('.cx-ledger-toolbar form').dispatchEvent(new app.w.Event('submit',{bubbles:true,cancelable:true}));
    await app.wait(()=>app.text().includes('1 leads in scope'));
    assert.match(app.text(),/Page 1/);
    assert.ok(app.w.__fixture.requests.some((r:string)=>r.includes('replica?')&&r.includes('search=SYNTHETIC-SOURCE-0026')&&r.includes('offset=0')));
  }finally{app.close();}
});

test('partial source coverage preserves its boundary and export choices',async()=>{
  const coverage={compatible:false,available:LEDGER_HEADERS.filter(h=>h!=='HLC Last Call Date'),missing:['HLC Last Call Date'],source:'Synthetic partial source',richViewEnabled:false};
  const app=await mount('/lead-ledger'+scope,{payloads:{'/api/analytics/lead-ledger/replica/coverage':coverage}});try{
    await app.wait(()=>app.find('button','Export source data with available fields'));
    assert.equal(app.find('button','Export source-compatible data').disabled,true);
    await app.wait(()=>!app.find('button','Export source data with available fields').disabled);
    assert.match(app.text(),/HLC Last Call Date/);
  }finally{app.close();}
});

test('data integrity does not certify an old observed timestamp as healthy',async()=>{
  const app=await mount('/data-integrity'+scope);try{
    await app.wait(()=>app.text().includes('Synthetic old source'));
    assert.match(app.text(),/2020-01-01/);
    assert.doesNotMatch(app.text(),/healthy sources/);
    const sourceCard=[...app.w.document.querySelectorAll('article')].find((e:any)=>e.textContent.includes('Observed Data Sources')) as any;
    assert.ok(sourceCard);assert.doesNotMatch(sourceCard.textContent,/Why changed/);
  }finally{app.close();}
});

test('configured reconciliation without a release reports the returned reason',async()=>{
  const app=await mount('/reconciliation'+scope);try{
    await app.wait(()=>app.text().includes('No approved reporting release published'));
    assert.doesNotMatch(app.text(),/currently unconfigured/);
  }finally{app.close();}
});

test('briefing loading does not claim a model before returned provenance',async()=>{
  const endpoint='/api/analytics/offernet/ai-insights';
  const app=await mount('/ai-insights'+scope,{defer:[endpoint]});try{
    await app.wait(()=>app.text().includes('Loading operational briefing'));
    assert.doesNotMatch(app.text(),/Synthesizing operational metrics via Google Gemini/);
    await app.wait(()=>Boolean(app.w.__fixture.pending?.[endpoint]));
    app.w.__fixture.pending[endpoint]();
    await app.wait(()=>app.text().includes('Synthetic briefing'));
    assert.match(app.find('[aria-label="Briefing provenance"]').textContent,/synthetic/);
  }finally{app.close();}
});

test('consumer and agent inspection remain available without unrelated decompositions',async()=>{
  const app=await mount('/consumers'+scope);try{
    await app.wait(()=>app.text().includes('Consumer Volume Tier Distribution'));
    assert.equal(Boolean(app.find('button','Why changed?')),false);
    const inspect=app.w.document.querySelectorAll('.cx-inspect-btn')[2];assert.ok(inspect);inspect.click();
    await app.wait(()=>!app.text().includes('Consumer Volume Tier Distribution'));
    assert.equal(app.w.__fixture.requests.filter((r:string)=>r.includes('root-cause')).length,0);
    app.w.__fixture.navigate('/agent-performance'+scope);
    await app.wait(()=>app.text().includes('Synthetic Agent A'));
    assert.equal(Boolean(app.find('button','Why changed?')),false);
    const requests=[...app.w.__fixture.requests];
    await app.click('button','Inspect evidence');
    await app.wait(()=>app.find('.cx-audit-drawer'));
    const drawer=app.find('.cx-audit-drawer');
    assert.equal(drawer.querySelector('h2').textContent,'Agents observed');
    assert.match(drawer.textContent,/Agent\/vendor group/);
    assert.match(drawer.textContent,/synthetic-a/);
    assert.match(drawer.textContent,/2026-09-28 → 2026-09-28/);
    assert.deepEqual([...app.w.__fixture.requests],requests,'Local inspection does not fetch another population');
    assert.equal(app.w.__fixture.requests.filter((r:string)=>r.includes('root-cause')).length,0);
  }finally{app.close();}
});

test('root-cause contribution region preserves record links, scope and keyboard focus',async()=>{
  const app=await mount('/__fixture/root-cause'+scope);try{
    await app.wait(()=>app.find('[aria-label="Vendor exact breakdown"]'));
    const region=app.find('[aria-label="Vendor exact breakdown"]');
    assert.equal(region.getAttribute('tabindex'),'0');
    region.focus();assert.equal(app.w.document.activeElement===region,true);
    assert.match(region.textContent,/Descriptive contribution.*20 leads/);
    assert.match(app.text(),/Fetched leads/);
    assert.match(app.text(),/matched periods do not establish a cause/);
    assert.doesNotMatch(app.text(),/Returned residual|fully explained/i);
    const link=region.querySelector('a');assert.ok(link);
    const target=new URL(link.href);
    assert.equal(target.searchParams.get('segmentVendor'),'Synthetic vendor with a long descriptive name');
    assert.equal(target.searchParams.get('startDate'),'2026-09-28');
  }finally{app.close();}
});

test('analytical Ledger scope changes reset paging across a scope round trip',async()=>{
  const app=await mount('/lead-explorer'+scope+'&preset=full');try{
    await app.wait(()=>app.find('input','Search lead records'));
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    await app.click('.cx-explorer-pagination button','Next');
    await app.wait(()=>app.w.__fixture.requests.some((r:string)=>r.includes('raw-leads')&&r.includes('offset=50')));
    app.w.__fixture.navigate('/lead-explorer?clientId=synthetic-b&startDate=2026-09-28&endDate=2026-09-28&preset=full');
    await app.wait(()=>app.w.__fixture.requests.some((r:string)=>r.includes('raw-leads')&&r.includes('clientId=synthetic-b')));
    assert.ok(app.w.__fixture.requests.filter((r:string)=>r.includes('raw-leads')&&r.includes('clientId=synthetic-b')).every((r:string)=>r.includes('offset=0')));
    app.w.__fixture.navigate('/lead-explorer'+scope+'&preset=full');
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    assert.equal(app.w.document.querySelectorAll('[role="dialog"]').length,0);
    assert.equal(app.find('.cx-explorer-pagination button','First').disabled,true);
  }finally{app.close();}
});

test('analytical search submits exact existing query and shows matched rows',async()=>{
  const app=await mount('/lead-explorer'+scope+'&preset=full');try{
    await app.wait(()=>app.find('input','Search lead records'));
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    await app.input(app.find('input','Search lead records'),'SYNTHETIC-LEAD-0002');
    app.find('.cx-explorer-search').dispatchEvent(new app.w.Event('submit',{bubbles:true,cancelable:true}));
    await app.wait(()=>app.w.__fixture.requests.some((r:string)=>r.includes('search=SYNTHETIC-LEAD-0002')));
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0002')&&!app.text().includes('SYNTHETIC-LEAD-0001'));
    assert.match(app.text(),/SYNTHETIC-LEAD-0002/);
    assert.doesNotMatch(app.text(),/SYNTHETIC-LEAD-0001/);
  }finally{app.close();}
});

test('loaded-row timeline reports unavailable evidence and returns keyboard focus',async()=>{
  const app=await mount('/lead-explorer'+scope+'&preset=journey');try{
    await app.wait(()=>app.find('input','Search lead records'));
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    const requests=app.w.__fixture.requests.filter((request:string)=>request.includes('raw-leads')).length;
    const trigger=await app.click('.cx-investigation-records button.cx-record-open');
    await app.wait(()=>app.find('.cx-lead-dossier'));
    await app.wait(()=>app.find('.cx-lead-dossier').contains(app.w.document.activeElement),'Inspector receives initial focus');
    await app.click('.cx-dossier-tabs [role="tab"]','Timeline');
    await app.wait(()=>app.find('.cx-ledger-journey'));
    const inspector=app.find('.cx-lead-dossier');
    assert.match(inspector.textContent,/Evidence unavailable/);
    assert.match(inspector.textContent,/count unavailable/);
    assert.doesNotMatch(inspector.textContent,/undefined total/);
    assert.equal(app.w.__fixture.requests.filter((request:string)=>request.includes('raw-leads')).length,requests,'Already loaded normalized row is reused');
    assert.equal(app.w.__fixture.requests.filter((request:string)=>request.includes('lead-timeline')).length,1,'The canonical dossier retains its selected scoped timeline query');
    await app.click('button','Close lead dossier');
    await app.wait(()=>!app.find('.cx-ledger-journey'));
    await app.wait(()=>app.w.document.activeElement===trigger,'Focus returns to its trigger');
    assert.equal(app.w.document.activeElement===trigger,true,'Focus returns to its trigger');
  }finally{app.close();}
});

test('request failure is not rendered as an empty analytical ledger',async()=>{
  const app=await mount('/lead-explorer'+scope,{fail:['raw-leads']});try{
    await app.wait(()=>app.find('[role="alert"]'));
    assert.doesNotMatch(app.text(),/No records match/);
    assert.match(app.text(),/unavailable|could not|failure/i);
  }finally{app.close();}
});

test('explorer distinguishes absent outcomes from explicit false',async()=>{
  const app=await mount('/lead-explorer'+scope+'&preset=outcomes');try{
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    await app.wait(()=>app.find('table[data-preset="outcomes"]'));
    const rows=[...app.w.document.querySelectorAll('table[data-preset="outcomes"] tbody tr')] as any[];
    assert.match(rows[0].textContent,/Unavailable/);
    assert.match(rows[1].textContent,/Not recorded/);
  }finally{app.close();}
});

test('Explorer scope round trips clear the open dossier and reset its page',async()=>{
  const app=await mount('/lead-explorer'+scope);try{
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    await app.click('button','Next');
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0051'));
    await app.click('button[aria-label="Open dossier for lead SYNTHETIC-LEAD-0051"]');
    await app.wait(()=>app.find('.cx-lead-dossier'));
    app.w.__fixture.navigate('/lead-explorer?clientId=synthetic-a&startDate=2026-09-27&endDate=2026-09-28');
    await app.wait(()=>!app.find('.cx-lead-dossier'));
    await app.wait(()=>app.w.__fixture.requests.some((r:string)=>r.includes('raw-leads')&&r.includes('startDate=2026-09-27')));
    assert.ok(app.w.__fixture.requests.filter((r:string)=>r.includes('raw-leads')&&r.includes('startDate=2026-09-27')).every((r:string)=>r.includes('offset=0')));
    assert.equal(app.w.__fixture.requests.some((r:string)=>r.includes('lead-timeline')&&r.includes('startDate=2026-09-27')),false);
    app.w.__fixture.navigate('/lead-explorer'+scope);
    await app.wait(()=>app.w.__fixture.location==='/lead-explorer'+scope);
    await new Promise(r=>setTimeout(r,70));
    assert.equal(Boolean(app.find('.cx-lead-dossier')),false);
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    assert.equal(app.find('button','Previous').disabled,true);
  }finally{app.close();}
});

test('denied identity cannot render protected data or issue analytical requests',async()=>{
  const app=await mount('/lead-ledger'+scope,{denied:true});try{
    await app.wait(()=>/pending|approval/i.test(app.text()));
    assert.doesNotMatch(app.text(),/SYNTHETIC-LEAD/);
    assert.equal(app.w.__fixture.requests.length,0);
  }finally{app.close();}
});

test('legacy alias retains reporting scope and lands on actual explorer',async()=>{
  const app=await mount('/explore'+scope+'&drill=awaiting-first-dial');try{
    await app.wait(()=>app.w.__fixture.location.startsWith('/lead-explorer'));
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    assert.match(app.w.__fixture.location,/startDate=2026-09-28/);
    assert.match(app.w.__fixture.location,/drill=awaiting-first-dial/);
  }finally{app.close();}
});

test('failed access subscriptions never invent an account; view buttons change the panel',async()=>{
  const app=await mount('/access-control'+scope);try{
    await app.wait(()=>app.text().includes('User directory unavailable'));
    assert.doesNotMatch(app.text(),/Warren Stear|All Workspaces \(\*\)/);
    await app.click('button','Pre-Authorized Invites');
    await app.wait(()=>app.text().includes('Invitations unavailable'));
    await app.click('button','Audit Log');await app.wait(()=>app.text().includes('Audit log unavailable'));
    await app.click('button','Access Policies');assert.match(app.text(),/Draft policy values/);
  }finally{app.close();}
});

test('validation displays non-certified references and exports the same truthful evidence status',async()=>{
  const app=await mount('/validation'+scope);try{
    await app.wait(()=>app.text().includes('Synthetic reference metric'));
    assert.match(app.text(),/Independent validation not established/);
    assert.match(app.text(),/Historical reference values · NOT_VERIFIED/);
    assert.match(app.text(),/HISTORICAL_REFERENCE/);
    assert.match(app.text(),/Verified atNot performed/);
    assert.match(app.text(),/Reconciled atNot performed/);
    assert.match(app.text(),/Independently verified measurementsUNAVAILABLE/);
    assert.match(app.text(),/Current warehouse evidenceUNAVAILABLE/);
    assert.doesNotMatch(app.text(),/EVIDENCE_CHECKED|unverified claim|0 Discrepancy/);
    assert.equal(app.w.__fixture.requests.filter((r:string)=>r.includes('/warehouse/tables')).length,0);
    await app.click('button','Export reference matrix');
    assert.equal(app.blobs.length,1);
    const csv=await new Promise<string>((resolve,reject)=>{const reader=new app.w.FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsText(app.blobs[0]);});
    assert.match(csv,/"HISTORICAL_REFERENCE"/);
    assert.match(csv,/"NOT_VERIFIED","NOT_VERIFIED","",""/);
    assert.doesNotMatch(csv,/"VERIFIED"|EVIDENCE_CHECKED/);
    await app.click('button','Warehouse catalogue');
    await app.wait(()=>app.w.__fixture.requests.some((r:string)=>r.includes('/warehouse/tables')));
    assert.match(app.text(),/Saved schema registration does not establish live source access/);
    await app.click('button','Validation rules');assert.match(app.text(),/No clean-data percentage/);
    assert.ok(!app.find('table'));
  }finally{app.close();}
});

test('consumer missing count is not zero and loaded tabs change visible content',async()=>{
  const app=await mount('/consumers'+scope);try{
    await app.wait(()=>app.text().includes('Consumer Volume Tier Distribution'));
    const cards=[...app.w.document.querySelectorAll('article')] as any[];
    const total=cards.find(c=>c.textContent.includes('Total Consumers'));
    assert.ok(total);assert.match(total.textContent,/Unavailable|—/);
    await app.click('button','Sequential Entry Economics');
    await app.wait(()=>!app.text().includes('Consumer Volume Tier Distribution'));
  }finally{app.close();}
});

test('numeric chart coordinates distinguish zero, missing and signed evidence',()=>{
  assert.equal(chartCoordinate(null),null);assert.equal(chartCoordinate(''),null);
  assert.equal(chartCoordinate('0'),0);assert.equal(chartCoordinate('-12.25'),-12.25);
  assert.equal(chartCoordinate('Unavailable'),null);
});

test('analytical export preserves synthetic raw precision, missing states and original field order',()=>{
  const result=buildLeadLedgerExport({clientId:'synthetic-a',startDate:'2026-09-28',endDate:'2026-09-28',filters:{},search:null,drill:null,timezone:'Africa/Johannesburg',dateBasis:'intake_cohort',definitionVersion:'fixture-v1',metricId:'lead_records',countingGrain:'lead',generatedAt:'2026-09-30T00:00:00Z',sourceCutoff:null,validationStatus:'NOT_VERIFIED',rows:[{lead_id:'synthetic',revenue:'1234567890.123456789',sale:null,activated:false,total_calls:'9007199254740993'}],totalCount:1,limit:50,offset:0,metadata:{clientId:'synthetic-a',startDate:'2026-09-28',endDate:'2026-09-28',filters:{},validationStatus:'NOT_VERIFIED'}} as any);
  assert.equal(result.rows[0][0],'Lead ID');assert.equal(result.rows[0][16],'Revenue');
  assert.ok(result.rows[1].includes('1234567890.123456789'));
  assert.ok(result.rows[1].includes('9007199254740993'));
  assert.equal(result.rows[1][14],'Unavailable');assert.equal(result.rows[1][15],'FALSE');
});

test('agent chart opens scoped call evidence without another analytical request',async()=>{
  const app=await mount('/agent-performance'+scope);try{
    await app.wait(()=>app.text().includes('Synthetic Agent B'));
    const requests=[...app.w.__fixture.requests];
    await app.click('button','Inspect Synthetic Agent A:');
    await app.wait(()=>app.find('.cx-audit-drawer'));
    const drawer=app.find('.cx-audit-drawer');
    assert.equal(drawer.querySelector('h2').textContent,'Synthetic Agent A · Recorded calls');
    assert.equal(drawer.querySelector('.cx-audit-result strong').textContent,'120');
    assert.match(drawer.textContent,/Call event, grouped by agent and vendor/);
    assert.match(drawer.textContent,/Call start date/);
    assert.match(drawer.textContent,/synthetic-a/);
    assert.match(drawer.textContent,/2026-09-28 → 2026-09-28/);
    assert.equal(app.find('.cx-audit-drawer a','Inspect supporting records'),undefined,'Call evidence has no unrelated lead drill');
    assert.equal(app.find('input','Search returned agents or vendors').value,'');
    assert.match(app.text(),/Synthetic Agent B/);
    assert.deepEqual([...app.w.__fixture.requests],requests,'Chart inspection uses the returned evidence');
    await app.click('button','Close inspector');
    await app.click('button','RPC rate');
    assert.equal(app.find('button','RPC rate').getAttribute('aria-pressed'),'true');
    const barRows=[...app.w.document.querySelectorAll('.cx-evidence-bar-row')] as any[];
    assert.match(barRows[0].textContent,/Synthetic Agent A/);assert.match(barRows[1].textContent,/Unavailable/);
  }finally{app.close();}
});

test('More analyses has native links, Escape closes it and returns focus',async()=>{
  const app=await mount('/speed-to-lead'+scope);try{
    await app.wait(()=>app.text().includes('Median latency by stage'));
    const trigger=await app.click('button','More analyses');
    await app.wait(()=>app.find('[role="group"]','More analyses'));
    const group=app.find('[role="group"]','More analyses');
    assert.ok(group.querySelector('a[href*="/operations/agents"]'));
    assert.equal(group.querySelectorAll('[role="menuitem"]').length,0);
    app.w.document.dispatchEvent(new app.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    await app.wait(()=>!app.find('[role="group"]','More analyses'));
    assert.equal(app.w.document.activeElement===trigger,true,'Focus returns to its trigger');
  }finally{app.close();}
});

test('More analyses closes on primary-link activation and router history changes',async()=>{
  const app=await mount('/agent-performance'+scope);try{
    await app.wait(()=>app.text().includes('Synthetic Agent A'));
    await app.click('button','More analyses');
    assert.ok(app.find('[role="group"]','More analyses'));
    // A click without mousedown follows the same link activation path as Enter.
    await app.click('nav[aria-label="Operations navigation"] a','Response speed');
    await app.wait(()=>app.w.__fixture.location.startsWith('/operations/response'));
    await app.wait(()=>!app.find('[role="group"]','More analyses'));
    assert.equal(Boolean(app.find('[role="group"]','More analyses')),false);
    await app.click('button','More analyses');
    app.w.__fixture.navigate(-1);
    await app.wait(()=>app.w.__fixture.location.startsWith('/agent-performance'));
    await app.wait(()=>!app.find('[role="group"]','More analyses'));
    assert.equal(Boolean(app.find('[role="group"]','More analyses')),false);
  }finally{app.close();}
});

test('AI answer is hidden after scope changes and obsolete asynchronous answers cannot return',async()=>{
  const app=await mount('/ai-insights'+scope);try{
    await app.wait(()=>app.find('input','Question for analytics assistant'));
    await app.input(app.find('input','Question for analytics assistant'),'Synthetic scope question');
    await app.click('button','Ask AI');await app.wait(()=>app.text().includes('Synthetic answer for selected scope'));
    app.w.__fixture.navigate('/ai-insights?clientId=synthetic-a&startDate=2026-09-27&endDate=2026-09-28');
    await app.wait(()=>!app.text().includes('Synthetic answer for selected scope'));
    app.w.__fixture.defer=['/api/analytics/google/ask'];
    await app.wait(()=>app.find('button','Ask AI'));
    await app.click('button','Ask AI');await app.wait(()=>app.w.__fixture.pending?.['/api/analytics/google/ask']);
    app.w.__fixture.navigate('/ai-insights'+scope);
    await app.wait(()=>app.w.__fixture.location==='/ai-insights'+scope);
    app.w.__fixture.pending['/api/analytics/google/ask']();
    await new Promise(r=>setTimeout(r,70));assert.doesNotMatch(app.text(),/Synthetic answer for selected scope/);
    assert.equal(app.w.__fixture.requests.filter((r:string)=>r.includes('/google/ask')).length,2);
  }finally{app.close();}
});

test('signed exact bars retain labels, represent negative extent and expose native buttons',async()=>{
  const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
  const {default:ExactBarChart}=await import('../src/components/operations/ExactBarChart');
  const html=renderToStaticMarkup(React.createElement(ExactBarChart,{data:[{label:'Positive',value:'100',formatted:'100.000000001'},{label:'Negative',value:'-50',formatted:'-50.00'},{label:'Absent',value:null,formatted:'Unavailable'},{label:'Zero',value:'0',formatted:'0.00'}],onSelect:()=>{}}));
  const dom=new JSDOM(html);try{
    const buttons=dom.window.document.querySelectorAll('button');assert.equal(buttons.length,4);
    assert.equal(buttons[0].querySelector('[data-state]')!.lastElementChild!.getAttribute('style'),'width:50%;left:50%');
    assert.equal(buttons[1].querySelector('[data-state]')!.lastElementChild!.getAttribute('style'),'width:25%;left:25%');
    assert.equal(buttons[2].querySelector('[data-state]')!.getAttribute('data-state'),'unknown');
    assert.equal(buttons[3].querySelector('[data-state]')!.getAttribute('data-state'),'zero');
    assert.match(buttons[0].textContent!,/100\.000000001/);
  }finally{dom.window.close();}
});

test('retired Lead Engine route and nested legacy paths render page not found',async()=>{
  for(const route of ['/lead-engine','/lead-engine/ledger']){
    const app=await mount(route+scope);try{
      await app.wait(()=>app.text().includes('Page not found'));
      assert.doesNotMatch(app.w.document.body.textContent,/Legacy reference workspace|LEAD ENGINE/);
      assert.equal(app.w.__fixture.requests.some((r:string)=>/api\/(quality|commercial\/simulator|settings\/status|table-data)/.test(r)),false);
      assert.equal(app.w.document.querySelector('a[href^="/lead-engine"]'),null);
    }finally{app.close();}
  }
});

test('failed exception evidence cannot claim an empty vendor backlog',async()=>{
  const app=await mount('/exceptions'+scope,{fail:['overview','exceptions']});try{
    await app.wait(()=>app.text().includes('Vendor backlog evidence unavailable.'));
    assert.doesNotMatch(app.text(),/No vendor backlog is currently observed/);
    assert.equal(app.find('button','Why changed?'),undefined);
    const requests=[...app.w.__fixture.requests];
    await app.click('[aria-label="Exceptions summary metrics"] .cx-unified-metric:nth-child(2) button');
    await app.wait(()=>app.find('.cx-audit-drawer'));
    const drawer=app.find('.cx-audit-drawer');
    assert.equal(drawer.querySelector('h2').textContent,'Awaiting first dial');
    assert.equal(drawer.querySelector('.cx-audit-result strong').textContent,'—');
    assert.match(drawer.textContent,/Unavailable/);
    assert.match(drawer.textContent,/NOT_VERIFIED/);
    assert.match(drawer.textContent,/synthetic-a/);
    assert.match(drawer.textContent,/2026-09-28 → 2026-09-28/);
    assert.deepEqual([...app.w.__fixture.requests],requests,'Unavailable evidence inspection does not fetch or invent a result');
  }finally{app.close();}
});

test('Overview puts independent lifecycle evidence after outcomes and gates Why changed',async()=>{
  const app=await mount('/overview'+scope);try{
    await app.wait(()=>app.find('.cx-overview-journey'));
    assert.equal(app.find('button','Why changed?'),undefined);
    const stages=[...app.w.document.querySelectorAll('.cx-overview-lifecycle-rail > li')];
    assert.equal(stages.length,6);
    assert.equal(app.w.__fixture.requests.filter((r:string)=>r.includes('/overview?')).length,1);
    assert.equal(app.w.__fixture.requests.filter((r:string)=>r.includes('/commercial?')||r.includes('operating-controls')||r.includes('source-observability')).length,0);
    const all=app.w.document.querySelector('.cx-outcome-strip');
    assert.ok(all.compareDocumentPosition(app.find('.cx-overview-journey'))&app.w.Node.DOCUMENT_POSITION_FOLLOWING);
  }finally{app.close();}
});

test('Data status uses one client-only check and preserves failed-check feedback',async()=>{
  const app=await mount('/overview'+scope+'&vendor=Synthetic+vendor');try{
    await app.wait(()=>app.find('button','Data status'));
    assert.equal(app.w.__fixture.requests.filter((r:string)=>r.includes('source-observability')).length,0);
    assert.equal(app.w.document.querySelectorAll('.cx-data-status-trigger').length,1);
    assert.equal(app.find('.cx-data-status-trigger').dataset.tone,'unknown');
    assert.ok(!app.text().includes('Live telemetry'));
    await app.click('button','Data status');
    await app.wait(()=>app.w.document.body.textContent.includes('Source readable'));
    const request=app.w.__fixture.requests.find((r:string)=>r.includes('source-observability'));
    assert.equal(request,'/api/analytics/offernet/source-observability?clientId=synthetic-a');
    assert.equal(app.find('.cx-readiness-badge','Source readable').dataset.tone,'observed');
    app.w.__fixture.fail=['source-observability'];
    await app.click('button','Recheck source evidence');
    await app.wait(()=>app.w.document.body.textContent.includes('Source evidence could not be checked'));
    await app.click('button','Close data status');
    assert.match(app.text(),/Source evidence could not be checked/);
    app.w.__fixture.fail=[];
    await app.click('button','Data status');
    await app.click('button','Recheck source evidence');
    await app.wait(()=>app.w.document.body.textContent.includes('Source readable'));
    await app.click('button','Close data status');
    assert.ok(!app.text().includes('Source evidence could not be checked'));
  }finally{app.close();}
});

test('About combines purpose, missing values and unchanged metric lineage without requests',async()=>{
  const app=await mount('/overview'+scope);try{
    await app.wait(()=>app.find('button','About this analysis'));
    const before=app.w.__fixture.requests.length;
    await app.click('summary','More actions');
    const trigger=await app.click('button','About this analysis');
    assert.match(app.w.document.body.textContent,/What am I looking at\?/);
    assert.match(app.w.document.body.textContent,/How to interpret missing values/);
    await app.click('button','Metric definitions');
    await app.wait(()=>app.find('[role="dialog"]','Metric lineage'));
    app.find('.cx-analysis-help').dispatchEvent(new app.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    await app.wait(()=>!app.find('[role="dialog"]'));
    app.find('.cx-analysis-help').dispatchEvent(new app.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    await app.wait(()=>!app.find('.cx-analysis-help-panel'));
    assert.equal(app.w.document.activeElement,trigger);
    assert.equal(app.w.__fixture.requests.length,before);
  }finally{app.close();}
});

test('Clear segments retains dates; Reset all clears dates and segment filters',async()=>{
  const app=await mount('/speed-to-lead'+scope+'&vendor=Synthetic+vendor&source=synthetic-source');try{
    await app.wait(()=>app.find('button','Filters (2)'));
    await app.click('button','Change');
    await app.click('button','Filters (2)');
    await app.click('button','Clear segments');
    await app.wait(()=>!new URL(app.w.__fixture.location,'https://synthetic.invalid').searchParams.has('vendor'));
    let params=new URL(app.w.__fixture.location,'https://synthetic.invalid').searchParams;
    assert.equal(params.get('startDate'),'2026-09-28');assert.equal(params.get('endDate'),'2026-09-28');assert.equal(params.get('source'),null);
    await app.click('button','Reset all');
    params=new URL(app.w.__fixture.location,'https://synthetic.invalid').searchParams;
    assert.equal(params.get('startDate'),null);assert.equal(params.get('endDate'),null);assert.equal(params.get('vendor'),null);assert.equal(params.get('source'),null);
  }finally{app.close();}
});

test('desktop source inspector retains every field and duplicate record without a request',async()=>{
  const app=await mount('/lead-ledger'+scope);try{
    await app.wait(()=>app.find('.cx-source-evidence-master-detail'));
    const before=app.w.__fixture.requests.length;
    await app.click('.cx-source-evidence-master-detail button','Inspect source lead SYNTHETIC-LEAD-0001');
    await app.click('.cx-lead-dossier summary','View all 63 raw source fields');
    const records=[...app.w.document.querySelectorAll('.cx-lead-dossier .cx-ledger-raw-record')];
    assert.equal(records.length,2);
    for(const record of records as any[]){
      const fields=[...record.querySelectorAll('[data-raw-field]')] as any[];
      assert.equal(fields.length,63);assert.deepEqual(fields.map(f=>f.querySelector('dt').textContent).sort(),[...LEDGER_HEADERS].sort());
      const value=(header:string)=>fields.find(f=>f.querySelector('dt').textContent===header).querySelector('dd').textContent;
      assert.equal(value('HLC Revenue Generated'),'1234567890.123456789');assert.equal(value('HLC Total Calls'),'0');assert.equal(value('HLC RPC'),'Not recorded');
    }
    await app.click('.cx-source-evidence-master-detail button','Inspect source lead SYNTHETIC-LEAD-0002');
    assert.equal(app.w.__fixture.requests.length,before);
    assert.ok(!app.find('.cx-lead-dossier').textContent.includes('1234567890.123456789'));
  }finally{app.close();}
});

test('desktop source selection clears on page and scope round trips; switching views retains scope',async()=>{
  const app=await mount('/lead-ledger'+scope+'&vendor=Synthetic+vendor',{sourceLeadCount:26});try{
    await app.wait(()=>app.find('.cx-source-evidence-master-detail'));
    await app.click('.cx-source-evidence-master-detail button','Inspect source lead SYNTHETIC-LEAD-0001');
    await app.click('button','Next');
    await app.wait(()=>app.text().includes('Page 2'));
    assert.equal(app.w.document.querySelectorAll('tr[data-selected="true"]').length,0);
    await app.click('button','Previous');await app.wait(()=>app.text().includes('Page 1'));
    assert.equal(app.w.document.querySelectorAll('tr[data-selected="true"]').length,0);
    const originalScope=new URL(app.w.__fixture.location,'https://synthetic.invalid').searchParams;
    await app.click('[role="tab"]','Population');await app.wait(()=>app.find('input','Search lead records'));
    assert.equal(new URL(app.w.__fixture.location,'https://synthetic.invalid').searchParams.get('view'),'population');
    await app.click('[role="tab"]','Source Evidence');await app.wait(()=>app.find('.cx-source-evidence-master-detail'));
    const current=new URL(app.w.__fixture.location,'https://synthetic.invalid').searchParams;
    assert.equal(current.get('view'),'source');
    for(const key of ['clientId','startDate','endDate','vendor'])assert.equal(current.get(key),originalScope.get(key));
    assert.equal(app.w.document.querySelectorAll('tr[data-selected="true"]').length,0);
    assert.equal(app.w.__fixture.requests.filter((r:string)=>r.includes('source-observability')).length,0);
  }finally{app.close();}
});

test('active non-admin sees no admin-only entry in sidebar, analyses or intent search',async()=>{
  const app=await mount('/overview'+scope,{nonAdmin:true});try{
    assert.equal(app.find('a','Access control'),undefined);
    await app.w.__fixture.navigate('/investigate'+scope);
    await app.wait(()=>app.find('.cx-area-nav'));
    assert.equal(app.find('.cx-area-nav a','Lead Evidence'),undefined);
    assert.equal(app.find('.cx-sidebar-admin-tools'),undefined);
    await app.click('button','Search workspaces');
    const input=app.find('input','Search pages and navigation');await app.input(input,'Lead ledger');
    assert.equal(app.find('[role="option"]','Lead ledger'),undefined);
    await app.input(input,'Access control');assert.equal(app.find('[role="option"]','Access control'),undefined);
  }finally{app.close();}
});


test('source About uses original fetched-cohort evidence, separate from analytical metric lineage',async()=>{
  const app=await mount('/lead-ledger'+scope);try{
    await app.wait(()=>app.find('.cx-ledger-source-table'));
    await app.click('summary','More actions');
    await app.click('button','About this analysis');
    const about=app.find('.cx-analysis-help-panel');
    assert.match(about.textContent,/Original lead\/vendor source records/);
    assert.match(about.textContent,/Fetched date selects the cohort/);
    assert.match(about.textContent,/Naive timestamps are UTC/);
    assert.match(about.textContent,/Normalised metric definitions and lineage.*Population/);
    assert.equal(app.find('button','Metric definitions'),undefined);
    assert.equal(app.w.document.querySelectorAll('select').length>0,true);
    assert.ok(app.find('label','Source dataset'));
  }finally{app.close();}
});

test('unavailable routing sequence warning remains visible without opening About',async()=>{
  const tenant=Object.keys(FLAT_LEAD_TENANT_TABLES)[0];
  const app=await mount('/routing?clientId='+tenant);try{
    await app.wait(()=>app.text().includes('This source cannot establish a routing sequence'));
    assert.equal(app.find('.cx-analysis-help-panel'),undefined);
    assert.ok(app.find('aside','Source data limitations'));
  }finally{app.close();}
});

test('Data status closes when following its existing data-integrity link',async()=>{
  const app=await mount('/overview'+scope);try{
    await app.wait(()=>app.find('button','Data status'));
    await app.click('button','Data status');
    await app.wait(()=>app.find('a','Inspect data evidence'));
    await app.click('a','Inspect data evidence');
    await app.wait(()=>app.w.__fixture.location.startsWith('/data-integrity'));
    assert.equal(app.find('[role="dialog"]'),undefined);
  }finally{app.close();}
});


const complexAuditFilters = {vendor:{operator:'in',values:['Synthetic vendor','Other vendor']},source:{operator:'equals',value:'synthetic-source'},grade:{operator:'between',min:1,max:3}};
const auditContent = {type:'metric',metricId:'sales_per_fetched_rate',title:'Supplied rate',value:'35.7%',numeratorCount:570,denominatorCount:1597,scope:{clientId:'synthetic-a',clientLabel:'Synthetic workspace',startDate:'2026-09-22',endDate:'2026-09-28',filters:complexAuditFilters}};

test('universal audit renders exact components, all scope, progressive sections and reproducible copied link without requests',async()=>{
  const app=await mount('/__fixture/audit'+scope+'&workspace=alpha&workspace=beta',{auditContent});try{
    await app.wait(()=>app.find('.cx-audit-drawer'));
    const drawer=app.find('.cx-audit-drawer');
    assert.deepEqual(Array.from(drawer.querySelectorAll('.cx-audit-disclosure > summary'),(e:any)=>e.textContent),['How this is calculated','Reporting scope & filters','Data provenance','Metric definition & technical details']);
    assert.equal(drawer.querySelectorAll('.cx-audit-disclosure[open]').length,0);
    assert.ok(drawer.querySelector('#audit-metric-definition'));
    await app.click('summary','How this is calculated');
    await app.click('summary','Reporting scope & filters');
    assert.equal(drawer.querySelector('.cx-audit-result strong').textContent,'35.7%');
    assert.deepEqual(Array.from(drawer.querySelectorAll('.cx-audit-calculation dd'),(e:any)=>e.textContent),['570','1,597']);
    assert.match(drawer.textContent,/Synthetic workspace.*synthetic-a.*2026-09-22 → 2026-09-28/);
    assert.match(drawer.textContent,/in: Synthetic vendor, Other vendor/);
    assert.match(drawer.textContent,/between: 1 → 3/);
    assert.match(drawer.textContent,/Not verified \(NOT_VERIFIED\)/);
    assert.match(drawer.textContent,/Additional source provenance is not supplied/);
    assert.match(drawer.textContent,/Record-level evidence is not available for this aggregate/);
    assert.equal(app.find('a','Inspect supporting records'),undefined);
    assert.match(drawer.textContent,/Operational analytics are separate from immutable published reporting releases/);
    assert.equal(new URL(app.find('a','View evidence releases').href).pathname,'/reports');
    assert.equal(drawer.querySelector('dd[data-validation="PASS"]'),null);
    assert.equal(Array.from(drawer.querySelectorAll('dt'),(e:any)=>e.textContent).includes('Query job ID'),false);
    const before=app.w.__fixture.requests.length;const copied:string[]=[];
    Object.defineProperty(app.w.navigator,'clipboard',{value:{writeText:async(value:string)=>copied.push(value)},configurable:true});
    await app.click('button','Copy scoped link');
    await app.wait(()=>app.find('[role="status"]','Copied'));
    const target=new URL(copied[0]);assert.equal(target.pathname,'/__fixture/audit');
    assert.equal(target.searchParams.get('clientId'),'synthetic-a');assert.equal(target.searchParams.get('startDate'),'2026-09-22');assert.equal(target.searchParams.get('endDate'),'2026-09-28');
    assert.deepEqual(target.searchParams.getAll('workspace'),['alpha','beta']);assert.deepEqual(JSON.parse(target.searchParams.get('filters')!),complexAuditFilters);assert.equal(target.searchParams.has('search'),false);
    await app.click('summary','Metric definition & technical details');
    assert.equal(app.w.__fixture.requests.length,before);
    assert.deepEqual(app.errors,[]);
  }finally{app.close();}
});

test('audit null and measured zero remain distinct; record drill respects admin permission and supported scope',async()=>{
  for(const [value,expected,state] of [[null,'—','Unavailable'],[0,'0','Measured zero'],['ZAR 0.00','ZAR 0.00','Measured zero'],['','—','Unavailable']] as const){
    const app=await mount('/__fixture/audit'+scope+'&workspace=alpha',{auditContent:{...auditContent,value,recordDrill:{drill:'funnel-stage',drillValue:'sales'}}});try{
      await app.wait(()=>app.find('.cx-audit-drawer'));
      assert.equal(app.find('.cx-audit-result strong').textContent,expected);assert.match(app.find('.cx-audit-result').textContent,new RegExp(state));
      const link=new URL(app.find('a','Inspect supporting records').href);assert.equal(link.pathname,'/lead-explorer');assert.equal(link.searchParams.get('drillValue'),'sales');assert.equal(link.searchParams.get('workspace'),'alpha');assert.deepEqual(JSON.parse(link.searchParams.get('filters')!),complexAuditFilters);
    }finally{app.close();}
  }
  const viewer=await mount('/__fixture/audit'+scope,{nonAdmin:true,auditContent:{...auditContent,recordDrill:{drill:'funnel-stage',drillValue:'sales'}}});try{
    await viewer.wait(()=>viewer.find('.cx-audit-drawer'));assert.equal(viewer.find('a','Inspect supporting records'),undefined);assert.match(viewer.text(),/require administrator access/);assert.equal(viewer.w.__fixture.requests.some((r:string)=>r.includes('raw-leads')),false);
  }finally{viewer.close();}
});

test('Audit mode is local, safe for viewers, and adds no analytical requests across drawer and definition actions',async()=>{
  const app=await mount('/overview'+scope,{nonAdmin:true});try{
    await app.wait(()=>app.find('.cx-outcome-strip'));
    const before=app.w.__fixture.requests.length;
    await app.click('button','Display preferences');
    await app.click('[aria-label="Audit mode"] button','On');
    await app.wait(()=>app.find('.cx-audit-metadata'));
    assert.equal(app.w.localStorage.getItem('cx.presentation.audit-mode.v1'),'on');
    assert.match(app.find('.cx-audit-metadata').textContent,/fetched_leads.*NOT_VERIFIED/);
    assert.equal(app.find('a[href*="lead-ledger"]'),undefined);
    assert.doesNotMatch(Array.from(app.w.document.querySelectorAll('.cx-audit-metadata'),(e:any)=>e.textContent).join(' '),/SELECT |FROM |queryJob|@|SYNTHETIC-LEAD/);
    await app.click('button','Display preferences');
    await app.click('.cx-outcome-card .cx-audit-evidence-control','Audit evidence');
    await app.wait(()=>app.find('.cx-audit-drawer'));
    assert.equal(app.find('a','Inspect supporting records'),undefined);
    await app.click('summary','Metric definition & technical details');
    await app.click('button','Close inspector');
    assert.equal(app.w.__fixture.requests.length,before);
    assert.equal(app.w.__fixture.requests.filter((r:string)=>r.includes('root-cause')).length,0);
    assert.deepEqual(app.errors,[]);
  }finally{app.close();}
});

test('Contact audits supplied bucket ratios and exact high-attempt predicate without unsupported Why mappings',async()=>{
  const data={attemptPerformance:[],attemptCadence:[],summary:{totalLeads:100,dialledLeads:40,unrecordedCallLeads:10,zeroCallLeads:20,oneCallLeads:50,singleAttemptSharePct:125,multiAttemptLeads:20,multiAttemptSharePct:50,fivePlusCallLeads:8,fivePlusNoRpcLeads:3},methodology:'Exclusive recorded call-count buckets; missing counters remain Unrecorded. One-call share uses dialled leads as its denominator.',noAnswerAnalysis:{status:'UNAVAILABLE',reason:'No sequence evidence'}};
  const app=await mount('/contact-strategy'+scope,{payloads:{'/api/analytics/offernet/contact-strategy':data}});try{
    await app.wait(()=>app.find('summary','View exact call-effort evidence'));
    await app.click('summary','View exact call-effort evidence');
    await app.wait(()=>app.find('button','Audit evidence: One-call share'));
    const before=app.w.__fixture.requests.length;
    assert.equal(app.find('button','Why changed?'),undefined);
    await app.click('button','Audit evidence: One-call share');
    assert.equal(app.find('.cx-audit-result strong').textContent,'125.0%');
    assert.deepEqual(Array.from(app.w.document.querySelectorAll('.cx-audit-calculation dd'),(e:any)=>e.textContent),['50','40']);
    assert.doesNotMatch(app.find('.cx-audit-drawer').textContent,/one_call_dialled_share/);
    assert.equal(new URL(app.find('a','Inspect supporting records').href).searchParams.get('drillValue'),'1 call');
    await app.click('button','Close inspector');
    await app.click('button','Inspect evidence: 5+ calls, no RPC');
    assert.equal(app.find('.cx-audit-result strong').textContent,'3');
    assert.equal(new URL(app.find('a','Inspect supporting records').href).searchParams.get('drill'),'high-attempt-no-rpc');
    await app.click('button','Close inspector');
    await app.click('button','Inspect evidence: Multi-call share');
    assert.equal(app.find('a','Inspect supporting records'),undefined);
    assert.match(app.find('.cx-audit-drawer').textContent,/combined two-or-more-call record drill is not supplied/);
    assert.equal(app.w.__fixture.requests.length,before);
  }finally{app.close();}
});

test('reduction: Audit Mode off hides metadata, whole-card evidence opens, and all disclosures are request-free',async()=>{
  const app=await mount('/overview'+scope);try{
    await app.wait(()=>app.find('.cx-outcome-strip'));
    const before=[...app.w.__fixture.requests];
    assert.equal(app.w.document.querySelectorAll('.cx-audit-metadata').length,0);
    assert.equal(app.w.document.querySelectorAll('.cx-outcome-card .cx-metric-primary').length,6);
    assert.equal(app.w.document.querySelectorAll('.cx-outcome-card .cx-audit-evidence-control').length,6);
    const trigger=await app.click('.cx-outcome-card .cx-metric-primary');
    assert.ok(app.find('.cx-audit-support a','Inspect supporting records'));
    assert.equal(app.w.document.querySelectorAll('.cx-audit-disclosure[open]').length,0);
    for(const disclosure of app.w.document.querySelectorAll('.cx-audit-disclosure > summary'))(disclosure as any).click();
    await app.click('button','Close inspector');assert.equal(app.w.document.activeElement,trigger);
    await app.click('button','Display preferences');await app.click('[aria-label="Audit mode"] button','On');
    assert.equal(app.w.document.querySelectorAll('.cx-outcome-strip .cx-audit-metadata').length,6);
    assert.equal(app.w.document.querySelectorAll('.cx-audit-metadata').length,8); // Six metric definitions, supplied response context, and the scoped concentration audit.
    assert.ok(app.find('button', 'Audit evidence: Fetched lead concentration by vendor'));
    await app.click('button','Display preferences');await app.click('.cx-outcome-card .cx-metric-primary');
    assert.equal(app.w.document.querySelectorAll('.cx-audit-disclosure[open]').length,4);
    await app.click('button','Close inspector');await app.click('button','Display preferences');await app.click('[aria-label="Audit mode"] button','Off');
    assert.equal(app.w.document.querySelectorAll('.cx-audit-metadata').length,0);
    assert.deepEqual([...app.w.__fixture.requests],before);
  }finally{app.close();}
});

test('reduction: scope summary reveals exact existing editor without requests or URL mutation',async()=>{
  const app=await mount('/overview'+scope+'&vendor=Synthetic+vendor&source=synthetic-source');try{
    await app.wait(()=>app.find('.cx-outcome-strip')&&app.w.__fixture.requests.some((url:string)=>url.includes('filter-options')));
    const before=[...app.w.__fixture.requests],url=app.w.__fixture.location;
    assert.equal(app.find('.cx-scope-editable').hidden,true);
    assert.match(app.find('.cx-scope-summary').textContent,/Synthetic vendor.*synthetic-source/);
    await app.click('.cx-scope-toggle');assert.equal(app.find('.cx-scope-editable').hidden,false);
    await app.click('button','Filters (');await app.input(app.find('input','Start date'),'2026-09-27');
    assert.deepEqual([...app.w.__fixture.requests],before);assert.equal(app.w.__fixture.location,url);
    await app.click('button','Apply dates');
    await app.wait(()=>app.w.__fixture.requests.some((url:string)=>url.includes('/overview?')&&url.includes('startDate=2026-09-27')));
    const added=app.w.__fixture.requests.slice(before.length);
    assert.equal(added.filter((url:string)=>url.includes('/overview?')).length,1);
    assert.equal(added.filter((url:string)=>url.includes('filter-options')).length,1);
    const query=new URL(app.w.__fixture.location,'https://synthetic.invalid').searchParams;
    assert.equal(query.get('startDate'),'2026-09-27');assert.ok(query.get('vendor') === 'Synthetic vendor' || (query.get('filters') || '').includes('Synthetic vendor'));
    const after=[...app.w.__fixture.requests];await app.click('.cx-scope-toggle');assert.equal(app.find('.cx-scope-editable').hidden,true);assert.deepEqual([...app.w.__fixture.requests],after);
  }finally{app.close();}
});

for(const [route,labels,first] of [
  ['/commercial',['Summary','Attribution','Economics','Evidence'],'Summary'],
  ['/data-integrity',['Overview','Integrity','Source evidence','Metric evidence','Reconciliation','Definitions','Diagnostics'],'Overview'],
] as const)test(`reduction: ${route} presentation sections retain scope and cause zero new requests`,async()=>{
  const app=await mount(route+scope,{payloads:reductionPayloads});try{
    await app.wait(()=>app.find('[role="tabpanel"] .cx-unified-metric'));
    const requests=[...app.w.__fixture.requests],url=app.w.__fixture.location;
    assert.equal(app.find('[role="tab"][aria-selected="true"]').textContent,first);
    for(const label of labels){await app.click('[role="tab"]',label);const selected=app.find('[role="tab"][aria-selected="true"]');assert.equal(selected.textContent,label);assert.equal(app.w.document.getElementById(selected.getAttribute('aria-controls')).hidden,false);assert.equal(app.w.document.querySelectorAll('[role="tabpanel"]:not([hidden])').length,1);}
    const selected=app.find('[role="tab"][aria-selected="true"]');selected.dispatchEvent(new app.w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));await app.wait(()=>app.find('[role="tab"][aria-selected="true"]').textContent===first);
    assert.equal(app.w.document.activeElement,app.find('[role="tab"][aria-selected="true"]'));
    assert.deepEqual([...app.w.__fixture.requests],requests);assert.equal(app.w.__fixture.location,url);
    assert.deepEqual(app.errors,[]);
  }finally{app.close();}
});

test('reduction: preview restores every loaded attribution row and export includes hidden rows',async()=>{
  const app=await mount('/commercial'+scope,{payloads:reductionPayloads});try{
    await app.wait(()=>app.find('[role="tab"]','Attribution'));await app.click('[role="tab"]','Attribution');
    assert.equal(app.w.document.querySelectorAll('.cx-command-table tbody tr').length,10);
    const before=[...app.w.__fixture.requests];
    await app.click('button','Export analysis');await app.wait(()=>app.blobs.length>0);
    const csv=await new Promise<string>((resolve,reject)=>{const reader=new app.w.FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsText(app.blobs[0]);});
    for(const row of reductionPayloads['/api/analytics/offernet/commercial'].attribution.rows)assert.ok(csv.includes(row.key), csv.slice(0,1000));
    await app.click('button','View all attribution rows');assert.equal(app.w.document.querySelectorAll('.cx-command-table tbody tr').length,14);
    await app.click('button','Show fewer attribution rows');assert.equal(app.w.document.querySelectorAll('.cx-command-table tbody tr').length,10);
    assert.deepEqual([...app.w.__fixture.requests],before);
  }finally{app.close();}
});

test('reduction: integrity overview separates gap checks and limitations, preserves zero and full evidence',async()=>{
  const app=await mount('/data-integrity'+scope,{payloads:reductionPayloads});try{
    await app.wait(()=>app.find('.cx-integrity-summary'));
    const priorities=app.find('[role="tabpanel"]:not([hidden]) #integrity-comparison');
    assert.match(priorities.querySelector('.cx-evidence-bars').textContent,/Synthetic check 1.*7/);
    assert.equal(priorities.querySelector('.cx-trust-big-number').textContent,'7');
    assert.match(app.find('.cx-integrity-attention').textContent,/Missing source contract/);
    assert.ok(app.find('[role="tabpanel"]:not([hidden]) .cx-evidence-matrix'));
    assert.equal(app.find('[role="tabpanel"]:not([hidden]) .cx-source-evidence-table'),undefined);
    const before=[...app.w.__fixture.requests];await app.click('[role="tab"]','Integrity');
    assert.equal(app.w.document.querySelectorAll('#measured-discrepancies tbody tr').length,10);
    await app.click('button','View all measured discrepancies');assert.equal(app.w.document.querySelectorAll('#measured-discrepancies tbody tr').length,13);
    await app.click('#evidence-limitations button','Inspect evidence for Synthetic check 14');
    assert.equal(app.find('.cx-audit-result strong').textContent,'—');
    assert.match(app.find('.cx-audit-limitations').textContent,/overlap/);
    await app.click('button','Close inspector');await app.click('#measured-discrepancies button','Inspect evidence for Synthetic check 2');assert.equal(app.find('.cx-audit-result strong').textContent,'0');
    assert.deepEqual([...app.w.__fixture.requests],before);
  }finally{app.close();}
});

test('reduction: empty command palette suggests six core areas, typing searches the full allowed catalogue',async()=>{
  const app=await mount('/overview'+scope,{nonAdmin:true});try{
    await app.wait(()=>app.find('.cx-outcome-strip'));const before=[...app.w.__fixture.requests];
    await app.click('button','Search workspaces');await app.wait(()=>app.find('[role="combobox"]'));
    assert.equal(app.w.document.querySelectorAll('[role="option"]').length,6);
    for (const option of app.w.document.querySelectorAll('[role="option"]')) {
      assert.ok(option.querySelector('small')?.textContent, 'Suggestions retain their descriptive text');
      assert.ok(option.querySelector('.sr-only')?.textContent, 'Section context remains available to assistive technology');
    }
    const input=app.find('[role="combobox"]');await app.input(input,'visual');
    assert.ok(app.find('[role="option"]','Visual workspace'));
    await app.input(input,'lead ledger');assert.equal(app.w.document.querySelectorAll('[role="option"]').length,0);
    await app.input(input,'cohort');assert.ok(app.find('[role="option"]','Cohort'));
    await app.input(input,'visual');input.dispatchEvent(new app.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    await app.wait(()=>app.w.__fixture.location.startsWith('/visuals'));assert.ok(app.find('main h1'));assert.deepEqual([...app.w.__fixture.requests],before);
  }finally{app.close();}
});

test('reduction: ledger compact snapshot exposes supplied technical details with no request',async()=>{
  const app=await mount('/lead-ledger'+scope);try{
    await app.wait(()=>app.find('.cx-ledger-snapshot'));const before=[...app.w.__fixture.requests];
    const snapshot=app.find('.cx-ledger-snapshot');assert.equal(snapshot.querySelector('details').open,false);assert.match(snapshot.querySelector('.cx-ledger-snapshot-summary').textContent,/2026-09-28.*Fetched cohort.*Not verified/);
    await app.click('.cx-ledger-snapshot summary');assert.equal(snapshot.querySelector('details').open,true);assert.match(snapshot.textContent,/Generated at.*2026-09-30T06:00:00Z.*synthetic source.*Report version/);assert.deepEqual([...app.w.__fixture.requests],before);
  }finally{app.close();}
});

test('reduction: Commercial Why changed requires returned comparison, eligible scope and an available value',async()=>{
  for(const [extra,payload,expected] of [
    ['',reductionPayloads['/api/analytics/offernet/commercial'],2],
    ['&vendor=Synthetic+vendor',reductionPayloads['/api/analytics/offernet/commercial'],0],
    ['',{...reductionPayloads['/api/analytics/offernet/commercial'],mediaComparison:null},0],
  ] as const){
    const app=await mount('/commercial'+scope+extra,{payloads:{'/api/analytics/offernet/commercial':payload}});try{
      await app.wait(()=>app.find('.cx-telemetry-rail .cx-unified-metric'));
      assert.equal(app.w.document.querySelectorAll('[role="tabpanel"]:not([hidden]) .cx-why-btn').length,expected);
      assert.equal(app.w.__fixture.requests.some((url:string)=>url.includes('root-cause')),false);
    }finally{app.close();}
  }
});


test('visual catalogue controls never turn missing analytics into chart values',async()=>{
  const app=await mount('/visuals'+scope);try{
    await app.wait(()=>app.text().includes('No analytical dataset is connected'));
    assert.match(app.text(),/No plottable values/);
    assert.doesNotMatch(app.text(),/Verified Sales|Range:|Selected Point/);
    assert.equal(app.find('.cx-viz-canvas'),undefined);
    const before=[...app.w.__fixture.requests];
    const select=app.find('select','Catalogue measure');
    assert.ok(select);
    select.value='sales';select.dispatchEvent(new app.w.Event('change',{bubbles:true}));
    for(const kind of ['bar','line','area','donut','column']){
      await app.click('button',kind);
      assert.equal(app.find('button',kind).getAttribute('aria-pressed'),'true');
      assert.match(app.text(),/No plottable values/);
      assert.equal(app.find('.cx-viz-canvas'),undefined);
    }
    assert.equal(select.value,'sales');
    assert.deepEqual([...app.w.__fixture.requests],before,'Presentation controls cannot fetch or fabricate analytical data');
  }finally{app.close();}
});

for (const route of ['/overview','/funnel','/campaigns','/vetting','/routing','/contact-strategy','/speed-to-lead','/sales-activation','/commercial','/data-integrity','/agent-performance','/temporal','/cli-performance','/cohorts','/offershop-flow','/consumers','/lead-ledger','/lead-explorer','/investigate']) {
  test(`convergence: ${route} renders its canonical title before reporting scope`, async () => {
    const app = await mount(route + scope, { payloads: { ...reductionPayloads, ...(route === '/temporal' ? { '/api/analytics/offernet/temporal': { heatmap: [], peakWindows: [], timeBases: [] } } : {}) } });
    try {
      await app.wait(() => app.find('main h1') && app.find('.cx-analytics-page .cx-scopebar'));
      const title = app.find('main h1');
      const scopeBar = app.find('.cx-analytics-page .cx-scopebar');
      assert.equal(title.textContent, ({ '/funnel': 'Journey', '/commercial': 'Commercial', '/data-integrity': 'Evidence' } as Record<string,string>)[route] || getRouteItem(route)?.name);
      assert.ok(title.compareDocumentPosition(scopeBar) & app.w.Node.DOCUMENT_POSITION_FOLLOWING);
      assert.equal(app.w.document.querySelectorAll('main h1').length, 1);
      assert.equal(app.find('.cx-viz-jump-nav, .cx-analysis-jump-nav'), undefined);
      if (['/overview', '/funnel', '/commercial'].includes(route)) {
        await app.wait(() => app.find('header .cx-report-status-slot .cx-readiness'));
        assert.equal(app.w.document.querySelectorAll('.cx-data-status-trigger').length, 1, 'The existing status control has one header home');
        assert.equal(app.find('.cx-report-status-fallback'), undefined, 'Status does not add a second row above the workspace title');
        assert.equal(app.w.__fixture.requests.filter((url: string) => url.includes('source-observability')).length, 0, 'Moving the control preserves lazy source checks');
      }
      if (route === '/lead-ledger') {
        assert.ok(scopeBar.compareDocumentPosition(app.find('.cx-lead-evidence-mode-tabs')) & app.w.Node.DOCUMENT_POSITION_FOLLOWING);
        await app.click('.cx-lead-evidence-mode-tabs button', 'Population');
        await app.wait(() => app.find('.cx-investigation-records'));
        const analyticalTitle = app.find('.cx-analytics-page .cx-page-header h1');
        assert.equal(analyticalTitle.textContent, getRouteItem(route)?.name);
        assert.ok(analyticalTitle.compareDocumentPosition(app.find('.cx-analytics-page .cx-scopebar')) & app.w.Node.DOCUMENT_POSITION_FOLLOWING);
        assert.equal(app.w.document.querySelectorAll('main h1').length, 1);
      }
    } finally { app.close(); }
  });
}

test('convergence: Overview answer hierarchy and local disclosures retain trend state without analytical requests', async () => {
  const app = await mount('/overview' + scope);
  try {
    await app.wait(() => app.find('.cx-outcome-strip') && app.w.__fixture.requests.some((url: string) => url.includes('filter-options')));
    const ordered = ['.cx-outcome-strip', '.cx-overview-primary', '.cx-overview-secondary', '.cx-overview-more'].map(selector => app.find(selector));
    for (let i = 1; i < ordered.length; i++) assert.ok(ordered[i - 1].compareDocumentPosition(ordered[i]) & app.w.Node.DOCUMENT_POSITION_FOLLOWING);
    assert.equal(app.w.document.querySelectorAll('.cx-outcome-card').length, 6);
    assert.match(app.find('.cx-outcome-strip').textContent, /Activations/);
    assert.match(app.find('.cx-overview-response').textContent, /Awaiting first call20.*Waiting over 60 min0/);
    assert.equal(app.find('.cx-overview-response-value').textContent, '—');
    assert.equal(app.find('.cx-overview-lifecycle-disclosure').open, false);
    const requests = [...app.w.__fixture.requests];
    await app.click('.cx-trend-tabs [role="tab"]', 'Recorded sales');
    await app.click('.cx-overview-lifecycle-disclosure > summary');
    await app.click('.cx-overview-stage-count');
    await app.wait(() => app.find('.cx-audit-drawer'));
    await app.click('button', 'Close inspector');
    await app.click('.cx-overview-lifecycle-disclosure > summary');
    await app.click('.cx-overview-lifecycle-disclosure > summary');
    assert.equal(app.find('.cx-trend-tabs [aria-selected="true"]').textContent, 'Recorded sales');
    assert.equal(app.find('.cx-overview-lifecycle-disclosure').open, true);
    assert.deepEqual([...app.w.__fixture.requests], requests);
    assert.equal(requests.filter((url: string) => url.includes('/overview?')).length, 1);
    assert.equal(requests.some((url: string) => /commercial|operating-controls|root-cause/.test(url)), false);
    await app.click('summary', 'Operating controls');
    await app.wait(() => app.w.__fixture.requests.some((url: string) => url.includes('operating-controls')));
    assert.equal(app.w.__fixture.requests.filter((url: string) => url.includes('operating-controls')).length, 1);
    assert.equal(app.w.__fixture.requests.some((url: string) => url.includes('/commercial?')), false);
    await app.click('summary', 'Commercial overview');
    await app.wait(() => app.w.__fixture.requests.some((url: string) => url.includes('/commercial?')));
    assert.equal(app.w.__fixture.requests.filter((url: string) => url.includes('/commercial?')).length, 1);
    assert.equal(app.w.__fixture.requests.filter((url: string) => url.includes('/overview?')).length, 1);
    assert.equal(app.w.__fixture.location, '/overview' + scope);
  } finally { app.close(); }
});

for (const route of ['/consumers', '/vetting']) {
  test(`convergence: ${route} new scope editor defers choices and retains local controls`, async () => {
    const app = await mount(route + scope);
    try {
      await app.wait(() => app.find('.cx-scope-toggle') && app.w.__fixture.requests.some((url: string) => url.startsWith('/api/analytics' + route + '?')));
      if (route === '/consumers') {
        await app.wait(() => app.find('.cx-tab-item', 'Sequential Entry Economics'));
        await app.click('.cx-tab-item', 'Sequential Entry Economics');
      } else {
        const control = app.find('select', 'Vetting comparison measure');
        control.value = 'sales';
        control.dispatchEvent(new app.w.Event('change', { bubbles: true }));
      }
      const existing = [...app.w.__fixture.requests];
      assert.equal(existing.some((url: string) => url.includes('filter-options')), false);
      await app.click('button', 'Refresh current view');
      await app.wait(() => app.w.__fixture.requests.length > existing.length);
      assert.equal(app.w.__fixture.requests.some((url: string) => url.includes('filter-options')), false);
      const beforeEdit = [...app.w.__fixture.requests];
      await app.click('.cx-scope-toggle');
      await app.wait(() => app.w.__fixture.requests.some((url: string) => url.includes('filter-options')));
      assert.equal(app.w.__fixture.requests.filter((url: string) => url.includes('filter-options')).length, 1);
      assert.equal(app.w.__fixture.requests.filter((url: string) => !url.includes('filter-options')).length, beforeEdit.length);
      await app.click('.cx-scope-toggle');
      if (route === '/consumers') assert.equal(app.find('.cx-tab-item[aria-pressed="true"]').textContent, 'Sequential Entry Economics');
      else assert.equal(app.find('select', 'Vetting comparison measure').value, 'sales');
      assert.equal(app.w.__fixture.location, route + scope);
    } finally { app.close(); }
  });
}

test('visual audit supporting preview is an explicit admin action and does not reload on reopening the metric',async()=>{
  const app=await mount('/overview'+scope+'&vendor=Synthetic+vendor');try{
    await app.wait(()=>app.find('.cx-outcome-card .cx-audit-evidence-control'));
    const baseline=[...app.w.__fixture.requests];
    await app.click('.cx-outcome-card .cx-audit-evidence-control');
    assert.deepEqual([...app.w.__fixture.requests],baseline);
    assert.equal(app.find('.cx-audit-record-preview'),undefined);
    await app.click('button','Load supporting preview');
    await app.wait(()=>app.find('[aria-label="Supporting record preview"]'));
    const raw=app.w.__fixture.requests.filter((url:string)=>url.includes('/raw-leads'));
    assert.equal(raw.length,1);
    const query=new URL(raw[0],'https://synthetic.invalid').searchParams;
    assert.equal(query.get('clientId'),'synthetic-a');
    assert.equal(query.get('startDate'),'2026-09-28');
    assert.equal(query.get('endDate'),'2026-09-28');
    assert.deepEqual(JSON.parse(query.get('filters')!).vendor,{operator:'in',values:['Synthetic vendor']});
    assert.equal(query.get('drill'),'funnel-stage');assert.equal(query.get('drillValue'),'fetched');
    assert.equal(query.get('limit'),'10');
    assert.equal(app.w.document.querySelectorAll('.cx-audit-record-preview tbody tr').length<=5,true);
    assert.doesNotMatch(app.find('.cx-audit-record-preview').textContent,/SYNTHETIC-LEAD-/);
    const loaded=[...app.w.__fixture.requests];
    await app.click('button','Close inspector');
    await app.click('.cx-outcome-card .cx-audit-evidence-control');
    assert.equal(app.find('.cx-audit-record-preview'),undefined);
    assert.ok(app.find('button','Load supporting preview'));
    assert.deepEqual([...app.w.__fixture.requests],loaded);
  }finally{app.close();}
  const viewer=await mount('/overview'+scope,{nonAdmin:true});try{
    await viewer.wait(()=>viewer.find('.cx-outcome-card .cx-audit-evidence-control'));
    const baseline=[...viewer.w.__fixture.requests];
    await viewer.click('.cx-outcome-card .cx-audit-evidence-control');
    assert.equal(viewer.find('button','Load supporting preview'),undefined);
    assert.equal(viewer.find('a','Inspect supporting records'),undefined);
    assert.deepEqual([...viewer.w.__fixture.requests],baseline);
  }finally{viewer.close();}
});
test('visual audit private narrowed scope preserves record search locally without a shareable link',async()=>{
  const app=await mount('/__fixture/audit'+scope,{auditContent:{...auditContent,scope:{...auditContent.scope,narrowing:{drill:'awaiting-first-dial',segmentSource:'synthetic-source',search:'PRIVATE-RECORD-SEARCH'}},recordDrill:{drill:'awaiting-first-dial'}}});try{
    await app.wait(()=>app.find('.cx-audit-drawer'));
    const href=new URL(app.find('a','Inspect supporting records').href);
    assert.equal(href.searchParams.get('search'),'PRIVATE-RECORD-SEARCH');
    assert.equal(href.searchParams.get('segmentSource'),'synthetic-source');
    assert.equal(app.find('button','Copy scoped link'),undefined);
    assert.doesNotMatch(app.find('.cx-audit-drawer').textContent,/https:\/\/.*PRIVATE-RECORD-SEARCH/);
    assert.match(app.find('.cx-audit-drawer').textContent,/cannot be copied as a shareable link/);
  }finally{app.close();}
});
