import { esc, csvLine, fmtNum, alertHtml, setupDropzone, X_SVG, bytesKey, fixed, exactKey, objId, guardNumericInput, flashFieldInvalid, kept } from './utils.js';
import { Plot, svgEl, linkX, niceTicks } from './plot.js';
import { plotWrap, chipRow, viewOf, setView, PLOT_DL_ICON } from './modcharts.js';
import { cardInfo } from './cards.js';
import { isObj, oneOf } from './modkit.js';
import { decodeText } from './textdata.js';
import { DEFAULT_METHOD, readTcd, windowCurves, fitCalibration, transferK } from './gc-tcd.js';
import { integrateMany } from './gc-tcd-pool.js';
import { snavHtml, snav } from './snav.js';

/* =========================================================
   GC: THE INTEGRATION CARD (v544; v545: its layout, the chromatogram over its residuals,
   the run overview one gas at a time, the selectors, no trapezoids, the suspicious rule)
   The raw chromatograms (TCD) of a GC card integrated again by the engine (gc-tcd.js):
   each injection's H₂ and O₂ peaks fitted with a model of the window they sit in, turned
   into concentrations by a calibration of standards or by the GC software's own scale, and
   handed to the Production Rate cards below it (gc.js).

   createInteg(ctx) is the instance's (one per GC tab), shared by its Integration cards:
   - the raw chromatograms read from their bytes (kept by them: readTcd once per file);
   - the results, by the file's bytes and the method (`store`: a key `bytes|method` → a result
     per chromatogram, null where none yet): a pure function of the two, so they are written
     into every state of the history that holds the file (kit.patch) as they come, no step
     of their own, and saved with the project (the module state's `integ`, the keys its cards
     use), so that a project reopened, a tab woken or an undo never fits again;
   - the job: what no result is held for, integrated in the background (gc-tcd-pool.js), one
     file after another, with its progress and Stop on every Integration card.
   ctx: { kit, all (every record, in list order), cards() (the deck's records), inst(id),
   drawable(), shown(), folded(rec), layer, isTcd(rec), changed() (results came in: the cards below
   follow) }.
========================================================= */
const GAS = {
  h2: { label: 'H<sub>2</sub>', txt: 'H₂', csv: 'H2', color: '#3aa0ff' },
  o2: { label: 'O<sub>2</sub>', txt: 'O₂', csv: 'O2', color: '#ff7a59' },
};
const gasOf = k => GAS[k] || { label: esc(k), txt: k, csv: k, color: '#4cc9a0' };
const PEAK_COLORS = ['#9b7bff', '#4cc9a0', '#e3b341', '#d95fd0'];
const C_RAW = '#8a95a3', C_MODEL = '#e0457b', C_BASE = '#d4a72c', C_EDGE = '#4cc9a0', C_BAD = '#ff3b3b', C_TABLE = '#9aa3ad';
const MARGIN = 4;            // s shown either side of the windows (and of their neighbours)
/* The peaks beside the H₂/O₂ window that its model has no peak for (ENGINE.md §6): the system
   peak at 262–267.5 s and N₂ from about 330.5 s. Drawn on the chromatogram; an edge of a
   window inside one is said (±5 s from the default reaches them, and the fit degrades). */
const NEIGHBOURS = [{ name: 'S264', from: 262, to: 267.5 }, { name: 'N2', from: 330.5, to: 337.6 }];
/* What marks a chromatogram as suspicious for a gas (judge, v545), any of:
   1. a χ²ᵣ above 4, after the fit's restart (ENGINE.md §8: the robust pass stops at 100
      evaluations, and its worst outcome reads χ²ᵣ 41; a clean real run reads 2–3.5);
   2. a fit that did not converge (or a chromatogram the engine could not fit);
   3. its area out of proportion with the GC software's table: over the run (the pair), at
      each injection with a table value r_i = A_i / T_i, k = median(r_i) (transferK's
      quantity, with no threshold); suspicious where |A_i − k·T_i| > max(3 % of k·T_i,
      k × 15 ppm), the floor in the table's unit (0.0015 %mol, or 15 ppm for the .txt
      export). No comparison where the table has no value. Areas, not concentrations: with
      O₂'s free intercept every calibrated O₂ would differ from the table by one factor.
   A glitch zone left out of the fit is no longer one (v544 marked it). */
const PROP_TOL = 0.03, PROP_FLOOR = { '%mol': 0.0015, ppm: 15 };
const CHI2_HIGH = 4;
/* The method's fields (ENGINE.md §6): the windows' edges, numbers that are its source of
   truth, the lines on the chromatogram an aid that snaps to the data's 0.2 s and writes into
   them. (v545: the trapezoids, a check beside the fit, are gone.) */
const SNAP = 0.2, snap = v => Math.round(v/SNAP)*SNAP, round1 = v => +v.toFixed(2);
const UNITS = ['%mol', 'ppm'];
const toPct = (v, unit)=> unit === 'ppm' ? v/1e4 : v;
const fin = v => Number.isFinite(v);
const sig = (v, n = 4)=> fin(v) ? (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-3 && v) ? v.toExponential(n - 1) : String(+v.toPrecision(n))) : '—';

/* ---- The method: the engine's own, its windows' edges the card's ---- */
// (DEFAULT_METHOD is deep-frozen: a card's method is a copy)
const clone = m => structuredClone(m);
/* A method as a project holds it (RESTORED): the default's, each window's edges where the
   saved one has that window with edges that are numbers, its start before its end. What
   else a method holds is the engine's, as it is (a v544 project's trapezoids ignored). */
function methodIn(m){
  const out = clone(DEFAULT_METHOD);
  const ws = isObj(m) && Array.isArray(m.windows) ? m.windows : [];
  out.windows.forEach(w=>{
    const s = ws.find(x=> isObj(x) && x.key === w.key);
    if (s && fin(s.from) && fin(s.to) && s.from < s.to){ w.from = s.from; w.to = s.to; }
  });
  return out;
}
// (a stored result's null, JSON's NaN, read back as NaN, never as 0: ENGINE.md §8)
const deNull = v => v === null ? NaN : Array.isArray(v) ? v.map(deNull) : isObj(v) ? Object.fromEntries(Object.entries(v).map(([k, x])=> [k, deNull(x)])) : v;
const methodKey = m => exactKey(m.windows.map(w=> [w.key, w.from, w.to]).concat([JSON.stringify(m)]));
/* A results' key as v544 wrote it (a project saved then): its method held the trapezoids
   (`trapezoid`, and its fit's spikes.roundsTrapezoid), which no fit ever read, and the key
   holds the method's JSON, so v545's key for the same file and windows differs. Read back
   without them it is v545's key, and the results are found under it: nothing is fitted
   again (the results themselves are the fit's: their `trap`, the trapezoids', dropped). */
function normKey(key){
  const i = key.indexOf('|');
  let a, m;
  try { a = JSON.parse(key.slice(i + 1)); m = Array.isArray(a) && typeof a[a.length - 1] === 'string' ? JSON.parse(a[a.length - 1]) : null; } catch(e){ return key; }
  const sp = isObj(m) && isObj(m.fit) && isObj(m.fit.spikes) ? m.fit.spikes : null;
  if (i < 0 || !isObj(m) || !('trapezoid' in m || (sp && 'roundsTrapezoid' in sp))) return key;
  delete m.trapezoid;
  if (sp) delete sp.roundsTrapezoid;
  a[a.length - 1] = JSON.stringify(m);
  return key.slice(0, i + 1) + exactKey(a);
}
const noTrap = r =>{ if (isObj(r) && isObj(r.gases)) Object.values(r.gases).forEach(x=>{ if (isObj(x)) delete x.trap; }); return r; };
const isDefault = m => methodKey(m) === methodKey(methodIn(null));
// A number kept as JSON writes it, rounded to 8 digits (a result as the store keeps it).
/* A result as the store keeps it (and the project): JSON's (a NaN is null, read back as
   none), its numbers to 8 digits, a peak's physical parameters left out (the window's `p`
   gives them, windowCurves draws from it). */
const r8 = v => typeof v === 'number' && fin(v) ? +v.toPrecision(8) : v;
const compact = r => r && deNull(JSON.parse(JSON.stringify(r, (k, v)=> k === 'params' ? undefined : typeof v === 'number' ? r8(v) : ArrayBuffer.isView(v) ? Array.from(v, r8) : v)));
/* The GC software's scale (transferK): the injections whose table value is at least the
   method's minValue (%mol: 0.02 for H₂, the Python's h2_min_calib, 0.012 for O₂), minCount
   of them at least (10); these where the method has none. */
const TRANSFER = { minValue: 0.02, minCount: 10 };

/* ---- The calibration (a card's): its unit, intercept modes, files and levels ---- */
const blankLevel = ()=> ({ h2: null, o2: null, on: true });
function calIn(c){
  const s = isObj(c) ? c : {}, z = isObj(s.zero) ? s.zero : {};
  const lv = v => fin(v) ? v : null;
  const files = Array.isArray(s.files) ? s.files.filter(f=> isObj(f) && f.rawBytes instanceof Uint8Array).map(f=> ({
    name: typeof f.name === 'string' && f.name ? f.name : 'calibration.csv', rawBytes: f.rawBytes,
    levels: Array.isArray(f.levels) ? f.levels.map(x=> isObj(x) ? { h2: lv(x.h2), o2: lv(x.o2), on: x.on !== false } : blankLevel()) : [] })) : [];
  return { unit: oneOf(s.unit, UNITS), zero: { h2: z.h2 === true, o2: z.o2 === true }, files };
}
const calCopy = c => ({ unit: c.unit, zero: { ...c.zero }, files: c.files.map(f=> ({ ...f, levels: f.levels.map(l=> ({ ...l })) })) });

/* "From the area to the concentration", a box of its own in the card's instructions, as the
   Production Rate card's "From the reading to the rates" (gc.js RATES_HTML): the standards'
   line, a concentration from it, and the GC software's scale taken over, typeset in MathML. */
