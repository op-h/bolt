# 0006 — Block text is dark ink, not white (DoD #3 beats the brief's styling note)
Date: 2026-10-06 | Status: accepted

## Context
The brief fixes the category colours and asks for "white bold text" on blocks. Measured WCAG contrast
of white on those exact hexes: events 1.65, motion 2.93, looks 3.68, sound 3.31, pen 2.60, control 1.89,
sensing 2.41, operators 2.31, variables 2.33, myblocks 2.81 — every one fails the 4.5:1 text rule (DoD #3).
Darkening each fill until white passes would abandon the brief's colours entirely.

## Decision
Keep the brief's **exact category hexes** as block fills, rail dots and accents. Block text is bold
ink `#1B1B3A`: contrast 10.05 / 5.68 / 4.51 / 5.01 / 6.39 / 8.77 / 6.89 / 7.20 / 7.13 / 5.90 (same order).
Dropdown/number fields keep the Scratch idiom: white rounded field, ink text. "Bold, thick, rounded" stays.
Looks (#9966FF) is the tightest at 4.51:1 — do not lighten or alter its fill or the ink.
Pen (#00B4A6) is our own addition (ADR 0005), chosen to be distinct from the others.

## Consequences
Blocks look slightly different from Scratch (dark label) but stay bright and playful. If the owner
insists on white text, an ADR must instead specify darker fills and accept that the rail dots no longer
match the specified hexes.

## Cost of reversal
Trivial — two theme constants in `blocks.js` and tokens in `docs/design.md`.
