/* =========================================================
   XRPD — the Rietveld card's words and markup that need no page (xrd-rv.js puts them in
   the card): the names from CIFs escaped, what a phase is refined with in a line, Miller
   indices with their bars, formulae, the instrument's line, the solids' captions, and the
   markup of the phases' list, the structure's details, the settings window's body, the
   peak widths' table and the tests on them, each from plain values; and (v559, out of
   createRietveld) the card's instructions, its frame, its section of the Results and its
   settings window, the legends, the size chart's chips, the solids' boxes and the results
   under the pattern.
========================================================= */
import { MODE, formulaOf, hklRuns, hklShow, engineOf, START_RULE, listOf, NO_TICK, NO_INSTR, instrNoteKind, cifNoteKind } from './xrd-rv-model.js';
import { boxHtml } from './alerts.js';
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
// axis: none for a phase not detected, left out with its texture unrefined — v568, to v567
// listed); the settings' line for a result of v428 or older, which has no models.
function refinedOf(q, r, std){
  const md = r.models && r.models[q.id];
  if (!md) return summaryOf(q, std);
  const out = Array.isArray(r.detected) && !r.detected.map(String).includes(String(q.id));
  const kept = !!(r.shapes && r.shapes[q.id]), t = !out && r.textures && r.textures[q.id];
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
  // (the facts alone: what was assumed, in its boxes under the line, instrNotesHtml; to v570
  // after "— ⚠ " in this grey line, v571)
  return parts.join(' · ');
}
/* What the instrument's line rests on (v571, ALERTS-REVIEW.md X05, X06, U6): under it, a
   compact warning box for the assumptions that may be wrong and an info one for those that
   hold in the normal case (xrd-rv-model.js instrNoteKind), a line each; with no description
   at all, what the model assumes (to v570 said only once refined, among the results). */
