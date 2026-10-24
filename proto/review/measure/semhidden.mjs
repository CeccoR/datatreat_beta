/* Live tabs: the XRPD tab on show (12 patterns refined) while a hidden SEM tab reads its 8
   images (2048×2176, 16-bit). REPS readings, each in a new SEM tab: the files given, the
   XRPD tab clicked at once, then → pressed every ~50 ms until the SEM tab has read them
   (rlib key: from the key's timestamp to two frames after its handlers). Also the main
   thread's busy time over a reading alone (CDP Performance TaskDuration), on show.
   node semhidden.mjs [reps=6] */
import { launch, xrdTab, plainTab, DRS, newTab, loadFiles, realm, show, key, longTasks, sleep, stats, save, SEM8 } from './rlib.mjs';
const reps = +(process.argv[2] || 6);
const env = await launch('live');
const page = env.page;
const X0 = await xrdTab(env);
const EXTRA = !!process.env.EXTRA;
if (EXTRA){ for (let j = 0; j < 3; j++) await xrdTab(env); await plainTab(env, 'sem', SEM8); await plainTab(env, 'tauc', DRS); await show(env, X0); await sleep(1000); }
const base = await page.locator('#tabBar .ptab').count();
const clickTab = i => page.locator('#tabBar .ptab').nth(i).locator('.ptab-label').click();
const all = [], perRead = [];
await env.cdp.send('Performance.enable');
const busy = async ()=> (await env.cdp.send('Performance.getMetrics')).metrics.find(m=> m.name === 'TaskDuration').value;
for (let r = 0; r < reps; r++){
  const i = await newTab(env, 'sem');
  const f = await realm(env, i);
  const b0 = await busy(), w0 = Date.now();
  await loadFiles(f, 'sem', SEM8, false);
  await clickTab(X0);
  const s0 = await realm(env, X0);
  const done = ()=> f.evaluate(()=> !document.querySelector('.dz-loading') && document.querySelectorAll('#semFileTableWrap tr.file-row').length >= 8 && document.querySelectorAll('#semThumbs .sem-thumb').length === document.querySelectorAll('#semFileTableWrap .file-incl:checked').length);
  const ms = []; let a0 = null, a1 = null;
  while (!(await done())){ const k = await key(env, s0, 'next'); ms.push(k.ms); a0 = a0 ?? k.t0; a1 = k.t1; await sleep(50); }
  const w = Date.now() - w0, b = await busy() - b0;
  const lt = a0 ? await longTasks(page, a0, a1) : null;
  perRead.push({ wall: w, mainBusy: Math.round(b*1000), keys: ms.map(Math.round), long: lt });
  all.push(...ms);
  console.log('read', r, 'wall', w, 'ms; main thread busy', Math.round(b*1000), 'ms; keys', ms.map(Math.round).join(' '), '| long', JSON.stringify(lt));
  // the SEM tab closed again (its frame and memory gone), back to X0
  await page.locator('#tabBar .ptab').nth(i).locator('.ptab-x').click();
  const f2 = await realm(env, i).catch(()=> null);
  if (f2){ try { await f2.waitForSelector('.pwa-confirm.show', { timeout: 3000 }); await f2.click('.pwa-confirm.show .btn:not(.primary)'); } catch(e){} }
  await page.waitForFunction(n=> document.querySelectorAll('#tabBar .ptab').length === n, base, { timeout: 20000 }).catch(()=> console.log('  (tab not closed)'));
  await show(env, X0); await sleep(800);
}
// the main thread's busy time of one reading with nothing else going on (on show)
const i = await newTab(env, 'sem'); const f = await realm(env, i);
const b0 = await busy(), w0 = Date.now();
await loadFiles(f, 'sem', SEM8, true);
const alone = { wall: Date.now() - w0, mainBusy: Math.round((await busy() - b0)*1000) };
console.log('alone, on show: wall', alone.wall, 'main busy', alone.mainBusy);
const sum = { keys: stats(all), over200: all.filter(x=> x > 200).length, over100: all.filter(x=> x > 100).length, n: all.length, alone };
console.log(JSON.stringify(sum), 'errors', env.errors);
save(EXTRA ? 'semhidden-extra.json' : 'semhidden.json', { sum, perRead, errors: env.errors });
await env.close();
