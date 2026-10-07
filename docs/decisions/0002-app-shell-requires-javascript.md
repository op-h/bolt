# 0002 — BoltBlocks is an app shell; JavaScript is required
Date: 2026-10-06 | Status: accepted

## Context
Definition of Done #1 says content and primary navigation work with JS disabled unless ATLAS records
an app-shell ADR. A block-coding editor *is* a program: dragging blocks, running them on a canvas and
saving projects have no meaningful non-JS equivalent.

## Decision
This project is declared an **app shell**. DoD #1 is relaxed for the editor *only*. It is replaced by:
- the HTML shell paints immediately (header, mascot, title) before any script runs, so LCP never
  waits for Blockly;
- a `<noscript>` block explains, in English and Arabic, that BoltBlocks needs JavaScript, shows Bolt,
  and links to the README;
- all other DoD items (keyboard, contrast, targets, 320–2560 no-scroll, motion/colour-scheme, CWV,
  zero console errors, no secrets) apply unchanged.

## Consequences
SEO/metadata must carry the discoverable content (BEACON), since crawlers see only the shell.

## Cost of reversal
n/a — inherent to the product.
