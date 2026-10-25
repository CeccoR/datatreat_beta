/* The tables of the README, from results/*.json: node summary.mjs (→ stdout and
   results/summary.txt). A missing result is shown as "–". */
import fs from 'node:fs';
import path from 'node:path';
import { RESULTS } from './lib.mjs';
const rd = n =>{ try { return JSON.parse(fs.readFileSync(path.join(RESULTS, n + '.json'), 'utf8')); } catch(e){ return null; } };
const f = (x, d = 0)=> x == null || Number.isNaN(x) ? '–' : (+x).toFixed(d);
const lines = [];
const out = s => lines.push(s);
const table = (head, rows)=>{ out('| ' + head.join(' | ') + ' |'); out('|' + head.map(()=> '---').join('|') + '|'); rows.forEach(r=> out('| ' + r.join(' | ') + ' |')); out(''); };

out('MEMORY (after a forced GC; renderer process RSS / JS heap of the isolate / worker heaps, MB)');
for (const s of ['empty', 'xrd', 'sem']){
  const h = rd('memory-head-' + s), l = rd('memory-live-' + s), ll = rd('memory-live-' + s + '-lean');
  const rows = [];
  const at = (r, n)=> r && r.at.find(a=> a.n === n);
  rows.push(['boot (0 tabs)', h ? f(h.boot.renderer.rss) + ' / ' + f(h.boot.heap, 1) : '–', l ? f(l.boot.renderer.rss) + ' / ' + f(l.boot.heap, 1) : '–', ll ? f(ll.boot.renderer.rss) + ' / ' + f(ll.boot.heap, 1) : '–']);
  for (const n of [1, 2, 4, 8]){
    const a = at(h, n), b = at(l, n), c = at(ll, n);
    rows.push([String(n), a ? `${f(a.renderer.rss)} / ${f(a.heap, 1)} / ${a.workers}×, ${f(a.workerHeap, 1)}` : '–', b ? `${f(b.renderer.rss)} / ${f(b.heap, 1)} / ${b.workers}×, ${f(b.workerHeap, 1)}` : '–', c ? `${f(c.renderer.rss)} / ${f(c.heap, 1)} / ${c.workers}×, ${f(c.workerHeap, 1)}` : '–']);
  }
  const per = r => r && r.perTab.length ? r.perTab[r.perTab.length - 1] : null;
  const ph = per(h), pl = per(l), pll = per(ll);
  rows.push(['per tab (at the largest N)', ph ? `+${f(ph.rssPerTab)} RSS, +${f(ph.heapPerTab, 1)} heap` : '–', pl ? `+${f(pl.rssPerTab)} RSS, +${f(pl.heapPerTab, 1)} heap` : '–', pll ? `+${f(pll.rssPerTab)} RSS, +${f(pll.heapPerTab, 1)} heap` : '–']);
  out('scenario ' + s);
  table(['N tabs', 'today (HEAD)', 'live tabs', 'live, lean frames'], rows);
}

out('SWITCH (click → two frames in the realm shown, its loader gone; median of 7 per target, ms; long tasks ms median)');
{
  const h = rd('switch-head'), l = rd('switch-live'), v = rd('switch-live-visibility');
  table(['to', 'today', 'live (display:none)', 'live (visibility:hidden)'], ['xrd', 'sem', 'drs', 'gc', 'epr'].map(k=> [k,
    h ? `${f(h.sum[k].med)} (p90 ${f(h.sum[k].p90)}; long ${f(h.sum[k].longMsMed)})` : '–',
    l ? `${f(l.sum[k].med)} (p90 ${f(l.sum[k].p90)}; long ${f(l.sum[k].longMsMed)})` : '–',
    v ? `${f(v.sum[k].med)} (p90 ${f(v.sum[k].p90)}; long ${f(v.sum[k].longMsMed)})` : '–']));
}

out('OPEN (click → two frames in the new tab, median of 5, ms)');
{
  const h = rd('open-head'), l = rd('open-live'), ll = rd('open-live-lean');
  const rows = ['xrd', 'tauc', 'gc', 'epr', 'sem'].map(k=> ['blank ' + k, h ? f(h.blank[k].med) : '–', l ? f(l.blank[k].med) : '–', ll ? f(ll.blank[k].med) : '–']);
  for (const k of ['xrd', 'sem']) rows.push(['saved ' + k + ' (from Projects, then shown)', h ? f(h.saved[k].med) : '–', l ? f(l.saved[k].med) : '–', ll ? f(ll.saved[k].med) : '–']);
  const ch = rd('opencold-head'), cl = rd('opencold-live'), cll = rd('opencold-live-lean');
  for (const k of ['xrd', 'sem']) rows.push(['saved ' + k + ', the app reloaded first', ch ? f(ch.saved[k].med) : '–', cl ? f(cl.saved[k].med) : '–', cll ? f(cll.saved[k].med) : '–']);
  for (const k of ['xrd', 'sem']) rows.push(['let go, shown again: ' + k, '(a switch)', l && l.rewake[k] ? f(l.rewake[k].med) : '–', ll && ll.rewake[k] ? f(ll.rewake[k].med) : '–']);
  table(['tab', 'today', 'live', 'live, lean frames'], rows);
  if (l && l.rewake.mem) out('let go (hibernate) XRPD + SEM frames: before ' + JSON.stringify(l.rewake.mem.before) + ', after ' + JSON.stringify(l.rewake.mem.after) + '\n');
}

