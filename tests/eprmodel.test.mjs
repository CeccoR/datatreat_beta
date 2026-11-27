/* EPR's calculations (epr-model.js) and its words and markup that need no page (epr-html.js),
   in Node: no browser (v563, out of v562's epr.js). A pair's .DSC read (its parameters, the
   field axis in G or mT rescaled to 9.5 GHz, none without MWFQ), its .DTA's values in every
   format (D F I S C, both byte orders, the real part of complex data, an unknown format and
   one too short refused), the spectrum with its baseline taken off, why a pair cannot be (no
   XPTS, one point, no axis); the list's rows (v581, as GC's: a drop's files paired by their
   names, a file named constructor, __proto__ or toString as any other, bug 23; a half alone
   waiting; a file dragged by its grip pairing, swapping, standing alone; each row's record,
   its label, colour and inclusion kept from the row its first file headed; what is said of a
   row not plotted, keyed by its issue); a spectrum's arrays fixed and shared by its bytes; a file and a card as a project holds them (points not numbers left
   out, the smoothing of before v510 in points, a project from before the cards), the state
   saved; the smoothing width typed and the points it spans; the smoothed columns and the
   stacking under each normalisation (flat spectra too), the plot's options and the CSV's
   columns; the markup. Then 40 cases (random pairs of every form, ones that cannot be read and
   lone halves among them, v581: rows of the list, not plotted; one to three cards, their
   normalisation and width, old states; six steps each: a normalisation picked, a width typed
   (a comma, refused, the same), a row left out and taken back) as v562's epr.js gave them,
   run from its source on a page of stubs: at each step the rows, the alerts' lines, each
   card's plot (its options,
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
import { autoPair, dropPart } from '../filelist-model.js';

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
  return new Uint8Array(buf);
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
  const at = new Uint8Array(48); at.set(dtaBytes(v), 8);
  assert.deepEqual(M.dtaValues({ XPTS: '5' }, at.subarray(8)), { s: v }, 'a view of its bytes, from where it starts');
  // the spectrum: the line through its ends taken off; with no MWFQ the field measured
  const buf = dtaBytes([1, 3, 2, 5, 3]), s = M.spectrumOf(p, buf);
  assert.deepEqual([s.a, s.rescaled, Object.keys(s)], [[0, 1.5, 0, 2.5, 0], true, ['b', 'a', 'rescaled']]);
  assert.equal(M.spectrumOf({ ...p, MWFQ: undefined }, buf).rescaled, false);
  assert.deepEqual(M.spectrumOf({ ...p, IRFMT: 'X' }, buf), { error: 'IRFMT X: a data format not read' });
  // the kinds, and how a drop's files pair by their names (filelist-model.js autoPair): the same stem, a .DTA first
  assert.deepEqual(['a.DTA', 'b.dsc', 'c.txt', 'noext', 'x.DTA.bak'].map(M.kindOf), ['dta', 'dsc', '', '', '']);
  const f = n => ({ name: n });
  const rows = autoPair([[f('w.DTA')]], [f('a.DSC'), f('a.dta'), f('b.DTA'), f('w.DSC'), f('b.dta')], M.sideOf);
  assert.deepEqual(rows.map(r=> r.map(x=> x.name)), [['w.DTA', 'w.DSC'], ['a.dta', 'a.DSC'], ['b.DTA'], ['b.dta']], 'a half waiting takes its partner; two of one kind each alone');
});

/* ---- The list's rows (v581, as GC's) ---- */
const pairBytes = (title, opts = {})=>{ const v = Array.from({ length: 16 }, (_, i)=> Math.sin(i/2)*100);
  return { dsc: enc(`XPTS ${opts.n || 16}\nXMIN 3300\nXWID 200\nMWFQ 9.5e9\nTITL '${title}'\n`), dta: dtaBytes(v) }; };
