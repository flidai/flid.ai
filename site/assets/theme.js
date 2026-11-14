// Theme switch for the public site.
//
// The page follows the reader's system setting until they press the switch;
// their choice is then stored and applied before paint by the inline script in
// each page's <head>. <picture> sources marked data-theme-source follow the
// chosen theme too, because their media queries only see the system setting.

const root = document.documentElement;
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

function currentTheme() {
  return root.dataset.theme || (systemDark.matches ? "dark" : "light");
}

function syncSources() {
  const chosen = root.dataset.theme;
  for (const source of document.querySelectorAll("source[data-theme-source]")) {
    source.media = chosen
      ? (source.dataset.themeSource === chosen ? "all" : "not all")
      : `(prefers-color-scheme: ${source.dataset.themeSource})`;
  }
}

function label(button) {
  const next = currentTheme() === "dark" ? "light" : "dark";
  button.setAttribute("aria-label", `Switch to ${next} theme`);
}

export function setTheme(theme) {
  root.dataset.theme = theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Storage can be unavailable; the choice then lasts for this page only.
  }
  syncSources();
}

// The new theme opens as a circle from the switch, where the browser supports
// view transitions and the reader has not asked for reduced motion.
function switchWithReveal(button, change) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduce) {
    change();
    return;
  }
  const box = button.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const transition = document.startViewTransition(change);
  transition.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 550, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
    );
  });
}

for (const button of document.querySelectorAll("[data-theme-switch]")) {
  button.hidden = false;
  label(button);
  button.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    switchWithReveal(button, () => {
      setTheme(next);
      label(button);
    });
  });
  systemDark.addEventListener("change", () => label(button));
}

syncSources();
