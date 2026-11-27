/* =========================================================
   ANALYSIS CARDS
   The cards an analysis module lays out before its Results: each one an analysis of
   its own, of a kind chosen in its title, renamed in the field under it, folded with
   the arrow, closed with the ×, moved by dragging the ≡ grip, and added from the "+"
   under the cards. The deck keeps the records and their cards; what a card holds and
   does (its panel, its Results) is the module's, through the callbacks.

   A record is { id, type, base, nameAuto, name, collapsed, ...the module's own }:
   `base` the name typed in, used while `nameAuto` is off, `name` the one shown, made
   unique.

   SPLIT (v562): what the deck works out that touches no page (the records, their ids and
   kinds, a state read into them and saved, the names settled, the menu's place, the
   scroll that brings a card into view, a move's places; the fold's timing and the box a
   card grows from) in cards-model.js, its markup (a card's, the menu's) in cards-html.js,
   both tested in Node. Here the page: the deck's state (D), its cards, their listeners,
   the folds, the moves and the history's steps animated. Each is a function at module
   level of D, not a closure inside createDeck (to v561 one of 515 lines): what a listener
   holds is what it is handed.
========================================================= */
import { X_SVG, esc } from './utils.js';
import * as M from './cards-model.js';
import * as H from './cards-html.js';

// utils.js's markup helpers, as the markup takes them (cards-html.js u).
const HU = { esc, X_SVG };
const { FOLD_MS, FOLD_EASE, NO_BOX } = M;

// What every card's instructions end with: how the cards themselves are handled.
export const cardInfo = (several, results) => `Each analysis card can be renamed in the field under its title (left empty, it goes back to the automatic name), ${several ? 'turned into another kind of analysis from its title, ' : ''}folded with the arrow, closed with the ×, and moved by dragging the ≡ grip; <b>+</b> below the cards adds another.${results ? ' Every card has its own charts in the Results, under its name.' : ''}`;

/* The kinds' menu, anchored as the composer's pickers are: the "+" bar opens it to add a
   card, a card's title to change its kind. The anchor again or a click anywhere else
   closes it, so does Escape; the anchor stays lit while it is open. A menu of our own
   rather than a <select>: the title's capitals would carry into a native list, which
   some systems draw with the select's own styling. */
// (in `layer`: the module's instance's, which is in the page while its instance is. Its
// listeners on the document and the window come off with destroy.) Its state K: the menu
// (el), its listeners' controller, the anchor it is open from, what a pick does, centred.
function kindMenu(kinds, layer){
  const el = document.createElement('div');
  el.className = 'an-menu';
  el.setAttribute('role', 'menu');
  el.hidden = true;
  el.innerHTML = H.menuHtml(kinds, HU);
  layer.appendChild(el);
  const ac = new AbortController();
  const K = { el, ac, anchor: null, pick: null, centred: false };
  wireMenu(K, ac.signal);
  return { el, open: (a, onPick, opts)=> openMenu(K, a, onPick, opts), close: ()=> closeMenu(K), destroy(){ closeMenu(K); ac.abort(); el.remove(); } };
}
function placeMenu(K){
  const r = K.anchor.getBoundingClientRect(), w = K.el.offsetWidth, h = K.el.offsetHeight;
  const at = M.menuAt(r, w, h, window.innerWidth, window.innerHeight, K.centred);
  K.el.style.left = at.left + 'px';
  K.el.style.top = at.top + 'px';
}
function closeMenu(K){
  K.el.hidden = true;
  if (K.anchor){ K.anchor.classList.remove('cp-anchored'); K.anchor.setAttribute('aria-expanded', 'false'); }
  K.anchor = K.pick = null;
}
function openMenu(K, a, onPick, { current, centre } = {}){
  if (K.anchor === a){ closeMenu(K); return; }
  closeMenu(K);
  K.anchor = a; K.pick = onPick; K.centred = !!centre;
  K.el.querySelectorAll('[data-kind]').forEach(b=> b.classList.toggle('is-current', b.dataset.kind === current));
  K.el.hidden = false;
  a.classList.add('cp-anchored');
  a.setAttribute('aria-expanded', 'true');
  placeMenu(K);
}
function wireMenu(K, signal){
  const el = K.el;
  el.addEventListener('click', e=>{
    const b = e.target.closest('[data-kind]');
    if (!b) return;
    const f = K.pick;
    closeMenu(K);
    f(b.dataset.kind);
  });
  document.addEventListener('pointerdown', e=>{
    if (!el.hidden && !el.contains(e.target) && !K.anchor.contains(e.target)) closeMenu(K);
  }, { capture: true, signal });
  document.addEventListener('keydown', e=>{
    if (e.key === 'Escape' && !el.hidden){ e.stopPropagation(); closeMenu(K); }
  }, { capture: true, signal });
  window.addEventListener('scroll', ()=>{ if (!el.hidden) placeMenu(K); }, { capture: true, signal });
  window.addEventListener('resize', ()=>{ if (!el.hidden) placeMenu(K); }, { signal });
}

