// Commits one accepted submission to the repo as a single commit.
// Pure fetch, no chrome.* calls, so it can be tested outside the browser.

const EXTENSIONS = {
  python: "py", python3: "py", pythondata: "py", java: "java", cpp: "cpp", c: "c",
  csharp: "cs", javascript: "js", typescript: "ts", golang: "go", rust: "rs",
  kotlin: "kt", swift: "swift", scala: "scala", ruby: "rb", php: "php", dart: "dart",
  racket: "rkt", erlang: "erl", elixir: "ex", mysql: "sql", mssql: "sql",
  oraclesql: "sql", postgresql: "sql", bash: "sh",
};

import { gfgLink } from "./gfg.js";

const STATE_PATH = ".sync-state.json";

export class GitHubError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(token, method, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    // GitHub marks GET responses cacheable for 60s. Without this, Chrome hands back
    // the branch tip from before our last push and the next commit is rejected.
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404 && method === "GET") return null;
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const hint = {
      401: "GitHub token is invalid or expired. Make a new one and paste it in the extension.",
      403: "Token can't write to this repo. Give it Contents: Read and write on this repo.",
      404: "Repo not found. Check the name, and that the token has access to it.",
    }[res.status];
    throw new GitHubError(res.status, hint || data?.message || `GitHub returned HTTP ${res.status}`);
  }
  return data;
}

