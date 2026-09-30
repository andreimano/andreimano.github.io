// Andrei's Arcade: three small canvas games in the spirit of 2000s Flash game
// portals, for the "peak 2000s" theme. No plug-ins and no downloads; high
// scores live in this browser only. Sounds go through the theme's audio
// engine, so they stay silent unless the visitor turned sound on.

import { h } from "./dom.js";
import { H, IMPACT, MONO, W, circle, clamp, label, overlay, pick, rand } from "./peak2000-canvas.js";
import { lossLandscape3D } from "./peak2000-fps.js";

// Deadline Copter --------------------------------------------------------------------
// The classic cave-helicopter game: hold to climb, let go to drop.

function deadlineCopter(api) {
  const OBSTACLES = ["NaN", "OOM", "R2", "CUDA", "404", "SEGFAULT", "LaTeX", "rebuttal", "deadline"];
  let mode = "title";
  let since = 0;
  let holding = false;
  let best = api.best();
  let heli;
  let walls;
  let blocks;
  let smoke;
  let bits;
  let speed;
  let distance;
  let spawnIn;
  let centre;
  let drift;
  let milestone;
  let killer;
  let newBest;

  const gap = () => Math.max(128, 230 - distance * 0.045);

  function reset() {
    heli = { x: 110, y: H / 2, vy: 0, rotor: 0 };
    centre = H / 2;
    drift = 0;
    distance = 0;
    walls = [];
    for (let x = -8; x <= W + 16; x += 8) walls.push({ x, top: centre - 115, bottom: centre + 115 });
    blocks = [{ x: 330, y: centre - 20, w: 22, h: 74, label: "R2" }];
    smoke = [];
    bits = [];
    speed = 170;
    spawnIn = 1.2;
    milestone = 250;
    killer = "";
    newBest = false;
  }

  function extend() {
    const last = walls[walls.length - 1];
    const g = gap();
    drift = clamp(drift + rand(-1.6, 1.6), -3.2, 3.2);
    centre += drift;
    if (centre - g / 2 < 14) {
      centre = 14 + g / 2;
      drift = Math.abs(drift);
    }
    if (centre + g / 2 > H - 14) {
      centre = H - 14 - g / 2;
      drift = -Math.abs(drift);
    }
    walls.push({ x: last.x + 8, top: centre - g / 2, bottom: centre + g / 2 });
  }

  function wallAt(x) {
    for (let i = 0; i < walls.length - 1; i += 1) {
      const a = walls[i];
      const b = walls[i + 1];
      if (x >= a.x && x <= b.x) {
        const k = (x - a.x) / (b.x - a.x);
        return { top: a.top + (b.top - a.top) * k, bottom: a.bottom + (b.bottom - a.bottom) * k };
      }
    }
    return { top: 0, bottom: H };
  }

  function start() {
    reset();
    blocks = [];
    mode = "play";
    since = 0;
    api.sfx.start();
  }

  function crash(what) {
    mode = "dead";
    since = 0;
    holding = false;
    killer = what;
    api.sfx.crash();
    for (let i = 0; i < 46; i += 1) {
      const angle = rand(0, Math.PI * 2);
      const velocity = rand(40, 260);
      bits.push({
        x: heli.x,
        y: heli.y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: rand(0.5, 1.1),
        color: pick(["#ffd23f", "#ff7b00", "#ff2b2b", "#ffffff"]),
      });
    }
    const score = Math.floor(distance);
    if (score > best) {
      best = score;
      newBest = true;
      api.saveBest(score);
    }
  }

  function update(dt) {
    since += dt;
    heli.rotor += dt * 38;
    bits.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= dt;
    });
    bits = bits.filter((p) => p.life > 0);
    smoke.forEach((p) => {
      p.x -= (mode === "play" ? speed : 50) * dt;
      p.y += p.vy * dt;
      p.r += 14 * dt;
      p.life -= dt;
    });
    smoke = smoke.filter((p) => p.life > 0);

    if (mode === "title") {
      heli.y = H / 2 + Math.sin(since * 2.4) * 12;
      if (Math.random() < dt * 20) smoke.push({ x: heli.x - 20, y: heli.y + 3, vy: rand(-10, 10), r: 3, life: 0.6 });
      return;
    }
    if (mode !== "play") return;

    speed = Math.min(345, 170 + distance * 0.09);
    const dx = speed * dt;
    distance += dx / 10;
    walls.forEach((column) => {
      column.x -= dx;
    });
    while (walls.length > 2 && walls[1].x < -8) walls.shift();
    while (walls[walls.length - 1].x < W + 16) extend();
    blocks.forEach((block) => {
      block.x -= dx;
    });
    blocks = blocks.filter((block) => block.x + block.w > -10);

    spawnIn -= dt;
    if (spawnIn <= 0) {
      spawnIn = rand(0.9, 1.7);
      const edge = walls[walls.length - 1];
      const height = rand(54, 92);
      if (edge.bottom - edge.top - height > 64) {
        blocks.push({ x: W + 10, y: rand(edge.top + 10, edge.bottom - height - 10), w: 22, h: height, label: pick(OBSTACLES) });
      }
    }

    heli.vy = clamp(heli.vy + ((holding ? -1500 : 0) + 720) * dt, -320, 360);
    heli.y += heli.vy * dt;
    if (Math.random() < dt * 28) smoke.push({ x: heli.x - 20, y: heli.y + 3, vy: rand(-12, 12), r: 3, life: 0.6 });
    if (distance >= milestone) {
      milestone += 250;
      api.sfx.coin();
    }

    const box = { left: heli.x - 16, right: heli.x + 17, top: heli.y - 8, bottom: heli.y + 9 };
    for (const x of [box.left, heli.x, box.right]) {
      const wall = wallAt(x);
      if (box.top < wall.top) return crash("the ceiling of scope creep");
      if (box.bottom > wall.bottom) return crash("the floor of unrealistic baselines");
    }
    for (const block of blocks) {
      if (box.right > block.x && box.left < block.x + block.w && box.bottom > block.y && box.top < block.y + block.h) {
        return crash(block.label);
      }
    }
  }

  function drawHeli(ctx) {
    ctx.save();
    ctx.translate(heli.x, heli.y);
    ctx.rotate(clamp(heli.vy / 900, -0.35, 0.35));
    ctx.fillStyle = "#ff2bd6";
    ctx.fillRect(-27, -3, 20, 5);
    ctx.fillStyle = "#ffffff";
    const tail = 5 * Math.abs(Math.sin(heli.rotor * 1.3)) + 2;
    ctx.fillRect(-30, -2 - tail, 3, tail * 2);
    ctx.beginPath();
    ctx.ellipse(2, 0, 15, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ff2bd6";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(8, -2, 7, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#5cf8ff";
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, -13, 3, 5);
    const span = 21 * Math.abs(Math.cos(heli.rotor)) + 4;
    ctx.fillRect(1.5 - span, -15, span * 2, 2);
    ctx.fillRect(-9, 11, 22, 2);
    ctx.fillRect(-5, 8, 2, 4);
    ctx.fillRect(8, 8, 2, 4);
    ctx.restore();
  }

  function render(ctx, { preview = false } = {}) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#04101d");
    sky.addColorStop(1, "#0d2238");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    [["top", 0], ["bottom", H]].forEach(([side, edge]) => {
      ctx.beginPath();
      ctx.moveTo(walls[0].x, edge);
      walls.forEach((column) => ctx.lineTo(column.x, column[side]));
      ctx.lineTo(walls[walls.length - 1].x, edge);
      ctx.closePath();
      ctx.fillStyle = "#15702a";
      ctx.fill();
      ctx.beginPath();
      walls.forEach((column, i) => (i ? ctx.lineTo(column.x, column[side]) : ctx.moveTo(column.x, column[side])));
      ctx.strokeStyle = "#3dff5c";
      ctx.lineWidth = 3;
      ctx.stroke();
    });

    blocks.forEach((block) => {
      ctx.fillStyle = "#3dff5c";
      ctx.fillRect(block.x, block.y, block.w, block.h);
      ctx.fillStyle = "#0b3b12";
      ctx.fillRect(block.x + 3, block.y + 3, block.w - 6, block.h - 6);
      ctx.save();
      ctx.translate(block.x + block.w / 2, block.y + block.h / 2);
      ctx.rotate(-Math.PI / 2);
      label(ctx, block.label, 0, 1, { size: 11, color: "#3dff5c", align: "center", shadow: null });
      ctx.restore();
    });

    smoke.forEach((p) => {
      ctx.fillStyle = `rgba(210, 220, 230, ${clamp(p.life, 0, 1) * 0.55})`;
      circle(ctx, p.x, p.y, p.r);
    });
    if (mode !== "dead") drawHeli(ctx);
    bits.forEach((p) => {
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;
    if (preview) return;

    label(ctx, `DISTANCE ${Math.floor(distance)} m`, 12, 16, { size: 13, color: "#3dff5c" });
    label(ctx, `BEST ${best} m`, W - 12, 16, { size: 13, color: "#3dff5c", align: "right" });
    if (mode === "title") {
      overlay(ctx, "DEADLINE COPTER", ["hold to fly up · let go to drop", "dodge the NaNs, the OOMs and Reviewer 2", "click, tap or press SPACE to start"]);
    }
    if (mode === "dead") {
      overlay(ctx, "CRASHED!", [
        `into: ${killer}`,
        `${Math.floor(distance)} m${newBest ? "   ★ NEW BEST ★" : `   (best: ${best} m)`}`,
        since > 0.6 ? "click, tap or press SPACE to try again" : "",
      ]);
    }
  }

  function press() {
    if (mode === "play") holding = true;
    else if (mode === "title" || since > 0.6) {
      start();
      holding = true;
    }
  }

  reset();

  return {
    update,
    render,
    pointerdown: press,
    pointerup() {
      holding = false;
    },
    key(event, down) {
      if (![" ", "ArrowUp", "w", "W"].includes(event.key)) return false;
      if (down) press();
      else holding = false;
      return true;
    },
  };
}

