// Tiny helpers shared by the theme modules.

// h("a", { href: "#top", class: "button" }, "text", childNode)
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "style" && typeof value === "object") {
      for (const [property, setting] of Object.entries(value)) node.style.setProperty(property, String(setting));
    }
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

// Keeps track of everything a theme adds so it can be undone in one call.
export function createExtras() {
  const nodes = [];
  const listeners = [];
  const timers = [];
  return {
    add(node) {
      node.setAttribute("data-extra", "");
      nodes.push(node);
      return node;
    },
    on(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      listeners.push([target, type, handler, options]);
    },
    every(ms, fn) {
      timers.push(window.setInterval(fn, ms));
    },
    cleanup() {
      listeners.forEach(([target, type, handler, options]) => target.removeEventListener(type, handler, options));
      timers.forEach((id) => window.clearInterval(id));
      nodes.forEach((node) => node.remove());
      nodes.length = 0;
      listeners.length = 0;
      timers.length = 0;
    },
  };
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function newsItems() {
  return $$("#news-list > li").map((item) => {
    const time = $("time", item);
    const text = $("p", item);
    return {
      item,
      date: new Date(`${time.getAttribute("datetime")}T12:00:00`),
      text: text ? text.textContent.replace(/\s+/g, " ").trim() : "",
      time,
      body: text,
    };
  });
}
