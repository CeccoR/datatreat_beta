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
========================================================= */

const TESCAN_TAG = 50431;

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

/* readTescanTiff(bytes: Uint8Array, fileName) → {
     width, height (the frame), imageH (the image's rows), strip (the bar's rows),
     bits, pixels (Uint16Array, width × height, row by row, the frame's grey levels
     scaled to 16 bits), meta: { main, sem } (strings), and the numbers read from it:
     name, pixelNm (nm a pixel, x), pixelNmY, mag, fovUm (the image's width), kV, wdMm,
     detector, gain, offset, device, date, time, warning (or '') }.
   Throws SemReadError with the reason a file is not taken. */
function readTescanTiff(bytes, fileName = ''){
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

  // The frame's grey levels, on 16 bits (an 8-bit file × 257: 255 → 65535).
  const bpp = bits/8, need = width*height*bpp, pixels = new Uint16Array(width*height);
  let got = 0;
  for (let s = 0; s < offs.length && got < need; s++){
    const o = offs[s], c = Math.min(cnts[s], need - got);
    if (o + c > bytes.length) throw new SemReadError('a damaged TIFF: its pixels run past the end of the file');
    if (bits === 16) for (let j = 0; j < c; j += 2) pixels[(got + j) >> 1] = dv.getUint16(o + j, le);
    else for (let j = 0; j < c; j++) pixels[got + j] = bytes[o + j]*257;
    got += c;
  }
  if (got < need) throw new SemReadError('a damaged TIFF: fewer pixels than its size');
  // WhiteIsZero: turned into the usual sense, black the lowest level.
  if (photo === 0) for (let i = 0; i < pixels.length; i++) pixels[i] = 65535 - pixels[i];

  const { main = {}, sem = {} } = tescanBlocks(tags.get(TESCAN_TAG).bytes);
  const num = s => { const v = parseFloat(s); return Number.isFinite(v) ? v : NaN; };
  const strip = Math.max(0, Math.round(num(main.ImageStripSize) || 0));
  if (strip >= height) throw new SemReadError('a Tescan TIFF whose info bar is as tall as the frame');
  const imageH = height - strip;
  let warning = '';
  if (strip){
    const row = pixels.subarray(imageH*width, (imageH + 1)*width);
    if (row.some(v=> v !== row[0])) warning = `the row under the image (row ${imageH + 1}) is not the info bar's uniform border: the bar may not be where Tescan puts it, so check the image's bottom edge`;
  }
  const pixelNm = num(main.PixelSizeX)*1e9, pixelNmY = num(main.PixelSizeY)*1e9;
  if (!(pixelNm > 0)) throw new SemReadError('a Tescan TIFF without its pixel size');
  const base = fileName.replace(/\.[^.]+$/, '');
  return {
    width, height, imageH, strip, bits, pixels, meta: { main, sem },
    name: main.Sign || main.OrigFileName || base, pixelNm, pixelNmY: pixelNmY > 0 ? pixelNmY : pixelNm,
    mag: num(main.Magnification), fovUm: pixelNm*width/1000,
    kV: num(sem.HV || sem.AcceleratorVoltage)/1000, wdMm: num(sem.WD)*1000,
    detector: sem.Detector || sem.Detector0 || '', gain: num(sem.Detector0Gain ?? sem.PrimaryDetectorGain), offset: num(sem.Detector0Offset ?? sem.PrimaryDetectorOffset),
    device: main.Device || '', date: main.Date || '', time: main.Time || '', warning,
  };
}

export { readTescanTiff, SemReadError, keyValues };
