# BoltBlocks

A kid-friendly block-coding playground (ages 7–14) in the spirit of the Scratch/PictoBlox workspace,
with **100% original** branding, icons, mascot (**Bolt**, a small robot) and six built-in characters.
Static site: plain HTML + CSS + vanilla JavaScript. No backend, no build step, no npm.

## Features

- Blockly "zelos" rounded blocks in 10 colour-coded categories: Events, Motion, Looks, Sound, Pen,
  Control, Sensing, Operators, Variables, My Blocks (kids can define their own blocks).
- Stage (480×360) with Green Flag, Pause, Stop and a slow-motion toggle; speech/thought bubbles,
  smooth glide, pen drawing, variable monitors, Web Audio beeps and notes (no sound files).
- The running block glows. Scripts run in parallel per sprite; Stop is instant and loops never freeze the page.
- Six original characters (Bolt, Zip, Mimi, Sunny, Finn, Pico), several sprites per project, scripts per sprite.
- 8 starter lessons with Bolt's step-by-step hints, a starter workspace, an automatic check and a celebration.
- English and Arabic (full RTL), light and dark mode, touch-friendly with an on-screen arrow pad.
- Autosave (localStorage), named Save/Load, and Download/Upload `.json` projects.
- Accessible: keyboard-operable, visible focus, reduced-motion and colour-scheme aware.

Design decisions are recorded in [`docs/decisions/`](docs/decisions/). Notable ones: block text is dark ink
rather than white because white fails WCAG contrast on the specified colours (ADR 0006); a Pen category,
Pause, slow-motion and arrow pad were added (ADR 0005); programs run as generator functions rather than
via a JS interpreter (ADR 0003).

## Run it locally

BoltBlocks needs an internet connection (Blockly and the fonts load from CDNs).

- **Quick look:** double-click `index.html`. The editor works; the *Lessons* list needs a web server
  (browsers block `fetch` of local files) and will tell you so.
- **Everything:** from this folder run `npx serve` (or `python3 -m http.server 8000`) and open the URL it prints.

## Deploy to GitHub Pages

1. Create a GitHub repository and push this folder's contents so `index.html` is at the repository root.
2. On GitHub open **Settings → Pages**.
3. Under **Build and deployment → Source** choose **Deploy from a branch**.
4. Choose branch **main** and folder **/ (root)**, then **Save**.
5. Wait a minute; the site appears at `https://<user>.github.io/<repo>/`. All paths are relative, so a
   project site works without changes.
6. Before announcing it, replace the `TODO(content):` placeholders in `index.html`, `sitemap.xml` and
   `robots.txt` with your real URL.

## Project layout

```
index.html            page shell (semantic HTML + inline icon sprite)
css/style.css         all styling, light/dark/RTL tokens
js/blocks.js          block definitions, toolbox, theme, block-text translations (en/ar)
js/generators.js      block -> runnable code
js/runtime.js         stage, sprites, scheduler, pen, audio
js/app.js             UI, save/load, lessons, UI-text translations (en/ar)
lessons/lessons.json  the lessons
assets/               original SVG icons, Bolt, logo, sprites
robots.txt, sitemap.xml   crawl files (fill in the TODO(content) origin before launch)
tests/run.mjs         optional browser test suite (needs Playwright; not needed to run the site)
docs/                 architecture, design, perf (+ perf-lab/), SEO, QA, i18n-keys, decisions
```

## Optional: run the tests

The site itself needs no tooling. To run the browser checks (layout, keyboard, CSP, upload fuzzing) you need
Node and a global Playwright install, then `NODE_PATH=<your global node_modules> node tests/run.mjs`.
Results and known gaps are in [`docs/qa.md`](docs/qa.md); performance numbers are in [`docs/perf.md`](docs/perf.md).

## Teachers: add a block

Each file's header has the exact steps. In short: (1) define the block in `js/blocks.js`, (2) add it to
`toolbox()`, (3) add a generator in `js/generators.js` and, if it needs a new action, a function in
`js/runtime.js`, (4) add English and Arabic text to `BB.blocks.MSG`, (5) add the type to the whitelist
(`CUSTOM_TYPES`). Generators must only emit `JSON.stringify`'d strings and `Number()`-coerced numbers —
never raw field text (ADR 0003).

## Teachers: add a lesson

Add an object to `lessons/lessons.json`, with `id`, `title`, `goal`, `steps`, `hints`, `success` (each
`{ "en": "…", "ar": "…" }`), a `starter` (a project in the save-file format, see `docs/architecture.md` §4)
and a `check`. Checks combine with `all` / `any`:

| `type` | Passes when |
|---|---|
| `prop` | a sprite property compares as asked, e.g. `{"type":"prop","sprite":"first","prop":"x","op":">","value":200}` |
| `said` | a sprite said text containing `contains` |
| `variable` | a variable compares as asked |
| `penSegments` | at least `min` pen line segments were drawn |
| `keyPressed` | the key was pressed on the stage |
| `blockUsed` | the block type is in the workspace |
| `messageBroadcast` | the message was broadcast |

Generate the `starter` XML with a small script so quotes are escaped correctly, then check that it loads.

## Privacy and security

No accounts, no tracking, no cookies; projects stay in the browser (localStorage) or in files the user downloads.
Uploaded projects are validated against a block whitelist before they touch the editor. The page needs
`unsafe-eval` in any Content-Security-Policy because blocks are compiled to JavaScript (ADR 0003).

## Credits and licences

Built with [Blockly](https://developers.google.com/blockly) (Apache-2.0), loaded from jsDelivr at a pinned
version. Fonts: Nunito and Cairo (SIL OFL) via Google Fonts. BoltBlocks is not affiliated with Scratch,
PictoBlox, or Google. All art is original to this project.
