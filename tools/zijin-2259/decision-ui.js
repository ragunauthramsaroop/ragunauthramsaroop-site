/* Decision intelligence layer. All user inputs, including employment tests,
 * remain only in the browser. The equity scenario surface is hypothetical.
 */
(()=>{"use strict";
const Q=window.ZGIQuant;
const $=id=>document.getElementById(id);
if(!Q)return;
const fmt=new Intl.NumberFormat("en-HK",{minimumFractionDigits:2,maximumFractionDigits:2});
const compact=new Intl.NumberFormat("en-HK",{notation:"compact",maximumFractionDigits:1});
const dt=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Hong_Kong",year:"numeric",month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
let feeds=null,quant=null,selectedCell=null;
const round=x=>Number.isFinite(x)?fmt.format(x):"—";
const clock=x=>x&&Number.isFinite(Date.parse(x))?dt.format(new Date(x))+" HKT":"Unverified time";
const valid=d=>d?.bars?.length>1&&Number.isFinite(d.regularMarketPrice)&&!d.archive&&window.ZGIResearchGate?.assessFeed(d,d?.symbol).usable===true;
function set(id,s){const el=$(id);if(el)el.textContent=String(s)}
function makeEl(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el}
function renderLedger(){
 const root=$("data-ledger");if(!root)return;root.replaceChildren();
 const items=[
  {symbol:"2259.HK",label:"ZIJIN GOLD INTERNATIONAL",data:feeds?.stock,fresh:feeds?.fresh?.stock},
  {symbol:"2899.HK",label:"ZIJIN MINING GROUP",data:feeds?.parent,fresh:feeds?.fresh?.parent},
  {symbol:"GC=F",label:"COMEX GOLD FUTURES",data:feeds?.gold,fresh:feeds?.fresh?.gold},
 ];
 for(const item of items){
   const row=makeEl("div","ledger-row");
   const ident=makeEl("div","ledger-identity");ident.append(makeEl("strong","",item.symbol),makeEl("small","",item.label));
   const price=makeEl("strong","ledger-price",valid(item.data)?(item.symbol==="GC=F"?"US$":"HK$")+round(item.data.regularMarketPrice):"NO VERIFIED QUOTE");
   const timestamp=makeEl("div","ledger-timestamp",valid(item.data)?clock(item.data.providerQuoteTime)+" · "+item.data.bars.length+" bars":"Provider unavailable");
   const status=makeEl("span",item.fresh?"ledger-state delay":"ledger-state held",valid(item.data)?item.fresh?"PROVIDER DELAYED":"LAST VALID OBSERVATION":"UNAVAILABLE");
   row.append(ident,price,timestamp,status);root.append(row);
 }
 const footer=makeEl("p","ledger-foot", "Source: Yahoo Finance chart endpoint (unofficial redistribution). Price source times are provided by the upstream, not inferred from this browser. HKEX licensed real-time entitlement is not configured. Retrieved: "+(feeds?.refreshedAt?clock(feeds.refreshedAt):"pending")+". Exchange holidays, trading halts and feed outages are not guaranteed to be detected.");
 root.append(footer);
}
function readAssumptions(){
 return {baseProduction:59.2,baseAisc:1649,costGrowth:Math.max(0,Number($("model-cost")?.value||4)/100),
  multiple:Math.max(.1,Number($("model-multiple")?.value||1)),
  dilution:Math.max(0,Number($("model-dilution")?.value||0)/100),years:3,
  goldInputs:[3000,4000,5000,6000,7000],productionInputs:[50,60,70,80,90]};
}
function renderStress(){
 const root=$("stress-heatmap");if(!root)return;root.replaceChildren();
 const stock=feeds?.stock,gold=feeds?.gold;
 if(!valid(stock)||!valid(gold)){root.textContent="Valuation surface unavailable until the stock and gold futures sources have passed validation.";set("stress-readout","No model price substituted for missing source prices.");return}
 const cfg=readAssumptions();
 const matrix=Q.sensitivityGrid(stock.regularMarketPrice,gold.regularMarketPrice,cfg);
 const vals=matrix.values.flat().filter(Number.isFinite),lo=Math.min(...vals),hi=Math.max(...vals),span=hi-lo;
 const header=makeEl("div","stress-corner","PRODUCTION ↘ / GOLD →");header.setAttribute("role","note");root.append(header);
 for(const g of matrix.goldInputs){const el=makeEl("div","stress-head","US$"+(g/1000).toFixed(0)+"k");root.append(el);}
 matrix.productionInputs.forEach((p,i)=>{
  const label=makeEl("div","stress-rowlabel",p+" tonnes");root.append(label);
  matrix.goldInputs.forEach((g,j)=>{
    const v=matrix.values[i][j],ratio=span>0?(v-lo)/span:.5,level=Math.min(4,Math.max(0,Math.floor(ratio*5)));
    const button=makeEl("button","stress-cell heat-"+level,Number.isFinite(v)?"HK$"+Math.round(v).toLocaleString("en-HK"):"UNAVAILABLE");
    button.type="button";button.setAttribute("aria-label","Gold "+g+" US dollars, output "+p+" tonnes, hypothetical HKD share price "+round(v));
    button.disabled=!Number.isFinite(v);
    if(selectedCell&&selectedCell.g===g&&selectedCell.p===p)button.classList.add("selected");
    button.addEventListener("click",()=>{
      selectedCell={g,p};
      $("model-gold").value=String(g);$("model-production").value=String(p);
      $("model-gold").dispatchEvent(new Event("input",{bubbles:true}));
      $("model-production").dispatchEvent(new Event("input",{bubbles:true}));
      renderStress();
      set("stress-readout","Selected "+p+" tonnes and US$"+g.toLocaleString("en-HK")+" gold futures assumption → conditional price HK$"+round(v)+". Values recalculated from latest delayed stock price HK$"+round(stock.regularMarketPrice)+".");
    });
    root.append(button);
  });
 });
 set("stress-readout","25 interactive combinations based on current 2259.HK HK$"+round(stock.regularMarketPrice)+" and COMEX benchmark US$"+round(gold.regularMarketPrice)+". Select a cell to change two 2029 drivers.");
}
function eligibility(){
 const years=[2026,2027,2028],values=[];
 for(const year of years){
  const field=$("elig-roe-"+year);
  const text=field?.value.trim();
  const n=text!==""?Number(text):NaN;
  if(!Number.isFinite(n)||n< -100||n>100)values.push(null);
  else values.push(n);
 }
 const all=values.every(Number.isFinite),avg=all?values.reduce((a,b)=>a+b,0)/3:null;
 const individual=$("elig-performance")?.value||"unknown",employment=$("elig-employment")?.value||"unknown";
 const root=$("eligibility-result");if(!root)return;root.replaceChildren();
 let title="",explanation="",state="";
 if(individual==="fail"||employment==="fail"||(all&&avg<15)){
  title="CONDITIONS NOT MET IN THIS MODEL";state="fail";
  explanation="One or more entered conditions fails. The illustrative award cannot be treated as vested on these assumptions. Actual scheme rules and official determinations govern.";
 }else if(all&&avg>=15&&individual==="pass"&&employment==="pass"){
  title="SCREENING THRESHOLDS MET";state="pass";
  explanation="Entered three-year company ROE average "+avg.toFixed(2)+"% meets the 15% threshold and both other assumptions are marked met. This is a preliminary user-input screen only, not company authorisation to vest.";
 }else{
  title="ELIGIBILITY NOT YET DETERMINED";state="unknown";
  explanation=all?"Entered ROE average "+avg.toFixed(2)+"%. Individual or employment determination remains unknown.":"Annual ROE evidence for all three years has not been entered. An award payout should not be assumed.";
 }
 root.className="eligibility-result "+state;root.append(makeEl("strong","",title),makeEl("span","",explanation));
}
function decisionMemo(){
 const el=$("decision-summary");if(!el)return;el.replaceChildren();
 const s=feeds?.stock,g=feeds?.gold,p=feeds?.parent;
 if(!valid(s)||!valid(g)){el.append(makeEl("p","","Source validation is incomplete. No contemporaneous market conclusion or 2029 valuation should be inferred from an archived or unavailable quote."));return}
 const doc=[];
 const asof=clock(s.providerQuoteTime),price=s.regularMarketPrice;
 const sep=(price/87.48-1)*100;
 doc.push({tag:"01 / MARKET REFERENCE",text:"2259.HK last provider observation HK$"+round(price)+" ("+asof+"). Price is "+(sep>=0?"+":"")+sep.toFixed(1)+"% versus the published HK$87.48 purchase reference. A positive spread now is not a vested or realised award."});
 const q=quant?.rows?.[2];
 if(q)doc.push({tag:"02 / STATISTICAL UNCERTAINTY",text:"Conditional November 2029 bootstrap median HK$"+round(q.median)+", 90% simulated range HK$"+round(q.p05)+" to HK$"+round(q.p95)+". These are historical-resampling outcomes, not calibrated real-world probabilities or an analyst price target."});
 else doc.push({tag:"02 / STATISTICAL UNCERTAINTY",text:"The research engine has not returned a validated distribution. Do not use a fabricated probability estimate."});
 const cost=1649,margin=g.regularMarketPrice-cost;
 doc.push({tag:"03 / GOLD ECONOMICS",text:"GC=F gold futures observed US$"+round(g.regularMarketPrice)+" (source "+clock(g.providerQuoteTime)+"). Minus 9M 2026 unaudited AISC reference US$"+cost+"/oz gives US$"+round(margin)+" per ounce of theoretical spread. Futures are not company realised gold prices and this subtraction is not free cash flow."});
 doc.push({tag:"04 / GOVERNANCE & ELIGIBILITY",text:"The shareholder incentive award remains subject to confirmed company ROE, individual assessment, continued eligibility and trustee instructions. The parent stock "+(valid(p)?"shows HK$"+round(p.regularMarketPrice)+" ("+clock(p.providerQuoteTime)+")":"source is unavailable")+". Parent performance does not determine the subsidiary share price mechanically."});
 for(const item of doc){
  const block=makeEl("div","decision-note");block.append(makeEl("small","",item.tag),makeEl("p","",item.text));el.append(block);
 }
}
function attach(){
 document.addEventListener("zgi:market",e=>{feeds=e.detail;renderLedger();renderStress();decisionMemo()});
 document.addEventListener("zgi:quant",e=>{quant=e.detail?.result;decisionMemo()});
 for(const id of ["model-gold","model-production","model-cost","model-multiple","model-dilution"]){
  $(id)?.addEventListener("input",()=>renderStress());
 }
 for(const year of [2026,2027,2028])$("elig-roe-"+year)?.addEventListener("input",eligibility);
 for(const id of ["elig-performance","elig-employment"])$(id)?.addEventListener("change",eligibility);
 $("eligibility-reset")?.addEventListener("click",()=>{
  for(const year of [2026,2027,2028])$("elig-roe-"+year).value="";
  $("elig-performance").value="unknown";$("elig-employment").value="unknown";eligibility();
 });
 $("ledger-refresh")?.addEventListener("click",()=>$("refresh-market-now")?.click());
 eligibility();
}
attach();
})();
