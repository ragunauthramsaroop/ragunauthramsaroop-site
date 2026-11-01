# Ragunauth Ramsaroop Public Resource Platform

This repository publishes the public website at https://ragunauthramsaroop.com/ through GitHub Pages.

## Free public resources

- [Free Tools](https://ragunauthramsaroop.com/tools/)
- [Resource Centre](https://ragunauthramsaroop.com/resources/)
- [Topic Hubs](https://ragunauthramsaroop.com/topics/)
- [Practical Guides](https://ragunauthramsaroop.com/guides/)
- [Methodology & Sources](https://ragunauthramsaroop.com/methodology/)
- [Evidence Centre](https://ragunauthramsaroop.com/evidence/)
- [White Papers](https://ragunauthramsaroop.com/white-papers/)
- [Complete PDF Library](https://ragunauthramsaroop.com/research-library/)
- [Public Roadmap](https://ragunauthramsaroop.com/roadmap/)

The platform is designed around free browser-side tools, transparent assumptions, evidence-led professional claims and public-value research. No AppDeploy runtime is required for the website or the professional-record evidence search.

## Quality controls

Static QA covers internal links, structured data, sitemaps, analytics-loader presence, accessibility basics, performance budgets, IndexNow verification, the browser-side evidence index and legacy AppDeploy dependency checks.

Use:
```
python scripts/validate_site.py
python scripts/accessibility_audit.py
python scripts/performance_budget.py
```

Public pages are hosted on GitHub Pages with HTTPS enforced.

## Flagship executive website agency team

[Agency Agents operating model](.github/FLAGSHIP_AGENCY_TEAM.md) defines the dedicated brand, executive-search journey, evidence and search, design, performance and release roles. The model adapts the [Agency Agents](https://github.com/msitarzewski/agency-agents) role library to this existing GitHub Pages export. Agent profiles are instructions for a compatible connected coding agent, not continuously running bots. Site integrity and performance checks continue to run through GitHub Actions.

The homepage executive journey includes direct routes to the CV, recruiter-mode brief, evidence examples and board/CEO briefing. `scripts/flagship_home_quality.py` guards the key entry points and dated conference-label semantics.
