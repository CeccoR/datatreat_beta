/* The limit: memory and work with N tabs in the background, N = 0, 1, 2, 4, 8, 12, 16, 24,
   one kind at a time, in one browser per run (lim-lib.mjs: its method).
   node lim-series.mjs <tree: b2|head|b1> <kind> [policy: awake|default] [Ns]
   → results/lim-<tree>[<LIM_TAG>]-<kind>[-default].json
   Tabs: two to work in, X0 (XRPD: the 12 patterns and the CIF, refined; fixtures t0) and S0
   (SEM: 8 images of 2048 × 2176 at 16 bits; t0), then N in the background, each with
   files of its own (lim-fx.mjs): kind
   - xrd: XRPD tabs refined, idle;
   - xrdrun: XRPD tabs refined and refining again (Refine all on the pool), each run restarted
     as it ends (b2: the tab shown, pressed and left; b1: pressed in its hidden frame);
   - sem: SEM tabs of 8 images;
   - mix: SEM, XRPD, XRPD refining in turn; and a DRS, a GC and an EPR tab made with X0, S0.
   Policy (b2): awake, every tab kept awake (liveMax 99, sleepMin 1440, in the page) and, before
   each reading, every hidden tab trimmed (tabs.js sleepTick 61 s on: the state of any tab
   hidden over a minute); default, the Settings' defaults (6 awake hidden, 10 min) in real time;
   cap (b2v3), at most LIM_AWAKE tabs awake (20 by default, awakeMax), the one shown least
   lately asleep beyond, a busy one never, and none put to sleep by its minutes (sleepMin
   1440): any number of tabs open, as b2v3 has it (b2v2 refused a 21st).
   The pool's workers end 1 s after their last job (datatreat-rv-idle) except where runs go on.
   At each N, X0 on show:
   1. memory after a forced GC (lim-lib mem), b2's tabsNow (awake, trimmed, busy, bytes());
      (b2v2 has no trim: every hidden tab awake as it was left)
      peaks sampled while the tabs were made and while measured;
   2. 4 s idle: the long tasks (whatever the background tabs do);
   3. work: 8 × → (next sample) and 8 smoothing widths in X0, alternately; S0 shown (timed);
      8 crop X typed in S0; its group's figure composer opened, 8 gaps typed; each timed from
      its key's timestamp to two frames after; long tasks within the keys' own windows;
   4. switches by real clicks, the work tab to 3 background tabs and back, each classed by
      what the tab was (b2: awake, trimmed or asleep).
   Stops after the N whose memory passes LIM_CAP MB (default 3300) of Private over every
   process, or on a crash. At the end (b2, policy awake): every hidden tab put to sleep in one
   call (its time in the page: one task), the memory asleep, then 4 tabs woken by real clicks
   (and the work tab shown back after each). */
import * as L from './lim-lib.mjs';

const [tree, kind, policy = 'awake', nsArg] = process.argv.slice(2);
const NS = (nsArg || '0,1,2,4,8,12,16,24').split(',').map(Number);
const CAP = +(process.env.LIM_CAP || 3300);
// (LIM_TAG names a variant of a tree served at its LIM_* address: nt, b2 with no trim)
const TAG = process.env.LIM_TAG || '';
// (today asks to stop a run before its tab is left: there the "refining" tabs are refined, idle)
const runs = (kind === 'xrdrun' || kind === 'mix') && tree !== 'head';
const SEQ = { xrd: ['X'], xrdrun: ['R'], sem: ['S'], mix: ['S', 'X', 'R'] }[kind];
if (!SEQ) throw new Error('kind?');
const env = await L.launch(tree, { knobs: runs ? {} : { 'datatreat-rv-idle': '1' } });
const page = env.page, b2 = tree === 'b2', awakePolicy = b2 && policy === 'awake', capPolicy = b2 && policy === 'cap';
if (awakePolicy) await L.setLimits(env, { liveMax: 99, sleepMin: 1440 });
if (capPolicy) await L.setLimits(env, { awakeMax: +(process.env.LIM_AWAKE || 20), sleepMin: 1440 });
const out = { tree, kind, policy: b2 ? policy : null, cap: CAP, started: new Date().toISOString(), rows: [], errors: env.errors };
const log = (...a)=> console.log(`[${tree}${TAG} ${kind}${b2 ? ' ' + policy : ''}]`, ...a);
const MIN = 60000;

