/* The limit's numbers drawn from the runs' JSON (results/lim-*.json): per tab of each kind
   (the least-squares slope of the memory over N), the totals, the work on show against N = 0,
   the switches by what the tab was, the background's long tasks, b2's estimates against the
   memory measured, and the limits within a budget.
   node lim-summary.mjs [budget MB = 3072] → results/lim-summary.json (and the tables printed) */
import fs from 'node:fs';
import path from 'node:path';
import { RESULTS, med, r1 } from './lim-lib.mjs';

const BUDGET = +(process.argv[2] || 3072);
const read = f =>{ try { return JSON.parse(fs.readFileSync(path.join(RESULTS, f), 'utf8')); } catch(e){ return null; } };
const slope = (xs, ys)=>{ const n = xs.length, mx = xs.reduce((a, b)=> a + b, 0)/n, my = ys.reduce((a, b)=> a + b, 0)/n;
  const sxx = xs.reduce((a, x)=> a + (x - mx)**2, 0); return sxx ? xs.reduce((a, x, i)=> a + (x - mx)*(ys[i] - my), 0)/sxx : NaN; };
const KEYS = ['allPriv', 'rendRss', 'rendPriv', 'browserPriv', 'gpuPriv', 'heap', 'ab', 'nodes'];
const out = { budgetMB: BUDGET, runs: {} };
for (const f of fs.readdirSync(RESULTS).filter(f=> /^lim-(b2|head|b1)(nt)?-[a-z]+(-default)?\.json$/.test(f)).sort()){
  const d = read(f);
  if (!d || !d.rows) continue;   // (lim-b2-bgjobs.json: read below)
  const rows = d.rows.filter(r=> r.mem);
  if (!rows.length) continue;
  const N = rows.map(r=> r.N), base = rows[0].mem;
  const s = { file: f, tree: d.tree, kind: d.kind, policy: d.policy, nMax: Math.max(...N), stopped: d.stopped || null, errors: d.errors.length };
  // per tab: the slope over every N measured (MB, nodes)
  s.perTab = Object.fromEntries(KEYS.map(k=> [k, r1(slope(N, rows.map(r=> r.mem[k])))]));
  s.totals = rows.map(r=> ({ N: r.N, allPriv: r.mem.allPriv, peak: r1(Math.max(r.peak ? r.peak.allPriv : 0, r.peakBuild ? r.peakBuild.allPriv : 0)), rendRss: r.mem.rendRss,
    heap: r.mem.heap, ab: r.mem.ab, browser: r.mem.browserPriv, gpu: r.mem.gpuPriv, nodes: r.mem.nodes, workers: r.mem.workers, busy: r.busyAtReading,
    awake: r.shell ? r.shell.awake : null, asleep: r.shell ? r.shell.asleep : null, estHiddenAwakeMB: r.shell ? r.shell.bytesHiddenAwakeMB : null }));
  // asleep (b2, the end): every hidden tab asleep, against N = 0
  if (d.end){
    const a = d.end.memAsleep, last = rows[rows.length - 1];
    s.asleep = { N: last.N, allPriv: a.allPriv, rendRss: a.rendRss, heap: a.heap, ab: a.ab, browser: a.browserPriv, nodes: a.nodes,
      perTab: Object.fromEntries(KEYS.map(k=> [k, r1((a[k] - base[k])/last.N)])),
      sleepGivesBackMB: r1(last.mem.allPriv - a.allPriv), estimateMB: last.shell ? last.shell.bytesHiddenAwakeMB : null,
      sleepAll: d.end.sleepAll, wakes: d.end.wakes.map(w=> ({ kind: w.kind, was: w.was, ms: w.ms, longMax: w.long.max, backMs: w.backMs })) };
  }
  // work on show: medians at each N, against N = 0
  const ops = ['next', 'smooth', 'crop', 'fig'];
  s.work = rows.map(r=> ({ N: r.N, ...Object.fromEntries(ops.map(o=> [o, r.work[o] ? r.work[o].med : null])), ...Object.fromEntries(ops.map(o=> [o + 'Max', r.work[o] ? r.work[o].max : null])) }));
  s.workRatioMax = Object.fromEntries(ops.map(o=> [o, Math.round(100*Math.max(...rows.map(r=> r.work[o].med/rows[0].work[o].med)))/100]));
  // switches by what the tab was
  const sw = {};
  for (const r of rows){
    if (r.switchToS0) (sw['S0 from X0'] = sw['S0 from X0'] || []).push(r.switchToS0.ms);
    // (b2-sem N = 0: a click on the tab on show, not a switch, left out)
    for (const x of r.switches.filter(x=> x.ms > 0)){ (sw['to ' + x.to + ' ' + x.toWas] = sw['to ' + x.to + ' ' + x.toWas] || []).push(x.ms); (sw['back, ' + x.backWas] = sw['back, ' + x.backWas] || []).push(x.backMs); }
  }
  s.switches = Object.fromEntries(Object.entries(sw).map(([k, v])=> [k, { n: v.length, med: r1(med(v)), max: r1(Math.max(...v)) }]));
  // the background's long tasks (outside the script's own actions), and with nothing typed (4 s)
  s.background = rows.map(r=> ({ N: r.N, n: r.background.n, max: r.background.max, over200: r.background.over200, idleMax: r.idle.max }));
  // within the budget: all awake, the tabs that fit; with every hidden tab asleep but L
  const a = s.perTab.allPriv, b0 = base.allPriv;
  s.fitAllAwake = a > 0 ? Math.floor((BUDGET - b0)/a) : null;
  if (s.asleep){
    const z = s.asleep.perTab.allPriv;
    s.fitAllAsleep = z > 0 ? Math.floor((BUDGET - b0)/z) : null;
    // L for 20 tabs open (the bar's limit): base + L·a + (20 − L)·z ≤ budget
    s.L20 = a > z ? Math.floor((BUDGET - b0 - 20*z)/(a - z)) : null;
  }
  out.runs[f.replace(/^lim-|\.json$/g, '')] = s;
}
const bg = read('lim-b2-bgjobs.json');
if (bg) out.bgjobs = { hiddenReading: bg.hiddenReading.map(r=> ({ keys: r.keys, readMs: r.readMs, longN: r.long.n, longMax: r.long.max, over200: r.long.over200, keyMs: r.keyMs })),
  hiddenRuns: bg.hiddenRuns.map(r=> ({ keys: r.keys, ms: r.ms, longN: r.long.n, longMax: r.long.max, over200: r.long.over200, keyMs: r.keyMs })),
  shownReading: bg.shownReading, bursts: bg.bursts, wakes: bg.wakes.map(w=> ({ module: w.module, ms: w.ms, longMax: w.long.max })) };
