// Runs on leetcode.com in the extension's own sandbox. Fetches submission details
// with your existing LeetCode login (same-origin request, no cookies copied
// anywhere) and hands them to the background worker to commit.

const DETAIL_QUERY = `
query detail($id: Int!) {
  submissionDetails(submissionId: $id) {
    code timestamp runtimeDisplay memoryDisplay
    runtimePercentile memoryPercentile
    lang { name verboseName }
    question { questionFrontendId title titleSlug difficulty }
    topicTags { name }
  }
}`;

const RECENT_QUERY = `
query recent($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) { id timestamp }
}`;

const STATEMENT_QUERY = `
query statement($slug: String!) {
  question(titleSlug: $slug) { content }
}`;

const seen = new Set();

function csrf() {
  const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return m ? m[1] : "";
}

async function graphql(query, variables) {
  const res = await fetch("/graphql/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrftoken": csrf() },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`LeetCode returned HTTP ${res.status}`);
  const body = await res.json();
  if (body.errors) throw new Error(body.errors[0]?.message || "LeetCode GraphQL error");
  return body.data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchDetail(id) {
  // Details can lag a moment behind the "Accepted" result.
  for (let attempt = 0; attempt < 5; attempt++) {
    const data = await graphql(DETAIL_QUERY, { id: Number(id) });
    const detail = data.submissionDetails;
    if (detail?.code) {
      // Premium problems come back with no content unless you have Premium.
      let statement = null;
      try {
        const q = await graphql(STATEMENT_QUERY, { slug: detail.question.titleSlug });
        if (q.question?.content) statement = htmlToMarkdown(q.question.content);
      } catch {}
      return { submissionId: String(id), ...detail, statement };
    }
    await sleep(1500 * (attempt + 1));
  }
  throw new Error("Couldn't read the submission. Are you logged in to LeetCode?");
}

async function sync(id) {
  const detail = await fetchDetail(id);
  return chrome.runtime.sendMessage({ type: "push", detail });
}

function toast(text, ok) {
  const el = document.createElement("div");
  el.textContent = text;
  Object.assign(el.style, {
    position: "fixed", right: "20px", bottom: "20px", zIndex: 2147483647,
    padding: "10px 14px", borderRadius: "8px", font: "500 13px system-ui, sans-serif",
    color: "#fff", background: ok ? "#1f883d" : "#cf222e",
    boxShadow: "0 4px 14px rgba(0,0,0,.25)", maxWidth: "360px",
  });
  (document.body || document.documentElement).appendChild(el);
  setTimeout(() => el.remove(), ok ? 3500 : 8000);
}

function describe(result) {
  if (!result) return ["Sync failed: no response from extension", false];
  if (result.error) return [`GitHub sync failed: ${result.error}`, false];
  if (result.skipped) return ["Already on GitHub", true];
  const note = result.warning ? ` (skipped ${result.warning})` : "";
  return [`Pushed to GitHub: ${result.title}${note}`, true];
}

window.addEventListener("message", async (event) => {
  const msg = event.data;
  if (event.source !== window || msg?.source !== "lc-github-sync" || msg.type !== "accepted") return;
  if (seen.has(msg.submissionId)) return;
  seen.add(msg.submissionId);
  try {
    toast(...describe(await sync(msg.submissionId)));
  } catch (e) {
    seen.delete(msg.submissionId);
    toast(`GitHub sync failed: ${e.message}`, false);
  }
});

// "Sync recent" from the popup: backfill the last 20 accepted submissions.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "syncRecent") return;
  (async () => {
    const { userStatus } = await graphql("{ userStatus { username isSignedIn } }", {});
    if (!userStatus?.isSignedIn) throw new Error("Log in to LeetCode in this tab first");
    const { recentAcSubmissionList: list } = await graphql(RECENT_QUERY, {
      username: userStatus.username, limit: 20,
    });
    const ordered = [...(list || [])].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    let pushed = 0, skipped = 0;
    for (const s of ordered) {
      const result = await sync(s.id);
      if (result?.error) throw new Error(result.error);
      result?.skipped ? skipped++ : pushed++;
    }
    return { pushed, skipped };
  })().then(sendResponse, (e) => sendResponse({ error: e.message }));
  return true; // keep the channel open for the async reply
});
