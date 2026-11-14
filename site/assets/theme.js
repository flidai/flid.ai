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

for (const button of document.querySelectorAll("[data-theme-switch]")) {
  button.hidden = false;
  label(button);
  button.addEventListener("click", () => {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
    label(button);
  });
  systemDark.addEventListener("change", () => label(button));
}

syncSources();
