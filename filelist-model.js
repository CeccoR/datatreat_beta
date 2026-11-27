/* =========================================================
   The trace list's calculations (v564, out of utils.js renderUnifiedFileList): what a
   trace's download gives and the list's zip, where a row dragged lands, which file a file
   dragged by its grip would land on; the rows of several files, paired by their names and by
   a file's grip (v581: GC's and EPR's, out of v580's gc-pair.js); a row's actions and its
   menu (v579). Plain functions
   with no page: utils.js's fileOf (the name of the file a trace comes from) and isIncluded
   handed in as U. The list itself: utils.js; its markup: filelist-html.js.
========================================================= */

/* A trace's original files, byte for byte: its bytes in `rawBytes`, or a `rawFiles` list
   (e.g. EPR's .dsc + .dta pair), or legacy decoded text in `raw` (older sessions); under
   its file's own name, `src`, where the trace has a name of its own. A part of a list with
   neither bytes nor text (its bytes not stored in this browser any more, v517) is there,
   with neither: not available (lostOf), as a file of no bytes is. To v516 it went into the
   zip as an empty file, with no word. */
export function originalsOf(U, f){
  if (f.rawFiles && f.rawFiles.length)
    return f.rawFiles.map(rf=> rf.bytes != null ? { name:rf.name, bytes:rf.bytes } : { name:rf.name, text:rf.data ?? rf.text });
  if (f.rawBytes != null) return [{ name:U.fileOf(f), bytes:f.rawBytes }];
  if (f.raw != null) return [{ name:U.fileOf(f), text:f.raw }];
  return [];
}
export const lostOf = (U, f)=> originalsOf(U, f).filter(o=> o.bytes == null && o.text == null).map(o=> o.name);

/* What a trace's download gives: { missing, name } a file not available, by its name (the
   trace's, with none at all), { one } its one file (bytes or text), or { zip, entries } its
   files in a zip named after its file. */
export function downloadOf(U, f){
  const orig = originalsOf(U, f), lost = lostOf(U, f);
  if (!orig.length || lost.length) return { missing: true, name: lost[0] || f.name };
  if (orig.length === 1) return { one: orig[0] };
  return { zip: U.fileOf(f) + '.zip', entries: orig };
}

// Every file of the list's traces that is available, each once however many of its traces
// are listed (by its bytes, or its name): the download-all's zip.
export function zipEntries(U, files){
  const seen = new Set();
  return files.filter(f=> !lostOf(U, f).length).flatMap(f=> originalsOf(U, f))
    .filter(o=>{ const k = o.bytes != null ? o.bytes : 'name:' + o.name; if (seen.has(k)) return false; seen.add(k); return true; });
}

/* A row dragged (from) over the gap g (utils.js dropGap: before row g, n after the last):
   the two gaps beside it would leave it where it is, so they are none (null). Dropped on a
   gap, the place it goes to: once the row is out of the list, g − 1 if it came from above,
   g if from below. */
export const gapFor = (g, from)=> g === from || g === from + 1 ? null : g;
export const landing = (g, from)=> g > from ? g - 1 : g;

// A point outside a box (a row's client rectangle).
export const outside = (b, x, y)=> y < b.top || y > b.bottom || x < b.left || x > b.right;
// Of a row's two files (their boxes, top to bottom), the one at y: split between their middles.
export function halfAt(boxes, y){
  const m = boxes.map(q=> (q.top + q.bottom)/2);
  return y < (m[0] + m[1])/2 ? 0 : 1;
}
// A press that has moved more than 4 px from where it began is a drag.
export const movedFrom = (x0, y0, x, y)=> Math.hypot(x - x0, y - y0) > 4;

/* ---- A row of several files (callbacks.parts: GC's table and its raw chromatograms, v544;
   EPR's .DTA and .DSC, v581) ----
   The rows of a module's list as arrays of one or two files, in the order the list shows
   them; the module keeps a row as its own record (GC: the first file's, the second its
   `mate`; EPR: the pair's, its files its `rawFiles`) and makes its records again from the
   rows these give (its `pairs.regroup`, modkit.js). */
