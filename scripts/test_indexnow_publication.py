#!/usr/bin/env python3
"""Read-only IndexNow URL selection and scope tests."""
import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location("indexnow",Path(__file__).with_name("indexnow_publication.py"))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Tests(unittest.TestCase):
    def test_public_key_matches(self):
        key=m.key_file()
        self.assertEqual(key.read_text().strip(),key.stem)
    def test_bootstrap_new_papers(self):
        urls=m.changed_urls([".github/workflows/indexnow-publication.yml"],m.sitemaps())
        self.assertEqual(len(urls),4)
        self.assertTrue(all(u.startswith(m.DOMAIN+"/") for u in urls))
    def test_changed_html_and_pdf(self):
        urls=m.changed_urls(["public-record/index.html","research-library/guyana-biodiversity-investment-readiness/full-text.pdf","outreach/internal.html"],m.sitemaps())
        self.assertIn(m.DOMAIN+"/public-record/",urls)
        self.assertIn(m.DOMAIN+"/research-library/guyana-biodiversity-investment-readiness/full-text.pdf",urls)
        self.assertFalse(any("outreach" in u for u in urls))
    def test_unregistered_or_unrelated_rejected(self):
        urls=m.changed_urls(["scripts/hi.py","outreach/file.json","research-library/private/unlisted.pdf"],m.sitemaps())
        self.assertEqual(urls,[])
if __name__=="__main__":unittest.main()
