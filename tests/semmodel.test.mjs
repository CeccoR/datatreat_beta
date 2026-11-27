/* SEM's calculations (sem-model.js) and its words and markup that need no page (sem-html.js),
   in Node: no browser (v558). The crop's rules (an image's crop fitted, whole pixels inside
   it, its sides at least 64 px or the image's, a ratio held and read back (v570); resized by
   every handle, free and locked; typed, re-ratioed, reset, dragged and dragged back; its
   handles and what a press takes), the editor's view (fitted, zoomed, kept and given back),
   the levels, each normalisation and its curve (brightness, contrast and gamma against a hand
   calculation), the settings read back, their scope; the groups (images placed by pixel size,
   named by their magnification, an excluded image deciding nothing, moved, a new one, reset
   with their figures and settings kept), what the figure takes of an image at common and own
   scale; the state saved and read back (as saved, a v517 project's base64, ids made again,
   files twice or lost, malformed values everywhere); v583: an old project (a crop of pixels
   made square since, one figure for every group, bytes as arrays), its old fields ignored, the
   defaults in their place; v586: one whose Default boxes are missing, ticked as new ones are;
   the alerts' lines; the Image box, the groups and the options, every name escaped. Then the three
   fixtures as v557's page analysed them (its CSV, every byte), and 60 cases (random images,
   states and a few steps each: the crop typed, re-ratioed and reset, links, the scope and
   settings, groups moved, renamed, scaled, added, removed and reset, files left out,
   relabelled and removed, the alerts dismissed) as v557's sem.js gave them, run from its
   source on a page of stubs: the state, the CSV, the markup, each image's curve and what the
   figure takes, their digests in tests/golden/semmodel.json (npm run test:update writes them
   anew after a change meant to alter them). utils.js's and modkit.js's helpers, which need a
   page to load, are taken from their source as they stand there. Under three seconds. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { rng, makeTiff } from './fixtures.mjs';
import { readTescanTiff, cropStats, hashBytes } from '../sem-read.js';
import * as M from '../sem-model.js';
import * as H from '../sem-html.js';
import { markSeen } from '../alerts.js';

const UPDATE = !!process.env.UPDATE_GOLDEN || process.env.npm_lifecycle_event === 'test:update';
const GOLDEN = new URL('./golden/semmodel.json', import.meta.url);
const sha = s => createHash('sha256').update(s).digest('hex');

// A declaration of the page's modules as it stands there: a function to its closing brace,
// a const to the next line at the margin (a closing one taken with it).
function decl(file, name){
  const src = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  let i = src.search(new RegExp(`^(export )?function ${name}\\(`, 'm'));
  if (i >= 0){
    let k = src.indexOf(')', i), d = 0;
    for (k = src.indexOf('{', k); k < src.length; k++){ if (src[k] === '{') d++; else if (src[k] === '}' && !--d) break; }
    return src.slice(i, k + 1).replace(/^export /, '');
  }
  i = src.search(new RegExp(`^(export )?const ${name} = `, 'm'));
  assert.ok(i >= 0, name + ' in ' + file);
  const rest = src.slice(i), m = /\n(?=\S)/.exec(rest);
  let end = m ? m.index : rest.length;
  if (m && /^[}\])]/.test(rest.slice(end + 1))) end = rest.indexOf('\n', end + 1);
  return rest.slice(0, end).replace(/^export /, '');
}
const UN = ['esc', 'fmtNum', 'csvField', 'csvJoin', 'csvLine', 'X_SVG', 'ALERT_ICON', 'markOf', 'seenFor', 'notesFor', 'alertHtml', 'FILE_ALERT', 'fileAlertHtml', 'fileLine', 'notesHtml', 'isIncluded', 'anySample', 'includedOf', 'includedIndex', 'setIncluded', 'removeFileAt'];
const IN_ALERTS = new Set(['ALERT_ICON', 'markOf', 'seenFor', 'notesFor']);
const settings = { decimal: '.', field: ';' };
const PAGE = new Function('settings', [...UN.map(n=> decl(IN_ALERTS.has(n) ? 'alerts.js' : 'utils.js', n)), decl('modkit.js', 'isObj')].join('\n') + `\nreturn { ${[...UN, 'isObj'].join(', ')} };`)(settings);
// A canonical dump: every number by its shortest round-trip string, NaN, ±∞ and −0 too.
const canon = v => JSON.stringify(v, function(k, x){ const o = this[k]; return typeof o === 'number' ? (Object.is(o, -0) ? '#-0' : '#' + o) : x; });

/* ---- The page's keeping of the files, in short (sem.js info, statsOf, rawOf) ---- */
class Ref { constructor(id, bytes){ this.id = id; this.bytes = bytes; } toJSON(){ return 'raw:' + this.id; } }
const heads = new Map(), levels = new Map(), stats = new Map();
const info = f =>{
  const id = f.raw.id;
  if (!heads.has(id)){ let r; try { r = f.raw.bytes ? readTescanTiff(f.raw.bytes, f.name, { head: true }) : null; } catch(err){ r = null; } heads.set(id, r); }
  return heads.get(id);
};
function statsOf(f){
  const key = `${f.raw.id}|${f.crop.x},${f.crop.y},${f.crop.w},${f.crop.h}`;
  if (!stats.has(key)){
    if (!levels.has(f.raw.id)) levels.set(f.raw.id, readTescanTiff(f.raw.bytes, f.name, { view: true }).pixels);
    stats.set(key, cropStats(levels.get(f.raw.id), info(f).width, f.crop));
  }
  return stats.get(key);
}
const rawOf = (id, bytes, r0)=> r0 instanceof Ref && r0.id === id && r0.bytes === bytes ? r0 : new Ref(id, bytes);
const U = { isObj: PAGE.isObj, fmtNum: PAGE.fmtNum, csvLine: PAGE.csvLine, info, statsOf, rawOf };
const HU = { esc: PAGE.esc, fileAlertHtml: PAGE.fileAlertHtml, notesHtml: PAGE.notesHtml };
// The alerts under the drop zone, as sem.js draws them: the line's and what the reading of the
// images in the list said (v572).
const alertsOf = S => H.alertsHtml(HU, M.alertsNow(S), new Set(S.allFiles.map(f=> f.raw.id)), H.fileNotes(HU, S.allFiles, info));

/* ---- The images (made up) ---- */
const IMG = {
  a: ['a.tif', { W: 96, H: 90, strip: 6, sign: 'A', pixelNm: 25, mag: 5000, seed: 1 }],
  b: ['b.tif', { W: 120, H: 100, strip: 8, sign: 'B <b>', pixelNm: 26, mag: 4800, seed: 2 }],
  c: ['c.tif', { W: 80, H: 70, bits: 16, strip: 5, sign: 'C&', pixelNm: 50, mag: 2500, seed: 3 }],
  d: ['d.tif', { W: 300, H: 266, bits: 16, strip: 10, sign: 'Big', pixelNm: 100, mag: 1250, seed: 4 }],
  e: ['e.tif', { W: 48, H: 40, strip: 0, sign: 'Tiny', pixelNm: 400, mag: 312, seed: 5 }],
  f: ['f.tif', { W: 110, H: 90, strip: 6, sign: 'Sq', pixelNm: 40, mag: 3100, seed: 6, extraMain: 'PixelSizeY=4.8e-08\r\n' }],
  g: ['g.tif', { W: 100, H: 80, bits: 16, strip: 6, sign: 'Sq16', pixelNm: 42, mag: 0, seed: 7, extraMain: 'PixelSizeY=3.6e-08\r\n' }],
  h: ['h.tif', { W: 140, H: 60, strip: 4, sign: '', pixelNm: 24.6, mag: 5100, seed: 8 }],
  i: ['i.tif', { W: 70, H: 75, strip: 5, sign: 'W', pixelNm: 51, mag: 2450, seed: 9 }],
  j: ['j.tif', { W: 90, H: 80, bits: 16, strip: 5, sign: 'Bright', pixelNm: 52, mag: 2400, seed: 10 }],
};
// (J's top left at the top levels, 65530 to 65534: a histogram's last levels reached)
const bright = b =>{ for (let y = 0; y < 24; y++) for (let x = 0; x < 30; x++) b.writeUInt16LE(65530 + (x + y) % 5, 8 + 2*(y*90 + x)); return b; };
const BYTES = Object.fromEntries(Object.entries(IMG).map(([k, [, o]])=> [k, new Uint8Array(k === 'j' ? bright(makeTiff(o)) : makeTiff(o))]));
// A file as sem.js's list holds it once read (its default crop).
const fileOf = (k, name = IMG[k][0])=>{
  const b = BYTES[k], id = hashBytes(b);
  return M.newFile(name, readTescanTiff(b, name, { head: true }), new Ref(id, b));
};
// An instance's state, empty (sem.js S).
const newS = ()=> ({ allFiles: [], files: [], cur: 0, groups: [], figures: {}, intensity: { ...M.INT_DEF }, groupInt: {}, line: 0, lines: 0, alertsOf: new Map(), ed: null });
// The files changed, as sem.js filesChanged has it: the included, the image shown, the groups.
function filesChanged(S){
  S.files = PAGE.includedOf(S.allFiles);
  S.cur = Math.min(S.cur, Math.max(0, S.files.length - 1));
  M.syncGroups(U, S);
}
// A state put back, as sem.js restore does (a state of no history: a line of its own).
function restore(S, s){
  S.line = ++S.lines;
  const { lost, cur } = M.restoreInto(U, S, s);
  if (lost.length) M.setAlerts(S, { bad: { names: [PAGE.esc(H.lostLine(lost.length))], ids: S.allFiles.map(f=> f.raw.id), opened: true } });
  S.cur = cur;
  filesChanged(S);
}
const loaded = (...ks)=>{ const S = newS(); S.allFiles = ks.map(k=> fileOf(k)); filesChanged(S); return S; };

