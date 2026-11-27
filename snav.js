import { esc, viewport } from './utils.js';
import { menuAt } from './cards-model.js';

/* =========================================================
   THE SAMPLE SELECTOR (v545; v546: its sizing)
   One selector for every module that steps through its samples, files, images, traces or
   chromatograms: DRS's Tauc and Urbach cards, XRPD's Peaks/Scherrer and Rietveld cards, SEM's
   image, Iodometry's trace, Custom's file in its Data card, GC's Integration card (its file,
   over the chromatogram, and its chromatogram, over the run overview). In a line:
   - `‹ n/N ›`, one group of ONE fixed width everywhere (v546), as wide as `‹ 000/000 ›`
     needs in the app's font (tabular digits), the count centred between the arrows;
   - the name and a small down-arrow after it, as long as the name: it takes the room its
     line has up to the plot's toolbar beside it (style.css keeps the line clear of it; a
     line with no toolbar, up to its edge), and is cut with "…" only where it would reach
     it. The name (the full one in its tooltip) opens a list of every item, to go straight
     to one: the look and the conduct of the app's other menus (the kinds' menu, cards.js:
     `.an-menu`, its anchor lit while it is open, closed by Escape, by a click anywhere else
     or by a choice), with the keyboard too (↑ ↓, Home, End, Enter, Escape, Tab).
   The arrows keep their ids and classes (utils.js SAMPLE_NAV: ← → press the first one on
   show); the count and the name too (the tests read them).
   snavHtml(o) is the markup; snav(el, o) its conduct, given back as { update(), close() }:
   update() writes the count, the name, its tooltip and its colour (`bad`: red) from o's
   callbacks, and repaints the list if it is open.
========================================================= */

/* o: { prev, idx, next, name (ids, each optional), prevCls, nextCls (classes beside
   nav-arrow), what (the item, as the arrows' titles say it: 'sample'), keys (the arrows'
   titles name ← →: true), cls } */
export function snavHtml({ prev, idx, next, name, prevCls = '', nextCls = '', what = 'sample', keys = true, cls = '' } = {}){
  const id = v => v ? ` id="${esc(v)}"` : '';
  const steps = `<span class="snav-steps">`
    + `<button type="button" class="btn nav-arrow${prevCls ? ' ' + prevCls : ''}"${id(prev)} aria-label="Previous ${esc(what)}" title="Previous ${esc(what)}${keys ? ' (&#8592;)' : ''}">&#8249;</button>`
    + `<span${id(idx)} class="pill nav-count">1/1</span>`
    + `<button type="button" class="btn nav-arrow${nextCls ? ' ' + nextCls : ''}"${id(next)} aria-label="Next ${esc(what)}" title="Next ${esc(what)}${keys ? ' (&#8594;)' : ''}">&#8250;</button></span>`;
  const pick = `<button type="button" class="snav-pick" aria-haspopup="listbox" aria-expanded="false" aria-label="Choose a ${esc(what)} from the list">`
    + `<span class="snav-name"${id(name)}>&mdash;</span><span class="snav-caret" aria-hidden="true"></span></button>`;
  return `<div class="snav${cls ? ' ' + cls : ''}">${steps + pick}</div>`;
}

/* The selector's conduct. o: { count() (how many items), index() (the one on show),
   label(i) (its name), title(i) (its tooltip: its name by default), bad(i) (its name red),
   go(i) (show item i) }. The arrows stay the module's own (it wires them as it did). */
