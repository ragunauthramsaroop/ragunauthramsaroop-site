# SSRN Publication Bridge: compliant author-submission route

The [SSRN Author Submission Assistant](./index.html) provides a searchable, copy-ready queue for the owner's research manuscripts. It reads [manifest.json](./manifest.json), not external private account data.

## What is working

- 20 historical SSRN abstract IDs are preserved and never resubmitted.
- Five complete-source PDFs are verified against SHA-256 checksums.
- For each of the five staged manuscripts, `scripts/ssrn_prepare.py` adds a PDF disclosure appendix without changing the original source PDF.
- GitHub Actions builds **ssrn-author-upload-package**, a downloadable artifact containing `ssrn-author-reviewed-submission-pack.zip`.
- The ZIP contains five prepared PDFs, `submission-metadata.json`, and `AUTHOR-REVIEW-FIRST.md` instructions.
- A read-only SSRN register audit produces a separate `ssrn-bridge-results` artifact.
- Five further papers in the queue lack verified source PDFs; they are not represented as prepared or submitted.

## Why we changed the automated submission mechanism

SSRN returned HTTP 403 / Cloudflare ("Just a moment") when its author dashboard was accessed from a GitHub-hosted browser. Repeatedly retrying that path generated GitHub failure notifications without depositing a paper. The workflow no longer attempts automated sign-in or submission.

**Only the author can sign in to SSRN and attest manuscript rights and research integrity.**
SSRN's 2026 policies require truthful AI-use disclosure in the PDF and abstract, with the actual AI tool(s), use and extent. Those statements, copyright, citations, funding and affiliations need personal review before submission. SSRN also warns against high-volume submissions. This bridge does **not** automatically submit batches or bypass security.

## How to make a real SSRN submission

1. Open [the SSRN Publication Bridge Actions workflow](https://github.com/ragunauthramsaroop/ragunauthramsaroop-site/actions/workflows/ssrn-publication-bridge.yml).
2. Open the newest successful run (or select **Run workflow**). Download **ssrn-author-upload-package** from its Artifacts section.
3. Extract `ssrn-author-reviewed-submission-pack.zip`. Review `AUTHOR-REVIEW-FIRST.md` and `submission-metadata.json`.
4. Use the [SSRN Submission Assistant](./index.html) to select a paper and copy its metadata. If GitHub Pages is enabled on the root, it is also available as `https://ragunauthramsaroop.com/ssrn-bridge/`.
5. Open [SSRN My Papers](https://hq.ssrn.com/submissions/MyPapers.cfm) in your own authenticated browser. Search for an existing paper by its title to prevent accidental duplication.
6. Complete SSRN's submission stages with one reviewed, correctly disclosed PDF and the matching metadata. Check the final review screen and affirm the author declarations only if true.
7. Update the manifest with the actual SSRN ID only once the dashboard confirms successful submission. Do not confuse submission with public posting or Google Scholar indexing.

If SSRN blocks even a normal signed-in personal browser, use the [official SSRN Support Center](https://www.elsevier.support/ssrn/contact) for assistance. Do not route around their firewall.

## Developer commands

```bash
python -m pip install pypdf==6.1.1 reportlab==4.2.5
python scripts/ssrn_submission_pack.py
SSRN_BRIDGE_MODE=audit node scripts/ssrn_bridge.mjs
```

Generated, verified materials go to `ssrn-bridge/run/`, with the complete ZIP at `ssrn-bridge/run/ssrn-author-reviewed-submission-pack.zip`.

The previous `SSRN_BRIDGE_MODE=submit` Playwright implementation remains in source for historical reference but **must not be used against GitHub-hosted SSRN access**; the official GitHub workflow now only audits and packages. Account credentials are not needed, passed to runners, or included in the artifacts.

## Applicable policies
- [SSRN Submission Guidelines](https://www.elsevier.support/ssrn/answer/get-started)
- [SSRN Generative AI Policy](https://www.elsevier.support/ssrn/answer/AI)
- [SSRN Firewall Alert Guide](https://www.elsevier.support/ssrn/answer/why-am-i-getting-a-firewall-alert)
