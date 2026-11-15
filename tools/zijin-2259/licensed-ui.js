/* Authorised HKEX Basic Market Prices access and licensed vendor integration.
   Free BMP quotes stay at the provider's website, manually requested.
   No HTML scraping, no BMP auto polling or data entitlements invented.
   A separate licensed full-data vendor API is disabled unless explicitly configured.
*/
(()=>{"use strict";
 const $=id=>document.getElementById(id);
 const dateFmt=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Hong_Kong",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
 const money=n=>Number.isFinite(n)?"HK$"+new Intl.NumberFormat("en-HK",{maximumFractionDigits:2,minimumFractionDigits:2}).format(n):"—";
 const status=$("licensed-status"),button=$("licensed-refresh"),badge=$("licensed-connection-state");
 if(!status||!button||!badge)return;
 const endpoint=(location.hostname.endsWith(".vercel.app")||location.hostname==="localhost"?"":"https://zijin-2259-intelligence.vercel.app")+"/api/licensed-quote";
 let checking=false,streaming=false,timer=null;
 function set(id,value){const el=$(id);if(el)el.textContent=String(value)}
 function clear(){
  for(const code of ["2259","2899"]){set("licensed-"+code+"-price","—");set("licensed-"+code+"-meta","No connected licensed source")}
 }
 async function quote(symbol){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),7000);
  try {
   const response=await fetch(endpoint+"?symbol="+encodeURIComponent(symbol),{method:"GET",cache:"no-store",headers:{"Accept":"application/json"},signal:controller.signal});
   const payload=await response.json();
   if(!response.ok||!payload.ok)return {ok:false,message:payload.message||"Provider not available",status:payload.status||"not_connected"};
   if(payload.symbol!==symbol||payload.currency!=="HKD"||!payload.licensedDisplay||!Number.isFinite(payload.price)||payload.price<=0||!Number.isFinite(Date.parse(payload.quoteTimestamp)))throw Error("Failed quote integrity validation");
   return payload;
  }catch{return {ok:false,status:"unavailable",message:"Licensed quote connection unavailable"}}
  finally{clearTimeout(timeout)}
 }
 async function refresh(){
  if(checking)return;checking=true;button.disabled=true;
  status.textContent="Checking server-side licensed market-data access. No vendor credentials travel to the browser.";
  try{
   const [one,two]=await Promise.all([quote("2259.HK"),quote("2899.HK")]);
   const any=[one,two].some(v=>v.ok);
   if(!any){
    streaming=false;badge.textContent="ON-SITE LICENCE NOT CONNECTED";
    clear();
    status.textContent="No HKEX-licensed on-site entitlement has been configured. Use the authorised external BMP vendor above for a user-requested live snapshot. Delayed analytics remain available below.";
   }else{
    badge.textContent="LICENSED VENDOR CONNECTED";
    for(const [code,v] of [["2259",one],["2899",two]]){
      if(!v.ok){set("licensed-"+code+"-price","UNAVAILABLE");set("licensed-"+code+"-meta","Licensed vendor did not return a verified quote");continue}
      set("licensed-"+code+"-price",money(v.price));
      set("licensed-"+code+"-meta",(v.currentExchangeSessionSnapshot?"RECENT LICENSED MARKET OBSERVATION":"LAST LICENSED EXCHANGE OBSERVATION")+" · "+dateFmt.format(new Date(v.quoteTimestamp))+" HKT · "+v.provider);
    }
    streaming=[one,two].some(v=>v.ok&&v.automaticRefreshLicensed);
    status.textContent="Quotes originate from the connected licensed vendor. "+(streaming?"The vendor contract permits automatic on-site updates.":"Automatic refreshing remains disabled until the applicable streaming rights are confirmed.")+" Research-history and statistical forecasts below remain on their separately timestamped delayed data source.";
   }
  }finally{button.disabled=false;checking=false}
 }
 button.addEventListener("click",refresh);
 // No repeated requests of unlicensed, snapshot-only BMP services.
 // Automatic requests to an integrated service run only after a vendor authorises streaming.
 timer=setInterval(()=>{if(streaming&&document.visibilityState==="visible")refresh()},60000);
 refresh();
})();
