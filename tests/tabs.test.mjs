/* Tabs: closing an inactive tab with "Save" saves that tab's project; the unsaved marker
   follows the state across a switch, an undo and a reload; a running job (a busy guard
   registered by hand), holding no mark of the history, leaves undo doing nothing,
   silently, goes on in its tab left (b2: GC made per tab), which never sleeps while it
   runs, and is asked about before its tab is closed. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, saveAs, switchTab, tabLabels, activeLabel, undo, banner, answer, idb, settle, ready, moduleState } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

// Two saved GC projects, Alpha and Beta, Beta on show.
async function twoGc(page){
  await openModule(page, 'gc'); await loadFiles(page, 'gc', [env.fx.files.gc[0]]); await saveAs(page, 'Alpha');
  await openModule(page, 'gc'); await loadFiles(page, 'gc', [env.fx.files.gc[1]]); await saveAs(page, 'Beta');
}
const label = page => page.locator('#gcFileTableWrap .file-label').first();
async function relabel(page, v){ await label(page).fill(v); await label(page).press('Enter'); await settle(page); }

test('closing an inactive tab with unsaved changes, answering Save, saves that tab', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await twoGc(page);
    await switchTab(page, 0);
    await relabel(page, 'alpha-edited');
    await switchTab(page, 1);
    assert.deepEqual(await tabLabels(page), ['GC · Alpha*', 'GC · Beta']);
    await page.locator('#tabBar .ptab').nth(0).locator('.ptab-x').click();
    assert.match((await banner(page)).text, /Save “Alpha” before closing/);
    await answer(page, 'ok');
    await page.waitForFunction(()=> document.querySelectorAll('#tabBar .ptab').length === 1);
    assert.deepEqual(await tabLabels(page), ['GC · Beta']);
    const recs = await idb(page);
    const files = Object.fromEntries(recs.map(r=> [r.title, r.state.files.map(f=> f.name + '/' + f.label)]));
    assert.deepEqual(files, { Alpha: ['alpha.csv/alpha-edited'], Beta: ['beta.csv/beta'] });
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('the unsaved marker: an edit after a switch marks it, its undo clears it, a reload keeps it clear', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await twoGc(page);
    await switchTab(page, 0);
    assert.deepEqual(await tabLabels(page), ['GC · Alpha', 'GC · Beta']);
    await relabel(page, 'changed');
    assert.deepEqual(await tabLabels(page), ['GC · Alpha*', 'GC · Beta']);
    await undo(page);
    assert.equal(await label(page).inputValue(), 'alpha');
    assert.deepEqual(await tabLabels(page), ['GC · Alpha', 'GC · Beta']);
    await page.reload(); await ready(page); await settle(page);
    assert.deepEqual(await tabLabels(page), ['GC · Alpha', 'GC · Beta']);
    // and the same through a redo and a value set back by hand
    await undo(page, true);
    await relabel(page, 'changed again');
    assert.deepEqual(await tabLabels(page), ['GC · Alpha*', 'GC · Beta']);
    await relabel(page, 'alpha');
    assert.deepEqual(await tabLabels(page), ['GC · Alpha', 'GC · Beta']);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a running job: undo does nothing, its tab left goes on and stays awake (b2), closing it asks, Stop it and close stops it', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    for (const f of env.fx.files.gc){ await openModule(page, 'gc'); await loadFiles(page, 'gc', [f]); }
    // A job of the second GC tab's instance, registered by hand by its key (the tab's id):
    // running while window.__running.
    const job = i => page.evaluate(async i=>{
      const u = await import('./utils.js'), key = (await import('./tabs.js')).TABS[i].id;
      window.__running = true; window.__stops = window.__stops || 0;
      u.registerBusy(key, { busy: ()=> window.__running ? 'A test job' : null, stop: ()=>{ window.__running = false; window.__stops++; } });
      u.busyChanged(key);
    }, i);
    await job(1);
    const stops = ()=> page.evaluate(()=> window.__stops);
    const awake = ()=> page.evaluate(async ()=> (await import('./tabs.js')).tabsNow().map(t=> t.awake));
    // 1) undo while it runs: nothing undone (the files' load, the step before), nothing said
    // (a job that holds no mark of the history; to v508 a banner said undo waited)
    await page.evaluate(()=> document.activeElement && document.activeElement.blur());
    const files = (await moduleState(page, 'gc')).files.map(f=> f.name);
    assert.equal(files.length, 1);
    await page.keyboard.press('Control+z');
    await settle(page);
    assert.equal(await banner(page), null, 'no banner');
    assert.equal(await page.locator('.confirm-modal').count(), 0, 'no question either');
    assert.deepEqual((await moduleState(page, 'gc')).files.map(f=> f.name), files, 'nothing undone');
    // 2) another tab chosen: nothing asked, the job going on in the tab left (b2: each GC
    // tab an instance of its own; to b2 leaving asked to stop it)
    await switchTab(page, 0);
    assert.equal(await banner(page), null, 'nothing asked');
    assert.equal(await activeLabel(page), 'GC · Untitled project*'); assert.equal(await stops(), 0);
    // 3) hidden past Settings' minutes while it runs: awake
    await page.evaluate(async ()=> (await import('./tabs.js')).sleepTick(Date.now() + 11*60e3));
    assert.deepEqual(await awake(), [true, true], 'a busy tab never sleeps');
    // 4) closed: asked; × keeps it; Stop it and close, then asked to save it (Don't save),
    // closes it and stops its job
    await page.locator('#tabBar .ptab').nth(1).locator('.ptab-x').click();
    const b = await page.waitForSelector('.pwa-confirm.show').then(()=> banner(page));
    assert.match(b.text, /A test job is running in “Untitled project 2”: closing this tab stops it/);
    assert.ok(b.buttons.includes('Stop it and close'));
    await answer(page, 'x');
    assert.equal((await tabLabels(page)).length, 2); assert.equal(await stops(), 0);
    // (the question to save follows at once, shown a frame later: waited for by its words,
    // not by no banner being on show, which that frame may already have ended)
    await page.locator('#tabBar .ptab').nth(1).locator('.ptab-x').click();
    await page.click('.pwa-confirm.show .btn.primary');
    await page.waitForFunction(()=> /Save “Untitled project 2” before closing/.test((document.querySelector('.pwa-confirm.show span') || {}).textContent || ''));
    await answer(page, 'alt');
    assert.deepEqual(await tabLabels(page), ['GC · Untitled project*']);
    assert.equal(await stops(), 1);
    // 5) running in the tab on show, a new project asked for: nothing asked, it opens on show
    await job(0);
    await page.click('#nav button[data-tab="home"]'); await page.click('.home-card[data-go="tauc"]');
    await page.waitForSelector('#tab-tauc.active'); await settle(page);
    assert.equal(await banner(page), null, 'nothing asked');
    assert.deepEqual(await tabLabels(page), ['GC · Untitled project*', 'UV-Vis DRS · Untitled project']);
    assert.equal(await activeLabel(page), 'UV-Vis DRS · Untitled project');
    assert.equal(await stops(), 1);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
