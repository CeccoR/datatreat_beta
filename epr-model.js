/* =========================================================
   EPR — what the module works out that touches no page (epr.js wires it to the drop zone
   and the Stacked Spectra cards; tests/eprmodel.test.mjs calls it in Node): a pair's .DSC
   read (its parameters, the field axis rescaled to 9.5 GHz), its .DTA's values as IRFMT
   and IKKF store them, the spectrum with its baseline taken off, or why it cannot be; the
   files of a drop grouped by stem; a spectrum's arrays fixed and kept by its .DTA's bytes;
   a file and a card as a project holds them (the smoothing of before v510 a number of
   points) and the state saved; the smoothing width typed and the points it spans; the
   stacking each normalisation draws, the plot's options and range; the CSV's columns.
   Taken out of v562's epr.js (createEpr, one closure of 245 lines, and the functions round
   it) with their operations in their order: the same values to the last bit.

   utils.js's and modkit.js's helpers, which need a page to load, are handed in as one
   object, U = { num, numStr, normOf, finitePairs, cardList, maxArr, minArr, fmtNum,
   fmtData } (epr.js U).
========================================================= */
import { meanStep, widthText, ptsNum, ptsText } from './smooth.js';
import { fixed } from './db.js';

/* ---- A spectrum kept (pure: the module's, for every instance) ----
   Its field and intensities, which nothing changes once read: fixed (db.js), the same
   arrays in a tab's states and its parked state. Kept by its .DTA's bytes (the file as it
   came, the same array in its states and its record): a tab of a record read back (a
   reload, a project opened), which holds copies, takes the arrays another state holds of
   that file, the same values, rather than keeping both. */
const spectra = new WeakMap();
export const sameArr = (a, b)=> a === b || (a.length === b.length && a.every((v, i)=> Object.is(v, b[i])));
export const dtaOf = f =>{ const r = Array.isArray(f.rawFiles) && f.rawFiles.find(r=> r && /\.dta$/i.test(r.name)); return r && r.bytes instanceof Uint8Array ? r.bytes : null; };
export function keepSpectrum(f){
  const k = dtaOf(f);
  fixed(f.b); fixed(f.a);
  if (!k) return f;
  const s = spectra.get(k);
  if (s && sameArr(s.b, f.b) && sameArr(s.a, f.a)){ f.b = s.b; f.a = s.a; }
  else spectra.set(k, { b: f.b, a: f.a });
  return f;
}

/* ---- Reading a pair, .DTA and .DSC ---- */
// A .DSC's parameters, a name and its value a line.
export function parseDsc(text){
  const p = {};
  for (const line of text.split(/\r?\n/)){
    const m = line.match(/^(\w+)\s+(.*)/);
    if (m) p[m[1]] = m[2].trim();
  }
  return p;
}

