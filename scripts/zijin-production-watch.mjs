// Read-only production monitor. Quote bars remain provider-delayed.
import {mkdirSync,writeFileSync,appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const BASE='https://zijin-2259-intelligence.vercel.app';
const SYMBOLS=[['2259.HK','HKD'],['2899.HK','HKD'],['GC=F','USD']];
export function validateHome(html){
 if(typeof html!=='string'||!html.includes('<title>ZGI Intelligence')||
  !html.includes('id="main-title"')||!html.includes('id="live-kpi-2259"')||
  !html.includes('id="motion-follow" aria-pressed="true"')||
  !html.includes('OPEN AUTHORISED LIVE SNAPSHOT')||
  !html.includes('id="issuer-disclosures"')||
  !html.includes('issuer-registry.js')||
  !html.includes('issuer-ui.js')||
  !html.includes('name="robots" content="noindex,nofollow"'))
  throw Error('Dashboard identity, privacy or market KPI markup missing');
 return 'Dashboard identity and noindex confirmed';
}
export function validateMarket(data,symbol,currency,now=Date.now()){
 if(!data||data.ok!==true||data.symbol!==symbol||data.currency!==currency)
  throw Error('Market instrument or currency mismatch');
 if(!String(data.dataDelay||'').toLowerCase().includes('delayed'))
  throw Error('Delayed-source declaration missing');
 if(String(data.sourceSymbol||'').toUpperCase()!==symbol.toUpperCase())
  throw Error('Underlying provider ticker mismatch');
 if(data.barTimeIsLastTrade!==false||typeof data.barTimestampMeaning!=='string')
  throw Error('Source bar time semantics missing');
 if(data.interval==='1d'&&!data.barTimestampMeaning.includes('DAILY PRICE BAR LABEL'))
  throw Error('Daily bar falsely presented as trade timestamp');
 if(!Array.isArray(data.bars)||data.bars.length<2)throw Error('Insufficient OHLC bars');
 const last=data.bars.at(-1),price=Number(data.regularMarketPrice);
 if(!Number.isFinite(price)||price<=0||!last||!Number.isFinite(last.t)||
    !Number.isFinite(last.c)||last.c<=0||Math.abs(last.c-price)>Math.max(0.000001,price*0.000001))
  throw Error('Displayed price does not match final verified OHLC close');
 if(data.bars.some((bar,index)=>!Number.isFinite(bar.t)||
    (index>0&&bar.t<=data.bars[index-1].t)))
  throw Error('Unordered or invalid bar timestamps');
 if(data.bars.some(bar=>![bar.o,bar.h,bar.l,bar.c].every(Number.isFinite)||
    bar.l<=0||bar.h<bar.l||bar.o<bar.l*.995||bar.o>bar.h*1.005||
    bar.c<bar.l*.995||bar.c>bar.h*1.005||
    (bar.v!==null&&(!Number.isFinite(bar.v)||bar.v<0))))
  throw Error('Invalid OHLC price bounds or trading volume');
 const asOf=Date.parse(data.latestBarTime);
 const quoteAsOf=Date.parse(data.providerQuoteTime);
 if(!Number.isFinite(quoteAsOf)||Math.abs(quoteAsOf-asOf)>60000)
  throw Error('Provider daily-bar source timestamp mismatch');
 if(!Number.isFinite(asOf)||Math.abs(asOf-last.t*1000)>60000||
    asOf>now+3600000||now-asOf>7*86400000)
  throw Error('Market observation stale, future dated or inconsistent');
 return symbol+' '+currency+' delayed bar '+new Date(asOf).toISOString();
}
export function validateIssuerRegistry(source){
 if(typeof source!=='string'||!source.includes('ZGIIssuerRegistry')||
    !source.includes('REGISTRY_DATE="2026-11-23"')||
    !source.includes('2026111201384.pdf')||
    !source.includes('2026111300646.pdf')||
    !source.includes('https://www1.hkexnews.hk')||
    !source.includes('issuedPctOfOpening')||
    !source.includes('2679956300'))
  throw Error('Curated HKEX disclosure registry or equity issuance reconciliation missing');
 return 'Issuer documents, editorial date and share-capital evidence verified';
}
export function validateIssuerUI(source){
 if(typeof source!=='string'||!source.includes('issuer-filings-list')||
    !source.includes('issuer-filing-search')||
    !source.includes('filterFilings')||
    !source.includes('issuer-export')||
    source.includes('localStorage')||source.includes('sessionStorage'))
  throw Error('Disclosure search or local-only export missing');
 return 'First-party disclosure search and local export served';
}
async function check(path,name,expectedStatus,inspect,required,results){
 try{
  const response=await fetch(new URL(path,BASE),{
   signal:AbortSignal.timeout(18000),
   headers:{Accept:'application/json,text/html,text/javascript;q=0.8'}
  });
  if(response.status!==expectedStatus)throw Error('HTTP '+response.status+' instead of '+expectedStatus);
  const raw=await response.text();
  if(raw.length>2000000)throw Error('Response exceeds size limit');
  results.push({name,status:'PASS',required,detail:inspect(raw)});
 }catch(error){
  results.push({name,status:required?'FAIL':'WARN',required,detail:String(error.message||error).slice(0,220)});
 }
}
export async function auditProduction(){
 const results=[];
 await check('/','Public dashboard',200,validateHome,true,results);
 await check('/issuer-registry.js','Official issuer source registry',200,validateIssuerRegistry,true,results);
 await check('/issuer-ui.js','Issuer research search UI',200,validateIssuerUI,true,results);
 await check('/issuer-dossier.css','Issuer research styles',200,raw=>{
   if(!raw.includes('.issuer-dossier')||!raw.includes('@media(max-width:720px)'))
    throw Error('Responsive issuer disclosure styling unavailable');
   return 'Source-linked responsive issuer research styling served';
 },true,results);
 await check('/markets.js','Market chart script',200,raw=>{
  if(!raw.includes('zgi:market'))throw Error('Market events missing');
  return 'First-party script served';
 },true,results);
 for(const [symbol,currency] of SYMBOLS){
  const qs=new URLSearchParams({symbol,range:'1y',interval:'1d'});
  await check('/api/market?'+qs.toString(),symbol+' market bridge',200,
   raw=>validateMarket(JSON.parse(raw),symbol,currency),true,results);
 }
 const intradayQS=new URLSearchParams({symbol:'2259.HK',range:'1mo',interval:'15m'});
 await check('/api/market?'+intradayQS.toString(),'2259.HK delayed 15-minute bridge',200,raw=>{
  const data=JSON.parse(raw);
  if(data.interval!=='15m')throw Error('Intraday endpoint did not return 15-minute bars');
  return validateMarket(data,'2259.HK','HKD');
 },true,results);
  await check('/api/market?symbol=AAPL','Unsupported symbol guard',400,raw=>{
  if(JSON.parse(raw).ok!==false)throw Error('Invalid rejection');
  return 'Unrelated symbols rejected';
 },true,results);
 await check('/api/licensed-quote?symbol=AAPL','Licensed feed guard',400,raw=>{
  if(JSON.parse(raw).ok!==false)throw Error('Invalid rejection');
  return 'Unlicensed symbol rejected';
 },true,results);
 await check('/api/news','Optional third-party headlines',200,raw=>{
  const data=JSON.parse(raw);
  if(data.ok!==true||!Array.isArray(data.articles))throw Error('Malformed headlines');
  return 'Feed response valid';
 },false,results);
 const failures=results.filter(x=>x.status==='FAIL');
 const report={checkedAt:new Date().toISOString(),target:BASE,failedRequired:failures.length,results};
 mkdirSync('audit/zgi-production',{recursive:true});
 writeFileSync('audit/zgi-production/health.json',JSON.stringify(report,null,2)+'\n');
 const summary='# ZGI production health\n\nChecked '+report.checkedAt+
  '\n\n| Check | Result | Evidence |\n|---|---|---|\n'+results.map(x=>
   '| '+x.name+' | '+x.status+' | '+x.detail.replace(/[|\r\n]/g,' ')+' |').join('\n')+
  '\n\n'+(failures.length?'Required checks failed: '+failures.length:'All required checks passed. Prices are delayed, not live.')+'\n';
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
 process.stdout.write(summary);
 if(failures.length)process.exitCode=1;
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 auditProduction().catch(error=>{console.error(error.message);process.exitCode=1});
}