/* ---- The crop ---- */
test('the crop: fitted, resized by every handle, typed, re-ratioed, reset and dragged; the handles, a press and the view', ()=>{
  assert.equal(M.aspectOf(400, 300), '4:3'); assert.equal(M.aspectOf(100, 101), '1:1'); assert.equal(M.aspectOf(300, 200), '3:2'); assert.equal(M.aspectOf(500, 100), 'free');
  // Whole pixels, inside the image, at least 64 px a side (or the image's).
  assert.deepEqual(M.fitCrop({ x: -5, y: 10, w: 500, h: 3 }, 200, 100, null), { x: 0, y: 10, w: 200, h: 64 });
  assert.deepEqual(M.fitCrop({ x: 150.6, y: 90, w: 60.4, h: 30 }, 200, 100, null), { x: 136, y: 36, w: 64, h: 64 });
  assert.deepEqual(M.fitCrop({ x: 0, y: 0, w: 9, h: 9 }, 48, 40, null), { x: 0, y: 0, w: 48, h: 40 });
  // Locked: the longer side shortened to the ratio.
  assert.deepEqual(M.fitCrop({ x: 0, y: 0, w: 200, h: 100 }, 256, 256, 4/3), { x: 0, y: 0, w: 133, h: 100 });
  assert.deepEqual(M.fitCrop({ x: 0, y: 0, w: 100, h: 200 }, 256, 256, 1), { x: 0, y: 0, w: 100, h: 100 });
  const R = rng(8), int = (a, b)=> a + Math.floor(R.u()*(b - a + 1));
  for (let k = 0; k < 3000; k++){
    const W = int(20, 600), H = int(20, 600), r = [null, 1, 4/3, 3/2][k % 4];
    const c = M.fitCrop({ x: int(-300, 700) + R.u(), y: int(-300, 700), w: int(-10, 900) + R.u(), h: int(-10, 900) }, W, H, r);
    const rr = { width: W, imageH: H };
    assert.ok(M.validCrop(c, rr, r), JSON.stringify([c, W, H, r]));
    // At its ratio whatever the image (v569: to v568 not where its sides under 64 px could
    // not hold it), to a pixel.
    if (r) assert.ok(Math.abs(c.w/c.h - r) <= 1/Math.min(c.w, c.h) + 1e-9, JSON.stringify([c, W, H, r]));
    if (r && (c.w < Math.min(64, W) || c.h < Math.min(64, H))) assert.ok(!M.validCrop(c, rr) && (c.w === W || c.h === H || Math.abs(c.w - Math.min(W, H*r)) <= 1), 'under 64 px only where the image is too narrow: ' + JSON.stringify([c, W, H, r]));
    // A resize from it keeps it whole and inside, the side or corner opposite the handle where it stays.
    const hd = M.HANDLES[k % 8], dx = int(-400, 400), dy = int(-400, 400), z = M.resized(c, hd, dx, dy, W, H, r);
    assert.ok(M.validCrop(z, rr, r), JSON.stringify([c, hd, dx, dy, W, H, r, z]));
    if (r) assert.ok(Math.abs(z.w/z.h - r) <= 1/Math.min(z.w, z.h) + 1e-9, JSON.stringify([c, hd, W, H, r, z]));
    if (!r && hd === 'se') assert.deepEqual([z.x, z.y], [c.x, c.y]);
    if (!r && hd === 'nw') assert.deepEqual([z.x + z.w, z.y + z.h], [c.x + c.w, c.y + c.h]);
  }
  // Free: a handle moves its sides alone; a side never past the other less 64 px.
  const c0 = { x: 40, y: 30, w: 100, h: 80 };
  assert.deepEqual(M.resized(c0, 'se', 10, 5, 256, 256, null), { x: 40, y: 30, w: 110, h: 85 });
  assert.deepEqual(M.resized(c0, 'w', 70, 99, 256, 256, null), { x: 76, y: 30, w: 64, h: 80 });
  assert.deepEqual(M.resized(c0, 'nw', -100, -100, 256, 256, null), { x: 0, y: 0, w: 140, h: 110 });
  // Locked 4:3: a corner by the mean of the two moves, a side the other about its middle.
  assert.deepEqual(M.resized({ x: 0, y: 0, w: 120, h: 90 }, 'se', 12, 0, 256, 256, 4/3), { x: 0, y: 0, w: 126, h: 95 });
  assert.deepEqual(M.resized({ x: 20, y: 40, w: 120, h: 90 }, 'e', 40, 0, 256, 256, 4/3), { x: 20, y: 25, w: 160, h: 120 });
  assert.deepEqual(M.resized({ x: 20, y: 40, w: 120, h: 90 }, 's', 0, 30, 256, 256, 4/3), { x: 0, y: 40, w: 160, h: 120 });
  assert.deepEqual(M.handlePoints({ x: 10, y: 20, w: 40, h: 30 }), [[10, 20], [30, 20], [50, 20], [50, 35], [50, 50], [30, 50], [10, 50], [10, 35]]);
  // A press: a handle within 9 px (18 for a finger), a side anywhere along it, inside, outside.
  const view = { s: 2, ox: 10, oy: 20 }, c = { x: 10, y: 10, w: 50, h: 40 };
  assert.equal(M.hitTest(view, c, 31, 38, false), 'nw');
  assert.equal(M.hitTest(view, c, 30 + 100, 40 + 80, false), 'se');
  assert.equal(M.hitTest(view, c, 28, 70, false), 'w');
  assert.equal(M.hitTest(view, c, 60, 41, false), 'n');
  assert.equal(M.hitTest(view, c, 80, 80, false), 'move');
  assert.equal(M.hitTest(view, c, 5, 5, false), 'pan');
  assert.equal(M.hitTest(view, c, 30 + 15, 40 - 15, false), 'pan');
  assert.equal(M.hitTest(view, c, 30 + 15, 40 - 15, true), 'nw');
  // Typed: a side sets the other by a locked ratio, a crop past the edge moved back in.
  const r = { width: 256, imageH: 256 };
  let f = { crop: { x: 0, y: 8, w: 64, h: 48 }, aspect: '4:3', clamped: true, cropDef: true };
  assert.equal(M.typeCrop(f, r, 'w', 150), false);
  assert.deepEqual([f.crop, f.clamped, f.cropDef], [{ x: 0, y: 8, w: 150, h: 113 }, false, false]);
  assert.equal(M.typeCrop(f, r, 'x', 200), true);
  assert.deepEqual(f.crop, { x: 106, y: 8, w: 150, h: 113 });
  f = { crop: { x: 0, y: 0, w: 120, h: 120 }, aspect: 'free' };
  M.setAspect(f, r, '3:2');
  assert.deepEqual([f.crop, f.aspect], [{ x: 0, y: 20, w: 120, h: 80 }, '3:2']);
  // The ratio wins (v569): where the image cannot hold a crop at it with sides of 64 px, the
  // widest it holds (to v568 the sides won: 64 × 60 at 1:1, 64 × 50 at 4:3 typed).
  M.setAspect(f, { width: 256, imageH: 60 }, '1:1');
  assert.deepEqual(f.crop, { x: 30, y: 0, w: 60, h: 60 }, 'its sides under 64 px: the least sides give way');
  for (const [W, H, a, want] of [[256, 60, '1:1', [60, 60]], [300, 50, '4:3', [67, 50]], [300, 50, '3:2', [75, 50]], [60, 256, '1:1', [60, 60]], [50, 300, '4:3', [50, 38]],
    [70, 100, '3:2', [70, 47]], [100, 70, '4:3', [85, 64]], [1000, 800, '4:3', [85, 64]], [1000, 800, '3:2', [96, 64]]]){
    const g = { crop: { x: 0, y: 0, w: W, h: H }, aspect: 'free' }, im = { width: W, imageH: H };
    M.setAspect(g, im, a);
    // typed small, the least at the ratio (to v568, on any image, 64 × 64 at 4:3)
    M.typeCrop(g, im, 'w', 10);
    assert.deepEqual([g.crop.w, g.crop.h, g.aspect], [...want, a], `${W}×${H} at ${a}`);
    assert.ok(M.validCrop(g.crop, im, M.ASPECTS[a]));
    // a corner dragged to nothing, the same; moved, its size kept
    assert.deepEqual([M.resized(g.crop, 'nw', 500, 500, W, H, M.ASPECTS[a])].map(z=> [z.w, z.h])[0], want);
    M.dragCrop(g, { mode: 'move', c0: { ...g.crop, x: 0, y: 0 }, clamped: false, def: false }, 3, 2, W, H);
    assert.deepEqual([g.crop.w, g.crop.h], want, 'moved');
  }
  // Reset to the default: the whole image less its bar, its ratio from it.
  const S = loaded('a', 'b');
  f = S.allFiles[1]; f.crop = { x: 3, y: 3, w: 70, h: 70 }; f.aspect = '1:1'; f.clamped = true;
  M.setCropDef(U, f, true);
  assert.deepEqual([f.crop, f.aspect, f.clamped, f.cropDef], [{ x: 0, y: 0, w: 120, h: 92 }, 'free', false, true]);
  // A drag: back where it started, the crop it was with its flags; moved, the default no longer.
  const d = { mode: 'move', c0: { x: 10, y: 10, w: 70, h: 70 }, clamped: true, def: true };
  M.dragCrop(f, d, 0, 0, 120, 92);
  assert.deepEqual([f.crop, f.clamped, f.cropDef], [d.c0, true, true]);
  assert.notEqual(f.crop, d.c0);
  M.dragCrop(f, d, 100.4, -3.6, 120, 92);
  assert.deepEqual([f.crop, f.clamped, f.cropDef], [{ x: 50, y: 6, w: 70, h: 70 }, false, false]);
  M.dragCrop(f, { ...d, mode: 'e' }, 5, 0, 120, 92);
  assert.deepEqual(f.crop, { x: 10, y: 10, w: 75, h: 70 });
  // The view: the pane as tall as the image at its width (at least 160 px, at most 70 % of the
  // window), the image fitted, a zoom kept against the fit and given back as it was.
  assert.deepEqual(M.paneSize({ width: 200, imageH: 100 }, 600, 900), [600, 300]);
  assert.deepEqual(M.paneSize({ width: 100, imageH: 400 }, 600, 900), [600, 630]);
  assert.deepEqual(M.paneSize(null, 0, 100), [1, 160]);
  const im = { width: 200, imageH: 100 }, v0 = M.viewIn(im, 600, 300, null);
  assert.deepEqual(v0, { s: 3, ox: 0, oy: 0 });
  const v1 = { ...v0, ...M.zoomedAt(v0, im, 600, 300, 150, 75, 2) };
  assert.deepEqual(v1, { s: 6, ox: -150, oy: -75 });
  const ed = M.zoomOf(v1, im, 600, 300, 'id');
  assert.deepEqual(ed, { id: 'id', k: 2, cx: 75, cy: 37.5 });
  assert.deepEqual(M.viewIn(im, 600, 300, ed), v1);
  assert.deepEqual(M.zoomedTo(v0, { x0: 300, y0: 150, x1: 0, y1: 0 }, 600, 300), { s: 6, ox: 0, oy: 0 });
  assert.equal(M.zoomedAt(v0, im, 600, 300, 0, 0, 1e6).s, 32);
  assert.equal(M.zoomedAt(v0, im, 600, 300, 0, 0, 1e-6).s, 1.5);
});

