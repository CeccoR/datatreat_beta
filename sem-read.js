/* =========================================================
   SEM IMAGES — reading a Tescan TIFF

   Only the files the Tescan software (Essence) writes are taken: a grey TIFF, 8 or
   16 bits a pixel, uncompressed, in strips, carrying Tescan's own tag 50431. That tag
   holds blocks, each a 32-bit length (counting what follows it), a 16-bit kind and
   the payload: kind 1 a JPEG 2000 thumbnail (not used), kind 2 the [MAIN] section,
   kind 3 the [SEM] section, as key=value lines — the same text as the .hdr the
   software writes beside the image, which is therefore not needed.

   The frame is the scanned image with the info bar under it. The file gives the bar's
   height (ImageStripSize), not its place: the bar at the bottom is Tescan's layout,
   seen on every file so far. The image is the frame less ImageStripSize rows from the
   bottom. As a check, not a rule, the bar's first row is its border, one grey level
   across: when it is not, the file may not be laid out so, and the reader says so.

   Pixels taller or wider than they are long (PixelSizeY and PixelSizeX more than
   0.1 % apart) are brought to square ones (squarePixels). Also here, what the module
   (sem.js) and its worker (sem-read.worker.js) both do with a file: its id, the reduced
   copy and a crop's statistics (readFile).
========================================================= */

const TESCAN_TAG = 50431;
/* The largest image taken (the info bar left out, in square pixels where they are made
   so): the editor draws it whole in one canvas, which a browser makes no larger than
   32767 px a side (Firefox) and 2²⁸ px in all (Chromium, figure.js CANVAS_LIMITS: a
   16384² image fits). Larger is refused with its size, before anything is allocated.
   The bar is never drawn: a frame over these with an image within them is taken, its
   memory bounded by the file's length, which holds it. */
const MAX_SIDE = 32767, MAX_PIXELS = 2**28;
// Within this the two pixel sizes are one: the image is taken as it is.
const SQUARE_TOL = 0.001;

// A reason a file is not taken, worded for the list of files not loaded.
class SemReadError extends Error {}

