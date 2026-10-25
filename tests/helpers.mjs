/* What the tests share: a static server for the app (node:http, on a free port), a
   Chromium page on it that records page errors and Content-Security-Policy violations,
   the module and tab steps, downloads, a zip and a CSV reader, and the golden hashes of
   the plots.
   Environment: DT_ROOT serves another directory than the repository (a copy of an older
   version, say); DT_BASE uses a server already running instead of starting one;
   UPDATE_GOLDEN=1 writes the plots' hashes instead of comparing them; DT_HEADED=1 shows
   the browser. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { writeFixtures } from './fixtures.mjs';

// Playwright from the project's node_modules (npm i); else a global install's.
let pw;
try { pw = await import('playwright'); }
catch(e){ pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); }
export const { chromium } = pw;

// (fileURLToPath, not the URL's pathname: that one keeps a space as %20 and gives /C:/… on Windows)
export const TESTS = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(process.env.DT_ROOT || path.join(TESTS, '..'));
export const OUT = path.join(TESTS, 'out');
// (npm run test:update: npm names the script it runs in the environment, on every OS)
export const UPDATE = !!process.env.UPDATE_GOLDEN || process.env.npm_lifecycle_event === 'test:update';

/* ---- The static server ---- */
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
  json: 'application/json', webmanifest: 'application/manifest+json', svg: 'image/svg+xml', png: 'image/png', woff2: 'font/woff2', ico: 'image/x-icon', md: 'text/plain; charset=utf-8' };
export function serve(root = ROOT){
  const server = http.createServer((req, res)=>{
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch(e){ res.writeHead(400).end(); return; }
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, path.normalize(p));
    if (!file.startsWith(root + path.sep) || /[\\/](node_modules|\.git)[\\/]/.test(file)){ res.writeHead(403).end(); return; }
    fs.readFile(file, (err, buf)=>{
      if (err){ res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).slice(1)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(buf);
    });
  });
  return new Promise(ok=> server.listen(0, '127.0.0.1', ()=> ok({ base: 'http://127.0.0.1:' + server.address().port, close: ()=> new Promise(r=> server.close(r)) })));
}

/* ---- One test file's environment: the server, the browser, the fixtures ----
   env.page() opens the app in a fresh context (its own IndexedDB and localStorage). */
export async function start(){
  const srv = process.env.DT_BASE ? { base: process.env.DT_BASE.replace(/\/$/, ''), close: async ()=>{} } : await serve();
  // A browser that cannot start (Chromium not installed: npx playwright install chromium)
  // closes the server, whose open handle would keep the test file, and npm test, running.
  let browser, fx;
  try { browser = await chromium.launch({ headless: !process.env.DT_HEADED }); fx = writeFixtures(); }
  catch(e){ if (browser) await browser.close().catch(()=>{}); await srv.close(); throw e; }
  return {
    base: srv.base, browser, fx,
    page: opts => openApp(browser, srv.base, opts),
    async close(){ await browser.close().catch(()=>{}); await srv.close(); fx.remove(); },
  };
}

