"""Regression gate for the first-party Leadership Atlas."""
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
page = (ROOT / "leadership-atlas/index.html").read_text("utf-8")
home = (ROOT / "index.html").read_text("utf-8")
css = (ROOT / "assets/leadership-atlas-2026.css").read_text("utf-8")
js = (ROOT / "assets/leadership-atlas-2026.js").read_text("utf-8")

class AtlasParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.h1 = 0
        self.links = []
        self.buttons = []
        self.scripts = []
        self.structured = []
        self.in_json = False

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "h1":
            self.h1 += 1
        if tag in ("a", "script", "link", "img"):
            self.links.extend(values[k] for k in ("href", "src") if values.get(k))
        if tag == "script" and values.get("src"):
            self.scripts.append(values["src"])
        if tag == "script" and values.get("type") == "application/ld+json":
            self.in_json = True
        if tag == "button" and values.get("data-domain"):
            self.buttons.append(values)

    def handle_data(self, data):
        if self.in_json:
            self.structured.append(data)

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_json = False

parsed = AtlasParser()
parsed.feed(page)
assert parsed.h1 == 1, "Atlas must have exactly one main heading"
assert len(parsed.buttons) == 4, "All four mandate selector controls are required"
assert sum(btn.get("aria-pressed") == "true" for btn in parsed.buttons) == 1, "One default selection expected"
assert {btn.get("data-domain") for btn in parsed.buttons} == {
    "government", "governance", "responsibility", "delivery"
}, "A mandate domain is missing or duplicated"
assert 'role="group"' in page and 'aria-live="polite"' in page and 'aria-labelledby="system-title system-desc"' in page
assert 'id="system-title"' in page and 'id="system-desc"' in page, "Accessible infographic description missing"
assert "/assets/leadership-atlas-2026.css" in parsed.links
assert "/assets/leadership-atlas-2026.js" in parsed.scripts
assert "/tools/assets/analytics-loader.js" in parsed.scripts, "Consent-first analytics must be present"
assert "script-src 'self'" in page and "'unsafe-inline'" not in page, "Inline execution prohibited"
assert all(path in page for path in ("JUL 2014", "MAY 2019", "2020", "2025", "2026"))
assert "Director-level appointment in 2025 and the named Social Responsibility mandate in 2026" in page
assert "This atlas does not claim sole responsibility for organisational results." in page
assert all(p in parsed.links for p in ("/public-record/", "/proof-in-practice/", "/experience/", "/resume.html", "/engage/"))
assert home.count('href="/leadership-atlas/"') >= 2, "Atlas must be discoverable on homepage"
assert len(home.encode("utf-8")) <= 25000, "Homepage HTML size budget exceeded"
assert len(css.encode("utf-8")) < 26000 and len(js.encode("utf-8")) < 4000
assert "@media(prefers-reduced-motion:reduce)" in css and "@media(max-width:600px)" in css
assert "innerHTML" not in js and 'addEventListener("keydown"' in js
assert "https://" not in css and "@import" not in css, "No remote CSS dependencies"
assert not re.search(r"<script(?![^>]+type=\"application/ld\\+json\")[^>]*>\\s*[^\\s<]", page), "Executable inline script detected"
for payload in parsed.structured:
    json.loads(payload)
sitemap = ET.parse(ROOT / "sitemap.xml")
locations = [el.text for el in sitemap.getroot().iter() if el.tag.endswith("loc")]
assert "https://ragunauthramsaroop.com/leadership-atlas/" in locations, "Atlas absent from sitemap"
print("PASS: accessible interactive infographic, career attribution, sitemap, privacy and asset budgets")
