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
========================================================= */
import { X_SVG, esc } from './utils.js';

const INFO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none"/></svg>';
const GRIP_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="5" y1="7" x2="19" y2="7"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="5" y1="17" x2="19" y2="17"/></svg>';
const CHEVRON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

// What every card's instructions end with: how the cards themselves are handled.
export const cardInfo = (several, results) => `Each analysis card can be renamed in the field under its title (left empty, it goes back to the automatic name), ${several ? 'turned into another kind of analysis from its title, ' : ''}folded with the arrow, closed with the ×, and moved by dragging the ≡ grip; <b>+</b> below the cards adds another.${results ? ' Every card has its own charts in the Results, under its name.' : ''}`;

/* The kinds' menu, anchored as the composer's pickers are: the "+" bar opens it to add a
   card, a card's title to change its kind. The anchor again or a click anywhere else
   closes it, so does Escape; the anchor stays lit while it is open. A menu of our own
   rather than a <select>: the title's capitals would carry into a native list, which
   some systems draw with the select's own styling. */
// (in `layer`: the module's instance's, which is in the page while its instance is. Its
// listeners on the document and the window come off with destroy.)
function kindMenu(kinds, layer){
  const el = document.createElement('div');
  el.className = 'an-menu';
  el.setAttribute('role', 'menu');
  el.hidden = true;
  el.innerHTML = Object.entries(kinds).map(([k, l])=> `<button type="button" role="menuitem" data-kind="${esc(k)}">${esc(l)}</button>`).join('');
  layer.appendChild(el);
  const ac = new AbortController(), signal = ac.signal;
  let anchor = null, pick = null, centred = false;
  const place = ()=>{
    const r = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = r.top - h - 6;
    const left = centred ? r.left + r.width/2 - w/2 : r.left;
    el.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, left)) + 'px';
    el.style.top = Math.max(8, top) + 'px';
  };
  const close = ()=>{
    el.hidden = true;
    if (anchor){ anchor.classList.remove('cp-anchored'); anchor.setAttribute('aria-expanded', 'false'); }
    anchor = pick = null;
  };
  const open = (a, onPick, { current, centre } = {})=>{
    if (anchor === a){ close(); return; }
    close();
    anchor = a; pick = onPick; centred = !!centre;
    el.querySelectorAll('[data-kind]').forEach(b=> b.classList.toggle('is-current', b.dataset.kind === current));
    el.hidden = false;
    a.classList.add('cp-anchored');
    a.setAttribute('aria-expanded', 'true');
    place();
  };
  el.addEventListener('click', e=>{
    const b = e.target.closest('[data-kind]');
    if (!b) return;
    const f = pick;
    close();
    f(b.dataset.kind);
  });
  document.addEventListener('pointerdown', e=>{
    if (!el.hidden && !el.contains(e.target) && !anchor.contains(e.target)) close();
  }, { capture: true, signal });
  document.addEventListener('keydown', e=>{
    if (e.key === 'Escape' && !el.hidden){ e.stopPropagation(); close(); }
  }, { capture: true, signal });
  window.addEventListener('scroll', ()=>{ if (!el.hidden) place(); }, { capture: true, signal });
  window.addEventListener('resize', ()=>{ if (!el.hidden) place(); }, { signal });
  return { open, close, destroy(){ close(); ac.abort(); el.remove(); } };
}

/* Folding animates the body's height. The card is marked folded from the start, so its
   panel stops drawing at once; .an-anim keeps the body laid out (and clipped) until the
   animation ends. One taken over midway starts from where it got to.
   It goes in two steps: foldTo marks the card and gives back the step that starts the
   animation. Unfolding, the body is meanwhile laid out at its full size but unseen, so
   that its panel is drawn in between, its plots measuring the room they will have, and
   the animation then slides open what was drawn, to its height. Unfolding started the
   animation and drew the card after, inside it: the redraw ran in the sliding body,
   which slid to the height it had before the redraw (to v485). */