/* v570: a crop made at a ratio reads back as that ratio (aspectOf), on a tiny image too, where
   fitCrop's whole pixels put it more than 1 % off (50 × 38 at 4:3: to v569 read as free, the
   selector saying 4:3); a crop of sides at least 64 px reads as with 1 % alone. Restored with
   no ratio of its own, such a crop takes its ratio; its image's whole crop, the default, too. */
test('the crop\'s ratio read back: what fitCrop makes at a ratio, on tiny images too; crops of 64 px and more as before (v570)', ()=>{
  assert.equal(M.aspectOf(50, 38), '4:3');
  assert.equal(M.aspectOf(62, 47), '4:3');
  assert.equal(M.aspectOf(43, 29), '3:2');
  assert.deepEqual([M.aspectOf(50, 37), M.aspectOf(52, 38), M.aspectOf(48, 40)], ['free', 'free', 'free'], 'a pixel more than the rounding: free');
  const R = rng(570), int = (a, b)=> a + Math.floor(R.u()*(b - a + 1));
  for (let k = 0; k < 20000; k++){
    // images from 8 px (under it, 3 × 2 and the like are a crop of two ratios at once)
    const W = int(8, k % 2 ? 90 : 600), H = int(8, k % 3 ? 90 : 600), a = ['1:1', '4:3', '3:2'][k % 3];
    const c = M.fitCrop({ x: 0, y: 0, w: int(-10, 700) + R.u(), h: int(-10, 700) + R.u() }, W, H, M.ASPECTS[a]);
    assert.equal(M.aspectOf(c.w, c.h), a, JSON.stringify([W, H, a, c]));
  }
  // Sides of 64 px and more (a crop as the rules make it, on an image that holds one): as v569
  // read them, 1 % alone.
  const old = (w, h)=> Object.keys(M.ASPECTS).find(k=> M.ASPECTS[k] && Math.abs(w/h/M.ASPECTS[k] - 1) < 0.01) || 'free';
  for (let w = 64; w <= 400; w++) for (let h = 64; h <= 400; h++) if (M.aspectOf(w, h) !== old(w, h)) assert.fail(`${w} × ${h}: ${M.aspectOf(w, h)}, was ${old(w, h)}`);
  // A tiny image, 50 × 38: its whole crop (the default) at 4:3; a crop restored with no ratio
  // of its own (a project made before the ratio was kept) read as 4:3, kept as it is.
  const b = new Uint8Array(makeTiff({ W: 50, H: 38, strip: 0, sign: 'Tiny', pixelNm: 300, mag: 400, seed: 11 }));
  const t = M.newFile('t.tif', readTescanTiff(b, 't.tif', { head: true }), new Ref(hashBytes(b), b));
  assert.deepEqual([t.crop, t.aspect], [{ x: 0, y: 0, w: 50, h: 38 }, '4:3']);
  const T = newS(); T.allFiles = [t]; filesChanged(T);
  const s0 = M.snapshotOf(T).files[0];
  const Q = newS(); restore(Q, { files: [{ ...s0, raw: t.raw, cropDef: false, crop: { x: 0, y: 0, w: 50, h: 38 }, aspect: undefined }] });
  assert.deepEqual([Q.allFiles[0].crop, Q.allFiles[0].aspect], [{ x: 0, y: 0, w: 50, h: 38 }, '4:3']);
});