// Citation Snake -----------------------------------------------------------------------
// Snake in Game Boy greens. Citations make you longer; walls are a desk reject.

function citationSnake(api) {
  const COLS = 24;
  const ROWS = 14;
  const CELL = 20;
  const TOP = 40;
  const DARKEST = "#0f380f";
  const DARK = "#306230";
  const LIGHT = "#8bac0f";
  const LIGHTEST = "#9bbc0f";
  const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const KEYS = {
    ArrowUp: "up", w: "up", W: "up",
    ArrowDown: "down", s: "down", S: "down",
    ArrowLeft: "left", a: "left", A: "left",
    ArrowRight: "right", d: "right", D: "right",
  };

  let mode = "title";
  let since = 0;
  let best = api.best();
  let body;
  let dir;
  let queue;
  let grow;
  let food;
  let award;
  let eaten;
  let score;
  let acc;
  let stepTime;
  let newBest;
  let swipe = null;

  const occupied = (cell) =>
    body.some((part) => part.x === cell.x && part.y === cell.y) ||
    (food && food.x === cell.x && food.y === cell.y) ||
    (award && award.x === cell.x && award.y === cell.y);

  function place() {
    let cell;
    do cell = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    while (occupied(cell));
    return cell;
  }

  function reset() {
    body = [{ x: 9, y: 7 }, { x: 8, y: 7 }, { x: 7, y: 7 }, { x: 6, y: 7 }];
    dir = DIRECTIONS.right;
    queue = [];
    grow = 0;
    eaten = 0;
    score = 0;
    acc = 0;
    stepTime = 0.14;
    award = null;
    food = null;
    newBest = false;
    food = place();
  }

  function start() {
    reset();
    mode = "play";
    since = 0;
    api.sfx.start();
  }

  function turn(name) {
    const next = DIRECTIONS[name];
    const last = queue.length ? queue[queue.length - 1] : dir;
    if ((next.x === -last.x && next.y === -last.y) || (next.x === last.x && next.y === last.y)) return;
    if (queue.length < 3) queue.push(next);
  }

  function steer(name) {
    if (mode !== "play") {
      if (mode === "dead" && since < 0.5) return;
      start();
    }
    turn(name);
  }

  function die() {
    mode = "dead";
    since = 0;
    api.sfx.gameOver();
    if (score > best) {
      best = score;
      newBest = true;
      api.saveBest(score);
    }
  }

  function step() {
    if (queue.length) dir = queue.shift();
    const head = { x: body[0].x + dir.x, y: body[0].y + dir.y };
    if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) return die();
    const tailMoves = grow === 0;
    if (body.some((part, i) => part.x === head.x && part.y === head.y && !(tailMoves && i === body.length - 1))) return die();
    body.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 1;
      eaten += 1;
      grow += 1;
      stepTime = Math.max(0.065, stepTime - 0.003);
      api.sfx.eat();
      food = place();
      if (eaten % 5 === 0) award = { ...place(), ttl: 6 };
    }
    if (award && head.x === award.x && head.y === award.y) {
      score += 5;
      grow += 3;
      award = null;
      api.sfx.coin();
    }
    if (grow > 0) grow -= 1;
    else body.pop();
    return null;
  }

  function update(dt) {
    since += dt;
    if (mode !== "play") return;
    if (award) {
      award.ttl -= dt;
      if (award.ttl <= 0) award = null;
    }
    acc += dt;
    while (acc >= stepTime && mode === "play") {
      acc -= stepTime;
      step();
    }
  }

  function cell(ctx, x, y, inset, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * CELL + inset, TOP + y * CELL + inset, CELL - inset * 2, CELL - inset * 2);
  }

  function render(ctx, { preview = false } = {}) {
    ctx.fillStyle = LIGHTEST;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = LIGHT;
    for (let x = 0; x < COLS; x += 1) {
      for (let y = 0; y < ROWS; y += 1) ctx.fillRect(x * CELL + 9, TOP + y * CELL + 9, 2, 2);
    }
    ctx.fillStyle = DARKEST;
    ctx.fillRect(0, 0, W, TOP - 4);

    // a citation: a little page with lines on it
    cell(ctx, food.x, food.y, 3, DARKEST);
    cell(ctx, food.x, food.y, 5, LIGHTEST);
    ctx.fillStyle = DARKEST;
    for (let line = 0; line < 3; line += 1) ctx.fillRect(food.x * CELL + 7, TOP + food.y * CELL + 7 + line * 3, 6, 1);

    if (award && (award.ttl > 1.5 || Math.floor(since * 8) % 2)) {
      label(ctx, "★", award.x * CELL + CELL / 2, TOP + award.y * CELL + CELL / 2 + 1, { size: 20, color: DARKEST, align: "center", shadow: null, weight: "normal" });
    }

    body.forEach((part, i) => {
      cell(ctx, part.x, part.y, 1, DARKEST);
      if (i > 0) cell(ctx, part.x, part.y, 5, DARK);
    });
    const head = body[0];
    ctx.fillStyle = LIGHTEST;
    const eyes = dir.x !== 0
      ? [[CELL / 2 + dir.x * 4, 6], [CELL / 2 + dir.x * 4, 13]]
      : [[6, CELL / 2 + dir.y * 4], [13, CELL / 2 + dir.y * 4]];
    eyes.forEach(([ex, ey]) => ctx.fillRect(head.x * CELL + ex - 1, TOP + head.y * CELL + ey - 1, 3, 3));
    if (preview) return;

    label(ctx, `CITATIONS ${score}`, 12, 18, { size: 14, color: LIGHTEST, shadow: null });
    label(ctx, `h-index ${Math.floor(Math.sqrt(score))}`, W / 2, 18, { size: 14, color: LIGHT, align: "center", shadow: null });
    label(ctx, `BEST ${best}`, W - 12, 18, { size: 14, color: LIGHTEST, align: "right", shadow: null });

    const panel = (title, lines) => {
      ctx.fillStyle = DARKEST;
      ctx.fillRect(60, 90, W - 120, 170);
      ctx.fillStyle = LIGHTEST;
      ctx.fillRect(64, 94, W - 128, 162);
      ctx.fillStyle = DARKEST;
      ctx.fillRect(68, 98, W - 136, 154);
      label(ctx, title, W / 2, 128, { size: 34, font: IMPACT, weight: "normal", color: LIGHTEST, align: "center", shadow: DARK });
      lines.filter(Boolean).forEach((line, i) => label(ctx, line, W / 2, 168 + i * 22, { size: 13, color: LIGHT, align: "center", shadow: null }));
    };
    if (mode === "title") {
      panel("CITATION SNAKE", ["eat citations, grow your h-index", "★ = best paper award (+5)", "arrows / WASD / swipe to start"]);
    }
    if (mode === "dead") {
      panel("DESK REJECT!", [
        `citations: ${score} · h-index: ${Math.floor(Math.sqrt(score))}`,
        newBest ? "★ NEW PERSONAL BEST ★" : `best: ${best}`,
        since > 0.5 ? "press an arrow or tap to resubmit" : "",
      ]);
    }
  }

  reset();

  return {
    update,
    render,
    pad(name, down) {
      if (down) steer(name);
    },
    pointerdown(point) {
      swipe = point;
    },
    pointerup(point) {
      if (!swipe || !point) return;
      const dx = point.x - swipe.x;
      const dy = point.y - swipe.y;
      swipe = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
        if (mode !== "play" && (mode === "title" || since > 0.5)) start();
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? "right" : "left");
      else steer(dy > 0 ? "down" : "up");
    },
    key(event, down) {
      if (event.key === " " || event.key === "Enter") {
        if (down && mode !== "play" && (mode === "title" || since > 0.5)) start();
        return true;
      }
      const name = KEYS[event.key];
      if (!name) return false;
      if (down) steer(name);
      return true;
    },
  };
}

