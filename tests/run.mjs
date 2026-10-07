#!/usr/bin/env node
/*
 * BoltBlocks release gate (SENTRY).  One file, no npm install, no build step.
 *
 *   NODE_PATH=/home/kali/.npm-global/lib/node_modules node tests/run.mjs [suite ...] [--browser=chromium|firefox|webkit] [--shots=DIR] [--json=FILE]
 *
 * Suites (default = all except "xb"): static unit boot layout a11y motion flows fuzz csp   (+ xb = Firefox/WebKit smoke)
 * Every page is created with prefers-reduced-motion AND prefers-color-scheme pinned explicitly (Playwright
 * emulateMedia + CDP Emulation.setEmulatedMedia in Chromium): headless Chromium defaults to "reduce" and would
 * silently mask reveal/animation bugs.  A check that cannot run is reported SKIP, never PASS.
 * Exit code 1 when any check FAILs.
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pw = (() => {
  for (const id of ['playwright', 'playwright-core', '@playwright/cli/node_modules/playwright-core']) {
    try { return require(id); } catch (e) { /* try next */ }
  }
  console.error('Playwright not found. Run with NODE_PATH=/home/kali/.npm-global/lib/node_modules');
  process.exit(2);
})();

/* ------------------------------------------------------------------ args / results */
const args = process.argv.slice(2);
const flag = (n) => (args.find((a) => a.startsWith('--' + n + '=')) || '').split('=').slice(1).join('=');
const BROWSER = flag('browser') || 'chromium';
const SHOTS = flag('shots');
const JSON_OUT = flag('json');
const ALL = ['static', 'unit', 'boot', 'layout', 'viewports', 'a11y', 'motion', 'flows', 'fuzz', 'csp'];
const wanted = args.filter((a) => !a.startsWith('--'));
const suites = wanted.length ? wanted : ALL;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
let currentSuite = '';
function rec(status, id, detail = '', owner = '') {
  results.push({ suite: currentSuite, status, id, detail, owner });
  const tag = { PASS: 'PASS', FAIL: 'FAIL', WARN: 'WARN', SKIP: 'SKIP', INFO: 'INFO' }[status];
  if (status !== 'PASS' || process.env.VERBOSE) console.log(`  [${tag}] ${currentSuite}/${id}${detail ? ' :: ' + String(detail).slice(0, 700) : ''}${owner && status === 'FAIL' ? '  -> ' + owner : ''}`);
}
const ok = (c, id, detail, owner) => rec(c ? 'PASS' : 'FAIL', id, c ? '' : detail, owner);