/* ---- Intensity ---- */
test('intensity: the levels, each normalisation and its curve, the settings read back and their scope', ()=>{
  const hist = new Float64Array(65536); hist[100] = 50; hist[200] = 50;
  const st = { n: 100, hist, mean: 150, sd: 50 };
  assert.equal(M.levelAt(st, 0.49), 100); assert.equal(M.levelAt(st, 0.5), 200); assert.equal(M.levelAt(st, 1), 65534);
  const bins = M.histBins(st);
  assert.equal(bins[0], 100); assert.equal(bins.reduce((a, b)=> a + b, 0), 100);
  const S = loaded('a', 'b', 'c'), [a, b, c] = S.allFiles;
  // Percentile: the levels at 0.5 and 99.5 % of the crop's; a curve from black to white.
  const n0 = M.normOf(U, S, a), sa = statsOf(a);
  assert.deepEqual(n0, { lo: M.levelAt(sa, 0.005), hi: M.levelAt(sa, 0.995) });
  const lut = M.makeLut(U, S, a);
  assert.equal(lut[0], 0); assert.equal(lut[65535], 255);
  for (let v = 1; v < 65536; v++) assert.ok(lut[v] >= lut[v - 1]);
  // Brightness, contrast and gamma, the image's own on top: at a level, by hand.
  S.intensity = { ...S.intensity, b: 10, c: 1.5, g: 2, def: false }; a.adj = { b: -4, c: 0.8, g: 1.25 };
  const lv = Math.round((n0.lo + n0.hi)/2.7), y0 = Math.min(1, Math.max(0, (lv - n0.lo)/(n0.hi - n0.lo)));
  const y1 = Math.min(1, Math.max(0, (y0 - 0.5)*1.2 + 0.5 + 0.06));
  assert.equal(M.makeLut(U, S, a)[lv], Math.round(Math.pow(y1, 1/2.5)*255));
  // None: the levels as acquired, and no crop in its key.
  S.intensity.mode = 'none';
  assert.deepEqual(M.normOf(U, S, a), { lo: 0, hi: 65535 });
  const k1 = M.lutKey(S, a); a.crop = { ...a.crop, x: 1 };
  assert.equal(M.lutKey(S, a), k1);
  // Mean and SD of the reference (the first loaded, or the one chosen): the levels that land on
  // 0 and 65535 there; the reference's crop in its key.
  S.intensity.mode = 'meansd';
  const sb = statsOf(b), sr = statsOf(a), kk = sb.sd/sr.sd, nb = M.normOf(U, S, b);
  assert.ok(Math.abs(nb.lo - (sb.mean - sr.mean*kk)) < 1e-9 && Math.abs(nb.hi - (sb.mean + (65535 - sr.mean)*kk)) < 1e-9);
  assert.ok(M.lutKey(S, b).includes(`|${a.raw.id}:1,0,96,84|`));
  S.intensity.ref = c.raw.id;
  assert.ok(M.lutKey(S, b).includes(`|${c.raw.id}:`));
  assert.equal(M.refFile(S), c);
  assert.ok(M.isRef(S, c) && !M.isRef(S, a));
  // The histogram's: each level to the reference's at the same share, a table rising to 1.
  S.intensity.mode = 'hist';
  const t = M.normOf(U, S, b).table;
  assert.equal(t[65535], 1);
  for (let v = 1; v < 65536; v++) assert.ok(t[v] >= t[v - 1]);
  // Against a reference at the top levels (J): B's brightest go to its last level below the
  // saturated one, and no further.
  const J = loaded('b', 'j'), [jb, jj] = J.allFiles;
  J.intensity = { ...M.INT_DEF, mode: 'hist', ref: jj.raw.id, def: false };
  const tj = M.normOf(U, J, jb).table, sj = statsOf(jb), top = M.levelAt(sj, 0.9999);
  assert.equal(tj[top], Math.fround(65534/65535));
  assert.equal(tj[M.levelAt(sj, 0.5)] < 65530/65535, true);
  assert.equal(M.normOf(U, J, jj).table[65534], Math.fround(65534/65535), 'J against itself: its top level its own');
  // The settings read back: junk to the defaults; unticked, each value in its range; the Default
  // box ticked (none, as a new one: v586), the defaults, the reference kept, as ticking it sets them.
  assert.deepEqual(M.intensityOf(U, 'x'), M.INT_DEF);
  assert.deepEqual(M.intensityOf(U, { mode: 'gamma', pLo: -1, pHi: 'x', b: 1e9, c: 0.01, g: null, ref: 5, def: false }), { ...M.INT_DEF, def: false });
  assert.deepEqual(M.intensityOf(U, { mode: 'hist', pLo: 2, b: -100, c: 20, g: 0.05, ref: 'r', def: false }), { ...M.INT_DEF, mode: 'hist', pLo: 2, b: -100, c: 20, g: 0.05, ref: 'r', def: false });
  assert.deepEqual(M.intensityOf(U, { mode: 'hist', pLo: 2, b: -100, c: 20, g: 0.05, ref: 'r', def: true }), { ...M.INT_DEF, ref: 'r' });
  for (const def of [undefined, 'no']) assert.deepEqual(M.intensityOf(U, { mode: 'hist', b: 5, def }), M.INT_DEF);
  // The scope: All, or each group its own, starting from All's; back to All, the group's on show.
  S.intensity = { ...M.INT_DEF, b: 7 };
  assert.equal(M.scopeOf(S), 'all'); assert.equal(M.edited(S), S.intensity);
  const [g1, g2] = S.groups;
  M.setScope(S, g2.id);
  assert.deepEqual(Object.keys(S.groupInt).sort(), [g1.id, g2.id].sort());
  assert.equal(M.groupOf(S, S.files[S.cur]), g2);
  assert.equal(M.scopeOf(S), g2.id);
  M.edited(S).b = -3;
  assert.equal(M.intOf(S, S.files[S.cur]).b, -3); assert.equal(M.intOf(S, c).b, 7);
  M.setScope(S, 'all');
  assert.deepEqual([S.groupInt, S.intensity.b], [{}, -3]);
});

/* ---- Groups ---- */
test('groups: placed by pixel size and named, an excluded image deciding nothing, moved, reset; what the figure takes', ()=>{
  // A 25 nm, B 26 nm (within 10 %): one group, named by B's larger pixel; C 50 nm its own; H
  // with no magnification named by its pixel.
  const S = loaded('a', 'b', 'c', 'h');
  assert.deepEqual(S.groups.map(g=> [g.id, g.name, g.members.map(id=> M.byId(S, id).label)]), [['g2', '2.50 kx', ['C&']], ['g1', '4.80 kx', ['A', 'B <b>', 'h']]]);
  assert.equal(M.groupName(U, S, [S.allFiles[3].raw.id]), '5.10 kx');
  const T = loaded('g', 'e');
  assert.deepEqual(T.groups.map(g=> g.name), ['312 x', '36 nm/px'], 'pixels of 42 × 36 nm made square at 36');
  // B left out: A, the larger pixel of the two left, names its group; the figure takes A and
  // H at their common field.
  PAGE.setIncluded(S.allFiles, 1, false, []); filesChanged(S);
  assert.equal(S.groups[1].name, '5.00 kx');
  const [a, , , h] = S.allFiles;
  const o = M.outOf(U, S, a), pT = 25, fovW = Math.min(96*25, 140*24.6), fovH = Math.min(84*25, 56*24.6);
  assert.deepEqual(o, { c: { x: 0, y: 14, w: 96, h: 55 }, px: pT, w: Math.round(fovW/pT), h: Math.round(fovH/pT) });
  assert.equal(M.outOf(U, S, S.allFiles[1]), null);
  assert.deepEqual(M.outOf(U, S, h).c, { x: 21, y: 0, w: 98, h: 56 });
  S.groups[1].mode = 'own';
  assert.deepEqual(M.outOf(U, S, a), { c: a.crop, px: 25, w: 96, h: 84 });
  // The figure's images: the group's, in the list's order, each keyed by what draws it.
  const fig = M.figureImages(U, S, 'g1', (f, fit)=> [f.label, fit]);
  assert.deepEqual(fig.map(m=> [m.label, m.group.name, m.w, m.h, m.canvas(9)]), [['A', '5.00 kx', 96, 84, ['A', 9]], ['h', '5.00 kx', 140, 56, ['h', 9]]]);
  assert.equal(fig[0].key, JSON.stringify([M.outOf(U, S, a), S.intensity, a.adj || M.ADJ_DEF, '']));
  // Moved: into a new group, its old one keeping the others; alone in its figure, not.
  assert.equal(M.moveImage(U, S, a.raw.id, 'new'), true);
  assert.deepEqual(S.groups.map(g=> [g.id, g.name, g.members.length]), [['g2', '2.50 kx', 1], ['g1', '5.10 kx', 2], ['g3', '5.00 kx', 1]]);
  assert.equal(M.moveImage(U, S, a.raw.id, 'new'), false);
  assert.equal(M.moveImage(U, S, a.raw.id, 'g9'), false);
  assert.equal(M.moveImage(U, S, S.allFiles[2].raw.id, 'g3'), true);
  assert.deepEqual(S.groups[0], { id: 'g2', name: '2.50 kx', named: false, mode: 'common', members: [], keep: true });
  // An empty group kept till removed; a name typed, emptied back to the magnification.
  M.renameGroup(U, S, S.groups[1], '  Mine  ');
  assert.deepEqual([S.groups[1].name, S.groups[1].named], ['Mine', true]);
  M.renameGroup(U, S, S.groups[1], ' ');
  assert.deepEqual([S.groups[1].name, S.groups[1].named], ['5.10 kx', false]);
  M.addGroup(S);
  assert.deepEqual(S.groups.at(-1), { id: 'g4', name: 'New group', named: false, mode: 'common', members: [], keep: true });
  M.dropGroup(U, S, 'g3');
  assert.ok(S.groups.some(g=> g.id === 'g3'), 'a group with images is not removed');
  M.dropGroup(U, S, 'g4'); M.dropGroup(U, S, 'g2');
  assert.deepEqual(S.groups.map(g=> g.id), ['g1', 'g3']);
  // Reset: made again; one with the same images keeps its figure and its settings.
  S.figures = { g1: { wmm: 99 }, g3: { wmm: 50 } }; S.groupInt = { g1: { ...M.INT_DEF, b: 4 } };
  M.regroup(U, S);
  // (B, left out, placed after the images in the figure)
  assert.deepEqual(S.groups.map(g=> [g.id, g.members.map(id=> M.byId(S, id).label)]), [['g2', ['C&']], ['g1', ['A', 'h', 'B <b>']]]);
  assert.deepEqual([S.figures, S.groupInt], [{}, {}]);
  // Linked: one crop, narrowed where an image is smaller (and so marked); Link all of a scope.
  const L = loaded('a', 'e', 'd'), [la, le, ld] = L.allFiles;
  la.crop = { x: 10, y: 4, w: 80, h: 70 };
  M.setLinked(U, L, la, true); M.setLinked(U, L, le, true);
  assert.deepEqual([le.crop, le.clamped, le.linked], [{ x: 0, y: 0, w: 48, h: 40 }, true, true]);
  M.linkAll(U, L, ld, M.scopeFiles(L));
  assert.ok(L.allFiles.every(f=> f.linked));
  assert.deepEqual([la.crop, le.crop], [{ x: 0, y: 0, w: 96, h: 84 }, { x: 0, y: 0, w: 48, h: 40 }]);
  assert.equal(M.linkAllText(M.scopeFiles(L)), 'Unlink all');
  M.linkAll(U, L, ld, M.scopeFiles(L));
  assert.ok(L.allFiles.every(f=> !f.linked && !f.clamped));
});

