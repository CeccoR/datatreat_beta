/* =========================================================
   XRD RIETVELD WORKER
   Runs a pattern's staged refinement (xrd-rietveld.js autoRefine) off the main thread,
   streams its progress, and returns the result with what the card shows of it: the
   values a line, in standard notation (the esd in brackets in the last digits), and
   the rows of the results CSV.
========================================================= */
import { buildModel, autoRefine, fitSettings, displacementMm, shapeOf, siteU, lowIndexPlanes, strainFormsAt, K_SCHERRER, OCC_MAX } from './xrd-rietveld.js';
import { measureWidths, williamsonHall } from './xrd-widths.js';
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
// 1), the esd in brackets in units of the last digit shown. The esd is rounded first:
// one rounded up to the next leading digit keeps one digit (0.0096 gives 1.50(1), not
// 1.500(10)); a last digit left of the units rounds the value there (100(300), not
// 125(314)). An esd under 10⁻¹⁵ of the value is below what a double holds (and past
// 100 decimals toFixed throws): the value alone, as without an esd.
function fmtEsd(v, e, unit = ''){
  if (!isFinite(v)) return '—';
  const p = Math.floor(Math.log10(e)), n = e/Math.pow(10, p) < 2 ? 2 : 1;
  if (!(isFinite(e) && e > 1e-15*Math.abs(v)) || n - 1 - p > 100) return (+v.toPrecision(6)).toString() + unit;
  let d = n - 1 - p, k = Math.round(e*Math.pow(10, d));
  if (k >= (n === 2 ? 20 : 10)){ k = Math.round(k/10); d--; }
  if (d >= 0) return v.toFixed(d) + '(' + k + ')' + unit;
  const s = Math.pow(10, -d);
  return String(Math.round(v/s)*s) + '(' + k*s + ')' + unit;
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
  const P = res.params, E = res.esd || {}, groups = [], table = [], warnings = [...(res.warnings || [])], solids = [];
  const row = (phase, name, value, esd)=> table.push({ phase, name, value, esd });
  // Refined here, or held at the last result (a start from it): a value of the result.
  const inResult = name => (res.free || []).includes(name) || (res.held || []).includes(name);
  // ΔB, when refined (the phase's displacement option 'overall'): one shift added to every
  // atom's B of the phase. A B made negative is no displacement at all: what it takes up
  // is something else (absorption or roughness lowering the low angles, the background).
  const deltaB = (q, ph, nm, lines)=>{
    const key = q.pfx + 'B';
    if (q.adp === 'site' || q.adp === 'aniso') return siteB(q, ph, nm, lines);
    if (!inResult(key)) return;
    const line = { label: 'ΔB (all atoms)', value: fmtEsd(P[key], E[key], ' Å²'), title: 'Added to every atom’s B from the CIF (0.5 Å² where the CIF gives none)' };
    lines.push(line);
    row(nm, 'delta_B_A2', P[key], E[key]);
    const bMin = Math.min(...(ph.atoms || []).map(a=> Number.isFinite(a.Biso) ? a.Biso : 0));
    // Only a ΔB that lowers B below 0: a negative B of the CIF's own is the phase list's
    // warning, and a positive ΔB takes up nothing of the kind.
    if (Number.isFinite(bMin) && P[key] < 0 && bMin + P[key] < 0) warnings.push(`${ph.name || q.name}: with ΔB = ${fmtEsd(P[key], E[key], ' Å²')} some atom's B is negative (${(bMin + P[key]).toFixed(2)} Å²), which no displacement gives: it more likely takes up absorption, surface roughness, the background or a site's occupancy (Site occupancy, in the settings).`);
  };
  /* B per site (isotropic), or U^ij per site within its symmetry with B_eq = 8π²U_eq
     (Fischer & Tillmanns), esd by propagation. A negative B, or a U that is not
     positive definite, is no vibration: it takes up something else (absorption,
     roughness, the background, a wrong occupancy). */
  const siteB = (q, ph, nm, lines)=>{
    if (!q.sites || !q.sites.some(st=> (st.iB != null ? [st.iB] : st.iU).some(i=> inResult(model.par[i].name)))) return;
    const cellAt = p => cellFrom(q.constraint, q.latNames.map(l=> p[q.pfx + l]), q.cell);
    for (const st of q.sites){
      if (st.iB != null){
        const k = model.par[st.iB].name;
        lines.push({ label: `B(${st.label})`, value: fmtEsd(P[k], E[k], ' Å²'), title: `The isotropic displacement parameter of site ${st.label} (${st.members.length} atom${st.members.length > 1 ? 's' : ''} of ${st.element} in the cell), B = 8π²⟨u²⟩` });
        row(nm, `B_A2_${st.label}`, P[k], E[k]);
        if (P[k] < 0) warnings.push(`${nm}: B(${st.label}) = ${fmtEsd(P[k], E[k], ' Å²')} is negative, which no vibration gives: it more likely takes up absorption, surface roughness, the background or a site's occupancy (Site occupancy, in the settings).`);
        continue;
      }
      const names = st.iU.map(i=> model.par[i].name);
      const vAt = p => Float64Array.from(model.par, (pp, i)=> p[pp.name]);
      const Nof = cell => { const { Gs } = metric(cell); return [Math.sqrt(Gs[0]), Math.sqrt(Gs[4]), Math.sqrt(Gs[8])]; };
      const Ueq = p => { const cell = cellAt(p); return uEquiv(siteU(st, vAt(p), Nof(cell)), cell); }, Beq = p => 8*Math.PI*Math.PI*Ueq(p);
      const b = Beq(P), bE = propagate(res, names, Beq);
      const comps = names.map((k, m)=> `${st.names[m]} ${fmtEsd(P[k], E[k])}`).join(', ');
      lines.push({ label: `U(${st.label})`, value: `B_eq ${fmtEsd(b, bE, ' Å²')} · ${comps} Å²`, title: `The anisotropic displacement parameters of site ${st.label} (${st.members.length} atom${st.members.length > 1 ? 's' : ''} of ${st.element}), Uⁱʲ as in a CIF (Å², on the reciprocal axes), only those the site's symmetry leaves free (${st.names.join(', ')}; the others follow from them). B_eq = 8π²U_eq, U_eq = ⅓Σ Uⁱʲ a*ᵢ a*ⱼ (aᵢ·aⱼ)` });
      names.forEach((k, m)=> row(nm, `${st.names[m]}_A2_${st.label}`, P[k], E[k]));
      row(nm, `Beq_A2_${st.label}`, b, bE);
      const Ns = Nof(cellAt(P)), Bt = betaOf(siteU(st, vAt(P), Ns), Ns);
      const m2 = Bt[0]*Bt[4] - Bt[1]*Bt[3], det = Bt[0]*(Bt[4]*Bt[8] - Bt[5]*Bt[7]) - Bt[1]*(Bt[3]*Bt[8] - Bt[5]*Bt[6]) + Bt[2]*(Bt[3]*Bt[7] - Bt[4]*Bt[6]);
      if (!(Bt[0] > 0 && m2 > 0 && det > 0)) warnings.push(`${nm}: the displacements of site ${st.label} are not positive definite (some direction has ⟨u²⟩ ≤ 0), which no vibration gives: they more likely take up absorption, roughness, the background or a wrong occupancy.`);
    }
  };
  /* The refined site occupancies: each the share of its site the CIF's species fills, as
     the pattern reads it — scattering alike at every angle, so a site that has lost atoms
     (vacancies, a depleted surface) or holds a lighter species beside them reads under 1,
     a heavier one over 1. */
  const occLines = (q, nm, lines)=>{
    for (const st of q.occSites || []){
      const k = model.par[st.iOcc].name;
      if (!inResult(k)) continue;
      const v = P[k], e = E[k], n = st.members.length;
      lines.push({ label: `occupancy (${st.label})`, value: fmtEsd(v, e), title: `The occupancy of site ${st.label} (${n} atom${n > 1 ? 's' : ''} of ${st.element} in the cell; ${st.occ} in the CIF), refined: the share of the site its species fills, read from how strongly it scatters at every angle alike. Under 1, atoms missing (vacancies, a depleted surface) or a lighter species beside them; over 1, a heavier one. It is correlated with the scale and the displacement parameters: on data to 80° hold B or refine one ΔB beside it` });
      row(nm, `occupancy_${st.label}`, v, e);
      const z = Number.isFinite(e) && e > 0 ? (v - 1)/e : NaN;
      if (v >= OCC_MAX - 1e-6 || v <= 1e-6) warnings.push(`${nm}: the occupancy of site ${st.label} is on its bound (${v <= 1e-6 ? 0 : OCC_MAX}): it takes up something the model lacks rather than a share of the site.`);
      else if (z > 3) warnings.push(`${nm}: the occupancy of site ${st.label} is ${fmtEsd(v, e)}, ${z.toFixed(0)} esd over 1: the site scatters more than ${st.element} alone can — a heavier species on it, or the occupancy taking up something else (absorption, the background, a texture).`);
    }
  };
  // The preferred orientation (March–Dollase), its axis and r: a sample's phase, or the
  // standard's LaB6 when its settings ask for one (v429).
  const textureLine = (q, nm, lines)=>{
    const tx = (res.textures || {})[q.id];
    if (!(tx && tx.hkl)) return;
    const hkl = tx.hkl.map(x=> x < 0 ? '−' + (-x) : x).join(''), sig = Number.isFinite(tx.esd) && tx.esd > 0 ? Math.abs(tx.r - 1)/tx.esd : NaN;
    lines.push({ label: `preferred orientation (${hkl})`, value: `r = ${fmtEsd(tx.r, tx.esd)}`, title: `March–Dollase: each reflection's members weighed by (r²·cos²α + sin²α/r)^(−3/2), α their angle to the (${hkl}) planes' normal. r under 1: more crystallites with (${hkl}) parallel to the sample's surface (plates lying flat); over 1, fewer (needles); 1, none.${Number.isFinite(sig) ? ` Here ${sig.toFixed(0)} esd from 1${sig < 2 ? ': not told from no texture' : ''}.` : ''} It changes the intensities, not the widths: an intensity misfit it does not take up, a free shape would (on a SrTiO₃ sample whose Sr site scatters 0.7 of a full one, with that occupancy held at 1 and no texture, the plates came out ⟂ ⟨310⟩ by widening the (111) and narrowing the (200); with it refined, ⟂ ⟨110⟩, as the crystals are)` });
    row(nm, `texture_r_${tx.hkl.join('_')}`, tx.r, tx.esd);
  };
  // What the numbers rest on: a refinement stopped short, parameters on a bound (read
  // as limits), parameters the data do not determine — the standard's too, whose
  // profile the samples take.
  const fitNotes = ()=>{
    if (res.converged === false) warnings.push('The last refinement stopped at its iteration limit before converging: the values may still move a little.');
    const atB = (res.atBound || []).filter(n=> !/^bg/.test(n));
    if (atB.length) warnings.push(`On a bound, so to be read as limits: ${atB.map(n=> friendly(model, n)).join(', ')}.`);
    const und = (res.undetermined || []).filter(n=> !/^bg/.test(n));
    // Those the pattern sees only in a combination (X with a phase's Xs: the profile has X + Xs).
    const ties = (res.tied || []).map(t=> t.filter(n=> !/^bg/.test(n))).filter(t=> t.length > 1);
    if (und.length) warnings.push(`Not determined by the data (no esd): ${und.map(n=> friendly(model, n)).join(', ')}${ties.length ? ` — the pattern sees only a combination of ${ties.map(t=> t.map(n=> friendly(model, n)).join(' and ')).join('; of ')}` : ''}.`);
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
    // The standard's displacement parameters and texture (the built-in LaB6's settings,
    // xrd-rv.js: one ΔB by default): a group of their own, as a phase's. (Before v429 it had
    // no texture; with one asked for in the settings, r was refined and not shown.)
    const nm = phases[0].name || model.phases[0].name, lines = [];
    deltaB(model.phases[0], phases[0], nm, lines);
    textureLine(model.phases[0], nm, lines);
    if (lines.length) groups.push({ name: nm, phase: true, lines });
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
      for (const [lab, f, key, t] of [['volume-weighted mean diameter', 0, 'size_volume_mean_nm', '⟨D⁴⟩/⟨D³⟩ of the spheres: what the lines’ breadth measures (the Lorentzian model’s size reads 0.94–1.13 times it at σ 0.5–0.8, more for a narrower distribution, less for a wider one)'],
        ['median diameter', 3.5, 'size_median_nm', 'the log-normal’s median, e^{−3.5σ²} times the volume-weighted mean'], ['number-weighted mean diameter', 3, 'size_number_mean_nm', 'the mean over the crystallites counted one by one (as a TEM count gives), e^{−3σ²} times the volume-weighted mean']]){
        const v = at(f)(P), e = propagate(res, [ys, ls], at(f));
        lines.push({ label: lab, value: fmtEsd(v, e, ' nm'), title: `WPPM, spheres with a log-normal distribution of diameters: ${t}` });
        row(nm, key, v, e);
      }
    }
    lines.push({ label: 'σ of ln D', value: fmtEsd(sg, sgE), title: `The log-normal width of the sizes${shaped ? ' (all the solid’s dimensions scaled together)' : ''}. It shapes the profile at a given breadth: 0 is one size (the tails fall fast); at about 0.76 the tails are as heavy as the Lorentzian model’s (⟨L⟩_A/⟨L⟩_V = 0.5), the top as sharp already at 0.66 (FWHM/β = 2/π); more is sharper still at the top with longer tails. It rests on the profiles’ shape, so on how well the instrument’s is known` });
    row(nm, 'size_lognormal_sigma', sg, sgE);
    /* A width past the Lorentzian's by the tails: ⟨L⟩_A/⟨L⟩_V = (8/9)·e^{−σ²} for log-normal
       spheres, under the Lorentzian's 0.5 from σ = √ln(16/9) = 0.7585 (0.8 to v426, which
       let 0.76–0.8 pass unwarned): most of the volume in crystallites far smaller than the
       mean, the median below a nanometre at σ near 1. Then the far tails set σ, and a
       background, a broad second phase or strain with long tails take the same shape: an
       unmodelled amorphous hump (FWHM 12°, 40 % of the background) moved the median of
       synthetic SrTiO₃ by −3 % at σ 0.5, −8 % at 0.8 and −18 % at 1.1 (2.0, 3.1, 3.8 esd;
       d ln median/dσ = −7σ), the volume-weighted mean within 0.6 %; without it all came
       within 1.1 esd. */
    if (sg >= Math.sqrt(Math.log(16/9))){
      const med = !shaped && P[ys] > 0 ? Dof(P[ys])*Math.exp(-3.5*sg*sg) : NaN;
      warnings.push(`${nm}: σ of ln D = ${fmtEsd(sg, sgE)} is a distribution wider than the Lorentzian profile's (its tails heavier)${Number.isFinite(med) ? `, its median at ${med.toPrecision(2)} nm` : ''}: the profiles' far tails set it, which a background, a broad second phase or a strain with long tails can shape as well. The volume-weighted mean stands; the median and the number mean rest on that tail.`);
    }
  };
  /* The microstrain: isotropic, or Stephens' (anisotropic: ε² = ε₀² + 10⁻⁶ Σ S_j q_j(u),
     q_j the Laue-invariant quartic forms of the diffraction vector's direction, orthonormal
     over the directions) given as its rms over directions, ε₀ when no direction's ε² is
     held at 0; the anisotropic part's rms, √ΣS_j²; and ε along the normals of the
     low-index planes. The rms and the anisotropy do not depend on how the file sets the
     cell; the S_j (CSV) are the conventional cell's (strainFrame). */
  const strainLines = (q, nm, lines, ss)=>{
    const md = (res.models || {})[q.id] || {};
    if (md.strain === 'off'){ if (md.size !== false) lines.push(offLine(md)); return; }
    if (!(md.strain === 'aniso' && q.iS)){
      lines.push({ label: 'microstrain', value: fmtEsd(ss.strain, ss.strainEsd), title: 'ε from the Lorentzian FWHM X_s·tanθ = 4ε·tanθ: a strain defined on the FWHM, as the sizes’ K = 0.9 is. Stokes and Wilson’s e = β/(4 tanθ), on the integral breadth, is π/2 = 1.57 times it (their apparent strain η = 4e); GSAS-II’s isotropic microstrain (in 10⁻⁶) is 4ε·10⁶' });
      row(nm, 'microstrain', ss.strain, ss.strainEsd);
      return;
    }
    const names = [q.pfx + 'Xs', ...q.iS.map(i=> model.par[i].name)], M = q.constraint && q.constraint.basis;
    const e2At = (p, qv) => { let e2 = (p[q.pfx + 'Xs']*D2R/4)**2; q.iS.forEach((ix, j)=> { e2 += 1e-6*p[model.par[ix].name]*qv[j]; }); return e2; };
    /* Over the directions (a Fibonacci sphere of 4000: the rms within 10⁻⁵ of a 400 000-
       point one's): where the S_j take ε² below 0 it is held at 0, and the mean of ε² is
       then above ε₀² — by 5.6 % in ε at X_s 0.4°, S1 = −3 on a cubic phase, a fifth of
       the directions held. (ε² = 0 everywhere, no strain at all, holds none.) */
    const NS = 4000, sph = Array.from({ length: NS }, (_, i)=> { const z = 1 - (2*i + 1)/NS, r = Math.sqrt(1 - z*z), ph = i*2.399963229728653; return q.strainForms.map(c=> evalQuartic(c, [r*Math.cos(ph), r*Math.sin(ph), z])); });
    const held = sph.filter(qv=> e2At(P, qv) < 0).length/NS;
    const rms = p => Math.sqrt(sph.reduce((s, qv)=> s + Math.max(0, e2At(p, qv)), 0)/NS);
    const e0 = ss.strain, e0E = ss.strainEsd, er = held ? rms(P) : e0, erE = held ? propagate(res, names, rms) : e0E;
    const pct = `${held < 0.01 ? (100*held).toPrecision(1) : (100*held).toFixed(0)} %`;
    const tip = 'Stephens’ anisotropic microstrain: ε² = ε₀² + 10⁻⁶ Σ S_j q_j(u), q_j the quartic forms of the diffraction vector’s direction u that the Laue group leaves unchanged, orthonormal over the directions (zero mean, unit rms), so the quartic terms average to 0 over them';
    lines.push({ label: 'microstrain, rms over directions', value: fmtEsd(er, erE), title: held ? `${tip}. Along ${pct} of the directions they take ε² below 0, where it is held at 0: the rms over directions is then above ε₀ = ${fmtEsd(e0, e0E)}` : `${tip}: the rms over directions is ε₀` });
    row(nm, 'microstrain', er, erE);
    if (held) lines.push({ label: 'microstrain ε₀ (isotropic part)', value: fmtEsd(e0, e0E), title: `ε₀ = X_s·(π/180)/4: what the rms over directions would be if no direction’s ε² were held at 0 (here ${pct} are)` });
    row(nm, 'microstrain_eps0', e0, e0E);
    // The anisotropic part's rms over directions, √ΣS_j² (the forms orthonormal): unlike
    // the S_j, the same whatever basis of forms the cell's setting gives.
    const sNames = names.slice(1), anis = p => Math.hypot(...sNames.map(k=> p[k])), an = anis(P), anE = propagate(res, sNames, anis);
    lines.push({ label: 'anisotropy, rms of ε² − ε₀² over directions', value: `${fmtEsd(an, anE)}·10⁻⁶`, title: `√Σ S_j² ·10⁻⁶, beside ε₀² = ${(1e6*e0*e0).toPrecision(3)}·10⁻⁶: how far ε² departs from its mean over the directions. It does not depend on how the cell is set. The S_j (in the CSV) are built on the conventional cell’s axes, reduced where the symmetry leaves them open (an orthorhombic cell’s in order of length, a monoclinic cell’s a–c pair, a triclinic cell’s Buerger cell); a turn of a and b that only the atoms tell apart ((b, a, −c) for 4/m and −3, (−a, −b, c) for −3 and −3m on a primitive lattice) still changes the sign of one or two` });
    row(nm, 'stephens_anisotropy_rms_1e-6', an, anE);
    const inv = m => { const [a, b, c, d, e, f, g, h, i] = m, A = e*i - f*h, Bc = -(d*i - f*g), C = d*h - e*g, det = a*A + b*Bc + c*C; return [A/det, -(b*i - c*h)/det, (b*f - c*e)/det, Bc/det, (a*i - c*g)/det, -(a*f - c*d)/det, C/det, -(a*h - b*g)/det, (a*e - b*d)/det]; };
    const Mi = M ? inv(M) : null;
    for (const hc of lowIndexPlanes(q)){
      const h = Mi ? [0, 1, 2].map(j=> hc[0]*Mi[j] + hc[1]*Mi[3 + j] + hc[2]*Mi[6 + j]) : hc;
      const qv = strainFormsAt(q, h);
      const e2Of = p => e2At(p, qv);
      const eps = p => Math.sqrt(Math.max(0, e2Of(p)));
      // ε² below 0 along a direction (the S terms past ε₀²): the refinement's lines there
      // carry no strain, read as 0.
      const clipped = !(e2Of(P) > 0), v = eps(P), e = clipped ? NaN : propagate(res, names, eps);
      lines.push({ label: `microstrain, (${hklText(hc)})`, value: clipped ? '0 (ε² ≤ 0 here, held at 0)' : fmtEsd(v, e), title: `The strain along the normal of the (${hklText(hc)}) planes and their family, which their reflections and orders measure${clipped ? '. Here the quartic terms take ε² to 0 or below, which no strain gives: the lines along it carry none, and the S_j are pressed against that' : ''}` });
      row(nm, `microstrain_${hc.join('_')}`, v, e);
    }
    q.iS.forEach((ix, j)=> row(nm, `stephens_S${j + 1}_1e-6`, P[model.par[ix].name], E[model.par[ix].name]));
  };
  // A size or a strain switched off in the settings: one line in their place.
  const offLine = md => {
    const what = [md.size === false && 'crystallite size', md.strain === 'off' && 'microstrain'].filter(Boolean).join(' and ');
    return { label: 'not refined', value: what, title: `Switched off in the settings: the ${what} ${md.size === false && md.strain === 'off' ? 'are' : 'is'} not modelled (${[md.size === false && 'Y_s', md.strain === 'off' && 'X_s'].filter(Boolean).join(', ')} held at 0)${res.irf ? '' : '. Without the standard\u2019s profile the whole width is refined in the instrument\u2019s terms anyway'}` };
  };
  // Planar faults: their probability per plane, and what it means in planes between faults.
  const faultLines = (q, nm, lines)=>{
    const md = (res.models || {})[q.id] || {};
    if (!md.faults || !q.faultTab) return;
    const k = q.pfx + 'FA', a = P[k], e = E[k], fs = q.faultSpec, fr = fs.disp.f;
    const frac = Math.abs(fr - 1/6) < 1e-9 ? '⅙' : Math.abs(fr - 0.5) < 1e-9 ? '½' : Math.abs(fr - 1/3) < 1e-9 ? '⅓' : Math.abs(fr - 0.25) < 1e-9 ? '¼' : fr.toFixed(3);
    lines.push({ label: `planar faults {${hklText(fs.plane)}}, ${frac}⟨${hklText(fs.disp.uvw)}⟩`, value: `${fmtEsd(a, e)} per plane${a > 0 ? ` (one in ${(1/a).toPrecision(2)})` : ''}`,
      title: `Faults on the {${hklText(fs.plane)}} planes (${q.faultTab.planes} orientations, ${q.faultTab.dLayer.toFixed(3)} Å apart), each shifting the crystal beyond it by ${frac}⟨${hklText(fs.disp.uvw)}⟩ (those in the plane, ± alike): a reflection whose h·R is not an integer loses coherence across each one — a Lorentzian broadening that depends on h·R modulo 1 (for ½-type shifts the indices’ parity, for ⅓ and ⅙ the indices modulo 3), so a higher order can be sharp where the first is not. The probability is per lattice plane of the family (where the structure stacks several layers per plane, as hcp and wurtzite stack two close-packed layers per c, it is that many times a probability per layer), with faults on all ${q.faultTab.planes} orientations at once in each crystallite${q.faultTab.planes > 1 ? ` (Warren’s α, for faults on one orientation alone, gives the same mean broadening at about ${q.faultTab.planes}× this)` : ''}` });
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
                                 : cellFrom(C, q.latNames.map(l=> p[q.pfx + l]), q.cell)).V;
    const V = vol(P), VE = propagate(res, q.latNames.map(l=> q.pfx + l), vol);
    lines.push({ label: conv ? 'V (conventional cell)' : 'V', value: fmtEsd(V, VE, ' Å³') }); row(nm, conv ? 'V_conventional_A3' : 'V_A3', V, VE);
    textureLine(q, nm, lines);
    const sh = ss && ss.shape ? shapeOf(model, P, k, res) : null, info = (res.shapes || {})[q.id];
    if (sh){
      const off = a => `${a.angle < 0.05 ? '0' : a.angle.toFixed(1)}° off`;
      // The angular esd, by profile (xrd-rietveld turnEsds): none beyond 60°. One
      // significant digit at least (a rod's 0.04° is not ±0.0°), one decimal to 9.95°, whole
      // degrees past it: as the 3D view's labels give it (xrd-shape3d fmtDeg).
      const deg = x => x < 0.095 ? (+x.toPrecision(1)).toString() : x < 9.95 ? x.toFixed(1) : x.toFixed(0);
      const pm = a => Number.isFinite(a.esdAngle) && a.esdAngle <= 60 ? ` ±${deg(a.esdAngle)}°` : '';
      // (the v420 ellipsoid's esds are linear: from the covariance of its L)
      // A profile sees only the valley of χ² the fit ends in: 2 of 7 free fits of
      // synthetic boxes ended 3–4 esd off, in another valley nearly as deep.
      const how = sh.type === 'ellipsoidL' ? '1σ, from the covariance of the refined parameters' : '1σ: the turn of the solid that raises χ² by χ²_ν (the linear esds\' convention too: their covariance is scaled by χ²_ν), with every other parameter, its turns about the other axes too, refined again. It measures the valley of χ² the fit ends in, not a second orientation nearly as good, which noise can make the best';
      const angTitle = a => `the axis is ${a.angle.toFixed(1)}° from ${a.uvw}${a.label !== a.uvw ? ` (of ${a.label})` : ''}, the simplest lattice direction within 10°${Number.isFinite(a.esdAngle) && a.esdAngle <= 60 ? `; it is fixed to ±${deg(a.esdAngle)}° (${how})` : '; its direction is not fixed by the data within 60°'}; the axes' directions are given in one frame`;
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
          lines.push({ label: `size ∥ ${a.uvw}`, value: `${fmtEsd(a.D, a.Desd, ' nm')} · ${off(a)}${pm(a)}`, title: `Full axis of the ellipsoid along this principal axis (read as the isotropic size is, Scherrer with K = 0.9: an apparent size, not a true dimension; a sphere of one size reads 1.0–1.7 times its diameter); ${angTitle(a)}.${i === 2 ? long : ''}` });
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
          title: `The free shape as ${/^[aeiou]/.test(NAME) ? 'an' : 'a'} ${NAME} of any proportions and orientation. ${wppm ? `Its dimensions are the solid's own (WPPM: each member of a reflection's family drawn from the solid's common-volume function along it${ln ? ', over the log-normal distribution of sizes: the dimensions of the volume-weighted mean crystallite' : ''})` : 'Its dimensions are read as the isotropic size is (Scherrer, K = 0.9: a sphere of one size reads 1.0–1.7 times its diameter), not true ones, which WPPM gives; each reflection\'s width follows the solid\'s volume-weighted column length along it'}, the faces ideally flat (a 2° spread of their orientation would shorten a thin solid's sizes across them by 10–30 %).${held ? ' Its axes are held on their lattice directions: lower ΔBIC than with the orientation free, which the χ² allows too. The free fit is about as likely ("free": its axis\'s angle from the held one), so its difference is in the esds — the angle\'s at least that far' : ''}` });
        const along = { ellipsoid: { a: 'axis', b: 'axis', c: 'axis' }, spheroid: { axis: 'polar axis' }, cylinder: { axis: 'height' }, ellcyl: { axis: 'height', a: 'cross-section', b: 'cross-section' }, box: { a: 'edge', b: 'edge', c: 'edge' } }[sh.type];
        // Dimensions not told apart (xrd-rietveld bodyShapeOf groups): their mean, with
        // its esd, once; each member's own value has none (13 ± 107 nm for a measured
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
          if (a.resolved) lines.push({ label: `${lab} ∥ ${a.uvw}`, value: `${val} · ${at(a)}`, title: `${lab[0].toUpperCase() + lab.slice(1)} of the ${NAME}${grouped ? ' (its own value: only the mean above is measured)' : ''}; ${held ? `${heldOn}${Number.isFinite(a.esdAngle) && a.esdAngle <= 60 ? `, which a turn of ±${deg(a.esdAngle)}° (1σ, every other parameter refined again) would cost χ²_ν` : ''}` : angTitle(a)}` });
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
      // Each axis's cone about the axis itself (e, on the side of its lattice direction),
      // which its esd measures, its lattice direction [uvw] the arrow, off° from it; the
      // directions across a body of revolution (free to turn about its axis) have none.
      const dirs = sh.axes.filter(a=> a.resolved).map(a=>{
        const s = a.e[0]*a.vec[0] + a.e[1]*a.vec[1] + a.e[2]*a.vec[2] < 0 ? -1 : 1;
        return { label: a.uvw, vec: a.vec, axis: a.e.map(t=> s*t), esd: a.esdAngle, off: a.angle };
      }).concat((sh.across || []).map(a=> ({ label: a.uvw, vec: a.vec, esd: NaN, off: NaN, about: true })));
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
      if (info && Number.isFinite(info.chi2)){
        const dChi = info.chi2 - info.chi2Iso, dBIC = dChi/Math.max(1, info.chi2redIso) + (info.P - info.Piso)*Math.log(info.N);
        // (A shape is reported only when kept, i.e. at ΔBIC under −10; one rejected is in
        // the warnings with its ΔBIC.)
        lines.push({ label: 'vs isotropic', value: `ΔBIC ${dBIC.toFixed(0)} (shape supported: under −10)`,
          title: `${info.carried ? 'The last result\u2019s search (this refinement started from it, the shape not searched again): ' : ''}χ² ${info.chi2Iso.toFixed(0)} → ${info.chi2.toFixed(0)} with ${info.P - info.Piso} more parameters; BIC with χ² divided by the isotropic fit's χ²_ν (${info.chi2redIso.toFixed(2)}), so that a misfit of the model is not counted as evidence.${Number.isFinite(info.dBICheld) ? ` Orientation free: ΔBIC ${info.dBICfree.toFixed(0)}; held on the lattice: ${info.dBICheld.toFixed(0)}.` : ''} Between solids: under 10 no preference; 10–30 weak, within what the search itself varies on real data; over 30 telling, more so between solids with as many parameters. The sizes depend on the solid (a spheroid's polar axis reads 4/3 as much as a disc's thickness: the column length along the axis is ¾ of the one, all of the other)` });
        row(nm, 'shape_dBIC', dBIC, NaN);
      }
      if (ln) sizeDist(q, nm, lines, true);
      strainLines(q, nm, lines, ss);
    } else if (ss && md0.size === false){
      // Switched off: no size line, and no strain line either when that is off too.
      lines.push(offLine(md0));
      if (md0.strain !== 'off') strainLines(q, nm, lines, ss);
    } else if (ss){
      if (!wppm) lines.push(isFinite(ss.D)
        ? { label: 'crystallite size', value: fmtEsd(ss.D, ss.Desd, ' nm'), title: `D = Kλ/(Y_s·π/180), K = 0.9, λ the Kα₁: the Scherrer size of the phase's Lorentzian width H_L = Y_s/cosθ, Y_s = ${fmtEsd(ss.Ys, ss.YsEsd, '°')}${ss.instrumentSubtracted ? ' above the instrument’s' : ' (the instrument’s included)'}. An apparent size, comparable with the Analysis card's, not a diameter: the Lorentzian fitted to a crystallite's line follows its tails too, and spheres of one size read 1.0–1.7 times their diameter (more the larger they are). WPPM gives the diameter` }
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
    occLines(q, nm, lines);
    if ((res.detected || []).length > 1 && wf){ lines.push({ label: 'weight fraction', value: fmtEsd(wf.W*100, wf.esd*100, ' %'), title: 'Hill–Howard: W = S·ZMV/Σ S·ZMV, of the crystalline phases' }); row(nm, 'weight_fraction_pct', wf.W*100, wf.esd*100); }
    // Held at the last result (a start from it): which of the values above are that
    // refinement's, shown without an esd here.
    const heldHere = new Set((res.held || []).filter(n=> n.startsWith(q.pfx)).map(n=> {
      const i = model.index[n], p = model.par[i];
      return p.kind === 'scale' ? 'scale' : p.kind === 'lattice' ? 'cell' : i === q.iXs || p.kind === 'strain' ? 'strain' : p.kind === 'size' || p.kind === 'dist' ? 'size'
        : p.kind === 'shape' ? 'shape' : p.kind === 'faults' ? 'faults' : p.kind === 'B' || p.kind === 'adp' ? 'displacements' : p.kind === 'occ' ? 'occupancy' : p.kind === 'texture' ? 'texture' : null;
    }).filter(Boolean));
    if (heldHere.size) lines.push({ label: 'held at the last result', value: ['scale', 'cell', 'size', 'strain', 'shape', 'faults', 'displacements', 'occupancy', 'texture'].filter(g=> heldHere.has(g)).join(' · '),
      title: 'These values are the last refinement’s, held in this one: they have no esd here (that refinement gave theirs), and what was refined here is conditional on them. A last refinement with nothing held gives values and esds free of that' });
    groups.push({ name: nm, phase: true, lines });
  });
  fitNotes();
  return { groups, table, warnings, solids };
}

