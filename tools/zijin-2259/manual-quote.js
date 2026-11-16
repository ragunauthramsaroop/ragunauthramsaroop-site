/* HKEX user-entered reference bridge. Does not scrape, poll, log, persist or transmit
 * any price entered by the user. Official BMP quote-search requests must remain
 * on the authorised market-data vendor site and be user activated there.
 */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const form=$("manual-quote-form"),button=$("manual-quote-award"),status=$("manual-quote-status");
if(!form||!button||!status)return;
const fmt=new Intl.NumberFormat("en-HK",{minimumFractionDigits:2,maximumFractionDigits:2});
const hkt=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Hong_Kong",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
let delayed=null,reference=null;
const format=x=>"HK$"+fmt.format(x);
const percent=x=>(x>=0?"+":"")+x.toFixed(2)+"%";
function get(id,required){
  const str=$(id)?.value?.trim();
  if(!str)return required?NaN:null;
  const n=Number(str);
  return Number.isFinite(n)&&n>=.01&&n<=1e5?n:NaN;
}
function compared(code,price,out,delta){
  if(price===null){$(out).textContent="—";$(delta).textContent="Not entered";return}
  $(out).textContent=format(price);
  const current=code==="2259"?delayed?.stock:delayed?.parent;
  if(current?.archive||!Number.isFinite(current?.regularMarketPrice)||current.regularMarketPrice<=0){
    $(delta).textContent="Delayed benchmark unavailable";return;
  }
  const change=(price/current.regularMarketPrice-1)*100;
  $(delta).textContent=percent(change)+" versus provider-delayed "+format(current.regularMarketPrice)+" · NOT a session return";
}
function render(){
 if(!reference)return;
 compared("2259",reference.stock,"manual-2259-output","manual-2259-delta");
 compared("2899",reference.parent,"manual-2899-output","manual-2899-delta");
 const name=reference.vendor==="etnet"?"etnet BMP":reference.vendor==="broker"?"your broker":"other reference";
 status.textContent="USER-ENTERED REFERENCE · "+name+" · entered "+hkt.format(new Date(reference.enteredAt))+" HKT. Input has not been verified or sent to any service.";
 button.disabled=false;
}
form.addEventListener("submit",e=>{
 e.preventDefault();
 const stock=get("manual-2259-input",true),parent=get("manual-2899-input",false);
 if(!Number.isFinite(stock)||parent!==null&&!Number.isFinite(parent)){
   status.textContent="Enter a positive 2259 price in HKD. The optional 2899 benchmark also requires a valid HKD price.";
   button.disabled=true;reference=null;return;
 }
 const vendor=$("manual-quote-provider")?.value||"other";
 if(!["etnet","broker","other"].includes(vendor)){status.textContent="Select a valid user-observed reference source.";return}
 reference={stock,parent,vendor,enteredAt:new Date().toISOString()};
 render();
});
button.addEventListener("click",()=>{
 if(!reference?.stock||!Number.isFinite(reference.stock))return;
 document.dispatchEvent(new CustomEvent("zgi:manual-price",{detail:{
   price:reference.stock,entryTime:reference.enteredAt,sourceLabel:"USER-ENTERED REFERENCE",
   verified:false,exchangeTimestampKnown:false
 }}));
 status.textContent="Applied HK$"+fmt.format(reference.stock)+" as a USER-ENTERED illustrative award input. Delayed market quotes, official indicators, historical bars and probability simulations are unchanged.";
});
document.addEventListener("zgi:market",e=>{delayed=e.detail;render()});
})();
