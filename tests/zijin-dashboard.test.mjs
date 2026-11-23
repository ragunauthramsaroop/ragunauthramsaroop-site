import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root='tools/zijin-2259/';
const html=readFileSync(root+'index.html','utf8');
const visualFirst=readFileSync(root+'visual-first.js','utf8');
const visualCss=readFileSync(root+'visual-first.css','utf8');
test('visual-first assets precede core application and preserve private controls',()=>{
 assert.match(html,/visual-first[.]css/);
 assert.ok(html.indexOf('visual-first.js')<html.indexOf('app.js'));
 for(const target of ['overview-grid','realtime-access','quant-controls','model-controls','award-risk-panel'])assert.match(visualFirst,new RegExp(target));
 assert.match(visualCss,/quant-main/);
 assert.match(visualCss,/dynamic-model-grid/);
});

const css=readFileSync(root+'styles.css','utf8');
const app=readFileSync(root+'app.js','utf8');
const market=readFileSync(root+'markets.js','utf8');
const motion=readFileSync(root+'chart-motion.js','utf8');
test('replay is labelled historical and never claims real-time trade ticks',()=>{
 assert.match(html,/HISTORICAL REPLAY[^<]*NOT LIVE TRADES/);
 assert.match(html,/15-MIN BARS/);
 assert.ok(html.indexOf('markets.js')<html.indexOf('chart-motion.js'));
 assert.match(motion,/zgi:chart/);
 assert.match(motion,/reduced-motion/);
 assert.match(motion,/FOLLOW DELAYED SOURCE/);
 assert.match(market,/refreshIntraday/);
 assert.match(market,/data-motion-line/);
 assert.doesNotMatch(motion,/Math[.]random/);
});

