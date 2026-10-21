/* The test files, made by code: the same bytes on every run (a seeded generator for the
   noise), written to a temporary directory by writeFixtures. Each maker also gives a Buffer
   for Playwright's setInputFiles({ name, mimeType, buffer }), where a test wants a name of
   its own. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CIF = path.join(HERE, 'fixtures', 'SrTiO3.cif');

// A seeded uniform generator (an LCG), and a normal one from it (Box–Muller).
export function rng(seed){
  let s = (seed >>> 0) || 1;
  const u = ()=> (s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff;
  const n = ()=>{ const a = Math.max(u(), 1e-12), b = u(); return Math.sqrt(-2*Math.log(a)) * Math.cos(2*Math.PI*b); };
  return { u, n };
}

/* XRPD: a PANalytical XRDML scan, 5384 points over 10–80° 2θ, of a cubic perovskite
   (SrTiO3-like, Pm-3m) with Kα1 and Kα2, a pseudo-Voigt profile, a sloping background and
   counting noise. Sample k has its cell 0.035 % smaller per step, so its peaks move a
   little to higher angle. */
const L1 = 1.540598, L2 = 1.544426;
const PEROV = [[1,0,0,800],[1,1,0,5000],[1,1,1,1500],[2,0,0,2500],[2,1,0,60],[2,1,1,2000],[2,2,0,1200],[3,0,0,40],[3,1,0,700],[3,1,1,250]];
export function xrdml(k = 0, { n = 5384, a = 3.905*(1 - 0.00035*k), seed = 101 + k } = {}){
  const r = rng(seed), lo = 10, hi = 80, y = new Array(n);
  const pk = [];
  for (const [h, kk, l, I] of PEROV){
    const d = a/Math.hypot(h, kk, l);
    for (const [lam, f] of [[L1, 1], [L2, 0.5]]){ const s = lam/(2*d); if (s < 1) pk.push([2*Math.asin(s)*180/Math.PI, I*f]); }
  }
  for (let i = 0; i < n; i++){
    const t = lo + (hi - lo)*i/(n - 1);
    let v = 232 - 0.65*(t - lo);
    for (const [c, I] of pk){
      const w = 0.10 + 0.0016*c, dx = (t - c)/(w/2);
      if (Math.abs(dx) < 60) v += I*(0.5/(1 + dx*dx) + 0.5*Math.exp(-Math.LN2*dx*dx));
    }
    y[i] = Math.max(0, Math.round(v + Math.sqrt(v)*r.n()*0.3));
  }
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<xrdMeasurements xmlns="http://www.xrdml.com/XRDMeasurement/1.5" status="Completed">
 <xrdMeasurement measurementType="Scan" status="Completed">
  <usedWavelength intended="K-Alpha 1"><kAlpha1 unit="Angstrom">1.5405980</kAlpha1><kAlpha2 unit="Angstrom">1.5444260</kAlpha2><kBeta unit="Angstrom">1.3922500</kBeta><ratioKAlpha2KAlpha1>0.5000</ratioKAlpha2KAlpha1></usedWavelength>
  <scan appendNumber="0" mode="Continuous" scanAxis="Gonio" status="Completed">
   <dataPoints>
    <positions axis="2Theta" unit="deg"><startPosition>${lo}</startPosition><endPosition>${hi}</endPosition></positions>
    <commonCountingTime unit="seconds">50.0</commonCountingTime>
    <intensities unit="counts">${y.join(' ')}</intensities>
   </dataPoints>
  </scan>
 </xrdMeasurement>
</xrdMeasurements>`, 'utf8');
}

/* GC: the instrument's export, an injection every 15 min, H2 (and O2) in %mol rising as
   the light-on hours go by. */
export function gcCsv({ start = 9, n = 24, h2 = [0.05, 0.12], o2 = null, seed = 7 } = {}){
  const r = rng(seed);
  const head = ['Injection date', 'H2 (B) [%Mol]'].concat(o2 ? ['O2 (A) [%Mol]'] : []);
  const rows = [head.join(',')];
  for (let i = 0; i < n; i++){
    const min = start*60 + 15*i, hh = Math.floor(min/60), mm = min % 60, h12 = ((hh + 11) % 12) + 1;
    const when = `10/20/2026 ${h12}:${String(mm).padStart(2, '0')}:00 ${hh < 12 ? 'AM' : 'PM'}`;
    const t = i/4, row = [when, (h2[0] + h2[1]*t + 0.004*r.n()).toFixed(4)];
    if (o2) row.push((o2[0] + o2[1]*t + 0.003*r.n()).toFixed(4));
    rows.push(row.join(','));
  }
  return Buffer.from(rows.join('\n') + '\n', 'utf8');
}

/* UV-Vis DRS: Kubelka–Munk F(R) from 250 to 800 nm, an indirect gap at Eg (the Tauc
   (F·hν)^½ straight above it), an Urbach tail under it and a flat baseline. */
export function drsCsv({ Eg = 3.2, A = 60, seed = 3 } = {}){
  const r = rng(seed), rows = ['Sample,', 'Wavelength (nm),F(R)'];
  for (let w = 250; w <= 800; w++){
    const e = 1239.842/w;
    const F = 0.05 + (e > Eg ? A*(e - Eg)*(e - Eg)/e : 0) + 0.02*Math.exp(Math.min(0, e - Eg)/0.08) + 0.0005*r.n();
    rows.push(w + ',' + F.toFixed(5));
  }
  return Buffer.from(rows.join('\n') + '\n', 'utf8');
}

/* EPR: a Bruker BES3T pair, the .DSC descriptor and the .DTA data (1024 big-endian
   doubles): the first derivative of a Lorentzian line at the field B0, with noise. */
export function eprPair({ title = 'sample one', B0 = 3400, w = 4, amp = 650, seed = 11 } = {}){
  const N = 1024, xmin = 3300, xwid = 200, r = rng(seed), dta = Buffer.alloc(N*8);
  for (let i = 0; i < N; i++){
    const b = xmin + xwid*i/(N - 1), u = (b - B0)/w;
    dta.writeDoubleBE(-amp*2.6*u/((1 + u*u)*(1 + u*u)) + r.n(), i*8);
  }
  const dsc = `#DESC 1.2 * DESCRIPTOR INFORMATION ***********************
DSRC EXP
BSEQ BIG
IKKF REAL
XTYP IDX
IRFMT D
XPTS ${N}
XMIN ${xmin.toFixed(1)}
XWID ${xwid.toFixed(1)}
XUNI G
MWFQ 9.5e9
TITL '${title}'
`;
  return { dsc: Buffer.from(dsc, 'latin1'), dta };
}

/* SEM: a Tescan-like TIFF (little endian, one IFD, strips, the Tescan metadata in tag
   50431), a gradient with noise and the instrument's data bar at the foot. */
export function makeTiff({ W = 256, H = 266, bits = 8, strip = 10, sign = 'SampleA', pixelNm = 25, mag = 5000,
  seed = 1, extraMain = '', declaredW, declaredH, oddCount = false, noPixels = false, detector = 'SE' } = {}){
  const bpp = bits/8;
  const imgBytes = noPixels ? 0 : W*H*bpp;
  const main = `[MAIN]\r\nDate=2024-01-01\r\nTime=10:00:00\r\nDevice=MIRA\r\nMagnification=${mag}\r\nPixelSizeX=${pixelNm}e-09\r\nPixelSizeY=${pixelNm}e-09\r\nImageStripSize=${strip}\r\nSign=${sign}\r\n${extraMain}`;
  const sem = `[SEM]\r\nHV=15000\r\nWD=0.01\r\nDetector=${detector}\r\n`;
  const enc = s => Buffer.from(s, 'latin1');
  const blk = (kind, payload)=>{ const b = Buffer.alloc(6 + payload.length); b.writeUInt32LE(2 + payload.length, 0); b.writeUInt16LE(kind, 4); payload.copy(b, 6); return b; };
  const tes = Buffer.concat([blk(2, enc(main)), blk(3, enc(sem))]);
  const dw = declaredW ?? W, dh = declaredH ?? H;
  // layout: header(8) | pixels | tescan | ifd
  const pixOff = 8, tesOff = pixOff + imgBytes, ifdOff = tesOff + tes.length + (tesOff + tes.length) % 2;
  const entries = [[256, 4, 1, dw], [257, 4, 1, dh], [258, 3, 1, bits], [259, 3, 1, 1], [262, 3, 1, 1], [273, 4, 1, pixOff],
    [277, 3, 1, 1], [278, 4, 1, dh], [279, 4, 1, oddCount ? imgBytes - 1 : imgBytes], [50431, 7, tes.length, tesOff]];
  const ifd = Buffer.alloc(2 + 12*entries.length + 4);
  ifd.writeUInt16LE(entries.length, 0);
  entries.forEach(([tag, type, count, val], k)=>{
    const e = 2 + 12*k;
    ifd.writeUInt16LE(tag, e); ifd.writeUInt16LE(type, e + 2); ifd.writeUInt32LE(count, e + 4);
    if (type === 3 && count === 1) ifd.writeUInt16LE(val, e + 8); else ifd.writeUInt32LE(val, e + 8);
  });
  const hdr = Buffer.alloc(8); hdr.write('II', 0, 'latin1'); hdr.writeUInt16LE(42, 2); hdr.writeUInt32LE(ifdOff, 4);
  const px = Buffer.alloc(imgBytes);
  let s = seed;
  const rnd = ()=> (s = (s*1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  if (!noPixels) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
    const v = y >= H - strip ? (y === H - strip ? 0 : 200) : Math.floor(40 + 150*(x/W) + 30*rnd());
    const i = (y*W + x)*bpp;
    if (bits === 8) px[i] = v; else px.writeUInt16LE(v*257, i);
  }
  const pad = Buffer.alloc((tesOff + tes.length) % 2);
  return Buffer.concat([hdr, px, tes, pad, ifd]);
}
// A TIFF as setInputFiles takes it, with a name of its own.
export const tif = (name, o)=> ({ name, mimeType: 'image/tiff', buffer: makeTiff(o) });

/* Every module's set, written to a fresh temporary directory: { dir, files: { mod: [paths] },
   std, cif, remove() }. The XRPD set has 3 patterns (s00–s02) and a standard-like 4th (s11). */
export function writeFixtures(){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'datatreat-fx-'));
  const put = (name, buf)=>{ const p = path.join(dir, name); fs.writeFileSync(p, buf); return p; };
  const e1 = eprPair({ title: 'sample one' }), e2 = eprPair({ title: 'sample two', B0: 3392, w: 5, amp: 420, seed: 12 });
  const files = {
    tauc: [put('drs1.csv', drsCsv({ Eg: 3.2 })), put('drs2.csv', drsCsv({ Eg: 2.9, A: 45, seed: 4 }))],
    xrd: [0, 1, 2].map(k=> put(`s0${k}.xrdml`, xrdml(k))),
    gc: [put('alpha.csv', gcCsv({ h2: [0.05, 0.12], o2: [0.02, 0.05], seed: 7 })), put('beta.csv', gcCsv({ h2: [0.08, 0.07], seed: 8 }))],
    epr: [put('e1.DSC', e1.dsc), put('e1.DTA', e1.dta), put('e2.DSC', e2.dsc), put('e2.DTA', e2.dta)],
    sem: [put('img1.tif', makeTiff({ sign: 'S1', pixelNm: 25, mag: 5000, seed: 1 })), put('img2.tif', makeTiff({ sign: 'S2', pixelNm: 25, mag: 5000, seed: 2 })),
      put('img3.tif', makeTiff({ sign: 'S3', pixelNm: 50, mag: 2500, seed: 3, extraMain: 'Note=<i data-x=1>meta\r\n' }))],
  };
  const std = put('s11.xrdml', xrdml(11));
  return { dir, files, std, cif: CIF, put, remove(){ fs.rmSync(dir, { recursive: true, force: true }); } };
}
// How many rows each module's file list shows for its set (an EPR pair is one file).
export const ROWS = { tauc: 2, xrd: 3, gc: 2, epr: 2, sem: 3 };