/* The widths for the card: per phase its rows (what the table shows), the WH fit and
   the order pairs, and how well each model predicts the measured widths: χ²_ν of
   (measured − model)/esd over the rows the tests use. Their rows go into the results
   CSV too. For an isotropic WPPM phase, the reading: its sizes are true diameters, the
   table's and the Williamson–Hall line's Scherrer readings (K = 0.9 on the FWHM), which
   come out lower for a sphere of one size (0.85–0.88 of it) and otherwise as σ has it;
   the line through the model's own widths, read the same way, says by how much. */
function summariseWidths(w, phases, table, model, res){
  const name = id => (phases.find(p=> p.id === id) || {}).name || '';
  return { corrected: w.corrected, phases: w.phases.map(ph=>{
    const use = ph.rows.filter(r=> !r.overlapped && !r.edge && !r.weak && !r.flat && r.Wesd > 0);
    const score = key => { const v = use.filter(r=> isFinite(r.model[key])); return v.length ? v.reduce((t, r)=> t + ((r.W - r.model[key])/r.Wesd)**2, 0)/v.length : NaN; };
    const nm = name(ph.id) || ph.name, wh = ph.wh;
    if (isFinite(wh.chi2nu)){ table.push({ phase: nm, name: 'WH_chi2nu', value: wh.chi2nu, esd: NaN }, { phase: nm, name: 'WH_size_nm', value: wh.D, esd: wh.Desd }, { phase: nm, name: 'WH_strain', value: wh.b, esd: wh.bEsd }); }
    ph.orders.forEach(o=> table.push({ phase: nm, name: `order_ratio_${o.aPlain.replace(/ /g, '')}_${o.bPlain.replace(/ /g, '')}`, value: o.R, esd: o.Resd }));
    const scores = { iso: score('iso'), shape: ph.shaped ? score('shape') : NaN };
    const k = model.phases.findIndex(q=> String(q.id) === String(ph.id)), md = (res.models || {})[ph.id] || {}, ss = (res.sizeStrain || [])[k];
    let reading = null;
    if (md.profile && md.profile !== 'lorentz' && !ph.shaped && ss && isFinite(ss.D)){
      const own = williamsonHall(ph.rows.filter(r=> isFinite(r.model.iso)).map(r=> ({ ...r, W: r.model.iso })), w.lam);
      if (isFinite(own.D)){ reading = { D: ss.D, Dmodel: own.D, lognormal: md.profile === 'lognormal' }; table.push({ phase: nm, name: 'WH_size_model_nm', value: own.D, esd: NaN }); }
    }
    return { id: ph.id, name: nm, shaped: ph.shaped, rows: ph.rows, overlapShare: ph.overlapShare, misfit: ph.misfit, wh, orders: ph.orders, scores, reading };
  }) };
}

