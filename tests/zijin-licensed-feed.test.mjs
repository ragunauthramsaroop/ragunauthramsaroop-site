import test from "node:test";
import assert from "node:assert/strict";
import handler from "../tools/zijin-2259/api/licensed-quote.js";
import {readFileSync} from "node:fs";
const apiSource=readFileSync("tools/zijin-2259/api/licensed-quote.js","utf8");
const html=readFileSync("tools/zijin-2259/index.html","utf8");
const client=readFileSync("tools/zijin-2259/licensed-ui.js","utf8");
const configKeys=["ZGI_HKEX_VENDOR_QUOTE_URL","ZGI_HKEX_VENDOR_API_KEY","ZGI_HKEX_VENDOR_NAME","ZGI_HKEX_PUBLIC_DISPLAY_AUTHORIZED","ZGI_HKEX_AUTOMATIC_REFRESH_AUTHORIZED"];
function mockRes(){
 const o={code:200,headers:{},payload:null};
 o.setHeader=(key,value)=>{o.headers[key]=value};
 o.status=code=>{o.code=code;return o};
 o.json=data=>{o.payload=data;return o};
 o.end=()=>o;return o;
}
async function withConfig(settings,callback){
 const previous=Object.fromEntries(configKeys.map(k=>[k,process.env[k]]));
 const oldFetch=globalThis.fetch;
 try{
  for(const k of configKeys)delete process.env[k];
  for(const [k,v] of Object.entries(settings))process.env[k]=v;
  return await callback();
 }finally{
  for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v}
  globalThis.fetch=oldFetch;
 }
}
test("no license returns 503 rather than invented real-time quotes",async()=>{
 await withConfig({},async()=>{
  const res=mockRes();await handler({method:"GET",query:{symbol:"2259.HK"}},res);
  assert.equal(res.code,503);
  assert.equal(res.payload.ok,false);
  assert.equal(res.payload.licensedRealtime,false);
  assert.equal(res.payload.status,"not_connected");
  assert.match(res.payload.freeSnapshotAlternative,/etnet\.com\.hk/);
  assert.match(res.headers["Cache-Control"],/no-store/);
 });
});
test("licensed-only endpoint rejects Apple and unrelated symbols",async()=>{
 await withConfig({},async()=>{
  const res=mockRes();await handler({method:"GET",query:{symbol:"AAPL"}},res);
  assert.equal(res.code,400);
 });
});
test("vendor response checked against exact HKEX symbol, HKD and timestamps",async()=>{
 const env={ZGI_HKEX_PUBLIC_DISPLAY_AUTHORIZED:"true",ZGI_HKEX_VENDOR_QUOTE_URL:"https://api.vendor.example/v1/quotes",ZGI_HKEX_VENDOR_API_KEY:"test-secret-do-not-disclose",ZGI_HKEX_VENDOR_NAME:"Test Licensed Vendor"};
 await withConfig(env,async()=>{
  globalThis.fetch=async(u,opts)=>{
   assert.match(String(u),/symbol=2259\.HK/);
   assert.equal(opts.redirect,"error");
   assert.equal(opts.headers.Authorization,"Bearer test-secret-do-not-disclose");
   return {ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify({
    symbol:"2259.HK",currency:"HKD",price:121.2,previousClose:126.5,
    exchange:"XHKG",quoteTimestamp:"2026-11-13T08:08:15.000Z"
   })};
  };
  const res=mockRes();await handler({method:"GET",query:{symbol:"2259.HK"}},res);
  assert.equal(res.code,200);
  assert.equal(res.payload.price,121.2);
  assert.equal(res.payload.licensedDisplay,true);
  assert.equal(res.payload.automaticRefreshLicensed,false);
  assert.equal(res.payload.currentExchangeSessionSnapshot,false);
  assert.doesNotMatch(JSON.stringify(res.payload),/test-secret-do-not-disclose/);
 });
});
test("invalid market identity triggers error without returning vendor data",async()=>{
 const env={ZGI_HKEX_PUBLIC_DISPLAY_AUTHORIZED:"true",ZGI_HKEX_VENDOR_QUOTE_URL:"https://api.vendor.example/quote",ZGI_HKEX_VENDOR_API_KEY:"test-secret",ZGI_HKEX_VENDOR_NAME:"Test Vendor"};
 await withConfig(env,async()=>{
  globalThis.fetch=async()=>({ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify({symbol:"AAPL",currency:"USD",price:330,exchange:"NASDAQ",quoteTimestamp:"2026-11-13T08:08:15.000Z"})});
  const res=mockRes();await handler({method:"GET",query:{symbol:"2259.HK"}},res);
  assert.equal(res.code,502);
  assert.equal(res.payload.status,"invalid_source");
 });
});
test("vendor localhost URL is rejected even when entitlement flag is set",async()=>{
 await withConfig({ZGI_HKEX_PUBLIC_DISPLAY_AUTHORIZED:"true",ZGI_HKEX_VENDOR_QUOTE_URL:"https://localhost/admin",ZGI_HKEX_VENDOR_API_KEY:"test-secret",ZGI_HKEX_VENDOR_NAME:"Test Vendor"},async()=>{
  const res=mockRes();await handler({method:"GET",query:{symbol:"2259.HK"}},res);
  assert.equal(res.code,503);
 });
});
test("manual BMP is separated from licensed continuous feed",()=>{
 assert.match(html,/OPEN AUTHORISED LIVE QUOTE SERVICE/);
 assert.match(html,/https:\/\/www\.etnet\.com\.hk\/www\/eng\/stocks\/realtime\/index\.php/);
 assert.match(html,/id="licensed-2259-price"/);
 assert.match(html,/id="licensed-2899-price"/);
 assert.match(client,/if\(streaming&&document\.visibilityState==="visible"\)refresh\(\)/);
 assert.match(apiSource,/ZGI_HKEX_AUTOMATIC_REFRESH_AUTHORIZED/);
 assert.doesNotMatch(client,/etnet\.com\.hk\/.*fetch/);
});
