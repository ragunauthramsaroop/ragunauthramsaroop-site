#!/usr/bin/env node
/* Public DNS readiness checker. Reads DNS only. Never mutates registrar records. */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const here=path.dirname(fileURLToPath(import.meta.url));
const CONFIG=JSON.parse(fs.readFileSync(path.join(here,"../data/resend-dns.json"),"utf8"));
const domain=CONFIG.domain;
export function cleanTXT(value){
  return String(value??"").replace(/"\s+"/g,"").replace(/^"|"$/g,"").replace(/\\"/g,'"').trim();
}
export function normalizedName(v){return String(v??"").trim().toLowerCase().replace(/\.$/,"")}
export function matchesRecord(record,answers){
  const list=(answers??[]).filter(x=>normalizedName(x.name)===normalizedName(record.host+"."+domain));
  if(record.type==="TXT")return list.some(x=>x.type===16&&cleanTXT(x.data)===record.value);
  if(record.type==="CNAME")return list.some(x=>x.type===5&&normalizedName(x.data)===normalizedName(record.value));
  if(record.type==="MX")return list.some(x=>{
    if(x.type!==15)return false;
    const m=String(x.data??"").trim().match(/^(\d+)\s+(\S+)$/);
    return m&&Number(m[1])===record.priority&&normalizedName(m[2])===normalizedName(record.value);
  });
  if(record.type==="A")return list.some(x=>x.type===1&&String(x.data)===record.value);
  if(record.type==="NS")return list.some(x=>x.type===2&&normalizedName(x.data)===normalizedName(record.value));
  return false;
}
async function query(name,type){
  const args=new URLSearchParams({name,type});
  const endpoints=["https://dns.google/resolve?"+args,"https://cloudflare-dns.com/dns-query?"+args];
  let lastError;
  for(const url of endpoints){
    try{
      const r=await fetch(url,{headers:{accept:"application/dns-json"},signal:AbortSignal.timeout(11000)});
      if(!r.ok)throw Error("DNS HTTP "+r.status);
      const payload=await r.json();
      if(typeof payload.Status!=="number")throw Error("Unrecognized DNS response");
      return {answer:payload.Answer??[],rcode:payload.Status,source:new URL(url).hostname};
    }catch(e){lastError=e}
  }
  throw Error("Public DNS unavailable from both resolvers: "+String(lastError?.message??lastError));
}
export async function audit(){
  const results=[];
  for(const record of CONFIG.required){
    const queryName=record.host+"."+domain;
    try{
      const r=await query(queryName,record.type);
      results.push({...record,name:queryName,present:matchesRecord(record,r.answer),observed:r.answer.map(x=>({type:x.type,data:x.data})),resolver:r.source});
    }catch(e){results.push({...record,name:queryName,present:false,error:String(e.message)})}
  }
  const protect={};
  for(const [name,type] of [[domain,"A"],["www."+domain,"CNAME"],[domain,"NS"],[domain,"MX"]]){
    try{const r=await query(name,type);protect[name+" "+type]=r.answer.map(x=>x.data)}catch(e){protect[name+" "+type]={error:String(e.message)}}
  }
  const missing=results.filter(x=>!x.present);
  const errors=results.filter(x=>x.error);
  return {checkedAt:new Date().toISOString(),domain,provider:CONFIG.dns_provider,
    ready:missing.length===0,missing:missing.map(x=>x.name+" "+x.type),
    errors:errors.map(x=>x.error),results,websiteDNS:protect};
}
function safe(s){return String(s).replace(/\|/g,"\\|").replace(/[\r\n]/g," ")}
function summary(report){
  let s="## Resend DNS readiness: "+(report.ready?"READY":"NOT READY")+"\n\n";
  s+="Checked: "+report.checkedAt+" | Provider: "+report.provider+"\n\n";
  s+="| Host | Type | Result |\n|---|---|---|\n";
  for(const r of report.results)s+="| "+safe(r.name)+" | "+r.type+" | "+(r.error?"CHECK ERROR":r.present?"Present":"Missing / mismatch")+" |\n";
  s+="\nWebsite and root mail DNS (read only):\n\n";
  for(const [k,v] of Object.entries(report.websiteDNS))s+="- "+safe(k)+": "+safe(JSON.stringify(v))+"\n";
  s+="\nCorrect missing records in Spaceship Advanced DNS only after reviewing root MX for mail-provider conflicts. Do not change the working GitHub Pages records.\n";
  return s;
}
async function main(){
  const r=await audit(),markdown=summary(r);
  console.log(markdown);
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,markdown);
  if(process.argv.includes("--json"))console.log(JSON.stringify(r));
  if(process.argv.includes("--strict")&&!r.ready)process.exitCode=r.errors.length?3:2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=3});
