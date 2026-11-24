/* Visible motion for real source history, never simulated live exchange trades.
 * A playhead replays verified OHLC bars with their original source timestamps.
 * FOLLOW mode moves only when a newly fetched provider bar is observed.
 */
(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const REPLAY_MS = 30000;
  const fmtPrice = new Intl.NumberFormat("en-HK",{style:"currency",currency:"HKD",maximumFractionDigits:2});
  const fmtDate = new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Hong_Kong",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  // Begin at the newest provider-delayed bar, never in a fabricated live replay.
  // Historical replay remains an explicit user-initiated option.
  const state = {bars:[],sourceTime:null,interval:"15m",archive:false,playing:false,following:true,
    speed:1,progress:1,previousFrame:null,visibleIndex:-1,nextCheck:Date.now()+180000,
    sourceAvailable:false,latestSourceTime:null,lastDraw:0};
  function text(id,value){const el=byId(id);if(el)el.textContent=value;}
  function updateMode(){
    const replay=byId("motion-replay-toggle"),follow=byId("motion-follow");
    if(replay){replay.textContent=state.playing?"PAUSE REPLAY":"PLAY HISTORICAL REPLAY";replay.setAttribute("aria-pressed",String(state.playing));}
    if(follow){follow.setAttribute("aria-pressed",String(state.following));follow.textContent=state.following?"FOLLOW DELAYED SOURCE ✓":"FOLLOW DELAYED SOURCE";}
    const badge=byId("motion-mode-label");
    if(badge)badge.textContent=state.playing?"HISTORICAL REPLAY · NOT LIVE TRADES":state.following?"FOLLOWING DELAYED BAR · NOT LIVE TRADES":"REPLAY PAUSED · HISTORICAL DATA";
  }
  function draw(){
    const bars=state.bars,host=byId("market-chart"),svg=host?.querySelector("svg");
    if(!svg||bars.length<2)return;
    const line=svg.querySelector("[data-motion-line]"),dot=svg.querySelector("[data-motion-dot]"),
      sweep=svg.querySelector("[data-motion-trail]");
    if(!line||!dot||!sweep)return;
    const n=bars.length,l=80,width=1110-80-70,top=26,bottom=352;
    const highs=bars.map(b=>b.h),lows=bars.map(b=>b.l);
    const a=Math.min(...lows),b=Math.max(...highs);
    let padding=(b-a)*.045;
    if(padding<.01)padding=Math.max(.5,b*.02);
    const min=a-padding,max=b+padding;
    const p=state.following?1:Math.max(0,Math.min(1,state.progress));
    const floatIndex=p*(n-1),index=Math.min(n-1,Math.floor(floatIndex));
    const x=l+(floatIndex+.5)*(width/n),y=top+(max-bars[index].c)*(bottom-top)/(max-min);
    line.setAttribute("x1",x.toFixed(2));line.setAttribute("x2",x.toFixed(2));
    dot.setAttribute("cx",x.toFixed(2));dot.setAttribute("cy",y.toFixed(2));
    sweep.setAttribute("width",String(Math.max(0,x-l)));
    if(index!==state.visibleIndex){
      const bar=bars[index];
      const date=fmtDate.format(new Date(bar.t*1000))+" HKT";
      text("motion-observation",(state.following?"LATEST VERIFIED BAR · ":"REPLAY · ")+date+" · "+fmtPrice.format(bar.c));
      state.visibleIndex=index;
    }
  }
  let frameId=null;
  function stopFrame(){if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;state.previousFrame=null;}
  function startFrame(){if(frameId===null&&state.playing&&!document.hidden){state.previousFrame=null;frameId=requestAnimationFrame(frame);}}
  function frame(t){
    frameId=null;
    if(!state.playing||document.hidden){state.previousFrame=null;return;}
    if(state.previousFrame!==null&&state.playing&&!document.hidden&&state.bars.length>1){
      const delta=Math.max(0,Math.min(100,t-state.previousFrame));
      state.progress += delta * state.speed/REPLAY_MS;
      if(state.progress>=1){state.progress=state.progress%1;state.visibleIndex=-1;}
      if(t-state.lastDraw>=30){draw();state.lastDraw=t;}
    }
    state.previousFrame=t;
    frameId=requestAnimationFrame(frame);
  }
  function receiveChart(event){
    const detail=event?.detail||{};
    if(!Array.isArray(detail.bars)||detail.bars.length<2)return;
    const identifier=detail.interval+"|"+detail.sourceTime+"|"+detail.bars.length+"|"+detail.bars.at(-1).t;
    const old=state.latestSourceTime,previousInterval=state.interval;
    const changed=state.identifier!==identifier;
    state.identifier=identifier;
    state.bars=detail.bars.filter(bar=>bar&&Number.isFinite(bar.t)&&Number.isFinite(bar.c));
    state.interval=detail.interval||"1d";
    state.archive=!!detail.archive;
    state.sourceTime=detail.sourceTime||null;
    state.latestSourceTime=detail.bars.at(-1).t;
    state.sourceAvailable=!detail.archive&&!detail.refreshFailed;
    state.visibleIndex=-1;
    if(changed&&previousInterval===detail.interval&&old!==null&&detail.bars.at(-1).t>old&&state.following){
      text("motion-market-status","NEW VERIFIED "+(state.interval==="15m"?"15-MIN":"DAILY")+" BAR RECEIVED · DELAYED SOURCE");
    }else if(state.archive){
      text("motion-market-status","ARCHIVED DATA · PROVIDER NOT AVAILABLE");
    }else if(detail.refreshFailed){
      text("motion-market-status","REFRESH FAILED · PREVIOUS VERIFIED BARS RETAINED");
    }else{
      text("motion-market-status","CONNECTED TO DELAYED HISTORICAL DATA · NOT A LIVE TICK FEED");
    }
    if(!state.playing)state.progress=1;
    state.nextCheck=Date.now()+(state.interval==="15m"?60000:180000);
    updateCountdown();
    draw();
    updateMode();
  }
  function updateCountdown(){
    const remaining=Math.max(0,Math.ceil((state.nextCheck-Date.now())/1000));
    const minutes=Math.floor(remaining/60),seconds=String(remaining%60).padStart(2,"0");
    text("motion-next-check","NEXT AUTOMATIC DATA CHECK "+minutes+":"+seconds);
    const fill=byId("motion-refresh-progress");
    if(fill){
      const period=state.interval==="15m"?60000:180000;
      fill.style.width=(Math.max(0,Math.min(1,1-remaining*1000/period))*100).toFixed(1)+"%";
    }
  }
  document.addEventListener("zgi:chart",receiveChart);
  document.addEventListener("zgi:market",event=>{
    const fresh=event.detail?.fresh?.stock;
    state.nextCheck=Date.now()+(state.interval==="15m"?60000:180000);
    if(!fresh&&state.archive)text("motion-market-status","ARCHIVED DATA · NOT CURRENT");
    else if(!fresh)text("motion-market-status","REFRESH FAILED · SHOWING PREVIOUSLY VERIFIED SOURCE BARS");
    updateCountdown();
  });
  byId("motion-replay-toggle")?.addEventListener("click",()=>{
    state.playing=!state.playing;
    if(state.playing){state.following=false;if(state.progress>=1)state.progress=0;}
    if(state.playing)startFrame();else stopFrame();
    updateMode();draw();
  });
  byId("motion-follow")?.addEventListener("click",()=>{
    state.playing=false;stopFrame();state.following=true;state.progress=1;state.visibleIndex=-1;
    updateMode();draw();
  });
  byId("motion-speed")?.addEventListener("click",event=>{
    state.speed=state.speed===1?2:state.speed===2?4:1;
    event.currentTarget.textContent=state.speed+"× SPEED";
    event.currentTarget.setAttribute("aria-label","Historical replay speed "+state.speed+" times");
  });
  updateMode();
  document.addEventListener("visibilitychange",()=>{if(document.hidden)stopFrame();else startFrame();});
  updateCountdown();
  setInterval(updateCountdown,1000);
})();


