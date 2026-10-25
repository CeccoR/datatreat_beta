/* The tables of the README, from results/*.json (each script's own). node summary.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { RESULTS, med, r1, r2 } from './lib.mjs';
const read = n =>{ try { return JSON.parse(fs.readFileSync(path.join(RESULTS, n), 'utf8')); } catch(e){ return null; } };
const s = x => (x == null || Number.isNaN(x)) ? '–' : (x/1000).toFixed(2) + ' s';
const line = a => '| ' + a.join(' | ') + ' |';
const head = h => [line(h), line(h.map(()=> '---'))].join('\n');

const pool = read('pool.json');
if (pool){
  console.log('## Refine all in the app, on k workers (pool.mjs; medians of 5, default settings)\n');
  console.log(head(['k', 'wall', 'speed-up vs HEAD', 'first (cold)', 'CPU total', 'workers\' CPU', 'main thread CPU', 'cores busy (workers)', 'main thread busy (CDP)', 'long tasks (ms, longest)', 'RSS idle after GC', 'worker heaps idle', 'RSS peak', 'identical / in order / progress']));
  const hd = pool.runs.head && pool.runs.head.sum.wallMed;
  for (const [key, r] of Object.entries(pool.runs)){
    const x = r.sum;
    console.log(line([key === 'head' ? 'HEAD (1)' : key, s(x.wallMed), hd ? r2(hd/x.wallMed) + '×' : '–', s(x.cold), x.cpuTotalMed + ' s', x.cpuWorkersMed + ' s', x.cpuMainMed + ' s', r2(x.cpuWorkersMed/(x.wallMed/1000)),
      x.mainTaskMed + ' s', x.longMsMed + ' (' + x.longMaxMax + ')', x.rssIdle + ' MB', (x.workerHeaps || []).map(r1).join(', ') + ' MB', x.peak ? x.peak.peak + ' MB' : '–',
      [x.allIdentical, x.allInOrder, x.progress && x.progress.monotonic && x.progress.prefix].map(b=> b ? 'yes' : 'NO').join(' / ')]));
  }
  console.log('\nStatus lines seen (k = 3):', JSON.stringify((pool.runs['3'] || pool.runs.head).runs[1].progress.statuses));
  console.log();
}
const inter = read('interact.json');
if (inter){
  console.log('## Working in the tab while its Refine all runs (interact.mjs; ms, median / p90 / max of 12)\n');
  console.log(head(['tree, k', 'nothing runs: next', 'smoothing', 'its Refine all running: next', 'smoothing']));
  const keys = [...new Set(Object.keys(inter.sum).map(k=> k.split(' ')[0]))];
  for (const k of keys){
    const a = inter.sum[k + ' none'], b = inter.sum[k + ' run'], f = v => v ? `${v.med} / ${v.p90} / ${v.max}` : '–';
    console.log(line([k === 'head' ? 'HEAD (1)' : 'pool, ' + k, f(a && a.next), f(a && a.smooth), f(b && b.next), f(b && b.smooth)]));
  }
  console.log();
}
const saf = read('safety.json');
if (saf){
  console.log('## Cancel, history, workers (safety.mjs, k = ' + saf.k + ', ' + saf.sum.rounds + ' rounds)\n');
  console.log(JSON.stringify(saf.sum));
  console.log('per round:', saf.rounds.map(v=> `${v.written.length} written (gaps ${v.gaps.length}) cancel ${v.cancelMs} ms, pool before ${JSON.stringify(v.poolBefore)} after ${JSON.stringify(v.poolAfter)}`).join('; '));
  console.log();
}
for (const f of ['bench-heavy.json', 'bench-default-cpus4.json', 'bench-default-cpus3.json', 'bench-default-cpus2.json', 'bench-default-cpus1.json']){
  const b = read(f);
  if (!b) continue;
  console.log(`## Bench ${b.conf}, CPUs ${b.cpus} (${f}; medians of ${b.runs[0].walls.length})\n`);
  console.log(head(['k', 'hardwareConcurrency', 'wall', 'speed-up', 'job (median)', 'CPU total', 'workers\' CPU', 'cores busy', 'same as k=1, in order', 'main-thread probe med / p95 (idle)', 'long tasks', 'RSS: page / k idle / peak']));
  const k1 = b.runs[0].wallMed;
  for (const r of b.runs) console.log(line([r.k, r.hc, s(r.wallMed), r2(k1/r.wallMed) + '×', Math.round(r.jobMsMed) + ' ms', r.cpuMed + ' s', r.cpuWorkersMed + ' s', r2(r.cpuWorkersMed/(r.wallMed/1000)),
    (r.sameAsK1 ? 'yes' : 'NO') + ', ' + (r.inOrder ? 'yes' : 'NO'), `${r.workMed} / ${r.workP95} (${r.idleWorkMed})`, r.longTasks.reduce((a, c)=> a + c, 0), `${r.mem0.rss} / ${r.memIdleK.rss} / ${r.peak && r.peak.peak} MB`]));
  console.log();
}
const tabs = read('tabs.json');
if (tabs){
  console.log('## Runs in several tabs at once (tabs.mjs; medians of 5 rounds)\n');
  console.log(head(['tree', 'K tabs', 'each run', 'all (first click → last end)', 'starts spread', 'CPU total', 'main thread CPU', 'workers alive (most)', 'RSS peak', 'longest long task', 'identical, in order']));
  for (const [key, o] of Object.entries(tabs.runs)) for (const x of o.sum)
    console.log(line([key, x.K, s(x.eachMed), s(x.allMed), s(x.staggerMed), x.cpuMed + ' s', x.mainMed + ' s', x.threadsMax, x.rssPeakMed + ' MB', x.longMaxMax + ' ms', (x.identical ? 'yes' : 'NO') + ', ' + (x.inOrder ? 'yes' : 'NO')]));
  console.log();
}
const std = read('std.json');
if (std){
  console.log('## The standard and the samples (std.mjs; medians)\n');
  console.log(head(['tree', 'case', 'the standard', 'the samples', 'in all', 'n']));
  const S = std.sum;
  for (const [t, cs] of [['HEAD', S.head], ['pool, 3', S.pool]]) for (const [c, v] of Object.entries(cs)) console.log(line([t, c, s(v.std), s(v.samples), s(v.total), v.n]));
  console.log(line(['pool, 3, guard lifted', 'the standard (another file) refined while the samples run', s(S.along.std), s(S.along.samples), s(S.along.both), std.along.length]));
  console.log('\nstale after "along":', S.along.stale.join(', '), '; profile changed:', S.along.profileChanged.join(', '), '; note on the card:', std.along.map(v=> v.note).join(', '));
}
const sim = read('simulate.json');
if (sim){
  console.log('\n## Extrapolation (simulate.mjs)\n');
  console.log(sim.text);
}
