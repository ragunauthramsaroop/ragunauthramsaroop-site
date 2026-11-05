#!/usr/bin/env python3
"""Flagship visual hierarchy, factual restraint and accessible conversion routes."""
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]
home=(ROOT/"index.html").read_text(encoding="utf-8")
css=(ROOT/"assets/home-flagship-editorial-2026.css").read_text(encoding="utf-8")
class Page(HTMLParser):
    def __init__(self):
        super().__init__();self.h1=0;self.links=[];self.images=[];self.ids=set()
    def handle_starttag(self,tag,attrs):
        data=dict(attrs)
        if tag=="h1":self.h1+=1
        if tag=="a":self.links.append(data.get("href"))
        if tag=="img":self.images.append(data)
        if data.get("id"):self.ids.add(data["id"])
def html_count(source,fragment):return source.count(fragment)
page=Page();page.feed(home)
assert page.h1==1
assert "hero-name" in page.ids and "mandate-fit-title" in page.ids and "executive-desk-title" in page.ids
assert all(f'flag-{name}' in home for name in ("hero","pathways","expertise","evidence","audiences","research","close"))
assert "/assets/home-flagship-editorial-2026.css?v=1" in home
assert len(home.encode("utf-8"))<25000
for target in ("/resume.html","/executive-profile/","/recruiter-mode/","/recruiter-toolkit/","/board-ceo-mode/","/engage/","/proof-in-practice/","/media/","/public-record/","/research-library/","/guyana-intelligence/","/insights/aurora-operating-context/"):
    assert target in page.links, "Executive audience route omitted: "+target
for fact in ("Director since 2025","12+","Financial services and natural resources","Ragunauth"):
    assert fact in home, "Personal career fact missing: "+fact
assert "49.4" not in home and "10,000" not in home and "89%" not in home, "Employer operating metrics must stay off personal homepage"
assert any(img.get("class")=="portrait" and img.get("fetchpriority")=="high" and img.get("alt") for img in page.images)
assert "Oxford domain. Not a claim of university employment" in home
# The profile must differentiate an active professional appointment, two ambassador
# records with different dates, and an independently published UNGIS membership.
hero=home.split('<aside class="flag-hero__profile"',1)[1].split("</aside>",1)[0]
assert 'Current appointment' in hero and 'Director since 2025' in hero
assert 'International roles &amp; affiliations' in hero
assert 'Member, UNGIS Multistakeholder Consultation Group' in hero
assert 'Private Sector · 2026' in hero and 'https://www.itu.int/net4/wsis/ungis/Home/MCG' in hero
assert 'Ambassador, International Organization of Youth' in hero and 'Guyana · 2026–2027' in hero
assert 'Ambassador, Sustainable Procurement Pledge' in hero and '2019 · Historical appointment' in hero
# Direct mandate enquiries should not depend on a LinkedIn account or a third-party contact form.
cv=(ROOT/"resume.html").read_text(encoding="utf-8")
public_email="ragunauthramsaroop@icloud.com"
assert f"mailto:{public_email}" in cv, "Homepage email must match the public CV"
assert sum(link.startswith(f"mailto:{public_email}") for link in page.links if link)>=3, "Direct professional contact path lost"
assert 'href="/engage/"' in home, "Detailed engagement pathway must remain available"
assert "Director since 2025" in home and "2026–Present" in cv, "Director-level appointment and named 2026 role should remain distinct"

