/* Startup with tabs stored: 2 XRPD refined, SEM 8 images, DRS, GC; the first XRPD on show.
   A reload, from navigationStart to two frames in the realm on show once its loader is
   gone (polled 20 ms, then the two frames); memory after GC. 5 reloads. node boot.mjs <tree> */
import { launch, xrdTab, plainTab, show, realm, sleep, stats, save, DRS, GC, SEM8 } from './rlib.mjs';
const tree = process.argv[2];
const env = await launch(tree);
const A = await xrdTab(env); await xrdTab(env); await plainTab(env, 'sem', SEM8); await plainTab(env, 'tauc', DRS); await plainTab(env, 'gc', GC);
await show(env, A); await sleep(1500);
const ms = [], mem = [];
for (let r = 0; r < 5; r++){
  await env.page.reload();
  await env.page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab'), null, { timeout: 60000 });
  const s = await realm(env, A);
  await s.waitForFunction(()=> document.querySelector('#tab-xrd.active') && !document.querySelector('.module-loader.show') && document.querySelectorAll('#xrdFileTableWrap tr.file-row').length === 12, null, { timeout: 60000, polling: 20 });
  const t1 = await s.evaluate(()=> new Promise(r=> requestAnimationFrame(()=> requestAnimationFrame(()=> r(window.__T())))));
  const t0 = await env.page.evaluate(()=> performance.timeOrigin);
  ms.push(t1 - t0);
  await sleep(2500);
  mem.push(await env.mem());
  console.log(tree, r, Math.round(t1 - t0), 'ms; renderer', Math.round(mem[r].rendRss), 'MB, heap', Math.round(mem[r].heap));
}
save(`boot-${tree}.json`, { tree, ms: stats(ms), mem, errors: env.errors });
console.log(tree, JSON.stringify(stats(ms)), 'errors', env.errors);
await env.close();
