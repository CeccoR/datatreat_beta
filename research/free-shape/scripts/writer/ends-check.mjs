// Does E_L6 (the presentation study's interval: today's esds in the width, widened to the search's
// own ends within Δ 6, as column lengths) keep its coverage when the ends come from a cheaper search?
// The presentation study scored it on the app's search log. Here the same construction takes the
// ends of fwd, c1 (optimiser study) or a4, cfam (starts study) instead, around the same reported
// solid (the app's, whose esds the uniqueness study recorded), on the 80 synthetic runs that kept a
// solid. Reads results only; runs nothing.
//   node ends-check.mjs <fs folder> [--tau 12.5] [--md out.md]
// (fix: --tau, the Δ of the ends taken; 6 as first published, 12.5 as recommended after review)
import fs from 'node:fs';
import path from 'node:path';

const FS = path.resolve(process.argv[2] || '.');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const TAU = +(arg('--tau') || 6);
const { loadRun, CASES, alignL, Lprin, inside } = await import(path.join(FS, 'presentation/plib.mjs'));
const { E_L } = await import(path.join(FS, 'presentation/approaches.mjs'));
const { readResult } = await import(path.join(FS, 'harness/lib.mjs'));

const SRC = {
  'app (as scored)': null,
  fwd: [['optimizer/results/f-fwd', 'fwd']],
  c1: [['optimizer/results/f-c1', 'c1']],
  a4: [['starts/results/r3', 'a4'], ['starts/results/r4', 'a4']],
  cfam: [['starts/results/r2b', 'cfam']],
};
const recOf = (src, id, seed) => {
  for (const [d, m] of src) {
    const f = path.join(FS, d, `${id}-${seed}.json`);
    if (!fs.existsSync(f)) continue;
    const r = readResult(fs.readFileSync(f, 'utf8')).records.find(x => x.method === m);
    if (r) return r;
  }
  return null;
};
const LT = Math.log(1.25), DET = 1.25 * 1.25;
const srt = s => s.dims.map(d => Number.isFinite(d) ? d : Infinity).sort((x, y) => x - y);
const same = (a, b) => { if (!a || !b || a.type !== b.type) return false; const x = srt(a), y = srt(b);
  return x.every((d, i) => (d === Infinity && y[i] === Infinity) || Math.abs(Math.log(d / y[i])) < 0.05); };

const L = [`E_L(${TAU}) on the`+' 80 synthetic runs that kept a solid, with the ends of each search (around the app\'s reported solid and its esds). covered = the truth inside the interval; determined: hi/lo ≤ 1.25²; accurate: within 25 %. "same solid": the search reported the app\'s solid type with every dimension within 5 % (sorted; orientation not compared).', '',
  `| ends from | runs | same solid | ends within Δ ${TAU} a run (mean) | thinnest covered | middle covered | longest covered | median hi/lo thin / mid / long | extents determined: accurate | principal axis covered (of claimed) |`,
  '|---|---|---|---|---|---|---|---|---|---|'];
for (const [name, src] of Object.entries(SRC)) {
  const S = { n: 0, same: 0, ends: 0, cov: [0, 0, 0], f: [[], [], []], det: 0, acc: 0, pc: 0, pn: 0 };
  for (const c of CASES.filter(c => c.kind === 'synth')) for (const seed of c.seeds) {
    const R = loadRun(c.id, seed);
    if (!R.base || !R.base.kept || !R.truth || !(R.uq && R.uq.reported)) continue;
    let base = R.base;
    if (src) { const r = recOf(src, c.id, seed); if (!r || !r.kept) continue; base = r; }
    S.n++; if (same(base.solid, R.base.solid)) S.same++;
    const R2 = { ...R, base: { ...R.base, log: base.log, chi2Best: base.chi2Best, chi2nu: base.chi2nu } };
    const res = E_L(TAU)(R2);
    S.ends += (res.spread ? 1 : 0) && 0;
    const al = alignL(res.solid, R.truth), tv = Lprin(R.truth), est = Lprin(res.solid);
    const ord = [0, 1, 2].sort((x, y) => tv[x] - tv[y]);
    ord.forEach((ri, k) => {
      const p = al.per[ri], iv = res.iv[p.fi], t = tv[ri];
      if (inside(t, iv)) S.cov[k]++;
      if (Number.isFinite(iv[1])) S.f[k].push(iv[1] / iv[0]);
      if (iv[1] / Math.max(1e-9, iv[0]) <= DET) { S.det++; if (Math.abs(Math.log(est[p.fi] / t)) <= LT) S.acc++; }
    });
    const pp = al.per[al.prin];
    if (pp && pp.angle != null && res.cone[pp.fi] < 180) { S.pn++; if (pp.angle <= res.cone[pp.fi]) S.pc++; }
    // ends within Δ 6 (the construction's own count)
    const L0 = (base.log || []).filter(l => l.to && Number.isFinite(l.c));
    const ex = L0.filter(l => !l.soft || ['ellipsoid', 'spheroid'].includes(l.to.type));
    const c0 = Math.min(...(ex.length ? ex : L0).map(l => l.c), base.chi2Best ?? Infinity), nu0 = Math.max(1, base.chi2nu || 1);
    S.ends += L0.filter(l => (l.c - c0) / nu0 <= TAU).length;
  }
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)].toFixed(2) : '—'; };
  L.push(`| ${name} | ${S.n} | ${S.same} | ${(S.ends / S.n).toFixed(1)} | ${S.cov[0]}/${S.n} | ${S.cov[1]}/${S.n} | ${S.cov[2]}/${S.n} | ${S.f.map(med).join(' / ')} | ${S.acc}/${S.det} | ${S.pc}/${S.pn} |`);
}
const md = L.join('\n');
console.log(md);
if (arg('--md')) fs.writeFileSync(arg('--md'), md + '\n');
