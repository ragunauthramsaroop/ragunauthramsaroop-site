#!/usr/bin/env python3
"""Executive outreach preflight with controlled policy blocking.

The base preflight remains the policy authority. This wrapper extends senior-title
recognition for legitimate functional leaders and returns exit code 78 for expected
policy blocks. Unexpected code or runtime failures still return a failing exit code.
"""

import re
import sys

import prepare_outreach_payload as base

base.SENIOR_TITLE = re.compile(
    r"\b(ceo|chief\b|president\b|chair(?:man|woman)?\b|managing director\b|"
    r"country director\b|country manager\b|country head\b|executive vice president\b|evp\b|"
    r"senior vice president\b|svp\b|vice president\b|vp\b|head of\b|head group\b|"
    r"group head\b|global head\b|regional head\b|group director\b|regional director\b|"
    r"regional [a-z& /-]+ manager\b|executive director\b|senior director\b|"
    r"general manager\b|sustainability director\b|board member\b|"
    r"partner(?:-in-charge| in charge)?\b|industrial products & construction leader\b|"
    r"financial services leader\b|operations consulting leader\b|industry leader\b|practice leader\b)\b",
    re.IGNORECASE,
)


if __name__ == "__main__":
    try:
        base.main()
    except ValueError as exc:
        print(f"OUTREACH_POLICY_BLOCK: {exc}", file=sys.stderr)
        raise SystemExit(78)
