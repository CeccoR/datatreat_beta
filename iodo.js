import { esc, registerModule, keeper, objId, exactKey, csvNum, flashFieldInvalid, barNames, X_SVG, setupDropzone, nextColor, fitLinear, csvLine } from './utils.js';
import { Plot, svgEl, axisReadout } from './plot.js';
import { moduleKit, wideCsv, isObj, num } from './modkit.js';
import { viewOf, setView, viewKey, swatchLegend } from './modcharts.js';
import { snavHtml, snav } from './snav.js';
import * as M from './iodo-model.js';
import * as H from './iodo-html.js';

/* =========================================================
   IODOMETRY MODULE (v533)

   Iodide oxidised to triiodide by H₂O₂, followed as the absorbance of the triiodide band
   against time, at one wavelength, by a kinetics run (the Cary 60's Kinetics export): a
   trace a sample, a small spike in it where the analyte was injected. Each trace is
   aligned on its injection (its time from the injection; its absorbance less the least
   it has from the injection on, its background) and read at a fixed time after it (the
   reading time): the aligned absorbance there, linearly interpolated between the two
   points around it (none when the trace ends before). A calibration line, typed in or
   fitted to standards, turns the readings into concentrations.
   - The file (iodo-model.js readKinetics): the traces' names on a line over each (time,
     absorbance) pair of columns, the columns' names under it ("Time (sec)", "Abs"), the
     data, then each trace's details (its collection time, its wavelength) under its name.
     Read with textdata.js (the encoding, the separator, the decimal mark and the quotes
     found from the file), as DRS reads its own. Each pair is a trace in the trace list,
     named as the file names it, its File the CSV; its details in its tooltip and the
     readings' CSV.
   - The injection (iodo-model.js suggestInj): the highest local maximum of the trace whose
     prominence is the minimum prominence at least (the user's prototype, after MATLAB's
     findpeaks: each side's valley found by walking down from the peak while the trace
     falls), as a file loads and as Suggest is pressed (every trace). A click on the
     Analysis card's plot sets the trace's at the point nearest in time, at once; there is
     no status of it (suggested, set by hand) to keep.
   - The project: each trace's record { name, src (its file), label, color, rawBytes (the
     file's, shared by its traces), k (its pair of columns), inj (its injection's time,
     null for none) }, read again from the bytes as it opens; the module's state the
     reading time, the minimum prominence and the calibration.

   MADE PER TAB, as every module (utils.js registerModule): createIodo is the factory,
   each open Iodometry tab that is awake an instance of its own, made of its copy of
   index.html's section (root) and a layer (the calibration's window). Its elements are
   found in root and the layer, never in the page. It draws only on show, and its redraw
   draws all as it is shown; a tab shown again with nothing changed and at the same width
   draws nothing. It has no job that runs on while hidden.

   SPLIT (v563): what it works out that touches no page (a file read and kept, the
   injection, the alignment and the reading, the calibration and its window's draft, a
   trace's results and read-outs, a trace and the state as a project holds them, the plots'
   ranges and the readings' layout, the CSVs) in iodo-model.js, its words and markup in
   iodo-html.js, both tested in Node. Here the page: the instance's state (S), the drop,
   the trace selector, the parameters, the plots and the calibration's window, and their
   listeners. Each is a function at module level of S, not a closure inside createIodo (to
   v562 one of 407 lines): what a listener holds is what it is handed.
========================================================= */
/* The alignments, kept by the trace's absorbances (utils.js keeper: iodo-model.js alignOf)
   under the injection: a tab woken, an undo, a redraw and the CSVs take each as made. */
const alignKept = keeper('iodo-align', 8);
// utils.js's and modkit.js's helpers the model takes (iodo-model.js U), and what the markup
// takes (iodo-html.js u).
const U = { alignKept, objId, exactKey, fitLinear, csvNum, csvLine, wideCsv, barNames, num, isObj };
const HU = { esc, X_SVG };

