/** Explicit synthetic fixture builder; never imported by or published with the app. */
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const root = process.cwd();
const out = path.join(os.tmpdir(), 'cx3-readiness-browser-fixture');
await mkdir(out, { recursive: true });
const mocks = {
  ClientContext: `export function useClient() { return window.__fixture.client; }`,
  AuthContext: `export function useAuth() { return {isAdmin:true}; }`,
  FilterContext: `export function useFilters() { return {filterError:null,filters:{},startDate:'2026-09-01',endDate:'2026-09-28'}; }`,
  ThemeContext: `import React from 'react'; export function useTheme() { const [theme,setTheme]=React.useState('light'); React.useEffect(()=>{document.documentElement.dataset.theme=theme==='system'?'light':theme},[theme]); return {theme,resolvedTheme:theme==='system'?'light':theme,setTheme}; }`,
  useTableDensity: `import React from 'react'; export function useTableDensity() {const [density,setDensity]=React.useState('comfortable');return {density,setDensity};}`,
};
const contents = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter, Link, Routes, Route} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import AnalyticsReadinessPanel from './src/shared/reporting/AnalyticsReadinessPanel';
import Settings from './src/pages/Settings';
import {registerQueryClientForSessionIsolation,updateAnalyticalSession} from './src/lib/analyticalSession';
const client = {selectedClient:'synthetic-a', clientConfig:{name:'Synthetic workspace A',timezone:'UTC'}, ready:true,loading:false,error:null,reportAuthenticationFailure:()=>{}};
window.__fixture={client, fail:false, calls:[],delay:30};
const clock='2026-09-29T06:00:00.000Z';
const sources=[{key:'leads',label:'Lead ledger',status:'OBSERVED',rowCount:12,missingTimestampRows:2,latestRecordAt:'2026-09-28T06:00:00Z'},{key:'calls',label:'Call source',status:'EMPTY',rowCount:0,missingTimestampRows:0,latestRecordAt:null},{key:'marketing',label:'Marketing',status:'MAPPING_REQUIRED',rowCount:null,latestRecordAt:null},{key:'diallerRealtime',label:'Live dialler',status:'UNCONFIGURED',rowCount:null,latestRecordAt:null}];
window.fetch=async (url,options={})=>{
 const u=new URL(String(url),location.origin); const id=u.searchParams.get('clientId');
 const fail=window.__fixture.fail,delay=window.__fixture.delay;
 window.__fixture.calls.push({url:u.pathname+u.search,clientId:id});
 await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,delay);options.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'))},{once:true});});
 if(fail) return new Response(JSON.stringify({success:false,error:'Synthetic source failure'}),{status:503});
 if(u.pathname.endsWith('/source-observability'))return Response.json({success:true,metadata:{clientId:id},data:{generatedAt:clock,sources:id==='synthetic-a'?sources:[{key:'leads',label:'Workspace B lead source',status:'EMPTY',rowCount:0,latestRecordAt:null}]}});
 if(u.pathname.endsWith('/google/status'))return Response.json({success:true,data:{clientId:id,timestamp:clock,workspace:id,bigquery:{status:'Connected',projectId:'synthetic-project',latencyMs:0,latestData:null},gemini:{status:'Error',hasKey:true,model:'synthetic-model'},identity:{authMode:'fixture'}}});
 return Response.json({success:false,error:'Fixture does not implement this endpoint'},{status:404});
};
const queryClient=new QueryClient();registerQueryClientForSessionIsolation(queryClient);
function setSession(){updateAnalyticalSession({uid:'synthetic-user',role:'admin',status:'active',allowedTenants:[client.selectedClient],isAdmin:true,isActive:true});}setSession();
function Fixture(){const [,render]=React.useReducer(x=>x+1,0);return <QueryClientProvider client={queryClient}><BrowserRouter><header className="fixture-banner"><h1>CX3 synthetic browser fixture</h1><p>Actual readiness and Settings components; synthetic context and network. Not production data or full-app authentication QA.</p><nav><Link to="/overview">Overview fixture</Link><Link to="/admin">Settings fixture</Link><button onClick={()=>{client.selectedClient=client.selectedClient==='synthetic-a'?'synthetic-b':'synthetic-a';client.clientConfig={...client.clientConfig,name:client.selectedClient==='synthetic-a'?'Synthetic workspace A':'Synthetic workspace B'};setSession();render();}}>Switch synthetic workspace</button></nav></header><main><Routes><Route path="/admin" element={<Settings/>}/><Route path="*" element={<AnalyticsReadinessPanel/>}/></Routes></main></BrowserRouter></QueryClientProvider>;}createRoot(document.getElementById('root')).render(<Fixture/>);
`;
await build({stdin:{contents,resolveDir:root,loader:'tsx'},bundle:true,format:'iife',platform:'browser',outfile:path.join(out,'fixture.js'),define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'isolated-contexts',setup(b){
 b.onResolve({filter:/\/(ClientContext|AuthContext|FilterContext|ThemeContext|useTableDensity)$/}, args=>({path:args.path.split('/').at(-1),namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'tsx',resolveDir:root}));
}}]});
const tokens=await readFile(path.join(root,'src/styles/tokens.css'),'utf8');
await writeFile(path.join(out,'tokens.css'),tokens.replace(/@theme inline\s*\{[\s\S]*?\}\s*$/,''));
await writeFile(path.join(out,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'"><title>CX3 synthetic readiness QA</title><link rel="stylesheet" href="tokens.css"><link rel="stylesheet" href="fixture.css"><style>body{margin:0;background:var(--cx-canvas);color:var(--cx-text);font:14px/1.6 system-ui}.fixture-banner{padding:20px 24px;border-bottom:1px solid var(--cx-border)}.fixture-banner h1{font-size:20px;margin:0}.fixture-banner p{max-width:900px}nav{display:flex;flex-wrap:wrap;gap:12px}button,a{font:inherit}button,.cx-button-secondary{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--cx-control-border);border-radius:6px;color:var(--cx-text);background:var(--cx-surface);cursor:pointer}button:disabled{cursor:wait}button:focus-visible,a:focus-visible{outline:2px solid var(--cx-focus);outline-offset:3px}main{max-width:1500px;margin:auto}h3 svg,strong svg{display:inline-block;vertical-align:middle}.cx-settings-page{padding:24px}@media(max-width:640px){.cx-settings-page{padding:12px}.fixture-banner{padding:16px}}</style></head><body><div id="root"></div><script src="fixture.js"></script></body></html>`);
await writeFile(path.join(out,'README.txt'),'Synthetic browser fixture: actual AnalyticsReadinessPanel, SourceEvidenceCards, Settings, useOperationalData and React Query. Context and network are deliberately mocked. No credential or live-data access. Serve this directory on localhost; never deploy it as the production site.\n');
console.log(`Fixture built at ${out}. This is not a production build or a completed browser test.`);
