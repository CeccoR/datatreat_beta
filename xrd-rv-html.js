/* =========================================================
   XRPD — the Rietveld card's words and markup that need no page (xrd-rv.js puts them in
   the card): the names from CIFs escaped, what a phase is refined with in a line, Miller
   indices with their bars, formulae, the instrument's line, the solids' captions, and the
   markup of the phases' list, the structure's details, the settings window's body, the
   peak widths' table and the tests on them, each from plain values.
========================================================= */
import { MODE, formulaOf, hklRuns, hklShow, engineOf, START_RULE, listOf } from './xrd-rv-model.js';
import { metric } from './xrd-cryst.js';
import { sgPretty } from './xrd-sg.js';
import { elementColor } from './xrd-cell3d.js';
import { fmtEsd } from './xrd-math.js';

// Names, formulae and notes come from CIF files, which may be anyone's: they go into the
// page as text, never as markup.
const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SYSTEM_NAMES = { cubic:'cubic', hexagonal:'hexagonal', trigonal:'trigonal', tetragonal:'tetragonal', orthorhombic:'orthorhombic', monoclinic:'monoclinic', triclinic:'triclinic' };

/* What a phase is refined with, in a line: from the engine's options (engineOf's: the
   settings, summaryOf; or a result's models, refinedOf), so both read alike. A shape is
   'box', … or false; tried: a solid searched and not kept; po an axis, 'auto' or null. */
function modelsLine(m, std, tried){
  const txt = (k, v) => (MODE[k].list.find(([x])=> x === v) || [v, k === 'po' ? `(${v})` : v])[1];
  const po = m.po ? 'preferred orientation ' + txt('po', m.po) : null;
  const adp = m.adp && m.adp !== 'cif' ? txt('adp', m.adp) : 'B from the CIF';
  if (std) return ["the instrument's profile", adp, po].filter(Boolean).join(' · ');
  return [!m.size ? 'no size broadening' : m.shape ? txt('size', m.shape) : 'isotropic size' + (tried ? ` (a free ${txt('size', tried).replace('free shape: ', '')} searched, not kept)` : ''),
    m.size && (m.profile === 'wppm' || m.profile === 'lognormal' ? 'WPPM, ' + txt('wppm', m.profile) : 'Lorentzian'),
    m.strain === 'off' ? 'no microstrain' : 'microstrain ' + txt('strain', m.strain),
    m.faults && 'planar faults ' + txt('faults', m.faults).replace(/,.*/, ''), adp,
    m.occ && m.occ.length && 'occupancy of ' + m.occ.join(', '), po].filter(Boolean).join(' · ');
}
// The settings in a line: what Refine will refine.
const summaryOf = (p, std) => modelsLine(engineOf(p, std), std);
// What a result refined a phase with (its models, the free shape it kept, its texture's
// axis); the settings' line for a result of v428 or older, which has no models.
function refinedOf(q, r, std){
  const md = r.models && r.models[q.id];
  if (!md) return summaryOf(q, std);
  const kept = !!(r.shapes && r.shapes[q.id]), t = r.textures && r.textures[q.id];
  const hkl = t && t.hkl ? (Array.isArray(t.hkl) ? t.hkl.join('') : String(t.hkl)) : null;
  return modelsLine({ size: md.size !== false, shape: kept ? md.shape : false, profile: md.profile, strain: md.strain || 'iso', faults: md.faults,
    adp: md.adp, occ: md.occ, po: hkl }, std, md.shape && !kept ? md.shape : null);
}
const SUBS = '₀₁₂₃₄₅₆₇₈₉';
// The runs as markup (a bar after another a little apart: each index its own), and an
// index label so (hklHtml); the indices in brackets within a line of text already escaped,
// three digits or three spaced numbers, barred where one is negative (barIdx). The minus
// stays in the text under the bar, hidden and out of the flow (.hkl-sign: no new place to
// break the line): a copy and a screen reader read (1-11), as they did to v486.
const barHtml = runs => runs.map(([s, bar], i)=> bar ? `<span class="hkl-bar${i && runs[i - 1][1] ? ' hkl-bar2' : ''}"><span class="hkl-sign">-</span>${esc(s)}</span>` : esc(s)).join('');
const hklHtml = t => barHtml(hklRuns(t));
const IDX_IN = /([([{⟨])((?:[-−]?\d){3}|[-−]?\d+(?: [-−]?\d+){2})([)\]}⟩])/g, IDX_PAIR = { '(': ')', '[': ']', '{': '}', '⟨': '⟩' };
const barIdx = html => String(html).replace(IDX_IN, (m, a, t, b)=> IDX_PAIR[a] === b && /[-−]/.test(t) ? a + barHtml(hklRuns(t)) + b : m);
// An index in a list's <option>, which takes no markup: its bar a combining overline
// (U+0305) after each digit, as Chromium draws it well over the digit; a hair space between
// two indices barred side by side, each its own bar.
const optBars = t => String(t).replace(IDX_IN, (m, a, x, b)=> IDX_PAIR[a] === b && /[-−]/.test(x)
  ? a + hklRuns(x).map(([s, bar], i, r)=> bar ? (i && r[i - 1][1] ? '\u200a' : '') + s.replace(/\d/g, '$&\u0305') : s).join('') + b : m);
