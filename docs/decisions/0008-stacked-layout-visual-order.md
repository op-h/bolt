# 0008 — Stage-above-workspace in the 700–1023 px stacked layout is intentional
Date: 2026-10-07 | Status: accepted

## Context
SENTRY (W6): at 700–1023 px the stage panel is visually above the editor while the DOM (and tab) order is
editor first, then stage. WCAG 2.4.3 asks for a meaningful focus order.

## Decision
Keep it. A child sees the stage (the result) first and builds below it, like Scratch on small screens;
reordering the DOM would put the 480×360 canvas before the toolbox for screen-reader users on desktop too.
Both regions are labelled landmarks with skip links ("Skip to the workspace" / "Skip to the stage"), every
control is reachable, and the tab sequence (editor → stage controls → sprites) stays logical and
predictable at every width. Below 700 px the layout is stacked with the same order.

## Consequences
Recorded as an accepted, documented deviation from strict visual/DOM order. Revisit if user testing with
keyboard or switch users shows confusion.
