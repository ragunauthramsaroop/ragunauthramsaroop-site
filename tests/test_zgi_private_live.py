"""Contract tests. Every value below is simulated, not an exchange quote."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1] / "tools" / "zgi-private-live"
spec = importlib.util.spec_from_file_location("zgi_private_live", ROOT / "app.py")
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)

NOW = 1795435200000


def sample(symbol, price):
    return {
        "symbol": symbol,
        "price": price,
        "pre_close": "100",
        "last_trade_time": NOW - 15000,
    }


class Provider:
    def __init__(self, result):
        self.result = result
        self.calls = 0

    def read_quotes(self):
        self.calls += 1
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


class TestQuoteContracts(unittest.TestCase):
    def test_two_approved_symbols_are_identified_and_timestamped(self):
        rows = [sample("02259", "120.31"), sample("02899", "28.17")]
        observed = app.normalise_snapshots(rows, NOW)
        self.assertTrue(observed["ok"])
        self.assertEqual([q["symbol"] for q in observed["quotes"]], ["02259", "02899"])
        self.assertEqual(observed["quotes"][0]["currency"], "HKD")
        self.assertEqual(observed["quotes"][0]["lastTradePrice"], "120.31")
        self.assertEqual(observed["quotes"][0]["observationState"], "RECENT TRADE")

    def test_rejects_unsupported_duplicate_and_missing_symbols(self):
        valid = [sample("02259", "120"), sample("02899", "30")]
        for bad in [
            valid[:1],
            [valid[0], valid[0]],
            [sample("02259", "120"), sample("AAPL", "30")],
            None,
            {"data": {"symbol": "02259"}},
        ]:
            with self.subTest(payload=bad):
                with self.assertRaises(app.MarketDataError):
                    app.normalise_snapshots(bad, NOW)

    def test_rejects_missing_invalid_and_future_prices(self):
        for price in [None, "", 0, -1, "NaN", "Infinity", "invalid"]:
            with self.subTest(price=price):
                with self.assertRaises(app.MarketDataError):
                    app.normalise_snapshots([sample("02259", price), sample("02899", 30)], NOW)
        for time_ms in [None, "abc", 0, NOW + 90000, NOW - 31 * 86400 * 1000]:
            with self.subTest(time_ms=time_ms):
                one = sample("02259", 120)
                one["last_trade_time"] = time_ms
                with self.assertRaises(app.MarketDataError):
                    app.normalise_snapshots([one, sample("02899", 30)], NOW)

    def test_stale_trades_are_not_called_recent(self):
        first = sample("02259", "120")
        first["last_trade_time"] = NOW - 4 * 86400 * 1000
        d = app.normalise_snapshots([first, sample("02899", "30")], NOW)
        self.assertEqual(d["quotes"][0]["observationState"], "LAST RECORDED TRADE")
        self.assertGreater(d["quotes"][0]["ageSeconds"], 300000)

    def test_store_broker_failure_removes_cached_price(self):
        result = app.normalise_snapshots([sample("02259", 120), sample("02899", 30)], NOW)
        p = Provider(result)
        store = app.QuoteStore(p, min_refresh=600)
        self.assertEqual(store.read()["quotes"][0]["lastTradePrice"], "120")
        self.assertEqual(store.read()["quotes"][0]["lastTradePrice"], "120")
        self.assertEqual(p.calls, 1)
        p.result = RuntimeError("secret API key must not be leaked")
        store.last_updated = 0
        with self.assertRaisesRegex(app.MarketDataError, "Broker feed unavailable"):
            store.read()
        self.assertIsNone(store.cached)

    def test_private_transport_constraints(self):
        self.assertEqual(app.BIND_HOST, "127.0.0.1")
        self.assertGreaterEqual(app.MIN_REFRESH_SECONDS, 5)
        for path in ["index.html", "viewer.js", "viewer.css", "requirements.txt"]:
            self.assertTrue((ROOT / path).exists())
        src = (ROOT / "viewer.js").read_text()
        self.assertNotIn("localStorage", src)
        self.assertNotIn("ZGI_HKEX_VENDOR_API_KEY", src)
        self.assertNotIn("WEBULL_APP_SECRET", src)
        self.assertNotIn("sessionStorage", src)


if __name__ == "__main__":
    unittest.main()
