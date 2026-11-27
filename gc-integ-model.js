/* =========================================================
   GC — the Integration cards' calculations, which touch no page (gc-integ.js wires them to
   the cards; tests/integmodel.test.mjs calls them in Node): the method (the engine's, its
   windows' edges the card's) as a project holds it and its key, the results' keys of every
   version, a result as the store keeps it, the calibration (its unit, intercepts, files and
   levels) as a project holds it; the raw chromatograms and a calibration's table read once
   per file; the results held, taken from a state and saved, the states a result is written
   into, what the job integrates; the pairs and files a card shows, their results under the
   method or the one before it, the standards' names, rows and lines, a gas's areas turned
   into concentrations (the standards' line, else the GC software's scale), what Analysis
   takes of a sample; the suspicious rule (judge); the chromatogram over its residuals (its
   ranges, curves, legend, the points left out), the run overview (its points, ranges and
   what a point says), the status line, the alerts' facts, the CSVs; the calibration
   window's files dropped and paired, a level typed, a standard's line and its levels; the
   card's state saved and put back. Taken out of v559's gc-integ.js with their operations in
   their order: the same numbers to the last bit.

   utils.js's, modkit.js's and plot.js's helpers, which need a page to load, are handed in
   as one object, U = { isObj, oneOf, num, esc, exactKey, bytesKey, objId, fmtNum, csvLine,
   niceTicks } (gc-integ.js U).

   The instance's state is S (gc-integ.js createInteg): its context ctx, the gases (GAS by
   key, gasOf, C_FIT), the raw chromatograms read (read) and the calibrations' tables
   (tabs), by their bytes, the results (store) and the job (job, halted, soon, failed);
   a card's is C (gc-integ.js makeCard): its method, the one before it (wasMethod), its
   calibration (cal), the overview's gas and y (ovGas, ovY), what it shows (selName, selK)
   and Analysis's values kept (valuesKept).
========================================================= */
import { DEFAULT_METHOD, readTcd, windowCurves, fitCalibration, transferK } from './gc-tcd.js';
import { decodeText } from './textdata.js';
import { looksTcd, stemOf } from './gc-pair.js';
import { fixed } from './db.js';
import { keepSeen } from './alerts.js';

/* ---- The colours, the marks and the rules (pure: the module's, for every instance) ---- */
export const PEAK_COLORS = ['#9b7bff', '#4cc9a0', '#e3b341', '#d95fd0'];
export const C_RAW = '#8a95a3', C_MODEL = '#e0457b', C_BASE = '#d4a72c', C_EDGE = '#4cc9a0', C_BAD = '#ff3b3b', C_TABLE = '#9aa3ad';
/* The run overview's marks: every gas's fits in one colour (H₂'s blue, C_FIT), the
   suspicious red; a fit's dot of radius OV_R, the GC table's grey cross smaller (OV_CROSS,
   its arms' half-span: under a dot, hidden by it); a point hovered or on show drawn again
   OV_HL_R times as large as the dot is seen (its radius plus half the 1 px stroke plot.js
   rings it with), OV_HL_TINT of the way to white. */
export const OV_R = 3.2, OV_CROSS = 1.75, OV_HL_R = 1.5, OV_HL_TINT = 0.4;
export const MARGIN = 4;            // s shown either side of the windows (and of their neighbours)
/* The peaks beside the H₂/O₂ window that its model has no peak for: the system peak at
   262–267.5 s and N₂ from about 330.5 s. Drawn on the chromatogram; an edge of a window
   inside one is said: on real runs an edge moved by 1–2 s changes H₂ by 0.01–0.02 % at high
   levels and by about one formal sd at low ones, but by 5 s it reaches these and the fit
   degrades. */
export const NEIGHBOURS = [{ name: 'S264', from: 262, to: 267.5 }, { name: 'N2', from: 330.5, to: 337.6 }];
/* What marks a chromatogram as suspicious for a gas (judge), any of:
   1. a χ²ᵣ above 4, after the fit's restart (the robust pass stops at 100 evaluations, and
      its worst outcome reads χ²ᵣ 41; a clean real run reads 2–3.5);
   2. a fit that did not converge (or a chromatogram the engine could not fit);
   3. its area out of proportion with the GC software's table: over the run (the pair), at
      each injection with a table value r_i = A_i / T_i, k = median(r_i) (transferK's
      quantity, with no threshold); suspicious where |A_i − k·T_i| > max(10 % of k·T_i,
      k × 15 ppm), the floor in the table's unit (0.0015 %mol, or 15 ppm for the .txt
      export). No comparison where the table has no value. Areas, not concentrations: with
      O₂'s free intercept every calibrated O₂ would differ from the table by one factor.
      (10 % from v546: at 3 % nearly every O₂ of a real run was marked, the GC software
      ignoring H₂'s tail under O₂, which the fit models.)
   A glitch zone left out of the fit is not one (v544 marked it). */
export const PROP_TOL = 0.10, PROP_FLOOR = { '%mol': 0.0015, ppm: 15 };
export const CHI2_HIGH = 4;
/* The method's fields: the windows' edges, numbers that are its source of truth (exact,
   kept with the method, the same for every injection), the lines on the chromatogram an aid
   that snaps to the data's 0.2 s and writes into them. */
export const SNAP = 0.2, snap = v => Math.round(v/SNAP)*SNAP, round2 = v => +v.toFixed(2);
export const UNITS = ['%mol', 'ppm'];
export const toPct = (v, unit)=> unit === 'ppm' ? v/1e4 : v;
export const fin = v => Number.isFinite(v);
export const plural = (n, w)=> `${n} ${w}${n === 1 ? '' : 's'}`;
export const sig = (v, n = 4)=> fin(v) ? (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-3 && v) ? v.toExponential(n - 1) : String(+v.toPrecision(n))) : '—';
// The gases (gc.js GASES), by key; a peak of another gas, should a window name one, drawn so.
export function gasTable(U, gases){
  const GAS = Object.fromEntries(gases.map(g=> [g.key, g]));
  return { GAS, gasOf: k => GAS[k] || { label: U.esc(k), txt: k, csv: k, color: '#4cc9a0' }, C_FIT: GAS.h2.color };
}

/* ---- The method: the engine's own, its windows' edges the card's ---- */
// (DEFAULT_METHOD is deep-frozen: a card's method is a copy)
export const clone = m => structuredClone(m);
/* A method as a project holds it (RESTORED): the default's, each window's edges where the
   saved one has that window with edges that are numbers, its start before its end. What
   else a method holds is the engine's, as it is (a v544 project's trapezoids ignored). */
export function methodIn(U, m){
  const out = clone(DEFAULT_METHOD);
  const ws = U.isObj(m) && Array.isArray(m.windows) ? m.windows : [];
  out.windows.forEach(w=>{
    const s = ws.find(x=> U.isObj(x) && x.key === w.key);
    if (s && fin(s.from) && fin(s.to) && s.from < s.to){ w.from = s.from; w.to = s.to; }
  });
  return out;
}
// (a stored result's null, JSON's NaN, read back as NaN, never as 0)
export const deNull = (U, v)=> v === null ? NaN : Array.isArray(v) ? v.map(x=> deNull(U, x)) : U.isObj(v) ? Object.fromEntries(Object.entries(v).map(([k, x])=> [k, deNull(U, x)])) : v;
export const methodKey = (U, m)=> U.exactKey(m.windows.map(w=> [w.key, w.from, w.to]).concat([JSON.stringify(m)]));
/* A results' key as v544 wrote it (a project saved then): its method held the trapezoids
   (`trapezoid`, and its fit's spikes.roundsTrapezoid), which no fit ever read, and the key
   holds the method's JSON, so v545's key for the same file and windows differs. Read back
   without them it is v545's key, and the results are found under it: nothing is fitted
   again (the results themselves are the fit's: their `trap`, the trapezoids', dropped). */
