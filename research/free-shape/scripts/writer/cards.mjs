// The result card of the merged rule, written by script (FREE-SHAPE.md §6.5), for named runs.
// Per axis of the reported solid: its column length ⟨L⟩_V with the merged rule's interval (E_L at
// Δ ≤ τ: today's esds in the width, widened to the search's ends; the jackknife's D·e^(±2 sd) when
// the misfit flag fires, an infinite sd opening the upper end only), its direction with today's
// angular radius (2σ of turnEsds, none over 30°) widened by the jackknife's 2·rms turn, and no
// direction where its extent's interval overlaps another's (the D rule). Labels: an extent is
// "measured" (hi/lo ≤ 1.25²), a "range" (closed) or a "lower bound" (open above); a direction is
// "fixed" (radius ≤ 10°) or "approximate" (≤ 30°). Habit by the bounds: plate when the middle's
// lower limit is at least twice the thickness's upper one, needle when the longest's lower limit is
// at least twice the middle's upper one, lath both, block otherwise. Level: resolved (every extent
// measured, every direction fixed), partly resolved (the thickness measured and its direction fixed,
// or a needle's longest extent and its axis), not resolved; a run whose solid the app rejects: one
// size, "no solid supported at the app's threshold". Each claim is checked against the truth.
// Reads results only.
//   node cards.mjs <fs root> [--tau 12.5] [--flag6 runs.json] case#seed …
import fs from 'node:fs';
import path from 'node:path';
import { loadRun, Lprin, angAx, dimOf, alignL } from '../presentation/plib.mjs';
import { E_L } from '../presentation/approaches.mjs';
import { nameAxis, harmL } from '../presentation/oneresult.mjs';
import { compareSolids } from '../harness/lib.mjs';
const FS = path.resolve(process.argv[2]);
const a = process.argv.slice(3), opt = { keys: [] };
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')) opt[a[i].slice(2)] = a[++i]; else opt.keys.push(a[i]); }
const tau = +(opt.tau || 12.5);
const FLAG6 = opt.flag6 ? new Set(JSON.parse(fs.readFileSync(opt.flag6, 'utf8'))) : new Set();
const score = new Map(JSON.parse(fs.readFileSync(path.join(FS, 'uniqueness/results/score10/score.json'), 'utf8')).map(r=> [r.run, r]));
const nm = x => !Number.isFinite(x) ? '∞' : x < 10 ? x.toFixed(2) : x < 100 ? x.toFixed(1) : x.toFixed(0);
const idx = t => '[' + t.map(x=> x < 0 ? String(-x) + '̅' : String(x)).join('') + ']';
const DET = 1.25*1.25;

