# Public-core recovery and credential issuance runbook

Monthly UTC schedule: first day of each month at 03:13, plus manual workflow dispatch. GitHub Actions artifact retention: 90 days, not permanent.

## Owner-controlled preservation

1. Open GitHub Actions > Public executive core recovery snapshot. Select a successful monthly run.
2. Download the public-core artifact containing rr-public-core-YYYY-MM-DD.zip and its SHA-256 sidecar.
3. Save both files outside the GitHub account under your direct control. No website credentials, private documents or contact data belong in the public repository.
4. Verify the ZIP with scripts/create_public_recovery_bundle.py --verify /path/to/rr-public-core-YYYY-MM-DD.zip. The tool checks the archive SHA-256 and the listed file contents.
5. Test a clean restoration at least annually, including domain ownership, HTTPS, public-record routes, SEO canonicals, source links, accessibility and dated career accuracy.

The archive contains only a defined subset of public professional records. It excludes all private outreach, authentication secrets, domain account access, Git history, full-site assets and the research PDF corpus. Monthly GitHub artifacts expire and cannot guarantee twenty-year survival. Independent off-GitHub backups require owner-controlled access or a separately authorized storage connection.

## Genuine credential issuance

Current status: no employer-, university- or award-issuer-signed digital credentials registered. A SHA-256 file integrity record and a biography are not digital credentials.

Future implementation requires genuine issuer participation, consent, verification of issuer identifiers, cryptographic proof and status, plus a privacy review. Do not add personal academic, employment or award records to public GitHub Pages without explicit permission and minimization. W3C VC Data Model 2.0 is a published Recommendation: https://www.w3.org/TR/vc-data-model-2.0/ .
