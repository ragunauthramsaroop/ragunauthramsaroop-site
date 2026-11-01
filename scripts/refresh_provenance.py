#!/usr/bin/env python3
"""Recalculate the existing public SHA-256 provenance registry from current bytes.

Use --refresh after all public-file builders complete; --check is read-only.
Git commits retain historical versions; this is an unsigned integrity registry.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
CANONICAL="data/provenance.json"
MIRROR="api/v1/provenance.json"
# Canonical identity/record sources must remain covered even as the registry grows.
MUST_TRACK=(
    "/index.html",
    "/resume.html",
    "/data/public-profile.json",
    "/data/source-monitor.json",
    "/public-record/index.html",
    "/api/v1/executive-record.json",
)

def scan(root:Path):
    path=root/CANONICAL
    previous=json.loads(path.read_text(encoding="utf-8"))
    if previous.get("algorithm")!="SHA-256" or not isinstance(previous.get("resources"),list):
        raise ValueError("Invalid SHA-256 registry schema")
    records={row["path"]:dict(row) for row in previous["resources"]}
    if len(records)!=len(previous["resources"]):
        raise ValueError("Duplicate registry paths")
    for required in MUST_TRACK:
        records.setdefault(required,{"path":required})
    today=datetime.now(timezone.utc).strftime("%d %B %Y")
    changed=[]
    for path,row in records.items():
        if not path.startswith("/") or ".." in Path(path).parts or "\\" in path:
            raise ValueError("Unsafe registry path: "+path)
        file=root/path.lstrip("/")
        if not file.is_file():
            raise FileNotFoundError("Registered public file is missing: "+path)
        data=file.read_bytes()
        digest=hashlib.sha256(data).hexdigest()
        if row.get("sha256")!=digest or row.get("bytes")!=len(data):
            row["sha256"]=digest
            row["bytes"]=len(data)
            row["generated"]=today
            changed.append(path)
    result={"generated":today if changed else previous["generated"],
            "algorithm":"SHA-256",
            "resources":list(records.values())}
    return previous,result,changed

def run(root=ROOT,refresh=False):
    previous,result,changed=scan(root)
    current_mirror=(root/MIRROR).read_text(encoding="utf-8")
    canonical=(root/CANONICAL).read_text(encoding="utf-8")
    in_sync=(json.loads(current_mirror)==previous)
    print("PROVENANCE", "registered",len(result["resources"]),"outdated",len(changed),"mirror_equal",in_sync)
    if refresh:
        desired=json.dumps(result,ensure_ascii=False,indent=2)+"\n"
        if desired!=canonical or current_mirror!=desired:
            (root/CANONICAL).write_text(desired,encoding="utf-8")
            (root/MIRROR).write_text(desired,encoding="utf-8")
        print("PASS regenerated registry from actual repository bytes; historical records remain in Git history")
        return 0
    if changed or not in_sync:
        for path in changed[:20]:print("DRIFT",path)
        if len(changed)>20:print("DRIFT additional resources",len(changed)-20)
        if not in_sync:print("DRIFT canonical and public API registry differ")
        return 1
    print("PASS all published registered SHA-256 hashes match actual local bytes")
    return 0

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--refresh",action="store_true")
    group.add_argument("--check",action="store_true")
    args=parser.parse_args()
    try:sys.exit(run(refresh=args.refresh))
    except (OSError,ValueError,KeyError,TypeError) as exc:
        print("FAIL provenance",str(exc))
        sys.exit(1)
