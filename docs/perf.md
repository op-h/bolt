# BoltBlocks — performance budgets and measurements (QUARTZ)

Gates for DoD #6 (LCP < 2.5 s, INP < 200 ms, CLS < 0.1 on a throttled mid-tier Android over 4G) and #7
(zero console errors, explicit dimensions). Every number below is a **lab estimate**, never field data:
Chromium 150 on a desktop CPU, CDP `Emulation.setCPUThrottlingRate` 4x, CDP `Network.emulateNetworkConditions`
1.6 Mbps down / 0.75 Mbps up / 150 ms latency ("Slow 4G"-like), `prefers-reduced-motion: no-preference` and
`prefers-color-scheme: light` pinned through CDP `Emulation.setEmulatedMedia`, cold HTTP cache, "mobile" 412x915
DPR 2.625 Android UA and "tablet" 1024x768. The sandbox reached the real jsDelivr and Google Fonts, so the CDN
bytes are real. Dated 2026-10-07; **re-measured after CIRCUIT removed Nunito from Arabic and PRISM's
stage/rail/lesson-dock CSS landed**. "Previous" columns are the 2026-10-06 numbers.

**Build measured.** PRISM was still editing `css/style.css` while this ran (an early pass on the live tree and the
final pass differ by one CSS edit), so the final numbers below come from a **pinned copy** of the tree served by the
lab server. sha256 prefixes: `style.css` 52cb61db4333, `index.html` 3b6d4d07fde1, `app.js` da1076c07c3a,
`blocks.js` 851f1a9d13a2, `runtime.js` 1e1c8d014b21, `generators.js` 9b0ab8253245. Units: **kB = CDP
`encodedDataLength` / 1024, headers included** (the unit of every earlier "wire kB" figure and of the ADR 0007
budgets); file sizes in section 2 are decimal bytes.

Honest limits: the emulated latency is charged per request, not per DNS/TCP/TLS handshake, so the benefit of
removing third-party origins is under-reported here. The lab server speaks HTTP/1.1, so the CSS does not get the
HTTP/2 priority a real host gives it; FCP is therefore pessimistic. Block drag-and-drop, workspaces over ~30
blocks, more than 3 sprites and Safari/Firefox are **not measured**. The 768 px viewport, the warm-cache reload and
the SRI/CSP checks were **not re-run** this round (2026-10-06 values stay, marked below).

## 1. Budgets and status (the gates)

**Verdict: every user-facing gate passes in all eight cells (LCP, FCP, CLS, INP, long tasks, runtime). Against the
ADR 0007 addendum budgets: Arabic passes with room (386.6-387.6 kB vs 430, ready 2.46-2.64 s vs 3.2); English
boot-ready passes (2.39-2.44 s vs 2.75); English transfer sits exactly on its limit (360.0-360.5 kB vs 360, 359.0-359.5
in the earlier live-tree pass); and one gate not in the addendum now fails: own CSS 20.5 kB gzip vs 20.** See 3.2 and 4.

Matrix, medians of n = 5 cold-cache boots per cell (`SHORT=1`, boot only; wire = CDP bytes over the wire up to
1.5 s after `is-ready`, headers included). LCP element is `p.app-boot__text` (the static shell paragraph) in
**all 40 runs**; FCP and LCP are the same paint. "CLS" is the whole boot including `is-ready` (CLS at ready and
boot CLS are equal in every cell: nothing shifts in the 1.5 s after ready).

| Lang / viewport / visit | FCP = LCP ms (worst run) | boot-ready ms | CLS | wire kB | boot long tasks (n / max ms) |
|---|---|---|---|---|---|
| EN 412 first | 1,064 (1,084) | 2,443 | 0.0050 | 360.5 | 3 / 201 |
| EN 412 return | 1,160 (1,208) | 2,386 | 0.0050 | 360.5 | 3 / 162 |
| EN 1024 first | 1,212 (1,228) | 2,419 | 0.0025 | 360.0 | 3 / 211 |
| EN 1024 return | 1,200 (1,276) | 2,424 | 0.0025 | 360.0 | 3 / 181 |
| AR 412 first | 1,200 (1,272) | 2,635 | 0.0097 | 386.6 | 3 / 234 |
| AR 412 return | 1,156 (1,184) | 2,601 | 0.0097 | 386.6 | 3 / 183 |
| AR 1024 first | 1,176 (1,204) | 2,464 | 0.0096 | 387.6 | 3 / 209 |
| AR 1024 return | 1,188 (1,292) | 2,595 | 0.0065 | 387.0 | 3 / 177 |

