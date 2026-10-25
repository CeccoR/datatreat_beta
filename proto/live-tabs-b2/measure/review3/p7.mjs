// An awake XRPD tab left for Settings, the window resized there, then another tab chosen, then the XRPD tab
// again: is the loader on over its redraw at the new width (tabs.js redrawn), and its longest task. Control:
// the same with no Settings between. A profile on disk. node p7.mjs <base> <variant: settings|direct> [refine]
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
await open('gc');                       // tab 1
const tab = i => page.locator('#tabBar .ptab').nth(i).locator('.ptab-label');
await tab(0).click(); await ready(); await page.waitForTimeout(500);
if (variant === 'settings'){
  await page.click('#nav button[data-tab="settings"]'); await page.waitForTimeout(300);
  await page.setViewportSize({ width: 1100, height: 900 }); await page.waitForTimeout(800);
  await tab(1).click(); await ready(); await page.waitForTimeout(800);
} else {
  await tab(1).click(); await ready(); await page.waitForTimeout(300);
  await page.setViewportSize({ width: 1100, height: 900 }); await page.waitForTimeout(800);
}
const t0 = await page.evaluate(()=>{ window.__seen = false; const iv = setInterval(()=>{ if (document.querySelector('.module-loader.show')) window.__seen = true; }, 0); window.__iv = iv; return performance.now(); });
// (the loader on at the click: polled within the click's own task too)
await page.evaluate(()=>{ new MutationObserver(()=>{ if (document.querySelector('.module-loader.show')) window.__seen = true; }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true }); });
await tab(0).click(); await ready(); await page.waitForTimeout(1500);
const r = await page.evaluate(t0=>{ clearInterval(window.__iv); return { loaderSeen: window.__seen, longTasks: window.__lt.filter(([s])=> s >= t0) }; }, t0);
console.log(JSON.stringify({ base, variant, refine: !!refine, ...r, errors }));
await ctx.close();
fs.rmSync(dir, { recursive: true, force: true });
