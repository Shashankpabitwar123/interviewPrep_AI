const DEFAULT_API_URL = "https://interviewprep-ai-api.onrender.com";
const DEFAULT_APP_URL = "https://interview-prep-ai-sable.vercel.app";
const extensionApi = globalThis.chrome || globalThis.browser;

extensionApi.runtime.onInstalled.addListener(async () => {
  const settings = await extensionApi.storage.sync.get(["apiUrl", "appUrl", "bubbleEnabled"]);
  await extensionApi.storage.sync.set({
    apiUrl: settings.apiUrl || DEFAULT_API_URL,
    appUrl: settings.appUrl || DEFAULT_APP_URL,
    bubbleEnabled: settings.bubbleEnabled !== false,
  });
});

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error.message || "Extension action failed." }));
  return true;
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "getSettings":
      return getSettings();
    case "saveSettings":
      return saveSettings(message.settings || {});
    case "login":
      return login(message.email, message.password);
    case "logout":
      return logout();
    case "saveJob":
      return saveJob(message.payload || {}, sender);
    case "generatePlan":
      return generatePlan(message.payload || {}, sender);
    case "openApp":
      return openApp(message.path || "");
    case "getAuthState":
      return getAuthState();
    default:
      throw new Error("Unknown extension action.");
  }
}

async function getSettings() {
  const settings = await extensionApi.storage.sync.get(["apiUrl", "appUrl", "bubbleEnabled", "user"]);
  return {
    apiUrl: cleanUrl(settings.apiUrl || DEFAULT_API_URL),
    appUrl: cleanUrl(settings.appUrl || DEFAULT_APP_URL),
    bubbleEnabled: settings.bubbleEnabled !== false,
    user: settings.user || null,
  };
}

async function saveSettings(settings) {
  const next = {
    apiUrl: cleanUrl(settings.apiUrl || DEFAULT_API_URL),
    appUrl: cleanUrl(settings.appUrl || DEFAULT_APP_URL),
    bubbleEnabled: settings.bubbleEnabled !== false,
  };
  await extensionApi.storage.sync.set(next);
  await broadcastSettings(next);
  return { settings: next };
}

async function login(email, password) {
  const { apiUrl } = await getSettings();
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || `Login failed with ${response.status}.`);
  await extensionApi.storage.sync.set({ authToken: body.access_token, user: body.user });
  return { user: body.user };
}

async function logout() {
  await extensionApi.storage.sync.remove(["authToken", "user"]);
  return { user: null };
}

async function getAuthState() {
  const settings = await extensionApi.storage.sync.get(["user", "authToken"]);
  return { user: settings.user || null, signedIn: Boolean(settings.authToken) };
}

async function saveJob(payload, sender) {
  const response = await authedFetch("/jobs/analyze", {
    method: "POST",
    body: JSON.stringify(normalizeJobPayload(payload, sender)),
  });
  const saved = await response.json();
  await rememberCapture("job", saved.role_title || payload.jobTitle || "Saved job");
  return { saved };
}

async function generatePlan(payload, sender) {
  const normalized = normalizeJobPayload(payload, sender);
  const response = await authedFetch("/prep-plans", {
    method: "POST",
    body: JSON.stringify({
      job_title: normalized.job_title,
      job_description: normalized.job_description,
      source_url: normalized.source_url,
      interview_at: payload.interviewAt || defaultInterviewDate(),
      hours_per_day: Number(payload.hoursPerDay || 3),
      comfort_level: payload.comfortLevel || "intermediate",
    }),
  });
  const plan = await response.json();
  await rememberCapture("plan", plan.job_title || normalized.job_title || "Prep plan");
  return { plan };
}

async function authedFetch(path, options = {}) {
  const { apiUrl } = await getSettings();
  const { authToken } = await extensionApi.storage.sync.get(["authToken"]);
  if (!authToken) throw new Error("Login to InterviewPrep AI from the extension first.");
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `API returned ${response.status}.`);
  }
  return response;
}

async function openApp(path = "") {
  const { appUrl } = await getSettings();
  const targetUrl = `${appUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const tab = await extensionApi.tabs.create({ url: targetUrl });
  return { tabId: tab.id };
}

async function rememberCapture(type, title) {
  await extensionApi.storage.local.set({
    lastCapture: {
      type,
      title,
      at: new Date().toISOString(),
    },
  });
}

async function broadcastSettings(settings) {
  const tabs = await extensionApi.tabs.query({});
  await Promise.all(tabs.map((tab) => (
    tab.id ? sendTabMessage(tab.id, { type: "settingsUpdated", settings }) : null
  )));
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    extensionApi.tabs.sendMessage(tabId, message, () => resolve());
  });
}

function normalizeJobPayload(payload, sender) {
  const description = String(payload.description || "").trim();
  const url = payload.sourceUrl || sender?.tab?.url || "";
  if (!description && !url) throw new Error("Capture selected text, page text, or a URL first.");
  return {
    job_title: payload.jobTitle || sender?.tab?.title || "Auto-detect role",
    job_description: description || undefined,
    source_url: url || undefined,
  };
}

function cleanUrl(url) {
  return String(url || "").trim().replace(/\/$/, "");
}

function defaultInterviewDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}
