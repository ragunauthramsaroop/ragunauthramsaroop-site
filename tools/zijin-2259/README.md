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

## Research-terminal expansion, 15 November 2026

The expanded quant studio includes:
- Statistical distribution fan and price-band histogram for FY2027, FY2028, November 2029 and December 2029.
- Seeded deterministic centered historical block bootstrap using validated 2259 daily log returns, configurable annual log drift, volatility multiplier, sampling block length and 1,000–4,000 paths. Displayed frequencies are conditional simulations, not calibrated investment probabilities.
- Historical 20-session interval calibration, 60-session annualized stock volatility and correlations to the parent company and previous-calendar-day COMEX gold futures. Short history and return alignment are disclosed.
- A source-anchored stress-test heatmap for 2029 gold-price and production assumptions, using official unaudited 9M 2026 AISC US$1,649/oz and 2026 production guidance 59.2 tonnes.
- Dated official 2025 audited / 9M 2026 unaudited financial evidence with links.
- Private local-only three-year average ROE and employment eligibility screening, which does not determine award vesting.
- Delayed market refresh status, source timestamps and user-triggered data checks.

11 November 2029 is a Sunday. The statistical November 2029 checkpoint uses Monday 12 November 2029, the first possible weekday after Sunday. An HKEX holiday or trustee timetable might change the executable date.

No claim of 100% real-time access, audit of all 2029 events, licensed market-data entitlement, predictive accuracy, or guaranteed award payment is made.

Additional validation: node --test tests/zijin-quant.test.mjs.

## HKEX authorised free snapshot and licensed on-site integration

The dashboard offers two distinct exchange-data access paths:

1. **Free authorised HKEX Basic Market Prices:** the "OPEN AUTHORISED LIVE QUOTE SERVICE" button opens the licensed vendor etnet's own BMP search landing page. The visitor enters 2259 or 2899 there and requests a snapshot. HKEX's BMP guidance prohibits automatic refresh and unauthorised third-party copying or direct linking to a specific BMP result. This website does not scrape or iframe that vendor.
2. **Licensed on-site vendor feed:** `/api/licensed-quote?symbol=2259.HK` or `2899.HK` is a server-side rights-gated adapter. Disabled unless a market-data provider has confirmed public redistribution, an HTTPS API/JSON relay and a secret key have been set in Vercel. The API never sends credentials to browsers. Incorrect symbols, currencies and stale timestamps are rejected or flagged. Automatic refreshing requires a *separate* affirmative contract flag.

### Required Vercel environment settings after signing with a licensed vendor

- `ZGI_HKEX_VENDOR_QUOTE_URL`: authorised provider-owned HTTPS quote relay endpoint (exact path, not HTML quote page).
- `ZGI_HKEX_VENDOR_API_KEY`: secret provider bearer credential. Set as Vercel encrypted environment variable, never in GitHub.
- `ZGI_HKEX_VENDOR_NAME`: public display attribution naming the licensed vendor.
- `ZGI_HKEX_PUBLIC_DISPLAY_AUTHORIZED=true`: set only if the vendor contract expressly permits display on this independent website.
- `ZGI_HKEX_AUTOMATIC_REFRESH_AUTHORIZED=true`: optional, set only if the contract expressly permits automated repeated retrieval and streaming-style website display. BMP manual-snapshot permission alone is not sufficient.

Vendor relay response schema: `{"symbol":"2259.HK","currency":"HKD","exchange":"XHKG","price":121.2,"previousClose":126.5,"quoteTimestamp":"2026-11-13T08:08:15.000Z"}`. These are schema illustration values, not live data. The server computes age and response status. A site cannot legitimately bootstrap exchange rights from a GitHub library or an undocumented public endpoint.

Provider onboarding reference: HKEX Information Vendors List, BMP guiding notes and marketdata@hkex.com.hk. An issuer-owned public investor-relations website might qualify for a listed-company BMP third-party service, while an independent individual research dashboard requires its own permitted use and vendor terms.

The on-site adapter does not silently overwrite the delayed daily OHLC history. Valuation and backtesting continue to identify their delayed-source timestamps unless market-data and derived-data entitlements explicitly permit using licensed quotes for calculations.


## Flagship evidence and payoff upgrade

