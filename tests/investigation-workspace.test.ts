import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { buildAcceptanceFixture } from '../scripts/build-frontend-acceptance-fixture.mjs';
import { clearInvestigationParams, investigationPath, investigationLabel, shareableInvestigationPath, matchesInvestigationResponse } from '../src/features/investigation/investigationModel';

const query='clientId=synthetic-a&startDate=2026-09-01&endDate=2026-09-30&vendor=Vendor+A&drill=awaiting-first-dial&segmentSource=Source+A';
test('clear investigation preserves reporting scope, global filters and independent record search',()=>{
  const params=clearInvestigationParams(new URLSearchParams(query+'&search=private&investigationMetric=fetchedLeads&leadId=private&page=3'));
  assert.equal(params.get('clientId'),'synthetic-a');assert.equal(params.get('vendor'),'Vendor A');assert.equal(params.get('startDate'),'2026-09-01');assert.equal(params.get('search'),'private');
  for(const key of ['drill','drillValue','investigationMetric','segmentSource','leadId','page'])assert.equal(params.has(key),false);
});
test('scoped paths preserve additive narrowing and never encode selected lead IDs',()=>{
  const href=investigationPath('/lead-explorer',new URLSearchParams(query+'&leadId=private'),{segmentGrade:'A'});
  const p=new URL(href,'https://test.invalid').searchParams;
  assert.equal(p.get('drill'),'awaiting-first-dial');assert.equal(p.get('vendor'),'Vendor A');assert.equal(p.get('segmentSource'),'Source A');assert.equal(p.get('segmentGrade'),'A');assert.equal(p.has('leadId'),false);
});
test('copying a link fails closed for private record-search scopes rather than broadening silently',()=>{
  const p=new URLSearchParams(query);assert.match(shareableInvestigationPath('/investigate',p)!,/segmentSource/);
  p.set('search','private');assert.equal(shareableInvestigationPath('/investigate',p),null);p.delete('search');p.set('filters',JSON.stringify({lead_id:{operator:'equals',value:'private'}}));assert.equal(shareableInvestigationPath('/investigate',p),null);
});
test('one shared label source describes supported predicates without evaluating evidence',()=>{
  assert.match(investigationLabel(new URLSearchParams('drill=high-attempt-no-rpc')),/5\+.*RPC/);
  assert.match(investigationLabel(new URLSearchParams('drill=funnel-loss&drillValue=delivered-to-dialled')),/delivered → dialled/);
});
test('AI responses must echo exact client, dates, predicate, narrowing, search and global filters',()=>{
  const filters={vendor:{operator:'in',values:['A','B']}};
  const scope={clientId:'a',startDate:'2026-09-01',endDate:'2026-09-30',drill:'awaiting-first-dial',segmentVendor:'B',search:'x',filters,dateBasis:'intake_cohort',countingGrain:'lead'};
  const query={...scope,filters:JSON.stringify(filters)};
  const data={scope,source:'deterministic',insights:[]};
  assert.equal(matchesInvestigationResponse(data,query),true);
  for(const key of ['clientId','startDate','endDate','drill','segmentVendor','search'])assert.equal(matchesInvestigationResponse({...data,scope:{...scope,[key]:'different'}},query),false,key);
  assert.equal(matchesInvestigationResponse({...data,scope:{...scope,filters:{}}},query),false);
  assert.equal(matchesInvestigationResponse({source:'broader',insights:[]},query),false);
  assert.equal(matchesInvestigationResponse({...data,scope:{...scope,filters:{vendor:{operator:'equals',value:'B'}}}}, {...query,filters:JSON.stringify({partner:{operator:'in',values:[' B ']}})}),true);
  assert.equal(matchesInvestigationResponse({...data,scope:{...scope,metric:'activationRate'}},query),false);
});

