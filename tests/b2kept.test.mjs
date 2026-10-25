/* What is worked out, kept (b2v3): a tab woken from sleep, an undo, a redraw take what was
   worked out before (utils.js keeper: by the data's array and every other input), and make
   none of it again. Counted (utils.js kept.made: the results made, by name) across each
   wake; the plots drawn from what was kept, against the golden hashes the plots' test takes
   of a first drawing (plots.test.mjs: the same files and steps) and against the same tab's
   own before it slept; its CSVs byte for byte. A parameter changed makes its results again,
   and an undo back to it takes them as kept. XRPD (its patterns' processing, its Rietveld
   curves), DRS (every fit, a Tauc and an Urbach card), GC and EPR (their tables and
   smoothing), SEM (its thumbnails and cards, kept while the tab is asleep, its bytes let
   go). The tab woken shows under the loader; one awake shown at another width of the
   window, too, and a project written to a file (b2v3's loader). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { start, openModule, loadFiles, switchTab, settle, undo, poke, plotSvgs, golden, download, readZip, saveAs } from './helpers.mjs';
import { makeTiff } from './fixtures.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const MIN = 60000;
const tabs = page => page.evaluate(async ()=> (await import('./tabs.js')).tabsNow());
const tick = (page, ms)=> page.evaluate(async ms=> (await import('./tabs.js')).sleepTick(Date.now() + ms), ms);
const made = page => page.evaluate(async ()=> JSON.parse(JSON.stringify((await import('./utils.js')).kept)));
/* Every plot drawn again at a settled layout: the window narrowed and widened back (a plot
   drawn as its section is put in the page, a wake's, can differ in its last digit, as the
   plots' test says of a first drawing; one drawn again at the same size is kept as it is). */
async function redraw(page){
  for (const width of [1380, 1400]){ await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(400); await settle(page); }
}
const csvs = async page => readZip((await download(page, ()=> page.click('.proj-csv'))).buf).map(e=> [e.name, e.data.toString('utf8')]);
// Tab i put to sleep from tab j (11 minutes hidden), then shown: woken, the loader on.
async function sleepWake(page, i, j){
  await switchTab(page, j);
  await tick(page, 11*MIN);
  assert.equal((await tabs(page))[i].awake, false, 'asleep');
  await page.locator('#tabBar .ptab').nth(i).locator('.ptab-label').click();
  assert.equal(await page.evaluate(()=> !!document.querySelector('.module-loader.show')), true, 'the loader on as it wakes');
  await settle(page);
  assert.equal((await tabs(page))[i].awake, true, 'awake');
}
const P = '#xrdR2';
const press = async (page, sel)=>{ await page.waitForTimeout(650); await page.click(sel); };
async function refine(page, sel){
  await press(page, sel);
  await page.waitForSelector('.confirm-modal');
  await page.click('.confirm-modal .btn:not(.primary)');
  await page.waitForFunction(s=> document.querySelector(s).textContent === 'Cancel', P + 'Refine');
  await page.waitForFunction(s=> document.querySelector(s).textContent === 'Refine', P + 'Refine', { timeout: 120000, polling: 100 });
  await settle(page);
}
const diff = (a, b)=> Object.keys(b).filter(k=> (a[k] || 0) !== b[k]);
// The DRS cards on sample k, stepped by the first card's arrow (a tab woken shows the one it
// showed: b2v4, b2view.test.mjs; to b2v4 the first).
async function toSample(page, k){
  for (let n = 0; n < 4 && !(await page.textContent('#an1Idx')).startsWith(k + 1 + '/'); n++){ await page.click('#tab-tauc .an-card .an-next'); await settle(page); }
}
/* Files dropped (a DragEvent), no element handle kept: setInputFiles keeps a hold on the
   input it filled, and so on its instance, whose files a tab asleep would then never let go
   (b2drs.test.mjs). */