/* ---- The state ---- */
test('the state: saved and read back, a v517 project, ids made again, files twice or lost, malformed values', ()=>{
  const S = loaded('a', 'f', 'e');
  S.allFiles[0].crop = { x: 4, y: 5, w: 70, h: 66 }; S.allFiles[0].cropDef = false; S.allFiles[0].linked = true;
  S.figures = { g1: { wmm: 120 } };
  const s = M.snapshotOf(S);
  assert.notEqual(s.files[0].crop, S.allFiles[0].crop);
  const T = newS(); restore(T, JSON.parse(JSON.stringify(s), (k, v)=> typeof v === 'string' && v.startsWith('raw:') ? S.allFiles.find(f=> f.raw.id === v.slice(4)).raw : v));
  assert.equal(canon(M.snapshotOf(T)), canon(s));
  // v517: the bytes as base64 under their id; an id not of their form made again from them.
  const b64 = f => ({ id: f.raw.id, b64: Buffer.from(f.raw.bytes).toString('base64') });
  const old = { ...s, files: s.files.map((f, i)=> ({ ...f, raw: i === 1 ? { ...b64(f), id: 'deadbeef-1' } : b64(f) })) };
  const V = newS(); restore(V, old);
  assert.deepEqual(V.allFiles.map(f=> f.raw.id), S.allFiles.map(f=> f.raw.id));
  assert.ok(V.allFiles.every((f, i)=> Buffer.from(f.raw.bytes).equals(Buffer.from(S.allFiles[i].raw.bytes))));
  // Twice: the second dropped; lost: left out and said; none: not loaded.
  const W = newS();
  restore(W, { files: [s.files[0], { ...s.files[0], name: 'again' }, { name: 'gone <1>', raw: { id: 'x', bytes: new Uint8Array(9) } }, { name: 'none', raw: null }, 7], cur: 5 });
  assert.deepEqual([W.allFiles.length, W.cur], [1, 0]);
  // (v567: a warning of the project opened, its files left out counted, utils.js FILE ALERTS)
  assert.equal(alertsOf(W),
    PAGE.alertHtml('warn', 'Opened, to check:', ['2 files left out: their stored bytes no longer read.'], 'sem-dismiss-invalid'));
  assert.equal(H.lostLine(1), '1 file left out: its stored bytes no longer read.');
  // A crop at its ratio under 64 px, where the image cannot hold both (v569), read back as it
  // was; with no ratio, or another, widened to 64 px as before.
  const hf = fileOf('h'), hr = info(hf);
  assert.ok(hr.imageH < 64 && hr.width > 64, JSON.stringify([hr.width, hr.imageH]));
  const sq = { x: 20, y: 0, w: hr.imageH, h: hr.imageH };
  const Q = newS(); restore(Q, { files: [{ ...M.snapshotOf(loaded('h')).files[0], raw: hf.raw, cropDef: false, crop: sq, aspect: '1:1' }] });
  assert.deepEqual([Q.allFiles[0].crop, Q.allFiles[0].aspect], [sq, '1:1']);
  for (const aspect of ['free', '4:3', 'toString']){
    restore(Q, { files: [{ ...M.snapshotOf(loaded('h')).files[0], raw: hf.raw, cropDef: false, crop: sq, aspect }] });
    assert.deepEqual(Q.allFiles[0].crop, { ...sq, w: 64 }, aspect);
  }
  // Malformed: crops, ratios, corrections, flags, names, settings, groups, figures, the index.
  const Y = newS();
  restore(Y, { files: [{ ...s.files[0], name: 7, label: null, crop: { x: '1', y: 2, w: 3, h: 4 }, aspect: 'toString', adj: { b: 500, c: 0, g: 'x' }, adjDef: true, cropDef: true, linked: 'yes', clamped: 1, included: 0, held: 5 },
    { ...s.files[2], crop: { x: -50, y: 1e9, w: 1e6, h: 2.5 }, adj: null, adjDef: 'x', included: false, held: { a: 1 } }],
    intensity: 'x', groupInt: { g1: { mode: 'none' }, '': {}, constructor: {}, toString: 5 }, figures: { g1: 5, g2: { a: 1 }, hasOwnProperty: {} },
    groups: [null, { id: '' }, { id: 'constructor' }, { id: 'g2', members: [s.files[0].raw.id, 7, s.files[0].raw.id], name: 5, named: 'y', mode: 'x', keep: true }, { id: 'g2' }, { id: 'g5', members: [], keep: true }], cur: 2.5 });
  const [y0, y1] = Y.allFiles;
  assert.deepEqual([y0.name, y0.label, y0.crop, y0.aspect, y0.adj, y0.adjDef, y0.cropDef, y0.linked, y0.clamped, 'included' in y0, y0.held],
    ['image', 'image', { x: 0, y: 0, w: 96, h: 84 }, 'free', { b: 0, c: 1, g: 1 }, true, true, false, false, false, undefined]);
  assert.deepEqual([y1.crop, y1.adj, y1.adjDef, y1.included, y1.held], [{ x: 0, y: 0, w: 48, h: 40 }, { b: 0, c: 1, g: 1 }, true, false, { a: 1 }]);
  assert.deepEqual([Y.intensity, Y.groupInt, Y.figures, Y.cur], [M.INT_DEF, { g1: M.INT_DEF }, { g2: { a: 1 } }, 0]);
  // (the largest pixel first, an empty group last)
  assert.deepEqual(Y.groups, [{ id: 'g1', name: '312 x', named: false, mode: 'common', members: [y1.raw.id] }, { id: 'g2', members: [y0.raw.id], name: '5.00 kx', named: false, mode: 'common' },
    { id: 'g5', members: [], keep: true, name: '', named: false, mode: 'common' }]);
  // A key that is no name: none taken, the settings' prototype kept as it is (a project
  // file's "__proto__" read by JSON.parse is a key of its own).
  const P0 = newS();
  restore(P0, { files: s.files, groupInt: JSON.parse('{"__proto__": {"mode": "none", "def": false}, "constructor": {}, "": {}}'), groups: [{ id: 'mode', members: s.files.map(f=> f.raw.id) }] });
  assert.equal(Object.getPrototypeOf(P0.groupInt), Object.prototype);
  assert.deepEqual([Object.keys(P0.groupInt), P0.groupInt.mode, M.intOf(P0, P0.allFiles[0])], [[], undefined, P0.intensity]);
  for (const junk of [null, 'x', [], {}, { files: 'x' }]){ const J = newS(); restore(J, junk); assert.deepEqual([J.allFiles, J.groups, J.intensity, J.cur], [[], [], M.INT_DEF, 0]); }
  // The ids a state holds; the same bytes.
  assert.deepEqual([...M.idsIn({ a: [{ id: 'x', bytes: 1 }, { id: 'y', b64: '' }], b: { c: { id: 'z' } }, d: new Uint8Array(3) })], ['x', 'y']);
  const u = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(M.sameBytes(u, u.slice()) && !M.sameBytes(u, u.slice(1)) && !M.sameBytes(u, Uint8Array.from(u, (x, i)=> i === 8 ? 0 : x)) && M.sameBytes(u.subarray(1), u.slice(1)));
  // What it shows beside its state, and given back.
  S.ed = { id: 'q', k: 2, cx: 1, cy: 2 };
  assert.deepEqual(M.showsOf(S), { img: S.files[0].raw.id, ed: { id: 'q', k: 2, cx: 1, cy: 2 } });
  assert.deepEqual(M.nextOf({ img: 'i', ed: { id: 'q', k: 2, cx: 1, cy: 2, z: 1 } }), { ed: { id: 'q', k: 2, cx: 1, cy: 2 }, img: 'i' });
  assert.deepEqual(M.nextOf({ img: 3, ed: { id: 'q', k: 0, cx: 1, cy: 2 } }), { ed: null, img: null });
  assert.deepEqual(M.nextOf(null), { ed: null, img: null });
});

