const EXAMPLES = [
  "mail landlord heater broken 3 weeks he ignore me firm not rude",
  "angry customer reply but keep brand polite",
  "whatsapp roommate dishes piling up chill not rude",
  "python function sort list of dicts by date"
];

export async function mountPanel(adapters) {
  const css = await fetch(new URL("./panel.css", import.meta.url)).then((r) => r.text());

  const host = document.createElement("div");
  host.id = "prompt-coach-host";
  // Full-screen overlay host (not 0×0). Zero-size hosts clip the panel
  // on YouTube/Claude so the drag header disappears.
  host.style.cssText = [
    "all:initial",
    "position:fixed",
    "inset:0",
    "width:100vw",
    "height:100vh",
    "margin:0",
    "padding:0",
    "border:0",
    "overflow:visible",
    "z-index:2147483647",
    "pointer-events:none",
    "background:transparent"
  ].join(";");
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = css;
  const root = document.createElement("div");
  root.id = "prompt-coach-root";
  shadow.append(style, root);
  // Mount once. Do NOT re-append on a timer — that made Claude blink.
  (document.documentElement || document.body).appendChild(host);

  root.innerHTML = `
    <section class="pc-panel" hidden role="dialog" aria-label="Prompt Coach">
      <header class="pc-header" data-drag title="Drag to move">
        <span class="pc-grip" aria-hidden="true">⠿</span>
        <div class="pc-brand">
          <span class="pc-dot"></span>
          <strong>Prompt Coach</strong>
        </div>
        <span class="pc-badge" data-badge>Local</span>
        <button class="pc-icon" type="button" data-history title="History">◷</button>
        <button class="pc-icon" type="button" data-settings title="Settings">⚙</button>
        <button class="pc-icon" type="button" data-close title="Close">✕</button>
      </header>

      <div class="pc-body" data-view="main">
        <div class="pc-banner" data-onboard hidden>
          <div>
            <strong>Unlock stronger prompts</strong>
            <p>Add a free Gemini API key. It stays in this browser and is sent only to Google when you coach.</p>
          </div>
          <div class="pc-banner-actions">
            <a class="pc-link" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Get Gemini key</a>
            <button class="pc-textbtn" type="button" data-onboard-settings>Add key</button>
            <button class="pc-textbtn" type="button" data-onboard-skip>Not now</button>
          </div>
        </div>

        <label class="pc-field">
          <span class="pc-label">Idea <em data-count>0</em></span>
          <textarea class="pc-input" data-input placeholder="Type it badly…"></textarea>
        </label>

        <div class="pc-examples" data-examples></div>

        <div class="pc-seg" role="group" aria-label="Shape">
          <button type="button" class="is-on" data-shape="auto">Auto</button>
          <button type="button" data-shape="chat">Chat</button>
          <button type="button" data-shape="image">Image</button>
          <button type="button" data-shape="code">Code</button>
        </div>

        <button class="pc-primary" type="button" data-go>Make detailed prompt</button>
        <p class="pc-hint" data-hint>Local draft until a Gemini key is saved.</p>

        <div class="pc-status" data-status hidden></div>
        <div class="pc-loading" data-loading hidden>
          <div class="pc-track"><i data-bar></i></div>
          <span data-loading-text>Reading…</span>
        </div>

        <div class="pc-out" data-result hidden>
          <div class="pc-kicker">Understood</div>
          <p class="pc-text" data-understood></p>
          <p class="pc-text pc-dim" data-corrected></p>

          <div class="pc-prompt-wrap">
            <div class="pc-prompt-head">
              <span>Prompt</span>
              <span data-meta></span>
            </div>
            <pre class="pc-prompt" data-prompt></pre>
            <div class="pc-row">
              <button class="pc-primary" type="button" data-copy>Copy</button>
              <button class="pc-secondary" type="button" data-again>Again</button>
            </div>
          </div>

          <div class="pc-validate" data-validate hidden></div>

          <div class="pc-refine" data-refine hidden>
            <div class="pc-kicker">Refine with 1–2 answers</div>
            <div data-questions></div>
            <button class="pc-secondary" type="button" data-refine-go>Regenerate with answers</button>
          </div>

          <div data-fill-card hidden>
            <div class="pc-kicker">Fill these</div>
            <ul class="pc-list" data-fill></ul>
          </div>

          <div data-assume-card hidden>
            <div class="pc-kicker">Assumptions</div>
            <ul class="pc-list" data-assumptions></ul>
          </div>

          <div class="pc-kicker">Tweaks</div>
          <div class="pc-tweaks" data-tweaks></div>
        </div>
      </div>

      <div class="pc-body" data-view="settings" hidden>
        <h2 class="pc-h2">Settings</h2>

        <div class="pc-label">Provider</div>
        <div class="pc-seg" role="group" aria-label="Provider">
          <button type="button" class="is-on" data-provider="gemini">Gemini</button>
          <button type="button" data-provider="groq">Groq</button>
        </div>

        <label class="pc-field">
          <span class="pc-label" data-key-label>Gemini API key</span>
          <input class="pc-input pc-key" data-key type="password" autocomplete="off" placeholder="AIza…" />
        </label>
        <p class="pc-hint" data-key-help>
          Free key from
          <a class="pc-link" data-key-link href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>.
          Stored only in this browser. For personal use — don’t ship a shared build with your key inside.
        </p>

        <div class="pc-label">Model</div>
        <div class="pc-seg" role="group" aria-label="Model">
          <button type="button" class="is-on" data-preset="faster">Fast</button>
          <button type="button" data-preset="balanced">Stronger</button>
        </div>
        <p class="pc-hint" data-preset-hint>Default. Gemini Flash-Lite — cheap and quick.</p>

        <label class="pc-check">
          <input type="checkbox" data-offline />
          Always use local draft
        </label>

        <button class="pc-primary" type="button" data-save>Save</button>
        <button class="pc-secondary" type="button" data-back>Back</button>
      </div>

      <div class="pc-body" data-view="history" hidden>
        <div class="pc-hist-head">
          <h2 class="pc-h2">History</h2>
          <button class="pc-textbtn" type="button" data-clear-history>Clear</button>
        </div>
        <div class="pc-hist" data-history-list></div>
        <button class="pc-secondary" type="button" data-back-hist>Back</button>
      </div>
    </section>
  `;

  const panel = root.querySelector(".pc-panel");
  const input = root.querySelector("[data-input]");
  const go = root.querySelector("[data-go]");
  const status = root.querySelector("[data-status]");
  const hint = root.querySelector("[data-hint]");
  const result = root.querySelector("[data-result]");
  const badge = root.querySelector("[data-badge]");
  const loading = root.querySelector("[data-loading]");
  const loadingText = root.querySelector("[data-loading-text]");
  const bar = root.querySelector("[data-bar]");
  const onboard = root.querySelector("[data-onboard]");
  const keyInput = root.querySelector("[data-key]");
  const keyLabel = root.querySelector("[data-key-label]");
  const keyLink = root.querySelector("[data-key-link]");
  const offlineBox = root.querySelector("[data-offline]");
  const presetHint = root.querySelector("[data-preset-hint]");
  const countEl = root.querySelector("[data-count]");
  const meta = root.querySelector("[data-meta]");
  const examples = root.querySelector("[data-examples]");
  const historyList = root.querySelector("[data-history-list]");
  const questionsBox = root.querySelector("[data-questions]");
  const refineBox = root.querySelector("[data-refine]");
  const validateEl = root.querySelector("[data-validate]");

  let shape = "auto";
  let preset = "faster";
  let provider = "gemini";
  let lastPrompt = "";
  let lastIdea = "";
  let lastResult = null;
  let lastAnswers = {};
  let isOpen = false;
  let loadingTimer = null;
  let view = "main";
  let runToken = 0;

  const PRESET_COPY = {
    gemini: {
      faster: "Default. Gemini Flash-Lite — cheap and quick.",
      balanced: "Gemini Flash — use when Fast feels thin."
    },
    groq: {
      faster: "Groq GPT-OSS 20B — quick free tier.",
      balanced: "Groq GPT-OSS 120B — heavier free tier."
    }
  };

  function applyProviderUI(next) {
    provider = next === "groq" ? "groq" : "gemini";
    root.querySelectorAll("[data-provider]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.provider === provider);
    });
    if (provider === "groq") {
      keyLabel.textContent = "Groq API key";
      keyInput.placeholder = "gsk_…";
      keyLink.href = "https://console.groq.com/keys";
      keyLink.textContent = "console.groq.com/keys";
      hint.textContent = "Local draft until a Groq key is saved.";
    } else {
      keyLabel.textContent = "Gemini API key";
      keyInput.placeholder = "AIza…";
      keyLink.href = "https://aistudio.google.com/apikey";
      keyLink.textContent = "aistudio.google.com/apikey";
      hint.textContent = "Local draft until a Gemini key is saved.";
    }
    presetHint.textContent = PRESET_COPY[provider][preset];
  }

  for (const text of EXAMPLES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pc-example";
    btn.textContent = text;
    btn.addEventListener("click", () => {
      input.value = text;
      updateCount();
      input.focus();
    });
    examples.appendChild(btn);
  }

  function showView(name) {
    view = name;
    root.querySelectorAll("[data-view]").forEach((el) => {
      el.hidden = el.getAttribute("data-view") !== name;
    });
  }

  function setShape(next) {
    shape = next;
    root.querySelectorAll("[data-shape]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.shape === next);
    });
  }

  function setPreset(next) {
    preset = next === "balanced" ? "balanced" : "faster";
    root.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.preset === preset);
    });
    presetHint.textContent = PRESET_COPY[provider][preset];
  }

  function showStatus(text, kind = "warn") {
    if (!text) {
      status.hidden = true;
      status.textContent = "";
      status.dataset.kind = "";
      return;
    }
    status.hidden = false;
    status.textContent = text;
    status.dataset.kind = kind;
  }

  function updateCount() {
    countEl.textContent = String(input.value.length);
  }

  function startLoading() {
    loading.hidden = false;
    result.hidden = true;
    const lines = ["Reading your idea…", "Repairing the request…", "Writing the prompt…"];
    let i = 0;
    loadingText.textContent = lines[0];
    bar.style.width = "20%";
    clearInterval(loadingTimer);
    loadingTimer = setInterval(() => {
      i = Math.min(i + 1, lines.length - 1);
      loadingText.textContent = lines[i];
      bar.style.width = `${24 + i * 30}%`;
    }, 380);
  }

  function stopLoading() {
    clearInterval(loadingTimer);
    loadingTimer = null;
    loading.hidden = true;
    bar.style.width = "0%";
  }

  function renderQuestions(questions) {
    questionsBox.replaceChildren();
    const list = questions || [];
    refineBox.hidden = list.length === 0;
    for (const q of list) {
      const wrap = document.createElement("label");
      wrap.className = "pc-field";
      wrap.innerHTML = `<span class="pc-label">${escapeHtml(q.label)}</span>`;
      const field = document.createElement("input");
      field.className = "pc-input pc-key";
      field.dataset.qid = q.id;
      field.placeholder = q.placeholder || "";
      wrap.appendChild(field);
      questionsBox.appendChild(wrap);
    }
  }

  function collectAnswers() {
    const answers = {};
    questionsBox.querySelectorAll("[data-qid]").forEach((el) => {
      const v = el.value.trim();
      if (v) answers[el.dataset.qid] = v;
    });
    return answers;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render(data) {
    lastResult = data;
    result.hidden = false;
    root.querySelector("[data-understood]").textContent = data.understood || "";
    root.querySelector("[data-corrected]").textContent = data.corrected_request
      ? `Corrected: ${data.corrected_request}`
      : "";
    root.querySelector("[data-prompt]").textContent = data.prompt || "";
    lastPrompt = data.prompt || "";
    const words = lastPrompt.trim() ? lastPrompt.trim().split(/\s+/).length : 0;
    const scen = data.slots?.scenario || data.task_type || "";
    meta.textContent = [words ? `${words} words` : "", scen].filter(Boolean).join(" · ");

    const list = root.querySelector("[data-assumptions]");
    list.replaceChildren();
    const assumptions = data.assumptions || [];
    root.querySelector("[data-assume-card]").hidden = assumptions.length === 0;
    for (const item of assumptions) {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    }

    const fillList = root.querySelector("[data-fill]");
    fillList.replaceChildren();
    const fills = data.fill_hints || [];
    root.querySelector("[data-fill-card]").hidden = fills.length === 0;
    for (const item of fills) {
      const li = document.createElement("li");
      li.textContent = item;
      fillList.appendChild(li);
    }

    const tweaks = root.querySelector("[data-tweaks]");
    tweaks.replaceChildren();
    for (const label of data.tweaks || []) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pc-chip";
      btn.textContent = label;
      btn.addEventListener("click", () => run(label, lastAnswers));
      tweaks.appendChild(btn);
    }

    renderQuestions(data.questions || []);

    const val = data.validation;
    if (val && val.ok === false && Array.isArray(val.errors) && val.errors.length) {
      validateEl.hidden = false;
      validateEl.textContent = `Check: ${val.errors.slice(0, 2).join("; ")}`;
    } else if (data.slots?.channel && data.slots.channel !== "other") {
      validateEl.hidden = false;
      validateEl.textContent = `Channel: ${data.slots.channel}${data.slots.scenario ? ` · ${data.slots.scenario}` : ""}`;
    } else {
      validateEl.hidden = true;
      validateEl.textContent = "";
    }

    const online = data.mode === "gemini" || data.mode === "groq";
    if (data.mode === "offline-fallback") badge.textContent = "Fallback";
    else badge.textContent = online ? "Coach" : "Local";
    hint.hidden = online;
    if (data.notice) {
      const kind =
        data.error_code === "bad_key"
          ? "error"
          : data.mode === "offline" || data.mode === "offline-fallback"
            ? "warn"
            : "ok";
      showStatus(data.notice, kind);
    } else {
      showStatus("");
    }
  }

  async function run(tweak = "", answers = {}) {
    const idea = input.value.trim();
    if (!idea) {
      showStatus("Type an idea first.", "error");
      input.classList.add("pc-shake");
      setTimeout(() => input.classList.remove("pc-shake"), 400);
      input.focus();
      return;
    }
    lastIdea = idea;
    const mergedAnswers = { ...lastAnswers, ...answers };
    if (Object.keys(answers).length) lastAnswers = mergedAnswers;
    const token = ++runToken;
    go.disabled = true;
    go.textContent = "Coaching…";
    showStatus("");
    startLoading();
    try {
      const response = await adapters.coach({
        input: idea,
        tweak: tweak || "",
        previousPrompt: tweak ? lastPrompt : "",
        shape,
        answers: mergedAnswers
      });
      if (token !== runToken) return;
      stopLoading();
      if (!response?.ok) {
        showStatus(response?.error || "Could not build a prompt.", "error");
        return;
      }
      render(response.result);
    } catch (err) {
      if (token !== runToken) return;
      stopLoading();
      showStatus(err?.message || "Could not build a prompt.", "error");
    } finally {
      if (token === runToken) {
        go.disabled = false;
        go.textContent = "Make detailed prompt";
      }
    }
  }

  async function copyPrompt() {
    const text = root.querySelector("[data-prompt]").textContent || "";
    if (!text) return;
    const copyBtn = root.querySelector("[data-copy]");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.cssText = "position:fixed;left:-9999px";
      shadow.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    copyBtn.textContent = "Copied";
    setTimeout(() => {
      copyBtn.textContent = "Copy";
    }, 1200);
  }

  async function loadSettings() {
    try {
      const response = await adapters.getSettings();
      const settings = response?.settings || {};
      keyInput.value = settings.apiKey || "";
      offlineBox.checked = Boolean(settings.preferOffline);
      applyProviderUI(settings.provider || "gemini");
      setPreset(settings.preset || "faster");
      const hasKey = Boolean(settings.apiKey) && !settings.preferOffline;
      hint.hidden = hasKey;
      if (!lastPrompt) badge.textContent = hasKey ? "Ready" : "Local";
      onboard.hidden = Boolean(settings.onboardingDone) || hasKey;
    } catch {
      /* preview */
    }
  }

  async function renderHistory() {
    historyList.replaceChildren();
    const response = await adapters.getHistory();
    const items = response?.history || [];
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "pc-hint";
      empty.textContent = "No saved prompts yet.";
      historyList.appendChild(empty);
      return;
    }
    for (const item of items) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "pc-hist-item";
      const when = new Date(item.createdAt).toLocaleString();
      card.innerHTML = `<strong>${escapeHtml(item.idea || "Untitled")}</strong><span>${escapeHtml(when)} · ${escapeHtml(item.mode || "")}</span>`;
      card.addEventListener("click", () => {
        input.value = item.idea || "";
        updateCount();
        root.querySelector("[data-prompt]").textContent = item.prompt || "";
        root.querySelector("[data-understood]").textContent = item.understood || "";
        root.querySelector("[data-corrected]").textContent = "";
        lastPrompt = item.prompt || "";
        result.hidden = false;
        refineBox.hidden = true;
        showView("main");
        badge.textContent =
          item.mode === "groq" || item.mode === "gemini" ? "Coach" : "Local";
        meta.textContent = "from history";
      });
      historyList.appendChild(card);
    }
  }

  function clampPanel(left, top) {
    const w = panel.offsetWidth || 392;
    const h = Math.min(panel.offsetHeight || 320, window.innerHeight - 16);
    const maxLeft = Math.max(8, window.innerWidth - w - 8);
    const maxTop = Math.max(8, window.innerHeight - Math.min(h, 120) - 8);
    return {
      left: Math.min(maxLeft, Math.max(8, left)),
      top: Math.min(maxTop, Math.max(8, top))
    };
  }

  function applyPanelPos(left, top) {
    const pos = clampPanel(left, top);
    panel.style.left = `${pos.left}px`;
    panel.style.top = `${pos.top}px`;
    panel.style.right = "auto";
    return pos;
  }

  async function loadPanelPos() {
    try {
      if (adapters.getPanelPos) {
        const res = await adapters.getPanelPos();
        const pos = res?.pos;
        if (pos && typeof pos.left === "number" && typeof pos.top === "number") {
          applyPanelPos(pos.left, pos.top);
          return;
        }
      }
      // Migrate old per-site localStorage position once
      const raw = localStorage.getItem("prompt-coach-pos");
      if (!raw) return;
      const pos = JSON.parse(raw);
      if (typeof pos.left === "number" && typeof pos.top === "number") {
        applyPanelPos(pos.left, pos.top);
        await adapters.savePanelPos?.(pos);
        localStorage.removeItem("prompt-coach-pos");
      }
    } catch {
      /* ignore */
    }
  }

  function savePanelPos() {
    try {
      const rect = panel.getBoundingClientRect();
      const pos = { left: rect.left, top: rect.top };
      adapters.savePanelPos?.(pos);
    } catch {
      /* ignore */
    }
  }

  async function openPanel() {
    panel.hidden = false;
    isOpen = true;
    showView("main");
    await loadPanelPos();
    input.focus();
  }

  function closePanel() {
    panel.hidden = true;
    isOpen = false;
    stopLoading();
  }

  root.querySelector("[data-close]").addEventListener("click", closePanel);
  root.querySelector("[data-settings]").addEventListener("click", () => showView("settings"));
  root.querySelector("[data-history]").addEventListener("click", async () => {
    showView("history");
    await renderHistory();
  });
  root.querySelector("[data-back]").addEventListener("click", () => showView("main"));
  root.querySelector("[data-back-hist]").addEventListener("click", () => showView("main"));
  go.addEventListener("click", () => run(""));
  root.querySelector("[data-copy]").addEventListener("click", copyPrompt);
  root.querySelector("[data-again]").addEventListener("click", () => run(""));
  root.querySelector("[data-refine-go]").addEventListener("click", () => {
    const a = collectAnswers();
    lastAnswers = { ...lastAnswers, ...a };
    run("", a);
  });
  root.querySelectorAll("[data-shape]").forEach((btn) => {
    btn.addEventListener("click", () => setShape(btn.dataset.shape));
  });
  root.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => setPreset(btn.dataset.preset));
  });
  root.querySelectorAll("[data-provider]").forEach((btn) => {
    btn.addEventListener("click", () => applyProviderUI(btn.dataset.provider));
  });
  root.querySelector("[data-onboard-settings]").addEventListener("click", () => showView("settings"));
  root.querySelector("[data-onboard-skip]").addEventListener("click", async () => {
    onboard.hidden = true;
    await adapters.dismissOnboarding?.();
  });
  root.querySelector("[data-clear-history]").addEventListener("click", async () => {
    await adapters.clearHistory?.();
    await renderHistory();
  });

  root.querySelector("[data-save]").addEventListener("click", async () => {
    const save = root.querySelector("[data-save]");
    save.disabled = true;
    try {
      const response = await adapters.saveSettings({
        provider,
        apiKey: keyInput.value.trim(),
        preset,
        preferOffline: offlineBox.checked
      });
      if (!response?.ok) {
        showView("main");
        showStatus(response?.error || "Could not save settings.", "error");
        return;
      }
      if (keyInput.value.trim()) await adapters.dismissOnboarding?.();
      await loadSettings();
      showView("main");
      showStatus(keyInput.value.trim() ? "Key saved. Ready to coach." : "Saved.", "ok");
    } finally {
      save.disabled = false;
    }
  });

  input.addEventListener("input", updateCount);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      run("");
    }
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePanel();
  });

  const header = root.querySelector("[data-drag]");
  header.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    const ox = event.clientX;
    const oy = event.clientY;
    const sl = rect.left;
    const st = rect.top;
    header.classList.add("is-dragging");
    const pointerId = event.pointerId;
    try {
      header.setPointerCapture(pointerId);
    } catch {
      /* some pages block capture; document listeners still work */
    }

    function move(ev) {
      applyPanelPos(sl + ev.clientX - ox, st + ev.clientY - oy);
    }
    function up() {
      header.classList.remove("is-dragging");
      header.releasePointerCapture?.(pointerId);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      savePanelPos();
    }
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
  });

  updateCount();
  await loadSettings();
  await loadPanelPos();

  return {
    async toggle() {
      if (isOpen) closePanel();
      else await openPanel();
    },
    async openWithText(text) {
      input.value = text || "";
      lastAnswers = {};
      updateCount();
      await openPanel();
      await run("");
    },
    close: closePanel
  };
}
