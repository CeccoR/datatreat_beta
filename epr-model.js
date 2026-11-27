/* =========================================================
   EPR — what the module works out that touches no page (epr.js wires it to the drop zone
   and the Stacked Spectra cards; tests/eprmodel.test.mjs calls it in Node): a pair's .DSC
   read (its parameters, the field axis rescaled to 9.5 GHz), its .DTA's values as IRFMT
   and IKKF store them, the spectrum with its baseline taken off, or why it cannot be; the
   list's rows (v581, as GC's: a .DTA and its .DSC, paired by their names or by a file's grip,
   a half alone waiting for its partner), each one's record, what it reads as and what is said
   of it; a spectrum's arrays fixed; a file and a card as a
   project holds them (a row read again from its files' bytes) and the state saved;
   the smoothing width typed and the points it spans; the stacking each normalisation draws,
   the plot's options and range; the CSV's columns. Taken out of v562's epr.js (createEpr,
   one closure of 245 lines, and the functions round it) with their operations in their
   order: the same values to the last bit.

   utils.js's and modkit.js's helpers, which need a page to load, are handed in as one
   object, U = { num, normOf, finitePairs, cardList, maxArr, minArr, fmtNum, fmtData }
   (epr.js U).
========================================================= */
import { meanStep, widthText, ptsNum, ptsText } from './smooth.js';
import { fixed } from './db.js';
import { decodeText } from './textdata.js';
import { heldLine } from './alerts.js';

/* ---- A spectrum fixed ----
   Its field and intensities, which nothing changes once read: fixed (db.js), the same
   arrays in a tab's states and its parked state (and in every tab of the pair's bytes: its
   reading is kept by them, readRow). */
const fixedSpectrum = f =>{ fixed(f.b); fixed(f.a); return f; };

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
   The data must be in a format the reader knows and as long as XPTS says. `bytes` the
   .DTA's (a Uint8Array). → { s } or { error }. */
export function dtaValues(p, bytes){
  const npts = parseInt(p.XPTS);
  const bigEndian = (p.BSEQ || 'BIG') !== 'LIT';
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fmt = dscWord(p.IRFMT).split(',')[0].toUpperCase() || 'D';
  const READ = { D: [8, (o, le)=> view.getFloat64(o, le)], F: [4, (o, le)=> view.getFloat32(o, le)],
                 I: [4, (o, le)=> view.getInt32(o, le)],   S: [2, (o, le)=> view.getInt16(o, le)], C: [1, o=> view.getInt8(o)] };
  if (!READ[fmt]) return { error: `IRFMT ${fmt}: a data format not read` };
  const [size, read] = READ[fmt];
  const stride = dscWord(p.IKKF).split(',')[0].toUpperCase() === 'CPLX' ? 2 : 1;
  if (bytes.byteLength < npts * stride * size) return { error: `its .DTA holds fewer than the ${npts} points its .DSC gives` };
  const s = [];
  for (let i = 0; i < npts; i++)
    s.push(read(i * stride * size, !bigEndian));
  return { s };
}
/* A pair read (its .DSC's parameters p, its .DTA's bytes): the spectrum, { b, a, rescaled },
   or { error } saying why it cannot be. */
export function spectrumOf(p, bytes){
  const v = dtaValues(p, bytes);
  if (v.error) return v;
  const s = v.s, b = buildBAxis(p);

  // linear baseline correction
  const n = s.length;
  const slope = (s[n-1] - s[0]) / (b[n-1] - b[0] || 1);
  const a = s.map((v, i) => v - (s[0] + slope * (b[i] - b[0])));

  // Whether the field was rescaled to 9.5 GHz: with no MWFQ it is the one measured.
  return { b, a, rescaled: parseFloat(p.MWFQ) > 0 };
}
// A file's extension as the alerts name it: '.DTA' or '.DSC'.
export const extOf = name => '.' + name.split('.').pop().toUpperCase();

/* ---- The list's rows (v581: as GC's; filelist-model.js autoPair and dropPart, modkit.js
   pairs) ----
   A row is one file or two, each { name, bytes } (its record's rawFiles, in the list's order:
   a pair's .DTA first). Its record is a spectrum where its files are a .DTA and a .DSC that
   read as one (b, a: plotted); else it has none, waits in the list, not plotted, and is said
   (rowNote): a half alone (to v580 refused: "drop the two together"), two files of one kind,
   a pair that cannot be read (to v580 refused as it was dropped). Files dropped pair by their
   names, the same but for the extension (sideOf), with each other or with a half waiting in
   the list; a file dragged by its own grip onto another pairs or swaps them, whatever their
   names. */
