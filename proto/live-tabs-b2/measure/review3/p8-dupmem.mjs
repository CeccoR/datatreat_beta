// P8: what the history's copies cost after a wake, on a profile on disk: a SEM tab of 4 images
// 2048² 16-bit, each relabelled (4 steps), two removed (2 steps); the page's ArrayBuffers
// (Runtime.getHeapUsage backingStorageSize after two GCs) awake before the sleep and after
// the wake, and the arrays its history holds.
import { open, newTab, drop, relabel, tiff, settle, tick, MIN, until, light, gc, switchTab, log } from './lib.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir = fs.mkdtempSync(path.join(process.env.TMP_DIR || os.tmpdir(), 'dt-prof-'));
const { page, ctx, errors, close } = await open({ disk: true, dir });
const cdp = await ctx.newCDPSession(page);
const ab = async ()=>{ for (let i = 0; i < 2; i++) await cdp.send('HeapProfiler.collectGarbage'); const h = await cdp.send('Runtime.getHeapUsage'); return Math.round((h.backingStorageSize || 0)/2**20*10)/10; };
const census = ()=> page.evaluate(async ()=>{
  const u = await import('./utils.js'), t = (await import('./tabs.js')).TABS[0], h = u.getModuleHistory(t.id), arrs = new Set();
  h.states.forEach(s=> (s.files || []).forEach(f=>{ if (f.raw && f.raw.bytes) arrs.add(f.raw.bytes); }));
  return { arrays: arrs.size, MB: Math.round([...arrs].reduce((a, b)=> a + b.byteLength, 0)/2**20*10)/10 };
});
try {
  await newTab(page);
  await drop(page, [0, 1, 2, 3].map(i=> tiff(`i${i}.tif`, { sign: 'I' + i, seed: 10 + i, bits: 16, W: 2048, H: 2058 })));
  for (let i = 0; i < 4; i++) await relabel(page, i, 'L' + i);
  for (let k = 0; k < 2; k++){ await page.locator('#semFileTableWrap .row-del[data-i="0"]').click(); await settle(page); }
  log('before sleep: history', JSON.stringify(await census()), 'ArrayBuffers MB', await ab());
  await newTab(page);
  await tick(page, 11*MIN);
  await until(()=> light(page, 0), { what: 'light' });
  log('asleep: ArrayBuffers MB', await ab());
  const t0 = Date.now();
  await switchTab(page, 0);
  log('woken in', Date.now() - t0, 'ms; history', JSON.stringify(await census()), 'ArrayBuffers MB', await ab());
  log('errors', JSON.stringify(errors.filter(e=> !/Service Worker/.test(e))));
} finally { await close(); fs.rmSync(dir, { recursive: true, force: true }); }