export function normKey(U, key){
  const i = key.indexOf('|');
  let a, m;
  try { a = JSON.parse(key.slice(i + 1)); m = Array.isArray(a) && typeof a[a.length - 1] === 'string' ? JSON.parse(a[a.length - 1]) : null; } catch(e){ return key; }
  const sp = U.isObj(m) && U.isObj(m.fit) && U.isObj(m.fit.spikes) ? m.fit.spikes : null;
  if (i < 0 || !U.isObj(m) || !('trapezoid' in m || (sp && 'roundsTrapezoid' in sp))) return key;
  delete m.trapezoid;
  if (sp) delete sp.roundsTrapezoid;
  a[a.length - 1] = JSON.stringify(m);
  return key.slice(0, i + 1) + U.exactKey(a);
}
export const noTrap = (U, r)=>{ if (U.isObj(r) && U.isObj(r.gases)) Object.values(r.gases).forEach(x=>{ if (U.isObj(x)) delete x.trap; }); return r; };
export const isDefault = (U, m)=> methodKey(U, m) === methodKey(U, methodIn(U, null));
/* A result as the store keeps it (and the project): JSON's (a NaN is null, read back as
   none), its numbers to 8 digits, a peak's physical parameters left out (the window's `p`
   gives them, windowCurves draws from it). */
export const r8 = v => typeof v === 'number' && fin(v) ? +v.toPrecision(8) : v;
export const compact = (U, r)=> r && deNull(U, JSON.parse(JSON.stringify(r, (k, v)=> k === 'params' ? undefined : typeof v === 'number' ? r8(v) : ArrayBuffer.isView(v) ? Array.from(v, r8) : v)));

/* ---- The calibration (a card's): its unit, intercept modes, files and levels ----
   A file of it (v549): the standards' raw chromatograms (name, rawBytes: what is
   integrated, its results keyed by these bytes as any file's) and the GC software's table
   of the same injections (`table`: { name, rawBytes }), read for one thing only, each
   injection's name; a level per chromatogram, typed by hand. A file of v544–v548's has no
   table: kept as it is, its standards named by column until the table is dropped, which
   its window says until its × marks the file seen (`seen`, alerts.js: v573; to v572 the ×
   held while the window was open). */
export const blankLevel = ()=> ({ h2: null, o2: null, on: true });
export function calIn(U, c){
  const s = U.isObj(c) ? c : {}, z = U.isObj(s.zero) ? s.zero : {};
  const lv = v => U.num(v, null);
  const files = Array.isArray(s.files) ? s.files.filter(f=> U.isObj(f) && f.rawBytes instanceof Uint8Array).map(f=> keepSeen({
    name: typeof f.name === 'string' && f.name ? f.name : 'calibration.csv', rawBytes: f.rawBytes,
    levels: Array.isArray(f.levels) ? f.levels.map(x=> U.isObj(x) ? { h2: lv(x.h2), o2: lv(x.o2), on: x.on !== false } : blankLevel()) : [],
    ...(U.isObj(f.table) && f.table.rawBytes instanceof Uint8Array ? { table: { name: typeof f.table.name === 'string' && f.table.name ? f.table.name : 'calibration table.csv', rawBytes: f.table.rawBytes } } : {}), seen: f.seen })) : [];
  return { unit: U.oneOf(s.unit, UNITS), zero: { h2: z.h2 === true, o2: z.o2 === true }, files };
}
/* The calibration's files of card `id` in a state, marked by `mark` (alerts.js markSeen's
   `put`, its window's ×): the state itself where none changed. */
export const inCal = (U, id)=> (s, mark)=>{
  if (!U.isObj(s) || !Array.isArray(s.cards)) return s;
  const cards = s.cards.map(c=>{
    if (!U.isObj(c) || c.id !== id || !U.isObj(c.cal) || !Array.isArray(c.cal.files)) return c;
    const files = mark(c.cal.files);
    return files === c.cal.files ? c : { ...c, cal: { ...c.cal, files } };
  });
  return cards.some((c, i)=> c !== s.cards[i]) ? { ...s, cards } : s;
};
export const calCopy = c => ({ unit: c.unit, zero: { ...c.zero }, files: c.files.map(f=> ({ ...f, levels: f.levels.map(l=> ({ ...l })) })) });

/* ---- The raw chromatograms, read once per file (by its bytes) ---- */
export function dataOf(S, rec){
  const b = rec && rec.rawBytes;
  if (!(b instanceof Uint8Array)) return { error: 'its bytes are not stored in this browser any more' };
  let d = S.read.get(b);
  if (!d){
    try { d = readTcd(decodeText(b)); } catch(e){ d = { error: String(e && e.message || e) }; }
    S.read.set(b, d);
  }
  return d;
}
// (a file a drop read, gc.js's or the calibration window's: what it read kept, not read again)
export const prime = (S, bytes, d)=>{ S.read.set(bytes, d); };
// (gc-model.js's, as gc.js says it of a file it cannot read as a GC table)
const NOT_GC = 'not a GC table: no injection date and H₂ or O₂ column under a header';
export const fileKey = (U, rec)=> rec.rawBytes instanceof Uint8Array ? U.bytesKey(rec.rawBytes) : 'name:' + rec.name;
/* ---- A calibration's table (v549), read once per file (by its bytes) as gc.js reads a
   GC table (ctx.readTable), its injections' names with it ---- */
export function tableOf(S, b){
  if (!(b instanceof Uint8Array)) return null;
  let t = S.tabs.get(b);
  if (!t){
    try { t = S.ctx.readTable(decodeText(b)); } catch(e){ t = null; }
    if (!t || t.error) t = { error: t && t.error || NOT_GC };
    S.tabs.set(b, t);
  }
  return t;
}

