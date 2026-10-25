/* K XRPD tabs refining at once, a DRS tab on show. node concur.mjs <tree> [K=3] [rounds=3]
   live/livepool: the K runs started together in their hidden frames (script clicks).
   bg/bgpool: each tab shown in turn and its run started, the next shown at once (parked).
   head: K tabs cannot run at once (a switch asks to stop): the K runs one after the other on
   show, for the baseline of the same work.
   Each run: click → its end; all: first click → last end; hashes of every tab's results;
   the CPU of every Chromium process over the round (/proc utime+stime). */
import fs from 'node:fs';
import { launch, xrdTab, plainTab, realm, show, startRefine, runEnd, resHash, sleep, stats, save, loadavg, DRS } from './rlib.mjs';
const [tree, K = '3', rounds = '3'] = process.argv.slice(2);
const k = +K;
const env = await launch(tree);
const X = [];
for (let j = 0; j < k; j++) X.push(await xrdTab(env));
const D = await plainTab(env, 'tauc', DRS);
const ids = await Promise.all(X.map(i=> env.page.locator('#tabBar .ptab').nth(i).getAttribute('data-id')));
const tick = ()=>{ let t = 0; for (const d of fs.readdirSync('/proc')){ if (!/^\d+$/.test(d)) continue; try { const c = fs.readFileSync(`/proc/${d}/cmdline`, 'utf8'); if (!/chrom/i.test(c.split('\0')[0])) continue; const st = fs.readFileSync(`/proc/${d}/stat`, 'utf8').slice(0); const f = st.slice(st.lastIndexOf(')') + 2).split(' '); t += +f[11] + +f[12]; } catch(e){} } return t/100; };
const out = [];
const clickTab = i => env.page.locator('#tabBar .ptab').nth(i).locator('.ptab-label').click();
for (let r = 0; r < +rounds; r++){
  const c0 = tick();
  let t0s = [], t1s = [];
  if (tree === 'head'){
    for (const i of X){ const s = await show(env, i); await sleep(300); t0s.push(await startRefine(s)); t1s.push(await runEnd(s)); }
  } else if (tree.startsWith('live')){
    const fs_ = []; for (const i of X) fs_.push(await realm(env, i));
    await show(env, D);
    await sleep(500);
    // started together: the three clicks in one go
    await Promise.all(fs_.map(f=> f.waitForTimeout(700)));
    t0s = await Promise.all(fs_.map(f=> startRefine(f)));
    t1s = await Promise.all(fs_.map(f=> runEnd(f)));
  } else {
    for (const i of X){ const s = await show(env, i); await sleep(300); t0s.push(await startRefine(s)); }
    await clickTab(D);
    t1s = await env.page.evaluate(ids=> Promise.all(ids.map(id=> new Promise(async res=>{
      const T = await import('./tabs.js');
      const look = ()=>{ const t = T.TABS.find(t=> t.id === id); if (t && !T.isLive(t) && !(t.jobs && t.jobs.length)) res(window.__T()); else setTimeout(look, 10); };
      setTimeout(look, 300);
    }))), ids);
  }
  const cpu = tick() - c0;
  const each = t0s.map((t, j)=> t1s[j] - t);
  const all = Math.max(...t1s) - Math.min(...t0s);
  const hashes = [];
  for (const i of X){ const s = await show(env, i); await s.waitForFunction(()=> !document.querySelector('.module-loader.show')); await sleep(200); hashes.push((await resHash(s)).hash); }
  await show(env, D);
  out.push({ each, all, cpu, hashes, load: loadavg() });
  console.log(tree, k, 'round', r, 'each', each.map(Math.round), 'all', Math.round(all), 'cpu', cpu.toFixed(1), 's', [...new Set(hashes)]);
}
const sum = { tree, k, each: stats(out.flatMap(o=> o.each)), all: stats(out.map(o=> o.all)), cpu: stats(out.map(o=> o.cpu*1000)), hashes: [...new Set(out.flatMap(o=> o.hashes))], errors: env.errors };
console.log(tree, k, JSON.stringify(sum));
save(`concur-${tree}-${k}.json`, { sum, out });
await env.close();
