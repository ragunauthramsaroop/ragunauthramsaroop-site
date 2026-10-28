#!/usr/bin/env python3
"""Read-only forensic inventory of executive outreach in the user's iCloud Mail.

Headers and MIME structure only. No message bodies or attachments are downloaded.
The detailed report is sent exclusively to the user's connected personal Gmail.
No mailbox content is written into the public repository or GitHub logs.
"""
from __future__ import annotations

import argparse
import email
import imaplib
import json
import os
import re
import smtplib
import ssl
from collections import Counter
from datetime import datetime, timezone
from email.header import decode_header, make_header
from email.message import EmailMessage
from email.utils import getaddresses, parsedate_to_datetime

from audit_icloud_sent import find_sent_mailbox

HOST = "imap.mail.me.com"
PORT = 993
SMTP_HOST = "smtp.mail.me.com"
SMTP_PORT = 587
MAX_PER_FOLDER = 12000

OUTREACH_RE = re.compile(
    r"\b(?:executive|recruiter|recruitment|search firm|headhunt|"
    r"curriculum vitae|cv|resume|résumé|application|apply|candidate|"
    r"director|chief|country leadership|government relations|external affairs|"
    r"public affairs|esg|sustainability|social performance|mining|"
    r"international leadership|international profile|expatriate)\b",
    re.I,
)
AUTOREPLY_RE = re.compile(
    r"(?:automatic reply|auto.reply|out of office|delivery status notification|"
    r"undeliverable|could not be delivered|delivery failure)", re.I
)
OWN_DOMAINS = {"icloud.com", "me.com", "mac.com", "agentmail.to"}


