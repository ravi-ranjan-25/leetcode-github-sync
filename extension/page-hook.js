// Runs inside the LeetCode page itself. It only watches the "check" responses
// LeetCode polls after you hit Submit, and announces accepted submission IDs.
// It never sees your GitHub token.
(() => {
  const CHECK = /\/submissions\/detail\/(\d+)\/check\/?/;
  const ACCEPTED = 10;

  function report(url, data) {
    const m = CHECK.exec(url);
    if (!m || !data || data.state !== "SUCCESS" || data.status_code !== ACCEPTED) return;
    window.postMessage(
      { source: "lc-github-sync", type: "accepted", submissionId: m[1] },
      location.origin
    );
  }

  const toUrl = (input) => String(input instanceof Request ? input.url : input);

  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const res = await origFetch.apply(this, arguments);
    try {
      const url = toUrl(input);
      if (CHECK.test(url)) res.clone().json().then((d) => report(url, d), () => {});
    } catch {}
    return res;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      const u = String(url);
      if (CHECK.test(u)) {
        this.addEventListener("load", () => {
          try { report(u, JSON.parse(this.responseText)); } catch {}
        });
      }
    } catch {}
    return origOpen.apply(this, arguments);
  };
})();
