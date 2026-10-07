# BoltBlocks: QA, security and release gate (SENTRY)

Run: 2026-10-07. Gate 1 said BLOCK (F1 to F4); gate 2 re-gated F1 to F4; this is the FINAL GATE run: every suite ran on the final tree, with no edits after it. Verdict in section 1.
Everything here comes from `tests/run.mjs`; a number in this file without a test id next to it is not a claim.

## 0. How to run

```
cd boltblocks
NODE_PATH=/home/kali/.npm-global/lib/node_modules node tests/run.mjs                 # all suites, Chromium (~5 min)
NODE_PATH=... node tests/run.mjs layout viewports a11y                                 # a subset
NODE_PATH=... node tests/run.mjs xb                                                    # Firefox smoke (+ WebKit, skipped if it cannot start)
NODE_PATH=... node tests/run.mjs --shots=/some/dir --json=/some/file.json              # optional screenshots / machine-readable results
VERBOSE=1 ...                                                                          # also print every PASS
```

* No install, no build: one file, uses the already-installed global Playwright (`@playwright/cli/node_modules/playwright-core`
  is found through `NODE_PATH`), a throwaway static server on 127.0.0.1, `/usr/bin/chromium`. The site itself stays no-build/no-npm.
* Every page pins `prefers-reduced-motion` and `prefers-color-scheme` explicitly (Playwright emulation **and** CDP
  `Emulation.setEmulatedMedia`) and a test asserts the pin took (`media-pinned-reduced-motion-*`). Headless Chromium otherwise
  reports `reduce` and hides reveal bugs.
* Suites: `static` (CSP/SRI/JSON-LD/sitemap/secrets/sinks, no browser) · `unit` (pure logic with pinned input to output pairs:
  `sanitizeXml`, `normalizeProject`, i18n key parity) · `boot` (EN/AR x light/dark x reduce/no-preference) · `layout` (11 widths x 4
  themes/languages, 200 %/400 % zoom, text spacing, dialogs, toast over dialog) · `viewports` (real laptop sizes) · `a11y` ·
  `motion` (+ JS-off) · `flows` (8 lessons solved by loading real block XML, sprites, save/load/download/upload) · `fuzz` · `csp` · `xb`.
* Exit code 1 if any check FAILs. SKIP means "could not run", never "passed".
* **When an inline `<script>` in `index.html` changes, `static/csp-hash-*` fails until the sha256 in the sec region is recomputed**
  (command in section 4). It happened once more when QUARTZ fixed F1 (new perf-script hash, recomputed from the real file).
* The console filter (`KNOWN`) is now empty: any console warning or error, in any browser, fails the suite.

## 1. Gate verdict

**SHIP WITH ADR'd EXCEPTIONS.** Observed on the final tree (PRISM's W10 patch included, nothing edited afterwards), Chromium 150, reduced-motion and colour scheme pinned:
`node tests/run.mjs` (all 10 default suites) = **775 pass, 0 fail, 1 warn, 0 skip** (363 s); `node tests/run.mjs xb` (Firefox 155) = **23 pass, 0 fail, 0 warn, 1 skip** (skip = WebKit cannot launch, NOT TESTED). The one warn is W7 (`static/sitemap-loc`, TODO(content) origin).
Every suite ran on the final tree this time; nothing is carried over from an earlier run. Independent re-check outside the suite: the 2 executable inline scripts match the 2 `sha256-` entries in the CSP (the third inline script is `application/ld+json`, a data block the CSP does not govern), and the perf-script `{en,ar}` integrity map is byte-equal to `MSG_SRI` in `js/app.js` (`sha384-5WVWW8OK...` en, `sha384-dSQN69uP...` ar).
Accepted exceptions (each has an ADR): 0002 app shell (DoD 1), 0003 `unsafe-eval`, 0006 block ink text (min 4.51:1), 0008 stacked visual order below 1024 px (W6); 0007 shell LCP also stands. Manual and NOT TESTED items: section 6 (WebKit/Safari, real devices and DoD 6 on hardware, screen reader, axe-core/Lighthouse, keyboard-only lesson 3, forced-colors).
Nothing in this table is green without a test id.