export async function openApp(browser, base, { viewport = { width: 1400, height: 900 }, clipboard = false } = {}){
  const ctx = await browser.newContext({ viewport, timezoneId: 'UTC', locale: 'en-US', colorScheme: 'dark',
    serviceWorkers: 'block', acceptDownloads: true });
  if (clipboard) await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const page = await ctx.newPage();
  const errors = [], csp = [];
  page.on('pageerror', e=> errors.push('pageerror: ' + e.message));
  // A file of the app's that does not load (a 404: a module or worker missing) is an error,
  // with its address; the console's own line for it, which has none, is left out.
  page.on('response', r=>{ if (r.status() >= 400 && r.url().startsWith(base + '/')) errors.push('http ' + r.status() + ': ' + r.url().slice(base.length)); });
  page.on('console', m=>{
    const t = m.text();
    if (/Content Security Policy|Refused to (execute|load|apply)/i.test(t)) csp.push(t);
    else if (m.type() === 'error' && !/^Failed to load resource: the server responded with a status of/.test(t)) errors.push('console: ' + t);
  });
  page.on('dialog', d=> d.dismiss());
  await page.addInitScript(()=>{
    // The same ids and choices on every run: a seeded Math.random.
    let x = 12345; Math.random = ()=>{ x = (x*1103515245 + 12345) % 2147483648; return x/2147483648; };
    // Every array a module fixes (db.js fixed: shared by the states, never changed) frozen
    // too, so that a write into one throws, a page error.
    window.__freezeFixed = true;
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', e=> window.__csp.push(e.violatedDirective + ' ' + e.blockedURI + ' ' + (e.sourceFile || '') + ':' + (e.lineNumber || '')));
    window.addEventListener('unhandledrejection', e=> console.error('unhandledrejection: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));
  });
  await page.goto(base + '/index.html');
  await ready(page);
  const cspAll = async ()=> csp.concat(await page.evaluate(()=> window.__csp).catch(()=> []));
  return { ctx, page, errors, csp: cspAll, close: ()=> ctx.close() };
}
// The app is up: its shell revealed and the tab bar built.
export const ready = page => page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab-add'));

/* ---- Waiting ----
   Nothing loading (the dropzone's "Loading…", the tab loader over a restore), then two
   frames for the plots that draw a frame after. */
export async function settle(page){
  await page.waitForFunction(()=> !document.querySelector('.dz-loading, .module-loader.show'));
  await page.evaluate(()=> new Promise(r=> requestAnimationFrame(()=> requestAnimationFrame(()=> setTimeout(r, 20)))));
}
// Poll fn (in Node) until it gives something truthy.
export async function until(fn, { timeout = 15000, every = 100, what = 'a condition' } = {}){
  const t0 = Date.now();
  for (;;){
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > timeout) throw new Error('timed out waiting for ' + what);
    await new Promise(r=> setTimeout(r, every));
  }
}

/* ---- Modules, files, tabs ---- */
export const MODS = ['tauc', 'xrd', 'gc', 'epr', 'sem'];
// A blank project of the technique, in a new tab, on show.
export async function openModule(page, mod){
  await page.click('#nav button[data-tab="home"]');
  await page.click(`.home-card[data-go="${mod}"]`);
  await page.waitForSelector(`#tab-${mod}.active`);
  await settle(page);
}
export const fileRows = (page, mod)=> page.locator(`#${mod}FileTableWrap tr.file-row`).count();
// Files given to the module's file picker; done when its list has `rows` more rows.
export async function loadFiles(page, mod, files, rows){
  const n0 = await fileRows(page, mod);
  rows = rows ?? (mod === 'epr' ? files.length/2 : files.length);
  await page.setInputFiles(`#${mod}Files`, files);
  await page.waitForFunction(([sel, n])=> document.querySelectorAll(sel).length >= n && !document.querySelector('.dz-loading'), [`#${mod}FileTableWrap tr.file-row`, n0 + rows], { timeout: 20000 });
  // (SEM: a thumbnail for each image included, drawn once its bytes are read)
  if (mod === 'sem') await page.waitForFunction(()=> document.querySelectorAll('#semThumbs .sem-thumb').length === document.querySelectorAll('#semFileTableWrap .file-incl:checked').length, null, { timeout: 20000 });
  await settle(page);
}
export const tabLabels = page => page.locator('#tabBar .ptab').allTextContents();
export const activeLabel = async page => (await page.locator('#tabBar .ptab.is-on').count()) ? page.locator('#tabBar .ptab.is-on').textContent() : null;
// A tab chosen in the bar, its state loaded.
export async function switchTab(page, i){ await page.locator('#tabBar .ptab').nth(i).locator('.ptab-label').click(); await settle(page); }
// Save the open project under a name.
export async function saveAs(page, name){
  await page.fill('.project-name-input', name);
  await page.click('.proj-save');
  await page.waitForSelector('.proj-save.is-saved');
}
// Ctrl+Z / Ctrl+Y on the page (no field focused, which would undo its own text).
export async function undo(page, redo = false){
  await page.evaluate(()=> document.activeElement && document.activeElement.blur && document.activeElement.blur());
  await page.keyboard.press(redo ? 'Control+y' : 'Control+z');
  await settle(page);
}
// Unfold every card and step every card's sample on, so that what can be drawn is.
export async function poke(page){
  for (const b of await page.locator('.tab.active .an-card.is-folded .an-fold').all()) await b.click().catch(()=>{});
  for (const b of await page.locator('.tab.active .an-next:visible').all()) await b.click({ timeout: 2000 }).catch(()=>{});
  await settle(page);
}

/* ---- The app's own state ---- */
// A module's state as JSON, the big arrays (and the files' bytes) left out unless `full`.
export const moduleState = (page, mod, full = false)=> page.evaluate(async ([mod, full])=>{
  const u = await import('./utils.js'), big = new Set(['rawBytes', 'x', 'y', 'varMul', 'px', 'pixels']);
  return JSON.parse(JSON.stringify(u.getModuleState(mod), (k, v)=> !full && big.has(k) && v && typeof v === 'object' ? undefined : v));
}, [mod, full]);
export const history = (page, mod)=> page.evaluate(async mod=>{ const u = await import('./utils.js'); const h = u.getModuleHistory(mod); return { index: h.index, n: h.states.length }; }, mod);
// The records of an IndexedDB store of the app ('sessions': saved projects, 'tabs': open tabs).
export const idb = (page, store = 'sessions')=> page.evaluate(store=> new Promise((res, rej)=>{
  const r = indexedDB.open('datatreat');
  r.onsuccess = ()=>{ const q = r.result.transaction(store).objectStore(store).getAll(); q.onsuccess = ()=>{ res(q.result); r.result.close(); }; q.onerror = ()=> rej(q.error); };
  r.onerror = ()=> rej(r.error);
}), store);

/* ---- Banners (confirmBanner) ---- */
// The banner on show, or null. Read two frames on: a banner takes its .show a frame after
// it is made, and right after a click it may not have been made yet.
export const banner = page => page.evaluate(()=> new Promise(r=> requestAnimationFrame(()=> requestAnimationFrame(r)))
  .then(()=>{ const t = document.querySelector('.pwa-confirm.show'); return t ? { text: t.querySelector('span').textContent, buttons: [...t.querySelectorAll('button')].map(b=> b.textContent || b.getAttribute('aria-label')) } : null; }));
// Answer the banner on show: 'ok' (the primary), 'alt' (the middle one), 'x', 'esc'.
export async function answer(page, which){
  await page.waitForSelector('.pwa-confirm.show');
  if (which === 'esc') await page.keyboard.press('Escape');
  else await page.click(which === 'ok' ? '.pwa-confirm.show .btn.primary' : which === 'alt' ? '.pwa-confirm.show .btn:not(.primary)' : '.pwa-confirm.show .pwa-toast-x');
  await page.waitForFunction(()=> !document.querySelector('.pwa-confirm.show'));
  await settle(page);
}

/* ---- Downloads ---- */
export async function download(page, act, timeout = 20000){
  const [d] = await Promise.all([page.waitForEvent('download', { timeout }), act()]);
  return { name: d.suggestedFilename(), buf: fs.readFileSync(await d.path()) };
}

/* ---- Project files (.datatreat, v484) ----
   The open project exported from the project bar: { name, text, obj }. */
export async function exportProject(page){
  const d = await download(page, ()=> page.click('.proj-json'));
  const text = d.buf.toString('utf8');
  return { name: d.name, text, obj: JSON.parse(text) };
}
// The signature the app writes: SHA-256 of JSON.stringify([module, state]), in hex.
export const signature = (module, state)=> createHash('sha256').update(JSON.stringify([module, state])).digest('hex');
// A project file written to the fixtures' directory; `sign` re-signs it for its state.
export function projectFile(env, name, obj, { sign = false } = {}){
  const o = sign ? { ...obj, signature: { alg: 'SHA-256', value: signature(obj.module, obj.state) } } : obj;
  return env.fx.put(name, typeof o === 'string' ? o : JSON.stringify(o));
}
/* A file given to Projects › Import. `expectDoubt`: the app is to ask first ("Import
   anyway"), answered with `answerDoubt` ('ok' imports, 'x' does not); false: it must not
   ask. `refused`: the file is refused (a banner with OK only). Returns what the banner
   said (null when none), once the list is drawn again. */
export async function importProject(page, file, { expectDoubt = false, answerDoubt = 'ok', refused = false } = {}){
  await page.click('#nav button[data-tab="projects"]');
  const n0 = await page.locator('#sessListWrap tr.sess-row').count();
  await page.setInputFiles('#sessImportFile', file);
  let said = null;
  if (expectDoubt || refused){
    await page.waitForSelector('.pwa-confirm.show', { timeout: 10000 });
    said = await banner(page);
    if (refused){
      if (said.buttons.includes('Import anyway')) throw new Error('import: asked to import a file that was to be refused: ' + said.text);
      await answer(page, 'ok');
      return said;
    }
    if (!said.buttons.includes('Import anyway')) throw new Error('import: a banner with no "Import anyway": ' + said.text);
    await answer(page, answerDoubt);
    if (answerDoubt !== 'ok') return said;
  }
  // (a banner that was not expected fails here, at the latest when the row never comes)
  await until(async ()=> (await banner(page)) || (await page.locator('#sessListWrap tr.sess-row').count()) > n0, { what: 'the imported project in the list' });
  const b = await banner(page);
  if (b && !expectDoubt) throw new Error('import: an unexpected banner: ' + b.text);
  return said;
}
// Open a project of the Projects list (by its name's end) in a tab, and show that tab.
export async function openProject(page, mod, nameEnd){
  await page.click('#nav button[data-tab="projects"]');
  const row = page.locator('#sessListWrap tr.sess-row').filter({ has: page.locator(`input.proj-rename[value$="${nameEnd}"]`) });
  await row.first().locator('td').nth(3).click();
  const tab = page.locator('#tabBar .ptab', { hasText: nameEnd });
  await tab.first().waitFor();
  await tab.first().locator('.ptab-label').click();
  await page.waitForSelector(`#tab-${mod}.active`);
  await settle(page);
}
// Keep a file the tests made, for a look after a failure.
export function keep(name, data){ fs.mkdirSync(path.dirname(path.join(OUT, name)), { recursive: true }); fs.writeFileSync(path.join(OUT, name), data); return path.join(OUT, name); }

/* ---- Zip (the app writes stored entries; deflated ones read too) ---- */
export function readZip(buf){
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('not a zip: no end of central directory');
  const n = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);
  const out = [];
  for (let i = 0; i < n; i++){
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip: bad central directory entry');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nl).toString('utf8');
    const ds = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28), raw = buf.subarray(ds, ds + csize);
    out.push({ name, data: method === 0 ? raw : inflateRawSync(raw) });
    p += 46 + nl + xl + cl;
  }
  return out;
}

