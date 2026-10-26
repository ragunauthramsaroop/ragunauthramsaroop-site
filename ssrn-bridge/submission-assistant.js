"use strict";
(async function () {
  const select = document.getElementById("paper");
  const metrics = document.getElementById("metrics");
  const fields = document.getElementById("paper-fields");
  const status = document.getElementById("paper-status");

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  async function copy(value, button) {
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = "Copied";
    } catch {
      button.textContent = "Select text to copy";
    }
  }
  function field(name, value) {
    const wrap = el("div", undefined, "field");
    const line = el("div");
    const label = el("strong", name);
    const button = el("button", "Copy", "secondary");
    button.type = "button";
    button.setAttribute("aria-label", "Copy " + name);
    button.addEventListener("click", () => copy(value, button));
    line.append(label, button);
    wrap.append(line, el("pre", value));
    fields.append(wrap);
  }
  function metric(label, amount) {
    const card = el("div", undefined, "metric");
    card.append(el("strong", String(amount)), el("span", label));
    metrics.append(card);
  }
  try {
    const response = await fetch("./manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Manifest unavailable, HTTP " + response.status);
    const manifest = await response.json();
    const all = manifest.papers || [];
    const existing = all.filter(p => p.ssrn_abstract_id);
    const pending = all.filter(p => !p.ssrn_abstract_id);
    const ready = pending.filter(p => p.pdf && p.sha256 && p.abstract);
    const missing = pending.filter(p => !p.pdf);
    metric("Already registered SSRN IDs", existing.length);
    metric("Prepared manuscript candidates", ready.length);
    metric("PDF sources still missing", missing.length);
    select.replaceChildren(new Option("Choose a manuscript", ""));
    for (const p of pending) select.add(new Option(p.title + (p.pdf ? "" : " • Missing PDF"), p.slug));
    function render() {
      fields.replaceChildren();
      const paper = pending.find(p => p.slug === select.value);
      if (!paper) { status.textContent = "Select a manuscript to review its metadata."; return; }
      if (!paper.pdf) {
        status.textContent = "Source PDF still missing. This paper cannot be submitted yet.";
        field("Manuscript title", paper.title);
        return;
      }
      status.textContent = "Prepared candidate only. Not submitted or verified on SSRN.";
      const abstract = paper.abstract + "\n\nAI assistance disclosure: " + paper.ai_disclosure;
      field("Manuscript title", paper.title);
      field("Written date (YYYY-MM-DD)", paper.date);
      field("Abstract including AI disclosure", abstract);
      field("Keywords", (paper.keywords || []).join("; "));
      field("Classification suggestion", paper.classification);
      field("Author", manifest.author);
      field("Declaration of interest", paper.conflict_of_interest);
      field("Research funding", paper.funder_statement);
      field("Ethics", paper.ethics_approval);
      field("Prepared PDF name inside ZIP", paper.slug + "-SSRN-author-review.pdf");
      field("Original PDF checksum SHA-256", paper.sha256);
      const p = el("p", "Check the prepared PDF in the ZIP, not only this metadata. All author's declarations require your review.", "small muted");
      fields.append(p);
    }
    select.addEventListener("change", render);
    if (ready.length) { select.value = ready[0].slug; }
    render();
  } catch (error) {
    select.replaceChildren(new Option("Unable to load manuscript register", ""));
    status.textContent = "Unable to load the register: " + String(error.message || error);
  }
})();