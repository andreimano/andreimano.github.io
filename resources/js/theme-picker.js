const buttons = document.querySelectorAll("[data-set-theme]");
const systemLight = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
const themes = new Set([
  "default",
  "defaultLight",
  "solarized",
  "seriousAcademic",
  "blog2010",
  "peak2000",
  ...Array.from(buttons, (button) => button.dataset.setTheme),
]);
const requestedTheme = new URLSearchParams(window.location.search).get("theme");

let savedTheme = null;
let followsSystem = false;

try {
  savedTheme = localStorage.getItem("andrei-theme");
} catch (error) {
  savedTheme = null;
}

const getSystemTheme = () => (systemLight?.matches ? "defaultLight" : "default");

const setTheme = (theme, options = {}) => {
  if (options.persist) {
    followsSystem = false;
  }

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
  followsSystem = true;
  setTheme(getSystemTheme());

  const syncSystemTheme = () => {
    if (followsSystem) {
      setTheme(getSystemTheme());
    }
  };

  if (systemLight?.addEventListener) {
    systemLight.addEventListener("change", syncSystemTheme);
  } else if (systemLight?.addListener) {
    systemLight.addListener(syncSystemTheme);
  }
}
