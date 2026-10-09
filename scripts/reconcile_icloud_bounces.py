#!/usr/bin/env python3
"""Reconcile iCloud delivery-status notifications back into the outreach ledger.

This script never treats the absence of a bounce as proof of delivery. It only marks
known failures when a bounce/DSN message can be tied to an existing recipient ledger.
"""

import base64
import email
import imaplib
import json
import os
import re
import urllib.parse
from datetime import datetime, timedelta, timezone
from email import policy
from email.header import decode_header, make_header

from icloud_send_ledger import (
    LEDGER_ROOT,
    _branch,
    _decode_record,
    _get_content,
    _request,
    normalize_recipient,
    sha256_bytes,
    utc_now,
)

IMAP_HOST = "imap.mail.me.com"
IMAP_PORT = 993
MAX_MESSAGES = 500

EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
STATUS_RE = re.compile(r"\b(?:4|5)(?:\.\d+){1,2}\b|\b(?:4|5)\d\d\b")

BOUNCE_SUBJECT_TERMS = (
    "undelivered",
    "delivery status notification",
    "delivery failure",
    "couldn't be delivered",
    "could not be delivered",
    "returned to sender",
    "mail delivery",
    "address not found",
)

BOUNCE_FROM_TERMS = (
    "mailer-daemon",
    "postmaster",
    "mail delivery system",
    "mail delivery subsystem",
    "domain postmaster",
)


