# Flagship Edition 03 | Executive visitor experience

2026-11-04. Status: implementation and CI validation, not an assertion of deployment or outside review.

## Audience hierarchy
1. Executive search firms need mandate fit, verified career dates, a direct CV, interview questions, and private contact.
2. CEOs and boards need an accountable enterprise problem statement, decision criteria, governance boundaries, and evidence.
3. Institutions and public readers need sourced leadership context and accessible research rather than employer-wide achievements presented as personal results.

## First-party design system
File: `assets/flagship-system-2026.css`.

The visual vocabulary is deep navy, warm neutral paper, restrained gold rules, serif editorial headlines, precise sans-serif navigation, plain-link accessibility and purposeful white space. All page art and portraits remain first-party. No stock imagery, remote CSS, hosted fonts, new AI dependencies, tracking integrations or paid services are introduced.

It extends five existing destinations without replacing the underlying GitHub Pages architecture. The three Next.js static-export pages receive only a stylesheet link and scoped styles. Their hydrating page markup and script bundles remain unchanged.

## Open-source agents and workers
- https://github.com/msitarzewski/agency-agents (MIT) is adapted into the existing role-based review practice. Roles are prompt files, not autonomous background processes.
- https://github.com/Pagefind/pagefind remains the on-site search tool.
- https://github.com/GoogleChrome/lighthouse-ci informs existing automated accessibility, performance and SEO tests.
- Existing GitHub Actions plus local Playwright provide deterministic CI checks. Screenshots are inspection evidence, not independent aesthetic approval.

## Release conditions
- `python scripts/test_flagship_edition3.py` passes.
- Existing site-performance, editorial, navigation, accessibility, full-site visual alignment and Lighthouse workflows pass.
- `python scripts/flagship_visual_capture.py` captures ten representative desktop/mobile screenshots and a JSON observation log. Inspect them before release.
- Verify meaningful keyboard focus, portrait crop, mobile text wrapping, contact route and recruiter print support.
- Keep claims about current role, 2025 director-level progression, 2026 named appointment, and employer results consistent with the existing public record.

## Known limitations
A consistent editorial system across the five highest-value destinations is not the same as a comprehensive redesign of every public research and tool page. The remaining pages retain their current templates. Third-party proof, actual conversion rates and SEO ranking require independent verification.
