# 0003 — Run blocks as generator functions (async step-runner), not JS-Interpreter
Date: 2026-10-06 | Status: accepted

## Context
Kids' programs must animate step by step, be paused and stopped instantly, and never freeze the tab.
The brief allows "JS-Interpreter (or an async step-runner)".

## Options considered
1. JS-Interpreter (~35 kB gz): real sandbox, no `eval`; slow (tens of x), needs native-function
   wrappers for every runtime call, and async things (ask, wait, glide, parallel threads) need
   hand-rolled blocking plumbing anyway.
2. Generators: block generators emit `function*` bodies; every statement block emits
   `yield rt.step(id)` and every loop emits a frame-yield per iteration. Our own scheduler resumes
   each thread (one per hat script, per sprite) with a per-frame time budget. 0 kB dependency.

## Decision
Option 2. Pause = scheduler stops resuming; Stop = `generator.return()` on every thread; highlight
= the `step` token. Concurrency (green flag runs all scripts in parallel) is natural.

## Consequences / security
- Generated code is compiled with `new Function`, which needs `script-src 'unsafe-eval'` in any CSP
  (SENTRY records this knowingly). To make that safe, **every generator must emit only
  `JSON.stringify(string)` / `Number()`-coerced literals and rt.* calls — never raw field text** —
  and projects loaded from user-supplied .json go through a block-type whitelist before loading.
  SENTRY fuzzes this (`");alert(1)//` in every text field and in uploaded project JSON).
- Infinite recursion in a custom block surfaces as `RangeError` → friendly toast, not a freeze.

## Cost of reversal
Medium: generators.js + runtime.js would be re-targeted at an interpreter; blocks.js unaffected.
