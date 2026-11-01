# Flagship website continuous agents and open-source toolkit

Updated 2026-11-01. Website: https://ragunauthramsaroop.com/

## What operates throughout the day

GitHub Actions is the actual scheduled execution layer. It runs short jobs, not persistent AI processes. Scheduled starts are best-effort and sometimes delayed by GitHub.

| Workstream | Frequency (UTC) | Implementation | Evidence |
| --- | --- | --- | --- |
| Public DNS, HTTPS, critical assets | Every five minutes | Existing Public HTTPS and asset health workflow | Incident issue and run logs |
| Technical SEO | Every two hours, minute 21 | Flagship SEO sentinel | JSON/Markdown artifacts, deduplicated incident issue |
| Official-source and API provenance | Every six hours, minute 47 | Flagship intelligence sentinel | JSON/Markdown artifacts, deduplicated incident issue |
| Source content refresh | Daily | Existing Guyana Intelligence Refresh worker | Source snapshots with dates and URLs |
| Full public route audit | Daily | Existing Whole-site executive integrity workflow | Audit artifacts and route status |
| Performance and responsiveness | Weekly and on changes | Existing Lighthouse, performance and forensic design workflows | GitHub Actions reports |
| Executive improvements | Weekly separately | Existing ChatGPT Flagship Ops task | Reviewable PRs, verified changes |

The SEO watch validates seven key live routes, page titles, meta descriptions, H1 count, canonical URLs, indexing directives, homepage structured JSON, robots.txt, sitemap.xml and current AI-readable career dates. The intelligence watch validates official-source registry coverage, snapshot freshness, source errors, change flags, indicator source/period provenance and JSON API alignment. A changed source is a review signal, not a verified claim.

Monitoring checks never edit public HTML, trigger social posts, access private mail, run untrusted scripts, spend money or alter production. GitHub write permission is restricted to creating and closing incident issues. Repeated failures do not create duplicate incident issues.

## Open-source repositories evaluated

These links identify candidates verified as existing public, non-archived GitHub repositories on 2026-11-01. They are not a complete directory of all open-source repositories. The decision is whether they improve the current static site without adding unnecessary hosting or risk.

| Open-source repository | License | Current decision |
| --- | --- | --- |
| https://github.com/msitarzewski/agency-agents | MIT | Already adapted for role-based reviews; role files are prompts, not running workers |
| https://github.com/Pagefind/pagefind | MIT | Already integrated for site search |
| https://github.com/GoogleChrome/lighthouse-ci | Apache-2.0 | Lighthouse already integrated in GitHub Actions |
| https://github.com/lycheeverse/lychee | Apache-2.0 / MIT | Strong candidate for scheduled bounded external-link auditing |
| https://github.com/pa11y/pa11y-ci | LGPL-3.0 | Optional deeper accessibility testing after evaluating output against existing Playwright audit |
| https://github.com/sitespeedio/sitespeed.io | MIT | Optional browser-based performance profiling; heavier than existing Lighthouse |
| https://github.com/dgtlmoon/changedetection.io | Apache-2.0 | Requires a persistent host; scheduled source monitor already covers official sources without one |
| https://github.com/louislam/uptime-kuma | MIT | Requires persistent host; five-minute GitHub HTTPS monitoring already covers basic uptime |
| https://github.com/gitleaks/gitleaks | MIT | Good candidate for repository secret-scanning |
| https://github.com/aquasecurity/trivy | Apache-2.0 | Good candidate for dependencies, secrets and misconfiguration reviews |
| https://github.com/tmolavi/siteprobe | MIT | Experimental SEO/GEO agent fixer; audit first, never enable unattended source mutation |
| https://github.com/lycheeverse/lychee-action | Apache-2.0 | GitHub wrapper candidate, ideally pinned to reviewed SHA |

No unreviewed repositories have been cloned or granted credentials. Use a single dedicated workflow per needed capability and pin trusted third-party actions to immutable commit SHAs where feasible.

## Search intelligence limits

Technical crawlability and structured data do not prove search positions, traffic, citations in AI answers or increased conversions. Such results require first-party Search Console/analytics data or documented independent measurement. The connected GSC Wizard account currently has no active paid plan or trial; this architecture does not require it. Search Console should be connected directly through an appropriately authorized free Google API only if the user later approves credential handling, otherwise stay with evidence-based technical checks.

## Runbook

1. Inspect GitHub Actions runs for Flagship continuous SEO and intelligence watch.
2. Open the JSON artifact for the failed run and confirm an HTTP or freshness signal from a second source where practical.
3. Check the deduplicated automatic incident issue, compare with existing daily and weekly checks.
4. Apply fixes on a separate branch and reviewable PR. The specialist agent files inform the investigation; they do not perform autonomous API calls.
5. Confirm CI green and public page state. On the next successful watch the issue closes with a recovery link.
6. Do not misrepresent delayed GitHub schedules as uninterrupted 24-hour compute. Do not claim rankings, traffic or real-time indexing without first-party evidence.

## Operating constraints

Read-only monitoring, no new paid dependencies, least privileges, rate-limited HTTP fetches with retries, no silent rewrites, no private data, no automatic publishing of unsourced facts, no autonomous sending of email or outreach. Preserve the current site architecture, PR review and source-provenance boundaries.