// Long enough, at ~600 px of body, to read as a slide rather than a jump; the curve
// starts briskly and settles gently, and the content fades as it goes.
export const FOLD_MS = 320;
const FOLD_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
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
/* A card an undo or a redo brings back or takes away grows from nothing or shrinks to it,
   as a fold goes: its height, with its padding, border and margins, and its opacity. */
const BOX = ['height', 'paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth', 'marginTop', 'marginBottom'];
const NO_BOX = { ...Object.fromEntries(BOX.map(k=> [k, '0px'])), opacity: 0 };
// Where a card's box is now, an animation's under way too.
function boxOf(el){
  const cs = getComputedStyle(el);
  return { ...Object.fromEntries(BOX.map(k=> [k, k === 'height' ? el.getBoundingClientRect().height + 'px' : cs[k]])), opacity: +cs.opacity };
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
  let recs = [];
  const live = new Map();       // id → card element
  const kinds = o.kinds, types = Object.keys(kinds), several = types.length > 1;
  const menu = several ? kindMenu(kinds, o.layer) : null;

  const nextId = ()=> recs.reduce((m, a)=> Math.max(m, a.id), 0) + 1;
  const newRec = type => ({ id: nextId(), type, base: '', nameAuto: true, name: '', collapsed: false, ...(o.make ? o.make(type) : {}) });
  const byId = id => recs.find(a=> a.id === id) || null;
  const cardOf = a => live.get(a.id) || null;
  // Folded: its panel draws nothing. An open card asked this while folded for a move had a
  // draw skipped (a resize, a result come in): it is noted, to be brought up to date as the
  // move ends.
  const isFolded = a =>{
    const f = live.has(a.id) && live.get(a.id).classList.contains('is-folded');
    if (f && moving && !a.collapsed) missed.add(a.id);
    return f;
  };

  // The title is the kind, chosen in place (with one kind, plain text); the name sits under
  // it and stays in view when the card is folded, the instructions open under the name.
  function cardHtml(a){
    const kind = several
      ? `<button type="button" class="an-type" data-kind="${esc(a.type)}" aria-haspopup="menu" aria-expanded="false" title="Change the kind of analysis">${esc(kinds[a.type])}</button>`
      : `<span class="an-type is-fixed">${esc(kinds[a.type])}</span>`;
    return `
        <div class="an-head">
          <button type="button" class="an-ic an-grip" title="Drag to move this analysis" aria-label="Move analysis">${GRIP_SVG}</button>
          <h3 class="txt-head an-title">Analysis:<span class="an-kind">${kind}<button type="button" class="instr-info" aria-label="Toggle instructions" aria-expanded="false">${INFO_SVG}</button></span></h3>
          <span class="an-acts">
            <button type="button" class="an-ic an-close" title="Close this analysis" aria-label="Close analysis">${X_SVG(15)}</button>
            <button type="button" class="an-ic an-fold">${CHEVRON_SVG}</button>
          </span>
        </div>
        <input type="text" class="an-name" spellcheck="false" aria-label="Analysis name" title="The analysis name: its charts and files are named after it. Left empty, it goes back to the automatic one.">
        <div class="an-body">
          <div class="instr-block an-instr" style="display:none">${o.info(a.type)}</div>
          ${o.body(a)}
        </div>`;
  }

  // The card, then its panel: the module finds its elements in the page by id.
  function buildCard(a, place, prev){
    const card = document.createElement('div');
    card.className = 'card an-card' + (a.collapsed ? ' is-folded' : '');
    card.dataset.an = a.id;
    card.innerHTML = cardHtml(a);
    place(card);
    live.set(a.id, card);
    o.build(a, card, prev);
    wireCard(a, card);
    syncFoldButton(a);
  }
  // p: the step of the history that brings the card back, to grow it as the step ends.
  function mount(a, p){
    const from = unghost(a.id);
    buildCard(a, card=> o.list.insertBefore(card, o.addBar));
    if (p) p.grow.push([live.get(a.id), from]);
  }
  // fade: an undo or a redo takes the card away, and a copy of it shrinks where it was.
  function unmount(a, fade){
    const card = live.get(a.id);
    if (!card) return;
    if (fade) leave(a.id, card);
    stopGrow(card);
    card.remove();
    live.delete(a.id);
    o.drop(a);
  }
  // Each card after the one before it, in the records' order: a card already there is left
  // alone, and a copy shrinking keeps its place among them. Every card was put in again at
  // every load (to v503), which would have sent the copies above them all, and took the
  // focus off a field in a card that had not moved.
  function placeCards(){
    let prev = null;
    recs.forEach(a=>{
      const c = live.get(a.id);
      let p = c.previousElementSibling;
      while (p && !p.classList.contains('an-card')) p = p.previousElementSibling;
      if (p !== prev) o.list.insertBefore(c, prev ? prev.nextSibling : o.list.firstChild);
      prev = c;
    });
  }

  /* ---- The steps of the history, animated ----
     A card an undo or a redo takes away leaves a copy of itself, which shrinks where it was
     and then goes, while the card is gone at once, its panel dropped (o.drop), as one closed
     by its ×. A copy: no handler, no id (its plots' clips renamed), no field of a form, none
     focused or clicked (inert), none counted as a card; drawn as the card was (a canvas, a
     select's choice, a fold under way, none of which a copy carries). A card brought back
     grows from nothing, or from where its copy had got to. */
  const ghosts = new Map();     // id → the copy of a card taken away, shrinking
  let ghostN = 0;
  function leave(id, card){
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
      const n = 'an-ghost' + (++ghostN);
      clips.set(e.id, n);
      e.id = n;
    });
    g.querySelectorAll('[clip-path]').forEach(e=>{ const m = /^url\(#(.+)\)$/.exec(e.getAttribute('clip-path')); if (m && clips.has(m[1])) e.setAttribute('clip-path', `url(#${clips.get(m[1])})`); });
    g.querySelectorAll('[name]').forEach(e=> e.removeAttribute('name'));
    // (what the card's own class gave it: the folded body out, the chevron turned)
    const body = card.querySelector(':scope > .an-body'), gb = g.querySelector(':scope > .an-body');
    if (!body.getClientRects().length) gb.style.display = 'none';
    else if (card.classList.contains('an-anim')) Object.assign(gb.style, { height: body.getBoundingClientRect().height + 'px', overflow: 'hidden', opacity: getComputedStyle(body).opacity });
    g.querySelector('.an-fold svg').style.transform = getComputedStyle(card.querySelector('.an-fold svg')).transform;
    if (!card.querySelector('.an-head .instr-info').getClientRects().length) g.querySelector('.an-head .instr-info').style.display = 'none';
    g.inert = true;
    g.setAttribute('aria-hidden', 'true');
    g.style.overflow = 'hidden';
    card.before(g);
    const an = g._an = g.animate([from, NO_BOX], { duration: FOLD_MS, easing: FOLD_EASE, fill: 'forwards' });
    ghosts.set(id, g);
    an.onfinish = an.oncancel = ()=>{ if (ghosts.get(id) === g) ghosts.delete(id); g.remove(); };
  }
  // The copy of a card taken off at once: the card is back (its box given, where the copy had
  // got to), or a state is loaded otherwise.
  function unghost(id){
    const g = ghosts.get(id);
    if (!g) return null;
    const box = g.getClientRects().length ? boxOf(g) : null;
    ghosts.delete(id);
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
  let pend = null;
  function later(){
    if (!pend){
      const p = pend = { go: [], grow: [], back: null };
      queueMicrotask(()=>{ if (pend === p){ pend = null; stepEnd(p); } });
    }
    return pend;
  }
  /* The card brought back into view: below it, the page scrolls down to where the card will
     be once grown, measured as the page will be when the animations end (the copies gone,
     the folds made), as the card grows (to v503 measured a frame on, nothing growing).
     Above it, the card is put whole at once, and the page scrolls up to it a frame on, as
     before: the browser keeps what is on screen in place while the content above it changes
     (scroll anchoring), which a growth there would fight, out of sight as it is. */
  function stepEnd(p){
    const card = p.back && live.get(p.back.id), smooth = { behavior: reduced() ? 'instant' : 'smooth' };
    let dy = 0;
    if (card){
      const gs = [...ghosts.values()], fs = [...o.list.querySelectorAll(':scope > .an-card.is-folded.an-anim')];
      gs.forEach(g=> g.style.display = 'none');
      fs.forEach(c=> c.classList.remove('an-anim'));
      dy = revealBy(card);
      if (dy > 0) window.scrollBy({ top: dy, ...smooth });
      gs.forEach(g=> g.style.display = '');
      fs.forEach(c=> c.classList.add('an-anim'));
    }
    if (dy < 0){
      p.grow = p.grow.filter(([c])=> c !== card);
      requestAnimationFrame(()=>{ const d = revealBy(card); if (d) window.scrollBy({ top: d, ...smooth }); });
    }
    const to = p.grow.map(([c])=> c.isConnected && c.getClientRects().length ? { ...boxOf(c), opacity: 1 } : null);
    p.go.forEach(f=> f());
    p.grow.forEach(([c, from], i)=>{ if (to[i]) grow(c, from || NO_BOX, to[i]); });
  }
  // A load that is no step (a tab's state, a project opened, a CSV export's state): nothing
  // animated, and what a step left going is ended at once.
  function quiet(){
    pend = null;
    [...ghosts.keys()].forEach(unghost);
    live.forEach(stopGrow);
  }

  function wireCard(a, card){
    const q = s => card.querySelector(s);
    const kind = q('button.an-type');
    if (kind) kind.addEventListener('click', ()=> menu.open(kind, t=> switchKind(a, t), { current: a.type }));
    const name = q('.an-name');
    name.addEventListener('change', ()=> rename(a, name.value));
    ['input', 'focus', 'blur'].forEach(t=> name.addEventListener(t, ()=> fitName(a)));
    name.addEventListener('keydown', e=>{
      if (e.key === 'Enter') name.blur();
      else if (e.key === 'Escape'){ name.value = a.name; name.blur(); }
    });
    q('.an-close').addEventListener('click', ()=> remove(a));
    q('.an-fold').addEventListener('click', ()=> setFold(a, !a.collapsed));
    // Not initInstrCollapse's: that one wires the page's static blocks once, at load.
    const info = q('.an-head .instr-info'), instr = q('.an-instr');
    info.addEventListener('click', ()=>{
      const open = instr.style.display === 'none';
      instr.style.display = open ? '' : 'none';
      info.classList.toggle('is-on', open);
      info.setAttribute('aria-expanded', String(open));
    });
    q('.an-grip').addEventListener('pointerdown', e=> startMove(a, e));
  }
  function syncFoldButton(a){
    const b = live.get(a.id).querySelector('.an-fold');
    b.title = a.collapsed ? 'Unfold this analysis' : 'Fold this analysis';
    b.setAttribute('aria-label', a.collapsed ? 'Unfold analysis' : 'Fold analysis');
    b.setAttribute('aria-expanded', String(!a.collapsed));
  }
  // A state loaded that is no step of the history (or one with the motion reduced) puts the
  // folds where they were, without the animation.
  function applyFold(a){
    const card = live.get(a.id), body = card.querySelector(':scope > .an-body');
    if (body._anim){ body._anim.cancel(); body._anim = null; }
    card.classList.remove('an-anim');
    body.style.opacity = '';
    card.classList.toggle('is-folded', a.collapsed);
    syncFoldButton(a);
  }
  // Unfolding: the card brought up to date (wake) laid out but unseen, then the animation.
  // Folding: the module leaves what the card had going (folded), as the fold starts (to
  // v498 an XRPD card's + Add peak stayed on, folded and unfolded again, until a key).
  function setFold(a, folded){
    a.collapsed = folded;
    syncFoldButton(a);
    const go = foldCard(live.get(a.id), folded);
    try { if (!folded && o.wake) o.wake(a); else if (folded && o.folded) o.folded(a); } finally { go(); }
    o.commit();
  }

  /* Moving: the grip picks the card up. Every card folds for the move, so the list is
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
     change redrew (an Urbach card's reference) was drawn in the sliding body (to v485). */
  let moving = null;
  const missed = new Set();     // ids of the open cards a draw was skipped for, in a move
  const scrollNow = dy =>{ if (dy) window.scrollBy({ top: dy, behavior: 'instant' }); };
  // y0: where the card is to stay, if not where it is now.
  function holdInView(card, ms, y0 = card.getBoundingClientRect().top){
    const end = performance.now() + ms;
    const loop = ()=>{ scrollNow(card.getBoundingClientRect().top - y0); if (performance.now() < end) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  function startMove(a, e){
    if (moving || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const card = live.get(a.id), top = card.getBoundingClientRect().top;
    moving = { card, y: e.clientY, dy: e.clientY - top, top, t: 0, raf: 0, folding: performance.now() + FOLD_MS + 40 };
    card.classList.add('an-moving');
    document.body.classList.add('an-dragging');
    missed.clear();
    recs.forEach(x=> foldCard(live.get(x.id), true)());
    const onMove = ev =>{ moving.y = ev.clientY; };
    const onUp = ()=>{
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      endMove();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    const loop = ()=>{ if (!moving) return; followMove(); moving.raf = requestAnimationFrame(loop); };
    loop();
  }
  function followMove(){
    const m = moving, card = m.card;
    if (performance.now() < m.folding) scrollNow(card.getBoundingClientRect().top - m.t - m.top);
    else {
      // Near the window's top or bottom the page scrolls, for a list taller than it.
      const EDGE = 48;
      if (m.y < EDGE) scrollNow(-10);
      else if (m.y > window.innerHeight - EDGE) scrollNow(10);
      const cards = [...o.list.querySelectorAll(':scope > .an-card')], i = cards.indexOf(card);
      const mid = c =>{ const r = c.getBoundingClientRect(); return r.top + r.height/2; };
      if (i > 0 && m.y < mid(cards[i-1])) o.list.insertBefore(card, cards[i-1]);
      else if (i < cards.length-1 && m.y > mid(cards[i+1])) o.list.insertBefore(card, cards[i+1].nextSibling);
    }
    // Under the pointer, wherever the layout and the scroll have put it meanwhile.
    const top = card.getBoundingClientRect().top - m.t;
    m.t = m.y - m.dy - top;
    card.style.transform = `translateY(${m.t}px)`;
  }
  function endMove(){
    const m = moving;
    moving = null;
    cancelAnimationFrame(m.raf);
    m.card.style.transform = '';
    m.card.classList.remove('an-moving');
    document.body.classList.remove('an-dragging');
    const order = [...o.list.querySelectorAll(':scope > .an-card')].map(c=> +c.dataset.an);
    const was = recs.map(a=> a.id).join();
    recs.sort((x, y)=> order.indexOf(x.id) - order.indexOf(y.id));
    // Where the card is now, before the unseen bodies take their room.
    const y0 = m.card.getBoundingClientRect().top, open = recs.filter(x=> !x.collapsed);
    const stale = open.filter(x=> missed.has(x.id));
    missed.clear();
    const go = open.map(x=> foldCard(live.get(x.id), false));
    try {
      if (order.join() !== was) afterChange();
      if (o.wake) stale.forEach(x=> o.wake(x));
    } finally { go.forEach(f=> f()); holdInView(m.card, FOLD_MS + 40, y0); }
    if (order.join() !== was) o.commit();
  }

  /* ---- Names ---- */
  // Names are unique: a repeat gets " (2)", " (3)"... Settled kind by kind, in the kinds'
  // order: an automatic name may carry another card's (an Urbach card its reference's).
  function refreshNames(){
    const used = new Set();
    const uniq = n =>{ let s = n, k = 2; while (used.has(s)) s = `${n} (${k++})`; used.add(s); return s; };
    types.forEach(t=> recs.filter(a=> a.type === t).forEach(a=>{
      a.name = uniq(a.nameAuto || !a.base ? o.autoName(a) : a.base);
    }));
    recs.forEach(paintName);
    if (o.afterNames) o.afterNames();
  }
  function rename(a, v){
    v = v.trim();
    if (!v || v === o.autoName(a)){ a.nameAuto = true; a.base = ''; }
    else { a.nameAuto = false; a.base = v; }
    refreshNames();
    o.commit();
  }
  // The name field is as wide as the name, as the project name's is: from room for the
  // caret up to 3/4 of the card, past which the text scrolls (blurred, a "…").
  const nameCtx = document.createElement('canvas').getContext('2d');
  function fitName(a){
    const card = live.get(a.id);
    if (!card) return;
    const field = card.querySelector('.an-name'), cc = getComputedStyle(card);
    const room = card.clientWidth - parseFloat(cc.paddingLeft) - parseFloat(cc.paddingRight);
    if (room <= 0) return;   // not laid out (a hidden tab, no files yet): sized when shown
    const cs = getComputedStyle(field);
    nameCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const pad = 24;          // 2×9 padding + 2×1 border + a little caret slack
    field.style.width = Math.min(nameCtx.measureText(field.value).width + pad, room * 0.75) + 'px';
  }
  function paintName(a){
    const card = live.get(a.id);
    if (!card) return;
    const field = card.querySelector('.an-name');
    if (document.activeElement !== field) field.value = a.name;
    field.placeholder = o.autoName(a);
    fitName(a);
    if (o.named) o.named(a);
  }

  /* ---- Adding, closing, switching ---- */
  function afterChange(loading){
    if (o.before) o.before();
    refreshNames();
    const f = loading && o.loaded ? o.loaded : o.changed;
    if (f) f();
  }
  function add(type){
    const a = newRec(type);
    recs.push(a);
    mount(a);
    afterChange();
    if (o.added) o.added(a);
    o.commit();
    live.get(a.id).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return a;
  }
  // No confirmation: undo brings a closed card back.
  function remove(a){
    unmount(a);
    recs = recs.filter(x=> x !== a);
    afterChange();
    o.commit();
  }
  /* A card an undo or a redo brings back (closed by its ×, or added, and the step undone or
     redone) is brought into view, as a card added is, where it is not in view already: in
     view, its head is whole on screen, under the page's sticky bar, or the card covers the
     screen. Smoothly (at once, the motion reduced), the card whole where it fits, else from
     its head (as the step ends: stepEnd). The scroll it takes; 0, none. Up to v499 it came
     back where it had been, off screen as often as not, and the page did not move. */
  function revealBy(card){
    if (!card.isConnected || !card.getClientRects().length) return 0;
    const bar = document.getElementById('topbar'), top = bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
    const r = card.getBoundingClientRect(), h = card.querySelector(':scope > .an-head').getBoundingClientRect(), bot = window.innerHeight;
    if ((h.top >= top && h.bottom <= bot) || (r.top <= top && r.bottom >= bot)) return 0;
    const M = 12, fits = r.height + 2*M <= bot - top;
    return fits && r.top > top ? r.bottom + M - bot : r.top - M - top;
  }
  // The card is rebuilt for the other kind in place; the module keeps what the kind left
  // had (build's prev) and gives it back if the card turns into it again.
  function switchKind(a, type){
    if (type === a.type || !kinds[type]) return;
    const card = live.get(a.id), from = a.type;
    a.type = type;
    buildCard(a, c=> card.replaceWith(c), from);
    afterChange();
    if (o.switched) o.switched(a, from);
    o.commit();
  }
  if (o.addBtn) o.addBtn.addEventListener('click', ()=> several ? menu.open(o.addBtn, add, { centre: true }) : add(types[0]));

  /* A card whose id and kind are both still there is kept, and its panel restored (keep),
     so an undo does not rebuild the whole list; any other is built afresh. A kept record
     is updated in place: the card's handlers hold on to it. */
  // A kind is one of this deck's own (to v496 'constructor' or 'toString', inherited by the
  // kinds' object, passed for one), an id a whole number up to 1e6 (to v496 any integer,
  // and 1e308 made element ids no selector reads and nextId give the same id twice).
  const isKind = t => Object.prototype.hasOwnProperty.call(kinds, t);
  const okId = id => Number.isInteger(id) && id >= 1 && id <= 1e6;
  /* An undo or a redo (step) animates what it changes: a fold as the arrow does, a card
     brought back growing in its place, one taken away shrinking out of it (a card turned
     into another kind is rebuilt in place, as a switch is, and a move only puts the cards in
     order); the motion reduced, nothing. Up to v503 a step put each as it was at once. */
  function load(list, read, keep){
    list = list.filter(s=> s && (s.type == null || isKind(s.type)));
    // (the cards in the page before: one not among them that an undo or a redo brings is
    // brought into view, the first of them)
    const step = stepping(), motion = step && !reduced(), was = new Set(live.keys());
    if (!step) quiet();
    const p = step ? later() : null;
    const old = new Map(recs.map(a=> [a.id, a]));
    const seen = new Set();
    let free = list.reduce((m, s)=> okId(s.id) ? Math.max(m, s.id) : m, 0) + 1;
    const next = list.map(src=>{
      const s = { base: typeof src.base === 'string' ? src.base : '', nameAuto: src.nameAuto !== false, name: '', collapsed: src.collapsed === true,
        ...read(src), id: src.id, type: isKind(src.type) ? src.type : types[0] };
      if (!okId(s.id) || seen.has(s.id)) s.id = free++;
      seen.add(s.id);
      const a = old.get(s.id);
      if (a && a.type === s.type && live.has(a.id)){
        old.delete(a.id);
        // (a fold under way to where the state has it is left to end)
        const card = live.get(a.id), flip = card.classList.contains('is-folded') !== s.collapsed;
        Object.assign(a, s);
        keep(a);
        if (!motion) applyFold(a);
        else if (flip){ p.go.push(foldCard(card, a.collapsed)); syncFoldButton(a); }
        if (step && flip && a.collapsed && o.folded) o.folded(a);
        return a;
      }
      return s;
    });
    // Left in `old`: gone, or back as another kind (its id still there).
    const ids = new Set(next.map(s=> s.id));
    old.forEach(a=> unmount(a, motion && !ids.has(a.id)));
    recs = next;
    recs.forEach(a=>{ if (!live.has(a.id)) mount(a, motion && !was.has(a.id) ? p : null); });
    placeCards();
    afterChange(true);
    if (step && !p.back) p.back = recs.find(a=> !was.has(a.id)) || null;
  }
  // What a record saves of itself (the module adds its panel's).
  const saved = a => ({ id: a.id, type: a.type, base: a.base, nameAuto: a.nameAuto, collapsed: a.collapsed });

  return {
    get records(){ return recs; },
    byId, cardOf, isFolded, add, remove, load, saved, refreshNames, fitName,
    fitNames(){ recs.forEach(fitName); },
    // The first cards of a new project, built as they are added but quietly (no history).
    start(typesList){ recs = []; typesList.forEach(t=>{ const a = newRec(t); recs.push(a); mount(a); }); refreshNames(); },
    destroy(){ quiet(); if (menu) menu.destroy(); },
  };
}
