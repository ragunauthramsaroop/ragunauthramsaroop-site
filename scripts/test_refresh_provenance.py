#!/usr/bin/env python3
"""Provenance regeneration tests without internet, site writes or third-party packages."""
from pathlib import Path
import hashlib
import importlib.util
import json
import tempfile
import unittest
from unittest.mock import patch

SPEC=importlib.util.spec_from_file_location("refresh_provenance",Path(__file__).with_name("refresh_provenance.py"))
m=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(m)

class ProvenanceTests(unittest.TestCase):
    def make_root(self):
        temp=tempfile.TemporaryDirectory()
        root=Path(temp.name)
        (root/"data").mkdir()
        (root/"api/v1").mkdir(parents=True)
        (root/"test.txt").write_text("this is version one\n",encoding="utf-8")
        bad={"generated":"23 September 2026","algorithm":"SHA-256","resources":[
            {"path":"/test.txt","sha256":"0"*64,"bytes":42,"generated":"23 September 2026"}]}
        for rel in (m.CANONICAL,m.MIRROR):
            (root/rel).write_text(json.dumps(bad)+"\n",encoding="utf-8")
        return temp,root

    def test_drift_and_refresh(self):
        temp,root=self.make_root()
        with temp,patch.object(m,"MUST_TRACK",()):
            self.assertEqual(m.run(root,False),1)
            self.assertEqual(m.run(root,True),0)
            self.assertEqual(m.run(root,False),0)
            manifest=json.loads((root/m.CANONICAL).read_text())
            value=(root/"test.txt").read_bytes()
            self.assertEqual(manifest["resources"][0]["sha256"],hashlib.sha256(value).hexdigest())
            self.assertEqual(manifest["resources"][0]["bytes"],len(value))
            self.assertEqual((root/m.CANONICAL).read_bytes(),(root/m.MIRROR).read_bytes())
            (root/"test.txt").write_text("a changed file\n")
            self.assertEqual(m.run(root,False),1)

    def test_missing_resource_fails_closed(self):
        temp,root=self.make_root()
        with temp,patch.object(m,"MUST_TRACK",()):
            (root/"test.txt").unlink()
            with self.assertRaises(FileNotFoundError):
                m.scan(root)

    def test_new_required_resource_is_included(self):
        temp,root=self.make_root()
        with temp,patch.object(m,"MUST_TRACK",("/test.txt",)):
            _,result,_=m.scan(root)
            self.assertEqual(len(result["resources"]),1)

if __name__=="__main__":unittest.main()
