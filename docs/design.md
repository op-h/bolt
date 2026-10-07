# BoltBlocks design plan and token system (MUSE)

Owner: MUSE. Consumers: PRISM (all CSS), GRANITE (markup, inline sprites), CIRCUIT-1 (Blockly theme
constants), CIRCUIT-2 (canvas text, i18n), QUARTZ (fonts), SENTRY (contrast and motion checks).
Contract references: `docs/architecture.md` §3, §5, §9 and ADRs 0001 to 0006.

Design read: kids' app shell (ages 7 to 14), playful but clean, trust-first on contrast, with a toy-brick
language, built in native CSS with custom properties. No design system package, no animation library,
no icon library (the brief and architecture §9 require our own art).
Dials, reasoned from the brief: DESIGN_VARIANCE 4 (a tool must be predictable, so symmetry and a stable grid),
MOTION_INTENSITY 4 (feedback and state only), VISUAL_DENSITY 5 (a workspace needs room, not a gallery).

Skills used: `design-taste-frontend` for the anti-slop checks (one accent, one radius system, one theme per
page, motion must be motivated, contrast audit of every button and form). Its stack advice (React, Tailwind,
Motion, GSAP, icon packages) is rejected by CLAUDE.md precedence. No `design-md-library` brand was imported:
the brief asks for 100% original branding, and copying a real brand's system would work against that.

---

## 1. Concept: the Brick Workshop

BoltBlocks looks like a workbench of snap-together toy bricks. Every interactive thing is a flat, brightly
coloured slab with a thick ink outline (`#1B1B3A`) and a hard "lip" shadow under it, the way a moulded brick
has a visible bottom edge. Pressing a control collapses the lip (the slab moves down by the lip height), so
the push is felt without any blur or glow. Colour carries meaning and nothing else: the ten block categories
own the rainbow, and the whole interface around them is calm periwinkle-white with ink text, so the blocks
are always the loudest objects on screen. One brand accent, Bolt Yellow `#FFD60A`, is reserved for the
primary action and for Bolt himself, and it is never used alone on white (it always sits inside an ink
outline). The mascot, the sprites, the icons and the logo share the same ink outline and the same rounded
geometry, so art and UI read as one set. At night the workshop turns into deep indigo: same bricks, same
outlines, same yellow, only the surfaces and the edge colour change.

The one idea: **ink outline plus collapsing lip**. If a surface does not have an edge and a lip, it is not
interactive.

Rules that keep it honest:
1. One accent (Bolt Yellow). Every other hue is a block category, a state colour (danger, success), or Bolt.
2. One radius system (section 6). Controls are pills, panels are 20px, dialogs 28px, never mixed.
3. One theme per page. The two themes share structure, edges and accent, and differ only in surfaces.
4. Colour is never the only signal. Selected, pressed, running and done states also change shape
   (thicker edge, collapsed lip, check icon, ring).
5. No decoration without a job: no gradients on UI, no blur, no glow except the "running block" state.
6. No emoji and no real-product imagery. All art is original (assets listed in section 14).

---

## 2. Tokens as CSS custom properties

PRISM: paste this block into `@layer tokens`. Dark values must exist twice (attribute form and the
no-attribute media fallback). `<html data-theme>` is stamped by the boot script; the media query only
covers the case where it is absent. `light-dark()` is deliberately not used (older tablets).

