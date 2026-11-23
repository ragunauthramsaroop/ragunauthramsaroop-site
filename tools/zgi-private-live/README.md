# ZGI Private HKEX Quote Viewer

A local, read-only terminal for 02259 (Zijin Gold International) and 02899 (Zijin Mining Group), using the official Webull Hong Kong OpenAPI. Designed for a single approved account holder. The app does not place orders or redistribute prices.

This is **separate from the public** https://zijin-2259-intelligence.vercel.app/ site. There is no change to public market-data licensing, and **no broker connection is active** until an approved account holder configures their own credentials.

## Access requirements

1. Obtain an eligible Webull Hong Kong securities account and approved OpenAPI access. Account availability for a resident of Guyana has not been verified. The account/application process is subject to Webull approval.
2. Confirm an active OpenAPI Hong Kong Level 1 market-data subscription. Webull currently advertises HK Level 1 data as free, but API market access requires its own subscription/entitlement. App/desktop market-data subscriptions are independent of OpenAPI.
3. Install Python 3.11+ and the pinned, official Webull Python SDK. Only run on a device you control. Do not store keys in GitHub, share secrets in ChatGPT, or expose the local service through a tunnel or public reverse proxy.
4. Review your provider agreement to confirm non-professional/personal data access, device limits, and whether local computational use is included.

Official docs: https://developer.webull.hk/apis/docs/market-data-api/overview/ and https://developer.webull.hk/apis/docs/authentication/TradingAPIApplication/ . Source SDK: https://github.com/webull-inc/webull-openapi-python-sdk (Apache-2.0).

## Start on your own Windows PC

Open a terminal in this directory:

```powershell
py -3 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python app.py
```

Enter your Webull OpenAPI App Key and App Secret at the local, masked prompts, or provide them as `WEBULL_APP_KEY` and `WEBULL_APP_SECRET` via your operating system's secured environment. Never paste the values in a public chat or commit them into source control.

Open **http://127.0.0.1:8765** on the same device.

The private terminal polls the authorised HTTP snapshot API no more than once every five seconds. A successful snapshot is an observation of the latest reported trade, **not a guarantee that a new trade occurred**. Every value is labelled with the broker's trade time; older trade times are explicitly labelled *LAST RECORDED TRADE*. During exchange closures, the last actual trade might be hours or days old.

If your provider grants continuous Level 1 MQTT streaming, the published Webull SDK supports that separately. This project deliberately starts with the read-only snapshot API to reduce token and connection exposure and avoid supplying a public streaming relay. No guaranteed quote latency is claimed.

## Security

- Loopback bind: `127.0.0.1` only; no Vercel build integration, public API, external database or CORS.
- Strict instrument allowlist: 02259 and 02899 only.
- Raw provider authentication and response objects never reach the browser.
- Validate price, timestamp and instrument identity. Missing, future or excessively stale observations fail closed.
- All other requests are rejected. No POST, order placement, position lookup or trading scope.
- Secrets are neither logged nor placed in browser localStorage/sessionStorage.
- Tests use synthetic prices only and make no broker requests.

Run offline contract tests with `python -m unittest discover -s tests -p 'test_zgi_private_live.py' -v` at the repository root.

## Public website integration

Webull personal OpenAPI access **does not grant permission to redistribute prices** on your publicly accessible ZGI site. A public real-time feed requires a vendor contract allowing market-data redisplay, API use, website display and automatic refresh. The existing licensed-feed adapter at `tools/zijin-2259/api/licensed-quote.js` remains disabled until that authorization is documented. Track the blocker in [GitHub issue #208](https://github.com/ragunauthramsaroop/ragunauthramsaroop-site/issues/208).
