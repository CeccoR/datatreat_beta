/* =========================================================
   The alert boxes' markup that needs no page (v571, ALERTS-REVIEW.md R1): each kind's
   icon, and the compact box an analysis card says things in, beside what it speaks of.
   utils.js's alertHtml (the boxes with a header and a ×, under the drop zones) takes its
   icons from here; the modules' words-and-markup files (xrd-rv-html.js, gc-integ-html.js,
   iodo-html.js…) take the compact box, which they can import in Node too. And the marks of
   the files' notes seen (v572), which the modules and their tests take alike.
========================================================= */
// 'bad' an error (✕), 'warn' a warning (⚠), 'info' what is worth knowing and needs no
// check (a circled i, drawn in the text's colour, as wide as a character with its space).
export const ALERT_ICON = {
  bad: '✕ ', warn: '⚠ ',
  info: '<svg class="alert-ic" viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true"><circle cx="8" cy="8" r="6.9" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="4.75" r="1.05" fill="currentColor"/><path d="M8 7.4v4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};
/* A compact box (style.css .alert.compact: the same icon and colours as the others, less
   padding, smaller type), with no ×: a card's boxes are worked out again with what they
   speak of (R3), a × would hold only until the next drawing. `lines` markup (the caller
   escapes what it puts in them), one or several, a header as the first; none, ''. `cls`:
   more classes for its place. */
export function boxHtml(kind, lines, cls = ''){
  const l = [].concat(lines).filter(Boolean);
  return l.length ? `<div class="alert ${kind} compact${cls ? ' ' + cls : ''}">${ALERT_ICON[kind]}${l.join('<br>')}</div>` : '';
}

/* ---- What the reading of the files said, seen (v572, ALERTS-REVIEW.md R3, U3) ----
   What a file's reading said (to check, how it was read, what a project opened found in it)
   is worked out from the files in the list at each draw, as notes, each { what: its box
   ('check', 'opened' or 'read': utils.js FILE ALERTS), line (markup), files (the records it
   speaks of) }: it comes back with its files (a project reopened, an undo) and goes with
   them. A box's × marks the files of its notes seen for it, in each record's `seen` (the
   names of the boxes): a note shows while one of its files is unmarked. To v571 a flag of
   the module's for the whole box (DRS, EPR), or the drop's words kept until the next undo
   (XRPD), or a line of the history (SEM): an undo, or the project reopened, said them again
   or lost them. */
export const seenFor = (f, what)=> !!f && Array.isArray(f.seen) && f.seen.includes(what);
// The notes a box shows.
export const notesFor = (notes, what)=> notes.filter(n=> n.what === what && n.files.some(f=> !seenFor(f, what)));
// A record marked: a copy, a state's own objects never changed.
const withSeen = (f, what)=> ({ ...f, seen: [...(Array.isArray(f.seen) ? f.seen : []), what] });
// A live record and one of a state the same file: its name, and its bytes where it has them.
export const sameFile = (a, b)=> a.name === b.name && (a.rawBytes || null) === (b.rawBytes || null);
/* A box's ×: the files of the notes it shows (`notes`, all of them as drawn) marked, in the
   list (the live records, in place) and in every state of the history that holds them
   (utils.js UndoStack.patch, as no step of its own): an undo or a redo keeps the marks, and
   the project saves them (a change to save, as a label's). o: { same, how a live record and
   one of a state are told the same file (sameFile); keys, the state's keys that hold the
   records, each a list of them or one (['files']; XRPD's standard: 'std') }. */
export function markSeen(hist, notes, what, { same = sameFile, keys = ['files'] } = {}){
  const live = [...new Set(notesFor(notes, what).flatMap(n=> n.files))].filter(f=> !seenFor(f, what));
  if (!live.length) return;
  live.forEach(f=>{ f.seen = withSeen(f, what).seen; });
  const hit = g => !!g && typeof g === 'object' && !Array.isArray(g) && !seenFor(g, what) && live.some(f=> same(f, g));
  const mark = v => Array.isArray(v) ? (v.some(hit) ? v.map(g=> hit(g) ? withSeen(g, what) : g) : v) : hit(v) ? withSeen(v, what) : v;
  hist.patch(s => s && typeof s === 'object' ? keys.reduce((t, k)=>{ const v = mark(s[k]); return v === s[k] ? t : { ...t, [k]: v }; }, s) : s);
}
