import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../tools/zijin-2259/api/market.js';

const unix=s=>Date.parse(s)/1000;
function fakeResponse(){
 const res={code:0,headers:{},payload:null};
 res.setHeader=(k,v)=>{res.headers[k]=v;return res};
 res.status=c=>{res.code=c;return res};
 res.json=x=>{res.payload=x;return res};
 res.end=()=>res;
 return res;
}
function upstream(phantom=true){
 const thursday=unix('2026-11-12T01:30:00.000Z');
 const friday=unix('2026-11-13T01:30:00.000Z');
 const monday=unix('2026-11-16T01:23:29.000Z');
 const timeline=phantom?[thursday,friday,monday]:[thursday,friday];
 const opens=phantom?[137.1,122.6,122.6]:[137.1,122.6];
 const highs=phantom?[137.5,127.4,127.4]:[137.5,127.4];
 const lows=phantom?[125.2,118.8,118.8]:[125.2,118.8];
 const closes=phantom?[126.5,121.2,121.2]:[126.5,121.2];
 const volumes=phantom?[11100487,6998761,6998761]:[11100487,6998761];
 return {chart:{result:[{meta:{symbol:'2259.HK',currency:'HKD',exchangeName:'HKG',regularMarketPrice:121.2,regularMarketTime:monday,previousClose:121.2},timestamp:timeline,indicators:{quote:[{open:opens,high:highs,low:lows,close:closes,volume:volumes}]}}]}};
}
async function withMockProvider(raw,callback){
 const saved=globalThis.fetch;
 globalThis.fetch=async()=>({ok:true,status:200,json:async()=>raw});
 try{return await callback()}finally{globalThis.fetch=saved}
}
test('pre-open Yahoo carry-forward does not create a fake session or erase previous-day fall',async()=>{
 await withMockProvider(upstream(true),async()=>{
  const res=fakeResponse();
  await handler({method:'GET',query:{symbol:'2259.HK',range:'1y',interval:'1d'}},res);
  assert.equal(res.code,200);
  const p=res.payload;
  assert.equal(p.ok,true);
  assert.equal(p.rejectedCarryForwardBars,1);
  assert.equal(p.bars.length,2);
  assert.equal(p.providerQuoteTime,'2026-11-13T01:30:00.000Z');
  assert.equal(p.latestBarTime,'2026-11-13T01:30:00.000Z');
  assert.equal(p.upstreamMetadataTime,'2026-11-16T01:23:29.000Z');
  assert.equal(p.observationType,'LAST VALID DAILY BAR');
  assert.equal(p.regularMarketPrice,121.2);
  assert.equal(p.previousClose,126.5);
  assert.ok(Math.abs(p.change+5.3)<0.0001);
  assert.ok(Math.abs(p.changePercent+4.189723)<0.001);
 });
});
test('source without duplicate bars retains the same settled close and change',async()=>{
 await withMockProvider(upstream(false),async()=>{
  const res=fakeResponse();
  await handler({method:'GET',query:{symbol:'2259.HK',range:'1y',interval:'1d'}},res);
  assert.equal(res.code,200);
  assert.equal(res.payload.rejectedCarryForwardBars,0);
  assert.equal(res.payload.bars.length,2);
  assert.equal(res.payload.previousClose,126.5);
 });
});
test('15-minute chart uses the final verified OHLC bar, not quote metadata time',async()=>{
 const raw=upstream(false);
 const data=raw.chart.result[0];
 data.meta.regularMarketPrice=999;
 data.meta.regularMarketTime=unix('2026-11-16T01:23:29.000Z');
 data.timestamp=[unix('2026-11-13T08:00:00.000Z'),unix('2026-11-13T08:15:00.000Z')];
 await withMockProvider(raw,async()=>{
  const res=fakeResponse();
  await handler({method:'GET',query:{symbol:'2259.HK',range:'1mo',interval:'15m'}},res);
  assert.equal(res.code,200);
  assert.equal(res.payload.regularMarketPrice,121.2);
  assert.equal(res.payload.providerQuoteTime,'2026-11-13T08:15:00.000Z');
  assert.equal(res.payload.upstreamMetadataTime,'2026-11-16T01:23:29.000Z');
  assert.equal(res.payload.observationType,'LAST VALID 15-MINUTE BAR');
  assert.match(res.headers['Cache-Control'],/s-maxage=60/);
 });
});
test('quote metadata refresh never overrides daily-bar HKEX price',async()=>{
 const data=upstream(false);data.chart.result[0].meta.regularMarketPrice=250;
 await withMockProvider(data,async()=>{
  const res=fakeResponse();
  await handler({method:'GET',query:{symbol:'2259.HK',range:'1y',interval:'1d'}},res);
  assert.equal(res.code,200);
  assert.equal(res.payload.regularMarketPrice,121.2);
  assert.equal(res.payload.observationType,'LAST VALID DAILY BAR');
 });
});

test('missing market volume remains unknown rather than a false zero-volume session',async()=>{
 const raw=upstream(false);
 raw.chart.result[0].indicators.quote[0].volume=[null,0];
 await withMockProvider(raw,async()=>{
  const res=fakeResponse();
  await handler({method:'GET',query:{symbol:'2259.HK',range:'1y',interval:'1d'}},res);
  assert.equal(res.code,200);
  assert.deepEqual(res.payload.bars.map(x=>x.v),[null,0]);
 });
});
