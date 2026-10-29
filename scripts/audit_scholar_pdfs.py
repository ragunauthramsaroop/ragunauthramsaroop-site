#!/usr/bin/env python3
"""Verify full original scholarly PDF integrity, citation metadata and disclosed size limits."""
from pathlib import Path
import json,hashlib,re,sys,xml.etree.ElementTree as ET
import pymupdf
ROOT=Path(__file__).resolve().parents[1]
LIB=ROOT/"research-library"
LIMIT=5_000_000
REG=json.loads((LIB/"publication-register.json").read_text(encoding="utf-8"))
READY=json.loads((LIB/"scholar-readiness.json").read_text(encoding="utf-8"))
assert len(REG["papers"])==len(READY["papers"]) and len(REG["papers"])>=11, "Published PDFs and scholar readiness metadata disagree"
sitemap={n.text for n in ET.parse(ROOT/"sitemap.xml").iter() if n.tag.endswith("}loc")}
errors=[]
for rec in REG["papers"]:
 slug=rec["slug"];pdf=LIB/slug/"full-text.pdf";html=LIB/slug/"index.html"
 expected="https://ragunauthramsaroop.com/research-library/"+slug+"/full-text.pdf"
 page="https://ragunauthramsaroop.com/research-library/"+slug+"/"
 try:
  assert pdf.is_file() and html.is_file(), "Missing scholarly PDF or HTML"
  assert pdf.stat().st_size>0, "PDF is empty"
  if pdf.stat().st_size>=LIMIT:
   assert rec.get("scholar_status")=="full_original_exceeds_scholar_pdf_size_guideline", "Oversized original lacks Scholar limitation disclosure"
   evidence=next(x for x in READY["papers"] if x["slug"]==slug)
   assert evidence.get("crawl_ready") is False and evidence.get("original_pdf_unchanged"), "Oversized original cannot claim Scholar readiness"
  assert rec["scholar_pdf_url"]==expected, "PDF URL mismatch"
  assert page in sitemap and expected in sitemap, "Sitemap missing paper"
  source=html.read_text(encoding="utf-8")
  for field in ("citation_title","citation_author","citation_publication_date","citation_pdf_url"):
   assert re.search(r'<meta name="'+field+r'" content="[^"]+">',source),field+" missing"
  assert '<meta name="citation_pdf_url" content="'+expected+'">' in source, "citation_pdf_url mismatch"
  assert 'id="author-abstract"' in source, "Full abstract section missing"
  with pymupdf.open(pdf) as doc:
   assert len(doc)>=5 and len(doc[0].get_text()+doc[1].get_text())>=200, "PDF not searchable"
  if "scholar_pdf_sha256" in rec:
   assert hashlib.sha256(pdf.read_bytes()).hexdigest()==rec["scholar_pdf_sha256"], "PDF SHA mismatch"
  print("PASS",slug,pdf.stat().st_size,flush=True)
 except Exception as e:errors.append(slug+": "+str(e))
power=next(x for x in REG["papers"] if x["slug"]=="guyana-power-demand-2030")
original=ROOT/"research-papers/guyana-power-demand-2030.pdf"
optimized=LIB/"guyana-power-demand-2030/full-text.pdf"
audit=json.loads((optimized.parent/"optimization-audit.json").read_text(encoding="utf-8"))
assert hashlib.sha256(original.read_bytes()).hexdigest()==audit["approved_original_sha256"]==power["sha256"]
assert optimized.stat().st_size==power["scholar_pdf_bytes"]==audit["optimized_bytes"]
assert audit["optimized_bytes"]<LIMIT
with pymupdf.open(original) as a,pymupdf.open(optimized) as b:
 assert len(a)==len(b)==22 and b.metadata["author"]=="Ragunauth Ramsaroop"
 assert all(x.get_text()==y.get_text() for x,y in zip(a,b))
assert 'href="/research-library/"' in (ROOT/"index.html").read_text(encoding="utf-8")
print("SCHOLAR_QA",{"papers":len(REG["papers"]),"limit":LIMIT,"optimized_power_pdf_bytes":optimized.stat().st_size,"failures":errors},flush=True)
if errors:sys.exit(1)
