import { setupDropzone, renderUnifiedFileList, includedOf, setIncluded, removeFileAt, moveFileTo, buildAlertsHtml, nextColor, colorOf, setTabLoaded, registerHistory, registerTabRedraw, registerCsvExport, registerBusy, X_SVG } from './utils.js';
import { createRietveld, RV_INFO, RV_STD_INFO } from './xrd-rv.js';
import { createPeakAnalysis, PEAKS_INFO, STD_INFO } from './xrd-peaks.js';
import { readXrdmlScans, decodeXml } from './xrd-instr.js';
import { createDeck, cardInfo, fileSafe } from './cards.js';

// File names and what a file says about itself go into the alerts as text, never as markup.
const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* =========================================================
   XRD MODULE
   The samples' files, and the instrumental standard's (one file, of its own: it is no
   sample); the analysis cards (cards.js), each a Scherrer analysis of the peaks
   (xrd-peaks.js) or a Rietveld refinement (xrd-rv.js), on the same samples, the sample
   on show shared by them all; and the standard's two windows, its peak analysis (the
   Caglioti fit that corrects the Scherrer sizes) and its Rietveld refinement (the
   instrumental profile every sample's refinement takes), each opened from its kind of
   card, both on the one standard's file.
========================================================= */
(function(){
  // Every file loaded, in list order; the analysis sees the included ones, `files`, and
  // the per-file arrays the cards keep are aligned with those.
  let allFiles = []; // {name, label, x[], y[], color}
  let files = [];
  let curIdx = 0;    // the sample every card shows
  let stdFile = null;  // the instrumental standard's file, or none
  let deck = null;     // the cards (cards.js), made once their callbacks exist
  let xrdLoadAlerts = '';
  let xrdNoteAlerts = '';
  let xrdUploadAlerts = '';
  // A scan run downwards (start above end) turned round: the plots, the peak search and
  // the Rietveld card take 2θ ascending (rawBytes keep the file as it was). On loading,
  // and on restoring a project saved by an earlier version that kept the file's order.
  const ascending = f => f.x.length > 1 && f.x[0] > f.x[f.x.length-1]
    ? { ...f, x: f.x.slice().reverse(), y: f.y.slice().reverse(), ...(f.varMul ? { varMul: f.varMul.slice().reverse() } : {}) } : f;
  /* A pattern's 2θ, intensities and variance factors never change once read (a file read
     again gives new ones): frozen, so that the undo history's key of a state (stateKey)
     takes each once, by a hash kept for it, and a view drawn from them is not drawn again
     for a state that holds the same (to v490 every edit wrote them out, 25 ms with 12
     patterns, and every restore, an undo too, copied them anew, each view drawn again).
     A scan's arrays are made so once, 2θ ascending, and shared by the pattern loaded and
     every restore of it; a file's of a project with no bytes are frozen where restored. */
  const frozenArrs = f => { ['x', 'y', 'varMul'].forEach(k=>{ if (Array.isArray(f[k])) Object.freeze(f[k]); }); return f; };
  const scanArrays = sc => sc.arrs || (sc.arrs = frozenArrs(ascending({ x: sc.x, y: sc.y, ...(sc.varMul ? { varMul: sc.varMul } : {}) })));

  // Delegated click handling for dynamically generated alert dismiss buttons.
  document.getElementById('tab-xrd').addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-action]');
    if (!btn || !document.getElementById('tab-xrd').contains(btn)) return;
    if (btn.dataset.action === 'xrd-dismiss-upload'){ xrdUploadAlerts=''; rebuildXrdAlerts(); }
    if (btn.dataset.action === 'xrd-dismiss-invalid'){ xrdLoadAlerts=''; rebuildXrdAlerts(); }
    if (btn.dataset.action === 'xrd-dismiss-notes'){ xrdNoteAlerts=''; rebuildXrdAlerts(); }
  });
  function rebuildXrdAlerts(){
    document.getElementById('xrdAlerts').innerHTML = xrdLoadAlerts + xrdNoteAlerts + xrdUploadAlerts;
  }

  /* A file read (readXrdmlScans, xrd-instr.js): 2θ, the intensities on the unattenuated
     scale (<intensities> as written, the raw <counts> of XRDML 2.x times the attenuation
     factors) and each point's variance, var(y) = y·varMul, for the counting uncertainty of
     the FWHMs and the Rietveld weights. A file it cannot read (wrong format, not
     well-formed, not a 2θ scan, dropped past the file picker's accept filter) gives the
     reason instead. rawBytes keeps the original bytes for byte-exact re-download; the text
     is decoded from them in the file's own encoding (UTF-16 too, which f.text() is not).
     The raw intensities are kept untouched (no minimum subtraction): the constant offset is
     absorbed by the SNIP background, so the whole pipeline — analysis and fit alike — runs
     on the true raw data and stays consistent with the CSVs.
     Every scan of the file is a pattern (patternsOf); the caller gives each its colour. */
  async function readFile(f){
    const rawBytes = new Uint8Array(await f.arrayBuffer());
    const xml = new DOMParser().parseFromString(decodeXml(rawBytes), 'text/xml');
    const scans = xml.getElementsByTagName('parsererror').length ? [{ error: 'not well-formed XML' }] : readXrdmlScans(xml);
    // (kept by its bytes, as readAgain keeps its readings: up to v490 the first restore
    // after a file was loaded, an undo, read it again)
    reread.set(rawBytes, scans);
    return patternsOf(f.name, rawBytes, scans);
  }
  /* A file's scans, each a pattern of its own: one scan, the file as it was read up to
     v483; several (a series measured in one go), "<file> (scan k)" each, k counting every
     scan of the file, its name the file's with " (scan k)" before the extension (a key of
     the cards' results: one per pattern), the file's bytes shared, and scan (k − 1) and
     src (the file's name) kept for reading it again and for the "already loaded" test (to
     v483 the first scan alone was read, the others never seen). A scan that cannot be read
     is left out (skipped says why); none readable, the file is refused with the reasons.
     → { pats: [{ f, k, notes }], skipped, n } or { error } */
  function patternsOf(name, rawBytes, scans){
    const n = scans.length, base = name.replace(/\.[^.]+$/, ''), ext = name.slice(base.length);
    const ok = scans.map((sc, k)=> ({ sc, k })).filter(q=> !q.sc.error);
    if (!ok.length) return { error: n > 1 ? scans.map((sc, k)=> `scan ${k+1}: ${sc.error}`).join('; ') : scans[0].error };
    const pats = ok.map(({ sc, k })=>{ const a = scanArrays(sc);
      return { k, notes: sc.notes, f: { name: n > 1 ? `${base} (scan ${k+1})${ext}` : name, label: n > 1 ? `${base} (scan ${k+1})` : base,
        x: a.x, y: a.y, rawBytes, ...(n > 1 ? { src: name, scan: k } : {}), ...(sc.meas ? { meas: sc.meas } : {}), ...(a.varMul ? { varMul: a.varMul } : {}) } }; });
    return { pats, n, skipped: scans.map((sc, k)=> sc.error ? `scan ${k+1} not read (${sc.error})` : null).filter(Boolean) };
  }

  /* ---- The samples ---- */
  // Every card's per-sample arrays (a Scherrer card's, and those it keeps while it is a
  // Rietveld one), for the file list to keep aligned with the included files. A file left
  // out holds its entries under the card's keys, the same whichever kind the card is, so
  // they come back with it after a switch (up to v477 the kept ones were 'kA' + id: left
  // out under one kind and taken in under the other, a file's per-sample parameters and
  // peaks started afresh). A file held so by an earlier version is read under either.
  const copyArr = v => Array.isArray(v) ? v.slice() : [];
  const heldAs = sl => ({ ...sl, make: (v, f)=> sl.make(v === undefined && f && f.held ? f.held['k' + sl.key] : v, f) });
  function slots(){
    const out = [];
    cards().forEach(a=>{
      const e = live.get(a.id), key = 'A' + a.id;
      if (a.type === 'scherrer' && e) out.push(...e.inst.slots(key).map(heldAs));
      const s = a.states.scherrer;
      if (a.type !== 'scherrer' && s){
        out.push(...[{ key: key + ':params', arr: s.perParams, make: v=> v ? {...v} : {...s.shared} },
          { key: key + ':manual', arr: s.manualPeaks, make: copyArr },
          { key: key + ':removed', arr: s.removedPeaks, make: copyArr }].map(heldAs));
      }
    });
    return out;
  }
  // The cards stay on the sample they showed when another is left out, taken in, removed or
  // moved; the one on show removed, on the one now in its place (or the last, it was the
  // last). Up to v484 a removal or a move kept the index: the cards showed another sample.
  function stayOn(f){ const k = includedOf(allFiles).indexOf(f); if (k >= 0) curIdx = k; }
  function fileCallbacks(){
    return {
      onRemove(i){ const was = files[curIdx]; removeFileAt(allFiles, i, slots()); stayOn(was); afterFilesChange(); },
      onReorder(from, to){ const was = files[curIdx]; moveFileTo(allFiles, from, to, slots()); stayOn(was); afterFilesChange(); },
      onInclude(i, on){ const was = files[curIdx]; setIncluded(allFiles, i, on, slots()); stayOn(was); afterFilesChange(); },
      onIncludeAll(on){ const was = files[curIdx]; allFiles.forEach((_, j)=> setIncluded(allFiles, j, on, slots())); stayOn(was); afterFilesChange(); },
      onLabelChange(i, v){ allFiles[i].label=v; eachCard(e=> e.inst.redraw()); hist.commit(); },
      onColorChange(i, v){ allFiles[i].color=v; eachCard(e=> e.inst.redraw()); hist.commit(); },
      onPaletteChange(colors){ allFiles.forEach((f,i)=>{ f.color=colors[i%colors.length]; }); afterFilesChange(); },
      onRemoveAll(){
        allFiles.length=0;
        cards().forEach(a=>{ const e = live.get(a.id); if (a.type === 'scherrer' && e) e.inst.clear(); const s = a.states.scherrer; if (a.type !== 'scherrer' && s){ s.perParams = []; s.manualPeaks = []; s.removedPeaks = []; } });
        xrdLoadAlerts=''; xrdNoteAlerts=''; xrdUploadAlerts=''; rebuildXrdAlerts(); afterFilesChange();
      },
    };
  }

  setupDropzone('xrdDropzone', 'xrdFiles', async (fileList)=>{
    // (by the patterns' names: a file of several scans is tested scan by scan, below)
    const existing = new Set(allFiles.map(f=> f.name));
    const alreadyLoaded = [];
    const invalidFiles = [], loadNotes = [];
    for (const f of fileList){
      if (existing.has(f.name)){ alreadyLoaded.push(esc(f.name)); continue; }
      // Each file on its own: one that cannot be read at all (its bytes gone from the disk,
      // anything thrown) is refused with why, the others loaded. Up to v484 a throw ended
      // the batch: the files read before it were in the list, unseen, no card drawn.
      let r;
      try { r = await readFile(f); } catch (e){ r = { error: String(e && e.message || e) }; }
      if (r.error){ invalidFiles.push(esc(`${f.name} (${r.error})`)); continue; }
      // A scan whose name is in the list stays as it is (one of the file's, dropped again
      // after others were removed, or a file loaded under that name: its results by it), the
      // others load; every scan there, the file is already loaded.
      const fresh = r.pats.filter(q=> !(q.f.src && existing.has(q.f.name)));
      if (!fresh.length){ alreadyLoaded.push(esc(f.name)); continue; }
      existing.add(f.name);
      for (const q of r.pats) if (!fresh.includes(q)) alreadyLoaded.push(esc(q.f.name));
      if (r.n > 1) loadNotes.push(esc(`${f.name}: ${r.n} scans, ${fresh.length === r.n ? '' : fresh.length + ' of them loaded, '}each a pattern of its own`));
      for (const t of r.skipped) loadNotes.push(esc(`${f.name}: ${t}`));
      for (const { f: p, notes } of fresh){
        p.color = nextColor(allFiles);
        existing.add(p.name);
        for (const t of notes) loadNotes.push(esc(`${p.name}: ${t}`));
        // A new file comes in included, so it goes last among the included as well.
        allFiles.push(p); files.push(p);
        cards().forEach(a=>{
          const e = live.get(a.id);
          if (a.type === 'scherrer' && e) e.inst.addFile();
          const s = a.states.scherrer;
          if (a.type !== 'scherrer' && s){ s.perParams.push({...s.shared}); s.manualPeaks.push([]); s.removedPeaks.push([]); }
        });
      }
    }
    xrdLoadAlerts = invalidFiles.length ? buildAlertsHtml(invalidFiles, [], undefined, 'xrd-dismiss-invalid') : '';
    xrdNoteAlerts = loadNotes.length ? buildAlertsHtml([], loadNotes, 'Loaded, with a caveat:', '', 'xrd-dismiss-notes') : '';
    xrdUploadAlerts = alreadyLoaded.length ? buildAlertsHtml([], alreadyLoaded, 'Already loaded file(s):', '', 'xrd-dismiss-upload') : '';
    rebuildXrdAlerts();
    afterFilesChange();
  });

  function afterFilesChange(){
    files = includedOf(allFiles);
    setTabLoaded('xrd', allFiles.length || stdFile ? 1 : 0);
    renderUnifiedFileList('xrdFileTableWrap', allFiles, fileCallbacks());
    if (curIdx >= files.length) curIdx = Math.max(0, files.length-1);
    document.getElementById('xrdAnalyses').style.display = files.length ? 'block' : 'none';
    syncResults();
    eachCard(e=> e.inst.refresh());
    hist.commit(); // baseline + file add/remove/reorder/palette
  }
  // The sample on show, stepped by any card's arrows, for every card.
  function step(d){
    const n = files.length;
    if (!n) return;
    curIdx = (curIdx + d + n) % n;
    eachCard((e, a)=> a.type === 'scherrer' ? e.inst.show() : e.inst.redraw());
  }

  /* ---- The instrumental standard: one file, in two windows ---- */
  const stdFiles = ()=> stdFile ? [stdFile] : [];
  function stdModal(id, title, info){
    const m = document.createElement('div');
    m.id = id;
    m.className = 'modal-backdrop xrd-std-modal';
    m.style.display = 'none';
    m.innerHTML = `
    <div class="xrd-std-box" role="dialog" aria-modal="true" aria-labelledby="${id}Title" tabindex="-1">
      <div class="xrd-std-head">
        <h3 class="txt-head" id="${id}Title">${title}<button type="button" class="instr-info" aria-label="Toggle instructions" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none"/></svg></button></h3>
        <button type="button" class="an-ic xrd-std-x" title="Close" aria-label="Close">${X_SVG(15)}</button>
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
    document.body.appendChild(m);
    const box = m.querySelector('.xrd-std-box'), info0 = m.querySelector('.instr-info'), instr = m.querySelector('.xrd-std-instr');
    info0.addEventListener('click', ()=>{
      const open = instr.style.display === 'none';
      instr.style.display = open ? '' : 'none';
      info0.classList.toggle('is-on', open);
      info0.setAttribute('aria-expanded', String(open));
    });
    m.addEventListener('click', e=>{ if (e.target === m) closeStd(); });
    m.querySelector('.xrd-std-x').onclick = ()=> closeStd();
    m.querySelector('.xrd-std-file').addEventListener('click', e=>{ if (e.target.closest('[data-std-del]')) setStd(null); });
    setupDropzone(id + 'Dz', id + 'Files', async fl=>{
      // One file: of several dropped, the first; it replaces the one loaded. One pattern:
      // of a file of several scans, the first that can be read.
      const f = fl[0];
      if (!f) return;
      let r;
      try { r = await readFile(f); } catch (e){ r = { error: String(e && e.message || e) }; }
      const alerts = m.querySelector('.xrd-std-alerts');
      if (r.error){ alerts.innerHTML = buildAlertsHtml([esc(`${f.name} (${r.error})`)], []); return; }
      const { f: p, k, notes } = r.pats[0];
      p.color = '#d4a72c';
      setStd(p);
      // (after setStd, which clears the windows' alerts: these are the new file's)
      alerts.innerHTML = (fl.length > 1 ? buildAlertsHtml([], [esc(`${fl.length} files dropped: the first, ${f.name}, is the standard`)], 'One file at a time:') : '')
        + (r.n > 1 ? buildAlertsHtml([], [esc(`${f.name}: ${r.n} scans: the standard is ${k ? `scan ${k+1}, the first that could be read` : 'the first'}, the others are not used`)], 'One pattern:') : '')
        + (notes.length ? buildAlertsHtml([], notes.map(t=> esc(`${p.name}: ${t}`)), 'Loaded, with a caveat:') : '');
    });
    return { el: m, box, body: m.querySelector('.xrd-std-body') };
  }
  const peaksModal = stdModal('xrdStdPeaks', 'Instrumental standard', STD_INFO);
  const rvModal = stdModal('xrdStdRv', 'Instrumental standard: Rietveld', RV_STD_INFO);
  let openModal = null;
  // The standard's file in both windows: its whole name (the plot under it has no
  // caption: it is the one file), and × to take it away.
  function syncStdFile(){
    [peaksModal, rvModal].forEach(M=>{
      M.el.querySelector('.xrd-std-file').innerHTML = stdFile
        ? `<div class="xrd-std-row"><span class="txt-mini">Standard</span><span class="xrd-std-name">${esc(stdFile.name)}</span><button type="button" class="peak-del is-danger idle-dim" data-std-del title="Remove the standard">${X_SVG(13)}</button></div>` : '';
    });
  }
  // The windows' alerts are the last file dropped there: they go with the standard,
  // replaced or removed, and on a restore (up to v484 they stayed, on another standard,
  // on none, in another project).
  const clearStdAlerts = ()=> [peaksModal, rvModal].forEach(M=>{ M.el.querySelector('.xrd-std-alerts').innerHTML = ''; });
  function setStd(f){
    stdFile = f;
    clearStdAlerts();
    stdPeaks.resetFile();
    syncStdFile();
    stdPeaks.refresh();
    stdRv.refresh();
    // Every card takes the standard's correction (or loses it).
    eachCard((e, a)=> a.type === 'scherrer' ? e.inst.sizesChanged() : e.inst.redraw());
    setTabLoaded('xrd', allFiles.length || stdFile ? 1 : 0);
    hist.commit();
  }
  function openStd(which){
    const M = which === 'rv' ? rvModal : peaksModal;
    if (openModal === M) return;
    if (openModal) closeStd();
    openModal = M;
    M.el.style.display = 'flex';
    document.addEventListener('keydown', onStdKey);
    // Drawn as it opens: closed, nothing in it was laid out.
    if (which === 'rv') stdRv.refresh(); else stdPeaks.refresh();
    M.box.focus({ preventScroll: true });
  }
  function closeStd(){
    if (!openModal) return;
    openModal.el.style.display = 'none';
    openModal = null;
    document.removeEventListener('keydown', onStdKey);
  }
  function onStdKey(e){ if (e.key === 'Escape') closeStd(); }

  const stdPeaks = createPeakAnalysis({
    files: stdFiles, idx: ()=> 0, step: ()=>{}, commit: ()=> hist.commit(), instr: ()=> null,
    // The standard's peaks are the samples' correction: every Scherrer card follows.
    changed: ()=> eachCard((e, a)=>{ if (a.type === 'scherrer') e.inst.sizesChanged(); }),
    hidden: ()=> openModal !== peaksModal,
  }, peaksModal.body, { prefix: 'xrdStdA', standard: true });
  const stdRv = createRietveld({
    files: stdFiles, allFiles: stdFiles, idx: ()=> 0, step: ()=>{}, commit: ()=> hist.commit(),
    // Refined again or cleared: the samples' results say whether theirs rest on it.
    changed: ()=> eachCard((e, a)=>{ if (a.type === 'rietveld') e.inst.redraw(); }),
    hidden: ()=> openModal !== rvModal,
    blocked: ()=> rvCards().some(i=> i.running()) ? 'A sample refinement is running: the standard can be refined once it ends (a batch takes one instrumental profile throughout).' : '',
    onBusy: ()=> syncRv(),
    // (its run's progress on every Rietveld card's Instrumental standard…)
    onProgress: ()=> rvCards().forEach(i=> i.syncStd()),
  }, rvModal.body, { prefix: 'xrdStdR', standard: true });
  stdRv.setName('standard');

  /* ---- The cards (cards.js) ---- */
  const KINDS = { scherrer: 'Scherrer', rietveld: 'Rietveld' };
  const live = new Map();       // id → { inst, el }
  /* A Rietveld card dropped by a state loaded while it refines, or waits for the
     standard to (runWithModuleState: a saved project's CSVs exported from the Projects
     list, read in and out again at once), is set aside, its run going on, and taken up
     again, panel and all, when the state put back has it (buildCard). Up to v477 it was
     rebuilt afresh: the run went on in a panel no longer in the page, its results lost,
     and the card said nothing ran. */
  const parked = new Map();     // id → { inst, el }
  let restoring = false;
  const cards = ()=> deck ? deck.records : [];
  const eachCard = fn => cards().forEach(a=>{ const e = live.get(a.id); if (e) fn(e, a); });
  const prefixOf = a => (a.type === 'scherrer' ? 'xrdA' : 'xrdR') + a.id;

  /* ---- The refinements running: the samples' (each Rietveld card's) and the standard's ----
     A run belongs to the project live here: the tab manager asks before that leaves the
     module, and stop ends every run as Cancel does (registerBusy). A sample and the
     standard never refine at once (host.blocked): a batch takes one instrumental profile. */
  // (the Rietveld cards' panels, and those set aside by a restore)
  const rvCards = ()=> [...[...live.values()].map(e=> e.inst).filter(i=> i.running), ...[...parked.values()].map(e=> e.inst)];
  // A run started or ended: every Rietveld panel's buttons follow; a card set aside by a
  // restore (parked), its run over, goes.
  function syncRv(){
    rvCards().forEach(i=> i.sync());
    stdRv.sync();
    parked.forEach((e, id)=>{ if (!e.inst.active()){ parked.delete(id); e.inst.destroy(); if (e.inst.res) e.inst.res.remove(); } });
  }
  registerBusy('xrd', {
    busy: ()=> rvCards().some(i=> i.running()) ? 'A Rietveld refinement' : stdRv.running() ? 'The standard\'s refinement' : null,
    // (the samples first: one waiting for the standard's run stops with it)
    stop: ()=>{ rvCards().forEach(i=> i.cancel()); stdRv.cancel(); },
  });

  // The card's panel: made on the samples, with the settings its kind had (a.states),
  // the one it leaves kept for a switch back.
  function buildCard(a, card, prev){
    const was = live.get(a.id);
    // (a run going on stops first, as Cancel: the patterns done go with the kind's settings
    // kept; up to v477 it went on unseen, its results lost)
    if (prev && was){ if (was.inst.cancel) was.inst.cancel(false); a.states[prev] = was.inst.snapshot(); if (was.inst.destroy) was.inst.destroy(); if (was.inst.res) was.inst.res.remove(); }
    const host = { files: ()=> files, allFiles: ()=> allFiles, idx: ()=> curIdx, step, commit: ()=> hist.commit(),
      instr: ()=> stdPeaks.instrModel(), irf: ()=> stdRv.irf(), hidden: ()=> deck.isFolded(a),
      openStd: ()=> openStd(a.type === 'rietveld' ? 'rv' : 'peaks'),
      stdLoaded: ()=> !!stdFile, refineStd: tell=> stdRv.run(tell), stopStd: commit=> stdRv.cancel(commit), stdRun: ()=> stdRv.progress(),
      blocked: ()=> stdRv.running() ? 'The standard is being refined: the samples can be refined once it ends (a batch takes one instrumental profile throughout).' : '',
      onBusy: ()=> syncRv(),
      changed: ()=>{} };
    let el = card.querySelector('.xrd-card');
    const back = !prev && a.type === 'rietveld' ? parked.get(a.id) : null;
    if (back){ parked.delete(a.id); el.replaceWith(back.el); el = back.el; }
    const inst = back ? back.inst : a.type === 'scherrer' ? createPeakAnalysis(host, el, { prefix: prefixOf(a) }) : createRietveld(host, el, { prefix: prefixOf(a) });
    if (a.states[a.type]) inst.restore(a.states[a.type]);
    else if (a.type === 'scherrer') inst.restore({});
    live.set(a.id, { inst, el });
    placeRes();
  }
  function dropCard(a){
    const e = live.get(a.id);
    if (!e) return;
    live.delete(a.id);
    if (restoring && e.inst.active && e.inst.active()) parked.set(a.id, e);
    else if (e.inst.destroy) e.inst.destroy();
    if (e.inst.res) e.inst.res.remove();
    syncResults();
  }
  const resList = document.getElementById('xrdResList');
  const placeRes = ()=> eachCard(e=>{ if (e.inst.res) resList.appendChild(e.inst.res); });
  // The Results: each card's section (a Scherrer card's, a Rietveld card's), under its
  // name, in card order; the card is there while one is.
  function syncResults(){
    const on = cards().filter(a=> live.has(a.id) && live.get(a.id).inst.res);
    document.getElementById('xrdResults').style.display = files.length && on.length ? 'block' : 'none';
    on.forEach((a, i)=> live.get(a.id).inst.res.classList.toggle('is-first', i === 0));
  }
  function named(a){
    const e = live.get(a.id);
    if (!e) return;
    e.inst.setName(fileSafe(a.name));
    if (e.inst.res) e.inst.res.querySelector('.res-an-title').textContent = a.name;
  }
  deck = createDeck({
    list: document.getElementById('xrdAnalyses'), addBar: document.getElementById('xrdAddBar'), addBtn: document.getElementById('xrdAddAn'),
    kinds: KINDS, info: t=> (t === 'scherrer' ? PEAKS_INFO : RV_INFO) + ' ' + cardInfo(true, true),
    body: ()=> '<div class="xrd-card"></div>', make: ()=> ({ states: {} }),
    build: buildCard, drop: dropCard, autoName: a=> KINDS[a.type], named,
    changed: ()=>{ placeRes(); syncResults(); }, loaded: ()=>{ placeRes(); syncResults(); },
    added: a=>{ if (files.length) live.get(a.id).inst.refresh(); },
    switched: a=>{ if (files.length) live.get(a.id).inst.refresh(); },
    wake: a=>{ if (files.length) live.get(a.id).inst.redraw(); },
    commit: ()=> hist.commit(),
  });

  /* ---- Undo/redo: snapshot the reversible state. Raw patterns (x/y) are shared by
     reference; the cards' settings, peaks and results, the standard's and the files'
     order, labels and colours are captured so any change can be stepped back. ---- */
  const clone = o => JSON.parse(JSON.stringify(o));
  function xrdSnapshot(){
    return {
      v: 2,
      files: allFiles.map(f=>({...f})),
      std: stdFile ? {...stdFile} : null,
      stdPeaks: stdPeaks.snapshot(), stdRv: stdRv.snapshot(),
      curIdx,
      cards: cards().map(a=>{
        const states = {};
        Object.entries(a.states).forEach(([k, s])=>{ if (k !== a.type && s) states[k] = clone(s); });
        states[a.type] = live.get(a.id).inst.snapshot();
        return { ...deck.saved(a), states };
      }),
    };
  }
  /* A project keeps each file's arrays as the version that loaded it read them. Up to v262
     the intensities came in with their minimum subtracted, which the Rietveld weights then
     took for the counts: the user's LaB6, so kept, fitted at χ²_ν 3.93, R_exp 3.89 % where
     the file itself gives 2.17 and 3.54 % (the same parameters, the esds and the weights
     off). Restored, a file is read again from its own bytes (rawBytes), as a file loaded
     now is, and a note names those whose arrays changed; one whose bytes were not kept is
     used as it was, with a note where its lowest point is exactly 0. The readings are kept
     by their bytes, so an undo does not read a file again. A pattern is its scan of the
     file (f.scan; the first, none given), so a file of several gives its scans again, in
     their order. */
  const reread = new WeakMap();
  function readAgain(f){
    const b = f.rawBytes;
    if (!b || typeof b !== 'object' || !/\.(xrdml|xml)$/i.test(f.name || '')){
      let lo = Infinity; for (const v of f.y || []) if (v < lo) lo = v;
      return { f: frozenArrs(ascending({ ...f })), note: !b && lo === 0 ? 'its lowest point is exactly 0 and the project does not hold the file itself: its minimum may have been subtracted (as up to v262), which the Rietveld weights would take for the counts; load the file again' : null };
    }
    let all = reread.get(b);
    if (!all){
      try {
        const xml = new DOMParser().parseFromString(decodeXml(b instanceof Uint8Array ? b : Uint8Array.from(b)), 'text/xml');
        all = xml.getElementsByTagName('parsererror').length ? [{ error: 'not well-formed XML' }] : readXrdmlScans(xml);
      } catch (e){ all = [{ error: String(e && e.message || e) }]; }
      reread.set(b, all);
    }
    const sc = all[Number.isInteger(f.scan) && f.scan >= 0 ? f.scan : 0] || { error: 'no such scan' };
    if (sc.error) return { f: frozenArrs(ascending({ ...f })), note: null };
    const { varMul: _, ...rest } = f, a = scanArrays(sc);
    const g = { ...rest, x: a.x, y: a.y, ...(a.varMul ? { varMul: a.varMul } : {}) };
    const old = ascending({ ...f }), n = g.y.length;
    // (the arrays the state holds, the scan's own: nothing moved)
    const same = old.x === g.x && old.y === g.y && old.varMul === g.varMul;
    let moved = !same && (!old.y || old.y.length !== n || !old.x || old.x.length !== n || !!old.varMul !== !!g.varMul);
    for (let i = 0; !same && !moved && i < n; i++)
      moved = Math.abs(old.y[i] - g.y[i]) > 1e-9*Math.max(1, Math.abs(g.y[i])) || Math.abs(old.x[i] - g.x[i]) > 1e-9 || (g.varMul && Math.abs(old.varMul[i] - g.varMul[i]) > 1e-12);
    // (points left out that an earlier version, to v484, kept as no number: those)
    const lost = sc.dropped && old.y && old.y.length === n + sc.dropped;
    return { f: g, note: !moved ? null : lost ? `read again from the file itself, ${sc.dropped} point${sc.dropped > 1 ? 's' : ''} whose values are no finite number left out (the project held ${sc.dropped > 1 ? 'them' : 'it'} as up to v484). Results refined before are from those: refine again`
      : 'read again from the file itself: the project held its data as an earlier version had read them (up to v262, with their minimum subtracted). Results refined before are from those: refine again' };
  }
  /* A project read in may hold anything (an imported .json): the restore takes what it reads
     only as what it should be — a file an object with its pattern, 2θ and intensities as
     many and two at least (else it is left out, with a note), its name and label text; an
     index an integer in range; arrays where arrays are kept; the cards of a known kind —
     and anything else as its default (up to v484 a curIdx that was no number made the index
     NaN, and the cards read files[NaN].label; a file not an object, or with no arrays,
     threw before anything was drawn). */
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const isArr = v => Array.isArray(v) || ArrayBuffer.isView(v);
  // (a kind of KINDS' own: 'constructor', 'toString' and the like are none)
  const isKind = k => Object.prototype.hasOwnProperty.call(KINDS, k);
  function keptFile(f, i, color){
    if (!isObj(f)) return null;
    const name = typeof f.name === 'string' && f.name ? f.name : `file ${i+1}`;
    const g = { ...f, name, label: typeof f.label === 'string' ? f.label : name.replace(/\.[^.]+$/, ''), color: typeof f.color === 'string' ? f.color : color };
    if (!(isArr(g.varMul) && isArr(g.y) && g.varMul.length === g.y.length)) delete g.varMul;
    let r;
    try { r = readAgain(g); } catch (e){ return null; }
    return isArr(r.f.x) && isArr(r.f.y) && r.f.x.length === r.f.y.length && r.f.x.length > 1 ? r : null;
  }
  /* A project from before the cards (v460): one Analysis and one Rietveld card, and the
     standard a file among the samples, chosen in a select. It becomes the standard's own
     file, its parameters and peaks the standard's analysis, its refinement the standard's
     Rietveld; the samples' settings go to a Scherrer card and a Rietveld card. A standard
     left out of the analysis was not in use: it stays a sample, left out. */
  function migrate(s){
    // (an entry that is no file kept in its place: the restore leaves it out with its
    // entries in the per-sample lists)
    const all = Array.isArray(s.files) ? s.files : [], incl = all.filter(f=> !isObj(f) || f.included !== false);
    const si = s.standardName ? incl.findIndex(f=> isObj(f) && f.name === s.standardName) : -1;
    const cut = a => Array.isArray(a) ? a.filter((_, i)=> i !== si) : a;
    const rv = isObj(s.rv) ? s.rv : {}, res = isObj(rv.results) ? rv.results : {};
    const stdRes = si >= 0 && res[s.standardName] ? { [s.standardName]: res[s.standardName] } : {};
    const smpRes = Object.fromEntries(Object.entries(res).filter(([k])=> !(si >= 0 && k === s.standardName)));
    let ci = s.curIdx || 0; if (si >= 0 && ci > si) ci--;
    return {
      files: si >= 0 ? all.filter(f=> f !== incl[si]) : all,
      std: si >= 0 ? (({ included, held, ...f })=> f)(incl[si]) : null,
      stdPeaks: si >= 0 ? { shared: s.stdParams, perParams: [s.stdParams], manualPeaks: [(s.manualPeaks || [])[si] || []], removedPeaks: [(s.removedPeaks || [])[si] || []] } : { shared: s.stdParams },
      stdRv: { phases: [], std: rv.std, start: rv.start, hold: rv.hold, fit: rv.fit, results: stdRes, refineB: rv.refineB },
      curIdx: ci,
      cards: [
        { id: 1, type: 'scherrer', states: { scherrer: { perParams: cut(s.perParams), manualPeaks: cut(s.manualPeaks), removedPeaks: cut(s.removedPeaks), shared: s.shared, paramMode: s.paramMode, sizeBy: s.sizeBy, norm: s.norm } } },
        { id: 2, type: 'rietveld', states: { rietveld: { ...rv, results: smpRes } } },
      ],
    };
  }
  // A kind's settings, the card's or kept while it is the other kind: an object, and the
  // Scherrer one's per-sample lists arrays (the file list keeps them aligned: slots), the
  // entries of the included files left out (gone: their places among the included) taken
  // out, so each file after them keeps its own.
  function keptState(k, v, gone){
    if (!isObj(v)) return null;
    if (k !== 'scherrer') return v;
    const arr = a => Array.isArray(a) ? a.filter((_, i)=> !gone.has(i)) : [];
    return { ...v, shared: isObj(v.shared) ? v.shared : {}, perParams: arr(v.perParams), manualPeaks: arr(v.manualPeaks), removedPeaks: arr(v.removedPeaks) };
  }
  function xrdRestore(s0){
    const s = isObj(s0) && s0.v === 2 ? s0 : migrate(isObj(s0) ? s0 : {});
    const raw = Array.isArray(s.files) ? s.files : [], reads = raw.map((f, i)=> keptFile(f, i, colorOf(i)));
    const stdRead = s.std ? keptFile(s.std, 0, '#d4a72c') : null, lost = reads.filter(r=> !r).length;
    // The places among the included of the files left out (an entry that is no file counts
    // as included: it holds no included:false), whose entries the cards' per-sample lists
    // drop; the sample on show stays the one it was, or the one now in its place.
    const gone = new Set();
    raw.reduce((j, f, i)=>{ if (isObj(f) && f.included === false) return j; if (!reads[i]) gone.add(j); return j + 1; }, 0);
    allFiles = reads.filter(Boolean).map(r=> r.f);
    files = includedOf(allFiles);
    stdFile = stdRead ? stdRead.f : null;
    const ci = Number.isFinite(s.curIdx) ? Math.max(0, Math.trunc(s.curIdx)) : 0;
    curIdx = Math.min(ci - [...gone].filter(j=> j < ci).length, Math.max(0, files.length-1));
    stdPeaks.restore(isObj(s.stdPeaks) ? s.stdPeaks : {});
    stdRv.restore(isObj(s.stdRv) ? s.stdRv : {});
    restoring = true;
    try {
      deck.load(Array.isArray(s.cards) ? s.cards.filter(c=> isObj(c) && (c.type == null || isKind(c.type))) : [],
        src=> ({ states: Object.fromEntries(Object.entries(clone(isObj(src.states) ? src.states : {})).filter(([k])=> isKind(k)).map(([k, v])=> [k, keptState(k, v, gone)]).filter(([, v])=> v)) }),
        a=> live.get(a.id).inst.restore(a.states[a.type] || {}));
    } finally { restoring = false; }
    clearStdAlerts();
    syncStdFile();
    stdPeaks.refresh();
    stdRv.refresh();
    afterFilesChange();
    // Clear the previous tab's transient upload alert and rebuild for this tab.
    xrdLoadAlerts = ''; xrdNoteAlerts = ''; xrdUploadAlerts = '';
    const notes = [...reads, ...(stdRead ? [stdRead] : [])].filter(r=> r && r.note).map(r=> esc(`${r.f.label || r.f.name}: ${r.note}.`));
    if (lost || (s.std && !stdRead)) notes.push(esc(`${lost ? `${lost} file${lost > 1 ? 's' : ''}` : ''}${lost && s.std && !stdRead ? ' and ' : ''}${s.std && !stdRead ? 'the standard' : ''} in the project with no pattern to show (no 2θ and intensities): left out.`));
    if (notes.length) xrdNoteAlerts = buildAlertsHtml([], notes, 'Restored, with a caveat:', '', 'xrd-dismiss-notes');
    rebuildXrdAlerts();
  }
  const hist = registerHistory('xrd', xrdSnapshot, xrdRestore);

  registerTabRedraw('xrd', ()=>{
    deck.fitNames();
    if (files.length) eachCard((e, a)=>{ if (!deck.isFolded(a)) e.inst.redraw(); });
    if (openModal === peaksModal) stdPeaks.redraw();
    if (openModal === rvModal) stdRv.redraw();
  });

  // The CSVs: every card's, named after it, and the standard's.
  function exportXrdZip(){
    const out = [];
    eachCard((e, a)=> out.push(...e.inst.csvEntries(fileSafe(a.name) + ' - ')));
    out.push(...stdPeaks.csvEntries(''), ...stdRv.csvEntries('standard - '));
    return out;
  }
  registerCsvExport('xrd', exportXrdZip);

  // A new project starts with a Scherrer card and a Rietveld one.
  deck.start(['scherrer', 'rietveld']);
})();
