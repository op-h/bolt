# BoltBlocks — architecture contract (ATLAS)

Everything in this file is a **contract between agents working in parallel**. Do not rename an id,
type, key or function listed here. You may *add* to it (ids, classes, symbols) — say so in `DONE:`.
Project root: `/home/kali/Desktop/WEB/boltblocks/` (all paths below are relative to it).
Read `../CLAUDE.md` (DoD, house style) and `docs/decisions/0001–0006` first.

## 1. What it is
A static, no-build, vanilla block-coding site for ages 7–14, Scratch/PictoBlox-like workspace, 100%
original branding. Brand: **BoltBlocks**; mascot: **Bolt**, a small friendly robot. Languages: English +
Arabic (RTL). App shell (ADR 0002): JS required, but the HTML shell paints without it.

## 2. Files and owners

| Path | Owner | Notes |
|---|---|---|
| `index.html` | GRANITE | Body + head skeleton. Head has three **marked regions** owned by others (§3). |
| `css/style.css` | PRISM | Single file, `@layer`s. |
| `js/blocks.js` | CIRCUIT-1 | Block defs, toolbox, themes, **block-text i18n (en/ar)**. |
| `js/generators.js` | CIRCUIT-1 | Block → generator-function code, `compile*`. |
| `js/runtime.js` | CIRCUIT-1 | Stage, sprites, scheduler, pen, audio, variables, monitors. |
| `js/app.js` | CIRCUIT-2 | Boot, UI wiring, **UI-text i18n (en/ar)**, save/load, lessons, a11y behaviour. |
| `lessons/lessons.json` | CIRCUIT-2 | 8 lessons, bilingual. |
| `assets/icons.svg`, `assets/bolt.svg`, `assets/logo.svg`, `assets/sprites/*.svg`, `docs/design.md` | MUSE | Source of truth for art. |
| `docs/perf.md` + `<!-- perf -->` head region | QUARTZ | |
| `docs/seo.md`, `robots.txt`, `sitemap.xml`, `<!-- seo -->` head region | BEACON | |
| `tests/*`, `docs/qa.md`, `<!-- sec -->` head region (CSP, SRI, referrer) | SENTRY | |
| `README.md`, `docs/architecture.md`, `docs/decisions/*` | ATLAS | |

Load order in `index.html` (all `defer`, in this order; no module scripts, no inline handlers):
```
https://cdn.jsdelivr.net/npm/blockly@13.3.0/blockly_compressed.js
https://cdn.jsdelivr.net/npm/blockly@13.3.0/blocks_compressed.js
https://cdn.jsdelivr.net/npm/blockly@13.3.0/javascript_compressed.js
js/blocks.js   js/generators.js   js/runtime.js   js/app.js
```
`msg/en.js` / `msg/ar.js` is injected **by `app.js` at boot** (a script element, awaited) according to
the stored language, before any workspace is injected. Blockly 13 API may differ from v11 docs —
**inspect the real files** (a copy of the package is at
`/tmp/claude-1000/-home-kali-Desktop-WEB/aa8ae124-f5c5-4eaa-b163-42c661fe26e3/scratchpad/bl/x/package/`;
`core/`, `*.d.ts` and `msg/` are in there) instead of trusting memory.

Single global namespace `window.BB`: `BB.blocks`, `BB.gen`, `BB.rt`, `BB.app`. Each file starts with
`(function (BB) { 'use strict'; … })(window.BB = window.BB || {});`.

## 3. `index.html` structure and id contract (GRANITE writes it; CIRCUIT-2 binds to it)

