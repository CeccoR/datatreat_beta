/* A refinement in a tab not on show (b2), on the pool: tab A, the 12 patterns and the CIF,
   Refine all started there, then tab B (the 12 refined) shown. Meanwhile, in B, the next
   sample (→: both cards drawn), from the key's dispatch to two frames, every 250 ms until
   A's run ends; then as many with nothing running. A's run from the press of 'Refine
   without the standard' to its end (tabs.js: not busy, polled every 20 ms in the page),
   against the same run on show in a third tab. Long tasks in B meanwhile.
   node background.mjs [runs] → results/background.json */
import { launch, med, r1, save, sleep } from './lib.mjs';
const N = +process.argv[2] || 3, out = { hidden: [], shown: [], keysRun: [], keysIdle: [], longRun: [] };
const { app, page, errors, close } = await launch(process.env.B2_BASE || 'http://127.0.0.1:8993');
await page.evaluate(async ()=>{
  window.__T = await import('./tabs.js');
  window.__key = ()=> new Promise(res=>{ const t0 = window.__now(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    requestAnimationFrame(()=> requestAnimationFrame(()=> res(window.__now() - t0))); });
});
const press = async ()=>{
  await page.waitForTimeout(650);
  await page.click('#xrdR2RefineAll');
  await (await page.waitForSelector('.confirm-modal')).dispose();
  const t0 = await page.evaluate(()=> window.__now());
  await page.click('.confirm-modal .btn:not(.primary)');
  return t0;
};
const ended = i => page.waitForFunction(i=> !window.__T.tabsNow()[i].busy && window.__now(), i, { timeout: 600000, polling: 20 }).then(h=> h.jsonValue());
await app.newTab('xrd'); await app.files('xrd', (await import('./lib.mjs')).XRD12); await app.cif();   // A
const b = await app.xrdRefined();                                                                    // B
for (let r = 0; r < N; r++){
  await app.show(0);
  if (r) { await page.click('#xrdR2ClearAll'); await app.settle(); }
  const t0 = await press();
  await page.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel');
  await app.show(b);
  const lt0 = await page.evaluate(()=> window.__now());
  let end = null;
  const done = ended(0).then(t=>{ end = t; });
  while (!end){ out.keysRun.push(await page.evaluate(()=> window.__key())); await sleep(250); }
  await done;
  out.longRun.push(await page.evaluate(([a, z])=> window.__lt.filter(([s])=> s >= a && s <= z).map(([, d])=> d), [lt0, end]));
  out.hidden.push(end - t0);
  for (let i = 0; i < 8; i++){ out.keysIdle.push(await page.evaluate(()=> window.__key())); await sleep(250); }
}
// The same run on show, in a third tab.
const c = await app.newTab('xrd'); await app.files('xrd', (await import('./lib.mjs')).XRD12); await app.cif();
for (let r = 0; r < N; r++){
  if (r){ await page.click('#xrdR2ClearAll'); await app.settle(); }
  const t0 = await press();
  out.shown.push((await ended(c)) - t0);
  await app.settle();
}
const res = { hiddenS: r1(med(out.hidden)/1000), shownS: r1(med(out.shown)/1000), keyRunMs: r1(med(out.keysRun)), keyRunMax: r1(Math.max(...out.keysRun)),
  keyIdleMs: r1(med(out.keysIdle)), keyIdleMax: r1(Math.max(...out.keysIdle)), longTasksRun: out.longRun.map(a=> ({ n: a.length, ms: Math.round(a.reduce((x, y)=> x + y, 0)), max: Math.round(Math.max(0, ...a)) })), raw: out, errors };
console.log(JSON.stringify({ ...res, raw: undefined }), save('background.json', res));
await close();
