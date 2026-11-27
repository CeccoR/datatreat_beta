/* =========================================================
   GC: A TABLE AND ITS RAW CHROMATOGRAMS, PAIRED (v544)
   The pure part of the pairing that is GC's own: what a file is by its content, and a name as
   the pairing reads it (sideOf, for filelist-model.js autoPair). How files dropped pair by
   their names and what a file dragged onto another does to the rows of the trace list are
   the list's, EPR's pairs alike (filelist-model.js autoPair, dropPart: v581). A row is an
   array of one or two file records, in the order the list shows them; gc.js keeps a row as
   one record, the first file's, the second its `mate`.
========================================================= */

/* A file of raw chromatograms (TCD), told by its content, never by its name: no header, its
   first lines all numbers (the time, then a value per injection), `;` between them with a
   decimal comma or point (the instrument's), or a tab or `,` with a point, as the engine's
   readTcd reads them; a line may end with its separator. A GC table's first line names its
   columns. */
export function looksTcd(text){
  const s = String(text).replace(/^\ufeff/, '');
  const lines = s.slice(0, 20000).split(/\r?\n/).filter(l=> l.trim()).slice(0, 3);
  if (lines.length < 2) return false;
  const probe = lines.join('\n'), sep = probe.includes(';') ? ';' : probe.includes('\t') ? '\t' : ',';
  const cell = sep === ',' ? /^\s*[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?\s*$/ : /^\s*[-+]?(\d+([.,]\d*)?|[.,]\d+)([eE][-+]?\d+)?\s*$/;
  return lines.every(l=>{
    const f = l.split(sep);
    if (f.length > 1 && !f[f.length - 1].trim()) f.pop();
    return f.length >= 2 && f.every((c, k)=> (k > 0 && !c.trim()) || cell.test(c));
  });
}

/* A name as the pairing reads it: its extension off, a browser's mark of a second download
   (" (1)") off, any case. `tcd`: it ends with _TCD, which is off its stem too (" (1)" is
   off before and after it: "run (1)_TCD.csv", "run_TCD (1).csv"). */
const DUP = /\s*\(\d+\)\s*$/;
export function stemOf(name){
  let s = String(name).replace(/\.[^.\\/]*$/, '').replace(DUP, '');
  const tcd = /_tcd$/i.test(s);
  if (tcd) s = s.slice(0, -4).replace(DUP, '');
  return { stem: s.toLowerCase(), tcd };
}
// The side and stem a file pairs by (filelist-model.js autoPair): a table first, its raw
// chromatograms (…_TCD) beside it.
export const sideOf = f =>{ const { stem, tcd } = stemOf(f.name); return { stem, first: !tcd }; };