One `msg/<lang>.js` transfer per boot, preload reused (one request, `transferSize`): `en.js` **10,624 B**, `ar.js`
**12,655 B** (unchanged from 2026-10-06). Webfonts on the wire (full runs, 412 first visit): English Nunito latin
39,703 B; Arabic Cairo arabic 31,254 B + Cairo latin 33,780 B = 65.0 kB and **no Nunito request** (was 104 kB).

"Return" = `boltblocks.welcomeSeen` set, **cold HTTP cache**. Full sessions (open, run, add sprite, lessons, 3-sprite
loop; n = 3 per cell, return visit) reproduced the boot values: whole-session CLS equals boot CLS (0.0011-0.0103),
worst INP 72-80 ms (single first-visit 412 runs: EN 88, AR 96 ms), no long task and no frame over 50 ms in the loop.

Compared with 2026-10-06: Arabic boot-ready 3.11-3.14 -> 2.46-2.64 s (-0.5 to -0.65 s; predicted -0.2 s), Arabic
wire 422 -> 386.6-387.6 kB (-35 kB). English boot-ready also moved -0.1 s (2.50-2.54 -> 2.39-2.44) with no change on
the English byte path, so about 0.1 s of the Arabic gain is lab drift and about 0.4-0.5 s is the Nunito removal; the
Arabic/English gap shrank from +0.6 s to +0.1-0.2 s. English wire is +3 kB (357 -> 360.0-360.5: own files grew, see
2). LCP/FCP are +0.07-0.15 s vs last round (1.0-1.1 -> 1.06-1.21 s); cause not isolated (own CSS +1.9 kB gz and CDN
variance; same unexplained drift as in 3.1), still 0.6 s under the 1.8 s FCP gate.

| Gate | Budget | Previous (2026-10-06) | Now (2026-10-07) | Status |
|---|---|---|---|---|
| LCP, EN, 412 / 1024, first and return | < 2.5 s | 1.02-1.10 / 0.99-1.05 s | 1.06-1.16 / 1.20-1.21 s | PASS |
| LCP, AR, 412 / 1024, first and return | < 2.5 s | 1.03-1.06 s | 1.16-1.20 s (worst run 1.29 s) | PASS |
| LCP element | stays on the shell | `p.app-boot__text`, 60/60 | `p.app-boot__text`, 40/40 boots and the final LCP entry after the dialog in the 4 first-visit full runs | PASS |
| FCP | < 1.8 s | 0.99-1.10 s | 1.06-1.21 s | PASS |
| CLS, boot and whole session | < 0.1 | 0.0008-0.0097 | 0.0011-0.0103 medians; worst single run 0.0146 (AR 412) | PASS |
| CLS caused by `is-ready` | ~0 | 0.0007 | 0 (CLS at ready = boot CLS; the shifts land at 2.2-2.3 s, before ready) | PASS |
| INP (scripted clicks, 9 per run) | < 200 ms | worst 64-80 ms | worst 72-80 ms (n = 3 per cell); 88 EN / 96 AR in single first-visit runs | PASS |
| Boot-ready, EN | <= 2.75 s (ADR 0007 addendum) | 2.50-2.54 s | 2.39-2.44 s | PASS, 0.3 s margin |
| Boot-ready, AR | <= 3.2 s (addendum) | 3.11-3.14 s | 2.46-2.64 s (worst run 2.64) | PASS, 0.56 s margin |
| Boot long tasks (4x CPU) | each <= 300 ms | max 196-287 ms | 3 tasks per boot, max 162-234 ms | PASS (66 ms headroom, was 13) |
| Long tasks in a 3-sprite `forever` loop | none > 50 ms | 0 | 0 (4 cells) | PASS |
| Frame time, same loop (rAF deltas, 5 s) | p95 <= 20 ms, none > 50 ms | median 16.7, p95 16.7-16.8 | median 16.7, p95 16.7-16.8, max 33.3-33.4 (one frame), 0 over 50 ms | PASS |
| Canvas draw, 3 sprites + pen layer (per `rt.render()`) | <= 8 ms at 4x | 4.2-5.7 ms | 4.3-5.5 ms | PASS |
| JS heap | <= 20 MB | 4.6-4.8 MB boot, 6.4-7.3 run | 4.6-4.8 MB boot, 7.2-7.5 MB after the run | PASS |
| **Transfer to boot-ready, EN** | <= 360 kB (addendum; was 350) | 357 kB | **360.0-360.5 kB** (359.0-359.5 in the earlier live-tree pass) | **AT LIMIT**: 0.0-0.5 kB over in the pinned pass; no headroom |
| Transfer to boot-ready, AR | <= 430 kB (addendum) | 422 kB | **386.6-387.6 kB** (-35 kB) | PASS, 42 kB margin |
| Own JS gzip (4 files) | <= 70 kB | 67.7 kB | 68.9 kB (app 33.4, blocks 16.0, runtime 14.2, generators 5.3) | PASS, 1.1 kB margin |
| **Own CSS gzip** | <= 20 kB | 18.6 kB | **20.5 kB** (+1.9 kB, +10 %) | **FAIL by 0.5 kB**, see 3.6 |
| HTML gzip (incl. inline sprite) | <= 12 kB | 10.8 kB | 11.1 kB | PASS |
| Third-party JS | <= 215 kB gz | 212.4 kB at gzip -9 | unchanged (Blockly pin 13.3.0 not touched; not re-measured) | PASS |
| Webfont bytes, English | <= 40 kB | 39.3 kB | 39.7 kB (Nunito latin 39,703 B) | PASS, 0.3 kB margin |
| Webfont bytes, Arabic | none set | 104 kB (Nunito + Cairo x2) | **65.0 kB** (Cairo arabic 31.3 + latin 33.8; no Nunito request) | not gated; -39 kB |
| All scripts non-blocking | `defer` on all 7 external | 7 of 7 | 7 of 7 `defer` (re-checked in the HTML); the 2 inline scripts are small | PASS |
| Images have dimensions | every `img`/`svg`/`canvas` | yes | unchanged (no `<img>` in the HTML; CLS above is the evidence) | PASS |
| Warm-cache reload | ready <= 1.5 s | EN 0.59 s, AR 0.55 s | **not re-run** | carried over |
| Console errors / unhandled rejections | 0 | 0 in 16 full sessions | 0 in the 4 full first-visit 412 sessions captured this round (2 EN, 2 AR on the pinned build) plus 2 on the live tree; the 12 return-visit full runs and the SHORT matrix do not record them | PASS |

