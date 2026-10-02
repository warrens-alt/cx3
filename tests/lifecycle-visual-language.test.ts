import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { Inbox, Send, PhoneCall, UserCheck, BadgeCheck, Zap } from 'lucide-react';
import { lifecyclePresentation } from '../src/shared/visuals/lifecyclePresentation';
import LifecyclePath from '../src/shared/visuals/LifecyclePath';
import PercentileRail from '../src/shared/visuals/PercentileRail';
import EvidenceTimeline from '../src/shared/visuals/EvidenceTimeline';
import MetricSparkline from '../src/shared/visuals/MetricSparkline';

const render = (component: React.ReactNode) => renderToStaticMarkup(component);
const stageKeys = ['fetched', 'delivered', 'dialled', 'rpc', 'sales', 'activated'] as const;
const stages = stageKeys.map((key, index) => ({key, volume: [100, 80, 60, 10, 40, 0][index]}));
const transition = { from:'RPC',to:'Sale',population:10,converted:3,lost:7,conversionRate:30,lossRate:70,deteriorationPp:null,status:'NON_NESTED' as const };

test('every lifecycle identity pairs its canonical token and icon', () => {
  const icons = [Inbox,Send,PhoneCall,UserCheck,BadgeCheck,Zap];
  for(const [index,key] of stageKeys.entries()) {
    assert.equal(lifecyclePresentation[key].Icon,icons[index]);
    assert.equal(lifecyclePresentation[key].color,`var(--cx-data-${key === 'activated' ? 'activation' : key})`);
  }
});

test('path preserves all independent stage populations and only returned intersections', () => {
  const html=render(React.createElement(LifecyclePath,{stages,transitions:[transition]}));
  const dom = new JSDOM(html);
  assert.deepEqual([...dom.window.document.querySelectorAll('li[data-stage]')].map(node=>node.getAttribute('data-stage')),stageKeys);
  assert.deepEqual([...dom.window.document.querySelectorAll('.cx-lifecycle-node strong')].map(node=>node.textContent),['100','80','60','10','40','0']);
  const node=dom.window.document.querySelector('[data-stage="rpc"]')!;
  assert.equal(node.getAttribute('data-transition'),'non-nested');
  assert.match(node.textContent!,/3 of 10 with both events/);
  assert.match(node.textContent!,/30\.0%/);
  assert.match(node.textContent!,/7 no recorded progression/);
  assert.match(node.textContent!,/Non-nested/);
  dom.window.close();
});

test('missing intersections remain unavailable even when adjacent counts exist', () => {
  const html=render(React.createElement(LifecyclePath,{stages,transitions:[]}));
  assert.equal((html.match(/data-transition="unavailable"/g)||[]).length,5);
  const dom = new JSDOM(html);
  assert.doesNotMatch(dom.window.document.body.textContent!,/0%|80%|60%|400%/);
  dom.window.close();
  assert.match(html,/Transition intersections are unavailable/);
});

test('missing stage and observed zero remain different nodes', () => {
  const html=render(React.createElement(LifecyclePath,{stages:[{key:'fetched',volume:null},{key:'delivered',volume:0}]}));
  assert.match(html,/data-state="unknown"/);assert.match(html,/data-state="zero"/);
  assert.match(html,/>Unavailable<\/strong>/);assert.match(html,/>0<\/strong>/);
});

test('percentile rail positions only supplied numeric percentiles and preserves zero', () => {
  const html=render(React.createElement(PercentileRail,{title:'Timing',unitLabel:'s',points:[{key:'p50',label:'Median',value:0,displayValue:'0s'},{key:'p75',label:'P75',value:null,displayValue:'—'},{key:'p90',label:'P90',value:900,displayValue:'15m'}]}));
  assert.equal((html.match(/class="cx-percentile-mark"/g)||[]).length,2);
  assert.match(html,/left:0%/);assert.match(html,/left:100%/);
  assert.match(html,/data-state="unavailable"><dt>P75/);
  assert.match(html,/>0s<\/dd>/);assert.match(html,/>15m<\/dd>/);
  assert.doesNotMatch(html,/NaN|Infinity/);
  assert.doesNotMatch(html, /class="cx-percentile-mark"[^>]*left:75%/, "Axis ticks must not be mistaken for supplied percentile marks");
});

test('formatted-only percentiles cannot imply a calculated time scale', () => {
  const html=render(React.createElement(PercentileRail,{title:'Timing',points:[{key:'p50',label:'Median',displayValue:'3h'},{key:'p90',label:'P90',displayValue:'9h'}]}));
  assert.doesNotMatch(html,/cx-percentile-mark|left:/);
  assert.match(html,/spacing is not a time scale/);
});

test('sparse sparkline breaks paths and never substitutes missing values', () => {
  const html=render(React.createElement(MetricSparkline,{label:'Sales',color:lifecyclePresentation.sales.color,points:[{date:'2026-09-01',value:0},{date:'2026-09-02',value:null},{date:'2026-09-03',value:9}]}));
  const dom=new JSDOM(html);
  assert.equal(dom.window.document.querySelectorAll('circle').length,2);
  const path=dom.window.document.querySelector('path')!.getAttribute('d')!;
  assert.equal((path.match(/M/g)||[]).length,2);assert.doesNotMatch(path,/L/);
  dom.window.close();
});

test('sparkline does not render an unsupported series or a one-point trend', () => {
  for(const points of [[],[{date:'day',value:null}],[{date:'day',value:0}]]) {
    assert.equal(render(React.createElement(MetricSparkline,{label:'Sales',color:'var(--cx-data-sales)',points})), '');
  }
});

test('timeline keeps untimed, missing and anomaly evidence explicit and selectable', () => {
  const html=render(React.createElement(EvidenceTimeline,{title:'Events',onSelect:()=>{},events:[
    {key:'dial',label:'First dial',value:'12 Apr 2026',state:'anomaly',detail:'Occurs before intake'},
    {key:'rpc',label:'RPC',value:'Recorded',state:'untimed',selected:true},
    {key:'activation',label:'Activation',value:'Unavailable',state:'unavailable'},
  ]}));
  assert.match(html,/data-state="anomaly"/);assert.match(html,/Occurs before intake/);
  assert.match(html,/Recorded · timestamp unavailable/);assert.match(html,/aria-pressed="true"/);
  assert.match(html,/data-evidence="unavailable"/);assert.equal((html.match(/<button/g)||[]).length,3);
  assert.doesNotMatch(html,/cx-evidence-timeline-elapsed/);
});
