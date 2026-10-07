"""Run offline coach regression via dukpy (no Node required)."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    try:
        import dukpy
    except ImportError:
        print("Install dukpy first: py -3 -m pip install dukpy")
        return 2

    src = (ROOT / "lib" / "coach-engine.js").read_text(encoding="utf-8")
    src = src.replace("export const", "const").replace("export function", "function")
    src = re.sub(r"^export\s+", "", src, flags=re.M)

    cases = json.loads((ROOT / "tests" / "regression.json").read_text(encoding="utf-8"))
    passed = 0
    for c in cases:
        code = (
            src
            + "\n"
            + f"coachOffline({json.dumps(c['input'])});"
        )
        try:
            r = dukpy.evaljs(code)
        except Exception as err:
            print(f"FAIL {c['id']} eval error: {err}")
            continue
        if not isinstance(r, dict):
            print(f"FAIL {c['id']} bad result type {type(r)}")
            continue
        fills = r.get("fill_hints") or []
        blob = f"{r.get('prompt') or ''}\n{r.get('corrected_request') or ''}\n" + "\n".join(
            str(x) for x in fills
        )
        blob_l = blob.lower()
        missing = [w for w in c.get("must_include") or [] if w.lower() not in blob_l]
        leaked = [w for w in c.get("must_exclude") or [] if w.lower() in blob_l]
        slots = r.get("slots") or {}
        scen = slots.get("scenario") if isinstance(slots, dict) else None
        scenario_ok = not c.get("scenario") or scen == c.get("scenario")
        ok = not missing and not leaked and scenario_ok
        if ok:
            passed += 1
        else:
            print(
                f"FAIL {c['id']} scen={scen!r} expected={c.get('scenario')!r} "
                f"missing={missing} leaked={leaked}"
            )
            print((r.get("prompt") or "")[:500])
            print("---")
    print(f"{passed}/{len(cases)} passed")
    return 0 if passed == len(cases) else 1


if __name__ == "__main__":
    sys.exit(main())
