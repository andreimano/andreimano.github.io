// "serious academic": LaTeX article in a PDF viewer. The typesetting is CSS;
// this adds the viewer toolbar bits, \today, a figure caption and a page number.

import { $, createExtras, h } from "./dom.js";

export function mount(site) {
  const extras = createExtras();
  const themes = $(".themes");
  const portrait = $(".portrait");
  const contact = $(".contact");
  const page = $(".page");

  if (themes) {
    themes.prepend(
      extras.add(h("span", { class: "la-file" }, "andrei_manolache.pdf")),
      extras.add(h("span", { class: "la-pages", "aria-hidden": "true" }, "1 / 1")),
      extras.add(h("span", { class: "la-zoom", "aria-hidden": "true" }, "100%")),
    );
  }

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  if (contact) contact.after(extras.add(h("p", { class: "la-date" }, today)));
  if (portrait) {
    portrait.after(extras.add(h("p", { class: "la-caption" }, "Figure 1: The author in the wild.")));
  }
  if (page) page.append(extras.add(h("p", { class: "la-page-number", "aria-hidden": "true" }, "1")));

  if (site.news) {
    site.news.setLabels({
      more: `[${site.news.hidden} older items omitted for brevity; see the supplementary material]`,
      less: "[hide the supplementary material]",
    });
  }

  return () => {
    if (site.news) site.news.setLabels(null);
    extras.cleanup();
  };
}
