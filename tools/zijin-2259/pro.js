/* ZGI Intelligence Pro: browser-only decision tools; no personal data requests or persistence. */
(function(root){
"use strict";
const finite=Number.isFinite,positive=x=>finite(x)&&x>0;
const gross=(n,p,b,fx,fees=0)=>Number.isInteger(n)&&n>0&&n<=1e8&&positive(p)&&finite(b)&&b>=0&&positive(fx)&&finite(fees)&&fees>=0?{gross:n*(p-b)/fx,net:(n*(p-b)-fees)/fx,value:n*p/fx,cost:n*b/fx}:null;
const target=(n,b,fx,usd,fees=0)=>Number.isInteger(n)&&n>0&&finite(b)&&b>=0&&positive(fx)&&finite(usd)&&usd>=0&&finite(fees)&&fees>=0?b+(usd*fx+fees)/n:null;
function dcf(fcf,g,wacc,terminal,years,netDebt,shares,fx){
 if(![fcf,g,wacc,terminal,years,netDebt,shares,fx].every(finite)||fcf<0||g<=-1||terminal<=-1||wacc<=terminal||wacc<=0||years<1||years>30||!Number.isInteger(years)||!positive(shares)||!positive(fx))return null;
 let pv=0,flow=fcf;
 for(let y=1;y<=years;y++){flow*=1+g;pv+=flow/Math.pow(1+wacc,y);}
 const terminalPV=flow*(1+terminal)/(wacc-terminal)/Math.pow(1+wacc,years),ev=pv+terminalPV,equity=ev-netDebt;
 return {ev,equity,price:equity/shares*fx,terminalShare:ev>0?terminalPV/ev:null};
}
const multiple=(ebitda,m,netDebt,shares,fx)=>[ebitda,m,netDebt,shares,fx].every(finite)&&ebitda>=0&&m>=0&&positive(shares)&&positive(fx)?(ebitda*m-netDebt)/shares*fx:null;
const nav=(assetPV,other,netDebt,shares,fx)=>[assetPV,other,netDebt,shares,fx].every(finite)&&assetPV>=0&&positive(shares)&&positive(fx)?(assetPV+other-netDebt)/shares*fx:null;
const api={gross,target,dcf,multiple,nav};if(typeof module==="object"&&module.exports)module.exports=api;
if(!root||!root.document)return;root.ZGIPro=api;
const $=id=>document.getElementById(id),put=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
const val=id=>{const e=$(id);return e&&e.value.trim()!==""?Number(e.value):NaN;};
const fmt=(n,c="USD")=>finite(n)?new Intl.NumberFormat("en-US",{style:"currency",currency:c,currencyDisplay:"code",maximumFractionDigits:2}).format(n):"—";
const pct=n=>finite(n)?(n*100).toFixed(2)+"%":"—";
const time=v=>finite(Date.parse(v))?new Date(v).toLocaleString("en-GB",{timeZone:"Asia/Hong_Kong"})+" HKT":"—";
let feeds=null,latest=null,alerts=[];
function observe(p,t,prev){
 if(!positive(p)||!finite(t)||t>Date.now()+300000)return;
 if(!latest||t>=latest.t)latest={p,t,prev:positive(prev)?prev:latest?.prev};
}
function fresh(){return latest&&Date.now()-latest.t<=7*86400000;}
function award(){
 const n=val("pro-shares"),b=val("strike"),fx=val("chart-award-fx"),fees=val("charge"),goal=val("pro-goal");
 const data=fresh()?gross(n,latest.p,b,fx,fees):null;
 put("pro-market-price",fresh()?fmt(latest.p,"HKD"):"Awaiting valid price");
 put("pro-market-payout",data?fmt(data.gross):"Enter shares / verify feed");
 put("pro-daily-change",data&&positive(latest.prev)?fmt(n*(latest.p-latest.prev)/fx):"—");
 put("pro-target-price",fmt(target(n,b,fx,goal,fees),"HKD"));
 const now=Date.now(),vest=Date.parse("2029-11-11T00:00:00+08:00");
 put("pro-vesting-days",Math.max(0,Math.ceil((vest-now)/86400000)).toLocaleString("en-US")+" days");
 const table=$("pro-milestones");if(table){table.replaceChildren();for(const p of [100,150,200,250,300,400,500,750,1000]){
  const row=document.createElement("tr"),a=gross(n,p,b,fx,fees);
  for(const item of [fmt(p,"HKD"),a?fmt(a.gross):"—",a?fmt(a.net):"—"]){const td=document.createElement("td");td.textContent=item;row.append(td);}
  table.append(row);
 }}
 const threshold=val("pro-price-alert"),payout=val("pro-payout-alert");
 const triggered=[];if(fresh()&&positive(threshold)&&latest.p>=threshold)triggered.push("Price threshold reached");
 if(data&&positive(payout)&&data.gross>=payout)triggered.push("Gross payout threshold reached");
 put("pro-alert-status",triggered.length?triggered.join(" · "):fresh()?"No configured threshold reached":"No current validated observation");
}
function valuation(){
 const fx=val("chart-award-fx"),shares=val("pro-issued")*1e6,net=val("pro-debt")*1e6;
 const d=dcf(val("pro-fcf")*1e6,val("pro-growth")/100,val("pro-wacc")/100,val("pro-terminal")/100,5,net,shares,fx);
 put("pro-dcf",d?fmt(d.price,"HKD"):"Enter valid assumptions");
 put("pro-dcf-ev",d?fmt(d.ev/1e6)+"m":"—");
 put("pro-dcf-terminal",d?pct(d.terminalShare):"—");
 put("pro-multiple",fmt(multiple(val("pro-ebitda")*1e6,val("pro-multiple-input"),net,shares,fx),"HKD"));
 put("pro-nav",fmt(nav(val("pro-assetpv")*1e6,val("pro-other")*1e6,net,shares,fx),"HKD"));
 put("pro-cap",fresh()&&positive(shares)?fmt(latest.p*shares/fx/1e6)+"m":"—");
 const ep=val("pro-earnings")*1e6,fc=val("pro-fcf")*1e6,mc=fresh()&&positive(shares)&&positive(fx)?latest.p*shares/fx:NaN;
 put("pro-pe",positive(ep)&&positive(mc)?(mc/ep).toFixed(2)+"×":"—");
 put("pro-fcf-yield",positive(mc)&&finite(fc)?pct(fc/mc):"—");
}
function health(){
 for(const [key,symbol] of [["stock","2259.HK"],["gold","GC=F"],["parent","2899.HK"]]){
 const data=feeds?.[key],gate=root.ZGIResearchGate?.assessFeed(data,symbol);
 put("pro-health-"+key,gate?.usable?(feeds?.fresh?.[key]?"VALIDATED":"RETAINED / REFRESH FAILED")+" · "+time(data.providerQuoteTime):"WITHHELD · "+(gate?.reason||"awaiting source"));
 }
 put("pro-last-check",time(feeds?.refreshedAt));
}
function update(){award();valuation();health();}
if(!$("pro-workbench"))return;
$("pro-copy-shares")?.addEventListener("click",()=>{const v=$("chart-award-shares")?.value||$("shares")?.value;if(v)$("pro-shares").value=v;update();});
$("pro-clear")?.addEventListener("click",()=>{for(const id of ["pro-shares","pro-price-alert","pro-payout-alert"])$(id).value="";update();});
document.querySelectorAll("#pro-workbench input,#pro-valuation input").forEach(e=>e.addEventListener("input",update));
for(const id of ["strike","charge","chart-award-fx"])$(id)?.addEventListener("input",update);
$("reset-model")?.addEventListener("click",update);
document.addEventListener("zgi:market",e=>{feeds=e.detail;const s=feeds?.stock;if(root.ZGIResearchGate?.assessFeed(s,"2259.HK").usable){observe(s.regularMarketPrice,Date.parse(s.providerQuoteTime),s.previousClose);if(latest&&positive(s.previousClose))latest.prev=s.previousClose;}update();});
document.addEventListener("zgi:chart",e=>{const d=e.detail,b=d?.bars?.at(-1);if(d?.interval==="15m"&&!d.archive&&b)observe(b.c,b.t*1000,feeds?.stock?.previousClose);update();});
setInterval(update,60000);update();
})(typeof window!=="undefined"?window:null);
