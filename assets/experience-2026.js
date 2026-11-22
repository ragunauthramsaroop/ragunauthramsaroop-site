/* Edition 06 / first-party interactive dossier.
   No trackers, cookies, storage or external dependencies. Reads self-hosted public record JSON. */
(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const smallScreen = window.matchMedia("(max-width: 760px)");
  const progress = $("#reading-bar");
  const cover = $(".cover");
  let rafScheduled = false;

  function updateProgress() {
    const available = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const percent = Math.max(0, Math.min(1, window.scrollY / available));
    if (progress) progress.style.transform = "scaleX(" + percent.toFixed(4) + ")";
    rafScheduled = false;
  }
  function onScroll() {
    if (!rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(updateProgress);
    }
  }
  document.addEventListener("scroll", onScroll, {passive: true});
  window.addEventListener("resize", onScroll, {passive: true});
  updateProgress();

  const sections = ["mandate", "on-stage", "journey", "record"];
  if ("IntersectionObserver" in window) {
    const activeObserver = new IntersectionObserver(entries => {
      entries.filter(entry => entry.isIntersecting).forEach(entry => {
        const id = entry.target.id;
        $$(".desktop-nav a").forEach(link => {
          if (link.getAttribute("href") === "#" + id) {
            link.setAttribute("aria-current", "location");
          } else {
            link.removeAttribute("aria-current");
          }
        });
      });
    }, {rootMargin: "-20% 0px -58% 0px", threshold: 0});
    sections.forEach(id => {
      const node = document.getElementById(id);
      if (node) activeObserver.observe(node);
    });
  }

  if (!prefersReduced.matches && "IntersectionObserver" in window) {
    document.body.classList.add("js-enhanced");
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, {rootMargin: "0px 0px -6% 0px", threshold: .05});
    $$(".reveal").forEach(element => {
      if (!element.closest(".cover")) revealObserver.observe(element);
    });
  }

  /* Portfolio explorer, all panels visible if JavaScript is unavailable. */
  const controls = $$("[data-focus]");
  const panels = $$("[data-panel]");
  const display = $(".mandate-display");
  function selectMandate(name, moveFocus = false) {
    const selected = controls.find(btn => btn.dataset.focus === name);
    if (!selected || !display) return;
    controls.forEach(btn => {
      const active = btn === selected;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
    panels.forEach(panel => {
      panel.hidden = panel.dataset.panel !== name;
    });
    display.dataset.selected = name;
    if (moveFocus) selected.focus();
  }
  if (controls.length === 4 && panels.length === 4) {
    controls.forEach((btn, index) => {
      btn.addEventListener("click", () => selectMandate(btn.dataset.focus));
      btn.addEventListener("keydown", event => {
        if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === "Home") next = 0;
        else if (event.key === "End") next = controls.length - 1;
        else if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (index + 1) % controls.length;
        else next = (index + controls.length - 1) % controls.length;
        selectMandate(controls[next].dataset.focus, true);
      });
    });
    selectMandate("institutions");
  }

  /* Real, self-hosted speaking photography. */
  const gallery = $(".gallery");
  const slides = $$("[data-slide]", gallery || document);
  const prev = $(".gallery-prev");
  const next = $(".gallery-next");
  const caption = $(".gallery-counter");
  const title = $("#gallery-title");
  const description = $("#gallery-description");
  const kicker = $(".gallery-kicker");
  const link = $("#gallery-link");
  const slideData = [
    {
      counter: "01 / 02",
      eyebrow: "KEYNOTE AND STRATEGIC DIALOGUE / 19 NOVEMBER",
      title: "When mining builds a nation.",
      description: "Expominera Internacional 2026. A keynote and panel focused on investment, institutions and shared prosperity.",
      url: "/speaking/expominera-internacional-2026/",
      action: "View verified event briefing"
    },
    {
      counter: "02 / 02",
      eyebrow: "CARIBBEAN RENEWABLE ENERGY FORUM / 16 OCTOBER",
      title: "Energy and responsible development.",
      description: "CREF 2026 in Panama City. A regional forum connecting energy transition, capital and long-term development priorities.",
      url: "https://newenergyevents.com/cref/agenda/",
      action: "View the official programme"
    }
  ];
  let currentSlide = 0;
  function showSlide(index) {
    if (slides.length !== 2) return;
    currentSlide = (index + slides.length) % slides.length;
    slides.forEach((item, i) => item.hidden = i !== currentSlide);
    const data = slideData[currentSlide];
    if (caption) caption.textContent = data.counter;
    if (title) title.textContent = data.title;
    if (description) description.textContent = data.description;
    if (kicker) kicker.textContent = data.eyebrow;
    if (link) {
      link.setAttribute("href", data.url);
      link.textContent = data.action + " ↗";
      if (data.url.startsWith("https://")) {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      } else {
        link.removeAttribute("target");
        link.removeAttribute("rel");
      }
    }
  }
  if (gallery && slides.length === 2 && prev && next) {
    showSlide(0);
    prev.addEventListener("click", () => showSlide(currentSlide - 1));
    next.addEventListener("click", () => showSlide(currentSlide + 1));
    gallery.addEventListener("keydown", event => {
      if (event.target.closest("button") || event.target.closest("a")) return;
      if (event.key === "ArrowLeft") showSlide(currentSlide - 1);
      if (event.key === "ArrowRight") showSlide(currentSlide + 1);
    });
  }

  const mobile = $(".mobile-nav");
  if (mobile) {
    $$("a", mobile).forEach(link => link.addEventListener("click", () => {mobile.open = false;}));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && mobile.open) {
        mobile.open = false;
        $("summary", mobile)?.focus();
      }
    });
    document.addEventListener("click", event => {
      if (mobile.open && !mobile.contains(event.target)) mobile.open = false;
    });
  }

  /* Ambient pointer light: decorative, GPU-light, disabled on touch devices. */
  const finePointer = window.matchMedia("(pointer: fine)");
  if (cover && finePointer.matches && !prefersReduced.matches) {
    let pointerRaf = 0;
    let point = null;
    cover.addEventListener("pointermove", event => {
      const rect = cover.getBoundingClientRect();
      point = [(event.clientX - rect.left) / rect.width * 100,
               (event.clientY - rect.top) / rect.height * 100];
      if (pointerRaf) return;
      pointerRaf = requestAnimationFrame(() => {
        if (point) {
          cover.style.setProperty("--pointer-x", point[0].toFixed(2) + "%");
          cover.style.setProperty("--pointer-y", point[1].toFixed(2) + "%");
        }
        pointerRaf = 0;
      });
    }, {passive: true});
  }

  /* A faint, generative connection field: original Canvas2D artwork.
     Never necessary to read the page or use any control. */
  const canvas = $("#connection-field");
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  if (canvas && cover && !prefersReduced.matches && !smallScreen.matches && !saveData) {
    const context = canvas.getContext("2d", {alpha: true});
    if (context) {
      let points = [];
      let width = 0, height = 0;
      let alive = true, visible = true;
      let animationFrame = 0, previousTime = 0;
      const count = 32;
      function resizeCanvas() {
        const rect = cover.getBoundingClientRect();
        width = Math.max(1, Math.floor(rect.width));
        height = Math.max(1, Math.floor(rect.height));
        const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.floor(width * ratio);
        canvas.height = Math.floor(height * ratio);
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        points = Array.from({length: count}, (_, i) => {
          const p = i + 1;
          return {x: ((p * .61803398875) % 1) * width,
                  y: ((p * .41421356237) % 1) * height,
                  phase: p * 2.39996,
                  speed: .22 + (i % 7) * .04};
        });
      }
      function draw(time) {
        animationFrame = 0;
        if (!alive || !visible || document.hidden) return;
        if (time - previousTime < 31) {
          animationFrame = requestAnimationFrame(draw);
          return;
        }
        previousTime = time;
        context.clearRect(0, 0, width, height);
        const t = time * .0003;
        for (let i = 0; i < points.length; i++) {
          const a = points[i];
          const ax = a.x + Math.sin(t * a.speed + a.phase) * 16;
          const ay = a.y + Math.cos(t * a.speed + a.phase) * 14;
          for (let j = i + 1; j < points.length; j++) {
            const b = points[j];
            const bx = b.x + Math.sin(t * b.speed + b.phase) * 16;
            const by = b.y + Math.cos(t * b.speed + b.phase) * 14;
            const dx = ax - bx, dy = ay - by;
            const distance = Math.hypot(dx, dy);
            if (distance > 150) continue;
            context.strokeStyle = "rgba(221,190,137," + ((1 - distance / 150) * .17).toFixed(3) + ")";
            context.lineWidth = .8;
            context.beginPath();
            context.moveTo(ax, ay);
            context.lineTo(bx, by);
            context.stroke();
          }
          context.fillStyle = "rgba(239,216,167,.27)";
          context.beginPath();
          context.arc(ax, ay, 1.25, 0, 2 * Math.PI);
          context.fill();
        }
        animationFrame = requestAnimationFrame(draw);
      }
      const heroObserver = new IntersectionObserver(entries => {
        visible = entries[0]?.isIntersecting ?? false;
        if (visible && !animationFrame) animationFrame = requestAnimationFrame(draw);
        if (!visible && animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        }
      }, {threshold: 0});
      heroObserver.observe(cover);
      resizeCanvas();
      animationFrame = requestAnimationFrame(draw);
      window.addEventListener("resize", () => {
        if (smallScreen.matches || prefersReduced.matches) {
          alive = false;
          heroObserver.disconnect();
          cancelAnimationFrame(animationFrame);
          context.clearRect(0, 0, width, height);
          canvas.hidden = true;
          return;
        }
        resizeCanvas();
      }, {passive: true});
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && visible && alive && !animationFrame) animationFrame = requestAnimationFrame(draw);
      });
    }
  }
  /* The audience briefing is a progressive enhancement. Without JavaScript,
     all three links navigate directly to their complete, accessible pages. */
  const lensTabs = $$("[data-lens]");
  const lensPanel = $("#lens-summary");
  const lensData = {
    board: {
      ordinal: "01", title: "The leadership lens.",
      description: "Strategic judgement across institutional relationships, governance, risk and responsible operating priorities.",
      primary: {text:"Open board briefing",url:"/board-ceo-mode/"},
      secondary: {text:"Examine the decision framework",url:"/decision-room/"}
    },
    recruiter: {
      ordinal: "02", title: "The executive-search dossier.",
      description: "Career progression, current responsibilities, verification boundaries and fast access to the public executive record.",
      primary: {text:"Open recruiter toolkit",url:"/recruiter-toolkit/"},
      secondary: {text:"Review the executive CV",url:"/resume.html"}
    },
    speaking: {
      ordinal: "03", title: "The international dialogue.",
      description: "Responsibility in mining, energy transition and institutional leadership, with conference briefings and speaking resources.",
      primary: {text:"Open media briefing",url:"/media/"},
      secondary: {text:"Review the Panama keynote",url:"/speaking/expominera-internacional-2026/"}
    }
  };
  const linkForLens = $("#lens-primary");
  const secondaryForLens = $("#lens-secondary");
  let selectedLens = "board";
  function applyLens(name, updateUrl = false, focus = false) {
    const data = lensData[name];
    if (!data || !lensPanel) return;
    selectedLens = name;
    lensTabs.forEach(tab => {
      const active = tab.dataset.lens === name;
      tab.classList.toggle("is-current", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    lensPanel.dataset.lens = name;
    const selectedTab = lensTabs.find(tab => tab.dataset.lens === name);
    if (selectedTab) lensPanel.setAttribute("aria-labelledby", selectedTab.id);
    $("#lens-title").textContent = data.title;
    $("#lens-description").textContent = data.description;
    $(".lens-count").textContent = "SELECTED PERSPECTIVE / " + data.ordinal;
    linkForLens.href = data.primary.url;
    linkForLens.replaceChildren(document.createTextNode(data.primary.text + " ↗"));
    secondaryForLens.href = data.secondary.url;
    secondaryForLens.replaceChildren(document.createTextNode(data.secondary.text + " ↗"));
    if (updateUrl && window.history && window.history.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.set("lens", name);
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }
  if (lensTabs.length === 3 && lensPanel && linkForLens && secondaryForLens) {
    lensTabs.forEach((tab, index) => {
      tab.addEventListener("click", event => {
        event.preventDefault();
        applyLens(tab.dataset.lens, true);
      });
      tab.addEventListener("keydown", event => {
        if (!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === "Home") next = 0;
        else if (event.key === "End") next = lensTabs.length - 1;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index + lensTabs.length - 1) % lensTabs.length;
        else next = (index + 1) % lensTabs.length;
        applyLens(lensTabs[next].dataset.lens, true, true);
      });
    });
    const initial = new URLSearchParams(window.location.search).get("lens");
    applyLens(lensData[initial] ? initial : "board");
    const copy = $("#lens-copy"), feedback = $("#lens-copy-feedback");
    if (copy && feedback) copy.addEventListener("click", async () => {
      const url = new URL(window.location.href);
      url.searchParams.set("lens", selectedLens);
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        feedback.textContent = "Share this page using your browser’s Share command.";
        return;
      }
      try {
        await navigator.clipboard.writeText(url.href);
        feedback.textContent = "Briefing link copied.";
      } catch {
        feedback.textContent = "Copy the address from your browser’s address bar.";
      }
    });
  }

  /* Interactive claim-to-source atlas, populated ONLY from the canonical
     self-hosted public executive record. No third-party services or
     inferences about personal responsibility for company-wide outcomes. */
  const proofNetwork = $("#proof-network");
  const proofLinks = $("#proof-links");
  const proofNodes = $("#proof-nodes");
  const proofOptions = $$("[data-claim-id]");
  const proofStatus = $("#proof-status");
  const positions = [
    [310,56],[489,158],[489,363],[310,464],[131,363],[131,158]
  ];
  const svgNS = "http://www.w3.org/2000/svg";
  let claimsById = new Map();
  function svgEl(tag, attrs) {
    const node = document.createElementNS(svgNS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  }
  function safeSourceUrl(raw) {
    try {
      const uri = new URL(raw, window.location.origin);
      if (uri.protocol !== "https:" && uri.protocol !== "http:") return null;
      if (uri.protocol === "http:" && uri.origin !== window.location.origin) return null;
      return uri.href;
    } catch { return null; }
  }
  function selectClaim(id, focus = false) {
    const claim = claimsById.get(id);
    if (!claim) return;
    proofOptions.forEach(a => {
      const current = a.dataset.claimId === id;
      if (current) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
      if (focus && current) a.focus();
    });
    $$(".proof-dot, .proof-dot-number, .proof-edge", proofNetwork).forEach(node => {
      node.classList.toggle("is-selected", node.dataset.claimId === id);
    });
    $("#proof-date").textContent =
      (claim.classification === "company_reported_operating_context" ? "COMPANY-REPORTED CONTEXT" : "SOURCE-SCOPED PROFESSIONAL CLAIM")
      + " / " + claim.effectiveFrom;
    $("#proof-title").textContent = claim.title;
    $("#proof-value").textContent = claim.value;
    $("#proof-scope").textContent = claim.scope;
    const sources = $("#proof-sources");
    sources.replaceChildren();
    for (const evidence of claim.evidence || []) {
      const href = safeSourceUrl(evidence.url);
      if (!href) continue;
      const a = document.createElement("a");
      a.href = href;
      a.textContent = evidence.label + " ↗";
      if (new URL(href).origin !== window.location.origin) {
        a.target = "_blank";a.rel = "noopener noreferrer";
      }
      sources.appendChild(a);
    }
    if (proofStatus) {
      proofStatus.textContent = claim.classification === "company_reported_operating_context"
        ? "Company operating context. This is not presented as an individual achievement."
        : "Claim scope and linked references are reproduced from the dated public record, not independently authenticated here.";
    }
  }
  if (proofNetwork && proofLinks && proofNodes && proofOptions.length === 6) {
    fetch("/api/v1/executive-record.json", {cache:"force-cache", credentials:"same-origin"})
      .then(response => {if (!response.ok) throw new Error("Public record unavailable");return response.json();})
      .then(record => {
        if (!Array.isArray(record.claims) || record.claims.length !== 6) throw new Error("Claim schema mismatch");
        const order = proofOptions.map(a => a.dataset.claimId);
        claimsById = new Map(record.claims.map(c => [c.id,c]));
        if (!order.every(id => claimsById.has(id))) throw new Error("Claim IDs out of sync");
        proofLinks.replaceChildren();proofNodes.replaceChildren();
        order.forEach((id, i) => {
          const [x,y] = positions[i];
          const claim = claimsById.get(id);
          const line = svgEl("line",{x1:310,y1:260,x2:x,y2:y,class:"proof-edge","data-claim-id":id});
          proofLinks.appendChild(line);
          const g = svgEl("g",{"data-claim-id":id});
          const circle = svgEl("circle",{cx:x,cy:y,r:23,class:"proof-dot" + (claim.classification === "company_reported_operating_context" ? " is-company":""),
            "data-claim-id":id});
          const text = svgEl("text",{x:x,y:y+4,"text-anchor":"middle",class:"proof-dot-number","data-claim-id":id});
          text.textContent = String(i+1).padStart(2,"0");
          g.append(circle,text);
          proofNodes.appendChild(g);
        });
        proofOptions.forEach(a => {
          a.addEventListener("click",event => {
            event.preventDefault();
            selectClaim(a.dataset.claimId);
          });
          a.addEventListener("keydown",event => {
            if (!["ArrowUp","ArrowDown","Home","End"].includes(event.key)) return;
            event.preventDefault();
            const index = proofOptions.indexOf(a);
            const next = event.key === "Home" ? 0 : event.key === "End" ? proofOptions.length - 1
              : event.key === "ArrowDown" ? (index + 1) % proofOptions.length
              : (index + proofOptions.length - 1) % proofOptions.length;
            selectClaim(proofOptions[next].dataset.claimId, true);
          });
        });
        selectClaim(order[0]);
        proofNetwork.dataset.ready = "true";
        if (proofStatus) proofStatus.dataset.state = "ready";
      })
      .catch(() => {
        if (proofStatus) {
          proofStatus.dataset.state = "error";
          proofStatus.textContent = "The live claim explorer is unavailable. Source links above remain usable.";
        }
      });
  }
})();
