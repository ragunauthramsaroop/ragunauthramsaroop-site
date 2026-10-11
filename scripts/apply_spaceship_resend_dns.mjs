#!/usr/bin/env node
/**
 * Owner-authorized, append-only Resend outbound DNS repair through Spaceship's API.
 * No action without SPACESHIP_API_KEY, SPACESHIP_API_SECRET and --apply.
 * Reads current private records and public website DNS; stops on conflict.
 */
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns/promises";
import {fileURLToPath} from "node:url";
const HERE=path.dirname(fileURLToPath(import.meta.url));
export const CONFIG=JSON.parse(fs.readFileSync(path.join(HERE,"../data/resend-dns.json"),"utf8"));
const ROOT=CONFIG.domain;
const API="https://spaceship.dev/api/v1/dns/records/"+encodeURIComponent(ROOT);
const lower=s=>String(s??"").trim().toLowerCase().replace(/\.$/,"");
const sorted=a=>[...a].map(lower).sort();
const cleanText=s=>String(s??"").replace(/"\s+"/g,"").replace(/^"|"$/g,"").trim();
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const expected=CONFIG.required.map(rec=>{
  const base={type:rec.type,name:rec.host,ttl:300};
  if(rec.type==="TXT")return {...base,value:rec.value};
  if(rec.type==="MX")return {...base,exchange:rec.value,preference:rec.priority};
  if(rec.type==="CNAME")return {...base,cname:rec.value};
  throw Error("Unexpected record type in approved manifest");
});
export function sameValue(existing,desired){
  if(existing.type!==desired.type||lower(existing.name)!==lower(desired.name))return false;
  if(desired.type==="TXT")return cleanText(existing.value)===cleanText(desired.value);
  if(desired.type==="CNAME")return lower(existing.cname)===lower(desired.cname);
  if(desired.type==="MX")return lower(existing.exchange)===lower(desired.exchange)&&Number(existing.preference)===desired.preference;
  return false;
}
export function plan(existing,approved=expected){
  if(!Array.isArray(existing))throw Error("Unrecognized Spaceship DNS list; stopping");
  const changes=[],already=[],conflicts=[];
  for(const wanted of approved){
    const atHost=existing.filter(x=>lower(x.name)===lower(wanted.name));
    const atType=atHost.filter(x=>x.type===wanted.type);
    if(atType.some(x=>sameValue(x,wanted))){already.push(wanted.name+" "+wanted.type);continue;}
    if(atType.length){conflicts.push(wanted.name+" "+wanted.type+" already exists with a different value");continue;}
    if(wanted.type==="CNAME"&&atHost.length){conflicts.push(wanted.name+" CNAME conflicts with another record at the same name");continue;}
    if(atHost.some(x=>x.type==="CNAME")){conflicts.push(wanted.name+" "+wanted.type+" conflicts with an existing CNAME");continue;}
    changes.push(wanted);
  }
  return {changes,already,conflicts};
}
export function websiteDNSIntact(actual,preserved=CONFIG.preserve){
  return eq(sorted(actual.root_A),sorted(preserved.root_A))
    &&eq(sorted(actual.www_CNAME),[lower(preserved.www_CNAME)])
    &&eq(sorted(actual.nameservers),sorted(preserved.nameservers));
}
async function websiteSnapshot(){
  const [root_A,www_CNAME,nameservers]=await Promise.all([dns.resolve4(ROOT),dns.resolveCname("www."+ROOT),dns.resolveNs(ROOT)]);
  return {root_A,www_CNAME,nameservers};
}
async function spaceship(method,url,body){
  const key=process.env.SPACESHIP_API_KEY,secret=process.env.SPACESHIP_API_SECRET;
  if(!key||!secret)throw Error("Required Spaceship GitHub Actions secrets are not configured");
  const response=await fetch(url,{method,headers:{"X-API-Key":key,"X-API-Secret":secret,accept:"application/json",...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error("Spaceship API "+method+" failed with HTTP "+response.status+"; no other DNS changes attempted");
  if(response.status===204)return null;
  return response.json();
}
async function list(){
  const result=[],perPage=500;
  for(let skip=0;skip<5000;skip+=perPage){
    const payload=await spaceship("GET",API+"?take="+perPage+"&skip="+skip);
    if(!payload||!Array.isArray(payload.items)||!Number.isInteger(payload.total))throw Error("Unexpected Spaceship DNS response; refusing to edit DNS");
    result.push(...payload.items);
    if(result.length>=payload.total)return result;
  }
  throw Error("DNS zone too large for safe automated review");
}
async function main(){
  const write=process.argv.includes("--apply");
  const before=await websiteSnapshot();
  if(!websiteDNSIntact(before))throw Error("Existing GitHub Pages website DNS differs from approved baseline. No edits performed.");
  const current=await list(),action=plan(current);
  console.log("Verified public A/www/NS website configuration unchanged.");
  console.log(JSON.stringify({mode:write?"apply":"dry-run",already:action.already,proposed:action.changes.map(x=>x.name+" "+x.type),conflicts:action.conflicts},null,2));
  if(action.conflicts.length)throw Error("Existing conflicting records require human review. No edits performed.");
  if(!write){console.log("DRY RUN: no records changed.");return;}
  if(action.changes.length){await spaceship("PUT",API,{force:false,items:action.changes});console.log("Spaceship acknowledged "+action.changes.length+" missing Resend outbound DNS entries.");}
  else console.log("All Resend outbound DNS entries already present. No edits needed.");
  const after=await list(),verification=plan(after);
  if(verification.conflicts.length||verification.changes.length)throw Error("Registrar did not return expected entries; inspect its dashboard before retrying.");
  if(!websiteDNSIntact(await websiteSnapshot()))throw Error("Website DNS changed during repair. Check authoritative DNS and hosting immediately.");
  console.log("PASS: Resend outbound DNS confirmed; website A/www/NS unchanged. Apex MX was not modified.");
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error("DNS REPAIR STOPPED: "+e.message);process.exitCode=1;});