Third-party ledger (justification is ADR 0001; sizes re-measured at gzip -9, CDN wire sizes within 1 %):
Blockly 13.3.0 core 179.0 kB + blocks 14.9 + javascript generator 8.4 + `msg/en.js` 10.1 (`ar.js` 12.1), Nunito
latin variable woff2 39.7 kB (one file covers 600/800/900; English only), Cairo variable woff2 arabic 31.3 / latin 33.8 kB (Arabic only),
Google Fonts CSS 0.97 kB. No other third-party code. jsDelivr serves `immutable`, 1 year, so repeat visits pay nothing.

## 2. Weight inventory

| File | Raw | gzip -9 |
|---|---|---|
| `index.html` | 49,843 | 11,147 (was 49,250 / 10,811 on 2026-10-06; inline sprite sheet 17,365 raw / 2,869 gz of that on 10-06) |
| `css/style.css` | 78,975 | **20,498** (was 72,897 / 18,587 on 10-06; the pinned build, live file +4 B later) |
| `js/app.js` | 120,551 | 33,420 (was 119,524 / 33,033) |
| `js/blocks.js` | 52,352 | 16,049 (was 50,717 / 15,449) |
| `js/runtime.js` | 47,340 | 14,226 (was 46,758 / 14,016) |
| `js/generators.js` | 16,627 | 5,251 (was 16,576 / 5,241) |
| `lessons/lessons.json` (lazy, fetched on first lesson) | 36,831 | 7,647 (unchanged) |
| 12 costume SVGs (`assets/sprites/`) | 10,148 total, 303-451 B gz each | 4,710 total |
| `assets/bolt.svg` / `logo.svg` | 1,964 / 1,080 | 770 / 627 |

There are no raster images, so AVIF/WebP/`srcset` do not apply. Every image is a small SVG with width/height or
CSS size. The 12 costume SVGs are requested at boot by `runtime.js` (`new Image()`), 0.29-0.45 kB each, over the
same connection; the cost is negligible and nothing was changed.
Coverage measured on 2026-10-06 (**not re-run** on the new CSS; scripted session: open, run, add sprite, lessons, theme, file menu, d-pad): CSS 82 % of rules
used (dark theme, RTL and phone rules were not exercised), JS 35-78 % per file (error paths, Arabic, lessons).
**No dead-code pruning is justified by this.** Unminified own JS: terser (`-c -m`) would take it from 65.9 to
41.0 kB gz (-24.8 kB; 2026-10-06 build), see 3.2; rejected by ADR 0007 (no build step).

