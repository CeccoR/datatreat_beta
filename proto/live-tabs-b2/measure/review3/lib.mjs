// Shared steps for the review's probes (b2v3, NOTES-v3.md §7): the app at BASE (8990 by default), a
// SEM tab, files dropped, the rules run. TREE: a tree whose tests/fixtures.mjs makes the TIFFs (this one's).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const T = process.env.TREE || fileURLToPath(new URL('../../../../', import.meta.url));
const { makeTiff } = await import(T + '/tests/fixtures.mjs');
export const BASE = process.env.BASE || 'http://127.0.0.1:8990';
export const sha = b => createHash('sha256').update(b).digest('hex');
export const tiff = (name, o)=> ({ name, buffer: Buffer.from(makeTiff(o)) });

export async function open({ disk = false, dir } = {}){
  let ctx, browser;
  const opts = { viewport: { width: 1400, height: 900 }, timezoneId: 'UTC', locale: 'en-US', serviceWorkers: 'block', acceptDownloads: true };
  if (disk){ fs.mkdirSync(dir, { recursive: true }); ctx = await chromium.launchPersistentContext(dir, { headless: true, ...opts }); }
  else { browser = await chromium.launch({ headless: true }); ctx = await browser.newContext(opts); }
  const page = ctx.pages()[0] || await ctx.newPage();
  const errors = [];
  page.on('pageerror', e=> errors.push('pageerror: ' + e.message));
  page.on('console', m=>{ if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('dialog', d=> d.dismiss());
  await page.addInitScript(()=>{ window.addEventListener('unhandledrejection', e=> console.error('unhandledrejection: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason))); });
  await page.goto(BASE + '/index.html');
  await ready(page);
  return { ctx, browser, page, errors, close: async ()=>{ await ctx.close().catch(()=>{}); if (browser) await browser.close().catch(()=>{}); } };
}
export const ready = page => page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab-add'));
export async function settle(page){
  await page.waitForFunction(()=> !document.querySelector('.dz-loading, .module-loader.show'), null, { timeout: 30000 });
  await page.evaluate(()=> new Promise(r=> requestAnimationFrame(()=> requestAnimationFrame(()=> setTimeout(r, 20)))));
}
export async function until(fn, { timeout = 20000, every = 100, what = 'a condition' } = {}){
  const t0 = Date.now();
  for (;;){ const v = await fn(); if (v) return v; if (Date.now() - t0 > timeout) throw new Error('timed out waiting for ' + what); await new Promise(r=> setTimeout(r, every)); }
}
export async function newTab(page, mod = 'sem'){
  await page.click('#nav button[data-tab="home"]');
  await page.click(`.home-card[data-go="${mod}"]`);
  await page.waitForFunction(m=> !!document.querySelector(`#tab-${m}.active`), mod);
  await settle(page);
}
export async function drop(page, files){
  const n0 = await page.locator('#semFileTableWrap tr.file-row').count();
  await page.evaluate(list=>{
    const dt = new DataTransfer();
    for (const [name, b64] of list) dt.items.add(new File([Uint8Array.from(atob(b64), c=> c.charCodeAt(0))], name));
    document.querySelector('#semDropzone').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, files.map(f=> [f.name, f.buffer.toString('base64')]));
  await page.waitForFunction(n=> document.querySelectorAll('#semFileTableWrap tr.file-row').length >= n && !document.querySelector('.dz-loading'), n0 + files.length, { timeout: 60000 });
  await page.waitForFunction(()=> document.querySelectorAll('#semThumbs .sem-thumb canvas').length === document.querySelectorAll('#semFileTableWrap .file-incl:checked').length, null, { timeout: 60000 });
  await settle(page);
}
export async function relabel(page, i, v){ const l = page.locator(`#semFileTableWrap .file-label[data-i="${i}"]`); await l.fill(v); await l.press('Enter'); await settle(page); }
export const tabs = page => page.evaluate(async ()=> (await import('./tabs.js')).tabsNow());
export const tick = (page, ms)=> page.evaluate(async ms=> (await import('./tabs.js')).sleepTick(Date.now() + ms), ms);
export const MIN = 60000;
export async function gc(page){ const c = await page.context().newCDPSession(page); for (let i = 0; i < 2; i++) await c.send('HeapProfiler.collectGarbage'); await c.detach(); }
export const light = (page, i)=> page.evaluate(async i=>{ const t = (await import('./tabs.js')).TABS[i]; return !!t && !t.inst && (await import('./db.js')).unread(t.state); }, i);
export const shown = (page, i)=> page.locator('#tabBar .ptab').nth(i).locator('.ptab-label').click();
export async function switchTab(page, i){ await shown(page, i); await settle(page); }
export async function undo(page, redo = false){
  await page.evaluate(()=> document.activeElement && document.activeElement.blur && document.activeElement.blur());
  await page.keyboard.press(redo ? 'Control+y' : 'Control+z');
  await settle(page);
}
export const labels = page => page.evaluate(async ()=>{ const u = await import('./utils.js'); return u.getModuleState('sem').files.map(f=> f.label); });
export const idb = (page, store = 'sessions')=> page.evaluate(store=> new Promise((res, rej)=>{
  const r = indexedDB.open('datatreat');
  r.onsuccess = ()=>{ const q = r.result.transaction(store).objectStore(store).getAll(); q.onsuccess = ()=>{ res(q.result); r.result.close(); }; q.onerror = ()=> rej(q.error); };
  r.onerror = ()=> rej(r.error);
}), store);
export const storeKeys = page => page.evaluate(()=> new Promise((res, rej)=>{
  const r = indexedDB.open('datatreat');
  r.onsuccess = ()=>{ const q = r.result.transaction('bytes').objectStore('bytes').getAllKeys(); q.onsuccess = ()=>{ res(q.result); r.result.close(); }; q.onerror = ()=> rej(q.error); };
  r.onerror = ()=> rej(r.error);
}));
export async function banner(page){
  return page.evaluate(()=> new Promise(r=> requestAnimationFrame(()=> requestAnimationFrame(r)))
    .then(()=>{ const t = document.querySelector('.pwa-confirm.show'); return t ? { text: t.querySelector('span').textContent, buttons: [...t.querySelectorAll('button')].map(b=> b.textContent || b.getAttribute('aria-label')) } : null; }));
}
export async function answer(page, which){
  await page.waitForSelector('.pwa-confirm.show');
  if (which === 'esc') await page.keyboard.press('Escape');
  else await page.click(which === 'ok' ? '.pwa-confirm.show .btn.primary' : which === 'alt' ? '.pwa-confirm.show .btn:not(.primary)' : '.pwa-confirm.show .pwa-toast-x');
  await page.waitForFunction(()=> !document.querySelector('.pwa-confirm.show'));
  await settle(page);
}
export function log(...a){ console.log(...a); }
