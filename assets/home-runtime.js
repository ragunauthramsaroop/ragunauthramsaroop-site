(()=>{
"use strict";
const addScript=src=>{if(document.querySelector('script[src="'+src+'"]'))return;const s=document.createElement("script");s.src=src;s.async=true;document.head.appendChild(s)};
const idle=(fn,timeout)=>{if("requestIdleCallback" in window)requestIdleCallback(fn,{timeout});else setTimeout(fn,Math.min(timeout,900))};
addEventListener("load",()=>{
  if("serviceWorker" in navigator)navigator.serviceWorker.register("/service-worker.js",{updateViaCache:"none"}).catch(()=>{});
  setTimeout(()=>idle(()=>addScript("/assets/accessibility.js"),1200),700);
  setTimeout(()=>idle(()=>addScript("/tools/assets/analytics-loader.js"),1200),3000);
},{once:true});
})();