/* ---- The results ---- */
export const keyOf = (U, rec, m)=> fileKey(U, rec) + '|' + methodKey(U, m);
// (the job's own, as they come, over the store's)
export const resultsAt = (S, key)=> S.job && S.job.key === key ? S.job.work : S.store.get(key) || null;
export const integCards = S => S.ctx.cards().filter(a=> a.type === 'integ').map(a=> S.ctx.inst(a.id)).filter(Boolean);
export function usedKeys(U, S){
  const out = new Set();
  integCards(S).forEach(c=> c.tcdRecs().forEach(r=> out.add(keyOf(U, r, c.method()))));
  return out;
}
// The module state's `integ`: the results the cards use, none where there are none.
export function savedResults(U, S){
  const out = {};
  usedKeys(U, S).forEach(k=>{ const v = S.store.get(k); if (v && v.some(Boolean)) out[k] = v; });
  return Object.keys(out).length ? out : null;
}
// A state's results taken in (RESTORED: an array of objects or nulls under each key),
// merged with those held (a result held is never taken away). A key of v544's is read as
// v545's (normKey), its results without their trapezoids.
export function loadResults(U, store, obj){
  if (!U.isObj(obj)) return;
  for (const k0 of Object.keys(obj)){
    const v = obj[k0], k = normKey(U, k0);
    if (!Array.isArray(v)) continue;
    const had = store.get(k), arr = v.map(x=> U.isObj(x) && U.isObj(x.gases) && Array.isArray(x.windows) ? noTrap(U, deNull(U, x)) : null);
    if (had && had.length === arr.length) store.set(k, had.map((x, i)=> x || arr[i]));
    else if (!had || !had.some(Boolean)) store.set(k, arr);
  }
}
// Whether a state holds the file of this bytes' key (its rows, a pair's mate, a card's
// calibration): the states a result is written into.
export function holds(U, s, fk){
  if (!U.isObj(s)) return false;
  const has = r => U.isObj(r) && r.rawBytes instanceof Uint8Array && U.bytesKey(r.rawBytes) === fk;
  if (Array.isArray(s.files) && s.files.some(f=> has(f) || (U.isObj(f) && has(f.mate)))) return true;
  return Array.isArray(s.cards) && s.cards.some(c=> U.isObj(c) && U.isObj(c.cal) && Array.isArray(c.cal.files) && c.cal.files.some(has));
}
// A state with a result written in, where it holds its file (holds).
export const withResult = (U, s, fk, key, arr)=> holds(U, s, fk) ? { ...s, integ: { ...(U.isObj(s.integ) ? s.integ : {}), [key]: arr } } : s;
/* ---- The job: every (file, method) a card uses with a chromatogram not integrated ---- */
export function wanted(U, S){
  const out = [], seen = new Set();
  integCards(S).forEach(c=> c.tcdRecs().forEach(r=>{
    const m = c.method(), key = keyOf(U, r, m);
    if (seen.has(key)) return;
    seen.add(key);
    const d = dataOf(S, r);
    if (d.error) return;
    const have = S.store.get(key) || [];
    const miss = d.cols.map((_, j)=> j).filter(j=> !have[j]);
    if (miss.length) out.push({ key, rec: r, method: m, miss, d });
  }));
  return out;
}
// (how many chromatograms the files wanted miss)
export const missing = w => w.reduce((s, g)=> s + g.miss.length, 0);
// A file's results as the job begins it: those held, else none yet.
export function workOf(S, g){
  const prev = S.store.get(g.key);
  return prev && prev.length === g.d.cols.length ? prev.slice() : new Array(g.d.cols.length).fill(null);
}
// (a chromatogram the engine could not fit is a result too, its error said: else it
// would be wanted again at once, and fail again)
export const resultIn = (U, r)=> r && !r.error ? compact(U, r) : { error: String(r && r.error || 'the integration failed'), gases: {}, windows: [] };
export const status = S => ({ job: S.job, halted: S.halted, soon: !!S.soon, failed: S.failed });

/* ---- A card: the pairs and files of raw chromatograms it shows ----
   One entry each, in list order (the row's included). A table with its raw chromatograms:
   the table's label, its dates when they are as many as the chromatograms; raw
   chromatograms alone, or two files of them paired: each by itself, with no time. */
export function entriesOf(S){
  const out = [], { ctx } = S;
  ctx.all.forEach(r=>{
    if (r.included === false) return;
    const mate = r.mate;
    if (ctx.isTcd(r)){
      out.push({ name: r.name, label: r.label, tcd: r, table: null, twin: mate && ctx.isTcd(mate) ? mate.name : null });
      if (mate && ctx.isTcd(mate)) out.push({ name: mate.name, label: `${r.label} · ${mate.name}`, tcd: mate, table: null, twin: r.name });
    } else if (mate && ctx.isTcd(mate)) out.push({ name: mate.name, label: r.label, tcd: mate, table: r });
  });
  return out.map(e=>{ const d = dataOf(S, e.tcd); return { ...e, d, n: d.error ? 0 : d.cols.length, rows: e.table ? e.table.injDates.length : null }; });
}
export const tcdRecs = (S, C)=> [...entriesOf(S).map(e=> e.tcd), ...C.cal.files];
export const curOf = (S, C)=>{ const es = entriesOf(S); return es.find(e=> e.name === C.selName) || es[0] || null; };
export const aligned = e => !!(e && e.table && !e.d.error && e.rows === e.n);
// The results of a file: under the method, else (stale) the one before it.
export function resOf(U, S, C, rec){
  const now = resultsAt(S, keyOf(U, rec, C.method));
  if (now && now.some(Boolean)) return { res: now, m: C.method, stale: false };
  if (C.wasMethod){ const old = resultsAt(S, keyOf(U, rec, C.wasMethod)); if (old && old.some(Boolean)) return { res: old, m: C.wasMethod, stale: true }; }
  return { res: now, m: C.method, stale: false };
}
// (the file's and the chromatogram's on show, its selectors' choice: a step of d, around)
export function stepFile(S, C, d){
  const es = entriesOf(S), c = curOf(S, C), i = c ? es.findIndex(x=> x.name === c.name) : -1;
  if (es.length < 2) return false;
  C.selName = es[(i + d + es.length) % es.length].name; C.selK = 0;
  return true;
}
export function stepK(S, C, d){
  const e = curOf(S, C);
  if (!e || e.n < 2) return false;
  C.selK = (C.selK + d + e.n) % e.n;
  return true;
}

/* ---- Concentrations: the standards' line per gas, else the software's scale ---- */
/* A standard's name (v549): its injection's in the table (its Analysis column), else
   its injection's number; a file with no table (saved by v544–v548) by its column. */
export function stdName(S, f, j){
  const t = f.table ? tableOf(S, f.table.rawBytes) : null;
  if (!t || t.error) return `column ${j + 1}`;
  const n = Array.isArray(t.names) && typeof t.names[j] === 'string' ? t.names[j].trim() : '';
  return n || `injection ${j + 1}`;
}
export function calRows(U, S, C){
  const rows = [];
  C.cal.files.forEach((f, fi)=>{
    const d = dataOf(S, f), res = d.error ? null : resultsAt(S, keyOf(U, f, C.method));
    const n = d.error ? 0 : d.cols.length;
    for (let j = 0; j < n; j++) rows.push({ f, fi, j, d, lv: f.levels[j] || blankLevel(), r: res && res[j], name: stdName(S, f, j) });
  });
  return rows;
}
// (a standard's whole name: its injection's, its files' and its column)
export const fullName = x => `${x.name} (${x.f.table ? `${x.f.table.name}, ` : ''}${x.f.name}, column ${x.j + 1})`;
// The standards of gas g that its line takes: ticked, with a level and a fitted area.
export const calPoints = (U, S, C, g)=> calRows(U, S, C).filter(x=> x.lv.on && fin(x.lv[g]) && x.r && x.r.gases && x.r.gases[g] && fin(x.r.gases[g].area));
export function calFit(U, S, C, g){
  const pts = calPoints(U, S, C, g).map(x=> ({ conc: x.lv[g], area: x.r.gases[g].area }));
  let fit;
  try { fit = pts.length ? fitCalibration(pts, { zeroIntercept: C.cal.zero[g] }) : null; } catch(e){ fit = null; }
  return fit && fin(fit.slope) && fit.slope ? { ...fit, pts } : null;
}
export const calKey = (U, C)=> U.exactKey([C.cal.unit, C.cal.zero, C.cal.files.map(f=> [fileKey(U, f), f.levels])]);
/* How a gas's areas become %mol for an entry: { how: 'cal', f } with the standards, else
   { how: 'transfer', k, n, f } from the table (`tableVals`, %mol, the injections'), else
   { why }. */
