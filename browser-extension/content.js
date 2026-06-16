(() => {
  if (window.top !== window || document.getElementById("interviewprep-capture-root")) return;
  if (/^(chrome|edge|about|moz-extension|chrome-extension|safari-web-extension):/.test(window.location.protocol)) return;

  const extensionApi = globalThis.chrome || globalThis.browser;
  setupWebsiteBridge();

  const state = {
    open: false,
    panelOpen: false,
    mode: "selected",
    dragging: false,
    startX: 0,
    startY: 0,
    bubbleX: Number(localStorage.getItem("interviewprep_bubble_x")) || window.innerWidth - 96,
    bubbleY: Number(localStorage.getItem("interviewprep_bubble_y")) || Math.round(window.innerHeight * 0.58),
    description: "",
    status: "",
    hoverCloseTimer: null,
    toastTimer: null,
    lastSelection: "",
    settings: { bubbleEnabled: true },
  };

  const root = document.createElement("div");
  root.id = "interviewprep-capture-root";
  root.innerHTML = `
    <button class="ipai-bubble" type="button" aria-label="InterviewPrep AI capture">
      <span aria-hidden="true">
        <svg viewBox="0 0 24 24" class="ipai-logo" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"></path>
          <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"></path>
          <path d="M15 13h.01"></path>
          <path d="M18 10h.01"></path>
          <path d="M15 7h.01"></path>
          <path d="M12 12h.01"></path>
          <path d="M12 18h.01"></path>
        </svg>
      </span>
    </button>
    <div class="ipai-radial" aria-hidden="true">
      <button type="button" data-action="auto" title="Automatically detect the job description">Auto copy description</button>
      <button type="button" data-action="selected" title="Copy the text you highlighted">Copy selected text</button>
      <button type="button" data-action="url" title="Copy the current page URL">Copy URL</button>
    </div>
    <section class="ipai-panel" aria-label="InterviewPrep AI capture panel">
      <header>
        <div>
          <strong>InterviewPrep AI</strong>
          <span class="ipai-panel-subtitle">Capture this job</span>
        </div>
        <button type="button" data-action="close" aria-label="Close">×</button>
      </header>
      <textarea placeholder="Auto-copy, selected text, or URL will appear here. You can edit before saving."></textarea>
      <div class="ipai-capture-meta">
        <input class="ipai-title" placeholder="Job title (AI can detect)" />
        <input class="ipai-date" type="datetime-local" />
        <input class="ipai-hours" type="number" min="0.5" max="10" step="0.5" value="3" />
      </div>
      <div class="ipai-actions">
        <button type="button" class="ipai-save-action" data-action="save">Save Job</button>
        <button type="button" class="ipai-plan-action" data-action="plan">Generate Prep Plan</button>
      </div>
      <p class="ipai-status"></p>
    </section>
    <p class="ipai-toast" aria-live="polite"></p>
  `;
  document.documentElement.appendChild(root);

  const bubble = root.querySelector(".ipai-bubble");
  const radial = root.querySelector(".ipai-radial");
  const panel = root.querySelector(".ipai-panel");
  const textarea = root.querySelector("textarea");
  const titleInput = root.querySelector(".ipai-title");
  const dateInput = root.querySelector(".ipai-date");
  const hoursInput = root.querySelector(".ipai-hours");
  const statusEl = root.querySelector(".ipai-status");
  const toastEl = root.querySelector(".ipai-toast");
  const hoverTargets = [bubble, ...root.querySelectorAll(".ipai-radial button")];

  init();

  async function init() {
    dateInput.value = defaultInterviewLocalDate();
    await refreshSettings();
    applyPosition();
    wireEvents();
  }

  function wireEvents() {
    bubble.addEventListener("pointerdown", startDrag);
    window.addEventListener("pointermove", drag);
    window.addEventListener("pointerup", stopDrag);
    document.addEventListener("pointerdown", closeFromOutside, true);
    document.addEventListener("selectionchange", rememberSelection);

    hoverTargets.forEach((target) => {
      target.addEventListener("pointerdown", (event) => event.preventDefault());
      target.addEventListener("pointerenter", openFromHover);
      target.addEventListener("mouseenter", openFromHover);
      target.addEventListener("pointerleave", scheduleHoverClose);
      target.addEventListener("mouseleave", scheduleHoverClose);
    });

    bubble.addEventListener("click", () => {
      if (state.dragging) return;
      setOpen(!state.open);
    });

    root.addEventListener("click", async (event) => {
      const action = event.target?.dataset?.action;
      if (!action) return;
      if (["auto", "selected", "url"].includes(action)) await capture(action);
      if (action === "save") await saveJob();
      if (action === "plan") await generatePlan();
      if (action === "close") setPanel(false);
    });

    textarea.addEventListener("input", () => {
      state.description = textarea.value;
      updateSubtitle();
    });

    extensionApi.runtime.onMessage.addListener((message) => {
      if (message?.type === "settingsUpdated") applySettings(message.settings);
    });
  }

  async function refreshSettings() {
    const response = await sendMessage({ type: "getSettings" }).catch(() => null);
    if (response?.ok) applySettings(response);
  }

  function applySettings(settings) {
    state.settings = { ...state.settings, ...settings };
    root.classList.toggle("ipai-hidden", state.settings.bubbleEnabled === false);
  }

  function startDrag(event) {
    state.startX = event.clientX - state.bubbleX;
    state.startY = event.clientY - state.bubbleY;
    state.wasMoved = false;
    bubble.setPointerCapture?.(event.pointerId);
  }

  function drag(event) {
    if (!bubble.hasPointerCapture?.(event.pointerId)) return;
    state.wasMoved = true;
    state.bubbleX = clamp(event.clientX - state.startX, 16, window.innerWidth - 74);
    state.bubbleY = clamp(event.clientY - state.startY, 16, window.innerHeight - 74);
    applyPosition();
  }

  function stopDrag(event) {
    if (!bubble.hasPointerCapture?.(event.pointerId)) return;
    bubble.releasePointerCapture?.(event.pointerId);
    state.dragging = state.wasMoved;
    localStorage.setItem("interviewprep_bubble_x", String(state.bubbleX));
    localStorage.setItem("interviewprep_bubble_y", String(state.bubbleY));
    window.setTimeout(() => { state.dragging = false; }, 0);
  }

  function applyPosition() {
    root.style.setProperty("--ipai-x", `${state.bubbleX}px`);
    root.style.setProperty("--ipai-y", `${state.bubbleY}px`);
    if (state.panelOpen) positionPanel();
  }

  function openFromHover() {
    if (state.dragging) return;
    window.clearTimeout(state.hoverCloseTimer);
    setOpen(true, { closePanel: false });
  }

  function scheduleHoverClose() {
    window.clearTimeout(state.hoverCloseTimer);
    state.hoverCloseTimer = window.setTimeout(() => {
      if (isPointerOverCaptureControls()) return;
      setOpen(false, { closePanel: false });
    }, 180);
  }

  function isPointerOverCaptureControls() {
    return Boolean(root.querySelector(".ipai-bubble:hover, .ipai-radial:hover, .ipai-panel:hover"));
  }

  function closeFromOutside(event) {
    if (!state.open && !state.panelOpen) return;
    if (root.contains(event.target)) return;
    setOpen(false);
  }

  function setOpen(open, options = {}) {
    const closePanel = options.closePanel !== false;
    state.open = open;
    root.classList.toggle("ipai-open", open);
    radial.setAttribute("aria-hidden", String(!open));
    if (!open && closePanel) setPanel(false);
  }

  function setPanel(open) {
    state.panelOpen = open;
    root.classList.toggle("ipai-panel-open", open);
    if (open) {
      positionPanel();
      textarea.focus();
    }
  }

  function positionPanel() {
    const leftSide = state.bubbleX > window.innerWidth / 2;
    const panelLeft = leftSide ? state.bubbleX - 390 : state.bubbleX + 74;
    const panelTop = clamp(state.bubbleY - 34, 16, window.innerHeight - 430);
    root.style.setProperty("--ipai-panel-x", `${clamp(panelLeft, 16, window.innerWidth - 390)}px`);
    root.style.setProperty("--ipai-panel-y", `${panelTop}px`);
  }

  function rememberSelection() {
    if (root.contains(document.activeElement)) return;
    const text = String(window.getSelection?.() || "").trim();
    if (text) state.lastSelection = text.slice(0, 25000);
  }

  async function capture(mode) {
    state.mode = mode;
    root.classList.toggle("ipai-url-mode", mode === "url");
    root.querySelector(".ipai-save-action").textContent = mode === "url" ? "Save URL" : "Save Job";
    setOpen(true);
    setPanel(true);
    setStatus("Capturing...");
    if (mode === "auto") {
      state.description = pageText();
      if (!state.description) setStatus("Could not auto-detect text. Highlight the description or copy the URL.");
    }
    if (mode === "selected") {
      state.description = selectedText();
      if (!state.description) setStatus("No selected text found. Highlight the job description first or use Auto copy description.");
    }
    if (mode === "url") {
      state.description = window.location.href;
      setStatus("Copied the current page URL. Save it to your saved jobs.");
    }
    textarea.value = state.description;
    titleInput.value = titleInput.value || guessTitle();
    updateSubtitle();
    if (state.description) setStatus(`Captured ${state.description.length.toLocaleString()} characters.`);
  }

  async function saveJob() {
    setStatus("Saving job...");
    const response = await sendMessage({ type: "saveJob", payload: payload() });
    if (!response.ok) return setStatus(response.error);
    const title = response.saved?.role_title || "Job";
    completeAction(state.mode === "url" ? "URL saved" : `${title} saved`);
  }

  async function generatePlan() {
    setStatus("Generating prep plan...");
    const response = await sendMessage({ type: "generatePlan", payload: payload() });
    if (!response.ok) return setStatus(response.error);
    const title = response.plan?.job_title || "Prep plan";
    completeAction(`${title} generated`);
  }

  function payload() {
    const textValue = textarea.value.trim();
    const isUrlMode = state.mode === "url";
    return {
      jobTitle: titleInput.value.trim() || guessTitle(),
      description: isUrlMode ? "" : textValue,
      sourceUrl: isUrlMode ? textValue || window.location.href : window.location.href,
      saveMode: isUrlMode ? "url" : undefined,
      interviewAt: dateInput.value ? new Date(dateInput.value).toISOString() : undefined,
      hoursPerDay: Number(hoursInput.value || 3),
    };
  }

  function selectedText() {
    const text = String(window.getSelection?.() || "").trim();
    return (text || state.lastSelection || "").slice(0, 25000);
  }

  function pageText() {
    const candidates = [
      document.querySelector("[data-automation-id*='job']"),
      document.querySelector("[class*='job']"),
      document.querySelector("main"),
      document.querySelector("article"),
      document.body,
    ].filter(Boolean);
    const text = candidates
      .map((node) => node.innerText || "")
      .sort((a, b) => b.length - a.length)[0] || "";
    return text.replace(/\n{3,}/g, "\n\n").trim().slice(0, 25000);
  }

  function guessTitle() {
    const heading = document.querySelector("h1")?.innerText?.trim();
    return heading || document.title || "Auto-detect role";
  }

  function updateSubtitle() {
    const modeLabels = {
      auto: "auto description",
      selected: "selected text",
      url: "URL",
    };
    root.querySelector(".ipai-panel-subtitle").textContent = `${modeLabels[state.mode] || "capture"} • ${textarea.value.length.toLocaleString()} chars`;
  }

  function setStatus(message) {
    statusEl.textContent = message || "";
  }

  function completeAction(message) {
    setStatus(message);
    setOpen(false);
    showToast(message);
    playGeneratedSound();
  }

  function showToast(message) {
    toastEl.textContent = message || "";
    root.classList.add("ipai-toast-visible");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      root.classList.remove("ipai-toast-visible");
      toastEl.textContent = "";
    }, 2600);
  }

  function playGeneratedSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = new AudioContext();
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.34);
      gain.connect(context.destination);

      [523.25, 659.25, 783.99].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        const start = context.currentTime + index * 0.055;
        oscillator.start(start);
        oscillator.stop(start + 0.18);
      });

      window.setTimeout(() => context.close?.(), 650);
    } catch {
      // Sound is only feedback; ignore browser autoplay/audio restrictions.
    }
  }

  function sendMessage(message) {
    return new Promise((resolve) => {
      try {
        const maybePromise = extensionApi.runtime.sendMessage(message, (response) => {
          if (extensionApi.runtime.lastError) {
            resolve({ ok: false, error: extensionApi.runtime.lastError.message });
          } else {
            resolve(response || { ok: false, error: "No extension response." });
          }
        });
        if (maybePromise?.then) {
          maybePromise.then((response) => resolve(response || { ok: false })).catch((error) => {
            resolve({ ok: false, error: error.message || "Extension message failed." });
          });
        }
      } catch (error) {
        extensionApi.runtime.sendMessage(message).then(resolve).catch((sendError) => {
          resolve({ ok: false, error: sendError.message || "Extension message failed." });
        });
      }
    });
  }

  function setupWebsiteBridge() {
    if (!isInterviewPrepApp()) return;
    window.addEventListener("message", async (event) => {
      if (event.source !== window) return;
      const request = event.data || {};
      if (request.source !== "interviewprep-ai-web" || !request.requestId) return;

      const response = await handleWebsiteRequest(request).catch((error) => ({
        ok: false,
        error: error.message || "Extension bridge failed.",
      }));

      window.postMessage({
        source: "interviewprep-ai-extension",
        requestId: request.requestId,
        ...response,
      }, window.location.origin);
    });
  }

  async function handleWebsiteRequest(request) {
    if (request.action === "getState") {
      const settings = await sendMessage({ type: "getSettings" });
      const auth = await sendMessage({ type: "getAuthState" });
      return {
        ok: Boolean(settings.ok && auth.ok),
        installed: true,
        bubbleEnabled: settings.bubbleEnabled !== false,
        signedIn: Boolean(auth.signedIn),
        user: auth.user || settings.user || null,
        error: settings.error || auth.error,
      };
    }

    if (request.action === "setBubbleEnabled") {
      const result = await sendMessage({ type: "setBubbleEnabled", enabled: Boolean(request.enabled) });
      return {
        ...result,
        installed: true,
        bubbleEnabled: result.settings?.bubbleEnabled !== false,
      };
    }

    if (request.action === "syncSession") {
      const result = await sendMessage({
        type: "syncSession",
        user: request.user || null,
        authToken: request.authToken || "",
      });
      return { ...result, installed: true };
    }

    if (request.action === "openApp") {
      return sendMessage({ type: "openApp", path: request.path || "" });
    }

    return { ok: false, installed: true, error: "Unknown website extension action." };
  }

  function isInterviewPrepApp() {
    return [
      "interview-prep-ai-sable.vercel.app",
      "localhost",
      "127.0.0.1",
    ].includes(window.location.hostname);
  }

  function defaultInterviewLocalDate() {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    date.setHours(9, 0, 0, 0);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
})();
