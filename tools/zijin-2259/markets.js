/* Native HKEX market charts.
 * All current bars originate from the delayed, timestamped Yahoo Finance bridge.
 * Archived stock bars show only if the bridge is inaccessible, with a clearly dated label.
 * No unsupported TradingView embeds, symbol substitution, or collection of award inputs.
 */
(() => {
"use strict";
const byId=id=>document.getElementById(id);
const NUM=new Intl.NumberFormat("en-HK",{maximumFractionDigits:2,minimumFractionDigits:2});
const INTEGER=new Intl.NumberFormat("en-HK",{maximumFractionDigits:0});
const HKT=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Hong_Kong",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
const DATE=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Hong_Kong",day:"2-digit",month:"short"});
const SHORT_TIME=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Hong_Kong",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
const COLORS={up:"#5dd2a6",down:"#ee8287",gold:"#e4bd7a",line:"#91b9e9",muted:"#8495a7",grid:"#344250",bg:"#0c1420"};
const BASE_API=location.hostname.endsWith(".vercel.app")||location.hostname==="localhost"?"": "https://zijin-2259-intelligence.vercel.app";
const BASE_ENDPOINT=BASE_API+"/api/market";
const state={stock:null,gold:null,parent:null,range:"5d",dailyRange:"6mo",style:"candles",interval:"15m",intraday:null,liveQuote:false,stockRefreshFailed:false,intradayRefreshFailed:false};
const DAYS={"5d":5,"1mo":31,"3mo":93,"6mo":186,"1y":370};
const ARCHIVE=[
["2026-11-04",116.6,134.4,116.6,133.6,13696240],
["2026-11-05",143,143,137.5,140.1,10772107],
["2026-11-06",133.8,138.7,132.3,136.5,7494160],
["2026-11-09",139.8,143.2,139.3,139.7,5063973],
["2026-11-10",142.5,143.6,138.3,141.2,3646124],
["2026-11-11",136,141.3,134.5,141.1,3868919],
["2026-11-12",137.1,137.5,125.2,126.5,11100487],
["2026-11-13",122.6,127.4,118.8,121.2,6999261]
].map(a=>({t:Date.parse(a[0]+"T13:30:00+08:00")/1000,o:a[1],h:a[2],l:a[3],c:a[4],v:a[5]}));
function setText(id,value){const element=byId(id);if(element)element.textContent=String(value)}
function formatPrice(value,cur="HKD"){return Number.isFinite(value)?(cur==="USD"?"US$":"HK$")+NUM.format(value):"—"}
function formatPercent(value){return Number.isFinite(value)?(value>0?"+":"")+value.toFixed(2)+"%":"—"}
function cleanBars(raw){
  if(!Array.isArray(raw))return [];
  return raw.filter(b=>b&&Number.isFinite(b.t)&&[b.o,b.h,b.l,b.c].every(v=>Number.isFinite(v)&&v>0)&&b.h>=b.l)
    .sort((a,b)=>a.t-b.t).filter((b,i,a)=>i===0||b.t>a[i-1].t).slice(-1600);
}
function formatTime(iso){const dt=new Date(iso);return !Number.isNaN(dt.getTime())?HKT.format(dt)+" HKT":"unavailable"}
const DAILY_DATE=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Hong_Kong",day:"2-digit",month:"short",year:"numeric"});
function describeBarTime(data){
  const iso=data?.providerQuoteTime,dt=new Date(iso);
  if(!iso||Number.isNaN(dt.getTime()))return "unavailable";
  if(data.archive||data.interval==="1d")return DAILY_DATE.format(dt)+" HKT daily bar (not last-trade time)";
  return formatTime(iso)+" provider bar (not live trade)";
}
function formatDate(ts){return DATE.format(new Date(ts*1000))}
function validateQuote(data,symbol,currency){
  if(!data||!data.ok||data.symbol!==symbol||data.currency!==currency||data.sourceSymbol?.toUpperCase()!==symbol.toUpperCase())throw new Error("Ticker or currency verification failed");
  const bars=cleanBars(data.bars);
  if(bars.length<2)throw new Error("Insufficient chart history");
  const latest=data.regularMarketPrice;
  if(!Number.isFinite(latest)||latest<=0)throw new Error("Invalid provider quote");
  if(!data.providerQuoteTime||Number.isNaN(Date.parse(data.providerQuoteTime)))throw new Error("Missing provider timestamp");
  if(window.ZGIResearchGate?.assessFeed({...data,bars},symbol).usable!==true)throw new Error("Source confidence policy rejected observation");
  return {...data,bars};
}
async function load(symbol,range="1y",interval="1d"){
  const url=new URL(BASE_ENDPOINT,location.origin);
  url.searchParams.set("symbol",symbol);url.searchParams.set("range",range);url.searchParams.set("interval",interval);
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10500);
  try {
    const response=await fetch(url,{cache:"no-store",signal:controller.signal,headers:{"Accept":"application/json"}});
    if(!response.ok)throw new Error("HTTP "+response.status);
    const data=await response.json();
    const currency=symbol==="GC=F"?"USD":"HKD";
    return validateQuote(data,symbol,currency);
  }finally{clearTimeout(timeout)}
}
function archiveStock(){
  return {ok:false,symbol:"2259.HK",currency:"HKD",displayName:"Zijin Gold International",
    provider:"Archived, independently checked November 2026 daily prices",
    providerQuoteTime:"2026-11-13T08:08:15.000Z",latestBarTime:"2026-11-13T08:08:15.000Z",
    regularMarketPrice:121.2,previousClose:126.5,change:-5.3,changePercent:-4.19,
    bars:ARCHIVE,archive:true,exchange:"HKG",range:"archived"};
}
function noteRefreshStatus(){
  const data=state.stock;if(!data)return;
  const label=data.archive?"HISTORICAL SNAPSHOT • NOT A CURRENT QUOTE":"YAHOO FINANCE • EXCHANGE-DELAYED DATA";
  setText("market-chart-status",label);
  setText("market-chart-timestamp","Latest observation: "+describeBarTime(data));
  const status=byId("stock-feed-state");
  if(status){
    status.className="feed-state "+(data.archive||state.stockRefreshFailed?"archived":"delayed");
    status.textContent=data.archive?"ARCHIVED 13 NOV 2026 • PROVIDER UNAVAILABLE":state.stockRefreshFailed?"REFRESH FAILED • PREVIOUS OBSERVATION RETAINED":"VERIFIED 2259.HK • DELAYED MARKET-DATA FEED";
  }
}
function renderQuote(){
  const data=state.stock;if(!data)return;
  const bars=data.bars,last=bars[bars.length-1];
  setText("live-stock-price",formatPrice(data.regularMarketPrice));
  const ch=data.change;
  setText("live-stock-change",(Number.isFinite(ch)?(ch>0?"+":"")+NUM.format(ch)+" / ":"")+formatPercent(data.changePercent));
  const el=byId("live-stock-change");if(el)el.className="quote-change "+(ch>0?"positive":ch<0?"negative":"");
  setText("live-stock-open",formatPrice(last.o));setText("live-stock-high",formatPrice(last.h));setText("live-stock-low",formatPrice(last.l));
  setText("live-stock-volume",last.v===null?"Not reported":INTEGER.format(last.v));
  setText("live-stock-time","SOURCE OBSERVATION: "+describeBarTime(data)+(data.archive?" • ARCHIVED":" • UNLICENSED DELAYED DATA"));
  noteRefreshStatus();
}
function simpleMA(values,p){return values.length<p?null:values.slice(-p).reduce((a,b)=>a+b,0)/p}
function fullRSI(values,period=14){
  const out=Array(values.length).fill(null);
  if(values.length<=period)return out;
  let gain=0,loss=0;
  for(let i=1;i<=period;i++){const diff=values[i]-values[i-1];if(diff>0)gain+=diff;else loss-=diff;}
  gain/=period;loss/=period;
  const calculate=()=>loss===0?(gain===0?50:100):100-100/(1+gain/loss);
  out[period]=calculate();
  for(let i=period+1;i<values.length;i++){
    const d=values[i]-values[i-1];gain=(gain*(period-1)+Math.max(d,0))/period;loss=(loss*(period-1)+Math.max(-d,0))/period;out[i]=calculate();
  }
  return out;
}
function ema(values,p){
  const output=Array(values.length).fill(null);
  if(values.length<p)return output;
  let sum=0;for(let i=0;i<p;i++)sum+=values[i];let last=sum/p;
  output[p-1]=last;const alpha=2/(p+1);
  for(let i=p;i<values.length;i++){last=last+alpha*(values[i]-last);output[i]=last;}
  return output;
}
function fullMACD(values){
  const fast=ema(values,12),slow=ema(values,26),diff=values.map((_,i)=>fast[i]!==null&&slow[i]!==null?fast[i]-slow[i]:null);
  const valid=diff.filter(Number.isFinite),signalEma=ema(valid,9),signal=Array(values.length).fill(null);
  let j=0;for(let i=0;i<diff.length;i++)if(diff[i]!==null){signal[i]=signalEma[j];j++;}
  const hist=diff.map((v,i)=>v!==null&&signal[i]!==null?v-signal[i]:null);
  return {line:diff,signal,hist};
}
function technicals(data){
  const close=data.bars.map(b=>b.c),n=close.length,last=close.at(-1);
  const rsi=fullRSI(close).at(-1),macd=fullMACD(close);
  const diff=macd.line.at(-1),signal=macd.signal.at(-1);
  const stats=[
    {name:"RSI (14)",value:rsi===null?"—":rsi.toFixed(2),description:rsi===null?"Not enough observations":rsi<30?"Below 30 / oversold momentum":rsi>70?"Above 70 / overbought momentum":"Between 30 and 70 / neutral band"},
    {name:"MACD (12,26,9)",value:diff===null?"—":diff.toFixed(3),description:diff===null||signal===null?"Requires more historical data":diff>signal?"MACD above signal / positive momentum":"MACD below signal / negative momentum"},
    {name:"SMA (20)",value:simpleMA(close,20)===null?"—":"HK$"+NUM.format(simpleMA(close,20)),description:n<20?"Requires at least 20 bars":last>simpleMA(close,20)?"Price above 20-day mean":"Price below 20-day mean"},
    {name:"SMA (50)",value:simpleMA(close,50)===null?"—":"HK$"+NUM.format(simpleMA(close,50)),description:n<50?"Requires at least 50 bars":last>simpleMA(close,50)?"Price above 50-day mean":"Price below 50-day mean"}
  ];
  const root=byId("native-technicals");if(!root)return;
  root.replaceChildren();
  if(data.archive){const d=document.createElement("div");d.className="feed-state archived";d.textContent="HISTORICAL SNAPSHOT — INSUFFICIENT DAILY BARS FOR LONG-RANGE SIGNALS";root.append(d);}
  const grid=document.createElement("div");grid.className="technical-stats";
  for(const item of stats){
    const card=document.createElement("div");card.className="technical-stat";
    const label=document.createElement("small");label.textContent=item.name;
    const value=document.createElement("strong");value.textContent=item.value;
    const comment=document.createElement("p");comment.textContent=item.description;
    card.append(label,value,comment);grid.append(card);
  }
  root.append(grid);
  const p=document.createElement("p");p.className="technical-timestamp";p.textContent="Calculated from "+n+" "+(data.archive?"archived":"provider-delayed")+" daily bars · "+describeBarTime(data);root.append(p);
}
function minMax(vals,extra=0.045){
  const a=Math.min(...vals),b=Math.max(...vals);let pad=(b-a)*extra;if(pad<.01)pad=Math.max(.5,b*.02);
  return [a-pad,b+pad];
}
function svgLine(data,x,y,color,stroke=2.4,fill="none"){
  const valid=data.map((v,i)=>({v,i})).filter(p=>Number.isFinite(p.v));
  if(valid.length<2)return "";
  let d="";let prior=-2;
  for(const p of valid){d+=(p.i-prior>1?"M":"L")+x(p.i).toFixed(2)+" "+y(p.v).toFixed(2)+" ";prior=p.i;}
  return '<path d="'+d+'" fill="'+fill+'" stroke="'+color+'" stroke-width="'+stroke+'" stroke-linejoin="round" stroke-linecap="round"/>';
}
function seriesForRange(bars,range){
  if(bars.length<2)return bars;
  const days=DAYS[range]||186,last=bars.at(-1).t;
  const filtered=bars.filter(b=>last-b.t<=days*86400);
  return filtered.length>=2?filtered:bars.slice(-2);
}
function renderMain(){
  const host=byId("market-chart");if(!host)return;
  // Never disguise a daily candle as a 15-minute candle while the intraday
  // provider request is still pending. On error the explicit daily fallback
  // path updates the interval controls before rendering.
  if(state.interval==="15m"&&!state.intraday){
    host.textContent="Loading source-delayed 15-minute bars. No live tick feed is connected.";
    return;
  }
  const data=state.interval==="15m"?state.intraday:state.stock;if(!data)return;
  const bars=seriesForRange(data.bars,state.range),n=bars.length;
  if(n<2){host.textContent="Insufficient verified bars";return}
  const prices=bars.map(b=>b.c),all=[...bars.map(b=>b.h),...bars.map(b=>b.l)], [min,max]=minMax(all);
  const w=1110,h=590,l=80,r=70,top=26,priceBottom=352,volTop=374,volBottom=424,rsiTop=454,rsiBottom=501,macdTop=525,macdBottom=564;
  const width=w-l-r, x=i=>l+(i+.5)*(width/n), priceY=v=>top+(max-v)*(priceBottom-top)/(max-min);
  const volMax=Math.max(1,...bars.map(b=>b.v||0));
  const fullPrices=data.bars.map(b=>b.c),offset=data.bars.length-bars.length;
  const rsi=fullRSI(fullPrices).slice(offset),macd=fullMACD(fullPrices);
  for(const key of Object.keys(macd))if(Array.isArray(macd[key]))macd[key]=macd[key].slice(offset);
  const colors=COLORS;
  let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+(data.archive?'Archived':'Provider-delayed')+' 2259.HK candlestick chart with volume, RSI and MACD"><defs><linearGradient id="native-goldshade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e4bd7a" stop-opacity=".21"/><stop offset="100%" stop-color="#e4bd7a" stop-opacity=".0"/></linearGradient></defs>';
  const gridTicks=5;
  for(let i=0;i<=gridTicks;i++){
    const value=min+(max-min)*i/gridTicks,py=priceY(value);
    svg+='<line x1="'+l+'" y1="'+py+'" x2="'+(w-r)+'" y2="'+py+'" stroke="'+colors.grid+'" stroke-dasharray="3 7" stroke-width="1"/>';
    svg+='<text x="'+(w-r+12)+'" y="'+(py+4)+'" font-size="13" fill="'+colors.muted+'" font-family="Arial">'+NUM.format(value)+'</text>';
  }
  const xStep=(width/n),cw=Math.max(1.7,Math.min(9,xStep*.55));
  if(state.style==="line"){
    svg+=svgLine(prices,x,priceY,colors.gold,3);
    const pointY=priceY(prices.at(-1));
    svg+='<circle cx="'+x(n-1)+'" cy="'+pointY+'" r="5" fill="'+colors.gold+'" stroke="'+colors.bg+'" stroke-width="2"/>';
  }else{
    for(let i=0;i<n;i++){
      const b=bars[i],cx=x(i),up=b.c>=b.o,color=up?colors.up:colors.down,pyh=priceY(b.h),pyl=priceY(b.l),pyo=priceY(b.o),pyc=priceY(b.c);
      svg+='<line x1="'+cx+'" y1="'+pyh+'" x2="'+cx+'" y2="'+pyl+'" stroke="'+color+'" stroke-width="'+Math.max(1.1,cw*.18)+'"/>';
      const ytop=Math.min(pyo,pyc),height=Math.max(1,Math.abs(pyo-pyc));
      svg+='<rect x="'+(cx-cw/2)+'" y="'+ytop+'" width="'+cw+'" height="'+height+'" fill="'+color+'" rx=".65"/>';
    }
  }
  if(min<87.48&&max>87.48){
    const yStrike=priceY(87.48);
    svg+='<line x1="'+l+'" y1="'+yStrike+'" x2="'+(w-r)+'" y2="'+yStrike+'" stroke="#e4bd7a" stroke-width="1.1" stroke-dasharray="5 7" opacity=".7"/>';
    svg+='<text x="'+(w-r-10)+'" y="'+(yStrike-6)+'" text-anchor="end" fill="#e4bd7a" font-size="11">Scheme base HK$87.48</text>';
  }
  svg+='<text x="'+l+'" y="16" fill="'+colors.muted+'" letter-spacing="1.5" font-weight="bold" font-size="12">PRICE · HKD</text>';
  for(let i=0;i<n;i++){
    const vol=bars[i].v||0,height=(vol/volMax)*(volBottom-volTop),cx=x(i),color=bars[i].c>=bars[i].o?colors.up:colors.down;
    svg+='<rect x="'+(cx-Math.max(1,cw*.48))+'" y="'+(volBottom-height)+'" width="'+Math.max(1.6,cw*.96)+'" height="'+height+'" fill="'+color+'" opacity=".55"/>';
  }
  svg+='<line x1="'+l+'" x2="'+(w-r)+'" y1="'+volBottom+'" y2="'+volBottom+'" stroke="'+colors.grid+'"/>';
  svg+='<text x="'+l+'" y="'+(volTop-6)+'" fill="'+colors.muted+'" font-size="11" font-weight="bold">VOLUME</text>';
  if(rsi.some(Number.isFinite)){
    const ry=v=>rsiBottom-v/100*(rsiBottom-rsiTop);
    for(const n of [30,70])svg+='<line x1="'+l+'" y1="'+ry(n)+'" x2="'+(w-r)+'" y2="'+ry(n)+'" stroke="'+colors.grid+'" stroke-dasharray="4 5"/>';
    svg+=svgLine(rsi,x,ry,"#bd9cfa",2);
  }
  svg+='<text x="'+l+'" y="'+(rsiTop-6)+'" fill="'+colors.muted+'" font-size="11" font-weight="bold">RSI (14) </text>';
  const nonzero=macd.hist.filter(Number.isFinite),mMax=Math.max(.005,...nonzero.map(v=>Math.abs(v)),...macd.line.filter(Number.isFinite).map(v=>Math.abs(v)),...macd.signal.filter(Number.isFinite).map(v=>Math.abs(v)));
  const my=v=>(macdTop+macdBottom)/2-(v/mMax)*((macdBottom-macdTop)*.43);
  const zero=my(0);
  svg+='<line x1="'+l+'" x2="'+(w-r)+'" y1="'+zero+'" y2="'+zero+'" stroke="'+colors.grid+'"/>';
  for(let i=0;i<n;i++){
    const v=macd.hist[i];if(!Number.isFinite(v))continue;
    const yy=my(v);svg+='<rect x="'+(x(i)-cw/2)+'" y="'+Math.min(yy,zero)+'" width="'+cw+'" height="'+Math.max(1,Math.abs(yy-zero))+'" fill="'+(v>=0?colors.up:colors.down)+'" opacity=".75"/>';
  }
  svg+=svgLine(macd.line,x,my,"#8cb7f2",1.8)+svgLine(macd.signal,x,my,"#e5b77b",1.5);
  svg+='<text x="'+l+'" y="'+(macdTop-5)+'" fill="'+colors.muted+'" font-size="11" font-weight="bold">MACD (12,26,9)</text>';
  for(let k=0;k<=5;k++){
    const i=Math.round(k*(n-1)/5),xx=x(i);
    svg+='<text x="'+xx+'" y="585" text-anchor="middle" font-size="12" fill="'+colors.muted+'" font-family="Arial">'+(state.interval==="15m"&&state.intraday?SHORT_TIME.format(new Date(bars[i].t*1000)):formatDate(bars[i].t))+'</text>';
  }
  // Crosshairs expose exact source OHLC, and keyboard access selects adjacent observations.
  svg+='<g data-chart-crosshair="1" visibility="hidden" pointer-events="none" aria-hidden="true"><line data-cross-x="1" x1="0" y1="'+top+'" x2="0" y2="'+macdBottom+'" stroke="#aebfce" stroke-dasharray="4 4" opacity=".8"/><line data-cross-y="1" x1="'+l+'" y1="0" x2="'+(w-r)+'" y2="0" stroke="#aebfce" stroke-dasharray="4 4" opacity=".8"/></g>';
  // Mouse / tap interaction with exact source OHLC data, never another security.
  svg+='<rect x="'+l+'" y="'+top+'" width="'+width+'" height="'+(priceBottom-top)+'" fill="transparent" pointer-events="all" data-interactive-chart="1"/>';
  svg+='<g data-chart-motion="1" aria-hidden="true" pointer-events="none"><rect data-motion-trail="1" x="'+l+'" y="'+top+'" width="0" height="'+(macdBottom-top)+'"/><line data-motion-line="1" x1="'+l+'" y1="'+top+'" x2="'+l+'" y2="'+macdBottom+'"/><circle data-motion-dot="1" cx="'+l+'" cy="'+priceY(bars[0].c)+'" r="6"/></g></svg>';
  host.innerHTML=svg;
  const info=document.createElement("div");info.className="chart-hover-card";info.textContent="HOVER A SESSION FOR OHLC · STOCK CODE 2259.HK";
  host.appendChild(info);
  const graph=host.querySelector("svg"),hit=graph.querySelector('[data-interactive-chart]');
  const cross=graph.querySelector("[data-chart-crosshair]");let selected=n-1;
  const selectIndex=idx=>{
    selected=Math.min(n-1,Math.max(0,idx));const b=bars[selected];if(!b)return;
    if(cross){const cx=x(selected),cy=priceY(b.c),vx=cross.querySelector("[data-cross-x]"),hy=cross.querySelector("[data-cross-y]");cross.setAttribute("visibility","visible");vx.setAttribute("x1",cx);vx.setAttribute("x2",cx);hy.setAttribute("y1",cy);hy.setAttribute("y2",cy);}
    info.textContent=(state.interval==="15m"&&state.intraday?SHORT_TIME.format(new Date(b.t*1000))+" HKT":formatDate(b.t))+"  O "+NUM.format(b.o)+" · H "+NUM.format(b.h)+" · L "+NUM.format(b.l)+" · C "+NUM.format(b.c)+" · VOL "+(b.v===null?"not reported":INTEGER.format(b.v));
  };
  const pick=event=>{const rect=graph.getBoundingClientRect(),scaled=(event.clientX-rect.left)/rect.width*w;selectIndex(Math.floor((scaled-l)/width*n));};
  if(hit)hit.addEventListener("pointermove",pick);
  if(hit)hit.addEventListener("pointerdown",pick);
  if(hit)hit.addEventListener("pointerleave",()=>{if(cross)cross.setAttribute("visibility","hidden");info.textContent="HOVER A SESSION FOR OHLC · STOCK CODE 2259.HK";});
  info.tabIndex=0;info.setAttribute("aria-label","Historical chart observations. Use left and right arrow keys to inspect exact values.");
  info.addEventListener("focus",()=>selectIndex(selected));
  info.addEventListener("keydown",event=>{if(event.key==="ArrowLeft"||event.key==="ArrowRight"){event.preventDefault();selectIndex(selected+(event.key==="ArrowLeft"?-1:1));}});
  info.addEventListener("blur",()=>{if(cross)cross.setAttribute("visibility","hidden");});
  noteRefreshStatus();
  if(state.interval==="15m"&&state.intraday){
    setText("market-chart-status","2259.HK · PROVIDER-DELAYED 15-MINUTE OHLC BARS");
    setText("market-chart-timestamp","15-minute source observation: "+describeBarTime(data));
  }
  document.dispatchEvent(new CustomEvent("zgi:chart",{detail:{bars,interval:state.interval==="15m"&&state.intraday?"15m":"1d",sourceTime:data.providerQuoteTime,archive:!!data.archive,refreshFailed:state.interval==="15m"?state.intradayRefreshFailed:state.stockRefreshFailed}}));
}
function miniChart(hostId,data,label,currency){
  const host=byId(hostId);if(!host||!data)return;
  const bars=data.bars.slice(-100),close=bars.map(b=>b.c),[min,max]=minMax(close,.1);
  const w=500,h=212,l=12,r=12,t=20,b=30;
  const x=i=>l+i*(w-l-r)/(bars.length-1),y=v=>t+(max-v)*(h-t-b)/(max-min);
  const color=close.at(-1)>=close[0]?COLORS.up:COLORS.down;
  let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+label+' historical trend">';
  for(let v=0;v<=3;v++){const yy=t+v*(h-t-b)/3;svg+='<line x1="'+l+'" x2="'+(w-r)+'" y1="'+yy+'" y2="'+yy+'" stroke="#283947" stroke-dasharray="3 5"/>';}
  svg+=svgLine(close,x,y,color,3);
  svg+='<circle cx="'+x(bars.length-1)+'" cy="'+y(close.at(-1))+'" r="5" fill="'+color+'"/>';
  svg+='<text x="'+l+'" y="'+(h-7)+'" fill="#8fa2b3" font-size="13">'+formatDate(bars[0].t)+'</text>';
  svg+='<text x="'+(w-r)+'" y="'+(h-7)+'" text-anchor="end" fill="#8fa2b3" font-size="13">'+formatDate(bars.at(-1).t)+'</text>';
  svg+='<rect data-peer-hitbox="1" x="'+l+'" y="'+t+'" width="'+(w-l-r)+'" height="'+(h-t-b)+'" fill="transparent" pointer-events="all"/></svg>';
  host.innerHTML=svg;
  const readout=document.createElement("div");
  readout.className="mini-hover";
  readout.textContent="HOVER OR TAP FOR SOURCE DAILY PRICES";
  host.append(readout);
  const graph=host.querySelector("svg"),hit=host.querySelector("[data-peer-hitbox]");
  const pick=(event)=>{
    const rect=graph.getBoundingClientRect();
    const local=(event.clientX-rect.left)/rect.width*w;
    const idx=Math.min(bars.length-1,Math.max(0,Math.round((local-l)/(w-l-r)*(bars.length-1))));
    const bar=bars[idx];
    if(bar)readout.textContent=formatDate(bar.t)+" · "+label+" · "+(currency==="USD"?"US$":"HK$")+NUM.format(bar.c)+" · Vol "+INTEGER.format(bar.v||0);
  };
  hit?.addEventListener("pointermove",pick);
  hit?.addEventListener("pointerdown",pick);
  hit?.addEventListener("pointerleave",()=>{readout.textContent="HOVER OR TAP FOR SOURCE DAILY PRICES"});
}
function renderPeer(prefix,data){
  if(!data)return;
  const currency=data.currency;
  setText(prefix+"-last-price",formatPrice(data.regularMarketPrice,currency));
  const ch=data.change;
  setText(prefix+"-change",(Number.isFinite(ch)?(ch>0?"+":"")+NUM.format(ch)+" ":"")+formatPercent(data.changePercent));
  const c=byId(prefix+"-change");if(c)c.className=ch<0?"negative":ch>0?"positive":"";
  setText(prefix+"-status",(prefix==="gold"?"COMEX GOLD FUTURES (GC=F), NOT SPOT XAU/USD":"ZIJIN MINING (2899.HK), NOT ZIJIN GOLD (2259.HK)")+". "+(data.archive?"ARCHIVED":"Provider-delayed")+" source observation: "+describeBarTime(data));
  miniChart(prefix+"-chart",data,data.displayName,currency);
}
function errorPeer(prefix,symbol){
  setText(prefix+"-last-price","UNAVAILABLE");
  setText(prefix+"-change","No verified new quote");
  setText(prefix+"-status","Provider unavailable for "+symbol+". No other security is substituted. Open the source link below.");
  const el=byId(prefix+"-chart");if(el)el.textContent="No verified data from "+symbol+". Use the linked source for current market information.";
}
function syncChartControls(){
  document.querySelectorAll("[data-price-range]").forEach(button=>{
    const r=button.dataset.priceRange;
    button.hidden=state.interval==="15m"?!(r==="5d"||r==="1mo"):r==="5d";
    button.classList.toggle("active",r===state.range);
  });
  document.querySelectorAll("[data-chart-interval]").forEach(button=>{
    const active=button.dataset.chartInterval===state.interval;
    button.classList.toggle("active",active);
    button.setAttribute("aria-pressed",String(active));
  });
}
let intradayBusy=false;
async function refreshIntraday(){
  if(intradayBusy||state.interval!=="15m")return;
  intradayBusy=true;
  try{
    const data=await load("2259.HK","1mo","15m");
    if(state.interval!=="15m")return;
    state.intraday=data;state.intradayRefreshFailed=false;
    renderMain();
  }catch{
    state.intradayRefreshFailed=true;
    if(state.interval==="15m"&&!state.intraday){
      state.interval="1d";
      state.range=state.dailyRange;
      syncChartControls();
      renderMain();
      setText("motion-market-status","15-MINUTE SOURCE UNAVAILABLE · DAILY DELAYED BARS RESTORED");
    }else if(state.interval==="15m"){
      setText("motion-market-status","15-MINUTE REFRESH FAILED · PREVIOUS VERIFIED BARS RETAINED");
    }
  }finally{intradayBusy=false}
}
function activateControls(){
  document.querySelectorAll("[data-price-range]").forEach(button=>button.addEventListener("click",()=>{
    if(button.hidden)return;
    state.range=button.dataset.priceRange;
    if(state.interval==="1d")state.dailyRange=state.range;
    syncChartControls();renderMain();
  }));
  document.querySelectorAll("[data-chart-style]").forEach(button=>button.addEventListener("click",()=>{
    state.style=button.dataset.chartStyle;
    document.querySelectorAll("[data-chart-style]").forEach(b=>b.classList.toggle("active",b===button));
    renderMain();
  }));
  document.querySelectorAll("[data-chart-interval]").forEach(button=>button.addEventListener("click",()=>{
    const selected=button.dataset.chartInterval;
    if(selected===state.interval)return;
    state.interval=selected;
    state.range=selected==="15m"?"5d":state.dailyRange;
    syncChartControls();
    if(selected==="15m"){
      setText("motion-market-status","REQUESTING PROVIDER-DELAYED 15-MINUTE HISTORY");
      if(state.intraday)renderMain();
      refreshIntraday();
    }else renderMain();
  }));
  syncChartControls();
}
let loading=false;
async function refresh(){
  if(loading)return;loading=true;
  try {
    const [stock,gold,parent]=await Promise.allSettled([load("2259.HK","1y"),load("GC=F","1y"),load("2899.HK","1y")]);
    state.stockRefreshFailed=stock.status!=="fulfilled";
    if(stock.status==="fulfilled"){state.stock=stock.value;state.liveQuote=true}
    else if(!state.stock){state.stock=archiveStock();state.liveQuote=false}
    else if(state.liveQuote){const s=byId("stock-feed-state");if(s){s.className="feed-state archived";s.textContent="PREVIOUS PROVIDER RESPONSE • LATEST REFRESH FAILED";}}
    if(gold.status==="fulfilled")state.gold=gold.value;
    if(parent.status==="fulfilled")state.parent=parent.value;
    renderQuote();renderMain();technicals(state.stock);
    if(state.gold)renderPeer("gold",state.gold);else errorPeer("gold","GC=F");
    if(state.parent)renderPeer("parent",state.parent);else errorPeer("parent","2899.HK");
    document.dispatchEvent(new CustomEvent("zgi:market",{detail:{
      stock:state.stock,gold:state.gold,parent:state.parent,
      fresh:{stock:stock.status==="fulfilled",gold:gold.status==="fulfilled",parent:parent.status==="fulfilled"},
      refreshedAt:new Date().toISOString()
    }}));
  }finally{loading=false}
}
activateControls();
refreshIntraday();
refresh();
// Only re-check at a measured interval; publisher timestamps determine quote freshness.
setInterval(()=>{if(document.visibilityState==="visible")refresh();},180000);
setInterval(()=>{if(document.visibilityState==="visible"&&state.interval==="15m")refreshIntraday();},60000);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){refresh();if(state.interval==="15m")refreshIntraday();}});
document.getElementById("refresh-market-now")?.addEventListener("click",()=>{refresh();if(state.interval==="15m")refreshIntraday();});
})();