Head: charset, viewport (`width=device-width, initial-scale=1`), `<title>BoltBlocks — block coding for kids</title>`,
the inline **boot script** (tiny, sync): reads `localStorage['boltblocks.lang']` ('en'|'ar', default
from `navigator.language`), `localStorage['boltblocks.theme']` ('light'|'dark'; absent → system
`prefers-color-scheme`) and stamps `<html lang dir data-theme>` (try/catch around storage). Then the
three marked regions, empty-but-present:
`<!-- seo:start --><!-- seo:end -->`, `<!-- perf:start --><!-- perf:end -->`, `<!-- sec:start --><!-- sec:end -->`.
Then the Google Fonts link (Nunito + Cairo, `display=swap`), `css/style.css`, and the deferred scripts.

Body, in order. **Ids are fixed**; extra wrappers/classes are GRANITE's call.

* `a.skip-link` → `#blockly-div`.
* One hidden inline `<svg>` sprite sheet containing the **verbatim contents of `assets/icons.svg`** as
  `<symbol>`s, plus the Bolt mascot symbols and `logo-mark` (inline, not external, so `file://` works).
  Icon ids: `i-flag i-stop i-pause i-play i-plus i-minus i-target i-trash i-sun i-moon i-globe i-file
  i-folder i-download i-upload i-new i-save i-book i-eye i-eye-off i-check i-close i-turtle i-rabbit
  i-star i-chevron-down i-chevron-left i-chevron-right i-gamepad i-help i-bulb i-pen i-sprite i-reset`.
  Mascot symbols (viewBox 0 0 200 200): `bolt-happy bolt-think bolt-cheer bolt-wave`. Plus `logo-mark`.
  Icons use `currentColor` + `fill="none" stroke` or solid as MUSE decides; usage is always
  `<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-flag"/></svg>`.
* `header#topbar` (banner): `a#logo` (`logo-mark` + wordmark "BoltBlocks"), `input#project-name`
  (visible label or `aria-label`), File menu — `button#btn-file[aria-haspopup=menu][aria-expanded]` +
  `ul#file-menu-list[role=menu][hidden]` containing `button#mi-new #mi-save #mi-load #mi-download #mi-upload`
  (`role=menuitem`) — `input#upload-input[type=file][accept=".json,application/json"][hidden]`,
  `button#btn-lessons`, `button#btn-theme[aria-pressed]`, `button#btn-lang` (label shows the *other*
  language: "العربية" in EN, "English" in AR, with the matching `lang=` attribute on the label),
  `button#btn-help`.
* `main#app` containing:
  * `section#workspace-panel[aria-label]`: `div#blockly-div` (Blockly injects here, toolbox included),
    and `div#zoom-controls` with `button#btn-zoom-in #btn-zoom-out #btn-zoom-reset`. Trash can is
    Blockly's own (PRISM restyles).
  * `section#stage-panel[aria-label]`:
    * `div#stage-toolbar[role=toolbar]`: `button#btn-flag`, `button#btn-pause[aria-pressed]`,
      `button#btn-stop`, `button#btn-speed[aria-pressed]` (slow-motion), `button#btn-dpad[aria-pressed]`.
    * `div#stage-frame`: `canvas#stage[width=480 height=360][tabindex=0][aria-label]` (+ fixed `aspect-ratio: 4/3`),
      `p#stage-live.sr-only[aria-live=polite]`, `form#ask-form[hidden]` (`label#ask-label[for=ask-input]`,
      `input#ask-input`, `button#ask-submit`), `div#dpad[hidden]` with
      `button[data-key=up|left|down|right|space]`.
    * `section#sprite-info[aria-label]`: `input#sprite-name`, number inputs `#sprite-x #sprite-y #sprite-dir
      #sprite-size`, and `button#sprite-visible[aria-pressed]` (show/hide).
    * `section#sprite-panel[aria-label]`: `ul#sprite-list` (JS fills `li > button.sprite-item`),
      `button#btn-add-sprite`.
  * `aside#lesson-panel[hidden][aria-label]`: `svg` using `#bolt-happy` (swapped by JS to
    `bolt-think`/`bolt-cheer`), `h2#lesson-title`, `p#lesson-goal`, `ol#lesson-steps`,
    `p#lesson-hint-text`, `button#btn-hint-prev`, `button#btn-hint-next`, `button#btn-lesson-reset`,
    `button#btn-lesson-close`, `p#lesson-status[role=status]`.
