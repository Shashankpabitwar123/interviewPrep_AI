const titleEl = document.getElementById("page-title");
const apiUrlEl = document.getElementById("api-url");
const saveButton = document.getElementById("save-button");
const statusEl = document.getElementById("status");

let activeTab = null;

async function init() {
  const stored = await chrome.storage.sync.get(["apiUrl"]);
  if (stored.apiUrl) {
    apiUrlEl.value = stored.apiUrl;
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tabs[0];
  titleEl.textContent = activeTab?.title || "No active tab found.";
}

async function getVisiblePageText(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => document.body.innerText,
  });
  return (result.result || "").slice(0, 25000);
}

async function saveCurrentJob() {
  if (!activeTab?.id || !activeTab?.url) {
    statusEl.textContent = "No active job page found.";
    return;
  }

  saveButton.disabled = true;
  statusEl.textContent = "Saving...";

  try {
    const apiUrl = apiUrlEl.value.replace(/\/$/, "");
    await chrome.storage.sync.set({ apiUrl });

    const pageText = await getVisiblePageText(activeTab.id);
    const response = await fetch(`${apiUrl}/jobs/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_title: activeTab.title || "Saved Job",
        job_description: pageText,
        source_url: activeTab.url,
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const saved = await response.json();
    statusEl.textContent = `Saved job #${saved.job_post_id}.`;
  } catch (error) {
    statusEl.textContent = `Could not save: ${error.message}`;
  } finally {
    saveButton.disabled = false;
  }
}

saveButton.addEventListener("click", saveCurrentJob);
init();
