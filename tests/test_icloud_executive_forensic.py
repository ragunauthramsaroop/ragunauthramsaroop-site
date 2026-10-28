#!/usr/bin/env python3
"""Offline safety tests for the read-only iCloud executive recruiter audit."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import icloud_executive_forensic as audit


class FakeImap:
    def __init__(self, messages):
        self.messages = messages
        self.calls = []
        self.mailbox = ""

    def select(self, name, readonly=False):
        self.mailbox = name
        assert readonly is True
        return "OK", [b"2"]

    def search(self, *args):
        return "OK", [b" ".join(str(i).encode() for i in range(1, len(self.messages) + 1))]

    def fetch(self, seq, command):
        idx = int(seq) - 1
        self.calls.append(command)
        msg = self.messages[idx]
        if command == "(BODYSTRUCTURE)":
            return "OK", [msg["structure"].encode()]
        assert "BODY.PEEK[HEADER.FIELDS" in command
        return "OK", [(b"HEADER", msg["headers"].encode("utf-8"))]


class ReadOnlyAuditTests(unittest.TestCase):
    def test_captures_cv_pdf_and_cc(self):
        box = FakeImap([{
            "headers": (
                "Date: Tue, 27 Oct 2026 13:00:00 +0000\r\n"
                "From: Ragunauth <ragunauthramsaroop@icloud.com>\r\n"
                "To: Search Firm <search@example.org>\r\n"
                "Cc: Recruiter <partner@example.org>\r\n"
                "Subject: Introduction\r\n"
                "Message-ID: <test1@example.org>\r\n\r\n"
            ),
            "structure": '1 (BODYSTRUCTURE (("APPLICATION" "PDF" ("NAME" "Ragunauth_Ramsaroop_CV.pdf"))))'
        }])
        result, stats = audit.scan_folder(box, "Sent Messages", "2026-08-01", True)
        self.assertEqual(len(result), 1)
        self.assertTrue(result[0]["pdf_attachment_indicated"])
        self.assertTrue(result[0]["cv_pdf_name_indicated"])
        self.assertIn("partner@example.org", result[0]["cc"])
        self.assertEqual(stats["inspected"], 1)
        self.assertTrue(all("BODY.PEEK" in call or call == "(BODYSTRUCTURE)" for call in box.calls))

    def test_excludes_internal_staging(self):
        box = FakeImap([{
            "headers": (
                "From: Ragunauth <ragunauthramsaroop@icloud.com>\r\n"
                "To: ragunauth123456@gmail.com\r\n"
                "Subject: PRIVATE CV STAGING\r\n\r\n"
            ),
            "structure": '1 (BODYSTRUCTURE ("APPLICATION" "PDF" ("NAME" "CV.pdf")))'
        }])
        result, _ = audit.scan_folder(box, "Sent Messages", "2026-08-01", True)
        self.assertEqual(result, [])

    def test_inbound_recognizes_known_recipient_even_with_plain_subject(self):
        box = FakeImap([{
            "headers": (
                "From: Recruiter <search@example.org>\r\n"
                "To: ragunauthramsaroop@icloud.com\r\n"
                "Subject: Following up\r\n\r\n"
            ),
            "structure": "1 (BODYSTRUCTURE)"
        }])
        result, _ = audit.scan_folder(
            box, "INBOX", "2026-08-01", False, {"search@example.org"}
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["from"], ["search@example.org"])

    def test_report_sending_refuses_unverified_target(self):
        with self.assertRaises(ValueError):
            audit.send_private_report({}, "outside@example.org", "me@icloud.com", "fake")


if __name__ == "__main__":
    unittest.main()
