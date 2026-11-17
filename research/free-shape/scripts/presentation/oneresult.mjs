#!/usr/bin/env node
/* ONE result with its resolution, from one run's inputs (the proposal; v2).
   - The solid: the reported fit of the solid the user chose (held on the lattice when the
     app holds it), drawn as today.
   - Its quantities as column lengths ⟨L⟩_V along the solid's axes (class-independent: a
     box's edge, a cylinder's height, 3/4 of an ellipsoid's axis), thinnest, middle, longest.
   - Their 95 % intervals: today's report (linear esds with the held/free difference, taken in
     the width: P0w) widened
     to the values of the search's own ends within Δ ≤ τ (6: E_app6 of approaches.mjs; no
     pattern evaluated beyond today's; E_appW6), then, when given, to the background-degree variants'
     (sys.mjs: the model term). Cones: today's angular esds × 2.45 (95 % of a tilt) widened
     by those fits' angles; over 30° no direction.
   - The habit from the intervals (lath: thin ≤ ½ middle and middle ≤ ½ long, both by their
     bounds; plate: the first only; needle: the second only; block: neither, i.e. no habit
     established). Intervals and cones: E_L (column lengths, ends paired by alignL).
   - Labels: a length is "measured" (closed, hi/lo ≤ 1.5), a "range" or a lower "bound"; an
     axis has a "direction" (cone ≤ 15°), an "approximate" one (≤ 30°) or none.
     Overall: resolved / partly resolved (naming what is) / not resolved; a solid not kept:
     "one size".
   - The size over all directions: the harmonic mean of ⟨L⟩_V over the sphere (what one
     isotropic size reads), its range over the same fits.
   - The solid class, when the other solids were searched: how many fit alike (ΔBIC ≤ 10),
     counted, not listed.
   node oneresult.mjs --set sample|synth [--seed 1] [--cases id,id] [--tau 6] [--sys] prints the cards. */
import fs from 'node:fs';
import path from 'node:path';
import { loadRun, CASES, Lprin, Lfactor, Lcol, align, angAx, fmt, HERE, R2D } from './plib.mjs';
import { CUBIC } from '../harness/lib.mjs';
import { E_L, endsOf, classFits } from './approaches.mjs';

const unit = v => { const n = Math.hypot(...v); return v.map(t=> t/n); };
const g = (a, b) => b ? g(b, a % b) : Math.abs(a);
/* the simplest lattice direction (indices ≤ 4) within 10° of a cubic Cartesian axis, else
   the nearest; its family ⟨uvw⟩ and the angle */
export function nameAxis(e){
  let near = null, low = null;
  for (let u = -4; u <= 4; u++) for (let v = -4; v <= 4; v++) for (let w = -4; w <= 4; w++){
    if (!u && !v && !w) continue;
    const t = [u, v, w], ang = angAx(t, e), cx = u*u + v*v + w*w;
    if (!near || ang < near.ang - 1e-6) near = { t, ang, cx };
    if (ang <= 10 && (!low || cx < low.cx || (cx === low.cx && ang < low.ang))) low = { t, ang, cx };
  }
  const b = low || near, d = b.t.reduce((x, y)=> g(x, y)), f = b.t.map(x=> Math.abs(x/d)).sort((x, y)=> y - x);
  // an axis has no sign: the form with fewer minus signs (then the first index positive)
  let t = b.t.map(x=> x/d); const neg = t.filter(x=> x < 0).length, pos = t.filter(x=> x > 0).length;
  if (neg > pos || (neg === pos && t.find(x=> x !== 0) < 0)) t = t.map(x=> -x);
  return { family: '⟨' + f.join('') + '⟩', angle: b.ang, t };
}
const idx = t => '[' + t.map(x=> x < 0 ? String(-x) + '\u0305' : String(x)).join('') + ']';
const mv = (M, v) => [M[0]*v[0] + M[1]*v[1] + M[2]*v[2], M[3]*v[0] + M[4]*v[1] + M[5]*v[2], M[6]*v[0] + M[7]*v[1] + M[8]*v[2]];
/* the axes named in one frame (as the app's framedAxes): the cubic rotation that takes the
   principal axis's lattice direction to its family's first member ([110], [001] → [100] …)
   is applied to all; each then named by its own [uvw] */