/* v583: an old project opens as this version reads it. Made here as older versions saved it: a
   crop in the pixels as acquired of an image whose pixels are made square now (to v487, no
   `sq`), one figure for every group (`figure`, to v439), an image's bytes as numbers (to v483). */
test('an old project: old fields ignored, the defaults in their place (v583)', ()=>{
  const S = loaded('a', 'f', 'e'), s = M.snapshotOf(S), r = info(S.allFiles[1]);
  assert.ok(r.squared && r.width === 110 && r.imageH === 101 && s.files[1].sq === true);
  const old = { ...s, figure: { wmm: 140, file: 'old' }, figures: undefined,
    files: [s.files[0], { ...s.files[1], sq: undefined, cropDef: false, crop: { x: 10, y: 10, w: 80, h: 60 }, aspect: '4:3' }, { ...s.files[2], raw: { id: s.files[2].raw.id, bytes: [...s.files[2].raw.bytes] } }] };
  const X = newS();
  assert.doesNotThrow(()=> restore(X, old));
  // the crop of no square pixels: the default, its ratio free, its box as the state holds it
  // (unticked: v586, to v585 ticked, deduced from the crop); one of now kept
  assert.deepEqual([X.allFiles[1].crop, X.allFiles[1].sq, X.allFiles[1].aspect, X.allFiles[1].cropDef], [{ x: 0, y: 0, w: 110, h: 101 }, true, 'free', false]);
  const Y = newS(); restore(Y, { files: [{ ...s.files[1], cropDef: false, crop: { x: 10, y: 10, w: 80, h: 70 }, aspect: 'free' }] });
  assert.deepEqual([Y.allFiles[0].crop, Y.allFiles[0].cropDef], [{ x: 10, y: 10, w: 80, h: 70 }, false]);
  // the one figure: none of a group's (each its default); the image of no bytes left out, said
  assert.deepEqual([X.figures, X.allFiles.length], [{}, 2]);
  assert.equal(alertsOf(X), PAGE.alertHtml('warn', 'Opened, to check:', ['1 file left out: its stored bytes no longer read.'], 'sem-dismiss-invalid'));
  // what it shows worked out from the images: their curves and CSV as a project of now's with those crops
  const N = newS(); restore(N, { ...s, files: [s.files[0], { ...s.files[1], cropDef: true }] });
  assert.deepEqual(M.csvOf(U, X), M.csvOf(U, N));
});

/* v586: the Default boxes of a project saved before them (to v441: the settings, an image's crop
   and correction with no box) take their default, ticked, as a new image's and new settings'
   are: their values the defaults, as ticking them sets them (to v585 each box was deduced from
   the values, unticked where they were not the defaults). A box the state holds stays as it is. */
test('an old project: Default boxes missing, ticked as new ones are, their values the defaults (v586)', ()=>{
  const S = loaded('a', 'b'), s = M.snapshotOf(S), strip = ({ cropDef: _c, adjDef: _a, ...f })=> f;
  const old = { ...s, intensity: { mode: 'hist', pLo: 2, pHi: 90, b: 7, c: 1.3, g: 0.8, ref: s.files[1].raw.id }, groupInt: { g1: { mode: 'none', b: 5 } },
    files: [{ ...strip(s.files[0]), crop: { x: 4, y: 5, w: 70, h: 66 }, adj: { b: 9, c: 1.5, g: 1.2 } }, { ...strip(s.files[1]), cropDef: false, adjDef: false, crop: { x: 2, y: 3, w: 80, h: 64 }, adj: { b: -3, c: 1, g: 1 } }] };
  const X = newS();
  assert.doesNotThrow(()=> restore(X, old));
  const [a, b] = X.allFiles, r = info(a);
  assert.deepEqual([a.cropDef, a.crop, a.aspect, a.adjDef, a.adj], [true, { x: 0, y: 0, w: r.width, h: r.imageH }, M.aspectOf(r.width, r.imageH), true, M.ADJ_DEF]);
  assert.deepEqual([b.cropDef, b.crop, b.adjDef, b.adj], [false, { x: 2, y: 3, w: 80, h: 64 }, false, { b: -3, c: 1, g: 1 }], 'the boxes it holds: as they are');
  assert.deepEqual([X.intensity, X.groupInt], [{ ...M.INT_DEF, ref: s.files[1].raw.id }, { g1: M.INT_DEF }]);
  // what it shows: as a project of now's with the boxes ticked
  const N = newS(); restore(N, { ...s, intensity: { ...M.INT_DEF, ref: s.files[1].raw.id }, groupInt: { g1: M.INT_DEF }, files: [s.files[0], old.files[1]] });
  assert.deepEqual(M.csvOf(U, X), M.csvOf(U, N));
});

