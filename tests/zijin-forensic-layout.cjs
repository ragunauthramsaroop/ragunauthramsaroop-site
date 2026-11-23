/* ZGI Forensic responsive-geometry audit.
 * Uses deterministic data fixtures only; must not be mistaken for market validation.
 * Saves viewport screenshots and machine-readable DOM geometry diagnostics.
 */
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const viewports=[
 {name:'mobile-360',width:360,height:780},
 {name:'mobile-390',width:390,height:844},
 {name:'mobile-430',width:430,height:932},
 {name:'tablet-768',width:768,height:1024},
 {name:'desktop-1024',width:1024,height:800},
 {name:'desktop-1440',width:1440,height:900},
 {name:'wide-1920',width:1920,height:1080}
];
const origin='http://127.0.0.1:4173/tools/zijin-2259/';
const ticker={stock:'2259.HK',parent:'2899.HK',gold:'GC=F'};
function fixture(symbol){
 const base=symbol==='2259.HK'?87:symbol==='2899.HK'?19:3510,step=symbol==='GC=F'?1.1:symbol==='2259.HK'?.14:.018;
 const bars=[];let i=0;
 const today=Math.floor(Date.now()/86400000)*86400000;
 const end=today-86400000+8*3600000;
 for(let t=end-410*86400000;t<=end;t+=86400000){
  const day=new Date(t).getUTCDay();if(day===0||day===6)continue;
  const c=base+i*step+Math.sin(i*.11)*base*.04+Math.cos(i*.08)*base*.016,o=c*(1+Math.cos(i*.13)*.004);
  bars.push({t:Math.floor(t/1000),o,h:Math.max(o,c)*1.012,l:Math.min(o,c)*.988,c,v:1300000+i*18300});
  i++;
 }
 return {ok:true,symbol,sourceSymbol:symbol,currency:symbol==='GC=F'?'USD':'HKD',regularMarketPrice:bars.at(-1).c,previousClose:bars.at(-2).c,change:bars.at(-1).c-bars.at(-2).c,changePercent:1,provider:'Yahoo Finance FORENSIC FIXTURE - NOT LIVE',interval:'1d',providerQuoteTime:new Date(bars.at(-1).t*1000).toISOString(),latestBarTime:new Date(bars.at(-1).t*1000).toISOString(),bars,dataDelay:'Mocked provider-delayed observations, never live'};
}
const report={generatedAt:new Date().toISOString(),scope:'Static mock-data responsive geometry test, not real exchange data or licensed feed',viewports:[],issues:[],summary:{}};
function intersect(a,b){
 const dx=Math.min(a.right,b.right)-Math.max(a.left,b.left),dy=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
 return dx>2&&dy>2?Math.round(dx*dy):0;
}
async function auditViewport(browser,{name,width,height}){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/market?**',route=>{
   const sym=new URL(route.request().url()).searchParams.get('symbol');
   return route.fulfill({status:sym&&['2259.HK','2899.HK','GC=F'].includes(sym)?200:400,contentType:'application/json',body:JSON.stringify(fixture(sym||'2259.HK'))});
 });
 await page.route('**/api/news',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,source:'mock',checkedAt:'2026-11-13T08:00:00Z',articles:[]})}));
 await page.route('**/api/licensed-quote?**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,status:'not_connected',message:'Unauthorised'})}));
 await page.goto(origin,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>!!document.querySelector('#quant-fan-chart svg')&&!!document.querySelector('#mine-donut svg')&&!!document.querySelector('#stress-heatmap button'),null,{timeout:30000});
 await page.locator('#shares').fill('1000');
 // Intentionally exercise long award amounts and numerical line wrapping.
 await page.locator('#model-gold').evaluate(el=>{el.value='9000';el.dispatchEvent(new Event('input',{bubbles:true}))});
 await page.waitForTimeout(300);
 const stats=await page.evaluate(()=>{
  const pick=s=>Array.from(document.querySelectorAll(s));
  const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
  const view=window.innerWidth;
  const edgeTolerance=2;
  const intersectRect=(a,b)=>{
    const dx=Math.min(a.right,b.right)-Math.max(a.left,b.left),dy=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
    return Math.max(0,dx)*Math.max(0,dy);
  };
  const inspect=['.topbar','.hero-heading','.integrity-strip','.realtime-access','.metric-row','.market-live-strip','.overview-grid','.quant-kpis','.quant-main','.quant-two','.dynamic-model-grid','.comparison-panel','.stress-panel','.award-risk-panel','.eligibility-panel','.news-live','.mine-kpis','.mine-main','.evidence-grid','.data-ledger-panel','.footer'];
  const overrun=[],clipped=[],badText=[];
  for(const sel of inspect){
   for(const el of pick(sel)){
    const r=rect(el);
    if(r.width<1||r.height<1)continue;
    if(r.right>view+edgeTolerance||r.left< -edgeTolerance)overrun.push({selector:sel,extent:Math.round(r.right-view),left:Math.round(r.left),width:Math.round(r.width)});
    const st=getComputedStyle(el);
    if(st.overflowX==='hidden'&&el.scrollWidth>el.clientWidth+4)clipped.push({selector:sel,excess:el.scrollWidth-el.clientWidth});
   }
  }
  for(const e of pick('h1,h2,h3,.metric-value,.metric-eyebrow,.metric-foot,.quant-kpi strong,.source-tag,.realtime-option .button,.nav-item,.quant-corr-row strong,.ledger-price,.evidence-card strong,.award-quant-kpis strong')){
   const st=getComputedStyle(e),r=rect(e);
   if(r.height<=0||r.width<=0)continue;
   if(e.scrollWidth>e.clientWidth+4&&st.overflowX!=='visible'&&st.overflowX!=='auto')badText.push({text:e.textContent.trim().slice(0,48),class:e.className,excess:e.scrollWidth-e.clientWidth,overflow:st.overflowX});
  }
  const gridOverlaps=[];
  for(const sel of ['.metric-row','.overview-grid','.quant-kpis','.quant-main','.quant-two','.dynamic-model-grid','.evidence-grid','.mine-kpis','.mine-main','.realtime-options']){
   for(const parent of pick(sel)){
    const children=[...parent.children].filter(el=>getComputedStyle(el).display!=='none').map(rect);
    for(let a=0;a<children.length;a++)for(let b=a+1;b<children.length;b++){
     const l=Math.min(children[a].right,children[b].right)-Math.max(children[a].left,children[b].left);
     const h=Math.min(children[a].bottom,children[b].bottom)-Math.max(children[a].top,children[b].top);
     if(l>2&&h>2)gridOverlaps.push({selector:sel,children:[a,b],overlapPixels:Math.round(l*h)});
    }
   }
  }
  const touchTargets=pick('button,select,a').filter(e=>{
    const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.width<24&&r.height<24&&getComputedStyle(e).visibility!=='hidden';
  }).slice(0,20).map(e=>({tag:e.tagName,text:e.textContent.trim().slice(0,35),size:`${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`}));
  const heroTitle=document.querySelector('.hero-heading h1'),orbit=document.querySelector('.gold-orbit');
  const orbitVisible=!!orbit&&getComputedStyle(orbit).display!=='none';
  const heroOverlap=orbitVisible&&heroTitle&&intersectRect(heroTitle.getBoundingClientRect(),orbit.getBoundingClientRect())>20;
  const main=document.querySelector('main'),topbar=document.querySelector('.topbar');
  return {viewport:view,documentScrollWidth:document.documentElement.scrollWidth,bodyScrollWidth:document.body.scrollWidth, mainWidth:Math.round(main?.getBoundingClientRect().width||0),topbarWidth:Math.round(topbar?.getBoundingClientRect().width||0),overrun,clipped,badText,gridOverlaps,touchTargets,sectionCount:document.querySelectorAll('main>.section').length,headingCount:document.querySelectorAll('h1').length,heroOverlap,brokenAnchorTargets:[...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash),horizontalScrollArea:[...document.querySelectorAll('.stress-grid-scroll')].map(x=>({scrollWidth:x.scrollWidth,clientWidth:x.clientWidth}))};
 });
 let data={name,width,height,...stats,runtimeErrors:errors};
 const isMobile=width<=430;
 if(stats.documentScrollWidth>width+2||stats.bodyScrollWidth>width+2)report.issues.push({severity:'high',viewport:name,type:'page-horizontal-overflow',extent:Math.max(stats.documentScrollWidth,stats.bodyScrollWidth)-width});
 for(const o of stats.overrun)report.issues.push({severity:'medium',viewport:name,type:'offscreen-container',...o});
 for(const o of stats.clipped)report.issues.push({severity:'medium',viewport:name,type:'clipped-container',...o});
 for(const o of stats.badText)report.issues.push({severity:'medium',viewport:name,type:'clipped-text',...o});
 for(const o of stats.gridOverlaps)report.issues.push({severity:'high',viewport:name,type:'overlapping-grid',...o});
 if(stats.heroOverlap)report.issues.push({severity:'high',viewport:name,type:'hero-title-art-collision'});
 if(errors.length)report.issues.push({severity:'high',viewport:name,type:'javascript-runtime-errors',errors});
 if(stats.headingCount!==1)report.issues.push({severity:'medium',viewport:name,type:'heading-hierarchy',h1s:stats.headingCount});
 if(stats.brokenAnchorTargets.length)report.issues.push({severity:'medium',viewport:name,type:'invalid-navigation-anchors',targets:stats.brokenAnchorTargets});
 // Capture a separate viewport drawer reference, then return to the top for
 // a correct full-page screenshot. Sticky UI otherwise appears midway down.
 fs.mkdirSync('test-results/zijin-forensic',{recursive:true});
 if(isMobile){
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.locator('#menu-toggle').click();
   if(name==='mobile-390')await page.screenshot({path:'test-results/zijin-forensic/mobile-390-drawer.png',fullPage:false,animations:'disabled',timeout:30000});
   await page.keyboard.press('Escape');
 }
 await page.evaluate(()=>{
   window.scrollTo({top:0,left:0,behavior:'instant'});
   const qa=document.createElement('div');qa.textContent='FORENSIC QA • SYNTHETIC MARKET FIXTURES • NOT LIVE PRICES';
   qa.setAttribute('style','position:fixed;top:0;left:0;right:0;background:#7a2c2c;color:#fff;font:bold 11px system-ui;padding:8px 12px;text-align:center;z-index:99999;pointer-events:none;letter-spacing:.05em');
   document.body.append(qa);
 });
 await page.waitForTimeout(150);
 await page.screenshot({path:'test-results/zijin-forensic/'+name+'.png',fullPage:true,animations:'disabled',timeout:30000});
 await page.close();report.viewports.push(data);
 console.log('VIEWPORT '+name+' width='+width+' scrollWidth='+stats.documentScrollWidth+' offscreen='+stats.overrun.length+' clipping='+stats.clipped.length+' textClip='+stats.badText.length+' overlaps='+stats.gridOverlaps.length+' JS='+errors.length);
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const p of viewports)await auditViewport(browser,p);
 }finally{await browser.close()}
 report.summary={totalIssues:report.issues.length,high:report.issues.filter(x=>x.severity==='high').length,medium:report.issues.filter(x=>x.severity==='medium').length,tested:viewports.length};
 fs.mkdirSync('test-results/zijin-forensic',{recursive:true});
 fs.writeFileSync('test-results/zijin-forensic/report.json',JSON.stringify(report,null,2));
 console.log('FORENSIC REPORT '+JSON.stringify(report.summary));
 for(const issue of report.issues.slice(0,70))console.log('ISSUE '+JSON.stringify(issue));
 // Workflow does not fail solely for minor text issues; output is for root cause analysis.
 if(report.summary.high>0)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
