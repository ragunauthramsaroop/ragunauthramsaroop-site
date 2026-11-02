(() => {
  "use strict";
  const print = document.getElementById("rr-print");
  if (print) print.addEventListener("click", () => window.print());
  const status = document.getElementById("rr-copy-status");
  document.querySelectorAll("[data-copy-target]").forEach(button => {
    button.addEventListener("click", async () => {
      const element = document.getElementById(button.getAttribute("data-copy-target"));
      if (!element) return;
      try {
        await navigator.clipboard.writeText(element.textContent.trim());
        if (status) status.textContent = "Biography copied.";
      } catch {
        if (status) status.textContent = "Select the biography text above to copy.";
      }
    });
  });
})();
