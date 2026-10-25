import { launch, xrdTab, plainTab, realm, show, startRefine, runEnd, sleep, DRS, SEM8, OUT } from './rlib.mjs';
const env = await launch('bg');
const page = env.page;
const X0 = await xrdTab(env), X = [await xrdTab(env), await xrdTab(env), await xrdTab(env)];
const D = await plainTab(env, 'tauc', DRS);
const ids = await Promise.all(X.map(i=> page.locator('#tabBar .ptab').nth(i).getAttribute('data-id')));
const state = async (tag)=> console.log(tag, JSON.stringify(await page.evaluate(async ()=>{ const T = await import('./tabs.js'); const u = await import('./utils.js');
  return { tabs: T.TABS.map(t=> ({ m: t.module, live: T.isLive(t), jobs: t.jobs ? t.jobs.length : 0 })), btn: document.querySelector('#xrdR2Refine').textContent, all: document.querySelector('#xrdR2RefineAll').textContent, allDis: document.querySelector('#xrdR2RefineAll').disabled, banner: (document.querySelector('.pwa-confirm.show span')||{}).textContent || null, status: (document.querySelector('#xrdR2Status')||{}).textContent || null, busy: u.moduleBusy('xrd') }; })));
async function tryStart(i, tag){
  const s = await show(env, i); await sleep(200);
  try { await startRefine(s); await state(tag + ' ok'); }
  catch(e){ await state(tag + ' FAIL'); await page.screenshot({ path: OUT + '/dbg-bg-' + tag + '.png' }); throw e; }
}
// phase like interact: X0's own run, then 1 parked twice, then 3 parked
let s0 = await show(env, X0);
await startRefine(s0); await runEnd(s0);
for (let r = 0; r < 2; r++){
  await tryStart(X[0], 'one-' + r);
  s0 = await show(env, X0);
  await page.waitForFunction(id=> import('./tabs.js').then(T=>{ const t = T.TABS.find(t=> t.id === id); return !(t.jobs && t.jobs.length); }), ids[0], { timeout: 120000, polling: 100 });
  await state('after one-' + r);
}
for (let j = 0; j < 3; j++) await tryStart(X[j], 'three-' + j);
s0 = await show(env, X0);
await state('three started');
await env.close();
