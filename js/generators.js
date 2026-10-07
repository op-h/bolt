/*
 * BoltBlocks - js/generators.js  (CIRCUIT-1)
 * Turns a Blockly workspace into runnable scripts: one JavaScript generator function per hat block.
 * (ADR 0003: an async step-runner instead of a JS interpreter.)
 *
 * HOW TO ADD A BLOCK'S BEHAVIOUR  (after defining the block in js/blocks.js)
 *   1. Add one line to the table in install(): G.forBlock['bb_jump'] = function (b) { ... };
 *      - a statement block returns a string of code ending in "\n"
 *      - a value block returns [codeString, 0]
 *   2. Read inputs with num(b,'NAME'), text(b,'NAME'), bool(b,'NAME'); read dropdown/text FIELDS
 *      only through str(b.getFieldValue('NAME')). NEVER paste a field value into the code yourself.
 *   3. Do the real work in a function on BB.rt (js/runtime.js) and call it from the generated code:
 *        'rt.jump(S, ' + num(b, 'HEIGHT') + ');\n'
 *      If it takes time (waits, glides), make rt.jump a generator and emit 'yield* rt.jump(...)'.
 *
 * SECURITY (ADR 0003): the generated code is compiled with new Function, so it may contain ONLY
 *   - JSON.stringify()'d string literals       (str)
 *   - Number()-coerced, finite numeric literals (lit)
 *   - calls on rt.* and our own generated names (p0, a0, i3 ...)
 * Block ids, user text, variable names and procedure names are never used as code identifiers.
 */
