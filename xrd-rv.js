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
  const phaseData = list => list.map(p=> ({ id: p.id, name: p.prep.name, cell: p.prep.cell, constraint: p.prep.constraint, ops: p.prep.ops, atoms: p.prep.atoms, mass: p.prep.mass, color: p.color }));
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
    const ph = phaseData(phasesFor(f));
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
        + `</div>${builtIn ? '' : `<button class="peak-del is-danger idle-dim rv-del" data-del="${p.id}" title="Remove phase">${X_SVG(13)}</button>`}</div>`;
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
  }

  $('xrdRvAddCif').onclick = ()=> $('xrdRvCifInput').click();
  $('xrdRvCifInput').addEventListener('change', e=>{ const fl = [...e.target.files]; e.target.value = ''; if (fl.length) addCifs(fl); });
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
    snapshot(){ return { phases: phases.map(p=> ({ id: p.id, cif: p.cif, file: p.file, color: p.color })), nextId, idx, refineB, results: JSON.parse(JSON.stringify(results)) }; },
    restore(s){
      s = s || {};
      phases = (s.phases || []).flatMap(p=>{ try { return [{ ...p, prep: prepPhase(p.cif, p.file) }]; } catch(e){ return []; } });
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
    return out;
  }
}
