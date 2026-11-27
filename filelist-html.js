/* =========================================================
   The trace list's markup (v564, out of utils.js renderUnifiedFileList): the table every
   module's list is, its head and a row a trace, plain functions with no page. utils.js's
   helpers are handed in as U (esc, X_SVG, DL_SVG, isIncluded, fileOf). What the list is, what its
   callbacks are and what it does: utils.js, UNIFIED TRACE LIST RENDERER; its calculations:
   filelist-model.js.
========================================================= */

/* The columns, the same in every module: drag and include box fixed 26px each, side by
   side at the left edge; actions fixed 58px (a fixed width guarantees the download+remove
   icons fit even on narrow phones); LABEL (its colour and its name's field), FILE and the
   note, with no header but the module's (GC's SAMPLE), share what those leave as
   3 : 3 : 2. Their percentages add up to 100%, more than is left, and a fixed table
   layout scales them to it, the px columns kept. To v531 the list was of files: FILE
   (the colour, the name) then LABEL; v532–v533 headed the names TRACE, LABEL again
   from v534. */
const COLGROUP = `<colgroup><col style="width:26px"><col style="width:26px"><col style="width:37.5%"><col style="width:37.5%"><col style="width:25%"><col style="width:58px"></colgroup>`;
// The row's handle: three lines.
const GRIP = `<svg class="grip-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><line x1="2.5" y1="5" x2="13.5" y2="5"/><line x1="2.5" y1="8" x2="13.5" y2="8"/><line x1="2.5" y1="11" x2="13.5" y2="11"/></svg>`;
// A file's own grip inside a row (callbacks.parts): six dots, smaller than the row's ≡.
export const FGRIP = `<svg viewBox="0 0 10 14" width="8" height="12" fill="currentColor" aria-hidden="true"><circle cx="3" cy="3" r="1.15"/><circle cx="7" cy="3" r="1.15"/><circle cx="3" cy="7" r="1.15"/><circle cx="7" cy="7" r="1.15"/><circle cx="3" cy="11" r="1.15"/><circle cx="7" cy="11" r="1.15"/></svg>`;

/* The head: the include-all box (ticked with any trace in: nIn of them), the palette's
   button where a trace has a colour (else its place, empty), LABEL, FILE, the note's
   header (noteHead, plain text) and the download-all and remove-all buttons; then the
   body opens. */
export function headHtml(nIn, anyColor, noteHead, U){
  let html = `<div class="table-wrap-box"><table class="file-table">${COLGROUP}<thead><tr><th></th><th class="incl-cell"><input type="checkbox" class="incl-all"${nIn ? ' checked' : ''} title="Include all traces in the analysis, or none"></th><th><div class="file-head">${anyColor ? '<button class="palette-pick-btn" title="Apply color palette"></button>' : '<span class="palette-pick-btn swatch-gap" aria-hidden="true"></span>'}<span>LABEL</span></div></th>`;
  html += `<th>FILE</th><th class="note-cell"${noteHead ? ` title="${U.esc(noteHead)}"` : ''}>${noteHead ? U.esc(noteHead) : ''}</th>`;
  html += `<th class="row-acts" style="text-align:right;white-space:nowrap"><button class="download-all del-bare dl-bare" title="Download all files (zip)">${U.DL_SVG(15)}</button><button class="remove-all del-bare is-danger" title="Remove all">${U.X_SVG(15)}</button></th></tr></thead><tbody>`;
  return html;
}

// FILE of a row of several files (callbacks.parts): each on a line of its own with its grip,
// one of a kind its pair cannot use (`warn`) said in its title and marked.
export function partsHtml(parts, i, U){
  const { esc } = U;
  return `<td class="fname fname-parts" title="${esc(parts.map(p=> p.name).join(' + '))}"><span class="fname-inner fparts">${parts.map((p, k)=>
    `<span class="fpart${p.warn ? ' is-warn' : ''}" data-i="${i}" data-p="${k}"${p.warn ? ` title="${esc(p.name + ': ' + p.warn)}"` : ` title="${esc(p.name)}"`}><span class="fpart-grip" title="Drag onto another file to pair it with that one (onto a file already paired: the two swap)" aria-hidden="true">${FGRIP}</span><span class="fname-text">${esc(p.name)}</span></span>`).join('')}</span></td>`;
}

/* A trace's row (its i in the list): the handle, its box, its colour (none: its place,
   empty) and its name's field under the tooltip callbacks.tip gives, FILE (its parts, or its
   file), the note, its download and its ×. The callbacks are asked in that order: tip,
   parts, note. */
export function rowHtml(f, i, callbacks, note, U){
  const { esc } = U;
  const swatch = f.color ? `<button class="color-swatch" data-i="${i}" data-color="${esc(f.color)}" style="background:${esc(f.color)}" title="Pick color"></button>` : '<span class="color-swatch swatch-gap" aria-hidden="true"></span>';
  const on = U.isIncluded(f), file = U.fileOf(f);
  let html = `<tr class="file-row${on ? '' : ' is-excluded'}" data-i="${i}">`;
  html += `<td class="drag-cell"><span class="drag-handle" title="Drag to reorder">${GRIP}</span></td>`;
  html += `<td class="incl-cell"><input type="checkbox" class="file-incl" data-i="${i}"${on ? ' checked' : ''} title="Include in the analysis"></td>`;
  const tip = callbacks.tip ? callbacks.tip(f, i) : '';
  html += `<td class="trace-cell"${tip ? ` title="${esc(tip)}"` : ''}><span class="trace-inner">${swatch}<input type="text" class="label-input file-label" data-i="${i}" value="${esc(f.label)}" aria-label="Trace name"></span></td>`;
  const parts = callbacks.parts ? callbacks.parts(f, i) : null;
  if (parts) html += partsHtml(parts, i, U);
  else html += `<td class="fname" title="${esc(file)}"><span class="fname-inner"><span class="fname-text">${esc(file)}</span></span></td>`;
  html += `<td class="note-cell">${note ? note(f, i) : ''}</td>`;
  html += `<td class="row-acts" style="text-align:right;white-space:nowrap"><button class="dl-file del-bare dl-bare idle-dim" data-i="${i}" title="Download its file">${U.DL_SVG(15)}</button><button class="del del-bare row-del is-danger idle-dim" data-i="${i}" title="Remove">${U.X_SVG(15)}</button></td>`;
  return html + `</tr>`;
}

/* The whole list: its head, a row a trace, and, with every trace left out (nIn none), why
   no card follows it: nothing is analysed. */
export function listHtml(files, callbacks, note, noteHead, nIn, U){
  let html = headHtml(nIn, files.some(f=> f.color), noteHead, U);
  files.forEach((f, i)=>{ html += rowHtml(f, i, callbacks, note, U); });
  html += `</tbody></table></div>`;
  if (!nIn) html += `<p class="txt-meta file-none">No trace is included in the analysis.</p>`;
  return html;
}
