import { ext } from "../lib/browser-api.js";
import {
  COACH_RESPONSE_SCHEMA,
  COACH_SYSTEM,
  INPUT_MAX_CHARS,
  buildUserMessage,
  classifyError,
  coachOffline,
  extractGeminiText,
  getPreset,
  hardenOnlineResult,
  parseCoachJson
} from "../lib/coach-engine.js";

const DEFAULTS = {
  provider: "gemini",
  apiKey: "",
  preset: "faster",
  preferOffline: false,
  onboardingDone: false,
  history: [],
  panelPos: null
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const HISTORY_MAX = 12;
const REQUEST_TIMEOUT_MS = 22000;
const JSON_RETRY = 1;

ext.runtime.onInstalled.addListener(() => {
  Promise.resolve(ext.contextMenus.removeAll())
    .catch(() => {})
    .then(() =>
      ext.contextMenus.create({
        id: "prompt-coach-selection",
        title: "Turn selection into a prompt",
        contexts: ["selection"]
      })
    )
    .catch(() => {});
});

ext.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "prompt-coach-selection" || !tab?.id) return;
  const text = (info.selectionText || "").trim();
  if (!text) return;
  await openPanel(tab, { type: "PC_OPEN_WITH_TEXT", text });
});

ext.action.onClicked.addListener(async (tab) => {
  await openPanel(tab, { type: "PC_TOGGLE" });
});

ext.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-panel") return;
  const tabs = await ext.tabs.query({ active: true, currentWindow: true });
  await openPanel(tabs?.[0], { type: "PC_TOGGLE" });
});

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only accept messages from this extension
  if (sender?.id && sender.id !== ext.runtime.id) return false;

  const map = {
    PC_COACH: () => handleCoach(message),
    PC_GET_SETTINGS: () => getSettings(),
    PC_SAVE_SETTINGS: () => saveSettings(message.settings || {}),
    PC_GET_HISTORY: () => getHistory(),
    PC_CLEAR_HISTORY: () => clearHistory(),
    PC_DISMISS_ONBOARDING: () => dismissOnboarding(),
    PC_GET_PANEL_POS: () => getPanelPos(),
    PC_SAVE_PANEL_POS: () => savePanelPos(message.pos)
  };
  const fn = map[message?.type];
  if (!fn) return false;
  fn()
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
  return true;
});

function isRestrictedUrl(url = "") {
  return (
    /^(chrome|brave|edge|opera|vivaldi|about|chrome-extension|moz-extension|safari-web-extension|devtools|resource):/i.test(
      url
    ) ||
    /chrome\.google\.com\/webstore/i.test(url) ||
    /chromewebstore\.google\.com/i.test(url) ||
    /addons\.mozilla\.org/i.test(url) ||
    /microsoftedge\.microsoft\.com\/addons/i.test(url)
  );
}

async function injectPanel(tabId) {
  const target = { tabId, allFrames: false };
  const files = ["content/panel-app.js"];
  try {
    // Chromium supports world; Firefox may ignore or reject it.
    await ext.scripting.executeScript({ target, files, world: "ISOLATED" });
  } catch {
    await ext.scripting.executeScript({ target, files });
  }
}

async function openPanel(tab, message) {
  if (!tab?.id) {
    await ext.tabs.create({ url: ext.runtime.getURL("pages/blocked.html") });
    return;
  }
  if (isRestrictedUrl(tab.url || "")) {
    await showBlocked(
      "You are on a browser page (chrome:// / edge:// / about: / Extensions). Open YouTube, ChatGPT, or Claude first, then click Prompt Coach."
    );
    return;
  }
  try {
    // Classic script (not ES module) so ChatGPT/Claude CSP cannot block import().
    await injectPanel(tab.id);
    await sendWithRetry(tab.id, message, 6);
  } catch (err) {
    const raw = String(err?.message || err || "");
    const friendly = /chrome:\/\/|about:|moz-extension/i.test(raw)
      ? "Cannot run on browser system pages. Switch to a normal website, then click Prompt Coach."
      : raw || "Could not open Prompt Coach on this page. Reload the tab, then try again.";
    await showBlocked(friendly);
  }
}

