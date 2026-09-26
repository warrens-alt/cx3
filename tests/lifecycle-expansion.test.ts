import test from 'node:test';
import assert from 'node:assert/strict';
import { matchedPeriodWindow, compareMetric, decomposeRateChange } from '../contracts/periodComparison';
import { assembleLifecycleDiagnostics, getLifecycleDiagnostics } from '../server/analytics/common/lifecycleDiagnostics';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig } from '../server/bigquery/config';
import { getSpeedToLeadAnalytics } from '../server/analytics/contact/speedToLead';
import { getSalesActivationAnalytics } from '../server/analytics/outcomes/salesActivation';
import { getExecutiveOverview } from '../server/analytics/overview/service';
import { getTemporalAnalytics } from '../server/analytics/temporal/service';

const scope = { clientId: 'default_tenant', startDate:'2026-09-01', endDate:'2026-09-07' };
const client = getBigQueryClient(getClientConfig(scope.clientId).bigQueryProject);

test('matched calendar windows cover day, week, custom, leap day and different calendar-month lengths without unequal comparison', () => {
  assert.deepEqual(matchedPeriodWindow('2026-09-01','2026-09-01')?.previous, {startDate:'2026-08-31',endDate:'2026-08-31'});
  assert.deepEqual(matchedPeriodWindow('2026-09-01','2026-09-07')?.previous, {startDate:'2026-08-25',endDate:'2026-08-31'});
  const march = matchedPeriodWindow('2026-03-01','2026-03-31')!;
  assert.equal(march.days,31);
  assert.deepEqual(march.previous,{startDate:'2026-01-29',endDate:'2026-02-28'});
  assert.equal(matchedPeriodWindow('2024-02-28','2024-03-01')?.days,3);
  for (const [start,end] of [['2026-02-30','2026-03-01'],['2026-09-07','2026-09-01'],['2024-01-01','2026-01-01'],['bad','2026-09-01']]) assert.equal(matchedPeriodWindow(start,end),null);
  assert.equal(matchedPeriodWindow(),null);
});

test('rate changes use percentage points and counts use absolute and relative change with null/zero preserved', () => {
  assert.deepEqual(compareMetric(30,40,'rate'),{current:30,previous:40,kind:'rate',absoluteChange:-10,percentageChange:null,percentagePointChange:-10});
  assert.equal(compareMetric(80,100,'count').percentageChange,-20);
  assert.equal(compareMetric(0,100,'currency').percentageChange,-100);
  assert.equal(compareMetric(0,0,'count').absoluteChange,0);
  assert.equal(compareMetric(100,0,'count').percentageChange,null);
  assert.equal(compareMetric(null,100,'currency').absoluteChange,null);
});

test('exclusive contribution allocations reconcile with mix shifts, entering and exiting segments', () => {
  const result = decomposeRateChange([{key:'A',numerator:15,denominator:60},{key:'New',numerator:5,denominator:40}], [{key:'A',numerator:20,denominator:50},{key:'Old',numerator:10,denominator:50}])!;
  assert.ok(Math.abs(result.deltaPp+10)<1e-12);
  assert.ok(Math.abs(result.contributions.reduce((s,r)=>s+r.contributionPp,0)-result.deltaPp)<1e-12);
  assert.deepEqual(result.contributions.map(r=>r.key).sort(),['A','New','Old']);
  assert.equal(result.status,'RECONCILED');
  assert.equal(decomposeRateChange([],[]),null);
  assert.equal(decomposeRateChange([{key:'A',numerator:1,denominator:0}],[{key:'A',numerator:1,denominator:2}]),null);
  assert.equal(decomposeRateChange([{key:'A',numerator:1,denominator:2},{key:'A',numerator:1,denominator:2}],[{key:'A',numerator:1,denominator:2}]),null);
});

