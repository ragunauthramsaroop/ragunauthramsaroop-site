/*
 * Read-only HKEX licensed quote adapter. No credentials or rights = no data.
 * The licensee must configure its own authorised JSON relay, with actual rights
 * to redistribute data to THIS website. The relay is never exposed in HTML.
 *
 * Environment variables (production):
 * ZGI_HKEX_VENDOR_QUOTE_URL: https://your-authorised-vendor-relay.example/api/quote
 * ZGI_HKEX_VENDOR_API_KEY: secret
 * ZGI_HKEX_VENDOR_NAME: public vendor attribution
 * ZGI_HKEX_PUBLIC_DISPLAY_AUTHORIZED=true
 * ZGI_HKEX_AUTOMATIC_REFRESH_AUTHORIZED=true (optional, only full streaming right)
 *
 * Relay must return: symbol, currency, price, quoteTimestamp,
 * previousClose, optional bid, ask, volume, exchange.
 * 2259.HK and 2899.HK only, never gold futures.
 * No scraping or vendor website framing.
 */
const allowed=new Set(["2259.HK","2899.HK"]);
const err=(res,status,message,extra={})=>res.status(status).json({ok:false,message,...extra});
const isSafeProviderEndpoint=(raw)=>{
  try{
    const u=new URL(raw);
    if(u.protocol!=="https:"||u.username||u.password||u.hash||u.port&&u.port!=="443")return false;
    const host=u.hostname.toLowerCase();
    if(!/^[a-z0-9.-]+$/.test(host)||host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host.endsWith(".internal")||host.endsWith(".test"))return false;
    if(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)||host.startsWith("127.")||host==="0.0.0.0"||host==="169.254.169.254")return false;
    if(!host.includes("."))return false;
    return true;
  }catch{return false}
};
const getHktParts=date=>{
 const v=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Hong_Kong",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
 const part=key=>v.find(x=>x.type===key)?.value;
 return {weekday:part("weekday"),minutes:Number(part("hour"))*60+Number(part("minute"))};
};
module.exports = async function handler(req,res){
 res.setHeader("Content-Type","application/json; charset=utf-8");
 res.setHeader("Cache-Control","private, no-store, max-age=0");
 res.setHeader("Access-Control-Allow-Origin","https://zijin-2259-intelligence.vercel.app");
 res.setHeader("Access-Control-Allow-Methods","GET, OPTIONS");
 if(req.method==="OPTIONS")return res.status(204).end();
 if(req.method!=="GET")return err(res,405,"GET only");
 const configured=process.env.ZGI_HKEX_PUBLIC_DISPLAY_AUTHORIZED==="true"&&Boolean(process.env.ZGI_HKEX_VENDOR_API_KEY)&&Boolean(process.env.ZGI_HKEX_VENDOR_NAME)&&isSafeProviderEndpoint(process.env.ZGI_HKEX_VENDOR_QUOTE_URL);
 const symbol=typeof req.query?.symbol==="string"?req.query.symbol:"2259.HK";
 if(!allowed.has(symbol))return err(res,400,"Unsupported HKEX instrument");
 if(!configured){
   return err(res,503,"No licensed on-site quote entitlement configured",{
    status:"not_connected",licensedRealtime:false,freeSnapshotAlternative:"https://www.etnet.com.hk/www/eng/stocks/realtime/index.php",
    note:"Manual user-initiated BMP snapshots are available on authorised vendors' own websites, not in this unlicensed dashboard."
   });
 }
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5500);
 try {
  const url=new URL(process.env.ZGI_HKEX_VENDOR_QUOTE_URL);url.searchParams.set("symbol",symbol);
  const response=await fetch(url,{method:"GET",redirect:"error",headers:{"Accept":"application/json","Authorization":"Bearer "+process.env.ZGI_HKEX_VENDOR_API_KEY},signal:controller.signal});
  if(!response.ok)return err(res,502,"Licensed source failed",{licensedRealtime:false,status:"upstream_error"});
  const size=Number(response.headers.get("content-length"));
  if(size>30000)return err(res,502,"Oversized market response");
  const raw=await response.text();
  if(raw.length>30000)return err(res,502,"Oversized market response");
  const data=JSON.parse(raw);
  const price=Number(data?.price),prev=Number(data?.previousClose),t=new Date(data?.quoteTimestamp);
  const exchange=String(data?.exchange||"XHKG").toUpperCase();
  if(data?.symbol!==symbol||data?.currency!=="HKD"||!["XHKG","HKEX","HKG","SEHK"].includes(exchange)||!Number.isFinite(price)||price<=0||!Number.isFinite(t.getTime())){
   return err(res,502,"Licensed source identity verification failed",{licensedRealtime:false,status:"invalid_source"});
  }
  const ageMs=Date.now()-t.getTime();
  if(ageMs< -60000||ageMs>14*24*3600*1000)return err(res,502,"Licensed quote timestamp outside accepted range",{status:"invalid_timestamp",licensedRealtime:false});
  const hkt=getHktParts(t);
  const marketHours=!["Sat","Sun"].includes(hkt.weekday)&&((hkt.minutes>=570&&hkt.minutes<720)||(hkt.minutes>=780&&hkt.minutes<=970));
  // A recent timestamp alone never proves a trade is exchange-real-time; authorization is configured out-of-band.
  const current=marketHours&&ageMs>=0&&ageMs<=5*60000;
  const result={ok:true,symbol,currency:"HKD",price,previousClose:Number.isFinite(prev)&&prev>0?prev:null,
   change:Number.isFinite(prev)&&prev>0?price-prev:null,
   changePercent:Number.isFinite(prev)&&prev>0?(price/prev-1)*100:null,
   quoteTimestamp:t.toISOString(),provider:String(process.env.ZGI_HKEX_VENDOR_NAME).slice(0,70),
   exchange,licensedDisplay:true,automaticRefreshLicensed:process.env.ZGI_HKEX_AUTOMATIC_REFRESH_AUTHORIZED==="true",currentExchangeSessionSnapshot:current,
   status:current?"licensed_recent_snapshot":"licensed_last_observation",
   dataDelay:current?"Vendor-authorised recent exchange observation":"Vendor-licensed prior exchange observation. Not a current tick.",
   fetchedAt:new Date().toISOString()};
  return res.status(200).json(result);
 }catch{return err(res,502,"Licensed quote endpoint unavailable",{status:"unavailable",licensedRealtime:false})}
 finally{clearTimeout(timeout)}
}
