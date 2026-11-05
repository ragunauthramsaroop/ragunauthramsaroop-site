#!/usr/bin/env python3
"""Edition 03 executive journey smoke gate. No network services or model calls."""
from pathlib import Path
from html.parser import HTMLParser
import re

ROOT=Path(__file__).resolve().parents[1]
STYLE=ROOT/"assets/flagship-system-2026.css"
css=STYLE.read_text(encoding="utf-8")
PAGES={
  "index.html":("flag-hero","flag-editorial-note","decision-paths"),
  "executive-profile/index.html":("exec-profile-hero","exec-value-grid","exec-career"),
  "board-ceo-mode/index.html":("board-ceo-mode-page","enterprise-problem-grid","board-evaluation"),
  "recruiter-mode/index.html":("recruiter-mode-page","recruiter-screen-grid","mode-fact-strip"),
  "recruiter-toolkit/index.html":("recruiter-redesign","rr-verification-bar","rr-evidence-grid")
}
class Scan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.h1=0
        self.links=[]
        self.styles=[]
        self.images=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=="h1":self.h1+=1
        if tag=="a" and a.get("href"):self.links.append(a["href"])
        if tag=="link" and a.get("rel")=="stylesheet":
            self.styles.append(a.get("href"))
        if tag=="img":self.images.append(a)

assert 0<len(css.encode())<20_000, "Visual system too heavy"
assert "@import" not in css and "url(" not in css and "backdrop-filter" not in css
assert "http://" not in css and "https://" not in css, "Unexpected external dependency"
assert "@media(max-width:530px)" in css and "@media(prefers-reduced-motion:reduce)" in css
assert "@media(prefers-contrast:more)" in css and "@media print" in css
for filename,markers in PAGES.items():
    html=(ROOT/filename).read_text(encoding="utf-8")
    parser=Scan();parser.feed(html)
    assert parser.h1==1, f"{filename} needs one H1"
    expected_css="/assets/home-compiled-2026.css?v=1" if filename=="index.html" else "/assets/flagship-system-2026.css?v=1"
    assert expected_css in parser.styles, f"Unified theme missing: {filename}"
    assert all(m in html for m in markers), f"Executive pathway structure changed: {filename}"
    assert expected_css in html
    if filename=="index.html":
        assert len(html.encode("utf-8"))<=25_000
        assert any(img.get("class")=="portrait" and img.get("src")=="/assets/randy-portrait.jpg" for img in parser.images)
        assert all(x in parser.links for x in ("/board-ceo-mode/","/recruiter-toolkit/","/resume.html","/public-record/","/proof-in-practice/"))
        assert "href=\"/assets/home-compiled-2026.css?v=1\"" in html
        assert html.count("<main") ==1
    if filename.endswith("recruiter-toolkit/index.html"):
        assert "id=\"rr-print\"" in html and "data-copy-target=\"rr-short-bio\"" in html
        assert any((x or "").startswith("mailto:ragunauthramsaroop@icloud.com") for x in parser.links)
    if filename in ("executive-profile/index.html","board-ceo-mode/index.html","recruiter-mode/index.html"):
        assert 'id="__NEXT_DATA__"' in html, "Pre-rendered hydration boundary must remain intact"
        assert "/_next/static/" in html
assert "Oxford domain. Not a claim of university employment" in (ROOT/"index.html").read_text(encoding="utf-8")
assert "company-wide results" in (ROOT/"recruiter-toolkit/index.html").read_text(encoding="utf-8").lower()
print("PASS: five cohesive executive routes, preserved hydration, first-party assets, evidence, budgets and responsive access")
