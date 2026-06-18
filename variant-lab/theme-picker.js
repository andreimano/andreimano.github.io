const buttons = document.querySelectorAll("[data-set-theme]");
const themes = new Set(Array.from(buttons, (button) => button.dataset.setTheme));
const requestedTheme = new URLSearchParams(window.location.search).get("theme") || "default";

let savedTheme = null;

try {
  savedTheme = localStorage.getItem("andrei-variant-theme");
} catch (error) {
  savedTheme = null;
}

const setTheme = (theme) => {
  document.body.dataset.theme = theme;

  try {
    localStorage.setItem("andrei-variant-theme", theme);
  } catch (error) {
    // The picker still works for the current page even when storage is unavailable.
  }

  buttons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.setTheme === theme));
  });
};

buttons.forEach((button) => {
  button.addEventListener("click", () => setTheme(button.dataset.setTheme));
});

if (requestedTheme && themes.has(requestedTheme)) {
  setTheme(requestedTheme);
} else if (savedTheme && themes.has(savedTheme)) {
  setTheme(savedTheme);
}