out('INTERACTION in the XRPD tab on show (event → two frames, median / p90 / max of 9, ms)');
{
  const h = rd('interaction-head'), l = rd('interaction-live');
  const labels = [...new Set([...(h ? h.phases : []), ...(l ? l.phases : [])].map(p=> p.label))];
  const cell = (r, lab, w)=>{ const p = r && r.phases.find(x=> x.label === lab); return p ? `${f(p[w].med)} / ${f(p[w].p90)} / ${f(p[w].max)}` : '–'; };
  table(['while', 'smoothing changed: today', 'live', 'next sample: today', 'live'], labels.map(lab=> [lab, cell(h, lab, 'smooth'), cell(l, lab, 'smooth'), cell(h, lab, 'next'), cell(l, lab, 'next')]));
}

out('REFINE ALL (12 patterns) where it runs (ms, median of 5)');
{
  const h = rd('refine-speed-head'), l = rd('refine-speed-live'), v = rd('refine-speed-live-visibility');
  table(['', 'on show', 'hidden', 'hidden frame: rAF / setTimeout(0) per s'], [
    ['today', h ? f(h.sum.shownMed) : '–', '(stopped on leave)', '–'],
    ['live, display:none', l ? f(l.sum.shownMed) : '–', l ? f(l.sum.hiddenMed) : '–', l ? l.sum.rates.map(r=> r.raf + ' / ' + r.timeout0).join(', ') : '–'],
    ['live, visibility:hidden', v ? f(v.sum.shownMed) : '–', v ? f(v.sum.hiddenMed) : '–', v ? v.sum.rates.map(r=> r.raf + ' / ' + r.timeout0).join(', ') : '–']]);
  const c = rd('refine-concurrent');
  if (c) table(['K tabs refining at once', 'round (median)', 'each run (median)', 'throughput vs one'], c.sum.map(x=> [String(x.K), f(x.roundMed), f(x.eachMed), f(x.throughput, 2) + '×']));
}

out('STARTUP with N tabs stored (navigation → two frames in the tab on show, median of 5, ms; memory 3 s after)');
{
  const rows = [];
  for (const N of [4, 8]){
    const h = rd('boot-head-' + N), l = rd('boot-live-' + N), ll = rd('boot-live-' + N + '-lean');
    const c = (v, name)=> v ? `${f(v.shownMed)}${v.allMed ? ' (all ' + f(v.allMed) + ')' : ''}; long ${f(v.longMsMed)}; ${f(v.mem.rss)} MB RSS, ${f(v.mem.heap)} heap, ${v.mem.frames} frames` : '–';
    rows.push([String(N), c(h && h.variants.parked), c(l && l.variants.lazy), c(l && l.variants.eager), c(ll && ll.variants.lazy)]);
  }
  table(['N', 'today', 'live lazy', 'live eager', 'live lazy, lean'], rows);
}

out('OPTIMISATIONS');
{
  const fr = rd('opt-free'), mx = rd('opt-max'), ih = rd('opt-idle-head'), il = rd('opt-idle-live');
  if (fr) table(['4 SEM tabs hidden', 'renderer RSS', 'JS heap', 'switch to a SEM tab (median)'], fr.runs.map(r=> [JSON.stringify(r.knobs), f(r.mem.rss), f(r.mem.heap), f(r.switchToSemMed)]));
  if (mx) table(['8 tabs', 'frames', 'renderer RSS', 'JS heap', 'workers'], mx.runs.map(r=> [JSON.stringify(r.knobs), String(r.frames), f(r.mem.rss), f(r.mem.heap), String(r.mem.workers)]));
  if (ih || il) table(['idle 20 s, 8 tabs', 'CPU s by process', 'renderer RSS'], [ih, il].filter(Boolean).map(r=> [r.runs[0].mode, JSON.stringify(r.runs[0].cpuSecondsIn20s), f(r.runs[0].mem.rss)]));
}

out('LIMITS (limits.mjs)');
{
  const l = rd('limits');
  if (l) l.checks.forEach(c=> out((c.ok ? 'ok   ' : 'FAIL ') + c.name));
}
const text = lines.join('\n');
console.log(text);
fs.writeFileSync(path.join(RESULTS, 'summary.txt'), text + '\n');
