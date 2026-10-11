#!/usr/bin/env python3
"""Conservative Yahoo Inbox hygiene via IMAP.

Moves high-confidence bulk/automated mail out of Inbox into Archive while
protecting direct, security, payment, travel, recruiter, interview, and other
action-sensitive messages. No permanent deletion is performed.
"""

from __future__ import annotations

import email
import imaplib
import os
import re
import sys
from email.header import decode_header, make_header
from email.utils import parseaddr

HOST = "imap.mail.yahoo.com"
USER = os.getenv("YAHOO_USER", "ragunauthramsaroop@yahoo.com")
PASSWORD = os.getenv("YAHOO_APP_PASSWORD", "")
ARCHIVE_FOLDER = os.getenv("YAHOO_ARCHIVE_FOLDER", "Archive")
MAX_MESSAGES = int(os.getenv("YAHOO_MAX_MESSAGES", "2000"))

PROTECTED_WORDS = re.compile(
    r"security|2fa|two[- ]factor|verification|verify|password|passkey|sign[- ]?in|"
    r"account alert|payment failed|payment due|invoice|receipt|renewal|subscription payment|"
    r"interview|recruiter|recruitment|hiring|application status|job decision|offer letter|"
    r"flight|hotel|booking|reservation|appointment|meeting invitation|calendar invitation|"
    r"action required|urgent|fraud|unauthorized|suspicious|bank|tax|government|legal",
    re.I,
)

PROTECTED_SENDERS = re.compile(
    r"(@icloud\.com|@guygold\.com|@zijinmining\.com|@google\.com|@apple\.com|"
    r"@paypal\.com|@stripe\.com|@scotiabank\.com)$",
    re.I,
)

BULK_SENDER_HINTS = re.compile(
    r"temu|newsletter|news@|marketing|promotions?|offers?|deals?|shop|retail|"
    r"seekingalpha|investing|metricool|cloudflare|notion|mentimeter|kiehls|"
    r"facebookmail|linkedin.*jobs|workopia|job alert|notify-noreply",
    re.I,
)

AUTOMATION_HINTS = re.compile(
    r"github-actions|notifications@github\.com|noreply@us2\.make\.com|"
    r"notify\.railway\.app|tinyfish|resend|appdeploy|frantic",
    re.I,
)


def decode(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value


def ensure_archive(imap: imaplib.IMAP4_SSL) -> str:
    typ, boxes = imap.list()
    if typ != "OK":
        raise RuntimeError("Unable to list Yahoo folders")
    found = False
    for raw in boxes or []:
        text = raw.decode(errors="replace")
        if text.rstrip().endswith(f'"{ARCHIVE_FOLDER}"') or text.rstrip().endswith(ARCHIVE_FOLDER):
            found = True
            break
    if not found:
        typ, _ = imap.create(ARCHIVE_FOLDER)
        if typ != "OK":
            raise RuntimeError("Unable to create Yahoo Archive folder")
    return ARCHIVE_FOLDER


def is_flagged(flags_blob: bytes | str) -> bool:
    text = flags_blob.decode(errors="ignore") if isinstance(flags_blob, bytes) else str(flags_blob)
    return "\\Flagged" in text


def classify(msg: email.message.Message) -> tuple[bool, str]:
    subject = decode(msg.get("Subject"))
    from_header = decode(msg.get("From"))
    sender_addr = parseaddr(from_header)[1].lower()
    combined = f"{from_header} {sender_addr} {subject}"

    if PROTECTED_WORDS.search(combined):
        return False, "protected_keyword"
    if PROTECTED_SENDERS.search(sender_addr):
        return False, "protected_sender"

    list_unsub = bool(msg.get("List-Unsubscribe"))
    precedence = (msg.get("Precedence") or "").lower()
    auto_submitted = (msg.get("Auto-Submitted") or "").lower()

    if AUTOMATION_HINTS.search(combined):
        return True, "automation_noise"
    if BULK_SENDER_HINTS.search(combined):
        return True, "bulk_sender"
    if list_unsub:
        return True, "mailing_list"
    if precedence in {"bulk", "list", "junk"}:
        return True, "bulk_precedence"
    if auto_submitted and auto_submitted != "no":
        return True, "automated"

    return False, "keep"


def move_to_archive(imap: imaplib.IMAP4_SSL, uid: bytes, archive: str) -> bool:
    """Move one message. Return True only when COPY+delete fallback was used."""
    uid_s = uid.decode()
    typ, _ = imap.uid("MOVE", uid_s, archive)
    if typ == "OK":
        return False
    typ, _ = imap.uid("COPY", uid_s, archive)
    if typ != "OK":
        raise RuntimeError(f"Could not copy UID {uid_s} to Archive")
    typ, _ = imap.uid("STORE", uid_s, "+FLAGS.SILENT", "(\\Deleted)")
    if typ != "OK":
        raise RuntimeError(f"Could not remove Inbox copy for UID {uid_s}")
    return True


def main() -> int:
    if not PASSWORD:
        print("YAHOO_APP_PASSWORD is not configured. Yahoo hygiene skipped cleanly.")
        return 0

    moved = 0
    kept = 0
    protected = 0
    reasons: dict[str, int] = {}

    with imaplib.IMAP4_SSL(HOST, 993) as imap:
        imap.login(USER, PASSWORD)
        archive = ensure_archive(imap)
        typ, _ = imap.select("INBOX", readonly=False)
        if typ != "OK":
            raise RuntimeError("Unable to select Yahoo Inbox")

        typ, data = imap.uid("SEARCH", None, "ALL")
        if typ != "OK":
            raise RuntimeError("Unable to search Yahoo Inbox")
        uids = (data[0] or b"").split()
        if MAX_MESSAGES > 0:
            uids = uids[-MAX_MESSAGES:]

        used_copy_fallback = False
        for uid in uids:
            typ, fetched = imap.uid(
                "FETCH", uid.decode(),
                "(FLAGS BODY.PEEK[HEADER.FIELDS (FROM SUBJECT LIST-UNSUBSCRIBE PRECEDENCE AUTO-SUBMITTED)])",
            )
            if typ != "OK" or not fetched:
                continue

            flags_blob = b""
            header_bytes = b""
            for item in fetched:
                if isinstance(item, tuple):
                    meta, payload = item
                    flags_blob += meta if isinstance(meta, bytes) else str(meta).encode()
                    if isinstance(payload, bytes):
                        header_bytes += payload

            if is_flagged(flags_blob):
                protected += 1
                reasons["flagged"] = reasons.get("flagged", 0) + 1
                continue

            msg = email.message_from_bytes(header_bytes)
            should_move, reason = classify(msg)
            reasons[reason] = reasons.get(reason, 0) + 1
            if not should_move:
                kept += 1
                if reason.startswith("protected_"):
                    protected += 1
                continue

            used_copy_fallback = move_to_archive(imap, uid, archive) or used_copy_fallback
            moved += 1

        if used_copy_fallback:
            imap.expunge()
        imap.close()

    print(f"Yahoo Inbox hygiene complete: moved={moved}, kept={kept}, protected={protected}")
    for reason, count in sorted(reasons.items()):
        print(f"{reason}={count}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except imaplib.IMAP4.error as exc:
        print(f"Yahoo IMAP error: {exc}", file=sys.stderr)
        raise SystemExit(2)
