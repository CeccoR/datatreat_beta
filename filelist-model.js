/* =========================================================
   The trace list's calculations (v564, out of utils.js renderUnifiedFileList): what a
   trace's download gives and the list's zip, where a row dragged lands, which file a file
   dragged by its grip would land on; a row's actions and its menu (v579). Plain functions
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