The portfolio explorer lists all nine operating groups disclosed in the 2025 annual report. Total mined gold reconciles to 46.9 tonnes. Company comparable FY2024 mined gold was 39.0 tonnes. Users can filter or sort producing mines, inspect 2024 comparators when available, and see top-three production concentration. 2025 new acquisitions have missing, NOT zero, 2024 comparable production. All asset data are explicitly marked audited and historical.

The 2029 award distribution widget consumes the model's exact November 2029 share-price bootstrap samples. Only after a user enters a personal share count and purchase price does it compute the simulated median gross spread, 5th–95th percentile spread and gross loss frequency. The display assumes full vesting and excludes personal taxes, fees and employer/trustee outcomes. Nothing in the award calculator is transmitted to a server or persisted.

A standalone GitHub Actions Chromium end-to-end workflow tests the actual rendered frontend with controlled market-data fixtures, covering security-specific charts, technical/model reactions, ROE screening, the share-award arithmetic, responsive navigation and licensing fail-closed behavior. Mocked market-data fixtures validate the interface, not the accuracy or legal entitlement of a third-party quote feed. This avoids reliance on external paid browser credits.

Reports and source links:
- FY2025 annual report: https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0429/2026042902638.pdf
- Nine-month 2026 unaudited operational performance: https://www.hkexnews.hk/listedco/listconews/sehk/2026/1019/2026101900165.pdf
- Market data entitlement: https://www.hkex.com.hk/Services/Market-Data-Services/Real-Time-Data-Services/Data-Licensing/HKEX-IS/Market-Data-Vendor-Licence/Basic-Market-Prices-%28BMP%29-Service/Notes-to-Listed-Companies-for-enabling-BMP-Service-on-their-Corporate-Website?sc_lang=en

### What is still outside the application

A licensed redistributable HKEX real-time stock quote feed remains unavailable without a contract and vendor credentials. Free BMP snapshots work only on an authorised provider's website, not as an unrestricted streaming data API. No institutional DCF accuracy claim, calibrated 2029 probability, complete mine-by-mine cost history or audited future outcome is represented as finished.


## No-license user-controlled price bridge

The dashboard includes a personal price-reference workspace beneath the authorised free BMP vendor link. A visitor obtains a snapshot on the etnet licensed information-vendor website and voluntarily types the observed 2259.HK price, with an optional 2899.HK comparison. The app computes a local percentage deviation versus the timestamped provider-delayed historical quote. With an additional explicit click, the 2259 reference populates the private conditional award scenario input.

This implementation deliberately does **not** scrape, poll, link directly to a BMP result, imitate exchange timestamps, store or transmit the typed price, overwrite quote-history data, modify the official quote banner, or relabel a bootstrap simulation as a market-verified forecast. The entry time is browser time, not a validated exchange timestamp. Manual entry is a research aid, not a substitute for an HKEX-licensed automated datafeed.

Official legal explanation: HKEX's April 2023 guiding notes for BMP require user-requested snapshots and prohibit automatic refreshing and direct result-page links:
https://www.hkex.com.hk/-/media/HKEX-Market/Services/Market-Data-Services/Real-Time-Data-Services/Data-Licensing/Licence-Agreements-Guiding-Notes-Vendor-Licence/Guiding-Notes/Guiding-Notes-on-Basic-Market-Prices-Service_eng-v202304.pdf

The existing dedicated licensed provider API is still the direct upgrade path once redisplay and retrieval rights are documented. Neither GitHub, an unauthenticated open-source wrapper nor Yahoo historical bars grants a lawful streaming licence.

## November 2026 market-data integrity correction

The unofficial Yahoo chart endpoint was observed to repeat the 13 November 2026 daily OHLCV of 2259.HK as a synthetic 16 November pre-opening daily bar. The unchanged quote (HK$121.20) appeared with a newer timestamp and false previous close (HK$121.20, 0.00% return) instead of the 13 November settlement relative to 12 November (HK$126.50, -4.19%). The API now removes an exact duplicate full OHLCV daily carry-forward observation and computes the last daily close and prior-session change from retained validated bars. Upstream metadata refresh timestamps are retained separately as provider metadata, and never used as a daily exchange trade timestamp. The published quote timestamp is the retained session-bar timestamp, not a real-time exchange trade or licensed feed. Regression tests reproduce the defect and verify the corrected price and date.

## Animated evidence replay and delayed 15-minute charts, 16 November 2026

