/* =========================================================
   SEM — the words and markup that need no page (sem.js puts them in the tab; tests/
   semmodel.test.mjs reads them in Node): a file's line in the alerts, the alerts under
   the drop zone, the Image box (an image's header, its crop and what the figure takes of
   it), the groups' boxes, the options of the settings' scope and of the reference, and the
   chain on a thumbnail. Taken out of v557's sem.js as they were: the same markup to the
   byte.
   What they need from the page is handed in, u = { esc, fileAlertHtml } (utils.js's:
   sem.js HU).
========================================================= */
import { sig, magText, byId, inFigure } from './sem-model.js';

// The chain on a thumbnail: its crop linked to the other linked images'.
export const LINK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>';

/* ---- Alerts ---- */
// A file in the alerts: its name, and what is said of it, a full stop after (utils.js
// fileLine; to v566 "{name} — {why}").
export const fileLine = (u, name, why) => `${u.esc(name)}: ${u.esc(why)}${/[.?!]$/.test(why) ? '' : '.'}`;
/* The alerts of a line (sem-model.js alertsNow: A) about the files in the list now (their
   ids, here): each about files, those it names (an image loaded with a warning, the image
   a file dropped is a copy of), or, for the refused and the unreadable, which name files
   never loaded, those in the list when it was made (none: while the list is empty). One
   box a kind (utils.js FILE ALERTS), in the order error, warning, info: the files refused
   (or, a project opened, those left out: `A.bad.opened`, a warning), those loaded to
   check, those already loaded. */
export function alertsHtml(u, A, here){
  const dup = A.dup.filter(a=> here.has(a.id)), warn = A.warn.filter(a=> here.has(a.id));
  const bad = A.bad && (A.bad.ids.length ? A.bad.ids.some(id=> here.has(id)) : !here.size);
  return (bad ? u.fileAlertHtml(A.bad.opened ? 'opened' : 'bad', A.bad.names, 'sem-dismiss-invalid') : '')
    + u.fileAlertHtml('check', warn.map(a=> a.html), 'sem-dismiss-warn')
    + u.fileAlertHtml('dup', dup.map(a=> a.html), 'sem-dismiss-upload');
}
// The images a project opened left out, their bytes no longer reading as a Tescan TIFF.
export const lostLine = n => `${n} file${n > 1 ? 's' : ''} left out: ${n > 1 ? 'their' : 'its'} stored bytes no longer read.`;

/* ---- The Image box ----
   An image's header (r: sem-read.js readTescanTiff's numbers), its crop, and what the
   figure takes of it in its group (o: sem-model.js outOf, null where none; narrowed, at its
   pixel). */
export function infoHtml(u, f, r, o){
  const { esc } = u;
  const q = r.squared;
  // Pixels made square (sem-read.js squarePixels): the image as it is now, and as acquired.
  const rows = [
    ['Image', `${r.width} × ${r.imageH} px${q ? `, ${q.width} × ${q.imageH} px as acquired` : ''}${r.strip ? ` (info bar of ${r.strip} rows left out)` : ''}`],
    ['Pixel size', `${sig(r.pixelNm, 4)} nm${q ? `, square: resampled from ${sig(q.pixelNmX, 4)} × ${sig(q.pixelNmY, 4)} nm pixels` : ''}`],
    ['Field of view', `${sig(r.fovUm, 4)} µm`],
    ['Magnification', magText(r) || '—'],
    ['Beam', `${sig(r.kV, 3)} kV · WD ${sig(r.wdMm, 3)} mm`],
    ['Detector', `${esc(r.detector || '—')} · gain ${sig(r.gain, 4)}, offset ${sig(r.offset, 4)}`],
    ['Acquired', esc(`${r.date} ${r.time}`.trim() || '—') + (r.device ? ` · ${esc(r.device)}` : '')],
  ];
  // The crop, and what the figure takes of it in its group (narrowed, at its pixel).
  const c = f.crop, um = v => sig(v*r.pixelNm/1000, 4);
  // (narrowed to fit the image: an info, v567; to v566 "⚠")
  rows.push(['Crop', `${esc(c.w)} × ${esc(c.h)} px, ${um(c.w)} × ${um(c.h)} µm${f.clamped ? ' <span class="sem-note-info">ⓘ narrowed to fit</span>' : ''}`]);
  if (o) rows.push(['In the figure', `${esc(o.w)} × ${esc(o.h)} px at ${sig(o.px, 4)} nm${o.c.w !== c.w || o.c.h !== c.h ? `, ${um(o.c.w)} × ${um(o.c.h)} µm of the crop` : ''}`]);
  return rows.map(([k, v])=> `<div class="sem-info-row"><span class="txt-meta">${k}</span><span>${v}</span></div>`).join('')
    + (r.warning ? `<div class="alert warn" style="margin-top:8px">⚠ ${esc(r.warning)}</div>` : '');
}