function instrNotesHtml(ins){
  if (!ins) return boxHtml('warn', esc(NO_INSTR));
  const ws = ins.warnings || [], of = k => ws.filter(w=> instrNoteKind(w) === k).map(w=> esc(w) + '.');
  return boxHtml('warn', of('warn')) + boxHtml('info', of('info'));
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
    // what reading the CIF found (its own cell, operations it lacked, B made equal on a site);
    // what to check, a warning (occupancies under the formula × Z, v571: to v570 a grey note)
    + P.notes.map(t=> `<div class="rv-ci-note">${esc(t.charAt(0).toUpperCase() + t.slice(1))}.</div>`).join('')
    + (P.cautions || []).map(t=> boxHtml('warn', `${esc(t.charAt(0).toUpperCase() + t.slice(1))}.`, 'rv-ci-warn')).join('');
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
    // (a choice, the shape's size line: a list under the depths)
    if (m.choice) return `<div class="rvs-row" data-fit-row="${m.k}"><span></span><label for="${id}">${m.label}</label>`
      + `<span class="rvs-cell"><select id="${id}" data-fit="${m.k}">${m.choice.map(([v, t])=> `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></span></div>`;
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
function widthsTableHtml(phs, wd, colorOf){
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
  // (not corrected for the instrument: said by the box's head, xrd-rv.js renderWidths, and why
  // by the results' warning, v571: to v570 here too)
  return html;
}
// What the widths' box says by its title when they are not corrected for the instrument
// (v571, ALERTS-REVIEW.md X10: the results' warning says why).
const widthsNote = wd => wd && !wd.corrected ? '(not corrected for the instrument)' : '';
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

/* ---- The card's own markup (xrd-rv.js puts it in the page): its instructions, its frame,
   its section of the Results and its settings window; the legends, the size chart's chips,
   the crystallites' shape's boxes, the results under the pattern. Up to v558 xrd-rv.js's,
   inside createRietveld. u: the page's helpers (xrd-rv.js HU: snav.js snavHtml, modcharts.js
   PLOT_DL_ICON and CSV_ICON). ---- */
// A legend, its keys as [colour, name] (the pattern's phases, the stacked patterns, the sizes).
const legendHtml = items => items.map(([color, name])=> `<span><i style="background:${esc(color)}"></i>${esc(name)}</span>`).join('');
// The pattern's legend (drawPattern): the observed, the fit's curves where there is one, a row
// of ticks a phase.
const patternLegendHtml = (fitted, groups) => `<span><i style="background:var(--plot-errbar)"></i>observed</span>`
  + (fitted ? `<span><i style="background:#ff5050"></i>calculated</span><span><i style="background:#ff9933"></i>background</span><span><i style="background:#3aa0ff"></i>difference</span>` : '')
  + legendHtml(groups.map(g=> [g.color, g.name]));
// The size chart's chips (drawSizes): by sample, by peak (none to show without peak widths).
const sizeChipsHtml = (sizeBy, anyW) => [['sample', 'by sample'], ['peak', 'by peak']].map(([k, t])=>
  `<button type="button" class="mode-chip plot-chip${sizeBy === k ? ' is-on' : ''}" data-size-by="${k}"`
  + `${k === 'peak' && !anyW ? ' disabled title="No peak widths: they are measured on a sample refined with its phases"' : ` title="Crystallite size ${t}"`}>${t}</button>`).join('');
// No solid kept (renderSolids): the box says so, in its place (the free shape is a setting; a
// solid searched and not kept, the results say why).
const solidsNoneHtml = r => `<div class="peak-box-head"><span class="txt-mini">Crystallite shape</span></div><div class="rv-empty">${r && r.params && Object.values(r.models || {}).some(m=> m && m.shape)
  ? 'No free shape kept: none was supported by the data (the warnings say why).' : 'Isotropic size: no free shape refined. <b>Settings…</b> sets one (Crystallite size, free shape).'}</div>`;
// A solid's box (renderSolids): its head, named when there are several, its PNG's button (icon:
// modcharts.js PLOT_DL_ICON), and the place of its 3D view.
const solidHeadHtml = (s, n, icon) => `<div class="peak-box-head"><span class="txt-mini">Crystallite shape${n > 1 ? ' · ' + esc(s.name) : ''}</span><button class="btn table-csv-btn" title="Download PNG">${icon}</button></div><div class="rv-solid-view"></div>`;
// The Williamson–Hall plot's legend (drawWH): each phase measured, the models' points drawn.
const whLegendHtml = (phs, colorOf, iso, shp) => phs.map(ph=> `<span><i style="background:${esc(colorOf(ph.id))}"></i>${esc(ph.name)}, measured</span>`).join('')
  + (iso ? `<span><i style="background:#9aa3ad"></i>isotropic model</span>` : '')
  + (shp ? `<span><i style="background:#ff5050"></i>free-shape model</span>` : '');
// The structure's box with no phase (renderCell).
const CELL_NONE = '<div class="rv-empty">No phase yet: a CIF added in Phases shows its structure here.</div>';
// The results' box with no pattern (renderResults).
const noPatternHtml = std => `<div class="rv-note rv-wide">${std ? 'No standard loaded: drop its file above.' : 'No pattern.'}</div>`;
/* A result's warnings that the results say in a box of their own, not among the others: no
   instrument description (said under the pattern, instrNotesHtml), what needed the standard's
   profile and was refined without it (the box of no instrumental profile, noIrfHtml). The
   engine's words (xrd-rietveld.js autoSetup). */
const NEED_IRF = /^(.+): need the standard's instrumental profile \(refine the standard first\), else the instrument's broadening and the sample's are one and the same; refined without\.$/;
const NEED_IRF_SHAPE = /^Free shape: needs the standard's instrumental profile \(refine the standard first\), else the shape's widths and the instrument's are one and the same; (.+) refined with an isotropic size\.$/;
const saidApart = w => w === NO_INSTR || NEED_IRF.test(w) || NEED_IRF_SHAPE.test(w);
/* A sample's result with no instrumental profile, said once (v571, ALERTS-REVIEW.md X10: to
   v570 in up to five places, grey and amber): a compact warning, what follows from it, what to
   do (the standard refined since: this pattern again; else the standard first), and what was
   refined without it. The standard's profile refused here (another λ: its warning says why):
   only what was refined without it. irf(): the standard's profile now. */
function noIrfHtml(r, irf){
  const ws = r.warnings || [];
  const without = ws.map(w=> (w.match(NEED_IRF) || [])[1]).filter(Boolean).map(t=> `Refined without, as they need it: ${barIdx(esc(t))}.`)
    .concat(ws.map(w=> (w.match(NEED_IRF_SHAPE) || [])[1]).filter(Boolean).map(t=> `The free shape needs it: ${esc(t)} refined with an isotropic size.`));
  if (r.irfRefused) return without.length ? boxHtml('warn', ['No instrumental profile: the standard\'s does not apply to this pattern (the warnings say why).', ...without], 'rv-wide') : '';
  return boxHtml('warn', [`No instrumental profile: the widths, and the sizes from them, include the instrument's. ${irf() ? 'Refine this pattern again.' : 'Refine the standard first: <b>Instrumental standard…</b>.'}`, ...without], 'rv-wide');
}
/* The phases' CIF warnings (v571, ALERTS-REVIEW.md X12: to v570 an amber line each): for each
   phase, a compact box of each kind (xrd-rv-model.js cifNoteKind), error, warning, info, a line
   each, named by the phase. */
