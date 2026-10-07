// Usage (env: SHORT=1 boot only, WARM=1 reload once, RAW=file dump, PLAYWRIGHT_CORE, CHROMIUM, BASE): node measure.js <variant> <profile:mobile|tablet> <visit:first|return> <runs> [full]
// Lab estimate only: Chromium 150 on a desktop CPU, CDP CPU 4x + Slow-4G-like network. Not field data.
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const [variant = 'base', profile = 'mobile', visit = 'first', runs = '3', full = ''] = process.argv.slice(2);
const BASE = process.env.BASE || 'http://127.0.0.1:18431/';
const PROFILES = {
  mobile: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true,
            userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36' },
  tablet: { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, isMobile: false, hasTouch: true },
  t768: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: false, hasTouch: true }
};
const INIT = () => {
  const q = window.__q = { paint: [], lcp: [], cls: [], lt: [], ev: [], loaf: [], ready: null, dcl: null };
  const ob = (type, cb, extra) => { try { new PerformanceObserver(l => l.getEntries().forEach(cb)).observe(Object.assign({ type, buffered: true }, extra || {})); } catch (e) {} };
  ob('paint', e => q.paint.push([e.name, e.startTime]));
  ob('largest-contentful-paint', e => q.lcp.push({ t: e.startTime, size: e.size, tag: e.element && e.element.tagName, id: e.element && (e.element.id || (e.element.getAttribute && e.element.getAttribute('class')) || ''), url: e.url, text: e.element && (e.element.textContent || '').slice(0, 30) }));
  ob('layout-shift', e => { if (!e.hadRecentInput) q.cls.push({ t: e.startTime, v: e.value, src: (e.sources || []).map(s => (s.node && (s.node.id || s.node.className || s.node.nodeName)) + '') }); });
  ob('longtask', e => q.lt.push([e.startTime, e.duration]));
  ob('long-animation-frame', e => q.loaf.push([e.startTime, e.duration, e.blockingDuration]));
  ob('event', e => q.ev.push({ n: e.name, id: e.interactionId, s: e.startTime, d: e.duration, ps: e.processingStart, pe: e.processingEnd, tgt: e.target && (e.target.id || (e.target.getAttribute && e.target.getAttribute('class')) || e.target.nodeName) }), { durationThreshold: 16 });
  document.addEventListener('DOMContentLoaded', () => { q.dcl = performance.now(); });
  const mo = new MutationObserver(() => { if (q.ready == null && document.documentElement.classList.contains('is-ready')) { q.ready = performance.now(); mo.disconnect(); } });
  mo.observe(document, { attributes: true, subtree: true, attributeFilter: ['class'] });
  // rAF frame deltas, switched on by the test
  q.frames = []; q.sampling = false; let last = 0;
  (function tick(ts) { if (q.sampling) { if (last) q.frames.push(ts - last); last = ts; } else last = 0; requestAnimationFrame(tick); })(0);
};
const XML = (n, pen) => `<xml xmlns="https://developers.google.com/blockly/xml"><block type="bb_when_flag" x="20" y="20"><next>${pen ? '<block type="bb_pen_down"><next>' : ''}<block type="bb_forever"><statement name="DO"><block type="bb_move"><value name="STEPS"><shadow type="math_number"><field name="NUM">${4 + n}</field></shadow></value><next><block type="bb_turn_right"><value name="DEG"><shadow type="math_number"><field name="NUM">${3 + n}</field></shadow></value><next><block type="bb_bounce_edge"></block></next></block></next></block></statement></block>${pen ? '</next></block>' : ''}</next></block></xml>`;
const PROJECT = { app: 'boltblocks', version: 1, name: 'perf', selectedSpriteId: 'sprite1', variables: [], sprites: [
  { id: 'sprite1', name: 'Bolt', character: 'bolt', costume: 0, x: -100, y: 40, direction: 70, size: 100, visible: true, effect: 0, xml: XML(0, true) },
  { id: 'sprite2', name: 'Zip', character: 'zip', costume: 0, x: 60, y: 0, direction: 20, size: 100, visible: true, effect: 0, xml: XML(1, false) },
  { id: 'sprite3', name: 'Mimi', character: 'mimi', costume: 0, x: 0, y: -80, direction: 200, size: 100, visible: true, effect: 0, xml: XML(2, false) } ] };
const med = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const r1 = x => x == null ? null : Math.round(x * 10) / 10;