/* =========================================================
   THE INSTANCE: its state S, which every function below takes:
     key, root, layer, shown, $  its context (utils.js makeInstance: shown() whether its tab
                          is on show) and its elements by id, in root
     stale, drawnAt       hidden, nothing is drawn: drawable(S) says whether to draw, and
                          when not marks the instance to be drawn whole as it is shown
                          (stale); drawnAt, the width it was last drawn whole at
     tRead, minProm, cal  the module's own state: the reading time (s), the injection
                          search's minimum prominence, the calibration
     curName, traceNext   the trace on show (a view), and a wake's (showNext)
     kit, allFiles, files the module (modkit.js): every trace loaded, in list order, and the
                          included ones
     nav                  the trace selector (snav.js)
     svgA                 the Analysis card's plot, its guide drawn over it
     calEl, stdBody       the calibration's window and its standards' rows
     draft, calFrom       the calibration being edited in it (none: closed), and the element
                          focused before it opened
     onCalKey             its Escape (a document listener while it is open)
========================================================= */
// An Iodometry tab's instance (utils.js makeInstance: ctx { key, root, layer, shown }).
function createIodo(ctx){
  const S = makeState(ctx);
  S.kit = moduleKit('iodo', kitHooks(S));
  S.allFiles = S.kit.all; S.files = S.kit.files;
  setupDropzone(S.$('iodoDropzone'), S.$('iodoFiles'), list => onDrop(S, list));
  wireNav(S);
  wireParams(S);
  wirePlot(S);
  makeCal(S);
  paintAnalysis(S);
  return apiOf(S);
}
function makeState({ key, root, layer, shown }){
  const $ = id => root.querySelector('#' + id);
  // The trace selector (snav.js), its markup first: the module finds its arrows by their ids.
  $('iodoNav').innerHTML = snavHtml({ prev: 'iodoPrev', idx: 'iodoIdx', next: 'iodoNext', name: 'iodoCurrentLabel', what: 'trace' });
  const S = { key, root, layer, shown, $, stale: false, drawnAt: '', tRead: M.DEF.tRead, minProm: M.DEF.minProm, cal: M.calDefault(),
    curName: null, traceNext: null, kit: null, allFiles: null, files: null, nav: null, svgA: null, calEl: null, stdBody: null, draft: null, calFrom: null };
  S.onCalKey = e => onCalKey(S, e);
  return S;
}
const drawable = S => S.shown() || !(S.stale = true);
// What the module kit is given (modkit.js o).
function kitHooks(S){
  return {
    root: S.root, key: S.key, layer: S.layer,
    alerts: p =>{ S.$('iodoAlerts').innerHTML = p.invalid + p.upload; },
    refresh: ()=> afterFilesChange(S),
    redraw: ()=> drawAll(S, true),
    cleared: ()=>{ S.curName = null; },
    tip: f => M.tipOf(f),
    snapshot: ()=> M.stateOf(S.tRead, S.minProm, S.cal),
    // A trace as a restore takes it (iodo-model.js fileIn).
    file: f => M.fileIn(f),
    restore: s => restore(S, s),
    redrawTab: ()=> redrawTab(S),
    csv: ()=> S.files.length ? [{ name: 'aligned.csv', text: alignedCsv(S) }, { name: 'readings.csv', text: readingsCsv(S) }] : [],
  };
}
// What it gives utils.js and tabs.js.
function apiOf(S){
  return {
    // The trace on show: kept as the tab sleeps and in its record (tabs.js).
    shows(){ return M.showsOf(S.files, curFile(S)); },
    showNext(v){ S.traceNext = M.showNextIn(U, v); },
    destroy(){ closeCal(S, false); S.calEl.remove(); S.kit.destroy(); },
  };
}
function restore(S, s){
  const st = M.stateIn(U, s);
  S.tRead = st.tRead; S.minProm = st.minProm; S.cal = st.cal;
  if (S.traceNext){ if (S.allFiles.some(f=> f.name === S.traceNext)) S.curName = S.traceNext; S.traceNext = null; }
  closeCal(S, false);
}
function redrawTab(S){
  const at = String(S.root.clientWidth);
  if (!S.stale && at === S.drawnAt) return;
  S.stale = false; S.drawnAt = at;
  if (S.files.length) drawAll(S, true);
}

/* ---- Files dropped: each read (iodo-model.js readKinetics), each pair of columns a trace,
   its injection suggested; a file already loaded (by its name) said, not loaded again. ---- */