const analytics=readFileSync(root+'intelligence.js','utf8');
const news=readFileSync(root+'news.js','utf8');
const api=readFileSync(root+'api/market.js','utf8');
const newsApi=readFileSync(root+'api/news.js','utf8');
test('correct HKEX stock and parent; no Apple or TradingView fallback',()=>{
 assert.match(html,/HKEX:2259/);
 assert.match(html,/HKEX:2899/);
 assert.doesNotMatch(html,/embed-widget-|NASDAQ:AAPL|Apple Inc/);
 assert.doesNotMatch(market,/NASDAQ:AAPL|Apple Inc|embed-widget-/);
});
test('all market headline KPIs are bound to a dynamic placeholder',()=>{
 for(const id of ['live-kpi-2259','live-kpi-2899','live-kpi-gold','live-kpi-range','global-market-source']){
  assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(analytics,/live-kpi-"\+key/);
 }
 assert.doesNotMatch(html,/class="metric-value">HK\$121\.20/);
});
test('stock, parent and gold each have their own interactive chart',()=>{
 for(const id of ['market-chart','parent-chart','gold-chart','compare-chart','scenario-chart']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(market,/data-peer-hitbox/);
 assert.match(market,/data-interactive-chart/);
 assert.match(analytics,/data-compare-hitbox/);
 assert.match(analytics,/data-model-year/);
});
test('quote history is symbol-verified and timestamped by upstream',()=>{
 assert.match(api,/actualSymbol!==symbol\.toUpperCase\(\)/);
 assert.match(api,/providerQuoteTime/);
 assert.match(api,/sourceSymbol:meta\.symbol/);
 assert.match(api,/dataDelay:"Provider\/exchange delayed/);
 assert.match(api,/ohlc\.at\(-2\)\.c/);
 assert.match(api,/Cache-Control/);
 assert.doesNotMatch(api,/chartPreviousClose\?\?/);
});
test('only 2259, 2899 and gold futures symbols are accepted',()=>{
 for(const s of ['2259.HK','2899.HK','GC=F'])assert.ok(api.includes(s));
 assert.match(api,/Unsupported symbol or range/);
 assert.match(api,/Market-data provider unavailable/);
 assert.match(market,/No other security is substituted/);
});
test('gold futures are labelled as futures, not gold spot',()=>{
 assert.match(html,/COMEX gold futures \(GC=F\) are a proxy, NOT spot XAU\/USD/);
 assert.match(api,/kind:"gold_futures"/);
 assert.match(html,/GOLD FUTURES · USD\/OZ/);
});
test('market refresh dispatches complete validated source references',()=>{
 assert.match(market,/CustomEvent\("zgi:market"/);
 assert.match(market,/refreshedAt:new Date\(\)\.toISOString/);
 assert.match(market,/load\("2259\.HK","1y"\)/);
 assert.match(market,/load\("2899\.HK","1y"\)/);
 assert.match(market,/load\("GC=F","1y"\)/);
 assert.match(market,/refresh-market-now/);
});
test('risk KPIs compute from observed daily returns and not fixed values',()=>{
 for(const id of ['risk-volatility','risk-drawdown','risk-average-volume','risk-price-vs-strike'])assert.match(analytics,new RegExp(id));
 assert.match(analytics,/Math\.sqrt\(252\)/);
 assert.match(analytics,/b\.slice\(-252\)/);
});
test('2027-2029 forecasts are dynamically market-anchored',()=>{
 assert.match(analytics,/const stockPrice=stock\.regularMarketPrice,goldPrice=gold\.regularMarketPrice/);
 assert.match(analytics,/estimate\(stockPrice,goldPrice,assumptions,key,y\)/);
 assert.match(analytics,/futureGrossMargin\/baseGrossMargin/);
 assert.match(analytics,/hypotheticalProd\/59\.2/);
 assert.match(analytics,/!feedOK\(market\)/);
 for(const x of ['model-gold','model-production','model-cost','model-multiple','model-dilution'])assert.match(html,new RegExp('id="'+x+'"'));
 assert.doesNotMatch(app,/values:\[95,88,80\]|values:\[140,155,175\]|values:\[185,230,275\]/);
});
test('projection year points and scenario cards are actionable',()=>{
 assert.match(analytics,/zgi:scenario-select/);
 assert.match(analytics,/year===2029/);
 assert.match(analytics,/model-data-status/);
 assert.match(analytics,/data-case/);
 assert.match(analytics,/download="zijin-2259-recalculated/);
});
test('scenario outputs stay qualified and contractual baselines stay separate',()=>{
 assert.match(html,/not analyst price targets/);
 assert.match(html,/2026 production is a company target of 59\.2 tonnes/);
 assert.match(html,/AISC of US\$1,649\/oz/);
 assert.match(html,/2027 and 2028 are qualification years/);
});
test('employee incentive quantity is private-by-default and never sent to server',()=>{
 assert.match(html,/<input id="shares"[^>]*value=""/);
 assert.doesNotMatch(app,/fetch\(|localStorage|sessionStorage|indexedDB|XMLHttpRequest/);
 assert.match(app,/spread=gross-purchase/);
 assert.match(app,/net=spread-charges/);
 assert.match(app,/sale<strike/);
 assert.match(app,/zgi:scenario-select/);
 assert.match(app,/calc-use-market/);
});
test('company-related RSS headlines have publication timestamps and safe links',()=>{
 assert.match(newsApi,/news\.google\.com\/rss\/search/);
 assert.match(newsApi,/host!=="news\.google\.com"/);
 assert.match(newsApi,/publishedAt/);
 assert.match(news,/publishedAt/);
 assert.match(news,/rel="noopener noreferrer"/);
 assert.match(news,/No headlines have been generated/);
 assert.match(html,/id="issuer-news-feed"/);
});
test('no silent stale substitution in the forecast',()=>{
 assert.match(market,/archive:true/);
 assert.match(analytics,/!detail\.stock\.archive/);
 assert.match(analytics,/HISTORICAL DATA IS NOT A LIVE FORECAST/);
 assert.match(analytics,/ageLabel/);
});
test('responsive UI and keyboard accessible section navigation',()=>{
 assert.match(html,/class="skip-link"/);
 assert.match(html,/<main id="main">/);
 assert.match(css,/@media\(max-width:680px\)/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(analytics,/node\.addEventListener\("keydown"/);
 assert.match(html,/data-compare-symbol="stock" aria-pressed="true"/);
});

test('probability lab, heatmap, financial evidence and local eligibility are visible',()=>{
 const quant=readFileSync(root+'quant.js','utf8');
 const quantUI=readFileSync(root+'quant-ui.js','utf8');
 const decision=readFileSync(root+'decision-ui.js','utf8');
 for(const id of ['risk-lab','quant-fan-chart','quant-histogram','quant-correlation','stress-heatmap','evidence','eligibility-result','data-ledger']){
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 for(const id of ['quant-drift','quant-vol','quant-block','quant-samples'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(quant,/bootstrappedFuture/);
 assert.match(quant,/backtestCoverage/);
 assert.match(quantUI,/zgi:quant/);
 assert.match(decision,/sensitivityGrid/);
 assert.match(decision,/actual scheme rules/i);
 assert.match(html,/11 November 2029 falls on a Sunday/);
});
test('latest reported company baseline is not confused with 2026 target',()=>{
 assert.match(html,/41 tonnes/);
 assert.match(html,/US\$1,649\/oz/);
 assert.match(html,/2026 production is a company target/);
 assert.match(analytics,/anchorGold-1649/);
 assert.doesNotMatch(analytics,/anchorGold-1678/);
 assert.match(html,/2026042902638\.pdf/);
 assert.match(html,/2026101900165\.pdf/);
});

test('audited asset-level production includes nine mines and reconciles to 46.9 tonnes',()=>{
 const portfolio=readFileSync(root+'portfolio.js','utf8');
 const values=[...portfolio.matchAll(/v25:(\d+(?:\.\d+)?),v24:(?:null|\d+(?:\.\d+)?)/g)].map(x=>Number(x[1]));
 assert.equal(values.length,9);
 assert.ok(Math.abs(values.reduce((a,b)=>a+b,0)-46.9)<1e-8);
 for(const name of ['Buriticá','Rosebel','Norton Gold Fields','Aurora','Akyem','Raygorodok','Porgera'])assert.ok(portfolio.includes(name));
 assert.match(html,/id="mine-bars"/);
 assert.match(html,/id="mine-donut"/);
 assert.match(html,/audited FY2025 figures/i);
 assert.match(portfolio,/FY2024 comparator/i);
});
test('award loss frequencies derive from private share count and exact model observations',()=>{
 const risk=readFileSync(root+'risk-award.js','utf8');
 const quant=readFileSync(root+'quant.js','utf8');
 assert.match(html,/id="award-quant-chart"/);
 assert.match(html,/id="award-quant-loss"/);
 assert.match(quant,/nov2029Samples:buckets\[2\]\.slice\(\)/);
 assert.match(risk,/samples\.map\(price=>\(price-strike\)\*shares\)/);
 assert.match(risk,/payoffs\.filter\(x=>x<0\)/);
 assert.doesNotMatch(risk,/fetch\(|localStorage|sessionStorage|XMLHttpRequest/);
 assert.match(html,/<input id="shares"[^>]*value=""/);
});

test("User-observed price stays local and cannot replace exchange history",()=>{
 const manual=readFileSync(root+'manual-quote.js','utf8');
 const app=readFileSync(root+'app.js','utf8');
 assert.match(html,/id="manual-quote-form"/);
 assert.match(html,/id="manual-quote-award"/);
 assert.match(html,/src="\.\/manual-quote\.js"/);
 assert.match(manual,/zgi:manual-price/);
 assert.match(app,/zgi:manual-price/);
 assert.match(app,/USER-ENTERED REFERENCE/);
 assert.doesNotMatch(manual,/fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|sendBeacon|indexedDB/);
 assert.match(html,/This bridge does not fetch, scrape, store, publish or authenticate/);
});

test('daily source bar timestamps are not represented as final exchange trade times',()=>{
 assert.match(api,/barTimestampMeaning:interval==="1d"/);
 assert.match(api,/barTimeIsLastTrade:false/);
 assert.match(market,/function describeBarTime\(data\)/);
 assert.match(market,/HKT daily bar \(not last-trade time\)/);
 assert.match(analytics,/function sourceLabel\(data\)/);
 assert.match(analytics,/DAILY BAR • NOT TRADE TIME/);
});
