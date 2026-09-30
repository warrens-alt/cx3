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
    await app.click('button','Analytical ledger');
    await app.wait(()=>app.find('input','Search analytical ledger'));
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    assert.ok(!app.find('.cx-ledger-lead'));
    assert.match(app.text(),/Unavailable/);
  }finally{app.close();}
});

test('analytical Ledger scope changes reset paging and do not revive an old selection',async()=>{
  const app=await mount('/lead-ledger'+scope);try{
    await app.click('button','Analytical ledger');
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
    await app.click('button','Analytical ledger');await app.wait(()=>app.find('input','Search analytical ledger'));
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    await app.input(app.find('input','Search analytical ledger'),'SYNTHETIC-LEAD-0002');
    app.find('form').dispatchEvent(new app.w.Event('submit',{bubbles:true,cancelable:true}));
    await app.wait(()=>app.w.__fixture.requests.some((r:string)=>r.includes('search=SYNTHETIC-LEAD-0002')));
    await app.wait(()=>!app.text().includes('SYNTHETIC-LEAD-0001'));
    assert.match(app.text(),/SYNTHETIC-LEAD-0002/);
  }finally{app.close();}
});

test('timeline reports missing milestone timestamps and returns keyboard focus',async()=>{
  const app=await mount('/lead-ledger'+scope);try{
    await app.click('button','Analytical ledger');await app.wait(()=>app.find('input','Search analytical ledger'));
    await app.wait(()=>app.text().includes('SYNTHETIC-LEAD-0001'));
    const trigger=await app.click('button[title="Inspect lead timeline"]');
    await app.wait(()=>app.find('[role="dialog"]'));
    await app.wait(()=>app.text().includes('Timestamp unavailable')||app.w.document.body.textContent.includes('Timestamp unavailable'));
    const dialog=app.find('[role="dialog"]');
    assert.match(dialog.textContent,/snapshot milestones/);
    assert.match(dialog.textContent,/total calls not reported/);
    assert.doesNotMatch(dialog.textContent,/undefined total/);
    app.w.document.dispatchEvent(new app.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    await app.wait(()=>!app.find('[role="dialog"]'));
    assert.equal(app.w.document.activeElement,trigger);
  }finally{app.close();}
});

test('request failure is not rendered as an empty analytical ledger',async()=>{
  const app=await mount('/lead-ledger'+scope,{fail:['raw-leads']});try{
    await app.click('button','Analytical ledger');
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

test('More views has native links, Escape closes it and returns focus',async()=>{
  const app=await mount('/speed-to-lead'+scope);try{
    await app.wait(()=>app.text().includes('Median latency by stage'));
    const trigger=await app.click('button','More views');
    await app.wait(()=>app.find('[role="group"]','More views'));
    const group=app.find('[role="group"]','More views');
    assert.ok(group.querySelector('a[href*="agent-performance"]'));
    assert.equal(group.querySelectorAll('[role="menuitem"]').length,0);
    app.w.document.dispatchEvent(new app.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    await app.wait(()=>!app.find('[role="group"]','More views'));
    assert.equal(app.w.document.activeElement,trigger);
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