## 3. Findings, with the measurements behind them

### 3.1 First-visit LCP: FIXED by the ADR 0007 shell copy (was FAIL)
**Re-run 2026-10-07:** still `p.app-boot__text` in 40 of 40 boots (EN and AR, 412 and 1024, first and return), LCP 1.06-1.21 s, size 30.4 k / 38.2 k px2 EN and 34.3 k / 42.0 k AR; the final entry after the dialog opens is unchanged. The text below is the 2026-10-06 measurement.

**After (2026-10-06 re-run).** The LCP element is `p.app-boot__text`, static HTML in `#app-boot`, in every one of 60
cold boots (3 viewports x EN/AR x first/return x n = 5). It paints with FCP at 0.99-1.10 s (worst single run
1.25 s) and is no longer coupled to boot-ready (2.5 s EN, 3.1 s AR). First visit, tablet 1024: **3.18 s -> 0.99 s**;
768: 1.08 s; phone 1.10 s; Arabic 1.04-1.06 s. When the welcome `<dialog>` opens after ready it does not take over:
the final LCP entry after the dialog is open and "Start coding" has been clicked is still `app-boot__text` (size
38.2 k px2 at 1024, 30.4 k at 412, 42.0 k in AR) in every full run, because the shell paragraph is the larger text.
`#wl-start` gating works in the lab (the scripted click at ready succeeded in all first-visit full runs; INP 64 ms).
The shell is meaningful static text, so the "interactive-looking buttons" concern in the old note does not apply.

**FCP moved up 0.05-0.2 s** (0.87-0.94 -> 0.99-1.10 s). It is bound by render-blocking CSS: `style.css` ended at
0.92-0.95 s and the Google Fonts CSS at 0.77-1.09 s in the resource timings, against ~0.71 / 0.77 s before. Own HTML
grew 0.9 kB gz and own CSS 0.9 kB gz, and on this HTTP/1.1 lab server the CSS shares 1.6 Mbps fairly with ~290 kB of
deferred script, so the extra ~2 kB (~10 ms) does not explain +100-200 ms by itself; CDN variance is the rest and
the cause was **not isolated**. Still 0.7 s under the 1.8 s gate.

**History (before ADR 0007), kept for the record.** The expectation was shell text or the mascot. Measured with a
PerformanceObserver on tablet: candidate 1 `span.wordmark` (4.3 k px2) at 0.88 s; final candidate `p#wl-text` in the
welcome dialog (28.5 k px2) at 3.42 s, because `app.js` opened the dialog only after Blockly loaded; on a 412 px
phone `#phone-notice p` won at 0.87 s. Lab variants at the time (tablet, first visit, n = 5, medians):

| Variant | Ready | LCP |
|---|---|---|
| as found (empty perf region) | 3,072 | 3,404 |
| + msg preload, no Cairo in EN, minified own JS | 2,302 | 2,692 |
| + welcome dialog opened by a script at the end of `<body>` (lab hack) | 2,302 | 1,204 |
| dialog opened early, nothing else changed | 3,071 | 1,152 |

The predicted "~1.2 s" for painting the copy from the shell was confirmed (0.99-1.08 s on tablet/768).

### 3.2 Boot is bandwidth-bound; fixes measured, remaining misses
At 1.6 Mbps, 391 kB take about 2 s, so bytes before ready are the lever, not discovery order. Critical chain found:
Blockly core (180 kB, done at ~2.0 s) -> `app.js` runs -> **then** `msg/en.js` is requested (+0.29 s) ->
`fonts.load` Nunito **and Cairo Arabic** -> inject workspace (237 ms task at 4x) -> ready.

| Fix | Owner | Ready (median) | LCP | Bytes |
|---|---|---|---|---|
| Preload `msg/<lang>.js` in parallel (shipped, section 5) | QUARTZ | 3,072 -> 2,874 (-198 ms) | 3,404 -> 3,224 | 0 |
| `blocks.js` `fontsReady()`: load Cairo only when `lang === 'ar'` (guard the second `document.fonts.load`; lab patch used `document.documentElement.lang === 'ar' ? ... : Promise.resolve()`) | CIRCUIT | 3,056 -> 2,662 (-394 ms) | 3,384 -> 3,040 | -31 kB in English |
| Minify own JS at publish time (terser), needs a build step against ADR 0001 "no build" | ATLAS decision | 3,056 -> 2,979 (-77 ms) | 3,384 -> 3,312 | -24.8 kB gz, less parse |
| Combined (preload + no Cairo in EN) | | 3,072 -> 2,437 | 3,404 -> 2,828 | |
| Combined + minified | | 3,072 -> 2,302 | 3,404 -> 2,692 | 391 -> ~335 kB |

