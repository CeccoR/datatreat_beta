/* EPR's calculations (epr-model.js) and its words and markup that need no page (epr-html.js),
   in Node: no browser (v563, out of v562's epr.js). A pair's .DSC read (its parameters, the
   field axis in G or mT rescaled to 9.5 GHz, none without MWFQ), its .DTA's values in every
   format (D F I S C, both byte orders, the real part of complex data, an unknown format and
   one too short refused), the spectrum with its baseline taken off, why a pair cannot be (no
   XPTS, one point, no axis); a drop's files grouped by stem; a spectrum's arrays fixed and
   shared by its bytes; a file and a card as a project holds them (points not numbers left
   out, the smoothing of before v510 in points, a project from before the cards), the state
   saved; the smoothing width typed and the points it spans; the smoothed columns and the
   stacking under each normalisation (flat spectra too), the plot's options and the CSV's
   columns; the markup. Then 40 cases (random pairs of every form, refused ones and lone
   halves among them; one to three cards, their normalisation and width, old states; six
   steps each: a normalisation picked, a width typed (a comma, refused, the same), a file
   left out and taken back) as v562's epr.js gave them, run from its source on a page of
   stubs: at each step the files read, the alerts' lines, each card's plot (its options,
   range and lines), its points, the CSVs and the state; SHA-256 digests in
   tests/golden/eprmodel.json (npm run test:update writes them anew after a change meant to
   alter them). utils.js's and modkit.js's helpers, which need a page to load, are taken from
   their source as they stand there. Under a second. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as M from '../epr-model.js';
import * as H from '../epr-html.js';
import { boxSmooth, widthText } from '../smooth.js';
import { settleNames, saved, recIn } from '../cards-model.js';

const UPDATE = !!process.env.UPDATE_GOLDEN || process.env.npm_lifecycle_event === 'test:update';
const GOLDEN = new URL('./golden/eprmodel.json', import.meta.url);
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
const UN = ['COLORS', 'colorOf', 'nextColor', 'esc', 'fmtNum', 'fmtData', 'csvField', 'csvJoin', 'csvLine', 'maxArr', 'minArr', 'NORM_OPTIONS', 'normOf'];
const MK = ['isObj', 'isArr', 'num', 'numStr', 'ownKey', 'cardList', 'finitePairs', 'wideCsv'];
export const PAGE = new Function('settings', [...UN.map(n=> decl('utils.js', n)), ...MK.map(n=> decl('modkit.js', n)),
  decl('modcharts.js', 'PLOT_DL_ICON'), decl('modcharts.js', 'plotWrap'), decl('cards.js', 'cardInfo'), decl('cards.js', 'fileSafe')].join('\n')
  + `\nreturn { ${[...UN, ...MK].join(', ')}, plotWrap, cardInfo, fileSafe };`)({ decimal: '.', field: ';' });
export const U = { num: PAGE.num, numStr: PAGE.numStr, normOf: PAGE.normOf, finitePairs: PAGE.finitePairs, cardList: PAGE.cardList, maxArr: PAGE.maxArr, minArr: PAGE.minArr, fmtNum: PAGE.fmtNum, fmtData: PAGE.fmtData };
export const HU = { plotWrap: PAGE.plotWrap, NORM_OPTIONS: PAGE.NORM_OPTIONS };
// Arrays of numbers by digest (each number as it reads, -0 too); a value with them in canon.
export const dg = a => a == null ? String(a) : sha(Array.from(a, v=> Object.is(v, -0) ? '-0' : String(v)).join(',')).slice(0, 16);
export const canon = v => JSON.stringify(v, function(k, x){ const o = this[k];
  if (o instanceof Uint8Array){ let h = 0; for (const b of o) h = (Math.imul(h, 31) + b) >>> 0; return 'U8:' + o.length + ':' + h; }
  if (typeof o === 'number') return Object.is(o, -0) ? '#-0' : '#' + o;
  if (typeof o === 'function') return 'fn';
  return x; });
const near = (a, b, tol = 1e-12)=> assert.ok(Math.abs(a - b) <= tol*Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);

/* ---- A pair's bytes (made up) ---- */
export const enc = s => new TextEncoder().encode(s);
// .DSC lines, and the .DTA's values v[i] written as `fmt` (complex: an imaginary part after each).
export function dtaBytes(v, { fmt = 'D', lit = false, cplx = false } = {}){
  const size = { D: 8, F: 4, I: 4, S: 2, C: 1 }[fmt] || 8, st = cplx ? 2 : 1, buf = new ArrayBuffer(v.length*size*st), dv = new DataView(buf);
  v.forEach((x, i)=>{ const o = i*size*st;
    if (fmt === 'D') dv.setFloat64(o, x, lit); else if (fmt === 'F') dv.setFloat32(o, x, lit); else if (fmt === 'I') dv.setInt32(o, x, lit); else if (fmt === 'S') dv.setInt16(o, x, lit); else dv.setInt8(o, x);
    if (cplx && fmt === 'D') dv.setFloat64(o + size, 99, lit); });
  return buf;
}

