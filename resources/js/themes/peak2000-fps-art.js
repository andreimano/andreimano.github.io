// Art for Loss Landscape 3D: wall textures, sprites and the status-bar face,
// all painted with code (no image files).

import { pick, rand } from "./peak2000-canvas.js";

export const TEX = 64;

export function canvasOf(width, height, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d"));
  return canvas;
}

function speckle(g, count, colors) {
  for (let i = 0; i < count; i += 1) {
    g.fillStyle = pick(colors);
    g.fillRect(Math.floor(Math.random() * TEX), Math.floor(Math.random() * TEX), 1, 1);
  }
}

export const TEXTURES = {
  "#"(g) {
    g.fillStyle = "#6f737a";
    g.fillRect(0, 0, TEX, TEX);
    speckle(g, 260, ["#62666d", "#7b8088", "#5a5e65"]);
    g.fillStyle = "#4a4d53";
    for (let y = 0; y < TEX; y += 16) {
      g.fillRect(0, y, TEX, 2);
      for (let x = (y / 16) % 2 ? 0 : 16; x < TEX; x += 32) g.fillRect(x, y, 2, 16);
    }
  },
  S(g) {
    g.fillStyle = "#15181f";
    g.fillRect(0, 0, TEX, TEX);
    g.fillStyle = "#2a2f3a";
    g.fillRect(2, 0, 2, TEX);
    g.fillRect(60, 0, 2, TEX);
    for (let y = 3; y < TEX; y += 15) {
      g.fillStyle = "#262b35";
      g.fillRect(6, y, 52, 12);
      g.fillStyle = "#0c0e12";
      for (let x = 9; x < 38; x += 3) g.fillRect(x, y + 3, 2, 6);
      [["#3dff5c", 42], ["#3dff5c", 46], ["#ffb000", 50], [Math.random() < 0.4 ? "#ff3b30" : "#3dff5c", 54]].forEach(([color, x]) => {
        g.fillStyle = color;
        g.fillRect(x, y + 3, 2, 2);
      });
      g.fillStyle = "#9aa3b2";
      g.fillRect(42, y + 8, 14, 1);
    }
  },
  W(g) {
    TEXTURES["#"](g);
    g.fillStyle = "#b9bec6";
    g.fillRect(4, 8, 56, 44);
    g.fillStyle = "#f4f6f8";
    g.fillRect(6, 10, 52, 40);
    g.font = "bold 10px sans-serif";
    g.fillStyle = "#1d4ed8";
    g.fillText("∇L(θ)", 9, 22);
    g.fillStyle = "#d62828";
    g.fillText("argmin", 9, 36);
    g.strokeStyle = "#1d4ed8";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(36, 16);
    g.quadraticCurveTo(40, 44, 55, 44);
    g.stroke();
    g.fillStyle = "#8a8f98";
    g.fillRect(8, 52, 48, 3);
  },
  Q(g) {
    TEXTURES["#"](g);
    g.fillStyle = "#fdfdfd";
    g.fillRect(12, 6, 40, 50);
    g.fillStyle = pick(["#ff2bd6", "#2b59c3", "#1a9d49"]);
    g.fillRect(12, 6, 40, 8);
    g.fillStyle = "#444";
    for (let y = 18; y < 30; y += 3) g.fillRect(15, y, 34, 1);
    [[16, 12], [23, 18], [30, 9], [37, 22], [44, 15]].forEach(([x, h]) => {
      g.fillStyle = "#2b59c3";
      g.fillRect(x, 52 - h, 5, h);
    });
  },
  C(g) {
    g.fillStyle = "#6b4423";
    g.fillRect(0, 0, TEX, TEX);
    g.fillStyle = "#1f3b2c";
    g.fillRect(3, 6, 58, 48);
    speckle(g, 80, ["#28493a", "#1a3226"]);
    g.fillStyle = "rgba(255, 255, 255, 0.9)";
    g.font = "bold 17px sans-serif";
    g.fillText("1991", 12, 30);
    g.font = "8px sans-serif";
    g.fillStyle = "rgba(255, 255, 255, 0.7)";
    g.fillText("LSTM  PM  FWP", 7, 46);
    g.fillStyle = "#8a5a33";
    g.fillRect(3, 54, 58, 4);
    g.fillStyle = "#ffffff";
    g.fillRect(40, 53, 6, 2);
  },
  P(g) {
    g.fillStyle = "#ddd8cb";
    g.fillRect(0, 0, TEX, TEX);
    g.strokeStyle = "rgba(120, 110, 95, 0.5)";
    g.lineWidth = 1;
    for (let i = 0; i < 5; i += 1) {
      let x = Math.random() * TEX;
      g.beginPath();
      g.moveTo(x, 0);
      for (let y = 0; y <= TEX; y += 8) {
        x += rand(-6, 6);
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.fillStyle = "#c9a227";
    g.fillRect(0, 0, TEX, 5);
    g.fillRect(0, TEX - 5, TEX, 5);
  },
  D(g) {
    g.fillStyle = "#7d828b";
    g.fillRect(0, 0, TEX, TEX);
    g.fillStyle = "#6a6f78";
    g.fillRect(6, 16, 22, 40);
    g.fillRect(36, 16, 22, 40);
    g.fillStyle = "#c21f1f";
    g.fillRect(16, 3, 32, 10);
    g.fillStyle = "#ffffff";
    g.font = "bold 8px sans-serif";
    g.fillText("EXIT", 23, 11);
    g.fillStyle = "#f2c200";
    for (let x = -8; x < TEX; x += 8) {
      g.beginPath();
      g.moveTo(x, 64);
      g.lineTo(x + 4, 57);
      g.lineTo(x + 8, 57);
      g.lineTo(x + 4, 64);
      g.fill();
    }
  },
};

export function bugSprite(kind) {
  return canvasOf(64, 64, (g) => {
    const [body, dark] = { nan: ["#9b4dff", "#6a1fd0"], oom: ["#ff4b3e", "#b3140a"], vanish: ["rgba(205, 245, 255, 0.78)", "#2b6f8a"] }[kind];
    if (kind === "vanish") {
      g.fillStyle = body;
      g.beginPath();
      g.arc(32, 28, 20, Math.PI, 0);
      g.lineTo(52, 58);
      for (let x = 52; x > 12; x -= 10) g.quadraticCurveTo(x - 5, 48, x - 10, 58);
      g.closePath();
      g.fill();
    } else {
      g.fillStyle = dark;
      [[14, 50], [22, 54], [40, 54], [48, 50]].forEach(([x, y]) => g.fillRect(x, y, 3, 8));
      g.fillStyle = body;
      g.beginPath();
      g.ellipse(32, 40, 24, 18, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = dark;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(24, 25);
      g.lineTo(17, 10);
      g.moveTo(40, 25);
      g.lineTo(47, 10);
      g.stroke();
    }
    [[24, 33], [40, 33]].forEach(([x, y]) => {
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(x, y, 5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#111111";
      g.beginPath();
      g.arc(x + 1, y + 1, 2.2, 0, Math.PI * 2);
      g.fill();
    });
    g.fillStyle = kind === "vanish" ? dark : "#ffffff";
    g.font = "bold 11px sans-serif";
    g.textAlign = "center";
    g.fillText({ nan: "NaN", oom: "OOM", vanish: "∇≈0" }[kind], 32, 51);
  });
}

// The Pioneer: a friendly, dignified professor mid-keynote (headset mic and
// all), with tousled silver hair, a short grey beard, an open-collar shirt
// under a dark blazer, a golden aura, and the proceedings of 1991.
export function pioneerSprite() {
  return canvasOf(64, 96, (g) => {
    const aura = g.createRadialGradient(32, 52, 6, 32, 52, 46);
    aura.addColorStop(0, "rgba(255, 223, 90, 0.6)");
    aura.addColorStop(1, "rgba(255, 223, 90, 0)");
    g.fillStyle = aura;
    g.fillRect(0, 0, 64, 96);

    // dark blazer over an open-collar white shirt
    g.fillStyle = "#2b2f3a";
    g.beginPath();
    g.moveTo(13, 94);
    g.lineTo(17, 50);
    g.quadraticCurveTo(32, 44, 47, 50);
    g.lineTo(51, 94);
    g.closePath();
    g.fill();
    g.fillStyle = "#3b4150";
    g.beginPath();
    g.moveTo(22, 49);
    g.lineTo(28, 49);
    g.lineTo(27, 68);
    g.closePath();
    g.moveTo(36, 49);
    g.lineTo(42, 49);
    g.lineTo(37, 68);
    g.closePath();
    g.fill();
    g.fillStyle = "#f5f5f2";
    g.beginPath();
    g.moveTo(25, 47);
    g.lineTo(32, 63);
    g.lineTo(39, 47);
    g.closePath();
    g.fill();
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.moveTo(24, 47);
    g.lineTo(29, 47);
    g.lineTo(27, 53);
    g.closePath();
    g.moveTo(35, 47);
    g.lineTo(40, 47);
    g.lineTo(37, 53);
    g.closePath();
    g.fill();

    // neck, a lean face and small ears
    g.fillStyle = "#e2b18c";
    g.fillRect(29, 40, 6, 9);
    g.fillStyle = "#eec39c";
    g.beginPath();
    g.ellipse(32, 30, 9, 11.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e0b08a";
    g.fillRect(22, 27, 2, 5);
    g.fillRect(40, 27, 2, 5);

    // tousled silver hair, swept back from a high forehead, with darker streaks
    g.fillStyle = "#b9b5ae";
    g.beginPath();
    g.ellipse(32, 20.5, 10, 5.5, 0, Math.PI, 0);
    g.fill();
    g.fillRect(22.5, 20, 2.5, 6);
    g.fillRect(39, 20, 2.5, 6);
    g.lineCap = "round";
    [["#cfccc6", 24, 18, 29, 12], ["#b9b5ae", 28, 16, 34, 10], ["#cfccc6", 32, 16, 38, 11], ["#9d978f", 36, 17, 41, 13], ["#9d978f", 26, 17, 30, 13], ["#dedbd6", 30, 15, 35, 12]].forEach(([color, x1, y1, x2, y2]) => {
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
    });
    g.lineCap = "butt";

    // grey brows, light eyes, a nose
    g.fillStyle = "#9d978f";
    g.fillRect(26, 25, 5, 1);
    g.fillRect(33, 25, 5, 1);
    g.fillStyle = "#ffffff";
    g.fillRect(27, 27, 3, 2);
    g.fillRect(34, 27, 3, 2);
    g.fillStyle = "#56789a";
    g.fillRect(28, 27, 2, 2);
    g.fillRect(35, 27, 2, 2);
    g.fillStyle = "#d9a883";
    g.fillRect(31, 28, 2, 5);

    // short grey stubble along the jaw, and a friendly smile
    g.save();
    g.beginPath();
    g.ellipse(32, 30, 9, 11.5, 0, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = "rgba(168, 163, 155, 0.6)";
    g.fillRect(22, 34, 20, 9);
    g.fillRect(22, 29, 2, 5);
    g.fillRect(40, 29, 2, 5);
    g.restore();
    g.fillStyle = "rgba(160, 155, 147, 0.7)";
    g.fillRect(28, 34, 8, 1);
    g.strokeStyle = "#8a4a3a";
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(32, 35, 3, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();

    // the keynote headset mic
    g.strokeStyle = "#c9a27e";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(22.5, 30);
    g.quadraticCurveTo(23, 36.5, 27, 37.5);
    g.stroke();
    g.fillStyle = "#2a2a2a";
    g.fillRect(26.5, 36.5, 2, 2);

    // hands holding the proceedings of 1991
    g.fillStyle = "#6b2d0f";
    g.fillRect(20, 60, 24, 17);
    g.fillStyle = "#f2d16b";
    g.font = "bold 8px sans-serif";
    g.textAlign = "center";
    g.fillText("1991", 32, 72);
    g.fillStyle = "#eec39c";
    g.fillRect(17, 64, 4, 5);
    g.fillRect(43, 64, 4, 5);
  });
}

export const makeSprites = () => ({
  nan: bugSprite("nan"),
  oom: bugSprite("oom"),
  vanish: bugSprite("vanish"),
  pioneer: pioneerSprite(),
  coffee: canvasOf(32, 32, (g) => {
    g.strokeStyle = "rgba(255, 255, 255, 0.7)";
    g.lineWidth = 1.5;
    [10, 16, 22].forEach((x) => {
      g.beginPath();
      g.moveTo(x, 12);
      g.quadraticCurveTo(x + 3, 8, x, 3);
      g.stroke();
    });
    g.fillStyle = "#f4f4f4";
    g.fillRect(6, 14, 18, 16);
    g.strokeStyle = "#f4f4f4";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(25, 21, 4, -Math.PI / 2, Math.PI / 2);
    g.stroke();
    g.fillStyle = "#6b3a1f";
    g.fillRect(7, 14, 16, 3);
    g.fillStyle = "#ff2bd6";
    g.fillRect(9, 21, 12, 2);
  }),
  idea: canvasOf(16, 16, (g) => {
    const glow = g.createRadialGradient(8, 7, 1, 8, 7, 8);
    glow.addColorStop(0, "#fffbe0");
    glow.addColorStop(0.5, "#ffe14b");
    glow.addColorStop(1, "rgba(255, 225, 75, 0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = "#9aa3b2";
    g.fillRect(6, 12, 4, 3);
  }),
  paper: canvasOf(16, 20, (g) => {
    g.fillStyle = "#fdfdf8";
    g.fillRect(1, 1, 14, 18);
    g.fillStyle = "#888888";
    for (let y = 6; y < 17; y += 3) g.fillRect(3, y, 10, 1);
    g.fillStyle = "#c21f1f";
    g.fillRect(3, 2, 7, 2);
  }),
  pop: canvasOf(32, 32, (g) => {
    g.fillStyle = "#fff35c";
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(16, 16);
      g.lineTo(16 + Math.cos(angle - 0.2) * 15, 16 + Math.sin(angle - 0.2) * 15);
      g.lineTo(16 + Math.cos(angle + 0.2) * 15, 16 + Math.sin(angle + 0.2) * 15);
      g.fill();
    }
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(16, 16, 5, 0, Math.PI * 2);
    g.fill();
  }),
});

// A generic cartoon face for the status bar (like the one in the classic
// shooters), whose mood follows your novelty.
export function drawFace(ctx, x, y, { mood = "ok", look = 0, hurt = false } = {}) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, 40, 36);
  ctx.clip();
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(x, y, 40, 36);
  ctx.fillStyle = "#f2c79a";
  ctx.beginPath();
  ctx.ellipse(x + 20, y + 20, 12.5, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3b2a1f";
  ctx.beginPath();
  ctx.ellipse(x + 20, y + 9, 13.5, 7, 0, Math.PI, 0);
  ctx.fill();
  [[8, 10, 12, 3, 14, 11], [13, 8, 18, 2, 20, 9], [19, 8, 25, 3, 26, 9], [25, 9, 31, 5, 32, 12]].forEach(([x1, y1, x2, y2, x3, y3]) => {
    ctx.beginPath();
    ctx.moveTo(x + x1, y + y1);
    ctx.lineTo(x + x2, y + y2);
    ctx.lineTo(x + x3, y + y3);
    ctx.fill();
  });
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 1.3;
  [14, 26].forEach((ex) => {
    ctx.beginPath();
    ctx.arc(x + ex, y + 18, 4.5, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.beginPath();
  ctx.moveTo(x + 18.5, y + 18);
  ctx.lineTo(x + 21.5, y + 18);
  ctx.stroke();
  ctx.fillStyle = "#111111";
  if (mood === "out") {
    [14, 26].forEach((ex) => {
      ctx.beginPath();
      ctx.moveTo(x + ex - 2, y + 16);
      ctx.lineTo(x + ex + 2, y + 20);
      ctx.moveTo(x + ex + 2, y + 16);
      ctx.lineTo(x + ex - 2, y + 20);
      ctx.stroke();
    });
  } else {
    [14, 26].forEach((ex) => ctx.fillRect(x + ex - 1 + look * 1.5, y + 17, 2, 2));
  }
  ctx.strokeStyle = "#7a3b2a";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  if (mood === "grin") {
    ctx.fillStyle = "#ffffff";
    ctx.arc(x + 20, y + 26, 5, 0, Math.PI);
    ctx.fill();
    ctx.stroke();
  } else if (mood === "happy") {
    ctx.arc(x + 20, y + 25, 4, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  } else if (mood === "worried") {
    ctx.arc(x + 20, y + 31, 4, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    ctx.fillStyle = "#5cc8ff";
    ctx.beginPath();
    ctx.arc(x + 33, y + 12, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === "out") {
    ctx.arc(x + 20, y + 28, 2.5, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.moveTo(x + 16, y + 27);
    ctx.lineTo(x + 24, y + 27);
    ctx.stroke();
  }
  if (hurt) {
    ctx.fillStyle = "rgba(255, 0, 0, 0.4)";
    ctx.fillRect(x, y, 40, 36);
  }
  ctx.restore();
}
