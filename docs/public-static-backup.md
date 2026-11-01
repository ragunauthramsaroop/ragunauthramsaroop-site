# Complete public static site preservation

Workflow: .github/workflows/public-static-recovery.yml

The monthly UTC second-day recovery exports all eligible public GitHub Pages static files. The export includes the executive homepage, research catalogue, papers, Pagefind search assets, _next assets, public APIs, images and free tools. It excludes the Git history, backend/API runtime secrets, account access, unrelated projects and the public repo's separate recruiter outreach folder.

All selected files have a SHA-256 digest and byte length in a signed-*format* manifest, plus an independent ZIP SHA-256 checksum. Neither hash is a cryptographically signed issuer attestation. Archives are validated locally and saved for 90 days in GitHub Actions. For real provider independence, download and upload to separately controlled private cloud storage with the checksum, and test a restoration at least annually.

The static export does not include DNS zone records, registrar credentials, Git commit history, cloud infrastructure, authenticated APIs, email accounts or private recruitment details. Source code/configuration remains in the GitHub repository; arrange a separate credential-free git bundle if full code history preservation is required.
