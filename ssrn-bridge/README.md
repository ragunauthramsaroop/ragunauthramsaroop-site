# SSRN Publication Bridge

GitHub source: ragunauthramsaroop/ragunauthramsaroop-site.

This bridge compares the 20 previously submitted SSRN papers with the public SSRN abstract pages, and stages five additional independent research PDFs found in the Weekly White Papers folder of Google Drive. It preserves the original files and SHA256 checksums. A further five publications need complete source PDFs before upload.

## Operational safeguards

- Known SSRN abstract IDs are excluded from resubmission.
- Audit validates PDF header, author-written metadata and SHA256 checksum.
- The submission script appends a research-integrity and AI-use disclosure page to a copy of each manuscript. Original PDFs remain unchanged.
- It signs in to the owner's SSRN account, checks My Papers for duplicates and attempts the full seven-stage submission process.
- It selects All Rights Reserved and records the resulting submission ID. The output distinguishes submitted from publicly posted and Google Scholar indexed.
- If SSRN changes its author, classification, rights, licence or final review controls, the script stops and reports a failure rather than guessing.
- Screenshots and credentials are not stored in the repository.

## Running

Run audit with `SSRN_BRIDGE_MODE=audit node scripts/ssrn_bridge.mjs`.

Run submission in a GitHub Actions worker with Node 22, Playwright Chromium, Python 3.12, pypdf 6.1.1 and reportlab 4.2.5, and repository-protected SSRN_EMAIL / SSRN_PASSWORD values in environment variables. Run `SSRN_BRIDGE_MODE=submit node scripts/ssrn_bridge.mjs`.

Status results are written to `ssrn-bridge/run/results.json` and `SUMMARY.md`. No GitHub automation guarantees external screening, DOI assignment, or Google Scholar indexing.

## Publication queue

See `ssrn-bridge/manifest.json`: 20 registered SSRN preprints, 5 staged new manuscripts, and 5 further papers awaiting source PDF transfer.