/* ---- CSV (RFC 4180): throws on a quote out of place or one never closed ---- */
export function parseCsv(text, sep = ';'){
  const rows = []; let row = [], f = '', i = 0, quoted = false, started = false;
  const endField = ()=>{ row.push(f); f = ''; quoted = false; started = false; };
  const endRow = ()=>{ endField(); rows.push(row); row = []; };
  while (i < text.length){
    const c = text[i];
    if (c === '"'){
      if (started) throw new Error(`CSV: a quote inside an unquoted field, row ${rows.length + 1}`);
      quoted = started = true; i++;
      for (;;){
        if (i >= text.length) throw new Error(`CSV: a quoted field never closed, row ${rows.length + 1}`);
        if (text[i] === '"'){ if (text[i + 1] === '"'){ f += '"'; i += 2; continue; } i++; break; }
        f += text[i++];
      }
      const n = text[i];
      if (n !== undefined && n !== sep && n !== '\n' && n !== '\r') throw new Error(`CSV: "${n}" after a closing quote, row ${rows.length + 1}`);
      continue;
    }
    if (c === sep){ endField(); i++; continue; }
    if (c === '\r' && text[i + 1] === '\n'){ endRow(); i += 2; continue; }
    if (c === '\n' || c === '\r'){ endRow(); i++; continue; }
    if (quoted) throw new Error('CSV: text after a closing quote');
    started = true; f += c; i++;
  }
  if (started || f || row.length) endRow();
  return rows;
}

