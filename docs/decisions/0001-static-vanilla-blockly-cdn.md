# 0001 — Static vanilla site, Blockly from a pinned CDN
Date: 2026-10-06 | Status: accepted

## Context
BoltBlocks must run on GitHub Pages: no backend, no build, no npm for users. It needs a real block
editor with Scratch-style rounded blocks, touch drag, RTL, and variables/procedures.

## Options considered
1. Hand-rolled block editor (drag/drop, snapping, C-blocks, touch, RTL, a11y) — months of work.
2. Blockly (Apache-2.0) from jsDelivr with the `zelos` renderer.
3. Scratch-blocks fork — stale, Scratch-branded assets, not on npm CDN in usable form.

## Decision
Option 2, pinned to an exact version (`blockly@13.3.0`) so a CDN-side release can never break the site.
Loaded as four deferred classic scripts: `blockly_compressed.js` (179 kB gz), `blocks_compressed.js`
(15 kB), `javascript_compressed.js` (8 kB), `msg/en.js` (10 kB; `msg/ar.js` 12 kB loaded instead when
Arabic is active). Total third-party JS ≈ 212 kB gz. Everything else is our own vanilla code.
Google Fonts (Nunito, Cairo) are the only other third-party request.

## Consequences
- First load needs network (no offline). Acceptable for a classroom site; a service worker is a
  possible later step, not in scope.
- Blockly's DOM/CSS is not ours: PRISM styles it through documented class hooks and may not fork it.
- SRI hashes are added for the pinned scripts (SENTRY computes them; a wrong hash fails closed).

## Cost of reversal
High if we outgrow Blockly (block definitions are Blockly-JSON). Low for the version pin.
