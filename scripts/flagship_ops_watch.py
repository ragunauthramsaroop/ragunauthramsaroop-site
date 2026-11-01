#!/usr/bin/env python3
"""Read-only SEO and intelligence monitoring for GitHub-hosted scheduled checks."""
import argparse
from datetime import datetime, timezone
from html.parser import HTMLParser
import html
import json
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
DOMAIN="https://ragunauthramsaroop.com"
ROUTES=("/", "/executive-profile/", "/resume.html", "/recruiter-mode/", "/evidence/", "/research-library/", "/engage/")
NOW=datetime.now(timezone.utc)
AGENT="RR-Flagship-Watch/1.0 (+https://ragunauthramsaroop.com/)"

class HTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.titles=[]; self.description=""; self.canonical=""; self.robots=""; self.h1=0
        self._title=False; self._json=False; self._jsontext=[]; self.jsonld=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=="title": self._title=True
        if tag=="h1": self.h1+=1
        if tag=="meta":
            if (a.get("name") or "").lower()=="description": self.description=a.get("content","")
            if (a.get("name") or "").lower()=="robots": self.robots=a.get("content","")
        if tag=="link" and "canonical" in (a.get("rel") or "").lower().split():
            self.canonical=a.get("href","")
        if tag=="script" and a.get("type")=="application/ld+json":
            self._json=True; self._jsontext=[]
    def handle_data(self,value):
        if self._title: self.titles.append(value)
        if self._json: self._jsontext.append(value)
    def handle_endtag(self,tag):
        if tag=="title": self._title=False
        if tag=="script" and self._json:
            self.jsonld.append("".join(self._jsontext).strip());self._json=False

def inspect_page(source,url,homepage=False):
    p=HTML();p.feed(source);errors=[]
    if "Ramsaroop" not in html.unescape(" ".join(p.titles)):errors.append("missing executive page title")
    if len(p.description.strip())<40:errors.append("missing/short meta description")
    if urljoin(url,p.canonical)!=url:errors.append("canonical is inconsistent")
    if p.h1!=1:errors.append(f"expected one H1, found {p.h1}")
    if "noindex" in p.robots.lower():errors.append("unexpected noindex")
    if homepage:
        if not p.jsonld: errors.append("homepage has no JSON-LD")
        for s in p.jsonld:
            try: json.loads(s)
            except json.JSONDecodeError:errors.append("invalid JSON-LD")
    return errors

def get(url):
    failure="no response"
    for attempt in range(2):
        try:
            request=Request(url,headers={"User-Agent":AGENT,"Cache-Control":"no-cache"})
            with urlopen(request,timeout=16) as response:
                dest=urlparse(response.geturl()).hostname
                if dest not in ("ragunauthramsaroop.com","www.ragunauthramsaroop.com"):
                    raise ValueError("unexpected external redirect")
                if response.status!=200:raise ValueError("HTTP "+str(response.status))
                return response.read(800001)[:800000].decode("utf-8","replace")
        except (HTTPError,URLError,TimeoutError,OSError,ValueError) as exc:
            failure=f"{type(exc).__name__}: {str(exc)[:105]}"
            if attempt==0:time.sleep(3)
    raise RuntimeError(failure)

def local_file(root,route):
    rel="index.html" if route=="/" else route.lstrip("/")
    if rel.endswith("/"):rel+="index.html"
    return root/rel

def static_watch(root,add):
    profile=json.loads((root/"data/public-profile.json").read_text(encoding="utf-8"))
    llms=(root/"llms.txt").read_text(encoding="utf-8")
    add("role_date",profile.get("current_role_since")=="2025","Current director appointment starts 2025")
    add("parent_company",profile.get("direct_parent")=="Zijin Gold International","Current direct parent named")
    add("llms_date","2025-Present" in llms and "2026-Present" not in llms,"AI-readable profile is aligned")
    add("llms_event","scheduled speaker on 16 October 2026" not in llms.lower(),"Elapsed conference is not future-scheduled")
    for route in ROUTES:
        page=local_file(root,route)
        if not page.is_file():
            add("route_"+route,False,"Local public page does not exist");continue
        problems=inspect_page(page.read_text(encoding="utf-8"),DOMAIN+route,route=="/")
        add("route_"+route,not problems,", ".join(problems) or "Canonical, title, H1, meta and indexability checked")
    try:
        xml=ET.parse(root/"sitemap.xml")
        loc={n.text for n in xml.iter() if n.tag.rsplit("}",1)[-1]=="loc"}
        missing=[path for path in ROUTES if DOMAIN+path not in loc]
        add("sitemap",not missing,"Missing "+", ".join(missing) if missing else "All flagship routes listed")
    except (ET.ParseError,OSError) as exc:add("sitemap",False,str(exc)[:120])