/* ---- The markup ---- */
test('the markup: the Image box, the groups, the alerts and the options, every name escaped', ()=>{
  const S = loaded('b', 'f', 'h');
  S.allFiles[0].label = 'B <i>&"'; S.allFiles[0].clamped = true;
  const [b, f] = S.allFiles;
  const box = H.infoHtml(HU, b, info(b), M.outOf(U, S, b));
  assert.ok(box.startsWith('<div class="sem-info-row"><span class="txt-meta">Image</span><span>120 × 92 px (info bar of 8 rows left out)</span></div>'), box);
  assert.ok(box.includes('<span>26 nm</span>') && box.includes('<span>3.12 µm</span>') && box.includes('<span>4.80 kx</span>') && box.includes('<span>15 kV · WD 10 mm</span>'));
  assert.ok(box.includes('<span>SE · gain —, offset —</span>') && box.includes('<span>2024-01-01 10:00:00 · MIRA</span>'));
  assert.ok(box.includes('<span>120 × 92 px, 3.12 × 2.392 µm <span class="sem-note-info">ⓘ narrowed to fit</span></span>'), box);
  // (with H, 24.6 nm: at B's 26 nm, its field of 56 rows of 24.6 nm, 53 of B's)
  assert.ok(box.endsWith('<span class="txt-meta">In the figure</span><span>120 × 53 px at 26 nm, 3.12 × 1.378 µm of the crop</span></div>'), box);
  const fb = H.infoHtml(HU, f, info(f), null);
  assert.ok(fb.includes('<span>110 × 101 px, 110 × 84 px as acquired (info bar of 6 rows left out)</span>') && fb.includes('square: resampled from 40 × 48 nm pixels') && !fb.includes('In the figure'), fb);
  const groups = H.groupsHtml(HU, S);
  assert.ok(groups.includes('title="B &lt;i&gt;&amp;&quot;"><div class="sem-gimg-pic"></div><span class="sem-thumb-cap">B &lt;i&gt;&amp;&quot;</span>'));
  assert.equal((groups.match(/class="sem-group"/g) || []).length, 2);
  M.addGroup(S); S.groups[0].name = '<x>';
  const g2 = H.groupsHtml(HU, S);
  assert.ok(g2.includes('class="sem-group is-empty" data-g="g3"') && g2.includes('data-del="g3"') && g2.includes(' disabled title="No images in this group yet"') && g2.includes('value="&lt;x&gt;"'));
  PAGE.setIncluded(S.allFiles, 1, false, []); filesChanged(S);
  assert.ok(!H.groupsHtml(HU, S).includes(`data-g="${M.groupOf(S, f).id}"`), 'a group whose images are all out is not shown');
  assert.equal(H.scopeHtml(HU, [{ id: 'g<1>', name: 'A & B' }]), '<option value="all">All</option><option value="g&lt;1&gt;">A &amp; B</option>');
  assert.equal(H.refHtml(HU, [b]), `<option value="${b.raw.id}">B &lt;i&gt;&amp;&quot;</option>`);
  // The alerts of a line, about the files still in the list; dismissed one kind at a time.
  S.line = 1;
  M.setAlerts(S, { bad: { names: [H.fileLine(HU, 'x<1>.tif', 'not a TIFF')], ids: [b.raw.id] }, dup: [{ id: b.raw.id, html: 'b.tif' }] });
  const BAD = PAGE.alertHtml('bad', 'Not loaded:', ['x&lt;1&gt;.tif: not a TIFF.'], 'sem-dismiss-invalid'), DUP = PAGE.alertHtml('info', 'Already loaded, not loaded again:', ['b.tif.'], 'sem-dismiss-upload');
  assert.equal(alertsOf(S), BAD + DUP);
  // What the reading of an image in the list said (v572: worked out from the images there are,
  // not a line's): its warning, to check, until its box's × marks it seen, in the list and in
  // the states of the history that hold it (by its id), which an undo and the project keep.
  const wb = new Uint8Array(makeTiff({ W: 60, H: 50, strip: 6, sign: 'W', seed: 11, extraMain: 'ImageStripSize=8\r\n' }));
  const w = M.newFile('w<1>.tif', readTescanTiff(wb, 'w<1>.tif', { head: true }), new Ref(hashBytes(wb), wb));
  S.allFiles.push(w);
  const CHECK = PAGE.alertHtml('warn', 'Loaded, to check:', ['w&lt;1&gt;.tif: the row under the image (row 43) is not the info bar&#39;s uniform border: the bar may not be where Tescan puts it, so check the image&#39;s bottom edge.'], 'sem-dismiss-check');
  assert.equal(alertsOf(S), BAD + CHECK + DUP, 'error, warning, info');
  const states = [{ files: [{ ...w, raw: new Ref(w.raw.id, wb) }, { ...b }] }, { files: [] }, { cur: 1 }], hist = { patch: fn =>{ states.splice(0, 3, ...states.map(fn)); } };
  const was = states.slice();
  markSeen(hist, H.fileNotes(HU, S.allFiles, info), 'check', { same: M.sameImage });
  assert.equal(alertsOf(S), BAD + DUP, 'dismissed');
  assert.deepEqual([w.seen, b.seen, states[0].files.map(f=> f.seen)], [['check'], undefined, [['check'], undefined]]);
  assert.ok(states[0] !== was[0] && states[0].files[1] === was[0].files[1] && states[1] === was[1] && states[2] === was[2] && !was[0].files[0].seen, 'copies where marked, the states\' own objects unchanged');
  // As a project holds it (v573): its marks those that are one, once each (to v572 whatever it held).
  const Z = newS();
  restore(Z, { files: [{ ...states[0].files[0], seen: ['check', 3, null, 'check', 'nope', { check: 1 }, 'read:x'] }, { ...b, seen: 'check' }] });
  assert.deepEqual(Z.allFiles.map(f=> f.seen), [['check', 'read:x'], undefined]);
  S.allFiles.pop();
  M.dropAlertsOf(S, b.raw.id);
  assert.equal(alertsOf(S), '');
  assert.equal(S.alertsOf.size, 0);
  for (let k = 0; k < 40; k++){ S.line = 100 + k; M.setAlerts(S, { dup: [{ id: 'x', html: 'x' }] }); }
  assert.equal(S.alertsOf.size, 32);
  assert.equal(M.faultText({ kind: 'RangeError', fault: 'x' }), 'too large for the memory this page has');
  assert.equal(M.faultText({ kind: 'TypeError', fault: 'bad <x>' }), 'could not be read: bad <x>');
  assert.deepEqual([M.magText({ mag: 12345 }), M.magText({ mag: 400 }), M.magText({ mag: 0 }), M.sig(NaN, 3), M.sig(0.000123456, 3)], ['12.3 kx', '400 x', '', '—', '0.000123']);
});

/* ---- The fixtures as v557's page analysed them ----
   The three fixtures (tests/fixtures.mjs: S1 and S2 at 25 nm, S3 at 50 nm with markup in its
   metadata) dropped into a new SEM tab: the CSV the page wrote (golden.page: its SHA-256). */
function pageCsv(){
  const fx = [{ sign: 'S1', pixelNm: 25, mag: 5000, seed: 1 }, { sign: 'S2', pixelNm: 25, mag: 5000, seed: 2 }, { sign: 'S3', pixelNm: 50, mag: 2500, seed: 3, extraMain: 'Note=<i data-x=1>meta\r\n' }];
  const S = newS();
  S.allFiles = fx.map((o, i)=>{ const b = new Uint8Array(makeTiff(o)), name = `img${i + 1}.tif`; return M.newFile(name, readTescanTiff(b, name, { head: true }), new Ref(hashBytes(b), b)); });
  filesChanged(S);
  return M.csvOf(U, S);
}

/* ---- Cases as v557's sem.js gave them ----
   Random images of the set (some twice, some left out, some lost), a state of each (crops,
   ratios, corrections and flags, settings and their scope, groups and figures, of every
   version and malformed) put back as sem.js does, then six steps of the tab (sem.js's wiring
   in short, below: what a hidden tab does, whose redraws wait for its show): after the state
   and after each step, the state, the CSV, the alerts, the Image box of each image shown, the
   groups' boxes, the settings' selectors, each image's curve (its key, normalisation and
   levels) and what the figure takes of each group's images. Their digests:
   tests/golden/semmodel.json. */
