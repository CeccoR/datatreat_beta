/* GC's Integration cards: their calculations (gc-integ-model.js) and their words and markup
   that need no page (gc-integ-html.js), in Node: no browser (v560). The method as a project
   holds it (windows' edges kept or refused, the engine's own settings) and its key, v544's
   results' keys read as v545's, a result as the store keeps it (8 digits, NaN through JSON,
   no parameters), the calibration read back (every value made valid); the raw chromatograms
   and the calibration's tables read once per file; the results taken in (merged, a result
   never taken away, malformed ones dropped) and saved, the states a result is written into;
   what the job integrates; the entries a card shows (pairs, a count that differs, raw
   chromatograms alone and paired, files left out, bytes not stored), their results under
   the method applied, never the windows edited (v578: to v577 the one before it, stale);
   what the job integrates first (the chromatograms in view, then a run's windows), what a
   card has left; the standards' names (the table's Analysis
   column, its number, a column of v544–v548's), rows and lines; a gas's concentration by the
   standards' line (%mol and ppm, through zero), by the GC software's scale (k) or none, and
   what Analysis takes of a sample, kept while nothing changes; the suspicious rule against a
   hand calculation (χ²ᵣ, a fit that did not converge, a column that ends early, an area out
   of proportion with the table, in %mol and in the .txt export's ppm); the selectors' names;
   the chromatogram over its residuals (ranges off the panels' shared edge, curves, peaks,
   the points left out, the legend), the run overview (its points, axes and what a point
   says), the point nearest the pointer, the status line in every state, the alerts' facts,
   integration.csv and chromatogram.csv; the calibration window's files told by what they
   hold and paired (waiting, refused, already loaded, an old calibration named), a level as
   typed, the thumbnails, a gas's line and its levels; the card's state saved and put back;
   every name in the markup escaped. Then 60 cases (random rows of every kind, a state of
   every version and malformed, results real and made up, v544's and malformed, then eight
   steps each: a file or a chromatogram chosen or stepped, the overview's gas and y, a
   window's edge typed or reset, the calibration window opened and closed, files dropped in
   it, levels typed and ticked, a row picked, the unit, an intercept, a file removed, results
   loaded, a file left out or unpaired, a state put back, showNext, clear; at each, the status
   line, the alerts, the selectors' names, the chromatogram's and the overview's plot calls,
   notices and legends, Peaks, Windows, the CSVs, the state, sig, what Analysis takes, the
   results saved and, while it is open, the calibration window's files, warning, rows,
   status, fit, lines and what a drop said) and four scenes (an old calibration named beside
   standards added after it; methods changed, refused and reset; rows of every kind chosen,
   left out and unpaired; v578: windows edited, applied as Integrate applies them, a state
   with windows pending put back) as v559's gc-integ.js gave them, a window's edges pending
   until applied from v578 (a window edited, its results the method's applied; with no
   standards, the calibration window its files and warning alone), run from its source on a
   page of stubs: their digests in tests/golden/integmodel.json (npm run
   test:update writes them anew after a change meant to alter them). utils.js's, modkit.js's,
   modcharts.js's, plot.js's and snav.js's helpers, which need a page to load, are taken
   from their source as they stand there. About two seconds. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { rng } from './fixtures.mjs';
import * as G from '../gc-tcd.js';
import * as GM from '../gc-model.js';
import * as M from '../gc-integ-model.js';
import * as H from '../gc-integ-html.js';
import { boxHtml } from '../alerts.js';

// The page's dates are local: the tests' time zone, as the browser tests' (helpers.mjs).
process.env.TZ = 'UTC';
const UPDATE = !!process.env.UPDATE_GOLDEN || process.env.npm_lifecycle_event === 'test:update';
const GOLDEN = new URL('./golden/integmodel.json', import.meta.url);
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
const UN = ['esc', 'fmtNum', 'csvField', 'csvJoin', 'csvLine', 'X_SVG', 'ALERT_ICON', 'alertHtml', 'FILE_ALERT', 'fileAlertHtml', 'exactKey', '_bytesKey', 'bytesKey'];
const KN = ['isObj', 'num', 'oneOf'], CN = ['PLOT_DL_ICON', 'plotWrap', 'chipRow'];
const settings = { decimal: '.', field: ';' };
const PAGE = new Function('settings', [...UN.map(n=> decl(n === 'ALERT_ICON' ? 'alerts.js' : 'utils.js', n)), ...KN.map(n=> decl('modkit.js', n)), ...CN.map(n=> decl('modcharts.js', n)),
  decl('snav.js', 'snavHtml'), decl('plot.js', 'niceStep'), decl('plot.js', 'niceTicks'), decl('cards.js', 'cardInfo')].join('\n')
  + `\nreturn { ${[...UN, ...KN, ...CN, 'snavHtml', 'niceTicks', 'cardInfo'].join(', ')} };`)(settings);
const ids = new WeakMap();
let nid = 0;
const objId = o => o == null || typeof o !== 'object' ? String(o) : ids.get(o) || (ids.set(o, ++nid), nid);
const U = { isObj: PAGE.isObj, oneOf: PAGE.oneOf, num: PAGE.num, esc: PAGE.esc, exactKey: PAGE.exactKey, bytesKey: PAGE.bytesKey, objId, fmtNum: PAGE.fmtNum, csvLine: PAGE.csvLine, niceTicks: PAGE.niceTicks };
const HU = { esc: PAGE.esc, alertHtml: PAGE.alertHtml, fileAlertHtml: PAGE.fileAlertHtml, X_SVG: PAGE.X_SVG, snavHtml: PAGE.snavHtml, plotWrap: PAGE.plotWrap, chipRow: PAGE.chipRow, PLOT_DL_ICON: PAGE.PLOT_DL_ICON };
const GASES = GM.GASES.map(g=> ({ key: g.key, label: g.label, txt: GM.gasTxt(g), csv: g.csv, color: g.bar }));
export const canon = v => JSON.stringify(v, function(k, x){ const o = this[k];
  if (o instanceof Date) return 'D' + o.getTime();
  if (o instanceof Uint8Array) return PAGE.bytesKey(o);
  if (typeof o === 'number') return Object.is(o, -0) ? '#-0' : '#' + o;
  if (typeof o === 'function') return 'fn';
  return x; });
const near = (a, b, tol, what)=> assert.ok(Math.abs(a - b) <= tol*Math.max(1, Math.abs(b)), `${what}: ${a} against ${b}`);

/* ---- The files (made up): raw chromatograms from the engine's own peak model ---- */
function normal(seed){
  let s = seed >>> 0;
  const u = ()=>{ s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + 0.5)/4294967296; };
  return ()=> Math.sqrt(-2*Math.log(u()))*Math.cos(2*Math.PI*u());
}
const shape = (A, mu)=> ({ A, mu, sigma: 0.5, dmu: 0.35, fc: 0.25, tau1: 0.7, tau2: 4.0, w2: 0.06 });
const TT = Array.from({ length: 451 }, (_, i)=> (1250 + i)/5);
function chromatogram(h2, o2, seed, o = {}){
  const z = normal(seed), P = [G.peakShape(TT, shape(h2, 287.0)), G.peakShape(TT, shape(o2, 302.0)), G.peakShape(TT, shape(300, 310.1))];
  return TT.map((t, i)=>{
    if (o.end && t > o.end) return NaN;
    let v = -5000 + 0.8*(t - 297) + G.step(t, -12, 305.6, 0.8) + P[0][i] + P[1][i] + P[2][i] + z();
    if (o.spike && Math.abs(t - o.spike) < 0.01) v += 400;
    if (o.glitch && t >= o.glitch && t <= o.glitch + 1.2) v += 60*Math.sin(5*t);
    return v;
  });
}
const S_H2 = 40000, S_O2 = 12000;
const truth = (n, a, b)=> Array.from({ length: n }, (_, k)=> [a + 0.01*k, b + 0.002*k]);
const areas = rows => rows.map(([h, o])=> [h*S_H2, o*S_O2]);
const tableRows = (sw, rows)=> rows.map(([h, o])=> [+(h*sw).toFixed(6), +(o*sw).toFixed(6)]);
const bytes = s => new Uint8Array(Buffer.from(s));
function tcdBytes(name, cols, opts = []){
  const ys = cols.map(([h2, o2], k)=> chromatogram(h2, o2, 101 + 7*k + name.length, opts[k] || {}));
  const n = v => Number.isFinite(v) ? String(+v.toFixed(5)).replace('.', ',') : '';
  return bytes(TT.map((t, i)=> [n(t), ...ys.map(y=> n(y[i]))].join(';') + ';').join('\r\n') + '\r\n');
}
const when = (k, day)=>{ const m = 10*60 + 20*k; return `11/${day}/2026 ${Math.floor(m/60)}:${String(m % 60).padStart(2, '0')}:00`; };
const tableText = (rows, day = 13)=> 'Injection Date,H2 (A) [%Mol],O2 (A) [%Mol]\n' + rows.map(([h2, o2], k)=> `${when(k, day)},${h2},${o2}\n`).join('');
function altText(rows){
  const TB = '\t', head = [['No. ', 'Inject Time ', 'Area', 'Area', 'Area ', 'Amount', 'Amount ', 'Amount '].join(TB),
    TB + ['', '', 'pA*min', 'pA*min', 'pA*min', '', '', ''].join(TB), TB + ['', '', ...Array(6).fill('PDD_Ch_1')].join(TB),
    TB + ['', '', 'Hydrogen', 'Nitrogen', 'Oxygen', 'Hydrogen', 'Nitrogen', 'Oxygen'].join(TB)];
  const lines = rows.map(([h2, o2], k)=> [String(k + 1), `13/Nov/2026 ${when(k, 13).slice(11, 16)}`, '1', '1', '1', String(+(h2*1e4).toFixed(4)), '300', String(+(o2*1e4).toFixed(4))].join(TB));
  return [...head, ...lines].join('\r\n') + '\r\n';
}
const STD = [[0.05, 0], [0.1, 0], [0.2, 0], [0, 0.02], [0, 0.05], [0, 0.1]];
const calTable = names =>{
  const head = '"Analysis";"Injection date";"CH4 (A) [%Mol]";"H2 (B) [%Mol]";"O2 (B) [%Mol]";"N2 (B) [%Mol]";"Total (%)";';
  const rows = names.map((nm, k)=>{ const m = 10*60 + 33*k, h = Math.floor(m/60); return `"${nm}";10/29/2026 ${h % 12 || 12}:${String(m % 60).padStart(2, '0')}:36 ${h < 12 ? 'AM' : 'PM'};0.00000;${(7 + k).toFixed(5)};${(3 + k).toFixed(5)};57.87601;157.68375;`; });
  return new Uint8Array(Buffer.from('﻿' + [head, ...rows].join('\r\n') + '\r\n', 'utf16le'));
};
const RUN = truth(12, 0.05, 0.03), MINI = truth(3, 0.07, 0.04), ALT = truth(5, 0.06, 0.035);
const TEXT = { 'run.csv': tableText(tableRows(1.1, RUN)), 'short.csv': tableText(tableRows(1, RUN), 14), 'mini.csv': tableText(tableRows(1, MINI), 15),
  'alt.txt': altText(tableRows(1, ALT)), 'solo.csv': tableText(tableRows(1, MINI), 16) };
export const BYTES = {
  'run_TCD.csv': tcdBytes('run_TCD.csv', areas(RUN)), 'short_TCD.csv': tcdBytes('short_TCD.csv', areas(RUN.slice(0, 11))),
  'mini_TCD.csv': tcdBytes('mini_TCD.csv', areas(MINI), [{}, { spike: 287.4 }, { glitch: 296 }]), 'alt_TCD.csv': tcdBytes('alt_TCD.csv', areas(ALT)),
  'lone_TCD.csv': tcdBytes('lone_TCD.csv', areas(truth(3, 0.2, 0.1))), 'twinA_TCD.csv': tcdBytes('twinA_TCD.csv', areas(truth(2, 0.1, 0.05))),
  'twinB_TCD.csv': tcdBytes('twinB_TCD.csv', areas(truth(2, 0.12, 0.06))), 'end_TCD.csv': tcdBytes('end_TCD.csv', areas(truth(2, 0.1, 0.05)), [{}, { end: 300.2 }]),
  'broken_TCD.csv': bytes('1;2;\r\n1;3;\r\n0;4;\r\n'),
  'standards.csv': calTable(['cal_H2_0.05%_001', 'cal_H2_0.1%_001', 'cal_H2_0.2%_001 <b>&', 'cal_O2_0.02%_001', '', 'cal_O2_0.1%_001 and a long remark']),
  'standards_TCD.csv': tcdBytes('standards_TCD.csv', STD.map(([h, o])=> [h*S_H2, o*S_O2])),
  'stds2.csv': calTable(['a', 'b', 'c', 'd', 'e']), 'stds2_TCD.csv': tcdBytes('stds2_TCD.csv', STD.map(([h, o])=> [h*S_H2*1.02, o*S_O2*0.97])),
  'old (1)_TCD.csv': tcdBytes('old (1)_TCD.csv', STD.slice(0, 4).map(([h, o])=> [h*S_H2, o*S_O2])), 'old.csv': calTable(['o1', 'o2 "q"', 'o3', 'o4']), 'old (2).csv': calTable(['p1', 'p2', 'p3']),
  'notext.csv': new Uint8Array([0xff, 0xfe, 0x00, 0xd8, 0x00, 0x00, 0x41]), 'nothing.csv': bytes('hello\nworld\n'),
};
for (const [k, t] of Object.entries(TEXT)) BYTES[k] = bytes(t);
const label = name => name.replace(/\.[^.]+$/, '');
const tableRec = name => ({ name, label: label(name), color: '#3aa0ff', ...GM.readGc(TEXT[name]) });
const tcdRec = name =>{ const d = G.readTcd(new TextDecoder().decode(BYTES[name])); return { name, label: label(name), color: '#ff7a59', rawBytes: BYTES[name], tcd: { n: d.error ? 0 : d.cols.length } }; };
// The rows of a file list (each made afresh): pairs, raw chromatograms alone and paired, a table alone, bytes not stored.
export const ROWS = [
  ()=> ({ ...tableRec('run.csv'), mate: tcdRec('run_TCD.csv') }),
  ()=> ({ ...tableRec('short.csv'), mate: tcdRec('short_TCD.csv') }),
  ()=> ({ ...tableRec('mini.csv'), mate: tcdRec('mini_TCD.csv') }),
  ()=> ({ ...tableRec('alt.txt'), mate: tcdRec('alt_TCD.csv') }),
  ()=> tcdRec('lone_TCD.csv'),
  ()=> ({ ...tcdRec('twinA_TCD.csv'), mate: tcdRec('twinB_TCD.csv') }),
  ()=> tcdRec('end_TCD.csv'),
  ()=> tcdRec('broken_TCD.csv'),
  ()=> tableRec('solo.csv'),
  ()=> ({ name: 'gone_TCD.csv', label: 'gone <i>', color: '#888', rawBytes: null, tcd: { n: 3 } }),
];

