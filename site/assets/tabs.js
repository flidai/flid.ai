// Product tabs in the home hero.
//
// The markup works without JavaScript: the tab list is hidden and both
// screenshots show one after the other. This module turns it into an
// accessible tab set (WAI-ARIA tabs pattern with automatic activation: click,
// arrow keys, Home and End).

for (const root of document.querySelectorAll("[data-tabs]")) {
  const list = root.querySelector("[data-tab-list]");
  const tabs = [...list.querySelectorAll("[data-tab]")];
  const panels = tabs.map((tab) => document.getElementById(tab.dataset.tab));
  if (panels.some((panel) => !panel)) continue;

  list.setAttribute("role", "tablist");
  tabs.forEach((tab, i) => {
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panels[i].id);
    panels[i].setAttribute("role", "tabpanel");
    panels[i].setAttribute("aria-labelledby", tab.id);
  });

  function select(index, { focus = false, animate = false } = {}) {
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[i].hidden = !selected;
    });
    if (animate) {
      const panel = panels[index];
      panel.classList.remove("is-entering");
      void panel.offsetWidth; // restart the entrance animation
      panel.classList.add("is-entering");
    }
    if (focus) tabs[index].focus();
  }

  list.addEventListener("click", (event) => {
    const index = tabs.indexOf(event.target.closest("[data-tab]"));
    if (index >= 0 && tabs[index].getAttribute("aria-selected") !== "true") select(index, { animate: true });
  });

  list.addEventListener("keydown", (event) => {
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    const last = tabs.length - 1;
    const next = {
      ArrowRight: current === last ? 0 : current + 1,
      ArrowLeft: current === 0 ? last : current - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next, { focus: true, animate: true });
  });

  select(0);
  list.hidden = false;
}
