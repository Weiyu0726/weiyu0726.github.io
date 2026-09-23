(() => {
  "use strict";

  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    function applyTheme(theme) {
      document.documentElement.dataset.theme = theme;
      const label =
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
      themeToggle.setAttribute("aria-label", label);
      themeToggle.title = label;
      const themeColor = document.querySelector('meta[name="theme-color"]');
      if (themeColor)
        themeColor.content = theme === "dark" ? "#0c0f14" : "#fcfcfd";
    }
    applyTheme(
      document.documentElement.dataset.theme === "light" ? "light" : "dark",
    );
    themeToggle.addEventListener("click", () => {
      const next =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem("weiyu-theme", next);
      } catch {}
    });
    themeToggle.hidden = false;
  }

  const year = document.getElementById("currentYear");
  if (year) year.textContent = new Date().getFullYear();

  const filters = document.querySelector(".filter-group");
  const publications = [...document.querySelectorAll(".publication")];
  const status = document.getElementById("filter-status");
  const publicationCount = document.getElementById("publication-count");
  if (publicationCount)
    publicationCount.textContent = String(publications.length).padStart(2, "0");
  const filterButtons = filters
    ? [...filters.querySelectorAll("[data-filter]")]
    : [];
  function filterPublications(topic) {
    publications.forEach((paper) => {
      paper.hidden = topic !== "all" && paper.dataset.topic !== topic;
    });
    filterButtons.forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.filter === topic),
      );
    });
    if (status) {
      const count = publications.filter((paper) => !paper.hidden).length;
      status.textContent = `${count} publications shown.`;
    }
  }
  if (filters && publications.length) {
    filterButtons.forEach((button) => {
      button.addEventListener("click", () =>
        filterPublications(button.dataset.filter),
      );
    });
    filters.hidden = false;
  }

  const navLinks = [...document.querySelectorAll(".nav-links a")];
  const sections = navLinks
    .map((link) => document.getElementById(link.getAttribute("href").slice(1)))
    .filter(Boolean);
  if (!sections.length) return;

  let scheduled = false;
  function updateNavigation() {
    let active = sections[0];
    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= 160) active = section;
    });
    if (
      window.scrollY + window.innerHeight >=
      document.documentElement.scrollHeight - 3
    ) {
      active = sections[sections.length - 1];
    }
    navLinks.forEach((link) => {
      const selected = link.getAttribute("href") === `#${active.id}`;
      link.classList.toggle("is-active", selected);
      if (selected) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    scheduled = false;
  }
  function scheduleNavigation() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(updateNavigation);
  }
  window.addEventListener("scroll", scheduleNavigation, { passive: true });
  window.addEventListener("resize", scheduleNavigation, { passive: true });
  if (filters) filters.addEventListener("click", scheduleNavigation);
  updateNavigation();
})();