export function framedNames(axes, pi){
  const n0 = nameAxis(axes[pi]), canon = n0.t.map(Math.abs).sort((x, y)=> y - x);
  let best = null;
  for (const G of CUBIC) for (const sg of [1, -1]){
    const t = mv(G, n0.t).map(x=> sg*x);
    if (t.some((x, i)=> Math.abs(x - canon[i]) > 1e-9)) continue;
    const names = axes.map(a=> nameAxis(mv(G, a).map(x=> sg*x)));
    const score = names.reduce((s, n)=> s + n.t.filter(x=> x < 0).length + n.t.reduce((u, x)=> u + x*x, 0)/100, 0);
    if (!best || score < best.score) best = { score, names };
  }
  return best.names.map(n=> ({ ...n, label: idx(n.t) }));
}
const MEAS = 1.5, DIR = 15, NODIR = 30;
export const lenLabel = ([lo, hi]) => !Number.isFinite(hi) ? 'bound' : hi/Math.max(lo, 1e-9) <= MEAS ? 'measured' : 'range';
export const dirLabel = c => c <= DIR ? 'direction' : c <= NODIR ? 'approximate' : 'none';
const nm = x => !Number.isFinite(x) ? '∞' : x < 10 ? x.toFixed(2) : x < 100 ? x.toFixed(1) : x.toFixed(0);
const ivText = ([lo, hi], est) => !Number.isFinite(est) ? `unbounded${lo > 0 ? ` (over ${nm(lo)} nm)` : ''}` : !Number.isFinite(hi) ? `${nm(est)} nm, over ${nm(lo)} nm` : hi/Math.max(lo, 1e-9) <= 1.02 ? `${nm(est)} nm` : `${nm(est)} nm (${nm(lo)}–${nm(hi)})`;
const sname = { box: 'box', sqbox: 'square box', cylinder: 'cylinder', ellcyl: 'elliptic cylinder', ellipsoid: 'ellipsoid', spheroid: 'spheroid' };
const TYPES6 = ['spheroid', 'cylinder', 'sqbox', 'ellipsoid', 'box', 'ellcyl'];
const nPar = t => ({ spheroid: 4, cylinder: 4, sqbox: 5, ellipsoid: 6, box: 6, ellcyl: 6 })[t];
const DIRS = Array.from({ length: 400 }, (_, i)=> { const z = 1 - (2*i + 1)/400, r = Math.sqrt(1 - z*z), p = i*Math.PI*(3 - Math.sqrt(5)); return [r*Math.cos(p), r*Math.sin(p), z]; });
export const harmL = s => DIRS.length/DIRS.reduce((t, u)=> t + 1/Math.min(1e4, Lcol(s, u)), 0);
/* habit from the column lengths' intervals; an unbounded length whose lower limit is unknown
   counts as long (the data see no broadening along it) */
export function habitOf(L, iv, [t, m, l]){
  const lo = i => iv[i][0] > 0 ? iv[i][0] : Number.isFinite(L[i]) ? 0 : Infinity;
  const p = lo(m) >= 2*iv[t][1], n = lo(l) >= 2*iv[m][1];
  return p && n ? 'lath' : p ? 'plate' : n ? 'needle' : 'block';
}
// the same rule on a solid's own values (the truth's habit)
export function habitOfSolid(s){ const L = Lprin(s), o = [0, 1, 2].sort((a, b)=> L[a] - L[b]); return habitOf(L, L.map(x=> [x, x]), o); }