fs.writeFileSync(path.join(RESULTS, 'lim-summary.json'), JSON.stringify(out, null, 1) + '\n');
for (const [k, s] of Object.entries(out.runs)){
  console.log(`\n== ${k} (N ≤ ${s.nMax}${s.stopped ? ', stopped ' + s.stopped : ''}; errors ${s.errors})`);
  console.log(' per tab:', JSON.stringify(s.perTab));
  if (s.asleep) console.log(' asleep per tab:', JSON.stringify(s.asleep.perTab), '| sleep gives back', s.asleep.sleepGivesBackMB, 'MB, estimated', s.asleep.estimateMB, '| sleep all', JSON.stringify(s.asleep.sleepAll), '| wakes', JSON.stringify(s.asleep.wakes));
  console.log(' totals:', s.totals.map(t=> `N${t.N} ${t.allPriv}/${t.peak} (rss ${t.rendRss}, heap ${t.heap}, ab ${t.ab}, br ${t.browser}, w ${t.workers}${t.awake != null ? ', awake ' + t.awake + ' est ' + t.estHiddenAwakeMB : ''})`).join(' | '));
  console.log(' work:', s.work.map(w=> `N${w.N} ${w.next}/${w.smooth}/${w.crop}/${w.fig}`).join(' | '), '| worst ratio', JSON.stringify(s.workRatioMax));
  console.log(' switches:', JSON.stringify(s.switches));
  console.log(' background:', s.background.map(b=> `N${b.N} ${b.n}:${b.max}${b.over200 ? '!' + b.over200 : ''} idle ${b.idleMax}`).join(' | '));
  console.log(' fit in', BUDGET, 'MB: all awake', s.fitAllAwake, '| all asleep', s.fitAllAsleep, '| L for 20 open', s.L20);
}
if (out.bgjobs) console.log('\n== bgjobs', JSON.stringify(out.bgjobs));
