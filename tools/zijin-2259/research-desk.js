/* Evidence-first dashboard command deck. No external requests or private inputs. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const Gate=window.ZGIResearchGate;
  const CONFIG=[
    {key:"stock",symbol:"2259.HK",currency:"HKD",prefix:"HK$"},
    {key:"parent",symbol:"2899.HK",currency:"HKD",prefix:"HK$"},
    {key:"gold",symbol:"GC=F",currency:"USD",prefix:"US$"}
  ];
  const fmt=new Intl.NumberFormat("en-HK",{minimumFractionDigits:2,maximumFractionDigits:2});
  const dayHK=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Hong_Kong",day:"2-digit",month:"short",year:"numeric"});
  const dayUTC=new Intl.DateTimeFormat("en-GB",{timeZone:"UTC",day:"2-digit",month:"short",year:"numeric"});
  let last=null;
  function stamp(data,symbol){
    const iso=data?.providerQuoteTime;
    if(!iso||Number.isNaN(Date.parse(iso)))return "Source date unavailable";
    const date=(symbol==="GC=F"?dayUTC:dayHK).format(new Date(iso));
    return date+(symbol==="GC=F"?" UTC":" HKT")+" daily source bar, not last-trade time";
  }
  function render(detail){
    last=detail;
    let available=0;
    for(const cfg of CONFIG){
      const source=detail?.[cfg.key],proof=Gate.assessFeed(source,cfg.symbol);
      const card=$("desk-"+cfg.key),price=$("desk-"+cfg.key+"-price"),
            state=$("desk-"+cfg.key+"-state"),asof=$("desk-"+cfg.key+"-asof");
      if(!card||!price||!state||!asof)continue;
      card.dataset.state=proof.usable?proof.state:"held";
      price.textContent=proof.usable?cfg.prefix+fmt.format(source.regularMarketPrice):"WITHHELD";
      state.textContent=proof.usable?(proof.state==="older"?"OLDER SOURCE BAR":"VALID DELAYED BAR"):"SOURCE HOLD";
      asof.textContent=proof.usable?stamp(source,cfg.symbol):proof.reason;
      if(proof.usable)available++;
    }
    const pair=Gate.assessPair(detail);
    const model=$("desk-model"),overall=$("desk-overall");
    if(model)model.dataset.state=pair.usable?"delayed":"held";
    $("desk-model-price").textContent=pair.usable?"READY":"SUSPENDED";
    $("desk-model-state").textContent=pair.usable?"TWO SOURCE ANCHORS VALID":"SOURCE GATE ACTIVE";
    $("desk-model-asof").textContent=pair.usable?
      "Conditional sensitivity only. Not an analyst forecast.":pair.reason;
    if(overall)overall.textContent=pair.usable?
      "Price-bar identity, currency, source date and close validated. Observations remain provider-delayed.":
      "One or more model anchors did not pass source checks. Linked projections must remain unavailable.";
    const exportButton=$("desk-export");
    if(exportButton)exportButton.disabled=available===0;
  }
  function exportBrief(){
    if(!last)return;
    const lines=[
      "ZIJIN GOLD INTERNATIONAL | INDEPENDENT SOURCE BRIEF",
      "Generated (UTC): "+new Date().toISOString(),
      "Research only. Yahoo Finance historical chart data are unofficial and delayed.",
      "Daily timestamps identify historical price bars, NOT last-trade times.",
      "No HKEX licensed real-time quote, brokerage order book or analyst consensus.",
      ""
    ];
    let passed=0;
    for(const cfg of CONFIG){
      const d=last[cfg.key],proof=Gate.assessFeed(d,cfg.symbol);
      lines.push(cfg.symbol+" | "+Gate.INSTRUMENTS[cfg.symbol].label);
      if(proof.usable){
        passed++;
        lines.push("Validated historical close: "+cfg.prefix+fmt.format(d.regularMarketPrice));
        lines.push("Provider source-bar time (UTC): "+d.providerQuoteTime);
        lines.push("Observation: "+proof.reason);
        lines.push("Upstream: "+d.provider+"; "+d.dataDelay);
        lines.push("Validated historical bars: "+d.bars.length);
      }else lines.push("PRICE WITHHELD: "+proof.reason);
      lines.push("");
    }
    const pair=Gate.assessPair(last);
    lines.push("MODEL ANCHOR GATE: "+(pair.usable?"PASSED":"HELD"));
    lines.push(pair.reason);
    lines.push("Conservative seven-calendar-day maximum observation age. Exchange holidays are not automatically recognized.");
    lines.push("No personal award quantity, user-entered price, employment details, or model controls included.");
    if(!passed)return;
    const blob=new Blob([lines.join("\r\n")+"\r\n"],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="zijin-2259-source-brief.txt";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    $("desk-export-note").textContent="Source-only briefing prepared locally. No personal input included.";
  }
  document.addEventListener("zgi:market",event=>render(event.detail));
  $("desk-export")?.addEventListener("click",exportBrief);
})();
