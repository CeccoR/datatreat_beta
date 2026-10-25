/* The tabs awake, capped (b2v3): any number of tabs open, none refused (to b2v2 a 21st was);
   at most Settings' number awake (20 by default), the one on show among them, the one
   shown least lately put to sleep beyond it, whenever it was opened: one opened first but
   shown often stays awake. 40 tabs: 20 awake, the bar scrolling, the tab on show scrolled
   into it, the wheel along it; a reload, all back, the one on show awake. A busy tab stays
   awake past the cap, the one shown least lately among the others sleeping in its place;
   all the others busy or asleep, the count over the cap until its job ends, the excess then
   asleep. Settings' number changed: applied at once. Projects' Open selected, 25 at once:
   all opened, asleep. Two tabs chosen within a switch's frames: one record on show, the
   last chosen, as a reload shows; the first, never drawn at the window's width, shown
   under the loader. The workers' answers held where a run must go on
   (window.__hold). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, switchTab, settle, until, banner, ready, idb, MODS } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const tabs = page => page.evaluate(async ()=> (await import('./tabs.js')).tabsNow());
const awakeAt = async page => (await tabs(page)).flatMap((t, i)=> t.awake ? [i] : []);
// (the tabs asleep, each shown last before every hidden one awake was: the LRU)
const lru = async page =>{ const t = (await tabs(page)).filter(x=> !x.shown), a = t.filter(x=> x.awake), s = t.filter(x=> !x.awake && x.seenAt);
  return !a.length || !s.length || Math.max(...s.map(x=> x.seenAt)) <= Math.min(...a.map(x=> x.seenAt)); };
// The tab on show within the strip's box.
const inView = page => page.evaluate(()=>{ const b = document.getElementById('tabBar').getBoundingClientRect(), r = document.querySelector('#tabBar .ptab.is-on').getBoundingClientRect();
  return r.left >= b.left - 1 && r.right <= b.right + 1; });
const holdWorkers = page => page.evaluate(()=>{
  const W = window.Worker; window.__held = []; window.__hold = false;
  const wrap = fn => e=>{ if (window.__hold && e.data && e.data.type === 'result') window.__held.push(()=> fn(e)); else fn(e); };
  window.Worker = class extends W {
    addEventListener(t, fn, o){ if (t !== 'message') return super.addEventListener(t, fn, o); const g = wrap(fn); (this.__m || (this.__m = new Map())).set(fn, g); return super.addEventListener(t, g, o); }
    removeEventListener(t, fn, o){ return super.removeEventListener(t, (t === 'message' && this.__m && this.__m.get(fn)) || fn, o); }
  };
  window.__release = ()=>{ window.__hold = false; window.__held.splice(0).forEach(f=> f()); };
});
async function setAwake(page, n){
  await page.click('#nav button[data-tab="settings"]');
  await page.fill('#settingAwakeMax', String(n)); await page.press('#settingAwakeMax', 'Enter');
  await settle(page);
}

test('40 tabs: none refused, 20 awake, the one shown least lately asleep beyond them, one shown often staying awake; the bar scrolls, the tab on show in view; a reload', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    for (let i = 0; i < 40; i++) await openModule(page, MODS[i % 5]);
    assert.equal(await banner(page), null, 'nothing refused');
    assert.equal((await tabs(page)).length, 40);
    assert.deepEqual(await awakeAt(page), Array.from({ length: 20 }, (_, i)=> 20 + i), 'the 20 shown last awake, the one on show among them');
    // The first tab shown often: awake throughout, whatever else is woken.
    for (let i = 1; i <= 10; i++){
      await switchTab(page, 0);
      await switchTab(page, i);
      const a = await awakeAt(page);
      assert.ok(a.includes(0) && a.includes(i) && a.length === 20, `step ${i}: ${a}`);
      assert.ok(await lru(page), `step ${i}: those asleep shown less lately than those awake`);
    }
    // The strip: wider than its box; the tab on show scrolled into it, wherever it is.
    assert.ok(await page.evaluate(()=>{ const b = document.getElementById('tabBar'); return b.scrollWidth > 3*b.clientWidth; }));
    await page.evaluate(async ()=>{ const T = await import('./tabs.js'); T.activateTab(T.TABS[39].id); });
    await settle(page);
    assert.ok(await inView(page), 'the last tab in view');
    await page.evaluate(async ()=>{ const T = await import('./tabs.js'); T.activateTab(T.TABS[0].id); });
    await settle(page);
    assert.ok(await inView(page), 'the first tab in view');
    // The wheel scrolls it sideways; a new tab, at its end, is scrolled into view.
    const box = await page.locator('#tabBar').boundingBox();
    await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
    const x0 = await page.evaluate(()=> document.getElementById('tabBar').scrollLeft);
    await page.mouse.wheel(0, 400);
    await until(async ()=> (await page.evaluate(()=> document.getElementById('tabBar').scrollLeft)) > x0, { what: 'the strip scrolled by the wheel' });
    await page.evaluate(()=>{ document.getElementById('tabBar').scrollLeft = 0; });
    await openModule(page, 'gc');
    assert.ok(await inView(page), 'the 41st tab in view');
    assert.equal((await awakeAt(page)).length, 20);
    // A reload: every tab back, the one on show awake.
    await page.reload(); await ready(page); await settle(page);
    const t = await tabs(page);
    assert.equal(t.length, 41);
    assert.deepEqual(t.flatMap((x, i)=> x.awake ? [i] : []), [40]);
    assert.ok(await inView(page), 'the tab on show in view after the reload');
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('a busy tab awake past the cap, the excess asleep at its job\'s end; Settings\' number applied at once; Projects\' Open selected: 25 opened, asleep', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    // 25 saved GC projects, blank, put in the store; the list read at the reload.
    await openModule(page, 'gc');
    await page.evaluate(async ()=>{
      const u = await import('./utils.js'), db = await import('./db.js'), st = db.park(u.getModuleState('gc')), at = Date.now();
      for (let i = 0; i < 25; i++) await db.putProject({ id: 'p' + i, module: 'gc', title: 'P' + i, state: st, createdAt: at, updatedAt: at });
    });
    await page.reload(); await ready(page); await settle(page);
    await holdWorkers(page);
    // Tab 1: XRPD refining, its results held; then 20 tabs more, shown in turn.
    await openModule(page, 'xrd'); await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 2));
    await page.setInputFiles('#xrdR2CifInput', env.fx.cif);
    await page.waitForSelector('#xrdR2PhaseList input[data-on]');
    await settle(page);
    await page.evaluate(()=>{ window.__hold = true; });
    await page.waitForTimeout(650); await page.click('#xrdR2RefineAll');
    await page.waitForSelector('.confirm-modal'); await page.click('.confirm-modal .btn:not(.primary)');
    await page.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel');
    for (let i = 0; i < 20; i++) await openModule(page, MODS[i % 5]);
    assert.equal((await tabs(page))[1].busy, true);
    // Tab 1, shown least lately, busy: awake; tab 0 and tab 2, the next least lately, asleep.
    let a = await awakeAt(page);
    assert.equal(a.length, 20);
    assert.ok(a.includes(1) && !a.includes(0) && !a.includes(2), String(a));
    // Settings: 5 awake, at once.
    await setAwake(page, 5);
    assert.deepEqual(await awakeAt(page), [1, 18, 19, 20, 21]);
    // 1: the tab on show alone, but the busy one stays awake, over the cap, till its job ends.
    await setAwake(page, 1);
    assert.deepEqual(await awakeAt(page), [1, 21]);
    await page.evaluate(()=> window.__release());
    await until(async ()=> !(await tabs(page))[1].busy, { timeout: 120000, what: 'the run\'s end' });
    await until(async ()=> (await awakeAt(page)).join() === '21', { what: 'the excess asleep at the job\'s end' });
    // Projects: all 25 opened at once from the list, in the background, asleep; none refused.
    await setAwake(page, 20);
    await page.click('#nav button[data-tab="projects"]');
    for (const c of await page.locator('#sessListWrap .sess-check').all()) await c.click();
    await page.click('#sessOpenSelected');
    await until(async ()=> (await tabs(page)).length === 47, { what: '25 tabs more' });
    assert.equal(await banner(page), null, 'nothing refused');
    assert.ok(await page.locator('#tab-projects.active').count(), 'still on the list');
    assert.deepEqual(await awakeAt(page), [21], 'the projects opened asleep');
    await switchTab(page, 46);
    assert.deepEqual(await awakeAt(page), [21, 46]);
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('two tabs chosen within a switch\'s frames: the record of the tab left first no longer on show, a reload showing the last chosen; the first shown under the loader', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    for (let i = 0; i < 3; i++) await openModule(page, 'gc');
    await switchTab(page, 1); await switchTab(page, 0);
    // T1 and T2 left at another width: T1 shown two frames on, under the loader (tabs.js
    // showLater), and T2 chosen within them, in the same task
    await page.setViewportSize({ width: 1200, height: 900 }); await page.waitForTimeout(300);
    await page.evaluate(()=>{ const t = document.querySelectorAll('#tabBar .ptab'); t[1].click(); t[2].click(); });
    await settle(page);
    const flags = async ()=> (await idb(page, 'tabs')).sort((a, b)=> a.order - b.order).map(r=> r.active);
    await until(async ()=> JSON.stringify(await flags(page)) === '[false,false,true]', { what: 'one record on show, T2\'s' });
    // T1, chosen and left again before its show, still drawn at the width it was left at
    // before: shown, under the loader (b2v3: the width of that moment taken for it, at which
    // it was never drawn: shown at once, every plot drawn in one long task)
    await page.locator('#tabBar .ptab').nth(1).locator('.ptab-label').click();
    assert.equal(await page.evaluate(()=> !!document.querySelector('.module-loader.show')), true, 'T1 shown: the loader on first');
    await settle(page);
    await switchTab(page, 2);
    await until(async ()=> JSON.stringify(await flags(page)) === '[false,false,true]', { what: 'T2\'s record on show again' });
    await page.reload(); await ready(page); await settle(page);
    assert.equal(await page.evaluate(()=> [...document.querySelectorAll('#tabBar .ptab')].findIndex(e=> e.classList.contains('is-on'))), 2, 'T2 on show after a reload');
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});