const file = (name, bytes)=> ({ name, bytes });
test('bug 23: files named constructor, __proto__ and toString pair and load as any other', ()=>{
  const c = pairBytes('C'), p = pairBytes('P'), t = pairBytes('T'), all = [];
  const got = [file('constructor.DTA', c.dta), file('__proto__.DSC', p.dsc), file('toString.DSC', t.dsc), file('constructor.DSC', c.dsc), file('__proto__.DTA', p.dta), file('toString.DTA', t.dta), file('valueOf.DTA', t.dta)];
  M.regroup(all, autoPair(all.map(M.rowFiles), got, M.sideOf), list => '#' + list.length);
  assert.deepEqual(all.map(r=> [r.name, r.label, r.color, r.rawFiles.map(x=> x.name), M.isSpectrum(r)]), [
    ['constructor', 'C', '#0', ['constructor.DTA', 'constructor.DSC'], true], ['__proto__', 'P', '#1', ['__proto__.DTA', '__proto__.DSC'], true],
    ['toString', 'T', '#2', ['toString.DTA', 'toString.DSC'], true], ['valueOf.DTA', 'valueOf', '#3', ['valueOf.DTA'], false]]);
  assert.equal(Object.getPrototypeOf(all[1]), Object.prototype, 'no prototype written');
  assert.deepEqual([({}).dta, ({}).dsc, ({}).constructor === Object], [undefined, undefined, true], 'no object\'s prototype written either');
  assert.deepEqual(M.rowNote(all[3]), { key: 'alone', line: 'valueOf.DTA: its .DSC is missing: not plotted until it is paired; drop it, or drag one onto it by its own grip.' });
});