async function showBlocked(reason) {
  await ext.tabs.create({
    url: ext.runtime.getURL(`pages/blocked.html?reason=${encodeURIComponent(reason)}`)
  });
}

async function sendWithRetry(tabId, message, tries) {
  let lastErr;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await ext.tabs.sendMessage(tabId, message);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 120 * (i + 1)));
    }
  }
  throw lastErr || new Error("Panel did not respond");
}

async function getSettings() {
  const settings = await ext.storage.local.get(DEFAULTS);
  if (settings.provider !== "groq") settings.provider = "gemini";
  return { ok: true, settings };
}

async function saveSettings(incoming) {
  const next = {
    provider: incoming.provider === "groq" ? "groq" : "gemini",
    apiKey: String(incoming.apiKey || "").trim(),
    preset: incoming.preset === "balanced" ? "balanced" : "faster",
    preferOffline: Boolean(incoming.preferOffline)
  };
  await ext.storage.local.set(next);
  return { ok: true, settings: next };
}

async function dismissOnboarding() {
  await ext.storage.local.set({ onboardingDone: true });
  return { ok: true };
}

async function getPanelPos() {
  const { panelPos } = await ext.storage.local.get({ panelPos: null });
  return { ok: true, pos: panelPos };
}

async function savePanelPos(pos) {
  if (
    !pos ||
    typeof pos.left !== "number" ||
    typeof pos.top !== "number" ||
    Number.isNaN(pos.left) ||
    Number.isNaN(pos.top)
  ) {
    return { ok: false, error: "Bad position" };
  }
  const next = { left: pos.left, top: pos.top };
  await ext.storage.local.set({ panelPos: next });
  return { ok: true, pos: next };
}

async function getHistory() {
  const { history } = await ext.storage.local.get({ history: [] });
  return { ok: true, history: Array.isArray(history) ? history : [] };
}

async function clearHistory() {
  await ext.storage.local.set({ history: [] });
  return { ok: true, history: [] };
}

async function pushHistory(entry) {
  const { history } = await ext.storage.local.get({ history: [] });
  const list = Array.isArray(history) ? history : [];
  const next = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      idea: entry.idea,
      prompt: entry.prompt,
      understood: entry.understood,
      mode: entry.mode,
      shape: entry.shape
    },
    ...list
  ].slice(0, HISTORY_MAX);
  await ext.storage.local.set({ history: next });
  return next;
}

async function handleCoach({
  input,
  tweak = "",
  previousPrompt = "",
  shape = "auto",
  answers = {}
}) {
  let text = String(input || "").trim();
  if (!text) return { ok: false, error: "Type an idea first.", code: "empty_input" };
  const truncated = text.length > INPUT_MAX_CHARS;
  text = text.slice(0, INPUT_MAX_CHARS);

  const settings = await ext.storage.local.get(DEFAULTS);
  const provider = settings.provider === "groq" ? "groq" : "gemini";
  const preset = getPreset(provider, settings.preset);

  if (settings.preferOffline || !settings.apiKey) {
    const result = coachOffline(text, tweak, shape, answers);
    if (truncated) {
      result.notice = [result.notice, `Idea trimmed to ${INPUT_MAX_CHARS} characters.`]
        .filter(Boolean)
        .join(" ");
    }
    if (result.prompt) {
      await pushHistory({
        idea: text,
        prompt: result.prompt,
        understood: result.understood,
        mode: result.mode,
        shape
      });
    }
    return { ok: true, result };
  }

  try {
    let result = await coachOnlineWithRetry(
      provider,
      settings.apiKey,
      preset,
      text,
      tweak,
      previousPrompt,
      shape,
      answers
    );

    result = hardenOnlineResult(result, text);
    if (truncated) {
      result.notice = [result.notice, `Idea trimmed to ${INPUT_MAX_CHARS} characters.`]
        .filter(Boolean)
        .join(" ");
    }

    await pushHistory({
      idea: text,
      prompt: result.prompt,
      understood: result.understood,
      mode: result.mode,
      shape
    });
    return { ok: true, result };
  } catch (err) {
    const classified = classifyError(err?.status, err?.message || String(err), provider);
    const fallback = coachOffline(text, tweak, shape, answers);
    await pushHistory({
      idea: text,
      prompt: fallback.prompt,
      understood: fallback.understood,
      mode: "offline-fallback",
      shape
    });
    return {
      ok: true,
      result: {
        ...fallback,
        mode: "offline-fallback",
        notice: classified.message,
        error_code: classified.code
      },
      code: classified.code
    };
  }
}

