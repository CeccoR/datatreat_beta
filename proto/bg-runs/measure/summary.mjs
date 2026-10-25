/* The README's tables, from results/*.json (whatever of them is there).
   node summary.mjs  → stdout (and results/summary.txt) */
import fs from 'node:fs';
import path from 'node:path';
import { RESULTS } from './lib.mjs';
const read = n =>{ try { return JSON.parse(fs.readFileSync(path.join(RESULTS, n), 'utf8')); } catch(e){ return null; } };
const out = [];
const p = (...a)=> out.push(a.join(' '));
const f = x => x == null ? '–' : typeof x === 'number' ? String(Math.round(x)) : String(x);

const sh = read('switch-head.json'), sb = read('switch-bg.json');
if (sh || sb){
  p('## Switching (click → tab painted, ms: median (p90); long tasks, median ms)');
  p('| transition | today | prototype |'); p('|---|---|---|');
  const keys = [...new Set([...Object.keys((sh || {}).sum || {}), ...Object.keys((sb || {}).sum || {})])];
  for (const k of keys){ const a = sh && sh.sum[k], b = sb && sb.sum[k];
    p(`| ${k} | ${a ? `${f(a.med)} (${f(a.p90)}); ${f(a.longMsMed)}` : '– (asks to stop it)'} | ${b ? `${f(b.med)} (${f(b.p90)}); ${f(b.longMsMed)}` : '–'} |`); }
  if (sb) p('runs:', JSON.stringify(sb.runs.map(r=> [r.leftN, r.parkedN, r.back.label, r.back.n, r.end])));
  p('');
}
const sp = ['head', 'bg', 'pool'].map(m=> [m, read(`speed-${m}.json`)]).filter(([, j])=> j);
if (sp.length){
  p('## A refinement where it runs (Refine all, 12 patterns; medians of 5)');
  p('| tree | case | each run, ms | wall, ms | main thread during the runs, s | IndexedDB puts: n / ms / largest | long tasks, largest | RSS peak, MB | identical |');
  p('|---|---|---|---|---|---|---|---|---|');
  for (const [m, j] of sp) for (const [k, v] of Object.entries(j.sum))
    p(`| ${m} | ${k} | ${f(v.eachMed)} | ${f(v.wallMed)} | ${v.mainRunSMed} | ${v.putsNMed} / ${f(v.putsMsMed)} / ${v.putMaxMed} | ${f(v.longMaxMed)} | ${f(v.rssPeakMed)} | ${v.allIdentical} |`);
  p('');
}
const it = ['head', 'bg', 'pool'].map(m=> [m, read(`interact-${m}.json`)]).filter(([, j])=> j);
if (it.length){
  p('## Working in the tab on show (ms: median / p90 / max of 12)');
  p('| tree | while | next sample | smoothing |'); p('|---|---|---|---|');
  for (const [m, j] of it) for (const [k, v] of Object.entries(j.sum))
    p(`| ${m} | ${k} | ${f(v.next.med)} / ${f(v.next.p90)} / ${f(v.next.max)} | ${f(v.smooth.med)} / ${f(v.smooth.p90)} / ${f(v.smooth.max)} |`);
  p('');
}
const me = ['head', 'bg', 'pool'].map(m=> [m, read(`memory-${m}.json`)]).filter(([, j])=> j);
if (me.length){
  p('## Memory (medians of 3; MB)');
  p('| tree | runs | RSS during (after GC) | RSS peak | page heap | workers / their heap | RSS after, workers alive |'); p('|---|---|---|---|---|---|---|');
  for (const [m, j] of me) for (const [k, v] of Object.entries(j.sum))
    p(`| ${m} | ${k} | ${f(v.rssDuring)} | ${f(v.rssPeak)} | ${v.heapDuring.toFixed(1)} | ${v.workersDuring} / ${v.workerHeapDuring.toFixed(1)} | ${f(v.rssAfter)}, ${v.workersAfter} |`);
  p('');
}
for (const m of ['bg', 'pool']){
  const j = read(`safety-${m}.json`); if (!j) continue;
  const L = j.out.left, G = j.out.pingpong, R = j.out.reload;
  p(`## Data safety (${m}, ${L.length} rounds)`);
  p('left:', L.filter(x=> x.parked.identical && x.parked.dirty && x.parked.star && x.hist.oneStep && x.record.identical && x.record.n === 12 && x.shown && x.undo === 0 && x.redo).length + '/' + L.length, 'all right;',
    'record: first read found', L.map(x=> x.record.firstN).join(','), '; read took', L.map(x=> x.record.readMs).join(','), 'ms; found', L.map(x=> x.record.msAfterEnd).join(','), 'ms after the end');
  p('back and forth:', G.filter(x=> x.identical && x.n === 12 && x.top === 12).length + '/' + G.length, 'identical; steps', G.map(x=> x.steps).join(','));
  p('reload:', R.map(x=> `${x.parkedAtReload}→${x.recordAtReload}→${x.back}${x.identical ? '' : ' (differ)'}${x.running ? ' running' : ''}${x.dirty ? '*' : ''}`).join(', '));
  p('');
}
const po = read('pool.json');
if (po){
  p('## The pool: Refine all on k workers (medians of 5)');
  p('| k | on show, ms | parked, ms | two tabs at once: each / wall, ms | main thread on show, s | RSS peak on show, MB | identical |'); p('|---|---|---|---|---|---|---|');
  for (const k of [1, 2, 3, 4]){ const a = po.sum[k + ' shown'], b = po.sum[k + ' parked'], c = po.sum[k + ' two']; if (!a) continue;
    p(`| ${k} | ${f(a.eachMed)} | ${f(b.eachMed)} | ${f(c.eachMed)} / ${f(c.wallMed)} | ${a.mainRunSMed} | ${f(a.rssPeakMed)} | ${a.allIdentical && b.allIdentical && c.allIdentical} |`); }
  p('');
}
const txt = out.join('\n');
console.log(txt);
fs.writeFileSync(path.join(RESULTS, 'summary.txt'), txt + '\n');
