# Private iCloud executive recruiter audit

This bridge uses the existing GitHub Actions secret `ICLOUD_APP_PASSWORD`, which was used by the prior iCloud IMAP integration. There is no Mailopoly dependency.

## Workflow
`.github/workflows/icloud-executive-forensic.yml`

The workflow reads iCloud's Sent Messages and Inbox using IMAP read-only mode. It scans message headers from the requested date and uses the IMAP MIME structure to identify likely PDF attachments. No body text or attached documents are downloaded.

Detailed JSON results are transferred only by iCloud SMTP to the Gmail account already verified through the account's Gmail connector. Nothing containing recipients, subject lines, or message IDs is committed to this public repository or uploaded as a public artifact. GitHub logs include aggregate counts only.

## Run
Open GitHub Actions > **Private iCloud executive recruiter forensic audit** > **Run workflow**. Set `since` to `2026-08-01` for the current outreach campaign, or an earlier date for older mail.

The workflow also runs once when its script/workflow is first merged into `main` and whenever those two files change on `main`.

Find the report in the connected Gmail inbox by searching for: `subject:"PRIVATE iCloud Executive Recruiter Audit"`. Download the JSON attachment for a row-level audit, and compare to the Gmail and AgentMail sent-message registers.

## Audit boundaries
- A Sent header is evidence of a stored message, not proof of delivery.
- Email subject filtering will miss candidate messages whose subjects contain no relevant keywords.
- PDF MIME indicators help identify possible attachments but do not verify document contents.
- Inbox search excludes autoreplies and ignores archived and deleted incoming mail.
- Only the latest 12,000 messages per folder in the requested period are inspected.
- The connected Gmail address is allowlisted inside the script.
- Avoid placing Apple app-specific passwords, raw correspondence or CV data in GitHub Issues, code, workflow logs or public Pages.
