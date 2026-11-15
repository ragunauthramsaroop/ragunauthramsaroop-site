/* ZGI Quant Research Engine 1.0
   Deterministic and testable market-history analytics.
   These are empirical stress models, not calibrated investment advice or official forecasts.
   No network access, no persistence, no personal grant data.
*/
(function(root,factory){
  const lib=factory();
  if(typeof module==="object"&&module.exports)module.exports=lib;
  if(root)root.ZGIQuant=lib;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const finite=Number.isFinite;
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
function stdev(a){if(a.length<2)return null;const m=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)*(v-m),0)/(a.length-1))}
function sortedBars(bars){return (bars||[]).filter(b=>finite(b?.t)&&finite(b?.c)&&b.c>0).slice().sort((a,b)=>a.t-b.t)}
function logReturns(bars){const a=sortedBars(bars),r=[];for(let i=1;i<a.length;i++){const value=Math.log(a[i].c/a[i-1].c);if(finite(value))r.push(value)}return r}
function quantile(values,p){if(!Array.isArray(values)||values.length===0||!finite(p))return null;const a=values.filter(finite).slice().sort((x,y)=>x-y);if(!a.length)return null;const v=(a.length-1)*Math.max(0,Math.min(1,p)),lo=Math.floor(v),hi=Math.ceil(v);return a[lo]+(a[hi]-a[lo])*(v-lo)}
function histRisk(bars,window=60){
 const r=logReturns(bars);
 if(r.length<20)return null;
 const slice=r.slice(-Math.max(20,window)),mu=mean(slice),sigma=stdev(slice);
 const b=sortedBars(bars),prices=b.slice(-Math.min(252,b.length)).map(x=>x.c);
 let max=-Infinity,dd=0;
 for(const x of prices){max=Math.max(max,x);dd=Math.min(dd,x/max-1)}
 const r20=r.slice(-20),v20=stdev(r20);
 return {observations:r.length,driftDaily:mu,driftAnnual:mu*252,volAnnual:sigma*Math.sqrt(252),vol20:v20*Math.sqrt(252),maxDrawdown:dd,
  worstDay:Math.min(...slice),bestDay:Math.max(...slice),monthNegative:r20.filter(x=>x<0).length};
}
function dateKey(t){return new Date(t*1000).toISOString().slice(0,10)}
function dailyChangeMap(bars){const b=sortedBars(bars),map=new Map();
 for(let i=1;i<b.length;i++){const r=Math.log(b[i].c/b[i-1].c);if(finite(r))map.set(dateKey(b[i].t),r)}return map}
