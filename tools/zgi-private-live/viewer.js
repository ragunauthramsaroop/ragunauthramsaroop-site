"use strict";
const el=id=>document.getElementById(id);
const symbols=["02259","02899"];
const fmt=new Intl.NumberFormat("en-HK",{style:"currency",currency:"HKD",maximumFractionDigits:3});
const HKT=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Hong_Kong",year:"numeric",month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
let inFlight=false;
function withheld(message){
 for(const s of symbols){
  el("price-"+s).textContent="WITHHELD";
  el("state-"+s).textContent=message;
  el("date-"+s).textContent="No validated observation";
 }
 el("connection").textContent="SOURCE UNAVAILABLE";
 el("connection").dataset.ok="false";
 el("fetched").textContent="Unavailable";
}
async function refresh(){
 if(inFlight||document.hidden)return;
 inFlight=true;
 try{
  const response=await fetch("/api/snapshot",{cache:"no-store",credentials:"same-origin"});
  if(!response.ok)throw new Error("Provider unavailable");
  const payload=await response.json();
  if(payload.ok!==true||!Array.isArray(payload.quotes)||payload.quotes.length!==2)throw new Error("Invalid source");
  for(const quote of payload.quotes){
   if(!symbols.includes(quote.symbol)||quote.currency!=="HKD")throw new Error("Unexpected source identity");
   const value=Number(quote.lastTradePrice),dt=new Date(quote.lastTradeAt);
   if(!Number.isFinite(value)||value<=0||Number.isNaN(dt.getTime()))throw new Error("Invalid trade");
  }
  for(const quote of payload.quotes){
   const s=quote.symbol;
   el("price-"+s).textContent=fmt.format(Number(quote.lastTradePrice));
   el("state-"+s).textContent=quote.observationState+" · "+Math.floor(quote.ageSeconds)+" sec after last trade";
   el("date-"+s).textContent="LAST TRADE "+HKT.format(new Date(quote.lastTradeAt))+" HKT";
  }
  el("source").textContent="Webull Hong Kong OpenAPI personal account. The latest recorded exchange trade is displayed; a recent provider response is not proof of a new trade.";
  el("fetched").textContent=HKT.format(new Date(payload.fetchedAt))+" HKT";
  el("connection").textContent="BROKER RESPONSE VERIFIED";
  el("connection").dataset.ok="true";
 }catch{
  withheld("Account permission, connection or data unavailable");
 }finally{inFlight=false}
}
refresh();
setInterval(refresh,5000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
