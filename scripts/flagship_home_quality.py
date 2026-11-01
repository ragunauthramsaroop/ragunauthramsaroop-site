"""Regression checks for the flagship executive homepage audience journey."""
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / "index.html").read_text(encoding="utf-8")

class Homepage(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []
        self.h1_count = 0
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "a" and values.get("href"):
            self.hrefs.append(values["href"])
        if tag == "h1":
            self.h1_count += 1
        if values.get("id"):
            self.ids.add(values["id"])

page = Homepage()
page.feed(html)
required = {
    "/resume.html": ROOT / "resume.html",
    "/recruiter-mode/": ROOT / "recruiter-mode" / "index.html",
    "/recruiter-toolkit/": ROOT / "recruiter-toolkit" / "index.html",
    "/proof-in-practice/": ROOT / "proof-in-practice" / "index.html",
    "/board-ceo-mode/": ROOT / "board-ceo-mode" / "index.html",
    "/engage/": ROOT / "engage" / "index.html",
}
errors = []
if page.h1_count != 1:
    errors.append(f"Expected one homepage H1, found {page.h1_count}")
for target, file in required.items():
    if target not in page.hrefs:
        errors.append(f"Missing executive audience path: {target}")
    if not file.is_file():
        errors.append(f"Broken local destination: {target}")
if "mandate-fit-title" not in page.ids:
    errors.append("Missing audience evaluation heading")
if "Scheduled · 16 October 2026" in html:
    errors.append("Expired CREF event label must not imply a future engagement")
if "Conference programme · 16 October 2026" not in html:
    errors.append("CREF programme date needs neutral, dated wording")
if "https://ragunauthramsaroop.com/" not in html:
    errors.append("Missing canonical domain references")
if errors:
    for error in errors:
        print("FAIL:", error)
    raise SystemExit(1)
print(f"PASS: one H1, {len(required)} verified audience destinations, dated event semantics")

# Cross-page identity, timeline, sources and attributable-results gate.
import json
profile = json.loads((ROOT / "data/public-profile.json").read_text(encoding="utf-8"))
additional = []
if profile.get("current_role_since") != "2025": additional.append("Director appointment must show 2025")
if profile.get("direct_parent") != "Zijin Gold International": additional.append("Direct corporate parent missing")
if profile["scheduled_public_engagements"][0]["status"].startswith("Scheduled"): additional.append("Expired CREF programme status")
for path in ("resume.html","executive-profile/index.html","2126/timeline/index.html"):
    content=(ROOT / path).read_text(encoding="utf-8")
    if "2025–Present" not in content or "2026–Present" in content: additional.append(f"Inconsistent current-role dates: {path}")
    if "Zijin Gold International" not in content: additional.append(f"Direct parent missing: {path}")
recognition=(ROOT/"recognition-media/index.html").read_text(encoding="utf-8")
if "This is a future engagement" in recognition or "Scheduled speaking engagement" in recognition: additional.append("Expired future speaking language")
for number, source in (
    ("49.4","https://en.zijingoldintl.com/news/companynews-detail-410.htm"),
    ("10,000","https://en.zijingoldintl.com/global/saprogram-detail-71993.htm"),
    ("89","https://www.zijinmining.com/news/news-detail-122826.htm"),
):
    if number not in html or source not in html: additional.append(f"Operating figure source missing: {number}")
if "not results personally attributed to me" not in html: additional.append("Missing personal attribution boundary")
if additional:
    for error in additional: print("FAIL:",error)
    raise SystemExit(1)
print("PASS: director start year, direct ownership, dated appearance and independently sourced company context")

# Server-rendered export and client-side Next.js must agree after hydration.
for bundle in (
    "_next/static/chunks/pages/executive-profile-094a2ea3b0baded2.js",
    "_next/static/chunks/pages/2126/timeline-fdebacbbe2a54c41.js",
):
    generated=(ROOT / bundle).read_text(encoding="utf-8")
    if "2026–Present" in generated or "2025–Present" not in generated:
        raise SystemExit(f"FAIL: prebuilt client bundle has stale director appointment: {bundle}")
    if "Zijin Gold International" not in generated:
        raise SystemExit(f"FAIL: prebuilt client bundle lacks current parent: {bundle}")
recognition_bundle=(ROOT/"_next/static/chunks/pages/recognition-media-2ff639f29bacfe27.js").read_text(encoding="utf-8")
if "CREF 2026 · Conference programme" not in recognition_bundle:
    raise SystemExit("FAIL: prebuilt recognition page needs dated programme correction")
if (ROOT/"service-worker.js").read_text(encoding="utf-8").count('const V="rr-public-v15"') != 1:
    raise SystemExit("FAIL: service worker did not advance for refreshed cached Next.js chunks")
print("PASS: generated client bundles and cache version aligned with published career record")
