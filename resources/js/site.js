// Theme switching + small progressive enhancements.
//
// Every theme is mostly CSS (resources/css/themes/*.css). Themes that need
// extra decorations (widgets, sidebars, sounds…) have a module in ./themes/
// exporting `mount(site)`, which returns a cleanup function. Decorations are
// marked with a `data-extra` attribute so they never leak into other themes.

const STORAGE_KEY = "andrei-theme";

const LOOKS = {
  default: "default",
  defaultLight: "default",
  defaultDark: "default",
  solarized: "solarized",
  seriousAcademic: "seriousAcademic",
  blog2010: "blog2010",
  peak2000: "peak2000",
};

// Order used by "next"/"previous" buttons inside themes (webring, Next Blog»).
const CYCLE = ["default", "solarized", "seriousAcademic", "blog2010", "peak2000"];

const MODULES = {
  solarized: () => import("./themes/solarized.js"),
  seriousAcademic: () => import("./themes/academic.js"),
  blog2010: () => import("./themes/blogspot.js"),
  peak2000: () => import("./themes/peak2000.js"),
};

const root = document.documentElement;
const buttons = [...document.querySelectorAll("[data-set-theme]")];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const isTheme = (theme) => Object.prototype.hasOwnProperty.call(LOOKS, theme);

let activeLook = null;
let cleanup = null;
let generation = 0;

const email = setUpEmail();
const news = setUpNews();

const site = {
  email,
  news,
  reducedMotion: () => reducedMotion.matches,
  currentTheme: () => root.dataset.theme,
  setTheme: (theme) => applyTheme(theme, { save: true }),
  stepTheme(step) {
    const index = Math.max(0, CYCLE.indexOf(LOOKS[root.dataset.theme]));
    site.setTheme(CYCLE[(index + step + CYCLE.length) % CYCLE.length]);
  },
  randomTheme() {
    const others = CYCLE.filter((theme) => theme !== LOOKS[root.dataset.theme]);
    site.setTheme(others[Math.floor(Math.random() * others.length)]);
  },
};

function save(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (error) {
    // Storage can be unavailable (private mode); the theme still applies to this page.
  }
}

async function applyTheme(theme, { save: shouldSave = false } = {}) {
  if (!isTheme(theme)) theme = "default";
  const look = LOOKS[theme];

  root.dataset.theme = theme;
  root.dataset.look = look;
  buttons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.setTheme === theme));
  });
  if (shouldSave) save(theme);

  if (look === activeLook) return;
  const token = ++generation;
  activeLook = look;
  if (cleanup) {
    cleanup();
    cleanup = null;
  }

  const load = MODULES[look];
  if (!load) return;
  try {
    const module = await load();
    if (token !== generation) return;
    cleanup = module.mount(site) || null;
  } catch (error) {
    console.error(`Could not load extras for the "${look}" theme.`, error);
  }
}

// The address is split across data-mail-user / data-mail-host in the markup, so it
// never appears verbatim in the page source (where address harvesters look).
function setUpEmail() {
  let address = null;
  document.querySelectorAll("[data-mail-user][data-mail-host]").forEach((link) => {
    address = `${link.dataset.mailUser}@${link.dataset.mailHost}`;
    link.href = `mailto:${address}`;
  });
  return address;
}

function setUpNews() {
  const list = document.getElementById("news-list");
  const visible = 6;
  if (!list || list.children.length <= visible) return null;

  const hidden = list.children.length - visible;
  const defaults = { more: `Show ${hidden} older`, less: "Show fewer" };
  let labels = defaults;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "news-toggle";
  button.setAttribute("aria-controls", list.id);

  const render = () => {
    const collapsed = list.dataset.collapsed === "true";
    button.textContent = collapsed ? labels.more : labels.less;
    button.setAttribute("aria-expanded", String(!collapsed));
  };

  button.addEventListener("click", () => {
    list.dataset.collapsed = list.dataset.collapsed === "true" ? "false" : "true";
    render();
  });

  list.dataset.collapsed = "true";
  list.after(button);
  render();

  return {
    list,
    button,
    hidden,
    setLabels(next) {
      labels = next ? { ...defaults, ...next } : defaults;
      render();
    },
    expand() {
      list.dataset.collapsed = "false";
      render();
    },
  };
}

buttons.forEach((button) => {
  button.addEventListener("click", () => site.setTheme(button.dataset.setTheme));
});

// The inline script in <head> already picked the theme (URL → storage → default).
// A ?theme= link is remembered, like before.
const requested = new URLSearchParams(window.location.search).get("theme");
applyTheme(root.dataset.theme, { save: isTheme(requested) });
