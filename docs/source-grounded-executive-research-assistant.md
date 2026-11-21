# Source-grounded executive research assistant: implementation contract

Status: proposed, not deployed. Owner authorization: issue #159.

## Purpose
Give board members, executive recruiters and research readers a fast way to find *published* evidence without inventing an answer. Keep the existing editorial homepage, /research-library/ and public-record routes intact.

## Phase 1: static evidence retrieval
- Inspect existing site-side evidence search and reuse its approved public index. Do not add an LLM, paid API, persistent backend or external script.
- Search indexed titles, abstracts, dates and source excerpts with deterministic keyword matching. Return up to five exact source links, titles, source dates and short verbatim excerpts. Label results **source matches**, never generated answers.
- Restrict corpus to approved public /research-library/, /public-record/, /claim-graph/ and public source registry. Never index private-room session data, employer-confidential files, emails, drafts, unpublished Library assets or user queries.
- Empty matches say: “No verified public source match. Browse the research library.” Never infer a qualification, academic affiliation, award, DOI, indexed ranking or business outcome.
- Do not claim independent verification unless linked primary-source records support the precise assertion.

## Phase 2: optional cited answers
Only after explicit approval for an inference service and its data-handling terms. Use typed structured outputs with claim, exact citation URL, quote span, source date and refusal reason. Validate every citation against the allowlist. Reject instructions embedded in retrieved documents. No persistent chat history or third-party analytics.

## Release gates
1. Inventory existing search UI and index before implementation to avoid duplicate functionality.
2. Add tests: exact citation target, no-match refusal, HTML/script injection, malicious source instructions, unsupported credential question, confidential employer prompt, keyboard navigation, small-screen layout, CSP, offline/no-JS fallback.
3. Run `python scripts/site_performance_guard.py`, `python scripts/validate_site.py`, `python scripts/performance_budget.py`, `python scripts/accessibility_audit.py`, `python scripts/tools_integrity.py`, `python scripts/verify_homepage_brand_focus.py`, `python scripts/flagship_home_quality.py`, `python scripts/verify_flagship_editorial_home.py` and browser smoke tests in CI.
4. Review desktop/mobile screenshots and Lighthouse before any homepage change. No new homepage proof cards or third-party scripts.
5. Require green CI and human review before merge. Record outcome in issue #130.

## Upstream references
https://github.com/shubhamsaboo/awesome-llm-apps
Review Typed Agentic RAG, Corrective RAG, First Reader and Scope Creep Detector as patterns only. Check each component license and transitive dependency before importing any code.

## Decision
Start with static, cited source discovery. Do not market this as a live AI assistant until an actual model-backed service has been deployed and tested.
