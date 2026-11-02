# IndexNow publication notifications

This is a free change-notification protocol for participating search engines, based on https://www.indexnow.org/documentation. The existing publicly accessible key file in the site root proves control of the domain. The workflow submits only public pages and PDF URLs that appear in this site's canonical sitemaps. It does not submit confidential outreach or unrelated content.

On the initial workflow installation, the two new November original publications and their original PDF links are included as a bounded bootstrap. Future releases notify only changed HTML and research PDF URLs. The payload is bounded to 500 URLs; technical failures remain visible in GitHub Actions rather than silently calling them successes.

A 200 response acknowledges notification. A 202 response means ownership/key verification is still pending. Neither response confirms a search ranking, Google indexing, traffic, or AI citation. Google Search Console is a separate property and requires owner-authorized connection. No paid SEO service or credential is used.