| DoD | Item | Status | Evidence (test id) |
|---|---|---|---|
| 1 | JS-off content/nav | **PASS under ADR 0002 (app shell)**; the ADR's replacement conditions verified | `nojs-noscript-message-en-ar-{320,1280}`, `nojs-noscript-visible-*`, `nojs-boot-skeleton-hidden-*`; static shell LCP element per perf.md |
| 2 | Keyboard, visible focus in every theme | **PASS** (Chromium; Firefox only smoke) | `focus-ring-3:1-{light,dark}`, `focus-visible-and-unobscured-*`, `menu-*`, `dlg-*-focus-trapped(-reverse)`, `dlg-*-esc-closes-returns-focus`, new `welcome-first-visit-esc-focus-btn-help`, `block-keyboard-focus-stroke-*`, `workspace-block-focus-stroke-*`, `field-focus-stroke-*` |
| 3 | WCAG 2.2 AA | **PASS for what an automated pass can prove; screen reader and axe-core NOT TESTED** | `text-contrast-*` (13 UI states x 4 theme/language cells), `blockly-ink-contrast>=4.5-*` (min 4.51, ADR 0006), `ui-boundary-contrast>=3-*`, `target>=24-*`, `primary-target>=44-*`, `ax-names-*`, `aria-refs-resolve-*`, `no-focusable-in-aria-hidden-*`, `toast-never-fully-hides-focused-control`. Bespoke axe-like checks, **not axe**. |
| 4 | No overflow/clipping 320 to 2560 and at 200 % zoom | **PASS** (Chromium full; Firefox 320/768/1280) | `no-hscroll-*`, `zoom-no-hscroll-*`, `no-clipped-text-*`, `no-midword-wrap-*` (F3), `zoom-no-midword-*`, `viewports/stage-fully-visible-*` x10 sizes (F2), `firefox-no-clipping-{en,ar}-{320,768,1280}`. Screenshots reviewed (section 2). W9 closed on re-measure (steps/hint >= 83 px at 1024x768 and three other sizes, EN+AR). W10 closed after PRISM's `padding-block: 0.2em`: `layout` 312/0, `viewports` 50/0 |
| 5 | Reduced motion, colour scheme | **PASS** | `reduce-css-motion-zeroed`, `reduce-no-confetti`, `stage-animation-runs-reduce`, `no-preference-motion-present` (43 animated elements, so the reduce check is not vacuous), `css-fallback-follows-os-without-data-theme-*`, `boot-stamps-theme-from-os-*`, `theme-toggle-overrides-os-and-persists`, `media-pinned-reduced-motion-*` (pin proven on every boot) |
| 6 | LCP / INP / CLS | **NOT TESTED by SENTRY.** `docs/perf.md` (QUARTZ, lab-throttled, not a real Android): LCP 0.87 to 1.25 s, INP worst 80 ms, whole-session CLS <= 0.0097. Not re-measured after PRISM's CSS patch or my sec-region move | n/a |
| 7 | Zero console errors/rejections, explicit dimensions | **PASS** (Chromium; Firefox boot/lesson) | `zero-console-*` (boot x8, first visit, flows, lessons, fuzz, csp, 10 viewports) with an **empty** filter: 0 errors, 0 warnings, 0 rejections, 0 CSP violations; `firefox-zero-console-*`, `firefox-zero-audiocontext-warnings-*`; `explicit-dimensions-img-canvas-svg`, `dynamic-images-have-dimensions` |
| 8 | No secret in client code | **PASS** | `static/no-secrets` (whole tree incl. docs), `no-dom-sinks-*` |

Decision rule used: a DoD item is PASS only with a passing test id; a failing one is FAIL even if the cause is marginal; an item with no test is NOT TESTED.

## 2. Defects from gate 1: closed, with evidence

