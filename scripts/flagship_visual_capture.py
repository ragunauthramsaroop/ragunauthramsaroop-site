#!/usr/bin/env python3
"""Render selected executive journeys at desktop/mobile for human review.

Screenshots are CI artifacts, not a claim of aesthetic approval or public deployment.
"""
import asyncio
import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"audit/flagship-edition-03"
ROUTES={
  "home":"/",
  "executive-profile":"/executive-profile/",
  "board-ceo":"/board-ceo-mode/",
  "recruiter-screen":"/recruiter-mode/",
  "recruiter-toolkit":"/recruiter-toolkit/"
}
VIEWPORTS={"desktop":(1440,900),"mobile":(390,844)}

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

async def run():
    OUT.mkdir(parents=True,exist_ok=True)
    handler=functools.partial(Quiet,directory=str(ROOT))
    server=ThreadingHTTPServer(("127.0.0.1",0),handler)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    base=f"http://127.0.0.1:{server.server_address[1]}"
    observations=[]
    try:
      async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=["--no-sandbox"])
        try:
          for key,route in ROUTES.items():
            for device,(width,height) in VIEWPORTS.items():
              ctx=await browser.new_context(viewport={"width":width,"height":height},device_scale_factor=1,service_workers="block",reduced_motion="reduce")
              page=await ctx.new_page()
              response=await page.goto(base+route,wait_until="domcontentloaded",timeout=25000)
              await page.wait_for_timeout(600)
              measured=await page.evaluate("""() => {
                const contrast=(foreground,background)=>{
                  const lum=value=>{
                    const numbers=value.match(/[0-9]*\\.?[0-9]+/g);
                    if(!numbers||numbers.length<3)return null;
                    const factor=value.trim().startsWith('color(srgb')?1:255;
                    const a=numbers.slice(0,3).map(v=>Number(v)/factor).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
                    return .2126*a[0]+.7152*a[1]+.0722*a[2];
                  };
                  const x=lum(foreground),y=lum(background);
                  if(x===null||y===null)return null;
                  return Math.round(100*(Math.max(x,y)+.05)/(Math.min(x,y)+.05))/100;
                };
                const header=document.querySelector('.shell .topbar');
                const bg=header?getComputedStyle(header).backgroundColor:null;
                const entries=header?[header.querySelector('.brand > div'),...header.querySelectorAll('.navlinks a:not(.contact-chip)'),header.querySelector('.menu-button')]:[];
                const contrastPairs=entries.filter(e=>e&&e.getClientRects().length).map(e=>contrast(getComputedStyle(e).webkitTextFillColor||getComputedStyle(e).color,bg)).filter(x=>x!==null);
                return {
                  h1:[...document.querySelectorAll('h1')].map(e=>e.innerText.trim()),
                  scrollWidth:document.documentElement.scrollWidth,
                  viewport:innerWidth,
                  css:[...document.querySelectorAll('link[rel=stylesheet]')].some(e=>e.href.includes('flagship-system-2026.css')),
                  cssLoaded:[...document.styleSheets].some(e=>e.href&&e.href.includes('flagship-system-2026.css')),
                  headerBackground:bg,
                  headerBrandFill:header?.querySelector('.brand>div')?getComputedStyle(header.querySelector('.brand>div')).webkitTextFillColor:null,
                  headerNavFill:header?.querySelector('.navlinks a')?getComputedStyle(header.querySelector('.navlinks a')).webkitTextFillColor:null,
                  bodyClass:document.body.className,
                  headerNavBackground:header?.querySelector('.nav')?getComputedStyle(header.querySelector('.nav')).backgroundColor:null,
                  headerTextColor:header?.querySelector('.brand>div')?getComputedStyle(header.querySelector('.brand>div')).color:null,
                  loadedStylesheets:[...document.styleSheets].filter(x=>x.href&&x.href.includes('flagship-system-2026.css')).map(x=>({href:x.href,rules:x.cssRules.length})),
                  badImages:[...document.querySelectorAll('img')].filter(e=>e.complete && !e.naturalWidth).map(e=>e.getAttribute('src')),
                  headerContrastMin:contrastPairs.length?Math.min(...contrastPairs):null
                };
              }""")
              name=f"{key}-{device}"
              await page.screenshot(path=str(OUT/f"{name}.png"),animations="disabled",full_page=False)
              observation={"route":route,"device":device,"status":response.status if response else None,**measured}
              observations.append(observation)
              await ctx.close()
        finally:
          await browser.close()
    finally:
      server.shutdown()
    (OUT/"observations.json").write_text(json.dumps(observations,indent=2),encoding="utf-8")
    failures=[x for x in observations if x["status"]!=200 or len(x["h1"])!=1 or not x["css"] or not x["cssLoaded"] or x["badImages"] or x["scrollWidth"]>x["viewport"]+3 or (x["headerContrastMin"] is not None and x["headerContrastMin"]<4.5)]
    if failures:
       print("FAIL: rendered route(s) require correction",json.dumps(failures,indent=2))
       raise SystemExit(1)
    print(f"PASS: {len(observations)} viewport captures across {len(ROUTES)} first-party executive routes; screenshots saved")

if __name__=="__main__":
    asyncio.run(run())