// key=value lines (\n or \r\n) as an object of strings.
function keyValues(text){
  const o = {};
  for (const line of text.split(/\r?\n/)){
    const i = line.indexOf('=');
    if (i > 0) o[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return o;
}

// The blocks of the Tescan tag: { main, sem } as key=value objects.
function tescanBlocks(bytes){
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), dec = new TextDecoder('latin1');
  const out = {};
  for (let i = 0; i + 6 <= bytes.length; ){
    const len = dv.getUint32(i, true), kind = dv.getUint16(i + 4, true);
    if (len < 2 || i + 4 + len > bytes.length) break;
    if (kind === 2) out.main = keyValues(dec.decode(bytes.subarray(i + 6, i + 4 + len)));
    else if (kind === 3) out.sem = keyValues(dec.decode(bytes.subarray(i + 6, i + 4 + len)));
    i += 4 + len;
  }
  return out;
}

// A count of bytes as it reads best.
const sizeText = n => n < 1e3 ? `${n} bytes` : n < 1e6 ? `${+(n/1e3).toPrecision(3)} kB` : n < 1e9 ? `${+(n/1e6).toPrecision(3)} MB` : `${+(n/1e9).toPrecision(3)} GB`;
const LIMIT_TEXT = `${MAX_SIDE} px a side, 268 million px in all`;
const LITTLE = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

/* readTescanTiff(bytes: Uint8Array, fileName, { head, view }) → {
     width, height (the frame), imageH (the image's rows), strip (the bar's rows),
     bits, pixels (Uint16Array, width × height, row by row, the frame's grey levels
     scaled to 16 bits; the image alone where its pixels were made square), view (the
     pixels are the file's own bytes, not a copy: opts.view), meta:
     { main, sem } (strings), and the numbers read from it: name, pixelNm (nm a pixel),
     pixelNmY (the same, the pixels being square: the file's PixelSizeY where it is
     within 0.1 % of X), mag, fovUm (the image's width), kV, wdMm, detector, gain,
     offset, device, date, time, warning (or ''), squared (null, or where the pixels
     were made square: { width, imageH, pixelNmX, pixelNmY } as acquired) }.
   head: everything but the pixels (null), at the cost of the checks alone: whatever
   would refuse the file refuses it here too. view: the pixels a Uint16Array over the
   file's own bytes where they are its grey levels as they are (16 bits in this machine's
   order, at an even offset, the strips one after another, black the lowest level, the
   pixels square): no copy (b2, sem.js: a decoded image costs nothing but the file it
   is); else a copy, as without it.
   Throws SemReadError with the reason a file is not taken. */
function readTescanTiff(bytes, fileName = '', opts = {}){
  if (bytes.length < 8) throw new SemReadError('not a TIFF');
  const order = String.fromCharCode(bytes[0], bytes[1]);
  if (order !== 'II' && order !== 'MM') throw new SemReadError('not a TIFF');
  const le = order === 'II', dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint16(2, le) !== 42) throw new SemReadError('not a TIFF (a BigTIFF or another format)');
  const ifd = dv.getUint32(4, le);
  if (ifd + 2 > bytes.length) throw new SemReadError('a damaged TIFF');
  const n = dv.getUint16(ifd, le), SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 16: 8 };
  const tags = new Map();
  for (let k = 0; k < n; k++){
    const e = ifd + 2 + 12*k;
    if (e + 12 > bytes.length) throw new SemReadError('a damaged TIFF');
    const tag = dv.getUint16(e, le), type = dv.getUint16(e + 2, le), count = dv.getUint32(e + 4, le);
    const size = (SIZE[type] || 1)*count, at = size <= 4 ? e + 8 : dv.getUint32(e + 8, le);
    if (at + size > bytes.length) throw new SemReadError('a damaged TIFF');
    // Numbers (SHORT, LONG) as an array; anything else as its bytes.
    const vals = type === 3 ? Array.from({ length: count }, (_, j)=> dv.getUint16(at + 2*j, le))
               : type === 4 ? Array.from({ length: count }, (_, j)=> dv.getUint32(at + 4*j, le)) : null;
    tags.set(tag, { type, count, vals, bytes: bytes.subarray(at, at + size) });
  }
  const one = (t, d) => tags.has(t) && tags.get(t).vals ? tags.get(t).vals[0] : d;
  if (!tags.has(TESCAN_TAG)) throw new SemReadError('not a Tescan TIFF: no Tescan metadata in it');
  const width = one(256), height = one(257), bits = one(258, 1), spp = one(277, 1), comp = one(259, 1), photo = one(262, 1);
  if (!(width > 0 && height > 0)) throw new SemReadError('a TIFF without its size');
  if (spp !== 1 || (photo !== 0 && photo !== 1)) throw new SemReadError('a colour TIFF: only grey images are taken');
  if (comp !== 1) throw new SemReadError(`a compressed TIFF (compression ${comp}): only uncompressed images are taken`);
  if (bits !== 8 && bits !== 16) throw new SemReadError(`a ${bits}-bit TIFF: only 8- and 16-bit images are taken`);
  if (one(339, 1) !== 1) throw new SemReadError('a TIFF of signed or floating-point pixels');
  if (tags.has(322) || !tags.has(273)) throw new SemReadError('a tiled TIFF: only images in strips are taken');
  const offs = tags.get(273).vals, cnts = tags.has(279) ? tags.get(279).vals : null;
  if (!offs || !cnts || cnts.length !== offs.length) throw new SemReadError('a damaged TIFF');

  /* The size and the strips, checked before the pixels are given any memory: to v487
     the pixels were allocated from the header's size first, so that a 328-byte file
     declaring 20000 × 20000 px took 800 MB before it was refused, and at 40000² the
     list said "Array buffer allocation failed". A strip's pixels are its whole samples:
     a 16-bit strip of an odd number of bytes has a stray byte, which is no pixel (to
     v487 it was read one byte past the strip, and every strip after it landed half a
     pixel off). */
  const bpp = bits/8, need = width*height;
  if (need*bpp > bytes.length) throw new SemReadError(`a damaged TIFF: its ${width} × ${height} px of ${bits} bits take ${sizeText(need*bpp)}, more than the whole file (${sizeText(bytes.length)})`);
  const parts = [];
  let got = 0;
  for (let s = 0; s < offs.length && got < need; s++){
    const o = offs[s], c = Math.min(Math.floor(cnts[s]/bpp), need - got);
    if (o + c*bpp > bytes.length) throw new SemReadError('a damaged TIFF: its pixels run past the end of the file');
    parts.push(o, c); got += c;
  }
  if (got < need) throw new SemReadError('a damaged TIFF: fewer pixels than its size');

  const { main = {}, sem = {} } = tescanBlocks(tags.get(TESCAN_TAG).bytes);
  const num = s => { const v = parseFloat(s); return Number.isFinite(v) ? v : NaN; };
  const strip = Math.max(0, Math.round(num(main.ImageStripSize) || 0));
  if (strip >= height) throw new SemReadError('a Tescan TIFF whose info bar is as tall as the frame');
  const imageH = height - strip;
  const pxX = num(main.PixelSizeX)*1e9, pxY0 = num(main.PixelSizeY)*1e9, pxY = pxY0 > 0 ? pxY0 : pxX;
  if (!(pxX > 0)) throw new SemReadError('a Tescan TIFF without its pixel size');
  // Square pixels: the size they are brought to (the image only grows), checked as drawn.
  const sq = Math.abs(pxY/pxX - 1) > SQUARE_TOL ? squareSize(width, imageH, pxX, pxY) : null;
  const over = (w, h) => w > MAX_SIDE || h > MAX_SIDE || w*h > MAX_PIXELS;
  if (sq && over(sq.w, sq.h))
    throw new SemReadError(`an image of ${width} × ${imageH} px of ${+pxX.toPrecision(4)} × ${+pxY.toPrecision(4)} nm: in square pixels ${sq.w} × ${sq.h} px, larger than the page can draw (${LIMIT_TEXT})`);
  if (!sq && over(width, imageH)) throw new SemReadError(`an image of ${width} × ${imageH} px${strip ? ' (its info bar left out)' : ''}: larger than the page can draw (${LIMIT_TEXT})`);

  // (the bar's border read from the strips as stored, the header alone too: alike there
  // as in the levels made of them)
  const warning = strip && !uniformRun(bytes, dv, parts, le, bits, imageH*width, width)
    ? `the row under the image (row ${imageH + 1}) is not the info bar's uniform border: the bar may not be where Tescan puts it, so check the image's bottom edge` : '';
  let pixels = null, view = false;
  if (!opts.head){
    const o0 = parts[0], whole = parts.every((v, k)=> k % 2 || !k || v === parts[k - 2] + parts[k - 1]*bpp);
    if (opts.view && bits === 16 && le === LITTLE && photo === 1 && whole && (bytes.byteOffset + o0) % 2 === 0){
      pixels = new Uint16Array(bytes.buffer, bytes.byteOffset + o0, need); view = !sq;
    } else {
      // The frame's grey levels, on 16 bits (an 8-bit file × 257: 255 → 65535); a 16-bit
      // strip in the machine's order, at an even offset, copied whole.
      pixels = new Uint16Array(need);
      for (let k = 0, at = 0; k < parts.length; k += 2){
        const o = parts[k], c = parts[k + 1];
        if (bits === 16){
          if (le === LITTLE && (bytes.byteOffset + o) % 2 === 0) pixels.set(new Uint16Array(bytes.buffer, bytes.byteOffset + o, c), at);
          else for (let j = 0; j < c; j++) pixels[at + j] = dv.getUint16(o + 2*j, le);
        } else for (let j = 0; j < c; j++) pixels[at + j] = bytes[o + j]*257;
        at += c;
      }
      // WhiteIsZero: turned into the usual sense, black the lowest level.
      if (photo === 0) for (let i = 0; i < pixels.length; i++) pixels[i] = 65535 - pixels[i];
    }
    // (from the file's own levels where they are viewed: they are only read)
    if (sq) pixels = squarePixels(pixels, width, imageH, sq.w, sq.h);
  }
  const W = sq ? sq.w : width, H = sq ? sq.h : imageH, pixelNm = sq ? sq.p : pxX;
  const base = fileName.replace(/\.[^.]+$/, '');
  return {
    width: W, height: sq ? H : height, imageH: H, strip, bits, pixels, view, meta: { main, sem },
    name: main.Sign || main.OrigFileName || base, pixelNm, pixelNmY: sq ? sq.p : pxY,
    mag: num(main.Magnification), fovUm: pixelNm*W/1000,
    kV: num(sem.HV || sem.AcceleratorVoltage)/1000, wdMm: num(sem.WD)*1000,
    detector: sem.Detector || sem.Detector0 || '', gain: num(sem.Detector0Gain ?? sem.PrimaryDetectorGain), offset: num(sem.Detector0Offset ?? sem.PrimaryDetectorOffset),
    device: main.Device || '', date: main.Date || '', time: main.Time || '', warning,
    squared: sq ? { width, imageH, pixelNmX: pxX, pixelNmY: pxY } : null,
  };
}