export function snav(el, o){
  const pick = el.querySelector('.snav-pick'), nameEl = el.querySelector('.snav-name'), idxEl = el.querySelector('.nav-count');
  const count = ()=> Math.max(0, o.count() | 0);
  const cur = ()=>{ const n = count(), i = o.index() | 0; return n ? Math.min(Math.max(0, i), n - 1) : -1; };
  const titleOf = i => o.title ? o.title(i) : o.label(i);
  let menu = null, ac = null;

  function update(){
    const n = count(), i = cur();
    const t = n ? `${i + 1}/${n}` : '0/0', l = n ? String(o.label(i)) : '—';
    if (idxEl && idxEl.textContent !== t) idxEl.textContent = t;
    if (nameEl.textContent !== l) nameEl.textContent = l;
    const tip = n ? String(titleOf(i)) : '';
    if (nameEl.title !== tip) nameEl.title = tip;
    nameEl.classList.toggle('is-bad', !!(n && o.bad && o.bad(i)));
    pick.disabled = !n;
    if (menu){ if (!n) close(); else paint(); }
  }

  // The list: every item, the one on show marked, the suspicious red, each its full name.
  function paint(){
    const n = count(), i0 = cur(), had = menu.querySelector('[data-i]:focus');
    const focusAt = had ? +had.dataset.i : i0;
    menu.innerHTML = Array.from({ length: n }, (_, i)=>{
      const full = String(titleOf(i)), bad = !!(o.bad && o.bad(i));
      return `<button type="button" role="option" data-i="${i}" aria-selected="${i === i0}" class="${i === i0 ? 'is-current' : ''}${bad ? ' is-bad' : ''}"${full !== String(o.label(i)) ? ` title="${esc(full)}"` : ''}>`
        + `<span class="snav-k">${i + 1}</span><span class="snav-item">${esc(o.label(i))}</span></button>`;
    }).join('');
    const f = menu.querySelector(`[data-i="${Math.min(focusAt, n - 1)}"]`);
    if (had && f) f.focus({ preventScroll: true });
  }
  // Under its anchor (above it where the page has no room below), its left edge on the
  // anchor's, inside the page short of its scrollbars as the kinds' menu (cards-model.js
  // menuAt, v584: to v583 the window's innerWidth and innerHeight, under the scrollbar).
  function place(){
    if (!menu) return;
    if (!pick.isConnected || !pick.getClientRects().length){ close(); return; }
    const v = viewport(), at = menuAt(pick.getBoundingClientRect(), menu.offsetWidth, menu.offsetHeight, v.w, v.h, false);
    menu.style.left = at.left + 'px';
    menu.style.top = at.top + 'px';
  }
  function open(){
    if (menu || !count()) return;
    menu = document.createElement('div');
    menu.className = 'an-menu snav-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', pick.getAttribute('aria-label') || 'Items');
    paint();
    document.body.appendChild(menu);
    pick.classList.add('cp-anchored');
    pick.setAttribute('aria-expanded', 'true');
    place();
    const c = menu.querySelector('.is-current') || menu.querySelector('[data-i]');
    if (c){ c.focus({ preventScroll: true }); c.scrollIntoView({ block: 'nearest' }); }
    ac = new AbortController();
    const signal = ac.signal;
    menu.addEventListener('click', e=>{
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const i = +b.dataset.i, byKey = e.detail === 0;
      close(byKey);
      if (i !== cur()) o.go(i);
      update();
    }, { signal });
    menu.addEventListener('keydown', onKey, { signal });
    document.addEventListener('pointerdown', e=>{ if (menu && !menu.contains(e.target) && !pick.contains(e.target)) close(); }, { capture: true, signal });
    document.addEventListener('keydown', e=>{ if (e.key === 'Escape' && menu){ e.stopPropagation(); e.preventDefault(); close(true); } }, { capture: true, signal });
    window.addEventListener('scroll', e=>{ if (menu && !menu.contains(e.target)) place(); }, { capture: true, signal });
    window.addEventListener('resize', place, { signal });
  }
  // ↑ ↓ Home End move along the list, Enter or Space choose (the button's own click), Tab
  // closes; ← → do nothing here (they would step the samples under the list).
  function onKey(e){
    const items = [...menu.querySelectorAll('[data-i]')], at = items.indexOf(document.activeElement);
    let to;
    if (e.key === 'ArrowDown') to = at < 0 ? 0 : Math.min(items.length - 1, at + 1);
    else if (e.key === 'ArrowUp') to = at < 0 ? items.length - 1 : Math.max(0, at - 1);
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = items.length - 1;
    else if (e.key === 'PageDown') to = Math.min(items.length - 1, Math.max(0, at) + 10);
    else if (e.key === 'PageUp') to = Math.max(0, at - 10);
    else if (e.key === 'Tab'){ e.preventDefault(); close(true); return; }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){ e.preventDefault(); e.stopPropagation(); return; }
    else return;
    e.preventDefault(); e.stopPropagation();
    if (items[to]){ items[to].focus({ preventScroll: true }); items[to].scrollIntoView({ block: 'nearest' }); }
  }
  // (`back`: the focus given back to the name, as after a choice by the keyboard)
  function close(back){
    if (!menu) return;
    if (ac){ ac.abort(); ac = null; }
    menu.remove(); menu = null;
    pick.classList.remove('cp-anchored');
    pick.setAttribute('aria-expanded', 'false');
    if (back && pick.isConnected) pick.focus({ preventScroll: true });
  }
  pick.addEventListener('click', ()=>{ if (menu) close(); else open(); });
  pick.addEventListener('keydown', e=>{ if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !menu){ e.preventDefault(); open(); } });
  update();
  return { update, close };
}