export function oneResult(R, { tau = 6, sys = null, cls = true, misfit = false } = {}){
  const out = { id: R.id, seed: R.seed, searched: R.type };
  if (!R.base || !R.base.kept){
    const Ys = R.iso && R.iso.Ys;
    out.status = 'isotropic'; out.label = 'one size';
    out.D = Ys > 0 ? 0.9*1.540598/(Ys*Math.PI/180)/10 : Infinity;
    out.dBIC = R.base && R.base.dBIC;
    out.lines = [`One size: D ${nm(out.D)} nm (as the size card).`, `No solid is supported: the best gains ΔBIC ${fmt(out.dBIC, 0)} on one size (−10 needed).`];
    out.claims = [{ q: 'isotropic', ok: null }];
    return out;
  }
  const b = E_L(tau)(R), rep = b.solid, type = rep.type;
  const f = [0, 1, 2].map(i=> Lfactor(type, i));
  const iv = b.iv.map(x=> x.slice()), cone = b.cone.slice();      // column lengths already
  // the model term: the background-degree variants' values and angles
  /* the model: the background's Chebyshev degree chosen by BIC at the shape stage (the kept
     solid refined again from itself at 6, 12, 18: sys.mjs). The picked degree's values are
     the result, today's relative intervals moved onto them (withPick of approaches.mjs);
     the range over the degrees is stated apart, as the model's part. */
  let sysNote = null, nuFit = R.base.chi2nu, rep2 = rep;
  if (sys){
    const thin0 = [0, 1, 2].sort((x, y)=> Lprin(rep)[x] - Lprin(rep)[y])[0];
    const pick = sys.vs.find(v=> v.dBIC === 0), v6 = sys.vs.find(v=> v.bg === 6) || sys.vs[0];
    const L0 = rep.dims.map((d, i)=> d*f[i]);
    // a measured length (hi/lo ≤ 1.5) moves with the pick; a poorly bound one takes the pick's value in (union)
    pick.mapped.forEach((p, i)=> { const Lp = p.D*f[i], k = Lp/L0[i];
      if (Number.isFinite(k) && k > 0 && iv[i][1]/iv[i][0] <= MEAS) iv[i] = [iv[i][0]*k, iv[i][1]*k];
      else iv[i] = [Math.min(iv[i][0], Lp), Math.max(iv[i][1], Lp)]; });
    rep2 = { ...rep, dims: pick.mapped.map(p=> p.D) };
    const ds = sys.vs.map(v=> v.mapped[thin0].D*f[thin0]);
    sysNote = { lo: Math.min(...ds), hi: Math.max(...ds), bgs: sys.vs.map(v=> v.bg), pick: pick.bg, nuPick: pick.chi2nu, nu6: v6.chi2nu };
    nuFit = pick.chi2nu;
  }
  /* the misfit bound: for a linear fit an unmodelled signal s moves a parameter p by at most
     σ_p·‖s‖_W (Cauchy–Schwarz on δp = C JᵀW s); the visible excess χ² − (N − P) estimates
     ‖s‖²_W (the part the model absorbed is not seen). Applied when χ²_ν is past the noise's
     2σ, 1 + 2√(2/(N − P)); σ from each interval's half-width on its side (/1.96, in log),
     a cone's from its half-angle (/2.45). No evaluation. */
  let mis = null;
  if (misfit){
    const nu = nuFit, N = R.iso.N, Pp = R.base.P, dof = N - Pp;
    if (nu > 1 + 2*Math.sqrt(2/dof)){
      const r = Math.sqrt((nu - 1)*dof);
      const est = rep2.dims.map((d, i)=> Number.isFinite(d) ? d*f[i] : Infinity);
      // 'flag': the bound is stated on the card, the intervals stay the data's
      mis = { nu, r, bound: [0, 1, 2].map(i=> { const e = est[i], [lo] = iv[i]; return Number.isFinite(e) && lo > 0 ? Math.exp(r*Math.log(e/lo)/1.96) - 1 : NaN; }), coneBound: cone.map(c=> c < 180 ? c*r/2.45 : NaN) };
      if (misfit !== 'flag') for (let i = 0; i < 3; i++){
        const e = est[i]; if (!Number.isFinite(e)) continue;
        const [lo, hi] = iv[i];
        const sl = Math.log(e/lo)/1.96, sh = Number.isFinite(hi) ? Math.log(hi/e)/1.96 : Infinity;
        iv[i] = [lo*Math.exp(-sl*r), Number.isFinite(sh) ? hi*Math.exp(sh*r) : Infinity];
      }
      if (misfit !== 'flag') for (let i = 0; i < 3; i++) if (cone[i] < 180) cone[i] = cone[i]*(1 + r/2.45);
    }
  }
  out.misfit = mis;
  for (let i = 0; i < 3; i++) if (cone[i] > NODIR) cone[i] = 180;
  const L = rep2.dims.map((d, i)=> Number.isFinite(d) ? d*f[i] : Infinity);
  const ivL = iv;
  const ord = [0, 1, 2].sort((x, y)=> L[x] - L[y]), [t, m, l] = ord;
  // a length open with no known lower limit: at least the longest other one
  for (const i of [0, 1, 2]) if (!(ivL[i][0] > 0) && !Number.isFinite(L[i])) ivL[i] = [Math.max(...[0, 1, 2].filter(j=> j !== i).map(j=> Number.isFinite(L[j]) ? L[j] : 0)), Infinity];
  const habit = habitOf(L, ivL, ord);
  out.status = 'shape'; out.habit = habit; out.solid = rep2; out.L = L; out.ivL = ivL; out.cone = cone;
  const pi = habit === 'needle' ? l : habit === 'block' ? null : t;
  const names = framedNames(rep.axes, pi ?? t);
  const Q = i => ({ i, est: L[i], iv: ivL[i], label: lenLabel(ivL[i]), axis: rep.axes[i], cone: cone[i], dir: dirLabel(cone[i]), name: names[i] });
  out.q = { thin: Q(t), mid: Q(m), long: Q(l) };
  const P = pi == null ? null : Q(pi);
  const side = habit === 'needle' ? [out.q.thin, out.q.mid] : [out.q.mid, out.q.long];
  const apart = side[0].iv[1] < side[1].iv[0];
  const inDir = side.every(s=> s.dir !== 'none');
  const lat = [Math.min(side[0].iv[0], side[1].iv[0]), Math.max(side[0].iv[1], side[1].iv[1])];
  out.inplane = { apart, directions: inDir, range: lat };
  // what is resolved, in three levels: the principal extent and axis, the other extent(s),
  // the shape across (a plate's in-plane edges, a needle's section)
  const res = [];
  const sideMeas = side.every(s=> s.label === 'measured');
  if (habit === 'needle'){
    if (sideMeas && P.dir !== 'none') res.push('section and axis'); else if (P.dir !== 'none') res.push('axis'); else if (sideMeas) res.push('section');
    if (P.label === 'measured') res.push('length');
    if (apart && inDir) res.push('section shape');
  } else if (habit !== 'block'){
    if (P.label === 'measured' && P.dir !== 'none') res.push('thickness and normal'); else if (P.label === 'measured') res.push('thickness'); else if (P.dir !== 'none') res.push('normal');
    if (sideMeas) res.push(habit === 'lath' ? 'width and length' : 'lateral sizes');
    if (apart && inDir) res.push(habit === 'lath' ? 'their directions' : 'in-plane shape and edges');
  } else {
    const ms = [t, m, l].filter(i=> Q(i).label === 'measured').length; if (ms) res.push(`${ms} of 3 lengths`);
    if ([t, m, l].every(i=> Q(i).dir !== 'none')) res.push('axes');
  }
  const level = habit === 'block' ? (res[0] && res[0].startsWith('3') ? 1 : 0) + (res.includes('axes') ? 1 : 0) + (res[0] && res[0].startsWith('3') && res.includes('axes') ? 1 : 0)
    : (res.some(r=> /and (normal|axis)/.test(r)) ? 1 : 0) + (res.some(r=> /lateral|width and|^length/.test(r)) ? 1 : 0) + (res.some(r=> /shape|directions/.test(r)) ? 1 : 0);
  const full = level === 3;
  out.level = level;
  out.resolved = res;
  out.label = full ? 'resolved' : !res.length ? 'not resolved' : 'partly resolved';
  // the size over all directions, over the same fits (the reported, the ends within τ)
  const sols = [rep2, ...endsOf(R).filter(e=> e.D <= tau && e.solid.type === type).map(e=> e.solid)];
  // (rotation-invariant: an average over all directions; the background variants' too) ±3 %:
  // the noise's part, which the ends' range lacks (on the 80 synthetic runs the reported
  // value is 1.0 % from the truth's, median, 3.0 % at the 95th percentile)
  const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  if (sys) for (const v of sys.vs) if (v.bg !== sysNote.pick) sols.push({ type, dims: v.dims, axes: I3 });
  const H = sols.map(harmL);
  out.size = { est: H[0], lo: 0.97*Math.min(...H), hi: 1.03*Math.max(...H) };
  if (mis && misfit !== 'flag'){ out.size.lo *= Math.exp(-0.015*mis.r); out.size.hi *= Math.exp(0.015*mis.r); }
  // the solid class
  let clsLine = null;
  if (cls && Object.keys(R.xc).length >= 5){
    const cf = classFits(R);
    if (cf.fits && cf.fits.length){
      // τ 25: the truth's solid lies within it on 26 of 26 synthetic runs and 12 of 12 proxies (classcal.mjs)
      const TAUC = 25, alike = cf.fits.filter(x=> x.dBIC <= TAUC), own = cf.fits.find(x=> x.own), out6 = TYPES6.filter(t=> !alike.some(x=> x.type === t));
      out.classes = { alike: alike.map(x=> x.type), best: cf.fits[0].type, own: own && own.dBIC };
      const notRound = out6.includes('spheroid') && out6.includes('cylinder');
      clsLine = alike.length === 1 ? `Solid (compared): only the ${sname[alike[0].type]} fits (every other ΔBIC > ${TAUC}).`
        : `Solid (compared): not determined, ${alike.length} of 6 fit within ΔBIC ${TAUC}${notRound ? '; the bodies of revolution do not: the section is not round' : ''}. The lengths above are the same for each.`;
    }
  }
  // the card's lines
  const Lns = [];
  const H1 = { plate: 'Plate', lath: 'Lath', needle: 'Needle', block: 'Block' }[habit];
  Lns.push(`${H1} — ${out.label}${res.length && !full ? ': ' + res.join(', ') : ''}.`);
  if (habit === 'needle'){
    Lns.push(`Length (column length along the axis): ${ivText(P.iv, P.est)}.`);
    Lns.push(`Axis: ${P.dir === 'none' ? 'not determined (cone over 30°)' : `${P.name.label}${P.name.angle >= 1 ? ` ${P.name.angle.toFixed(0)}° off` : ''}, within ${P.cone.toFixed(P.cone < 10 ? 1 : 0)}° (95 %)`}.`);
  } else if (P){
    Lns.push(`Thickness (column length along the normal): ${ivText(P.iv, P.est)}.`);
    Lns.push(`Normal: ${P.dir === 'none' ? 'not determined (cone over 30°)' : `${P.name.label}${P.name.angle >= 1 ? ` ${P.name.angle.toFixed(0)}° off` : ''}, within ${P.cone.toFixed(P.cone < 10 ? 1 : 0)}° (95 %)`}.`);
  }
  if (habit === 'block'){
    for (const s of [out.q.thin, out.q.mid, out.q.long]) Lns.push(`Along ${s.dir === 'none' ? 'an axis not determined' : s.name.label}: ${ivText(s.iv, s.est)}.`);
  } else if (apart && inDir){
    const w = habit === 'needle' ? 'Section' : habit === 'lath' ? 'Width and length' : 'In the plane';
    Lns.push(`${w}: ${ivText(side[0].iv, side[0].est)} along ${side[0].name.label}, ${ivText(side[1].iv, side[1].est)} along ${side[1].name.label}.`);
  } else {
    Lns.push(`${habit === 'needle' ? 'Section' : 'Lateral'}: ${Number.isFinite(lat[1]) ? `${nm(lat[0])}–${nm(lat[1])} nm` : `over ${nm(lat[0])} nm`}; ${habit === 'needle' ? 'its shape' : 'the in-plane shape and edges'} not resolved${apart ? ' (their directions not determined)' : ''}.`);
  }
  if (habit === 'plate' || habit === 'lath'){ const a0 = lat[0]/P.iv[1], a1 = lat[1]/P.iv[0]; Lns.push(`Aspect (lateral/thickness): ${Number.isFinite(a1) ? `${a0.toFixed(1)}–${a1.toFixed(1)}` : `over ${a0.toFixed(1)}`}.`); }
  Lns.push(`Size over all directions: ${nm(out.size.est/0.75)} nm (${nm(out.size.lo/0.75)}–${nm(out.size.hi/0.75)}) as one sphere's diameter, the isotropic fit's reading.`);
  if (sysNote && P && sysNote.pick !== 6) Lns.push(`Background: degree ${sysNote.pick} chosen by BIC over ${sysNote.bgs.filter(g=> g !== sysNote.pick).join(' and ')} (χ²_ν ${sysNote.nu6.toFixed(2)} → ${sysNote.nuPick.toFixed(2)}). Over these degrees the ${habit === 'needle' ? 'length' : 'thickness'} reads ${nm(sysNote.lo)}–${nm(sysNote.hi)} nm${sysNote.hi/sysNote.lo > 1.05 ? ': the model, more than the noise, sets it' : ''}.`);
  if (mis && misfit !== 'flag') Lns.push(`Misfit: χ²_ν ${mis.nu.toFixed(2)} (the noise gives 1.00 ± ${(Math.sqrt(2/(R.iso.N - R.base.P))).toFixed(3)}): something in the pattern is not modelled; the intervals include the bias it can cause (up to ${mis.r.toFixed(0)} σ).`);
  if (mis && misfit === 'flag' && P){ const bp = mis.bound[P.i], cb = mis.coneBound[P.i]; Lns.push(`Misfit: χ²_ν ${mis.nu.toFixed(2)} (the noise: 1.00 ± ${(Math.sqrt(2/(R.iso.N - R.base.P))).toFixed(3)}). Something in the pattern is not modelled; it can move the ${habit === 'needle' ? 'length' : 'thickness'} by up to ${Number.isFinite(bp) ? Math.round(100*bp) + ' %' : '—'}${Number.isFinite(cb) ? ` and the ${habit === 'needle' ? 'axis' : 'normal'} by up to ${cb.toFixed(0)}°` : ''} beyond these intervals (a bound).`); }
  if (clsLine) Lns.push(clsLine);
  Lns.push(`Drawn: the ${sname[type]} ${rep2.dims.map(d=> nm(d)).join(' × ')} nm${R.base.held ? ', held on the lattice' : ''}.`);
  out.lines = Lns;
  return out;
}

