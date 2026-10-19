import { setupDropzone, renderUnifiedFileList, includedOf, setIncluded, removeFileAt, moveFileTo, buildAlertsHtml, nextColor, setTabLoaded, registerHistory, registerTabRedraw, registerCsvExport, X_SVG } from './utils.js';
import { createRietveld, RV_INFO, RV_STD_INFO } from './xrd-rv.js';
import { createPeakAnalysis, PEAKS_INFO, STD_INFO } from './xrd-peaks.js';
import { readXrdmlScan, decodeXml } from './xrd-instr.js';
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

  /* A file read (readXrdmlScan, xrd-instr.js): 2θ, the intensities on the unattenuated
     scale (<intensities> as written, the raw <counts> of XRDML 2.x times the attenuation
     factors) and each point's variance, var(y) = y·varMul, for the counting uncertainty of
     the FWHMs and the Rietveld weights. A file it cannot read (wrong format, not
     well-formed, not a 2θ scan, dropped past the file picker's accept filter) gives the
     reason instead. rawBytes keeps the original bytes for byte-exact re-download; the text
     is decoded from them in the file's own encoding (UTF-16 too, which f.text() is not).
     The raw intensities are kept untouched (no minimum subtraction): the constant offset is
     absorbed by the SNIP background, so the whole pipeline — analysis and fit alike — runs
     on the true raw data and stays consistent with the CSVs. */
  async function readFile(f, color){
    const rawBytes = new Uint8Array(await f.arrayBuffer());
    const xml = new DOMParser().parseFromString(decodeXml(rawBytes), 'text/xml');
    const sc = xml.getElementsByTagName('parsererror').length ? { error: 'not well-formed XML' } : readXrdmlScan(xml);
    if (sc.error) return { error: sc.error };
    const { x, y, varMul } = sc;
    return { file: ascending({name:f.name, label:f.name.replace(/\.[^.]+$/,''), x, y, color, rawBytes, ...(varMul ? { varMul } : {})}), notes: sc.notes };
  }

  /* ---- The samples ---- */
  // Every card's per-sample arrays (a Scherrer card's, and those it keeps while it is a
  // Rietveld one), for the file list to keep aligned with the included files.
  const copyArr = v => Array.isArray(v) ? v.slice() : [];
  function slots(){
    const out = [];
    cards().forEach(a=>{
      const e = live.get(a.id);
      if (a.type === 'scherrer' && e) out.push(...e.inst.slots('A' + a.id));
      const s = a.states.scherrer;
      if (a.type !== 'scherrer' && s){
        out.push({ key: 'kA' + a.id + ':params', arr: s.perParams, make: v=> v ? {...v} : {...s.shared} },
          { key: 'kA' + a.id + ':manual', arr: s.manualPeaks, make: copyArr },
          { key: 'kA' + a.id + ':removed', arr: s.removedPeaks, make: copyArr });
      }
    });
    return out;
  }
  // The cards stay on the sample they showed when another is left out or taken in.
  function stayOn(f){ const k = includedOf(allFiles).indexOf(f); if (k >= 0) curIdx = k; }
  function fileCallbacks(){
    return {
      onRemove(i){ removeFileAt(allFiles, i, slots()); afterFilesChange(); },
      onReorder(from, to){ moveFileTo(allFiles, from, to, slots()); afterFilesChange(); },
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
    const existing = new Set(allFiles.map(f=>f.name));
    const alreadyLoaded = [];
    const invalidFiles = [], loadNotes = [];
    for (const f of fileList){
      if (existing.has(f.name)){ alreadyLoaded.push(esc(f.name)); continue; }
      const r = await readFile(f, nextColor(allFiles));
      if (r.error){ invalidFiles.push(esc(`${f.name} (${r.error})`)); continue; }
      existing.add(f.name);
      for (const t of r.notes) loadNotes.push(esc(`${f.name}: ${t}`));
      // A new file comes in included, so it goes last among the included as well.
      allFiles.push(r.file); files.push(r.file);
      cards().forEach(a=>{
        const e = live.get(a.id);
        if (a.type === 'scherrer' && e) e.inst.addFile();
        const s = a.states.scherrer;
        if (a.type !== 'scherrer' && s){ s.perParams.push({...s.shared}); s.manualPeaks.push([]); s.removedPeaks.push([]); }
      });
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
      // One file: of several dropped, the first; it replaces the one loaded.
      const f = fl[0];
      if (!f) return;
      const r = await readFile(f, '#d4a72c');
      const alerts = m.querySelector('.xrd-std-alerts');
      if (r.error){ alerts.innerHTML = buildAlertsHtml([esc(`${f.name} (${r.error})`)], []); return; }
      alerts.innerHTML = (fl.length > 1 ? buildAlertsHtml([], [esc(`${fl.length} files dropped: the first, ${f.name}, is the standard`)], 'One file at a time:') : '')
        + (r.notes.length ? buildAlertsHtml([], r.notes.map(t=> esc(`${f.name}: ${t}`)), 'Loaded, with a caveat:') : '');
      setStd(r.file);
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
  function setStd(f){
    stdFile = f;
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
  }, rvModal.body, { prefix: 'xrdStdR', standard: true });
  stdRv.setName('standard');

  /* ---- The cards (cards.js) ---- */
  const KINDS = { scherrer: 'Scherrer', rietveld: 'Rietveld' };
  const live = new Map();       // id → { inst }
  const cards = ()=> deck ? deck.records : [];
  const eachCard = fn => cards().forEach(a=>{ const e = live.get(a.id); if (e) fn(e, a); });
  const prefixOf = a => (a.type === 'scherrer' ? 'xrdA' : 'xrdR') + a.id;
  // The card's panel: made on the samples, with the settings its kind had (a.states),
  // the one it leaves kept for a switch back.
  function buildCard(a, card, prev){
    const was = live.get(a.id);
    if (prev && was){ a.states[prev] = was.inst.snapshot(); if (was.inst.destroy) was.inst.destroy(); if (was.inst.res) was.inst.res.remove(); }
    const host = { files: ()=> files, allFiles: ()=> allFiles, idx: ()=> curIdx, step, commit: ()=> hist.commit(),
      instr: ()=> stdPeaks.instrModel(), irf: ()=> stdRv.irf(), hidden: ()=> deck.isFolded(a),
      openStd: ()=> openStd(a.type === 'rietveld' ? 'rv' : 'peaks'),
      changed: ()=>{} };
    const el = card.querySelector('.xrd-card');
    const inst = a.type === 'scherrer' ? createPeakAnalysis(host, el, { prefix: prefixOf(a) }) : createRietveld(host, el, { prefix: prefixOf(a) });
    if (a.states[a.type]) inst.restore(a.states[a.type]);
    else if (a.type === 'scherrer') inst.restore({});
    live.set(a.id, { inst });
    placeRes();
  }
  function dropCard(a){
    const e = live.get(a.id);
    if (!e) return;
    if (e.inst.destroy) e.inst.destroy();
    if (e.inst.res) e.inst.res.remove();
    live.delete(a.id);
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
     by their bytes, so an undo does not read a file again. */
  const reread = new WeakMap();
  function readAgain(f){
    const b = f.rawBytes;
    if (!b || typeof b !== 'object' || !/\.(xrdml|xml)$/i.test(f.name || '')){
      let lo = Infinity; for (const v of f.y || []) if (v < lo) lo = v;
      return { f: ascending({ ...f }), note: !b && lo === 0 ? 'its lowest point is exactly 0 and the project does not hold the file itself: its minimum may have been subtracted (as up to v262), which the Rietveld weights would take for the counts; load the file again' : null };
    }
    let sc = reread.get(b);
    if (!sc){
      try {
        const xml = new DOMParser().parseFromString(decodeXml(b instanceof Uint8Array ? b : Uint8Array.from(b)), 'text/xml');
        sc = xml.getElementsByTagName('parsererror').length ? { error: 'not well-formed XML' } : readXrdmlScan(xml);
      } catch (e){ sc = { error: String(e && e.message || e) }; }
      reread.set(b, sc);
    }
    if (sc.error) return { f: ascending({ ...f }), note: null };
    const { varMul: _, ...rest } = f;
    const g = ascending({ ...rest, x: sc.x.slice(), y: sc.y.slice(), ...(sc.varMul ? { varMul: sc.varMul.slice() } : {}) });
    const old = ascending({ ...f }), n = g.y.length;
    let moved = !old.y || old.y.length !== n || !old.x || old.x.length !== n || !!old.varMul !== !!g.varMul;
    for (let i = 0; !moved && i < n; i++)
      moved = Math.abs(old.y[i] - g.y[i]) > 1e-9*Math.max(1, Math.abs(g.y[i])) || Math.abs(old.x[i] - g.x[i]) > 1e-9 || (g.varMul && Math.abs(old.varMul[i] - g.varMul[i]) > 1e-12);
    return { f: g, note: moved ? 'read again from the file itself: the project held its data as an earlier version had read them (up to v262, with their minimum subtracted). Results refined before are from those: refine again' : null };
  }
  /* A project from before the cards (v460): one Analysis and one Rietveld card, and the
     standard a file among the samples, chosen in a select. It becomes the standard's own
     file, its parameters and peaks the standard's analysis, its refinement the standard's
     Rietveld; the samples' settings go to a Scherrer card and a Rietveld card. A standard
     left out of the analysis was not in use: it stays a sample, left out. */
  function migrate(s){
    const all = s.files || [], incl = all.filter(f=> f.included !== false);
    const si = s.standardName ? incl.findIndex(f=> f.name === s.standardName) : -1;
    const cut = a => Array.isArray(a) ? a.filter((_, i)=> i !== si) : a;
    const rv = s.rv || {}, res = rv.results || {};
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
  function xrdRestore(s0){
    const s = s0 && s0.v === 2 ? s0 : migrate(s0 || {});
    const reads = (s.files || []).map(readAgain), stdRead = s.std ? readAgain(s.std) : null;
    allFiles = reads.map(r=> r.f);
    files = includedOf(allFiles);
    stdFile = stdRead ? stdRead.f : null;
    curIdx = Math.min(s.curIdx || 0, Math.max(0, files.length-1));
    stdPeaks.restore(s.stdPeaks || {});
    stdRv.restore(s.stdRv || {});
    deck.load(Array.isArray(s.cards) ? s.cards : [], src=> ({ states: Object.fromEntries(Object.entries(clone(src.states || {})).filter(([k])=> KINDS[k])) }),
      a=> live.get(a.id).inst.restore(a.states[a.type] || {}));
    syncStdFile();
    stdPeaks.refresh();
    stdRv.refresh();
    afterFilesChange();
    // Clear the previous tab's transient upload alert and rebuild for this tab.
    xrdLoadAlerts = ''; xrdNoteAlerts = ''; xrdUploadAlerts = '';
    const notes = [...reads, ...(stdRead ? [stdRead] : [])].filter(r=> r.note).map(r=> esc(`${r.f.label || r.f.name}: ${r.note}.`));
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
