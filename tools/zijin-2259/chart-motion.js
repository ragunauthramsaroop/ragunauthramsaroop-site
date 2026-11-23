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
  function frame(t){
    if(state.previousFrame!==null&&state.playing&&!document.hidden&&state.bars.length>1){
      const delta=Math.max(0,Math.min(100,t-state.previousFrame));
      state.progress += delta * state.speed/REPLAY_MS;
      if(state.progress>=1){state.progress=state.progress%1;state.visibleIndex=-1;}
      if(t-state.lastDraw>=30){draw();state.lastDraw=t;}
    }
    state.previousFrame=t;
    requestAnimationFrame(frame);
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
    state.sourceAvailable=!detail.archive;
    state.visibleIndex=-1;
    if(changed&&previousInterval===detail.interval&&old!==null&&detail.bars.at(-1).t>old&&state.following){
      text("motion-market-status","NEW VERIFIED "+(state.interval==="15m"?"15-MIN":"DAILY")+" BAR RECEIVED · DELAYED SOURCE");
    }else if(state.archive){
      text("motion-market-status","ARCHIVED DATA · PROVIDER NOT AVAILABLE");
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
    updateMode();draw();
  });
  byId("motion-follow")?.addEventListener("click",()=>{
    state.playing=false;state.following=true;state.progress=1;state.visibleIndex=-1;
    updateMode();draw();
  });
  byId("motion-speed")?.addEventListener("click",event=>{
    state.speed=state.speed===1?2:state.speed===2?4:1;
    event.currentTarget.textContent=state.speed+"× SPEED";
    event.currentTarget.setAttribute("aria-label","Historical replay speed "+state.speed+" times");
  });
  updateMode();
  requestAnimationFrame(frame);
  updateCountdown();
  setInterval(updateCountdown,1000);
})();
