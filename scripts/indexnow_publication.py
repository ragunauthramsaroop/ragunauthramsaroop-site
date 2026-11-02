#!/usr/bin/env python3
"""Notify IndexNow of newly published URLs with a publicly verifiable key.

This is NOT Google Search Console, not confirmation of indexing or rankings.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
HOST="ragunauthramsaroop.com"
DOMAIN="https://"+HOST
ENDPOINT="https://api.indexnow.org/indexnow"
FIRST_EDITION=(
    "/research-library/guyana-biodiversity-investment-readiness/",
    "/research-library/guyana-biodiversity-investment-readiness/full-text.pdf",
    "/research-library/building-for-generations-guyana/",
    "/research-library/building-for-generations-guyana/full-text.pdf",
)
SITEMAP="sitemap.xml"

def key_file(root=ROOT):
    for f in sorted(root.glob("*.txt")):
        if re.fullmatch(r"[A-Za-z0-9-]{32,64}\.txt",f.name) and f.read_text(encoding="utf-8").strip()==f.stem:
            return f
    raise ValueError("No verified public IndexNow key file")

def sitemaps(root=ROOT):
    urls=set()
    for path in (root/"sitemap.xml",root/"tools/sitemap.xml",root/"topics/sitemap.xml"):
        if path.is_file():
            for entry in ET.parse(path).iter():
                if entry.tag.rsplit("}",1)[-1]=="loc" and entry.text:
                    candidate=entry.text.strip()
                    if urlparse(candidate).hostname==HOST and candidate.startswith(DOMAIN+"/"):
                        urls.add(candidate)
    return urls

def path_to_urls(name):
    name=name.replace("\\","/")
    if name=="index.html":return {DOMAIN+"/"}
    if name.endswith("/index.html"):
        return {DOMAIN+"/"+name[:-len("index.html")]}
    if name.endswith(".html"):
        return {DOMAIN+"/"+name}
    if name.startswith("research-library/") and name.endswith("/full-text.pdf"):
        return {DOMAIN+"/"+name,DOMAIN+"/"+name[:-len("full-text.pdf")]}
    return set()

def changed_urls(files,registered):
    urls=set()
    for name in files:
        urls.update(path_to_urls(name))
    if ".github/workflows/indexnow-publication.yml" in files:
        urls.update(DOMAIN+route for route in FIRST_EDITION)
    # Only submit URLs explicitly present in sitemaps.
    return sorted(url for url in urls if url in registered)

def git_diff(root,before,after):
    # A freshly added repo or a zero base needs a conservative empty result;
    # bootstrap edition routes are handled when the workflow itself is added.
    if not before or set(before)=={"0"}:
        return [".github/workflows/indexnow-publication.yml"]
    cmd=["git","-C",str(root),"diff","--name-only",before,after]
    p=subprocess.run(cmd,check=False,capture_output=True,text=True)
    if p.returncode!=0:
        raise RuntimeError("Could not compare GitHub commit range")
    return p.stdout.splitlines()

def main(root=ROOT,base="",head="HEAD",dry_run=False):
    public_key=key_file(root)
    entries=git_diff(root,base,head)
    urls=changed_urls(entries,sitemaps(root))
    if not urls:
        print("INDEXNOW no newly published sitemap URLs in change set")
        return 0
    if len(urls)>500:
        raise ValueError("Unexpectedly large IndexNow submit set")
    payload={"host":HOST,"key":public_key.stem,
        "keyLocation":DOMAIN+"/"+public_key.name,"urlList":urls}
    print("INDEXNOW planned URLs",len(urls),*urls,sep="\n")
    if dry_run:
        print("INDEXNOW dry run; no external request")
        return 0
    request=Request(ENDPOINT,data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type":"application/json; charset=utf-8",
                 "User-Agent":"RR-Public-IndexNow/1.0"},method="POST")
    try:
        with urlopen(request,timeout=25) as response:
            code=response.status
            body=response.read(1000).decode("utf-8","replace")
    except HTTPError as error:
        code=error.code
        body=error.read(1000).decode("utf-8","replace")
    except (URLError,TimeoutError,OSError) as error:
        print("INDEXNOW transport issue",type(error).__name__)
        return 1
    print("INDEXNOW status",code,"response",body[:150])
    # 202 is key pending verification, not search indexing success.
    return 0 if code in (200,202) else 1

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--base-sha",default="")
    p.add_argument("--head-sha",default="HEAD")
    p.add_argument("--dry-run",action="store_true")
    a=p.parse_args()
    try:sys.exit(main(base=a.base_sha,head=a.head_sha,dry_run=a.dry_run))
    except (ValueError,RuntimeError,ET.ParseError) as error:
        print("FAIL IndexNow",error)
        sys.exit(1)
