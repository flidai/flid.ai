// Product tabs: the home hero and the Alloy Catalog screens.
//
// The markup works without JavaScript: the tab list is hidden and every
// screenshot shows, one after the other. This module turns it into an
// accessible tab set (WAI-ARIA tabs pattern with automatic activation: click,
// arrow keys, Home and End).
//
// A tab set marked data-autoplay also advances on its own. The clock is the
// progress bar under the selected tab (a CSS animation), so pausing the bar
// pauses the slideshow. It stops for good once the reader picks a tab, pauses
// while the pointer or focus is on it or it is off screen, has a pause button,
// and never starts for readers who ask for reduced motion.

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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

  let current = 0;

  function select(index, { focus = false, animate = false } = {}) {
    current = index;
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

  const autoplay = "autoplay" in root.dataset && !reduceMotion.matches ? startAutoplay() : null;

  function choose(index, options) {
    autoplay?.stop();
    if (index !== current) select(index, { ...options, animate: true });
    else if (options.focus) tabs[index].focus();
  }

  list.addEventListener("click", (event) => {
    const index = tabs.indexOf(event.target.closest("[data-tab]"));
    if (index >= 0) choose(index, {});
  });

  list.addEventListener("keydown", (event) => {
    const at = tabs.indexOf(document.activeElement);
    if (at < 0) return;
    const last = tabs.length - 1;
    const next = {
      ArrowRight: at === last ? 0 : at + 1,
      ArrowLeft: at === 0 ? last : at - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    choose(next, { focus: true });
  });

  select(0);
  list.hidden = false;
  root.classList.add("is-tabbed");

  function startAutoplay() {
    const button = root.querySelector("[data-tab-play]");
    const holds = new Set();

    function update() {
      root.classList.toggle("is-paused", holds.size > 0);
      if (button) {
        const pausedByReader = holds.has("button");
        button.setAttribute("aria-pressed", String(pausedByReader));
        button.setAttribute("aria-label", pausedByReader ? "Play the screenshots" : "Pause the screenshots");
      }
    }
    const hold = (reason, on) => {
      on ? holds.add(reason) : holds.delete(reason);
      update();
    };

    root.classList.add("is-playing");
    if (button) {
      button.hidden = false;
      button.addEventListener("click", () => hold("button", !holds.has("button")));
    }
    root.addEventListener("pointerenter", () => hold("pointer", true));
    root.addEventListener("pointerleave", () => hold("pointer", false));
    list.addEventListener("focusin", () => hold("focus", true));
    list.addEventListener("focusout", () => hold("focus", false));
    new IntersectionObserver(([entry]) => hold("offscreen", !entry.isIntersecting)).observe(root);
    document.addEventListener("visibilitychange", () => hold("hidden", document.hidden));

    // The selected tab's progress bar finishing is the signal to move on.
    list.addEventListener("animationend", (event) => {
      if (event.animationName !== "tab-progress" || !root.classList.contains("is-playing")) return;
      select((current + 1) % tabs.length, { animate: true });
    });

    reduceMotion.addEventListener("change", () => reduceMotion.matches && stop());

    function stop() {
      root.classList.remove("is-playing", "is-paused");
      if (button) button.hidden = true;
    }
    return { stop };
  }
}
