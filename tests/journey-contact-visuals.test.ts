import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import EvidenceBars, { evidenceBarWidth } from '../src/shared/visuals/EvidenceBars';
import JourneyProgression from '../src/features/journey/components/JourneyProgression';
import JourneyTiming from '../src/features/journey/components/JourneyTiming';
import ContactCoverage from '../src/features/contact/components/ContactCoverage';
import CallEffortDistribution from '../src/features/contact/components/CallEffortDistribution';

const render = (node: React.ReactNode) => renderToStaticMarkup(React.createElement(MemoryRouter, {}, node));
const summary = { totalLeads: 100, dialledLeads: 30, zeroCallLeads: 60, unrecordedCallLeads: 10,
  oneCallLeads: 5, multiAttemptLeads: 25, singleAttemptSharePct: 16.7, multiAttemptSharePct: 83.3,
  fivePlusCallLeads: 3, fivePlusNoRpcLeads: 2 };

test('visual bar geometry keeps zero empty and missing/nonfinite counts unknown', () => {
  assert.equal(evidenceBarWidth(0, 100), 0);
  assert.equal(evidenceBarWidth(0, 0), 0);
  for (const value of [null, undefined, NaN, Infinity, -1]) assert.equal(evidenceBarWidth(value, 100), null);
  assert.equal(evidenceBarWidth(1, 1000), .1);
  assert.equal(evidenceBarWidth(200, 1000), 20);
  assert.equal(evidenceBarWidth(10, 0), null);
});

test('bar charts render exact labels and values rather than manufacturing measured zero', () => {
  const html = render(React.createElement(EvidenceBars, { title: 'Evidence', description: 'A comparison', items: [
    {key:'zero',label:'Observed zero',value:0}, {key:'missing',label:'Missing',value:null}, {key:'count',label:'Source <record>',value:1280},
  ] }));
  assert.match(html, /data-state="zero"/); assert.match(html, /data-state="unknown"/);
  assert.match(html, /1,280/); assert.match(html, /Unavailable/); assert.match(html, /Source &lt;record&gt;/);
  assert.doesNotMatch(html, /NaN|Infinity|<record>/);
});

test('only actionable evidence bars are buttons', () => {
  const props = { title:'Evidence',description:'Read only',items:[{key:'a',label:'A',value:3}] };
  assert.doesNotMatch(render(React.createElement(EvidenceBars, props)), /<button/);
  assert.match(render(React.createElement(EvidenceBars, {...props,onSelect:()=>{}})), /aria-label="Inspect A: 3"/);
});

test('journey separates independent counts from transition intersections', () => {
  const stages = [
    {key:'rpc',name:'RPC',volume:10,conversionRate:10,dropoff:1,description:'',stepNumber:4},
    {key:'sales',name:'Sales',volume:40,conversionRate:30,dropoff:7,description:'',stepNumber:5},
  ] as any;
  const transitions = [{from:'RPC',to:'Sale',population:10,converted:3,lost:7,conversionRate:30,lossRate:70,deteriorationPp:null,status:'NON_NESTED'}] as any;
  const html = render(React.createElement(JourneyProgression, { stages, transitions, onInspectStage:()=>{},onInspectTransition:()=>{} }));
  assert.match(html, /width:25%/); assert.match(html, /width:100%/);
  assert.match(html, /width:30%/); assert.match(html, /3 of 10 with both events/);
  assert.match(html, /Non-nested: the next-stage total includes leads outside this prior stage/);
  assert.match(html, /aria-label="Inspect Sales: 40"/);
  assert.match(html, /Inspect RPC to Sale: 7 without progression/);
});

test('journey zero and missing stages retain separate states', () => {
  const stages = ['rpc','sales'].map((key,index)=>({key,name:key,volume:index===0?0:null,conversionRate:null,dropoff:null,description:'',stepNumber:index+1})) as any;
  const html = render(React.createElement(JourneyProgression, {stages}));
  assert.match(html, /data-state="zero"/); assert.match(html, /data-state="unknown"/);
  assert.match(html, /Transition intersections are unavailable/);
});

