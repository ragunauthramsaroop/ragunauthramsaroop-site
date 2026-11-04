#!/usr/bin/env python3
"""Low-cost source guard for the executive homepage visual refinement.

This worker checks structural design and accessibility prerequisites. It is not
a screenshot or WCAG conformance test; the forensic visual audit is separate.
"""
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
CSS = (ROOT / "assets/home-signature-2026.css").read_text(encoding="utf-8")
MARK = "/* EXECUTIVE EDITORIAL POLISH / 2026-11-04"
assert MARK in CSS, "Executive design tokens and safeguards missing"
polish = CSS.split(MARK, 1)[1]

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_list = False
        self.focuses = []
        self.links = []
        self.portrait = False
        self.headings = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "ul" and "flag-hero__disciplines" in a.get("class", "").split():
            self.in_list = True
        if tag == "li" and self.in_list:
            self.focuses.append("li")
        if tag == "a":
            self.links.append(a.get("href"))
        if tag == "h1":
            self.headings += 1
        if tag == "img" and a.get("class") == "portrait":
            self.portrait = bool(a.get("alt")) and a.get("src") == "/assets/randy-portrait.jpg"

    def handle_endtag(self, tag):
        if tag == "ul":
            self.in_list = False

page = Page()
page.feed(HTML)
assert page.headings == 1, "Homepage needs one H1"
assert len(page.focuses) == 3, "Three executive expertise items expected"
assert page.portrait, "The first-party executive portrait and descriptive alt text must remain"
for path in ("/board-ceo-mode/", "/recruiter-toolkit/", "/resume.html", "/public-record/"):
    assert path in page.links, f"Missing executive conversion path: {path}"
for token in (".flag-hero__disciplines", ".flag-pathway", ":focus-visible",
              "prefers-reduced-motion:reduce", "prefers-contrast:more",
              "@media(max-width:530px)"):
    assert token in polish, f"Missing required responsive or accessible style: {token}"
for forbidden in ("@import", "http://", "https://", "url(", "backdrop-filter"):
    assert forbidden not in polish, f"Unexpected external or expensive CSS usage: {forbidden}"
assert len(CSS.encode("utf-8")) < 20_000, "Executive CSS should remain under 25 KB"
assert len(HTML.encode("utf-8")) < 25_000, "Homepage must respect the 25 KB HTML budget"
print("PASS: executive art-direction markup, routes, first-party assets and static safeguards")
