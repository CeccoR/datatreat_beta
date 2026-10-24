/* Opening a tab, today's against live tabs (where it is a frame's boot: the app's page
   loaded again, its module graph, then the tab's record read and restored).
   blank: a blank project of each module from the Home cards, REPS each, from the click
     (dispatched in the page) to two frames in the realm that shows it once its loader is
     gone; then the tab closed.
   saved: a saved project (XRPD 12 patterns refined; SEM 8 images) opened from the Projects
     list (into the bar) and then shown (timed as a switch: HEAD's restore, a frame's boot and
     restore), REPS each, closed again after each.
   rewake (live): a tab whose frame was let go (hibernate: its state written, the frame
     removed) shown again, REPS each for the XRPD and the SEM tab; and the memory before and
     after both frames are let go.
   node open.mjs <head|live> [reps, default 5] → results/open-<mode>.json */
import { launch, addTab, timedSwitch, twoFrames, longTasks, med, r1, save, load, sleep } from './lib.mjs';
const [mode = 'live', reps = '5'] = process.argv.slice(2);
const env = await launch(mode);
const { app, page, mem } = env;
await app.goto();
const out = { mode, blank: {}, saved: {}, rewake: {} };
// (a tab with unsaved work asks first, in the page or in its frame: "Don't save")
const closeTab = async i =>{
  const n = await app.count();
  await page.locator('#tabBar .ptab').nth(i).locator('.ptab-x').click();
  for (let k = 0; k < 100 && await app.count() >= n; k++){
    for (const f of page.frames()){ const b = await f.$('.pwa-confirm.show .btn:not(.primary)').catch(()=> null); if (b){ await b.click().catch(()=>{}); break; } }
    await sleep(100);
  }
  await page.waitForFunction(n=> document.querySelectorAll('#tabBar .ptab').length < n, n);
  await sleep(300);
};

// blank
for (const mod of ['xrd', 'tauc', 'gc', 'epr', 'sem']){
  const ms = [], lt = [];
  for (let r = 0; r < +reps; r++){
    await page.click('#nav button[data-tab="home"]');
    await sleep(300);
    const n = await app.count();
    let t0, t1;
    if (!app.live){
      ({ t0, t1 } = await page.evaluate(mod=> new Promise(res=>{ const t0 = window.__now(); document.querySelector(`.home-card[data-go="${mod}"]`).click();
        const loop = ()=>{ if (!document.querySelector(`#tab-${mod}.active`) || document.querySelector('.module-loader.show')) return requestAnimationFrame(loop); requestAnimationFrame(()=> requestAnimationFrame(()=> res({ t0, t1: window.__now() }))); };
        requestAnimationFrame(loop); }), mod));
    } else {
      t0 = await page.evaluate(mod=>{ const t0 = window.__now(); document.querySelector(`.home-card[data-go="${mod}"]`).click(); return t0; }, mod);
      await page.waitForFunction(n=> document.querySelectorAll('#tabBar .ptab').length > n, n);
      const f = await app.frame(n);
      t1 = await twoFrames(f);
    }
    ms.push(t1 - t0); lt.push((await longTasks(page, t0, t1)).ms);
    await sleep(300);
    await closeTab(n);
  }
  out.blank[mod] = { med: r1(med(ms)), raw: ms.map(r1), longMsMed: med(lt) };
  console.log(mode, 'blank', mod, out.blank[mod].med, 'ms; long tasks med', out.blank[mod].longMsMed);
}

// saved
async function saveAs(i, name){
  const s = await app.show(i);
  await s.fill('.project-name-input', name);
  await s.click('.proj-save');
  await s.waitForSelector('.proj-save.is-saved');
}
await addTab(app, 'xrd'); await saveAs(0, 'X12');
await addTab(app, 'sem'); await saveAs(1, 'S8');
await addTab(app, 'drs');
await closeTab(1); await closeTab(0);          // the DRS tab alone left, on show
for (const [name, kind] of [['X12', 'xrd'], ['S8', 'sem']]){
  const ms = [], lt = [];
  for (let r = 0; r < +reps; r++){
    await page.click('#nav button[data-tab="projects"]');
    await page.waitForSelector('#sessListWrap tr.sess-row');
    const n = await app.count();
    const row = page.locator('#sessListWrap tr.sess-row').filter({ has: page.locator(`input.proj-rename[value="${name}"]`) });
    await row.first().locator('td').nth(3).click();
    await page.waitForFunction(n=> document.querySelectorAll('#tabBar .ptab').length > n, n);
    await sleep(500);
    const t = await timedSwitch(app, n);
    ms.push(t.ms); lt.push((await longTasks(page, t.t0, t.t1)).ms);
    await sleep(500);
    await closeTab(n);
    await sleep(500);
  }
  out.saved[kind] = { med: r1(med(ms)), raw: ms.map(r1), longMsMed: med(lt) };
  console.log(mode, 'saved', kind, out.saved[kind].med, 'ms; long tasks med', out.saved[kind].longMsMed);
}

// rewake (live): XRPD and SEM tabs, their frames let go and shown again
if (app.live){
  await closeTab(0);
  await addTab(app, 'xrd'); await addTab(app, 'sem'); await addTab(app, 'drs');
  await sleep(1500);
  const before = await mem();
  const hib = i => page.evaluate(async i=>{ const m = await import('./tabs.js'); return m.hibernate(m.TABS[i]); }, i);
  if (!await hib(0) || !await hib(1)) throw new Error('a frame not let go');
  await sleep(1500);
  const after = await mem();
  out.rewake.mem = { before: { heap: r1(before.heap), rss: r1(before.renderer.rss), pss: r1(before.renderer.pss), workers: before.workers },
                     after: { heap: r1(after.heap), rss: r1(after.renderer.rss), pss: r1(after.renderer.pss), workers: after.workers } };
  console.log('rewake mem', JSON.stringify(out.rewake.mem));
  for (const [i, kind] of [[0, 'xrd'], [1, 'sem']]){
    const ms = [];
    for (let r = 0; r < +reps; r++){
      await app.show(2); await sleep(300);
      await hib(i);
      await sleep(500);
      if (await page.locator(`.live-frames iframe[src*="embed=${await app.idOf(i)}"]`).count()) throw new Error('not let go');
      const t = await timedSwitch(app, i);
      if (!t.made) throw new Error('the frame was there');
      ms.push(t.ms);
      await sleep(800);
    }
    out.rewake[kind] = { med: r1(med(ms)), raw: ms.map(r1) };
    console.log('rewake', kind, out.rewake[kind].med);
  }
}
out.errors = env.errors; out.load = load();
console.log('errors', env.errors);
save(`open-${mode}.json`, out);
await env.close();
