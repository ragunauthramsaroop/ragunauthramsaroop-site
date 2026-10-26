#!/usr/bin/env python3
"""Validate an original PDF and append an SSRN disclosure page without changing the original."""
import hashlib, io, json, pathlib, sys
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import simpleSplit

def prepare(src, dst, metadata):
    src=pathlib.Path(src)
    b=src.read_bytes()
    if len(b)<1000 or not b.startswith(b"%PDF-"):
        raise ValueError("Invalid PDF source")
    if hashlib.sha256(b).hexdigest()!=metadata["sha256"]:
        raise ValueError("Source checksum does not match manifest")
    rd=PdfReader(io.BytesIO(b))
    if not rd.pages:
        raise ValueError("Empty manuscript")
    wr=PdfWriter()
    for p in rd.pages: wr.add_page(p)
    buf=io.BytesIO()
    cv=canvas.Canvas(buf,pagesize=(595,842))
    cv.setFont("Helvetica-Bold",14)
    cv.drawString(44,790,"SSRN Research Integrity and Publication Declarations")
    rows=[
        ("Paper",metadata["title"]),
        ("Author","Ragunauth Ramsaroop | Independent Research and Policy Analysis"),
        ("AI-use disclosure",metadata["ai_disclosure"]),
        ("Declaration of interest",metadata["conflict_of_interest"]),
        ("Research funding",metadata["funder_statement"]),
        ("Research ethics",metadata["ethics_approval"]),
        ("Copyright","Copyright Ragunauth Ramsaroop. All Rights Reserved. No reuse or adaptation without permission."),
        ("Author responsibility","The author takes responsibility for all content, source verification and conclusions.")
    ]
    y=749
    for label,value in rows:
        cv.setFont("Helvetica-Bold",10)
        cv.drawString(44,y,label)
        y-=17
        cv.setFont("Helvetica",9)
        for line in simpleSplit(value,"Helvetica",9,500):
            cv.drawString(44,y,line)
            y-=13
        y-=18
    if y<45: raise ValueError("Disclosure page overflow")
    cv.setFont("Helvetica",8)
    cv.drawString(44,48,"This appendix supplements the archival paper. Original manuscript pages are unchanged.")
    cv.save()
    buf.seek(0)
    wr.add_page(PdfReader(buf).pages[0])
    dst=pathlib.Path(dst)
    dst.parent.mkdir(parents=True,exist_ok=True)
    with dst.open("wb") as f: wr.write(f)
    print(json.dumps({"status":"prepared","source":str(src),"prepared":str(dst),"pages":len(wr.pages),"source_sha256":metadata["sha256"]}))

if __name__=="__main__":
    if len(sys.argv)!=4:
        raise SystemExit("ssrn_prepare.py SOURCE_PDF OUTPUT_PDF METADATA_JSON")
    prepare(sys.argv[1],sys.argv[2],json.loads(sys.argv[3]))
