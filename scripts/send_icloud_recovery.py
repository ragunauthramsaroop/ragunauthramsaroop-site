#!/usr/bin/env python3
"""Text-only iCloud recovery route for verified recruiter and executive-search contacts."""

import imaplib
import json
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from pathlib import Path

from audit_icloud_sent import IMAP_HOST, IMAP_PORT, find_sent_mailbox, search_recipient
from icloud_send_ledger import claim_recipient, mark_sent

SMTP_HOST = "smtp.mail.me.com"
SMTP_PORT = 587
SENDER_NAME = "Ragunauth Ramsaroop"
MAX_MESSAGES_PER_RUN = 5
PERSONAL_DOMAINS = {
    "gmail.com", "yahoo.com", "icloud.com", "hotmail.com", "outlook.com",
    "proton.me", "aol.com", "live.com",
}


def load_candidates(payload_path: Path):
    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    if payload.get("approved") is not True:
        raise ValueError("Recovery payload must set approved=true.")
    if payload.get("dry_run") is True:
        print("Dry run validated. No email was sent.")
        return []

    messages = payload.get("messages")
    if not isinstance(messages, list) or not (1 <= len(messages) <= MAX_MESSAGES_PER_RUN):
        raise ValueError(f"Recovery payload must contain 1 to {MAX_MESSAGES_PER_RUN} messages.")

    raw_bytes = payload_path.read_bytes()
    batch_id = str(payload.get("batch_id") or payload_path.stem)
    candidates = []
    seen = set()

    for item in messages:
        if not isinstance(item, dict):
            raise ValueError("Each message must be an object.")
        to = str(item.get("to") or "").strip().lower()
        subject = str(item.get("subject") or "").strip()
        body = str(item.get("body") or "").strip()
        if to.count("@") != 1:
            raise ValueError(f"Invalid recipient: {to}")
        domain = to.rsplit("@", 1)[1]
        if domain in PERSONAL_DOMAINS:
            raise ValueError(f"Recovery route refuses personal mailbox: {to}")
        if not subject or not body:
            raise ValueError(f"Subject and body are required for {to}")
        if to in seen:
            raise ValueError(f"Duplicate recipient in recovery batch: {to}")
        seen.add(to)
        candidates.append((to, subject, body, raw_bytes, batch_id))
    return candidates


def exclude_existing_sent(candidates, sender: str, password: str):
    conn = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    try:
        conn.login(sender, password)
        sent_box = find_sent_mailbox(conn)
        status, _ = conn.select(f'"{sent_box}"', readonly=True)
        if status != "OK":
            status, _ = conn.select(sent_box, readonly=True)
        if status != "OK":
            raise RuntimeError(f"Unable to select Sent mailbox {sent_box!r}.")

        fresh = []
        for candidate in candidates:
            to = candidate[0]
            matches = search_recipient(conn, to)
            if matches:
                print(f"Blocked duplicate already present in iCloud Sent: {to}; matches={len(matches)}")
                continue
            print(f"iCloud Sent preflight clear: {to}")
            fresh.append(candidate)
        return fresh
    finally:
        try:
            conn.close()
        except Exception:
            pass
        try:
            conn.logout()
        except Exception:
            pass


def send_one(server: smtplib.SMTP, sender: str, payload_path: str, candidate):
    to, subject, body, raw_bytes, batch_id = candidate
    claim = claim_recipient(
        recipient=to,
        payload_path=payload_path,
        payload_bytes=raw_bytes,
        attachment=b"",
        subject=subject,
        body=body,
        batch_id=batch_id,
    )

    msg = EmailMessage()
    msg["From"] = formataddr((SENDER_NAME, sender))
    msg["To"] = to
    msg["Subject"] = subject
    msg["Reply-To"] = sender
    message_id = make_msgid(domain=sender.rsplit("@", 1)[-1])
    msg["Message-ID"] = message_id
    msg.set_content(body)

    refused = server.send_message(msg, from_addr=sender, to_addrs=[to])
    if refused:
        raise RuntimeError(f"SMTP refused recipient {to}: {refused}")

    print(f"Sent text-only iCloud recovery outreach to {to}; Message-ID {message_id}")
    mark_sent(claim, message_id)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: send_icloud_recovery.py <approved-recovery-payload.json>")

    sender = os.environ.get("ICLOUD_SMTP_USER", "").strip()
    password = os.environ.get("ICLOUD_APP_PASSWORD", "").strip()
    if not sender or not password:
        raise SystemExit("Missing ICLOUD_SMTP_USER or ICLOUD_APP_PASSWORD.")

    payload_path = Path(sys.argv[1])
    if not payload_path.is_file():
        raise ValueError(f"Payload not found: {payload_path}")

    candidates = load_candidates(payload_path)
    if not candidates:
        return
    candidates = exclude_existing_sent(candidates, sender, password)
    if not candidates:
        print("All recovery recipients were already present in iCloud Sent. No email was sent.")
        return

    context = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
        server.ehlo()
        server.starttls(context=context)
        server.ehlo()
        server.login(sender, password)
        for candidate in candidates:
            send_one(server, sender, str(payload_path), candidate)


if __name__ == "__main__":
    main()
