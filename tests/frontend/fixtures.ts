import { LEDGER_HEADERS, analyseLedgerLead } from '../../contracts/leadLedgerReplica';
// Deliberately synthetic. All requests terminate here; no customer data or identity.
export function installFixture() {
  const f = (window as any).__fixture = {
    initialRoute: '/speed-to-lead?clientId=synthetic-a&startDate=2026-09-28&endDate=2026-09-28',
    requests: [] as string[], errors: [] as string[], fail: [] as string[], denied: false, firestoreFailure: true,
    ...(window as any).__fixture,
  };
  const cohorts = [
    {cohort:'0–15 minutes',leads:120,contacted:12,sales:30,activations:0,contactRate:10,saleRate:25,activationRate:0},
    {cohort:'15–60 minutes',leads:0,contacted:0,sales:0,activations:0,contactRate:null,saleRate:null,activationRate:null},
    {cohort:'Unrecorded timing',leads:3,contacted:0,sales:0,activations:0,contactRate:null,saleRate:null,activationRate:null},
  ];
  const speed = {timingStages:[{stage:'Delivery → First Dial',description:'Delivery timestamp to first dial',avg:'1.3h',median:'42m',medianSec:2520,p75:'2.1h',p90:'8.4h',p95:null},{stage:'Capture → Delivery',description:'Capture timestamp to delivery',avg:'0s',median:'0s',medianSec:0,p75:'0s',p90:'0s'}],cohorts,backlog:{awaitingFirstDial:0,currentSlaBreaches:0,completedDialBreaches:0,oldestUndialled:null},methodology:'Synthetic capture-cohort evidence. Stages are independently observed; missing is not zero.'};
  const rows = [
    {lead_id:'SYNTHETIC-LEAD-0001-very-long-identity-for-responsive-checks',consumer_id:'SYNTHETIC-CONSUMER',vendor:'Synthetic vendor with a long descriptive label',source:'synthetic-source',fetched:'2026-09-28T09:00:00Z',dialled:true,contacted:null,sale:null,activated:null,total_calls:null,revenue:null},
    {lead_id:'SYNTHETIC-LEAD-0002',consumer_id:null,vendor:null,source:null,fetched:'2026-09-28T10:00:00Z',dialled:false,contacted:false,sale:'0',activated:'false',total_calls:0,revenue:'0.00'},
  ];
  const agent = (id:string,calls:number,rate:number|null) => ({agentId:id,vendor:'Synthetic vendor',totalCalls:calls,uniqueLeads:calls,contactCount:rate===null?null:0,contactRate:rate,salesCount:0,rpcSalesCount:0,saleRate:null,totalTalkTime:null,avgHandleTime:null,callbacksBooked:0});
  const coverage=f.payloads?.['/api/analytics/lead-ledger/replica/coverage']??{compatible:true,available:LEDGER_HEADERS,missing:[],source:'synthetic source',richViewEnabled:false};
  const raw = (values:any) => ({...Object.fromEntries(LEDGER_HEADERS.map(h=>[h,null])),...values});
  const first=raw({'Lead ID':rows[0].lead_id,'Consumer ID':'SYNTHETIC-CONSUMER','Fetched':'2026-09-28 09:00:00','Offershop Source':'SyntheticSourceWithAnUnbrokenLabelThatMustRemainReadableAtThreeHundredAndTwentyPixels','HLC Vendor':'Synthetic vendor','HLC Transaction ID':'SYNTHETIC-TX','HLC Total Calls':0,'HLC RPC':null,'HLC Revenue Generated':'1234567890.123456789','HLC CURRENCY':'ZAR','HLC Delivered':'2026-09-28 10:00:00','HLC First Call Date':'1900-01-01 00:00:00'});
  const second=raw({'Lead ID':rows[1].lead_id,'Fetched':'2026-09-28 10:00:00','Offershop Source':'Synthetic source B'});
  const sourceLeads=[analyseLedgerLead('synthetic-a',[first,{...first}],Date.parse('2026-09-30T00:00:00Z')),analyseLedgerLead('synthetic-b',[second],Date.parse('2026-09-30T00:00:00Z'))];
  const rawRows=Array.from({length:101},(_,i)=>i<2?rows[i]:{...rows[1],lead_id:`SYNTHETIC-LEAD-${String(i+1).padStart(4,'0')}`});
  f.payloads = {
    '/api/analytics/offernet/speed-to-lead':speed,
    '/api/analytics/offernet/ai-insights':{insights:[],executiveSummary:'Synthetic briefing',source:'synthetic',model:'fixture',validationStatus:'NOT_VERIFIED'},
    '/api/analytics/google/ask':{answer:'Synthetic answer for selected scope',model:'fixture',citations:[]},
    '/api/analytics/filter-options':{vendors:['Synthetic vendor'],sources:['synthetic-source'],grades:[]},
    '/api/analytics/offernet/agent-performance':{agents:[agent('Synthetic Agent A',120,0),agent('Synthetic Agent B',0,null)],metricAvailabilityReason:'Synthetic outcome evidence',temporal:[]},
    '/api/analytics/validation':{status:'EVIDENCE_CHECKED',overallStatus:'EVIDENCE_CHECKED',metrics:[],chain:'Synthetic endpoint response'},
    '/api/analytics/warehouse/tables':[],
    '/api/analytics/lead-ledger/replica/coverage':coverage,
    '/api/analytics/lead-ledger/replica':{leads:sourceLeads,summary:{leads:2,rows:3,leadOnlyRows:1,revenue:[],duplicateKeyRows:2},vendors:[{vendor:'Synthetic vendor',leads:1,rows:2},{vendor:'No vendor record',leads:1,rows:1}],metadata:{coverage,version:'synthetic',clientId:'synthetic-a',startDate:'2026-09-28',endDate:'2026-09-28',filters:{},search:'',generatedAt:'2026-09-30T06:00:00Z',queryJobId:null,offset:0,pageSize:25,hasMore:false,validationStatus:'NOT_VERIFIED',dateBasis:'fetched_cohort',timestampInterpretation:'Naive timestamps are UTC',pagination:'Distinct lead pagination'}},
    '/api/analytics/offernet/temporal':{heatmap:[{dayName:'Monday',hour:0,volume:0,contactRate:null,saleRate:null,activationRate:null}],windows:[]},
    '/api/analytics/offernet/vendor-quality':{vendors:[],vendorGrades:[]},
    '/api/reporting/catalogue':{configured:true,status:'UNAVAILABLE',release:null,message:'No approved reporting release published'},
    '/api/analytics/offernet/data-integrity':{totalRecordsAudited:2,validationStatus:'NOT_VERIFIED',reason:'Synthetic source observations',sources:[{key:'leads',label:'Synthetic old source',status:'OBSERVED',latestRecordAt:'2020-01-01T00:00:00Z',ageHours:59000,rowCount:2,detail:'Timestamp observed; no freshness SLA assumed'}],checks:[]},
    '/api/analytics/offernet/root-cause':{metric:{id:'fetchedLeads',label:'Fetched leads',kind:'volume',currentValue:120,previousValue:100,delta:20,deltaUnit:'leads'},currentWindow:{startDate:'2026-09-28',endDate:'2026-09-28'},previousWindow:{startDate:'2026-09-27',endDate:'2026-09-27'},drivers:[],dimensions:[{key:'vendor',label:'Vendor',reconciliationStatus:'NOT_VERIFIED',segments:[{name:'Synthetic vendor with a long descriptive name',currentValue:120,previousValue:100,currentNumerator:120,currentDenominator:120,previousNumerator:100,previousDenominator:100,contribution:20,shareOfDelta:100}]}],methodology:'Synthetic returned contribution evidence, not customer data.',validationStatus:'NOT_VERIFIED'},
    '/api/analytics/consumers':{overview:{total_consumers:null,repeat_consumers:0},tiers:[],sequenceEconomics:[],repeatConsumersSample:[]},
    '/api/analytics/cohorts':[],
    ...f.payloads,
  };
  window.fetch=async (input:any,options:any={})=>{
    const url=new URL(String(input),'https://synthetic.invalid'); f.requests.push(url.pathname+url.search);
    const response=(data:any,status=200)=>new Response(JSON.stringify(status===200?{success:true,data,metadata:{clientId:url.searchParams.get('clientId'),validationStatus:'NOT_VERIFIED'}}:{success:false,error:'Synthetic request failure'}),{status,headers:{'Content-Type':'application/json'}});
    if(f.defer?.includes(url.pathname)) { await new Promise<void>(resolve=>{f.pending ||= {};f.pending[url.pathname]=resolve;}); }
    if(f.fail.some((s:string)=>url.pathname.includes(s))) return response(null,503);
    if(url.pathname==='/api/analytics/lead-ledger/replica'&&f.sourceLeadCount){
      const population=Array.from({length:f.sourceLeadCount},(_,i)=>i<2?sourceLeads[i]:analyseLedgerLead(`synthetic-${i+1}`,[raw({'Lead ID':`SYNTHETIC-SOURCE-${String(i+1).padStart(4,'0')}`,'Fetched':'2026-09-28 10:00:00'})],Date.parse('2026-09-30T00:00:00Z')));
      const search=(url.searchParams.get('search')||'').toLowerCase(),limit=Number(url.searchParams.get('limit'))||25,offset=Number(url.searchParams.get('offset'))||0;
      const matching=population.filter(lead=>lead.records.some(record=>['Lead ID','Consumer ID','Offershop Source'].some(key=>String(record.raw[key]??'').toLowerCase().includes(search))));
      const sourceRows=matching.flatMap(lead=>lead.records);
      const vendorGroups=new Map<string,{vendor:string;rows:number;leads:Set<string>}>();
      for(const lead of matching)for(const record of lead.records){
        const vendor=String(record.raw['HLC Vendor']||'No vendor record');
        const group=vendorGroups.get(vendor)||{vendor,rows:0,leads:new Set<string>()};
        group.rows++;group.leads.add(lead.key);vendorGroups.set(vendor,group);
      }
      const vendors=Array.from(vendorGroups.values(),group=>({...group,leads:group.leads.size}));
      return response({...f.payloads[url.pathname],leads:matching.slice(offset,offset+limit),summary:{leads:matching.length,rows:sourceRows.length,leadOnlyRows:sourceRows.filter(record=>!record.raw['HLC Vendor']).length,duplicateKeyRows:matching.includes(sourceLeads[0])?2:0,revenue:[]},vendors,metadata:{...f.payloads[url.pathname].metadata,clientId:url.searchParams.get('clientId'),search,offset,pageSize:limit,hasMore:offset+limit<matching.length}});
    }
    if(url.pathname==='/api/analytics/offernet/raw-leads'){
      if(Object.hasOwn(f.payloads,url.pathname))return response(f.payloads[url.pathname]);
      const limit=Number(url.searchParams.get('limit'))||50,offset=Number(url.searchParams.get('offset'))||0;
      const search=(url.searchParams.get('search')||'').toLowerCase();
      const matching=rawRows.filter(row=>Object.values(row).some(v=>String(v??'').toLowerCase().includes(search)));
      return response({clientId:url.searchParams.get('clientId'),rows:matching.slice(offset,offset+limit),totalCount:matching.length,limit,offset,metadata:{clientId:url.searchParams.get('clientId'),startDate:url.searchParams.get('startDate'),endDate:url.searchParams.get('endDate'),filters:{},validationStatus:'NOT_VERIFIED'}});
    }
    if(url.pathname.startsWith('/api/analytics/lead-timeline/'))return response([{vendor:'Synthetic vendor',transaction_id:'SYNTHETIC-TX',capture_timestamp:'2026-09-28T09:00:00Z',first_call_timestamp:'2026-09-28T10:00:00Z',rpc:true,sale:true,activation:true}]);
    if(Object.hasOwn(f.payloads,url.pathname))return response(f.payloads[url.pathname]);
    return response(null,422);
  };
}