def decoded_header(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value


def part_text(message: email.message.EmailMessage) -> str:
    chunks: list[str] = []
    if message.is_multipart():
        for part in message.walk():
            ctype = part.get_content_type()
            if ctype not in {"text/plain", "text/html", "message/delivery-status"}:
                continue
            try:
                content = part.get_content()
            except Exception:
                payload = part.get_payload(decode=True)
                if isinstance(payload, bytes):
                    content = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
                else:
                    content = str(payload or "")
            if isinstance(content, list):
                for item in content:
                    chunks.append(str(item))
            else:
                chunks.append(str(content))
    else:
        try:
            chunks.append(str(message.get_content()))
        except Exception:
            payload = message.get_payload(decode=True)
            if isinstance(payload, bytes):
                chunks.append(payload.decode(message.get_content_charset() or "utf-8", errors="replace"))
    return "\n".join(chunks)


def looks_like_bounce(message: email.message.EmailMessage, text: str) -> bool:
    subject = decoded_header(message.get("Subject")).lower()
    sender = decoded_header(message.get("From")).lower()
    haystack = f"{subject}\n{sender}\n{text[:8000].lower()}"
    if any(term in subject for term in BOUNCE_SUBJECT_TERMS):
        return True
    if any(term in sender for term in BOUNCE_FROM_TERMS):
        return True
    return "final-recipient:" in haystack or "x-failed-recipients:" in haystack


def candidate_addresses(text: str, sender_address: str) -> list[str]:
    candidates: list[str] = []
    patterns = [
        r"Final-Recipient:\s*(?:rfc822;)?\s*<?([^>\s;,]+@[^>\s;,]+)",
        r"Original-Recipient:\s*(?:rfc822;)?\s*<?([^>\s;,]+@[^>\s;,]+)",
        r"X-Failed-Recipients:\s*<?([^>\s;,]+@[^>\s;,]+)",
        r"message you sent to\s+<?([^>\s;,]+@[^>\s;,]+)",
        r"wasn['’]?t delivered to\s+<?([^>\s;,]+@[^>\s;,]+)",
        r"couldn['’]?t be delivered to\s+<?([^>\s;,]+@[^>\s;,]+)",
        r"<([^>\s]+@[^>\s]+)>:\s*host",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text, flags=re.I):
            candidates.append(match.group(1))

    if not candidates:
        candidates.extend(EMAIL_RE.findall(text))

    normalized: list[str] = []
    seen: set[str] = set()
    sender_lower = sender_address.lower()
    for raw in candidates:
        raw = raw.strip("<>[](){}.,;:'\" ")
        try:
            value = normalize_recipient(raw)
        except ValueError:
            continue
        if value == sender_lower:
            continue
        local = value.split("@", 1)[0]
        if local in {"postmaster", "mailer-daemon", "mailer_daemon", "noreply", "no-reply"}:
            continue
        if value not in seen:
            seen.add(value)
            normalized.append(value)
    return normalized


def find_status(text: str) -> str | None:
    match = STATUS_RE.search(text)
    return match.group(0) if match else None


def update_bounced(recipient: str, subject: str, message_id: str, text: str) -> bool:
    recipient_hash = sha256_bytes(recipient.encode("utf-8"))
    path = f"{LEDGER_ROOT}/{recipient_hash}.json"
    encoded_path = urllib.parse.quote(path, safe="/")
    current = _get_content(encoded_path)
    if current is None:
        return False

    record = _decode_record(current)
    if record.get("recipient") != recipient:
        return False
    if record.get("status") == "bounced":
        return True

    previous_status = record.get("status")
    record["status"] = "bounced"
    record["delivery_status"] = "bounced"
    record["previous_status"] = previous_status
    record["bounced_at"] = utc_now()
    record["bounce_subject"] = subject[:300]
    record["bounce_message_id"] = message_id[:300]
    smtp_status = find_status(text)
    if smtp_status:
        record["bounce_smtp_status"] = smtp_status

    body = (json.dumps(record, indent=2, sort_keys=True) + "\n").encode("utf-8")
    payload = {
        "message": f"Mark iCloud outreach bounced {recipient_hash[:12]}",
        "content": base64.b64encode(body).decode("ascii"),
        "sha": str(current.get("sha") or ""),
        "branch": _branch(),
    }
    try:
        _request("PUT", f"contents/{encoded_path}", payload)
    except RuntimeError as exc:
        if "HTTP 409" not in str(exc) and "HTTP 422" not in str(exc):
            raise
        refreshed = _get_content(encoded_path)
        if refreshed is None:
            raise
        refreshed_record = _decode_record(refreshed)
        if refreshed_record.get("status") == "bounced":
            return True
        payload["sha"] = str(refreshed.get("sha") or "")
        _request("PUT", f"contents/{encoded_path}", payload)

    print(f"Marked bounced: {recipient}; previous_status={previous_status}; smtp_status={smtp_status or 'unknown'}")
    return True


def main() -> None:
    sender = os.environ.get("ICLOUD_SMTP_USER", "").strip()
    password = os.environ.get("ICLOUD_APP_PASSWORD", "").strip()
    if not sender or not password:
        raise SystemExit("Missing ICLOUD_SMTP_USER or ICLOUD_APP_PASSWORD.")

    lookback_days = int(os.environ.get("BOUNCE_LOOKBACK_DAYS", "10"))
    since_date = (datetime.now(timezone.utc) - timedelta(days=max(1, lookback_days))).strftime("%d-%b-%Y")

    conn = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    scanned = 0
    bounce_messages = 0
    matched_records: set[str] = set()
    try:
        conn.login(sender, password)
        status, _ = conn.select("INBOX", readonly=True)
        if status != "OK":
            raise RuntimeError("Unable to select iCloud INBOX.")
        status, data = conn.search(None, "SINCE", since_date)
        if status != "OK":
            raise RuntimeError("Unable to search iCloud INBOX.")
        message_ids = (data[0] or b"").split()[-MAX_MESSAGES:]
        for imap_id in message_ids:
            status, payload = conn.fetch(imap_id, "(RFC822)")
            if status != "OK" or not payload:
                continue
            raw = None
            for item in payload:
                if isinstance(item, tuple) and len(item) >= 2 and isinstance(item[1], bytes):
                    raw = item[1]
                    break
            if not raw:
                continue
            scanned += 1
            message = email.message_from_bytes(raw, policy=policy.default)
            text = part_text(message)
            if not looks_like_bounce(message, text):
                continue
            bounce_messages += 1
            subject = decoded_header(message.get("Subject"))
            message_id = str(message.get("Message-ID") or "")
            for recipient in candidate_addresses(text, sender):
                if update_bounced(recipient, subject, message_id, text):
                    matched_records.add(recipient)
    finally:
        try:
            conn.close()
        except Exception:
            pass
        try:
            conn.logout()
        except Exception:
            pass

    print(
        f"Bounce reconciliation complete: scanned={scanned}, "
        f"bounce_messages={bounce_messages}, matched_ledger_records={len(matched_records)}"
    )


if __name__ == "__main__":
    main()
