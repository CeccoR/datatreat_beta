/* =========================================================
   XRPD — the Rietveld card (page side).
   The phases come from CIFs (the standard's LaB6 is built in); the refinement runs in
   a module worker (xrd-rietveld.worker.js) on xrd-rietveld.js, and its result is kept
   per pattern, by file name, so moving, leaving out or reloading files never puts it
   on another pattern. The curves are not kept: they are recomputed from the refined
   parameters, which takes milliseconds.
========================================================= */
import { fmtNum, csvLine, X_SVG } from './utils.js';
import { Plot } from './plot.js';
import { parseCif, expandAtoms, findSymmetry, checkComposition, cellMass, metric, reflections } from './xrd-cryst.js';
import { readXrdmlInstrumentText } from './xrd-instr.js';
import { buildModel, calc } from './xrd-rietveld.js';
import { shapeView } from './xrd-shape3d.js';

// Names, formulae and notes come from CIF files, which may be anyone's: they go into the
// page as text, never as markup.
const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The instrumental standard: NIST SRM 660c LaB6, Pm-3m, a = 4.156826 Å at 22.5 °C
// (certificate). B on 6f (x, ½, ½), x = 0.1992 (Eliseev et al., Acta Cryst. C42 (1986)
// 1263); the displacement parameters are typical values: the standard's refinement
// gives the instrument's profile and zero, not its intensities.
const LAB6_CIF = `data_LaB6_SRM660c
_cell_length_a 4.156826
_cell_length_b 4.156826
_cell_length_c 4.156826
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
_chemical_formula_sum 'La1 B6'
_cell_formula_units_Z 1
loop_
_symmetry_equiv_pos_as_xyz
'x, y, z'
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_B_iso_or_equiv
La1 La 0 0 0 0.25
B1 B 0.1992 0.5 0.5 0.35
B2 B -0.1992 0.5 0.5 0.35
B3 B 0.5 0.1992 0.5 0.35
B4 B 0.5 -0.1992 0.5 0.35
B5 B 0.5 0.5 0.1992 0.35
B6 B 0.5 0.5 -0.1992 0.35
`;
const PHASE_COLORS = ['#d4a72c', '#c77dff', '#ff8a65', '#7cc4ff', '#e05f8a', '#9ccc65'];
const SYSTEM_NAMES = { cubic:'cubic', hexagonal:'hexagonal', trigonal:'trigonal', tetragonal:'tetragonal', orthorhombic:'orthorhombic', monoclinic:'monoclinic', triclinic:'triclinic' };

/* A phase from a CIF: the atoms of the whole cell, and the symmetry the structure has.
   A file in P1 (as Materials Project gives them) lists every atom with no symmetry, so
   the symmetry is found from the atoms (findSymmetry): it decides how the cell is
   refined — a cubic cell by a alone, not by six free lengths and angles. A file with
   its own operations is expanded with them, and checked against its formula and Z,
   which catches the commonest mistake, coordinates of one origin choice with the
   operations of the other. */
function prepPhase(text, fileName){
  const cif = parseCif(text);
  if (!cif || !cif.cell || !cif.sites || !cif.sites.length) throw new Error('No cell or no atom sites in this CIF.');
  const own = cif.ops && cif.ops.length > 1;
  const atoms = expandAtoms(own ? cif.ops : [], cif.sites);
  const sym = findSymmetry(cif.cell, atoms);
  const comp = checkComposition(atoms, cif.formulaSum, cif.Z);
  const notes = [], warnings = [...(cif.warnings || [])];
  if (!own) notes.push(`symmetry found from the atoms: ${sym.order} operations`);
  else if (sym.order !== cif.ops.length) notes.push(`${cif.ops.length} operations in the file; the structure has ${sym.order}`);
  if (comp && !comp.ok && comp.message) warnings.push(comp.message);
  return {
    name: cif.name || (fileName || '').replace(/\.cif$/i, ''), file: fileName || '', formula: cif.formulaSum || '',
    cell: cif.cell, ops: sym.ops, atoms, system: sym.system, constraint: sym.constraint, order: sym.order,
    mass: cellMass(atoms), notes, warnings,
  };
}