export function convOf(U, S, C, g, areas, tableVals){
  const L = calFit(U, S, C, g);
  if (L) return { how: 'cal', fit: L, f: A => toPct((A - L.intercept)/L.slope, C.cal.unit) };
  if (!tableVals) return { why: `no standards for ${S.gasOf(g).txt}, and no GC table for the GC software's scale (k)` };
  let T = null;
  try { T = transferK(areas, Array.from(tableVals, v=> fin(v) ? v : NaN), C.method.transfer[g]); } catch(e){ T = null; }
  if (!T || !fin(T.k) || !T.k) return { why: `no standards for ${S.gasOf(g).txt}, and too few injections above the threshold to take the GC software's scale (k)` };
  return { how: 'transfer', k: T.k, n: T.n, f: A => A/T.k };
}
// Each gas's conversion for entry e (its areas from `res`).
export function convAll(U, S, C, e, res){
  const out = {};
  Object.keys(S.GAS).forEach(g=>{
    const areas = (res || []).map(x=> x && x.gases && x.gases[g] && fin(x.gases[g].area) ? x.gases[g].area : NaN);
    out[g] = convOf(U, S, C, g, areas, aligned(e) ? e.table.gas[g] : null);
  });
  return out;
}
/* What Analysis takes for a table record f (a sample) paired with its raw chromatograms,
   or null for one with none (the table, nothing said): { gas: { h2, o2 } in %mol (an
   array fixed, kept while nothing changes), how: { gas: 'cal' | 'transfer' | 'table' },
   why: { gas: why the table }, k } or { why } (the table for every gas). */
export function valuesFor(U, S, C, f){
  const tcd = f && f.mate && S.ctx.isTcd(f.mate) ? f.mate : null;
  if (!tcd) return null;
  const d = dataOf(S, tcd);
  if (d.error) return { why: `its raw chromatograms could not be read: ${d.error.replace(/\.$/, '')}` };
  const n = d.cols.length, rows = f.injDates.length;
  // (`integ`: the Integration card says it, which the card's alert names; gc-html.js srcAlertsHtml)
  if (n !== rows) return { why: `${plural(rows, 'injection')} in the table, ${plural(n, 'chromatogram')}`, integ: true };
  const res = resultsAt(S, keyOf(U, tcd, C.method));
  if (!res || res.some(x=> !x)){ const st = status(S); return { why: st.halted ? 'its integration was stopped before its end' : 'its integration is not done yet', waiting: true }; }
  const vk = U.exactKey([keyOf(U, tcd, C.method), calKey(U, C), Object.keys(f.gas).map(k=> [k, U.objId(f.gas[k])]), U.objId(res)]);
  if (C.valuesKept.has(vk)) return C.valuesKept.get(vk);
  const out = sampleValues(U, S, C, f, res);
  if (C.valuesKept.size > 64) C.valuesKept.delete(C.valuesKept.keys().next().value);
  C.valuesKept.set(vk, out);
  return out;
}
function sampleValues(U, S, C, f, res){
  const gas = {}, how = {}, why = {}, k = {};
  Object.keys(S.GAS).forEach(g=>{
    const areas = res.map(x=> x.gases && x.gases[g] && fin(x.gases[g].area) ? x.gases[g].area : NaN);
    const c = convOf(U, S, C, g, areas, f.gas[g]);
    if (c.f){ gas[g] = fixed(areas.map(A=> fin(A) ? c.f(A) : NaN)); how[g] = c.how; if (c.how === 'transfer') k[g] = { k: c.k, n: c.n }; }
    else if (f.gas[g]){ gas[g] = f.gas[g]; how[g] = 'table'; why[g] = c.why; }
  });
  return { gas, how, why, k, areas: Object.fromEntries(Object.keys(S.GAS).map(g=> [g, res.map(x=> x.gases && x.gases[g] ? x.gases[g].area : NaN)])) };
}

/* ---- The selectors' names: an injection's (its time where the table is aligned) ---- */
export const pad = v => String(v).padStart(2, '0');
export const clock = d =>{ const x = new Date(d); return fin(+x) ? `${pad(x.getDate())}/${pad(x.getMonth() + 1)} ${pad(x.getHours())}:${pad(x.getMinutes())}` : ''; };
// (integration.csv's injection date: local time, as the table logged it)
export const isoLocal = d =>{ const x = new Date(d); return fin(+x) ? `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}` : ''; };
// (the selector's name short, its count beside it; the tooltip and the overview's label whole)
export const injName = (e, k)=> `Injection ${k + 1}${aligned(e) ? ' · ' + clock(e.table.injDates[k]) : ''}`;
export const injShort = (e, k)=> aligned(e) ? `#${k + 1} · ${clock(e.table.injDates[k])}` : `Injection ${k + 1}`;
// (a file's line in its selector and its tooltip)
export const fileLabel = x => x ? x.label + (x.table ? '' : ' (no table)') : '';
export const fileTitle = x => x ? `${x.label}${x.table ? ` (${x.table.name} + ${x.tcd.name})` : ` (${x.tcd.name}, no table)`}` : '';

/* ---- The suspicious rule ---- */
// The fit's own marks of a result r, the window of gas g's (any window, g omitted).
export function fitMarks(r, g){
  if (!r) return [];
  if (typeof r.error === 'string') return [`not integrated: ${r.error}`];
  const ws0 = Array.isArray(r.windows) ? r.windows : [], wk = g && r.gases && r.gases[g] ? r.gases[g].window : null;
  const ws = wk ? ws0.filter(x=> x.key === wk) : ws0, out = [];
  const w = ws.find(x=> fin(x.chi2r) && x.chi2r > CHI2_HIGH);
  if (w) out.push(`χ²ᵣ ${w.chi2r.toFixed(2)}, above ${CHI2_HIGH}${w.restarted ? ' (after a restart)' : ''}`);
  if (ws.some(x=> x.ok === false && !x.beyondData)) out.push('the fit did not converge');
  // (a column that ends before its window does, as a real standard's at 309 s: no fit)
  if (ws.some(x=> x.beyondData === true)) out.push('the chromatogram ends before its window does: not fitted');
  return out;
}
// The run's proportion with the table for each gas (judge's J.prop): { k, n, areas, tv } or null.
function propOf(S, tab, res){
  const prop = {};
  Object.keys(S.GAS).forEach(g=>{
    const tv = tab && tab.gas[g];
    prop[g] = null;
    if (!tv) return;
    const areas = res.map(x=> x && x.gases && x.gases[g] && fin(x.gases[g].area) ? x.gases[g].area : NaN);
    let T;
    try { T = transferK(areas, Array.from(tv, v=> fin(v) ? v : NaN), { minValue: 0, minCount: 1 }); } catch(err){ T = null; }
    if (T && fin(T.k) && T.k > 0) prop[g] = { k: T.k, n: T.n, areas, tv };
  });
  return prop;
}
/* The judge of entry e's results `res` (see PROP_TOL): J(k, gases) the reasons that mark
   injection k (none: []), J.bad(k, g) whether it is suspicious for gas g (any gas: g
   omitted), J.off(k, g) its area's relative deviation from k × its table value where
   that is out of proportion (else null), J.prop[g] the run's { k, n } (null without a
   table value). */
