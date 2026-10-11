#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns/promises";
import {fileURLToPath} from "node:url";

const HERE=path.dirname(fileURLToPath(import.meta.url));
export const CONFIG=JSON.parse(fs.readFileSync(path.join(HERE,"../data/icloud-dns.json"),"utf8"));
const ROOT=CONFIG.domain;
const API="https://spaceship.dev/api/v1/dns/records/"+encodeURIComponent(ROOT);
const lower=s=>String(s??"").trim().toLowerCase().replace(/\.$/,"");
const cleanTxt=s=>String(s??"").replace(/"\s+"/g,"").replace(/^"|"$/g,"").trim();
const sorted=a=>[...a].map(lower).sort();
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function desiredRecord(rec){
  const base={type:rec.type,name:rec.host,ttl:3600};
  if(rec.type==="TXT")return {...base,value:rec.value};
  if(rec.type==="CNAME")return {...base,cname:rec.value};
  if(rec.type==="MX")return {...base,exchange:rec.value,preference:rec.priority};
  throw Error("Unsupported record type "+rec.type);
}
function same(existing,wanted){
  if(existing.type!==wanted.type||lower(existing.name)!==lower(wanted.name))return false;
  if(wanted.type==="TXT")return cleanTxt(existing.value)===cleanTxt(wanted.value);
  if(wanted.type==="CNAME")return lower(existing.cname)===lower(wanted.cname);
  if(wanted.type==="MX")return lower(existing.exchange)===lower(wanted.exchange)&&Number(existing.preference)===Number(wanted.preference);
  return false;
}
async function spaceship(method,body){
  const key=process.env.SPACESHIP_API_KEY,secret=process.env.SPACESHIP_API_SECRET;
  if(!key||!secret)throw Error("Spaceship GitHub Actions credentials are missing");
  const r=await fetch(API+(method==="GET"?"?take=500&skip=0":""),{
    method,
    headers:{"X-API-Key":key,"X-API-Secret":secret,accept:"application/json",...(body?{"Content-Type":"application/json"}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)
  });
  if(!r.ok)throw Error("Spaceship "+method+" failed with HTTP "+r.status);
  if(r.status===204)return null;
  return r.json();
}
async function list(){
  const payload=await spaceship("GET");
  if(!payload||!Array.isArray(payload.items)||!Number.isInteger(payload.total))throw Error("Unexpected Spaceship DNS response");
  if(payload.total>500)throw Error("DNS zone exceeds safe single-page migration limit");
  return payload.items;
}
async function websiteSnapshot(){
  const [root_A,www_CNAME,nameservers]=await Promise.all([dns.resolve4(ROOT),dns.resolveCname("www."+ROOT),dns.resolveNs(ROOT)]);
  return {root_A,www_CNAME,nameservers};
}
function websiteIntact(actual){
  const p=CONFIG.preserve;
  return eq(sorted(actual.root_A),sorted(p.root_A))&&eq(sorted(actual.www_CNAME),[lower(p.www_CNAME)])&&eq(sorted(actual.nameservers),sorted(p.nameservers));
}
function rootSpf(records){return records.filter(r=>r.type==="TXT"&&lower(r.name)==="@"&&cleanTxt(r.value).toLowerCase().startsWith("v=spf1"));}
function apexMx(records){return records.filter(r=>r.type==="MX"&&lower(r.name)==="@");}
function exactSet(records,wanted){
  return records.length===wanted.length&&wanted.every(w=>records.some(r=>same(r,w)));
}
async function put(records){if(records.length)await spaceship("PUT",{force:false,items:records});}
async function del(records){if(records.length)await spaceship("DELETE",records.map(r=>{const x={type:r.type,name:r.name};if(r.type==="MX")return {...x,exchange:r.exchange,preference:r.preference};if(r.type==="TXT")return {...x,value:r.value};if(r.type==="CNAME")return {...x,cname:r.cname};return x;}));}

export function prestagePlan(records){
  const wanted=CONFIG.prestage.map(desiredRecord),add=[],conflicts=[];
  const spfs=rootSpf(records);
  const wantedSpf=wanted.find(x=>x.type==="TXT");
  if(spfs.length>1)conflicts.push("Multiple root SPF records exist");
  else if(spfs.length===1&&!same(spfs[0],wantedSpf))conflicts.push("Existing root SPF differs; merge manually before migration");
  else if(spfs.length===0)add.push(wantedSpf);
  const dkim=wanted.find(x=>x.type==="CNAME");
  const atDkim=records.filter(r=>lower(r.name)===lower(dkim.name));
  if(atDkim.some(r=>same(r,dkim))){/* already */}
  else if(atDkim.length)conflicts.push("sig1._domainkey is already occupied by another record");
  else add.push(dkim);
  return {add,conflicts};
}

async function prestage(){
  if(!websiteIntact(await websiteSnapshot()))throw Error("Website DNS baseline changed; refusing email DNS edits");
  const records=await list(),plan=prestagePlan(records);
  console.log(JSON.stringify({phase:"prestage",proposed:plan.add.map(x=>x.name+" "+x.type),conflicts:plan.conflicts},null,2));
  if(plan.conflicts.length)throw Error(plan.conflicts.join("; "));
  await put(plan.add);
  const after=prestagePlan(await list());
  if(after.conflicts.length||after.add.length)throw Error("Prestage verification failed");
  if(!websiteIntact(await websiteSnapshot()))throw Error("Website DNS changed during prestage");
  console.log("PASS: Apple SPF and DKIM prestaged; existing inbound MX unchanged.");
}

async function cutover(){
  const verify=String(CONFIG.apple_verification_txt??"").trim();
  if(!verify.startsWith("apple-domain=")||verify.length<20)throw Error("Missing exact Apple apple-domain= verification TXT from iCloud setup");
  if(!websiteIntact(await websiteSnapshot()))throw Error("Website DNS baseline changed; refusing cutover");
  let records=await list();
  const pre=prestagePlan(records);
  if(pre.conflicts.length)throw Error(pre.conflicts.join("; "));
  await put(pre.add);
  records=await list();
  const verifyWanted=desiredRecord({host:"@",type:"TXT",value:verify});
  if(!records.some(r=>same(r,verifyWanted)))await put([verifyWanted]);
  records=await list();
  const oldMx=desiredRecord(CONFIG.current_resend_inbound_mx);
  const appleMx=CONFIG.cutover_mx.map(desiredRecord);
  const current=apexMx(records);
  if(exactSet(current,appleMx)){console.log("Apple MX already active; cutover is idempotently complete.");return;}
  if(!exactSet(current,[oldMx]))throw Error("Apex MX is not exactly the approved Resend pre-cutover value; refusing replacement");
  await del([oldMx]);
  await put(appleMx);
  const after=await list(),afterMx=apexMx(after);
  if(!exactSet(afterMx,appleMx))throw Error("Apple MX replacement did not verify at registrar");
  if(!after.some(r=>same(r,verifyWanted)))throw Error("Apple verification TXT missing after cutover");
  if(!websiteIntact(await websiteSnapshot()))throw Error("Website DNS changed during cutover");
  console.log("PASS: apex MX now points only to Apple's two iCloud mail exchangers. Finish setup in iCloud immediately.");
}

async function rollback(){
  if(!websiteIntact(await websiteSnapshot()))throw Error("Website DNS baseline changed; refusing rollback");
  const records=await list(),appleMx=CONFIG.cutover_mx.map(desiredRecord),oldMx=desiredRecord(CONFIG.current_resend_inbound_mx),current=apexMx(records);
  if(exactSet(current,[oldMx])){console.log("Resend inbound MX already restored.");return;}
  if(!exactSet(current,appleMx))throw Error("Apex MX is not exactly the approved Apple pair; refusing rollback");
  await del(appleMx);await put([oldMx]);
  if(!exactSet(apexMx(await list()),[oldMx]))throw Error("Rollback verification failed");
  console.log("PASS: Resend inbound MX restored.");
}

const mode=process.argv[2];
if(mode==="--prestage")prestage().catch(e=>{console.error("ICLOUD PRESTAGE STOPPED: "+e.message);process.exitCode=1;});
else if(mode==="--cutover")cutover().catch(e=>{console.error("ICLOUD CUTOVER STOPPED: "+e.message);process.exitCode=1;});
else if(mode==="--rollback")rollback().catch(e=>{console.error("ICLOUD ROLLBACK STOPPED: "+e.message);process.exitCode=1;});
else {console.error("Usage: node scripts/icloud_dns_migration.mjs --prestage|--cutover|--rollback");process.exitCode=2;}
