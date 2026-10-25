// P9: 8 images 2048² 16-bit, Remove all, then Ctrl+Z: the undo's time and longest task with
// the tab awake throughout, and after a sleep and a wake (kept.made counters; loader on?). A profile on disk.
import { open, newTab, drop, tiff, settle, tick, MIN, until, light, gc, switchTab, answer, log } from './lib.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir = fs.mkdtempSync(path.join(process.env.TMP_DIR || os.tmpdir(), 'dt-prof-'));
const { page, errors, close: close0 } = await open({ disk: true, dir });
const close = async ()=>{ await close0(); fs.rmSync(dir, { recursive: true, force: true }); };
try {
  await page.addInitScript(()=>{});
  await page.evaluate(()=>{ window.__lt = []; new PerformanceObserver(l=> l.getEntries().forEach(e=> window.__lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: false }); });
  await newTab(page);
  await drop(page, Array.from({ length: 8 }, (_, i)=> tiff(`i${i}.tif`, { sign: 'I' + i, seed: 20 + i, bits: 16, W: 2048, H: 2058 })));
  const made = ()=> page.evaluate(async ()=> ({ ...(await import('./utils.js')).kept.made }));
  const removeAll = async ()=>{ await page.click('#semFileTableWrap .remove-all'); await answer(page, 'ok'); await settle(page); };
  const timedUndo = async ()=>{
    await page.evaluate(()=>{ document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.__lt = []; window.__ld = false;
      const mo = new MutationObserver(()=>{ if (document.querySelector('.module-loader.show')) window.__ld = true; }); mo.observe(document.body, { subtree: true, attributes: true, childList: true }); window.__mo = mo; });
    const m0 = await made(), t0 = Date.now();
    await page.keyboard.press('Control+z');
    await page.waitForFunction(()=> document.querySelectorAll('#semThumbs .sem-thumb canvas').length === 8 && document.querySelectorAll('#semGroups .sem-gimg canvas').length === 8, null, { timeout: 30000 });
    await page.evaluate(()=> new Promise(r=> requestAnimationFrame(()=> requestAnimationFrame(r))));
    const ms = Date.now() - t0, m1 = await made();
    const r = await page.evaluate(()=>{ window.__mo.disconnect(); return { lt: window.__lt.map(x=> Math.round(x[1])), loader: window.__ld }; });
    await settle(page);
    return { ms, longTasks: r.lt, loaderShown: r.loader, made: Object.fromEntries(Object.keys(m1).map(k=> [k, (m1[k] || 0) - (m0[k] || 0)])) };
  };
  await removeAll();
  log('undo, awake throughout', JSON.stringify(await timedUndo()));
  await removeAll();
  await newTab(page);
  await tick(page, 11*MIN);
  await until(()=> page.evaluate(async ()=>{ const t = (await import('./tabs.js')).TABS[0]; return !t.inst && (await import('./db.js')).unread(t.hist.states); }), { what: 'history light' });
  await gc(page);
  await switchTab(page, 0);
  log('undo after a sleep and a wake', JSON.stringify(await timedUndo()));
  log('errors', JSON.stringify(errors.filter(e=> !/Service Worker/.test(e))));
} finally { await close(); }
