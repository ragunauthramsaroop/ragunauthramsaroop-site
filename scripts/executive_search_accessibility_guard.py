#!/usr/bin/env python3
"""Guard priority executive URLs and source-level accessibility fixes."""
from html.parser import HTMLParser
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DOMAIN="https://ragunauthramsaroop.com"
class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonical=[]
        self.base=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=="link" and a.get("rel")=="canonical":
            self.canonical.append(a.get("href"))
        if tag=="base":
            self.base.append(a.get("href"))
for route in ("executive-profile","board-ceo-mode","recruiter-mode"):
    s=(ROOT/route/"index.html").read_text(encoding="utf-8")
    p=Head()
    p.feed(s)
    assert p.canonical==[f"{DOMAIN}/{route}/"], f"Absolute canonical missing: {route}"
    assert p.base==["/"], f"Legacy cross-origin base returned: {route}"
    assert 'src="/_next/static/' not in s, f"Old hydration scripts reintroduced: {route}"
    assert 'src="/assets/executive-static-nav.js"' in s, f"Static navigation missing: {route}"
assert 'class="rr-index-contrast"' in (ROOT/"search/index.html").read_text(encoding="utf-8")
assert 'class="rr-index-contrast"' in (ROOT/"tools/index.html").read_text(encoding="utf-8")
assert 'Public platform overview</a>' in (ROOT/"search/index.html").read_text(encoding="utf-8")
assert "body.rr-index-contrast .card .tool-category" in (ROOT/"assets/platform.css").read_text(encoding="utf-8")
assert ".recruiter-redesign #rr-print" in (ROOT/"assets/executive-recruiter-2026.css").read_text(encoding="utf-8")
assert "main.wrap .paper .meta" in (ROOT/"research-library/index.html").read_text(encoding="utf-8")
print("PASS: absolute canonical, same-origin routing, descriptive navigation and high-contrast labels")
