import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const Q=require('../tools/zijin-2259/quant.js');
const historical=(length=245)=>{
 const a=[],first=Date.parse('2025-11-01T08:00:00Z')/1000;
 for(let i=0;i<length;i++){
  const c=100*Math.exp(i*.0006+Math.sin(i*.31)*.047+Math.cos(i*.063)*.07);
  a.push({t:first+i*86400,c,o:c*.998,h:c*1.012,l:c*.988,v:1000000+i*1000});
 }
 return a;
};
test('validated return math and finite historical risk',()=>{
 const bars=historical();
 const returns=Q.logReturns(bars);
 assert.equal(returns.length,bars.length-1);
 const risk=Q.histRisk(bars,60);
 assert.ok(risk.volAnnual>0);
 assert.ok(risk.maxDrawdown<=0);
 assert.ok(risk.observations>=200);
});
test('percentiles are monotone with interpolation',()=>{
 assert.equal(Q.quantile([1,2,3,4,5],.5),3);
 assert.equal(Q.quantile([1,3],.25),1.5);
 assert.equal(Q.quantile([],0.5),null);
});
test('block bootstrap is deterministic given seed, inputs and source data',()=>{
 const o={annualDrift:.08,volatilityFactor:1,simulations:500,blockSize:5,seed:1129,levels:[87.48,175,250]};
 const a=Q.bootstrappedFuture(historical(),o),b=Q.bootstrappedFuture(historical(),o);
 assert.equal(a.ok,true);
 assert.deepEqual(a.rows,b.rows);
 assert.equal(a.simulations,500);
 assert.equal(a.histograms.length,4);
 assert.equal(a.histograms[2].counts.reduce((s,x)=>s+x,0),500);
 assert.equal(a.rows[2].date,'2029-11-12');
 for(const row of a.rows){
  assert.ok(row.p05<=row.p25&&row.p25<=row.median&&row.median<=row.p75&&row.p75<=row.p95);
  assert.ok(row.p05>0);
  assert.ok(row.breakEvenProbability>=0&&row.breakEvenProbability<=1);
  assert.ok(row.thresholds['250']<=row.thresholds['175']);
 }
});
test('insufficient history is clearly rejected, no invented forward quote',()=>{
 const x=Q.bootstrappedFuture(historical(42),{simulations:500});
 assert.equal(x.ok,false);
 assert.equal(x.error,'INSUFFICIENT_HISTORY');
});
test('user volatility assumptions change simulated interval widths',()=>{
 const bars=historical();
 const low=Q.bootstrappedFuture(bars,{simulations:500,volatilityFactor:.5,seed:7});
 const high=Q.bootstrappedFuture(bars,{simulations:500,volatilityFactor:2,seed:7});
 assert.ok(high.rows[2].p95/high.rows[2].p05>low.rows[2].p95/low.rows[2].p05);
});
test('valuation stress grid anchors to observed stock and gold and responds to assumptions',()=>{
 const unchanged=Q.stressValuation(121.2,4000,4000,59.2,{costGrowth:0,multiple:1,dilution:0,years:0});
 assert.ok(Math.abs(unchanged-121.2)<1e-8);
 const greater=Q.stressValuation(121.2,4000,5000,75,{costGrowth:.04,multiple:1,dilution:0,years:3});
 assert.ok(greater>unchanged);
 const grid=Q.sensitivityGrid(121.2,4000,{costGrowth:.04,multiple:1,dilution:0,years:3});
 assert.equal(grid.values.length,5);
 assert.equal(grid.values[0].length,5);
 assert.ok(grid.values[4][4]>grid.values[0][0]);
});
test('lagged correlation computes only matched returns and requires minimum data',()=>{
 const bars=historical();
 const perfect=Q.matchedCorrelation(bars,bars,0);
 assert.ok(perfect.count>100);
 assert.ok(Math.abs(perfect.coefficient-1)<1e-10);
 assert.equal(Q.correlation([1,2,3],[1,2,3]),null);
});
test('walk-forward backtesting uses earlier windows and reports observed coverage',()=>{
 const x=Q.backtestCoverage(historical(),80,20);
 assert.ok(x.count>=20);
 assert.ok(x.coverage>=0&&x.coverage<=1);
 assert.equal(x.expectedCoverage,.8);
 assert.ok(x.windows.length<=8);
});
test('11 November 2029 is Sunday and next possible weekday is Nov 12',()=>{
 assert.equal(new Date('2029-11-11T00:00:00Z').getUTCDay(),0);
 assert.equal(new Date('2029-11-12T00:00:00Z').getUTCDay(),1);
});
