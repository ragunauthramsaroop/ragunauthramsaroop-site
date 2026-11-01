"""Keep primary executive and publication routes present in sitemap.xml."""
from pathlib import Path
import json
import re

ROOT=Path(__file__).resolve().parents[1]
SITE="https://ragunauthramsaroop.com"
profile=json.loads((ROOT/"data/public-profile.json").read_text(encoding="utf-8"))
lastmod=profile["reviewed"]
path=ROOT/"sitemap.xml"
xml=path.read_text(encoding="utf-8")

required={
    "/":0.95,
    "/resume.html":0.90,
    "/public-record/":0.85,
    "/claim-graph/":0.80,
    "/executive-private-room/":0.75,
    "/public-record/es/":0.55,
    "/public-record/pt/":0.55,
    "/public-record/fr/":0.55,
    "/executive-profile/":0.95,
    "/leadership/":0.80,
    "/recognition-media/":0.85,
    "/media/":0.80,
    "/authority/":0.85,
    "/2126/":0.80,
    "/2126/evidence/":0.80,
    "/2126/timeline/":0.75,
    "/decision-brief/":0.85,
    "/recruiter-mode/":0.80,
    "/recruiter-toolkit/":0.80,
    "/research-library/":0.90,
    "/white-papers/":0.90,
    "/book/":0.80,
}
for base in ("white-papers","research-library","insights","book"):
    folder=ROOT/base
    if folder.exists():
        for p in folder.glob("*/index.html"):
            required[f"/{base}/{p.parent.name}/"]=0.72

for route,priority in sorted(required.items()):
    url=SITE+route
    if f"<loc>{url}</loc>" in xml:
        pattern=r"(<loc>"+re.escape(url)+r"</loc>\s*<lastmod>)[^<]+(</lastmod>)"
        xml=re.sub(pattern,rf"\g<1>{lastmod}\g<2>",xml,count=1)
        continue
    entry=f"<url><loc>{url}</loc><lastmod>{lastmod}</lastmod><changefreq>monthly</changefreq><priority>{priority:.2f}</priority></url>\n"
    xml=xml.replace("</urlset>",entry+"</urlset>")

path.write_text(xml,encoding="utf-8")
print("SITEMAP_SYNC",len(required),"required routes")
