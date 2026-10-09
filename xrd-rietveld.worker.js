/* =========================================================
   XRD RIETVELD WORKER
   Runs a pattern's staged refinement (xrd-rietveld.js autoRefine) off the main thread,
   streams its progress, and returns the result with what the card shows of it: the
   values a line, in standard notation (the esd in brackets in the last digits), and
   the rows of the results CSV.
========================================================= */
import { buildModel, autoRefine, displacementMm, shapeOf, siteU, lowIndexPlanes, K_SCHERRER } from './xrd-rietveld.js';
import { measureWidths } from './xrd-widths.js';
import { metric, cellFrom, uEquiv, betaOf } from './xrd-cryst.js';
import { evalQuartic } from './xrd-broad.js';

const D2R = Math.PI/180;
const hklText = t => t.map(x=> x < 0 ? '−' + (-x) : x).join('');
// What a parameter is, for the notes on parameters at a bound or undetermined.
function friendly(model, name){
  const q = model.phases.find(p=> name.startsWith(p.pfx)), nm = q ? (q.name || 'phase ' + q.id) : 'instrument';
  const key = q ? name.slice(q.pfx.length) : name;
  const what = { scale: 'scale', Ys: 'crystallite size', Xs: 'microstrain', B: 'ΔB', PO: 'texture r', LS: 'size distribution σ', FA: 'fault probability',
    U: 'U', V: 'V', W: 'W', X: 'X', Y: 'Y', asym: 'asymmetry', zero: 'zero', disp: 'displacement' }[key]
    || (/^S\d+$/.test(key) ? `anisotropic strain ${key}` : /^B_/.test(key) ? `B(${key.slice(2)})` : /^U\d\d_/.test(key) ? `${key.slice(0, 3)}(${key.slice(4)})` : /^(E[abc]|W[abcdh]|R\d)$/.test(key) ? `shape ${key}` : key);
  return q ? `${nm} ${what}` : what;
}

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
  const P = res.params, E = res.esd || {}, groups = [], table = [], warnings = [...(res.warnings || [])], extra = [], solids = [];
  const row = (phase, name, value, esd)=> table.push({ phase, name, value, esd });
  // ΔB, when refined (the phase's displacement option 'overall'): one shift added to every
  // atom's B of the phase. A B made negative is no displacement at all: what it takes up
  // is something else (absorption or roughness lowering the low angles, the background).
  const deltaB = (q, ph, nm, lines)=>{
    const key = q.pfx + 'B';
    if (q.adp === 'site' || q.adp === 'aniso') return siteB(q, ph, nm, lines);
    if (!(res.free || []).includes(key)) return;
    const line = { label: 'ΔB (all atoms)', value: fmtEsd(P[key], E[key], ' Å²'), title: 'Added to every atom’s B from the CIF (0.5 Å² where the CIF gives none)' };
    if (lines) lines.push(line); else extra.push({ name: ph.name || q.name, phase: true, lines: [line] });
    row(nm, 'delta_B_A2', P[key], E[key]);
    const bMin = Math.min(...(ph.atoms || []).map(a=> Number.isFinite(a.Biso) ? a.Biso : 0));
    // Only a ΔB that lowers B below 0: a negative B of the CIF's own is the phase list's
    // warning, and a positive ΔB takes up nothing of the kind.
    if (Number.isFinite(bMin) && P[key] < 0 && bMin + P[key] < 0) warnings.push(`${ph.name || q.name}: with ΔB = ${fmtEsd(P[key], E[key], ' Å²')} some atom's B is negative (${(bMin + P[key]).toFixed(2)} Å²), which no displacement gives: it more likely takes up absorption, surface roughness or the background.`);
  };
  /* B per site (isotropic), or U^ij per site within its symmetry with B_eq = 8π²U_eq
     (Fischer & Tillmanns), esd by propagation. A negative B, or a U that is not
     positive definite, is no vibration: it takes up something else (absorption,
     roughness, the background, a wrong occupancy). */
  const siteB = (q, ph, nm, lines)=>{
    const free = res.free || [];
    if (!q.sites || !q.sites.some(st=> (st.iB != null ? [st.iB] : st.iU).some(i=> free.includes(model.par[i].name)))) return;
    const cellAt = p => cellFrom(q.constraint, q.latNames.map(l=> p[q.pfx + l]), ph.cell);
    for (const st of q.sites){
      if (st.iB != null){
        const k = model.par[st.iB].name;
        lines.push({ label: `B(${st.label})`, value: fmtEsd(P[k], E[k], ' Å²'), title: `The isotropic displacement parameter of site ${st.label} (${st.members.length} atom${st.members.length > 1 ? 's' : ''} of ${st.element} in the cell), B = 8π²⟨u²⟩` });
        row(nm, `B_A2_${st.label}`, P[k], E[k]);
        if (P[k] < 0) warnings.push(`${nm}: B(${st.label}) = ${fmtEsd(P[k], E[k], ' Å²')} is negative, which no vibration gives: it more likely takes up absorption, surface roughness, the background or a wrong occupancy.`);
        continue;
      }
      const names = st.iU.map(i=> model.par[i].name);
      const vAt = p => Float64Array.from(model.par, (pp, i)=> p[pp.name]);
      const Ueq = p => uEquiv(siteU(st, vAt(p)), cellAt(p)), Beq = p => 8*Math.PI*Math.PI*Ueq(p);
      const b = Beq(P), bE = propagate(res, names, Beq);
      const comps = names.map((k, m)=> `${st.names[m]} ${fmtEsd(P[k], E[k])}`).join(', ');
      lines.push({ label: `U(${st.label})`, value: `B_eq ${fmtEsd(b, bE, ' Å²')} · ${comps} Å²`, title: `The anisotropic displacement parameters of site ${st.label} (${st.members.length} atom${st.members.length > 1 ? 's' : ''} of ${st.element}), Uⁱʲ as in a CIF (Å², on the reciprocal axes), only those the site's symmetry leaves free (${st.names.join(', ')}; the others follow from them). B_eq = 8π²U_eq, U_eq = ⅓Σ Uⁱʲ a*ᵢ a*ⱼ (aᵢ·aⱼ)` });
      names.forEach((k, m)=> row(nm, `${st.names[m]}_A2_${st.label}`, P[k], E[k]));
      row(nm, `Beq_A2_${st.label}`, b, bE);
      const cell = cellAt(P), { Gs } = metric(cell), Bt = betaOf(siteU(st, vAt(P)), [Math.sqrt(Gs[0]), Math.sqrt(Gs[4]), Math.sqrt(Gs[8])]);
      const m2 = Bt[0]*Bt[4] - Bt[1]*Bt[3], det = Bt[0]*(Bt[4]*Bt[8] - Bt[5]*Bt[7]) - Bt[1]*(Bt[3]*Bt[8] - Bt[5]*Bt[6]) + Bt[2]*(Bt[3]*Bt[7] - Bt[4]*Bt[6]);
      if (!(Bt[0] > 0 && m2 > 0 && det > 0)) warnings.push(`${nm}: the displacements of site ${st.label} are not positive definite (some direction has ⟨u²⟩ ≤ 0), which no vibration gives: they more likely take up absorption, roughness, the background or a wrong occupancy.`);
    }
  };
  // What the numbers rest on: a refinement stopped short, parameters on a bound (read
  // as limits), parameters the data do not determine — the standard's too, whose
  // profile the samples take.
  const fitNotes = ()=>{
    if (res.converged === false) warnings.push('The last refinement stopped at its iteration limit before converging: the values may still move a little.');
    const atB = (res.atBound || []).filter(n=> !/^bg/.test(n));
    if (atB.length) warnings.push(`On a bound, so to be read as limits: ${atB.map(n=> friendly(model, n)).join(', ')}.`);
    const und = (res.undetermined || []).filter(n=> !/^bg/.test(n));
    if (und.length) warnings.push(`Not determined by the data (no esd): ${und.map(n=> friendly(model, n)).join(', ')}.`);
  };
  if (opts.standard){
    const s = displacementMm(model, P.disp), sE = Math.abs(displacementMm(model, 1))*E.disp;
    groups.push({ name: 'Instrument', lines: [
      { label: 'zero', value: fmtEsd(P.zero, E.zero, '°') },
      { label: 'displacement', value: fmtEsd(s, sE, ' mm'), title: `Δ2θ = −(2s/R)·cosθ, R = ${model.radius} mm: ${fmtEsd(P.disp, E.disp, '°')} at cosθ = 1` },
      ...['U', 'V', 'W'].map(k=> ({ label: k, value: fmtEsd(P[k], E[k], ' °²') })),
      ...['X', 'Y'].map(k=> ({ label: k, value: fmtEsd(P[k], E[k], '°') })),
      { label: 'asymmetry (S+H)/L', value: fmtEsd(P.asym, E.asym), title: 'Axial divergence, Finger–Cox–Jephcoat with sample and receiving-slit heights equal: the tail of the low-angle peaks towards lower angles (of the high-angle ones towards higher)' },
    ] });
    row('', 'zero_deg', P.zero, E.zero); row('', 'displacement_mm', s, sE);
    ['U', 'V', 'W', 'X', 'Y'].forEach(k=> row('', k, P[k], E[k]));
    row('', 'asymmetry_SH_L', P.asym, E.asym);
    deltaB(model.phases[0], phases[0], '');
    groups.push(...extra);
    fitNotes();
    return { groups, table, warnings, solids };
  }
  const s = displacementMm(model, P.disp), sE = Math.abs(displacementMm(model, 1))*E.disp;
  groups.push({ name: 'Specimen', lines: [{ label: 'displacement', value: fmtEsd(s, sE, ' mm'), title: `Δ2θ = −(2s/R)·cosθ, R = ${model.radius} mm` }] });
  row('', 'displacement_mm', s, sE);
  const lam1 = model.lines[0].lam, Dof = ys => K_SCHERRER*lam1/(ys*D2R)/10;
  /* A log-normal distribution of sizes (WPPM): σ of ln D, and the sphere's diameters
     read three ways — the volume-weighted mean (⟨D⁴⟩/⟨D³⟩, what the breadth measures
     and the parameter Ys reads), the median (e^{−3.5σ²} times it) and the number-
     weighted mean (e^{−3σ²}, what a TEM count gives). With a shape, σ alone (its
     dimensions are the volume-weighted mean crystallite's). */
  const sizeDist = (q, nm, lines, shaped)=>{
    const ys = q.pfx + 'Ys', ls = q.pfx + 'LS', sg = P[ls], sgE = E[ls];
    if (!shaped && P[ys] > 0){
      const at = f => p => Dof(p[ys])*Math.exp(-f*p[ls]*p[ls]);
      for (const [lab, f, key, t] of [['volume-weighted mean diameter', 0, 'size_volume_mean_nm', '⟨D⁴⟩/⟨D³⟩ of the spheres: what the lines’ breadth measures (the Lorentzian model’s size reads about the same)'],
        ['median diameter', 3.5, 'size_median_nm', 'the log-normal’s median, e^{−3.5σ²} times the volume-weighted mean'], ['number-weighted mean diameter', 3, 'size_number_mean_nm', 'the mean over the crystallites counted one by one (as a TEM count gives), e^{−3σ²} times the volume-weighted mean']]){
        const v = at(f)(P), e = propagate(res, [ys, ls], at(f));
        lines.push({ label: lab, value: fmtEsd(v, e, ' nm'), title: `WPPM, spheres with a log-normal distribution of diameters: ${t}` });
        row(nm, key, v, e);
      }
    }
    lines.push({ label: 'σ of ln D', value: fmtEsd(sg, sgE), title: `The log-normal width of the sizes${shaped ? ' (all the solid’s dimensions scaled together)' : ''}. It shapes the profile at a given breadth: 0 is one size (the tails fall fast), about 0.76 is as Lorentzian as the Scherrer model, more is sharper still at the top with longer tails. It rests on the profiles’ shape, so on how well the instrument’s is known` });
    row(nm, 'size_lognormal_sigma', sg, sgE);
    /* A width past the Lorentzian's (0.76): most of the volume in crystallites far
       smaller than the mean, the median below a nanometre at σ near 1. Then the far tails
       set σ, and a background, a broad second phase or strain with long tails take the
       same shape. */
    if (sg >= 0.8){
      const med = !shaped && P[ys] > 0 ? Dof(P[ys])*Math.exp(-3.5*sg*sg) : NaN;
      warnings.push(`${nm}: σ of ln D = ${fmtEsd(sg, sgE)} is a distribution wider than the Lorentzian profile's${Number.isFinite(med) ? `, its median at ${med.toPrecision(2)} nm` : ''}: the profiles' far tails set it, which a background, a broad second phase or a strain with long tails can shape as well. The volume-weighted mean stands; the median and the number mean rest on that tail.`);
    }
  };
  /* The microstrain: isotropic, or Stephens' (anisotropic: ε² = ε₀² + 10⁻⁶ Σ S_j q_j(u),
     q_j the Laue-invariant quartic forms of the diffraction vector's direction) given as
     its rms over directions ε₀ and along the normals of the low-index planes. */
  const strainLines = (q, nm, lines, ss)=>{
    const md = (res.models || {})[q.id] || {};
    if (!(md.strain === 'aniso' && q.iS)){
      lines.push({ label: 'microstrain', value: fmtEsd(ss.strain, ss.strainEsd), title: 'ε from the Lorentzian X_s·tanθ = 4ε·tanθ' });
      row(nm, 'microstrain', ss.strain, ss.strainEsd);
      return;
    }
    const names = [q.pfx + 'Xs', ...q.iS.map(i=> model.par[i].name)], M = q.constraint && q.constraint.basis, B = q.Bm;
    lines.push({ label: 'microstrain, rms over directions', value: fmtEsd(ss.strain, ss.strainEsd), title: 'Stephens’ anisotropic microstrain: ε² = ε₀² + Σ S_j q_j(u), q_j the quartic forms of the diffraction vector’s direction u that the Laue group leaves unchanged, taken with zero mean over the directions; ε₀ is its rms over them' });
    row(nm, 'microstrain', ss.strain, ss.strainEsd);
    const inv = m => { const [a, b, c, d, e, f, g, h, i] = m, A = e*i - f*h, Bc = -(d*i - f*g), C = d*h - e*g, det = a*A + b*Bc + c*C; return [A/det, -(b*i - c*h)/det, (b*f - c*e)/det, Bc/det, (a*i - c*g)/det, -(a*f - c*d)/det, C/det, -(a*h - b*g)/det, (a*e - b*d)/det]; };
    const Mi = M ? inv(M) : null;
    for (const hc of lowIndexPlanes(q)){
      const h = Mi ? [0, 1, 2].map(j=> hc[0]*Mi[j] + hc[1]*Mi[3 + j] + hc[2]*Mi[6 + j]) : hc;
      const x = [B[0]*h[0] + B[1]*h[1] + B[2]*h[2], B[4]*h[1] + B[5]*h[2], B[8]*h[2]], n = Math.hypot(...x), u = x.map(t=> t/n);
      const qv = q.strainForms.map(c=> evalQuartic(c, u));
      const e2Of = p => { let e2 = (p[q.pfx + 'Xs']*D2R/4)**2; q.iS.forEach((ix, j)=> { e2 += 1e-6*p[model.par[ix].name]*qv[j]; }); return e2; };
      const eps = p => Math.sqrt(Math.max(0, e2Of(p)));
      // ε² below 0 along a direction (the S terms past ε₀²): the refinement's lines there
      // carry no strain, read as 0.
      const clipped = !(e2Of(P) > 0), v = eps(P), e = clipped ? NaN : propagate(res, names, eps);
      lines.push({ label: `microstrain, (${hklText(hc)})`, value: clipped ? '0 (ε² ≤ 0 here, held at 0)' : fmtEsd(v, e), title: `The strain along the normal of the (${hklText(hc)}) planes and their family, which their reflections and orders measure${clipped ? '. Here the quartic terms take ε² to 0 or below, which no strain gives: the lines along it carry none, and the S_j are pressed against that' : ''}` });
      row(nm, `microstrain_${hc.join('_')}`, v, e);
    }
    q.iS.forEach((ix, j)=> row(nm, `stephens_S${j + 1}_1e-6`, P[model.par[ix].name], E[model.par[ix].name]));
  };
  // Planar faults: their probability per plane, and what it means in planes between faults.
  const faultLines = (q, nm, lines)=>{
    const md = (res.models || {})[q.id] || {};
    if (!md.faults || !q.faultTab) return;
    const k = q.pfx + 'FA', a = P[k], e = E[k], fs = q.faultSpec, fr = fs.disp.f;
    const frac = Math.abs(fr - 1/6) < 1e-9 ? '⅙' : Math.abs(fr - 0.5) < 1e-9 ? '½' : Math.abs(fr - 1/3) < 1e-9 ? '⅓' : Math.abs(fr - 0.25) < 1e-9 ? '¼' : fr.toFixed(3);
    lines.push({ label: `planar faults {${hklText(fs.plane)}}, ${frac}⟨${hklText(fs.disp.uvw)}⟩`, value: `${fmtEsd(a, e)} per plane${a > 0 ? ` (one in ${(1/a).toPrecision(2)})` : ''}`,
      title: `Faults on the {${hklText(fs.plane)}} planes (${q.faultTab.planes} orientations, ${q.faultTab.dLayer.toFixed(3)} Å apart), each shifting the crystal beyond it by ${frac}⟨${hklText(fs.disp.uvw)}⟩ (those in the plane, ± alike): a reflection whose h·R is not an integer loses coherence across each one — a Lorentzian broadening that depends on the indices’ parity, not on the order. The probability is per lattice plane of the family (where the structure stacks several layers per plane, as hcp and wurtzite stack two close-packed layers per c, it is that many times a probability per layer), with faults on all ${q.faultTab.planes} orientations at once in each crystallite${q.faultTab.planes > 1 ? ` (Warren’s α, for faults on one orientation alone, gives the same mean broadening at about ${q.faultTab.planes}× this)` : ''}` });
    row(nm, `fault_probability_${fs.plane.join('_')}`, a, e);
  };
  model.phases.forEach((q, k)=>{
    const ph = phases[k], lines = [], nm = ph.name || q.name;
    const md0 = (res.models || {})[q.id] || {}, wppm = md0.profile === 'wppm' || md0.profile === 'lognormal', ln = md0.profile === 'lognormal';
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
    // The preferred orientation (March–Dollase), its axis and r.
    const tx = (res.textures || {})[q.id];
    if (tx && tx.hkl){
      const hkl = tx.hkl.map(x=> x < 0 ? '−' + (-x) : x).join(''), sig = Number.isFinite(tx.esd) && tx.esd > 0 ? Math.abs(tx.r - 1)/tx.esd : NaN;
      lines.push({ label: `preferred orientation (${hkl})`, value: `r = ${fmtEsd(tx.r, tx.esd)}`, title: `March–Dollase: each reflection's members weighed by (r²·cos²α + sin²α/r)^(−3/2), α their angle to the (${hkl}) planes' normal. r under 1: more crystallites with (${hkl}) parallel to the sample's surface (plates lying flat); over 1, fewer (needles); 1, none.${Number.isFinite(sig) ? ` Here ${sig.toFixed(0)} esd from 1${sig < 2 ? ': not told from no texture' : ''}.` : ''} It changes the intensities, not the widths: an intensity misfit it does not take up, a free shape would (on a SrTiO₃ sample, with none, the plates came out ⟂ ⟨310⟩ by widening the (111) and narrowing the (200))` });
      row(nm, `texture_r_${tx.hkl.join('_')}`, tx.r, tx.esd);
    }
    const sh = ss && ss.shape ? shapeOf(model, P, k, res) : null, info = (res.shapes || {})[q.id];
    if (sh){
      const off = a => `${a.angle < 0.05 ? '0' : a.angle.toFixed(1)}° off`;
      // The angular esd, by profile (xrd-rietveld turnEsds): none beyond 60°.
      // (one significant digit at least: a rod's 0.04° is not ±0.0°)
      const pm = a => Number.isFinite(a.esdAngle) && a.esdAngle <= 60 ? ` ±${a.esdAngle < 0.095 ? (+a.esdAngle.toPrecision(1)).toString() : a.esdAngle < 10 ? a.esdAngle.toFixed(1) : a.esdAngle.toFixed(0)}°` : '';
      // (the v420 ellipsoid's esds are linear: from the covariance of its L)
      // A profile sees only the valley of χ² the fit ends in: 2 of 7 free fits of
      // synthetic boxes ended 3–4 esd off, in another valley nearly as deep.
      const how = sh.type === 'ellipsoidL' ? '1σ, from the covariance of the refined parameters' : '1σ: the turn of the solid that raises χ² by χ²_ν, its sizes and its turns about the other axes refined again. It measures the valley of χ² the fit ends in, not a second orientation nearly as good, which noise can make the best';
      const angTitle = a => `the axis is ${a.angle.toFixed(1)}° from ${a.uvw}${a.label !== a.uvw ? ` (of ${a.label})` : ''}, the simplest lattice direction within 10°${Number.isFinite(a.esdAngle) && a.esdAngle <= 60 ? `; it is fixed to ±${a.esdAngle.toFixed(1)}° (${how})` : '; its direction is not fixed by the data within 60°'}; the axes' directions are given in one frame`;
      const long = ' The longest size is the least bounded: noise spreads the axes apart, and it comes out long.';
      if (sh.type === 'ellipsoidL'){
        // An axis's direction is shown only where its size is told from the other two;
        // axes whose sizes are not (a group) are reported once, as the group's mean.
        const by = sh.kind === 'plate' ? sh.axes[0] : sh.kind === 'needle' ? sh.axes[2] : null;
        const kindTxt = by && by.resolved ? `${sh.kind === 'plate' ? 'plate ⟂' : 'needle ∥'} ${by.label} (${off(by)}${pm(by)})`
          : sh.kind === 'anisotropic' ? 'anisotropic, neither plate nor needle' : sh.kind;
        lines.push({ label: 'shape', value: `ellipsoid: ${kindTxt}`, title: 'The free shape: an ellipsoid of any proportions and orientation, as the data choose. Plate: one size under half the other two; needle: one over twice the other two; triaxial: each under half the next; isometric: within 20 %, or not told apart. Sizes whose widths differ by less than 2 esd count as one' });
        const shown = new Set();
        sh.axes.forEach((a, i)=>{
          if (a.group >= 0){
            const g = sh.groups[a.group];
            if (!shown.has(a.group)){
              shown.add(a.group);
              const where = g.axes.length === 3 ? 'size, all axes' : sh.kind === 'plate' && g.axes[0] > 0 ? 'size in the plate' : sh.kind === 'needle' && g.axes[1] < 2 ? 'size across the needle' : `size, axes ${g.axes.map(j=> j + 1).join(' and ')}`;
              lines.push({ label: where, value: fmtEsd(g.D, g.Desd, ' nm'), title: `The mean of ${g.axes.length} principal axes whose sizes (${g.axes.map(j=> sh.axes[j].D.toFixed(1)).join(', ')} nm) are not told apart within 2 esd: any axes in their plane fit as well, so they have no directions of their own and their mean is the measurement` });
              row(nm, `shape_size_${g.axes.map(j=> j + 1).join('_')}_mean_nm`, g.D, g.Desd);
            }
            row(nm, `shape_size_${i + 1}_nm`, a.D, NaN);
            return;
          }
          // Each axis by its own direction, in one frame with the others: two axes of one
          // family (a plate's [110] normal and its [1-10] width) would read alike as ⟨110⟩.
          lines.push({ label: `size ∥ ${a.uvw}`, value: `${fmtEsd(a.D, a.Desd, ' nm')} · ${off(a)}${pm(a)}`, title: `Full axis of the ellipsoid along this principal axis (sizes calibrated as the isotropic one: a sphere's diameter); ${angTitle(a)}.${i === 2 ? long : ''}` });
          row(nm, `shape_size_${i + 1}_nm`, a.D, a.Desd);
          row(nm, `shape_axis_${i + 1}_${a.dir.join('_')}_deg_off`, a.angle, a.esdAngle);
        });
      } else {
        // A body: its kind and axis, its dimensions, each along its lattice direction.
        const NAME = { ellipsoid: 'ellipsoid', spheroid: 'spheroid', cylinder: 'cylinder', ellcyl: 'elliptic cylinder', box: 'box' }[sh.type];
        const ax = sh.axes.find(a=> a.role === 'axis' && a.resolved);
        // Held on the lattice (freeShape): its axes exactly on their lattice directions.
        // Held: also how far the free fit's axis was from it.
        const held = !!(info && info.held), freeOff = a => info && info.freeOff && Number.isFinite(info.freeOff[a.axis]) ? `, free ${info.freeOff[a.axis].toFixed(1)}°` : '';
        const at = a => held ? `held${a.angle >= 0.05 ? ' ' + off(a) : ''}${pm(a)}${freeOff(a)}` : `${off(a)}${pm(a)}`;
        // A dimension with no broadening along it (its width on 0): a lower limit.
        const dimTxt = a => Number.isFinite(a.D) ? fmtEsd(a.D, a.Desd, ' nm') : Number.isFinite(a.Dmin) ? `over ${a.Dmin.toFixed(0)} nm` : 'unbounded';
        lines.push({ label: 'shape', value: `${NAME}: ${sh.kind}${ax ? `, axis ∥ ${ax.uvw} (${at(ax)})` : held ? ', held on the lattice' : ''}`,
          title: `The free shape as ${/^[aeiou]/.test(NAME) ? 'an' : 'a'} ${NAME} of any proportions and orientation. ${wppm ? `Its dimensions are the solid's own (WPPM: each member of a reflection's family drawn from the solid's common-volume function along it${ln ? ', over the log-normal distribution of sizes: the dimensions of the volume-weighted mean crystallite' : ''})` : 'Its dimensions are true ones, calibrated as the isotropic size (a sphere\'s diameter); each reflection\'s width follows the solid\'s volume-weighted column length along it'}, the faces ideally flat (a 2° spread of their orientation would shorten a thin solid's sizes across them by 10–30 %).${held ? ' Its axes are held on their lattice directions: lower ΔBIC than with the orientation free, which the χ² allows too. The free fit is about as likely ("free": its axis\'s angle from the held one), so its difference is in the esds — the angle\'s at least that far' : ''}` });
        const along = { ellipsoid: { a: 'axis', b: 'axis', c: 'axis' }, spheroid: { axis: 'polar axis' }, cylinder: { axis: 'height' }, ellcyl: { axis: 'height', a: 'cross-section', b: 'cross-section' }, box: { a: 'edge', b: 'edge', c: 'edge' } }[sh.type];
        // Dimensions not told apart (xrd-rietveld bodyShapeOf groups): their mean, with
        // its esd, once; each member's own value has none (13(107) nm for a measured
        // 12.80(42)), and is shown alone only where it has a direction.
        const shown = new Set(), groupLine = (a, lab) => {
          const g = sh.groups[a.group], who = g.axes.map(i=> sh.axes.find(b=> b.axis === i).role);
          const glab = sh.type === 'ellcyl' ? 'cross-section, round' : `${sh.type === 'box' ? 'edges' : 'axes'} ${who.join(' = ')}`;
          lines.push({ label: glab, value: fmtEsd(g.D, g.Desd, ' nm'), title: `The mean of the ${NAME}'s ${who.join(', ')} (${g.axes.map(i=> sh.axes.find(b=> b.axis === i).D.toPrecision(3)).join(', ')} nm), not told apart within 2 esd. Swapping them changes the pattern little, so each alone is not measured, but their mean is` });
          row(nm, `shape_${lab.replace(/[ -]/g, '_')}_${who.join('_')}_mean_nm`, g.D, g.Desd);
        };
        sh.axes.forEach(a=>{
          const lab = along[a.role], grouped = a.group >= 0;
          if (grouped && !shown.has(a.group)){ shown.add(a.group); groupLine(a, lab); }
          const why = a.own ? 'The data do not fix its direction within 30°'
            : sh.type === 'ellcyl' ? 'Within 2 esd the cross-section is a circle, so the turn about the axis is free'
            : sh.type === 'ellipsoid' ? 'Within 2 esd it equals another axis, so the turn between them is free'
            : 'Within 2 esd its dimensions are equal: a sphere has no axis';
          const val = grouped ? (Number.isFinite(a.D) ? `${a.D.toPrecision(3)} nm` : dimTxt(a)) : dimTxt(a);
          const heldOn = `held ${a.angle >= 0.05 ? `${a.angle.toFixed(1)}° off ` : 'on '}${a.uvw}`;
          if (a.resolved) lines.push({ label: `${lab} ∥ ${a.uvw}`, value: `${val} · ${at(a)}`, title: `${lab[0].toUpperCase() + lab.slice(1)} of the ${NAME}${grouped ? ' (its own value: only the mean above is measured)' : ''}; ${held ? `${heldOn}${Number.isFinite(a.esdAngle) && a.esdAngle <= 60 ? `, which a turn of ±${a.esdAngle.toFixed(1)}° (1σ, the sizes, the other turns, scale and background refined again) would cost χ²_ν` : ''}` : angTitle(a)}` });
          else if (!grouped) lines.push({ label: lab, value: val, title: `${lab[0].toUpperCase() + lab.slice(1)} of the ${NAME}. ${why}: no direction of its own` });
          row(nm, `shape_${lab.replace(/[ -]/g, '_')}_${a.role}_nm`, a.D, a.Desd);
          // An unbounded dimension's lower limit (the card's "over N nm").
          if (!Number.isFinite(a.D) && Number.isFinite(a.Dmin)) row(nm, `shape_${lab.replace(/[ -]/g, '_')}_${a.role}_min_nm`, a.Dmin, NaN);
          if (a.resolved) row(nm, `shape_${a.role}_axis_${a.dir.join('_')}_deg_off`, a.angle, a.esdAngle);
        });
        // A body of revolution's other dimension, with no direction of its own.
        const rest = { spheroid: ['equatorial axis', 0], cylinder: ['diameter', 0] }[sh.type];
        if (rest){ const d = sh.dims[rest[1]]; lines.push({ label: rest[0], value: dimTxt(d), title: `The ${NAME}'s ${rest[0]}: across its axis, in every direction alike` }); row(nm, `shape_${rest[0].replace(/ /g, '_')}_nm`, d.D, d.Desd);
          if (!Number.isFinite(d.D) && Number.isFinite(d.Dmin)) row(nm, `shape_${rest[0].replace(/ /g, '_')}_min_nm`, d.Dmin, NaN); }
        if (info && Number.isFinite(info.dBICheld)) row(nm, 'shape_held_on_lattice', held ? 1 : 0, NaN);
      }
      // For the drawing (xrd-shape3d): the solid, and the crystal's directions on it.
      const dirs = sh.axes.filter(a=> a.resolved).map(a=> ({ label: a.uvw, vec: a.vec, esd: a.esdAngle, off: a.angle }))
        .concat((sh.across || []).map(a=> ({ label: a.uvw, vec: a.vec, esd: a.esdAngle, off: NaN })));
      // A solid free to turn about one axis (a body of revolution, or two dimensions not
      // told apart) is drawn with its body x on the first crystal direction across that
      // axis, so that the view's home azimuth keeps them apart (an arbitrary x had laid
      // a disc's [001] over its [110]).
      let frame = sh.solid.frame;
      const acr = (sh.across || [])[0], free = sh.axes.filter(a=> a.resolved);
      if (acr && free.length === 1){
        const z = free[0].e, d = acr.vec, dz = d[0]*z[0] + d[1]*z[1] + d[2]*z[2], x0 = d.map((t, i)=> t - dz*z[i]), n = Math.hypot(...x0);
        if (n > 1e-6){
          const x = x0.map(t=> t/n), y = [z[1]*x[2] - z[2]*x[1], z[2]*x[0] - z[0]*x[2], z[0]*x[1] - z[1]*x[0]];
          // The axis is body z for a body of revolution; else keep its own index.
          const k = frame.findIndex(e=> Math.abs(e[0]*z[0] + e[1]*z[1] + e[2]*z[2]) > 0.999);
          if (k === 2) frame = [x, y, z];
          else if (k >= 0){ const F = []; F[k] = z; F[(k + 1) % 3] = x; F[(k + 2) % 3] = [z[1]*x[2] - z[2]*x[1], z[2]*x[0] - z[0]*x[2], z[0]*x[1] - z[1]*x[0]].map(t=> t); frame = F; }
        }
      }
      solids.push({ id: q.id, name: nm, type: sh.type === 'ellipsoidL' ? 'ellipsoid' : sh.type, kind: sh.kind, dims: sh.solid.dims, frame, dirs: dirs.slice(0, 3), cell: sh.solid.cell });
      if (info){
        const dChi = info.chi2 - info.chi2Iso, dBIC = dChi/Math.max(1, info.chi2redIso) + (info.P - info.Piso)*Math.log(info.N);
        // (A shape is reported only when kept, i.e. at ΔBIC under −10; one rejected is in
        // the warnings with its ΔBIC.)
        lines.push({ label: 'vs isotropic', value: `ΔBIC ${dBIC.toFixed(0)} (shape supported: under −10)`,
          title: `χ² ${info.chi2Iso.toFixed(0)} → ${info.chi2.toFixed(0)} with ${info.P - info.Piso} more parameters; BIC with χ² divided by the isotropic fit's χ²_ν (${info.chi2redIso.toFixed(2)}), so that a misfit of the model is not counted as evidence.${Number.isFinite(info.dBICheld) ? ` Orientation free: ΔBIC ${info.dBICfree.toFixed(0)}; held on the lattice: ${info.dBICheld.toFixed(0)}.` : ''} Between solids: under 10 no preference; 10–30 weak, within what the search itself varies on real data; over 30 telling, more so between solids with as many parameters. The sizes depend on the solid (a spheroid's polar axis reads 4/3 as much as a disc's thickness: the column length along the axis is ¾ of the one, all of the other)` });
        row(nm, 'shape_dBIC', dBIC, NaN);
      }
      if (ln) sizeDist(q, nm, lines, true);
      strainLines(q, nm, lines, ss);
    } else if (ss){
      if (!wppm) lines.push(isFinite(ss.D)
        ? { label: 'crystallite size', value: fmtEsd(ss.D, ss.Desd, ' nm'), title: `D = Kλ/(Y_s·π/180), K = 0.9, λ the Kα₁: the Scherrer size of the phase's Lorentzian width H_L = Y_s/cosθ, Y_s = ${fmtEsd(ss.Ys, ss.YsEsd, '°')}${ss.instrumentSubtracted ? ' above the instrument’s' : ' (the instrument’s included)'}` }
        : { label: 'crystallite size', value: 'no measurable broadening' });
      else if (!ln) lines.push(isFinite(ss.D)
        ? { label: 'crystallite size (sphere)', value: fmtEsd(ss.D, ss.Desd, ' nm'), title: 'WPPM: the crystallites as spheres of one diameter, each line the Fourier transform of the sphere’s common-volume function with the instrument’s and the strain’s coefficients — the diameter itself, with no Scherrer constant' }
        : { label: 'crystallite size (sphere)', value: 'no measurable broadening' });
      if (ln) sizeDist(q, nm, lines, false);
      else row(nm, wppm ? 'sphere_diameter_nm' : 'crystallite_size_nm', ss.D, ss.Desd);
      strainLines(q, nm, lines, ss);
    }
    faultLines(q, nm, lines);
    deltaB(q, ph, nm, lines);
    if ((res.detected || []).length > 1 && wf){ lines.push({ label: 'weight fraction', value: fmtEsd(wf.W*100, wf.esd*100, ' %'), title: 'Hill–Howard: W = S·ZMV/Σ S·ZMV, of the crystalline phases' }); row(nm, 'weight_fraction_pct', wf.W*100, wf.esd*100); }
    groups.push({ name: nm, phase: true, lines });
  });
  fitNotes();
  return { groups, table, warnings, solids };
}

/* The widths for the card: per phase its rows (what the table shows), the WH fit and
   the order pairs, and how well each model predicts the measured widths: χ²_ν of
   (measured − model)/esd over the rows the tests use. Their rows go into the results
   CSV too. */
function summariseWidths(w, phases, table){
  const name = id => (phases.find(p=> p.id === id) || {}).name || '';
  return { corrected: w.corrected, phases: w.phases.map(ph=>{
    const use = ph.rows.filter(r=> !r.overlapped && !r.edge && !r.weak && !r.flat && r.Wesd > 0);
    const score = key => { const v = use.filter(r=> isFinite(r.model[key])); return v.length ? v.reduce((t, r)=> t + ((r.W - r.model[key])/r.Wesd)**2, 0)/v.length : NaN; };
    const nm = name(ph.id) || ph.name, wh = ph.wh;
    if (isFinite(wh.chi2nu)){ table.push({ phase: nm, name: 'WH_chi2nu', value: wh.chi2nu, esd: NaN }, { phase: nm, name: 'WH_size_nm', value: wh.D, esd: wh.Desd }, { phase: nm, name: 'WH_strain', value: wh.b, esd: wh.bEsd }); }
    ph.orders.forEach(o=> table.push({ phase: nm, name: `order_ratio_${o.aPlain.replace(/ /g, '')}_${o.bPlain.replace(/ /g, '')}`, value: o.R, esd: o.Resd }));
    const scores = { iso: score('iso'), shape: ph.shaped ? score('shape') : NaN };
    return { id: ph.id, name: nm, shaped: ph.shaped, rows: ph.rows, wh, orders: ph.orders, scores };
  }) };
}

self.addEventListener('message', e=>{
  const { id, x, y, varMul, instr, phases, opts } = e.data || {};
  try {
    const model = buildModel({ x, y, varMul, instr, phases });
    const res = autoRefine(model, { standard: !!opts.standard, irf: opts.irf || null, refineB: !!opts.refineB,
      onProgress: (frac, stage)=> self.postMessage({ id, type: 'progress', frac, stage }) });
    // The shape's angular esds (a profile of χ², xrd-rietveld turnEsds) take seconds.
    if (Object.keys(res.shapes || {}).length) self.postMessage({ id, type: 'progress', frac: 1, stage: 'the shape\'s angular esds' });
    const { groups, table, warnings, solids } = summarise(model, res, phases, opts);
    // The peaks' own widths and the tests on them (xrd-widths), for a sample.
    let widths = null;
    if (!opts.standard){
      const onProgress = (i, n)=> self.postMessage({ id, type: 'progress', frac: 1, stage: `peak widths, ${i} of ${n}` });
      try { widths = summariseWidths(measureWidths(model, res, { irf: opts.irf || null, isoParams: res.isoParams || null, shapeIds: Object.keys(res.shapes || {}), onProgress }), phases, table); }
      catch(e){ warnings.push('The peak widths could not be measured: ' + String(e && e.message || e)); }
    }
    self.postMessage({ id, type: 'result', res: { params: res.params, esd: res.esd, stats: res.stats, stages: res.stages, textures: res.textures, models: res.models,
      atBound: res.atBound, undetermined: res.undetermined, converged: res.converged, ms: res.ms, warnings, phaseResults: groups, table, widths, solids } });
  } catch(err){
    self.postMessage({ id, type: 'error', message: String((err && err.message) || err) });
  }
});
