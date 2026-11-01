#!/usr/bin/env python3
"""Verify the public research archive and reject corruption and missing PDFs."""
from pathlib import Path
import hashlib
import importlib.util
import json
import tempfile
import unittest

spec=importlib.util.spec_from_file_location("research_backup",Path(__file__).with_name("create_full_research_archive.py"))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class ResearchArchiveTests(unittest.TestCase):
    def test_live_public_edition_register_and_hashes(self):
        files,count=m.collect(m.ROOT)
        self.assertGreaterEqual(count,23)
        self.assertEqual(sum(name.endswith("/full-text.pdf") for name,_ in files),count)
        self.assertTrue(all(not name.startswith("outreach/") and "/.github/" not in name for name,_ in files))
    def test_create_verify_and_detect_corruption(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t)
            for name in m.EXTRAS:
                f=root/name
                f.parent.mkdir(parents=True,exist_ok=True)
                f.write_text("{}")
            records=[]
            for i in range(23):
                slug=f"test-paper-{i:02}"
                d=root/"research-library"/slug
                d.mkdir(parents=True)
                raw=b"%PDF-1.4\n"+(str(i).encode()*12000)
                (d/"full-text.pdf").write_bytes(raw)
                (d/"index.html").write_text("<html>paper</html>")
                records.append({"slug":slug,"scholar_pdf_sha256":hashlib.sha256(raw).hexdigest()})
            (root/m.REG).write_text(json.dumps({"papers":records}))
            out=m.create(root,root/"out")
            self.assertEqual(m.verify(out),0)
            with out.open("ab") as stream:stream.write(b"tamper")
            with self.assertRaises(ValueError):m.verify(out)
            (root/"research-library"/"test-paper-00"/"full-text.pdf").unlink()
            with self.assertRaises(FileNotFoundError):m.collect(root)

if __name__=="__main__":unittest.main()
