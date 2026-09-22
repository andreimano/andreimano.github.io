# andreimano.github.io

Static personal website: plain HTML, CSS, and JavaScript, no build step.
(It was vibe-coded; the footer says so.)

## Structure

- `index.html` - the homepage. All content lives here, in theme-agnostic markup.
- `404.html` - custom not-found page (always uses the default look).
- `resources/css/base.css` - shared plumbing plus the default look (light/dark).
- `resources/css/themes/*.css` - one file per theme, each scoped to `[data-look="…"]`.
- `resources/js/site.js` - theme switching, the collapsible news list, and loading of theme extras.
- `resources/js/themes/*.js` - optional per-theme decorations (widgets, sidebars, sounds…).
  Each exports `mount(site)` and returns a cleanup function; anything it adds is marked `data-extra`.
- `resources/js/themes/peak2000-audio.js` - the synthesized MIDI-style song and sound effects
  (Web Audio, no audio files). Sound is off until a visitor presses play.
- `resources/img/portrait.jpg` - profile photo (480px, metadata stripped).
- `resources/img/favicon.svg` - favicon ("a." in Source Serif; adapts to light/dark).
- `favicon.ico`, `resources/img/apple-touch-icon.png` - PNG-based fallbacks (Safari, iOS home screen).
- `resources/fonts/` - self-hosted fonts and their licenses.
- `resources/files/` - CV, thesis, and other PDFs.

## Themes

| id (`?theme=`)    | label            | what it is                                   |
| ----------------- | ---------------- | -------------------------------------------- |
| `default`         | auto             | default look, follows the system light/dark  |
| `defaultLight`    | light            | default look, light                          |
| `defaultDark`     | dark             | default look, dark                           |
| `solarized`       | solarized        | a terminal session: neofetch, prompts, tmux  |
| `seriousAcademic` | serious academic | a LaTeX article in a PDF viewer              |
| `blog2010`        | 2010s blogspot   | a ~2012 Blogger blog                         |
| `peak2000`        | peak 2000s       | a GeoCities homepage, with optional MIDI     |

The chosen theme is remembered in `localStorage` (`andrei-theme`), and `?theme=<id>` links work.

## Editing content

Add news as a new `<li>` at the top of `#news-list` (keep the `datetime` attribute; themes use it).
Publications go in the matching `.pub-year` block; `venue-long` is optional and only shown by the
serious academic theme.

The email address is deliberately split across `data-mail-user` / `data-mail-host` on the contact
link and assembled into a `mailto:` by `site.js`, so it never appears verbatim in the source.

## Local preview

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