test('the rows: a half waiting, paired by a file\'s grip whatever its name, swapped, standing alone; each row\'s record; what is said', ()=>{
  const a = pairBytes('Cu <2+>'), b = pairBytes('B'), bad = pairBytes('bad', { n: 99 }), all = [];
  const add = got => M.regroup(all, autoPair(all.map(M.rowFiles), got, M.sideOf), list => '#' + list.length);
  const names = ()=> all.map(r=> r.rawFiles.map(x=> x.name).join(' + '));
  add([file('a.DSC', a.dsc), file('lone.DTA', b.dta), file('x.dsc', b.dsc), file('a.DTA', a.dta)]);
  assert.deepEqual(names(), ['a.DTA + a.DSC', 'lone.DTA', 'x.dsc'], 'a pair .DTA first; each half a row of its own, waiting');
  assert.deepEqual(all.map(r=> [r.name, r.label, r.color, M.isSpectrum(r)]), [['a', 'Cu <2+>', '#0', true], ['lone.DTA', 'lone', '#1', false], ['x.dsc', 'B', '#2', false]], 'a half\'s label its .DSC\'s title, else its stem');
  assert.deepEqual(all.map(M.partsOf), [[{ name: 'a.DTA', warn: '' }, { name: 'a.DSC', warn: '' }], [{ name: 'lone.DTA', warn: 'its .DSC is missing: not plotted' }], [{ name: 'x.dsc', warn: 'its .DTA is missing: not plotted' }]]);
  assert.deepEqual(all.map(M.rowNote), [null, { key: 'alone', line: 'lone.DTA: its .DSC is missing: not plotted until it is paired; drop it, or drag one onto it by its own grip.' },
    { key: 'alone', line: 'x.dsc: its .DTA is missing: not plotted until it is paired; drop it, or drag one onto it by its own grip.' }]);
  // by its grip, the .DSC onto the .DTA alone, whatever their names: a spectrum, in the .DTA's row, its colour; named by its .DTA, labelled by its .DSC
  all[1].label = 'lone';   // (its label as it started)
  M.regroup(all, dropPart(all.map(M.rowFiles), { i: 2, p: 0 }, { i: 1, p: 0 }), list => '#n' + list.length);
  assert.deepEqual(names(), ['a.DTA + a.DSC', 'lone.DTA + x.dsc']);
  assert.deepEqual([all[1].name, all[1].label, all[1].color, M.isSpectrum(all[1]), M.rowNote(all[1])], ['lone', 'B', '#1', true, null]);
  const kept = all[0];
  // the .DTA dragged onto the other .DTA: swapped, a row of two .DTA files not plotted, said; its label renamed kept, its inclusion
  all[1].label = 'mine'; all[1].included = false; all[1].held = {};
  M.regroup(all, dropPart(all.map(M.rowFiles), { i: 1, p: 0 }, { i: 0, p: 0 }), list => '#n' + list.length);
  assert.deepEqual(names(), ['lone.DTA + a.DSC', 'a.DTA + x.dsc']);
  assert.deepEqual(all.map(r=> [r.name, r.label, r.color, r.included, M.isSpectrum(r)]), [['lone', 'mine', '#1', false, true], ['a', 'B', '#0', undefined, true]], 'each row from the one its first file headed');
  // off every file: each its own row, under its own; a .DTA onto a .DTA alone: paired, not plotted
  M.regroup(all, dropPart(all.map(M.rowFiles), { i: 1, p: 1 }, null), list => '#n' + list.length);
  M.regroup(all, dropPart(all.map(M.rowFiles), { i: 0, p: 1 }, null), list => '#n' + list.length);
  assert.deepEqual(names(), ['lone.DTA', 'a.DSC', 'a.DTA', 'x.dsc']);
  M.regroup(all, dropPart(all.map(M.rowFiles), { i: 2, p: 0 }, { i: 0, p: 0 }), list => '#m' + list.length);
  assert.deepEqual(names(), ['lone.DTA + a.DTA', 'a.DSC', 'x.dsc']);
  assert.deepEqual(M.rowNote(all[0]), { key: 'pair:a.DTA', line: 'lone.DTA + a.DTA: two .DTA files paired: not plotted; drag a file by its own grip to pair it.' });
  assert.deepEqual(M.partsOf(all[0]).map(x=> x.warn), ['two .DTA files paired: not plotted', 'two .DTA files paired: not plotted']);
  // a row of the same files is its record as it is; a pair that cannot be read waits, said with why
  const before = all.slice();
  M.regroup(all, all.map(M.rowFiles), ()=> '#z');
  assert.ok(all.every((r, i)=> r === before[i]), 'nothing new where nothing changed');
  add([file('bad.DTA', bad.dta), file('bad.DSC', bad.dsc)]);
  assert.deepEqual([all[3].name, M.isSpectrum(all[3]), M.rowNote(all[3])], ['bad', false, { key: 'pair:bad.DSC', line: 'bad.DTA + bad.DSC: its .DTA holds fewer than the 99 points its .DSC gives: not plotted.' }]);
  assert.equal(M.readRow([file('q.DTA', a.dta), file('q.DSC', null)]).why, 'its bytes are not stored in this browser any more');
  assert.equal(kept.name, 'a');
  // a project's: a row as it is held (its files in the list's order, its spectrum read again where it holds none), else left out
  const r1 = M.fileIn(U, { name: 'r', label: 'r', color: '#1', rawFiles: [file('r.DSC', a.dsc), file('r.DTA', a.dta)] });
  assert.deepEqual([r1.rawFiles.map(x=> x.name), M.isSpectrum(r1), r1.b.length], [['r.DTA', 'r.DSC'], true, 16]);
  const r2 = M.fileIn(U, { name: 'h.DSC', label: 'h', color: '#2', rawFiles: [file('h.DSC', a.dsc), 5], b: 'x', rescaled: 1 });
  assert.deepEqual([r2.name, 'b' in r2, 'rescaled' in r2, M.rowNote(r2).key], ['h.DSC', false, false, 'alone']);
  assert.deepEqual([M.fileIn(U, { name: 'n', rawFiles: [{ name: 'n.txt' }] }), M.fileIn(U, { name: 'n' })], [null, null]);
  assert.deepEqual(M.rowFiles({ name: 'old', b: [1, 2], a: [1, 2] }), [{ name: 'old' }], 'a spectrum with no files: a stand-in, its row one of the list');
  assert.equal(M.readNote({ rescaled: false, rawFiles: [file('m.DTA', null), file('m.DSC', null)], name: 'm' }), 'm.DSC: no microwave frequency (MWFQ): plotted on the field measured, not at 9.5 GHz; no g axis.');
});

/* v582: a label renamed kept a file, as GC keeps one (a pair's second its own record): a row's
   label is its first file's; a second file's renamed label is kept on its entry while it is
   paired, and given back when the pair is split (to v581 it was lost, the file's row labelled
   anew by its .DSC). */
