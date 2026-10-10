#!/usr/bin/env python3
"""Read-only audit for executive mail transport and outreach campaign control.

This script never sends email and never calls an external service. It validates the
public-safe transport status file, inspects review queues and confirmed-send ledgers,
and reports duplicate or unsafe state before any human-authorized dispatch step.
"""

from __future__ import annotations

import json
import os
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATUS = ROOT / "outreach" / "transport-status.json"
REVIEW = ROOT / "outreach" / "review-queue"
LEDGER = ROOT / "outreach" / "icloud-send-ledger"

PRIVATE_KEYS = {
    "receiving_address",
    "receiving_endpoint",
    "inbox_id",
    "api_key",
    "api_secret",
    "secret",
    "password",
    "app_password",
}


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def walk_keys(value, prefix=""):
    if isinstance(value, dict):
        for key, child in value.items():
            here = f"{prefix}.{key}" if prefix else key
            yield here, key, child
            yield from walk_keys(child, here)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from walk_keys(child, f"{prefix}[{index}]")


def recipient_values(data):
    found = []
    if not isinstance(data, dict):
        return found
    messages = data.get("messages")
    if isinstance(messages, list):
        for item in messages:
            if isinstance(item, dict) and isinstance(item.get("to"), str):
                found.append(item["to"].strip().lower())
    for field in ("primary_targets", "reserve_pool"):
        items = data.get(field)
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict) and isinstance(item.get("recipient"), str):
                    found.append(item["recipient"].strip().lower())
    retry = data.get("separate_retry_candidate")
    if isinstance(retry, dict) and isinstance(retry.get("recipient"), str):
        found.append(retry["recipient"].strip().lower())
    return found


def main() -> int:
    problems = []
    warnings = []

    if not STATUS.exists():
        problems.append("Missing outreach/transport-status.json")
        status = {}
    else:
        status = load_json(STATUS)

    for location, key, value in walk_keys(status):
        if key.lower() in PRIVATE_KEYS and value not in (None, False, "", "not_stored"):
            problems.append(f"Private transport detail must not be committed: {location}")

    inbound = status.get("inbound", {}) if isinstance(status, dict) else {}
    relay = status.get("relay", {}) if isinstance(status, dict) else {}
    campaign = status.get("campaign_control", {}) if isinstance(status, dict) else {}

    if campaign.get("executable_bulk_dispatch_from_review_queue") is not False:
        problems.append("Review queue must remain non-executable by policy.")
    if campaign.get("count_as_sent_only_with_delivery_evidence") is not True:
        problems.append("Confirmed-send counting must require delivery evidence.")

    review_files = sorted(REVIEW.glob("*.json")) if REVIEW.exists() else []
    review_recipients = []
    review_only_files = 0
    parsed_review_files = 0
    for path in review_files:
        try:
            data = load_json(path)
        except Exception as exc:
            problems.append(f"Unreadable review JSON {path.name}: {exc}")
            continue
        parsed_review_files += 1
        mode = data.get("mode") if isinstance(data, dict) else None
        if mode == "review_only_no_send":
            review_only_files += 1
        elif mode is not None:
            warnings.append(f"Review file {path.name} declares mode={mode!r}; inspect before use.")
        review_recipients.extend(recipient_values(data))

    duplicates = sorted(address for address, count in Counter(review_recipients).items() if count > 1)
    if duplicates:
        warnings.append(f"Review queue contains {len(duplicates)} repeated recipient address(es) across files.")

    ledger_files = sorted(LEDGER.glob("*.json")) if LEDGER.exists() else []
    confirmed = 0
    claimed = 0
    ledger_recipients = []
    for path in ledger_files:
        try:
            data = load_json(path)
        except Exception as exc:
            problems.append(f"Unreadable ledger JSON {path.name}: {exc}")
            continue
        if isinstance(data, dict):
            state = str(data.get("status") or data.get("state") or "").lower()
            if state in {"sent", "accepted", "confirmed", "smtp_accepted"} or data.get("message_id"):
                confirmed += 1
            else:
                claimed += 1
            recipient = data.get("recipient") or data.get("to")
            if isinstance(recipient, str):
                ledger_recipients.append(recipient.strip().lower())

    overlap = sorted(set(review_recipients) & set(ledger_recipients))
    if overlap:
        warnings.append(f"{len(overlap)} review recipient(s) also appear in the send ledger; duplicate guard must skip them.")

    summary = [
        "# Executive Outreach Control Audit",
        "",
        f"- Transport sender: {status.get('professional_identity', {}).get('from', 'unknown') if isinstance(status, dict) else 'unknown'}",
        f"- Inbound inbox: {'created' if inbound.get('inbox_created') else 'not created'}",
        f"- iCloud relay: {inbound.get('icloud_delivery', 'unknown')}",
        f"- Make authorization: {relay.get('authorization', 'unknown')}",
        f"- Review JSON files parsed: {parsed_review_files}",
        f"- Explicit review-only files: {review_only_files}",
        f"- Review recipient references: {len(review_recipients)}",
        f"- Send-ledger files: {len(ledger_files)}",
        f"- Ledger entries with acceptance evidence: {confirmed}",
        f"- Ledger entries without acceptance evidence: {claimed}",
        f"- Problems: {len(problems)}",
        f"- Warnings: {len(warnings)}",
    ]
    if problems:
        summary += ["", "## Problems"] + [f"- {item}" for item in problems]
    if warnings:
        summary += ["", "## Warnings"] + [f"- {item}" for item in warnings]

    text = "\n".join(summary) + "\n"
    print(text)
    step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary:
        with open(step_summary, "a", encoding="utf-8") as handle:
            handle.write(text)

    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