test('contact coverage uses the three returned populations without deriving missing feedback', () => {
  const html = render(React.createElement(ContactCoverage, {summary,onInspectBucket:()=>{}}));
  for (const width of [30,60,10]) assert.match(html, new RegExp(`width:${width}%`));
  assert.match(html, /Recorded zero calls/); assert.match(html, /Call count unrecorded/);
  assert.match(html, /Inspect Recorded zero calls: 60/);
  assert.match(html, /Inspect Call count unrecorded: 10/);
});

test('incomplete coverage cannot become a normalized complete partition', () => {
  const html = render(React.createElement(ContactCoverage, {summary:{...summary,unrecordedCallLeads:11}}));
  assert.match(html, /data-state="unknown"/); assert.doesNotMatch(html,/width:/);
  assert.match(html, /A complete partition is unavailable/); assert.match(html, />11<\/strong>/);
});

test('empty contact coverage retains measured zero without division artifacts', () => {
  const html = render(React.createElement(ContactCoverage, {summary:{...summary,totalLeads:0,dialledLeads:0,zeroCallLeads:0,unrecordedCallLeads:0}}));
  assert.match(html,/No lead population/); assert.doesNotMatch(html,/NaN|Infinity|width:/);
});

test('call distribution preserves every returned bucket including unrecorded', () => {
  const rows = ['0 calls','1 call','2 calls','3 calls','4 calls','5+ calls','Unrecorded'].map((bucket,index)=>({bucket,leads:index,contactRate:null,saleRate:0})) as any;
  const before = JSON.stringify(rows);
  const html = render(React.createElement(CallEffortDistribution, {rows,onInspectBucket:()=>{}}));
  for(const row of rows) assert.ok(html.includes(row.bucket));
  assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
  assert.match(html,/aria-label="Inspect Unrecorded: 6"/);
  assert.equal(JSON.stringify(rows),before);
});

test('timing presentation retains server duration strings and scopes the existing link', () => {
  const html = render(React.createElement(JourneyTiming,{velocity:{fetchToDelivery:'0m',deliveryToFirstDial:'3.4h',firstDialToContact:'Unavailable',contactToSale:'8.2h',saleToActivation:'—'},speedToLeadPath:'/speed-to-lead?clientId=default_tenant&startDate=2026-09-28'}));
  assert.match(html,/>0m</); assert.match(html,/>3.4h</);
  assert.equal((html.match(/data-evidence="unavailable"/g)||[]).length,2);
  assert.match(html,/startDate=2026-09-28/);
});

test('new visual components have no fetching, data mutations or storage writes', () => {
  for(const file of ['src/shared/visuals/EvidenceBars.tsx','src/features/contact/components/ContactCoverage.tsx','src/features/contact/components/CallEffortDistribution.tsx']){
    const text = fs.readFileSync(file,'utf8');
    assert.doesNotMatch(text,/\bfetch\(|useQuery\(|localStorage|sessionStorage|process\.env/);
  }
});

test('phase two styles are scoped, motion-aware and keep tables accessible', () => {
  const css=fs.readFileSync('src/styles/journeyContactVisuals.css','utf8');
  assert.match(css,/prefers-reduced-motion/); assert.match(css,/focus-visible/); assert.match(css,/max-width:639px/);
  assert.doesNotMatch(css,/@import|https?:|url\(/);
  for(const file of ['src/features/journey/components/JourneyProgression.tsx','src/features/journey/components/JourneySegments.tsx','src/features/contact/components/CallEffortReport.tsx']){
    const text=fs.readFileSync(file,'utf8');assert.match(text,/role="region"/);assert.match(text,/tabIndex=\{0\}/);assert.match(text,/scope="col"/);
  }
});
