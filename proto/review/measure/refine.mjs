/* Refine all (12 patterns, card 2, without the standard): its time and its results' hash,
   where it runs. node refine.mjs <case> [reps]
   cases: head-show, live-show, live-hidden, bg-show, bg-parked, pool-show (k = default),
   pool4-show (k = 4), livepool-hidden.
   A run: from the script click on "Refine without the standard" to the button's text back to
   Refine (MutationObserver, in the run's realm); parked (bg): to the tab's jobs gone, looked
   at every 10 ms in the page, then the tab shown again and its results hashed there. */
import { launch, xrdTab, plainTab, realm, show, startRefine, runEnd, resHash, sleep, stats, save, loadavg, DRS } from './rlib.mjs';
const [kase, reps = '5'] = process.argv.slice(2);
const [tree, where] = kase.split('-');
const mode = tree === 'pool4' ? 'pool' : tree;
const env = await launch(mode, { rv: tree === 'pool4' ? { workers: 4 } : {} });
const A = await xrdTab(env);                 // its first run: cold, the build's
const B = await plainTab(env, 'tauc', DRS);  // a DRS tab, the one on show while A runs hidden/parked
const runs = [];
for (let r = 0; r < +reps; r++){
  let s = await show(env, A);
  await sleep(500);
  const t0 = await startRefine(s);
  let t1;
  if (where === 'show') t1 = await runEnd(s);
  else if (where === 'hidden'){
    await env.page.locator('#tabBar .ptab').nth(B).locator('.ptab-label').click();
    t1 = await runEnd(s);                    // the frame of A, hidden
  } else {                                   // bg: parked
    const id = await env.page.locator('#tabBar .ptab').nth(A).getAttribute('data-id');
    await env.page.locator('#tabBar .ptab').nth(B).locator('.ptab-label').click();
    t1 = await env.page.evaluate(id=> new Promise(async res=>{
      const T = await import('./tabs.js');
      const look = ()=>{ const t = T.TABS.find(t=> t.id === id); if (t && !T.isLive(t) && !(t.jobs && t.jobs.length)) res(window.__T()); else setTimeout(look, 10); };
      setTimeout(look, 300);
    }), id);
    s = await show(env, A);
  }
  await settle2(s);
  const h = await resHash(s);
  runs.push({ ms: t1 - t0, ...h, load: loadavg() });
  console.log(kase, r, Math.round(t1 - t0), 'ms', h.n, h.hash);
}
async function settle2(s){ await s.waitForFunction(()=> !document.querySelector('.module-loader.show')); await sleep(300); }
const hashes = [...new Set(runs.map(x=> x.hash))];
const out = { kase, time: stats(runs.map(x=> x.ms)), hashes, n: runs.map(x=> x.n), runs, errors: env.errors };
console.log(kase, JSON.stringify(out.time), 'hashes', hashes, 'errors', env.errors.length);
save(`refine-${kase}.json`, out);
await env.close();