const cifBoxesHtml = shown => shown.map(q=> ['bad', 'warn', 'info'].map(k=> boxHtml(k, q.prep.warnings.filter(w=> cifNoteKind(w) === k).map(w=> `${esc(q.prep.name)}: ${esc(w)}`), 'rv-wide')).join('')).join('');
/* The results across the card under the pattern (renderResults): the statistics, then each
   group the worker made of the result (the specimen or the instrument, each phase's values);
   under them all, the notes and every warning: the curve that cannot be drawn (lost), no
   instrumental profile, the refinement's (a cell search without a minimum, a phase not
   detected, a parameter on a bound), the CIFs' (their composition against the formula) and
   the standard's. Not refined yet, what Refine will do. r: the pattern's result; shown: its
   phases; n: the phases refined on it now, any: the card's; irf(): the standard's profile now,
   stale(): the result's not the one now (each asked only where the words need it, as up to
   v558); lost: its curve could not be drawn (its phases changed since). */
function resultsHtml({ r, std, shown, n, any, irf, stale, lost }){
  const cifWarn = cifBoxesHtml(shown);
  if (!r || !r.params) return (n ? `<div class="rv-note rv-wide">Not refined yet. <b>Refine</b> starts from the CIF's cell${std ? ' (the certified one, held fixed)' : ''}, finds where the pattern's peaks are, and refines step by step.</div>`
    : `<div class="rv-note rv-wide">${any ? NO_TICK : 'No phase: add one from a CIF, dropped on Phases beside the pattern or selected with a click there.'}</div>`) + cifWarn;
  // (a number missing — a NaN or ∞ come back from JSON as null, a project's result without
  // its statistics — a dash, as the CSV leaves its cell empty: v568; to v567 null threw)
  const s = r.stats || {}, f2 = v => Number.isFinite(v) ? v.toFixed(2) : '—', pct = v => Number.isFinite(v) ? (v*100).toFixed(2) + '%' : '—';
  let html = group('Fit', `<div class="pg-stat" title="R_wp: the weighted residual; R_exp: what the counting statistics alone would give">R<sub>wp</sub>: <b>${pct(s.Rwp)}</b></div>`
    + `<div class="pg-stat">R<sub>exp</sub>: <b>${pct(s.Rexp)}</b></div>`
    + `<div class="pg-stat" title="χ² = Σw(y − y_c)²/(N − P), the reduced χ²: (R_wp/R_exp)²">χ²: <b>${f2(s.chi2)}</b></div>`);
  (r.phaseResults || []).forEach(q=>{
    html += group(esc(q.name), q.lines.map(l=> `<div class="pg-stat"${l.title ? ` title="${esc(l.title)}"` : ''}>${barIdx(esc(l.label))}: <b>${barIdx(esc(l.value))}</b></div>`).join(''), q.phase);
  });
  // (its curve gone in silence to v570, v571: X14)
  if (lost) html += boxHtml('warn', 'This result\'s curve cannot be drawn: its phases changed since. Refine it again.', 'rv-wide');
  if (std) html += `<div class="rv-note rv-wide">The samples take this profile, its axial divergence, zero and sin 2θ shift as their instrument's.</div>`;
  else if (!r.irf) html += noIrfHtml(r, irf);
  html += (r.warnings || []).filter(w=> !saidApart(w) || (std && w !== NO_INSTR)).map(w=> warnNote(barIdx(esc(w)))).join('') + cifWarn;
  if (!std && r.irf && stale()) html += warnNote(`${irf() ? 'The standard has been refined again since this result' : 'The standard\'s refinement this result used is gone (cleared, or another standard loaded)'}: its profile, zero and asymmetry are not the ones these numbers rest on. Refine this pattern again, or <b>Refine all</b>.`);
  return html;
}