test('a pair read: the .DSC, the field axis, the .DTA in every format, the baseline, why not', ()=>{
  const p = M.parseDsc("#DESC 1.2\r\nXPTS 5\nXMIN 3300.0\nXWID 200.0\nXUNI 'G'\nMWFQ 9.5e9\nTITL 'sample <1>'\nIRFMT D\n  indented 3\n");
  assert.deepEqual(p, { XPTS: '5', XMIN: '3300.0', XWID: '200.0', XUNI: "'G'", MWFQ: '9.5e9', TITL: "'sample <1>'", IRFMT: 'D' });
  assert.equal(M.dscWord("'mT'"), 'mT'); assert.equal(M.dscWord(undefined), '');
  // the axis: G, rescaled from 9.5 GHz by 9.5e8/MWFQ (in mT: G/10); mT ×10 to G; no MWFQ: as measured, G/10
  assert.deepEqual(M.buildBAxis(p), [330, 335, 340, 345, 350]);
  assert.deepEqual(M.buildBAxis({ ...p, MWFQ: '9.0e9' }).map(v=> +v.toFixed(9)), [3300, 3350, 3400, 3450, 3500].map(v=> +(v*9.5e8/9e9).toFixed(9)));
  assert.deepEqual(M.buildBAxis({ XPTS: '3', XMIN: '330', XWID: '20', XUNI: "'mT'" }), [330, 340, 350]);
  near(M.G_AT_95/339.4, 2.0000, 1e-3);
  assert.equal(M.dscError({}), 'its .DSC gives no XPTS, the number of points');
  assert.equal(M.dscError({ XPTS: "'1'" }), 'XPTS 1: a spectrum needs two points at least');
  assert.equal(M.dscError({ XPTS: 'x' }), 'XPTS x: a spectrum needs two points at least');
  assert.equal(M.dscError({ XPTS: '4', XMIN: '1' }), 'its .DSC gives no field axis (XMIN and XWID)');
  assert.equal(M.dscError({ XPTS: '4', XMIN: '1', XWID: '2' }), null);
  // each format, both orders, complex: the real parts
  const v = [3, -1, 4, 1, -5];
  for (const fmt of ['D', 'F', 'I', 'S', 'C']) for (const lit of [false, true]){
    const q = { XPTS: '5', IRFMT: fmt === 'D' && lit ? "'D,D'" : fmt, BSEQ: lit ? 'LIT' : 'BIG' };
    assert.deepEqual(M.dtaValues(q, dtaBytes(v, { fmt, lit })), { s: v }, fmt + lit);
  }
  assert.deepEqual(M.dtaValues({ XPTS: '5', IKKF: 'CPLX' }, dtaBytes(v, { cplx: true })), { s: v });
  assert.deepEqual(M.dtaValues({ XPTS: '5', IRFMT: 'Q' }, dtaBytes(v)), { error: 'IRFMT Q: a data format not read' });
  assert.deepEqual(M.dtaValues({ XPTS: '6' }, dtaBytes(v)), { error: 'its .DTA holds fewer than the 6 points its .DSC gives' });
  // the spectrum: the line through its ends taken off, named by its title, its bytes kept
  const dsc = { name: 'a.DSC', bytes: enc('x') }, buf = dtaBytes([1, 3, 2, 5, 3]);
  const s = M.spectrumOf('a', p, dsc, buf, 'a.DTA');
  assert.deepEqual(s.a, [0, 1.5, 0, 2.5, 0]);
  assert.equal(s.label, 'sample <1>'); assert.equal(s.rescaled, true); assert.deepEqual(s.rawFiles[0], dsc); assert.equal(s.rawFiles[1].name, 'a.DTA'); assert.equal(s.rawFiles[1].bytes.length, 40);
  const s2 = M.spectrumOf('b', { ...p, MWFQ: undefined, TITL: undefined }, dsc, buf, 'b.DTA');
  assert.equal(s2.label, 'b'); assert.equal(s2.rescaled, false);
  assert.deepEqual(Object.keys(s), ['name', 'label', 'b', 'a', 'rescaled', 'rawFiles']);
  assert.deepEqual(M.spectrumOf('c', { ...p, IRFMT: 'X' }, dsc, buf, 'c.DTA'), { error: 'IRFMT X: a data format not read' });
  // a drop's files by stem: other extensions refused, stems loaded said, a lone half alone
  const f = n => ({ name: n });
  const g = M.groupsOf([f('a.DSC'), f('a.dta'), f('b.DTA'), f('x.txt'), f('c.dsc'), f('c.DTA'), f('noext'), f('c.txt')], new Set(['c']));
  assert.deepEqual(Object.keys(g.groups), ['a', 'b']); assert.equal(g.groups.a.dsc.name, 'a.DSC'); assert.equal(g.groups.b.dsc, null);
  assert.deepEqual(g.invalid, ['x.txt', 'noext', 'c.txt']); assert.deepEqual(g.already, ['c.dsc', 'c.DTA']);
});

