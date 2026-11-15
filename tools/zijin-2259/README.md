# ZGI Intelligence | HKEX 2259

An independent, browser-first market intelligence interface for Zijin Gold International, stock code HKEX:2259.

## Live market data and provenance

The dashboard embeds official TradingView widgets for:
- HKEX:2259 symbol information and advanced interactive charts (candlesticks, volume, RSI, MACD).
- HKEX:2259 technical ratings across time frames.
- HKEX:2899 parent-company mini chart.
- OANDA:XAUUSD gold spot reference.
- HKEX:2259 market news timeline.

These external widgets run under TradingView's own quote licensing, market hours, entitlements and time delay. **The website itself does not operate an exchange-licensed real-time feed, fetch raw quotes, claim every quote is real-time, or create price alerts.** If any widget is blocked by network or provider access, its content may remain unavailable. Users should follow the provider or HKEX directly.

The top-row HK$121.20 close and HK$174.48 InvestingPro fair-value benchmark are **historical screenshots** dated November 2026, not automatically refreshed. 2027-2029 prices are **hypothetical sensitivity scenarios**, not consensus forecasts.

## Optional award model and confidentiality

The calculator is generic. No individual grant share quantity is embedded in public source code. The input is blank by default. The HK$87.48 scheme purchase price is disclosed in the public shareholder circular dated 15 October 2026; this is the published base price and may be adjusted under the scheme.

No calculator input is saved locally or remotely, and no calculator data is sent to TradingView or any other provider. Third-party widgets make their own requests; review their policies.

The calculator assumes full vesting, whole shares and a single illustrative sale price. It shows:
- Gross sale value and purchase cost.
- Gross spread, which can be negative.
- Illustrative cash spread after user-provided taxes and charges.
- Approximate number of whole shares necessary to fund the scheme purchase price.

It does not determine tax liabilities, actual settlement prices or eligibility. The employee's individual grant letter and trustee vesting notice prevail. If the sale price is below the purchase price, selling all shares would not cover the purchase cost.

## Access

- Static GitHub Pages route: /tools/zijin-2259/
- No API credentials or backend.
- No automatic reports, trading orders, alerts or external trade execution.
- Page is marked noindex to reduce accidental search exposure, but it remains public.
- The interface is independent of Zijin Gold International, Zijin Mining Group, HKEX and TradingView.

## Sources

1. HKEX: Zijin Gold International, Stock Code 2259, 15 Oct 2026 "Proposed Adoption of the 2026 Employee Share Incentive Scheme" circular, including published HK$87.48 purchase price and 2029 vesting eligibility mechanics.
2. Zijin Gold International corporate announcements and 2025 annual report for forward-looking production ambitions.
3. User-supplied Investing.com snapshots from 13-14 November 2026 for the historical HK$121.20 close and HK$174.48 third-party fair-value reference.
4. TradingView embeds for provider-hosted charting, technical readings and timely news.

## Validation

From repository root:

    node --check tools/zijin-2259/app.js
    node --test tests/zijin-dashboard.test.mjs
    python scripts/validate_site.py
    python scripts/accessibility_audit.py
    python scripts/performance_budget.py

No personally identifiable information, API key or paid subscription is required. A paid exchange-licensed real-time HKEX feed would require a separate provider integration, permission review and key configuration.