const CONC_HTML = (()=>{
  const mi = s => `<mi>${s}</mi>`, mo = s => `<mo>${s}</mo>`, up = s => `<mi mathvariant="normal">${s}</mi>`;
  const mrow = (...xs)=> `<mrow>${xs.join('')}</mrow>`, mfrac = (a, b)=> `<mfrac>${a}${b}</mfrac>`, msub = (a, b)=> `<msub>${a}${b}</msub>`;
  const display = (...xs)=> `<math display="block">${xs.join('')}</math>`, im = (...xs)=> `<math>${xs.join('')}</math>`;
  const A = mi('A'), c = mi('c'), s = mi('s'), b = mi('b'), k = mi('k'), i = mi('i'), eq = mo('='), Ai = msub(A, i), ci = msub(c, msub(mi('T'), i));
  const step = (title, what, eqs, ...lines)=> `<li><b>${title}.</b> ${what}<div class="instr-eqbox">${eqs.join('')}</div>${lines.map(l=> `<div class="instr-units">${l}</div>`).join('')}</li>`;
  return '<div class="instr-math"><h4 class="instr-math-head">From the area to the concentration</h4><ol class="instr-steps">'
    + step('The standards\' line', 'Fitted by least squares to the standards of the gas (free intercept), or through zero.', [display(A, eq, s, mo('⋅'), c, mo('+'), b)],
      `${im(A)}: the fitted area; ${im(c)}: the standard's concentration, in the unit chosen (%mol or ppm); ${im(s)}: the slope, area per unit; ${im(b)}: the intercept (0 through zero).`)
    + step('A concentration from it', 'Each injection\'s area turned back into a concentration; in ppm, divided by 10⁴ for the rates, which take %mol.', [display(c, eq, mfrac(mrow(A, mo('−'), b), s))])
    + step('Without standards: the GC software\'s scale', `For each pair, over its injections ${im(i)} whose table value ${im(ci)} is at least 0.02 %mol for H₂, 0.012 %mol for O₂ (ten of them at least), the median of the area over the table's value; then each concentration.`,
      [display(k, eq, up('median'), mrow(mo('('), mfrac(Ai, ci), mo(')'))), display(c, eq, mfrac(A, k))],
      `${im(k)}: area per %mol; ${im(c)}: %mol. A line through zero, whatever the software's own calibration was.`)
    + '</ol></div>';
})();
export const INTEG_INFO = `The <b>Integration</b> card integrates again the raw chromatograms of the thermal-conductivity detector (TCD), the files of a column per injection that the GC software writes beside its table, and hands the results to the <b>Production Rate</b> cards below it. Each injection's <b>H₂ and O₂</b> are fitted together in one <b>window</b> of retention time (268–326 s by default): a smooth baseline (a straight line, with the <b>step</b> the detector makes after O₂), a peak shape for H₂, for O₂ and for the system peak at 310 s (<b>S310</b>, fitted so that its tail does not end up in O₂'s area; the step and S310 are drawn but go no further). The fit is made in <b>two passes</b>: the first, with a robust loss, finds <b>spikes</b> and <b>glitch zones</b> (marked on the plot in red), which the second, an ordinary least-squares fit, leaves out, so that a spike is never read as gas; a fit that looks wrong is started again from a generic start, and the better of the two kept. <b>The selectors</b>: the file (a pair, or raw chromatograms alone) at the top left of the plot, the chromatogram at its top right; the arrows step through them (← → the chromatograms), and the name, or the small arrow after it, opens the list of them all, to go straight to one. <b>The plot</b>: the chromatogram on top (raw, model, baseline with its step, H₂, O₂ and S310 each drawn on the baseline, the spikes and glitch zones left out in red, the neighbouring peaks the model has no shape for in grey) and its <b>residuals</b> under it (the data less the model, inside the fit window only; blank outside it). The two share the retention time: a zoom or a pan in either (the one under the pointer) moves both along it at once, each keeping its own vertical scale. The plot holds the whole chromatogram and opens on the H₂/O₂ window, where a double click with a tool on brings it back. Its one toolbar gives both: the images, the CSV (the chromatogram on show, its model and parts and its residuals), and the figure composer, where they are two panels, one of which can be removed. <b>Windows</b>: the method is the card's, in these numbers, which are its source of truth: the fit window's edges (the green lines on the chromatogram drag them as an aid, snapping to the data's 0.2 s, and write into the numbers), with the peaks' nominal places. Moving an edge by 1–2 s changes the areas by a few hundredths of a per cent; by 5 s it reaches the peaks the model has no shape for, the system peak at 262–267.5 s and N₂ from about 330.5 s (grey on the chromatogram), and the fit degrades: the card says so. <b>Peaks</b>: the chromatogram on show, per gas: the area of its fitted shape ± its standard deviation, its apex, χ²<sub>r</sub> (how well the model follows the data: about 1, within the noise), its concentration and the GC table's value; why it is suspicious, if it is, under the table. <b>Suspicious</b>: a chromatogram is, for a gas, where χ²<sub>r</sub> is above 4 after the fit's restart (some fits are fragile: the robust pass stops at its 100th evaluation), where the fit did not converge, or where its area is out of proportion with the GC software's table: over the run (the pair), k is the median of area / table value across its injections with a table value, and an injection is suspicious when its area is further from k × its table value than 3 % of that, and than k × 15 ppm (0.0015 %mol, in the table's unit). Areas are compared, not concentrations (with O₂'s free intercept every calibrated value would differ from the table by one factor): a scale that differs from the table's alike at every injection marks none, an injection off on its own does. A glitch zone left out of the fit does not make it suspicious. <b>The colours</b>: in the chromatogram selector and its list, a suspicious chromatogram's name is red (suspicious for either gas); on the run overview a fit is a dot in its gas's colour (H₂ blue, O₂ orange), red where its injection is suspicious for that gas; the GC table's values are grey crosses, never red; in Peaks a χ²<sub>r</sub> above 4 and an area out of proportion are red. The <b>run overview</b> shows, for the file chosen, one gas at a time (H₂ or O₂), as area or as concentration: every injection's fit, and the GC table's value beside it (as area, the table's value times the run's k, on the fits' scale), against the injection time (the injection's number when there is no table). A point under the pointer brightens and says its injection, its time, the fit, the table's value and χ²<sub>r</sub>; a click shows its chromatogram, whose point stays bright, as it does for one chosen by the arrows, the list or the keys. Integration runs by itself in the background when raw chromatograms are loaded, or a little after the method changes; <b>Stop</b> stops it, <b>Re-integrate</b> runs what is left. A changed window integrates every file again; a file added, only itself. <b>Pairs</b>: a table and its raw chromatograms (the same name with _TCD) share a row of the file list; the table's rows with a date are its injections, which must be as many as the chromatograms (else the card says so, and Analysis keeps the table). <b>Concentrations</b>: <b>Calibration…</b> opens the standards' window: drop their raw chromatograms, type each standard's H₂ and O₂ (blank: not a standard of that gas), choose the unit and, per gas, a free intercept (the default: O₂'s response has a real intercept, about −500 ppm, and a line forced through zero biases its low levels by −8 to −26 % while R² barely moves; each level's deviation from the line is shown, since R² cannot tell) or a zero one; the line area = slope × c + intercept is fitted to them and a sample's concentration is (area − intercept) / slope. Standards always win. Without them, the card <b>takes the calibration from the GC software's table</b>: for each pair, k is the median of our area over the table's value across the injections well above the noise (a table value of at least 0.02 %mol for H₂, 0.012 %mol for O₂, ten injections at least), and the concentration is area / k (an info alert says so). <b>The risks of a calibration taken from the GC software</b>, which standards avoid:<ul class="gci-risks"><li>it <b>borrows the software's scale</b>, and assumes that the software's areas are proportional to ours, which a different baseline or peak split breaks (for O₂, on H₂'s tail and before the step, they may well differ);</li><li>the transferred line <b>goes through zero</b>, even if the software's own calibration had an intercept (O₂'s response has one, about −500 ppm: the low levels then come out biased);</li><li>it needs <b>enough injections above the threshold</b> (ten at 0.02 %mol of H₂, 0.012 %mol of O₂): with fewer there is none, and Analysis keeps the table;</li><li>if the <b>software's calibration is wrong, so is this one</b>: it reproduces the table's scale, it does not check it.</li></ul>A Production Rate card takes its values from the nearest Integration card above it; one with none above keeps the tables. ${CONC_HTML}${cardInfo(false, false)}`;
const CAL_INFO = `Each column of a raw calibration file is a standard's chromatogram, integrated with this card's method. Type in each row the standard's H₂ and O₂ concentrations in the unit chosen (blank: not a standard of that gas; the file's own names, cal_… included, are never read), and untick a row to leave it out. Per gas, the line area = slope × c + intercept is fitted by least squares to the standards (free intercept), or through zero; R², and each level's deviation from the line, say how well it holds. The calibration is this card's, saved with the project and its files, and applies to every pair of the card; a gas with two standards or more (one, through zero) is calibrated, the other taken from the GC software's table.`;

