import { csvLine, fmtNum, setupDropzone, renderUnifiedFileList, includedOf, setIncluded, removeFileAt, moveFileTo, buildAlertsHtml, setTabLoaded, registerHistory, registerTabRedraw, registerCsvExport, flashFieldInvalid } from './utils.js';
import { readTescanTiff } from './sem-read.js';

/* =========================================================
   SEM MODULE
   Tescan images (sem-read.js): each one's metadata, and its crop. The crop is kept as
   a rectangle in the original's pixels, inside the image (the info bar is never in
   it); the image itself is never changed.

   A file's bytes live in the module state as base64 (RawRef), not as a Uint8Array:
   db.js encode() turns a typed array into a plain array of numbers, eight bytes each
   in IndexedDB and a decimal each in a .json, and the undo stack compares snapshots
   by JSON.stringify on every edit. A RawRef serialises in JSON as its id alone
   (toJSON), so a snapshot compares at the cost of its crops; encode() copies its
   fields (id, b64) and leaves the method, so a saved project and a .json keep the
   bytes. The decoded image is a cache keyed by the id (a hash of the bytes).
========================================================= */
(function(){
  const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // On the page: d significant digits, the point as a point (fmtNum, with the CSV's
  // decimal separator and fixed decimals, is for the export).
  const sig = (v, d) => Number.isFinite(v) ? String(+v.toPrecision(d)) : '—';
  // The smallest crop side (px); an image smaller than it is taken whole.
  const MIN_CROP = 64;
  // The crop's width:height when locked.
  const ASPECTS = { '1:1': 1, '4:3': 4/3, '3:2': 3/2, free: null };

  class RawRef {
    constructor(id, b64){ this.id = id; this.b64 = b64; }
    toJSON(){ return 'raw:' + this.id; }
  }
  // base64 in chunks: one String.fromCharCode over megabytes overflows the call stack.
  function toB64(bytes){
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromB64(b64){
    const s = atob(b64), b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }
  // FNV-1a over the bytes, with their length: a file's identity (a second copy of one
  // already loaded is the same file, whatever it is called).
  function hashBytes(b){
    let h = 0x811c9dc5;
    for (let i = 0; i < b.length; i++){ h ^= b[i]; h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, '0') + '-' + b.length;
  }

  /* ---- State ----
     allFiles: every image in list order, { name (the file's), label (the sample's,
     from the file's Sign), raw (RawRef), crop {x,y,w,h}, aspect, cropDef (the default
     crop, its fields locked), linked, clamped, adj (its own correction), adjDef (none,
     its fields locked), included? }. files: the included ones; cur indexes them. */
  let allFiles = [];
  let files = [];
  let cur = 0;
  let loadAlerts = '', uploadAlerts = '', warnAlerts = '';
  // The groups (Groups and scale): [{ id, name, named (typed by the user), mode
  // ('common' | 'own'), members (the images' ids) }].
  let groups = [];
  // Each group's figure settings (sem-figure.js), by the group's id; a group has none
  // until its figure is first opened.
  let figures = {};
  // id → { r (readTescanTiff's), small (a box-averaged copy, for the thumbnails) }
  const decoded = new Map();
  // A copy of the image some 160 px across, each pixel the mean of a k × k block, kept
  // at 16 bits so that the thumbnails go through the same curve as the image (shown at
  // 90–188 px, as many a row as fit).
  function smallOf(r, side = 160){
    const k = Math.max(1, Math.ceil(Math.max(r.width, r.imageH)/side)), w = Math.floor(r.width/k), h = Math.floor(r.imageH/k);
    const px = new Uint16Array(w*h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
      let sum = 0;
      for (let j = 0; j < k; j++){ const row = (y*k + j)*r.width + x*k; for (let i = 0; i < k; i++) sum += r.pixels[row + i]; }
      px[y*w + x] = Math.round(sum/(k*k));
    }
    return { w, h, k, px };
  }
  function cache(id, r){
    const e = { r, small: smallOf(r) };
    decoded.set(id, e);
    return e;
  }
  // The decoded image of a file, read again from its bytes when not cached (a project
  // opened, an undo past a removal). null when the bytes no longer read.
  function dec(f){
    if (decoded.has(f.raw.id)) return decoded.get(f.raw.id);
    try { return cache(f.raw.id, readTescanTiff(fromB64(f.raw.b64), f.name)); } catch(e){ return null; }
  }

  /* ---- Intensity ----
     Each image's grey levels go through one curve, a table of its 65536 levels:
       1. the normalisation, one for every image of its group: none (the levels as
          acquired), a stretch between two percentiles of the image's own levels, the
          mean and standard deviation of the reference image, or its histogram;
       2. contrast about mid-grey and brightness, then gamma (above 1 brightening the
          mid-tones): the global values, with each image's own correction on top
          (brightness added, contrast and gamma multiplied).
     The statistics are the crop's, its saturated pixels (65535) left out: what is
     shown is what is normalised, and a saturated edge does not set the white. The
     reference's own levels are its levels as acquired, so with "none" it looks as the
     others are made to.
     The settings (normalisation, reference, contrast, brightness, gamma) are those of
     all groups, `intensity`, unless a group has its own (groupInt). */
  const INT_DEF = { mode: 'percentile', pLo: 0.5, pHi: 99.5, ref: null, b: 0, c: 1, g: 1, def: true };
  // Settings at their defaults (the reference aside, which they do not reset).
  const isIntDef = I => ['mode', 'pLo', 'pHi', 'b', 'c', 'g'].every(k=> I[k] === INT_DEF[k]);
  const isAdjDef = a => !a || ['b', 'c', 'g'].every(k=> a[k] === ADJ_DEF[k]);
  const ADJ_DEF = { b: 0, c: 1, g: 1 };
  let intensity = { ...INT_DEF };
  // A group's own settings, by the group's id, where it has them.
  let groupInt = {};
  const usesRef = (I = intensity) => I.mode === 'meansd' || I.mode === 'hist';
  // The reference: the image chosen, else the first loaded.
  const refFile = (I = intensity) => allFiles.find(f=> f.raw.id === I.ref) || allFiles[0] || null;
  // The settings an image goes through: its group's own, else those of all groups.
  const intOf = f => { const g = groupOf(f); return g && groupInt[g.id] || intensity; };
  // An image that is the reference of settings in use (all groups', or a group's own)
  // that use one (marked ◎ on its thumbnail).
  const isRef = f => [intensity, ...Object.values(groupInt)].some(I=> usesRef(I) && refFile(I) === f);
  // An image's crop, as a histogram of its levels with their count, mean and spread
  // (the last 64 crops kept).
  const statsCache = new Map();
  function statsOf(f){
    const e = dec(f), c = f.crop, key = `${f.raw.id}|${c.x},${c.y},${c.w},${c.h}`;
    let st = statsCache.get(key);
    if (st) return st;
    const W = e.r.width, px = e.r.pixels, hist = new Uint32Array(65536);
    let n = 0, sum = 0, sq = 0;
    for (let y = c.y; y < c.y + c.h; y++){
      const row = y*W;
      for (let x = c.x; x < c.x + c.w; x++){ const v = px[row + x]; if (v === 65535) continue; hist[v]++; n++; sum += v; sq += v*v; }
    }
    const mean = n ? sum/n : 0;
    st = { hist, n, mean, sd: n ? Math.sqrt(Math.max(0, sq/n - mean*mean)) : 0 };
    statsCache.set(key, st);
    if (statsCache.size > 64) statsCache.delete(statsCache.keys().next().value);
    return st;
  }
  // The level below which a share q of the crop's pixels lie.
  function levelAt(st, q){
    const t = q*st.n; let acc = 0;
    for (let v = 0; v < 65535; v++){ acc += st.hist[v]; if (acc > t) return v; }
    return 65534;
  }
  /* The normalisation of an image: { lo, hi }, the levels taken to black and white
     (linear), or { table }, each level's value on 0–1 (the histogram's). */
  function normOf(f){
    const I = intOf(f), m = I.mode;
    if (m === 'none') return { lo: 0, hi: 65535 };
    const st = statsOf(f);
    if (m === 'percentile'){
      const lo = levelAt(st, I.pLo/100), hi = levelAt(st, I.pHi/100);
      return { lo, hi: hi > lo ? hi : lo + 1 };
    }
    const rf = refFile(I), rs = rf ? statsOf(rf) : st;
    if (m === 'meansd'){
      // v → μ_ref + (v − μ)·σ_ref/σ, on the reference's levels: the levels that land on
      // 0 and 65535 there.
      const k = st.sd > 0 && rs.sd > 0 ? st.sd/rs.sd : 1;
      return { lo: st.mean - rs.mean*k, hi: st.mean + (65535 - rs.mean)*k };
    }
    // The histogram: a level at the share F of the image's crop (its bin's middle) goes
    // to the reference's level at the same share.
    const table = new Float32Array(65536), n = st.n || 1, nr = rs.n || 1;
    let ci = 0, cr = 0, u = 0;
    for (let v = 0; v < 65535; v++){
      const F = (ci + st.hist[v]/2)/n; ci += st.hist[v];
      while (u < 65534 && (cr + rs.hist[u])/nr < F){ cr += rs.hist[u]; u++; }
      table[v] = u/65535;
    }
    table[65535] = 1;
    return { table };
  }
  // The whole curve of an image, as the 8-bit grey of each of its levels.
  function lutOf(f){
    const nm = normOf(f), a = f.adj || ADJ_DEF, I = intOf(f);
    const b = (I.b + a.b)/100, k = I.c*a.c, ig = 1/(I.g*a.g);
    const lut = new Uint8ClampedArray(65536), span = nm.table ? 0 : 1/(nm.hi - nm.lo);
    for (let v = 0; v < 65536; v++){
      let y = nm.table ? nm.table[v] : (v - nm.lo)*span;
      y = y < 0 ? 0 : y > 1 ? 1 : y;
      y = (y - 0.5)*k + 0.5 + b;
      y = y < 0 ? 0 : y > 1 ? 1 : y;
      lut[v] = Math.round(Math.pow(y, ig)*255);
    }
    return lut;
  }
  // A region of 16-bit levels (row length W) through a curve, into a canvas.
  function toCanvas(px, W, x0, y0, w, h, lut){
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), d = new Uint32Array(img.data.buffer);
    for (let y = 0; y < h; y++){
      const row = (y0 + y)*W + x0, o = y*w;
      for (let x = 0; x < w; x++){ const g = lut[px[row + x]]; d[o + x] = 0xff000000 | g << 16 | g << 8 | g; }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  /* ---- Crop rules ---- */
  // The ratio named by a crop of w × h, if it is one of the locks (within 1 %).
  const aspectOf = (w, h) => Object.keys(ASPECTS).find(k=> ASPECTS[k] && Math.abs(w/h/ASPECTS[k] - 1) < 0.01) || 'free';
  // A rectangle made to fit an image W × H: whole pixels, sides at least MIN_CROP (or
  // the image's), inside it, and at ratio r when locked (the longer side shortened).
  function fitCrop(c, W, H, r){
    let w = Math.round(Math.min(Math.max(c.w, Math.min(MIN_CROP, W)), W));
    let h = Math.round(Math.min(Math.max(c.h, Math.min(MIN_CROP, H)), H));
    if (r){
      if (w/h > r) w = Math.max(Math.min(MIN_CROP, W), Math.round(h*r));
      else h = Math.max(Math.min(MIN_CROP, H), Math.round(w/r));
      w = Math.min(w, W); h = Math.min(h, H);
    }
    const x = Math.round(Math.min(Math.max(0, c.x), W - w)), y = Math.round(Math.min(Math.max(0, c.y), H - h));
    return { x, y, w, h };
  }
  const defaultCrop = r => ({ x: 0, y: 0, w: r.width, h: r.imageH });
  const isDefaultCrop = f =>{ const e = dec(f), d = e && defaultCrop(e.r); return !!d && ['x', 'y', 'w', 'h'].every(k=> f.crop[k] === d[k]); };
  // Set a file's crop from another's (a copy, the linked crop): narrowed to fit where
  // its image is smaller, and marked so.
  function takeCrop(f, c, aspect){
    const e = dec(f); if (!e) return;
    const got = fitCrop(c, e.r.width, e.r.imageH, ASPECTS[aspect]);
    f.crop = got; f.aspect = aspect;
    f.clamped = got.x !== c.x || got.y !== c.y || got.w !== c.w || got.h !== c.h;
    f.cropDef = isDefaultCrop(f);
  }
  // The linked crop: every linked image takes the one just set.
  function propagate(f){
    if (!f.linked) return;
    allFiles.forEach(g=>{ if (g !== f && g.linked) takeCrop(g, f.crop, f.aspect); });
  }

  /* ---- Alerts ---- */
  document.getElementById('tab-sem').addEventListener('click', e=>{
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'sem-dismiss-invalid'){ loadAlerts = ''; rebuildAlerts(); }
    else if (btn.dataset.action === 'sem-dismiss-upload'){ uploadAlerts = ''; rebuildAlerts(); }
    else if (btn.dataset.action === 'sem-dismiss-warn'){ warnAlerts = ''; rebuildAlerts(); }
  });
  function rebuildAlerts(){ document.getElementById('semAlerts').innerHTML = loadAlerts + uploadAlerts + warnAlerts; }

  /* ---- Loading ---- */
  setupDropzone('semDropzone', 'semFiles', async list=>{
    const bad = [], dup = [], warn = [];
    for (const file of list){
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      // A .hdr beside its .tif says what the TIFF carries already.
      if (ext === 'hdr') continue;
      if (ext !== 'tif' && ext !== 'tiff'){ bad.push(`${esc(file.name)} — not a TIFF`); continue; }
      const bytes = new Uint8Array(await file.arrayBuffer()), id = hashBytes(bytes);
      if (allFiles.some(f=> f.raw.id === id)){ dup.push(esc(file.name)); continue; }
      let r;
      try { r = readTescanTiff(bytes, file.name); }
      catch(e){ bad.push(`${esc(file.name)} — ${esc(e.message)}`); continue; }
      cache(id, r);
      if (r.warning) warn.push(`${esc(file.name)} — ${esc(r.warning)}`);
      const crop = defaultCrop(r);
      allFiles.push({ name: file.name, label: r.name, raw: new RawRef(id, toB64(bytes)), crop, aspect: aspectOf(crop.w, crop.h), cropDef: true, linked: false, clamped: false, adjDef: true });
    }
    loadAlerts = bad.length ? buildAlertsHtml(bad, [], undefined, 'sem-dismiss-invalid') : '';
    uploadAlerts = dup.length ? buildAlertsHtml([], dup, 'Already loaded:', '', 'sem-dismiss-upload') : '';
    warnAlerts = warn.length ? buildAlertsHtml([], warn, 'Loaded, but check:', '', 'sem-dismiss-warn') : '';
    rebuildAlerts();
    afterFilesChange();
  });

  /* ---- File list ---- */
  // The list's rows: its download reads a file's bytes (rawBytes) only when pressed.
  const listView = ()=> allFiles.map(f=> ({ name: f.name, label: f.label, included: f.included, get rawBytes(){ return fromB64(f.raw.b64); } }));
  function fileCallbacks(){
    return {
      onRemove(i){ removeFileAt(allFiles, i, []); afterFilesChange(); },
      onReorder(from, to){ moveFileTo(allFiles, from, to, []); afterFilesChange(); },
      onInclude(i, on){ setIncluded(allFiles, i, on, []); afterFilesChange(); },
      onIncludeAll(on){ allFiles.forEach((_, j)=> setIncluded(allFiles, j, on, [])); afterFilesChange(); },
      onLabelChange(i, v){ allFiles[i].label = v; renderNav(); renderThumbs(); hist.commit(); },
      onRemoveAll(){ allFiles.length = 0; loadAlerts = uploadAlerts = warnAlerts = ''; rebuildAlerts(); afterFilesChange(); },
    };
  }
  const magText = r => !(r.mag > 0) ? '' : r.mag >= 1000 ? `${(r.mag/1000).toPrecision(3)} kx` : `${r.mag.toPrecision(3)} x`;

  function afterFilesChange(){
    files = includedOf(allFiles);
    cur = Math.min(cur, Math.max(0, files.length - 1));
    setTabLoaded('sem', allFiles.length);
    // The list's rows map onto allFiles by index; the download needs the RawRef.
    const view = listView();
    renderUnifiedFileList('semFileTableWrap', view, fileCallbacks());
    document.getElementById('semWorkspace').style.display = files.length ? 'block' : 'none';
    document.getElementById('semGroupsCard').style.display = files.length ? 'block' : 'none';
    syncGroups();
    // The editor's image is rebuilt: the files, and with them the reference, may differ.
    off = null;
    renderAll();
    hist.commit();
  }

  /* ---- Undo / project state ---- */
  function semSnapshot(){
    return { files: allFiles.map(f=> ({ ...f, crop: { ...f.crop }, adj: { ...(f.adj || ADJ_DEF) } })), cur, intensity: { ...intensity },
      groupInt: JSON.parse(JSON.stringify(groupInt)),
      groups: groups.map(g=> ({ ...g, members: g.members.slice() })), figures: JSON.parse(JSON.stringify(figures)) };
  }
  function semRestore(s){
    allFiles = (s && s.files || []).map(f=> ({ ...f, crop: { ...f.crop }, adj: { ...ADJ_DEF, ...(f.adj || {}) }, raw: f.raw instanceof RawRef ? f.raw : new RawRef(f.raw.id, f.raw.b64) }));
    // Settings saved before the Default boxes (v442) are default where their values are.
    const withDef = v =>{ const I = { ...INT_DEF, ...(v || {}) }; if (!v || v.def == null) I.def = isIntDef(I); return I; };
    intensity = withDef(s && s.intensity);
    groupInt = {};
    for (const [k, v] of Object.entries(s && s.groupInt || {})) groupInt[k] = withDef(v);
    groups = (s && s.groups || []).map(g=> ({ ...g, members: (g.members || []).slice() }));
    figures = s && s.figures ? JSON.parse(JSON.stringify(s.figures)) : {};
    // A project saved before v440 had one figure for all the groups: each group starts
    // from it, its file named after the group.
    if (s && !s.figures && s.figure) for (const g of groups){ const f = JSON.parse(JSON.stringify(s.figure)); delete f.file; figures[g.id] = f; }
    // Images whose bytes no longer read are left out of the list, and said so.
    const lost = allFiles.filter(f=> !dec(f));
    allFiles = allFiles.filter(f=> !lost.includes(f));
    allFiles.forEach(f=>{ if (f.cropDef == null) f.cropDef = isDefaultCrop(f); if (f.adjDef == null) f.adjDef = isAdjDef(f.adj); });
    loadAlerts = lost.length ? buildAlertsHtml(lost.map(f=> `${esc(f.name)} — its stored bytes no longer read as a Tescan TIFF`), [], undefined, 'sem-dismiss-invalid') : '';
    uploadAlerts = warnAlerts = '';
    cur = s && Number.isInteger(s.cur) ? s.cur : 0;
    rebuildAlerts();
    afterFilesChange();
    // An undo with the figure open: it shows the settings now in force.
    if (figApi && figApi.open) figApi.refresh();
  }
  const hist = registerHistory('sem', semSnapshot, semRestore);
  registerTabRedraw('sem', ()=>{ if (files.length){ fitWork(); sizeGroups(); fitView(); drawEditor(); drawHist(); } });

  /* ---- Rendering ---- */
  function renderAll(){
    if (!files.length) return;
    renderNav(); renderInfo(); renderFields(); fitWork(); renderThumbs();
    loadEditorImage(); fitView(); drawEditor();
    renderIntensity(); renderGroups();
  }
  // Something that changes the curves (a crop, the normalisation, a correction): every
  // view of the images drawn again.
  function refreshLevels(){
    off = null; loadEditorImage(); drawEditor();
    renderThumbs(); renderIntensity(); renderGroups(); renderFields();
  }
  function renderNav(){
    const f = files[cur];
    document.getElementById('semIdx').textContent = files.length ? `${cur + 1}/${files.length}` : '0/0';
    document.getElementById('semCurName').textContent = f ? f.label : '—';
  }
  function renderInfo(){
    const f = files[cur], e = f && dec(f);
    const box = document.getElementById('semInfo');
    if (!e){ box.innerHTML = ''; return; }
    const r = e.r;
    const rows = [
      ['Image', `${r.width} × ${r.imageH} px${r.strip ? ` (info bar of ${r.strip} rows left out)` : ''}`],
      ['Pixel size', `${sig(r.pixelNm, 4)} nm`],
      ['Field of view', `${sig(r.fovUm, 4)} µm`],
      ['Magnification', magText(r) || '—'],
      ['Beam', `${sig(r.kV, 3)} kV · WD ${sig(r.wdMm, 3)} mm`],
      ['Detector', `${esc(r.detector || '—')} · gain ${sig(r.gain, 4)}, offset ${sig(r.offset, 4)}`],
      ['Acquired', esc(`${r.date} ${r.time}`.trim() || '—') + (r.device ? ` · ${esc(r.device)}` : '')],
    ];
    // The crop, and what the figure takes of it in its group (narrowed, at its pixel).
    const c = f.crop, um = v => sig(v*r.pixelNm/1000, 4), o = outOf(f);
    rows.push(['Crop', `${c.w} × ${c.h} px, ${um(c.w)} × ${um(c.h)} µm${f.clamped ? ' ⚠ narrowed to fit' : ''}`]);
    if (o) rows.push(['In the figure', `${o.w} × ${o.h} px at ${sig(o.px, 4)} nm${o.c.w !== c.w || o.c.h !== c.h ? `, ${um(o.c.w)} × ${um(o.c.h)} µm of the crop` : ''}`]);
    box.innerHTML = rows.map(([k, v])=> `<div class="sem-info-row"><span class="txt-meta">${k}</span><span>${v}</span></div>`).join('')
      + (r.warning ? `<div class="alert warn" style="margin-top:8px">⚠ ${esc(r.warning)}</div>` : '');
  }
  // The crop's fields, locked while it is the default.
  function renderFields(){
    const f = files[cur], e = f && dec(f);
    if (!e) return;
    const c = f.crop;
    ['x', 'y', 'w', 'h'].forEach(k=>{ const el = document.getElementById('semCrop' + k.toUpperCase()); if (document.activeElement !== el) el.value = String(c[k]); el.disabled = !!f.cropDef; });
    const asp = document.getElementById('semAspect');
    asp.value = f.aspect; asp.disabled = !!f.cropDef;
    document.getElementById('semCropDef').checked = !!f.cropDef;
    renderInfo();
  }
  // Every included image with its crop drawn on it; a press shows it in the editor, its
  // chain links its crop to the other linked images'.
  const LINK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>';
  function renderThumbs(){
    const box = document.getElementById('semThumbs');
    box.innerHTML = '';
    files.forEach((f, i)=>{
      const e = dec(f); if (!e) return;
      const sm = e.small, k = 1/sm.k, cv = toCanvas(sm.px, sm.w, 0, 0, sm.w, sm.h, lutOf(f));
      const ctx = cv.getContext('2d');
      const c = f.crop;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.rect(0, 0, cv.width, cv.height); ctx.rect(c.x*k, c.y*k, c.w*k, c.h*k); ctx.fill('evenodd');
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(c.x*k + 0.5, c.y*k + 0.5, Math.max(1, c.w*k - 1), Math.max(1, c.h*k - 1));
      const wrap = document.createElement('div');
      wrap.className = 'sem-thumb-wrap';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sem-thumb' + (i === cur ? ' is-on' : ''); b.title = f.label;
      b.dataset.i = i;
      b.appendChild(cv);
      const cap = document.createElement('span');
      const r = isRef(f);
      cap.className = 'sem-thumb-cap'; cap.textContent = (r ? '◎ ' : '') + f.label + (f.clamped ? ' ⚠' : '');
      if (r) b.title = f.label + ' — the reference';
      if (f.clamped) b.title += ' — its crop was narrowed to fit it';
      // Out of the images the selector chose: dimmed (a click on it chooses its group).
      const sc = scopeOf();
      if (sc !== 'all' && (!groupOf(f) || groupOf(f).id !== sc)) wrap.classList.add('is-out');
      b.appendChild(cap);
      const ln = document.createElement('button');
      ln.type = 'button'; ln.className = 'sem-link' + (f.linked ? ' is-on' : ''); ln.dataset.link = i; ln.innerHTML = LINK_SVG;
      ln.setAttribute('aria-pressed', String(!!f.linked));
      ln.title = f.linked ? 'Linked: its crop is shared with the other linked images. Click to unlink it' : 'Link its crop to the other linked images';
      wrap.append(b, ln);
      box.appendChild(wrap);
    });
  }
  document.getElementById('semThumbs').addEventListener('click', e=>{
    const ln = e.target.closest('.sem-link');
    if (ln){ setLinked(files[+ln.dataset.link], !files[+ln.dataset.link].linked); return; }
    const b = e.target.closest('.sem-thumb'); if (!b) return;
    go(+b.dataset.i);
  });
  function go(i){
    if (!files.length) return;
    cur = (i + files.length) % files.length;
    renderAll();
  }
  document.getElementById('semPrev').addEventListener('click', ()=> go(cur - 1));
  document.getElementById('semNext').addEventListener('click', ()=> go(cur + 1));

  /* ---- The crop editor ----
     The image drawn into a canvas with the view (scale s in CSS px a pixel, and the
     image's top-left at ox, oy); the crop over it, the rest darkened, with eight
     handles. Dragging a handle or a side resizes, inside moves, outside pans; the
     wheel zooms about the pointer, a double click outside the crop fits the image. */
  const view = { s: 1, ox: 0, oy: 0 };
  // The current image at full size through its curve; null when the image, its crop
  // (its statistics) or the curve has changed since.
  let off = null, offId = null;
  function loadEditorImage(){
    const f = files[cur], e = f && dec(f);
    if (!e || (off && offId === f.raw.id)) return;
    off = toCanvas(e.r.pixels, e.r.width, 0, 0, e.r.width, e.r.imageH, lutOf(f));
    offId = f.raw.id;
  }
  // (Pointer positions are taken on the canvas, which fills the pane inside its border:
  // the view's origin.)
  const canvas = document.getElementById('semCropCanvas'), host = canvas.parentElement;
  // The pane's size: as wide as its column, as tall as the image at that width, at
  // most 70 % of the window's height.
  function paneSize(){
    const f = files[cur], e = f && dec(f);
    const w = Math.max(1, host.clientWidth), ar = e ? e.r.imageH/e.r.width : 1;
    return [w, Math.max(160, Math.min(Math.round(w*ar), Math.round(window.innerHeight*0.7)))];
  }
  function fitView(){
    const f = files[cur], e = f && dec(f);
    if (!e) return;
    const [w, h] = paneSize();
    host.style.height = h + 'px';
    const s = Math.min(w/e.r.width, h/e.r.imageH);
    Object.assign(view, { s, ox: (w - s*e.r.width)/2, oy: (h - s*e.r.imageH)/2 });
  }
  function drawEditor(){
    const f = files[cur], e = f && dec(f);
    if (!e || !off) return;
    const dpr = window.devicePixelRatio || 1, w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)){ canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // Smoothed when shrunk, pixels kept sharp when enlarged.
    ctx.imageSmoothingEnabled = view.s < 2;
    const W = e.r.width, H = e.r.imageH, c = f.crop, X = x => view.ox + x*view.s, Y = y => view.oy + y*view.s;
    ctx.drawImage(off, X(0), Y(0), W*view.s, H*view.s);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.rect(X(0), Y(0), W*view.s, H*view.s); ctx.rect(X(c.x), Y(c.y), c.w*view.s, c.h*view.s); ctx.fill('evenodd');
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeRect(X(c.x), Y(c.y), c.w*view.s, c.h*view.s);
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.strokeRect(X(c.x), Y(c.y), c.w*view.s, c.h*view.s);
    // Narrowed by its group to the common field: what the figure takes, dashed.
    const o = outOf(f);
    if (o && (o.c.w !== c.w || o.c.h !== c.h)){
      ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff';
      ctx.strokeRect(X(o.c.x), Y(o.c.y), o.c.w*view.s, o.c.h*view.s); ctx.setLineDash([]);
    }
    for (const [hx, hy] of handlePoints(c)){
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1;
      ctx.fillRect(X(hx) - 4.5, Y(hy) - 4.5, 9, 9); ctx.strokeRect(X(hx) - 4.5, Y(hy) - 4.5, 9, 9);
    }
    // The area being drawn with Zoom area (the plots' colours).
    if (zoomBox){
      const zx = Math.min(zoomBox.x0, zoomBox.x1), zy = Math.min(zoomBox.y0, zoomBox.y1), zw = Math.abs(zoomBox.x1 - zoomBox.x0), zh = Math.abs(zoomBox.y1 - zoomBox.y0);
      ctx.fillStyle = 'rgba(100,160,255,0.12)'; ctx.fillRect(zx, zy, zw, zh);
      ctx.strokeStyle = 'rgba(100,160,255,0.7)'; ctx.lineWidth = 1; ctx.strokeRect(zx + 0.5, zy + 0.5, zw, zh);
    }
  }
  // The handles, in image pixels: corners and the middle of each side.
  const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  function handlePoints(c){
    const xs = { w: c.x, m: c.x + c.w/2, e: c.x + c.w }, ys = { n: c.y, m: c.y + c.h/2, s: c.y + c.h };
    return HANDLES.map(hd=> [xs[hd.includes('w') ? 'w' : hd.includes('e') ? 'e' : 'm'], ys[hd.includes('n') ? 'n' : hd.includes('s') ? 's' : 'm']]);
  }
  const CURSOR = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', move: 'move', pan: 'grab' };
  function hitTest(px, py, touch){
    const f = files[cur], c = f.crop, rad = touch ? 18 : 9;
    const pts = handlePoints(c);
    for (let k = 0; k < 8; k++){
      const sx = view.ox + pts[k][0]*view.s, sy = view.oy + pts[k][1]*view.s;
      if (Math.abs(px - sx) <= rad && Math.abs(py - sy) <= rad) return HANDLES[k];
    }
    // Then the sides anywhere along them, not only at their middle handle.
    const X0 = view.ox + c.x*view.s, X1 = X0 + c.w*view.s, Y0 = view.oy + c.y*view.s, Y1 = Y0 + c.h*view.s;
    const alongX = px > X0 && px < X1, alongY = py > Y0 && py < Y1;
    if (alongY && Math.abs(px - X0) <= rad) return 'w';
    if (alongY && Math.abs(px - X1) <= rad) return 'e';
    if (alongX && Math.abs(py - Y0) <= rad) return 'n';
    if (alongX && Math.abs(py - Y1) <= rad) return 's';
    return px >= X0 && px <= X1 && py >= Y0 && py <= Y1 ? 'move' : 'pan';
  }
  /* A resize from c0 by the pointer's move (dx, dy, image pixels) with handle hd: the
     opposite side or corner stays; with a locked ratio a corner scales both sides by
     the mean of the two moves, a side the other dimension about its middle. */
  function resized(c0, hd, dx, dy, W, H, r){
    const L = hd.includes('w'), R = hd.includes('e'), T = hd.includes('n'), B = hd.includes('s');
    let x0 = c0.x, x1 = c0.x + c0.w, y0 = c0.y, y1 = c0.y + c0.h;
    const minW = Math.min(MIN_CROP, W), minH = Math.min(MIN_CROP, H);
    if (!r){
      if (L) x0 = Math.min(Math.max(0, x0 + dx), x1 - minW);
      if (R) x1 = Math.max(Math.min(W, x1 + dx), x0 + minW);
      if (T) y0 = Math.min(Math.max(0, y0 + dy), y1 - minH);
      if (B) y1 = Math.max(Math.min(H, y1 + dy), y0 + minH);
      return { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
    }
    let w, h;
    if ((L || R) && (T || B)){
      const sw = (c0.w + (R ? dx : -dx))/c0.w, sh = (c0.h + (B ? dy : -dy))/c0.h, k = (sw + sh)/2;
      w = c0.w*k;
      // room from the corner that stays
      const roomW = R ? W - x0 : x1, roomH = B ? H - y0 : y1;
      w = Math.max(Math.max(minW, minH*r), Math.min(w, roomW, roomH*r)); h = w/r;
      return fitCrop({ x: R ? x0 : x1 - w, y: B ? y0 : y1 - h, w, h }, W, H, r);
    }
    const cx = c0.x + c0.w/2, cy = c0.y + c0.h/2;
    if (L || R){
      w = c0.w + (R ? dx : -dx);
      const room = R ? W - x0 : x1;
      w = Math.max(Math.max(minW, minH*r), Math.min(w, room, H*r)); h = w/r;
      return fitCrop({ x: R ? x0 : x1 - w, y: cy - h/2, w, h }, W, H, r);
    }
    h = c0.h + (B ? dy : -dy);
    const room = B ? H - y0 : y1;
    h = Math.max(Math.max(minH, minW/r), Math.min(h, room, W/r)); w = h*r;
    return fitCrop({ x: cx - w/2, y: B ? y0 : y1 - h, w, h }, W, H, r);
  }
  /* The toolbar on the image, as on the plots: Fit, Pan and Zoom area. With no tool on,
     the image stays fitted and still, the wheel scrolls the page, and a drag works the
     crop; Pan drags the view, Zoom area zooms into the rectangle drawn. With a tool on,
     the wheel zooms about the pointer and a double click fits the image again. */
  let tool = null, drag = null, zoomBox = null;
  function setTool(t){
    tool = t;
    document.getElementById('semToolPan').classList.toggle('is-on', t === 'pan');
    document.getElementById('semToolZoom').classList.toggle('is-on', t === 'zoom');
    host.closest('.plot-wrap').classList.toggle('tool-armed', !!t);
    host.style.cursor = t === 'pan' ? 'move' : t === 'zoom' ? 'crosshair' : '';
  }
  document.getElementById('semToolPan').addEventListener('click', ()=> setTool(tool === 'pan' ? null : 'pan'));
  document.getElementById('semToolZoom').addEventListener('click', ()=> setTool(tool === 'zoom' ? null : 'zoom'));
  document.getElementById('semToolFit').addEventListener('click', ()=>{ fitView(); drawEditor(); });
  host.addEventListener('pointerdown', e=>{
    if (e.button !== 0 || !files.length) return;
    const b = canvas.getBoundingClientRect(), px = e.clientX - b.left, py = e.clientY - b.top;
    const mode = tool || hitTest(px, py, e.pointerType === 'touch'), f = files[cur];
    // Outside the crop with no tool on, nothing: the view does not move unless asked.
    if (mode === 'pan' && !tool) return;
    drag = { mode, px, py, c0: { ...f.crop }, ox: view.ox, oy: view.oy, moved: false };
    host.setPointerCapture(e.pointerId);
    if (mode === 'pan') host.style.cursor = 'grabbing';
    else if (mode !== 'zoom') host.style.cursor = CURSOR[mode];
    e.preventDefault();
  });
  host.addEventListener('pointermove', e=>{
    const b = canvas.getBoundingClientRect(), px = e.clientX - b.left, py = e.clientY - b.top;
    if (!drag){
      if (files.length && !tool){ const m = hitTest(px, py, e.pointerType === 'touch'); host.style.cursor = m === 'pan' ? '' : CURSOR[m]; }
      return;
    }
    const f = files[cur], r = dec(f).r, W = r.width, H = r.imageH;
    const dx = (px - drag.px)/view.s, dy = (py - drag.py)/view.s;
    drag.moved = drag.moved || Math.abs(px - drag.px) + Math.abs(py - drag.py) > 2;
    if (drag.mode === 'pan'){ view.ox = drag.ox + px - drag.px; view.oy = drag.oy + py - drag.py; }
    else if (drag.mode === 'zoom') zoomBox = { x0: drag.px, y0: drag.py, x1: px, y1: py };
    else {
      if (drag.mode === 'move') f.crop = fitCrop({ ...drag.c0, x: drag.c0.x + dx, y: drag.c0.y + dy }, W, H, null);
      else f.crop = resized(drag.c0, drag.mode, dx, dy, W, H, ASPECTS[f.aspect]);
      // The frame moved by hand: no longer the default (its box unticks).
      f.clamped = false; f.cropDef = false; renderFields();
    }
    drawEditor();
  });
  const endDrag = ()=>{
    if (!drag) return;
    const d = drag; drag = null;
    host.style.cursor = tool === 'pan' ? 'move' : tool === 'zoom' ? 'crosshair' : '';
    if (d.mode === 'zoom'){
      const z = zoomBox; zoomBox = null;
      // The rectangle drawn fills the pane (one too small to mean one is ignored).
      if (z && Math.abs(z.x1 - z.x0) > 5 && Math.abs(z.y1 - z.y0) > 5){
        const w = Math.abs(z.x1 - z.x0), h = Math.abs(z.y1 - z.y0), x = Math.min(z.x0, z.x1), y = Math.min(z.y0, z.y1);
        const k = Math.min(host.clientWidth/w, host.clientHeight/h), s2 = Math.min(32, view.s*k);
        const ix = (x + w/2 - view.ox)/view.s, iy = (y + h/2 - view.oy)/view.s;
        view.s = s2; view.ox = host.clientWidth/2 - ix*s2; view.oy = host.clientHeight/2 - iy*s2;
      }
      drawEditor();
    } else if (d.mode !== 'pan' && d.moved) cropChanged();
  };
  host.addEventListener('pointerup', endDrag);
  host.addEventListener('pointercancel', endDrag);
  host.addEventListener('wheel', e=>{
    if (!files.length || !tool) return;
    e.preventDefault();
    const b = canvas.getBoundingClientRect();
    zoomAt(e.clientX - b.left, e.clientY - b.top, Math.exp(-e.deltaY*0.004));
  }, { passive: false });
  host.addEventListener('dblclick', ()=>{ if (tool){ fitView(); drawEditor(); } });
  function zoomAt(px, py, k){
    const f = files[cur], e = dec(f);
    const fit = Math.min(host.clientWidth/e.r.width, host.clientHeight/e.r.imageH);
    const s2 = Math.min(32, Math.max(fit*0.5, view.s*k));
    view.ox = px - (px - view.ox)*s2/view.s; view.oy = py - (py - view.oy)*s2/view.s; view.s = s2;
    drawEditor();
  }

  // A crop set (dragged, typed, reset, re-ratioed): the linked images follow, and it
  // is one step of the history.
  function cropChanged(){
    const f = files[cur];
    propagate(f);
    renderFields(); refreshLevels();
    hist.commit();
  }

  /* ---- Fields ---- */
  ['X', 'Y', 'W', 'H'].forEach(K=>{
    const el = document.getElementById('semCrop' + K);
    el.addEventListener('keydown', e=>{ if (e.key === 'Enter') el.blur(); });
    el.addEventListener('change', ()=>{
      const f = files[cur]; if (!f) return;
      const r = dec(f).r, v = Math.round(parseFloat(String(el.value).replace(',', '.')));
      if (!Number.isFinite(v)){ flashFieldInvalid(el); renderFields(); return; }
      const k = K.toLowerCase(), c = { ...f.crop, [k]: v }, ar = ASPECTS[f.aspect];
      // Locked: a typed side sets the other from the ratio.
      if (ar && k === 'w') c.h = v/ar;
      if (ar && k === 'h') c.w = v*ar;
      // A size that would run past the image's edge moves the crop back inside it.
      f.crop = fitCrop(c, r.width, r.imageH, ar);
      f.clamped = false; f.cropDef = false;
      if (f.crop[k] !== v) flashFieldInvalid(el);
      cropChanged();
    });
  });
  // A new ratio keeps the crop's width and middle where it can, else its height.
  document.getElementById('semAspect').addEventListener('change', e=>{
    const f = files[cur]; if (!f) return;
    const r = dec(f).r, ar = ASPECTS[e.target.value], c = f.crop;
    f.aspect = e.target.value;
    if (ar){
      let w = c.w, h = w/ar;
      if (h > r.imageH){ h = r.imageH; w = h*ar; }
      if (w > r.width){ w = r.width; h = w/ar; }
      f.crop = fitCrop({ x: c.x + c.w/2 - w/2, y: c.y + c.h/2 - h/2, w, h }, r.width, r.imageH, ar);
    }
    f.clamped = false; f.cropDef = false;
    cropChanged();
  });
  // Default: the whole image less its bar, its fields locked; unticked, the fields open
  // on it.
  document.getElementById('semCropDef').addEventListener('change', e=>{
    const f = files[cur]; if (!f) return;
    f.cropDef = e.target.checked;
    if (f.cropDef){ const r = dec(f).r; f.crop = defaultCrop(r); f.aspect = aspectOf(f.crop.w, f.crop.h); f.clamped = false; }
    cropChanged();
  });
  // Linking an image: it takes the crop the linked ones share, if any; else it is the
  // first, and the others will take its. Unlinked, it keeps the crop it has.
  function setLinked(f, on){
    if (!f) return;
    f.linked = on;
    if (f.linked){
      const lead = allFiles.find(g=> g !== f && g.linked);
      if (lead) takeCrop(f, lead.crop, lead.aspect);
    } else f.clamped = false;
    renderFields(); refreshLevels();
    hist.commit();
  }
  // Link all: the images the selector chose, around the crop of the one in the editor
  // (it leads); all of them linked already, it unlinks them.
  const scopeFiles = ()=>{ const sc = scopeOf(); return files.filter(f=> sc === 'all' || (groupOf(f) && groupOf(f).id === sc)); };
  document.getElementById('semLinkAll').addEventListener('click', ()=>{
    const f = files[cur], fs = scopeFiles(); if (!f || !fs.length) return;
    if (fs.every(g=> g.linked)) fs.forEach(g=>{ g.linked = false; g.clamped = false; });
    else {
      // Others linked outside the chosen images follow the lead too: one linked crop.
      allFiles.forEach(g=>{ if (g.linked && !fs.includes(g)) g.linked = false; });
      f.linked = true;
      fs.forEach(g=>{ if (g !== f){ g.linked = true; takeCrop(g, f.crop, f.aspect); } });
    }
    renderFields(); refreshLevels();
    hist.commit();
  });
  function renderLinkAll(){
    const fs = scopeFiles(), b = document.getElementById('semLinkAll');
    b.textContent = fs.length && fs.every(g=> g.linked) ? 'Unlink all' : 'Link all';
  }

  /* ---- Groups and scale ----
     The images in the figure (included, and not a reference kept out of it) are
     grouped by pixel size, two within 10 % in one group, each named by its
     magnification; a group's images share one scale bar. A group at common scale
     brings its images to its largest pixel size (the others reduced by averaging over
     the pixels each new one covers, never enlarged: nothing is invented) and to its
     smallest field of view, each crop narrowed about its middle; at its own scale an
     image keeps its pixels and its crop. Groups can be renamed, an image moved to
     another or to a new one, and empty groups added (kept, as one emptied by hand, until
     removed); Reset starts again. */
  const GROUP_TOL = 1.10;
  // The reference is always one of the figure's images (v442: no reference kept out).
  const inFigure = f => f.included !== false;
  const byId = id => allFiles.find(f=> f.raw.id === id);
  const groupOf = f => groups.find(g=> g.members.includes(f.raw.id)) || null;
  const pixelOf = f => { const e = dec(f); return e ? e.r.pixelNm : NaN; };
  // A group's name: the magnification of its image with the largest pixel size, the
  // one its common scale brings the others to.
  function groupName(ids){
    const r = ids.map(id=> byId(id)).filter(f=> f && dec(f)).map(f=> dec(f).r).sort((a, b)=> b.pixelNm - a.pixelNm)[0];
    return r ? magText(r) || `${sig(r.pixelNm, 3)} nm/px` : 'group';
  }
  const newGroupId = ()=>{ let k = 1; while (groups.some(g=> g.id === 'g' + k)) k++; return 'g' + k; };
  // An image into the group whose pixel sizes it stays within 10 % of, else a new one
  // (never into an empty group: it has no pixel size to be near).
  function placeImage(f){
    const p = pixelOf(f);
    const g = groups.find(g=>{ if (!g.members.length) return false; const ps = g.members.map(id=> pixelOf(byId(id))).filter(Number.isFinite).concat(p); return Math.max(...ps)/Math.min(...ps) <= GROUP_TOL; });
    if (g) g.members.push(f.raw.id);
    else groups.push({ id: newGroupId(), name: '', named: false, mode: 'common', members: [f.raw.id] });
  }
  // The groups kept in step with the images: gone ones dropped, new ones placed, groups
  // left empty removed unless made or emptied by hand, unnamed ones named after their
  // images.
  function syncGroups(){
    const ids = new Set(allFiles.map(f=> f.raw.id));
    groups.forEach(g=>{ g.members = g.members.filter(id=> ids.has(id)); });
    const placed = new Set(groups.flatMap(g=> g.members));
    allFiles.forEach(f=>{ if (!placed.has(f.raw.id) && dec(f)) placeImage(f); });
    groups = groups.filter(g=> g.members.length || g.keep);
    tidyGroups();
    // Lowest magnification first; empty groups last, in the order they were made.
    const px = g => g.members.length ? pixelOf(byId(g.members[0])) : -1;
    groups.sort((a, b)=> px(b) - px(a));
  }
  // Names, and what goes with a group that is gone (its figure, its intensity).
  function tidyGroups(){
    groups.forEach(g=>{ if (!g.named && g.members.length) g.name = groupName(g.members); });
    for (const o of [figures, groupInt]) for (const k of Object.keys(o)) if (!groups.some(g=> g.id === k)) delete o[k];
  }
  /* What the figure takes from an image (null when it is not in the figure):
     { c (the crop, narrowed to the group's field), px (nm a pixel), w, h (its size in
     the figure's pixels) }. */
  function outOf(f){
    if (!inFigure(f)) return null;
    const g = groupOf(f), e = dec(f);
    if (!g || !e) return null;
    if (g.mode === 'own') return { c: { ...f.crop }, px: e.r.pixelNm, w: f.crop.w, h: f.crop.h };
    const mem = g.members.map(byId).filter(m=> m && inFigure(m) && dec(m));
    const pT = Math.max(...mem.map(pixelOf));
    const fovW = Math.min(...mem.map(m=> m.crop.w*pixelOf(m))), fovH = Math.min(...mem.map(m=> m.crop.h*pixelOf(m)));
    const p = e.r.pixelNm, w = Math.min(f.crop.w, Math.round(fovW/p)), h = Math.min(f.crop.h, Math.round(fovH/p));
    const c = { x: f.crop.x + Math.floor((f.crop.w - w)/2), y: f.crop.y + Math.floor((f.crop.h - h)/2), w, h };
    return { c, px: pT, w: Math.max(1, Math.round(fovW/pT)), h: Math.max(1, Math.round(fovH/pT)) };
  }
  /* A region of 16-bit levels (row length W) brought to w × h: each new pixel the mean
     of the old ones it covers, in part where it covers them in part (separable: rows,
     then columns). Only ever reduces here; at the same size it is a copy. */
  function resample(px, W, c, w, h){
    const weights = (n, m) => { const k = n/m, out = [];
      for (let j = 0; j < m; j++){ const a = j*k, b = (j + 1)*k, lst = [];
        for (let i = Math.floor(a); i < Math.min(n, Math.ceil(b)); i++){ const wt = Math.min(b, i + 1) - Math.max(a, i); if (wt > 1e-9) lst.push(i, wt/k); }
        out.push(lst); }
      return out; };
    const wx = weights(c.w, w), wy = weights(c.h, h), tmp = new Float32Array(w*c.h), out = new Uint16Array(w*h);
    for (let y = 0; y < c.h; y++){
      const row = (c.y + y)*W + c.x;
      for (let x = 0; x < w; x++){ const l = wx[x]; let sum = 0; for (let t = 0; t < l.length; t += 2) sum += px[row + l[t]]*l[t + 1]; tmp[y*w + x] = sum; }
    }
    for (let y = 0; y < h; y++){
      const l = wy[y];
      for (let x = 0; x < w; x++){ let sum = 0; for (let t = 0; t < l.length; t += 2) sum += tmp[l[t]*w + x]*l[t + 1]; out[y*w + x] = Math.min(65535, Math.round(sum)); }
    }
    return out;
  }
  // An image as the figure will take it, through its curve, at the figure's pixels or
  // brought down to `fit` px across (for the cards).
  function outCanvas(f, fit){
    const o = outOf(f), e = dec(f);
    if (!o) return null;
    const k = fit ? Math.min(1, fit/Math.max(o.w, o.h)) : 1, w = Math.max(1, Math.round(o.w*k)), h = Math.max(1, Math.round(o.h*k));
    return toCanvas(resample(e.r.pixels, e.r.width, o.c, w, h), w, 0, 0, w, h, lutOf(f));
  }
  /* A group's box: its name (plain text, a field on hover and while edited, as the
     project's name), its scale and its figure on one side; its images in one row on
     the other, scrolling sideways when they do not fit, each with its name under it.
     An empty group says where its images go, its figure disabled. A group whose images
     are all out of the figure (unticked, or the reference only) is not shown. */
  const nameCtx = document.createElement('canvas').getContext('2d');
  function fitGroupName(el){
    // Its room: the head's width less the scale and the figure's button beside it.
    const acts = el.parentElement.querySelector('.sem-group-acts'), cs = getComputedStyle(el);
    const fig = el.parentElement.querySelector('.sem-group-fig'), wraps = getComputedStyle(el.parentElement).flexWrap === 'wrap';
    const room = el.parentElement.clientWidth - (wraps ? fig.offsetWidth : acts.offsetWidth) - 16;
    if (!room) return;
    nameCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    el.style.width = Math.min(nameCtx.measureText(el.value || el.placeholder).width + 24, room + 10) + 'px';
  }
  function renderGroups(){
    const box = document.getElementById('semGroups');
    if (!box || !files.length) return;
    box.innerHTML = groups.map(g=>{
      const mem = g.members.map(byId).filter(m=> m && inFigure(m));
      if (!mem.length && g.members.length) return '';
      const empty = !mem.length;
      return `<div class="sem-group${empty ? ' is-empty' : ''}" data-g="${g.id}" data-drop="${g.id}">
        <div class="sem-group-head">
          <input type="text" class="sem-group-name" data-g="${g.id}" value="${esc(g.name)}" placeholder="Group name" spellcheck="false" aria-label="Group name" title="The group's name, on its figure and its file. Emptied, it goes back to the magnification">
          <div class="sem-group-acts">
            <div class="sem-scale" role="radiogroup" aria-label="Scale">${[['common', 'common scale', 'One scale for the group: its images brought to its largest pixel size and smallest field, one scale bar'], ['own', 'own scale', 'Each image its own pixels and crop, and its own scale bar']].map(([v, t, tip])=>
              `<label class="sem-radio" title="${tip}"><input type="radio" class="sem-group-mode" name="semScale-${g.id}" data-g="${g.id}" value="${v}"${g.mode === v ? ' checked' : ''}> ${t}</label>`).join('')}</div>
            <button class="btn primary btn-sm sem-group-fig" type="button" data-fig="${g.id}"${empty ? ' disabled title="No images in this group yet"' : ' title="Lay this group\'s images out into a figure"'}>Figure composer</button>
          </div>
        </div>
        <div class="sem-strip">
          <button class="sem-page sem-page-prev" type="button" data-page="-1" aria-label="Previous images" hidden>&#8249;</button>
          <div class="sem-group-imgs">${empty
            ? `<div class="sem-group-hint txt-meta">Empty: drag images here. <button class="btn btn-sm" type="button" data-del="${g.id}" title="Remove this empty group">Remove</button></div>`
            : mem.map(m=> `<div class="sem-gimg" data-id="${esc(m.raw.id)}" title="${esc(m.label)}"><div class="sem-gimg-pic"></div><span class="sem-thumb-cap">${esc(m.label)}</span></div>`).join('')}</div>
          <button class="sem-page sem-page-next" type="button" data-page="1" aria-label="Next images" hidden>&#8250;</button>
        </div>
      </div>`;
    }).join('');
    sizeGroups();
    box.querySelectorAll('.sem-gimg').forEach(el=>{ const f = byId(el.dataset.id), cv = f && outCanvas(f, 200); if (cv) el.querySelector('.sem-gimg-pic').appendChild(cv); });
    box.querySelectorAll('.sem-group-name').forEach(fitGroupName);
    box.querySelectorAll('.sem-group-imgs').forEach(row=>{ row.addEventListener('scroll', ()=> pageArrows(row), { passive: true }); pageArrows(row); });
  }
  /* The groups' height: a box 4φ : 1 at full screen, kept whatever the window. Full
     screen is the screen's width, at most the page's 1500 px, less what lies around a
     group now (the page's and the card's margins). The images take what the height
     leaves under the head and over their names, never under 80 px (on a phone, where
     4φ : 1 would leave next to nothing, the box grows instead). */
  const PHI4 = 4*(1 + Math.sqrt(5))/2;
  // The full-screen width, worked out once, at the first layout: resizing the window
  // must not change the height.
  let groupFull = null;
  function sizeGroups(){
    const box = document.getElementById('semGroups'), g = box.querySelector('.sem-group');
    if (!g || !box.clientWidth) return;
    const main = document.querySelector('main'), mcs = getComputedStyle(main);
    const pad = parseFloat(mcs.paddingLeft) + parseFloat(mcs.paddingRight);
    const around = main.clientWidth - pad - g.offsetWidth;
    const scr = screen.availWidth || window.innerWidth;
    if (!groupFull) groupFull = { scr, w: Math.min(Math.max(scr, window.innerWidth), parseFloat(mcs.maxWidth) || Infinity) - pad - around };
    const full = groupFull.w;
    const gcs = getComputedStyle(g), head = g.querySelector('.sem-group-head').offsetHeight;
    const cap = 4 + 16;   // the gap and the name under an image
    const chrome = parseFloat(gcs.paddingTop) + parseFloat(gcs.paddingBottom) + parseFloat(gcs.borderTopWidth) + parseFloat(gcs.borderBottomWidth) + head + parseFloat(gcs.rowGap || 8) + cap;
    const H = Math.round(full/PHI4), img = Math.max(80, Math.floor(H - chrome));
    box.style.setProperty('--sem-img', img + 'px');
    box.style.setProperty('--sem-group-h', Math.max(H, Math.ceil(chrome + img)) + 'px');
  }
  /* A group's row of images, wider than the box: an arrow at each end where there is
     more, boxed, as tall as the images and outside the row, turns a page — the row
     slides by what it shows, landing on an image's edge (scroll snap). A finger can
     also swipe it. */
  function pageArrows(row){
    const strip = row.parentElement, more = row.scrollWidth - row.clientWidth;
    strip.querySelector('.sem-page-prev').hidden = !(more > 1 && row.scrollLeft > 1);
    strip.querySelector('.sem-page-next').hidden = !(more > 1 && row.scrollLeft < more - 1);
  }
  window.addEventListener('resize', ()=>{ sizeGroups(); document.querySelectorAll('#semGroups .sem-group-imgs').forEach(pageArrows); fitWork(); });
  /* Crop and intensity in three columns, until a field's name would be cut short ("…"):
     then one column, the image on top, the thumbnails, the settings under them. Tried
     in three columns at every resize (synchronously, so nothing is painted between). */
  function fitWork(){
    const work = document.querySelector('.sem-work');
    if (!work || !work.offsetWidth) return;
    const was = work.classList.contains('sem-stacked');
    work.classList.remove('sem-stacked');
    const cut = [...work.querySelectorAll('.sem-fr .txt-label')].some(l=> l.scrollWidth > l.clientWidth + 0.5);
    work.classList.toggle('sem-stacked', cut);
    // The editor and the histogram are sized to their column: redrawn when it changes.
    if (cut !== was && files.length){ fitView(); drawEditor(); drawHist(); }
  }
  const groupsBox = document.getElementById('semGroups'), groupsCard = document.getElementById('semGroupsCard');
  groupsBox.addEventListener('input', e=>{ if (e.target.classList.contains('sem-group-name')) fitGroupName(e.target); });
  groupsBox.addEventListener('change', e=>{
    const t = e.target;
    if (t.classList.contains('sem-group-name')){
      const g = groups.find(g=> g.id === t.dataset.g); if (!g) return;
      const v = t.value.trim();
      // Emptied, a name goes back to the images' magnification.
      g.named = !!v; g.name = v || (g.members.length ? groupName(g.members) : 'New group');
    } else if (t.classList.contains('sem-group-mode')){
      const g = groups.find(g=> g.id === t.dataset.g); if (!g) return;
      g.mode = t.value;
    } else return;
    groupsChanged();
  });
  function groupsChanged(){
    renderGroups(); renderFields(); renderIntensity(); drawEditor();
    hist.commit();
  }
  // An image into another group, or into a new one ('new'). A group it leaves empty
  // stays, with its name and figure, until removed.
  function moveImage(id, to){
    const from = groups.find(g=> g.members.includes(id));
    if (!from || from.id === to) return;
    if (to === 'new' && from.members.length === 1) return;
    const into = to === 'new' ? { id: newGroupId(), name: '', named: false, mode: 'common', members: [] } : groups.find(g=> g.id === to);
    if (!into) return;
    from.members = from.members.filter(m=> m !== id);
    if (!from.members.length) from.keep = true;
    into.members.push(id);
    if (to === 'new') groups.push(into);
    tidyGroups();
    groupsChanged();
  }
  // + Group: an empty group, to drag images into.
  document.getElementById('semAddGroup').addEventListener('click', ()=>{
    groups.push({ id: newGroupId(), name: 'New group', named: false, mode: 'common', members: [], keep: true });
    groupsChanged();
  });
  /* Dragging an image between groups (pointer events: a mouse and a finger alike): a
     copy of it follows the pointer, the group under it lights (or + Group, for a new
     one), and the drop moves it there. A press without a move does nothing. A finger
     first holds the image still a moment: a swipe over the images scrolls the page. */
  let gdrag = null;
  const HOLD_MS = 300;
  const dropTargets = ()=> groupsCard.querySelectorAll('[data-drop]');
  groupsBox.addEventListener('pointerdown', e=>{
    const card = e.target.closest('.sem-gimg');
    if (!card || e.button !== 0) return;
    const touch = e.pointerType === 'touch';
    gdrag = { id: card.dataset.id, card, x0: e.clientX, y0: e.clientY, ghost: null, over: null, held: !touch, timer: 0 };
    if (touch) gdrag.timer = setTimeout(()=>{ if (gdrag && gdrag.card === card){ gdrag.held = true; card.classList.add('is-held'); } }, HOLD_MS);
    else { card.setPointerCapture(e.pointerId); e.preventDefault(); }
  });
  groupsBox.addEventListener('pointermove', e=>{
    if (!gdrag) return;
    const moved = Math.abs(e.clientX - gdrag.x0) + Math.abs(e.clientY - gdrag.y0);
    // A finger that moves before the hold is a scroll: no drag.
    if (!gdrag.held){ if (moved > 8) endGroupDrag(); return; }
    if (!gdrag.ghost){
      if (moved < 5) return;
      const pic = gdrag.card.querySelector('canvas'), g = document.createElement('canvas');
      g.width = pic.width; g.height = pic.height; g.getContext('2d').drawImage(pic, 0, 0);
      g.className = 'sem-drag-ghost'; document.body.appendChild(g);
      gdrag.ghost = g; gdrag.card.classList.add('is-dragged');
    }
    gdrag.ghost.style.left = e.clientX + 'px'; gdrag.ghost.style.top = e.clientY + 'px';
    const under = document.elementFromPoint(e.clientX, e.clientY), t = under && under.closest('[data-drop]');
    const to = t && groupsCard.contains(t) ? t.dataset.drop : null;
    if (to !== gdrag.over){ dropTargets().forEach(el=> el.classList.toggle('is-drop', el.dataset.drop === to)); gdrag.over = to; }
  });
  // Held, the finger drags the image, not the page.
  groupsBox.addEventListener('touchmove', e=>{ if (gdrag && gdrag.held && e.cancelable) e.preventDefault(); }, { passive: false });
  groupsBox.addEventListener('contextmenu', e=>{ if (gdrag) e.preventDefault(); });
  const endGroupDrag = ()=>{
    if (!gdrag) return;
    const d = gdrag; gdrag = null;
    clearTimeout(d.timer);
    if (d.ghost) d.ghost.remove();
    d.card.classList.remove('is-dragged', 'is-held');
    dropTargets().forEach(el=> el.classList.remove('is-drop'));
    if (d.ghost && d.over) moveImage(d.id, d.over);
  };
  groupsBox.addEventListener('pointerup', endGroupDrag);
  groupsBox.addEventListener('pointercancel', endGroupDrag);
  groupsBox.addEventListener('click', e=>{
    const pg = e.target.closest('[data-page]');
    if (pg){ const row = pg.parentElement.querySelector('.sem-group-imgs'); row.scrollBy({ left: +pg.dataset.page*row.clientWidth, behavior: 'smooth' }); return; }
    const b = e.target.closest('[data-fig]'); if (b){ openFigure(b.dataset.fig); return; }
    const d = e.target.closest('[data-del]');
    if (d){ groups = groups.filter(g=> g.id !== d.dataset.del || g.members.length); tidyGroups(); groupsChanged(); }
  });
  groupsBox.addEventListener('keydown', e=>{ if (e.key === 'Enter' && e.target.classList.contains('sem-group-name')) e.target.blur(); });
  // Reset: the groups made again from the pixel sizes. A group made again with the same
  // images keeps its figure and its intensity.
  document.getElementById('semRegroup').addEventListener('click', ()=>{
    const key = g => g.members.slice().sort().join('|');
    const oldFig = new Map(groups.map(g=> [key(g), figures[g.id]])), oldInt = new Map(groups.map(g=> [key(g), groupInt[g.id]]));
    groups = [];
    const keptFig = {}, keptInt = {};
    syncGroups();
    groups.forEach(g=>{ const f = oldFig.get(key(g)), i = oldInt.get(key(g)); if (f) keptFig[g.id] = f; if (i) keptInt[g.id] = i; });
    figures = keptFig; groupInt = keptInt;
    groupsChanged();
  });

  /* ---- The figure (sem-figure.js, loaded when first opened) ----
     It gets the images in the figure, in the file list's order, each as the figure
     takes it: its group, its size in the figure's pixels, and a key that changes
     whenever its pixels would (its narrowed crop, the curve and what the curve is
     computed from), so that it is drawn again only then. */
  let figApi = null;
  // A group's images in its figure, in the file list's order.
  function figureImages(gid){
    return files.filter(f=> inFigure(f) && groupOf(f) && groupOf(f).id === gid).map(f=>{
      const o = outOf(f), g = groupOf(f), I = intOf(f), rf = refFile(I), refKey = usesRef(I) && rf ? `${rf.raw.id}:${JSON.stringify(rf.crop)}` : '';
      if (!o || !g) return null;
      return { id: f.raw.id, label: f.label, group: { id: g.id, name: g.name, mode: g.mode }, w: o.w, h: o.h, pxNm: o.px,
        key: JSON.stringify([o, I, f.adj || ADJ_DEF, refKey]), canvas: fit => outCanvas(f, fit) };
    }).filter(Boolean);
  }
  async function openFigure(gid){
    const g = groups.find(g=> g.id === gid);
    if (!g) return;
    const mod = await import('./sem-figure.js');
    figApi = mod.openSemFigure({ title: g.name, images: ()=> figureImages(gid), getFig: ()=> figures[gid] || null,
      setFig: f=>{ figures[gid] = f; hist.commit(); } });
  }

  /* ---- Intensity (the Crop and intensity card) ---- */
  const $ = id => document.getElementById(id);
  // The fields, with the range each takes; a value outside it is refused (the field
  // shakes and shows the last good one).
  const INT_FIELDS = { semPLo: ['pLo', 0, 49.9], semPHi: ['pHi', 50.1, 100], semB: ['b', -100, 100], semC: ['c', 0.05, 20], semG: ['g', 0.05, 20] };
  const ADJ_FIELDS = { semBi: ['b', -100, 100], semCi: ['c', 0.05, 20], semGi: ['g', 0.05, 20] };
  /* The images the settings apply to (the selector over the thumbnails): All, every
     image alike (`intensity`); or the groups, each its own (groupInt), the one shown
     being the group of the image in the editor. Going from All to the groups, every
     group starts from All's settings; going back, All takes the settings of the group on
     show. Nothing jumps either way. */
  const scopeOf = ()=>{
    if (!Object.keys(groupInt).length) return 'all';
    const g = files[cur] && groupOf(files[cur]);
    return g ? g.id : 'all';
  };
  // The settings the fields edit (a group made since the switch starts from All's).
  function edited(){
    const sc = scopeOf();
    if (sc === 'all') return intensity;
    return groupInt[sc] || (groupInt[sc] = { ...intensity });
  }
  $('semIntScope').addEventListener('change', e=>{
    const to = e.target.value, sc = scopeOf();
    if (to === 'all'){
      if (sc !== 'all'){ intensity = { ...edited() }; groupInt = {}; }
    } else {
      if (sc === 'all') groups.forEach(g=>{ groupInt[g.id] = { ...intensity }; });
      // Shown: the group's image nearest in the list, the one in the editor if it is in it.
      const g = groups.find(g=> g.id === to), i = files.findIndex(f=> g && groupOf(f) === g);
      if (i >= 0 && groupOf(files[cur]) !== g) cur = i;
    }
    renderAll(); refreshLevels(); hist.commit();
  });
  function renderIntensity(){
    const f = files[cur];
    if (!f) return;
    const sc = scopeOf(), scope = $('semIntScope');
    scope.innerHTML = `<option value="all">All</option>` + groups.filter(g=> g.members.length).map(g=> `<option value="${g.id}">${esc(g.name)}</option>`).join('');
    scope.value = sc;
    renderLinkAll();
    const I = edited(), a = f.adj || ADJ_DEF, setv = (id, v) => { const el = $(id); if (document.activeElement !== el) el.value = String(+(+v).toPrecision(6)); };
    $('semNorm').value = I.mode;
    for (const [id, [k]] of Object.entries(INT_FIELDS)) setv(id, I[k]);
    for (const [id, [k]] of Object.entries(ADJ_FIELDS)) setv(id, a[k]);
    const rf = refFile(I);
    $('semRef').innerHTML = allFiles.map(g=> `<option value="${esc(g.raw.id)}">${esc(g.label)}</option>`).join('');
    if (rf) $('semRef').value = rf.raw.id;
    $('semIntDef').checked = !!I.def;
    $('semAdjDef').checked = f.adjDef !== false;
    // Disabled, not hidden: everything while Default is ticked, and what the
    // normalisation does not use.
    $('semNorm').disabled = $('semB').disabled = $('semC').disabled = $('semG').disabled = !!I.def;
    $('semPLo').disabled = $('semPHi').disabled = !!I.def || I.mode !== 'percentile';
    $('semRef').disabled = !!I.def || !usesRef(I);
    for (const id of Object.keys(ADJ_FIELDS)) $(id).disabled = f.adjDef !== false;
    drawHist();
  }
  // The crop's histogram (256 bins, heights as the square root of the counts), the
  // curve over it (level → grey), and where a linear normalisation puts black and white.
  function drawHist(){
    const f = files[cur], e = f && dec(f), cv = $('semHist'), box = cv.parentElement;
    if (!e || !box.clientWidth) return;
    const dpr = window.devicePixelRatio || 1, w = box.clientWidth, h = box.clientHeight;
    cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr);
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement), muted = css.getPropertyValue('--muted').trim() || '#888', accent = css.getPropertyValue('--accent').trim() || '#fb5';
    const st = statsOf(f), bins = new Float64Array(256);
    for (let v = 0; v < 65535; v++) bins[v >> 8] += st.hist[v];
    const top = Math.sqrt(Math.max(1, ...bins));
    ctx.globalAlpha = 0.45; ctx.fillStyle = muted;
    for (let i = 0; i < 256; i++){ const bh = Math.sqrt(bins[i])/top*(h - 6); ctx.fillRect(i*w/256, h - bh, Math.max(1, w/256 - 0.3), bh); }
    ctx.globalAlpha = 1;
    const nm = normOf(f), lut = lutOf(f);
    if (!nm.table){
      ctx.setLineDash([3, 3]); ctx.strokeStyle = muted; ctx.lineWidth = 1;
      for (const L of [nm.lo, nm.hi]) if (L >= 0 && L <= 65535){ const x = L/65535*w; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = accent; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let x = 0; x <= w; x++){ const y = h - 3 - lut[Math.min(65535, Math.round(x/w*65535))]/255*(h - 6); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
  function readField(el, lo, hi){
    const v = parseFloat(String(el.value).trim().replace(',', '.'));
    if (!Number.isFinite(v) || v < lo || v > hi){ flashFieldInvalid(el); return null; }
    return v;
  }
  for (const [id, [k, lo, hi]] of Object.entries(INT_FIELDS)){
    const el = $(id);
    el.addEventListener('keydown', e=>{ if (e.key === 'Enter') el.blur(); });
    el.addEventListener('change', ()=>{
      const v = readField(el, lo, hi), E = edited();
      if (v == null || !files.length || !E){ renderIntensity(); return; }
      E[k] = v; refreshLevels(); hist.commit();
    });
  }
  for (const [id, [k, lo, hi]] of Object.entries(ADJ_FIELDS)){
    const el = $(id);
    el.addEventListener('keydown', e=>{ if (e.key === 'Enter') el.blur(); });
    el.addEventListener('change', ()=>{
      const f = files[cur], v = readField(el, lo, hi);
      if (v == null || !f){ renderIntensity(); return; }
      f.adj = { ...(f.adj || ADJ_DEF), [k]: v }; refreshLevels(); hist.commit();
    });
  }
  $('semNorm').addEventListener('change', e=>{ const E = edited(); E.mode = e.target.value; refreshLevels(); hist.commit(); });
  $('semRef').addEventListener('change', e=>{ const E = edited(); E.ref = e.target.value; refreshLevels(); hist.commit(); });
  // Default: the settings at their defaults (the reference kept), their fields locked;
  // unticked, the fields open on them.
  $('semIntDef').addEventListener('change', e=>{
    const E = edited();
    if (e.target.checked) Object.assign(E, { ...INT_DEF, ref: E.ref });
    E.def = e.target.checked;
    refreshLevels(); hist.commit();
  });
  $('semAdjDef').addEventListener('change', e=>{
    const f = files[cur]; if (!f) return;
    if (e.target.checked) f.adj = { ...ADJ_DEF };
    f.adjDef = e.target.checked;
    refreshLevels(); hist.commit();
  });

  /* ---- CSV: each image's metadata and crop ---- */
  registerCsvExport('sem', ()=>{
    if (!files.length) return [];
    let t = csvLine(['file', 'sample', 'magnification', 'pixel_size_nm', 'field_of_view_um', 'HV_kV', 'WD_mm', 'detector', 'detector_gain', 'detector_offset', 'date', 'time',
      'image_width_px', 'image_height_px', 'info_bar_rows', 'crop_x_px', 'crop_y_px', 'crop_width_px', 'crop_height_px', 'crop_width_um', 'crop_height_um',
      'crop_mean_level', 'crop_sd_level', 'crop_saturated_pct', 'intensity_settings', 'normalisation', 'reference', 'black_level', 'white_level', 'brightness_pct', 'contrast', 'gamma',
      'group', 'scale', 'figure_x_px', 'figure_y_px', 'figure_width_px', 'figure_height_px', 'figure_pixel_nm', 'figure_out_width_px', 'figure_out_height_px']);
    files.forEach(f=>{
      const e = dec(f); if (!e) return;
      const r = e.r, c = f.crop, um = v => fmtNum(v*r.pixelNm/1000, 6);
      // The curve as applied: the levels a linear normalisation takes to black and white
      // (none for the histogram's), and brightness, contrast and gamma with the image's
      // correction in them.
      const st = statsOf(f), nm = normOf(f), a = f.adj || ADJ_DEF, I = intOf(f), rf = refFile(I), g = groupOf(f);
      t += csvLine([f.name, f.label, fmtNum(r.mag, 6), fmtNum(r.pixelNm, 6), fmtNum(r.fovUm, 6), fmtNum(r.kV, 4), fmtNum(r.wdMm, 4), r.detector, fmtNum(r.gain, 5), fmtNum(r.offset, 5), r.date, r.time,
        r.width, r.imageH, r.strip, c.x, c.y, c.w, c.h, um(c.w), um(c.h),
        fmtNum(st.mean, 1), fmtNum(st.sd, 1), fmtNum(100*(c.w*c.h - st.n)/(c.w*c.h), 3), g && groupInt[g.id] ? 'group' : 'all groups', I.mode, usesRef(I) && rf ? rf.label : '',
        nm.table ? '' : fmtNum(nm.lo, 1), nm.table ? '' : fmtNum(nm.hi, 1), fmtNum(I.b + a.b, 3), fmtNum(I.c*a.c, 4), fmtNum(I.g*a.g, 4),
        // In its group: the part of the original the figure takes, and its size there
        // (empty for a reference kept out of the figure).
        ...(()=>{ const o = outOf(f), g = groupOf(f); return o ? [g.name, g.mode, o.c.x, o.c.y, o.c.w, o.c.h, fmtNum(o.px, 6), o.w, o.h] : ['', '', '', '', '', '', '', '', '']; })()]);
    });
    return [{ name: 'sem_images.csv', text: t }];
  });
})();
