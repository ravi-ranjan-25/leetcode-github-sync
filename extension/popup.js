const $ = (id) => document.getElementById(id);

const TOKEN_URL =
  "https://github.com/settings/personal-access-tokens/new?" +
  new URLSearchParams({
    name: "LeetCode Sync",
    description: "Browser extension that pushes accepted LeetCode solutions",
    expires_in: "365",
    contents: "write",
  });

function status(text, ok) {
  $("status").textContent = text;
  $("status").className = `status ${ok ? "ok" : "err"}`;
}

function showSetup(repo) {
  $("connected").classList.add("hidden");
  $("setup").classList.remove("hidden");
  if (repo) $("repo").value = repo;
  $("newToken").href = TOKEN_URL;
}

function keyStatus(text, ok) {
  $("keyStatus").textContent = text;
  $("keyStatus").className = ok ? "hint" : "hint err";
}

async function showConnected() {
  const { repo, history = [], includeStatement, anthropicKey } = await chrome.storage.local.get([
    "repo", "history", "includeStatement", "anthropicKey",
  ]);
  $("setup").classList.add("hidden");
  $("connected").classList.remove("hidden");
  $("repoLink").textContent = repo;
  $("repoLink").href = `https://github.com/${repo}`;
  $("includeStatement").checked = includeStatement !== false;
  $("anthropicKey").placeholder = anthropicKey ? "Key saved (paste a new one to replace)" : "Claude API key (sk-ant-…)";
  if (anthropicKey) keyStatus("Summaries on. Clear the box and Save to turn them off.", true);
  if (history.length) {
    $("history").replaceChildren(
      ...history.map((h) => {
        const li = document.createElement("li");
        if (h.ok && h.commit) {
          const a = document.createElement("a");
          a.href = h.commit; a.target = "_blank"; a.textContent = `✓ ${h.title}`;
          li.append(a);
          if (h.warning) li.append(` (skipped ${h.warning})`);
        } else {
          li.textContent = `${h.ok ? "✓" : "✗"} ${h.title || "Submission"}${h.error ? `: ${h.error}` : ""}`;
          if (!h.ok) li.className = "err";
        }
        return li;
      })
    );
  }
}

$("setup").addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.submitter;
  button.disabled = true;
  status("Checking…", true);
  const res = await chrome.runtime.sendMessage({
    type: "setup", token: $("token").value.trim(), repo: $("repo").value.trim(),
  });
  button.disabled = false;
  if (res?.error) return status(res.error, false);
  $("token").value = "";
  status(`Connected as ${res.author.name}.`, true);
  showConnected();
});

$("includeStatement").addEventListener("change", (e) => {
  chrome.storage.local.set({ includeStatement: e.target.checked });
});

$("saveKey").addEventListener("click", async () => {
  const key = $("anthropicKey").value.trim();
  const { anthropicKey } = await chrome.storage.local.get("anthropicKey");
  if (!key && !anthropicKey) return keyStatus("Paste a Claude API key first.", false);
  $("saveKey").disabled = true;
  keyStatus(key ? "Checking key…" : "Turning summaries off…", true);
  const res = await chrome.runtime.sendMessage({ type: "setAnthropicKey", key });
  $("saveKey").disabled = false;
  if (res?.error) return keyStatus(res.error, false);
  $("anthropicKey").value = "";
  await showConnected();
  if (!key) keyStatus("Summaries off.", true);
});

$("edit").addEventListener("click", async () => {
  const { repo } = await chrome.storage.local.get("repo");
  status("", true);
  showSetup(repo);
});

$("syncRecent").addEventListener("click", async () => {
  const button = $("syncRecent");
  button.disabled = true;
  status("Syncing… keep the LeetCode tab open.", true);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await chrome.tabs.sendMessage(tab.id, { type: "syncRecent" });
    if (res?.error) status(res.error, false);
    else status(`Done: ${res.pushed} pushed, ${res.skipped} already there.`, true);
    showConnected();
  } catch {
    status("Open a leetcode.com tab (reload it once after installing), then try again.", false);
  } finally {
    button.disabled = false;
  }
});

chrome.storage.local.get("token").then(({ token }) => (token ? showConnected() : showSetup()));
