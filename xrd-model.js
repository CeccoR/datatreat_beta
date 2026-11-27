/* =========================================================
   XRPD — what the module's host of its cards works out that touches no page (xrd.js wires
   it to the drop zone, the file list, the cards, the standard's two windows and the
   history; tests/xrdmodel.test.mjs calls it in Node): a file's scans made patterns (each
   scan one, 2θ ascending, their arrays fixed and shared), read again from a project's
   bytes (kept by them: a note where the arrays held changed); a file and a project as a
   restore takes them (the files read again, those left out, the sample on show, a project
   from before the cards migrated, a kind's settings, the cards' records); the per-sample
   slots of the cards' settings; what a run wrote patched into the states of the history;
   the cards' states saved; the patterns a drop loads; what the tab shows beside its state
   and what it is given back. Taken out of v562's xrd.js (createXrd, one closure of 488
   lines, and the functions round it) with their operations in their order: the same
   values to the last bit.

   utils.js's and modkit.js's helpers, and the page's reading of a file's bytes, are handed
   in as one object, U = { isObj, colorOf, scansOf } (xrd.js U; scansOf: a file's bytes
   parsed as XML, xrd-instr.js readXrdmlScans' scans, or why not).
========================================================= */
import { fixed } from './db.js';

/* A file's scans as read, kept by its bytes for every instance (the file's bytes are the
   same array in the tabs, their histories and their parked states): a tab woken, or an
   undo, reads none again, and its patterns are the same arrays as before, shared by its
   history (to v517 one cache, the module's one instance's). */
const reread = new WeakMap();
// A file just read: its scans kept by its bytes (as readAgain keeps its readings: up to
// v490 the first restore after a file was loaded, an undo, read it again).
export const keepScans = (bytes, scans)=>{ reread.set(bytes, scans); };

/* ---- A file read, and a state put back (pure: the module's, for every instance) ---- */
// A scan run downwards (start above end) turned round: the plots, the peak search and
// the Rietveld card take 2θ ascending (rawBytes keep the file as it was). On loading,
// and on restoring a project saved by an earlier version that kept the file's order.
export const ascending = f => f.x.length > 1 && f.x[0] > f.x[f.x.length-1]
  ? { ...f, x: f.x.slice().reverse(), y: f.y.slice().reverse(), ...(f.varMul ? { varMul: f.varMul.slice().reverse() } : {}) } : f;
/* A pattern's 2θ, intensities and variance factors never change once read (a file read
   again gives new ones): fixed (db.js; to v517 frozen, which holds a double in twice the
   memory), so that the undo history's key of a state (stateKey) takes each once, by a
   hash kept for it, a state parked shares them, and a view drawn from them is not drawn
   again for a state that holds the same (to v490 every edit wrote them out, 25 ms with 12
   patterns, and every restore, an undo too, copied them anew, each view drawn again).
   A scan's arrays are made so once, 2θ ascending, and shared by the pattern loaded and
   every restore of it; a file's of a project with no bytes are fixed where restored. */
export const fixedArrs = f => { ['x', 'y', 'varMul'].forEach(k=> fixed(f[k])); return f; };
export const scanArrays = sc => sc.arrs || (sc.arrs = fixedArrs(ascending({ x: sc.x, y: sc.y, ...(sc.varMul ? { varMul: sc.varMul } : {}) })));

/* A file's scans, each a pattern of its own: one scan, the file as it was read up to
   v483; several (a series measured in one go), "<file> (scan k)" each (labelled with the
   sample's name the file gives in place of the file's, v532), k counting every
   scan of the file, its name the file's with " (scan k)" before the extension (a key of
   the cards' results: one per pattern), the file's bytes shared, and scan (k − 1) and
   src (the file's name) kept for reading it again and for the "already loaded" test (to
   v483 the first scan alone was read, the others never seen). A scan that cannot be read
   is left out (skipped says why); none readable, the file is refused with the reasons.
   → { pats: [{ f, k, notes }], skipped, n } or { error } */