// The card's instructions (cards.js shows them under its title), the standard's window's.
const RV_INFO = `Whole-pattern Rietveld refinement. Each phase comes from a CIF, dropped on <b>Phases</b> beside the pattern or selected with a click there (its drop zone while there is no phase, then <b>+ CIF</b> at the list's foot; several at once), the list giving each its formula and space group: its cell, its atoms and the symmetry the structure has. A file in P1, as Materials Project gives them, has its symmetry found from the atoms, so that a cubic cell is refined by <i>a</i> alone (a primitive cell of a centred lattice through its conventional cell, whose <i>a</i> and <i>V</i> are the ones reported), and its space group read off those operations; a file with its own operations is checked against its formula and Z (an origin-choice mix-up shows there). A phase's tick in the list says whether it is refined on the pattern on show: every pattern has them all at first, and each its own. The download button left of a phase's × (which removes it) saves its CIF under the file's name: its text as read, in UTF-8 whatever the file's encoding; it changes nothing, and works while a refinement runs, when the × and the tick are disabled until it ends (the run refines the phases it started with). A click on a phase shows its unit cell beside the list, in 3D (drag it to turn it, a double click puts it back), with its details under it; with no phase that box is empty. The instrumental standard (<b>Instrumental standard…</b>) is a file of its own, refined in its own window against the built-in LaB₆ (NIST SRM 660c, <i>a</i> = 4.156826 Å, held fixed) or a CIF of the standard's: its zero and its peak shape — the Thompson–Cox–Hastings pseudo-Voigt, Gaussian width² = U·tan²θ + V·tanθ + W and Lorentzian width = X·tanθ + Y/cosθ, made asymmetric by the axial divergence (through the Soller slits the file gives, Cheary–Coelho's full axial model, with the sample's and receiver's axial length L refined; without Sollers, Finger–Cox–Jephcoat's one parameter (S+H)/L: the tail of the low-angle peaks towards lower angles) — and a shift of 2θ as sin 2θ, the form of the sample's transparency, beside the zero and the displacement, become the instrument's, and each sample refines only its own broadening on top of them: a Lorentzian Y<sub>s</sub>/cosθ, which gives the crystallite size (D = Kλ/Y<sub>s</sub>, Y<sub>s</sub> in radians, K = 0.9 as in the Scherrer analysis), and X<sub>s</sub>·tanθ = 4ε·tanθ, the microstrain. The pattern is computed from Kα₁ and Kα₂ at the file's wavelengths and ratio, the Bragg–Brentano Lorentz–polarisation factor (with a monochromator only when the file has one), |F|² from the atoms (Waasmaier–Kirfel form factors with Chantler's anomalous terms), a Chebyshev background and a specimen displacement per sample; each point weighs by its counts (1/σ², σ² the counts times the attenuation). <b>Refine</b> starts from the CIF's cell, finds where the pattern's peaks are by scaling that cell, then frees the parameters stage by stage; <b>Refine all</b> does every pattern. With no refined standard they ask first, in a window over the page: refine the standard first (as its window's <b>Settings…</b> are) and then the samples, refine without it, or neither; with none loaded, load one. While the standard refines no sample does, and the other way round, so that a batch takes one instrumental profile throughout; its run shows on every card's <b>Instrumental standard…</b> (a spinner, and its progress along the button's foot), its window closed or open. <b>Settings…</b> (read only while a refinement runs) decides what Refine refines: for each phase each of the models below switched on or off and, when on, how deep (the size and the microstrain can be off too). It also sets where Refine starts: from the CIF, as above, or from each pattern's last result, with the groups of parameters ticked held at its values (whatever is new or changed since is refined) — a shape fitted, say, then held while B per site is refined. Its <b>Refinement</b> section sets, for every pattern, the least squares and the searches: the iterations allowed, the shift tolerance and the starting damping, the background's Chebyshev degree and its 1/2θ term (automatic: on when the scan starts below 20°), the cell search's range, how many of the free shape's trial starts are refined fully, how many more sets of them it runs, each tilted in another fixed direction (about one more search each), and the free shape's size line (below), each result saying which it was refined with when they are not the defaults. Its <b>Results</b> section sets how the patterns stacked in the card's section of the Results are normalised: to the largest (global), each to its own maximum (local), or as they are (none). <b>Clear</b> removes this pattern's result, <b>Clear all</b> every pattern's. With several phases each gets its weight fraction (Hill–Howard, of the crystalline part). A phase is reported <i>not detected</i>, and left out of the refinement, when its scale is not above 3 esd, or when it is significant only through intensity under another phase's peaks with no part of the pattern its own (a candidate impurity whose lines fall on the main phase's would otherwise take up whatever misfit those peaks leave). The same CIF added twice gives two size populations of one phase. <b>Size profile</b> (with a refined standard): <i>Lorentzian</i>, a Lorentzian of the right breadth read with Scherrer's K (a free shape, below, too, unless the Refinement settings ask for its exact line); or <i>WPPM</i> (Whole Powder Pattern Modelling, Scardi &amp; Leoni), each line synthesised as the Fourier transform of the product of the instrument's, the size's, the strain's and the faults' coefficients — the size's being the crystallites' own common-volume function (a sphere's, or a free solid's along each member of the family), so the dimensions are the true ones and the profile's shape counts too. With <i>log-normal sizes</i> the coefficients are averaged over a distribution of width σ (of ln D): the size read is the volume-weighted mean (what the breadth measures), with the median and the number-weighted mean beside. <b>Microstrain</b>: isotropic, or <i>anisotropic</i> (Stephens: ε² a quartic form of the reflection's direction that the Laue group leaves unchanged; given as its rms and along the low-index planes' normals). <b>Planar faults</b> (after Warren): faults on a family of planes, each displacing the crystal by a vector of a family (those in the plane), the probability per plane refined: reflections whose h·R is not an integer broaden, by parity rather than by order. <b>Displacement parameters</b>: the CIF's held (0.5 Å² where it has none); one ΔB added to all of a phase's B; one B per crystallographic site (the sites from the symmetry found); or the anisotropic U<sup>ij</sup> per site, only those the site's symmetry leaves free, with B<sub>eq</sub>. Each is strongly correlated with the scale, and so with the weight fractions, with the background and, on broad peaks, with the widths: they want data to high angle. <b>Site occupancy</b>: the occupancy of one of the phase's sites refined — how strongly the site scatters against its species at full occupancy, alike at every angle (a B lowers it more the higher the angle): under 1, atoms missing (vacancies, a depleted surface) or a lighter species beside them; over 1, a heavier one. The weight fractions use the cell's mass at the refined occupancy. Every site at once would be the scale again, so a phase of one site has none to refine; the standard's structure is certified. <b>Preferred orientation</b>: March–Dollase, each reflection's members weighed by (r²·cos²α + sin²α/r)<sup>−3/2</sup>, α their angle to the normal of the chosen planes (hkl) — r under 1 when such planes lie preferentially parallel to the sample's surface (plates), over 1 when they do not (needles); <i>best axis</i> tries the low-index planes and keeps the lowest χ². For a cubic phase r has no first-order effect at 1, so it is refined from 0.8 and from 1.25 and the better kept. It changes the intensities, not the widths: an intensity misfit left in is otherwise taken up by a free shape, which widens or narrows peaks to fit it (on a SrTiO<sub>3</sub> whose Sr site scatters 0.7 of a full one, with that site held full the plates came out ⟂ ⟨310⟩; with its occupancy refined, ⟂ ⟨110⟩, as the crystals are). <b>Crystallite shape</b> (with a refined standard): the isotropic size, or a free solid — an <i>ellipsoid</i> of any proportions, a <i>spheroid</i> (two axes equal), a <i>cylinder</i>, an <i>elliptic cylinder</i> (an ellipse translated along its axis), a <i>box</i> or a <i>square-based box</i> (two edges equal: a square plate or rod) —, in any orientation. A shape that breaks the crystal's symmetry (a disc normal to one ⟨110⟩ of a cubic phase) gives the reflections of one family different widths, so each is drawn with its own and the peak is their sum; its width follows the solid's volume-weighted column length along it (Stokes &amp; Wilson), in closed form for each solid (the faces rounded off over 1° of direction during the search only: the result is the exact solid's). The fit starts from several shapes (the sphere, plates and needles along the low-index directions and along the normals of the lines the isotropic fit leaves most and least broadened, each tilted 6° in a fixed direction, and in as many more as the Refinement settings ask: no random number, so the same data give the same result), refines every minimum it falls into to the same level, and keeps the lowest if its gain in χ² over the isotropic size (χ² divided by the isotropic fit's χ²<sub>ν</sub>, so that a misfit is not taken for evidence) is over what noise gives a sphere in the phase's Laue class (13 to 25), with ΔBIC under −10 as well where the fit misses some lines (checked line by line); else the isotropic size stays. Each solid is also refined with its axes held exactly on their nearest lattice directions — its faces lattice planes —, and kept so when that gives the lower ΔBIC and the free orientation is not better by more than its χ² allows (95 %); the free fit's angle from them is given beside. The ΔBIC of each solid against the same isotropic fit also compares the solids: between two of as many parameters, a difference under 14 is within what noise gives (35 where the fit misses some lines: the bootstrap of the free-shape research's family comparison); and the sizes depend on the solid chosen. The result gives the solid's dimensions with their esds — true ones (diameter, height, edges, full axes), the solid's own, when it is drawn by its exact line (WPPM, each member's line the transform of the solid's own; the Refinement setting <i>Shape size line</i>, or the WPPM size profile); by default, under the Lorentzian profile, each member's line is a Lorentzian of its width, Scherrer's reading, which reads the extents 13–25 % long and pulls the solid toward equant (the search's thresholds were tuned on the exact line, the more accurate one) —, each axis with the simplest lattice direction within 10°, its angle from it and its angular esd (the turn of the solid that raises χ² by χ²<sub>ν</sub>, its sizes and its turns about the other axes refined again: it measures the valley of χ² the fit ends in, and of 7 free fits of synthetic boxes 2 ended 3–4 esd off, in another valley nearly as deep); two dimensions not told apart within 2 esd have no direction of their own, nor has an axis whose angular esd is over 30°. The sizes across a thin solid's faces assume ideally flat faces: a 2° spread of their orientation would shorten them by 10–30 %. The solid is drawn beside the tests with the crystal's directions on it and their uncertainty as cones (an axis the data do not fix dashed, <i>not determined</i>), and the cell's <i>a</i>, <i>b</i>, <i>c</i> in a corner for reference: drag it to turn it. Under the pattern: the difference, and a row of ticks per phase at its reflections; under them, the refinement's results across the card, by its title what it was refined with (each phase's models, the Refinement settings not the defaults), at its foot every warning. <b>Peak widths</b> (the table at the card's foot: a click keeps a peak marked on the pattern and on the Williamson–Hall plot): each reflection of a sample fitted alone (the pattern less the isotropic refinement's background and every other reflection, with a straight line for what is left, Kα₁ and Kα₂ and the instrument's asymmetry) by its own Lorentzian and Gaussian widths, to which the instrument's at that angle are added as the refinement adds them: their FWHM is the sample's alone, and the size from it is as in the Scherrer analysis. Three tests read them with no model of the shape, in their box beside the Williamson–Hall plot: <i>Williamson–Hall</i>, β·cosθ against 4·sinθ, where an isotropic size and strain put the points on one line (χ²<sub>ν</sub> about it and its probability); <i>orders</i>, Δd* = β·cosθ/λ of (h k l) and (n·h n·k n·l), equal for a size, in the ratio n for a strain, below 1 for faults that broaden by parity; and <i>prediction</i>, the same measurement on each model's own curve, which a model of the shape should match. Overlapped, weak or end-of-pattern peaks, and those no broader than the instrument within 2 esd, are listed but not used. R<sub>wp</sub>, R<sub>exp</sub> and χ² judge the fit; the values in brackets are the standard errors in the last digits, which the serially correlated residuals of a powder pattern make smaller than the real uncertainty. A refinement that stopped before converging, parameters on a bound (to be read as limits) and parameters the data do not determine are said under the results. How it all works in detail: RIETVELD.md in the repository.`;
const RV_STD_INFO = `The instrumental standard's own Rietveld refinement: one file (a file dropped replaces the one there), refined against the phase chosen in the list (the round button) — the built-in LaB₆ (NIST SRM 660c), or a CIF of the standard's, dropped on <b>Phases</b> or selected with <b>+ CIF</b> at the list's foot. Each phase's download button, left of its ×, saves its CIF: the built-in LaB₆'s as the app holds it (LaB6_NIST-SRM-660c.cif, written in P1), a CIF's as read (in UTF-8). Its zero, its peak shape (U, V, W, X, Y and the axial divergence) and its sin 2θ shift become the instrument's, which every sample's refinement then takes: refine it before the samples (a sample's Refine offers to), and refine them again after refining it again. It cannot be refined while a sample refines, nor the samples while it does. Its cell is held at the CIF's (a certified standard's), and its own widths are the instrument's: no size, strain, faults or free shape of its own, nor an occupancy refined. Its <b>Settings…</b>, its own, hold only what applies to it: its displacement parameters (one ΔB by default) and its texture; where its refinement starts, with the groups it can hold (the scales and background, its zero and displacement, the profile, B, the texture); and the Refinement settings, the zero scan's range among them. Closed while it refines, this window leaves the run going: every Rietveld card's <b>Instrumental standard…</b> shows it, with its progress, until it ends.`;

