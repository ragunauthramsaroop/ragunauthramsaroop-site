#!/usr/bin/env python3
"""Expand one approved executive campaign into company-specific staged payloads.

The campaign stays compact and auditable. Each target becomes one executive-company
payload consumed by prepare_outreach_payload.py, which creates a strategic value
proposal and appends Ragunauth Ramsaroop's three-page executive CV to the SAME PDF.

The builder accepts both the original compact schema (targets/context/contribution)
and the richer audited schema (items/facts/rationale/how_i_can_help). This keeps older
approved campaigns reproducible while allowing stronger company-specific research.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

STAGED_DIR = Path("outreach/icloud-staged")
BATCH_OUT = Path("/tmp/generated-executive.batch.json")


def slugify(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", value).strip("_")[:70]


def words(value: str) -> int:
    return len(str(value).split())


def ensure_text(value: object, label: str, minimum: int = 1) -> str:
    text = str(value or "").strip()
    if words(text) < minimum:
        raise ValueError(f"{label} is missing or too thin")
    return text


def normalize_context(target: dict, company: str, recipient: str, title: str) -> str:
    direct = str(target.get("context") or "").strip()
    if words(direct) >= 35:
        return direct
    facts = target.get("facts")
    if isinstance(facts, list):
        fact_text = " ".join(str(x).strip() for x in facts if str(x).strip())
    else:
        fact_text = ""
    base = (direct + " " + fact_text).strip()
    extension = (
        f"The leadership interface represented by {recipient}, {title}, places {company}'s strategic priorities in a context where growth, institutional relationships, responsible operations, stakeholder confidence and disciplined cross-functional execution must reinforce one another. "
        "That combination creates a relevant basis for considering executive contribution across government relations, ESG, corporate affairs, strategic partnerships and country-level delivery."
    )
    return (base + " " + extension).strip()


def build_payload(campaign: dict, target: dict, index: int) -> dict:
    company = ensure_text(target.get("company"), "company")
    recipient = ensure_text(target.get("recipient_name"), "recipient_name", 2)
    title = ensure_text(target.get("recipient_title"), "recipient_title", 2)
    email = ensure_text(target.get("to"), "to")
    salutation = ensure_text(target.get("salutation") or recipient, "salutation")
    context = normalize_context(target, company, recipient, title)
    themes = target.get("themes")
    if not isinstance(themes, list) or len(themes) != 3:
        raise ValueError(f"{company}: exactly three strategic themes are required")
    sources = target.get("sources")
    if not isinstance(sources, list) or len(sources) < 3:
        raise ValueError(f"{company}: at least three sources are required")

    theme_names = ", ".join(ensure_text(x.get("title"), "theme.title", 2) for x in themes)

    executive_summary = (
        f"This strategic value creation proposal has been prepared specifically for {company} and for discussion with {recipient}, {title}. "
        f"It is not a generic employment application. It sets out where my operating experience across government relations, ESG, corporate affairs, regulatory coordination, social performance, executive advisory and complex stakeholder execution could support priorities across {theme_names}. "
        "My career has been built in environments where corporate objectives depend on disciplined alignment between public institutions, regulators, communities, technical teams and executive leadership. The proposal therefore focuses on practical contribution, measurable governance and execution rather than broad statements of interest."
    )

    company_context = (
        f"{context} "
        f"For {company}, this creates a leadership requirement that goes beyond conventional functional management. Growth, reputation, sustainability, regulatory confidence and stakeholder trust must reinforce one another, particularly when major projects, national priorities and long-term investment commitments are involved. "
        "The most effective model is one in which external commitments are translated into clear internal ownership, decision rights, evidence standards, escalation routes and measurable delivery. That intersection between institution-facing leadership and operating execution is where my background is most directly relevant."
    )

    opportunities = []
    for theme in themes:
        t = ensure_text(theme.get("title"), "theme.title", 2)
        c = ensure_text(theme.get("context") or theme.get("rationale"), f"{company}.{t}.context", 12)
        contribution = ensure_text(theme.get("contribution") or theme.get("how_i_can_help"), f"{company}.{t}.contribution", 12)
        opportunities.append({
            "title": t,
            "rationale": (
                f"{c} This priority benefits from an operating model that links executive intent with government, regulatory, community and internal stakeholder requirements. "
                "Clear ownership, evidence, decision cadence and escalation discipline help prevent strategic commitments from becoming disconnected from delivery or reputation risk."
            ),
            "how_i_can_help": (
                f"{contribution} I would bring a structured approach built around stakeholder mapping, executive issue briefs, responsibility matrices, regulatory and commitment trackers, cross-functional coordination and concise decision reporting. "
                "The objective would be to strengthen execution quality while preserving speed, accountability and senior-management visibility."
            ),
        })

    action_framework = {
        "days_0_30": [
            f"Map {company}'s priority stakeholders, institutional interfaces, active commitments and decision dependencies relevant to {theme_names}.",
            "Review existing governance, reporting, escalation and evidence flows to identify duplication, gaps and high-consequence exposure.",
            "Establish an executive issue register separating immediate actions, structural risks, strategic opportunities and relationship priorities.",
        ],
        "days_31_60": [
            "Align leadership on priority outcomes, accountabilities and stakeholder objectives, with clear owners and escalation thresholds.",
            "Build a practical engagement and assurance cadence connecting corporate functions, operating teams and external institutions.",
            "Convert strategic commitments into measurable workstreams with evidence requirements and senior reporting discipline.",
        ],
        "days_61_90": [
            "Execute the highest-value stakeholder, ESG and institutional workstreams while resolving avoidable process friction.",
            "Introduce concise executive dashboards focused on decisions, commitments, regulatory exposure, stakeholder sentiment and delivery status.",
            "Formalize cross-functional routines so external commitments are consistently translated into internal action and verification.",
        ],
        "days_91_180": [
            "Scale the operating model across relevant business units, projects or geographies and embed lessons into standard governance.",
            "Measure outcomes through stakeholder, regulatory, ESG, delivery and reputation indicators rather than activity volume alone.",
            "Build a forward agenda identifying emerging institutional, sustainability and partnership opportunities before they become urgent issues.",
        ],
    }

    potential_impact = [
        f"Stronger alignment between {company}'s strategic priorities and the government, regulatory, community and partner interfaces that influence execution.",
        "Improved management visibility through disciplined tracking of commitments, risks, decisions, evidence and accountable owners.",
        "More integrated ESG and stakeholder execution, reducing the gap between public commitments, internal governance and operating delivery.",
        "A senior coordination capability able to move across functions and institutions when issues do not fit neatly within one department.",
    ]

    background_relevance = [
        "Director-level responsibility within AGM Inc., part of Zijin Mining Group, spanning government relations, ESG, social responsibility, corporate affairs, regulatory coordination and executive advisory.",
        "Direct engagement with ministries, regulators, public institutions, communities, contractors, industry bodies and strategic partners in a high-scrutiny natural-resources environment.",
        "Cross-functional coordination across operations, environment, HSE, legal, HR, finance, procurement, security, aviation and technical teams where external commitments require internal delivery.",
        "Experience supporting renewable-energy transition, carbon-data readiness, governance, compliance and reputation-sensitive matters while maintaining operational practicality.",
    ]

    body = (
        f"Dear {salutation},\n\n"
        f"I am writing to introduce my profile for senior leadership opportunities within {company}, particularly where {theme_names} intersect with institutional execution and business performance.\n\n"
        "I currently serve as Liaison Director, Social Responsibility Department at AGM Inc., part of Zijin Mining Group. My 12+ years of experience spans government and regulatory relations, ESG, corporate affairs, social performance, compliance coordination and executive stakeholder strategy in complex operating environments.\n\n"
        f"Rather than send a conventional application alone, I have attached a strategic value creation proposal prepared specifically for {company}. It identifies practical areas where I believe my background could contribute, together with a 90-180 day action framework. My three-page Executive CV forms the final three pages of the same document, so the proposal and supporting career evidence remain in one executive package.\n\n"
        "I would welcome the opportunity for a confidential discussion should the profile align with a current or future country, regional, external affairs, ESG, strategy, stakeholder or executive coordination mandate.\n\n"
        "Kind regards,\n"
        "Ragunauth Ramsaroop\n"
        "Liaison Director | ESG | Government Relations | Corporate Affairs | Social Performance\n"
        "Georgetown, Guyana\n"
        "ragunauthramsaroop@icloud.com\n"
        "ragunauthramsaroop.com\n"
        "linkedin.com/in/ragunauth-ramsaroop"
    )

    return {
        "approved": True,
        "dry_run": False,
        "campaign_type": "executive_company",
        "campaign_id": campaign.get("campaign_id"),
        "messages": [{
            "to": email,
            "subject": ensure_text(target.get("subject"), f"{company}.subject", 4),
            "body": body,
            "recipient_name": recipient,
            "recipient_title": title,
            "email_verified": True,
            "email_verification_source": ensure_text(target.get("email_verification_source"), f"{company}.email_verification_source"),
            "recipient_role_source_url": ensure_text(target.get("recipient_role_source_url"), f"{company}.recipient_role_source_url"),
        }],
        "strategic_brief": {
            "company": company,
            "title": f"Strategic Value Creation Proposal | {company}",
            "executive_summary": executive_summary,
            "company_context": company_context,
            "opportunities": opportunities,
            "action_framework": action_framework,
            "potential_impact": potential_impact,
            "background_relevance": background_relevance,
            "sources": sources,
        },
    }


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: build_executive_campaign.py <campaign.json>")
    campaign_path = Path(sys.argv[1])
    campaign = json.loads(campaign_path.read_text(encoding="utf-8"))
    if campaign.get("approved") is not True:
        raise ValueError("Campaign must set approved=true")
    targets = campaign.get("targets") or campaign.get("items")
    if not isinstance(targets, list) or not targets or len(targets) > 30:
        raise ValueError("Campaign targets must contain 1 to 30 records")

    STAGED_DIR.mkdir(parents=True, exist_ok=True)
    payload_files = []
    seen_emails = set()
    seen_companies = set()
    for index, target in enumerate(targets, start=1):
        company = ensure_text(target.get("company"), "company")
        email = ensure_text(target.get("to"), "to").lower()
        if email in seen_emails:
            raise ValueError(f"Duplicate email in campaign: {email}")
        if company.lower() in seen_companies:
            raise ValueError(f"Duplicate company in campaign: {company}")
        seen_emails.add(email)
        seen_companies.add(company.lower())

        payload = build_payload(campaign, target, index)
        name = f"{slugify(str(campaign.get('campaign_id') or 'campaign'))}_{index:02d}_{slugify(company)}.json"
        path = STAGED_DIR / name
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        payload_files.append(str(path))

    manifest = {
        "approved": True,
        "campaign_id": campaign.get("campaign_id"),
        "payload_files": payload_files,
    }
    BATCH_OUT.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(str(BATCH_OUT))


if __name__ == "__main__":
    main()