const formulaPretty = f => esc(f).replace(/(\d+(?:\.\d+)?)/g, m => m.replace(/\d/g, d => SUBS[d]));

// A model's width: three decimals, or three significant digits under 0.1° (a sharp
// peak's 0.0004° read 0.000).
const f3 = v => !Number.isFinite(v) ? '—' : Math.abs(v) < 0.1 && v !== 0 ? String(+v.toPrecision(3)) : v.toFixed(3);
// A probability: two significant digits, one below 10⁻³ (where the verdict turns, 2·10⁻⁴
// read 0.000), and under the smallest a double holds as that bound.
const fmtP = q => q < 1e-300 ? '< 1e-300' : q < 1e-3 ? q.toExponential(0) : String(+q.toPrecision(2));
function solidCaption(s){
  const n = v => Number.isFinite(v) ? (v < 10 ? v.toFixed(1) : v.toFixed(0)) : '∞';
  const [x, y, z] = s.dims;
  return s.type === 'spheroid' ? `spheroid, ${s.kind}: ${n(x)} nm across, ${n(z)} nm along its axis`
    : s.type === 'cylinder' ? `cylinder, ${s.kind}: diameter ${n(x)} nm, height ${n(z)} nm`
    : s.type === 'ellcyl' ? `elliptic cylinder, ${s.kind}: ${n(x)} × ${n(y)} nm across, height ${n(z)} nm`
    : s.type === 'box' ? `box, ${s.kind}: ${n(x)} × ${n(y)} × ${n(z)} nm`
    : s.type === 'sqbox' ? `square-based box, ${s.kind}: base ${n(x)} × ${n(x)} nm, height ${n(z)} nm`
    : `ellipsoid, ${s.kind}: axes ${n(x)} × ${n(y)} × ${n(z)} nm`;
}
function instrLine(ins){
  if (!ins) return '';
  const parts = [];
  if (isFinite(ins.lam1)) parts.push(`${ins.anode || ''} Kα₁ ${ins.lam1} Å` + (isFinite(ins.lam2) && ins.ratio > 0 ? `, Kα₂ ${ins.lam2} Å (×${ins.ratio})` : ''));
  if (isFinite(ins.radius)) parts.push(`R ${ins.radius} mm`);
  if (ins.divergence && ins.divergence.type) parts.push(`${ins.divergence.type} divergence slit${isFinite(ins.divergence.deg) ? ' ' + ins.divergence.deg + '°' : ''}`);
  if (ins.soller && isFinite(ins.soller.incident)) parts.push(`Soller ${ins.soller.incident} rad`);
  if (ins.filter) parts.push(`${ins.filter.material} filter`);
  // the crystal and its polarisation ratio, as the LP factor takes them
  if (ins.monochromator) parts.push((ins.monochromators || []).map(M=> `${M.side} ${M.crystal}${M.reflections > 1 ? '×' + M.reflections : ''} `).join('+ ') + 'monochromator' + (isFinite(ins.monoK) ? ` (K ${ins.monoK.toFixed(3)})` : ''));
  if (ins.detector && ins.detector.name) parts.push(ins.detector.name);
  return parts.join(' · ') + ((ins.warnings || []).length ? ' — ⚠ ' + ins.warnings.join('; ') : '');
}
const group = (title, body, phase) => `<div class="rv-group"><div class="txt-mini${phase ? ' rv-phase-name' : ''}">${title}</div>${body}</div>`;
const warnNote = t => `<div class="rv-note rv-wide rv-warn">⚠ ${t}</div>`;
// What a result was refined with, or what Refine will refine (renderFitSet: done, a result
// refined): each phase's line, its name before it when there are several, and the
// Refinement settings used that are not the defaults (used: fitUsed).
function fitLineHtml(list, r, done, used, std){
  return list.map(q=> `<span class="rv-fs">${list.length > 1 ? `<span class="rv-key-sm" style="background:${esc(q.color)}"></span>${esc(q.prep.name)}: ` : ''}${barIdx(esc(done ? refinedOf(q, r, std) : summaryOf(q, std)))}</span>`).join('')
    + (used.length ? `<span class="rv-fs" title="The Refinement settings (Settings…) this result was refined with that are not the defaults">${esc(used.map(u=> u.said).join(', '))}</span>` : '');
}
// The phases' list (renderPhases): a row a phase, ticked for the pattern on show f (the
// standard's: the one chosen, pick), the one whose structure is on show (sel) marked;
// dlIcon and xIcon: utils.js DL_SVG and X_SVG.
function phaseRowsHtml(list, { p, std, pick, sel, f, lab6, dlIcon: DL_ICON, xIcon: X_SVG }){
  return list.length ? list.map(q=>{
    const builtIn = q === lab6, on = std ? q.id === pick : !(f && q.off[f.name]);
    // (their disabled state and title are lockRows')
    const pickEl = std
      ? `<input type="radio" name="${p}Pick" data-pick="${esc(q.id)}"${on ? ' checked' : ''} aria-label="Refine the standard with ${esc(q.prep.name)}">`
      : `<input type="checkbox" data-on="${esc(q.id)}"${on ? ' checked' : ''} aria-label="Refine ${esc(q.prep.name)} on this pattern">`;
    return `<div class="rv-cif${q.id === sel ? ' is-sel' : ''}" data-sel="${esc(q.id)}" title="${esc(q.prep.name)}${q.file ? ' · ' + esc(q.file) : builtIn ? ' · built in' : ''}">${pickEl}`
      + `<span class="rv-key" style="background:${esc(q.color)}"></span><span class="rv-cif-f">${formulaPretty(formulaOf(q.prep))}</span>`
      + `<span class="rv-cif-sg"${q.prep.sgFrom === 'atoms' ? ' title="Found from the atoms: the file is in P1"' : ''}>${esc(sgPretty(q.prep.sg) || '—')}</span>`
      // (its CIF downloaded, the built-in LaB6's too: never disabled, a run changes nothing of it)
      + `<button class="del-bare dl-bare idle-dim rv-dl" data-dl="${esc(q.id)}" title="Download the CIF" aria-label="Download the CIF of ${esc(q.prep.name)}">${DL_ICON(13)}</button>`
      // (named for its phase, as the download is; to v505 by its title, which says why when
      // it is disabled)
      + `<button class="peak-del is-danger idle-dim rv-del" data-del="${esc(q.id)}"${builtIn ? ' data-built disabled title="Built in: it cannot be removed"' : ''} aria-label="Remove ${esc(q.prep.name)}">${X_SVG(13)}</button></div>`;
  }).join('') : '';
}
// The structure's details under its 3D cell (renderCell); builtIn: the standard's LaB6.
function cellDetailsHtml(q, builtIn){
  const P = q.prep, K = P.constraint || {}, c = K.conv && K.basis ? K.conv : P.cell, r4 = v => +(+v).toFixed(4);
  const V = metric(c).V, Vc = metric(P.cell).V;
  // The density: the cell's mass (g/mol) over its volume, 1 g/mol/Å³ = 1.66054 g/cm³.
  const rho = P.mass/Vc*1.66054;
  const els = [...new Set(P.atoms.map(a=> a.element))];
  const lens = K.kind === 'cubic' ? `a = ${r4(c.a)} Å` : `a ${r4(c.a)}, b ${r4(c.b)}, c ${r4(c.c)} Å`;
  const angs = ['alpha', 'beta', 'gamma'].every(x=> Math.abs(c[x] - 90) < 1e-6) ? '' : `α ${r4(c.alpha)}, β ${r4(c.beta)}, γ ${r4(c.gamma)}°`;
  return `<div class="rv-ci-name">${esc(P.name)}</div>`
    + `<div><span>Formula</span> ${formulaPretty(formulaOf(P))}${P.Z ? `, Z = ${esc(P.Z)}` : ''}</div>`
    + `<div><span>Space group</span> ${esc(sgPretty(P.sg) || '—')}${P.sgFrom === 'atoms' ? ' (from the atoms)' : ''}</div>`
    + `<div><span>System</span> ${SYSTEM_NAMES[P.system] || esc(P.system)}, ${P.order} operations</div>`
    + `<div><span>Cell</span> ${lens}${angs ? '; ' + angs : ''}${K.conv && K.basis ? ' (conventional)' : ''}</div>`
    + `<div><span>Volume</span> ${r4(V)} Å³ · <span>ρ</span> ${rho.toFixed(3)} g/cm³</div>`
    + `<div><span>Atoms</span> ${P.atoms.length} in the cell</div>`
    + `<div class="rv-ci-els">${els.map(e=> `<span><i style="background:${elementColor(e)}"></i>${esc(e)}</span>`).join('')}</div>`
    + `<div class="rv-ci-file">${builtIn ? 'built in, the standard\'s certified cell' : esc(q.file)}</div>`
    // what reading the CIF found (its own cell, operations it lacked, B made equal on a site)
    + P.notes.map(t=> `<div class="rv-ci-note">${esc(t.charAt(0).toUpperCase() + t.slice(1))}.</div>`).join('');
}
/* The settings window's body (renderSettings): each phase's fitting modes (modes), the
   start and its groups (holds), the Refinement settings (fits) and, a sample's card, its
   section of the Results (normOptions: utils.js NORM_OPTIONS). */
