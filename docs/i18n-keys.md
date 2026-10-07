# BoltBlocks — markup hooks and UI string keys (GRANITE)

Generated from `index.html`; the key table is regenerated whenever GRANITE re-runs. CIRCUIT-2: translate
every key below into `ar`. PRISM: the class vocabulary is the style contract.

## Behaviour notes for CIRCUIT-2

- `html.js` is stamped by the inline boot script. `html.is-ready` is added by `app.js`.
- `#btn-lang-label` carries `lang="ar"` in English. When the UI is Arabic, set its text to "English" and
  `lang="en"` (and back). Its key is `top.lang_other`.
- `#wl-continue` ships `hidden`; un-hide it only when an autosave exists. `#saved-empty` ships visible;
  hide it when saved projects exist.
- `#prompt-error` is `role="alert"` and ships empty; write the message into it, clear it on success.
  The prompt and confirm dialogs use `<form method="dialog">`: `#prompt-ok` / `#confirm-ok` close the
  dialog natively with `returnValue "ok"`, cancel with `"cancel"`. Call `preventDefault()` on the form's
  `submit` to validate before closing. Dialog close buttons (`.dlg__close`) also close natively.
- `#confirm-ok` / `#confirm-title` / `#confirm-text` / `#prompt-title` / `#prompt-label` are defaults;
  override per use. Prefer specific labels ("Delete sprite") over "Yes".
- `#ask-label` text is the question being asked (replace `stage.ask_label`).
- `#dpad` keys: `data-key` = `up|left|down|right|space`. The "up" key reuses the chevron-down symbol
  with `.icon--up` (PRISM rotates it 180deg).
- `#blockly-div` has `tabindex="-1"` (skip-link target). Do not remove it.
- Toggle buttons use `aria-pressed` only; their accessible name never changes. Do not rewrite their label.
- Canvas `#stage` is `role="img"` + `aria-describedby="#stage-desc"`; never `preventDefault()` on Tab
  while it has focus (no keyboard trap).
- Added ids (beyond architecture.md §3): `lesson-bolt` (the `<svg>` in the lesson panel; swap its
  `<use href>`), `btn-lang-label`, `prompt-form`, `prompt-title`, `confirm-title`, `lessons-title`,
  `char-title`, `load-title`, `wl-title`, `wl-text`, `stage-desc`.

## Class vocabulary (PRISM)

| Class | Meaning |
|---|---|
| `sr-only` | Visually hidden, still in the accessibility tree. Must exist in CSS. |
| `skip-link` | Off-screen until focused, then fixed top-start and obvious. |
| `sprite-sheet` | The hidden inline SVG sprite: `position:absolute; width:0; height:0; overflow:hidden`. |
| `icon` | Inline icon, `1.5em` square, `fill`/`stroke` come from MUSE's symbols. `icon--up` = rotate 180deg. |
| `bolt` | Mascot `<svg>` (explicit `width`/`height` attributes already set). |
| `icon-swap icon-swap--on / --off` | Wrapper that shows only when the parent button's `aria-pressed` is `true` (`--on`) or `false` (`--off`). Used by `#btn-theme` (sun = off, moon = on) and `#sprite-visible` (eye = on, eye-off = off). |
| `btn` | Every button. Variants: `btn--primary` (green-flag, Add, OK), `btn--secondary`, `btn--ghost` (header, close), `btn--danger` (Stop), `btn--round` (icon-only circle), `btn--toggle` (has `aria-pressed`; style `[aria-pressed="true"]`). Primary and round buttons are >= 44px; all >= 24px. |
| `field-input` | Text/number input; `--project` is the header project-name input. |
| `field`, `field--name`, `field__label` | A label wrapping a caption + input (sprite settings, grid-friendly). `field-error` = inline error text. |
| `topbar`, `topbar__project`, `topbar__actions`, `logo`, `logo__mark`, `wordmark` | Banner. |
| `menu`, `menu__list`, `menu__item` | File menu. `menu__list[hidden]` = closed. Position the list under `#btn-file`. |
| `app`, `app-boot` | `main` and its no-JS-visible Loading skeleton (`html:not(.js) .app-boot` = hide; `html.is-ready .app-boot` = hide). |
| `panel`, `panel--workspace`, `panel--stage` | The two main regions. |
| `blockly-host`, `zoom-controls` | Blockly container and the overlay zoom buttons. |
| `stage-toolbar`, `stage-frame`, `stage`, `ask-form`, `ask-form__label`, `dpad`, `dpad__key`, `dpad__key--up/left/down/right/space` | Stage area. `.stage` keeps `aspect-ratio: 4/3`. `dpad` is hidden by default; `body.dpad-on` is a state hook only. |
| `sprite-info`, `sprite-panel`, `sprite-panel__title`, `sprite-list` | Sprite settings and list. |
| `lesson-panel`, `lesson-panel__title/__goal/__sub/__nav/__status`, `lesson-steps`, `lesson-hint` | Lesson aside. |
| `toast-region`, `celebration`, `celebration__text`, `phone-notice` | Overlays. `phone-notice` is shown below 700px only. |
| `dlg`, `dlg--small`, `dlg--welcome`, `dlg__head`, `dlg__title`, `dlg__close`, `dlg__body`, `dlg__body--welcome`, `dlg__actions` | Dialogs. Style `dialog::backdrop`. `dlg__head` is a flex row (title + close). |
| `lesson-list`, `char-list`, `saved-list` | Lists filled by JS. |

## Key table

