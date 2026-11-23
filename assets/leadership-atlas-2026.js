(() => {
  "use strict";
  const board = document.querySelector(".atlas-board");
  const buttons = Array.from(document.querySelectorAll(".atlas-option[data-domain]"));
  if (!board || !buttons.length) return;

  const domains = {
    government: {
      number: "01 / GOVERNMENT AFFAIRS",
      heading: "Institutional engagement",
      description: "Regulatory engagement, senior stakeholder relationships and coordination across public institutions.",
      link: "/board-ceo-mode/",
      linkText: "Explore the leadership perspective ↗"
    },
    governance: {
      number: "02 / GOVERNANCE AND COMPLIANCE",
      heading: "Accountable governance",
      description: "Oversight of corporate compliance, the Legal Department, regulatory matters and institutional obligations.",
      link: "/public-record/",
      linkText: "Review the source-linked public record ↗"
    },
    responsibility: {
      number: "03 / ESG AND SOCIAL RESPONSIBILITY",
      heading: "Responsible relationships",
      description: "Community engagement, local-content programmes, sustainability governance and responsible mining priorities.",
      link: "/proof-in-practice/",
      linkText: "Examine professional contribution ↗"
    },
    delivery: {
      number: "04 / OPERATIONS AND PEOPLE",
      heading: "Cross-functional delivery",
      description: "Oversight of aviation, procurement, public relations and dispatch, alongside recruitment and workforce coordination.",
      link: "/executive-profile/",
      linkText: "Review the executive profile ↗"
    }
  };
  const number = document.getElementById("domain-number");
  const heading = document.getElementById("domain-heading");
  const description = document.getElementById("domain-description");
  const link = document.getElementById("domain-link");

  function select(button) {
    const id = button.dataset.domain;
    const entry = domains[id];
    if (!entry) return;
    board.dataset.focus = id;
    buttons.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    number.textContent = entry.number;
    heading.textContent = entry.heading;
    description.textContent = entry.description;
    link.textContent = entry.linkText;
    link.href = entry.link;
  }
  buttons.forEach((button, index) => {
    button.addEventListener("click", () => select(button));
    button.addEventListener("keydown", event => {
      const offset = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 :
        event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
      if (!offset) return;
      event.preventDefault();
      const next = buttons[(index + offset + buttons.length) % buttons.length];
      next.focus();
      select(next);
    });
  });
})();