The main candlestick chart includes a visible, automatically moving historical replay playhead. It traverses only validated source OHLC bars, with each actual historical bar's HKT timestamp, closing price and no synthetic prices. Pause, 1×/2×/4× speed and FOLLOW DELAYED SOURCE controls are available. Replay is labelled **HISTORICAL REPLAY, NOT LIVE TRADES**. When FOLLOW DELAYED SOURCE is selected, the marker stays on the latest validated historical bar and only advances after another genuine provider bar appears. Visitors with reduced-motion preferences start in FOLLOW mode.

A 15-MIN BARS toggle requests historical 15-minute 2259.HK OHLC bars from the same symbol-verified provider route for at most one month, with 5D and 1M visual ranges. The chart requests a new provider observation every 60 seconds while the browser tab is visible. Provider server cache is 60 seconds; source bars themselves normally advance at most every 15 minutes and might be further delayed or unavailable. On a failed first request, the interface returns to the daily chart and explicitly shows the reason. The ordinary daily candlestick and other company/award models remain based on daily historical observations, with their existing three-minute refresh.

No animated point represents an exchange trade, exchange-real-time quote or synthetic price movement. An auto-moving playhead is an educational replay of past bars. True continuous on-site exchange-price changes still require contracted licensed vendor data, permissions, and authorised integration. The 15-minute feed is third-party historical data and not a licensed real-time HKEX stream.

Tests validate historical animation, pause/resume, source timestamps, 15-minute mode and privacy. The production build includes the separate `chart-motion.js` and `chart-motion.css` assets.

## Daily bar timestamp integrity (23 November 2026)

Yahoo Finance daily OHLC timestamps are provider historical-bar labels, not the time of the last exchange trade. The dashboard now displays the date-only label for daily 2259.HK and 2899.HK bars in Hong Kong time, and the UTC bar date for COMEX GC=F. Intraday bars remain explicitly provider-delayed time-bucket observations. API clients receive `barTimestampMeaning` and `barTimeIsLastTrade:false`. The fetchedAt clock indicates retrieval time, not price execution time. Displayed daily OHLC might still be provisional during a trading session. No new market-data rights, feeds, or provider accuracy guarantees are implied.

## Source-confidence command deck, 23 November 2026

The home screen now features a responsive, first-party Market Readiness Desk for 2259.HK, 2899.HK and COMEX gold futures. Each card is bound to the exact source instrument, provider-delayed historical close, bar date, source status and explicit model gate. The "Export source brief" action produces a local, source-only text document containing the observed delayed prices, provider timestamps and reasons for any withheld instruments. The export never includes employee award share counts, manual quote inputs, employment information or model controls.

A shared source-gate.js checks provider identity, currency, source symbol, sequential plausible OHLC bars, final close reconciliation, source timestamps, future timestamps, archive status and a conservative seven-calendar-day maximum source age. Source validity governs the 2027–2029 model, empirical bootstrap and decision/stress analysis. Source-held outputs are reset and scenario buttons/export are disabled, preventing stale previously drawn projections from appearing usable. Seven calendar days is an application safety threshold, **not an automated HKEX holiday calendar**. Research remains delayed and conditional, never official real-time prices.

### Open-source research and engineering decisions

We reviewed these maintained repositories for ideas and safety constraints, but **did not copy upstream source or add third-party runtime dependencies**:

- [TradingView lightweight-charts](https://github.com/tradingview/lightweight-charts) (Apache-2.0): financial chart interaction pattern. The existing first-party SVG charts remain because they avoid a separate runtime library, data licensing confusion and bundle weight.
- [Apache ECharts](https://github.com/apache/echarts) (Apache-2.0): accessible chart presentation patterns, no library import.
- [Microsoft Playwright](https://github.com/microsoft/playwright) (Apache-2.0): existing GitHub browser interaction tests remain the browser acceptance layer.
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) (Apache-2.0): existing mobile and desktop performance budgets remain release gates.
- [agency-agents](https://github.com/msitarzewski/agency-agents) (MIT): existing role profiles remain structured review checklists, not running autonomous workers.

GitHub Actions provides the real, deterministic test workers. No external credentials, new spending, trackers, cookies or brokerage execution were added. CI runs source-gate tests, browser checks and accessibility/performance validation. A Vercel READY build alone does not prove public-route correctness, so every production release requires the independent eight-route health check.