export function patternsOf(name, rawBytes, scans, sample = ''){
  const n = scans.length, base = name.replace(/\.[^.]+$/, ''), ext = name.slice(base.length), own = sample || base;
  const ok = scans.map((sc, k)=> ({ sc, k })).filter(q=> !q.sc.error);
  if (!ok.length) return { error: n > 1 ? scans.map((sc, k)=> `scan ${k+1}: ${sc.error}`).join('; ') : scans[0].error };
  const pats = ok.map(({ sc, k })=>{ const a = scanArrays(sc);
    return { k, notes: sc.notes, f: { name: n > 1 ? `${base} (scan ${k+1})${ext}` : name, label: n > 1 ? `${own} (scan ${k+1})` : own,
      x: a.x, y: a.y, rawBytes, ...(n > 1 ? { src: name, scan: k } : {}), ...(sc.meas ? { meas: sc.meas } : {}), ...(a.varMul ? { varMul: a.varMul } : {}) } }; });
  return { pats, n, skipped: scans.map((sc, k)=> sc.error ? `scan ${k+1} not read (${sc.error})` : null).filter(Boolean) };
}
// A file's patterns a drop loads: those whose names are not in the list (`existing`); a
// scan whose name is (one of the file's, dropped again after others were removed, or a
// file loaded under that name: its results by it) stays as it is.
export const freshOf = (r, existing)=> r.pats.filter(q=> !(q.f.src && existing.has(q.f.name)));

/* A project keeps each file's arrays as the version that loaded it read them. Up to v262
   the intensities came in with their minimum subtracted, which the Rietveld weights then
   took for the counts: the user's LaB6, so kept, fitted at χ²_ν 3.93, R_exp 3.89 % where
   the file itself gives 2.17 and 3.54 % (the same parameters, the esds and the weights
   off). Restored, a file is read again from its own bytes (rawBytes), as a file loaded
   now is, and a note names those whose arrays changed; one whose bytes were not kept is
   used as it was, with a note where its lowest point is exactly 0. The readings are kept
   by their bytes, so an undo does not read a file again. A pattern is its scan of the
   file (f.scan; the first, none given), so a file of several gives its scans again, in
   their order. (reread: the module's, above) */
export function readAgain(U, f){
  const b = f.rawBytes;
  if (!b || typeof b !== 'object' || !/\.(xrdml|xml)$/i.test(f.name || '')){
    let lo = Infinity; for (const v of f.y || []) if (v < lo) lo = v;
    return { f: fixedArrs(ascending({ ...f })), note: !b && lo === 0 ? 'its lowest point is exactly 0 and the project does not hold the file itself: its minimum may have been subtracted (as up to v262), which the Rietveld weights would take for the counts; load the file again' : null };
  }
  let all = reread.get(b);
  if (!all){
    try { all = U.scansOf(b); } catch (e){ all = [{ error: String(e && e.message || e) }]; }
    reread.set(b, all);
  }
  const sc = all[Number.isInteger(f.scan) && f.scan >= 0 ? f.scan : 0] || { error: 'no such scan' };
  if (sc.error) return { f: fixedArrs(ascending({ ...f })), note: null };
  const { varMul: _, ...rest } = f, a = scanArrays(sc);
  const g = { ...rest, x: a.x, y: a.y, ...(a.varMul ? { varMul: a.varMul } : {}) };
  const old = ascending({ ...f });
  return { f: g, note: movedNote(old, g, sc) };
}
// What a file read again says: nothing where its arrays are the ones the state held (old),
// else that they changed (points left out that an earlier version, to v484, kept as no
// number, or its minimum subtracted, up to v262).
function movedNote(old, g, sc){
  const n = g.y.length;
  // (the arrays the state holds, the scan's own: nothing moved)
  const same = old.x === g.x && old.y === g.y && old.varMul === g.varMul;
  let moved = !same && (!old.y || old.y.length !== n || !old.x || old.x.length !== n || !!old.varMul !== !!g.varMul);
  for (let i = 0; !same && !moved && i < n; i++)
    moved = Math.abs(old.y[i] - g.y[i]) > 1e-9*Math.max(1, Math.abs(g.y[i])) || Math.abs(old.x[i] - g.x[i]) > 1e-9 || (g.varMul && Math.abs(old.varMul[i] - g.varMul[i]) > 1e-12);
  // (points left out that an earlier version, to v484, kept as no number: those)
  const lost = sc.dropped && old.y && old.y.length === n + sc.dropped;
  return !moved ? null : lost ? `read again from the file itself, ${sc.dropped} point${sc.dropped > 1 ? 's' : ''} whose values are no finite number left out (the project held ${sc.dropped > 1 ? 'them' : 'it'} as up to v484). Results refined before are from those: refine again`
    : 'read again from the file itself: the project held its data as an earlier version had read them (up to v262, with their minimum subtracted). Results refined before are from those: refine again';
}
/* A project read in may hold anything (an imported .json): the restore takes what it reads
   only as what it should be — a file an object with its pattern, 2θ and intensities as
   many and two at least (else it is left out, with a note), its name and label text; an
   index an integer in range; arrays where arrays are kept; the cards of a known kind —
   and anything else as its default (up to v484 a curIdx that was no number made the index
   NaN, and the cards read files[NaN].label; a file not an object, or with no arrays,
   threw before anything was drawn). */
