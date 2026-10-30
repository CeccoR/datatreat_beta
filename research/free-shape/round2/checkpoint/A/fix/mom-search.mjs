#!/usr/bin/env node
/* [fix] mom's search beside lsq's on the sub-screen (analyse.mjs --json digest of lor, mom, lsq, wppm):
   per group (clean, error, all) the kept solids' worst extent (median, 90th), thinnest, axis, unbounded;
   reach for mom from the kept solid's χ² (its runs were timed without the refinement log that the
   best-end χ² needs, so Δ here is an upper bound), for the others from analyse's own Δ.
   node fix/mom-search.mjs results/sub-mom-digest.json */
import fs from 'node:fs';
const D = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const num = x => typeof x === 'number' ? x : x === 'Infinity' ? Infinity : NaN;
const qtl = (xs, p) => { const s = xs.filter(x=> !Number.isNaN(x)).sort((a, b)=> a - b); if (!s.length) return NaN; const i = (s.length - 1)*p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi || s[lo] === s[hi] ? s[lo] : !Number.isFinite(s[hi]) ? s[hi] : s[lo] + (s[hi] - s[lo])*(i - lo); };
const pc = x => x === Infinity ? '+∞' : Number.isNaN(x) ? '—' : (x >= 0 ? '+' : '') + (100*x).toFixed(0) + ' %';
const { readResult } = await import('../harness/lib.mjs');
for (const [g, sel] of [['clean', d=> d.err === 'none'], ['error', d=> d.err !== 'none'], ['all', ()=> true]]){
  for (const v of ['lor', 'mom', 'lsq', 'wppm']){
    const h = D.filter(d=> d.v === v && sel(d)), k = h.filter(d=> d.acc && d.dimT);
    const worst = k.map(d=> Math.max(...d.dimT.map(x=> Math.abs(num(x))))), thin = k.map(d=> num(d.dimT[0])), ax = k.map(d=> num(d.acc.principal));
    let reach = '';
    if (v === 'mom'){
      let ok = 0, n = 0;
      for (const d of h){ if (!d.ref || d.out === 'early' || d.out === 'rejected') continue; n++;
        const o = readResult(fs.readFileSync(`results/s-mom/${d.id}.json`, 'utf8')), T = o.records.find(r=> r.method === 'today'), R = o.records.find(r=> r.method === 'truth');
        const best = Math.min(T.chi2, R.chi2Best), del = (T.chi2 - best)/Math.max(1, best/Math.max(1, o.iso.N - R.P)); if (del <= 1) ok++; }
      reach = `${ok}/${n} (upper-bound Δ)`;
    } else reach = `${h.filter(d=> Number.isFinite(d.delta) && d.delta <= 1).length}/${h.filter(d=> Number.isFinite(d.delta)).length}`;
    console.log(`${g.padEnd(5)} ${v.padEnd(4)} kept ${k.length}/${h.length} reach ${reach} | worst ${pc(qtl(worst, 0.5))} (${pc(qtl(worst, 0.9))}) thinnest ${pc(qtl(thin, 0.5))} axis ${qtl(ax, 0.5).toFixed(1)} (${qtl(ax, 0.9).toFixed(1)}) unbounded ${worst.filter(x=> x === Infinity).length}`);
  }
}