The shipped region alone gives 2,846 ms ready / 3,176 ms LCP (n = 5, final `index.html`).

**Status after the fixes landed, 2026-10-06 (EN, n = 5 per cell):** boot-ready 2.85 -> 2.50-2.54 s (-0.3 s; the lab
estimate for "preload + no Cairo" was 2.44 s, so the shipped result is within 0.1 s of it), wire 391 -> 357 kB
(-34 kB: Cairo arabic 31 kB gone, plus ~2-3 kB of headers), webfonts 70 -> 39.3 kB. Not applied: minified JS
(ADR 0007 rejected it, so the 2.30 s / 335 kB variant stays a lab number).

**Status 2026-10-07 (pinned build, n = 5 per cell, section 1).** Against the ADR 0007 addendum budgets:
- *English transfer 360.0-360.5 kB vs 360 kB: at the limit, no headroom.* It was 357 kB on 2026-10-06; the +3 kB is
  own growth (CSS +1.9 kB gz, JS +1.2 kB gz, HTML +0.3 kB gz, plus headers). An earlier pass on the live tree read
  359.0-359.5 kB, i.e. one CSS edit earlier. Any further own growth fails this gate. Options unchanged: minify
  (-24.8 kB, rejected), Latin-subset self-hosted Nunito (-17.8 kB, rejected), trim own CSS (3.6) or re-baseline again.
  Composition (kB, wire, 2026-10-06 build): Blockly core 181.1, Nunito 39.2, `app.js` 33.3, `style.css` 18.9,
  `blocks_compressed` 15.9, `blocks.js` 15.7, `runtime.js` 14.3, HTML 11.1, `msg/en.js` 10.7, `javascript_compressed`
  9.1, `generators.js` 5.4, 12 costume SVGs ~4.7, small rest ~3.
- *English boot-ready 2.39-2.44 s vs 2.75 s: PASS, 0.3 s margin.* The critical path is unchanged (Blockly core, then
  the inject/apply/wire task, 162-234 ms at 4x).
- *Arabic: PASS with room (386.6-387.6 kB vs 430; ready 2.46-2.64 s vs 3.2).* Arabic downloads Cairo arabic 31.3 +
  Cairo latin 33.8 kB (65.0 kB) and `ar.js` 12.7 kB; no Nunito. The Arabic/English ready gap is now +0.1-0.2 s.

**The Nunito-in-Arabic request: FIXED (was the open item of 2026-10-06).** Before: Arabic fetched Nunito latin
(39.3 kB) although no DOM element renders in it (computed `font-family` of every element starts with Cairo;
`CSS.getPlatformFontsForNode` reported no Nunito glyphs), and a lab patch of `fontsReady()`, `blocks.js` `FONT_FAMILY`
and `runtime.js` `FONT` did not remove the request. **The fourth consumer was Blockly's canvas text measuring through
the theme font stack** (`fontStyle.family`, `blocks.js` line 603): Blockly sets `ctx.font` with that stack to measure
block text, and the first family in it, Nunito, triggers the face. CIRCUIT now passes `FONT_FAMILY_AR` (Cairo first,
`blocks.js` lines 38-40, 603) for `lang === 'ar'`, keeps the canvas `fontStack()` per language in `runtime.js`
(lines 40-43), and `fontsReady()` skips Nunito for Arabic (`blocks.js` line 977). **Verified:** the wire list of Arabic
full sessions (two on the pinned build, two on the live tree) contains the two Cairo files and no Nunito file.
Result: Arabic wire 422 -> 386.6-387.6 kB (-35 kB; the -39.7 kB of font body is partly offset by about +4 kB of own growth
and headers), webfonts 104 -> 65.0 kB, boot-ready 3.11-3.14 -> 2.46-2.64 s (-0.5 to -0.65 s, of which about 0.1 s is
lab drift, see section 1). The 2026-10-06 prediction was -39 kB and -0.2 s.

