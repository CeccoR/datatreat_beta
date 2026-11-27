/* =========================================================
   IODOMETRY — what the module works out that touches no page (iodo.js wires it to the drop
   zone, the trace selector, the Analysis and Results cards and the calibration's window;
   tests/iodomodel.test.mjs calls it in Node): a kinetics file read (its columns found, the
   traces' names and units, each trace's details) and kept by its bytes; the injection
   suggested (the prototype's findpeaks), the point nearest in time; the alignment and the
   reading at the reading time; the calibration (read back, its line typed or fitted, the
   window's draft, its words, what Apply takes); a trace's results, its tooltip and the
   Analysis card's read-outs; a trace as a project holds it, the module's state saved and
   read back, what it shows beside it; what the plots draw (their ranges, the readings'
   layout); the CSVs. Taken out of v562's iodo.js (createIodo, one closure of 407 lines,
   and the functions round it) with their operations in their order: the same values to the
   last bit.

   utils.js's and modkit.js's helpers, which need a page to load, are handed in as one
   object, U = { alignKept, objId, exactKey, fitLinear, csvNum, csvLine, wideCsv, barNames,
   num, isObj } (iodo.js U; alignKept: utils.js keeper's for the alignments, 'iodo-align').
========================================================= */
import { decodeText, textLines, splitFields, parseNum, isNum, nameUnit, SEPS } from './textdata.js';
import { fixed } from './db.js';

/* ---- Reading a file (pure: the module's, for every instance; no DOM) ---- */
// A line's fields up to the last that is not empty (a trailing separator adds none).
export const width = r =>{ let n = r.length; while (n && r[n - 1] === '') n--; return n; };
// A line of data: two numbers at least, and nothing but numbers and empty cells (a trace
// shorter than the others leaves its cells empty).
export function numRow(r){
  const w = width(r);
  let n = 0;
  for (let i = 0; i < w; i++){ if (r[i] === '') continue; if (!isNum(r[i])) return false; n++; }
  return n >= 2;
}
// A time's unit to seconds (the Cary writes "Time (sec)", or "Time (min)" in minutes).
export const toSec = unit => /^min/i.test(unit) ? 60 : /^ms(ec)?$/i.test(unit) ? 1e-3 : 1;
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
  const lines = textLines(text), best = bestRun(lines);
  if (!best) return { error: 'no columns of time and absorbance found' };
  const { sep, rows, a, b, n } = best;
  const { cols, titles } = headsOf(rows, a);
  const pairs = Math.floor(n / 2), traces = [];
  for (let k = 0; k < pairs; k++) traces.push(traceAt(rows, a, b, k, cols, titles));
  if (!traces.some(Boolean)) return { error: 'no pair of columns (time, absorbance) with three points or more' };
  readDetails(traces, lines, b, sep);
  traces.forEach(tr=>{ if (tr) delete tr.met; });
  return { traces, n: pairs };
}
// The run of lines of data that holds the most numbers, under each separator: { sep, rows,
// a, b (its first line and the one after its last), n (its widest), score }, or null.
export function bestRun(lines){
  let best = null;
  for (const sep of SEPS){
    const rows = lines.map(l=> splitFields(l, sep)), a = rows.findIndex(numRow);
    if (a < 0) continue;
    let b = a, n = 0, score = 0;
    for (; b < rows.length && numRow(rows[b]); b++){ n = Math.max(n, width(rows[b])); score += rows[b].filter(isNum).length; }
    if (n >= 2 && (!best || score > best.score)) best = { sep, rows, a, b, n, score };
  }
  return best;
}
// The lines over the data that name the columns (when the first is a time) and the traces.
export function headsOf(rows, a){
  const text0 = r => r && r.some(c=> c !== '' && !isNum(c));
  let cols = a > 0 && text0(rows[a - 1]) ? rows[a - 1] : null, titles;
  if (cols && /time/i.test(cols[0] || '')) titles = a > 1 && text0(rows[a - 2]) ? rows[a - 2] : null;
  else { titles = cols; cols = null; }
  return { cols, titles };
}
// The trace of the pair k of columns, or null (fewer than three points).
export function traceAt(rows, a, b, k, cols, titles){
  const f = cols ? toSec(nameUnit(cols[2*k] || '').unit) : 1, pts = [];
  for (let i = a; i < b; i++){
    const t = parseNum(rows[i][2*k]), A = parseNum(rows[i][2*k + 1]);
    if (Number.isFinite(t) && Number.isFinite(A)) pts.push([t*f, A]);
  }
  if (pts.length < 3) return null;
  if (pts.some((p, i)=> i && p[0] < pts[i - 1][0])) pts.sort((p, q)=> p[0] - q[0]);
  const name = titles ? (titles[2*k] || titles[2*k + 1] || '').trim() : '';
  return { name, t: fixed(pts.map(p=> p[0])), A: fixed(pts.map(p=> p[1])), wl: NaN, collected: '' };
}
// The details, trace by trace, under each one's name (said twice by the Cary: "blank1," then
// "blank1"), from the line b on.
export function readDetails(traces, lines, b, sep){
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
}

