#!/usr/bin/env node
/* node score.mjs <tag> [--ref baseline] [--json out]: per run of results/<tag>/, the
   uniqueness analysis turned into per-quantity intervals and verdicts by several rules
   (variants below), each checked against the truth (synthetic and sample-like cases).
   Quantities: each body axis of the reported solid — its dimension, and its direction
   where it has one. Pairing with the truth and with the other minima: ulib.align (modulo
   m-3m and the body's symmetry).
   Variants (an interval per quantity; 2σ unless said):
     app      the app's report: D ± 2·Desd (linear, with the held/free difference; a
              group's for grouped dims; an unbounded D: [Dmin, ∞]); an axis: 2·esdAngle
              (profile), undetermined over 30° or without its own direction.
     fisher   the best free exact fit's linear covariance alone: D·e^{±2σ(log W)}, axis
              2·σ_tilt.
     alt10    app ∪ every other minimum within Δ ≤ 10 (its own D·e^{±2σ}, angle + 2σ_tilt).
     flip     app ∪ the minima whose flip probability Φ(−Δ/√(4Δ + c)) ≥ 5 % (c = --c, 8).
     lik      app ∪ the minima with exp(−Δ/2) ≥ 5 % (Δ ≤ 6).
     prof     the dims by profile (2σ crossings, an unbounded side when W → 0 stays under),
              axes as app; ∪ the flip set.
   Determined: a dimension whose interval's hi/lo ≤ dimTol² (dimTol 1.25: ±25 %), an axis
   whose radius ≤ angTol (10°). Accurate (truth): |log ratio| ≤ log 1.25 and angle ≤ 10°. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readResult, caseById } from '../harness/lib.mjs';
import { align, pFlip, quantile, median, fmt } from './ulib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } else opt._ = a[i]; }
const tag = opt._, dir = path.join(HERE, 'results', tag);
const SEG = +(opt.seg || 1.25), cC = opt.c != null ? +opt.c : 8, dimTol = +(opt.dimTol || 1.25), angTol = +(opt.angTol || 10);
const refDir = opt.ref ? path.join(HERE, '..', 'harness', 'results', opt.ref) : null;
const VARIANTS = ['app', 'fisher', 'alt10', 'flip', 'lik', 'prof', 'flipConv', 'flipBrief', 'profConv', 'appD', 'profD', 'profConvD', 'jackD', 'jackConvD', 'jackOnlyD', 'profOnlyD', 'flipD', 'profDd', 'jackDd', 'condD', 'condA', 'condP'];
// ablations of the minima: the search's own converged ends only (refitted exact), + its brief
// ends refined; the full set adds the extra lattice-frame starts
const CONV = new Set(['full', 'exact', 'held', 'reported-free', 'free-of-held', 'reported-held']), BRIEF = new Set([...CONV, 'brief']);
// quantities as extents (the three dims paired by size whatever the body's axis class: an
// elliptic cylinder's height on the thin extent is the same ribbon) unless --strict
const LOOSE = !opt.strict;

export function analyse(r, ref, jk = null){
  const m = r.records[0], u = m.info && m.info.uniq;
  if (!u || !u.minima || !u.minima.length) return null;
  const truthRec = r.records.find(x=> x.method === 'truth') || (ref && ref.records.find(x=> x.method === 'truth'));
  const rep = u.reported.solid, nu0 = u.nu0, c0 = u.minima[0].chi;
  const others = u.minima.slice(1).map(x=> ({ ...x, D: (x.chi - c0)/nu0, al: align(x.solid, rep, { loose: LOOSE }) }));
  const best = u.minima[0], bestAl = align(best.solid, rep, { loose: LOOSE });
  // the best free fit joins every union when the reported solid is held (its own values)
  const bestM = m.held ? [{ ...best, D: 0, al: bestAl }] : [];
  const nAx = 3, type = rep.type;
  // the reported axes: which have a direction (app: own, and under 30°)
  const appAx = i => u.app && u.app.axes ? u.app.axes.find(x=> x.axis === i) : null;
  const wIx = type === 'spheroid' || type === 'cylinder' || type === 'sqbox' ? [0, 0, 1] : [0, 1, 2];
  const roundXY = type === 'spheroid' || type === 'cylinder';
  const iv = {}, out0 = {};
  const dimApp = i => {
    const ax = appAx(i), D = rep.dims[i];
    if (!ax) return [D, D];
    const g = ax.group >= 0 && u.app.groups[ax.group];
    const sd = g ? g.Desd : ax.Desd, Dc = g ? g.D : D;
    if (!Number.isFinite(Dc)) return [Number.isFinite(ax.Dmin) ? ax.Dmin : 0, Infinity];
    if (!Number.isFinite(sd)) return [0, Infinity];
    // a group (extents not told apart): its mean ± 2σ, and every member's own value
    const mem = g ? g.axes.map(j=> rep.dims[j]) : [D];
    return [Math.min(Math.max(0, Dc - 2*sd), ...mem), Math.max(Dc + 2*sd, ...mem)];
  };
  const angApp = i => {
    if (roundXY && i < 2) return null;
    const ax = appAx(i); if (!ax) return 90;
    return ax.own && Number.isFinite(ax.esdAngle) && ax.esdAngle <= 30 ? 2*ax.esdAngle : 90;
  };
  const dimOf = (x, al, i) => { const p = al.per[i], D = x.solid.dims[p.fi], s = x.sLogW[p.fi]; return !Number.isFinite(D) ? [D, Infinity] : Number.isFinite(s) ? [D*Math.exp(-2*s), D*Math.exp(2*s)] : [0, Infinity]; };
  const angOf = (x, al, i) => { const p = al.per[i]; if (p.angle == null) return null; const s = x.sTilt[p.fi]; return p.angle + (Number.isFinite(s) ? 2*s : 0); };
  const union = (A, B) => [Math.min(A[0], B[0]), Math.max(A[1], B[1])];
  const build = (set, dimBase, angBase) => [0, 1, 2].map(i=> {
    let d = dimBase(i), ang = angBase(i);
    // an alternative adds its own location (its linear esds blow up on symmetric orientations
    // and along poorly resolved dimensions; the local spread is the reported fit's)
    for (const x of set){ const p = x.al.per[i], D = x.solid.dims[p.fi]; d = union(d, [D, D]); if (ang != null && p.angle != null) ang = Math.max(ang, p.angle); }
    return { d, ang };
  });
  // fisher: the best free exact fit's linear covariance (aligned to the reported solid)
  const fisherDim = i => dimOf(best, bestAl, i);
  const fisherAng = i => { if (roundXY && i < 2) return null; const p = bestAl.per[i]; const s = best.sTilt[p.fi]; return Number.isFinite(s) ? (p.angle || 0) + 2*s : best.rotFree ? 90 : (p.angle || 0); };
  // profile dims (2σ crossings, on log W)
  const profDim = i => {
    if (!u.profile) return dimApp(i);
    const p = u.profile[wIx[i]], D = rep.dims[i];
    const th = p.sides.thinner.s2, lo = p.sides.longer.s2;
    return [th == null ? 0 : D*Math.exp(-th), lo == null || lo >= 3.2 ? Infinity : D*Math.exp(lo)];
  };
  const flipSet = others.filter(x=> pFlip(x.D, cC) >= 0.05);
  /* δ: the competitor refitted to the best's noise-free pattern (u.bootFree, comps u.bootComps;
     Δ where it was not computed): the bootstrap found it the better predictor under misfit */
  const deltaOf = x => { const mi = u.minima.indexOf(u.minima.find(m=> m.chi === x.chi && m.src === x.src)), k = u.bootComps ? u.bootComps.indexOf(mi) : -1;
    return k > 0 && u.bootFree && Number.isFinite(u.bootFree[k]) && Number.isFinite(u.bootFree[0]) ? u.bootFree[k] - u.bootFree[0] : x.D; };
  const flipSetD = others.filter(x=> pFlip(deltaOf(x), cC) >= 0.05);
  const flipConv = flipSet.filter(x=> CONV.has(x.src)), flipBrief = flipSet.filter(x=> BRIEF.has(x.src));
  iv.app = build([], dimApp, angApp);
  iv.fisher = build([], fisherDim, fisherAng);
  iv.alt10 = build([...bestM, ...others.filter(x=> x.D <= 10)], dimApp, angApp);
  iv.flip = build([...bestM, ...flipSet], dimApp, angApp);
  iv.lik = build([...bestM, ...others.filter(x=> x.D <= 6)], dimApp, angApp);
  iv.prof = build([...bestM, ...flipSet], profDim, angApp);
  iv.flipConv = build([...bestM, ...flipConv], dimApp, angApp);
  iv.flipBrief = build([...bestM, ...flipBrief], dimApp, angApp);
  iv.profConv = build([...bestM, ...flipConv], profDim, angApp);
  /* D: an axis' direction counts only where its extent is told apart from every other
     extent (the intervals disjoint): a near-square plate's in-plane edges, a near-isometric
     cylinder's axis, have no direction the data can give. */
  const distinct = I => I.map((x, i)=> { if (x.ang == null) return x; const clash = I.some((y, j)=> j !== i && !(x.d[1] < y.d[0] || y.d[1] < x.d[0])); return clash ? { ...x, ang: Math.max(x.ang, 90), clash: true } : x; });
  iv.appD = distinct(iv.app); iv.profD = distinct(iv.prof); iv.profConvD = distinct(iv.profConv); iv.flipD = distinct(iv.flip);
  // the width profiles alone (no other minimum): what the minima stage adds
  iv.profOnlyD = distinct(build(bestM, profDim, angApp));
  iv.profDd = distinct(build([...bestM, ...flipSetD], profDim, angApp));
  /* jack: the delete-one-reflection jackknife (methods/u-jack.mjs) about the best free fit:
     per reported axis sd(ln D) = √((K−1)/K Σ ln²(D_(s)/D)), the axis' rms turn likewise; the
     interval widened to D·e^{±2 sd}, the radius to 2·rms. */
  if (jk && jk.drops){
    const K = jk.drops.length, f = (K - 1)/K, drops = jk.drops.filter(d=> d.solid);
    const J = [0, 1, 2].map(i=> { const b = bestAl.per[i].fi; let sl = 0, sa = 0, na = 0, inf = false;
      for (const d of drops){ const al = align(d.solid, best.solid, { loose: LOOSE }), p = al.per[b];
        let lr = Math.log(p.ratio); if (!Number.isFinite(lr)){ if (Number.isNaN(lr)) lr = 0; else inf = true; lr = 0; }
        sl += lr*lr; if (p.angle != null){ sa += p.angle**2; na++; } }
      if (drops.length < K) inf = true;
      return { sdLog: inf ? Infinity : Math.sqrt(f*sl), rmsAng: na ? Math.sqrt(f*sa) : null }; });
    const widen = I => I.map((x, i)=> { const D = rep.dims[i], s = J[i].sdLog;
      const d = !Number.isFinite(D) ? x.d : [Math.min(x.d[0], D*Math.exp(-2*s)), Math.max(x.d[1], s === Infinity ? Infinity : D*Math.exp(2*s))];
      return { d, ang: x.ang == null ? null : Math.max(x.ang, J[i].rmsAng == null ? 0 : 2*J[i].rmsAng) }; });
    iv.jackD = distinct(widen(iv.prof)); iv.jackConvD = distinct(widen(iv.profConv)); iv.jackDd = distinct(widen(build([...bestM, ...flipSetD], profDim, angApp)));
    // the jackknife alone (no profile, no alternatives): its own intervals about the reported fit
    iv.jackOnlyD = distinct(widen(iv.app.map(x=> ({ d: [Infinity, 0], ang: x.ang == null ? null : 0 })).map((x, i)=> ({ ...x, d: [rep.dims[i], rep.dims[i]] }))));
    out0.jack = { J, dw: jk.dw, chi2nu: jk.chi2nu, evals: jk.evals, ms: jk.ms, segs: jk.segs };
    /* cond: the jackknife's widening only where the residuals flag a misfit: one segment's
       χ²_ν over SEG (1.25; the 80 synthetic runs' worst segments reach 1.21) */
    const worstSeg = Math.max(...jk.segs.map(g=> g.chi2nu));
    out0.misfit = worstSeg > SEG; out0.worstSeg = worstSeg;
    iv.condD = out0.misfit ? iv.jackDd : distinct(build([...bestM, ...flipSetD], profDim, angApp));
    /* the cheaper rungs of the same ladder: condA the app's own esds (D rule) and the jackknife where the
       residuals flag a misfit (no profile, no other minima); condP the width profiles instead of the
       app's linear esds (still no other minima; the best free fit of a held result joins, 122 evaluations) */
    iv.condA = out0.misfit ? distinct(widen(iv.app)) : iv.appD;
    iv.condP = out0.misfit ? distinct(widen(build(bestM, profDim, angApp))) : iv.profOnlyD;
  }
  const det = q => ({ dim: q.d[1]/Math.max(1e-9, q.d[0]) <= dimTol*dimTol, ang: q.ang == null ? null : q.ang <= angTol });
  const out = { run: `${r.case}#${r.seed}`, case: r.case, seed: r.seed, kind: r.kind, type, held: m.held, nMin: u.minima.length, others: others.map(x=> ({ D: x.D, src: x.src, dims: x.solid.dims, worst: x.al.orient, maxRatio: Math.max(...x.al.per.map(p=> Number.isFinite(p.ratio) ? Math.abs(Math.log(p.ratio)) : 9)) })),
    cost: u.cost, tried: u.tried, dims: rep.dims, iv: {}, verdict: {}, ...out0 };
  // the truth's own minimum against the best (Δ_T < 0: the search missed it)
  if (truthRec && Number.isFinite(truthRec.chi2Best)) out.DT = (truthRec.chi2Best - c0)/nu0;
  const T = r.truth;
  let tal = null;
  if (T){ tal = align(rep, T, { loose: LOOSE }); out.truthDims = T.dims; }
  for (const v of VARIANTS){
    if (!iv[v]) continue;
    const I = iv[v], q = [];
    for (let i = 0; i < nAx; i++){
      const D = det(I[i]);
      const e = { axis: i, d: I[i].d, ang: I[i].ang, detDim: D.dim, detAng: D.ang };
      q.push(e);
    }
    // per truth axis: the paired reported axis' interval, error and coverage
    let truthQ = null;
    if (tal){
      const order = [0, 1, 2].sort((x, y)=> T.dims[x] - T.dims[y]);
      truthQ = [0, 1, 2].map(ri=> {
        const p = tal.per[ri], fi = p.fi, I2 = I[fi], Tv = T.dims[ri];
        const err = Math.abs(Math.log(p.ratio));
        const covD = Tv >= I2.d[0]*0.999 && Tv <= I2.d[1]*1.001;
        const angErr = p.angle, covA = angErr == null || I2.ang == null ? null : angErr <= I2.ang + 1e-6;
        return { ri, fi, role: ['thin', 'mid', 'long'][order.indexOf(ri)], T: Tv, err, angErr, covD, covA, detDim: q[fi].detDim, detAng: q[fi].detAng,
          accD: err <= Math.log(dimTol), accA: angErr == null ? null : angErr <= angTol };
      });
    }
    const allDet = q.every(x=> x.detDim) && q.every(x=> x.detAng !== false);
    out.iv[v] = { q, truthQ };
    out.verdict[v] = allDet ? 'resolved' : 'partly';
    if (truthQ) out.verdict[v + '_acc'] = truthQ.every(x=> x.accD) && truthQ.every(x=> x.accA !== false);
  }
  return out;
}