(function (BB) {
  'use strict';

  var gen = BB.gen = BB.gen || {};
  var G = null;               // the Blockly.Generator instance, created on first use
  var ctx = null;             // per-compile scratch state

  function t(key) { return BB.blocks && BB.blocks.t ? BB.blocks.t(key) : key; }

  /* ---- literals: the only way data enters generated code ---- */
  function lit(v) {
    var n = Number(v);
    if (!isFinite(n)) n = 0;                    // NaN/Infinity -> 0 so code never contains them
    return (n < 0) ? '(' + String(n) + ')' : String(n);
  }
  function str(v) { return JSON.stringify(String(v === null || v === undefined ? '' : v)); }

  /* ---- input readers: all return a JS expression string ---- */
  function expr(b, name) { return G.valueToCode(b, name, 99); }   // 99 = NONE: we parenthesise ourselves

  function num(b, name, dflt) {
    var target = b.getInputTargetBlock(name);
    if (!target) return lit(dflt === undefined ? 0 : dflt);
    if (target.type === 'math_number') return lit(target.getFieldValue('NUM'));   // plain literal, fastest
    var c = expr(b, name);
    return c ? 'rt.n(' + c + ')' : lit(dflt === undefined ? 0 : dflt);
  }
  function text(b, name) { return expr(b, name) || '""'; }
  function bool(b, name) {
    var c = expr(b, name);
    return c ? 'rt.truthy(' + c + ')' : 'false';
  }
  function body(b, name) { return G.statementToCode(b, name); }

  function variableName(b) {
    var id = b.getFieldValue('VAR');
    var model = null;
    try { model = b.workspace.getVariableMap().getVariableById(id); } catch (e) { model = null; }
    return model ? model.getName() : '';
  }

  function install() {
    var F = G.forBlock;

    // ---- events: hats generate no code themselves; compile() reads their fields ----
    ['bb_when_flag', 'bb_when_key', 'bb_when_clicked', 'bb_when_receive'].forEach(function (type) {
      F[type] = function () { return ''; };
    });
    F.bb_broadcast = function (b) { return 'rt.broadcast(S, ' + str(b.getFieldValue('MSG')) + ');\n'; };

    // ---- motion ----
    F.bb_move = function (b) { return 'rt.move(S, ' + num(b, 'STEPS') + ');\n'; };
    F.bb_turn_right = function (b) { return 'rt.turn(S, ' + num(b, 'DEG') + ');\n'; };
    F.bb_turn_left = function (b) { return 'rt.turn(S, -' + num(b, 'DEG') + ');\n'; };
    F.bb_goto_xy = function (b) { return 'rt.goTo(S, ' + num(b, 'X') + ', ' + num(b, 'Y') + ');\n'; };
    F.bb_glide = function (b) {
      return 'yield* rt.glide(S, ' + num(b, 'SECS') + ', ' + num(b, 'X') + ', ' + num(b, 'Y') + ');\n';
    };
    F.bb_point_dir = function (b) { return 'rt.pointDir(S, ' + num(b, 'DIR') + ');\n'; };
    F.bb_change_x = function (b) { return 'rt.changeX(S, ' + num(b, 'X') + ');\n'; };
    F.bb_set_x = function (b) { return 'rt.setX(S, ' + num(b, 'X') + ');\n'; };
    F.bb_change_y = function (b) { return 'rt.changeY(S, ' + num(b, 'Y') + ');\n'; };
    F.bb_set_y = function (b) { return 'rt.setY(S, ' + num(b, 'Y') + ');\n'; };
    F.bb_bounce_edge = function () { return 'rt.bounce(S);\n'; };

    // ---- looks ----
    F.bb_say_for = function (b) { return 'yield* rt.sayFor(S, ' + text(b, 'MSG') + ', ' + num(b, 'SECS') + ');\n'; };
    F.bb_say = function (b) { return 'rt.say(S, ' + text(b, 'MSG') + ');\n'; };
    F.bb_think = function (b) { return 'rt.think(S, ' + text(b, 'MSG') + ');\n'; };
    F.bb_show = function () { return 'rt.show(S);\n'; };
    F.bb_hide = function () { return 'rt.hide(S);\n'; };
    F.bb_next_costume = function () { return 'rt.nextCostume(S);\n'; };
    F.bb_change_size = function (b) { return 'rt.changeSize(S, ' + num(b, 'SIZE') + ');\n'; };
    F.bb_set_size = function (b) { return 'rt.setSize(S, ' + num(b, 'SIZE') + ');\n'; };
    F.bb_switch_costume = function (b) { return 'rt.switchCostume(S, ' + str(b.getFieldValue('COSTUME')) + ');\n'; };
    F.bb_set_effect = function (b) { return 'rt.setEffect(S, ' + num(b, 'EFFECT') + ');\n'; };

    // ---- sound ----
    F.bb_play_beep = function () { return 'rt.beep();\n'; };
    F.bb_play_note = function (b) { return 'yield* rt.playNote(S, ' + num(b, 'NOTE', 60) + ', ' + num(b, 'BEATS', 0.5) + ');\n'; };

    // ---- pen ----
    F.bb_pen_down = function () { return 'rt.penDown(S);\n'; };
    F.bb_pen_up = function () { return 'rt.penUp(S);\n'; };
    F.bb_pen_clear = function () { return 'rt.penClear();\n'; };
    F.bb_set_pen_color = function (b) { return 'rt.setPenColor(S, ' + str(b.getFieldValue('COLOR')) + ');\n'; };

    // ---- control ----
    F.bb_wait = function (b) { return 'yield* rt.wait(S, ' + num(b, 'SECS') + ');\n'; };
    F.controls_repeat_ext = function (b) {
      var id = ++ctx.uid;
      var i = 'i' + id, n = 'n' + id;
      // One frame per iteration (about 33 ms) so loops animate and can never starve the page.
      return 'for (let ' + i + ' = 0, ' + n + ' = rt.count(' + num(b, 'TIMES', 10) + '); ' + i + ' < ' + n + '; ' + i + '++) {\n' +
        body(b, 'DO') + G.INDENT + 'yield rt.frame();\n}\n';
    };
    F.bb_forever = function (b) {
      return 'while (true) {\n' + body(b, 'DO') + G.INDENT + 'yield rt.frame();\n}\n';
    };
    F.controls_if = function (b) {
      var code = '', i = 0, c;
      while (b.getInput('IF' + i)) {
        c = bool(b, 'IF' + i);
        code += (i ? ' else ' : '') + 'if (' + c + ') {\n' + body(b, 'DO' + i) + '}';
        i++;
      }
      if (b.getInput('ELSE')) code += ' else {\n' + body(b, 'ELSE') + '}';
      return code + '\n';
    };
    F.bb_wait_until = function (b) { return 'while (!(' + bool(b, 'COND') + ')) {\n' + G.INDENT + 'yield rt.frame();\n}\n'; };
    // Stopping from inside a running generator would throw ("already running"), so signal the scheduler.
    F.bb_stop_all = function () { return 'yield rt.stop();\n'; };

    // ---- sensing ----
    F.bb_touching = function (b) { return ['rt.touching(S, ' + str(b.getFieldValue('TARGET')) + ')', 0]; };
    F.bb_key_pressed = function (b) { return ['rt.keyPressed(' + str(b.getFieldValue('KEY')) + ')', 0]; };
    F.bb_mouse_x = function () { return ['rt.mouseX()', 0]; };
    F.bb_mouse_y = function () { return ['rt.mouseY()', 0]; };
    F.bb_answer = function () { return ['rt.answer()', 0]; };
    F.bb_timer = function () { return ['rt.timer()', 0]; };
    F.bb_reset_timer = function () { return 'rt.resetTimer();\n'; };
    F.bb_ask = function (b) { return 'yield* rt.ask(S, ' + text(b, 'QUESTION') + ');\n'; };

    // ---- operators ----
    F.math_number = function (b) { return [lit(b.getFieldValue('NUM')), 0]; };
    F.math_arithmetic = function (b) {
      var a = num(b, 'A'), c = num(b, 'B');
      switch (b.getFieldValue('OP')) {
        case 'ADD': return ['(' + a + ' + ' + c + ')', 0];
        case 'MINUS': return ['(' + a + ' - ' + c + ')', 0];
        case 'MULTIPLY': return ['(' + a + ' * ' + c + ')', 0];
        case 'DIVIDE': return ['rt.div(' + a + ', ' + c + ')', 0];
        case 'POWER': return ['rt.pow(' + a + ', ' + c + ')', 0];
        default: return [lit(0), 0];
      }
    };
    F.math_random_int = function (b) { return ['rt.random(' + num(b, 'FROM', 1) + ', ' + num(b, 'TO', 10) + ')', 0]; };
    F.math_modulo = function (b) { return ['rt.mod(' + num(b, 'DIVIDEND') + ', ' + num(b, 'DIVISOR') + ')', 0]; };
    F.math_round = function (b) { return ['rt.round(' + str(b.getFieldValue('OP')) + ', ' + num(b, 'NUM') + ')', 0]; };
    F.logic_compare = function (b) {
      var A = expr(b, 'A') || '0', B = expr(b, 'B') || '0';
      return ['rt.compare(' + str(b.getFieldValue('OP')) + ', ' + A + ', ' + B + ')', 0];
    };
    F.logic_operation = function (b) {
      var op = b.getFieldValue('OP') === 'OR' ? ' || ' : ' && ';
      return ['(' + bool(b, 'A') + op + bool(b, 'B') + ')', 0];
    };
    F.logic_negate = function (b) { return ['!' + bool(b, 'BOOL'), 0]; };
    F.logic_boolean = function (b) { return [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', 0]; };
    F.text = function (b) { return [str(b.getFieldValue('TEXT')), 0]; };
    F.text_join = function (b) {
      var parts = [], i = 0;
      while (b.getInput('ADD' + i)) { parts.push(expr(b, 'ADD' + i) || '""'); i++; }
      return ['rt.join(' + parts.join(', ') + ')', 0];
    };
    F.text_length = function (b) { return ['rt.len(' + text(b, 'VALUE') + ')', 0]; };

    // ---- variables (global, by name; the name is data, never an identifier) ----
    F.variables_get = function (b) {
      var id = b.getFieldValue('VAR');
      if (ctx.params && ctx.params[id]) return [ctx.params[id], 0];       // a My Block parameter
      return ['rt.getVar(' + str(variableName(b)) + ')', 0];
    };
    F.variables_set = function (b) {
      var id = b.getFieldValue('VAR');
      var v = expr(b, 'VALUE') || '0';
      if (ctx.params && ctx.params[id]) return ctx.params[id] + ' = ' + v + ';\n';
      return 'rt.setVar(' + str(variableName(b)) + ', ' + v + ');\n';
    };
    F.math_change = function (b) {
      var id = b.getFieldValue('VAR');
      var d = num(b, 'DELTA', 1);
      if (ctx.params && ctx.params[id]) return ctx.params[id] + ' = rt.n(' + ctx.params[id] + ') + ' + d + ';\n';
      return 'rt.changeVar(' + str(variableName(b)) + ', ' + d + ');\n';
    };
    F.bb_show_variable = function (b) { return 'rt.showVar(' + str(variableName(b)) + ');\n'; };
    F.bb_hide_variable = function (b) { return 'rt.hideVar(' + str(variableName(b)) + ');\n'; };

    // ---- My Blocks ----
    F.procedures_callnoreturn = function (b) {
      var idx = ctx.procs[b.getFieldValue('NAME')];
      if (idx === undefined) return '';                                    // definition was deleted: do nothing
      var args = [], i = 0;
      while (b.getInput('ARG' + i)) { args.push(expr(b, 'ARG' + i) || '0'); i++; }
      return 'yield* p' + idx + '(' + args.join(', ') + ');\n';
    };
    // The definition block is compiled by compile(); reaching it as a statement means nothing to run.
    F.procedures_defnoreturn = function () { return ''; };
  }

  function ensure() {
    if (G) return G;
    if (typeof Blockly === 'undefined' || !Blockly.Generator) throw new Error('BoltBlocks: Blockly must be loaded before generators.js is used.');
    G = new Blockly.Generator('BB');
    G.STATEMENT_PREFIX = 'yield rt.step(%1);\n';      // highlight token; slow mode also waits here
    G.INDENT = '  ';
    G.isInitialized = true;
    // Block ids come from files kids can edit. Quote them as data, never splice them in raw.
    G.injectId = function (msg, block) {
      return msg.replace(/%1/g, function () { return JSON.stringify(String(block.id)); });
    };
    G.scrub_ = function (block, code, thisOnly) {
      var next = block.nextConnection && block.nextConnection.targetBlock();
      return code + (next && !thisOnly ? this.blockToCode(next) : '');
    };
    // Remember the block being generated so a failure can point at it.
    var original = G.blockToCode;
    G.blockToCode = function (block, thisOnly) {
      if (block && ctx) ctx.last = block.id;
      return original.call(this, block, thisOnly);
    };
    ctx = { uid: 0, procs: Object.create(null), params: null, last: null };
    install();
    return G;
  }

  function isEnabled(b) { return typeof b.isEnabled === 'function' ? b.isEnabled() : !b.disabled; }

  function friendly(blockId, key) { return { message: t(key || 'err.compile'), blockId: blockId || null }; }

  /**
   * Compile a live (or headless) workspace.
   * @returns {{scripts: Array<{hat:{kind:string,arg:(string|null)}, blockId:string, make:Function, run:Function, source:string}>,
   *            error: ({message:string, blockId:(string|null)}|null)}}
   *   scripts: only hat blocks produce scripts; stray blocks with no hat never run.
   *   If error is set, scripts holds the ones that compiled fine.
   */
  function compile(workspace) {
    var g = ensure();
    ctx = { uid: 0, procs: Object.create(null), params: null, last: null };
    var result = { scripts: [], error: null };
    try {
      var tops = workspace.getTopBlocks(true).filter(isEnabled);
      var procCode = '';
      var defs = [];

      // 1) Names first, so calls compile no matter where the definition sits.
      tops.forEach(function (b) {
        if (b.type !== 'procedures_defnoreturn') return;
        var name = b.getFieldValue('NAME');
        if (ctx.procs[name] === undefined) { ctx.procs[name] = defs.length; defs.push(b); }
      });

      // 2) Hoisted generator functions: p0, p1, ... with parameters a0, a1, ...
      defs.forEach(function (d, idx) {
        var params = Object.create(null), names = [];
        d.getVarModels().forEach(function (m, i) { params[m.getId()] = 'a' + i; names.push('a' + i); });
        ctx.params = params;
        var code = G.statementToCode(d, 'STACK');
        ctx.params = null;
        // Depth guard: runaway recursion becomes a friendly message, not a frozen tab.
        procCode += 'function* p' + idx + '(' + names.join(', ') + ') {\n' +
          '  var th = rt.enter();\n  try {\n' + code.replace(/^/gm, '  ') + '  } finally { rt.leave(th); }\n}\n';
      });

      // 3) One script per hat block.
      tops.forEach(function (hat) {
        var kind = BB.blocks.HAT_KINDS[hat.type];
        if (!kind) return;                                      // stray blocks: ignored, not run
        var arg = null;
        if (kind === 'key') arg = String(hat.getFieldValue('KEY') || 'space');
        else if (kind === 'receive') arg = String(hat.getFieldValue('MSG') || '').slice(0, 80);
        try {
          var next = hat.getNextBlock();
          var src = procCode + 'yield rt.step(' + JSON.stringify(String(hat.id)) + ');\n' + (next ? g.blockToCode(next) : '');
          var factory = new Function('rt', 'S', '"use strict";\nreturn function* () {\n' + src + '\n};');
          var make = function (rt, S) { return factory(rt, S)(); };
          result.scripts.push({
            hat: { kind: kind, arg: arg },
            blockId: hat.id,
            source: src,
            make: make,
            run: function* (rt, S) { yield* make(rt || BB.rt, S); }
          });
        } catch (e) {
          if (!result.error) result.error = friendly(ctx.last || hat.id, 'err.compile');
        }
      });
    } catch (e) {
      result.error = friendly(ctx && ctx.last, 'err.compile');
    }
    return result;
  }

  /** Compile an untrusted XML string in a throw-away headless workspace (the live one is never touched). */
  function compileXml(xml) {
    ensure();
    var check = BB.blocks.sanitizeXml(xml);
    if (!check.ok) return { scripts: [], error: { message: check.error, blockId: null } };
    var ws = null, out;
    try {
      ws = new Blockly.Workspace();
      var dom = Blockly.utils.xml.textToDom(xml);
      Blockly.Events.disable();
      try { Blockly.Xml.domToWorkspace(dom, ws); } finally { Blockly.Events.enable(); }
      out = compile(ws);
    } catch (e) {
      out = { scripts: [], error: friendly(null, 'err.compile') };
    } finally {
      if (ws) { try { ws.dispose(); } catch (e2) { /* nothing to clean */ } }
    }
    return out;
  }

  gen.compile = compile;
  gen.compileXml = compileXml;
  // Exposed for tests and the teacher "show code" idea: the literal helpers.
  gen._lit = lit;
  gen._str = str;

})(window.BB = window.BB || {});
