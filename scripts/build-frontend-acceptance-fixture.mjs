/** Builds a synthetic routed app outside source. No production entry imports this. */
import {build} from 'esbuild';
import {mkdir,writeFile,readdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function buildAcceptanceFixture(out) {
  await mkdir(out,{recursive:true});
  const mocks={
    AuthContext:`export function useAuth(){const denied=window.__fixture?.denied;return {user:{uid:'synthetic-user',displayName:'Synthetic reviewer',email:'synthetic@example.invalid'},profile:{role:'admin',status:denied?'pending':'active'},loading:false,isAdmin:!denied,isActive:!denied,isPending:denied,isSuspended:false,accessState:denied?'PENDING':'ACTIVE',authError:null,signOut:()=>{},retryAuth:()=>{}}}`,
    ClientContext:`import {useSearchParams} from 'react-router-dom'; export function useClient(){const [p,set]=useSearchParams();const selectedClient=p.get('clientId')||'synthetic-a';const config={id:selectedClient,name:'Synthetic workspace',timezone:'Africa/Johannesburg',currency:'ZAR',colours:{},thresholds:{},metrics:{},capabilities:{}};return {selectedClient,clientId:selectedClient,clientConfig:config,clients:[{id:'synthetic-a',name:'Synthetic workspace A'},{id:'synthetic-b',name:'Synthetic workspace B'}],ready:true,loading:false,error:null,reportAuthenticationFailure:()=>{},retry:()=>{},setSelectedClient:id=>set(prev=>{const next=new URLSearchParams(prev);next.set('clientId',id);return next;})};}`,
    firebase:`export const db={}; export const auth={}; export const app={}; export const googleProvider={};`,
    firestore:`export const collection=(_db,name)=>name;export const query=(q,...args)=>q;export const orderBy=()=>{};export const limit=()=>{};export function onSnapshot(q,ok,fail){queueMicrotask(()=>window.__fixture.firestoreFailure?fail(new Error('Synthetic directory unavailable')):ok({forEach:()=>{}}));return ()=>{};}`,
  };
  await build({entryPoints:[path.join(root,'tests/frontend/fixture-entry.tsx')],bundle:true,format:'iife',platform:'browser',outfile:path.join(out,'fixture.js'),define:{'process.env.NODE_ENV':'"test"','import.meta.env':'{}'},plugins:[{name:'isolated-test-contexts',setup(b){
    b.onResolve({filter:/\/(AuthContext|ClientContext|firebase)$/},a=>({path:a.path.split('/').at(-1),namespace:'fixture'}));
    b.onResolve({filter:/^firebase\/firestore$/},()=>({path:'firestore',namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));
  }}]});
  const cssNames=(await readdir(path.join(root,'dist/assets')).catch(()=>[])).filter(f=>f.endsWith('.css'));
  // Production global stylesheet first; lazy feature styles follow their actual imports in fixture.css.
  const globalName=cssNames.find(f=>f.startsWith('index-'));
  if(globalName)await copyFile(path.join(root,'dist/assets',globalName),path.join(out,'application.css'));
  await writeFile(path.join(out,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CX3 synthetic acceptance</title><link rel="stylesheet" href="/application.css"><link rel="stylesheet" href="/fixture.css"><style>body{margin:0}.synthetic-banner{position:fixed;bottom:0;right:0;z-index:10000;padding:3px 8px;background:#ffedc2;color:#493500;font:11px system-ui;pointer-events:none}</style></head><body><div class="synthetic-banner">SYNTHETIC QA · no customer data</div><div id="root"></div><script>window.__fixture={initialRoute:location.pathname+location.search,browserHistory:true};</script><script src="/fixture.js"></script></body></html>`);
  return out;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(await buildAcceptanceFixture(process.argv[2]||'/private/tmp/cx3-frontend-acceptance-fixture'));
