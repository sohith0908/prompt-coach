"""
Build installable packages for Chromium browsers and Firefox.

  py -3 scripts/package.py

Outputs:
  dist/chromium/
  dist/firefox/
  dist/prompt-coach-chromium.zip
  dist/prompt-coach-firefox.zip
"""
from __future__ import annotations

import json
import shutil
import sys
import zipfile
from pathlib import Path
from subprocess import check_call

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"

INCLUDE = [
    "manifest.json",
    "README.md",
    "BROWSERS.md",
    "background/service-worker.js",
    "lib/browser-api.js",
    "lib/browser-api.iife.js",
    "lib/coach-engine.js",
    "content/panel-app.js",
    "content/panel.css",
    "content/mount.js",
    "content/boot.js",
    "pages/blocked.html",
    "pages/blocked.js",
    "pages/blocked.css",
    "icons/icon16.png",
    "icons/icon48.png",
    "icons/icon128.png",
]


def load_manifest() -> dict:
    return json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))


def firefox_manifest(base: dict) -> dict:
    m = json.loads(json.dumps(base))
    m["browser_specific_settings"] = {
        "gecko": {
            "id": "prompt-coach@local",
            "strict_min_version": "121.0",
        },
        "gecko_android": {
            "strict_min_version": "121.0",
        },
    }
    m["host_permissions"] = [
        "https://generativelanguage.googleapis.com/*",
        "https://api.groq.com/*",
        "http://*/*",
        "https://*/*",
    ]
    m.pop("optional_host_permissions", None)
    return m


def copy_tree(dest: Path, manifest: dict) -> None:
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)

    for rel in INCLUDE:
        src = ROOT / rel
        if not src.exists():
            raise FileNotFoundError(src)
        out = dest / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, out)

    (dest / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


def zip_dir(folder: Path, zip_path: Path) -> None:
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(folder.rglob("*")):
            if path.is_file():
                zf.write(path, path.relative_to(folder).as_posix())


def main() -> None:
    check_call([sys.executable, str(ROOT / "scripts" / "build-panel-app.py")])

    DIST.mkdir(exist_ok=True)
    base = load_manifest()

    chromium_dir = DIST / "chromium"
    firefox_dir = DIST / "firefox"
    copy_tree(chromium_dir, base)
    copy_tree(firefox_dir, firefox_manifest(base))

    zip_dir(chromium_dir, DIST / "prompt-coach-chromium.zip")
    zip_dir(firefox_dir, DIST / "prompt-coach-firefox.zip")

    print(f"chromium -> {chromium_dir}")
    print(f"firefox  -> {firefox_dir}")
    print(f"zips     -> {DIST / 'prompt-coach-chromium.zip'}")
    print(f"         -> {DIST / 'prompt-coach-firefox.zip'}")


if __name__ == "__main__":
    main()
