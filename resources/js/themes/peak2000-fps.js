// Loss Landscape 3D: a tiny DOOM-style raycaster for the peak 2000s arcade.
//
// Debug the bugs, head for the EXIT... and meet the final boss, the Pioneer:
// a friendly tribute to one of deep learning's pioneers. As in the famous ML
// in-joke, every idea you bring was already published, so the Pioneer cannot
// be beaten. Nobody gets hurt: you fire ideas, and the answers are (real) prior art.

import { H, IMPACT, W, clamp, label, overlay } from "./peak2000-canvas.js";
import { TEX, TEXTURES, canvasOf, drawFace, makeSprites } from "./peak2000-fps-art.js";

const RW = 240; // the 3D view renders at half resolution...
const RH = 136;
const VIEW_H = RH * 2; // ...and is doubled to 480×272, above a 48px status bar
const RADIUS = 0.22;
const MAX_NOVELTY = 200;

// The ideas you fire at the Pioneer, and the (accurate) replies.
const PRIOR_ART = [
  ["GANs", "Adversarial artificial curiosity. 1990."],
  ["Transformers", "Fast weight programmers. 1991."],
  ["ResNets", "Highway networks. May 2015."],
  ["equivariant nets", "Interesting! Let me check my 1991 reports..."],
  ["meta-learning", "My diploma thesis. 1987."],
  ["world models", "Making the world differentiable. 1990."],
  ["self-improving AI", "The Gödel machine. 2003."],
  ["distillation", "The neural history compressor. 1991."],
  ["gated RNNs", "LSTM. 1997, with Sepp Hochreiter."],
  ["speech recognition", "CTC. 2006."],
  ["deep CNNs on GPUs", "DanNet. 2011."],
  ["disentangled codes", "Predictability minimization. 1991."],
  ["curiosity", "Curiosity and boredom. 1991."],
  ["generative art", "Low-complexity art. 1997."],
  ["a theory of fun", "The formal theory of fun. 1990-2010."],
];

const BUGS = [
  [4.5, 6.5, "nan"],
  [11, 2, "oom"],
  [14, 5, "vanish"],
  [18.5, 2.5, "nan"],
  [21, 7, "oom"],
  [18, 5, "nan"],
  [15.5, 10.5, "vanish"],
];
const COFFEE = [[1.5, 7.5], [21.5, 1.5], [10, 7.5]];
const BUG_HP = { nan: 2, oom: 3, vanish: 1 };
const BUG_SPEED = { nan: 1.1, oom: 0.75, vanish: 1.5 };
const BUG_FIXED = { nan: "DEBUGGED A NaN.", oom: "FIXED AN OUT-OF-MEMORY ERROR.", vanish: "RESTORED A VANISHING GRADIENT." };
const DOOR = { x: 15, y: 12 };

const KEYS = {
  ArrowUp: "up", w: "up", W: "up",
  ArrowDown: "down", s: "down", S: "down",
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right",
  q: "strafeLeft", Q: "strafeLeft",
  e: "strafeRight", E: "strafeRight",
  " ": "fire", f: "fire", F: "fire", Enter: "fire", Control: "fire",
};

// The level: a start lab, a server room, a corridor, and the Pioneer's office.
function buildMap() {
  const width = 24;
  const height = 22;
  const grid = Array.from({ length: height }, () => Array(width).fill("#"));
  const carve = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) grid[y][x] = ".";
  };
  carve(1, 1, 6, 8);
  carve(7, 4, 8, 5);
  carve(9, 1, 22, 8);
  [[12, 3], [12, 6], [16, 3], [16, 6], [20, 3], [20, 6]].forEach(([x, y]) => {
    grid[y][x] = "S";
  });
  carve(15, 9, 15, 11);
  grid[DOOR.y][DOOR.x] = "D";
  carve(4, 13, 21, 20);
  [[8, 16], [17, 16]].forEach(([x, y]) => {
    grid[y][x] = "P";
  });

  const touches = (x, y, test) =>
    [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[y + dy] && grid[y + dy][x + dx] === "." && test(x + dx, y + dy));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (grid[y][x] !== "#") continue;
      if (touches(x, y, (fx, fy) => fy >= 13)) grid[y][x] = "C";
      else if (touches(x, y, (fx, fy) => fx >= 9 && fy <= 8) && (x + y) % 3 === 0) grid[y][x] = "Q";
      else if (touches(x, y, (fx, fy) => fx <= 6 && fy <= 8) && (x * 7 + y) % 4 === 0) grid[y][x] = "W";
    }
  }
  return grid;
}