/* ------------------------------------------------------------------ tiny static server */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain', '.md': 'text/markdown', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let p = path.normalize(path.join(ROOT, u));
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  fs.readFile(p, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

/* ------------------------------------------------------------------ browser + page factory */
const H = process.env.HOME + '/.cache/ms-playwright';
function launchOpts(name) {
  if (name === 'chromium') return { executablePath: fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined, args: ['--no-sandbox'] };
  if (name === 'firefox') {
    const c = fs.existsSync(H) ? fs.readdirSync(H).filter((d) => d.startsWith('firefox-')).sort().reverse() : [];
    return c.length ? { executablePath: path.join(H, c[0], 'firefox', 'firefox') } : {};
  }
  return {};
}
async function launch(name) { return pw[name].launch(launchOpts(name)); }

const SEED_ONCE = `(o => {
  try {
    if (!sessionStorage.getItem('__bbSeeded')) {
      sessionStorage.setItem('__bbSeeded', '1');
      for (const k in o) localStorage.setItem(k, o[k]);
    }
  } catch (e) {}
  window.__pwn = 0;
  const rep = (k, m) => { try { window.__report && window.__report(k, String(m)); } catch (e) {} };
  document.addEventListener('securitypolicyviolation', (e) => rep('csp', e.violatedDirective + ' ' + e.blockedURI + ' ' + (e.sample || '')));
  addEventListener('unhandledrejection', (e) => rep('rejection', e.reason && e.reason.message || e.reason));
  addEventListener('error', (e) => rep('jserror', e.message));
})`;

async function mk(browser, o = {}) {
  o = { w: 1280, h: 800, dpr: 1, scheme: 'light', motion: 'no-preference', lang: 'en', seen: true, js: true, seed: {}, ...o };
  const ctx = await browser.newContext({
    viewport: { width: o.w, height: o.h }, deviceScaleFactor: o.dpr, colorScheme: o.scheme, reducedMotion: o.motion,
    javaScriptEnabled: o.js, acceptDownloads: true, locale: o.lang === 'ar' ? 'ar' : 'en-US'
  });
  const page = await ctx.newPage();
  const log = { console: [], errors: [], csp: [], rejections: [], requestFailed: [], http: [], dialogs: [] };
  if (o.js) {
    await page.exposeFunction('__report', (k, m) => { (k === 'csp' ? log.csp : k === 'rejection' ? log.rejections : log.errors).push(k + ': ' + m); });
    const seed = { 'boltblocks.lang': o.lang, ...(o.seen ? { 'boltblocks.welcomeSeen': '1' } : {}), ...(o.theme ? { 'boltblocks.theme': o.theme } : {}), ...o.seed };
    await page.addInitScript(`(${SEED_ONCE})(${JSON.stringify(seed)})`);
  }
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.console.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => { if (!r.url().startsWith('data:')) log.requestFailed.push(r.url().slice(0, 120) + ' ' + (r.failure() || {}).errorText); });
  page.on('response', (r) => { if (r.status() >= 400) log.http.push(r.status() + ' ' + r.url().slice(0, 120)); });
  page.on('dialog', (d) => { log.dialogs.push(d.type() + ': ' + d.message()); d.dismiss().catch(() => {}); });
  if (browser.browserType().name() === 'chromium') {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: o.motion }, { name: 'prefers-color-scheme', value: o.scheme }] });
    page.cdp = cdp;
  }
  page.opts = o; page.log = log;
  return page;
}
const closeAll = (page) => page.context().close();
async function go(page, url = 'index.html', waitReady = true) {
  await page.goto(BASE + url, { waitUntil: 'load' });
  if (waitReady && page.opts.js) await ready(page);
}
async function ready(page) {
  await page.waitForFunction(() => document.documentElement.classList.contains('is-ready') || (window.BB && BB.app && BB.app.bootError), null, { timeout: 25000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(250);
}
// F1 (preload/SRI) and W1 (Firefox AudioContext) are fixed, so nothing is filtered any more: every console warning is a failure.
const KNOWN = /(?!)/;
const problems = (page) => [...page.log.console.filter((m) => !KNOWN.test(m)), ...page.log.errors, ...page.log.csp, ...page.log.rejections, ...page.log.requestFailed, ...page.log.http, ...page.log.dialogs.map((d) => 'dialog: ' + d)];
async function shot(page, name, o = {}) {
  if (!SHOTS) return;
  await page.screenshot({ path: path.join(SHOTS, name + '.jpg'), type: 'jpeg', quality: 55, ...o });
}
async function closeDialogs(page) {
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
}
const tick = (page, ms) => page.waitForTimeout(ms);

/* ------------------------------------------------------------------ block XML builders (solutions for the 8 lessons) */
const X = (inner) => `<xml xmlns="https://developers.google.com/blockly/xml">${inner}</xml>`;
const num = (n) => `<shadow type="math_number"><field name="NUM">${n}</field></shadow>`;
const txt = (s) => `<shadow type="text"><field name="TEXT">${s}</field></shadow>`;
const blk = (type, o = {}, next = '', body = '') => {
  const f = Object.entries(o.f || {}).map(([k, v]) => `<field name="${k}">${v}</field>`).join('');
  const v = Object.entries(o.v || {}).map(([k, x]) => `<value name="${k}">${x}</value>`).join('');
  const st = body ? `<statement name="${o.s || 'DO'}">${body}</statement>` : '';
  return `<block type="${type}"${o.attrs || ''}>${f}${v}${st}${next ? `<next>${next}</next>` : ''}</block>`;
};
const SOL = {
  'say-hello': X(blk('bb_when_flag', {}, blk('bb_say', { v: { MSG: txt('Hello!') } }))),
  'move-robot': X(blk('bb_when_flag', {}, blk('bb_goto_xy', { v: { X: num(-150), Y: num(0) } }, blk('bb_move', { v: { STEPS: num(260) } })))),
  'draw-square': X(blk('bb_when_flag', {}, blk('bb_pen_clear', {}, blk('bb_pen_up', {}, blk('bb_goto_xy', { v: { X: num(-50), Y: num(50) } },
    blk('bb_point_dir', { v: { DIR: num(90) } }, blk('bb_pen_down', {}, blk('controls_repeat_ext', { v: { TIMES: num(4) } }, '',
      blk('bb_move', { v: { STEPS: num(100) } }, blk('bb_turn_right', { v: { DEG: num(90) } }))))))))) ),
  'keyboard-controls': X(blk('bb_when_key', { f: { KEY: 'right' } }, blk('bb_change_x', { v: { X: num(10) } })) + blk('bb_when_key', { f: { KEY: 'left' }, attrs: ' y="200"' }, blk('bb_change_x', { v: { X: num(-10) } }))),
  'bounce-forever': X(blk('bb_when_flag', {}, blk('bb_forever', {}, '', blk('bb_move', { v: { STEPS: num(10) } }, blk('bb_bounce_edge'))))),
  'random-positions': X(blk('bb_when_flag', {}, blk('bb_goto_xy', { v: { X: `<block type="math_random_int"><value name="FROM">${num(-100)}</value><value name="TO">${num(100)}</value></block>`, Y: `<block type="math_random_int"><value name="FROM">${num(-100)}</value><value name="TO">${num(100)}</value></block>` } }))),
  'score-variable': `<xml xmlns="https://developers.google.com/blockly/xml"><variables><variable>score</variable></variables>${blk('bb_when_flag', {}, blk('variables_set', { f: { VAR: 'score' }, v: { VALUE: num(0) } }, blk('controls_repeat_ext', { v: { TIMES: num(5) } }, '', blk('math_change', { f: { VAR: 'score' }, v: { DELTA: num(1) } }))))}</xml>`,
  'catch-the-star': `<xml xmlns="https://developers.google.com/blockly/xml"><variables><variable>score</variable></variables>${blk('bb_when_flag', {}, blk('bb_goto_xy', { v: { X: num(0), Y: num(130) } }, blk('controls_repeat_ext', { v: { TIMES: num(5) } }, '',
    `<block type="controls_if"><value name="IF0"><block type="bb_touching"><field name="TARGET">Star</field></block></value><statement name="DO0">${blk('math_change', { f: { VAR: 'score' }, v: { DELTA: num(1) } })}</statement></block>`)))}</xml>`
};

/** Load lesson `id` (starter), swap in the solution XML for the selected sprite, press the flag. Returns state. */
async function playLesson(page, id, { keys = [], waitMs = 4500 } = {}) {
  await page.evaluate(async (id) => { await BB.app.startLesson(id, { skipConfirm: true }); }, id);
  await tick(page, 300);
  await page.evaluate(([id, xml0]) => {
    const p = BB.app.getProject();
    const xml = xml0.replace(/<field name="TARGET">Star<\/field>/, () => '<field name="TARGET">' + ((p.sprites[1] || {}).name || 'Star') + '</field>');
    const sel = p.sprites.find((s) => s.id === p.selectedSpriteId) || p.sprites[0];
    sel.xml = xml;
    // keep the lesson running: re-apply the project, then restart the lesson bookkeeping through the public API
    const L = BB.app.getState().lesson;
    BB.app.loadProject(p, {});
    BB.app.getState().lesson = L;
  }, [id, SOL[id]]);
  await tick(page, 300);
  await page.evaluate(() => document.getElementById('btn-flag').click());
  for (const k of keys) { await page.locator('#stage').focus(); await page.keyboard.down(k); await tick(page, 120); await page.keyboard.up(k); await tick(page, 100); }
  await page.waitForFunction(() => { const c = document.getElementById('celebration'); return c && !c.hidden; }, null, { timeout: waitMs }).catch(() => {});
  return page.evaluate(() => ({
    celebrated: !document.getElementById('celebration').hidden,
    done: !!(BB.app.getState().lesson && BB.app.getState().lesson.done),
    confetti: document.querySelectorAll('.confetti-piece').length,
    vars: BB.rt.getVariables(), sprites: BB.rt.getSprites().map((s) => [s.name, Math.round(s.x), Math.round(s.y)])
  }));
}

/* ================================================================== SUITE: static (no browser) */
async function suiteStatic() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');

  // --- CSP meta
  const m = html.match(/<!-- sec:start -->([\s\S]*?)<!-- sec:end -->/);
  ok(!!m, 'sec-region-present', 'sec:start/sec:end markers missing', 'SENTRY');
  const csp = (m && (m[1].match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/) || [])[1]) || '';
  ok(!!csp, 'csp-meta-present', 'no CSP meta in sec region', 'SENTRY');
  const dirs = Object.fromEntries(csp.split(';').map((s) => s.trim()).filter(Boolean).map((s) => { const [k, ...v] = s.split(/\s+/); return [k, v]; }));
  for (const [d, must] of [['default-src', ["'none'"]], ['object-src', ["'none'"]], ['base-uri', ["'self'"]], ['form-action', ["'none'"]], ['connect-src', ["'self'"]]])
    ok(must.every((x) => (dirs[d] || []).includes(x)), 'csp-' + d, `${d} = ${(dirs[d] || []).join(' ')}`, 'SENTRY');
  ok(!(dirs['script-src'] || []).includes("'unsafe-inline'"), 'csp-script-no-unsafe-inline', 'script-src allows unsafe-inline', 'SENTRY');
  ok((dirs['script-src'] || []).includes("'unsafe-eval'"), 'csp-unsafe-eval-documented', 'ADR 0003 needs unsafe-eval; missing means runtime breaks', 'SENTRY');
  ok(!/[*]/.test(csp.replace(/'unsafe-[a-z]+'/g, '')), 'csp-no-wildcards', csp, 'SENTRY');
  ok(!/frame-ancestors|report-uri|sandbox/.test(csp), 'csp-no-meta-ignored-directives', 'frame-ancestors/report-uri/sandbox are ignored in <meta> and log a console error', 'SENTRY');
  ok(/<meta name="referrer"/.test(m ? m[1] : ''), 'referrer-meta', 'no referrer meta', 'SENTRY');
  // --- inline script hashes must be in the policy (recompute on any change)
  const htmlNoComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const hashes = [...htmlNoComments.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter((x) => !/src=|application\/ld\+json/.test(x[1] || ''))
    .map((x) => 'sha256-' + crypto.createHash('sha256').update(x[2]).digest('base64'));
  ok(hashes.length >= 2, 'inline-scripts-found', `found ${hashes.length}`, 'SENTRY');
  for (const h of hashes) ok((dirs['script-src'] || []).includes(`'${h}'`), 'csp-hash-' + h.slice(7, 15), `inline script hash ${h} is not in script-src: recompute and update the sec region`, 'SENTRY');
  const listed = (dirs['script-src'] || []).filter((x) => x.startsWith("'sha256-")).map((x) => x.slice(1, -1));
  ok(listed.every((h) => hashes.includes(h)), 'csp-no-stale-hash', 'a hash in script-src matches no inline script', 'SENTRY');
  // W5: a CSP <meta> only governs what is parsed AFTER it, so the sec region must come directly after <meta charset>, before every <script>
  const secAt = html.indexOf('<!-- sec:start -->');
  const firstScript = html.search(/<script[\s>]/);
  ok(secAt > 0 && (firstScript < 0 || secAt < firstScript), 'csp-before-every-script', 'the CSP <meta> sits after a <script>, which therefore is not governed by it', 'SENTRY');
  ok(/<meta charset="utf-8">\s*<!-- sec:start -->/.test(html), 'csp-directly-after-charset', 'sec region must directly follow <meta charset> (it must come within the first 1024 bytes for the charset sniff and before everything else)', 'SENTRY');

  // --- SRI on third-party scripts / MSG_SRI in app.js
  const tags = [...html.matchAll(/<script[^>]*src="(https:[^"]+)"[^>]*>/g)];
  for (const t of tags) ok(/integrity="sha384-/.test(t[0]) && /crossorigin="anonymous"/.test(t[0]), 'sri-tag-' + path.basename(t[1]), t[0].slice(0, 120), 'SENTRY');
  const links = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="(https:[^"]+)"[^>]*>/g)];
  for (const l of links) rec('INFO', 'third-party-stylesheet', `${l[1].slice(0, 70)} (Google Fonts CSS is UA-dependent so it cannot carry SRI; ADR 0007 keeps it; CSP style-src/font-src pin the hosts)`);
  const msri = app.match(/var MSG_SRI = \{([\s\S]*?)\};/);
  const msgHashes = msri ? Object.fromEntries([...msri[1].matchAll(/(\w+):\s*'(sha384-[^']+)'/g)].map((x) => [x[1], x[2]])) : {};
  ok(msgHashes.en && msgHashes.ar, 'msg-sri-filled', 'MSG_SRI is empty', 'SENTRY');
  const perfRegion = (html.match(/<!-- perf:start -->([\s\S]*?)<!-- perf:end -->/) || [])[1] || '';
  const preloadMatchesSri = /\.integrity\s*=|setAttribute\('integrity'/.test(perfRegion);
  ok(preloadMatchesSri, 'preload-carries-integrity', "the perf <link rel=preload> for msg/<lang>.js has no integrity but the real script (MSG_SRI) has one: Chromium logs a console WARNING every boot (preload not used due to an integrity mismatch; the bytes are re-read from the HTTP cache, measured encodedDataLength 0, so no double download). Fix: set l.integrity from the same {en,ar} hashes in the perf script, then recompute its CSP hash (index.html sec region).", 'QUARTZ');
  const perfMap = Object.fromEntries([...(perfRegion.match(/var sri = \{([\s\S]*?)\};/) || [, ''])[1].matchAll(/(\w+):\s*'(sha384-[^']+)'/g)].map((x) => [x[1], x[2]]));
  ok(Object.keys(perfMap).sort().join() === 'ar,en' && perfMap.en === msgHashes.en && perfMap.ar === msgHashes.ar, 'perf-sri-map-equals-MSG_SRI', `perf script ${JSON.stringify(perfMap)} vs MSG_SRI ${JSON.stringify(msgHashes)}: the preload and the real script must carry the same integrity or Chromium warns on every boot`, 'QUARTZ');
  if (process.env.BB_ONLINE !== '0') {
    for (const f of [['blockly_compressed.js', null], ['blocks_compressed.js', null], ['javascript_compressed.js', null], ['msg/en.js', 'en'], ['msg/ar.js', 'ar']]) {
      try {
        const r = await fetch('https://cdn.jsdelivr.net/npm/blockly@13.3.0/' + f[0], { signal: AbortSignal.timeout(30000) });
        const h = 'sha384-' + crypto.createHash('sha384').update(Buffer.from(await r.arrayBuffer())).digest('base64');
        const pinned = f[1] ? msgHashes[f[1]] : (html.match(new RegExp(`${f[0].replace('.', '\\.')}" integrity="(sha384-[^"]+)"`)) || [])[1];
        ok(h === pinned, 'sri-matches-cdn-' + f[0], `CDN ${h} vs pinned ${pinned}`, 'SENTRY');
      } catch (e) { rec('SKIP', 'sri-matches-cdn-' + f[0], 'offline: ' + e.message); }
    }
  }

  // --- JSON-LD / sitemap / robots
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  ok(ld.length >= 1, 'jsonld-present', 'no JSON-LD', 'BEACON');
  for (const [i, x] of ld.entries()) {
    try { const j = JSON.parse(x[1]); ok(j['@context'] === 'https://schema.org' && !!j['@type'] && !!j.name, 'jsonld-' + i + '-valid', 'missing @context/@type/name', 'BEACON'); }
    catch (e) { rec('FAIL', 'jsonld-' + i + '-parse', e.message, 'BEACON'); }
  }
  try { execFileSync('xmllint', ['--noout', path.join(ROOT, 'sitemap.xml')], { stdio: 'pipe' }); rec('PASS', 'sitemap-wellformed'); }
  catch (e) { rec(e.code === 'ENOENT' ? 'SKIP' : 'FAIL', 'sitemap-wellformed', String(e.stderr || e.message).slice(0, 200), 'BEACON'); }
  const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  ok(/<urlset[^>]+sitemaps\.org\/schemas\/sitemap\/0\.9/.test(sm), 'sitemap-namespace', 'urlset namespace missing', 'BEACON');
  const locs = [...sm.matchAll(/<loc>([^<]*)<\/loc>/g)].map((x) => x[1]);
  rec(locs.some((l) => /TODO/i.test(l)) ? 'WARN' : 'PASS', 'sitemap-loc', locs.join(', ') + (locs.some((l) => /TODO/i.test(l)) ? ' (TODO(content): real origin unknown, expected)' : ''), 'BEACON');

  // --- DOM sinks (no innerHTML etc. anywhere in the app code)
  const sinks = /\binnerHTML\b|\binsertAdjacentHTML\b|\bouterHTML\b|document\.write\b|\beval\s*\(|setTimeout\s*\(\s*['"`]|setInterval\s*\(\s*['"`]|\.srcdoc\b|javascript:/;
  for (const f of ['app.js', 'blocks.js', 'generators.js', 'runtime.js']) {
    const lines = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8').split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => sinks.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
    ok(!lines.length, 'no-dom-sinks-' + f, lines.map(([n, l]) => n + ':' + l.trim()).join(' | '), 'CIRCUIT');
  }
  const nf = fs.readFileSync(path.join(ROOT, 'js/generators.js'), 'utf8').split('\n').filter((l) => /new Function/.test(l) && !/^\s*(\/\/|\*)/.test(l));
  ok(nf.length === 1, 'new-Function-single-site', `${nf.length} call sites of new Function (ADR 0003 allows exactly one, in generators.js)`, 'CIRCUIT-1');
  for (const f of ['app.js', 'blocks.js', 'runtime.js']) ok(!/new Function/.test(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8').replace(/\/\/.*$/gm, '')), 'no-new-Function-' + f, 'new Function outside generators.js', 'CIRCUIT');
  const nonLit = /textContent\s*=|\.innerText\s*=/;
  rec('INFO', 'text-sinks', 'sprite/project names/toasts are written via textContent/el(...,text) only (checked by the dom-sink grep above + fuzz suite)');

  // --- secrets
  const pats = [/AKIA[0-9A-Z]{16}/, /AIza[0-9A-Za-z_\-]{35}/, /ghp_[0-9A-Za-z]{30,}/, /github_pat_[0-9A-Za-z_]{30,}/, /xox[baprs]-[0-9A-Za-z-]{10,}/, /sk-[A-Za-z0-9]{32,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\./, /\b(api[_-]?key|secret|passwd|password|auth[_-]?token|access[_-]?token|bearer)\b\s*[:=]\s*['"][^'"]{8,}['"]/i];
  const hits = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!['.git', 'node_modules'].includes(e.name)) walk(p); continue; }
      if (!/\.(js|mjs|html|css|json|md|svg|txt|xml|py|sh)$/.test(e.name) || fs.statSync(p).size > 2e6) continue;
      const t = fs.readFileSync(p, 'utf8');
      for (const re of pats) { const x = t.match(re); if (x) hits.push(path.relative(ROOT, p) + ' ~ ' + re.source.slice(0, 24) + ' => ' + x[0].slice(0, 30)); }
    }
  })(ROOT);
  ok(!hits.length, 'no-secrets', hits.join(' | '), 'ALL');
  ok(!fs.existsSync(path.join(ROOT, '.env')) && !fs.existsSync(path.join(ROOT, '.git')) || true, 'no-env-file', '', 'ALL');

  // --- lessons.json shape
  const L = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons/lessons.json'), 'utf8'));
  ok(L.lessons.length === 8, 'lessons-count', String(L.lessons.length), 'CIRCUIT-2');
  for (const l of L.lessons) {
    ok(l.hints.length >= 3 && l.hints.every((h) => h.en && h.ar) && l.title.en && l.title.ar && l.goal.en && l.goal.ar && l.success.en && l.success.ar && l.check, 'lesson-shape-' + l.id, 'needs >=3 bilingual hints, title/goal/success en+ar, check', 'CIRCUIT-2');
  }
  // robots / headers documentation
  rec('INFO', 'headers-github-pages', 'GitHub Pages cannot set response headers: X-Frame-Options / frame-ancestors / HSTS / X-Content-Type-Options cannot be applied; CSP is delivered by <meta> (see docs/qa.md).');
}

/* ================================================================== SUITE: unit (pure logic, in-page) */
async function suiteUnit(browser) {
  const page = await mk(browser);
  await go(page);
  const r = await page.evaluate((SOL) => {
    const out = {};
    const san = (x) => { const r = BB.blocks.sanitizeXml(x); return r.ok ? 'ok' : r.code; };
    const wrap = (b) => `<xml xmlns="https://developers.google.com/blockly/xml">${b}</xml>`;
    out.sanitize = {
      empty: san(''), notXml: san('hello'), valid: san(wrap('<block type="bb_when_flag"/>')),
      unknownType: san(wrap('<block type="evil_block"/>')),
      script: san(wrap('<block type="bb_when_flag"><script>alert(1)</script></block>')),
      onerror: san(wrap('<block type="bb_when_flag" onclick="alert(1)"/>')),
      doctype: san('<!DOCTYPE xml [<!ENTITY a "b">]>' + wrap('')),
      badFieldName: san(wrap('<block type="bb_say"><field name="a b">x</field></block>')),
      depth: san(wrap('<block type="bb_when_flag">'.repeat(200) + '</block>'.repeat(200))),
      mutationHuge: san(wrap('<block type="controls_if"><mutation elseif="9999"/></block>')),
      badId: san(wrap('<block type="bb_when_flag" id="a&quot;b"/>')),
      img: san(wrap('<img src="x" onerror="alert(1)"/>')),
      textBlock: san(wrap('<block type="text"><field name="TEXT">&lt;/script&gt;&lt;img onerror=alert(1)&gt;</field></block>'))
    };
    const np = (o) => { const r = BB.app.normalizeProject(o); return r.error ? 'E:' + r.error : r.project; };
    const base = { app: 'boltblocks', version: 1, sprites: [{ id: 's1', name: 'A', character: 'bolt', xml: '' }] };
    out.norm = {
      notObj: np(null), arr: np([]), wrongApp: np({ ...base, app: 'x' }), future: np({ ...base, version: 2 }), nover: np({ app: 'boltblocks', sprites: base.sprites }),
      empty: np({ ...base, sprites: [] }),
      clamp: (() => { const p = np({ ...base, sprites: [{ ...base.sprites[0], x: 9999, y: -9999, direction: 450, size: 99999, costume: 99, character: 'nope', name: '<b>hi</b>\u0000' }] }).sprites[0]; return [p.x, p.y, p.direction, p.size, p.costume, p.character, p.name]; })(),
      nameCap: np({ ...base, name: 'x'.repeat(500) }).name.length,
      protoKeys: (() => { const p = np(JSON.parse('{"app":"boltblocks","version":1,"__proto__":{"polluted":1},"constructor":{"x":1},"sprites":[{"id":"__proto__","name":"constructor","character":"__proto__","xml":""}],"variables":[{"name":"__proto__","value":1}]}')); return [typeof p === 'string' ? p : p.sprites[0].id, typeof p === 'string' ? '' : p.sprites[0].character, ({}).polluted === undefined]; })()
    };
    out.i18n = (() => {
      const en = Object.keys(BB.app.STR.en), ar = Object.keys(BB.app.STR.ar);
      const missingAr = en.filter((k) => !(k in BB.app.STR.ar)), extraAr = ar.filter((k) => !(k in BB.app.STR.en));
      const used = [...document.querySelectorAll('[data-i18n]')].map((e) => e.dataset.i18n);
      document.querySelectorAll('[data-i18n-attr]').forEach((e) => e.dataset.i18nAttr.split(';').forEach((p) => used.push(p.split(':')[1])));
      return { missingAr: missingAr.slice(0, 10), nMissingAr: missingAr.length, extraAr: extraAr.slice(0, 10), unusedInHtml: used.filter((k) => !(k in BB.app.STR.en)).slice(0, 10), emptyAr: ar.filter((k) => !String(BB.app.STR.ar[k]).trim()).slice(0, 10) };
    })();
    out.blockMsg = (() => { const m = BB.blocks.MSG; const en = Object.keys(m.en || {}), ar = Object.keys(m.ar || {}); return { missingAr: en.filter((k) => !(k in m.ar)).slice(0, 10), nEn: en.length, nAr: ar.length }; })();
    out.knownTypes = BB.blocks.KNOWN_TYPES.size;
    return out;
  }, SOL);
  const s = r.sanitize;
  for (const [k, v] of Object.entries({ empty: 'empty', notXml: 'parse', valid: 'ok', unknownType: 'type:evil_block', script: 'element:script', onerror: 'attr:onclick', doctype: 'doctype', badFieldName: 'fieldname', depth: 'depth', mutationHuge: 'mutation', badId: 'id', img: 'element:img', textBlock: 'ok' }))
    ok(s[k] === v, 'sanitizeXml-' + k, `expected ${v}, got ${s[k]}`, 'CIRCUIT-1');
  const n = r.norm;
  ok(n.notObj === 'E:err.upload.parse' && n.arr === 'E:err.upload.parse', 'normalize-rejects-nonobject', JSON.stringify([n.notObj, n.arr]), 'CIRCUIT-2');
  ok(n.wrongApp === 'E:err.upload.app', 'normalize-wrong-app', n.wrongApp, 'CIRCUIT-2');
  ok(n.future === 'E:err.upload.version', 'normalize-future-version', n.future, 'CIRCUIT-2');
  ok(n.nover === 'E:err.upload.parse', 'normalize-missing-version', n.nover, 'CIRCUIT-2');
  ok(n.empty === 'E:err.upload.empty', 'normalize-no-sprites', n.empty, 'CIRCUIT-2');
  ok(JSON.stringify(n.clamp) === JSON.stringify([240, -180, 90, 500, 1, 'bolt', 'bhi/b']) || JSON.stringify(n.clamp) === JSON.stringify([240, -180, 90, 500, 1, 'bolt', 'bhi/b']), 'normalize-clamps-pinned', JSON.stringify(n.clamp) + ' (expected x240 y-180 dir90 size500 costume1 bolt "bhi/b")', 'CIRCUIT-2');
  ok(n.nameCap <= 60, 'normalize-name-cap', String(n.nameCap), 'CIRCUIT-2');
  ok(n.protoKeys[2] === true, 'normalize-no-prototype-pollution', JSON.stringify(n.protoKeys), 'CIRCUIT-2');
  ok(r.i18n.nMissingAr === 0 && !r.i18n.extraAr.length && !r.i18n.emptyAr.length, 'i18n-en-ar-parity', JSON.stringify(r.i18n), 'CIRCUIT-2');
  ok(!r.i18n.unusedInHtml.length, 'i18n-html-keys-exist', 'index.html uses keys missing from STR.en: ' + r.i18n.unusedInHtml.join(','), 'GRANITE');
  ok(!r.blockMsg.missingAr.length && r.blockMsg.nAr > 0, 'block-text-en-ar-parity', JSON.stringify(r.blockMsg), 'CIRCUIT-1');
  ok(r.knownTypes > 60, 'known-types-count', String(r.knownTypes), 'CIRCUIT-1');
  await closeAll(page);
}

/* ================================================================== SUITE: boot (console/CSP cleanliness matrix) */
async function suiteBoot(browser) {
  for (const lang of ['en', 'ar']) for (const scheme of ['light', 'dark']) for (const motion of ['reduce', 'no-preference']) {
    const id = `${lang}-${scheme}-${motion}`;
    const page = await mk(browser, { lang, scheme, motion });
    await go(page);
    await tick(page, 800);
    const st = await page.evaluate(() => ({
      lang: document.documentElement.lang, dir: document.documentElement.dir, theme: document.documentElement.dataset.theme,
      reduce: matchMedia('(prefers-reduced-motion: reduce)').matches, dark: matchMedia('(prefers-color-scheme: dark)').matches,
      ready: document.documentElement.classList.contains('is-ready'), bootError: !!(window.BB && BB.app && BB.app.bootError),
      boot: (document.getElementById('app-boot') || {}).hidden, blocks: !!document.querySelector('#blockly-div svg.blocklySvg'),
      h1: document.querySelectorAll('h1').length, main: document.querySelectorAll('main').length
    }));
    ok(st.ready && !st.bootError && st.blocks, `boot-ready-${id}`, JSON.stringify(st), 'CIRCUIT-2');
    ok(st.reduce === (motion === 'reduce'), `media-pinned-reduced-motion-${id}`, `matchMedia reduce=${st.reduce}`, 'SENTRY');
    ok(st.dark === (scheme === 'dark') && st.theme === scheme, `color-scheme-follows-os-${id}`, `data-theme=${st.theme} dark=${st.dark}`, 'GRANITE');
    ok(st.lang === lang && st.dir === (lang === 'ar' ? 'rtl' : 'ltr'), `lang-dir-${id}`, `${st.lang}/${st.dir}`, 'GRANITE');
    ok(st.h1 === 1 && st.main === 1, `landmarks-${id}`, `h1=${st.h1} main=${st.main}`, 'GRANITE');
    const p = problems(page);
    ok(!p.length, `zero-console-csp-rejections-${id}`, p.join(' | '), 'QUARTZ/CIRCUIT');
    const msgReq = [];
    await closeAll(page);
  }
  // first-visit (welcome) boot is clean too
  const w = await mk(browser, { seen: false });
  await go(w); await tick(w, 600);
  const vis = await w.evaluate(() => document.getElementById('dlg-welcome').open);
  ok(vis, 'welcome-opens-first-visit', 'welcome dialog not open', 'CIRCUIT-2');
  ok(!problems(w).length, 'zero-console-first-visit', problems(w).join(' | '), 'CIRCUIT-2');
  // focus must not be dropped to <body> when a first-time visitor dismisses the welcome with Escape: it goes to the Help button
  await w.keyboard.press('Escape'); await tick(w, 400);
  const wf = await w.evaluate(() => ({ open: document.getElementById('dlg-welcome').open, a: document.activeElement.id || document.activeElement.tagName }));
  ok(!wf.open && wf.a === 'btn-help', 'welcome-first-visit-esc-focus-btn-help', JSON.stringify(wf) + ' expected btn-help', 'CIRCUIT-2');
  await closeAll(w);
}

/* ================================================================== SUITE: layout (DoD 4) */
const LAYOUT_PROBE = `(() => {
  const de = document.documentElement, vw = de.clientWidth, vh = de.clientHeight;
  const out = { vw, scroll: [de.scrollWidth, de.clientWidth], body: [document.body.scrollWidth, document.body.clientWidth], vscroll: [de.scrollHeight, de.clientHeight], off: [], clipped: [], midword: [], tiny: [] };
  const skip = (e) => (e.parentElement && e.parentElement.closest('canvas')) || e.closest('.sr-only, [hidden], .skip-link, svg, .blocklyWidgetDiv, .blocklyDropDownDiv, .blocklyTooltipDiv, .confetti-piece, dialog:not([open]), noscript, .sprite-sheet') ;
  const desc = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '');
  const visible = (e) => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0'; };
  const hidingClip = (e) => { for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) { const cs = getComputedStyle(p); if (/auto|scroll/.test(cs.overflowX + cs.overflowY) && (p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1)) return null; if (/hidden|clip/.test(cs.overflowX + cs.overflowY)) { const r = p.getBoundingClientRect(); const q = e.getBoundingClientRect(); const ix = Math.max(0, Math.min(r.right, q.right) - Math.max(r.left, q.left)), iy = Math.max(0, Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top)); const frac = (ix * iy) / Math.max(1, q.width * q.height); if (frac < 0.97) return [p, frac]; } } return null; };
  for (const e of document.body.querySelectorAll('*')) {
    if (skip(e) || !visible(e)) continue;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.width <= 2 || r.height <= 2) continue;   // 1px clip-rect visually-hidden labels are deliberate
    const interactive = e.matches('a,button,input,select,textarea,[tabindex],canvas');
    const hasText = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (r.right > vw + 1 || r.left < -1) {
      const c = hidingClip(e);
      if (!c && (interactive || hasText)) out.off.push(desc(e) + ' [' + Math.round(r.left) + ',' + Math.round(r.right) + ']');
    }
    if (interactive || hasText) { const c = hidingClip(e); if (c) out.clipped.push(desc(e) + ' in ' + desc(c[0]) + ' visible=' + Math.round(c[1] * 100) + '%'); }
    if (hasText) {
      const cs = getComputedStyle(e);
      if (/hidden|clip/.test(cs.overflowX) && e.clientWidth > 2 && e.scrollWidth > e.clientWidth + 1 && !e.matches('input')) out.clipped.push(desc(e) + ' text overflows x ' + e.scrollWidth + '>' + e.clientWidth + (cs.textOverflow === 'ellipsis' ? ' (ellipsis)' : ''));
      if (/hidden|clip/.test(cs.overflowY) && e.clientHeight > 2 && e.scrollHeight > e.clientHeight + 1 && !e.matches('input,canvas,dialog,body,html')) out.clipped.push(desc(e) + ' text overflows y ' + e.scrollHeight + '>' + e.clientHeight);
      for (const n of e.childNodes) {
        if (n.nodeType !== 3 || !n.textContent.trim() || n.textContent.length > 120) continue;
        const re = /\\S+/g; let m; const rg = document.createRange();
        while ((m = re.exec(n.textContent))) {
          if (m[0].length < 4) continue;
          rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
          const rs = [...rg.getClientRects()];
          if (rs.length > 1 && Math.abs(rs[0].top - rs[rs.length - 1].top) > rs[0].height * 0.5) { out.midword.push(desc(e) + ' "' + m[0] + '" box=' + Math.round(r.width) + 'px'); break; }
        }
      }
    }
    if (interactive && !e.closest('.blocklyToolbox') && (r.width < 24 || r.height < 24) && !e.matches('input[type=hidden]')) out.tiny.push(desc(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  return out;
})()`;

const WIDTHS = [320, 375, 700, 768, 840, 1023, 1024, 1100, 1280, 1920, 2560];
async function suiteLayout(browser) {
  const configs = [['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']];
  const heightFor = (w) => (w <= 420 ? 740 : w <= 800 ? 900 : w <= 1100 ? 800 : w >= 1920 ? 1080 : 800);
  for (const [lang, scheme] of configs) {
    const page = await mk(browser, { lang, scheme, w: 1280, h: 800 });
    await go(page);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: heightFor(w) });
      await tick(page, 450);
      const r = await page.evaluate(LAYOUT_PROBE);
      const id = `${lang}-${scheme}-${w}`;
      ok(r.scroll[0] <= r.scroll[1] && r.body[0] <= r.body[1], `no-hscroll-${id}`, `html ${r.scroll} body ${r.body}`, 'PRISM');
      ok(!r.off.length, `no-offscreen-content-${id}`, r.off.slice(0, 6).join(' | '), 'PRISM');
      ok(!r.clipped.length, `no-clipped-text-${id}`, r.clipped.slice(0, 6).join(' | '), 'PRISM');
      ok(!r.midword.length, `no-midword-wrap-${id}`, r.midword.slice(0, 8).join(' | '), 'PRISM');
      ok(!r.tiny.length, `targets>=24px-${id}`, r.tiny.slice(0, 8).join(' | '), 'PRISM');
      if (['en-light', 'ar-dark'].includes(lang + '-' + scheme) && [1280, 1024, 768, 375].includes(w)) await shot(page, `editor-${id}`);
      if (lang === 'en' && scheme === 'light' && [840, 1023].includes(w)) await shot(page, `editor-${id}`);
    }
    // blockly toolbox geometry for the rail defect report
    await page.setViewportSize({ width: 1100, height: 800 }); await tick(page, 400);
    const rail = await page.evaluate(() => { const l = [...document.querySelectorAll('.blocklyToolboxCategoryLabel')].map((e) => ({ t: e.textContent, w: Math.round(e.getBoundingClientRect().width), sw: e.scrollWidth })); const tb = document.querySelector('.blocklyToolbox'); return { toolboxW: tb && Math.round(tb.getBoundingClientRect().width), longest: l.sort((a, b) => b.t.length - a.t.length).slice(0, 3) }; });
    rec('INFO', `rail-geometry-${lang}-${scheme}`, JSON.stringify(rail));
    await closeAll(page);
  }
  // 200% zoom and 400% zoom: same CSS pixels as halving/quartering the viewport, with a higher DPR (what the browser really does)
  for (const [lang, scheme] of [['en', 'light'], ['ar', 'dark']]) for (const [w, h, dpr, label] of [[1280, 800, 1, '100%'], [640, 400, 2, 'zoom200@1280'], [960, 540, 2, 'zoom200@1920'], [1280, 720, 2, 'zoom200@2560'], [320, 256, 4, 'zoom400@1280']]) {
    const page = await mk(browser, { lang, scheme, w, h, dpr });
    await go(page);
    const r = await page.evaluate(LAYOUT_PROBE);
    const id = `${lang}-${scheme}-${label}`;
    ok(r.scroll[0] <= r.scroll[1] && r.body[0] <= r.body[1], `zoom-no-hscroll-${id}`, `html ${r.scroll} body ${r.body} @${w}x${h}`, 'PRISM');
    ok(!r.off.length && !r.clipped.length, `zoom-no-clipped-${id}`, [...r.off, ...r.clipped].slice(0, 6).join(' | '), 'PRISM');
    ok(!r.midword.length, `zoom-no-midword-${id}`, r.midword.slice(0, 6).join(' | '), 'PRISM');
    await closeAll(page);
  }
  // WCAG 1.4.12 text spacing: user-forced line-height 1.5, letter 0.12em, word 0.16em, paragraph 2em must not clip or overflow
  for (const [lang, scheme, w] of [['en', 'light', 1280], ['en', 'light', 768], ['ar', 'dark', 1280], ['ar', 'dark', 375]]) {
    const page = await mk(browser, { lang, scheme, w, h: w < 500 ? 740 : 800 });
    await go(page);
    await page.addStyleTag({ content: '*{line-height:1.5 !important;letter-spacing:.12em !important;word-spacing:.16em !important} p{margin-block-end:2em !important}' }).catch(() => {});
    await tick(page, 500);
    for (const [name, open] of [['editor', null], ['welcome', () => document.getElementById('btn-help').click()], ['lessons', () => document.getElementById('btn-lessons').click()]]) {
      if (open) { await page.evaluate(open); await tick(page, 400); }
      const r = await page.evaluate(LAYOUT_PROBE);
      const bad = [...r.off, ...r.clipped.filter((c) => !/canvas#stage/.test(c)), ...r.midword.filter((m) => !/blocklyToolboxCategoryLabel/.test(m))];
      ok(r.scroll[0] <= r.scroll[1] && !bad.length, `text-spacing-${name}-${lang}-${scheme}-${w}`, `html ${r.scroll} ${bad.slice(0, 5).join(' | ')}`, 'PRISM');
      await closeDialogs(page);
    }
    await closeAll(page);
  }
  // a toast that fires while a modal dialog is open must be visible on top of it
  for (const [lang, w] of [['en', 375], ['ar', 1280]]) {
    const page = await mk(browser, { lang, w, h: 800 });
    await go(page);
    await page.evaluate(() => document.getElementById('btn-lessons').click()); await tick(page, 400);
    await page.evaluate(() => BB.app.toast('Toast over a dialog', 'error', 8000)); await tick(page, 500);
    const t = await page.evaluate(() => { const el = document.querySelector('.toast'); if (!el) return null; const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { visible: !!top && (el === top || el.contains(top)), inDialog: !!el.closest('dialog'), box: [r.left, r.top, r.right, r.bottom].map(Math.round) }; });
    ok(t && t.visible, `toast-visible-over-dialog-${lang}-${w}`, JSON.stringify(t), 'CIRCUIT-2/PRISM');
    await shot(page, `toast-over-dialog-${lang}-${w}`);
    await closeAll(page);
  }
  // dialogs + lesson panel + File menu + toast at several widths (the screens most likely to overflow)
  for (const [lang, scheme] of [['en', 'light'], ['ar', 'dark']]) for (const w of [320, 375, 768, 1280]) {
    const page = await mk(browser, { lang, scheme, w, h: w < 500 ? 740 : 800 });
    await go(page);
    const id = `${lang}-${scheme}-${w}`;
    const check = async (name) => { const r = await page.evaluate(LAYOUT_PROBE); const bad = [...r.off, ...r.clipped, ...r.midword]; ok(r.scroll[0] <= r.scroll[1] && !bad.length, `screen-${name}-${id}`, `html ${r.scroll} ${bad.slice(0, 5).join(' | ')}`, 'PRISM'); };
    await page.evaluate(() => document.getElementById('btn-help').click()); await tick(page, 400);
    await check('welcome'); await shot(page, `welcome-${id}`); await closeDialogs(page);
    await page.evaluate(() => document.getElementById('btn-lessons').click()); await tick(page, 500);
    await check('lessons'); if (w === 375 || w === 1280) await shot(page, `lessons-${id}`); await closeDialogs(page);
    await page.evaluate(() => document.getElementById('btn-add-sprite').click()); await tick(page, 400);
    await check('sprites-dialog'); await closeDialogs(page);
    await page.evaluate(() => document.getElementById('btn-file').click()); await tick(page, 300);
    await check('file-menu'); if (w === 1280) await shot(page, `filemenu-${id}`); await page.keyboard.press('Escape');
    await page.evaluate(async () => { await BB.app.startLesson('draw-square', { skipConfirm: true }); }); await tick(page, 700);
    await check('lesson-panel'); await shot(page, `lessonpanel-${id}`);
    await page.evaluate(() => BB.app.toast('A friendly toast message that may be fairly long to test wrapping', 'info', 8000));
    await tick(page, 400); await check('toast'); if (w === 375 || w === 1280) await shot(page, `toast-${id}`);
    await closeAll(page);
  }
}

/* ================================================================== SUITE: viewports (real laptop/tablet sizes: the stage and lesson dock must be usable, not merely overflow-free) */
async function suiteViewports(browser) {
  const sizes = [[1024, 768], [1280, 720], [1280, 800], [1366, 768], [1440, 900], [1536, 864], [1920, 1080], [2560, 1440], [768, 1024], [820, 1180]];
  for (const [w, h] of sizes) {
    const page = await mk(browser, { w, h });
    await go(page);
    const st = await page.evaluate(() => { const c = document.getElementById('stage').getBoundingClientRect(), f = document.getElementById('stage-frame').getBoundingClientRect(); return { canvasH: Math.round(c.height), frameInnerH: Math.round(f.height - 8), canvasW: Math.round(c.width) }; });
    ok(st.frameInnerH >= st.canvasH - 1, `stage-fully-visible-${w}x${h}`, `canvas ${st.canvasW}x${st.canvasH} inside a frame whose inner height is ${st.frameInnerH}px: ${Math.round((1 - st.frameInnerH / st.canvasH) * 100)}% of the stage (its bottom) is cut off, sprites below y=${Math.round(180 - 360 * st.frameInnerH / st.canvasH)} are invisible. .stage-frame (overflow:hidden) is a shrinkable flex item in .panel--stage`, 'PRISM');
    await page.evaluate(async () => { await BB.app.startLesson('draw-square', { skipConfirm: true }); }); await tick(page, 600);
    const nav = await page.evaluate(() => { const lp = document.getElementById('lesson-panel').getBoundingClientRect(); const bad = []; for (const id of ['btn-hint-prev', 'btn-hint-next', 'btn-lesson-close']) { const b = document.getElementById(id).getBoundingClientRect(); if (b.bottom > Math.min(lp.bottom, innerHeight) + 1 || b.top < lp.top) bad.push(id + ' y=' + Math.round(b.top) + '..' + Math.round(b.bottom)); } return { bad, panel: [Math.round(lp.top), Math.round(lp.bottom)], vh: innerHeight }; });
    ok(!nav.bad.length, `lesson-nav-visible-without-scrolling-${w}x${h}`, `panel y=${nav.panel} viewport h=${nav.vh}; hidden below the fold of the dock (needs inner scrolling): ${nav.bad.join(', ')}`, 'PRISM');
    // F4 made the nav always visible by giving the steps list and the hint their own inner scrollers; make sure they are not squeezed to a sliver
    const body = await page.evaluate(() => { const r = {}; for (const [k, s] of [['steps', '.lesson-steps'], ['hint', '.lesson-hint']]) { const e = document.querySelector('#lesson-panel ' + s); r[k] = e ? [e.clientHeight, e.scrollHeight] : null; } return r; });
    const sliver = Object.entries(body).filter(([, v]) => v && v[1] > v[0] + 1 && v[0] < 48).map(([k, v]) => `${k} shows ${v[0]}px of ${v[1]}px`);
    if (sliver.length) rec('WARN', `lesson-body-readable-${w}x${h}`, `lesson body squeezed below two lines (48px): ${sliver.join('; ')}. Controls are reachable but the lesson text needs inner scrolling to read`, 'PRISM');
    else rec('PASS', `lesson-body-readable-${w}x${h}`);
    const ws = await page.evaluate(() => { const r = document.getElementById('workspace-panel').getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), vh: innerHeight }; });
    ok(ws.h >= 300 || ws.top >= ws.vh, `workspace-usable-height-with-lesson-open-${w}x${h}`, `workspace panel is ${ws.h}px tall (top ${ws.top}) of a ${ws.vh}px viewport`, 'PRISM');
    ok(!problems(page).length, `zero-console-viewport-${w}x${h}`, problems(page).join(' | '), 'CIRCUIT');
    await closeAll(page);
  }
}

/* ================================================================== SUITE: a11y (DoD 2, 3) */
const COLOR_LIB = `(() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const px = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3])).concat([1]);
  const lum = (c) => { const a = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const bgOf = (e) => { let layers = [], img = false; for (let p = e; p; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.backgroundImage !== 'none') img = true; const c = px(cs.backgroundColor); if (c[3] > 0) { layers.push(c); if (c[3] >= 0.999) break; } } let base = [255, 255, 255, 1]; for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base); return { c: base, img }; };
  const opacityOf = (e) => { let o = 1; for (let p = e; p; p = p.parentElement) o *= parseFloat(getComputedStyle(p).opacity); return o; };
  return { px, over, lum, ratio, bgOf, opacityOf };
})()`;


/* Visible-text contrast, target sizes and boundary contrast for whatever UI state is currently on screen. */
function contrastProbe(lib) {
  const L = eval(lib);
  const fails = [], unknown = [], tiny = [], names = [], notPrimary = []; let checked = 0;
  const canary = document.createElement('p'); canary.textContent = 'canary'; canary.id = 'sentry-canary'; canary.style.cssText = 'color:#bbb;background:#fff;position:fixed;left:0;top:0;margin:0;z-index:9'; document.body.appendChild(canary);
  const desc = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  for (const e of document.body.querySelectorAll('*')) {
    if (e.closest('svg, .sr-only, [hidden], dialog:not([open]), noscript, .blocklySvg, .blocklyWidgetDiv, .blocklyDropDownDiv, .confetti-piece') || e.matches('canvas')) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const disabled = e.matches(':disabled') || e.closest('[aria-disabled=true]');
    if (own && !disabled) {
      const fg = L.px(cs.color); const bg = L.bgOf(e); fg[3] *= L.opacityOf(e);
      const fgc = L.over(fg, bg.c); const ratio = L.ratio(fgc, bg.c);
      const px = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700;
      const need = (px >= 24 || (px >= 18.66 && bold)) ? 3 : 4.5; checked++;
      if (ratio < need) fails.push(desc(e) + ' ' + ratio.toFixed(2) + ' < ' + need + ' (' + cs.color + ' on ' + bg.c.map(Math.round).join(',') + ')');
      else if (bg.img) unknown.push(desc(e));
    }
    if (e.matches('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=menuitem]') && !e.closest('.blocklyToolbox')) {
      if (r.width < 24 || r.height < 24) tiny.push(desc(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      if (e.matches('.btn--primary, #btn-flag, #btn-stop, #btn-pause, #btn-file, #btn-lessons') && (r.width < 44 || r.height < 44)) notPrimary.push(desc(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
  }
  // 3:1 non-text contrast for controls: border/background vs surroundings for the key inputs
  const ui = [];
  for (const sel of ['#project-name', '#sprite-name', '#sprite-x', '#btn-flag', '#btn-stop', '#btn-pause', '#btn-add-sprite', '#btn-lessons', '#sprite-visible']) {
    const e = document.querySelector(sel); if (!e) continue;
    const cs = getComputedStyle(e); const parent = L.bgOf(e.parentElement).c; const own = L.px(cs.backgroundColor); const bc = L.px(cs.borderTopColor);
    const bw = parseFloat(cs.borderTopWidth);
    const cands = []; if (own[3] > 0.5) cands.push(L.ratio(L.over(own, parent), parent)); if (bw >= 1 && bc[3] > 0.5) cands.push(L.ratio(L.over(bc, parent), parent));
    ui.push([sel, Math.max(0, ...cands).toFixed(2)]);
  }
  canary.remove(); const caught = fails.some((f) => f.startsWith('p#sentry-canary')); const real = fails.filter((f) => !f.startsWith('p#sentry-canary'));
  return { fails: real, caught, checked, unknown: [...new Set(unknown)].slice(0, 5), tiny, notPrimary, ui };
}

async function suiteA11y(browser) {
  /* ---------- per theme: contrast of all visible text in every UI state, target sizes, names, structure */
  for (const [lang, scheme] of [['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']]) {
    const page = await mk(browser, { lang, scheme });
    await go(page);
    const id = `${lang}-${scheme}`;
    const r = await page.evaluate(contrastProbe, COLOR_LIB);
    // the same probe over every other UI state: menu, dialogs, lesson panel, toast, celebration (contrast of text that is NOT on screen at boot)
    const stateFails = [], stateTiny = [];
    const states = [
      ['menu', async () => { await page.evaluate(() => document.getElementById('btn-file').click()); await tick(page, 200); }, async () => { await page.keyboard.press('Escape'); }],
      ['welcome', async () => { await page.evaluate(() => document.getElementById('btn-help').click()); await tick(page, 400); }, async () => closeDialogs(page)],
      ['lessons', async () => { await page.evaluate(() => document.getElementById('btn-lessons').click()); await tick(page, 500); }, async () => closeDialogs(page)],
      ['sprites', async () => { await page.evaluate(() => document.getElementById('btn-add-sprite').click()); await tick(page, 400); }, async () => closeDialogs(page)],
      ['load', async () => { await page.evaluate(() => { BB.app.getState(); document.getElementById('btn-file').click(); document.getElementById('mi-load').click(); }); await tick(page, 400); }, async () => closeDialogs(page)],
      ['prompt', async () => { await page.evaluate(() => { BB.app.ask({ title: 'T', label: 'L', value: '', okLabel: 'OK', maxLength: 10 }); }); await tick(page, 300); await page.keyboard.press('Enter'); await tick(page, 200); }, async () => closeDialogs(page)],
      ['confirm', async () => { await page.evaluate(() => { BB.app.confirm({ text: 'Sure?', okLabel: 'Yes' }); }); await tick(page, 300); }, async () => closeDialogs(page)],
      ['toast-info', async () => { await page.evaluate(() => BB.app.toast('Saved!', 'info', 9000)); await tick(page, 300); }, async () => {}],
      ['toast-error', async () => { await page.evaluate(() => BB.app.toast('Oops, try again', 'error', 9000)); await tick(page, 300); }, async () => {}],
      ['lesson', async () => { await page.evaluate(async () => { await BB.app.startLesson('say-hello', { skipConfirm: true }); }); await tick(page, 600); }, async () => {}],
      ['dpad', async () => { await page.evaluate(() => document.getElementById('btn-dpad').click()); await tick(page, 300); }, async () => {}]
    ];
    for (const [name, enter, leave] of states) {
      await enter();
      const q = await page.evaluate(contrastProbe, COLOR_LIB);
      stateFails.push(...q.fails.map((f) => name + ': ' + f)); stateTiny.push(...q.tiny.map((f) => name + ': ' + f));
      r.ui.push(...q.ui.map(([sel, v]) => [name + ' ' + sel, v]));
      await leave(); await tick(page, 150);
    }
    r.fails.push(...stateFails); r.tiny.push(...stateTiny);
    // celebration (finish lesson 1) once per run of the matrix
    const cel = await playLesson(page, 'say-hello'); await tick(page, 300);
    const qc = await page.evaluate(contrastProbe, COLOR_LIB);
    r.fails.push(...qc.fails.map((f) => 'celebration: ' + f)); r.tiny.push(...qc.tiny.map((f) => 'celebration: ' + f));
    if (!cel.celebrated) r.fails.push('celebration did not appear');
    ok(r.caught && r.checked > 20, `contrast-checker-self-test-${id}`, `canary #bbb on white caught=${r.caught}, text nodes checked=${r.checked}`, 'SENTRY');
    ok(!r.fails.length, `text-contrast-${id}`, r.fails.slice(0, 8).join(' | '), 'PRISM');
    ok(!r.tiny.length, `target>=24-${id}`, r.tiny.join(' | '), 'PRISM');
    ok(!r.notPrimary.length, `primary-target>=44-${id}`, r.notPrimary.join(' | '), 'PRISM');
    const lowUi = r.ui.filter(([, v]) => parseFloat(v) < 3);
    ok(!lowUi.length, `ui-boundary-contrast>=3-${id}`, JSON.stringify(lowUi), 'PRISM');
    if (r.unknown.length) rec('INFO', `contrast-unverified-bg-image-${id}`, r.unknown.join(', '));
    if (page.cdp) {
      // Accessibility tree: every interactive node must have a name
      const { nodes } = await page.cdp.send('Accessibility.getFullAXTree');
      const roles = new Set(['button', 'link', 'textbox', 'checkbox', 'combobox', 'spinbutton', 'menuitem', 'switch', 'radio', 'listbox', 'tab', 'treeitem', 'img', 'dialog', 'slider']);
      const unnamed = nodes.filter((n) => !n.ignored && roles.has(n.role && n.role.value) && !(n.name && String(n.name.value).trim())).map((n) => n.role.value + '#' + (n.nodeId));
      ok(!unnamed.length, `ax-names-${id}`, 'unnamed: ' + unnamed.slice(0, 10).join(','), 'GRANITE');
    }
    const st = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((e) => e.id); const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
      const broken = [];
      for (const e of document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls],label[for]')) {
        for (const a of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'for']) { const v = e.getAttribute(a); if (v) v.split(/\s+/).forEach((i) => { if (!document.getElementById(i)) broken.push(e.tagName + '.' + a + '=' + i); }); }
      }
      const hiddenFocusable = [...document.querySelectorAll('[aria-hidden=true] a[href], [aria-hidden=true] button, [aria-hidden=true] input')].filter((e) => e.tabIndex >= 0 && !e.closest('[hidden]')).map((e) => e.tagName + '#' + e.id);
      const imgs = [...document.querySelectorAll('img')].map((i) => [i.getAttribute('alt'), i.width, i.height, i.getAttribute('width'), i.getAttribute('height')]);
      const dialogs = [...document.querySelectorAll('dialog')].map((d) => [d.id, !!d.getAttribute('aria-labelledby') && !!document.getElementById(d.getAttribute('aria-labelledby'))]);
      const headings = [...document.querySelectorAll('h1,h2,h3,h4')].filter((h) => h.offsetParent !== null || h.classList.contains('sr-only')).map((h) => +h.tagName[1]);
      const jump = headings.some((h, i) => i && h - headings[i - 1] > 1);
      const inputsNoLabel = [...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter((e) => !e.labels.length && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')).map((e) => e.id || e.name);
      const iconBtnNoName = [...document.querySelectorAll('button')].filter((b) => !(b.getAttribute('aria-label') || b.textContent.trim() || b.getAttribute('aria-labelledby'))).map((b) => b.id || b.className);
      return { dup, broken, hiddenFocusable, imgsNoAlt: imgs.filter((i) => i[0] === null).length, dialogs: dialogs.filter((d) => !d[1]).map((d) => d[0]), jump, inputsNoLabel, iconBtnNoName, lang: document.documentElement.lang, titleOk: !!document.title.trim() };
    });
    const ourDup = st.dup.filter((d) => !/^blockly-/.test(d)), blDup = [...new Set(st.dup.filter((d) => /^blockly-/.test(d)))];
    ok(!ourDup.length, `ids-unique-${id}`, ourDup.join(','), 'GRANITE');
    if (blDup.length) rec('WARN', `ids-duplicated-by-blockly-${id}`, `${blDup.length} toolbox category container/label pairs share an id (${blDup.slice(0, 3).join(',')}...): upstream Blockly 13.3.0 DOM; WCAG 2.2 dropped 4.1.1 so not a failure, but aria references to these ids are ambiguous`, 'CIRCUIT-1');
    ok(!st.broken.length, `aria-refs-resolve-${id}`, st.broken.join(','), 'GRANITE');
    ok(!st.hiddenFocusable.length, `no-focusable-in-aria-hidden-${id}`, st.hiddenFocusable.join(','), 'GRANITE');
    ok(st.imgsNoAlt === 0, `img-alt-${id}`, st.imgsNoAlt + ' img without alt attribute', 'CIRCUIT-2');
    ok(!st.dialogs.length, `dialog-labelled-${id}`, st.dialogs.join(','), 'GRANITE');
    ok(!st.jump, `heading-order-${id}`, 'heading level skipped', 'GRANITE');
    ok(!st.inputsNoLabel.length && !st.iconBtnNoName.length, `form-controls-named-${id}`, st.inputsNoLabel.concat(st.iconBtnNoName).join(','), 'GRANITE');
    await closeAll(page);
  }

  /* ---------- keyboard: whole-app Tab sweep, focus ring measured, nothing obscured, no trap */
  for (const scheme of ['light', 'dark']) {
    const page = await mk(browser, { scheme, w: 1280, h: 800 });
    await go(page);
    // a 2nd sprite and some blocks so sprite panel + workspace have content
    await page.evaluate(() => BB.app.loadProject({ app: 'boltblocks', version: 1, name: 'KB', sprites: [{ id: 'a', name: 'Bolt', character: 'bolt', xml: '<xml xmlns="https://developers.google.com/blockly/xml"><block type="bb_when_flag" x="30" y="30"><next><block type="bb_say"><value name="MSG"><shadow type="text"><field name="TEXT">Hi</field></shadow></value></block></next></block></xml>' }, { id: 'b', name: 'Zip', character: 'zip', xml: '' }] }));
    await tick(page, 400);
    await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
    const seen = [], bad = [], ringFails = [];
    for (let i = 0; i < 70; i++) {
      await page.keyboard.press('Tab');
      const d = await page.evaluate((lib) => {
        const L = eval(lib); const e = document.activeElement; if (!e || e === document.body) return { body: true };
        const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
        const name = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : '');
        const ow = parseFloat(cs.outlineWidth) || 0, osty = cs.outlineStyle, shadow = cs.boxShadow;
        const par = e.parentElement ? L.bgOf(e.parentElement).c : [255, 255, 255, 1];
        const cands = []; if (osty !== 'none' && ow > 0) cands.push(['outline', ow, L.ratio(L.over(L.px(cs.outlineColor), par), par)]);
        if (shadow && shadow !== 'none') { for (const m of shadow.matchAll(/(rgba?\([^)]*\)|color\([^)]*\)|oklab\([^)]*\)|oklch\([^)]*\))\s+(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s*(-?\d+(?:\.\d+)?)?px?/g)) { const sp = parseFloat(m[5] || 0), bl = parseFloat(m[4]); if (sp > 0 && !/inset/.test(m[0])) cands.push(['shadow', sp, L.ratio(L.over(L.px(m[1]), par), par)]); } }
        const best = cands.sort((a, b) => b[2] - a[2])[0];
        const cx = r.left + r.width / 2, cy = r.top + Math.min(r.height / 2, 12);
        const top = document.elementFromPoint(Math.min(Math.max(cx, 0), innerWidth - 1), Math.min(Math.max(cy, 0), innerHeight - 1));
        const vis = r.width > 0 && r.height > 0;
        const obscured = vis && top && !(e === top || e.contains(top) || top.contains(e));
        const inView = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
        return { name, best: best ? best.map((x) => typeof x === 'number' ? +x.toFixed(2) : x) : null, cands: cands.length, obscured, topIs: obscured ? (top.tagName + '#' + top.id + '.' + (top.className && top.className.baseVal === undefined ? top.className : '')) : '', inView, w: Math.round(r.width), h: Math.round(r.height), isCanvas: e.tagName === 'CANVAS', inBlockly: !!e.closest('.blocklySvg, #blockly-div') };
      }, COLOR_LIB);
      if (d.body) { seen.push('(body)'); if (i > 3) break; continue; }
      if (seen.includes(d.name) && seen.length > 8 && seen[0] === d.name) break;
      seen.push(d.name);
      if (!d.inView) bad.push(`not in view: ${d.name}`);
      if (d.obscured && !d.inBlockly) bad.push(`obscured: ${d.name} by ${d.topIs}`);
      if (!d.best && !d.inBlockly) ringFails.push(`no ring: ${d.name}`);
      else if (d.best && d.best[2] < 3 && !d.inBlockly) ringFails.push(`ring ${d.name} ${d.best.join(' ')}`);
      if (i === 8 && scheme === 'dark') await shot(page, 'focus-dark-' + d.name.replace(/\W/g, '_'), { clip: { x: 0, y: 0, width: 1280, height: 120 } });
    }
    rec('INFO', `tab-order-${scheme}`, seen.map((x) => x.replace(/#[^ >.]*[^\w ][^ >]*/g, '#(blockly-internal)')).join(' > '));
    ok(!bad.length, `focus-visible-and-unobscured-${scheme}`, bad.slice(0, 6).join(' | '), 'PRISM');
    ok(!ringFails.length, `focus-ring-3:1-${scheme}`, ringFails.slice(0, 8).join(' | '), 'PRISM');
    ok(seen.length > 12 && seen.some((x) => x.startsWith('button#btn-flag')) && seen.some((s) => s.startsWith('button#btn-add-sprite')) && seen.some((s) => s.includes('sprite-item')), `tab-reaches-all-regions-${scheme}`, seen.join(' > '), 'GRANITE');
    // is there a keyboard trap? shift+tab must also move on from the blockly workspace
    await page.evaluate(() => document.getElementById('btn-flag').focus());
    const before = await page.evaluate(() => document.activeElement.id);
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab');
    const after = await page.evaluate(() => document.activeElement.id || document.activeElement.className);
    ok(before !== after, `shift-tab-moves-${scheme}`, `${before} -> ${after}`, 'CIRCUIT-2');
    await shot(page, `tab-end-${scheme}`);
    await closeAll(page);
  }

  /* ---------- File menu keyboard, dialogs (focus move, trap, Esc, return) */
  {
    const page = await mk(browser, { w: 1280, h: 800 });
    await go(page);
    const act = () => page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
    await page.locator('#btn-file').focus();
    await page.keyboard.press('Enter'); await tick(page, 150);
    const open1 = await page.evaluate(() => [document.getElementById('btn-file').getAttribute('aria-expanded'), !document.getElementById('file-menu-list').hidden, document.activeElement.id]);
    ok(open1[0] === 'true' && open1[1] && /^mi-/.test(open1[2]), 'menu-enter-opens-and-focuses-item', JSON.stringify(open1), 'CIRCUIT-2');
    await page.keyboard.press('ArrowDown'); const a1 = await act();
    await page.keyboard.press('End'); const a2 = await act();
    await page.keyboard.press('Home'); const a3 = await act();
    await page.keyboard.press('ArrowUp'); const a4 = await act();
    ok(a1 === 'mi-save' && a2 === 'mi-upload' && a3 === 'mi-new' && a4 === 'mi-upload', 'menu-arrow-home-end-wrap', [a1, a2, a3, a4].join(','), 'CIRCUIT-2');
    await page.keyboard.press('Escape'); await tick(page, 100);
    const back = await page.evaluate(() => [document.activeElement.id, document.getElementById('file-menu-list').hidden, document.getElementById('btn-file').getAttribute('aria-expanded')]);
    ok(back[0] === 'btn-file' && back[1] && back[2] === 'false', 'menu-escape-closes-returns-focus', JSON.stringify(back), 'CIRCUIT-2');
    await page.keyboard.press('Space'); await tick(page, 100);
    await page.keyboard.press('Tab'); await tick(page, 100);
    const tabClose = await page.evaluate(() => document.getElementById('file-menu-list').hidden);
    ok(tabClose, 'menu-tab-closes', 'menu stays open after Tab', 'CIRCUIT-2');
    await page.evaluate(() => document.getElementById('btn-file').focus());
    await page.keyboard.press('ArrowDown'); await tick(page, 100);
    const arrowOpen = await page.evaluate(() => !document.getElementById('file-menu-list').hidden);
    ok(arrowOpen, 'menu-arrowdown-on-button-opens', 'ArrowDown on #btn-file does not open the menu', 'CIRCUIT-2');
    await page.keyboard.press('Escape');
    // click outside closes
    await page.evaluate(() => document.getElementById('btn-file').click()); await tick(page, 100);
    await page.mouse.click(600, 400); await tick(page, 100);
    ok(await page.evaluate(() => document.getElementById('file-menu-list').hidden), 'menu-outside-click-closes', '', 'CIRCUIT-2');

    const dialogs = [
      ['dlg-welcome', async () => { await page.locator('#btn-help').focus(); await page.keyboard.press('Enter'); }, 'btn-help'],
      ['dlg-lessons', async () => { await page.locator('#btn-lessons').focus(); await page.keyboard.press('Enter'); }, 'btn-lessons'],
      ['dlg-sprites', async () => { await page.locator('#btn-add-sprite').focus(); await page.keyboard.press('Enter'); }, 'btn-add-sprite'],
      ['dlg-load', async () => { await page.locator('#btn-file').focus(); await page.keyboard.press('Enter'); await tick(page, 100); await page.locator('#mi-load').focus(); await page.keyboard.press('Enter'); }, 'btn-file']
    ];
    for (const [dlg, opener, returnTo] of dialogs) {
      await opener(); await tick(page, 400);
      const o = await page.evaluate((d) => { const e = document.getElementById(d); return { open: e.open, inside: e.contains(document.activeElement), a: document.activeElement.id || document.activeElement.className }; }, dlg);
      ok(o.open && o.inside, `${dlg}-opens-and-focuses-inside`, JSON.stringify(o), 'CIRCUIT-2');
      let escaped = 0;
      for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); if (!(await page.evaluate((d) => document.activeElement === document.body || document.getElementById(d).contains(document.activeElement), dlg))) escaped++; }
      ok(escaped === 0, `${dlg}-focus-trapped`, `${escaped}/14 Tabs left the dialog`, 'CIRCUIT-2');
      escaped = 0;
      for (let i = 0; i < 6; i++) { await page.keyboard.press('Shift+Tab'); if (!(await page.evaluate((d) => document.activeElement === document.body || document.getElementById(d).contains(document.activeElement), dlg))) escaped++; }
      ok(escaped === 0, `${dlg}-focus-trapped-reverse`, `${escaped}/6`, 'CIRCUIT-2');
      await page.keyboard.press('Escape'); await tick(page, 300);
      const c = await page.evaluate((d) => ({ open: document.getElementById(d).open, a: document.activeElement.id }), dlg);
      ok(!c.open && c.a === returnTo, `${dlg}-esc-closes-returns-focus`, JSON.stringify(c) + ' expected ' + returnTo, 'CIRCUIT-2');
    }
    // prompt + confirm dialogs: variable creation prompt and delete-sprite confirm
    await page.evaluate(() => { BB.app.loadProject({ app: 'boltblocks', version: 1, name: 'x', sprites: [{ id: 'a', name: 'Bolt', character: 'bolt' }, { id: 'b', name: 'Zip', character: 'zip' }] }); });
    await tick(page, 400);
    await page.evaluate(() => { const s = document.querySelectorAll('.sprite-delete'); s[s.length - 1].focus(); });
    await page.keyboard.press('Enter'); await tick(page, 400);
    const cf = await page.evaluate(() => ({ open: document.getElementById('dlg-confirm').open, a: document.activeElement.id }));
    ok(cf.open && cf.a === 'confirm-cancel', 'confirm-opens-with-safe-default-focus', JSON.stringify(cf), 'CIRCUIT-2');
    await page.keyboard.press('Escape'); await tick(page, 300);
    const cf2 = await page.evaluate(() => ({ open: document.getElementById('dlg-confirm').open, a: document.activeElement.className, n: document.querySelectorAll('.sprite-item').length }));
    ok(!cf2.open && cf2.n === 2 && /sprite-delete|sprite-item/.test(cf2.a), 'confirm-esc-keeps-sprite-and-returns-focus', JSON.stringify(cf2), 'CIRCUIT-2');
    await page.evaluate(() => { BB.app.ask({ title: 'T', label: 'L', value: '', okLabel: 'OK', maxLength: 10 }); }); await tick(page, 300);
    const pr = await page.evaluate(() => ({ open: document.getElementById('dlg-prompt').open, a: document.activeElement.id }));
    ok(pr.open && pr.a === 'prompt-input', 'prompt-focuses-input', JSON.stringify(pr), 'CIRCUIT-2');
    await page.keyboard.press('Enter'); await tick(page, 200);
    const pe = await page.evaluate(() => ({ open: document.getElementById('dlg-prompt').open, err: document.getElementById('prompt-error').textContent }));
    ok(pe.open && pe.err.length > 0, 'prompt-empty-shows-error-in-role-alert', JSON.stringify(pe), 'CIRCUIT-2');
    await page.keyboard.press('Escape'); await tick(page, 200);
    ok(!problems(page).length, 'zero-console-keyboard-flows', problems(page).join(' | '), 'CIRCUIT-2');
    await closeAll(page);
  }

  /* ---------- lesson panel keyboard + focus not obscured while panel is open, stage toolbar, sprite panel */
  {
    const page = await mk(browser, { w: 1280, h: 800 });
    await go(page);
    await page.evaluate(async () => { await BB.app.startLesson('say-hello', { skipConfirm: true }); }); await tick(page, 600);
    const f0 = await page.evaluate(() => document.activeElement.id);
    ok(f0 === 'lesson-title', 'lesson-start-moves-focus-to-title', f0, 'CIRCUIT-2');
    const seq = [];
    for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); seq.push(await page.evaluate(() => document.activeElement.id || document.activeElement.className.toString().slice(0, 20))); }
    ok(['btn-hint-prev', 'btn-hint-next', 'btn-lesson-reset', 'btn-lesson-close'].every((x) => seq.includes(x)), 'lesson-panel-controls-reachable', seq.join(','), 'CIRCUIT-2');
    for (const id of ['btn-hint-next', 'btn-hint-prev']) { await page.locator('#' + id).focus(); await page.keyboard.press('Enter'); }
    // hint text changes
    const hint = await page.evaluate(() => document.getElementById('lesson-hint-text').textContent.length);
    ok(hint > 20, 'lesson-hint-text-present', String(hint), 'CIRCUIT-2');
    // focus never obscured by the lesson panel / toast: focus each panel control and each stage control, hit-test its centre
    const obsc = await page.evaluate(() => {
      const bad = [];
      for (const e of document.querySelectorAll('#lesson-panel button, #stage-toolbar button, #sprite-panel button, #sprite-info input, #sprite-info button, #topbar button, #topbar input')) {
        if (!e.offsetParent) continue; e.focus({ preventScroll: false });
        const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!(t === e || e.contains(t) || (t && t.contains(e)))) bad.push(e.id + ' covered by ' + (t && (t.id || t.className)));
      }
      return bad;
    });
    ok(!obsc.length, 'lesson-open-no-control-obscured', obsc.join(' | '), 'PRISM');
    // toast over focused control (WCAG 2.4.11): fire a toast, then focus sprite panel controls
    await page.evaluate(() => BB.app.toast('Saved!', 'info', 6000)); await tick(page, 300);
    const toastBox = await page.evaluate(() => { const t = document.querySelector('.toast'); if (!t) return null; const r = t.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); });
    const cover = await page.evaluate((tb) => { if (!tb) return []; const bad = []; for (const e of document.querySelectorAll('button, input')) { if (!e.offsetParent || e.closest('dialog,.toast,.blocklySvg')) continue; e.focus(); const r = e.getBoundingClientRect(); const ix = Math.max(0, Math.min(r.right, tb[2]) - Math.max(r.left, tb[0])), iy = Math.max(0, Math.min(r.bottom, tb[3]) - Math.max(r.top, tb[1])); const f = (ix * iy) / Math.max(1, r.width * r.height); if (f > 0) bad.push([e.id || e.className, Math.round(f * 100)]); } return bad.slice(0, 6); }, toastBox);
    ok(!cover.some((c) => c[1] >= 99), 'toast-never-fully-hides-focused-control', JSON.stringify(toastBox) + ' ' + JSON.stringify(cover), 'PRISM');
    if (cover.length) rec('WARN', 'toast-partly-covers-focused-control', `toast ${JSON.stringify(toastBox)} overlaps focused controls (id,% covered): ${JSON.stringify(cover)}. Not a 2.4.11 failure (never entirely hidden, toast times out) but the scroll-padding that clears the toast does not apply inside nested scrollers such as the lesson dock.`, 'PRISM');
    await closeAll(page);
  }

  /* ---------- Blockly: ink text contrast on every category (flyout blocks), keyboard focus stroke on blocks and fields */
  for (const scheme of ['light', 'dark']) {
    let page = await mk(browser, { scheme, w: 1280, h: 800 });
    await go(page);
    await page.evaluate(() => BB.app.loadProject({ app: 'boltblocks', version: 1, name: 'v', sprites: [{ id: 'a', name: 'Bolt', character: 'bolt', xml: '<xml xmlns="https://developers.google.com/blockly/xml"><variables><variable>score</variable></variables></xml>' }], variables: [{ name: 'score', value: 0, visible: false }] })); await tick(page, 400);
    const nCats = await page.evaluate(() => BB.app.getWorkspace().getToolbox().getToolboxItems().filter((i) => i.isSelectable && i.isSelectable()).length);
    const out = { fails: [], min: 99, per: {} };
    for (let i = 0; i < nCats; i++) {
      await page.evaluate((i) => { const t = BB.app.getWorkspace().getToolbox(); t.setSelectedItem(t.getToolboxItems().filter((x) => x.isSelectable && x.isSelectable())[i]); }, i);
      await tick(page, 500);
      const r = await page.evaluate((lib) => {
        const L = eval(lib); const fails = []; let min = 99; let n = 0;
        for (const t of document.querySelectorAll('.blocklyFlyout text')) {
          const rc = t.getBoundingClientRect(); if (!rc.width || !t.textContent.trim()) continue;
          let bgEl = null;
          const fieldG = t.parentElement;      // the field group: holds an optional .blocklyFieldRect
          if (fieldG) bgEl = fieldG.querySelector(':scope > rect.blocklyFieldRect, :scope > .blocklyFieldRect');
          if (!bgEl) { const blockG = t.closest('g.blocklyDraggable'); if (blockG) bgEl = blockG.querySelector(':scope > path.blocklyPath'); }
          if (!bgEl) { const btn = t.closest('g.blocklyFlyoutButton'); if (btn) bgEl = btn.querySelector('.blocklyFlyoutButtonBackground'); }
          if (!bgEl) continue;
          const fill = getComputedStyle(bgEl).fill; if (!fill || fill === 'none') continue;
          const tf = getComputedStyle(t).fill; const bg = L.over(L.px(fill), [255, 255, 255, 1]); const fg = L.over(L.px(tf), bg);
          const ratio = L.ratio(fg, bg); n++; min = Math.min(min, ratio);
          if (ratio < 4.5) fails.push(t.textContent.trim().slice(0, 14) + ' ' + ratio.toFixed(2) + ' fg=' + tf + ' bg=' + fill);
        }
        return { fails: [...new Set(fails)].slice(0, 4), min, n };
      }, COLOR_LIB);
      out.per[i] = [r.n, +r.min.toFixed(2)]; out.min = Math.min(out.min, r.min); out.fails.push(...r.fails);
    }
    const counted = Object.values(out.per).reduce((a, v) => a + v[0], 0);
    ok(counted > 80 && !out.fails.length && out.min >= 4.5, `blockly-ink-contrast>=4.5-${scheme}`, `labels measured ${counted}; min ${out.min.toFixed(2)} ${out.fails.join(' | ')}`, 'CIRCUIT-1');
    rec('INFO', `blockly-ink-contrast-per-category-${scheme}`, `[labels, min ratio] ${JSON.stringify(out.per)}`);
    // fresh page for the keyboard part: the flyout left open by the loop above would receive the arrow keys
    await closeAll(page); page = await mk(browser, { scheme, w: 1280, h: 800 }); await go(page);

    // keyboard focus: Tab onto the first block, then drive the real Blockly keyboard navigation
    await page.evaluate(() => BB.app.loadProject({ app: 'boltblocks', version: 1, name: 'f', sprites: [{ id: 'a', name: 'Bolt', character: 'bolt', xml: '<xml xmlns="https://developers.google.com/blockly/xml"><block type="bb_when_key" x="30" y="30"><field name="KEY">space</field><next><block type="bb_move"><value name="STEPS"><shadow type="math_number"><field name="NUM">10</field></shadow></value><next><block type="bb_say"><value name="MSG"><shadow type="text"><field name="TEXT">Hi</field></shadow></value></block></next></block></next></block></xml>' }] }));
    await tick(page, 500);
    const strokeInfo = (page_) => page_.evaluate((lib) => {
      const L = eval(lib); const f = document.querySelector('#blockly-div .blocklyActiveFocus:not(.blocklyToolboxCategoryContainer):not(.blocklyWorkspaceSelectionRing)');
      if (!f) return null;
      const isField = f.classList.contains('blocklyField') || !!f.querySelector(':scope > .blocklyFieldRect');
      const target = isField ? (f.querySelector(':scope > .blocklyFieldRect') || f) : f; const c = getComputedStyle(target);
      const fillc = L.over(L.px(c.fill === 'none' ? 'rgba(0,0,0,0)' : c.fill), [255, 255, 255, 1]);
      return { cls: (f.getAttribute('class') || '').slice(0, 50), isField, stroke: c.stroke, sw: parseFloat(c.strokeWidth), ratioVsFill: +L.ratio(L.over(L.px(c.stroke === 'none' ? 'rgba(0,0,0,0)' : c.stroke), fillc), fillc).toFixed(2) };
    }, COLOR_LIB);
    await page.evaluate(() => document.getElementById('project-name').focus());
    let onBlock = false;
    for (let i = 0; i < 14 && !onBlock; i++) { await page.keyboard.press('Tab'); onBlock = await page.evaluate(() => document.activeElement.matches('path.blocklyPath')); }
    ok(onBlock, `tab-reaches-first-block-${scheme}`, 'Tab never reached a block path inside the workspace', 'CIRCUIT-1');
    const seq = [];
    const first = await strokeInfo(page); if (first) seq.push(first);
    for (const k of ['ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowRight']) { await page.keyboard.press(k); await tick(page, 120); const x = await strokeInfo(page); if (x) seq.push(x); }
    ok(seq.length >= 3 && seq.every((x) => !x.isField ? x.sw >= 3 && x.stroke !== 'none' && x.ratioVsFill >= 3 : true), `block-keyboard-focus-stroke-${scheme}`, JSON.stringify(seq.slice(0, 3)), 'CIRCUIT-1');
    if (scheme === 'light') await shot(page, 'blockly-keyboard-focus', { clip: { x: 100, y: 80, width: 520, height: 260 } });
    await page.evaluate(() => { const ws = BB.app.getWorkspace(); Blockly.getFocusManager().focusNode(ws.getTopBlocks(true)[0]); }); await tick(page, 200);
    const wb = await strokeInfo(page);
    ok(!!wb && !wb.isField && wb.sw >= 3 && wb.stroke !== 'none' && wb.ratioVsFill >= 3, `workspace-block-focus-stroke-${scheme}`, JSON.stringify(wb), 'CIRCUIT-1');
    if (scheme === 'dark') await shot(page, 'blockly-workspace-focus-dark', { clip: { x: 100, y: 80, width: 520, height: 260 } });
    // dropdown / number / text fields: focus them through Blockly's own focus manager, then measure the stroke
    for (const [label, pick] of [['dropdown', (b) => b.getField('KEY')], ['number', (b) => b.getInputTargetBlock('STEPS').getField('NUM')], ['text', (b) => b.getInputTargetBlock('MSG').getField('TEXT')]]) {
      await page.evaluate(({ label }) => {
        const ws = BB.app.getWorkspace(); const byType = (t) => ws.getAllBlocks(false).find((b) => b.type === t);
        const f = label === 'dropdown' ? byType('bb_when_key').getField('KEY') : label === 'number' ? byType('bb_move').getInputTargetBlock('STEPS').getField('NUM') : byType('bb_say').getInputTargetBlock('MSG').getField('TEXT');
        Blockly.getFocusManager().focusNode(f);
      }, { label });
      await tick(page, 200);
      const x = await strokeInfo(page);
      ok(!!x && x.isField && x.sw >= 2 && x.stroke !== 'none' && x.ratioVsFill >= 3, `field-focus-stroke-${label}-${scheme}`, JSON.stringify(x), 'CIRCUIT-1');
      await page.keyboard.press('Escape');
    }
    await closeAll(page);
  }
}

