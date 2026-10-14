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
  // id → { r (readTescanTiff's), lo, hi (the display's black and white), thumb (canvas) }
  const decoded = new Map();

  // The display's grey levels until the intensity settings come: black and white at
  // the 0.5 and 99.5 percentiles of the image (the bar left out).
  function stretchOf(r){
    const n = r.width*r.imageH, hist = new Uint32Array(65536);
    for (let i = 0; i < n; i++) hist[r.pixels[i]]++;
    const at = q => { let s = 0; const t = q*n; for (let v = 0; v < 65536; v++){ s += hist[v]; if (s > t) return v; } return 65535; };
    const lo = at(0.005), hi = at(0.995);
    return hi > lo ? [lo, hi] : [lo, lo + 1];
  }
  // A small copy of the image (box-averaged), for the strip of thumbnails.
  function thumbOf(r, lo, hi, side = 112){
    const k = Math.max(1, Math.ceil(Math.max(r.width, r.imageH)/side)), w = Math.floor(r.width/k), h = Math.floor(r.imageH/k);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), d = img.data, sc = 255/(hi - lo);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
      let s = 0;
      for (let j = 0; j < k; j++){ const row = (y*k + j)*r.width + x*k; for (let i = 0; i < k; i++) s += r.pixels[row + i]; }
      const g = Math.max(0, Math.min(255, (s/(k*k) - lo)*sc)), o = 4*(y*w + x);
      d[o] = d[o + 1] = d[o + 2] = g; d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
  function cache(id, r){
    const [lo, hi] = stretchOf(r);
    const e = { r, lo, hi, thumb: thumbOf(r, lo, hi) };
    decoded.set(id, e);
    return e;
  }
  // The decoded image of a file, read again from its bytes when not cached (a project
  // opened, an undo past a removal). null when the bytes no longer read.
  function dec(f){
    if (decoded.has(f.raw.id)) return decoded.get(f.raw.id);
    try { return cache(f.raw.id, readTescanTiff(fromB64(f.raw.b64), f.name)); } catch(e){ return null; }
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
    renderAll();
    hist.commit();
  }

  /* ---- Undo / project state ---- */
  function semSnapshot(){
    return { files: allFiles.map(f=> ({ ...f, crop: { ...f.crop } })), cur };
  }
  function semRestore(s){
    allFiles = (s && s.files || []).map(f=> ({ ...f, crop: { ...f.crop }, raw: f.raw instanceof RawRef ? f.raw : new RawRef(f.raw.id, f.raw.b64) }));
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
  registerTabRedraw('sem', ()=>{ if (files.length){ fitView(); drawEditor(); } });

  /* ---- Rendering ---- */
  function renderAll(){
    if (!files.length) return;
    renderNav(); renderInfo(); renderFields(); renderThumbs();
    loadEditorImage(); fitView(); drawEditor();
  }
  function renderNav(){
    const f = files[cur];
    document.getElementById('semCurName').textContent = f ? `${f.label}  (${cur + 1}/${files.length})` : '';
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
  }
  // Every included image with its crop drawn on it; a press shows it in the editor.
  function renderThumbs(){
    const box = document.getElementById('semThumbs');
    box.innerHTML = '';
    files.forEach((f, i)=>{
      const e = dec(f); if (!e) return;
      const t = e.thumb, k = t.width/e.r.width, cv = document.createElement('canvas');
      cv.width = t.width; cv.height = t.height;
      const ctx = cv.getContext('2d');
      ctx.drawImage(t, 0, 0);
      const c = f.crop;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.rect(0, 0, cv.width, cv.height); ctx.rect(c.x*k, c.y*k, c.w*k, c.h*k); ctx.fill('evenodd');
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(c.x*k + 0.5, c.y*k + 0.5, Math.max(1, c.w*k - 1), Math.max(1, c.h*k - 1));
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sem-thumb' + (i === cur ? ' is-on' : ''); b.title = f.label;
      b.dataset.i = i;
      b.appendChild(cv);
      const cap = document.createElement('span');
      cap.className = 'sem-thumb-cap'; cap.textContent = (f.linked ? '🔗 ' : '') + f.label + (f.clamped ? ' ⚠' : '');
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

  /* ---- The crop editor ----
     The image drawn into a canvas with the view (scale s in CSS px a pixel, and the
     image's top-left at ox, oy); the crop over it, the rest darkened, with eight
     handles. Dragging a handle or a side resizes, inside moves, outside pans; the
     wheel zooms about the pointer, a double click outside the crop fits the image. */
  const view = { s: 1, ox: 0, oy: 0 };
  let off = null, offId = null;   // the current image at full size, grey
  function loadEditorImage(){
    const f = files[cur], e = f && dec(f);
    if (!e || offId === f.raw.id) return;
    const r = e.r, W = r.width, H = r.imageH;
    off = document.createElement('canvas'); off.width = W; off.height = H;
    const ctx = off.getContext('2d'), img = ctx.createImageData(W, H), d = img.data, sc = 255/(e.hi - e.lo);
    for (let i = 0; i < W*H; i++){
      const g = Math.max(0, Math.min(255, (r.pixels[i] - e.lo)*sc)), o = 4*i;
      d[o] = d[o + 1] = d[o + 2] = g; d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
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
    renderFields(); renderThumbs(); drawEditor();
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
    renderFields(); renderThumbs(); drawEditor();
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
    renderFields(); renderThumbs(); drawEditor();
    hist.commit();
  });

  /* ---- CSV: each image's metadata and crop ---- */
  registerCsvExport('sem', ()=>{
    if (!files.length) return [];
    let t = csvLine(['file', 'sample', 'magnification', 'pixel_size_nm', 'field_of_view_um', 'HV_kV', 'WD_mm', 'detector', 'detector_gain', 'detector_offset', 'date', 'time',
      'image_width_px', 'image_height_px', 'info_bar_rows', 'crop_x_px', 'crop_y_px', 'crop_width_px', 'crop_height_px', 'crop_width_um', 'crop_height_um']);
    files.forEach(f=>{
      const e = dec(f); if (!e) return;
      const r = e.r, c = f.crop, um = v => fmtNum(v*r.pixelNm/1000, 6);
      t += csvLine([f.name, f.label, fmtNum(r.mag, 6), fmtNum(r.pixelNm, 6), fmtNum(r.fovUm, 6), fmtNum(r.kV, 4), fmtNum(r.wdMm, 4), r.detector, fmtNum(r.gain, 5), fmtNum(r.offset, 5), r.date, r.time,
        r.width, r.imageH, r.strip, c.x, c.y, c.w, c.h, um(c.w), um(c.h)]);
    });
    return [{ name: 'sem_images.csv', text: t }];
  });
})();
