/* =========================================================
   GC: A TABLE AND ITS RAW CHROMATOGRAMS, PAIRED (v544)
   The pure part of the pairing: what a file is by its content, which names pair by
   themselves, and what a file dragged onto another does to the rows of the trace list.
   A row is an array of one or two file records, in the order the list shows them; gc.js
   keeps a row as one record, the first file's, the second its `mate`.
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

/* The rows the files make by their names: a file named as raw chromatograms (…_TCD) beside
   one named as its table (the same name without _TCD), each one alone, become one row, the
   table's name first, whatever either holds (a file misnamed is said later, by its kind).
   `rows` the list's rows before the drop (arrays of files, a pair kept as it is), `added`
   the files dropped, in their order. → the rows after: those there were, a file alone
   among them taking its partner from the drop in its place, then the drop's own rows in
   the order of their first file. */
export function autoPair(rows, added){
  const out = rows.map(r=> r.slice()), fresh = [];
  const alone = new Map();          // stem → { row, tcd } a file alone named so (the first of a name)
  const note = (row, f)=>{ const { stem, tcd } = stemOf(f.name), k = (tcd ? 'T:' : 'S:') + stem; if (!alone.has(k)) alone.set(k, row); };
  out.forEach(r=>{ if (r.length === 1) note(r, r[0]); });
  for (const f of added){
    const { stem, tcd } = stemOf(f.name), other = (tcd ? 'S:' : 'T:') + stem, mine = (tcd ? 'T:' : 'S:') + stem;
    const r = alone.get(other);
    if (r && r.length === 1){
      alone.delete(other);
      if (tcd) r.push(f); else r.unshift(f);
      continue;
    }
    const row = [f];
    fresh.push(row);
    if (!alone.has(mine)) alone.set(mine, row);
  }
  return [...out, ...fresh];
}

/* A file dragged by its own grip and dropped (utils.js renderUnifiedFileList, onPartDrop):
   `from` and `to` { i: its row, p: its place in the row }; `to` null: dropped off every
   file. → the rows after, the same arrays where nothing changed:
   - onto a file alone: the two are paired, in that file's row; the dragged file's partner,
     if it had one, stays alone in its row; a row left empty goes;
   - onto a file paired: the two swap, the dragged file in that file's place in its pair, that
     file in the dragged one's (alone, if it was);
   - onto its own partner: the two swap places in their row;
   - off every file: a file with a partner leaves it, alone in a row of its own just under. */
export function dropPart(rows, from, to){
  const src = rows[from.i], X = src && src[from.p];
  if (!X) return rows;
  const out = rows.map(r=> r.slice());
  if (!to){
    if (src.length < 2) return rows;
    out[from.i].splice(from.p, 1);
    out.splice(from.i + 1, 0, [X]);
    return out;
  }
  const dst = rows[to.i], Y = dst && dst[to.p];
  if (!Y || Y === X) return rows;
  if (to.i === from.i){ out[from.i] = [src[1], src[0]]; return out; }
  if (dst.length === 1){
    out[to.i] = [Y, X];
    out[from.i].splice(from.p, 1);
  } else {
    out[to.i][to.p] = X;
    out[from.i][from.p] = Y;
  }
  return out.filter(r=> r.length);
}