export const isArr = v => Array.isArray(v) || ArrayBuffer.isView(v);
// The cards' kinds, as the menu lists them.
export const KINDS = { scherrer: 'Scherrer', rietveld: 'Rietveld' };
// (a kind of KINDS' own: 'constructor', 'toString' and the like are none)
export const isKind = k => Object.prototype.hasOwnProperty.call(KINDS, k);
export function keptFile(U, f, i, color){
  if (!U.isObj(f)) return null;
  const name = typeof f.name === 'string' && f.name ? f.name : `file ${i+1}`;
  const g = { ...f, name, label: typeof f.label === 'string' ? f.label : name.replace(/\.[^.]+$/, ''), color: typeof f.color === 'string' ? f.color : color };
  if (!(isArr(g.varMul) && isArr(g.y) && g.varMul.length === g.y.length)) delete g.varMul;
  let r;
  try { r = readAgain(U, g); } catch (e){ return null; }
  return isArr(r.f.x) && isArr(r.f.y) && r.f.x.length === r.f.y.length && r.f.x.length > 1 ? r : null;
}
/* A project from before the cards (v460): one Analysis and one Rietveld card, and the
   standard a file among the samples, chosen in a select. It becomes the standard's own
   file, its parameters and peaks the standard's analysis, its refinement the standard's
   Rietveld; the samples' settings go to a Scherrer card and a Rietveld card. A standard
   left out of the analysis was not in use: it stays a sample, left out. */