### 3.3 CLS (PASS; the sprite-list shift is fixed)
**Re-run 2026-10-07:** boot CLS medians 0.0025-0.0050 in English and 0.0065-0.0097 in Arabic (single worst boot
0.0146, AR 412), and the whole-session CLS of the full runs equals boot CLS (0.0011-0.0103), so clicking, dialogs and
adding sprites still shift nothing. Nothing shifts in the 1.5 s after `is-ready`: the recorded shifts sit at
2.2-2.3 s, before ready, on the top-bar buttons (`btn-add-sprite`, `btn-dismiss-notice`, `btn-lessons`, `btn-theme`)
and the boot overlay, which is the web-font swap, not the stage/rail/dock layout. The cause was inferred from the
timing and the shifted nodes, not isolated with a font-blocked run.
An outlier is on record: while PRISM was still editing `style.css`, one AR 412 return full run (2 of 3 in its
n = 3 set, 1 of 2 in a repeat) showed 0.065 from three shifts at 2.2-2.3 s (`app-boot`, `btn-lessons`, `menu`, `btn-theme`). It did
not reproduce in the 20+ AR 412 boots on the live tree and the pinned build that followed (max 0.0146), so it is
filed as a transient of the mid-edit CSS, not a finding, but it is still under the 0.1 gate even if it returns.
All cells are 7-40x under the 0.1 gate. The boot skeleton is an absolute overlay.

**2026-10-06:** the 0.0154 shift at `is-ready` is gone (reserved `.sprite-list` height), 0.0007 residual on 1024.
**History:** 0.017 on tablet before the fix (0.0013 font swap + 0.0154 at ready from `ul#sprite-list` filling).

### 3.4 Fonts
- `font-display: swap` is in the Google Fonts URL (verified in the returned CSS). Weights 600/800/900 are one
  variable file per script, so there are no per-weight requests. English requests only Nunito latin
  (39.7 kB); **Arabic requests only Cairo latin and Cairo arabic (65.0 kB), no Nunito** (3.2, verified 2026-10-07).
- **Preloading Nunito does not work and was measured worse** (+236 ms ready, 3,056 -> 3,292): the Google CSS
  serves a different file by user agent (desktop UA `.../XRXV3I6Li01BKofINeaB.woff2` 39.7 kB, Android UA
  `.../XRXV3I6Li01BKofINeaBTMnFcQ.woff2` 39.2 kB), and the font competes with Blockly for the same pipe. Self-hosting
  is the only way to get a stable, preloadable URL.
- Self-hosting (lab variant, same bytes, two fewer origins): ready 3,056 -> 3,170 and LCP 3,384 -> 3,492, i.e. no
  win and slightly worse in the lab, which cannot charge the extra DNS/TCP/TLS of two origins. The real-network gain
  is therefore **not measured**; a theoretical 2-3 round trips (about 0.3-0.45 s at 150 ms RTT) on the render-blocking
  font CSS. Measured side result for any future self-host: Latin-only subset of Nunito (U+0020-007E plus common
  punctuation) is 21.4 kB vs 39.2 kB (-45 %). Left to ATLAS, ADR 0001 accepts Google Fonts.
- The Google Fonts stylesheet is **render-blocking third-party CSS**; FCP is bound by it (CSS done at 0.77 s vs
  `style.css` at 0.71 s on this profile). Fine today (FCP < 1 s), a risk on a worse network.
