#!/usr/bin/env python3
"""Local-only HKEX 02259/02899 live quotation viewer using official Webull OpenAPI.

NOT a public site feed. Requires a separately approved Webull HK account and
market-data OpenAPI entitlement. Never forward to Vercel or distribute quotes.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from time import time
from getpass import getpass
import json
import os
import sys

SYMBOLS = {"02259": "Zijin Gold International", "02899": "Zijin Mining Group"}
BIND_HOST = "127.0.0.1"
DEFAULT_PORT = 8765
MIN_REFRESH_SECONDS = 5
_ROOT = Path(__file__).resolve().parent


class MarketDataError(Exception):
    """Safe displayable error with no broker credentials or raw response text."""


def _positive_number(value, name):
    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise MarketDataError(f"Invalid {name}") from None
    if not number.is_finite() or number <= 0:
        raise MarketDataError(f"Invalid {name}")
    return str(number)


def _optional_price(value):
    if value is None or value == "":
        return None
    return _positive_number(value, "previous close")


def _payload_rows(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("data"), list):
        return payload["data"]
    raise MarketDataError("Provider snapshot response has an unexpected structure")


def normalise_snapshots(payload, now_ms=None):
    """Validate returned broker observations; never infer fake or recent trades."""
    now_ms = int(time() * 1000) if now_ms is None else int(now_ms)
    rows = _payload_rows(payload)
    if len(rows) != len(SYMBOLS):
        raise MarketDataError("Incomplete broker snapshot")
    seen = {}
    for row in rows:
        if not isinstance(row, dict):
            raise MarketDataError("Invalid broker snapshot")
        symbol = row.get("symbol")
        if symbol not in SYMBOLS or symbol in seen:
            raise MarketDataError("Unexpected or duplicate instrument")
        trade_ms = row.get("last_trade_time")
        if isinstance(trade_ms, bool) or not isinstance(trade_ms, (int, float, str)):
            raise MarketDataError("Missing last-trade timestamp")
        try:
            trade_ms = int(trade_ms)
        except (ValueError, TypeError):
            raise MarketDataError("Invalid last-trade timestamp") from None
        if trade_ms < 1_577_836_800_000 or trade_ms > now_ms + 60_000:
            raise MarketDataError("Last-trade timestamp outside accepted range")
        age_seconds = max(0, (now_ms - trade_ms) / 1000)
        if age_seconds > 30 * 86400:
            raise MarketDataError("Broker returned an excessively old trade")
        price = _positive_number(row.get("price"), "trade price")
        previous = _optional_price(row.get("pre_close"))
        seen[symbol] = {
            "symbol": symbol,
            "name": SYMBOLS[symbol],
            "currency": "HKD",
            "lastTradePrice": price,
            "previousClose": previous,
            "lastTradeAt": datetime.fromtimestamp(trade_ms / 1000, timezone.utc).isoformat(),
            "ageSeconds": round(age_seconds),
            "observationState": "RECENT TRADE" if age_seconds <= 90 else "LAST RECORDED TRADE",
        }
    if set(seen) != set(SYMBOLS):
        raise MarketDataError("Broker did not return both instruments")
    return {
        "ok": True,
        "provider": "Webull Hong Kong OpenAPI",
        "scope": "SINGLE USER / LOCALHOST ONLY",
        "providerAccess": "Requires valid account and separate OpenAPI market-data entitlement",
        "fetchedAt": datetime.fromtimestamp(now_ms / 1000, timezone.utc).isoformat(),
        "quotes": [seen[symbol] for symbol in SYMBOLS],
    }


class WebullProvider:
    """Read-only quote adapter. Do not import trading interfaces or log secrets."""

    def __init__(self, app_key, app_secret):
        if not app_key or not app_secret:
            raise MarketDataError("WEBULL_APP_KEY and WEBULL_APP_SECRET must be configured")
        # Import only after verifying configuration. No SDK needed for isolated tests.
        from webull.core.client import ApiClient
        from webull.data.data_client import DataClient

        self.client = DataClient(ApiClient(app_key, app_secret, "hk"))

    def read_quotes(self):
        response = self.client.market_data.get_snapshot(
            list(SYMBOLS), "HK_STOCK"
        )
        if getattr(response, "status_code", None) != 200:
            raise MarketDataError("Webull market data not available; check OpenAPI entitlement")
        try:
            payload = response.json()
        except (ValueError, TypeError):
            raise MarketDataError("Provider response could not be decoded") from None
        return normalise_snapshots(payload)


class QuoteStore:
    def __init__(self, provider, min_refresh=MIN_REFRESH_SECONDS):
        self.provider = provider
        self.min_refresh = min_refresh
        self.lock = Lock()
        self.last_updated = 0.0
        self.cached = None

    def read(self):
        with self.lock:
            now = time()
            if self.cached is not None and now - self.last_updated < self.min_refresh:
                return self.cached
            try:
                result = self.provider.read_quotes()
            except Exception:
                # Fail closed: never silently reissue stale values after a broker error.
                self.cached = None
                raise MarketDataError("Broker feed unavailable or not authorised") from None
            self.cached = result
            self.last_updated = time()
            return result


def make_handler(store, port):
    class Handler(BaseHTTPRequestHandler):
        server_version = "ZGI Private Quote Viewer"

        def log_message(self, format_string, *args):
            # Avoid HTTP request metadata and accidental credentials in logs.
            pass

        def _send(self, status, body, content_type):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "private, no-store, max-age=0")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Cross-Origin-Resource-Policy", "same-origin")
            self.send_header("Content-Security-Policy",
                             "default-src 'none'; script-src 'self'; style-src 'self'; "
                             "connect-src 'self'; base-uri 'none'; frame-ancestors 'none'")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            host_header = self.headers.get("Host", "")
            if host_header not in (f"127.0.0.1:{port}", f"localhost:{port}"):
                self._send(403, b"Forbidden", "text/plain; charset=utf-8")
                return
            if self.path == "/api/snapshot":
                try:
                    result = store.read()
                    self._send(200, json.dumps(result).encode(), "application/json; charset=utf-8")
                except MarketDataError:
                    body = {"ok": False, "error": "MARKET_FEED_UNAVAILABLE",
                            "message": "Webull entitlement or connection unavailable. No price substituted."}
                    self._send(503, json.dumps(body).encode(), "application/json; charset=utf-8")
                return
            assets = {
                "/": ("index.html", "text/html; charset=utf-8"),
                "/viewer.js": ("viewer.js", "text/javascript; charset=utf-8"),
                "/viewer.css": ("viewer.css", "text/css; charset=utf-8"),
            }
            if self.path not in assets:
                self._send(404, b"Not found", "text/plain; charset=utf-8")
                return
            filename, mime = assets[self.path]
            self._send(200, (_ROOT / filename).read_bytes(), mime)

        def do_POST(self):
            self._send(405, b"Read only", "text/plain; charset=utf-8")

    return Handler


def main():
    raw_port = os.getenv("ZGI_PRIVATE_PORT", str(DEFAULT_PORT))
    try:
        port = int(raw_port)
        if port < 1024 or port > 65535:
            raise ValueError
    except ValueError:
        raise SystemExit("ZGI_PRIVATE_PORT must be between 1024 and 65535")
    key = os.getenv("WEBULL_APP_KEY")
    secret = os.getenv("WEBULL_APP_SECRET")
    if not key or not secret:
        if not sys.stdin.isatty():
            raise SystemExit("Set Webull OpenAPI credentials in your secure local environment")
        if not key:
            key = getpass("Webull App Key (hidden): ")
        if not secret:
            secret = getpass("Webull App Secret (hidden): ")
    provider = WebullProvider(key, secret)
    store = QuoteStore(provider)
    with ThreadingHTTPServer((BIND_HOST, port), make_handler(store, port)) as server:
        print(f"Private read-only quote viewer: http://127.0.0.1:{port}")
        print("Localhost only. Do not expose via tunnel, public hostname or reverse proxy.")
        print("Quotes require your own approved Webull HK OpenAPI market-data entitlement.")
        try:
            server.serve_forever(poll_interval=0.2)
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
