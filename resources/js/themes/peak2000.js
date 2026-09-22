// "peak 2000s": a GeoCities-era homepage. Adds the marquee, WordArt title,
// sidebar widgets (MIDI player, hit counter, guestbook, webring, 88×31
// buttons), NEW! badges, a sparkle cursor trail and optional retro sounds.
// Sound is off until the visitor presses play or turns it on.

import { createAudio } from "./peak2000-audio.js";
import { $, createExtras, h, newsItems } from "./dom.js";

const BADGES = [
  ["vibe", "VIBE", "CODED"],
  ["y2k", "Y2K", "COMPLIANT"],
  ["notepad", "MADE WITH", "Notepad"],
  ["so3", "SO(3)", "EQUIVARIANT"],
  ["gnn", "POWERED BY", "GNNs"],
  ["res", "BEST VIEWED", "@ 800×600"],
  ["html", "HTML 4.01", "(probably)"],
  ["gold", "★ GOLD ★", "REVIEWER"],
];

const AWARDS = [
  "Gold Reviewer, ICML 2026",
  "Best Reviewer, NeurIPS 2022, 2023 & 2024",
  "1st prize, ICLR 2021 CG&T Challenge",
  "Best Poster, EEML 2021",
  "1st prize, PyTorch Summer Hackathon 2020",
];

const SPARKLE_COLORS = ["#ff5cf4", "#5cf8ff", "#fff35c", "#8bff5c", "#ffffff"];
const SPARKLE_GLYPHS = ["✦", "✧", "★", "✶", "·"];

const pad = (value) => String(value).padStart(2, "0");
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// One span per letter (for the wave), grouped per word so words never break apart.
function wordArt(text) {
  let index = 0;
  return text.trim().split(/\s+/).map((word) =>
    h("span", { class: "p2k-word" },
      [...word].map((letter) => h("span", { class: "p2k-letter", style: { "--i": index++ } }, letter))));
}