def seo_watch(add):
    for route in ROUTES:
        try:
            content=get(DOMAIN+route)
            problems=inspect_page(content,DOMAIN+route,route=="/")
            add("live_"+route,not problems,", ".join(problems) or "HTTP 200, canonical/indexability and heading valid")
        except RuntimeError as exc:add("live_"+route,False,str(exc))
    try:
        robots=get(DOMAIN+"/robots.txt")
        ok="Sitemap:" in robots and not re.search(r"(?im)^Disallow:\s*/\s*$",robots)
        add("robots",ok,"Sitemap advertised and no site-wide deny" if ok else "Robots policy invalid")
    except RuntimeError as exc:add("robots",False,str(exc))
    try:
        root=ET.fromstring(get(DOMAIN+"/sitemap.xml"))
        locs={n.text for n in root.iter() if n.tag.rsplit("}",1)[-1]=="loc"}
        absent=[p for p in ROUTES if DOMAIN+p not in locs]
        add("sitemap",not absent,"Missing "+", ".join(absent) if absent else "All flagship routes indexed in sitemap")
    except (RuntimeError,ET.ParseError) as exc:add("sitemap",False,str(exc)[:130])
    try:
        txt=get(DOMAIN+"/llms.txt")
        aligned="2025-Present" in txt and "2026-Present" not in txt
        add("ai_record",aligned,"Published AI profile aligned" if aligned else "Outdated director appointment in live AI-readable record")
    except RuntimeError as exc:add("ai_record",False,str(exc))

def intelligence_watch(root,add):
    registry=json.loads((root/"data/source-sources.json").read_text(encoding="utf-8")).get("sources",[])
    observed=json.loads((root/"data/source-monitor.json").read_text(encoding="utf-8"))
    metrics=json.loads((root/"data/guyana-live.json").read_text(encoding="utf-8"))
    expected={r["url"] for r in registry}
    got={r.get("url") for r in observed.get("sources",[])}
    add("coverage",len(expected)>=10 and expected<=got,f"Registered {len(expected)} official sources, snapshot covers {len(got)}")
    for label,doc in (("sources",observed),("indicators",metrics)):
        try:
            stamp=datetime.fromisoformat(doc["generated"].replace("Z","+00:00"))
            age=(NOW-stamp).total_seconds()/3600
            add(label+"_freshness",-1<=age<=72,f"Snapshot age {age:.1f} hours; maximum 72 hours")
        except (ValueError,KeyError,TypeError):add(label+"_freshness",False,"Invalid snapshot timestamp")
    records=observed.get("sources",[])
    unreachable=[x.get("name","source") for x in records if x.get("status")!="ok"]
    add("source_health",len(unreachable)<=max(2,len(records)//3),f"{len(unreachable)} failed checks; examples: {', '.join(unreachable[:3])}")
    changed=sum(bool(x.get("changed")) for x in records)
    add("source_changes",True,f"{changed} changed source pages; never treat a change as a verified fact")
    indicators=metrics.get("metrics",[])
    complete=all(x.get("source") and x.get("period") for x in indicators)
    add("metric_provenance",len(indicators)>=5 and complete,f"{len(indicators)} indicators with source and period")
    for filename,source in (("api/v1/sources.json",observed),("api/v1/guyana.json",metrics)):
        target=root/filename
        okay=target.exists() and json.loads(target.read_text(encoding="utf-8"))==source
        add("api_"+filename.replace("/","_"),okay,"API matches source snapshot" if okay else "API/source drift")

def run(mode,root=ROOT,output=None):
    if output is None:output=root/"audit/flagship-agents"
    findings=[]
    def add(key,ok,message):
        findings.append({"check":key,"status":"pass" if ok else "fail","message":message[:200]})
    if mode=="static":static_watch(root,add)
    elif mode=="seo":seo_watch(add)
    else:intelligence_watch(root,add)
    failures=[x for x in findings if x["status"]=="fail"]
    output.mkdir(parents=True,exist_ok=True)
    report={"mode":mode,"checked_at":NOW.isoformat(),"total":len(findings),"errors":len(failures),"checks":findings}
    (output/f"{mode}.json").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    lines=[f"# Flagship {mode.upper()} watch",f"UTC: {NOW.isoformat()}",
           f"Result: {len(findings)-len(failures)}/{len(findings)} checks passed.",
           "Deterministic technical checks only. No search ranking or AI-citation claims.",""]
    lines += [f"- {x['status'].upper()}: {x['check']}: {x['message']}" for x in findings]
    (output/f"{mode}.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
    print(f"FLAGSHIP_WATCH mode={mode} checked={len(findings)} errors={len(failures)}")
    for issue in failures:print("FAIL:",issue["check"],issue["message"])
    return int(bool(failures))

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--mode",choices=("static","seo","intelligence"),required=True)
    p.add_argument("--root",type=Path,default=ROOT)
    p.add_argument("--output",type=Path,default=None)
    args=p.parse_args()
    sys.exit(run(args.mode,args.root,args.output))