export function judge(S, e, res){
  res = res || [];
  const tab = aligned(e) ? e.table : null, ppm = !!(tab && tab.altExport === true);
  const prop = propOf(S, tab, res);
  // (in the table's unit: %mol, or ppm for the .txt export; k per that unit)
  const off = (k, g)=>{
    const P = prop[g];
    if (!P) return null;
    const A = P.areas[k], T = P.tv[k];
    if (!fin(A) || !fin(T)) return null;
    const per = ppm ? 1e4 : 1, ku = P.k/per, want = ku*T*per, floor = ku*PROP_FLOOR[ppm ? 'ppm' : '%mol'];
    return Math.abs(A - want) > Math.max(PROP_TOL*Math.abs(want), floor) ? (want ? (A - want)/want : Infinity) : null;
  };
  const offText = (k, g)=>{ const d = off(k, g); return d == null ? null : `${S.gasOf(g).txt}: ${fin(d) ? (d > 0 ? '+' : '') + (100*d).toFixed(1) + ' %' : 'not 0'} off the GC table's proportion (k = ${sig(prop[g].k, 5)})`; };
  const J = (k, gases = Object.keys(S.GAS))=>{
    const r = res[k];
    if (!r) return [];
    const out = fitMarks(r);
    if (typeof r.error !== 'string') gases.forEach(g=>{ const t = offText(k, g); if (t) out.push(t); });
    return out;
  };
  J.bad = (k, g)=>{
    const r = res[k];
    if (!r) return false;
    if (g == null) return J(k).length > 0;
    return fitMarks(r, g).length > 0 || (typeof r.error !== 'string' && off(k, g) != null);
  };
  J.off = off; J.prop = prop;
  return J;
}

/* ---- The chromatogram over its residuals ---- */
// The H₂/O₂ zone the plot opens on: the windows and their neighbours (NEIGHBOURS), a margin round them.
export const span = m =>[Math.min(...m.windows.map(w=> w.from)), Math.max(...m.windows.map(w=> w.to))];
export const range = m =>{ const [a, b] = span(m); return [Math.min(a, ...NEIGHBOURS.map(z=> z.from)) - MARGIN, Math.max(b, ...NEIGHBOURS.map(z=> z.to)) + MARGIN]; };
/* The two panels meet: a tick's number on the edge they share (the chromatogram's foot,
   side −1; the residuals' top, side 1) would be cut in two. The range moved off it, by
   `f` of itself, where its outermost tick lies within that of it. */
export function offEdge(U, y0, y1, side, f){
  const t = U.niceTicks(y0, y1, 5), d = y1 - y0, k = side > 0 ? t[t.length - 1] : t[0];
  if (!fin(k) || !(d > 0)) return [y0, y1];
  return side > 0 ? (y1 - k < f*d ? [y0, k + 1.4*f*d] : [y0, y1]) : (k - y0 < f*d ? [k - 1.4*f*d, y1] : [y0, y1]);
}
/* What the pair of panels draws of chromatogram k of a read d under the card's method:
   { fail: 'read' } (no read, or one in error), { fail: 'empty' } (no point in the windows),
   else its points (tt, yy), x range (lo, hi), the chromatogram's y range (c0, c1), its
   results (R, r) and the windows' curves on the points their fit used (curves). o: { d, k,
   R } (gc-integ.js drawPair's). */
export function chromOf(U, o, method){
  if (!o.d || o.d.error) return { fail: 'read' };
  const k = o.k, { t, cols } = o.d, y = cols[k], [lo, hi] = range(method), [wa, wb] = span(method);
  const tt = [], yy = [];
  for (let i = 0; i < t.length; i++) if (fin(t[i]) && fin(y[i])){ tt.push(t[i]); yy.push(y[i]); }
  // (the y range the windows' own: a neighbour, N₂ above all, may run off the top)
  const inW = yy.filter((_, i)=> tt[i] >= wa && tt[i] <= wb);
  if (!inW.length) return { fail: 'empty' };
  const R = o.R || { res: null, m: method, stale: false }, r = R.res && R.res[k];
  let curves = [];
  // (the windows' curves on the points their fit used; a peak's on its baseline)
  if (r) try { curves = (r.windows || []).map(wr=> ({ wr, c: windowCurves(t, y, R.m, wr) })).filter(x=> x.c && x.c.t && x.c.t.length); } catch(err){ curves = []; }
  let ymin = Math.min(...inW), ymax = Math.max(...inW);
  curves.forEach(({ c })=> [c.model, c.base].forEach(arr=> arr && arr.forEach(v=>{ if (fin(v)){ ymin = Math.min(ymin, v); ymax = Math.max(ymax, v); } })));
  const pad5 = (ymax - ymin)*0.06 || 1;
  const [c0, c1] = offEdge(U, ymin - pad5, ymax + pad5, -1, 0.03);
  return { k, tt, yy, lo, hi, c0, c1, R, r, curves };
}
/* A window's peaks as drawn, each on the baseline (`name`, `y`, its colour `col`: a gas's,
   another's the next of PEAK_COLORS, `pc.ci` counting them, dotted), the legend's entries
   ([colour, name, mark]) taken into `items` as they come. */
export function peakLines(S, wr, c, items, pc){
  return Object.entries(c.peaks || {}).map(([name, cv])=>{
    const pk = (wr.peaks || []).find(x=> x.name === name), g = pk && pk.gas, col = g ? S.gasOf(g).color : PEAK_COLORS[pc.ci++ % PEAK_COLORS.length];
    if (!items.some(x=> x[1] === name)) items.push([col, name, g ? '' : 'mk-dots']);
    return { name, y: c.base ? cv.map((v, i)=> v + c.base[i]) : cv, col, dash: g ? undefined : '2,3' };
  });
}
// The points the fit left out: a spike's (sp) a cross, a glitch zone's (ex) a ring.
export function droppedOf(curves){
  const sp = { x: [], y: [] }, ex = { x: [], y: [] };
  curves.forEach(({ c })=>{ const d = c.dropped; if (d && Array.isArray(d.t)) d.t.forEach((x, i)=>{ const q = d.kind && d.kind[i] === 'spike' ? sp : ex; q.x.push(x); q.y.push(d.y[i]); }); });
  return { sp, ex };
}
// The legend's entries whole: the model and the baseline after the raw data, the points left out, the fit window.
export function legendItems(items, curves, { sp, ex }){
  if (curves.length){ items.splice(1, 0, [C_MODEL, 'model', ''], [C_BASE, 'baseline (with its step)', 'mk-dash']); }
  if (sp.x.length) items.push([C_BAD, 'spike left out', '']);
  if (ex.x.length) items.push([C_BAD, 'glitch zone left out (band)', 'mk-dots']);
  items.push([C_EDGE, 'fit window', '']);
  return items;
}
// The residuals, inside the fit window only (blank outside it), and their y range.
export function residOf(U, curves){
  const rx = [], ry = [];
  curves.forEach(({ c })=>{ if (c.residual) c.t.forEach((x, i)=>{ if (fin(c.residual[i])){ rx.push(x); ry.push(c.residual[i]); } }); });
  const rm = ry.length ? Math.max(...ry.map(Math.abs)) : 1;
  const [r0, r1] = offEdge(U, -rm*1.1 || -1, rm*1.1 || 1, 1, 0.1);
  return { rx, ry, r0, r1 };
}
// The glitch zones a window's fit left out, as bands ([from, to]).
export const bandsOf = curves =>{ const out = []; curves.forEach(({ wr })=> (wr.excluded || []).forEach(z=>{ if (Array.isArray(z) && fin(z[0]) && fin(z[1])) out.push(z); })); return out; };
// A window reaching a neighbour the model has no peak for, said (not refused).
export const intrusions = m => m.windows.flatMap(w=> NEIGHBOURS.filter(z=> w.from < z.to && w.to > z.from).map(z=>
  `The ${w.key} window (${w.from}–${w.to} s) reaches ${z.name} (${z.from}–${z.to} s), which its model has no peak for: the fit degrades there.`));
