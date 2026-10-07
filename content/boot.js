(() => {
  if (window.__promptCoachBooted) return;
  window.__promptCoachBooted = true;

  const ext =
    globalThis.browser?.runtime?.id != null
      ? globalThis.browser
      : globalThis.chrome;

  let ready = null;

  function ensure() {
    if (!ready) {
      ready = import(ext.runtime.getURL("content/mount.js")).then(async (mod) =>
        mod.mountPanel({
          coach(payload) {
            return ext.runtime.sendMessage({ type: "PC_COACH", ...payload });
          },
          getSettings() {
            return ext.runtime.sendMessage({ type: "PC_GET_SETTINGS" });
          },
          saveSettings(settings) {
            return ext.runtime.sendMessage({ type: "PC_SAVE_SETTINGS", settings });
          },
          getHistory() {
            return ext.runtime.sendMessage({ type: "PC_GET_HISTORY" });
          },
          clearHistory() {
            return ext.runtime.sendMessage({ type: "PC_CLEAR_HISTORY" });
          },
          dismissOnboarding() {
            return ext.runtime.sendMessage({ type: "PC_DISMISS_ONBOARDING" });
          },
          getPanelPos() {
            return ext.runtime.sendMessage({ type: "PC_GET_PANEL_POS" });
          },
          savePanelPos(pos) {
            return ext.runtime.sendMessage({ type: "PC_SAVE_PANEL_POS", pos });
          }
        })
      );
    }
    return ready;
  }

  ext.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "PC_TOGGLE") {
      ensure()
        .then((panel) => panel.toggle())
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }
    if (message?.type === "PC_OPEN_WITH_TEXT") {
      ensure()
        .then((panel) => panel.openWithText(message.text || ""))
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }
    return false;
  });
})();
