#!/usr/bin/env python3
"""Verify full public research archive and rejection of changed PDF bytes."""
from pathlib import Path
import importlib.util
import json
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location("research_backup",Path(__file__).with_name("create_full_research_archive.py"))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class ResearchArchiveTests(unittest.TestCase):
    def test_real_public_edition_register_and_hashes(self):
        files,count=m.collect(m.ROOT)
        self.assertGreaterEqual(count,23)
        self.assertEqual(sum(name.endswith("/full-text.pdf") for name,_ in files),count)
        self.assertTrue(all(not name.startswith("outreach/") and "/.github/" not in name for name,_ in files))
    def test_create_verify_and_detect_corruption(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t)
            paths=[m.REG]+list(m.EXTRAS)
            for name in paths:
                file=root/name
                file.parent.mkdir(parents=True,exist_ok=True)
                file.write_text("{}")
            slug="test-paper"
            d=root/"research-library"/slug
            d.mkdir(parents=True)
            raw=b"%PDF-1.4\n"+b"A"*11000
            (d/"full-text.pdf").write_bytes(raw)
            (d/"index.html").write_text("<html>paper</html>")
            import hashlib
            r={"papers":[{"slug":slug,"scholar_pdf_sha256":hashlib.sha256(raw).hexdigest()}]}
            (root/m.REG).write_text(json.dumps(r))
            with patch.object(m,"EXTRAS",tuple(x for x in m.EXTRAS if x!=m.REG)):
                # Simulate full register coverage with the minimum lowered for this unit.
                original=m.collect
                def small(root):
                    files=[(str(x.relative_to(root)),x) for x in root.rglob("*") if x.is_file()]
                    return sorted(files),23
                with patch.object(m,"collect",small):
                    out=m.create(root,root/"out")
                    self.assertEqual(m.verify(out),0)
                    with out.open("ab") as stream:stream.write(b"tamper")
                    with self.assertRaises(ValueError):m.verify(out)

if __name__=="__main__":unittest.main()
