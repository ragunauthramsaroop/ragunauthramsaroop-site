/* Edition 11: first-party progressive navigation, motion controls and reader guidance.
   No storage, tracking, remote libraries or network search. */
(() => {
  "use strict";
  const sheet = document.createElement("link");
  sheet.rel = "stylesheet";
  sheet.href = "/assets/home-experience-2026.css";
  sheet.addEventListener("load", initialize, { once: true });
  document.head.append(sheet);

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function initialize() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const doc = document.documentElement;
    const mobileMenu = document.querySelector(".mobile-nav");
    let paused = reduce.matches;
    doc.dataset.rrMotion = paused ? "off" : "on";

    const chapters = [
      ["#speaking", "Speaking"],
      ["#decision-paths", "Executive paths"],
      ["#position-title", "Perspective"],
      ["#expertise-title", "Responsibilities"],
      ["#evidence-title", "Evidence"],
      ["#executive-desk", "Research desk"],
      ["#engage-title", "Contact"]
    ].map(([hash, label]) => ({ hash, label, target: document.querySelector(hash) }))
      .filter(item => item.target);

    const rail = el("nav", "rr-rail");
    rail.setAttribute("aria-label", "Homepage chapter navigation");
    const railTop = el("div", "rr-rail__title", "THE BRIEF");
    rail.append(railTop);
    const railCount = el("span", "rr-rail__count", "01 / " + String(chapters.length).padStart(2, "0"));
    rail.append(railCount);
    const railList = el("div", "rr-rail__list");
    chapters.forEach(item => {
      const link = el("a", "rr-rail__link");
      link.href = item.hash;
      link.setAttribute("aria-label", "Go to " + item.label);
      const dot = el("span", "rr-rail__dot");
      dot.setAttribute("aria-hidden", "true");
      const label = el("span", "rr-rail__text", item.label);
      label.setAttribute("aria-hidden", "true");
      link.append(dot, label);
      railList.append(link);
      item.link = link;
    });
    rail.append(railList);

    const motionButtons = [];
    function addMotionButton(parent, cls) {
      const btn = el("button", cls, "Pause motion");
      btn.type = "button";
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-label", "Pause decorative motion");
      btn.addEventListener("click", () => {
        if (!reduce.matches) setPaused(!paused);
      });
      parent.append(btn);
      motionButtons.push(btn);
    }
    addMotionButton(rail, "rr-rail__motion");
    document.body.append(rail);

    const back = el("button", "rr-backtop", "↑");
    back.type = "button";
    back.setAttribute("aria-label", "Back to top");
    back.title = "Back to top";
    back.addEventListener("click", () => window.scrollTo({
      top: 0, behavior: paused ? "auto" : "smooth"
    }));
    document.body.append(back);

    function revealAll() {
      document.querySelectorAll(".rr-reveal").forEach(node => node.classList.add("rr-is-visible"));
    }
    function setPaused(value) {
      paused = value;
      doc.dataset.rrMotion = value ? "off" : "on";
      motionButtons.forEach(btn => {
        btn.setAttribute("aria-pressed", String(value));
        btn.textContent = reduce.matches ? "Device motion reduced" : value ? "Resume motion" : "Pause motion";
        btn.setAttribute("aria-label", reduce.matches ? "Device motion reduced" : value ? "Resume decorative motion" : "Pause decorative motion");
        btn.disabled = reduce.matches;
      });
      if (value) revealAll();
    }
    reduce.addEventListener?.("change", event => setPaused(event.matches));
    setPaused(paused);

    let requested = false;
    function updatePosition() {
      requested = false;
      const cursor = window.innerHeight * .43;
      let current = 0;
      chapters.forEach((item, index) => {
        if (item.target.getBoundingClientRect().top <= cursor) current = index;
      });
      chapters.forEach((item, index) => {
        if (index === current) item.link.setAttribute("aria-current", "location");
        else item.link.removeAttribute("aria-current");
      });
      railCount.textContent = String(current + 1).padStart(2, "0") + " / " + String(chapters.length).padStart(2, "0");
      back.classList.toggle("rr-is-visible", window.scrollY > 660);
    }
    function requestPosition() {
      if (requested) return;
      requested = true;
      requestAnimationFrame(updatePosition);
    }
    addEventListener("scroll", requestPosition, { passive: true });
    addEventListener("resize", requestPosition, { passive: true });
    updatePosition();

    // Let readers open the deeper public briefing for each executive discipline.
    const disciplineRoutes = [
      ["/corporate-affairs/", "Explore external affairs"],
      ["/esg-social-impact/", "Explore social responsibility"],
      ["/compliance-governance/", "Explore governance"],
      ["/leadership/", "Explore people leadership"]
    ];
    document.querySelectorAll(".flag-expertise__row").forEach((row, index) => {
      const route = disciplineRoutes[index];
      const copy = row.querySelector("div");
      if (!route || !copy) return;
      const link = el("a", "rr-discipline-link", route[1] + " ↗");
      link.href = route[0];
      copy.append(link);
    });

    // Light reveals: normal HTML stays fully visible until the enhancement loads.
    if (!paused && "IntersectionObserver" in window) {
      const selectors = [
        ".flag-speaking__past", ".flag-speaking__talk", ".flag-honours__grid",
        ".flag-pathway", ".flag-position__meta", ".flag-position__body",
        ".flag-expertise__row", ".flag-evidence__list a",
        ".flag-desk__list a", ".flag-research__feature", ".flag-research__side"
      ];
      const blocks = document.querySelectorAll(selectors.join(","));
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("rr-is-visible");
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: "0px 0px -6% 0px", threshold: .03 });
      blocks.forEach(node => {
        // Never conceal the first screen or a fragment navigated directly.
        if (node.getBoundingClientRect().top < window.innerHeight * .93) return;
        node.classList.add("rr-reveal");
        observer.observe(node);
      });
    }

    if (!("HTMLDialogElement" in window)) return;
    const directory = [
      ["Leadership Atlas", "Interactive executive mandate", "/leadership-atlas/", "visual responsibilities infographic"],
      ["Living executive dossier", "Immersive leadership story", "/experience/", "interactive journey story"],
      ["Board & CEO briefing", "Strategic leadership perspective", "/board-ceo-mode/", "directors governance"],
      ["Executive recruiter toolkit", "Experience, role fit and evidence", "/recruiter-toolkit/", "career search recruitment"],
      ["Executive CV", "Career progression and credentials", "/resume.html", "resume curriculum vitae"],
      ["Public record", "Dated roles and source boundaries", "/public-record/", "verification proof"],
      ["Proof in practice", "Professional contribution", "/proof-in-practice/", "case studies accountability"],
      ["International speaking", "Panama keynote and panel", "#speaking", "events conference presentation"],
      ["Research library", "Papers, analysis and reports", "/research-library/", "whitepapers publications"],
      ["Guyana intelligence", "Country and institutional data", "/guyana-intelligence/", "government country"],
      ["Public tools", "Free browser-based resources", "/tools/", "calculators apps"],
      ["Professional contact", "Executive mandates and partnerships", "/engage/", "email opportunities"]
    ];
    const dialog = el("dialog", "rr-command");
    dialog.setAttribute("aria-labelledby", "rr-command-title");
    dialog.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); dialog.close(); }
    });
    const head = el("div", "rr-command__head");
    const eyebrow = el("p", "rr-command__eyebrow", "EXECUTIVE SITE / QUICK NAVIGATOR");
    const title = el("h2", "rr-command__title", "Where would you like to go?");
    title.id = "rr-command-title";
    const close = el("button", "rr-command__close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close quick navigator");
    close.addEventListener("click", () => dialog.close());
    head.append(eyebrow, title, close);

    const field = el("div", "rr-command__field");
    const input = el("input", "rr-command__input");
    input.type = "search";
    input.placeholder = "Find CV, research, leadership, speaking…";
    input.setAttribute("aria-label", "Filter website destinations");
    input.autocomplete = "off";
    field.append(input);
    const status = el("p", "rr-command__status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const list = el("div", "rr-command__results");
    const records = directory.map(([name, description, href, tags]) => {
      const link = el("a", "rr-command__result");
      link.href = href;
      link.append(el("strong", "", name), el("span", "", description));
      list.append(link);
      return { link, search: (name + " " + description + " " + tags).toLowerCase() };
    });
    const footer = el("div", "rr-command__foot", "CTRL / ⌘ + K  ·  FILTERS LOCALLY  ·  ENTER OPENS SITE SEARCH");
    dialog.append(head, field, status, list, footer);
    addMotionButton(footer, "rr-dialog-motion");
    setPaused(paused);
    document.body.append(dialog);

    function filter() {
      const query = input.value.trim().toLowerCase();
      let count = 0;
      records.forEach(item => {
        item.link.hidden = !item.search.includes(query);
        if (!item.link.hidden) count++;
      });
      status.textContent = count ? count + (count === 1 ? " destination" : " destinations") : "No matching shortcut. Press Enter to search published research.";
    }
    function open() {
      if (dialog.open) return;
      filter();
      dialog.showModal();
      input.focus();
      input.select();
      if (mobileMenu) mobileMenu.open = false;
    }
    input.addEventListener("input", filter);
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        const first = records.find(item => !item.link.hidden);
        location.assign(first ? first.link.href : "/search/?q=" + encodeURIComponent(input.value.trim()));
      }
      if (event.key === "ArrowDown") {
        const first = records.find(item => !item.link.hidden);
        if (first) { event.preventDefault(); first.link.focus(); }
      }
    });
    list.addEventListener("keydown", event => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const items = records.map(r => r.link).filter(link => !link.hidden);
      const index = items.indexOf(document.activeElement);
      const next = items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
      if (next) { event.preventDefault(); next.focus(); }
    });
    document.addEventListener("keydown", event => {
      const element = event.target;
      const editing = element instanceof HTMLElement &&
        (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName));
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialog.open) dialog.close(); else open();
      } else if (event.key === "/" && !editing && !dialog.open && !event.altKey) {
        event.preventDefault();
        open();
      }
    });

    const trigger = el("button", "rr-find", "Find on this site");
    trigger.type = "button";
    trigger.setAttribute("aria-keyshortcuts", "Control+K Meta+K");
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.addEventListener("click", open);
    const menu = document.querySelector(".nav");
    if (menu) menu.insertBefore(trigger, mobileMenu || null);
    const mobileContents = mobileMenu?.querySelector("div");
    if (mobileContents) {
      const mobileTrigger = el("button", "rr-mobile-find", "Find a page or resource");
      mobileTrigger.type = "button";
      mobileTrigger.addEventListener("click", open);
      mobileContents.append(mobileTrigger);
      addMotionButton(mobileContents, "rr-mobile-motion");
      setPaused(paused);
    }
    filter();
  }
})();