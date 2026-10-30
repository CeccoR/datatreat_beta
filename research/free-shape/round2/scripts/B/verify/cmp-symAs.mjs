// symAs (symA with the fill's random numbers drawn and discarded) against B's symA and fwd/fwdH on
// the same rows: evaluations (C accounting: search less the covOnly), outcome, best exact χ², Δ.
import fs from 'node:fs';
import { readResult, compareSolids, laueRotations } from '../B/h/lib.mjs';
const FS2 = new URL('..', import.meta.url).pathname.replace(/\/$/, '');   // $W/fs2 (this script ran from $W/fs2/B-verify)
const rd = f => readResult(fs.readFileSync(f, 'utf8'));
const SC = JSON.parse(fs.readFileSync(FS2 + '/B/results/screen-score.json', 'utf8'));
const find = (id, m) => { for (const t of ['sub1', 'sub2', 'sub2s', 'full', 'sym25', 'held30']){ const f = `${FS2}/B/results/${t}/${id}.json`; if (!fs.existsSync(f)) continue; const o = rd(f); const r = o.records.find(x => x.method === m); if (r) return { o, r, t }; } return null; };
const evC = r => r.search.evals - (r.var.covOnly ? r.var.covOnly.ev : 0);
const out = r => r.kept ? (r.held ? 'held' : 'free') : r.rejected ? (r.early ? 'early' : 'rej') : 'none';
const ids = fs.readFileSync(FS2 + '/B-verify/symAs/rows.txt', 'utf8').split('\n').filter(Boolean);
let S = { s: 0, a: 0, f: 0 };
for (const id of ids){
  const mine = rd(`${FS2}/B-verify/symAs/${id}.json`), s = mine.records[0];
  const A = find(id, 'symA').r, F = find(id, 'fwd').r, row = SC.runs.find(x => x.id === id);
  const dupEv = (F.var.heldDup || []).reduce((t, d) => t + (d.ev || 0), 0);
  const fH = evC(F) - dupEv;      // fwdH*C
  const best = Math.min(row.best, s.chi2Best ?? Infinity), nu = Math.max(1, row.nuB);
  const d = x => x == null || !Number.isFinite(x) ? '—' : ((x - best) / nu).toFixed(2);
  const vsA = s.solid && A.solid ? compareSolids(s.solid, A.solid, { rots: laueRotations(mine.phase) }) : null;
  const vsF = s.solid && F.solid ? compareSolids(s.solid, F.solid, { rots: laueRotations(mine.phase) }) : null;
  const ch = c => c ? `${(100 * Math.max(...c.dimErr.map(e => Math.abs(e)))).toFixed(1)}%/${(c.principal ?? 0).toFixed(1)}°` : '—';
  S.s += evC(s); S.a += evC(A); S.f += fH;
  console.log(`${id.padEnd(24)} ev symAs ${evC(s)} symA ${evC(A)} fwdH* ${fH} | out ${out(s)}/${out(A)}/${out(F)} | Δ symAs ${d(s.chi2Best)} symA ${d(A.chi2Best)} fwd ${d(F.chi2Best)} | solid vs symA ${ch(vsA)} vs fwd ${ch(vsF)}`);
}
console.log(`sum: symAs ${S.s} symA ${S.a} fwdH*C ${S.f}; symAs/fwdH* ${(S.s / S.f).toFixed(3)}, symA/fwdH* ${(S.a / S.f).toFixed(3)}`);
