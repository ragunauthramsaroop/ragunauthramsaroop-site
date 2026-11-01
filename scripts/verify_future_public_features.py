#!/usr/bin/env python3
"""Future executive site trust model QA. No network calls or extra dependencies."""
from pathlib import Path
import json
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]
errors=[]
def check(ok,message):
    if not ok:errors.append(message)
def read(path):return (ROOT/path).read_text(encoding="utf-8")
source=json.loads(read("api/v1/executive-record.json"))
graph=json.loads(read("api/v1/claim-graph.json"))
claim_ids={x["id"] for x in source["claims"]}
nodes={x["id"]:x for x in graph["nodes"]}
check(graph["subjectId"]==source["subject"]["@id"],"Graph person ID mismatch")
check(graph["nodeCount"]==len(graph["nodes"]) and graph["edgeCount"]==len(graph["edges"]),"Graph count mismatch")
check(len(nodes)==len(graph["nodes"]),"Duplicate graph IDs")
check({x.split("claim:",1)[-1] for x in nodes if x.startswith("claim:")}==claim_ids,"Claim graph does not cover exact public record")
for e in graph["edges"]:
    check(e["from"] in nodes and e["to"] in nodes,"Edge refers to a nonexistent node")
for claim in source["claims"]:
    cid="claim:"+claim["id"]
    matches=[e for e in graph["edges"] if e["from"]==cid and e["relation"]=="references"]
    check(len(matches)==len(claim["evidence"]),"Evidence edges mismatch for "+cid)
    if claim["classification"]=="company_reported_operating_context":
        check(any(e["from"]==cid and e["relation"]=="describes_organization_not_personal_result" for e in graph["edges"]),"Missing company attribution boundary")
check("no inferred" in graph["purpose"].lower() or "no inferred" in " ".join(graph.get("limitations",[])).lower() or "no inferred" in read("docs/executive-knowledge-graph-and-languages.md").lower(),"Do not infer verification from graph links")
class Page(HTMLParser):
    def __init__(self):super().__init__();self.h1=0;self.canonical="";self.tags=set()
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=="h1":self.h1+=1
        if tag=="link" and a.get("rel")=="canonical":self.canonical=a.get("href")
        if tag=="link" and a.get("hreflang"):self.tags.add(a.get("hreflang"))
for lang in ("es","pt","fr"):
    doc=read("public-record/"+lang+"/index.html")
    parsed=Page();parsed.feed(doc)
    check(parsed.h1==1 and parsed.canonical.endswith("/"+lang+"/"),"Multilingual canonical or heading failed "+lang)
    check(parsed.tags=={"en","es","pt","fr"},"Nonreciprocal language alternates "+lang)
    check('href="/public-record/"' in doc and "2025" in doc,"English source and dated role required "+lang)
    check('analytics-loader.js' in doc,"Consent-aware analytics compatibility missing "+lang)
script=read("assets/private-executive-room.js")
for forbidden in ("localStorage","sessionStorage","fetch(","XMLHttpRequest","sendBeacon","location.hash","location.search","innerHTML","eval("):
    check(forbidden not in script,"Unexpected private briefing leak surface "+forbidden)
private=read("executive-private-room/index.html")
check("name=\"mandate\"" in private and "autocomplete=\"off\"" in private and 'id="report"' in private,"Private intake or report missing")
check("analytics-loader.js" in private and "No server submission" in private,"Privacy and existing consent compatibility missing")
check('<form' in private and "method=" not in private,"Unexpected remote form method")
openapi=json.loads(read("api/v1/openapi.json"))
check("/claim-graph.json" in openapi["paths"],"Claim graph not listed in OpenAPI")
for path in ("claim-graph/","executive-private-room/","public-record/es/","public-record/pt/","public-record/fr/"):
    check(("https://ragunauthramsaroop.com/"+path) in {e.text for e in ET.parse(ROOT/"sitemap.xml").iter() if e.tag.rsplit("}",1)[-1]=="loc"},"Missing sitemap path: "+path)
status=json.loads(read("api/v1/credential-status.json"))
check(status["issuerCredentials"]==[] and status["status"]=="none_registered","Credential status must not imply issuer verification")
credential_page=read("credential-readiness/index.html")
check("No issuer-signed digital credentials registered" in credential_page,"Honest credential status missing")
check("https://ragunauthramsaroop.com/credential-readiness/" in {e.text for e in ET.parse(ROOT/"sitemap.xml").iter() if e.tag.rsplit("}",1)[-1]=="loc"},"Credential readiness missing from sitemap")
if errors:
    for error in errors:print("FAIL:",error)
    sys.exit(1)
print("PASS graph nodes, sources and attribution; three reciprocal language pages; session-only private briefing security gates")
