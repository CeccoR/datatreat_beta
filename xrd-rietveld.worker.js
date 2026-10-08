/* =========================================================
   XRD RIETVELD WORKER
   Runs a pattern's staged refinement (xrd-rietveld.js autoRefine) off the main thread,
   streams its progress, and returns the result with what the card shows of it: the
   values a line, in standard notation (the esd in brackets in the last digits), and
   the rows of the results CSV.
========================================================= */
import { buildModel, autoRefine, displacementMm } from './xrd-rietveld.js';
import { metric, cellFrom } from './xrd-cryst.js';

// 3.9151(8): the value to the esd's first significant digit (two when that digit is
// 1), the esd in brackets in units of the last digit shown.
function fmtEsd(v, e, unit = ''){
  if (!isFinite(v)) return '—';
  if (!(isFinite(e) && e > 0)) return (+v.toPrecision(6)).toString() + unit;
  const p = Math.floor(Math.log10(e)), lead = e/Math.pow(10, p) < 2 ? 1 : 0, d = Math.max(0, lead - p);
  return v.toFixed(d) + '(' + Math.round(e*Math.pow(10, d)) + ')' + unit;
}
const LAT_UNIT = { a: ' Å', b: ' Å', c: ' Å', alpha: '°', beta: '°', gamma: '°' };
const LAT_LABEL = { a: 'a', b: 'b', c: 'c', alpha: 'α', beta: 'β', gamma: 'γ' };

// The variance of f(p) over the refined parameters `names`, by numerical gradient and
// the refinement's covariance (free names × free names).
function propagate(res, names, f){
  const free = res.free || [], cov = res.cov;
  if (!cov) return NaN;
  const base = f(res.params), g = names.map(nm=>{
    const h = Math.max(1e-7, Math.abs(res.params[nm])*1e-6), p = { ...res.params, [nm]: res.params[nm] + h };
    return (f(p) - base)/h;
  });
  let v = 0;
  names.forEach((a, i)=> names.forEach((b, j)=>{
    const ia = free.indexOf(a), ib = free.indexOf(b);
    if (ia >= 0 && ib >= 0) v += g[i]*g[j]*cov[ia][ib];
  }));
  return Math.sqrt(Math.max(0, v));
}

