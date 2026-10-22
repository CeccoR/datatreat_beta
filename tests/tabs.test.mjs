/* Tabs: closing an inactive tab with "Save" saves that tab's project; the unsaved marker
   follows the state across a switch, an undo and a reload; a running job (a busy guard
   registered by hand) is asked about before its tab is left, and, holding no mark of the
   history, leaves undo doing nothing, silently. */
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

test('a running job: leaving its tab asks, undo does nothing, Stop it and leave stops it', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    for (const f of env.fx.files.gc){ await openModule(page, 'gc'); await loadFiles(page, 'gc', [f]); }
    // A job of the GC module, registered by hand: running while window.__running.
    await page.evaluate(async ()=>{
      const u = await import('./utils.js'); window.__running = true; window.__stops = 0;
      u.registerBusy('gc', { busy: ()=> window.__running ? 'A test job' : null, stop: ()=>{ window.__running = false; window.__stops++; } });
    });
    const stops = ()=> page.evaluate(()=> window.__stops);
    // 1) another tab chosen: asked; × stays
    await page.locator('#tabBar .ptab').nth(0).locator('.ptab-label').click();
    const b = await page.waitForSelector('.pwa-confirm.show').then(()=> banner(page));
    assert.match(b.text, /A test job is running in “Untitled project 2”: leaving this tab stops it/);
    assert.ok(b.buttons.includes('Stop it and leave'));
    await answer(page, 'x');
    assert.equal(await activeLabel(page), 'GC · Untitled project 2*'); assert.equal(await stops(), 0);
    // 2) undo while it runs: nothing undone (the files' load, the step before), nothing said
    // (a job that holds no mark of the history; to v508 a banner said undo waited)
    await page.evaluate(()=> document.activeElement && document.activeElement.blur());
    const files = (await moduleState(page, 'gc')).files.map(f=> f.name);
    assert.equal(files.length, 1);
    await page.keyboard.press('Control+z');
    await settle(page);
    assert.equal(await banner(page), null, 'no banner');
    assert.equal(await page.locator('.confirm-modal').count(), 0, 'no question either');
    assert.deepEqual((await moduleState(page, 'gc')).files.map(f=> f.name), files, 'nothing undone');
    // 3) another tab chosen: Stop it and leave
    await page.locator('#tabBar .ptab').nth(0).locator('.ptab-label').click();
    await answer(page, 'ok');
    assert.equal(await activeLabel(page), 'GC · Untitled project*'); assert.equal(await stops(), 1);
    // 4) nothing running: a switch asks nothing
    await switchTab(page, 1);
    assert.equal(await activeLabel(page), 'GC · Untitled project 2*'); assert.equal(await banner(page), null);
    // 5) running again, a new project asked for: asked; × opens it beside, not on show
    await page.evaluate(()=>{ window.__running = true; });
    await page.click('#nav button[data-tab="home"]'); await page.click('.home-card[data-go="tauc"]');
    await page.waitForSelector('.pwa-confirm.show');
    await answer(page, 'x');
    assert.deepEqual(await tabLabels(page), ['GC · Untitled project*', 'GC · Untitled project 2*', 'UV-Vis DRS · Untitled project']);
    assert.equal(await activeLabel(page), null, 'a project tab on show, not Home');
    assert.equal(await stops(), 1);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
