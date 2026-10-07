from pathlib import Path

root = Path(__file__).resolve().parents[1]
css = (root / "content" / "panel.css").read_text(encoding="utf-8")
mount = (root / "content" / "mount.js").read_text(encoding="utf-8")
shim = (root / "lib" / "browser-api.iife.js").read_text(encoding="utf-8")
mount = mount.replace(
    "export async function mountPanel(adapters)",
    "async function mountPanel(adapters)",
)
mount = mount.replace(
    'const css = await fetch(new URL("./panel.css", import.meta.url)).then((r) => r.text());',
    'const css = window.__PC_CSS || "";',
)

out = f"""/* Classic content script — Chrome / Edge / Brave / Opera / Firefox safe. */
(function () {{
  if (window.__promptCoachBooted) return;
  window.__promptCoachBooted = true;

{shim}

  const ext = getExtApi();
  window.__PC_CSS = {css!r};

{mount}

  const adapters = {{
    coach(payload) {{
      return ext.runtime.sendMessage({{ type: "PC_COACH", ...payload }});
    }},
    getSettings() {{
      return ext.runtime.sendMessage({{ type: "PC_GET_SETTINGS" }});
    }},
    saveSettings(settings) {{
      return ext.runtime.sendMessage({{ type: "PC_SAVE_SETTINGS", settings }});
    }},
    getHistory() {{
      return ext.runtime.sendMessage({{ type: "PC_GET_HISTORY" }});
    }},
    clearHistory() {{
      return ext.runtime.sendMessage({{ type: "PC_CLEAR_HISTORY" }});
    }},
    dismissOnboarding() {{
      return ext.runtime.sendMessage({{ type: "PC_DISMISS_ONBOARDING" }});
    }},
    getPanelPos() {{
      return ext.runtime.sendMessage({{ type: "PC_GET_PANEL_POS" }});
    }},
    savePanelPos(pos) {{
      return ext.runtime.sendMessage({{ type: "PC_SAVE_PANEL_POS", pos }});
    }}
  }};

  let apiPromise = null;
  function ensure() {{
    if (!apiPromise) apiPromise = mountPanel(adapters);
    return apiPromise;
  }}

  ext.runtime.onMessage.addListener((message, _sender, sendResponse) => {{
    if (message && message.type === "PC_TOGGLE") {{
      ensure()
        .then((panel) => panel.toggle())
        .then(() => sendResponse({{ ok: true }}))
        .catch((err) => sendResponse({{ ok: false, error: String(err) }}));
      return true;
    }}
    if (message && message.type === "PC_OPEN_WITH_TEXT") {{
      ensure()
        .then((panel) => panel.openWithText(message.text || ""))
        .then(() => sendResponse({{ ok: true }}))
        .catch((err) => sendResponse({{ ok: false, error: String(err) }}));
      return true;
    }}
    return false;
  }});
}})();
"""

target = root / "content" / "panel-app.js"
target.write_text(out, encoding="utf-8")
print(f"wrote {target} ({len(out)} bytes)")
