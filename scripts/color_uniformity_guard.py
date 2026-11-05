from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
canonical={"#10261f","#33473d","#5d6f68","#0b2a21","#123b2f","#2d6a4c","#f6f4ee","#ece9e0","#ffffff","#fbfaf6","#d9ddd7","#cbd3cd","#b58b45","#d6b878","#d0a354"}
targets=["assets/home.css","assets/platform.css","tools/assets/tools.css","tools/assets/launcher.css","assets/accessibility.css","assets/theme-uniform.css"]
errors=[]
for rel in targets:
    p=ROOT/rel
    if not p.exists():
        errors.append(f"missing {rel}")
        continue
    s=p.read_text(encoding="utf-8",errors="replace")
    if rel=="assets/theme-uniform.css":
        for key in ("--rr-forest:#0b2a21","--rr-paper:#f6f4ee","--rr-gold:#b58b45","--rr-line:#d9ddd7"):
            if key not in s: errors.append(f"theme token missing in {rel}: {key}")
home=(ROOT/"index.html").read_text(encoding="utf-8",errors="replace")
if "/assets/home-compiled-2026.css?v=1" not in home:
    errors.append("dedicated homepage theme missing from index.html")
for rel in ("resume.html","research-library/index.html"):
    s=(ROOT/rel).read_text(encoding="utf-8",errors="replace")
    if "/assets/theme-uniform.css" not in s:
        errors.append(f"canonical theme missing from {rel}")
for rel in ("assets/platform.js",):
    s=(ROOT/rel).read_text(encoding="utf-8",errors="replace")
    if "/assets/theme-uniform.css" not in s:
        errors.append("platform loader does not inject canonical theme")
if errors:
    for e in errors: print("FAIL",e)
    raise SystemExit(1)
print("PASS canonical color theme tokens and coverage")