function correlation(a,b){
 if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length||a.length<16)return null;
 const ma=mean(a),mb=mean(b);let cov=0,va=0,vb=0;
 for(let i=0;i<a.length;i++){const da=a[i]-ma,db=b[i]-mb;cov+=da*db;va+=da*da;vb+=db*db}
 return va>0&&vb>0?cov/Math.sqrt(va*vb):null;
}
function matchedCorrelation(stock,other,lagDays=0){
 const x=dailyChangeMap(stock),y=dailyChangeMap(other),a=[],b=[],pairs=[];
 for(const [key,value] of x){
   const otherKey=lagDays===0?key:new Date(Date.parse(key+"T00:00:00Z")-lagDays*86400000).toISOString().slice(0,10);
   if(y.has(otherKey)){a.push(value);b.push(y.get(otherKey));pairs.push(key)}
 }
 return {coefficient:correlation(a,b),count:a.length,label:lagDays===0?"UTC-date-aligned returns":"Calendar-day lag: "+lagDays+" day",first:pairs[0]||null,last:pairs.at(-1)||null};
}
function backtestCoverage(bars,lookback=80,horizon=20){
 const b=sortedBars(bars),rs=logReturns(b),out=[];
 for(let t=lookback;t+horizon<b.length;t+=5){
   const hist=rs.slice(t-lookback,t),sigma=stdev(hist);
   if(!finite(sigma)||sigma<=0)continue;
   const current=b[t].c,future=b[t+horizon].c;
   const width=1.281551565545*sigma*Math.sqrt(horizon);
   const low=current*Math.exp(-width),high=current*Math.exp(width);
   out.push({date:dateKey(b[t].t),endDate:dateKey(b[t+horizon].t),low,high,realized:future,covered:future>=low&&future<=high});
 }
 return {count:out.length,coverage:out.length?out.filter(x=>x.covered).length/out.length:null,
  expectedCoverage:.80,lookback,horizon,windows:out.slice(-8)};
}
function xorshift(seed){let x=(Math.floor(seed)>>>0)||123456789;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296}}
function businessDays(from,to){
 const start=new Date(Date.UTC(from.getUTCFullYear(),from.getUTCMonth(),from.getUTCDate()));
 const end=new Date(Date.UTC(to.getUTCFullYear(),to.getUTCMonth(),to.getUTCDate()));
 if(end<=start)return 0;
 let days=0;for(let t=start.getTime()+86400000;t<=end.getTime();t+=86400000){const d=new Date(t).getUTCDay();if(d!==0&&d!==6)days++}
 return days;
}
function bootstrappedFuture(bars,options={}){
 const b=sortedBars(bars),returns=logReturns(b);
 if(returns.length<65)return {ok:false,error:"INSUFFICIENT_HISTORY",observations:returns.length,minRequired:65};
 const anchor=b.at(-1),n=Math.max(500,Math.min(5000,Math.floor(options.simulations||2000)));
 const annualDrift=finite(options.annualDrift)?Math.max(-.5,Math.min(.7,options.annualDrift)):.08;
 const volatilityFactor=finite(options.volatilityFactor)?Math.max(.4,Math.min(3,options.volatilityFactor)):1;
 const block=Math.max(1,Math.min(15,Math.floor(options.blockSize||5)));
 const seed=finite(options.seed)?options.seed:20291111;
 const rng=xorshift(seed);
 const avg=mean(returns),sample=returns.map(x=>x-avg);
 const dates=options.dates||["2027-12-31","2028-12-31","2029-11-12","2029-12-31"];
 const end=new Date(dates.at(-1)+"T00:00:00Z");
 const today=new Date(anchor.t*1000);
 const checkpoints=dates.map(x=>businessDays(today,new Date(x+"T00:00:00Z")));
 const horizon=checkpoints.at(-1);
 if(horizon<1||horizon>2600)return {ok:false,error:"INVALID_HORIZON"};
 const buckets=dates.map(()=>[]);
 const historicalAnnualVol=stdev(returns)*Math.sqrt(252);
 const lastClose=anchor.c;
 const logDrift=annualDrift/252;
 for(let sim=0;sim<n;sim++){
   let logPrice=Math.log(lastClose),currentBlock=0,k=0,index=0;
   for(let day=1;day<=horizon;day++){
     if(currentBlock===0){index=Math.floor(rng()*Math.max(1,sample.length-block+1));currentBlock=block}
     const innovation=sample[index+(block-currentBlock)]*volatilityFactor;
     logPrice+=logDrift+innovation;
     currentBlock--;
     if(k<checkpoints.length&&day===checkpoints[k]){buckets[k].push(Math.exp(Math.max(-10,Math.min(17,logPrice))));k++}
   }
 }
 const priceLevels=Array.isArray(options.levels)?options.levels.filter(x=>finite(x)&&x>=0):[87.48,175,250];
 const rows=dates.map((date,i)=>{
  const v=buckets[i];
  return {date,days:checkpoints[i],p05:quantile(v,.05),p10:quantile(v,.10),p25:quantile(v,.25),median:quantile(v,.50),p75:quantile(v,.75),p90:quantile(v,.90),p95:quantile(v,.95),
   mean:mean(v),breakEvenProbability:priceLevels[0]!==undefined?v.filter(x=>x>priceLevels[0]).length/v.length:null,
   thresholds:Object.fromEntries(priceLevels.map(x=>[String(x),v.filter(y=>y>=x).length/v.length]))}
 });
 return {ok:true,simulations:n,dates,rows,lastClose,historicalObservations:returns.length,historicalAnnualVol,annualDrift,volatilityFactor,seed,blockSize:block,
  disclaimer:"Empirical centered block-bootstrap conditional on user drift and volatility assumptions. Not calibrated real-world probabilities. Price-only, excludes dividends, fees, tax and vesting."};
}
function stressValuation(stockPrice,goldCurrent,assumedGold,tonnes,options={}){
 const baseProduction=finite(options.baseProduction)?options.baseProduction:59.2;
 const baseAisc=finite(options.baseAisc)?options.baseAisc:1649;
 const costGrowth=finite(options.costGrowth)?options.costGrowth:.04;
 const multiple=finite(options.multiple)?options.multiple:1;
 const dilution=finite(options.dilution)?options.dilution:0;
 const years=finite(options.years)?options.years:3;
 const baseMargin=goldCurrent-baseAisc;
 if(![stockPrice,goldCurrent,assumedGold,tonnes].every(finite)||stockPrice<=0||baseProduction<=0||baseMargin<=0||tonnes<=0)return null;
 const margin=assumedGold-baseAisc*Math.pow(1+costGrowth,years);
 return margin<=0?0:stockPrice*(tonnes/baseProduction)*(margin/baseMargin)*multiple/(1+dilution);
}
function sensitivityGrid(stockPrice,gold,options={}){
 const goldInputs=options.goldInputs||[3000,4000,5000,6000,7000];
 const productionInputs=options.productionInputs||[50,60,70,80,90];
 return {goldInputs,productionInputs,values:productionInputs.map(p=>goldInputs.map(g=>stressValuation(stockPrice,gold,g,p,options)))};
}
return Object.freeze({mean,stdev,logReturns,quantile,histRisk,correlation,matchedCorrelation,backtestCoverage,businessDays,bootstrappedFuture,stressValuation,sensitivityGrid});
});