function decodeBase64Utf8(b64) {
  const bin = atob(b64.replace(/\n/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

const pad = (id) => String(id).padStart(4, "0");

/** GitHub's anchor for a heading: "## Learn: Union-Find (DSU)" -> "learn-union-find-dsu". */
const anchor = (heading) => heading.toLowerCase().replace(/[^a-z0-9 -]/g, "").trim().replace(/ /g, "-");

/**
 * Techniques already met, with the problem where they first came up (the earliest one).
 * Entries from before 1.5 have no learnKind; they were all first mentions.
 */
function taughtTechniques(problems, exceptId) {
  const out = new Map();
  for (const p of Object.values(problems).sort((a, b) => Number(a.id) - Number(b.id))) {
    if (p.id === exceptId || !p.learn || (p.learnKind || "full") !== "full") continue;
    const key = p.learn.toLowerCase();
    if (!out.has(key)) out.set(key, { name: p.learn, id: p.id, title: p.title, folder: p.path.slice(0, p.path.lastIndexOf("/")) });
  }
  return out;
}

/**
 * Turns Claude's short learning note into what goes in REVIEW.md: the note plus a GeeksforGeeks link for the
 * technique. A technique met before keeps its earlier name and links to the problem where it first came up.
 */
function shapeLearning(l, taught) {
  const prior = taught.get(l.concept.toLowerCase());
  const concept = prior ? prior.name : l.concept;
  const url = gfgLink(concept);
  const body = l.learning.replace(/^## Learn:.*\n?/, "").trim();
  const seen = prior
    ? `*Seen before in [${prior.id}. ${prior.title}](../${prior.folder.slice(prior.folder.lastIndexOf("/") + 1)}/REVIEW.md#${anchor(`Learn: ${prior.name}`)}).*\n\n`
    : "";
  return {
    learning: `## Learn: ${concept}\n\n${seen}${body}\n\n**Read:** [${concept} on GeeksforGeeks](${url})`,
    concept,
    url,
    kind: prior ? "reminder" : "full",
  };
}

/** The review without any "## Learn:" section (it is always the last one). */
const withoutLearning = (review) => review.replace(/\n## Learn:[\s\S]*$/, "").trimEnd();

function reviewFile(d, review, learning) {
  const q = d.question;
  return [
    `# Review: ${q.questionFrontendId}. ${q.title}`,
    "",
    `*Claude Sonnet 5.5, reviewing this [${d.lang.verboseName} solution](${solutionName(d)}) the way a Google SDE-2 interviewer would.*`,
    "",
    withoutLearning(review.trim()),
    "",
    ...(learning ? [learning.trim(), ""] : []),
  ].join("\n");
}

const solutionName = (d) => `solution.${EXTENSIONS[d.lang.name] || "txt"}`;

/** YYYY-MM-DD in the browser's own timezone (en-CA formats dates that way). */
const solvedDate = (timestamp) => new Date(Number(timestamp) * 1000).toLocaleDateString("en-CA");

function problemReadme(d, { statement, summary, hasReview, verdict, learn, learnKind, firstSolved, lastSolved }) {
  const q = d.question;
  const tags = (d.topicTags || []).map((t) => t.name).join(", ") || "-";
  let runtime = d.runtimeDisplay || "-";
  let memory = d.memoryDisplay || "-";
  if (d.runtimePercentile != null) runtime += ` (beats ${d.runtimePercentile.toFixed(1)}%)`;
  if (d.memoryPercentile != null) memory += ` (beats ${d.memoryPercentile.toFixed(1)}%)`;
  const lines = [
    `# ${q.questionFrontendId}. ${q.title}`,
    "",
    `- **Difficulty:** ${q.difficulty}`,
    `- **Solved:** ${firstSolved}${lastSolved && lastSolved !== firstSolved ? ` (last solved ${lastSolved})` : ""}`,
    `- **Topics:** ${tags}`,
    `- **Problem:** https://leetcode.com/problems/${q.titleSlug}/`,
    `- **Language:** ${d.lang.verboseName}`,
    `- **Runtime:** ${runtime}`,
    `- **Memory:** ${memory}`,
    ...(hasReview ? [`- **Interviewer review:** [${verdict || "Read it"}](REVIEW.md)`] : []),
    ...(hasReview && learn ? [`- **Learn:** [${learn}](REVIEW.md#${anchor(`Learn: ${learn}`)})${learnKind === "reminder" ? " (reminder)" : ""}`] : []),
    "",
  ];
  if (summary) lines.push("## Summary", "", `> ${summary.replace(/\n+/g, "\n>\n> ")}`, ">", "> *Written by Claude*", "");
  // The statement is LeetCode's copyrighted text: fine in a private repo, but
  // turn it off in the extension and scrub history before making the repo public.
  if (statement) lines.push("## Problem", "", statement, "");
  return lines.join("\n");
}

function indexReadme(problems) {
  const list = Object.values(problems).sort((a, b) => Number(a.id) - Number(b.id));
  const counts = { Easy: 0, Medium: 0, Hard: 0 };
  for (const p of list) counts[p.difficulty] = (counts[p.difficulty] || 0) + 1;
  const rows = list.map((p) => {
    const folder = p.path.slice(0, p.path.lastIndexOf("/"));
    const review = p.hasReview ? `[${p.verdict || "Review"}](${folder}/REVIEW.md)` : "-";
    const learn = p.hasReview && p.learn
      ? `[${p.learn}](${folder}/REVIEW.md#${anchor(`Learn: ${p.learn}`)})${p.learnKind === "reminder" ? " (reminder)" : ""}`
      : "-";
    return `| ${p.id} | [${p.title}](https://leetcode.com/problems/${p.slug}/) | ${p.difficulty} | [${p.lang}](${p.path}) | ${review} | ${learn} |`;
  });
  return [
    "# LeetCode Solutions",
    "",
    "Accepted solutions, pushed automatically by a [browser extension](extension/) when LeetCode accepts them.",
    "",
    `**${list.length} solved** · Easy ${counts.Easy} · Medium ${counts.Medium} · Hard ${counts.Hard}`,
    "",
    "| # | Problem | Difficulty | Solution | Interviewer verdict | Learn |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}

/** The review text of a REVIEW.md already in the repo (without its title and credit line), or null. */
async function existingReview(token, repo, ref, folder) {
  const f = await api(token, "GET", `/repos/${repo}/contents/${folder}/REVIEW.md?ref=${ref}`);
  if (!f) return null;
  const lines = decodeBase64Utf8(f.content).split("\n");
  let i = 0;
  if (lines[i]?.startsWith("# ")) i++;
  while (i < lines.length && !lines[i].trim()) i++;
  if (/^\*.*\*$/.test(lines[i]?.trim() || "")) i++;
  return lines.slice(i).join("\n").trim() || null;
}

async function attemptPush({ token, repo, branch, author }, d, { wantStatement, getSummary, getReview, getLearning }) {
  const ref = await api(token, "GET", `/repos/${repo}/git/ref/heads/${branch}`);
  if (!ref) throw new GitHubError(404, `Branch ${branch} not found in ${repo}`);
  const parent = ref.object.sha;

  const stateFile = await api(token, "GET", `/repos/${repo}/contents/${STATE_PATH}?ref=${parent}`);
  const state = stateFile ? JSON.parse(decodeBase64Utf8(stateFile.content)) : {};
  state.synced ||= [];
  state.problems ||= {};

  const q = d.question;
  const prev = state.problems[q.questionFrontendId];
  const statement = wantStatement ? d.statement : null;
  const skipped = { skipped: true, title: q.title };

  // Submission IDs only go up, so a lower ID than the stored one is an older attempt.
  if (prev?.submissionId && Number(d.submissionId) < Number(prev.submissionId)) return skipped;

  // Already pushed: only revisit it to fill in whatever is missing, and only if it's
  // still the problem's current solution (never roll back newer code).
  const backfill = state.synced.includes(d.submissionId);
  if (backfill && prev?.submissionId !== d.submissionId) return skipped;
  const need = {
    statement: !!statement && !(backfill && prev.hasStatement),
    summary: !!getSummary && !(backfill && prev.summary),
    review: !!getReview && !(backfill && prev.hasReview),
    // Learning material lives in REVIEW.md: written with a new review, or added to an existing one.
    "learning material": !!getLearning && !(backfill && prev.hasLearning),
    // Problems pushed before READMEs had a solved date.
    "solved date": backfill && !prev.lastSolved,
  };
  if (backfill && !Object.values(need).some(Boolean)) return skipped;

  const ext = EXTENSIONS[d.lang.name] || "txt";
  const folder = `problems/${pad(q.questionFrontendId)}-${q.titleSlug}`;
  // No review to put it in (none yet and none coming): leave learning for when there is one.
  const reviewExists = backfill && prev.hasReview;
  if (need["learning material"] && !need.review && !reviewExists) need["learning material"] = false;

  const taught = taughtTechniques(state.problems, q.questionFrontendId);
  const [s, r, raw] = await Promise.all([
    need.summary ? getSummary() : {},
    need.review ? getReview() : {},
    need["learning material"] ? getLearning([...taught.values()].map((t) => t.name)) : {},
  ]);
  const l = raw.learning ? shapeLearning(raw, taught) : raw;
  const warning = [s.error && `summary: ${s.error}`, r.error && `review: ${r.error}`, l.error && `learning: ${l.error}`]
    .filter(Boolean).join("; ") || undefined;
  // Learning only lands with a review: the new one, or the existing one when only learning is added.
  const reviewForLearning = r.review ? r.review : !need.review && reviewExists ? await existingReview(token, repo, parent, folder) : null;
  const learned = need["learning material"] && !l.error && reviewForLearning !== null;
  const got = {
    statement: need.statement, summary: !!s.summary, review: !!r.review,
    "learning material": learned && !!l.learning, "learning check": learned && !l.learning,
    "solved date": need["solved date"],
  };
  if (backfill && !Object.values(got).some(Boolean)) return { ...skipped, warning };

  // First solve is kept across re-solves; the latest is this submission's date.
  const lastSolved = solvedDate(d.timestamp);
  const firstSolved = prev?.firstSolved && prev.firstSolved < lastSolved ? prev.firstSolved : lastSolved;

  const keep = (field) => (backfill ? prev[field] : null);
  const summary = s.summary || keep("summary");
  const hasReview = got.review || !!keep("hasReview");
  const verdict = got.review ? r.verdict : keep("verdict");
  // A new review replaces the old learning; without new learning it must be checked again.
  const hasLearning = learned || (!got.review && !!keep("hasLearning"));
  const learn = learned ? l.concept : got.review ? null : keep("learn");
  const learnKind = learned ? (l.learning ? l.kind : null) : got.review ? null : keep("learnKind");
  const learnUrl = learned ? (l.learning ? l.url : null) : got.review ? null : keep("learnUrl");

  const solutionPath = `${folder}/solution.${ext}`;

  const files = [{ path: solutionPath, content: d.code.trimEnd() + "\n" }];
  // Switched language on a re-solve: drop the old file so the folder holds one solution.
  if (prev?.path && prev.path !== solutionPath) files.push({ path: prev.path, sha: null });
  if (got.review || got["learning material"]) {
    const body = got.review ? r.review : reviewForLearning;
    files.push({ path: `${folder}/REVIEW.md`, content: reviewFile(d, body, learned ? l.learning : null) });
  } else if (!backfill && prev?.hasReview) {
    // New solution but its review failed: the old review is about different code.
    files.push({ path: `${folder}/REVIEW.md`, sha: null });
  }

  if (!backfill) state.synced.push(d.submissionId);
  state.problems[q.questionFrontendId] = {
    id: q.questionFrontendId, title: q.title, slug: q.titleSlug,
    difficulty: q.difficulty, lang: d.lang.verboseName, path: solutionPath,
    submissionId: d.submissionId, hasStatement: !!statement,
    summary: summary || null, hasReview, verdict: verdict || null,
    hasLearning, learn: learn || null, learnKind: learn ? learnKind || "full" : null,
    learnUrl: learn ? learnUrl || null : null,
    firstSolved, lastSolved,
  };
  files.push(
    { path: `${folder}/README.md`, content: problemReadme(d, { statement, summary, hasReview, verdict, learn, learnKind, firstSolved, lastSolved }) },
    { path: "README.md", content: indexReadme(state.problems) },
    { path: STATE_PATH, content: JSON.stringify(state, null, 2) + "\n" }
  );

  const parentCommit = await api(token, "GET", `/repos/${repo}/git/commits/${parent}`);
  const tree = await api(token, "POST", `/repos/${repo}/git/trees`, {
    base_tree: parentCommit.tree.sha,
    tree: files.map((f) => ({
      path: f.path, mode: "100644", type: "blob",
      ...("sha" in f ? { sha: f.sha } : { content: f.content }),
    })),
  });
  const added = Object.keys(got).filter((k) => got[k]);
  const list = added.length > 1 ? `${added.slice(0, -1).join(", ")} and ${added.at(-1)}` : added[0];
  const commit = await api(token, "POST", `/repos/${repo}/git/commits`, {
    message: backfill
      ? `Add ${list} to ${q.questionFrontendId}. ${q.title}`
      : `Add ${q.questionFrontendId}. ${q.title} (${d.lang.verboseName})`,
    tree: tree.sha,
    parents: [parent],
    // Dated to the submission, so the contribution graph shows the day you solved it.
    author: { ...author, date: new Date(Number(d.timestamp) * 1000).toISOString() },
  });
  await api(token, "PATCH", `/repos/${repo}/git/refs/heads/${branch}`, { sha: commit.sha });
  return { pushed: true, title: q.title, commit: commit.html_url, ...(warning && { warning }) };
}

// options.wantStatement: include the problem statement in the README.
// options.summarize: async () => ({ summary } | { error }), or null to skip summaries.
// options.review: async () => ({ review, verdict } | { error }), or null to skip reviews.
// options.learn: async () => ({ learning, concept } | { error }), learning null when nothing new; null to skip.
export async function pushSubmission(settings, detail, { wantStatement = false, summarize = null, review = null, learn = null } = {}) {
  // Memoized so a retry after a branch race doesn't pay for a second Claude call.
  const once = (fn) => { let p; return fn && ((...args) => (p ||= fn(...args))); };
  const getSummary = once(summarize);
  const getReview = once(review);
  const getLearning = once(learn);
  for (let attempt = 1; ; attempt++) {
    try {
      return await attemptPush(settings, detail, { wantStatement, getSummary, getReview, getLearning });
    } catch (e) {
      // 422 on the ref update = the branch moved under us (or GitHub's read was
      // briefly stale). Rebuild on the current tip, backing off a little each time.
      if (!(e instanceof GitHubError && e.status === 422) || attempt >= 4) throw e;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

// Validates a token + repo pair and returns what the extension needs to store.
export async function checkSetup(token, repo) {
  const r = await api(token, "GET", `/repos/${repo}`);
  if (!r) throw new GitHubError(404, "Repo not found. Check the name, and that the token has access to it.");
  const user = await api(token, "GET", "/user");
  return {
    repo: r.full_name,
    branch: r.default_branch,
    author: { name: user.login, email: `${user.id}+${user.login}@users.noreply.github.com` },
  };
}
