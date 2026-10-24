import { launch, xrdTab, realm, key, show, resHash, sleep } from './rlib.mjs';
for (const mode of ['head', 'live']){
  const env = await launch(mode);
  const t = Date.now();
  const i = await xrdTab(env);
  console.log(mode, 'xrd tab built in', Date.now() - t, 'ms');
  const s = await show(env, i);
  const out = [];
  for (let r = 0; r < 4; r++){ out.push(['next', await key(env, s, 'next')]); await sleep(300); out.push(['smooth', await key(env, s, 'smooth')]); await sleep(300); }
  for (const [w, o] of out) console.log(mode, w, Math.round(o.ms), 'delay', Math.round(o.delay), 'evt', o.evDur);
  console.log(mode, await resHash(s));
  const one = await s.evaluate(async ()=>{ const u = await import('./utils.js'); const c = u.getModuleState('xrd').cards.find(c=> c.id === 2); const r = c.states.rietveld.results; const k = Object.keys(r)[0]; return { k, keys: Object.keys(r[k]), at: r[k].at, ms: r[k].ms }; });
  console.log(JSON.stringify(one).slice(0, 600));
  console.log('errors', env.errors);
  await env.close();
}