const evidence = [
  {period:'current',dimension:'all',segment:'All',fetched:100,delivered:80,dialled:60,rpc:30,sales:20,activations:10,deliveredDialled:50,dialledRpc:30,rpcSale:18,saleActivated:10},
  {period:'previous',dimension:'all',segment:'All',fetched:100,delivered:90,dialled:80,rpc:40,sales:30,activations:20,deliveredDialled:80,dialledRpc:40,rpcSale:30,saleActivated:20},
  {period:'current',dimension:'vendor',segment:'A',fetched:60,sales:15}, {period:'current',dimension:'vendor',segment:'B',fetched:40,sales:5},
  {period:'previous',dimension:'vendor',segment:'A',fetched:50,sales:20}, {period:'previous',dimension:'vendor',segment:'B',fetched:50,sales:10},
];
test('funnel loss uses stage intersections and contribution is withheld if segment totals do not match overall population', () => {
  const result=assembleLifecycleDiagnostics(evidence,matchedPeriodWindow(scope.startDate,scope.endDate));
  const deliveryDial=result.transitions.find(t=>t.from==='Delivery')!;
  assert.equal(deliveryDial.population,80);
  assert.equal(deliveryDial.converted,50);
  assert.equal(deliveryDial.lost,30);
  assert.equal(deliveryDial.conversionRate,62.5);
  assert.equal(deliveryDial.status,'NON_NESTED');
  assert.equal(result.comparisons.saleRate.percentagePointChange,-10);
  assert.equal(result.rateContributions.saleRate.vendor?.status,'RECONCILED');
  assert.equal(result.rateContributions.saleRate.source,null);
  assert.equal(result.rateContributions.deliveryRate.vendor,null,'incomplete outcome counts cannot create a reconciled allocation');
  const incomplete=assembleLifecycleDiagnostics(evidence.filter(r=>!(r.period==='current' && r.dimension==='vendor' && r.segment==='B')),matchedPeriodWindow(scope.startDate,scope.endDate));
  assert.equal(incomplete.rateContributions.saleRate.vendor,null);
});

test('comparison SQL keeps tenant filters and local date boundaries; concurrent identical scopes share pending work only', async context => {
  const requests: any[]=[];
  context.mock.method(client,'query',async(request:any)=>{ requests.push(request); return [evidence] as any; });
  const params={...scope,vendor:'V1',source:'S',grade:'A'};
  const [a,b]=await Promise.all([getLifecycleDiagnostics(params),getLifecycleDiagnostics(params)]);
  assert.equal(a,b);
  assert.equal(requests.length,1);
  assert.equal(requests[0].params.startDate,'2026-08-25');
  assert.equal(requests[0].params.endDate,'2026-09-07');
  assert.equal(requests[0].params.lifecycleCurrentStart,'2026-09-01');
  assert.equal(requests[0].params.vendor,'V1');
  assert.equal(requests[0].params.source,'S');
  assert.equal(requests[0].params.grade,'A');
  assert.match(requests[0].query,/DATE\(fetched_ts, @lifecycleTimezone\)/);
  assert.match(requests[0].query,/COUNTIF\(revenue IS NULL\) AS missingRevenueLeads/);
  assert.match(requests[0].query,/LOWER\(hlc.vendor\) = LOWER\(@vendor\)/);
  assert.ok(!requests[0].query.includes('LIMIT 10'));
  await getLifecycleDiagnostics(params);
  assert.equal(requests.length,2,'completed work is not retained as a hidden stale cache');
});

test('speed includes valid zero P95, undialled and invalid cohorts; backlog does not infer calls from null counters', async context => {
  let sql='';
  context.mock.method(client,'query',async(request:any)=>{sql=request.query;return [[{percentiles:{p95_deliv_dial:0},cohorts:[{age_cohort:'Undialled',leads:3,dialled:0,contacted:0,sales:0,activations:0}],backlog:{awaitingFirstDial:3,currentSlaBreaches:2,oldestUndialledSec:3600}}]] as any;});
  const result=await getSpeedToLeadAnalytics(scope);
  assert.equal(result.timingStages.find(r=>r.stage==='Delivery → First Dial')?.p95,'0s');
  assert.equal(result.cohorts[0].contactRate,null);
  assert.equal(result.cohorts[0].saleRate,0);
  assert.equal(result.backlog.oldestUndialled,'1.0h');
  assert.match(sql,/WHEN NOT is_dialled THEN 'Undialled'/);
  assert.match(sql,/capture_to_first_dial_sec IS NULL OR capture_to_first_dial_sec < 0/);
  assert.match(sql,/capture_to_first_dial_sec <= 10800/);
  assert.match(sql,/OFFSET\(95\)/);
});

