/* After a reload: the first switch to each other tab (live: its frame made then; today: a
   restore as any switch), by a real click, from the pointerdown's timestamp to two frames
   once its loader is gone and it holds its files. Tabs: A XRPD (on show), B XRPD, C SEM, D DRS.
   4 reloads. node firstshow.mjs <tree> */
import { launch, xrdTab, plainTab, show, realm, sleep, stats, save, tabId, DRS, SEM8 } from './rlib.mjs';
const tree = process.argv[2];
const env = await launch(tree);
const page = env.page;
const A = await xrdTab(env), B = await xrdTab(env), C = await plainTab(env, 'sem', SEM8), D = await plainTab(env, 'tauc', DRS);
await show(env, A); await sleep(1500);
const by = { xrd: [], sem: [], drs: [] };
const rows = { [B]: ['xrd', '#xrdFileTableWrap tr.file-row', 12], [C]: ['sem', '#semFileTableWrap tr.file-row', 8], [D]: ['drs', '#taucFileTableWrap tr.file-row', 1] };
for (let r = 0; r < 4; r++){
  if (r){ await show(env, A); await sleep(1500); }
  await page.reload();
  await page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab'), null, { timeout: 60000 });
  await realm(env, A); await sleep(2500);
  for (const i of [B, C, D]){
    const [k, sel, n] = rows[i];
    const box = await page.locator('#tabBar .ptab').nth(i).locator('.ptab-label').boundingBox();
    const n0 = await page.evaluate(()=> window.__in.length);
    await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
    const t0 = (await page.evaluate(n0=> window.__in.slice(n0).find(e=> e.type === 'pointerdown'), n0)).t0;
    const s = await realm(env, i);
    await s.waitForFunction(([sel, n])=> !document.querySelector('.module-loader.show') && document.querySelectorAll(sel).length >= n && (!window.frameElement || !window.frameElement.classList.contains('off')), [sel, n], { timeout: 60000, polling: 10 });
    const t1 = await s.evaluate(()=> new Promise(r=> requestAnimationFrame(()=> requestAnimationFrame(()=> r(window.__T())))));
    by[k].push(t1 - t0);
    await sleep(1000);
  }
  console.log(tree, r, Object.entries(by).map(([k, v])=> k + ' ' + Math.round(v[v.length - 1])).join(', '));
}
const sum = Object.fromEntries(Object.entries(by).map(([k, v])=> [k, stats(v)]));
console.log(tree, JSON.stringify(sum), 'errors', env.errors);
save(`firstshow-${tree}.json`, { tree, sum, raw: by, errors: env.errors });
await env.close();