/* The card's section of the Results: the refined patterns stacked, and the crystallite
   sizes (by sample or by peak, the chips in the plot's corner), as the Scherrer card's. */
function resHtml(p, u){
  return `
        <h4 class="res-an-title"></h4>
        <p class="txt-meta" id="${p}ResNone">No pattern refined yet: <b>Refine</b> in the card above.</p>
        <div class="row res-row" style="gap:16px">
          <div class="col mw320" style="flex:1">
            <p class="txt-caption">Refinement: observed less the background</p>
            <div class="plot-wrap">
              <svg class="plot" id="${p}ResSvg"></svg>
              <button class="btn plot-dl-btn" data-dl-svg="${p}ResSvg" data-csv-mod="xrd" data-csv-base="rietveld_pattern.csv" data-csv-names="rietveld_pattern.csv" data-dl-base="XRPD_results_rietveld.svg" data-dl-name="XRPD_results_rietveld.svg" data-dl-legend="${p}ResLegend">${u.PLOT_DL_ICON}</button>
            </div>
            <div id="${p}ResLegend" class="legend"></div>
          </div>
          <div class="col mw320" style="flex:1">
            <p class="txt-caption">Crystallite size</p>
            <div class="plot-wrap">
              <svg class="plot" id="${p}SizeSvg"></svg>
              <span class="plot-chips" id="${p}SizeBy"></span>
              <button class="btn plot-dl-btn" data-size-dl data-dl-svg="${p}SizeSvg" data-csv-mod="xrd" data-csv-names="rietveld_results.csv,rietveld_peaks.csv" data-dl-name="XRPD_rietveld_size.svg" data-dl-legend="${p}SizeLegend">${u.PLOT_DL_ICON}</button>
            </div>
            <div id="${p}SizeLegend" class="legend"></div>
            <div id="${p}SizeNote" class="txt-meta"></div>
          </div>
        </div>`;
}