test('a spectrum kept by its bytes; a file and a card as a project holds them; the state', ()=>{
  const bytes = new Uint8Array([1, 2, 3]), rawFiles = [{ name: 'a.DSC', bytes: new Uint8Array(1) }, { name: 'a.DTA', bytes }];
  const a = M.keepSpectrum({ b: [1, 2, 3], a: [4, 5, 6], rawFiles }), b = M.keepSpectrum({ b: [1, 2, 3], a: [4, 5, 6], rawFiles });
  assert.equal(a.b, b.b); assert.equal(a.a, b.a);
  const c = M.keepSpectrum({ b: [1, 2, 3], a: [4, 5, 7], rawFiles });
  assert.notEqual(c.a, a.a);
  assert.equal(M.dtaOf({ rawFiles: [null, { name: 'x.dta', bytes: [1] }] }), null);
  // a file: its points with both values, two at least; rescaled unless it says not
  const f = M.fileIn(U, { name: 'f', b: [1, NaN, 3, 4], a: [1, 2, 3, 4], rescaled: false });
  assert.deepEqual([f.b, f.a, f.rescaled], [[1, 3, 4], [1, 3, 4], false]);
  assert.equal(M.fileIn(U, { b: [1, NaN], a: [1, 2] }), null);
  assert.equal(M.fileIn(U, { b: 'x', a: [1] }), null);
  assert.equal(M.fileIn(U, { b: [1, 2], a: [1, 2] }).rescaled, true);
  // the cards: of the kinds there are; a project from before them one card of its settings
  assert.deepEqual(M.cardsIn(U, { norm: 'local', smooth: '5' }), [{ id: 1, type: 'spectra', norm: 'local', smooth: '5' }]);
  assert.deepEqual(M.cardsIn(U, { cards: [null, { type: 'pie' }, { id: 'x', type: 'spectra' }, { id: 2 }] }), [{ type: 'spectra' }, { id: 2 }]);
  // a card's settings: the width from 0; the points of before v510 as N median steps (1: none)
  const files = [{ b: [0, 0.1, 0.2] }, { b: [0, 0.2, 0.4] }, { b: [0, 0.3, 0.6] }];
  assert.deepEqual(M.readCard(U, files, { norm: 'local', smoothW: 0.5 }), { norm: 'local', smoothW: 0.5 });
  assert.deepEqual(M.readCard(U, files, { norm: 'x', smoothW: -1 }), { norm: 'global', smoothW: 0.2 });
  near(M.readCard(U, files, { smooth: '5' }).smoothW, 1);
  assert.equal(M.readCard(U, files, { smooth: 1 }).smoothW, 0);
  assert.equal(M.readCard(U, [], { smooth: 4 }).smoothW, 0.2);
  assert.equal(M.readCard(U, files, { smooth: 'q' }).smoothW, 0.2);
  assert.deepEqual(M.stateOf([{ id: 1, type: 'spectra', base: '', nameAuto: true, collapsed: false, norm: 'none', smoothW: 0, x: 1 }], saved),
    { cards: [{ id: 1, type: 'spectra', base: '', nameAuto: true, collapsed: false, norm: 'none', smoothW: 0 }] });
});

