// Drawing helpers shared by the peak 2000s arcade games. Every game draws on
// a 480×320 logical canvas; the arcade scales it for the screen.

export const W = 480;
export const H = 320;
export const MONO = '"Courier New", Courier, monospace';
export const IMPACT = 'Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Black", sans-serif';

export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const rand = (low, high) => low + Math.random() * (high - low);
export const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function label(ctx, value, x, y, { size = 14, font = MONO, color = "#fff", align = "left", shadow = "#000", weight = "bold" } = {}) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (shadow) {
    ctx.fillStyle = shadow;
    ctx.fillText(value, x + 2, y + 2);
  }
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

export function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function overlay(ctx, title, lines, { tint = "rgba(0, 0, 0, 0.6)", color = "#fff35c", glow = "#ff00cc", ink = "#fff" } = {}) {
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, W, H);
  label(ctx, title, W / 2, H / 2 - 46, { size: 42, font: IMPACT, weight: "normal", color, align: "center", shadow: glow });
  lines.filter(Boolean).forEach((line, i) => {
    label(ctx, line, W / 2, H / 2 + 6 + i * 24, { size: 14, align: "center", color: ink, shadow: "#000" });
  });
}