def decoded(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except (ValueError, UnicodeError, LookupError):
        return value


def addresses(message: email.message.Message, name: str) -> list[str]:
    return list(dict.fromkeys(
        address.strip().lower()
        for _, address in getaddresses(message.get_all(name, []))
        if address and "@" in address
    ))


def day(value: str) -> str:
    try:
        return parsedate_to_datetime(value).date().isoformat()
    except (ValueError, TypeError, IndexError, OverflowError):
        return value[:50]


def extract_header(data: list) -> email.message.Message | None:
    for item in data or []:
        if isinstance(item, tuple) and len(item) > 1 and isinstance(item[1], bytes):
            return email.message_from_bytes(item[1])
    return None


def attachment_hints(conn: imaplib.IMAP4_SSL, seq: bytes) -> tuple[bool, list[str]]:
    # BODYSTRUCTURE describes parts without downloading their contents.
    status, result = conn.fetch(seq, "(BODYSTRUCTURE)")
    if status != "OK":
        return False, []
    chunks = []
    for item in result or []:
        if isinstance(item, bytes):
            chunks.append(item)
        elif isinstance(item, tuple):
            chunks.extend(part for part in item if isinstance(part, bytes))
    structure = b" ".join(chunks).decode("utf-8", "replace")
    pdf = bool(re.search(r'"APPLICATION"\s+"PDF"', structure, re.I))
    names = re.findall(r'"([^"\r\n]{1,180}\.pdf)"', structure, re.I)
    return pdf, sorted(set(names))[:12]


def scan_folder(
    conn: imaplib.IMAP4_SSL, mailbox: str, since: str, sent: bool,
    known_contacts: set[str] | None = None,
) -> tuple[list[dict], dict]:
    selected_mailbox = '"'+mailbox.replace('"', '\\\"')+'"' if " " in mailbox else mailbox
    status, _ = conn.select(selected_mailbox, readonly=True)
    if status != "OK":
        raise RuntimeError("Unable to open the requested iCloud mailbox read-only")
    since_imap = datetime.strptime(since, "%Y-%m-%d").strftime("%d-%b-%Y")
    status, data = conn.search(None, "SINCE", since_imap)
    if status != "OK":
        raise RuntimeError("Unable to search iCloud Mail")
    all_ids = (data[0] or b"").split()
    selected = all_ids[-MAX_PER_FOLDER:]
    entries = []
    inspected = 0
    for seq in selected:
        status, result = conn.fetch(
            seq,
            "(BODY.PEEK[HEADER.FIELDS (DATE FROM TO CC BCC SUBJECT MESSAGE-ID)])",
        )
        if status != "OK":
            continue
        msg = extract_header(result)
        if msg is None:
            continue
        inspected += 1
        subject = decoded(msg.get("Subject"))
        sender = addresses(msg, "From")
        to = addresses(msg, "To")
        cc = addresses(msg, "Cc")
        bcc = addresses(msg, "Bcc")
        own_only = bool(to) and all(x.split("@")[-1] in OWN_DOMAINS for x in to)
        has_pdf, pdf_names = (False, [])
        cv_pdf_name = False
        if sent:
            has_pdf, pdf_names = attachment_hints(conn, seq)
            cv_pdf_name = any(re.search(r"(?:cv|resume|ramsaroop)", n, re.I) for n in pdf_names)
            relevant = (bool(OUTREACH_RE.search(subject)) or cv_pdf_name) and not own_only
        else:
            relevant = (bool(OUTREACH_RE.search(subject)) or bool(
                set(sender).intersection(known_contacts or set())
            )) and not bool(AUTOREPLY_RE.search(subject))
        if not relevant:
            continue

        row = {
            "date": day(str(msg.get("Date") or "")),
            "subject": subject[:500],
            "from": sender,
            "to": to,
            "cc": cc,
            "bcc": bcc,
            "message_id": str(msg.get("Message-ID") or "")[:300],
        }
        if sent:
            row["pdf_attachment_indicated"] = has_pdf
            row["pdf_filenames_indicated"] = pdf_names
            row["cv_pdf_name_indicated"] = bool(cv_pdf_name)
        entries.append(row)

    return entries, {
        "folder": "sent" if sent else "inbox",
        "matched_since": len(all_ids),
        "inspected": inspected,
        "truncated_to_most_recent": len(all_ids) > len(selected),
        "relevant_header_matches": len(entries),
    }


def build_report(conn: imaplib.IMAP4_SSL, since: str) -> dict:
    sent_name = find_sent_mailbox(conn)
    sent, sent_stats = scan_folder(conn, sent_name, since, True)
    recipient_set = {a for m in sent for a in m["to"] + m["cc"] + m["bcc"]}
    inbound, inbox_stats = scan_folder(conn, "INBOX", since, False, recipient_set)
    monthly = Counter(m["date"][:7] for m in sent if len(m["date"]) >= 7)
    return {
        "schema": "icloud_executive_forensic_v1",
        "audited_at_utc": datetime.now(timezone.utc).isoformat(),
        "since": since,
        "methods": [
            "IMAP read-only",
            "header subject filtering",
            "MIME BODYSTRUCTURE only",
            "no message-body download",
            "no attachment download",
        ],
        "limitations": [
            "Subject-based relevance misses mail with unrelated subjects.",
            "MIME BODYSTRUCTURE PDF hints do not establish successful delivery.",
            "A sent message does not prove receipt.",
            "Inbox screening excludes automatic-reply subjects and misses unrelated reply subjects.",
            "Other folders, deleted mail, and archived inbound mail are not scanned.",
        ],
        "summary": {
            "sent_scanned": sent_stats,
            "inbox_scanned": inbox_stats,
            "outreach_header_matches": len(sent),
            "inbound_subject_matches_excluding_autoreplies": len(inbound),
            "pdf_attachment_indicated_on_outreach": sum(
                bool(x["pdf_attachment_indicated"]) for x in sent
            ),
            "cv_pdf_filename_indicated_on_outreach": sum(
                bool(x["cv_pdf_name_indicated"]) for x in sent
            ),
            "unique_outreach_to_cc_bcc_addresses": len(recipient_set),
            "outreach_by_month": dict(sorted(monthly.items())),
        },
        "outbound": sent,
        "inbound": inbound,
    }


def send_private_report(report: dict, recipient: str, sender: str, password: str) -> None:
    allowed = {"ragunauth123456@gmail.com"}
    if recipient.lower() not in allowed:
        raise ValueError("Refusing to send private data to an unverified account")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient
    message["Subject"] = "PRIVATE iCloud Executive Recruiter Audit | " + stamp
    summary = report["summary"]
    message.set_content(
        "Private read-only iCloud executive outreach scan.\n\n"
        f"Since: {report['since']}\n"
        f"Relevant sent headers: {summary['outreach_header_matches']}\n"
        f"Relevant received headers: {summary['inbound_subject_matches_excluding_autoreplies']}\n"
        f"Sent with PDF attachment indicator: {summary['pdf_attachment_indicated_on_outreach']}\n"
        f"Unique To/Cc/Bcc addresses: {summary['unique_outreach_to_cc_addresses']}\n\n"
        "Full message-header evidence is in the JSON attachment. "
        "This report excludes message bodies and attachment contents. "
        "A Sent record does not prove delivery.\n"
    )
    payload = json.dumps(report, ensure_ascii=False, indent=2).encode("utf-8")
    if len(payload) > 18_000_000:
        raise RuntimeError("Refusing to email an oversized private audit")
    message.add_attachment(
        payload,
        maintype="application",
        subtype="json",
        filename=f"icloud-executive-audit-{stamp}.json",
    )
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=40) as server:
        server.ehlo()
        server.starttls(context=ssl.create_default_context())
        server.ehlo()
        server.login(sender, password)
        server.send_message(message)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--since", default="2026-08-01")
    parser.add_argument("--deliver", action="store_true")
    args = parser.parse_args()
    datetime.strptime(args.since, "%Y-%m-%d")
    sender = os.environ.get("ICLOUD_SMTP_USER", "").strip()
    password = os.environ.get("ICLOUD_APP_PASSWORD", "").strip()
    recipient = os.environ.get("REPORT_TO", "").strip()
    if not sender or not password:
        raise SystemExit("iCloud connection secret is not configured.")
    conn = imaplib.IMAP4_SSL(HOST, PORT)
    try:
        conn.login(sender, password)
        report = build_report(conn, args.since)
    finally:
        try:
            conn.close()
        except (imaplib.IMAP4.error, OSError):
            pass
        conn.logout()

    summary = report["summary"]
    print("iCloud executive forensic scan completed.")
    print("Sent matched:", summary["outreach_header_matches"])
    print("Received matched:", summary["inbound_subject_matches_excluding_autoreplies"])
    print("PDF attachments indicated:", summary["pdf_attachment_indicated_on_outreach"])
    print("Unique outbound contacts:", summary["unique_outreach_to_cc_addresses"])
    print("Scan capped:", any(
        summary[key]["truncated_to_most_recent"]
        for key in ("sent_scanned", "inbox_scanned")
    ))
    if args.deliver:
        send_private_report(report, recipient, sender, password)
        print("Detailed report delivered to the verified connected Gmail account.")
    else:
        print("Detailed records intentionally not exported.")


if __name__ == "__main__":
    main()
