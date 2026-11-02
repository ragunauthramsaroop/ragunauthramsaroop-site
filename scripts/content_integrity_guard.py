"""Guard the canonical public executive record against content drift."""
# Generated search assets are validated separately by the performance workflow.
from pathlib import Path
import json
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
PROFILE = json.loads((ROOT / "data/public-profile.json").read_text(encoding="utf-8"))
errors = []

def fail(msg):
    errors.append(msg)

def text(rel):
    p = ROOT / rel
    if not p.exists():
        fail(f"missing required file: {rel}")
        return ""
    return p.read_text(encoding="utf-8", errors="replace")

required = [
    "index.html",
    "resume.html",
    "executive-profile/index.html",
    "leadership/index.html",
    "recognition-media/index.html",
    "media/index.html",
    "authority/index.html",
    "2126/index.html",
    "2126/evidence/index.html",
    "2126/timeline/index.html",
    "recruiter-mode/index.html",
    "recruiter-toolkit/index.html",
    "decision-brief/index.html",
    "research-library/index.html",
    "white-papers/index.html",
    "book/index.html",
]
for rel in required:
    text(rel)

home = text("index.html")
# Keep recognition and historical conference claims on the dated evidence page,
# not as visually dominant employer/third-party cards on the executive homepage.
for needle in (
    PROFILE["current_role"],
    "/resume.html",
    "/recognition-media/",
    "/media/",
    "/research-library/",
):
    if needle not in home:
        fail(f"homepage missing canonical item: {needle}")

canonical_pages = [
    "executive-profile/index.html",
    "leadership/index.html",
    "2126/index.html",
    "2126/evidence/index.html",
    "2126/timeline/index.html",
    "2126/impact/index.html",
    "recruiter-mode/index.html",
    "recruiter-toolkit/index.html",
    "decision-brief/index.html",
    "media/index.html",
]
for rel in canonical_pages:
    s = text(rel)
    if "16 September 2026" in s:
        fail(f"stale review date in {rel}")

legacy_claims = {
    "Administration Secretary",
    "Liaison Superintendent",
    "Deputy Administration Manager",
    "six AGM roles across five progression steps",
    "Five role progressions at AGM Inc.",
    "Two group-level Advanced Individual awards",
    "A+ / A / A performance ratings",
}
for rel in canonical_pages:
    s = text(rel)
    for claim in legacy_claims:
        if claim in s:
            fail(f"legacy public claim in {rel}: {claim}")

profile = text("executive-profile/index.html")
if "2020–Present" not in profile or "consolidated leadership tenure" not in profile:
    fail("executive profile must present consolidated AGM tenure")
if "ragunauth-ramsaroop.floot.app" in profile:
    fail("executive profile still depends on retired Floot image host")

recognition = text("recognition-media/index.html")
for needle in (
    "Best of Best Second Merit Award",
    "Management Reserve Program",
    "CREF 2026 · Conference programme",
    "Company-level recognition",
    "not personal awards",
):
    if needle not in recognition:
        fail(f"recognition page missing boundary or current record: {needle}")

media = text("media/index.html")
if "Best of Best Second Merit Award" not in media or "Management Reserve Program" not in media:
    fail("media biography is not aligned with canonical recognition record")

book = text("book/index.html")
for forbidden in ("ctonew.app", "floot.app"):
    if forbidden in book:
        fail(f"book page contains retired external dependency: {forbidden}")

sitemap = ET.parse(ROOT / "sitemap.xml").getroot()
locs = {e.text for e in sitemap.iter() if e.tag.endswith("}loc") or e.tag == "loc"}
for url in (
    "https://ragunauthramsaroop.com/",
    "https://ragunauthramsaroop.com/executive-profile/",
    "https://ragunauthramsaroop.com/recognition-media/",
    "https://ragunauthramsaroop.com/media/",
    "https://ragunauthramsaroop.com/research-library/",
    "https://ragunauthramsaroop.com/white-papers/",
    "https://ragunauthramsaroop.com/authority/",
):
    if url not in locs:
        fail(f"sitemap missing primary public route: {url}")

for rel in ("index.html", "resume.html", "executive-profile/index.html", "recognition-media/index.html", "media/index.html"):
    s = text(rel)
    for forbidden in ("ragunauth123456", "ctonew.app", "api-v2.appdeploy.ai"):
        if forbidden in s:
            fail(f"retired identity or host in {rel}: {forbidden}")

if errors:
    for e in errors:
        print("FAIL", e)
    sys.exit(1)

print("PASS canonical public profile, career boundaries, recognition, speaking, primary routes and retired-host checks")