// A method's window that does not start 5 s before it ends (refused), or none.
export const tooShort = m => m.windows.find(x=> !(x.from < x.to - 5));
// A line dragged snaps to the data's grid (0.2 s).
export const edgeAt = v => round2(snap(v));

/* ---- Peaks: the values of the chromatogram on show (gc-integ-html.js valuesHtml) ----
   null (nothing to show), { wait } (not integrated yet), { error }, else the result r,
   each gas's conversion and the judge, the gases it has, their units, and a row per gas. */
export function peaksOf(U, S, C, e){
  if (!e || e.d.error) return null;
  const R = resOf(U, S, C, e.tcd), r = R.res && R.res[C.selK];
  if (!r) return { wait: true };
  if (typeof r.error === 'string') return { error: r.error };
  const conv = convAll(U, S, C, e, R.res), J = judge(S, e, R.res);
  const gs = Object.keys(S.GAS).filter(g=> r.gases && r.gases[g]);
  const unitOf = g =>{ const c = conv[g]; return c && c.how === 'cal' ? C.cal.unit : '%mol'; };
  const units = [...new Set(gs.filter(g=> conv[g] && conv[g].f).map(unitOf))], tUnit = e.table && e.table.altExport === true ? 'ppm' : '%mol';
  const rows = gs.map(g=>{
    const x = r.gases[g], c = conv[g];
    const conc = c && c.f && fin(x.area) ? c.f(x.area) : NaN, shown = c && c.how === 'cal' && C.cal.unit === 'ppm' ? conc*1e4 : conc;
    const tv = aligned(e) && e.table.gas[g] ? e.table.gas[g][C.selK] : NaN, tShown = tUnit === 'ppm' ? tv*1e4 : tv;
    return { g, x, shown, tShown, off: J.off(C.selK, g) != null };
  });
  return { R, conv, gs, unitOf, units, tUnit, rows, fl: J(C.selK), aligned: aligned(e), keys: Object.keys(S.GAS) };
}

/* ---- The run overview: one gas at a time, every injection's fit and the GC table's value ----
   For entry e (with chromatograms): the gas shown (g), its conversion (c) and its words (G),
   area or concentration (mode), the x of each injection (xs: hours from the first, or its
   number), the fits (fit) and the table's values (table: its concentration, or the area it
   stands for at the run's k), the suspicious (bad), the axes, the points (pts) and what a
   point says (look). */
export function overviewOf(U, S, C, e){
  const R = resOf(U, S, C, e.tcd), res = R.res || [];
  const conv = convAll(U, S, C, e, res), J = judge(S, e, res);
  const g = S.GAS[C.ovGas] ? C.ovGas : 'h2', c = conv[g], G = S.gasOf(g);
  const mode = C.ovY === 'conc' && c && c.f ? 'conc' : 'area';
  const t0 = aligned(e) ? Math.min(...e.table.injDates.map(Number)) : 0;
  const xOf = k => aligned(e) ? (e.table.injDates[k] - t0)/3600e3 : k + 1;
  const xs = Array.from({ length: e.n }, (_, k)=> xOf(k));
  const unit = c && c.how === 'cal' ? C.cal.unit : '%mol', mul = unit === 'ppm' ? 1e4 : 1;
  const val = A => mode === 'conc' ? (fin(A) ? c.f(A)*mul : NaN) : A;
  const fit = res.map(x=> x && x.gases && x.gases[g] ? val(x.gases[g].area) : NaN);
  while (fit.length < e.n) fit.push(NaN);
  const tv = aligned(e) && e.table.gas[g] ? Array.from(e.table.gas[g]) : null, P = J.prop[g];
  const table = !tv ? null : mode === 'conc' ? tv.map(v=> fin(v) ? v*mul : NaN) : P ? tv.map(v=> fin(v) ? v*P.k : NaN) : null;
  const bad = xs.map((_, k)=> J.bad(k, g));
  const O = { res, g, c, G, mode, xs, unit, fit, tv, table, bad, ...overviewAxes(fit, table, xs) };
  O.ylabel = mode === 'conc' ? `${G.txt} (${unit})` : `${G.txt} area`;
  O.pts = [];
  fit.forEach((v, k)=>{ if (fin(v)) O.pts.push({ k, x: xs[k], y: v, color: bad[k] ? C_BAD : S.C_FIT }); });
  O.look = overviewLook(e, O);
  return O;
}
function overviewAxes(fit, table, xs){
  const all = [...fit, ...(table || [])].filter(fin);
  const xmin = Math.min(...xs), xmax = Math.max(...xs), dx = (xmax - xmin)*0.04 || 0.5;
  const ylo = all.length ? Math.min(0, ...all) : 0, yhi = all.length ? Math.max(...all) : 1;
  return { xr: [xmin - dx, xmax + dx], yr: [ylo, yhi*1.08 || 1] };
}
// What a point hovered says: its injection and time, the fit, the table's value, χ²ᵣ.
function overviewLook(e, O){
  const tUnit = e.table && e.table.altExport === true ? 'ppm' : '%mol';
  const fmtV = v => !fin(v) ? '—' : O.mode === 'conc' ? `${sig(v, 4)} ${O.unit}` : sig(v, 5);
  return k =>{
    const r = O.res[k], x = r && r.gases && r.gases[O.g], tvk = O.tv ? O.tv[k] : NaN;
    const lines = [injName(e, k), `fit: ${fmtV(O.fit[k])}`];
    if (O.tv) lines.push(`GC table: ${fin(tvk) ? sig(tUnit === 'ppm' ? tvk*1e4 : tvk, 4) + ' ' + tUnit : 'n.a.'}`);
    lines.push(`χ²ᵣ: ${x && fin(x.chi2r) ? x.chi2r.toFixed(2) : '—'}`);
    if (O.bad[k]) lines.push('suspicious');
    return lines;
  };
}
// A lighter tint of a colour (#rrggbb): `f` of the way to white.
export const tint = (hex, f)=>{ const n = parseInt(hex.slice(1), 16), ch = s => Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255))*f); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; };
// The injection nearest a point (cx, cy) of plot P on screen, within 14 px (−1: none).
export function nearest(P, pts, cx, cy){
  let best = -1, bd = 14;
  pts.forEach(q=>{ if (q.x < P.xmin || q.x > P.xmax) return; const d = Math.hypot(P.px(q.x) - cx, P.py(q.y) - cy); if (d < bd){ bd = d; best = q.k; } });
  return best;
}

