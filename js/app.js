/*
 * BoltBlocks — app.js (CIRCUIT-2)
 *
 * The "glue" file: boots the page, owns every UI string (EN + AR), wires the buttons to
 * the runtime (BB.rt), the block editor (Blockly + BB.blocks / BB.gen), storage, dialogs,
 * lessons and accessibility behaviour.  Blocks, generators and the runtime live in their own
 * files; this one only calls their public API (docs/architecture.md section 7).
 *
 * Reading guide for teachers (search for the "N." banners):
 *   1. i18n tables        2. storage            3. small helpers      4. toasts + dialogs
 *   5. project model      6. workspace          7. sprites UI         8. run controls
 *   9. file menu         10. lessons           11. a11y helpers      12. boot
 *
 * Rules this file follows: no window.prompt/confirm/alert, no inline handlers, no console
 * output, every storage access in try/catch, no secrets, nothing here ever shows a raw JS
 * error to a child.
 */
(function (BB) {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var win = window;

  function $(id) { return doc.getElementById(id); }

  /* ================================================================================
   * 1. i18n tables — every string the app (not the blocks) shows.
   *    Keys are flat "area.thing".  English is the markup default; Arabic is MSA.
   *    Block text lives in blocks.js; lesson text lives in lessons/lessons.json.
   * ================================================================================ */
  var STR = {
    en: {
      /* markup (index.html data-i18n / data-i18n-attr) */
      'skip.workspace': 'Skip to the block workspace',
      'skip.stage': 'Skip to the stage',
      'app.h1': 'BoltBlocks — block coding workspace',
      'top.project_label': 'Project name',
      'top.project_placeholder': 'My project',
      'top.file': 'File',
      'top.new': 'New project',
      'top.save': 'Save in this browser',
      'top.load': 'Open saved project…',
      'top.download': 'Download project file',
      'top.upload': 'Open project file…',
      'top.upload_input': 'Project file',
      'top.lessons': 'Lessons',
      'top.theme': 'Dark mode',
      'top.lang_other': 'العربية',
      'top.lang_title': 'Change language',
      'top.help': 'Help',
      'boot.loading': 'Loading…',
      'ws.title': 'Block workspace',
      'ws.zoom': 'Zoom',
      'ws.zoom_in': 'Zoom in',
      'ws.zoom_out': 'Zoom out',
      'ws.zoom_reset': 'Reset zoom',
      'stage.title': 'Stage',
      'stage.toolbar': 'Stage controls',
      'stage.flag': 'Run (green flag)',
      'stage.pause': 'Pause',
      'stage.stop': 'Stop',
      'stage.speed': 'Slow motion',
      'stage.dpad': 'Arrow pad',
      'stage.canvas': 'Stage: where your sprites move',
      'stage.canvas_fallback': 'The stage needs a browser that supports canvas.',
      'stage.canvas_desc': 'Arrow keys, letters and the space key go to your program while the stage has focus. Press Tab to move on.',
      'stage.ask_label': 'Your answer',
      'common.ok': 'OK',
      'common.cancel': 'Cancel',
      'common.close': 'Close',
      'dpad.up': 'Up',
      'dpad.left': 'Left',
      'dpad.down': 'Down',
      'dpad.right': 'Right',
      'dpad.space': 'Space',
      'info.title': 'Sprite settings',
      'info.name': 'Name',
      'info.x': 'x',
      'info.y': 'y',
      'info.dir': 'Direction',
      'info.size': 'Size',
      'info.visible': 'Visible',
      'sprites.title': 'Sprites',
      'sprites.list': 'Your sprites',
      'sprites.add': 'Add sprite',
      'lesson.panel': 'Lesson',
      'lesson.title_default': 'Lesson',
      'lesson.steps': 'Steps',
      'lesson.hint': 'Bolt\'s hint',
      'lesson.hint_prev': 'Previous hint',
      'lesson.hint_next': 'Next hint',
      'lesson.reset': 'Start again',
      'lesson.close': 'Close lesson',
      'celebrate.text': 'Great job!',
      'notice.text': 'BoltBlocks works best on a tablet or a computer. You can still look around on a phone.',
      'notice.dismiss': 'Got it',
      'wl.title': 'Hi, I\'m Bolt!',
      'wl.text': 'Snap blocks together to make your robot friends move, talk and draw.',
      'wl.start': 'Start coding',
      'wl.lessons': 'Try a lesson',
      'wl.continue': 'Continue my project',
      'lessons.title': 'Lessons',
      'lessons.intro': 'Pick a lesson. Bolt will guide you step by step.',
      'char.title': 'Choose a character',
      'load.title': 'Open a saved project',
      'load.empty': 'No saved projects yet. Use File, then Save, to keep one.',
      'prompt.title': 'Name it',
      'prompt.label': 'Name',
      'confirm.title': 'Are you sure?',
      'confirm.text': 'Please confirm.',
      'confirm.ok': 'Yes',

      /* app-owned strings */
      'project.default': 'My project',
      'char.bolt': 'Bolt', 'char.zip': 'Zip', 'char.mimi': 'Mimi',
      'char.sunny': 'Sunny', 'char.finn': 'Finn', 'char.pico': 'Pico',
      'sprite.delete': 'Delete {name}',
      'sprite.lastOne': 'Every project needs at least one sprite, so this one has to stay.',
      'sprite.confirmDelete': 'Delete the sprite “{name}” and all of its blocks?',
      'sprite.added': 'Added {name}.',
      'save.title': 'Save your project',
      'save.label': 'Project name',
      'save.ok': 'Save',
      'common.delete': 'Delete',
      'common.open': 'Open',
      'common.replace': 'Replace',
      'common.start': 'Start',
      'name.empty': 'Please type a name.',
      'name.long': 'That name is too long. Use {max} letters or fewer.',
      'name.exists': 'That name is already in use. Try another one.',
      'name.bad': 'Please use normal letters and numbers.',
      'confirm.new': 'Start a new project? Your current project will be replaced unless you saved it.',
      'confirm.open': 'Open “{name}”? Your current project will be replaced unless you saved it.',
      'confirm.lesson': 'Start this lesson? It will replace your current project unless you saved it.',
      'confirm.lessonReset': 'Start this lesson again? The changes you made in it will be lost.',
      'confirm.deleteSaved': 'Delete the saved project “{name}”?',
      'confirm.overwrite': 'A saved project called “{name}” already exists. Replace it?',
      'toast.saved': 'Saved “{name}” in this browser.',
      'toast.downloaded': 'Your project file is downloading.',
      'toast.opened': 'Opened “{name}”.',
      'toast.new': 'A fresh project is ready!',
      'toast.deleted': 'Deleted “{name}”.',
      'toast.storage': 'This browser would not keep your project. Use File, then Download, so you do not lose it.',
      'toast.noLangStorage': 'This browser cannot remember the language, so it was not changed. Try a normal, non-private window.',
      'app.title': 'BoltBlocks — block coding for kids',
      'toast.noServer': 'Lessons need BoltBlocks to be opened from a website, not from a file. Ask a grown-up to help open it from a web server.',
      'toast.lessonFail': 'Bolt could not load the lessons. Check your internet and try again.',
      'toast.msgFail': 'Some words in the editor might look missing because the language file did not load.',
      'err.generic': 'Oops! Something went wrong. Try again — Bolt is on it!',
      'err.compile': 'Bolt found a block that does not fit yet. Check your blocks and try again.',
      'err.run': 'Something went wrong while running. Press stop and check your blocks.',
      'err.upload.size': 'That file is too big. Project files must be smaller than 2 MB.',
      'err.upload.parse': 'Bolt could not read that file. Is it a BoltBlocks project?',
      'err.upload.app': 'That file is not a BoltBlocks project.',
      'err.upload.version': 'That project was made with a newer BoltBlocks, so it cannot be opened here.',
      'err.upload.blocks': 'That project uses blocks BoltBlocks does not know, so it was not opened.',
      'err.upload.empty': 'That project has no sprites in it.',
      'err.upload.read': 'Bolt could not read that file.',
      'stage.says': '{name}: {text}',
      'lesson.num': 'Lesson {n}',
      'lesson.done': 'Done',
      'lesson.next': 'Next lesson',
      'lesson.keep': 'Keep playing',
      'lesson.started': 'Lesson {n}: {title}. Follow the steps, then click the green flag.',
      'lesson.watching': 'Bolt is watching your program…',
      'lesson.notYet': 'Not quite yet. Look at Bolt\'s hint, fix your blocks and press the flag again.',
      'lesson.allDone': 'You finished every lesson. Amazing!',
      'lesson.stepFallback': 'Step {n}',
      'boot.fail': 'BoltBlocks could not load its building blocks. Please check your internet connection and reload the page.',
      'boot.reload': 'Reload'
    },
    ar: {
      /* markup */
      'skip.workspace': 'انتقل إلى مساحة الكتل',
      'skip.stage': 'انتقل إلى المسرح',
      'app.h1': 'BoltBlocks — مساحة البرمجة بالكتل',
      'top.project_label': 'اسم المشروع',
      'top.project_placeholder': 'مشروعي',
      'top.file': 'ملف',
      'top.new': 'مشروع جديد',
      'top.save': 'احفظ في هذا المتصفح',
      'top.load': 'افتح مشروعًا محفوظًا…',
      'top.download': 'نزّل ملف المشروع',
      'top.upload': 'افتح ملف مشروع…',
      'top.upload_input': 'ملف المشروع',
      'top.lessons': 'الدروس',
      'top.theme': 'الوضع الداكن',
      'top.lang_other': 'English',
      'top.lang_title': 'غيّر اللغة',
      'top.help': 'مساعدة',
      'boot.loading': 'جارٍ التحميل…',
      'ws.title': 'مساحة الكتل',
      'ws.zoom': 'التكبير',
      'ws.zoom_in': 'كبّر',
      'ws.zoom_out': 'صغّر',
      'ws.zoom_reset': 'أعد ضبط التكبير',
      'stage.title': 'المسرح',
      'stage.toolbar': 'أزرار التحكم بالمسرح',
      'stage.flag': 'شغّل (العلم الأخضر)',
      'stage.pause': 'إيقاف مؤقت',
      'stage.stop': 'أوقف',
      'stage.speed': 'الحركة البطيئة',
      'stage.dpad': 'لوحة الأسهم',
      'stage.canvas': 'المسرح: حيث تتحرك شخصياتك',
      'stage.canvas_fallback': 'يحتاج المسرح إلى متصفح يدعم عنصر canvas.',
      'stage.canvas_desc': 'تصل مفاتيح الأسهم والحروف ومفتاح المسافة إلى برنامجك ما دام التركيز على المسرح. اضغط Tab للانتقال.',
      'stage.ask_label': 'إجابتك',
      'common.ok': 'حسنًا',
      'common.cancel': 'إلغاء',
      'common.close': 'إغلاق',
      'dpad.up': 'أعلى',
      'dpad.left': 'يسار',
      'dpad.down': 'أسفل',
      'dpad.right': 'يمين',
      'dpad.space': 'مسافة',
      'info.title': 'إعدادات الشخصية',
      'info.name': 'الاسم',
      'info.x': 'س',
      'info.y': 'ص',
      'info.dir': 'الاتجاه',
      'info.size': 'الحجم',
      'info.visible': 'ظاهرة',
      'sprites.title': 'الشخصيات',
      'sprites.list': 'شخصياتك',
      'sprites.add': 'أضف شخصية',
      'lesson.panel': 'الدرس',
      'lesson.title_default': 'الدرس',
      'lesson.steps': 'الخطوات',
      'lesson.hint': 'تلميح بولت',
      'lesson.hint_prev': 'التلميح السابق',
      'lesson.hint_next': 'التلميح التالي',
      'lesson.reset': 'ابدأ من جديد',
      'lesson.close': 'أغلق الدرس',
      'celebrate.text': 'أحسنت!',
      'notice.text': 'يعمل BoltBlocks على أفضل وجه على اللوح الإلكتروني أو الحاسوب. ما زال بإمكانك التصفح على الهاتف.',
      'notice.dismiss': 'فهمت',
      'wl.title': 'مرحبًا، أنا بولت!',
      'wl.text': 'ركّب الكتل معًا لتجعل أصدقاءك الروبوتات يتحركون ويتكلمون ويرسمون.',
      'wl.start': 'ابدأ البرمجة',
      'wl.lessons': 'جرّب درسًا',
      'wl.continue': 'تابع مشروعي',
      'lessons.title': 'الدروس',
      'lessons.intro': 'اختر درسًا وسيرشدك بولت خطوة بخطوة.',
      'char.title': 'اختر شخصية',
      'load.title': 'افتح مشروعًا محفوظًا',
      'load.empty': 'لا توجد مشاريع محفوظة بعد. اختر «ملف» ثم «احفظ» لتحتفظ بمشروع.',
      'prompt.title': 'اختر اسمًا',
      'prompt.label': 'الاسم',
      'confirm.title': 'هل أنت متأكد؟',
      'confirm.text': 'من فضلك أكّد.',
      'confirm.ok': 'نعم',

      /* app-owned strings */
      'project.default': 'مشروعي',
      'char.bolt': 'بولت', 'char.zip': 'زيب', 'char.mimi': 'ميمي',
      'char.sunny': 'صني', 'char.finn': 'فِن', 'char.pico': 'بيكو',
      'sprite.delete': 'احذف {name}',
      'sprite.lastOne': 'يجب أن تبقى شخصية واحدة على الأقل في كل مشروع، لذلك لا يمكن حذف هذه.',
      'sprite.confirmDelete': 'هل تريد حذف الشخصية «{name}» وكل كتلها؟',
      'sprite.added': 'تمت إضافة {name}.',
      'save.title': 'احفظ مشروعك',
      'save.label': 'اسم المشروع',
      'save.ok': 'احفظ',
      'common.delete': 'احذف',
      'common.open': 'افتح',
      'common.replace': 'استبدل',
      'common.start': 'ابدأ',
      'name.empty': 'من فضلك اكتب اسمًا.',
      'name.long': 'الاسم طويل جدًا. استخدم {max} حرفًا أو أقل.',
      'name.exists': 'هذا الاسم مستخدم بالفعل. جرّب اسمًا آخر.',
      'name.bad': 'من فضلك استخدم حروفًا وأرقامًا عادية.',
      'confirm.new': 'هل تبدأ مشروعًا جديدًا؟ سيُستبدل مشروعك الحالي إن لم تكن قد حفظته.',
      'confirm.open': 'هل تفتح «{name}»؟ سيُستبدل مشروعك الحالي إن لم تكن قد حفظته.',
      'confirm.lesson': 'هل تبدأ هذا الدرس؟ سيُستبدل مشروعك الحالي إن لم تكن قد حفظته.',
      'confirm.lessonReset': 'هل تبدأ هذا الدرس من جديد؟ ستضيع التغييرات التي أجريتها فيه.',
      'confirm.deleteSaved': 'هل تحذف المشروع المحفوظ «{name}»؟',
      'confirm.overwrite': 'يوجد مشروع محفوظ باسم «{name}» بالفعل. هل تستبدله؟',
      'toast.saved': 'تم حفظ «{name}» في هذا المتصفح.',
      'toast.downloaded': 'جارٍ تنزيل ملف مشروعك.',
      'toast.opened': 'تم فتح «{name}».',
      'toast.new': 'مشروع جديد جاهز!',
      'toast.deleted': 'تم حذف «{name}».',
      'toast.storage': 'لن يحتفظ هذا المتصفح بمشروعك. اختر «ملف» ثم «نزّل» كي لا يضيع عملك.',
      'toast.noLangStorage': 'لا يستطيع هذا المتصفح تذكّر اللغة، لذلك لم تتغيّر. جرّب نافذة عادية غير خاصة.',
      'app.title': 'BoltBlocks — برمجة بالكتل للأطفال',
      'toast.noServer': 'تحتاج الدروس إلى فتح BoltBlocks من موقع على الإنترنت وليس من ملف. اطلب من شخص بالغ مساعدتك في فتحه من خادم ويب.',
      'toast.lessonFail': 'لم يستطع بولت تحميل الدروس. تحقق من الإنترنت وحاول مرة أخرى.',
      'toast.msgFail': 'قد تبدو بعض كلمات المحرر ناقصة لأن ملف اللغة لم يُحمَّل.',
      'err.generic': 'عذرًا! حدث خطأ ما. حاول مرة أخرى، وبولت يعمل على إصلاحه!',
      'err.compile': 'وجد بولت كتلة لا تناسب مكانها بعد. راجع كتلك وحاول مرة أخرى.',
      'err.run': 'حدث خطأ أثناء التشغيل. اضغط «أوقف» وراجع كتلك.',
      'err.upload.size': 'هذا الملف كبير جدًا. يجب أن يكون ملف المشروع أصغر من 2 ميغابايت.',
      'err.upload.parse': 'لم يستطع بولت قراءة هذا الملف. هل هو مشروع BoltBlocks؟',
      'err.upload.app': 'هذا الملف ليس مشروع BoltBlocks.',
      'err.upload.version': 'صُنع هذا المشروع بنسخة أحدث من BoltBlocks، لذلك لا يمكن فتحه هنا.',
      'err.upload.blocks': 'يستخدم هذا المشروع كتلًا لا يعرفها BoltBlocks، لذلك لم يُفتح.',
      'err.upload.empty': 'لا توجد شخصيات في هذا المشروع.',
      'err.upload.read': 'لم يستطع بولت قراءة هذا الملف.',
      'stage.says': '{name}: {text}',
      'lesson.num': 'الدرس {n}',
      'lesson.done': 'تم',
      'lesson.next': 'الدرس التالي',
      'lesson.keep': 'تابع اللعب',
      'lesson.started': 'الدرس {n}: {title}. اتبع الخطوات ثم اضغط على العلم الأخضر.',
      'lesson.watching': 'بولت يراقب برنامجك…',
      'lesson.notYet': 'لم تصل بعد. اقرأ تلميح بولت وصحّح كتلك ثم اضغط على العلم مرة أخرى.',
      'lesson.allDone': 'أنهيت كل الدروس. رائع!',
      'lesson.stepFallback': 'الخطوة {n}',
      'boot.fail': 'لم يستطع BoltBlocks تحميل كتله. تحقق من اتصالك بالإنترنت ثم أعد تحميل الصفحة.',
      'boot.reload': 'أعد التحميل'
    }
  };

  var lang = root.lang === 'ar' ? 'ar' : 'en';

  /** Look a string up (current language, then English, then the key itself) and fill {vars}. */
  function t(key, vars) {
    var s = (STR[lang] && STR[lang][key]);
    if (s === undefined) s = STR.en[key];
    if (s === undefined) s = key;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] === undefined ? m : String(vars[k]); });
    }
    return s;
  }

  /** Pick the current-language string from a {en, ar} object (lessons, starter names). */
  function pick(obj) {
    if (obj === null || obj === undefined) return '';
    if (typeof obj === 'string') return obj;
    return obj[lang] || obj.en || '';
  }

  function hasKey(key) { return STR[lang][key] !== undefined || STR.en[key] !== undefined; }

  /** Replace the text of an element but keep icons/child elements (swap the text node only). */
  function setText(el, text) {
    if (!el.children.length) { el.textContent = text; return; }
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3 && n.nodeValue.trim()) { n.nodeValue = text; return; }
    }
    el.appendChild(doc.createTextNode(text));
  }

  /** Apply data-i18n / data-i18n-attr inside `scope`. Unknown keys keep their English markup. */
  function applyI18n(scope) {
    var i, node, nodes = (scope || doc).querySelectorAll('[data-i18n]');
    for (i = 0; i < nodes.length; i++) {
      node = nodes[i];
      var key = node.getAttribute('data-i18n');
      if (hasKey(key)) setText(node, t(key));
    }
    nodes = (scope || doc).querySelectorAll('[data-i18n-attr]');
    for (i = 0; i < nodes.length; i++) {
      applyAttrI18n(nodes[i]);
    }
  }

  function applyAttrI18n(node) {
    node.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
      var cut = pair.indexOf(':');
      if (cut < 1) return;
      var attr = pair.slice(0, cut).trim(), k = pair.slice(cut + 1).trim();
      if (hasKey(k)) node.setAttribute(attr, t(k));
    });
  }

  /* ================================================================================
   * 2. storage — localStorage with an in-memory fallback.  Every access is try/catch:
   *    private mode, file:// and full quotas all throw, and the app must still work.
   * ================================================================================ */
  var KEY = {
    autosave: 'boltblocks.autosave',
    projects: 'boltblocks.projects',
    lang: 'boltblocks.lang',
    theme: 'boltblocks.theme',
    welcomeSeen: 'boltblocks.welcomeSeen',
    lessonsDone: 'boltblocks.lessonsDone',
    lessonActive: 'boltblocks.lessonActive',      // sessionStorage: survives the language reload
    noticeDismissed: 'boltblocks.noticeDismissed' // sessionStorage: phone notice, this visit only
  };
  var memory = { local: Object.create(null), session: Object.create(null) };
  var storageWarned = false;

  function backend(kind) {
    try { return kind === 'session' ? win.sessionStorage : win.localStorage; } catch (e) { return null; }
  }
  function storeGet(key, kind) {
    kind = kind || 'local';
    try {
      var b = backend(kind);
      if (b) { var v = b.getItem(key); if (v !== null) return v; }
    } catch (e) { /* fall through to memory */ }
    return key in memory[kind] ? memory[kind][key] : null;
  }
  /** Returns true when the value reached real storage. Warns (once) when it could not. */
  function storeSet(key, value, kind) {
    kind = kind || 'local';
    memory[kind][key] = value;
    try {
      var b = backend(kind);
      if (!b) throw new Error('no storage');
      b.setItem(key, value);
      return true;
    } catch (e) {
      if (!storageWarned && kind === 'local' && (key === KEY.autosave || key === KEY.projects)) {
        storageWarned = true;
        toast(t('toast.storage'), 'error', 6000);
      }
      return false;
    }
  }
  function storeRemove(key, kind) {
    kind = kind || 'local';
    delete memory[kind][key];
    try { var b = backend(kind); if (b) b.removeItem(key); } catch (e) { /* ignore */ }
  }
  function storeGetJSON(key, kind) {
    var raw = storeGet(key, kind);
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function storeSetJSON(key, obj, kind) {
    var text;
    try { text = JSON.stringify(obj); } catch (e) { return false; }
    return storeSet(key, text, kind);
  }

  /* ================================================================================
   * 3. small helpers
   * ================================================================================ */
  var mqReduce = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() { return !!(mqReduce && mqReduce.matches); }

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function num(v, fallback) {
    v = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    return typeof v === 'number' && isFinite(v) ? v : fallback;
  }
  function round2(n) { return Math.round(n * 100) / 100; }
  /** Keep a direction in (-180, 180] like Scratch shows it. */
  function normDir(d) { d = ((d + 180) % 360 + 360) % 360 - 180; return d === -180 ? 180 : d; }
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function debounce(fn, ms) {
    var timer = 0;
    var wrapped = function () { clearTimeout(timer); timer = setTimeout(function () { timer = 0; fn(); }, ms); };
    wrapped.flush = function () { if (timer) { clearTimeout(timer); timer = 0; fn(); } };
    wrapped.cancel = function () { clearTimeout(timer); timer = 0; };
    return wrapped;
  }

  /** Run `fn` at most once per animation frame (falls back to a timeout). */
  function frameThrottle(fn) {
    var queued = false;
    var raf = win.requestAnimationFrame ? win.requestAnimationFrame.bind(win) : function (cb) { return setTimeout(cb, 16); };
    return function () {
      if (queued) return;
      queued = true;
      raf(function () { queued = false; fn(); });
    };
  }

  function svgUse(svg, symbolId) {
    var use = svg && svg.querySelector('use');
    if (use) use.setAttribute('href', '#' + symbolId);
  }

  function el(tag, className, text) {
    var n = doc.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /** The inline-sprite icon markup GRANITE uses, built from script (never innerHTML). */
  function iconSvg(symbolId) {
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = doc.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = doc.createElementNS(svgNS, 'use');
    use.setAttribute('href', '#' + symbolId);
    svg.appendChild(use);
    return svg;
  }

  function setPressed(btn, on) { if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }

  function on(id, type, handler) {
    var n = $(id);
    if (n) n.addEventListener(type, handler);
  }

  function formatDate(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString(lang === 'ar' ? 'ar' : 'en', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) { return ''; }
  }

  function safeFileName(name) {
    var n = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim();
    n = n.replace(/^\.+/, '');
    return (n || 'my-project').slice(0, 80);
  }

  function safeCall(fn, arg) { try { fn(arg); } catch (e) { toast(t('err.generic'), 'error'); } }

  /* ================================================================================
   * 4. toasts and dialogs
   * ================================================================================ */
  var toastLast = Object.create(null);

  /**
   * Kid-friendly message in #toast-region (a polite live region, so it is announced).
   * kind: 'info' | 'error'.  Same text twice in a row just refreshes the timer.
   */
  function toast(message, kind, ms) {
    var region = toastHost();
    if (!region || !message) return;
    kind = kind === 'error' ? 'error' : 'info';
    ms = ms || (kind === 'error' ? 5500 : 4000);

    var existing = toastLast[message];
    if (existing && existing.node.parentNode === region) {
      clearTimeout(existing.timer);
      existing.timer = setTimeout(function () { dismissToast(existing.node, message); }, ms);
      return;
    }
    // Same text still showing in another region (a dialog opened or closed meanwhile): replace it.
    if (existing) { clearTimeout(existing.timer); if (existing.node.parentNode) existing.node.parentNode.removeChild(existing.node); }
    var node = el('div', 'toast toast--' + kind);
    node.appendChild(el('span', 'toast__text', message));
    node.addEventListener('click', function () { dismissToast(node, message); });
    region.appendChild(node);
    // Keep the pile short: older toasts leave first.
    while (region.children.length > 3) { region.removeChild(region.firstChild); }
    var entry = { node: node, timer: 0 };
    entry.timer = setTimeout(function () { dismissToast(node, message); }, ms);
    // Pausing on hover gives slow readers extra time (WCAG 2.2.1 spirit).
    node.addEventListener('pointerenter', function () { clearTimeout(entry.timer); });
    node.addEventListener('pointerleave', function () { entry.timer = setTimeout(function () { dismissToast(node, message); }, 1500); });
    toastLast[message] = entry;
  }

  /*
   * A modal <dialog> lives in the top layer and makes the rest of the page inert, so the page-level
   * #toast-region would sit hidden (and unannounced) behind it.  Popover-in-top-layer does not fix that:
   * a popover outside the dialog is still inert.  So every dialog carries its own empty polite live
   * region (made at boot so assistive tech already knows it), styled by the same .toast-region rules,
   * and toasts go to the topmost open dialog's region, else the page one.
   */
  var dialogStack = [];     // dialogs opened through openDialog(), oldest first

  function toastHost() {
    var best = null, rank = -2;
    Array.prototype.forEach.call(doc.querySelectorAll('dialog[open]'), function (d) {
      var r = d.querySelector('.toast-region--dialog');
      if (!r) return;
      var i = dialogStack.indexOf(d);
      // Dialogs opened by blocks.js (prompt/confirm) bypass openDialog; they are opened from the bare workspace, so newest.
      var k = i < 0 ? 1e6 : i;
      if (k >= rank) { best = r; rank = k; }
    });
    return best || $('toast-region');
  }

  function moveToasts(from, to) {
    if (!from || !to || from === to) return;
    while (from.firstChild) to.appendChild(from.firstChild);
    while (to.children.length > 3) to.removeChild(to.firstChild);
  }

  function dismissToast(node, message) {
    delete toastLast[message];
    if (!node.parentNode) return;
    if (reducedMotion()) { node.parentNode.removeChild(node); return; }
    node.classList.add('is-leaving');
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 220);
  }

  /* ---- native <dialog> helpers ------------------------------------------------ */
  var openers = new WeakMap();

  function openDialog(dlg, opener) {
    if (!dlg) return;
    openers.set(dlg, opener || doc.activeElement);
    // Already open (welcome re-triggered, double click): showModal() on an open dialog throws InvalidStateError.
    if (!dlg.open) {
      try {
        if (typeof dlg.showModal === 'function') dlg.showModal();
        else dlg.setAttribute('open', '');
      } catch (e) {
        try { dlg.setAttribute('open', ''); } catch (e2) { /* nothing more to try */ }
      }
    }
    var i = dialogStack.indexOf(dlg);
    if (i >= 0) dialogStack.splice(i, 1);
    dialogStack.push(dlg);
    // Toasts already on screen would end up behind the dialog; carry them along.
    moveToasts($('toast-region'), dlg.querySelector('.toast-region--dialog'));
  }
  function closeDialog(dlg, returnValue) {
    if (!dlg || !dlg.open) return;
    try { if (typeof dlg.close === 'function') dlg.close(returnValue); else dlg.removeAttribute('open'); } catch (e) { /* ignore */ }
  }

  /** Belt and braces: native dialogs restore focus, but not every browser does it for SVG openers. */
  function restoreFocusAfterClose(dlg) {
    var opener = openers.get(dlg);
    if (!opener || !opener.isConnected || typeof opener.focus !== 'function') return;
    setTimeout(function () {
      var a = doc.activeElement;
      // Chromium runs its focus fixup lazily: right after "close" activeElement can still be the (now hidden)
      // button inside the dialog, so "focus is on the body" alone misses the case.
      if (a === doc.body || !a || a === root || dlg.contains(a)) {
        try { opener.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
    }, 0);
  }

  function wireDialogs() {
    var dlgs = doc.querySelectorAll('dialog');
    Array.prototype.forEach.call(dlgs, function (dlg) {
      var live = el('div', 'toast-region toast-region--dialog');
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      dlg.appendChild(live);
      dlg.addEventListener('close', function () {
        var i = dialogStack.indexOf(dlg);
        if (i >= 0) dialogStack.splice(i, 1);
        moveToasts(live, toastHost());   // a toast must outlive the dialog it appeared over
        restoreFocusAfterClose(dlg);
      });
      // Click on the backdrop closes the list-style dialogs (never the prompt/confirm ones).
      if (dlg.id !== 'dlg-prompt' && dlg.id !== 'dlg-confirm') {
        dlg.addEventListener('click', function (e) {
          if (e.target !== dlg) return;
          var r = dlg.getBoundingClientRect();
          var outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
          if (outside) closeDialog(dlg);
        });
      }
    });
  }

  /* ---- #dlg-prompt: one at a time, queued ------------------------------------- */
  var promptBusy = false;
  var promptWaiting = [];

  /**
   * Ask for a line of text.  opts: { title, label, value, okLabel, maxLength, validate(v) -> '' | message }.
   * Resolves with the trimmed string, or null when cancelled.
   */
  function askText(opts) {
    return new Promise(function (resolve) {
      promptWaiting.push({ opts: opts || {}, resolve: resolve });
      pumpPrompt();
    });
  }

  function pumpPrompt() {
    if (promptBusy || !promptWaiting.length) return;
    promptBusy = true;
    var job = promptWaiting.shift();
    showPrompt(job.opts, function (value) {
      promptBusy = false;
      job.resolve(value);
      pumpPrompt();
    });
  }

  function showPrompt(opts, done) {
    var dlg = $('dlg-prompt'), form = $('prompt-form') || (dlg && dlg.querySelector('form'));
    var input = $('prompt-input'), ok = $('prompt-ok'), cancel = $('prompt-cancel');
    var err = $('prompt-error'), label = $('prompt-label'), title = $('prompt-title');
    if (!dlg || !input) { done(null); return; }

    var finished = false;
    function finish(value) {
      if (finished) return;
      finished = true;
      cleanup();
      closeDialog(dlg, value === null ? 'cancel' : 'ok');
      done(value);
    }
    function showError(msg) {
      if (err) err.textContent = msg || '';
      if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }
    function submit(e) {
      if (e) e.preventDefault();
      var v = input.value.trim();
      var problem = '';
      if (!v) problem = t('name.empty');
      else if (v.length > (opts.maxLength || 40)) problem = t('name.long', { max: opts.maxLength || 40 });
      else if (/[\u0000-\u001f<>]/.test(v)) problem = t('name.bad');
      else if (opts.validate) problem = opts.validate(v) || '';
      if (problem) { showError(problem); input.focus(); return; }
      finish(v);
    }
    function onCancel(e) { if (e) e.preventDefault(); finish(null); }
    function onEsc(e) { e.preventDefault(); finish(null); }       // 'cancel' event = Esc key
    // Closed some other way. A 'close' event is queued asynchronously, so one left over from the
    // previous prompt can arrive after this one is already open: ignore it then.
    function onClose() { if (!dlg.open) finish(null); }
    function onInput() { if (input.hasAttribute('aria-invalid')) showError(''); }
    function cleanup() {
      if (form) form.removeEventListener('submit', submit);
      if (ok) ok.removeEventListener('click', submit);
      if (cancel) cancel.removeEventListener('click', onCancel);
      dlg.removeEventListener('cancel', onEsc);
      dlg.removeEventListener('close', onClose);
      input.removeEventListener('input', onInput);
    }

    if (title) title.textContent = opts.title || t('prompt.title');
    if (label) label.textContent = opts.label || t('prompt.label');
    if (ok) ok.textContent = opts.okLabel || t('common.ok');
    if (cancel) cancel.textContent = t('common.cancel');
    input.maxLength = opts.maxLength || 40;
    input.value = opts.value || '';
    showError('');

    if (form) form.addEventListener('submit', submit);
    if (ok) ok.addEventListener('click', submit);
    if (cancel) cancel.addEventListener('click', onCancel);
    dlg.addEventListener('cancel', onEsc);
    dlg.addEventListener('close', onClose);
    input.addEventListener('input', onInput);

    openDialog(dlg);
    // Focus after the dialog is up; select so typing replaces a suggested name.
    setTimeout(function () { try { input.focus(); input.select(); } catch (e) { /* ignore */ } }, 0);
  }

  /* ---- #dlg-confirm ------------------------------------------------------------ */
  var confirmBusy = false;
  var confirmWaiting = [];

  /** opts: { text, okLabel, title }.  Resolves true (confirmed) / false (cancelled or Esc). */
  function confirmDialog(opts) {
    if (typeof opts === 'string') opts = { text: opts };
    return new Promise(function (resolve) {
      confirmWaiting.push({ opts: opts || {}, resolve: resolve });
      pumpConfirm();
    });
  }

  function pumpConfirm() {
    if (confirmBusy || !confirmWaiting.length) return;
    confirmBusy = true;
    var job = confirmWaiting.shift();
    showConfirm(job.opts, function (yes) {
      confirmBusy = false;
      job.resolve(yes);
      pumpConfirm();
    });
  }

  function showConfirm(opts, done) {
    var dlg = $('dlg-confirm'), ok = $('confirm-ok'), cancel = $('confirm-cancel');
    var text = $('confirm-text'), title = $('confirm-title');
    if (!dlg || !ok) { done(false); return; }
    var answer = false;
    function onOk(e) { e.preventDefault(); answer = true; closeDialog(dlg, 'ok'); }
    function onCancel(e) { e.preventDefault(); answer = false; closeDialog(dlg, 'cancel'); }
    function onClose() {
      if (dlg.open) return;   // a stale 'close' event from an earlier dialog
      ok.removeEventListener('click', onOk);
      if (cancel) cancel.removeEventListener('click', onCancel);
      dlg.removeEventListener('close', onClose);
      done(answer);
    }
    if (title) title.textContent = opts.title || t('confirm.title');
    if (text) text.textContent = opts.text || t('confirm.text');
    ok.textContent = opts.okLabel || t('confirm.ok');
    if (cancel) cancel.textContent = t('common.cancel');
    ok.addEventListener('click', onOk);
    if (cancel) cancel.addEventListener('click', onCancel);
    dlg.addEventListener('close', onClose);
    openDialog(dlg);
    // Default focus on Cancel: the safe answer for "replace my work?".
    setTimeout(function () { try { (cancel || ok).focus(); } catch (e) { /* ignore */ } }, 0);
  }

  /** Replace Blockly's prompt/confirm/alert-based dialogs (variables, My Blocks) with ours. */
  function installBlocklyDialogs() {
    var B = win.Blockly;
    if (!B || !B.dialog) return;
    // The duplicate-name check only applies to the "new variable" / "rename variable" prompts.
    function isVariablePrompt(message) {
      var M = B.Msg || {};
      if (M.NEW_VARIABLE_TITLE && message === M.NEW_VARIABLE_TITLE) return true;
      if (M.RENAME_VARIABLE_TITLE) {
        var parts = M.RENAME_VARIABLE_TITLE.split('%1');
        var head = parts[0], tail = parts[1] || '';
        return message.indexOf(head) === 0 && message.slice(message.length - tail.length) === tail;
      }
      return false;
    }
    function variableNameValidator(message, defaultValue) {
      if (!isVariablePrompt(message)) return null;
      return function (name) {
        var vars = currentVariableNames();
        var lower = name.toLowerCase();
        for (var i = 0; i < vars.length; i++) {
          if (vars[i].toLowerCase() === lower && vars[i] !== defaultValue) return t('name.exists');
        }
        return '';
      };
    }
    function promptHandler(message, defaultValue, callback) {
      askText({ label: message, value: defaultValue || '', maxLength: 30, validate: variableNameValidator(String(message), defaultValue) })
        .then(function (v) { safeCall(callback, v); });
    }
    function confirmHandler(message, callback) {
      confirmDialog({ text: message, okLabel: t('common.delete') }).then(function (yes) { safeCall(callback, yes); });
    }
    function noticeHandler(message) { toast(message, 'info', 5000); }
    // blocks.js offers handler slots; setting both keeps us in charge whichever one Blockly calls.
    if (BB.blocks) {
      BB.blocks.promptHandler = promptHandler;
      BB.blocks.confirmHandler = confirmHandler;
      BB.blocks.noticeHandler = noticeHandler;
    }
    try {
      B.dialog.setPrompt(promptHandler);
      B.dialog.setConfirm(confirmHandler);
      B.dialog.setAlert(function (message, callback) {
        noticeHandler(message);
        if (callback) safeCall(callback);
      });
      B.dialog.setToast(function (workspace, options) {
        if (options && options.message) toast(options.message, 'info');
      });
    } catch (e) { /* a Blockly without these hooks keeps its defaults */ }
  }

  /* ---- global safety net -------------------------------------------------------
   * A child must never see a raw error.  We toast a friendly line, rate-limited, and
   * leave the browser's own console report alone so developers/QA can still find the bug. */
  var lastErrorToast = 0;
  function friendlyCrash() {
    var now = Date.now();
    if (now - lastErrorToast < 3000) return;
    lastErrorToast = now;
    toast(t('err.generic'), 'error');
  }
  function installErrorHooks() {
    win.addEventListener('error', function (e) {
      var msg = String((e && e.message) || '');
      if (/ResizeObserver loop/i.test(msg)) return;     // harmless browser notice
      if (e && e.target && e.target !== win) return;    // resource errors are handled where they happen
      friendlyCrash();
    });
    win.addEventListener('unhandledrejection', function () { friendlyCrash(); });
  }

  /* ================================================================================
   * 5. project model, save / load
   *    state.scripts holds each sprite's XML; the live sprite numbers (x, y, …) are
   *    read from BB.rt.getSprites() when we serialise.
   * ================================================================================ */
  var NS_XML = 'https://developers.google.com/blockly/xml';
  var EMPTY_XML = '<xml xmlns="' + NS_XML + '"></xml>';
  var MAX_FILE_BYTES = 2 * 1024 * 1024;
  var MAX_SPRITES = 30;
  var MAX_VARS = 100;
  var MAX_NAME = 40;

  var state = {
    theme: 'light',
    run: 'idle',
    slow: false,
    name: '',
    selectedId: null,
    scripts: {},            // spriteId -> xml text
    compileErrors: {},      // spriteId -> {message, blockId}
    needsAutosave: false,   // changed since the last autosave
    unsaved: false,         // changed since the last explicit Save/Download/Open
    slot: null,             // name of the saved slot this project came from
    loading: 0,             // > 0 while we replace the workspace (ignore its events)
    lesson: null,           // { id, index, step, done, ran }
    lessons: null,          // parsed lessons.json
    lessonsDone: [],
    pendingContinue: false
  };
  var ws = null;            // the Blockly workspace

  function rt() { return BB.rt; }

  function blankSprite(id, character, name) {
    return { id: id, name: name, character: character, costume: 0, x: 0, y: 0, direction: 90, size: 100, visible: true, effect: 0, xml: EMPTY_XML };
  }

  function blankProject() {
    return {
      app: 'boltblocks', version: 1, name: t('project.default'), selectedSpriteId: 'sprite1',
      sprites: [blankSprite('sprite1', 'bolt', t('char.bolt'))],
      variables: []
    };
  }

  function characterName(id) {
    var key = 'char.' + id;
    if (hasKey(key)) return t(key);
    var c = rt() && rt().CHARACTERS && rt().CHARACTERS[id];
    return (c && c.name) || id;
  }

  /** Ask CIRCUIT-1's whitelist to vet an XML string; null = reject. */
  function cleanXml(xml) {
    if (xml === undefined || xml === null || xml === '') return EMPTY_XML;
    if (typeof xml !== 'string' || xml.length > MAX_FILE_BYTES) return null;
    if (!BB.blocks || typeof BB.blocks.sanitizeXml !== 'function') return null;   // fail closed
    var out;
    try { out = BB.blocks.sanitizeXml(xml); } catch (e) { return null; }
    // blocks.js answers { ok, error, code }; ok === true means "safe to hand to Blockly as-is".
    if (out && typeof out === 'object') return out.ok === true ? xml : null;
    return null;
  }

  /**
   * The whitelist proves the XML is made of known blocks; this proves Blockly can actually build it.
   * Done in a headless workspace so a file that passes the first test but trips Blockly can never
   * leave the live editor half-replaced.
   */
  function loadsCleanly(xml) {
    var B = win.Blockly;
    if (!B || xml === EMPTY_XML || !B.Workspace) return true;
    var scratch = null, ok = true;
    B.Events.disable();
    try {
      scratch = new B.Workspace();
      B.Xml.domToWorkspace(B.utils.xml.textToDom(xml), scratch);
    } catch (e) { ok = false; }
    finally {
      B.Events.enable();
      if (scratch) { try { scratch.dispose(); } catch (e2) { /* nothing left to free */ } }
    }
    return ok;
  }

  /**
   * Validate + normalise a parsed project object.  Returns { project } or { error: <i18n key> }.
   * Nothing here touches the live workspace: callers apply the result only if it is clean.
   */
  function normalizeProject(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'err.upload.parse' };
    if (raw.app !== 'boltblocks') return { error: 'err.upload.app' };
    var version = num(raw.version, NaN);
    if (!isFinite(version)) return { error: 'err.upload.parse' };
    if (version > 1) return { error: 'err.upload.version' };
    if (!Array.isArray(raw.sprites) || !raw.sprites.length) return { error: 'err.upload.empty' };

    var chars = (rt() && rt().CHARACTERS) || {};
    var used = Object.create(null);
    var sprites = [];
    for (var i = 0; i < raw.sprites.length && i < MAX_SPRITES; i++) {
      var s = raw.sprites[i];
      if (!s || typeof s !== 'object') return { error: 'err.upload.parse' };
      var id = typeof s.id === 'string' && /^[\w-]{1,40}$/.test(s.id) && !used[s.id] ? s.id : '';
      if (!id) { var n = i + 1; while (used['sprite' + n]) n++; id = 'sprite' + n; }
      used[id] = true;
      var character = typeof s.character === 'string' && hasOwn(chars, s.character) ? s.character : 'bolt';
      var name = typeof s.name === 'string' && s.name.trim() ? s.name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 30) : characterName(character);
      var xml = cleanXml(s.xml);
      if (xml === null || !loadsCleanly(xml)) return { error: 'err.upload.blocks' };
      var costumes = (chars[character] && chars[character].costumes) || [];
      sprites.push({
        id: id, name: name || characterName(character), character: character,
        costume: clamp(Math.floor(num(s.costume, 0)), 0, Math.max(0, costumes.length - 1)),
        x: round2(clamp(num(s.x, 0), -240, 240)),
        y: round2(clamp(num(s.y, 0), -180, 180)),
        direction: round2(normDir(num(s.direction, 90))),
        size: round2(clamp(num(s.size, 100), 5, 500)),
        visible: s.visible === undefined ? true : !!s.visible,
        effect: num(s.effect, 0),
        xml: xml
      });
    }
    var vars = [];
    if (Array.isArray(raw.variables)) {
      for (var j = 0; j < raw.variables.length && vars.length < MAX_VARS; j++) {
        var v = raw.variables[j];
        if (!v || typeof v.name !== 'string' || !v.name.trim()) continue;
        var vname = v.name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 30);
        if (!vname) continue;
        var value = typeof v.value === 'string' ? v.value.slice(0, 200) : num(v.value, 0);
        vars.push({ name: vname, value: value, visible: !!v.visible });
      }
    }
    var selected = typeof raw.selectedSpriteId === 'string' && used[raw.selectedSpriteId] ? raw.selectedSpriteId : sprites[0].id;
    var pname = typeof raw.name === 'string' && raw.name.trim() ? raw.name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MAX_NAME) : t('project.default');
    var saved = typeof raw.savedAt === 'string' ? raw.savedAt.slice(0, 40) : new Date().toISOString();
    return { project: { app: 'boltblocks', version: 1, name: pname, savedAt: saved, selectedSpriteId: selected, sprites: sprites, variables: vars } };
  }

  /* ---- workspace XML <-> state ------------------------------------------------- */
  function workspaceXml() {
    if (!ws) return EMPTY_XML;
    try { return win.Blockly.Xml.domToText(win.Blockly.Xml.workspaceToDom(ws)); }
    catch (e) { return EMPTY_XML; }
  }

  /** Copy the visible workspace back into state.scripts (call before switching or saving). */
  function saveCurrentXml() {
    if (!ws || !state.selectedId || state.loading) return;
    state.scripts[state.selectedId] = workspaceXml();
  }

  function serializeProject() {
    saveCurrentXml();
    var sprites = rt().getSprites().map(function (s) {
      return {
        id: s.id, name: s.name, character: s.character, costume: s.costume || 0,
        x: round2(num(s.x, 0)), y: round2(num(s.y, 0)), direction: round2(num(s.direction, 90)),
        size: round2(num(s.size, 100)), visible: !!s.visible, effect: num(s.effect, 0),
        xml: state.scripts[s.id] || EMPTY_XML
      };
    });
    var vars = (rt().getVariables() || []).map(function (v) {
      return { name: v.name, value: v.value, visible: !!v.visible };
    });
    return {
      app: 'boltblocks', version: 1, name: state.name || t('project.default'),
      savedAt: new Date().toISOString(), selectedSpriteId: state.selectedId,
      sprites: sprites, variables: vars
    };
  }

  /**
   * Make a validated project the live project.  Order matters: stop the runtime, replace
   * runtime data, then rebuild the workspace for the selected sprite, then recompile.
   */
  function applyProject(p, opts) {
    opts = opts || {};
    var R = rt();
    R.stopAll();
    clearHighlights();
    closeAsk();
    state.loading++;
    try {
      state.scripts = {};
      state.compileErrors = {};
      p.sprites.forEach(function (s) { state.scripts[s.id] = s.xml; });
      R.setSprites(p.sprites.map(function (s) {
        return { id: s.id, name: s.name, character: s.character, costume: s.costume, x: s.x, y: s.y, direction: s.direction, size: s.size, visible: s.visible, effect: s.effect };
      }));
      R.setVariables(p.variables.map(function (v) { return { name: v.name, value: v.value, visible: v.visible }; }));
      state.selectedId = p.selectedSpriteId;
      R.selectSprite(state.selectedId);
      state.name = p.name;
      var nameInput = $('project-name');
      if (nameInput) nameInput.value = p.name;
      showSpriteScripts(state.selectedId);
    } finally {
      state.loading--;
    }
    compileAll();
    R.resetStats();
    R.render();
    renderSpriteList();
    refreshSpriteInfo();
    state.slot = opts.slot || null;
    state.unsaved = false;
    state.needsAutosave = !!opts.autosaveNow;
    if (opts.autosaveNow) flushAutosave(true);
  }

  function hasBlocks() {
    saveCurrentXml();
    return Object.keys(state.scripts).some(function (k) { return /<block\b/.test(state.scripts[k] || ''); });
  }

  /** Ask before throwing away work the child has not saved. Resolves true when it is OK to go on. */
  function confirmReplace(messageKey, vars, okKey) {
    if (!state.unsaved || !hasBlocks()) return Promise.resolve(true);
    return confirmDialog({ text: t(messageKey, vars), okLabel: t(okKey || 'common.replace') });
  }

  function newProject() {
    return confirmReplace('confirm.new', null, 'common.start').then(function (ok) {
      if (!ok) return;
      closeLesson(true);
      applyProject(normalizeProject(blankProject()).project, { autosaveNow: true });
      toast(t('toast.new'));
    });
  }

  /* ---- named slots in localStorage ------------------------------------------- */
  function readSlots() {
    var raw = storeGetJSON(KEY.projects);
    var out = Object.create(null);   // no prototype: a project named "__proto__" is just a name
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      Object.keys(raw).forEach(function (k) { out[k] = raw[k]; });
    }
    return out;
  }

  function saveProject() {
    var name = (state.name || '').trim();
    // A project still called "My project" has not been named yet: ask once.
    var unnamed = !name || (name === t('project.default') && !state.slot);
    var ask = unnamed
      ? askText({ title: t('save.title'), label: t('save.label'), value: name, okLabel: t('save.ok'), maxLength: MAX_NAME })
      : Promise.resolve(name);
    return ask.then(function (chosen) {
      if (!chosen) return;
      var slots = readSlots();
      var overwrite = hasOwn(slots, chosen) && state.slot !== chosen;
      var go = overwrite ? confirmDialog({ text: t('confirm.overwrite', { name: chosen }), okLabel: t('common.replace') }) : Promise.resolve(true);
      return go.then(function (yes) {
        if (!yes) return;
        state.name = chosen;
        var nameInput = $('project-name');
        if (nameInput) nameInput.value = chosen;
        slots[chosen] = serializeProject();
        if (storeSetJSON(KEY.projects, slots)) {
          state.slot = chosen;
          state.unsaved = false;
          toast(t('toast.saved', { name: chosen }));
        }
      });
    });
  }

  function openLoadDialog(opener) {
    renderSavedList();
    openDialog($('dlg-load'), opener);
  }

  function renderSavedList() {
    var list = $('saved-list'), empty = $('saved-empty');
    if (!list) return;
    list.textContent = '';
    var slots = readSlots();
    var names = Object.keys(slots).sort(function (a, b) {
      return String((slots[b] && slots[b].savedAt) || '').localeCompare(String((slots[a] && slots[a].savedAt) || ''));
    });
    names.forEach(function (name) {
      var li = el('li', 'saved-item');
      var open = el('button', 'saved-open btn btn--secondary');
      open.type = 'button';
      open.setAttribute('data-slot', name);
      open.appendChild(el('span', 'saved-name', name));
      var when = formatDate(slots[name] && slots[name].savedAt);
      if (when) open.appendChild(el('span', 'saved-when', when));
      var del = el('button', 'saved-delete btn btn--ghost btn--round');
      del.type = 'button';
      del.setAttribute('data-slot', name);
      del.setAttribute('aria-label', t('sprite.delete', { name: name }));
      del.title = t('common.delete');
      del.appendChild(iconSvg('i-trash'));
      li.appendChild(open);
      li.appendChild(del);
      list.appendChild(li);
    });
    if (empty) empty.hidden = names.length > 0;
  }

  function onSavedListClick(e) {
    var open = e.target.closest('.saved-open'), del = e.target.closest('.saved-delete');
    var btn = open || del;
    if (!btn) return;
    var name = btn.getAttribute('data-slot');
    var slots = readSlots();
    if (!hasOwn(slots, name)) return;
    if (del) {
      confirmDialog({ text: t('confirm.deleteSaved', { name: name }), okLabel: t('common.delete') }).then(function (yes) {
        if (!yes) return;
        var now = readSlots();
        delete now[name];
        storeSetJSON(KEY.projects, now);
        if (state.slot === name) state.slot = null;
        renderSavedList();
        toast(t('toast.deleted', { name: name }));
        var first = $('saved-list') && $('saved-list').querySelector('button');
        if (first) first.focus();
        else { var c = $('dlg-load'); var cb = c && c.querySelector('.dlg__close'); if (cb) cb.focus(); }
      });
      return;
    }
    var res = normalizeProject(slots[name]);
    if (res.error) { toast(t(res.error), 'error'); return; }
    confirmReplace('confirm.open', { name: name }, 'common.open').then(function (ok) {
      if (!ok) return;
      closeDialog($('dlg-load'));
      closeLesson(true);
      applyProject(res.project, { slot: name, autosaveNow: true });
      toast(t('toast.opened', { name: res.project.name }));
    });
  }

  /* ---- download / upload ------------------------------------------------------- */
  function downloadProject() {
    var project = serializeProject();
    var text;
    try { text = JSON.stringify(project, null, 2); } catch (e) { toast(t('err.generic'), 'error'); return; }
    try {
      var blob = new Blob([text], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = doc.createElement('a');
      a.href = url;
      a.download = safeFileName(project.name) + '.boltblocks.json';
      a.hidden = true;
      doc.body.appendChild(a);   // Firefox needs the link in the DOM
      a.click();
      doc.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      state.unsaved = false;
      toast(t('toast.downloaded'));
    } catch (e) {
      toast(t('err.generic'), 'error');
    }
  }

  function readFileText(file) {
    if (typeof file.text === 'function') return file.text();
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result)); };
      fr.onerror = function () { reject(new Error('read')); };
      fr.readAsText(file);
    });
  }

  function onUploadChosen(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    input.value = '';   // lets the same file be picked again later
    if (file.size > MAX_FILE_BYTES) { toast(t('err.upload.size'), 'error'); return; }
    readFileText(file).then(function (text) {
      if (text.length > MAX_FILE_BYTES) { toast(t('err.upload.size'), 'error'); return; }
      var parsed;
      try { parsed = JSON.parse(text); } catch (e) { toast(t('err.upload.parse'), 'error'); return; }
      var res = normalizeProject(parsed);
      if (res.error) { toast(t(res.error), 'error'); return; }
      return confirmReplace('confirm.open', { name: res.project.name }, 'common.open').then(function (ok) {
        if (!ok) return;
        closeLesson(true);
        applyProject(res.project, { autosaveNow: true });
        toast(t('toast.opened', { name: res.project.name }));
      });
    }).catch(function () { toast(t('err.upload.read'), 'error'); });
  }

  /* ---- autosave ---------------------------------------------------------------- */
  function flushAutosave(force) {
    if (!ws || !rt() || state.loading) return;
    if (!force && !state.needsAutosave) return;
    if (storeSetJSON(KEY.autosave, serializeProject())) state.needsAutosave = false;
  }

  function markDirty() {
    state.needsAutosave = true;
    state.unsaved = true;
  }

  /* ================================================================================
   * 6. workspace (Blockly)
   * ================================================================================ */
  var START_SCALE = 0.9;
  var pendingHighlights = new Map();   // blockId -> boolean, applied once per frame
  var highlighted = new Set();         // block ids currently carrying bb-running
  var litBySprite = Object.create(null); // spriteId -> Set of lit block ids, for sprites not on screen too

  function blocklyTheme() {
    return BB.blocks.makeTheme(state.theme === 'dark' ? 'dark' : 'light');
  }

  function injectWorkspace() {
    var B = win.Blockly;
    var host = $('blockly-div');
    // blocks.js owns the renderer name, theme and toolbox; we only override the interaction choices.
    var opts = BB.blocks.injectOptions({ dark: state.theme === 'dark', rtl: lang === 'ar' });
    opts.zoom = { controls: false, wheel: true, pinch: true, startScale: START_SCALE, maxScale: 2, minScale: 0.3, scaleSpeed: 1.2 };
    opts.move = { scrollbars: true, drag: true, wheel: false };
    opts.grid = { spacing: 24, length: 3, colour: 'rgba(130,135,185,0.35)', snap: false };   // readable on light and dark
    opts.trashcan = true;
    opts.sounds = false;       // the sound files are extra CDN requests that fail offline
    opts.comments = false;
    opts.collapse = false;
    opts.media = 'https://cdn.jsdelivr.net/npm/blockly@13.3.0/media/';
    // Blockly 13 builds a WorkspaceAudio (and so an AudioContext) for every workspace it creates, even with
    // sounds:false, and Firefox warns "AudioContext prevented from starting" for each before any gesture.
    // There is no option to skip it, so hide the constructor for inject() only; runtime.js creates its own
    // context lazily after the green-flag click and reads window.AudioContext, restored in finally.
    var realAC = win.AudioContext, acHidden = false;
    try { if (realAC) { win.AudioContext = undefined; acHidden = true; } } catch (e) { /* read-only: accept the warning */ }
    try {
      ws = B.inject(host, opts);
    } finally {
      if (acHidden) { try { win.AudioContext = realAC; } catch (e) { /* ignore */ } }
    }
    if (typeof BB.blocks.registerFlyoutCallbacks === 'function') BB.blocks.registerFlyoutCallbacks(ws);
    ws.addChangeListener(onWorkspaceEvent);

    // The panel changes size when the lesson panel opens or the window rotates.
    var resize = frameThrottle(function () { try { B.svgResize(ws); } catch (e) { /* ignore */ } });
    if (win.ResizeObserver) new ResizeObserver(resize).observe(host);
    win.addEventListener('resize', resize);
  }

  var recompile = debounce(function () { compileSelected(); }, 250);

  function onWorkspaceEvent(e) {
    if (e.isUiEvent || state.loading) return;
    markDirty();
    var B = win.Blockly;
    if (e.type === B.Events.VAR_CREATE || e.type === B.Events.VAR_DELETE || e.type === B.Events.VAR_RENAME) {
      onVariableEvent(e);
    }
    recompile();
  }

  function currentVariableNames() {
    if (!ws) return [];
    try {
      // My Block parameters live in the same map but belong to one sprite's definition only.
      var params = Object.create(null);
      ws.getBlocksByType('procedures_defnoreturn', false).forEach(function (d) {
        d.getVarModels().forEach(function (m) { params[m.getId()] = true; });
      });
      return ws.getVariableMap().getAllVariables()
        .filter(function (v) { return !params[v.getId()]; })
        .map(function (v) { return v.getName ? v.getName() : v.name; });
    } catch (e) { return []; }
  }

  /** Make sure Blockly knows every project-wide variable (they are global, XML only lists some). */
  function ensureWorkspaceVariables() {
    var map = ws.getVariableMap();
    (rt().getVariables() || []).forEach(function (v) {
      try { if (!map.getVariable(v.name)) map.createVariable(v.name); } catch (e) { /* ignore */ }
    });
  }

  function runtimeVariableList() {
    return (rt().getVariables() || []).map(function (v) { return { name: v.name, value: v.value, visible: !!v.visible }; });
  }

  /** Blockly -> runtime: variables created in the editor must exist in the runtime too. */
  function syncRuntimeVariables() {
    var list = runtimeVariableList();
    var have = Object.create(null);
    list.forEach(function (v) { have[v.name] = true; });
    var added = false;
    currentVariableNames().forEach(function (name) {
      if (!have[name]) { list.push({ name: name, value: 0, visible: false }); added = true; }
    });
    if (added) rt().setVariables(list);
  }

  function onVariableEvent(e) {
    var B = win.Blockly;
    var list = runtimeVariableList();
    if (e.type === B.Events.VAR_CREATE) {
      syncRuntimeVariables();
    } else if (e.type === B.Events.VAR_DELETE) {
      rt().setVariables(list.filter(function (v) { return v.name !== e.varName; }));
    } else if (e.type === B.Events.VAR_RENAME) {
      rt().setVariables(list.map(function (v) { return v.name === e.oldName ? { name: e.newName, value: v.value, visible: v.visible } : v; }));
      // Variables are global: other sprites' saved scripts must follow the new name.
      Object.keys(state.scripts).forEach(function (id) {
        if (id !== state.selectedId) state.scripts[id] = renameVariableInXml(state.scripts[id], e.oldName, e.newName);
      });
    }
  }

  function renameVariableInXml(xml, oldName, newName) {
    try {
      var d = new DOMParser().parseFromString(xml, 'application/xml');
      if (d.getElementsByTagName('parsererror').length) return xml;
      var hits = d.querySelectorAll('field[name="VAR"], variable');
      Array.prototype.forEach.call(hits, function (n) { if (n.textContent === oldName) n.textContent = newName; });
      return new XMLSerializer().serializeToString(d.documentElement);
    } catch (e) { return xml; }
  }

  /**
   * Show one sprite's scripts (architecture section 4): clear, load XML, re-create the
   * global variables.  Blockly events are switched off so loading is not mistaken for editing.
   */
  function showSpriteScripts(id) {
    var B = win.Blockly;
    state.loading++;
    B.Events.disable();
    try {
      ws.clear();
      var xml = state.scripts[id];
      if (xml) B.Xml.domToWorkspace(B.utils.xml.textToDom(xml), ws);
      ensureWorkspaceVariables();
      ws.clearUndo();
    } catch (e) {
      // A script we could not draw must not take the editor down; start that sprite blank.
      try { ws.clear(); } catch (e2) { /* ignore */ }
      state.scripts[id] = EMPTY_XML;
      toast(t('err.generic'), 'error');
    } finally {
      B.Events.enable();
      state.loading--;
    }
    syncRuntimeVariables();
    try { ws.scrollCenter(); } catch (e3) { /* ignore */ }
  }

  function switchSprite(id) {
    if (!id || id === state.selectedId) return;
    flushCompile();
    saveCurrentXml();
    clearHighlights();
    state.selectedId = id;
    rt().selectSprite(id);
    showSpriteScripts(id);
    compileSelected();
    showLitBlocks(id);
    renderSpriteList();
    refreshSpriteInfo();
  }

  /* ---- compile ------------------------------------------------------------------ */
  function applyCompiled(spriteId, result) {
    if (result && result.error) state.compileErrors[spriteId] = result.error;
    else delete state.compileErrors[spriteId];
    rt().setScripts(spriteId, result);
  }

  function compileSelected() {
    if (!ws || !state.selectedId || state.loading) return;
    try { applyCompiled(state.selectedId, BB.gen.compile(ws)); }
    catch (e) { state.compileErrors[state.selectedId] = { message: t('err.compile'), blockId: null }; }
  }

  function compileAll() {
    recompile.cancel();
    rt().getSprites().forEach(function (s) {
      try {
        if (s.id === state.selectedId) applyCompiled(s.id, BB.gen.compile(ws));
        else applyCompiled(s.id, BB.gen.compileXml(state.scripts[s.id] || EMPTY_XML));
      } catch (e) { state.compileErrors[s.id] = { message: t('err.compile'), blockId: null }; }
    });
  }

  function flushCompile() { recompile.flush(); }

  /* ---- highlight "this block is running" ------------------------------------- */
  var applyHighlights = frameThrottle(function () {
    if (!ws) return;
    pendingHighlights.forEach(function (lit, blockId) {
      var block = ws.getBlockById(blockId);
      if (!block || typeof block.addClass !== 'function') { highlighted.delete(blockId); return; }
      if (lit) { block.addClass('bb-running'); highlighted.add(blockId); }
      else { block.removeClass('bb-running'); highlighted.delete(blockId); }
    });
    pendingHighlights.clear();
  });

  function onHighlight(spriteId, blockId, lit) {
    if (!blockId) return;
    // The runtime only reports changes, so remember what is lit for every sprite: switching to a sprite
    // that is mid-run must show its running blocks at once, not at the next step.
    var set = litBySprite[spriteId] || (litBySprite[spriteId] = new Set());
    if (lit) set.add(blockId); else set.delete(blockId);
    if (spriteId !== state.selectedId) return;                // only the sprite you are looking at
    pendingHighlights.set(blockId, !!lit);
    applyHighlights();
  }

  function showLitBlocks(spriteId) {
    var set = litBySprite[spriteId];
    if (!set) return;
    set.forEach(function (id) { pendingHighlights.set(id, true); });
    applyHighlights();
  }

  function clearHighlights() {
    pendingHighlights.clear();
    if (!ws) { highlighted.clear(); return; }
    highlighted.forEach(function (id) {
      var b = ws.getBlockById(id);
      if (b && typeof b.removeClass === 'function') b.removeClass('bb-running');
    });
    highlighted.clear();
  }

  /** Select (and scroll to) a block, switching sprite first when the problem is in another one. */
  function revealBlock(spriteId, blockId) {
    if (!blockId) return;
    if (spriteId && spriteId !== state.selectedId) switchSprite(spriteId);
    try {
      var block = ws.getBlockById(blockId);
      if (!block) return;
      win.Blockly.common.setSelected(block);
      ws.centerOnBlock(blockId);
    } catch (e) { /* selecting is a nicety only */ }
  }

  function setTheme(theme, persist) {
    state.theme = theme === 'dark' ? 'dark' : 'light';
    root.setAttribute('data-theme', state.theme);
    setPressed($('btn-theme'), state.theme === 'dark');
    if (persist) storeSet(KEY.theme, state.theme);
    if (ws) { try { ws.setTheme(blocklyTheme()); } catch (e) { /* the old theme stays */ } }
  }

  /* ================================================================================
   * 7. sprites UI
   * ================================================================================ */
  function spriteById(id) {
    var list = rt().getSprites();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function thumbFor(character) {
    var c = rt().CHARACTERS && rt().CHARACTERS[character];
    return (c && c.costumes && c.costumes[0]) || '';
  }

  function renderSpriteList() {
    var list = $('sprite-list');
    if (!list) return;
    var sprites = rt().getSprites();
    // Rebuilding the list must not drop keyboard focus.
    var focused = doc.activeElement && doc.activeElement.closest && doc.activeElement.closest('#sprite-list') ? doc.activeElement : null;
    var focusId = focused ? focused.getAttribute('data-id') : null;
    var focusDel = !!(focused && focused.classList.contains('sprite-delete'));
    list.textContent = '';
    sprites.forEach(function (s) {
      var li = el('li', 'sprite-row');
      var item = el('button', 'sprite-item');
      item.type = 'button';
      item.setAttribute('data-id', s.id);
      if (s.id === state.selectedId) item.setAttribute('aria-current', 'true');
      var img = el('img', 'sprite-thumb');
      img.src = thumbFor(s.character);
      img.alt = '';
      img.width = 40;
      img.height = 40;
      img.decoding = 'async';
      item.appendChild(img);
      item.appendChild(el('span', 'sprite-label', s.name));
      // A sibling of the item, not a child: a button inside a button is invalid HTML.
      var del = el('button', 'sprite-delete btn btn--ghost btn--round');
      del.type = 'button';
      del.setAttribute('data-id', s.id);
      del.setAttribute('aria-label', t('sprite.delete', { name: s.name }));
      del.title = t('sprite.delete', { name: s.name });
      if (sprites.length < 2) del.setAttribute('aria-disabled', 'true');
      del.appendChild(iconSvg('i-trash'));
      li.appendChild(item);
      li.appendChild(del);
      list.appendChild(li);
    });
    if (focusId) {
      var target = list.querySelector((focusDel ? '.sprite-delete' : '.sprite-item') + '[data-id="' + focusId + '"]');
      if (target) target.focus({ preventScroll: true });
    }
  }

  function onSpriteListClick(e) {
    var del = e.target.closest('.sprite-delete');
    if (del) { requestDeleteSprite(del.getAttribute('data-id')); return; }
    var item = e.target.closest('.sprite-item');
    if (item) switchSprite(item.getAttribute('data-id'));
  }

  function requestDeleteSprite(id) {
    if (rt().getSprites().length < 2) { toast(t('sprite.lastOne')); return; }
    var s = spriteById(id);
    if (!s) return;
    confirmDialog({ text: t('sprite.confirmDelete', { name: s.name }), okLabel: t('common.delete') }).then(function (yes) {
      if (!yes) return;
      var wasSelected = id === state.selectedId;
      if (wasSelected) { flushCompile(); clearHighlights(); }
      rt().removeSprite(id);
      delete state.scripts[id];
      delete state.compileErrors[id];
      var rest = rt().getSprites();
      if (wasSelected && rest.length) {
        state.selectedId = rest[0].id;
        rt().selectSprite(state.selectedId);
        showSpriteScripts(state.selectedId);
        compileSelected();
      }
      markDirty();
      renderSpriteList();
      refreshSpriteInfo();
      var next = $('sprite-list') && $('sprite-list').querySelector('.sprite-item[aria-current="true"]');
      if (next) next.focus();
    });
  }

  function openAddSprite(opener) {
    var list = $('char-list');
    if (!list) return;
    list.textContent = '';
    var chars = rt().CHARACTERS || {};
    Object.keys(chars).forEach(function (id) {
      var li = el('li', 'char-item');
      var card = el('button', 'char-card');
      card.type = 'button';
      card.setAttribute('data-char', id);
      var img = el('img', 'char-thumb');
      img.src = thumbFor(id);
      img.alt = '';
      img.width = 64;
      img.height = 64;
      img.decoding = 'async';
      card.appendChild(img);
      card.appendChild(el('span', 'char-name', characterName(id)));
      li.appendChild(card);
      list.appendChild(li);
    });
    openDialog($('dlg-sprites'), opener);
  }

  function uniqueSpriteName(base, exceptId) {
    var taken = Object.create(null);
    rt().getSprites().forEach(function (s) { if (s.id !== exceptId) taken[String(s.name).toLowerCase()] = true; });
    var name = base, n = 2;
    while (taken[name.toLowerCase()]) { name = base + ' ' + n; n++; }
    return name;
  }

  function addSpriteOfCharacter(character) {
    var R = rt();
    if (R.getSprites().length >= MAX_SPRITES) return;
    flushCompile();
    var name = uniqueSpriteName(characterName(character));
    var id = R.addSprite(character, name);       // the runtime picks a free spot on the stage
    state.scripts[id] = EMPTY_XML;
    closeDialog($('dlg-sprites'));
    markDirty();
    switchSprite(id);
    toast(t('sprite.added', { name: name }));
    var cur = $('sprite-list') && $('sprite-list').querySelector('.sprite-item[aria-current="true"]');
    if (cur) cur.focus();
  }

  /* ---- info panel (two-way) ------------------------------------------------------ */
  var infoFields = { x: 'sprite-x', y: 'sprite-y', direction: 'sprite-dir', size: 'sprite-size' };
  var infoLimits = { x: [-240, 240], y: [-180, 180], size: [5, 500] };

  function setFieldValue(input, value) {
    if (input && doc.activeElement !== input) input.value = String(value);   // never fight the user's typing
  }

  var refreshSpriteInfo = frameThrottle(function () {
    if (!rt() || !state.selectedId) return;
    var s = spriteById(state.selectedId);
    if (!s) return;
    setFieldValue($('sprite-name'), s.name);
    setFieldValue($('sprite-x'), Math.round(num(s.x, 0)));
    setFieldValue($('sprite-y'), Math.round(num(s.y, 0)));
    setFieldValue($('sprite-dir'), Math.round(num(s.direction, 90)));
    setFieldValue($('sprite-size'), Math.round(num(s.size, 100)));
    setPressed($('sprite-visible'), !!s.visible);
  });

  /** Typing updates the stage live; leaving the field (commit) also tidies what is shown. */
  function onInfoInput(key, input, commit) {
    var raw = input.value;
    if (raw.trim() === '') { if (commit) refreshInfoNow(); return; }
    var n = num(raw, NaN);
    if (!isFinite(n)) return;
    var patch = {};
    if (key === 'direction') patch.direction = normDir(n);
    else patch[key] = clamp(n, infoLimits[key][0], infoLimits[key][1]);
    rt().updateSprite(state.selectedId, patch);
    markDirty();
    if (commit) input.value = String(Math.round(patch[key]));
  }

  function refreshInfoNow() {
    var s = spriteById(state.selectedId);
    if (!s) return;
    $('sprite-x').value = Math.round(num(s.x, 0));
    $('sprite-y').value = Math.round(num(s.y, 0));
    $('sprite-dir').value = Math.round(num(s.direction, 90));
    $('sprite-size').value = Math.round(num(s.size, 100));
  }

  function commitSpriteName() {
    var input = $('sprite-name');
    var s = spriteById(state.selectedId);
    if (!input || !s) return;
    var v = input.value.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 30);
    if (!v) { input.value = s.name; return; }
    v = uniqueSpriteName(v, s.id);
    input.value = v;
    if (v !== s.name) {
      var oldName = s.name;
      rt().updateSprite(s.id, { name: v });
      renameTouchingTargets(s.id, oldName, v);
      markDirty();
      renderSpriteList();
    }
  }

  /** `touching <name>` stores the sprite name as plain text, so a rename must rewrite it in saved scripts. */
  function renameTargetInXml(xml, oldName, newName) {
    if (!xml || xml.indexOf(oldName) < 0) return xml;
    try {
      var d = new DOMParser().parseFromString(xml, 'application/xml');
      if (d.getElementsByTagName('parsererror').length) return xml;
      var hits = d.querySelectorAll('block[type="bb_touching"] > field[name="TARGET"]');
      var changed = false;
      Array.prototype.forEach.call(hits, function (n) { if (n.textContent === oldName) { n.textContent = newName; changed = true; } });
      return changed ? new XMLSerializer().serializeToString(d.documentElement) : xml;
    } catch (e) { return xml; }
  }

  function renameTouchingTargets(selectedId, oldName, newName) {
    // "edge" and "mouse" are menu keywords; a sprite that happens to share the name is not what those blocks point at.
    if (oldName === 'edge' || oldName === 'mouse') return;
    if (win.Blockly && ws) {
      ws.getAllBlocks(false).forEach(function (b) {
        if (b.type === 'bb_touching' && b.getFieldValue('TARGET') === oldName) {
          try { b.setFieldValue(newName, 'TARGET'); } catch (e) { /* the saved XML below is still right */ }
        }
      });
    }
    Object.keys(state.scripts).forEach(function (id) {
      if (id === selectedId) return;
      var next = renameTargetInXml(state.scripts[id], oldName, newName);
      if (next !== state.scripts[id]) {
        state.scripts[id] = next;
        // The generated code embeds the old name, so that sprite's program is rebuilt.
        try { applyCompiled(id, BB.gen.compileXml(next)); } catch (e) { state.compileErrors[id] = { message: t('err.compile'), blockId: null }; }
      }
    });
  }

  function wireSpriteInfo() {
    Object.keys(infoFields).forEach(function (key) {
      var input = $(infoFields[key]);
      if (!input) return;
      input.addEventListener('input', function () { onInfoInput(key, input, false); });
      input.addEventListener('change', function () { onInfoInput(key, input, true); });
    });
    var name = $('sprite-name');
    if (name) {
      name.addEventListener('change', commitSpriteName);
      name.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); commitSpriteName(); } });
    }
    on('sprite-visible', 'click', function () {
      var s = spriteById(state.selectedId);
      if (!s) return;
      rt().updateSprite(s.id, { visible: !s.visible });
      setPressed($('sprite-visible'), !s.visible);
      markDirty();
    });
  }

  /* ================================================================================
   * 8. run controls, stage input
   * ================================================================================ */
  var STAGE_W = 480, STAGE_H = 360;
  var downKeys = new Set();           // keys we forwarded as "down" (so "up" always follows)
  var askResolve = null;

  function setRunState(runState) {
    var wasRunning = state.run && state.run !== 'idle';
    state.run = runState;
    // The runtime batches sprite changes (~120 ms), so the last moves can arrive after the stop: always save once on stop.
    if (wasRunning && runState === 'idle') { state.needsAutosave = true; flushAutosave(false); }
    var running = runState !== 'idle';
    doc.body.classList.toggle('is-running', running);
    doc.body.classList.toggle('is-paused', runState === 'paused');
    var pause = $('btn-pause');
    setPressed(pause, runState === 'paused');
    if (pause) { if (running) pause.removeAttribute('aria-disabled'); else pause.setAttribute('aria-disabled', 'true'); }
    if (!running) { clearHighlights(); litBySprite = Object.create(null); closeAsk(); }
    lessonRunStateChanged(runState);
  }

  function runFlag() {
    if (!rt()) return;
    flushCompile();
    // Any script that failed to compile is reported, but the others still run.
    var firstId = Object.keys(state.compileErrors)[0];
    if (firstId) {
      var err = state.compileErrors[firstId];
      toast((err && err.message) || t('err.compile'), 'error');
      if (err && err.blockId) revealBlock(firstId, err.blockId);
    }
    if (state.lesson && !state.lesson.done) { rt().resetStats(); state.lesson.ran = true; }
    rt().startFlag();
    var stage = $('stage');
    if (stage) { try { stage.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }   // so keys reach the program
  }

  function onRuntimeError(info) {
    if (!info) return;
    toast(info.message || t('err.run'), 'error', 6000);
    revealBlock(info.spriteId, info.blockId);
  }

  var sayTimer = 0;
  function onSay(spriteId, text) {
    var live = $('stage-live');
    if (!live || !text) return;   // a cleared bubble needs no announcement
    var s = spriteById(spriteId);
    var line = t('stage.says', { name: s ? s.name : '', text: text });
    clearTimeout(sayTimer);
    // Debounce: a loop that says something every frame must not machine-gun the screen reader.
    sayTimer = setTimeout(function () {
      live.textContent = '';
      setTimeout(function () { live.textContent = line; }, 30);   // empty -> text so repeats are re-read
    }, 350);
  }

  function showAsk(question) {
    var form = $('ask-form'), input = $('ask-input'), label = $('ask-label');
    if (!form || !input) return Promise.resolve('');
    if (askResolve) { askResolve(''); askResolve = null; }
    return new Promise(function (resolve) {
      askResolve = resolve;
      if (label) label.textContent = question && String(question).trim() ? String(question) : t('stage.ask_label');
      input.value = '';
      form.hidden = false;
      setTimeout(function () { try { input.focus(); } catch (e) { /* ignore */ } }, 0);
    });
  }

  function answerAsk(value) {
    var form = $('ask-form');
    if (form) form.hidden = true;
    if (askResolve) { var r = askResolve; askResolve = null; r(value); }
  }

  function closeAsk() {
    if (askResolve) answerAsk('');
    else { var f = $('ask-form'); if (f) f.hidden = true; }
  }

  /* ---- keyboard -> runtime -------------------------------------------------------- */
  function mapKey(e) {
    var code = e.code || '';
    var m;
    if ((m = /^Key([A-Z])$/.exec(code))) return m[1].toLowerCase();       // physical key: works on Arabic layouts too
    if ((m = /^(?:Digit|Numpad)(\d)$/.exec(code))) return m[1];
    switch (code) {
      case 'ArrowUp': return 'up';
      case 'ArrowDown': return 'down';
      case 'ArrowLeft': return 'left';
      case 'ArrowRight': return 'right';
      case 'Space': return 'space';
      default: break;
    }
    var k = e.key;
    if (k === ' ') return 'space';
    if (typeof k === 'string' && /^[a-z0-9]$/i.test(k)) return k.toLowerCase();
    return null;
  }

  var KEY_BLOCKED = 'input, textarea, select, button, a[href], summary, [contenteditable], [role="menuitem"], [role="button"], #blockly-div, .blocklyWidgetDiv, .blocklyDropDownDiv, .blocklyToolboxDiv, dialog';

  /** Keys belong to the program only when the child is not typing, editing blocks or in a dialog. */
  function keysGoToProgram(target) {
    if (doc.querySelector('dialog[open]')) return false;
    if (!target || target === doc.body || target === root) return true;
    if (target.id === 'stage') return true;
    return !(target.closest && target.closest(KEY_BLOCKED));
  }

  function onKeyDown(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') { if (celebrationOpen()) { hideCelebration(true); e.preventDefault(); } return; }
    if (e.key === 'Enter' && e.target && e.target.id === 'stage') {
      // "when this character is clicked" must be reachable without a pointer.
      var sel = spriteById(state.selectedId);
      if (sel) { e.preventDefault(); rt().stageClick(sel.x, sel.y); }
      return;
    }
    var key = mapKey(e);
    if (!key || !keysGoToProgram(e.target)) return;
    downKeys.add(key);
    rt().keyDown(key);
    // Only the keys that would scroll the page are blocked; letters keep their browser meaning.
    if (key === 'up' || key === 'down' || key === 'left' || key === 'right' || key === 'space') e.preventDefault();
  }

  function onKeyUp(e) {
    var key = mapKey(e);
    if (!key || !downKeys.has(key)) return;
    downKeys.delete(key);
    rt().keyUp(key);
  }

  function releaseAllKeys() {
    downKeys.forEach(function (k) { rt().keyUp(k); });
    downKeys.clear();
  }

  /* ---- pointer on the stage -------------------------------------------------------- */
  /** CSS pixels on the canvas -> stage coordinates (origin centre, y up). */
  function stagePoint(e, canvas) {
    // The runtime knows the canvas geometry (devicePixelRatio, letterboxing): ask it first.
    var hit = rt().stageFromEvent ? rt().stageFromEvent(e) : null;
    if (hit) return hit;
    var r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return { x: 0, y: 0 };
    return {
      x: clamp(((e.clientX - r.left) / r.width) * STAGE_W - STAGE_W / 2, -STAGE_W / 2, STAGE_W / 2),
      y: clamp(STAGE_H / 2 - ((e.clientY - r.top) / r.height) * STAGE_H, -STAGE_H / 2, STAGE_H / 2)
    };
  }

  function wireStage() {
    var canvas = $('stage');
    if (!canvas) return;
    canvas.style.touchAction = 'none';     // stage drags must not scroll the page on tablets
    canvas.addEventListener('pointermove', function (e) { var p = stagePoint(e, canvas); rt().setMouse(p.x, p.y); });
    canvas.addEventListener('pointerdown', function (e) {
      var p = stagePoint(e, canvas);
      rt().setMouse(p.x, p.y);
      rt().pointerDown();
      rt().stageClick(p.x, p.y);
    });
    canvas.addEventListener('pointerup', function () { rt().pointerUp(); });
    canvas.addEventListener('pointercancel', function () { rt().pointerUp(); });
    canvas.addEventListener('pointerleave', function () { rt().pointerUp(); });

    doc.addEventListener('keydown', onKeyDown);
    doc.addEventListener('keyup', onKeyUp);
    win.addEventListener('blur', releaseAllKeys);

    // On-screen arrow pad: press = key down, release = key up.
    var pad = $('dpad');
    if (pad) {
      pad.addEventListener('pointerdown', function (e) {
        var b = e.target.closest('[data-key]');
        if (!b) return;
        e.preventDefault();               // keep focus where it is
        var key = b.getAttribute('data-key');
        if (b.setPointerCapture) { try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
        b.classList.add('is-down');
        downKeys.add(key);
        rt().keyDown(key);
      });
      var release = function (e) {
        var b = e.target.closest('[data-key]');
        if (!b) return;
        var key = b.getAttribute('data-key');
        b.classList.remove('is-down');
        if (downKeys.has(key)) { downKeys.delete(key); rt().keyUp(key); }
      };
      pad.addEventListener('pointerup', release);
      pad.addEventListener('pointercancel', release);
      // Keyboard/switch users activate a pad button with Enter/Space: a click with no pointer.
      pad.addEventListener('click', function (e) {
        var b = e.target.closest('[data-key]');
        if (!b || e.detail !== 0) return;
        var key = b.getAttribute('data-key');
        rt().keyDown(key);
        setTimeout(function () { rt().keyUp(key); }, 150);
      });
    }

    var form = $('ask-form'), input = $('ask-input');
    if (form && input) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        answerAsk(input.value);
        try { canvas.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
      });
    }
  }

  function wireToolbar() {
    on('btn-flag', 'click', runFlag);
    on('btn-stop', 'click', function () { rt().stopAll(); releaseAllKeys(); });
    on('btn-pause', 'click', function () {
      if (rt().isPaused()) rt().resume();
      else if (rt().isRunning()) rt().pause();
    });
    on('btn-speed', 'click', function () {
      state.slow = !state.slow;
      rt().setSlow(state.slow);
      doc.body.classList.toggle('is-slow', state.slow);
      setPressed($('btn-speed'), state.slow);
    });
    on('btn-dpad', 'click', function () {
      var pad = $('dpad');
      var show = !!(pad && pad.hidden);
      if (pad) pad.hidden = !show;
      doc.body.classList.toggle('dpad-on', show);
      setPressed($('btn-dpad'), show);
    });
    on('btn-zoom-in', 'click', function () { ws.zoomCenter(1); });
    on('btn-zoom-out', 'click', function () { ws.zoomCenter(-1); });
    on('btn-zoom-reset', 'click', function () { ws.setScale(START_SCALE); ws.scrollCenter(); });
  }

  /** Browsers only start sound after a tap or key press; unlock on the first one. */
  function wireAudioUnlock() {
    var done = false;
    function unlock() {
      if (done) return;
      done = true;
      doc.removeEventListener('pointerdown', unlock, true);
      doc.removeEventListener('keydown', unlock, true);
      try {
        var R = rt();
        if (R && typeof R.unlockAudio === 'function') R.unlockAudio();
      } catch (e) { /* sound is optional */ }
    }
    doc.addEventListener('pointerdown', unlock, true);
    doc.addEventListener('keydown', unlock, true);
  }

  /* ================================================================================
   * 9. file menu + top bar
   * ================================================================================ */
  function menuItems() {
    var list = $('file-menu-list');
    return list ? Array.prototype.slice.call(list.querySelectorAll('[role="menuitem"]')) : [];
  }

  function menuIsOpen() { var l = $('file-menu-list'); return !!l && !l.hidden; }

  function openMenu(focusWhich) {
    var list = $('file-menu-list'), btn = $('btn-file');
    if (!list || !btn) return;
    list.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    var items = menuItems();
    var target = focusWhich === 'last' ? items[items.length - 1] : items[0];
    if (target) target.focus();
  }

  function closeMenu(returnFocus) {
    var list = $('file-menu-list'), btn = $('btn-file');
    if (!list || list.hidden) return;
    list.hidden = true;
    if (btn) { btn.setAttribute('aria-expanded', 'false'); if (returnFocus) btn.focus(); }
  }

  function wireFileMenu() {
    var btn = $('btn-file'), list = $('file-menu-list');
    if (!btn || !list) return;

    btn.addEventListener('click', function () {
      if (menuIsOpen()) closeMenu(true); else openMenu('first');
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); openMenu('first'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); openMenu('last'); }
    });
    list.addEventListener('keydown', function (e) {
      var items = menuItems();
      var i = items.indexOf(doc.activeElement);
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); items[(i + 1) % items.length].focus(); break;
        case 'ArrowUp': e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); break;
        case 'Home': e.preventDefault(); items[0].focus(); break;
        case 'End': e.preventDefault(); items[items.length - 1].focus(); break;
        case 'Escape': e.preventDefault(); closeMenu(true); break;
        case 'Tab': closeMenu(false); break;   // let focus move on naturally
        default: break;
      }
    });
    // Click outside (or focus leaving) closes it.
    doc.addEventListener('pointerdown', function (e) {
      if (menuIsOpen() && !btn.contains(e.target) && !list.contains(e.target)) closeMenu(false);
    }, true);
    doc.addEventListener('focusin', function (e) {
      if (menuIsOpen() && !btn.contains(e.target) && !list.contains(e.target)) closeMenu(false);
    });

    // Menu actions: focus goes back to the File button first, so dialogs return focus there.
    var actions = {
      'mi-new': newProject,
      'mi-save': saveProject,
      'mi-load': function () { openLoadDialog(btn); },
      'mi-download': downloadProject,
      'mi-upload': function () { var u = $('upload-input'); if (u) u.click(); }
    };
    Object.keys(actions).forEach(function (id) {
      on(id, 'click', function () {
        closeMenu(true);
        try { actions[id](); } catch (e) { friendlyCrash(); }
      });
    });
    on('upload-input', 'change', function (e) { onUploadChosen(e.target); });
  }

  function wireTopbar() {
    on('btn-lessons', 'click', function (e) { openLessonList(e.currentTarget); });
    on('btn-theme', 'click', function () { setTheme(state.theme === 'dark' ? 'light' : 'dark', true); });
    on('btn-lang', 'click', function () {
      flushAutosave(true);                              // ADR 0004: save, store, reload
      // Without storage the boot script could not read the choice back, so say so instead of reloading in vain.
      if (!storeSet(KEY.lang, lang === 'ar' ? 'en' : 'ar')) { toast(t('toast.noLangStorage'), 'error', 6000); return; }
      location.reload();
    });
    on('btn-help', 'click', function (e) { showWelcome(e.currentTarget); });
    on('btn-dismiss-notice', 'click', function () { dismissNotice(); storeSet(KEY.noticeDismissed, '1', 'session'); });
    var name = $('project-name');
    if (name) {
      name.addEventListener('input', function () { state.name = name.value.trim(); markDirty(); });
      name.addEventListener('keydown', function (e) { if (e.key === 'Enter') name.blur(); });
    }
    // Follow the system theme until the child picks one themselves.
    if (win.matchMedia) {
      var mq = win.matchMedia('(prefers-color-scheme: dark)');
      var follow = function (e) { if (storeGet(KEY.theme) === null) setTheme(e.matches ? 'dark' : 'light', false); };
      if (mq.addEventListener) mq.addEventListener('change', follow);
    }
    // Save before the tab goes away: visibilitychange is the reliable one on mobile.
    doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'hidden') flushAutosave(false); });
    win.addEventListener('pagehide', function () { flushAutosave(false); });
    setInterval(function () { flushAutosave(false); }, 3000);
  }

  function dismissNotice() {
    var n = $('phone-notice');
    if (!n) return;
    n.hidden = true;
    n.style.display = 'none';   // wins over a stylesheet that shows it by media query
  }

  function showWelcome(opener) {
    var dlg = $('dlg-welcome');
    if (!dlg) return;
    // Called twice (help button during boot, double click): leave the open dialog and its state alone.
    if (dlg.open) return;
    var cont = $('wl-continue');
    // While pickInitialProject() is holding the saved project back (first visit) the button must stay.
    if (cont) cont.hidden = !(state.pendingContinue || storeGet(KEY.autosave));
    flushAutosave(false);
    openDialog(dlg, opener);
    storeSet(KEY.welcomeSeen, '1');
  }

  function wireWelcome() {
    var dlg = $('dlg-welcome');
    // Only the two explicit "fresh start" buttons discard the waiting autosave.
    on('wl-start', 'click', function () { state.pendingContinue = false; closeDialog(dlg); });
    on('wl-lessons', 'click', function () { state.pendingContinue = false; closeDialog(dlg); openLessonList($('btn-lessons')); });
    function continueSaved() {
      if (!state.pendingContinue) return;     // the current project already is the saved one
      state.pendingContinue = false;
      var res = normalizeProject(storeGetJSON(KEY.autosave));
      if (res.error) { toast(t(res.error), 'error'); return; }
      applyProject(res.project, {});
    }
    on('wl-continue', 'click', function () { closeDialog(dlg); });
    // Any other way out (Esc, the X, a click outside) also keeps the child's saved work.
    if (dlg) dlg.addEventListener('close', continueSaved);
  }

  /* ================================================================================
   * 10. lessons (architecture section 8)
   * ================================================================================ */
  var lessonTimer = 0;
  var lessonFetch = null;

  function loadLessons() {
    if (state.lessons) return Promise.resolve(state.lessons);
    if (lessonFetch) return lessonFetch;
    lessonFetch = fetch('lessons/lessons.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('http');
      return r.json();
    }).then(function (data) {
      if (!data || !Array.isArray(data.lessons) || !data.lessons.length) throw new Error('shape');
      state.lessons = data.lessons;
      return state.lessons;
    }).catch(function () {
      lessonFetch = null;
      toast(location.protocol === 'file:' ? t('toast.noServer') : t('toast.lessonFail'), 'error', 7000);
      return null;
    });
    return lessonFetch;
  }

  function readLessonsDone() {
    var d = storeGetJSON(KEY.lessonsDone);
    state.lessonsDone = Array.isArray(d) ? d.filter(function (x) { return typeof x === 'string'; }) : [];
  }
  function markLessonDone(id) {
    if (state.lessonsDone.indexOf(id) < 0) {
      state.lessonsDone.push(id);
      storeSetJSON(KEY.lessonsDone, state.lessonsDone);
    }
  }

  function openLessonList(opener) {
    loadLessons().then(function (lessons) {
      if (!lessons) return;
      renderLessonList(lessons);
      openDialog($('dlg-lessons'), opener);
    });
  }

  function renderLessonList(lessons) {
    var list = $('lesson-list');
    if (!list) return;
    readLessonsDone();
    list.textContent = '';
    lessons.forEach(function (lesson, i) {
      var done = state.lessonsDone.indexOf(lesson.id) >= 0;
      var li = el('li', 'lesson-item');
      var card = el('button', 'lesson-card');
      card.type = 'button';
      card.setAttribute('data-lesson', lesson.id);
      card.setAttribute('data-done', done ? 'true' : 'false');
      card.appendChild(el('span', 'lesson-num', String(i + 1)));
      var body = el('span', 'lesson-card__body');
      body.appendChild(el('span', 'lesson-card__title', pick(lesson.title)));
      body.appendChild(el('span', 'lesson-card__goal', pick(lesson.goal)));
      card.appendChild(body);
      if (done) {
        var badge = el('span', 'lesson-badge');
        badge.appendChild(iconSvg('i-check'));
        badge.appendChild(el('span', 'lesson-badge__text', t('lesson.done')));
        card.appendChild(badge);
      }
      li.appendChild(card);
      list.appendChild(li);
    });
  }

  function lessonIndex(id) {
    if (!state.lessons) return -1;
    for (var i = 0; i < state.lessons.length; i++) if (state.lessons[i].id === id) return i;
    return -1;
  }

  /** Turn a lesson's starter into a validated project (sprite names may be {en, ar} objects). */
  function starterProject(lesson) {
    var s = JSON.parse(JSON.stringify(lesson.starter || {}));
    s.app = 'boltblocks';
    s.version = 1;
    s.name = pick(lesson.title);
    (s.sprites || []).forEach(function (sp) { sp.name = pick(sp.name) || undefined; });
    if (!s.sprites || !s.sprites.length) s.sprites = [blankSprite('sprite1', 'bolt', t('char.bolt'))];
    return normalizeProject(s);
  }

  /**
   * Load a lesson's starter project and open the panel.
   * opts.skipConfirm: replace without asking (used by "Next lesson"); opts.restart: ask the "start again" question.
   */
  function startLesson(id, opts) {
    opts = opts || {};
    return loadLessons().then(function (lessons) {
      if (!lessons) return;
      var idx = lessonIndex(id);
      if (idx < 0) return;
      var lesson = lessons[idx];
      var res = starterProject(lesson);
      if (res.error) { toast(t('err.generic'), 'error'); return; }
      var ask;
      if (opts.skipConfirm) ask = Promise.resolve(true);
      else if (opts.restart) ask = confirmDialog({ text: t('confirm.lessonReset'), okLabel: t('common.start') });
      else ask = confirmReplace('confirm.lesson', null, 'common.start');
      return ask.then(function (ok) {
        if (!ok) return;
        closeDialog($('dlg-lessons'));
        closeCelebration();
        // Drop the old lesson first: applyProject() stops the runtime, and that 'idle' must not be
        // judged against a lesson whose project is being thrown away.
        stopLessonTimer();
        state.lesson = null;
        applyProject(res.project, { autosaveNow: true });
        state.lesson = { id: id, index: idx, step: 0, done: false, ran: false };
        storeSetJSON(KEY.lessonActive, { id: id, step: 0 }, 'session');
        showLessonPanel();
        setLessonStatus(t('lesson.started', { n: idx + 1, title: pick(lesson.title) }));
        renderLesson();
        var title = $('lesson-title');
        if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
      });
    });
  }

  function currentLesson() {
    return state.lesson && state.lessons ? state.lessons[state.lesson.index] : null;
  }

  function showLessonPanel() {
    var panel = $('lesson-panel');
    if (panel) panel.hidden = false;
    doc.body.classList.add('has-lesson');
    ensureLessonNextButton();
  }

  function closeLesson(silent) {
    stopLessonTimer();
    state.lesson = null;
    storeRemove(KEY.lessonActive, 'session');
    var panel = $('lesson-panel');
    if (panel) panel.hidden = true;
    doc.body.classList.remove('has-lesson');
    closeCelebration();
    if (!silent) {
      var stage = $('stage');
      if (stage) { try { stage.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }
  }

  function setLessonStatus(text) {
    var s = $('lesson-status');
    if (s) s.textContent = text || '';
  }

  function setBolt(symbol) {
    var panel = $('lesson-panel');
    var svg = panel && (panel.querySelector('#lesson-bolt') || panel.querySelector('svg'));
    if (svg) svgUse(svg, symbol);
  }

  /** The "Next lesson" button in the panel is created here (hidden until the lesson is done). */
  function ensureLessonNextButton() {
    if ($('btn-lesson-next')) return;
    var nav = doc.querySelector('#lesson-panel .lesson-panel__nav') || $('lesson-panel');
    if (!nav) return;
    var b = el('button', 'btn btn--primary');
    b.id = 'btn-lesson-next';
    b.type = 'button';
    b.hidden = true;
    b.appendChild(iconSvg('i-chevron-right'));
    b.appendChild(el('span', '', t('lesson.next')));
    b.addEventListener('click', function () { goNextLesson(); });
    var close = $('btn-lesson-close');
    if (close && close.parentNode === nav) nav.insertBefore(b, close); else nav.appendChild(b);
  }

  function renderLesson() {
    var lesson = currentLesson();
    if (!lesson) return;
    var L = state.lesson;
    var hints = lesson.hints || [];
    var steps = lesson.steps || [];
    var title = $('lesson-title'), goal = $('lesson-goal'), list = $('lesson-steps'), hint = $('lesson-hint-text');
    if (title) title.textContent = t('lesson.num', { n: L.index + 1 }) + ': ' + pick(lesson.title);
    if (goal) goal.textContent = pick(lesson.goal);
    if (list) {
      list.textContent = '';
      // A lesson may carry a few more hints than steps (an "extra fun" tip): the last step stays current then.
      var items = steps.length ? steps : hints;
      var cur = Math.min(L.step, items.length - 1);
      items.forEach(function (item, i) {
        var li = el('li', 'lesson-step', pick(item) || t('lesson.stepFallback', { n: i + 1 }));
        li.setAttribute('data-step', String(i));
        if (L.done || i < cur) li.setAttribute('data-done', 'true');
        else if (i === cur) li.setAttribute('aria-current', 'step');
        list.appendChild(li);
      });
    }
    if (hint) hint.textContent = hints[L.step] ? pick(hints[L.step]) : '';
    var prev = $('btn-hint-prev'), next = $('btn-hint-next');
    if (prev) { if (L.step <= 0) prev.setAttribute('aria-disabled', 'true'); else prev.removeAttribute('aria-disabled'); }
    if (next) { if (L.step >= hints.length - 1) next.setAttribute('aria-disabled', 'true'); else next.removeAttribute('aria-disabled'); }
    var nb = $('btn-lesson-next');
    if (nb) nb.hidden = !(L.done && L.index < state.lessons.length - 1);
    setBolt(L.done ? 'bolt-cheer' : (state.run === 'idle' ? 'bolt-happy' : 'bolt-think'));
    storeSetJSON(KEY.lessonActive, { id: L.id, step: L.step }, 'session');
  }

  function stepHint(delta) {
    var lesson = currentLesson();
    if (!lesson) return;
    var n = (lesson.hints || []).length;
    var next = clamp(state.lesson.step + delta, 0, Math.max(0, n - 1));
    if (next === state.lesson.step) return;
    state.lesson.step = next;
    renderLesson();
  }

  function goNextLesson() {
    var L = state.lesson;
    if (!L || !state.lessons) return;
    var nextLesson = state.lessons[L.index + 1];
    if (!nextLesson) { closeCelebration(); return; }
    startLesson(nextLesson.id, { skipConfirm: true });
  }

  function wireLessons() {
    on('lesson-list', 'click', function (e) {
      var card = e.target.closest('.lesson-card');
      if (card) startLesson(card.getAttribute('data-lesson'));
    });
    on('btn-hint-prev', 'click', function () { stepHint(-1); });
    on('btn-hint-next', 'click', function () { stepHint(1); });
    on('btn-lesson-reset', 'click', function () { if (state.lesson) startLesson(state.lesson.id, { restart: true }); });
    on('btn-lesson-close', 'click', function () { closeLesson(false); });
  }

  /* ---- the checker -------------------------------------------------------------- */
  function compare(a, op, b) {
    switch (op) {
      case '>': return a > b;
      case '<': return a < b;
      case '>=': return a >= b;
      case '<=': return a <= b;
      case '==': return a === b;
      default: return false;
    }
  }

  function findSprite(which) {
    var list = rt().getSprites();
    if (!list.length) return null;
    if (!which || which === 'first') return list[0];
    var w = String(which).toLowerCase();
    for (var i = 0; i < list.length; i++) if (String(list[i].name).toLowerCase() === w) return list[i];
    return null;
  }

  /** Static look at the scripts: live blocks for the sprite on screen, saved XML for the others. */
  function blockUsed(type) {
    var safe = String(type).replace(/[^\w]/g, '');
    if (ws && ws.getAllBlocks(false).some(function (b) { return b.type === safe; })) return true;
    var re = new RegExp('<(?:block|shadow)\\b[^>]*\\btype="' + safe + '"');
    return Object.keys(state.scripts).some(function (k) { return k !== state.selectedId && re.test(state.scripts[k] || ''); });
  }

  /** Evaluate one check node: a leaf, or {all:[…]} / {any:[…]}. Unknown things count as "not yet". */
  function evalCheck(node, stats) {
    if (!node || typeof node !== 'object') return false;
    if (Array.isArray(node.all)) return node.all.every(function (n) { return evalCheck(n, stats); });
    if (Array.isArray(node.any)) return node.any.some(function (n) { return evalCheck(n, stats); });
    switch (node.type) {
      case 'prop': {
        var sp = findSprite(node.sprite);
        if (!sp) return false;
        var v = sp[node.prop];
        if (typeof v === 'boolean') v = v ? 1 : 0;
        return typeof v === 'number' && compare(v, node.op, Number(node.value));
      }
      case 'said': {
        var needle = String(node.contains || '').toLowerCase();
        return (stats.said || []).some(function (s) { return String(s.text).toLowerCase().indexOf(needle) >= 0; });
      }
      case 'variable': {
        var vars = rt().getVariables() || [];
        for (var i = 0; i < vars.length; i++) {
          if (vars[i].name === node.name) return compare(Number(vars[i].value), node.op, Number(node.value));
        }
        return false;
      }
      case 'penSegments': return (stats.penSegments || 0) >= Number(node.min);
      case 'keyPressed': return (stats.keysPressed || []).indexOf(node.key) >= 0;
      case 'blockUsed': return blockUsed(node.block);
      case 'messageBroadcast': return (stats.messages || []).indexOf(node.name) >= 0;
      default: return false;
    }
  }

  function checkLessonNow() {
    var lesson = currentLesson();
    if (!lesson || state.lesson.done) return false;
    var passed = false;
    try { passed = evalCheck(lesson.check, rt().getStats() || {}); } catch (e) { passed = false; }
    if (passed) lessonSucceeded(lesson);
    return passed;
  }

  function stopLessonTimer() { if (lessonTimer) { clearInterval(lessonTimer); lessonTimer = 0; } }

  /** Called from setRunState: poll every 250 ms while the program runs, once more at the end. */
  function lessonRunStateChanged(runState) {
    var L = state.lesson;
    if (!L || L.done) { stopLessonTimer(); return; }
    if (runState !== 'idle') {
      setBolt('bolt-think');
      if (!lessonTimer) {
        setLessonStatus(t('lesson.watching'));
        lessonTimer = setInterval(checkLessonNow, 250);
      }
      return;
    }
    stopLessonTimer();
    setBolt('bolt-happy');
    if (!checkLessonNow() && L.ran) setLessonStatus(t('lesson.notYet'));
  }

  function lessonSucceeded(lesson) {
    var L = state.lesson;
    L.done = true;
    stopLessonTimer();
    markLessonDone(lesson.id);
    setBolt('bolt-cheer');
    var message = pick(lesson.success) || t('celebrate.text');
    setLessonStatus(message);
    var isLast = L.index >= state.lessons.length - 1;
    renderLesson();
    showCelebration(message, isLast);
  }

  /* ---- celebration ------------------------------------------------------------- */
  var celebrationOpener = null;
  var confettiTimer = 0;

  function celebrationOpen() { var c = $('celebration'); return !!c && !c.hidden; }

  function showCelebration(message, isLast) {
    var box = $('celebration');
    if (!box) return;
    celebrationOpener = doc.activeElement;
    clearCelebrationParts(box);
    var text = $('celebration-text');
    if (text) text.textContent = message;
    // No confetti under reduced motion: the static message and Bolt's cheer carry the moment.
    if (!reducedMotion()) {
      var frag = doc.createDocumentFragment();
      for (var i = 0; i < 36; i++) {
        var piece = el('span', 'confetti-piece');
        piece.style.setProperty('--i', String(i));
        piece.setAttribute('aria-hidden', 'true');
        frag.appendChild(piece);
      }
      box.appendChild(frag);
      clearTimeout(confettiTimer);
      confettiTimer = setTimeout(function () { removeConfetti(box); }, 5000);
    }
    var actions = el('div', 'celebration__actions');
    var primary = null;
    if (!isLast) {
      var next = el('button', 'btn btn--primary');
      next.id = 'btn-celebration-next';
      next.type = 'button';
      next.appendChild(el('span', '', t('lesson.next')));
      next.addEventListener('click', function () { goNextLesson(); });
      actions.appendChild(next);
      primary = next;
    } else {
      actions.appendChild(el('p', 'celebration__all', t('lesson.allDone')));
    }
    var keep = el('button', 'btn ' + (primary ? 'btn--secondary' : 'btn--primary'));
    keep.id = 'btn-celebration-close';
    keep.type = 'button';
    keep.appendChild(el('span', '', t('lesson.keep')));
    keep.addEventListener('click', function () { hideCelebration(true); });
    actions.appendChild(keep);
    box.appendChild(actions);
    box.hidden = false;
    setTimeout(function () { try { (primary || keep).focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 0);
  }

  function removeConfetti(box) {
    Array.prototype.slice.call(box.querySelectorAll('.confetti-piece')).forEach(function (n) { n.parentNode.removeChild(n); });
  }
  function clearCelebrationParts(box) {
    removeConfetti(box);
    Array.prototype.slice.call(box.querySelectorAll('.celebration__actions')).forEach(function (n) { n.parentNode.removeChild(n); });
  }
  function closeCelebration() {
    var box = $('celebration');
    clearTimeout(confettiTimer);
    if (!box) return;
    box.hidden = true;
    clearCelebrationParts(box);
  }
  function hideCelebration(returnFocus) {
    closeCelebration();
    if (returnFocus) {
      var target = celebrationOpener && celebrationOpener.isConnected ? celebrationOpener : $('stage');
      if (target) { try { target.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }
  }

  /* ================================================================================
   * 11. a11y helpers
   * ================================================================================ */
  /** Arrow keys move between the sprite list's items (the list can get long). */
  function wireSpriteListKeys() {
    var list = $('sprite-list');
    if (!list) return;
    list.addEventListener('keydown', function (e) {
      var keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (!(e.key in keys)) return;
      var items = Array.prototype.slice.call(list.querySelectorAll('.sprite-item'));
      var i = items.indexOf(doc.activeElement);
      if (i < 0) return;
      var step = keys[e.key];
      if (lang === 'ar' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) step = -step;   // visual direction flips in RTL
      e.preventDefault();
      items[(i + step + items.length) % items.length].focus();
    });
  }

  /* ================================================================================
   * 12. boot
   * ================================================================================ */
  // SRI for the Blockly message files is filled in by SENTRY once the hashes are computed.
  var MSG_SRI = {
    en: 'sha384-5WVWW8OKnF6KCXKbhftrLAeT8GzsPPpK5xSrOWgyRuttDnZrICuldWVHbkg+DhIV',
    ar: 'sha384-dSQN69uPiQ8AqkX1oCvQAGGUsQnk5oLqlHdsBmb1DK2ayW6xTOQ2O2/l8ETeSHuh'
  };

  function loadScript(src, integrity) {
    return new Promise(function (resolve, reject) {
      var s = doc.createElement('script');
      var timer = setTimeout(function () { reject(new Error('timeout')); }, 10000);
      s.src = src;
      s.async = true;
      s.crossOrigin = 'anonymous';
      if (integrity) s.integrity = integrity;
      s.onload = function () { clearTimeout(timer); resolve(); };
      s.onerror = function () { clearTimeout(timer); reject(new Error('load')); };
      doc.head.appendChild(s);
    });
  }

  function loadBlocklyMessages() {
    var url = 'https://cdn.jsdelivr.net/npm/blockly@13.3.0/msg/' + lang + '.js';
    return loadScript(url, MSG_SRI[lang]).then(function () { return true; }, function () {
      toast(t('toast.msgFail'), 'error', 6000);
      return false;
    });
  }

  function showBootFailure() {
    var boot = $('app-boot');
    if (!boot) return;
    boot.hidden = false;
    // The shell now carries a heading and the welcome copy (ADR 0007); only the status line is the error.
    var p = boot.querySelector('.app-boot__status') || boot.querySelector('p');
    if (p) p.textContent = t('boot.fail');
    if (!boot.querySelector('button')) {
      var b = el('button', 'btn btn--primary', t('boot.reload'));
      b.type = 'button';
      b.addEventListener('click', function () { location.reload(); });
      boot.appendChild(b);
    }
  }

  function pickInitialProject() {
    var saved = storeGetJSON(KEY.autosave);
    var seen = storeGet(KEY.welcomeSeen);
    if (saved && seen) {
      var res = normalizeProject(saved);
      if (!res.error) return res.project;
    }
    var cont = $('wl-continue');
    if (saved && !seen && !normalizeProject(saved).error) state.pendingContinue = true;
    if (cont) cont.hidden = !state.pendingContinue;
    return normalizeProject(blankProject()).project;
  }

  /** After a language reload the lesson panel comes back where the child left it. */
  function restoreLesson() {
    var active = storeGetJSON(KEY.lessonActive, 'session');
    if (!active || typeof active.id !== 'string') return Promise.resolve();
    return loadLessons().then(function (lessons) {
      if (!lessons) return;
      var idx = lessonIndex(active.id);
      if (idx < 0) return;
      var n = (lessons[idx].hints || []).length;
      state.lesson = { id: active.id, index: idx, step: clamp(Math.floor(num(active.step, 0)), 0, Math.max(0, n - 1)), done: false, ran: false };
      showLessonPanel();
      renderLesson();
    });
  }

  function boot() {
    if (!win.Blockly || !BB.blocks || !BB.gen || !BB.rt) {
      // A script from the CDN or one of our own files did not arrive: say so kindly, with a Reload button.
      BB.app.bootError = new Error('missing: ' + [!win.Blockly && 'Blockly', !BB.blocks && 'BB.blocks', !BB.gen && 'BB.gen', !BB.rt && 'BB.rt'].filter(Boolean).join(', '));
      showBootFailure();
      return Promise.resolve();
    }

    lang = root.lang === 'ar' ? 'ar' : 'en';
    state.theme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    readLessonsDone();
    installErrorHooks();
    applyI18n(doc);
    // ADR 0007: the static shell paints the welcome copy before we are ready; starting early would
    // race the half-built workspace.  Re-enabled together with html.is-ready.
    var wlStart = $('wl-start');
    if (wlStart) wlStart.disabled = true;
    doc.title = t('app.title');
    setPressed($('btn-theme'), state.theme === 'dark');
    var langLabel = $('btn-lang-label');
    if (langLabel) langLabel.setAttribute('lang', lang === 'ar' ? 'en' : 'ar');
    if (storeGet(KEY.noticeDismissed, 'session')) dismissNotice();

    return loadBlocklyMessages().then(function () {
      BB.blocks.setLanguage(lang);
      BB.blocks.defineAll();
      installBlocklyDialogs();
      wireDialogs();

      var R = rt();
      R.init($('stage'));
      R.onRunState = setRunState;
      R.onSpriteChange = function () {
        // Scripts move sprites while running; flag the autosave (not "unsaved": no new work to lose).
        if (state.run !== 'idle' && !state.loading) state.needsAutosave = true;
        refreshSpriteInfo();
      };
      R.onHighlight = onHighlight;
      R.onError = onRuntimeError;
      R.onSay = onSay;
      R.askHandler = showAsk;
      R.onAskCancel = closeAsk;           // the question was abandoned (script removed / stop)

      // Block sizes depend on the web fonts: measure after they are ready (or after 1.5 s).
      var fonts = typeof BB.blocks.fontsReady === 'function' ? BB.blocks.fontsReady(1500) : Promise.resolve();
      return fonts.then(function () {
        injectWorkspace();
        applyProject(pickInitialProject(), {});
        state.unsaved = false;
        state.needsAutosave = false;

        wireToolbar();
        wireStage();
        wireSpriteInfo();
        wireSpriteListKeys();
        wireFileMenu();
        wireTopbar();
        wireWelcome();
        wireLessons();
        wireAudioUnlock();
        on('sprite-list', 'click', onSpriteListClick);
        on('btn-add-sprite', 'click', function (e) { openAddSprite(e.currentTarget); });
        on('char-list', 'click', function (e) {
          var card = e.target.closest('.char-card');
          if (card) addSpriteOfCharacter(card.getAttribute('data-char'));
        });
        on('saved-list', 'click', onSavedListClick);
        setRunState('idle');

        root.classList.add('is-ready');
        if (wlStart) wlStart.disabled = false;
        try { win.Blockly.svgResize(ws); } catch (e) { /* ignore */ }

        return restoreLesson().then(function () {
          // No opener on first visit: give Escape a real control to land on instead of <body>.
          if (!storeGet(KEY.welcomeSeen)) showWelcome($('btn-help'));
        });
      });
    }).catch(function (err) {
      // Any boot failure ends in the friendly screen, never a blank page. The cause is kept
      // on BB.app.bootError so QA can read it without us writing to the console.
      BB.app.bootError = err;
      showBootFailure();
    });
  }

  /* ---- public surface (tests and the other scripts use this) ---------------------- */
  BB.app = {
    t: t,
    toast: toast,
    ask: askText,
    confirm: confirmDialog,
    getLang: function () { return lang; },
    getState: function () { return state; },
    getWorkspace: function () { return ws; },
    getProject: serializeProject,
    normalizeProject: normalizeProject,
    loadProject: function (obj, opts) {
      var res = normalizeProject(obj);
      if (res.error) { toast(t(res.error), 'error'); return false; }
      applyProject(res.project, opts || {});
      return true;
    },
    startLesson: startLesson,
    evalCheck: function (node) { return evalCheck(node, rt().getStats() || {}); },
    loadLessons: loadLessons,
    STR: STR
  };

  var ready;
  function start() { if (!ready) ready = boot(); BB.app.ready = ready; return ready; }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();

})(window.BB = window.BB || {});