export function migrate(U, s){
  // (an entry that is no file kept in its place: the restore leaves it out with its
  // entries in the per-sample lists)
  const all = Array.isArray(s.files) ? s.files : [], incl = all.filter(f=> !U.isObj(f) || f.included !== false);
  const si = s.standardName ? incl.findIndex(f=> U.isObj(f) && f.name === s.standardName) : -1;
  const cut = a => Array.isArray(a) ? a.filter((_, i)=> i !== si) : a;
  const rv = U.isObj(s.rv) ? s.rv : {}, res = U.isObj(rv.results) ? rv.results : {};
  const stdRes = si >= 0 && res[s.standardName] ? { [s.standardName]: res[s.standardName] } : {};
  const smpRes = Object.fromEntries(Object.entries(res).filter(([k])=> !(si >= 0 && k === s.standardName)));
  let ci = s.curIdx || 0; if (si >= 0 && ci > si) ci--;
  return {
    files: si >= 0 ? all.filter(f=> f !== incl[si]) : all,
    std: si >= 0 ? (({ included, held, ...f })=> f)(incl[si]) : null,
    stdPeaks: si >= 0 ? { shared: s.stdParams, perParams: [s.stdParams], manualPeaks: [(s.manualPeaks || [])[si] || []], removedPeaks: [(s.removedPeaks || [])[si] || []] } : { shared: s.stdParams },
    stdRv: { phases: [], std: rv.std, start: rv.start, hold: rv.hold, fit: rv.fit, results: stdRes, refineB: rv.refineB },
    curIdx: ci,
    cards: [
      { id: 1, type: 'scherrer', states: { scherrer: { perParams: cut(s.perParams), manualPeaks: cut(s.manualPeaks), removedPeaks: cut(s.removedPeaks), shared: s.shared, paramMode: s.paramMode, sizeBy: s.sizeBy, norm: s.norm } } },
      { id: 2, type: 'rietveld', states: { rietveld: { ...rv, results: smpRes } } },
    ],
  };
}
// A kind's settings, the card's or kept while it is the other kind: an object, and the
// Scherrer one's per-sample lists arrays (the file list keeps them aligned: slots), the
// entries of the included files left out (gone: their places among the included) taken
// out, so each file after them keeps its own.
export function keptState(U, k, v, gone){
  if (!U.isObj(v)) return null;
  if (k !== 'scherrer') return v;
  const arr = a => Array.isArray(a) ? a.filter((_, i)=> !gone.has(i)) : [];
  return { ...v, shared: U.isObj(v.shared) ? v.shared : {}, perParams: arr(v.perParams), manualPeaks: arr(v.manualPeaks), removedPeaks: arr(v.removedPeaks) };
}
// A state as the restore takes it: of this version (v 2), or migrated.
export const stateIn = (U, s0)=> U.isObj(s0) && s0.v === 2 ? s0 : migrate(U, U.isObj(s0) ? s0 : {});
/* Its files read again (each its default colour by its place: U.colorOf), the standard's,
   how many are lost, and the places among the included of the files left out (an entry
   that is no file counts as included: it holds no included:false), whose entries the
   cards' per-sample lists drop. → { reads, stdRead, lost, gone } */
export function readsOf(U, s){
  const raw = Array.isArray(s.files) ? s.files : [], reads = raw.map((f, i)=> keptFile(U, f, i, U.colorOf(i)));
  const stdRead = s.std ? keptFile(U, s.std, 0, '#d4a72c') : null, lost = reads.filter(r=> !r).length;
  const gone = new Set();
  raw.reduce((j, f, i)=>{ if (U.isObj(f) && f.included === false) return j; if (!reads[i]) gone.add(j); return j + 1; }, 0);
  return { reads, stdRead, lost, gone };
}
// The sample on show stays the one it was, or the one now in its place (n: the samples).
export function curIdxOf(s, gone, n){
  const ci = Number.isFinite(s.curIdx) ? Math.max(0, Math.trunc(s.curIdx)) : 0;
  return Math.min(ci - [...gone].filter(j=> j < ci).length, Math.max(0, n-1));
}
// The cards a state holds, of a known kind (or none given), and each one's settings by
// kind as the deck reads its record (cards.js load's read).
export const cardsIn = (U, s)=> Array.isArray(s.cards) ? s.cards.filter(c=> U.isObj(c) && (c.type == null || isKind(c.type))) : [];
export const cardIn = (U, src, gone)=> ({ states: Object.fromEntries(Object.entries(clone(U.isObj(src.states) ? src.states : {})).filter(([k])=> isKind(k)).map(([k, v])=> [k, keptState(U, k, v, gone)]).filter(([, v])=> v)) });

/* ---- The cards' states ---- */
// A slot's entries copied (copyArr); a slot that also reads a file's entry held by an
// earlier version under 'k' + its key (heldAs: slots, in xrd.js).
export const copyArr = v => Array.isArray(v) ? v.slice() : [];
export const heldAs = sl => ({ ...sl, make: (v, f)=> sl.make(v === undefined && f && f.held ? f.held['k' + sl.key] : v, f) });
// The per-sample slots of the Scherrer settings a Rietveld card keeps (s), under its key.
export const keptSlots = (key, s)=> [{ key: key + ':params', arr: s.perParams, make: v=> v ? {...v} : {...s.shared} },
  { key: key + ':manual', arr: s.manualPeaks, make: copyArr },
  { key: key + ':removed', arr: s.removedPeaks, make: copyArr }];
