/* From v517 to b2 in the same browser: what a user who updates finds. One origin served from
   v517's tree, then from b2's (a static server whose directory is switched; the same
   IndexedDB and localStorage). In v517: one tab of each module with the tests' fixtures
   (XRPD with the CIF, refined), each saved as a project, its project bar's CSVs kept, then a
   label edited and left unsaved. Reloaded as b2: the same tabs, the one on show awake and the
   others asleep; each shown, its edit there (SEM's thumbnails drawn: its files kept as
   base64 by v517); a label changed and undone in each; each saved project reopened as saved;
   Projects' CSVs of each, made by b2 from v517's records, the same bytes as v517's project
   bar gave. No page error, no CSP violation.
   node upgrade.mjs HEAD_DIR B2_DIR → results/upgrade.json */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { save } from './lib.mjs';

const [HEAD, B2] = process.argv.slice(2).map(d=> path.resolve(d));
const H = await import(path.join(B2, 'tests/helpers.mjs'));
const { openApp, openModule, loadFiles, settle, ready, saveAs, download, readZip, moduleState, switchTab, tabLabels, undo, MODS } = H;
let root = HEAD;
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', webmanifest: 'application/manifest+json', svg: 'image/svg+xml', png: 'image/png', woff2: 'font/woff2' };
const server = http.createServer((req, res)=>{
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, path.normalize(p));
  if (!f.startsWith(root + path.sep)){ res.writeHead(403).end(); return; }
  fs.readFile(f, (e, b)=>{ if (e){ res.writeHead(404).end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).slice(1)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(b); });
});
await new Promise(r=> server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
const fx = (await import(path.join(B2, 'tests/fixtures.mjs'))).writeFixtures();
const browser = await H.chromium.launch();
const out = { checks: {} }, ok = (k, v)=>{ out.checks[k] = v; if (v !== true) console.log('FAIL', k, v); };
const labels = async mod => (await moduleState(page, mod)).files.map(f=> f.label);
async function relabel(mod, v){ const l = page.locator(`#${mod}FileTableWrap .file-label[data-i="0"]`); await l.fill(v); await l.press('Enter'); await settle(page); }
const { page, errors, csp, close } = await openApp(browser, base);
try {
  // v517
  const bar = {}, left = {};
  for (const mod of MODS){
    await openModule(page, mod); await loadFiles(page, mod, fx.files[mod]);
    if (mod === 'xrd'){
      await page.setInputFiles('#xrdR2CifInput', fx.cif); await page.waitForSelector('#xrdR2PhaseList input[data-on]'); await settle(page);
      await page.waitForTimeout(650); await page.click('#xrdR2RefineAll');
      await page.waitForSelector('.confirm-modal'); await page.click('.confirm-modal .btn:not(.primary)');
      await page.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Refine', null, { timeout: 120000 }); await settle(page);
    }
    await saveAs(page, 'U-' + mod);
    bar[mod] = readZip((await download(page, ()=> page.click('.proj-csv'))).buf);
    await relabel(mod, mod + '-edited');
    left[mod] = await labels(mod);
  }
  const tabs517 = await tabLabels(page);
  await page.waitForTimeout(1500);   // (the last autosave written)
  // b2, the same origin
  root = B2;
  await page.reload(); await ready(page); await settle(page);
  ok('same tabs', JSON.stringify(await tabLabels(page)) === JSON.stringify(tabs517));
  const now = await page.evaluate(async ()=> (await import('./tabs.js')).tabsNow().map(t=> t.awake));
  ok('on show awake, others asleep', JSON.stringify(now) === JSON.stringify([false, false, false, false, true]));
  for (let i = 0; i < MODS.length; i++){
    const mod = MODS[i];
    await switchTab(page, i);
    ok(mod + ': its edit kept', JSON.stringify(await labels(mod)) === JSON.stringify(left[mod]));
    if (mod === 'sem') ok('sem: thumbnails drawn', await page.locator('#semThumbs .sem-thumb canvas').count() === fx.files.sem.length);
    if (mod === 'xrd') ok('xrd: v517\'s results', Object.keys((await moduleState(page, 'xrd')).cards.find(c=> c.id === 2).states.rietveld.results || {}).length === 3);
    await relabel(mod, mod + '-b2'); await undo(page);
    ok(mod + ': a step and its undo', (await labels(mod))[0] === mod + '-edited');
  }
  await page.click('#nav button[data-tab="projects"]');
  for (const mod of MODS){
    const row = page.locator('#sessListWrap tr.sess-row').filter({ has: page.locator(`input.proj-rename[value="U-${mod}"]`) });
    const z = readZip((await download(page, ()=> row.locator('.pr-csv').click())).buf);
    ok(mod + ': Projects\' CSVs from v517\'s record = v517\'s', z.length === bar[mod].length && z.every((e, i)=> e.name === bar[mod][i].name && e.data.equals(bar[mod][i].data)));
  }
  // a saved project reopened: as saved, in a tab of its own (its tab open holds the edit)
  for (const mod of ['sem', 'xrd']){
    await page.click('#nav button[data-tab="projects"]');
    const row = page.locator('#sessListWrap tr.sess-row').filter({ has: page.locator(`input.proj-rename[value="U-${mod}"]`) });
    await row.locator('td').nth(3).click(); await settle(page);
    ok(mod + ': reopened shows its open tab', (await labels(mod))[0] === mod + '-edited');
  }
  ok('no page error', errors.length === 0 || errors);
  ok('no CSP violation', (await csp()).length === 0);
} finally { await close(); await browser.close(); server.close(); fx.remove(); }
out.pass = Object.values(out.checks).every(v=> v === true);
console.log(JSON.stringify(out, null, 1));
save('upgrade.json', { method: 'measure/upgrade.mjs: v517 (b93ed5c) then HEAD + b2.patch on one origin, headless Chromium', ...out });