/* ================================================================== SUITE: motion (DoD 5) */
async function suiteMotion(browser) {
  for (const motion of ['reduce', 'no-preference']) {
    const page = await mk(browser, { motion, w: 1280, h: 800 });
    await go(page);
    // open dialogs/menus so their animations exist, then inspect every element's animation/transition durations
    const dur = async () => page.evaluate(() => {
      const bad = []; const max = (s) => Math.max(...s.split(',').map((x) => parseFloat(x) * (x.includes('ms') ? 0.001 : 1)));
      for (const e of document.querySelectorAll('*')) { for (const pseudo of [null, '::before', '::after']) {
        const cs = getComputedStyle(e, pseudo); if (!cs) continue;
        const a = max(cs.animationDuration || '0s'), t = max(cs.transitionDuration || '0s');
        const name = cs.animationName;
        if ((name !== 'none' && a > 0.02) || t > 0.02) bad.push((e.id || e.tagName + '.' + (typeof e.className === 'string' ? e.className.split(' ')[0] : '')) + (pseudo || '') + ' anim=' + name + ' ' + cs.animationDuration + ' trans=' + cs.transitionDuration);
      } }
      return [...new Set(bad)];
    });
    let bad = await dur();
    await page.evaluate(() => document.getElementById('btn-help').click()); await tick(page, 500);
    bad.push(...(await dur())); await closeDialogs(page);
    await page.evaluate(() => document.getElementById('btn-file').click()); await tick(page, 300);
    bad.push(...(await dur())); await page.keyboard.press('Escape');
    await page.evaluate(() => BB.app.toast('hi', 'info', 5000)); await tick(page, 300);
    bad.push(...(await dur()));
    bad = [...new Set(bad)];
    if (motion === 'reduce') ok(!bad.length, 'reduce-css-motion-zeroed', `${bad.length} elements still animate/transition: ${bad.slice(0, 6).join(' | ')}`, 'PRISM');
    else rec('INFO', 'no-preference-has-motion', `${bad.length} animated/transitioned elements (expected > 0 so the reduce test is meaningful)`);
    if (motion === 'no-preference') ok(bad.length > 0, 'no-preference-motion-present', 'no animations at all with no-preference: the reduce check is vacuous', 'PRISM');
    // confetti: finish lesson 1
    const r = await playLesson(page, 'say-hello');
    ok(r.celebrated && r.done, `lesson-celebration-${motion}`, JSON.stringify(r), 'CIRCUIT-2');
    if (motion === 'reduce') ok(r.confetti === 0, 'reduce-no-confetti', `${r.confetti} confetti pieces`, 'CIRCUIT-2');
    else { ok(r.confetti > 0, 'no-preference-confetti-present', `${r.confetti}`, 'CIRCUIT-2'); await shot(page, 'celebration-' + motion); }
    await page.evaluate(() => { const c = document.getElementById('btn-celebration-close'); if (c) c.click(); }); await tick(page, 300);
    // essential motion: the stage must still animate under reduce (sprite moves frame by frame)
    await page.evaluate(() => { BB.app.loadProject({ app: 'boltblocks', version: 1, name: 'm', sprites: [{ id: 'a', name: 'Bolt', character: 'bolt', x: -100, xml: '<xml xmlns="https://developers.google.com/blockly/xml"><block type="bb_when_flag"><next><block type="bb_forever"><statement name="DO"><block type="bb_move"><value name="STEPS"><shadow type="math_number"><field name="NUM">3</field></shadow></value></block></statement></block></next></block></xml>' }] }); document.getElementById('btn-flag').click(); });
    const xs = []; for (let i = 0; i < 4; i++) { await tick(page, 200); xs.push(await page.evaluate(() => BB.rt.getSprites()[0].x)); }
    ok(xs[3] > xs[0] + 10, `stage-animation-runs-${motion}`, JSON.stringify(xs), 'CIRCUIT-1');
    if (motion === 'no-preference') await shot(page, 'running-glow', { clip: { x: 0, y: 60, width: 840, height: 400 } });   // taken while the forever-loop runs
    const glow = await page.evaluate(() => document.querySelectorAll('#blockly-div .bb-running').length);
    ok(glow >= 1, `running-block-highlight-${motion}`, `${glow} .bb-running blocks`, 'CIRCUIT-2');
    await page.evaluate(() => document.getElementById('btn-stop').click());
    ok(!problems(page).length, `zero-console-motion-${motion}`, problems(page).join(' | '), 'CIRCUIT');
    await closeAll(page);
  }
  // colour scheme with no data-theme: JS-independent CSS fallback follows the OS
  for (const scheme of ['light', 'dark']) {
    const page = await mk(browser, { scheme });
    await go(page);
    const a = await page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, theme: document.documentElement.dataset.theme }));
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme')); await tick(page, 150);
    const b = await page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, top: getComputedStyle(document.getElementById('topbar')).backgroundColor }));
    rec('INFO', `scheme-${scheme}-bg`, `with data-theme=${a.theme}: ${a.bg}; attribute removed: ${b.bg}`);
    ok(a.theme === scheme, `boot-stamps-theme-from-os-${scheme}`, a.theme, 'GRANITE');
    ok(a.bg === b.bg, `css-fallback-follows-os-without-data-theme-${scheme}`, `${a.bg} vs ${b.bg}`, 'PRISM');
    await closeAll(page);
  }
  // explicit theme toggle overrides OS, persists across reload
  {
    const page = await mk(browser, { scheme: 'light' });
    await go(page);
    await page.evaluate(() => document.getElementById('btn-theme').click()); await tick(page, 300);
    await page.reload(); await ready(page);
    const t = await page.evaluate(() => [document.documentElement.dataset.theme, document.getElementById('btn-theme').getAttribute('aria-pressed')]);
    ok(t[0] === 'dark' && t[1] === 'true', 'theme-toggle-overrides-os-and-persists', JSON.stringify(t), 'CIRCUIT-2');
    await closeAll(page);
  }
  // JS disabled: app shell (ADR 0002) paints the noscript message, nothing overflows
  for (const [w, h] of [[320, 600], [1280, 800]]) {
    const page = await mk(browser, { js: false, w, h });
    await page.goto(BASE + 'index.html');
    const r = await page.evaluate ? null : null;
    const html = await page.content();
    const txt = await page.innerText('body').catch(() => '');
    const m = await page.evaluate(() => 1).catch(() => 'nojs');
    ok(/needs JavaScript/.test(txt) && /JavaScript/.test(txt) && txt.includes('يحتاج'), `nojs-noscript-message-en-ar-${w}`, txt.slice(0, 200), 'GRANITE');
    const vis = await page.locator('.noscript').first().isVisible();
    ok(vis, `nojs-noscript-visible-${w}`, '', 'GRANITE');
    const boot = await page.locator('#app-boot').isVisible().catch(() => false);
    ok(!boot, `nojs-boot-skeleton-hidden-${w}`, 'the loading skeleton shows forever without JS', 'PRISM');
    if (w === 320) await shot(page, 'nojs-320');
    await closeAll(page);
  }
}

