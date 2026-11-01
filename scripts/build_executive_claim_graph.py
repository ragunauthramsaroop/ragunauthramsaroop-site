#!/usr/bin/env python3
"""Build a strict source-derived graph of explicit professional claims, with no inference."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
DOMAIN="https://ragunauthramsaroop.com"
INPUT="api/v1/executive-record.json"
OUTPUT="api/v1/claim-graph.json"

def build(record):
    person=record["subject"]
    subject_id=person["@id"]
    nodes=[{"id":subject_id,"type":"Person","label":person["name"],
            "source":DOMAIN+"/api/v1/executive-record.json","verification":"self_published"}]
    company="organization:AGM-Inc"
    nodes.append({"id":company,"type":"Organization","label":"AGM Inc.",
                  "verification":"company_operating_context"})
    edges=[{"from":subject_id,"to":company,"relation":"reports_employment_with",
            "qualifier":"first-party employment record"}]
    sources=set()
    for claim in record["claims"]:
        cid="claim:"+claim["id"]
        nodes.append({"id":cid,"type":"Claim","label":claim["title"],
                      "value":claim["value"],"classification":claim["classification"],
                      "effectiveFrom":claim["effectiveFrom"],"scope":claim["scope"],
                      "verification":"source_scoped_not_issuer_verified"})
        edges.append({"from":subject_id,"to":cid,"relation":"publishes_claim",
                      "qualifier":"self-published"})
        if claim["classification"]=="company_reported_operating_context":
            edges.append({"from":cid,"to":company,
                          "relation":"describes_organization_not_personal_result",
                          "qualifier":"explicit non-attribution"})
        for ev in claim["evidence"]:
            eid="evidence:"+ev["url"]
            if eid not in sources:
                sources.add(eid)
                nodes.append({"id":eid,"type":"EvidenceSource","label":ev["label"],
                              "url":ev["url"],"sourceType":ev["type"],
                              "verification":"source_link_not_document_authentication"})
            edges.append({"from":cid,"to":eid,"relation":"references",
                          "qualifier":ev.get("note") or ev["type"]})
    return {"format":"RR-Claim-Evidence-Graph","schemaVersion":"1.0.0",
            "issuedAt":record["issuedAt"],"recordSource":DOMAIN+"/api/v1/executive-record.json",
            "subjectId":subject_id,
            "purpose":"Explicit claim-to-source connections only. No inferred endorsements, credentials, or personally attributable company performance.",
            "nodeCount":len(nodes),"edgeCount":len(edges),"nodes":nodes,"edges":edges,
            "limitations":record["interpretationRules"]}

def run(root=ROOT,write=False):
    record=json.loads((root/INPUT).read_text(encoding="utf-8"))
    target=root/OUTPUT
    calculated=build(record)
    if write:
        content=json.dumps(calculated,indent=2,ensure_ascii=False)+"\n"
        if not target.exists() or target.read_text(encoding="utf-8")!=content:
            target.write_text(content,encoding="utf-8")
        print("PASS claim graph published",calculated["nodeCount"],calculated["edgeCount"])
        return 0
    actual=json.loads(target.read_text(encoding="utf-8"))
    if actual!=calculated:
        print("FAIL claim graph drift: regenerate from canonical executive record")
        return 1
    print("PASS claim graph matches",len(record["claims"]),"canonical source claims")
    return 0

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--write",action="store_true")
    group.add_argument("--check",action="store_true")
    args=parser.parse_args()
    sys.exit(run(write=args.write))
