#!/usr/bin/env python3
"""Guarded N2Growth candidate submission route.

Runs in GitHub Actions with Playwright. Inspect mode prints the live form's
select options and input constraints. Submit mode fills only truthful candidate
information and refuses to invent a postal code or accept marketing.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from typing import Iterable

from playwright.sync_api import Locator, Page, sync_playwright

FORM_URL = "https://www.n2growth.com/candidate-submission/"
CV_SOURCE = Path("career-assets/Ragunauth_Ramsaroop_Executive_CV_2026.md")
CV_PDF = Path("/tmp/Ragunauth_Ramsaroop_ATS_Executive_Resume_Ceiling_2026.pdf")

PROFILE = {
    "First Name": "Ragunauth",
    "Last Name": "Ramsaroop",
    "Job Title": "Liaison Director, Social Responsibility Department",
    "Company Name": "AGM Inc. (Zijin Mining Group)",
    "Phone Number": "+592 608 4735",
    "Your Email": "ragunauthramsaroop@icloud.com",
    "LinkedIn Profile URL": "https://www.linkedin.com/in/ragunauth-ramsaroop",
    "City": "Georgetown",
    "Postal Code": "N/A",
}

COMMENTS = (
    "Director-level executive with 12+ years across multinational mining, regulated financial services and commercial operations. "
    "Currently Liaison Director, Social Responsibility Department at AGM Inc., part of Zijin Mining Group. Senior experience spans "
    "government and regulatory relations, ESG and social performance, external and corporate affairs, stakeholder strategy, "
    "strategic partnerships and executive communications. Open to Director, VP, Country and Regional leadership mandates, "
    "including expatriate and rotational appointments across the GCC, Africa, Europe, Asia-Pacific and the Americas. Target areas "
    "include Government Relations, External/Corporate Affairs, ESG & Sustainability, Stakeholder Relations, Strategic Partnerships, "
    "Country Leadership, Energy Transition and Mining & Resources."
)


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def label_control(page: Page, fragment: str) -> Locator:
    # Prefer native accessible label association.
    loc = page.get_by_label(re.compile(re.escape(fragment), re.I))
    if loc.count():
        return loc.first

    # Gravity Forms fallback: find label text and its for= target.
    labels = page.locator("label")
    for i in range(labels.count()):
        label = labels.nth(i)
        text = normalize(label.inner_text())
        if fragment.lower() in text.lower():
            target = label.get_attribute("for")
            if target:
                return page.locator(f"#{target}")
            parent = label.locator("xpath=..").first
            candidate = parent.locator("input, select, textarea").first
            if candidate.count():
                return candidate
    raise RuntimeError(f"Unable to resolve field control for label containing: {fragment}")


def option_texts(control: Locator) -> list[str]:
    return [normalize(x) for x in control.locator("option").all_inner_texts()]


def print_select_options(page: Page) -> None:
    print("N2GROWTH_SELECT_OPTIONS_BEGIN")
    for label in [
        "State",
        "Country",
        "Region",
        "Industry expertise",
        "Current/most recent total cash compensation in USD",
        "Current/most recent discipline",
        "How did you find out about N2Growth",
    ]:
        try:
            control = label_control(page, label)
            if control.evaluate("el => el.tagName.toLowerCase()") == "select":
                print(json.dumps({"label": label, "options": option_texts(control)}, ensure_ascii=False))
        except Exception as exc:
            print(json.dumps({"label": label, "error": str(exc)}, ensure_ascii=False))
    print("N2GROWTH_SELECT_OPTIONS_END")


def select_best(control: Locator, candidates: Iterable[str], field_name: str) -> str:
    options = option_texts(control)
    usable = [o for o in options if o and not re.search(r"select|choose", o, re.I)]
    for candidate in candidates:
        exact = next((o for o in usable if o.lower() == candidate.lower()), None)
        if exact:
            control.select_option(label=exact)
            print(f"SELECTED {field_name}: {exact}")
            return exact
    for candidate in candidates:
        fuzzy = next((o for o in usable if candidate.lower() in o.lower()), None)
        if fuzzy:
            control.select_option(label=fuzzy)
            print(f"SELECTED {field_name}: {fuzzy}")
            return fuzzy
    raise RuntimeError(f"No truthful option found for {field_name}. Available: {options}")


def choose_compensation_privacy_first(control: Locator) -> str:
    options = option_texts(control)
    usable = [o for o in options if o and not re.search(r"select|choose", o, re.I)]
    privacy_patterns = [r"prefer not", r"decline", r"not disclose", r"rather not", r"n/?a", r"not applicable"]
    for pattern in privacy_patterns:
        for option in usable:
            if re.search(pattern, option, re.I):
                control.select_option(label=option)
                print(f"SELECTED compensation: {option}")
                return option
    raise RuntimeError(
        "COMPENSATION_OPTION_REQUIRED: no non-disclosure option is available. "
        "Inspect output and configure a truthful band without placing an exact salary in source code. "
        f"Available: {options}"
    )


def build_cv() -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from send_icloud_smtp import build_cv_pdf  # type: ignore

    if not CV_SOURCE.exists():
        raise RuntimeError(f"CV source missing: {CV_SOURCE}")
    build_cv_pdf(CV_SOURCE, CV_PDF)
    if not CV_PDF.exists() or CV_PDF.stat().st_size < 10_000:
        raise RuntimeError("Generated CV PDF is missing or unexpectedly small.")
    print(f"CV_READY pagesource={CV_SOURCE} bytes={CV_PDF.stat().st_size}")


def fill_text(page: Page, label: str, value: str) -> Locator:
    control = label_control(page, label)
    control.fill(value)
    return control


def submit(page: Page) -> None:
    build_cv()

    for label, value in PROFILE.items():
        control = fill_text(page, label, value)
        if label == "Postal Code":
            valid = control.evaluate("el => el.checkValidity()")
            if not valid:
                message = control.evaluate("el => el.validationMessage")
                raise RuntimeError(
                    "POSTAL_CODE_REJECTED: N/A is not accepted. Refusing to invent a Guyana postal code. "
                    f"Browser validation: {message}"
                )

    # State is optional. Leave it blank unless the site has an explicit N/A choice.
    try:
        state = label_control(page, "State")
        if state.evaluate("el => el.tagName.toLowerCase()") == "select":
            opts = option_texts(state)
            na = next((o for o in opts if re.search(r"not applicable|n/?a", o, re.I)), None)
            if na:
                state.select_option(label=na)
    except Exception:
        pass

    select_best(label_control(page, "Country"), ["Guyana"], "Country")
    select_best(label_control(page, "Region"), ["Latin America", "South America", "Americas"], "Region")
    select_best(
        label_control(page, "Industry expertise"),
        ["Mining", "Natural Resources", "Energy & Natural Resources", "Energy", "Industrials", "Industrial"],
        "Industry expertise",
    )
    choose_compensation_privacy_first(label_control(page, "Current/most recent total cash compensation in USD"))
    select_best(
        label_control(page, "Current/most recent discipline"),
        ["Corporate Affairs", "Government Relations", "External Affairs", "ESG", "Sustainability", "General Management"],
        "Current/most recent discipline",
    )
    select_best(
        label_control(page, "How did you find out about N2Growth"),
        ["Internet Search", "Online Search", "Web Search", "Google", "Other"],
        "How found N2Growth",
    )

    # Comments
    try:
        label_control(page, "Comments").fill(COMMENTS)
    except Exception:
        textarea = page.locator("textarea").first
        if textarea.count():
            textarea.fill(COMMENTS)

    # Resume upload
    file_input = page.locator('input[type="file"]').first
    if not file_input.count():
        raise RuntimeError("Resume file input not found.")
    file_input.set_input_files(str(CV_PDF))
    print("RESUME_ATTACHED")

    # Required consent, marketing stays off.
    consent = page.get_by_label(re.compile(r"I have read.*data processing.*consent", re.I))
    if not consent.count():
        # Fallback: checkbox nearest the consent text.
        text = page.get_by_text(re.compile(r"I have read the information on.*data processing", re.I)).first
        if text.count():
            consent = text.locator("xpath=..//input[@type='checkbox']").first
    if not consent.count():
        raise RuntimeError("Required data-processing consent checkbox not found.")
    consent.check()

    marketing = page.get_by_label(re.compile(r"Receive marketing communications", re.I))
    if marketing.count() and marketing.is_checked():
        marketing.uncheck()

    # Check HTML validity before submission.
    invalid = page.locator(":invalid")
    if invalid.count():
        bad = []
        for i in range(min(invalid.count(), 15)):
            el = invalid.nth(i)
            bad.append({
                "name": el.get_attribute("name"),
                "id": el.get_attribute("id"),
                "validation": el.evaluate("el => el.validationMessage"),
            })
        raise RuntimeError(f"FORM_INVALID_BEFORE_SUBMIT: {json.dumps(bad)}")

    submit_button = page.get_by_role("button", name=re.compile(r"^Submit$", re.I))
    if not submit_button.count():
        submit_button = page.locator('input[type="submit"]').first
    if not submit_button.count():
        raise RuntimeError("Submit button not found.")

    submit_button.click()
    page.wait_for_timeout(2500)
    try:
        page.wait_for_load_state("networkidle", timeout=20_000)
    except Exception:
        pass

    body = normalize(page.locator("body").inner_text())
    success_patterns = [
        r"thank you",
        r"submission.*received",
        r"successfully submitted",
        r"professional experience.*registered",
        r"we.*received.*resume",
    ]
    if any(re.search(p, body, re.I) for p in success_patterns):
        print(f"N2GROWTH_SUBMISSION_CONFIRMED url={page.url}")
        return

    # Gravity Forms often renders field errors inline after a failed submit.
    errors = page.locator(".gfield_validation_message, .validation_message, .gform_validation_errors, [role='alert']")
    error_texts = [normalize(x) for x in errors.all_inner_texts() if normalize(x)]
    if error_texts:
        raise RuntimeError(f"SUBMISSION_NOT_CONFIRMED validation_errors={error_texts}")

    raise RuntimeError(
        "SUBMISSION_NOT_CONFIRMED: submit action completed, but no success message was detected. "
        f"Current URL: {page.url}"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["inspect", "submit"], required=True)
    args = parser.parse_args()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 1200},
            locale="en-US",
            timezone_id="America/Guyana",
        )
        page = context.new_page()
        page.goto(FORM_URL, wait_until="domcontentloaded", timeout=90_000)
        page.wait_for_timeout(1500)
        print(f"FORM_LOADED url={page.url} title={page.title()}")
        print_select_options(page)
        if args.mode == "submit":
            submit(page)
        context.close()
        browser.close()


if __name__ == "__main__":
    main()
