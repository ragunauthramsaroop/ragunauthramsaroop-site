"""Static privacy, routing, social-card and sitemap checks for RR Free Tools."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse, unquote
import json, re, struct, sys, xml.etree.ElementTree as ET, zipfile, os
ROOT=Path(__file__).resolve().parents[1];TOOLS=ROOT/"tools"
issues=[]
class AuditParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True);self.links=[];self.meta={};self.canonical=None;self.jsonscripts=[];self._json=False
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag in ("a","img","script","link"):
            for key in ("href","src"):
                if a.get(key):self.links.append(a[key])
        if tag=="link" and a.get("rel")=="canonical":self.canonical=a.get("href")
        if tag=="meta":
            k=a.get("property") or a.get("name")
            if k:self.meta[k]=a.get("content")
        if tag=="script" and a.get("type")=="application/ld+json":self._json=True
    def handle_data(self,data):
        if self._json:self.jsonscripts.append(data)
    def handle_endtag(self,tag):
        if tag=="script":self._json=False
def local_link(src,path):
    parsed=urlparse(src)
    if parsed.scheme or src.startswith(("#","mailto:","tel:","data:","javascript:","//")):return None
    rel=unquote(parsed.path)
    if not rel:return None
    target=(ROOT/rel.lstrip("/")) if rel.startswith("/") else (path.parent/rel)
    if target.is_dir():target/= "index.html"
    if not target.suffix and not target.exists():target/= "index.html"
    return target
SKIP_DIRS={"node_modules","skills","agent"}
def keep_dir(name): return name not in SKIP_DIRS and (not name.startswith(".") or name==".well-known")
def site_files(suffix):
    out=[]
    for base,dirs,files in os.walk(ROOT):
        dirs[:]=[d for d in dirs if keep_dir(d)]
        out.extend(Path(base)/f for f in files if f.endswith(suffix))
    return out
html_pages=site_files(".html")
# The independent 2259 market-research page deliberately has no tracking or
# public search listing. Keep its asset, JSON-LD and legacy-dependency audits.
STANDALONE_RESEARCH=TOOLS/"zijin-2259"/"index.html"
def is_private_research_page(path, html):
    return path==STANDALONE_RESEARCH and '<meta name="robots" content="noindex,nofollow">' in html
home_runtime=(ROOT/"assets"/"home-runtime.js").read_text(encoding="utf-8",errors="replace") if (ROOT/"assets"/"home-runtime.js").exists() else ""
for page in html_pages:
    text=page.read_text(encoding="utf-8",errors="replace")
    is_redirect=('http-equiv="refresh"' in text.lower() and 'This page has moved' in text)
    analytics_loaded="/tools/assets/analytics-loader.js" in text
    if page==ROOT/"index.html" and "/assets/home-runtime.js" in text:
        analytics_loaded=analytics_loaded or "/tools/assets/analytics-loader.js" in home_runtime
    if not is_redirect and not analytics_loaded and not is_private_research_page(page,text):
        issues.append((str(page),"missing analytics consent loader"))
robots_text=(ROOT/"robots.txt").read_text(encoding="utf-8",errors="replace")
if "Sitemap: https://ragunauthramsaroop.com/tools/sitemap.xml" not in robots_text:
    issues.append((str(ROOT/"robots.txt"),"tools sitemap not advertised"))
try:
    tool_map=ET.parse(TOOLS/"sitemap.xml").getroot()
    tool_locs=[e.text for e in tool_map.iter() if e.tag.endswith("}loc") or e.tag=="loc"]
    if len(tool_locs)<20:
        issues.append((str(TOOLS/"sitemap.xml"),"unexpectedly small tools sitemap"))
except Exception as ex:
    issues.append((str(TOOLS/"sitemap.xml"),"invalid tools sitemap: "+str(ex)))
sitemap=ET.parse(ROOT/"sitemap.xml").getroot()
locs={e.text for e in sitemap.iter() if e.tag.endswith("}loc") or e.tag=="loc"}
for path in html_pages:
    s=path.read_text(encoding="utf-8",errors="replace")
    p=AuditParser()
    try:p.feed(s)
    except Exception as ex:issues.append((str(path),"HTML parse: "+str(ex)))
    for src in p.links:
        dest=local_link(src,path)
        if dest is not None and not dest.exists():issues.append((str(path),"missing asset: "+src))
    for raw in p.jsonscripts:
        try:json.loads(raw)
        except Exception as ex:issues.append((str(path),"invalid JSON-LD: "+str(ex)))
    if TOOLS in path.parents and path.name=="index.html" and path.parent.name!="assets" and not is_private_research_page(path,s):
        if not p.canonical or not p.canonical.startswith("https://ragunauthramsaroop.com/tools/"):issues.append((str(path),"canonical mismatch"))
        if p.canonical not in locs:issues.append((str(path),"missing from root sitemap"))
        if path.parent.parent==TOOLS and path.parent.name not in ("privacy","categories"):
            if "RR_GUIDE" not in s:issues.append((str(path),"missing editorial guide"))
            og=p.meta.get("og:image","")
            if not og.endswith("/"+path.parent.name+".png"):issues.append((str(path),"og:image not unique"))
            if "tools/assets/tools.js" not in s and "tools/assets/growth-tools.js" not in s and "tools/assets/next-wave.js" not in s and not (path.parent.name=="geolibre" and "/tools/geolibre/geolibre.js" in s):issues.append((str(path),"missing tool runtime"))
    if "data-appdeploy-overlay" in s or "data-appdeploy-network-hook" in s:issues.append((str(path),"legacy AppDeploy overlay"))
imgs=list((TOOLS/"assets"/"og").glob("*.png"))
for p in imgs:
    b=p.read_bytes()[:24]
    if len(b)!=24 or b[:8]!=b"\x89PNG\r\n\x1a\n" or struct.unpack(">II",b[16:24])!=(1200,630):
        issues.append((str(p),"incorrect social image"))
z=TOOLS/"downloads"/"rr-free-templates.zip"
if not zipfile.is_zipfile(z):issues.append((str(z),"ZIP missing or invalid"))
elif len(zipfile.ZipFile(z).namelist())<18:issues.append((str(z),"template pack unexpectedly incomplete"))
for js in [TOOLS/"assets"/"tools.js",TOOLS/"assets"/"growth-tools.js"]:
    if "api-v2.appdeploy" in js.read_text(encoding="utf-8"):issues.append((str(js),"paid API dependency"))
# AppDeploy dependency must remain fully removed.
for needle in ("api-v2.appdeploy.ai","@appdeploy/client","ws-v2.appdeploy.ai"):
    for f in html_pages+list((ROOT/"_next"/"static").rglob("*.js")):
        try:
            if needle in f.read_text(encoding="utf-8",errors="replace"):
                issues.append((str(f),"legacy AppDeploy dependency: "+needle))
        except Exception:
            pass
# Browser-side evidence assistant integrity.
try:
    idx=json.loads((ROOT/"assets"/"research-index.json").read_text(encoding="utf-8"))
    if len(idx.get("documents",[]))<20:
        issues.append((str(ROOT/"assets"/"research-index.json"),"research index unexpectedly small"))
except Exception as ex:
    issues.append((str(ROOT/"assets"/"research-index.json"),"invalid research index: "+str(ex)))
if not (ROOT/"assets"/"research-assistant.js").exists():
    issues.append((str(ROOT/"assets"/"research-assistant.js"),"local research assistant missing"))
try:
    topic_map=ET.parse(ROOT/"topics"/"sitemap.xml").getroot()
    if len([e for e in topic_map.iter() if e.tag.endswith("}loc") or e.tag=="loc"])<7:
        issues.append((str(ROOT/"topics"/"sitemap.xml"),"topic sitemap unexpectedly small"))
except Exception as ex:
    issues.append((str(ROOT/"topics"/"sitemap.xml"),"invalid topic sitemap: "+str(ex)))

# Public platform maturity checks.
for rel in ("methodology/index.html","resources/index.html","start/index.html","evidence/index.html","roadmap/index.html","open-use/index.html","suggest-a-tool/index.html","guides/index.html"):
    if not (ROOT/rel).exists():
        issues.append((str(ROOT/rel),"required platform page missing"))
try:
    resource_index=json.loads((ROOT/"assets"/"resource-index.json").read_text(encoding="utf-8"))
    if len(resource_index.get("resources",[]))<70:
        issues.append((str(ROOT/"assets"/"resource-index.json"),"resource centre unexpectedly small"))
except Exception as ex:
    issues.append((str(ROOT/"assets"/"resource-index.json"),"invalid resource centre index: "+str(ex)))
method_text=(ROOT/"methodology"/"index.html").read_text(encoding="utf-8",errors="replace") if (ROOT/"methodology"/"index.html").exists() else ""
if method_text.count('class="method-card"')<20:
    issues.append((str(ROOT/"methodology"/"index.html"),"methodology register unexpectedly incomplete"))
if not (ROOT/"tools"/"assets"/"report-export.js").exists():
    issues.append((str(ROOT/"tools"/"assets"/"report-export.js"),"report exporter missing"))
llms=(ROOT/"llms.txt").read_text(encoding="utf-8",errors="replace") if (ROOT/"llms.txt").exists() else ""
if "�" in llms or "https://www.ragunauthramsaroop.com/" in llms:
    issues.append((str(ROOT/"llms.txt"),"llms.txt contains corrupted text or noncanonical www URLs"))
keys=[x for x in ROOT.glob("*.txt") if re.fullmatch(r"[A-Za-z0-9-]{32,64}\.txt",x.name) and x.read_text(encoding="utf-8",errors="ignore").strip()==x.stem]
if not keys:
    issues.append((str(ROOT),"IndexNow verification key missing"))

print("HTML_PAGES",len(html_pages))
print("TOOL_INDEX_PAGES",len([p for p in html_pages if TOOLS in p.parents and p.name=="index.html"]))
print("SHARE_IMAGES",len(imgs))
print("SITEMAP_URLS",len(locs))
print("TEMPLATE_PACK_FILES",len(zipfile.ZipFile(z).namelist()) if zipfile.is_zipfile(z) else 0)
print("ISSUES",len(issues))
for p,msg in issues[:80]:print("FAIL",p,msg)
sys.exit(1 if issues else 0)
