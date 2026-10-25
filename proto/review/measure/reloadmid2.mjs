/* A reload while Refine all runs in a tab not on show (live: a hidden frame; bg: parked):
   how many of the results written before the reload come back. Each round: Clear all, Refine
   all, the DRS tab shown, the results counted in the run's realm once 4+ are in (live) or in
   the parked state (bg), the page reloaded 300 ms later, the XRPD tab shown, its results
   counted. node reloadmid.mjs <tree> [rounds=3] */
import { launch, xrdTab, plainTab, show, realm, startRefine, sleep, save, DRS } from './rlib.mjs';
const [tree, rounds = '3'] = process.argv.slice(2);
const env = await launch(tree);
const page = env.page;
const A = await xrdTab(env), B = await plainTab(env, 'tauc', DRS);
const count = s => s.evaluate(async ()=>{ const u = await import('./utils.js'); const st = u.getModuleState('xrd'); const c = st && st.cards.find(c=> c.id === 2); return Object.keys((c && c.states.rietveld.results) || {}).length; });
const out = [];
for (let r = 0; r < +rounds; r++){
  let s = await show(env, A); await sleep(400);
  // Clear all on card 2 first, so that the count starts at 0
  await s.evaluate(()=>{ const b = document.querySelector('#xrdR2ClearAll') || [...document.querySelectorAll('#tab-xrd button')].find(b=> /clear all/i.test(b.textContent)); if (b) b.click(); });
  await sleep(300);
  const c = await s.$('.confirm-modal .btn.primary, .pwa-confirm.show .btn.primary'); if (c) await c.click();
  await sleep(500);
  const n0 = await count(s);
  await startRefine(s);
  if (!process.env.STAY) await page.locator('#tabBar .ptab').nth(B).locator('.ptab-label').click();
  let before = 0;
  for (let w = 0; w < 200; w++){
    before = tree === 'bg' ? await page.evaluate(async ()=>{ const T = await import('./tabs.js'), db = await import('./db.js'); const t = T.TABS[0]; const st = db.decode(t.state); const c = st.cards.find(c=> c.id === 2); return Object.keys(c.states.rietveld.results || {}).length; })
                           : await count(s);
    if (before >= 4) break; await sleep(50);
  }
  await sleep(300);
  await page.reload();
  await page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab'), null, { timeout: 60000 });
  s = await show(env, A); await sleep(800);
  const after = await count(s);
  const dirty = await page.locator('#tabBar .ptab').nth(A).textContent();
  out.push({ n0, before, after, label: dirty });
  console.log(tree, 'round', r, 'results at start', n0, '| seen before the reload', before, '| back after it', after, '| tab', JSON.stringify(dirty));
}
save(`reloadmid-${tree}${process.env.STAY ? '-onshow' : ''}.json`, { tree, out, errors: env.errors });
console.log('errors', env.errors);
await env.close();
