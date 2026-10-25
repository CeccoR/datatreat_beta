/* What is worked out, kept (b2v3 part B, the user's 4a), against b2v2: one tab measured beside
   a small tab on show (GC; for GC, EPR), on a profile on disk (lim-lib.mjs, LIM_PROFILE=disk
   forced), headless, 1400 × 900, the files of lim-fx.mjs's fx/ (served with each tree):
     xrd   XRPD, the 12 patterns of 5384 points and the CIF, refined (Refine all);
     tauc  DRS, 10 Cary exports of 1201 points (fx/ten), a Tauc card and an Urbach card on it;
     gc    GC, 10 files (fx/ten); epr  EPR, 10 spectra of 1024 points (fx/ten);
     sem   SEM, 8 images of 2048 × 2176 at 16 bits.
   For each: the memory with the tab hidden and awake, then asleep (tabs.js sleepTick; SEM's
   bytes let go first), then closed: JS heap and ArrayBuffers after two forced GCs and a
   memory-pressure signal (lim-lib mem), the two first less the third (what the tab holds);
   readings 5.5 s after the last change (the autosave's trailing write holds a tab till then).
   Between asleep and closed, `wakes` times: the tab shown by a real click, woken, from the
   pointerdown to two frames after its loader is gone (lim-lib timedSwitch), with the longest
   task within; the small tab shown back, the tab put to sleep again. b2v3: what the wakes
   made of each kind of result (utils.js kept.made, made again; taken, kept).
   node kept.mjs [runs=3] [wakes=4] [mods=xrd,tauc,gc,epr,sem] → results/kept.json
   V2_BASE (b2v2, default http://127.0.0.1:8991), V3_BASE (b2v3, default :8990). */
import * as L from './lim-lib.mjs';

process.env.LIM_PROFILE = 'disk';
const [runsArg = '3', wakesArg = '4', modsArg = 'xrd,tauc,gc,epr,sem'] = process.argv.slice(2);
const TREES = { v2: process.env.V2_BASE || 'http://127.0.0.1:8991', v3: process.env.V3_BASE || 'http://127.0.0.1:8990' };
const MODS = modsArg.split(','), RUNS = +runsArg, WAKES = +wakesArg;
const FX = {
  tauc: Array.from({ length: 10 }, (_, k)=> `fx/ten/c${k}.csv`),
  gc: Array.from({ length: 10 }, (_, k)=> `fx/ten/g${k}.csv`),
  epr: Array.from({ length: 10 }, (_, k)=> [`fx/ten/e${k}.DSC`, `fx/ten/e${k}.DTA`]).flat(),
};
const keptNow = env => env.page.evaluate(async ()=>{ const u = await import('./utils.js'); return u.kept ? JSON.parse(JSON.stringify(u.kept)) : null; });
const MB = x => L.r1(x);

async function run(tree, mod){
  L.BASE.b2 = TREES[tree];
  const env = await L.launch('b2'), page = env.page;
  await L.setLimits(env, { awakeMax: 20, liveMax: 19, sleepMin: 1440 });
  let i;
  if (mod === 'xrd') i = await L.xrdTab(env, 0);
  else if (mod === 'sem') i = await L.semTab(env, 0);
  else {
    i = await L.newTab(env, mod);
    await L.files(page, mod, FX[mod], 10);
    if (mod === 'tauc'){ await page.click('#taucAddAn'); await page.click('.an-menu:not([hidden]) [data-kind="urbach"]'); await L.settle(page); }
  }
  const other = await L.smallTab(env, mod === 'gc' ? 'epr' : 'gc');
  await L.sleep(5500);
  const sum = m => m.heap + m.ab;
  const awake = await env.mem();
  const sleepNow = async ()=>{
    await page.evaluate(async ()=> (await import('./tabs.js')).sleepTick(Date.now() + 1441*60e3));
    // (SEM: its bytes let go once its record is written, 30 s at most)
    if (mod === 'sem'){
      await page.evaluate(async ()=>{ window.__tabsM = await import('./tabs.js'); window.__dbM = await import('./db.js'); });
      await page.waitForFunction(()=>{ const t = window.__tabsM.TABS[0]; return !t.inst && (!window.__dbM.unread || window.__dbM.unread(t.state)); }, null, { timeout: 30000 }).catch(()=>{});
    }
    await L.sleep(mod === 'sem' ? 1500 : 300);
  };
  await sleepNow();
  const asleep = await env.mem();
  const k0 = await keptNow(env), wakes = [];
  for (let w = 0; w < WAKES; w++){
    const s = await L.timedSwitch(env, i), lt = await L.longTasks(env, s.t0, s.t1 + 50);
    wakes.push({ ms: s.ms, longest: lt.max });
    await L.timedSwitch(env, other);
    await sleepNow();
  }
  const k1 = await keptNow(env);
  await page.evaluate(async ()=>{ const T = await import('./tabs.js'); T.closeTab(T.TABS[0].id); });
  await L.sleep(5500);
  const closed = await env.mem();
  const delta = (a, b)=> a && b ? Object.fromEntries(Object.keys(b).map(k=> [k, b[k] - (a[k] || 0)]).filter(([, v])=> v)) : null;
  const out = { awakeMB: MB(sum(awake) - sum(closed)), asleepMB: MB(sum(asleep) - sum(closed)), heap: { awake: MB(awake.heap - closed.heap), asleep: MB(asleep.heap - closed.heap) },
    ab: { awake: MB(awake.ab - closed.ab), asleep: MB(asleep.ab - closed.ab) }, wakes, madeByWakes: k1 && delta(k0.made, k1.made), takenByWakes: k1 && delta(k0.taken, k1.taken), errors: env.errors };
  await env.close();
  return out;
}

const out = { method: 'one tab beside a small one on show; JS heap + ArrayBuffers after two forced GCs and a memory-pressure signal, the tab hidden awake / asleep, less the page with it closed; wakes by a real click, pointerdown to two frames after the loader is gone, the longest task within; a profile on disk, headless, 1400 x 900', trees: TREES, runs: RUNS, wakesPerRun: WAKES, load: L.loadavg(), started: new Date().toISOString() };
for (const mod of MODS){
  out[mod] = {};
  for (const tree of Object.keys(TREES)){
    const rs = [];
    for (let r = 0; r < RUNS; r++){ rs.push(await run(tree, mod)); console.log(mod, tree, r, JSON.stringify({ ...rs[r], wakes: rs[r].wakes.map(w=> w.ms + '/' + w.longest).join(' ') })); }
    const all = rs.flatMap(r=> r.wakes);
    out[mod][tree] = { awakeMB: L.r1(L.med(rs.map(r=> r.awakeMB))), asleepMB: L.r1(L.med(rs.map(r=> r.asleepMB))), runs: rs.map(r=> ({ awakeMB: r.awakeMB, asleepMB: r.asleepMB, heap: r.heap, ab: r.ab })),
      wake: L.stats(all.map(w=> w.ms)), longest: L.stats(all.map(w=> w.longest)), madeByWakes: rs.map(r=> r.madeByWakes), takenByWakes: rs[0].takenByWakes, errors: rs.flatMap(r=> r.errors) };
    console.log('==', mod, tree, JSON.stringify({ ...out[mod][tree], runs: undefined }));
  }
  L.save('kept.json', out);
}
out.ended = new Date().toISOString();
console.log(L.save('kept.json', out));
