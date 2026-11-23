import test from "node:test";
import assert from "node:assert/strict";
import Gate from "../tools/zijin-2259/source-gate.js";
const NOW=Date.parse("2026-11-23T15:00:00.000Z");
const when=(days)=>new Date(NOW-days*86400000).toISOString();
function fixture(symbol="2259.HK",days=1){
 const time=Date.parse(when(days))/1000;
 const currency=symbol==="GC=F"?"USD":"HKD";
 return {ok:true,symbol,sourceSymbol:symbol,currency,interval:"1d",
  provider:"Yahoo Finance chart (unofficial, delayed)",
  dataDelay:"Provider/exchange delayed; not licensed real-time HKEX data",
  regularMarketPrice:120,providerQuoteTime:when(days),latestBarTime:when(days),
  bars:[{t:time-86400,o:110,h:115,l:109,c:113,v:10000},
        {t:time,o:117,h:125,l:116,c:120,v:14000}]};
}
test("instrument identity, delayed source, final close, and sorted OHLC are mandatory",()=>{
 const valid=fixture();
 assert.equal(Gate.assessFeed(valid,"2259.HK",NOW).usable,true);
 assert.equal(Gate.assessFeed({...valid,sourceSymbol:"AAPL"},"2259.HK",NOW).usable,false);
 assert.equal(Gate.assessFeed({...valid,currency:"USD"},"2259.HK",NOW).usable,false);
 assert.equal(Gate.assessFeed({...valid,provider:"unknown"},"2259.HK",NOW).usable,false);
 assert.equal(Gate.assessFeed({...valid,regularMarketPrice:125},"2259.HK",NOW).usable,false);
 assert.equal(Gate.assessFeed({...valid,bars:[valid.bars[1],valid.bars[0]]},"2259.HK",NOW).usable,false);
 assert.equal(Gate.assessFeed({...valid,bars:[valid.bars[0],{...valid.bars[1],h:100}]},"2259.HK",NOW).usable,false);
});
test("weekends allowed; stale after seven days; future timestamp refused",()=>{
 assert.equal(Gate.assessFeed(fixture("2259.HK",3),"2259.HK",NOW).usable,true);
 assert.equal(Gate.assessFeed(fixture("2259.HK",6),"2259.HK",NOW).state,"older");
 assert.equal(Gate.assessFeed(fixture("2259.HK",8),"2259.HK",NOW).usable,false);
 assert.equal(Gate.assessFeed(fixture("2259.HK",-1),"2259.HK",NOW).usable,false);
});
test("no archived or malformed observations enter the valuation gate",()=>{
 assert.equal(Gate.assessFeed({...fixture(),archive:true},"2259.HK",NOW).usable,false);
 assert.equal(Gate.assessFeed({...fixture(),ok:false},"2259.HK",NOW).usable,false);
 assert.equal(Gate.assessFeed({...fixture(),providerQuoteTime:when(2)},"2259.HK",NOW).usable,false);
 assert.equal(Gate.assessPair({stock:fixture(),gold:fixture("GC=F",2)},NOW).usable,true);
 assert.equal(Gate.assessPair({stock:fixture(),gold:fixture("GC=F",9)},NOW).usable,false);
 assert.equal(Gate.assessPair({stock:fixture(),gold:null},NOW).usable,false);
});
test("missing and zero volume are distinct valid values; negative volume is invalid",()=>{
 let v=fixture();
 v.bars[1].v=null;
 assert.equal(Gate.assessFeed(v,"2259.HK",NOW).usable,true);
 v.bars[1].v=0;
 assert.equal(Gate.assessFeed(v,"2259.HK",NOW).usable,true);
 v.bars[1].v=-1;
 assert.equal(Gate.assessFeed(v,"2259.HK",NOW).usable,false);
});