```css
@layer tokens {
  /* ---------- theme independent ---------- */
  :root {
    /* block categories: EXACT hexes from architecture.md section 5, order = toolbox order */
    --cat-events:    #FFBF00;
    --cat-motion:    #4C97FF;
    --cat-looks:     #9966FF;
    --cat-sound:     #CF63CF;
    --cat-pen:       #00B4A6;
    --cat-control:   #FFAB19;
    --cat-sensing:   #5CB1D6;
    --cat-operators: #59C059;
    --cat-variables: #FF8C1A;
    --cat-myblocks:  #FF6680;
    --ink-on-cat:    #1B1B3A;            /* ADR 0006: bold ink text on every category fill */
    --bb-block-edge: #1B1B3A;            /* block and rail-dot outline, both themes */

    /* focus: two bands, ink inside + white outside; see section 4 for why this passes everywhere */
    --bb-focus-inner: #1B1B3A;
    --bb-focus-outer: #FFFFFF;
    --bb-focus-inner-w: 2px;
    --bb-focus-outer-w: 3px;

    /* block states (Blockly SVG paths) */
    --bb-select-edge: #1B1B3A;           /* selected block: ink stroke + white halo */
    --bb-select-halo: #FFFFFF;
    --bb-running-edge: #1B1B3A;          /* running block: ink stroke + Bolt Yellow halo */
    --bb-running-glow: #FFD60A;

    /* Bolt palette, for reference and for recolouring art */
    --bolt-body: #4C97FF; --bolt-shade: #2F6FD6; --bolt-accent: #FFD60A; --bolt-eye: #8DF5E4;

    /* fixed icon colours (i-flag, i-stop), see assets/icons.svg */
    --bb-flag: #19A051;
    --bb-stop: #E5383B;

    /* ---------- type ---------- */
    --bb-font-ui: "Nunito", ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, -apple-system, sans-serif;
    --bb-font-ar: "Cairo", "Segoe UI", Tahoma, system-ui, sans-serif;
    --bb-font: var(--bb-font-ui);
    --bb-fw-body: 600;
    --bb-fw-ui: 700;
    --bb-fw-display: 800;
    /* fluid, minor-third-ish ratio (1.2), rem-based so browser zoom and text-size settings scale it */
    --bb-text-xs:  clamp(0.8125rem, 0.79rem + 0.10vw, 0.875rem);   /* 13 to 14  toolbox labels, hints */
    --bb-text-sm:  clamp(0.875rem,  0.85rem + 0.12vw, 0.9375rem);  /* 14 to 15  field labels, menu */
    --bb-text-base:clamp(1rem,      0.96rem + 0.20vw, 1.125rem);   /* 16 to 18  body, buttons */
    --bb-text-md:  clamp(1.125rem,  1.06rem + 0.30vw, 1.3125rem);  /* 18 to 21  lesson goal, dialog lead */
    --bb-text-lg:  clamp(1.3125rem, 1.20rem + 0.55vw, 1.625rem);   /* 21 to 26  panel and dialog titles */
    --bb-text-xl:  clamp(1.625rem,  1.40rem + 1.00vw, 2.25rem);    /* 26 to 36  welcome title */
    --bb-text-2xl: clamp(2rem,      1.60rem + 1.80vw, 3.25rem);    /* 32 to 52  celebration */
    --bb-lh-tight: 1.2;
    --bb-lh-body:  1.5;
    /* Arabic needs more leading: the lang rule in section 9 swaps these */

    /* ---------- space (4px base, rem) ---------- */
    --bb-space-1: 0.25rem;  --bb-space-2: 0.5rem;   --bb-space-3: 0.75rem;
    --bb-space-4: 1rem;     --bb-space-5: 1.25rem;  --bb-space-6: 1.5rem;
    --bb-space-8: 2rem;     --bb-space-10: 2.5rem;  --bb-space-12: 3rem;   --bb-space-16: 4rem;

    /* ---------- size ---------- */
    --bb-hit: 2.75rem;          /* 44px primary targets */
    --bb-hit-min: 1.5rem;       /* 24px absolute floor (sprite-delete uses 1.75rem) */
    --bb-edge-w: 3px;           /* chunky outline: buttons, panels, stage frame */
    --bb-edge-w-thin: 2px;      /* inputs, chips, list rows */
    --bb-lip: 4px;              /* lip height of small controls (see shadows) */
    --bb-topbar-h: 4rem;        /* 64px, single line on desktop, max 80 */
    --bb-rail-w: 5.5rem;        /* 88px toolbox rail on >= 700px */
    --bb-rail-w-compact: 3.5rem;/* 56px icon-only rail below 700px */
    --bb-icon: 1.5rem;          /* 24px default .icon; 1.25rem in dense rows */

    /* ---------- radius ---------- */
    --bb-r-sm: 0.5rem;     /* 8px   chips, menu items, tooltips */
    --bb-r-md: 0.875rem;   /* 14px  inputs, sprite tiles, toasts */
    --bb-r-lg: 1.25rem;    /* 20px  panels, stage frame, workspace panel */
    --bb-r-xl: 1.75rem;    /* 28px  dialogs, celebration card */
    --bb-r-pill: 999px;    /* every button and toggle */

    /* ---------- elevation: brick lips, ink-tinted, never pure black ---------- */
    --bb-shadow-0: none;
    --bb-shadow-1: 0 2px 0 var(--bb-lip-color);                                    /* chips, inputs */
    --bb-shadow-2: 0 4px 0 var(--bb-lip-color);                                    /* buttons, tiles */
    --bb-shadow-3: 0 6px 0 var(--bb-lip-color), 0 14px 24px -10px var(--bb-shadow-soft);   /* panels, menus */
    --bb-shadow-4: 0 8px 0 var(--bb-lip-color), 0 28px 48px -14px var(--bb-shadow-soft);   /* dialogs, toasts */
    --bb-shadow-pressed: 0 0 0 var(--bb-lip-color);                                /* with translateY(var(--bb-lip)) */

    /* ---------- motion ---------- */
    --bb-dur-instant: 80ms;    /* colour/lip response to pointer */
    --bb-dur-fast: 140ms;      /* hover, toggles, rail selection */
    --bb-dur-base: 220ms;      /* menus, toasts, dialog open */
    --bb-dur-slow: 380ms;      /* panel show/hide, lesson step change */
    --bb-dur-cheer: 1800ms;    /* celebration one-shot */
    --bb-dur-pulse: 1200ms;    /* running-block glow, the only infinite loop */
    --bb-ease-out: cubic-bezier(0.16, 1, 0.3, 1);        /* entrances */
    --bb-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);    /* panel moves */
    --bb-ease-boing: cubic-bezier(0.34, 1.56, 0.64, 1);  /* small overshoot: toast, Bolt pop, chips */

    /* ---------- z-index (systemic layers only) ---------- */
    --bb-z-rail: 1;  --bb-z-topbar: 20;  --bb-z-menu: 30;  --bb-z-notice: 25;  --bb-z-toast: 50;
    /* native <dialog> uses the top layer and ignores z-index; see risk R4 for toasts over dialogs */
  }

  /* ---------- LIGHT ---------- */
  :root, :root[data-theme="light"] {
    color-scheme: light;
    --bb-ground:        #E9EDFF;   /* page behind panels */
    --bb-surface:       #FFFFFF;   /* top bar, buttons, dialogs, menus */
    --bb-panel:         #F6F7FF;   /* stage, sprite and lesson panels */
    --bb-ink:           #1B1B3A;
    --bb-ink-muted:     #4B4F80;
    --bb-line:          #CDD2F0;   /* decorative dividers only (not a boundary) */
    --bb-line-strong:   #6F74A8;   /* quiet control boundary, >= 3:1 */
    --bb-edge:          #1B1B3A;   /* chunky outline */
    --bb-lip-color:     #1B1B3A;
    --bb-accent:        #FFD60A;   /* Bolt Yellow: primary action fill */
    --bb-accent-hover:  #FFE45C;
    --bb-accent-ink:    #1B1B3A;
    --bb-inverse-bg:    #1B1B3A;   /* pressed toggles */
    --bb-inverse-ink:   #FFFFFF;
    --bb-danger:        #C4262E;
    --bb-danger-ink:    #FFFFFF;
    --bb-success:       #17713A;
    --bb-success-ink:   #FFFFFF;
    --bb-input-bg:      #FFFFFF;
    --bb-workspace:     #FAFBFF;
    --bb-grid:          #D3D9F3;
    --bb-toolbox:       #FFFFFF;
    --bb-flyout:        #E9EDFF;
    --bb-stage-bg:      #FFFFFF;   /* canvas backing: white in BOTH themes, sprites are drawn for it */
    --bb-stage-frame:   #1B1B3A;
    --bb-scroll:        #6F74A8;
    --bb-scrim:         rgb(27 27 58 / 0.55);
    --bb-shadow-soft:   rgb(27 27 58 / 0.28);
  }

  /* ---------- DARK ---------- */
  :root[data-theme="dark"] {
    color-scheme: dark;
    --bb-ground:        #12122B;
    --bb-surface:       #1C1C3F;
    --bb-panel:         #232350;
    --bb-ink:           #F2F3FF;
    --bb-ink-muted:     #B7BBE6;
    --bb-line:          #34346E;
    --bb-line-strong:   #7C81C0;
    --bb-edge:          #7C81C0;
    --bb-lip-color:     #0A0A20;
    --bb-accent:        #FFD60A;
    --bb-accent-hover:  #FFE45C;
    --bb-accent-ink:    #1B1B3A;
    --bb-inverse-bg:    #F2F3FF;
    --bb-inverse-ink:   #1B1B3A;
    --bb-danger:        #FF8A8A;
    --bb-danger-ink:    #1B1B3A;
    --bb-success:       #5EE08A;
    --bb-success-ink:   #1B1B3A;
    --bb-input-bg:      #12122B;
    --bb-workspace:     #181838;
    --bb-grid:          #2F2F63;
    --bb-toolbox:       #1C1C3F;
    --bb-flyout:        #2A2A5E;
    --bb-stage-bg:      #FFFFFF;
    --bb-stage-frame:   #7C81C0;
    --bb-scroll:        #7C81C0;
    --bb-scrim:         rgb(5 5 18 / 0.72);
    --bb-shadow-soft:   rgb(2 2 12 / 0.6);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme]) {
      /* byte-for-byte the same declarations as :root[data-theme="dark"] above; keep in sync (SENTRY diffs them) */
      color-scheme: dark;
      --bb-ground: #12122B;  --bb-surface: #1C1C3F;  --bb-panel: #232350;
      --bb-ink: #F2F3FF;     --bb-ink-muted: #B7BBE6;
      --bb-line: #34346E;    --bb-line-strong: #7C81C0;  --bb-edge: #7C81C0;  --bb-lip-color: #0A0A20;
      --bb-accent: #FFD60A;  --bb-accent-hover: #FFE45C; --bb-accent-ink: #1B1B3A;
      --bb-inverse-bg: #F2F3FF;  --bb-inverse-ink: #1B1B3A;
      --bb-danger: #FF8A8A;  --bb-danger-ink: #1B1B3A;
      --bb-success: #5EE08A; --bb-success-ink: #1B1B3A;
      --bb-input-bg: #12122B;
      --bb-workspace: #181838;  --bb-grid: #2F2F63;  --bb-toolbox: #1C1C3F;  --bb-flyout: #2A2A5E;
      --bb-stage-bg: #FFFFFF;   --bb-stage-frame: #7C81C0;  --bb-scroll: #7C81C0;
      --bb-scrim: rgb(5 5 18 / 0.72);  --bb-shadow-soft: rgb(2 2 12 / 0.6);
    }
  }

  /* Arabic: Cairo first, more leading, never letter-spacing (it breaks Arabic joining) */
  :root:lang(ar) { --bb-font: var(--bb-font-ar); --bb-lh-tight: 1.35; --bb-lh-body: 1.75; }
}
```