/* claims of a card against the truth (synthetic and sample-like runs): each stated length
   holds the truth's column length along the paired axis; each stated direction holds the
   truth's paired axis within its cone; the habit matches the truth's by the same rule. */
export function claimsOf(o, R){
  if (o.status !== 'shape' || !R.truth) return null;
  const T = R.truth, al = align(o.solid, T), tL = Lprin(T);
  const out = [];
  al.per.forEach((p, ri)=> {
    const fi = p.fi, q = Object.values(o.q).find(x=> x.i === fi), t = tL[ri];
    const role = q === o.q.thin ? 'thin' : q === o.q.mid ? 'mid' : 'long';
    out.push({ kind: 'length', role, label: q.label, ok: t >= q.iv[0]*(1 - 1e-9) && t <= q.iv[1]*(1 + 1e-9), est: q.est, truth: t, lo: q.iv[0], hi: q.iv[1] });
    if (p.angle != null && q.dir !== 'none') out.push({ kind: 'direction', role, label: q.dir, ok: p.angle <= q.cone, angle: p.angle, cone: q.cone });
  });
  { const s = [...tL].sort((x, y)=> x - y), pl = s[0] <= s[1]/2, nd = s[2] >= 2*s[1];
    if (o.habit !== 'block') out.push({ kind: 'habit', label: o.habit, ok: o.habit === 'plate' ? pl : o.habit === 'needle' ? nd : pl && nd, truth: habitOfSolid(T) });
    else out.push({ kind: 'nohabit', label: 'block', ok: !pl && !nd, truth: habitOfSolid(T) }); }
  const hT = harmL(T); out.push({ kind: 'size', label: 'size', ok: hT >= o.size.lo && hT <= o.size.hi, err: o.size.est/hT - 1 });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`){
  const a = process.argv.slice(2), opt = {};
  for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
  const set = opt.set || 'sample';
  const cases = opt.cases ? opt.cases.split(',') : CASES.filter(c=> c.kind === set).map(c=> c.id);
  const sysF = path.join(HERE, 'results', `sys-${set}.json`), SY = opt.sys && fs.existsSync(sysF) ? JSON.parse(fs.readFileSync(sysF, 'utf8')) : null;
  const all = [];
  for (const id of cases){
    const c = CASES.find(x=> x.id === id);
    for (const s of opt.seed ? [+opt.seed] : c.seeds){
      const R = loadRun(id, s); if (!R.base) continue;
      const sys = SY && SY.rows.find(r=> r.id === id && r.seed === s) || null;
      const o = oneResult(R, { tau: +(opt.tau || 6), sys, misfit: opt.misfit === true ? 'widen' : opt.misfit || false });
      all.push({ ...o, truth: R.truth, claims: claimsOf(o, R) });
      console.log(`\n${id}-${s} (truth ${R.truth ? R.truth.dims.join('×') + ' ' + R.truth.type : c.D ? c.D + ' nm sphere' : '—'}):`);
      for (const ln of o.lines) console.log('  ' + ln);
    }
  }
  if (opt.out) fs.writeFileSync(opt.out, JSON.stringify(all));
}
