const DEFAULT_API_URL = "https://interviewprep-ai-api.onrender.com";
const DEFAULT_APP_URL = "https://interview-prep-ai-sable.vercel.app";
const extensionApi = globalThis.chrome || globalThis.browser;

const elements = {
  authTitle: document.getElementById("auth-title"),
  authSubtitle: document.getElementById("auth-subtitle"),
  loginForm: document.getElementById("login-form"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  bubbleEnabled: document.getElementById("bubble-enabled"),
  apiUrl: document.getElementById("api-url"),
  appUrl: document.getElementById("app-url"),
  saveSettings: document.getElementById("save-settings"),
  openApp: document.getElementById("open-app"),
  logout: document.getElementById("logout"),
  status: document.getElementById("status"),
};

init();

async function init() {
  setStatus("Loading extension settings...");
  const settings = await sendMessage({ type: "getSettings" });
  if (!settings.ok) {
    setStatus(settings.error || "Could not load settings.");
    return;
  }

  elements.apiUrl.value = settings.apiUrl || DEFAULT_API_URL;
  elements.appUrl.value = settings.appUrl || DEFAULT_APP_URL;
  elements.bubbleEnabled.checked = settings.bubbleEnabled !== false;
  renderAuth(settings.user);
  setStatus("");
}

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = elements.email.value.trim();
  const password = elements.password.value;
  if (!email || !password) return setStatus("Enter your InterviewPrep AI email and password.");

  setBusy(true, "Logging in...");
  const response = await sendMessage({ type: "login", email, password });
  setBusy(false);
  if (!response.ok) return setStatus(response.error || "Login failed.");

  renderAuth(response.user);
  elements.password.value = "";
  setStatus("Connected. The bubble can now save jobs to your account.");
});

elements.bubbleEnabled.addEventListener("change", () => saveSettings({ quiet: true }));
elements.saveSettings.addEventListener("click", () => saveSettings());

elements.openApp.addEventListener("click", async () => {
  await sendMessage({ type: "openApp" });
  window.close();
});

elements.logout.addEventListener("click", async () => {
  const response = await sendMessage({ type: "logout" });
  if (!response.ok) return setStatus(response.error || "Logout failed.");
  renderAuth(null);
  setStatus("Logged out from this extension.");
});

async function saveSettings(options = {}) {
  const payload = {
    apiUrl: cleanUrl(elements.apiUrl.value || DEFAULT_API_URL),
    appUrl: cleanUrl(elements.appUrl.value || DEFAULT_APP_URL),
    bubbleEnabled: elements.bubbleEnabled.checked,
  };

  if (!options.quiet) setBusy(true, "Saving settings...");
  const response = await sendMessage({ type: "saveSettings", settings: payload });
  setBusy(false);
  if (!response.ok) return setStatus(response.error || "Could not save settings.");
  if (!options.quiet) setStatus("Settings saved.");
}

function renderAuth(user) {
  const signedIn = Boolean(user);
  elements.authTitle.textContent = signedIn ? `Connected as ${user.name || "InterviewPrep user"}` : "Not connected";
  elements.authSubtitle.textContent = signedIn
    ? user.email || "Jobs will save to this account."
    : "Login once here so the bubble can save jobs and create prep plans.";
  elements.loginForm.classList.toggle("is-hidden", signedIn);
  elements.logout.classList.toggle("is-hidden", !signedIn);
}

function setBusy(isBusy, message = "") {
  document.body.classList.toggle("is-busy", isBusy);
  elements.loginForm.querySelector("button").disabled = isBusy;
  elements.saveSettings.disabled = isBusy;
  if (message) setStatus(message);
}

function setStatus(message) {
  elements.status.textContent = message || "";
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
        maybePromise.then((response) => {
          resolve(response || { ok: false, error: "No extension response." });
        }).catch((error) => {
          resolve({ ok: false, error: error.message || "Extension message failed." });
        });
      }
    } catch (error) {
      if (extensionApi.runtime?.sendMessage) {
        extensionApi.runtime.sendMessage(message).then(resolve).catch((sendError) => {
          resolve({ ok: false, error: sendError.message || "Extension message failed." });
        });
      } else {
        resolve({ ok: false, error: error.message || "Extension message failed." });
      }
    }
  });
}


function cleanUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}