function summarise(model, res, phases, opts){
  const P = res.params, E = res.esd || {}, groups = [], table = [];
  const row = (phase, name, value, esd)=> table.push({ phase, name, value, esd });
  if (opts.standard){
    const s = displacementMm(model, P.disp), sE = Math.abs(displacementMm(model, 1))*E.disp;
    groups.push({ name: 'Instrument', lines: [
      { label: 'zero', value: fmtEsd(P.zero, E.zero, '°') },
      { label: 'displacement', value: fmtEsd(s, sE, ' mm'), title: `Δ2θ = −(2s/R)·cosθ, R = ${model.radius} mm: ${fmtEsd(P.disp, E.disp, '°')} at cosθ = 1` },
      ...['U', 'V', 'W'].map(k=> ({ label: k, value: fmtEsd(P[k], E[k], ' °²') })),
      ...['X', 'Y'].map(k=> ({ label: k, value: fmtEsd(P[k], E[k], '°') })),
    ] });
    row('', 'zero_deg', P.zero, E.zero); row('', 'displacement_mm', s, sE);
    ['U', 'V', 'W', 'X', 'Y'].forEach(k=> row('', k, P[k], E[k]));
    return { groups, table };
  }
  const s = displacementMm(model, P.disp), sE = Math.abs(displacementMm(model, 1))*E.disp;
  groups.push({ name: 'Specimen', lines: [{ label: 'displacement', value: fmtEsd(s, sE, ' mm'), title: `Δ2θ = −(2s/R)·cosθ, R = ${model.radius} mm` }] });
  row('', 'displacement_mm', s, sE);
  model.phases.forEach((q, k)=>{
    const ph = phases[k], lines = [], nm = ph.name || q.name;
    const ss = (res.sizeStrain || [])[k], wf = (res.weightFractions || [])[k];
    // A phase not detected was left out of the refinement (scale 0, its cell the file's):
    // it has no cell, size, strain or fraction to report, and quoting the held values
    // would read as a result. Why it was left out is among the warnings.
    if (ss && ss.detected === false){
      lines.push({ label: 'phase', value: 'not detected', title: 'Left out of the refinement: see the note below' });
      row(nm, 'detected', 0, NaN);
      groups.push({ name: nm, phase: true, lines });
      return;
    }
    q.latNames.forEach(l=>{
      const key = q.pfx + l;
      lines.push({ label: LAT_LABEL[l] || l, value: fmtEsd(P[key], E[key], LAT_UNIT[l] || '') });
      row(nm, l, P[key], E[key]);
    });
    // The refined a, c… of a primitive file of a centred lattice are the conventional
    // cell's (constraint.conv), so V is that cell's too: the one a, c belong to, and the
    // one tables quote.
    const C = q.constraint || {}, conv = C.conv && C.basis;
    const vol = p => metric(conv ? cellFrom({ kind: C.kind, unique: C.unique, params: C.params }, q.latNames.map(l=> p[q.pfx + l]), C.conv)
                                 : cellFrom(C, q.latNames.map(l=> p[q.pfx + l]), ph.cell)).V;
    const V = vol(P), VE = propagate(res, q.latNames.map(l=> q.pfx + l), vol);
    lines.push({ label: conv ? 'V (conventional cell)' : 'V', value: fmtEsd(V, VE, ' Å³') }); row(nm, conv ? 'V_conventional_A3' : 'V_A3', V, VE);
    if (ss){
      lines.push(isFinite(ss.D)
        ? { label: 'crystallite size', value: fmtEsd(ss.D, ss.Desd, ' nm'), title: `D = Kλ/(Y·cosθ·π/180), K = 0.9, from the Lorentzian width Y = ${fmtEsd(ss.Ys, ss.YsEsd, '°')}${ss.instrumentSubtracted ? ' above the instrument’s' : ' (the instrument’s included)'}` }
        : { label: 'crystallite size', value: 'no measurable broadening' });
      lines.push({ label: 'microstrain', value: fmtEsd(ss.strain, ss.strainEsd), title: 'ε from the Lorentzian X·tanθ = 4ε·tanθ' });
      row(nm, 'crystallite_size_nm', ss.D, ss.Desd); row(nm, 'microstrain', ss.strain, ss.strainEsd);
    }
    if ((res.detected || []).length > 1 && wf){ lines.push({ label: 'weight fraction', value: fmtEsd(wf.W*100, wf.esd*100, ' %'), title: 'Hill–Howard: W = S·ZMV/Σ S·ZMV, of the crystalline phases' }); row(nm, 'weight_fraction_pct', wf.W*100, wf.esd*100); }
    groups.push({ name: nm, phase: true, lines });
  });
  return { groups, table };
}

self.addEventListener('message', e=>{
  const { id, x, y, varMul, instr, phases, opts } = e.data || {};
  try {
    const model = buildModel({ x, y, varMul, instr, phases });
    const res = autoRefine(model, { standard: !!opts.standard, irf: opts.irf || null,
      onProgress: (frac, stage)=> self.postMessage({ id, type: 'progress', frac, stage }) });
    const { groups, table } = summarise(model, res, phases, opts);
    self.postMessage({ id, type: 'result', res: { params: res.params, esd: res.esd, stats: res.stats, stages: res.stages,
      atBound: res.atBound, converged: res.converged, ms: res.ms, warnings: res.warnings || [], phaseResults: groups, table } });
  } catch(err){
    self.postMessage({ id, type: 'error', message: String((err && err.message) || err) });
  }
});