// A file's kind by its extension: 'dta', 'dsc', or '' (neither: not one of a pair's).
export const kindOf = name =>{ const m = /\.(dta|dsc)$/i.exec(String(name)); return m ? m[1].toLowerCase() : ''; };
const kindAt = x => x && typeof x === 'object' ? kindOf(x.name) : '';
const stemOf = name => String(name).replace(/\.[^.]+$/, '');
// How a file pairs by its name (filelist-model.js autoPair): its stem, a .DTA first.
export const sideOf = f => ({ stem: stemOf(f.name), first: kindOf(f.name) === 'dta' });
// A row's files in the list's order: a .DTA first beside its .DSC.
export const ordered = fs => fs.length === 2 && kindAt(fs[0]) === 'dsc' && kindAt(fs[1]) === 'dta' ? [fs[1], fs[0]] : fs;
/* A record's files: those of its rawFiles that are a .DTA or a .DSC; none (a project read in
   may hold anything), a stand-in named as the record, so that its row is one of the list's. */
export const rowFiles = r =>{ const fs = Array.isArray(r.rawFiles) ? r.rawFiles.filter(kindAt) : []; return fs.length ? fs : [{ name: String(r.name) }]; };
// A record plotted: a spectrum.
export const isSpectrum = r => Array.isArray(r.b);
/* What a row's files read as (the same files read once, by their bytes): { title } (its .DSC's
   TITL, '' with none) and the spectrum (spectrumOf), or { why } it has none (`alone`: a half). */
const dscs = new WeakMap(), pairs = new WeakMap();
function dscOf(f){
  if (!(f.bytes instanceof Uint8Array)) return null;
  if (!dscs.has(f.bytes)) dscs.set(f.bytes, parseDsc(decodeText(f.bytes)));
  return dscs.get(f.bytes);
}
export function readRow(files){
  const kinds = files.map(kindAt), dta = files[kinds.indexOf('dta')], dsc = files[kinds.indexOf('dsc')];
  const p = dsc ? dscOf(dsc) : null, title = p ? dscWord(p.TITL) : '';
  if (files.length < 2) return { title, why: `its ${dta ? '.DSC' : '.DTA'} is missing`, alone: true };
  if (!dta || !dsc) return { title, why: `two ${extOf(files[0].name)} files paired` };
  if (!p || !(dta.bytes instanceof Uint8Array)) return { title, why: 'its bytes are not stored in this browser any more' };
  let m = pairs.get(dta.bytes);
  if (!m) pairs.set(dta.bytes, m = new WeakMap());
  if (!m.has(dsc.bytes)){ const bad = dscError(p); m.set(dsc.bytes, bad ? { error: bad } : spectrumOf(p, dta.bytes)); }
  const r = m.get(dsc.bytes);
  return r.error ? { title, why: r.error } : { title, ...r };
}
/* A row's name (its record's, the key the list and the plots know it by): a pair's its
   .DTA's stem (as to v580), any other row its first file's name. */
export function rowName(files){
  const d = files.find(f=> kindAt(f) === 'dta');
  return d && files.some(f=> kindAt(f) === 'dsc') ? stemOf(d.name) : files[0].name;
}
// A row's label as it starts: as its .DSC names it (TITL, from v532), else its name's stem.
export const labelOf = (files, r = readRow(files))=> r.title || stemOf(rowName(files));
/* A file's label renamed, in the records `was` (v582, as GC keeps a label a file: its pair's
   second its own record, gc-model.js rowFiles): the label of the row it headed where that was
   renamed (not its files' label as it started), else the one its entry in a row's files keeps
   as that row's second; none, null. A row's label is its first file's. */
function labelIn(was, name){
  for (const r of was){
    const fs = rowFiles(r), k = fs.findIndex(f=> f.name === name);
    if (k > 0) return typeof fs[k].label === 'string' ? fs[k].label : null;
    if (!k) return r.label !== labelOf(fs) ? r.label : null;
  }
  return null;
}
/* A row's record made of its files (regroup): the spectrum they read as, or none; named and
   labelled anew, not coloured yet (regroup colours it), but where `base`, the record its first
   file headed, gives them: its colour and whether it is included. Each file its label renamed
   (labelIn): the first file's the row's, a second's kept on its entry ({ name, bytes, label }),
   so that the pair split gives it back (v582: to v581 a second file's label renamed was lost,
   the row it headed again labelled anew). */
const entry = (f, l)=>{ if (l != null) return { ...f, label: l }; if (!('label' in f)) return f; const { label: _l, ...g } = f; return g; };
function rowRec(files, was){
  const fs = ordered(files), r = readRow(fs), own = fs.map(f=> labelIn(was, f.name)), base = was.find(x=> rowFiles(x)[0].name === fs[0].name);
  const rawFiles = fs.map((f, k)=> entry(f, k ? own[k] : null));
  const rec = { name: rowName(fs), label: own[0] != null ? own[0] : labelOf(fs, r), color: null, rawFiles };
  if (base){
    rec.color = base.color;
    if (base.included === false){ rec.included = false; rec.held = base.held; }
  }
  return r.b ? fixedSpectrum({ ...rec, b: r.b, a: r.a, rescaled: r.rescaled }) : rec;
}
/* The rows given anew (arrays of files): the list's records (`all`, in place) made of them. A
   row of the files a record has (by their names, in the list's order) is that record as it
   is; any other a new one (rowRec), from the records before; one that none gives its colour
   coloured `colorOf(the records coloured)`, in order (utils.js nextColor: one no other row
   wears). */