// The tabs: index in the bar → { kind, k }.
const bg = [];           // background tabs: { i, kind: 'S'|'X'|'R', k }
const nk = { S: 0, X: 0 };
let t = Date.now();
const X0 = await L.xrdTab(env, 0), S0 = await L.semTab(env, 0);
if (kind === 'mix') for (const m of ['tauc', 'gc', 'epr']) await L.smallTab(env, m);
log('work tabs made in', Date.now() - t, 'ms');
// The script's own actions, each a window of page time: what lies outside them is the page's.
const fg = [];
const F = async fn =>{ const a = await L.now(env); try { return await fn(); } finally { fg.push([a, await L.now(env)]); } };
const show = i => F(async ()=>{ await page.locator('#tabBar .ptab').nth(i).locator('.ptab-label').click(); const s = await L.realm(env, i); await L.settle(s); return s; });
const tabsNow = ()=> L.tabsNow(env);
const classOf = async i =>{
  if (!b2) return tree === 'head' ? 'parked' : 'frame';
  const id = await L.tabId(env, i), x = (await tabsNow()).find(t=> t.id === id);
  return !x.awake ? 'asleep' : x.trimmed ? 'trimmed' : 'awake';
};

// Runs: every refining tab whose run has ended pressed again (b2: shown, pressed, left).
const ensureRuns = back => F(()=> ensureRuns1(back));
async function ensureRuns1(back){
  const R = bg.filter(b=> b.kind === 'R');
  if (!R.length || !runs) return false;
  let any = false;
  for (const b of R){
    const s = await L.realm(env, b.i);
    const running = tree === 'b2' ? (await tabsNow())[b.i].busy : await s.evaluate(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel');
    if (running) continue;
    any = true;
    if (b2){ await show(b.i); await L.pressRefineAll(page); }
    else { await L.pressRefineAll(s); }
  }
  if (any && b2 && back != null) await show(back);
  return any;
}
const busyNow = ()=> L.busyCount(env);

async function work(row){
  const w = { next: [], smooth: [], crop: [], fig: [], wins: [] };
  const keyOk = async ()=>{ if (!row.runs) return true; if (await busyNow() > 0) return true; return false; };
  // X0: → and smoothing, alternately
  let s = await show(X0);
  for (let j = 0; j < 16; j++){
    const what = j % 2 ? 'smooth' : 'next';
    if (!(await keyOk())){ await ensureRuns(X0); s = await L.realm(env, X0); await L.sleep(800); }
    const r = await F(()=> L.key(env, s, what));
    if (row.runs && !(await busyNow())){ j--; continue; }   // (the runs ended meanwhile: not counted)
    w[what].push(r.ms); w.wins.push([r.t0, r.t1]);
    await L.sleep(220);
  }
  // S0, shown from X0 (timed), then the crop and the figure
  row.switchToS0 = await F(()=> L.timedSwitch(env, S0));
  s = await L.realm(env, S0);
  await F(()=> L.semCropReady(env, s));
  for (let j = 0; j < 8; j++){
    if (!(await keyOk())){ await ensureRuns(S0); s = await L.realm(env, S0); await L.sleep(800); }
    const r = await F(()=> L.key(env, s, 'crop'));
    if (row.runs && !(await busyNow())){ j--; continue; }
    w.crop.push(r.ms); w.wins.push([r.t0, r.t1]);
    await L.sleep(220);
  }
  if (row.runs && !(await busyNow())){ await ensureRuns(S0); s = await L.realm(env, S0); await L.sleep(800); }
  await F(()=> L.figOpen(s));
  for (let j = 0; j < 8; j++){
    if (!(await keyOk())){ await F(()=> L.figClose(env, s)); await ensureRuns(S0); s = await L.realm(env, S0); await L.sleep(800); await F(()=> L.figOpen(s)); }
    const r = await F(()=> L.key(env, s, 'fig'));
    if (row.runs && !(await busyNow())){ j--; continue; }
    w.fig.push(r.ms); w.wins.push([r.t0, r.t1]);
    await L.sleep(220);
  }
  await F(()=> L.figClose(env, s));
  // long tasks within the keys' own windows (the keys' own work among them)
  const lt = [];
  for (const [a, b] of w.wins){ const x = await L.longTasks(env, a, b); if (x.n) lt.push(x.max); }
  row.work = { next: L.stats(w.next), smooth: L.stats(w.smooth), crop: L.stats(w.crop), fig: L.stats(w.fig),
    raw: { next: w.next, smooth: w.smooth, crop: w.crop, fig: w.fig }, keysWithLongTask: lt.length, longMax: lt.length ? Math.max(...lt) : 0 };
}

// Switches: the work tab to 3 background tabs and back (classed before each click).
async function switches(row){
  const home = kind === 'sem' ? S0 : X0;
  const pick = bg.length ? [bg[bg.length - 1], bg[Math.floor(bg.length/2)], bg[0]].filter((b, j, a)=> a.indexOf(b) === j) : [{ i: home === S0 ? X0 : S0 }];
  await show(home);
  row.switches = [];
  for (const b of pick){
    const c1 = await classOf(b.i), s1 = await F(()=> L.timedSwitch(env, b.i));
    const c2 = await classOf(home), s2 = await F(()=> L.timedSwitch(env, home));
    row.switches.push({ to: b.kind || (b.i === X0 ? 'X0' : 'S0'), toWas: c1, ms: s1.ms, backWas: c2, backMs: s2.ms, longTo: await L.longTasks(env, s1.t0, s1.t1 + 50) });
  }
}

for (const N of NS){
  const row = { N, runs: false };
  const stopBuild = env.peak();
  t = Date.now();
  while (bg.length < N){
    const kd = SEQ[bg.length % SEQ.length];
    const k = kd === 'S' ? ++nk.S : ++nk.X;
    const i = kd === 'S' ? await L.semTab(env, k) : await L.xrdTab(env, k);
    bg.push({ i, kind: kd, k });
    if (env.errors.includes('CRASH')) break;
  }
  row.buildMs = Date.now() - t; row.peakBuild = stopBuild();
  if (env.errors.includes('CRASH')){ row.crash = true; out.rows.push(row); log('CRASH while making', N); break; }
  const stop = env.peak();
  row.tabs = { S: bg.filter(b=> b.kind === 'S').length, X: bg.filter(b=> b.kind === 'X').length, R: bg.filter(b=> b.kind === 'R').length };
  row.runs = row.tabs.R > 0 && runs;
  fg.length = 0;
  const tStart = await L.now(env);
  if (row.runs) await ensureRuns(null);
  await show(X0);
  if (awakePolicy) await F(()=> page.evaluate(async ms=> (await import('./tabs.js')).sleepTick(Date.now() + ms), 61000));
  await L.sleep(1500);
  row.busyAtReading = row.runs ? await busyNow() : 0;
  row.mem = await F(()=> env.mem());
  if (b2){
    const tn = await tabsNow();
    // (b2v3 has neither a trim nor bytes(): the tabs awake and asleep by module)
    row.shell = capPolicy ? { awake: tn.filter(t=> t.awake).length, asleep: tn.filter(t=> !t.awake).length, busy: tn.filter(t=> t.busy).length,
      byModule: tn.reduce((o, t)=>{ const k = t.module + (t.awake ? ' awake' : ' asleep'); o[k] = (o[k] || 0) + 1; return o; }, {}) }
      : { awake: tn.filter(t=> t.awake).length, asleep: tn.filter(t=> !t.awake).length, trimmed: tn.filter(t=> t.trimmed).length, busy: tn.filter(t=> t.busy).length,
        bytesHiddenAwakeMB: L.r1(tn.filter(t=> t.awake && !t.shown).reduce((a, t)=> a + t.bytes, 0)/1048576), bytes: tn.map(t=> [t.module, t.awake ? (t.trimmed ? 'trimmed' : 'awake') : 'asleep', L.r1(t.bytes/1048576)]) };
  }
  const t0 = await L.now(env); await L.sleep(4000); row.idle = await L.longTasks(env, t0, await L.now(env));
  await work(row);
  await switches(row);
  row.background = await L.longTasksBut(env, tStart, await L.now(env), fg);
  row.peak = stop(); row.load = L.loadavg();
  out.rows.push(row);
  log(`N=${N}`, 'build', row.buildMs, 'ms | Private', row.mem.allPriv, 'rend RSS', row.mem.rendRss, 'heap', row.mem.heap, 'ab', row.mem.ab, 'browser', row.mem.browserPriv, 'workers', row.mem.workers,
    '| peak', row.peak.allPriv, '| next', row.work.next && row.work.next.med, 'smooth', row.work.smooth && row.work.smooth.med, 'crop', row.work.crop && row.work.crop.med, 'fig', row.work.fig && row.work.fig.med,
    '| long(keys)', row.work.longMax, 'idle', JSON.stringify(row.idle), 'bg', JSON.stringify(row.background), '| sw', row.switches.map(x=> `${x.toWas} ${x.ms}/${x.backWas} ${x.backMs}`).join(', '), row.shell ? '| shell ' + JSON.stringify({ ...row.shell, bytes: undefined }) : '');
  L.save(`lim-${tree}${TAG}-${kind}${b2 && policy !== 'awake' ? '-' + policy : ''}.json`, out);
  if (env.errors.length) log('errors so far', JSON.stringify(env.errors.slice(-3)));
  if (row.mem.allPriv > CAP || Math.max(row.peak.allPriv, row.peakBuild.allPriv) > CAP + 700 || env.errors.includes('CRASH')){ out.stopped = `after N = ${N}: ${row.mem.allPriv} MB of Private after a GC`; log('stop:', out.stopped); break; }
}

// b2: every hidden tab put to sleep at once (the runs let end first), then 4 woken.
if ((awakePolicy || capPolicy) && !env.errors.includes('CRASH')){
  const end = {};
  for (const tEnd = Date.now() + 15*MIN; await busyNow() && Date.now() < tEnd;) await L.sleep(500);
  await show(X0);
  const n0 = (await tabsNow()).filter(t=> t.awake).length;
  end.sleepAll = await page.evaluate(async ms=>{ const T = await import('./tabs.js'), t0 = performance.now(); T.sleepTick(Date.now() + ms); return performance.now() - t0; }, 1441*MIN);
  end.sleepAll = { ms: L.r1(end.sleepAll), tabs: n0 - (await tabsNow()).filter(t=> t.awake).length };
  await L.sleep(1500);
  // (b2.patch of b2v2: a SEM tab asleep lets go of its files' bytes once its record is
  // written: waited for, 60 s at most; those that did, of the SEM tabs asleep, counted)
  const light = ()=> page.evaluate(async ()=>{ const T = await import('./tabs.js'), D = await import('./db.js'), s = T.TABS.filter(t=> !t.inst && t.module === 'sem');
    return { light: D.unread ? s.filter(t=> D.unread(t.state)).length : null, asleep: s.length }; });
  for (const t1 = Date.now() + 60000; ; await L.sleep(500)){ end.semAsleep = await light(); if (end.semAsleep.light == null || end.semAsleep.light === end.semAsleep.asleep || Date.now() > t1) break; }
  end.memAsleep = await env.mem();
  end.wakes = [];
  for (const b of [bg[bg.length - 1], bg[Math.floor(bg.length/2)], bg[0], bg[1]].filter(Boolean).filter((b, j, a)=> a.indexOf(b) === j)){
    const was = await classOf(b.i), s1 = await L.timedSwitch(env, b.i), lt = await L.longTasks(env, s1.t0, s1.t1 + 50);
    const s2 = await L.timedSwitch(env, X0);
    end.wakes.push({ kind: b.kind, was, ms: s1.ms, long: lt, backMs: s2.ms });
  }
  end.memAfterWakes = await env.mem();
  out.end = end;
  log('sleep all', JSON.stringify(end.sleepAll), '| SEM asleep without their bytes', JSON.stringify(end.semAsleep), '| asleep Private', end.memAsleep.allPriv, 'rend RSS', end.memAsleep.rendRss, 'heap', end.memAsleep.heap, 'ab', end.memAsleep.ab, 'browser', end.memAsleep.browserPriv, '| wakes', end.wakes.map(w=> `${w.kind} ${w.was} ${w.ms} (long ${w.long.max})`).join(', '));
}
out.ended = new Date().toISOString();
log('saved', L.save(`lim-${tree}${TAG}-${kind}${b2 && policy !== 'awake' ? '-' + policy : ''}.json`, out), 'errors', env.errors.length);
await env.close();