/* A file's traces, read from its bytes, which are all a project keeps of it: kept by those
   bytes (the same array in a tab's states, its records and another tab holding the file),
   so that an undo, a wake or a project opened reads it once. */
const tables = new WeakMap();
// A file just read (its traces t from its bytes b) kept by them.
export const keepTable = (b, t)=>{ tables.set(b, t); };
export function tableOf(f){
  const b = f && f.rawBytes;
  if (!(b instanceof Uint8Array)) return null;
  if (!tables.has(b)){ let t; try { t = readKinetics(decodeText(b)); } catch(e){ t = null; } tables.set(b, t && !t.error ? t : null); }
  return tables.get(b);
}
export const traceOf = f =>{ const t = tableOf(f); return t && Number.isInteger(f.k) && t.traces[f.k] || null; };
// A file's bytes read: its traces, or null when they cannot be (its reason in `error`).
export function readBytes(rawBytes){
  try { return readKinetics(decodeText(rawBytes)); } catch(e){ return null; }
}
/* The record of a file's trace k (tr) as the trace list holds it: named after the file and
   the pair, labelled as the file names it (else after the file), its injection suggested. */
export function traceRec(name, t, k, tr, rawBytes, color, minProm){
  const base = name.replace(/\.[^.]+$/, '');
  return { name: `${name} (${k + 1})`, src: name, label: tr.name || (t.n > 1 ? `${base} (${k + 1})` : base), color, rawBytes, k, inj: suggestInj(tr, minProm) };
}
// A trace as a restore takes it: its file read from its bytes and its pair there (none: left out).
export function fileIn(f){
  if (!traceOf(f)) return null;
  return { ...f, inj: Number.isFinite(f.inj) ? f.inj : null };
}
// A trace's details, its tooltip in the trace list.
export function tipOf(f){
  const tr = traceOf(f);
  if (!tr) return '';
  return [Number.isFinite(tr.wl) ? `Wavelength: ${tr.wl} nm` : '', tr.collected ? `Collection time: ${tr.collected}` : '', `File: ${f.src || f.name}`].filter(Boolean).join('\n');
}

