import { pushSubmission, checkSetup } from "./github.js";
import { summarize, review, learn, checkKey } from "./claude.js";

// One push at a time, so two quick submissions don't race on the branch.
let queue = Promise.resolve();

async function log(entry) {
  const { history = [] } = await chrome.storage.local.get("history");
  history.unshift({ ...entry, at: Date.now() });
  await chrome.storage.local.set({ history: history.slice(0, 10) });
}

async function handlePush(detail) {
  const settings = await chrome.storage.local.get([
    "token", "repo", "branch", "author", "anthropicKey", "includeStatement",
  ]);
  if (!settings.token || !settings.repo) {
    return { error: "Not set up yet. Click the extension icon and add your GitHub token." };
  }
  try {
    const result = await pushSubmission(settings, detail, {
      wantStatement: settings.includeStatement !== false, // on unless switched off
      summarize: settings.anthropicKey ? () => summarize(settings.anthropicKey, detail) : null,
      review: settings.anthropicKey ? () => review(settings.anthropicKey, detail) : null,
      learn: settings.anthropicKey ? (known) => learn(settings.anthropicKey, detail, known) : null,
    });
    if (!result.skipped) {
      await log({ ok: true, title: result.title, commit: result.commit, warning: result.warning });
    }
    return result;
  } catch (e) {
    await log({ ok: false, title: detail.question?.title, error: e.message });
    return { error: e.message };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "push") {
    const run = queue.then(() => handlePush(msg.detail));
    queue = run.catch(() => {});
    run.then(sendResponse);
    return true;
  }
  if (msg?.type === "setup") {
    checkSetup(msg.token, msg.repo)
      .then(async (info) => {
        await chrome.storage.local.set({ token: msg.token, ...info });
        sendResponse(info);
      })
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }
  if (msg?.type === "setAnthropicKey") {
    (async () => {
      if (!msg.key) {
        await chrome.storage.local.remove("anthropicKey");
        return {};
      }
      const check = await checkKey(msg.key);
      if (!check.error) await chrome.storage.local.set({ anthropicKey: msg.key });
      return check;
    })().then(sendResponse);
    return true;
  }
});