/* Folding animates the body's height. The card is marked folded from the start, so its
   panel stops drawing at once; .an-anim keeps the body laid out (and clipped) until the
   animation ends. One taken over midway starts from where it got to.
   It goes in two steps: foldTo marks the card and gives back the step that starts the
   animation. Unfolding, the body is meanwhile laid out at its full size but unseen, so
   that its panel is drawn in between, its plots measuring the room they will have, and
   the animation then slides open what was drawn, to its height. Unfolding started the
   animation and drew the card after, inside it: the redraw ran in the sliding body,
   which slid to the height it had before the redraw (to v485). (FOLD_MS, FOLD_EASE:
   cards-model.js.) */
function foldTo(card, fold){
  const body = card.querySelector(':scope > .an-body');
  if (!body._anim && card.classList.contains('is-folded') === fold) return ()=>{};
  const from = body.getBoundingClientRect().height, fromO = +getComputedStyle(body).opacity;
  if (body._anim){ body._anim.cancel(); body._anim = null; }
  card.classList.toggle('is-folded', fold);
  card.classList.add('an-anim');
  if (!fold) body.style.opacity = '0';
  return ()=>{
    body.style.opacity = '';
    const to = fold ? 0 : body.getBoundingClientRect().height;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(to - from) < 1){ card.classList.remove('an-anim'); return; }
    const an = body.animate([{ height: from + 'px', opacity: fold ? fromO : Math.min(fromO, 0.2) }, { height: to + 'px', opacity: fold ? 0 : 1 }],
      { duration: FOLD_MS, easing: FOLD_EASE });
    body._anim = an;
    an.onfinish = ()=>{ if (body._anim === an){ body._anim = null; card.classList.remove('an-anim'); } };
  };
}
// Where a card's box is now, an animation's under way too (cards-model.js BOX).
function boxOf(el){
  const cs = getComputedStyle(el);
  return { ...Object.fromEntries(M.BOX.map(k=> [k, k === 'height' ? el.getBoundingClientRect().height + 'px' : cs[k]])), opacity: +cs.opacity };
}
const reduced = ()=> matchMedia('(prefers-reduced-motion: reduce)').matches;

