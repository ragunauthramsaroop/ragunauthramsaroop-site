#!/usr/bin/env python3
"""Build/verify a strictly allowlisted public-core recovery ZIP.

NOT a whole-site or off-provider backup; excludes outreach, credentials, secrets,
history and research PDF corpus. Download the artifact to independent storage.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import zipfile

ROOT=Path(__file__).resolve().parents[1]
FILES=(
    "CNAME","robots.txt","sitemap.xml","llms.txt","README.md","AGENTS.md",
    "index.html","resume.html","service-worker.js","favicon.svg",
    "assets/home-executive-20260930-v3.css","assets/home-runtime.js",
    "assets/randy-portrait.jpg","assets/preview.png",
    "assets/public-record.css","assets/private-executive-room.css",
    "assets/private-executive-room.js",
    "public-record/index.html","public-record/es/index.html",
    "public-record/pt/index.html","public-record/fr/index.html",
    "claim-graph/index.html","executive-private-room/index.html",
    "api/v1/executive-record.json","api/v1/claim-graph.json",
    "api/v1/openapi.json","api/v1/provenance.json",
    "data/public-profile.json","data/provenance.json",
    "docs/public-record-continuity-2046.md",
    "docs/executive-knowledge-graph-and-languages.md",
    "docs/private-executive-room.md",
)
README_TEXT="""PUBLIC-CORE RECOVERY BUNDLE
This is a selected public professional record and its core support files.
Not included: the full site, source history, research PDFs, private outreach,
deployment secrets, DNS zone configuration, analytics data or email accounts.

VERIFY: Run create_public_recovery_bundle.py --verify bundle.zip; it
checks every packaged file against SHA-256 values in MANIFEST.json.
RESTORE: Review MANIFEST.json, restore files into a clean GitHub Pages
project, configure the domain and HTTPS separately, test all routes,
then submit updated sitemaps. See the public repo's docs.
SAFETY: No SHA-256 hash or self-published record is an issuer signature.
Backup is only independent after saved outside the original GitHub repo.
"""

def collect(root):
    out=[]
    for path in FILES:
        file=root/path
        if not file.is_file() or file.is_symlink():
            raise FileNotFoundError("Public recovery file missing or symlinked: "+path)
        data=file.read_bytes()
        out.append((path,data,hashlib.sha256(data).hexdigest()))
    return out

def create(root=ROOT,directory=Path("recovery-artifacts"),issued=None):
    directory.mkdir(parents=True,exist_ok=True)
    now=issued or datetime.now(timezone.utc)
    stamp=now.strftime("%Y-%m-%d")
    filename=directory/("rr-public-core-"+stamp+".zip")
    records=collect(root)
    manifest={"format":"RR-Public-Core-Recovery","version":"1.0.0",
              "generatedUTC":now.isoformat(),"sourceCommit":os.environ.get("GITHUB_SHA","unverified-local"),
              "scope":"selected public professional records, not full site or independent off-provider backup",
              "hashAlgorithm":"SHA-256",
              "files":[{"path":p,"sha256":digest,"bytes":len(data)} for p,data,digest in records]}
    with zipfile.ZipFile(filename,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for path,data,_ in records:
            z.writestr(path,data)
        z.writestr("MANIFEST.json",json.dumps(manifest,indent=2)+"\n")
        z.writestr("READ_THIS_FIRST.txt",README_TEXT)
    digest=hashlib.sha256(filename.read_bytes()).hexdigest()
    (directory/(filename.name+".sha256")).write_text(digest+"  "+filename.name+"\n",encoding="utf-8")
    print("RECOVERY_CREATED",filename,"files",len(records),"bytes",filename.stat().st_size)
    return filename

def verify(filename):
    filename=Path(filename)
    sidecar=filename.with_name(filename.name+".sha256")
    if not sidecar.is_file():raise FileNotFoundError("Missing companion SHA-256 checksum")
    expected=sidecar.read_text(encoding="utf-8").split()[0]
    actual=hashlib.sha256(filename.read_bytes()).hexdigest()
    if actual!=expected:raise ValueError("ZIP checksum mismatch")
    with zipfile.ZipFile(filename) as z:
        entries=z.namelist()
        if len(entries)!=len(set(entries)):raise ValueError("Duplicate archive entry")
        manifest=json.loads(z.read("MANIFEST.json"))
        if manifest["format"]!="RR-Public-Core-Recovery":raise ValueError("Unknown manifest")
        recorded={row["path"] for row in manifest["files"]}
        if recorded!=set(FILES):raise ValueError("Unexpected missing or added recovery file")
        if set(entries)!=recorded|{"MANIFEST.json","READ_THIS_FIRST.txt"}:
            raise ValueError("Unlisted archive entry")
        for row in manifest["files"]:
            name=row["path"]
            if name.startswith("/") or ".." in Path(name).parts:raise ValueError("Archive traversal path")
            data=z.read(name)
            if len(data)!=row["bytes"] or hashlib.sha256(data).hexdigest()!=row["sha256"]:
                raise ValueError("Recovery member hash mismatch: "+name)
    print("PASS verified public-core archive",len(recorded),"files")
    return 0

if __name__=="__main__":
    p=argparse.ArgumentParser()
    mode=p.add_mutually_exclusive_group(required=True)
    mode.add_argument("--output",type=Path)
    mode.add_argument("--verify",type=Path)
    args=p.parse_args()
    try:sys.exit(verify(args.verify) if args.verify else (create(ROOT,args.output) and 0))
    except (FileNotFoundError,ValueError,zipfile.BadZipFile,OSError) as exc:
        print("FAIL recovery:",exc)
        sys.exit(1)