export function mount(site) {
  const extras = createExtras();
  const themes = $(".themes");
  const masthead = $(".masthead");
  const name = $(".name");
  const portrait = $(".portrait");
  const footer = $(".colophon");
  if (!masthead || !name) return () => extras.cleanup();

  const news = newsItems();

  // Marquee ------------------------------------------------------------------
  const latest = news
    .slice(0, 2)
    .map(({ text }) => text.replace(/[.!]*$/, "!!!"))
    .join("   ★   ");
  const marqueeText = `★ Welcome to Andrei's homepage on the World Wide Web!!! ★ Latest news: ${latest} ★ Now 100% SO(3)-equivariant ★ Don't forget to sign my guestbook!!! ★`;
  const marquee = extras.add(
    h("div", { class: "p2k-marquee", "aria-hidden": "true" },
      h("div", { class: "p2k-marquee-track" }, h("span", {}, marqueeText), h("span", {}, marqueeText))),
  );
  (themes || masthead).after(marquee);

  // Header: WordArt, photo caption, under construction -------------------------
  name.before(
    extras.add(h("p", { class: "p2k-welcome", "aria-hidden": "true" }, "~*~ Welcome 2 the homepage of ~*~")),
    extras.add(h("div", { class: "p2k-wordart", "aria-hidden": "true" }, wordArt(name.textContent))),
  );

  if (portrait) {
    portrait.after(
      extras.add(h("p", { class: "p2k-caption", "aria-hidden": "true" }, "▲ this is me!! ▲")),
      extras.add(h("p", { class: "p2k-online" }, h("span", { class: "p2k-dot", "aria-hidden": "true" }), "Online Now!")),
    );
  }

  masthead.append(
    extras.add(
      h("div", { class: "p2k-construction" },
        h("span", { class: "p2k-beacon", "aria-hidden": "true" }),
        h("p", {}, h("strong", {}, "🚧 UNDER CONSTRUCTION 🚧"), h("br"), "This homepage is always being worked on. Please come back soon!!!"),
        h("span", { class: "p2k-beacon", "aria-hidden": "true" })),
    ),
  );

  // Sidebar widgets -------------------------------------------------------------
  const box = (title, ...content) =>
    h("section", { class: "p2k-box" }, h("h2", { class: "p2k-box-title" }, title), ...content);

  const player = createPlayer();

  let visits = 1;
  try {
    visits = Number(localStorage.getItem("andrei-p2k-visits") || 0) + 1;
    localStorage.setItem("andrei-p2k-visits", String(visits));
  } catch (error) {
    // No storage: the counter is made up anyway.
  }
  const days = Math.floor((Date.now() - Date.UTC(2003, 0, 1)) / 86400000);
  const count = String(1337 + days * 3 + visits).padStart(7, "0");

  const side = extras.add(
    h("aside", { class: "p2k-side", "aria-label": "Homepage widgets" },
      box("~ Navigation ~",
        h("ul", { class: "p2k-nav" },
          [
            ["#top", "Home"],
            ["#about", "About Me"],
            ["#news", "What's New?!"],
            ["#publications", "My Papers"],
            ["resources/files/Manolache_Andrei_CV.pdf", "My CV"],
            site.email && [`mailto:${site.email}`, "E-mail Me"],
          ].filter(Boolean).map(([href, label]) => h("li", {}, h("a", { href }, label))))),
      box("♫ Now Playing", player.node),
      box("Hit Counter",
        h("p", {}, "You are visitor #"),
        h("p", { class: "p2k-counter", role: "img", "aria-label": `visitor number ${Number(count)}` },
          [...count].map((digit) => h("span", { "aria-hidden": "true" }, digit))),
        h("p", { class: "p2k-small" }, "(this number is at least partly made up)")),
      site.email && box("Guestbook",
        h("a", { class: "p2k-btn p2k-guestbook", href: `mailto:${site.email}?subject=${encodeURIComponent("Signing your guestbook!")}` }, "✍ Sign my guestbook!"),
        h("p", { class: "p2k-small" }, "(it's an e-mail. it was always an e-mail.)")),
      box("🏆 My Awards 🏆", h("ul", { class: "p2k-awards" }, AWARDS.map((award) => h("li", {}, award)))),
      box("Webring",
        h("p", {}, "🕸 The Equivariant Webring 🕸"),
        h("div", { class: "p2k-webring" },
          h("button", { type: "button", class: "p2k-btn", onclick: () => site.stepTheme(-1) }, "« prev"),
          h("button", { type: "button", class: "p2k-btn", onclick: () => site.randomTheme() }, "random"),
          h("button", { type: "button", class: "p2k-btn", onclick: () => site.stepTheme(1) }, "next »")),
        h("p", { class: "p2k-small" }, "(every site in this ring is this site in a different skin)")),
      box("Cool Buttons",
        h("div", { class: "p2k-badges", "aria-hidden": "true" },
          BADGES.map(([key, top, bottom]) =>
            h("span", { class: `p2k-badge p2k-badge--${key}` }, h("b", {}, top), h("span", {}, bottom))))),
    ),
  );
  masthead.after(side);

  // Content decorations ---------------------------------------------------------
  news.slice(0, 3).forEach(({ time }) => time.after(extras.add(h("span", { class: "p2k-new" }, "NEW!"))));

  if (site.news) {
    site.news.setLabels({
      more: `Click here 4 ${site.news.hidden} more news!!!`,
      less: "Click here 4 less news",
    });
  }

  if (footer) {
    const updated = new Date(document.lastModified);
    const stamp = Number.isNaN(updated.getTime())
      ? ""
      : `${pad(updated.getMonth() + 1)}/${pad(updated.getDate())}/${updated.getFullYear()}`;
    const width = window.screen.width;
    const height = window.screen.height;
    footer.append(
      extras.add(
        h("div", { class: "p2k-footer" },
          h("p", {},
            "Best viewed with Netscape Navigator 4.0 at 800 × 600",
            h("br"),
            `(your screen is ${width} × ${height}${width > 800 ? ", way too big!!" : ", perfect!!"})`),
          stamp && h("p", {}, `Last updated: ${stamp}`),
          h("p", {}, "© 2026 Andrei's Homepage · all vibes reserved")),
      ),
    );
  }

  // Sparkle cursor trail ------------------------------------------------------
  if (!site.reducedMotion() && window.matchMedia("(pointer: fine)").matches) {
    const layer = extras.add(h("div", { class: "p2k-sparkles", "aria-hidden": "true" }));
    document.body.append(layer);
    let last = 0;
    extras.on(document, "pointermove", (event) => {
      const now = performance.now();
      if (now - last < 35 || layer.childElementCount > 26) return;
      last = now;
      const sparkle = h("span", {
        class: "p2k-sparkle",
        style: {
          left: `${event.clientX}px`,
          top: `${event.clientY}px`,
          color: pick(SPARKLE_COLORS),
          "--dx": `${Math.round(Math.random() * 40 - 20)}px`,
          "--dy": `${Math.round(20 + Math.random() * 30)}px`,
          "font-size": `${10 + Math.round(Math.random() * 10)}px`,
        },
      }, pick(SPARKLE_GLYPHS));
      sparkle.addEventListener("animationend", () => sparkle.remove());
      layer.append(sparkle);
    });
  }

  // Sound effects (only audible once sound is on) -----------------------------------
  extras.on(document, "click", (event) => {
    if (event.target instanceof Element && event.target.closest("a, button")) player.audio.sfx.click();
  });
  extras.on(document, "pointerover", (event) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest(".p2k-nav a, .themes button, .p2k-btn, .p2k-badge, .contact a");
    if (target && !target.contains(event.relatedTarget)) player.audio.sfx.blip();
  });

  return () => {
    player.destroy();
    if (site.news) site.news.setLabels(null);
    extras.cleanup();
  };
}