test('the smoothing width typed, and the points it spans', ()=>{
  assert.equal(M.widthIn('0,5'), 0.5); assert.equal(M.widthIn('-2'), 0); assert.equal(M.widthIn('x'), 0);
  assert.equal(M.widthOf('0.3333', '0.3333', 1/3), 1/3);
  assert.equal(M.widthOf(' 0,25 ', '0.3333', 1/3), 0.25);
  assert.ok(Number.isNaN(M.widthOf('', 'x', 1)));
  const f1 = { label: 'A', b: [0, 0.25, 0.5, 0.75] }, f2 = { label: 'B <b>', b: [0, 0.5, 1] };
  assert.deepEqual(M.ptsOf([f1], 1), { t: '≈ 4 pts', tip: 'A: 4 steps of 0.25 mT' });
  assert.deepEqual(M.ptsOf([f1, f2], 1), { t: '≈ 2–4 pts', tip: 'A: 4 steps of 0.25 mT\nB <b>: 2 steps of 0.5 mT' });
  assert.deepEqual(M.ptsOf([f1, f2], 0.125), { t: '≈ 0.25–0.5 pts', tip: 'A: 0.5 steps of 0.25 mT\nB <b>: 0.25 steps of 0.5 mT' });
  assert.equal(M.ptsOf([f1, { label: 'C', b: [0, 0.2501, 0.5002] }], 1).t, '≈ 4 pts');
  assert.deepEqual(M.ptsOf([f1], 0), { t: 'off', tip: 'No smoothing' });
  assert.deepEqual(M.ptsOf([f1], NaN), { t: '', tip: '' });
  assert.deepEqual(M.ptsOf([], 1), { t: '', tip: '' });
});

