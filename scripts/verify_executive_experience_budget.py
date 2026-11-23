#!/usr/bin/env python3
"""Release guard for the first-party executive journey.

These are source and transfer budgets, not substitutes for Lighthouse,
assistive-technology review, or independent source verification.
"""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
sizes = {
    "experience/index.html": 35_000,
    "assets/experience-2026.css": 60_000,
    "assets/experience-2026.js": 30_000,
}
for name, limit in sizes.items():
    used = (ROOT / name).stat().st_size
    if used > limit:
        raise SystemExit(f"FAIL {name}: {used} bytes exceeds {limit}")
    print(f"PASS transfer budget: {name} {used}/{limit} bytes")

home = (ROOT / "index.html").read_text(encoding="utf-8")
experience = (ROOT / "experience/index.html").read_text(encoding="utf-8")
cv = (ROOT / "resume.html").read_text(encoding="utf-8")
css = (ROOT / "assets/experience-2026.css").read_text(encoding="utf-8")
js = (ROOT / "assets/experience-2026.js").read_text(encoding="utf-8")
record = json.loads((ROOT / "api/v1/executive-record.json").read_text(encoding="utf-8"))

assert re.search(r"<h1\b", experience) and len(re.findall(r"<h1\b", experience)) == 1
assert len(re.findall(r'class="motion-toggle', experience)) == 2
assert 'prefers-reduced-motion' in css
assert 'dossier:motion-pause' in js and 'dossier:motion-resume' in js
assert 'body[data-motion="off"]' in css
assert 'fetch("/api/v1/executive-record.json"' in js
assert 'document.body.dataset.motion' in js
assert '/tools/assets/analytics-loader.js' in experience
assert 'default-src \'self\'' in experience
assert len(re.findall(r'class="route-bridge__choices"', experience)) == 1
for lens in ('board', 'recruiter', 'speaker'):
    assert f'href="/briefing/?lens={lens}"' in experience
assert '12+' not in home and '12+' not in experience and '12+' not in cv
assert 'Jul 2014' in home and 'Jul 2014' in experience and 'Jul 2014' in cv
assert 'Jul 2014–May 2019' in cv
assert 'Jun 2014–May 2019' not in cv
assert '<strong>2016</strong><span>Career record begins' not in home
assert '<b>2016</b><small>Career record begins' not in experience
assert len(record["claims"]) == 6
assert len({c["id"] for c in record["claims"]}) == 6
assert any(c["classification"] == "company_reported_operating_context" for c in record["claims"])
assert "company_reported_operating_context" in js
assert 'company operating results' in experience.lower()
print("PASS executive journey: audience paths, opt-out motion, evidence boundaries and dated career language")