/* ---- The status, the card's alerts ---- */
/* What the status line says: { st (status), left (this card's chromatograms not
   integrated with its method), pct, state: 'running' | 'failed' | 'stopped' | 'soon' |
   'left' | 'done' | 'none' }. */
export function progressOf(U, S, C){
  const st = status(S), mine = new Set(tcdRecs(S, C).map(r=> keyOf(U, r, C.method)));
  const left = wanted(U, S).filter(g=> mine.has(g.key)).reduce((s, g)=> s + g.miss.length, 0);
  const total = entriesOf(S).reduce((s, e)=> s + e.n, 0);
  const pct = st.job ? (st.job.total ? Math.round(100*st.job.done/st.job.total) : 0) : 0;
  const state = st.job ? 'running' : st.failed ? 'failed' : left && st.halted ? 'stopped' : left && st.soon ? 'soon' : left ? 'left' : total ? 'done' : 'none';
  return { st, left, pct, state };
}
/* The facts the card's alerts say (gc-integ-html.js alertsHtml): the files that could not
   be read (errs); what to check (warn: a count that differs, two files of raw chromatograms
   paired, raw chromatograms alone, a gas's injections outside its standards' range); a
   calibration taken from the GC software's table for some file (transfer). */
export function alertFacts(U, S, C){
  const es = entriesOf(S), warn = [];
  es.forEach(e=>{
    if (e.d.error) return;
    if (e.table && e.rows !== e.n) warn.push({ kind: 'rows', e });
    if (!e.table && e.twin) warn.push({ kind: 'twin', e });
    else if (!e.table) warn.push({ kind: 'alone', e });
  });
  /* A gas calibrated by standards whose injections fall outside the standards' range:
     extrapolated, said (below the lowest standard the intercept weighs most: the real O₂
     runs, about 0.03 %mol, lie far under the 0.2 %mol standard). */
  Object.keys(S.GAS).forEach(g=>{
    const L = calFit(U, S, C, g);
    if (!L) return;
    const cs = L.pts.map(q=> toPct(q.conc, C.cal.unit)), lo = Math.min(...cs), hi = Math.max(...cs);
    es.forEach(e=>{
      const R = resOf(U, S, C, e.tcd);
      if (e.d.error || !R.res || R.stale) return;
      const v = R.res.map(x=> x && x.gases && x.gases[g] && fin(x.gases[g].area) ? toPct((x.gases[g].area - L.intercept)/L.slope, C.cal.unit) : NaN).filter(fin);
      const out = v.filter(c=> c < lo || c > hi).length;
      if (out) warn.push({ kind: 'out', e, g, out, n: v.length, lo, hi, below: v.some(c=> c < lo), L });
    });
  });
  return { errs: es.filter(e=> e.d.error), warn };
}

/* ---- Its CSVs ---- */
// integration.csv: every chromatogram's values (the run overview's).
export function integrationCsv(U, S, C, es){
  const gs = Object.keys(S.GAS), gasOf = S.gasOf;
  let t = U.csvLine(['File', 'Table', 'Injection', 'Injection date', ...gs.flatMap(g=> [`${gasOf(g).csv} area`, `${gasOf(g).csv} area sd`, `${gasOf(g).csv} apex (s)`, `${gasOf(g).csv} chi2r`, `${gasOf(g).csv} (%mol)`, `${gasOf(g).csv} source`, `${gasOf(g).csv} table (%mol)`, `${gasOf(g).csv} suspicious`]), 'Flags']);
  es.forEach(e=>{
    if (e.d.error) return;
    const R = resOf(U, S, C, e.tcd), res = R.stale ? [] : R.res || [], conv = convAll(U, S, C, e, res), J = judge(S, e, res);
    for (let k = 0; k < e.n; k++){
      const r = res[k], times = aligned(e) ? e.table.injDates : null;
      t += U.csvLine([e.tcd.name, e.table ? e.table.name : '', String(k + 1), times ? isoLocal(times[k]) : '', ...gs.flatMap(g=>{
        const x = r && r.gases && r.gases[g], c = conv[g];
        return [U.fmtNum(x ? x.area : NaN, 6), U.fmtNum(x ? x.sd : NaN, 6), U.fmtNum(x ? x.tApex : NaN, 3), U.fmtNum(x ? x.chi2r : NaN, 4),
          x && c && c.f ? U.fmtNum(c.f(x.area), 6) : '', c && c.f ? (c.how === 'cal' ? 'calibration' : `transfer (k = ${sig(c.k, 6)})`) : '', aligned(e) && e.table.gas[g] ? U.fmtNum(e.table.gas[g][k], 6) : '',
          r ? (J.bad(k, g) ? 'yes' : 'no') : ''];
      }), J(k).join('; ')]);
    }
  });
  return t;
}
// A chromatogram drawn (drawPair's `drawn`): the whole of it, its model and parts and its
// residuals, these blank outside the fit window.
export function chromCsv(U, d){
  const at = new Map(), cols = [], heads = [];
  const put = (h, xs, ys)=>{ const m = new Map(); xs.forEach((x, i)=> m.set(x, ys[i])); cols.push(m); heads.push(h); };
  d.curves.forEach(({ wr, c })=>{
    if (c.model) put(`model ${wr.key}`, c.t, c.model);
    if (c.base) put(`baseline ${wr.key}`, c.t, c.base);
    Object.entries(c.peaks || {}).forEach(([name, cv])=> put(`${name} (on the baseline)`, c.t, c.base ? cv.map((v, i)=> v + c.base[i]) : cv));
    if (c.residual) put(`residual ${wr.key}`, c.t, c.residual);
  });
  d.t.forEach((x, i)=> at.set(x, d.y[i]));
  let ct = U.csvLine(['Time (s)', 'TCD signal', ...heads]);
  d.t.forEach(x=>{ ct += U.csvLine([U.fmtNum(x, 4), U.fmtNum(at.get(x), 6), ...cols.map(m=> m.has(x) ? U.fmtNum(m.get(x), 6) : '')]); });
  return ct;
}

/* ---- The calibration's window ---- */
// (a line of the alerts ends with a full stop: utils.js fileLine)
const full = t => /[.?!]$/.test(t) ? t : t + '.';
/* A file dropped, told by what it holds (v549): raw chromatograms (gc-pair.js looksTcd),
   { kind: 'tcd', name, bytes, d }, or a GC table (gc.js's reader), { kind: 'table', name,
   bytes, t }; else { bad } (why it is not loaded). */
export function takeDropped(S, name, bytes){
  let text;
  try { text = decodeText(bytes); } catch(e){ return { bad: `${name}: not text.` }; }
  if (looksTcd(text)){
    let d;
    try { d = readTcd(text); } catch(e){ d = { error: String(e && e.message || e) }; }
    if (d.error) return { bad: `${name}: raw chromatograms that cannot be read: ${full(d.error)}` };
    return { kind: 'tcd', name, bytes, d };
  }
  const t = tableOf(S, bytes);
  // (a GC table with no injection to read, its why: v571; to v570 "neither raw chromatograms
  // nor a GC table" all the same)
  if (t.error) return { bad: /^not a GC table: /.test(t.error) ? `${name}: neither raw chromatograms nor a GC table: ${full(t.error.replace(/^not a GC table: /, ''))}` : `${name}: ${full(t.error)}` };
  return { kind: 'table', name, bytes, t };
}
/* The files dropped (`got`) and those waiting (`held`) paired: a table and raw
   chromatograms of one name (with and without _TCD, a browser's " (1)" aside: stemOf) a
   pair, added (`add`) when the table has as many injections as there are chromatograms (its
   read primed); a table whose partner is a calibration file of v544–v548's (raw
   chromatograms alone) names its standards (`named`); a file whose partner is not there
   waits (`held`, not in the project). What is not loaded, and why, goes into `bad`; the
   files loaded already, by name, into `dup` (v567: to v566 among `bad`). */
