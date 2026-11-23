import test from 'node:test';
import assert from 'node:assert/strict';
import {validateHome,validateMarket} from '../scripts/zijin-production-watch.mjs';
const home='<title>ZGI Intelligence | HKEX 2259</title><h1 id="main-title">Zijin Gold</h1><div id="live-kpi-2259"></div><meta name="robots" content="noindex,nofollow">';
const now=Date.parse('2026-11-23T12:00:00Z');
const bar=t=>({t,o:100,h:102,l:99,c:101,v:1000});
const data={
 ok:true,symbol:'2259.HK',sourceSymbol:'2259.HK',currency:'HKD',interval:'1d',
 barTimestampMeaning:'DAILY PRICE BAR LABEL; NOT LAST-TRADE TIME',barTimeIsLastTrade:false,
 dataDelay:'Provider/exchange delayed; not licensed real-time data',
 regularMarketPrice:101,
 bars:[bar(Date.parse('2026-11-19T08:00:00Z')/1000),bar(Date.parse('2026-11-20T08:00:00Z')/1000)],
 latestBarTime:'2026-11-20T08:00:00.000Z',providerQuoteTime:'2026-11-20T08:00:00.000Z'
};
test('dashboard identity and noindex are required',()=>{
 assert.match(validateHome(home),/confirmed/);
 assert.throws(()=>validateHome(home.replace('noindex,nofollow','index,follow')),/privacy/);
 assert.throws(()=>validateHome('<h1>Other site</h1>'),/identity/);
});
test('verified market close, source and symbol are required',()=>{
 assert.match(validateMarket(data,'2259.HK','HKD',now),/delayed bar/);
 assert.throws(()=>validateMarket({...data,symbol:'AAPL'},'2259.HK','HKD',now),/mismatch/);
 assert.throws(()=>validateMarket({...data,currency:'USD'},'2259.HK','HKD',now),/mismatch/);
 assert.throws(()=>validateMarket({...data,regularMarketPrice:120},'2259.HK','HKD',now),/OHLC/);
});
test('future-dated, stale and reordered bars are rejected',()=>{
 assert.throws(()=>validateMarket(data,'2259.HK','HKD',Date.parse('2026-12-10T12:00:00Z')),/stale/);
 assert.throws(()=>validateMarket(data,'2259.HK','HKD',Date.parse('2026-11-19T12:00:00Z')),/future/);
 assert.throws(()=>validateMarket({...data,bars:[data.bars[1],data.bars[0]]},'2259.HK','HKD',now),/Unordered/);
});
test('unqualified real-time-like quote labels are rejected',()=>{
 assert.throws(()=>validateMarket({...data,dataDelay:'LIVE TICKS'},'2259.HK','HKD',now),/Delayed-source/);
});

test('monitor rejects provider identity spoofing and unsupported last-trade claims',()=>{
 assert.throws(()=>validateMarket({...data,sourceSymbol:'AAPL'},'2259.HK','HKD',now),/provider ticker mismatch/);
 assert.throws(()=>validateMarket({...data,barTimeIsLastTrade:true},'2259.HK','HKD',now),/semantics/);
 assert.throws(()=>validateMarket({...data,barTimestampMeaning:'LAST TRADE TICK'},'2259.HK','HKD',now),/falsely presented/);
 assert.throws(()=>validateMarket({...data,providerQuoteTime:'2026-11-23T08:00:00Z'},'2259.HK','HKD',now),/source timestamp mismatch/);
});
test('monitor treats missing volume as unknown but rejects negative and impossible OHLC',()=>{
 assert.match(validateMarket({...data,bars:data.bars.map(b=>({...b,v:null}))},'2259.HK','HKD',now),/delayed bar/);
 assert.throws(()=>validateMarket({...data,bars:[{...data.bars[0],v:-5},data.bars[1]]},'2259.HK','HKD',now),/Invalid OHLC/);
 assert.throws(()=>validateMarket({...data,bars:[{...data.bars[0],h:98},data.bars[1]]},'2259.HK','HKD',now),/Invalid OHLC/);
});