async function onDrop(S, list){
  const names = new Set(S.allFiles.map(f=> f.src || f.name)), bad = [], dup = [];
  for (const file of list){
    if (names.has(file.name)){ dup.push(file.name); continue; }
    names.add(file.name);
    const rawBytes = new Uint8Array(await file.arrayBuffer());
    const t = M.readBytes(rawBytes);
    if (!t || t.error){ bad.push(t ? `${file.name} (${t.error})` : file.name); continue; }
    M.keepTable(rawBytes, t);
    t.traces.forEach((tr, k)=>{
      if (!tr) return;
      S.kit.add(M.traceRec(file.name, t, k, tr, rawBytes, nextColor(S.allFiles), S.minProm));
    });
  }
  S.kit.said(bad, dup);
  afterFilesChange(S);
}
function afterFilesChange(S){
  S.kit.showFiles();
  S.$('iodoAnalysis').style.display = S.files.length ? '' : 'none';
  S.$('iodoResults').style.display = S.files.length ? '' : 'none';
  drawAll(S, true);
  S.kit.commit();
}

/* ---- The trace on show (a view: no step, kept as the tab sleeps: shows) ---- */
const curFile = S => M.curOf(S.files, S.curName);
function step(S, d){
  const n = S.files.length, f = curFile(S);
  if (!n || !f) return;
  S.curName = S.files[(S.files.indexOf(f) + d + n) % n].name;
  paintAnalysis(S); drawAnalysis(S, false);
}
function wireNav(S){
  S.$('iodoPrev').addEventListener('click', ()=> step(S, -1));
  S.$('iodoNext').addEventListener('click', ()=> step(S, 1));
  // (its list: any trace, straight)
  const at = ()=> Math.max(0, S.files.indexOf(curFile(S)));
  S.nav = snav(S.$('iodoNav').querySelector('.snav'), { count: ()=> S.files.length, index: at,
    label: i=> S.files[i].label, title: i=> M.tipOf(S.files[i]), go: i=> step(S, i - at()) });
}
// A trace's results (iodo-model.js resultOf).
const resultOf = (S, f)=> M.resultOf(U, f, S.tRead, S.cal);

/* ---- The parameters: confirmed (Enter, or the field left), a number in range; else the field
   shakes and shows the value it had ---- */
function takeField(S, el, ok, set, now){
  const v = M.fieldNum(el.value);
  if (v == null || !ok(v)){ flashFieldInvalid(el); el.value = String(now); return; }
  el.value = String(v);
  if (Object.is(v, now)) return;
  set(v);
  drawAll(S, true); S.kit.commit();
}
function wireParams(S){
  S.$('iodoTRead').addEventListener('change', e=> takeField(S, e.target, v=> v > 0, v=>{ S.tRead = v; }, S.tRead));
  S.$('iodoProm').addEventListener('change', e=> takeField(S, e.target, v=> v >= 0, v=>{ S.minProm = v; }, S.minProm));
  S.root.querySelectorAll('#iodoTRead, #iodoProm').forEach(el=> el.addEventListener('keydown', e=>{ if (e.key === 'Enter') e.target.blur(); }));
  // Suggest: every trace's injection found again (the minimum prominence as it is).
  S.$('iodoSuggest').addEventListener('click', ()=>{ if (M.suggestAll(S.allFiles, S.minProm)){ drawAll(S, true); S.kit.commit(); } });
  S.$('iodoCalBtn').addEventListener('click', ()=> openCal(S));
}