/* The rows the files make by their names: a file dropped beside a file alone of the same stem
   and the other side (`sideOf(f)` → { stem, first }: GC's table first and its raw chromatograms
   …_TCD, EPR's .DTA first and its .DSC), each one alone, become one row, the `first` side
   first, whatever either holds (a pair that cannot serve is said later, by the module). `rows`
   the list's rows before the drop (arrays of files, a pair kept as it is), `added` the files
   dropped, in their order. → the rows after: those there were, a file alone among them taking
   its partner from the drop in its place, then the drop's own rows in the order of their first
   file. Its stems are a Map's keys: a file named after an object's own property (constructor,
   __proto__) is a name like any other (v581, bug 23). */
export function autoPair(rows, added, sideOf){
  const out = rows.map(r=> r.slice()), fresh = [];
  const alone = new Map();          // side and stem → the row of a file alone named so (the first of a name)
  const keyOf = (first, stem)=> (first ? 'A:' : 'B:') + stem;
  out.forEach(r=>{ if (r.length === 1){ const { stem, first } = sideOf(r[0]), k = keyOf(first, stem); if (!alone.has(k)) alone.set(k, r); } });
  for (const f of added){
    const { stem, first } = sideOf(f), other = keyOf(!first, stem), mine = keyOf(first, stem);
    const r = alone.get(other);
    if (r && r.length === 1){
      alone.delete(other);
      if (first) r.unshift(f); else r.push(f);
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

/* ---- A row's actions and its menu (v579) ----
   What a row's include box and the buttons at its right do, in the order they stand. The
   row's controls (filelist-html.js rowHtml) and its menu (rowMenu: a right-click on the row,
   the ContextMenu key or Shift+F10 in it, a finger held on it; utils.js) are made from this
   one list, so the menu offers what the row does, in its words, and nothing else. `ctl` the
   control's class (utils.js wires the control by it, and an item of the menu presses it),
   `title` the control's tooltip and the item's words, `box` the include box (its item ticked
   with the trace in), `danger` an action that takes the trace away. */
export const ROW_ACTS = [
  { ctl: 'file-incl', title: 'Include in the analysis', box: true },
  { ctl: 'dl-file', title: 'Download its file' },
  { ctl: 'row-del', title: 'Remove', danger: true },
];
/* The menu of a row's trace f: an item an action ({ ctl, label }; the box's `checked` as the
   trace is included, `danger`), in the order of the actions; those that take the trace away
   last, after a line ({ sep: true }) where others go before them. */
export function rowMenu(U, f, acts = ROW_ACTS){
  const item = a => ({ ctl: a.ctl, label: a.title, ...(a.box ? { checked: U.isIncluded(f) } : {}), ...(a.danger ? { danger: true } : {}) });
  const keep = acts.filter(a=> !a.danger).map(item), take = acts.filter(a=> a.danger).map(item);
  return keep.length && take.length ? [...keep, { sep: true }, ...take] : [...keep, ...take];
}
/* A key pressed in a menu of n items, the focus on item `at` (-1: none of them): the item the
   focus goes to, or null for a key the menu leaves alone. ↓ and ↑ go round, Home and End to
   the ends; ← and → keep it where it is (they would step the samples under the menu: utils.js
   SAMPLE_NAV). */
export function menuKey(key, at, n){
  if (key === 'ArrowDown') return at < 0 ? 0 : (at + 1) % n;
  if (key === 'ArrowUp') return at <= 0 ? n - 1 : at - 1;
  if (key === 'Home') return 0;
  if (key === 'End') return n - 1;
  if (key === 'ArrowLeft' || key === 'ArrowRight') return Math.max(at, 0);
  return null;
}
// How long a finger is held on a row for its menu, in ms (one moved first, movedFrom: none).
export const LONG_PRESS_MS = 500;
