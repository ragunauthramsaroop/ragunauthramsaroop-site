#!/usr/bin/env python3
"""Audit exact recipients against the iCloud Sent mailbox.

Reads an approved audit request containing recipient addresses, searches only the
Sent mailbox, collects header-level evidence, and writes a JSON result. Message
bodies are never downloaded or persisted.
"""

import argparse
import email
import imaplib
import json
import os
import re
from datetime import datetime, timezone
from email.header import decode_header, make_header
from email.utils import getaddresses
from pathlib import Path

IMAP_HOST = "imap.mail.me.com"
IMAP_PORT = 993
MAX_RECIPIENTS = 100


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def norm(addr: str) -> str:
    value = addr.strip().lower()
    if value.count("@") != 1:
        raise ValueError(f"Invalid address: {addr!r}")
    return value


def decode_text(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value


def find_sent_mailbox(conn: imaplib.IMAP4_SSL) -> str:
    status, boxes = conn.list()
    if status != "OK" or not boxes:
        raise RuntimeError("Unable to list iCloud IMAP mailboxes.")

    candidates: list[tuple[int, str]] = []
    for raw in boxes:
        text = raw.decode("utf-8", errors="replace")
        # mailbox name is usually the final quoted or atom token
        match = re.search(r'"([^"\\]*(?:\\.[^"\\]*)*)"\s*$', text)
        if match:
            name = match.group(1).replace('\\"', '"').replace('\\\\', '\\')
        else:
            name = text.rsplit(" ", 1)[-1].strip('"')
        lower = name.lower()
        score = 0
        if "\\sent" in text.lower():
            score += 100
        if lower in {"sent", "sent messages", "sent mail"}:
            score += 50
        if "sent" in lower:
            score += 10
        if score:
            candidates.append((score, name))

    if not candidates:
        raise RuntimeError("No iCloud Sent mailbox was identified from IMAP LIST.")
    candidates.sort(reverse=True)
    return candidates[0][1]


def exact_recipient_in_headers(msg: email.message.Message, target: str) -> bool:
    fields = []
    for header in ("to", "cc", "bcc", "resent-to", "resent-cc", "resent-bcc"):
        fields.extend(msg.get_all(header, []))
    return target in {addr.lower() for _, addr in getaddresses(fields) if addr}


def search_recipient(conn: imaplib.IMAP4_SSL, recipient: str) -> list[dict]:
    # Header search narrows candidates. Exact parsed-header match prevents substring hits.
    status, data = conn.search(None, "HEADER", "TO", f'"{recipient}"')
    if status != "OK":
        raise RuntimeError(f"IMAP search failed for {recipient}.")
    ids = (data[0] or b"").split()
    evidence: list[dict] = []
    for msg_id in ids[-50:]:
        status, fetched = conn.fetch(msg_id, "(BODY.PEEK[HEADER.FIELDS (TO CC BCC RESENT-TO RESENT-CC RESENT-BCC SUBJECT DATE MESSAGE-ID FROM)])")
        if status != "OK" or not fetched:
            continue
        header_bytes = b""
        for part in fetched:
            if isinstance(part, tuple) and isinstance(part[1], (bytes, bytearray)):
                header_bytes += bytes(part[1])
        if not header_bytes:
            continue
        msg = email.message_from_bytes(header_bytes)
        if not exact_recipient_in_headers(msg, recipient):
            continue
        evidence.append({
            "imap_sequence": msg_id.decode("ascii", errors="replace"),
            "message_id": (msg.get("Message-ID") or "").strip(),
            "date": decode_text(msg.get("Date")),
            "subject": decode_text(msg.get("Subject")),
            "from": decode_text(msg.get("From")),
            "to": [addr for _, addr in getaddresses(msg.get_all("To", [])) if addr],
            "cc": [addr for _, addr in getaddresses(msg.get_all("Cc", [])) if addr],
        })
    return evidence


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("request_file")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    user = os.environ.get("ICLOUD_SMTP_USER", "").strip()
    password = os.environ.get("ICLOUD_APP_PASSWORD", "").strip()
    if not user or not password:
        raise SystemExit("Missing ICLOUD_SMTP_USER or ICLOUD_APP_PASSWORD.")

    request_path = Path(args.request_file)
    request = json.loads(request_path.read_text(encoding="utf-8"))
    raw_recipients = request.get("recipients")
    if not isinstance(raw_recipients, list) or not raw_recipients:
        raise ValueError("Audit request needs a non-empty recipients list.")
    if len(raw_recipients) > MAX_RECIPIENTS:
        raise ValueError(f"Audit request exceeds {MAX_RECIPIENTS} recipients.")
    recipients = []
    seen = set()
    for item in raw_recipients:
        if not isinstance(item, str):
            raise ValueError("Recipient values must be strings.")
        address = norm(item)
        if address not in seen:
            seen.add(address)
            recipients.append(address)

    result = {
        "schema": 1,
        "request_file": str(request_path),
        "request_id": request.get("request_id") or request_path.stem,
        "audited_at": now_iso(),
        "mailbox": None,
        "recipients": [],
    }

    with imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT) as conn:
        conn.login(user, password)
        sent_box = find_sent_mailbox(conn)
        result["mailbox"] = sent_box
        status, _ = conn.select(f'"{sent_box}"', readonly=True)
        if status != "OK":
            status, _ = conn.select(sent_box, readonly=True)
        if status != "OK":
            raise RuntimeError(f"Unable to select Sent mailbox {sent_box!r}.")

        for recipient in recipients:
            matches = search_recipient(conn, recipient)
            result["recipients"].append({
                "recipient": recipient,
                "sent_header_match": bool(matches),
                "match_count": len(matches),
                "matches": matches,
            })

        try:
            conn.close()
        except Exception:
            pass
        conn.logout()

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    for row in result["recipients"]:
        print(f"{row['recipient']}: sent_header_match={row['sent_header_match']} count={row['match_count']}")
    print(str(output))


if __name__ == "__main__":
    main()