# The recruiter destination must use the lightweight editorial shell rather than a legacy hydrating bundle.
toolkit=(ROOT/"recruiter-toolkit/index.html").read_text(encoding="utf-8")
toolkit_css=(ROOT/"assets/executive-recruiter-2026.css").read_text(encoding="utf-8")
toolkit_js=(ROOT/"assets/executive-recruiter-2026.js").read_text(encoding="utf-8")
toolkit_page=Page();toolkit_page.feed(toolkit)
assert toolkit_page.h1==1, "Recruiter toolkit must have a single page heading"
assert all(x in toolkit_page.ids for x in ("main","mandates","career","interview","contact","rr-short-bio")), "Recruiter sections missing"
assert all(x in toolkit_page.links for x in ("/resume.html","/public-record/","/proof-in-practice/","/board-ceo-mode/","/research-library/","/media/","/engage/")), "Recruiter evidence route missing"
assert any((link or "").startswith("mailto:ragunauthramsaroop@icloud.com") for link in toolkit_page.links), "Recruiter must offer direct professional contact"
assert "/assets/randy-portrait.jpg" in toolkit and 'alt="Professional portrait of Ragunauth Ramsaroop"' in toolkit
assert "/assets/executive-recruiter-2026.css" in toolkit and "/assets/executive-recruiter-2026.js" in toolkit
assert "_next/static" not in toolkit and 'id="__NEXT_DATA__"' not in toolkit, "Legacy client bundle must not hydrate replacement HTML"
assert "navigator.clipboard.writeText" in toolkit_js and "window.print()" in toolkit_js, "Local print and biography copy actions missing"
assert "@media print" in toolkit_css and "@media(max-width:530px)" in toolkit_css, "Missing mobile and print styles"
assert "company-wide results" in toolkit.lower() and "first-party" in toolkit.lower(), "Evidence attribution safeguards missing"
public_record=(ROOT/"public-record/index.html").read_text(encoding="utf-8")
assert "2026 onward" in public_record and "appointment began in 2025" in public_record, "Public record current named role date has drifted"
for language in ("es","pt","fr"):
    localized=(ROOT/"public-record"/language/"index.html").read_text(encoding="utf-8")
    assert "2025" in localized and "2026" in localized, "Role chronology missing in multilingual public record: "+language

# Signature design assets must stay first-party, light and responsive.
signature=(ROOT/"assets/home-signature-2026.css").read_text(encoding="utf-8")
art=(ROOT/"assets/executive-orbit-2026.svg").read_text(encoding="utf-8")
assert '/assets/home-signature-2026.css?v=2' in home, "Signature stylesheet missing"
assert 'class="flag-hero__orbit"' in home and '/assets/executive-orbit-2026.svg' in home, "Original portrait geometry missing"
assert 'aria-hidden="true"' in home and 'alt=""' in home, "Decorative line art must remain hidden from screen readers"
assert '<svg' in art and 'xmlns="http://www.w3.org/2000/svg"' in art, "Original artwork invalid"

system_art=(ROOT/"assets/executive-leadership-system.svg").read_text(encoding="utf-8")
assert 'class="flag-position__system"' in home and 'src="/assets/executive-leadership-system.svg"' in home, "Leadership system graphic missing"
assert 'alt="Three connected leadership disciplines: institutions, responsibility and execution"' in home
assert "loading=\"lazy\"" in home and "width=\"600\"" in home, "Conceptual graphic needs intrinsic dimensions and lazy loading"
assert "INSTITUTIONS" in system_art and "RESPONSIBILITY" in system_art and "EXECUTION" in system_art
assert "<script" not in system_art and 'href="http' not in system_art and 'xlink:href="http' not in system_art and len(system_art.encode("utf-8"))<4000, "SVG must remain safe and lightweight"
assert ".flag-position__system" in signature and "grid-template-columns:1fr" in signature, "Responsive concept graphic styling absent"

assert '@media(max-width:530px)' in signature and '@media(prefers-reduced-motion:reduce)' in signature, "Signature mobile and reduced-motion safeguards absent"
assert len(signature.encode("utf-8"))<20000 and len(art.encode("utf-8"))<4000, "Decorative layer exceeds lightweight design budget"
assert 'http' not in signature and '@import' not in signature, "Signature styling must not load remote dependencies"

assert "prefers-reduced-motion" in css and "@media(max-width:530px)" in css
assert html_count(home, "<main")==1 and html_count(home, "</main>")==1
for resource in ("/board-ceo-mode/", "/executive-perspectives/", "/guyana-intelligence/", "/decision-room/", "/recruiter-toolkit/", "/observatory/"):
    assert resource in page.links, "CEO or recruiter resource missing: "+resource
assert home.index('id="decision-paths"') < home.index('id="position-title"'), "Audience gateway must precede biography"
assert "CEO needs a clear strategic perspective" in home and "recruiter needs a fast, credible evaluation" in home
assert "confidential information" in home and "Not a claim of university employment" in home
# Privacy UI must not obstruct first-screen navigation or mandate actions on mobile.
consent=(ROOT/"tools/assets/analytics-consent.css").read_text(encoding="utf-8")
assert "@media(max-width:760px)" in consent and "position:static" in consent and "grid-template-columns:minmax(0,1fr) auto" in consent, "Consent must remain non-obstructive on desktop and mobile"
assert "min-height:44px" in consent and "#rr-analytics-choice" in consent, "Mobile opt-in touch controls must be accessible"

assert "backdrop-filter" not in css and "url(http" not in css
print("PASS premium executive hierarchy, attributed evidence, source-bound claims, mobile responsiveness and key actions")