async function coachOnlineWithRetry(
  provider,
  apiKey,
  preset,
  text,
  tweak,
  previousPrompt,
  shape,
  answers
) {
  let lastErr;
  for (let attempt = 0; attempt <= JSON_RETRY; attempt += 1) {
    try {
      const result =
        provider === "groq"
          ? await coachWithGroq(apiKey, preset, text, tweak, previousPrompt, shape, answers)
          : await coachWithGemini(apiKey, preset, text, tweak, previousPrompt, shape, answers);
      return result;
    } catch (err) {
      lastErr = err;
      const code = err?.code || classifyError(err?.status, err?.message || "", provider).code;
      if (code !== "bad_json" && !/json|empty|missing required/i.test(String(err?.message || ""))) {
        throw err;
      }
    }
  }
  throw lastErr;
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === "AbortError") {
      const e = new Error("Request timed out.");
      e.status = 0;
      throw e;
    }
    const e = new Error(err?.message || "Network error");
    e.status = 0;
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function coachWithGemini(apiKey, preset, input, tweak, previousPrompt, shape, answers) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${preset.model}:generateContent`;
  const generationConfig = {
    maxOutputTokens: 2200,
    responseMimeType: "application/json",
    responseSchema: COACH_RESPONSE_SCHEMA,
    thinkingConfig: {
      thinkingLevel: preset.thinking || "low",
      includeThoughts: false
    }
  };

  const body = {
    systemInstruction: { parts: [{ text: COACH_SYSTEM }] },
    contents: [
      {
        role: "user",
        parts: [{ text: buildUserMessage(input, tweak, previousPrompt, shape, answers) }]
      }
    ],
    generationConfig
  };

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    let detail = `Gemini request failed (${res.status})`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed?.error?.message) detail = parsed.error.message;
    } catch {
      /* keep */
    }
    const e = new Error(detail);
    e.status = res.status;
    throw e;
  }

  const data = await res.json();
  const text = extractGeminiText(data);
  if (!String(text).trim()) {
    const reason =
      data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || "empty";
    const e = new Error(`Gemini returned nothing (${reason}).`);
    e.status = res.status;
    throw e;
  }

  try {
    const parsed = parseCoachJson(text, "gemini");
    return {
      ...parsed,
      mode: "gemini",
      notice: "",
      model: preset.model
    };
  } catch (err) {
    err.status = res.status;
    throw err;
  }
}

async function coachWithGroq(apiKey, preset, input, tweak, previousPrompt, shape, answers) {
  const body = {
    model: preset.model,
    temperature: 0.3,
    max_tokens: 2200,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: COACH_SYSTEM },
      {
        role: "user",
        content: buildUserMessage(input, tweak, previousPrompt, shape, answers)
      }
    ]
  };

  const res = await fetchWithTimeout(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    let detail = `Groq request failed (${res.status})`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed?.error?.message) detail = parsed.error.message;
    } catch {
      /* keep */
    }
    const e = new Error(detail);
    e.status = res.status;
    throw e;
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  try {
    const parsed = parseCoachJson(text, "groq");
    return {
      ...parsed,
      mode: "groq",
      notice: "",
      model: preset.model
    };
  } catch (err) {
    err.status = res.status;
    throw err;
  }
}