* `div#toast-region[role=status][aria-live=polite]`; `div#celebration[hidden]` (contains `p#celebration-text`);
  `div#phone-notice[role=note]` (+ `button#btn-dismiss-notice`) — shown by CSS only below 700px wide.
* Native `<dialog>`s (opened with `showModal()`, each with a labelled heading and a close/cancel path):
  `#dlg-welcome` (`button#wl-start #wl-lessons #wl-continue`, Bolt `bolt-wave`), `#dlg-lessons`
  (`ol#lesson-list`), `#dlg-sprites` (`ul#char-list`), `#dlg-load` (`ul#saved-list`, `p#saved-empty`),
  `#dlg-prompt` (`form`, `label#prompt-label[for=prompt-input]`, `input#prompt-input`, `button#prompt-ok`,
  `button#prompt-cancel`, `p#prompt-error`), `#dlg-confirm` (`p#confirm-text`, `button#confirm-ok`,
  `button#confirm-cancel`).
* `noscript` message (EN + AR, Bolt) per ADR 0002. An `#app-boot` skeleton (Bolt + "Loading…") is
  visible until `app.js` adds `html.is-ready`; CSS hides it then.

**i18n in markup:** English text is the default content. Elements carry `data-i18n="key"` (replaces
`textContent`) and/or `data-i18n-attr="aria-label:key;title:key2;placeholder:key3"`. `app.js` owns the
UI string tables (`en`, `ar`) and applies them. GRANITE: use one flat key per string, `area.thing`
(e.g. `top.file`, `stage.flag`); CIRCUIT-2 will `grep` index.html for the keys and provide Arabic.

**State hooks on `<body>` (set by app.js, styled by PRISM):** `is-running`, `is-paused`, `is-slow`,
`has-lesson`, `dpad-on`. Buttons reflect state with `aria-pressed`. Blockly blocks that are executing get
class `bb-running` (via `block.addClass/removeClass`, verify it exists in v13; otherwise tell ATLAS).
Other classes JS creates: `.sprite-item[aria-current=true]` (contains `img.sprite-thumb`, `span.sprite-label`,
and a sibling-less `button.sprite-delete`), `.toast`/`.toast--error`/`.toast--info`, `.char-card`, `.lesson-card[data-done]`,
`.saved-item` (`.saved-open`, `.saved-delete`), `#lesson-steps li[aria-current=step]` / `li[data-done]`,
`.confetti-piece` (inside `#celebration`, `style="--i:N"`; under reduced motion JS adds none).

Cross-cutting: every control ≥ 44×44 CSS px for primary actions (min 24×24 everywhere); visible focus ring
on every theme; dialogs trap focus natively and restore focus to the opener; Esc closes; toasts and the
stage speech `#stage-live` are polite live regions.

## 4. Project data format (save/load, lessons' `starter`)

```jsonc
{
  "app": "boltblocks", "version": 1, "name": "My project", "savedAt": "2026-10-06T12:00:00Z",
  "selectedSpriteId": "sprite1",
  "sprites": [{
    "id": "sprite1", "name": "Bolt", "character": "bolt", "costume": 0,
    "x": 0, "y": 0, "direction": 90, "size": 100, "visible": true, "effect": 0,
    "xml": "<xml xmlns=\"https://developers.google.com/blockly/xml\">…</xml>"   // that sprite's scripts
  }],
  "variables": [{ "name": "score", "value": 0, "visible": false }]               // global to all sprites
}
```
Stage coordinates: x ∈ [−240, 240], y ∈ [−180, 180], origin centre, y up. Direction: degrees, 90 = right,
0 = up, clockwise. Size is a percent of the 80×80 stage-px natural size. The project name field is the
file name when downloading (`<name>.boltblocks.json`). Loader fills defaults for missing fields and
rejects (friendly toast) anything with unknown block types, wrong `app`, or `version` > 1 — **before**
touching the live workspace. localStorage keys: `boltblocks.autosave` (one project), `boltblocks.projects`
(map name→project, for Save/Load), `boltblocks.lang`, `boltblocks.theme`, `boltblocks.welcomeSeen`,
`boltblocks.lessonsDone` (array of ids). Every storage access is try/catch-wrapped; app works without it.

