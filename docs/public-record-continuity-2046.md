# Keeping the public record readable through 2046

The purpose of this design is continuity and auditability, not speculative technology.

## Permanent source of public identity
- Public URL: https://ragunauthramsaroop.com/public-record/
- JSON export: https://ragunauthramsaroop.com/api/v1/executive-record.json
- Stable person ID: https://ragunauthramsaroop.com/#person
- Canonical professional facts remain in data/public-profile.json.
- Every portable claim has a stable claim ID, effective date, exact scope, evidence URLs and an evidence classification. The company context category has an explicit individual-attribution exclusion.

## What the record is, and is not
The JSON record is first-party, open and portable. The page is usable without JavaScript or a hosted external identity service. It is NOT a W3C Verifiable Credential, an employer-issued credential, a notarized affidavit or proof of academic employment. A SHA-256 content hash is a method for file integrity comparison, not independent identity certification. Existing provenance.json has historical September 2026 timestamps and needs a separate verified refresh. Do not describe older hashes as current or signed.

## Continuity safeguards
1. Maintain readable HTML as primary access, with JSON as a portable companion.
2. Keep stable URLs. Redirect deprecated pages rather than silently deleting citations.
3. Change a claim only alongside its as-of date, evidence and classification. Preserve public history in Git commits and archive releases.
4. Run scripts/verify_executive_record.py in CI and guard the 8 flagship routes through scheduled SEO checks.
5. Maintain organisational outcomes and individual accountability as separate categories.
6. Preserve personal-data minimisation: no phone, personal email or date of birth in the JSON export.
7. Review primary-source URLs and publication policies annually. Produce a static recovery copy when migrating hosts.
8. Add truly issuer-signed credentials only when relevant institutions issue them, following the W3C Verifiable Credentials Data Model v2.0 or its then-current stable successor.
9. Run accessibility and sustainability budgets. The W3C Web Sustainability Guidelines inform future maintenance rather than asserting certification.
10. The domain, backups, GitHub ownership and DNS have no guaranteed twenty-year uptime. Maintain recovery documentation and an owner-controlled archive.

References: https://www.w3.org/TR/vc-data-model-2.0/ and https://www.w3.org/TR/web-sustainability-guidelines/

## Next technical priority
The 2026-09-23 provenance registry contains hashes for files that have since changed. Before using the registry for authenticity assurance, recalculate hashes from verified repository bytes, synchronize copies and add ongoing drift detection. Do not equate a fixed manifest with third-party certification.

## Provenance auto-maintenance added 1 November 2026

The historical hash registry is now rebuilt deterministically from file bytes after the existing public search-index build and after daily official-source snapshot refresh. `scripts/refresh_provenance.py --refresh` rebuilds hashes and adds the identity/record pages; `--check` performs a read-only consistency test. Both `data/provenance.json` and `api/v1/provenance.json` are kept identical. The two existing publishing workflows use one serialized GitHub concurrency group and bounded push retries to reduce conflicts. A matching SHA-256 value establishes byte-level integrity against a public snapshot, not third-party authorship or factual accuracy.

## Long-term operationalization

The executive graph is rebuilt deterministically from the canonical public claim record and checked by CI. A monthly GitHub Actions workflow creates a verified public-only core recovery ZIP, with a SHA-256 manifest and a time-limited 90-day artifact. See docs/public-recovery-runbook.md for downloading an independent copy, verification and restoration steps. Issuer status remains explicit at /credential-readiness/: no independently signed credentials registered. Neither self-published records nor hashes represent institutional signatures.