// In file names: no path or reserved characters, and no comma (CSV names travel
// comma-separated on their buttons). A colon, as in "Tauc: allowed direct", is dropped
// rather than turned into "_", so the name still reads.
export const fileSafe = n => n.replace(/:/g, '').replace(/[\\/*?"<>|,]/g, '_');
// The download buttons of a plot (or a table) named after the card.
export function nameDownloads(wrap, svgName, csvName){
  if (!wrap) return;
  wrap.querySelectorAll('.plot-dl-btn').forEach(b=>{ if (svgName) b.dataset.dlName = svgName; if (csvName) b.dataset.csvNames = csvName; });
  if (csvName) wrap.querySelectorAll('.plot-csv-btn, .table-csv-btn').forEach(b=>{ b.dataset.csvNames = csvName; });
}

/* An undo or a redo: the history's Ctrl/⌘+Z or Y (utils.js, the only way to either), whose
   state is put back at once, inside the key's own dispatch. The key is seen first here, on
   the window's capture, and a load made while its dispatch is under way is a step of the
   history; a load made otherwise is a tab's state or a project opened (restoreModuleState). */
let histKey = null;
window.addEventListener('keydown', e=>{ if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y')) histKey = e; }, true);
const stepping = ()=> !!histKey && histKey.eventPhase !== Event.NONE;

/* o: {
     list, addBar, addBtn       the cards' container, the "+" bar in it (cards go above it), its button
     kinds                      { type: label }, in menu order; names are settled in this order
     offer()                    the kinds "+" offers now (GC's Integration, only while raw
                                chromatograms are loaded, v544): with one, "+" adds it with no
                                menu, as a deck of one kind does; none given, every kind
     fixedKinds                 the title names the kind and does not change it (GC: a
                                production rate and an integration are not one analysis seen
                                two ways)
     title                      the head's word before the kind ('Analysis:' by default; the
                                Figure module's plots none, the kind alone: 'XY plot')
     info(type)                 the instructions under the title
     body(rec)                  the body's markup (prefix 'an' + rec.id for its element ids)
     make(type)                 the module's own fields of a new record
     build(rec, card, prev)     the card is in the page: make its panel (prev: the record's
                                panel before a kind switch, or undefined)
     drop(rec)                  the card is gone for good (closed, or not in a state loaded)
     autoName(rec)              the automatic name
     named(rec)                 the name changed: the module's downloads, its Results title
     afterNames()               after every naming pass (a reference's select, say)
     before()                   the list changed, before the names are settled again
     changed()                  the list changed (added, closed, moved, kind switched), names settled
     loaded()                   a state was loaded, names settled (else changed())
     added(rec)                 a card just added, built and named: start it on the files
     switched(rec, from)        a card just turned into another kind, built and named
     wake(rec)                  a card unfolded by its arrow, or one unfolding at the end of a move
                                that a draw was skipped for meanwhile: bring it up to date (it was
                                not drawn folded); laid out, not yet seen. One an undo or a redo
                                unfolds is laid out unseen the same, and drawn by the restore itself
     folded(rec)                a card folded by its arrow, or by an undo or a redo: what it had
                                going on show is left (an XRPD card's peak being placed). Not for
                                the folds of a move, which the cards come out of as they were
     commit()                   a step of the undo history
     layer                      where the kinds' menu goes: the instance's layer (utils.js
                                makeInstance)
   }
   destroy() lets the deck go (its module's instance destroyed): its menu and the listeners
   it set on the document and the window, the animations under way. */
export function createDeck(o){
  const D = makeDeck(o);
  if (o.addBtn) o.addBtn.addEventListener('click', ()=> onAdd(D));
  return apiOf(D);
}

/* =========================================================
   THE DECK: its state D, which every function below takes:
     o                          its options (above)
     recs, live                 the records, in order, and their cards (id → element)
     kinds, types               the kinds ({ type: label }) and their keys, in order
     switchable                 a card's title changes its kind (several kinds, not fixed)
     menu, title                the kinds' menu (several kinds), the head's word
     ghosts, ghostN             the copies of the cards a step took away, shrinking (id →
                                copy), and the number their plots' clips are renamed by
     pend                       what the step under way leaves to do as it ends (later)
     moving, missed             the move under way, and the ids of the open cards a draw was
                                skipped for in it
     nameCtx                    the name fields' measure
========================================================= */
function makeDeck(o){
  const kinds = o.kinds, types = Object.keys(kinds), several = types.length > 1;
  const D = { o, recs: [], live: new Map(), kinds, types, switchable: several && !o.fixedKinds };
  D.menu = several ? kindMenu(kinds, o.layer) : null;
  D.title = o.title ?? 'Analysis:';
  Object.assign(D, { ghosts: new Map(), ghostN: 0, pend: null, moving: null, missed: new Set() });
  D.nameCtx = document.createElement('canvas').getContext('2d');
  return D;
}
// What it gives the module.
function apiOf(D){
  return {
    get records(){ return D.recs; },
    byId: id => byId(D, id), cardOf: a => cardOf(D, a), isFolded: a => isFolded(D, a),
    add: (type, opts)=> add(D, type, opts), remove: a => remove(D, a), load: (list, read, keep)=> load(D, list, read, keep),
    saved: M.saved, refreshNames: ()=> refreshNames(D), fitName: a => fitName(D, a),
    fitNames(){ D.recs.forEach(a=> fitName(D, a)); },
    // The first cards of a new project, built as they are added but quietly (no history).
    start: typesList => start(D, typesList),
    destroy(){ quiet(D); if (D.menu) D.menu.destroy(); },
  };
}
const byId = (D, id)=> D.recs.find(a=> a.id === id) || null;
const cardOf = (D, a)=> D.live.get(a.id) || null;
// Folded: its panel draws nothing. An open card asked this while folded for a move had a
// draw skipped (a resize, a result come in): it is noted, to be brought up to date as the
// move ends.
function isFolded(D, a){
  const f = D.live.has(a.id) && D.live.get(a.id).classList.contains('is-folded');
  if (f && D.moving && !a.collapsed) D.missed.add(a.id);
  return f;
}
function start(D, typesList){
  D.recs = [];
  typesList.forEach(t=>{ const a = M.newRec(D.recs, t, D.o); D.recs.push(a); mount(D, a); });
  refreshNames(D);
}

/* ---- The cards ---- */
// The card, then its panel: the module finds its elements in the page by id.
function buildCard(D, a, place, prev){
  const card = document.createElement('div');
  card.className = 'card an-card' + (a.collapsed ? ' is-folded' : '');
  card.dataset.an = a.id;
  card.innerHTML = H.cardHtml(a, D.switchable, D.kinds, D.title, D.o, HU);
  place(card);
  D.live.set(a.id, card);
  D.o.build(a, card, prev);
  wireCard(D, a, card);
  syncFoldButton(D, a);
}
// p: the step of the history that brings the card back, to grow it as the step ends.
function mount(D, a, p){
  const from = unghost(D, a.id);
  buildCard(D, a, card=> D.o.list.insertBefore(card, D.o.addBar));
  if (p) p.grow.push([D.live.get(a.id), from]);
}
// fade: an undo or a redo takes the card away, and a copy of it shrinks where it was.
function unmount(D, a, fade){
  const card = D.live.get(a.id);
  if (!card) return;
  if (fade) leave(D, a.id, card);
  stopGrow(card);
  card.remove();
  D.live.delete(a.id);
  D.o.drop(a);
}
// Each card after the one before it, in the records' order: a card already there is left
// alone, and a copy shrinking keeps its place among them. Every card was put in again at
// every load (to v503), which would have sent the copies above them all, and took the
// focus off a field in a card that had not moved.
function placeCards(D){
  let prev = null;
  D.recs.forEach(a=>{
    const c = D.live.get(a.id);
    let p = c.previousElementSibling;
    while (p && !p.classList.contains('an-card')) p = p.previousElementSibling;
    if (p !== prev) D.o.list.insertBefore(c, prev ? prev.nextSibling : D.o.list.firstChild);
    prev = c;
  });
}
function wireCard(D, a, card){
  const q = s => card.querySelector(s);
  const kind = q('button.an-type');
  if (kind) kind.addEventListener('click', ()=> D.menu.open(kind, t=> switchKind(D, a, t), { current: a.type }));
  const name = q('.an-name');
  name.addEventListener('change', ()=> rename(D, a, name.value));
  ['input', 'focus', 'blur'].forEach(t=> name.addEventListener(t, ()=> fitName(D, a)));
  name.addEventListener('keydown', e=>{
    if (e.key === 'Enter') name.blur();
    else if (e.key === 'Escape'){ name.value = a.name; name.blur(); }
  });
  q('.an-close').addEventListener('click', ()=> remove(D, a));
  q('.an-fold').addEventListener('click', ()=> setFold(D, a, !a.collapsed));
  // Not initInstrCollapse's: that one wires the page's static blocks once, at load.
  const info = q('.an-head .instr-info'), instr = q('.an-instr');
  info.addEventListener('click', ()=>{
    const open = instr.style.display === 'none';
    instr.style.display = open ? '' : 'none';
    info.classList.toggle('is-on', open);
    info.setAttribute('aria-expanded', String(open));
  });
  q('.an-grip').addEventListener('pointerdown', e=> startMove(D, a, e));
}

/* ---- The steps of the history, animated ----
   A card an undo or a redo takes away leaves a copy of itself, which shrinks where it was
   and then goes, while the card is gone at once, its panel dropped (o.drop), as one closed
   by its ×. A copy: no handler, no id (its plots' clips renamed), no field of a form, none
   focused or clicked (inert), none counted as a card; drawn as the card was (a canvas, a
   select's choice, a fold under way, none of which a copy carries). A card brought back
   grows from nothing, or from where its copy had got to. */
function leave(D, id, card){
  if (!card.getClientRects().length) return;
  const g = card.cloneNode(true), from = boxOf(card);
  g.classList.remove('an-card', 'an-anim');
  g.removeAttribute('data-an');
  const src = card.querySelectorAll('canvas, select'), dst = g.querySelectorAll('canvas, select');
  // (a canvas that cannot be read is left blank in the copy)
  src.forEach((s, i)=>{ try { if (s.tagName === 'SELECT') dst[i].selectedIndex = s.selectedIndex; else if (s.width && s.height) dst[i].getContext('2d').drawImage(s, 0, 0); } catch(e){} });
  const clips = new Map();
  g.querySelectorAll('[id]').forEach(e=>{
    if (e.tagName !== 'clipPath'){ e.removeAttribute('id'); return; }
    const n = 'an-ghost' + (++D.ghostN);
    clips.set(e.id, n);
    e.id = n;
  });
  g.querySelectorAll('[clip-path]').forEach(e=>{ const m = /^url\(#(.+)\)$/.exec(e.getAttribute('clip-path')); if (m && clips.has(m[1])) e.setAttribute('clip-path', `url(#${clips.get(m[1])})`); });
  g.querySelectorAll('[name]').forEach(e=> e.removeAttribute('name'));
  ghostAsCard(card, g);
  g.inert = true;
  g.setAttribute('aria-hidden', 'true');
  g.style.overflow = 'hidden';
  card.before(g);
  const an = g._an = g.animate([from, NO_BOX], { duration: FOLD_MS, easing: FOLD_EASE, fill: 'forwards' });
  D.ghosts.set(id, g);
  an.onfinish = an.oncancel = ()=>{ if (D.ghosts.get(id) === g) D.ghosts.delete(id); g.remove(); };
}
// (what the card's own class gave it: the folded body out, the chevron turned)
function ghostAsCard(card, g){
  const body = card.querySelector(':scope > .an-body'), gb = g.querySelector(':scope > .an-body');
  if (!body.getClientRects().length) gb.style.display = 'none';
  else if (card.classList.contains('an-anim')) Object.assign(gb.style, { height: body.getBoundingClientRect().height + 'px', overflow: 'hidden', opacity: getComputedStyle(body).opacity });
  g.querySelector('.an-fold svg').style.transform = getComputedStyle(card.querySelector('.an-fold svg')).transform;
  if (!card.querySelector('.an-head .instr-info').getClientRects().length) g.querySelector('.an-head .instr-info').style.display = 'none';
}
// The copy of a card taken off at once: the card is back (its box given, where the copy had
// got to), or a state is loaded otherwise.
function unghost(D, id){
  const g = D.ghosts.get(id);
  if (!g) return null;
  const box = g.getClientRects().length ? boxOf(g) : null;
  D.ghosts.delete(id);
  g._an.cancel();
  g.remove();
  return box;
}
function grow(card, from, to){
  card.style.overflow = 'hidden';
  const an = card._grow = card.animate([from, to], { duration: FOLD_MS, easing: FOLD_EASE });
  an.onfinish = ()=>{ if (card._grow === an){ card._grow = null; card.style.overflow = ''; } };
}
function stopGrow(card){
  const an = card._grow;
  if (!an) return;
  card._grow = null;
  card.style.overflow = '';
  an.cancel();
}
/* A card still growing folded or unfolded (by a step, its arrow, a move): its growth gives
   way to one from where it had got to, to its box once the fold is made, beside the body's
   slide and as long, so the card goes on from there. Left, the growth held the card on
   towards the box it had measured, the body folding or unfolding inside it, and the card
   took its new height in a frame as the growth ended. foldTo's two steps, the same. */
function foldCard(card, fold){
  if (!card._grow || card.classList.contains('is-folded') === fold) return foldTo(card, fold);
  const from = boxOf(card);
  stopGrow(card);
  const go = foldTo(card, fold);
  return ()=>{
    // (the box with the fold made: a folded body out, an unfolded one at its height, drawn)
    card.classList.remove('an-anim');
    const to = card.getClientRects().length ? { ...boxOf(card), opacity: 1 } : null;
    card.classList.add('an-anim');
    go();
    if (to && !reduced()) grow(card, from, to);
  };
}
/* What an undo or a redo leaves to do as it ends, the restore it makes done and drawn: a
   microtask, run as the history's key listener (utils.js) returns, the key's dispatch
   still under way (a listener after it runs after this), before the page is painted. The
   folds it made are animated (an unfold laid out unseen until then, its panel drawn by the
   restore), the cards it brought back grow and the copies of those it took away shrink,
   all together; the first card brought back is brought into view (revealBy). */
function later(D){
  if (!D.pend){
    const p = D.pend = { go: [], grow: [], back: null };
    queueMicrotask(()=>{ if (D.pend === p){ D.pend = null; stepEnd(D, p); } });
  }
  return D.pend;
}
/* The card brought back into view: below it, the page scrolls down to where the card will
   be once grown, measured as the page will be when the animations end (the copies gone,
   the folds made), as the card grows (to v503 measured a frame on, nothing growing).
   Above it, the card is put whole at once, and the page scrolls up to it a frame on, as
   before: the browser keeps what is on screen in place while the content above it changes
   (scroll anchoring), which a growth there would fight, out of sight as it is. */
function stepEnd(D, p){
  const card = p.back && D.live.get(p.back.id), smooth = { behavior: reduced() ? 'instant' : 'smooth' };
  const dy = card ? revealNow(D, card, smooth) : 0;
  if (dy < 0){
    p.grow = p.grow.filter(([c])=> c !== card);
    requestAnimationFrame(()=>{ const d = revealBy(card); if (d) window.scrollBy({ top: d, ...smooth }); });
  }
  const to = p.grow.map(([c])=> c.isConnected && c.getClientRects().length ? { ...boxOf(c), opacity: 1 } : null);
  p.go.forEach(f=> f());
  p.grow.forEach(([c, from], i)=>{ if (to[i]) grow(c, from || NO_BOX, to[i]); });
}
// (the card brought back, measured as the page will be once the animations end: the copies
// out, the folds made; scrolled down to at once where it is below; the scroll it needs)
function revealNow(D, card, smooth){
  const gs = [...D.ghosts.values()], fs = [...D.o.list.querySelectorAll(':scope > .an-card.is-folded.an-anim')];
  gs.forEach(g=> g.style.display = 'none');
  fs.forEach(c=> c.classList.remove('an-anim'));
  const dy = revealBy(card);
  if (dy > 0) window.scrollBy({ top: dy, ...smooth });
  gs.forEach(g=> g.style.display = '');
  fs.forEach(c=> c.classList.add('an-anim'));
  return dy;
}
// A load that is no step (a tab's state, a project opened, a CSV export's state): nothing
// animated, and what a step left going is ended at once.
function quiet(D){
  D.pend = null;
  [...D.ghosts.keys()].forEach(id=> unghost(D, id));
  D.live.forEach(stopGrow);
}

/* ---- Folds ---- */
function syncFoldButton(D, a){
  const b = D.live.get(a.id).querySelector('.an-fold'), w = H.foldWords(a.collapsed);
  b.title = w.title;
  b.setAttribute('aria-label', w.label);
  b.setAttribute('aria-expanded', String(!a.collapsed));
}
// A state loaded that is no step of the history (or one with the motion reduced) puts the
// folds where they were, without the animation.
function applyFold(D, a){
  const card = D.live.get(a.id), body = card.querySelector(':scope > .an-body');
  if (body._anim){ body._anim.cancel(); body._anim = null; }
  card.classList.remove('an-anim');
  body.style.opacity = '';
  card.classList.toggle('is-folded', a.collapsed);
  syncFoldButton(D, a);
}
// Unfolding: the card brought up to date (wake) laid out but unseen, then the animation.
// Folding: the module leaves what the card had going (folded), as the fold starts (to
// v498 an XRPD card's + Add peak stayed on, folded and unfolded again, until a key).
function setFold(D, a, folded){
  a.collapsed = folded;
  syncFoldButton(D, a);
  const go = foldCard(D.live.get(a.id), folded);
  try { if (!folded && D.o.wake) D.o.wake(a); else if (folded && D.o.folded) D.o.folded(a); } finally { go(); }
  D.o.commit();
}

/* ---- Moving: the grip picks the card up. Every card folds for the move, so the list is
   short enough to see whole; the card held follows the pointer and the others make
   way as it passes their middles. On release each card gets back the fold it had.
   While the cards fold, and again while they unfold, the page scrolls to keep the
   card held where it is on screen: the folds would otherwise pull the list out of
   view, above it or below it. The cards unfold as one does by its arrow: laid out
   unseen, the list's change settled and each card a draw was skipped for during the
   move brought up to date (wake), then the animations. A card nothing came for is
   left as it was, its plots with the tool and the zoom they had, and a plain press
   and release of the grip redraws nothing. They unfolded with no wake, so a draw
   skipped (a resize while they were folded) was never made up, and what the list's
   change redrew (an Urbach card's reference) was drawn in the sliding body (to v485). ---- */
const scrollNow = dy =>{ if (dy) window.scrollBy({ top: dy, behavior: 'instant' }); };
// y0: where the card is to stay, if not where it is now.
function holdInView(card, ms, y0 = card.getBoundingClientRect().top){
  const end = performance.now() + ms;
  const loop = ()=>{ scrollNow(card.getBoundingClientRect().top - y0); if (performance.now() < end) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
function startMove(D, a, e){
  if (D.moving || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault();
  const card = D.live.get(a.id), top = card.getBoundingClientRect().top;
  D.moving = { card, y: e.clientY, dy: e.clientY - top, top, t: 0, raf: 0, folding: performance.now() + FOLD_MS + 40 };
  card.classList.add('an-moving');
  document.body.classList.add('an-dragging');
  D.missed.clear();
  D.recs.forEach(x=> foldCard(D.live.get(x.id), true)());
  const onMove = ev =>{ D.moving.y = ev.clientY; };
  const onUp = ()=>{
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    endMove(D);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  const loop = ()=>{ if (!D.moving) return; followMove(D); D.moving.raf = requestAnimationFrame(loop); };
  loop();
}
function followMove(D){
  const m = D.moving, card = m.card;
  if (performance.now() < m.folding) scrollNow(card.getBoundingClientRect().top - m.t - m.top);
  else {
    // Near the window's top or bottom the page scrolls, for a list taller than it.
    const EDGE = 48;
    if (m.y < EDGE) scrollNow(-10);
    else if (m.y > window.innerHeight - EDGE) scrollNow(10);
    const cards = [...D.o.list.querySelectorAll(':scope > .an-card')], i = cards.indexOf(card);
    const mid = k =>{ const r = cards[k].getBoundingClientRect(); return r.top + r.height/2; };
    const by = M.moveBy(i, cards.length, m.y, mid);
    if (by < 0) D.o.list.insertBefore(card, cards[i-1]);
    else if (by > 0) D.o.list.insertBefore(card, cards[i+1].nextSibling);
  }
  // Under the pointer, wherever the layout and the scroll have put it meanwhile.
  const top = card.getBoundingClientRect().top - m.t;
  m.t = m.y - m.dy - top;
  card.style.transform = `translateY(${m.t}px)`;
}
function endMove(D){
  const m = D.moving;
  D.moving = null;
  cancelAnimationFrame(m.raf);
  m.card.style.transform = '';
  m.card.classList.remove('an-moving');
  document.body.classList.remove('an-dragging');
  const order = [...D.o.list.querySelectorAll(':scope > .an-card')].map(c=> +c.dataset.an);
  const was = D.recs.map(a=> a.id).join();
  M.sortBy(D.recs, order);
  // Where the card is now, before the unseen bodies take their room.
  const y0 = m.card.getBoundingClientRect().top, open = D.recs.filter(x=> !x.collapsed);
  const stale = open.filter(x=> D.missed.has(x.id));
  D.missed.clear();
  const go = open.map(x=> foldCard(D.live.get(x.id), false));
  try {
    if (order.join() !== was) afterChange(D);
    if (D.o.wake) stale.forEach(x=> D.o.wake(x));
  } finally { go.forEach(f=> f()); holdInView(m.card, FOLD_MS + 40, y0); }
  if (order.join() !== was) D.o.commit();
}

/* ---- Names (settled unique: cards-model.js settleNames) ---- */
function refreshNames(D){
  M.settleNames(D.recs, D.types, a=> D.o.autoName(a));
  D.recs.forEach(a=> paintName(D, a));
  if (D.o.afterNames) D.o.afterNames();
}
function rename(D, a, v){
  M.renamed(a, v, x=> D.o.autoName(x));
  refreshNames(D);
  D.o.commit();
}
// The name field is as wide as the name, as the project name's is: from room for the
// caret up to 3/4 of the card, past which the text scrolls (blurred, a "…").
function fitName(D, a){
  const card = D.live.get(a.id);
  if (!card) return;
  const field = card.querySelector('.an-name'), cc = getComputedStyle(card);
  const room = card.clientWidth - parseFloat(cc.paddingLeft) - parseFloat(cc.paddingRight);
  if (room <= 0) return;   // not laid out (a hidden tab, no files yet): sized when shown
  const cs = getComputedStyle(field);
  D.nameCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  field.style.width = M.nameWidth(D.nameCtx.measureText(field.value).width, room) + 'px';
}
function paintName(D, a){
  const card = D.live.get(a.id);
  if (!card) return;
  const field = card.querySelector('.an-name');
  if (document.activeElement !== field) field.value = a.name;
  field.placeholder = D.o.autoName(a);
  fitName(D, a);
  if (D.o.named) D.o.named(a);
}

/* ---- Adding, closing, switching ---- */
function afterChange(D, loading){
  if (D.o.before) D.o.before();
  refreshNames(D);
  const f = loading && D.o.loaded ? D.o.loaded : D.o.changed;
  if (f) f();
}
/* `at`: its place among the cards (none: the last); `quiet`: no step of its own and no
   scroll, a card the module adds as part of a change of its own (GC's Integration, its
   raw chromatograms dropped: one step with the files). */
function add(D, type, { at, quiet } = {}){
  const a = M.newRec(D.recs, type, D.o);
  if (at != null && at >= 0 && at < D.recs.length) D.recs.splice(at, 0, a); else D.recs.push(a);
  mount(D, a);
  placeCards(D);
  afterChange(D);
  if (D.o.added) D.o.added(a);
  if (quiet) return a;
  D.o.commit();
  D.live.get(a.id).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return a;
}
// No confirmation: undo brings a closed card back.
function remove(D, a){
  unmount(D, a);
  D.recs = D.recs.filter(x=> x !== a);
  afterChange(D);
  D.o.commit();
}
// The "+" bar: the one kind it offers added, or the menu of those it offers.
function onAdd(D){
  const ks = M.offered(D.o, D.types);
  if (ks.length < 2){ add(D, ks[0]); return; }
  D.menu.el.querySelectorAll('[data-kind]').forEach(b=>{ b.hidden = !ks.includes(b.dataset.kind); });
  D.menu.open(D.o.addBtn, t=> add(D, t), { centre: true });
}
/* A card an undo or a redo brings back (closed by its ×, or added, and the step undone or
   redone) is brought into view, as a card added is, where it is not in view already: in
   view, its head is whole on screen, under the page's sticky bar, or the card covers the
   screen. Smoothly (at once, the motion reduced), the card whole where it fits, else from
   its head (as the step ends: stepEnd). The scroll it takes; 0, none (cards-model.js
   revealOf). Up to v499 it came back where it had been, off screen as often as not, and
   the page did not move. */
function revealBy(card){
  if (!card.isConnected || !card.getClientRects().length) return 0;
  const bar = document.getElementById('topbar'), top = bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
  const r = card.getBoundingClientRect(), h = card.querySelector(':scope > .an-head').getBoundingClientRect(), bot = window.innerHeight;
  return M.revealOf(top, r, h, bot);
}
// The card is rebuilt for the other kind in place; the module keeps what the kind left
// had (build's prev) and gives it back if the card turns into it again. Only a record still
// in the deck (a menu opened on one a step took away picks nothing: v569).
function switchKind(D, a, type){
  if (type === a.type || !D.kinds[type] || !D.recs.includes(a) || !D.live.has(a.id)) return;
  const card = D.live.get(a.id), from = a.type;
  a.type = type;
  buildCard(D, a, c=> card.replaceWith(c), from);
  afterChange(D);
  if (D.o.switched) D.o.switched(a, from);
  D.o.commit();
}

/* ---- A state loaded ----
   A card whose id and kind are both still there is kept, and its panel restored (keep),
   so an undo does not rebuild the whole list; any other is built afresh. A kept record
   is updated in place: the card's handlers hold on to it. A kind and an id are read as
   cards-model.js isKind and okId take them.
   An undo or a redo (step) animates what it changes: a fold as the arrow does, a card
   brought back growing in its place, one taken away shrinking out of it (a card turned
   into another kind is rebuilt in place, as a switch is, and a move only puts the cards in
   order); the motion reduced, nothing. Up to v503 a step put each as it was at once. */
function load(D, list, read, keep){
  // (the kinds' menu closed: what it was opened on may be gone, or another record, v569; to
  // v568 it stayed open, and a pick then threw or rebuilt a card for a record gone)
  if (D.menu) D.menu.close();
  list = list.filter(s=> s && (s.type == null || M.isKind(D.kinds, s.type)));
  // (the cards in the page before: one not among them that an undo or a redo brings is
  // brought into view, the first of them)
  const step = stepping(), motion = step && !reduced(), was = new Set(D.live.keys());
  if (!step) quiet(D);
  const p = step ? later(D) : null;
  const L = { step, motion, p, read, keep, old: new Map(D.recs.map(a=> [a.id, a])), seen: new Set(), free: M.freeId(list) };
  const next = list.map(src=> loadOne(D, L, src));
  // Left in `old`: gone, or back as another kind (its id still there).
  const ids = new Set(next.map(s=> s.id));
  L.old.forEach(a=> unmount(D, a, motion && !ids.has(a.id)));
  D.recs = next;
  D.recs.forEach(a=>{ if (!D.live.has(a.id)) mount(D, a, motion && !was.has(a.id) ? p : null); });
  placeCards(D);
  afterChange(D, true);
  if (step && !p.back) p.back = D.recs.find(a=> !was.has(a.id)) || null;
}
// One record of the state (L: the load's step, its records before, the ids seen and free):
// the record kept, updated and its fold put or animated, or a new one.
function loadOne(D, L, src){
  const s = M.recIn(src, L.read, D.kinds, D.types);
  if (!M.okId(s.id) || L.seen.has(s.id)) s.id = L.free++;
  L.seen.add(s.id);
  const a = L.old.get(s.id);
  if (!(a && a.type === s.type && D.live.has(a.id))) return s;
  L.old.delete(a.id);
  // (a fold under way to where the state has it is left to end)
  const card = D.live.get(a.id), flip = card.classList.contains('is-folded') !== s.collapsed;
  Object.assign(a, s);
  L.keep(a);
  if (!L.motion) applyFold(D, a);
  else if (flip){ L.p.go.push(foldCard(card, a.collapsed)); syncFoldButton(D, a); }
  if (L.step && flip && a.collapsed && D.o.folded) D.o.folded(a);
  return a;
}