export function createInteg(ctx){
  const { kit } = ctx;
  /* ---- The raw chromatograms, read once per file (by its bytes) ---- */
  const read = new WeakMap();
  function dataOf(rec){
    const b = rec && rec.rawBytes;
    if (!(b instanceof Uint8Array)) return { error: 'its bytes are not stored in this browser' };
    let d = read.get(b);
    if (!d){
      try { d = readTcd(decodeText(b)); } catch(e){ d = { error: String(e && e.message || e) }; }
      if (!d || (!d.error && !(d.cols && d.cols.length))) d = { error: d && d.error || 'no chromatogram in it' };
      read.set(b, d);
    }
    return d;
  }
  const fileKey = rec => rec.rawBytes instanceof Uint8Array ? bytesKey(rec.rawBytes) : 'name:' + rec.name;

  /* ---- The results ---- */
  const store = new Map();
  // (`dead`: its instance let go, a tab asleep or closed: a job's end writes nothing)
  let job = null, halted = false, soon = 0, failed = '', dead = false;
  const keyOf = (rec, m)=> fileKey(rec) + '|' + methodKey(m);
  // (the job's own, as they come, over the store's)
  const resultsAt = key => job && job.key === key ? job.work : store.get(key) || null;
  const integCards = ()=> ctx.cards().filter(a=> a.type === 'integ').map(a=> ctx.inst(a.id)).filter(Boolean);
  function usedKeys(){
    const out = new Set();
    integCards().forEach(c=> c.tcdRecs().forEach(r=> out.add(keyOf(r, c.method()))));
    return out;
  }
  // The module state's `integ`: the results the cards use, none where there are none.
  function saved(){
    const out = {};
    usedKeys().forEach(k=>{ const v = store.get(k); if (v && v.some(Boolean)) out[k] = v; });
    return Object.keys(out).length ? out : null;
  }
  // A state's results taken in (RESTORED: an array of objects or nulls under each key),
  // merged with those held (a result held is never taken away). A key of v544's is read as
  // v545's (normKey), its results without their trapezoids.
  function load(obj){
    if (!isObj(obj)) return;
    for (const k0 of Object.keys(obj)){
      const v = obj[k0], k = normKey(k0);
      if (!Array.isArray(v)) continue;
      const had = store.get(k), arr = v.map(x=> isObj(x) && isObj(x.gases) && Array.isArray(x.windows) ? noTrap(deNull(x)) : null);
      if (had && had.length === arr.length) store.set(k, had.map((x, i)=> x || arr[i]));
      else if (!had || !had.some(Boolean)) store.set(k, arr);
    }
  }
  // Whether a state holds the file of this bytes' key (its rows, a pair's mate, a card's
  // calibration): the states a result is written into.
  function holds(s, fk){
    if (!isObj(s)) return false;
    const has = r => isObj(r) && r.rawBytes instanceof Uint8Array && bytesKey(r.rawBytes) === fk;
    if (Array.isArray(s.files) && s.files.some(f=> has(f) || (isObj(f) && has(f.mate)))) return true;
    return Array.isArray(s.cards) && s.cards.some(c=> isObj(c) && isObj(c.cal) && Array.isArray(c.cal.files) && c.cal.files.some(has));
  }
  function write(key, arr){
    store.set(key, arr);
    const fk = key.slice(0, key.indexOf('|'));
    kit.patch(s=> holds(s, fk) ? { ...s, integ: { ...(isObj(s.integ) ? s.integ : {}), [key]: arr } } : s);
  }

  /* ---- The job: every (file, method) a card uses with a chromatogram not integrated ---- */
  function wanted(){
    const out = [], seen = new Set();
    integCards().forEach(c=> c.tcdRecs().forEach(r=>{
      const m = c.method(), key = keyOf(r, m);
      if (seen.has(key)) return;
      seen.add(key);
      const d = dataOf(r);
      if (d.error) return;
      const have = store.get(key) || [];
      const miss = d.cols.map((_, j)=> j).filter(j=> !have[j]);
      if (miss.length) out.push({ key, rec: r, method: m, miss, d });
    }));
    return out;
  }
  const pending = ()=> wanted().reduce((s, g)=> s + g.miss.length, 0);
  // Run what is wanted (`force`: Re-integrate, after a Stop); a job on a file still wanted
  // goes on, one on a file no longer wanted (its method changed) gives way.
  function ensure(force){
    clearTimeout(soon); soon = 0;
    if (force){ halted = false; failed = ''; }
    if (halted){ paint(); return; }
    const w = wanted();
    if (job){
      if (w.some(g=> g.key === job.key)){ job.total = job.done + w.reduce((s, g)=> s + g.miss.length, 0) - job.doneHere; paint(); return; }
      job.ac.abort(); job = null;
    }
    if (!w.length){ paint(); return; }
    run(w[0], w.reduce((s, g)=> s + g.miss.length, 0), 0);
  }
  // A method changed: run after the edits settle (a second without another).
  function later(){ clearTimeout(soon); soon = setTimeout(()=>{ soon = 0; ensure(); }, 1200); paint(); }
  function run(g, total, done){
    const ac = new AbortController();
    const prev = store.get(g.key);
    const work = prev && prev.length === g.d.cols.length ? prev.slice() : new Array(g.d.cols.length).fill(null);
    const j = job = { key: g.key, ac, work, total, done, doneHere: 0, miss: g.miss, name: g.rec.name, t0: performance.now() };
    let last = performance.now();
    integrateMany(g.d.t, g.miss.map(c=> g.d.cols[c]), {
      method: g.method, signal: ac.signal,
      onProgress: (_done, _n, i, r)=>{
        if (job !== j) return;
        // (a chromatogram the engine could not fit is a result too, its error said: else it
        // would be wanted again at once, and fail again)
        work[g.miss[i]] = r && !r.error ? compact(r) : { error: String(r && r.error || 'the integration failed'), gases: {}, windows: [] };
        j.done++; j.doneHere++;
        // (counted for the tests, as utils.js kept counts what is worked out: a project reopened fits none)
        kept.made['gc-tcd'] = (kept.made['gc-tcd'] || 0) + 1;
        // (what came in, shown every half second; written at the file's end)
        if (performance.now() - last > 500){ last = performance.now(); paint(true); }
      },
    }).then(()=>{
      if (job !== j || dead) return;
      job = null;
      write(g.key, work.slice());
      ctx.changed();
      const next = halted ? [] : wanted();
      if (next.length) run(next[0], j.done + next.reduce((s, x)=> s + x.miss.length, 0), j.done);
      else paint(true);
    }, e=>{
      if (job === j) job = null;
      if (dead) return;
      if (work.some(Boolean)) write(g.key, work.slice());
      if (!e || e.name !== 'AbortError'){ failed = String(e && e.message || e); halted = true; }
      ctx.changed();
      paint(true);
    });
    paint();
  }
  function stop(){ halted = true; clearTimeout(soon); soon = 0; if (job){ job.ac.abort(); } paint(); }
  // Every card's status (and, with `all`, its plots: results came in).
  let painting = 0, paintAll = false;
  function paint(all){
    paintAll = paintAll || !!all;
    if (painting || dead) return;
    painting = requestAnimationFrame(()=>{ const a = paintAll; painting = 0; paintAll = false; if (!dead) integCards().forEach(c=> c.paintStatus(a)); });
  }
  const status = ()=> ({ job, halted, soon: !!soon, failed });

  /* ---- A card ---- */
  function card(a, el){
    const p = 'gc' + a.id, $ = id => el.querySelector('#' + p + id);
    let method = methodIn(null), cal = calIn(null);
    // (the run overview's gas, one at a time, and its y: view keys of the state)
    let ovGas = 'h2', ovY = 'conc';
    // What it shows (no state): the file and the chromatogram, by the file's name.
    let selName = null, selK = 0, wasMethod = null, next = null;
    let chrom = null, resid = null, over = null, ovPts = [];

    const calModal = calWindow();

    /* The pairs and files of raw chromatograms it shows: one entry each, in list order (the
       row's included). A table with its raw chromatograms: the table's label, its dates
       when they are as many as the chromatograms; raw chromatograms alone, or two files of
       them paired: each by itself, with no time. */
    function entries(){
      const out = [];
      ctx.all.forEach(r=>{
        if (r.included === false) return;
        const mate = r.mate;
        if (ctx.isTcd(r)){
          out.push({ name: r.name, label: r.label, tcd: r, table: null, twin: mate && ctx.isTcd(mate) ? mate.name : null });
          if (mate && ctx.isTcd(mate)) out.push({ name: mate.name, label: `${r.label} · ${mate.name}`, tcd: mate, table: null, twin: r.name });
        } else if (mate && ctx.isTcd(mate)) out.push({ name: mate.name, label: r.label, tcd: mate, table: r });
      });
      return out.map(e=>{ const d = dataOf(e.tcd); return { ...e, d, n: d.error ? 0 : d.cols.length, rows: e.table ? e.table.injDates.length : null }; });
    }
    const tcdRecs = ()=> [...entries().map(e=> e.tcd), ...cal.files];
    const cur = ()=>{ const es = entries(); return es.find(e=> e.name === selName) || es[0] || null; };
    const aligned = e => !!(e && e.table && !e.d.error && e.rows === e.n);
    // The results of entry e: under the method, else (stale) the one before it.
    function resOf(rec){
      const now = resultsAt(keyOf(rec, method));
      if (now && now.some(Boolean)) return { res: now, m: method, stale: false };
      if (wasMethod){ const old = resultsAt(keyOf(rec, wasMethod)); if (old && old.some(Boolean)) return { res: old, m: wasMethod, stale: true }; }
      return { res: now, m: method, stale: false };
    }

    /* ---- Concentrations: the standards' line per gas, else the software's scale ---- */
    function calRows(){
      const rows = [];
      cal.files.forEach((f, fi)=>{
        const d = dataOf(f), res = d.error ? null : resultsAt(keyOf(f, method));
        const n = d.error ? 0 : d.cols.length;
        for (let j = 0; j < n; j++) rows.push({ f, fi, j, d, lv: f.levels[j] || blankLevel(), r: res && res[j] });
      });
      return rows;
    }
    function calFit(g){
      const pts = calRows().filter(x=> x.lv.on && fin(x.lv[g]) && x.r && x.r.gases && x.r.gases[g] && fin(x.r.gases[g].area)).map(x=> ({ conc: x.lv[g], area: x.r.gases[g].area }));
      let fit = null;
      try { fit = pts.length ? fitCalibration(pts, { zeroIntercept: cal.zero[g] }) : null; } catch(e){ fit = null; }
      return fit && fin(fit.slope) && fit.slope ? { ...fit, pts } : null;
    }
    const calKey = ()=> exactKey([cal.unit, cal.zero, cal.files.map(f=> [fileKey(f), f.levels])]);
    /* How a gas's areas become %mol for an entry: { how: 'cal', f } with the standards, else
       { how: 'transfer', k, n, f } from the table (`tableVals`, %mol, the injections'), else
       { why }. */
    function convOf(g, areas, tableVals){
      const L = calFit(g);
      if (L) return { how: 'cal', fit: L, f: A => toPct((A - L.intercept)/L.slope, cal.unit) };
      if (!tableVals) return { why: `no standards for ${gasOf(g).txt} and no table to take its scale from` };
      let T = null;
      try { T = transferK(areas, Array.from(tableVals, v=> fin(v) ? v : NaN), (isObj(method.transfer) && isObj(method.transfer[g]) ? method.transfer[g] : TRANSFER)); } catch(e){ T = null; }
      if (!T || !fin(T.k) || !T.k) return { why: `no standards for ${gasOf(g).txt}, and too few injections above the threshold to take the GC software's scale` };
      return { how: 'transfer', k: T.k, n: T.n, f: A => A/T.k };
    }
    /* What Analysis takes for a table record f (a sample) paired with its raw chromatograms,
       or null for one with none (the table, nothing said): { gas: { h2, o2 } in %mol (an
       array fixed, kept while nothing changes), how: { gas: 'cal' | 'transfer' | 'table' },
       why: { gas: why the table }, k } or { why } (the table for every gas). */
    const valuesKept = new Map();
    function valuesFor(f){
      const tcd = f && f.mate && ctx.isTcd(f.mate) ? f.mate : null;
      if (!tcd) return null;
      const d = dataOf(tcd);
      if (d.error) return { why: `its raw chromatograms could not be read (${d.error})` };
      const n = d.cols.length, rows = f.injDates.length;
      if (n !== rows) return { why: `${rows} row${rows === 1 ? '' : 's'} in the table, ${n} chromatogram${n === 1 ? '' : 's'}` };
      const res = resultsAt(keyOf(tcd, method));
      if (!res || res.some(x=> !x)){ const st = status(); return { why: st.halted ? 'its integration was stopped before its end' : 'its integration is not done yet', waiting: true }; }
      const vk = exactKey([keyOf(tcd, method), calKey(), Object.keys(f.gas).map(k=> [k, objId(f.gas[k])]), objId(res)]);
      if (valuesKept.has(vk)) return valuesKept.get(vk);
      const gas = {}, how = {}, why = {}, k = {};
      Object.keys(GAS).forEach(g=>{
        const areas = res.map(x=> x.gases && x.gases[g] && fin(x.gases[g].area) ? x.gases[g].area : NaN);
        const c = convOf(g, areas, f.gas[g]);
        if (c.f){ gas[g] = fixed(areas.map(A=> fin(A) ? c.f(A) : NaN)); how[g] = c.how; if (c.how === 'transfer') k[g] = { k: c.k, n: c.n }; }
        else if (f.gas[g]){ gas[g] = f.gas[g]; how[g] = 'table'; why[g] = c.why; }
      });
      const out = { gas, how, why, k, areas: Object.fromEntries(Object.keys(GAS).map(g=> [g, res.map(x=> x.gases && x.gases[g] ? x.gases[g].area : NaN)])) };
      if (valuesKept.size > 64) valuesKept.delete(valuesKept.keys().next().value);
      valuesKept.set(vk, out);
      return out;
    }

    /* ---- Its markup (v545) ----
       The status line (only while there is something to say: the progress and Stop as it
       integrates), the alerts; then, as a DRS card is laid out, the plot's column at the
       left, as wide as a Tauc card's plot: the selectors over the plot (the file's at its
       left, the chromatogram's at its right, mirrored, both arrows outermost) with the
       plot's toolbar between them, the chromatogram over its residuals (together a Tauc
       plot's size), their legend, and the run overview (as wide, half as tall); at the right
       the Windows, the Peaks of the chromatogram on show and Calibration…. */
    const body = el.querySelector('.gci-body');
    body.innerHTML = `
      <div class="gci-bar" id="${p}Bar">
        <div class="gci-status" id="${p}Status" role="status"></div>
        <div class="gci-acts">
          <button type="button" class="btn gci-run" id="${p}Run" title="Integrate what is not integrated with this method">↻ Re-integrate</button>
          <button type="button" class="btn gci-stop" id="${p}Stop" title="Stop the integration (what is done is kept)">Stop</button>
        </div>
      </div>
      <div class="gci-alerts" id="${p}Alerts"></div>
      <div class="gci-notice" id="${p}Notice"></div>
      <div class="row gci-row">
        <div class="col mw520 gci-main">
          <div class="plot-nav-row gci-nav">
            ${snavHtml({ idx: p + 'FileIdx', name: p + 'File', prevCls: 'gci-fprev', nextCls: 'gci-fnext', what: 'file', keys: false, cls: 'gci-fsel' })}
            <div class="gci-right">
              <div class="gci-tools"><button class="btn plot-dl-btn" data-dl-svg="${p}Chrom" data-dl-also="${p}Resid" data-csv-mod="gc" data-csv-names="chromatogram.csv" data-dl-name="GC_chromatogram.svg" data-dl-legend="${p}ChromLegend">${PLOT_DL_ICON}</button></div>
              ${snavHtml({ idx: p + 'InjIdx', name: p + 'Inj', prevCls: 'gci-kprev', nextCls: 'gci-knext', what: 'chromatogram', mirror: true, cls: 'gci-ksel' })}
            </div>
          </div>
          <div class="plot-wrap gci-pair">
            <svg class="plot gci-chrom" id="${p}Chrom"></svg>
            <svg class="plot gci-resid" id="${p}Resid"></svg>
          </div>
          <div id="${p}ChromLegend" class="legend gci-legend"></div>
          <p class="txt-caption gci-ov-cap">Run overview</p>${plotWrap(p + 'Over', { mod: 'gc', name: 'GC_run_overview.svg', legend: p + 'OverLegend', csv: 'integration.csv', cls: 'gci-over',
            extra: `\n              <span class="plot-chips gci-ov-sel"><span class="gci-ov-gas"></span><span class="gci-ov-y"></span></span>` })}
          <div id="${p}OverLegend" class="legend gci-legend"></div>
        </div>
        <div class="col mw280 gci-side">
          <div class="peak-box gci-win-box"><div class="peak-box-head"><span class="txt-mini">Windows</span><button type="button" class="btn btn-sm gci-reset" title="The engine's default windows" hidden>Default</button></div><div class="gci-method" id="${p}Method"></div></div>
          <div class="peak-box gci-values-box"><div class="peak-box-head"><span class="txt-mini">Peaks</span></div><div class="peak-scroll" id="${p}Values"></div></div>
          <button type="button" class="btn plot-action-btn gci-cal" id="${p}Cal" title="The standards: their raw chromatograms and concentrations">Calibration…</button>
        </div>
      </div>`;

    /* ---- The selectors (snav.js): the file, and its chromatogram; a suspicious one's name
       red, in the list too ---- */
    const pad = v => String(v).padStart(2, '0');
    const clock = d =>{ const x = new Date(d); return fin(+x) ? `${pad(x.getDate())}/${pad(x.getMonth() + 1)} ${pad(x.getHours())}:${pad(x.getMinutes())}` : ''; };
    // (the selector's name short, its count beside it; the tooltip and the overview's label whole)
    const injName = (e, k)=> `Injection ${k + 1}${aligned(e) ? ' · ' + clock(e.table.injDates[k]) : ''}`;
    const injShort = (e, k)=> aligned(e) ? `#${k + 1} · ${clock(e.table.injDates[k])}` : `Injection ${k + 1}`;
    let shownJ = null;      // the judge of the entry on show (renderSel)
    const fileNav = snav(el.querySelector('.gci-fsel'), {
      count: ()=> entries().length, index: ()=>{ const c = cur(); return c ? entries().findIndex(x=> x.name === c.name) : 0; },
      label: i =>{ const x = entries()[i]; return x ? x.label + (x.table ? '' : ' (no table)') : ''; },
      title: i =>{ const x = entries()[i]; return x ? `${x.label}${x.table ? ` (${x.table.name} + ${x.tcd.name})` : ` (${x.tcd.name}, no table)`}` : ''; },
      go: i =>{ const x = entries()[i]; if (x){ selName = x.name; selK = 0; draw(); } },
    });
    const injNav = snav(el.querySelector('.gci-ksel'), {
      count: ()=>{ const e = cur(); return e ? e.n : 0; }, index: ()=> selK,
      label: k => injShort(cur(), k),
      title: k =>{ const e = cur(); return `${injName(e, k)}${e ? ` of ${e.n}` : ''}${shownJ && shownJ.bad(k) ? ' (suspicious)' : ''}`; },
      bad: k => !!(shownJ && shownJ.bad(k)),
      go: k =>{ selK = k; draw(); },
    });
    function renderSel(){
      const e = cur();
      if (e){ selName = e.name; if (selK >= e.n) selK = Math.max(0, e.n - 1); }
      shownJ = e && !e.d.error ? judge(e, resOf(e.tcd).res) : null;
      fileNav.update(); injNav.update();
    }
    const stepFile = d =>{ const es = entries(), c = cur(), i = c ? es.findIndex(x=> x.name === c.name) : -1; if (es.length < 2) return; selName = es[(i + d + es.length) % es.length].name; selK = 0; draw(); };
    const stepK = d =>{ const e = cur(); if (!e || e.n < 2) return; selK = (selK + d + e.n) % e.n; draw(); };
    el.querySelector('.gci-fprev').addEventListener('click', ()=> stepFile(-1));
    el.querySelector('.gci-fnext').addEventListener('click', ()=> stepFile(1));
    el.querySelector('.gci-kprev').addEventListener('click', ()=> stepK(-1));
    el.querySelector('.gci-knext').addEventListener('click', ()=> stepK(1));
    $('Run').addEventListener('click', ()=> ensure(true));
    $('Stop').addEventListener('click', ()=> stop());
    $('Cal').addEventListener('click', ()=> calModal.open());

    /* The judge of entry e's results `res` (see PROP_TOL): J(k, gases) the reasons that mark
       injection k (none: []), J.bad(k, g) whether it is suspicious for gas g (any gas: g
       omitted), J.off(k, g) its area's relative deviation from k × its table value where
       that is out of proportion (else null), J.prop[g] the run's { k, n } (null without a
       table value), J.chiMax. */
    function judge(e, res){
      res = res || [];
      const tab = aligned(e) ? e.table : null, ppm = !!(tab && tab.altExport === true);
      const prop = {};
      Object.keys(GAS).forEach(g=>{
        const tv = tab && tab.gas[g];
        prop[g] = null;
        if (!tv) return;
        const areas = res.map(x=> x && x.gases && x.gases[g] && fin(x.gases[g].area) ? x.gases[g].area : NaN);
        let T = null;
        try { T = transferK(areas, Array.from(tv, v=> fin(v) ? v : NaN), { minValue: 0, minCount: 1 }); } catch(err){ T = null; }
        if (T && fin(T.k) && T.k > 0) prop[g] = { k: T.k, n: T.n, areas, tv };
      });
      // (in the table's unit: %mol, or ppm for the .txt export; k per that unit)
      const off = (k, g)=>{
        const P = prop[g];
        if (!P) return null;
        const A = P.areas[k], T = P.tv[k];
        if (!fin(A) || !fin(T)) return null;
        const U = ppm ? 1e4 : 1, ku = P.k/U, want = ku*T*U, floor = ku*PROP_FLOOR[ppm ? 'ppm' : '%mol'];
        return Math.abs(A - want) > Math.max(PROP_TOL*Math.abs(want), floor) ? (want ? (A - want)/want : Infinity) : null;
      };
      // The fit's own marks, the window of gas g's (any window, g omitted).
      const fitMarks = (r, g)=>{
        if (!r) return [];
        if (typeof r.error === 'string') return [`not integrated: ${r.error}`];
        const ws0 = Array.isArray(r.windows) ? r.windows : [], wk = g && r.gases && r.gases[g] ? r.gases[g].window : null;
        const ws = wk ? ws0.filter(x=> x.key === wk) : ws0, out = [];
        const w = ws.find(x=> fin(x.chi2r) && x.chi2r > CHI2_HIGH);
        if (w) out.push(`χ²ᵣ ${w.chi2r.toFixed(2)}, above ${CHI2_HIGH}${w.restarted ? ' (after a restart)' : ''}`);
        if (ws.some(x=> x.ok === false && !x.beyondData)) out.push('the fit did not converge');
        // (ENGINE.md §4: a standard's column that ends at 309 s, before its window does: no fit)
        if (ws.some(x=> x.beyondData === true)) out.push('the chromatogram ends before its window does: not fitted');
        return out;
      };
      const offText = (k, g)=>{ const d = off(k, g); return d == null ? null : `${gasOf(g).txt}: ${fin(d) ? (d > 0 ? '+' : '') + (100*d).toFixed(1) + ' %' : 'not 0'} off the GC table's proportion (k = ${sig(prop[g].k, 5)})`; };
      const J = (k, gases = Object.keys(GAS))=>{
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
      J.off = off; J.prop = prop; J.chiMax = CHI2_HIGH;
      return J;
    }

    /* ---- What it draws ---- */
    function draw(keep){
      renderSel();
      paintStatus();
      paintAlerts();
      if (!ctx.drawable() || ctx.folded(a)) return;
      const e = cur();
      drawChrom(e, keep); drawOverview(e); paintValues(e); paintMethod();
    }
    // The H₂/O₂ zone the plot opens on: the windows and their neighbours (NEIGHBOURS), a margin round them.
    const span = m =>[Math.min(...m.windows.map(w=> w.from)), Math.max(...m.windows.map(w=> w.to))];
    const range = m =>{ const [a, b] = span(m); return [Math.min(a, ...NEIGHBOURS.map(z=> z.from)) - MARGIN, Math.max(b, ...NEIGHBOURS.map(z=> z.to)) + MARGIN]; };
    /* The chromatogram on show (v545): one plot of two panels that share the retention time
       (plot.js linkX), the chromatogram over its residuals, a Tauc plot's size together,
       three to one. The whole chromatogram is drawn; the view opens (and a reset comes back)
       on the H₂/O₂ zone, the y on the windows' own data. Only the residuals' axis carries
       the time's numbers and title. */
    let drawn = null;       // what the chromatogram's CSV gives: { e, k, t, y, curves }
    function drawChrom(e, keep){
      const svg = $('Chrom'), rs = $('Resid'), leg = $('ChromLegend');
      const vc = keep && chrom ? viewOf(chrom) : null, vr = keep && resid ? viewOf(resid) : null;
      chrom = new Plot(svg, { xlabel: 'Retention time (s)', ylabel: 'TCD signal', noXTickLabels: true, noXTitle: true, xTickMarks: true, margin: { l: 58, r: 20, t: 15, b: 0 } });
      resid = new Plot(rs, { xlabel: 'Retention time (s)', ylabel: 'Residual', xTickMarks: true, margin: { l: 58, r: 20, t: 0, b: 40 } });
      linkX([chrom, resid]);
      const tools = { host: el.querySelector('.gci-tools'), group: [chrom, resid] };
      leg.innerHTML = '';
      $('Notice').innerHTML = '';
      drawn = null;
      if (!e || e.d.error){ chrom.attachTools(el.querySelector('.gci-pair'), tools); if (e) $('Notice').innerHTML = alertHtml('bad', `${esc(e.tcd.name)}:`, [esc(e.d.error)]); return; }
      const { t, cols } = e.d, y = cols[selK], [lo, hi] = range(method), [wa, wb] = span(method);
      const tt = [], yy = [];
      for (let i = 0; i < t.length; i++) if (fin(t[i]) && fin(y[i])){ tt.push(t[i]); yy.push(y[i]); }
      // (the y range the windows' own: a neighbour, N₂ above all, may run off the top)
      const inW = yy.filter((_, i)=> tt[i] >= wa && tt[i] <= wb);
      if (!inW.length){ chrom.attachTools(el.querySelector('.gci-pair'), tools); $('Notice').innerHTML = alertHtml('warn', `${esc(e.tcd.name)}, chromatogram ${selK + 1}:`, ['no point in the windows']); return; }
      const R = resOf(e.tcd), r = R.res && R.res[selK];
      let curves = [];
      // (the windows' curves on the points their fit used; a peak's on its baseline)
      if (r) try { curves = (r.windows || []).map(wr=> ({ wr, c: windowCurves(t, y, R.m, wr) })).filter(x=> x.c && x.c.t && x.c.t.length); } catch(err){ curves = []; }
      drawn = { e, k: selK, t: tt, y: yy, curves, stale: R.stale };
      let ymin = Math.min(...inW), ymax = Math.max(...inW);
      curves.forEach(({ c })=> [c.model, c.base].forEach(arr=> arr && arr.forEach(v=>{ if (fin(v)){ ymin = Math.min(ymin, v); ymax = Math.max(ymax, v); } })));
      const pad5 = (ymax - ymin)*0.06 || 1;
      const key = e.name + '#' + selK;
      const [c0, c1] = offEdge(ymin - pad5, ymax + pad5, -1, 0.03);
      chrom.setRange(lo, hi, c0, c1);
      setView(chrom, vc, key);
      chrom.drawAxes(); chrom.clearData();
      const items = [];
      // The glitch zones left out of the fit, behind the curves.
      curves.forEach(({ wr })=> (wr.excluded || []).forEach(z=>{ if (Array.isArray(z) && fin(z[0]) && fin(z[1])) chrom.vband(z[0], z[1], C_BAD, 0.14); }));
      chrom.line(tt, yy, C_RAW, 1.2, undefined, { label: 'raw', key: 'raw' });
      items.push([C_RAW, 'raw', '']);
      let ci = 0;
      curves.forEach(({ wr, c })=>{
        if (c.base){ chrom.line(c.t, c.base, C_BASE, 1.1, '5,4', { label: `baseline (${wr.key})`, key: 'base ' + wr.key }); }
        // (the model under its peaks: each peak, on the baseline, drawn over it)
        if (c.model) chrom.line(c.t, c.model, C_MODEL, 1.4, undefined, { label: `model (${wr.key})`, key: 'model ' + wr.key });
        Object.entries(c.peaks || {}).forEach(([name, cv])=>{
          const pk = (wr.peaks || []).find(x=> x.name === name), g = pk && pk.gas, col = g ? gasOf(g).color : PEAK_COLORS[ci++ % PEAK_COLORS.length];
          chrom.line(c.t, c.base ? cv.map((v, i)=> v + c.base[i]) : cv, col, 1.3, g ? undefined : '2,3', { label: name, key: 'peak ' + name });
          if (!items.some(x=> x[1] === name)) items.push([col, name, g ? '' : 'mk-dots']);
        });
      });
      if (curves.length){ items.splice(1, 0, [C_MODEL, 'model', ''], [C_BASE, 'baseline (with its step)', 'mk-dash']); }
      // The points the fit left out: a spike a cross, a glitch zone's a ring.
      const sp = { x: [], y: [] }, ex = { x: [], y: [] };
      curves.forEach(({ c })=>{ const d = c.dropped; if (d && Array.isArray(d.t)) d.t.forEach((x, i)=>{ const o = d.kind && d.kind[i] === 'spike' ? sp : ex; o.x.push(x); o.y.push(d.y[i]); }); });
      if (sp.x.length){ chrom.points(sp.x, sp.y, C_BAD, 4, { shape: 'cross', width: 1.6, label: 'spikes' }); items.push([C_BAD, 'spike left out', '']); }
      if (ex.x.length){ chrom.points(ex.x, ex.y, C_BAD, 2.2, { label: 'glitch' }); items.push([C_BAD, 'glitch zone left out (band)', 'mk-dots']); }
      items.push([C_EDGE, 'fit window', '']);
      leg.innerHTML = items.map(([c, n, k])=> `<span>${k ? `<i class="${k}" style="color:${c}"></i>` : `<i style="background:${c}"></i>`}${esc(n)}</span>`).join('')
        + '<span><i class="mk-box gci-mk-nb"></i>peaks the model leaves out</span>';
      // The windows' edges (dragged: the method changes as the line is let go), the peaks'
      // places and the neighbours, drawn over the data, again at each zoom.
      chrom._onView = ()=> overlay();
      overlay();
      // The residuals, inside the fit window only (blank outside it), on the same time.
      const rx = [], ry = [];
      curves.forEach(({ c })=>{ if (c.residual) c.t.forEach((x, i)=>{ if (fin(c.residual[i])){ rx.push(x); ry.push(c.residual[i]); } }); });
      const rm = ry.length ? Math.max(...ry.map(Math.abs)) : 1;
      const [r0, r1] = offEdge(-rm*1.1 || -1, rm*1.1 || 1, 1, 0.1);
      resid.setRange(lo, hi, r0, r1);
      setView(resid, vr, key);
      resid.xmin = chrom.xmin; resid.xmax = chrom.xmax;
      resid.drawAxes(); resid.clearData();
      curves.forEach(({ wr })=> (wr.excluded || []).forEach(z=>{ if (Array.isArray(z) && fin(z[0]) && fin(z[1])) resid.vband(z[0], z[1], C_BAD, 0.14); }));
      if (rx.length){
        resid.line([rx[0], rx[rx.length - 1]], [0, 0], C_TABLE, 1, '3,3', { label: 'zero', key: 'zero' });
        resid.line(rx, ry, C_MODEL, 1, undefined, { label: 'residual', key: 'residual' });
      }
      chrom.attachTools(el.querySelector('.gci-pair'), tools);
      if (!r && e.n) $('Notice').innerHTML = alertHtml('info', `${esc(e.label)}, chromatogram ${selK + 1}:`, ['not integrated yet: the model is drawn once it is']);
      else if (R.stale) $('Notice').innerHTML = alertHtml('warn', 'Method changed:', ['the model and the values shown are the previous method\'s until this file is integrated again']);
    }
    /* The two panels meet: a tick's number on the edge they share (the chromatogram's foot,
       side −1; the residuals' top, side 1) would be cut in two. The range moved off it, by
       `f` of itself, where its outermost tick lies within that of it. */
    function offEdge(y0, y1, side, f){
      const t = niceTicks(y0, y1, 5), d = y1 - y0, k = side > 0 ? t[t.length - 1] : t[0];
      if (!fin(k) || !(d > 0)) return [y0, y1];
      return side > 0 ? (y1 - k < f*d ? [y0, k + 1.4*f*d] : [y0, y1]) : (k - y0 < f*d ? [k - 1.4*f*d, y1] : [y0, y1]);
    }
    // (dragging: the method as it would be, its lines where they are being taken)
    let drag = null;
    function overlay(){
      if (!chrom) return;
      const P = chrom, g = P.gOverlay, { w: W, h } = P.size(), m = P.margin;
      // (the overlay is this card's alone: its lines drawn anew, the plot's copies of them too)
      g.innerHTML = '';
      P._stored = P._stored.filter(x=> x.type !== 'vline');
      const M = drag ? drag.m : method;
      const add = (tag, at, text)=>{ const node = svgEl(tag, { 'pointer-events': 'none', class: 'gci-ov', ...at }); if (text) node.textContent = text; g.appendChild(node); return node; };
      // The neighbours the model has no peak for: a grey zone each, named.
      NEIGHBOURS.forEach(z=>{
        const x0 = P.px(z.from), x1 = P.px(z.to);
        if (x1 < m.l || x0 > W - m.r) return;
        add('rect', { x: x0, y: m.t, width: Math.max(0, x1 - x0), height: Math.max(0, h - m.t - m.b), class: 'gci-ov gci-nb' });
        add('text', { x: (x0 + x1)/2, y: m.t + 14, 'font-size': 10, 'text-anchor': 'middle', class: 'gci-ov gci-nb-lb' }, z.name);
      });
      // The peaks' places: a thin dotted line each, named at the top.
      M.windows.forEach(w=> (w.peaks || []).forEach((pk, i)=>{
        if (!fin(pk.t) || pk.t < P.xmin || pk.t > P.xmax) return;
        const x = P.px(pk.t), col = pk.gas ? gasOf(pk.gas).color : PEAK_COLORS[i % PEAK_COLORS.length];
        add('line', { x1: x, x2: x, y1: m.t, y2: h - m.b, stroke: col, 'stroke-width': 1, 'stroke-dasharray': '1,3' });
        add('text', { x: x + 3, y: m.t + 30 + 11*(i % 3), 'font-size': 10, fill: col }, pk.name);
      }));
      // The edges, dragged.
      M.windows.forEach((w, wi)=> ['from', 'to'].forEach(side=>{
        P.vline(w[side], C_EDGE, true, v=> onDrag(wi, side, v), v=> onDrop(wi, side, v));
      }));
    }
    // A line dragged snaps to the data's grid (0.2 s) and writes into its field.
    function onDrag(wi, side, v){
      if (!drag) drag = { m: clone(method) };
      drag.m.windows[wi][side] = round1(snap(v));
      overlay();
      paintMethod(drag.m);
    }
    function onDrop(wi, side, v){
      const m = drag ? drag.m : clone(method);
      drag = null;
      m.windows[wi][side] = round1(snap(v));
      setMethod(m);
    }
    // A method set (a step): its results looked for, else integrated a little later.
    function setMethod(m){
      const w = m.windows.find(x=> !(x.from < x.to - 5));
      if (w){ draw(true); confirmBad(`The ${w.key} window must start at least 5 s before it ends.`); return; }
      if (methodKey(m) === methodKey(method)){ draw(true); return; }
      wasMethod = method;
      method = methodIn(m);
      draw(true);
      kit.commit();
      ctx.changed();
      later();
    }
    function confirmBad(t){ $('Notice').innerHTML = alertHtml('warn', 'Not taken:', [esc(t)]); }
    // A window reaching a neighbour the model has no peak for, said (not refused).
    const intrusions = m => m.windows.flatMap(w=> NEIGHBOURS.filter(z=> w.from < z.to && w.to > z.from).map(z=>
      `The ${w.key} window (${w.from}–${w.to} s) reaches ${z.name} (${z.from}–${z.to} s), which its model has no peak for: the fit degrades there.`));

    /* ---- Windows: the fit windows' edges (their lines on the chromatogram an aid), each a
       step, with the peaks' nominal places ---- */
    function paintMethod(m = method){
      const box = $('Method'), reset = el.querySelector('.gci-reset');
      const focus = document.activeElement && box.contains(document.activeElement) ? document.activeElement.dataset.k : null;
      const field = (k, v, label)=> `<input type="text" inputmode="decimal" data-k="${k}" value="${esc(String(v))}" aria-label="${esc(label)}">`;
      const warn = intrusions(m);
      reset.hidden = isDefault(m);
      box.innerHTML = m.windows.map((w, wi)=> `<div class="gci-win"><span class="gci-win-name">${esc(w.key)} fit</span>`
          + `<label>from ${field(`w${wi}:from`, w.from, `${w.key} window from (s)`)}</label>`
          + `<label>to ${field(`w${wi}:to`, w.to, `${w.key} window to (s)`)} s</label>`
          + `<span class="gci-win-peaks">${(w.peaks || []).map(pk=> `${esc(pk.name)} ${fin(pk.t) ? pk.t.toFixed(1) : ''}`).join(' · ')}</span></div>`).join('')
        + (warn.length ? `<p class="gci-flag">⚠ ${warn.map(esc).join(' ')}</p>` : '');
      box.querySelectorAll('input').forEach(inp=>{
        guardNumericInput(inp, {});
        const [wi, side] = inp.dataset.k.slice(1).split(':');
        inp.addEventListener('change', ()=>{
          const v = +String(inp.value).replace(',', '.'), n = clone(method);
          if (!fin(v)){ flashFieldInvalid(inp); inp.value = method.windows[+wi][side]; return; }
          n.windows[+wi][side] = v;
          setMethod(n);
        });
        inp.addEventListener('keydown', e=>{ if (e.key === 'Enter') inp.blur(); });
      });
      if (focus){ const f = box.querySelector(`input[data-k="${focus}"]`); if (f) f.focus(); }
    }
    el.querySelector('.gci-reset').addEventListener('click', ()=> setMethod(methodIn(null)));

    /* ---- Peaks: the values of the chromatogram on show ---- */
    function paintValues(e){
      const box = $('Values');
      if (!e || e.d.error){ box.innerHTML = ''; return; }
      const R = resOf(e.tcd), r = R.res && R.res[selK];
      if (!r){ box.innerHTML = `<p class="txt-meta">Not integrated yet.</p>`; return; }
      if (typeof r.error === 'string'){ box.innerHTML = `<p class="gci-flag">⚠ Not integrated: ${esc(r.error)}</p>`; return; }
      const conv = convAll(e, R.res), J = judge(e, R.res);
      const gs = Object.keys(GAS).filter(g=> r.gases && r.gases[g]);
      const unitOf = g =>{ const c = conv[g]; return c && c.how === 'cal' ? cal.unit : '%mol'; };
      const units = [...new Set(gs.filter(g=> conv[g] && conv[g].f).map(unitOf))], tUnit = e.table && e.table.altExport === true ? 'ppm' : '%mol';
      const rows = gs.map(g=>{
        const x = r.gases[g], c = conv[g];
        const conc = c && c.f && fin(x.area) ? c.f(x.area) : NaN, shown = c && c.how === 'cal' && cal.unit === 'ppm' ? conc*1e4 : conc;
        const tv = aligned(e) && e.table.gas[g] ? e.table.gas[g][selK] : NaN, tShown = tUnit === 'ppm' ? tv*1e4 : tv;
        const off = J.off(selK, g) != null;
        return `<tr><td>${gasOf(g).label}</td><td class="${off ? 'gci-bad' : ''}"${off ? ' title="Out of proportion with the GC table"' : ''}>${sig(x.area, 5)} ± ${sig(x.sd, 2)}</td>`
          + `<td>${fin(x.tApex) ? x.tApex.toFixed(2) : '—'}</td><td class="${fin(x.chi2r) && x.chi2r > J.chiMax ? 'gci-bad' : ''}">${fin(x.chi2r) ? x.chi2r.toFixed(2) : '—'}</td>`
          + `<td>${fin(shown) ? shown.toPrecision(4) + (units.length > 1 ? ' ' + esc(unitOf(g)) : '') : '—'}${c && c.how === 'transfer' ? '<span class="txt-meta" title="from the GC software\'s scale">ᵗ</span>' : ''}</td>`
          + `<td>${fin(tShown) ? tShown.toPrecision(4) : '—'}</td></tr>`;
      });
      const fl = J(selK);
      // (the units under the table, the narrow column keeping its headers short)
      const said = [units.length === 1 ? `concentration in ${esc(units[0])}` : '', aligned(e) ? `GC table in ${tUnit}` : '',
        gs.some(g=> conv[g] && conv[g].how === 'transfer') ? 'ᵗ calibration taken from the GC software\'s table' : ''].filter(Boolean);
      box.innerHTML = `<table class="gci-values"><thead><tr><th>Gas</th><th>Area ± sd</th><th>Apex (s)</th><th>χ²<sub>r</sub></th><th>Conc.</th><th>GC table</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
        + (said.length ? `<p class="txt-meta">${said.join('; ')}.</p>` : '')
        + (fl.length ? `<p class="gci-flag">⚠ Suspicious: ${fl.map(esc).join('; ')}</p>` : '')
        + (Object.keys(GAS).some(g=> !conv[g] || !conv[g].f) ? `<p class="txt-meta">${Object.keys(GAS).filter(g=> !conv[g] || !conv[g].f).map(g=> `${gasOf(g).txt}: ${esc(conv[g] ? conv[g].why : 'no concentration')}`).join('; ')}.</p>` : '')
        + (R.stale ? '<p class="txt-meta">(the previous method\'s)</p>' : '');
    }
    // Each gas's conversion for entry e (its areas from `res`).
    function convAll(e, res){
      const out = {};
      Object.keys(GAS).forEach(g=>{
        const areas = (res || []).map(x=> x && x.gases && x.gases[g] && fin(x.gases[g].area) ? x.gases[g].area : NaN);
        out[g] = convOf(g, areas, aligned(e) ? e.table.gas[g] : null);
      });
      return out;
    }

    /* ---- The run overview (v545): one gas at a time, every injection's fit (red where it
       is suspicious for that gas) and the GC table's value (grey; as area, times the run's
       k); a point hovered brightens and says what it is, the chromatogram on show's stays
       bright; a click shows its chromatogram ---- */
    let hovK = -1, ovLook = null;
    function drawOverview(e){
      const svg = $('Over'), leg = $('OverLegend');
      over = new Plot(svg, { xlabel: aligned(e) ? 'Time from the first injection (h)' : 'Injection', ylabel: '' });
      // (its points answer the pointer themselves: no trace picked, no crosshair)
      svg._noPick = true; svg._suppressReadout = true;
      ovPts = []; ovLook = null;
      const gasBox = el.querySelector('.gci-ov-gas'), yBox = el.querySelector('.gci-ov-y');
      if (!e || e.d.error || !e.n){ gasBox.innerHTML = ''; yBox.innerHTML = ''; leg.innerHTML = ''; over.attachTools(svg.closest('.plot-wrap')); return; }
      const R = resOf(e.tcd), res = R.res || [];
      const conv = convAll(e, res), J = judge(e, res);
      const g = GAS[ovGas] ? ovGas : 'h2', c = conv[g], G = gasOf(g);
      const mode = ovY === 'conc' && c && c.f ? 'conc' : 'area';
      // (one gas at a time: a chip chooses it, the other's off)
      gasBox.innerHTML = Object.keys(GAS).map(k=> `<button type="button" class="mode-chip plot-chip gci-ov-chip${k === g ? ' is-on' : ''}" data-g="${k}" aria-pressed="${k === g}" title="Show ${gasOf(k).txt} (one gas at a time)">${gasOf(k).label}</button>`).join('');
      yBox.innerHTML = chipRow([{ key: 'area', label: 'Area' }, { key: 'conc', label: 'Conc.' }], [mode], { cls: 'plot-chip gci-ovy-chip', data: o=> `data-y="${o.key}"`, name: o=> o.label,
        can: o=> o.key === 'area' || !!(c && c.f), why: ()=> `No calibration of ${G.txt} and no table to take a scale from` });
      const t0 = aligned(e) ? Math.min(...e.table.injDates.map(Number)) : 0;
      const xOf = k => aligned(e) ? (e.table.injDates[k] - t0)/3600e3 : k + 1;
      const xs = Array.from({ length: e.n }, (_, k)=> xOf(k));
      const unit = c && c.how === 'cal' ? cal.unit : '%mol', mul = unit === 'ppm' ? 1e4 : 1;
      const val = A => mode === 'conc' ? (fin(A) ? c.f(A)*mul : NaN) : A;
      const fit = res.map(x=> x && x.gases && x.gases[g] ? val(x.gases[g].area) : NaN);
      while (fit.length < e.n) fit.push(NaN);
      // The table's value: its concentration, or the area it stands for at the run's k.
      const tv = aligned(e) && e.table.gas[g] ? Array.from(e.table.gas[g]) : null, P = J.prop[g];
      const table = !tv ? null : mode === 'conc' ? tv.map(v=> fin(v) ? v*mul : NaN) : P ? tv.map(v=> fin(v) ? v*P.k : NaN) : null;
      const bad = xs.map((_, k)=> J.bad(k, g));
      const all = [...fit, ...(table || [])].filter(fin);
      over.ylabel = mode === 'conc' ? `${G.txt} (${unit})` : `${G.txt} area`;
      const xmin = Math.min(...xs), xmax = Math.max(...xs), dx = (xmax - xmin)*0.04 || 0.5;
      const ylo = all.length ? Math.min(0, ...all) : 0, yhi = all.length ? Math.max(...all) : 1;
      over.setRange(xmin - dx, xmax + dx, ylo, yhi*1.08 || 1);
      over.drawAxes(); over.clearData();
      if (table) over.points(xs, table, C_TABLE, 3.5, { shape: 'cross', width: 1.4, label: mode === 'conc' ? `${G.txt} GC table` : `${G.txt} GC table × k`, key: g + ' table' });
      over.points(xs, fit.map((v, k)=> bad[k] ? NaN : v), G.color, 3.2, { fill: true, label: `${G.txt} fit`, key: g + ' fit' });
      if (bad.some(Boolean)) over.points(xs, fit.map((v, k)=> bad[k] ? v : NaN), C_BAD, 3.2, { fill: true, label: `${G.txt} fit, suspicious`, key: g + ' suspicious' });
      fit.forEach((v, k)=>{ if (fin(v)) ovPts.push({ k, x: xs[k], y: v, color: bad[k] ? C_BAD : G.color }); });
      // What a point hovered says: its injection and time, the fit, the table's value, χ²ᵣ.
      const tUnit = e.table && e.table.altExport === true ? 'ppm' : '%mol';
      const fmtV = v => !fin(v) ? '—' : mode === 'conc' ? `${sig(v, 4)} ${unit}` : sig(v, 5);
      ovLook = k =>{
        const r = res[k], x = r && r.gases && r.gases[g], tvk = tv ? tv[k] : NaN;
        const lines = [injName(e, k), `fit: ${fmtV(fit[k])}`];
        if (tv) lines.push(`GC table: ${fin(tvk) ? sig(tUnit === 'ppm' ? tvk*1e4 : tvk, 4) + ' ' + tUnit : 'n.a.'}`);
        lines.push(`χ²ᵣ: ${x && fin(x.chi2r) ? x.chi2r.toFixed(2) : '—'}`);
        if (bad[k]) lines.push('suspicious');
        return lines;
      };
      leg.innerHTML = `<span><i class="gci-mk gci-mk-dot" style="color:${G.color}"></i>${G.txt} fit</span>`
        + (bad.some(Boolean) ? `<span><i class="gci-mk gci-mk-dot" style="color:${C_BAD}"></i>suspicious</span>` : '')
        + (table ? `<span><i class="gci-mk gci-mk-x"></i>GC table${mode === 'area' ? ' × k' : ''}</span>` : '');
      over._onView = paintHl;
      paintHl();
      over.attachTools(svg.closest('.plot-wrap'));
    }
    // A lighter tint of a colour (#rrggbb): `f` of the way to white.
    const tint = (hex, f)=>{ const n = parseInt(hex.slice(1), 16), ch = s => Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255))*f); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; };
    // The points brightened: the chromatogram on show's, and the one under the pointer with
    // its label (in the overlay: drawn again at each zoom, never exported).
    function paintHl(){
      if (!over) return;
      const old = over.gOverlay.querySelector('.gci-hl');
      if (old) old.remove();
      const g = svgEl('g', { class: 'gci-hl', 'pointer-events': 'none' });
      over.gOverlay.appendChild(g);
      const mark = q =>{
        const x = over.px(q.x), y = over.py(q.y);
        g.appendChild(svgEl('circle', { cx: x, cy: y, r: 9, fill: q.color, 'fill-opacity': 0.3, class: 'gci-hl-halo' }));
        g.appendChild(svgEl('circle', { cx: x, cy: y, r: 5, fill: tint(q.color, 0.55), stroke: q.color, 'stroke-width': 1.8, class: 'gci-hl-pt' }));
        return [x, y];
      };
      const sel = ovPts.find(q=> q.k === selK);
      if (sel) mark(sel);
      const hov = hovK >= 0 ? ovPts.find(q=> q.k === hovK) : null;
      if (hov){ const [x, y] = hov === sel ? [over.px(hov.x), over.py(hov.y)] : mark(hov); if (ovLook) over.tagAt(g, x, y, ovLook(hov.k), hov.color); }
      g.dataset.sel = sel ? String(sel.k) : '';
      g.dataset.hov = hov ? String(hov.k) : '';
    }
    // The injection nearest the pointer on screen, within 14 px (−1: none).
    function ovAt(ev){
      if (!over || !ovPts.length) return -1;
      const b = $('Over').getBoundingClientRect(), cx = ev.clientX - b.left, cy = ev.clientY - b.top;
      let best = -1, bd = 14;
      ovPts.forEach(q=>{ if (q.x < over.xmin || q.x > over.xmax) return; const d = Math.hypot(over.px(q.x) - cx, over.py(q.y) - cy); if (d < bd){ bd = d; best = q.k; } });
      return best;
    }
    $('Over').addEventListener('pointermove', ev=>{ const k = ovAt(ev); if (k !== hovK){ hovK = k; paintHl(); } });
    $('Over').addEventListener('pointerleave', ()=>{ if (hovK >= 0){ hovK = -1; paintHl(); } });
    $('Over').addEventListener('click', ev=>{
      if (!over || over._mode) return;
      const k = ovAt(ev);
      if (k >= 0 && k !== selK){ selK = k; draw(); }
    });
    el.addEventListener('click', ev=>{
      const gc = ev.target.closest('.gci-ov-chip'), yc = ev.target.closest('.gci-ovy-chip');
      if (gc && !gc.disabled && GAS[gc.dataset.g] && gc.dataset.g !== ovGas){ ovGas = gc.dataset.g; draw(true); kit.commit(); }
      if (yc && !yc.disabled && yc.dataset.y !== ovY){ ovY = oneOf(yc.dataset.y, ['conc', 'area']); draw(true); kit.commit(); }
    });

    /* ---- The status, the card's alerts ---- */
    function paintStatus(all){
      const st = status(), box = $('Status'), mine = new Set(tcdRecs().map(r=> keyOf(r, method)));
      const left = wanted().filter(g=> mine.has(g.key)).reduce((s, g)=> s + g.miss.length, 0);
      const total = entries().reduce((s, e)=> s + e.n, 0);
      let html = '', state = '';
      if (st.job){
        const pct = st.job.total ? Math.round(100*st.job.done/st.job.total) : 0;
        state = 'running';
        html = `<span class="gci-prog"><span class="gci-prog-bar" style="width:${pct}%"></span></span><span>Integrating… ${st.job.done} / ${st.job.total} chromatograms · ${esc(st.job.name)}</span>`;
      } else if (st.failed){ state = 'failed'; html = `<span class="gci-bad">The integration failed: ${esc(st.failed)}</span>`; }
      else if (left && st.halted){ state = 'stopped'; html = `<span>Stopped: ${left} chromatogram${left === 1 ? '' : 's'} not integrated with this method.</span>`; }
      else if (left && st.soon){ state = 'soon'; html = `<span>Method changed: integrating again in a moment…</span>`; }
      else if (left){ state = 'left'; html = `<span>${left} chromatogram${left === 1 ? '' : 's'} to integrate.</span>`; }
      // (all integrated: nothing to say, the line folds away)
      else if (total) state = 'done';
      else { state = 'none'; html = `<span class="txt-meta">No raw chromatograms (TCD) loaded: drop them beside their tables.</span>`; }
      box.innerHTML = html;
      box.dataset.state = state;
      $('Bar').hidden = !html;
      $('Stop').style.display = st.job ? '' : 'none';
      $('Run').style.display = !st.job && left ? '' : 'none';
      if (all){ valuesKept.clear(); if (ctx.drawable()) draw(true); }
    }
    function paintAlerts(){
      const es = entries(), lines = { warn: [], info: [] };
      es.forEach(e=>{
        if (e.d.error) return;
        if (e.table && e.rows !== e.n) lines.warn.push(`${esc(e.label)}: ${e.rows} row${e.rows === 1 ? '' : 's'} in the table, ${e.n} chromatogram${e.n === 1 ? '' : 's'}: not aligned. Integrated all the same; Analysis uses the table alone.`);
        if (!e.table && e.twin) lines.warn.push(`${esc(e.label)}: two files of raw chromatograms paired (${esc(e.tcd.name)}, ${esc(e.twin)}): shown here, left out of Analysis (no injection times).`);
        else if (!e.table) lines.warn.push(`${esc(e.label)}: raw chromatograms with no table: no injection times (Analysis leaves them out), a concentration only with standards.`);
      });
      const tr = es.filter(aligned).map(e=>{ const R = resOf(e.tcd); if (!R.res || R.res.some(x=> !x)) return null; const c = convAll(e, R.res), gs = Object.keys(GAS).filter(g=> c[g] && c[g].how === 'transfer'); return gs.length ? `${esc(e.label)}: ${gs.map(g=> `${gasOf(g).label} k = ${sig(c[g].k, 5)} (median of ${c[g].n} injections)`).join(', ')}` : null; }).filter(Boolean);
      if (tr.length) lines.info.push(...tr);
      /* A gas calibrated by standards whose injections fall outside the standards' range:
         extrapolated, said (below the lowest standard the intercept weighs most: the real O₂
         runs, about 0.03 %mol, lie far under the 0.2 %mol standard). */
      Object.keys(GAS).forEach(g=>{
        const L = calFit(g);
        if (!L) return;
        const cs = L.pts.map(q=> toPct(q.conc, cal.unit)), lo = Math.min(...cs), hi = Math.max(...cs);
        es.forEach(e=>{
          const R = resOf(e.tcd);
          if (e.d.error || !R.res || R.stale) return;
          const v = R.res.map(x=> x && x.gases && x.gases[g] && fin(x.gases[g].area) ? toPct((x.gases[g].area - L.intercept)/L.slope, cal.unit) : NaN).filter(fin);
          const out = v.filter(c=> c < lo || c > hi).length;
          if (out) lines.warn.push(`${esc(e.label)}: ${out} of ${v.length} injections' ${gasOf(g).label} outside the standards' range (${sig(lo, 3)}–${sig(hi, 3)} %mol): extrapolated${v.some(c=> c < lo) ? `, below the lowest standard, where the intercept (${sig(L.intercept, 4)}) weighs most` : ''}.`);
        });
      });
      const errs = es.filter(e=> e.d.error).map(e=> `${esc(e.tcd.name)}: ${esc(e.d.error)}`);
      $('Alerts').innerHTML = (errs.length ? alertHtml('bad', 'Raw chromatograms that could not be read:', errs) : '')
        + (lines.warn.length ? alertHtml('warn', 'Raw chromatograms to check:', lines.warn) : '')
        + (lines.info.length ? alertHtml('info', 'Calibration taken from the GC software\'s table (no standards for the gas): see the risks in this card\'s instructions.', lines.info) : '');
    }

    /* ---- The calibration's window ---- */
    function calWindow(){
      const m = document.createElement('div');
      m.className = 'modal-backdrop xrd-std-modal gci-cal-modal';
      m.style.display = 'none';
      m.innerHTML = `
      <div class="xrd-std-box gci-cal-box" role="dialog" aria-modal="true" aria-labelledby="${p}CalTitle" tabindex="-1">
        <div class="xrd-std-head">
          <h3 class="txt-head" id="${p}CalTitle">Calibration<button type="button" class="instr-info" aria-label="Toggle instructions" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none"/></svg></button></h3>
          <button type="button" class="an-ic xrd-std-x" title="Close" aria-label="Close">${X_SVG(15)}</button>
        </div>
        <div class="xrd-std-scroll">
          <div class="instr-block xrd-std-instr" style="display:none">${CAL_INFO}</div>
          <div class="dropzone xrd-std-dz gci-cal-dz">
            <div class="dz-icon">⤒</div>
            <div class="dz-title">Drag here the standards' raw chromatograms (TCD), or click to select them.</div>
            <div class="txt-meta">.csv · a column per standard</div>
            <input type="file" class="gci-cal-in" multiple accept=".csv,.txt,.CSV,.TXT" style="display:none">
          </div>
          <div class="xrd-std-alerts gci-cal-alerts"></div>
          <div class="gci-cal-files"></div>
          <div class="gci-cal-unit"><label class="txt-label">Concentration unit <select class="gci-cal-unit-in" aria-label="Concentration unit">${UNITS.map(u=> `<option value="${u}">${u}</option>`).join('')}</select></label><span class="gci-cal-status txt-meta"></span></div>
          <div class="row gci-cal-fits"></div>
          <div class="peak-scroll gci-cal-table"><table class="gci-cal-levels"><thead><tr><th>#</th><th></th><th>File, column</th><th>H<sub>2</sub> area</th><th>O<sub>2</sub> area</th><th>H<sub>2</sub> <span class="gci-u"></span></th><th>O<sub>2</sub> <span class="gci-u"></span></th><th title="Use this standard">Use</th></tr></thead><tbody></tbody></table></div>
        </div>
      </div>`;
      ctx.layer.appendChild(m);
      const q = s => m.querySelector(s), info = q('.instr-info'), instr = q('.xrd-std-instr');
      info.addEventListener('click', ()=>{ const o = instr.style.display === 'none'; instr.style.display = o ? '' : 'none'; info.classList.toggle('is-on', o); info.setAttribute('aria-expanded', String(o)); });
      let from = null, isOpen = false;
      const onKey = e =>{ if (e.key === 'Escape' && ctx.shown()){ e.stopPropagation(); close(); } };
      function open(){ if (isOpen) return; isOpen = true; from = document.activeElement; m.style.display = 'flex'; document.addEventListener('keydown', onKey); paint(); ensure(); q('.gci-cal-box').focus({ preventScroll: true }); }
      function close(){ if (!isOpen) return; isOpen = false; m.style.display = 'none'; document.removeEventListener('keydown', onKey); if (from && from.isConnected) from.focus({ preventScroll: true }); from = null; }
      m.addEventListener('click', e=>{ if (e.target === m || e.target.closest('.xrd-std-x')) close(); });
      // A change: the card's, a step; the cards below follow.
      // (`levels`: a level typed or ticked, its field kept as it is: the fits drawn again, not the table)
      const changed = levels =>{ valuesKept.clear(); draw(true); if (levels) paintFits(); else paint(); kit.commit(); ctx.changed(); };
      setupDropzone(q('.gci-cal-dz'), q('.gci-cal-in'), async list=>{
        const bad = [], add = [];
        for (const f of list){
          const bytes = new Uint8Array(await f.arrayBuffer());
          let d;
          try { d = readTcd(decodeText(bytes)); } catch(e){ d = { error: String(e && e.message || e) }; }
          if (!d || d.error || !d.cols || !d.cols.length){ bad.push(`${f.name}${d && d.error ? ` (${d.error})` : ''}`); continue; }
          if (cal.files.some(x=> x.name === f.name)){ bad.push(`${f.name} (already loaded)`); continue; }
          read.set(bytes, d);
          add.push({ name: f.name, rawBytes: bytes, levels: d.cols.map(blankLevel) });
        }
        q('.gci-cal-alerts').innerHTML = bad.length ? alertHtml('bad', 'Not loaded:', bad.map(esc)) : '';
        if (!add.length) return;
        cal = { ...calCopy(cal), files: [...calCopy(cal).files, ...add] };
        changed();
        ensure();
      });
      q('.gci-cal-files').addEventListener('click', e=>{
        const b = e.target.closest('[data-cal-del]');
        if (!b) return;
        const c = calCopy(cal); c.files.splice(+b.dataset.calDel, 1); cal = c; changed();
      });
      q('.gci-cal-unit-in').addEventListener('change', e=>{ const c = calCopy(cal); c.unit = oneOf(e.target.value, UNITS); cal = c; changed(); });
      q('.gci-cal-levels').addEventListener('change', e=>{
        const inp = e.target.closest('input[data-fi]');
        if (!inp) return;
        const c = calCopy(cal), f = c.files[+inp.dataset.fi], j = +inp.dataset.j;
        if (!f) return;
        while (f.levels.length <= j) f.levels.push(blankLevel());
        if (inp.type === 'checkbox'){ f.levels[j].on = inp.checked; inp.closest('tr').classList.toggle('is-excluded', !inp.checked); }
        else {
          const s = inp.value.trim().replace(',', '.'), v = s === '' ? null : Number(s);
          if (v !== null && !(fin(v) && v >= 0)){ flashFieldInvalid(inp); inp.value = f.levels[j][inp.dataset.g] == null ? '' : String(f.levels[j][inp.dataset.g]); return; }
          f.levels[j][inp.dataset.g] = v;
        }
        cal = c; changed(true);
      });
      q('.gci-cal-levels').addEventListener('keydown', e=>{ if (e.key === 'Enter' && e.target.matches('input[type="text"]')) e.target.blur(); });
      q('.gci-cal-fits').addEventListener('click', e=>{
        const b = e.target.closest('[data-zero]');
        if (!b) return;
        const c = calCopy(cal), g = b.dataset.g, z = b.dataset.zero === '1';
        if (c.zero[g] === z) return;
        c.zero[g] = z; cal = c; changed();
      });
      // A thumbnail of a standard's chromatogram over the windows: a polyline, no plot.
      function thumb(d, j){
        const [lo, hi] = range(method), t = d.t, y = d.cols[j], xs = [], ys = [];
        for (let i = 0; i < t.length; i += 2) if (t[i] >= lo && t[i] <= hi && fin(y[i])){ xs.push(t[i]); ys.push(y[i]); }
        if (xs.length < 2) return '';
        const y0 = Math.min(...ys), y1 = Math.max(...ys) || y0 + 1, W = 72, H = 22;
        const pts = xs.map((x, i)=> `${((x - lo)/(hi - lo)*W).toFixed(1)},${(H - 1 - (ys[i] - y0)/((y1 - y0) || 1)*(H - 2)).toFixed(1)}`).join(' ');
        return `<svg class="gci-thumb" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1"/></svg>`;
      }
      // (drawn anew while the standards are integrated: the field typed in keeps the focus)
      function paint(){
        if (!isOpen) return;
        const act = document.activeElement, was = act && m.contains(act) && act.matches('input[data-fi]') ? { k: `[data-fi="${act.dataset.fi}"][data-j="${act.dataset.j}"][data-g="${act.dataset.g}"]`, v: act.value, s: act.type === 'text' ? act.selectionStart : null } : null;
        q('.gci-cal-files').innerHTML = cal.files.map((f, i)=> `<div class="xrd-std-row"><span class="txt-mini">Standards</span><span class="xrd-std-name">${esc(f.name)}</span><button type="button" class="peak-del is-danger idle-dim" data-cal-del="${i}" title="Remove this file and its levels">${X_SVG(13)}</button></div>`).join('');
        q('.gci-cal-unit-in').value = cal.unit;
        m.querySelectorAll('.gci-u').forEach(s=>{ s.textContent = `(${cal.unit})`; });
        const rows = calRows(), left = cal.files.reduce((s, f)=>{ const r = resultsAt(keyOf(f, method)); return s + (r ? r.filter(x=> !x).length : dataOf(f).error ? 0 : dataOf(f).cols.length); }, 0);
        q('.gci-cal-status').textContent = !cal.files.length ? 'No standards: each pair takes its calibration from the GC software\'s table.' : left ? `Integrating the standards… (${left} left)` : `${rows.length} chromatogram${rows.length === 1 ? '' : 's'} integrated.`;
        const area = (x, g)=> x.r && x.r.gases && x.r.gases[g] ? sig(x.r.gases[g].area, 5) : '…';
        const val = v => v == null ? '' : esc(String(v));
        q('.gci-cal-levels tbody').innerHTML = rows.map((x, i)=> `<tr class="${x.lv.on ? '' : 'is-excluded'}"><td>${i + 1}</td><td>${thumb(x.d, x.j)}</td><td class="gci-cal-src" title="${esc(x.f.name)}">${esc(x.f.name)}, ${x.j + 1}</td><td>${area(x, 'h2')}</td><td>${area(x, 'o2')}</td>`
          + `<td><input type="text" inputmode="decimal" data-fi="${x.fi}" data-j="${x.j}" data-g="h2" value="${val(x.lv.h2)}" aria-label="H2 concentration of standard ${i + 1}" placeholder="—"></td>`
          + `<td><input type="text" inputmode="decimal" data-fi="${x.fi}" data-j="${x.j}" data-g="o2" value="${val(x.lv.o2)}" aria-label="O2 concentration of standard ${i + 1}" placeholder="—"></td>`
          + `<td><input type="checkbox" data-fi="${x.fi}" data-j="${x.j}" data-g="on"${x.lv.on ? ' checked' : ''} aria-label="Use standard ${i + 1}"></td></tr>`).join('')
          || `<tr><td colspan="8" class="txt-meta">Drop the standards' raw chromatograms above.</td></tr>`;
        if (was){ const f = m.querySelector('input' + was.k); if (f){ if (f.type === 'text'){ f.value = was.v; } f.focus({ preventScroll: true }); if (was.s != null) try { f.setSelectionRange(was.s, was.s); } catch(e){ /* not a text field */ } } }
        paintFits();
      }
      function paintFits(){
        const fits = q('.gci-cal-fits');
        fits.innerHTML = Object.keys(GAS).map(g=> `<div class="col gci-cal-gas" data-g="${g}">
            <div class="gci-cal-gas-head"><span class="txt-mini">${gasOf(g).label}</span>
              <span class="gci-cal-zero">${chipRow([{ key: 'free', label: 'free intercept' }, { key: 'zero', label: 'zero intercept' }], [cal.zero[g] ? 'zero' : 'free'], { cls: 'plot-chip gci-zero-chip', data: o=> `data-g="${g}" data-zero="${o.key === 'zero' ? 1 : 0}"`, name: o=> o.label })}</span></div>
            ${plotWrap(`${p}Cal${g}`, { mod: 'gc', name: `GC_calibration_${gasOf(g).csv}.svg`, legend: '' })}
            <div class="gci-cal-stats"></div></div>`).join('');
        Object.keys(GAS).forEach(g=> drawCalGas(g, fits.querySelector(`.gci-cal-gas[data-g="${g}"]`)));
      }
      function drawCalGas(g, box){
        const L = calFit(g), stats = box.querySelector('.gci-cal-stats'), svg = box.querySelector('svg.plot');
        const pts = calRows().filter(x=> x.lv.on && fin(x.lv[g]) && x.r && x.r.gases && x.r.gases[g] && fin(x.r.gases[g].area));
        const P = new Plot(svg, { xlabel: `${gasOf(g).txt} (${cal.unit})`, ylabel: 'Area' });
        if (!pts.length){ P.attachTools(svg.closest('.plot-wrap')); stats.innerHTML = `<p class="txt-meta">No standard for ${gasOf(g).label}: each pair takes its scale from the GC software's table.</p>`; return; }
        const xs = pts.map(x=> x.lv[g]), ys = pts.map(x=> x.r.gases[g].area);
        const xmax = Math.max(...xs) || 1, ymax = Math.max(...ys, L ? L.slope*xmax + L.intercept : 0) || 1;
        P.setRange(0, xmax*1.08, Math.min(0, ...ys, L ? L.intercept : 0), ymax*1.08);
        P.drawAxes(); P.clearData();
        if (L) P.line([0, xmax*1.08], [L.intercept, L.slope*xmax*1.08 + L.intercept], C_MODEL, 1.3, undefined, { label: 'fit', key: 'fit' });
        P.points(xs, ys, gasOf(g).color, 3.5, { fill: true, label: 'standards', key: 'standards' });
        P.attachTools(svg.closest('.plot-wrap'));
        if (!L){ const one = new Set(xs).size === 1; stats.innerHTML = `<p class="txt-meta">${pts.length} standard${pts.length === 1 ? '' : 's'}${one ? ' at one concentration' : ''}: a free intercept needs two concentrations at least${cal.zero[g] ? '' : '; a zero intercept fits one'}.</p>`; return; }
        const levels = new Map();
        (L.residuals || []).forEach(r=>{ const k = String(r.conc); if (!levels.has(k)) levels.set(k, []); levels.get(k).push(r); });
        stats.innerHTML = `<p class="gci-cal-line">slope <b>${sig(L.slope, 6)}</b> area/${esc(cal.unit)}, intercept <b>${sig(L.intercept, 5)}</b>${cal.zero[g] ? ' (fixed)' : ''}, R² = <b>${fin(L.r2) ? L.r2.toFixed(5) : '—'}</b>, n = ${L.n}</p>`
          + `<table class="gci-cal-dev"><thead><tr><th>Level (${esc(cal.unit)})</th><th>n</th><th>Mean area</th><th>Line</th><th>Deviation</th></tr></thead><tbody>${[...levels.entries()].sort((a, b)=> a[0] - b[0]).map(([c, rs])=>{
            const mA = rs.reduce((s, r)=> s + r.area, 0)/rs.length, fit = rs[0].fitted, dev = fit ? 100*(mA - fit)/fit : NaN;
            return `<tr><td>${sig(+c, 5)}</td><td>${rs.length}</td><td>${sig(mA, 5)}</td><td>${sig(fit, 5)}</td><td class="${fin(dev) && Math.abs(dev) > 3 ? 'gci-bad' : ''}">${fin(dev) ? (dev > 0 ? '+' : '') + dev.toFixed(2) + ' %' : '—'}</td></tr>`; }).join('')}</tbody></table>`;
      }
      return { open, close, paint, el: m, isOpen: ()=> isOpen, destroy(){ close(); m.remove(); } };
    }

    /* ---- Its CSVs: every chromatogram's values (integration.csv, the run overview's); the
       chromatogram on show, its model and parts and its residuals (chromatogram.csv, the
       chromatogram's plot's: the whole chromatogram, the model's columns blank outside the
       fit window) ---- */
    function exportEntries(n){
      const es = entries();
      if (!es.length) return [];
      const gs = Object.keys(GAS);
      let t = csvLine(['File', 'Table', 'Injection', 'Injection date', ...gs.flatMap(g=> [`${gasOf(g).csv} area`, `${gasOf(g).csv} area sd`, `${gasOf(g).csv} apex (s)`, `${gasOf(g).csv} chi2r`, `${gasOf(g).csv} (%mol)`, `${gasOf(g).csv} source`, `${gasOf(g).csv} table (%mol)`, `${gasOf(g).csv} suspicious`]), 'Flags']);
      es.forEach(e=>{
        if (e.d.error) return;
        const R = resOf(e.tcd), res = R.stale ? [] : R.res || [], conv = convAll(e, res), J = judge(e, res);
        for (let k = 0; k < e.n; k++){
          const r = res[k], times = aligned(e) ? e.table.injDates : null;
          t += csvLine([e.tcd.name, e.table ? e.table.name : '', String(k + 1), times ? isoLocal(times[k]) : '', ...gs.flatMap(g=>{
            const x = r && r.gases && r.gases[g], c = conv[g];
            return [fmtNum(x ? x.area : NaN, 6), fmtNum(x ? x.sd : NaN, 6), fmtNum(x ? x.tApex : NaN, 3), fmtNum(x ? x.chi2r : NaN, 4),
              x && c && c.f ? fmtNum(c.f(x.area), 6) : '', c && c.f ? (c.how === 'cal' ? 'calibration' : `transfer (k = ${sig(c.k, 6)})`) : '', aligned(e) && e.table.gas[g] ? fmtNum(e.table.gas[g][k], 6) : '',
              r ? (J.bad(k, g) ? 'yes' : 'no') : ''];
          }), J(k).join('; ')]);
        }
      });
      const out = [{ name: `${n} - integration.csv`, text: t }];
      const d = drawn;
      if (d && d.e && es.some(x=> x.name === d.e.name)){
        const at = new Map(), cols = [], heads = [];
        const put = (h, xs, ys)=>{ const m = new Map(); xs.forEach((x, i)=> m.set(x, ys[i])); cols.push(m); heads.push(h); };
        d.curves.forEach(({ wr, c })=>{
          if (c.model) put(`model ${wr.key}`, c.t, c.model);
          if (c.base) put(`baseline ${wr.key}`, c.t, c.base);
          Object.entries(c.peaks || {}).forEach(([name, cv])=> put(`${name} (on the baseline)`, c.t, c.base ? cv.map((v, i)=> v + c.base[i]) : cv));
          if (c.residual) put(`residual ${wr.key}`, c.t, c.residual);
        });
        d.t.forEach((x, i)=> at.set(x, d.y[i]));
        let ct = csvLine(['Time (s)', 'TCD signal', ...heads]);
        d.t.forEach(x=>{ ct += csvLine([fmtNum(x, 4), fmtNum(at.get(x), 6), ...cols.map(m=> m.has(x) ? fmtNum(m.get(x), 6) : '')]); });
        out.push({ name: `${n} - chromatogram.csv`, text: ct });
      }
      return out;
    }
    const isoLocal = d =>{ const x = new Date(d); return fin(+x) ? `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}` : ''; };

    return {
      kind: 'integ',
      method: ()=> method,
      tcdRecs,
      valuesFor,
      // (a change of its that the cards below read: their sources' key)
      sig: ()=> exactKey([methodKey(method), calKey()]),
      paintStatus(all){ paintStatus(all); if (calModal.isOpen()) calModal.paint(); },
      slots: ()=> [],
      clear(){ selName = null; selK = 0; },
      unselect(){},
      shows(){ const e = cur(); return e ? { file: e.name, k: selK } : null; },
      showNext(v){ next = isObj(v) ? v : null; if (next && typeof next.file === 'string'){ selName = next.file; selK = Number.isInteger(next.k) && next.k >= 0 ? next.k : 0; } },
      bars(){},
      renderTable(){ renderSel(); paintAlerts(); paintStatus(); },
      compute(keep){ draw(keep); },
      computeQuiet(){ renderSel(); paintAlerts(); paintStatus(); },
      hasResults: ()=> false,
      exportEntries,
      // (ovGas kept as v544 had it, a list: one gas now)
      snapshot(){ return { method: clone(method), cal: calCopy(cal), ovGas: [ovGas], ovY }; },
      restore(s0){
        const s = isObj(s0) ? s0 : {};
        const m = methodIn(s.method);
        if (methodKey(m) !== methodKey(method)) wasMethod = null;
        method = m; cal = calIn(s.cal);
        ovGas = (Array.isArray(s.ovGas) ? Object.keys(GAS).find(g=> s.ovGas.includes(g)) : null) || 'h2';
        ovY = oneOf(s.ovY, ['conc', 'area']);
        valuesKept.clear();
        if (calModal.isOpen()) calModal.paint();
      },
      calOpen: ()=> calModal.open(),
      destroy(){ calModal.destroy(); fileNav.close(); injNav.close(); },
    };
  }

  // (a file the drop read: its chromatograms kept by its bytes, not read again)
  const prime = (bytes, d)=>{ if (bytes instanceof Uint8Array && d && !d.error) read.set(bytes, d); };
  return { card, saved, load, ensure, stop, later, status, pending, dataOf, prime, destroy(){ dead = true; stop(); clearTimeout(soon); cancelAnimationFrame(painting); }, store };
}
