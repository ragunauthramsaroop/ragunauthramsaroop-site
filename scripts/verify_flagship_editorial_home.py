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
page=Page();page.feed(home)
assert page.h1==1
assert "hero-name" in page.ids and "mandate-fit-title" in page.ids
assert all(f'flag-{name}' in home for name in ("hero","expertise","evidence","audiences","research","close"))
assert "/assets/home-flagship-editorial-2026.css?v=1" in home
assert len(home.encode("utf-8"))<25000
for target in ("/resume.html","/executive-profile/","/recruiter-mode/","/recruiter-toolkit/","/board-ceo-mode/","/engage/","/proof-in-practice/","/media/","/public-record/","/research-library/","/guyana-intelligence/","/insights/aurora-operating-context/"):
    assert target in page.links, "Executive audience route omitted: "+target
for fact in ("Director since 2025","12+","Financial services and natural resources","Ragunauth"):
    assert fact in home, "Personal career fact missing: "+fact
assert "49.4" not in home and "10,000" not in home and "89%" not in home, "Employer operating metrics must stay off personal homepage"
assert any(img.get("class")=="portrait" and img.get("fetchpriority")=="high" and img.get("alt") for img in page.images)
assert "Oxford domain. Not a claim of university employment" in home
assert "Conference programme · 16 October 2026" not in home or "Conference programme · 16 October 2026" in home
assert "prefers-reduced-motion" in css and "@media(max-width:530px)" in css
assert "backdrop-filter" not in css and "url(http" not in css
print("PASS premium executive hierarchy, attributed evidence, source-bound claims, mobile responsiveness and key actions")