/* ---- Results: the engine's for mini_TCD.csv (its three chromatograms, the default method:
   a clean one, a spike, a glitch zone), made up for the others (their areas, sd, apex, χ²ᵣ
   and windows' marks, some not integrated, some the engine could not fit) ---- */
const DEF = M.methodIn(U, null), ALT_M = M.methodIn(U, { windows: [{ key: 'H2O2', from: 270, to: 326 }] });
const MINI_RES = (()=>{ const d = G.readTcd(new TextDecoder().decode(BYTES['mini_TCD.csv'])); return d.cols.map(y=> M.compact(U, G.integrateChromatogram(d.t, y, DEF))); })();
function madeUp(R, rows, o = {}){
  return rows.map(([A, B], k)=>{
    if (o.err && k === o.err) return { error: 'the integration failed <x>', gases: {}, windows: [] };
    const chi = R.u() < 0.12 ? 6.25 + R.u() : 1 + 2*R.u(), w = { key: 'H2O2', chi2r: chi, ok: R.u() > 0.08, restarted: R.u() < 0.3, ...(o.end === k ? { beyondData: true } : {}) };
    const g = (A0, t)=> ({ area: A0*(1 + 0.02*R.n()), sd: 3 + R.u(), tApex: t + 0.05*R.n(), chi2r: chi, window: 'H2O2' });
    return { gases: { h2: g(A, 287.3), o2: g(B, 302.3) }, windows: [w] };
  });
}
function resultsFor(R, whole = false){
  const out = {}, key = (name, m = DEF)=> M.keyOf(U, { rawBytes: BYTES[name], name }, m);
  out[key('mini_TCD.csv')] = MINI_RES.map(r=> R.u() < 0.1 ? null : r);
  out[key('run_TCD.csv')] = madeUp(R, areas(RUN).map(([a, b], k)=> k === 4 ? [a*1.4, b] : [a, b]), { err: R.u() < 0.3 ? 7 : -1 });
  if (whole || R.u() < 0.5) out[key('run_TCD.csv', ALT_M)] = madeUp(R, areas(RUN));
  out[key('short_TCD.csv')] = madeUp(R, areas(RUN.slice(0, 11)));
  out[key('alt_TCD.csv')] = madeUp(R, areas(ALT).map(([a, b], k)=> k === 2 ? [a, b*0.5] : [a, b]));
  out[key('lone_TCD.csv')] = madeUp(R, areas(truth(3, 0.2, 0.1)));
  out[key('twinA_TCD.csv')] = madeUp(R, areas(truth(2, 0.1, 0.05)));
  out[key('end_TCD.csv')] = madeUp(R, areas(truth(2, 0.1, 0.05)), { end: 1 });
  out[key('standards_TCD.csv')] = madeUp(R, STD.map(([h, o])=> [h*S_H2 - 30, o*S_O2 - 500*S_O2/1e4]));
  out[key('stds2_TCD.csv')] = madeUp(R, STD.map(([h, o])=> [h*S_H2*1.02, o*S_O2*0.97]));
  out[key('old (1)_TCD.csv')] = madeUp(R, STD.slice(0, 4).map(([h, o])=> [h*S_H2, o*S_O2]));
  if (!whole) for (const k of Object.keys(out)) if (R.u() < 0.15) delete out[k];
  return out;
}

/* ---- An instance and a card as gc-integ.js makes them (S, C), with no page ---- */
function instance(all, cards){
  const apis = new Map();
  const S = { ctx: { all, cards: ()=> cards, inst: id => apis.get(id), isTcd: GM.isTcd, readTable: t => GM.readGc(t, true), gases: GASES },
    ...M.gasTable(U, GASES), read: new WeakMap(), tabs: new WeakMap(), store: new Map(), job: null, failed: '', dead: false };
  const card = (a, view = ()=> [])=>{
    const C = { a, method: M.methodIn(U, null), edit: M.methodIn(U, null), run: null, stopped: false, halted: false, cal: M.calIn(U, null), ovGas: 'h2', ovY: 'conc', selName: null, selK: 0, valuesKept: new Map(), calSel: 0, drawn: null, calDrawn: null };
    apis.set(a.id, { tcdRecs: ()=> M.tcdRecs(S, C), method: ()=> C.method, runMethod: ()=> C.run ? C.run.m : null, inView: view, halted: ()=> C.halted });
    return C;
  };
  return { S, card };
}

test('the method, its key and v544\'s; a result as the store keeps it; the calibration read back', ()=>{
  const m = M.methodIn(U, { windows: [{ key: 'H2O2', from: 270.4, to: 330 }, { key: 'X', from: 1, to: 2 }], trapezoid: 1 });
  assert.deepEqual([m.windows.length, m.windows[0].from, m.windows[0].to, 'trapezoid' in m], [1, 270.4, 330, false]);
  for (const bad of [null, 'x', { windows: 'x' }, { windows: [{ key: 'H2O2', from: 330, to: 270 }] }, { windows: [{ key: 'H2O2', from: '1', to: 300 }] }, { windows: [null, { key: 'H2O2', from: NaN, to: 300 }] }])
    assert.equal(M.methodKey(U, M.methodIn(U, bad)), M.methodKey(U, DEF), JSON.stringify(bad));
  assert.notEqual(M.methodKey(U, ALT_M), M.methodKey(U, DEF));
  assert.ok(M.isDefault(U, DEF) && !M.isDefault(U, ALT_M));
  assert.notEqual(M.clone(DEF), DEF); assert.ok(Object.isFrozen(G.DEFAULT_METHOD) && !Object.isFrozen(M.clone(DEF)));
  // v544's key (its method's trapezoids) read as v545's; any other left as it is
  const k = M.keyOf(U, { rawBytes: BYTES['run_TCD.csv'] }, DEF), i = k.indexOf('|'), a = JSON.parse(k.slice(i + 1)), mm = JSON.parse(a[a.length - 1]);
  mm.trapezoid = { on: 1 }; mm.fit.spikes.roundsTrapezoid = 3; a[a.length - 1] = JSON.stringify(mm);
  assert.equal(M.normKey(U, k.slice(0, i + 1) + U.exactKey(a)), k);
  for (const x of [k, 'no bar', 'a|not json', 'b|[1,2]', 'c|["{\\"x\\":1}"]']) assert.equal(M.normKey(U, x), x);
  // a result kept: 8 digits, NaN as JSON's null and back, no parameters, typed arrays plain
  const r = M.compact(U, { gases: { h2: { area: 1.234567891234, sd: NaN, params: [1, 2] } }, windows: [{ p: new Float64Array([1/3, 2]), chi2r: -0 }] });
  assert.deepEqual([r.gases.h2.area, Number.isNaN(r.gases.h2.sd), 'params' in r.gases.h2, r.windows[0].p], [1.2345679, true, false, [0.33333333, 2]]);
  assert.equal(M.compact(U, null), null);
  assert.deepEqual(M.noTrap(U, { gases: { h2: { area: 1, trap: 2 }, o2: 5 } }), { gases: { h2: { area: 1 }, o2: 5 } });
  assert.deepEqual(M.deNull(U, [null, { a: null, b: [1, null] }]).map(x=> canon(x)), ['"#NaN"', '{"a":"#NaN","b":["#1","#NaN"]}']);
  // the calibration: every value made valid
  const c = M.calIn(U, { unit: 'ppm', zero: { h2: 1, o2: true }, files: [null, { name: '', rawBytes: BYTES['lone_TCD.csv'], levels: [{ h2: 0.1, o2: 'x', on: 0 }, 5, { o2: Infinity, on: false }], table: { name: 7, rawBytes: BYTES['run.csv'] } }, { rawBytes: [1] }, { name: 'n', rawBytes: BYTES['run.csv'], levels: 'x', table: { rawBytes: 'no' } }] });
  assert.equal(canon(c), canon({ unit: 'ppm', zero: { h2: false, o2: true }, files: [
    { name: 'calibration.csv', rawBytes: BYTES['lone_TCD.csv'], levels: [{ h2: 0.1, o2: null, on: true }, { h2: null, o2: null, on: true }, { h2: null, o2: null, on: false }], table: { name: 'calibration table.csv', rawBytes: BYTES['run.csv'] } },
    { name: 'n', rawBytes: BYTES['run.csv'], levels: [] }] }));
  assert.deepEqual(M.calIn(U, 'x'), { unit: '%mol', zero: { h2: false, o2: false }, files: [] });
  const cc = M.calCopy(c); cc.files[0].levels[0].h2 = 9; cc.zero.h2 = true;
  assert.deepEqual([c.files[0].levels[0].h2, c.zero.h2, cc.files[0].rawBytes === c.files[0].rawBytes], [0.1, false, true]);
  /* A file's marks of what its window said seen (v573: its box of a calibration of v544–v548's,
     its × kept in the state; to v572 not kept): those that are one, once each, copied with it;
     none, no `seen`. Marked in a state by its card's id (inCal, alerts.js markSeen's put). */
  const sc = M.calIn(U, { files: [{ name: 's', rawBytes: BYTES['lone_TCD.csv'], seen: ['opened', 4, 'opened', 'x', null, 'opened:k'] }, { name: 't', rawBytes: BYTES['run.csv'], seen: 'opened' }] });
  assert.deepEqual([sc.files.map(f=> f.seen), M.calCopy(sc).files[0].seen], [[['opened', 'opened:k'], undefined], ['opened', 'opened:k']]);
  const st = { cards: [{ id: 1, cal: c }, { id: 2, cal: sc }, 7] }, mk = v => v.some(f=> f.name === 'n') ? v.map(f=> f.name === 'n' ? { ...f, seen: ['opened'] } : f) : v;
  const st1 = M.inCal(U, 1)(st, mk);
  assert.deepEqual([st1.cards[0].cal.files.map(f=> f.seen), st1.cards[1] === st.cards[1], st1.cards[2], c.files[1].seen], [[undefined, ['opened']], true, 7, undefined]);
  const bare = { cards: 'x' };
  assert.ok(M.inCal(U, 2)(st, mk) === st && M.inCal(U, 1)(bare, mk) === bare && M.inCal(U, 1)(null, mk) === null, 'none marked: the state itself');
  // the card's state saved and put back
  const { S, card } = instance([], []), C = card({ id: 1 });
  M.restoreCard(U, S, C, { method: ALT_M, cal: c, ovGas: ['co2', 'o2', 'h2'], ovY: 'area' });
  assert.deepEqual([C.method.windows[0].from, C.ovGas, C.ovY], [270, 'h2', 'area'], 'v544\'s list: its first gas in the module\'s order');
  M.restoreCard(U, S, C, { method: ALT_M, cal: c, ovGas: ['co2', 'o2'], ovY: 'area' });
  assert.equal(canon(M.snapshotOf(U, C)), canon({ method: ALT_M, cal: M.calCopy(C.cal), ovGas: ['o2'], ovY: 'area' }));
  /* v578: the windows as edited, pending until Integrate: `edit` beside the method applied, in
     the state only where they differ; a window an edit lacks (or one refused) the method's; no
     edit (a state of before, or none pending), the method's; a stop said let go. */
  assert.ok(!M.isPending(U, C) && C.edit !== C.method, 'the same windows, its own copy');
  /* v581: windows edited on a card with no result of the windows applied (none of its files
     and standards integrated: here its calibration's) applied as they are, nothing to keep; with
     one, pending as v578 made them. */
  assert.equal(M.takeEdit(U, S, C, DEF), true);
  assert.deepEqual([M.isPending(U, C), M.isDefault(U, C.method), C.method !== C.edit], [false, true, true], 'applied, each its own copy');
  C.method = M.clone(ALT_M); C.edit = M.clone(ALT_M);
  S.store.set(M.keyOf(U, C.cal.files[0], ALT_M), [null, null]);
  assert.equal(M.takeEdit(U, S, C, ALT_M), true, 'no chromatogram integrated: none yet');
  C.method = M.clone(ALT_M); C.edit = M.clone(ALT_M);
  S.store.set(M.keyOf(U, C.cal.files[0], ALT_M), [null, { gases: {}, windows: [] }]);
  assert.equal(M.takeEdit(U, S, C, { ...M.clone(DEF), extra: 1 }), false);
  assert.deepEqual([M.isPending(U, C), M.methodKey(U, C.edit) === M.methodKey(U, DEF), 'extra' in C.edit, C.method.windows[0].from], [true, true, false, 270]);
  assert.equal(canon(M.snapshotOf(U, C)), canon({ method: ALT_M, edit: DEF, cal: M.calCopy(C.cal), ovGas: ['o2'], ovY: 'area' }));
  C.stopped = true;
  M.restoreCard(U, S, C, { method: DEF, edit: { windows: [{ key: 'H2O2', from: 270 }] } });
  assert.deepEqual([M.isPending(U, C), C.edit.windows[0].from, C.stopped], [false, 268, false], 'a window refused: the method\'s');
  M.restoreCard(U, S, C, { method: ALT_M, edit: { windows: [{ key: 'H2O2', from: 268, to: 331 }] } });
  assert.deepEqual([M.isPending(U, C), C.method.windows[0].from, C.edit.windows[0].to], [true, 270, 331]);
  M.restoreCard(U, S, C, { method: ALT_M, edit: 'junk' }); assert.equal(M.isPending(U, C), false);
  M.restoreCard(U, S, C, 'junk'); assert.deepEqual([M.isPending(U, C), M.isDefault(U, C.method), C.ovGas, C.ovY], [false, true, 'h2', 'conc']);
  assert.deepEqual(M.methodIn(U, { windows: [{ key: 'H2O2', from: 'x', to: 9 }] }, ALT_M).windows[0].from, 270, 'a base\'s edges where its own are none');
});