Per-sprite scripts: the Blockly workspace shows **one sprite's** scripts at a time (like Scratch). Switching
sprite: save current XML → `workspace.clear()` → load other XML → ensure every global variable exists
(`createVariable(name)` by name). Variables, messages and the pen layer are global; procedures ("My Blocks")
are per sprite.

## 5. Block catalog (CIRCUIT-1 implements; CIRCUIT-2 and lessons reference these `type`s)

Category keys → colour: events `#FFBF00`, motion `#4C97FF`, looks `#9966FF`, sound `#CF63CF`, pen `#00B4A6`,
control `#FFAB19`, sensing `#5CB1D6`, operators `#59C059`, variables `#FF8C1A`, myblocks `#FF6680`.
Toolbox order = this order. Zelos renderer; thick rounded blocks, **bold ink text `#1B1B3A` (not white — ADR 0006, WCAG)**, hats with curved tops. Block fills are exactly these hexes.
Built-ins are re-skinned through a custom Blockly theme (`block styles`) — no forks.

| Category | `type` | Fields / inputs (names are contract) |
|---|---|---|
| events | `bb_when_flag` (hat) | – |
| | `bb_when_key` (hat) | field `KEY`: `space,up,down,left,right,a…z,0…9,any` |
| | `bb_when_clicked` (hat) | – |
| | `bb_broadcast` | field `MSG` (text, default `message1`) |
| | `bb_when_receive` (hat) | field `MSG` (text, default `message1`) |
| motion | `bb_move` | value `STEPS` |
| | `bb_turn_right`, `bb_turn_left` | value `DEG` |
| | `bb_goto_xy` | values `X`,`Y` |
| | `bb_glide` | values `SECS`,`X`,`Y` |
| | `bb_point_dir` | value `DIR` |
| | `bb_change_x`, `bb_set_x` | value `X` |
| | `bb_change_y`, `bb_set_y` | value `Y` |
| | `bb_bounce_edge` | – ("if on edge, bounce") |
| looks | `bb_say_for` | values `MSG`,`SECS` |
| | `bb_say`, `bb_think` | value `MSG` |
| | `bb_show`, `bb_hide`, `bb_next_costume` | – |
| | `bb_change_size`, `bb_set_size` | value `SIZE` |
| | `bb_switch_costume` | dynamic dropdown `COSTUME` (selected sprite's costume names `costume1`, `costume2`) |
| | `bb_set_effect` | value `EFFECT` (colour/hue shift, 0–200 wraps) |
| sound | `bb_play_beep` | – (non-blocking) |
| | `bb_play_note` | values `NOTE` (MIDI 60 = middle C), `BEATS` (tempo fixed 60 bpm; blocks) |
| pen | `bb_pen_down`, `bb_pen_up`, `bb_pen_clear` | – |
| | `bb_set_pen_color` | field `COLOR` (`field_colour`) |
| control | `bb_wait` | value `SECS` |
| | `controls_repeat_ext` (built-in, `TIMES`), `bb_forever`, `controls_if` (+else via two toolbox variants), `bb_wait_until` (value `COND`), `bb_stop_all` | |
| sensing | `bb_touching` (boolean) | dynamic dropdown `TARGET`: `edge`, `mouse`, then other sprites' names |
| | `bb_key_pressed` (boolean) | field `KEY` (same options as `bb_when_key`) |
| | `bb_mouse_x`, `bb_mouse_y`, `bb_answer`, `bb_timer` (reporters), `bb_reset_timer`, `bb_ask` (value `QUESTION`) | |
| operators | built-ins: `math_arithmetic` (ADD, MINUS, MULTIPLY, DIVIDE flyout variants), `math_random_int`, `logic_compare` (`>` `<` `=` variants), `logic_operation` (AND, OR), `logic_negate`, `text_join`, `text_length`, `math_modulo`, `math_round` | |
| variables | built-in dynamic category (create-variable button, `variables_set`, `math_change`, `variables_get`) via a custom category callback, plus `bb_show_variable`, `bb_hide_variable` (field_variable `VAR`) | create/rename prompts use `#dlg-prompt`, **never `window.prompt`** (the viewer blocks it for kids' tablets) |
| myblocks | built-in `PROCEDURE` dynamic category (`procedures_defnoreturn`/`callnoreturn`) | |

Every numeric value input has a shadow `math_number` with the brief's default (move 10, turn 15, glide 1 s to
0,0, direction 90, size 10/100, wait 1, repeat 10, note 60 for 0.5, random 1–10, …). `say` shadow is text
"Hello!" for `say for`/`say`; `think` "Hmm…".

## 6. Generators ↔ runtime (internal to CIRCUIT-1; documented here so the contract is explicit)

* Code is a `function*` body run as `new Function('rt','S', 'return function*(){' + code + '}')(rt, sprite)`.
* `STATEMENT_PREFIX` = `yield rt.step(%1);\n` (→ block highlight; in slow mode also a delay).
* Every loop body ends with `yield rt.frame();` (one frame ≈ 33 ms, Scratch-like), so nothing can starve the page.
* Blocking statements are `yield* rt.xxx(S, …)` generators (`wait`, `glide`, `say for`, `ask`, `play note`).
* All user text is emitted via `JSON.stringify`, all numbers via `Number()` coercion (ADR 0003).
* `BB.gen.compile(workspace)` and `BB.gen.compileXml(xmlString)` (headless workspace) return
  `{ scripts: [{ hat: {kind:'flag'|'key'|'click'|'receive', arg: string|null}, blockId, run: function*(){} }], error: null | {message, blockId} }`.
* Custom blocks: procedure definitions are hoisted into every script's closure as generator functions;
  calls are `yield* name(...)`.

## 7. Runtime API (`BB.rt`) consumed by `app.js`

```
BB.rt.CHARACTERS = { bolt:{name:'Bolt', costumes:['assets/sprites/bolt-1.svg','assets/sprites/bolt-2.svg']},
                     zip, mimi, sunny, finn, pico }          // same shape; 6 original characters
init(canvas) ; render()
setSprites(arr) ; getSprites() → plain project sprite objects (live x,y,direction,…) ; addSprite(character, name?) → id
removeSprite(id) ; selectSprite(id) ; getSelectedId() ; updateSprite(id, patch)
setScripts(spriteId, compiled) ; clearThreads()
setVariables(list) ; getVariables() ; setMonitorVisible(name, bool)
startFlag() ; stopAll() ; pause() ; resume() ; setSlow(bool) ; isRunning() ; isPaused()
keyDown(key) ; keyUp(key) ; setMouse(x,y) ; pointerDown() ; pointerUp() ; stageClick(x,y)
askHandler = async (question) => string        // app.js shows #ask-form
getStats() → { penSegments, said:[{spriteId,text}], messages:[…], keysPressed:[…], spriteMoved:{id:bool} }
resetStats()
// events (assign a function): onSpriteChange(id), onRunState('idle'|'running'|'paused'),
// onHighlight(spriteId, blockId, on:boolean), onError({spriteId, blockId, kind, message}), onSay(spriteId, text)
```
Hat triggers (key, click, receive) work any time, as in Scratch — not only after the green flag.
Green flag restarts every flag-script of every sprite in parallel; it does **not** move sprites or reset
variables (Scratch semantics; lessons say "set score to 0"). Stop kills all threads, clears bubbles and
sounds, leaves positions. `touching` uses scaled bounding circles; the stage fence keeps ≥ 15 px of a
sprite visible. Canvas draws at devicePixelRatio. Colour effect uses `ctx.filter = hue-rotate()` and degrades
silently where unsupported (Safari) — recorded risk.
Friendly errors: runtime never exposes a raw JS error; `onError.message` is already kid-readable
(i18n via `BB.blocks.t(key)`), `kind` ∈ `loop|recursion|math|unknown`.

## 8. Lessons (`lessons/lessons.json`, CIRCUIT-2)

```jsonc
{ "version": 1, "lessons": [{
  "id": "say-hello",
  "title": {"en": "Say hello", "ar": "…"}, "goal": {"en": "…", "ar": "…"},
  "hints": [{"en": "Drag … ", "ar": "…"}, …],            // step-by-step, spoken by Bolt, ≥ 3 each
  "starter": { /* a partial project, §4 schema; missing fields default */ },
  "check": { /* see below */ },
  "success": {"en": "…", "ar": "…"}
}]}
```
`check` (evaluated every 250 ms while running, and once more after stop): leaf types
`{"type":"prop","sprite":"first|<name>","prop":"x|y|direction|size|visible|costume","op":">|<|>=|<=|==","value":N}`,
`{"type":"said","contains":"hello"}`, `{"type":"variable","name":"score","op":">=","value":3}`,
`{"type":"penSegments","min":4}`, `{"type":"keyPressed","key":"right"}`, `{"type":"blockUsed","block":"controls_repeat_ext"}`
(static look at the workspace XML), `{"type":"messageBroadcast","name":"…"}`; combinators `{"all":[…]}` / `{"any":[…]}`.
On success: confetti + `#celebration`, Bolt `bolt-cheer`, mark done in `boltblocks.lessonsDone`, offer "Next lesson".
Teacher docs for adding a lesson/block go in `README.md` (ATLAS) from the final code.

Lesson order (ids): `say-hello`, `move-robot`, `draw-square`, `keyboard-controls`, `bounce-forever`,
`random-positions`, `score-variable`, `catch-the-star`. The `check` for "Draw a square" uses `penSegments ≥ 4`
**and** `blockUsed controls_repeat_ext`. Lesson 8 (Bolt + `sunny` star) is passed when `score ≥ 3`.

## 9. Art assets (MUSE) — names are contract

* `assets/icons.svg` — one `<svg>` of `<symbol viewBox="0 0 24 24">` with the ids in §3.
* `assets/bolt.svg` — standalone Bolt (square viewBox 0 0 200 200); `assets/logo.svg` — logo mark + wordmark.
* `assets/sprites/<character>-<1|2>.svg` for characters `bolt` (robot), `zip` (rocket), `mimi` (cat-like
  blob), `sunny` (a friendly star — used in lesson 8), `finn` (fish), `pico` (little alien). viewBox
  `0 0 100 100`, centred artwork facing **right**, transparent background, ≤ 3 kB each, no external refs,
  no text. Costume 2 is a visible variant (different pose/expression).
* Nothing may resemble Scratch's cat/PictoBlox's Pictoblox mascot, logos, colours-as-brand, or sounds.

## 10. Wave plan (ATLAS)

1. **Wave 1 (parallel, disjoint files):** MUSE · GRANITE · CIRCUIT-1 · CIRCUIT-2.
2. **Wave 2:** PRISM (needs `docs/design.md`, `index.html`, and real class names from `app.js`).
3. **Wave 3 (parallel):** QUARTZ · BEACON.
4. **Wave 4:** SENTRY gate → owners fix → SENTRY re-run. ATLAS writes `README.md` from the final code.