test('what a card draws: the smoothed columns, the stacking, the plot, the CSV', ()=>{
  const sms = [[1, 3, 2], [0, 10, 5]];
  assert.equal(M.smoothedOut(U, sms, 'none'), sms);
  assert.deepEqual(M.smoothedOut(U, sms, 'local'), [[0, 1, 0.5], [0, 1, 0.5]]);
  assert.deepEqual(M.smoothedOut(U, sms, 'global'), [[0, 0.2, 0.1], [0, 1, 0.5]]);
  // global: down to 0, divided by the largest; each in its slot, centred
  const g = M.stackOf(U, sms, 'global');
  assert.deepEqual([g.lo, g.hi], [0, 2.2]);
  near(g.Y[0][1], 0.2 + 1.1 + 0.55 - 0.1); near(g.Y[1][0], 0 + 0 + 0.55 - 0.5);
  const l = M.stackOf(U, sms, 'local');
  [[1.15, 2.15, 1.65], [0.05, 1.05, 0.55]].forEach((y, k)=> y.forEach((v, i)=> near(l.Y[k][i], v)));
  const n = M.stackOf(U, sms, 'none');
  assert.deepEqual([n.lo, n.hi], [0, 22]); assert.deepEqual(n.Y[1], [0.5, 10.5, 5.5]);
  // flat spectra: drawn as lines in their slots
  const fl = M.stackOf(U, [[2, 2], [2, 2]], 'global');
  [[1.65, 1.65], [0.55, 0.55]].forEach((y, k)=> y.forEach((v, i)=> near(fl.Y[k][i], v)));
  const o = M.plotOpts(true);
  assert.equal(o.xlabel, 'Magnetic Field at 9.5 GHz (mT)'); near(o.topAxis.of(M.G_AT_95/2), 2); assert.equal(o.topAxis.fmt(2.00231), '2.0023'); assert.deepEqual(o.margin, { l: 55, r: 20, t: 48, b: 40 });
  assert.deepEqual(M.plotOpts(false), { xlabel: 'Magnetic Field (mT)', ylabel: 'Intensity (a. u.)', noYTickLabels: true });
  const files = [{ label: 'S1', b: [330.123456789, 331], a: [1e-7, 2], rescaled: true }, { label: 'S2', b: [1, 2], a: [3, 4], rescaled: false }];
  const cols = M.csvCols(U, files, [[0.1234567, 0], [1, 1e-9]], { norm: 'none', smoothW: 0.25 });
  assert.deepEqual(cols.map(c=> c.h), ['Bfield_mT_at_9.5GHz_S1', 'Raw_S1', 'Smoothed_S1 (w=0.25 mT)', 'Bfield_mT_S2', 'Raw_S2', 'Smoothed_S2 (w=0.25 mT)']);
  assert.deepEqual([cols[0].v[0], cols[1].v[0], cols[2].v[0], cols[5].v[1]], ['330.123457', '1e-7', '0.123457', '1e-9']);
  assert.equal(M.csvCols(U, files, [[0.1234567, 0], [1, 1e-9]], { norm: 'local', smoothW: 0 })[5].v[1], '0.000000');
});

test('the markup: a card\'s body and instructions; how the files were read (v567)', ()=>{
  const b = H.cardBody({ id: 7 }, HU);
  for (const id of ['epr7Svg', 'epr7Legend', 'epr7Norm', 'epr7Smooth', 'epr7SmoothPts']) assert.ok(b.includes(`id="${id}"`), id);
  assert.ok(b.includes('value="0.2"') && b.includes(PAGE.NORM_OPTIONS));
  assert.equal(H.P({ id: 3 }), 'epr3');
  assert.ok(H.eprInfo('TAIL').endsWith(' TAIL') && H.eprInfo('').includes('<b>g = hν / (μ<sub>B</sub>·B)</b>'));
  // (v567: a lone half is said among the files not loaded, epr.js onDrop; a spectrum with no
  // microwave frequency, how it was read, named by its .DSC, else its stem)
  assert.deepEqual(M.readNotes([{ name: 'a', rescaled: true }, { name: 'b', rescaled: false, rawFiles: [{ name: 'b.DSC' }, { name: 'b.DTA' }] }, { name: 'c', rescaled: false }]),
    ['b.DSC: no microwave frequency (MWFQ): plotted on the field measured, not at 9.5 GHz; no g axis.', 'c: no microwave frequency (MWFQ): plotted on the field measured, not at 9.5 GHz; no g axis.']);
  assert.deepEqual([M.extOf('x.dta'), M.extOf('y.DSC')], ['.DTA', '.DSC']);
});