/* The card's markup (and the standard's window's: the same, with one pattern and one
   phase chosen): the pattern with the phases and the structure beside it, the buttons
   under them ending with the plot; the results across under it; then the Williamson–Hall
   plot, the tests on the widths and the crystallites' shape in one row; the peak widths'
   table at the foot. */
function cardHtml(p, std, u){
  return `
        <div class="pside">
          <div class="plot-nav-row pside-nav">
            <div class="plot-nav-left">${std ? '' : `
              ${u.snavHtml({ prev: p + 'Prev', idx: p + 'Idx', next: p + 'Next', name: p + 'Label', prevCls: 'an-prev', nextCls: 'an-next' })}`}
            </div>
          </div>
          <div class="pside-plot">
            <div class="plot-wrap">
              <svg class="plot" id="${p}Svg"></svg>
              <button class="btn plot-dl-btn" data-dl-svg="${p}Svg" data-csv-mod="xrd" data-csv-base="rietveld_pattern.csv" data-csv-names="rietveld_pattern.csv" data-dl-base="XRPD_rietveld.svg" data-dl-name="XRPD_rietveld.svg" data-dl-legend="${p}Legend">${u.PLOT_DL_ICON}</button>
            </div>
          </div>
          <div class="pside-under">
            <div id="${p}Legend" class="legend"></div>
            <p class="txt-meta" id="${p}Instr"></p>
            <div class="rv-instr-notes" id="${p}InstrNotes"></div>
          </div>
          <div class="pside-col rv-side">
            <div class="rv-boxes">
              <div class="peak-box rv-cifs" id="${p}Cifs">
                <div class="peak-box-head">
                  <span class="txt-mini">Phases</span>
                  <input type="file" id="${p}CifInput" accept=".cif,.CIF" multiple style="display:none">
                </div>
                <div class="rv-ciflist" id="${p}PhaseList"></div>
                <div class="dropzone rv-cifdz" id="${p}CifDz" role="button" tabindex="0" hidden>
                  <div class="dz-icon" aria-hidden="true">⤒</div>
                  <div class="dz-title">Drag here CIF files, or click to select them.</div>
                  <div class="txt-meta">.cif</div>
                </div>
                <div class="dropzone rv-cifdz rv-cifdz-mini" id="${p}AddCif" role="button" tabindex="0" aria-label="+ CIF: add phases from CIF files" title="Add phases from CIF files: a click selects them, or drop them anywhere on Phases"><span class="rv-cifdz-plus" aria-hidden="true">+</span> CIF: drop or click</div>
              </div>
              <div class="peak-box rv-cellbox">
                <div class="peak-box-head"><span class="txt-mini">Structure</span><span class="rv-cell-name" id="${p}CellName"></span></div>
                <div class="rv-cell" id="${p}Cell"></div>
                <div class="rv-cell-info" id="${p}CellInfo"></div>
              </div>
            </div>
            <div id="${p}Status" class="txt-meta rv-status"></div>
            <div id="${p}ProgWrap" class="rv-prog" style="display:none"><div id="${p}ProgBar"></div></div>
${std ? `
            <div class="rv-btns">
              <button class="btn primary" id="${p}Refine">Refine</button>
              <button class="btn" id="${p}Settings" aria-haspopup="dialog" title="What Refine refines, on the standard's phase, and where it starts">Settings…</button>
              <button class="btn" id="${p}Clear" title="The standard's result">Clear</button>
            </div>` : `
            <div class="rv-btns">
              <button class="btn primary" id="${p}Refine">Refine</button>
              <button class="btn primary" id="${p}RefineAll">Refine all</button>
            </div>
            <div class="rv-btns">
              <button class="btn" id="${p}Settings" aria-haspopup="dialog" title="What Refine refines, for each phase, and where it starts">Settings…</button>
              <button class="btn" id="${p}Std" aria-haspopup="dialog" title="The instrumental standard: its file, its phase and its refinement, whose profile every sample takes">Instrumental standard…</button>
            </div>
            <div class="rv-btns">
              <button class="btn" id="${p}Clear" title="This pattern's result">Clear</button>
              <button class="btn" id="${p}ClearAll" title="Every pattern's result">Clear all</button>
            </div>`}
          </div>
        </div>
        <div class="peak-box rv-fit">
          <div class="peak-box-head rv-fit-head"><span class="txt-mini">Refinement</span><span class="rv-fit-set" id="${p}FitSet"></span></div>
          <div class="rv-fit-grid" id="${p}Results"></div>
        </div>
        <!-- The peaks' own widths, each reflection fitted alone: the Williamson-Hall plot, the
             tests on them and the crystallites' shape in a row, as tall as the plot; their
             table at the card's foot -->
        <div id="${p}Widths" class="rv-widths" style="display:none">
          <div class="rv-wrow">
            <p class="txt-caption">Williamson–Hall</p>
            <div class="plot-wrap">
              <svg class="plot" id="${p}WhSvg"></svg>
              <button class="btn plot-dl-btn" data-dl-svg="${p}WhSvg" data-csv-mod="xrd" data-csv-base="rietveld_peaks.csv" data-csv-names="rietveld_peaks.csv" data-dl-base="XRPD_williamson_hall.svg" data-dl-name="XRPD_williamson_hall.svg" data-dl-legend="${p}WhLegend">${u.PLOT_DL_ICON}</button>
            </div>
            <div id="${p}WhLegend" class="legend"></div>
            <div class="peak-box rv-tests">
              <div class="peak-box-head"><span class="txt-mini">Tests on the widths</span></div>
              <div class="rv-tests-body" id="${p}Tests"></div>
            </div>
            <div class="peak-box rv-solids" id="${p}Solids"></div>
          </div>
          <div class="peak-box rv-wtable">
            <div class="peak-box-head">
              <span class="txt-mini">Peak widths</span><span class="txt-meta rv-wnote" id="${p}WNote"></span>
              <button class="btn table-csv-btn" data-csv-mod="xrd" data-csv-base="rietveld_peaks.csv" data-csv-names="rietveld_peaks.csv" title="Download CSV">${u.CSV_ICON}</button>
            </div>
            <div id="${p}PkWrap"></div>
          </div>
        </div>`;
}

