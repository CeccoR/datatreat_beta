/* =========================================================
   XRPD — the host's words and markup that need no page (xrd.js puts them in the standard's
   two windows and the alerts under the drop zone; tests/xrdmodel.test.mjs reads them in
   Node): a standard's window, the standard's file in it, the alerts of a file dropped
   there, of a drop on the samples' zone and of a project restored. Taken out of v562's
   xrd.js as they were: the same markup to the byte.
   What they need from the page is handed in, u = { esc, X_SVG, buildAlertsHtml } (utils.js's:
   xrd.js HU).
========================================================= */

/* ---- The instrumental standard's windows ---- */
// A window (its id, its title, its instructions): a head with its ×, what is under it
// scrolling (the instructions, the drop zone of the one file, the alerts, the file, the
// body its card's panel is built in).
export const stdModalHtml = (id, title, info, u)=> `
    <div class="xrd-std-box" role="dialog" aria-modal="true" aria-labelledby="${id}Title" tabindex="-1">
      <div class="xrd-std-head">
        <h3 class="txt-head" id="${id}Title">${title}<button type="button" class="instr-info" aria-label="Toggle instructions" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none"/></svg></button></h3>
        <button type="button" class="an-ic xrd-std-x" title="Close" aria-label="Close">${u.X_SVG(15)}</button>
      </div>
      <div class="xrd-std-scroll">
        <div class="instr-block xrd-std-instr" style="display:none">${info}</div>
        <div class="dropzone xrd-std-dz" id="${id}Dz">
          <div class="dz-icon">⤒</div>
          <div class="dz-title">Drag here the standard's file, or click to select it.</div>
          <div class="txt-meta">.xrdml, .xml · one file: it replaces the one loaded</div>
          <input type="file" id="${id}Files" accept=".xrdml,.xml" style="display:none">
        </div>
        <div class="xrd-std-alerts"></div>
        <div class="xrd-std-file"></div>
        <div class="xrd-std-body"></div>
      </div>
    </div>`;
// The standard's file in both windows: its whole name (the plot under it has no
// caption: it is the one file), and × to take it away.
export const stdFileHtml = (stdFile, u)=> stdFile
  ? `<div class="xrd-std-row"><span class="txt-mini">Standard</span><span class="xrd-std-name">${u.esc(stdFile.name)}</span><button type="button" class="peak-del is-danger idle-dim" data-std-del title="Remove the standard">${u.X_SVG(13)}</button></div>` : '';
/* A file dropped on a window, the standard now (its name, the files dropped: n; its scans
   and the one taken, k; the pattern's name and its notes): the others not used, its
   caveats. */
export const stdDropAlerts = (n, name, scans, k, pname, notes, u)=> (n > 1 ? u.buildAlertsHtml([], [u.esc(`${n} files dropped: the first, ${name}, is the standard`)], 'One file at a time:') : '')
  + (scans > 1 ? u.buildAlertsHtml([], [u.esc(`${name}: ${scans} scans: the standard is ${k ? `scan ${k+1}, the first that could be read` : 'the first'}, the others are not used`)], 'One pattern:') : '')
  + (notes.length ? u.buildAlertsHtml([], notes.map(t=> u.esc(`${pname}: ${t}`)), 'Loaded, with a caveat:') : '');

/* ---- The alerts under the samples' drop zone ---- */
// A file of several scans dropped: each a pattern (k of them loaded, of n).
export const scansNote = (name, n, k)=> `${name}: ${n} scans, ${k === n ? '' : k + ' of them loaded, '}each a pattern of its own`;
// A drop's alerts (its lines escaped): the files refused, the caveats, those already loaded.
export const dropAlerts = (invalid, notes, already, u)=> ({
  load: invalid.length ? u.buildAlertsHtml(invalid, [], undefined, 'xrd-dismiss-invalid') : '',
  note: notes.length ? u.buildAlertsHtml([], notes, 'Loaded, with a caveat:', '', 'xrd-dismiss-notes') : '',
  upload: already.length ? u.buildAlertsHtml([], already, 'Already loaded file(s):', '', 'xrd-dismiss-upload') : '' });
/* A project restored: the files read again whose data changed (each read's note), those
   with no pattern to show, left out (lost, and the standard where the state has one,
   hasStd, but it was not read); '' none. */
export function restoredAlert(reads, stdRead, lost, hasStd, u){
  const notes = [...reads, ...(stdRead ? [stdRead] : [])].filter(r=> r && r.note).map(r=> u.esc(`${r.f.label || r.f.name}: ${r.note}.`));
  if (lost || (hasStd && !stdRead)) notes.push(u.esc(`${lost ? `${lost} file${lost > 1 ? 's' : ''}` : ''}${lost && hasStd && !stdRead ? ' and ' : ''}${hasStd && !stdRead ? 'the standard' : ''} in the project with no pattern to show (no 2θ and intensities): left out.`));
  return notes.length ? u.buildAlertsHtml([], notes, 'Restored, with a caveat:', '', 'xrd-dismiss-notes') : '';
}