function createPlayer() {
  let dialing = false;
  let frame = 0;

  const track = "01. andrei_homepage.mid  ***  128 kbps  ***  22 kHz  ***  ";
  const title = h("span", { class: "p2k-lcd-title" }, h("span", {}, track), h("span", {}, track));
  const status = h("span", { class: "p2k-lcd-status" }, "SOUND OFF");
  const clock = h("span", { class: "p2k-lcd-time" }, "00:00");
  const canvas = h("canvas", { class: "p2k-viz", width: 176, height: 30, "aria-hidden": "true" });

  const play = h("button", { type: "button", class: "p2k-btn", title: "Play", "aria-label": "Play background music" }, "▶");
  const stop = h("button", { type: "button", class: "p2k-btn", title: "Stop", "aria-label": "Stop music" }, "■");
  const sound = h("button", { type: "button", class: "p2k-btn p2k-sound", "aria-pressed": "false" },
    h("span", { class: "p2k-sound-icon", "aria-hidden": "true" }, "🔇"), " sound");
  const volume = h("input", { type: "range", min: "0", max: "100", value: "60", "aria-label": "Volume" });
  const dial = h("button", { type: "button", class: "p2k-btn p2k-dial" }, "☎ Dial up to the Internet");

  const audio = createAudio({ onChange: render });

  function render(state = audio.state) {
    sound.setAttribute("aria-pressed", String(!state.muted));
    sound.firstChild.textContent = state.muted ? "🔇" : "🔊";
    play.setAttribute("aria-pressed", String(state.playing));
    if (!dialing) status.textContent = state.playing ? "▶ PLAYING" : state.muted ? "SOUND OFF" : "■ STOPPED";
    node.classList.toggle("is-playing", state.playing);
    if (state.playing && !frame) frame = requestAnimationFrame(draw);
    if (!state.playing) draw();
  }

  function draw() {
    frame = 0;
    const context = canvas.getContext("2d");
    const { width, height } = canvas;
    context.fillStyle = "#020b02";
    context.fillRect(0, 0, width, height);
    const bars = 16;
    const analyser = audio.analyser;
    const playing = audio.state.playing;
    const data = new Uint8Array(analyser ? analyser.frequencyBinCount : bars);
    if (analyser && playing) analyser.getByteFrequencyData(data);
    const barWidth = width / bars;
    for (let bar = 0; bar < bars; bar += 1) {
      const level = data[Math.floor((bar / bars) * data.length * 0.75)] / 255;
      const lit = Math.max(1, Math.round(level * (height / 3)));
      for (let segment = 0; segment < lit; segment += 1) {
        const ratio = segment / (height / 3);
        context.fillStyle = ratio > 0.75 ? "#ff4b3e" : ratio > 0.5 ? "#ffe14b" : "#4bff4b";
        context.fillRect(bar * barWidth + 1, height - (segment + 1) * 3, barWidth - 2, 2);
      }
    }
    const seconds = Math.floor(audio.elapsed());
    clock.textContent = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
    if (playing) frame = requestAnimationFrame(draw);
  }

  play.addEventListener("click", () => audio.play());
  stop.addEventListener("click", () => audio.stop());
  sound.addEventListener("click", () => audio.setMuted(!audio.state.muted));
  volume.addEventListener("input", () => audio.setVolume(Number(volume.value) / 100));
  dial.addEventListener("click", () => {
    if (dialing) return;
    if (audio.state.muted) audio.setMuted(false, { chime: false });
    const seconds = audio.sfx.modem();
    if (!seconds) return;
    dialing = true;
    status.textContent = "DIALING 555-1337";
    const steps = [
      [1.9, "HANDSHAKE..."],
      [seconds - 0.2, "CONNECTED 56K!"],
    ];
    steps.forEach(([at, text]) => window.setTimeout(() => { status.textContent = text; }, at * 1000));
    window.setTimeout(() => {
      dialing = false;
      render();
    }, (seconds + 1.4) * 1000);
  });

  const node = h("div", { class: "p2k-player" },
    h("div", { class: "p2k-lcd" },
      h("div", { class: "p2k-lcd-marquee" }, title),
      h("div", { class: "p2k-lcd-row" }, status, clock),
      canvas),
    h("div", { class: "p2k-controls" }, play, stop, sound),
    h("label", { class: "p2k-volume" }, h("span", {}, "vol"), volume),
    dial,
    h("p", { class: "p2k-small" }, "sound is off until you press play"));

  render();

  return {
    node,
    audio,
    destroy() {
      if (frame) cancelAnimationFrame(frame);
      audio.destroy();
    },
  };
}
