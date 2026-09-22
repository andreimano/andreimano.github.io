// "2010s blogspot": the site as a ~2012 Blogger blog. News items become
// posts (date headers, "Posted by", share buttons, labels you can filter by),
// plus a sidebar with the classic gadgets.

import { $, $$, createExtras, h, newsItems } from "./dom.js";

const LABELS = [
  ["ICML", /\bICML\b/],
  ["NeurIPS", /NeurIPS/],
  ["ICLR", /\bICLR\b/],
  ["EMNLP", /\bEMNLP\b/],
  ["NAACL", /\bNAACL\b/],
  ["ICDM", /\bICDM\b/],
  ["workshops", /workshop/i],
  ["summer school", /summer school/i],
  ["reviewing", /review/i],
  ["awards", /award|prize|gold reviewer/i],
  ["grad school", /ph\.d\.|master's degree/i],
];

const SOCIAL = {
  "Google Scholar": "GS",
  GitHub: "GH",
  LinkedIn: "in",
  Twitter: "t",
  CV: "CV",
};

const SITE_URL = "https://andreimano.github.io/";
const pad = (value) => String(value).padStart(2, "0");

const longDate = (date) =>
  date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

// A plausible (and deterministic) posting time for each post.
function postedAt(date, index) {
  const hour = 8 + ((date.getDate() + index * 5) % 11);
  const minute = (date.getDate() * 37 + date.getMonth() * 11 + index * 7) % 60;
  return `${hour > 12 ? hour - 12 : hour}:${pad(minute)} ${hour >= 12 ? "PM" : "AM"}`;
}

export function mount(site) {
  const extras = createExtras();
  const themes = $(".themes");
  const masthead = $(".masthead");
  const main = $("main");
  const list = $("#news-list");
  if (!masthead || !main) return () => extras.cleanup();

  const posts = newsItems().map((post) => ({
    ...post,
    labels: LABELS.filter(([, pattern]) => pattern.test(post.text)).map(([label]) => label),
  }));

  // Navbar extra + page tabs ---------------------------------------------------
  if (themes) {
    themes.append(extras.add(h("button", { type: "button", class: "bs-next", onclick: () => site.stepTheme(1) }, "Next Blog»")));
  }

  masthead.after(
    extras.add(
      h("nav", { class: "bs-tabs", "aria-label": "Pages" },
        h("ul", {},
          [
            ["#top", "Home"],
            ["#about", "About me"],
            ["#publications", "Publications"],
            ["resources/files/Manolache_Andrei_CV.pdf", "CV"],
          ].map(([href, label]) => h("li", {}, h("a", { href }, label))))),
    ),
  );

  // Label filtering ("Showing posts with label …") ------------------------------
  const status = extras.add(h("div", { class: "bs-status", role: "status" }));
  status.hidden = true;
  if (list) list.before(status);

  const showAll = () => {
    posts.forEach(({ item }) => item.classList.remove("bs-hidden"));
    if (list) delete list.dataset.bsFilter;
    status.hidden = true;
    status.replaceChildren();
  };

  const filterBy = (label) => {
    if (site.news) site.news.expand();
    posts.forEach(({ item, labels }) => item.classList.toggle("bs-hidden", !labels.includes(label)));
    if (list) list.dataset.bsFilter = label;
    status.hidden = false;
    status.replaceChildren(
      "Showing posts with label ",
      h("strong", {}, label),
      ". ",
      h("button", { type: "button", class: "bs-link", onclick: showAll }, "Show all posts"),
    );
    status.scrollIntoView({ block: "start" });
  };

  const jumpTo = (post) => {
    showAll();
    if (site.news) site.news.expand();
    post.item.scrollIntoView({ block: "start" });
  };

  // Posts ----------------------------------------------------------------------
  let previousDay = "";
  posts.forEach((post, index) => {
    const day = post.date.toDateString();
    post.item.prepend(
      extras.add(h("h3", { class: `bs-date${day === previousDay ? " bs-same-day" : ""}` }, longDate(post.date))),
    );
    previousDay = day;

    post.item.append(
      extras.add(
        h("div", { class: "bs-post-footer" },
          h("p", {},
            "Posted by ",
            h("a", { href: "#about" }, "Andrei Manolache"),
            ` at ${postedAt(post.date, index)}`,
            h("span", { class: "bs-comments" }, "No comments:")),
          h("p", { class: "bs-share", "aria-hidden": "true" },
            [["email", "✉"], ["blogthis", "B!"], ["twitter", "t"], ["facebook", "f"], ["pinterest", "P"]].map(([name, glyph]) =>
              h("span", { class: `bs-share-${name}` }, glyph))),
          post.labels.length > 0 &&
            h("p", { class: "bs-labels" },
              "Labels: ",
              post.labels.map((label, i) => [
                i ? ", " : "",
                h("button", { type: "button", class: "bs-link", onclick: () => filterBy(label) }, label),
              ])),
        ),
      ),
    );
  });

  if (site.news) site.news.setLabels({ more: "Older Posts", less: "Newer Posts" });

  const newsSection = $("#news .section-body");
  if (newsSection) {
    newsSection.append(
      extras.add(
        h("div", { class: "bs-pager" },
          h("a", { href: "#top" }, "Home"),
          h("p", { class: "bs-feed" }, "Subscribe to: Posts (Atom)")),
      ),
    );
  }

  // Sidebar gadgets ------------------------------------------------------------
  const gadget = (title, ...content) =>
    h("section", { class: "bs-gadget" }, h("h2", { class: "bs-gadget-title" }, title), ...content);

  const portrait = $(".portrait");
  const role = $(".role");
  const photo = portrait ? portrait.currentSrc || portrait.src : "";

  const years = new Map();
  posts.forEach((post) => {
    const year = post.date.getFullYear();
    const month = post.date.toLocaleDateString("en-US", { month: "long" });
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(post);
  });

  const counts = new Map();
  posts.forEach(({ labels }) => labels.forEach((label) => counts.set(label, (counts.get(label) || 0) + 1)));
  const most = Math.max(...counts.values());

  const sidebar = extras.add(
    h("aside", { class: "bs-sidebar", "aria-label": "Blog sidebar" },
      gadget("About Me",
        h("div", { class: "bs-profile" },
          photo && h("div", { class: "bs-photo" }, h("img", { src: photo, alt: "", width: "480", height: "480" })),
          h("p", { class: "bs-profile-name" }, h("a", { href: "#about" }, "Andrei Manolache")),
          role && h("p", {}, role.textContent.replace(/\s+/g, " ").trim()),
          h("p", {}, h("a", { href: "#about" }, "View my complete profile")))),
      gadget("Let's be friends!",
        h("ul", { class: "bs-social" },
          $$(".contact a").map((link) => {
            const label = link.textContent.trim();
            const email = link.href.startsWith("mailto:");
            return h("li", {},
              h("a", { href: link.getAttribute("href"), title: label },
                h("span", { "aria-hidden": "true" }, email ? "✉" : SOCIAL[label] || label.slice(0, 2)),
                h("span", { class: "bs-hidden-label" }, label)));
          }))),
      gadget("Blog Archive",
        h("ul", { class: "bs-archive" },
          [...years].map(([year, months], index) =>
            h("li", {},
              h("details", { open: index === 0 },
                h("summary", {}, `${year} `, h("span", { class: "bs-count" }, `(${[...months.values()].flat().length})`)),
                h("ul", {},
                  [...months].map(([month, items]) =>
                    h("li", {},
                      h("button", { type: "button", class: "bs-link", onclick: () => jumpTo(items[0]) }, month),
                      h("span", { class: "bs-count" }, ` (${items.length})`))))))))),
      gadget("Labels",
        h("p", { class: "bs-cloud" },
          [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([label, count]) =>
            h("button", {
              type: "button",
              class: "bs-link",
              style: { "font-size": `${(0.8 + (count / most) * 0.7).toFixed(2)}em` },
              onclick: () => filterBy(label),
            }, label)))),
      gadget("Grab my button!",
        h("div", { class: "bs-grab" },
          h("div", { class: "bs-button", "aria-hidden": "true" },
            photo && h("img", { src: photo, alt: "" }),
            h("span", {}, "Andrei's blog")),
          h("textarea", { readonly: true, rows: "4", "aria-label": "HTML code for my blog button" },
            `<a href="${SITE_URL}"><img src="${SITE_URL}resources/img/portrait.jpg" width="125" height="125" alt="Andrei Manolache"></a>`))),
    ),
  );
  main.after(sidebar);

  const footer = $(".colophon");
  if (footer) {
    footer.prepend(extras.add(h("p", { class: "bs-powered" }, "Simple theme. Powered by vibe coding.")));
  }

  return () => {
    showAll();
    if (site.news) site.news.setLabels(null);
    extras.cleanup();
  };
}