function settingsBodyHtml(list, { p, std, lab6, modes: modesHere, holds: holdsHere, fits: fitsHere, normOptions: NORM_OPTIONS }){
  /* A Refinement setting's row, in the phases' columns: a field under their depths (its
     range beside it), or, for the 1/2θ term, its value as a checkbox under theirs and
     "automatic" under the depths (the value locked, showing what automatic gives). */
  function fitRow(m){
    const id = p + 'Fit_' + m.k;
    return m.bool
      ? `<div class="rvs-row" data-fit-row="${m.k}"><input type="checkbox" id="${id}" data-fit="${m.k}"><label for="${id}">${m.label}</label>`
        + `<span class="rvs-cell"><input type="checkbox" id="${id}Auto" data-fit-auto="${m.k}"><label for="${id}Auto">automatic</label></span></div>`
      : `<div class="rvs-row" data-fit-row="${m.k}"><span></span><label for="${id}">${m.label}</label>`
        + `<span class="rvs-cell"><input type="text" inputmode="decimal" autocomplete="off" id="${id}" data-fit="${m.k}" aria-label="${esc(m.label)}, ${m.rule}"><span class="rvs-range">${m.range}</span></span></div>`;
  }
  const sec = q => `<div class="rvs-sec" data-sec="${esc(q.id)}"><div class="rvs-head"><span class="rv-key" style="background:${esc(q.color)}"></span><b>${esc(q.prep.name)}</b>${q === lab6 ? '<span class="txt-meta">built in</span>' : ''}</div>`
    + modesHere.map(m=>{ const id = `${p}Set${esc(q.id)}_${m.k}`;
      return `<div class="rvs-row" data-row="${m.k}"><input type="checkbox" id="${id}" data-on="${m.k}" data-ph="${esc(q.id)}"><label for="${id}">${m.label}</label>`
        + `<select data-depth="${m.k}" data-ph="${esc(q.id)}" aria-label="${esc(m.label)} of ${esc(q.prep.name)}: depth">${listOf(q, m).map(([v, t])=> `<option value="${esc(v)}">${esc(optBars(t))}</option>`).join('')}</select></div>`; }).join('') + '</div>';
  // The hold boxes two to a row, in the phases' columns: the first under their
  // checkboxes, the second under their depths.
  const hb = ([k, t, title]) => `<input type="checkbox" id="${p}Hold_${k}" data-hold="${k}" title="${esc(title)}"><label for="${p}Hold_${k}" title="${esc(title)}">${t}</label>`;
  const pairs = []; for (let i = 0; i < holdsHere.length; i += 2) pairs.push(holdsHere.slice(i, i + 2));
  const html = (list.length ? list.map(sec).join('') : `<div class="rv-empty">No phase yet: a CIF dropped on Phases, beside the pattern, adds one.</div>`)
    + `<div class="rvs-sec rvs-start"><div class="rvs-head"><b>Start</b></div>`
    + `<div class="rvs-chips"><button type="button" class="mode-chip rvs-chip" data-start="cif" title="The full staged refinement from the CIF's cell: the cell search, then each group of parameters in turn">From the CIF</button>`
    + `<button type="button" class="mode-chip rvs-chip" data-start="last" title="From each pattern's last result, the groups ticked below held there">From the last result</button></div>`
    + pairs.map(([a, b])=> `<div class="rvs-row rvs-hold">${hb(a)}${b ? `<span class="rvs-hold2">${hb(b)}</span>` : ''}</div>`).join('')
    + `<div class="rvs-note" title="${esc(START_RULE)}">Held: a group ticked, at the last result's values, unless its option changed since (then refined from its usual start); the rest refined from there. No last result, or other phases or cells: from the CIF.</div></div>`
    + `<div class="rvs-sec rvs-fit"><div class="rvs-head"><b>Refinement</b><button type="button" class="btn rvs-def" data-fit-def title="Every Refinement setting back to the engine's default">Defaults</button></div>`
    + fitsHere.map(fitRow).join('') + `<div class="rvs-note" data-fit-note></div></div>`
    // (the samples' card: its section of the Results; the standard has none)
    + (std ? '' : `<div class="rvs-sec rvs-res"><div class="rvs-head"><b>Results</b></div>`
      + `<div class="rvs-row"><span></span><label for="${p}ResNorm">Normalization</label><select id="${p}ResNorm" data-res-norm title="The refined patterns stacked in the Results">${NORM_OPTIONS}</select></div>`
      + `<div class="rvs-note">The patterns stacked in the Results, observed less the refined background: each divided by the largest of them (global), by its own maximum (local), or as they are (none).</div></div>`);
  return html;
}
// The peak widths' table (renderWidths), as the Scherrer card's: a row per peak (reflections
// at one 2θ are one), its phase's key in its colour (colorOf, by its id).
function widthsTableHtml(phs, wd, r, colorOf){
  // The free shape's column when some phase kept one; a phase without has none to give.
  const shapeOn = phs.some(ph=> ph.shaped);
  let html = '<div class="peak-scroll"><table><thead><tr><th>#</th><th>hkl</th><th>2θ (°)</th><th>Relative Intensity</th><th>FWHM (°)</th>'
    + `<th title="The sample's own FWHM: the peak fitted with the instrument's profile at that angle convolved in (Lorentzian widths adding, Gaussian ones in quadrature, as in the refinement), the sample's Gaussian part weighed in as far as the data ask for it. &lt; x: no broadening measured above the instrument's, x its upper limit (2 esd)">FWHM corr. (°)</th><th title="Scherrer: Kλ/(FWHM corr.·cosθ), K = 0.9 as the Scherrer card. For a Lorentzian phase it reads as the refined size does; a WPPM phase's sizes are true dimensions, and this reading of the same crystallites comes out lower for spheres of one size (about 0.85×) and otherwise as the distribution has it (the tests say by how much)">Crystallite size corr. (nm)</th>`
    + `<th title="The isotropic model's width for this peak, read off its own curve the same way">Model, isotropic (°)</th>${shapeOn ? '<th title="The free shape\'s width for this peak, read off its own curve the same way">Model, free shape (°)</th>' : ''}</tr></thead><tbody>`;
  let n = 0;
  phs.forEach(ph=> ph.rows.forEach(w=>{
    // Why it is overlapped (measureWidths): the others' share past 30 %, or what the
    // reflections of a phase whose isotropic model, which takes them off, does not predict
    // its widths read can do to this width at the misfit measured (biasOff, v429, in the
    // fit's own esds, HsEsdFit where the esd was widened; a result of v427–v428 has the 5 %
    // limit on their share instead).
    const bz = Number.isFinite(w.biasOff) ? w.biasOff/(w.HsEsdFit || w.Wesd) : NaN;   // (NaN is null in a saved session)
    const offTxt = 'reflections of a phase whose isotropic model, which takes them off, does not predict its widths read';
    const ovl = !Number.isFinite(w.share) ? ''
      : !(w.share <= 0.3) ? ` (the others hold ${Math.round(w.share*100)} % of its intensity across its top; 30 % allowed)`
      : 'biasOff' in w ? ` (${offTxt}: ${Number.isFinite(bz) ? `off as their widths were measured, they could move this width by ${bz.toFixed(1)} esd` : 'what they could do to this width was not computed'}; 2 esd allowed, the esd widened by as much past half of one)`
      : ` (${offTxt} hold ${Math.round(w.shareOff*100)} % of its intensity across its top; 5 % allowed)`;
    const skip = w.overlapped || w.edge || w.weak || w.flat || w.unread, why = [w.unread && 'not read: ' + w.unread, w.overlapped && 'overlapped by another reflection' + ovl, w.edge && 'at the end of the pattern', w.weak && 'too weak to measure (amplitude under 3 esd)', w.flat && 'no broadening above the instrument\'s (under 2 esd): the corrected FWHM is an upper limit (2 esd)'].filter(Boolean).join('; ');
    // Used with its esd widened (measureWidths: what those reflections could do to it).
    const wide = !skip && w.HsEsdFit > 0 ? `Its esds widened from the fit's ${+w.HsEsdFit.toPrecision(2)}° to ${+w.HsEsd.toPrecision(2)}°: ${offTxt}, off as their widths were measured, could move this width by ${bz.toFixed(1)} of the fit's esds` : '';
    // No broadening measured: the corrected FWHM as its upper limit.
    const corr = w.flat && Number.isFinite(w.HsMax) ? `&lt; ${+w.HsMax.toPrecision(2)}` : fmtEsd(w.Hs, w.HsEsd);
    html += `<tr class="peak-row rv-pk${skip ? ' rv-pk-out' : ''}" data-tt="${esc(w.tt)}" data-ph="${esc(ph.id)}" data-lab="${esc(w.label)}"${why ? ` title="Not used by the tests: ${esc(why)}"` : wide ? ` title="${esc(wide)}"` : ''}>`
      + `<td>${++n}</td><td><span class="rv-key-sm" style="background:${esc(colorOf(ph.id))}"></span>${hklHtml(hklShow(w.label))}</td><td>${w.tt.toFixed(3)}</td><td>${Number.isFinite(w.rel) ? (w.rel*100).toFixed(1) + '%' : '—'}</td>`
      + `<td>${fmtEsd(w.H, w.Hesd)}</td><td>${corr}</td><td>${w.flat ? '—' : fmtEsd(w.D, w.Desd)}</td><td>${f3(w.model.iso)}</td>${shapeOn ? `<td>${ph.shaped ? f3(w.model.shape) : '—'}</td>` : ''}</tr>`;
  }));
  html += '</tbody></table></div>';
  if (!wd.corrected) html += `<div class="rv-note">${r.irfRefused ? 'The standard\'s profile did not apply to this pattern (see the warnings)' : 'No instrumental standard refined'}: the widths are not corrected for the instrument's.</div>`;
  return html;
}
/* The tests on the widths, in their box beside the Williamson–Hall plot (as tall, its
   text scrolling in it): each one's numbers and what they say — Williamson–Hall's χ²_ν
   and the line's size and strain, the orders' ratios, the models' predictions. */
