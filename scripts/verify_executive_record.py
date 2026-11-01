#!/usr/bin/env python3
"""Verify the portable executive record without external services."""
from pathlib import Path
import json
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]
DOMAIN="https://ragunauthramsaroop.com/"
api=json.loads((ROOT/"api/v1/executive-record.json").read_text(encoding="utf-8"))
profile=json.loads((ROOT/"data/public-profile.json").read_text(encoding="utf-8"))
errors=[]

def require(ok,msg):
    if not ok: errors.append(msg)

class HTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.h1=0
        self.ids=set()
        self.links=set()
        self.canonical=""
        self.description=""
        self.title=False
        self.title_text=""
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if d.get("id"):self.ids.add(d["id"])
        if tag=="h1":self.h1+=1
        if tag=="a":self.links.add(d.get("href"))
        if tag=="link" and d.get("rel")=="canonical":self.canonical=d.get("href","")
        if tag=="meta" and d.get("name")=="description":self.description=d.get("content","")
        if tag=="title":self.title=True
    def handle_data(self,data):
        if self.title:self.title_text+=data
    def handle_endtag(self,tag):
        if tag=="title":self.title=False

require(api["schemaVersion"]=="1.0.0","Unexpected portable record version")
require(api["subject"]["@id"]==DOMAIN+"#person","Person identifier differs from the existing homepage identity")
require(api["subject"]["name"]==profile["name"],"Name differs from canonical profile")
require(api["subject"]["jobTitle"]==profile["current_role"],"Current role differs from canonical profile")
require(api["subject"]["worksFor"]["name"]==profile["employer"],"Employer differs from canonical profile")
require(api["issuedAt"]=="2026-11-01","Public record issue date should be explicit and stable")
require(api["publisherType"]=="self-published" and "not an independently issued" in api["status"],"Missing self-publication boundary")
claims=api.get("claims",[])
ids=[c.get("id") for c in claims]
require(len(ids)==len(set(ids)) and len(ids)>=4,"Claim IDs must remain unique and complete")
require(next((c["effectiveFrom"] for c in claims if c["id"]=="professional-role"),None)==profile["current_role_since"],"Director appointment start inconsistent")
for claim in claims:
    require(claim.get("scope") and claim.get("classification") and claim.get("evidence"),"Claim missing boundaries or sources")
    for evidence in claim.get("evidence",[]):
        url=evidence.get("url","")
        require(url.startswith("https://"),"Claim has non-HTTPS evidence")
        if url.startswith(DOMAIN):
            relative=url[len(DOMAIN):]
            file=(ROOT/relative)
            if relative.endswith("/"):file=file/"index.html"
            require(file.is_file(),f"Claim evidence page missing: {relative}")
    if claim.get("classification")=="company_reported_operating_context":
        require("not an individual achievement" in claim.get("scope",""),"Company data must not be personal attribution")
page=HTML()
page.feed((ROOT/"public-record/index.html").read_text(encoding="utf-8"))
require(page.h1==1,"Public record needs exactly one H1")
require(page.canonical==DOMAIN+"public-record/","Public record canonical mismatch")
require(len(page.description)>=50,"Public record description missing")
require("/api/v1/executive-record.json" in page.links,"Machine-readable data link missing")
home=(ROOT/"index.html").read_text(encoding="utf-8")
require('href="/public-record/"' in home,"Home lacks record entry point")
llms=(ROOT/"llms.txt").read_text(encoding="utf-8")
require(DOMAIN+"public-record/" in llms,"AI-readable guide lacks public record")
xml=ET.parse(ROOT/"sitemap.xml")
locs={x.text for x in xml.iter() if x.tag.rsplit("}",1)[-1]=="loc"}
require(DOMAIN+"public-record/" in locs,"Sitemap lacks public record")
openapi=json.loads((ROOT/"api/v1/openapi.json").read_text(encoding="utf-8"))
require("/executive-record.json" in openapi["paths"],"Public API does not advertise portable record")
if errors:
    for err in errors:print("FAIL:",err)
    sys.exit(1)
print(f"PASS: dated portable executive record with {len(claims)} source-scoped claims, public page and API integration")
