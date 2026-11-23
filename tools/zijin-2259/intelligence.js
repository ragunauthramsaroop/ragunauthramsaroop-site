/* ZGI Flagship Intelligence.
 * Derived historical analytics and explicit, hypothetical future sensitivities.
 * Every scenario is anchored to VERIFIED returned 2259.HK and GC=F observations.
 * Source timestamps and a precise data-status label accompany all model outputs.
 * No forecast is presented as a live market quote or an investment recommendation.
 */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const fmt=new Intl.NumberFormat("en-HK",{minimumFractionDigits:2,maximumFractionDigits:2});
const compact=new Intl.NumberFormat("en-HK",{notation:"compact",maximumFractionDigits:1});
const DATETIME=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Hong_Kong",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
const DATEKEY=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Hong_Kong",year:"numeric",month:"2-digit",day:"2-digit"});
const COL={bear:"#eb8f8f",base:"#e7bf78",bull:"#77ceb2",stock:"#e7bf78",parent:"#86adf2",gold:"#74cdb1",grid:"#314352",muted:"#97a8b8"};
const YEARS=[2027,2028,2029];
const RANGE_DAYS={"1mo":32,"3mo":94,"6mo":188,"1y":375};
let market=null,currentScenario="base",compareRange="6mo",compareVisible=new Set(["stock","parent","gold"]);
let projections=null;
const modelDefaults={gold:5000,production:75,cost:4,multiple:1,dilution:0};
const variants={
  bear:{title:"DOWNSIDE",color:COL.bear,gold:.80,production:.90,multiple:.75,cost:2},
  base:{title:"CENTRAL",color:COL.base,gold:1,production:1,multiple:1,cost:0},
  bull:{title:"UPSIDE",color:COL.bull,gold:1.20,production:1.12,multiple:1.20,cost:-1}
};
function number(n){return Number.isFinite(n)?fmt.format(n):"—"}
function percent(n){return Number.isFinite(n)?(n>0?"+":"")+n.toFixed(1)+"%":"—"}
function clock(t){if(!t||Number.isNaN(Date.parse(t)))return "Unavailable";return DATETIME.format(new Date(t))+" HKT"}
const HKT_DATE=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Hong_Kong",day:"2-digit",month:"short",year:"numeric"});
const UTC_DATE=new Intl.DateTimeFormat("en-GB",{timeZone:"UTC",day:"2-digit",month:"short",year:"numeric"});
function sourceLabel(data){
  const iso=data?.providerQuoteTime;
  if(!iso||Number.isNaN(Date.parse(iso)))return "Unavailable";
  if(data.archive||data.interval==="1d"){
    const isFutures=data.symbol==="GC=F";
    return (isFutures?UTC_DATE:HKT_DATE).format(new Date(iso))+(isFutures?" UTC":" HKT")+" DAILY BAR • NOT TRADE TIME";
  }
  return clock(iso)+" PROVIDER BAR";
}
function set(id,s){const el=$(id);if(el)el.textContent=String(s)}
function toDateKey(t){const p=DATEKEY.formatToParts(new Date(t*1000));const x={};p.forEach(k=>{x[k.type]=k.value});return x.year+"-"+x.month+"-"+x.day}
function num(id){return Number($(id)?.value)}
function setInput(id,value){if($(id))$(id).value=String(value)}
function hasData(d){return d&&Array.isArray(d.bars)&&d.bars.length>1&&Number.isFinite(d.regularMarketPrice)}
function feedOK(detail){return hasData(detail?.stock)&&hasData(detail?.gold)&&!detail.stock.archive}
function ageLabel(iso){
  if(!iso)return "UNKNOWN SOURCE AGE";
  const diff=(Date.now()-Date.parse(iso))/86400000;
  if(!Number.isFinite(diff))return "SOURCE TIME UNAVAILABLE";
  return diff>5?"STALE OBSERVATION ("+Math.floor(diff)+" DAYS OLD)":diff>2?"OLDER SESSION ("+Math.floor(diff)+" DAYS OLD)":"PROVIDER-DELAYED OBSERVATION";
}
function updateKPIs(){
  if(!market)return;
  const cfg=[["2259",market.stock,"HK$"],["2899",market.parent,"HK$"],["gold",market.gold,"US$"]];
  for(const [key,d,prefix] of cfg){
    set("live-kpi-"+key,hasData(d)?prefix+number(d.regularMarketPrice):"UNAVAILABLE");
    set("live-kpi-"+key+"-asof",hasData(d)?sourceLabel(d)+" · "+ageLabel(d.providerQuoteTime):"PROVIDER NOT AVAILABLE");
  }
  const stock=market.stock;
  if(hasData(stock)&&!stock.archive){
    const b=stock.bars.slice(-252),min=Math.min(...b.map(d=>d.l)),max=Math.max(...b.map(d=>d.h));
    set("live-kpi-range","HK$"+number(min)+"–"+number(max));
    set("live-kpi-range-asof","OBSERVED "+b.length+" SESSIONS · "+sourceLabel(stock));
    set("global-market-source","2259.HK AS OF "+sourceLabel(stock)+" · "+ageLabel(stock.providerQuoteTime));
  }else{
    set("live-kpi-range","UNAVAILABLE");
    set("live-kpi-range-asof","NO CURRENT PROVIDER HISTORY");
    set("global-market-source","MARKET FEED UNAVAILABLE · ARCHIVED CHART IS NOT CURRENT DATA");
  }
}
function standardDeviation(values){
  if(values.length<2)return null;
  const mean=values.reduce((a,b)=>a+b,0)/values.length;
  return Math.sqrt(values.reduce((s,x)=>s+(x-mean)**2,0)/(values.length-1));
}
function pulse(){
  const b=market?.stock?.bars;
  if(!market||market.stock.archive||!Array.isArray(b)||b.length<21){
    for(const id of ["risk-volatility","risk-drawdown","risk-average-volume","risk-price-vs-strike"])set(id,"NOT AVAILABLE");
    set("risk-data-note","No verified current rolling history, so risk indicators are withheld rather than inferred.");
    return;
  }
  const returns=b.slice(-21).map((v,i,a)=>i===0?null:(v.c/a[i-1].c-1)).filter(Number.isFinite);
  const vol=standardDeviation(returns),volAnnual=vol===null?null:vol*Math.sqrt(252)*100;
  let peak=-Infinity,dd=0;
  for(const c of b.slice(-252).map(x=>x.c)){peak=Math.max(peak,c);dd=Math.min(dd,c/peak-1)}
  const volume=b.slice(-20).map(x=>x.v).filter(Number.isFinite),average=volume.length?volume.reduce((a,b)=>a+b,0)/volume.length:null;
  set("risk-volatility",Number.isFinite(volAnnual)?volAnnual.toFixed(1)+"%":"—");
  set("risk-drawdown",(dd*100).toFixed(1)+"%");
  set("risk-average-volume",Number.isFinite(average)?compact.format(average):"—");
  set("risk-price-vs-strike",percent((market.stock.regularMarketPrice/87.48-1)*100));
  set("risk-data-note","Based on "+b.length+" verified daily bars, last timestamp "+sourceLabel(market.stock)+". Volatility and drawdown are backward-looking, not forecasts.");
}
function scenarioControls(){
  const gold=num("model-gold"),production=num("model-production"),cost=num("model-cost"),multiple=num("model-multiple"),dilution=num("model-dilution");
  set("model-gold-out","US$"+gold.toLocaleString("en-HK"));
  set("model-production-out",production+" tonnes");
  set("model-cost-out",cost+"%");
  set("model-multiple-out",multiple.toFixed(2)+"×");
  set("model-dilution-out",dilution+"%");
  return {gold,production,cost,multiple,dilution};
}
function estimate(anchorStock,anchorGold,assumptions,scenario,year){
  const step=year-2026,fraction=step/3;
  const v=variants[scenario];
  const hypotheticalGold=anchorGold+(assumptions.gold*v.gold-anchorGold)*fraction;
  const hypotheticalProd=59.2+(assumptions.production*v.production-59.2)*fraction;
  const escalation=Math.max(0,assumptions.cost+v.cost);
  const aisc=1649*Math.pow(1+escalation/100,step);
  const baseGrossMargin=anchorGold-1649;
  if(baseGrossMargin<=0)return null;
  const futureGrossMargin=hypotheticalGold-aisc;
  if(futureGrossMargin<=0)return 0;
  const multiple=1+((assumptions.multiple*v.multiple)-1)*fraction;
  const dilution=1+assumptions.dilution/100*fraction;
  return anchorStock*(hypotheticalProd/59.2)*(futureGrossMargin/baseGrossMargin)*multiple/dilution;
}
function buildProjections(){
  const assumptions=scenarioControls();
  if(!market)return null;
  const stock=market.stock,gold=market.gold;
  if(!feedOK(market)){
    set("model-data-status","NO VALIDATED STOCK AND GOLD ANCHORS. FORECAST WITHHELD. HISTORICAL DATA IS NOT A LIVE FORECAST.");
    set("model-anchor-stock","UNAVAILABLE");set("model-anchor-gold","UNAVAILABLE");
    set("model-basis","Select assumptions now. Calculations require verified 2259.HK and gold futures observations.");
    set("model-last-update","Model suspended until the market data is available.");
    return null;
  }
  const stockPrice=stock.regularMarketPrice,goldPrice=gold.regularMarketPrice;
  set("model-anchor-stock","HK$"+number(stockPrice));
  set("model-anchor-gold","US$"+number(goldPrice));
  const sourceState=market.fresh?.stock&&market.fresh?.gold?"PROVIDER-DELAYED SOURCE OBSERVATIONS":"REFRESH FAILED FOR ONE OR MORE INSTRUMENTS; PREVIOUS VALIDATED OBSERVATIONS";
  const status=sourceState+": 2259 "+sourceLabel(stock)+" | GC=F "+sourceLabel(gold)+".";
  set("model-data-status",status+" Calculations rerun on feed updates and control changes. No model outcome is a live stock quote.");
  set("model-basis","Anchor: HK$"+number(stockPrice)+" on 2259.HK, US$"+number(goldPrice)+" on GC=F gold futures. Assumed 2026 target production 59.2t and 9M 2026 AISC US$1,649/oz. These historical baselines are fixed assumptions; change 2029 assumptions above.");
  set("model-last-update","VALUATION UPDATED FROM "+sourceLabel(stock)+" AND "+sourceLabel(gold));
  const values={};
  for(const key of Object.keys(variants)){
    const seq=[stockPrice,...YEARS.map(y=>estimate(stockPrice,goldPrice,assumptions,key,y))];
    values[key]=seq;
    set("scenario-"+key+"-price",Number.isFinite(seq[3])?"HK$"+number(seq[3]):"UNAVAILABLE");
  }
  return {values,assumptions,stock, gold, calculatedAt:new Date().toISOString()};
}
function plotProjections(p){
  const host=$("scenario-chart");
  if(!host)return;
  host.replaceChildren();
  if(!p){host.textContent="Forecast chart unavailable without verified stock and gold source data.";return}
  const all=Object.values(p.values).flat().filter(Number.isFinite),maximum=Math.max(1,...all),minimum=Math.min(0,...all);
  const W=920,H=385,L=70,R=85,T=35,B=54,innerW=W-L-R,innerH=H-T-B;
  const high=Math.ceil((maximum*1.13)/50)*50,low=Math.max(0,Math.floor(minimum*.9/50)*50);
  const x=i=>L+i*innerW/3,y=value=>T+(high-value)/(high-low)*innerH;
  let svg='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Market-anchored sensitivity lines for years 2026 to 2029">';
  for(let i=0;i<=5;i++){
    const v=low+i*(high-low)/5;
    svg+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="'+COL.grid+'" stroke-dasharray="5 8"/><text x="'+(L-12)+'" y="'+(y(v)+5)+'" font-size="13" fill="'+COL.muted+'" text-anchor="end">'+Math.round(v)+'</text>';
  }
  [2026,...YEARS].forEach((year,i)=>{
    svg+='<text x="'+x(i)+'" y="'+(H-14)+'" text-anchor="middle" font-size="14" fill="'+COL.muted+'" font-weight="700">'+year+'</text>';
  });
  svg+='<text x="8" y="20" fill="'+COL.base+'" font-size="12" letter-spacing="2" font-weight="700">HKD / SHARE • SENSITIVITY, NOT FORECAST</text>';
  for(const [key,v] of Object.entries(p.values)){
    const color=variants[key].color;
    const pts=v.map((n,i)=>Number.isFinite(n)?x(i).toFixed(2)+","+y(n).toFixed(2):"").filter(Boolean).join(" ");
    svg+='<polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="'+(key==="base"?4:2.6)+'" stroke-linejoin="round" stroke-linecap="round"/>';
    v.forEach((n,i)=>{
      if(!Number.isFinite(n))return;
      svg+='<circle data-model-case="'+key+'" data-model-year="'+(2026+i)+'" cx="'+x(i)+'" cy="'+y(n)+'" r="'+(i===3?8:6)+'" fill="'+color+'" stroke="#101925" stroke-width="2" tabindex="0"><title>'+key.toUpperCase()+' '+(2026+i)+' HK$'+n.toFixed(2)+'</title></circle>';
      if(i===3)svg+='<text x="'+(x(i)+13)+'" y="'+(y(n)+4)+'" fill="'+color+'" font-weight="800" font-size="15">'+number(n)+'</text>';
    });
  }
  svg+='</svg>';
  host.innerHTML=svg;
  let hover=document.createElement("div");hover.className="chart-hover-card";
  hover.textContent="POINTS ARE INTERACTIVE • SELECT A 2029 SCENARIO TO EXAMINE CONDITIONAL PAYOUT";
  host.append(hover);
  host.querySelectorAll("[data-model-case]").forEach(node=>{
    const key=node.getAttribute("data-model-case"),year=Number(node.getAttribute("data-model-year")),v=p.values[key][year-2026];
    const label=year+" "+variants[key].title+" HK$"+number(v);
    node.addEventListener("pointerenter",()=>hover.textContent=label+" · Model price, NOT market quote");
    node.addEventListener("focus",()=>hover.textContent=label+" · Model price, NOT market quote");
    const action=()=>{
      hover.textContent=label+(year===2029?" · Click applied to private settlement calculator":" · PRE-VESTING, NO CASH PAYOUT ASSUMED");
      if(year===2029){currentScenario=key;highlightSelection();document.dispatchEvent(new CustomEvent("zgi:scenario-select",{detail:{scenario:key,price:v}}));}
    };
    node.addEventListener("click",action);
    node.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();action()}});
  });
}
function highlightSelection(){
  document.querySelectorAll('[data-case]').forEach(b=>b.classList.toggle("selected",b.dataset.case===currentScenario));
}
function writeModelMatrix(p){
  const el=$("dynamic-model-table");if(!el)return;el.replaceChildren();if(!p){el.textContent="Waiting for verified data.";return}
  const table=document.createElement("table");table.className="forecast-matrix";
  const head=document.createElement("thead");const hrow=document.createElement("tr");
  for(const name of ["YEAR","DOWNSIDE","CENTRAL","UPSIDE"]){const th=document.createElement("th");th.textContent=name;hrow.append(th)}head.append(hrow);table.append(head);
  const body=document.createElement("tbody");
  YEARS.forEach((year,i)=>{
    const tr=document.createElement("tr");const c=document.createElement("td");c.textContent=String(year);tr.append(c);
    for(const name of ["bear","base","bull"]){const cell=document.createElement("td");const value=p.values[name][i+1];cell.textContent=Number.isFinite(value)?"HK$"+number(value):"—";tr.append(cell);}
    body.append(tr);
  });
  table.append(body);el.append(table);
}
function updateForecast(){
  projections=buildProjections();plotProjections(projections);writeModelMatrix(projections);
}
function exportProjections(){
  const p=projections;if(!p)return;
  const lines=[
    ["Type","Year","Downside HKD","Central HKD","Upside HKD","Stock anchor HKD","Gold futures anchor USD/oz","Stock quote time HKT","Gold quote time HKT","Assumed 2029 Gold USD","Assumed 2029 Production tonnes","Cost escalation pct","Valuation multiple factor","Dilution pct"].join(",")
  ];
  YEARS.forEach((year,i)=>{
    const fields=[
      "Hypothetical sensitivity",year,p.values.bear[i+1],p.values.base[i+1],p.values.bull[i+1],
      p.stock.regularMarketPrice,p.gold.regularMarketPrice,
      clock(p.stock.providerQuoteTime),clock(p.gold.providerQuoteTime),
      p.assumptions.gold,p.assumptions.production,p.assumptions.cost,p.assumptions.multiple,p.assumptions.dilution
    ];
    lines.push(fields.map(x=>'"'+String(x??"").replaceAll('"','""')+'"').join(","));
  });
  const blob=new Blob(["\uFEFF"+lines.join("\r\n")+"\r\n"],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="zijin-2259-recalculated-market-anchored-scenarios.csv";document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function compareData(){
  if(!market||!hasData(market.stock)||market.stock.archive)return null;
  const stock=market.stock.bars,latest=stock.at(-1).t;
  const cutoff=latest-(RANGE_DAYS[compareRange]||188)*86400;
  const stockBars=stock.filter(b=>b.t>=cutoff);
  if(stockBars.length<3)return null;
  const all={stock:market.stock,parent:market.parent,gold:market.gold};
  const idxs={},initial={};
  for(const [key,d] of Object.entries(all)){
    if(!hasData(d))continue;
    const map=new Map(d.bars.map(b=>[toDateKey(b.t),b.c]));
    idxs[key]=map;
    const first=stockBars.map(b=>map.get(toDateKey(b.t))).find(Number.isFinite);
    initial[key]=first;
  }
  const stockBase=stockBars[0].c;
  const series={stock:stockBars.map(b=>(b.c/stockBase-1)*100)};
  for(const key of ["parent","gold"]){
    const data=market[key];if(!hasData(data))continue;
    const map=idxs[key],base=initial[key];
    if(!Number.isFinite(base)||base<=0)continue;
    const ordered=[...map].sort((a,b)=>a[0].localeCompare(b[0]));
    let k=0,latestValue=null,latestKey="";
    series[key]=stockBars.map(b=>{
      const day=toDateKey(b.t);
      while(k<ordered.length&&ordered[k][0]<=day){latestKey=ordered[k][0];latestValue=ordered[k][1];k++;}
      const age=(Date.parse(day+"T00:00:00Z")-Date.parse(latestKey+"T00:00:00Z"))/86400000;
      return latestValue!==null&&age<=5&&(day>=ordered[0][0])?(latestValue/base-1)*100:null;
    });
  }
  return {bars:stockBars,series,stamp:market.stock.providerQuoteTime};
}
function drawComparison(){
  const host=$("compare-chart");if(!host)return;const data=compareData();
  if(!data){host.textContent="Comparative data unavailable. No substitute historical returns have been generated.";set("compare-asof","Market observations unavailable");return}
  const available=Object.keys(data.series).filter(x=>compareVisible.has(x));
  if(!available.length){host.textContent="Select at least one security to display its return path.";return}
  const all=available.flatMap(k=>data.series[k]).filter(Number.isFinite);
  if(all.length<2){host.textContent="Insufficient verified comparison data.";return}
  const W=980,H=345,L=69,R=38,T=20,B=45,innerW=W-L-R,innerH=H-T-B;
  const min=Math.min(-1,...all),max=Math.max(1,...all),pad=Math.max(2,(max-min)*.1),lo=Math.floor((min-pad)/5)*5,hi=Math.ceil((max+pad)/5)*5;
  const y=v=>T+(hi-v)*innerH/(hi-lo);
  const x=i=>L+i*innerW/(data.bars.length-1);
  let html='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Verified historical relative performance percentage comparison for Zijin Gold International, Zijin Mining and COMEX gold futures">';
  for(let k=0;k<=5;k++){
    const value=lo+(hi-lo)*k/5,yy=y(value);
    html+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" stroke="'+COL.grid+'" stroke-dasharray="4 7"/>';
    html+='<text x="'+(L-12)+'" y="'+(yy+4)+'" text-anchor="end" fill="'+COL.muted+'" font-size="13">'+value.toFixed(0)+'%</text>';
  }
  for(const key of available){
    const values=data.series[key],color=COL[key];
    let path="",prev=-2;
    values.forEach((v,i)=>{
      if(!Number.isFinite(v))return;
      path+=(i-prev>1?"M":"L")+x(i).toFixed(1)+" "+y(v).toFixed(1)+" ";prev=i;
    });
    html+='<path d="'+path+'" fill="none" stroke="'+color+'" stroke-width="'+(key==="stock"?3.3:2.3)+'" stroke-linejoin="round"/>';
  }
  for(const k of [0,1,2,3,4]){
    const idx=Math.round(k*(data.bars.length-1)/4);
    html+='<text x="'+x(idx)+'" y="'+(H-11)+'" text-anchor="middle" font-size="13" fill="'+COL.muted+'">'+toDateKey(data.bars[idx].t).slice(5)+'</text>';
  }
  html+='<rect data-compare-hitbox="1" x="'+L+'" y="'+T+'" width="'+innerW+'" height="'+innerH+'" fill="transparent" pointer-events="all"/></svg>';
  host.innerHTML=html;
  const svg=host.querySelector("svg"),hit=host.querySelector("[data-compare-hitbox]");
  if(hit)hit.addEventListener("pointermove",e=>{
    const rect=svg.getBoundingClientRect(),xp=(e.clientX-rect.left)/rect.width*W;
    const idx=Math.round((xp-L)/innerW*(data.bars.length-1));
    const j=Math.max(0,Math.min(data.bars.length-1,idx));
    const items=available.map(k=>k.toUpperCase()+": "+percent(data.series[k][j])).join("  |  ");
    set("compare-readout",toDateKey(data.bars[j].t)+"  •  "+items);
  });
  if(hit)hit.addEventListener("pointerleave",()=>set("compare-readout","Hover or tap to compare observed percentage performance at each trading session."));
  if(hit)hit.addEventListener("pointerdown",e=>{const rect=svg.getBoundingClientRect(),xx=(e.clientX-rect.left)/rect.width*W;const j=Math.max(0,Math.min(data.bars.length-1,Math.round((xx-L)/innerW*(data.bars.length-1))));set("compare-readout",toDateKey(data.bars[j].t)+"  •  "+available.map(k=>k.toUpperCase()+" "+percent(data.series[k][j])).join("  |  "));});
  set("compare-asof","2259.HK "+clock(data.stamp)+" · Source-delayed close values. Other securities use their own market session dates.");
}
function attach(){
  const controls=["gold","production","cost","multiple","dilution"];
  for(const key of controls){$("model-"+key)?.addEventListener("input",updateForecast);}
  $("reset-model-assumptions")?.addEventListener("click",()=>{
    for(const [key,val] of Object.entries(modelDefaults))setInput("model-"+key,val);
    updateForecast();
  });
  $("export-scenarios")?.addEventListener("click",exportProjections);
  document.querySelectorAll("[data-case]").forEach(button=>button.addEventListener("click",()=>{
    const key=button.dataset.case;const price=projections?.values?.[key]?.[3];
    if(!Number.isFinite(price)){set("model-data-status","Forecast unavailable: a verified market and gold anchor is required.");return;}
    currentScenario=key;highlightSelection();
    document.dispatchEvent(new CustomEvent("zgi:scenario-select",{detail:{scenario:key,price}}));
  }));
  document.querySelectorAll("[data-compare-range]").forEach(btn=>btn.addEventListener("click",()=>{
    compareRange=btn.dataset.compareRange;
    document.querySelectorAll("[data-compare-range]").forEach(x=>x.classList.toggle("active",x===btn));
    drawComparison();
  }));
  document.querySelectorAll("[data-compare-symbol]").forEach(btn=>btn.addEventListener("click",()=>{
    const s=btn.dataset.compareSymbol;
    if(compareVisible.has(s))compareVisible.delete(s);else compareVisible.add(s);
    document.querySelectorAll("[data-compare-symbol]").forEach(x=>x.setAttribute("aria-pressed",String(compareVisible.has(x.dataset.compareSymbol))));
    drawComparison();
  }));
  document.addEventListener("zgi:market",e=>{
    market=e.detail;updateKPIs();pulse();drawComparison();updateForecast();
  });
}
attach();scenarioControls();
})();
