/* Source-confidence policy. Independent research, not real-time exchange data.
 * Kept dependency-free for the browser and deterministic Node regression tests.
 * A seven-calendar-day cutoff is a conservative safety policy, NOT an HKEX
 * trading-session calendar. Long holidays can temporarily suspend projections.
 */
(function (root) {
  "use strict";
  const DAY=86400000, MAX_AGE=7*DAY, FUTURE_TOLERANCE=3600000;
  const INSTRUMENTS=Object.freeze({
    "2259.HK":{currency:"HKD",label:"Zijin Gold International"},
    "2899.HK":{currency:"HKD",label:"Zijin Mining Group"},
    "GC=F":{currency:"USD",label:"COMEX gold futures"}
  });
  const held=reason=>({usable:false,state:"held",reason});
  const positive=x=>typeof x==="number"&&Number.isFinite(x)&&x>0;
  function assessFeed(data,symbol,now=Date.now()){
    const spec=INSTRUMENTS[symbol];
    if(!spec)return held("Unsupported instrument");
    if(!data||data.archive||data.ok!==true)return held("Verified provider response unavailable");
    if(data.symbol!==symbol||String(data.sourceSymbol||"").toUpperCase()!==symbol.toUpperCase()||data.currency!==spec.currency)
      return held("Ticker or currency identity mismatch");
    if(!String(data.provider||"").includes("Yahoo Finance")||
       !String(data.dataDelay||"").toLowerCase().includes("delayed"))
      return held("Delayed provider attribution missing");
    if(!positive(data.regularMarketPrice)||!Array.isArray(data.bars)||data.bars.length<2)
      return held("Price or historical series unavailable");
    let prior=-Infinity;
    for(const b of data.bars){
      if(!Number.isFinite(b.t)||b.t<=prior||!positive(b.o)||!positive(b.h)||!positive(b.l)||!positive(b.c)
         ||b.h<b.l||b.h<Math.max(b.o,b.c)*0.995||b.l>Math.min(b.o,b.c)*1.005
         ||(b.v!==null&&b.v!==undefined&&(!Number.isFinite(b.v)||b.v<0)))
        return held("Historical price or volume integrity failed");
      prior=b.t;
    }
    const last=data.bars[data.bars.length-1];
    if(Math.abs(data.regularMarketPrice-last.c)>Math.max(0.000001,last.c*0.00001))
      return held("Displayed quote differs from verified final bar");
    const observed=Date.parse(data.providerQuoteTime),latest=Date.parse(data.latestBarTime);
    if(!Number.isFinite(observed)||!Number.isFinite(latest)||Math.abs(observed-latest)>60000||
       Math.abs(latest-last.t*1000)>60000)
      return held("Price bar and source timestamps disagree");
    const age=now-observed;
    if(age< -FUTURE_TOLERANCE)return held("Source timestamp is in the future");
    if(age>MAX_AGE)return held("Source older than seven calendar days");
    const days=Math.max(0,age/DAY);
    return {usable:true,state:days>3?"older":"delayed",
      reason:days>3?"Older valid trading session; check exchange calendar":"Validated delayed historical bar",
      ageDays:days,observedAt:new Date(observed).toISOString()};
  }
  function assessPair(detail,now=Date.now()){
    const stock=assessFeed(detail?.stock,"2259.HK",now);
    const gold=assessFeed(detail?.gold,"GC=F",now);
    return {usable:stock.usable&&gold.usable,stock,gold,
      reason:stock.usable&&gold.usable?"Both source anchors pass validation":
        "Market-linked calculations withheld: "+(!stock.usable?"2259.HK "+stock.reason:"GC=F "+gold.reason)};
  }
  const policy=Object.freeze({MAX_AGE_DAYS:7,assessFeed,assessPair,INSTRUMENTS});
  if(typeof module==="object"&&module.exports)module.exports=policy;
  if(root)root.ZGIResearchGate=policy;
})(typeof window!=="undefined"?window:null);