if (tag && import.meta.url === pathToFileURL(process.argv[1]).href){
  const files = fs.readdirSync(dir).filter(f=> f.endsWith('.json') && f !== 'summary.json' && !f.startsWith('score'));
  const rows = [];
  for (const fn of files.sort()){
    const r = readResult(fs.readFileSync(path.join(dir, fn), 'utf8'));
    if (!r.records) continue;
    let ref = null;
    if (refDir && fs.existsSync(path.join(refDir, fn))) ref = readResult(fs.readFileSync(path.join(refDir, fn), 'utf8'));
    const m = r.records[0];
    if (!m.kept){ rows.push({ run: `${r.case}#${r.seed}`, kind: r.kind, rejected: m.rejected, early: m.early, dBIC: m.dBIC }); continue; }
    const jf = path.join(HERE, 'results', opt.jack || 'jack', fn);
    const jk = fs.existsSync(jf) ? (()=> { const j = readResult(fs.readFileSync(jf, 'utf8')); return j.records && j.records[0].info && j.records[0].info.jack; })() : null;
    const x = analyse(r, ref, jk); if (x) rows.push(x);
  }
  const kept = rows.filter(x=> x.iv);
  const lines = [];
  for (const kind of ['synth', 'sample']){
    const K = kept.filter(x=> x.kind === kind && x.iv.app.truthQ);
    if (!K.length) continue;
    lines.push(`\n## ${kind}: ${K.length} runs kept\n`);
    lines.push('| variant | dims covered | axes covered | dims determined | of those accurate | undetermined dims inaccurate | axes determined | of those accurate | runs resolved | resolved & accurate | partly & inaccurate |');
    lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const v of VARIANTS){
      const KV = K.filter(x=> x.iv[v]); if (!KV.length) continue;
      const Q = KV.flatMap(x=> x.iv[v].truthQ);
      const cd = Q.filter(t=> t.covD).length, qa = Q.filter(t=> t.covA != null), ca = qa.filter(t=> t.covA).length;
      const dd = Q.filter(t=> t.detDim), dda = dd.filter(t=> t.accD).length, ud = Q.filter(t=> !t.detDim), udi = ud.filter(t=> !t.accD).length;
      const da = Q.filter(t=> t.detAng === true && t.accA != null), daa = da.filter(t=> t.accA).length;
      const res = KV.filter(x=> x.verdict[v] === 'resolved'), ra = res.filter(x=> x.verdict[v + '_acc']).length;
      const par = KV.filter(x=> x.verdict[v] !== 'resolved'), pi = par.filter(x=> !x.verdict[v + '_acc']).length;
      lines.push(`| ${v} | ${cd}/${Q.length} | ${ca}/${qa.length} | ${dd.length} | ${dda}/${dd.length} | ${udi}/${ud.length} | ${da.length} | ${daa}/${da.length} | ${res.length} | ${ra}/${res.length} | ${pi}/${par.length} |`);
    }
  }
  const txt = `# ${tag}: verdicts against the truth\n\nc = ${cC}, dims determined at hi/lo ≤ ${dimTol}², axes at ≤ ${angTol}° (2σ intervals).\n` + lines.join('\n') + '\n';
  // --out <name>: score.md and score.json into results/<name>/ (another tolerance's scoring beside the run folder's)
  const od = opt.out ? path.join(HERE, 'results', opt.out) : dir; fs.mkdirSync(od, { recursive: true });
  fs.writeFileSync(path.join(od, 'score.md'), txt.replace('# ' + tag + ':', '# ' + (opt.out || tag) + ':'));
  fs.writeFileSync(opt.json || path.join(od, 'score.json'), JSON.stringify(rows, null, 1));
  console.log(txt);
}
