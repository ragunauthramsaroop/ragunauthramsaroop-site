#!/usr/bin/env python3
"""Live tree selection and privacy exclusion tests for the static archive."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location("site_backup",Path(__file__).with_name("create_public_static_archive.py"))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class StaticArchiveTests(unittest.TestCase):
    def test_public_only_selection_real_repo(self):
        items=m.select(m.ROOT)
        names={p for p,_ in items}
        self.assertGreater(len(items),500)
        self.assertTrue(m.MANDATORY <= names)
        self.assertFalse(any(p.startswith(("outreach/","ssrn-bridge/",".github/","gateway/")) for p in names))
        self.assertTrue(any(p.startswith("pagefind/") for p in names))
        self.assertTrue(any(p.startswith("tools/") for p in names))
    def test_missing_mandatory_files_raise(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):m.select(Path(tmp))
if __name__=="__main__":unittest.main()
