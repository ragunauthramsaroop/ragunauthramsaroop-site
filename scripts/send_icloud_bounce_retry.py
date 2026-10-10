#!/usr/bin/env python3
"""One-time, fail-closed resend route for iCloud outreach with explicit bounce evidence."""

import base64
import hashlib
import json
import os
import smtplib
import ssl
import sys
import urllib.parse
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from pathlib import Path

from icloud_send_ledger import _decode_record, _get_content, _request, normalize_recipient, sha256_bytes, utc_now
from send_icloud_batch import attachment_for
from send_icloud_smtp import load_payload

SMTP_HOST = "smtp.mail.me.com"
SMTP_PORT = 587
SENDER_NAME = "Ragunauth Ramsaroop"
STANDARD_LEDGER_ROOT = "outreach/icloud-send-ledger"
RETRY_LEDGER_ROOT = "outreach/icloud-retry-ledger"


def load_retry(path: Path):
    if not str(path).startswith("outreach/icloud-bounce-retry/") or path.suffix.lower() != ".json":
        raise ValueError("Bounce retry payload must be under outreach/icloud-bounce-retry/.")
    payload = load_payload(path)
    if payload.get("approved") is not True or payload.get("dry_run") is not False:
        raise ValueError("Bounce retry requires approved=true and dry_run=false.")
    if payload.get("campaign_type") != "recruiter":
        raise ValueError("Bounce retry route is limited to recruiter outreach.")
    messages = payload.get("messages")
    if not isinstance(messages, list) or len(messages) != 1:
        raise ValueError("Bounce retry route permits exactly one message per payload.")
    item = messages[0]
    to = normalize_recipient(str(item.get("to") or ""))
    subject = item.get("subject")
    body = item.get("body")
    if not isinstance(subject, str) or not subject.strip():
        raise ValueError("Bounce retry requires a subject.")
    if not isinstance(body, str) or not body.strip():
        raise ValueError("Bounce retry requires a body.")

    auth = payload.get("retry_authorization")
    if not isinstance(auth, dict):
        raise ValueError("Bounce retry requires retry_authorization evidence.")
    original_id = str(auth.get("original_smtp_message_id") or "").strip()
    bounce_error = str(auth.get("bounce_error") or "").strip()
    evidence_source = str(auth.get("evidence_source") or "").strip()
    if not original_id or not bounce_error:
        raise ValueError("Bounce retry requires original_smtp_message_id and bounce_error.")
    if evidence_source not in {"icloud_delivery_status_notification", "user_provided_delivery_status_notification"}:
        raise ValueError("Bounce retry evidence_source is not approved.")

    recipient_hash = sha256_bytes(to.encode("utf-8"))
    original_path = f"{STANDARD_LEDGER_ROOT}/{recipient_hash}.json"
    original = _get_content(urllib.parse.quote(original_path, safe="/"))
    if original is None:
        raise RuntimeError(f"No original iCloud send ledger exists for {to}.")
    original_record = _decode_record(original)
    if original_record.get("recipient") != to:
        raise RuntimeError("Original ledger recipient mismatch.")
    if original_record.get("smtp_message_id") != original_id:
        raise RuntimeError("Original SMTP Message-ID does not match retry authorization.")

    original_status = str(original_record.get("status") or "")
    if original_status == "bounced":
        pass
    elif original_status == "smtp_accepted" and evidence_source == "user_provided_delivery_status_notification":
        pass
    else:
        raise RuntimeError(f"Original ledger status {original_status!r} is not eligible for bounce retry.")

    return payload, item, to, subject.strip(), body.strip(), auth, original_path, original_record