export function regroup(all, rows, colorOf){
  const was = all.slice(), names = fs => ordered(fs).map(f=> f.name).join('\n');
  const out = rows.filter(r=> r.length).map(fs=>{
    const k = names(fs);
    return was.find(r=> names(rowFiles(r)) === k) || rowRec(fs, was);
  });
  out.forEach(r=>{ if (!r.color) r.color = colorOf(out.filter(x=> x.color)); });
  all.splice(0, all.length, ...out);
}
// FILE's lines for a row (modkit.js pairs' parts): its files, each marked where the row is not plotted, with why.
export function partsOf(r){
  const fs = rowFiles(r), x = isSpectrum(r) ? null : readRow(fs);
  return fs.map(f=> ({ name: f.name, warn: x ? x.why + ': not plotted' : '' }));
}
/* What is said of a row not plotted, to check (epr.js notes; ALERTS-REVIEW.md R4, E02, v581),
   or null: { key, line } (plain text), its key the issue it names (alerts.js markOf, as GC's
   pairs: `alone`, or the file paired with it), so that a × marks that issue alone. */
export function rowNote(r){
  if (isSpectrum(r)) return null;
  const fs = rowFiles(r), x = readRow(fs);
  if (x.alone) return { key: 'alone', line: `${fs[0].name}: ${x.why}: not plotted until it is paired; drop it, or drag one onto it by its own grip.` };
  return { key: 'pair:' + fs[1].name, line: `${fs[0].name} + ${fs[1].name}: ${x.why}: not plotted${x.why.startsWith('two ') ? '; drag a file by its own grip to pair it' : ''}.` };
}
/* What a project opened says of a row plotted from the spectrum it holds, not read again from
   its files' bytes (fileIn: none stored, or none the reader takes), or '': named by its files. */
export function heldNote(r){
  if (!isSpectrum(r)) return '';
  const fs = rowFiles(r), x = readRow(fs);
  return x.b ? '' : `${fs.map(f=> f.name).join(' + ')}: ${heldLine(fs.every(f=> f.bytes instanceof Uint8Array) ? x.why : null)}.`;
}
/* How a file was read, said under the drop zone (utils.js FILE ALERTS, v567: to v566 with
   no word), or '': a spectrum with no microwave frequency is drawn on the field measured, and
   the plot has no g axis. Named by its .DSC, as its record keeps it (rawFiles), else by its
   name. */
export const readNote = f =>{
  if (f.rescaled !== false) return '';
  const d = Array.isArray(f.rawFiles) && f.rawFiles.find(x=> kindAt(x) === 'dsc' && typeof x.name === 'string');
  return `${d ? d.name : f.name}: no microwave frequency (MWFQ): plotted on the field measured, not at 9.5 GHz; no g axis.`;
};

/* ---- A card's kinds and defaults; the state ---- */
export const KINDS = { spectra: 'Stacked Spectra' };
// (the smoothing a width in mT, 0.2 about 10 points of a 1024-point, 20-mT sweep)
export const DEF = { norm: 'global', smoothW: 0.2 };
/* A file as a restore takes it (modkit RESTORED): its files in the list's order, the bytes of
   each a Uint8Array or none (null); what they read as (readRow), its spectrum read again from
   them, or a row not plotted. Where they read as none and the file holds its field and
   intensities (bytes not stored, or ones the reader refuses: heldNote says so), those are its
   spectrum, the points where both are numbers, two at least; none of either, it is left out. A
   spectrum fixed (fixedSpectrum). */
const bytesIn = x => x && typeof x === 'object' && x.bytes != null && !(x.bytes instanceof Uint8Array) ? { ...x, bytes: null } : x;
export function fileIn(U, f){
  const g = Array.isArray(f.rawFiles) ? { ...f, rawFiles: ordered(f.rawFiles.map(bytesIn)) } : f;
  const fs = Array.isArray(g.rawFiles) ? g.rawFiles.filter(kindAt) : [], r = fs.length ? readRow(ordered(fs)) : null;
  if (r && r.b) return fixedSpectrum({ ...g, b: r.b, a: r.a, rescaled: r.rescaled });
  const p = U.finitePairs(g.b, g.a);
  if (p && p[0].length > 1) return fixedSpectrum({ ...g, b: p[0], a: p[1], rescaled: g.rescaled !== false });
  if (!fs.length) return null;
  const { b: _b, a: _a, rescaled: _r, ...w } = g;
  return w;
}
// The cards a state holds; none, one of the defaults, as a new project starts.
export const cardsIn = (U, s)=> U.cardList(s.cards, KINDS) || [{ id: 1, type: 'spectra' }];
// A card's settings in the history: its normalization and smoothing width (stateOf), a
// number from 0, else the default.
export const readCard = (U, s)=> ({ norm: U.normOf(s.norm), smoothW: U.num(s.smoothW, DEF.smoothW, v=> v >= 0) });
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