| id | Owner | Status | Evidence |
|---|---|---|---|
| F1 preload/SRI console warning | QUARTZ | **CLOSED** | perf script now sets `l.integrity = sri[lang]`; `static/preload-carries-integrity`, new `static/perf-sri-map-equals-MSG_SRI` (the `{en,ar}` map in the perf script equals `MSG_SRI` in `js/app.js`), zero-console on every boot with the filter removed. New inline-script hash `sha256-oBdTaW0GbV2ksfvyejYVeaUrQe1AJ7OCxUxAsUFG0qg=` **recomputed by SENTRY from the real file** (matches QUARTZ's value). |
| F2 stage canvas cropped | PRISM | **CLOSED** | `viewports/stage-fully-visible-*` PASS at all 10 sizes (was 6 failing: 1024x768, 1280x720, 1280x800, 1366x768, 1440x900, 1536x864). Seen in screenshots at 1280x800, 1366x768, 1024x768, 768x1024, 375x740 (EN light, AR dark): full 4:3 stage, sprite at its coordinates, grid visible to the bottom edge. Firefox 1280 `firefox-no-clipping-*` PASS. |
| F3 rail labels break mid-word | PRISM | **CLOSED** | `no-midword-wrap-{en,ar}-{light,dark}-*` all PASS (was 66 failing), `zoom-no-midword-*` PASS. Seen: "Operators", "Variables", "My Blocks" and AR "الاستشعار", "المتغيّرات", "العمليات", "كتلي" on one line each at 1280/1366/1024 (rail now 100 px). |
| F4 lesson dock controls below the fold | PRISM | **CLOSED** | `lesson-nav-visible-without-scrolling-*` PASS at all 10 sizes (was 6 failing), `lesson-open-no-control-obscured`. Seen at 1280x800, 1366x768, 1024x768 (EN) and 1280x800 (AR dark): prev/next/Start again/close always visible at the dock's bottom. **Side effect: W9.** |

## 2b. Open items

### W9 (new, usability, not a DoD failure) lesson text is squeezed when a lesson is open on short screens, owner PRISM

**Confirmation pass (2026-10-07, after PRISM's compact docked layout): W9 is CLOSED for the squeeze; one NEW layout failure (W10) was introduced by the same patch.**
Measured with the Draw-a-square lesson open, Chromium, reduced-motion and colour-scheme pinned (CDP); EN light, AR dark. Cells are visible px / content px.

| viewport | lang | dock | workspace | steps | hint |
|---|---|---|---|---|---|
| 1024x768 | EN | 307 | 348 | 112 / 209 | 106 / 155 |
| 1024x768 | AR | 307 | 343 | 98 / 235 | 92 / 176 |
| 1280x720 | EN | 288 | 318 | 89 / 213 | 83 / 132 |
| 1280x720 | AR | 288 | 314 | 109 / 241 | 103 / 118 |
| 1280x800 | EN | 320 | 366 | 121 / 213 | 115 / 132 |
| 1280x800 | AR | 320 | 362 | 141 / 241 | 118 / 118 |
| 1366x768 | EN | 307 | 347 | 108 / 214 | 102 / 132 |
| 1366x768 | AR | 307 | 342 | 128 / 242 | 119 / 119 |

Every steps/hint region is at least 83 px (target 70), every workspace at least 314 px (target 300), no horizontal scroll, prev/next/close inside the dock at all eight.
Was 23 / 24 px at 1024x768. `viewports` suite: 50 pass, 0 fail, 0 warn (was 49 / 0 / 1).

**W10 final measurement (2026-10-07, after PRISM's `:lang(ar)` goal patch `line-height: 1.6; padding-block: 0`): geometry CLOSED, probe still FAILS by 3 px. Owner PRISM.**
Same method (Draw-a-square open, Chromium, motion and scheme pinned). Cells are clientHeight px; "goal" is clientHeight / scrollHeight of `#lesson-goal`.

| viewport | lang | steps | hint | workspace | AR goal client / scroll |
|---|---|---|---|---|---|
| 1024x768 | EN | 112 | 106 | 348 | n/a |
| 1024x768 | AR | 98 | 92 | 343 | 32 / 34 |
| 1280x720 | EN | 89 | 83 | 318 | n/a |
| 1280x720 | AR | 109 | 103 | 314 | 33 / 36 |
| 1280x800 | EN | 121 | 115 | 366 | n/a |
| 1280x800 | AR | 141 | 118 | 362 | 33 / 36 |
| 1366x768 | EN | 108 | 102 | 347 | n/a |
| 1366x768 | AR | 128 | 119 | 342 | 34 / 36 |

Targets: steps/hint >= 70 px, workspace >= 300 px: **all 8 pass** (minimum 83 and 314); AR dark equals AR light. Screenshots of AR dark 1280x800 and 1280x720 with the lesson open were looked at: the
goal line ("استخدم التكرار ليرسم بولت مربعًا بالقلم.") is one line, fully drawn, nothing cut; title ring, steps, hint bubble, nav and the lesson-text footer line are inside the dock.
Residual: Cairo's content area is 36 px, the line box 33 px (1.6 x 20.8), `overflow: hidden` clips at the padding box, so the probe sees 3 px of content outside it.
It occurs at every measured AR size (1024: 34>32, 1280x720: 36>33, 1366: 36>34); the `layout` suite only samples 1280x800, hence 2 FAILs instead of 8.
**Suggested fix (measured, NOT applied; SENTRY does not edit css):** in the same `:lang(ar) .lesson-panel > .lesson-panel__goal` rule use `padding-block: 0.2em` (about 4 px) instead of `0`.
With that declaration injected at runtime: AR goal client == scroll at all four sizes (40/40, 42/42, 42/42, 42/42); steps 98 / 103 / 135 / 121 px, hint 92 / 97 / 118 / 115 px, workspace unchanged (343 / 314 / 362 / 342),
so every W10 target still holds. `padding-block: 0.1em` leaves 1 px (37 vs 38) and `line-height: 1.75` leaves 1 px (36 vs 37): not enough. PRISM's `-webkit-line-clamp: 1` fallback is not needed: the goal is already one line here.
Re-run `node tests/run.mjs layout viewports` after the change.

Narrow check (EN light, AR dark, 320x740 and 375x740, lesson open, screenshots viewed): lesson is a normal in-flow card above the stage, `scrollWidth - clientWidth` = 0 in all four, title ring rounded and contained, no clipped text.
(The probe's nav-below-viewport flag at these widths is expected: the card is not docked there and the page scrolls.)
F4 was solved by giving `.lesson-steps` and `.lesson-hint` their own inner scrollers, so the nav row never moves. On short viewports those scrollers are tiny
(viewport height of the scroller / its content height, measured with the Draw-a-square lesson):

| viewport | dock | workspace | steps | hint |
|---|---|---|---|---|
| 1024x768 | 307 | 342 | **23** / 209 | **24** / 207 |
| 1280x720 | 288 | 312 | 57 / 213 | 51 / 158 |
| 1280x800 | 320 | 360 | 89 / 213 | 83 / 158 |
| 1366x768 | 307 | 341 | 76 / 214 | 70 / 132 |
| 1440x900 | 360 | 420 | 128 / 214 | 122 / 132 |
| 1920x1080 | 432 | 528 | 200 / 214 | none needed |

At 1024x768 (a common school laptop / landscape iPad) a child sees one line of steps and half a line of the hint (screenshot `en-light-1024x768-lesson`). Everything is
reachable by scrolling the two small regions, so this is not clipped-and-unreachable content, hence a WARN (`viewports/lesson-body-readable-1024x768`, threshold 2 lines = 48 px).
Suggested fix: below ~800 px viewport height put steps and hint **side by side** with the goal line collapsed (the title and goal already take about 100 px),
or let the dock use `min-block-size: 40dvh` and let the workspace go down to 280 px; check `workspace-usable-height-with-lesson-open-*` (>= 300 px) after.
Cosmetic, same screenshots: after `startLesson()` the lesson title (`#lesson-title`) shows a rectangular focus outline on a heading; that is the programmatic focus
(`lesson-start-moves-focus-to-title`) rendered as `:focus-visible`. Intentional for screen-reader announcement; PRISM may want `#lesson-title:focus:not(:focus-visible)` plus
a softer ring if the square box looks like a bug to a teacher.

## 3. Warnings and risks (not DoD failures; each has an owner)

| id | What | Status / owner |
|---|---|---|
| W1 | Firefox AudioContext autoplay warnings (3 per boot) | **CLOSED** (CIRCUIT-2). `firefox-zero-audiocontext-warnings-{en,ar}` and `firefox-zero-console-*` PASS with an empty console filter. |
| W2 | `ctx.procs` plain object: "My Block" named `constructor`/`toString`/`__proto__` | **CLOSED** (CIRCUIT-1). `fuzz/custom-block-named-*` PASS (was 5 WARN), fuzz suite 111 pass, 0 warn. |
| W3 | Toast half covering `btn-lesson-close` | **CLOSED** (PRISM). The `toast-partly-covers-focused-control` WARN no longer fires with the lesson dock open at 1280x800; `toast-never-fully-hides-focused-control` PASS. |
| W4 | Duplicate toolbox ids (`blockly-4`..`blockly-d`) | **CLOSED** (CIRCUIT-1). The four a11y WARNs are gone; a11y 106 pass, 0 warn. |
| W5 | CSP `<meta>` parsed after the inline scripts | **CLOSED** (SENTRY). Sec region moved to directly after `<meta charset>`; `static/csp-before-every-script`, `csp-directly-after-charset`, `csp/csp-first-in-head-*` (zero violations EN/AR on the shipped file), and a negative control `csp/csp-governs-inline-boot-script` (a tampered boot script is now **blocked**, `js` class not set). |
| W6 | Stage above the workspace at 700 to 1023 px | **ACCEPTED, ADR 0008.** Screenshot at 768x1024: stage first, editor below the fold, as the ADR says. |
| W7 | Sitemap `<loc>` and canonical are TODO(content) (real origin unknown); `robots.txt` has no `Sitemap:` line for the same reason. Expected. | BEACON |
| W8 | Blockly's trashcan picture (`media/sprites.svg`) is still fetched from jsDelivr, which is why `img-src` lists `https://cdn.jsdelivr.net`. Self-hosting that one file and pointing `opts.media` at it lets `img-src` drop the CDN. | CIRCUIT-2 |

## 4. Security

### 4.1 Policy (sec region of `index.html`)
```
default-src 'none';
script-src 'self' https://cdn.jsdelivr.net 'unsafe-eval' 'sha256-zhRYatgX...' (boot) 'sha256-oBdTaW0G...' (perf preload);
style-src 'self' https://fonts.googleapis.com 'unsafe-inline';
font-src https://fonts.gstatic.com;
img-src 'self' data: blob: https://cdn.jsdelivr.net;
connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'
```
plus `<meta name="referrer" content="no-referrer">`. Why each non-obvious piece:

* `'unsafe-eval'`: ADR 0003, generated code runs through the single `new Function` in `generators.js` (static test
  `new-Function-single-site`; none in app/blocks/runtime). The mitigation is the literal-only generator rule + `BB.blocks.sanitizeXml`
  whitelist on every upload; fuzzed in section 4.4.
* `style-src 'unsafe-inline'`: Blockly injects `<style>` elements and sets inline styles.
* `img-src https://cdn.jsdelivr.net`: only for Blockly's `media/sprites.svg` (trashcan). Found when the first CSP drafted from the brief
  blocked it (trashcan picture silently missing + 2 console errors). See W8.
* No `frame-ancestors`, `report-uri`, `sandbox`: ignored in a `<meta>` (Chromium logs a console error if present; `static/csp-no-meta-ignored-directives`).
  **GitHub Pages cannot set response headers**, so `X-Frame-Options`, `frame-ancestors`, HSTS and `X-Content-Type-Options` are unavailable.
  Consequence: the site can be framed (clickjacking); the page holds no account, payment or secret, so the impact is low, but record it.
  If hosting ever moves to something that sets headers (Netlify `_headers`, Cloudflare Pages), add
  `Content-Security-Policy: <same policy> frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `Strict-Transport-Security` (`script-src` already has no `unsafe-inline`).
* Hashes cover the two inline scripts. JSON-LD is a data block and needs none (seo.md).
* The sec region is the first thing after `<meta charset>`, so the policy governs the boot and perf inline scripts too (a `<meta>` CSP only applies to what follows it). Verified by the tamper negative control in the `csp` suite. Region audit after QUARTZ's accidental patch-and-revert: the CSP directives and the referrer meta match the policy listed above, and the only differences from what gate 1 shipped are the second hash and one added comment sentence (no gate-1 copy survived to diff byte-for-byte, so this is a content check, not a checksum).

Recompute after editing either inline script:
```
python3 - <<'E'
import re,hashlib,base64
h=re.sub(r'<!--.*?-->','',open('index.html',encoding='utf8').read(),flags=re.S)
for m in re.finditer(r'<script(\s[^>]*)?>(.*?)</script>',h,re.S):
    if 'src=' in (m.group(1) or '') or 'ld+json' in (m.group(1) or ''): continue
    print('sha256-'+base64.b64encode(hashlib.sha256(m.group(2).encode()).digest()).decode())
E
```

### 4.2 Verified under the policy (`csp` suite, EN and AR)
Zero `securitypolicyviolation` events and zero console messages while booting, fetching `lessons.json`, loading Google Fonts (`FontFace.status === 'loaded'`: EN loads Nunito and not Cairo; AR loads Cairo and **not** Nunito, `csp-fonts-load-{en,ar}`),
starting audio and a beep/note script, rendering the trashcan, downloading and uploading a project, and `file://` double-click boot.
Negative controls prove the policy bites: injected inline `<script>`, a script from `https://evil.example`, a `fetch` to `example.com` and an `<img>` from
`example.com` are all blocked (`csp-negative-controls-block`). `form-action 'none'` does not break the `<form method=dialog>` dialogs.

### 4.3 Subresource integrity
Pinned `blockly@13.3.0` (byte-identical to the npm tarball, checked with `cmp`, and re-verified against jsDelivr by `static/sri-matches-cdn-*` when online):

| file | sha384 |
|---|---|
| blockly_compressed.js | `SgkqBMZ4iNwgeoGJxSQlZI+ZHyufRuhA5vy7i+KHevkzshKrqjmtbrO4EnHZMnu9` |
| blocks_compressed.js | `Cjql5OtAv7ZrlRS0qJY11yhU/FXtoGT7UEYfG/eSzwAJXaScGUsuSQCJ9TK73i5E` |
| javascript_compressed.js | `eMjcNWpSkjOjJl5NY4cqX2fZT4BVKukRo02jAl1GvA2EwplAXpMZAVmdcWgmRBpG` |
| msg/en.js | `5WVWW8OKnF6KCXKbhftrLAeT8GzsPPpK5xSrOWgyRuttDnZrICuldWVHbkg+DhIV` |
| msg/ar.js | `dSQN69uPiQ8AqkX1oCvQAGGUsQnk5oLqlHdsBmb1DK2ayW6xTOQ2O2/l8ETeSHuh` |

The three script tags carry `integrity` + `crossorigin="anonymous"`; `MSG_SRI` in `app.js` carries the two message hashes. Google Fonts CSS cannot carry SRI
(its body varies by user agent; ADR 0007 keeps it); `style-src`/`font-src` pin the two hosts. Bumping Blockly means recomputing all five hashes.

### 4.4 Fuzz (`fuzz` suite: 111 checks, 0 script executions)
Uploaded files: garbage text, array/null root, wrong `app`, future version, unknown block type, `<script>` element in XML, `on*=` attribute, DOCTYPE/XXE entity,
400-deep nesting, 30 000 blocks, 3 MB XML, `elseif="99999"` mutation bomb, `__proto__`/`constructor` keys: every hostile structure is rejected with an
error toast and the live workspace is byte-identical afterwards (`loader-rejects-*`), `Object.prototype` is never polluted.
16 hostile strings (`");window.__pwn=1;//`, `</script><script>`, `<img onerror>`, `<svg onload>`, `javascript:`, template-literal and `*/` breakouts, U+2028/2029,
`{{constructor...}}`, `__proto__`, 5 000 chars) were placed in project name, sprite name and id, character, variable name and value, say text, broadcast and
receive messages, `text_join`, procedure names and lesson title/goal/hints/success, loaded, **run**, key/click events fired: 15 loaded and executed as inert data, 1 rejected;
`window.__pwn` stayed 0 throughout, no injected element, sprite labels contain no child elements, zero uncaught errors.
Source grep: no `innerHTML`, `insertAdjacentHTML`, `outerHTML`, `document.write`, `eval(`, string timers or `javascript:` in `js/*.js` (`static/no-dom-sinks-*`).

## 5. Browser matrix

| Browser | Version | Status | What ran |
|---|---|---|---|
| Chromium (desktop, headless, `/usr/bin/chromium`) | 150.0.7871.181 | **FULL** | every suite |
| Firefox (desktop, Playwright build 1543) | 155.0 | **SMOKE** | boot EN light/no-preference and AR dark/reduce, zero-console (empty filter), zero AudioContext warnings, no horizontal scroll and no clipping/mid-word wrap at 320/768/1280 (F2/F3 fixed here too), lesson 3 (Draw a square) solved, colour-effect call. 23 pass, 0 fail. Not run: dialogs/keyboard/fuzz/CSP suites. |
| WebKit / Safari desktop | n/a | **NOT TESTED** | Playwright's WebKit 2359 cannot start on this machine (re-checked in this run; the installed Playwright now also looks for build 2368, which is absent): `libicudata.so.74`, `libicui18n.so.74`, `libicuuc.so.74`, `libxml2.so.2`, `libjxl.so.0.8`, `libjpeg.so.8`, `libbacktrace.so.0` are missing (needs `playwright install-deps`/root; disk is at 100 %). |
| iOS Safari, Android Chrome, Samsung Internet | n/a | **NOT TESTED** | no devices; QUARTZ's Android numbers are lab emulation. |

Known Safari/WebKit risks (reasoned from code, **unverified**):
* `ctx.filter` for the colour effect: absent in current Safari. The runtime is written to degrade silently (architecture section 7); Firefox exercise confirms no throw where
  the property exists, the absent path has not been run.
* Range media queries `(52.5rem <= width < 64rem)` (Safari 16.4+), container queries, `color-mix()`, `:has()` (used by `dialog` padding), `dvh` units, `@layer`: all fine on
  current Safari, broken silently on 15.x and older.
* `<dialog>` + `showModal()` (Safari 15.4+), `::backdrop`, form `method="dialog"`; focus return after close differs slightly between engines (verified in Chromium only).
* `AudioContext` before a user gesture (iOS needs `resume()` inside a tap; `wireAudioUnlock` exists but is untested on iOS).
* File download via `a[download]` + `blob:` URL and `<input type=file accept=".json">` (iOS Files picker) untested.
* Web fonts on `file://` are fine, but Safari ITP can drop `localStorage` after 7 days without a visit (project autosave): mention to teachers.

## 6. Release checklist (run before every tag)

1. `node tests/run.mjs` all green in Chromium; `node tests/run.mjs xb` green in Firefox; WebKit result recorded (tested or NOT TESTED, never blank).
2. `static/csp-hash-*` and `static/sri-*` pass (recompute hashes after any inline-script or Blockly change; section 4).
3. `docs/perf.md` re-measured by QUARTZ after the last code change; LCP < 2.5 s, INP < 200 ms, CLS < 0.1 quoted from it.
4. A human looks at screenshots at 1280, 1024, 768, 375 in EN light and AR dark, the welcome dialog, lessons dialog, lesson dock open, File menu in both directions, a
   toast over a dialog and a running block (`--shots=DIR`); also at 1366x768 and 1440x900 (F2 hid at 1920x1080), plus a lesson open at 1024x768 (W9).
5. Manual: one pass with a screen reader (NVDA+Firefox or VoiceOver+Safari) through boot, a lesson and a dialog; one pass on a real tablet; keyboard-only build of lesson 3.
6. No third-party host beyond jsDelivr, fonts.googleapis.com, fonts.gstatic.com (`static`, CSP lists them); no analytics (seo.md section 5).
7. TODO(content) items resolved or consciously deferred: canonical, `og:url`/`og:image`, sitemap `<loc>`, `robots.txt` `Sitemap:`, real GitHub Pages origin.
8. ADRs exist for every accepted exception (currently: 0002 app shell, 0003 `unsafe-eval`, 0006 ink text, 0007 shell LCP, 0008 stacked visual order).

### Remains manual / NOT TESTED (never claimed above)
* Safari desktop and iOS Safari (WebKit cannot start here); the Safari risks in section 5.
* A real Android phone/tablet and a real tablet: touch, soft keyboard, DoD 6 on real hardware (perf.md numbers are lab emulation and predate PRISM's CSS patch).
* A screen-reader pass (NVDA+Firefox or VoiceOver+Safari): boot, lesson, dialog, Arabic.
* axe-core / Lighthouse: not installed; section 1 DoD 3 rests on bespoke axe-like checks.
* Keyboard-only build of lesson 3 by a human; Windows High Contrast / forced-colors (not covered by the suite).
* Re-measure CWV (QUARTZ) after the CSS patches (W9, W10) and the sec-region move: DoD 6 stays NOT TESTED by SENTRY.
* Real-device WebKit: the one WebKit-only claim (`ctx.filter` absent) is reasoned from code, never run.

## 7. Results of this run (2026-10-07, FINAL GATE, all on the final tree)

`node tests/run.mjs` (all suites, Chromium 150, 363 s) then `node tests/run.mjs xb` (Firefox 155 + WebKit launch attempt); needs network for Google Fonts and jsDelivr. Tree state for every row: final (no edits between runs or after).

| suite | pass | fail | warn | skip | notes |
|---|---|---|---|---|---|
| static | 52 | 0 | 1 | 0 | warn = W7 (TODO(content) sitemap origin `TODO-user.github.io/TODO-repo`) |
| unit | 25 | 0 | 0 | 0 | |
| boot | 51 | 0 | 0 | 0 | |
| layout | 312 | 0 | 0 | 0 | both W10 tests (`screen-lesson-panel-ar-dark-1280`, `screen-toast-ar-dark-1280`) pass |
| viewports | 50 | 0 | 0 | 0 | W9 closed |
| a11y | 106 | 0 | 0 | 0 | min block-ink ratio 4.51 (ADR 0006) |
| motion | 23 | 0 | 0 | 0 | 43 animated elements under no-preference, so the reduce check is not vacuous; includes JS-off |
| flows | 28 | 0 | 0 | 0 | all 8 lessons solved |
| fuzz | 111 | 0 | 0 | 0 | 15 hostile loads executed as inert data, 1 rejected |
| csp | 17 | 0 | 0 | 0 | |
| **Chromium total** | **775** | **0** | **1** | **0** | |
| xb (Firefox 155) | 23 | 0 | 0 | 1 | `xb` is not in the default list: run separately. skip = WebKit (`webkit-2368/pw_run.sh` absent), NOT TESTED |

Re-verified by hand on the real `index.html` (this run): inline-script sha256 to CSP match (2 of 2 executable scripts; JSON-LD is data); perf-script `{en,ar}` map equals `MSG_SRI`.

### History (superseded by the table above, kept for the audit trail)
Gate 1 BLOCK (F1 to F4), re-gate 774 pass / 0 fail / 2 warn (before W9/W10 patches), then 773 / 2 fail (W10 residue), then a layout/viewports/a11y confirmation 468 / 0 after `padding-block: 0.2em`. The full-suite run above replaces the carried-over numbers.

Lesson open (draw-square), dark, measured in the viewport sizes (steps/hint clientHeight, workspace panel height; thresholds 70 px and 300 px):

| viewport | EN steps/hint/workspace | AR steps/hint/workspace |
|---|---|---|
| 1024x768 | 112 / 106 / 348 | 98 / 92 / 343 |
| 1280x720 | 89 / 83 / 318 | 103 / 97 / 314 |
| 1280x800 | 121 / 115 / 366 | 135 / 118 / 362 |
| 1366x768 | 108 / 102 / 347 | 121 / 115 / 342 |

`node --check` passes on `js/app.js`, `js/blocks.js`, `js/generators.js`, `js/runtime.js`. No 0-byte file in the tree.

Screenshots reviewed by a person (not only assertions): EN light and AR dark at 1280x800, 1366x768, 1024x768, 768x1024, 375x740, and with the lesson open at 1280x800,
1366x768 and 1024x768; plus the Firefox 1280x800 editor. No clipping, no mid-word wrap, full stage, dock controls visible.
Confirmation pass: viewed EN light and AR dark at 1024x768 with a lesson open, AR dark 1280x800 lesson crop at 2x, and EN/AR at 320 and 375 with a lesson open: nothing visibly clipped, no overflow; steps/hint now show 3+ lines; the lesson title ring is a rounded rectangle.

## 8. What SENTRY changed outside `tests/` and `docs/qa.md`

* `index.html`, sec region: CSP `<meta>`, `referrer` meta, explanatory comment (my region).
* `index.html`, the three Blockly `<script>` tags: added `integrity="sha384-..."` and `crossorigin="anonymous"` (outside the region, requested in the brief).
* `js/app.js`: `MSG_SRI` filled (config only, requested). This is what triggered F1.
* Re-gate: `index.html` sec region moved to directly after `<meta charset>` (W5) and its second hash replaced by the recomputed one. No other line of `index.html` changed (diffed against a copy taken before the edit).
No other file was touched.