async function one() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext(PROFILES[profile]);
  await ctx.addInitScript(INIT);
  if (process.env.LANGUAGE) await ctx.addInitScript(l => { try { localStorage.setItem('boltblocks.lang', l); } catch (e) {} }, process.env.LANGUAGE);
  if (visit === 'return') await ctx.addInitScript(() => { try { localStorage.setItem('boltblocks.welcomeSeen', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = []; page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); }); page.on('pageerror', e => errors.push('pageerror ' + e.message.slice(0, 160)));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }, { name: 'prefers-color-scheme', value: 'light' }] });
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Performance.enable');
  const wire = {}; cdp.on('Network.loadingFinished', e => { wire[e.requestId] = e.encodedDataLength; });
  const conn = {}; cdp.on('Network.responseReceived', e => { if (/jsdelivr|gstatic|googleapis/.test(e.response.url)) conn[e.response.url.slice(8, 30)] = (conn[e.response.url.slice(8, 30)] || new Set()).add(e.response.connectionId); });
  const reqs = {}; cdp.on('Network.requestWillBeSent', e => { reqs[e.requestId] = e.request.url; });
  const t0 = Date.now();
  await page.goto(BASE + (variant === 'base' ? '' : '?v=' + variant), { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__q && window.__q.ready != null || (window.BB && BB.app && BB.app.bootError), null, { timeout: 60000 });
  if (process.env.WARM) { await page.reload({ waitUntil: 'commit' }); await page.waitForFunction(() => window.__q && window.__q.ready != null, null, { timeout: 60000 }); }
  const bootError = await page.evaluate(() => (window.BB && BB.app && BB.app.bootError) ? String(BB.app.bootError.message) : null);
  await page.waitForTimeout(1500);
  const out = { variant, profile, visit, bootError, errors: errors.slice() };
  const snap = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__q, (k, v) => k === 'frames' ? undefined : v)));
  const boot = await snap();
  const res = await page.evaluate(() => performance.getEntriesByType('resource').map(e => [e.name.replace(location.origin, ''), Math.round(e.startTime), Math.round(e.responseEnd), e.encodedBodySize, e.initiatorType]));
  const xfer = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => /msg\/|gstatic/.test(e.name)).map(e => [e.name.split('/').slice(-2).join('/').slice(-28), e.transferSize]));
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { ttfb: n.responseStart, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd }; });
  const bootWireKB = Object.values(wire).reduce((a, n) => a + n, 0) / 1024;
  const heapBoot = (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'JSHeapUsedSize').value;
  const fcp = (boot.paint.find(p => p[0] === 'first-contentful-paint') || [])[1];
  out.boot = { fcp, lcpEntries: boot.lcp, lcp: boot.lcp.length ? boot.lcp[boot.lcp.length - 1].t : null, ready: boot.ready, dcl: nav.dcl, load: nav.load, ttfb: nav.ttfb,
    cls: boot.cls.reduce((a, e) => a + e.v, 0), cls_ready: boot.cls.filter(e => e.t <= boot.ready + 100).reduce((a, e) => a + e.v, 0), clsSrc: boot.cls, longtasks: boot.lt, loaf: boot.loaf, heapMB: heapBoot / 1048576, wireKB: bootWireKB };
  out.res = res;
  out.xfer = xfer;
  out.conn = Object.fromEntries(Object.entries(conn).map(([k, v]) => [k, v.size]));
  if (process.env.SHORT) { await browser.close(); return out; }
  // welcome dialog (first visit) -> dismiss
  if (visit === 'first') { await page.click('#wl-start'); await page.waitForTimeout(400); }
  // INP-ish: flag click on the default project, open add-sprite dialog, pick a character, open lessons, close
  await page.click('#btn-flag'); await page.waitForTimeout(500);
  await page.click('#btn-stop'); await page.waitForTimeout(300);
  await page.click('#btn-add-sprite'); await page.waitForTimeout(500);
  await page.click('#char-list .char-card >> nth=1'); await page.waitForTimeout(800);
  await page.click('#btn-lessons'); await page.waitForTimeout(500);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  // 3-sprite forever run
  await page.evaluate(p => { BB.app.loadProject(p, {}); }, PROJECT);
  await page.waitForTimeout(800);
  await page.evaluate(() => { __q.frames.length = 0; __q.sampling = true; });
  const ltBefore = (await snap()).lt.length;
  await page.click('#btn-flag');
  await page.waitForTimeout(5000);
  const moved = await page.evaluate(() => BB.rt.getSprites().map(s => [Math.round(s.x), Math.round(s.y)]));
  const running = await page.evaluate(() => BB.rt.isRunning());
  const heapRun = (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'JSHeapUsedSize').value;
  const after = await snap();
  const frames = await page.evaluate(() => { __q.sampling = false; return __q.frames.slice(); });
  const fs = frames.slice().sort((a, b) => a - b);
  const pct = p => fs.length ? fs[Math.min(fs.length - 1, Math.floor(p * fs.length))] : null;
  out.run = { running, moved, frames: frames.length, frameMed: pct(0.5), frameP95: pct(0.95), frameMax: fs[fs.length - 1], over50: frames.filter(x => x > 50).length,
    longtasks: after.lt.slice(ltBefore), heapMB: heapRun / 1048576 };
  await page.click('#btn-stop'); await page.waitForTimeout(300);
  // canvas draw cost, 3 visible sprites, 300 forced renders (measured under the CPU throttle)
  out.draw = await page.evaluate(() => { const n = 300; BB.rt.render(); const t = performance.now(); for (let i = 0; i < n; i++) BB.rt.render(); return (performance.now() - t) / n; });
  // interactions
  const evs = (await snap()).ev.filter(e => e.id > 0);
  const byId = {}; evs.forEach(e => { const k = e.id; if (!byId[k] || e.d > byId[k].d) byId[k] = e; });
  out.inter = Object.values(byId).map(e => ({ n: e.n, tgt: e.tgt, dur: e.d, input: r1(e.ps - e.s), proc: r1(e.pe - e.ps), present: r1(e.s + e.d - e.pe) }));
  out.clsTotal = (await snap()).cls.reduce((a, e) => a + e.v, 0);
  out.clsAll = (await snap()).cls;
  out.lcpFinal = (await snap()).lcp;
  const wireTotal = Object.entries(wire).reduce((a, [id, n]) => a + n, 0);
  out.wireKB = wireTotal / 1024;
  out.wire = Object.entries(wire).map(([id, n]) => [reqs[id] && reqs[id].replace(BASE, '/').slice(0, 90), n]).filter(x => x[1] > 3000);
  await browser.close();
  return out;
}
(async () => {
  const all = [];
  for (let i = 0; i < +runs; i++) { try { all.push(await one()); } catch (e) { all.push({ error: String(e).slice(0, 300) }); } }
  const ok = all.filter(a => a.boot);
  const S = f => med(ok.map(f));
  const summary = { variant, profile, visit, n: ok.length, failed: all.length - ok.length,
    fcp: r1(S(a => a.boot.fcp)), lcp: r1(S(a => a.boot.lcp)), ready: r1(S(a => a.boot.ready)), load: r1(S(a => a.boot.load)), ttfb: r1(S(a => a.boot.ttfb)),
    clsBoot: S(a => a.boot.cls), clsTotal: S(a => a.clsTotal != null ? a.clsTotal : a.boot.cls),
    bootLT_n: S(a => a.boot.longtasks.length), bootLT_max: r1(S(a => Math.max(0, ...a.boot.longtasks.map(x => x[1])))), bootLT_sum: r1(S(a => a.boot.longtasks.reduce((s, x) => s + x[1], 0))),
    lcpEl: ok[0] && (() => { const e = ok[0].boot.lcpEntries; const x = e[e.length - 1]; return x ? [x.tag, x.id, x.size, x.text] : null; })(), lcpEls: ok.map(a => { const e = a.boot.lcpEntries; const x = e[e.length - 1]; return x ? (x.id || x.tag) : null; }),
    clsAtReady: S(a => a.boot.cls_ready), wireBootKB: r1(S(a => a.boot.wireKB)), heapBootMB: r1(S(a => a.boot.heapMB)), heapRunMB: r1(S(a => a.run && a.run.heapMB)),
    frameMed: r1(S(a => a.run && a.run.frameMed)), frameP95: r1(S(a => a.run && a.run.frameP95)), frameMax: r1(S(a => a.run && a.run.frameMax)), over50: S(a => a.run && a.run.over50), runLT_n: S(a => a.run && a.run.longtasks.length), runLT_max: r1(S(a => Math.max(0, ...(a.run ? a.run.longtasks : []).map(x => x[1])))),
    drawMs: r1(S(a => a.draw)), wireKB: r1(S(a => a.wireKB)), inpWorst: r1(S(a => a.inter && Math.max(0, ...a.inter.map(x => x.dur)))) };
  summary.runs = { lcp: ok.map(a => r1(a.boot.lcp)), ready: ok.map(a => r1(a.boot.ready)), fcp: ok.map(a => r1(a.boot.fcp)) };
  summary.xfer = ok[0] && ok[0].xfer; summary.conn = ok[0] && ok[0].conn; summary.msgReq = ok[0] && ok[0].res.filter(r => /msg\//.test(r[0])).map(r => [r[1], r[2]]);
  console.log(JSON.stringify(summary));
  if (full) console.log(JSON.stringify(all[0], null, 1));
  if (process.env.RAW) require('fs').writeFileSync(process.env.RAW, JSON.stringify(all));
})();