test('the results taken in, saved and written into the states that hold their file; what the job integrates', ()=>{
  const all = [ROWS[0](), ROWS[4](), ROWS[7]()], cards = [{ id: 1, type: 'integ' }, { id: 2, type: 'rate' }];
  const { S, card } = instance(all, cards), C = card(cards[0]);
  const kRun = M.keyOf(U, all[0].mate, DEF), kLone = M.keyOf(U, all[1], DEF);
  assert.equal(M.fileKey(U, { name: 'x' }), 'name:x');
  // malformed results dropped; a result held never taken away; a longer array replaces one with none
  M.loadResults(U, S.store, { [kRun]: [null, { gases: {}, windows: [] }, { gases: 1, windows: [] }, 5], [kLone]: 'x', a: [{ gases: { h2: { area: null, trap: 1 } }, windows: [] }] });
  assert.equal(canon(S.store.get(kRun)), canon([null, { gases: {}, windows: [] }, null, null]));
  assert.ok(Number.isNaN(S.store.get('a')[0].gases.h2.area) && !('trap' in S.store.get('a')[0].gases.h2));
  M.loadResults(U, S.store, { [kRun]: [{ gases: {}, windows: [1] }, { gases: { h2: {} }, windows: [] }, null, null] });
  assert.equal(canon(S.store.get(kRun)), canon([{ gases: {}, windows: [1] }, { gases: {}, windows: [] }, null, null]));
  M.loadResults(U, S.store, { [kRun]: [null, null] });
  assert.equal(S.store.get(kRun).length, 4);
  M.loadResults(U, S.store, 'x');
  // saved: only the keys a card uses, with a result
  assert.deepEqual(Object.keys(M.savedResults(U, S)), [kRun]);
  // what is wanted: each file's chromatograms not integrated (the broken file none)
  const w = M.wanted(U, S);
  assert.deepEqual(w.map(g=> [g.key === kRun, g.key === kLone, g.miss]), [[true, false, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]], [false, true, [0, 1, 2]]]);
  assert.equal(M.missing(w), 13);
  assert.deepEqual(M.workOf(S, w[0]).map(Boolean), Array(12).fill(false), 'held, but not one a chromatogram: none');
  S.store.set(kRun, [{ gases: {}, windows: [] }, ...Array(11).fill(null)]);
  const wk = M.workOf(S, w[0]);
  assert.deepEqual([wk.map(Boolean).join(), wk === S.store.get(kRun)], [[true, ...Array(11).fill(false)].join(), false]);
  assert.deepEqual(M.workOf(S, w[1]), [null, null, null]);
  assert.deepEqual(M.resultIn(U, { error: 'no' }), { error: 'no', gases: {}, windows: [] });
  assert.deepEqual(M.resultIn(U, null), { error: 'the integration failed', gases: {}, windows: [] });
  // the job's own results over the store's, while it runs (v578: its files' each)
  S.job = { works: new Map([[kLone, [1]]]) };
  assert.deepEqual([M.resultsAt(S, kLone), M.resultsAt(S, kRun) === S.store.get(kRun), M.status(S).job === S.job, 'soon' in M.status(S)], [[1], true, true, false]);
  S.job = null;
  // the states written into: those holding the file (a row, a pair's mate, a card's calibration)
  const fk = kRun.slice(0, kRun.indexOf('|'));
  const states = [{ files: [all[0]] }, { files: [{ ...all[0].mate }] }, { files: [{ name: 'x' }], cards: [{ cal: { files: [{ rawBytes: BYTES['run_TCD.csv'] }] } }] }, { files: [all[1]] }, 'x', { files: 3, cards: [null, { cal: 5 }] }];
  assert.deepEqual(states.map(s=> M.holds(U, s, fk)), [true, true, true, false, false, false]);
  assert.deepEqual(M.withResult(U, { files: [all[0]], integ: { a: 1 } }, fk, kRun, [2]).integ, { a: 1, [kRun]: [2] });
  assert.equal(M.withResult(U, states[3], fk, kRun, [2]), states[3]);
  // the card's raw chromatograms with its calibration's
  C.cal = M.calIn(U, { files: [{ name: 's', rawBytes: BYTES['standards_TCD.csv'] }] });
  assert.deepEqual(M.tcdRecs(S, C).map(r=> r.name), ['run_TCD.csv', 'lone_TCD.csv', 'broken_TCD.csv', 's']);
  /* v578: the chromatograms in view first (the standard on show, then the card's), each its
     chromatogram on show first, then the rest in list order; a run's windows after the
     method's, every file of the card, a Stop holding the method's alone; what a card has left
     under a method (the store's, a file used twice once). */
  const view = [], two = instance(all, cards), C2 = two.card(cards[0], ()=> view), S2 = two.S;
  C2.cal = C.cal;
  const kStd = M.keyOf(U, C2.cal.files[0], DEF), ks = [kRun, kLone, kStd], alt = r => M.keyOf(U, r, ALT_M), recs = [all[0].mate, all[1], C2.cal.files[0]];
  const W2 = ()=> M.wanted(U, S2).map(g=> [ks.indexOf(g.key) >= 0 ? ks.indexOf(g.key) : 'alt' + recs.findIndex(r=> alt(r) === g.key), g.miss.join()]);
  const all12 = '0,1,2,3,4,5,6,7,8,9,10,11';
  assert.deepEqual(W2(), [[0, all12], [1, '0,1,2'], [2, '0,1,2,3,4,5']]);
  view.push({ rec: C2.cal.files[0], k: 4 }, { rec: all[1], k: 2 }, { rec: all[1], k: 2 });
  assert.deepEqual(W2(), [[2, '4,0,1,2,3,5'], [1, '2,0,1'], [0, all12]], 'in view first, its chromatogram first');
  S2.store.set(kLone, [{ gases: {}, windows: [] }, null, null]);
  C2.run = { m: ALT_M };
  assert.deepEqual(W2(), [[2, '4,0,1,2,3,5'], [1, '2,1'], [0, all12], ['alt2', '4,0,1,2,3,5'], ['alt1', '2,0,1'], ['alt0', all12]], 'the run\'s after');
  C2.halted = true;
  assert.deepEqual(W2().map(g=> g[0]), ['alt2', 'alt1', 'alt0'], 'a Stop holds the method\'s alone');
  assert.deepEqual([M.leftUnder(U, S2, C2, DEF), M.leftUnder(U, S2, C2, ALT_M)], [20, 21]);
  recs.forEach(r=> S2.store.set(alt(r), new Array(M.dataOf(S2, r).cols.length).fill({ gases: {}, windows: [] })));
  assert.deepEqual([M.leftUnder(U, S2, C2, ALT_M), M.wanted(U, S2)], [0, []]);
  C2.cal = M.calIn(U, { files: [C.cal.files[0], { name: 't', rawBytes: BYTES['standards_TCD.csv'] }] });
  assert.equal(M.leftUnder(U, S2, C2, DEF), 20, 'a file used twice counted once');
  // read once per file, by its bytes; a table read so too; primed
  const d = M.dataOf(S, all[0].mate);
  assert.equal(M.dataOf(S, all[0].mate), d);
  assert.deepEqual(M.dataOf(S, { rawBytes: null }), { error: 'its bytes are not stored in this browser any more' });
  assert.match(M.dataOf(S, all[2]).error, /does not increase/);
  const b = new Uint8Array([1]); M.prime(S, b, { t: [], cols: [] }); assert.deepEqual(M.dataOf(S, { rawBytes: b }), { t: [], cols: [] });
  const t = M.tableOf(S, BYTES['standards.csv']);
  assert.deepEqual([t === M.tableOf(S, BYTES['standards.csv']), t.names.length, M.tableOf(S, null), M.tableOf(S, BYTES['nothing.csv']).error.slice(0, 10)], [true, 6, null, 'not a GC t']);
});

/* v581: a Stop holds its own card's files alone (to v580 the instance's `halted`, every card's):
   two Integration cards of other windows, one stopped, the other's files still wanted and its
   job its own; the one stopped said stopped, not running, while the job goes on for the other;
   what Analysis takes of a file under the card stopped says so, under the other not. */
test('a Stop holds its own card\'s files alone (v581)', ()=>{
  const all = [ROWS[0](), ROWS[4]()], cards = [{ id: 1, type: 'integ' }, { id: 2, type: 'integ' }];
  const { S, card } = instance(all, cards), A = card(cards[0]), B = card(cards[1]);
  B.method = M.clone(ALT_M); B.edit = M.clone(ALT_M);
  const keys = ()=> M.wanted(U, S).map(g=> [g.key === M.keyOf(U, g.rec, DEF) ? 'A' : g.key === M.keyOf(U, g.rec, ALT_M) ? 'B' : '?', g.rec.name]);
  assert.deepEqual(keys(), [['A', 'run_TCD.csv'], ['A', 'lone_TCD.csv'], ['B', 'run_TCD.csv'], ['B', 'lone_TCD.csv']]);
  A.halted = true;
  assert.deepEqual(keys(), [['B', 'run_TCD.csv'], ['B', 'lone_TCD.csv']], 'A\'s Stop holds A\'s alone');
  S.job = { total: 15, done: 3, name: 'run_TCD.csv', works: new Map() };
  assert.deepEqual([M.progressOf(U, S, A).state, M.progressOf(U, S, B).state], ['stopped', 'running']);
  assert.deepEqual([M.valuesFor(U, S, A, all[0]).why, M.valuesFor(U, S, B, all[0]).why], ['its integration was stopped before its end', 'its integration is not done yet']);
  S.job = null; A.halted = false; B.halted = true;
  assert.deepEqual(keys(), [['A', 'run_TCD.csv'], ['A', 'lone_TCD.csv']], 'B\'s Stop, B\'s alone');
  assert.deepEqual([M.progressOf(U, S, A).state, M.progressOf(U, S, B).state], ['left', 'stopped']);
  assert.ok(!('halted' in M.status(S)), 'no Stop of the instance\'s');
});