// Are the frame's n samples from `from` (as stored, its strips' parts) all one level?
function uniformRun(bytes, dv, parts, le, bits, from, n){
  let first = -1;
  for (let k = 0, at = 0; k < parts.length && n > 0; k += 2){
    const o = parts[k], c = parts[k + 1];
    for (let j = from - at; j >= 0 && j < c && n > 0; j++, n--, from++){
      const v = bits === 16 ? dv.getUint16(o + 2*j, le) : bytes[o + j];
      if (first < 0) first = v; else if (v !== first) return false;
    }
    at += c;
  }
  return true;
}

/* ---- Square pixels ----
   An image whose pixels are pxX nm wide and pxY nm tall is brought to square pixels
   of the finer of the two: along the finer side the pixels stay as acquired, along
   the coarser there are more of them (pxCoarse/pxFine as many, rounded), each read
   between its two nearest by linear interpolation. Nothing acquired is lost, which
   the coarser size (an average over the finer side's pixels) would do; the field is
   the same, the coarser side's pixel off the finer's by at most half a pixel over the
   image (0.05 % over 1000 px). Every view, crop, statistic, group and scale bar then
   works on square pixels. To v487 PixelSizeY was read and left unused: such an image
   was drawn with square pixels, stretched, and its scale bar held along X only. */
