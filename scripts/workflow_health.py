from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"

MINIMUM_MAJOR = {
    # These are the oldest approved major versions used by the repository.
    # Newer working majors, including v7, are allowed.
    "actions/checkout": 4,
    "actions/setup-python": 5,
    "actions/setup-node": 4,
    "actions/upload-artifact": 4,
}

errors = []
checked = 0
for path in sorted(WORKFLOWS.glob("*.y*ml")):
    checked += 1
    text = path.read_text(encoding="utf-8", errors="replace")

    for action, minimum in MINIMUM_MAJOR.items():
        # Only actual uses: declarations, not comments or examples.
        pattern = rf"(?m)^\\s*(?:-\\s*)?uses:\\s*{re.escape(action)}@v(\\d+)\\b"
        for major in map(int, re.findall(pattern, text)):
            if major < minimum:
                errors.append(
                    f"{path.relative_to(ROOT)} uses {action}@v{major}; "
                    f"minimum approved version is v{minimum}"
                )

    if "ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION" in text:
        errors.append(
            f"{path.relative_to(ROOT)} opts into an insecure deprecated Node runtime"
        )

    for ref in re.findall(
        r"uses:\s*(actions/(?:checkout|setup-python|setup-node|upload-artifact)@v\d+)",
        text,
    ):
        if ref.endswith(("@v1", "@v2", "@v3")):
            errors.append(f"{path.relative_to(ROOT)} uses obsolete action {ref}")

if errors:
    for error in errors:
        print("FAIL", error)
    raise SystemExit(1)

print(f"PASS {checked} workflows use supported GitHub-hosted action runtimes")