/* ---- The Analysis card: the trace on show, its injection, background and reading ---- */
function paintAnalysis(S){
  const f = curFile(S), $ = S.$;
  $('iodoTRead').value = String(S.tRead);
  $('iodoProm').value = String(S.minProm);
  const L = M.calLine(U, S.cal);
  $('iodoCalSum').innerHTML = H.calSumHtml(S.cal, L, HU);
  if (!f) return;
  const r = resultOf(S, f);
  S.nav.update();
  const o = M.readouts(r, S.cal, S.tRead, L);
  $('iodoInj').textContent = o.inj;
  $('iodoBg').textContent = o.bg;
  $('iodoA').textContent = o.A;
  $('iodoATitle').textContent = o.ATitle;
  $('iodoCRow').style.display = o.cRow;
  $('iodoC').textContent = o.c;
}
function drawAnalysis(S, preserve){
  const f = curFile(S), svg = S.$('iodoSvg');
  if (!f || !drawable(S)) return;
  const { tr, al, A } = resultOf(S, f);
  if (!tr) return;
  const prev = preserve ? viewOf(svg._plot) : null, R = M.traceRange(tr);
  const plot = new Plot(svg, { xlabel: 'Time (s)', ylabel: 'Absorbance' });
  plot.setRange(R.x0, R.x1, R.y0, R.y1);
  setView(plot, prev, f.name);
  plot.drawAxes();
  plot.line(tr.t, tr.A, f.color, 1.5, undefined, { label: f.label, key: f.name });
  const items = [[f.color, esc(f.label)]];
  if (al) drawMarks(S, plot, tr, al, A, R.x1, items);
  plot.attachTools(svg.closest('.plot-wrap'));
  S.$('iodoLegend').innerHTML = H.legendHtml(items, HU);
  S.$('iodoNone').style.display = al ? 'none' : '';
}
// The injection, the background from it to the trace's end (t1) and the reading, each named
// in the legend's `items`.
function drawMarks(S, plot, tr, al, A, t1, items){
  plot.line([al.t0, t1], [al.min, al.min], M.BG_COLOR, 1.2, '5,4', { label: 'background', key: 'background' });
  mark(plot, al.t0, tr.A[al.i0], M.INJ_COLOR, 'injection');
  items.push([M.INJ_COLOR, 'injection'], [M.BG_COLOR, 'background']);
  if (Number.isFinite(A)){ mark(plot, al.t0 + S.tRead, al.min + A, M.READ_COLOR, 'reading'); items.push([M.READ_COLOR, `reading (${S.tRead} s after)`]); }
}
// A point marked on a plot, named (the composer's series).
function mark(plot, x, y, color, label){
  plot.points([x], [y], color, 5);
  plot._stored[plot._stored.length - 1].label = label;
}

/* The plot clicked (no pan or zoom tool on): the trace's injection at the point nearest in
   time, at once. Over the plot a guide shows that point and its values (the plot's own
   read-out of the pointer left out). */
function wirePlot(S){
  const svgA = S.svgA = S.$('iodoSvg');
  svgA._suppressReadout = true;
  svgA.addEventListener('pointermove', e=> onGuide(S, e));
  svgA.addEventListener('pointerleave', ()=> clearGuide(S));
  svgA.addEventListener('click', e=> onPlotClick(S, e));
}
const clearGuide = S => S.svgA.querySelectorAll('.iodo-guide').forEach(e=> e.remove());
// The point under the pointer, its index in the trace on show; -1 off the data's area.
function pointAt(S, e){
  const svgA = S.svgA, P = svgA._plot, f = curFile(S), tr = f && M.traceOf(f);
  if (!P || !tr || P._mode) return -1;
  const r = svgA.getBoundingClientRect(), { w, h } = P.size(), m = P.margin, cx = e.clientX - r.left, cy = e.clientY - r.top;
  if (cx < m.l || cx > w - m.r || cy < m.t || cy > h - m.b) return -1;
  return M.nearestIdx(tr.t, P.invX(cx));
}
function onGuide(S, e){
  clearGuide(S);
  const svgA = S.svgA, i = pointAt(S, e), P = svgA._plot, f = curFile(S);
  if (i < 0) return;
  const tr = M.traceOf(f), m = P.margin, { w, h } = P.size(), x = P.px(tr.t[i]), y = P.py(tr.A[i]);
  const at = { 'pointer-events': 'none', class: 'iodo-guide' };
  svgA.appendChild(svgEl('line', { x1: x, x2: x, y1: m.t, y2: h - m.b, stroke: M.INJ_COLOR, 'stroke-width': 1.2, 'stroke-dasharray': '4,3', ...at }));
  svgA.appendChild(svgEl('circle', { cx: x, cy: y, r: 3.5, fill: M.INJ_COLOR, ...at }));
  const flip = x > w - m.r - 150, tx = x + (flip ? -8 : 8);
  const t = svgEl('text', { x: tx, y: m.t + 14, 'font-size': 12, fill: M.INJ_COLOR, stroke: '#0b0f12', 'stroke-width': 3.5, 'paint-order': 'stroke', 'font-family': 'monospace', 'text-anchor': flip ? 'end' : 'start', ...at });
  const l1 = svgEl('tspan', { x: tx }), l2 = svgEl('tspan', { x: tx, dy: 16 });
  l1.textContent = axisReadout('Time (s)', tr.t[i]); l2.textContent = axisReadout('Absorbance', tr.A[i]);
  t.append(l1, l2);
  svgA.appendChild(t);
}
function onPlotClick(S, e){
  const i = pointAt(S, e), f = curFile(S);
  if (i < 0) return;
  const v = M.traceOf(f).t[i];
  if (Object.is(v, f.inj)) return;
  f.inj = v;
  drawAll(S, true); S.kit.commit();
}

