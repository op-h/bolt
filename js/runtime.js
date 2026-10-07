/*
 * BoltBlocks - js/runtime.js  (CIRCUIT-1)
 * The stage: sprites, drawing, pen, speech bubbles, variable monitors, sound, and the scheduler that
 * runs the generator functions produced by js/generators.js (ADR 0003).
 *
 * HOW TO ADD A CHARACTER
 *   1. Draw `assets/sprites/<id>-1.svg` and `<id>-2.svg` (viewBox 0 0 100 100, facing right).
 *      Put width="100" height="100" on the <svg> root too: Firefox cannot draw an SVG that has no size.
 *   2. Add one line to CHARACTERS below ({name, color, costumes}). `color` is only the colour of the
 *      fallback face shown if the pictures fail to load.
 *   3. Nothing else: the character picker in app.js reads BB.rt.CHARACTERS.
 *
 * HOW TO ADD A BLOCK ACTION
 *   Add a function to the "script API" section (e.g. rt.jump = function (S, h) {...}) and call it from
 *   the block's generator in js/generators.js. A function that takes time must be a generator
 *   (function*) that does `yield FRAME` while it waits, and the generator calls it with `yield*`.
 *
 * HOW THE SCHEDULER WORKS (for teachers)
 *   Every script is a JavaScript generator. Each block does `yield rt.step(id)` first, which lets us
 *   light the block up; each loop does `yield rt.frame()` once per turn, which means "come back in
 *   about 1/30 s". The scheduler gives every script a turn per frame and never spends more than ~8 ms
 *   on one page frame, so the page stays responsive. Stop calls generator.return() on every script.
 *   Time for waits/glides is a "virtual clock" that stands still while paused.
 */