// Whack-a-Reviewer -------------------------------------------------------------------
// Bonk Reviewer 2, spare the Area Chair, and see what the reviews say.

function whackAReviewer(api) {
  const ROUND = 30;
  const HOLES = [0, 1, 2].flatMap((row) => [0, 1, 2].map((col) => ({ x: 96 + col * 144, y: 118 + row * 78, who: null })));
  const KEYS = { 7: 0, 8: 1, 9: 2, 4: 3, 5: 4, 6: 5, 1: 6, 2: 7, 3: 8, q: 0, w: 1, e: 2, a: 3, s: 4, d: 5, z: 6, x: 7, c: 8 };
  const VERDICTS = [[25, "ORAL!!!"], [20, "Accept"], [15, "Weak accept"], [10, "Borderline"], [5, "Weak reject"], [-Infinity, "Strong reject"]];

  let mode = "title";
  let since = 0;
  let best = api.best();
  let left = ROUND;
  let score = 0;
  let spawnIn = 0;
  let pops = [];
  let newBest = false;

  const verdict = () => VERDICTS.find(([threshold]) => score >= threshold)[1];

  function reset() {
    HOLES.forEach((hole) => {
      hole.who = null;
    });
    left = ROUND;
    score = 0;
    spawnIn = 0.5;
    pops = [];
    newBest = false;
  }

  function start() {
    reset();
    mode = "play";
    since = 0;
    api.sfx.start();
  }

  function spawn() {
    const empty = HOLES.filter((hole) => !hole.who);
    if (!empty.length) return;
    const roll = Math.random();
    const progress = 1 - left / ROUND;
    pick(empty).who = {
      kind: roll < 0.13 ? "chair" : roll < 0.2 ? "gold" : "reviewer",
      t: 0,
      up: rand(0.8, 1.15) - progress * 0.35,
      hit: false,
      hitAt: 0,
    };
  }

  function height(who) {
    const rise = 0.14;
    if (who.hit) return Math.max(0, 1 - (who.t - who.hitAt) / 0.22);
    if (who.t < rise) return who.t / rise;
    if (who.t > who.up - rise) return Math.max(0, (who.up - who.t) / rise);
    return 1;
  }

  function bonk(hole) {
    const who = hole.who;
    if (!who || who.hit || height(who) < 0.35) {
      pops.push({ x: hole.x, y: hole.y - 30, text: "miss", color: "#e8e8e8", life: 0.5 });
      return;
    }
    who.hit = true;
    who.hitAt = who.t;
    const value = who.kind === "chair" ? -2 : who.kind === "gold" ? 3 : 1;
    score += value;
    pops.push({ x: hole.x, y: hole.y - 76, text: value > 0 ? `+${value}` : `${value}`, color: value > 0 ? "#fff35c" : "#ff4b3e", life: 0.8 });
    if (who.kind === "chair") api.sfx.oops();
    else if (who.kind === "gold") api.sfx.coin();
    else api.sfx.whack();
  }

  function update(dt) {
    since += dt;
    pops.forEach((p) => {
      p.y -= 40 * dt;
      p.life -= dt;
    });
    pops = pops.filter((p) => p.life > 0);
    if (mode === "title") {
      HOLES[4].who = { kind: "reviewer", t: 0.5, up: 99, hit: false, hitAt: 0 };
      return;
    }
    if (mode !== "play") return;
    left -= dt;
    if (left <= 0) {
      left = 0;
      mode = "dead";
      since = 0;
      HOLES.forEach((hole) => {
        hole.who = null;
      });
      api.sfx.gameOver();
      if (score > best) {
        best = score;
        newBest = true;
        api.saveBest(score);
      }
      return;
    }
    spawnIn -= dt;
    if (spawnIn <= 0) {
      spawn();
      spawnIn = rand(0.55, 0.95) - (1 - left / ROUND) * 0.3;
    }
    HOLES.forEach((hole) => {
      const who = hole.who;
      if (!who) return;
      who.t += dt;
      if ((who.hit && who.t - who.hitAt > 0.25) || (!who.hit && who.t > who.up)) hole.who = null;
    });
  }

  function character(ctx, kind, x, y, dazed) {
    const shirt = { reviewer: "#6b3fa0", chair: "#2b59c3", gold: "#c9971c" }[kind];
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.ellipse(x, y + 44, 34, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = kind === "gold" ? "#ffd84a" : "#f2c29b";
    circle(ctx, x, y, 26);

    ctx.strokeStyle = "#1a1a1a";
    ctx.fillStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    if (kind === "reviewer") {
      ctx.fillStyle = "#e0282e";
      ctx.beginPath();
      ctx.arc(x, y - 8, 27, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x - 3, y - 12, 34, 5);
      label(ctx, "2", x, y - 22, { size: 16, color: "#fff", align: "center", shadow: null });
    } else if (kind === "chair") {
      ctx.fillStyle = "#3b2a1a";
      ctx.beginPath();
      ctx.arc(x, y - 6, 27, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(x - 15, y + 34, 30, 13);
      label(ctx, "AC", x, y + 41, { size: 11, color: "#2b59c3", align: "center", shadow: null });
    } else {
      label(ctx, "★", x, y - 24, { size: 22, color: "#fff35c", align: "center", shadow: "#8a5a00", weight: "normal" });
    }

    ctx.fillStyle = "#1a1a1a";
    if (dazed) {
      [-10, 10].forEach((dx) => {
        ctx.beginPath();
        ctx.moveTo(x + dx - 4, y - 4);
        ctx.lineTo(x + dx + 4, y + 4);
        ctx.moveTo(x + dx + 4, y - 4);
        ctx.lineTo(x + dx - 4, y + 4);
        ctx.stroke();
      });
    } else {
      [-10, 10].forEach((dx) => circle(ctx, x + dx, y, 3));
      if (kind === "reviewer") {
        [-10, 10].forEach((dx) => {
          ctx.beginPath();
          ctx.arc(x + dx, y, 7, 0, Math.PI * 2);
          ctx.stroke();
        });
        ctx.beginPath();
        ctx.moveTo(x - 17, y - 12);
        ctx.lineTo(x - 5, y - 8);
        ctx.moveTo(x + 17, y - 12);
        ctx.lineTo(x + 5, y - 8);
        ctx.stroke();
      }
    }
    ctx.beginPath();
    if (kind === "reviewer" && !dazed) ctx.arc(x, y + 17, 7, Math.PI * 1.15, Math.PI * 1.85);
    else ctx.arc(x, y + 8, 8, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }

  function render(ctx, { preview = false } = {}) {
    ctx.fillStyle = "#3f9a26";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#4caf2e";
    for (let stripe = 0; stripe < H; stripe += 40) ctx.fillRect(0, stripe, W, 20);

    HOLES.forEach((hole) => {
      ctx.fillStyle = "#2b1a0e";
      ctx.beginPath();
      ctx.ellipse(hole.x, hole.y, 50, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      if (hole.who) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(hole.x - 64, hole.y - 120, 128, 120);
        ctx.clip();
        character(ctx, hole.who.kind, hole.x, hole.y + 44 - height(hole.who) * 80, hole.who.hit);
        ctx.restore();
      }
      ctx.fillStyle = "#7a4e26";
      ctx.beginPath();
      ctx.ellipse(hole.x, hole.y, 54, 18, 0, 0, Math.PI);
      ctx.ellipse(hole.x, hole.y, 50, 12, 0, Math.PI, 0, true);
      ctx.fill();
    });

    pops.forEach((p) => {
      ctx.globalAlpha = clamp(p.life / 0.5, 0, 1);
      label(ctx, p.text, p.x, p.y, { size: 20, font: IMPACT, weight: "normal", color: p.color, align: "center" });
    });
    ctx.globalAlpha = 1;
    if (preview) return;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, W, 34);
    label(ctx, `REVIEWS DISMISSED ${score}`, 12, 17, { size: 13, color: "#fff35c" });
    label(ctx, `TIME ${Math.ceil(left)}`, W / 2 + 40, 17, { size: 13, color: left < 6 && mode === "play" ? "#ff4b3e" : "#fff", align: "center" });
    label(ctx, `BEST ${best}`, W - 12, 17, { size: 13, color: "#fff", align: "right" });

    if (mode === "title") {
      overlay(ctx, "WHACK-A-REVIEWER", ["bonk Reviewer 2 (+1)  ·  gold reviewers +3", "don't bonk the Area Chair (-2)!", "click, tap or press 1–9 to start"], { tint: "rgba(0, 0, 0, 0.45)" });
    }
    if (mode === "dead") {
      overlay(ctx, "TIME'S UP!", [
        `${score} reviews dismissed → verdict: ${verdict()}`,
        newBest ? "★ NEW BEST ★" : `best: ${best}`,
        since > 0.6 ? "click, tap or press SPACE to resubmit" : "",
      ]);
    }
  }

  const holeAt = (point) => HOLES.find((hole) => Math.abs(point.x - hole.x) < 60 && point.y > hole.y - 64 && point.y < hole.y + 14);

  function press(point) {
    if (mode !== "play") {
      if (mode === "title" || since > 0.6) start();
      return;
    }
    const hole = point && holeAt(point);
    if (hole) bonk(hole);
  }

  return {
    update,
    render,
    pointerdown: press,
    key(event, down) {
      const index = KEYS[event.key];
      if (index === undefined && event.key !== " " && event.key !== "Enter") return false;
      if (!down) return true;
      if (mode !== "play") press(null);
      else if (index !== undefined) bonk(HOLES[index]);
      return true;
    },
  };
}

// The arcade cabinet ----------------------------------------------------------------------

const GAMES = [
  {
    id: "fps",
    title: "Loss Landscape 3D",
    file: "loss_landscape_3d.swf",
    make: lossLandscape3D,
    unit: " s",
    pad: "fps",
    help: "WASD or arrows to move (Q/E to strafe), SPACE or click to fire ideas. Debug the bugs, grab coffee, find the EXIT. Rumour has it nobody has ever beaten the final boss.",
  },
  {
    id: "copter",
    title: "Deadline Copter",
    file: "deadline_copter.swf",
    make: deadlineCopter,
    unit: " m",
    help: "Hold the mouse, SPACE or your finger to fly up; let go to drop. Dodge the NaNs, the OOMs and Reviewer 2.",
  },
  {
    id: "snake",
    title: "Citation Snake",
    file: "citation_snake.swf",
    make: citationSnake,
    unit: "",
    pad: "snake",
    help: "Arrow keys, WASD, swipes or the buttons below. Eat citations to grow your h-index; the walls are a desk reject.",
  },
  {
    id: "whack",
    title: "Whack-a-Reviewer",
    file: "whack_a_reviewer.swf",
    make: whackAReviewer,
    unit: "",
    help: "Click or tap Reviewer 2 (keys 1–9 work too, laid out like a numpad). Don't bonk the Area Chair. 30 seconds per round.",
  },
];

const PADS = {
  snake: [["up", "▲", "Turn up"], ["left", "◀", "Turn left"], ["down", "▼", "Turn down"], ["right", "▶", "Turn right"]],
  fps: [["left", "↺", "Turn left"], ["up", "▲", "Walk forward"], ["down", "▼", "Walk back"], ["right", "↻", "Turn right"], ["fire", "FIRE", "Fire an idea"]],
};

const scores = {
  get(id) {
    try {
      return Number(localStorage.getItem(`andrei-p2k-best-${id}`)) || 0;
    } catch (error) {
      return 0;
    }
  },
  set(id, value) {
    try {
      localStorage.setItem(`andrei-p2k-best-${id}`, String(value));
    } catch (error) {
      // No storage: the score is only kept for this visit.
    }
  },
};

function sharpCanvas(canvas, width, height) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio * (width / W), 0, 0, ratio * (height / H), 0, 0);
  return ctx;
}