self.addEventListener('message', e=>{
  const { id, x, y, varMul, instr, phases, opts } = e.data || {};
  try {
    // The fit's settings (the card's Refinement settings): the background's terms and the
    // lattice bounds are the model's, the rest autoRefine's.
    const fit = fitSettings(opts.fit);
    const model = buildModel({ x, y, varMul, instr, phases, bgDegree: fit.bgDegree, bgInv: fit.bgInv, cellRange: fit.cellRange });
    // opts.start, opts.hold: from the last result, groups held there (autoRefine).
    const res = autoRefine(model, { standard: !!opts.standard, irf: opts.irf || null, refineB: !!opts.refineB, fit, start: opts.start || null, hold: opts.hold || [],
      onProgress: (frac, stage)=> self.postMessage({ id, type: 'progress', frac, stage }) });
    // The shape's angular esds (a profile of χ², xrd-rietveld turnEsds) take seconds.
    if (Object.keys(res.shapes || {}).length) self.postMessage({ id, type: 'progress', frac: 1, stage: 'the shape\'s angular esds' });
    const { groups, table, warnings, solids } = summarise(model, res, phases, opts);
    // The peaks' own widths and the tests on them (xrd-widths), for a sample.
    let widths = null;
    if (!opts.standard){
      const onProgress = (i, n)=> self.postMessage({ id, type: 'progress', frac: 1, stage: `peak widths, ${i} of ${n}` });
      try { widths = summariseWidths(measureWidths(model, res, { irf: res.irf || null, isoParams: res.isoParams || null, shapeIds: Object.keys(res.shapes || {}), onProgress }), phases, table, model, res); }
      catch(e){ warnings.push('The peak widths could not be measured: ' + String(e && e.message || e)); }
    }
    self.postMessage({ id, type: 'result', res: { params: res.params, esd: res.esd, stats: res.stats, stages: res.stages, textures: res.textures, models: res.models,
      atBound: res.atBound, undetermined: res.undetermined, converged: res.converged, ms: res.ms, warnings, phaseResults: groups, table, widths, solids,
      // what the next start from this result needs (opts.start): what was refined, and
      // held at the one before; the phases detected; the shapes kept and their isotropic fit
      free: res.free, held: res.held || [], detected: res.detected, shapes: res.shapes || {}, isoParams: res.isoParams || null,
      // the settings used, defaults filled in: the page draws the result on a model built
      // with them (its background terms), not with the settings as they are now
      fit: res.fit,
      // the standard's profile as used: none when it did not apply (another λ1)
      irf: res.irf || null, irfRefused: !!opts.irf && !res.irf } });
  } catch(err){
    self.postMessage({ id, type: 'error', message: String((err && err.message) || err) });
  }
});
