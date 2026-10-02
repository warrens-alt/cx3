import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path:string)=>fs.readFileSync(path,'utf8');

test('secondary analytics routes receive unique visual scopes without changing data hooks',()=>{
  const cases=[
    ['src/pages/CliPerformance.tsx','cx-cli-page','fetchCliPerformance'],
    ['src/pages/RoutingIntelligence.tsx','cx-routing-page','useAnalyticsData'],
    ['src/pages/Cohorts.tsx','cx-cohorts-page','useAnalyticsData'],
    ['src/pages/OffershopProcessObservability.tsx','cx-process-page','loadData'],
    ['src/pages/CommercialReconciliation.tsx','cx-reconciliation-page','useEvidenceWorkspace'],
  ] as const;
  for(const [path,scope,dataHook] of cases){
    const source=read(path);
    assert.ok(source.includes(scope), `${path} missing ${scope}`);
    assert.ok(source.includes(dataHook), `${path} lost ${dataHook}`);
  }
});

test('consumer re-entry is grouped with journey navigation, not administration',()=>{
  const source=read('src/app/routeManifest.tsx');
  const start=source.indexOf("id: 'consumers'");
  const end=source.indexOf('},',start);
  const block=source.slice(start,end);
  assert.match(block,/area: 'journey'/);
  assert.match(block,/isMoreView: true/);
  assert.match(block,/legacySection: 'funnel'/);
  assert.doesNotMatch(block,/area: 'settings'/);
});

test('convergence stylesheet is presentation-only and responsive',()=>{
  const css=read('src/styles/crossAppConvergence.css')+read('src/styles/reporting.css');
  for(const selector of ['.cx-cli-page','.cx-routing-page','.cx-cohorts-page','.cx-process-page','.cx-reconciliation-page','.vetting-page']) assert.ok(css.includes(selector));
  assert.match(css,/position:\s*sticky/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/prefers-reduced-motion/);
  assert.doesNotMatch(css,/https?:|@import|url\(/);
});

test('commercial reconciliation keeps explicit non-profit interpretation',()=>{
  const source=read('src/pages/CommercialReconciliation.tsx');
  assert.match(source,/Arithmetic differences are descriptive balances, not loss or profit/);
  assert.match(source,/No approved invoice identity/);
  assert.match(source,/No approved collection identity/);
});

test('vetting continues to separate class and colour classifications',()=>{
  const source=read('src/pages/Vetting.tsx');
  assert.match(source,/Compare class and colour results as separate classifications/);
  assert.match(source,/This does not imply an equivalent score/);
  assert.match(source,/MISSING_CLASS/);
  assert.match(source,/MISSING_COLOUR/);
});

test('convergence stylesheet loads after prior visual layers',()=>{
  const main=read('src/main.tsx');
  const prior=main.indexOf("import './styles/timeAgentCampaignVisuals.css';");
  const convergence=main.indexOf("import './styles/crossAppConvergence.css';");
  assert.ok(prior>=0&&convergence>prior);
});
