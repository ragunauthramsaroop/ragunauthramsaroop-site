/* E2E Chromium smoke test, executed on GitHub Actions without third-party browser credits.
 * Mocked market source fixtures exercise the same production frontend through the HTTP origin.
 * This is an interaction test, NOT a live quote or live-data entitlement validation.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const SITE = 'http://127.0.0.1:4173/tools/zijin-2259/';
function bars(symbol){
  // Sliding historical fixtures stay recent under the seven-day source policy.
  const today=Math.floor(Date.now()/86400000)*86400000;
  const end=today-86400000+8*3600000,start=end-410*86400000;
  const base=symbol==='2259.HK'?87:symbol==='2899.HK'?21:3550;
  const slope=symbol==='2259.HK'?.12:symbol==='2899.HK'?.028:1.2;
  const out=[];let idx=0;
  for(let t=start;t<=end;t+=86400000){
    const day=new Date(t).getUTCDay();
    if(day===0||day===6)continue;
    const close=Number((base+idx*slope+Math.sin(idx*.22)*base*.045+Math.cos(idx*.08)*base*.021).toFixed(2));
    const open=Number((close*(1+Math.sin(idx*.43)*.004)).toFixed(2));
    out.push({t:Math.floor(t/1000),o:open,h:Number((Math.max(open,close)*1.012).toFixed(2)),l:Number((Math.min(open,close)*.987).toFixed(2)),c:close,v:Math.round(1500000+(idx%31)*36712)});
    idx++;
  }
  return out;
}
function intradayFeed(symbol){
 const original=feed(symbol);
 const bars=[];
 const start=Date.now()-3600000-64*900000;
 for(let i=0;i<65;i++){
  const t=start+i*900000;
  const c=Number((118+i*.035+Math.sin(i*.3)*1.3).toFixed(2));
  bars.push({t:Math.floor(t/1000),o:c-.09,h:c+.21,l:c-.25,c,v:250000+i*470});
 }
 const last=bars.at(-1);
 return {...original,bars,interval:'15m',latestBarTime:new Date(last.t*1000).toISOString(),providerQuoteTime:new Date(last.t*1000).toISOString(),regularMarketPrice:last.c};
}
function feed(symbol){
 const history=bars(symbol),latest=history.at(-1),prev=history.at(-2);
 return {ok:true,symbol,sourceSymbol:symbol,currency:symbol==='GC=F'?'USD':'HKD',
  displayName:symbol==='2259.HK'?'Zijin Gold International':symbol==='2899.HK'?'Zijin Mining Group':'COMEX Gold Futures',
  provider:'Yahoo Finance E2E MOCK - NEVER LIVE',interval:'1d',providerQuoteTime:new Date(latest.t*1000).toISOString(),latestBarTime:new Date(latest.t*1000).toISOString(),
  fetchedAt:new Date().toISOString(),regularMarketPrice:latest.c,previousClose:prev.c,
  change:latest.c-prev.c,changePercent:(latest.c/prev.c-1)*100,bars:history,marketState:'CLOSED',dataDelay:'E2E MOCK of provider-delayed observations, NEVER LIVE'};
}
async function waitFor(page,fn,desc){
 try{await page.waitForFunction(fn,{timeout:25000});}catch(e){throw Error('Timed out waiting for '+desc+': '+e.message)}
}
async function run(){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let passed=0,failures=[],errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/market?**',async route=>{
   const s=new URL(route.request().url()).searchParams.get('symbol');
   if(!['2259.HK','2899.HK','GC=F'].includes(s))return route.fulfill({status:400,body:JSON.stringify({ok:false})});
   const is15m=new URL(route.request().url()).searchParams.get('interval')==='15m';
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(is15m?intradayFeed(s):feed(s))});
  });
  await page.route('**/api/news',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,checkedAt:'2026-11-13T10:00:00Z',articles:[]})}));
  await page.route('**/api/licensed-quote?**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,status:'not_connected',message:'No licensed on-site quote entitlement configured'})}));
  await page.goto(SITE,{waitUntil:'domcontentloaded',timeout:30000});
  async function check(name,fn){try{await fn();passed++;console.log('PASS '+name)}catch(e){failures.push(name+': '+e.message);console.error('FAIL '+name+': '+e.message)}}
  await check('Correct market tickers, native charts and timestamps',async()=>{
    await waitFor(page,()=>(document.querySelector('#live-kpi-2259')?.textContent||'').includes('HK$'),'2259 quote');
    assert.equal(await page.locator('#market-chart svg').count(),1);
    assert.equal(await page.locator('#gold-chart svg').count(),1);
    assert.equal(await page.locator('#parent-chart svg').count(),1);
    assert.equal(await page.locator('text=Apple Inc.').count(),0);
    assert.match(await page.locator('#live-kpi-2259-asof').textContent(),/HKT/);
  });
  await check('Official HKEX disclosure desk filters only curated issuer records',async()=>{
    assert.equal(await page.locator('#issuer-filings-list .issuer-filing-card').count(),8);
    assert.match(await page.locator('#issuer-shares-issued').textContent(),/3,617,000/);
    assert.match(await page.locator('#issuer-shares-percent').textContent(),/0\.1351%/);
    await page.locator('button[data-issuer-filter="Share scheme"]').click();
    assert.equal(await page.locator('#issuer-filings-list .issuer-filing-card').count(),2);
    await page.locator('#issuer-filing-search').fill('award');
    assert.equal(await page.locator('#issuer-filings-list .issuer-filing-card').count(),1);
    const official=await page.locator('#issuer-filings-list a.issuer-filing-source').getAttribute('href');
    assert.match(official,/^https:\/\/www1\.hkexnews\.hk\/listedco\/listconews\/sehk\//);
    await page.locator('#issuer-filing-search').fill('');
    await page.locator('button[data-issuer-filter="All"]').click();
    assert.equal(await page.locator('#issuer-filings-list .issuer-filing-card').count(),8);
  });
  await check('Initial chart follows newest delayed 15-minute bars without auto replay',async()=>{
    await waitFor(page,()=>/15-MINUTE OHLC/.test(document.querySelector('#market-chart-status')?.textContent||''),'default delayed 15-minute chart');
    assert.equal(await page.locator('[data-chart-interval="15m"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#motion-follow').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#motion-replay-toggle').getAttribute('aria-pressed'),'false');
    assert.match(await page.locator('#motion-mode-label').textContent(),/NOT LIVE TRADES/);
    const link=page.locator('.motion-authorised-live');
    assert.equal(await link.isVisible(),true);
    assert.equal(await link.getAttribute('href'),'https://www.etnet.com.hk/www/eng/stocks/realtime/index.php');
  });
  await check('Latest delayed bar is the default; historical replay remains optional',async()=>{
    await waitFor(page,()=>!!document.querySelector('#market-chart svg [data-motion-line]'),'motion playhead');
    assert.equal(await page.locator('#motion-replay-toggle').getAttribute('aria-pressed'),'false');
    assert.equal(await page.locator('#motion-follow').getAttribute('aria-pressed'),'true');
    assert.match(await page.locator('#motion-observation').textContent(),/LATEST VERIFIED BAR/);
    assert.match(await page.locator('#motion-mode-label').textContent(),/FOLLOWING DELAYED BAR.*NOT LIVE TRADES/);
    const play=page.locator('#motion-replay-toggle');
    if(await play.getAttribute('aria-pressed')==='false')await play.click();
    const first=await page.locator('#market-chart [data-motion-line]').getAttribute('x1');
    await page.waitForTimeout(550);
    const second=await page.locator('#market-chart [data-motion-line]').getAttribute('x1');
    assert.notEqual(first,second,'historical replay playhead must move');
    await play.click();
    assert.equal(await play.getAttribute('aria-pressed'),'false');
    const paused=await page.locator('#market-chart [data-motion-line]').getAttribute('x1');
    await page.waitForTimeout(220);
    assert.equal(await page.locator('#market-chart [data-motion-line]').getAttribute('x1'),paused);
    assert.match(await page.locator('#motion-mode-label').textContent(),/REPLAY PAUSED/);
  });
  await check('15-minute delayed OHLC bars load without changing portfolio daily data',async()=>{
    await page.locator('[data-chart-interval="15m"]').click();
    await waitFor(page,()=>/15-MINUTE OHLC/.test(document.querySelector('#market-chart-status')?.textContent||''),'intraday data');
    assert.equal(await page.locator('[data-chart-interval="15m"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('[data-price-range="5d"]').isVisible(),true);
    assert.match(await page.locator('#market-chart-timestamp').textContent(),/15-minute source observation:/);
    assert.match(await page.locator('#motion-market-status').textContent(),/DELAYED/);
    assert.match(await page.locator('#live-kpi-2259-asof').textContent(),/HKT/);
    await page.locator('#motion-follow').click();
    assert.equal(await page.locator('#motion-follow').getAttribute('aria-pressed'),'true');
    assert.match(await page.locator('#motion-observation').textContent(),/LATEST VERIFIED BAR/);
    await page.locator('[data-chart-interval="1d"]').click();
    assert.equal(await page.locator('[data-price-range="5d"]').isVisible(),false);
    assert.equal(await page.locator('[data-chart-interval="1d"]').getAttribute('aria-pressed'),'true');
  });
  await check('Quant distribution reacts to drift changes',async()=>{
    await waitFor(page,()=>!!document.querySelector('#quant-fan-chart svg')&&!document.querySelector('#quant-median-nov')?.textContent.includes('—'),'quant fan');
    const before=(await page.locator('#quant-median-nov').textContent()).trim();
    await page.locator('#quant-drift').evaluate(el=>{el.value='28';el.dispatchEvent(new Event('input',{bubbles:true}))});
    await waitFor(page,()=>document.querySelector('#quant-drift-value')?.textContent.includes('+28%'),'updated drift');
    await page.waitForTimeout(1300);
    const after=(await page.locator('#quant-median-nov').textContent()).trim();
    assert.notEqual(after,before,'new model median should differ');
    assert.equal(await page.locator('#quant-histogram svg').count(),1);
  });
  await check('Gold x production sensitivity selection drives controls',async()=>{
    await waitFor(page,()=>document.querySelectorAll('#stress-heatmap button').length===25,'25 heatmap buttons');
    await page.locator('#stress-heatmap button').first().click({timeout:6000});
    assert.equal(await page.locator('#model-gold').inputValue(),'3000');
    assert.equal(await page.locator('#model-production').inputValue(),'50');
    assert.match(await page.locator('#stress-readout').textContent(),/3,000/);
  });
  await check('Private award calculator and Monte Carlo spread work',async()=>{
    await page.locator('#shares').fill('100');
    await waitFor(page,()=>!!document.querySelector('#award-quant-chart svg'),'private payoff chart');
    const text=(await page.locator('#award-quant-median').textContent()).trim();
    assert.match(text,/HK\$/);
    assert.notEqual(text,'—');
    assert.match(await page.locator('#gross-spread').textContent(),/HK\$/);
    assert.match(await page.locator('#award-quant-source').textContent(),/100 shares/);
    const selectedPrice=Number(await page.locator('#target').inputValue());
    const displayed=await page.locator('#gross-spread').textContent();
    const measured=Number(displayed.replace(/[^0-9.-]/g,''));
    const expected=Number(((selectedPrice-87.48)*100).toFixed(2));
    assert.ok(Math.abs(measured-expected)<0.02,'net of purchase-price spread arithmetic must match');
    await page.locator('#charge').fill('100');
    const coverExpected=Math.ceil((100*87.48+100)/selectedPrice);
    const coverDisplayed=parseInt((await page.locator('#shares-to-sell').textContent()).split('/')[0].replace(/,/g,'').trim(),10);
    assert.equal(coverDisplayed,coverExpected,'whole share sales must fund entered fees as well as purchase');
    await page.locator('#charge').fill('0');
  });
  await check('Manual award simulator is independent and saved quantity stays on device',async()=>{
    await page.locator('#chart-award-shares').fill('100');
    await page.locator('#chart-award-save').click();
    assert.equal(await page.locator('#chart-award-shares').getAttribute('readonly'),'');
    const observed=await page.locator('#chart-award-price').textContent();
    const payout=await page.locator('#chart-award-payout').textContent();
    await page.locator('#award-sim-price').fill('120');
    assert.equal(await page.locator('#award-sim-payout').textContent(),'HK$3,252.00');
    await page.locator('#award-sim-quantity').fill('200');
    assert.equal(await page.locator('#award-sim-payout').textContent(),'HK$6,504.00');
    await page.locator('#award-sim-price').fill('80');
    assert.equal(await page.locator('#award-sim-payout').getAttribute('data-sign'),'loss');
    assert.equal(await page.locator('#chart-award-price').textContent(),observed);
    assert.equal(await page.locator('#chart-award-payout').textContent(),payout);
    assert.equal(await page.evaluate(()=>localStorage.getItem('zgi.private.award.quantity.v1')),'100');
    await page.locator('#award-sim-quantity').fill('');
    await page.locator('#award-sim-price').fill('');
    assert.equal(await page.locator('#award-sim-payout').textContent(),'Enter price');
    await page.locator('#chart-award-clear').click();
    assert.equal(await page.evaluate(()=>localStorage.getItem('zgi.private.award.quantity.v1')),null);
    assert.equal(await page.locator('#chart-award-shares').inputValue(),'');
    await page.locator('#shares').fill('100');
  });
  await check('Private eligibility screening responds to ROE and employment conditions',async()=>{
    await page.locator('#elig-roe-2026').fill('15');
    await page.locator('#elig-roe-2027').fill('15');
    await page.locator('#elig-roe-2028').fill('15');
    await page.locator('#elig-performance').selectOption('pass');
    await page.locator('#elig-employment').selectOption('pass');
    assert.match(await page.locator('#eligibility-result').textContent(),/SCREENING THRESHOLDS MET/);
    await page.locator('#elig-roe-2027').fill('5');
    assert.match(await page.locator('#eligibility-result').textContent(),/CONDITIONS NOT MET/);
    await page.locator('#eligibility-reset').click();
    assert.match(await page.locator('#eligibility-result').textContent(),/NOT YET DETERMINED/);
  });
  await check('Audited asset bar chart and issuer 2025 totals',async()=>{
    assert.equal(await page.locator('#mine-bars button.mine-row').count(),9);
    assert.equal(await page.locator('#mine-donut svg').count(),1);
    await page.locator('#mine-bars button.mine-row').filter({hasText:'Aurora'}).click();
    assert.match(await page.locator('#mine-selection').textContent(),/Aurora/);
  });
  await check('Private user-observed HKEX reference and explicit award handoff',async()=>{
    const delayed=(await page.locator('#live-stock-price').textContent()).trim();
    await page.locator('#manual-2259-input').fill('151.35');
    await page.locator('#manual-2899-input').fill('30.20');
    await page.locator('#manual-quote-provider').selectOption('etnet');
    await page.locator('#manual-quote-form button[type="submit"]').click();
    assert.match(await page.locator('#manual-2259-output').textContent(),/HK\$151\.35/);
    assert.match(await page.locator('#manual-2259-delta').textContent(),/provider-delayed/);
    assert.match(await page.locator('#manual-quote-status').textContent(),/USER-ENTERED REFERENCE/);
    assert.equal(await page.locator('#manual-quote-award').isEnabled(),true);
    await page.locator('#manual-quote-award').click();
    assert.equal(await page.locator('#target').inputValue(),'151.35');
    assert.match(await page.locator('#calc-market-context').textContent(),/USER-ENTERED REFERENCE/);
    assert.equal((await page.locator('#live-stock-price').textContent()).trim(),delayed,'manual reference must not change exchange quote');
  });
  await check('Real-time permission gate fails closed',async()=>{
    await waitFor(page,()=>document.querySelector('#licensed-connection-state')?.textContent.includes('NOT CONNECTED'),'entitlement gate');
    assert.match(await page.locator('#licensed-status').textContent(),/No HKEX-licensed on-site entitlement/);
    assert.equal(await page.locator('#licensed-2259-price').textContent(),'—');
  });
  await check('Mobile menu and responsive layout',async()=>{
    await page.setViewportSize({width:390,height:844});
    const button=page.locator('#menu-toggle');
    assert.equal(await button.isVisible(),true);
    await button.click();
    assert.equal(await button.getAttribute('aria-expanded'),'true');
    await button.click();
    assert.equal(await button.getAttribute('aria-expanded'),'false','the toggle should close the mobile drawer without pointer interception');
    await button.click();
    assert.equal(await button.getAttribute('aria-expanded'),'true');
    await page.locator('.side-nav a[href="#mines"]').click();
    assert.equal(await button.getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('#mines').isVisible(),true);
  });
  await check('Section markers align with numbered labels',async()=>{
    const rows=await page.evaluate(()=>[...document.querySelectorAll('main>.section')].filter(s=>s.id!=='overview').map(s=>({
      label:s.querySelector('.section-kicker')?.textContent?.slice(0,2),
      marker:s.querySelector('.section-head>.section-index')?.textContent?.trim()
    })));
    for(const item of rows)assert.equal(item.label,item.marker,'section index must match heading');
  });
  await check('Chart-first reading order and source disclosures preserved',async()=>{
    const order=await page.evaluate(()=>{
      const nodes=[...document.querySelectorAll('main>.section')];
      const earlier=(a,b)=>{
        const x=document.querySelector(a),y=document.querySelector(b);
        return !!(x&&y&&(x.compareDocumentPosition(y)&Node.DOCUMENT_POSITION_FOLLOWING));
      };
      return {
        ids:nodes.map(node=>node.id),
        active:document.documentElement.classList.contains('visual-first'),
        marketAheadOfLicense:earlier('#market-chart','.realtime-access'),
        mainChartAheadOfQuoteDetail:earlier('#market-chart','.overview-grid'),
        quantFanAheadOfInputs:earlier('#quant-fan-chart','.quant-controls'),
        scenarioChartAheadOfInputs:earlier('#scenario-chart','.model-controls'),
        mineAheadOfHeadlines:earlier('#mine-donut','#issuer-news-feed'),
        awardChartAheadOfForm:earlier('#award-quant-chart','#award-form'),
        liveMarketSourceExists:!!document.querySelector('#global-market-source'),
        licensedStatusExists:!!document.querySelector('#licensed-connection-state'),
        uniqueMarketChart:document.querySelectorAll('#market-chart').length===1
      };
    });
    assert.equal(order.active,true);
    assert.deepEqual(order.ids.slice(0,10),['overview','charting','technicals','risk-lab','scenarios','mines','settlement','evidence','news','sources']);
    for(const [key,value] of Object.entries(order))if(!['ids','active'].includes(key))assert.equal(value,true,key);
  });
  await check('No runtime exceptions',async()=>{assert.deepEqual(errors,[])});
 }finally{await browser.close()}
 console.log('E2E checks: '+passed+' passed, '+failures.length+' failed');
 if(failures.length){for(const f of failures)console.error(f);process.exitCode=1}
}
run().catch(e=>{console.error(e);process.exitCode=1});