def claim_retry(payload_path: Path, payload: dict, to: str, subject: str, body: str, attachment: bytes, auth: dict, original_path: str, original_record: dict):
    recipient_hash = sha256_bytes(to.encode("utf-8"))
    path = f"{RETRY_LEDGER_ROOT}/{recipient_hash}.json"
    encoded_path = urllib.parse.quote(path, safe="/")
    if _get_content(encoded_path) is not None:
        raise RuntimeError(f"RETRY BLOCK: {to} already has a one-time bounce retry ledger claim.")

    record = {
        "schema": 1,
        "status": "pending",
        "recipient": to,
        "recipient_sha256": recipient_hash,
        "payload_path": str(payload_path),
        "payload_sha256": sha256_bytes(payload_path.read_bytes()),
        "attachment_sha256": sha256_bytes(attachment),
        "subject_sha256": hashlib.sha256(subject.encode("utf-8")).hexdigest(),
        "body_sha256": hashlib.sha256(body.encode("utf-8")).hexdigest(),
        "batch_id": payload.get("batch_id"),
        "original_ledger_path": original_path,
        "original_status": original_record.get("status"),
        "original_smtp_message_id": original_record.get("smtp_message_id"),
        "bounce_error": str(auth.get("bounce_error") or ""),
        "evidence_source": str(auth.get("evidence_source") or ""),
        "github_repository": os.environ.get("GITHUB_REPOSITORY", ""),
        "github_run_id": os.environ.get("GITHUB_RUN_ID", ""),
        "github_run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT", ""),
        "created_at": utc_now(),
    }
    raw = (json.dumps(record, indent=2, sort_keys=True) + "\n").encode("utf-8")
    created = _request("PUT", f"contents/{encoded_path}", {
        "message": f"Claim one-time iCloud bounce retry {recipient_hash[:12]}",
        "content": base64.b64encode(raw).decode("ascii"),
        "branch": os.environ.get("ICLOUD_LEDGER_BRANCH", "main") or "main",
    })
    content_sha = str((created.get("content") or {}).get("sha") or "")
    if not content_sha:
        raise RuntimeError("Retry ledger claim did not return a content SHA.")
    return path, content_sha, record


def mark_retry_sent(path: str, content_sha: str, record: dict, message_id: str):
    updated = dict(record)
    accepted_at = utc_now()
    updated["status"] = "smtp_accepted"
    updated["delivery_status"] = "pending_bounce_check"
    updated["smtp_message_id"] = message_id
    updated["smtp_accepted_at"] = accepted_at
    updated["sent_at"] = accepted_at
    raw = (json.dumps(updated, indent=2, sort_keys=True) + "\n").encode("utf-8")
    _request("PUT", f"contents/{urllib.parse.quote(path, safe='/')}", {
        "message": f"Confirm one-time iCloud bounce retry {updated['recipient_sha256'][:12]}",
        "content": base64.b64encode(raw).decode("ascii"),
        "sha": content_sha,
        "branch": os.environ.get("ICLOUD_LEDGER_BRANCH", "main") or "main",
    })


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: send_icloud_bounce_retry.py <retry-payload.json>")
    sender = os.environ.get("ICLOUD_SMTP_USER", "").strip()
    password = os.environ.get("ICLOUD_APP_PASSWORD", "").strip()
    if not sender or not password:
        raise SystemExit("Missing ICLOUD_SMTP_USER or ICLOUD_APP_PASSWORD.")

    payload_path = Path(sys.argv[1])
    payload, item, to, subject, body, auth, original_path, original_record = load_retry(payload_path)
    attachment, filename = attachment_for(payload, 1)
    retry_path, content_sha, retry_record = claim_retry(
        payload_path, payload, to, subject, body, attachment, auth, original_path, original_record
    )

    msg = EmailMessage()
    msg["From"] = formataddr((SENDER_NAME, sender))
    msg["To"] = to
    msg["Subject"] = subject
    msg["Reply-To"] = sender
    message_id = make_msgid(domain=sender.rsplit("@", 1)[-1])
    msg["Message-ID"] = message_id
    msg["X-Outreach-Bounce-Retry"] = "one-time"
    msg.set_content(body)
    msg.add_attachment(attachment, maintype="application", subtype="pdf", filename=filename)

    context = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
        server.ehlo()
        server.starttls(context=context)
        server.ehlo()
        server.login(sender, password)
        refused = server.send_message(msg, from_addr=sender, to_addrs=[to])
        if refused:
            raise RuntimeError(f"SMTP refused bounce retry recipient {to}: {refused}")

    mark_retry_sent(retry_path, content_sha, retry_record, message_id)
    print(f"Sent one-time iCloud bounce retry to {to}; Message-ID {message_id}")


if __name__ == "__main__":
    main()
