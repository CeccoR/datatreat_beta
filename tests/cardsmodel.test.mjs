/* The analysis cards' deck (cards.js): what it works out that touches no page
   (cards-model.js) and its markup (cards-html.js), in Node: no browser (v562, out of v561's
   createDeck). The kinds "+" offers (the module's offer, those of the deck's own, none: the
   first); a record made (its id past the largest, the module's fields after the deck's); a
   kind and an id a state may hold (inherited names, ids that are no whole number or too
   large); a record as a state is read into one, and as it is saved; the names settled unique
   kind by kind (" (2)", an automatic name that carries another's), a name typed taken (empty
   or the automatic one: automatic again); the name field's width; where the kinds' menu goes
   (under its anchor or over it, centred, inside the window); how far the page scrolls to
   bring a card back into view (in view, covering the screen, whole where it fits, else from
   its head); where a card held in a move goes; the records in the order a move left; the
   fold's timing and the box a card grows from. The markup: the menu's kinds and a card (its
   kind a button or plain text, its title, the instructions and the body in that order) with
   every name escaped, the fold button's words. Then 40 cases (a deck of one to three kinds,
   fixed or not, with a title or the default, the module's fields or none; started with some
   cards, then eight steps each: a card added (at a place, quietly), closed, renamed (typed,
   emptied, its automatic name), turned into another kind, folded, the names settled again, a
   state loaded (cards kept, gone, back as another kind, moved, folded; ids that are none,
   twice, too large; kinds that are none or inherited; entries that are no object); at each,
   the records, what they save, and each card's markup, name field and fold button) as v561's
   cards.js gave them, run from its source on a page of stubs: SHA-256 digests in
   tests/golden/cardsmodel.json (npm run test:update writes them anew after a change meant to
   alter them). utils.js's markup helpers, which need a page to load, are taken from its source
   as they stand there. Under a second. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as M from '../cards-model.js';
import * as H from '../cards-html.js';

const UPDATE = !!process.env.UPDATE_GOLDEN || process.env.npm_lifecycle_event === 'test:update';
const GOLDEN = new URL('./golden/cardsmodel.json', import.meta.url);
const sha = s => createHash('sha256').update(s).digest('hex');
// utils.js's esc and X_SVG as they stand there (it needs a page to load).
const UTILS = fs.readFileSync(new URL('../utils.js', import.meta.url), 'utf8');
const line = name => UTILS.slice(UTILS.search(new RegExp(`^const ${name} = `, 'm')), UTILS.indexOf('\n', UTILS.search(new RegExp(`^const ${name} = `, 'm'))));
export const u = new Function(line('esc') + '\n' + line('X_SVG') + '\nreturn { esc, X_SVG };')();
export const canon = v => JSON.stringify(v, function(k, x){ const o = this[k]; if (typeof o === 'number') return Object.is(o, -0) ? '#-0' : '#' + o; return x; });

test('the kinds offered, a record made, a kind and an id a state may hold, a record read and saved', ()=>{
  const types = ['a', 'b', 'c'];
  assert.deepEqual(M.offered({}, types), types);
  assert.deepEqual(M.offered({ offer: ()=> ['c', 'zz', 'a'] }, types), ['c', 'a']);
  assert.deepEqual(M.offered({ offer: ()=> ['zz'] }, types), ['a'], 'none: the first');
  assert.deepEqual(M.offered({ offer: ()=> [] }, ['only']), ['only']);
  assert.equal(M.nextId([]), 1);
  assert.equal(M.nextId([{ id: 3 }, { id: 9 }, { id: 2 }]), 10);
  let asked = null;
  const o = { make(t){ asked = [this === o, t]; return { series: [], id: 99, type: 'x' }; } };
  assert.deepEqual(M.newRec([{ id: 4 }], 'b', o), { id: 99, type: 'x', base: '', nameAuto: true, name: '', collapsed: false, series: [] }, 'the module\'s fields after the deck\'s');
  assert.deepEqual(asked, [true, 'b'], 'make asked as the module\'s own');
  assert.deepEqual(M.newRec([{ id: 4 }], 'b', {}), { id: 5, type: 'b', base: '', nameAuto: true, name: '', collapsed: false });
  const kinds = { a: 'A', b: 'B' };
  assert.deepEqual(['a', 'constructor', 'toString', null, undefined, 'b'].map(t=> M.isKind(kinds, t)), [true, false, false, false, false, true]);
  assert.deepEqual([1, 0, -1, 1.5, 1e6, 1e6 + 1, 1e308, '3', null, NaN].map(M.okId), [true, false, false, false, true, false, false, false, false, false]);
  assert.equal(M.freeId([{ id: 3 }, { id: 1e7 }, { id: 'x' }, { id: 8 }]), 9);
  assert.equal(M.freeId([]), 1);
  const order = [];
  const read = s =>{ order.push('read'); return { extra: s.extra ?? 'none', base: 'module\'s' }; };
  assert.deepEqual(M.recIn({ id: 3, type: 'b', base: 5, nameAuto: 'no', collapsed: 'yes', name: 'gone', extra: 1 }, read, kinds, ['a', 'b']),
    { base: 'module\'s', nameAuto: true, name: '', collapsed: false, extra: 1, id: 3, type: 'b' }, 'the module\'s read after the deck\'s; its id and kind last');
  assert.deepEqual(M.recIn({ id: 'x', type: 'toString', base: 'T', nameAuto: false, collapsed: true }, ()=> ({}), kinds, ['a', 'b']),
    { base: 'T', nameAuto: false, name: '', collapsed: true, id: 'x', type: 'a' }, 'a kind not its own: the first; an id as it is (load gives one)');
  assert.deepEqual(M.saved({ id: 2, type: 'a', base: 'B', nameAuto: false, name: 'N', collapsed: true, series: [1] }), { id: 2, type: 'a', base: 'B', nameAuto: false, collapsed: true });
});

test('the names: settled unique kind by kind; a name typed; the field\'s width', ()=>{
  const recs = [{ id: 1, type: 'b', nameAuto: true, base: '' }, { id: 2, type: 'a', nameAuto: false, base: 'Mine' }, { id: 3, type: 'a', nameAuto: true, base: 'kept' },
    { id: 4, type: 'b', nameAuto: false, base: '' }, { id: 5, type: 'a', nameAuto: false, base: 'Mine' }, { id: 6, type: 'b', nameAuto: false, base: 'Mine (2)' }];
  const auto = a => a.type === 'a' ? 'Mine' : `B ${a.id}`;
  M.settleNames(recs, ['a', 'b'], auto);
  assert.deepEqual(recs.map(a=> a.name), ['B 1', 'Mine', 'Mine (2)', 'B 4', 'Mine (3)', 'Mine (2) (2)'], 'the kinds in order, repeats numbered; a base empty: automatic');
  const a = { id: 1, type: 'a', nameAuto: true, base: '' };
  M.renamed(a, '  Typed  ', auto);
  assert.deepEqual([a.nameAuto, a.base], [false, 'Typed']);
  M.renamed(a, ' Mine ', auto);
  assert.deepEqual([a.nameAuto, a.base], [true, ''], 'its automatic name: automatic');
  let asked = 0;
  M.renamed(a, '   ', ()=>{ asked++; return 'x'; });
  assert.deepEqual([a.nameAuto, a.base, asked], [true, '', 0], 'empty: automatic, its automatic name not asked');
  assert.equal(M.nameWidth(100, 400), 124);
  assert.equal(M.nameWidth(500, 400), 300, '3/4 of the room at most');
  assert.equal(M.NAME_PAD, 24);
});

test('the places: the menu, the scroll that brings a card into view, a card held in a move, the order a move left', ()=>{
  const r = { left: 100, top: 200, bottom: 230, width: 40 };
  assert.deepEqual(M.menuAt(r, 150, 90, 1200, 800, false), { left: 100, top: 236 });
  assert.deepEqual(M.menuAt(r, 150, 90, 1200, 800, true), { left: 45, top: 236 }, 'centred on its anchor');
  assert.deepEqual(M.menuAt({ ...r, top: 700, bottom: 730 }, 150, 90, 1200, 800, false), { left: 100, top: 604 }, 'over its anchor where the window ends first');
  assert.deepEqual(M.menuAt({ left: 1150, top: 20, bottom: 30, width: 40 }, 150, 900, 1200, 800, false), { left: 1042, top: 8 }, 'inside the window by 8 px');
  assert.deepEqual(M.menuAt({ left: -50, top: 0, bottom: 10, width: 10 }, 150, 50, 100, 800, true), { left: 8, top: 16 });
  // In view: its head whole between the bar and the window's foot, or the card covering the screen.
  assert.equal(M.revealOf(60, { top: 100, bottom: 500, height: 400 }, { top: 100, bottom: 140 }, 800), 0);
  assert.equal(M.revealOf(60, { top: 0, bottom: 900, height: 900 }, { top: 0, bottom: 40 }, 800), 0, 'covering the screen');
  assert.equal(M.revealOf(60, { top: 900, bottom: 1300, height: 400 }, { top: 900, bottom: 940 }, 800), 1300 + 12 - 800, 'below, whole where it fits');
  assert.equal(M.revealOf(60, { top: 900, bottom: 1900, height: 1000 }, { top: 900, bottom: 940 }, 800), 900 - 12 - 60, 'below, too tall: from its head');
  assert.equal(M.revealOf(60, { top: -500, bottom: -100, height: 400 }, { top: -500, bottom: -460 }, 800), -500 - 12 - 60, 'above: from its head');
  const mids = [100, 200, 300], mid = k => mids[k];
  assert.deepEqual([M.moveBy(1, 3, 90, mid), M.moveBy(1, 3, 150, mid), M.moveBy(1, 3, 310, mid), M.moveBy(0, 3, 0, mid), M.moveBy(2, 3, 900, mid)], [-1, 0, 1, 0, 0]);
  let asked = [];
  M.moveBy(1, 3, 150, k =>{ asked.push(k); return mids[k]; });
  assert.deepEqual(asked, [0, 2], 'the one above measured first, the one below only then');
  const recs = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.equal(M.sortBy(recs, [3, 1, 2]), recs, 'in place');
  assert.deepEqual(recs.map(a=> a.id), [3, 1, 2]);
  assert.deepEqual([M.FOLD_MS, M.FOLD_EASE], [320, 'cubic-bezier(0.4, 0, 0.2, 1)']);
  assert.deepEqual(M.NO_BOX, { height: '0px', paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px', marginTop: '0px', marginBottom: '0px', opacity: 0 });
});

test('the markup: the menu, a card (its kind a button or plain text, its title, the instructions and the body), every name escaped', ()=>{
  const P = '"><i x=1>&';
  assert.equal(H.menuHtml({ a: 'Alpha', [P]: P }, u), `<button type="button" role="menuitem" data-kind="a">Alpha</button><button type="button" role="menuitem" data-kind="&quot;&gt;&lt;i x=1&gt;&amp;">&quot;&gt;&lt;i x=1&gt;&amp;</button>`);
  const asked = [];
  const o = { info(t){ asked.push(['info', t, this === o]); return '<b>info</b>'; }, body(a){ asked.push(['body', a.id, this === o]); return `<div id="an${a.id}X"></div>`; } };
  const sw = H.cardHtml({ id: 4, type: 'a' }, true, { a: P }, 'Analysis:', o, u);
  assert.deepEqual(asked, [['info', 'a', true], ['body', 4, true]], 'the instructions, then the body, asked as the module\'s own');
  assert.match(sw, /<button type="button" class="an-type" data-kind="a" aria-haspopup="menu" aria-expanded="false" title="Change the kind of analysis">&quot;&gt;&lt;i x=1&gt;&amp;<\/button>/);
  assert.match(sw, /<h3 class="txt-head an-title">Analysis:<span class="an-kind">/);
  assert.match(sw, /<div class="instr-block an-instr" style="display:none"><b>info<\/b><\/div>\n {10}<div id="an4X"><\/div>\n {8}<\/div>$/);
  for (const c of ['an-grip', 'an-close', 'an-fold', 'instr-info', 'an-name', 'an-body', 'an-head']) assert.equal(sw.split(`class="${c}`).length + sw.split(` ${c}"`).length - 2 >= 1, true, c);
  assert.ok(sw.includes(u.X_SVG(15)) && sw.includes(H.GRIP_SVG) && sw.includes(H.CHEVRON_SVG) && sw.includes(H.INFO_SVG));
  const fixed = H.cardHtml({ id: 1, type: 'b' }, false, { b: 'Bee <b>' }, P, { info: ()=> '', body: ()=> '' }, u);
  assert.match(fixed, /<span class="an-type is-fixed">Bee &lt;b&gt;<\/span>/);
  assert.match(fixed, /<h3 class="txt-head an-title">&quot;&gt;&lt;i x=1&gt;&amp;<span/);
  assert.ok(!fixed.includes('an-type" data-kind'));
  assert.deepEqual([H.foldWords(true), H.foldWords(false)], [{ title: 'Unfold this analysis', label: 'Unfold analysis' }, { title: 'Fold this analysis', label: 'Fold analysis' }]);
});

/* =========================================================
   40 CASES, done as cards.js does them (its wiring, in short, below): a deck of the case's
   kinds and options started with some cards, then eight steps; after each, what the page
   holds and shows (out). Their digests are those of v561's cards.js, run from its source on
   a page of stubs, the same steps done through its page (the "+" bar and the deck's add,
   remove and load as a module calls them, a card's name field, kind menu and fold button).
========================================================= */
function rnd(seed){ let s = seed >>> 0 || 1; return ()=>{ s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const KINDSETS = [{ a: 'Alpha' }, { a: 'Alpha', b: 'Beta <&>' }, { xy: 'XY plot', bar: 'Bar chart', box: 'Box plot' }, { tauc: 'Tauc', urbach: 'Urbach' }];
export function caseOf(seed){
  const r = rnd(seed * 104729 + 7), pick = a => a[Math.floor(r()*a.length)], chance = p => r() < p;
  const kinds = pick(KINDSETS), types = Object.keys(kinds);
  const c = { kinds, fixed: chance(0.3), title: pick([undefined, '', 'Plot:', 'A<b>"']), make: chance(0.6), same: chance(0.3), start: types.filter(()=> chance(0.6)) };
  const entry = ()=> pick([null, 5, { type: types[0] }, { id: pick([1, 2, 3, 4, 0, -1, 1.5, 1e7, '3', null, 2, 1e6]), type: pick([...types, ...types, null, 'constructor', 'zz', undefined]),
    collapsed: chance(0.4), base: pick(['', 'Mine', 5, ' sp ']), nameAuto: pick([true, false, 'no']), extra: pick(['e1', 7, undefined]) }]);
  c.steps = Array.from({ length: 8 }, ()=>{
    const k = pick(['add', 'add', 'remove', 'rename', 'rename', 'switch', 'fold', 'fold', 'names', 'load', 'load']), i = Math.floor(r()*4);
    if (k === 'add') return [k, pick(types), pick([undefined, 0, 1, -1, 9, null]), chance(0.3)];
    if (k === 'rename') return [k, i, pick(['', '  ', 'Typed', ' x <y> ', 'Card', `${kinds[types[0]]} 1`])];
    if (k === 'switch') return [k, i, pick([...types, 'zz'])];
    if (k === 'load') return [k, Array.from({ length: Math.floor(r()*5) }, entry)];
    return [k, i];
  });
  return c;
}
// The deck's options for a case (the same in the page's run): its hooks the module's.
export function optsOf(c){
  const names = c.same ? ()=> 'Card' : a => `${c.kinds[a.type] || '?'} ${a.id}`;
  return { kinds: c.kinds, ...(c.fixed ? { fixedKinds: true } : {}), ...(c.title !== undefined ? { title: c.title } : {}),
    info: t => `Info of ${t} <b>x</b>`, body: a => `<div class="mod-body" id="an${a.id}Body">${a.id}</div>`,
    ...(c.make ? { make: t => ({ extra: 'x' + t }) } : {}), autoName: names, build(){}, drop(){}, commit(){} };
}
export const read = src => ({ extra: typeof src.extra === 'string' ? src.extra : 'none' });

/* ---- cards.js's wiring, in short (no page): the records, the markup each card was built with ---- */
function deckOf(c){
  const o = optsOf(c), types = Object.keys(c.kinds), switchable = types.length > 1 && !c.fixed;
  const D = { o, types, switchable, title: o.title ?? 'Analysis:', recs: [], built: new Map(), html: new Map() };
  c.start.forEach(t=>{ const a = M.newRec(D.recs, t, o); D.recs.push(a); build(D, a); });
  names(D);
  return D;
}
function build(D, a){ D.built.set(a.id, a); D.html.set(a.id, H.cardHtml(a, D.switchable, D.o.kinds, D.title, D.o, u)); }
const names = D => M.settleNames(D.recs, D.types, a => D.o.autoName(a));
function stepDeck(D, [k, a, b]){
  const rec = D.recs[a];
  if (k === 'add'){ const x = M.newRec(D.recs, a, D.o); if (b != null && b >= 0 && b < D.recs.length) D.recs.splice(b, 0, x); else D.recs.push(x); build(D, x); names(D); }
  else if (k === 'remove'){ if (rec){ D.recs.splice(a, 1); D.built.delete(rec.id); D.html.delete(rec.id); names(D); } }
  else if (k === 'rename'){ if (rec){ M.renamed(rec, b, x=> D.o.autoName(x)); names(D); } }
  else if (k === 'switch'){ if (rec && D.switchable && b !== rec.type && D.o.kinds[b]){ rec.type = b; build(D, rec); names(D); } }
  else if (k === 'fold'){ if (rec) rec.collapsed = !rec.collapsed; }
  else if (k === 'names') names(D);
  else if (k === 'load'){
    const list = a.filter(s=> s && (s.type == null || M.isKind(D.o.kinds, s.type))), old = new Map(D.recs.map(x=> [x.id, x])), seen = new Set();
    let free = M.freeId(list);
    D.recs = list.map(src=>{
      const s = M.recIn(src, read, D.o.kinds, D.types);
      if (!M.okId(s.id) || seen.has(s.id)) s.id = free++;
      seen.add(s.id);
      const x = old.get(s.id);
      if (x && x.type === s.type){ old.delete(x.id); Object.assign(x, s); return x; }
      return s;
    });
    old.forEach(x=>{ D.built.delete(x.id); D.html.delete(x.id); });
    D.recs.forEach(x=>{ if (D.built.get(x.id) !== x) build(D, x); });
    names(D);
  }
}
// What the page holds and shows: the records, what they save, each card's markup, name field and fold button.
export function outOf(D){
  return canon({ recs: D.recs, saved: D.recs.map(M.saved), cards: D.recs.map(a=>{ const w = H.foldWords(a.collapsed); return [D.html.get(a.id), a.name, D.o.autoName(a), w.title, w.label, String(!a.collapsed), a.collapsed]; }) });
}
export function runCase(c){
  const D = deckOf(c), out = [outOf(D)];
  for (const st of c.steps){ stepDeck(D, st); out.push(outOf(D)); }
  return '[' + out.join(',') + ']';
}
export const CASES = 40;

test('40 cases as v561\'s cards.js gave them (golden digests)', ()=>{
  const got = { cases: Array.from({ length: CASES }, (_, i)=> sha(runCase(caseOf(i + 1)))) };
  if (UPDATE){ fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + '\n'); return; }
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const off = got.cases.map((h, i)=> h === want.cases[i] ? null : i).filter(i=> i !== null);
  assert.deepEqual(off, [], 'cases whose digest differs');
  assert.equal(got.cases.length, want.cases.length);
});