// The settings window (settingsBodyHtml its body), the card's own, in the instance's layer.
const settingsModalHtml = (p, std) => `<div class="modal-box rvs-box" role="dialog" aria-modal="true" aria-labelledby="${p}SetTitle" tabindex="-1">
      <h3 class="txt-head" id="${p}SetTitle" style="margin:0 0 4px">Fitting settings${std ? ': instrumental standard' : ''}</h3>
      <p class="txt-meta" style="margin:0 0 6px">What <b>Refine</b> refines, on each phase${std ? ' of the standard' : ''}. A change applies to the next refinement.</p>
      <p class="rvs-busy" hidden>Refining: these are the settings it runs with, to be changed when it ends.</p>
      <div class="rvs-body"></div>
      <button class="btn primary" type="button" data-done style="width:100%;margin-top:16px">Done</button>
    </div>`;

export { esc, modelsLine, summaryOf, refinedOf, hklHtml, barIdx, optBars, formulaPretty,
  f3, fmtP, solidCaption, instrLine, instrNotesHtml, widthsNote, group, warnNote, fitLineHtml, phaseRowsHtml, cellDetailsHtml, settingsBodyHtml, widthsTableHtml, testsHtml,
  RV_INFO, RV_STD_INFO, legendHtml, patternLegendHtml, sizeChipsHtml, solidsNoneHtml, solidHeadHtml, whLegendHtml, CELL_NONE, noPatternHtml, resultsHtml,
  resHtml, cardHtml, settingsModalHtml };