function squareSize(W, H, pxX, pxY){
  const p = Math.min(pxX, pxY);
  return { p, w: Math.max(1, Math.round(W*pxX/p)), h: Math.max(1, Math.round(H*pxY/p)) };
}
/* The weights taking n samples to m over the same extent: for each new sample, the
   pairs (old index, weight). Fewer (m < n): each new one the mean of the old ones it
   covers, in part where it covers them in part. More: linear between the two old ones
   about its centre, the end ones held. */
function axisWeights(n, m){
  const out = [];
  if (m < n){
    const k = n/m;
    for (let j = 0; j < m; j++){ const a = j*k, b = (j + 1)*k, l = [];
      for (let i = Math.floor(a); i < Math.min(n, Math.ceil(b)); i++){ const wt = Math.min(b, i + 1) - Math.max(a, i); if (wt > 1e-9) l.push(i, wt/k); }
      out.push(l); }
    return out;
  }
  for (let j = 0; j < m; j++){
    const u = Math.min(n - 1, Math.max(0, (j + 0.5)*n/m - 0.5)), i = Math.floor(u), t = u - i;
    out.push(t > 1e-9 && i + 1 < n ? [i, 1 - t, i + 1, t] : [i, 1]);
  }
  return out;
}
// The image's rows (W × H, the bar left out) at w × h: the columns, then the rows.
function squarePixels(px, W, H, w, h){
  let src = px, sw = W;
  if (w !== W){
    const wx = axisWeights(W, w), tmp = new Uint16Array(w*H);
    for (let y = 0; y < H; y++){ const row = y*W;
      for (let x = 0; x < w; x++){ const l = wx[x]; let s = 0; for (let t = 0; t < l.length; t += 2) s += px[row + l[t]]*l[t + 1]; tmp[y*w + x] = Math.min(65535, Math.round(s)); } }
    src = tmp; sw = w;
  }
  if (h === H) return w === W ? px.slice(0, W*H) : src;
  const wy = axisWeights(H, h), out = new Uint16Array(sw*h);
  for (let y = 0; y < h; y++){ const l = wy[y];
    for (let x = 0; x < sw; x++){ let s = 0; for (let t = 0; t < l.length; t += 2) s += src[l[t]*sw + x]*l[t + 1]; out[y*sw + x] = Math.min(65535, Math.round(s)); } }
  return out;
}