`data-i18n="key"` sets `textContent`; `data-i18n-attr="attr:key;…"` sets attributes. Where an element has both an icon and a label, `data-i18n` sits on the inner `<span>`, never on the button (it would wipe the icon). Keys used in several places (`common.*`, `top.theme`, `stage.dpad`) share one translation.

| key | English | where |
|---|---|---|
| `app.h1` | BoltBlocks — block coding workspace | `#h1` |
| `boot.loading` | Loading… | `#p` |
| `celebrate.text` | Great job! | `#celebration-text` |
| `char.title` | Choose a character | `#char-title` |
| `common.cancel` | Cancel | `#prompt-cancel` |
| `common.close` | Close | `button[aria-label]` |
| `common.ok` | OK | `#span` |
| `confirm.ok` | Yes | `#confirm-ok` |
| `confirm.text` | Please confirm. | `#confirm-text` |
| `confirm.title` | Are you sure? | `#confirm-title` |
| `dpad.down` | Down | `button[aria-label]` |
| `dpad.left` | Left | `button[aria-label]` |
| `dpad.right` | Right | `button[aria-label]` |
| `dpad.space` | Space | `#button` |
| `dpad.up` | Up | `button[aria-label]` |
| `info.dir` | Direction | `#span` |
| `info.name` | Name | `#span` |
| `info.size` | Size | `#span` |
| `info.title` | Sprite settings | `sprite-info[aria-label]` |
| `info.visible` | Visible | `#span` |
| `info.x` | x | `#span` |
| `info.y` | y | `#span` |
| `lesson.close` | Close lesson | `btn-lesson-close[aria-label]` |
| `lesson.hint` | Bolt's hint | `#h3` |
| `lesson.hint_next` | Next hint | `btn-hint-next[aria-label]` |
| `lesson.hint_prev` | Previous hint | `btn-hint-prev[aria-label]` |
| `lesson.panel` | Lesson | `lesson-panel[aria-label]` |
| `lesson.reset` | Start again | `#span` |
| `lesson.steps` | Steps | `#h3` |
| `lesson.title_default` | Lesson | `#lesson-title` |
| `lessons.intro` | Pick a lesson. Bolt will guide you step by step. | `#p` |
| `lessons.title` | Lessons | `#lessons-title` |
| `load.empty` | No saved projects yet. Use File, then Save, to keep one. | `#saved-empty` |
| `load.title` | Open a saved project | `#load-title` |
| `notice.dismiss` | Got it | `#btn-dismiss-notice` |
| `notice.text` | BoltBlocks works best on a tablet or a computer. You can still look around on a phone. | `#p` |
| `prompt.label` | Name | `#prompt-label` |
| `prompt.title` | Name it | `#prompt-title` |
| `skip.stage` | Skip to the stage | `#a` |
| `skip.workspace` | Skip to the block workspace | `#a` |
| `sprites.add` | Add sprite | `#span` |
| `sprites.list` | Your sprites | `sprite-list[aria-label]` |
| `sprites.title` | Sprites | `sprite-panel[aria-label]` |
| `stage.ask_label` | Your answer | `#ask-label` |
| `stage.canvas` | Stage: where your sprites move | `stage[aria-label]` |
| `stage.canvas_desc` | Arrow keys, letters and the space key go to your program while the stage has focus. Press Tab to move on. | `#stage-desc` |
| `stage.canvas_fallback` | The stage needs a browser that supports canvas. | `#span` |
| `stage.dpad` | Arrow pad | `btn-dpad[aria-label]` |
| `stage.flag` | Run (green flag) | `btn-flag[aria-label]` |
| `stage.pause` | Pause | `btn-pause[aria-label]` |
| `stage.speed` | Slow motion | `btn-speed[aria-label]` |
| `stage.stop` | Stop | `btn-stop[aria-label]` |
| `stage.title` | Stage | `stage-panel[aria-label]` |
| `stage.toolbar` | Stage controls | `stage-toolbar[aria-label]` |
| `top.download` | Download project file | `#span` |
| `top.file` | File | `#span` |
| `top.help` | Help | `btn-help[aria-label]` |
| `top.lang_other` | العربية | `#btn-lang-label` |
| `top.lang_title` | Change language | `btn-lang[title]` |
| `top.lessons` | Lessons | `#span` |
| `top.load` | Open saved project… | `#span` |
| `top.new` | New project | `#span` |
| `top.project_label` | Project name | `#label` |
| `top.project_placeholder` | My project | `project-name[placeholder]` |
| `top.save` | Save in this browser | `#span` |
| `top.theme` | Dark mode | `btn-theme[aria-label]` |
| `top.upload` | Open project file… | `#span` |
| `top.upload_input` | Project file | `upload-input[aria-label]` |
| `wl.continue` | Continue my project | `#wl-continue` |
| `wl.lessons` | Try a lesson | `#wl-lessons` |
| `wl.start` | Start coding | `#wl-start` |
| `wl.text` | Snap blocks together to make your robot friends move, talk and draw. | `#wl-text` |
| `wl.title` | Hi, I'm Bolt! | `#wl-title` |
| `ws.title` | Block workspace | `workspace-panel[aria-label]` |
| `ws.zoom` | Zoom | `zoom-controls[aria-label]` |
| `ws.zoom_in` | Zoom in | `btn-zoom-in[aria-label]` |
| `ws.zoom_out` | Zoom out | `btn-zoom-out[aria-label]` |
| `ws.zoom_reset` | Reset zoom | `btn-zoom-reset[aria-label]` |

78 unique keys.
