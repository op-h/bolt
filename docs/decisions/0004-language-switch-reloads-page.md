# 0004 — Switching language autosaves and reloads
Date: 2026-10-06 | Status: accepted

## Context
Blockly's message table (`Blockly.Msg`), block definitions, toolbox labels and RTL flag are
process-global and baked at workspace-injection time. Hot-swapping them leaves stale labels and a
wrongly-mirrored workspace.

## Decision
The EN/AR toggle stores `boltblocks.lang`, flushes an autosave, and calls `location.reload()`.
`<html lang dir>` is stamped by an inline boot script before first paint (no flash of LTR). Arabic
loads `msg/ar.js` instead of `msg/en.js`. Layout mirrors via CSS logical properties; Blockly is
injected with `rtl: true`. Stage coordinates, angles and arithmetic stay LTR.

## Consequences
A ~1 s reload on toggle; no work is lost (autosave first). Far simpler and more reliable than live swap.
