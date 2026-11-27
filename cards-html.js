/* =========================================================
   ANALYSIS CARDS — their markup, which needs no page (cards.js puts it in the deck's
   cards and its kinds' menu; tests/cardsmodel.test.mjs reads it in Node): the icons of a
   card's head, the menu's kinds, a card's head, name field and body. Taken out of v561's
   cards.js as it was: the same markup to the byte.
   What it needs from the page is handed in, u = { esc, X_SVG } (utils.js's: cards.js HU).
========================================================= */
export const INFO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none"/></svg>';
export const GRIP_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="5" y1="7" x2="19" y2="7"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="5" y1="17" x2="19" y2="17"/></svg>';
export const CHEVRON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

// The kinds' menu: a button a kind, in the kinds' order.
export const menuHtml = (kinds, u)=> Object.entries(kinds).map(([k, l])=> `<button type="button" role="menuitem" data-kind="${u.esc(k)}">${u.esc(l)}</button>`).join('');

/* A card: the title is the kind, chosen in place (switchable; else plain text); the name
   sits under it and stays in view when the card is folded, the instructions open under
   the name. The module's instructions (o.info) and body (o.body: its elements' ids
   prefixed 'an' + rec.id), in that order. */
export function cardHtml(a, switchable, kinds, title, o, u){
  const kind = switchable
    ? `<button type="button" class="an-type" data-kind="${u.esc(a.type)}" aria-haspopup="menu" aria-expanded="false" title="Change the kind of analysis">${u.esc(kinds[a.type])}</button>`
    : `<span class="an-type is-fixed">${u.esc(kinds[a.type])}</span>`;
  return `
        <div class="an-head">
          <button type="button" class="an-ic an-grip" title="Drag to move this analysis" aria-label="Move analysis">${GRIP_SVG}</button>
          <h3 class="txt-head an-title">${u.esc(title)}<span class="an-kind">${kind}<button type="button" class="instr-info" aria-label="Toggle instructions" aria-expanded="false">${INFO_SVG}</button></span></h3>
          <span class="an-acts">
            <button type="button" class="an-ic an-close" title="Close this analysis" aria-label="Close analysis">${u.X_SVG(15)}</button>
            <button type="button" class="an-ic an-fold">${CHEVRON_SVG}</button>
          </span>
        </div>
        <input type="text" class="an-name" spellcheck="false" aria-label="Analysis name" title="The analysis name: its charts and files are named after it. Left empty, it goes back to the automatic one.">
        <div class="an-body">
          <div class="instr-block an-instr" style="display:none">${o.info(a.type)}</div>
          ${o.body(a)}
        </div>`;
}
// A card's fold button's words, folded or not.
export const foldWords = collapsed => ({ title: collapsed ? 'Unfold this analysis' : 'Fold this analysis', label: collapsed ? 'Unfold analysis' : 'Fold analysis' });
