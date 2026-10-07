# Install Prompt Coach on every browser

One codebase. Two packages:

| Package | Browsers |
|---|---|
| **Chromium** (`dist/chromium` or `prompt-coach-chromium.zip`) | Chrome, Edge, Brave, Opera, Vivaldi, Arc, Chromium |
| **Firefox** (`dist/firefox` or `prompt-coach-firefox.zip`) | Firefox Desktop, Firefox Android (Nightly/compatible) |

Build packages from the repo root:

```text
py -3 scripts/package.py
```

---

## Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `dist/chromium` (or the repo folder)

## Microsoft Edge

1. Open `edge://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `dist/chromium`

## Brave

1. Open `brave://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `dist/chromium`

## Opera

1. Open `opera://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `dist/chromium`

## Vivaldi / Arc / other Chromium

Same pattern: Extensions → Developer mode → Load unpacked → `dist/chromium`.

Shortcut on all of the above: `Alt+Shift+P` (may need enabling under keyboard shortcuts).

---

## Firefox (Desktop)

1. Build packages: `py -3 scripts/package.py`
2. Open `about:debugging#/runtime/this-firefox`
3. **Load Temporary Add-on…**
4. Pick `dist/firefox/manifest.json`

Temporary add-ons unload when Firefox restarts. For a lasting install, sign the zip on [addons.mozilla.org](https://addons.mozilla.org/developers/) (self-distribution) or use a Firefox Developer Edition / ESR policy install.

Firefox package id: `prompt-coach@local` (in `browser_specific_settings`).

## Firefox Android

1. Install Firefox Nightly (or a build that allows collecting)
2. Enable remote debugging / collection as Mozilla’s current docs require
3. Load the same `dist/firefox` temporary add-on via desktop debugging, **or** install a signed AMO build

---

## Safari (macOS / iOS)

Safari needs Apple’s converter + Xcode (macOS only). On a Mac:

```bash
xcrun safari-web-extension-converter dist/chromium --project-location ./safari --app-name "Prompt Coach"
```

Then open the generated Xcode project, enable the Safari extension capability, and run/sign with your Apple developer team.

This Windows repo cannot produce a signed `.appex` by itself.

---

## What works the same everywhere

- Floating coach panel on normal websites (ChatGPT, Claude, YouTube, …)
- Gemini / Groq online coach + local offline draft
- History, settings, drag position (stored in extension storage)
- Context menu: **Turn selection into a prompt**
- Blocked page when you open it on `chrome://`, `edge://`, `about:`, stores, etc.

## Notes

- Do **not** test the panel while staying on the Extensions / Add-ons page.
- API keys stay in that browser’s local extension storage (not synced across browsers unless you paste the key again).
- Chromium package uses tighter host permissions + `activeTab`. Firefox package includes broader host permissions so temporary add-on injection is reliable.
