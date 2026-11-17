import { esc, registerModule, keeper, fixed, objId, exactKey, settings, flashFieldInvalid, barNames, X_SVG, setupDropzone, nextColor, fitLinear, csvLine } from './utils.js';
import { Plot, svgEl, axisReadout } from './plot.js';
import { moduleKit, wideCsv, isObj, num } from './modkit.js';
import { viewOf, setView, viewKey, swatchLegend } from './modcharts.js';
import { decodeText, textLines, splitFields, parseNum, isNum, nameUnit, SEPS } from './textdata.js';

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
   - The file (readKinetics): the traces' names on a line over each (time, absorbance)
     pair of columns, the columns' names under it ("Time (sec)", "Abs"), the data, then
     each trace's details (its collection time, its wavelength) under its name. Read with
     textdata.js (the encoding, the separator, the decimal mark and the quotes found from
     the file), as DRS reads its own. Each pair is a trace in the trace list, named as the
     file names it, its File the CSV; its details in its tooltip and the readings' CSV.
   - The injection (suggestInj): the highest local maximum of the trace whose prominence
     is the minimum prominence at least (the user's prototype, after MATLAB's findpeaks:
     each side's valley found by walking down from the peak while the trace falls), as a
     file loads and as Suggest is pressed (every trace). A click on the Analysis card's
     plot sets the trace's at the point nearest in time, at once; there is no status of
     it (suggested, set by hand) to keep.
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
========================================================= */

/* ---- Reading a file (pure: the module's, for every instance; no DOM) ---- */
// A line's fields up to the last that is not empty (a trailing separator adds none).
const width = r =>{ let n = r.length; while (n && r[n - 1] === '') n--; return n; };
// A line of data: two numbers at least, and nothing but numbers and empty cells (a trace
// shorter than the others leaves its cells empty).
function numRow(r){
  const w = width(r);
  let n = 0;
  for (let i = 0; i < w; i++){ if (r[i] === '') continue; if (!isNum(r[i])) return false; n++; }
  return n >= 2;
}
// A time's unit to seconds (the Cary writes "Time (sec)", or "Time (min)" in minutes).
const toSec = unit => /^min/i.test(unit) ? 60 : /^ms(ec)?$/i.test(unit) ? 1e-3 : 1;
/* A kinetics file: under each separator (textdata SEPS) its first run of lines of data;
   the file's separator the one whose run holds the most numbers (on a tie the first of
   SEPS). The line just over the data names the columns when its first field is a time
   ("Time (sec)"; its unit read), and the one over that names the traces, one over each
   pair (blank1,,Blank2,,…); without the columns' line, the line over the data names
   them. Each pair (time, absorbance) of columns is a trace of the points where both are
   numbers (three at least), in the order of time; its name is the one over the pair,
   else none (''). After the data, a line holding a trace's name alone opens its details:
   "Collection Time: …", "Wavelength (nm)  350.0" (or "<Current Wavelength> , 350.0").
   → { traces: [{ name, t, A (fixed), wl (nm, NaN when not said), collected }] (by pair,
   null for a pair not read), n (pairs) } or { error }. */
export function readKinetics(text){
  const lines = textLines(text);
  let best = null;
  for (const sep of SEPS){
    const rows = lines.map(l=> splitFields(l, sep)), a = rows.findIndex(numRow);
    if (a < 0) continue;
    let b = a, n = 0, score = 0;
    for (; b < rows.length && numRow(rows[b]); b++){ n = Math.max(n, width(rows[b])); score += rows[b].filter(isNum).length; }
    if (n >= 2 && (!best || score > best.score)) best = { sep, rows, a, b, n, score };
  }
  if (!best) return { error: 'no columns of time and absorbance found' };
  const { sep, rows, a, b, n } = best;
  const text0 = r => r && r.some(c=> c !== '' && !isNum(c));
  let cols = a > 0 && text0(rows[a - 1]) ? rows[a - 1] : null, titles = null;
  if (cols && /time/i.test(cols[0] || '')) titles = a > 1 && text0(rows[a - 2]) ? rows[a - 2] : null;
  else { titles = cols; cols = null; }
  const pairs = Math.floor(n / 2), traces = [];
  for (let k = 0; k < pairs; k++){
    const f = cols ? toSec(nameUnit(cols[2*k] || '').unit) : 1, pts = [];
    for (let i = a; i < b; i++){
      const t = parseNum(rows[i][2*k]), A = parseNum(rows[i][2*k + 1]);
      if (Number.isFinite(t) && Number.isFinite(A)) pts.push([t*f, A]);
    }
    if (pts.length < 3){ traces.push(null); continue; }
    if (pts.some((p, i)=> i && p[0] < pts[i - 1][0])) pts.sort((p, q)=> p[0] - q[0]);
    const name = titles ? (titles[2*k] || titles[2*k + 1] || '').trim() : '';
    traces.push({ name, t: fixed(pts.map(p=> p[0])), A: fixed(pts.map(p=> p[1])), wl: NaN, collected: '' });
  }
  if (!traces.some(Boolean)) return { error: 'no pair of columns (time, absorbance) with three points or more' };
  // The details, trace by trace, under each one's name (said twice by the Cary: "blank1," then "blank1").
  let cur = null, fresh = false;
  for (let i = b; i < lines.length; i++){
    const l = lines[i].trim(), fs = splitFields(l, sep), f0 = (fs[0] || '').trim();
    if (f0 && width(fs) === 1){
      if (cur && fresh && cur.name === f0) continue;
      const next = traces.find(tr=> tr && tr.name === f0 && !tr.met);
      if (next){ cur = next; cur.met = true; fresh = true; continue; }
    }
    if (!cur) continue;
    let m;
    if ((m = /^Collection Time:\s*(.+)$/i.exec(l))){ cur.collected = m[1].trim(); fresh = false; }
    else if ((m = /^Wavelength\s*\(nm\)\s+([-+]?[\d.,]+)/i.exec(l))){ cur.wl = parseNum(m[1]); fresh = false; }
    else if ((m = /^<Current Wavelength>\s*[,;\t]?\s*([-+]?[\d.,]+)/i.exec(l))){ if (!Number.isFinite(cur.wl)) cur.wl = parseNum(m[1]); fresh = false; }
  }
  traces.forEach(tr=>{ if (tr) delete tr.met; });
  return { traces, n: pairs };
}

/* A file's traces, read from its bytes, which are all a project keeps of it: kept by those
   bytes (the same array in a tab's states, its records and another tab holding the file),
   so that an undo, a wake or a project opened reads it once. */
const tables = new WeakMap();
function tableOf(f){
  const b = f && f.rawBytes;
  if (!(b instanceof Uint8Array)) return null;
  if (!tables.has(b)){ let t = null; try { t = readKinetics(decodeText(b)); } catch(e){ t = null; } tables.set(b, t && !t.error ? t : null); }
  return tables.get(b);
}
const traceOf = f =>{ const t = tableOf(f); return t && Number.isInteger(f.k) && t.traces[f.k] || null; };

/* ---- The injection: the prototype's findpeaks (myFindPeaks) and its choice (autoPeak) ---- */
function findPeaks(y, mp){
  const locs = [];
  for (let i = 1; i < y.length - 1; i++){
    if (!(y[i] > y[i - 1] && y[i] > y[i + 1])) continue;
    let left = y[i - 1], right = y[i + 1];
    for (let l = i - 1; l >= 1; l--){ if (y[l] < y[l - 1]) left = y[l]; else break; }
    for (let r = i + 1; r <= y.length - 2; r++){ if (y[r] < y[r + 1]) right = y[r]; else break; }
    if (y[i] - Math.max(left, right) >= mp) locs.push(i);
  }
  return locs;
}
// The suggested injection's time: the highest peak of a prominence `mp` at least (the first of equals), or null.
function suggestInj(tr, mp){
  if (!tr) return null;
  let best = -1;
  for (const i of findPeaks(tr.A, mp)) if (best < 0 || tr.A[i] > tr.A[best]) best = i;
  return best < 0 ? null : tr.t[best];
}
// The point of `t` (ascending) nearest in time to v.
function nearestIdx(t, v){
  let lo = 0, hi = t.length - 1;
  while (hi - lo > 1){ const m = (lo + hi) >> 1; if (t[m] <= v) lo = m; else hi = m; }
  return Math.abs(t[hi] - v) < Math.abs(t[lo] - v) ? hi : lo;
}

/* ---- The alignment (the prototype's shift_data): time from the injection, absorbance less
   its least from the injection on. Kept by the trace's absorbances (utils.js keeper) under
   the injection: a tab woken, an undo, a redraw and the CSVs take it as made. ---- */
const alignKept = keeper('iodo-align', 8);
function alignOf(tr, inj){
  if (!tr || !Number.isFinite(inj)) return null;
  return alignKept(tr.A, exactKey([objId(tr.t), inj]), ()=>{
    const i0 = nearestIdx(tr.t, inj), t0 = tr.t[i0];
    let min = Infinity;
    for (let i = i0; i < tr.A.length; i++) if (tr.A[i] < min) min = tr.A[i];
    return { i0, t0, min, xs: tr.t.map(v=> v - t0), ys: tr.A.map(v=> v - min) };
  });
}
// The aligned absorbance at time T from the injection, linearly interpolated (NaN past the trace's end).
function readAt(al, T){
  if (!al || !(T >= 0)) return NaN;
  const { xs, ys } = al, n = xs.length;
  if (T > xs[n - 1]) return NaN;
  let lo = al.i0, hi = n - 1;
  if (lo === hi) return ys[lo];
  while (hi - lo > 1){ const m = (lo + hi) >> 1; if (xs[m] <= T) lo = m; else hi = m; }
  return ys[lo] + (ys[hi] - ys[lo]) * (T - xs[lo]) / (xs[hi] - xs[lo]);
}

/* ---- The calibration: A = slope × c + intercept, typed in or fitted (least squares, A on c)
   to the standards; c = (A − intercept) / slope. None: the readings are absorbances. ---- */
const CAL_MODES = { none: 'None (absorbances)', line: 'Slope and intercept', std: 'Standards (least squares)' };
const calDefault = ()=> ({ mode: 'none', slope: null, intercept: null, stds: [], unit: '' });
const numOrNull = v => Number.isFinite(v) ? v : null;
function calIn(v){
  const c = calDefault();
  if (!isObj(v)) return c;
  c.mode = Object.prototype.hasOwnProperty.call(CAL_MODES, v.mode) ? v.mode : 'none';
  c.slope = numOrNull(v.slope); c.intercept = numOrNull(v.intercept);
  c.stds = Array.isArray(v.stds) ? v.stds.filter(p=> Array.isArray(p) && p.length === 2).map(p=> [numOrNull(p[0]), numOrNull(p[1])]) : [];
  c.unit = typeof v.unit === 'string' ? v.unit.slice(0, 40) : '';
  return c;
}
const calCopy = c => ({ ...c, stds: c.stds.map(p=> p.slice()) });
// The standards that count: both numbers given.
const stdsOf = c => c.stds.filter(p=> Number.isFinite(p[0]) && Number.isFinite(p[1]));
/* The line a calibration gives, { m, q, r2 (NaN when typed), n }, or null (none, or not one:
   a slope of 0, fewer than two standards of different concentrations). */
function calLine(c){
  if (c.mode === 'line') return Number.isFinite(c.slope) && c.slope !== 0 && Number.isFinite(c.intercept) ? { m: c.slope, q: c.intercept, r2: NaN, n: 0 } : null;
  if (c.mode !== 'std') return null;
  const s = stdsOf(c);
  if (s.length < 2 || new Set(s.map(p=> p[0])).size < 2) return null;
  const r = fitLinear(s.map(p=> p[0]), s.map(p=> p[1]));
  return Number.isFinite(r.slope) && r.slope !== 0 && Number.isFinite(r.intercept) ? { m: r.slope, q: r.intercept, r2: r.R2, n: s.length } : null;
}
const concName = c => c.unit.trim() ? `Concentration (${c.unit.trim()})` : 'Concentration';

/* ---- Numbers as the page writes them, and as a CSV does (12 digits, the Settings' decimal mark) ---- */
const sig = (v, d = 4)=> Number.isFinite(v) ? String(+v.toPrecision(d)) : 'n/a';
const fix = (v, d)=> Number.isFinite(v) ? v.toFixed(d) : 'n/a';
const csvNum = v => Number.isFinite(v) ? String(+v.toPrecision(12)).replace('.', settings.decimal) : '';
// A field's number, either decimal mark; '' none (null); anything else not one (undefined).
const NUM_RE = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?$/;
const fieldNum = s =>{ s = String(s).trim(); return !s ? null : NUM_RE.test(s) && Number.isFinite(parseNum(s)) ? parseNum(s) : undefined; };

// The marks of the Analysis card's plot.
const INJ_COLOR = '#ffd24a', BG_COLOR = '#93a0b0', READ_COLOR = '#ff5050';
const DEF = { tRead: 240, minProm: 0.01 };

// An Iodometry tab's instance (utils.js makeInstance: ctx { key, root, layer, shown }).
function createIodo({ key, root, layer, shown }){
  const $ = id => root.querySelector('#' + id);
  let stale = false, drawnAt = '';
  const drawable = ()=> shown() || !(stale = true);
  // The module's own state: the reading time (s), the injection search's minimum prominence, the calibration.
  let tRead = DEF.tRead, minProm = DEF.minProm, cal = calDefault();
  let curName = null, traceNext = null;   // the trace on show (a view), and a wake's (showNext)

  const kit = moduleKit('iodo', {
    root, key, layer,
    alerts: p =>{ $('iodoAlerts').innerHTML = p.invalid + p.upload; },
    refresh: afterFilesChange,
    redraw: ()=> drawAll(true),
    cleared: ()=>{ curName = null; },
    tip: f => tipOf(f),
    snapshot: ()=> ({ tRead, minProm, cal: calCopy(cal) }),
    // A trace as a restore takes it: its file read from its bytes and its pair there (none: left out).
    file: f =>{
      if (!traceOf(f)) return null;
      return { ...f, inj: Number.isFinite(f.inj) ? f.inj : null };
    },
    restore: s =>{
      tRead = num(s.tRead, DEF.tRead, v=> v > 0);
      minProm = num(s.minProm, DEF.minProm, v=> v >= 0);
      cal = calIn(s.cal);
      if (traceNext){ if (allFiles.some(f=> f.name === traceNext)) curName = traceNext; traceNext = null; }
      closeCal(false);
    },
    redrawTab: ()=>{
      const at = String(root.clientWidth);
      if (!stale && at === drawnAt) return;
      stale = false; drawnAt = at;
      if (files.length) drawAll(true);
    },
    csv: ()=> files.length ? [{ name: 'aligned.csv', text: alignedCsv() }, { name: 'readings.csv', text: readingsCsv() }] : [],
  });
  const { all: allFiles, files } = kit;

  /* ---- Files dropped: each read (readKinetics), each pair of columns a trace, its injection
     suggested; a file already loaded (by its name) said, not loaded again. ---- */
  setupDropzone($('iodoDropzone'), $('iodoFiles'), async list =>{
    const names = new Set(allFiles.map(f=> f.src || f.name)), bad = [], dup = [];
    for (const file of list){
      if (names.has(file.name)){ dup.push(file.name); continue; }
      names.add(file.name);
      const rawBytes = new Uint8Array(await file.arrayBuffer());
      let t = null;
      try { t = readKinetics(decodeText(rawBytes)); } catch(e){ t = null; }
      if (!t || t.error){ bad.push(t ? `${file.name} (${t.error})` : file.name); continue; }
      tables.set(rawBytes, t);
      const base = file.name.replace(/\.[^.]+$/, '');
      t.traces.forEach((tr, k)=>{
        if (!tr) return;
        kit.add({ name: `${file.name} (${k + 1})`, src: file.name, label: tr.name || (t.n > 1 ? `${base} (${k + 1})` : base), color: nextColor(allFiles), rawBytes, k, inj: suggestInj(tr, minProm) });
      });
    }
    kit.said(bad, dup);
    afterFilesChange();
  });

  function afterFilesChange(){
    kit.showFiles();
    $('iodoAnalysis').style.display = files.length ? '' : 'none';
    $('iodoResults').style.display = files.length ? '' : 'none';
    drawAll(true);
    kit.commit();
  }

  // A trace's details, its tooltip in the trace list.
  function tipOf(f){
    const tr = traceOf(f);
    if (!tr) return '';
    return [Number.isFinite(tr.wl) ? `Wavelength: ${tr.wl} nm` : '', tr.collected ? `Collection time: ${tr.collected}` : '', `File: ${f.src || f.name}`].filter(Boolean).join('\n');
  }

  /* ---- The trace on show (a view: no step, kept as the tab sleeps: shows) ---- */
  const curFile = ()=> files.find(f=> f.name === curName) || files[0] || null;
  function step(d){
    const n = files.length, f = curFile();
    if (!n || !f) return;
    curName = files[(files.indexOf(f) + d + n) % n].name;
    paintAnalysis(); drawAnalysis(false);
  }
  $('iodoPrev').addEventListener('click', ()=> step(-1));
  $('iodoNext').addEventListener('click', ()=> step(1));

  /* ---- A trace's results: its alignment, its reading (the aligned absorbance at the reading
     time) and, calibrated, its concentration ---- */
  function resultOf(f){
    const tr = traceOf(f), al = alignOf(tr, f.inj), A = readAt(al, tRead), L = calLine(cal);
    return { f, tr, al, A, c: L && Number.isFinite(A) ? (A - L.q) / L.m : NaN };
  }

  /* ---- The parameters: confirmed (Enter, or the field left), a number in range; else the field
     shakes and shows the value it had ---- */
  function takeField(el, ok, set, now){
    const v = fieldNum(el.value);
    if (v == null || !ok(v)){ flashFieldInvalid(el); el.value = String(now); return; }
    el.value = String(v);
    if (Object.is(v, now)) return;
    set(v);
    drawAll(true); kit.commit();
  }
  $('iodoTRead').addEventListener('change', e=> takeField(e.target, v=> v > 0, v=>{ tRead = v; }, tRead));
  $('iodoProm').addEventListener('change', e=> takeField(e.target, v=> v >= 0, v=>{ minProm = v; }, minProm));
  root.querySelectorAll('#iodoTRead, #iodoProm').forEach(el=> el.addEventListener('keydown', e=>{ if (e.key === 'Enter') e.target.blur(); }));
  // Suggest: every trace's injection found again (the minimum prominence as it is).
  $('iodoSuggest').addEventListener('click', ()=>{
    let moved = false;
    allFiles.forEach(f=>{ const v = suggestInj(traceOf(f), minProm); if (!Object.is(v, f.inj)){ f.inj = v; moved = true; } });
    if (moved){ drawAll(true); kit.commit(); }
  });
  $('iodoCalBtn').addEventListener('click', ()=> openCal());

  /* ---- The Analysis card: the trace on show, its injection, background and reading ---- */
  function paintAnalysis(){
    const f = curFile();
    $('iodoTRead').value = String(tRead);
    $('iodoProm').value = String(minProm);
    const L = calLine(cal);
    $('iodoCalSum').innerHTML = cal.mode === 'none' ? 'Calibration: <b>none</b>'
      : !L ? 'Calibration: <b>incomplete</b>, not used'
      : `Calibration: <b>A = ${esc(sig(L.m))} × c ${L.q < 0 ? '−' : '+'} ${esc(sig(Math.abs(L.q)))}</b>${Number.isFinite(L.r2) ? `, R² = <b>${esc(L.r2.toFixed(4))}</b>` : ''}${cal.unit.trim() ? `, c in <b>${esc(cal.unit.trim())}</b>` : ''}`;
    if (!f) return;
    const i = files.indexOf(f), r = resultOf(f);
    $('iodoIdx').textContent = `${i + 1}/${files.length}`;
    $('iodoCurrentLabel').textContent = f.label;
    $('iodoCurrentLabel').title = tipOf(f);
    $('iodoInj').textContent = r.al ? `${fix(r.al.t0, 2)} s` : 'none: click the plot';
    $('iodoBg').textContent = r.al ? fix(r.al.min, 4) : 'n/a';
    $('iodoA').textContent = r.al ? (Number.isFinite(r.A) ? fix(r.A, 4) : `n/a (the trace ends ${fix(r.al.xs[r.al.xs.length - 1], 1)} s after the injection)`) : 'n/a';
    $('iodoATitle').textContent = `Absorbance at ${tRead} s:`;
    $('iodoCRow').style.display = L ? '' : 'none';
    $('iodoC').textContent = Number.isFinite(r.c) ? `${sig(r.c)}${cal.unit.trim() ? ' ' + cal.unit.trim() : ''}` : 'n/a';
  }
  function drawAnalysis(preserve){
    const f = curFile(), svg = $('iodoSvg');
    if (!f || !drawable()) return;
    const { tr, al, A } = resultOf(f);
    if (!tr) return;
    const prev = preserve ? viewOf(svg._plot) : null;
    let lo = Infinity, hi = -Infinity;
    for (const v of tr.A){ if (v < lo) lo = v; if (v > hi) hi = v; }
    const pad = (hi - lo) * 0.05 || 0.01, t1 = tr.t[tr.t.length - 1];
    const plot = new Plot(svg, { xlabel: 'Time (s)', ylabel: 'Absorbance' });
    plot.setRange(tr.t[0], t1, lo - pad, hi + pad);
    setView(plot, prev, f.name);
    plot.drawAxes();
    plot.line(tr.t, tr.A, f.color, 1.5, undefined, { label: f.label, key: f.name });
    const items = [[f.color, esc(f.label)]];
    if (al){
      plot.line([al.t0, t1], [al.min, al.min], BG_COLOR, 1.2, '5,4', { label: 'background', key: 'background' });
      mark(plot, al.t0, tr.A[al.i0], INJ_COLOR, 'injection');
      items.push([INJ_COLOR, 'injection'], [BG_COLOR, 'background']);
      if (Number.isFinite(A)){ mark(plot, al.t0 + tRead, al.min + A, READ_COLOR, 'reading'); items.push([READ_COLOR, `reading (${tRead} s after)`]); }
    }
    plot.attachTools(svg.closest('.plot-wrap'));
    $('iodoLegend').innerHTML = items.map(([c, t])=> `<span><i style="background:${esc(c)}"></i>${t}</span>`).join('');
    $('iodoNone').style.display = al ? 'none' : '';
  }
  // A point marked on a plot, named (the composer's series).
  function mark(plot, x, y, color, label){
    plot.points([x], [y], color, 5);
    plot._stored[plot._stored.length - 1].label = label;
  }

  /* The plot clicked (no pan or zoom tool on): the trace's injection at the point nearest in
     time, at once. Over the plot a guide shows that point and its values (the plot's own
     read-out of the pointer left out). */
  const svgA = $('iodoSvg');
  svgA._suppressReadout = true;
  const clearGuide = ()=> svgA.querySelectorAll('.iodo-guide').forEach(e=> e.remove());
  // The point under the pointer, its index in the trace on show; -1 off the data's area.
  function pointAt(e){
    const P = svgA._plot, f = curFile(), tr = f && traceOf(f);
    if (!P || !tr || P._mode) return -1;
    const r = svgA.getBoundingClientRect(), { w, h } = P.size(), m = P.margin, cx = e.clientX - r.left, cy = e.clientY - r.top;
    if (cx < m.l || cx > w - m.r || cy < m.t || cy > h - m.b) return -1;
    return nearestIdx(tr.t, P.invX(cx));
  }
  svgA.addEventListener('pointermove', e=>{
    clearGuide();
    const i = pointAt(e), P = svgA._plot, f = curFile();
    if (i < 0) return;
    const tr = traceOf(f), m = P.margin, { w, h } = P.size(), x = P.px(tr.t[i]), y = P.py(tr.A[i]);
    const at = { 'pointer-events': 'none', class: 'iodo-guide' };
    svgA.appendChild(svgEl('line', { x1: x, x2: x, y1: m.t, y2: h - m.b, stroke: INJ_COLOR, 'stroke-width': 1.2, 'stroke-dasharray': '4,3', ...at }));
    svgA.appendChild(svgEl('circle', { cx: x, cy: y, r: 3.5, fill: INJ_COLOR, ...at }));
    const fmt = v =>{ const a = Math.abs(v); return a >= 1000 ? v.toFixed(0) : a >= 1 ? v.toFixed(3) : v.toPrecision(3); };
    const flip = x > w - m.r - 150, tx = x + (flip ? -8 : 8);
    const t = svgEl('text', { x: tx, y: m.t + 14, 'font-size': 12, fill: INJ_COLOR, stroke: '#0b0f12', 'stroke-width': 3.5, 'paint-order': 'stroke', 'font-family': 'monospace', 'text-anchor': flip ? 'end' : 'start', ...at });
    const l1 = svgEl('tspan', { x: tx }), l2 = svgEl('tspan', { x: tx, dy: 16 });
    l1.textContent = axisReadout('Time (s)', tr.t[i], fmt); l2.textContent = axisReadout('Absorbance', tr.A[i], fmt);
    t.append(l1, l2);
    svgA.appendChild(t);
  });
  svgA.addEventListener('pointerleave', clearGuide);
  svgA.addEventListener('click', e=>{
    const i = pointAt(e), f = curFile();
    if (i < 0) return;
    const v = traceOf(f).t[i];
    if (Object.is(v, f.inj)) return;
    f.inj = v;
    drawAll(true); kit.commit();
  });

  /* ---- The Results card: the traces aligned, overlaid, and the readings ---- */
  function drawResults(preserve){
    if (!drawable()) return;
    const list = files.map(resultOf), al = list.filter(r=> r.al);
    // The aligned traces, the reading time marked.
    const svg = $('iodoAlignSvg'), prev = preserve ? viewOf(svg._plot) : null;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    al.forEach(r=>{ x0 = Math.min(x0, r.al.xs[0]); x1 = Math.max(x1, r.al.xs[r.al.xs.length - 1]); for (const v of r.al.ys){ if (v < y0) y0 = v; if (v > y1) y1 = v; } });
    if (!al.length){ x0 = 0; x1 = tRead * 1.25; y0 = 0; y1 = 1; }
    const pad = (y1 - y0) * 0.05 || 0.01;
    const plot = new Plot(svg, { xlabel: 'Time from injection (s)', ylabel: 'Absorbance − background' });
    plot.setRange(Math.min(x0, 0), Math.max(x1, tRead), y0 - pad, y1 + pad);
    setView(plot, prev, viewKey(al.map(r=> r.f)));
    plot.drawAxes();
    plot.vline(tRead, READ_COLOR);
    al.forEach(r=> plot.line(r.al.xs, r.al.ys, r.f.color, 1.5, undefined, { label: r.f.label, key: r.f.name }));
    plot.attachTools(svg.closest('.plot-wrap'));
    $('iodoAlignLegend').innerHTML = swatchLegend(al.map(r=> r.f));
    $('iodoAlignNote').textContent = list.length > al.length ? `${list.length - al.length} trace${list.length - al.length > 1 ? 's' : ''} with no injection set, not shown.` : '';
    drawReadings(list);
  }
  /* The readings: one point a trace included, in the list's order, its name under the axis
     (cut and tilted to fit, utils barNames) and its value over it; the concentrations with
     a calibration, else the absorbances. */
  function drawReadings(list){
    const svg = $('iodoReadSvg'), L = calLine(cal), vals = list.map(r=> L ? r.c : r.A), n = list.length;
    $('iodoReadCap').textContent = L ? `${concName(cal)} at ${tRead} s` : `Absorbance − background at ${tRead} s`;
    const mctx = document.createElement('canvas').getContext('2d');
    mctx.font = "10px 'Inter', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
    const rect = svg.getBoundingClientRect(), W = rect.width || 640, H = rect.height || 420;
    const has = vals.map(Number.isFinite), fit = barNames(mctx, list.map(r=> r.f.label), Math.max(60, W - 75), 55, has);
    let maxLbl = 0, maxVal = 0;
    fit.labels.forEach((l, k)=>{ if (has[k]){ maxLbl = Math.max(maxLbl, mctx.measureText(l).width); maxVal = Math.max(maxVal, mctx.measureText(sig(vals[k])).width); } });
    const bottom = Math.round(26 + maxLbl * fit.sin), ok = vals.filter(Number.isFinite);
    let lo = Math.min(0, ...ok), hi = Math.max(0, ...ok);
    if (hi === lo) hi = lo + 1;
    // (room over the highest point for its value, upright)
    const plotH = H - 15 - bottom, reserve = 14 + maxVal, frac = plotH > reserve ? 1 - reserve / plotH : 0.5;
    const yLo = lo < 0 ? lo - 0.08 * (hi - lo) : 0, yHi = yLo + (hi - yLo) / frac;
    const plot = new Plot(svg, { xlabel: '', ylabel: L ? concName(cal) : 'Absorbance − background', noXTickLabels: true, noXGrid: true, yGrid: true, margin: { l: 55, r: 20, t: 15, b: bottom } });
    plot.setRange(0, n + 1, yLo, yHi);
    plot.drawAxes();
    list.forEach((r, k)=>{
      if (has[k]){ mark(plot, k + 1, vals[k], r.f.color, r.f.label); plot.barLabel(k + 1, vals[k], sig(vals[k]), { gap: 8 }); }
      plot.tickLabel(k + 1, fit.labels[k], fit.rot, r.f.label, r.f.name);
    });
    plot.attachTools(svg.closest('.plot-wrap'));
  }

  // Every card drawn (as it is shown, when hidden).
  function drawAll(preserve){
    paintAnalysis();
    if (!files.length || !drawable()) return;
    drawAnalysis(preserve);
    drawResults(preserve);
    stale = false; drawnAt = String(root.clientWidth);
  }

  /* ---- The CSVs: the traces aligned, and the readings, each trace's details with them ---- */
  const wlOf = r => r.tr && Number.isFinite(r.tr.wl) ? r.tr.wl : NaN;
  function alignedCsv(){
    const cols = [];
    files.map(resultOf).filter(r=> r.al).forEach(r=>{
      const wl = wlOf(r);
      cols.push({ h: `${r.f.label} - time from injection (s)`, v: r.al.xs.map(csvNum) },
        { h: `${r.f.label} - absorbance${Number.isFinite(wl) ? ` at ${wl} nm` : ''} - background`, v: r.al.ys.map(csvNum) });
    });
    return cols.length ? wideCsv(cols) : csvLine(['No trace with an injection set']);
  }
  function readingsCsv(){
    const L = calLine(cal);
    let t = csvLine(['Trace', 'File', 'Wavelength (nm)', 'Collection time', 'Injection time (s)', 'Background absorbance', 'Reading time (s)', 'Absorbance - background', ...(L ? [concName(cal)] : [])]);
    for (const r of files.map(resultOf)){
      t += csvLine([r.f.label, r.f.src || r.f.name, csvNum(wlOf(r)), r.tr ? r.tr.collected : '', csvNum(r.al ? r.al.t0 : NaN), csvNum(r.al ? r.al.min : NaN), csvNum(tRead), csvNum(r.A), ...(L ? [csvNum(r.c)] : [])]);
    }
    return t;
  }

  /* ---- The calibration's window (as XRPD's standard's: a head with its ×, what is under it
     scrolling): the way (none, the line typed, the standards fitted), the unit, the line or
     the standards, the fit shown as they are typed. Apply takes it, a step; Cancel, ×,
     Escape or a click beside it, nothing. ---- */
  const calEl = document.createElement('div');
  calEl.className = 'modal-backdrop iodo-cal';
  calEl.style.display = 'none';
  calEl.innerHTML = `
    <div class="iodo-cal-box" role="dialog" aria-modal="true" aria-label="Calibration" tabindex="-1">
      <div class="iodo-cal-head"><h3 class="txt-head">Calibration</h3><button type="button" class="an-ic iodo-cal-x" title="Close" aria-label="Close">${X_SVG(15)}</button></div>
      <div class="iodo-cal-scroll">
        <p class="txt-meta iodo-cal-about">The line <b>A = slope × c + intercept</b> turns each reading, the absorbance A at the reading time, into a concentration <b>c = (A − intercept) / slope</b>, in the unit typed here. Type the line's slope and intercept, or the standards (their concentration and the absorbance read for them at the same reading time), fitted by least squares; both are kept, the one chosen used.</p>
        <div class="param-grid">
          <label class="txt-label" for="iodoCalMode">Calibration</label>
          <select class="pg-field" id="iodoCalMode">${Object.entries(CAL_MODES).map(([k, l])=> `<option value="${k}">${l}</option>`).join('')}</select>
          <label class="txt-label" for="iodoCalUnit">Concentration unit</label>
          <input type="text" class="pg-field" id="iodoCalUnit" placeholder="e.g. µM" maxlength="40" autocomplete="off" spellcheck="false">
        </div>
        <div class="param-grid iodo-cal-line">
          <label class="txt-label" for="iodoCalSlope">Slope (absorbance per unit)</label>
          <input type="text" inputmode="decimal" class="pg-field" id="iodoCalSlope" autocomplete="off">
          <label class="txt-label" for="iodoCalIcpt">Intercept (absorbance)</label>
          <input type="text" inputmode="decimal" class="pg-field" id="iodoCalIcpt" autocomplete="off">
        </div>
        <div class="iodo-cal-std">
          <table class="iodo-std"><thead><tr><th>Concentration</th><th>Absorbance</th><th></th></tr></thead><tbody></tbody></table>
          <button type="button" class="btn btn-sm" data-add-std>+ Standard</button>
          <div class="iodo-cal-fit"></div>
        </div>
        <div class="iodo-cal-msg" role="status"></div>
      </div>
      <div class="dt-modal-foot iodo-cal-foot"><button type="button" class="btn" data-cancel>Cancel</button><button type="button" class="btn primary" data-apply>Apply</button></div>
    </div>`;
  layer.appendChild(calEl);
  const cq = s => calEl.querySelector(s), stdBody = cq('.iodo-std tbody');
  let draft = null, calFrom = null;
  function openCal(){
    if (draft) return;
    draft = calCopy(cal);
    if (!draft.stds.length) draft.stds = [[null, null], [null, null], [null, null]];
    calFrom = document.activeElement;
    cq('#iodoCalMode').value = draft.mode;
    cq('#iodoCalUnit').value = draft.unit;
    cq('#iodoCalSlope').value = draft.slope == null ? '' : String(draft.slope);
    cq('#iodoCalIcpt').value = draft.intercept == null ? '' : String(draft.intercept);
    drawStds();
    calEl.style.display = 'flex';
    document.addEventListener('keydown', onCalKey);
    cq('.iodo-cal-box').focus();
  }
  function drawStds(){
    stdBody.innerHTML = draft.stds.map((p, i)=> `<tr data-i="${i}"><td><input type="text" inputmode="decimal" data-j="0" aria-label="Concentration of standard ${i + 1}" value="${p[0] == null ? '' : esc(String(p[0]))}" autocomplete="off"></td>`
      + `<td><input type="text" inputmode="decimal" data-j="1" aria-label="Absorbance of standard ${i + 1}" value="${p[1] == null ? '' : esc(String(p[1]))}" autocomplete="off"></td>`
      + `<td><button type="button" class="an-ic" data-del title="Remove this standard" aria-label="Remove standard ${i + 1}">${X_SVG(13)}</button></td></tr>`).join('');
    sync();
  }
  // The draft read from the window's fields; a field that holds no number named in `bad`.
  function readDraft(){
    const bad = [];
    const take = (el, name)=>{ const v = fieldNum(el.value); if (v === undefined){ bad.push([el, name]); return null; } return v; };
    draft.mode = Object.prototype.hasOwnProperty.call(CAL_MODES, cq('#iodoCalMode').value) ? cq('#iodoCalMode').value : 'none';
    draft.unit = cq('#iodoCalUnit').value;
    draft.slope = take(cq('#iodoCalSlope'), 'the slope');
    draft.intercept = take(cq('#iodoCalIcpt'), 'the intercept');
    stdBody.querySelectorAll('tr[data-i]').forEach(tr=>{
      const i = +tr.dataset.i;
      draft.stds[i] = [0, 1].map(j=> take(tr.querySelector(`input[data-j="${j}"]`), `standard ${i + 1}`));
    });
    return bad.filter(([, n])=> draft.mode === 'line' ? !n.startsWith('standard') : draft.mode === 'std' ? n.startsWith('standard') : false);
  }
  // What the draft gives, said under the fields; Apply only for a calibration that is one.
  function sync(){
    const bad = readDraft(), L = calLine(draft);
    cq('.iodo-cal-line').style.display = draft.mode === 'line' ? '' : 'none';
    cq('.iodo-cal-std').style.display = draft.mode === 'std' ? '' : 'none';
    const n = stdsOf(draft).length;
    cq('.iodo-cal-fit').innerHTML = draft.mode !== 'std' ? '' : L
      ? `Fit of ${L.n} standards: slope <b>${esc(sig(L.m, 6))}</b>, intercept <b>${esc(sig(L.q, 6))}</b>, R² = <b>${esc(L.r2.toFixed(4))}</b>`
      : `${n} standard${n === 1 ? '' : 's'} with both values: two of different concentrations at least are needed.`;
    const msg = bad.length ? `Not a number: ${[...new Set(bad.map(b=> b[1]))].join(', ')}.`
      : draft.mode === 'line' && !L ? 'A slope (not 0) and an intercept are needed.' : '';
    cq('.iodo-cal-msg').textContent = msg;
    // (too few standards: said by the fit's line)
    cq('[data-apply]').disabled = !!msg || (draft.mode !== 'none' && !L);
  }
  function closeCal(apply){
    if (!draft) return;
    const d = draft;
    draft = null;
    calEl.style.display = 'none';
    document.removeEventListener('keydown', onCalKey);
    if (calFrom && calFrom.isConnected) calFrom.focus();
    calFrom = null;
    if (!apply) return;
    d.stds = d.stds.filter(p=> p[0] != null || p[1] != null);
    d.unit = d.unit.trim();
    if (JSON.stringify(d) === JSON.stringify(cal)) return;
    cal = d;
    drawAll(true); kit.commit();
  }
  // (its tab on show: an Escape in another tab is that tab's)
  function onCalKey(e){ if (e.key === 'Escape' && shown()){ e.stopPropagation(); closeCal(false); } }
  calEl.addEventListener('input', ()=> sync());
  calEl.addEventListener('change', e=>{ if (e.target.id === 'iodoCalMode') sync(); });
  calEl.addEventListener('keydown', e=>{ if (e.key === 'Enter' && e.target.matches('input') && !cq('[data-apply]').disabled){ e.preventDefault(); closeCal(true); } });
  calEl.addEventListener('click', e=>{
    if (e.target === calEl || e.target.closest('[data-cancel], .iodo-cal-x')){ closeCal(false); return; }
    if (e.target.closest('[data-apply]')){ if (!readDraft().length) closeCal(true); return; }
    if (e.target.closest('[data-add-std]')){ readDraft(); draft.stds.push([null, null]); drawStds(); stdBody.querySelector('tr:last-child input').focus(); return; }
    const del = e.target.closest('[data-del]');
    if (del){ readDraft(); draft.stds.splice(+del.closest('tr').dataset.i, 1); drawStds(); }
  });

  paintAnalysis();
  return {
    // The trace on show: kept as the tab sleeps and in its record (tabs.js).
    shows(){ const f = curFile(); return f && files.length > 1 && f !== files[0] ? { trace: f.name } : null; },
    showNext(v){ traceNext = isObj(v) && typeof v.trace === 'string' ? v.trace : null; },
    destroy(){ closeCal(false); calEl.remove(); kit.destroy(); },
  };
}
registerModule('iodo', createIodo);
