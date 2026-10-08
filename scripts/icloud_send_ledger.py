#!/usr/bin/env python3
"""Fail-closed recipient ledger for iCloud SMTP outreach.

Each normalized recipient owns one immutable claim path keyed by SHA-256. A send must
create the claim before SMTP. Existing claims block future sends. After SMTP reports
success, the same claim is updated to status=sent. If execution stops between SMTP
and the update, the pending claim remains and future sends stay blocked for review.
"""

import base64
import hashlib
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

LEDGER_ROOT = "outreach/icloud-send-ledger"
API_VERSION = "2022-11-28"
MAX_WRITE_ATTEMPTS = 4


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def normalize_recipient(address: str) -> str:
    value = address.strip().lower()
    if value.count("@") != 1 or value.startswith("@") or value.endswith("@"):
        raise ValueError(f"Invalid recipient address: {address!r}")
    return value


def _required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Fail-closed ledger requires {name}.")
    return value


def _repo() -> str:
    return os.environ.get("ICLOUD_LEDGER_REPOSITORY", "").strip() or _required_env("GITHUB_REPOSITORY")


def _branch() -> str:
    return os.environ.get("ICLOUD_LEDGER_BRANCH", "main").strip() or "main"


def _token() -> str:
    return _required_env("GITHUB_TOKEN")


def _request(method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    url = f"https://api.github.com/repos/{_repo()}/{path.lstrip('/')}"
    data = None
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {_token()}",
        "X-GitHub-Api-Version": API_VERSION,
        "User-Agent": "icloud-outreach-ledger",
    }
    if payload is not None:
        data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read()
            return json.loads(raw.decode("utf-8")) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GitHub ledger API {method} failed with HTTP {exc.code}: {detail[:800]}") from exc


def _get_content(encoded_path: str) -> dict[str, Any] | None:
    try:
        return _request("GET", f"contents/{encoded_path}?ref={urllib.parse.quote(_branch(), safe='')}")
    except RuntimeError as exc:
        if "HTTP 404" in str(exc):
            return None
        raise


def _decode_record(content_response: dict[str, Any]) -> dict[str, Any]:
    raw = str(content_response.get("content") or "").replace("\n", "")
    if not raw:
        raise RuntimeError("Ledger content response did not include file content.")
    try:
        return json.loads(base64.b64decode(raw).decode("utf-8"))
    except Exception as exc:
        raise RuntimeError("Ledger content response could not be decoded safely.") from exc


@dataclass
class LedgerClaim:
    recipient: str
    path: str
    content_sha: str
    record: dict[str, Any]


def claim_recipient(
    recipient: str,
    payload_path: str,
    payload_bytes: bytes,
    attachment: bytes,
    subject: str,
    body: str,
    batch_id: str | None = None,
) -> LedgerClaim:
    normalized = normalize_recipient(recipient)
    recipient_hash = sha256_bytes(normalized.encode("utf-8"))
    path = f"{LEDGER_ROOT}/{recipient_hash}.json"
    encoded_path = urllib.parse.quote(path, safe="/")

    existing = _get_content(encoded_path)
    if existing is not None:
        existing_sha = existing.get("sha", "unknown")
        raise RuntimeError(
            f"DUPLICATE BLOCK: {normalized} already has ledger claim {path} ({existing_sha})."
        )

    run_id = os.environ.get("GITHUB_RUN_ID", "").strip() or "unknown"
    run_attempt = os.environ.get("GITHUB_RUN_ATTEMPT", "").strip() or "unknown"
    record: dict[str, Any] = {
        "schema": 1,
        "status": "pending",
        "recipient": normalized,
        "recipient_sha256": recipient_hash,
        "payload_path": payload_path,
        "payload_sha256": sha256_bytes(payload_bytes),
        "attachment_sha256": sha256_bytes(attachment),
        "subject_sha256": sha256_bytes(subject.encode("utf-8")),
        "body_sha256": sha256_bytes(body.encode("utf-8")),
        "batch_id": batch_id,
        "github_repository": _repo(),
        "github_run_id": run_id,
        "github_run_attempt": run_attempt,
        "ledger_branch": _branch(),
        "created_at": utc_now(),
    }
    body_bytes = (json.dumps(record, indent=2, sort_keys=True) + "\n").encode("utf-8")
    create_payload = {
        "message": f"Claim iCloud outreach recipient {recipient_hash[:12]}",
        "content": base64.b64encode(body_bytes).decode("ascii"),
        "branch": _branch(),
    }

    created: dict[str, Any] | None = None
    for attempt in range(MAX_WRITE_ATTEMPTS):
        try:
            created = _request("PUT", f"contents/{encoded_path}", create_payload)
            break
        except RuntimeError as exc:
            text = str(exc)
            if "HTTP 409" not in text and "HTTP 422" not in text:
                raise

            existing = _get_content(encoded_path)
            if existing is not None:
                existing_sha = existing.get("sha", "unknown")
                raise RuntimeError(
                    f"DUPLICATE BLOCK: {normalized} already has ledger claim {path} ({existing_sha})."
                ) from exc

            if attempt + 1 >= MAX_WRITE_ATTEMPTS:
                raise RuntimeError(
                    f"Fail-closed ledger could not claim {normalized} after concurrent branch updates. No SMTP send is permitted."
                ) from exc
            time.sleep(0.6 * (attempt + 1))

    if created is None:
        raise RuntimeError(f"Fail-closed ledger did not create a claim for {normalized}.")

    content_sha = str((created.get("content") or {}).get("sha") or "")
    if not content_sha:
        raise RuntimeError(f"Fail-closed ledger did not receive a content SHA for {normalized}.")
    print(f"Ledger claim created for {normalized}: {path}")
    return LedgerClaim(normalized, path, content_sha, record)


