// Product galleries: a WAI-ARIA tab list switches between product views.
// Without JavaScript the first view stays visible and the tabs do nothing.
for (const gallery of document.querySelectorAll("[data-product-gallery]")) {
  const tabs = [...gallery.querySelectorAll('[role="tab"]')];
  const panelFor = (tab) => document.getElementById(tab.getAttribute("aria-controls"));

  const select = (next, { focus = false } = {}) => {
    for (const tab of tabs) {
      const selected = tab === next;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panelFor(tab).hidden = !selected;
    }
    if (focus) next.focus();
  };

  gallery.addEventListener("click", (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab && tabs.includes(tab)) select(tab);
  });

  gallery.addEventListener("keydown", (event) => {
    const index = tabs.indexOf(event.target);
    if (index < 0) return;
    const target = {
      ArrowRight: tabs[(index + 1) % tabs.length],
      ArrowLeft: tabs[(index - 1 + tabs.length) % tabs.length],
      Home: tabs[0],
      End: tabs[tabs.length - 1],
    }[event.key];
    if (!target) return;
    event.preventDefault();
    select(target, { focus: true });
  });

  // Hidden views lazy-load only once shown. Fetch them while the gallery
  // approaches the viewport, so switching tabs never shows an empty frame.
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      for (const image of gallery.querySelectorAll('img[loading="lazy"]')) image.loading = "eager";
    }, { rootMargin: "400px 0px" });
    observer.observe(gallery);
  }
}
