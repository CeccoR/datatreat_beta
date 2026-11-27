/* =========================================================
   ANALYSIS CARDS — what the deck works out that touches no page (cards.js wires it to the
   cards; tests/cardsmodel.test.mjs calls it in Node): the fold's and the steps' timing and
   the box a card grows from or shrinks to; the kinds "+" offers; a record made, its id, a
   kind and an id a state may hold, a record as a state is read into one (recIn) and as it
   is saved; the names settled unique, kind by kind, and a name typed taken; the name
   field's width; where the kinds' menu goes, how far the page scrolls to bring a card
   back into view, where a card held in a move goes among the others, and the records put
   in the order the move left. Taken out of v561's cards.js (createDeck, one closure of 515
   lines) with their operations in their order: the same records, names and numbers.
   A record is { id, type, base, nameAuto, name, collapsed, ...the module's own } (cards.js).
========================================================= */

/* ---- The fold, the steps' growth and shrinking ----
   Long enough, at ~600 px of body, to read as a slide rather than a jump; the curve
   starts briskly and settles gently, and the content fades as it goes. */
export const FOLD_MS = 320;
export const FOLD_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
/* A card an undo or a redo brings back or takes away grows from nothing or shrinks to it,
   as a fold goes: its height, with its padding, border and margins, and its opacity. */
export const BOX = ['height', 'paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth', 'marginTop', 'marginBottom'];
export const NO_BOX = { ...Object.fromEntries(BOX.map(k=> [k, '0px'])), opacity: 0 };

/* ---- The kinds and the records ---- */
// The kinds "+" offers now (o.offer: GC's Integration only while raw chromatograms are
// loaded), those of the deck's own; none: the first kind.
export function offered(o, types){
  const k = o.offer ? o.offer().filter(t=> types.includes(t)) : types;
  return k.length ? k : types.slice(0, 1);
}
export const nextId = recs => recs.reduce((m, a)=> Math.max(m, a.id), 0) + 1;
// A new record of `type`, the module's own fields (make) after the deck's.
export const newRec = (recs, type, o)=> ({ id: nextId(recs), type, base: '', nameAuto: true, name: '', collapsed: false, ...(o.make ? o.make(type) : {}) });
// A kind is one of this deck's own (to v496 'constructor' or 'toString', inherited by the
// kinds' object, passed for one), an id a whole number up to 1e6 (to v496 any integer,
// and 1e308 made element ids no selector reads and nextId give the same id twice).
export const isKind = (kinds, t)=> Object.prototype.hasOwnProperty.call(kinds, t);
export const okId = id => Number.isInteger(id) && id >= 1 && id <= 1e6;
// The first id free past a state's own (those a load gives the records whose id is none).
export const freeId = list => list.reduce((m, s)=> okId(s.id) ? Math.max(m, s.id) : m, 0) + 1;
// A record as a state holds it, read: the deck's fields, then the module's (read), its id
// as it is (cards.js load gives one where it is none or taken) and its kind (else the first).
export const recIn = (src, read, kinds, types)=> ({ base: typeof src.base === 'string' ? src.base : '', nameAuto: src.nameAuto !== false, name: '', collapsed: src.collapsed === true,
  ...read(src), id: src.id, type: isKind(kinds, src.type) ? src.type : types[0] });
// What a record saves of itself (the module adds its panel's).
export const saved = a => ({ id: a.id, type: a.type, base: a.base, nameAuto: a.nameAuto, collapsed: a.collapsed });

/* ---- Names ----
   Names are unique: a repeat gets " (2)", " (3)"... Settled kind by kind, in the kinds'
   order: an automatic name may carry another card's (an Urbach card its reference's).
   auto(rec): the automatic name (the module's autoName). */
export function settleNames(recs, types, auto){
  const used = new Set();
  const uniq = n =>{ let s = n, k = 2; while (used.has(s)) s = `${n} (${k++})`; used.add(s); return s; };
  types.forEach(t=> recs.filter(a=> a.type === t).forEach(a=>{
    a.name = uniq(a.nameAuto || !a.base ? auto(a) : a.base);
  }));
}
// A name typed: empty, or the automatic one, goes back to the automatic name.
export function renamed(a, v, auto){
  v = v.trim();
  if (!v || v === auto(a)){ a.nameAuto = true; a.base = ''; }
  else { a.nameAuto = false; a.base = v; }
}
// The name field as wide as the name (its text's width, w), from room for the caret up to
// 3/4 of the card's room, past which the text scrolls.
export const NAME_PAD = 24;          // 2×9 padding + 2×1 border + a little caret slack
export const nameWidth = (w, room)=> Math.min(w + NAME_PAD, room * 0.75);

/* ---- Places ---- */
// The kinds' menu under its anchor (r, its box), or over it where the window ends first;
// centred on it (the "+" bar's) or from its left; inside the window by 8 px. w, h: the
// menu's size; W, H: the window's; gap, from its anchor (v579: a trace list's row menu, 0
// from a point, the pointer's: utils.js).
export function menuAt(r, w, h, W, H, centred, gap = 6){
  let top = r.bottom + gap;
  if (top + h > H - 8) top = r.top - h - gap;
  const left = centred ? r.left + r.width/2 - w/2 : r.left;
  return { left: Math.max(8, Math.min(W - w - 8, left)), top: Math.max(8, top) };
}
/* How far the page scrolls to bring a card into view (0: in view already), from the
   sticky bar's bottom (top) to the window's (bot): r, the card's box; h, its head's. In
   view, its head is whole on screen, or the card covers it. The card whole where it fits,
   else from its head. */
export function revealOf(top, r, h, bot){
  if ((h.top >= top && h.bottom <= bot) || (r.top <= top && r.bottom >= bot)) return 0;
  const M = 12, fits = r.height + 2*M <= bot - top;
  return fits && r.top > top ? r.bottom + M - bot : r.top - M - top;
}
// The card held in a move, i-th of n, the pointer at y: before the one above it (-1) once
// past that one's middle, after the one below (1), else where it is (0). mid(k): card k's.
export function moveBy(i, n, y, mid){
  if (i > 0 && y < mid(i-1)) return -1;
  if (i < n-1 && y > mid(i+1)) return 1;
  return 0;
}
// The records in the order a move left the cards in (their ids'), in place.
export const sortBy = (recs, order)=> recs.sort((x, y)=> order.indexOf(x.id) - order.indexOf(y.id));