const output=await mkdtemp(path.join(tmpdir(),'cx3-investigation-'));
await buildAcceptanceFixture(output);
const script=await readFile(path.join(output,'fixture.js'),'utf8');
test.after(()=>rm(output,{recursive:true,force:true}));
async function mount(route='/lead-explorer?'+query, fixture:Record<string,unknown>={}, waitForRecords=true){
  const errors:string[]=[];const console=new VirtualConsole();console.on('jsdomError',(error:Error)=>{if(!error.message.includes('navigation'))errors.push(error.message)});console.on('error',(...args:unknown[])=>errors.push(args.map(String).join(' ')));
  const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://test.invalid',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console});const w=dom.window as any;
  Object.assign(w,{Response,Request,Headers,AbortController,TextEncoder,TextDecoder,ReadableStream,structuredClone,ResizeObserver:class{observe(){}unobserve(){}disconnect(){}},__fixture:{initialRoute:route,...fixture}});
  w.matchMedia=(q:string)=>({matches:fixture.desktopViewport===true && q==='(min-width: 1180px)',media:q,addEventListener(){},removeEventListener(){}});w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLElement.prototype.scrollTo=()=>{};w.scrollTo=()=>{};
  const wait=async(check:()=>unknown)=>{for(let i=0;i<150;i++){if(check())return;await new Promise(r=>setTimeout(r,20));}throw new Error(w.document.body.textContent?.slice(0,2000)+' '+errors.join(';'));};
  const find=(selector:string,text='')=>[...w.document.querySelectorAll(selector)].find((el:any)=>(el.getAttribute('aria-label')||el.textContent||'').includes(text)) as any;
  w.eval(script);await wait(()=>find(waitForRecords ? 'button' : '[aria-label="Investigation workflow"]',waitForRecords ? 'Open dossier for lead' : ''));
  return {w,find,wait,close(){w.__fixture.unmount();dom.window.close();assert.deepEqual(errors,[])}};
}
test('evidence tray pins preserve scope across routes and clear at workspace boundary',async()=>{
  const a=await mount();try{
    a.find('button','Open dossier for lead').click();await a.wait(()=>a.find('button','Pin lead evidence'));a.find('button','Pin lead evidence').click();await a.wait(()=>a.find('.cx-investigation-tray')?.textContent.includes('1 pinned'));
    assert.match(a.find('.cx-investigation-tray').textContent,/Vendor A/);assert.match(a.find('.cx-investigation-tray').textContent,/Source A/);
    const note=a.find('textarea');
    Object.getOwnPropertyDescriptor(a.w.HTMLTextAreaElement.prototype,'value').set.call(note,'Evidence supports a review, not a causal claim.');
    note.dispatchEvent(new a.w.Event('input',{bubbles:true}));
    await a.wait(()=>a.find('textarea')?.value.includes('Evidence supports'));
    a.w.__fixture.navigate('/data-integrity?'+query);await a.wait(()=>a.find('h1','Evidence'));
    a.w.__fixture.navigate('/lead-explorer?'+query);await a.wait(()=>a.find('.cx-investigation-tray')?.textContent.includes('1 pinned'));
    assert.equal(a.find('textarea').value,'Evidence supports a review, not a causal claim.');
    a.w.__fixture.navigate('/lead-explorer?'+query.replace('synthetic-a','synthetic-b'));await a.wait(()=>a.find('.cx-investigation-tray')?.textContent.includes('0 pinned'));
    assert.equal(a.find('.cx-investigation-tray').textContent.includes('SYNTHETIC-LEAD'),false);
  }finally{a.close()}
});
test('context shows predicate and separate removable narrowing with NOT_VERIFIED evidence',async()=>{
  const a=await mount();try{
    const context=a.find('[aria-label="Investigation context"]');assert.match(context.textContent,/awaiting-first-dial/);assert.match(context.textContent,/NOT_VERIFIED/);
    a.find('button','Remove investigation Source').click();await a.wait(()=>!new URL(a.w.__fixture.location,'https://test.invalid').searchParams.has('segmentSource'));
    const params=new URL(a.w.__fixture.location,'https://test.invalid').searchParams;assert.equal(params.get('drill'),'awaiting-first-dial');assert.equal(params.get('vendor'),'Vendor A');
    a.find('button','Clear investigation').click();await a.wait(()=>!new URL(a.w.__fixture.location,'https://test.invalid').searchParams.has('drill'));assert.equal(new URL(a.w.__fixture.location,'https://test.invalid').searchParams.get('vendor'),'Vendor A');
  }finally{a.close()}
});
test('dossier focus preserves its selected tab and query owners while distinct timeline pins remain distinct',async()=>{
  const app=await mount();try{
    app.w.HTMLElement.prototype.getClientRects=function(){return this.isConnected&&!this.closest('[hidden]')?[new app.w.DOMRect(0,0,100,30)]:[];};
    app.find('button','Open dossier for lead').click();await app.wait(()=>app.find('.cx-lead-dossier'));
    app.find('[role=tab]','Timeline').click();await app.wait(()=>app.find('.cx-journey-spine'));
    const dossier=app.find('.cx-lead-dossier');
    const milestones=[...dossier.querySelectorAll('.cx-journey-forensic-canvas:not([hidden]) .cx-journey-event')] as HTMLButtonElement[];
    assert.ok(milestones.length>=2,'Fixture supplies at least two separate lifecycle milestones');
    for(const milestone of milestones.slice(0,2)){
      milestone.click();await app.wait(()=>app.find('button','Pin timeline event'));
      app.find('button','Pin timeline event').click();
    }
    await app.wait(()=>app.find('#investigation-evidence-tray').textContent.includes('2 pinned observations'));
    const identifiers=[...app.w.document.querySelectorAll('.cx-investigation-pin-list li details')].map((element:any)=>element.textContent.match(/Identifier: ([^ ]+)/)?.[1]);
    assert.equal(new Set(identifiers).size,2,'Pin identity includes the timeline event, so a second milestone does not overwrite the first');
    const before=[...app.w.__fixture.requests];
    const focus=app.find('button','Focus lead dossier');focus.focus();focus.click();
    await app.wait(()=>dossier.getAttribute('role')==='dialog');
    assert.equal(dossier.getAttribute('aria-modal'),'true');
    assert.match(dossier.querySelector('[role=tab][aria-selected=true]').textContent,/Timeline/);
    app.w.document.dispatchEvent(new app.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    await app.wait(()=>!dossier.hasAttribute('role'));
    assert.equal(app.find('.cx-lead-dossier'),dossier);
    assert.equal(app.w.document.activeElement,focus);
    assert.deepEqual([...app.w.__fixture.requests],before,'Focus uses the existing dossier and timeline subtree');
    assert.equal(new URL(app.w.__fixture.location,'https://test.invalid').searchParams.has('leadId'),false);
  }finally{app.close()}
});
test('contextual confidence never certifies an absent delivery source or unknown validation',async()=>{
  const a=await mount();try{await a.wait(()=>a.find('[aria-label="Evidence confidence for this question"]'));
    const content=a.find('[aria-label="Evidence confidence for this question"]').textContent;
    assert.match(content,/NOT_VERIFIED/);assert.match(content,/Delivery evidence/);assert.match(content,/coverage is not supplied/);assert.doesNotMatch(content,/VERIFIED ✓|healthy/i);
  }finally{a.close()}
});

const exceptionPayload = {
  validationStatus:'NOT_VERIFIED', comparison:null, comparisonReason:'No matched period supplied.', populationNote:'Overlapping exception populations.',
  exceptions:[{id:'awaiting-first-dial',title:'Awaiting first dial',detail:'Delivered with no first dial.',count:7,previousCount:null,absoluteChange:null,percentageChange:null,severity:'medium',byVendor:[{name:'Vendor A',count:7}],bySource:[{name:'Source A',count:7}]}],
};
const exceptions = {'/api/analytics/offernet/exceptions':exceptionPayload};
const stage = (app:Awaited<ReturnType<typeof mount>>, name:string) => app.find(`[data-stage="${name}"]`);
function input(app:Awaited<ReturnType<typeof mount>>, element:HTMLInputElement|HTMLTextAreaElement, value:string) {
  const prototype=element.tagName==='TEXTAREA'?app.w.HTMLTextAreaElement.prototype:app.w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(element,value);
  element.dispatchEvent(new app.w.Event('input',{bubbles:true}));
}

test('six-stage workspace uses returned scope and driver values without adding analytical requests',async()=>{
  const app=await mount('/investigate?'+query,{payloads:exceptions},false);try{
    await app.wait(()=>stage(app,'signal')?.textContent.includes('Current 7'));
    assert.deepEqual([...app.w.document.querySelectorAll('[data-stage]')].map((el:any)=>el.dataset.stage),['signal','diagnose','segment','records','evidence','conclusion']);
    const rail=app.find('[aria-label="Investigation workflow"]');
    assert.equal(rail.closest('[aria-label="Investigation context"]').getAttribute('data-compact'),'true');
    for (const link of rail.querySelectorAll('[data-stage]')) {
      const description=app.w.document.getElementById(link.getAttribute('aria-describedby'));
      assert.ok(description?.textContent, 'Every compact step retains an accessible description of its true state');
      assert.equal(description.className,'sr-only');
      assert.equal(link.querySelectorAll('.cx-investigation-stage-title').length,1);
    }
    assert.match(stage(app,'signal').textContent,/previous Unavailable.*change Unavailable.*medium severity/);
    assert.match(stage(app,'segment').textContent,/Source: Source A/);
    assert.equal(stage(app,'segment').getAttribute('aria-current'),'step');
    assert.match(stage(app,'diagnose').textContent,/Vendor.*current concentration/);
    assert.match(stage(app,'records').textContent,/Inspect records to establish availability/);
    assert.match(stage(app,'evidence').textContent,/0 session observations pinned.*NOT_VERIFIED/);
    assert.match(stage(app,'conclusion').textContent,/Conclusion incomplete.*unknowns not yet recorded/);
    assert.match(app.find('.cx-investigation-support-boundary').textContent,/sufficiency has not been established/);
    const requests=app.w.__fixture.requests as string[];
    assert.equal(requests.filter(url=>url.includes('/exceptions?')).length,1,'Header and driver must reuse the queue response');
    assert.equal(requests.filter(url=>/raw-leads|lead-timeline|root-cause|offernet\/overview|operating-controls|ai-insights/.test(url)).length,0);
    assert.equal(requests.filter(url=>url.includes('/data-integrity?')).length,1);
    assert.equal(app.find('.cx-investigation-case-rail').open,false);
    stage(app,'signal').click();await app.wait(()=>app.find('.cx-investigation-case-rail').open);
    stage(app,'diagnose').click();await app.wait(()=>stage(app,'diagnose').getAttribute('aria-current')==='step');
    stage(app,'segment').click();await app.wait(()=>app.w.document.activeElement?.id==='investigation-segment');
    assert.equal(new URL(app.w.__fixture.location,'https://test.invalid').searchParams.get('segmentSource'),'Source A');
    stage(app,'evidence').click();await app.wait(()=>app.find('#investigation-evidence-tray').open);
    const requestCount=requests.length;
    stage(app,'conclusion').click();await app.wait(()=>app.w.document.activeElement?.id==='investigation-conclusion');
    input(app,app.find('textarea'),'A review is needed; source evidence remains incomplete.');
    input(app,app.w.document.querySelectorAll('textarea')[1],'Delivery coverage remains unknown.');
    await app.wait(()=>stage(app,'conclusion').textContent.includes('open questions recorded'));
    assert.match(stage(app,'conclusion').textContent,/Analyst note exists/);
    assert.match(stage(app,'evidence').textContent,/NOT_VERIFIED/);
    assert.equal(requests.length,requestCount,'Stage navigation and notes must not request analytics');
    assert.match(app.find('#investigation-evidence-tray').textContent,/No pinned observations support a conclusion yet/);
  }finally{app.close()}
});

test('evidence disclosure reuses one mounted tray and confidence view while preserving pins, notes and request counts',async()=>{
  const app=await mount('/lead-explorer?'+query,{payloads:exceptions});try{
    const tray=app.find('#investigation-evidence-tray');
    const confidence=app.find('[aria-label="Evidence confidence for this question"]');
    assert.equal(tray.open,false,'Small viewport starts with a disclosure');
    assert.equal(app.w.document.querySelectorAll('#investigation-evidence-tray').length,1);
    assert.equal(app.w.document.querySelectorAll('[aria-label="Evidence confidence for this question"]').length,1);
    assert.equal(confidence.closest('.cx-investigation-evidence-panel'),tray.closest('.cx-investigation-evidence-panel'));
    app.find('button','Open dossier for lead').click();await app.wait(()=>app.find('button','Pin lead evidence'));
    app.find('button','Pin lead evidence').click();await app.wait(()=>stage(app,'evidence').textContent.includes('1 session observation'));
    stage(app,'conclusion').click();await app.wait(()=>tray.open && app.w.document.activeElement?.id==='investigation-conclusion');
    input(app,app.find('textarea'),'Retained analyst note without certification.');
    await app.wait(()=>stage(app,'conclusion').textContent.includes('Analyst note exists'));
    const requests=app.w.__fixture.requests.length;
    tray.open=false;tray.dispatchEvent(new app.w.Event('toggle'));await app.wait(()=>!tray.open);
    tray.open=true;tray.dispatchEvent(new app.w.Event('toggle'));await app.wait(()=>tray.open);
    assert.equal(app.find('#investigation-evidence-tray'),tray);
    assert.equal(app.find('[aria-label="Evidence confidence for this question"]'),confidence);
    assert.equal(app.find('textarea').value,'Retained analyst note without certification.');
    assert.match(tray.textContent,/1 pinned observation/);
    assert.equal(app.w.__fixture.requests.length,requests,'Collapsing presentation must not remount query-owning children');
    assert.equal(app.w.document.querySelector('[aria-label="Investigation sections"]'),null);
  }finally{app.close()}
});

test('large-desktop evidence rail starts expanded with exactly one evidence state and source query',async()=>{
  const app=await mount('/investigate?'+query,{payloads:exceptions,desktopViewport:true},false);try{
    await app.wait(()=>stage(app,'signal').textContent.includes('Current 7'));
    assert.equal(app.find('#investigation-evidence-tray').open,true);
    assert.equal(app.w.document.querySelectorAll('.cx-investigation-evidence-workspace').length,1);
    assert.equal(app.w.document.querySelectorAll('#investigation-conclusion').length,1);
    assert.equal(app.w.__fixture.requests.filter((url:string)=>url.includes('/data-integrity?')).length,1);
    assert.equal(app.find('.cx-investigation-definition').open,false,'Detailed provenance is progressively disclosed');
    assert.equal(app.find('.cx-investigation-case-rail').open,true);
    assert.match(app.find('[aria-label="Active signal"]').textContent,/Awaiting first dial.*7 affected leads.*NOT_VERIFIED/);
    assert.equal(app.w.document.querySelectorAll('[aria-label="Signals and case context"]').length,1);
    assert.equal(app.w.document.querySelectorAll('.cx-investigation-comparison').length,1);
    assert.equal(app.find('[data-period=previous] .cx-investigation-comparison-track i'),undefined);
    assert.match(app.find('.cx-investigation-summary-status').textContent,/NOT_VERIFIED/);
    app.find('.cx-investigation-definition').open=true;
    app.find('button','Change scope').click();
    await app.wait(()=>app.find('.cx-scope-toggle').getAttribute('aria-expanded')==='true');
    assert.equal(app.w.document.activeElement,app.find('.cx-scope-toggle'));
  }finally{app.close()}
});

test('pinned Investigation audit retains its original narrowed population without loading records',async()=>{
  const app=await mount('/investigate?'+query,{payloads:exceptions},false);try{
    await app.wait(()=>stage(app,'signal').textContent.includes('Current 7'));
    app.find('.cx-driver-pin').click();await app.wait(()=>app.find('#investigation-evidence-tray').textContent.includes('1 pinned'));
    app.w.__fixture.navigate('/investigate?'+query.replace('Source+A','Source+B'));
    await app.wait(()=>app.find('[aria-label="Current case scope"]').textContent.includes('Source B'));
    // Navigation updates the context before its existing scoped request effect runs.
    // Establish the new report population before measuring audit-only requests.
    await app.wait(()=>app.w.__fixture.requests.some((url:string)=>url.includes('/exceptions?') && new URL(url,'https://test.invalid').searchParams.get('segmentSource')==='Source B'));
    await app.wait(()=>stage(app,'signal').textContent.includes('Current 7'));
    const tray=app.find('#investigation-evidence-tray');tray.open=true;
    const before=app.w.__fixture.requests.length;
    const trigger=app.find('#investigation-evidence-tray button','Audit evidence');trigger.focus();trigger.click();
    await app.wait(()=>app.find('[role="dialog"]'));
    const dialog=app.find('[role="dialog"]');
    assert.match(dialog.textContent,/Source A/);
    const href=dialog.querySelector('a[href*="lead-explorer"]').getAttribute('href');
    const params=new URL(href,'https://test.invalid').searchParams;
    assert.equal(params.get('clientId'),'synthetic-a');
    assert.equal(params.get('startDate'),'2026-09-01');
    assert.equal(params.get('endDate'),'2026-09-30');
    assert.equal(params.get('drill'),'awaiting-first-dial');
    assert.equal(params.get('segmentSource'),'Source A');
    assert.match(params.get('filters')||params.get('vendor')||'',/Vendor A/);
    assert.equal(params.has('leadId'),false);
    assert.equal(app.w.__fixture.requests.length,before,'Opening pin audit must not request records or re-evaluate its population');
    app.find('button','Close inspector').click();await app.wait(()=>!app.find('[role="dialog"]'));
  }finally{app.close()}
});

test('metric signal reports the loaded metric and preserves unavailable values without claiming a population',async()=>{
  const route='/investigate?clientId=synthetic-a&startDate=2026-09-01&endDate=2026-09-30&investigationMetric=fetchedLeads';
  const app=await mount(route,{payloads:exceptions},false);try{
    await app.wait(()=>stage(app,'signal').textContent.includes('Current 120'));
    assert.match(stage(app,'signal').textContent,/previous 100.*change \+20 leads/);
    assert.match(app.find('.cx-investigation-heading').textContent,/Population unavailable/);
    assert.equal(app.w.__fixture.requests.filter((url:string)=>url.includes('/root-cause?')).length,1);
    const result=app.w.__fixture.payloads['/api/analytics/offernet/root-cause'];
    app.w.__fixture.payloads['/api/analytics/offernet/root-cause']={...result,metric:{...result.metric,currentValue:null,previousValue:null,delta:null}};
    app.w.__fixture.navigate(route+'&segmentSource=Missing');
    await app.wait(()=>stage(app,'signal').textContent.includes('Current Unavailable'));
    assert.match(stage(app,'signal').textContent,/previous Unavailable.*change Unavailable/);
    assert.doesNotMatch(stage(app,'signal').textContent,/Current 0|previous 0/);
  }finally{app.close()}
});

test('current-view refresh reloads active metric drivers on both pages and keeps inactive overview requests idle',async()=>{
  for (const page of ['/investigate','/lead-explorer']) {
    const app=await mount(page+'?clientId=synthetic-a&startDate=2026-09-01&endDate=2026-09-30&investigationMetric=fetchedLeads',{payloads:exceptions},false);try{
      await app.wait(()=>stage(app,'signal').textContent.includes('Current 120'));
      const count=(endpoint:string)=>(app.w.__fixture.requests as string[]).filter(url=>url.includes(endpoint+'?')).length;
      const before={drivers:count('/root-cause'),queue:count('/exceptions'),records:count('/raw-leads')};
      const result=app.w.__fixture.payloads['/api/analytics/offernet/root-cause'];
      app.w.__fixture.payloads['/api/analytics/offernet/root-cause']={...result,metric:{...result.metric,currentValue:141,delta:41}};
      app.find('button','Refresh current view').click();
      await app.wait(()=>stage(app,'signal').textContent.includes('Current 141'));
      assert.match(stage(app,'signal').textContent,/change \+41 leads/);
      assert.equal(count('/root-cause'),before.drivers+1,'Refresh bypasses the resolved driver cache exactly once');
      assert.equal(count('/exceptions'),before.queue+(page==='/investigate'?1:0));
      assert.equal(count('/raw-leads'),before.records+(page==='/lead-explorer'?1:0));
      assert.equal(count('/overview'),0);assert.equal(count('/operating-controls'),0);
    }finally{app.close()}
  }
});

test('refreshing a supplied exception population reuses the refreshed queue without a duplicate driver request',async()=>{
  const app=await mount('/investigate?'+query,{payloads:exceptions},false);try{
    await app.wait(()=>stage(app,'signal').textContent.includes('Current 7'));
    const before=app.w.__fixture.requests.filter((url:string)=>url.includes('/exceptions?')).length;
    app.w.__fixture.payloads['/api/analytics/offernet/exceptions']={...exceptionPayload,exceptions:[{...exceptionPayload.exceptions[0],count:9}]};
    app.find('button','Refresh current view').click();
    await app.wait(()=>stage(app,'signal').textContent.includes('Current 9'));
    assert.equal(app.w.__fixture.requests.filter((url:string)=>url.includes('/exceptions?')).length,before+1);
    assert.equal(app.w.__fixture.requests.some((url:string)=>/root-cause|offernet\/overview|operating-controls/.test(url)),false);
  }finally{app.close()}
});

test('a later explicit refresh fences an obsolete driver response even if its transport resolves after cancellation',async()=>{
  const endpoint='/api/analytics/offernet/root-cause';
  const app=await mount('/investigate?clientId=synthetic-a&startDate=2026-09-01&endDate=2026-09-30&investigationMetric=fetchedLeads',{payloads:exceptions},false);try{
    await app.wait(()=>stage(app,'signal').textContent.includes('Current 120'));
    app.w.__fixture.defer=[endpoint];
    app.find('button','Refresh current view').click();await app.wait(()=>app.w.__fixture.pending?.[endpoint]);
    const obsolete=app.w.__fixture.pending[endpoint];
    await app.wait(()=>app.find('button','Refresh current view') && !app.find('button','Refresh current view').disabled);
    app.find('button','Refresh current view').click();await app.wait(()=>app.w.__fixture.pending[endpoint]!==obsolete);
    const current=app.w.__fixture.pending[endpoint];
    const result=app.w.__fixture.payloads[endpoint];
    app.w.__fixture.payloads[endpoint]={...result,metric:{...result.metric,currentValue:141,delta:41}};
    current();await app.wait(()=>stage(app,'signal').textContent.includes('Current 141'));
    app.w.__fixture.payloads[endpoint]={...result,metric:{...result.metric,currentValue:999,delta:899}};
    obsolete();await new Promise(resolve=>setTimeout(resolve,50));
    assert.match(stage(app,'signal').textContent,/Current 141/);
    assert.doesNotMatch(stage(app,'signal').textContent,/999/);
    assert.equal(app.w.__fixture.requests.filter((url:string)=>url.includes('/root-cause?')).length,3);
  }finally{app.close()}
});

test('narrowing navigation survives history and clearing the investigation preserves independent global scope',async()=>{
  const app=await mount('/investigate?'+query,{payloads:exceptions},false);try{
    await app.wait(()=>stage(app,'signal').textContent.includes('Current 7'));
    app.find('button','Remove investigation Source').click();await app.wait(()=>!new URL(app.w.__fixture.location,'https://test.invalid').searchParams.has('segmentSource'));
    await app.wait(()=>stage(app,'diagnose').getAttribute('aria-current')==='step');
    app.w.__fixture.navigate(-1);await app.wait(()=>stage(app,'segment').textContent.includes('Source A'));
    app.w.__fixture.navigate(1);await app.wait(()=>stage(app,'segment').textContent.includes('No additional narrowing'));
    app.w.__fixture.navigate(-1);await app.wait(()=>stage(app,'segment').textContent.includes('Source A'));
    app.find('button','Clear investigation').click();await app.wait(()=>stage(app,'signal').getAttribute('aria-current')==='step');
    const params=new URL(app.w.__fixture.location,'https://test.invalid').searchParams;
    assert.equal(params.has('drill'),false);assert.equal(params.has('segmentSource'),false);
    assert.equal(params.get('vendor'),'Vendor A');assert.equal(params.get('startDate'),'2026-09-01');
  }finally{app.close()}
});

test('empty and failed record populations are distinct and never imply successful evidence',async()=>{
  for(const failed of [false,true]){
    const app=await mount('/lead-explorer?'+query,failed?{fail:['raw-leads']}:{payloads:{...exceptions,'/api/analytics/offernet/raw-leads':{clientId:'synthetic-a',rows:[],totalCount:0,validationStatus:'NOT_VERIFIED'}}},false);try{
      await app.wait(()=>stage(app,'records').textContent.includes(failed?'Record evidence unavailable':'No matching records'));
      assert.match(stage(app,'evidence').textContent,/NOT_VERIFIED/);
      assert.match(stage(app,'conclusion').textContent,/Conclusion incomplete/);
      if(failed){assert.match(stage(app,'signal').textContent,/Current evidence unavailable/);assert.doesNotMatch(app.find('.cx-investigation-heading').textContent,/0 affected leads/);}
      else assert.match(app.find('.cx-investigation-heading').textContent,/0 affected leads/);
    }finally{app.close()}
  }
});

test('record search disables comparison and selected dossiers stay private across role/session boundaries',async()=>{
  const app=await mount('/lead-explorer?'+query,{payloads:exceptions});try{
    app.find('button','Open dossier for lead').click();await app.wait(()=>stage(app,'records').textContent.includes('dossier open'));
    assert.ok([...app.w.document.querySelectorAll('[data-stage]')].every((el:any)=>!el.href?.includes('SYNTHETIC-LEAD')));
    assert.equal(new URL(app.w.__fixture.location,'https://test.invalid').searchParams.has('leadId'),false);
    app.find('button','Pin lead evidence').click();await app.wait(()=>stage(app,'evidence').textContent.includes('1 session observation'));
    app.w.__fixture.setAccess({nonAdmin:true});await app.wait(()=>app.find('[role="status"]','Record access is restricted'));
    const requestCount=app.w.__fixture.requests.filter((url:string)=>url.includes('raw-leads')).length;
    app.w.__fixture.navigate('/investigate?'+query);await app.wait(()=>stage(app,'records'));
    assert.equal(stage(app,'records').getAttribute('aria-disabled'),'true');
    assert.match(stage(app,'evidence').textContent,/0 session observations/);
    assert.equal(app.w.__fixture.requests.filter((url:string)=>url.includes('raw-leads')).length,requestCount);
    app.w.__fixture.setAccess({nonAdmin:false,uid:'synthetic-other-user'});
    app.w.__fixture.navigate('/lead-explorer?'+query);await app.wait(()=>app.find('button','Open dossier for lead'));
    assert.doesNotMatch(stage(app,'records').textContent,/dossier open/);
    assert.match(stage(app,'evidence').textContent,/0 session observations/);
    input(app,app.find('input','Search lead records'),'SYNTHETIC-LEAD-0002');
    app.find('.cx-explorer-search').dispatchEvent(new app.w.Event('submit',{bubbles:true,cancelable:true}));
    await app.wait(()=>stage(app,'diagnose').textContent.includes('record-text search'));
    assert.equal(app.find('button','Copy scoped link').disabled,true);
    assert.match(stage(app,'segment').textContent,/Source: Source A/);
  }finally{app.close()}
});