export function createArcade({ sfx, reducedMotion = false }) {
  const timers = new Set();
  const silent = new Proxy({}, { get: () => () => {} });

  const canvas = h("canvas", { class: "p2k-game", tabindex: "0" });
  const ctx = sharpCanvas(canvas, W, H);
  const fileLabel = h("span", {});
  const percent = h("b", {}, "0%");
  const bar = h("i", {});
  const preloader = h("div", { class: "p2k-preloader" }, h("span", { class: "p2k-preloader-file" }), h("span", {}, "LOADING... ", percent), h("span", { class: "p2k-progress" }, bar));
  preloader.hidden = true;
  const help = h("p", { class: "p2k-arcade-help" });
  const scoreLine = h("p", { class: "p2k-arcade-scores" });

  let game = null;
  let current = null;
  let frame = 0;
  let last = 0;
  let visible = true;

  // On-screen buttons for touch screens. Holding a button holds the key.
  const pad = h("div", { class: "p2k-dpad", role: "group", "aria-label": "Game controls" });
  pad.hidden = true;

  function padButton(name, glyph, text) {
    const press = (down) => {
      if (game && game.pad) game.pad(name, down);
    };
    return h("button", {
      type: "button",
      class: `p2k-btn p2k-pad-${name}`,
      "aria-label": text,
      onpointerdown: (event) => {
        event.preventDefault();
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch (error) {
          // Not capturable (e.g. a synthetic event); pointerup still arrives.
        }
        press(true);
      },
      onpointerup: () => press(false),
      onpointercancel: () => press(false),
      onlostpointercapture: () => press(false),
      // Keyboard activation fires a click with no pointer (detail 0).
      onclick: (event) => {
        if (event.detail !== 0) return;
        press(true);
        window.setTimeout(() => press(false), 150);
      },
    }, glyph);
  }

  function buildPad(def) {
    pad.hidden = !def.pad;
    pad.replaceChildren(...(def.pad ? PADS[def.pad].map((button) => padButton(...button)) : []));
    if (def.pad) pad.dataset.layout = def.pad;
  }

  function loop(now) {
    frame = 0;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (game) {
      game.update(dt);
      game.render(ctx);
    }
    if (visible && !document.hidden) frame = requestAnimationFrame(loop);
  }

  function run() {
    if (!frame && visible && !document.hidden && game) {
      last = performance.now();
      frame = requestAnimationFrame(loop);
    }
  }

  function halt() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function renderScores() {
    scoreLine.replaceChildren(
      "Your high scores: ",
      ...GAMES.flatMap((def, i) => [i ? " · " : "", h("b", {}, def.title), ` ${scores.get(def.id)}${def.unit}`]),
    );
  }

  const cartridges = GAMES.map((def) => {
    const thumb = h("canvas", { class: "p2k-cart-thumb", "aria-hidden": "true" });
    const preview = def.make({ sfx: silent, best: () => 0, saveBest: () => {} });
    preview.update(0.4);
    preview.render(sharpCanvas(thumb, 120, 80), { preview: true });
    return h("button", { type: "button", class: "p2k-cart", "aria-pressed": "false", onclick: () => load(def, { focus: true }) },
      thumb, h("b", {}, def.title), h("span", {}, def.file));
  });

  function load(def, { focus = false } = {}) {
    current = def;
    GAMES.forEach((item, i) => cartridges[i].setAttribute("aria-pressed", String(item === def)));
    cabinet.dataset.game = def.id;
    fileLabel.textContent = def.file;
    preloader.firstChild.textContent = def.file;
    help.textContent = def.help;
    buildPad(def);
    canvas.setAttribute("aria-label", `${def.title}. ${def.help}`);
    halt();
    game = null;
    timers.forEach((id) => window.clearInterval(id));
    timers.clear();

    const ready = () => {
      if (current !== def) return;
      preloader.hidden = true;
      game = def.make({ sfx, best: () => scores.get(def.id), saveBest: (value) => { scores.set(def.id, value); renderScores(); } });
      game.render(ctx);
      run();
      if (focus) canvas.focus({ preventScroll: true });
    };
    if (reducedMotion) return ready();

    let progress = 0;
    preloader.hidden = false;
    percent.textContent = "0%";
    bar.style.width = "0%";
    const id = window.setInterval(() => {
      progress = Math.min(100, progress + rand(8, 24));
      percent.textContent = `${Math.round(progress)}%`;
      bar.style.width = `${progress}%`;
      if (progress >= 100) {
        window.clearInterval(id);
        timers.delete(id);
        window.setTimeout(ready, 160);
      }
    }, 90);
    timers.add(id);
    return null;
  }

  const point = (event) => {
    const box = canvas.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * W, y: ((event.clientY - box.top) / box.height) * H };
  };

  canvas.addEventListener("pointerdown", (event) => {
    if (!game) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      // Some pointers (or synthetic events) can't be captured; the game still works.
    }
    if (game.pointerdown) game.pointerdown(point(event));
  });
  canvas.addEventListener("pointerup", (event) => {
    if (game && game.pointerup) game.pointerup(point(event));
  });
  canvas.addEventListener("pointercancel", () => {
    if (game && game.pointerup) game.pointerup(null);
  });
  canvas.addEventListener("keydown", (event) => {
    if (game && game.key && game.key(event, true)) event.preventDefault();
  });
  canvas.addEventListener("keyup", (event) => {
    if (game && game.key && game.key(event, false)) event.preventDefault();
  });
  canvas.addEventListener("blur", () => {
    if (game && game.pointerup) game.pointerup(null);
  });

  const cabinet = h("div", { class: "p2k-flash" },
    h("div", { class: "p2k-flash-bar" }, fileLabel, h("span", {}, "Andrei's Arcade")),
    h("div", { class: "p2k-stage" }, canvas, preloader),
    pad);

  const node = h("section", { class: "section p2k-arcade", id: "arcade", "aria-labelledby": "arcade-title" },
    h("h2", { id: "arcade-title" }, "Arcade"),
    h("div", { class: "section-body" },
      h("p", { class: "p2k-arcade-intro" }, "★ FREE online games!!! ★ No download, no plug-in, no sign-up. Best played the night before a deadline."),
      h("div", { class: "p2k-carts", role: "group", "aria-label": "Choose a game" }, cartridges),
      cabinet,
      help,
      scoreLine));

  const watcher = "IntersectionObserver" in window
    ? new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) run();
      else halt();
    })
    : null;
  if (watcher) watcher.observe(cabinet);
  const onVisibility = () => (document.hidden ? halt() : run());
  document.addEventListener("visibilitychange", onVisibility);

  renderScores();
  load(GAMES[0]);

  return {
    node,
    destroy() {
      halt();
      game = null;
      timers.forEach((id) => window.clearInterval(id));
      timers.clear();
      if (watcher) watcher.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