/* ---- The Results card: the traces aligned, overlaid, and the readings ---- */
function drawResults(S, preserve){
  if (!drawable(S)) return;
  const list = S.files.map(f=> resultOf(S, f)), al = list.filter(r=> r.al);
  // The aligned traces, the reading time marked.
  const svg = S.$('iodoAlignSvg'), prev = preserve ? viewOf(svg._plot) : null;
  const R = M.alignRange(al, S.tRead);
  const plot = new Plot(svg, { xlabel: 'Time from injection (s)', ylabel: 'Absorbance − background' });
  plot.setRange(R[0], R[1], R[2], R[3]);
  setView(plot, prev, viewKey(al.map(r=> r.f)));
  plot.drawAxes();
  plot.vline(S.tRead, M.READ_COLOR);
  al.forEach(r=> plot.line(r.al.xs, r.al.ys, r.f.color, 1.5, undefined, { label: r.f.label, key: r.f.name }));
  plot.attachTools(svg.closest('.plot-wrap'));
  S.$('iodoAlignLegend').innerHTML = swatchLegend(al.map(r=> r.f));
  S.$('iodoAlignNote').textContent = M.alignNote(list.length, al.length);
  drawReadings(S, list);
}
/* The readings: one point a trace included, its name under the axis and its value over it
   (iodo-model.js readingsLayout). */
function drawReadings(S, list){
  const svg = S.$('iodoReadSvg'), L = M.calLine(U, S.cal);
  S.$('iodoReadCap').textContent = M.readCap(L, S.cal, S.tRead);
  const mctx = document.createElement('canvas').getContext('2d');
  mctx.font = "10px 'Inter', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  const rect = svg.getBoundingClientRect(), lay = M.readingsLayout(U, list, L, S.cal, mctx, rect.width || 640, rect.height || 420);
  const plot = new Plot(svg, lay.opts), { vals, fit } = lay;
  plot.setRange(lay.range[0], lay.range[1], lay.range[2], lay.range[3]);
  plot.drawAxes();
  list.forEach((r, k)=>{
    if (lay.has[k]){ mark(plot, k + 1, vals[k], r.f.color, r.f.label); plot.barLabel(k + 1, vals[k], M.sig(vals[k]), { gap: 8 }); }
    plot.tickLabel(k + 1, fit.labels[k], fit.rot, r.f.label, r.f.name);
  });
  plot.attachTools(svg.closest('.plot-wrap'));
}

// Every card drawn (as it is shown, when hidden).
function drawAll(S, preserve){
  paintAnalysis(S);
  if (!S.files.length || !drawable(S)) return;
  drawAnalysis(S, preserve);
  drawResults(S, preserve);
  S.stale = false; S.drawnAt = String(S.root.clientWidth);
}

/* ---- The CSVs: the traces aligned, and the readings, each trace's details with them ---- */
const alignedCsv = S => M.alignedCsv(U, S.files.map(f=> resultOf(S, f)));
function readingsCsv(S){
  const L = M.calLine(U, S.cal);
  return M.readingsCsv(U, S.files.map(f=> resultOf(S, f)), S.cal, S.tRead, L);
}

/* ---- The calibration's window (iodo-html.js calHtml): the way (none, the line typed, the
   standards fitted), the unit, the line or the standards, the fit shown as they are typed.
   Apply takes it, a step; Cancel, ×, Escape or a click beside it, nothing. ---- */
