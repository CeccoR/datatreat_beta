/* Iodometry's calculations (iodo-model.js) and its words and markup that need no page
   (iodo-html.js), in Node: no browser (v563, out of v562's iodo.js). A kinetics file read: the
   separator with the most numbers, the traces' names over their pairs (or the line over the
   data), the columns' units (s, min, ms), decimal commas, traces of different lengths, points
   out of order, a pair of fewer than three points, the details under each name (said twice,
   <Current Wavelength> alone), a file of no columns or no pair; a file kept by its bytes; the
   injection suggested (the prominence, the highest, the first of equals, none), every trace's
   again; the point nearest in time; the alignment and the reading (interpolated, past the
   end, at the injection); the calibration (read back from anything, its line typed or fitted,
   a slope of 0, one concentration, the window's draft, its words, what Apply takes); a trace
   and the state as a project holds them, what it shows; a trace's results and read-outs;
   the plots' ranges, the readings' layout, the CSVs; the markup escaped. Then 40 cases
   (random kinetics files, states, eight steps each: the reading time and the minimum
   prominence typed, Suggest, an injection set, a trace shown, the calibration's window
   applied or not, a trace left out and taken back) as v562's iodo.js gave them, run from its
   source on a page of stubs: at each step the traces, the Analysis card's read-outs and its
   plot, the aligned traces' and the readings' plots, the CSVs, the state and what it shows;
   SHA-256 digests in tests/golden/iodomodel.json (npm run test:update writes them anew after
   a change meant to alter them). utils.js's and modkit.js's helpers, which need a page to
   load, are taken from their source as they stand there. Under a second. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as M from '../iodo-model.js';
import * as H from '../iodo-html.js';

const UPDATE = !!process.env.UPDATE_GOLDEN || process.env.npm_lifecycle_event === 'test:update';
const GOLDEN = new URL('./golden/iodomodel.json', import.meta.url);
const sha = s => createHash('sha256').update(s).digest('hex');

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
const UN = ['COLORS', 'colorOf', 'nextColor', 'esc', 'X_SVG', 'csvNum', 'csvField', 'csvJoin', 'csvLine', 'fitLinear', 'BAR_NAME_MAX', 'TILT_MIN', 'cutToWidth', 'tiltFits', 'tiltFor', 'barNames'];
const MK = ['isObj', 'num', 'wideCsv'];
export const PAGE = new Function('settings', [...UN.map(n=> decl('utils.js', n)), ...MK.map(n=> decl('modkit.js', n))].join('\n')
  + `\nreturn { ${[...UN, ...MK].filter(n=> n !== 'TILT_MIN').join(', ')} };`)({ decimal: '.', field: ';' });
// (utils.js keeper's part here: what is kept by the trace's absorbances under its key)
const kept = new WeakMap(), made = { n: 0 };
const alignKept = (data, key, make)=>{ let m = kept.get(data); if (!m) kept.set(data, m = new Map()); if (!m.has(key)){ made.n++; m.set(key, make()); } return m.get(key); };
const ids = new WeakMap(); let nid = 0;
const objId = o => o == null || typeof o !== 'object' ? String(o) : ids.get(o) || (ids.set(o, ++nid), nid);
export const U = { alignKept, objId, exactKey: v => JSON.stringify(v), fitLinear: PAGE.fitLinear, csvNum: PAGE.csvNum, csvLine: PAGE.csvLine, wideCsv: PAGE.wideCsv, barNames: PAGE.barNames, num: PAGE.num, isObj: PAGE.isObj };
export const HU = { esc: PAGE.esc, X_SVG: PAGE.X_SVG };
export const MCTX = { font: '', measureText: t => ({ width: String(t).length*6 + (/[iIl1]/.test(t) ? 0.5 : 0) }) };
export const dg = a => a == null ? String(a) : sha(Array.from(a, v=> Object.is(v, -0) ? '-0' : String(v)).join(',')).slice(0, 16);
export const canon = v => JSON.stringify(v, function(k, x){ const o = this[k];
  if (o instanceof Uint8Array){ let h = 0; for (const b of o) h = (Math.imul(h, 31) + b) >>> 0; return 'U8:' + o.length + ':' + h; }
  if (typeof o === 'number') return Object.is(o, -0) ? '#-0' : '#' + o;
  if (typeof o === 'function') return 'fn';
  return x; });
const near = (a, b, tol = 1e-12)=> assert.ok(Math.abs(a - b) <= tol*Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
export const enc = s => new TextEncoder().encode(s);

const CARY = ['blank1,,Sample <2>,,', 'Time (sec),Abs,Time (sec),Abs,', '0,0.1,0,0.2,', '1,0.12,1,0.25,', '2,0.3,2,0.22,', '3,0.15,,,', '', 'blank1,', 'blank1',
  'Collection Time: 7/23/2025 1:15:02 PM', 'Wavelength (nm)  350.0', '<Current Wavelength> , 351.0', 'Sample <2>', '<Current Wavelength> , 352,5', ''].join('\r\n');

test('a kinetics file read: columns, names, units, details; kept by its bytes', ()=>{
  const k = M.readKinetics(CARY);
  assert.equal(k.n, 2);
  assert.deepEqual(k.traces.map(t=> [t.name, [...t.t], [...t.A], t.wl, t.collected]), [
    ['blank1', [0, 1, 2, 3], [0.1, 0.12, 0.3, 0.15], 350, '7/23/2025 1:15:02 PM'], ['Sample <2>', [0, 1, 2], [0.2, 0.25, 0.22], 352.5, '']]);
  assert.ok(Object.isFrozen(k.traces[0].t) || Array.isArray(k.traces[0].t));
  assert.ok(!('met' in k.traces[0]));
  // ';' with decimal commas, minutes; points out of order sorted; a pair of two points not read
  const t2 = M.readKinetics('a;;b;;\nTime (min);Abs;Time (ms);Abs;\n0;0,1;5;1\n0,5;0,2;3;2\n0,25;0,3;;\n');
  assert.deepEqual([[...t2.traces[0].t], [...t2.traces[0].A], t2.traces[1]], [[0, 15, 30], [0.1, 0.3, 0.2], null]);
  // no columns' line: the line over the data names the traces; tab
  const t3 = M.readKinetics('one\ttwo\n1\t2\t3\t4\n2\t3\t4\t5\n3\t4\t5\t6\n');
  assert.deepEqual(t3.traces.map(t=> t.name), ['one', '']);
  assert.deepEqual(M.headsOf([['Time (s)', 'Abs'], ['1', '2']], 1), { cols: ['Time (s)', 'Abs'], titles: null });
  assert.deepEqual(M.readKinetics('just\nwords\n'), { error: 'no columns of time and absorbance found' });
  assert.deepEqual(M.readKinetics('t,a\n1,2\n2,3\n'), { error: 'no pair of columns (time, absorbance) with three points or more' });
  assert.equal(M.toSec('min'), 60); assert.equal(M.toSec('ms'), 1e-3); assert.equal(M.toSec('sec'), 1);
  assert.equal(M.width(['a', '', '']), 1); assert.equal(M.numRow(['1', '', '2']), true); assert.equal(M.numRow(['1', 'x']), false);
  // kept by its bytes: read once, the same traces; a pair that is none
  const b = enc(CARY), f = { rawBytes: b, k: 1 };
  assert.equal(M.tableOf(f), M.tableOf({ rawBytes: b })); assert.equal(M.traceOf(f).name, 'Sample <2>');
  assert.equal(M.traceOf({ rawBytes: b, k: 5 }), null); assert.equal(M.traceOf({ rawBytes: b, k: '1' }), null); assert.equal(M.tableOf({ rawBytes: [1] }), null);
  assert.equal(M.tableOf({ rawBytes: enc('x\n') }), null);
  const b2 = enc('x'), t = { traces: [], n: 0 }; M.keepTable(b2, t); assert.equal(M.tableOf({ rawBytes: b2 }), t);
  assert.equal(M.readBytes(b).n, 2);
  assert.equal(M.tipOf({ rawBytes: b, k: 0, src: 'k.csv' }), 'Wavelength: 350 nm\nCollection time: 7/23/2025 1:15:02 PM\nFile: k.csv');
  assert.equal(M.tipOf({ rawBytes: b, k: 1, name: 'n' }), 'Wavelength: 352.5 nm\nFile: n');
  assert.equal(M.tipOf({ k: 0 }), '');
  assert.deepEqual(M.traceRec('k.csv', k, 1, k.traces[1], b, '#123', 0.01), { name: 'k.csv (2)', src: 'k.csv', label: 'Sample <2>', color: '#123', rawBytes: b, k: 1, inj: 1 });
  assert.equal(M.traceRec('k.csv', { n: 2 }, 0, { name: '', t: [0, 1, 2], A: [0, 0, 0] }, b, '#1', 0.01).label, 'k (1)');
  assert.equal(M.traceRec('k.csv', { n: 1 }, 0, { name: '', t: [0, 1, 2], A: [0, 0, 0] }, b, '#1', 0.01).label, 'k');
  assert.deepEqual(M.fileIn({ rawBytes: b, k: 0, inj: '3' }), { rawBytes: b, k: 0, inj: null });
  assert.equal(M.fileIn({ rawBytes: b, k: 9 }), null);
});

test('the injection, the alignment and the reading', ()=>{
  assert.deepEqual(M.findPeaks([0, 1, 0, 5, 4, 6, 0], 0.5), [1, 3, 5]);
  assert.deepEqual(M.findPeaks([0, 1, 0, 5, 4, 6, 0], 2), [5]);
  const tr = { t: [0, 1, 2, 3, 4, 5, 6], A: [0.1, 0.5, 0.2, 0.5, 0.3, 0.35, 0.3] };
  assert.equal(M.suggestInj(tr, 0.1), 1); assert.equal(M.suggestInj(tr, 1), null); assert.equal(M.suggestInj(null, 0), null);
  assert.equal(M.nearestIdx([0, 1, 2, 3], 1.5), 1); assert.equal(M.nearestIdx([0, 1, 2, 3], 1.6), 2); assert.equal(M.nearestIdx([0, 1, 2, 3], 9), 3);
  const al = M.alignOf(U, tr, 2.9);
  assert.deepEqual([al.i0, al.t0, al.min, [...al.xs], [...al.ys].map(v=> +v.toFixed(12))], [3, 3, 0.3, [-3, -2, -1, 0, 1, 2, 3], [-0.2, 0.2, -0.1, 0.2, 0, 0.05, 0]]);
  assert.equal(M.alignOf(U, tr, 2.9), al);
  assert.equal(M.alignOf(U, tr, NaN), null);
  near(M.readAt(al, 1.5), 0.025); assert.ok(Number.isNaN(M.readAt(al, 3.5))); assert.ok(Number.isNaN(M.readAt(al, -1))); assert.equal(M.readAt(al, 3), 0);
  assert.equal(M.readAt(M.alignOf(U, tr, 6), 0), 0);
  const fs = [{ rawBytes: enc(CARY), k: 0, inj: 0 }, { rawBytes: enc(CARY), k: 1, inj: 2 }];
  assert.equal(M.suggestAll(fs, 0.01), true); assert.deepEqual(fs.map(f=> f.inj), [2, 1]);
  assert.equal(M.suggestAll(fs, 0.01), false);
});

test('the calibration: read back, its line, the window\'s draft, its words, Apply', ()=>{
  assert.deepEqual(M.calIn(U, 5), M.calDefault());
  assert.deepEqual(M.calIn(U, { mode: 'constructor', slope: '2', intercept: 1, stds: [[1, 2], [3], 'x', [NaN, 'a']], unit: 'u'.repeat(50) }),
    { mode: 'none', slope: null, intercept: 1, stds: [[1, 2], [null, null]], unit: 'u'.repeat(40) });
  const c = { mode: 'std', slope: null, intercept: null, stds: [[1, 0.11], [2, 0.21], [3, 0.31], [4, null]], unit: ' µM ' };
  const d = M.calCopy(c); d.stds[0][0] = 9; assert.equal(c.stds[0][0], 1);
  assert.equal(M.stdsOf(c).length, 3);
  const L = M.calLine(U, c); near(L.m, 0.1); near(L.q, 0.01); near(L.r2, 1); assert.equal(L.n, 3);
  assert.equal(M.calLine(U, { ...c, stds: [[1, 1], [1, 2]] }), null);
  assert.equal(M.calLine(U, { ...c, stds: [[1, 1], [2, 1]] }), null);
  assert.deepEqual(M.calLine(U, { mode: 'line', slope: 2, intercept: -1, stds: [] }), { m: 2, q: -1, r2: NaN, n: 0 });
  assert.equal(M.calLine(U, { mode: 'line', slope: 0, intercept: 1 }), null);
  assert.equal(M.calLine(U, M.calDefault()), null);
  assert.equal(M.concName(c), 'Concentration (µM)'); assert.equal(M.concName({ unit: ' ' }), 'Concentration');
  assert.deepEqual(M.draftOf(M.calDefault()).stds, [[null, null], [null, null], [null, null]]);
  assert.equal(M.modeIn('std'), 'std'); assert.equal(M.modeIn('toString'), 'none');
  const bad = [[0, 'the slope'], [0, 'standard 2'], [0, 'standard 2']];
  assert.deepEqual(M.badUsed(bad, 'line'), [[0, 'the slope']]); assert.deepEqual(M.badUsed(bad, 'std').length, 2); assert.deepEqual(M.badUsed(bad, 'none'), []);
  // (v571: the fields holding no number said under their group, C19; a line that is none, alone,
  // a compact error, C17)
  assert.equal(M.notNumber(M.badUsed(bad, 'std')), 'Not a number: standard 2.');
  assert.equal(M.notNumber(bad), 'Not a number: the slope, standard 2.');
  assert.equal(M.notNumber([]), '');
  assert.equal(M.calMsg({ mode: 'std' }, M.badUsed(bad, 'std'), null), '');
  assert.equal(M.calMsg({ mode: 'line' }, [], null), 'A slope (not 0) and an intercept are needed.');
  assert.equal(M.calMsg({ mode: 'line' }, [[0, 'the slope']], null), '', 'a field holding no number: said under it');
  assert.equal(M.calMsg({ mode: 'line' }, [], {}), '');
  const ap = M.applied({ mode: 'std', slope: null, intercept: null, stds: [[1, 2], [null, null], [null, 3]], unit: ' mM ' }, M.calDefault());
  assert.deepEqual(ap, { mode: 'std', slope: null, intercept: null, stds: [[1, 2], [null, 3]], unit: 'mM' });
  assert.equal(M.applied({ ...M.calDefault(), stds: [[null, null]] }, M.calDefault()), null);
  assert.equal(M.fieldNum(' 1,5 '), 1.5); assert.equal(M.fieldNum(''), null); assert.equal(M.fieldNum('1e'), undefined); assert.equal(M.fieldNum('.5e-1'), 0.05);
  assert.equal(M.sig(1/3), '0.3333'); assert.equal(M.sig(NaN), 'n/a'); assert.equal(M.fix(1.005, 1), '1.0');
});

test('the state, a trace\'s results and read-outs, the plots, the CSVs', ()=>{
  assert.deepEqual(M.stateIn(U, { tRead: -1, minProm: 0, cal: { mode: 'line', slope: 1, intercept: 0 } }), { tRead: 240, minProm: 0, cal: { mode: 'line', slope: 1, intercept: 0, stds: [], unit: '' } });
  const cal = M.calDefault(), st = M.stateOf(30, 0.1, cal); assert.notEqual(st.cal, cal); assert.deepEqual(st, { tRead: 30, minProm: 0.1, cal });
  const b = enc(CARY), f0 = { name: 'a', label: 'A <a>', color: '#111', rawBytes: b, k: 0, inj: 1 }, f1 = { name: 'b', label: 'B', color: '#222', rawBytes: b, k: 1, inj: null };
  assert.equal(M.curOf([f0, f1], 'b'), f1); assert.equal(M.curOf([f0, f1], 'x'), f0); assert.equal(M.curOf([], 'x'), null);
  assert.deepEqual(M.showsOf([f0, f1], f1), { trace: 'b' }); assert.equal(M.showsOf([f0, f1], f0), null); assert.equal(M.showsOf([f0], f0), null);
  assert.equal(M.showNextIn(U, { trace: 'b' }), 'b'); assert.equal(M.showNextIn(U, { trace: 3 }), null);
  const line = { mode: 'line', slope: 0.5, intercept: 0.01, stds: [], unit: ' mM ' }, L = M.calLine(U, line);
  const r = M.resultOf(U, f0, 1.5, line);
  near(r.A, 0.105); near(r.c, (0.105 - 0.01)/0.5);
  assert.deepEqual(M.readouts(r, line, 1.5, L), { inj: '1.00 s', bg: '0.1200', A: '0.1050', AWarn: '', ATitle: 'Absorbance at 1.5 s:', cRow: '', c: '0.19 mM' });
  // (v567: past the trace's end, n/a and a warning under the read-outs; no injection, none,
  // the note under the plot saying to click it)
  const past = M.readouts(M.resultOf(U, f0, 5, line), line, 5, L);
  assert.deepEqual([past.A, past.AWarn], ['n/a', 'The trace ends 2.0 s after the injection: no reading at 5 s.']);
  assert.deepEqual(M.readouts(M.resultOf(U, f1, 5, cal), cal, 5, null), { inj: 'none', bg: 'n/a', A: 'n/a', AWarn: '', ATitle: 'Absorbance at 5 s:', cRow: 'none', c: 'n/a' });
  const tr = M.traceOf(f0), R = M.traceRange(tr);
  assert.deepEqual([R.x0, R.x1], [0, 3]); near(R.y0, 0.1 - 0.01); near(R.y1, 0.3 + 0.01);
  assert.deepEqual(M.alignRange([], 100), [0, 125, -0.05, 1.05]);
  const al = [M.resultOf(U, f0, 1, cal)], AR = M.alignRange(al, 4);
  assert.deepEqual([AR[0], AR[1]], [-1, 4]);
  assert.equal(M.alignNote(3, 1), '2 traces with no injection set, not shown.'); assert.equal(M.alignNote(2, 1), '1 trace with no injection set, not shown.'); assert.equal(M.alignNote(1, 1), '');
  const list = [M.resultOf(U, f0, 1.5, line), M.resultOf(U, f1, 1.5, line)], lay = M.readingsLayout(U, list, L, line, MCTX, 640, 420);
  assert.deepEqual(lay.has, [true, false]); assert.equal(lay.opts.ylabel, 'Concentration (mM)'); assert.equal(lay.range[1], 3);
  assert.ok(lay.opts.margin.b >= 26 && lay.range[3] > lay.vals[0]);
  assert.equal(M.readCap(L, line, 1.5), 'Concentration (mM) at 1.5 s'); assert.equal(M.readCap(null, line, 2), 'Absorbance − background at 2 s');
  const a = M.alignedCsv(U, list);
  assert.equal(a.split('\n')[0], 'A <a> - time from injection (s);A <a> - absorbance at 350 nm - background');
  assert.equal(M.alignedCsv(U, [list[1]]), 'No trace with an injection set\n');
  const rc = M.readingsCsv(U, list, line, 1.5, L).split('\n');
  assert.equal(rc[0], 'Trace;File;Wavelength (nm);Collection time;Injection time (s);Background absorbance;Reading time (s);Absorbance - background;Concentration (mM)');
  assert.equal(rc[2], 'B;b;352.5;;;;1.5;;');
});

test('the markup: the calibration\'s summary, the legend, the window, its rows and fit, escaped', ()=>{
  assert.equal(H.calSumHtml(M.calDefault(), null, HU), 'Calibration: <b>none</b>');
  assert.equal(H.calSumHtml({ mode: 'line', unit: '' }, null, HU), '<div class="alert warn compact">⚠ Calibration incomplete: not used.</div>');
  assert.equal(H.calSumHtml({ mode: 'std', unit: '<i>' }, { m: 0.1, q: -0.02, r2: 0.99999 }, HU), 'Calibration: <b>A = 0.1 × c − 0.02</b>, R² = <b>1.0000</b>, c in <b>&lt;i&gt;</b>');
  assert.equal(H.legendHtml([['#a"b', 'x <y>']], HU), '<span><i style="background:#a&quot;b"></i>x <y></span>');
  const w = H.calHtml(HU);
  for (const s of ['id="iodoCalMode"', 'value="none"', 'value="line"', 'value="std"', 'id="iodoCalUnit"', 'id="iodoCalSlope"', 'id="iodoCalIcpt"', 'data-add-std', 'data-apply', 'data-cancel', 'iodo-cal-x', '<tbody></tbody>']) assert.ok(w.includes(s), s);
  const rows = H.stdRowsHtml([[1, null], ['<x>', 2]], HU);
  assert.ok(rows.includes('value="1"') && rows.includes('value=""') && rows.includes('value="&lt;x&gt;"') && rows.includes('aria-label="Remove standard 2"'));
  assert.equal(H.calFitHtml({ mode: 'line' }, null, 0, HU), '');
  assert.equal(H.calFitHtml({ mode: 'std' }, null, 1, HU), '<div class="alert bad compact">✕ 1 standard with both values: two of different concentrations at least are needed.</div>');
  assert.equal(H.calFitHtml({ mode: 'std' }, { n: 3, m: 0.1, q: 0.01, r2: 0.5 }, 3, HU), 'Fit of 3 standards: slope <b>0.1</b>, intercept <b>0.01</b>, R² = <b>0.5000</b>');
  assert.equal(H.calMsgHtml('A <b>', HU), '<div class="alert bad compact">✕ A &lt;b&gt;</div>');
  assert.equal(H.calMsgHtml('', HU), '');
  const win = H.calHtml(HU);
  assert.ok(win.includes('<p class="field-rule iodo-cal-rule" data-rule="line" role="alert"></p>') && win.includes('<p class="field-rule iodo-cal-rule" data-rule="std" role="alert"></p>'), 'a rule under each group of fields');
});

/* ---- 40 cases: random kinetics files, states and steps, as v562's iodo.js did them ---- */
export function rnd(seed){ let s = seed >>> 0 || 1; return ()=>{ s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function caryOf(r){
  const pick = a => a[Math.floor(r()*a.length)], chance = p => r() < p;
  const nt = 1 + Math.floor(r()*3), sep = pick([',', ';', '\t']), comma = sep === ';' && chance(0.6), unit = pick(['sec', 'min']), dt = pick([0.5, 1, 2]), n = 40 + Math.floor(r()*60);
  const TR = Array.from({ length: nt }, (_, k)=> ({ name: pick([`blank${k + 1}`, `S <${k}>`, '']), len: chance(0.3) ? 10 + Math.floor((n - 10)*r()) : n, inj: 3 + Math.floor(r()*n*0.5), base: r()*0.3, k: r()*0.4, tau: 5 + r()*30, wl: pick(['350.0', '352,5']) }));
  const num = v => { const s = String(+v.toFixed(6)); return comma ? s.replace('.', ',') : s; };
  const lines = [TR.map(t=> t.name + sep + sep).join(''), TR.map(()=> `Time (${unit})${sep}Abs${sep}`).join('')];
  for (let j = 0; j < n; j++) lines.push(TR.map(t=>{ if (j >= t.len) return sep + sep;
    let a = t.base + (j >= t.inj ? t.k*(1 - Math.exp(-(j - t.inj)*dt/t.tau)) : 0) + 0.002*(r() - 0.5);
    if (j === t.inj) a += 0.1; else if (j === t.inj + 1) a += 0.05;
    return num(j*dt) + sep + num(a) + sep; }).join(''));
  lines.push('');
  for (const t of TR) if (chance(0.7)) lines.push(t.name, `Collection Time: 1/${t.len}/2025`, `Wavelength (nm)  ${t.wl}`, '');
  return lines.join('\r\n');
}
export function caseOf(seed){
  const r = rnd(seed*7919 + 29), pick = a => a[Math.floor(r()*a.length)], chance = p => r() < p;
  const files = Array.from({ length: 1 + Math.floor(r()*2) }, (_, i)=> ({ name: `k${i + 1}.csv`, text: caryOf(r) }));
  const state = { tRead: pick([240, 30, 10, 1e4]), minProm: pick([0.01, 0.2, 0]), cal: pick([null, { mode: 'line', slope: 0.02, intercept: -0.001, unit: 'µM' }, { mode: 'std', stds: [[1, 0.05], [2, 0.11], [4, 0.2]], unit: '<mM>' }, { mode: 'line', slope: 0 }]) };
  const steps = Array.from({ length: 8 }, ()=>{
    const k = pick(['tread', 'prom', 'suggest', 'inj', 'inj', 'show', 'cal', 'cal', 'include']);
    if (k === 'tread') return [k, pick(['20', '5,5', '-1', '', 'x', '1e2', '30'])];
    if (k === 'prom') return [k, pick(['0.05', '0,3', '-1', '0', 'q'])];
    if (k === 'inj') return [k, r()];
    if (k === 'show') return [k, Math.floor(r()*6)];
    if (k === 'include') return [k, Math.floor(r()*6), chance(0.5)];
    if (k === 'cal') return [k, { mode: pick(['none', 'line', 'std', 'std']), unit: pick(['', 'µM', ' mM ', 'a<b>']), slope: pick(['0,01', '', 'x', '0', '0.03']), icpt: pick(['0', '-0.002', '', 'y']),
      stds: Array.from({ length: Math.floor(r()*5) }, ()=> [pick(['1', '2', '3,5', '', 'z', '1']), pick(['0.04', '0,09', '0.2', '', 'w'])]) }];
    return [k];
  });
  return { files, state, steps };
}

/* ---- iodo.js's wiring, in short ---- */
// The case's files read as a drop does (each trace its colour, its injection suggested), then
// the state put back as a restore does.
export function loadCase(c){
  const all = [];
  for (const file of c.files){
    const rawBytes = enc(file.text), t = M.readBytes(rawBytes);
    if (!t || t.error) continue;
    M.keepTable(rawBytes, t);
    t.traces.forEach((tr, k)=>{ if (tr) all.push(M.traceRec(file.name, t, k, tr, rawBytes, PAGE.nextColor(all), M.DEF.minProm)); });
  }
  const S = { all: all.map(f=> M.fileIn({ ...f })).filter(Boolean), curName: null, ...M.stateIn(U, c.state) };
  return S;
}
const filesOf = S => S.all.filter(f=> f.included !== false);
function calStep(S, spec){
  const d = M.draftOf(S.cal), bad = [];
  const take = (s, name)=>{ const v = M.fieldNum(s); if (v === undefined){ bad.push([null, name]); return null; } return v; };
  while (d.stds.length < spec.stds.length) d.stds.push([null, null]);
  d.mode = M.modeIn(spec.mode); d.unit = spec.unit;
  d.slope = take(spec.slope, 'the slope'); d.intercept = take(spec.icpt, 'the intercept');
  d.stds = d.stds.map((p, i)=> (i < spec.stds.length ? spec.stds[i] : p.map(v=> v == null ? '' : String(v))).map(s=> take(s, `standard ${i + 1}`)));
  const used = M.badUsed(bad, d.mode), L = M.calLine(U, d), msg = M.calMsg(d, used, L);
  if (msg || (d.mode !== 'none' && !L) || used.length) return;
  const cal = M.applied(d, S.cal);
  if (cal) S.cal = cal;
}
export function stepCase(S, [k, a, b]){
  const files = filesOf(S), f = M.curOf(files, S.curName);
  if (k === 'tread' || k === 'prom'){ const v = M.fieldNum(a), key = k === 'tread' ? 'tRead' : 'minProm';
    if (v == null || !(k === 'tread' ? v > 0 : v >= 0) || Object.is(v, S[key])) return; S[key] = v; }
  else if (k === 'suggest') M.suggestAll(S.all, S.minProm);
  else if (k === 'inj'){ if (!f) return; const tr = M.traceOf(f); f.inj = tr.t[Math.min(tr.t.length - 1, Math.floor(a*tr.t.length))]; }
  else if (k === 'show'){ if (files[a]) S.curName = files[a].name; }
  else if (k === 'cal') calStep(S, a);
  else if (k === 'include'){ const g = S.all[a]; if (g){ if (b) delete g.included; else g.included = false; } }
}
// What the page shows: the traces, the Analysis card, the Results' plots, the CSVs, the state.
export function outOf(S){
  const files = filesOf(S), f = M.curOf(files, S.curName), L = M.calLine(U, S.cal);
  const o = { traces: S.all.map(g=> [g.name, g.label, g.color, g.k, g.inj, g.included === false]), fields: [String(S.tRead), String(S.minProm)], sum: H.calSumHtml(S.cal, L, HU) };
  if (!f) return o;
  const r = M.resultOf(U, f, S.tRead, S.cal), R = M.traceRange(r.tr);
  o.read = M.readouts(r, S.cal, S.tRead, L);
  const marks = r.al ? [[r.al.t0, r.tr.A[r.al.i0], 'injection'], ...(Number.isFinite(r.A) ? [[r.al.t0 + S.tRead, r.al.min + r.A, 'reading']] : [])] : [];
  o.trace = [[R.x0, R.x1, R.y0, R.y1], dg(r.tr.t), dg(r.tr.A), f.color, f.label, marks, r.al ? [r.al.t0, R.x1, r.al.min] : null];
  const list = files.map(g=> M.resultOf(U, g, S.tRead, S.cal)), al = list.filter(x=> x.al);
  o.align = [M.alignRange(al, S.tRead), al.map(x=> [dg(x.al.xs), dg(x.al.ys), x.f.color, x.f.label, x.f.name]), M.alignNote(list.length, al.length)];
  const lay = M.readingsLayout(U, list, L, S.cal, MCTX, 700, 400);
  o.readings = [M.readCap(L, S.cal, S.tRead), lay.opts.ylabel, lay.opts.margin.b, lay.range, list.map((x, k)=> [lay.has[k] ? [lay.vals[k], x.f.color, x.f.label, M.sig(lay.vals[k])] : null, lay.fit.labels[k], lay.fit.rot])];
  o.csv = [M.alignedCsv(U, list), M.readingsCsv(U, list, S.cal, S.tRead, L)];
  o.state = canon(M.stateOf(S.tRead, S.minProm, S.cal));
  o.shows = canon(M.showsOf(files, f));
  return o;
}
export function runCase(c){
  const S = loadCase(c), out = [outOf(S)];
  for (const st of c.steps){ stepCase(S, st); out.push(outOf(S)); }
  return canon(out);
}
export const CASES = 40;

test('40 cases as v562\'s iodo.js gave them (golden digests)', ()=>{
  const got = { cases: Array.from({ length: CASES }, (_, i)=> sha(runCase(caseOf(i + 1)))) };
  if (UPDATE){ fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + '\n'); return; }
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const off = got.cases.map((h, i)=> h === want.cases[i] ? null : i).filter(i=> i !== null);
  assert.deepEqual(off, [], 'cases whose digest differs');
  assert.equal(got.cases.length, want.cases.length);
});