Token naming promise: PRISM and others consume only `--bb-*`, `--cat-*`, `--ink-on-cat`, `--bolt-*`. No raw hex
outside this block (the SVG art files carry literal hexes by design, because they are inlined and must not
depend on page CSS).

---

## 3. Colour roles

| Role | Light | Dark | Used for |
|---|---|---|---|
| `--bb-ground` | #E9EDFF | #12122B | page background, flyout in light |
| `--bb-surface` | #FFFFFF | #1C1C3F | top bar, buttons, menus, dialogs, toolbox |
| `--bb-panel` | #F6F7FF | #232350 | stage panel, sprite panel, lesson panel |
| `--bb-workspace` | #FAFBFF | #181838 | Blockly canvas |
| `--bb-toolbox` | #FFFFFF | #1C1C3F | category rail |
| `--bb-flyout` | #E9EDFF | #2A2A5E | block flyout |
| `--bb-stage-bg` | #FFFFFF | #FFFFFF | canvas backing (always white) |
| `--bb-stage-frame` | #1B1B3A | #7C81C0 | 4px frame around the stage |
| `--bb-grid` | #D3D9F3 | #2F2F63 | workspace dot grid (decorative) |
| `--bb-ink` | #1B1B3A | #F2F3FF | all text |
| `--bb-ink-muted` | #4B4F80 | #B7BBE6 | secondary text, placeholders (still >= 4.5) |
| `--bb-line` | #CDD2F0 | #34346E | dividers that are NOT the only boundary |
| `--bb-line-strong` | #6F74A8 | #7C81C0 | input borders, scrollbar handles |
| `--bb-edge` | #1B1B3A | #7C81C0 | the chunky outline |
| `--bb-accent` / `-ink` | #FFD60A / #1B1B3A | same | primary button |
| `--bb-inverse-bg` / `-ink` | #1B1B3A / #FFFFFF | #F2F3FF / #1B1B3A | pressed toggle (`aria-pressed="true"`) |
| `--bb-danger` / `-ink` | #C4262E / #FFFFFF | #FF8A8A / #1B1B3A | delete, errors |
| `--bb-success` / `-ink` | #17713A / #FFFFFF | #5EE08A / #1B1B3A | done states |

Category tokens are the brief's exact hexes (architecture.md section 5) and are identical in both themes.
`--ink-on-cat: #1B1B3A` is the only text colour allowed on a category fill (ADR 0006).

Button recipes (PRISM implements, tokens are the contract):
- Primary: `background: --bb-accent; color: --bb-accent-ink; border: 3px solid --bb-edge; box-shadow: --bb-shadow-2`. Hover: `--bb-accent-hover`.
- Secondary: `--bb-surface` fill, `--bb-ink` text, same edge and lip.
- Toggle pressed: `--bb-inverse-bg` / `--bb-inverse-ink`, lip collapsed, `aria-pressed="true"`.
- Danger: `--bb-danger` fill, `--bb-danger-ink` text.
- Disabled: `--bb-panel` fill, `--bb-ink-muted` text, `--bb-line-strong` edge, no lip, `cursor: not-allowed`.
  WCAG exempts disabled controls; muted ink on panel still measures 7.31 (light) and 7.89 (dark).
- Press: `:active { transform: translateY(var(--bb-lip)); box-shadow: var(--bb-shadow-pressed); }`.
- Links in prose: `--bb-ink`, 2px underline, `text-underline-offset: 0.2em`; hover swaps the underline to `--bb-accent` with
  an ink `text-decoration-color` fallback. No coloured link text, so there is no extra colour pair to pass.

---

## 4. Focus ring (contrast by construction)

One ring, both themes, two bands: an ink band adjacent to the element and a white band outside it.
Wherever the ring is drawn, at least one band is >= 3:1 against what is behind it:
over light surfaces the ink band carries (>= 14:1), over dark surfaces the white band carries (>= 13:1), and
over every category fill the ink band carries (>= 4.51:1, the tightest being Looks).

```css
:focus-visible {
  outline: var(--bb-focus-outer-w) solid var(--bb-focus-outer);
  outline-offset: var(--bb-focus-inner-w);
  box-shadow: 0 0 0 var(--bb-focus-inner-w) var(--bb-focus-inner);   /* sits inside the offset gap */
}
@media (forced-colors: active) {
  :focus-visible { outline: 3px solid Highlight; box-shadow: none; }
}
```
Notes: `box-shadow` focus must be appended to (not replace) the lip shadow, so PRISM composes
`box-shadow: <ring>, var(--bb-shadow-2)`. Never `outline: none` without this replacement. Focus must not be
clipped by `overflow: hidden` ancestors (give scroll containers 6px inner padding or use `outline-offset`
negative only on rows inside lists, with the same two bands drawn inset).
Blockly ships its own focus classes (`.blocklyActiveFocus`, `.blocklyFocusRing`, `.blocklyWorkspaceFocusRing`,
`.blocklyPassiveFocus`, all present in the pinned 13.3.0 bundle): restyle them to the same two bands (section 11).

---

## 5. Contrast table (measured, WCAG 2.x relative luminance)

Method: sRGB channels linearised with the WCAG formula, L = 0.2126 R + 0.7152 G + 0.0722 B, ratio
(L1 + 0.05) / (L2 + 0.05). Key luminances: ink #1B1B3A 0.01322, white 1.0, Looks #9966FF 0.23495 (cross-checked
against ADR 0006: 4.51), Bolt Yellow 0.69366. Category L values are back-derived from ADR 0006's published
ratios and spot-checked (Looks recomputed from the hex). Ratios are rounded to two decimals. Targets: text 4.5,
UI or graphics 3.0. A value of "n/a" means the pair is intentionally not used.

### 5.1 Text on theme surfaces