const cq = (S, s)=> S.calEl.querySelector(s);
function makeCal(S){
  const calEl = S.calEl = document.createElement('div');
  calEl.className = 'modal-backdrop iodo-cal';
  calEl.style.display = 'none';
  calEl.innerHTML = H.calHtml(HU);
  S.layer.appendChild(calEl);
  S.stdBody = cq(S, '.iodo-std tbody');
  calEl.addEventListener('input', ()=> sync(S));
  calEl.addEventListener('change', e=>{ if (e.target.id === 'iodoCalMode') sync(S); });
  calEl.addEventListener('keydown', e=>{ if (e.key === 'Enter' && e.target.matches('input') && !cq(S, '[data-apply]').disabled){ e.preventDefault(); closeCal(S, true); } });
  calEl.addEventListener('click', e=> onCalClick(S, e));
}
function openCal(S){
  if (S.draft) return;
  const d = S.draft = M.draftOf(S.cal);
  S.calFrom = document.activeElement;
  cq(S, '#iodoCalMode').value = d.mode;
  cq(S, '#iodoCalUnit').value = d.unit;
  cq(S, '#iodoCalSlope').value = d.slope == null ? '' : String(d.slope);
  cq(S, '#iodoCalIcpt').value = d.intercept == null ? '' : String(d.intercept);
  drawStds(S);
  S.calEl.style.display = 'flex';
  document.addEventListener('keydown', S.onCalKey);
  cq(S, '.iodo-cal-box').focus();
}
function drawStds(S){
  S.stdBody.innerHTML = H.stdRowsHtml(S.draft.stds, HU);
  sync(S);
}
// The draft read from the window's fields; a field that holds no number, which its mode
// uses, named in what it gives.
function readDraft(S){
  const bad = [], d = S.draft;
  const take = (el, name)=>{ const v = M.fieldNum(el.value); if (v === undefined){ bad.push([el, name]); return null; } return v; };
  d.mode = M.modeIn(cq(S, '#iodoCalMode').value);
  d.unit = cq(S, '#iodoCalUnit').value;
  d.slope = take(cq(S, '#iodoCalSlope'), 'the slope');
  d.intercept = take(cq(S, '#iodoCalIcpt'), 'the intercept');
  S.stdBody.querySelectorAll('tr[data-i]').forEach(tr=>{
    const i = +tr.dataset.i;
    d.stds[i] = [0, 1].map(j=> take(tr.querySelector(`input[data-j="${j}"]`), `standard ${i + 1}`));
  });
  return M.badUsed(bad, d.mode);
}
// What the draft gives, said under the fields; Apply only for a calibration that is one.
function sync(S){
  const bad = readDraft(S), d = S.draft, L = M.calLine(U, d);
  cq(S, '.iodo-cal-line').style.display = d.mode === 'line' ? '' : 'none';
  cq(S, '.iodo-cal-std').style.display = d.mode === 'std' ? '' : 'none';
  cq(S, '.iodo-cal-fit').innerHTML = H.calFitHtml(d, L, M.stdsOf(d).length, HU);
  const msg = M.calMsg(d, bad, L);
  cq(S, '.iodo-cal-msg').textContent = msg;
  // (too few standards: said by the fit's line)
  cq(S, '[data-apply]').disabled = !!msg || (d.mode !== 'none' && !L);
}
function closeCal(S, apply){
  if (!S.draft) return;
  const d = S.draft;
  S.draft = null;
  S.calEl.style.display = 'none';
  document.removeEventListener('keydown', S.onCalKey);
  if (S.calFrom && S.calFrom.isConnected) S.calFrom.focus();
  S.calFrom = null;
  if (!apply) return;
  const cal = M.applied(d, S.cal);
  if (!cal) return;
  S.cal = cal;
  drawAll(S, true); S.kit.commit();
}
// (its tab on show: an Escape in another tab is that tab's)
function onCalKey(S, e){ if (e.key === 'Escape' && S.shown()){ e.stopPropagation(); closeCal(S, false); } }
function onCalClick(S, e){
  if (e.target === S.calEl || e.target.closest('[data-cancel], .iodo-cal-x')){ closeCal(S, false); return; }
  if (e.target.closest('[data-apply]')){ if (!readDraft(S).length) closeCal(S, true); return; }
  if (e.target.closest('[data-add-std]')){ readDraft(S); S.draft.stds.push([null, null]); drawStds(S); S.stdBody.querySelector('tr:last-child input').focus(); return; }
  const del = e.target.closest('[data-del]');
  if (del){ readDraft(S); S.draft.stds.splice(+del.closest('tr').dataset.i, 1); drawStds(S); }
}

registerModule('iodo', createIodo);
