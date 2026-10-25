// What tabs.js persistTab costs on the page's thread (its record made: the state parked; the write is queued) for an
// XRPD tab of 12 patterns, refined: 7 calls, sorted. A profile on disk. node p-persist.mjs <base> settings refine
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
// (SP: where the round's fixtures are, the XRPD patterns s00–s11 and SrTiO3.cif; profiles made in TMP)
const SP = process.env.SP || '/tmp/claude-0/-home-user-datatreat-beta/51d5ad4e-64c4-51d8-8fdc-0e18be5b5240/scratchpad', TMP = process.env.TMP_DIR || os.tmpdir();
const FX = SP + '/e2e/xrd', CIF = SP + '/wf-xrd/rv-busy/SrTiO3.cif';
const [base, variant = 'settings', refine = ''] = process.argv.slice(2);
const dir = fs.mkdtempSync(path.join(TMP, 'dt-prof-'));
const ctx = await chromium.launchPersistentContext(dir, { viewport: { width: 1400, height: 900 }, serviceWorkers: 'block' });
const page = ctx.pages()[0], errors = [];
page.on('pageerror', e=> errors.push(e.message));
await page.addInitScript(()=>{
  window.__lt = [];
  new PerformanceObserver(l=>{ for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true });
});
const ready = ()=> page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && !!document.querySelector('#tabBar .ptab-add') && !document.querySelector('.module-loader.show, .dz-loading'), null, { timeout: 600000 });
const open = async m =>{ await page.click('#nav button[data-tab="home"]'); await page.click(`.home-card[data-go="${m}"]`); await ready(); };
await page.goto(base + '/index.html'); await ready();
await open('xrd');
const list = Array.from({ length: 12 }, (_, i)=> 's' + String(i).padStart(2, '0') + '.xrdml').map(n=> [n, fs.readFileSync(path.join(FX, n)).toString('base64')]);
await page.evaluate(list=>{ const dt = new DataTransfer(); for (const [name, b64] of list) dt.items.add(new File([Uint8Array.from(atob(b64), c=> c.charCodeAt(0))], name));
  document.querySelector('#xrdDropzone').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, list);
await page.waitForFunction(()=> document.querySelectorAll('#xrdFileTableWrap tr.file-row').length === 12, null, { timeout: 60000 }); await ready();
if (refine){
  await page.setInputFiles('#xrdR2CifInput', CIF); await page.waitForSelector('#xrdR2PhaseList input[data-on]');
  await page.waitForTimeout(700); await page.click('#xrdR2RefineAll');
  await page.waitForSelector('.confirm-modal'); await page.click('.confirm-modal .btn:not(.primary)');
  await page.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent !== 'Cancel', null, { timeout: 600000, polling: 500 });
  await ready();
}
await page.waitForTimeout(6000);
const r = await page.evaluate(async ()=>{ const T = await import('./tabs.js'), t = T.TABS[0], ms = [];
  for (let k = 0; k < 7; k++){ const t0 = performance.now(); T.persistTab(t); ms.push(performance.now() - t0); await new Promise(r=> setTimeout(r, 300)); }
  return ms.sort((a, b)=> a - b).map(x=> +x.toFixed(2)); });
console.log(JSON.stringify({ base, refine: !!refine, persistTabMs: r, errors }));
await ctx.close();
fs.rmSync(dir, { recursive: true, force: true });
