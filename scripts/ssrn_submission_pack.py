#!/usr/bin/env python3
"""Produce an author-reviewed SSRN submission pack without visiting SSRN.

The source PDFs remain unchanged. No submission or publication is claimed.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import zipfile

from ssrn_prepare import prepare

ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "ssrn-bridge"
OUT = QUEUE / "run"
MANIFEST = json.loads((QUEUE / "manifest.json").read_text(encoding="utf-8"))
PAPERS = MANIFEST["papers"]
KNOWN = [p for p in PAPERS if p.get("ssrn_abstract_id")]
PENDING = [p for p in PAPERS if not p.get("ssrn_abstract_id")]
READY = [p for p in PENDING if p.get("pdf")]
MISSING = [p for p in PENDING if not p.get("pdf")]

def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    pdf_dir = OUT / "prepared"
    pdf_dir.mkdir(parents=True, exist_ok=True)
    metadata = []
    for item in READY:
        for required in ("title", "date", "abstract", "sha256", "pdf", "ai_disclosure",
                         "conflict_of_interest", "funder_statement", "ethics_approval", "classification"):
            if not item.get(required):
                raise ValueError(f"{item['slug']}: required field {required} is missing")
        src = ROOT / item["pdf"]
        if not src.is_file():
            raise FileNotFoundError(src)
        output = pdf_dir / f"{item['slug']}-SSRN-author-review.pdf"
        prepare(src, output, item)
        digest = hashlib.sha256(output.read_bytes()).hexdigest()
        metadata.append({
            "slug": item["slug"],
            "title": item["title"],
            "date": item["date"],
            "abstract": item["abstract"],
            "ai_disclosure": item["ai_disclosure"],
            "keywords": item.get("keywords", []),
            "classification_suggestion": item["classification"],
            "author": MANIFEST["author"],
            "pdf_file": output.name,
            "prepared_pdf_sha256": digest,
            "original_pdf_sha256": item["sha256"],
            "conflict_of_interest": item["conflict_of_interest"],
            "funder_statement": item["funder_statement"],
            "ethics_approval": item["ethics_approval"],
            "status": "prepared_not_submitted",
        })

    instructions = """# SSRN: AUTHOR-REVIEWED SUBMISSION PACKAGE

This ZIP contains *prepared but UNsubmitted* research manuscripts.
It DOES NOT sign in, bypass SSRN security, submit material or claim publication.

## Before submitting any manuscript
1. Sign in from your own browser: https://hq.ssrn.com/submissions/MyPapers.cfm
2. Search My Papers by exact paper title. DO NOT submit duplicates or paper revisions as new papers.
3. Read and fact-check the ENTIRE manuscript, including citations, dates, the author affiliation and sources.
4. Check the attached disclosure appendix. SSRN requires a truthful description of the
   specific generative-AI tool(s), purpose AND extent of use. Edit the PDF and abstract
   disclosure if anything is incomplete or inaccurate. Do not submit unreviewed disclosures.
5. Confirm all funding, interests, ethics, copyright and reuse declarations are accurate.
   Only the author may make the final copyright/rights attestations.
6. In the SSRN submission form choose Upload, Key Details, Author Information,
   Classification, Research Integrity and Review/Submit in the order SSRN currently displays.
7. Upload the *-SSRN-author-review.pdf prepared file for the selected paper, not the original
   repository copy. Copy the corresponding abstract, keywords, date and other metadata
   from submission-metadata.json. Add a clear AI-use disclosure to the abstract itself.
8. Review the final SSRN preview, answer author-rights questions truthfully, and submit
   ONE paper at a time. SSRN warns that high submission volumes may cause rejection.
9. Record the SSRN submission or abstract ID ONLY after My Papers confirms it.
   A submitted paper is NOT necessarily publicly posted or Google Scholar indexed.

SSRN policies:
https://www.elsevier.support/ssrn/answer/get-started
https://www.elsevier.support/ssrn/answer/AI

## Queue
Known SSRN abstract IDs excluded from resubmission: COUNT_KNOWN
Prepared manuscripts included: COUNT_READY
Manuscripts still lacking source PDF: COUNT_MISSING

The repository's manifest.json remains the source of truth and does not automatically
claim new submissions. Passwords and cookies are never included in this package.
"""
    instructions = (instructions.replace("COUNT_KNOWN", str(len(KNOWN)))
                             .replace("COUNT_READY", str(len(READY)))
                             .replace("COUNT_MISSING", str(len(MISSING))))
    metadata_text = json.dumps({
        "author": MANIFEST["author"], "status": "author_review_required_no_upload_claimed",
        "prepared": metadata,
        "missing_source_pdf": [{"slug": p["slug"], "title": p["title"]} for p in MISSING],
        "existing_ssrn_abstract_ids": [
            {"title": p["title"], "abstract_id": p["ssrn_abstract_id"]} for p in KNOWN],
    }, ensure_ascii=False, indent=2) + "\n"
    (OUT / "submission-metadata.json").write_text(metadata_text, encoding="utf-8")
    (OUT / "AUTHOR-REVIEW-FIRST.md").write_text(instructions, encoding="utf-8")
    package = OUT / "ssrn-author-reviewed-submission-pack.zip"
    with zipfile.ZipFile(package, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        z.writestr("AUTHOR-REVIEW-FIRST.md", instructions)
        z.writestr("submission-metadata.json", metadata_text)
        for item in metadata:
            file = pdf_dir / item["pdf_file"]
            z.write(file, arcname=item["pdf_file"])
    with zipfile.ZipFile(package) as z:
        assert len(z.namelist()) == len(READY) + 2
        assert z.testzip() is None, "Prepared ZIP integrity check failed"
    print("SSRN_AUTHOR_UPLOAD_PACKAGE " + json.dumps({
        "ready": len(READY), "known": len(KNOWN), "missing": len(MISSING),
        "zip": str(package), "zip_bytes": package.stat().st_size,
        "publication_status": "unsubmitted", "requires_author_review": True
    }))

if __name__ == "__main__":
    main()
