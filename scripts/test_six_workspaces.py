"""Static integrity checks for six connected workspaces and their public navigation."""
from html.parser import HTMLParser
from pathlib import Path
import json
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
WORKSPACES = {
    "/project-workspace/": "assets/project-workspace.js",
    "/research-explorer/": "assets/research-explorer.js",
    "/observatory/explorer/": "assets/indicator-explorer.js",
    "/executive-engagement/": "assets/executive-engagement.js",
    "/subscribe/": "assets/subscribe.js",
    "/academy/learning-lab/": "assets/academy-learning-lab.js",
}

class Parsed(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))

start = (ROOT / "start/index.html").read_text(encoding="utf-8")
resources = (ROOT / "resources/index.html").read_text(encoding="utf-8")
locations = {
    (e.text or "").strip()
    for e in ET.parse(ROOT / "sitemap.xml").getroot().iter()
    if e.tag.endswith("loc")
}
for route, script in WORKSPACES.items():
    path = ROOT / route.strip("/") / "index.html"
    assert path.exists(), f"Workspace page missing: {route}"
    html = path.read_text(encoding="utf-8")
    page = Parsed()
    page.feed(html)
    assert any(t == "title" for t, _ in page.tags), f"Missing title: {route}"
    assert any(t == "link" and a.get("rel") == "canonical"
               and a.get("href") == "https://ragunauthramsaroop.com" + route
               for t, a in page.tags), f"Canonical mismatch: {route}"
    assert any(t == "script" and a.get("src") == "/" + script
               for t, a in page.tags), f"Missing workspace script: {route}"
    assert "/tools/assets/analytics-loader.js" in html, f"Consent-loader missing: {route}"
    assert (ROOT / script).is_file(), f"Missing JS asset: {script}"
    assert "https://ragunauthramsaroop.com" + route in locations, f"Missing sitemap entry: {route}"
    assert 'href="' + route + '"' in start, f"Missing start link: {route}"
    assert 'href="' + route + '"' in resources, f"Missing resource-centre link: {route}"

papers = json.loads((ROOT / "data/research-papers.json").read_text(encoding="utf-8"))
pages = json.loads((ROOT / "data/research-pages.json").read_text(encoding="utf-8"))
expected = len(json.loads((ROOT / "research-library/publication-register.json").read_text(encoding="utf-8"))["papers"])
assert len(papers["papers"]) == expected, "Research paper index and publication register disagree"
assert pages["papers"], "PDF index has no indexed papers"
for paper in pages["papers"]:
    assert (ROOT / paper["pdf"].lstrip("/")).exists(), f"Missing public PDF: {paper['pdf']}"
    assert paper["file_sha256"] and len(paper["file_sha256"]) == 64
    assert all(1 <= p["page"] <= paper["page_count"] for p in paper["pages"])
assert sum(len(x["pages"]) for x in pages["papers"]) >= 500, "Unexpectedly small PDF page index"

assess = json.loads((ROOT / "data/academy-assessments.json").read_text(encoding="utf-8"))
assert len(assess["assessments"]) == 8, "Eight Academy subject areas required"
for subject in assess["assessments"]:
    assert len(subject["questions"]) == 4, f"Incomplete assessment: {subject['id']}"
    for question in subject["questions"]:
        assert len(question["choices"]) == 4
        assert 0 <= question["answer"] <= 3 and question["explanation"]

subscribe = (ROOT / "subscribe/index.html").read_text(encoding="utf-8")
script = (ROOT / "assets/subscribe.js").read_text(encoding="utf-8")
assert "manual opt-in" in subscribe.lower() and "RSS" in subscribe, "Unverified automated email claim"
assert "mailto:" in script and "api.resend.com" not in script, "Email requests must remain manual until verified"

print("PASS six linked workspaces, canonical pages, sitemap,", expected, "source PDFs,",
      sum(len(p["pages"]) for p in pages["papers"]), "indexed pages,",
      "32 Academy questions and truthful subscription status")