/* ---- What the module and its worker do with a file ---- */
// FNV-1a over the bytes, with their length: a file's identity (a second copy of one
// already loaded is the same file, whatever it is called).
function hashBytes(b){
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++){ h ^= b[i]; h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0') + '-' + b.length;
}
// A file's base64 read into its bytes: a project of v517 or before held it so (sem.js
// semRestore; b2 keeps the bytes, and makes no base64). The browser's own (fromBase64),
// where it has it, gives the same, sooner.
function fromB64(b64){
  if (Uint8Array.fromBase64) return Uint8Array.fromBase64(b64);
  const s = atob(b64), b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}
// A copy of the image some 160 px across, each pixel the mean of a k × k block, kept
// at 16 bits so that the thumbnails go through the same curve as the image (shown at
// 90–188 px, as many a row as fit).
function reducedCopy(r, side = 160){
  const k = Math.max(1, Math.ceil(Math.max(r.width, r.imageH)/side)), w = Math.floor(r.width/k), h = Math.floor(r.imageH/k);
  const px = new Uint16Array(w*h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    let sum = 0;
    for (let j = 0; j < k; j++){ const row = (y*k + j)*r.width + x*k; for (let i = 0; i < k; i++) sum += r.pixels[row + i]; }
    px[y*w + x] = Math.round(sum/(k*k));
  }
  return { w, h, k, px };
}
/* A crop's levels (row length W) as a histogram with their count, mean and spread,
   its saturated pixels (65535) left out. The count, sum and sum of squares were added
   pixel by pixel (to v487): taken from the histogram they are the same numbers while
   the sum of squares stays under 2⁵² (as with a 2048² crop of mid-grey), every partial
   sum then a whole number held exactly, in either order; past that, the pixels' order
   decides the rounding, and they are added pixel by pixel as before. The histogram
   alone takes a fifth of the time. */
function cropStats(px, W, c){
  const hist = new Uint32Array(65536);
  for (let y = c.y; y < c.y + c.h; y++){ const row = y*W + c.x; histRow(px, row, row + c.w, hist); }
  hist[65535] = 0;
  let n = 0, sum = 0, sq = 0;
  for (let v = 0; v < 65535; v++){ const k = hist[v]; if (k){ n += k; sum += v*k; sq += v*v*k; } }
  if (sq >= 2**52){
    const acc = new Float64Array(3);
    for (let y = c.y; y < c.y + c.h; y++){ const row = y*W + c.x; rowSums(px, row, row + c.w, acc); }
    sum = acc[1]; sq = acc[2];
  }
  const mean = n ? sum/n : 0;
  return { hist, n, mean, sd: n ? Math.sqrt(Math.max(0, sq/n - mean*mean)) : 0 };
}
// (a row at a time: a small function is made fast by the browser within its first
// crop, where one loop over the crop took a few crops)
function histRow(px, a, b, hist){ for (let i = a; i < b; i++) hist[px[i]]++; }
function rowSums(px, a, b, acc){
  let n = acc[0], sum = acc[1], sq = acc[2];
  for (let i = a; i < b; i++){ const v = px[i]; if (v === 65535) continue; n++; sum += v; sq += v*v; }
  acc[0] = n; acc[1] = sum; acc[2] = sq;
}
/* A region of 16-bit levels (row length W) brought to w × h: each new pixel the mean
   of the old ones it covers, in part where it covers them in part (separable: rows,
   then columns). Only ever reduces here; at the same size it is a copy. The weights in
   flat arrays (a new pixel's old ones are side by side: from first[j]), a row at a
   time: the same sums, in the same order, as to v487, sooner. */
