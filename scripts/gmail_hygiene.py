#!/usr/bin/env python3
"""Conservative Gmail storage hygiene for recurring GitHub Actions use.

The script protects starred and important mail. It removes high-confidence junk
from All Mail into Trash, then permanently clears Trash and Spam only after a
7-day recovery period.
"""

from __future__ import annotations

import imaplib
import os
import re
import sys
from datetime import datetime, timedelta, timezone

IMAP_HOST = "imap.gmail.com"
IMAP_PORT = 993
DEFAULT_USER = "ragunauth123456@gmail.com"
MAX_PER_RULE = int(os.environ.get("GMAIL_HYGIENE_MAX_PER_RULE", "5000"))
RECOVERY_DAYS = int(os.environ.get("GMAIL_HYGIENE_RECOVERY_DAYS", "7"))

RULES = (
    (
        "github_failed_runs",
        'from:notifications@github.com subject:"Run failed:" older_than:1d -is:starred -is:important',
    ),
    (
        "old_promotions",
        "category:promotions older_than:30d -is:starred -is:important",
    ),
    (
        "old_social",
        "category:social older_than:30d -is:starred -is:important",
    ),
    (
        "old_forums",
        "category:forums older_than:90d -is:starred -is:important",
    ),
)


def parse_mailbox(line: bytes) -> tuple[set[str], str] | None:
    text = line.decode("utf-8", "replace")
    match = re.match(r"^\((.*?)\)\s+\".*?\"\s+(.*)$", text)
    if not match:
        return None
    flags = set(match.group(1).split())
    name = match.group(2).strip()
    if name.startswith('"') and name.endswith('"'):
        name = name[1:-1].replace('\\"', '"')
    return flags, name


def special_mailboxes(conn: imaplib.IMAP4_SSL) -> dict[str, str]:
    status, lines = conn.list()
    if status != "OK" or not lines:
        raise RuntimeError("Unable to list Gmail mailboxes.")
    found: dict[str, str] = {}
    for line in lines:
        if not isinstance(line, bytes):
            continue
        parsed = parse_mailbox(line)
        if not parsed:
            continue
        flags, name = parsed
        if "\\All" in flags:
            found["all"] = name
        if "\\Trash" in flags:
            found["trash"] = name
        if "\\Junk" in flags:
            found["spam"] = name
    for key in ("all", "trash", "spam"):
        if key not in found:
            raise RuntimeError(f"Gmail special mailbox not found: {key}")
    return found


def select(conn: imaplib.IMAP4_SSL, mailbox: str) -> None:
    status, _ = conn.select(f'"{mailbox}"', readonly=False)
    if status != "OK":
        status, _ = conn.select(mailbox, readonly=False)
    if status != "OK":
        raise RuntimeError(f"Unable to select mailbox {mailbox!r}.")


def raw_search(conn: imaplib.IMAP4_SSL, query: str) -> list[bytes]:
    escaped = query.replace('"', '\\"')
    status, data = conn.uid("SEARCH", None, "X-GM-RAW", f'"{escaped}"')
    if status != "OK" or not data:
        raise RuntimeError(f"Gmail search failed: {query}")
    return [uid for uid in data[0].split() if uid]


def chunks(items: list[bytes], size: int = 250):
    for start in range(0, len(items), size):
        yield items[start : start + size]


def move_to_trash(conn: imaplib.IMAP4_SSL, uids: list[bytes], trash: str) -> int:
    selected = uids[:MAX_PER_RULE]
    if not selected:
        return 0
    capabilities = {c.decode() if isinstance(c, bytes) else str(c) for c in conn.capabilities}
    for group in chunks(selected):
        uid_set = b",".join(group).decode()
        if "MOVE" in capabilities:
            status, _ = conn.uid("MOVE", uid_set, f'"{trash}"')
            if status != "OK":
                raise RuntimeError("IMAP MOVE to Trash failed.")
        else:
            status, _ = conn.uid("COPY", uid_set, f'"{trash}"')
            if status != "OK":
                raise RuntimeError("IMAP COPY to Trash failed.")
            status, _ = conn.uid("STORE", uid_set, "+FLAGS.SILENT", "(\\Deleted)")
            if status != "OK":
                raise RuntimeError("Unable to remove copied junk from All Mail.")
            conn.expunge()
    return len(selected)


def purge_old(conn: imaplib.IMAP4_SSL, mailbox: str, days: int) -> int:
    select(conn, mailbox)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    before = cutoff.strftime("%d-%b-%Y")
    status, data = conn.uid("SEARCH", None, "BEFORE", before)
    if status != "OK" or not data:
        raise RuntimeError(f"Unable to search old mail in {mailbox!r}.")
    uids = [uid for uid in data[0].split() if uid][:MAX_PER_RULE]
    for group in chunks(uids):
        uid_set = b",".join(group).decode()
        status, _ = conn.uid("STORE", uid_set, "+FLAGS.SILENT", "(\\Deleted)")
        if status != "OK":
            raise RuntimeError(f"Unable to mark old mail deleted in {mailbox!r}.")
    if uids:
        conn.expunge()
    return len(uids)


def main() -> int:
    user = os.environ.get("GMAIL_USER", DEFAULT_USER).strip()
    password = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
    if not password:
        print("GMAIL_APP_PASSWORD is not configured. Hygiene run skipped cleanly.")
        return 0

    conn = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    try:
        conn.login(user, password)
        boxes = special_mailboxes(conn)
        moved_total = 0
        for name, query in RULES:
            select(conn, boxes["all"])
            uids = raw_search(conn, query)
            moved = move_to_trash(conn, uids, boxes["trash"])
            moved_total += moved
            print(f"{name}: moved {moved} message(s) to Trash")

        purged_trash = purge_old(conn, boxes["trash"], RECOVERY_DAYS)
        purged_spam = purge_old(conn, boxes["spam"], RECOVERY_DAYS)
        print(
            f"Gmail hygiene complete: moved={moved_total}, "
            f"purged_trash={purged_trash}, purged_spam={purged_spam}, "
            f"recovery_days={RECOVERY_DAYS}"
        )
        return 0
    finally:
        try:
            conn.close()
        except Exception:
            pass
        try:
            conn.logout()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main())
