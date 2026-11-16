/* Visual-first executive reading order for the HKEX 2259 dashboard.
 * Move existing DOM nodes, never clone visualizations or private form fields.
 * Run before the other defer scripts so all listeners retain their original IDs.
 */
(() => {
  "use strict";
  function applyVisualFirst() {
    const main = document.getElementById("main");
    const overview = document.getElementById("overview");
    const charting = document.getElementById("charting");
    const technicals = document.getElementById("technicals");
    const risk = document.getElementById("risk-lab");
    const scenarios = document.getElementById("scenarios");
    const settlement = document.getElementById("settlement");
    const mines = document.getElementById("mines");
    const evidence = document.getElementById("evidence");
    const news = document.getElementById("news");
    const sources = document.getElementById("sources");
    const sections = [overview, charting, technicals, risk, scenarios, mines, settlement, evidence, news, sources];
    if (!main || sections.some(section => !section) || main.dataset.visualFirst === "true") return;

    // Put the full interactive charts immediately after the short overview and
    // timestamped KPIs. Move licensing/connection setup to the audit trail.
    const quoteRisk = overview.querySelector(".overview-grid");
    const comparison = charting.querySelector(".comparison-panel");
    if (quoteRisk && comparison) comparison.insertAdjacentElement("afterend", quoteRisk);
    const entitlement = overview.querySelector(".realtime-access");
    const licenseRegister = sources.querySelector(".license-compliance");
    if (entitlement && licenseRegister) licenseRegister.insertAdjacentElement("afterend", entitlement);

    // Retain the original form elements, ids, listeners and accessible labels.
    // Each model's graphical outcome now precedes its input controls.
    const quantControls = risk.querySelector(".quant-controls");
    const quantPairs = risk.querySelector(".quant-two");
    if (quantControls && quantPairs) quantPairs.insertAdjacentElement("afterend", quantControls);
    const modelControls = scenarios.querySelector(".model-controls");
    const stress = scenarios.querySelector(".stress-panel");
    if (modelControls && stress) stress.insertAdjacentElement("afterend", modelControls);
    const awardDistribution = settlement.querySelector(".award-risk-panel");
    const calculator = settlement.querySelector(".calculator-grid");
    if (awardDistribution && calculator) calculator.insertAdjacentElement("beforebegin", awardDistribution);
    const signalNotes = technicals.querySelector(".signal-notes");
    const technicalRow = technicals.querySelector(".two-column");
    if (signalNotes && technicalRow) technicalRow.insertAdjacentElement("afterend", signalNotes);

    // Keep all production/financial infographics ahead of the news and source desk.
    const readingOrder = [overview, charting, technicals, risk, scenarios, mines, settlement, evidence, news, sources];
    for (const section of readingOrder) main.appendChild(section);
    const sidebar = document.querySelector(".side-nav");
    if (sidebar) {
      for (const section of readingOrder) {
        const nav = sidebar.querySelector('[data-nav="' + section.id + '"]');
        if (nav) sidebar.appendChild(nav);
      }
    }
    readingOrder.slice(1).forEach((section, index) => {
      const number = String(index + 1).padStart(2, "0");
      const kicker = section.querySelector(".section-head .section-kicker");
      const marker = section.querySelector(".section-head .section-index");
      if (kicker) kicker.textContent = kicker.textContent.replace(/^\d{2}\s*\//, number + " /");
      if (marker) marker.textContent = number;
    });
    main.dataset.visualFirst = "true";
    document.documentElement.classList.add("visual-first");
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyVisualFirst, {once: true});
  } else {
    applyVisualFirst();
  }
})();
