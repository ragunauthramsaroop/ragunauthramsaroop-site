import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html=readFileSync('tools/zijin-2259/index.html','utf8');
const js=readFileSync('tools/zijin-2259/app.js','utf8');
const markets=readFileSync('tools/zijin-2259/markets.js','utf8');
const api=readFileSync('tools/zijin-2259/api/market.js','utf8');
const css=readFileSync('tools/zijin-2259/styles.css','utf8');
test('Hong Kong identity remains explicit and unrelated Apple fallback never renders',()=>{
  assert.match(html,/HKEX:2259/);assert.match(html,/HKEX:2899/);
  assert.match(html,/2259\.HK/);assert.match(html,/2899\.HK/);
  assert.doesNotMatch(html,/embed-widget-|NASDAQ:AAPL|Apple Inc|OANDA:XAUUSD/);
  assert.doesNotMatch(markets,/NASDAQ:AAPL|Apple Inc|embed-widget-/);
});
test('separate native charts and downloadable scenario chart are present',()=>{
  for(const id of ['market-chart','stock-quote','gold-chart','parent-chart','native-technicals','scenario-chart']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/data-price-range="1y"/);
  assert.match(html,/data-chart-style="candles"/);
  assert.match(markets,/renderMain/);
  assert.match(js,/download='zijin-2259/);
});
test('public stock feed explicitly discloses provider delays and quotes are timestamped',()=>{
  assert.match(html,/YAHOO FINANCE · DELAYED/);
  assert.match(markets,/providerQuoteTime/);
  assert.match(markets,/data\.symbol!==symbol/);
  assert.match(api,/sourceSymbol:meta\.symbol/);
  assert.match(api,/exchangeTimezone/);
  assert.match(api,/dataDelay:"Provider\/exchange delayed/);
  assert.match(api,/ohlc\.at\(-2\)\.c/);
  assert.doesNotMatch(api,/chartPreviousClose\?\?/);
});
test('market bridge restricts symbols and never substitutes a different market',()=>{
  assert.match(api,/\["2259\.HK"/);assert.match(api,/\["2899\.HK"/);assert.match(api,/\["GC=F"/);
  assert.match(api,/actualSymbol!==symbol\.toUpperCase\(\)/);
  assert.match(api,/Unsupported symbol or range/);
  assert.match(api,/Market-data provider unavailable/);
  assert.match(markets,/No other security is substituted/);
});
test('gold benchmark is transparently COMEX futures rather than spot XAUUSD',()=>{
  assert.match(html,/Gold futures benchmark/);
  assert.match(html,/COMEX gold futures \(GC=F\) are a proxy, NOT spot XAU\/USD/);
  assert.match(markets,/load\("GC=F","6mo"\)/);
  assert.match(api,/gold_futures/);
});
test('archived fallback is conspicuously dated and never presented as a live quote',()=>{
  assert.match(markets,/ARCHIVED 13 NOV 2026 • PROVIDER UNAVAILABLE/);
  assert.match(markets,/archive:true/);
  assert.match(markets,/2026-11-13/);
  assert.match(html,/HISTORICAL FAIR-VALUE REFERENCE/);
});
test('personal share count defaults blank, remains in local memory and costs include shortfall',()=>{
  assert.match(html,/<input id="shares"[^>]*value=""/);
  assert.doesNotMatch(js,/localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest/);
  assert.match(js,/shareCount<=0/);
  assert.match(js,/spread=value-cost/);
  assert.match(js,/net=spread-charges/);
  assert.match(js,/price<strike/);
});
test('charting and indicators use price bars only, without synthetic live prices',()=>{
  assert.match(markets,/fullRSI\(prices\)/);
  assert.match(markets,/fullMACD\(prices\)/);
  assert.match(markets,/svgLine\(prices/);
  assert.match(markets,/state\.stock=archiveStock\(\)/);
});
test('2027-2029 scenarios remain clearly hypothetical',()=>{
  assert.match(js,/values:\[95,88,80\]/);
  assert.match(js,/values:\[140,155,175\]/);
  assert.match(js,/values:\[185,230,275\]/);
  assert.match(html,/not analyst targets or probability-weighted forecasts/);
});
test('accessible, responsive controls and no automated trading',()=>{
  assert.match(html,/class="skip-link"/);
  assert.match(html,/<main id="main">/);
  assert.match(html,/aria-label="Market chart date range"/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(css,/prefers-reduced-motion/);
  assert.doesNotMatch(markets,/submitOrder|placeTrade|brokerageAPI/);
});
