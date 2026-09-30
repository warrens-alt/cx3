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
  Object.assign(w,{Response,Request,Headers,AbortController,TextEncoder,TextDecoder,ReadableStream,ResizeObserver:class {observe(){}unobserve(){}disconnect(){}},__fixture:{initialRoute:route,...options}});
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
  assert.equal(new URLSearchParams(navigationTarget('/vendors','/overview',query).search).get('startDate'),null);
  assert.equal(new URLSearchParams(navigationTarget('/overview','/reports',query+'&release=r1').search).get('startDate'),null);
});

test('quick navigation opens Lead Ledger by keyboard and retains reporting scope',async()=>{
  const app=await mount('/lead-explorer'+scope+'&workspace=alpha&workspace=beta&drill=old&search=old');try{
    await app.click('button','Find a page');
    await app.wait(()=>app.find('input','Search pages and navigation'));
    const input=app.find('input','Search pages and navigation');
    await app.input(input,'Lead Ledger');
    await app.wait(()=>app.find('[role="option"]','Lead ledger'),'Lead Ledger must appear in quick navigation');
    input.dispatchEvent(new app.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    await app.wait(()=>app.w.__fixture.location.startsWith('/lead-ledger?')&&!!app.find('.cx-ledger-lead'));
    assert.equal(app.find('[role="dialog"]'),undefined);
    const params=new URL(app.w.__fixture.location,'https://synthetic.invalid').searchParams;
    assert.equal(params.get('clientId'),'synthetic-a');
    assert.equal(params.get('startDate'),'2026-09-28');
    assert.equal(params.get('endDate'),'2026-09-28');
    assert.deepEqual(params.getAll('workspace'),['alpha','beta']);
    assert.equal(params.get('drill'),null);
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
    assert.ok([...app.w.document.querySelectorAll('a')].some((a:any)=>a.href.includes('drill=awaiting-first-dial')));
  }finally{app.close();}
});

test('source and analytical Ledger are distinct panels with exact source evidence',async()=>{
  const app=await mount('/lead-ledger'+scope);try{
    await app.wait(()=>app.text().includes('2 leads')||app.find('.cx-ledger-lead'));
    await app.click('.cx-ledger-lead summary');
    await app.wait(()=>app.text().includes('1234567890.123456789'));
    assert.match(app.text(),/repeated|duplicate/i);
    await app.click('button','Operational analysis');
    await app.wait(()=>app.find('input','Search analytical ledger'));
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    assert.ok(!app.find('.cx-ledger-lead'));
    assert.match(app.text(),/Unavailable/);
  }finally{app.close();}
});

test('source Ledger paging and submitted search preserve full filtered summary counts',async()=>{
  const app=await mount('/lead-ledger'+scope,{sourceLeadCount:26});try{
    await app.wait(()=>app.w.document.querySelectorAll('.cx-ledger-lead').length===25);
    assert.match(app.text(),/26 leads in scope/);
    for(const [metric,value] of [['leads','26'],['rows','27'],['lead-only','25'],['exceptions','2']])assert.equal(app.find(`[data-metric="${metric}"] strong`).textContent,value);
    await app.click('button','Next');
    await app.wait(()=>app.w.document.querySelectorAll('.cx-ledger-lead').length===1);
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
    await app.wait(()=>app.find('button','Export all rows · partial fields'));
    assert.equal(app.find('button','Export complete 63-column CSV').disabled,true);
    await app.wait(()=>!app.find('button','Export all rows · partial fields').disabled);
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
    await app.click('button','Inspect roster');
    assert.equal(app.w.__fixture.requests.filter((r:string)=>r.includes('root-cause')).length,0);
  }finally{app.close();}
});

test('root-cause contribution region preserves record links, scope and keyboard focus',async()=>{
  const app=await mount('/__fixture/root-cause'+scope);try{
    await app.wait(()=>app.find('[aria-label="Vendor contribution evidence"]'));
    const region=app.find('[aria-label="Vendor contribution evidence"]');
    assert.equal(region.getAttribute('tabindex'),'0');
    region.focus();assert.equal(app.w.document.activeElement===region,true);
    assert.match(region.textContent,/Contribution.*20 leads/);
    const link=region.querySelector('a');assert.ok(link);
    const target=new URL(link.href);
    assert.equal(target.searchParams.get('vendor'),'Synthetic vendor with a long descriptive name');
    assert.equal(target.searchParams.get('startDate'),'2026-09-28');
  }finally{app.close();}
});

test('analytical Ledger scope changes reset paging across a scope round trip',async()=>{
  const app=await mount('/lead-ledger'+scope);try{
    await app.click('button','Operational analysis');
    await app.wait(()=>app.find('input','Search analytical ledger'));
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    const next=app.w.document.querySelector('button[title="Next Page"]');assert.ok(next);next.click();
    await app.wait(()=>app.w.__fixture.requests.some((r:string)=>r.includes('raw-leads')&&r.includes('offset=50')));
    app.w.__fixture.navigate('/lead-ledger?clientId=synthetic-b&startDate=2026-09-28&endDate=2026-09-28');
    await app.wait(()=>app.w.__fixture.requests.some((r:string)=>r.includes('raw-leads')&&r.includes('clientId=synthetic-b')));
    assert.ok(app.w.__fixture.requests.filter((r:string)=>r.includes('raw-leads')&&r.includes('clientId=synthetic-b')).every((r:string)=>r.includes('offset=0')));
    app.w.__fixture.navigate('/lead-ledger'+scope);
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    assert.equal(app.w.document.querySelectorAll('[role="dialog"]').length,0);
    assert.ok(app.find('button','First page')?.disabled||app.w.document.querySelector('button[title="First Page"]')?.disabled);
  }finally{app.close();}
});

test('analytical search submits exact existing query and shows matched rows',async()=>{
  const app=await mount('/lead-ledger'+scope);try{
    await app.click('button','Operational analysis');await app.wait(()=>app.find('input','Search analytical ledger'));
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    await app.input(app.find('input','Search analytical ledger'),'SYNTHETIC-LEAD-0002');
    app.find('form').dispatchEvent(new app.w.Event('submit',{bubbles:true,cancelable:true}));
    await app.wait(()=>app.w.__fixture.requests.some((r:string)=>r.includes('search=SYNTHETIC-LEAD-0002')));
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0002')&&!app.text().includes('SYNTHETIC-LEAD-0001'));
    assert.match(app.text(),/SYNTHETIC-LEAD-0002/);
    assert.doesNotMatch(app.text(),/SYNTHETIC-LEAD-0001/);
  }finally{app.close();}
});

test('timeline reports missing milestone timestamps and returns keyboard focus',async()=>{
  const app=await mount('/lead-ledger'+scope);try{
    await app.click('button','Operational analysis');await app.wait(()=>app.find('input','Search analytical ledger'));
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    const trigger=await app.click('button[title="Inspect lead timeline"]');
    await app.wait(()=>app.find('[role="dialog"]'));
    await app.wait(()=>app.text().includes('Timestamp unavailable')||app.w.document.body.textContent.includes('Timestamp unavailable'));
    const dialog=app.find('[role="dialog"]');
    assert.match(dialog.textContent,/snapshot milestones/);
    assert.match(dialog.textContent,/total calls not reported/);
    assert.doesNotMatch(dialog.textContent,/undefined total/);
    await app.wait(()=>dialog.contains(app.w.document.activeElement),'Dialog receives initial focus');
    app.w.document.dispatchEvent(new app.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    await app.wait(()=>!app.find('[role="dialog"]'));
    await app.wait(()=>app.w.document.activeElement===trigger,'Focus returns to its trigger');
    assert.equal(app.w.document.activeElement===trigger,true,'Focus returns to its trigger');
  }finally{app.close();}
});

test('request failure is not rendered as an empty analytical ledger',async()=>{
  const app=await mount('/lead-ledger'+scope,{fail:['raw-leads']});try{
    await app.click('button','Operational analysis');
    await app.wait(()=>app.find('[role="alert"]'));
    assert.doesNotMatch(app.text(),/No records match/);
    assert.match(app.text(),/unavailable|could not|failure/i);
  }finally{app.close();}
});

test('explorer distinguishes absent outcomes from explicit false',async()=>{
  const app=await mount('/lead-explorer'+scope);try{
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    const rows=[...app.w.document.querySelectorAll('tbody tr')] as any[];
    assert.match(rows[0].textContent,/Unavailable/);
    assert.match(rows[1].textContent,/No/);
  }finally{app.close();}
});

test('Explorer scope round trips clear the open timeline and reset its page',async()=>{
  const app=await mount('/lead-explorer'+scope);try{
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    await app.click('button','Next');
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0051'));
    await app.click('button[title="Open lead timeline"]');
    await app.wait(()=>app.find('[role="dialog"]'));
    app.w.__fixture.navigate('/lead-explorer?clientId=synthetic-a&startDate=2026-09-27&endDate=2026-09-28');
    await app.wait(()=>!app.find('[role="dialog"]'));
    await app.wait(()=>app.w.__fixture.requests.some((r:string)=>r.includes('raw-leads')&&r.includes('startDate=2026-09-27')));
    assert.ok(app.w.__fixture.requests.filter((r:string)=>r.includes('raw-leads')&&r.includes('startDate=2026-09-27')).every((r:string)=>r.includes('offset=0')));
    assert.equal(app.w.__fixture.requests.some((r:string)=>r.includes('lead-timeline')&&r.includes('startDate=2026-09-27')),false);
    app.w.__fixture.navigate('/lead-explorer'+scope);
    await app.wait(()=>app.w.__fixture.location==='/lead-explorer'+scope);
    await new Promise(r=>setTimeout(r,70));
    assert.equal(Boolean(app.find('[role="dialog"]')),false);
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

test('validation quotes endpoint claims without certification and changes reference panels',async()=>{
  const app=await mount('/validation'+scope);try{
    await app.wait(()=>app.text().includes('Independent validation not established'));
    assert.doesNotMatch(app.text(),/0 Discrepancy|Reconciled:/);
    assert.match(app.text(),/Endpoint timestamp: Not reported/);
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

test('agent chart uses the existing local search handler without another analytical request',async()=>{
  const app=await mount('/agent-performance'+scope);try{
    await app.wait(()=>app.text().includes('Synthetic Agent B'));
    const initial=app.w.__fixture.requests.filter((r:string)=>r.includes('agent-performance')).length;
    await app.click('button','Inspect Synthetic Agent A:');
    await app.wait(()=>!app.text().includes('Synthetic Agent B'));
    assert.equal(app.find('input','Search returned agents or vendors').value,'Synthetic Agent A');
    assert.equal(app.w.__fixture.requests.filter((r:string)=>r.includes('agent-performance')).length,initial);
    await app.input(app.find('input','Search returned agents or vendors'),'');
    await app.wait(()=>app.text().includes('Synthetic Agent B'));
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
    assert.ok(group.querySelector('a[href*="agent-performance"]'));
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
    await app.click('nav[aria-label="Contact centre navigation"] a','Response speed');
    await app.wait(()=>app.w.__fixture.location.startsWith('/speed-to-lead'));
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

test('legacy Lead Engine route identifies its blocked boundary and removes static portfolio cards',async()=>{
  const app=await mount('/lead-engine'+scope);try{
    await app.wait(()=>app.text().includes('Summary metrics unavailable in this legacy view'));
    assert.match(app.w.document.body.textContent,/Legacy reference workspace/);
    assert.doesNotMatch(app.text(),/350,573|91\.4%|64\.2%|4,892,100/);
  }finally{app.close();}
});


test('failed exception evidence cannot claim an empty vendor backlog',async()=>{
  const app=await mount('/exceptions'+scope,{fail:['overview','exceptions']});try{
    await app.wait(()=>app.text().includes('Vendor backlog evidence unavailable.'));
    assert.doesNotMatch(app.text(),/No vendor backlog is currently observed/);
    assert.equal(app.find('button','Why changed?'),undefined);
    assert.ok(app.find('a','Inspect speed'));
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
    await app.wait(()=>app.find('.cx-ledger-master-detail'));
    const before=app.w.__fixture.requests.length;
    await app.click('.cx-ledger-master-detail button','Inspect source lead SYNTHETIC-LEAD-0001');
    await app.click('.cx-ledger-inspector summary','View all 63 raw source fields');
    const records=[...app.w.document.querySelectorAll('.cx-ledger-inspector .cx-ledger-raw-record')];
    assert.equal(records.length,2);
    for(const record of records as any[]){
      const fields=[...record.querySelectorAll('[data-raw-field]')] as any[];
      assert.equal(fields.length,63);assert.deepEqual(fields.map(f=>f.querySelector('dt').textContent).sort(),[...LEDGER_HEADERS].sort());
      const value=(header:string)=>fields.find(f=>f.querySelector('dt').textContent===header).querySelector('dd').textContent;
      assert.equal(value('HLC Revenue Generated'),'1234567890.123456789');assert.equal(value('HLC Total Calls'),'0');assert.equal(value('HLC RPC'),'Not recorded');
    }
    await app.click('.cx-ledger-master-detail button','Inspect source lead SYNTHETIC-LEAD-0002');
    assert.equal(app.w.__fixture.requests.length,before);
    assert.ok(!app.find('.cx-ledger-inspector').textContent.includes('1234567890.123456789'));
  }finally{app.close();}
});

test('desktop source selection clears on page and scope round trips; switching views retains scope',async()=>{
  const app=await mount('/lead-ledger'+scope+'&vendor=Synthetic+vendor',{sourceLeadCount:26});try{
    await app.wait(()=>app.find('.cx-ledger-master-detail'));
    await app.click('.cx-ledger-master-detail button','Inspect source lead SYNTHETIC-LEAD-0001');
    await app.click('button','Next');
    await app.wait(()=>app.text().includes('Page 2'));
    assert.equal(app.w.document.querySelectorAll('tr[data-selected="true"]').length,0);
    await app.click('button','Previous');await app.wait(()=>app.text().includes('Page 1'));
    assert.equal(app.w.document.querySelectorAll('tr[data-selected="true"]').length,0);
    const location=app.w.__fixture.location;
    await app.click('button','Operational analysis');await app.wait(()=>app.find('input','Search analytical ledger'));
    assert.equal(app.w.__fixture.location,location);
    await app.click('button','Source evidence');await app.wait(()=>app.find('.cx-ledger-master-detail'));
    assert.equal(app.w.__fixture.location,location);
    assert.equal(app.w.document.querySelectorAll('tr[data-selected="true"]').length,0);
    assert.equal(app.w.__fixture.requests.filter((r:string)=>r.includes('source-observability')).length,0);
  }finally{app.close();}
});

test('active non-admin sees no admin-only entry in sidebar, analyses or intent search',async()=>{
  const app=await mount('/overview'+scope,{nonAdmin:true});try{
    assert.equal(app.find('a','Access control'),undefined);
    await app.click('button','More analyses');
    assert.equal(app.find('#area-more-menu a','Lead ledger'),undefined);
    await app.click('button','Find a page');
    const input=app.find('input','Search pages and navigation');await app.input(input,'Lead ledger');
    assert.equal(app.find('[role="option"]','Lead ledger'),undefined);
    await app.input(input,'Access control');assert.equal(app.find('[role="option"]','Access control'),undefined);
  }finally{app.close();}
});


test('source About uses original fetched-cohort evidence, separate from analytical metric lineage',async()=>{
  const app=await mount('/lead-ledger'+scope);try{
    await app.wait(()=>app.find('.cx-ledger-browser'));
    await app.click('button','About this analysis');
    const about=app.find('.cx-analysis-help-panel');
    assert.match(about.textContent,/Original lead\/vendor source records/);
    assert.match(about.textContent,/Fetched date selects the cohort/);
    assert.match(about.textContent,/Naive timestamps are UTC/);
    assert.match(about.textContent,/Normalised metric definitions and lineage belong to the separate Operational analysis view/);
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