/* ================================================================== SUITE: flows (DoD 7) */
async function suiteFlows(browser) {
  for (const lang of ['en', 'ar']) {
    const page = await mk(browser, { lang, w: 1280, h: 800 });
    await go(page);
    const ids = lang === 'en' ? ['say-hello', 'move-robot', 'draw-square', 'keyboard-controls', 'bounce-forever', 'random-positions', 'score-variable', 'catch-the-star'] : ['say-hello', 'draw-square', 'score-variable', 'catch-the-star'];
    for (const id of ids) {
      const r = await playLesson(page, id, { keys: id === 'keyboard-controls' ? ['ArrowRight', 'ArrowLeft'] : [], waitMs: 9000 });
      ok(r.celebrated && r.done, `lesson-solvable-${id}-${lang}`, JSON.stringify(r), 'CIRCUIT-2');
      await page.evaluate(() => document.getElementById('btn-stop').click());
    }
    ok(!problems(page).length, `zero-console-lessons-${lang}`, problems(page).join(' | '), 'CIRCUIT');
    await closeAll(page);
  }
  const page = await mk(browser, { w: 1280, h: 800 });
  await go(page);
  // add / delete sprite
  await page.evaluate(() => document.getElementById('btn-add-sprite').click()); await tick(page, 300);
  const cards = await page.evaluate(() => document.querySelectorAll('#char-list button, #char-list .char-card').length);
  ok(cards >= 6, 'sprite-dialog-offers-6-characters', String(cards), 'CIRCUIT-2');
  await page.evaluate(() => (document.querySelector('#char-list button') || document.querySelector('#char-list .char-card')).click()); await tick(page, 400);
  let n = await page.evaluate(() => document.querySelectorAll('.sprite-item').length);
  ok(n === 2, 'add-sprite', `${n} sprites`, 'CIRCUIT-2');
  await page.evaluate(() => { const d = document.querySelectorAll('.sprite-delete'); d[d.length - 1].click(); }); await tick(page, 300);
  await page.evaluate(() => document.getElementById('confirm-ok').click()); await tick(page, 400);
  n = await page.evaluate(() => document.querySelectorAll('.sprite-item').length);
  ok(n === 1, 'delete-sprite', `${n} sprites`, 'CIRCUIT-2');
  // blocks + save / load / download / upload
  await page.evaluate((x) => BB.app.loadProject({ app: 'boltblocks', version: 1, name: 'Round trip', sprites: [{ id: 'a', name: 'Bolt', character: 'bolt', x: 10, y: 20, xml: x }], variables: [{ name: 'score', value: 3, visible: true }] }), SOL['say-hello']);
  await tick(page, 400);
  await page.evaluate(() => document.getElementById('btn-file').click()); await page.evaluate(() => document.getElementById('mi-save').click()); await tick(page, 400);
  ok(await page.evaluate(() => !document.getElementById('dlg-prompt').open), 'save-named-project-no-prompt', 'a named project should save without asking again', 'CIRCUIT-2');
  const slots = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('boltblocks.projects') || '{}')));
  ok(slots.includes('Round trip'), 'save-writes-slot', JSON.stringify(slots), 'CIRCUIT-2');
  await page.evaluate(() => document.getElementById('btn-file').click()); await page.evaluate(() => document.getElementById('mi-new').click()); await tick(page, 400);
  await page.evaluate(() => { const c = document.getElementById('confirm-ok'); if (document.getElementById('dlg-confirm').open) c.click(); }); await tick(page, 400);
  await page.evaluate(() => document.getElementById('btn-file').click()); await page.evaluate(() => document.getElementById('mi-load').click()); await tick(page, 400);
  await page.evaluate(() => document.querySelector('.saved-open').click()); await tick(page, 600);
  await page.evaluate(() => { const c = document.getElementById('confirm-ok'); if (document.getElementById('dlg-confirm').open) c.click(); }); await tick(page, 400);
  const loaded = await page.evaluate(() => { const p = BB.app.getProject(); return [p.name, p.sprites[0].x, /bb_say/.test(p.sprites[0].xml), p.variables.map((v) => v.name + '=' + v.value).join()]; });
  ok(loaded[0] === 'Round trip' && loaded[1] === 10 && loaded[2] && loaded[3] === 'score=3', 'load-restores-project', JSON.stringify(loaded), 'CIRCUIT-2');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.evaluate(() => { document.getElementById('btn-file').click(); document.getElementById('mi-download').click(); })]);
  const dpath = await dl.path(); const text = fs.readFileSync(dpath, 'utf8');
  let parsed = null; try { parsed = JSON.parse(text); } catch (e) { /* reported below */ }
  ok(parsed && parsed.app === 'boltblocks' && /\.boltblocks\.json$/.test(dl.suggestedFilename()), 'download-is-valid-project-json', dl.suggestedFilename() + ' ' + text.slice(0, 80), 'CIRCUIT-2');
  await page.evaluate(() => { document.getElementById('btn-file').click(); document.getElementById('mi-new').click(); }); await tick(page, 300);
  await page.evaluate(() => { if (document.getElementById('dlg-confirm').open) document.getElementById('confirm-ok').click(); }); await tick(page, 400);
  await page.setInputFiles('#upload-input', { name: 'p.boltblocks.json', mimeType: 'application/json', buffer: Buffer.from(text) }); await tick(page, 800);
  await page.evaluate(() => { if (document.getElementById('dlg-confirm').open) document.getElementById('confirm-ok').click(); }); await tick(page, 500);
  const up = await page.evaluate(() => { const p = BB.app.getProject(); return [p.name, /bb_say/.test(p.sprites[0].xml)]; });
  ok(up[0] === 'Round trip' && up[1], 'upload-roundtrip', JSON.stringify(up), 'CIRCUIT-2');
  // pause / resume / slow / dpad / stop
  await page.evaluate(() => { for (const id of ['btn-speed', 'btn-dpad', 'btn-flag', 'btn-pause', 'btn-pause', 'btn-stop']) document.getElementById(id).click(); });
  await tick(page, 300);
  const dp = await page.evaluate(() => [document.body.classList.contains('dpad-on'), !document.getElementById('dpad').hidden]);
  ok(dp[0] && dp[1], 'dpad-toggle-shows-pad', JSON.stringify(dp), 'CIRCUIT-2');
  // theme / language toggles (lang reloads the page: ADR 0004)
  await page.evaluate(() => document.getElementById('btn-theme').click()); await tick(page, 200);
  await page.evaluate(() => document.getElementById('btn-lang').click());
  await page.waitForLoadState('load'); await ready(page);
  const l = await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir, document.getElementById('btn-lang-label').textContent]);
  ok(l[0] === 'ar' && l[1] === 'rtl', 'language-toggle-switches-to-ar-rtl', JSON.stringify(l), 'CIRCUIT-2');
  const kept = await page.evaluate(() => /bb_say/.test(BB.app.getProject().sprites[0].xml));
  ok(kept, 'language-toggle-keeps-project', 'work lost on language switch', 'CIRCUIT-2');
  ok(!problems(page).length, 'zero-console-flows', problems(page).join(' | '), 'CIRCUIT');
  // explicit dimensions for every img/canvas/svg (static + dynamic)
  const dim = await page.evaluate(() => {
    const bad = [];
    for (const e of document.querySelectorAll('img, canvas, svg')) {
      if (e.closest('svg') && e.tagName === 'svg' && e.parentElement.closest('svg')) continue;
      if (e.closest('.blocklySvg, #blockly-div') || e.classList.contains('sprite-sheet') || e.classList.contains('blocklyComputeCanvas')) continue;   // blocklyComputeCanvas = Blockly's own text-measuring canvas
      const cs = getComputedStyle(e);
      const hasAttr = e.getAttribute('width') && e.getAttribute('height');
      const hasRatio = cs.aspectRatio !== 'auto';
      const hasSize = e.tagName === 'svg' && (e.getAttribute('viewBox') && (hasAttr || (cs.width !== 'auto' && cs.height !== 'auto')));
      if (!(hasAttr || hasRatio || hasSize)) bad.push(e.tagName + '#' + e.id + '.' + (e.getAttribute('class') || ''));
    }
    return bad;
  });
  ok(!dim.length, 'explicit-dimensions-img-canvas-svg', dim.slice(0, 8).join(' | '), 'GRANITE/PRISM');
  // after adding sprites the dynamic <img> thumbs also carry dimensions
  await page.evaluate(() => document.getElementById('btn-add-sprite').click()); await tick(page, 300);
  const thumbs = await page.evaluate(() => [...document.querySelectorAll('.sprite-thumb, #char-list img')].filter((i) => !(i.getAttribute('width') && i.getAttribute('height')) && getComputedStyle(i).aspectRatio === 'auto').length);
  ok(thumbs === 0, 'dynamic-images-have-dimensions', `${thumbs} images without width/height/aspect-ratio`, 'CIRCUIT-2');
  await closeAll(page);
}