// A card's element ids by its kind.
export const prefixOf = a => (a.type === 'scherrer' ? 'xrdA' : 'xrdR') + a.id;
// A Rietveld state with what a run wrote for the patterns named (runPatch), put where it
// goes; null where nothing new goes.
export function withResults(rv, names, wrote, put){
  const old = rv.results || {}, add = Object.entries(wrote).filter(([k, r])=> names.has(k) && old[k] !== r);
  return add.length ? put({ ...rv, results: { ...old, ...Object.fromEntries(add) } }) : null;
}
// A card's settings copied whole (JSON: they are plain data).
export const clone = o => JSON.parse(JSON.stringify(o));
// A card's settings of the kinds other than its own, copied, in their order (its own goes
// last: xrd.js snapshot).
export function otherStates(a){
  const states = {};
  Object.entries(a.states).forEach(([k, s])=>{ if (k !== a.type && s) states[k] = clone(s); });
  return states;
}
/* What a run wrote (file name → result) in a state of the history: in its card's Rietveld
   settings (by id: the card of that kind, or one switched to the other that keeps them,
   states.rietveld), or the standard's (id null), each pattern where its file is (by name).
   With it each file's instrument as read from its header (f.instr, which the run keeps on
   the live file as it reads it: a cache, the same for the file's own bytes; left out, the
   run's end saw it as a change, a step with nothing to see), the samples' from their list
   (all) and the standard's from its own (std: it may bear a sample's name). A copy, the
   state itself where nothing goes: the states' objects and the results, frozen and shared
   by them, are never changed. */
export function runPatch(U, id, wrote, all, std){
  const read = l =>{ const m = new Map(l.filter(f=> 'instr' in f).map(f=> [f.name, f]));
    return f =>{ const g = U.isObj(f) && m.get(f.name); return g && g.rawBytes === f.rawBytes && g.instr !== f.instr ? { ...f, instr: g.instr } : f; }; };
  const withIns = read(all), stdIns = read(std);
  return s =>{
    const f0 = s.files || [], files = f0.map(withIns), std = s.std && stdIns(s.std);
    if (std !== s.std || files.some((f, i)=> f !== f0[i])) s = { ...s, files, std };
    if (id == null) return s.std && s.stdRv && withResults(s.stdRv, new Set([s.std.name]), wrote, r=> ({ ...s, stdRv: r })) || s;
    const c = (s.cards || []).find(x=> x.id === id), rv = c && c.states && c.states.rietveld;
    return rv && withResults(rv, new Set((s.files || []).map(f=> f.name)), wrote, r=> ({ ...s, cards: s.cards.map(x=> x === c ? { ...c, states: { ...c.states, rietveld: r } } : x) })) || s;
  };
}

/* ---- What it shows beside its state (tabs.js, utils.js shownOf) ----
   The pattern on show (f), by its name, each card's own, by its id (out), and the
   standard's window's two alike (std), or null. */
export function showsOf(f, out, std){
  const has = o => Object.keys(o).length > 0;
  const v = { ...(f ? { pattern: f.name } : {}), ...(has(out) ? { cards: out } : {}), ...(has(std) ? { std } : {}) };
  return has(v) ? v : null;
}
// …given back as its tab wakes or the page is reloaded: what its cards, the pattern and the
// standard's windows showed.
export const showNextIn = (U, v)=> ({ cards: U.isObj(v) && U.isObj(v.cards) ? v.cards : null,
  pattern: U.isObj(v) && typeof v.pattern === 'string' ? v.pattern : null, std: U.isObj(v) && U.isObj(v.std) ? v.std : null });
