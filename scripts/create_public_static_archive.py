#!/usr/bin/env python3
"""Preserve public GitHub Pages static output, excluding unrelated/private projects.

An off-GitHub copy is required for independent storage. This package holds
public HTML, assets, tools and original papers, not secrets, Git history,
DNS registrar access, or non-static backends.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import zipfile

ROOT=Path(__file__).resolve().parents[1]
EXCLUDED_TOP={
    ".git", ".github", ".venv", "node_modules", "outreach", "prismdeck",
    "ssrn-bridge", "agent", "career-assets", "scripts", "docs", "gateway",
    "marketing", "audit", "recovery-artifacts", "__pycache__", ".next",
}
PUBLIC_BINARY_EXT={
    ".html", ".css", ".js", ".json", ".xml", ".txt", ".webmanifest", ".svg",
    ".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".ico", ".woff",
    ".woff2", ".otf", ".ttf", ".pdf", ".csv", ".geojson", ".map", ".wasm",
    ".webm", ".mp4", ".bin", ".gz", ".br", ".pf_fragment", ".pf_meta",
    ".pf_index", ".pf_filter", ".pf_sort", ".pf_data",
}
PUBLIC_EXACT={".nojekyll", "CNAME"}
MANDATORY={
    "index.html","robots.txt","sitemap.xml","llms.txt","CNAME",
    "research-library/index.html",
    "research-library/guyana-biodiversity-investment-readiness/full-text.pdf",
    "research-library/building-for-generations-guyana/full-text.pdf",
    "public-record/index.html","claim-graph/index.html",
    "executive-private-room/index.html","credential-readiness/index.html",
    "api/v1/executive-record.json","api/v1/claim-graph.json",
    "api/v1/provenance.json",
}

def select(root=ROOT):
    items=[]
    for f in root.rglob("*"):
        if not f.is_file():continue
        rel=f.relative_to(root)
        if f.is_symlink():continue
        if any(part in EXCLUDED_TOP or part.startswith(".") for part in rel.parts[:-1]):
            continue
        if rel.parts[0] in EXCLUDED_TOP:continue
        name=rel.name
        if name.startswith(".") and name not in PUBLIC_EXACT:continue
        if name not in PUBLIC_EXACT and f.suffix.lower() not in PUBLIC_BINARY_EXT:
            continue
        items.append((rel.as_posix(),f))
    items.sort()
    have={path for path,_ in items}
    missing=MANDATORY-have
    if missing:raise ValueError("Required public files absent: "+", ".join(sorted(missing)))
    if len(items)<500:raise ValueError("Public static archive too small: "+str(len(items)))
    for rel,_ in items:
        if rel.startswith("outreach/") or rel.startswith("ssrn-bridge/"):
            raise ValueError("Unapproved project included: "+rel)
    return items

def create(root=ROOT,outdir=Path("recovery-artifacts")):
    outdir.mkdir(parents=True,exist_ok=True)
    items=select(root)
    date=datetime.now(timezone.utc)
    output=outdir/("rr-public-static-site-"+date.strftime("%Y-%m-%d")+".zip")
    manifest={"format":"RR-Public-Static-Site-Recovery","version":"1.0.0",
        "generatedUTC":date.isoformat(),
        "sourceCommit":os.environ.get("GITHUB_SHA","unverified-local"),
        "scope":"Static GitHub Pages public files only, no private outreach, hosting account/DNS access, source history or dynamic backends",
        "includedFiles":len(items),"files":[]}
    with zipfile.ZipFile(output,"w",zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
        for path,file in items:
            raw=file.read_bytes()
            manifest["files"].append({"path":path,"sha256":hashlib.sha256(raw).hexdigest(),"bytes":len(raw)})
            z.write(file,arcname=path)
        z.writestr("MANIFEST.json",json.dumps(manifest,indent=2)+"\n")
        z.writestr("READ_FIRST.txt",
            "This is a verified export of publicly served static files. It is NOT\n"
            "a complete Git repository, private outreach archive, DNS registrar backup\n"
            "or a live cloud-server backup. Verify SHA-256 sidecar and MANIFEST.json.\n"
            "Use independent storage. Restore to an owner-controlled static host,\n"
            "configure the custom domain and HTTPS, then check sitemap and links.\n")
    digest=hashlib.sha256(output.read_bytes()).hexdigest()
    (outdir/(output.name+".sha256")).write_text(digest+"  "+output.name+"\n")
    print("PUBLIC_SITE_ARCHIVE",output,"files",len(items),"bytes",output.stat().st_size)
    return output

def verify(path):
    path=Path(path)
    sidecar=path.with_name(path.name+".sha256")
    if hashlib.sha256(path.read_bytes()).hexdigest()!=sidecar.read_text().split()[0]:
        raise ValueError("ZIP checksum mismatch")
    with zipfile.ZipFile(path) as z:
        if z.testzip():raise ValueError("Broken ZIP member")
        names=z.namelist()
        if len(names)!=len(set(names)):raise ValueError("Duplicate ZIP member")
        manifest=json.loads(z.read("MANIFEST.json"))
        if manifest.get("format")!="RR-Public-Static-Site-Recovery":
            raise ValueError("Unknown archive manifest")
        recs={v["path"]:v for v in manifest["files"]}
        if len(recs)!=manifest["includedFiles"] or len(recs)<500:
            raise ValueError("Unexpected number of files")
        if set(names)!=set(recs)|{"MANIFEST.json","READ_FIRST.txt"}:
            raise ValueError("Unlisted or absent ZIP member")
        if not MANDATORY.issubset(recs):
            raise ValueError("Static snapshot lacks core pages")
        for rel,row in recs.items():
            p=Path(rel)
            if p.is_absolute() or ".." in p.parts or p.parts[0] in EXCLUDED_TOP:
                raise ValueError("Forbidden backup path: "+rel)
            data=z.read(rel)
            if len(data)!=row["bytes"] or hashlib.sha256(data).hexdigest()!=row["sha256"]:
                raise ValueError("Unverifiable member: "+rel)
    print("PASS entire public static site snapshot",manifest["includedFiles"],"files")
    return 0

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    mx=parser.add_mutually_exclusive_group(required=True)
    mx.add_argument("--output",type=Path)
    mx.add_argument("--verify",type=Path)
    args=parser.parse_args()
    try:
        if args.verify:sys.exit(verify(args.verify))
        create(ROOT,args.output)
    except (OSError,ValueError,KeyError,zipfile.BadZipFile) as e:
        print("FAIL static archive:",e)
        sys.exit(1)
