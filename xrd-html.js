/* =========================================================
   XRPD — the host's words and markup that need no page (xrd.js puts them in the standard's
   two windows and the alerts under the drop zone; tests/xrdmodel.test.mjs reads them in
   Node): a standard's window, the standard's file in it, the alerts of a file dropped
   there, of a drop on the samples' zone, of the files in the list and of a project
   restored. Taken out of v562's xrd.js as they were: the same markup to the byte.
   What they need from the page is handed in, u = { esc, X_SVG, fileAlertHtml, fileLine }
   (utils.js's: xrd.js HU).
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
   and the one taken, k; the pattern's name and its notes): its caveats to check, and how
   it was taken, the others not used (an info, v567: to v566 warnings of their own). */
export function stdDropAlerts(n, name, scans, k, pname, notes, u){
  const say = notes.map(t=> ({ t: u.esc(u.fileLine(pname, t)), read: isReadNote(t) }));
  return u.fileAlertHtml('check', say.filter(x=> !x.read).map(x=> x.t))
    + u.fileAlertHtml('read', [...(n > 1 ? [u.esc(`${n} files dropped: the first, ${name}, is the standard; the others are not used.`)] : []),
      ...(scans > 1 ? [u.esc(`${name}: ${scans} scans: the standard is ${k ? `scan ${k+1}, the first that could be read` : 'the first'}; the others are not used.`)] : []),
      ...say.filter(x=> x.read).map(x=> x.t)]);
}

/* ---- The alerts under the samples' drop zone (utils.js FILE ALERTS) ---- */
// A file of several scans: each a pattern (k of them in the list, of n).
export const scansNote = (name, n, k)=> `${name}: ${n} scans, ${k === n ? '' : k + ' of them loaded, '}each a pattern of its own.`;
/* Whether a note of a file loaded (xrd-instr.js readScan's, a file's scans) says how it was
   read, the normal case's choice, nothing to check: a file of several scans, counts over
   unequal times read as counts per second, a time per point estimated from the noise. The
   others (a scan not read, points left out, factors or times missing) are to check. */
export const isReadNote = t => /: \d+ scans, |(^|: )counts over unequal counting times|with no counting time: .* estimated from the noise/.test(t);
/* A drop's alerts (its lines escaped, each "{file}: {what}."): the files refused, those
   already loaded (v567: to v566 every caveat in one warning, "Loaded, with a caveat:"; what
   the reading of the files loaded said, fileNotes, v572). */
export const dropAlerts = (invalid, already, u)=> ({
  load: u.fileAlertHtml('bad', invalid, 'xrd-dismiss-invalid'),
  upload: u.fileAlertHtml('dup', already, 'xrd-dismiss-upload') });
/* What a project opened found in a pattern, to check, or '': read again from its own bytes,
   its arrays changed (xrd-model.js readAgain, oldData: the points left out that an older
   version kept, or its minimum subtracted); no file kept and its lowest point exactly 0. A
   project read in may hold anything: only a whole count, or true, says. */
export function openedNote(f){
  const d = f.oldData, n = d && d.dropped;
  if (Number.isInteger(n) && n > 0) return `read again from the file itself, ${n} point${n > 1 ? 's' : ''} whose values are no finite number left out: the project held ${n > 1 ? 'them' : 'it'}, as an older version did. Results refined before are from those: refine again`;
  if (d && d.minimum === true) return 'read again from the file itself: the project held its data as an older version had read them, with their minimum subtracted. Results refined before are from those: refine again';
  let lo = Infinity; for (const v of f.y || []) if (v < lo) lo = v;
  return !f.rawBytes && lo === 0 ? 'its lowest point is exactly 0 and the project does not hold the file itself: its minimum may have been subtracted, as an older version did, which the Rietveld weights would take for the counts; load the file again' : '';
}
/* What the reading of the files said (alerts.js notes, v572: worked out from the patterns in
   the list, each until its box's ×; to v571 the drop's words and the restore's, gone at the
   next undo and left when their file was removed): of each file, from the scans its bytes
   were read into (`scans(f)`, xrd-model.js keptScans), how many it holds, among them the
   patterns in the list, and those not read (about all its patterns); of each pattern, its
   scan's notes, to check or how it was read (isReadNote), and what a project opened found
   in it (openedNote), the standard's (`std`) too. */
export function fileNotes(all, std, scans, u){
  const out = [], done = new Set(), opened = p =>{ const o = openedNote(p); if (o) out.push({ what: 'opened', line: u.esc(u.fileLine(p.label || p.name, o)), files: [p] }); };
  for (const p of all){
    const sc = scans(p);
    if (sc && !done.has(p.rawBytes)){
      done.add(p.rawBytes);
      const pats = all.filter(q=> q.rawBytes === p.rawBytes), name = p.src || p.name;
      if (sc.length > 1) out.push({ what: 'read', line: u.esc(scansNote(name, sc.length, pats.length)), files: pats });
      sc.forEach((x, k)=>{ if (x.error) out.push({ what: 'check', line: u.esc(u.fileLine(name, `scan ${k+1} not read: ${x.error}`)), files: pats }); });
    }
    const own = sc && sc[Number.isInteger(p.scan) && p.scan >= 0 ? p.scan : 0];
    for (const t of own && own.notes || []) out.push({ what: isReadNote(t) ? 'read' : 'check', line: u.esc(u.fileLine(p.name, t)), files: [p] });
    opened(p);
  }
  if (std) opened(std);
  return out;
}
/* What a project opened left out (no file in the list), beside those notes in its box
   (utils.js notesHtml's `more`): the files with no pattern to show (lost), and the
   standard where the state has one (hasStd) but it was not read (std); '' none. */
export function leftOutLine(lost, hasStd, std, u){
  const gone = hasStd && !std;
  return lost || gone ? u.esc(`${lost ? `${lost} file${lost > 1 ? 's' : ''}` : ''}${lost && gone ? ' and ' : ''}${gone ? 'the standard' : ''} left out: no data in the project.`) : '';
}