async function drop(page, mod, files){
  const list = files.map(f=> [path.basename(f), fs.readFileSync(f).toString('base64')]);
  await page.evaluate(([mod, list])=>{
    const dt = new DataTransfer();
    for (const [name, b64] of list) dt.items.add(new File([Uint8Array.from(atob(b64), c=> c.charCodeAt(0))], name));
    document.querySelector('#' + mod + 'Dropzone').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, [mod, list]);
  await page.waitForFunction(n=> document.querySelectorAll('#semThumbs .sem-thumb canvas').length >= n && !document.querySelector('.dz-loading'), files.length, { timeout: 20000 });
  await settle(page);
}

test('XRPD woken: its processing and Rietveld curves kept, not made again; its plots golden and as before, its CSVs byte for byte; a setting changed made again, undone taken', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    // The plots' test's XRPD: three patterns, every card stepped once
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd);
    await poke(page);
    await page.evaluate(()=> document.fonts.ready);
    await redraw(page);
    assert.deepEqual(golden('xrd', await plotSvgs(page, 'xrd')), [], 'drawn first: the golden hashes');
    await openModule(page, 'gc');
    const m0 = await made(page);
    assert.ok(m0.made['xrd-smoothing'] >= 3 && m0.made['xrd-peaks'] >= 3, 'its patterns processed once each at least');
    await sleepWake(page, 0, 1);
    await redraw(page);
    const m1 = await made(page);
    assert.deepEqual(diff(m0.made, m1.made), [], 'woken: nothing made again');
    assert.ok(m1.taken['xrd-peaks'] > (m0.taken['xrd-peaks'] || 0), 'its processing taken as kept');
    assert.deepEqual(golden('xrd', await plotSvgs(page, 'xrd')), [], 'woken: the golden hashes, from what was kept');

    // Refined: the curves made as drawn, kept across a sleep
    await page.setInputFiles(P + 'CifInput', env.fx.cif);
    await page.waitForSelector(P + 'PhaseList input[data-on]');
    await settle(page);
    await refine(page, P + 'RefineAll');
    await redraw(page);
    const plots0 = await plotSvgs(page, 'xrd'), csv0 = await csvs(page), m2 = await made(page);
    assert.ok(m2.made['xrd-curves'] >= 3 && m2.made['xrd-net'] >= 3 && m2.made['xrd-difference'] >= 1, 'the curves made, each pattern\'s');
    await sleepWake(page, 0, 1);
    await redraw(page);
    const m3 = await made(page);
    assert.deepEqual(diff(m2.made, m3.made), [], 'woken: no curve, processing or peak made again');
    assert.ok(m3.taken['xrd-curves'] > (m2.taken['xrd-curves'] || 0) && m3.taken['xrd-net'] > (m2.taken['xrd-net'] || 0), 'the curves taken as kept');
    assert.deepEqual(await plotSvgs(page, 'xrd'), plots0, 'every plot as before it slept');
    assert.deepEqual(await csvs(page), csv0, 'every CSV byte for byte');
    // A redraw at another width: drawn again, nothing made again
    await page.setViewportSize({ width: 1180, height: 900 }); await page.waitForTimeout(400); await settle(page);
    await page.setViewportSize({ width: 1400, height: 900 }); await page.waitForTimeout(400); await settle(page);
    assert.deepEqual(diff(m3.made, (await made(page)).made), [], 'resized: nothing made again');

    // The shown pattern refined again with another background degree: its curves made again
    await page.click(P + 'Settings');
    await page.fill('[data-fit="bgDegree"]', '8'); await page.press('[data-fit="bgDegree"]', 'Enter');
    await page.keyboard.press('Escape'); await settle(page);
    const m4 = await made(page);
    await refine(page, P + 'Refine');
    await redraw(page);
    const m5 = await made(page), plots1 = await plotSvgs(page, 'xrd');
    assert.ok(m5.made['xrd-curves'] > m4.made['xrd-curves'], 'a new result: its curves made');
    assert.notDeepEqual(plots1, plots0, 'drawn from the new result');
    // Undone: the result before, its curves kept; redone: the new one's, kept too
    await undo(page);
    await redraw(page);
    assert.deepEqual(await plotSvgs(page, 'xrd'), plots0, 'undone: the plots as before');
    await undo(page, true);
    await redraw(page);
    assert.deepEqual(await plotSvgs(page, 'xrd'), plots1, 'redone: the new result\'s');
    const m6 = await made(page);
    assert.deepEqual(diff(m5.made, m6.made), [], 'undo and redo: nothing made again');
    assert.ok(m6.taken['xrd-curves'] > m5.taken['xrd-curves'], 'taken as kept');
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('DRS woken: every fit kept, a Tauc and an Urbach card, not made again; golden, as before, its CSVs byte for byte; a parameter changed made again, undone taken; a width changed under the loader', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', env.fx.files.tauc);
    await poke(page);
    await page.evaluate(()=> document.fonts.ready);
    await redraw(page);
    assert.deepEqual(golden('tauc', await plotSvgs(page, 'tauc')), [], 'drawn first: the golden hashes');
    await openModule(page, 'gc');
    const m0 = await made(page);
    assert.ok(m0.made['drs-fits'] >= 2, 'each sample fitted');
    await sleepWake(page, 0, 1);
    await toSample(page, 1);
    await redraw(page);
    const m1 = await made(page);
    assert.deepEqual(diff(m0.made, m1.made), [], 'woken: no fit or curve made again');
    assert.ok(m1.taken['drs-fits'] > (m0.taken['drs-fits'] || 0), 'the fits taken as kept');
    assert.deepEqual(golden('tauc', await plotSvgs(page, 'tauc')), [], 'woken: the golden hashes, from what was kept');

    // An Urbach card on the Tauc one: its fits, the subtracted ones from the reference's
    await page.click('#taucAddAn'); await page.click('.an-menu:not([hidden]) [data-kind="urbach"]'); await settle(page);
    // (each sample shown on it)
    await toSample(page, 0); await toSample(page, 1);
    await redraw(page);
    const plots0 = await plotSvgs(page, 'tauc'), csv0 = await csvs(page), m2 = await made(page);
    await sleepWake(page, 0, 1);
    await toSample(page, 1);
    await redraw(page);
    const m3 = await made(page);
    assert.deepEqual(diff(m2.made, m3.made), [], 'woken: nothing made again');
    assert.deepEqual(await plotSvgs(page, 'tauc'), plots0, 'every plot as before it slept');
    assert.deepEqual(await csvs(page), csv0, 'every CSV byte for byte');

    // The Tauc card's exponent: its fits made again, and the Urbach card's subtracted ones
    await page.selectOption('#an1A', '2'); await settle(page);
    await redraw(page);
    const m4 = await made(page), plots1 = await plotSvgs(page, 'tauc');
    assert.ok(m4.made['drs-fits'] >= m3.made['drs-fits'] + 4, 'both cards\' fits made again, each sample\'s');
    assert.notDeepEqual(plots1, plots0);
    await undo(page);
    await redraw(page);
    assert.deepEqual(await plotSvgs(page, 'tauc'), plots0, 'undone: as before');
    assert.deepEqual(await csvs(page), csv0, 'undone: its CSVs byte for byte');
    await undo(page, true);
    await redraw(page);
    assert.deepEqual(await plotSvgs(page, 'tauc'), plots1, 'redone');
    assert.deepEqual(diff(m4.made, (await made(page)).made), [], 'undo and redo: nothing made again');

    // Awake, shown at another width: under the loader, its fits not made again; at the
    // width it was left at, at once
    await switchTab(page, 1);
    await page.setViewportSize({ width: 1180, height: 900 }); await page.waitForTimeout(400);
    const m5 = await made(page);
    await page.locator('#tabBar .ptab').nth(0).locator('.ptab-label').click();
    assert.equal(await page.evaluate(()=> !!document.querySelector('.module-loader.show')), true, 'another width: the loader on first');
    await settle(page);
    assert.deepEqual(diff(m5.made, (await made(page)).made), [], 'drawn again at its width: nothing made again');
    await switchTab(page, 1);
    await page.locator('#tabBar .ptab').nth(0).locator('.ptab-label').click();
    assert.equal(await page.evaluate(()=> !!document.querySelector('.module-loader.show')), false, 'the same width: shown at once');
    await settle(page);
    // Left for Settings, the window changed there, another tab shown, then this one: it was
    // drawn at the width it was left for Settings at, so under the loader (b2v3: the width
    // taken as the other tab was shown, at which it was never drawn: shown at once, drawn
    // in one long task)
    await page.click('#nav button[data-tab="settings"]'); await settle(page);
    await page.setViewportSize({ width: 1400, height: 900 }); await page.waitForTimeout(400);
    await switchTab(page, 1);
    await page.locator('#tabBar .ptab').nth(0).locator('.ptab-label').click();
    assert.equal(await page.evaluate(()=> !!document.querySelector('.module-loader.show')), true, 'changed while Settings was on show: the loader on first');
    await settle(page);
    // Chosen, and Settings clicked before it is shown two frames on: awake at another width
    // (its show deferred, showLater), then asleep (its wake deferred, loadTabIfActive).
    // Settings stays on show, the tab as it was; shown from there, under the loader, nothing
    // made again (b2v3: the tab put back over Settings, the click lost)
    for (const asleep of [false, true]){
      await switchTab(page, 1);
      await page.setViewportSize({ width: asleep ? 1400 : 1180, height: 900 }); await page.waitForTimeout(400);
      if (asleep){ await tick(page, 11*MIN); assert.equal((await tabs(page))[0].awake, false, 'asleep'); }
      const m6 = await made(page);
      assert.equal(await page.evaluate(async ()=>{ const T = await import('./tabs.js'), t = T.TABS[0];
        document.querySelectorAll('#tabBar .ptab')[0].querySelector('.ptab-label').click();
        for (let i = 0; i < 10; i++) await null;   // (switchTo's wait)
        const pending = T.activeTab() === t && (!t.inst || t.hidAt > 0);
        document.querySelector('#nav button[data-tab="settings"]').click();
        return pending; }), true, 'Settings clicked before the tab was shown');
      await page.waitForTimeout(300); await settle(page);
      assert.deepEqual(await page.evaluate(()=> [...document.querySelectorAll('.tab.active')].map(e=> e.id)), ['tab-settings'], 'Settings stays on show');
      assert.equal((await tabs(page))[0].awake, !asleep, 'the tab as it was');
      await page.locator('#tabBar .ptab').nth(0).locator('.ptab-label').click();
      assert.equal(await page.evaluate(()=> !!document.querySelector('.module-loader.show')), true, 'shown from Settings: the loader on first');
      await settle(page);
      assert.deepEqual(await page.evaluate(()=> [...document.querySelectorAll('.tab.active')].map(e=> e.id)), ['tab-tauc'], 'the tab on show');
      assert.deepEqual(diff(m6.made, (await made(page)).made), [], 'nothing made again');
    }
    // From Home, Settings and then the tab clicked before Settings' own hashchange: that
    // echo finds Settings on show already and leaves the tab's deferred show alone (b2v3d:
    // the echo counted as a fixed section chosen anew, the tab's show given up, the click lost)
    await page.click('#nav button[data-tab="home"]'); await settle(page);
    await page.setViewportSize({ width: 1180, height: 900 }); await page.waitForTimeout(400);
    await page.evaluate(()=>{ document.querySelector('#nav button[data-tab="settings"]').click();
      document.querySelectorAll('#tabBar .ptab')[0].querySelector('.ptab-label').click(); });
    await page.waitForTimeout(800); await settle(page);
    assert.deepEqual(await page.evaluate(()=> [...document.querySelectorAll('.tab.active')].map(e=> e.id)), ['tab-tauc'], 'the tab clicked after Settings is on show');
    assert.equal(await page.evaluate(()=> document.querySelectorAll('#tabBar .ptab')[0].classList.contains('is-on')), true, 'its label on');
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('GC, EPR and SEM woken: their tables, smoothing, thumbnails and cards kept, not made again; GC\'s and EPR\'s plots golden, their CSVs byte for byte', async ()=>{
  const { page, ctx, errors, csp, close } = await env.page();
  try {
    for (const mod of ['gc', 'epr']){
      await openModule(page, mod);
      await loadFiles(page, mod, env.fx.files[mod]);
      await poke(page);
      await page.evaluate(()=> document.fonts.ready);
      await redraw(page);
      assert.deepEqual(golden(mod, await plotSvgs(page, mod)), [], `${mod}: the golden hashes`);
    }
    const csvG = (await switchTab(page, 0), await csvs(page)), csvE = (await switchTab(page, 1), await csvs(page));
    await page.click('#nav button[data-tab="home"]'); await page.click('.home-card[data-go="sem"]');
    await page.waitForFunction(()=> !!document.querySelector('#tab-sem.active')); await settle(page);
    await drop(page, 'sem', env.fx.files.sem);
    const m0 = await made(page);
    assert.ok(m0.made['gc-tables'] >= 2 && m0.made['epr-smoothed'] >= 2, 'each made once');
    for (const [i, mod, csv] of [[0, 'gc', csvG], [1, 'epr', csvE]]){
      await sleepWake(page, i, 2);
      await redraw(page);
      assert.deepEqual(golden(mod, await plotSvgs(page, mod)), [], `${mod} woken: the golden hashes`);
      assert.deepEqual(await csvs(page), csv, `${mod} woken: its CSVs byte for byte`);
    }
    // SEM asleep: its bytes let go once its record is written, its files' arrays collected
    // (a forced GC: WeakRefs to them emptied), what they were made into kept for it
    await page.evaluate(async ()=>{ const T = await import('./tabs.js'), u = await import('./utils.js');
      window.__T = T; window.__D = await import('./db.js'); window.__w = u.getModuleState(T.TABS[2].id).files.map(f=> new WeakRef(f.raw.bytes)); });
    await switchTab(page, 0);
    await tick(page, 11*MIN);
    await page.waitForFunction(()=>{ const t = window.__T.TABS[2]; return !t.inst && window.__D.unread(t.state); }, null, { timeout: 20000 });
    const cdp = await ctx.newCDPSession(page);
    for (let k = 0; k < 3; k++){ await cdp.send('HeapProfiler.collectGarbage'); await page.waitForTimeout(200); }
    assert.deepEqual(await page.evaluate(()=> window.__w.map(w=> !!w.deref())), [false, false, false], 'its files\' bytes let go');
    await page.locator('#tabBar .ptab').nth(2).locator('.ptab-label').click();
    await settle(page);
    await page.waitForFunction(()=> document.querySelectorAll('#semThumbs .sem-thumb canvas').length >= 3, null, { timeout: 20000 });
    await settle(page);
    const m1 = await made(page);
    assert.deepEqual(diff(m0.made, m1.made), [], 'woken: no table, smoothing, thumbnail or card made again');
    // A crop of another width: its group's cards made; undone, redone, undone, taken as kept
    // (b2v3: a file's last card alone, made again by each)
    await page.click('#semCropDef'); await settle(page);
    await page.fill('#semCropW', '128'); await page.press('#semCropW', 'Enter'); await settle(page);
    const m2 = await made(page);
    assert.ok((m2.made['sem-card'] || 0) > (m1.made['sem-card'] || 0), 'the new crop\'s cards made');
    for (const redo of [false, true, false]) await undo(page, redo);
    assert.deepEqual(diff(m2.made, (await made(page)).made), [], 'undo and redo: no card made again');
    // The same files read again in another tab: what was made of them added to, not taken
    // for the reading's; back, redone, the crop's cards taken (b2v3: made again)
    await openModule(page, 'sem');
    await drop(page, 'sem', env.fx.files.sem);
    await switchTab(page, 2);
    const m3 = await made(page);
    await undo(page, true);
    assert.deepEqual(diff(m3.made, (await made(page)).made), [], 'read again in another tab, then redone: no card made again');
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('a project written to a file, from its bar and from Projects: under the loader, a frame drawn first', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await page.click('#nav button[data-tab="home"]'); await page.click('.home-card[data-go="sem"]');
    await page.waitForFunction(()=> !!document.querySelector('#tab-sem.active')); await settle(page);
    // (two images of 2048² at 16 bits: written as base64 in a task of some 0.3 s)
    await drop(page, 'sem', [1, 2].map(k=> env.fx.put(`big${k}.tif`, makeTiff({ sign: 'B' + k, seed: k, bits: 16, W: 2048, H: 2058 }))));
    await saveAs(page, 'big'); await settle(page);
    // Every long task from now, the loader's changes, the frames drawn
    const watch = ()=> page.evaluate(()=>{
      const ev = window.__ev = [], on = ()=> !!document.querySelector('.module-loader.show');
      if (!window.__obs){
        window.__obs = new PerformanceObserver(l=> l.getEntries().forEach(e=> window.__ev.push(['task', e.startTime, e.startTime + e.duration])));
        window.__obs.observe({ type: 'longtask' });
        let was = on();
        new MutationObserver(()=>{ if (on() !== was){ was = on(); window.__ev.push([was ? 'on' : 'off', performance.now()]); } })
          .observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
        (function f(t){ if (t) window.__ev.push(['frame', performance.now()]); requestAnimationFrame(f); })();
      }
      ev.length = 0;
    });
    const check = async what =>{
      const ev = await page.evaluate(()=> window.__ev), tasks = ev.filter(e=> e[0] === 'task' && e[2] - e[1] > 100);
      assert.ok(tasks.length, what + ': its long task');
      for (const [, start] of tasks){
        const last = ev.filter(e=> (e[0] === 'on' || e[0] === 'off') && e[1] < start).pop();
        assert.equal(last && last[0], 'on', what + ': the loader on before its long task');
        assert.ok(ev.some(e=> e[0] === 'frame' && e[1] > last[1] && e[1] < start), what + ': a frame drawn between');
      }
      assert.equal(await page.evaluate(()=> !!document.querySelector('.module-loader.show')), false, what + ': the loader off after');
    };
    await watch();
    const a = await download(page, ()=> page.click('.proj-json'));
    await settle(page);
    await check('from its bar');
    await page.click('#nav button[data-tab="projects"]'); await settle(page);
    await watch();
    const b = await download(page, ()=> page.click('#tab-projects .pr-json'));
    await page.waitForFunction(()=> !document.querySelector('.module-loader.show'));
    await check('from Projects');
    assert.equal(JSON.parse(b.buf.toString('utf8')).state.files.length, 2);
    assert.ok(a.buf.length > 20e6, 'the bytes in it');
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});