export function createRietveld(host){
  const $ = id => document.getElementById(id);
  let phases = [];           // [{ id, cif (text), file, color, prep }]
  let nextId = 1;
  let idx = 0;               // the pattern on show, among the included files
  let results = {};          // file name → { params, esd, stats, stages, at }
  let busy = false, cancelled = false;
  let refineB = false;       // also refine one ΔB per phase (an option, off by default)
  let plot = null;
  // Its own colour, apart from the CIF phases' (which start from the first of theirs).
  const lab6 = { id: 0, cif: LAB6_CIF, file: '', color: '#4cc9a0', prep: prepPhase(LAB6_CIF, 'LaB6 (NIST SRM 660c)') };
  lab6.prep.name = 'LaB₆ (NIST SRM 660c)';
  lab6.prep.notes = [];      // written in P1 here only to be short: nothing to report

  // ---- the instrument, read from the file's own header (kept on the file object) ----
  function instrOf(f){
    if (f.instr) return f.instr;
    try {
      const text = f.rawBytes ? new TextDecoder().decode(f.rawBytes) : '';
      f.instr = text ? readXrdmlInstrumentText(text) : null;
    } catch(e){ f.instr = null; }
    return f.instr;
  }
  const isStd = f => !!f && f.name === host.standardName();
  const phasesFor = f => isStd(f) ? [lab6] : phases;

  // ---- the worker ----
  let worker = null, jobId = 0, cancelJob = null;
  function getWorker(){
    if (worker) return worker;
    worker = new Worker(new URL('./xrd-rietveld.worker.js', import.meta.url), { type: 'module' });
    return worker;
  }
  function runInWorker(payload, onProgress){
    const w = getWorker(), id = ++jobId;
    return new Promise((resolve, reject)=>{
      const done = ()=>{ w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); cancelJob = null; };
      const onMsg = e =>{
        const d = e.data; if (!d || d.id !== id) return;
        if (d.type === 'progress'){ if (onProgress) onProgress(d.frac, d.stage); return; }
        done();
        if (d.type === 'result') resolve(d.res); else reject(new Error(d.message || 'Refinement failed'));
      };
      const onErr = e =>{ done(); worker = null; reject(new Error(e.message || 'The refinement worker failed')); };
      cancelJob = ()=>{ done(); try { w.terminate(); } catch(e){} worker = null; resolve(null); };
      w.addEventListener('message', onMsg);
      w.addEventListener('error', onErr);
      w.postMessage({ id, ...payload });
    });
  }

  // What a pattern's refinement starts from: the standard gives the samples its
  // instrumental profile and zero once it is refined.
  function irf(){
    const std = host.files().find(isStd), r = std && results[std.name];
    // asym: absent from a standard refined before the asymmetry was modelled (none then).
    return r && r.params ? { U: r.params.U, V: r.params.V, W: r.params.W, X: r.params.X, Y: r.params.Y, asym: r.params.asym || 0, zero: r.params.zero } : null;
  }
  const phaseData = list => list.map(p=> ({ id: p.id, name: p.prep.name, cell: p.prep.cell, constraint: p.prep.constraint, ops: p.prep.ops, atoms: p.prep.atoms, mass: p.prep.mass, color: p.color, shape: p.shape || false }));
  // The crystallite shapes a phase can refine (xrd-rietveld SHAPE_TYPES): none (the
  // isotropic size) or a free solid. A project saved with the one free shape there was
  // (true) has the ellipsoid.
  const SHAPES = [['', 'isotropic size'], ['ellipsoid', 'ellipsoid'], ['spheroid', 'spheroid (two axes equal)'], ['cylinder', 'cylinder'], ['ellcyl', 'elliptic cylinder'], ['box', 'box']];
  const shapeOpt = v => v === true ? 'ellipsoid' : SHAPES.some(([k])=> k && k === v) ? v : false;
  // The solid a result was refined with, from its parameters' names (each solid has its
  // own), and only when they are in use (any width ≠ 0).
  function shapeOfParams(P, id){
    const g = n => P['p' + id + '.' + n], has = n => ('p' + id + '.' + n) in P;
    // v420's ellipsoid (S = L·Lᵀ) is 'ellipsoidL'; the bodies by their widths' names.
    if (['L11', 'L22', 'L33'].some(n=> g(n))) return 'ellipsoidL';
    const type = has('Ea') ? 'ellipsoid' : has('Wd') ? 'cylinder' : has('Wh') ? 'ellcyl' : has('Wb') ? 'box' : has('Wc') ? 'spheroid' : null;
    return type && ['Ea', 'Eb', 'Ec', 'Wa', 'Wb', 'Wc', 'Wd', 'Wh'].some(n=> g(n)) ? type : false;
  }
  // optB: the ΔB option as it was when the run started, the same for all its files (an
  // undo during a run would otherwise change it between them).
  function payloadFor(f, optB = refineB){
    const std = isStd(f);
    return { x: Array.from(f.x), y: Array.from(f.y), varMul: f.varMul ? Array.from(f.varMul) : null, instr: instrOf(f),
      phases: phaseData(phasesFor(f)), opts: { standard: std, irf: std ? null : irf(), refineB: optB } };
  }

  async function refine(list){
    if (busy) return;
    const todo = list.filter(f=> phasesFor(f).length);
    if (!todo.length){ setStatus('Add a phase from a CIF to refine.'); return; }
    busy = true; cancelled = false; syncButtons();
    const optB = refineB;
    try {
      for (let k = 0; k < todo.length && !cancelled; k++){
        const f = todo[k];
        setStatus(`Refining ${f.label}…`);
        const res = await runInWorker(payloadFor(f, optB), (frac, stage)=>{ showProg((k + frac)/todo.length); if (stage) setStatus(`Refining ${f.label}: ${stage}…`); });
        if (!res) break;
        results[f.name] = { ...res, phases: phasesFor(f).map(p=> p.id), irf: isStd(f) ? null : irf(), at: Date.now() };
        if (f === host.files()[idx]) draw();
      }
      setStatus('');
    } catch(e){
      setStatus('⚠ ' + e.message);
    } finally {
      busy = false; hideProg(); syncButtons(); draw(); host.commit();
    }
  }
  function refineAll(){
    // The standard first: the samples take their instrumental profile from it.
    const fs = host.files(), std = fs.filter(isStd);
    refine([...std, ...fs.filter(f=> !isStd(f))]);
  }

  // ---- the plot: observed, calculated, the background, the difference under them,
  // and a row of ticks per phase between the two ----
  function curvesOf(f, r){
    // The phases as the result was refined: with the free shape when its parameters are
    // there, whatever the toggle says now.
    const ph = phaseData(phasesFor(f)).map(p=> ({ ...p, shape: shapeOfParams(r.params, p.id) }));
    const model = buildModel({ x: f.x, y: f.y, varMul: f.varMul || null, instr: instrOf(f), phases: ph });
    return calc(model, r.params);
  }
  function tickRowsOf(f){
    // Before a refinement the ticks sit where the file's cells put them, at Kα1.
    const ins = instrOf(f) || {}, lam = ins.lam1 || 1.540598, x0 = f.x[0], x1 = f.x[f.x.length-1];
    const dmin = lam/(2*Math.sin(Math.min(89.9, x1/2)*Math.PI/180));
    return phasesFor(f).map(p=> ({ color: p.color, name: p.prep.name,
      tt: reflections(p.prep.cell, p.prep.ops, dmin).map(r=> 2*Math.asin(lam/(2*r.d))*180/Math.PI).filter(t=> t >= x0 && t <= x1) }));
  }
  function draw(preserve){
    const fs = host.files();
    if (!fs.length) return;
    if (idx >= fs.length) idx = fs.length - 1;
    const f = fs[idx], r = results[f.name];
    $('xrdRvLabel').textContent = f.label + (isStd(f) ? ' (standard)' : '');
    $('xrdRvIdx').textContent = (idx+1) + '/' + fs.length;
    const svg = $('xrdRvSvg');
    const prev = preserve && plot ? { xmin: plot.xmin, xmax: plot.xmax } : null;
    plot = new Plot(svg, { xlabel: '2θ (°)', ylabel: 'Intensity (counts)' });
    plot.attachTools(svg.closest('.plot-wrap'));
    let c = null;
    if (r && r.params){ try { c = curvesOf(f, r); } catch(e){ c = null; } }
    const ys = f.y, lo = Math.min(...ys), hi = Math.max(...ys), A = (hi - lo) || 1;
    const groups = c ? groupTicks(c.ticks, phasesFor(f)) : tickRowsOf(f);
    const rowH = 0.045*A, rowGap = 0.02*A;
    const tickTop = lo - rowGap, tickBottom = tickTop - groups.length*(rowH + rowGap);
    let diff = null, off = 0;
    if (c){
      diff = ys.map((v, i)=> v - c.yc[i]);
      const dHi = Math.max(...diff), dLo = Math.min(...diff);
      off = tickBottom - rowGap - dHi;
      plot.setRange(f.x[0], f.x[f.x.length-1], off + dLo - 0.03*A, hi + 0.05*A);
    } else plot.setRange(f.x[0], f.x[f.x.length-1], tickBottom - rowGap, hi + 0.05*A);
    // A redraw keeps the 2θ zoom; the height follows what is drawn (a phase's tick row
    // more or less, the difference once there is a fit).
    if (prev){ plot.xmin = prev.xmin; plot.xmax = prev.xmax; }
    plot.drawAxes();
    plot.line(f.x, ys, 'var(--plot-errbar)', 1, undefined, { label: f.label, key: f.name });
    if (c){
      plot.line(f.x, c.bg, '#ff9933', 1, undefined, { label: 'background', key: 'background' });
      plot.line(f.x, c.yc, '#ff5050', 1.2, undefined, { label: 'calculated', key: 'calculated' });
      plot.line(f.x, diff.map(v=> v + off), '#3aa0ff', 1, undefined, { label: 'difference', key: 'difference' });
    }
    groups.forEach((g, k)=>{
      const y1 = tickTop - k*(rowH + rowGap), y0 = y1 - rowH, xs = [], yv = [];
      g.tt.forEach(t=>{ xs.push(t, t); yv.push(y0, y1); });
      plot.segments(xs, yv, g.color, 1.2, { label: g.name, key: 'ticks/' + g.name });
    });
    const leg = $('xrdRvLegend');
    leg.innerHTML = `<span><i style="background:var(--plot-errbar)"></i>observed</span>`
      + (c ? `<span><i style="background:#ff5050"></i>calculated</span><span><i style="background:#ff9933"></i>background</span><span><i style="background:#3aa0ff"></i>difference</span>` : '')
      + groups.map(g=> `<span><i style="background:${g.color}"></i>${esc(g.name)}</span>`).join('');
    $('xrdRvInstr').textContent = instrLine(instrOf(f));
    renderResults(f, r);
    renderSolids(f, r);
    renderWidths(f, r);
  }

  // ---- the crystallites' shape: each phase's refined solid in 3D (xrd-shape3d), the
  // crystal's directions on it with their uncertainty cones; drag to turn it ----
  let solidViews = [], solidsKey = '';
  // How each solid was last turned (xrd-shape3d getView), by sample and solid: coming
  // back to a sample shows it as it was left.
  const solidTurns = new Map();
  const DL_SVG = '<svg class="plot-btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="4" x2="12" y2="15"/><polyline points="7 10.5 12 15.5 17 10.5"/><line x1="5" y1="20" x2="19" y2="20"/></svg>';
  function solidCaption(s){
    const n = v => Number.isFinite(v) ? (v < 10 ? v.toFixed(1) : v.toFixed(0)) : '∞';
    const [x, y, z] = s.dims;
    return s.type === 'spheroid' ? `spheroid, ${s.kind}: ${n(x)} nm across, ${n(z)} nm along its axis`
      : s.type === 'cylinder' ? `cylinder, ${s.kind}: diameter ${n(x)} nm, height ${n(z)} nm`
      : s.type === 'ellcyl' ? `elliptic cylinder, ${s.kind}: ${n(x)} × ${n(y)} nm across, height ${n(z)} nm`
      : s.type === 'box' ? `box, ${s.kind}: ${n(x)} × ${n(y)} × ${n(z)} nm`
      : `ellipsoid, ${s.kind}: axes ${n(x)} × ${n(y)} × ${n(z)} nm`;
  }
  function renderSolids(f, r){
    const box = $('xrdRvSolids'), list = (r && r.solids) || [];
    // The same solids: the views stay as they were turned.
    const key = f.name + JSON.stringify(list);
    if (key === solidsKey) return;
    solidsKey = key;
    solidViews.forEach(({ view, turnKey })=>{ if (view.getView) solidTurns.set(turnKey, view.getView()); view.destroy(); });
    solidViews = [];
    if (solidTurns.size > 50) solidTurns.delete(solidTurns.keys().next().value);
    box.innerHTML = '';
    box.style.display = list.length ? '' : 'none';
    list.forEach(s=>{
      const color = (phasesFor(f).find(p=> p.id === s.id) || {}).color;
      const wrap = document.createElement('div');
      wrap.className = 'peak-box rv-solid';
      wrap.innerHTML = `<div class="peak-box-head"><span class="txt-mini">Crystallite shape${list.length > 1 ? ' · ' + esc(s.name) : ''}</span><button class="btn table-csv-btn" title="Download PNG">${DL_SVG}</button></div><div class="rv-solid-view"></div>`;
      box.appendChild(wrap);
      const view = shapeView(wrap.querySelector('.rv-solid-view'), { color });
      view.set({ type: s.type, dims: s.dims, frame: s.frame, dirs: s.dirs, caption: solidCaption(s) });
      const turnKey = f.name + '|' + s.id + '|' + JSON.stringify([s.type, s.dims, s.frame]);
      if (view.setView && solidTurns.has(turnKey)) view.setView(solidTurns.get(turnKey));
      wrap.querySelector('button').onclick = ()=>{
        const a = document.createElement('a');
        a.href = view.png(); a.download = `XRPD_shape_${f.label}_${s.name}.png`.replace(/[^\w.-]+/g, '_');
        document.body.appendChild(a); a.click(); a.remove();
      };
      solidViews.push({ view, turnKey });
    });
  }

  // ---- the peaks' own widths (xrd-widths, run by the worker): the table, the
  // Williamson–Hall plot and the tests ----
  let whPlot = null;
  const fmtE = (v, e) => {
    if (!Number.isFinite(v)) return '—';
    if (!(Number.isFinite(e) && e > 0)) return (+v.toPrecision(4)).toString();
    const p = Math.floor(Math.log10(e)), lead = e/Math.pow(10, p) < 2 ? 1 : 0, d = Math.max(0, lead - p);
    return v.toFixed(d) + '(' + Math.round(e*Math.pow(10, d)) + ')';
  };
  const f3 = v => Number.isFinite(v) ? v.toFixed(3) : '—';
  function renderWidths(f, r){
    const box = $('xrdRvWidths'), wd = r && r.widths;
    const phs = wd ? wd.phases.filter(ph=> ph.rows.length) : [];
    box.style.display = phs.length ? '' : 'none';
    if (!phs.length){ whPlot = null; return; }
    // The free shape's column when some phase kept one; a phase without has none to give.
    const shapeOn = phs.some(ph=> ph.shaped);
    const colorOf = id => (phasesFor(f).find(p=> p.id === id) || {}).color || '#888';
    // The table, as the Analysis card's: a row per peak (reflections at one 2θ are one).
    let html = '<div class="peak-scroll"><table><thead><tr><th>#</th><th>hkl</th><th>2θ (°)</th><th>Relative Intensity</th><th>FWHM (°)</th>'
      + `<th title="The sample's own FWHM: the peak fitted with the instrument's profile at that angle convolved in (Lorentzian widths adding, Gaussian ones in quadrature, as in the refinement)">FWHM corr. (°)</th><th>Crystallite size corr. (nm)</th>`
      + `<th title="The isotropic model's width for this peak, read off its own curve the same way">Model, isotropic (°)</th>${shapeOn ? '<th title="The free shape\'s width for this peak, read off its own curve the same way">Model, free shape (°)</th>' : ''}</tr></thead><tbody>`;
    let n = 0;
    phs.forEach(ph=> ph.rows.forEach(w=>{
      const skip = w.overlapped || w.edge || w.weak || w.flat, why = [w.overlapped && 'overlapped by another reflection', w.edge && 'at the end of the pattern', w.weak && 'too weak to measure (amplitude under 3 esd)', w.flat && 'no broadening above the instrument\'s (under 2 esd)'].filter(Boolean).join('; ');
      html += `<tr class="peak-row rv-pk${skip ? ' rv-pk-out' : ''}" data-tt="${w.tt}" data-ph="${ph.id}" data-lab="${esc(w.label)}"${why ? ` title="Not used by the tests: ${esc(why)}"` : ''}>`
        + `<td>${++n}</td><td><span class="rv-key-sm" style="background:${colorOf(ph.id)}"></span>${esc(w.label)}</td><td>${w.tt.toFixed(3)}</td><td>${Number.isFinite(w.rel) ? (w.rel*100).toFixed(1) + '%' : '—'}</td>`
        + `<td>${fmtE(w.H, w.Hesd)}</td><td>${fmtE(w.Hs, w.HsEsd)}</td><td>${w.flat ? '—' : fmtE(w.D, w.Desd)}</td><td>${f3(w.model.iso)}</td>${shapeOn ? `<td>${ph.shaped ? f3(w.model.shape) : '—'}</td>` : ''}</tr>`;
    }));
    html += '</tbody></table></div>';
    if (!wd.corrected) html += `<div class="rv-note">No instrumental standard refined: the widths are not corrected for the instrument's.</div>`;
    const wrap = $('xrdRvPkWrap');
    wrap.innerHTML = html;
    drawWH(phs, colorOf);
    renderTests(phs);
    // Hover: the peak on the pattern and on the Williamson–Hall plot.
    wrap.querySelectorAll('.rv-pk').forEach(tr=>{
      tr.addEventListener('mouseenter', ()=> highlight(+tr.dataset.tt, tr.dataset.lab, +tr.dataset.ph, colorOf(+tr.dataset.ph)));
      tr.addEventListener('mouseleave', ()=> highlight(null));
    });
  }
  function highlight(tt, lab, phId, color){
    if (plot){ plot.clearOverlay(); if (tt != null) plot.vline(tt, color, false); }
    if (!whPlot) return;
    whPlot.gOverlay.innerHTML = '';
    if (tt == null) return;
    const p = (whPlot._pts || []).find(q=> q.label === lab && q.ph === phId);
    if (p){
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', whPlot.px(p.x)); c.setAttribute('cy', whPlot.py(p.y)); c.setAttribute('r', 7);
      c.setAttribute('fill', 'none'); c.setAttribute('stroke', color); c.setAttribute('stroke-width', 2);
      whPlot.gOverlay.appendChild(c);
    }
  }
  /* Williamson–Hall: β·cosθ (10⁻³ rad) against 4·sinθ for the peaks the tests use, each
     with its esd and hkl; the weighted line through them (isotropic size + strain); the
     models' own points (the isotropic model's and the free shape's) beside them. */
  function drawWH(phs, colorOf){
    const svg = $('xrdRvWhSvg');
    whPlot = new Plot(svg, { xlabel: '4·sinθ', ylabel: 'β·cosθ (10⁻³ rad)' });
    whPlot.attachTools(svg.closest('.plot-wrap'));
    const D2R = Math.PI/180, pts = [], mods = [];
    phs.forEach(ph=> ph.rows.forEach(w=>{
      if (w.overlapped || w.edge || w.weak || w.flat || !(w.W > 0)) return;
      const x = 4*w.sin, k = 1e3*D2R*w.cos;
      pts.push({ x, y: w.W*k, e: (w.Wesd || 0)*k, label: w.label, ph: ph.id, color: colorOf(ph.id) });
      if (Number.isFinite(w.model.iso)) mods.push({ x, y: w.model.iso*k, kind: 'iso' });
      if (ph.shaped && Number.isFinite(w.model.shape)) mods.push({ x, y: w.model.shape*k, kind: 'shape' });
    }));
    if (!pts.length){ whPlot.setRange(0, 1, 0, 1); whPlot.drawAxes(); $('xrdRvWhLegend').innerHTML = ''; return; }
    const xs = pts.map(p=> p.x), ys = pts.flatMap(p=> [p.y - p.e, p.y + p.e]).concat(mods.map(m=> m.y));
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(0, ...ys), y1 = Math.max(...ys);
    const dx = (x1 - x0) || 1, dy = (y1 - y0) || 1;
    whPlot.setRange(Math.max(0, x0 - 0.12*dx), x1 + 0.12*dx, Math.max(0, y0 - 0.08*dy), y1 + 0.18*dy);
    whPlot.drawAxes();
    phs.forEach(ph=>{
      const wh = ph.wh;
      if (!Number.isFinite(wh.a)) return;
      const xa = whPlot.xmin, xb = whPlot.xmax;
      whPlot.line([xa, xb], [1e3*(wh.a + wh.b*xa), 1e3*(wh.a + wh.b*xb)], colorOf(ph.id), 1, '5,4', { label: `${ph.name}: weighted line (isotropic size + strain)`, key: 'wh/' + ph.id });
    });
    const iso = mods.filter(m=> m.kind === 'iso'), shp = mods.filter(m=> m.kind === 'shape');
    if (iso.length) whPlot.points(iso.map(m=> m.x), iso.map(m=> m.y), '#9aa3ad', 3);
    if (shp.length) whPlot.points(shp.map(m=> m.x), shp.map(m=> m.y), '#ff5050', 3);
    pts.forEach(p=>{ if (p.e > 0) whPlot.errbar(p.x, p.y, p.e); });
    phs.forEach(ph=>{ const q = pts.filter(p=> p.ph === ph.id); whPlot.points(q.map(p=> p.x), q.map(p=> p.y), colorOf(ph.id), 4.5); });
    pts.forEach(p=> whPlot.barLabel(p.x, p.y + p.e, p.label, { rot: 0, gap: 8, size: 10 }));
    whPlot._pts = pts;
    $('xrdRvWhLegend').innerHTML = phs.map(ph=> `<span><i style="background:${colorOf(ph.id)}"></i>${esc(ph.name)}, measured</span>`).join('')
      + (iso.length ? `<span><i style="background:#9aa3ad"></i>isotropic model</span>` : '')
      + (shp.length ? `<span><i style="background:#ff5050"></i>free-shape model</span>` : '');
  }
  // The tests, a box under the plot: each one's numbers and what they say.
  function renderTests(phs){
    let html = '<div class="rv-result">';
    phs.forEach(ph=>{
      const wh = ph.wh;
      if (phs.length > 1) html += `<div class="txt-mini rv-phase-name">${esc(ph.name)}</div>`;
      if (Number.isFinite(wh.chi2nu)){
        const aniso = wh.p < 1e-3;
        html += `<div class="pg-stat" title="χ² of the measured β·cosθ about the weighted line, per degree of freedom (${wh.nu}), and the probability of so large a value were the broadening isotropic (size and strain alike in every direction)">Williamson–Hall: χ²<sub>ν</sub> <b>${wh.chi2nu.toFixed(1)}</b>, p <b>${wh.p < 1e-4 ? wh.p.toExponential(0) : wh.p.toFixed(3)}</b></div>`
          + `<div class="rv-note">${aniso ? 'The widths depend on hkl beyond their esds: the broadening is anisotropic (the crystallites\' shape, or faults).' : 'The widths lie on one line within their esds: consistent with an isotropic size and strain.'}</div>`
          + `<div class="pg-stat" title="The weighted line's intercept Kλ/D (K = 0.9) and slope ε; with an anisotropic broadening it is an average, not a size">line: D <b>${fmtE(wh.D, wh.Desd)} nm</b>, ε <b>${fmtE(wh.b, wh.bEsd)}</b>${aniso ? ' (an average only)' : ''}</div>`;
      } else html += `<div class="rv-note">Williamson–Hall: fewer than three peaks to read (${wh.n}).</div>`;
      if (ph.orders.length){
        html += `<div class="pg-stat" style="margin-top:4px">Orders, Δd*(n)/Δd*(1): size 1, strain n</div>`;
        ph.orders.forEach(o=>{ html += `<div class="pg-stat">${esc(o.a)} → ${esc(o.b)}: <b>${fmtE(o.R, o.Resd)}</b> <span class="txt-meta">${o.verdict === 'order-dependent' ? 'below 1: broadening by the indices\' parity (faults)' : o.verdict}</span></div>`; });
      } else html += `<div class="rv-note">Orders: no pair (h k l), (n·h n·k n·l) both measured.</div>`;
      if (Number.isFinite(ph.scores.iso)) html += `<div class="pg-stat" title="Mean of ((measured − model)/esd)² over the peaks the tests use: about 1 when a model predicts the widths">Widths predicted, χ²<sub>ν</sub>: isotropic <b>${ph.scores.iso.toFixed(1)}</b>${Number.isFinite(ph.scores.shape) ? `, free shape <b>${ph.scores.shape.toFixed(1)}</b>` : ''}</div>`;
    });
    html += '</div>';
    $('xrdRvTests').innerHTML = html;
  }
  // The engine's ticks (each reflection at Kα1 where the refined cell puts it), one
  // row per phase in the phases' order.
  function groupTicks(ticks, list){
    return list.map(p=> ({ name: p.prep.name, color: p.color, tt: ticks.filter(t=> t.phase === p.id).map(t=> t.tt) }));
  }

  // ---- the side column: the statistics, then what the worker made of the result —
  // the standard's instrument, or each phase's cell, size, strain (and weight fraction
  // with several phases), a value a line ----
  function renderResults(f, r){
    const box = $('xrdRvResults');
    if (!r || !r.params){
      const n = phasesFor(f).length;
      box.innerHTML = n ? `<div class="rv-result"><div class="rv-note">Not refined yet. <b>Refine</b> starts from the CIF's cell${isStd(f) ? ' (the certified one, held fixed)' : ''}, finds where the pattern's peaks are, and refines step by step.</div></div>`
        : `<div class="rv-result"><div class="rv-note">No phase: add one from a CIF (above).</div></div>`;
      return;
    }
    const s = r.stats || {};
    let html = `<div class="rv-result"><div class="pg-stat" title="R_wp: the weighted residual; R_exp: what the counting statistics alone would give">R<sub>wp</sub>: <b>${(s.Rwp*100).toFixed(2)}%</b>  R<sub>exp</sub>: <b>${(s.Rexp*100).toFixed(2)}%</b></div>`
      + `<div class="pg-stat" title="χ² = Σw(y − y_c)²/(N − P), the reduced χ²: (R_wp/R_exp)²">χ²: <b>${(s.chi2).toFixed(2)}</b></div>`;
    (r.phaseResults || []).forEach(q=>{
      html += `<div class="txt-mini${q.phase ? ' rv-phase-name' : ''}">${esc(q.name)}</div>` + q.lines.map(l=> `<div class="pg-stat"${l.title ? ` title="${esc(l.title)}"` : ''}>${esc(l.label)}: <b>${esc(l.value)}</b></div>`).join('');
    });
    // What the refinement could not do (a cell search without a minimum, a phase not
    // detected) is said beside the numbers it qualifies.
    html += (r.warnings || []).map(w=> `<div class="rv-note" style="color:var(--warn)">⚠ ${esc(w)}</div>`).join('');
    if (isStd(f)) html += `<div class="rv-note">The samples take this profile and zero as their instrument's.</div>`;
    else if (!r.irf) html += `<div class="rv-note">No instrumental profile (refine the standard first): the widths, and the sizes from them, include the instrument's.</div>`;
    html += '</div>';
    box.innerHTML = html;
  }
  function instrLine(ins){
    if (!ins) return '';
    const parts = [];
    if (isFinite(ins.lam1)) parts.push(`${ins.anode || ''} Kα₁ ${ins.lam1} Å` + (isFinite(ins.lam2) ? `, Kα₂ ${ins.lam2} Å (×${ins.ratio})` : ''));
    if (isFinite(ins.radius)) parts.push(`R ${ins.radius} mm`);
    if (ins.divergence && ins.divergence.type) parts.push(`${ins.divergence.type} divergence slit${isFinite(ins.divergence.deg) ? ' ' + ins.divergence.deg + '°' : ''}`);
    if (ins.soller && isFinite(ins.soller.incident)) parts.push(`Soller ${ins.soller.incident} rad`);
    if (ins.filter) parts.push(`${ins.filter.material} filter`);
    if (ins.monochromator) parts.push('monochromator');
    if (ins.detector && ins.detector.name) parts.push(ins.detector.name);
    return parts.join(' · ') + ((ins.warnings || []).length ? ' — ⚠ ' + ins.warnings.join('; ') : '');
  }

  // ---- phases ----
  function renderPhases(){
    const el = $('xrdRvPhaseList'), rows = [];
    const row = (p, builtIn)=>{
      const q = p.prep, K = q.constraint || {};
      // A primitive file of a centred lattice is refined as its conventional cell, so that
      // is the cell shown: the one the refined a, c… will be compared with.
      const c = K.conv && K.basis ? K.conv : q.cell, r4 = v => +(+v).toFixed(4);
      const cellTxt = (K.kind === 'cubic' ? `a = ${r4(c.a)} Å`
        : `a ${r4(c.a)}, b ${r4(c.b)}, c ${r4(c.c)} Å; α ${r4(c.alpha)}, β ${r4(c.beta)}, γ ${r4(c.gamma)}°`)
        + (K.conv && K.basis ? ` (conventional cell, ${K.volumeRatio}× the file's)` : '');
      return `<div class="rv-phase" data-ph="${p.id}"><span class="rv-key" style="background:${p.color}"></span>`
        + `<div class="rv-main"><b>${esc(q.name)}</b>${q.formula ? ` · ${esc(q.formula)}` : ''}`
        + `<div class="rv-sub">${SYSTEM_NAMES[q.system] || esc(q.system)}, ${q.order} symmetry operations · ${cellTxt} · ${q.atoms.length} atoms in the cell${builtIn ? ' · built in, for the standard (cell held at the certified value)' : p.file ? ' · ' + esc(p.file) : ''}</div>`
        + (q.notes.length ? `<div class="rv-sub">${esc(q.notes.join('; '))}</div>` : '')
        + q.warnings.map(w=> `<div class="rv-sub" style="color:var(--warn)">⚠ ${esc(w)}</div>`).join('')
        + `</div>${builtIn ? '' : `<select class="rv-shape${p.shape ? ' is-on' : ''}" data-shape="${p.id}" aria-label="Crystallite shape of ${esc(q.name)}"${busy ? ' disabled' : ''} title="Crystallite shape: the isotropic size, or a free solid of any proportions and orientation (each reflection of a family with its own width). Needs the standard's profile; it tries several starting shapes, so it takes tens of seconds a sample, minutes for a phase with many reflections. Kept only when the data support it against an isotropic size">${SHAPES.map(([k, t])=> `<option value="${k}"${(shapeOpt(p.shape) || '') === k ? ' selected' : ''}>${k ? 'free shape: ' + t : t}</option>`).join('')}</select>`
          + `<button class="peak-del is-danger idle-dim rv-del" data-del="${p.id}" title="Remove phase">${X_SVG(13)}</button>`}</div>`;
    };
    phases.forEach(p=> rows.push(row(p, false)));
    if (host.files().some(isStd)) rows.push(row(lab6, true));
    el.innerHTML = rows.length ? rows.join('') : `<div class="rv-empty">No phase yet: <b>+ CIF</b> adds one from a crystallographic file (COD, ICSD, Materials Project…).</div>`;
  }
  async function addCifs(fileList){
    const errs = [];
    for (const file of fileList){
      try {
        const text = await file.text();
        const prep = prepPhase(text, file.name);
        phases.push({ id: nextId++, cif: text, file: file.name, color: PHASE_COLORS[phases.length % PHASE_COLORS.length], prep });
      } catch(e){ errs.push(`${file.name}: ${e.message}`); }
    }
    renderPhases(); draw(true); host.commit();
    if (errs.length) setStatus('⚠ ' + errs.join(' · '));
  }

  // ---- small UI pieces ----
  function setStatus(t){ $('xrdRvStatus').textContent = t || ''; }
  function showProg(frac){ $('xrdRvProgWrap').style.display = ''; $('xrdRvProgBar').style.width = Math.max(0, Math.min(1, frac))*100 + '%'; }
  function hideProg(){ $('xrdRvProgWrap').style.display = 'none'; $('xrdRvProgBar').style.width = '0%'; }
  function syncButtons(){
    $('xrdRvRefine').textContent = busy ? 'Cancel' : 'Refine';
    $('xrdRvRefineAll').disabled = busy;
    $('xrdRvClear').disabled = busy;
    const b = $('xrdRvOptB');
    b.classList.toggle('is-on', refineB); b.setAttribute('aria-pressed', String(refineB)); b.disabled = busy;
    $('xrdRvPhaseList').querySelectorAll('.rv-shape').forEach(sel=> { sel.disabled = busy; });
  }

  $('xrdRvAddCif').onclick = ()=> $('xrdRvCifInput').click();
  $('xrdRvCifInput').addEventListener('change', e=>{ const fl = [...e.target.files]; e.target.value = ''; if (fl.length) addCifs(fl); });
  // The shape picked: for the next refinements (the results there keep theirs).
  $('xrdRvPhaseList').addEventListener('change', e=>{
    const t = e.target.closest('[data-shape]');
    if (!t) return;
    const p = phases.find(q=> q.id === +t.dataset.shape);
    if (p && !busy){ p.shape = shapeOpt(t.value); host.commit(); }
    renderPhases();
  });
  $('xrdRvPhaseList').addEventListener('click', e=>{
    const b = e.target.closest('[data-del]'); if (!b || busy) return;
    const id = +b.dataset.del;
    phases = phases.filter(p=> p.id !== id);
    // A result refined with the phase is no longer the model's: it goes with it.
    Object.keys(results).forEach(k=>{ if ((results[k].phases || []).includes(id)) delete results[k]; });
    renderPhases(); draw(true); host.commit();
  });
  $('xrdRvRefine').onclick = ()=>{
    if (busy){ cancelled = true; if (cancelJob) cancelJob(); return; }
    const f = host.files()[idx]; if (f) refine([f]);
  };
  $('xrdRvRefineAll').onclick = ()=> refineAll();
  // An option for the next refinements; the results already there keep what they had.
  $('xrdRvOptB').onclick = ()=>{ if (busy) return; refineB = !refineB; syncButtons(); host.commit(); };
  $('xrdRvClear').onclick = ()=>{ const f = host.files()[idx]; if (!f || busy || !results[f.name]) return; delete results[f.name]; draw(true); host.commit(); };
  $('xrdRvPrev').onclick = ()=>{ const n = host.files().length; if (n){ idx = (idx - 1 + n) % n; draw(); } };
  $('xrdRvNext').onclick = ()=>{ const n = host.files().length; if (n){ idx = (idx + 1) % n; draw(); } };

  return {
    // After any change to the files: the card follows them; results of files no
    // longer loaded go.
    refresh(preserve){
      const fs = host.files();
      $('xrdRvCard').style.display = fs.length ? 'block' : 'none';
      if (!fs.length) return;
      const names = new Set(host.allFiles().map(f=> f.name));
      Object.keys(results).forEach(k=>{ if (!names.has(k)) delete results[k]; });
      renderPhases();
      draw(preserve);
    },
    redraw(){ if (host.files().length) draw(true); },
    snapshot(){ return { phases: phases.map(p=> ({ id: p.id, cif: p.cif, file: p.file, color: p.color, shape: shapeOpt(p.shape) })), nextId, idx, refineB, results: JSON.parse(JSON.stringify(results)) }; },
    restore(s){
      s = s || {};
      phases = (s.phases || []).flatMap(p=>{ try { return [{ ...p, shape: shapeOpt(p.shape), prep: prepPhase(p.cif, p.file) }]; } catch(e){ return []; } });
      nextId = s.nextId || phases.reduce((m, p)=> Math.max(m, p.id + 1), 1);
      idx = s.idx || 0;
      results = s.results ? JSON.parse(JSON.stringify(s.results)) : {};
      refineB = !!s.refineB; syncButtons();
    },
    // The CSVs: every refined pattern's curves, and one row per pattern and phase.
    csvEntries(){ return csvEntries(); },
  };

  function csvEntries(){
    const out = [], fs = host.files().filter(f=> results[f.name] && results[f.name].params);
    if (!fs.length) return out;
    const cols = [];
    fs.forEach(f=>{
      let c; try { c = curvesOf(f, results[f.name]); } catch(e){ return; }
      cols.push({ h: '2Theta_' + f.label, v: Array.from(f.x, v=> fmtNum(v, 5)) },
        { h: 'Observed_' + f.label, v: Array.from(f.y, v=> fmtNum(v, 3)) },
        { h: 'Calculated_' + f.label, v: Array.from(c.yc, v=> fmtNum(v, 3)) },
        { h: 'Background_' + f.label, v: Array.from(c.bg, v=> fmtNum(v, 3)) },
        { h: 'Difference_' + f.label, v: Array.from(f.y, (v, i)=> fmtNum(v - c.yc[i], 3)) });
    });
    const n = Math.max(0, ...cols.map(c=> c.v.length));
    let t = csvLine(cols.map(c=> c.h));
    for (let i = 0; i < n; i++) t += csvLine(cols.map(c=> i < c.v.length ? c.v[i] : ''));
    out.push({ name: 'rietveld_pattern.csv', text: t });
    let s = csvLine(['Pattern', 'Phase', 'Quantity', 'Value', 'Esd', 'Rwp', 'Rexp', 'chi2']);
    fs.forEach(f=>{
      const r = results[f.name], st = r.stats || {};
      // Number.isFinite: a NaN that went through JSON (undo, a saved project) comes back as
      // null, which the global isFinite takes for 0 and fmtNum cannot format.
      const num = (v, d)=> Number.isFinite(v) ? fmtNum(v, d) : '';
      (r.table || []).forEach(q=> s += csvLine([f.label, q.phase || '', q.name, num(q.value, 8), num(q.esd, 8), num(st.Rwp*100, 3), num(st.Rexp*100, 3), num(st.chi2, 3)]));
    });
    out.push({ name: 'rietveld_results.csv', text: s });
    // The peak widths of every refined sample.
    const num = (v, d)=> Number.isFinite(v) ? fmtNum(v, d) : '';
    let pk = csvLine(['Pattern', 'Phase', 'hkl', '2Theta_deg', 'Relative_intensity', 'FWHM_deg', 'FWHM_esd_deg', 'eta', 'FWHM_corr_deg', 'FWHM_corr_esd_deg', 'Size_corr_nm', 'Size_corr_esd_nm', 'Delta_dstar_invA', 'Delta_dstar_esd_invA', 'Model_isotropic_FWHM_corr_deg', 'Model_free_shape_FWHM_corr_deg', 'Used_by_tests', 'Note']);
    let anyPk = false;
    fs.forEach(f=>{
      const wd = results[f.name].widths;
      if (!wd) return;
      wd.phases.forEach(ph=> ph.rows.forEach(w=>{
        anyPk = true;
        const skip = [w.overlapped && 'overlapped', w.edge && 'edge', w.weak && 'weak', w.flat && 'no broadening above the instrument'].filter(Boolean).join(' ');
        // Without a standard the corr columns hold the whole widths, the instrument's in.
        const note = [skip, !wd.corrected && 'not corrected: no instrumental standard'].filter(Boolean).join('; ');
        pk += csvLine([f.label, ph.name, w.plain, num(w.tt, 5), num(w.rel, 4), num(w.H, 5), num(w.Hesd, 5), num(w.eta, 3), num(w.Hs, 5), num(w.HsEsd, 5), num(w.D, 4), num(w.Desd, 4), num(w.dd, 6), num(w.ddEsd, 6), num(w.model.iso, 5), ph.shaped ? num(w.model.shape, 5) : '', skip ? 'no' : 'yes', note]);
      }));
    });
    if (anyPk) out.push({ name: 'rietveld_peaks.csv', text: pk });
    return out;
  }
}
