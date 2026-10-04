#!/usr/bin/env python3
"""Executive outreach preflight with senior-functional-leader title support.

The base preflight remains the policy authority. This wrapper extends the senior-title
recognition narrowly for legitimate senior functional roles such as Senior Director,
General Manager, Country Head, regional functional manager, Sustainability Director,
Board Member, Partner, and named regional/global industry leadership roles before
delegating to the existing preparation pipeline.
"""

import re

import prepare_outreach_payload as base

base.SENIOR_TITLE = re.compile(
    r"\b(ceo|chief\b|president\b|chair(?:man|woman)?\b|managing director\b|"
    r"country director\b|country manager\b|country head\b|executive vice president\b|evp\b|"
    r"senior vice president\b|svp\b|vice president\b|vp\b|head of\b|"
    r"group director\b|regional director\b|regional [a-z& /-]+ manager\b|executive director\b|senior director\b|"
    r"general manager\b|sustainability director\b|board member\b|"
    r"partner(?:-in-charge| in charge)?\b|industrial products & construction leader\b|"
    r"financial services leader\b|operations consulting leader\b|industry leader\b|practice leader\b)\b",
    re.IGNORECASE,
)


if __name__ == "__main__":
    base.main()
