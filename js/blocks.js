/*
 * BoltBlocks - js/blocks.js  (CIRCUIT-1)
 * Block definitions, toolbox, Blockly theme/renderer, block-text i18n (en/ar), project XML whitelist.
 *
 * HOW TO ADD A BLOCK  (teachers: copy an existing block of the same shape)
 *   1. Define it: add one entry to buildDefs() below. A block is plain Blockly JSON:
 *        stack('bb_jump', 'motion_blocks', [val('HEIGHT')])      // statement block with one number slot
 *        rep('bb_score', 'variables_blocks')                     // round reporter (value block)
 *      The text on the block is the MSG key 'b.jump' (the block type minus the "bb_" prefix).
 *      "%1", "%2" in that text are the slots, in the same order as the args array.
 *   2. Put it in the toolbox: add `blk('bb_jump', { HEIGHT: num(20) })` to the right category in
 *      toolbox(). num(20) makes the default "20" shadow so kids can type straight away.
 *   3. Make it do something: add a generator for it in js/generators.js (same type name) and,
 *      if it needs a new action, a function on BB.rt in js/runtime.js.
 *   4. Add its words to BB.blocks.MSG.en and BB.blocks.MSG.ar below ('b.jump': 'jump %1').
 *      Arabic goes in the same place; put the slots (%1) where they read naturally in Arabic.
 *   5. Add the type name to CUSTOM_TYPES (that list is the whitelist for saved projects).
 *
 * Security: the loader must call BB.blocks.sanitizeXml() on every untrusted project BEFORE it
 * touches the live workspace. Generators never emit raw field text (see generators.js, ADR 0003).
 *
 * Blockly 13 note: field_colour no longer ships in core, so "bb_set_pen_color" uses a palette
 * dropdown with the same field name (COLOR) and hex values.
 */
