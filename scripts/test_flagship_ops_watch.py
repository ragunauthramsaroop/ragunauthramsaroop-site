#!/usr/bin/env python3
"""No-network tests for SEO page parsing and monitoring safeguards."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

path=Path(__file__).with_name("flagship_ops_watch.py")
spec=importlib.util.spec_from_file_location("flagship_watch",path)
watch=importlib.util.module_from_spec(spec)
spec.loader.exec_module(watch)

class WatchTests(unittest.TestCase):
    def test_good_page(self):
        src='<html><head><title>Ragunauth Ramsaroop</title><meta name="description" content="'+("A"*65)+'"><link rel="canonical" href="/"><script type="application/ld+json">{"@type":"Person"}</script></head><body><h1>Ragunauth</h1></body></html>'
        self.assertEqual([],watch.inspect_page(src,watch.DOMAIN+"/",True))
    def test_invalid_canonical_and_h1(self):
        src='<title>Ragunauth Ramsaroop</title><meta name="description" content="'+("A"*65)+'"><link rel="canonical" href="/other/"><h1>A</h1><h1>B</h1>'
        findings=watch.inspect_page(src,watch.DOMAIN+"/",True)
        self.assertTrue(any("canonical" in s for s in findings))
        self.assertTrue(any("H1" in s for s in findings))
        self.assertTrue(any("JSON-LD" in s for s in findings))
    def test_noindex_is_an_error(self):
        src='<title>Ragunauth Ramsaroop</title><meta name="description" content="'+("A"*65)+'"><link rel="canonical" href="/"><meta name="robots" content="noindex"><h1>A</h1>'
        self.assertIn("unexpected noindex",watch.inspect_page(src,watch.DOMAIN+"/"))
    def test_all_flagship_routes(self):
        self.assertEqual(len(watch.ROUTES),16)
        self.assertEqual(len(watch.PUBLIC_PDFS),2)
        self.assertEqual(len(watch.PUBLIC_APIS),4)
    def test_pdf_rejects_html_fallback(self):
        self.assertFalse(watch.pdf_is_complete_header("<html>"+("A"*14000)))
        self.assertTrue(watch.pdf_is_complete_header("%PDF-1.7\n"+("A"*14000)))
    def test_api_rejects_fake_credentials(self):
        route=watch.DOMAIN+"/api/v1/credential-status.json"
        self.assertTrue(watch.inspect_api(route,'{"status":"none_registered","issuerCredentials":[]}'))
        self.assertFalse(watch.inspect_api(route,'{"status":"verified","issuerCredentials":[{}]}'))
    def test_static_watch_with_real_repo(self):
        report=[]
        watch.static_watch(watch.ROOT,lambda name,ok,msg:report.append((name,ok,msg)))
        self.assertTrue(report, "Checks should execute")
        self.assertFalse([r for r in report if not r[1]],"No canonical or AI guide drift in branch")

if __name__=="__main__":
    unittest.main()
