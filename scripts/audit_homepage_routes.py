#!/usr/bin/env python3
"""Audit first-party homepage links without network calls or new dependencies.

Run: python scripts/audit_homepage_routes.py
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]
HOME = ROOT / "index.html"


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.targets = []
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if attributes.get("id"):
            self.ids.add(attributes["id"])
        if tag == "a" and attributes.get("href"):
            self.targets.append(attributes["href"])


def resolve_local(href):
    parsed = urlsplit(href)
    if parsed.scheme or parsed.netloc or not parsed.path.startswith("/"):
        return None
    path = unquote(parsed.path)
    if "\\x00" in path or any(part == ".." for part in Path(path).parts):
        raise ValueError("Unsafe homepage URL: " + href)
    candidate = ROOT / path.lstrip("/")
    if path.endswith("/"):
        candidate = candidate / "index.html"
    return candidate


def main():
    page = Links()
    page.feed(HOME.read_text(encoding="utf-8"))
    errors = []
    local = 0
    for href in page.targets:
        if href.startswith("#"):
            if href[1:] not in page.ids:
                errors.append("Missing homepage anchor: " + href)
            continue
        try:
            destination = resolve_local(href)
        except ValueError as exc:
            errors.append(str(exc))
            continue
        if destination is None:
            continue
        local += 1
        if not destination.is_file():
            errors.append("Missing first-party homepage destination: " + href)
    if errors:
        for error in sorted(set(errors)):
            print("FAIL:", error)
        raise SystemExit(1)
    print(f"PASS: {local} local homepage links resolve and in-page anchors exist")


if __name__ == "__main__":
    main()