const KEYS = Object.keys(IMG);
export function caseOf(n){
  const R = rng(5580 + n), u = R.u, pick = a => a[Math.floor(u()*a.length)], int = (a, b)=> a + Math.floor(u()*(b - a + 1));
  const junk = ()=> pick([null, 'x', -1, 0, 2.5, NaN, 1e9, [], {}, true]);
  const files = Array.from({ length: int(1, 6) }, ()=>{
    const k = pick(KEYS), b = BYTES[k], r = readTescanTiff(b, IMG[k][0], { head: true }), id = hashBytes(b);
    const f = { name: IMG[k][0], label: r.name, raw: u() < 0.08 ? { id: 'x', bytes: new Uint8Array(12) } : u() < 0.15 ? { id: u() < 0.5 ? id : 'zz', b64: Buffer.from(b).toString('base64') } : { id, bytes: b },
      crop: { x: 0, y: 0, w: r.width, h: r.imageH }, aspect: 'free', cropDef: true, linked: u() < 0.2, clamped: false, adjDef: true, adj: { b: 0, c: 1, g: 1 } };
    if (u() < 0.5){ f.crop = { x: int(-5, 60), y: int(-5, 40), w: int(10, 200), h: int(10, 160) }; f.cropDef = u() < 0.2; f.aspect = pick(['1:1', '4:3', '3:2', 'free', 'x']); }
    if (u() < 0.3){ f.adj = { b: int(-120, 120), c: pick([0.5, 1, 2.5, 30]), g: pick([0.3, 1, 1.7]) }; f.adjDef = u() < 0.3; }
    if (u() < 0.15) f.included = false;
    if (u() < 0.1) f.sq = pick([true, undefined]);
    if (u() < 0.06) f.crop = junk();
    return f;
  });
  const ids = files.map(f=> f.raw.id);
  const state = { files, cur: u() < 0.8 ? int(0, files.length) : junk(),
    intensity: u() < 0.2 ? junk() : { mode: pick(M.MODES), pLo: pick([0.5, 2, 60]), pHi: pick([99.5, 90]), ref: u() < 0.5 ? pick(ids) : null, b: int(-20, 20), c: pick([1, 1.3]), g: pick([1, 0.8]), def: pick([true, false, undefined]) },
    groupInt: u() < 0.3 ? { g1: { mode: pick(M.MODES), b: 5, def: false }, g9: {}, '': {} } : {},
    groups: u() < 0.3 ? [{ id: 'g1', name: 'Mine', named: true, mode: pick(['own', 'common']), members: ids.slice(0, 2) }, { id: 'g7', members: [], keep: true }, { id: 'constructor' }] : [],
    figures: u() < 0.3 ? { g1: { wmm: 99 }, g2: 5 } : {} };
  if (u() < 0.1){ delete state.figures; state.figure = { wmm: 120, file: 'f' }; }
  const steps = Array.from({ length: 6 }, ()=>{
    const op = pick(OPS);
    if (op === 'crop') return [op, pick(['X', 'Y', 'W', 'H']), int(-20, 300)];
    if (op === 'aspect') return [op, pick(['1:1', '4:3', '3:2', 'free'])];
    if (op === 'cropDef' || op === 'intDef' || op === 'adjDef') return [op, u() < 0.5];
    if (op === 'link') return [op, int(0, 6), u() < 0.7];
    if (op === 'scope') return [op, u() < 0.4 ? 'all' : 'g' + int(1, 5)];
    if (op === 'int') return [op, ...pick([['pLo', 3], ['pHi', 95], ['b', -12], ['c', 1.8], ['g', 0.6]])];
    if (op === 'adj') return [op, ...pick([['b', 9], ['c', 0.7], ['g', 1.6]])];
    if (op === 'norm') return [op, pick(M.MODES)];
    if (op === 'ref') return [op, pick(ids)];
    if (op === 'move') return [op, pick(ids), pick(['new', 'g1', 'g2', 'g3', 'g4'])];
    if (op === 'rename') return [op, 'g' + int(1, 4), pick(['', 'A <b>', ' x '])];
    if (op === 'mode') return [op, 'g' + int(1, 4), pick(['own', 'common'])];
    if (op === 'dropGroup') return [op, 'g' + int(1, 8)];
    if (op === 'go') return [op, int(-2, 7)];
    if (op === 'include') return [op, int(0, 5), u() < 0.5];
    if (op === 'label') return [op, int(0, 5), pick(['L', 'x <i>', ''])];
    if (op === 'remove') return [op, int(0, 5)];
    if (op === 'dismiss') return [op, pick(['sem-dismiss-invalid', 'sem-dismiss-upload', 'sem-dismiss-check'])];
    return [op];
  });
  return { state, steps };
}
const OPS = ['crop', 'aspect', 'cropDef', 'link', 'linkAll', 'scope', 'int', 'adj', 'norm', 'ref', 'intDef', 'adjDef', 'move', 'regroup', 'rename', 'mode', 'addGroup', 'dropGroup', 'go', 'include', 'label', 'remove', 'dismiss'];
// sem.js's wiring of each step, in short, its instance hidden: a change of the groups or of a
// label draws the settings (renderIntensity), which a group without its own takes All's in
// (edited); the rest waits for the show.
const settingsDrawn = S =>{ if (S.files[S.cur]) M.edited(S); };
function step(S, [op, a, b]){
  const f = S.files[S.cur], groupsChanged = ()=> settingsDrawn(S), group = id => S.groups.find(g=> g.id === id);
  if (op === 'crop'){ if (f){ M.typeCrop(f, info(f), a.toLowerCase(), b); M.propagate(U, S, f); } }
  else if (op === 'aspect'){ if (f){ M.setAspect(f, info(f), a); M.propagate(U, S, f); } }
  else if (op === 'cropDef'){ if (f){ M.setCropDef(U, f, a); M.propagate(U, S, f); } }
  else if (op === 'link'){ if (S.files[a]) M.setLinked(U, S, S.files[a], b); }
  else if (op === 'linkAll'){ const fs = M.scopeFiles(S); if (f && fs.length) M.linkAll(U, S, f, fs); }
  else if (op === 'scope') M.setScope(S, a);
  else if (op === 'int'){ const E = M.edited(S); if (S.files.length && E) E[a] = b; }
  else if (op === 'adj'){ if (f) f.adj = { ...(f.adj || M.ADJ_DEF), [a]: b }; }
  else if (op === 'norm') M.edited(S).mode = a;
  else if (op === 'ref') M.edited(S).ref = a;
  else if (op === 'intDef'){ const E = M.edited(S); if (a) Object.assign(E, { ...M.INT_DEF, ref: E.ref }); E.def = a; }
  else if (op === 'adjDef'){ if (f){ if (a) f.adj = { ...M.ADJ_DEF }; f.adjDef = a; } }
  else if (op === 'move'){ if (M.moveImage(U, S, a, b)) groupsChanged(); }
  else if (op === 'regroup'){ M.regroup(U, S); groupsChanged(); }
  else if (op === 'rename'){ const g = group(a); if (g){ M.renameGroup(U, S, g, b); groupsChanged(); } }
  else if (op === 'mode'){ const g = group(a); if (g){ g.mode = b; groupsChanged(); } }
  else if (op === 'addGroup'){ M.addGroup(S); groupsChanged(); }
  else if (op === 'dropGroup'){ M.dropGroup(U, S, a); groupsChanged(); }
  else if (op === 'go'){ if (S.files.length) S.cur = (a + S.files.length) % S.files.length; }
  else if (op === 'include'){ PAGE.setIncluded(S.allFiles, a, b, []); filesChanged(S); }
  else if (op === 'label'){ if (S.allFiles[a]){ S.allFiles[a].label = b; settingsDrawn(S); } }
  else if (op === 'remove'){ const x = S.allFiles[a]; if (x){ PAGE.removeFileAt(S.allFiles, a, []); M.dropAlertsOf(S, x.raw.id); filesChanged(S); } }
  else if (op === 'dismiss'){ if (a === 'sem-dismiss-check') markSeen({ patch: ()=>{} }, H.fileNotes(HU, S.allFiles, info), 'check', { same: M.sameImage }); else M.setAlerts(S, { 'sem-dismiss-invalid': { bad: null }, 'sem-dismiss-upload': { dup: [] } }[a]); }
}
// What the tab shows and keeps of a state: the settings drawn last (renderIntensity edits).
function outputs(S){
  const o = { csv: M.csvOf(U, S), alerts: alertsOf(S) };
  o.info = S.files.map(f=>{ const r = info(f); return r ? H.infoHtml(HU, f, r, M.outOf(U, S, f)) : ''; });
  o.groups = S.files.length ? H.groupsHtml(HU, S) : null;
  o.luts = S.allFiles.map(f=>{
    if (!info(f)) return null;
    const nm = M.normOf(U, S, f);
    return [M.lutKey(S, f), nm.table ? sha(Buffer.from(nm.table.buffer)) : [nm.lo, nm.hi], sha(M.makeLut(U, S, f))];
  });
  o.figs = S.groups.map(g=> M.figureImages(U, S, g.id, ()=> null).map(m=> [m.id, m.label, m.group, m.w, m.h, m.pxNm, m.key]));
  if (S.files[S.cur]){ o.scopeOf = M.scopeOf(S); o.scope = H.scopeHtml(HU, S.groups.filter(g=> M.inGroup(U, S, g).length)); M.edited(S); o.ref = H.refHtml(HU, S.allFiles); }
  o.state = M.snapshotOf(S);
  o.shows = M.showsOf(S);
  return o;
}
export function runCase(c){
  const S = newS(), out = [];
  restore(S, c.state);
  out.push(outputs(S));
  for (const s of c.steps){ step(S, s); out.push(outputs(S)); }
  return canon(out);
}

test('the fixtures as v557\'s page analysed them, and 60 cases as v557\'s sem.js gave them (golden digests)', ()=>{
  const csv = pageCsv();
  const got = { page: csv.map(e=> [e.name, sha(e.text)]), cases: Array.from({ length: 60 }, (_, n)=> sha(runCase(caseOf(n)))) };
  assert.equal(csv[0].text.split('\n')[1], 'img1.tif;S1;5000.000000;25.000000;6.400000;15.0000;10.0000;SE;;;2024-01-01;10:00:00;256;256;10;0;0;256;256;6.400000;6.400000;33172.0;11340.4;0.000;all groups;percentile;;11822.0;54484.0;0.000;1.0000;1.0000;5.00 kx;common;0;0;256;256;25.000000;256;256');
  if (UPDATE){ fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + '\n'); return; }
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  assert.deepEqual(got.page, want.page, 'the CSV as v557\'s page wrote it');
  const off = got.cases.map((h, i)=> h === want.cases[i] ? null : i).filter(i=> i !== null);
  assert.deepEqual(off, [], 'cases whose digest differs');
  assert.equal(got.cases.length, want.cases.length);
});
