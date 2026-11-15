# ZGI Intelligence | HKEX 2259

Independent and mobile-responsive Hong Kong gold equity intelligence at https://zijin-2259-intelligence.vercel.app/.

## Market data

Native SVG charts use a public Yahoo Finance chart endpoint via a Vercel GET-only serverless bridge. Only these instruments are permitted:

- 2259.HK, Zijin Gold International, HKD
- 2899.HK, Zijin Mining Group, HKD
- GC=F, COMEX gold futures, USD/oz, NOT spot gold

The bridge checks upstream symbol identity, currency, OHLC plausibility, market timestamp and availability. Historical bars and snapshots are provider-delayed and remain subject to entitlement and reliability constraints. The application refreshes eligible observations at a three-minute interval while visible. It does not claim licensed real-time HKEX trading data. If an instrument is unavailable, no unrelated security is silently substituted. A stock-only archive fallback explicitly states its November 2026 date. Do not build a trading strategy on these delayed quotes.

TradingView's third-party 2259 and 2899 stock embeds were removed because they did not support the requested market correctly and one defaulted to Apple Inc. All current market charts are source-verified and interactive.

## Charts, metrics and predictions

The front page now contains:
- Dynamically refreshed stock, parent, gold futures and observed 52-week range KPIs, with provider source dates.
- Price/volume candlesticks and line charts, with adjustable history range and daily OHLC inspection.
- Interactive, separately labelled parent and gold futures charts.
- Technical analysis (RSI 14, MACD 12/26/9, simple moving averages) computed from returned daily OHLC history.
- Risk pulse derived from daily returns and volume: 20-session annualized volatility, rolling drawdown, average volume, and price versus the published share-scheme purchase price.
- Interactive normalized historical percent-return comparison of 2259, 2899 and gold futures, with series toggles, time-range options and hover inspection. Market sessions differ.
- An interactive 2027–2029 **conditional sensitivity model** anchored to the most recent verified stock price and gold futures observations. Controls include assumed 2029 gold price, 2029 production, AISC escalation, relative valuation multiple, and dilution. Bear/base/bull curves and an annual scenario matrix recalculate when inputs or validated quotes change, and export to CSV.
- A private-by-default share-award payout calculator. Users enter their own quantity locally. Prices populate from the verified delayed quote or a selected 2029 scenario only after explicit action.
- A source-attributed Google News RSS panel with publication timestamps and a refresh control, plus links to official HKEX issuer publications and independent market-data publishers.

### Scenario maths

Let S be the latest provider-delayed 2259.HK price, G the latest provider-delayed GC=F futures benchmark, P0=59.2 tonnes 2026 assumed production, and C0=US$1,678 per ounce assumed 2026 all-in sustaining cost. User input for 2029 gold, production, annual cost inflation, valuation multiple factor and share dilution is linearly phased from 2026 through 2029. Each bear/base/bull scenario independently scales the gold, production, cost and valuation assumptions.

Illustrative annual share price = S × (assumed annual production / P0) × (assumed annual gold-operating-surplus / (G − C0)) × assumed valuation factor ÷ (1 + assumed dilution). The model omits full mine-by-mine forecasts, debt, capital spending, tax, share-count changes not specified, foreign exchange, terminal value, asset disposals and several risks. **The model does not output analyst consensus, calibrated likelihoods or guaranteed 2029 prices.** It may produce outcomes significantly different from market performance. GC=F is a futures benchmark, not realized corporate gold revenue.

2027 and 2028 remain qualification years for an employee award. Cash settlement depends on individual grant terms and full eligibility; no price forecast is a payout promise.

## Privacy and integrity

No personal award share count is embedded in public code. The field initially displays an empty value. Personal calculator inputs are not saved in browser storage and are not sent to server functions. Read-only quote routes use predefined instruments only. External news provider links and RSS are third-party sources, not HKEX regulatory filings; HKEX disclosures govern the official record.

No brokerage execution, background alert service or licensed real-time market-data API is represented as implemented.

## Local and CI validation

Node syntax:
```bash
node --check tools/zijin-2259/app.js
node --check tools/zijin-2259/markets.js
node --check tools/zijin-2259/intelligence.js
node --check tools/zijin-2259/news.js
node --check tools/zijin-2259/api/market.js
node --check tools/zijin-2259/api/news.js
node --test tests/zijin-dashboard.test.mjs
```

The deployment is isolated from the separate executive website's homepage. Public endpoints are Vercel project-specific. PR #178 tracks the repository version, while the Vercel deployment is delivered separately. Existing homepage performance-check failures do not arise from the standalone stock dashboard.