(function (BB) {
  'use strict';

  var blocks = BB.blocks = BB.blocks || {};

  // ADR 0006: category fills are the exact brief hexes, text on them is dark ink (WCAG).
  var INK = '#1B1B3A';
  var CATEGORY_COLORS = {
    events: '#FFBF00', motion: '#4C97FF', looks: '#9966FF', sound: '#CF63CF', pen: '#00B4A6',
    control: '#FFAB19', sensing: '#5CB1D6', operators: '#59C059', variables: '#FF8C1A', myblocks: '#FF6680'
  };
  var CATEGORY_ORDER = ['events', 'motion', 'looks', 'sound', 'pen', 'control', 'sensing', 'operators', 'variables', 'myblocks'];
  var RENDERER = 'boltblocks_zelos';
  var FONT_FAMILY = 'Nunito, Cairo, "Segoe UI", system-ui, -apple-system, sans-serif';
  // Arabic: Cairo first, so Blockly's canvas text measuring never asks for Nunito (~39 kB it would not draw with).
  var FONT_FAMILY_AR = 'Cairo, "Segoe UI", Tahoma, system-ui, -apple-system, sans-serif';

  var HAT_KINDS = Object.assign(Object.create(null), { bb_when_flag: 'flag', bb_when_key: 'key', bb_when_clicked: 'click', bb_when_receive: 'receive' });

  /* ------------------------------------------------------------------ */
  /* Messages. Flat keys. Keys starting with "BKY_" are copied into      */
  /* Blockly.Msg (they re-word Blockly's own built-in blocks for kids).  */
  /* ------------------------------------------------------------------ */
  var MSG = {
    en: {
      'cat.events': 'Events', 'cat.motion': 'Motion', 'cat.looks': 'Looks', 'cat.sound': 'Sound', 'cat.pen': 'Pen',
      'cat.control': 'Control', 'cat.sensing': 'Sensing', 'cat.operators': 'Operators', 'cat.variables': 'Variables',
      'cat.myblocks': 'My Blocks',

      'b.when_flag': 'when green flag clicked',
      'b.when_key': 'when %1 key pressed',
      'b.when_clicked': 'when this character is clicked',
      'b.broadcast': 'broadcast %1',
      'b.when_receive': 'when I receive %1',
      'b.move': 'move %1 steps',
      'b.turn_right': 'turn right %1 degrees',
      'b.turn_left': 'turn left %1 degrees',
      'b.goto_xy': 'go to x: %1 y: %2',
      'b.glide': 'glide %1 secs to x: %2 y: %3',
      'b.point_dir': 'point in direction %1',
      'b.change_x': 'change x by %1',
      'b.set_x': 'set x to %1',
      'b.change_y': 'change y by %1',
      'b.set_y': 'set y to %1',
      'b.bounce_edge': 'if on edge, bounce',
      'b.say_for': 'say %1 for %2 seconds',
      'b.say': 'say %1',
      'b.think': 'think %1',
      'b.show': 'show',
      'b.hide': 'hide',
      'b.next_costume': 'next costume',
      'b.change_size': 'change size by %1',
      'b.set_size': 'set size to %1 percent',
      'b.switch_costume': 'switch costume to %1',
      'b.set_effect': 'set color effect to %1',
      'b.play_beep': 'play beep',
      'b.play_note': 'play note %1 for %2 beats',
      'b.pen_down': 'pen down',
      'b.pen_up': 'pen up',
      'b.pen_clear': 'erase all',
      'b.set_pen_color': 'set pen color to %1',
      'b.wait': 'wait %1 seconds',
      'b.forever': 'forever',
      'b.wait_until': 'wait until %1',
      'b.stop_all': 'stop all',
      'b.touching': 'touching %1 ?',
      'b.key_pressed': 'key %1 pressed?',
      'b.mouse_x': 'mouse x',
      'b.mouse_y': 'mouse y',
      'b.answer': 'answer',
      'b.timer': 'timer',
      'b.reset_timer': 'reset timer',
      'b.ask': 'ask %1 and wait',
      'b.show_variable': 'show variable %1',
      'b.hide_variable': 'hide variable %1',

      'target.edge': 'edge', 'target.mouse': 'mouse pointer',
      'key.space': 'space', 'key.up': 'up arrow', 'key.down': 'down arrow', 'key.left': 'left arrow',
      'key.right': 'right arrow', 'key.any': 'any key',
      'color.red': 'red', 'color.orange': 'orange', 'color.yellow': 'yellow', 'color.green': 'green',
      'color.blue': 'blue', 'color.purple': 'purple', 'color.brown': 'brown', 'color.black': 'black',

      'def.hello': 'Hello!', 'def.hmm': 'Hmm...', 'def.askName': "What's your name?", 'def.message': 'message1',
      'def.myBlock': 'my block',

      'ui.makeVar': 'Make a Variable', 'ui.makeBlock': 'Make a Block',
      'ui.newVar': 'New variable name:', 'ui.newBlock': 'Name your new block:',
      'ui.ok': 'OK', 'ui.cancel': 'Cancel',

      'err.compile': "Oops! One of the blocks doesn't look right.",
      'err.loop': 'A loop kept going without a break, so Bolt stopped it.',
      'err.recursion': 'A My Block keeps calling itself over and over. Bolt stopped it!',
      'err.math': "Oops! You can't divide by zero.",
      'err.unknown': 'Something went wrong with the blocks. Try again!',
      'err.badXml': "This project file doesn't look right.",
      'err.unknownBlock': "This project uses a block BoltBlocks doesn't know.",
      'err.unsafe': "This project has something that isn't allowed.",
      'err.tooBig': 'This project is too big to open.',

      // Blockly's own built-in blocks, re-worded for kids
      'BKY_CONTROLS_REPEAT_TITLE': 'repeat %1 times',
      'BKY_CONTROLS_REPEAT_INPUT_DO': '',
      'BKY_CONTROLS_IF_MSG_IF': 'if', 'BKY_CONTROLS_IF_MSG_THEN': 'then',
      'BKY_CONTROLS_IF_MSG_ELSE': 'else', 'BKY_CONTROLS_IF_MSG_ELSEIF': 'else if',
      'BKY_MATH_RANDOM_INT_TITLE': 'pick random %1 to %2',
      'BKY_MATH_MODULO_TITLE': 'remainder of %1 ÷ %2',
      'BKY_MATH_ROUND_OPERATOR_ROUND': 'round', 'BKY_MATH_ROUND_OPERATOR_ROUNDUP': 'round up',
      'BKY_MATH_ROUND_OPERATOR_ROUNDDOWN': 'round down',
      'BKY_LOGIC_NEGATE_TITLE': 'not %1',
      'BKY_LOGIC_OPERATION_AND': 'and', 'BKY_LOGIC_OPERATION_OR': 'or',
      'BKY_LOGIC_BOOLEAN_TRUE': 'true', 'BKY_LOGIC_BOOLEAN_FALSE': 'false',
      'BKY_TEXT_JOIN_TITLE_CREATEWITH': 'join',
      'BKY_TEXT_LENGTH_TITLE': 'length of %1',
      'BKY_VARIABLES_SET': 'set %1 to %2',
      'BKY_MATH_CHANGE_TITLE': 'change %1 by %2',
      'BKY_NEW_VARIABLE_TITLE': 'New variable name:',
      'BKY_PROCEDURES_DEFNORETURN_TITLE': 'define',
      'BKY_PROCEDURES_DEFNORETURN_PROCEDURE': 'my block',
      'BKY_PROCEDURES_BEFORE_PARAMS': 'with:',
      'BKY_PROCEDURES_CALL_BEFORE_PARAMS': 'with:'
    },
    ar: {
      'cat.events': 'الأحداث', 'cat.motion': 'الحركة', 'cat.looks': 'المظهر', 'cat.sound': 'الصوت', 'cat.pen': 'القلم',
      'cat.control': 'التحكم', 'cat.sensing': 'الاستشعار', 'cat.operators': 'العمليات', 'cat.variables': 'المتغيّرات',
      'cat.myblocks': 'كتلي',

      'b.when_flag': 'عند النقر على العلم الأخضر',
      'b.when_key': 'عند الضغط على المفتاح %1',
      'b.when_clicked': 'عند النقر على هذه الشخصية',
      'b.broadcast': 'أرسِل الرسالة %1',
      'b.when_receive': 'عند استلام الرسالة %1',
      'b.move': 'تحرّك %1 خطوة',
      'b.turn_right': 'استدر يمينًا %1 درجة',
      'b.turn_left': 'استدر يسارًا %1 درجة',
      'b.goto_xy': 'اذهب إلى س: %1 ص: %2',
      'b.glide': 'انزلق خلال %1 ثانية إلى س: %2 ص: %3',
      'b.point_dir': 'اتجه نحو الزاوية %1',
      'b.change_x': 'غيّر س بمقدار %1',
      'b.set_x': 'اجعل س يساوي %1',
      'b.change_y': 'غيّر ص بمقدار %1',
      'b.set_y': 'اجعل ص يساوي %1',
      'b.bounce_edge': 'إذا لمست الحافة فارتدّ',
      'b.say_for': 'قُل %1 لمدة %2 ثانية',
      'b.say': 'قُل %1',
      'b.think': 'فكّر في %1',
      'b.show': 'أظهِر',
      'b.hide': 'أخفِ',
      'b.next_costume': 'الزيّ التالي',
      'b.change_size': 'غيّر الحجم بمقدار %1',
      'b.set_size': 'اجعل الحجم %1 بالمئة',
      'b.switch_costume': 'بدّل الزيّ إلى %1',
      'b.set_effect': 'اجعل تأثير اللون %1',
      'b.play_beep': 'شغّل صوت بيب',
      'b.play_note': 'اعزف النغمة %1 لمدة %2 نبضة',
      'b.pen_down': 'أنزِل القلم',
      'b.pen_up': 'ارفع القلم',
      'b.pen_clear': 'امسح كل الرسم',
      'b.set_pen_color': 'اجعل لون القلم %1',
      'b.wait': 'انتظر %1 ثانية',
      'b.forever': 'كرّر دائمًا',
      'b.wait_until': 'انتظر حتى %1',
      'b.stop_all': 'أوقِف كل شيء',
      'b.touching': 'هل تلمس %1 ؟',
      'b.key_pressed': 'هل المفتاح %1 مضغوط؟',
      'b.mouse_x': 'موضع الفأرة س',
      'b.mouse_y': 'موضع الفأرة ص',
      'b.answer': 'الإجابة',
      'b.timer': 'المؤقّت',
      'b.reset_timer': 'صفّر المؤقّت',
      'b.ask': 'اسأل %1 وانتظر',
      'b.show_variable': 'أظهِر المتغيّر %1',
      'b.hide_variable': 'أخفِ المتغيّر %1',

      'target.edge': 'الحافة', 'target.mouse': 'مؤشّر الفأرة',
      'key.space': 'المسافة', 'key.up': 'السهم الأعلى', 'key.down': 'السهم الأسفل', 'key.left': 'السهم الأيسر',
      'key.right': 'السهم الأيمن', 'key.any': 'أي مفتاح',
      'color.red': 'أحمر', 'color.orange': 'برتقالي', 'color.yellow': 'أصفر', 'color.green': 'أخضر',
      'color.blue': 'أزرق', 'color.purple': 'بنفسجي', 'color.brown': 'بنّي', 'color.black': 'أسود',

      'def.hello': 'مرحبًا!', 'def.hmm': 'همم...', 'def.askName': 'ما اسمك؟', 'def.message': 'message1',
      'def.myBlock': 'كتلتي',

      'ui.makeVar': 'أنشئ متغيّرًا', 'ui.makeBlock': 'أنشئ كتلة',
      'ui.newVar': 'اسم المتغيّر الجديد:', 'ui.newBlock': 'اختر اسمًا للكتلة الجديدة:',
      'ui.ok': 'حسنًا', 'ui.cancel': 'إلغاء',

      'err.compile': 'عفوًا! إحدى الكتل ليست صحيحة.',
      'err.loop': 'استمرّت حلقة بلا توقّف، فأوقفها بولت.',
      'err.recursion': 'كتلة من كتلي تستدعي نفسها مرارًا وتكرارًا. أوقفها بولت!',
      'err.math': 'عفوًا! لا يمكن القسمة على صفر.',
      'err.unknown': 'حدث خطأ ما في الكتل. حاول مرة أخرى!',
      'err.badXml': 'ملف المشروع هذا غير صحيح.',
      'err.unknownBlock': 'يحتوي هذا المشروع على كتلة لا يعرفها بولت بلوكس.',
      'err.unsafe': 'يحتوي هذا المشروع على شيء غير مسموح به.',
      'err.tooBig': 'هذا المشروع كبير جدًا ولا يمكن فتحه.',

      'BKY_CONTROLS_REPEAT_TITLE': 'كرّر %1 مرّة',
      'BKY_CONTROLS_REPEAT_INPUT_DO': '',
      'BKY_CONTROLS_IF_MSG_IF': 'إذا', 'BKY_CONTROLS_IF_MSG_THEN': 'فافعل',
      'BKY_CONTROLS_IF_MSG_ELSE': 'وإلا', 'BKY_CONTROLS_IF_MSG_ELSEIF': 'وإذا',
      'BKY_MATH_RANDOM_INT_TITLE': 'اختر عددًا عشوائيًا من %1 إلى %2',
      'BKY_MATH_MODULO_TITLE': 'باقي قسمة %1 ÷ %2',
      'BKY_MATH_ROUND_OPERATOR_ROUND': 'قرّب', 'BKY_MATH_ROUND_OPERATOR_ROUNDUP': 'قرّب لأعلى',
      'BKY_MATH_ROUND_OPERATOR_ROUNDDOWN': 'قرّب لأسفل',
      'BKY_LOGIC_NEGATE_TITLE': 'ليس %1',
      'BKY_LOGIC_OPERATION_AND': 'و', 'BKY_LOGIC_OPERATION_OR': 'أو',
      'BKY_LOGIC_BOOLEAN_TRUE': 'صحيح', 'BKY_LOGIC_BOOLEAN_FALSE': 'خطأ',
      'BKY_TEXT_JOIN_TITLE_CREATEWITH': 'اربط',
      'BKY_TEXT_LENGTH_TITLE': 'طول %1',
      'BKY_VARIABLES_SET': 'اجعل %1 يساوي %2',
      'BKY_MATH_CHANGE_TITLE': 'غيّر %1 بمقدار %2',
      'BKY_NEW_VARIABLE_TITLE': 'اسم المتغيّر الجديد:',
      'BKY_PROCEDURES_DEFNORETURN_TITLE': 'عرّف',
      'BKY_PROCEDURES_DEFNORETURN_PROCEDURE': 'كتلتي',
      'BKY_PROCEDURES_BEFORE_PARAMS': 'مع:',
      'BKY_PROCEDURES_CALL_BEFORE_PARAMS': 'مع:'
    }
  };

  var lang = 'en';
  var definedFor = null;     // language the block definitions were last built for

  /** Look up a kid-readable message in the active language (falls back to English, then the key). */
  function t(key) {
    var table = MSG[lang] || MSG.en;
    // Own keys only: a key like 'constructor' must not resolve to Object.prototype's function.
    var own = Object.prototype.hasOwnProperty;
    var s = own.call(table, key) ? table[key] : undefined;
    if (s === undefined && own.call(MSG.en, key)) s = MSG.en[key];
    return s === undefined ? String(key) : s;
  }

  function pushBlocklyMessages() {
    if (typeof Blockly === 'undefined' || !Blockly.Msg) return;
    var table = MSG[lang] || MSG.en, k;
    // English first so a missing Arabic key still shows something readable.
    for (k in MSG.en) if (k.indexOf('BKY_') === 0) Blockly.Msg[k.slice(4)] = MSG.en[k];
    for (k in table) if (k.indexOf('BKY_') === 0) Blockly.Msg[k.slice(4)] = table[k];
  }

  /** Choose the block-text language. Safe to call before or after msg/*.js has loaded. */
  function setLanguage(l) {
    lang = (l === 'ar') ? 'ar' : 'en';
    pushBlocklyMessages();
    if (definedFor !== null && definedFor !== lang && typeof Blockly !== 'undefined') defineAll();
  }

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */
  var KEYS = ['space', 'up', 'down', 'left', 'right'];
  (function () {
    var i;
    for (i = 97; i <= 122; i++) KEYS.push(String.fromCharCode(i));
    for (i = 0; i <= 9; i++) KEYS.push(String(i));
    KEYS.push('any');
  })();

  function keyOptions() {
    return KEYS.map(function (k) {
      var label = (k.length === 1) ? k.toUpperCase() : t('key.' + k);
      return [label, k];
    });
  }

  // Pen palette: emoji squares because Blockly 13 has no field_colour; the stored value is the hex.
  var PALETTE = [
    ['red', '#E5484D', '🟥'], ['orange', '#FF8C1A', '🟧'], ['yellow', '#FFD60A', '🟨'],
    ['green', '#59C059', '🟩'], ['blue', '#4C97FF', '🟦'], ['purple', '#9966FF', '🟪'],
    ['brown', '#8B5A2B', '🟫'], ['black', '#1B1B3A', '⬛']
  ];
  var DEFAULT_PEN = '#4C97FF';

  function paletteOptions() {
    return PALETTE.map(function (p) { return [p[2] + ' ' + t('color.' + p[0]), p[1]]; });
  }

  function hexToRgb(h) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(h));
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function nearestPaletteHex(h) {
    var c = hexToRgb(h);
    if (!c) return null;
    var best = null, bd = Infinity;
    PALETTE.forEach(function (p) {
      var q = hexToRgb(p[1]);
      var d = Math.pow(c[0] - q[0], 2) + Math.pow(c[1] - q[1], 2) + Math.pow(c[2] - q[2], 2);
      if (d < bd) { bd = d; best = p[1]; }
    });
    return best;
  }

  // BB.rt may not exist yet when blocks are defined, and costume/sprite lists change at runtime.
  function rtCall(fn, fallback) {
    try {
      var rt = BB.rt;
      if (rt && typeof rt[fn] === 'function') {
        var v = rt[fn]();
        if (Array.isArray(v) && v.length) return v;
      }
    } catch (e) { /* the dropdown still works with the fallback list */ }
    return fallback;
  }

  function costumeNames() { return rtCall('getCostumeNames', ['costume1', 'costume2']); }

  function targetOptions() {
    var opts = [[t('target.edge'), 'edge'], [t('target.mouse'), 'mouse']];
    var names = rtCall('getSpriteNames', []);
    names.forEach(function (n) { if (typeof n === 'string' && n) opts.push([n, n]); });
    return opts;
  }

  // A dropdown that accepts a saved value even when it is not in the live list (for example a
  // sprite that has not been created yet while the project is loading), instead of silently
  // snapping to the first option and losing the kid's choice.
  function lenientDropdown(optionsFn) {
    var extra = null;
    var field = new Blockly.FieldDropdown(function () {
      var opts = optionsFn().slice();
      if (extra && !opts.some(function (o) { return o[1] === extra; })) opts.push([extra, extra]);
      return opts;
    });
    var original = field.doClassValidation_;
    field.doClassValidation_ = function (v) {
      if (typeof v === 'string' && v && v.length <= 60) {
        extra = v;
        this.generatedOptions = null;          // Blockly caches dynamic option lists; drop it so `extra` is seen
      }
      return original.call(this, v);
    };
    return field;
  }

  function paletteDropdown() {
    var field = new Blockly.FieldDropdown(paletteOptions);
    var original = field.doClassValidation_;
    field.doClassValidation_ = function (v) {
      // Old or hand-written projects may carry any hex; snap it to the closest palette colour.
      return original.call(this, nearestPaletteHex(v) || DEFAULT_PEN);
    };
    return field;
  }

  /* ------------------------------------------------------------------ */
  /* Block definitions                                                   */
  /* ------------------------------------------------------------------ */
  var val = function (name) { return { type: 'input_value', name: name }; };
  var boolIn = function (name) { return { type: 'input_value', name: name, check: 'Boolean' }; };
  var textField = function (name, text) { return { type: 'field_input', name: name, text: text }; };
  var dropdown = function (name, options) { return { type: 'field_dropdown', name: name, options: options }; };
  var shortName = function (type) { return type.replace(/^bb_/, ''); };

  function base(type, style, args, extra) {
    var def = { type: type, style: style, message0: t('b.' + shortName(type)), inputsInline: true };
    if (args && args.length) def.args0 = args;
    for (var k in extra) def[k] = extra[k];
    return def;
  }
  function hat(type, style, args) { return base(type, style, args, { nextStatement: null }); }
  function stack(type, style, args, extra) {
    var o = { previousStatement: null, nextStatement: null };
    for (var k in extra) o[k] = extra[k];
    return base(type, style, args, o);
  }
  function rep(type, style, args, output) {
    return base(type, style, args, { output: output === undefined ? null : output });
  }

  function buildDefs() {
    var defs = [
      hat('bb_when_flag', 'events_blocks'),
      hat('bb_when_key', 'events_blocks', [dropdown('KEY', keyOptions())]),
      hat('bb_when_clicked', 'events_blocks'),
      stack('bb_broadcast', 'events_blocks', [textField('MSG', t('def.message'))]),
      hat('bb_when_receive', 'events_blocks', [textField('MSG', t('def.message'))]),

      stack('bb_move', 'motion_blocks', [val('STEPS')]),
      stack('bb_turn_right', 'motion_blocks', [val('DEG')]),
      stack('bb_turn_left', 'motion_blocks', [val('DEG')]),
      stack('bb_goto_xy', 'motion_blocks', [val('X'), val('Y')]),
      stack('bb_glide', 'motion_blocks', [val('SECS'), val('X'), val('Y')]),
      stack('bb_point_dir', 'motion_blocks', [val('DIR')]),
      stack('bb_change_x', 'motion_blocks', [val('X')]),
      stack('bb_set_x', 'motion_blocks', [val('X')]),
      stack('bb_change_y', 'motion_blocks', [val('Y')]),
      stack('bb_set_y', 'motion_blocks', [val('Y')]),
      stack('bb_bounce_edge', 'motion_blocks'),

      stack('bb_say_for', 'looks_blocks', [val('MSG'), val('SECS')]),
      stack('bb_say', 'looks_blocks', [val('MSG')]),
      stack('bb_think', 'looks_blocks', [val('MSG')]),
      stack('bb_show', 'looks_blocks'),
      stack('bb_hide', 'looks_blocks'),
      stack('bb_next_costume', 'looks_blocks'),
      stack('bb_change_size', 'looks_blocks', [val('SIZE')]),
      stack('bb_set_size', 'looks_blocks', [val('SIZE')]),
      stack('bb_switch_costume', 'looks_blocks', [{ type: 'input_dummy', name: 'PICK' }]),
      stack('bb_set_effect', 'looks_blocks', [val('EFFECT')]),

      stack('bb_play_beep', 'sound_blocks'),
      stack('bb_play_note', 'sound_blocks', [val('NOTE'), val('BEATS')]),

      stack('bb_pen_down', 'pen_blocks'),
      stack('bb_pen_up', 'pen_blocks'),
      stack('bb_pen_clear', 'pen_blocks'),
      stack('bb_set_pen_color', 'pen_blocks', [{ type: 'input_dummy', name: 'PICK' }]),

      stack('bb_wait', 'control_blocks', [val('SECS')]),
      base('bb_forever', 'control_blocks', null, {
        message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }], previousStatement: null
      }),
      stack('bb_wait_until', 'control_blocks', [boolIn('COND')]),
      base('bb_stop_all', 'control_blocks', null, { previousStatement: null }),

      rep('bb_touching', 'sensing_blocks', [{ type: 'input_dummy', name: 'PICK' }], 'Boolean'),
      rep('bb_key_pressed', 'sensing_blocks', [dropdown('KEY', keyOptions())], 'Boolean'),
      rep('bb_mouse_x', 'sensing_blocks'),
      rep('bb_mouse_y', 'sensing_blocks'),
      rep('bb_answer', 'sensing_blocks'),
      rep('bb_timer', 'sensing_blocks'),
      stack('bb_reset_timer', 'sensing_blocks'),
      stack('bb_ask', 'sensing_blocks', [val('QUESTION')]),

      stack('bb_show_variable', 'variables_blocks', [{ type: 'field_variable', name: 'VAR', variable: null }]),
      stack('bb_hide_variable', 'variables_blocks', [{ type: 'field_variable', name: 'VAR', variable: null }])
    ];
    // Blocks whose picker is built in code (dynamic list or palette) get their field after jsonInit.
    var after = {
      bb_switch_costume: function () {
        this.getInput('PICK').appendField(lenientDropdown(function () {
          return costumeNames().map(function (n) { return [n, n]; });
        }), 'COSTUME');
      },
      bb_touching: function () {
        this.getInput('PICK').appendField(lenientDropdown(targetOptions), 'TARGET');
      },
      bb_set_pen_color: function () {
        this.getInput('PICK').appendField(paletteDropdown(), 'COLOR');
      }
    };
    defs.forEach(function (d) { if (after[d.type]) d.__after = after[d.type]; });
    return defs;
  }

  // KNOWN_TYPES is computed from static data so it works before Blockly or any language is loaded.
  var CUSTOM_TYPES = [
    'bb_when_flag', 'bb_when_key', 'bb_when_clicked', 'bb_broadcast', 'bb_when_receive',
    'bb_move', 'bb_turn_right', 'bb_turn_left', 'bb_goto_xy', 'bb_glide', 'bb_point_dir',
    'bb_change_x', 'bb_set_x', 'bb_change_y', 'bb_set_y', 'bb_bounce_edge',
    'bb_say_for', 'bb_say', 'bb_think', 'bb_show', 'bb_hide', 'bb_next_costume', 'bb_change_size',
    'bb_set_size', 'bb_switch_costume', 'bb_set_effect',
    'bb_play_beep', 'bb_play_note',
    'bb_pen_down', 'bb_pen_up', 'bb_pen_clear', 'bb_set_pen_color',
    'bb_wait', 'bb_forever', 'bb_wait_until', 'bb_stop_all',
    'bb_touching', 'bb_key_pressed', 'bb_mouse_x', 'bb_mouse_y', 'bb_answer', 'bb_timer',
    'bb_reset_timer', 'bb_ask', 'bb_show_variable', 'bb_hide_variable'
  ];
  // Blockly built-ins we allow. "text" and "math_number" are the shadow/literal blocks.
  var BUILTIN_TYPES = [
    'controls_repeat_ext', 'controls_if', 'math_number', 'math_arithmetic', 'math_random_int', 'math_modulo',
    'math_round', 'logic_compare', 'logic_operation', 'logic_negate', 'logic_boolean', 'text', 'text_join',
    'text_length', 'variables_get', 'variables_set', 'math_change', 'procedures_defnoreturn',
    'procedures_callnoreturn'
  ];
  var KNOWN_TYPES = new Set(CUSTOM_TYPES.concat(BUILTIN_TYPES));

  // Built-in block -> the style (and so the colour) it must wear in our categories.
  // logic_blocks is shared by "if" (control) and the green operators, so "if" is patched by name.
  var BUILTIN_STYLE_OVERRIDES = { controls_if: 'control_blocks' };

  var defsBuilt = false;

  function requireBlockly() {
    if (typeof Blockly === 'undefined' || !Blockly.Blocks) throw new Error('BoltBlocks: Blockly must be loaded before blocks.js is used.');
  }

  /** Define every block. Idempotent; call again only after setLanguage() changes the language. */
  function defineAll() {
    requireBlockly();
    pushBlocklyMessages();
    registerRenderer();
    registerToolboxItem();
    installDialogs();
    buildDefs().forEach(function (def) {
      var after = def.__after;
      delete def.__after;
      Blockly.Blocks[def.type] = {
        init: function () {
          this.jsonInit(def);
          if (after) after.call(this);
        }
      };
    });
    // Blockly's "text" block wears quote marks and a nested box; as one field it renders like a
    // number shadow (a clean white pill). Same type and field name, so saved XML is unchanged.
    Blockly.Blocks.text = {
      init: function () {
        this.jsonInit({
          type: 'text', style: 'text_blocks', output: 'String',
          message0: '%1', args0: [{ type: 'field_input', name: 'TEXT', text: '' }]
        });
      }
    };
    if (!defsBuilt) {
      Object.keys(BUILTIN_STYLE_OVERRIDES).forEach(function (type) {
        var b = Blockly.Blocks[type];
        if (!b || typeof b.init !== 'function') return;
        var original = b.init;
        b.init = function () { original.call(this); this.setStyle(BUILTIN_STYLE_OVERRIDES[type]); };
      });
    }
    defsBuilt = true;
    definedFor = lang;
  }

  /* ------------------------------------------------------------------ */
  /* Theme + renderer                                                    */
  /* ------------------------------------------------------------------ */
  function mix(hex, toward, amt) {
    var a = hexToRgb(hex), b = hexToRgb(toward);
    var c = a.map(function (v, i) { return Math.round(v + (b[i] - v) * amt); });
    return '#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }

  function style(hex, isHat) {
    var s = {
      colourPrimary: hex,                      // fill: the exact brief hex
      colourSecondary: mix(hex, '#FFFFFF', 0.35),
      colourTertiary: mix(hex, INK, 0.45)      // outline: darker shade of the same hue (thick, readable)
    };
    if (isHat) s.hat = 'cap';
    return s;
  }

  var themes = Object.create(null);

  /** Build (once) and return the Blockly theme. mode: 'dark' for dark UI, anything else = light. */
  function makeTheme(mode) {
    requireBlockly();
    var dark = (mode === 'dark' || mode === true);
    var name = (dark ? 'boltblocksdark' : 'boltblockslight') + (lang === 'ar' ? 'ar' : '');
    if (themes[name]) return themes[name];
    var C = CATEGORY_COLORS;
    var styles = {
      events_blocks: style(C.events, true), motion_blocks: style(C.motion), looks_blocks: style(C.looks),
      sound_blocks: style(C.sound), pen_blocks: style(C.pen), control_blocks: style(C.control),
      sensing_blocks: style(C.sensing), operators_blocks: style(C.operators),
      variables_blocks: style(C.variables), myblocks_blocks: style(C.myblocks, true),
      // Built-in style names, mapped onto our categories so Blockly's own blocks match.
      logic_blocks: style(C.operators), loop_blocks: style(C.control), math_blocks: style(C.operators),
      text_blocks: style(C.operators), variable_blocks: style(C.variables),
      variable_dynamic_blocks: style(C.variables), procedure_blocks: style(C.myblocks, true),
      list_blocks: style(C.variables), colour_blocks: style(C.pen)
    };
    var categoryStyles = Object.create(null);
    CATEGORY_ORDER.forEach(function (k) { categoryStyles[k + '_category'] = { colour: C[k] }; });
    var comp = dark ? {
      workspaceBackgroundColour: '#15152B', toolboxBackgroundColour: '#23233F', toolboxForegroundColour: '#F2F2FA',
      flyoutBackgroundColour: '#2B2B4D', flyoutForegroundColour: '#F2F2FA', flyoutOpacity: 1,
      scrollbarColour: '#8A8AB5', scrollbarOpacity: 0.6, insertionMarkerColour: '#FFFFFF',
      insertionMarkerOpacity: 0.3
    } : {
      workspaceBackgroundColour: '#F7F8FF', toolboxBackgroundColour: '#FFFFFF', toolboxForegroundColour: INK,
      flyoutBackgroundColour: '#EEF0FB', flyoutForegroundColour: INK, flyoutOpacity: 1,
      scrollbarColour: '#6B6B95', scrollbarOpacity: 0.5, insertionMarkerColour: INK,
      insertionMarkerOpacity: 0.25
    };
    themes[name] = Blockly.Theme.defineTheme(name, {
      name: name,
      base: Blockly.Themes.Zelos,
      blockStyles: styles,
      categoryStyles: categoryStyles,
      componentStyles: comp,
      fontStyle: { family: lang === 'ar' ? FONT_FAMILY_AR : FONT_FAMILY, weight: '800', size: 12 },
      startHats: true     // hat-shaped top on every block with no previous/output connection
    });
    return themes[name];
  }

  var rendererRegistered = false;

  // Zelos paints block text white. ADR 0006 says ink; the cleanest supported seam is a
  // ConstantProvider subclass whose getCSS_ appends our overrides to Blockly's own stylesheet.
  function registerRenderer() {
    if (rendererRegistered) return;
    var Z = Blockly.zelos;
    class Constants extends Z.ConstantProvider {
      constructor() {
        super();
        // Text glyph arrow (inherits the ink text colour) instead of Blockly's white SVG arrow.
        this.FIELD_DROPDOWN_SVG_ARROW = false;
      }
      getCSS_(sel) {
        return super.getCSS_(sel).concat([
          sel + ' .blocklyText:not(.blocklyBubbleText) { fill: ' + INK + '; }',
          sel + ' .blocklyNonEditableField>text, ' + sel + ' .blocklyEditableField>text, ' +
            sel + ' .blocklyNonEditableField>g>text, ' + sel + ' .blocklyEditableField>g>text { fill: ' + INK + '; }',
          sel + ' .blocklyDropdownText, ' + sel + ' .blocklyDropdownText>tspan { fill: ' + INK + ' !important; }',
          // Scratch idiom (ADR 0006): dropdowns are white pills with ink text.
          sel + ' .blocklyDropdownRect { fill: #fff !important; stroke: none; rx: 14px; ry: 14px; }',
          sel + ' .blocklyHtmlInput { color: ' + INK + '; }',
          sel + '.blocklyDropDownDiv .blocklyMenuItemContent, ' +
            sel + '.blocklyWidgetDiv .blocklyMenuItemContent { color: ' + INK + '; }',
          // Default look for a block that is executing; PRISM may restyle .bb-running.
          sel + ' .bb-running>.blocklyPath { stroke: ' + INK + '; stroke-width: 4px; }'
        ]);
      }
    }
    class Renderer extends Z.Renderer {
      makeConstants_() { return new Constants(); }
    }
    Blockly.blockRendering.register(RENDERER, Renderer);
    rendererRegistered = true;
  }

  /* ------------------------------------------------------------------ */
  /* Toolbox category with a round colour dot                            */
  /* ------------------------------------------------------------------ */
  var toolboxRegistered = false;

  function registerToolboxItem() {
    if (toolboxRegistered) return;
    var Base = Blockly.ToolboxCategory;
    class Category extends Base {
      // Blockly 13 writes the item id onto both the container (treeitem) and the click row, so every
      // category had two elements with one id. The container keeps the id (aria-activedescendant points
      // at it). Blockly's onClick_ only reads getAttribute('id') on the row, so the row answers that call
      // without carrying the attribute in the DOM.
      getClickTarget() {
        if (!this.bbIdSink) this.bbIdSink = document.createElement('span');
        return this.bbIdSink;
      }
      createDom_() {
        var dom = super.createDom_();
        var row = this.rowDiv_, id = this.getId(), native = Element.prototype.getAttribute;
        if (row) row.getAttribute = function (name) { return name === 'id' ? id : native.call(this, name); };
        return dom;
      }
      createIconDom_() {
        var dot = document.createElement('span');
        dot.className = 'bb-cat-dot';
        dot.setAttribute('aria-hidden', 'true');
        // Inline CSSOM styles (CSP-safe) so the dot works before PRISM's stylesheet loads.
        dot.style.display = 'inline-block';
        dot.style.width = '16px';
        dot.style.height = '16px';
        dot.style.borderRadius = '50%';
        dot.style.flex = 'none';
        dot.style.backgroundColor = this.colour_ || '#999';
        dot.style.boxShadow = 'inset 0 0 0 2px rgba(27,27,58,.35)';
        return dot;
      }
      makeDefaultCssConfig_() {
        var cfg = super.makeDefaultCssConfig_();
        // Not Blockly's "blocklyToolboxSelected": it forces white text, which fails on our bright fills.
        cfg.selected = 'bb-cat-selected';
        return cfg;
      }
      addColourBorder_() {
        // The dot carries the colour; no coloured edge bar.
        if (this.rowDiv_) this.rowDiv_.setAttribute('data-bb-colour', this.colour_ || '');
      }
      setSelected(isSelected) {
        super.setSelected(isSelected);
        // Base paints the whole row in the category colour; a neutral tint keeps ink text readable.
        if (this.rowDiv_) this.rowDiv_.style.backgroundColor = isSelected ? 'rgba(127,127,170,.22)' : '';
      }
    }
    Blockly.registry.register(Blockly.registry.Type.TOOLBOX_ITEM, Base.registrationName, Category, true);
    toolboxRegistered = true;
  }

  /* ------------------------------------------------------------------ */
  /* Dialogs: never window.prompt / alert / confirm                      */
  /* ------------------------------------------------------------------ */
  // app.js may assign these hooks; otherwise we fall back to the native <dialog>s in index.html.
  blocks.promptHandler = null;    // function (message, defaultValue, callback(string|null))
  blocks.confirmHandler = null;   // function (message, callback(boolean))
  blocks.noticeHandler = null;    // function (message)

  function byId(id) { return document.getElementById(id); }

  function domPrompt(message, def, cb) {
    var dlg = byId('dlg-prompt'), form = dlg && dlg.querySelector('form'), input = byId('prompt-input'), label = byId('prompt-label');
    if (!dlg || !form || !input || typeof dlg.showModal !== 'function') { cb(null); return; }
    var done = false;
    var err = byId('prompt-error');
    if (err) err.textContent = '';
    if (label) label.textContent = message;
    input.value = def || '';
    function finish(v) {
      if (done) return;
      done = true;
      form.removeEventListener('submit', onSubmit);
      dlg.removeEventListener('close', onClose);
      var cancel = byId('prompt-cancel');
      if (cancel) cancel.removeEventListener('click', onCancel);
      if (dlg.open) dlg.close();
      cb(v);
    }
    function onSubmit(e) { e.preventDefault(); finish(input.value.trim() || null); }
    function onCancel(e) { e.preventDefault(); finish(null); }
    function onClose() { finish(null); }
    form.addEventListener('submit', onSubmit);
    dlg.addEventListener('close', onClose);
    var cancelBtn = byId('prompt-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
    dlg.showModal();
    input.focus();
    input.select();
  }

  function domConfirm(message, cb) {
    var dlg = byId('dlg-confirm'), text = byId('confirm-text'), ok = byId('confirm-ok'), no = byId('confirm-cancel');
    if (!dlg || !ok || !no || typeof dlg.showModal !== 'function') { cb(false); return; }
    var done = false;
    if (text) text.textContent = message;
    function finish(v) {
      if (done) return;
      done = true;
      ok.removeEventListener('click', onOk);
      no.removeEventListener('click', onNo);
      dlg.removeEventListener('close', onNo);
      if (dlg.open) dlg.close();
      cb(v);
    }
    function onOk() { finish(true); }
    function onNo() { finish(false); }
    ok.addEventListener('click', onOk);
    no.addEventListener('click', onNo);
    dlg.addEventListener('close', onNo);
    dlg.showModal();
  }

  function domNotice(message) {
    var region = byId('toast-region');
    if (!region) return;
    var el = document.createElement('div');
    el.className = 'toast toast--info';
    el.textContent = message;
    region.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 4500);
  }

  var dialogsInstalled = false;
  function installDialogs() {
    if (dialogsInstalled || !Blockly.dialog) return;
    Blockly.dialog.setPrompt(function (message, def, cb) {
      try {
        if (typeof blocks.promptHandler === 'function') blocks.promptHandler(message, def, cb);
        else domPrompt(message, def, cb);
      } catch (e) { cb(null); }
    });
    Blockly.dialog.setConfirm(function (message, cb) {
      try {
        if (typeof blocks.confirmHandler === 'function') blocks.confirmHandler(message, cb);
        else domConfirm(message, cb);
      } catch (e) { cb(false); }
    });
    Blockly.dialog.setAlert(function (message, cb) {
      try {
        if (typeof blocks.noticeHandler === 'function') blocks.noticeHandler(message);
        else domNotice(message);
      } catch (e) { /* a missed notice must never break editing */ }
      if (typeof cb === 'function') cb();
    });
    dialogsInstalled = true;
  }

  /* ------------------------------------------------------------------ */
  /* Toolbox                                                             */
  /* ------------------------------------------------------------------ */
  function num(n) { return { shadow: { type: 'math_number', fields: { NUM: n } } }; }
  function txt(s) { return { shadow: { type: 'text', fields: { TEXT: s } } }; }
  function blk(type, inputs, fields, extra) {
    var o = { kind: 'block', type: type };
    if (inputs) o.inputs = inputs;
    if (fields) o.fields = fields;
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  function toolbox() {
    var C = CATEGORY_COLORS;
    function cat(key, contents, custom) {
      var c = { kind: 'category', name: t('cat.' + key), colour: C[key] };
      if (custom) c.custom = custom; else c.contents = contents;
      return c;
    }
    return {
      kind: 'categoryToolbox',
      contents: [
        cat('events', [
          blk('bb_when_flag'), blk('bb_when_key', null, { KEY: 'space' }), blk('bb_when_clicked'),
          blk('bb_broadcast', null, { MSG: t('def.message') }),
          blk('bb_when_receive', null, { MSG: t('def.message') })
        ]),
        cat('motion', [
          blk('bb_move', { STEPS: num(10) }),
          blk('bb_turn_right', { DEG: num(15) }), blk('bb_turn_left', { DEG: num(15) }),
          blk('bb_goto_xy', { X: num(0), Y: num(0) }),
          blk('bb_glide', { SECS: num(1), X: num(0), Y: num(0) }),
          blk('bb_point_dir', { DIR: num(90) }),
          blk('bb_change_x', { X: num(10) }), blk('bb_set_x', { X: num(0) }),
          blk('bb_change_y', { Y: num(10) }), blk('bb_set_y', { Y: num(0) }),
          blk('bb_bounce_edge')
        ]),
        cat('looks', [
          blk('bb_say_for', { MSG: txt(t('def.hello')), SECS: num(2) }),
          blk('bb_say', { MSG: txt(t('def.hello')) }),
          blk('bb_think', { MSG: txt(t('def.hmm')) }),
          blk('bb_show'), blk('bb_hide'), blk('bb_next_costume'),
          blk('bb_switch_costume'),
          blk('bb_change_size', { SIZE: num(10) }), blk('bb_set_size', { SIZE: num(100) }),
          blk('bb_set_effect', { EFFECT: num(0) })
        ]),
        cat('sound', [
          blk('bb_play_beep'), blk('bb_play_note', { NOTE: num(60), BEATS: num(0.5) })
        ]),
        cat('pen', [
          blk('bb_pen_down'), blk('bb_pen_up'), blk('bb_pen_clear'), blk('bb_set_pen_color')
        ]),
        cat('control', [
          blk('bb_wait', { SECS: num(1) }),
          blk('controls_repeat_ext', { TIMES: num(10) }),
          blk('bb_forever'),
          blk('controls_if'),
          blk('controls_if', null, null, { extraState: { hasElse: true } }),
          blk('bb_wait_until'), blk('bb_stop_all')
        ]),
        cat('sensing', [
          blk('bb_touching'), blk('bb_key_pressed', null, { KEY: 'space' }),
          blk('bb_mouse_x'), blk('bb_mouse_y'), blk('bb_answer'), blk('bb_timer'), blk('bb_reset_timer'),
          blk('bb_ask', { QUESTION: txt(t('def.askName')) })
        ]),
        cat('operators', [
          blk('math_arithmetic', { A: num(1), B: num(1) }, { OP: 'ADD' }),
          blk('math_arithmetic', { A: num(1), B: num(1) }, { OP: 'MINUS' }),
          blk('math_arithmetic', { A: num(1), B: num(1) }, { OP: 'MULTIPLY' }),
          blk('math_arithmetic', { A: num(1), B: num(1) }, { OP: 'DIVIDE' }),
          blk('math_random_int', { FROM: num(1), TO: num(10) }),
          blk('logic_compare', { B: num(50) }, { OP: 'GT' }),
          blk('logic_compare', { B: num(50) }, { OP: 'LT' }),
          blk('logic_compare', { B: num(50) }, { OP: 'EQ' }),
          blk('logic_operation', null, { OP: 'AND' }),
          blk('logic_operation', null, { OP: 'OR' }),
          blk('logic_negate'), blk('logic_boolean', null, { BOOL: 'TRUE' }),
          blk('text_join', { ADD0: txt('Hello '), ADD1: txt('world!') }),
          blk('text_length', { VALUE: txt('Hello') }),
          blk('math_modulo', { DIVIDEND: num(10), DIVISOR: num(3) }),
          blk('math_round', { NUM: num(3.5) }, { OP: 'ROUND' })
        ]),
        cat('variables', null, 'BB_VARIABLES'),
        cat('myblocks', null, 'BB_PROCEDURES')
      ]
    };
  }

  /* ------------------------------------------------------------------ */
  /* Dynamic flyouts: variables and My Blocks                            */
  /* ------------------------------------------------------------------ */
  function paramVarIds(ws) {
    // Procedure parameters are workspace variables too; hide them from the Variables list.
    var ids = Object.create(null);   // keyed by variable ids from saved files
    try {
      ws.getBlocksByType('procedures_defnoreturn', false).forEach(function (d) {
        d.getVarModels().forEach(function (m) { ids[m.getId()] = true; });
      });
    } catch (e) { /* no procedures yet */ }
    return ids;
  }

  function variablesFlyout(ws) {
    var out = [{ kind: 'button', text: t('ui.makeVar'), callbackkey: 'BB_NEW_VARIABLE' }];
    var hidden = paramVarIds(ws);
    var vars = ws.getVariableMap().getAllVariables().filter(function (v) { return !hidden[v.getId()]; });
    vars.sort(function (a, b) { return a.getName().toLowerCase() < b.getName().toLowerCase() ? -1 : 1; });
    if (!vars.length) return out;
    vars.forEach(function (v) {
      out.push(blk('variables_get', null, { VAR: { id: v.getId() } }));
    });
    var first = { VAR: { id: vars[0].getId() } };
    out.push(blk('variables_set', { VALUE: num(0) }, first));
    out.push(blk('math_change', { DELTA: num(1) }, first));
    out.push(blk('bb_show_variable', null, first));
    out.push(blk('bb_hide_variable', null, first));
    return out;
  }

  function proceduresFlyout(ws) {
    var out = [{ kind: 'button', text: t('ui.makeBlock'), callbackkey: 'BB_NEW_BLOCK' }];
    var items;
    try { items = Blockly.Procedures.flyoutCategory(ws); } catch (e) { items = []; }
    // Keep only "call" blocks; we have no return-value procedures and "Make a Block" replaces the define block.
    items.forEach(function (it) { if (it && it.kind === 'block' && it.type === 'procedures_callnoreturn') out.push(it); });
    return out;
  }

  function makeBlockInView(ws, name) {
    // Drop the new definition where the kid is looking, not at the workspace origin.
    var vm = ws.getMetricsManager().getViewMetrics(true);
    var rtl = ws.RTL;
    var fly = ws.getFlyout && ws.getFlyout();
    var skip = (fly && fly.isVisible() ? fly.getWidth() : 0) / ws.scale;   // the open flyout covers one side
    var x = rtl ? vm.left + vm.width - skip - 60 : vm.left + skip + 40;
    var state = { type: 'procedures_defnoreturn', x: x, y: vm.top + 40, fields: { NAME: name } };
    Blockly.serialization.blocks.append(state, ws);
  }

  /** Wire the Variables and My Blocks flyouts. Call once after Blockly.inject(). */
  function registerFlyoutCallbacks(ws) {
    ws.registerToolboxCategoryCallback('BB_VARIABLES', variablesFlyout);
    ws.registerToolboxCategoryCallback('BB_PROCEDURES', proceduresFlyout);
    ws.registerButtonCallback('BB_NEW_VARIABLE', function (button) {
      var target = (button && button.getTargetWorkspace && button.getTargetWorkspace()) || ws;
      Blockly.Variables.createVariableButtonHandler(target, null, '');
    });
    ws.registerButtonCallback('BB_NEW_BLOCK', function (button) {
      var target = (button && button.getTargetWorkspace && button.getTargetWorkspace()) || ws;
      Blockly.dialog.prompt(t('ui.newBlock'), t('def.myBlock'), function (name) {
        if (name) makeBlockInView(target, name);
      });
    });
  }

  /** Recommended Blockly.inject options. app.js may override any key. */
  function injectOptions(opts) {
    opts = opts || {};
    return {
      renderer: RENDERER,
      theme: makeTheme(opts.dark ? 'dark' : 'light'),
      toolbox: toolbox(),
      rtl: !!opts.rtl,
      sounds: false,                 // no external audio files; kid sounds come from BB.rt (Web Audio)
      trashcan: true,
      zoom: { controls: false, wheel: false, pinch: true, startScale: 0.9, maxScale: 1.8, minScale: 0.4, scaleSpeed: 1.2 },
      move: { scrollbars: { horizontal: true, vertical: true }, drag: true, wheel: true },
      grid: { spacing: 24, length: 2, colour: opts.dark ? '#2B2B4D' : '#E3E6F6', snap: false }
    };
  }

  // Block metrics depend on the web font; wait for it so blocks are not measured in a fallback face.
  function fontsReady(timeoutMs) {
    var tmo = new Promise(function (res) { setTimeout(res, timeoutMs || 1500); });
    if (!(document.fonts && document.fonts.load)) return Promise.resolve();
    // Cairo only matters for Arabic; requesting it in English costs ~31 kB and ~394 ms (ADR 0007, decision 3).
    // Arabic never draws Latin-only Nunito (Cairo covers Latin too), so skip it there.
    var wanted = lang === 'ar' ? [] : [document.fonts.load('800 12pt Nunito')];
    if (lang === 'ar') wanted.push(document.fonts.load('800 12pt Cairo', 'العربية'));
    var loads = Promise.all(wanted).catch(function () { /* fall back to system fonts */ });
    return Promise.race([loads, tmo]);
  }

  /* ------------------------------------------------------------------ */
  /* sanitizeXml: vet an untrusted project BEFORE a live workspace sees it */
  /* ------------------------------------------------------------------ */
  var ALLOWED_ELEMENTS = {
    xml: 1, block: 1, shadow: 1, field: 1, value: 1, statement: 1, next: 1, mutation: 1, comment: 1,
    variables: 1, variable: 1, data: 1, arg: 1
  };
  var BAD_ATTR = /^(on|style$|href$|src$|srcdoc$|xlink|formaction$)/i;
  var ID_RE = /^[A-Za-z0-9!#$%()*+,\-.\/:;=?@\[\]^_`{|}~]{1,100}$/;
  var NAME_RE = /^[A-Za-z0-9_]{1,40}$/;
  var LIMITS = { chars: 2000000, elements: 20000, depth: 120, text: 4000, count: 64 };

  function fail(key, code) { return { ok: false, error: t(key), code: code }; }

  /**
   * Parse and vet project XML without creating any Blockly object.
   * Rejects: unknown block types, unknown elements (script, iframe...), event-handler attributes,
   * oversized/deep documents, huge mutation counts, DOCTYPE/entities.
   * @returns {{ok:boolean, error:(string|null), code:(string|undefined), blockCount:number}}
   */
  function sanitizeXml(xml) {
    if (typeof xml !== 'string' || !xml.trim()) return fail('err.badXml', 'empty');
    if (xml.length > LIMITS.chars) return fail('err.tooBig', 'size');
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) return fail('err.unsafe', 'doctype');
    var doc;
    try { doc = new DOMParser().parseFromString(xml, 'application/xml'); } catch (e) { return fail('err.badXml', 'parse'); }
    var root = doc && doc.documentElement;
    if (!root || root.getElementsByTagName('parsererror').length || root.localName !== 'xml') return fail('err.badXml', 'parse');

    var count = 0, blockCount = 0;
    // Iterative walk: a hostile 100k-deep file must not overflow our own stack.
    var stack = [[root, 1]];
    while (stack.length) {
      var item = stack.pop(), el = item[0], depth = item[1];
      if (depth > LIMITS.depth) return fail('err.tooBig', 'depth');
      if (++count > LIMITS.elements) return fail('err.tooBig', 'elements');
      var name = el.localName.toLowerCase();
      // Own keys only: <constructor> or <__proto__> would otherwise pass the allowlist.
      if (!Object.prototype.hasOwnProperty.call(ALLOWED_ELEMENTS, name)) return fail('err.unsafe', 'element:' + name);
      var attrs = el.attributes, i;
      for (i = 0; i < attrs.length; i++) {
        var an = attrs[i].name;
        if (BAD_ATTR.test(an)) return fail('err.unsafe', 'attr:' + an);
      }
      if (name === 'block' || name === 'shadow') {
        blockCount++;
        var type = el.getAttribute('type');
        if (!type || !KNOWN_TYPES.has(type)) return fail('err.unknownBlock', 'type:' + type);
        var id = el.getAttribute('id');
        if (id !== null && !ID_RE.test(id)) return fail('err.unsafe', 'id');
      } else if (name === 'field') {
        var fname = el.getAttribute('name');
        if (!fname || !NAME_RE.test(fname)) return fail('err.unsafe', 'fieldname');
        if (el.textContent.length > LIMITS.text) return fail('err.tooBig', 'text');
      } else if (name === 'mutation') {
        var countAttrs = ['items', 'elseif', 'else'];
        for (i = 0; i < countAttrs.length; i++) {
          var v = el.getAttribute(countAttrs[i]);
          if (v !== null && !(/^\d{1,3}$/.test(v) && Number(v) <= LIMITS.count)) return fail('err.tooBig', 'mutation');
        }
      } else if (name === 'comment') {
        if (el.textContent.length > LIMITS.text) return fail('err.tooBig', 'text');
      }
      if (name === 'arg' && !(el.parentNode && el.parentNode.localName === 'mutation')) return fail('err.unsafe', 'arg');
      var kids = el.children;
      for (i = 0; i < kids.length; i++) stack.push([kids[i], depth + 1]);
    }
    return { ok: true, error: null, blockCount: blockCount };
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */
  blocks.INK = INK;
  blocks.RENDERER = RENDERER;
  blocks.CATEGORY_COLORS = CATEGORY_COLORS;
  blocks.CATEGORY_ORDER = CATEGORY_ORDER;
  blocks.HAT_KINDS = HAT_KINDS;
  blocks.KEYS = KEYS;
  blocks.PALETTE = PALETTE.map(function (p) { return p[1]; });
  blocks.KNOWN_TYPES = KNOWN_TYPES;
  blocks.MSG = MSG;
  blocks.t = t;
  blocks.getLanguage = function () { return lang; };
  blocks.setLanguage = setLanguage;
  blocks.defineAll = defineAll;
  blocks.makeTheme = makeTheme;
  blocks.toolbox = toolbox;
  blocks.registerFlyoutCallbacks = registerFlyoutCallbacks;
  blocks.injectOptions = injectOptions;
  blocks.fontsReady = fontsReady;
  blocks.sanitizeXml = sanitizeXml;

})(window.BB = window.BB || {});
