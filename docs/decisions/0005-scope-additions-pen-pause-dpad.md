# 0005 — Small, deliberate additions to the brief
Date: 2026-10-06 | Status: accepted

The brief's lesson 3 is "Draw a square with repeat", but its block list has no way to draw.
ATLAS adds, and records here so nobody mistakes them for creep:

1. **Pen category** (#00B4A6): pen down, pen up, erase all, set pen colour. Required to *draw*.
2. **Pause** button and **slow-motion** toggle on the stage toolbar. The brief says loops must be
   "paused" and that kids must "SEE loops run"; both need a control.
3. **On-screen arrow pad** (toggle) for tablets: "key pressed" lessons are otherwise impossible
   without a keyboard, and the brief requires tablet support.
4. **Hide variable** block next to "show variable".
5. `js/` and `docs/` gain no extra files beyond the brief's structure; i18n lives inside `blocks.js`
   (block text) and `app.js` (UI text); lessons carry their own EN/AR strings.