- **Fallback metrics (PRISM's `TODO(measure)`), computed from the font files** against Liberation Sans Bold
  (metric clone of Arial Bold, which is what a 600+ weight falls back to), UI strings in `index.html` as the sample:
  average advance Nunito 600 / 800 / 900 = 0.460 / 0.480 / 0.491 em vs 0.483 em, i.e. `size-adjust` 95 % / 99 % / 102 %.
  Nunito vertical metrics (hhea = typo, USE_TYPO set): ascent 101.1 %, descent 35.3 %, line gap 0. For the 800
  weight: `size-adjust: 99%; ascent-override: 101.7%; descent-override: 35.5%; line-gap-override: 0%` on a
  `local("Arial Bold")` face. **Recommendation: do not add it.** Measured swap CLS is 0.0013, the spread between
  weights is +-5 % so one face cannot match all three, and the target device (Android) may not resolve
  `local("Arial")`; Roboto/Android metrics could not be measured in this sandbox. Cairo/Arabic fallback metrics were
  not computed (system Arabic fallbacks vary too much to match).

### 3.5 Interaction and runtime
- INP-style (Event Timing, `durationThreshold` 16 ms, pointerdown/keydown interactions at 4x CPU): welcome Start 40 ms,
  green flag 24, stop 24, Add sprite 40-48, pick character 56, Lessons open 16-40, Escape/close 32. Worst per run
  64-72 ms (tablet 64, phone 72). Almost all of it is presentation delay (11-53 ms); handler time is 1-7 ms, 20 ms for Escape closing a dialog.
- Running 3 sprites x `forever { move; turn; bounce }`, one with pen down, 5 s: 60 fps, 0 long tasks, 0 frames over 50 ms.
  - Canvas redraw is JS-side 4-5 ms/frame at 4x with the canvas drawn at min(DPR, 2).
- Boot long tasks (4x): 78 ms, 67 + 60 ms, then 237 ms (the last one coincides with `is-ready`, i.e. Blockly inject,
  project apply and wiring). It is about 60 ms unthrottled. Splitting it is optional (CIRCUIT); it only matters if a
  child taps the top bar during that window, which was not measured.
- Zero console errors/warnings in both English and Arabic boots after the perf-region change (checked).
- 2026-10-07 re-run (pinned build): worst INP-style interaction 72-80 ms per cell (n = 3 return), 88 ms EN / 96 ms AR in
  single first-visit 412 runs; boot long tasks 3 per boot, max 162-234 ms; loop frames p95 16.7-16.8 ms, 0 long
  tasks; canvas draw 4.3-5.5 ms per render at 4x. Not changed by the stage/rail/dock CSS beyond noise.

### 3.6 Own CSS is over its gzip budget (new, 2026-10-07)
`css/style.css` is 78,975 B raw / **20,498 B gzip -9** against the 20 kB gate (was 72,897 / 18,587 on 2026-10-06:
+1.9 kB gz, +10 % in one day, from the stage/rail/lesson-dock work). Measured split of the same file: with all
`/* ... */` comments removed it is 55,610 B raw / **10,832 B gz**; comments plus the whitespace they carry are
therefore about 9.7 kB of the 20.5 kB gz (47 %). Comments are the house style ("comment the why") and ADR 0007 rejects
a publish-time minifier, so this is PRISM's and ATLAS's call, not a QUARTZ edit. Cheapest ways back under 20 kB
without a build step: move the longest design-rationale comment blocks to `docs/design.md` (about 0.5 kB gz is
enough), or have ATLAS raise the CSS gate to 22 kB. The cost on the wire is ~20 ms at 1.6 Mbps; it is a maintenance
and headroom gate, not a user-visible one. CSS coverage (82 % on 2026-10-06) was not re-run on the new rules.

## 4. Findings routed

Closed and re-measured on 2026-10-07: shell welcome copy (LCP stays on the shell, 1.06-1.21 s), `.sprite-list` height
(nothing shifts after ready), Cairo not fetched in English, **Nunito not fetched in Arabic** (fourth consumer found and
fixed; Arabic 422 -> 386.6-387.6 kB, ready 3.1 -> 2.5-2.6 s), `showWelcome()` tolerant and `#wl-start` gated. Open:

| To | What | Evidence |
|---|---|---|
| ATLAS | Verdict against the ADR 0007 addendum budgets: Arabic passes (387.6 kB / 430, 2.64 s / 3.2), English boot-ready passes (2.44 s / 2.75), English transfer is **at the 360 kB limit** (360.0-360.5 kB; 359.0-359.5 on an earlier live-tree pass) with zero headroom. Decide before the next feature lands: trim own bytes (3.6), re-baseline to a number with margin (QUARTZ suggests 370 kB), or accept minify/self-hosted subset. | section 1, 3.2 |
| PRISM | **Own CSS 20.5 kB gz vs the 20 kB gate (FAIL by 0.5 kB, +1.9 kB since 10-06).** Comments are 9.7 kB of it (47 %); with them removed the file is 10.8 kB gz. Trim or relocate the long rationale comments, or ask ATLAS to move the gate. Also: one AR 412 outlier (CLS 0.065) appeared while `style.css` was mid-edit and did not reproduce on the pinned build; re-check once the CSS is final. | 3.6, 3.3 |
| CIRCUIT | Optional: split the last boot task (inject + apply + wire, 162-234 ms at 4x) in two; est. -100 ms ready, not measured. No longer urgent: 66 ms headroom under the 300 ms task gate (was 13). | 3.2, section 1 |
| SENTRY | The perf inline script (672-byte body) has CSP hash `sha256-oBdTaW0GbV2ksfvyejYVeaUrQe1AJ7OCxUxAsUFG0qg=`, **recomputed 2026-10-07 from the real `index.html` perf region**; it is present in the CSP meta `script-src` and matches. The old note (`sha256-NNBdk70...`, 292 bytes) described a script body that no longer exists (the integrity-carrying preload replaced it). The boot script's hash `sha256-zhRYatgXxd2OKhdI+U7J80uK/RG4gdOinI1XwHODuow=` (759 bytes) also matches. Re-run the check after any edit to either inline script. All matrix runs ran with the CSP active: zero errors in the 4 full sessions that record them. The `msg` preload now carries `integrity` from the inline `{en, ar}` map (section 5): one transfer per language. | section 5 |
| GRANITE | Nothing blocking. The Google Fonts `<link rel=stylesheet>` is render-blocking third-party CSS and gates FCP (3.1, 3.4). | |

## 5. What lives in the `<!-- perf -->` region (and what was tried and rejected)

Shipped: one inline script that appends `<link rel=preload as=script crossorigin>` for
`https://cdn.jsdelivr.net/npm/blockly@13.3.0/msg/<html lang>.js`. It runs after the boot script has stamped
`html[lang]`, so English users fetch `en.js` and Arabic users `ar.js`, once (verified: one request, initiator `link`,
no console output, both languages). It removes one round trip from the boot chain. A static `<link>` was rejected
because it would download `en.js` for Arabic users (10 kB and an unused-preload warning). Keep the URL in step with
`loadBlocklyMessages()` in `app.js` when the Blockly pin changes.

The preload also sets `integrity` (and `crossorigin=anonymous`) from an inline `{en, ar}` copy of `MSG_SRI` in `app.js`
(source of truth; SENTRY's static test checks they match). Without it Chrome logs "preload ... integrity mismatch" on every
boot (SENTRY F1) and, measured on a no-integrity copy, requests `msg/en.js` twice (second one a disk-cache hit, but the
preload is wasted). With it: one request per language, `transferSize` 10,624 B (en) / 12,655 B (ar), zero console messages.
The inline script body changed, so its CSP hash must be recomputed (see handoff).

Measured and rejected (tablet, first visit, n = 5, ready median vs same-sweep base 3,056 ms):

| Hint | Ready | Verdict |
|---|---|---|
| `preconnect` jsdelivr with `crossorigin` | 3,058 | no effect. Scripts are discovered by the preload scanner at the same instant, so there is nothing to gain; Chrome opens 3 parallel connections either way |
| `preconnect` jsdelivr without `crossorigin` | 3,061 | no effect |
| both preconnect forms | 3,076 | no effect |
| preload Nunito woff2 | 3,292 | worse; URL differs per UA (3.4) |
| `modulepreload` | n/a | no ES modules in the project |
| preload `blockly_compressed.js` | not tried | already requested at ~0.19 s with every other resource; the transfer is bandwidth-bound, ordering cannot make 391 kB arrive sooner |
| GRANITE's existing `preconnect` to fonts.googleapis.com / fonts.gstatic.com | | kept (not duplicated); unmeasured here, see the handshake caveat above |

## 6. How to reproduce

`docs/perf-lab/` holds the harness (about 16 kB): `server.py` serves the project like GitHub Pages (gzip text,
`max-age=600`) and can splice a different perf region or patch a file per `?v=<variant>` from an optional
`variants.json` (not kept in the tree; the Arabic font patch in 3.2 was a two-line `patch` entry); `measure.js` runs
the throttled Chromium session and prints one JSON summary; `sweep.sh` and `agg.py` repeat and aggregate. Needs
`playwright-core` (`PLAYWRIGHT_CORE=...`), Chromium, and internet for the CDN. Profiles: `mobile` (412), `t768`
(768x1024), `tablet` (1024x768). `LANGUAGE=ar|en` presets `boltblocks.lang`. The summary now also reports
`lcpEl`/`lcpEls` (winning element per run), `clsAtReady` and `wireBootKB` (bytes over the wire by 1.5 s after ready, KiB, headers included), and `xfer` (`transferSize` of the `msg/<lang>.js` entry). Set `BASE=http://127.0.0.1:<port>/` to measure a pinned copy of the tree: copy `index.html css js assets lessons` and `docs/perf-lab` into a scratch directory and run `server.py` from there, because `server.py` serves whatever sits two levels above itself (do this when another agent is editing the live tree).

```
python3 docs/perf-lab/server.py 18431 &
SHORT=1 node docs/perf-lab/measure.js base tablet first 5      # boot only
LANGUAGE=ar SHORT=1 node docs/perf-lab/measure.js base t768 first 5   # Arabic, 768 wide
node docs/perf-lab/measure.js base mobile return 3             # boot + clicks + 3-sprite run
WARM=1 SHORT=1 node docs/perf-lab/measure.js base tablet return 3   # reload with warm cache
```
Check the port is free first (other local servers collide on common ports). Re-measure after any change to
`index.html` head, `blocks.js` boot code, the Blockly pin, or font URLs, and update section 1.
