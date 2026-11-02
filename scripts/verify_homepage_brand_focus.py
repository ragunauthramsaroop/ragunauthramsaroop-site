#!/usr/bin/env python3
"""Protect personal homepage focus while preserving source-dated operating context."""
from pathlib import Path
from html.parser import HTMLParser
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
home=(ROOT/"index.html").read_text(encoding="utf-8")
article=(ROOT/"insights/aurora-operating-context/index.html").read_text(encoding="utf-8")
css=(ROOT/"assets/home-executive-20260930-v3.css").read_text(encoding="utf-8")
assert 'class="mandate-stats"' not in home, "Corporate KPIs returned to personal homepage"
assert 'class="mandate-context"' not in home, "Corporate KPI panel returned to personal homepage"
assert all(v not in home for v in ("49.4 <span>MW", "10,000 <span>t/day", "89<span>%")), "Company numbers presented as personal homepage headlines"
assert 'href="/insights/aurora-operating-context/"' in home, "Company facts lack contextual article pathway"
assert 'research-article-link' in css and ".mandate-stats" not in css, "Unused corporate KPI styling remains"
for value in ("49.4 MW", "10,000 tonnes", "89% Guyanese"):
    assert value in article, f"Article missing documented company figure: {value}"
for source in ("en.zijingoldintl.com/news/companynews-detail-410.htm", "en.zijingoldintl.com/global/saprogram-detail-71993.htm", "www.zijinmining.com/news/news-detail-122826.htm"):
    assert source in article, f"Company source missing: {source}"
assert "Operating context is not personal credit." in article
assert "independently audited" in article and "analytics-loader.js" in article
class Scan(HTMLParser):
    def __init__(self):
        super().__init__();self.h1=0;self.canonical=None;self.link=None
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=="h1":self.h1+=1
        if tag=="link" and a.get("rel")=="canonical":self.canonical=a.get("href")
s=Scan();s.feed(article)
assert s.h1==1 and s.canonical=="https://ragunauthramsaroop.com/insights/aurora-operating-context/", "Publication heading/canonical invalid"
root=ET.parse(ROOT/"sitemap.xml")
assert any(e.text=="https://ragunauthramsaroop.com/insights/aurora-operating-context/" for e in root.iter() if e.tag.rsplit("}",1)[-1]=="loc")
assert "https://ragunauthramsaroop.com/insights/aurora-operating-context/" in (ROOT/"feed.xml").read_text(encoding="utf-8")
print("PASS personal homepage focus and source-dated industrial case article")
