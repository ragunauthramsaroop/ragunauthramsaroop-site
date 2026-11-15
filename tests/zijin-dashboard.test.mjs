import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root='tools/zijin-2259/';
const html=readFileSync(root+'index.html','utf8');
const css=readFileSync(root+'styles.css','utf8');
const app=readFileSync(root+'app.js','utf8');
const market=readFileSync(root+'markets.js','utf8');
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
 assert.match(html,/Baseline production is 59\.2 tonnes/);
 assert.match(html,/historical reference assumptions/);
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
