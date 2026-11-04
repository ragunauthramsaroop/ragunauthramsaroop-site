# Flagship Executive Website: Agency Agents Operating Model

Site: https://ragunauthramsaroop.com/
Source: https://github.com/ragunauthramsaroop/ragunauthramsaroop-site
Role inspiration: https://github.com/msitarzewski/agency-agents (MIT-licensed). Adapted role instructions only, no upstream scripts executed.

## Mission
Make the existing public platform a decision-ready executive destination for (1) international executive search, (2) boards and advisory mandates, (3) strategic institutions and partnerships, (4) speaking and media, and (5) responsible mining and sustainability research. Prioritize factual credibility, visitor usefulness, speed and easy private engagement.

## Working team and order
1. Flagship Orchestrator: sets a small scope, acceptance criteria and handoffs.
2. Executive Brand Guardian: checks international director-level fit, brand consistency and personal-versus-organisational attribution.
3. Executive Search Journey Architect: audits CV, Recruiter Mode, Board/CEO Mode and contact pathways for clarity.
4. Executive Art Director: directs the first-party visual hierarchy for boards, recruiters and institutions. See `.github/agents/executive-art-director.agent.md`.
5. Executive Evidence and Search Editor: validates claims, SEO, source links, canonical tags and dated event references.
6. Existing Site Performance Engineer: validates static technical behavior.
7. Flagship UI Finish-Gate Reviewer: requires actual desktop/mobile visual evidence and an explicit PASS/HOLD.
8. Flagship Release Steward: confirms CI, review and production deployment independently.

GitHub Copilot-compatible role instructions live in `.github/agents/`. A person or connected coding agent must invoke them. The YAML/Markdown files do not themselves schedule, spawn or pay for autonomous model calls.

## Execution cadence
- Per pull request: the existing `.github/workflows/site-performance.yml` runs technical guards, now including the flagship homepage route guard. `.github/workflows/whole-site-integrity.yml` checks static public HTML.
- Daily: existing whole-site integrity workflow runs. Weekly: existing site performance workflow runs.
- Per content change: verify source attribution, event dates and CV consistency. Review external-facing personal information before publishing.
- Per design change: review desktop, narrow mobile, keyboard focus and visual screenshots before release.

## Acceptance checklist
- Homepage offers one-click routes to CV, recruiter brief and professional engagement.
- Evidence, board/CEO and recruiter routes resolve from the homepage.
- Distinguish programme listing from confirmed speaking attendance.
- Preserve working 3,000+ file static site and existing responsive patterns.
- No made-up awards, rankings, indexing, analytics, testimonials, reader counts or revenue.
- No paid dependencies, public API keys, unsafe third-party scripts or changes to other repositories.
- Maintain self-hosted critical assets, accessible markup and consent-first analytics.
- Required CI green and visual check documented before any live deployment.

## Prioritized next improvements
P0: Recheck dated public events, broken conversion paths, contact friction and homepage claim evidence.
P1: Review mobile search-firm experience, multi-page branding consistency and performance budgets.
P2: Benchmark Google Search Console impressions and actual conversion events before changing SEO strategy. Avoid guessed traffic gains.
P3: Improve research-platform findability based on measured audience use, not arbitrary new tools.

## Limits
The domain is served by GitHub Pages. Editing GitHub does not prove an immediate live deployment. A role file is not an autonomous running agent. The actual recurring code validations come from GitHub Actions.

## Continuous monitor extension

See docs/flagship-continuous-agents.md for the curated open-source repository review, limits, schedules and incident runbook. The Flagship SEO Sentinel and Flagship Intelligence Sentinel role files guide optional connected coding agents. The only continuously recurring execution is scheduled GitHub Actions; no LLM runs permanently or gains unattended publication authority.