test('sales use recorded-zero revenue evidence, unique lead segments, median latency and explicit ageing', async context => {
  let sql='';
  context.mock.method(client,'query',async(request:any)=>{sql=request.query;return [[{total_sales:3,billable_sales:1,revenue_present_sales:2,unbilled_sales:1,unrecorded_revenue_sales:1,realized_revenue:0,median_time_to_sale_sec:0,segments:[{dimension:'source',segment:'Source',sales:3,activations:1,revenue:0}],activation_ageing:[{bucket:'4–7d',sales:2}]}]] as any;});
  const result=await getSalesActivationAnalytics(scope);
  assert.equal(result.reconciliation.realizedRevenue,0);
  assert.equal(result.reconciliation.billableSales,1);
  assert.equal(result.reconciliation.salesWithRecordedRevenue,2);
  assert.equal(result.reconciliation.unrecordedRevenueSales,1);
  assert.equal(result.reconciliation.medianTimeToSale,'0s');
  assert.equal(result.bySource[0].revenue,0);
  assert.equal(result.activationAgeing.find(r=>r.bucket==='4–7d')?.sales,2);
  assert.match(sql,/is_sale AND revenue IS NOT NULL/);
  assert.match(sql,/FROM sales_data CROSS JOIN UNNEST/);
  assert.ok(!sql.slice(sql.indexOf('by_segment AS')).includes('FROM operational_raw'));
});

test('temporal event bases aggregate weighted outcomes and preserve missing timestamps separately', async context => {
  let sql='';
  context.mock.method(client,'query',async(request:any)=>{sql=request.query;return [[{event_matrix:[{basis:'Delivery',iso_day:1,hour_of_day:8,volume:10,dialled:5,contacted:2,sales:1,activations:0},{basis:'Delivery',iso_day:2,hour_of_day:8,volume:20,dialled:5,contacted:3,sales:2,activations:1},{basis:'Delivery',iso_day:null,hour_of_day:null,volume:4}]}]] as any;});
  const result=await getTemporalAnalytics(scope);
  const delivery=result.timeBases.find(r=>r.basis==='Delivery')!;
  assert.equal(delivery.heatmap.length,168);
  assert.equal(delivery.missingTimestampLeads,4);
  assert.equal(delivery.byHour[8].volume,30);
  assert.equal(delivery.byHour[8].contactRate,50);
  assert.equal(delivery.weekType[0].sales,3);
  assert.equal(delivery.weekType[1].saleRate,null);
  assert.match(sql,/STRUCT\('First dial', first_call_ts\)/);
  assert.match(sql,/@tenantTimezone/);
});


test('average calls per dialled lead uses the same dialled numerator and completeness population', async context => {
  let observed: any = { fetched_leads:3, dialled_leads:2, total_calls_recorded:null, dialled_calls_recorded:6 };
  let sql = '';
  context.mock.method(client,'query',async(request:any)=>{sql=request.query;return [[observed]] as any;});
  const partial = await getExecutiveOverview(scope,{includeDiagnostics:false});
  assert.equal(partial.kpis.callsPerLead,null,'an unrecorded undialled counter makes the all-lead average unavailable');
  assert.equal(partial.kpis.callsPerDialledLead,3,'the complete dialled subset remains measurable');
  observed = { ...observed,total_calls_recorded:16 };
  const complete = await getExecutiveOverview(scope,{includeDiagnostics:false});
  assert.equal(complete.kpis.callsPerLead,5.3);
  assert.equal(complete.kpis.callsPerDialledLead,3,'ten calls on an undialled-timestamp lead do not enter the dialled numerator');
  observed = {...observed,total_calls_recorded:null,dialled_calls_recorded:null};
  assert.equal((await getExecutiveOverview(scope,{includeDiagnostics:false})).kpis.callsPerDialledLead,null);
  assert.match(sql,/COUNTIF\(is_dialled AND recorded_call_count IS NULL\)/);
  assert.match(sql,/SUM\(IF\(is_dialled, recorded_call_count, 0\)\)/);
});
