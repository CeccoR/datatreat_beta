/* =========================================================
   The alert boxes' markup that needs no page (v571, ALERTS-REVIEW.md R1): each kind's
   icon, and the compact box an analysis card says things in, beside what it speaks of.
   utils.js's alertHtml (the boxes with a header and a ×, under the drop zones) takes its
   icons from here; the modules' words-and-markup files (xrd-rv-html.js, gc-integ-html.js,
   iodo-html.js…) take the compact box, which they can import in Node too.
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