function testsHtml(phs){
  let html = '';
  phs.forEach(ph=>{
    const wh = ph.wh;
    if (phs.length > 1) html += `<div class="txt-mini rv-phase-name">${esc(ph.name)}</div>`;
    if (Number.isFinite(wh.chi2nu)){
      const aniso = wh.p < 1e-3;
      html += `<div class="pg-stat" title="χ² of the measured FWHM·cosθ (the corrected FWHM, not the integral breadth: D is read with K = 0.9 for the FWHM) about the weighted line, per degree of freedom (${esc(wh.nu)}), and the probability of so large a value were the broadening isotropic (size and strain alike in every direction)">Williamson–Hall: χ²<sub>ν</sub> <b>${wh.chi2nu.toFixed(1)}</b>, p <b>${fmtP(wh.p)}</b></div>`
        + `<div class="rv-note">${aniso ? 'The widths depend on hkl beyond their esds: the broadening is anisotropic (the crystallites\' shape, or faults).' : 'The widths lie on one line within their esds: consistent with an isotropic size and strain.'}</div>`
        + `<div class="pg-stat" title="The weighted line's intercept Kλ/D (K = 0.9) and slope ε; with an anisotropic broadening it is an average, not a size">line: D <b>${fmtEsd(wh.D, wh.Desd)} nm</b>, ε <b>${fmtEsd(wh.b, wh.bEsd)}</b>${aniso ? ' (an average only)' : ''}</div>`;
    } else {
      const nr = ph.rows.filter(w=> w.unread).length;
      html += `<div class="rv-note">Williamson–Hall: fewer than three peaks to read (${esc(wh.n)})${nr ? `; ${nr} not read at all (the table says why)` : ''}.</div>`;
    }
    if (ph.orders.length){
      html += `<div class="pg-stat rv-sub">Orders, Δd*(n)/Δd*(1): size 1, strain n</div>`;
      ph.orders.forEach(o=>{ html += `<div class="pg-stat">${hklHtml(hklShow(o.a))} → ${hklHtml(hklShow(o.b))}: <b>${fmtEsd(o.R, o.Resd)}</b> <span class="txt-meta">${o.verdict === 'order-dependent' ? 'below 1: the higher order sharper (planar faults)' : esc(o.verdict)}</span></div>`; });
    } else html += `<div class="rv-note">Orders: no pair (h k l), (n·h n·k n·l) both measured.</div>`;
    if (Number.isFinite(ph.scores.iso)) html += `<div class="pg-stat" title="Mean of ((measured − model)/esd)² over the peaks the tests use: about 1 when a model predicts the widths">Widths predicted, χ²<sub>ν</sub>: isotropic <b>${ph.scores.iso.toFixed(1)}</b>${Number.isFinite(ph.scores.shape) ? `, free shape <b>${ph.scores.shape.toFixed(1)}</b>` : ''}</div>`;
    // The stricter overlap rule (measureWidths): why fewer peaks are used. (ph.misfit: v429,
    // null in a saved result where it was NaN; a result of v427–v428 had the 5 % limit.)
    if (ph.overlapShare < 0.3) html += 'misfit' in ph
      ? `<div class="rv-note" title="Each of this phase's reflections is taken as off by its own misfit where its peak is read, else by the spread of the others' beyond their esds; what that does to a peak's width is read through the peak's own fit">The isotropic model does not predict the widths read${Number.isFinite(ph.misfit) ? ` (beyond their esds they differ from its own by ${Math.round(ph.misfit*100)} %, rms)` : ''}: as it takes this phase's reflections off the peaks they overlap, of any phase, a peak is used only where, off by as much, they could move its width by under 2 esd, its esd widened by as much past half of one (and the others hold up to 30 % of its top).</div>`
      : `<div class="rv-note">The isotropic model does not predict the widths read: as it takes this phase's reflections off the peaks they overlap, of any phase, a peak is used only where they hold under ${Math.round(ph.overlapShare*100)} % of its top (the others up to 30 %).</div>`;
    // A WPPM phase: the sizes here are Scherrer readings, the refined one a diameter.
    if (ph.reading) html += `<div class="rv-note" title="The single-peak sizes and the line's are Scherrer readings (K = 0.9 on the corrected FWHM); WPPM's is the crystallites' own ${ph.reading.lognormal ? 'volume-weighted mean diameter' : 'diameter'}, with no Scherrer constant. The refined model's own peaks, read the same way, show how far the two kinds of size differ for these crystallites: the gap is the reading's, not the sample's">WPPM: the sizes are Scherrer readings; read so, the model's own peaks give D <b>${fmtEsd(ph.reading.Dmodel)} nm</b> for its ${ph.reading.lognormal ? 'volume-weighted mean diameter' : 'diameter'} of <b>${fmtEsd(ph.reading.D)} nm</b>.</div>`;
  });
  return html;
}

export { esc, modelsLine, summaryOf, refinedOf, hklHtml, barIdx, optBars, formulaPretty,
  f3, fmtP, solidCaption, instrLine, group, warnNote, fitLineHtml, phaseRowsHtml, cellDetailsHtml, settingsBodyHtml, widthsTableHtml, testsHtml };