/* ---- The injection: the prototype's findpeaks (myFindPeaks) and its choice (autoPeak) ---- */
export function findPeaks(y, mp){
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
export function suggestInj(tr, mp){
  if (!tr) return null;
  let best = -1;
  for (const i of findPeaks(tr.A, mp)) if (best < 0 || tr.A[i] > tr.A[best]) best = i;
  return best < 0 ? null : tr.t[best];
}
// Suggest: every trace's injection found again (the minimum prominence as it is); whether
// one moved.
export function suggestAll(all, minProm){
  let moved = false;
  all.forEach(f=>{ const v = suggestInj(traceOf(f), minProm); if (!Object.is(v, f.inj)){ f.inj = v; moved = true; } });
  return moved;
}
// The point of `t` (ascending) nearest in time to v.
export function nearestIdx(t, v){
  let lo = 0, hi = t.length - 1;
  while (hi - lo > 1){ const m = (lo + hi) >> 1; if (t[m] <= v) lo = m; else hi = m; }
  return Math.abs(t[hi] - v) < Math.abs(t[lo] - v) ? hi : lo;
}

/* ---- The alignment (the prototype's shift_data): time from the injection, absorbance less
   its least from the injection on. Kept by the trace's absorbances (U.alignKept, utils.js
   keeper) under the injection: a tab woken, an undo, a redraw and the CSVs take it as
   made. ---- */
export function alignOf(U, tr, inj){
  if (!tr || !Number.isFinite(inj)) return null;
  return U.alignKept(tr.A, U.exactKey([U.objId(tr.t), inj]), ()=>{
    const i0 = nearestIdx(tr.t, inj), t0 = tr.t[i0];
    let min = Infinity;
    for (let i = i0; i < tr.A.length; i++) if (tr.A[i] < min) min = tr.A[i];
    return { i0, t0, min, xs: tr.t.map(v=> v - t0), ys: tr.A.map(v=> v - min) };
  });
}
// The aligned absorbance at time T from the injection, linearly interpolated (NaN past the trace's end).
export function readAt(al, T){
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
export const CAL_MODES = { none: 'None (absorbances)', line: 'Slope and intercept', std: 'Standards (least squares)' };
export const calDefault = ()=> ({ mode: 'none', slope: null, intercept: null, stds: [], unit: '' });
const numOrNull = v => Number.isFinite(v) ? v : null;
export function calIn(U, v){
  const c = calDefault();
  if (!U.isObj(v)) return c;
  c.mode = Object.prototype.hasOwnProperty.call(CAL_MODES, v.mode) ? v.mode : 'none';
  c.slope = numOrNull(v.slope); c.intercept = numOrNull(v.intercept);
  c.stds = Array.isArray(v.stds) ? v.stds.filter(p=> Array.isArray(p) && p.length === 2).map(p=> [numOrNull(p[0]), numOrNull(p[1])]) : [];
  c.unit = typeof v.unit === 'string' ? v.unit.slice(0, 40) : '';
  return c;
}
export const calCopy = c => ({ ...c, stds: c.stds.map(p=> p.slice()) });
// The standards that count: both numbers given.
export const stdsOf = c => c.stds.filter(p=> Number.isFinite(p[0]) && Number.isFinite(p[1]));
/* The line a calibration gives, { m, q, r2 (NaN when typed), n }, or null (none, or not one:
   a slope of 0, fewer than two standards of different concentrations). */
export function calLine(U, c){
  if (c.mode === 'line') return Number.isFinite(c.slope) && c.slope !== 0 && Number.isFinite(c.intercept) ? { m: c.slope, q: c.intercept, r2: NaN, n: 0 } : null;
  if (c.mode !== 'std') return null;
  const s = stdsOf(c);
  if (s.length < 2 || new Set(s.map(p=> p[0])).size < 2) return null;
  const r = U.fitLinear(s.map(p=> p[0]), s.map(p=> p[1]));
  return Number.isFinite(r.slope) && r.slope !== 0 && Number.isFinite(r.intercept) ? { m: r.slope, q: r.intercept, r2: r.R2, n: s.length } : null;
}
export const concName = c => c.unit.trim() ? `Concentration (${c.unit.trim()})` : 'Concentration';
// The window's draft as it opens: the calibration's, three empty standards where it has none.
export function draftOf(cal){
  const d = calCopy(cal);
  if (!d.stds.length) d.stds = [[null, null], [null, null], [null, null]];
  return d;
}
// A mode as the window's select gives it (one of CAL_MODES, else none).
export const modeIn = v => Object.prototype.hasOwnProperty.call(CAL_MODES, v) ? v : 'none';
// The fields that hold no number ([field, its name]) that the draft's mode uses.
export const badUsed = (bad, mode)=> bad.filter(([, n])=> mode === 'line' ? !n.startsWith('standard') : mode === 'std' ? n.startsWith('standard') : false);
// What the draft gives, said under the fields ('' nothing to say): its fields that hold no
// number, or a line typed that is none.
export const calMsg = (draft, bad, L)=> bad.length ? `Not a number: ${[...new Set(bad.map(b=> b[1]))].join(', ')}.`
  : draft.mode === 'line' && !L ? 'A slope (not 0) and an intercept are needed.' : '';
/* The calibration Apply takes from the draft d (its empty standards left out, its unit
   trimmed: d itself), or null where it is the one there. */
export function applied(d, cal){
  d.stds = d.stds.filter(p=> p[0] != null || p[1] != null);
  d.unit = d.unit.trim();
  return JSON.stringify(d) === JSON.stringify(cal) ? null : d;
}

/* ---- Numbers as the page writes them (a CSV's: csvNum) ---- */
export const sig = (v, d = 4)=> Number.isFinite(v) ? String(+v.toPrecision(d)) : 'n/a';
export const fix = (v, d)=> Number.isFinite(v) ? v.toFixed(d) : 'n/a';
// A field's number, either decimal mark; '' none (null); anything else not one (undefined).
const NUM_RE = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?$/;
export const fieldNum = s =>{ s = String(s).trim(); return !s ? null : NUM_RE.test(s) && Number.isFinite(parseNum(s)) ? parseNum(s) : undefined; };

/* ---- The module's state ---- */
// The marks of the Analysis card's plot.
export const INJ_COLOR = '#ffd24a';
export const BG_COLOR = '#93a0b0';
export const READ_COLOR = '#ff5050';
export const DEF = { tRead: 240, minProm: 0.01 };
// The module's own state saved: the reading time, the minimum prominence, the calibration.
export const stateOf = (tRead, minProm, cal)=> ({ tRead, minProm, cal: calCopy(cal) });
// …and read back (RESTORED).
export const stateIn = (U, s)=> ({ tRead: U.num(s.tRead, DEF.tRead, v=> v > 0), minProm: U.num(s.minProm, DEF.minProm, v=> v >= 0), cal: calIn(U, s.cal) });
// The trace on show: the one named, else the first included.
export const curOf = (files, name)=> files.find(f=> f.name === name) || files[0] || null;
// What it shows beside its state (tabs.js): the trace on show, but the first.
export const showsOf = (files, f)=> f && files.length > 1 && f !== files[0] ? { trace: f.name } : null;
export const showNextIn = (U, v)=> U.isObj(v) && typeof v.trace === 'string' ? v.trace : null;

/* ---- A trace's results: its alignment, its reading (the aligned absorbance at the reading
   time) and, calibrated, its concentration ---- */
export function resultOf(U, f, tRead, cal){
  const tr = traceOf(f), al = alignOf(U, tr, f.inj), A = readAt(al, tRead), L = calLine(U, cal);
  return { f, tr, al, A, c: L && Number.isFinite(A) ? (A - L.q) / L.m : NaN };
}
// The Analysis card's read-outs of a trace's results r: its injection (none: the note under
// the plot says to click it), background, reading and concentration; a reading time past
// the trace's end said in a warning under them (AWarn, v567: to v566 grey, in the read-out).
export function readouts(r, cal, tRead, L){
  const past = r.al && !Number.isFinite(r.A);
  return {
    inj: r.al ? `${fix(r.al.t0, 2)} s` : 'none',
    bg: r.al ? fix(r.al.min, 4) : 'n/a',
    A: r.al && !past ? fix(r.A, 4) : 'n/a',
    AWarn: past ? `The trace ends ${fix(r.al.xs[r.al.xs.length - 1], 1)} s after the injection: no reading at ${tRead} s.` : '',
    ATitle: `Absorbance at ${tRead} s:`,
    cRow: L ? '' : 'none',
    c: Number.isFinite(r.c) ? `${sig(r.c)}${cal.unit.trim() ? ' ' + cal.unit.trim() : ''}` : 'n/a',
  };
}

/* ---- What the plots draw ---- */
// The Analysis card's: the trace's range, padded in absorbance, and its last time.
export function traceRange(tr){
  let lo = Infinity, hi = -Infinity;
  for (const v of tr.A){ if (v < lo) lo = v; if (v > hi) hi = v; }
  const pad = (hi - lo) * 0.05 || 0.01, t1 = tr.t[tr.t.length - 1];
  return { x0: tr.t[0], x1: t1, y0: lo - pad, y1: hi + pad };
}
// The Results' aligned traces (al: the results with an injection): their range, the reading time in it.
export function alignRange(al, tRead){
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  al.forEach(r=>{ x0 = Math.min(x0, r.al.xs[0]); x1 = Math.max(x1, r.al.xs[r.al.xs.length - 1]); for (const v of r.al.ys){ if (v < y0) y0 = v; if (v > y1) y1 = v; } });
  if (!al.length){ x0 = 0; x1 = tRead * 1.25; y0 = 0; y1 = 1; }
  const pad = (y1 - y0) * 0.05 || 0.01;
  return [Math.min(x0, 0), Math.max(x1, tRead), y0 - pad, y1 + pad];
}
// Under them, the traces not shown.
export const alignNote = (n, k)=> n > k ? `${n - k} trace${n - k > 1 ? 's' : ''} with no injection set, not shown.` : '';
/* The readings' plot: one point a trace included, in the list's order, its name under the
   axis (cut and tilted to fit, utils barNames) and its value over it; the concentrations
   with a calibration (L), else the absorbances. Its layout in a plot W × H, the names and
   values measured by mctx: { vals, has, fit, range [x0, x1, y0, y1], opts }. */
export function readingsLayout(U, list, L, cal, mctx, W, H){
  const vals = list.map(r=> L ? r.c : r.A), n = list.length;
  const has = vals.map(Number.isFinite), fit = U.barNames(mctx, list.map(r=> r.f.label), Math.max(60, W - 75), 55, has);
  let maxLbl = 0, maxVal = 0;
  fit.labels.forEach((l, k)=>{ if (has[k]){ maxLbl = Math.max(maxLbl, mctx.measureText(l).width); maxVal = Math.max(maxVal, mctx.measureText(sig(vals[k])).width); } });
  const bottom = Math.round(26 + maxLbl * fit.sin), ok = vals.filter(Number.isFinite);
  let lo = Math.min(0, ...ok), hi = Math.max(0, ...ok);
  if (hi === lo) hi = lo + 1;
  // (room over the highest point for its value, upright)
  const plotH = H - 15 - bottom, reserve = 14 + maxVal, frac = plotH > reserve ? 1 - reserve / plotH : 0.5;
  const yLo = lo < 0 ? lo - 0.08 * (hi - lo) : 0, yHi = yLo + (hi - yLo) / frac;
  const opts = { xlabel: '', ylabel: L ? concName(cal) : 'Absorbance − background', noXTickLabels: true, noXGrid: true, yGrid: true, margin: { l: 55, r: 20, t: 15, b: bottom } };
  return { vals, has, fit, range: [0, n + 1, yLo, yHi], opts };
}
// The readings' caption.
export const readCap = (L, cal, tRead)=> L ? `${concName(cal)} at ${tRead} s` : `Absorbance − background at ${tRead} s`;

/* ---- The CSVs: the traces aligned, and the readings, each trace's details with them ---- */
const wlOf = r => r.tr && Number.isFinite(r.tr.wl) ? r.tr.wl : NaN;
export function alignedCsv(U, list){
  const cols = [];
  list.filter(r=> r.al).forEach(r=>{
    const wl = wlOf(r);
    cols.push({ h: `${r.f.label} - time from injection (s)`, v: r.al.xs.map(U.csvNum) },
      { h: `${r.f.label} - absorbance${Number.isFinite(wl) ? ` at ${wl} nm` : ''} - background`, v: r.al.ys.map(U.csvNum) });
  });
  return cols.length ? U.wideCsv(cols) : U.csvLine(['No trace with an injection set']);
}
export function readingsCsv(U, list, cal, tRead, L){
  const { csvNum, csvLine } = U;
  let t = csvLine(['Trace', 'File', 'Wavelength (nm)', 'Collection time', 'Injection time (s)', 'Background absorbance', 'Reading time (s)', 'Absorbance - background', ...(L ? [concName(cal)] : [])]);
  for (const r of list){
    t += csvLine([r.f.label, r.f.src || r.f.name, csvNum(wlOf(r)), r.tr ? r.tr.collected : '', csvNum(r.al ? r.al.t0 : NaN), csvNum(r.al ? r.al.min : NaN), csvNum(tRead), csvNum(r.A), ...(L ? [csvNum(r.c)] : [])]);
  }
  return t;
}
