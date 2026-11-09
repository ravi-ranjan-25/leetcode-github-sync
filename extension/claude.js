import Anthropic from "./vendor/anthropic-sdk.js";

const SUMMARY_MODEL = "claude-opus-5-5";
const REVIEW_MODEL = "claude-sonnet-5-5";

const SUMMARY_SYSTEM = `You write the summary at the top of a README for one solved LeetCode problem.
Write 2-3 plain sentences, no headings or bullet points:
1. What the problem asks, in your own words (do not copy the statement).
2. The approach the given solution takes, and its time and space complexity.
Describe the solution as it is written, even if a better approach exists.`;

const REVIEW_SYSTEM = `You are a Google interviewer assessing a candidate for an SDE-2 (L4) role.
The candidate solved the LeetCode problem below; their submission was accepted. Judge it the way
you would in a real coding round: correctness, optimality of time and space, code quality
(naming, structure, readability), and handling of edge cases. Passing LeetCode's tests is the
floor, not the bar. Be direct and specific: point at actual lines or choices in their code.

Reply in GitHub Markdown, in exactly this structure:

**Verdict:** <one of: Strong Hire, Hire, Lean Hire, Lean No Hire, No Hire>

| Area | Score (1-5) | Note |
|---|---|---|
| Correctness | | |
| Time & space | | |
| Code quality | | |
| Edge cases | | |

## What works
<2-4 bullets>

## What to change
<numbered list, most important first; for each, what is wrong and what to do instead>

## Better approach
<only if a meaningfully better algorithm exists: explain it, give its complexity, and show
a short code sketch in the candidate's language. Otherwise write "The approach is optimal.">

## Follow-ups an interviewer might ask
<2-3 bullets>`;

const LEARN_SYSTEM = `You are a coding-interview coach. A candidate solved the LeetCode problem below; their
submission was accepted. Decide whether there is a concept, pattern, data structure or algorithm that solves
this problem better (or is the standard technique for it) and that the candidate's code does NOT already use.
Examples: monotonic stack, sliding window, prefix sum, two pointers, binary search on the answer, union-find,
topological sort, Dijkstra, bit manipulation, Kadane's algorithm, Boyer-Moore voting, trie, segment tree.

If the candidate's solution already uses the best technique for this problem, reply with exactly: NONE

Otherwise reply with a short note, in exactly this structure and nothing else. Keep it short: the reader
follows a link to a full tutorial on the technique, so do not explain the technique itself or write code.

## Learn: <the technique's standard name, 2-5 words, as GeeksforGeeks or LeetCode would call it>

**Why here:** <one sentence: what it gives this problem over the candidate's approach, with both complexities>

**How it applies here:** <2-3 sentences: what to store, precompute or move in this problem>

The candidate may already have met some techniques on earlier problems; they are listed in <already_learned>.
If the technique is one of those (the same technique, even under another name), use the name exactly as listed.`;

function client(apiKey) {
  // Runs in the extension's background worker; the key never reaches leetcode.com.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

function explain(error) {
  if (error instanceof Anthropic.AuthenticationError) return "Claude API key is invalid";
  if (error instanceof Anthropic.PermissionDeniedError) return "Claude API key lacks access to this model";
  if (error instanceof Anthropic.RateLimitError) return "Claude API rate limit hit; resync later";
  if (error instanceof Anthropic.APIConnectionError) return "couldn't reach the Claude API";
  if (error instanceof Anthropic.APIError) return `Claude API error ${error.status}`;
  return error.message;
}

function problemPrompt(d) {
  return (
    `Problem: ${d.question.title} (${d.question.difficulty})\n\n` +
    `<statement>\n${d.statement || "(not available)"}\n</statement>\n\n` +
    `<solution language="${d.lang.verboseName}">\n${d.code}\n</solution>`
  );
}

async function ask(apiKey, { model, effort, system, maxTokens, d, extra = "" }) {
  try {
    const response = await client(apiKey).beta.messages.create({
      model,
      max_tokens: maxTokens,
      output_config: { effort },
      // Re-runs a safety-declined request on Anthropic's recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content: problemPrompt(d) + extra }],
    });
    if (response.stop_reason === "refusal") return { error: "Claude declined this one" };
    if (response.stop_reason === "max_tokens") return { error: "Claude's reply was cut off" };
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text ? { text } : { error: "Claude returned an empty reply" };
  } catch (e) {
    return { error: explain(e) };
  }
}

export async function summarize(apiKey, d) {
  const r = await ask(apiKey, { model: SUMMARY_MODEL, effort: "low", system: SUMMARY_SYSTEM, maxTokens: 4000, d });
  return r.error ? { error: r.error } : { summary: r.text };
}

const VERDICTS = ["Strong Hire", "Lean No Hire", "Lean Hire", "No Hire", "Hire"]; // longest match first

export async function review(apiKey, d) {
  const r = await ask(apiKey, { model: REVIEW_MODEL, effort: "medium", system: REVIEW_SYSTEM, maxTokens: 16000, d });
  if (r.error) return { error: r.error };
  const line = r.text.match(/\*\*Verdict:\*\*\s*([^\n]+)/)?.[1] || "";
  const verdict = VERDICTS.find((v) => line.toLowerCase().includes(v.toLowerCase())) || null;
  return { review: r.text, verdict };
}

// Learning material for a technique the solution doesn't use yet. { learning: null } when there is none.
// known: names of techniques met on earlier problems, so Claude names a repeat the same way.
export async function learn(apiKey, d, known = []) {
  const extra = known.length
    ? `\n\n<already_learned>\n${known.map((name) => `- ${name}`).join("\n")}\n</already_learned>`
    : "\n\n<already_learned>\n(none yet)\n</already_learned>";
  const r = await ask(apiKey, { model: REVIEW_MODEL, effort: "low", system: LEARN_SYSTEM, maxTokens: 4000, d, extra });
  if (r.error) return { error: r.error };
  if (/^NONE\b/.test(r.text)) return { learning: null, concept: null };
  const start = r.text.search(/^## Learn:/m);
  if (start < 0) return { error: "Claude's learning material was not in the expected format" };
  const learning = r.text.slice(start).trim();
  const concept = learning.match(/^## Learn:\s*(.+)$/m)[1].trim();
  return { learning, concept };
}

// Cheap key check for the settings screen: looks up the models, generates nothing.
export async function checkKey(apiKey) {
  try {
    const c = client(apiKey);
    await Promise.all([c.models.retrieve(SUMMARY_MODEL), c.models.retrieve(REVIEW_MODEL)]);
    return {};
  } catch (e) {
    return { error: explain(e) };
  }
}