test('a label renamed kept a file: the pair split gives each file back its own (v582)', ()=>{
  const a = pairBytes('A'), b = pairBytes('B'), all = [];
  const step = rows => M.regroup(all, rows, list => '#' + list.length);
  const names = ()=> all.map(r=> r.rawFiles.map(x=> x.name).join(' + ')), labels = ()=> all.map(r=> r.label);
  step(autoPair([], [file('lone.DTA', b.dta), file('x.DSC', b.dsc), file('a.DTA', a.dta), file('a.DSC', a.dsc)], M.sideOf));
  assert.deepEqual([names(), labels()], [['lone.DTA', 'x.DSC', 'a.DTA + a.DSC'], ['lone', 'B', 'A']]);
  // the half x.DSC renamed, then paired as the second of lone.DTA: the row's label its first file's
  all[1].label = 'mine';
  step(dropPart(all.map(M.rowFiles), { i: 1, p: 0 }, { i: 0, p: 0 }));
  assert.deepEqual([names(), labels(), all[0].rawFiles.map(x=> x.label)], [['lone.DTA + x.DSC', 'a.DTA + a.DSC'], ['B', 'A'], [undefined, 'mine']], 'kept on its entry');
  // swapped into the other pair: its label goes with it; the pair's label typed on its first file
  all[1].label = 'first';
  step(dropPart(all.map(M.rowFiles), { i: 0, p: 1 }, { i: 1, p: 1 }));
  assert.deepEqual([names(), labels(), all[1].rawFiles.map(x=> x.label)], [['lone.DTA + a.DSC', 'a.DTA + x.DSC'], ['A', 'first'], [undefined, 'mine']]);
  // split: each file its own label back, a file never renamed its own as it starts
  step(dropPart(all.map(M.rowFiles), { i: 1, p: 1 }, null));
  step(dropPart(all.map(M.rowFiles), { i: 0, p: 1 }, null));
  assert.deepEqual([names(), labels()], [['lone.DTA', 'a.DSC', 'a.DTA', 'x.DSC'], ['lone', 'A', 'first', 'mine']]);
  assert.ok(all.every(r=> r.rawFiles.every(x=> !('label' in x))), 'a row\'s first file\'s label the row\'s alone');
  // an entry's label that is no text (a project edited by hand): none of its own
  step([[file('a.DTA', a.dta), file('x.DSC', b.dsc)], [file('lone.DTA', b.dta), file('a.DSC', a.dsc)]]);
  assert.deepEqual([labels(), all[0].rawFiles[1].label], [['first', 'A'], 'mine']);
  all[0].rawFiles = [all[0].rawFiles[0], { ...all[0].rawFiles[1], label: 5 }];
  step(dropPart(all.map(M.rowFiles), { i: 0, p: 1 }, null));
  assert.deepEqual(labels(), ['first', 'B', 'A'], 'x.DSC labelled by its .DSC');
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
  // (v581: a lone half waits in the list, said to check, rowNote; a spectrum with no
  // microwave frequency, how it was read, named by its .DSC, else its name; v572: a file's)
  assert.deepEqual([{ name: 'a', rescaled: true }, { name: 'b', rescaled: false, rawFiles: [{ name: 'b.DTA' }, { name: 'b.DSC' }] }, { name: 'c', rescaled: false }].map(M.readNote),
    ['', 'b.DSC: no microwave frequency (MWFQ): plotted on the field measured, not at 9.5 GHz; no g axis.', 'c: no microwave frequency (MWFQ): plotted on the field measured, not at 9.5 GHz; no g axis.']);
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
// The case's files dropped (each pair's .DSC and .DTA, a lone .DSC after them), paired and made
// rows as a drop does (v581: a pair that cannot be read and a half alone rows not plotted, each
// its colour after those before; to v580 refused), what is said of them, then the state put
// back as a restore does.
export function loadCase(c){
  const all = [], got = [...c.pairs.flatMap(q=> [{ name: q.stem + '.DSC', bytes: enc(q.dsc) }, { name: q.stem + '.DTA', bytes: q.dta }]), ...c.lone.map(n=> ({ name: n, bytes: enc(`TITL '${n}'\n`) }))];
  M.regroup(all, autoPair([], got, M.sideOf), PAGE.nextColor);
  const S = { all, alerts: all.map(M.rowNote).filter(Boolean).map(n=> [n.key, PAGE.esc(n.line)]) };
  restoreCase(S, { files: all.map(f=> ({ ...f })), ...c.state });
  return S;
}
// (the spectra included, which the cards draw: modkit's files, epr.js sample)
const filesOf = S => S.all.filter(f=> f.included !== false && M.isSpectrum(f));
function restoreCase(S, s){
  S.all = s.files.map(f=>{ const g = { ...f, name: f.name, label: f.label, color: f.color }; delete g.included; delete g.held; return M.fileIn(U, g); }).filter(Boolean);
  S.recs = M.cardsIn(U, s).map(src=> recIn(src, c=> M.readCard(U, filesOf(S), c), M.KINDS, Object.keys(M.KINDS)));
  settleNames(S.recs, Object.keys(M.KINDS), ()=> 'Spectra');
}
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
