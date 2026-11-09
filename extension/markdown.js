// Converts LeetCode's problem-statement HTML into GitHub Markdown.
// Loaded before content.js; uses the page's DOMParser, no dependencies.

const LC_BLOCK = new Set([
  "p", "div", "pre", "ul", "ol", "blockquote", "table", "section",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr",
]);

function lcEscape(text) {
  return text.replace(/\\/g, "\\\\").replace(/\*/g, "\\*").replace(/</g, "&lt;");
}

function lcInline(node) {
  return [...node.childNodes].map(lcInlineNode).join("");
}

function lcCodeHtml(node) {
  return [...node.childNodes].map((c) => {
    if (c.nodeType === Node.TEXT_NODE) {
      return c.textContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    if (c.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = c.tagName.toLowerCase();
    return tag === "sup" || tag === "sub" ? `<${tag}>${lcCodeHtml(c)}</${tag}>` : lcCodeHtml(c);
  }).join("");
}

function lcWrap(mark, text) {
  // Keep surrounding spaces outside the markers, or GitHub won't render them.
  const m = text.match(/^(\s*)(.*?)(\s*)$/s);
  return m[2] ? `${m[1]}${mark}${m[2]}${mark}${m[3]}` : text;
}

function lcInlineNode(n) {
  if (n.nodeType === Node.TEXT_NODE) return lcEscape(n.textContent.replace(/\s+/g, " "));
  if (n.nodeType !== Node.ELEMENT_NODE) return "";
  const tag = n.tagName.toLowerCase();
  switch (tag) {
    case "strong": case "b": return lcWrap("**", lcInline(n));
    case "em": case "i": return lcWrap("*", lcInline(n));
    case "code": {
      // `10<sup>4</sup>` would flatten to "104" in a Markdown code span, so keep
      // the HTML form whenever there's a superscript or subscript inside.
      if (n.querySelector("sup, sub")) return `<code>${lcCodeHtml(n)}</code>`;
      const t = n.textContent;
      return t.includes("`") ? `\`\` ${t} \`\`` : `\`${t}\``;
    }
    case "sup": return `<sup>${lcInline(n)}</sup>`;
    case "sub": return `<sub>${lcInline(n)}</sub>`;
    case "br": return "  \n";
    case "a": return `[${lcInline(n)}](${n.getAttribute("href") || ""})`;
    case "img": return `![${n.getAttribute("alt") || ""}](${n.getAttribute("src") || ""})`;
    default: return LC_BLOCK.has(tag) ? `\n\n${lcBlock(n)}\n\n` : lcInline(n);
  }
}

function lcBlocks(parent) {
  const out = [];
  let buf = "";
  const flush = () => {
    const t = buf.replace(/[ \t]+\n/g, (s) => (s.endsWith("  \n") ? "  \n" : "\n")).trim();
    if (t) out.push(t);
    buf = "";
  };
  for (const n of parent.childNodes) {
    if (n.nodeType === Node.ELEMENT_NODE && LC_BLOCK.has(n.tagName.toLowerCase())) {
      flush();
      const b = lcBlock(n);
      if (b) out.push(b);
    } else {
      buf += lcInlineNode(n);
    }
  }
  flush();
  return out.join("\n\n");
}

function lcBlock(n) {
  const tag = n.tagName.toLowerCase();
  if (tag === "pre") return "```text\n" + n.textContent.replace(/^\n+|\s+$/g, "") + "\n```";
  if (tag === "ul" || tag === "ol") {
    return [...n.children]
      .filter((li) => li.tagName === "LI")
      .map((li, i) => {
        const marker = tag === "ol" ? `${i + 1}.` : "-";
        const pad = " ".repeat(marker.length + 1);
        return `${marker} ${lcBlocks(li).replace(/\n/g, `\n${pad}`)}`;
      })
      .join("\n");
  }
  if (tag === "blockquote") return lcBlocks(n).split("\n").map((l) => `> ${l}`).join("\n");
  if (tag === "table") return n.outerHTML; // GitHub renders HTML tables as-is
  if (/^h[1-6]$/.test(tag)) return `#### ${lcInline(n).trim()}`; // stay below the README's own headings
  if (tag === "hr") return "---";
  return lcBlocks(n);
}

function htmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  return lcBlocks(doc.body).replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
