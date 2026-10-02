/**
 * Synthetic, routed browser fixture for navigation and the Lead Ledger journey.
 * Uses the actual app shell, router, API adapters and feature components. All
 * fetches terminate in synthetic fixtures; this is never a production entry.
 * Run after npm run build to include the current production global stylesheet.
 */
import { build } from 'esbuild';
import { mkdir, writeFile, readdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function buildLedgerTimelineFixture(output, { includeProductionCss = true } = {}) {
const out = path.resolve(output);
  await mkdir(out, { recursive: true });
  await copyFile(path.join(root, 'public/brand/conversionx-grey.png'), path.join(out, 'conversionx-grey.png'));

const mocks = {
  AuthContext: `export function useAuth(){return {user:{uid:'synthetic-user',displayName:'Synthetic reviewer',email:'synthetic@example.invalid'},profile:{role:'admin',status:'active'},loading:false,isAdmin:true,isActive:true,isPending:false,isSuspended:false,accessState:'ACTIVE',authError:null,signOut:()=>{},retryAuth:()=>{}}}`,
  ClientContext: `import {useSearchParams} from 'react-router-dom';export function useClient(){const [p,set]=useSearchParams();const selectedClient=p.get('clientId')||'synthetic-a';return {selectedClient,clientId:selectedClient,clientConfig:{id:selectedClient,name:'Synthetic workspace',timezone:'UTC',currency:'ZAR',colours:{},thresholds:{},metrics:{},capabilities:{}},clients:[{id:'synthetic-a',name:'Synthetic workspace A'},{id:'synthetic-b',name:'Synthetic workspace B'}],ready:true,loading:false,error:null,reportAuthenticationFailure:()=>{},retry:()=>{},setSelectedClient:id=>set(prev=>{const next=new URLSearchParams(prev);next.set('clientId',id);return next;})};}`,
  firebase: 'export const db={};export const auth={};export const app={};export const googleProvider={};',
  firestore: `export const collection=(_db,name)=>name;export const query=q=>q;export const orderBy=()=>{};export const limit=()=>{};export function onSnapshot(q,ok,fail){queueMicrotask(()=>ok({forEach:()=>{}}));return ()=>{};}`,
};

const contents = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,useNavigate,useLocation} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import AppShell from './src/app/layouts/AppShell';
import AppRouter from './src/app/AppRouter';
import AuthGate from './src/components/AuthGate';
import {ThemeProvider} from './src/lib/ThemeContext';
import {FilterProvider} from './src/lib/FilterContext';
import {registerQueryClientForSessionIsolation,updateAnalyticalSession} from './src/lib/analyticalSession';
import {installFixture} from './tests/frontend/fixtures';
import {reductionPayloads} from './tests/frontend/reductionFixtures';
import {LEDGER_HEADERS,analyseLedgerLead} from './contracts/leadLedgerReplica';

const generatedAt='2026-10-02T06:00:00Z';
const base={consumer_id:'SYNTHETIC-CONSUMER',vendor:'Synthetic vendor',transaction_id:'SYNTHETIC-TX',source:'Synthetic paid social',grade:'A',vetting:'Green',valid_idno:true,phone_valid:true,revenue:null};
const rows=[
  {...base,lead_id:'SYN-COMPLETE',fetched:'2026-09-28T09:04:13Z',delivered_time:'2026-09-28T09:11:24Z',first_call_time:'2026-09-28T09:29:51Z',dialled:true,contacted:true,sale:true,activated:true,total_calls:5},
  {...base,lead_id:'SYN-PARTIAL',fetched:'2026-09-28T09:04:13Z',delivered_time:'2026-09-28T09:11:24Z',first_call_time:'2026-09-29T10:29:51Z',dialled:true,contacted:false,sale:null,activated:null,total_calls:3},
  {...base,lead_id:'SYN-UNTIMED',fetched:null,delivered_time:null,first_call_time:null,dialled:true,contacted:true,sale:true,activated:true,total_calls:5},
  {...base,lead_id:'SYN-NO-TIMELINE',fetched:null,delivered_time:null,first_call_time:null,dialled:null,contacted:null,sale:null,activated:null,total_calls:null},
  {...base,lead_id:'SYN-ZERO-CALLS',fetched:'2026-09-28T09:04:13Z',delivered_time:'2026-09-28T09:11:24Z',first_call_time:null,dialled:false,contacted:false,sale:false,activated:false,total_calls:0},
  {...base,lead_id:'SYN-SALE-NO-ACTIVATION',fetched:'2026-09-28T09:04:13Z',delivered_time:'2026-09-28T09:11:24Z',first_call_time:'2026-09-30T10:29:51Z',dialled:true,contacted:true,sale:true,activated:null,total_calls:5},
  {...base,lead_id:'SYN-LONG-JOURNEY',fetched:'2026-09-15T09:04:13Z',delivered_time:'2026-09-20T09:11:24Z',first_call_time:'2026-09-29T10:29:51Z',dialled:true,contacted:true,sale:null,activated:null,total_calls:8},
  {...base,lead_id:'SYN-LONG-IDENTIFIER-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789',vendor:'SyntheticRegionalAcquisitionAndCustomerRetentionVendorWithoutAnyNaturalWordBreaks',source:'SyntheticPaidSocialCampaignWithAnUnbrokenSourceIdentifierForResponsiveTesting',transaction_id:'SYNTHETICTRANSACTIONIDENTIFIER0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',consumer_id:'SYNTHETICCONSUMERIDENTIFIER0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',fetched:'2026-09-28T09:04:13Z',delivered_time:'2026-09-28T09:11:24Z',first_call_time:'2026-09-28T09:29:51Z',dialled:true,contacted:true,sale:true,activated:null,total_calls:12},
  {...base,lead_id:'SYN-FUTURE',fetched:'2026-09-28T09:04:13Z',delivered_time:'2999-09-28T09:11:24Z',first_call_time:'2026-09-28T09:29:51Z',dialled:true,contacted:null,sale:null,activated:null,total_calls:1},
  {...base,lead_id:'SYN-REVERSED-TIME',fetched:'2026-09-28T09:04:13Z',delivered_time:'2026-09-28T10:11:24Z',first_call_time:'2026-09-28T09:29:51Z',dialled:true,contacted:null,sale:null,activated:null,total_calls:1},
  {...base,lead_id:'SYN-INVALID-TIME',fetched:'2026-02-30T09:04:13Z',delivered_time:'not-a-timestamp',first_call_time:'1900-01-01 00:00:00',dialled:true,contacted:null,sale:null,activated:null,total_calls:1},
];
const coverage={compatible:true,available:LEDGER_HEADERS,missing:[],source:'synthetic.lead_vendor_source',richViewEnabled:false};
const raw=(row:any)=>({...Object.fromEntries(LEDGER_HEADERS.map(h=>[h,null])),
  'Lead ID':row.lead_id,'Consumer ID':row.consumer_id,'Offershop Source':row.source,'Fetched':row.fetched,
  'Offershop Grade':row.grade,'Offershop Color Vetting':row.vetting,'HLC Vendor':row.vendor,
  'HLC Transaction ID':row.transaction_id,'HLC Delivered':row.delivered_time,'HLC First Call Date':row.first_call_time,
  'HLC Total Calls':row.total_calls,'HLC RPC':row.contacted,'HLC Sale':row.sale,'HLC Activated':row.activated,
  'HLC Revenue Generated':row.revenue,'HLC CURRENCY':'ZAR'});
const sourceLeads=rows.map(row=>analyseLedgerLead(row.lead_id,[raw(row)],Date.parse(generatedAt)));

window.__fixture={...window.__fixture,rows,payloads:{...reductionPayloads,
  '/api/analytics/offernet/funnel':{velocity:{fetchToDelivery:'7m',deliveryToFirstDial:'18m',firstDialToContact:'Unavailable',contactToSale:'Unavailable',saleToActivation:'Unavailable'},byVendor:[],bySource:[],byGrade:[],lifecycle:{validationStatus:'NOT_VERIFIED',comparisons:Object.fromEntries(Object.entries({fetched:120,delivered:100,dialled:80,rpc:12,sales:30,activations:0}).map(([key,current])=>[key,{current,previous:null}])),transitions:[],segments:{vendor:[],source:[],grade:[]}}},
  '/api/analytics/offernet/contact-strategy':{attemptPerformance:[{bucket:'0 calls',leads:20,sharePct:20,contacted:0,contactRate:0,sales:0,saleRate:0,activations:0,activationRate:0,revenue:null,callCost:null,marginalSales:null,marginalCostPerSale:null},{bucket:'1 call',leads:80,sharePct:80,contacted:12,contactRate:15,sales:10,saleRate:12.5,activations:0,activationRate:0,revenue:null,callCost:null,marginalSales:null,marginalCostPerSale:null}],attemptCadence:[],summary:{totalLeads:100,dialledLeads:80,unrecordedCallLeads:0,zeroCallLeads:20,oneCallLeads:80,singleAttemptSharePct:100,multiAttemptLeads:0,multiAttemptSharePct:0,fivePlusCallLeads:0,fivePlusNoRpcLeads:0},methodology:'Synthetic returned effort evidence; missing is not zero.',noAnswerAnalysis:{status:'UNAVAILABLE',reason:'Individual synthetic call times are not supplied',stopThresholdRecommendation:null,diminishingReturnsCutoff:null,callbackFollowupRate:null,callbackSaleConversion:null}},
  '/api/analytics/offernet/sales-activation':{reconciliation:{totalSales:30,billableSales:0,unbilledSales:30,totalActivations:0,activationRate:0,realizedRevenue:null,avgTimeToSale:'Unavailable',avgTimeToActivation:'Unavailable'},maturationCurve:[],maturationStatus:'UNAVAILABLE',maturationReason:'Synthetic activation timing unavailable',byVendor:[{vendor:'Synthetic vendor',sales:30,activations:0,revenue:null}],activationAgeing:[{bucket:'0–7 days',sales:30}],currency:'ZAR',revenueEvidence:'No settlement evidence supplied'},
  '/api/analytics/offernet/exceptions':{validationStatus:'NOT_VERIFIED',generatedAt,comparison:null,comparisonReason:'Synthetic comparison unavailable',exceptions:[{id:'awaiting-first-dial',title:'Awaiting first dial',severity:'medium',count:20,previousCount:null,absoluteChange:null,percentageChange:null,detail:'Synthetic returned queue',byVendor:[{name:'Synthetic vendor',count:20}],bySource:[]}],populationNote:'Checks can overlap.'},
  '/api/analytics/lead-ledger/replica/coverage':coverage,
  ...window.__fixture?.payloads,
}};
installFixture();
const f=window.__fixture;
const fallbackFetch=window.fetch;
window.fetch=async (input:any,options:any={})=>{
  const url=new URL(String(input),'https://synthetic.invalid');
  if(url.pathname.startsWith('/api/analytics/offernet/lead-timeline/')){
    f.requests.push(url.pathname+url.search);
    return Response.json({success:true,data:{leadId:decodeURIComponent(url.pathname.split('/').at(-1)),consumerId:0,vendor:'Synthetic vendor',source:'Synthetic paid social',grade:'A',events:[],callEvidence:{status:'UNAVAILABLE',rowLimit:0,displayedCalls:0,reason:'Individual synthetic call times are not supplied.'}},metadata:{clientId:url.searchParams.get('clientId'),validationStatus:'NOT_VERIFIED'}});
  }
  if(!['/api/analytics/offernet/raw-leads','/api/analytics/lead-ledger/replica'].includes(url.pathname))return fallbackFetch(input,options);
  f.requests.push(url.pathname+url.search);
  const clientId=url.searchParams.get('clientId'),search=url.searchParams.get('search')||'',limit=Number(url.searchParams.get('limit'))||50,offset=Number(url.searchParams.get('offset'))||0;
  const metadata={clientId,startDate:url.searchParams.get('startDate'),endDate:url.searchParams.get('endDate'),filters:{},search,generatedAt,validationStatus:'NOT_VERIFIED',dateBasis:'fetched_cohort',timestampInterpretation:'Naive timestamps are UTC',sourceCutoff:'2026-10-01T23:59:59Z',timezone:'UTC'};
  const matches=(row:any)=>Object.values(row).some(value=>String(value??'').toLowerCase().includes(search.toLowerCase()));
  const matchingRows=rows.filter(matches);
  let data:any={...metadata,rows:matchingRows.slice(offset,offset+limit),totalCount:matchingRows.length,limit,offset,drill:null,drillValue:null,metadata};
  if(url.pathname.endsWith('/replica')){
    const leads=sourceLeads.filter(lead=>lead.records.some(record=>['Lead ID','Consumer ID','Offershop Source'].some(key=>String(record.raw[key]??'').toLowerCase().includes(search.toLowerCase()))));
    data={leads:leads.slice(offset,offset+limit),summary:{leads:leads.length,rows:leads.length,leadOnlyRows:0,revenue:[],duplicateKeyRows:0},vendors:[{vendor:'Synthetic vendor',leads:leads.length,rows:leads.length}],metadata:{...metadata,coverage,version:'synthetic-browser',queryJobId:null,offset,pageSize:limit,hasMore:offset+limit<leads.length,pagination:'Distinct lead pagination'}};
  }
  return Response.json({success:true,data,metadata});
};
const queryClient=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
registerQueryClientForSessionIsolation(queryClient);
updateAnalyticalSession({uid:'synthetic-user',role:'admin',status:'active',allowedTenants:['synthetic-a','synthetic-b'],isAdmin:true,isActive:true});
function Harness(){const navigate=useNavigate(),location=useLocation();f.navigate=navigate;f.location=location.pathname+location.search;return <AuthGate><FilterProvider><AppShell><AppRouter/></AppShell></FilterProvider></AuthGate>;}
const root=createRoot(document.getElementById('root')!);f.unmount=()=>root.unmount();
root.render(<QueryClientProvider client={queryClient}><BrowserRouter><ThemeProvider><Harness/></ThemeProvider></BrowserRouter></QueryClientProvider>);
`;

await build({
  stdin: { contents, resolveDir: root, loader: 'tsx' }, bundle: true, format: 'iife', platform: 'browser',
  outfile: path.join(out, 'fixture.js'), define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': '{}' },
  plugins: [{ name: 'isolated-synthetic-contexts', setup(b) {
    b.onResolve({ filter: /\/(AuthContext|ClientContext|firebase)$/ }, a => ({ path: a.path.split('/').at(-1), namespace: 'fixture' }));
    b.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: 'firestore', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: mocks[a.path], loader: 'tsx', resolveDir: root }));
  } }],
});
if (includeProductionCss) {
const cssNames = (await readdir(path.join(root, 'dist/assets'))).filter(name => name.endsWith('.css'));
const globalName = cssNames.find(name => name.startsWith('index-'));
if (!globalName) throw new Error('Run npm run build before building the synthetic fixture.');
await copyFile(path.join(root, 'dist/assets', globalName), path.join(out, 'application.css'));
}
await writeFile(path.join(out, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CX3 synthetic navigation and ledger</title>${includeProductionCss ? '<link rel="stylesheet" href="/application.css">' : ''}<link rel="stylesheet" href="/fixture.css"><style>body{margin:0}.synthetic-banner{position:fixed;bottom:0;right:0;z-index:10000;padding:3px 8px;background:#ffedc2;color:#493500;font:11px system-ui;pointer-events:none}@media(max-width:1023px){.synthetic-banner{bottom:58px}}</style></head><body><div class="synthetic-banner">SYNTHETIC QA · no customer data</div><div id="root"></div><script>window.__fixture={initialRoute:location.pathname+location.search,browserHistory:true};</script><script src="/fixture.js"></script></body></html>`);
await writeFile(path.join(out, 'README.txt'), 'Actual AppShell, AppRouter, LeadEvidenceWorkspace and API adapters; synthetic authentication, context and fetch responses. All requests terminate in this fixture. No production or customer data. Complete journey means all currently supported stages: only capture, delivery and first dial have timestamps; RPC, sale and activation are explicitly untimed. Only aggregate attempt counts exist, so RPC attempt ordinal and individual call timestamps cannot be tested or fabricated. Scenarios: complete, partial, untimed outcomes, no timeline, zero calls, sale without activation, long elapsed intervals, long identifiers, future timestamp, reversed timestamps, invalid and placeholder timestamps.\n');
return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`Synthetic fixture built at ${await buildLedgerTimelineFixture(process.argv[2] || '/private/tmp/cx3-ledger-timeline-fixture')}; browser verification is a separate step.`);
}
