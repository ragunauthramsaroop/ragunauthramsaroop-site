/* Quant Risk & Evidence Surface
 * All forward outcomes are conditional resampled distributions from 2259.HK historical bars.
 * Quotes are source-attributed and provider delayed. Grant-specific inputs never leave browser.
 * No broker actions, personal data transmission, forecast certainty or exchange entitlement.
 */
(()=>{"use strict";
const Q=window.ZGIQuant;
if(!Q)return;
const $=id=>document.getElementById(id);
const fmt=new Intl.NumberFormat("en-HK",{minimumFractionDigits:2,maximumFractionDigits:2});
const pct=n=>Number.isFinite(n)?(n*100).toFixed(1)+"%":"—";
const price=n=>Number.isFinite(n)?"HK$"+fmt.format(n):"—";
const month=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Hong_Kong",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
const dates=["2027-12-31","2028-12-31","2029-11-12","2029-12-31"];
const labels=["DEC 2027","DEC 2028","NOV 2029*","DEC 2029"];
const colors={low:"#ef9094",mid:"#edc582",high:"#7fd6b6",muted:"#98aabd",grid:"#344555"};
let feeds=null,result=null,chosenDate="2029-11-12",timer=null,calculating=false;
function set(id,s){if($(id))$(id).textContent=String(s)}
function age(iso){const diff=(Date.now()-Date.parse(iso))/3600000;if(!Number.isFinite(diff))return "TIME UNAVAILABLE";return diff<24?Math.floor(diff)+" H AGO":(diff/24).toFixed(1)+" DAYS SINCE LAST SOURCE OBSERVATION"}
function snap(){return {annualDrift:Number($("quant-drift").value)/100,volatilityFactor:Number($("quant-vol").value),blockSize:Number($("quant-block").value),simulations:Number($("quant-samples").value)}}
function controls(){
 set("quant-drift-value",(Number($("quant-drift").value)>0?"+":"")+$("quant-drift").value+"%");
 set("quant-vol-value",Number($("quant-vol").value).toFixed(2)+"×");
 set("quant-block-value",$("quant-block").value+" trading days");
}
function updateIntegrity(){
 const gate=window.ZGIResearchGate?.assessFeed(feeds?.stock,"2259.HK");
 const good=gate?.usable===true&&feeds?.stock&&!feeds.stock.archive&&feeds.stock.bars?.length>=66;
 if(!good){
  set("quant-data-integrity","Statistical simulation withheld: "+(gate?.reason||"insufficient stock history")+". Archived or stale sources are not current model anchors.");
  set("quant-source-age","LIVE RESEARCH SUSPENDED");
  return false;
 }
 const count=feeds.stock.bars.length,stamp=feeds.stock.providerQuoteTime;
 const fresh=feeds.fresh?.stock?"NEW VERIFIED RESPONSE":"PREVIOUS VERIFIED OBSERVATION RETAINED";
 const warning=count<260?" Short listing history, elevated model uncertainty.":"";
 set("quant-data-integrity",count+" verified stock bars from Yahoo Finance · "+fresh+" · source as of "+month.format(new Date(stamp))+" HKT."+warning);
 set("quant-source-age",age(stamp)+" · DELAYED");
 return true;
}
function drawFan(){
 const host=$("quant-fan-chart");if(!host)return;
 if(!result?.ok){host.textContent="Historical return distribution unavailable without sufficient validated price history.";return}
 const W=930,H=405,L=72,R=64,T=37,B=55;
 const rows=result.rows,anchor=result.lastClose;
 const values=[anchor,...rows.flatMap(r=>[r.p05,r.p95])].filter(n=>Number.isFinite(n)&&n>0);
 const lo=Math.max(.05,Math.min(...values)*.78),hi=Math.max(...values)*1.18;
 const x=i=>L+i*(W-L-R)/4,scale=Math.log(hi/lo),y=v=>T+Math.log(hi/Math.max(.05,v))/scale*(H-T-B);
 let svg='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Log-scale bootstrap sensitivity fan with model 5th, 25th, 50th, 75th and 95th percentiles">';
 for(let k=0;k<=5;k++){const v=lo*Math.exp(scale*k/5),yy=y(v);svg+='<line x1="'+L+'" y1="'+yy+'" x2="'+(W-R)+'" y2="'+yy+'" stroke="'+colors.grid+'" stroke-dasharray="4 6"/><text x="'+(L-13)+'" y="'+(yy+5)+'" fill="'+colors.muted+'" font-size="13" text-anchor="end">'+Math.round(v)+'</text>';}
 function band(keyLow,keyHigh,fill,opacity){
   const bottom=rows.map((r,i)=>x(i+1).toFixed(1)+","+y(r[keyLow]).toFixed(1));
   const top=rows.map((r,i)=>x(i+1).toFixed(1)+","+y(r[keyHigh]).toFixed(1)).reverse();
   return '<polygon points="'+bottom.concat(top).join(" ")+'" fill="'+fill+'" opacity="'+opacity+'"/>';
 }
 svg+=band("p05","p95","#b7c3d4",".16")+band("p25","p75",colors.mid,".20");
 let median=[x(0)+","+y(anchor),...rows.map((r,i)=>x(i+1)+","+y(r.median))].join(" ");
 svg+='<polyline points="'+median+'" fill="none" stroke="'+colors.mid+'" stroke-width="4" stroke-linejoin="round"/>';
 const thresholdY=y(87.48);
 if(thresholdY>=T&&thresholdY<=H-B){svg+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+thresholdY+'" y2="'+thresholdY+'" stroke="#e9a5a5" stroke-dasharray="8 7" stroke-width="1.3"/><text x="'+(W-R-4)+'" y="'+(thresholdY-8)+'" text-anchor="end" fill="#e9a5a5" font-size="11">Scheme reference HK$87.48</text>';}
 svg+='<circle cx="'+x(0)+'" cy="'+y(anchor)+'" r="6" fill="'+colors.mid+'" stroke="#131f2c" stroke-width="2"/>';
 for(let i=0;i<rows.length;i++){
   const row=rows[i],xx=x(i+1),yy=y(row.median),isChosen=chosenDate===row.date;
   svg+='<line x1="'+xx+'" x2="'+xx+'" y1="'+y(row.p95)+'" y2="'+y(row.p05)+'" stroke="'+colors.muted+'" stroke-width="1" opacity=".75"/>';
   svg+='<circle data-quant-index="'+i+'" tabindex="0" cx="'+xx+'" cy="'+yy+'" r="'+(isChosen?10:7)+'" fill="'+colors.mid+'" stroke="'+(isChosen?"#fff":"#172332")+'" stroke-width="'+(isChosen?3:2)+'"><title>'+labels[i]+' median '+price(row.median)+'</title></circle>';
 }
 ["NOV 2026",...labels].forEach((label,i)=>svg+='<text x="'+x(i)+'" y="'+(H-19)+'" text-anchor="middle" fill="'+colors.muted+'" font-size="13" font-weight="700">'+label+'</text>');
 svg+='<text x="12" y="19" fill="'+colors.mid+'" letter-spacing="1.4" font-size="11" font-weight="700">HKD · LOG SCALE · HISTORICAL BOOTSTRAP, NOT MARKET FORECAST</text></svg>';
 host.innerHTML=svg;
 for(const node of host.querySelectorAll("[data-quant-index]")){
   const i=Number(node.dataset.quantIndex);
   const select=()=>choose(dates[i]);
   node.addEventListener("click",select);node.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();select()}})
 }
}
function drawHist(){
 const host=$("quant-histogram");if(!host)return;
 if(!result?.ok){host.textContent="No simulated distribution available.";return}
 const idx=dates.indexOf(chosenDate),hist=result.histograms[idx];
 if(!hist||!hist.counts.length){host.textContent="Histogram unavailable";return}
 const W=750,H=252,L=28,R=20,T=22,B=39,max=Math.max(...hist.counts),n=hist.counts.length;
 let svg='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Simulated prices frequency histogram">';
 for(let k=0;k<4;k++){const yy=T+k*(H-T-B)/3;svg+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" stroke="'+colors.grid+'" stroke-dasharray="3 7"/>';}
 const cw=(W-L-R)/n;
 hist.counts.forEach((cnt,i)=>{
  const high=cnt/max*(H-T-B),x=L+i*cw+1,y=H-B-high;
  const lower=hist.lower+(hist.upper-hist.lower)*i/n;
  svg+='<rect x="'+x+'" y="'+y+'" width="'+Math.max(1,cw-2)+'" height="'+high+'" rx="1" fill="'+(lower<87.48?colors.low:colors.mid)+'" opacity=".82"><title>'+price(lower)+' band • '+cnt+' samples</title></rect>';
 });
 svg+='<text x="'+L+'" y="'+(H-13)+'" fill="'+colors.muted+'" font-size="13">'+price(hist.lower)+'</text>';
 svg+='<text x="'+(W-R)+'" text-anchor="end" y="'+(H-13)+'" fill="'+colors.muted+'" font-size="13">'+price(hist.upper)+'</text>';
 svg+='<text x="'+L+'" y="13" fill="'+colors.muted+'" font-size="11">OUTER TAILS ARE INCLUDED IN END BINS</text></svg>';
 host.innerHTML=svg;
}
function thresholds(){
 const root=$("quant-thresholds");if(!root||!result?.ok)return;
 root.replaceChildren();
 const r=result.rows[dates.indexOf(chosenDate)];
 for(const [threshold,label] of [["87.48","ABOVE PUBLIC PURCHASE REFERENCE"],["175","AT OR ABOVE HK$175"],["250","AT OR ABOVE HK$250"]]){
   const value=r.thresholds[threshold];
   const line=document.createElement("div");line.className="threshold-row";
   const heading=document.createElement("div");const a=document.createElement("span");a.textContent=label;const b=document.createElement("strong");b.textContent=pct(value);heading.append(a,b);
   const track=document.createElement("div");track.className="threshold-track";const fill=document.createElement("i");fill.style.width=Math.max(0,Math.min(100,value*100))+"%";track.append(fill);
   line.append(heading,track);root.append(line);
 }
}
function choose(date){
 if(!dates.includes(date))return;chosenDate=date;
 for(const btn of document.querySelectorAll("[data-quant-date]"))btn.classList.toggle("selected",btn.dataset.quantDate===date);
 if(result?.ok){
  const r=result.rows[dates.indexOf(date)];
  set("quant-fan-readout",date+" • median "+price(r.median)+" • middle 50%: "+price(r.p25)+" to "+price(r.p75)+" • 90% interval: "+price(r.p05)+" to "+price(r.p95)+" • model-relative probability above HK$87.48: "+pct(r.breakEvenProbability));
  drawFan();drawHist();thresholds();
 }
}
function correlations(){
 const el=$("quant-correlation"),coverage=$("quant-coverage-detail");
 if(!el||!coverage)return;
 el.replaceChildren();
 if(!feeds?.stock||feeds.stock.archive){el.textContent="A verified stock return history is required.";coverage.textContent="Unverified archive data cannot be backtested.";return}
 const a=feeds.stock,b=feeds.parent,g=feeds.gold;
 const items=[];
 if(b?.bars?.length>16)items.push({name:"2259 / PARENT 2899",data:Q.matchedCorrelation(a.bars,b.bars)});
 if(g?.bars?.length>16)items.push({name:"2259 / PRIOR-DAY GOLD FUTURES",data:Q.matchedCorrelation(a.bars,g.bars,1)});
 const r=Q.histRisk(a.bars,60);
 if(r)items.push({name:"60-SESSION ANNUALISED VOLATILITY",data:{coefficient:r.volAnnual,count:r.observations},isVol:true});
 for(const item of items){
   const row=document.createElement("div");row.className="quant-corr-row";
   const left=document.createElement("div");const name=document.createElement("span");name.textContent=item.name;
   const sample=document.createElement("small");sample.textContent=item.data.count+" "+(item.isVol?"historical returns":"aligned returns");left.append(name,sample);
   const right=document.createElement("strong");right.textContent=item.isVol?pct(item.data.coefficient):Number.isFinite(item.data.coefficient)?item.data.coefficient.toFixed(2):"Insufficient alignment";
   row.append(left,right);el.append(row);
 }
 const bt=Q.backtestCoverage(a.bars,80,20);
 coverage.replaceChildren();
 const title=document.createElement("strong");title.textContent="ROLLING 20-SESSION RETROSPECTIVE TEST";
 const note=document.createElement("p");
 note.textContent=bt.count?"Empirical coverage "+pct(bt.coverage)+" across "+bt.count+" overlapping rolling-origin test windows, versus nominal 80%. Estimated from prior 80 daily returns with no future-data leakage. Overlapping windows are not independent.":"Insufficient historical bars for the 80-session lookback and 20-session evaluation.";
 coverage.append(title,note);
 set("quant-backtest",bt.count?pct(bt.coverage):"—");
}
function updateKpis(){
 if(!result?.ok){for(const id of ["quant-median-nov","quant-interval-nov","quant-break-even","quant-backtest"])set(id,"—");return}
 const row=result.rows[2],interval=price(row.p05)+" → "+price(row.p95);
 set("quant-median-nov",price(row.median));
 set("quant-interval-nov",interval);
 set("quant-break-even",pct(row.breakEvenProbability));
 set("quant-median-meta",result.simulations.toLocaleString("en-HK")+" deterministic bootstrap paths · source delayed");
}
function run(){
 controls();
 if(!updateIntegrity()){result=null;updateKpis();drawFan();drawHist();set("quant-fan-readout","No empirical forecast without adequate current market history.");correlations();return}
 const o=snap();
 result=Q.bootstrappedFuture(feeds.stock.bars,{...o,seed:20291111,levels:[87.48,175,250]});
 if(!result.ok){updateKpis();drawFan();return}
 updateKpis();choose(chosenDate);correlations();
 document.dispatchEvent(new CustomEvent("zgi:quant",{detail:{result,marketAsOf:feeds.stock.providerQuoteTime}}));
}
function schedule(){controls();if(timer)clearTimeout(timer);timer=setTimeout(run,250)}
function csv(){
 if(!result?.ok)return;
 const headers=["Checkpoint","Days simulated","P05 HKD","P10 HKD","P25 HKD","Median HKD","P75 HKD","P90 HKD","P95 HKD","Model frequency above HK$87.48","Model paths","Historical stock obs","Annual drift assumption","Vol multiplier","Source timestamp"];
 const lines=[headers.join(",")];
 for(const r of result.rows){
  const vals=[r.date,r.days,r.p05,r.p10,r.p25,r.median,r.p75,r.p90,r.p95,r.breakEvenProbability,result.simulations,result.historicalObservations,result.annualDrift,result.volatilityFactor,feeds.stock.providerQuoteTime];
  lines.push(vals.map(x=>'"'+String(x??"").replaceAll('"','""')+'"').join(","));
 }
 const blob=new Blob([lines.join("\r\n")+"\r\n"],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="zijin-2259-2027-2029-conditional-bootstrap-model.csv";document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),800);
}
for(const id of ["quant-drift","quant-vol","quant-block","quant-samples"])$(id)?.addEventListener(id==="quant-samples"?"change":"input",schedule);
$("quant-recalculate")?.addEventListener("click",run);
$("quant-reset")?.addEventListener("click",()=>{
 $("quant-drift").value="8";$("quant-vol").value="1";$("quant-block").value="5";$("quant-samples").value="2000";run();
});
for(const b of document.querySelectorAll("[data-quant-date]"))b.addEventListener("click",()=>choose(b.dataset.quantDate));
$("quant-export")?.addEventListener("click",csv);
document.addEventListener("zgi:market",e=>{feeds=e.detail;run()});
controls();
})();
