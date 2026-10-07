# 0007 — First-visit LCP strategy; no minify build; fonts stay on Google Fonts
Date: 2026-10-06 | Status: accepted

## Context
QUARTZ measured first-visit tablet LCP at 3.18 s (budget 2.5 s, DoD #6). The LCP element is the
welcome-dialog paragraph painted by JS after Blockly boots; the static shell has an sr-only h1 and an
SVG mascot, neither of which can be an LCP candidate.

## Decisions
1. **Paint the welcome copy from the static shell.** The `#app-boot` skeleton (visible without JS)
   carries Bolt, a visible heading and the same welcome paragraph at the largest text size on the page.
   LCP becomes a static paragraph (~1.2 s measured by QUARTZ's estimate). The welcome `<dialog>` still
   opens on first visit once ready; `showWelcome()` must tolerate being called while the shell is up.
   "Start coding" is only enabled once the app is ready.
2. **No minification build.** It would save ~25 kB gz but breaks ADR 0001 ("no build step") and the
   teacher-editable-source goal. Rejected.
3. **Fonts stay on Google Fonts CDN** (no self-hosting): no measurable gain, extra files for teachers.
   But `fontsReady()` must not fetch Cairo in English (-394 ms, -31 kB): load Cairo only when `lang=ar`.
4. Perf budgets are lab estimates (throttled Chromium); real-device field validation is a post-launch TODO.

## Cost of reversal
Low (all CSS/markup/one guard).

## Addendum (2026-10-06) — budgets re-baselined after QUARTZ's re-measure
First-visit LCP is now 0.99–1.10 s (was 3.18 s), CLS at ready 0.0007, INP ≤ 80 ms: DoD #6 passes in the lab.
The remaining misses are *internal* gates, not DoD items. ATLAS re-baselines them to what the pinned
third-party payload makes honest, and does not reopen the minify/self-host rejections:
- English transfer budget: 350 → **360 kB**; English boot-ready: 2.5 → **2.75 s**.
- Arabic (new): transfer **430 kB**, boot-ready **3.2 s**.
- Open follow-up (CIRCUIT-1): Arabic still downloads Nunito (~39 kB) with no DOM text using it; a fourth
  consumer is unfound (steps in docs/perf.md §4). Fixing it is worth ~-0.2 s but is not a release blocker.
- Blockly upgrades must re-run `docs/perf-lab/` (third-party JS budget is 215 kB gz vs 214.1 kB today).

## Addendum 2 (2026-10-07) — final re-baseline after the Arabic re-measure
QUARTZ's final matrix: LCP 1.06–1.21 s (static boot paragraph wins 40/40), CLS ≤ 0.0097 on medians, AR transfer
387.6 kB / boot-ready 2.64 s (both inside the AR budget). Two internal gates sit at their limit, not DoD items:
- English transfer: 360 → **370 kB**. Own CSS gzip gate: 20 → **22 kB** (9.7 kB of the 20.5 kB is rationale comments;
  trimming them is a PRISM nice-to-have, not a release blocker).
- Own JS has ~1.1 kB headroom (68.9 of 70 kB gz): adding features needs a budget conversation first.
- Re-check CLS after any further CSS change (one unreproduced 0.065 AR/412 sample was seen while CSS was mid-edit).
