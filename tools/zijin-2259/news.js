/* News headlines are source-attributed Google News search RSS, not HKEX filings.
 * Show timestamps and errors. Never fabricate articles or reuse archived content as current.
 */
(()=>{"use strict";
const root=document.getElementById("issuer-news-feed"),status=document.getElementById("news-provider-status");
if(!root||!status)return;
const endpoint=(location.hostname.endsWith(".vercel.app")||location.hostname==="localhost"?"":"https://zijin-2259-intelligence.vercel.app")+"/api/news";
const clock=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Hong_Kong",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
let busy=false;
async function reload(){
 if(busy)return;busy=true;
 status.textContent="Checking external source. Publication times are independent of exchange quote times.";
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9500);
 try{
   const response=await fetch(endpoint,{signal:controller.signal,cache:"no-store"});
   if(!response.ok)throw new Error("RSS bridge HTTP "+response.status);
   const feed=await response.json();
   if(!feed.ok||!Array.isArray(feed.articles))throw new Error("Invalid source response");
   root.replaceChildren();
   if(feed.articles.length===0){
     const empty=document.createElement("p");empty.className="news-empty";empty.textContent="No verified matching headlines returned by this source. Consult official HKEX disclosures below.";root.append(empty);
   }
   for(const article of feed.articles){
     if(!article||typeof article.title!=="string"||typeof article.url!=="string")continue;
     const url=new URL(article.url);
     if(url.protocol!=="https:"||url.hostname!=="news.google.com")continue;
     const link=document.createElement("a");link.href=article.url;link.target="_blank";link.rel="noopener noreferrer";link.className="issuer-news-item";
     const title=document.createElement("strong");title.textContent=article.title.slice(0,240);
     const meta=document.createElement("small");
     const date=new Date(article.publishedAt);meta.textContent=(article.source||"Google News")+" · "+(Number.isFinite(date.getTime())?clock.format(date)+" HKT":"Publication date unavailable");
     const arrow=document.createElement("span");arrow.textContent="↗";arrow.setAttribute("aria-hidden","true");link.append(title,meta,arrow);root.append(link);
   }
   const date=new Date(feed.checkedAt);
   status.textContent="Google News search RSS · Checked "+(Number.isFinite(date.getTime())?clock.format(date)+" HKT":"now")+". Third-party press, not official issuer disclosures.";
 }catch{
   root.replaceChildren();const msg=document.createElement("p");msg.className="news-empty";msg.textContent="The external news feed is currently unavailable. No headlines have been generated. Use the verified source links below.";root.append(msg);
   status.textContent="News source unavailable · Official HKEX disclosure link remains available.";
 }finally{clearTimeout(timeout);busy=false}
}
document.getElementById("refresh-news-now")?.addEventListener("click",reload);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")reload()});
setInterval(()=>{if(document.visibilityState==="visible")reload()},600000);
reload();
})();