function resample(px, W, c, w, h){
  const weights = (n, m) => { const k = n/m, at = new Int32Array(m + 1), first = new Int32Array(m), wts = [];
    for (let j = 0; j < m; j++){ const a = j*k, b = (j + 1)*k; at[j] = wts.length; first[j] = -1;
      for (let i = Math.floor(a); i < Math.min(n, Math.ceil(b)); i++){ const wt = Math.min(b, i + 1) - Math.max(a, i); if (wt > 1e-9){ if (first[j] < 0) first[j] = i; wts.push(wt/k); } } }
    at[m] = wts.length;
    return { at, first, wt: Float64Array.from(wts) }; };
  const X = weights(c.w, w), Y = weights(c.h, h), tmp = new Float32Array(w*c.h), out = new Uint16Array(w*h), acc = new Float64Array(w);
  for (let y = 0; y < c.h; y++) resampleRow(px, (c.y + y)*W + c.x, X, tmp, y*w, w);
  for (let y = 0; y < h; y++){
    acc.fill(0);
    for (let t = Y.at[y], e = Y.at[y + 1], r = Y.first[y]; t < e; t++, r++){ const o = r*w, wt = Y.wt[t]; for (let x = 0; x < w; x++) acc[x] += tmp[o + x]*wt; }
    const o = y*w;
    for (let x = 0; x < w; x++) out[o + x] = Math.min(65535, Math.round(acc[x]));
  }
  return out;
}
// One row of the region, its columns brought to w (into tmp at o).
function resampleRow(px, row, X, tmp, o, w){
  const at = X.at, first = X.first, wt = X.wt;
  for (let x = 0; x < w; x++){ let sum = 0; for (let t = at[x], e = at[x + 1], i = row + first[x]; t < e; t++, i++) sum += px[i]*wt[t]; tmp[o + x] = sum; }
}
/* A group's card of an image (sem.js cardOf): the part c of it the figure takes, there
   w × h px, brought down to 200 px across. cardKey: its size and what it is made from
   (pk); cardLevels: { pk, px, w, h }. */
function cardKey(c, w, h){
  const k = Math.min(1, 200/Math.max(w, h)), cw = Math.max(1, Math.round(w*k)), ch = Math.max(1, Math.round(h*k));
  return { pk: `${c.x},${c.y},${c.w},${c.h}|${cw}x${ch}`, w: cw, h: ch };
}
function cardLevels(r, c, w, h){ const K = cardKey(c, w, h); return { ...K, px: resample(r.pixels, r.width, c, K.w, K.h) }; }
/* A file dropped, read whole: { id, r (its pixels viewed in its bytes where they can
   be), small, st (its default crop's statistics), card (its card as its own group takes
   it whole), bytes }. Throws SemReadError where it is not taken. To b2 its base64 too,
   11.9 MB for a 2048 × 2176 image of 8.9 MB, kept beside it. */
function readFile(bytes, name){
  const id = hashBytes(bytes), r = readTescanTiff(bytes, name, { view: true }), c = { x: 0, y: 0, w: r.width, h: r.imageH };
  return { id, r, small: reducedCopy(r), st: cropStats(r.pixels, r.width, c), card: cardLevels(r, c, r.width, r.imageH), bytes };
}

export { readTescanTiff, SemReadError, keyValues, hashBytes, fromB64, reducedCopy, cropStats, resample, cardKey, cardLevels, readFile, squarePixels, axisWeights, MAX_SIDE, MAX_PIXELS };