/* ---- 40 cases: random pairs, cards and steps, as v562's epr.js did them ---- */
export function rnd(seed){ let s = seed >>> 0 || 1; return ()=>{ s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
// A pair of the case's (its .DSC text, its .DTA's bytes), of every form.
function pairOf(r, stem){
  const pick = a => a[Math.floor(r()*a.length)], chance = p => r() < p;
  const n = pick([48, 120, 33, 1, null, 48]), fmt = pick(['D', 'D', 'F', 'I', 'S', 'C', 'Q']), lit = chance(0.4), cplx = chance(0.2), mwfq = pick([9.43e9, 9.81e9, null]), unit = pick(["'G'", "'mT'"]);
  const lines = [n == null ? null : `XPTS ${n}`, chance(0.95) ? `XMIN ${unit === "'G'" ? 3300 : 330}` : null, `XWID ${unit === "'G'" ? pick([200, 150]) : 20}`, mwfq ? `MWFQ ${mwfq}` : null,
    `XUNI ${unit}`, `BSEQ ${lit ? 'LIT' : 'BIG'}`, `IRFMT ${fmt}`, cplx ? 'IKKF CPLX' : null, chance(0.6) ? `TITL '${pick(['Cu <2+>', 'x & y', 'S'])}'` : null].filter(Boolean);
  const np = n || 8, c = r()*np, w = 2 + r()*np/6, amp = pick([1000, 3, 0]), off = r()*5;
  const v = Array.from({ length: np - (chance(0.08) ? 1 : 0) }, (_, i)=>{ const x = off + amp*(-(i - c)/w)*Math.exp(-(((i - c)/w)**2)); return fmt === 'D' || fmt === 'F' || fmt === 'Q' ? x : Math.round(x) % 100; });
  return { stem, dsc: lines.join('\n') + '\n', dta: new Uint8Array(dtaBytes(v, { fmt: fmt === 'Q' ? 'D' : fmt, lit, cplx })) };
}
export function caseOf(seed){
  const r = rnd(seed*7919 + 17), pick = a => a[Math.floor(r()*a.length)], chance = p => r() < p;
  const pairs = Array.from({ length: 1 + Math.floor(r()*4) }, (_, i)=> pairOf(r, `p${i + 1}`));
  const lone = chance(0.3) ? [`l${seed}.DSC`] : [];
  const kind = r(), nc = 1 + Math.floor(r()*3);
  const state = kind < 0.2 ? { norm: pick(['local', 'none', 'weird']), smooth: pick(['5', 1, 3, 'x']) }
    : { cards: Array.from({ length: nc }, (_, i)=> ({ id: i + 1, type: 'spectra', base: chance(0.2) ? 'Mine <b>' : '', nameAuto: true, collapsed: false, norm: pick(['global', 'local', 'none']),
      ...(chance(0.3) ? { smooth: pick([4, '9', 1]) } : { smoothW: pick([0, 0.2, 0.5, 1.5, -1]) }) })) };
  const steps = Array.from({ length: 6 }, ()=>{
    const k = pick(['norm', 'smooth', 'smooth', 'include']), ci = Math.floor(r()*3);
    if (k === 'norm') return [k, ci, pick(['global', 'local', 'none'])];
    if (k === 'smooth') return [k, ci, pick(['0,3', '0', 'abc', '', '1e-1', '0.2', '-1', '2'])];
    return [k, Math.floor(r()*4), chance(0.5)];
  });
  return { pairs, lone, state, steps };
}

/* ---- epr.js's wiring, in short ---- */
// The case's pairs read as a drop does (each its colour by the files loaded before), the
// alerts' lines (refused, lone), then the state put back as a restore does.
export function loadCase(c){
  const files = [], invalid = [];
  for (const q of c.pairs){
    const p = M.parseDsc(new TextDecoder().decode(enc(q.dsc))), bad = M.dscError(p);
    const res = bad ? { error: bad } : M.spectrumOf(q.stem, p, { name: q.stem + '.DSC', bytes: enc(q.dsc) }, q.dta.buffer.slice(0), q.stem + '.DTA');
    if (res.error){ invalid.push(`${q.stem} (${res.error})`); continue; }
    res.color = PAGE.nextColor(files); files.push(M.keepSpectrum(res));
  }
  const S = { all: files, alerts: [invalid.map(PAGE.esc), c.lone.map(PAGE.esc)] };
  restoreCase(S, { files: files.map(f=> ({ ...f })), ...c.state });
  return S;
}
function restoreCase(S, s){
  S.all = s.files.map(f=>{ const g = { ...f, name: f.name, label: f.label, color: f.color }; delete g.included; delete g.held; return M.fileIn(U, g); }).filter(Boolean);
  S.recs = M.cardsIn(U, s).map(src=> recIn(src, c=> M.readCard(U, S.all.filter(f=> f.included !== false), c), M.KINDS, Object.keys(M.KINDS)));
  settleNames(S.recs, Object.keys(M.KINDS), ()=> 'Spectra');
}
const filesOf = S => S.all.filter(f=> f.included !== false);
export function stepCase(S, [k, a, b]){
  const rec = S.recs[a];
  if (k === 'norm'){ if (rec) rec.norm = PAGE.normOf(b); }
  else if (k === 'smooth'){ if (!rec) return; const raw = String(b).trim().replace(',', '.'), v = parseFloat(raw);
    if (raw === '' || !isFinite(v) || v < 0) return;
    if (String(v) !== widthText(rec.smoothW)) rec.smoothW = M.widthIn(String(v)); }
  else if (k === 'include'){ const f = S.all[a]; if (f){ if (b) delete f.included; else f.included = false; } }
}
// What the page shows: each card's plot (options, range, lines), its points, the CSVs, the state.
export function outOf(S){
  const files = filesOf(S), o = { files: S.all.map(f=> [f.name, f.label, f.color, f.rescaled, dg(f.b), dg(f.a), f.included === false]), alerts: S.alerts };
  o.cards = S.recs.map(a=>{
    const w = a.smoothW, r = { pts: M.ptsOf(files, w) };
    if (!files.length) return r;
    const Y = files.map(f=> boxSmooth(f.b, f.a, w)), st = M.stackOf(U, Y, a.norm), allB = files.flatMap(f=> f.b);
    const out = M.smoothedOut(U, files.map(f=> boxSmooth(f.b, f.a, w)), a.norm), opts = M.plotOpts(files.every(f=> f.rescaled !== false));
    r.plot = [opts.xlabel, !!opts.topAxis, [PAGE.minArr(allB), PAGE.maxArr(allB), st.lo, st.hi], st.Y.map((y, k)=> [dg(files[k].b), dg(y), files[k].color, dg(out[k]), files[k].label, files[k].name])];
    return r;
  });
  o.csv = files.length ? S.recs.map(a=> [`${PAGE.fileSafe(a.name)} - epr_spectra.csv`, PAGE.wideCsv(M.csvCols(U, files, M.smoothedOut(U, files.map(f=> boxSmooth(f.b, f.a, a.smoothW)), a.norm), a))]) : [];
  o.state = sha(canon(M.stateOf(S.recs, saved)));
  return o;
}
export function runCase(c){
  const S = loadCase(c), out = [outOf(S)];
  for (const st of c.steps){ stepCase(S, st); out.push(outOf(S)); }
  return canon(out);
}
export const CASES = 40;

test('40 cases as v562\'s epr.js gave them (golden digests)', ()=>{
  const got = { cases: Array.from({ length: CASES }, (_, i)=> sha(runCase(caseOf(i + 1)))) };
  if (UPDATE){ fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + '\n'); return; }
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const off = got.cases.map((h, i)=> h === want.cases[i] ? null : i).filter(i=> i !== null);
  assert.deepEqual(off, [], 'cases whose digest differs');
  assert.equal(got.cases.length, want.cases.length);
});
