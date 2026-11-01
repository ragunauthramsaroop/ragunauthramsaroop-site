#!/usr/bin/env python3
"""Deterministic graph derivation and drift protection."""
from pathlib import Path
import importlib.util
import json
import tempfile
import unittest

path=Path(__file__).with_name("build_executive_claim_graph.py")
spec=importlib.util.spec_from_file_location("builder",path)
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)

class GraphTests(unittest.TestCase):
    def test_graph_is_derived_without_inferences(self):
        record=json.loads((builder.ROOT/builder.INPUT).read_text(encoding="utf-8"))
        graph=builder.build(record)
        self.assertEqual(graph["nodeCount"],len(graph["nodes"]))
        self.assertEqual(graph["edgeCount"],len(graph["edges"]))
        self.assertEqual({n["id"].split(":",1)[-1] for n in graph["nodes"] if n["type"]=="Claim"},
                         {c["id"] for c in record["claims"]})
        self.assertTrue(all(e["from"]!=e["to"] for e in graph["edges"]))
        self.assertTrue(all(n["verification"]!="issuer_signed" for n in graph["nodes"]))
    def test_drift_is_detected(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);(root/"api/v1").mkdir(parents=True)
            src=json.loads((builder.ROOT/builder.INPUT).read_text(encoding="utf-8"))
            (root/builder.INPUT).write_text(json.dumps(src),encoding="utf-8")
            self.assertEqual(builder.run(root,write=True),0)
            self.assertEqual(builder.run(root,write=False),0)
            src["claims"][0]["title"]="Changed professional statement"
            (root/builder.INPUT).write_text(json.dumps(src),encoding="utf-8")
            self.assertEqual(builder.run(root,write=False),1)

if __name__=="__main__":unittest.main()
