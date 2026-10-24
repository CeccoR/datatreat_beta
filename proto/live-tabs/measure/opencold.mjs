/* Opening a saved project with nothing of it in memory: the app reloaded before each open
   (today's decoded-image cache empty, as after a restart; a live tab's frame always starts
   empty), then the project opened from the Projects list and shown, timed as in open.mjs
   (lib.mjs timedSwitch). XRPD (12 patterns, refined) and SEM (8 images), REPS each.
   node opencold.mjs <head|live> [reps, default 5] → results/opencold-<mode>.json */
import { launch, addTab, timedSwitch, med, r1, save, load, sleep } from './lib.mjs';
const [mode = 'live', reps = '5'] = process.argv.slice(2);
const env = await launch(mode);
const { app, page } = env;
await app.goto();
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
async function saveAs(i, name){
  const s = await app.show(i);
  await s.fill('.project-name-input', name);
  await s.click('.proj-save');
  await s.waitForSelector('.proj-save.is-saved');
}
await addTab(app, 'xrd'); await saveAs(0, 'X12');
await addTab(app, 'sem'); await saveAs(1, 'S8');
await addTab(app, 'drs');
await closeTab(1); await closeTab(0);
await sleep(6000);
const out = { mode, saved: {} };
for (const [name, kind] of [['X12', 'xrd'], ['S8', 'sem']]){
  const ms = [];
  for (let r = 0; r < +reps; r++){
    await page.reload();
    await page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab'), null, { timeout: 60000 });
    if (!app.live) await app.settle(page); else await app.frame(0);
    await sleep(1500);
    await page.click('#nav button[data-tab="projects"]');
    await page.waitForSelector('#sessListWrap tr.sess-row');
    const n = await app.count();
    const row = page.locator('#sessListWrap tr.sess-row').filter({ has: page.locator(`input.proj-rename[value="${name}"]`) });
    await row.first().locator('td').nth(3).click();
    await page.waitForFunction(n=> document.querySelectorAll('#tabBar .ptab').length > n, n);
    await sleep(800);
    const t = await timedSwitch(app, n);
    ms.push(t.ms);
    await sleep(500);
    await closeTab(n);
    await sleep(500);
  }
  out.saved[kind] = { med: r1(med(ms)), raw: ms.map(r1) };
  console.log(mode, 'cold saved', kind, out.saved[kind].med, JSON.stringify(out.saved[kind].raw));
}
out.errors = env.errors; out.load = load();
console.log('errors', env.errors);
save(`opencold-${mode}.json`, out);
await env.close();
