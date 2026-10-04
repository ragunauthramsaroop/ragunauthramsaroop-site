/* Fast homepage shell with cache-first home navigation and background refresh. */
const V="rr-public-v14";
const CORE=["/assets/home-runtime.js","/assets/accessibility.css","/favicon-96.png"];
const STATIC_FIRST=new Set(["/assets/home-runtime.js","/assets/accessibility.css","/assets/preview.png","/favicon-96.png"]);
const MAX_DYNAMIC_ENTRIES=60;

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(V)
      .then(cache=>Promise.allSettled(CORE.map(url=>cache.add(url))))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith("rr-public-v")&&k!==V).map(k=>caches.delete(k)));
    try{
      if(self.registration&&self.registration.navigationPreload)await self.registration.navigationPreload.enable();
    }catch{}
    await self.clients.claim();
  })());
});

async function remember(cache,request,response){
  if(!response||!response.ok)return;
  try{
    await cache.put(request,response.clone());
    const keys=await cache.keys();
    if(keys.length>MAX_DYNAMIC_ENTRIES){
      for(const key of keys.slice(0,keys.length-MAX_DYNAMIC_ENTRIES)){
        if(!CORE.includes(new URL(key.url).pathname))await cache.delete(key);
      }
    }
  }catch{}
}

async function fromNetwork(request,event,cache){
  let response=null;
  try{response=event.preloadResponse?await event.preloadResponse:null}catch{}
  if(!response)response=await fetch(request);
  if(response&&response.ok){
    const url=new URL(request.url);
    const cacheKey=(url.pathname==="/"||url.pathname==="/index.html")?"/":request;
    event.waitUntil(remember(cache,cacheKey,response.clone()));
  }
  return response;
}

async function navigation(request,event){
  const cache=await caches.open(V);
  const url=new URL(request.url);
  const isHome=url.pathname==="/"||url.pathname==="/index.html";

  if(isHome){
    const cached=await cache.match("/",{ignoreSearch:true});
    if(cached){
      event.waitUntil(fromNetwork(request,event,cache).catch(()=>null));
      return cached;
    }
  }

  try{
    const fresh=await fromNetwork(request,event,cache);
    if(fresh)return fresh;
  }catch{}

  const exact=await cache.match(isHome?"/":request,{ignoreSearch:true});
  if(exact)return exact;
  return new Response(
    '<!doctype html><html lang="en"><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>Connection unavailable | Ragunauth Ramsaroop</title>'+
    '<style>body{margin:0;background:#f4f8f6;color:#17382d;font:17px/1.6 system-ui,sans-serif;display:grid;min-height:100vh;place-items:center}main{max-width:570px;margin:22px;padding:32px;border-radius:18px;background:white;box-shadow:0 12px 36px #17382d18}h1{margin-top:0;font-size:29px}a,button{display:inline-block;margin:8px 12px 0 0;padding:11px 18px;border:0;border-radius:9px;background:#12382c;color:white;font:700 15px system-ui;text-decoration:none;cursor:pointer}</style>'+
    '<main><h1>Connection unavailable</h1>'+
    '<p>This page has not loaded. Check your connection and retry. No other page has been substituted.</p>'+
    '<button onclick="location.reload()">Try again</button>'+
    '<a href="/">Home</a></main></html>',
    {status:503,statusText:"Offline",headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}}
  );
}

function validStaticResponse(response,pathname){
  if(!response||!response.ok)return false;
  const type=(response.headers.get("content-type")||"").toLowerCase();
  if(pathname.endsWith(".css"))return type.includes("text/css");
  if(pathname.endsWith(".js"))return type.includes("javascript");
  if(/\.(?:png|jpg|jpeg|webp|avif|svg|ico)$/.test(pathname))return type.includes("image/")||type.includes("svg");
  return true;
}

async function asset(request,cacheFirst,event){
  const cache=await caches.open(V);
  const pathname=new URL(request.url).pathname;
  if(cacheFirst){
    const hit=await cache.match(request,{ignoreSearch:true});
    if(hit&&validStaticResponse(hit,pathname))return hit;
    if(hit)await cache.delete(request);
  }
  try{
    const response=await fetch(request);
    if(validStaticResponse(response,pathname))event.waitUntil(remember(cache,request,response.clone()));
    return response;
  }catch{
    const hit=await cache.match(request,{ignoreSearch:true});
    return hit&&validStaticResponse(hit,pathname)?hit:Response.error();
  }
}

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(request.mode==="navigate"){
    event.respondWith(navigation(request,event));
  }else if(/\.(?:js|css|json|png|jpg|jpeg|webp|avif|svg|ico|woff2|wasm)$/.test(url.pathname)){
    const cacheFirst=url.pathname.startsWith("/_next/static/")||STATIC_FIRST.has(url.pathname);
    event.respondWith(asset(request,cacheFirst,event));
  }
});

self.addEventListener("message",event=>{
  if(event.data?.type!=="RR_PREFETCH"||!Array.isArray(event.data.urls))return;
  const urls=event.data.urls.filter(url=>typeof url==="string"&&url.startsWith("/")&&!url.startsWith("//")).slice(0,4);
  event.waitUntil(caches.open(V).then(cache=>Promise.allSettled(urls.map(url=>cache.add(url)))));
});
