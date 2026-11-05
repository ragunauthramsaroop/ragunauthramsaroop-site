# Executive website peer review and first-impression changes

Reviewed: 5 November 2026  
Website: https://ragunauthramsaroop.com/  
Source branch: `flagship-first-impression-2026-11-05`

## Scope and evidence standard

This is a source-level review of the live public homepage and the GitHub Pages repository. It does not pretend to be an independently measured PageSpeed, WCAG certification, penetration test, or quantified backlink audit. The earlier generic research output included anonymous comparator scores and references to a product catalogue/advertising that do not match the actual executive homepage. Those scores and characterizations are rejected.

The site already contains:
- A public executive biography, CEO and board mode, recruiter toolkit, CV, source-backed record and professional contact routes.
- Self-hosted portrait and fonts, strict meta Content Security Policy, title/description/canonical, Open Graph tags and Person schema.
- A static GitHub Pages deployment, a small homepage runtime, service-worker cache strategy, consent-gated analytics and dedicated automated quality scripts.
- Clear separation between employer outcomes and personal responsibility, and qualified Oxford and UNGIS references.

## Public comparison, not a fabricated ranking

| Peer | Verified presentation pattern | Relevant lesson |
| --- | --- | --- |
| [Keith Krach: official bio and resources](https://keithkrach.com/official-bio-resources/) | Official short/medium biographies, PDF/DOCX links, current roles, dated source references and media resources | Keep a short route to downloadable approved professional materials and clearly label dated claims |
| [Harry Broadman at APCO](https://apcoworldwide.com/people/harry-g-broadman/) | Name, senior roles, sector fit and direct professional email appear near the top | Lead with specific operating context and contact, not multiple layers of generic introduction |
| [Joe Zammit-Lucia at INSEAD](https://www.insead.edu/bio/joe-zammit-lucia) | Concise role identification followed by selected work, books and board service | Make the first screen scannable for decision makers |
| [Andrew Pike Advisory](https://www.andrewpikeadvisory.com/) | Five-item navigation, clearly defined audience, services and contact | Make the action explicit rather than asking visitors to decode navigation |

These are qualitative comparisons of published content and information architecture, not laboratory speed comparisons or endorsements.

## Findings and changes

1. **Homepage first action was an extra profile-reading step.** The gold first-screen action formerly opened the general executive profile, while the email action was visually secondary. The revised first action opens a direct executive-mandate email, and the secondary action opens the recruiter toolkit. The separate board pathway, CV and profile remain visible.
2. **Mobile menu remained open after in-page navigation.** The homepage uses an accessible native `details` menu. A small local runtime handler now closes it after a link is selected, and Escape closes it while restoring focus to the Menu summary.
3. **Search snippet was verbose.** The homepage title and description now lead with the executive's name and professional specializations. Existing canonical, schema, social sharing metadata, sources and claims remain unchanged.

## Acceptance checks

- Preserve one homepage H1 and critical routes to executive profile, board briefing, recruiter mode/toolkit, CV, proof, research, and contact.
- Preserve at least three direct public email paths as required by the current flagship quality guard.
- Keep original employer-versus-personal attribution and source qualification.
- Keep homepage HTML below 25 KB and homepage runtime below 1.5 KB.
- Run existing repository CI checks after the pull request is opened, including performance, accessibility, integrity, SEO/route validation and browser-script syntax.
- For visual release approval, verify desktop at 1440px, mobile at 390px, tablet at 768px, keyboard Tab/Enter/Escape, recruiter link and mailto destination. Record visual evidence before production merge.

## Further recommendations, not implemented in this small change

- Measure actual field Core Web Vitals and search-console queries before choosing more extensive front-end refactoring. Google's good field thresholds are LCP <=2.5s, INP <=200ms and CLS <=0.1 at the 75th percentile.
- Consider consolidating the three homepage editorial CSS layers only after visual regression screenshots and CSS coverage data. Removing styles without a proper baseline risks the established design.
- Test the board and recruiter journeys with real first-time viewers: time to relevant proof, time to CV, time to contact, and any mistaken interpretation of organizational outcomes as personal credit.
- Verify platform-level HTTP security headers separately from the in-document CSP. GitHub Pages hosting configuration has limits, and the presence of a meta policy does not establish every HTTP response header.
- Avoid invented review scores, badges, rankings, awards, client testimonials or claimed affiliations.

## Deployment record

The patch and this report are committed on a review branch. Production status requires independently verified green CI, explicit code and desktop/mobile visual review, merge to `main`, and successful GitHub Pages publication. An open PR is not a live release.