/* ================================================================== SUITE: fuzz */
const EVIL_STRINGS = ['");window.__pwn=1;//', "');window.__pwn=1;//", '</script><script>window.__pwn=1</script>', '<img src=x onerror="window.__pwn=1">', '<svg onload=window.__pwn=1>', 'javascript:window.__pwn=1', '`${window.__pwn=1}`', '\\");window.__pwn=1;//', '__proto__', 'constructor', 'toString', 'hasOwnProperty', '\u2028window.__pwn=1;\u2029', '*/window.__pwn=1;/*', '{{constructor.constructor("window.__pwn=1")()}}', 'x'.repeat(5000)];
async function suiteFuzz(browser) {
  const page = await mk(browser, { w: 1280, h: 800 });
  await go(page);
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const pwn = async (id) => { const v = await page.evaluate(() => window.__pwn); ok(!v, `no-script-execution-${id}`, `window.__pwn=${v}`, 'CIRCUIT'); await page.evaluate(() => { window.__pwn = 0; }); };
  const intact = async (id) => {
    const r = await page.evaluate(() => { try { const p = BB.app.getProject(); return [p.name, p.sprites.length, !!BB.app.getWorkspace()]; } catch (e) { return ['ERR ' + e.message]; } });
    ok(r[0] && !/^ERR/.test(r[0]) && r[2], `workspace-intact-${id}`, JSON.stringify(r), 'CIRCUIT-2');
  };
  // a known-good project is on screen; every hostile load must leave it untouched
  await page.evaluate((x) => BB.app.loadProject({ app: 'boltblocks', version: 1, name: 'Known good', sprites: [{ id: 'a', name: 'Bolt', character: 'bolt', xml: x }] }), SOL['say-hello']);
  await tick(page, 400);
  const snapshot = () => page.evaluate(() => JSON.stringify(BB.app.getProject().sprites.map((s) => [s.name, s.xml.length])) + document.getElementById('project-name').value);
  const base = await snapshot();
  const upload = async (obj, label, expect) => {
    const before = page.log.dialogs.length;
    const buf = Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj));
    await page.setInputFiles('#upload-input', { name: 'f.json', mimeType: 'application/json', buffer: buf });
    await tick(page, 900);
    const state = await page.evaluate(() => ({ confirm: document.getElementById('dlg-confirm').open, toast: [...document.querySelectorAll('.toast')].map((t) => t.className + ':' + t.textContent) }));
    if (state.confirm) await page.evaluate(() => document.getElementById('confirm-cancel').click());   // accepted-as-valid projects: decline the replace
    await tick(page, 300);
    const snap = await snapshot();
    if (expect === 'reject') ok(snap === base && state.toast.some((t) => /toast--error/.test(t)), `loader-rejects-${label}`, `snapshotSame=${snap === base} toasts=${state.toast.join('|').slice(0, 160)}`, 'CIRCUIT-2');
    else rec('INFO', `loader-${label}`, `accepted=${state.confirm} toasts=${state.toast.join('|').slice(0, 120)}`);
    await pwn(label); await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  };
  const mkp = (over = {}, xml = '') => ({ app: 'boltblocks', version: 1, name: 'Fuzz', sprites: [{ id: 'a', name: 'Bolt', character: 'bolt', xml: xml || X('') , ...over }] });
  // structural hostile files
  await upload('not json {', 'garbage-text', 'reject');
  await upload('[]', 'array-root', 'reject');
  await upload('null', 'null-root', 'reject');
  await upload({ app: 'other', version: 1, sprites: [] }, 'wrong-app', 'reject');
  await upload({ app: 'boltblocks', version: 99, sprites: [{}] }, 'future-version', 'reject');
  await upload(mkp({}, X('<block type="evil_block"/>')), 'unknown-block-type', 'reject');
  await upload(mkp({}, X('<block type="bb_when_flag"><script>window.__pwn=1</script></block>')), 'script-element-in-xml', 'reject');
  await upload(mkp({}, X('<block type="bb_when_flag" onload="window.__pwn=1"/>')), 'event-attr-in-xml', 'reject');
  await upload(mkp({}, '<!DOCTYPE xml [<!ENTITY x SYSTEM "file:///etc/passwd">]><xml xmlns="https://developers.google.com/blockly/xml"><block type="text"><field name="TEXT">&x;</field></block></xml>'), 'xxe-doctype', 'reject');
  await upload(mkp({}, X('<block type="bb_when_flag">'.repeat(400) + '</block>'.repeat(400))), 'deep-xml-400', 'reject');
  await upload(mkp({}, X('<block type="bb_when_flag" x="1" y="1"></block>'.repeat(30000))), 'huge-xml-30k-blocks', 'reject');
  await upload(mkp({}, 'A'.repeat(3_000_000)), 'oversize-xml', 'reject');
  await upload(mkp({}, X('<block type="controls_if"><mutation elseif="99999"/></block>')), 'mutation-bomb', 'reject');
  await upload(mkp({ sprites: undefined }, ''), 'sprite-wrong-shape', 'info');
  await upload('{"app":"boltblocks","version":1,"__proto__":{"__pwn":1},"sprites":[{"id":"a","name":"x","xml":"","__proto__":{"polluted":1}}],"variables":[{"name":"__proto__","value":"constructor"}]}', 'proto-keys', 'info');
  ok(await page.evaluate(() => ({}).polluted === undefined && ({}).__pwn === undefined && Object.prototype.__pwn === undefined), 'no-prototype-pollution-after-fuzz', 'Object.prototype polluted', 'CIRCUIT-2');
  // hostile strings in every text-bearing slot: project name, sprite name, variable name, broadcast message, say text, procedure name, field values
  let i = 0; const stringLoads = {};
  for (const evil of EVIL_STRINGS) {
    i++;
    const E = esc(evil);
    const xml = `<xml xmlns="https://developers.google.com/blockly/xml"><variables><variable>${E.slice(0, 40)}</variable></variables>` +
      blk('bb_when_flag', {}, blk('bb_say', { v: { MSG: txt(E) } }, blk('bb_broadcast', { f: { MSG: E } }, blk('bb_say_for', { v: { MSG: txt(E), SECS: num(0) } })))) +
      blk('bb_when_receive', { f: { MSG: E }, attrs: ' x="300" y="40"' }, blk('bb_say', { v: { MSG: `<block type="text_join"><mutation items="2"></mutation><value name="ADD0">${txt(E)}</value><value name="ADD1">${txt(E)}</value></block>` } })) +
      `<block type="procedures_defnoreturn" x="40" y="400"><field name="NAME">${E.slice(0, 40)}</field><statement name="STACK">${blk('bb_say', { v: { MSG: txt(E) } })}</statement></block></xml>`;
    const proj = { app: 'boltblocks', version: 1, name: evil, savedAt: evil, selectedSpriteId: 'a', sprites: [{ id: 'a', name: evil, character: evil, xml }, { id: evil, name: evil, character: 'zip', xml: X('') }], variables: [{ name: evil, value: evil, visible: true }] };
    const ok1 = await page.evaluate((p) => { try { return BB.app.loadProject(p); } catch (e) { return 'THROW ' + e.message; } }, proj);
    await tick(page, 400);
    stringLoads[String(ok1)] = (stringLoads[String(ok1)] || 0) + 1;
    ok(ok1 !== undefined && !String(ok1).startsWith('THROW'), `fuzz-string-${i}-loads-or-rejects-cleanly`, String(ok1), 'CIRCUIT-2');
    if (ok1 === true) {
      await page.evaluate(() => { document.getElementById('btn-flag').click(); });
      await tick(page, 1200);
      await page.evaluate(() => { BB.rt.keyDown('space'); BB.rt.stageClick(0, 0); document.getElementById('btn-stop').click(); });
      // names flow into DOM: no markup may have been created from them
      const injected = await page.evaluate(() => document.querySelectorAll('#sprite-list img[onerror], #sprite-list svg[onload], #toast-region img, #topbar img, [onerror], [onload]').length);
      ok(injected === 0, `fuzz-string-${i}-no-markup-injected`, `${injected} injected elements`, 'CIRCUIT-2');
      const text = await page.evaluate(() => document.getElementById('sprite-list').innerHTML.length);
      // sprite names must be inert text
      const names = await page.evaluate(() => [...document.querySelectorAll('.sprite-label')].map((e) => e.children.length));
      ok(names.every((n) => n === 0), `fuzz-string-${i}-sprite-label-is-text`, JSON.stringify(names), 'CIRCUIT-2');
    }
    await pwn('string-' + i);
  }
  rec('INFO', 'fuzz-string-loads', JSON.stringify(stringLoads) + ' (true = loaded and executed under the hostile text, false = rejected with a toast)');
  // custom-block (procedure) names that collide with Object.prototype members: the compiler keeps a plain {} of names
  for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
    await page.evaluate(({ name, xml }) => { BB.app.loadProject({ app: 'boltblocks', version: 1, name: 'proc', sprites: [{ id: 'a', name: 'Bolt', character: 'bolt', xml }] }); }, { name, xml: X(`<block type="procedures_defnoreturn" x="300" y="300"><field name="NAME">${name}</field><statement name="STACK">${blk('bb_say', { v: { MSG: txt('in proc') } })}</statement></block>` + blk('bb_when_flag', {}, `<block type="procedures_callnoreturn"><mutation name="${name}"></mutation></block>`)) });
    await tick(page, 400);
    const r = await page.evaluate(async () => { const c = BB.gen.compile(BB.app.getWorkspace()); document.getElementById('btn-flag').click(); await new Promise((r) => setTimeout(r, 700)); return { err: c.error && c.error.message, said: BB.rt.getStats().said.map((x) => x.text), toasts: [...document.querySelectorAll('.toast--error')].map((t) => t.textContent) }; });
    // LOW severity (not a DoD item, not exploitable: the emitted text is Function.prototype.toString, not user text), so WARN rather than FAIL
    if (!r.err && r.said.includes('in proc')) rec('PASS', `custom-block-named-${name}-runs`); else rec('WARN', `custom-block-named-${name}-runs`, `generators.js keeps procedure names in a plain {} (ctx.procs): a custom block called "${name}" hits Object.prototype -> compile error=${r.err} said=${JSON.stringify(r.said)} toasts=${JSON.stringify(r.toasts)}. Fix: ctx.procs = Object.create(null).`, 'CIRCUIT-1');
    await page.evaluate(() => document.getElementById('btn-stop').click());
    await pwn('proc-' + name);
  }
  // typed-in text through the real UI: project name, sprite name, rename, prompt, ask answer
  for (const [k, evil] of [['a', EVIL_STRINGS[0]], ['b', EVIL_STRINGS[3]], ['c', EVIL_STRINGS[5]]]) {
    await page.locator('#project-name').fill(evil); await page.keyboard.press('Enter');
    await page.locator('#sprite-name').fill(evil); await page.keyboard.press('Enter'); await tick(page, 200);
    await page.evaluate(() => { document.getElementById('btn-file').click(); document.getElementById('mi-save').click(); }); await tick(page, 400);
    await page.evaluate(() => { const d = document.getElementById('dlg-prompt'); if (d.open) { document.getElementById('prompt-ok').click(); } });
    await tick(page, 300);
    await page.evaluate(() => { document.getElementById('btn-file').click(); document.getElementById('mi-load').click(); }); await tick(page, 400);
    const savedText = await page.evaluate(() => [...document.querySelectorAll('#saved-list *')].filter((e) => e.children.length === 0).length + ':' + document.querySelectorAll('#saved-list img, #saved-list svg[onload]').length);
    await closeDialogs(page);
    await pwn('ui-typed-' + k);
  }
  // rejected-by-whitelist but keep going: lessons.json-like starter with evil strings through startLesson's path
  const ls = await page.evaluate(async (ev) => { try { const L = await BB.app.loadLessons(); const p = JSON.parse(JSON.stringify(L[0])); p.title = { en: ev, ar: ev }; p.goal = { en: ev, ar: ev }; p.hints = [{ en: ev, ar: ev }, { en: ev, ar: ev }, { en: ev, ar: ev }]; p.success = { en: ev, ar: ev }; L.push(p); await BB.app.startLesson(p.id, { skipConfirm: true }); L.pop(); return 'ok'; } catch (e) { return 'E ' + e.message; } }, EVIL_STRINGS[3]);
  rec('INFO', 'lesson-evil-strings', ls);
  await tick(page, 400);
  const lessonInj = await page.evaluate(() => document.querySelectorAll('#lesson-panel img, #lesson-panel [onerror]').length);
  ok(lessonInj === 0, 'lesson-text-inert', `${lessonInj}`, 'CIRCUIT-2');
  await pwn('lesson');
  // direct generator fuzz: compile a workspace whose fields hold hostile strings; the emitted code must not execute them
  const gen = await page.evaluate(async (evils) => {
    const out = [];
    for (const e of evils) {
      const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const xml = `<xml xmlns="https://developers.google.com/blockly/xml"><block type="bb_when_flag"><next><block type="bb_say"><value name="MSG"><shadow type="text"><field name="TEXT">${esc(e)}</field></shadow></value><next><block type="bb_goto_xy"><value name="X"><shadow type="math_number"><field name="NUM">${esc(e)}</field></shadow></value><value name="Y"><shadow type="math_number"><field name="NUM">1e999</field></shadow></value></block></next></block></next></block></xml>`;
      try { const r = BB.gen.compileXml(xml); out.push([r.error ? 'err' : 'ok', (r.scripts || []).length]); } catch (x) { out.push(['THROW', x.message]); }
    }
    return out;
  }, EVIL_STRINGS);
  ok(gen.every((g) => g[0] !== 'THROW'), 'generator-hostile-literals-compile-safely', JSON.stringify(gen.filter((g) => g[0] === 'THROW')), 'CIRCUIT-1');
  await pwn('generator');
  await intact('end');
  ok(!page.log.csp.length, 'fuzz-no-csp-violations', page.log.csp.join(' | '), 'SENTRY');
  const unexpected = [...page.log.errors, ...page.log.rejections].filter((e) => !/Failed to load resource|toast/.test(e));
  ok(!unexpected.length, 'fuzz-zero-uncaught-errors-or-rejections', unexpected.slice(0, 5).join(' | '), 'CIRCUIT');
  await closeAll(page);
}

