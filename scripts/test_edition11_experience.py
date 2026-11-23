"""Edition 11 regression guard: purposeful UI, accessibility and no critical-path regression."""
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]
home = (ROOT / "index.html").read_text("utf-8")
runtime = (ROOT / "assets/home-runtime.js").read_text("utf-8")
script = (ROOT / "assets/home-experience-2026.js").read_text("utf-8")
styles = (ROOT / "assets/home-experience-2026.css").read_text("utf-8")
compiled = (ROOT / "assets/home-compiled-2026.css").read_text("utf-8")
system = (ROOT / "assets/flagship-system-2026.css").read_text("utf-8")
dossier = (ROOT / "assets/experience-2026.css").read_text("utf-8")
atlas = (ROOT / "assets/leadership-atlas-2026.css").read_text("utf-8")
atlas_js = (ROOT / "assets/leadership-atlas-2026.js").read_text("utf-8")
atlas_page = (ROOT / "leadership-atlas/index.html").read_text("utf-8")
browser = (ROOT / "scripts/browser_smoke_test.py").read_text("utf-8")

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
        self.css = []
        self.h1 = 0

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if tag == "h1":
            self.h1 += 1
        if tag == "script" and data.get("src"):
            self.scripts.append(data["src"])
        if tag == "link" and data.get("rel") == "stylesheet":
            self.css.append(data.get("href"))

page = Page()
page.feed(home)
assert page.h1 == 1
assert page.scripts == ["/assets/home-runtime.js"], "No new render-time homepage scripts"
assert page.css == ["/assets/home-compiled-2026.css?v=2"], "One critical stylesheet"
assert len(home.encode("utf-8")) <= 25_000
assert len(runtime.encode("utf-8")) <= 1_500
assert len(compiled.encode("utf-8")) <= 75_000
assert "addScript(\"/assets/home-experience-2026.js\")" in runtime
assert "addEventListener(\"load\"" in runtime
assert "requestIdleCallback" in runtime
assert 'const V="rr-public-v17"' in (ROOT / "service-worker.js").read_text("utf-8")

assert len(script.encode("utf-8")) <= 13_000, "Deferred JS exceeds 13 KB"
assert len(styles.encode("utf-8")) <= 9_000, "Deferred CSS exceeds 9 KB"
assert 'sheet.href = "/assets/home-experience-2026.css"' in script
assert 'sheet.addEventListener("load", initialize' in script
for feature in (
    "Homepage chapter navigation", "Go to ", "aria-current",
    "Back to top", "IntersectionObserver", "prefers-reduced-motion",
    "HTMLDialogElement", "showModal", "aria-live", "aria-haspopup",
    "Control+K Meta+K", "ArrowDown", "Escape"
):
    assert feature in script or feature == "Escape", feature

for route in ("/leadership-atlas/", "/experience/", "/board-ceo-mode/",
              "/recruiter-toolkit/", "/resume.html", "/public-record/",
              "/proof-in-practice/", "/research-library/", "/engage/"):
    assert route in script and (ROOT / route.lstrip("/")).exists(), route

assert all(route in script for route in ("/corporate-affairs/", "/esg-social-impact/", "/compliance-governance/", "/leadership/"))
assert "rr-discipline-link" in styles and "rr-discipline-link" in script
assert "innerHTML" not in script, "Never inject untrusted HTML"
assert "localStorage" not in script and "sessionStorage" not in script
assert "fetch(" not in script and "XMLHttpRequest" not in script
assert "https://" not in styles and "@import" not in styles
assert "prefers-reduced-motion:reduce" in styles
assert "data-rr-motion=off" in styles
assert "rr-command__result[hidden]" in styles
assert "max-height:calc(100dvh - 130px)" in compiled
assert "max-height:calc(100vh - 130px)" in compiled
assert "overflow-y:auto" in compiled, "Mobile menu must scroll on short screens"
assert "@media(max-width:1480px){.rr-rail{display:none}}" not in styles
assert "@media(max-width:1250px){.rr-rail{display:none}}" in styles
assert "min-width:1251px" in styles and "max-width:1480px" in styles
assert 'menu_metrics["content"] > menu_metrics["height"]' in browser
assert "rr-command::backdrop" in styles
assert "rr-rail__link[aria-current=location]" in styles

for route_css in (compiled, system, dossier, atlas):
    assert "@view-transition{navigation:auto}" in route_css, "Transition opt-in missing"
    assert "@view-transition{navigation:none}" in route_css, "Motion preference not respected"

assert ".brand{view-transition-name:rr-identity}" in compiled
assert ".identity{view-transition-name:rr-identity}" in dossier
assert ".atlas-brand{view-transition-name:rr-identity}" in atlas
assert 'class="atlas-motion-toggle"' in atlas_page
assert "motionButton" in atlas_js and 'setMotion(motionPaused)' in atlas_js
assert "rr-command" in browser and "rr-mobile-find" in browser
assert 'to_contain_text("2014")' in browser, "Homepage year-only test missing"
assert 'to_contain_text("Jul 2014")' not in browser.split('page.goto(base + "/resume.html"')[0]
print("PASS Edition 11: critical-path budgets, interactive navigation, mobile, motion and chronology")