/* ---- Markup injected: an element the payload's data-x made ---- */
export const PAYLOAD = `"'><i data-x=1></i>`;
export const injected = page => page.evaluate(()=>{
  const els = [...document.querySelectorAll('[data-x]')];
  return els.slice(0, 6).map(e=>{ const p = e.parentElement; return (p ? (p.id || p.className || p.tagName) : '?') + ' :: ' + (p ? p.outerHTML.slice(0, 160) : ''); });
});

/* ---- Plot golden hashes ----
   Each plot's SVG markup, made comparable: the clip ids (random when the svg has no id)
   dropped, numbers rounded to 0.01, embedded images by their hash. */
export function normSvg(s){
  return s.replace(/\bpc-[A-Za-z0-9]+/g, 'pc')
    .replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, m=> 'img:' + sha(m))
    .replace(/-?\d+\.\d{3,}(e-?\d+)?/g, m=>{ const v = +m; const r = Math.round(v*100)/100; return String(Object.is(r, -0) ? 0 : r); });
}
export const sha = s => createHash('sha1').update(s).digest('hex').slice(0, 16);
// Every plot of the module on show: { key: normalised markup }, the key its svg's id (or
// its place) and, for the same id met again, its place among those.
export async function plotSvgs(page, mod){
  const list = await page.$$eval(`#tab-${mod} svg.plot`, ss=> ss.map((s, i)=> ({ id: s.id || ('#' + i), html: s.innerHTML, shown: s.getClientRects().length > 0 })));
  const out = {}, seen = {};
  for (const p of list){ let k = p.id; if (seen[k] != null){ seen[k]++; k += '~' + seen[k]; } else seen[k] = 0; out[k] = { svg: normSvg(p.html), shown: p.shown }; }
  return out;
}
/* Compare with tests/golden/<name>.json (or write it, UPDATE_GOLDEN=1). Returns the
   differences as lines, empty when all match; a plot that differs is written to
   tests/out/plots/<name>/<key>.svg for a look. */
export function golden(name, plots){
  const file = path.join(TESTS, 'golden', name + '.json');
  const now = Object.fromEntries(Object.entries(plots).map(([k, v])=> [k, sha(v.svg)]));
  if (UPDATE){ fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(now, null, 1) + '\n'); return []; }
  if (!fs.existsSync(file)) return [`no golden file ${path.relative(TESTS, file)}: run npm run test:update`];
  const want = JSON.parse(fs.readFileSync(file, 'utf8')), diff = [];
  for (const k of new Set([...Object.keys(want), ...Object.keys(now)])){
    if (want[k] === now[k]) continue;
    if (!(k in now)) diff.push(`${name} ${k}: in the golden file, not drawn now`);
    else {
      diff.push(`${name} ${k}: ${k in want ? 'differs from the golden hash' : 'new plot, not in the golden file'}`);
      keep(`plots/${name}/${k.replace(/[^\w.~#-]+/g, '_')}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="480">${plots[k].svg}</svg>`);
    }
  }
  return diff;
}
