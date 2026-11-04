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
              measured=await page.evaluate("""() => ({
                h1:[...document.querySelectorAll('h1')].map(e=>e.innerText.trim()),
                scrollWidth:document.documentElement.scrollWidth,
                viewport:innerWidth,
                css:[...document.querySelectorAll('link[rel=stylesheet]')].some(e=>e.href.includes('flagship-system-2026.css')),
                badImages:[...document.querySelectorAll('img')].filter(e=>e.complete && !e.naturalWidth).map(e=>e.getAttribute('src'))
              })""")
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
    failures=[x for x in observations if x["status"]!=200 or len(x["h1"])!=1 or not x["css"] or x["badImages"] or x["scrollWidth"]>x["viewport"]+3]
    if failures:
       print("FAIL: rendered route(s) require correction",json.dumps(failures,indent=2))
       raise SystemExit(1)
    print(f"PASS: {len(observations)} viewport captures across {len(ROUTES)} first-party executive routes; screenshots saved")

if __name__=="__main__":
    asyncio.run(run())
