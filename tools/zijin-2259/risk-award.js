/* Private, local-only 2029 conditional share-award payoff distribution.
 * No personal inputs transmitted, stored or embedded in HTML.
 * Financial output is conditional on scheme vesting and share execution.
 */
(()=>{
"use strict";
const Q=window.ZGIQuant,byId=id=>document.getElementById(id);
if(!Q)return;
let results=null;
const n=new Intl.NumberFormat("en-HK",{minimumFractionDigits:2,maximumFractionDigits:2});
const percent=x=>Number.isFinite(x)?(x*100).toFixed(1)+"%":"—";
const amount=x=>Number.isFinite(x)?(x<0?"−":"")+"HK$"+n.format(Math.abs(x)):"—";
const get=id=>{const e=byId(id);if(!e||e.value.trim()==="")return null;const v=Number(e.value);return Number.isFinite(v)?v:null};
function update(){
 const root=byId("award-quant-chart"),samples=results?.nov2029Samples;
 if(!root)return;
 const shares=get("shares"),strike=get("strike");
 if(!Array.isArray(samples)||samples.length<20||!shares||shares<=0||!Number.isInteger(shares)||!Number.isFinite(strike)||strike<0){
   root.textContent="Enter your share quantity and wait for validated November 2029 stock-return history. No hypothetical payout appears without both inputs.";
   for(const id of ["award-quant-median","award-quant-interval","award-quant-loss"])if(byId(id))byId(id).textContent="—";
   if(byId("award-quant-source"))byId("award-quant-source").textContent="Only your browser calculates these figures. No assumed vesting probability or transaction costs are included.";
   return;
 }
 const payoffs=samples.map(price=>(price-strike)*shares);
 const low=Q.quantile(payoffs,.05),median=Q.quantile(payoffs,.5),high=Q.quantile(payoffs,.95);
 const freq=payoffs.filter(x=>x<0).length/payoffs.length;
 byId("award-quant-median").textContent=amount(median);
 byId("award-quant-interval").textContent=amount(low)+" to "+amount(high);
 byId("award-quant-loss").textContent=percent(freq);
 const W=980,H=310,L=76,R=45,T=37,B=56;
 const dataMin=Math.min(...payoffs),dataMax=Math.max(...payoffs);
 const vmin=Math.min(low,dataMin,0),vmax=Math.max(high,dataMax,0);
 const span=Math.max(1,vmax-vmin),lo=vmin-span*.05,hi=vmax+span*.05;
 const x=v=>L+(v-lo)/(hi-lo)*(W-L-R);
 const drawBar=(xx,yy,h,w,color)=>'<rect x="'+xx+'" y="'+yy+'" width="'+w+'" height="'+h+'" rx="1" fill="'+color+'"/>';
 const bins=36,counts=Array(bins).fill(0);
 for(const p of payoffs){const idx=Math.max(0,Math.min(bins-1,Math.floor((p-lo)/(hi-lo)*bins)));counts[idx]++}
 const ceiling=Math.max(...counts,1);
 const width=(W-L-R)/bins;
 let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="November 2029 conditional gross spread simulated histogram">';
 for(let i=0;i<=4;i++){
   const yy=T+i*(H-T-B)/4;
   svg+='<line x1="'+L+'" y1="'+yy+'" x2="'+(W-R)+'" y2="'+yy+'" stroke="#344653" stroke-dasharray="4 8"/>';
 }
 counts.forEach((count,i)=>{
   const lower=lo+i*(hi-lo)/bins,barH=(count/ceiling)*(H-T-B),xx=L+i*width+1;
   svg+=drawBar(xx,H-B-barH,barH,Math.max(1,width-2),lower<0?"#d9858a":"#d8b77c");
 });
 const zx=x(0);
 if(zx>=L&&zx<=W-R)svg+='<line x1="'+zx+'" y1="'+T+'" x2="'+zx+'" y2="'+(H-B)+'" stroke="#e5a2a6" stroke-dasharray="6 6"/><text x="'+Math.min(W-R-8,zx+7)+'" y="'+(T+12)+'" font-size="11" fill="#e5a2a6">ZERO GROSS SPREAD</text>';
 for(const [v,color,text] of [[low,"#f0aaa9","P05"],[median,"#f2d397","MEDIAN"],[high,"#91d4b8","P95"]]){
   const xx=x(v);
   svg+='<line x1="'+xx+'" y1="'+T+'" x2="'+xx+'" y2="'+(H-B)+'" stroke="'+color+'" stroke-width="2" opacity=".83"/><text x="'+Math.min(W-R-22,Math.max(L+10,xx))+'" y="'+(H-B+23)+'" fill="'+color+'" font-size="12" font-weight="800" text-anchor="middle">'+text+'</text>';
 }
 svg+='<text x="'+L+'" y="17" font-size="12" fill="#b5c6d2">GROSS VALUE AFTER SCHEME PURCHASE COST • BEFORE TAX / FEES</text>';
 svg+='<text x="'+L+'" y="'+(H-9)+'" font-size="11" fill="#92a8b8">'+amount(lo)+'</text><text x="'+(W-R)+'" y="'+(H-9)+'" text-anchor="end" font-size="11" fill="#92a8b8">'+amount(hi)+'</text></svg>';
 root.innerHTML=svg;
 if(byId("award-quant-source"))byId("award-quant-source").textContent="Based on "+payoffs.length+" historical block-bootstrap simulations of 2259.HK through 12 November 2029. User entered "+shares.toLocaleString("en-HK")+" shares and HK$"+n.format(strike)+" price. Gross spread only, assuming full vesting. Zero values and losses remain possible. No calibrated real-world probability or guaranteed outcome.";
}
document.addEventListener("zgi:quant",event=>{results=event.detail?.result;update()});
for(const id of ["shares","strike"])byId(id)?.addEventListener("input",update);
document.getElementById("reset-model")?.addEventListener("click",()=>setTimeout(update,0));
update();
})();