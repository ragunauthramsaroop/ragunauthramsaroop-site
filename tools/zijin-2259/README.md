# ZGI Intelligence | HKEX 2259

An independent stock-market intelligence dashboard for Zijin Gold International (HKEX:2259), with Hong Kong stock and parent-company charts, gold futures, and a private-by-default settlement model.

## Correct price feeds, without unrelated security substitution

TradingView's free embed widgets did not correctly display HKEX 2259 on the original implementation and could revert to the US stock AAPL. All affected widgets were removed.

The replacement native charts retrieve data from a read-only Vercel API route at `/api/market`, using Yahoo Finance's public chart data endpoint. Only three identifiers are authorized:
- `2259.HK`: Zijin Gold International, HKD
- `2899.HK`: Zijin Mining Group, HKD
- `GC=F`: COMEX gold futures, USD/oz. Gold futures are not spot gold.

The backend checks the source's returned symbol, quotes, OHLC bars, source timestamp, exchange/currency and data availability. For daily OHLC, the session price change is computed against the **previous trading day's close**, not Yahoo's chart-range baseline. No alternate ticker is silently substituted. Caching uses a 180-second revalidation period, but **the data is exchange/provider delayed, not a licensed real-time HKEX feed**. Upstream access is unofficial and might be blocked or discontinued. Live trading and quote entitlements require a licensed exchange vendor.

If Yahoo's chart data is unavailable, the 2259 chart shows an explicitly archived November 2026 daily sample. Parent and gold charts display **unavailable**, with trusted external quote links. The dashboard never displays old observations as current. Source links: [Yahoo 2259.HK](https://finance.yahoo.com/quote/2259.HK/), [Google Finance 2259:HKG](https://www.google.com/finance/quote/2259:HKG), [Yahoo parent 2899.HK](https://finance.yahoo.com/quote/2899.HK/), [Yahoo gold futures GC=F](https://finance.yahoo.com/quote/GC=F/).

## Visual features

1. Native SVG candlestick and line views, 1M/3M/6M/1Y ranges, daily volume and exact bar OHLC hover details.
2. Local calculation of RSI(14), MACD(12,26,9), 20-day and 50-day simple moving averages using actual delayed daily prices.
3. Separate HKEX 2899 parent-company and COMEX gold futures history, with independent source checks.
4. 2027–2029 hypothetical bear/base/bull scenario chart and CSV export.
5. Local-only conditional award calculator with user-supplied share count, the publicly disclosed HK$87.48 base purchase price, and optional charges.
6. Official HKEX issuer-disclosure and external market-news links.

## Privacy and boundaries

The generic award model does not contain personal grant quantities. The share-count box starts empty. The calculator does not send inputs to the server or write to browser storage. The read-only quote API accepts only the permitted public symbols. Market-data services receive their own quote requests, not grant data.

Historic reference HK$121.20 on 13 November 2026 and InvestingPro HK$174.48 fair-value estimate remain labelled **NOT LIVE**. Scenario paths are independent sensitivity examples, not analyst consensus, investment advice, or guarantees.

## Running locally

The static files `index.html`, `styles.css`, `app.js` and `markets.js` work in a web server. Without a Vercel API, a Github Pages version requests the separately deployed Vercel quote bridge. The backend is `api/market.js` and must be hosted in a serverless-compatible Node.js runtime.

Tests:

    node --check tools/zijin-2259/app.js
    node --check tools/zijin-2259/markets.js
    node --check tools/zijin-2259/api/market.js
    node --test tests/zijin-dashboard.test.mjs

Production endpoint: https://zijin-2259-intelligence.vercel.app/

Deployment is independent of the executive website; the changes are in a reviewable GitHub PR. This is not an official product of Zijin Gold International, Zijin Mining, HKEX or Yahoo Finance.
