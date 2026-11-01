#!/usr/bin/env python3
"""Strict reproducible backup of the *public* original PDF research library.

The registered public editions are byte-preserved. Excludes private outreach,
unpublished working manuscripts, account tokens, git history and site backends.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import os
import sys
import zipfile

ROOT=Path(__file__).resolve().parents[1]
REG="research-library/publication-register.json"
EXTRAS=(
    REG,
    "research-library/scholar-readiness.json",
    "research-library/feed.xml",
    "research-library/index.html",
    "data/research-papers.json",
    "data/research-pages.json",
    "sitemap.xml",
    "llms.txt",
    "docs/public-recovery-runbook.md",
)

def collect(root=ROOT):
    registry=json.loads((root/REG).read_text(encoding="utf-8"))
    papers=registry.get("papers",[])
    if len(papers)<23:
        raise ValueError(f"Expected at least 23 published research editions; found {len(papers)}")
    paths={}
    for r in papers:
        slug=r["slug"]
        if not slug or "/" in slug or slug in (".",".."):
            raise ValueError("Unsafe paper slug")
        for rel in (f"research-library/{slug}/index.html",f"research-library/{slug}/full-text.pdf"):
            file=root/rel
            if not file.is_file() or file.is_symlink():
                raise FileNotFoundError("Public research member missing: "+rel)
            paths[rel]=file
        pdf=(root/f"research-library/{slug}/full-text.pdf").read_bytes()
        expected=r.get("scholar_pdf_sha256",r.get("sha256"))
        if not expected or hashlib.sha256(pdf).hexdigest()!=expected:
            raise ValueError("Published original PDF hash mismatch: "+slug)
        if not pdf.startswith(b"%PDF-") or len(pdf)<10000:
            raise ValueError("Invalid research PDF: "+slug)
    for rel in EXTRAS:
        file=root/rel
        if not file.is_file() or file.is_symlink():
            raise FileNotFoundError("Public source file missing: "+rel)
        paths[rel]=file
    return sorted(paths.items()),len(papers)

def create(root=ROOT,directory=Path("recovery-artifacts")):
    directory.mkdir(parents=True,exist_ok=True)
    files,count=collect(root)
    date=datetime.now(timezone.utc)
    output=directory/("rr-complete-public-research-"+date.strftime("%Y-%m-%d")+".zip")
    manifest={"format":"RR-Complete-Public-Research-Backup","version":"1.0.0",
        "created_utc":date.isoformat(),
        "sourceCommit":os.environ.get("GITHUB_SHA","unverified-local"),
        "scope":"Public registered PDF research editions and their pages, not full site or private records",
        "originalPdfCount":count,
        "files":[]}
    for name,file in files:
        raw=file.read_bytes()
        manifest["files"].append({"path":name,"sha256":hashlib.sha256(raw).hexdigest(),"bytes":len(raw)})
    with zipfile.ZipFile(output,"w",zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
        for name,file in files:
            z.write(file,arcname=name)
        z.writestr("MANIFEST.json",json.dumps(manifest,indent=2)+"\n")
        z.writestr("RESTORE_INSTRUCTIONS.txt",
            "Public original research archive. This file is NOT the entire website.\n"
            "Check the sidecar SHA-256 and every member against MANIFEST.json.\n"
            "Restore each original PDF and publication page with its unchanged URL.\n"
            "Institutional research citations remain self-published; DOI and Google Scholar\n"
            "indexing require independent confirmation. Private/outreach material excluded.\n")
    signature=hashlib.sha256(output.read_bytes()).hexdigest()
    (directory/(output.name+".sha256")).write_text(signature+"  "+output.name+"\n")
    print("PUBLIC_RESEARCH_ARCHIVE",output,"papers",count,"members",len(files),"bytes",output.stat().st_size)
    return output

def verify(archive):
    archive=Path(archive)
    sidecar=archive.with_name(archive.name+".sha256")
    expected=sidecar.read_text(encoding="utf-8").split()[0]
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=expected:
        raise ValueError("Archive SHA-256 does not match sidecar")
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:raise ValueError("Corrupted archive member")
        names=z.namelist()
        if len(names)!=len(set(names)):raise ValueError("Duplicate archive paths")
        m=json.loads(z.read("MANIFEST.json"))
        if m.get("format")!="RR-Complete-Public-Research-Backup" or m.get("originalPdfCount",0)<23:
            raise ValueError("Invalid research recovery manifest")
        records={x["path"]:x for x in m["files"]}
        if set(names)!=set(records)|{"MANIFEST.json","RESTORE_INSTRUCTIONS.txt"}:
            raise ValueError("Unexpected/missing archive member")
        pdfs=[k for k in records if k.endswith("/full-text.pdf")]
        if len(pdfs)!=m["originalPdfCount"]:raise ValueError("Missing registered PDF")
        for name,record in records.items():
            if name.startswith("/") or ".." in Path(name).parts:
                raise ValueError("Unsafe member path")
            raw=z.read(name)
            if hashlib.sha256(raw).hexdigest()!=record["sha256"] or len(raw)!=record["bytes"]:
                raise ValueError("File integrity mismatch: "+name)
    print("PASS complete research recovery:",len(pdfs),"original PDFs and",len(records),"source files")
    return 0

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--output",type=Path)
    group.add_argument("--verify",type=Path)
    args=parser.parse_args()
    try:
        if args.verify:sys.exit(verify(args.verify))
        create(ROOT,args.output)
    except (OSError,ValueError,KeyError,zipfile.BadZipFile) as exc:
        print("FAIL research recovery:",exc)
        sys.exit(1)
