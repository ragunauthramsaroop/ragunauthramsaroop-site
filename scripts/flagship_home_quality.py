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
if "CREF 2026 · Conference programme" not in (ROOT / "recognition-media/index.html").read_text(encoding="utf-8"):
    errors.append("CREF programme source and neutral dated description must remain in the media record")
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
if profile.get("current_role_since") != "2026": additional.append("Named Social Responsibility role should show 2026")
cv=(ROOT/"resume.html").read_text(encoding="utf-8")
if '<strong>2025</strong><span>Director-level appointment</span>' not in cv:
    additional.append("CV must distinguish the 2025 director-level appointment from the named 2026 mandate")
if '<strong>2025–Present</strong><span>Liaison Director, Social Responsibility Department</span>' in cv:
    additional.append("CV metric incorrectly dates the named Social Responsibility role to 2025")
if cv.count("Liaison Director, Social Responsibility Department · 2026–Present") != 2:
    additional.append("Screen and print CV must agree on the 2026 named role")
if "reaching director level in 2025 and assuming the named Social Responsibility mandate in 2026" not in cv:
    additional.append("CV career progression does not distinguish director-level and named-role dates")
if "Director-level responsibility from 2025, followed by the named Social Responsibility mandate in 2026" not in cv:
    additional.append("Print CV career progression does not distinguish director-level and named-role dates")
if profile.get("director_level_since") != "2025": additional.append("Director-level appointment should show 2025")
if profile.get("direct_parent") != "Zijin Gold International": additional.append("Direct corporate parent missing")
if profile["scheduled_public_engagements"][0]["status"].startswith("Scheduled"): additional.append("Expired CREF programme status")
for path in ("resume.html","executive-profile/index.html","2126/timeline/index.html"):
    content=(ROOT / path).read_text(encoding="utf-8")
    if "2026–Present" not in content: additional.append(f"Inconsistent named current-role start year: {path}")
    if "Zijin Gold International" not in content: additional.append(f"Direct parent missing: {path}")
recognition=(ROOT/"recognition-media/index.html").read_text(encoding="utf-8")
if "This is a future engagement" in recognition or "Scheduled speaking engagement" in recognition: additional.append("Expired future speaking language")
context_article=(ROOT/"insights/aurora-operating-context/index.html").read_text(encoding="utf-8")
for number, source in (
    ("49.4","https://en.zijingoldintl.com/news/companynews-detail-410.htm"),
    ("10,000","https://en.zijingoldintl.com/global/saprogram-detail-71993.htm"),
    ("89","https://www.zijinmining.com/news/news-detail-122826.htm"),
):
    if number not in context_article or source not in context_article:
        additional.append(f"Article operating figure source missing: {number}")
if "Operating context is not personal credit." not in context_article:
    additional.append("Article lacks corporate/personal attribution boundary")
if 'class="mandate-stats"' in html or 'class="mandate-context"' in html:
    additional.append("Corporate figures belong in contextual article, not homepage")
if additional:
    for error in additional: print("FAIL:",error)
    raise SystemExit(1)
print("PASS: 2025 director-level appointment, 2026 named role, direct parent and attributable source boundaries")

# Server-rendered export and client-side Next.js must agree after hydration.
for bundle in (
    "_next/static/chunks/pages/executive-profile-094a2ea3b0baded2.js",
    "_next/static/chunks/pages/2126/timeline-fdebacbbe2a54c41.js",
):
    generated=(ROOT / bundle).read_text(encoding="utf-8")
    if "2026–Present" not in generated:
        raise SystemExit(f"FAIL: prebuilt client bundle has stale director appointment: {bundle}")
    if "Zijin Gold International" not in generated:
        raise SystemExit(f"FAIL: prebuilt client bundle lacks current parent: {bundle}")
recognition_bundle=(ROOT/"_next/static/chunks/pages/recognition-media-2ff639f29bacfe27.js").read_text(encoding="utf-8")
if "CREF 2026 · Conference programme" not in recognition_bundle:
    raise SystemExit("FAIL: prebuilt recognition page needs dated programme correction")
if (ROOT/"service-worker.js").read_text(encoding="utf-8").count('const V="rr-public-v16"') != 1:
    raise SystemExit("FAIL: service worker did not advance for refreshed cached Next.js chunks")
print("PASS: generated client bundles and cache version aligned with published career record")
