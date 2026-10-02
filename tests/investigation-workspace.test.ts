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
async function mount(){
  const errors:string[]=[];const console=new VirtualConsole();console.on('jsdomError',(error:Error)=>{if(!error.message.includes('navigation'))errors.push(error.message)});console.on('error',(...args:unknown[])=>errors.push(args.map(String).join(' ')));
  const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://test.invalid',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console});const w=dom.window as any;
  Object.assign(w,{Response,Request,Headers,AbortController,TextEncoder,TextDecoder,ReadableStream,structuredClone,ResizeObserver:class{observe(){}unobserve(){}disconnect(){}},__fixture:{initialRoute:'/lead-explorer?'+query}});
  w.matchMedia=(q:string)=>({matches:false,media:q,addEventListener(){},removeEventListener(){}});w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLElement.prototype.scrollTo=()=>{};w.scrollTo=()=>{};
  const wait=async(check:()=>unknown)=>{for(let i=0;i<150;i++){if(check())return;await new Promise(r=>setTimeout(r,20));}throw new Error(w.document.body.textContent?.slice(0,2000)+' '+errors.join(';'));};
  const find=(selector:string,text='')=>[...w.document.querySelectorAll(selector)].find((el:any)=>(el.getAttribute('aria-label')||el.textContent||'').includes(text)) as any;
  w.eval(script);await wait(()=>find('button','Open dossier for lead'));
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
    a.w.__fixture.navigate('/data-integrity?'+query);await a.wait(()=>a.find('h1','Data'));
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
test('contextual confidence never certifies an absent delivery source or unknown validation',async()=>{
  const a=await mount();try{await a.wait(()=>a.find('[aria-label="Evidence confidence for this question"]'));
    const content=a.find('[aria-label="Evidence confidence for this question"]').textContent;
    assert.match(content,/NOT_VERIFIED/);assert.match(content,/Delivery evidence/);assert.match(content,/coverage is not supplied/);assert.doesNotMatch(content,/VERIFIED ✓|healthy/i);
  }finally{a.close()}
});