def mark_sent(claim: LedgerClaim, smtp_message_id: str) -> None:
    record = dict(claim.record)
    record["status"] = "sent"
    record["smtp_message_id"] = smtp_message_id
    record["sent_at"] = utc_now()
    body_bytes = (json.dumps(record, indent=2, sort_keys=True) + "\n").encode("utf-8")
    encoded_path = urllib.parse.quote(claim.path, safe="/")
    payload = {
        "message": f"Confirm iCloud outreach sent {record['recipient_sha256'][:12]}",
        "content": base64.b64encode(body_bytes).decode("ascii"),
        "sha": claim.content_sha,
        "branch": _branch(),
    }

    updated: dict[str, Any] | None = None
    for attempt in range(MAX_WRITE_ATTEMPTS):
        try:
            updated = _request("PUT", f"contents/{encoded_path}", payload)
            break
        except RuntimeError as exc:
            text = str(exc)
            if "HTTP 409" not in text and "HTTP 422" not in text:
                raise

            current = _get_content(encoded_path)
            if current is None:
                raise RuntimeError(
                    f"SMTP returned success for {claim.recipient}, but the ledger claim disappeared. Manual review is required."
                ) from exc

            current_record = _decode_record(current)
            if (
                current_record.get("recipient") != claim.recipient
                or current_record.get("github_run_id") != claim.record.get("github_run_id")
            ):
                raise RuntimeError(
                    f"SMTP returned success for {claim.recipient}, but the ledger claim no longer belongs to this run. Manual review is required."
                ) from exc

            if current_record.get("status") == "sent":
                if current_record.get("smtp_message_id") == smtp_message_id:
                    claim.content_sha = str(current.get("sha") or claim.content_sha)
                    claim.record = current_record
                    print(f"Ledger already marked sent for {claim.recipient}; Message-ID {smtp_message_id}")
                    return
                raise RuntimeError(
                    f"SMTP returned success for {claim.recipient}, but the ledger is already marked sent with a different Message-ID. Manual review is required."
                ) from exc

            if current_record.get("status") != "pending":
                raise RuntimeError(
                    f"SMTP returned success for {claim.recipient}, but the ledger status is unexpected. Manual review is required."
                ) from exc

            current_sha = str(current.get("sha") or "")
            if not current_sha:
                raise RuntimeError(
                    f"SMTP returned success for {claim.recipient}, but the current ledger SHA is unavailable. Manual review is required."
                ) from exc
            payload["sha"] = current_sha

            if attempt + 1 >= MAX_WRITE_ATTEMPTS:
                raise RuntimeError(
                    f"SMTP returned success for {claim.recipient}, but ledger confirmation could not survive concurrent branch updates. The pending claim remains fail-closed."
                ) from exc
            time.sleep(0.6 * (attempt + 1))

    if updated is None:
        raise RuntimeError(
            f"SMTP returned success for {claim.recipient}, but ledger confirmation did not complete. The pending claim remains fail-closed."
        )

    new_sha = str((updated.get("content") or {}).get("sha") or "")
    if not new_sha:
        raise RuntimeError(
            f"SMTP returned success for {claim.recipient}, but ledger confirmation failed. The pending claim remains fail-closed and must be reviewed before any retry."
        )
    claim.content_sha = new_sha
    claim.record = record
    print(f"Ledger marked sent for {claim.recipient}; Message-ID {smtp_message_id}")


def payload_bytes(path: str | Path) -> bytes:
    return Path(path).read_bytes()