| Pair | Light | Dark | Target | Result |
|---|---|---|---|---|
| ink on ground | 14.25 | 16.59 | 4.5 | pass |
| ink on surface | 16.61 | 14.79 | 4.5 | pass |
| ink on panel | 15.55 | 13.33 | 4.5 | pass |
| ink on workspace (flyout labels, comments) | 16.06 | 15.52 | 4.5 | pass |
| ink on flyout | 14.25 | 11.96 | 4.5 | pass |
| ink on input background | 16.61 | 16.59 | 4.5 | pass |
| ink-muted on ground | 6.70 | 9.82 | 4.5 | pass |
| ink-muted on surface | 7.80 | 8.75 | 4.5 | pass |
| ink-muted on panel | 7.31 | 7.89 | 4.5 | pass |
| ink-muted on flyout | 6.70 | 7.08 | 4.5 | pass |
| accent-ink (#1B1B3A) on accent #FFD60A | 11.76 | 11.76 | 4.5 | pass |
| accent-ink on accent-hover #FFE45C | 13.05 | 13.05 | 4.5 | pass |
| inverse-ink on inverse-bg (pressed toggle) | 16.61 | 15.06 | 4.5 | pass |
| danger-ink on danger fill | 5.73 | 7.32 | 4.5 | pass |
| danger as text on surface | 5.73 | 7.19 | 4.5 | pass |
| danger as text on ground | 4.92 | 8.06 | 4.5 | pass |
| danger as text on panel | 5.37 | 6.48 | 4.5 | pass |
| danger as text on flyout | n/a | 5.81 | 4.5 | pass |
| success-ink on success fill | 6.07 | 9.89 | 4.5 | pass |
| success as text on surface | 6.07 | 9.71 | 4.5 | pass |
| success as text on ground | 5.21 | 10.89 | 4.5 | pass |
| success as text on panel | 5.68 | 8.75 | 4.5 | pass |
| logo.svg wordmark "Bolt" (ink) on white | 16.61 | n/a | 4.5 | pass |
| logo.svg wordmark "Blocks" #2F6FD6 on white | 4.81 | n/a | 4.5 | pass (use only on light) |

Dark-theme app header uses live text plus `logo-mark`, not `logo.svg`, so the two-colour wordmark is never on dark.

### 5.2 Text on block categories (`--ink-on-cat` #1B1B3A, from ADR 0006, Looks re-verified)

| Category | Fill | Ratio | Target | Result |
|---|---|---|---|---|
| events | #FFBF00 | 10.05 | 4.5 | pass |
| motion | #4C97FF | 5.68 | 4.5 | pass |
| looks | #9966FF | 4.51 | 4.5 | pass (tightest; do not alter fill or ink) |
| sound | #CF63CF | 5.01 | 4.5 | pass |
| pen | #00B4A6 | 6.39 | 4.5 | pass |
| control | #FFAB19 | 8.77 | 4.5 | pass |
| sensing | #5CB1D6 | 6.89 | 4.5 | pass |
| operators | #59C059 | 7.20 | 4.5 | pass |
| variables | #FF8C1A | 7.13 | 4.5 | pass |
| myblocks | #FF6680 | 5.90 | 4.5 | pass |
| block field (white) with ink text | #FFFFFF | 16.61 | 4.5 | pass |
| selected rail row, light: category 24% over white, ink text | Looks mix 12.56, Events mix 14.59 | | 4.5 | pass |
| selected rail row, dark: category 30% over `--bb-surface`, `--bb-ink` text | Events mix 7.34 (worst), Looks mix 9.71 | | 4.5 | pass |

### 5.3 UI components and graphics (3:1)

| Pair | Light | Dark | Target | Result |
|---|---|---|---|---|
| `--bb-edge` vs surface | 16.61 | 4.47 | 3 | pass |
| `--bb-edge` vs ground | 14.25 | 5.02 | 3 | pass |
| `--bb-edge` vs panel | 15.55 | 4.03 | 3 | pass |
| `--bb-edge` vs workspace | 16.06 | 4.69 | 3 | pass |
| `--bb-edge` vs flyout | 14.25 | 3.62 | 3 | pass (tightest dark edge) |
| `--bb-line-strong` vs surface | 4.43 | 4.47 | 3 | pass |
| `--bb-line-strong` vs ground | 3.80 | 5.02 | 3 | pass |
| `--bb-line-strong` vs panel | 4.15 | 4.03 | 3 | pass |
| `--bb-line-strong` vs workspace (scrollbar handle) | 4.29 | 4.69 | 3 | pass |
| `--bb-line-strong` vs flyout (scrollbar handle) | 3.80 | 3.62 | 3 | pass |
| Bolt Yellow button vs panel (dark, no edge needed) | n/a | 10.40 | 3 | pass |
| Bolt Yellow vs light surfaces | 1.41 vs white | n/a | 3 | **fails alone**, so the ink edge is mandatory (edge vs yellow 11.76) |
| category fill vs light workspace (#FAFBFF), fill alone | 1.60 (events) to 3.56 (looks) | n/a | 3 | **fails alone for 8 of 10**, so the ink block edge (16.06 vs workspace) is mandatory |
| category fill vs dark workspace | n/a | 4.65 (looks) to 10.36 (events) | 3 | pass without edge |
| category fill vs dark flyout | n/a | 3.58 (looks) to 7.98 (events) | 3 | pass (flyout must stay <= L 0.045) |
| `i-flag` green #19A051 vs white / dark panel / dark workspace | 3.40 | 4.33 / 5.04 | 3 | pass |
| `i-stop` red #E5383B vs white / dark panel / dark flyout | 4.23 | 3.47 / 3.12 | 3 | pass |
| confetti, sparkles, grid | decorative | decorative | none | exempt |

### 5.4 Focus, selection and running states

| Pair | Value | Target | Result |
|---|---|---|---|
| focus ink band vs surface / ground / panel / workspace / flyout (light) | 16.61 / 14.25 / 15.55 / 16.06 / 14.25 | 3 | pass |
| focus ink band vs each category fill: events, motion, looks, sound, pen, control, sensing, operators, variables, myblocks | 10.05, 5.68, **4.51**, 5.01, 6.39, 8.77, 6.89, 7.20, 7.13, 5.90 | 3 | pass |
| focus white band vs dark ground / workspace / surface / panel / flyout | 18.30 / 17.12 / 16.31 / 14.71 / 13.20 | 3 | pass |
| focus ink band vs Bolt Yellow button fill | 11.76 | 3 | pass |
| selected-block ink stroke vs each category fill | same as ink band row (min 4.51) | 3 | pass |
| selected-block white halo vs dark workspace / flyout | 17.12 / 13.20 | 3 | pass |
| running-block ink stroke vs each category fill | min 4.51 (Looks), max 10.05 | 3 | pass |
| running-block ink stroke vs light workspace / flyout | 16.06 / 14.25 | 3 | pass |
| running-block yellow glow vs dark workspace / flyout | 12.12 / 9.35 | 3 | pass |
| running-block yellow glow vs light workspace | 1.41 (decorative halo; the ink stroke carries) | n/a | by design |

The glow cannot be a single colour that beats every category fill (white fails Events at 1.65, Yellow fails
Events too), which is why the running state is "ink stroke (always visible) + yellow halo (adds energy)" and
also thickens the stroke (3px vs 1.5 to 2px) so it is not colour-only.

---

## 6. Typography

- UI: **Nunito** (Latin), weights 600 (body), 700 (UI labels), 800 (headings, block text, wordmark).
  Arabic: **Cairo**, same three weights. Two families, three weights each, loaded from Google Fonts with
  `display=swap` (ADR 0001): one request such as
  `family=Nunito:wght@600;700;800&family=Cairo:wght@600;700;800&display=swap`. Google's CSS splits the files by
  `unicode-range`, so an English session downloads only the Latin Nunito files plus the Arabic Cairo file if an Arabic
  glyph is on screen. The language button label "العربية" is Arabic, so on English pages it will pull the Cairo
  Arabic subset. QUARTZ decides whether to accept that (small) cost or to render the label from a system
  Arabic face.
- Fallbacks are system-only (no extra download): `ui-rounded`, `Segoe UI`, `system-ui`. QUARTZ owns the
  metric-matched fallback (`size-adjust` and `ascent-override` for a local font) to limit CLS; MUSE does not
  invent those numbers. TODO(measure): QUARTZ.
- Scale: fluid `clamp()` tokens in section 2 (13 to 52px). Body is 16 to 18px (kids, tablets), nothing below 13px.
  Line height 1.5 (1.75 Arabic). Headings 1.2 (1.35 Arabic).
- Block text: weight 800, Blockly SVG size 14px at zoom 1 (CIRCUIT-1 sets it in the theme font style), ink
  `#1B1B3A`. Toolbox labels: `--bb-text-xs`, weight 800.
- Numbers: Western digits everywhere (stage coordinates, block fields, sprite inputs), including in Arabic UI, so
  a lesson that says "move 10 steps" matches the block text. Use `font-variant-numeric: tabular-nums` on the
  four sprite inputs where the font supports it.
- Do not use letter-spacing anywhere in Arabic. Do not use uppercase transforms (not meaningful in Arabic and
  noisy for early readers).
- Blockly measures text when it draws a block. **Risk R1:** if the web font arrives after `Blockly.inject`, block widths
  are computed with the fallback font and look slightly off. Mitigation for CIRCUIT-2: before injecting, await
  `document.fonts.load('800 14px Nunito')` (and the Cairo equivalent in Arabic) with a 1.5 s timeout, then inject.

---

## 7. Space, radius, elevation, motion (usage)

Space: 4px base. Page gutter `--bb-space-3` (12px) below 700, `--bb-space-4` above. Panel padding `--bb-space-4`;
control gap `--bb-space-2`; panel gap `--bb-space-3`; dialog padding `--bb-space-6`.

Radius rule (documented, so it is a system and not a mix): buttons, toggles, chips, rail rows and tabs are `pill`;
inputs, toasts, sprite tiles and menus are `md`; panels, stage frame, workspace panel, lesson dock are `lg`;
dialogs and the celebration card are `xl`; list rows inside menus are `sm`. Block geometry is Zelos' own
(rounded, thick); do not restyle its corner radii in CSS.

Elevation: only hard lips (section 2). `shadow-1` chips and inputs, `shadow-2` buttons and sprite tiles,
`shadow-3` panels and menus, `shadow-4` dialogs, toasts, celebration. Soft secondary shadows use
`--bb-shadow-soft` (ink-tinted, never black). No blur-only shadows, no glass, no gradients in UI.

Motion (what each is for):
- lip collapse and colour on press: `--bb-dur-instant`, `--bb-ease-out` (feedback).
- hover lift (`translateY(-1px)`) and toggles: `--bb-dur-fast` (feedback).
- rail category selection, menu open: `--bb-dur-base`, `--bb-ease-out` (state change).
- toast in (rises 8px and fades), lesson step highlight, sprite tile select: `--bb-dur-base`, `--bb-ease-boing` (acknowledgement).
- dialog open: scale 0.96 to 1 and fade, `--bb-dur-base`, `--bb-ease-out`; backdrop fade only.
- lesson panel show/hide: `--bb-dur-slow`, `--bb-ease-in-out` (state change).
- running-block halo pulse: `--bb-dur-pulse` infinite, opacity of the halo only (state indicator; the only loop).
- celebration: confetti fall and Bolt `bolt-cheer` pop, `--bb-dur-cheer`, one-shot (reward).
- Animate `transform` and `opacity` only for UI chrome, never layout properties. The one exception is the running-block
  halo pulse, which animates the `drop-shadow` of a single element at a time; if QUARTZ measures jank on the target
  Android, ship the static halo and drop the pulse (the state stays legible without it).

Under `@media (prefers-reduced-motion: reduce)` (and design for it first, it is the baseline):
- all `--bb-dur-*` collapse to `0.01ms` and `scroll-behavior` is `auto`;
- dropped: hover lift, lip travel (the lip shows collapsed instantly), toast rise and boing, dialog scale, panel
  slides, Bolt pop, confetti (CIRCUIT-2 already adds no `.confetti-piece`; the celebration card shows a static
  row of `i-star` icons instead), halo pulse;
- kept: instant colour and shadow state changes, focus ring, the static ink stroke + yellow halo on the running block
  (so "running" stays visible without motion), toast and celebration still appear (opacity step, no movement) and
  still announce through their live regions;
- not affected: the stage canvas animation. Sprite motion is the kid's program and is content, not UI chrome.
  The slow-motion toggle (`#btn-speed`) is the user's own control for it.
Also honour `forced-colors` (focus rule in section 4; edges use `CanvasText`) and keep every
interactive state expressible without colour.

---

## 8. Iconography and art

Icons (`assets/icons.svg`): 24px grid, 2.5 stroke, round caps and joins, `currentColor`, symbol-level attributes so the
file can be inlined verbatim. Use `<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-..."/></svg>`.
PRISM: size with `inline-size/block-size: var(--bb-icon)`, set `color` only, never `fill` or `stroke` on `.icon`.
`i-flag` and `i-stop` carry fixed colours with a `currentColor` outline. `i-play`, `i-pause`, `i-star` are filled.
Icon-only buttons are 44 x 44 with an `aria-label` (GRANITE).

Directional icons in RTL: mirror `i-chevron-left` and `i-chevron-right` with
`[dir="rtl"] .icon--dir { transform: scaleX(-1); }` (GRANITE adds `icon--dir` where the chevron means
"back/next", e.g. lesson hints). Do **not** mirror: `i-play`, `i-flag`, `i-turtle`, `i-rabbit`, `i-download`,
`i-upload`, and the D-pad arrows (they are physical directions on a keyboard and on the stage).
Stage toolbar icons (flag, pause, stop, turtle, rabbit, gamepad) sit on `--bb-surface` buttons.

Mascot Bolt (`assets/bolt.svg`, `assets/bolt-symbols.svg`): original round blue robot with a dark screen face,
hex-nut ears, a lightning-bolt antenna and a puzzle-block chest panel. Poses: `bolt-happy`, `bolt-think` (head tilt,
thought dots, hand up), `bolt-cheer` (both arms up, open mouth, sparkles), `bolt-wave`. Literal colours, no
gradients, no ids except the symbol ids, no `<style>`: inline verbatim. Size: 72 to 96px in the lesson dock,
96 to 128px in dialogs, up to 160px in the celebration and welcome.

`logo-mark` (viewBox 48): a blue puzzle block with a yellow bolt. Header lockup: `logo-mark` 40px + live text
"BoltBlocks" in Nunito 800 `--bb-text-lg`, ink, no letter-spacing. `assets/logo.svg` is for light-background
external use only.

Sprites (`assets/sprites/*.svg`): 100 x 100, facing right, ink `#1B1B3A` 3px outline (16.6:1 on the white stage),
distinct silhouettes and palettes: **bolt** (blue robot), **zip** (red-orange horizontal rocket), **mimi** (pink round
cat-like blob with a curl tail, deliberately not an orange cat), **sunny** (yellow star with a face), **finn**
(cyan fish), **pico** (green one-eyed alien with antennae). Costume 2 of each is a different pose or expression.

---

## 9. Layout concept

Global frame: `header#topbar` (64px, single line at desktop, `--bb-surface`, 3px bottom edge) over `main#app`
(fills `100dvh - topbar`, never `100vh`). Max shell width 1920px, centred beyond that (2560 shows ground colour on
the sides, not stretched stage). Panels are separate rounded slabs on `--bb-ground`, 12px apart.

**>= 1280px (desktop):** two columns.
`grid-template-columns: minmax(0, 1fr) clamp(26rem, 32vw, 35rem)`.
- Left: `#workspace-panel`, the Blockly workspace, a 3px edge, `--bb-r-lg`. Toolbox rail on the inline-start side
  (88px). Zoom controls (`#zoom-controls`) bottom inline-end, trash bottom inline-start of the workspace.
  When `body.has-lesson`, the lesson panel docks under the workspace as a full-width strip (max 38dvh, scrolls inside):
  Bolt 72px, title and goal on one side, steps and hint on the other (two columns inside the dock).
- Right: stage column: stage toolbar pill, stage frame (4:3, fills column width), sprite info, sprite list. If the
  column is taller than the viewport it scrolls on its own (`overflow-y: auto`, `scrollbar-gutter: stable`).
  At 1280 x 720 the content measures about 600px against about 570px available, so internal scroll is expected there.
- 1536px and up: stage column grows to its 35rem cap; extra width goes to the workspace.

**1024 to 1279px:** the same two columns with `clamp(21rem, 34vw, 26rem)` for the stage column; top bar labels
shorten to icon + short text; rail stays at 88px; lesson dock as above but single column inside.

**700 to 1023px (stack):** one column, page scrolls vertically. Order: topbar, lesson panel (if on, a
collapsible card above the stage, max 30dvh), stage panel (toolbar + frame at `min(100%, 26rem)` centred;
at >= 840px the sprite info and sprite list sit beside the frame in a two-column grid), workspace panel
(`min-block-size: max(30rem, 70dvh)`). Keep 12px gutters so a touch has somewhere to scroll the page that is
not inside the workspace. Rail 88px.

**< 700px:** `#phone-notice` shows: a full-width strip under the top bar in Bolt Yellow with ink text (11.76:1), 3px ink
bottom edge, a `bolt-think` or `bolt-happy` glyph at 40px, one short sentence recommending a tablet or computer (copy
from CIRCUIT-2), and a 44px dismiss button; it never blocks the editor and stays dismissed for the session.
The editor still works, stacked as above. Top bar becomes two rows: logo mark + icon-only buttons on row one,
`#project-name` full width on row two. Rail becomes 56px icon-only: the colour dot stays, the label is visually hidden
(kept for screen readers) and each row is 56 x 56. The stage frame is full width. At 200% zoom a 1280px desktop reports
640px, so this layout must be fully usable and the notice must be dismissible.

No horizontal scroll from 320 to 2560: every flex child that holds text has `min-inline-size: 0`; the topbar wraps
(never overflows); Blockly's own scrolling is inside `#blockly-div`.

**Panels and widgets**

- Stage panel: `--bb-panel`, 3px edge, `--bb-r-lg`, `--bb-shadow-3`. Toolbar is a pill of 48px round buttons:
  flag, pause, stop on the inline-start, then speed (turtle/rabbit) and D-pad toggles on the inline-end.
  Pressed uses the inverse colours. While `body.is-running` the stage frame gains a 4px `--bb-accent` ring plus a
  3px ink ring outside it (not colour-only: the ring is a shape change). Paused shows the pause button pressed.
  Frame: `--bb-stage-bg` backing, 4px `--bb-stage-frame` edge, `--bb-r-lg`, no inner shadow, `aspect-ratio: 4 / 3`.
  Ask form and D-pad sit over the bottom of the frame on `--bb-surface` with an edge. D-pad: 3x3 grid of 56px round
  buttons, `i-chevron-*` icons rotated for up and down, a wide "space" key; never mirrored in RTL.
- Sprite info: compact two-column grid of labelled inputs (visible 13px labels), name field full width, show/hide as a
  toggle with `i-eye` / `i-eye-off`. Inputs: `--bb-input-bg`, 2px `--bb-line-strong` border, `--bb-r-md`, 44px high,
  `shadow-1`. Invalid input: 2px `--bb-danger` border plus an `i-close` icon and text, not colour alone.
- Sprite list: wrapping grid of 72px tiles (thumb 48px on `--bb-stage-bg`, label under it in `--bb-text-xs`).
  `[aria-current="true"]`: 4px ink edge (`--bb-edge`), the lip shown at `shadow-2`, label weight 800, plus a small
  accent underline bar: three cues. `.sprite-delete` is a 28px round `i-close` chip at the tile's inline-end top
  corner, `--bb-danger` on hover. `#btn-add-sprite` is a primary pill with `i-plus`.
- Lesson panel: `--bb-panel`, 3px edge, `--bb-r-lg`. Bolt (`bolt-happy`, swapped by JS to `bolt-think` /
  `bolt-cheer`) on the inline-start, the hint text in a speech-bubble card (`--bb-surface`, 3px edge, `--bb-r-lg`, a rotated
  square tail pointing at Bolt, tail flips in RTL). Steps (`ol#lesson-steps`): numbered round chips (28px). Current
  step `[aria-current="step"]`: accent chip with ink number, bold text, 2px ink edge. Done `[data-done]`:
  `--bb-success` chip with `i-check`. `#lesson-status` is plain text in `--bb-ink-muted` or `--bb-success`.
  Hint buttons are secondary pills with `i-bulb`, `i-chevron-*` (mirrored in RTL), `i-reset` for restart.
- Toast (`.toast`): bottom centre of the viewport, `min(92vw, 28rem)`, `--bb-surface`, 3px edge, `--bb-r-md`,
  `shadow-4`, 12px padding, a 24px icon chip at inline-start (`.toast--info`: `i-bulb` on accent; default: `i-check` on
  `--bb-success`; `.toast--error`: `i-close` on `--bb-danger`) and `--bb-text-sm` weight 700 ink text. Error text stays
  ink (not red) so it is 16.6:1; the red lives in the icon chip and the 3px edge. Auto-dismiss is JS's call (>= 5 s,
  and errors persist until closed). Enter: rise 8px + fade, `boing`; reduced: appear.
- Celebration (`#celebration`): a scrim (`--bb-scrim`) with a centred card: `--bb-surface`, 4px ink edge, `--bb-r-xl`,
  `shadow-4`, `bolt-cheer` 160px above `--bb-text-2xl` weight 800 text (`#celebration-text`), a primary "next lesson" pill.
  Confetti: 10 x 14px rounded rects with a 2px ink stroke in the ten category colours, positioned with `--i`
  (e.g. `left: calc(var(--i) * 6.7%)`, delay `calc(var(--i) * 40ms)`), falling for `--bb-dur-cheer`. Reduced motion:
  none created; static stars instead.
- Dialogs (`<dialog>`): `--bb-surface`, 4px edge, `--bb-r-xl`, `shadow-4`, `max-inline-size: min(92vw, 36rem)`,
  `max-block-size: 90dvh` scrolling inside, `::backdrop { background: var(--bb-scrim); }`. Title `--bb-text-lg`.
  A Bolt pose (welcome: `bolt-wave`) at 96 to 128px. Buttons are 48px pills; primary last (inline-end), cancel
  secondary. Close (`i-close`) top inline-end, 44px.
- Top bar: `--bb-surface`, logo lockup, project name input (grows, `min-inline-size: 0`), File menu button with
  `i-chevron-down`, Lessons (`i-book`), theme toggle (`i-sun` / `i-moon`, `aria-pressed`), language (`i-globe` + the other
  language's name), help (`i-help`). Menu popover (`#file-menu-list`): `--bb-surface`, 3px edge, `--bb-r-md`, `shadow-3`,
  each item 44px, `--bb-r-sm`, hover `--bb-panel`, with `i-new i-save i-folder i-download i-upload`.

---

## 10. RTL notes

- Use logical properties only: `margin-inline`, `padding-inline`, `inset-inline-start`, `border-start-start-radius`,
  `text-align: start`. Grid and flex mirror automatically from `dir="rtl"`: in Arabic the workspace and rail are on the
  right, the stage column on the left.
- Blockly: `rtl: true` in `inject`, `toolboxPosition` should be `start` so the rail follows the writing direction;
  Blockly mirrors blocks and the flyout itself. Zoom controls and trash follow `.blocklyRTL` (Blockly handles their side);
  PRISM must not hard-code `left/right` on them.
- The stage is not mirrored. Direction 90 is always screen-right, x grows to the right, sprites face right. The speech
  bubbles are drawn on canvas: CIRCUIT-2 sets `ctx.direction` and `ctx.textAlign` from the text's language so Arabic says
  "hello" right-to-left inside a bubble, and uses the Cairo stack in the canvas `font`.
- The D-pad and the `i-turtle` / `i-rabbit` pair keep their physical layout. Chevrons used as "back / next" mirror.
- User-entered strings (project name, sprite names, variable names, messages) can mix scripts: wrap them in `<bdi>` or set
  `dir="auto"` on inputs and list labels, so a Latin name in an Arabic UI does not scramble punctuation.
- Numeric inputs keep Western digits, `text-align: start`, and `dir="ltr"` on the `input` itself (so a minus sign does not
  jump to the wrong end).
- The speech-bubble tail in the lesson panel, menu anchor side, the toast icon chip and the celebration confetti drift are
  all inline-start/end based. Lip shadows are vertical only, so they never need flipping.
- Type: `:root:lang(ar)` swaps to Cairo, taller leading, no letter-spacing, no italics (Cairo has none; never use
  synthetic italic for emphasis, use weight).
- Test both directions at 320, 700, 1024, 1280 and 2560 wide, both themes.

---

## 11. Blockly styling hooks (for PRISM and CIRCUIT-1)

Class names below were checked against the pinned `blockly@13.3.0` bundle. Verify any not listed here at runtime.

### 11.1 Blockly theme constants (CIRCUIT-1, JS side; mirror the tokens, they cannot read CSS vars before inject)

| Theme field | `bb-light` | `bb-dark` |
|---|---|---|
| blockStyles `<key>_blocks`: `colourPrimary` | `--cat-<key>` hex | same |
| `colourSecondary` | `--cat-<key>` hex | same |
| `colourTertiary` (Zelos uses it as the stroke; verify in the Zelos path object) | `#1B1B3A` | `#1B1B3A` |
| componentStyles.workspaceBackgroundColour | `#FAFBFF` | `#181838` |
| toolboxBackgroundColour | `#FFFFFF` | `#1C1C3F` |
| flyoutBackgroundColour | `#E9EDFF` | `#2A2A5E` |
| flyoutOpacity | 1 | 1 |
| scrollbarColour | `#6F74A8` | `#7C81C0` |
| scrollbarOpacity | 1 | 1 |
| insertionMarkerColour | `#1B1B3A` | `#F2F3FF` |
| insertionMarkerOpacity | 0.25 | 0.3 |
| cursorColour | `#1B1B3A` | `#FFFFFF` |
| font | weight 800, size 14, family from `--bb-font-ui` / `--bb-font-ar` (literal strings) | same |

Workspace `grid` option: `{ spacing: 24, length: 3, colour: '#D3D9F3' (light) | '#2F2F63' (dark), snap: true }`.
Zelos corner radius and thickness stay at renderer defaults except where CIRCUIT-1 sets "thick" constants.
Field styling: dropdown and number fields are white, rounded, ink bold text in both themes (the ADR 0006 idiom).
Request to CIRCUIT-1 (via ATLAS): give each toolbox category `cssConfig: { container: 'bb-cat bb-cat--<key>' }`
(`ToolboxCategory.CssConfig` has `container`, `row`, `rowcontentcontainer`, `icon`, `label`, `selected`, `openicon`,
`closedicon` in 13.3.0), so PRISM can map `.bb-cat--motion { --cat: var(--cat-motion); }` and colour the rail dots.

### 11.2 Hooks and what to apply

| Surface | Hook | Spec |
|---|---|---|
| Workspace | `.blocklyMainBackground` | fill `--bb-workspace`; grid lines `stroke: var(--bb-grid)`, round caps, 3px, dots look |
| Toolbox rail | `.blocklyToolbox`, `.blocklyToolboxCategoryContainer` | width `--bb-rail-w`, `--bb-toolbox`, inline-end 3px `--bb-edge` border, vertical scroll with the same scrollbar style |
| Rail row | `.blocklyToolboxCategory` (+ `.bb-cat--<key>`) | 88 x 64 min (>= 44 high), column: dot above label, `--bb-r-lg` radius, 8px inset from rail edges, `border-radius: var(--bb-r-lg)` |
| Rail dot | `.blocklyToolboxCategoryIcon` | 28px circle, fill `var(--cat)`, 2.5px `--bb-block-edge` border (the border is the boundary on white); hide Blockly's own icon glyph |
| Rail label | `.blocklyToolboxCategoryLabel` | `--bb-text-xs`, weight 800, `--bb-ink`, centred, may wrap to 2 lines (e.g. "My Blocks"), never truncated |
| Rail selected | `.blocklyToolboxSelected` | background `color-mix(in srgb, var(--cat) 24%, var(--bb-toolbox))` in light and 30% in dark, dot grows to 32px with 4px edge, label stays ink; also a 4px inline-start `var(--cat)` bar with an ink 2px outline (shape cue, not colour only) |
| Rail hover/focus | same + `:focus-visible` | hover: 14% mix; focus: the two-band ring (section 4) |
| Flyout | `.blocklyFlyout`, `.blocklyFlyoutBackground` | fill `--bb-flyout`, inline-end 3px `--bb-edge`; labels `.blocklyFlyoutLabelText` ink 800; buttons `.blocklyFlyoutButton` as primary pill ("Make a variable") with ink text on `--bb-accent`, ink edge |
| Blocks | `.blocklyPath` | stroke `--bb-block-edge`, `stroke-width: 2px` (1.5 acceptable at zoom < 0.8); no CSS fill override (fill comes from the theme) |
| Block text | `.blocklyText`, `.blocklyEditableField > text`, `.blocklyNonEditableField > text` | fill `--ink-on-cat` (#1B1B3A), weight 800. Field text on white field rects is also ink |
| Fields | `.blocklyEditableField > rect`, `.blocklyDropdownRect` | white, `rx` ~ 10, no outline; `.blocklyHtmlInput` (the live editor) white bg, ink text, 2px ink border, `--bb-r-sm` |
| Selected block | `.blocklySelected > .blocklyPath` | `stroke: var(--bb-select-edge); stroke-width: 3.5px; filter: drop-shadow(0 0 2px var(--bb-select-halo)) drop-shadow(0 0 2px var(--bb-select-halo))` (ink + white halo) |
| Running block | `.bb-running > .blocklyPath` | `stroke: var(--bb-running-edge); stroke-width: 3px; filter: drop-shadow(0 0 4px var(--bb-running-glow)) drop-shadow(0 0 8px var(--bb-running-glow))`; under no-preference motion add an `opacity`-style pulse of the halo (`--bb-dur-pulse`), under reduce it is static. If a block is both selected and running, running wins |
| Dragging | `.blocklyDragging`, `.blocklyDraggingDelete` | slight 1.03 scale is Blockly's; add `filter: drop-shadow(0 6px 0 var(--bb-lip-color))` (lifted brick). Over the delete area: the rail/flyout gets a 3px dashed `--bb-danger` border and a 14% `--bb-danger` tint (`.blocklyToolboxDelete`, `.blocklyDraggingDelete`) |
| Disabled | `.blocklyDisabled > .blocklyPath` | keep Blockly's hatch pattern; text stays ink (>= 4.5) |
| Insertion marker | `.blocklyInsertionMarker > .blocklyPath` | per theme colours above |
| Focus (keyboard nav) | `.blocklyActiveFocus`, `.blocklyFocusRing`, `.blocklyWorkspaceFocusRing`, `.blocklyWorkspaceSelectionRing`, `.blocklyPassiveFocus` | two-band ring from section 4 (Blockly draws these as strokes: ink stroke 3px + a white `drop-shadow` halo) |
| Scrollbars | `.blocklyScrollbarHandle`, `.blocklyScrollbarBackground` | handle `fill: var(--bb-scroll)`, `fill-opacity: 1`, `rx: 6px`, 10px thick (>= 24px grab length), hover thickens to 14px; background transparent |
| Trashcan | `.blocklyTrash` (+ `.blocklyTrashOpen`) | Blockly's trash art is a sprite image, not recolourable by `fill`. Use `filter: drop-shadow(0 3px 0 var(--bb-lip-color))` and, in dark, `filter: invert(0.9) hue-rotate(180deg)` plus the same drop shadow, and enlarge to >= 44px by `scale`. Open state when dragging over: no extra colour needed (Blockly lifts the lid). If this is not acceptable visually, ATLAS may add a `button#btn-trash` drop target (contract change) |
| Zoom | `.blocklyZoom` (`#zoom-controls` is ours) | our three buttons are 44px round secondary buttons with `i-plus`, `i-minus`, `i-target`; hide Blockly's own zoom controls (`zoom.controls: false`) |
| Context menu / dropdown menu | `.blocklyContextMenu`, `.blocklyDropDownDiv`, `.blocklyMenuItem`, `.blocklyMenuItemHighlight`, `.blocklyMenuItemDisabled` | `--bb-surface`, 3px `--bb-edge`, `--bb-r-md`, `shadow-3`, item min-height 44px, `--bb-text-sm` weight 700, highlight `--bb-panel` with an inline-start 4px `--bb-accent` bar |
| Tooltip | `.blocklyTooltipDiv` | `--bb-inverse-bg` / `--bb-inverse-ink`, `--bb-r-sm`, `--bb-text-sm` |
| Widget div text inputs | `.blocklyWidgetDiv input` | 44px high, `--bb-input-bg`, ink text, 2px `--bb-line-strong` |
| Workspace comment/bubble | `.blocklyBubble`, `.blocklyComment` | not used in the toolbox; if present, `--bb-surface` + edge |

Z-order of Blockly's own widgets is Blockly's; PRISM only guarantees `#blockly-div` has `isolation: isolate` so they do
not collide with the topbar.

---

## 12. States checklist (every control)

default, hover, `:focus-visible` (two-band ring), `:active` (lip collapsed), `aria-pressed="true"` (inverse colours +
collapsed lip), disabled (flat), loading/booting (`#app-boot`: Bolt `bolt-think` centred and a three-block skeleton row
using category colours at 100%, no spinner; reduced motion: static), empty (`#saved-empty`: Bolt `bolt-happy` 96px and a
single friendly line with an arrow to "Save"), error (toast + inline text with icon).

---

## 13. Handoffs and open requests (all routed through ATLAS)

- PRISM: implement section 2 verbatim as `@layer tokens`; consume only tokens. Build Blockly hooks per section 11.
- GRANITE: inline `assets/icons.svg` symbols and `assets/bolt-symbols.svg` symbols verbatim into the hidden sprite sheet
  (strip the XML comments if CSP or size matters, the symbol content has no external references). Add `icon--dir` to
  chevrons that mean back or next.
- CIRCUIT-1: theme constants table (11.1), `cssConfig.container` per category, confirm `bb-running` via `addClass`, font-ready
  gate before injecting (R1).
- CIRCUIT-2: canvas `ctx.direction`/font for Arabic bubbles (RTL notes), do not create confetti under reduced motion
  (already agreed in the contract).
- QUARTZ: font request and metric-matched fallback (section 6), cost of the Arabic subset on English pages.
- SENTRY: automated checks: contrast table pairs recomputed from the final CSS in both themes; focus ring visible over each
  category fill; reduced-motion pinned explicitly in CDP; 320 and 640px (200% zoom) screenshots; RTL screenshots.

## 13b. Risks MUSE is flagging

- R1 Web font arrives after Blockly measures text (section 6). Gate `inject` on `document.fonts.load`.
- R2 `colourTertiary` as the Zelos stroke and the exact trashcan DOM are assumed from the Blockly 13 bundle, not
  rendered here. Verify in a browser; the fallback for the stroke is the CSS `.blocklyPath` rule in 11.2.
- R3 `var()` is deliberately not used inside the SVG art (literal hexes), so Bolt cannot be recoloured by CSS. If a
  colourway feature is wanted later, flatten the four body colours into custom properties with fallbacks and re-test
  in Safari.
- R4 A native `<dialog>` opened with `showModal()` sits in the top layer above any `z-index`, so `#toast-region` would
  be hidden behind an open dialog. If a toast must show over a dialog (e.g. a save error from the Save dialog), render
  the region as a manual popover (`popover="manual"` and `showPopover()`), or show the message inside the dialog.
- R5 Dark-theme duplication of tokens (attribute block and media fallback). One missed edit makes the themes drift.
- R6 No rendered preview was available while drawing the SVG art (no browser in this session). Geometry was computed
  by hand; SENTRY or ATLAS should open `assets/` in a browser once and report anything that looks off.
- R7 The two-tone focus ring needs 5px of free space around the element; clipped containers will cut it.

---

## 14. Asset inventory

| File | Purpose |
|---|---|
| `assets/icons.svg` | 36 symbols, ids exactly as architecture.md section 3 |
| `assets/bolt.svg` | standalone Bolt (happy), viewBox 0 0 200 200 |
| `assets/bolt-symbols.svg` | `bolt-happy bolt-think bolt-cheer bolt-wave` (200 box) and `logo-mark` (48 box) |
| `assets/logo.svg` | lockup for light backgrounds |
| `assets/sprites/{bolt,zip,mimi,sunny,finn,pico}-{1,2}.svg` | 12 costumes, 100 x 100, facing right |

Additions to the contract: none to ids or names. New tokens and class suggestions (`bb-cat`, `bb-cat--<key>`, `icon--dir`)
are proposals above.