// A .DSC value without the quotes it may be written in ('G', 'mT').
export const dscWord = v => String(v || '').replace(/['"]/g, '').trim();
/* The field axis in mT, rescaled to 9.5 GHz. XMIN/XWID are in the unit XUNI
   names, Gauss unless it says mT; with no MWFQ there is no frequency to rescale
   by, and the field is the one measured. */
// h·(9.5 GHz)/μ_B, in mT: the field of g = 1 at 9.5 GHz, so that g = G_AT_95 / B.
export const G_AT_95 = 6.62607015e-34 * 9.5e9 / 9.2740100783e-24 * 1e3;
export function buildBAxis(p){
  const npts  = parseInt(p.XPTS);
  const toG   = dscWord(p.XUNI).toLowerCase() === 'mt' ? 10 : 1;
  const xmin  = parseFloat(p.XMIN) * toG;  // Gauss
  const xwid  = parseFloat(p.XWID) * toG;  // Gauss
  const mwfq  = parseFloat(p.MWFQ);        // Hz
  const k     = mwfq > 0 ? 9.5e8 / mwfq : 0.1;
  const b = [];
  for (let i = 0; i < npts; i++)
    b.push((xmin + xwid * i / (npts - 1)) * k);
  return b;
}

/* Why a pair cannot be read from its .DSC alone, or null: a field axis needs two points at
   least and its start and width (with XPTS 1 every field was NaN, to v483). */
export function dscError(p){
  const npts = parseInt(p.XPTS);
  if (!(npts >= 2)) return p.XPTS == null ? 'its .DSC gives no XPTS, the number of points' : `XPTS ${dscWord(p.XPTS)}: a spectrum needs two points at least`;
  if (!isFinite(parseFloat(p.XMIN)) || !isFinite(parseFloat(p.XWID))) return 'its .DSC gives no field axis (XMIN and XWID)';
  return null;
}
/* The .DTA's values as IRFMT stores them (64-bit floats unless it says otherwise), and
   for complex data (IKKF CPLX) the real part of each real/imaginary pair: read
   as plain doubles, those came out as garbage or stretched over twice the axis.
   The data must be in a format the reader knows and as long as XPTS says.
   → { s } or { error }. */
export function dtaValues(p, buf){
  const npts = parseInt(p.XPTS);
  const bigEndian = (p.BSEQ || 'BIG') !== 'LIT';
  const view = new DataView(buf);
  const fmt = dscWord(p.IRFMT).split(',')[0].toUpperCase() || 'D';
  const READ = { D: [8, (o, le)=> view.getFloat64(o, le)], F: [4, (o, le)=> view.getFloat32(o, le)],
                 I: [4, (o, le)=> view.getInt32(o, le)],   S: [2, (o, le)=> view.getInt16(o, le)], C: [1, o=> view.getInt8(o)] };
  if (!READ[fmt]) return { error: `IRFMT ${fmt}: a data format not read` };
  const [size, read] = READ[fmt];
  const stride = dscWord(p.IKKF).split(',')[0].toUpperCase() === 'CPLX' ? 2 : 1;
  if (buf.byteLength < npts * stride * size) return { error: `its .DTA holds fewer than the ${npts} points its .DSC gives` };
  const s = [];
  for (let i = 0; i < npts; i++)
    s.push(read(i * stride * size, !bigEndian));
  return { s };
}
/* A pair read (its .DSC's parameters p and bytes, `dsc` { name, bytes }; its .DTA's
   bytes `buf` and name): the spectrum, or { error } saying why it cannot be. */
export function spectrumOf(stem, p, dsc, buf, dtaName){
  const v = dtaValues(p, buf);
  if (v.error) return v;
  const s = v.s, b = buildBAxis(p);

  // linear baseline correction
  const n = s.length;
  const slope = (s[n-1] - s[0]) / (b[n-1] - b[0] || 1);
  const a = s.map((v, i) => v - (s[0] + slope * (b[i] - b[0])));

  // Whether the field was rescaled to 9.5 GHz: with no MWFQ it is the one measured.
  // (named as its .DSC names it, TITL, from v532; with none, as its files are)
  return { name: stem, label: dscWord(p.TITL) || stem, b, a, rescaled: parseFloat(p.MWFQ) > 0,
           rawFiles: [ { name: dsc.name, bytes: dsc.bytes },
                       { name: dtaName, bytes: new Uint8Array(buf) } ] };
}
// A file's extension as the alerts name it: '.DTA' or '.DSC'.
export const extOf = name => '.' + name.split('.').pop().toUpperCase();
/* How a file was read, said under the drop zone (utils.js FILE ALERTS, v567: to v566 with
   no word), or '': a spectrum with no microwave frequency is drawn on the field measured, and
   the plot has no g axis. Named by its .DSC, as its record keeps it (rawFiles), else by its
   stem. */
export const readNote = f => f.rescaled !== false ? ''
  : `${Array.isArray(f.rawFiles) && f.rawFiles[0] && typeof f.rawFiles[0].name === 'string' ? f.rawFiles[0].name : f.name}: no microwave frequency (MWFQ): plotted on the field measured, not at 9.5 GHz; no g axis.`;
/* A drop's files grouped by stem WITHIN THIS DROP only — nothing is carried over between
   uploads: a file neither .DTA nor .DSC is refused (`invalid`), one whose stem is loaded
   (`existing`) is said (`already`). */
export function groupsOf(list, existing){
  const invalid = [], already = [], groups = {};
  for (const f of list){
    const ext  = f.name.split('.').pop().toLowerCase();
    const stem = f.name.replace(/\.[^.]+$/, '');
    if (ext !== 'dta' && ext !== 'dsc'){ invalid.push(f.name); continue; }
    if (existing.has(stem)){ already.push(f.name); continue; }
    if (!groups[stem]) groups[stem] = { dta: null, dsc: null };
    groups[stem][ext] = f;
  }
  return { groups, invalid, already };
}

/* ---- A card's kinds and defaults; the state ---- */
export const KINDS = { spectra: 'Stacked Spectra' };
// (the smoothing a width in mT, 0.2 about 10 points of a 1024-point, 20-mT sweep; to v510
// a number of points, `smooth`, 10: readCard converts it)
export const DEF = { norm: 'global', smoothW: 0.2 };
/* A file as a restore takes it (modkit RESTORED): its field and intensities, the points
   where both are numbers, two at least (else it is left out); the arrays its file's
   bytes already have where they are the same (keepSpectrum). */
export function fileIn(U, f){
  const p = U.finitePairs(f.b, f.a);
  return p && p[0].length > 1 ? keepSpectrum({ ...f, b: p[0], a: p[1], rescaled: f.rescaled !== false }) : null;
}
// The cards a state holds; a project from before the cards had one analysis, its settings
// at the top level.
export const cardsIn = (U, s)=> U.cardList(s.cards, KINDS) || [{ id: 1, type: 'spectra', norm: s.norm, smooth: s.smooth }];
/* A card's settings in the history: its normalization and smoothing width (stateOf),
   a number from 0, else the default. Up to v510 the smoothing was a number of points,
   `smooth` (a whole number from 1, a string in a project from before the cards; modkit
   RESTORED): it becomes N times the median step of the spectra, as it was on those at
   that step (to rounding, for an even N; N = 1, none, is 0), the others smoothed by
   the ratio of their steps; with no spectrum, or no such number, the default. */
export function readCard(U, files, s){
  const st = files.map(f=> meanStep(f.b)).sort((x, y)=> x - y), med = st[st.length >> 1];
  const N = Math.round(U.num(U.numStr(s.smooth), NaN, v=> v >= 1));
  const w = 'smoothW' in s ? U.num(s.smoothW, NaN, v=> v >= 0) : N === 1 ? 0 : N*med;
  return { norm: U.normOf(s.norm), smoothW: Number.isFinite(w) ? w : DEF.smoothW };
}
// The module's state saved: each card's record (cards.js saved) with its settings.
export const stateOf = (recs, saved)=> ({ cards: recs.map(a=> ({ ...saved(a), norm: a.norm, smoothW: a.smoothW })) });

/* ---- The smoothing width ---- */
// A width typed (its field's change), a number from 0 (either decimal mark), else 0.
export const widthIn = v => Math.max(0, parseFloat(String(v).replace(',', '.')) || 0);
// The width the field holds: the record's, exact, while the field shows it unchanged.
export const widthOf = (value, shown, w)=> value === shown && Number.isFinite(w) ? w : parseFloat(String(value).trim().replace(',', '.'));
/* What a width spans in points of the spectra, at each one's step: one number, or the
   range when the steps differ (off at 0, nothing with no spectrum or no value), and its
   tooltip. → { t, tip } */
export function ptsOf(files, w){
  const ps = files.map(f=> w/meanStep(f.b)).filter(p=> p >= 0 && isFinite(p));
  let t = '', tip = '';
  if (ps.length && ps.length === files.length){
    const lo = Math.min(...ps), hi = Math.max(...ps);
    t = !w ? 'off' : ptsNum(lo) === ptsNum(hi) ? ptsText(lo) : `≈ ${ptsNum(lo)}–${ptsNum(hi)} pts`;
    tip = !w ? 'No smoothing' : files.map((f, k)=> `${f.label}: ${widthText(ps[k])} steps of ${widthText(meanStep(f.b))} mT`).join('\n');
  }
  return { t, tip };
}

/* ---- What a card draws ---- */
/* The smoothed column: the box w wide (smooth.js; to v510 a moving average over N
   points), then the user's normalisation — the background taken as the first point and
   divided by the peak-to-peak (local = own, global = largest across samples), matching
   the on-screen divisor; none: the smoothed trace as it is, background and all. */
export function smoothedOut(U, sms, norm){
  if (norm==='none') return sms;
  const ppks = sms.map(sm => (U.maxArr(sm)-U.minArr(sm)) || 1);
  const gPP = Math.max(...ppks);
  return sms.map((sm, k)=>{ const bg = sm[0] ?? 0, div = norm==='local' ? ppks[k] : gPP; return sm.map(v=>(v-bg)/div); });
}
/* The field is each spectrum's rescaled to 9.5 GHz (buildBAxis), so the axis says so
   and carries g along the top: g = hν/(μ_B·B) at that ν, 678.753 mT / B. A file
   without its frequency is on its measured field, where g cannot be read. */
export const plotOpts = at95 => ({xlabel: at95 ? 'Magnetic Field at 9.5 GHz (mT)' : 'Magnetic Field (mT)', ylabel:'Intensity (a. u.)', noYTickLabels:true,
  ...(at95 ? { topAxis: { label:'g', of: B=> G_AT_95/B, at: g=> G_AT_95/g, fmt: v=> v.toFixed(4) }, margin:{l:55,r:20,t:48,b:40} } : {})});
/* The smoothed spectra Y stacked as the normalisation draws them, and the plot's range in
   y: → { Y, lo, hi }. */
export function stackOf(U, Y, norm){
  const { maxArr, minArr } = U, n = Y.length;
  // (none: the spectra as they are, each centred in a slot as tall as the largest
  // peak-to-peak — the plot's unit — as global draws them divided by it)
  const gPP0 = Math.max(...Y.map(y=> maxArr(y) - minArr(y))) || 1, unit = norm==='none' ? gPP0 : 1;
  const baseOf = k => (n-1-k)*1.1*unit;
  if (norm==='local'){
    Y = Y.map((y,k)=>{ const mn=minArr(y),mx=maxArr(y); const sc=mx===mn?0:1.0/(mx-mn); return y.map(v=>(v-mn)*sc+baseOf(k)+0.05); });
  } else if (norm==='none'){
    Y = Y.map((y,k)=>{ const mid=(maxArr(y)+minArr(y))/2; return y.map(v=>v-mid+baseOf(k)+0.55*unit); });
  } else {
    Y = Y.map(y=>{ const m=minArr(y); return y.map(v=>v-m); });
    // Spectra all flat have no peak-to-peak to divide by: drawn as they are, each a line
    // in its slot (to v494 0/0 drew nothing).
    const gmax = Math.max(...Y.map(maxArr)), g = gmax > 0 && isFinite(gmax) ? gmax : 1;
    Y = Y.map((y,k)=>{ const mid=maxArr(y)/(2*g); return y.map(v=>v/g+baseOf(k)+0.55-mid); });
  }
  return { Y, lo: baseOf(n-1), hi: baseOf(0)+1.1*unit };
}
/* A card's CSV's columns: per sample the (already g-corrected) field, the raw intensity —
   already baseline-centred at import — and the processed smoothed trace (`out`,
   smoothedOut). */
export function csvCols(U, files, out, a){
  // (as they are, intensities of any scale keep their digits, as the raw ones: fmtData)
  const fmt = a.norm==='none' ? U.fmtData : U.fmtNum;
  const cols = [];
  files.forEach((f,k)=>{
    // Rescaled to 9.5 GHz, which the header says: it is not the field measured.
    cols.push({h:(f.rescaled !== false ? 'Bfield_mT_at_9.5GHz_' : 'Bfield_mT_')+f.label, v:f.b.map(v=>U.fmtNum(v,6))});
    // Intensities of any scale keep their digits (fmtData): a tiny one is not 0.
    cols.push({h:'Raw_'+f.label,                   v:f.a.map(v=>U.fmtData(v,6))});
    // (the width in mT as its field shows it; to v510 the points, N=)
    cols.push({h:`Smoothed_${f.label} (w=${widthText(a.smoothW)} mT)`,   v:out[k].map(v=>fmt(v,6))});
  });
  return cols;
}