test('the entries, their results and names; the concentrations; what Analysis takes; the suspicious rule', ()=>{
  const all = ROWS.map(f=> f()), cards = [{ id: 1, type: 'integ' }];
  all[8].included = false;
  const { S, card } = instance(all, cards), C = card(cards[0]);
  const es = M.entriesOf(S);
  assert.deepEqual(es.map(e=> [e.name, e.label, e.table ? e.table.name : null, e.twin || null, e.n, e.rows, M.aligned(e)]), [
    ['run_TCD.csv', 'run', 'run.csv', null, 12, 12, true], ['short_TCD.csv', 'short', 'short.csv', null, 11, 12, false], ['mini_TCD.csv', 'mini', 'mini.csv', null, 3, 3, true],
    ['alt_TCD.csv', 'alt', 'alt.txt', null, 5, 5, true], ['lone_TCD.csv', 'lone_TCD', null, null, 3, null, false], ['twinA_TCD.csv', 'twinA_TCD', null, 'twinB_TCD.csv', 2, null, false],
    ['twinB_TCD.csv', 'twinA_TCD · twinB_TCD.csv', null, 'twinA_TCD.csv', 2, null, false], ['end_TCD.csv', 'end_TCD', null, null, 2, null, false],
    ['broken_TCD.csv', 'broken_TCD', null, null, 0, null, false], ['gone_TCD.csv', 'gone <i>', null, null, 0, null, false]]);
  assert.deepEqual([M.fileLabel(es[0]), M.fileTitle(es[0]), M.fileLabel(es[4]), M.fileTitle(es[4]), M.fileLabel(null)], ['run', 'run (run.csv + run_TCD.csv)', 'lone_TCD (no table)', 'lone_TCD (lone_TCD.csv, no table)', '']);
  assert.deepEqual([M.injName(es[0], 2), M.injShort(es[0], 2), M.injName(es[1], 2), M.injShort(es[4], 0), M.clock('x'), M.isoLocal(es[0].table.injDates[1])], ['Injection 3 · 13/11 10:40', '#3 · 13/11 10:40', 'Injection 3', 'Injection 1', '', '2026-11-13 10:20:00']);
  // the selectors stepped, around; what is shown given back
  assert.equal(M.curOf(S, C).name, 'run_TCD.csv');
  assert.ok(M.stepFile(S, C, -1)); assert.equal(C.selName, 'gone_TCD.csv');
  C.selName = 'mini_TCD.csv'; C.selK = 2; assert.ok(M.stepK(S, C, 1)); assert.equal(C.selK, 0);
  assert.deepEqual(M.showsOf(S, C), { file: 'mini_TCD.csv', k: 0 });
  M.showNext(U, C, { file: 'alt_TCD.csv', k: -1 }); assert.deepEqual([C.selName, C.selK], ['alt_TCD.csv', 0]);
  M.showNext(U, C, { file: 3, k: 2 }); M.showNext(U, C, null); M.showNext(U, C, { file: 'lone_TCD.csv', k: 2 }); assert.deepEqual([C.selName, C.selK], ['lone_TCD.csv', 2]);
  // results: none, those of the method applied, never the windows edited (v578: to v577 the
  // method before's, stale, the method changed)
  const R = rng(5), res = resultsFor(R), kMini = M.keyOf(U, all[2].mate, DEF);
  M.loadResults(U, S.store, { [kMini]: MINI_RES });
  assert.equal(M.resOf(U, S, C, all[0].mate).res, null);
  M.takeEdit(U, S, C, ALT_M);
  assert.deepEqual([M.resOf(U, S, C, all[2].mate).res === S.store.get(kMini), M.resOf(U, S, C, all[2].mate).m === C.method, 'stale' in M.resOf(U, S, C, all[2].mate)], [true, true, false]);
  C.method = ALT_M;
  assert.deepEqual([M.resOf(U, S, C, all[2].mate).res, M.resOf(U, S, C, all[2].mate).m], [null, ALT_M]);
  C.method = DEF; C.edit = M.clone(DEF);
  // the suspicious rule: by hand, in %mol (run, the 5th injection 40 % over) and ppm (alt, O₂ at the 3rd half)
  M.loadResults(U, S.store, res);
  const run = es[0], rr = M.resOf(U, S, C, run.tcd).res, J = M.judge(S, run, rr);
  const ratios = rr.map((x, k)=> x && x.gases && x.gases.h2 ? x.gases.h2.area/run.table.gas.h2[k] : NaN).filter(Number.isFinite).sort((a, b)=> a - b);
  const kH = ratios.length % 2 ? ratios[(ratios.length - 1)/2] : (ratios[ratios.length/2 - 1] + ratios[ratios.length/2])/2;
  near(J.prop.h2.k, kH, 1e-12, 'k, the median of area/table');
  rr.forEach((x, k)=>{
    if (!x || typeof x.error === 'string') return;
    const want = kH*run.table.gas.h2[k], off = Math.abs(x.gases.h2.area - want) > Math.max(0.1*want, kH*0.0015);
    assert.equal(J.off(k, 'h2') != null, off, 'injection ' + k);
    assert.equal(J.bad(k, 'h2'), off || M.fitMarks(x, 'h2').length > 0);
  });
  assert.ok(J.off(4, 'h2') > 0.3 && J(4).some(s=> /^H₂: \+\d+\.\d % off the GC table's proportion \(k = /.test(s)));
  const alt = es[3], ja = M.judge(S, alt, M.resOf(U, S, C, alt.tcd).res);
  assert.ok(ja.off(2, 'o2') < -0.4 && ja.bad(2) && !ja.bad(2, 'h2') === (M.fitMarks(M.resOf(U, S, C, alt.tcd).res[2], 'h2').length === 0));
  assert.deepEqual(M.judge(S, es[4], null)(0), []);
  // the rule's edges: 10.5 % off marked, 9.5 % not; a table value so small that k × 15 ppm is the floor
  const at = { ...es[0], table: { ...es[0].table, gas: { h2: [0.1, 0.1, 0.1, 0.1, 0.1, 0.0001, ...Array(6).fill(0.1)] } } };
  const ar = [1000, 1000, 1000, 1105, 950, 9, 1000, 1000, 1000, 1000, 1000, 1000].map(A=> ({ gases: { h2: { area: A, window: 'H2O2' } }, windows: [{ key: 'H2O2', chi2r: 1 }] }));
  const jb = M.judge(S, at, ar);
  assert.deepEqual([jb.prop.h2.k, jb.off(3, 'h2'), jb.off(4, 'h2'), jb.off(5, 'h2'), jb.bad(3), jb.bad(4)], [10000, 0.105, null, null, true, false]);
  // the fit's own marks
  assert.deepEqual(M.fitMarks({ error: 'x' }), ['not integrated: x']);
  assert.deepEqual(M.fitMarks({ gases: { h2: { window: 'A' } }, windows: [{ key: 'A', chi2r: 5.234, restarted: true, ok: false }, { key: 'B', beyondData: true, ok: false }] }),
    ['χ²ᵣ 5.23, above 4 (after a restart)', 'the fit did not converge', 'the chromatogram ends before its window does: not fitted']);
  assert.deepEqual(M.fitMarks({ gases: { h2: { window: 'A' } }, windows: [{ key: 'A', chi2r: 2 }, { key: 'B', chi2r: 9 }] }, 'h2'), []);
  assert.deepEqual([M.fitMarks(null), M.fitMarks({ windows: 'x' })], [[], []]);
  // concentrations: no standards, the software's scale for the run (12 injections), none for mini (3)
  const conv = M.convAll(U, S, C, run, rr);
  assert.equal(conv.h2.how, 'transfer'); near(conv.h2.f(1000), 1000/conv.h2.k, 1e-15, 'A/k');
  assert.match(M.convAll(U, S, C, es[2], M.resOf(U, S, C, es[2].tcd).res).h2.why, /too few injections above the threshold/);
  assert.match(M.convAll(U, S, C, es[4], []).o2.why, /^no standards for O₂, and no GC table for the GC software's scale \(k\)$/);
  // the standards: their names (Analysis, its number where blank, a column without a table), rows and lines, in %mol and ppm
  C.cal = M.calIn(U, { files: [{ name: 'standards_TCD.csv', rawBytes: BYTES['standards_TCD.csv'], table: { name: 'standards.csv', rawBytes: BYTES['standards.csv'] },
    levels: [{ h2: 0.05 }, { h2: 0.1 }, { h2: 0.2 }, { o2: 0.02 }, { o2: 0.05 }, { o2: 0.1, on: false }] }, { name: 'old (1)_TCD.csv', rawBytes: BYTES['old (1)_TCD.csv'], levels: [] }] });
  const rows = M.calRows(U, S, C);
  assert.deepEqual(rows.map(x=> x.name), ['cal_H2_0.05%_001', 'cal_H2_0.1%_001', 'cal_H2_0.2%_001 <b>&', 'cal_O2_0.02%_001', 'injection 5', 'cal_O2_0.1%_001 and a long remark', 'column 1', 'column 2', 'column 3', 'column 4']);
  assert.equal(M.fullName(rows[1]), 'cal_H2_0.1%_001 (standards.csv, standards_TCD.csv, column 2)');
  assert.equal(M.fullName(rows[6]), 'column 1 (old (1)_TCD.csv, column 1)');
  const L = M.calFit(U, S, C, 'h2'), pts = rows.slice(0, 3).map(x=> ({ conc: x.lv.h2, area: x.r.gases.h2.area }));
  const mx = pts.reduce((s, p)=> s + p.conc, 0)/3, my = pts.reduce((s, p)=> s + p.area, 0)/3;
  const slope = pts.reduce((s, p)=> s + (p.conc - mx)*(p.area - my), 0)/pts.reduce((s, p)=> s + (p.conc - mx)**2, 0);
  near(L.slope, slope, 1e-9, 'slope'); near(L.intercept, my - slope*mx, 1e-9, 'intercept');
  assert.equal(M.calFit(U, S, C, 'o2').n, 2);
  const cv = M.convOf(U, S, C, 'h2', [], null); near(cv.f(5000), (5000 - L.intercept)/L.slope, 1e-12, 'a concentration');
  C.cal.unit = 'ppm'; near(M.convOf(U, S, C, 'h2', [], null).f(5000), (5000 - L.intercept)/L.slope/1e4, 1e-12, 'ppm → %mol');
  C.cal.zero.h2 = true; assert.equal(M.calFit(U, S, C, 'h2').intercept, 0);
  C.cal.unit = '%mol'; C.cal.zero.h2 = false;
  assert.equal(M.calPoints(U, S, C, 'o2').length, 2);
  assert.equal(M.stdsLeft(U, S, C), res[M.keyOf(U, { rawBytes: BYTES['old (1)_TCD.csv'] }, DEF)] ? 0 : 4);
  // what Analysis takes: the standards' line for H₂ and O₂; none for a table alone; a count that differs; waiting; stopped; kept
  const v = M.valuesFor(U, S, C, all[0]);
  assert.deepEqual([v.how.h2, v.how.o2, Object.isFrozen(v.gas.h2) || Array.isArray(v.gas.h2)], ['cal', 'cal', true]);
  assert.equal(M.valuesFor(U, S, C, all[0]), v, 'kept while nothing changes');
  near(v.gas.h2[1], M.convOf(U, S, C, 'h2', [], null).f(v.areas.h2[1]), 1e-12, 'a sample\'s H₂');
  assert.equal(M.valuesFor(U, S, C, all[8]), null);
  assert.deepEqual(M.valuesFor(U, S, C, all[1]), { why: '12 injections in the table, 11 chromatograms', integ: true });
  C.method = ALT_M;
  assert.deepEqual(M.valuesFor(U, S, C, all[0]), res[M.keyOf(U, all[0].mate, ALT_M)] ? M.valuesFor(U, S, C, all[0]) : { why: 'its integration is not done yet', waiting: true });
  C.halted = true; if (!res[M.keyOf(U, all[0].mate, ALT_M)]) assert.equal(M.valuesFor(U, S, C, all[0]).why, 'its integration was stopped before its end');
  C.halted = false; C.method = DEF;
  C.cal = M.calIn(U, null);
  const vt = M.valuesFor(U, S, C, all[0]);
  assert.deepEqual([vt.how, Object.keys(vt.k)], [{ h2: 'transfer', o2: 'transfer' }, ['h2', 'o2']]);
  const vm = M.valuesFor(U, S, C, all[2]);
  assert.deepEqual([vm.how, vm.gas.h2 === all[2].gas.h2], [{ h2: 'table', o2: 'table' }, true]);
  assert.match(vm.why.h2, /too few injections/);
});

test('what the plots draw: the chromatogram over its residuals, the run overview, the point nearest the pointer', ()=>{
  const all = [ROWS[2](), ROWS[0](), ROWS[4]()], cards = [{ id: 1, type: 'integ' }];
  const { S, card } = instance(all, cards), C = card(cards[0]);
  M.loadResults(U, S.store, { [M.keyOf(U, all[0].mate, DEF)]: MINI_RES });
  const es = M.entriesOf(S), e = es[0];
  assert.deepEqual([M.span(DEF), M.range(DEF)], [[268, 326], [258, 341.6]]);
  assert.deepEqual(M.intrusions(DEF), []);
  assert.deepEqual(M.intrusions(M.methodIn(U, { windows: [{ key: 'H2O2', from: 264, to: 331 }] })).length, 2);
  assert.equal(M.tooShort(M.methodIn(U, { windows: [{ key: 'H2O2', from: 300, to: 304 }] })).key, 'H2O2');
  assert.equal(M.tooShort(DEF), undefined);
  assert.deepEqual([M.edgeAt(270.11), M.edgeAt(264.05), M.snap(1.31)], [270.2, 264.0, 1.4000000000000001]);
  // the panels' shared edge: a tick's number moved off it
  const [a0] = M.offEdge(U, -0.01, 10, -1, 0.03), [, b1] = M.offEdge(U, -10, 10.05, 1, 0.1);
  assert.ok(a0 < -0.01 && b1 > 10, [a0, b1].join());
  assert.deepEqual(M.offEdge(U, 1, 1, 1, 0.1), [1, 1]);
  // a chromatogram with its curves: the clean one, the spike, the glitch zone
  const D = M.chromOf(U, { d: e.d, k: 1, R: M.resOf(U, S, C, e.tcd) }, DEF);
  assert.deepEqual([D.fail, D.lo, D.hi, D.tt.length, D.curves.length, D.c0 < D.c1], [undefined, 258, 341.6, 451, 1, true]);
  const items = [[M.C_RAW, 'raw', '']], pc = { ci: 0 }, lines = M.peakLines(S, D.curves[0].wr, D.curves[0].c, items, pc);
  assert.deepEqual(lines.map(l=> [l.name, l.col, l.dash]), [['H2', GASES[0].color, undefined], ['O2', GASES[1].color, undefined], ['S310', M.PEAK_COLORS[0], '2,3']]);
  assert.equal(lines[0].y[100], D.curves[0].c.peaks.H2[100] + D.curves[0].c.base[100]);
  const dr = M.droppedOf(D.curves), ext = M.chromOf(U, { d: e.d, k: 2, R: M.resOf(U, S, C, e.tcd) }, DEF);
  assert.ok(dr.sp.x.includes(287.4), 'the spike left out');
  assert.ok(M.droppedOf(ext.curves).ex.x.length > 0 || M.bandsOf(ext.curves).length > 0, 'the glitch zone');
  assert.deepEqual(M.legendItems(items, D.curves, dr).map(x=> x[1]), ['raw', 'model', 'baseline (with its step)', 'H2', 'O2', 'S310', 'spike left out', 'fit window']);
  const rs = M.residOf(U, D.curves);
  assert.ok(rs.rx.length > 200 && rs.r0 < 0 && rs.r1 > 0);
  assert.deepEqual([M.chromOf(U, { d: null }, DEF).fail, M.chromOf(U, { d: { error: 'x' } }, DEF).fail], ['read', 'read']);
  assert.equal(M.chromOf(U, { d: { t: [1, 2], cols: [[1, 2]] }, k: 0 }, DEF).fail, 'empty');
  const none = M.chromOf(U, { d: e.d, k: 0, R: null }, DEF);
  assert.deepEqual([none.r, none.curves, none.R], [null, [], { res: null, m: DEF }]);
  // the overview: H₂ against the time (mini: no k, area), O₂, a gas that is none; the run: its injections' numbers when no table
  C.ovY = 'conc';
  const O = M.overviewOf(U, S, C, e);
  assert.deepEqual([O.g, O.mode, O.xs, O.ylabel, O.table.length, O.bad.length], ['h2', 'area', [0, 1/3, 2/3], 'H₂ area', 3, 3]);
  near(O.table[1], O.tv[1]*M.judge(S, e, MINI_RES).prop.h2.k, 1e-15, 'the table\'s value as area, times k');
  assert.deepEqual(O.pts.map(q=> q.k), [0, 1, 2]);
  assert.deepEqual(O.look(1).slice(0, 2), ['Injection 2 · 15/11 10:20', `fit: ${M.sig(MINI_RES[1].gases.h2.area, 5)}`]);
  assert.equal(O.look(0)[O.look(0).length - 1].slice(0, 4), 'χ²ᵣ:');
  C.ovGas = 'co2'; assert.equal(M.overviewOf(U, S, C, e).g, 'h2');
  C.ovGas = 'o2'; C.ovY = 'area'; assert.equal(M.overviewOf(U, S, C, es[2]).xs.join(), '1,2,3');
  const P = { xmin: 0, xmax: 10, px: x => x*10, py: y => 100 - y };
  assert.deepEqual([M.nearest(P, [{ k: 0, x: 1, y: 50 }, { k: 4, x: 2, y: 52 }], 19, 49), M.nearest(P, [{ k: 0, x: 1, y: 50 }], 40, 40), M.nearest(P, [{ k: 0, x: 11, y: 50 }], 110, 50)], [4, -1, -1]);
  assert.equal(M.tint('#3aa0ff', 0.4), 'rgb(137,198,255)');
  assert.deepEqual([M.tint(S.C_FIT, M.OV_HL_TINT), M.tint(M.C_BAD, M.OV_HL_TINT), +((M.OV_R + 0.5)*M.OV_HL_R).toFixed(3)], ['rgb(137,198,255)', 'rgb(255,137,137)', 5.55], 'a point hovered: lighter, half again as large');
  // Peaks: the values of the chromatogram on show
  C.selName = e.name; C.selK = 1;
  const pv = M.peaksOf(U, S, C, e);
  assert.deepEqual([pv.gs, pv.units, pv.tUnit, pv.rows.length, pv.aligned], [['h2', 'o2'], [], '%mol', 2, true]);
  assert.deepEqual([M.peaksOf(U, S, C, null), M.peaksOf(U, S, C, es[2]), M.peaksOf(U, S, C, { d: { error: 'x' } })], [null, { wait: true }, null]);
});

test('the status, the alerts\' facts, the CSVs; the calibration window\'s files dropped, paired and named, a level as typed', ()=>{
  const all = [ROWS[0](), ROWS[1](), ROWS[5](), ROWS[4](), ROWS[7]()], cards = [{ id: 1, type: 'integ' }];
  const { S, card } = instance(all, cards), C = card(cards[0]);
  // the status line in every state
  const st = ()=> M.progressOf(U, S, C).state;
  assert.equal(st(), 'left');
  C.halted = true; assert.equal(st(), 'stopped'); C.halted = false;
  S.failed = 'x'; assert.equal(st(), 'failed'); S.failed = '';
  S.job = { total: 3, done: 1, name: 'a' }; assert.deepEqual([st(), M.progressOf(U, S, C).pct], ['running', 33]); S.job = null;
  const R = rng(3), res = resultsFor(R);
  for (const name of ['run_TCD.csv', 'short_TCD.csv', 'twinA_TCD.csv', 'twinB_TCD.csv', 'lone_TCD.csv']){ const k = M.keyOf(U, { rawBytes: BYTES[name] }, DEF); res[k] = madeUp(R, Array.from({ length: name === 'run_TCD.csv' ? 12 : name === 'short_TCD.csv' ? 11 : name === 'lone_TCD.csv' ? 3 : 2 }, ()=> [4000, 400])); }
  M.loadResults(U, S.store, res);
  assert.equal(st(), 'done');
  const noneS = instance([], cards); assert.equal(M.progressOf(U, noneS.S, noneS.card(cards[0])).state, 'none');
  /* v578: the windows edited (pending: the method applied named); a job going on is this card's
     only while it has its run or its files left; a run stopped with the windows still edited;
     a failure said where something is left or edited. */
  M.takeEdit(U, S, C, ALT_M);
  let x = M.progressOf(U, S, C);
  assert.deepEqual([x.state, x.pending, x.left, x.m === C.method], ['pending', true, 0, true]);
  S.job = { total: 4, done: 3, name: 'b' }; assert.equal(st(), 'pending', 'another card\'s job');
  C.run = { m: ALT_M }; x = M.progressOf(U, S, C); assert.deepEqual([x.state, x.pct], ['running', 75]);
  C.run = null; S.job = null; C.stopped = true; assert.equal(st(), 'stopped');
  C.halted = true; S.failed = 'x'; assert.equal(st(), 'failed');
  C.edit = M.clone(C.method); assert.equal(st(), 'done', 'nothing left, nothing edited: no failure said, no stop');
  C.halted = false; S.failed = ''; C.stopped = false;
  // the alerts' facts: unreadable, a count that differs, two raw chromatograms paired, alone; transfer
  const f = M.alertFacts(U, S, C);
  // (v567: the GC software's scale is said by the Production Rate cards, gc-html.js srcAlertsHtml)
  assert.deepEqual([f.errs.map(e=> e.name), f.warn.map(w=> [w.kind, w.e.name]), f.transfer], [['broken_TCD.csv'], [['rows', 'short_TCD.csv'], ['twin', 'twinA_TCD.csv'], ['twin', 'twinB_TCD.csv'], ['alone', 'lone_TCD.csv']], undefined]);
  // integration.csv: every chromatogram's values; chromatogram.csv: the whole chromatogram, the model blank outside its window
  // (each row ending with the windows applied, v578: never those edited)
  const es = M.entriesOf(S), csv = M.integrationCsv(U, S, C, es).split('\n');
  assert.equal(csv[0], 'File;Table;Injection;Injection date;H2 area;H2 area sd;H2 apex (s);H2 chi2r;H2 (%mol);H2 source;H2 table (%mol);H2 suspicious;O2 area;O2 area sd;O2 apex (s);O2 chi2r;O2 (%mol);O2 source;O2 table (%mol);O2 suspicious;Flags;H2O2 window from (s);H2O2 window to (s)');
  assert.equal(csv.length, 1 + 12 + 11 + 2 + 2 + 3 + 1);
  assert.match(csv[1], /^run_TCD\.csv;run\.csv;1;2026-11-13 10:00:00;\d+\.\d{6};\d+\.\d{6};287\.\d{3};.*;268\.00;326\.00$/);
  assert.ok(csv.some(l=> /transfer \(k = /.test(l)));
  M.takeEdit(U, S, C, ALT_M);
  assert.equal(M.integrationCsv(U, S, C, es), csv.join('\n'), 'windows edited: the same, the windows applied');
  C.edit = M.clone(C.method);
  const mini = instance([ROWS[2]()], cards), Cm = mini.card(cards[0]);
  M.loadResults(U, mini.S.store, { [M.keyOf(U, mini.S.ctx.all[0].mate, DEF)]: MINI_RES });
  const em = M.entriesOf(mini.S)[0], D = M.chromOf(U, { d: em.d, k: 0, R: M.resOf(U, mini.S, Cm, em.tcd) }, DEF);
  const cc = M.chromCsv(U, { t: D.tt, y: D.yy, curves: D.curves, m: D.R.m }).split('\n');
  assert.equal(cc[0], 'Time (s);TCD signal;model H2O2;baseline H2O2;H2 (on the baseline);O2 (on the baseline);S310 (on the baseline);residual H2O2;H2O2 window from (s);H2O2 window to (s)');
  assert.equal(cc.length, 451 + 2);
  assert.match(cc[1], /^250\.0000;-?\d+\.\d{6};;;;;;;268\.00;326\.00$/);
  // the calibration window: a file told by what it holds
  const T = M.takeDropped(S, 'x_TCD.csv', BYTES['standards_TCD.csv']), Tb = M.takeDropped(S, 'b.csv', BYTES['broken_TCD.csv']);
  assert.deepEqual([T.kind, T.d.cols.length, Tb.bad, M.takeDropped(S, 'n.csv', BYTES['notext.csv']).bad, M.takeDropped(S, 'h.csv', BYTES['nothing.csv']).bad.slice(0, 40), M.takeDropped(S, 's.csv', BYTES['standards.csv']).kind],
    ['tcd', 6, 'b.csv: raw chromatograms that cannot be read: The time does not increase at line 2 (1 s).', 'n.csv: neither raw chromatograms nor a GC table: no injection date and H₂ or O₂ column under a header.', 'h.csv: neither raw chromatograms nor a G', 'table']);
  const take = names => names.map(n=> M.takeDropped(S, n, new Uint8Array(BYTES[n])));
  // a lone file waits; its partner pairs it; counts that differ refused; already loaded; an old calibration named, a count that differs for it
  let cal = M.calIn(U, null), bad = [], P = M.pairDropped(S, cal, [], take(['standards_TCD.csv']), bad);
  assert.deepEqual([P.add.length, P.held.map(x=> x.name), bad], [0, ['standards_TCD.csv'], ['standards_TCD.csv: raw chromatograms without their GC table: drop the table too, the same name without _TCD (.csv or .txt); this file waits here for it.']]);
  bad = []; P = M.pairDropped(S, cal, P.held, take(['standards.csv', 'stds2.csv', 'stds2_TCD.csv', 'old.csv']), bad);
  assert.deepEqual([P.add.map(f=> [f.name, f.table.name, f.levels.length]), P.held.map(x=> x.name)], [[['standards_TCD.csv', 'standards.csv', 6]], ['old.csv']]);
  assert.deepEqual(bad, ['stds2.csv + stds2_TCD.csv: 5 injections in the table, 6 chromatograms: they must be as many, a name for each chromatogram: nothing integrated.',
    'old.csv: a GC table without its raw chromatograms: drop them too, the same name with _TCD; this file waits here for them.']);
  assert.ok(S.read.has(P.add[0].rawBytes), 'its read primed');
  cal = M.calWith(cal, P.add, P.named);
  cal.files.push({ name: 'old (1)_TCD.csv', rawBytes: BYTES['old (1)_TCD.csv'], levels: [] });
  bad = []; P = M.pairDropped(S, cal, [], take(['old (2).csv', 'standards.csv']), bad);
  // (v567: those loaded already apart, an info of their own)
  assert.deepEqual([bad, P.dup], [['old (2).csv + old (1)_TCD.csv: 3 injections in the table, 4 chromatograms: they must be as many, a name for each chromatogram: nothing integrated.'], ['standards.csv']]);
  bad = []; P = M.pairDropped(S, cal, [], take(['old.csv']), bad);
  assert.deepEqual([P.named.map(x=> [x.fi, x.table.name]), bad], [[[1, 'old.csv']], []]);
  const named = M.calWith(cal, P.add, P.named);
  assert.deepEqual([named.files[1].table.name, cal.files[1].table], ['old.csv', undefined]);
  // a level as typed
  assert.deepEqual(['0,05', ' 0.2 ', '', '-1', 'x', '0', '1e-2'].map(M.levelIn).map(String), ['0.05', '0.2', 'null', 'NaN', 'NaN', '0', '0.01']);
  // a thumbnail; a gas's line and its levels
  const d = M.dataOf(S, { rawBytes: BYTES['standards_TCD.csv'] });
  assert.equal(M.thumbPoints(d, 0, 258, 341.6, 72, 22).split(' ').length, 206, 'every other point, 258 s to 340 s');
  assert.equal(M.thumbPoints({ t: [1, 2], cols: [[1, NaN]] }, 0, 0, 3, 72, 22), '');
  C.cal = named; C.cal.files[0].levels = [{ h2: 0.05, o2: null, on: true }, { h2: 0.1, o2: null, on: true }, { h2: 0.1, o2: null, on: true }, { h2: null, o2: 0.02, on: true }, { h2: null, o2: null, on: true }, { h2: null, o2: 0.1, on: true }];
  M.loadResults(U, S.store, { [M.keyOf(U, { rawBytes: BYTES['standards_TCD.csv'] }, DEF)]: madeUp(rng(9), STD.map(([h, o])=> [h*S_H2, o*S_O2])) });
  const Gh = M.calGasOf(U, S, C, 'h2'), lv = M.levelsOf(Gh.L);
  assert.deepEqual([Gh.xs, lv.map(([c, rs])=> [c, rs.length])], [[0.05, 0.1, 0.1], [['0.05', 1], ['0.1', 2]]]);
  assert.deepEqual(M.calGasOf(U, S, C, 'co2'), { L: null, pts: [] });
});

test('the markup: the instructions, the card\'s and the window\'s bodies, Windows, Peaks, the status, the alerts, the legends, the window\'s rows and lines, every name escaped', ()=>{
  const info = H.integInfo(PAGE.cardInfo(false, false));
  assert.ok(info.startsWith('The <b>Integration</b> card integrates again') && info.includes('<h4 class="instr-math-head">From the area to the concentration</h4>') && info.endsWith(PAGE.cardInfo(false, false)));
  assert.ok(H.CAL_INFO.startsWith('The standards come as a pair'));
  const body = H.cardHtml(HU, 'gc7');
  // (v578: Integrate, its words and progress, under Peaks over Calibration…; no status bar over the card)
  for (const id of ['gc7Status', 'gc7ProgWrap', 'gc7ProgBar', 'gc7Integrate', 'gc7Alerts', 'gc7Notice', 'gc7FileIdx', 'gc7Chrom', 'gc7Resid', 'gc7ChromLegend', 'gc7InjIdx', 'gc7Over', 'gc7OverLegend', 'gc7Method', 'gc7Values', 'gc7Cal']) assert.ok(body.includes(`id="${id}"`), id);
  assert.ok(body.includes('class="txt-mini param-head aligned cap-title gci-head gci-win-head"') && !/gc7(Bar|Run|Stop)"/.test(body));
  const at = id => body.indexOf(`id="${id}"`);
  assert.ok(at('gc7Values') < at('gc7Status') && at('gc7Status') < at('gc7ProgWrap') && at('gc7ProgWrap') < at('gc7Integrate') && at('gc7Integrate') < at('gc7Cal'), 'under Peaks, over Calibration…');
  assert.ok(body.includes('<div id="gc7Status" class="txt-meta rv-status gci-status" role="status"></div>') && body.includes('<div id="gc7ProgWrap" class="rv-prog" style="display:none"><div id="gc7ProgBar"></div></div>')
    && body.includes('<div class="rv-btns"><button type="button" class="btn gci-integ" id="gc7Integrate">Integrate</button></div>'), 'the Rietveld card\'s component');
  const cal = H.calHtml(HU, 'gc7');
  for (const s of ['id="gc7CalTitle"', 'id="gc7CalChrom"', 'id="gc7CalResid"', 'id="gc7CalLegend"', '<option value="%mol">%mol</option><option value="ppm">ppm</option>', 'gci-cal-levels', 'id="gc7CalStatus" class="txt-meta rv-status gci-cal-status"', 'id="gc7CalIntegrate"']) assert.ok(cal.includes(s), s);
  assert.ok(cal.indexOf('gci-cal-levels') < cal.indexOf('id="gc7CalIntegrate"'), 'under the standards\' table');
  const gasOf = M.gasTable(U, GASES).gasOf;
  const m = M.methodIn(U, { windows: [{ key: 'H2O2', from: 264, to: 331 }] });
  const mh = H.methodHtml(HU, gasOf, { ...m, windows: [{ ...m.windows[0], key: 'K<b>', peaks: m.windows[0].peaks.map(pk=> pk.gas ? pk : { ...pk, name: 'S<1>' }) }] }, [{ w: { key: 'a <i>', from: 1, to: 2 }, z: { name: 'z', from: 1, to: 2 } }]);
  // (v571: the windows' intrusions a compact warning, G08; a window not taken its rule in red
  // under it, C19 and G11; v578: a window named by its gases, H₂-O₂, its gases' peaks too, the
  // others as they are)
  assert.ok(mh.includes('<span class="gci-win-name">H₂-O₂ fit</span>') && mh.includes('aria-label="H₂-O₂ window from (s)"') && mh.includes('aria-label="H₂-O₂ window to (s)"') && mh.includes('value="264"')
    && mh.endsWith('<div class="alert warn compact gci-flag">⚠ The a &lt;i&gt; window (1–2 s) reaches z (1–2 s), which its model has no peak for: the fit degrades there.</div>'), mh);
  /* v581: the window's red rule and its edge in a neighbour named as Windows names it (H₂-O₂),
     not by its key (H2O2); a window of no gas by its key. */
  const ins = M.intrusions(m), wh = H.methodHtml(HU, gasOf, m, ins);
  assert.deepEqual([ins.length, ins.every(x=> x.w === m.windows[0])], [2, true]);
  assert.ok(ins.every(x=> wh.includes(H.intrusionText(gasOf, x))) && wh.includes('⚠ The H₂-O₂ window (264–331 s) reaches ') && !wh.includes('H2O2'), wh);
  assert.equal(H.tooShortText(gasOf, m.windows[0]), 'The H₂-O₂ window must start at least 5 s before it ends.');
  assert.equal(H.intrusionText(gasOf, { w: { key: 'K', from: 1, to: 9 }, z: { name: 'Z', from: 2, to: 3 } }), 'The K window (1–9 s) reaches Z (2–3 s), which its model has no peak for: the fit degrades there.');
  assert.ok(mh.includes('H₂ 287.3 · O₂ 302.3 · S&lt;1&gt; 310.2') && !mh.includes('field-rule'), mh);
  const nogas = H.methodHtml(HU, gasOf, { windows: [{ key: 'K<b>', from: 1, to: 9, peaks: [{ name: 'X2', t: 3 }] }] }, []);
  assert.ok(nogas.includes('<span class="gci-win-name">K&lt;b&gt; fit</span>') && nogas.includes('X2 3.0'), 'no gas: its key, its peaks as they are');
  const refused = H.methodHtml(HU, gasOf, m, [], { wi: 0, text: H.tooShortText(gasOf, { key: 'K<b>' }) });
  assert.ok(refused.endsWith('</div><p class="field-rule gci-win-rule" role="alert">The K&lt;b&gt; window must start at least 5 s before it ends.</p>') && !refused.includes('alert warn'), refused);
  assert.equal(H.methodHtml(HU, gasOf, m, [], { wi: 1, text: 'x' }).includes('field-rule'), false, 'the rule under its own window');
  // Peaks
  assert.equal(H.valuesHtml(HU, gasOf, null), '');
  assert.equal(H.valuesHtml(HU, gasOf, { wait: true }), '<p class="txt-meta">Not integrated yet.</p>');
  assert.equal(H.valuesHtml(HU, gasOf, { error: 'a <b>' }), '<div class="alert warn compact gci-flag">⚠ Not integrated: a &lt;b&gt;</div>');
  const conv = { h2: { how: 'transfer', k: 41234.567, n: 12, f: A => A }, o2: { why: 'none <x>' } };
  const vh = H.valuesHtml(HU, gasOf, { R: {}, conv, gs: ['h2'], unitOf: ()=> '%mol', units: ['%mol'], tUnit: '%mol', aligned: true, keys: ['h2', 'o2'], fl: ['χ²ᵣ <9>'],
    rows: [{ g: 'h2', x: { area: 1234.5678, sd: 2.345, tApex: 287.345, chi2r: 5.5 }, shown: 0.123456, tShown: 0.12, off: true }] });
  assert.ok(vh.includes('<td class="gci-bad" title="Out of proportion with the GC table">1234.6 ± 2.3</td>') && vh.includes('<td>287.35</td><td class="gci-bad">5.50</td><td>0.1235</td><td>0.1200</td>'));
  assert.ok(vh.includes('Conc. and GC table in %mol.') && vh.includes('Concentration from the GC software\'s scale (k): k = 41235 area per %mol (H<sub>2</sub>, median of 12 injections).'));
  // (v571: suspicious, a compact warning, G08; the previous method's said by the notice alone, G10)
  assert.ok(vh.includes('<div class="alert warn compact gci-flag">⚠ Suspicious: χ²ᵣ &lt;9&gt;</div>') && vh.endsWith('O₂: none &lt;x&gt;.</p>') && !vh.includes('previous method'));
  // the status, the alerts, the notices, the legends
  const st = { job: { done: 2, total: 5, name: 'a<b>' }, failed: 'f<x>' };
  // (v578: the words alone, the progress Integrate's own bar, utils.js runProgress; to v577 a bar in the line)
  assert.equal(H.statusHtml(HU, gasOf, { st, state: 'running', pct: 40 }), '<span>Integrating… 2 / 5 chromatograms · a&lt;b&gt;</span>');
  // (v571: a run that failed, a compact error, C17; v578: windows edited, the ones the results
  // come from named, facts alone (R1–R4); a Stop says what is left and what is edited)
  const ed = { st, m, pending: true };
  assert.deepEqual(['failed', 'stopped', 'left', 'done', 'none'].map(s=> H.statusHtml(HU, gasOf, { st, left: 1, state: s })), ['<div class="alert bad compact">✕ The integration failed: f&lt;x&gt;.</div>', '<span>Stopped: 1 chromatogram not integrated.</span>',
    '<span>1 chromatogram to integrate.</span>', '', '<span class="txt-meta">No raw chromatograms (TCD) loaded: drop them beside their tables.</span>']);
  assert.deepEqual([H.statusHtml(HU, gasOf, { ...ed, state: 'pending', left: 0 }), H.statusHtml(HU, gasOf, { ...ed, state: 'stopped', left: 0 }), H.statusHtml(HU, gasOf, { ...ed, state: 'stopped', left: 3 }, ' of the standards')],
    ['<span>The results shown come from H₂-O₂ fit 264–331 s, not from these windows.</span>', '<span>Stopped: the results shown come from H₂-O₂ fit 264–331 s, not from these windows.</span>',
      '<span>Stopped: 3 chromatograms of the standards not integrated; the results shown come from H₂-O₂ fit 264–331 s, not from these windows.</span>']);
  assert.ok(['pending', 'stopped', 'left', 'running'].every(s=> !/[!—]|v\d{3}/.test(H.statusHtml(HU, gasOf, { ...ed, state: s, left: 2 }))), 'R4: no "!", no "—", no version');
  assert.equal(H.windowsText(gasOf, { windows: [{ key: 'A<', from: 1, to: 2 }, m.windows[0]] }), 'A< fit 1–2 s, H₂-O₂ fit 264–331 s');
  // Integrate's tooltip, every state
  assert.deepEqual([{ state: 'running' }, { state: 'pending', pending: true }, { state: 'stopped', left: 2 }, { state: 'done' }].map(H.integrateTitle), ['Stop the integration: what is shown stays as it is',
    'Integrate every file and standard with the windows as edited: all of it changes at once when they are done', 'Integrate the chromatograms not integrated yet', 'Every chromatogram is integrated with these windows']);
  const e = { label: 'L<b>', rows: 3, n: 1, tcd: { name: 't<i>' }, twin: 'w&', d: { error: 'e<>' } };
  const ah = H.alertsHtml(HU, gasOf, { errs: [e], warn: [{ kind: 'rows', e }, { kind: 'twin', e }, { kind: 'alone', e }, { kind: 'out', e, g: 'o2', out: 2, n: 5, lo: 0.02, hi: 0.1, below: true, L: { intercept: -123.456 } }] });
  for (const s of ['t&lt;i&gt;: e&lt;&gt;', 'L&lt;b&gt;: 3 injections in the table, 1 chromatogram: not aligned: integrated all the same; Analysis uses the table alone.',
    'L&lt;b&gt;: 2 of 5 injections\' O<sub>2</sub> outside the standards\' range (0.02–0.1 %mol): extrapolated, below the lowest standard, where the intercept (-123.5) weighs most.']) assert.ok(ah.includes(s), s);
  // (v567: raw chromatograms with no table, or paired with raw chromatograms, a grey line here; to
  // check under the drop zone; the GC software's scale said by the Production Rate cards)
  assert.ok(ah.endsWith('<p class="txt-meta gci-shown">L&lt;b&gt;: shown here, no injection times.</p><p class="txt-meta gci-shown">L&lt;b&gt;: shown here, no injection times.</p>') && !ah.includes('(t&lt;i&gt;, w&amp;)') && !ah.includes('software'), ah);
  assert.equal(H.alertsHtml(HU, gasOf, { errs: [], warn: [] }), '');
  // (v571: the card's boxes compact, with no ×, G07)
  assert.ok(ah.startsWith('<div class="alert bad compact">✕ Raw chromatograms that could not be read:<br>t&lt;i&gt;: e&lt;&gt;</div><div class="alert warn compact">⚠ Raw chromatograms to check:<br>') && !ah.includes('alert-dismiss'), ah);
  assert.deepEqual(['The integration failed', 'The integration worker failed.', 'out of memory', '', null].map(H.failedText),
    ['The integration failed.', 'The integration worker failed.', 'The integration failed: out of memory.', 'The integration failed.', 'The integration failed.']);
  const o = { d: { error: 'bad<' }, file: 'f<', what: 'w<' };
  // (v578: no "previous method's" notice any more)
  assert.deepEqual([H.pairNotice(HU, o, { fail: 'read' }), H.pairNotice(HU, { d: null }, { fail: 'read' }), H.pairNotice(HU, o, { fail: 'empty' }), H.pairNotice(HU, o, { r: null, R: {} }), H.pairNotice(HU, o, { r: {}, R: {} })],
    [boxHtml('bad', 'f&lt;: bad&lt;'), '', boxHtml('warn', 'w&lt;: no point in the windows.'), boxHtml('info', 'w&lt;: not integrated yet: the model is drawn once it is.'), '']);
  assert.equal(H.chromLegendHtml(HU, [['#1', 'a<', ''], ['#2', 'b', 'mk-dots']]), '<span><i style="background:#1"></i>a&lt;</span><span><i class="mk-dots" style="color:#2"></i>b</span><span><i class="mk-box gci-mk-nb"></i>peaks the model leaves out</span>');
  assert.equal(H.ovGasHtml(gasOf, ['h2', 'o2'], 'o2'), '<button type="button" class="mode-chip plot-chip gci-ov-chip" data-g="h2" aria-pressed="false" title="Show H₂ (one gas at a time)">H<sub>2</sub></button><button type="button" class="mode-chip plot-chip gci-ov-chip is-on" data-g="o2" aria-pressed="true" title="Show O₂ (one gas at a time)">O<sub>2</sub></button>');
  assert.ok(H.ovYHtml(HU, { mode: 'area', c: null, G: gasOf('h2') }).includes('title="No calibration of H₂ and no table to take a scale from" disabled>Conc.</button>'));
  assert.equal(H.overLegendHtml({ G: gasOf('h2'), bad: [false, true], table: [1], mode: 'area' }, '#f', '#b'), '<span><i class="gci-mk gci-mk-dot" style="color:#f"></i>H₂ fit</span><span><i class="gci-mk gci-mk-dot" style="color:#b"></i>suspicious</span><span><i class="gci-mk gci-mk-x"></i>GC table × k</span>');
  // the window's files, warning, status, rows, fit, lines
  assert.equal(H.dropAlertHtml(HU, []), '');
  assert.equal(H.dropAlertHtml(HU, ['a<b: why.'], ['c<']), PAGE.alertHtml('bad', 'Not loaded:', ['a&lt;b: why.']) + PAGE.alertHtml('info', 'Already loaded, not loaded again:', ['c&lt;.']));
  const files = [{ name: 'f<1>', table: { name: 't&' } }, { name: 'g"' }];
  assert.ok(H.calFilesHtml(HU, files).includes('<span class="xrd-std-name">t&amp; + f&lt;1&gt;</span>') && H.calFilesHtml(HU, files).includes('g&quot; <span class="txt-meta">(no table)</span>') && H.calFilesHtml(HU, files).includes('data-cal-del="1"'));
  // (v573: its × marks its file seen, gc-integ.js dismissCalWarn; to v572 the box removed alone)
  const OLD = 'g&quot;: saved by an older version without its GC table: its standards are named by column. Drop the table (the same name without _TCD) to name them.';
  assert.equal(H.calWarnHtml(HU, H.calNotes(HU, files)), PAGE.alertHtml('warn', 'Opened, to check:', [OLD], 'gci-cal-dismiss-opened'));
  assert.deepEqual([H.calWarnHtml(HU, H.calNotes(HU, [files[0], { ...files[1], seen: ['opened'] }])), H.calWarnHtml(HU, [])], ['', '']);
  /* The window's run line (v578: its Integrate the card's): the card's run, failure and windows;
     its standards' counts; stopped, nothing running, never "Integrating" (v569); all integrated,
     how many (to v577 a line beside the unit, "No standards…" with none: now nothing). */
  const cs = (state, left, rows, o = {})=> H.calStatusHtml(HU, gasOf, { st, m, pending: false, left: 9, state, ...o }, left, rows);
  assert.deepEqual([cs('running', 3, 6), cs('failed', 3, 6), cs('pending', 0, 6, { pending: true }), cs('stopped', 3, 6), cs('stopped', 1, 6), cs('stopped', 0, 6), cs('stopped', 0, 6, { pending: true }), cs('left', 3, 6), cs('left', 0, 1), cs('done', 0, 6), cs('none', 0, 6)],
    ['<span>Integrating… 2 / 5 chromatograms · a&lt;b&gt;</span>', '<div class="alert bad compact">✕ The integration failed: f&lt;x&gt;.</div>', '<span>The results shown come from H₂-O₂ fit 264–331 s, not from these windows.</span>',
      '<span>Stopped: 3 chromatograms of the standards not integrated.</span>', '<span>Stopped: 1 chromatogram of the standards not integrated.</span>', '<span>6 chromatograms integrated.</span>',
      '<span>Stopped: the results shown come from H₂-O₂ fit 264–331 s, not from these windows.</span>', '<span>3 chromatograms of the standards to integrate.</span>', '<span>1 chromatogram integrated.</span>', '<span>6 chromatograms integrated.</span>', '<span>6 chromatograms integrated.</span>']);
  assert.equal(H.levelRowsHtml(HU, [], 0, 0, 1), '<tr><td colspan="8" class="txt-meta">Drop the standards\' GC table and its raw chromatograms above.</td></tr>');
  const d = { t: [0, 0.5, 1, 1.5, 2], cols: [[1, 2, 3, 2, 1]] };
  const row = { f: { name: 'f<', table: { name: 't>' } }, fi: 0, j: 0, d, lv: { h2: 0.05, o2: null, on: false }, r: { error: 'x' }, name: 'n<b>' };
  const lh = H.levelRowsHtml(HU, [row], 0, 0, 2);
  for (const s of ['class="peak-row selected is-excluded" data-row="0"', '<td class="gci-cal-src gci-bad" title="n&lt;b&gt; (t&gt;, f&lt;, column 1)"><span class="gci-cal-name">n&lt;b&gt;</span>', '<td class="gci-cal-a">…</td>',
    'data-g="h2" value="0.05" aria-label="H2 concentration of n&lt;b&gt;"', 'data-g="o2" value="" aria-label', 'data-g="on" aria-label="Use n&lt;b&gt;"', '<polyline points="0.0,21.0 36.0,1.0 72.0,21.0"']) assert.ok(lh.includes(s), s);
  assert.equal(H.thumbHtml(d, 0, 0, 2), '<svg class="gci-thumb" viewBox="0 0 72 22" width="72" height="22" aria-hidden="true"><polyline points="0.0,21.0 36.0,1.0 72.0,21.0" fill="none" stroke="currentColor" stroke-width="1"/></svg>');
  // (v571: what makes the standard suspicious, the card's compact warning under its line, G09)
  assert.equal(H.calFitHtml(HU, gasOf, ['h2', 'o2'], { r: { gases: { h2: { area: 1234.5, sd: 1.2, chi2r: 5 } }, windows: [{ key: 'A', chi2r: 5 }] } }), 'H<sub>2</sub>: area 1234.5 ± 1.2, χ²<sub>r</sub> 5.00<div class="alert warn compact gci-flag">⚠ Suspicious: χ²ᵣ 5.00, above 4</div>');
  assert.equal(H.calFitHtml(HU, gasOf, ['h2'], null), '');
  const fits = H.calFitsHtml(HU, gasOf, ['h2', 'o2'], 'gc7', { h2: false, o2: true });
  assert.ok(fits.includes('id="gc7Calh2"') && fits.includes('data-dl-name="GC_calibration_O2.svg"') && fits.includes('class="mode-chip plot-chip gci-zero-chip is-on" data-g="o2" data-zero="1"'));
  assert.equal(H.calStatsHtml(HU, gasOf, 'o2', { pts: [] }, '%mol', false), '<p class="txt-meta">No standard for O<sub>2</sub>: each pair takes the GC software\'s scale (k).</p>');
  assert.equal(H.calStatsHtml(HU, gasOf, 'o2', { pts: [1], xs: [0.1], L: null }, '%mol', false), '<p class="txt-meta">1 standard at one concentration: a free intercept needs two concentrations at least; a zero intercept fits one.</p>');
  const L = { slope: 40000.123, intercept: -12.3456, r2: 0.999876, n: 3, residuals: [{ conc: 0.1, area: 4100, fitted: 4000 }, { conc: 0.05, area: 1900, fitted: 2000 }, { conc: 0.1, area: 4000, fitted: 4000 }] };
  const sh = H.calStatsHtml(HU, gasOf, 'h2', { pts: [1, 2, 3], xs: [0.1, 0.05, 0.1], L }, 'p<m', true);
  assert.ok(sh.startsWith('<p class="gci-cal-line">slope <b>40000.1</b> area/p&lt;m, intercept <b>-12.346</b> (fixed), R² = <b>0.99988</b>, n = 3</p>'));
  assert.ok(sh.includes('<tr><td>0.05</td><td>1</td><td>1900</td><td>2000</td><td class="gci-bad">-5.00 %</td></tr><tr><td>0.1</td><td>2</td><td>4050</td><td>4000</td><td class="">+1.25 %</td></tr>'));
});

/* ---- Cases as v559's gc-integ.js gave them ----
   Random rows of the list, an Integration card (beside a Production Rate card or not)
   with a state of every version or malformed and results (the engine's, made up, v544's,
   malformed), then eight steps each, done as gc-integ.js does them (its wiring, in short,
   below); after the state and each step, what the card shows and gives (outputs). Their
   digests: tests/golden/integmodel.json. */
const DROPS = ['standards.csv', 'standards_TCD.csv', 'stds2.csv', 'stds2_TCD.csv', 'old.csv', 'old (2).csv', 'lone_TCD.csv', 'run.csv', 'broken_TCD.csv', 'notext.csv', 'nothing.csv'];
export function caseOf(n){
  const R = rng(5600 + n), u = R.u, pick = a => a[Math.floor(u()*a.length)], int = (a, b)=> a + Math.floor(u()*(b - a + 1));
  const junk = ()=> pick([null, 'x', -1, 0, [], {}, true]);
  const rows = Array.from({ length: int(1, 6) }, ()=> int(0, ROWS.length - 1));
  const lv = ()=> ({ h2: pick([0.05, 0.1, 0.2, null, 'x']), o2: pick([0.02, 0.05, null, -1]), on: u() < 0.85 });
  const files = [];
  if (u() < 0.5) files.push({ name: 'standards_TCD.csv', rawBytes: 'standards_TCD.csv', levels: Array.from({ length: int(0, 7) }, ()=> u() < 0.1 ? junk() : lv()), ...(u() < 0.8 ? { table: { name: 'standards.csv', rawBytes: 'standards.csv' } } : {}) });
  if (u() < 0.3) files.push({ name: 'old (1)_TCD.csv', rawBytes: 'old (1)_TCD.csv', levels: [lv(), lv()] });
  if (u() < 0.1) files.push(junk());
  const state = u() < 0.08 ? junk() : { method: u() < 0.1 ? junk() : { windows: [{ key: 'H2O2', from: pick([268, 270, 264, 'a']), to: pick([326, 331, 200]) }], ...(u() < 0.2 ? { trapezoid: {} } : {}) },
    cal: u() < 0.1 ? junk() : { unit: pick(['%mol', 'ppm', 'x']), zero: { h2: u() < 0.3, o2: u() < 0.5 }, files }, ovGas: pick([['h2'], ['o2'], ['o2', 'h2'], 'o2', null]), ovY: pick(['conc', 'area', 'x']) };
  const steps = Array.from({ length: 8 }, ()=>{
    const op = pick(OPS);
    if (op === 'sel' || op === 'inj' || op === 'row' || op === 'del') return [op, int(0, 11)];
    if (op === 'stepFile' || op === 'stepK') return [op, pick([-1, 1])];
    if (op === 'gas') return [op, pick(['h2', 'o2', 'co2'])];
    if (op === 'y') return [op, pick(['area', 'conc', 'x'])];
    if (op === 'edge') return [op, pick(['from', 'to']), pick(['270', '268', '264', '326', '331', '331,0', 'abc', '', '300', '322'])];
    if (op === 'drop') return [op, Array.from({ length: int(1, 3) }, ()=> pick(DROPS)).concat(u() < 0.5 ? pick([['standards.csv', 'standards_TCD.csv'], ['stds2.csv', 'stds2_TCD.csv'], ['old.csv']]) : [])];
    if (op === 'level') return [op, int(0, 11), pick(['h2', 'o2', 'on']), pick(['0.05', '0,1', '', '-1', 'x', '0.2', '0.02', ' 0.1 '])];
    if (op === 'unit') return [op, pick(['%mol', 'ppm', 'zz'])];
    if (op === 'zero') return [op, pick(['h2', 'o2', 'co2']), u() < 0.5];
    if (op === 'include') return [op, int(0, 6), u() < 0.5];
    if (op === 'load') return [op, int(1, 1e6)];
    if (op === 'restore') return [op, u() < 0.5 ? state : { method: { windows: [{ key: 'H2O2', from: 270, to: 326 }] }, ovGas: ['o2'] }];
    if (op === 'showNext') return [op, pick([{ file: pick(['run_TCD.csv', 'mini_TCD.csv', 'x']), k: pick([0, 2, -1, 1.5]) }, null])];
    return [op];
  });
  // (the case's open: at least one step in three)
  return { rows, results: int(1, 1e6), state, steps };
}
/* And four scenes: an old calibration named beside standards added after it; methods
   changed, refused and reset (v578: edited, pending, the results the method's applied);
   rows of every kind chosen, left out and unpaired; windows edited, applied (Integrate's
   swap), a state put back with windows pending, applied again and reset (v578). */
const SCENES = [
  { rows: [0], results: -1, state: { cal: { files: [{ name: 'old (1)_TCD.csv', rawBytes: 'old (1)_TCD.csv', levels: [{ h2: 0.05 }, { h2: 0.1 }, { o2: 0.02 }, { o2: 0.05 }] }] } },
    steps: [['open'], ['row', 2], ['drop', ['standards.csv', 'standards_TCD.csv']], ['level', 4, 'h2', '0,05'], ['level', 5, 'h2', '0.1'], ['level', 6, 'h2', '0.2'], ['level', 7, 'o2', '0.02'],
      ['drop', ['old (2).csv']], ['drop', ['old.csv']], ['unit', 'ppm'], ['zero', 'o2', true], ['level', 8, 'on'], ['row', 1], ['del', 1], ['close']] },
  { rows: [2, 0, 3, 4], results: -2, state: null,
    steps: [['sel', 1], ['inj', 4], ['edge', 'from', '270'], ['gas', 'o2'], ['y', 'area'], ['edge', 'from', '322'], ['edge', 'to', 'abc'], ['stepK', -1], ['stepFile', 1], ['reset'],
      ['showNext', { file: 'mini_TCD.csv', k: 2 }], ['inj', 1], ['clear']] },
  { rows: [5, 4, 6, 7, 9, 1, 8], results: -3, state: { ovGas: ['o2'], ovY: 'area' },
    steps: [['sel', 0], ['sel', 1], ['sel', 3], ['sel', 5], ['include', 0, false], ['unpair'], ['sel', 2], ['include', 0, true], ['sel', 6], ['inj', 10]] },
  { rows: [0, 2], results: -2, state: null,
    steps: [['edge', 'from', '270'], ['gas', 'o2'], ['open'], ['apply'], ['edge', 'to', '331'], ['close'],
      ['restore', { method: { windows: [{ key: 'H2O2', from: 270, to: 326 }] }, edit: { windows: [{ key: 'H2O2', from: 268, to: 331 }] } }], ['apply'], ['reset'], ['apply']] },
];
// Every case: the 60 random ones, then the scenes.
export const allCases = ()=> [...Array.from({ length: 60 }, (_, n)=> caseOf(n)), ...SCENES];
const OPS = ['sel', 'inj', 'stepFile', 'stepK', 'gas', 'y', 'edge', 'edge', 'reset', 'open', 'open', 'close', 'drop', 'drop', 'level', 'level', 'level', 'row', 'unit', 'zero', 'del', 'load', 'include', 'unpair', 'restore', 'showNext', 'clear'];
// (bytes named in a case's state, as a project holds them)
export const withBytes = s => JSON.parse(JSON.stringify(s), (k, v)=> k === 'rawBytes' && typeof v === 'string' ? BYTES[v] : v);
// The results put in: made up and the engine's, some v544's keys, some malformed.
// (a negative seed: every file's results, as they are)
export function resultsOf(seed){
  const R = rng(Math.abs(seed)), out = resultsFor(R, seed < 0);
  if (seed < 0) return out;
  for (const k of Object.keys(out)) if (R.u() < 0.2){
    const i = k.indexOf('|'), a = JSON.parse(k.slice(i + 1)), m = JSON.parse(a[a.length - 1]);
    m.trapezoid = { on: 1 }; m.fit.spikes.roundsTrapezoid = 3; a[a.length - 1] = JSON.stringify(m);
    out[k.slice(0, i + 1) + U.exactKey(a)] = out[k].map(x=> x && x.gases ? { ...x, gases: Object.fromEntries(Object.entries(x.gases).map(([g, v])=> [g, { ...v, trap: 1 }])) } : x); delete out[k];
  }
  if (R.u() < 0.3) out.x = [{ gases: 5, windows: [] }];
  return out;
}

// gc-integ.js's wiring of a case, in short: the instance S, its card C, its window W.
export function caseEnv(c){
  const all = c.rows.map(i=> ROWS[i]()), cards = [{ id: 3, type: 'integ', name: 'Integ <1>' }];
  const { S, card } = instance(all, cards), C = card(cards[0]);
  return { S, C, W: { open: false, held: [], alerts: '', rows: [] }, all };
}
const renderSel = (S, C)=>{ const e = M.curOf(S, C); if (e){ C.selName = e.name; if (C.selK >= e.n) C.selK = Math.max(0, e.n - 1); } return e; };
// (v578: windows edited, pending; applied by Integrate's swap, its run's windows the card's: 'apply')
// (v581: on a card with no result of the windows applied, applied as they are: takeEdit)
function setMethod(S, C, m){ if (M.tooShort(m) || M.methodKey(U, m) === M.methodKey(U, C.edit)) return; M.takeEdit(U, S, C, m); }
export function step(E, [op, a, b, x]){
  const { S, C, W, all } = E;
  const calChanged = ()=> C.valuesKept.clear();
  if (op === 'sel'){ const f = M.entriesOf(S)[a]; if (f){ C.selName = f.name; C.selK = 0; } }
  else if (op === 'inj'){ const e = M.curOf(S, C); if (e && e.n) C.selK = a % e.n; }
  else if (op === 'stepFile') M.stepFile(S, C, a);
  else if (op === 'stepK') M.stepK(S, C, a);
  else if (op === 'gas'){ if (S.GAS[a] && a !== C.ovGas) C.ovGas = a; }
  else if (op === 'y'){ if (a !== C.ovY) C.ovY = U.oneOf(a, ['conc', 'area']); }
  else if (op === 'edge'){ const v = +String(b).replace(',', '.'), m = M.clone(C.edit); if (M.fin(v)){ m.windows[0][a] = v; setMethod(S, C, m); } }
  else if (op === 'reset') setMethod(S, C, M.methodIn(U, null));
  else if (op === 'apply'){ C.method = M.clone(C.edit); calChanged(); }
  else if (op === 'open') W.open = true;
  else if (op === 'close'){ if (W.open){ W.open = false; W.held = []; W.alerts = ''; } }
  else if (op === 'drop'){
    const bad = [], got = [];
    for (const name of a){ const t = M.takeDropped(S, name, new Uint8Array(BYTES[name])); if (t.bad) bad.push(t.bad); else got.push(t); }
    const P = M.pairDropped(S, C.cal, W.held, got, bad);
    W.held = P.held; W.alerts = H.dropAlertHtml(HU, bad, P.dup);
    if (P.add.length || P.named.length){ if (P.add.length) C.calSel = M.calRows(U, S, C).length; C.cal = M.calWith(C.cal, P.add, P.named); calChanged(); }
  }
  else if (op === 'level'){
    if (!W.open || !W.rows.length) return;
    const row = W.rows[a % W.rows.length], c = M.calCopy(C.cal), f = c.files[row.fi], j = row.j;
    if (!f) return;
    while (f.levels.length <= j) f.levels.push(M.blankLevel());
    if (b === 'on') f.levels[j].on = !W.checked(row);
    else { const v = M.levelIn(x); if (Number.isNaN(v)) return; f.levels[j][b] = v; }
    C.cal = c; calChanged();
  }
  else if (op === 'row'){ if (W.open && W.rows.length){ const r = a % W.rows.length; if (r !== C.calSel) C.calSel = r; } }
  else if (op === 'unit'){ const c = M.calCopy(C.cal); c.unit = U.oneOf(a, M.UNITS); C.cal = c; calChanged(); }
  else if (op === 'zero'){ const c = M.calCopy(C.cal), z = b; if (c.zero[a] !== z){ c.zero[a] = z; C.cal = c; calChanged(); } }
  else if (op === 'del'){ const c = M.calCopy(C.cal); c.files.splice(a, 1); C.cal = c; calChanged(); }
  else if (op === 'load') M.loadResults(U, S.store, resultsOf(a));
  else if (op === 'include'){ const f = all[a]; if (f) f.included = b ? undefined : false; }
  else if (op === 'unpair'){ const f = all.find(r=> r.mate); if (f){ const m = f.mate; delete f.mate; all.splice(all.indexOf(f) + 1, 0, m); } }
  else if (op === 'restore') M.restoreCard(U, S, C, withBytes(a));
  else if (op === 'showNext') M.showNext(U, C, a);
  else if (op === 'clear'){ C.selName = null; C.selK = 0; }
}
// A plot's calls as a page of stubs records them: each its name and arguments, arrays by digest.
const arr = v => Array.isArray(v) || ArrayBuffer.isView(v);
export const callOf = (name, args)=> [name, ...args.map(v=> arr(v) ? sha(canon(Array.from(v))).slice(0, 16) : v)];
// What the card's draw writes (gc-integ.js draw), the window's paint (paintWindow) while it is open, and what it gives.
export function outputs(E){
  const { S, C, W, all } = E, o = {};
  const e = renderSel(S, C), es = M.entriesOf(S);
  const J = e && !e.d.error ? M.judge(S, e, M.resOf(U, S, C, e.tcd).res) : null;
  o.files = es.map(x=> [M.fileLabel(x), M.fileTitle(x)]);
  o.injs = e ? Array.from({ length: Math.min(e.n, 40) }, (_, k)=> [M.injShort(e, k), `${M.injName(e, k)} of ${e.n}${J && J.bad(k) ? ' (suspicious)' : ''}`, !!(J && J.bad(k))]) : [];
  const x = M.progressOf(U, S, C);
  o.status = [x.state, H.statusHtml(HU, S.gasOf, x)];
  o.alerts = H.alertsHtml(HU, S.gasOf, M.alertFacts(U, S, C));
  // the chromatogram over its residuals (gc-integ.js drawPair)
  const pc = { d: e ? e.d : null, k: C.selK, R: e && !e.d.error ? M.resOf(U, S, C, e.tcd) : null, file: e ? e.tcd.name : '', what: e ? `${e.label}, chromatogram ${C.selK + 1}` : '' };
  const D = M.chromOf(U, pc, C.method), ch = [], re = [];
  o.legend = '';
  if (!D.fail){
    ch.push(callOf('setRange', [D.lo, D.hi, D.c0, D.c1]));
    M.bandsOf(D.curves).forEach(z=> ch.push(callOf('vband', [z[0], z[1], M.C_BAD, 0.14])));
    ch.push(callOf('line', [D.tt, D.yy, M.C_RAW, 1.2, 'undefined', 'raw', 'raw']));
    const items = [[M.C_RAW, 'raw', '']], pk = { ci: 0 };
    D.curves.forEach(({ wr, c })=>{
      if (c.base) ch.push(callOf('line', [c.t, c.base, M.C_BASE, 1.1, '5,4', `baseline (${wr.key})`, 'base ' + wr.key]));
      if (c.model) ch.push(callOf('line', [c.t, c.model, M.C_MODEL, 1.4, 'undefined', `model (${wr.key})`, 'model ' + wr.key]));
      M.peakLines(S, wr, c, items, pk).forEach(l=> ch.push(callOf('line', [c.t, l.y, l.col, 1.3, String(l.dash), l.name, 'peak ' + l.name])));
    });
    const dr = M.droppedOf(D.curves);
    if (dr.sp.x.length) ch.push(callOf('points', [dr.sp.x, dr.sp.y, M.C_BAD, 4]));
    if (dr.ex.x.length) ch.push(callOf('points', [dr.ex.x, dr.ex.y, M.C_BAD, 2.2]));
    o.legend = H.chromLegendHtml(HU, M.legendItems(items, D.curves, dr));
    const rs = M.residOf(U, D.curves);
    re.push(callOf('setRange', [D.lo, D.hi, rs.r0, rs.r1]));
    M.bandsOf(D.curves).forEach(z=> re.push(callOf('vband', [z[0], z[1], M.C_BAD, 0.14])));
    if (rs.rx.length) re.push(callOf('line', [[rs.rx[0], rs.rx[rs.rx.length - 1]], [0, 0], M.C_TABLE, 1, '3,3', 'zero', 'zero']), callOf('line', [rs.rx, rs.ry, M.C_MODEL, 1, 'undefined', 'residual', 'residual']));
    C.drawn = { e, k: D.k, t: D.tt, y: D.yy, curves: D.curves, m: D.R.m };
  } else C.drawn = null;
  o.chrom = [ch, re, H.pairNotice(HU, pc, D)];
  // the run overview (gc-integ.js drawOverview)
  if (!e || e.d.error || !e.n) o.over = ['', '', ''];
  else {
    const O = M.overviewOf(U, S, C, e), ov = [callOf('setRange', [O.xr[0], O.xr[1], O.yr[0], O.yr[1]]), O.ylabel];
    if (O.table) ov.push(callOf('points', [O.xs, O.table, M.C_TABLE, M.OV_CROSS]));
    ov.push(callOf('points', [O.xs, O.fit.map((v, k)=> O.bad[k] ? NaN : v), S.C_FIT, M.OV_R]));
    if (O.bad.some(Boolean)) ov.push(callOf('points', [O.xs, O.fit.map((v, k)=> O.bad[k] ? v : NaN), M.C_BAD, M.OV_R]));
    o.over = [H.ovGasHtml(S.gasOf, Object.keys(S.GAS), O.g), H.ovYHtml(HU, O), H.overLegendHtml(O, S.C_FIT, M.C_BAD), ov];
  }
  o.values = H.valuesHtml(HU, S.gasOf, M.peaksOf(U, S, C, e));
  o.method = [H.methodHtml(HU, S.gasOf, C.edit, M.intrusions(C.edit)), M.isDefault(U, C.edit)];
  if (W.open) o.cal = calOutputs(E);
  // what it gives gc.js: its CSVs, state, sig, Analysis's values, the results saved
  const n = 'Card', out = !es.length ? (W.open && C.calDrawn ? [[`${n} - standard_chromatogram.csv`, M.chromCsv(U, C.calDrawn)]] : []) : [[`${n} - integration.csv`, M.integrationCsv(U, S, C, es)]];
  if (es.length && C.drawn && C.drawn.e && es.some(y=> y.name === C.drawn.e.name)) out.push([`${n} - chromatogram.csv`, M.chromCsv(U, C.drawn)]);
  if (es.length && W.open && C.calDrawn) out.push([`${n} - standard_chromatogram.csv`, M.chromCsv(U, C.calDrawn)]);
  o.csv = out.map(([k, t])=> [k, sha(t)]);
  o.state = M.snapshotOf(U, C);
  o.sig = U.exactKey([M.methodKey(U, C.method), M.calKey(U, C)]);
  o.valuesFor = all.filter(GM.isTable).map(f=> M.valuesFor(U, S, C, f));
  o.saved = M.savedResults(U, S);
  return o;
}
// The calibration's window as paintWindow leaves it (its standard's plot, drawStd, as its CSV
// takes it); with no standards, its files and warning alone (v578).
function calOutputs(E){
  const { S, C, W } = E, o = {};
  o.files = H.calFilesHtml(HU, C.cal.files);
  o.warn = H.calWarnHtml(HU, H.calNotes(HU, C.cal.files));
  if (!C.cal.files.length){ W.rows = []; C.calDrawn = null; o.alerts = W.alerts; return o; }
  const rows = W.rows = M.calRows(U, S, C);
  W.checked = row => row.lv.on;
  if (C.calSel >= rows.length) C.calSel = Math.max(0, rows.length - 1);
  o.status = H.calStatusHtml(HU, S.gasOf, M.progressOf(U, S, C), M.stdsLeft(U, S, C), rows.length);
  const [lo, hi] = M.range(C.method);
  o.rows = H.levelRowsHtml(HU, rows, C.calSel, lo, hi);
  const x = rows[C.calSel] || null, pc = { d: x ? x.d : null, k: x ? x.j : 0, R: x ? M.resOf(U, S, C, x.f) : null, file: x ? x.f.name : '', what: x ? x.name : '' };
  const D = M.chromOf(U, pc, C.method);
  C.calDrawn = x && !D.fail ? { x, k: D.k, t: D.tt, y: D.yy, curves: D.curves, m: D.R.m } : null;
  o.notice = H.pairNotice(HU, pc, D);
  o.fit = H.calFitHtml(HU, S.gasOf, Object.keys(S.GAS), x);
  o.stats = Object.keys(S.GAS).map(g=> H.calStatsHtml(HU, S.gasOf, g, M.calGasOf(U, S, C, g), C.cal.unit, C.cal.zero[g]));
  o.fits = H.calFitsHtml(HU, S.gasOf, Object.keys(S.GAS), 'gc3', C.cal.zero);
  o.alerts = W.alerts;
  return o;
}
export function runCase(c){
  const E = caseEnv(c), out = [];
  M.loadResults(U, E.S.store, resultsOf(c.results));
  M.restoreCard(U, E.S, E.C, withBytes(c.state));
  out.push(outputs(E));
  for (const s of c.steps){ step(E, s); out.push(outputs(E)); }
  return canon(out);
}

test('60 cases and four scenes as v559\'s gc-integ.js gave them, v578\'s windows applied on demand (golden digests)', ()=>{
  const got = { cases: allCases().map(c=> sha(runCase(c))) };
  if (UPDATE){ fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + '\n'); return; }
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const off = got.cases.map((h, i)=> h === want.cases[i] ? null : i).filter(i=> i !== null);
  assert.deepEqual(off, [], 'cases whose digest differs');
  assert.equal(got.cases.length, want.cases.length);
});
