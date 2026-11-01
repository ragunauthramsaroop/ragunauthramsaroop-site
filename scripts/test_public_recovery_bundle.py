#!/usr/bin/env python3
"""Test recovery allowlist, archive content integrity and corruption detection."""
from pathlib import Path
from datetime import datetime, timezone
import importlib.util
import tempfile
import unittest

spec=importlib.util.spec_from_file_location("recovery",Path(__file__).with_name("create_public_recovery_bundle.py"))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class RecoveryTests(unittest.TestCase):
    def test_critical_public_assets_present(self):
        for path in m.FILES:self.assertTrue((m.ROOT/path).is_file(),path)
        self.assertFalse(any("outreach/" in p or ".env" in p or "secret" in p for p in m.FILES))
    def test_archive_integrity(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);(root/"public").mkdir()
            (root/"public/a.txt").write_text("hello")
            previous=m.FILES
            try:
                m.FILES=("public/a.txt",)
                zipfile=m.create(root,root/"out",datetime(2026,11,1,tzinfo=timezone.utc))
                self.assertEqual(m.verify(zipfile),0)
                with open(zipfile,"ab") as stream:stream.write(b"corruption")
                with self.assertRaises(ValueError):m.verify(zipfile)
            finally:m.FILES=previous
    def test_missing_file_is_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            with self.assertRaises(FileNotFoundError):
                m.collect(Path(t))

if __name__=="__main__":unittest.main()