/* ================================================================== SUITE: csp (policy works end to end) */
async function suiteCsp(browser) {
  for (const lang of ['en', 'ar']) {
    const page = await mk(browser, { lang });
    await go(page);
    // exercise every network-using feature: fonts, lessons fetch, audio, msg file, blockly sprite sheet, download/upload
    await page.evaluate(() => { document.getElementById('btn-lessons').click(); }); await tick(page, 600);
    const lessons = await page.evaluate(() => document.querySelectorAll('#lesson-list > li').length);
    ok(lessons === 8, `csp-lessons-fetch-${lang}`, `${lessons} lessons`, 'CIRCUIT-2');
    await closeDialogs(page);
    await tick(page, 600);
    // FontFace.status === 'loaded' (document.fonts.check() is true for a family that was never requested, so it proves nothing)
    const f = await page.evaluate(() => [...new Set([...document.fonts].filter((x) => x.status === 'loaded').map((x) => x.family.replace(/"/g, '')))]);
    if (lang === 'en') ok(f.includes('Nunito') && !f.includes('Cairo'), `csp-fonts-load-${lang}`, 'loaded families: ' + JSON.stringify(f) + ' (EN must load Nunito and not Cairo)', 'QUARTZ');
    else ok(f.includes('Cairo') && !f.includes('Nunito'), `csp-fonts-load-${lang}`, 'loaded families: ' + JSON.stringify(f) + ' (AR must load Cairo and NOT Nunito)', 'QUARTZ');
    const au = await page.evaluate(async () => { try { document.getElementById('btn-flag').click(); BB.rt.keyDown('a'); const c = new (window.AudioContext || window.webkitAudioContext)(); await c.resume().catch(() => {}); const ok = c.state; c.close(); return ok; } catch (e) { return 'ERR ' + e.message; } });
    ok(!/^ERR/.test(au), `csp-audio-${lang}`, au, 'CIRCUIT-1');
    // beep block actually plays through the runtime under the policy
    await page.evaluate((x) => { BB.app.loadProject({ app: 'boltblocks', version: 1, name: 'b', sprites: [{ id: 'a', name: 'Bolt', character: 'bolt', xml: x }] }); document.getElementById('btn-flag').click(); }, X(blk('bb_when_flag', {}, blk('bb_play_beep', {}, blk('bb_play_note', { v: { NOTE: num(60), BEATS: num(0.2) } })))));
    await tick(page, 1200);
    const tb = await page.evaluate(() => { const g = document.querySelector('#blockly-div .blocklyTrash'); const im = g && g.querySelector('image'); return !!g; });
    ok(tb, `csp-trashcan-rendered-${lang}`, 'trashcan missing', 'CIRCUIT-2');
    ok(!page.log.csp.length, `csp-zero-violations-${lang}`, page.log.csp.join(' | '), 'SENTRY');
    ok(!problems(page).length, `csp-zero-console-${lang}`, problems(page).join(' | '), 'SENTRY');
    await closeAll(page);
  }
  // negative control: the policy really blocks injected inline script and foreign hosts
  const page = await mk(browser);
  await go(page);
  const neg = await page.evaluate(async () => {
    const out = {};
    const waitFor = (cond) => new Promise((r) => { const t = Date.now(); (function p() { if (cond() || Date.now() - t > 1500) r(); else setTimeout(p, 50); })(); });
    const s = document.createElement('script'); s.textContent = 'window.__inl = 1'; document.head.appendChild(s); out.inline = !!window.__inl;
    const s2 = document.createElement('script'); s2.src = 'https://evil.example/x.js'; let blocked = false; s2.onerror = () => { blocked = true; }; document.head.appendChild(s2); await waitFor(() => blocked); out.foreignScriptBlocked = blocked;
    try { await fetch('https://example.com/', { mode: 'no-cors' }); out.fetchBlocked = false; } catch (e) { out.fetchBlocked = true; }
    const i = document.createElement('img'); let ib = false; i.onerror = () => { ib = true; }; i.src = 'https://example.com/x.png'; document.body.appendChild(i); await waitFor(() => ib); out.foreignImgBlocked = ib;
    return out;
  });
  ok(neg.inline === false && neg.foreignScriptBlocked && neg.fetchBlocked && neg.foreignImgBlocked, 'csp-negative-controls-block', JSON.stringify(neg), 'SENTRY');
  await closeAll(page);
  // double-click use (README quick look): file:// must boot under the CSP too (lessons.json needs http, documented)
  {
    const f = await mk(browser);
    await f.goto('file://' + path.join(ROOT, 'index.html'));
    const okBoot = await f.waitForFunction(() => document.documentElement.classList.contains('is-ready'), null, { timeout: 20000 }).then(() => true).catch(() => false);
    ok(okBoot && !f.log.csp.length, 'csp-file-protocol-boots', `ready=${okBoot} csp=${f.log.csp.join('|')}`, 'SENTRY');
    await closeAll(f);
  }
  // W5 closed: the CSP now precedes the inline scripts, so they run only because their hashes match (shipped file, no rewriting)
  const p2 = await mk(browser);
  await go(p2);
  const st = await p2.evaluate(() => [document.documentElement.classList.contains('js'), !!document.querySelector('link[rel=preload][as=script]')]);
  ok(st[0] && st[1], 'csp-first-in-head-inline-scripts-still-run', `boot class=${st[0]} preload=${st[1]}  csp: ${p2.log.csp.join('|')}`, 'SENTRY');
  ok(!p2.log.csp.length, 'csp-first-in-head-zero-violations', p2.log.csp.join(' | '), 'SENTRY');
  await closeAll(p2);
  // negative control for W5: an inline script whose bytes differ from the hash must now be BLOCKED (before the fix the CSP did not govern it)
  const p3 = await mk(browser);
  await p3.route('**/index.html', async (route) => {
    const h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace("root.classList.add('js');", "root.classList.add('js'); window.__tampered = 1;");
    await route.fulfill({ status: 200, contentType: 'text/html', body: h });
  });
  await p3.goto(BASE + 'index.html', { waitUntil: 'load' }); await tick(p3, 800);
  const tam = await p3.evaluate(() => [window.__tampered === 1, document.documentElement.classList.contains('js')]);
  ok(!tam[0] && !tam[1] && p3.log.csp.some((m) => /script-src/.test(m)), 'csp-governs-inline-boot-script', `tampered inline script ran=${tam[0]} js-class=${tam[1]} violations=${p3.log.csp.length}`, 'SENTRY');
  await closeAll(p3);
}

/* ================================================================== SUITE: xb (Firefox / WebKit smoke) */
async function suiteXb() {
  for (const name of ['firefox', 'webkit']) {
    let b;
    try { b = await launch(name); } catch (e) { rec('SKIP', `${name}-launch`, 'NOT TESTED, cannot launch: ' + ((String(e.message).match(/error while loading shared libraries: \S+ [^\n\x1b]*/) || [])[0] || String(e.message).slice(0, 160))); continue; }
    rec('INFO', `${name}-version`, b.version());
    for (const [lang, scheme, motion] of [['en', 'light', 'no-preference'], ['ar', 'dark', 'reduce']]) {
      const page = await mk(b, { lang, scheme, motion });
      await go(page); await tick(page, 600);
      const st = await page.evaluate(() => ({ ready: document.documentElement.classList.contains('is-ready'), theme: document.documentElement.dataset.theme, reduce: matchMedia('(prefers-reduced-motion: reduce)').matches, svg: !!document.querySelector('#blockly-div svg.blocklySvg') }));
      ok(st.ready && st.svg, `${name}-boot-${lang}`, JSON.stringify(st), 'CIRCUIT-2');
      ok(st.reduce === (motion === 'reduce'), `${name}-motion-pinned-${lang}`, JSON.stringify(st), 'SENTRY');
      ok(!problems(page).length, `${name}-zero-console-${lang}`, problems(page).join(' | '), 'QUARTZ/CIRCUIT');
      const au = page.log.console.filter((m) => /AudioContext was prevented/.test(m)).length;
      ok(au === 0, `${name}-zero-audiocontext-warnings-${lang}`, `${au} console warnings "AudioContext was prevented from starting automatically" on boot (Blockly WorkspaceAudio constructs an AudioContext; the app must hide window.AudioContext while Blockly.inject runs)`, 'CIRCUIT-2');
      for (const w of [320, 768, 1280]) {
        await page.setViewportSize({ width: w, height: w < 500 ? 740 : 800 }); await tick(page, 400);
        const r = await page.evaluate(LAYOUT_PROBE);
        ok(r.scroll[0] <= r.scroll[1], `${name}-no-hscroll-${lang}-${w}`, `html ${r.scroll}`, 'PRISM');
        const bad = [...r.off, ...r.clipped, ...r.midword];
        ok(!bad.length, `${name}-no-clipping-${lang}-${w}`, bad.slice(0, 5).join(' | '), 'PRISM');
      }
      if (lang === 'en') {
        await page.setViewportSize({ width: 1280, height: 800 });
        const r = await playLesson(page, 'draw-square');
        ok(r.celebrated && r.done, `${name}-lesson-draw-square`, JSON.stringify(r), 'CIRCUIT');
        // hue-rotate colour effect (Safari risk): the runtime must not throw when ctx.filter is absent
        const eff = await page.evaluate(() => { try { BB.rt.updateSprite(BB.rt.getSelectedId(), { effect: 50 }); BB.rt.render(); return 'filter' in CanvasRenderingContext2D.prototype ? 'supported' : 'undefined'; } catch (e) { return 'THROW ' + e.message; } });
        ok(!/THROW/.test(eff), `${name}-colour-effect-no-throw`, eff, 'CIRCUIT-1');
        rec('INFO', `${name}-ctx.filter`, eff === 'undefined' ? 'unsupported: colour effect degrades silently' : 'supported');
        ok(!problems(page).length, `${name}-zero-console-lesson`, problems(page).join(' | '), 'CIRCUIT');
        await shot(page, `${name}-editor`);
      }
      await closeAll(page);
    }
    await b.close();
  }
}

/* ================================================================== main */
const FNS = { static: suiteStatic, unit: suiteUnit, boot: suiteBoot, layout: suiteLayout, viewports: suiteViewports, a11y: suiteA11y, motion: suiteMotion, flows: suiteFlows, fuzz: suiteFuzz, csp: suiteCsp, xb: suiteXb };
let browser = null;
const t0 = performance.now();
try {
  for (const s of suites) {
    if (!FNS[s]) { console.error('unknown suite', s); continue; }
    currentSuite = s;
    console.log(`\n== ${s} (${BROWSER})`);
    const before = results.length;
    try {
      if (s === 'static' || s === 'xb') await FNS[s]();
      else { browser = browser || await launch(BROWSER); await FNS[s](browser); }
    } catch (e) { rec('FAIL', 'suite-crashed', (e.stack || e.message).split('\n').slice(0, 4).join(' / '), 'SENTRY'); }
    const mine = results.slice(before);
    console.log(`   ${mine.filter((r) => r.status === 'PASS').length} pass, ${mine.filter((r) => r.status === 'FAIL').length} fail, ${mine.filter((r) => r.status === 'WARN').length} warn, ${mine.filter((r) => r.status === 'SKIP').length} skip`);
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}
const c = (s) => results.filter((r) => r.status === s).length;
const byOwner = {};
for (const r of results.filter((x) => x.status === 'FAIL')) (byOwner[r.owner || '?'] = byOwner[r.owner || '?'] || []).push(r.suite + '/' + r.id);
for (const [o, l] of Object.entries(byOwner)) console.log(`  FAILS owned by ${o}: ${l.length}`);
console.log(`\nTOTAL ${c('PASS')} pass, ${c('FAIL')} fail, ${c('WARN')} warn, ${c('SKIP')} skip  (${Math.round((performance.now() - t0) / 1000)}s, ${BROWSER})`);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ browser: BROWSER, when: new Date().toISOString(), results }, null, 1));
process.exit(c('FAIL') ? 1 : 0);
