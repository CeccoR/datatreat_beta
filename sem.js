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
     from the file's Sign), raw (RawRef), crop {x,y,w,h}, aspect, linked, clamped,
     included? }. files: the included ones; cur indexes them. */
  let allFiles = [];
  let files = [];
  let cur = 0;
  let loadAlerts = '', uploadAlerts = '', warnAlerts = '';
  // The groups (Groups and scale): [{ id, name, named (typed by the user), mode
  // ('common' | 'own'), members (the images' ids) }].
  let groups = [];
  // id → { r (readTescanTiff's), small (a box-averaged copy, for the thumbnails) }
  const decoded = new Map();
  // A copy of the image some 112 px across, each pixel the mean of a k × k block, kept
  // at 16 bits so that the thumbnails go through the same curve as the image.
  function smallOf(r, side = 112){
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
       1. the normalisation, one for every image: none (the levels as acquired), a
          stretch between two percentiles of the image's own levels, the mean and
          standard deviation of the reference image, or its histogram;
       2. contrast about mid-grey and brightness, then gamma (above 1 brightening the
          mid-tones): the global values, with each image's own correction on top
          (brightness added, contrast and gamma multiplied).
     The statistics are the crop's, its saturated pixels (65535) left out: what is
     shown is what is normalised, and a saturated edge does not set the white. The
     reference's own levels are its levels as acquired, so with "none" it looks as the
     others are made to. */
  const INT_DEF = { mode: 'percentile', pLo: 0.5, pHi: 99.5, ref: null, b: 0, c: 1, g: 1 };
  const ADJ_DEF = { b: 0, c: 1, g: 1 };
  let intensity = { ...INT_DEF };
  const usesRef = () => intensity.mode === 'meansd' || intensity.mode === 'hist';
  // The reference: the image chosen, else the first loaded.
  const refFile = () => allFiles.find(f=> f.raw.id === intensity.ref) || allFiles[0] || null;
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
    const m = intensity.mode;
    if (m === 'none') return { lo: 0, hi: 65535 };
    const st = statsOf(f);
    if (m === 'percentile'){
      const lo = levelAt(st, intensity.pLo/100), hi = levelAt(st, intensity.pHi/100);
      return { lo, hi: hi > lo ? hi : lo + 1 };
    }
    const rf = refFile(), rs = rf ? statsOf(rf) : st;
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
    const nm = normOf(f), a = f.adj || ADJ_DEF;
    const b = (intensity.b + a.b)/100, k = intensity.c*a.c, ig = 1/(intensity.g*a.g);
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
  // Set a file's crop from another's (a copy, the linked crop): narrowed to fit where
  // its image is smaller, and marked so.
  function takeCrop(f, c, aspect){
    const e = dec(f); if (!e) return;
    const got = fitCrop(c, e.r.width, e.r.imageH, ASPECTS[aspect]);
    f.crop = got; f.aspect = aspect;
    f.clamped = got.x !== c.x || got.y !== c.y || got.w !== c.w || got.h !== c.h;
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
      allFiles.push({ name: file.name, label: r.name, raw: new RawRef(id, toB64(bytes)), crop, aspect: aspectOf(crop.w, crop.h), linked: false, clamped: false });
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
  // The magnification and, under it, the field of view (two short lines: a phone's
  // column is a few characters wide).
  const extraCols = [{ header: 'Mag.', render: f=>{ const e = decoded.get(f.raw.id) || dec(f); return e ? `<span class="sem-mag">${esc(magText(e.r))}<br><span class="txt-meta">${esc(e.r.fovUm.toPrecision(3))} µm</span></span>` : '—'; } }];

  function afterFilesChange(){
    files = includedOf(allFiles);
    cur = Math.min(cur, Math.max(0, files.length - 1));
    setTabLoaded('sem', allFiles.length);
    // The list's rows map onto allFiles by index; the download needs the RawRef.
    const view = listView();
    renderUnifiedFileList('semFileTableWrap', view, fileCallbacks(), extraCols.map(c=> ({ header: c.header, render: (_, i)=> c.render(allFiles[i]) })));
    document.getElementById('semWorkspace').style.display = files.length ? 'block' : 'none';
    document.getElementById('semIntensityCard').style.display = files.length ? 'block' : 'none';
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
      groups: groups.map(g=> ({ ...g, members: g.members.slice() })) };
  }
  function semRestore(s){
    allFiles = (s && s.files || []).map(f=> ({ ...f, crop: { ...f.crop }, adj: { ...ADJ_DEF, ...(f.adj || {}) }, raw: f.raw instanceof RawRef ? f.raw : new RawRef(f.raw.id, f.raw.b64) }));
    intensity = { ...INT_DEF, ...(s && s.intensity || {}) };
    groups = (s && s.groups || []).map(g=> ({ ...g, members: (g.members || []).slice() }));
    // Images whose bytes no longer read are left out of the list, and said so.
    const lost = allFiles.filter(f=> !dec(f));
    allFiles = allFiles.filter(f=> !lost.includes(f));
    loadAlerts = lost.length ? buildAlertsHtml(lost.map(f=> `${esc(f.name)} — its stored bytes no longer read as a Tescan TIFF`), [], undefined, 'sem-dismiss-invalid') : '';
    uploadAlerts = warnAlerts = '';
    cur = s && Number.isInteger(s.cur) ? s.cur : 0;
    rebuildAlerts();
    afterFilesChange();
  }
  const hist = registerHistory('sem', semSnapshot, semRestore);
  registerTabRedraw('sem', ()=>{ if (files.length){ fitView(); drawEditor(); drawPreview(); drawHist(); } });

  /* ---- Rendering ---- */
  function renderAll(){
    if (!files.length) return;
    renderNav(); renderInfo(); renderFields(); renderThumbs();
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
    const name = f ? `${f.label}  (${cur + 1}/${files.length})` : '';
    document.getElementById('semCurName').textContent = name;
    document.getElementById('semICurName').textContent = name;
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
    box.innerHTML = rows.map(([k, v])=> `<div class="sem-info-row"><span class="txt-meta">${k}</span><span>${v}</span></div>`).join('')
      + (r.warning ? `<div class="alert warn" style="margin-top:8px">⚠ ${esc(r.warning)}</div>` : '');
  }
  // The crop's fields (px) and its size in µm.
  function renderFields(){
    const f = files[cur], e = f && dec(f);
    if (!e) return;
    const c = f.crop, um = v => sig(v*e.r.pixelNm/1000, 4);
    ['x', 'y', 'w', 'h'].forEach(k=>{ const el = document.getElementById('semCrop' + k.toUpperCase()); if (document.activeElement !== el) el.value = String(c[k]); });
    document.getElementById('semCropUm').textContent = `${c.w} × ${c.h} px = ${um(c.w)} × ${um(c.h)} µm`;
    document.getElementById('semAspect').value = f.aspect;
    document.getElementById('semLinked').checked = !!f.linked;
    const note = document.getElementById('semCropNote');
    note.textContent = f.clamped ? 'This crop was narrowed to fit this image: the one copied or linked to it is larger than its image allows.' : '';
    note.style.display = f.clamped ? '' : 'none';
    // What the figure takes from it, in its group.
    const o = outOf(f), g = groupOf(f), gEl = document.getElementById('semCropGroup');
    gEl.textContent = !o ? (inFigure(f) ? '' : 'Not in the figure: it is the reference only.')
      : g.mode === 'own' ? `Group “${g.name}”, own scale: the figure takes this crop as it is, ${o.w} × ${o.h} px.`
      : `Group “${g.name}”, common scale: the figure takes ${sig(o.c.w*e.r.pixelNm/1000, 4)} × ${sig(o.c.h*e.r.pixelNm/1000, 4)} µm${o.c.w !== c.w || o.c.h !== c.h ? ' from the middle of this crop (dashed)' : ''}, at ${sig(o.px, 4)} nm a pixel: ${o.w} × ${o.h} px.`;
  }
  // Every included image with its crop drawn on it; a press shows it in the editor.
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
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sem-thumb' + (i === cur ? ' is-on' : ''); b.title = f.label;
      b.dataset.i = i;
      b.appendChild(cv);
      const cap = document.createElement('span');
      const isRef = usesRef() && refFile() === f;
      cap.className = 'sem-thumb-cap'; cap.textContent = (f.linked ? '🔗 ' : '') + (isRef ? '◎ ' : '') + f.label + (f.clamped ? ' ⚠' : '');
      if (isRef) b.title = f.label + ' — the reference' + (f.refOnly ? ', not in the figure' : '');
      b.appendChild(cap);
      box.appendChild(b);
    });
  }
  document.getElementById('semThumbs').addEventListener('click', e=>{
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
  document.getElementById('semIPrev').addEventListener('click', ()=> go(cur - 1));
  document.getElementById('semINext').addEventListener('click', ()=> go(cur + 1));

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
  let drag = null;
  host.addEventListener('pointerdown', e=>{
    if (e.button !== 0 || !files.length) return;
    const b = canvas.getBoundingClientRect(), px = e.clientX - b.left, py = e.clientY - b.top;
    const mode = hitTest(px, py, e.pointerType === 'touch'), f = files[cur];
    drag = { mode, px, py, c0: { ...f.crop }, ox: view.ox, oy: view.oy, moved: false };
    host.setPointerCapture(e.pointerId);
    host.style.cursor = mode === 'pan' ? 'grabbing' : CURSOR[mode];
    e.preventDefault();
  });
  host.addEventListener('pointermove', e=>{
    const b = canvas.getBoundingClientRect(), px = e.clientX - b.left, py = e.clientY - b.top;
    if (!drag){ if (files.length) host.style.cursor = CURSOR[hitTest(px, py, e.pointerType === 'touch')]; return; }
    const f = files[cur], r = dec(f).r, W = r.width, H = r.imageH;
    const dx = (px - drag.px)/view.s, dy = (py - drag.py)/view.s;
    drag.moved = drag.moved || Math.abs(px - drag.px) + Math.abs(py - drag.py) > 2;
    if (drag.mode === 'pan'){ view.ox = drag.ox + px - drag.px; view.oy = drag.oy + py - drag.py; }
    else if (drag.mode === 'move') f.crop = fitCrop({ ...drag.c0, x: drag.c0.x + dx, y: drag.c0.y + dy }, W, H, null);
    else f.crop = resized(drag.c0, drag.mode, dx, dy, W, H, ASPECTS[f.aspect]);
    if (drag.mode !== 'pan'){ f.clamped = false; renderFields(); }
    drawEditor();
  });
  const endDrag = ()=>{
    if (!drag) return;
    const d = drag; drag = null; host.style.cursor = '';
    if (d.mode !== 'pan' && d.moved) cropChanged();
  };
  host.addEventListener('pointerup', endDrag);
  host.addEventListener('pointercancel', endDrag);
  host.addEventListener('wheel', e=>{
    if (!files.length) return;
    // Swallowed, as in the figure composer: the page never scrolls under it.
    e.preventDefault();
    const b = canvas.getBoundingClientRect(), px = e.clientX - b.left, py = e.clientY - b.top;
    zoomAt(px, py, Math.exp(-e.deltaY*0.004));
  }, { passive: false });
  host.addEventListener('dblclick', e=>{
    const b = canvas.getBoundingClientRect();
    if (hitTest(e.clientX - b.left, e.clientY - b.top, false) === 'pan'){ fitView(); drawEditor(); }
  });
  function zoomAt(px, py, k){
    const f = files[cur], e = dec(f);
    const fit = Math.min(host.clientWidth/e.r.width, host.clientHeight/e.r.imageH);
    const s2 = Math.min(32, Math.max(fit*0.5, view.s*k));
    view.ox = px - (px - view.ox)*s2/view.s; view.oy = py - (py - view.oy)*s2/view.s; view.s = s2;
    drawEditor();
  }
  // The buttons zoom about the crop's centre.
  const zoomCrop = k =>{ const c = files[cur].crop; zoomAt(view.ox + (c.x + c.w/2)*view.s, view.oy + (c.y + c.h/2)*view.s, k); };
  document.getElementById('semZoomIn').addEventListener('click', ()=> zoomCrop(1.5));
  document.getElementById('semZoomOut').addEventListener('click', ()=> zoomCrop(1/1.5));
  document.getElementById('semZoomFit').addEventListener('click', ()=>{ fitView(); drawEditor(); });

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
      f.clamped = false;
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
    f.clamped = false;
    cropChanged();
  });
  document.getElementById('semCropReset').addEventListener('click', ()=>{
    const f = files[cur]; if (!f) return;
    const r = dec(f).r; f.crop = defaultCrop(r); f.aspect = aspectOf(f.crop.w, f.crop.h); f.clamped = false;
    cropChanged();
  });
  // Linking an image: it takes the crop the linked ones share, if any; else it is the
  // first, and the others will take its.
  document.getElementById('semLinked').addEventListener('change', e=>{
    const f = files[cur]; if (!f) return;
    f.linked = e.target.checked;
    if (f.linked){
      const lead = allFiles.find(g=> g !== f && g.linked);
      if (lead) takeCrop(f, lead.crop, lead.aspect);
    } else f.clamped = false;
    renderFields(); refreshLevels();
    hist.commit();
  });

  /* ---- Copy to… ---- */
  const copyModal = document.getElementById('semCopyModal');
  document.getElementById('semCopyBtn').addEventListener('click', ()=>{
    const f = files[cur]; if (!f) return;
    const list = document.getElementById('semCopyList');
    list.innerHTML = allFiles.filter(g=> g !== f).map((g, k)=> `<label class="sem-copy-row"><input type="checkbox" data-k="${allFiles.indexOf(g)}"> <span>${esc(g.label)}</span><span class="txt-meta">${esc(g.name)}</span></label>`).join('')
      || '<p class="txt-meta">No other image is loaded.</p>';
    document.getElementById('semCopyAll').checked = false;
    copyModal.style.display = 'flex';
  });
  document.getElementById('semCopyAll').addEventListener('change', e=>{
    copyModal.querySelectorAll('#semCopyList input').forEach(cb=>{ cb.checked = e.target.checked; });
  });
  // Closed by Escape or a click outside the box, as the other modals.
  const closeCopy = ()=>{ copyModal.style.display = 'none'; };
  copyModal.addEventListener('click', e=>{ if (e.target === copyModal) closeCopy(); });
  document.addEventListener('keydown', e=>{ if (e.key === 'Escape' && copyModal.style.display !== 'none') closeCopy(); });
  document.getElementById('semCopyApply').addEventListener('click', ()=>{
    const f = files[cur];
    const picked = [...copyModal.querySelectorAll('#semCopyList input:checked')].map(cb=> allFiles[+cb.dataset.k]).filter(Boolean);
    closeCopy();
    if (!f || !picked.length) return;
    picked.forEach(g=>{ takeCrop(g, f.crop, f.aspect); propagate(g); });
    renderFields(); refreshLevels();
    hist.commit();
  });

  /* ---- Groups and scale ----
     The images in the figure (included, and not a reference kept out of it) are
     grouped by pixel size, two within 10 % in one group, each named by its
     magnification; a group's images share one scale bar. A group at common scale
     brings its images to its largest pixel size (the others reduced by averaging over
     the pixels each new one covers, never enlarged: nothing is invented) and to its
     smallest field of view, each crop narrowed about its middle; at its own scale an
     image keeps its pixels and its crop. Groups can be renamed, an image moved to
     another or to a new one (up to one group an image); Regroup starts again. */
  const GROUP_TOL = 1.10;
  const inFigure = f => f.included !== false && !(usesRef() && f.refOnly && refFile() === f);
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
  // An image into the group whose pixel sizes it stays within 10 % of, else a new one.
  function placeImage(f){
    const p = pixelOf(f);
    const g = groups.find(g=>{ const ps = g.members.map(id=> pixelOf(byId(id))).filter(Number.isFinite).concat(p); return Math.max(...ps)/Math.min(...ps) <= GROUP_TOL; });
    if (g) g.members.push(f.raw.id);
    else groups.push({ id: newGroupId(), name: '', named: false, mode: 'common', members: [f.raw.id] });
  }
  // The groups kept in step with the images: gone ones dropped, new ones placed, empty
  // groups removed, unnamed ones named after their images.
  function syncGroups(){
    const ids = new Set(allFiles.map(f=> f.raw.id));
    groups.forEach(g=>{ g.members = g.members.filter(id=> ids.has(id)); });
    const placed = new Set(groups.flatMap(g=> g.members));
    allFiles.forEach(f=>{ if (!placed.has(f.raw.id) && dec(f)) placeImage(f); });
    groups = groups.filter(g=> g.members.length);
    groups.forEach(g=>{ if (!g.named) g.name = groupName(g.members); });
    // Lowest magnification first.
    groups.sort((a, b)=> pixelOf(byId(b.members[0])) - pixelOf(byId(a.members[0])));
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
  function renderGroups(){
    const box = document.getElementById('semGroups');
    if (!box || !files.length) return;
    const opts = gid => groups.map(g=> `<option value="${g.id}"${g.id === gid ? ' selected' : ''}>${esc(g.name)}</option>`).join('');
    box.innerHTML = groups.map(g=>{
      const mem = g.members.map(byId).filter(m=> m && inFigure(m));
      if (!mem.length) return '';
      const o = outOf(mem[0]);
      const info = g.mode === 'own' ? `own scale: each image its own pixels and its own scale bar`
        : `${sig(o.px, 4)} nm a pixel · ${sig(o.w*o.px/1000, 4)} × ${sig(o.h*o.px/1000, 4)} µm · ${o.w} × ${o.h} px`;
      return `<div class="sem-group" data-g="${g.id}">
        <div class="sem-group-head">
          <input type="text" class="sem-group-name" data-g="${g.id}" value="${esc(g.name)}" aria-label="Group name">
          <select class="sem-group-mode" data-g="${g.id}"><option value="common"${g.mode === 'common' ? ' selected' : ''}>common scale</option><option value="own"${g.mode === 'own' ? ' selected' : ''}>own scale</option></select>
          <span class="txt-meta sem-group-info">${info}</span>
        </div>
        <div class="sem-group-imgs">${mem.map(m=>{ const oo = outOf(m), cut = 1 - oo.c.w*oo.c.h/(m.crop.w*m.crop.h), red = oo.px/pixelOf(m);
          return `<div class="sem-gimg" data-id="${esc(m.raw.id)}"><div class="sem-gimg-pic"></div><span class="sem-thumb-cap" title="${esc(m.label)}">${esc(m.label)}</span>
            <span class="txt-meta">${g.mode === 'own' ? `${sig(pixelOf(m), 4)} nm/px` : `${cut > 0.0005 ? `narrowed ${sig(100*cut, 2)} %` : 'whole crop'}${red > 1.0005 ? `, reduced ×${sig(1/red, 3)}` : ''}`}</span>
            <select class="sem-move" data-id="${esc(m.raw.id)}" aria-label="Move to group">${opts(g.id)}${groups.length < allFiles.length ? '<option value="new">new group</option>' : ''}</select></div>`; }).join('')}</div>
      </div>`;
    }).join('');
    box.querySelectorAll('.sem-gimg').forEach(el=>{ const f = byId(el.dataset.id), cv = f && outCanvas(f, 150); if (cv) el.querySelector('.sem-gimg-pic').appendChild(cv); });
  }
  const groupsBox = document.getElementById('semGroups');
  groupsBox.addEventListener('change', e=>{
    const t = e.target;
    if (t.classList.contains('sem-group-name')){
      const g = groups.find(g=> g.id === t.dataset.g); if (!g) return;
      const v = t.value.trim();
      // Emptied, a name goes back to the images' magnification.
      g.named = !!v; g.name = v || groupName(g.members);
    } else if (t.classList.contains('sem-group-mode')){
      const g = groups.find(g=> g.id === t.dataset.g); if (!g) return;
      g.mode = t.value;
    } else if (t.classList.contains('sem-move')){
      const id = t.dataset.id, from = groups.find(g=> g.members.includes(id));
      if (from) from.members = from.members.filter(m=> m !== id);
      if (t.value === 'new') groups.push({ id: newGroupId(), name: '', named: false, mode: 'common', members: [id] });
      else { const to = groups.find(g=> g.id === t.value); if (to) to.members.push(id); }
      groups = groups.filter(g=> g.members.length);
      groups.forEach(g=>{ if (!g.named) g.name = groupName(g.members); });
    } else return;
    renderGroups(); renderFields(); drawEditor();
    hist.commit();
  });
  groupsBox.addEventListener('keydown', e=>{ if (e.key === 'Enter' && e.target.classList.contains('sem-group-name')) e.target.blur(); });
  document.getElementById('semRegroup').addEventListener('click', ()=>{
    groups = [];
    syncGroups(); renderGroups(); renderFields(); drawEditor();
    hist.commit();
  });

  /* ---- The intensity card ---- */
  const $ = id => document.getElementById(id);
  // The fields, with the range each takes; a value outside it is refused (the field
  // shakes and shows the last good one).
  const INT_FIELDS = { semPLo: ['pLo', 0, 49.9], semPHi: ['pHi', 50.1, 100], semB: ['b', -100, 100], semC: ['c', 0.05, 20], semG: ['g', 0.05, 20] };
  const ADJ_FIELDS = { semBi: ['b', -100, 100], semCi: ['c', 0.05, 20], semGi: ['g', 0.05, 20] };
  function renderIntensity(){
    const f = files[cur];
    if (!f) return;
    const I = intensity, a = f.adj || ADJ_DEF, setv = (id, v) => { const el = $(id); if (document.activeElement !== el) el.value = String(+(+v).toPrecision(6)); };
    $('semNorm').value = I.mode;
    for (const [id, [k]] of Object.entries(INT_FIELDS)) setv(id, I[k]);
    for (const [id, [k]] of Object.entries(ADJ_FIELDS)) setv(id, a[k]);
    // Disabled, not hidden, where the normalisation does not use them.
    $('semPLo').disabled = $('semPHi').disabled = I.mode !== 'percentile';
    const rf = refFile();
    $('semRef').innerHTML = allFiles.map(g=> `<option value="${esc(g.raw.id)}">${esc(g.label)}</option>`).join('');
    if (rf) $('semRef').value = rf.raw.id;
    $('semRef').disabled = $('semRefOnly').disabled = !usesRef();
    $('semRefOnly').checked = !!(rf && rf.refOnly);
    drawPreview(); drawHist();
  }
  // The current crop as it will be shown, fitted to the column (at most 60 % of the
  // window's height).
  function drawPreview(){
    const f = files[cur], e = f && dec(f), cv = $('semPreview'), box = cv.parentElement;
    if (!e || !box.clientWidth) return;
    const c = f.crop, w = box.clientWidth, h = Math.max(120, Math.min(Math.round(w*c.h/c.w), Math.round(window.innerHeight*0.6)));
    box.style.height = h + 'px';
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr);
    const ctx = cv.getContext('2d'), img = toCanvas(e.r.pixels, e.r.width, c.x, c.y, c.w, c.h, lutOf(f));
    const s = Math.min(cv.width/c.w, cv.height/c.h);
    ctx.imageSmoothingEnabled = s < 2; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (cv.width - s*c.w)/2, (cv.height - s*c.h)/2, s*c.w, s*c.h);
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
    const c = f.crop, sat = c.w*c.h - st.n, satTxt = sat ? `; ${sig(100*sat/(c.w*c.h), 2)} % of the crop saturated, left out` : '';
    const rf = refFile();
    const what = intensity.mode === 'none' ? 'The levels as acquired: 0 is black, 65535 white'
      : intensity.mode === 'percentile' ? `Black at level ${Math.round(nm.lo)}, white at ${Math.round(nm.hi)} (of 65535)`
      : intensity.mode === 'meansd' ? `Crop mean ${Math.round(st.mean)}, SD ${Math.round(st.sd)}, given those of ${rf ? rf.label : '—'} (${Math.round(statsOf(rf || f).mean)}, ${Math.round(statsOf(rf || f).sd)})`
      : `The histogram of ${rf ? rf.label : '—'}`;
    $('semHistNote').textContent = what + satTxt + '.';
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
      const v = readField(el, lo, hi);
      if (v == null || !files.length){ renderIntensity(); return; }
      intensity[k] = v; refreshLevels(); hist.commit();
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
  $('semNorm').addEventListener('change', e=>{ intensity.mode = e.target.value; refreshLevels(); hist.commit(); });
  $('semRef').addEventListener('change', e=>{ intensity.ref = e.target.value; refreshLevels(); hist.commit(); });
  // Kept out of the figure, the reference also leaves its group (whose field may widen).
  $('semRefOnly').addEventListener('change', e=>{ const rf = refFile(); if (!rf) return; rf.refOnly = e.target.checked; refreshLevels(); hist.commit(); });
  $('semAdjReset').addEventListener('click', ()=>{ const f = files[cur]; if (!f) return; f.adj = { ...ADJ_DEF }; refreshLevels(); hist.commit(); });
  $('semIntReset').addEventListener('click', ()=>{ intensity = { ...INT_DEF, ref: intensity.ref }; refreshLevels(); hist.commit(); });

  /* ---- CSV: each image's metadata and crop ---- */
  registerCsvExport('sem', ()=>{
    if (!files.length) return [];
    let t = csvLine(['file', 'sample', 'magnification', 'pixel_size_nm', 'field_of_view_um', 'HV_kV', 'WD_mm', 'detector', 'detector_gain', 'detector_offset', 'date', 'time',
      'image_width_px', 'image_height_px', 'info_bar_rows', 'crop_x_px', 'crop_y_px', 'crop_width_px', 'crop_height_px', 'crop_width_um', 'crop_height_um',
      'crop_mean_level', 'crop_sd_level', 'crop_saturated_pct', 'normalisation', 'reference', 'black_level', 'white_level', 'brightness_pct', 'contrast', 'gamma',
      'group', 'scale', 'figure_x_px', 'figure_y_px', 'figure_width_px', 'figure_height_px', 'figure_pixel_nm', 'figure_out_width_px', 'figure_out_height_px']);
    files.forEach(f=>{
      const e = dec(f); if (!e) return;
      const r = e.r, c = f.crop, um = v => fmtNum(v*r.pixelNm/1000, 6);
      // The curve as applied: the levels a linear normalisation takes to black and white
      // (none for the histogram's), and brightness, contrast and gamma with the image's
      // correction in them.
      const st = statsOf(f), nm = normOf(f), a = f.adj || ADJ_DEF, rf = refFile();
      t += csvLine([f.name, f.label, fmtNum(r.mag, 6), fmtNum(r.pixelNm, 6), fmtNum(r.fovUm, 6), fmtNum(r.kV, 4), fmtNum(r.wdMm, 4), r.detector, fmtNum(r.gain, 5), fmtNum(r.offset, 5), r.date, r.time,
        r.width, r.imageH, r.strip, c.x, c.y, c.w, c.h, um(c.w), um(c.h),
        fmtNum(st.mean, 1), fmtNum(st.sd, 1), fmtNum(100*(c.w*c.h - st.n)/(c.w*c.h), 3), intensity.mode, usesRef() && rf ? rf.label : '',
        nm.table ? '' : fmtNum(nm.lo, 1), nm.table ? '' : fmtNum(nm.hi, 1), fmtNum(intensity.b + a.b, 3), fmtNum(intensity.c*a.c, 4), fmtNum(intensity.g*a.g, 4),
        // In its group: the part of the original the figure takes, and its size there
        // (empty for a reference kept out of the figure).
        ...(()=>{ const o = outOf(f), g = groupOf(f); return o ? [g.name, g.mode, o.c.x, o.c.y, o.c.w, o.c.h, fmtNum(o.px, 6), o.w, o.h] : ['', '', '', '', '', '', '', '', '']; })()]);
    });
    return [{ name: 'sem_images.csv', text: t }];
  });
})();
