// "solarized": the homepage as a terminal session. Adds a neofetch-style
// header (with an ASCII portrait rendered from the photo), shell prompts
// before each section and a tmux-like status line with a clock.

import { $, $$, createExtras, h } from "./dom.js";

const PROMPT = "andrei@stuttgart";
const RAMP = " .:-=+*#%@";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (value) => String(value).padStart(2, "0");

const COMMANDS = {
  about: "cat about.md",
  news: "tail -n 6 news.log",
  publications: "ls -t papers/ | xargs bibtex --pretty",
};

function promptLine(command) {
  return h("p", { class: "sz-prompt" },
    h("span", { class: "sz-user" }, PROMPT),
    h("span", { class: "sz-path" }, ":~"),
    h("span", { class: "sz-dollar" }, "$ "),
    h("span", { class: "sz-command" }, command));
}

// Draws the portrait into a small canvas and maps brightness to characters:
// cropped to the face, contrast-stretched, with the busy background faded out.
function asciiPortrait(image, columns = 44) {
  const rows = Math.round(columns * 0.6); // monospace cells are ~0.6 as wide as tall
  const canvas = document.createElement("canvas");
  canvas.width = columns;
  canvas.height = rows;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const size = Math.min(image.naturalWidth, image.naturalHeight) * 0.8;
  const left = (image.naturalWidth - size) / 2;
  context.drawImage(image, left, image.naturalHeight * 0.02, size, size, 0, 0, columns, rows);
  const { data } = context.getImageData(0, 0, columns, rows);

  const luminance = new Float32Array(columns * rows);
  for (let i = 0; i < luminance.length; i += 1) {
    luminance[i] = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
  }
  const sorted = Float32Array.from(luminance).sort();
  const low = sorted[Math.floor(sorted.length * 0.05)];
  const high = sorted[Math.floor(sorted.length * 0.97)];

  const lines = [];
  for (let y = 0; y < rows; y += 1) {
    let line = "";
    for (let x = 0; x < columns; x += 1) {
      const dx = (x / (columns - 1) - 0.5) / 0.5;
      const dy = (y / (rows - 1) - 0.46) / 0.62;
      const fade = Math.min(1, Math.max(0, 1.7 - Math.hypot(dx, dy) * 1.5));
      const value = Math.min(1, Math.max(0, (luminance[y * columns + x] - low) / (high - low))) * fade;
      line += RAMP[Math.round(value * (RAMP.length - 1))];
    }
    lines.push(line.replace(/\s+$/, ""));
  }
  return lines.join("\n");
}

export function mount(site) {
  const extras = createExtras();
  const masthead = $(".masthead");
  const portrait = $(".portrait");
  const intro = $(".intro");
  const themes = $(".themes");
  if (!masthead || !intro) return () => extras.cleanup();

  // neofetch --------------------------------------------------------------------
  masthead.before(extras.add(promptLine("neofetch")));

  const art = extras.add(h("pre", { class: "sz-ascii", "aria-hidden": "true" }));
  const draw = () => {
    try {
      art.textContent = asciiPortrait(portrait);
    } catch (error) {
      art.remove();
    }
  };
  if (portrait) {
    masthead.prepend(art);
    if (portrait.complete && portrait.naturalWidth) draw();
    else extras.on(portrait, "load", draw, { once: true });
  }

  const papers = $$(".pub").length;
  const newsCount = $$("#news-list > li").length;
  const phdStart = new Date("2022-10-04T00:00:00");
  const months = Math.max(0, Math.floor((Date.now() - phdStart) / (30.44 * 86400000)));
  const uptime = `${Math.floor(months / 12)} years, ${months % 12} months (PhD)`;

  const facts = [
    ["host", "University of Stuttgart"],
    ["kernel", "equivariance-6.2.0-geometric"],
    ["uptime", uptime],
    ["packages", `${papers} papers, ${newsCount} news items`],
    ["resolution", `${window.screen.width}x${window.screen.height}`],
    ["theme", "solarized-dark"],
  ];

  intro.append(
    extras.add(
      h("dl", { class: "sz-facts" },
        facts.map(([key, value]) => [h("dt", {}, key), h("dd", {}, value)])),
    ),
    extras.add(
      h("p", { class: "sz-swatches", "aria-hidden": "true" },
        ["#073642", "#dc322f", "#859900", "#b58900", "#268bd2", "#d33682", "#2aa198", "#eee8d5"].map((color) =>
          h("span", { style: { background: color } }))),
    ),
  );

  // Prompts before sections ---------------------------------------------------
  Object.entries(COMMANDS).forEach(([id, command]) => {
    const section = document.getElementById(id);
    if (section) section.before(extras.add(promptLine(command)));
  });

  if (site.news) site.news.setLabels({ more: `cat news.log  # ${site.news.hidden} more lines`, less: "clear" });

  const footer = $(".colophon");
  if (footer) {
    footer.before(extras.add(promptLine("cat DISCLAIMER")));
    footer.after(
      extras.add(
        h("p", { class: "sz-prompt sz-last" },
          h("span", { class: "sz-user" }, PROMPT),
          h("span", { class: "sz-path" }, ":~"),
          h("span", { class: "sz-dollar" }, "$ "),
          h("span", { class: "sz-cursor", "aria-hidden": "true" }, " "))),
    );
  }

  // tmux status line (the theme picker is styled as its window list) ----------------
  if (themes) {
    const clock = h("span", {});
    const tick = () => {
      const now = new Date();
      clock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}-${MONTHS[now.getMonth()]}-${String(now.getFullYear()).slice(2)}`;
    };
    tick();
    extras.every(15000, tick);
    themes.prepend(extras.add(h("span", { class: "sz-session" }, "[homepage]")));
    themes.append(extras.add(h("span", { class: "sz-status-right" }, `"${PROMPT}" `, clock)));
  }

  return () => {
    if (site.news) site.news.setLabels(null);
    extras.cleanup();
  };
}