export function pairDropped(S, cal, held, got, bad){
  const pool = [...held.filter(h=> !got.some(g=> g.name === h.name)), ...got], stem = x => stemOf(x.name).stem;
  const loaded = new Set(cal.files.flatMap(f=> f.table ? [f.name, f.table.name] : [f.name]));
  const add = [], named = [], dup = [];
  pool.forEach(x=>{ if (loaded.has(x.name)){ x.done = true; dup.push(x.name); } });
  // (a pair's counts: the table's injections, its rows with a date and a value as the
  // file list counts them, one a chromatogram)
  const counts = (t, n)=> t.injDates.length === n ? '' : `${plural(t.injDates.length, 'injection')} in the table, ${plural(n, 'chromatogram')}: they must be as many, a name for each chromatogram: nothing integrated`;
  pool.filter(x=> x.kind === 'tcd' && !x.done).forEach(c=>{
    const t = pool.find(x=> x.kind === 'table' && !x.done && stem(x) === stem(c));
    if (!t) return;
    c.done = t.done = true;
    const why = counts(t.t, c.d.cols.length);
    if (why){ bad.push(`${t.name} + ${c.name}: ${full(why)}`); return; }
    prime(S, c.bytes, c.d);
    add.push({ name: c.name, rawBytes: c.bytes, levels: c.d.cols.map(blankLevel), table: { name: t.name, rawBytes: t.bytes } });
  });
  pool.filter(x=> x.kind === 'table' && !x.done).forEach(t=>{
    const fi = cal.files.findIndex((f, i)=> !f.table && !named.some(z=> z.fi === i) && stemOf(f.name).stem === stem(t));
    if (fi < 0) return;
    t.done = true;
    const d = dataOf(S, cal.files[fi]), why = d.error ? `its raw chromatograms cannot be read: ${d.error}` : counts(t.t, d.cols.length);
    if (why){ bad.push(`${t.name} + ${cal.files[fi].name}: ${full(why)}`); return; }
    named.push({ fi, table: { name: t.name, rawBytes: t.bytes } });
  });
  const wait = pool.filter(x=> !x.done);
  wait.forEach(x=> bad.push(x.kind === 'tcd'
    ? `${x.name}: raw chromatograms without their GC table: drop the table too, the same name without _TCD (.csv or .txt); this file waits here for it.`
    : `${x.name}: a GC table without its raw chromatograms: drop them too, the same name with _TCD; this file waits here for them.`));
  return { add, named, held: wait, dup };
}
// The calibration with the pairs added and the tables naming its files (pairDropped's).
export function calWith(cal, add, named){
  const c = calCopy(cal);
  named.forEach(({ fi, table })=>{ c.files[fi] = { ...c.files[fi], table }; });
  c.files.push(...add);
  return c;
}
// A level as typed: blank is none (null), a number at least 0 (either decimal mark), else NaN (refused).
export function levelIn(text){
  const s = text.trim().replace(',', '.'), v = s === '' ? null : Number(s);
  return v !== null && !(fin(v) && v >= 0) ? NaN : v;
}
// How many of the standards' chromatograms are not integrated with the card's method.
export const stdsLeft = (U, S, C)=> C.cal.files.reduce((s, f)=>{ const r = resultsAt(S, keyOf(U, f, C.method)); return s + (r ? r.filter(x=> !x).length : dataOf(S, f).error ? 0 : dataOf(S, f).cols.length); }, 0);
// A thumbnail's polyline of a standard's chromatogram over the windows (range lo–hi), or ''.
export function thumbPoints(d, j, lo, hi, W, H){
  const t = d.t, y = d.cols[j], xs = [], ys = [];
  for (let i = 0; i < t.length; i += 2) if (t[i] >= lo && t[i] <= hi && fin(y[i])){ xs.push(t[i]); ys.push(y[i]); }
  if (xs.length < 2) return '';
  const y0 = Math.min(...ys), y1 = Math.max(...ys) || y0 + 1;
  return xs.map((x, i)=> `${((x - lo)/(hi - lo)*W).toFixed(1)},${(H - 1 - (ys[i] - y0)/((y1 - y0) || 1)*(H - 2)).toFixed(1)}`).join(' ');
}
/* A gas's standards as its plot draws them: the line (L, or null), the standards (pts),
   their levels (xs) and areas (ys), the plot's x top (xmax) and y range (ylo, ymax). */
export function calGasOf(U, S, C, g){
  const L = calFit(U, S, C, g), pts = calPoints(U, S, C, g);
  if (!pts.length) return { L, pts };
  const xs = pts.map(x=> x.lv[g]), ys = pts.map(x=> x.r.gases[g].area);
  const xmax = Math.max(...xs) || 1, ymax = Math.max(...ys, L ? L.slope*xmax + L.intercept : 0) || 1;
  return { L, pts, xs, ys, xmax, ymax, ylo: Math.min(0, ...ys, L ? L.intercept : 0) };
}
// A line's levels: [concentration, the standards at it (each with its fitted area)], in order.
export function levelsOf(L){
  const levels = new Map();
  (L.residuals || []).forEach(r=>{ const k = String(r.conc); if (!levels.has(k)) levels.set(k, []); levels.get(k).push(r); });
  return [...levels.entries()].sort((a, b)=> a[0] - b[0]);
}

/* ---- The card's state: saved and put back ---- */
// (ovGas kept as v544 had it, a list: one gas now)
export const snapshotOf = C => ({ method: clone(C.method), cal: calCopy(C.cal), ovGas: [C.ovGas], ovY: C.ovY });
export function restoreCard(U, S, C, s0){
  const s = U.isObj(s0) ? s0 : {};
  const m = methodIn(U, s.method);
  if (methodKey(U, m) !== methodKey(U, C.method)) C.wasMethod = null;
  C.method = m; C.cal = calIn(U, s.cal);
  C.ovGas = (Array.isArray(s.ovGas) ? Object.keys(S.GAS).find(g=> s.ovGas.includes(g)) : null) || 'h2';
  C.ovY = U.oneOf(s.ovY, ['conc', 'area']);
  C.valuesKept.clear();
}
// A method set (setMethod): taken, with the one before it kept for its results meanwhile.
export function takeMethod(U, C, m){
  C.wasMethod = C.method;
  C.method = methodIn(U, m);
}
// (what gc.js shows of a card beside its state, and what it gives back)
export const showsOf = (S, C)=>{ const e = curOf(S, C); return e ? { file: e.name, k: C.selK } : null; };
export function showNext(U, C, v){ if (U.isObj(v) && typeof v.file === 'string'){ C.selName = v.file; C.selK = Number.isInteger(v.k) && v.k >= 0 ? v.k : 0; } }
