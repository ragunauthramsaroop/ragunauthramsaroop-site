#!/usr/bin/env python3
"""Verify executive homepage first-screen text and navigation fit at key widths."""
from __future__ import annotations

import asyncio
import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "audit" / "flagship-edition-03"
WIDTHS = (320, 375, 390, 530, 768, 980, 1024, 1250, 1251, 1440, 1597, 1920)

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

MEASURE = r"""() => {
  const box = e => {
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { left: +r.left.toFixed(1), right: +r.right.toFixed(1),
             top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1),
             width: +r.width.toFixed(1) };
  };
  const shown = e => !!e && e.getClientRects().length > 0
    && getComputedStyle(e).display !== "none"
    && getComputedStyle(e).visibility !== "hidden";
  const h1 = document.querySelector(".flag-hero h1");
  const nav = document.querySelector(".site-header .nav");
  const links = document.querySelector(".site-header .nav-links");
  const menu = document.querySelector(".site-header .mobile-nav summary");
  const brand = document.querySelector(".site-header .brand");
  const image = document.querySelector(".flag-hero__portrait-wrap");
  return {
    width: innerWidth,
    h1: box(h1), h1Scroll: h1?.scrollWidth, h1Client: h1?.clientWidth,
    h1Font: h1 ? parseFloat(getComputedStyle(h1).fontSize) : null,
    nav: box(nav), brand: box(brand), links: box(links), menu: box(menu),
    linksShown: shown(links), menuShown: shown(menu),
    portrait: box(image),
    actionCount: document.querySelectorAll(".flag-hero .flag-button").length,
    name: h1?.textContent.trim()
  };
}"""

async def run():
    handler = functools.partial(Quiet, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_address[1]}/"
    rows, errors = [], []
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
            for width in WIDTHS:
                ctx = await browser.new_context(
                    viewport={"width": width, "height": 907},
                    service_workers="block", reduced_motion="reduce")
                page = await ctx.new_page()
                response = await page.goto(url, wait_until="domcontentloaded", timeout=25000)
                await page.locator(".flag-hero h1").wait_for()
                await page.wait_for_timeout(120)
                r = await page.evaluate(MEASURE)
                rows.append(r)
                if not response or response.status != 200:
                    errors.append(f"{width}: invalid page response")
                if not r["h1"] or r["h1"]["left"] < 10 or r["h1"]["right"] > width - 9:
                    errors.append(f"{width}: headline container outside viewport")
                if r["h1Scroll"] > r["h1Client"] + 2:
                    errors.append(f"{width}: headline text exceeds visible width")
                if not r["brand"] or r["brand"]["left"] < 5 or r["brand"]["right"] > width - 5:
                    errors.append(f"{width}: brand outside viewport")
                if not r["portrait"] or r["portrait"]["left"] < 9 or r["portrait"]["right"] > width - 9:
                    errors.append(f"{width}: portrait outside viewport")
                if width <= 1250:
                    if r["linksShown"] or not r["menuShown"]:
                        errors.append(f"{width}: expected compact navigation")
                    if not r["menu"] or r["menu"]["right"] > width - 5:
                        errors.append(f"{width}: compact menu outside viewport")
                elif not r["linksShown"] or r["menuShown"]:
                    errors.append(f"{width}: expected desktop navigation")
                elif r["links"]["right"] > width - 9:
                    errors.append(f"{width}: desktop links outside viewport")
                if r["actionCount"] < 2:
                    errors.append(f"{width}: primary executive actions missing")
                if width in (390, 1597):
                    OUT.mkdir(parents=True, exist_ok=True)
                    await page.screenshot(
                        path=str(OUT / f"home-first-screen-{width}.png"),
                        animations="disabled", full_page=False)
                await ctx.close()
            await browser.close()
    finally:
        server.shutdown()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "home-first-screen-audit.json").write_text(
        json.dumps({"widths": rows, "errors": errors}, indent=2) + "\n",
        encoding="utf-8")
    for err in errors:
        print("FAIL", err)
    print(f"HOME_FIRST_SCREEN_AUDIT widths={len(rows)} errors={len(errors)}")
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    asyncio.run(run())
