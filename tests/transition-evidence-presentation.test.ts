import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FunnelWaterfall } from '../src/components/charts/FunnelWaterfall';
import { LifecycleFunnelPanel } from '../src/components/LifecycleDiagnostics';

const render = (component: React.ReactNode) => renderToStaticMarkup(component);

test('transition chart uses supplied parent populations, rates and losses without adjacent subtraction', () => {
  const html = render(React.createElement(FunnelWaterfall, { title: 'Transition evidence', steps: [
    { label: 'RPC → recorded sale', value: 10, population: 50, rate: 20, dropoff: 40 },
    { label: 'Recorded sale → recorded activation', value: 8, population: 20, rate: 40, dropoff: 12, evidence: 'NON_NESTED' },
  ] }));
  assert.match(html, /Supplied conversion rate<\/dt><dd[^>]*>40.0%/);
  assert.match(html, /Supplied transition loss<\/dt><dd[^>]*>12/);
  assert.match(html, /Parent population<\/dt><dd[^>]*>20/);
  assert.match(html, /NON_NESTED/);
  assert.doesNotMatch(html, /80.0%|End-to-End Conversion|Total Funnel Fall-off|Highest Drop Milestone|% of first stage|% of previous/);
});

test('missing transition rates and losses stay unavailable, and measured zero has no painted bar', () => {
  const html = render(React.createElement(FunnelWaterfall, { title: 'Incomplete transitions', steps: [
    { label: 'Recorded zero', value: 0, population: 10, rate: 0, dropoff: 10 },
    { label: 'Unavailable evidence', value: null, population: null, rate: null, dropoff: null },
  ] }));
  assert.match(html, /data-evidence-state="zero"/);
  assert.match(html, /width:0%/);
  assert.match(html, /data-evidence-state="unavailable"/);
  assert.match(html, /Supplied conversion rate<\/dt><dd[^>]*>0.0%/);
  assert.match(html, /Supplied conversion rate<\/dt><dd[^>]*>Unavailable/);
  assert.match(html, /Supplied transition loss<\/dt><dd[^>]*>Unavailable/);
});

test('lifecycle visual passes individual transition denominators and non-nested evidence', () => {
  const html = render(React.createElement(LifecycleFunnelPanel, { data: { transitions: [
    {from:'RPC',to:'Recorded sale',population:50,converted:10,conversionRate:20,lost:40,lossRate:80,status:'NON_NESTED'},
    {from:'Recorded sale',to:'Recorded activation',population:20,converted:8,conversionRate:40,lost:12,lossRate:60,status:'NON_NESTED'},
  ],largestLeakage:null,largestDeterioration:null } as any }));
  assert.match(html, /Qualified lifecycle transitions/);
  assert.match(html, /Downstream recorded events also exist outside this qualified transition/);
  assert.match(html, /Parent population<\/dt><dd[^>]*>20/);
  assert.doesNotMatch(html, /End-to-End Conversion|Total Funnel Fall-off/);
});