(function (BB) {
  'use strict';

  var rt = BB.rt = BB.rt || {};

  /* ------------------------------------------------------------------ */
  /* Constants and characters                                            */
  /* ------------------------------------------------------------------ */
  var W = 480, H = 360;               // stage size in logical px; origin is the centre, y points up
  var NATURAL = 80;                   // a sprite at size 100 is 80x80 stage px
  var FRAME_MS = 33;                  // one script "frame" (Scratch-like 30 fps)
  var BUDGET_MS = 8;                  // max time per page frame spent running scripts
  var SLOW_MS = 350;                  // slow-motion: wait this long on every block
  var MAX_DEPTH = 500;                // My Block nesting limit before the friendly "recursion" stop
  var PEN_SCALE = 2;                  // the pen layer is drawn at 2x so lines stay crisp
  var FONT = '"Nunito", "Cairo", "Segoe UI", system-ui, sans-serif';
  var FONT_AR = '"Cairo", "Segoe UI", Tahoma, system-ui, sans-serif';
  // Chosen at draw time: Arabic must not request Nunito through the canvas stack.
  function fontStack() { return document.documentElement && document.documentElement.lang === 'ar' ? FONT_AR : FONT; }
  var INK = '#1B1B3A';

  function chr(id, name, color) {
    return { name: name, color: color, costumes: ['assets/sprites/' + id + '-1.svg', 'assets/sprites/' + id + '-2.svg'] };
  }
  var CHARACTERS = rt.CHARACTERS = {
    bolt: chr('bolt', 'Bolt', '#4C97FF'),
    zip: chr('zip', 'Zip', '#FF6680'),
    mimi: chr('mimi', 'Mimi', '#FFAB19'),
    sunny: chr('sunny', 'Sunny', '#FFBF00'),
    finn: chr('finn', 'Finn', '#5CB1D6'),
    pico: chr('pico', 'Pico', '#59C059')
  };

  // Tokens a script yields to the scheduler. Objects (not strings) so nothing else can fake them.
  var STEP = { token: 'step' }, FRAME = { token: 'frame' }, STOP = { token: 'stop' };

  function t(key) { return BB.blocks && BB.blocks.t ? BB.blocks.t(key) : key; }
  function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  // A runtime problem a kid can understand. kind is one of loop | recursion | math | unknown.
  function BBError(kind, key) { this.kind = kind; this.key = key; }

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */
  var canvas = null, ctx = null, scale = 1;
  var penCanvas = null, penCtx = null;
  var sprites = [];
  var selectedId = null;
  var nextSpriteNo = 1;
  var vars = [];                      // [{name, value, visible}] in creation order
  var threads = [];
  var cur = null;                     // the thread being resumed right now
  var paused = false, slow = false;
  var vnow = 0, nextTick = 0, tickActive = false, queue = [], qi = 0;
  var lastTs = 0, raf = 0, dirty = true;
  var mouse = { x: 0, y: 0, down: false };
  var keys = new Set();
  var answerText = '';
  var timerStart = 0;
  var askTicket = 0, askBusy = false, askActive = false;
  var bubbleToken = 0;
  var stats = freshStats();
  var changed = Object.create(null), lastFlush = 0;
  var hlCount = Object.create(null);                   // "spriteId|blockId" -> number of threads lit there
  var lastState = 'idle', holdState = false;     // holdState: no idle/running flicker while the flag restarts
  var stopRequested = false;
  var images = {};                    // character -> [{img, ready, failed}]
  var filterOK = false;

  // Own-key test: a saved file may say character "constructor", which CHARACTERS[...] alone would accept.
  function isChar(c) { return typeof c === 'string' && Object.prototype.hasOwnProperty.call(CHARACTERS, c); }

  function freshStats() { return { penSegments: 0, said: [], messages: [], keysPressed: [], spriteMoved: Object.create(null) }; }

  function emit(name) {
    var fn = rt[name];
    if (typeof fn !== 'function') return;
    var args = Array.prototype.slice.call(arguments, 1);
    try { fn.apply(rt, args); } catch (e) { /* a faulty listener must not break the stage */ }
  }

  /* ------------------------------------------------------------------ */
  /* Small numeric helpers (also used by generated code)                 */
  /* ------------------------------------------------------------------ */
  function n(x) {
    if (typeof x === 'number') return isFinite(x) ? x : 0;
    var v = Number(x);
    return isFinite(v) ? v : 0;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function r3(v) { return Math.round(v * 1000) / 1000; }
  function wrapDir(d) {
    d = ((d % 360) + 360) % 360;      // 0..359.99
    return d > 180 ? d - 360 : d;     // -179..180, like Scratch
  }
  // Show 0.1+0.2 as 0.3, not 0.30000000000000004.
  function fmt(v) {
    if (typeof v === 'number') return String(isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0);
    if (v === true) return 'true';
    if (v === false) return 'false';
    if (v === null || v === undefined) return '';
    return String(v);
  }
  function radius(s) { return 0.36 * s.size; }      // scaled bounding circle (size is a percent)

  /* ------------------------------------------------------------------ */
  /* Images                                                              */
  /* ------------------------------------------------------------------ */
  function loadImages() {
    Object.keys(CHARACTERS).forEach(function (id) {
      if (images[id]) return;
      images[id] = CHARACTERS[id].costumes.map(function (url) {
        var rec = { img: null, ready: false, failed: false };
        if (typeof Image === 'undefined') { rec.failed = true; return rec; }
        var img = new Image();
        img.decoding = 'async';
        img.onload = function () { rec.ready = true; requestDraw(); };
        img.onerror = function () { rec.failed = true; requestDraw(); };
        img.src = url;
        rec.img = img;
        return rec;
      });
    });
  }

  function costumeRec(s) {
    var list = images[s.character];
    return list ? list[clamp(s.costume, 0, list.length - 1)] : null;
  }

  /* ------------------------------------------------------------------ */
  /* Sprites                                                             */
  /* ------------------------------------------------------------------ */
  function costumeCount(character) {
    var c = isChar(character) ? CHARACTERS[character] : null;
    return c ? c.costumes.length : 1;
  }

  function normSprite(p, fallbackNo) {
    p = p || {};
    var character = isChar(p.character) ? p.character : 'bolt';
    var id = (typeof p.id === 'string' && /^[\w-]{1,40}$/.test(p.id)) ? p.id : 'sprite' + fallbackNo;
    var s = {
      id: id,
      name: String(p.name || CHARACTERS[character].name).slice(0, 40),
      character: character,
      costume: 0, x: 0, y: 0, direction: 90, size: 100, visible: true, effect: 0,
      penDown: false, penColor: '#4C97FF',
      bubble: null, scripts: []
    };
    applyPatch(s, p);
    return s;
  }

  function applyPatch(s, p) {
    if (typeof p.name === 'string') s.name = p.name.slice(0, 40);
    if (isChar(p.character) && p.character !== s.character) {
      s.character = p.character;
      s.costume = 0;
    }
    if (p.costume !== undefined) s.costume = clamp(Math.floor(n(p.costume)), 0, costumeCount(s.character) - 1);
    if (p.x !== undefined) s.x = clamp(n(p.x), -480, 480);
    if (p.y !== undefined) s.y = clamp(n(p.y), -360, 360);
    if (p.direction !== undefined) s.direction = wrapDir(n(p.direction));
    if (p.size !== undefined) s.size = clamp(n(p.size), 5, 500);
    if (p.visible !== undefined) s.visible = !!p.visible;
    if (p.effect !== undefined) s.effect = ((n(p.effect) % 200) + 200) % 200;
  }

  function plain(s) {
    return {
      id: s.id, name: s.name, character: s.character, costume: s.costume,
      x: r3(s.x), y: r3(s.y), direction: r3(s.direction), size: r3(s.size),
      visible: s.visible, effect: r3(s.effect)
    };
  }

  function findSprite(id) {
    for (var i = 0; i < sprites.length; i++) if (sprites[i].id === id) return sprites[i];
    return null;
  }

  function uniqueName(base, exceptId) {
    var name = base, k = 1;
    while (sprites.some(function (s) { return s.name === name && s.id !== exceptId; })) { k++; name = base + k; }
    return name;
  }

  rt.setSprites = function (arr) {
    killAllThreads();
    clearBubbles();
    sprites = [];
    nextSpriteNo = 1;
    (Array.isArray(arr) ? arr : []).forEach(function (p) {
      var s = normSprite(p, nextSpriteNo);
      if (findSprite(s.id)) s.id = 'sprite' + nextSpriteNo;
      sprites.push(s);
      var m = /^sprite(\d+)$/.exec(s.id);
      nextSpriteNo = Math.max(nextSpriteNo, m ? Number(m[1]) + 1 : nextSpriteNo + 1);
    });
    if (!findSprite(selectedId)) selectedId = sprites.length ? sprites[0].id : null;
    penClearLayer();
    requestDraw();
  };

  rt.getSprites = function () { return sprites.map(plain); };

  rt.addSprite = function (character, name) {
    while (findSprite('sprite' + nextSpriteNo)) nextSpriteNo++;
    var ch = isChar(character) ? character : 'bolt';
    var k = sprites.length;
    var s = normSprite({
      id: 'sprite' + nextSpriteNo, character: ch, name: uniqueName(name || CHARACTERS[ch].name),
      x: k ? ((k * 70) % 260) - 130 : 0, y: k ? ((k * 50) % 160) - 80 : 0
    }, nextSpriteNo);
    nextSpriteNo++;
    sprites.push(s);
    if (!selectedId) selectedId = s.id;
    requestDraw();
    return s.id;
  };

  rt.removeSprite = function (id) {
    var s = findSprite(id);
    if (!s) return;
    killThreads(function (th) { return th.sprite === s; });
    sprites.splice(sprites.indexOf(s), 1);
    if (selectedId === id) selectedId = sprites.length ? sprites[0].id : null;
    requestDraw();
  };

  rt.selectSprite = function (id) { if (findSprite(id)) selectedId = id; };
  rt.getSelectedId = function () { return selectedId; };

  // The UI (sprite panel inputs, costume picker) changes sprites through here; no onSpriteChange echo.
  rt.updateSprite = function (id, patch) {
    var s = findSprite(id);
    if (!s || !patch) return;
    if (typeof patch.name === 'string') patch = Object.assign({}, patch, { name: uniqueName(patch.name.slice(0, 40) || s.name, s.id) });
    applyPatch(s, patch);
    requestDraw();
  };

  // Lists for the dynamic dropdowns in blocks.js
  rt.getCostumeNames = function (id) {
    var s = findSprite(id || selectedId);
    var out = [], c = s ? costumeCount(s.character) : 2;
    for (var i = 1; i <= c; i++) out.push('costume' + i);
    return out;
  };
  rt.getSpriteNames = function () {
    return sprites.filter(function (s) { return s.id !== selectedId; }).map(function (s) { return s.name; });
  };

  rt.setScripts = function (spriteId, compiled) {
    var s = findSprite(spriteId);
    if (!s) return;
    var list = compiled && compiled.scripts ? compiled.scripts : compiled;
    // Running threads keep their old code; the new code is used the next time a hat fires.
    s.scripts = Array.isArray(list) ? list.filter(function (x) { return x && x.hat && (x.make || x.run); }) : [];
  };

  /* ------------------------------------------------------------------ */
  /* Variables and monitors                                              */
  /* ------------------------------------------------------------------ */
  function findVar(name) {
    for (var i = 0; i < vars.length; i++) if (vars[i].name === name) return vars[i];
    return null;
  }
  function ensureVar(name) {
    var v = findVar(name);
    if (!v) { v = { name: String(name).slice(0, 60), value: 0, visible: false }; vars.push(v); }
    return v;
  }
  function cleanValue(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (typeof v === 'boolean') return v;
    return String(v === null || v === undefined ? '' : v).slice(0, 500);
  }

  rt.setVariables = function (list) {
    vars = [];
    (Array.isArray(list) ? list : []).forEach(function (v) {
      if (!v || typeof v.name !== 'string' || !v.name || findVar(v.name)) return;
      vars.push({ name: v.name.slice(0, 60), value: cleanValue(v.value === undefined ? 0 : v.value), visible: !!v.visible });
    });
    requestDraw();
  };
  rt.getVariables = function () {
    return vars.map(function (v) { return { name: v.name, value: v.value, visible: v.visible }; });
  };
  rt.setMonitorVisible = function (name, on) {
    var v = findVar(name);
    if (!v) return;
    v.visible = !!on;
    requestDraw();
  };

  /* ------------------------------------------------------------------ */
  /* Pen layer                                                           */
  /* ------------------------------------------------------------------ */
  function makePenLayer() {
    if (penCanvas || typeof document === 'undefined') return;
    penCanvas = document.createElement('canvas');
    penCanvas.width = W * PEN_SCALE;
    penCanvas.height = H * PEN_SCALE;
    penCtx = penCanvas.getContext('2d');
    if (penCtx) { penCtx.lineCap = 'round'; penCtx.lineJoin = 'round'; }
  }
  function penClearLayer() {
    if (penCtx) penCtx.clearRect(0, 0, penCanvas.width, penCanvas.height);
  }
  function penLine(s, x0, y0, x1, y1) {
    if (!penCtx) return;
    penCtx.strokeStyle = s.penColor;
    penCtx.lineWidth = 3 * PEN_SCALE;
    penCtx.beginPath();
    penCtx.moveTo((W / 2 + x0) * PEN_SCALE, (H / 2 - y0) * PEN_SCALE);
    penCtx.lineTo((W / 2 + x1) * PEN_SCALE, (H / 2 - y1) * PEN_SCALE);
    penCtx.stroke();
    stats.penSegments++;
  }

  /* ------------------------------------------------------------------ */
  /* Drawing                                                             */
  /* ------------------------------------------------------------------ */
  function requestDraw() { dirty = true; kick(); }

  function fit() {
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cssW = canvas.clientWidth || W;
    // A canvas with no CSS width is sized by its own backing store, so growing it would grow the
    // layout and loop. If the displayed size equals our backing size on a hi-dpi screen, keep it.
    if (dpr > 1 && cssW === canvas.width && canvas.width !== W) { scale = canvas.width / W; dirty = true; return; }
    var bw = Math.round(clamp(cssW * dpr, W, W * 3));
    var bh = Math.round(bw * H / W);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    scale = canvas.width / W;
    dirty = true;
  }

  function roundRectPath(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r);
    c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h);
    c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r);
    c.arcTo(x, y, x + r, y, r);
    c.closePath();
  }

  function drawBackground() {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(27,27,58,0.06)';
    ctx.beginPath();
    var i;
    for (i = 40; i < W; i += 40) { ctx.moveTo(i + 0.5, 0); ctx.lineTo(i + 0.5, H); }
    for (i = 40; i < H; i += 40) { ctx.moveTo(0, i + 0.5); ctx.lineTo(W, i + 0.5); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(27,27,58,0.12)';          // the two axes through the origin
    ctx.beginPath();
    ctx.moveTo(W / 2 + 0.5, 0); ctx.lineTo(W / 2 + 0.5, H);
    ctx.moveTo(0, H / 2 + 0.5); ctx.lineTo(W, H / 2 + 0.5);
    ctx.stroke();
  }

  function drawFallback(s, size) {
    // Shown while a picture loads or if it can't: a coloured round face in the character's colour.
    var col = (isChar(s.character) && CHARACTERS[s.character].color) || '#4C97FF';
    var r = size / 2;
    ctx.fillStyle = col;
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, size / 24);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(r * 0.28, -r * 0.18, r * 0.2, 0, Math.PI * 2);
    ctx.arc(-r * 0.28, -r * 0.18, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(r * 0.32, -r * 0.18, r * 0.09, 0, Math.PI * 2);
    ctx.arc(-r * 0.24, -r * 0.18, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSprite(s) {
    if (!s.visible) return;
    var size = NATURAL * s.size / 100;
    ctx.save();
    ctx.translate(W / 2 + s.x, H / 2 - s.y);
    ctx.rotate((s.direction - 90) * Math.PI / 180);     // artwork faces right = direction 90
    if (s.effect && filterOK) ctx.filter = 'hue-rotate(' + (s.effect * 3.6) + 'deg)';
    var rec = costumeRec(s), drawn = false;
    if (rec && rec.ready && !rec.failed) {
      try { ctx.drawImage(rec.img, -size / 2, -size / 2, size, size); drawn = true; } catch (e) { rec.failed = true; }
    }
    if (!drawn) drawFallback(s, size);
    ctx.restore();
  }

  var RTL_CHARS = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

  function wrapText(c, text, maxW) {
    var out = [];
    String(text).split(/\n/).forEach(function (para) {
      var words = para.split(/\s+/).filter(Boolean), line = '';
      if (!words.length) { out.push(''); return; }
      words.forEach(function (w) {
        // A single word wider than the bubble is cut by characters so nothing runs off the stage.
        while (c.measureText(w).width > maxW && w.length > 1) {
          var k = w.length;
          while (k > 1 && c.measureText(w.slice(0, k)).width > maxW) k--;
          if (line) { out.push(line); line = ''; }
          out.push(w.slice(0, k));
          w = w.slice(k);
        }
        var test = line ? line + ' ' + w : w;
        if (c.measureText(test).width <= maxW) line = test;
        else { out.push(line); line = w; }
      });
      if (line) out.push(line);
    });
    return out.slice(0, 8);
  }

  function drawBubble(s) {
    var b = s.bubble;
    if (!b || !s.visible) return;
    var fontPx = 14, pad = 10, lineH = 18, maxTextW = 150;
    ctx.font = '700 ' + fontPx + 'px ' + fontStack();
    var rtl = RTL_CHARS.test(b.text);
    ctx.direction = rtl ? 'rtl' : 'ltr';
    var lines = wrapText(ctx, b.text, maxTextW);
    var tw = 0;
    lines.forEach(function (l) { tw = Math.max(tw, ctx.measureText(l).width); });
    var bw = Math.max(36, tw + pad * 2), bh = lines.length * lineH + pad * 2 - 4;
    var half = NATURAL * s.size / 200;
    var cx = W / 2 + s.x, cy = H / 2 - s.y;
    var above = cy - half - 14 - bh >= 4;
    var bx = clamp(cx - bw / 2, 4, W - bw - 4);
    var by = above ? cy - half - 12 - bh : clamp(cy + half + 12, 4, H - bh - 4);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.fillStyle = '#FFFFFF';
    // A fully round pill would clip multi-line text, so cap the thought bubble's corner radius.
    roundRectPath(ctx, bx, by, bw, bh, b.think ? Math.min(bh / 2, 22) : 12);
    ctx.fill();
    ctx.stroke();
    var tx = clamp(cx, bx + 14, bx + bw - 14);
    if (b.think) {
      // Thought: two small circles trail towards the sprite.
      var dir = above ? 1 : -1, y0 = above ? by + bh : by;
      [[5, 9], [3, 17]].forEach(function (c) {
        ctx.beginPath();
        ctx.arc(tx, y0 + dir * c[1], c[0], 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    } else {
      // Speech: a small tail drawn over the border so it reads as one shape.
      var ty = above ? by + bh : by;
      var sgn = above ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(tx - 8, ty);
      ctx.lineTo(tx - 2, ty + sgn * 12);
      ctx.lineTo(tx + 8, ty);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tx - 8, ty);
      ctx.lineTo(tx - 2, ty + sgn * 12);
      ctx.lineTo(tx + 8, ty);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(tx - 7, ty - 1.2, 14, 2.4);                // hide the border under the tail's base
    }
    ctx.fillStyle = INK;
    ctx.textBaseline = 'middle';
    ctx.textAlign = rtl ? 'right' : 'left';
    var x0 = rtl ? bx + bw - pad : bx + pad;
    lines.forEach(function (l, i) { ctx.fillText(l, x0, by + pad - 2 + i * lineH + lineH / 2 - 1); });
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
  }

  function drawMonitors() {
    var y = 8;
    ctx.font = '800 12px ' + fontStack();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    vars.forEach(function (v) {
      if (!v.visible) return;
      var label = v.name, value = fmt(v.value);
      var rtl = RTL_CHARS.test(label + value);
      ctx.direction = rtl ? 'rtl' : 'ltr';
      var lw = ctx.measureText(label).width, vw = Math.max(26, ctx.measureText(value).width + 12);
      var h = 22, x = 8;
      var total = lw + vw + 20;
      ctx.fillStyle = '#FF8C1A';
      roundRectPath(ctx, x, y, total, h, 8);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      roundRectPath(ctx, x + lw + 14, y + 3, vw, h - 6, 6);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.textAlign = 'left';
      ctx.fillText(label, x + 7, y + h / 2 + 0.5);
      ctx.textAlign = 'center';
      ctx.fillText(value, x + lw + 14 + vw / 2, y + h / 2 + 0.5);
      ctx.textAlign = 'left';
      y += h + 5;
    });
    ctx.direction = 'ltr';
  }

  function draw() {
    if (!ctx) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = 1;
    if (filterOK) ctx.filter = 'none';
    drawBackground();
    if (penCanvas) ctx.drawImage(penCanvas, 0, 0, W, H);
    sprites.forEach(drawSprite);
    sprites.forEach(drawBubble);
    drawMonitors();
  }

  rt.render = function () { dirty = true; draw(); dirty = false; };
  rt.resize = function () { fit(); draw(); dirty = false; };

  /** Convert pointer coordinates to stage coordinates; null when outside the stage. */
  rt.stageFromEvent = function (e) {
    if (!canvas) return null;
    var r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    var x = (e.clientX - r.left) / r.width * W - W / 2;
    var y = H / 2 - (e.clientY - r.top) / r.height * H;
    if (x < -W / 2 || x > W / 2 || y < -H / 2 || y > H / 2) return null;
    return { x: Math.round(x), y: Math.round(y) };
  };

  rt.init = function (c) {
    canvas = c;
    ctx = c && c.getContext ? c.getContext('2d') : null;
    filterOK = !!(ctx && 'filter' in ctx);        // Safari: colour effect silently does nothing
    makePenLayer();
    loadImages();
    fit();
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () { fit(); draw(); dirty = false; }).observe(c);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', function () { fit(); draw(); dirty = false; });
    }
    // Sound can only start after a gesture, so unlock on the first one without bothering app.js.
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      document.addEventListener(ev, rt.unlockAudio, { capture: true, passive: true });
    });
    // Web fonts arrive late; redraw once they do so bubbles and monitors use them.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(requestDraw, function () {});
    draw();
    dirty = false;
  };

  /* ------------------------------------------------------------------ */
  /* Sound (Web Audio, no files)                                         */
  /* ------------------------------------------------------------------ */
  var audio = null, tones = [];

  rt.unlockAudio = function () {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audio) audio = new AC();
      if (audio.state === 'suspended' && !paused) audio.resume().catch(function () {});
    } catch (e) { /* no sound is fine */ }
  };

  function tone(freq, seconds, type, vol) {
    if (!audio || audio.state !== 'running' || tones.length > 24) return;
    try {
      var osc = audio.createOscillator(), gain = audio.createGain(), t0 = audio.currentTime;
      var rec = { osc: osc, gain: gain };
      osc.type = type;
      osc.frequency.value = clamp(freq, 20, 8000);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);                       // short attack: no click
      gain.gain.setValueAtTime(vol, t0 + Math.max(0.02, seconds - 0.05));
      gain.gain.linearRampToValueAtTime(0.0001, t0 + seconds);                 // short release
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.onended = function () {
        var i = tones.indexOf(rec);
        if (i >= 0) tones.splice(i, 1);
        try { osc.disconnect(); gain.disconnect(); } catch (e) { /* already gone */ }
      };
      tones.push(rec);
      osc.start(t0);
      osc.stop(t0 + seconds + 0.02);
    } catch (e) { /* ignore */ }
  }

  function stopAudio() {
    tones.slice().forEach(function (rec) {
      try { rec.osc.onended = null; rec.osc.stop(); rec.osc.disconnect(); rec.gain.disconnect(); } catch (e) { /* ok */ }
    });
    tones = [];
  }

  /* ------------------------------------------------------------------ */
  /* Threads and the scheduler                                           */
  /* ------------------------------------------------------------------ */
  function runState() { return paused ? 'paused' : (threads.length ? 'running' : 'idle'); }
  function pushState() {
    if (holdState) return;
    var s = runState();
    if (s !== lastState) { lastState = s; emit('onRunState', s); }
  }

  function litBlock(th, id) {
    if (th.hl === id) return;
    if (th.hl) unlit(th.sprite.id, th.hl);
    th.hl = id;
    if (id) {
      var key = th.sprite.id + '|' + id;
      hlCount[key] = (hlCount[key] || 0) + 1;
      if (hlCount[key] === 1) emit('onHighlight', th.sprite.id, id, true);
    }
  }
  function unlit(spriteId, blockId) {
    var key = spriteId + '|' + blockId;
    if (!hlCount[key]) return;
    hlCount[key]--;
    if (hlCount[key] <= 0) { delete hlCount[key]; emit('onHighlight', spriteId, blockId, false); }
  }

  function killThread(th) {
    if (th.done) return;
    th.done = true;
    try { th.gen.return(); } catch (e) { /* a running generator cannot be closed from inside; it ends on its own */ }
    litBlock(th, null);
  }
  function killThreads(pred) {
    var keep = [];
    threads.forEach(function (th) { if (pred(th)) killThread(th); else keep.push(th); });
    threads = keep;
    afterThreadsChanged();
  }
  function killAllThreads() { killThreads(function () { return true; }); }

  function afterThreadsChanged() {
    if (!threads.length) { tickActive = false; queue = []; qi = 0; flushChanges(true); }
    pushState();
  }

  function clearBubbles() { sprites.forEach(function (s) { s.bubble = null; }); }

  function spawn(sprite, script) {
    var key = sprite.id + ':' + script.blockId;
    // Restart-on-retrigger: clicking the flag again restarts the script instead of doubling it.
    for (var i = 0; i < threads.length; i++) {
      if (threads[i].key === key && !threads[i].done) { killThread(threads[i]); threads.splice(i, 1); break; }
    }
    var gen;
    try { gen = script.make ? script.make(rt, sprite) : script.run(rt, sprite); } catch (e) { return null; }
    var th = { key: key, sprite: sprite, gen: gen, depth: 0, blockId: null, hl: null, sleepUntil: 0, done: false, steps: 0 };
    threads.push(th);
    return th;
  }

  function trigger(kind, arg, only, noRestart) {
    var started = 0;
    sprites.forEach(function (s) {
      if (only && s !== only) return;
      s.scripts.forEach(function (sc) {
        if (sc.hat.kind !== kind) return;
        if (kind === 'key' && !(sc.hat.arg === 'any' || normKey(sc.hat.arg) === arg)) return;
        if (kind === 'receive' && normMsg(sc.hat.arg) !== arg) return;
        if (noRestart && threads.some(function (th) { return th.key === s.id + ':' + sc.blockId && !th.done; })) return;
        if (spawn(s, sc)) started++;
      });
    });
    if (started) { afterThreadsChanged(); kick(); }
    return started;
  }

  function handleError(th, e) {
    var kind = 'unknown', key = 'err.unknown';
    if (e instanceof BBError) { kind = e.kind; key = e.key; }
    else if (e instanceof RangeError) { kind = 'recursion'; key = 'err.recursion'; }   // call stack overflow
    else if (typeof console !== 'undefined' && console.warn) console.warn('BoltBlocks: script stopped', e);
    var blockId = th.blockId;
    killThread(th);
    emit('onError', { spriteId: th.sprite.id, blockId: blockId, kind: kind, message: t(key) });
  }

  // Resume one thread until it yields a frame (or finishes). Returns true if it ran out of budget.
  function runThread(th, t0) {
    cur = th;
    var count = 0;
    try {
      for (;;) {
        var r = th.gen.next();
        if (th.done) return false;                            // stopped from inside (e.g. an error handler)
        if (r.done) { th.done = true; litBlock(th, null); return false; }
        var v = r.value;
        if (v === STEP) {
          if (slow) { litBlock(th, th.blockId); th.sleepUntil = vnow + SLOW_MS; return false; }
          if ((++count & 63) === 0 && now() - t0 > BUDGET_MS) { litBlock(th, th.blockId); return true; }
          if (count > 200000) throw new BBError('loop', 'err.loop');
          continue;
        }
        if (v === STOP) { stopRequested = true; return false; }
        litBlock(th, th.blockId);                              // FRAME: show where this script is now
        return false;
      }
    } catch (e) {
      handleError(th, e);
      return false;
    } finally {
      cur = null;
    }
  }

  function runScheduler() {
    if (!tickActive) {
      if (vnow < nextTick) return;
      tickActive = true;
      queue = threads.slice();
      qi = 0;
      nextTick += FRAME_MS;
      if (nextTick < vnow - 100) nextTick = vnow;            // fell behind (tab was busy): don't burst
    }
    var t0 = now();
    while (qi < queue.length) {
      var th = queue[qi++];
      if (th.done || th.sleepUntil > vnow) continue;
      if (runThread(th, t0)) { qi--; break; }
      if (stopRequested) break;
      if (now() - t0 > BUDGET_MS) break;
    }
    if (qi >= queue.length) tickActive = false;
    if (stopRequested) { stopRequested = false; rt.stopAll(); return; }
    var alive = threads.filter(function (x) { return !x.done; });
    if (alive.length !== threads.length) { threads = alive; afterThreadsChanged(); }
    dirty = true;
  }

  function flushChanges(force) {
    var t1 = now();
    if (!force && t1 - lastFlush < 120) return;
    var ids = Object.keys(changed);
    if (!ids.length) return;
    lastFlush = t1;
    changed = Object.create(null);
    ids.forEach(function (id) { emit('onSpriteChange', id); });
  }
  function markChanged(s) { changed[s.id] = true; dirty = true; }

  function loop(ts) {
    raf = 0;
    var dt = lastTs ? Math.min(ts - lastTs, 100) : 16;     // a long stall must not skip a wait or glide
    lastTs = ts;
    if (!paused) vnow += dt;
    if (!paused && threads.length) { runScheduler(); flushChanges(false); }
    if (dirty) { dirty = false; draw(); }
    if (!paused && threads.length) kick();
    else { lastTs = 0; flushChanges(true); }
  }

  function kick() {
    if (raf || typeof requestAnimationFrame === 'undefined') return;
    raf = requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------------ */
  /* Run control                                                         */
  /* ------------------------------------------------------------------ */
  rt.startFlag = function () {
    holdState = true;
    stopEverything(false);
    timerStart = vnow;
    var started = trigger('flag', null, null, false);
    holdState = false;
    pushState();
    kick();
    return started;
  };

  function stopEverything(announce) {
    stopRequested = false;
    paused = false;
    killAllThreads();
    clearBubbles();
    stopAudio();
    cancelAsk();
    hlCount = Object.create(null);
    if (audio && audio.state === 'suspended') audio.resume().catch(function () {});
    requestDraw();
    if (announce) pushState();
  }

  rt.stopAll = function () { stopEverything(true); };
  rt.clearThreads = function () { killAllThreads(); requestDraw(); };

  rt.pause = function () {
    if (paused || !threads.length) return;
    paused = true;
    if (audio && audio.state === 'running') audio.suspend().catch(function () {});
    pushState();
  };
  rt.resume = function () {
    if (!paused) return;
    paused = false;
    if (audio && audio.state === 'suspended') audio.resume().catch(function () {});
    lastTs = 0;
    pushState();
    kick();
  };
  rt.setSlow = function (on) { slow = !!on; };
  rt.isSlow = function () { return slow; };
  rt.isRunning = function () { return threads.length > 0; };
  rt.isPaused = function () { return paused; };

  /* ------------------------------------------------------------------ */
  /* Input                                                               */
  /* ------------------------------------------------------------------ */
  var KEY_ALIASES = {
    arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right',
    ' ': 'space', spacebar: 'space', space: 'space', up: 'up', down: 'down', left: 'left', right: 'right', any: 'any'
  };
  function normKey(k) {
    if (typeof k !== 'string' || !k) return '';
    var low = k.toLowerCase();
    if (KEY_ALIASES[low]) return KEY_ALIASES[low];
    return /^[a-z0-9]$/.test(low) ? low : '';
  }
  function normMsg(m) { return String(m === null || m === undefined ? '' : m).trim().toLowerCase(); }

  rt.keyDown = function (key) {
    var k = normKey(key);
    if (!k) return;
    var repeat = keys.has(k);
    keys.add(k);
    if (stats.keysPressed.indexOf(k) < 0 && stats.keysPressed.length < 100) stats.keysPressed.push(k);
    // Key auto-repeat re-fires the hat, but only starts it again once the last run has finished,
    // so holding an arrow key moves smoothly instead of restarting the script every few ms.
    trigger('key', k, null, repeat);
  };
  rt.keyUp = function (key) { var k = normKey(key); if (k) keys.delete(k); };
  rt.setMouse = function (x, y) { mouse.x = clamp(Math.round(n(x)), -W / 2, W / 2); mouse.y = clamp(Math.round(n(y)), -H / 2, H / 2); };
  rt.pointerDown = function () { mouse.down = true; };
  rt.pointerUp = function () { mouse.down = false; };
  rt.stageClick = function (x, y) {
    rt.setMouse(x, y);
    for (var i = sprites.length - 1; i >= 0; i--) {                 // topmost first
      var s = sprites[i];
      if (!s.visible) continue;
      var r = Math.max(radius(s), 14);                                // keep tiny sprites easy to tap
      if (Math.hypot(mouse.x - s.x, mouse.y - s.y) <= r) { trigger('click', null, s, false); return s.id; }
    }
    return null;
  };

  /* ------------------------------------------------------------------ */
  /* Stats                                                               */
  /* ------------------------------------------------------------------ */
  rt.getStats = function () {
    return {
      penSegments: stats.penSegments,
      said: stats.said.slice(),
      messages: stats.messages.slice(),
      keysPressed: stats.keysPressed.slice(),
      spriteMoved: Object.assign(Object.create(null), stats.spriteMoved)
    };
  };
  rt.resetStats = function () { stats = freshStats(); };

  /* ------------------------------------------------------------------ */
  /* Script API: what generated code calls. Every function takes the     */
  /* sprite `S` first when it acts on one.                               */
  /* ------------------------------------------------------------------ */
  rt.step = function (id) { if (cur) cur.blockId = id; return STEP; };
  rt.frame = function () { return FRAME; };
  rt.stop = function () { return STOP; };
  rt.enter = function () {
    var th = cur || { depth: 0 };
    if (++th.depth > MAX_DEPTH) { th.depth--; throw new BBError('recursion', 'err.recursion'); }
    return th;
  };
  rt.leave = function (th) { if (th) th.depth--; };

  // values
  rt.n = n;
  rt.str = fmt;
  rt.truthy = function (x) { return x === true || (!!x && x !== 'false' && x !== '0'); };
  rt.count = function (x) { return clamp(Math.floor(n(x)), 0, 1e9); };
  rt.div = function (a, b) {
    if (b === 0) throw new BBError('math', 'err.math');
    return a / b;
  };
  rt.mod = function (a, b) {
    if (b === 0) throw new BBError('math', 'err.math');
    var r = a % b;
    return (r !== 0 && (r < 0) !== (b < 0)) ? r + b : r;
  };
  rt.pow = function (a, b) { var v = Math.pow(a, b); return isFinite(v) ? v : 0; };
  rt.random = function (a, b) {
    var lo = Math.ceil(Math.min(a, b)), hi = Math.floor(Math.max(a, b));
    if (hi < lo) hi = lo;
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  };
  rt.round = function (mode, x) { return mode === 'ROUNDUP' ? Math.ceil(x) : (mode === 'ROUNDDOWN' ? Math.floor(x) : Math.round(x)); };
  rt.compare = function (op, a, b) {
    var na = Number(a), nb = Number(b);
    var numeric = typeof a !== 'boolean' && typeof b !== 'boolean' && String(a).trim() !== '' && String(b).trim() !== '' &&
      isFinite(na) && isFinite(nb);
    var x = numeric ? na : fmt(a).toLowerCase(), y = numeric ? nb : fmt(b).toLowerCase();
    switch (op) {
      case 'EQ': return x === y;
      case 'NEQ': return x !== y;
      case 'LT': return x < y;
      case 'LTE': return x <= y;
      case 'GT': return x > y;
      case 'GTE': return x >= y;
      default: return false;
    }
  };
  rt.join = function () { return Array.prototype.map.call(arguments, fmt).join('').slice(0, 1000); };
  rt.len = function (x) { return fmt(x).length; };

  // variables
  rt.getVar = function (name) { var v = findVar(name); return v ? v.value : 0; };
  rt.setVar = function (name, value) { ensureVar(name).value = cleanValue(value); dirty = true; };
  rt.changeVar = function (name, d) {
    var v = ensureVar(name);
    v.value = n(v.value) + n(d);
    dirty = true;
  };
  rt.showVar = function (name) { ensureVar(name).visible = true; dirty = true; };
  rt.hideVar = function (name) { var v = findVar(name); if (v) { v.visible = false; dirty = true; } };

  // motion
  function fence(s, x, y) {
    // Keep at least 15 stage px (or the whole sprite if it is smaller) on the stage.
    var r = radius(s), keep = Math.min(15, r);
    return [clamp(x, -W / 2 + keep - r, W / 2 - keep + r), clamp(y, -H / 2 + keep - r, H / 2 - keep + r)];
  }
  function moveTo(s, x, y) {
    var p = fence(s, x, y);
    if (p[0] === s.x && p[1] === s.y) return;
    if (s.penDown) penLine(s, s.x, s.y, p[0], p[1]);
    s.x = p[0];
    s.y = p[1];
    stats.spriteMoved[s.id] = true;
    markChanged(s);
  }
  rt.move = function (S, steps) {
    var a = S.direction * Math.PI / 180;
    moveTo(S, S.x + steps * Math.sin(a), S.y + steps * Math.cos(a));
  };
  rt.turn = function (S, deg) { S.direction = wrapDir(S.direction + deg); markChanged(S); };
  rt.pointDir = function (S, d) { S.direction = wrapDir(d); markChanged(S); };
  rt.goTo = function (S, x, y) { moveTo(S, x, y); };
  rt.changeX = function (S, d) { moveTo(S, S.x + d, S.y); };
  rt.setX = function (S, x) { moveTo(S, x, S.y); };
  rt.changeY = function (S, d) { moveTo(S, S.x, S.y + d); };
  rt.setY = function (S, y) { moveTo(S, S.x, y); };
  rt.glide = function* (S, secs, x, y) {
    var dur = clamp(secs, 0, 3600) * 1000, x0 = S.x, y0 = S.y, t0 = vnow;
    if (dur <= 0) { moveTo(S, x, y); yield FRAME; return; }
    for (;;) {
      var f = Math.min(1, (vnow - t0) / dur);
      moveTo(S, x0 + (x - x0) * f, y0 + (y - y0) * f);
      if (f >= 1) return;
      yield FRAME;                                         // time-based, so slow machines still take `secs`
    }
  };
  rt.bounce = function (S) {
    var r = radius(S);
    var left = S.x - r + W / 2, right = W / 2 - (S.x + r), top = H / 2 - (S.y + r), bottom = S.y - r + H / 2;
    var m = Math.min(left, right, top, bottom);
    if (m >= 0) return;                                    // not on an edge
    var a = S.direction * Math.PI / 180, dx = Math.sin(a), dy = Math.cos(a);
    if (m === left) dx = Math.abs(dx);
    else if (m === right) dx = -Math.abs(dx);
    else if (m === top) dy = -Math.abs(dy);
    else dy = Math.abs(dy);
    S.direction = wrapDir(Math.atan2(dx, dy) * 180 / Math.PI);
    var nx = clamp(S.x, -W / 2 + r, W / 2 - r), ny = clamp(S.y, -H / 2 + r, H / 2 - r);
    if (W / 2 < r) nx = 0;
    if (H / 2 < r) ny = 0;
    moveTo(S, nx, ny);
    markChanged(S);
  };

  // looks
  function say(S, msg, think) {
    var text = fmt(msg).slice(0, 300);
    if (!text) { S.bubble = null; dirty = true; return 0; }
    S.bubble = { text: text, think: think, token: ++bubbleToken };
    if (stats.said.length < 200) stats.said.push({ spriteId: S.id, text: text });
    dirty = true;
    emit('onSay', S.id, text);
    return S.bubble.token;
  }
  rt.say = function (S, m) { say(S, m, false); };
  rt.think = function (S, m) { say(S, m, true); };
  rt.sayFor = function* (S, m, secs) {
    var tok = say(S, m, false);
    yield* rt.wait(S, secs);
    if (tok && S.bubble && S.bubble.token === tok) { S.bubble = null; dirty = true; }
  };
  rt.show = function (S) { S.visible = true; markChanged(S); };
  rt.hide = function (S) { S.visible = false; markChanged(S); };
  rt.nextCostume = function (S) { S.costume = (S.costume + 1) % costumeCount(S.character); markChanged(S); };
  rt.switchCostume = function (S, name) {
    var m = /(\d+)\s*$/.exec(String(name));
    if (!m) return;
    S.costume = clamp(Number(m[1]) - 1, 0, costumeCount(S.character) - 1);
    markChanged(S);
  };
  rt.changeSize = function (S, d) { S.size = clamp(S.size + d, 5, 500); markChanged(S); };
  rt.setSize = function (S, v) { S.size = clamp(v, 5, 500); markChanged(S); };
  rt.setEffect = function (S, v) { S.effect = ((v % 200) + 200) % 200; markChanged(S); };

  // sound
  rt.beep = function () { tone(660, 0.18, 'triangle', 0.18); };
  rt.playNote = function* (S, note, beats) {
    var secs = clamp(beats, 0, 32);                        // 60 bpm: one beat is one second
    var freq = 440 * Math.pow(2, (clamp(note, 0, 130) - 69) / 12);
    if (secs > 0) tone(freq, secs, 'triangle', 0.2);
    yield* rt.wait(S, secs);
  };

  // pen
  rt.penDown = function (S) { S.penDown = true; };
  rt.penUp = function (S) { S.penDown = false; };
  rt.penClear = function () { penClearLayer(); dirty = true; };
  rt.setPenColor = function (S, hex) { if (/^#[0-9a-fA-F]{6}$/.test(String(hex))) S.penColor = String(hex); };

  // control
  rt.wait = function* (S, secs) {
    var end = vnow + clamp(secs, 0, 3600) * 1000;
    do { yield FRAME; } while (vnow < end);                // always at least one frame, like Scratch
  };

  // sensing
  rt.touching = function (S, target) {
    if (!S.visible) return false;
    var r = radius(S);
    if (target === 'edge') {
      return S.x - r < -W / 2 || S.x + r > W / 2 || S.y - r < -H / 2 || S.y + r > H / 2;
    }
    if (target === 'mouse') return Math.hypot(mouse.x - S.x, mouse.y - S.y) <= r;
    for (var i = 0; i < sprites.length; i++) {
      var o = sprites[i];
      if (o !== S && o.visible && o.name === target) return Math.hypot(o.x - S.x, o.y - S.y) < r + radius(o);
    }
    return false;
  };
  rt.keyPressed = function (key) {
    var k = normKey(key);
    return k === 'any' ? keys.size > 0 : keys.has(k);
  };
  rt.mouseX = function () { return mouse.x; };
  rt.mouseY = function () { return mouse.y; };
  rt.answer = function () { return answerText; };
  rt.timer = function () { return Math.round((vnow - timerStart)) / 1000; };
  rt.resetTimer = function () { timerStart = vnow; };

  rt.askHandler = async function () { return ''; };       // app.js replaces this with the #ask-form

  rt.ask = function* (S, question) {
    while (askBusy) yield FRAME;                           // one question at a time, like Scratch
    askBusy = true;
    askActive = true;
    var ticket = ++askTicket, done = false;
    var q = fmt(question).slice(0, 300);
    S.bubble = q ? { text: q, think: false, token: ++bubbleToken } : null;
    dirty = true;
    var p;
    try { p = Promise.resolve(rt.askHandler(q)); } catch (e) { p = Promise.resolve(''); }
    p.then(function (v) {
      if (ticket !== askTicket) return;                    // Stop was pressed meanwhile
      answerText = fmt(v).slice(0, 200);
      done = true;
    }, function () {
      if (ticket !== askTicket) return;
      answerText = '';
      done = true;
    });
    try {
      while (!done) yield FRAME;
    } finally {
      if (ticket === askTicket) {
        askBusy = false;
        askActive = false;
        if (!done) emit('onAskCancel');                    // script was removed mid-question
      }
      if (S.bubble && S.bubble.text === q) { S.bubble = null; dirty = true; }
    }
  };

  function cancelAsk() {
    var was = askActive;
    askTicket++;
    askBusy = false;
    askActive = false;
    if (was) emit('onAskCancel');                          // app.js hides the ask form
  }

  // events
  rt.broadcast = function (S, msg) {
    var m = String(msg);
    if (stats.messages.indexOf(m) < 0 && stats.messages.length < 100) stats.messages.push(m);
    trigger('receive', normMsg(m), null, false);
  };

  // Event hooks (assign a function): onSpriteChange, onRunState, onHighlight, onError, onSay, onAskCancel
  rt.onSpriteChange = null;
  rt.onRunState = null;
  rt.onHighlight = null;
  rt.onError = null;
  rt.onSay = null;
  rt.onAskCancel = null;

})(window.BB = window.BB || {});