export function card(key){
  const [id, s] = key.split('#'), R = loadRun(id, +s);
  if (!R.base) return `**${key}**: no run.`;
  const T = R.truth, head = `**${key}**${T ? ` (truth: ${T.type} ${T.dims.map(nm).join(' × ')} nm)` : ''}`;
  if (!R.base.kept){
    const D = dimOf(R.iso.Ys), dB = R.base.dBIC;
    const tgain = R.tref && Number.isFinite(R.tref.chi2Best) ? (R.iso.chi2 - R.tref.chi2Best)/Math.max(1, R.iso.chi2nu) : NaN;
    return `${head}. *One size:* ${nm(D)} nm. No solid is supported at the app's threshold: the best shape found has ΔBIC ${dB >= 0 ? '+' : '−'}${Math.abs(dB).toFixed(0)} against one size, and −10 is needed.${Number.isFinite(tgain) && T ? ` [Check: the truth's own solid gains ${tgain.toFixed(1)} χ²_ν over one size.]` : ''}`;
  }
  const u = score.get(key), rep = R.uq.reported.solid, L = Lprin(rep), E = E_L(tau)(R);
  const flag = !!(u && u.misfit) || FLAG6.has(key), J = u && u.jack ? u.jack.J : null;
  const iv = E.iv.map(x=> x.slice());
  const rad = [0, 1, 2].map(i=> { const q = u && u.iv && u.iv.app && u.iv.app.q[i]; return q && q.ang != null && q.ang <= 30 ? q.ang : null; });
  if (flag && J) for (let i = 0; i < 3; i++){
    const sd = J[i].sdLog == null ? Infinity : J[i].sdLog;
    if (Number.isFinite(L[i])){ if (Number.isFinite(sd)) iv[i][0] = Math.min(iv[i][0], L[i]*Math.exp(-2*sd)); iv[i][1] = Math.max(iv[i][1], Number.isFinite(sd) ? L[i]*Math.exp(2*sd) : Infinity); }
    if (rad[i] != null && J[i].rmsAng != null) rad[i] = Math.max(rad[i], 2*J[i].rmsAng);
  }
  const apart = i => [0, 1, 2].every(j=> j === i || iv[i][1] < iv[j][0] || iv[i][0] > iv[j][1]);
  const ord = [0, 1, 2].sort((x, y)=> L[x] - L[y]), [t, m, l] = ord;
  const lo = i => iv[i][0];
  const plate = lo(m) >= 2*iv[t][1], needle = lo(l) >= 2*iv[m][1];
  const habit = plate && needle ? 'Lath' : plate ? 'Plate' : needle ? 'Needle' : 'Block';
  const det = i => iv[i][1]/Math.max(iv[i][0], 1e-9) <= DET;
  const dir = i => rad[i] != null && rad[i] <= 30 && apart(i) ? rad[i] : null;
  const fixed = i => dir(i) != null && dir(i) <= 10;
  const all = ord.every(det) && ord.every(i=> rep.type === 'spheroid' || rep.type === 'cylinder' ? (i < 2 || fixed(i)) : fixed(i));
  const level = all ? 'resolved' : (det(t) && fixed(t)) || (needle && det(l) && fixed(l)) ? 'partly resolved' : 'not resolved';
  // checks against the truth (column lengths paired by size and orientation as the scoring does)
  let check = '';
  if (T){
    const al = alignL(T, rep), LT = Lprin(T), bad = [];
    ord.forEach((i, k)=> { const p = al.per[i], x = LT[p.fi];
      if (det(i) && !(x >= iv[i][0]*0.999 && x <= iv[i][1]*1.001)) bad.push(`${["thickness", "middle", "longest"][k]} ${nm(x)} nm outside its interval`);
      else if (!det(i) && !(x >= iv[i][0]*0.999 && x <= iv[i][1]*1.001)) bad.push(`${["thickness", "middle", "longest"][k]} ${nm(x)} nm outside its range`);
      const r = dir(i); if (r != null && p.angle != null && p.angle > r + 1e-6) bad.push(`${["thickness", "middle", "longest"][k]} direction ${p.angle.toFixed(1)}° off, radius ${r.toFixed(1)}°`); });
    const th = habit.toLowerCase();
    check = ` [Check against the truth: ${bad.length ? bad.join("; ") : "every stated interval and radius holds"}.]`;
  }
  const word = ['Thickness', 'Middle', 'Longest'];
  const parts = ord.map((i, k)=> {
    const [a0, a1] = iv[i], e = L[i];
    const len = !Number.isFinite(e) ? `unbounded${a0 > 0 ? `, over ${nm(a0)} nm` : ''}, a lower bound` : !Number.isFinite(a1) ? `${nm(e)} nm, over ${nm(a0)} nm, a lower bound` : `${nm(e)} nm (${nm(a0)}–${nm(a1)})${det(i) ? ', measured' : ', a range'}`;
    let d = '';
    const r = dir(i), ax = rep.axes[i];
    if (rep.type === 'spheroid' || rep.type === 'cylinder' ? i < 2 : false) d = '';
    else if (r == null) d = rad[i] == null ? ', no direction (radius over 30°)' : ', no direction (not told apart from another extent)';
    else { const n = nameAxis(ax); d = `, along ${idx(n.t)} ${n.angle < 0.05 ? '' : `(${n.angle.toFixed(1)}° from it) `}±${r.toFixed(1)}° (${r <= 10 ? 'fixed' : 'approximate'})`; }
    return `${word[k]} ${len}${d}.`;
  });
  const misfit = u && u.worstSeg != null ? `Misfit ${flag ? 'flagged' : 'not flagged'} (worst line segment χ²_ν ${u.worstSeg.toFixed(2)}${!u.misfit && flag ? ', flagged at degree 6' : ''}). ` : '';
  // one sphere whose ⟨L⟩_V (3D/4) is the harmonic mean column length over all directions
  // ±3 %: the presentation study's measured error of this reading on clean data (78 of 80 runs); not
  // claimed under a misfit flag (the proxies' reading is 14 % off at degree 6)
  const size = `Size over all directions ${nm(4/3*harmL(rep))} nm${flag ? '' : ' ±3 %'} (one sphere's diameter).`;
  const drawn = `Drawn: the ${rep.type} ${rep.dims.map(nm).join(' × ')} nm, ${R.base.held ? 'held on the lattice' : 'orientation free'}.`;
  return `${head}. *${habit}, ${level}.* ${misfit}${parts.join(' ')} ${size} ${drawn}${check}`;
}
for (const k of opt.keys) console.log(card(k) + '\n');
