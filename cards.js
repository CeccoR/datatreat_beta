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
function kindMenu(kinds){
  const el = document.createElement('div');
  el.className = 'an-menu';
  el.setAttribute('role', 'menu');
  el.hidden = true;
  el.innerHTML = Object.entries(kinds).map(([k, l])=> `<button type="button" role="menuitem" data-kind="${esc(k)}">${esc(l)}</button>`).join('');
  document.body.appendChild(el);
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
  }, true);
  document.addEventListener('keydown', e=>{
    if (e.key === 'Escape' && !el.hidden){ e.stopPropagation(); close(); }
  }, true);
  window.addEventListener('scroll', ()=>{ if (!el.hidden) place(); }, true);
  window.addEventListener('resize', ()=>{ if (!el.hidden) place(); });
  return { open, close };
}

/* Folding animates the body's height. The card is marked folded from the start, so its
   panel stops drawing at once; .an-anim keeps the body laid out (and clipped) until the
   animation ends. One taken over midway starts from where it got to. */
// Long enough, at ~600 px of body, to read as a slide rather than a jump; the curve
// starts briskly and settles gently, and the content fades as it goes.
export const FOLD_MS = 320;
const FOLD_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
function animateFold(card, fold){
  const body = card.querySelector(':scope > .an-body');
  if (!body._anim && card.classList.contains('is-folded') === fold) return;
  const from = body.getBoundingClientRect().height, fromO = +getComputedStyle(body).opacity;
  if (body._anim){ body._anim.cancel(); body._anim = null; }
  card.classList.toggle('is-folded', fold);
  card.classList.add('an-anim');
  const to = fold ? 0 : body.getBoundingClientRect().height;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(to - from) < 1){ card.classList.remove('an-anim'); return; }
  const an = body.animate([{ height: from + 'px', opacity: fold ? fromO : Math.min(fromO, 0.2) }, { height: to + 'px', opacity: fold ? 0 : 1 }],
    { duration: FOLD_MS, easing: FOLD_EASE });
  body._anim = an;
  an.onfinish = ()=>{ if (body._anim === an){ body._anim = null; card.classList.remove('an-anim'); } };
}

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
     wake(rec)                  a card unfolded: bring it up to date (it was not drawn folded)
     commit()                   a step of the undo history
   } */
export function createDeck(o){
  let recs = [];
  const live = new Map();       // id → card element
  const kinds = o.kinds, types = Object.keys(kinds), several = types.length > 1;
  const menu = several ? kindMenu(kinds) : null;

  const nextId = ()=> recs.reduce((m, a)=> Math.max(m, a.id), 0) + 1;
  const newRec = type => ({ id: nextId(), type, base: '', nameAuto: true, name: '', collapsed: false, ...(o.make ? o.make(type) : {}) });
  const byId = id => recs.find(a=> a.id === id) || null;
  const cardOf = a => live.get(a.id) || null;
  const isFolded = a => live.has(a.id) && live.get(a.id).classList.contains('is-folded');

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
  const mount = a => buildCard(a, card=> o.list.insertBefore(card, o.addBar));
  function unmount(a){
    const card = live.get(a.id);
    if (!card) return;
    card.remove();
    live.delete(a.id);
    o.drop(a);
  }
  const placeCards = ()=> recs.forEach(a=> o.list.insertBefore(live.get(a.id), o.addBar));

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
  // A restore puts the folds where they were, without the animation.
  function applyFold(a){
    const card = live.get(a.id), body = card.querySelector(':scope > .an-body');
    if (body._anim){ body._anim.cancel(); body._anim = null; }
    card.classList.remove('an-anim');
    card.classList.toggle('is-folded', a.collapsed);
    syncFoldButton(a);
  }
  function setFold(a, folded){
    a.collapsed = folded;
    syncFoldButton(a);
    animateFold(live.get(a.id), folded);
    if (!folded && o.wake) o.wake(a);
    o.commit();
  }

  /* Moving: the grip picks the card up. Every card folds for the move, so the list is
     short enough to see whole; the card held follows the pointer and the others make
     way as it passes their middles. On release each card gets back the fold it had.
     While the cards fold, and again while they unfold, the page scrolls to keep the
     card held where it is on screen: the folds would otherwise pull the list out of
     view, above it or below it. */
  let moving = null;
  const scrollNow = dy =>{ if (dy) window.scrollBy({ top: dy, behavior: 'instant' }); };
  function holdInView(card, ms){
    const y0 = card.getBoundingClientRect().top, end = performance.now() + ms;
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
    recs.forEach(x=> animateFold(live.get(x.id), true));
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
    holdInView(m.card, FOLD_MS + 40);
    recs.forEach(x=>{ if (!x.collapsed) animateFold(live.get(x.id), false); });
    if (order.join() !== was){ afterChange(); o.commit(); }
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
  function load(list, read, keep){
    list = list.filter(s=> s && (s.type == null || kinds[s.type]));
    const old = new Map(recs.map(a=> [a.id, a]));
    const seen = new Set();
    let free = list.reduce((m, s)=> Number.isInteger(s.id) ? Math.max(m, s.id) : m, 0) + 1;
    const next = list.map(src=>{
      const s = { base: typeof src.base === 'string' ? src.base : '', nameAuto: src.nameAuto !== false, name: '', collapsed: src.collapsed === true,
        ...read(src), id: src.id, type: kinds[src.type] ? src.type : types[0] };
      if (!Number.isInteger(s.id) || s.id < 1 || seen.has(s.id)) s.id = free++;
      seen.add(s.id);
      const a = old.get(s.id);
      if (a && a.type === s.type && live.has(a.id)){
        old.delete(a.id);
        Object.assign(a, s);
        keep(a);
        applyFold(a);
        return a;
      }
      return s;
    });
    // Left in `old`: gone, or back as another kind.
    old.forEach(a=> unmount(a));
    recs = next;
    recs.forEach(a=>{ if (!live.has(a.id)) mount(a); });
    placeCards();
    afterChange(true);
  }
  // What a record saves of itself (the module adds its panel's).
  const saved = a => ({ id: a.id, type: a.type, base: a.base, nameAuto: a.nameAuto, collapsed: a.collapsed });

  return {
    get records(){ return recs; },
    byId, cardOf, isFolded, add, remove, load, saved, refreshNames, fitName,
    fitNames(){ recs.forEach(fitName); },
    // The first cards of a new project, built as they are added but quietly (no history).
    start(typesList){ recs = []; typesList.forEach(t=>{ const a = newRec(t); recs.push(a); mount(a); }); refreshNames(); },
  };
}
