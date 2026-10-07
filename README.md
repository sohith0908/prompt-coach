# Prompt Coach

Browser extension that turns a messy idea into a **copy-ready AI prompt**.  
Floating panel on any page (including ChatGPT / Claude).

The coach **never answers your topic**. It only writes the prompt. You paste that prompt into ChatGPT, Claude, Gemini, or any other AI.

## Install (all browsers)

**Chrome / Edge / Brave / Opera / Vivaldi** — load the Chromium package.  
**Firefox** — load the Firefox package.  
**Safari** — convert the Chromium package on a Mac (see [BROWSERS.md](BROWSERS.md)).

```text
py -3 scripts/package.py
```

Then:

| Browser | Open | Load |
|---|---|---|
| Chrome | `chrome://extensions` | `dist/chromium` |
| Edge | `edge://extensions` | `dist/chromium` |
| Brave | `brave://extensions` | `dist/chromium` |
| Opera | `opera://extensions` | `dist/chromium` |
| Firefox | `about:debugging#/runtime/this-firefox` | `dist/firefox/manifest.json` (temporary) |

Or load the repo root unpacked in any Chromium browser (same as `dist/chromium`). Full steps: [BROWSERS.md](BROWSERS.md).

Shortcut: `Alt+Shift+P`.

### Gemini API key (recommended)

1. Get a free key: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Open Prompt Coach → ⚙ Settings
3. Provider: **Gemini** (default)
4. Paste key → Model **Fast** or **Stronger** → Save

Without a key, the **local coach** still builds prompts from slot extraction + scenario templates. Local drafts show a warning when confidence is low.

Optional: Settings → Provider **Groq** if you prefer a Groq key instead.

## How to use

1. Type something messy: `make ai write mail to landlord heater broken 3 weeks he ignore me firm not rude`
2. Click **Make detailed prompt** (or Ctrl/Cmd+Enter).
3. Read **Understood**, refine answers if offered, then **Copy**.
4. Paste into ChatGPT / Claude / Gemini.

Extras:

- History (◷) keeps the last prompts in this browser.
- Highlight text → right-click → **Turn selection into a prompt**.
- Tweak chips: shorter, more formal, image prompt, etc.

## How the coach stays faithful to your words

1. **Scored intent** — picks write / code / video / translate / … by weighted signals (not first-regex-wins).
2. **Channel** — email vs WhatsApp vs LinkedIn vs chat (so roommate texts are not formal emails).
3. **Scenario pick** — complaint / follow-up / apology / deadline / assignment extension / customer reply / LOR / resume / …
4. **Known facts** — always includes `Situation: …` with your cleaned facts.
5. **Placeholders** — only missing slots for *that* scenario (landlord ≠ boss/deadline).
6. **Validation + harden** — drops unrelated tokens; if the online model finishes the task or leaks fields, local rebuild wins.
7. **Gemini structured JSON** — `responseSchema` + one retry on bad JSON.

### Rebuild the classic panel bundle

After editing `content/mount.js` or `content/panel.css`:

```text
py -3 scripts/build-panel-app.py
```

### Regression

```text
py -3 -m pip install dukpy
py -3 scripts/run_regression.py
```

Or open `tests/run-regression.html` in a browser.

## Modes

| Badge | Meaning |
|---|---|
| `Local` | Offline slot + template engine |
| `Ready` | Gemini/Groq key saved |
| `Coach` | Online rewrite (Gemini by default) |

Online uses Gemini Flash-Lite (Fast) or Gemini Flash (Stronger), JSON output, short timeout. If the API fails, it falls back to local.

## Project layout

```text
manifest.json
background/service-worker.js   # Gemini/Groq + history + inject
content/panel-app.js           # classic inject (ChatGPT/Claude safe)
content/mount.js + panel.css   # panel UI
lib/coach-engine.js            # slots, templates, validation, system prompt
pages/blocked.html             # restricted-page message
tests/regression.json          # regression cases
tests/run-regression.html      # open in browser to score local mode
icons/
```

## Tests

Open `tests/run-regression.html` in a browser (serve the folder if needed).

Critical cases include landlord/heater (no boss/deadline), “support writing a blog” (not support-desk), and angry customer reply (brand reply, not client request).

## Privacy

- API key stays in `chrome.storage.local` on your browser.
- With a Gemini key, only the text you submit is sent to Google’s Gemini API.
- Local mode never leaves your machine.
- Do not commit API keys to GitHub. Do not ship a shared build with your key inside.

## Publish later

- Chrome Web Store / Edge Add-ons (upload `dist/prompt-coach-chromium.zip`)
- Firefox AMO (upload `dist/prompt-coach-firefox.zip`, change the gecko id if you want a permanent public listing)
- Safari: convert with `safari-web-extension-converter` on macOS, then App Store

Until then, **Load unpacked** / temporary add-on is enough.
