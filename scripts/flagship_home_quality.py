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
