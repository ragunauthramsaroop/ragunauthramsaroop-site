"""Build the single render-blocking homepage stylesheet from maintained, homepage-only CSS sources.

Preserves selector order, media queries and authoring source files.
Removes comments / unnecessary CSS formatting and converts numeric rgba colours
to CSS Color 4 equivalent #RRGGBBAA values (8-bit alpha rounding).
Requires Python 3.12; no additional build dependencies.
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
LAYERS = (
    "assets/home-flagship-editorial-2026.css",
    "assets/home-signature-2026.css",
    "assets/flagship-system-2026.css",
    "assets/speaking-home.css",
    "assets/home-cinematic-2026.css",
)
OUTPUT = ROOT / "assets/home-compiled-2026.css"
RGBA = re.compile(r"rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0?\.\d+|1(?:\.0+)?|0)\s*\)", re.I)


def compact_rgba(match: re.Match[str]) -> str:
    red, green, blue = (int(match.group(x)) for x in (1, 2, 3))
    alpha = float(match.group(4))
    if any(v > 255 for v in (red, green, blue)) or not 0 <= alpha <= 1:
        return match.group(0)
    opacity = math.floor(alpha * 255 + .5)
    return f"#{red:02x}{green:02x}{blue:02x}{opacity:02x}"


def compile_css() -> str:
    def homepage_layer(path: str) -> str:
        source = (ROOT / path).read_text("utf-8")
        if path == "assets/flagship-system-2026.css":
            # Secondary executive routes still load the complete standalone stylesheet.
            # Do not ship their unused selectors in the homepage critical CSS.
            section_start = "/* Recruiter editorial dossier. */"
            mobile_start = "/* Executive first-screen fit. */"
            if section_start not in source or mobile_start not in source:
                raise ValueError("Flagship CSS section markers changed")
            source = source.split(section_start, 1)[0] + source.split(mobile_start, 1)[1].join([mobile_start, ""])
        return source

    source = "\n\n".join(homepage_layer(path) for path in LAYERS)
    # This set of reviewed local CSS sources contains no comments within
    # string literals or whitespace-sensitive quoted text.
    compact = re.sub(r"/\*[\s\S]*?\*/", "", source)
    compact = re.sub(r"\s*\n\s*", "", compact)
    compact = re.sub(r"\s*([{};:,])\s*", r"\1", compact)
    compact = compact.replace(";}", "}")
    compact = RGBA.sub(compact_rgba, compact)
    return compact + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if generated CSS is stale")
    parser.add_argument("--write", action="store_true", help="Compile and save CSS")
    args = parser.parse_args()
    if args.check and args.write:
        parser.error("Select exactly one of --check or --write")
    expected = compile_css()
    if len(expected.encode("utf-8")) > 75000:
        raise SystemExit(f"FAIL compiled homepage CSS exceeded 75 KB: {len(expected)} bytes")
    if args.check or not args.write:
        if not OUTPUT.exists() or OUTPUT.read_text("utf-8") != expected:
            raise SystemExit("FAIL compiled CSS differs from all four maintained source layers; run --write")
        print(f"PASS: all four CSS layers compiled in order, {len(expected):,} bytes")
    else:
        OUTPUT.write_text(expected, encoding="utf-8")
        print(f"WROTE {OUTPUT.relative_to(ROOT)}, {len(expected):,} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