/* Adjacent award monitor: private market and manual scenario modes, never uses historical replay. */
(()=>{
"use strict";
const $=id=>document.getElementById(id), panel=$("chart-award-monitor");
if(!panel)return;
const qty=$("chart-award-shares"),shared=$("shares"),strike=$("strike"),charge=$("charge"),manual=$("chart-award-manual-price"),manualQty=$("chart-award-manual-shares");
const manualMode=$("chart-award-mode-manual"),marketMode=$("chart-award-mode-market");
let mode="market";
const fxInput=$("chart-award-fx");
const usdFormatter=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",currencyDisplay:"code",minimumFractionDigits:2,maximumFractionDigits:2});
const hkd=new Intl.NumberFormat("en-HK",{style:"currency",currency:"HKD",currencyDisplay:"narrowSymbol",minimumFractionDigits:2,maximumFractionDigits:2});
const timeFmt=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Hong_Kong",year:"numeric",month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
const money=n=>Number.isFinite(n)?(n<0?"−":"")+"HK$"+hkd.format(Math.abs(n)).replace(/[^0-9.,]/g,""):"—";
const put=(id,v)=>{const el=$(id);if(el)el.textContent=v};
const num=e=>e&&e.value.trim()!==""?Number(e.value):NaN;
let observation=null,dailyFailed=false,intradayFailed=false;
const maxAge=()=>((window.ZGIResearchGate?.MAX_AGE_DAYS||7)*86400000);
function render(){
 const isManual=mode==="manual";
 const fx=fxInput?num(fxInput):7.8;
 const fxValid=Number.isFinite(fx)&&fx>0&&fx<=100;
 const usd=h=>fxValid&&Number.isFinite(h)?usdFormatter.format(h/fx):"—";
 const usable=observation&&!observation.archive&&Date.now()-observation.ts<=maxAge();
 const p=isManual?num(manual):usable?observation.price:NaN,n=num(isManual?manualQty:shared),b=num(strike),fee=num(charge);
 put("chart-award-price-label",isManual?"ASSUMED STOCK PRICE · HKD":"LATEST VERIFIED PRICE · HKD");
 put("chart-award-payout-label",isManual?"HYPOTHETICAL GROSS PAYOUT · USD":"ESTIMATED GROSS PAYOUT · USD");
 const valid=Number.isInteger(n)&&n>0&&n<=1e8&&Number.isFinite(b)&&b>=0&&b<=1e6;
 const has=Number.isFinite(p)&&p>0&&p<=1e6;
 const v=valid&&has?n*(p-b):NaN;
 put("chart-award-price",has?money(p):"—");put("chart-award-basis",money(b));
 put("chart-award-payout",valid?(has?(fxValid?usd(v):"Enter FX rate"):(isManual?"Enter stock price":"Awaiting price")):"Enter shares");
 put("chart-award-payout-hkd",valid&&has?money(v)+" equivalent":"—");
 put("chart-award-value",valid&&has?usd(n*p):"—");
 put("chart-award-cost",valid?usd(n*b):"—");
 put("chart-award-net",valid&&has&&Number.isFinite(fee)&&fee>=0&&fee<=1e9?usd(v-fee):"—");
 put("chart-award-return",valid&&has&&b>0?((p-b)/b*100).toFixed(2)+"%":"—");
 put("chart-award-sensitivity",valid&&fxValid?usd(n)+" per HK$1":"—");
 $("chart-award-payout").dataset.sign=Number.isFinite(v)?(v<0?"loss":"gain"):"neutral";
 put("chart-award-source",isManual?"MANUAL SCENARIO · NOT A MARKET QUOTE":observation?(observation.archive?"ARCHIVED · NOT CURRENT":!usable?"STALE · PAYOUT WITHHELD":observation.kind==="15m"?"DELAYED 15-MIN BAR":"DELAYED DAILY OBSERVATION")+" · "+timeFmt.format(new Date(observation.ts))+" HKT"+(dailyFailed||intradayFailed?" · latest refresh issue":""):"AWAITING VERIFIED 2259.HK DATA");
}
function accept(price,ts,kind,archive){
 if(!Number.isFinite(price)||price<=0||!Number.isFinite(ts)||ts<=0||ts>Date.now()+300000)return;
 if(observation&&!observation.archive&&archive)return;
 if(observation&&!observation.archive&&!archive&&(ts<observation.ts||(ts===observation.ts&&observation.kind==="15m"&&kind!=="15m")))return;
 observation={price,ts,kind,archive};render();
}
function setMode(next){
 mode=next;
 const isManual=mode==="manual";
 marketMode.setAttribute("aria-pressed",String(!isManual));
 manualMode.setAttribute("aria-pressed",String(isManual));
 $("chart-award-market-inputs").hidden=isManual;
 $("chart-award-manual-inputs").hidden=!isManual;
 if(isManual&&!manualQty.value&&shared.value)manualQty.value=shared.value;
 render();
}
marketMode?.addEventListener("click",()=>setMode("market"));
manualMode?.addEventListener("click",()=>setMode("manual"));
manual?.addEventListener("input",render);
fxInput?.addEventListener("input",render);
manualQty?.addEventListener("input",render);
$("chart-award-manual-clear")?.addEventListener("click",()=>{manual.value="";manualQty.value="";render()});
qty.value=shared.value;
qty.addEventListener("input",()=>{shared.value=qty.value;shared.dispatchEvent(new Event("input",{bubbles:true}));render()});
shared.addEventListener("input",()=>{if(qty.value!==shared.value)qty.value=shared.value;render()});
for(const e of [strike,charge])e.addEventListener("input",render);
$("reset-model")?.addEventListener("click",()=>{qty.value=shared.value;if(manual)manual.value="";if(manualQty)manualQty.value="";render()});
$("chart-award-clear")?.addEventListener("click",()=>{qty.value="";shared.value="";shared.dispatchEvent(new Event("input",{bubbles:true}));render()});
document.addEventListener("zgi:chart",e=>{
 const d=e.detail;if(!d||d.interval!=="15m"||d.archive)return;
 const last=d.bars?.[d.bars.length-1];if(!last)return;
 intradayFailed=!!d.refreshFailed;accept(last.c,last.t*1000,"15m",false);render();
});
document.addEventListener("zgi:market",e=>{
 const d=e.detail?.stock;if(!d||d.symbol!=="2259.HK"||d.currency!=="HKD")return;
 dailyFailed=e.detail?.fresh?.stock===false;
 accept(d.regularMarketPrice,Date.parse(d.providerQuoteTime),"daily",!!d.archive);render();
});
const marketStatus=$("motion-market-status");
if(marketStatus&&typeof MutationObserver!=="undefined")new MutationObserver(()=>{intradayFailed=/FAILED|UNAVAILABLE/i.test(marketStatus.textContent);render()}).observe(marketStatus,{childList:true,characterData:true,subtree:true});
render();
})();
