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
   ('check', 'opened' or 'read': utils.js FILE ALERTS), key (the issue it names where that can
   change while its file stays: GC's pair, by the file paired with it; none where the file's
   bytes fix it), line (markup), files (the records it speaks of) }: it comes back with its
   files (a project reopened, an undo) and goes with them. A box's × marks the files of its
   notes seen for them, in each record's `seen` (markOf: the box's name, and the note's key
   after a colon where it has one): a note shows while one of its files is unmarked, so a new
   issue of a file marked for another shows (v573: to v572 the box's name alone, which kept a
   pair hidden when it was made wrong again). To v571 a flag of the module's for the whole box
   (DRS, EPR), or the drop's words kept until the next undo (XRPD), or a line of the history
   (SEM): an undo, or the project reopened, said them again or lost them. */
const markOf = n => n.key ? n.what + ':' + n.key : n.what;
export const seenFor = (f, mark)=> !!f && Array.isArray(f.seen) && f.seen.includes(mark);
// The notes a box shows.
export const notesFor = (notes, what)=> notes.filter(n=> n.what === what && n.files.some(f=> !seenFor(f, markOf(n))));
/* `seen` as a state read in holds it (a project may hold anything, an imported .json): the
   marks that are one (a string: a box's name, alone or before a colon and a key), each once;
   none, undefined. Only ever compared, never markup, but kept clean all the same (v573: to
   v572 kept as it came). The same array where it is so already. */
const MARK = /^(check|opened|read)(:[\s\S]+)?$/;
function seenIn(v){
  if (!Array.isArray(v)) return undefined;
  const ok = v.filter((m, i)=> typeof m === 'string' && MARK.test(m) && v.indexOf(m) === i);
  return ok.length === v.length ? v : ok.length ? ok : undefined;
}
// A record a restore reads (its own copy of the state's, changed in place), its `seen` so.
export const keepSeen = g =>{ const s = seenIn(g.seen); if (s) g.seen = s; else delete g.seen; return g; };
// A record marked: a copy, a state's own objects never changed.
const withMarks = (f, marks)=> ({ ...f, seen: [...(Array.isArray(f.seen) ? f.seen : []), ...marks] });
// A live record and one of a state the same file: its name, and its bytes where it has them.
export const sameFile = (a, b)=> a.name === b.name && (a.rawBytes || null) === (b.rawBytes || null);
// The records a state holds under its keys (each a list of them or one), marked by `mark`
// (markSeen's `put`): the state itself where none changed.
export const inKeys = keys => (s, mark)=> s && typeof s === 'object' ? keys.reduce((t, k)=>{ const v = mark(s[k]); return v === s[k] ? t : { ...t, [k]: v }; }, s) : s;
/* A box's ×: the files of the notes it shows (`notes`, all of them as drawn) marked for them,
   in the list (the live records, in place) and in every state of the history that holds them
   (utils.js UndoStack.patch, as no step of its own): an undo or a redo keeps the marks, and
   the project saves them (a change to save, as a label's). o: { same, how a live record and
   one of a state are told the same file (sameFile); put(state, mark), the state with its
   records marked, where `mark` gives a record or a list of them marked (the same where none
   is): inKeys(['files']), XRPD's inKeys(['files', 'std']), its standard's window
   inKeys(['std']), GC's Calibration window gc-integ-model.js inCal }. */
export function markSeen(hist, notes, what, { same = sameFile, put = inKeys(['files']) } = {}){
  const add = new Map();
  for (const n of notesFor(notes, what)) for (const f of n.files) if (!seenFor(f, markOf(n))) add.set(f, new Set([...(add.get(f) || []), markOf(n)]));
  if (!add.size) return;
  add.forEach((m, f)=>{ f.seen = withMarks(f, [...m]).seen; });
  const one = g =>{
    if (!g || typeof g !== 'object' || Array.isArray(g)) return g;
    const e = [...add].find(([f])=> same(f, g)), m = e ? [...e[1]].filter(x=> !seenFor(g, x)) : [];
    return m.length ? withMarks(g, m) : g;
  };
  const mark = v =>{ if (!Array.isArray(v)) return one(v); const w = v.map(one); return w.some((g, i)=> g !== v[i]) ? w : v; };
  hist.patch(s => put(s, mark));
}