/* ---- The groups ----
   A group's box: its name (plain text, a field on hover and while edited, as the
   project's name), its scale and its figure on one side; its images in one row on
   the other, scrolling sideways when they do not fit, each with its name under it.
   An empty group says where its images go, its figure disabled. A group whose images
   are all out of the figure (unticked, or the reference only) is not shown. */
export function groupsHtml(u, S){
  return S.groups.map(g=>{
    const mem = g.members.map(id=> byId(S, id)).filter(m=> m && inFigure(m));
    if (!mem.length && g.members.length) return '';
    const empty = !mem.length;
    return `<div class="sem-group${empty ? ' is-empty' : ''}" data-g="${u.esc(g.id)}" data-drop="${u.esc(g.id)}">
        <div class="sem-group-head">
          <input type="text" class="sem-group-name" data-g="${u.esc(g.id)}" value="${u.esc(g.name)}" placeholder="Group name" spellcheck="false" aria-label="Group name" title="The group's name, on its figure and its file. Emptied, it goes back to the magnification">
          <div class="sem-group-acts">
            <div class="sem-scale" role="radiogroup" aria-label="Scale">${[['common', 'common scale', 'One scale for the group: its images brought to its largest pixel size and smallest field, one scale bar'], ['own', 'own scale', 'Each image its own pixels and crop, and its own scale bar']].map(([v, t, tip])=>
              `<label class="sem-radio" title="${tip}"><input type="radio" class="sem-group-mode" name="semScale-${u.esc(g.id)}" data-g="${u.esc(g.id)}" value="${v}"${g.mode === v ? ' checked' : ''}> ${t}</label>`).join('')}</div>
            <button class="btn primary btn-sm sem-group-fig" type="button" data-fig="${u.esc(g.id)}"${empty ? ' disabled title="No images in this group yet"' : ' title="Lay this group\'s images out into a figure"'}>Figure composer</button>
          </div>
        </div>
        <div class="sem-strip">
          <button class="sem-page sem-page-prev" type="button" data-page="-1" aria-label="Previous images" hidden>&#8249;</button>
          <div class="sem-group-imgs">${empty
            ? `<div class="sem-group-hint txt-meta">Empty: drag images here. <button class="btn btn-sm" type="button" data-del="${u.esc(g.id)}" title="Remove this empty group">Remove</button></div>`
            : mem.map(m=> `<div class="sem-gimg" data-id="${u.esc(m.raw.id)}" title="${u.esc(m.label)}"><div class="sem-gimg-pic"></div><span class="sem-thumb-cap">${u.esc(m.label)}</span></div>`).join('')}</div>
          <button class="sem-page sem-page-next" type="button" data-page="1" aria-label="Next images" hidden>&#8250;</button>
        </div>
      </div>`;
  }).join('');
}

/* ---- The settings' choices ---- */
// The scope: All, and the groups shown (those with images in the figure, gs; to v476 also
// one whose images were all excluded: hidden, and its choice went back at once).
export const scopeHtml = (u, gs) => `<option value="all">All</option>` + gs.map(g=> `<option value="${u.esc(g.id)}">${u.esc(g.name)}</option>`).join('');
// The reference: every image of the list.
export const refHtml = (u, files) => files.map(g=> `<option value="${u.esc(g.raw.id)}">${u.esc(g.label)}</option>`).join('');
