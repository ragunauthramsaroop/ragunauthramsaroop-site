/* ZGI Intelligence: navigation and client-only share-settlement calculations.
   No personal award quantity is embedded or sent to any network. Optional local saving is handled by the chart tracker. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const money=n=>Number.isFinite(n)?'HK$'+Math.abs(n).toLocaleString('en-HK',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
  const whole=n=>Number.isFinite(n)?Math.round(n).toLocaleString('en-HK'):'—';
  function marketTime(){
    try {
      const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Hong_Kong',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
      const m=Number(parts.hour)*60+Number(parts.minute);
      const weekday=!['Sat','Sun'].includes(parts.weekday);
      const open=weekday&&((m>=570&&m<720)||(m>=780&&m<960));
      $('hk-clock').textContent='HKT '+parts.weekday.toUpperCase()+' '+parts.hour+':'+parts.minute;
      $('market-status').textContent=open?'SCHEDULED HOURS*':'OUTSIDE SCHEDULE';
      $('market-status').title='Indicative regular trading hours only, not an official holiday, halt or entitlement calendar.';
    }catch(e){if($('hk-clock'))$('hk-clock').textContent='HKT CLOCK UNAVAILABLE';}
  }
  marketTime();setInterval(marketTime,15000);
  const sidebar=$('sidebar'),menu=$('menu-toggle');
  if(sidebar&&menu){
    menu.addEventListener('click',()=>{const on=sidebar.classList.toggle('is-open');menu.setAttribute('aria-expanded',String(on));menu.setAttribute('aria-label',on?'Close navigation':'Open navigation');});
    sidebar.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{sidebar.classList.remove('is-open');menu.setAttribute('aria-expanded','false');}));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){sidebar.classList.remove('is-open');menu.setAttribute('aria-expanded','false');}});
  }
  const nav=document.querySelectorAll('[data-nav]');
  if('IntersectionObserver' in window){
    const obs=new IntersectionObserver(entries=>{
      const most=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!most)return;
      nav.forEach(x=>x.classList.toggle('is-active',x.dataset.nav===most.target.id));
    },{rootMargin:'-20% 0px -55% 0px',threshold:[0,.2,.4]});
    document.querySelectorAll('main > section[id]').forEach(el=>obs.observe(el));
  }
  const inputs={shares:$('shares'),strike:$('strike'),target:$('target'),charge:$('charge')};
  let verifiedQuote=null,sourceAsOf=null,manuallyChosen=false;
  function num(input){if(!input||input.value.trim()==='')return NaN;return Number(input.value);}
  function text(id,value){const el=$(id);if(el)el.textContent=value;}
  function calculate(){
    const shares=num(inputs.shares),strike=num(inputs.strike),sale=num(inputs.target),charges=num(inputs.charge);
    const valid=[shares,strike,sale,charges].every(Number.isFinite)&&shares>0&&Number.isInteger(shares)&&shares<=1e8&&strike>=0&&strike<=1e6&&sale>=0&&sale<=1e6&&charges>=0&&charges<=1e9;
    if(!valid){
      ['share-value','purchase-cost','cash-outcome','shares-to-sell','remaining-shares'].forEach(k=>text(k,'—'));
      text('gross-spread','ENTER SHARES & PRICE');
      text('model-message','Enter a whole-number share quantity. Select a verified market quote or a dynamic 2029 scenario price. Inputs are not transmitted. Only an explicitly saved quantity stays on this device.');
      return;
    }
    const gross=shares*sale,purchase=shares*strike,spread=gross-purchase,net=spread-charges;
    text('gross-spread',(spread<0?'−':'')+money(spread));
    text('share-value',money(gross));text('purchase-cost',money(purchase));
    text('cash-outcome',net<0?'SHORTFALL '+money(net):money(net));
    const count=sale>0?Math.ceil((purchase+charges)/sale):Infinity;
    const feasible=Number.isFinite(count)&&count<=shares;
    text('shares-to-sell',feasible?whole(count)+' / '+whole(shares):'NOT FULLY FUNDED');
    text('remaining-shares',feasible?whole(shares-count):'0 / FUNDING GAP');
    if(sale<strike)text('model-message','At the selected price, selling all shares fails to cover the total purchase price. Exercising would be financially unattractive without further funding. Your grant terms and tax advice govern.');
    else if(net<0)text('model-message','The assumed taxes and charges exceed the positive spread. Your selection produces a funding shortfall.');
    else text('model-message','Illustrative sell-to-cover quantity includes the purchase cost and entered taxes or fees, rounded up to whole shares. Trustee execution, withholding, applicable charges and vesting terms govern actual settlement.');
  }
  for(const input of Object.values(inputs)){input?.addEventListener('input',()=>{if(input===inputs.target)manuallyChosen=true;calculate();});}
  $('award-form')?.addEventListener('submit',e=>{e.preventDefault();calculate();});
  function setTarget(price,note,scroll=false){
    if(!Number.isFinite(price)||price<=0)return;
    inputs.target.value=price.toFixed(2);manuallyChosen=true;calculate();text('calc-market-context',note);
    if(scroll)$('settlement')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  $('calc-use-market')?.addEventListener('click',()=>{
    if(Number.isFinite(verifiedQuote))setTarget(verifiedQuote,'Market observation ('+sourceAsOf+'). Provider-delayed, not licensed real-time HKEX quote.');
    else text('calc-market-context','Verified current quote unavailable. No price substituted.');
  });
  $('reset-model')?.addEventListener('click',()=>{
    inputs.shares.value='';inputs.strike.value='87.48';inputs.charge.value='0';inputs.target.value=Number.isFinite(verifiedQuote)?verifiedQuote.toFixed(2):'';
    manuallyChosen=false;text('calc-market-context',Number.isFinite(verifiedQuote)?'Selected most recent verified delayed market quote.':'Awaiting provider quote.');calculate();
  });
  document.addEventListener('zgi:market',e=>{
    const stock=e.detail?.stock;
    if(stock&&!stock.archive&&Number.isFinite(stock.regularMarketPrice)){
      verifiedQuote=stock.regularMarketPrice;sourceAsOf=stock.providerQuoteTime;
      if(!manuallyChosen){inputs.target.value=verifiedQuote.toFixed(2);text('calc-market-context','Using newest verified delayed 2259.HK observation, '+sourceAsOf+'.');calculate();}
    }
  });
  document.addEventListener('zgi:manual-price',e=>{
    const quote=e.detail;
    if(!quote||quote.verified!==false||quote.exchangeTimestampKnown!==false)return;
    const observed=Number(quote.price);
    if(!Number.isFinite(observed)||observed<=0||observed>100000)return;
    const time=Number.isFinite(Date.parse(quote.entryTime))?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Hong_Kong',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(quote.entryTime))+' HKT':'unknown time';
    setTarget(observed,'USER-ENTERED REFERENCE · entered '+time+'. This is a private hypothetical award-model input, not a verified exchange quote. Automated prices and historical forecast charts remain unchanged.',false);
  });
  document.addEventListener('zgi:scenario-select',e=>{
    const price=e.detail?.price,kind=e.detail?.scenario||'selected';
    if(Number.isFinite(price)&&price>0)setTarget(price,'Hypothetical '+kind.toUpperCase()+' 2029 scenario. This is not a market quote.',true);
  });
  text('footer-year',String(new Date().getFullYear()));
  calculate();
})();