export function lossLandscape3D(api) {
  const textures = Object.fromEntries(Object.entries(TEXTURES).map(([key, paint]) => [key, canvasOf(TEX, TEX, paint)]));
  textures.X = textures.D;
  const sprites = makeSprites();
  const view = document.createElement("canvas");
  view.width = RW;
  view.height = RH;
  const g = view.getContext("2d");
  const depth = new Float32Array(RW);

  const skies = {
    lab: [["#15171c", "#2c3038"], ["#26231f", "#4d463d"]],
    office: [["#1a1030", "#3d2b52"], ["#3a2f18", "#86703a"]],
  };
  const gradients = {};
  const gradient = (name, half) => {
    const key = `${name}-${half}`;
    if (!gradients[key]) {
      const [top, bottom] = skies[name][half];
      const fill = g.createLinearGradient(0, half ? RH / 2 : 0, 0, half ? RH : RH / 2);
      fill.addColorStop(0, top);
      fill.addColorStop(1, bottom);
      gradients[key] = fill;
    }
    return gradients[key];
  };

  let mode = "title";
  let since = 0;
  let best = api.best();
  let lasted = 0;
  let newBest = false;
  let grid;
  let player;
  let bugs;
  let cups;
  let ideas;
  let papers;
  let pops;
  let messages;
  let held;
  let novelty;
  let fixed;
  let cooldown;
  let hurt;
  let hurtSound;
  let flash;
  let walk;
  let boss;
  let bossMode;
  let bossTime;
  let banner;
  let nextIdea;
  let sealed;
  let god = false;
  let typed = "";
  let asking = false;
  let speaking = 0;
  let grin = 0;
  let clock = 0;

  const at = (x, y) => (grid[Math.floor(y)] && grid[Math.floor(y)][Math.floor(x)]) || "#";
  const solid = (cell) => cell !== "." && cell !== "d";
  const blocked = (x, y, r) =>
    solid(at(x - r, y - r)) || solid(at(x + r, y - r)) || solid(at(x - r, y + r)) || solid(at(x + r, y + r));

  function tryMove(thing, dx, dy, r) {
    if (!blocked(thing.x + dx, thing.y, r)) thing.x += dx;
    if (!blocked(thing.x, thing.y + dy, r)) thing.y += dy;
  }

  function sees(ax, ay, bx, by) {
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.1);
    for (let i = 1; i < steps; i += 1) {
      if (solid(at(ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps))) return false;
    }
    return true;
  }

  function say(text, color = "#ff4b3e") {
    messages.unshift({ text, color, life: 4.5 });
    messages.length = Math.min(messages.length, 3);
  }

  function reset() {
    grid = buildMap();
    player = { x: 2.5, y: 2.5, a: 0.35 };
    bugs = BUGS.map(([x, y, kind]) => ({ x, y, kind, hp: BUG_HP[kind], alive: true }));
    cups = COFFEE.map(([x, y]) => ({ x, y, taken: false }));
    ideas = [];
    papers = [];
    pops = [];
    messages = [];
    held = {};
    novelty = MAX_NOVELTY;
    fixed = 0;
    cooldown = 0;
    hurt = 0;
    hurtSound = 0;
    flash = 0;
    walk = 0;
    boss = { x: 12.5, y: 18.5, t: 0, throwIn: 1.6 };
    bossMode = false;
    bossTime = 0;
    banner = 0;
    nextIdea = 0;
    sealed = false;
    newBest = false;
    god = false;
    asking = false;
    speaking = 0;
    grin = 0;
  }

  // Classic cheat codes. None of them help against the final boss.
  function cheat() {
    if (typed.endsWith("iddqd")) {
      typed = "";
      god = !god;
      say(god ? "DEGREELESSNESS MODE ON" : "DEGREELESSNESS MODE OFF", "#ffffff");
    }
    if (typed.endsWith("idclev") && !bossMode) {
      typed = "";
      Object.assign(player, { x: 15.5, y: 10.5, a: Math.PI / 2 });
      say("WARPING TO THE EXIT...", "#ffffff");
    }
  }

  function start() {
    reset();
    mode = "play";
    since = 0;
    say("Debug the bugs. Find the EXIT.", "#fff35c");
    say("E1M1: THE LOSS LANDSCAPE", "#ffffff");
    api.sfx.start();
  }

  function damage(amount, sharp) {
    novelty -= amount;
    hurt = Math.max(hurt, sharp ? 1 : 0.4);
    if (hurtSound <= 0) {
      api.sfx.hurt();
      hurtSound = 0.45;
    }
  }

  function fire() {
    cooldown = 0.32;
    flash = 0.09;
    const dx = Math.cos(player.a);
    const dy = Math.sin(player.a);
    const idea = { x: player.x + dx * 0.3, y: player.y + dy * 0.3, dx: dx * 7, dy: dy * 7, life: 2.2 };
    // At the boss, one idea at a time gets a reply (the Pioneer likes to finish a sentence).
    if (bossMode && !asking && speaking <= 0) {
      const [name, reply] = PRIOR_ART[nextIdea % PRIOR_ART.length];
      nextIdea += 1;
      idea.reply = reply;
      asking = true;
      say(`YOU: “${name}!”`, "#5cf8ff");
    }
    ideas.push(idea);
    api.sfx.shoot();
  }

  function throwPaper(cost) {
    const d = Math.hypot(player.x - boss.x, player.y - boss.y) || 1;
    papers.push({ x: boss.x, y: boss.y, dx: ((player.x - boss.x) / d) * 4.2, dy: ((player.y - boss.y) / d) * 4.2, life: 6, cost });
  }

  function enterOffice() {
    bossMode = true;
    sealed = true;
    grid[DOOR.y][DOOR.x] = "X";
    // Bugs don't dare to follow you into the Pioneer's office.
    bugs.forEach((bug) => {
      if (bug.alive && bug.y > DOOR.y) {
        bug.alive = false;
        pops.push({ x: bug.x, y: bug.y, life: 0.5, big: true });
      }
    });
    boss.t = 0;
    bossTime = 0;
    banner = 3;
    if (god) {
      god = false;
      say("THE PIONEER: “Cheat codes do not work in peer review.”", "#ffd23f");
    }
    say("THE PIONEER: “Welcome! Show me your most novel idea.”", "#ffd23f");
    api.sfx.boss();
  }

  function lose() {
    novelty = 0;
    since = 0;
    held = {};
    if (bossMode) {
      mode = "scooped";
      lasted = Math.round(bossTime * 10) / 10;
      if (lasted > best) {
        best = lasted;
        newBest = true;
        api.saveBest(lasted);
      }
    } else {
      mode = "dead";
    }
    api.sfx.gameOver();
  }

  function update(dt) {
    since += dt;
    pops.forEach((p) => {
      p.life -= dt;
    });
    pops = pops.filter((p) => p.life > 0);
    messages.forEach((m) => {
      m.life -= dt;
    });
    messages = messages.filter((m) => m.life > 0);
    hurt = Math.max(0, hurt - dt * 2);
    hurtSound -= dt;
    flash = Math.max(0, flash - dt);
    banner = Math.max(0, banner - dt);
    grin = Math.max(0, grin - dt);
    clock += dt;

    if (mode === "title") {
      player.a += dt * 0.25;
      return;
    }
    if (mode !== "play") return;

    // Moving and turning.
    const turn = 2.4 * dt;
    if (held.left) player.a -= turn;
    if (held.right) player.a += turn;
    const fx = Math.cos(player.a);
    const fy = Math.sin(player.a);
    let mx = 0;
    let my = 0;
    if (held.up) {
      mx += fx;
      my += fy;
    }
    if (held.down) {
      mx -= fx;
      my -= fy;
    }
    if (held.strafeLeft) {
      mx += fy;
      my -= fx;
    }
    if (held.strafeRight) {
      mx -= fy;
      my += fx;
    }
    const length = Math.hypot(mx, my);
    if (length > 0) {
      walk += dt;
      tryMove(player, (mx / length) * 3 * dt, (my / length) * 3 * dt, RADIUS);
    }

    // The EXIT door opens when you walk up to it (until it seals behind you).
    if (!sealed) {
      const near = Math.hypot(player.x - (DOOR.x + 0.5), player.y - (DOOR.y + 0.5)) < 1.7;
      const inside = Math.floor(player.x) === DOOR.x && Math.floor(player.y) === DOOR.y;
      if (near && grid[DOOR.y][DOOR.x] === "D") {
        grid[DOOR.y][DOOR.x] = "d";
        api.sfx.door();
      } else if (!near && !inside && grid[DOOR.y][DOOR.x] === "d") {
        grid[DOOR.y][DOOR.x] = "D";
      }
    }
    if (!bossMode && player.y > 13.4) enterOffice();

    cooldown = Math.max(0, cooldown - dt);
    if (held.fire && cooldown === 0) fire();

    // Bugs chase you when they can see you (gradients go through walls).
    bugs.forEach((bug) => {
      if (!bug.alive || bossMode) return;
      const d = Math.hypot(player.x - bug.x, player.y - bug.y);
      if (d < 9 && d > 0.5 && (bug.kind === "vanish" || sees(bug.x, bug.y, player.x, player.y))) {
        const step = BUG_SPEED[bug.kind] * dt;
        const ux = ((player.x - bug.x) / d) * step;
        const uy = ((player.y - bug.y) / d) * step;
        if (bug.kind === "vanish") {
          bug.x += ux;
          bug.y += uy;
        } else {
          tryMove(bug, ux, uy, 0.25);
        }
      }
      if (d < 0.6 && !god) damage(10 * dt, false);
    });

    cups.forEach((cup) => {
      if (!cup.taken && Math.hypot(player.x - cup.x, player.y - cup.y) < 0.5) {
        cup.taken = true;
        novelty = Math.min(MAX_NOVELTY, novelty + 25);
        grin = 1.2;
        say("PICKED UP A COFFEE. +25% NOVELTY.", "#8bff5c");
        api.sfx.pickup();
      }
    });

    ideas.forEach((idea) => {
      idea.x += idea.dx * dt;
      idea.y += idea.dy * dt;
      idea.life -= dt;
      if (solid(at(idea.x, idea.y))) {
        idea.life = 0;
        if (idea.reply) asking = false;
        pops.push({ x: idea.x - idea.dx * 0.03, y: idea.y - idea.dy * 0.03, life: 0.25 });
        return;
      }
      const hit = bugs.find((bug) => bug.alive && Math.hypot(idea.x - bug.x, idea.y - bug.y) < 0.45);
      if (hit) {
        idea.life = 0;
        hit.hp -= 1;
        pops.push({ x: hit.x, y: hit.y, life: 0.25 });
        if (hit.hp <= 0) {
          hit.alive = false;
          fixed += 1;
          pops.push({ x: hit.x, y: hit.y, life: 0.5, big: true });
          say(BUG_FIXED[hit.kind]);
          grin = 0.8;
          api.sfx.eat();
          if (fixed === BUGS.length) say("ALL BUGS FIXED! NOW FIND THE EXIT.", "#8bff5c");
        }
        return;
      }
      // The Pioneer catches every idea, and names the prior art.
      if (bossMode && Math.hypot(idea.x - boss.x, idea.y - boss.y) < 0.8) {
        idea.life = 0;
        pops.push({ x: idea.x, y: idea.y, life: 0.4 });
        api.sfx.caught();
        if (idea.reply) {
          idea.answered = true;
          asking = false;
          speaking = 1.8;
          say(`THE PIONEER: “${idea.reply}”`, "#ffd23f");
          throwPaper(5);
        }
      } else if (idea.life <= 0 && idea.reply) {
        asking = false;
      }
    });
    ideas = ideas.filter((idea) => idea.life > 0);

    // Prior art finds you anywhere (it goes through walls).
    papers.forEach((paper) => {
      const d = Math.hypot(player.x - paper.x, player.y - paper.y) || 1;
      paper.dx += ((player.x - paper.x) / d) * 3 * dt;
      paper.dy += ((player.y - paper.y) / d) * 3 * dt;
      const speed = Math.hypot(paper.dx, paper.dy) || 1;
      paper.dx = (paper.dx / speed) * 4.2;
      paper.dy = (paper.dy / speed) * 4.2;
      paper.x += paper.dx * dt;
      paper.y += paper.dy * dt;
      paper.life -= dt;
      if (d < 0.45) {
        paper.life = 0;
        damage(paper.cost, true);
      }
    });
    papers = papers.filter((paper) => paper.life > 0);

    if (bossMode) {
      bossTime += dt;
      boss.t += dt;
      boss.x = 12.5 + Math.sin(boss.t * 0.7) * 3;
      speaking -= dt;
      novelty -= 1 * dt; // being reviewed by a legend is exhausting
      boss.throwIn -= dt;
      if (boss.throwIn <= 0) {
        boss.throwIn = 3.5;
        throwPaper(4);
      }
    }

    if (novelty <= 0) lose();
  }

  // Rendering ---------------------------------------------------------------------------

  function castWalls() {
    const office = player.y > 12.5;
    g.fillStyle = gradient(office ? "office" : "lab", 0);
    g.fillRect(0, 0, RW, RH / 2);
    g.fillStyle = gradient(office ? "office" : "lab", 1);
    g.fillRect(0, RH / 2, RW, RH / 2);

    const dirX = Math.cos(player.a);
    const dirY = Math.sin(player.a);
    const planeX = -dirY * 0.66;
    const planeY = dirX * 0.66;
    for (let x = 0; x < RW; x += 1) {
      const camera = (2 * x) / RW - 1;
      const rayX = dirX + planeX * camera;
      const rayY = dirY + planeY * camera;
      let mapX = Math.floor(player.x);
      let mapY = Math.floor(player.y);
      const deltaX = Math.abs(1 / rayX);
      const deltaY = Math.abs(1 / rayY);
      const stepX = rayX < 0 ? -1 : 1;
      const stepY = rayY < 0 ? -1 : 1;
      let sideX = (rayX < 0 ? player.x - mapX : mapX + 1 - player.x) * deltaX;
      let sideY = (rayY < 0 ? player.y - mapY : mapY + 1 - player.y) * deltaY;
      let side = 0;
      let cell = "#";
      for (let i = 0; i < 64; i += 1) {
        if (sideX < sideY) {
          sideX += deltaX;
          mapX += stepX;
          side = 0;
        } else {
          sideY += deltaY;
          mapY += stepY;
          side = 1;
        }
        cell = at(mapX, mapY);
        if (solid(cell)) break;
      }
      const dist = Math.max(0.0001, side === 0 ? sideX - deltaX : sideY - deltaY);
      depth[x] = dist;
      const height = RH / dist;
      const top = (RH - height) / 2;
      let wallX = side === 0 ? player.y + dist * rayY : player.x + dist * rayX;
      wallX -= Math.floor(wallX);
      let texX = Math.floor(wallX * TEX);
      if ((side === 0 && rayX < 0) || (side === 1 && rayY > 0)) texX = TEX - texX - 1;
      g.drawImage(textures[cell] || textures["#"], texX, 0, 1, TEX, x, top, 1, height);
      g.fillStyle = `rgba(0, 0, 0, ${Math.min(0.85, dist / 14 + (side ? 0.18 : 0))})`;
      g.fillRect(x, top, 1, height);
    }
  }

  function drawSprites() {
    const dirX = Math.cos(player.a);
    const dirY = Math.sin(player.a);
    const planeX = -dirY * 0.66;
    const planeY = dirX * 0.66;
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    const list = [];
    bugs.forEach((bug) => {
      if (bug.alive) list.push({ x: bug.x, y: bug.y, img: sprites[bug.kind], h: 0.5, lift: bug.kind === "vanish" ? 0.25 : 0 });
    });
    cups.forEach((cup) => {
      if (!cup.taken) list.push({ x: cup.x, y: cup.y, img: sprites.coffee, h: 0.22, lift: 0 });
    });
    if (bossMode || player.y > 12) {
      list.push({ x: boss.x, y: boss.y, img: sprites.pioneer, h: 1.15, lift: 0.08 + Math.sin(boss.t * 2) * 0.05 });
    }
    ideas.forEach((idea) => list.push({ x: idea.x, y: idea.y, img: sprites.idea, h: 0.16, lift: 0.42 }));
    papers.forEach((paper) => list.push({ x: paper.x, y: paper.y, img: sprites.paper, h: 0.2, lift: 0.4 }));
    pops.forEach((p) => list.push({ x: p.x, y: p.y, img: sprites.pop, h: p.big ? 0.5 : 0.25, lift: 0.3, alpha: clamp(p.life * 3, 0, 1) }));

    list.forEach((s) => {
      s.d = (s.x - player.x) ** 2 + (s.y - player.y) ** 2;
    });
    list.sort((a, b) => b.d - a.d);
    list.forEach((s) => {
      const sx = s.x - player.x;
      const sy = s.y - player.y;
      const tx = invDet * (dirY * sx - dirX * sy);
      const ty = invDet * (-planeY * sx + planeX * sy);
      if (ty <= 0.15) return;
      const screenX = (RW / 2) * (1 + tx / ty);
      const unit = RH / ty;
      const tall = unit * s.h;
      const wide = tall * (s.img.width / s.img.height);
      const bottom = RH / 2 + unit / 2 - unit * s.lift;
      const left = screenX - wide / 2;
      g.globalAlpha = s.alpha === undefined ? 1 : s.alpha;
      for (let x = Math.max(0, Math.floor(left)); x <= Math.min(RW - 1, Math.floor(left + wide)); x += 1) {
        if (ty >= depth[x]) continue;
        const texX = Math.floor(((x - left) / wide) * s.img.width);
        g.drawImage(s.img, clamp(texX, 0, s.img.width - 1), 0, 1, s.img.height, x, bottom - tall, 1, tall);
      }
      g.globalAlpha = 1;
    });
  }

  function drawGun() {
    const moving = mode === "play" && (held.up || held.down || held.strafeLeft || held.strafeRight);
    const bob = moving ? Math.sin(walk * 10) * 2 : 0;
    const x = Math.round(RW / 2 - 18 + bob);
    const y = Math.round(RH - 32 + (cooldown > 0.2 ? 3 : 0) + Math.abs(bob));
    g.fillStyle = "#3a3f4a";
    g.fillRect(x + 13, y + 4, 10, 22);
    g.fillStyle = "#5a6070";
    g.fillRect(x + 4, y + 16, 28, 18);
    g.fillStyle = "#ff7a00";
    g.fillRect(x + 4, y + 22, 28, 3);
    g.fillStyle = "#f2c29b";
    g.fillRect(x + 23, y + 27, 10, 8);
    const glow = flash > 0 ? 9 : 5;
    g.fillStyle = flash > 0 ? "#fffbe0" : "#ffe14b";
    g.beginPath();
    g.arc(x + 18, y + 3, glow, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#9aa3b2";
    g.fillRect(x + 15, y + 6, 6, 3);
  }

  function drawHud(ctx) {
    const y = VIEW_H;
    const metal = ctx.createLinearGradient(0, y, 0, H);
    metal.addColorStop(0, "#6e6e6e");
    metal.addColorStop(1, "#393939");
    ctx.fillStyle = metal;
    ctx.fillRect(0, y, W, H - y);
    ctx.fillStyle = "#9a9a9a";
    ctx.fillRect(0, y, W, 2);
    const panels = [[6, 104], [116, 90], [212, 56], [274, 90], [370, 104]];
    panels.forEach(([x, w]) => {
      ctx.fillStyle = "#1c1c1c";
      ctx.fillRect(x, y + 5, w, 38);
    });
    const digits = (value, x) => label(ctx, value, x, y + 20, { size: 22, font: IMPACT, weight: "normal", color: "#ff3b30", align: "center", shadow: "#4a0000" });
    const small = (value, x) => label(ctx, value, x, y + 37, { size: 9, color: "#bbbbbb", align: "center", shadow: null });
    digits(`${Math.max(0, Math.ceil(novelty))}%`, 58);
    small("NOVELTY", 58);
    digits(`${fixed}/${BUGS.length}`, 161);
    small("BUGS FIXED", 161);
    digits("∞", 319);
    small("IDEAS", 319);
    digits(bossMode ? "BOSS" : "E1M1", 422);
    small(bossMode ? "THE PIONEER" : "LOSS LANDSCAPE", 422);
    let mood = "ok";
    if (mode === "scooped" || mode === "dead") mood = "out";
    else if (grin > 0) mood = "grin";
    else if (novelty > 120) mood = "happy";
    else if (novelty < 60) mood = "worried";
    drawFace(ctx, 220, y + 6, { mood, look: [0, -1, 0, 1][Math.floor(clock / 1.3) % 4], hurt: hurt > 0.5 });
  }

  function render(ctx, { preview = false } = {}) {
    castWalls();
    drawSprites();
    if (mode !== "title" || preview) drawGun();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(view, 0, 0, W, VIEW_H);
    ctx.imageSmoothingEnabled = true;
    if (hurt > 0) {
      ctx.fillStyle = `rgba(255, 0, 0, ${hurt * 0.3})`;
      ctx.fillRect(0, 0, W, VIEW_H);
    }
    drawHud(ctx);
    if (preview) return;

    if (mode === "play") {
      ctx.fillStyle = "#fff35c";
      ctx.fillRect(236, 135, 9, 2);
      ctx.fillRect(240, 131, 2, 9);
    }
    if (bossMode && mode === "play") {
      label(ctx, "THE PIONEER", W / 2, 14, { size: 14, font: IMPACT, weight: "normal", color: "#ffd23f", align: "center" });
      ctx.fillStyle = "#000";
      ctx.fillRect(W / 2 - 101, 25, 202, 9);
      ctx.fillStyle = "#ffd23f";
      ctx.fillRect(W / 2 - 100, 26, 200, 7);
      label(ctx, "INVINCIBLE", W / 2, 42, { size: 9, color: "#ffd23f", align: "center" });
    }
    // Oldest first, like a conversation.
    [...messages].reverse().forEach((message, i) => {
      label(ctx, message.text, 8, (bossMode ? 58 : 14) + i * 16, { size: 12, color: message.color });
    });
    if (banner > 0 && mode === "play") {
      ctx.globalAlpha = clamp(banner, 0, 1);
      label(ctx, "THE PIONEER", W / 2, 118, { size: 40, font: IMPACT, weight: "normal", color: "#ffd23f", align: "center", shadow: "#7a4a00" });
      label(ctx, "has joined the review", W / 2, 152, { size: 15, align: "center" });
      ctx.globalAlpha = 1;
    }

    if (mode === "title") {
      overlay(ctx, "LOSS LANDSCAPE 3D", [
        "a first-person debugger",
        "WASD / arrows to move · SPACE or click to fire ideas",
        "click, tap or press SPACE to start",
      ]);
    }
    if (mode === "dead") {
      overlay(ctx, "OUT OF NOVELTY", [
        "the bugs got you before the deadline",
        `bugs fixed: ${fixed}/${BUGS.length}`,
        since > 0.6 ? "click, tap or press SPACE to try again" : "",
      ]);
    }
    if (mode === "scooped") {
      overlay(ctx, "SCOOPED!", [
        "every idea you tried was already published",
        newBest ? `you lasted ${lasted} s · ★ NEW BEST ★` : `you lasted ${lasted} s (best: ${best} s)`,
        "a friendly tribute to a true pioneer:",
        "some ideas really did come first.",
        since > 0.6 ? "click, tap or press SPACE to try again" : "",
      ], { glow: "#7a4a00", color: "#ffd23f" });
    }
  }

  const canRestart = () => mode === "title" || (mode !== "play" && since > 0.6);

  reset();

  return {
    update,
    render,
    pointerdown() {
      if (mode !== "play") {
        if (canRestart()) start();
      } else if (cooldown === 0) {
        fire();
      }
    },
    pointerup(point) {
      if (point === null) held = {};
    },
    key(event, down) {
      if (down && event.key.length === 1) {
        typed = (typed + event.key.toLowerCase()).slice(-8);
        if (mode === "play") cheat();
      }
      const name = KEYS[event.key];
      if (!name) return false;
      if (mode !== "play") {
        if (down && name === "fire" && canRestart()) start();
        return true;
      }
      held[name] = down;
      return true;
    },
    pad(name, down) {
      if (mode !== "play") {
        if (down && canRestart()) start();
        return;
      }
      held[name] = down;
    },
  };
}
