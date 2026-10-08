#!/usr/bin/env python3
"""Single guarded SMTP route for standard, batch, and secure iCloud outreach."""

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
from send_icloud_batch import attachment_for
from send_icloud_smtp import CV_SOURCE, build_cv_pdf, load_payload
from secure_icloud_send import decrypt_payload, unwrap_private

SMTP_HOST = "smtp.mail.me.com"
SMTP_PORT = 587
SENDER_NAME = "Ragunauth Ramsaroop"
MAX_MESSAGES_PER_RUN = 5


def resolve_fields(item: dict) -> tuple[str, str, str]:
    to = item.get("to")
    subject = item.get("subject")
    body = item.get("body")
    body_path = item.get("body_path")
    if body is None and body_path is not None:
        if not isinstance(body_path, str):
            raise ValueError("body_path must be a string.")
        path = Path(body_path)
        if not body_path.startswith("outreach/email-bodies/") or path.suffix.lower() != ".txt" or not path.exists():
            raise ValueError("body_path must be an existing .txt file under outreach/email-bodies/.")
        body = path.read_text(encoding="utf-8")
    if not isinstance(to, str) or "@" not in to:
        raise ValueError("Each message needs one valid recipient address.")
    if not isinstance(subject, str) or not subject.strip():
        raise ValueError("Each message needs a subject.")
    if not isinstance(body, str) or not body.strip():
        raise ValueError("Each message needs a body.")
    return to.strip(), subject.strip(), body.strip()


def baseline_cv() -> tuple[bytes, str]:
    output = Path("/tmp/Ragunauth_Ramsaroop_Executive_CV_2026.pdf")
    build_cv_pdf(CV_SOURCE, output)
    return output.read_bytes(), "Ragunauth_Ramsaroop_Executive_CV_2026.pdf"


def load_candidates(payload_path: Path, password: str):
    name = payload_path.name
    candidates = []

    if name.endswith(".batch.json"):
        manifest = json.loads(payload_path.read_text(encoding="utf-8"))
        if manifest.get("approved") is not True:
            raise ValueError("Batch manifest must set approved=true.")
        files = manifest.get("payload_files")
        if not isinstance(files, list) or not files or len(files) > MAX_MESSAGES_PER_RUN:
            raise ValueError(f"Batch manifest must contain 1 to {MAX_MESSAGES_PER_RUN} payload files.")
        batch_id = str(manifest.get("batch_id") or payload_path.stem)
        for index, raw in enumerate(files, start=1):
            if not isinstance(raw, str) or not (raw.startswith("outreach/icloud-outbox/") or raw.startswith("outreach/icloud-staged/")) or not raw.endswith(".json") or raw.endswith(".batch.json"):
                raise ValueError(f"Invalid payload path: {raw}")
            child_path = Path(raw)
            if not child_path.exists():
                raise ValueError(f"Payload not found: {raw}")
            payload = load_payload(child_path)
            if payload.get("dry_run") is True:
                raise ValueError(f"Guarded batch refuses dry-run payload: {raw}")
            attachment, filename = attachment_for(payload, index)
            child_bytes = child_path.read_bytes()
            for item in payload["messages"]:
                candidates.append((raw, child_bytes, batch_id, item, attachment, filename))

    elif name.endswith(".secure.json"):
        private_key = unwrap_private(password.encode())
        payload = decrypt_payload(payload_path, private_key)
        attachment, filename = baseline_cv()
        raw_bytes = payload_path.read_bytes()
        batch_id = str(payload.get("batch_id") or payload_path.stem)
        for item in payload["messages"]:
            candidates.append((str(payload_path), raw_bytes, batch_id, item, attachment, filename))

    else:
        payload = load_payload(payload_path)
        if payload.get("dry_run") is True:
            print("Dry run validated. No email was sent.")
            return []
        attachment, filename = attachment_for(payload, 1)
        raw_bytes = payload_path.read_bytes()
        batch_id = str(payload.get("batch_id") or payload_path.stem)
        for item in payload["messages"]:
            candidates.append((str(payload_path), raw_bytes, batch_id, item, attachment, filename))

    if not candidates:
        raise ValueError("No messages resolved from approved payload.")
    if len(candidates) > MAX_MESSAGES_PER_RUN:
        raise ValueError(f"Safety gate: no more than {MAX_MESSAGES_PER_RUN} messages per workflow run.")

    normalized = []
    seen = set()
    for raw, raw_bytes, batch_id, item, attachment, filename in candidates:
        to, subject, body = resolve_fields(item)
        key = to.lower()
        if key in seen:
            raise ValueError(f"Duplicate recipient inside current run: {to}")
        seen.add(key)
        normalized.append((raw, raw_bytes, batch_id, to, subject, body, attachment, filename))
    return normalized


def exclude_existing_icloud_sent(candidates, sender: str, password: str):
    """Block any recipient already present in the iCloud Sent mailbox."""
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
            to = candidate[3].lower()
            matches = search_recipient(conn, to)
            if matches:
                print(f"Blocked duplicate recipient already present in iCloud Sent: {to}; matches={len(matches)}")
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


def send_guarded(server: smtplib.SMTP, sender: str, candidate) -> None:
    raw, raw_bytes, batch_id, to, subject, body, attachment, filename = candidate
    claim = claim_recipient(
        recipient=to,
        payload_path=raw,
        payload_bytes=raw_bytes,
        attachment=attachment,
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
    msg.add_attachment(attachment, maintype="application", subtype="pdf", filename=filename)

    refused = server.send_message(msg, from_addr=sender, to_addrs=[to])
    if refused:
        raise RuntimeError(f"SMTP refused recipient {to}: {refused}")

    print(f"Sent iCloud SMTP outreach to {to}; Message-ID {message_id}")
    mark_sent(claim, message_id)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: send_icloud_guarded.py <approved-payload.json>")

    sender = os.environ.get("ICLOUD_SMTP_USER", "").strip()
    password = os.environ.get("ICLOUD_APP_PASSWORD", "").strip()
    if not sender or not password:
        raise SystemExit("Missing ICLOUD_SMTP_USER or ICLOUD_APP_PASSWORD.")

    payload_path = Path(sys.argv[1])
    if not payload_path.exists():
        raise ValueError(f"Payload not found: {payload_path}")

    candidates = load_candidates(payload_path, password)
    if not candidates:
        return

    candidates = exclude_existing_icloud_sent(candidates, sender, password)
    if not candidates:
        print("All recipients were already present in iCloud Sent. No email was sent.")
        return

    context = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
        server.ehlo()
        server.starttls(context=context)
        server.ehlo()
        server.login(sender, password)
        for candidate in candidates:
            send_guarded(server, sender, candidate)


if __name__ == "__main__":
    main()
