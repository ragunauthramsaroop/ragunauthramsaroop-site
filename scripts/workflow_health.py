from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"

REQUIRED_EXACT = {
    "actions/checkout": "v7",
    "actions/setup-python": "v7",
    "actions/setup-node": "v7",
}

MINIMUM_MAJOR = {
    "actions/upload-artifact": 4,
}

errors = []
checked = 0
for path in sorted(WORKFLOWS.glob("*.y*ml")):
    checked += 1
    text = path.read_text(encoding="utf-8", errors="replace")

    for action, version in REQUIRED_EXACT.items():
        for found in re.findall(rf"{re.escape(action)}@(v\d+)", text):
            if found != version:
                errors.append(
                    f"{path.relative_to(ROOT)} uses {action}@{found}; required {action}@{version}"
                )

    for action, minimum in MINIMUM_MAJOR.items():
        for found in re.findall(rf"{re.escape(action)}@v(\d+)", text):
            if int(found) < minimum:
                errors.append(
                    f"{path.relative_to(ROOT)} uses {action}@v{found}; minimum supported major is v{minimum}"
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
