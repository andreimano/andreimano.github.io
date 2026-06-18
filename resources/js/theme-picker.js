const buttons = document.querySelectorAll("[data-set-theme]");
const themes = new Set([
  "default",
  "defaultDark",
  "defaultLight",
  "solarized",
  "seriousAcademic",
  "blog2010",
  "peak2000",
  ...Array.from(buttons, (button) => button.dataset.setTheme),
]);
const requestedTheme = new URLSearchParams(window.location.search).get("theme");

let savedTheme = null;

try {
  savedTheme = localStorage.getItem("andrei-theme");
} catch (error) {
  savedTheme = null;
}

const setTheme = (theme, options = {}) => {
  document.body.dataset.theme = theme;

  if (options.persist) {
    try {
      localStorage.setItem("andrei-theme", theme);
    } catch (error) {
      // The picker still works for the current page even when storage is unavailable.
    }
  }

  buttons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.setTheme === theme));
  });
};

buttons.forEach((button) => {
  button.addEventListener("click", () => setTheme(button.dataset.setTheme, { persist: true }));
});

if (requestedTheme && themes.has(requestedTheme)) {
  setTheme(requestedTheme, { persist: true });
} else if (savedTheme && themes.has(savedTheme)) {
  setTheme(savedTheme);
} else {
  setTheme("default");
}
