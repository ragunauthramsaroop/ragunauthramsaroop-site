/* ZGI intelligence: provider-hosted live widgets + local-only, explicitly hypothetical modelling.
   No tracking, storage, quote fabrication, API key or personally identifying request. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const money = (value) => Number.isFinite(value) ? 'HK$' + Math.abs(value).toLocaleString('en-HK', {maximumFractionDigits:2,minimumFractionDigits:2}) : '—';
  const whole = (value) => Number.isFinite(value) ? Math.round(value).toLocaleString('en-HK') : '—';
  const scenarios = [
    {key:'bear',label:'DOWNSIDE',color:'#d88a86',values:[95,88,80]},
    {key:'base',label:'CENTRAL',color:'#e7bd7b',values:[140,155,175]},
    {key:'bull',label:'UPSIDE',color:'#79bba8',values:[185,230,275]}
  ];
  function marketTime(){
    try{
      const fmt = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Hong_Kong',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
      const parts = Object.fromEntries(fmt.formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
      const weekday=parts.weekday, hour=Number(parts.hour), minute=Number(parts.minute), m=hour*60+minute;
      const weekdayTrade=!['Sat','Sun'].includes(weekday);
      const morning=m>=570&&m<720, afternoon=m>=780&&m<960;
      const status=$('market-status');
      const time=$('hk-clock');
      if(time)time.textContent='HKT ' + weekday.toUpperCase() + ' ' + parts.hour + ':' + parts.minute;
      if(status){
        status.textContent=weekdayTrade&&(morning||afternoon)?'SESSION HOURS':'OUTSIDE SESSION';
        status.title='Indicative regular session hours only. Exchange holidays, half-days, halts and provider delays are not covered.';
      }
    }catch(e){const time=$('hk-clock');if(time)time.textContent='HKT / CLOCK UNAVAILABLE';}
  }
  marketTime();
  setInterval(marketTime,15000);
  const menu=$('menu-toggle'), sidebar=$('sidebar');
  if(menu&&sidebar){
    menu.addEventListener('click',()=>{const active=sidebar.classList.toggle('is-open');menu.setAttribute('aria-expanded',String(active));menu.setAttribute('aria-label',active?'Close navigation':'Open navigation');});
    sidebar.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',()=>{sidebar.classList.remove('is-open');menu.setAttribute('aria-expanded','false');}));
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){sidebar.classList.remove('is-open');menu.setAttribute('aria-expanded','false');}});
  }
  const navs=document.querySelectorAll('[data-nav]');
  if('IntersectionObserver' in window){
    const sectionObserver=new IntersectionObserver(entries=>{
      const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if(!visible)return;
      navs.forEach(link=>link.classList.toggle('is-active',link.dataset.nav===visible.target.id));
    },{rootMargin:'-20% 0px -55% 0px',threshold:[0,.1,.25,.5]});
    document.querySelectorAll('main > section[id]').forEach(s=>sectionObserver.observe(s));
  }
  const chart=$('scenario-chart');
  function plot(){
    if(!chart)return;
    const w=960,h=390,l=84,r=45,t=30,b=54,innerW=w-l-r,innerH=h-t-b;
    const min=50,max=300;
    const x=i=>l+(i/2)*innerW, y=v=>t+((max-v)/(max-min))*innerH;
    let out='<svg viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="scenario-graph-title scenario-graph-desc"><title id="scenario-graph-title">Illustrative downside, central, and upside HKEX 2259 share prices</title><desc id="scenario-graph-desc">Hypothetical paths for 2027, 2028 and 2029. Downside 95, 88, 80. Central 140, 155, 175. Upside 185, 230, 275 HK dollars per share.</desc>';
    for(let v=50;v<=300;v+=50){out+='<line x1="'+l+'" x2="'+(w-r)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#30404d" stroke-width="1" stroke-dasharray="5 8"/><text x="'+(l-17)+'" y="'+(y(v)+4)+'" fill="#8998a8" font-size="15" text-anchor="end" font-family="sans-serif">'+v+'</text>';}
    [2027,2028,2029].forEach((year,i)=>{out+='<text x="'+x(i)+'" y="'+(h-17)+'" fill="#a7b4c0" font-size="17" text-anchor="middle" font-weight="700" font-family="sans-serif">'+year+'</text>';});
    out+='<text x="10" y="18" fill="#d7ac67" font-size="12" letter-spacing="2" font-weight="700">HKD / SHARE</text>';
    scenarios.forEach(s=>{
      const points=s.values.map((v,i)=>x(i)+','+y(v)).join(' ');
      out+='<polyline points="'+points+'" fill="none" stroke="'+s.color+'" stroke-width="'+(s.key==='base'?5:3.5)+'" stroke-linejoin="round" stroke-linecap="round"/>';
      s.values.forEach((v,i)=>{
        out+='<circle cx="'+x(i)+'" cy="'+y(v)+'" r="'+(i===2?7:5)+'" fill="#101925" stroke="'+s.color+'" stroke-width="3"/>';
        if(i===2)out+='<text x="'+(x(i)-14)+'" y="'+(y(v)-12)+'" fill="'+s.color+'" font-size="18" font-weight="800" text-anchor="end" font-family="sans-serif">HK$'+v+'</text>';
      });
    });
    out+='</svg>';
    chart.innerHTML=out;
  }
  plot();
  const inputs={shares:$('shares'),strike:$('strike'),target:$('target'),charge:$('charge')};
  const form=$('award-form');
  function safeNumber(element){const n=Number(element.value);return element.value.trim()===''?NaN:n;}
  function setResult(id,value){const el=$(id);if(el)el.textContent=value;}
  function calculate(){
    const shareCount=safeNumber(inputs.shares), strike=safeNumber(inputs.strike), price=safeNumber(inputs.target), charges=safeNumber(inputs.charge);
    const invalid=![shareCount,strike,price,charges].every(Number.isFinite)||shareCount<=0||!Number.isInteger(shareCount)||strike<0||price<0||charges<0||shareCount>1e8||Math.max(strike,price)>1e6||charges>1e9;
    const resetView=()=>{['gross-spread','share-value','purchase-cost','cash-outcome','shares-to-sell','remaining-shares'].forEach((id,i)=>setResult(id,i===0?'ENTER SHARES':'—'));};
    if(invalid){resetView();setResult('model-message','Enter a positive whole-number share quantity and non-negative price and charge inputs. Values remain on this device only.');return;}
    const value=shareCount*price, cost=shareCount*strike, spread=value-cost, net=spread-charges;
    setResult('gross-spread',spread<0?'−'+money(spread):money(spread));
    setResult('share-value',money(value));
    setResult('purchase-cost',money(cost));
    setResult('cash-outcome',net<0?'SHORTFALL '+money(net):money(net));
    const sold=price>0?Math.ceil(cost/price):Infinity, feasible=Number.isFinite(sold)&&sold<=shareCount;
    setResult('shares-to-sell',feasible?whole(sold)+' of '+whole(shareCount):'NOT COVERED');
    setResult('remaining-shares',feasible?whole(shareCount-sold):'0 / SHORTFALL');
    if(price<strike)setResult('model-message','The assumed market price is below the purchase price. Share-sale proceeds alone are insufficient to fund the full purchase. Exercise may be uneconomic.');
    else if(net<0)setResult('model-message','The estimated taxes and fees exceed the gross spread. A separate funding shortfall remains; consult the actual vesting notice and tax advice.');
    else setResult('model-message','Illustrative proceeds only. Actual execution prices, bank fees, withholding, tax, dividend rights and the trustee notice determine final settlement. Partial sales incur transaction frictions.');
  }
  if(form){
    form.addEventListener('submit',e=>{e.preventDefault();calculate();});
    Object.values(inputs).forEach(el=>el.addEventListener('input',calculate));
    $('reset-model').addEventListener('click',()=>{inputs.shares.value='';inputs.strike.value='87.48';inputs.target.value='175';inputs.charge.value='0';calculate();});
    calculate();
  }
  const cases=document.querySelectorAll('[data-case]');
  cases.forEach(button=>button.addEventListener('click',()=>{
    const chosen=scenarios.find(s=>s.key===button.dataset.case);
    cases.forEach(c=>c.classList.toggle('selected',c===button));
    if(chosen&&inputs.target){inputs.target.value=String(chosen.values[2]);calculate();document.getElementById('settlement').scrollIntoView({behavior:'smooth',block:'start'});}
  }));
  const csv=$('export-scenarios');
  if(csv)csv.addEventListener('click',()=>{
    const lines=['Year,Downside_HKD,Central_HKD,Upside_HKD,Data_Classification','2027,95,140,185,Illustrative scenario','2028,88,155,230,Illustrative scenario','2029,80,175,275,Illustrative scenario','Source,Independent conditional examples; not market forecasts,,,'];
    const blob=new Blob([lines.join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='zijin-2259-2027-2029-illustrative-scenarios.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  });
  const year=$('footer-year');if(year)year.textContent=String(new Date().getFullYear());
})();