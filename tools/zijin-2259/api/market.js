/* Public, read-only market-data bridge for the independent HKEX dashboard.
 * Yahoo Finance is an unofficial delayed-data endpoint; availability is not guaranteed.
 * There is no paid real-time HKEX entitlement. Provider timestamps are returned unaltered.
 */
const ALLOWED = new Map([
  ["2259.HK", {name:"Zijin Gold International",currency:"HKD",kind:"equity"}],
  ["2899.HK", {name:"Zijin Mining Group",currency:"HKD",kind:"equity"}],
  ["GC=F", {name:"Gold futures (COMEX)",currency:"USD",kind:"gold_futures"}]
]);
const PERIODS = new Set(["5d","1mo","3mo","6mo","1y","2y"]);
const INTERVALS = new Set(["1d","1wk","15m"]);
const makeError = (res,code,msg,detail={})=>res.status(code).json({ok:false,message:msg,...detail});
module.exports = async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET, OPTIONS");
  res.setHeader("Content-Type","application/json; charset=utf-8");
  if(req.method==="OPTIONS")return res.status(204).end();
  if(req.method!=="GET")return makeError(res,405,"GET only");
  const symbol=typeof req.query.symbol==="string"?req.query.symbol:"2259.HK";
  const range=typeof req.query.range==="string"?req.query.range:"1y";
  const interval=typeof req.query.interval==="string"?req.query.interval:"1d";
  if(!ALLOWED.has(symbol)||!PERIODS.has(range)||!INTERVALS.has(interval))return makeError(res,400,"Unsupported symbol or range");
  if(interval==="15m"&&!["5d","1mo"].includes(range))return makeError(res,400,"Intraday interval requires 5d or 1mo range");
  res.setHeader("Cache-Control",interval==="15m"?"public, s-maxage=60, stale-while-revalidate=120":"public, s-maxage=180, stale-while-revalidate=300");
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  const upstreams=["query1.finance.yahoo.com","query2.finance.yahoo.com"];
  let lastError="No provider response";
  try {
    for(const host of upstreams){
      const url=new URL("https://"+host+"/v8/finance/chart/"+encodeURIComponent(symbol));
      url.searchParams.set("range",range);
      url.searchParams.set("interval",interval);
      url.searchParams.set("events","history");
      try{
        const upstream=await fetch(url,{signal:controller.signal,headers:{"User-Agent":"Mozilla/5.0 (compatible; ZGIResearch/1.0)","Accept":"application/json","Accept-Language":"en-US,en;q=0.9"},redirect:"follow"});
        if(!upstream.ok){lastError="Upstream HTTP "+upstream.status;continue}
        const data=await upstream.json();
        const result=data?.chart?.result?.[0], meta=result?.meta, series=result?.indicators?.quote?.[0], ts=result?.timestamp;
        if(!result||!meta||!series||!Array.isArray(ts)){lastError="Provider data missing";continue}
        const actualSymbol=String(meta.symbol||"").toUpperCase();
        if(actualSymbol!==symbol.toUpperCase()){lastError="Provider symbol mismatch";continue}
        const selected=ALLOWED.get(symbol);
        const returnedCurrency=String(meta.currency||"").toUpperCase();
        if(returnedCurrency&&returnedCurrency!==selected.currency){lastError="Provider currency mismatch";continue}
        const returnedExchange=String(meta.exchangeName||"").toUpperCase();
        if(symbol.endsWith(".HK")&&returnedExchange&&!/(HK|HKG|SEHK)/.test(returnedExchange)){lastError="Provider exchange mismatch";continue}
        const quote=Number(meta.regularMarketPrice);
        const time=Number(meta.regularMarketTime);
        const ohlc=[];
        for(let i=0;i<ts.length;i++){
          const t=Number(ts[i]),o=Number(series.open?.[i]),h=Number(series.high?.[i]),l=Number(series.low?.[i]),c=Number(series.close?.[i]);
          // Missing volume is not a genuine zero-volume trading session.
          const rawVolume=series.volume?.[i];
          const volume=rawVolume===null||rawVolume===undefined||rawVolume===""?null:Number(rawVolume);
          if(!Number.isFinite(t)||!Number.isFinite(c)||c<=0||!Number.isFinite(o)||!Number.isFinite(h)||!Number.isFinite(l))continue;
          if(h<l||o>h*1.005||c>h*1.005||o<l*.995||c<l*.995)continue;
          ohlc.push({t,o,h,l,c,v:Number.isFinite(volume)&&volume>=0?volume:null});
        }
        if(ohlc.length<2){lastError="Insufficient OHLC bars";continue}
        // Yahoo occasionally mirrors the preceding session's full daily OHLCV
        // into a new pre-opening timestamp. Such a bar is NOT a trade or a
        // completed trading session. Require every price and volume to match
        // before discarding a carry-forward placeholder.
        let rejectedCarryForwardBars=0;
        if(interval==="1d"){
          const sameBar=(a,b)=>["o","h","l","c"].every(key=>Math.abs(a[key]-b[key])<1e-6)&&a.v===b.v;
          while(ohlc.length>=3&&sameBar(ohlc.at(-1),ohlc.at(-2))){
            ohlc.pop();rejectedCarryForwardBars++;
          }
        }
        const last=ohlc.at(-1);
        // Daily market statistics are based on the last verified daily bar,
        // NOT on an upstream metadata refresh clock or unofficial tick price.
        // Both daily and 15-minute chart prices derive from the same verified
        // final historical bar, not an unsupported real-time quote metadata tick.
        const lastValidQuote=last.c;
        const marketTime=Number.isFinite(time)&&time>0?time:last.t;
        const observationTime=last.t;
        // For daily bars, use the preceding trading session. chartPreviousClose is often
        // the first close in the selected chart range, not the prior day's close.
        const previousClose=Number(interval==="1d"&&ohlc.length>=2?ohlc.at(-2).c:meta.previousClose);
        const change=Number.isFinite(previousClose)&&previousClose>0?lastValidQuote-previousClose:null;
        const changePercent=change!==null?change/previousClose*100:null;
        return res.status(200).json({
          ok:true,symbol,displayName:selected.name,currency:selected.currency,kind:selected.kind,
          provider:"Yahoo Finance chart (unofficial, delayed)",sourceSymbol:meta.symbol,sourceCurrency:meta.currency||null,
          exchange:meta.exchangeName||null,exchangeTimezone:meta.exchangeTimezoneName||null,
          providerQuoteTime:new Date(observationTime*1000).toISOString(),
          upstreamMetadataTime:new Date(marketTime*1000).toISOString(),
          observationType:interval==="1d"?"LAST VALID DAILY BAR":interval==="15m"?"LAST VALID 15-MINUTE BAR":"LAST VALID HISTORICAL BAR",
          // Yahoo's daily OHLC bar timestamp identifies a price bar; it is not
          // the time of the last exchange trade or an intraday price update.
          barTimestampMeaning:interval==="1d"?"DAILY PRICE BAR LABEL; NOT LAST-TRADE TIME":"PROVIDER BAR TIMESTAMP; NOT LIVE TRADE TIME",
          barTimeIsLastTrade:false,
          rejectedCarryForwardBars,
          latestBarTime:new Date(last.t*1000).toISOString(),
          fetchedAt:new Date().toISOString(),
          regularMarketPrice:lastValidQuote,previousClose:Number.isFinite(previousClose)&&previousClose>0?previousClose:null,
          change,changePercent,marketState:meta.marketState||"unknown",range,interval,
          dataDelay:"Provider/exchange delayed; daily bar timestamp is session evidence, not a live trade timestamp; not licensed real-time HKEX data",
          bars:ohlc.slice(-440)
        });
      }catch(err){lastError=err?.name==="AbortError"?"Upstream timeout":"Provider fetch error";}
    }
    return makeError(res,503,"Market-data provider unavailable",{
      symbol,provider:"Yahoo Finance (unofficial)",dataDelay:"No live or delayed quote available; do not infer market price",reason:lastError,
      checkedAt:new Date().toISOString()
    });
  }finally{clearTimeout(timeout)}
}