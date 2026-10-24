// Runtime check of the static inventory: listeners on window/document (CDP
// DOMDebugger.getEventListeners), DOM nodes and ids per module section, body-level
// overlays, after each module is opened and given the real fixtures.
// node probe.mjs [base]   (default http://localhost:8765)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { makeTiff } from '/home/user/datatreat_beta/tests/fixtures.mjs';

const S = '/tmp/claude-0/-home-user-datatreat-beta/51d5ad4e-64c4-51d8-8fdc-0e18be5b5240/scratchpad';
const OUT = path.join(S, 'b14/map-singletons');
const BASE = process.argv[2] || 'http://localhost:8765';
const XRD = Array.from({ length: 12 }, (_, i)=> path.join(S, 'e2e/xrd', 's' + String(i).padStart(2, '0') + '.xrdml'));
const CIF = path.join(S, 'wf-xrd/rv-busy/SrTiO3.cif');
const semDir = path.join(OUT, 'sem8'); fs.mkdirSync(semDir, { recursive: true });
const SEM = Array.from({ length: 8 }, (_, i)=>{ const p = path.join(semDir, `img${i+1}.tif`); if (!fs.existsSync(p)) fs.writeFileSync(p, makeTiff({ W: 2048, H: 2048 + 128, bits: 16, strip: 128, sign: 'S' + (i+1), pixelNm: i < 4 ? 25 : 50, mag: i < 4 ? 5000 : 2500, seed: i + 1 })); return p; });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e=> errs.push(e.message));
const cdp = await ctx.newCDPSession(page);
await page.goto(BASE + '/index.html');
await page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab-add'));
const settle = async ()=>{ await page.waitForFunction(()=> !document.querySelector('.dz-loading, .module-loader.show'), null, { timeout: 60000 }); await page.evaluate(()=> new Promise(r=> requestAnimationFrame(()=> requestAnimationFrame(()=> setTimeout(r, 50))))); };

async function listeners(expr){
  const { result } = await cdp.send('Runtime.evaluate', { expression: expr });
  const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
  const by = {};
  for (const l of listeners){ const k = l.type + (l.useCapture ? '(capture)' : ''); by[k] = (by[k] || 0) + 1; }
  return { n: listeners.length, by };
}
async function snap(label){
  const win = await listeners('window'), doc = await listeners('document');
  const dom = await page.evaluate(()=>{
    const sec = {};
    for (const s of document.querySelectorAll('main > section.tab')) sec[s.id] = { nodes: s.getElementsByTagName('*').length, ids: s.querySelectorAll('[id]').length };
    const all = [...document.querySelectorAll('[id]')].map(e=> e.id), dup = all.filter((x, i)=> all.indexOf(x) !== i);
    const bodyKids = [...document.body.children].filter(e=> e.tagName !== 'SCRIPT').map(e=> e.id || e.className.split(' ')[0] || e.tagName.toLowerCase());
    const kidCount = {}; bodyKids.forEach(k=> kidCount[k] = (kidCount[k] || 0) + 1);
    return { nodes: document.getElementsByTagName('*').length, ids: all.length, dupIds: [...new Set(dup)], sections: sec, bodyChildren: kidCount, svgPlots: document.querySelectorAll('svg.plot').length, canvases: document.querySelectorAll('canvas').length };
  });
  const r = { label, windowListeners: win, documentListeners: doc, ...dom };
  console.log(JSON.stringify(r));
  return r;
}
const res = [];
res.push(await snap('boot'));
for (const mod of ['tauc', 'xrd', 'gc', 'epr', 'sem']){
  await page.click('#nav button[data-tab="home"]'); await page.click(`.home-card[data-go="${mod}"]`);
  await page.waitForSelector(`#tab-${mod}.active`); await settle();
}
res.push(await snap('five blank tabs'));
// Each module's fixtures, in its own tab (the tab of that module made live again)
async function show(mod){ await page.locator('#tabBar .ptab').nth(['tauc','xrd','gc','epr','sem'].indexOf(mod)).locator('.ptab-label').click(); await settle(); }
await show('tauc'); await page.setInputFiles('#taucFiles', [path.join(S, 'fx/drs1.csv'), path.join(S, 'fx/drs2.csv')]); await settle();
await show('gc'); await page.setInputFiles('#gcFiles', [path.join(S, 'e2e/alpha.csv'), path.join(S, 'e2e/beta.csv')]); await settle();
await show('epr'); await page.setInputFiles('#eprFiles', [path.join(S, 'fx/e1.DSC'), path.join(S, 'fx/e1.DTA')]); await settle();
res.push(await snap('DRS 2, GC 2, EPR 1 loaded (EPR live)'));
await show('xrd'); await page.setInputFiles('#xrdFiles', XRD); await settle();
res.push(await snap('XRPD 12 patterns (Scherrer card)'));
// a Rietveld card, with the CIF
await page.click('#xrdAddAn'); await page.click('.an-menu:not([hidden]) [data-kind="rietveld"]'); await settle();
const cifIn = page.locator('#tab-xrd input[type=file][id$="CifInput"]').last();
await cifIn.setInputFiles(CIF); await settle();
res.push(await snap('XRPD 12 + Scherrer + Rietveld card with CIF'));
await show('sem'); await page.setInputFiles('#semFiles', SEM);
await page.waitForFunction(()=> document.querySelectorAll('#semThumbs .sem-thumb').length === 8, null, { timeout: 120000 }); await settle();
res.push(await snap('SEM 8 x 2048² 16-bit (SEM live)'));
fs.writeFileSync(path.join(OUT, 'probe.json'), JSON.stringify({ base: BASE, errors: errs, res }, null, 1));
console.log('errors', errs);
await browser.close();
