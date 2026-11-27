/* GC's Production Rate calculations (gc-model.js) and its words and markup that need no page
   (gc-html.js), in Node: no browser (v557). The injection dates in every form both exports
   write (month/day, day/month found, month names, 2-digit years, with and without seconds,
   AM/PM or 24 h, dates that do not exist left out and said), the default layout (blank and
   n.a. cells, rows of no gas, UTF-16 with an Analysis column) and the alternative .txt
   export (ppm as %mol), a file refused with why, raw chromatograms told by what they hold;
   the molar volume and the pressure's units; a gas's flow, rate and production and the mean
   rate over the interval against a hand calculation, by mass and by area, the Results' series
   cut to the interval, the mean by sample and its SD; the plots' ranges and interval lines; a
   card's parameters (all and one, the toggle refused with the words a value typed gets, the
   state read back, malformed values), files as a project holds them (a table read again from
   its bytes, raw chromatograms, pairs); v583: an old project (before the cards, one interval,
   paired modes, before T, the single gas selector, bytes as arrays, bytes lost), its old
   fields ignored, the defaults in their place, its tables read again from their bytes; v586: a
   table whose reader throws (its injections held, said); the replicates' links (a head removed, chains, a name twice, a walk
   through a select), the pairs' rows; the cards' markup, the parameter table and the alerts,
   every label escaped. Then the fixtures as v556's page analysed them (its CSVs, every byte,
   at two steps of a session: the two fixtures dropped; five more files of every form), and
   60 cases (random files, states, links and a decimal comma: the CSVs, the state read back,
   the parameter table, the alerts and the Sample column) as v556's gc.js gave them, run from
   its source on a page of stubs: their digests in tests/golden/gcmodel.json (npm run
   test:update writes them anew after a change meant to alter them). utils.js's, modkit.js's
   and modcharts.js's helpers, which need a page to load, are taken from their source as they
   stand there. Under a second. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { rng, gcCsv } from './fixtures.mjs';
import { decodeText } from '../textdata.js';
import * as M from '../gc-model.js';
import * as H from '../gc-html.js';
import { markSeen, ALERT_ICON } from '../alerts.js';

// The page's dates are local: the tests' time zone, as the browser tests' (helpers.mjs).
process.env.TZ = 'UTC';
const UPDATE = !!process.env.UPDATE_GOLDEN || process.env.npm_lifecycle_event === 'test:update';
const GOLDEN = new URL('./golden/gcmodel.json', import.meta.url);
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
const UN = ['esc', 'fmtNum', 'csvField', 'csvJoin', 'csvLine', 'cumtrapz', 'meanArr', 'stdArr', 'maxArr', 'minArr', 'X_SVG', 'ALERT_ICON', 'markOf', 'seenFor', 'notesFor', 'alertHtml', 'FILE_ALERT', 'fileAlertHtml', 'fileLine', 'notesHtml', 'exactKey'];
const IN_ALERTS = new Set(['ALERT_ICON', 'markOf', 'seenFor', 'notesFor']);
const KN = ['isObj', 'isArr', 'num', 'oneOf', 'dateOf', 'arrOf', 'without', 'wideCsv'];
const CN = ['PLOT_DL_ICON', 'CSV_ICON', 'plotWrap'];
// (the CSVs' settings as a fresh page has them; a decimal comma where a case asks for one)
const settings = { decimal: '.', field: ';' };
const PAGE = new Function('settings', [...UN.map(n=> decl(IN_ALERTS.has(n) ? 'alerts.js' : 'utils.js', n)), ...KN.map(n=> decl('modkit.js', n)), ...CN.map(n=> decl('modcharts.js', n))].join('\n') +
  `\nreturn { ${[...UN, ...KN, ...CN].join(', ')} };`)(settings);
const ids = new WeakMap();
let nid = 0;
const objId = o => o == null || typeof o !== 'object' ? String(o) : ids.get(o) || (ids.set(o, ++nid), nid);
const U = { settings, objId, ...Object.fromEntries(['fmtNum', 'csvLine', 'cumtrapz', 'maxArr', 'minArr', 'meanArr', 'stdArr', 'exactKey', 'num', 'oneOf', 'dateOf', 'arrOf', 'without', 'wideCsv'].map(k=> [k, PAGE[k]])) };
const HU = { esc: PAGE.esc, num: PAGE.num, plotWrap: PAGE.plotWrap, CSV_ICON: PAGE.CSV_ICON, alertHtml: PAGE.alertHtml };
// The drop zone's boxes of what the reading of the files said, as modkit.js draws them.
const boxes = all => PAGE.notesHtml(H.fileNotes(all, HU), w=> 'gc-dismiss-' + w);
const near = (a, b, tol, what)=> assert.ok(Math.abs(a - b) <= tol*Math.max(1, Math.abs(b)), `${what}: ${a} against ${b}`);
const iso = d => d && d.toISOString().slice(0, 19);
// A canonical dump: every number by its shortest round-trip string, NaN, ±∞ and −0 too; a
// date by its time.
const canon = v => JSON.stringify(v, function(k, x){ const o = this[k];
  if (o instanceof Date) return 'D' + o.getTime();
  if (typeof o === 'number') return Object.is(o, -0) ? '#-0' : '#' + o;
  return x; });

/* ---- The files (made up) ---- */
const T = '\t';
const csv = text => text;
const u16 = text => decodeText(new Uint8Array(Buffer.from('﻿' + text, 'utf16le')));
// The alternative export (gcalt.test.mjs's): rows [date, { gas: ppm }], 'na', 'tabs'.
function alt(rows, gases = ['Hydrogen', 'Nitrogen', 'Oxygen']){
  const n = gases.length, w = 2 + 2*n;
  return [
    ['No. ', 'Inject Time ', ...gases.map((_, i)=> i === 1 ? 'Area' : 'Area '), ...gases.map((_, i)=> i ? 'Amount ' : 'Amount')].join(T),
    T + ['', '', ...gases.map(()=> 'pA*min'), ...gases.map(()=> '')].join(T),
    T + ['', '', ...Array(2*n).fill('PDD_Ch_1')].join(T),
    T + ['', '', ...gases, ...gases].join(T),
    ...rows.map((r, i)=> r === 'tabs' ? T.repeat(w - 1) : r === 'na' ? [String(140 + i), ...Array(w - 1).fill('n.a.')].join(T)
      : [String(i + 1), r[0], ...gases.map((g, j)=> g in r[1] ? (0.00007*(j + 1)*(i + 2)).toFixed(7) : 'n.a.'), ...gases.map(g=> g in r[1] ? String(r[1][g]) : 'n.a.')].join(T)),
    T.repeat(w - 1),
  ].join('\r\n') + '\r\n';
}
const ALT_MAIN = alt([
  ['13/Nov/26 14:13:01', { Nitrogen: 225.5345, Oxygen: 119.1363 }],
  ['13/Nov/26 14:43:01', { Hydrogen: 0.141, Nitrogen: 205.9831, Oxygen: 99.2521 }],
  'na',
  ['13/Nov/26 15:13:01', { Hydrogen: 412.5, Nitrogen: 210.4, Oxygen: 130.75 }],
  'tabs',
  ['13/Nov/26 15:43:01', { Hydrogen: 455, Nitrogen: 208 }],
  ['13/Nov/26 16:13:01', { Hydrogen: 521.25, Nitrogen: 207.5, Oxygen: 150 }],
  ['13/November/2026 16:43', { Hydrogen: 560, Nitrogen: 207.5, Oxygen: 161 }],
  ['13/nov/2026 17:13', { Hydrogen: 601.5, Nitrogen: 207.5, Oxygen: 170.25 }],
]);
// UTF-16 LE, ';' and decimal commas, quoted names, an Analysis column; blank and n.a. cells,
// a row with no gas, a row all n.a. (its date too); dates with seconds, AM/PM.
function gammaU16(){
  const head = '"Analysis";"Injection date";"CH4 (A) [%Mol]";"H2 (B) [%Mol]";"O2 (B) [%Mol]";"N2 (B) [%Mol]";';
  const rows = [];
  for (let k = 0; k < 14; k++){
    const m = 8*60 + 25*k + 3, h = Math.floor(m/60), hh = h % 12 || 12;
    const d = `10/21/2026 ${hh}:${String(m % 60).padStart(2, '0')}:${String((k*7) % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
    let h2 = (0.031 + 0.0213*k + 0.0004*Math.sin(k)).toFixed(5).replace('.', ','), o2 = (0.012 + 0.0087*k).toFixed(5).replace('.', ',');
    if (k === 3) o2 = '';
    if (k === 5) h2 = 'n.a.';
    if (k === 8){ h2 = ''; o2 = 'N.A.'; }
    if (k === 10){ rows.push('"n.a.";n.a.;n.a.;n.a.;n.a.;n.a.;'); continue; }
    rows.push(`"inj_${String(k + 1).padStart(3, '0')}";${d};0,00000;${h2};${o2};57,87601;`);
  }
  rows.splice(6, 0, ';;;;;;');
  return u16([head, ...rows].join('\r\n') + '\r\n');
}
const DM = csv('Injection date,H2 (B) [%Mol],O2 (A) [%Mol]\n' + ['12/10/2025 11:30:00 PM', '12/10/2025 11:45:00 PM', '13/10/2025 12:00:00 AM', '13/10/2025 12:15:00 AM', '13/10/2025 12:40:00 AM', '13/10/2025 1:05:00 AM']
  .map((d, i)=> `${d},${(0.04 + 0.031*i).toFixed(4)},${(0.02 + 0.011*i).toFixed(4)}`).join('\n') + '\n');
const BAD = csv('Injection date,H2 (B) [%Mol]\n' + ['2/28/2025 9:00:00 AM', '2/30/2025 9:15:00 AM', '3/1/2025 9:30:00 AM', '3/1/2025 13:00:00 PM', '3/1/2025 10:00:00 AM', '3/1/2025 10:60:00 AM', '3/1/2025 10:30:00 AM']
  .map((d, i)=> `${d},${(0.1 + i/10).toFixed(2)}`).join('\n') + '\n');
const NAMED = csv('Injection Date,H2 (A) [%Mol],O2 (A) [%Mol]\n' + ['13/Nov/26 14:13:01', '13/November/2026 14:43', 'Nov/13/2026 15:13:30', '13/nov/26 15:43', '31/Nov/2026 16:00', '13/NOV/2026 16:13:59']
  .map((d, i)=> `${d},${(0.05 + 0.02*i).toFixed(3)},${(0.03 + 0.007*i).toFixed(3)}`).join('\n') + '\n');
// A file as a drop makes it: read (gc-model.js readGc), named, labelled by its name.
// A table as the page loads it (modkit.js dropText): what it reads as, its bytes beside.
const enc = t => new TextEncoder().encode(t);
const rec = (name, text, color = '#000')=>{ const d = M.readGc(text); return d && !d.error ? { name, label: name.replace(/\.[^.]+$/, ''), ...d, color, rawBytes: enc(text) } : d; };
const fixture = (k, o)=> decodeText(new Uint8Array(gcCsv(o)));

/* A card as gc.js composes the model: its tables (no Integration card above), its mean rates,
   its CSVs, named `n`. */
function card(P, files, all = files, n = 'Production Rate'){
  const nk = M.normKey(P, files), dataTables = files.map((f, h)=> M.dataTable(M.tablesOf(U, P, f, h, P.lightOnDates[h], nk), f, null));
  const costResults = M.computeRates(P, dataTables);
  return { dataTables, costResults, csvs: M.csvEntries(U, P, n, dataTables, costResults, M.samplesOf(all, files), files) };
}
const csvOf = (c, end)=> c.csvs.find(e=> e.name.endsWith(end)).text.trim().split('\n').map(r=> r.split(';'));

test('the injection dates in every form, the two layouts, a file refused, raw chromatograms told by what they hold', ()=>{
  const at = (s, dm)=> iso(M.parseGCDate(M.dateFields(s), dm));
  assert.equal(at('10/20/2026 1:05:09 PM'), '2026-10-20T13:05:09');
  assert.equal(at('10/20/2026 12:00:00 AM'), '2026-10-20T00:00:00');
  assert.equal(at('13/Nov/26 14:13'), '2026-11-13T14:13:00');
  assert.equal(at('Nov/13/2026 14:13:30'), '2026-11-13T14:13:30', 'a month named, where it stands');
  assert.equal(at('3/4/2026 9:00'), '2026-03-04T09:00:00');
  assert.equal(at('3/4/2026 9:00', true), '2026-04-03T09:00:00', 'day first');
  assert.equal(at('2/29/2024 1:00'), '2024-02-29T01:00:00');
  for (const s of ['2/29/2025 1:00', '2/30/2025 9:15:00 AM', '10/20/2026 13:00:00 PM', '10/20/2026 0:30:00 AM', '10/20/2026 10:60:00', '31/Nov/2026 16:00']) assert.equal(at(s), null, s);
  for (const s of ['n.a.', 'Injection date', 'Nov/Dec/2026 1:00', '10/20/26']) assert.equal(M.dateFields(s), null, s);
  // The default layout: a blank and an n.a. cell for one gas, a row of no gas, a line of separators, a row all n.a.
  const d = M.readGc('Injection Date,H2 (A) [%Mol],O2 (A) [%Mol],CO2 (A) [%Mol]\n10/20/2026 9:00:00 AM,0.1,,5\n,,,\n10/20/2026 9:15:00 AM,n.a.,0.2,5\n10/20/2026 9:30:00 AM,,,5\nn.a.,n.a.,n.a.,n.a.\n10/20/2026 9:45:00 AM,0.3,0.4,5\n');
  assert.deepEqual(d.injDates.map(iso), ['2026-10-20T09:00:00', '2026-10-20T09:15:00', '2026-10-20T09:45:00']);
  assert.deepEqual([d.gas.h2.map(v=> isNaN(v) ? 'x' : v), d.gas.o2.map(v=> isNaN(v) ? 'x' : v), d.emptyRows, Object.keys(d)], [[0.1, 'x', 0.3], ['x', 0.2, 0.4], 1, ['injDates', 'gas', 'emptyRows']]);
  // (the empty cells alone: the row with no gas value is said apart, v567)
  assert.deepEqual(M.blankCounts(d), [1, 1]);
  // Day/month found; dates that do not exist left out (month/day); month names: no order.
  const dm = M.readGc(DM), bad = M.readGc(BAD), named = M.readGc(NAMED);
  assert.deepEqual([dm.dayMonth, iso(dm.injDates[2]), dm.badDates], [true, '2025-10-13T00:00:00', undefined]);
  assert.deepEqual([bad.dayMonth, bad.badDates, bad.injDates.length], [undefined, 3, 4]);
  assert.deepEqual([named.monthNames, named.badDates, named.injDates.length, iso(named.injDates[2])], [true, 1, 5, '2026-11-13T15:13:30']);
  assert.deepEqual(M.readGc('Injection date,H2 (B) [%Mol]\n2/30/2025 9:15:00 AM,0.1\n2/31/2025 9:30:00 AM,\n'), { error: 'no injection to read: 1 row with an injection date that does not exist, 1 with no gas value' });
  // (no value at all: why, v571; to v570 refused as no GC table, by its name alone)
  assert.deepEqual(M.readGc('Injection date,H2 (B) [%Mol]\n10/20/2026 9:00:00 AM,\n10/20/2026 9:15:00 AM,n.a.\n'), { error: 'no injection to read: 2 rows with an injection date and no gas value' }, 'no value at all: why');
  assert.equal(M.readGc('Injection date,H2 (B) [%Mol]\n'), null, 'no row with a date: no GC table');
  // The alternative export: ppm as %mol, N₂ and the areas left, a name's column read for the calibration's window.
  const a = M.readGc(ALT_MAIN);
  assert.deepEqual([a.altExport, a.monthNames, a.injDates.length, a.gas.h2.slice(1, 3), a.gas.o2[3], a.gas.o2[4]], [true, true, 7, [0.141/1e4, 412.5/1e4], NaN, 150/1e4]);
  // (v582: a last cell empty, not n.a., in most rows an empty cell: the columns as the header
  // sets them; to v581 the data's width the most rows' up to their last cell not empty, the
  // header set a cell off against it, no date read and the file refused)
  const o2 = (t, ppm)=> ({ Hydrogen: 400 + t, Nitrogen: 200, ...(ppm ? { Oxygen: ppm } : {}) });
  const e = M.readGc(alt([['13/Nov/26 14:13:01', o2(1)], ['13/Nov/26 14:43:01', o2(2, 99)], ['13/Nov/26 15:13:01', o2(3)], ['13/Nov/26 15:43:01', o2(4)]]).replace(/\tn\.a\.(?=\r\n)/g, '\t'));
  assert.deepEqual([e.altExport, e.injDates.map(iso), e.gas.h2, e.gas.o2.map(v=> isNaN(v) ? 'x' : v)],
    [true, ['2026-11-13T14:13:01', '2026-11-13T14:43:01', '2026-11-13T15:13:01', '2026-11-13T15:43:01'], [401, 402, 403, 404].map(v=> v/1e4), ['x', 99/1e4, 'x', 'x']], 'an empty last cell');
  const g = M.readGc(gammaU16(), true);
  assert.deepEqual([g.injDates.length, g.emptyRows, g.names.slice(0, 3), g.gas.h2[0]], [12, 1, ['inj_001', 'inj_002', 'inj_003'], 0.031]);
  assert.equal(M.readGc(DM, true).names, null, 'no column of names');
  // Raw chromatograms: no header, a line of numbers; read once, handed over.
  const tcd = Array.from({ length: 12 }, (_, i)=> `${250 + i};${-5000 + i};${-4990 + i};`).join('\r\n');
  let seen = null;
  assert.deepEqual(M.readGcAny(tcd, 'bytes', (b, r)=>{ seen = [b, r.cols.length]; }), { tcd: { n: 2 } });
  assert.deepEqual(seen, ['bytes', 2]);
  assert.deepEqual(M.readGcAny(DM, null, ()=> assert.fail()).dayMonth, true);
  assert.equal(iso(M.firstInjection({ injDates: [new Date(2026, 0, 2, 3, 4, 59), new Date(2026, 0, 2, 3, 2, 30)] })), '2026-01-02T03:02:00');
});

test('the flow, the rates and the production by hand, by mass and by area; the mean rate, the Results\' series, the mean by sample', ()=>{
  near(M.molarVolume(25, M.P_ATM), 24.4652, 1e-5, 'V_m at 25 °C, 1 atm');
  near(M.molarVolume(0, M.P_ATM), 22.41397, 1e-6, 'V_m at 0 °C');
  assert.equal(M.toPa(760, 'Torr'), M.P_ATM);
  assert.deepEqual(Object.keys(M.P_UNITS).map(u=> M.inUnit(M.toPa(1.1, u), u)), Array(6).fill(1.1));
  assert.equal(M.inUnit(1.1e5, 'bar'), 1.1);
  assert.ok(M.okP(M.P_MAX*M.P_ATM) && !M.okP(M.P_MAX*M.P_ATM*2) && !M.okP(0) && M.okT(-273) && !M.okT(-274));
  // 0.05 %mol of H₂ (0.02 of O₂) at every injection, every 20 min, light-on at the first.
  const f = rec('c.csv', 'Injection Date,H2 (A) [%Mol],O2 (A) [%Mol]\n' + [0, 20, 40, 60, 80].map(m=> `11/13/2026 10:${String(m).padStart(2, '0') === '60' ? '60' : String(m).padStart(2, '0')}:00 AM,0.05,0.02`).join('\n').replace('10:60', '11:00').replace('10:80', '11:20') + '\n');
  const P = M.newParams([f]);
  assert.deepEqual([P.ms, P.As, P.Qs, P.Ts, P.Ps, P.startArr, P.endArr, P.lightOnDates.map(iso)], [[15], [1], [2], [25], [M.P_ATM], [0], [24], ['2026-11-13T10:00:00']]);
  const Fmol = 2/1000*60/M.molarVolume(25, M.P_ATM), flow = 0.05/100*Fmol*1e6, rate = flow/15*1000;
  const t = M.tablesOf(U, P, f, 0, P.lightOnDates[0], 'm'), q = t.gas.h2;
  assert.deepEqual(q.inj, [-1, 0, 1, 2, 3, 4], 'light-on first, with no reading before it');
  assert.deepEqual([q.pct[0], q.Fm[0], q.t[1]], [0, 0, 60.6/3600]);
  near(q.flow[2], flow, 1e-14, 'µmol/h'); near(q.Fm[2], rate, 1e-14, 'µmol g⁻¹ h⁻¹');
  const tEnd = (80*60 + 60.6)/3600;
  near(q.cum[5], rate*(tEnd - 60.6/3600) + rate*60.6/3600/2, 1e-12, 'the production by trapezoids');
  // By area: µmol cm⁻² h⁻¹, the flow over A.
  const Pa = { ...M.newParams([f]), normBy: 'A', aShared: 2.5 };
  near(M.tablesOf(U, Pa, f, 0, Pa.lightOnDates[0], M.normKey(Pa, [f])).gas.h2.Fm[3], flow/2.5, 1e-14, 'by area');
  /* v581: m or A chosen (normBy), each its own values; not normalised (none) where an included
     sample has none of the one chosen (null: its field left empty), the rates as they flow,
     in µmol h⁻¹ and µmol; the labels follow. */
  assert.deepEqual([M.normKey(P, [f]), M.normKey(Pa, [f]), M.PER], ['m', 'A', ['m', 'A']]);
  const Pn = { ...M.newParams([f, f]), normBy: 'A', aMode: 'one', As: [2, null], startShared: 0.5, endShared: 1 };
  assert.deepEqual([M.normKey(Pn, [f, f]), M.lacking(Pn, [f, f]).length, M.valOf(Pn, 1), M.perOf(Pn, 0, 'none')], ['none', 1, null, 1]);
  near(M.tablesOf(U, Pn, f, 0, Pn.lightOnDates[0], 'none').gas.h2.Fm[3], flow, 1e-14, 'not normalised: the flow');
  assert.equal(M.normKey({ ...Pn, normBy: 'm' }, [f, f]), 'm', 'the masses there: by mass, the areas kept');
  assert.equal(M.normKey({ ...Pn, aShared: 0, aMode: 'all' }, [f]), 'none', 'an area of 0: none');
  assert.deepEqual([M.NORM.none.rateCsv, M.NORM.none.cumCsv, M.NORM.none.unitCsv, M.NORM.m.rateCsv, M.NORM.A.cumCsv], ['Production Rate (umol h^-1)', 'Production (umol)', 'umol h^-1', 'Production Rate (umol g^-1 h^-1)', 'Production (umol cm^-2)']);
  assert.ok(M.NORM.none.rateSvg.startsWith('Production Rate (µmol h<tspan') && M.NORM.none.cumSvg === 'Production (µmol)');
  const cn = card(Pn, [f, f]), info = csvOf(cn, 'gc_info.csv'), mr = csvOf(cn, 'mean_rates.csv');
  assert.deepEqual([info[0][1], info[1][1], info[2][1], mr[0][1]], ['A (cm^2)', '2', '', 'Mean H2 Production Rate (umol h^-1)']);
  near(cn.costResults[0].rate.h2, flow, 1e-9, 'its mean rate: the flow');
  // The mean rate over [0.5, 1] h: the line integrated exactly, over the length.
  P.startShared = 0.5; P.endShared = 1;
  const c = card(P, [f]);
  near(c.costResults[0].rate.h2, rate, 1e-12, 'a constant rate\'s mean');
  assert.equal(c.costResults[0].dt.h2, 0.5);
  // The Results: from 0.5 h, the production 0 there, on the line at each end.
  const cut = M.cutTables(P, c.dataTables)[0].gas.h2;
  assert.deepEqual([cut.t[0], cut.t[cut.t.length - 1], cut.FmInt[0]], [0.5, 1, 0]);
  near(cut.FmInt[cut.FmInt.length - 1], rate*0.5, 1e-12, 'the production over the interval');
  assert.equal(M.cumAt([0, 1, 2], [0, 2, 2], [0, 1, 3], 0.5), 0.25);
  assert.equal(M.cumAt([0, 1], [1, 1], [0, 1], -1), 0); assert.equal(M.cumAt([0, 1], [1, 1], [0, 1], 5), 1);
  assert.equal(M.lineAt([0, 1, 2], [0, 10, 20], 1.5), 15);
  assert.deepEqual(M.spanOf(P, [0, 0.7, 2], 0), [0.5, 1]); assert.deepEqual(M.spanOf(P, [3], 0), [NaN, NaN]);
  // The CSVs: the rates, the duration, p and T; the inputs as set.
  const mean = csvOf(c, 'mean_rates.csv');
  assert.deepEqual(mean[0], ['Sample', 'Mean H2 Production Rate (umol g^-1 h^-1)', 'Mean O2 Production Rate (umol g^-1 h^-1)', 'Interval duration (h)', 'p (atm)', 'T (°C)']);
  assert.deepEqual(mean[1].slice(3), ['0.5000', '1', '25']);
  assert.equal(+mean[1][1], +rate.toFixed(6));
  assert.deepEqual(csvOf(c, 'gc_info.csv')[1], ['c', '15', '2', '25', '1', '2026-11-13 10:00', '0.5', '1', '60.6']);
  // The ranges and the interval lines.
  const shown = M.shownGases(P, [f], 'a');
  assert.deepEqual(M.dataRange(U, P, c.dataTables, shown), [0, tEnd, 0, rate*1.05]);
  assert.deepEqual(M.intervalLines(P, c.dataTables, null, null), [{ x: 0.5, o: { width: 1.5, cls: 'gc-int-hl' } }, { x: 1, o: { width: 1.5, cls: 'gc-int-hl' } }]);
  P.startMode = 'one'; P.startArr = [0.25];
  assert.deepEqual(M.intervalLines(P, c.dataTables, 0, null).map(l=> [l.x, l.o.width, l.o.cls, l.o.color, l.o.hit]), [[0.25, 2.6, 'gc-int-hl', null, true], [1, 2.6, 'gc-int-hl', null, true]]);
  assert.deepEqual(M.cutRange(U, [{ t: [] }]), null);
  assert.equal(M.yTop([{ gas: { h2: { t: [-1, 0, 1], Fm: [9, 1, 2] } } }], [M.GASES[0]], 'Fm'), 2, 'from light-on on');
  assert.equal(M.yTop([{ gas: { h2: { t: [-2, -1], Fm: [9, 1] } } }], [M.GASES[0]], 'Fm'), 9, 'all, none after');
  // The mean by sample: the files' means, their SD (n − 1), n; one file: no ±.
  const cr = [{ rate: { h2: 1 } }, { rate: { h2: 3 } }, { rate: { o2: 5 } }];
  const sr = M.sampleRates(U, cr, [{ name: 'a', label: 'A', ks: [0, 1] }, { name: 'c', label: 'C', ks: [2] }]);
  assert.deepEqual(sr.map(s=> [s.rate.h2, s.err.h2, s.n.h2, s.rate.o2, s.err.o2, s.n.o2]), [[2, Math.SQRT2, 2, undefined, undefined, 0], [undefined, undefined, 0, 5, NaN, 1]]);
  assert.deepEqual(M.barSeries(M.GASES, sr).map(s=> [s.name, s.color, s.vals, s.errs]), [['H₂', '#3aa0ff', [2, undefined], [Math.SQRT2, undefined]], ['O₂', '#ff7a59', [undefined, 5], [undefined, NaN]]]);
  assert.equal(M.seriesName('A', M.GASES[1], M.GASES), 'A O₂'); assert.equal(M.seriesName('A', M.GASES[1], [M.GASES[1]]), 'A');
});

test('a card\'s parameters: all and one, the toggle and its refusal, the state read back, malformed values', ()=>{
  const files = [rec('a.csv', fixture(0, { h2: [0.05, 0.12], o2: [0.02, 0.05], seed: 7 })), rec('b.csv', fixture(1, { h2: [0.08, 0.07], seed: 8 }))];
  const P = M.newParams(files);
  assert.equal(M.flipMode(P, files, 'm'), null);
  assert.deepEqual([P.mMode, P.ms], ['one', [15, 15]]);
  P.ms[0] = 7; M.flipMode(P, files, 'm');
  assert.deepEqual([P.mMode, P.mShared], ['all', 7]);
  // An interval bound back to all refused where a start would not be before an end, with the words a value typed gets.
  M.flipMode(P, files, 'start'); M.flipMode(P, files, 'end');
  P.startArr = [5, 1]; P.endArr = [10, 3];
  const why = M.flipMode(P, files, 'start');
  assert.equal(why, 'The interval must start before it ends: 5 h is not before the end of b, 3 h.');
  assert.deepEqual([P.startMode, P.startArr], ['one', [5, 1]], 'nothing changed');
  assert.equal(M.intervalWhy(P, files, 'end', 4, false, 0), 'The interval must end after it starts: 4 h is not after the start of a, 5 h.');
  assert.equal(M.intervalWhy(P, [files[0]], 'end', 4, false, 0), 'The interval must end after it starts: 4 h is not after the start, 5 h.');
  assert.equal(M.intervalWhy(P, files, 'end', 6, false, 0), null);
  assert.deepEqual(['1,5', '-', '+.', ' 2 ', 'x'].map(M.parseIntervalField), [1.5, null, null, 2, null]);
  // The state saved and read back as it was.
  P.normBy = 'A'; P.ms[0] = null; P.pUnit = 'psi'; P.delayAuto = false; P.delayMan = 30; P.gasSel = { a: ['o2'], r: ['h2', 'o2'] };
  const s = M.snapshotOf(P), Q = M.newParams(files);
  M.restoreParams(U, Q, JSON.parse(JSON.stringify(s)), files);
  assert.deepEqual(M.snapshotOf(Q), s);
  // Malformed: each value as it should be.
  const R = M.newParams(files);
  M.restoreParams(U, R, { mMode: 'x', mShared: -1, qShared: 0, tShared: -300, pShared: 1e307*M.P_ATM, Ps: [0, 2e5], pUnit: 'hPa', normBy: 'volume', delayMan: -2, As: ['1', 3], aShared: 0, lightOnDates: ['x', 0], gasSel: { a: ['co2'] } }, files);
  assert.deepEqual([R.mMode, R.mShared, R.qShared, R.tShared, R.pShared, R.Ps, R.pUnit, R.normBy, R.delayMan, R.As, R.aShared, R.lightOnDates.map(iso), R.gasSel],
    ['all', 15, 2, 25, M.P_ATM, [M.P_ATM, 2e5], 'atm', 'm', 60.6, [1, 3], 1, [iso(M.firstInjection(files[0])), '1970-01-01T00:00:00'], { a: [], r: ['h2', 'o2'] }]);
  // (v581: v540–v580's `norm`, a parameter no longer, ignored: m; a mass or an area none, null, kept so)
  M.restoreParams(U, R, { mMode: 'one', mShared: null, ms: [null, 4], norm: 'area', As: [null, 2], aShared: null }, files);
  assert.deepEqual([R.normBy, R.mShared, R.ms, R.As, R.aShared, 'norm' in M.snapshotOf(R)], ['m', null, [null, 4], [null, 2], null, false]);
  assert.deepEqual(M.shownGases(R, files, 'a').map(g=> g.key), ['h2', 'o2'], 'none chosen there: every gas there');
  // The per-sample arrays' entries as the file list makes them.
  const sl = M.slotsOf(U, R, 3);
  assert.deepEqual(sl.map(x=> x.key), ['3:m', '3:A', '3:Q', '3:T', '3:p', '3:start', '3:end', '3:lightOn']);
  assert.deepEqual(sl.map(x=> x.make(undefined, files[0])).map(v=> v instanceof Date ? iso(v) : v), [15, 1, 2, 25, M.P_ATM, 0, 24, iso(M.firstInjection(files[0]))]);
  assert.deepEqual(sl.map(x=> x.make(-1)).map(v=> v instanceof Date ? iso(v) : v), [15, 1, 2, -1, M.P_ATM, -1, -1, '1969-12-31T23:59:59']);
  assert.deepEqual(sl.slice(0, 2).map(x=> x.make(null)), [null, null], 'a mass and an area held none, none');
  assert.deepEqual(sl.map(x=> x.make('x')).slice(5), [0, 24, null]);
  // The cards: none, one of the defaults; a card's settings, the entries of the files left out dropped.
  assert.deepEqual(M.cardsOf(null), [{ id: 1, type: 'rate' }]);
  assert.deepEqual(M.initOf(U, { ms: [1, 2, 3], mShared: 5 }, new Set([1])), { ms: [1, 3], mShared: 5 });
});

/* v583: an old project opens as this version reads it, its tables read again from their
   bytes. Made here as older versions saved it: its settings at the top level (no cards), one
   interval (plateauStart/End, strings), the paired modes (mqMode, intMode), the single gas
   selector (gasMode), no temperature (0 °C to v582); a table whose bytes read as other
   injections than it holds (an older reader's), one whose bytes are numbers (to v483), one
   whose bytes are gone, one whose bytes the reader refuses. */
test('an old project: old fields ignored, the defaults, its tables read again from their bytes, a table without them said (v583)', ()=>{
  const ta = decodeText(new Uint8Array(gcCsv({ h2: [0.05, 0.12], o2: [0.02, 0.05], seed: 7 }))), tb = decodeText(new Uint8Array(gcCsv({ h2: [0.08, 0.07], seed: 8 })));
  const a = rec('a.csv', ta), b = rec('b.csv', tb), stale = { injDates: [new Date(2020, 0, 1)], gas: { h2: [9] }, emptyRows: 3 };
  const old = { plateauStart: ' 0.5 ', plateauEnd: '3', mqMode: 'one', intMode: 'one', gasMode: { a: 'h2' }, ms: [10, 'x'], files: [
    { ...a, ...stale, label: 'mine', junk: 1 }, { ...b, rawBytes: [...b.rawBytes] }, { ...b, name: 'c.csv', rawBytes: null }, { ...stale, name: 'z.csv', label: 'z', rawBytes: enc('no table here\n') }] };
  let files;
  assert.doesNotThrow(()=>{ files = old.files.map(f=> M.fileIn(U, f)); });
  // its bytes read again: the injections they read as now; its label and other fields its own
  assert.deepEqual([files[0].injDates, files[0].gas, files[0].emptyRows, files[0].label, files[0].junk], [a.injDates, a.gas, a.emptyRows, 'mine', 1]);
  // bytes as numbers, gone, refused: the injections it holds, said so
  assert.deepEqual([files[1].rawBytes, files[1].gas, files[2].gas, files[3].injDates], [null, b.gas, b.gas, stale.injDates]);
  assert.deepEqual(files.map(M.heldOf), ['', ...Array(2).fill('its bytes are not stored: its data are those the project holds'),
    'its bytes no longer read: ' + M.NOT_GC + ': its data are those the project holds']);
  // the cards: one of the defaults, its settings the defaults (25 °C, every gas, all), the old fields none
  const tables = files.slice(0, 3), [c0] = M.cardsOf(null), P = M.newParams(tables);
  M.restoreParams(U, P, M.initOf(U, c0, new Set()), tables);
  assert.deepEqual(M.snapshotOf(P), M.snapshotOf(M.newParams(tables)));
  // an old card's settings: its old keys ignored, the mass kept (a parameter there still is)
  const Q = M.newParams(tables), E = M.newParams(tables);
  M.restoreParams(U, Q, old, tables);
  E.ms = [10, 15, 15];
  assert.deepEqual(M.snapshotOf(Q), M.snapshotOf(E));
  assert.deepEqual([Q.mMode, Q.qMode, Q.startMode, Q.endMode, Q.startShared, Q.endShared, Q.tShared, Q.gasSel], ['all', 'all', 'all', 'all', 0, 24, 25, { a: ['h2', 'o2'], r: ['h2', 'o2'] }]);
  // the rates worked out from those tables, at 25 °C: as a new project's
  assert.deepEqual(card(Q, tables).csvs, card(E, tables).csvs);
  assert.ok(card(Q, tables).costResults.every(c=> Number.isFinite(c.rate.h2)), 'a rate for each');
  assert.ok(M.molarVolume(Q.tShared, Q.pShared) > 24.46 && M.molarVolume(Q.tShared, Q.pShared) < 24.47, '25 °C, 1 atm');
});

/* v586: a table whose reader throws on its bytes as a project opens (made here by bytes no
   decoder takes): the injections the project holds, said with why, kept by its bytes (to v585 the
   throw left the file out). */
test('an old project: a table whose reader throws, its injections held, said (v586)', ()=>{
  const t = rec('t.csv', decodeText(new Uint8Array(gcCsv({ h2: [0.05, 0.12], seed: 7 })))), bytes = new Proxy(new Uint8Array(t.rawBytes), {});
  let f;
  assert.doesNotThrow(()=>{ f = M.fileIn(U, { ...t, rawBytes: bytes }); });
  assert.deepEqual([f.injDates, f.gas, f.rawBytes], [t.injDates, t.gas, bytes]);
  assert.match(M.heldOf(f), /^its bytes no longer read: could not be read: .+: its data are those the project holds$/);
});

test('files as a project holds them, the replicates\' links, the pairs', ()=>{
  const d = new Date(2026, 0, 1);
  // A table: its dates that are dates, its gases' columns beside them; kept as it is when all is so.
  const ok = { name: 'a.csv', injDates: [d, new Date(+d + 6e5)], gas: { h2: [1, NaN] }, emptyRows: 2 };
  assert.equal(M.fileIn(U, ok), ok);
  assert.deepEqual(M.fileIn(U, { name: 'b', injDates: [d, 'x', +d], gas: { h2: [1, 2, 'q'], co2: [1] }, emptyRows: -1 }), { name: 'b', injDates: [d, new Date(+d)], gas: { h2: [1, NaN] }, emptyRows: 0 });
  assert.equal(M.fileIn(U, { injDates: ['x'], gas: { h2: [1] } }), null);
  // Raw chromatograms; pairs, the table first, a mate's own mate gone.
  const raw = { name: 'r_TCD.csv', tcd: { n: -1 }, rawBytes: [1] };
  assert.deepEqual(M.fileIn(U, raw), { name: 'r_TCD.csv', label: 'r_TCD', tcd: { n: 0 }, rawBytes: null });
  const p = M.fileIn(U, { ...raw, tcd: { n: 2 }, included: false, mate: { ...ok, mate: { name: 'z' } } });
  assert.deepEqual([p.name, p.included, p.held, p.mate.name, 'mate' in p.mate], ['a.csv', false, {}, 'r_TCD.csv', false]);
  assert.deepEqual(M.fileIn(U, { ...ok, mate: 7 }), { ...ok, label: 'a' }, 'a mate that is no file: the first alone');
  // The links: a head removed leaves its group to its next; a chain, a name twice, itself, raw chromatograms: none.
  const all = ['a', 'b', 'c', 'd'].map(n=> ({ name: n, label: n.toUpperCase(), injDates: [d], gas: { h2: [1] } }));
  all[2].sample = 'gone'; all[3].sample = 'gone';
  M.relink(all);
  assert.deepEqual(all.map(f=> f.sample), [undefined, undefined, undefined, 'c']);
  all[1].sample = 'd';
  M.relink(all);
  assert.deepEqual(all.map(f=> f.sample), [undefined, undefined, undefined, 'c'], 'a link to a file linked in turn: off');
  // A walk through a head's select: its group with it at each step, and back.
  let walk = M.setSample(all, null, 2, 'a', false);
  assert.deepEqual(all.map(f=> f.sample), [undefined, undefined, 'a', 'a']);
  walk = M.setSample(all, walk, 2, 'b', true);
  assert.deepEqual(all.map(f=> f.sample), [undefined, undefined, 'b', 'b']);
  walk = M.setSample(all, walk, 2, 'c', true);
  assert.deepEqual(all.map(f=> f.sample), [undefined, undefined, undefined, 'c'], 'back to its own, its group with it');
  assert.equal(M.setSample(all, walk, 0, 'nope', false), walk, 'no such head: nothing');
  // The samples: named after the head, labelled by it, or by the first included where it is left out.
  all[0].included = false; all[1].sample = 'a';
  assert.deepEqual(M.samplesOf(all, all.slice(1)), [{ name: 'a', label: 'B', ks: [0] }, { name: 'c', label: 'C', ks: [1, 2] }]);
  // Pairs: the rows given anew, the table first, a second's entries held; the warnings.
  const files = all.slice(1), S = [{ key: 'm', arr: [1, 2, 3], make: v => v ?? 9 }];
  const tcd = { name: 'b_TCD.csv', tcd: { n: 1 } };
  M.regroup(all, files, S, [[tcd, all[1]], [all[2], all[3]], [all[0]]]);
  assert.deepEqual([all.map(r=> [r.name, r.mate && r.mate.name]), all[1].mate.held, files.map(f=> f.name), S[0].arr], [[['b', 'b_TCD.csv'], ['c', 'd'], ['a', undefined]], { m: 3 }, ['b', 'c'], [1, 2]]);
  assert.deepEqual(M.partsOf(all[1]).map(x=> x.warn), ['', 'a second table: ignored (the first is the sample)']);
  assert.deepEqual(M.partsOf({ ...tcd, mate: tcd }).map(x=> x.warn), Array(2).fill('raw chromatograms paired with raw chromatograms: no injection times'));
  assert.deepEqual(M.rowFiles(all[0]).map(f=> f.name), ['b', 'b_TCD.csv']);
  assert.ok(M.hasTcd(all[0]) && !M.isTable(tcd) && M.isTcd(tcd));
});

/* A pair's note, marked for its issue (v573, alerts.js markOf): the file paired with the row's,
   or none. Its × marks that pair alone, in the list and in the states: the file paired
   wrongly again with another, or raw chromatograms left alone again, said again; the same
   pair made again, seen. A mark for the box (a table's rows left out, v572's) hides no pair.
   To v572 the row's file was marked for the box, whatever it was paired with later. A
   pair's files read from a project, their marks those that are one (alerts.js seenIn). */
test('a pair\'s note marked for its issue: paired wrongly again with another file, said again; the marks read clean', ()=>{
  const d = new Date(2026, 0, 1), tb = n => ({ name: n, label: n.slice(0, 1).toUpperCase(), injDates: [d], gas: { h2: [1] } }), tc = n => ({ name: n, label: n.slice(0, 1).toUpperCase(), tcd: { n: 1 } });
  const all = [tb('a.csv'), tb('b.csv'), tb('c.csv'), tc('t_TCD.csv'), tc('u_TCD.csv')], files = all.slice(0, 3);
  const hist = { states: [{ files: all.map(f=> ({ ...f })) }], patch(fn){ this.states = this.states.map(fn); } };
  const pair = (...rows)=> M.regroup(all, files, [], rows.map(r=> r.map(n=> all.flatMap(M.rowFiles).find(f=> f.name === n))));
  const said = ()=> H.fileNotes(all, HU).filter(n=> n.what === 'check' && PAGE.notesFor([n], n.what).length).map(n=> n.line.replace(/ Drag.*$/, ''));
  const dismiss = ()=> markSeen(hist, H.fileNotes(all, HU), 'check');
  pair(['a.csv', 'b.csv'], ['c.csv'], ['t_TCD.csv'], ['u_TCD.csv']);
  const AB = 'A: two tables paired (a.csv, b.csv): the first is used, as it is alone; b.csv is ignored.', T = 't_TCD.csv: raw chromatograms with no table: shown in Integration, left out of Analysis, with no injection times.';
  assert.deepEqual(said(), [AB, T, 'u_TCD.csv: raw chromatograms with no table: shown in Integration, left out of Analysis, with no injection times.']);
  dismiss();
  assert.deepEqual([said(), all[0].seen, all[2].seen, hist.states[0].files.map(f=> f.seen)], [[], ['check:pair:b.csv'], ['check:alone'], [['check:pair:b.csv'], undefined, undefined, ['check:alone'], ['check:alone']]], 'each marked for its issue, in the list and the state');
  // Unpaired: nothing to say; paired with c.csv: said; with b.csv again: seen.
  pair(['a.csv'], ['b.csv'], ['c.csv'], ['t_TCD.csv'], ['u_TCD.csv']);
  assert.deepEqual(said(), []);
  pair(['a.csv', 'c.csv'], ['b.csv'], ['t_TCD.csv'], ['u_TCD.csv']);
  assert.deepEqual(said(), ['A: two tables paired (a.csv, c.csv): the first is used, as it is alone; c.csv is ignored.'], 'paired wrongly again, with another file: said');
  pair(['a.csv', 'b.csv'], ['c.csv'], ['t_TCD.csv'], ['u_TCD.csv']);
  assert.deepEqual(said(), [], 'the pair seen, made again: seen');
  // Raw chromatograms seen alone, paired with raw chromatograms: said; alone again: seen.
  pair(['a.csv', 'b.csv'], ['c.csv'], ['t_TCD.csv', 'u_TCD.csv']);
  assert.deepEqual(said(), ['T: two files of raw chromatograms paired (t_TCD.csv, u_TCD.csv): shown in Integration, left out of Analysis, with no injection times.']);
  pair(['a.csv', 'b.csv'], ['c.csv'], ['t_TCD.csv'], ['u_TCD.csv']);
  assert.deepEqual(said(), []);
  // A mark for the box (a table's rows left out, as v572 marked it) hides its rows, not a pair.
  assert.deepEqual(PAGE.notesHtml(H.fileNotes([{ ...tb('x.csv'), badDates: 2, seen: ['check'], mate: tb('y.csv') }], HU), w=> w).match(/two tables paired|left out/g), ['two tables paired']);
  // As a project holds them: a pair's files' marks, those that are one, once each.
  const junk = ['check:pair:b.csv', 7, null, 'check:pair:b.csv', 'nope', 'check:', { read: 1 }, 'read'];
  const p = M.fileIn(U, { ...tc('t_TCD.csv'), seen: junk, mate: { ...tb('a.csv'), seen: [...junk, 'opened'] } });
  assert.deepEqual([p.name, p.seen, p.mate.name, p.mate.seen], ['a.csv', ['check:pair:b.csv', 'read', 'opened'], 't_TCD.csv', ['check:pair:b.csv', 'read']]);
  assert.ok(!('seen' in M.fileIn(U, { ...tc('t_TCD.csv'), seen: 'check', mate: tb('a.csv') }).mate), 'no mark: no seen');
});

/* A box's × marks its files in the states that hold them as a pair's second too (v574,
   inRows: to v573 the rows' records alone, and such a file, undone to that state and unpaired,
   was said again). A state with nothing to mark the same object; a state's own never changed. */
test('a note dismissed marks its file where a state holds it as a pair\'s second (inRows)', ()=>{
  const d = new Date(2026, 0, 1), tb = (n, x = {})=> ({ name: n, label: n.slice(0, 1).toUpperCase(), injDates: [d], gas: { h2: [1] }, ...x });
  const all = [tb('a.csv'), tb('b.csv', { altExport: true })];
  const paired = { files: [{ ...tb('a.csv'), mate: tb('b.csv', { altExport: true }) }] }, other = { files: [tb('c.csv')] };
  const hist = { states: [paired, other, { files: all.map(f=> ({ ...f })) }], patch(fn){ this.states = this.states.map(fn); } };
  markSeen(hist, H.fileNotes(all, HU), 'read', { put: M.inRows });
  const [p, o, n] = hist.states;
  assert.deepEqual([all[1].seen, n.files[1].seen, p.files[0].mate.seen, p.files[0].seen], [['read'], ['read'], ['read'], undefined], 'in the list, heading its row, and as a pair\'s second');
  assert.ok(o === other && !('seen' in paired.files[0].mate), 'a state with nothing to mark the same; a state\'s own objects never changed');
});

test('the cards\' markup, the parameter table and the alerts, every label escaped', ()=>{
  const b = H.cardBody({ id: 4 }, HU), r = H.resHtml({ id: 4 }, HU);
  for (const id of ['gc4Src', 'gc4ParamTableWrap', 'gc4Svg1', 'gc4Legend']) assert.ok(b.includes(`id="${id}"`), id);
  for (const id of ['gc4SvgRate', 'gc4SvgCum', 'gc4SvgBar', 'gc4ResLegend', 'gc4BarLegend']) assert.ok(r.includes(`id="${id}"`), id);
  assert.equal((b.match(/data-gas-sec="a"/g) || []).length, 1); assert.equal((r.match(/data-gas-sec="r"/g) || []).length, 3);
  const info = H.gcInfo('<i>cards</i>');
  assert.ok(info.endsWith(' <i>cards</i>') && info.includes('<math display="block">') && info.includes('<mn>24.465</mn>') && info.includes('<mn>163.50</mn>') && info.includes('<mn>0.98098</mn>'), 'the example worked out with the module\'s numbers');
  const f = { name: 'x.csv', label: '<b>&"', injDates: [new Date(2026, 0, 1, 10)], gas: { h2: [1, NaN] }, emptyRows: 1, altExport: true, dayMonth: true, badDates: 2 };
  const P = M.newParams([f]);
  P.lightOnDates[0] = new Date(2026, 0, 1, 9);
  const t = H.paramTableHtml(P, [f], HU);
  assert.ok(t.includes('title="&lt;b&gt;&amp;&quot;">&lt;b&gt;&amp;&quot;</td>') && !t.includes('<b>&"'), 'the label escaped');
  assert.equal((t.match(/<option /g) || []).length, 8, 'm/A and six units');
  // (v581: m or A chosen in the m column's header, its options the column's names; no "Normalize by" on the delay's row)
  assert.ok(t.includes('<option value="atm" selected>') && t.includes('<option value="m" selected>m (mg)</option><option value="A">A (cm²)</option>') && t.includes('class="gcDelayAuto" checked'));
  assert.ok(t.includes('<th rowspan="2"><div class="gc-th"><span><select class="gc-norm" aria-label="Normalize the rates by m or A"') && !t.includes('Normalize by'), 'in the header, accessible by its name');
  // (v582: in a compact type, its column 132 px, the table's least width 1000 px: gcp.test.mjs; to v581 136 px at 1060)
  assert.ok(t.includes('<col style="width:132px">') && /<select class="gc-norm"[^>]*font-size:11px/.test(t), 'its column wide enough for it, its type compact');
  assert.equal((t.match(/class="mode-chip gc-toggle"/g) || []).length, 6);
  assert.ok(t.includes('Light-on at or before the first injection: no point before light-on.'), 'light-on before the first injection: said');
  P.lightOnDates[0] = new Date(2026, 0, 1, 10, 1, 0);
  assert.ok(H.lightOnWarnHtml(P, [f], 0).includes('Light-on at or before the first injection: no point before light-on.'), 'at its logged date, before its injection (60.6 s later)');
  P.lightOnDates[0] = new Date(2026, 0, 1, 10, 1, 1);
  assert.equal(H.lightOnWarnHtml(P, [f], 0), '', 'after it');
  assert.equal(H.paramTableHtml(P, [], HU), '');
  P.normBy = 'A';
  assert.ok(H.paramTableHtml(P, [f], HU).includes('data-f="a"') && H.paramTableHtml(P, [f], HU).includes('<option value="A" selected>A (cm²)</option>'));
  // (v581: a sample with none of the one chosen: an info under the parameters naming it; a value none shown empty)
  assert.equal(H.normInfoHtml(P, [f], HU), '');
  P.aShared = null;
  assert.equal(H.normInfoHtml(P, [f], HU), '<div class="alert info compact">' + ALERT_ICON.info + 'No A for &lt;b&gt;&amp;&quot;: the rates are not normalised, in µmol h⁻¹ and µmol.</div>');
  assert.ok(H.paramTableHtml(P, [f], HU).includes('<input class="gcShared" data-f="a" type="text" inputmode="decimal" value=""'), 'none: empty');
  assert.ok(H.cardBody({ id: 4 }, HU).includes('id="gc4NormInfo"'));
  // The drop zone's alerts (v567, utils.js FILE ALERTS): one box to check (the pairs, the rows
  // left out, the empty cells), one of how the files were read (day/month, the alternative
  // export); each file's until its box's × marks it seen (v572, alerts.js).
  const A = boxes([f]);
  assert.equal(A, PAGE.alertHtml('warn', 'Loaded, to check:', ['x.csv: 2 rows left out: their injection date does not exist.',
    'x.csv: 1 empty H<sub>2</sub> cell: each of those injections is left out of that gas only, its rate, production and mean from the injections with a value.',
    'x.csv: 1 row with no gas value left out.'], 'gc-dismiss-check')
    // (v583: a table with no bytes, plotted from the injections the project holds, U8)
    + PAGE.alertHtml('warn', 'Opened, to check:', ['x.csv: its bytes are not stored: its data are those the project holds.'], 'gc-dismiss-opened')
    + PAGE.alertHtml('info', 'How these files were read:', ['x.csv: dates read as day/month.', 'x.csv: the alternative export (Inject Time, Amount in ppm).'], 'gc-dismiss-read'));
  assert.equal(boxes([{ ...f, seen: ['read'] }]), A.slice(0, A.indexOf('<div class="alert info"')), 'how they were read, dismissed');
  assert.equal(boxes([{ ...f, seen: ['read', 'check', 'opened'] }]), '', 'dismissed');
  for (const seen of ['check read', [['check', 'read']], { check: true }, null]) assert.equal(boxes([{ ...f, seen }]), A, 'a project\'s .json: a mark that is none marks nothing');
  assert.ok(!boxes([{ ...f, gas: {}, dayMonth: 'yes', badDates: 2.5, emptyRows: 'x', altExport: 1, seen: ['opened'] }]), 'a project\'s .json: only true and a whole count');
  const tcd = { name: '<t>_TCD.csv', label: 'T', tcd: { n: 1 } };
  assert.match(boxes([tcd, { ...f, mate: { ...f, name: 'y.csv' } }]), /&lt;t&gt;_TCD\.csv: raw chromatograms with no table: shown in Integration, left out of Analysis, with no injection times\.[\s\S]*&lt;b&gt;&amp;&quot;: two tables paired \(x\.csv, y\.csv\)/);
  const all = [f, { ...f, name: 'h.csv', label: 'H' }, { ...f, name: 'm.csv', label: 'M', sample: 'h.csv' }, tcd];
  assert.equal(H.sampleCell(all, all[2], 2, HU), '<select class="file-sample" data-i="2" aria-label="Sample" title="The sample this trace is: its own, or the one another trace heads (its replicates), by its label"><option value="x.csv" title="x.csv">&lt;b&gt;&amp;&quot;</option><option value="h.csv" title="h.csv" selected>H</option><option value="m.csv" title="m.csv">M</option></select>');
  assert.equal(H.sampleCell(all, tcd, 3, HU), '');
  const d = { label: 'S<1>', color: '#f00"', gas: { h2: {}, o2: {} } };
  assert.equal(H.gasLegendHtml(d, M.GASES, HU), '<span><i style="background:#f00&quot;"></i>S&lt;1&gt; H₂</span><span><i class="mk-dash" style="color:#f00&quot;"></i>S&lt;1&gt; O₂</span>');
  const src = H.srcAlertsHtml([{ label: 'A', src: { gas: { h2: [1] }, how: { h2: 'transfer', o2: 'table' }, why: { o2: 'no <cal>' }, k: { h2: { k: 41234.567 } } } }, { label: 'B', src: { gas: null, why: '2 rows, 3 chromatograms' } }, { label: 'C' }], 'Int <1>', HU);
  assert.ok(src.includes('re-integrated from the raw chromatograms (Int &lt;1&gt;)') && src.includes('A: H₂ by the GC software&#39;s scale (k = 41235)') && src.includes('A, O₂: no &lt;cal&gt;') && src.includes('B: 2 rows, 3 chromatograms'));
  // (the GC software's scale: where its risks are written, once; v567)
  assert.ok(src.includes('The GC software\'s scale (k): its risks are in the instructions of Int &lt;1&gt;.'));
  // (with samples and no rate, the card says why under it, v567)
  assert.ok(b.includes('id="gc4NoRate"') && H.NO_RATE === 'No rate to show: no sample\'s interval overlaps its injections.');
  assert.equal(H.srcAlertsHtml([{ label: 'C' }], '', HU), '');
  // (v584: an integration that failed, a compact error first, each sample's line with the job's
  // message, ALERTS-REVIEW.md R1–R4; to v583 "not done yet" in the warning)
  const fx = H.srcAlertsHtml([{ label: 'F<1>', src: { gas: null, why: 'its integration failed', failed: 'out of <memory>.' } }, { label: 'B', src: { gas: null, why: 'its integration was stopped before its end' } }], 'Int <1>', HU);
  assert.ok(fx.startsWith('<div class="alert bad compact">✕ The GC software\'s table used instead of the re-integration (Int &lt;1&gt;):<br>F&lt;1&gt;: the integration failed: out of &lt;memory&gt;.</div><div class="alert warn">'), fx);
  assert.ok(fx.includes('B: its integration was stopped before its end') && !fx.includes('F&lt;1&gt;: its integration failed'), 'the stopped one in the warning, the failed one not');
});

/* ---- The fixtures as v556's page analysed them ----
   The two fixtures dropped (the card as it starts), then five more: the UTF-16 table, the
   alternative export, a day/month file, one with dates that do not exist, one naming its
   months: every CSV the page wrote, as v556 wrote it (golden.page: their SHA-256). */
function pageSession(){
  const files = [rec('alpha.csv', fixture(0, { h2: [0.05, 0.12], o2: [0.02, 0.05], seed: 7 })), rec('beta.csv', fixture(1, { h2: [0.08, 0.07], seed: 8 }))];
  const out = { two: card(M.newParams(files), files).csvs };
  files.push(rec('gamma-u16.csv', gammaU16()), rec('alt-run 13.11.txt', ALT_MAIN), rec('dm.csv', DM), rec('bad.csv', BAD), rec('named.csv', NAMED));
  out.seven = card(M.newParams(files), files).csvs;
  return out;
}

/* ---- Cases as v556's gc.js gave them ----
   Random files (the default layout with blank and n.a. cells, the alternative export, a
   few gases, days apart), random links between them (a head left out too), a card's state
   (all or one, every parameter, mass or area, p's unit, the delay, values that are no number,
   the oldest projects' keys) and the CSVs' decimal mark: what gc.js gives of them, the files
   as a project holds them and their links (fileIn, relink), the card's state read back, its
   parameter table, its CSVs, the alerts and the Sample column, each case's digest
   (tests/golden/gcmodel.json). */
function cases(){
  const R = rng(557), u = R.u, pick = a => a[Math.floor(u()*a.length)], pad = n => String(n).padStart(2, '0');
  const table = k =>{
    const n = 2 + Math.floor(u()*12), gases = pick([['h2', 'o2'], ['h2'], ['o2'], ['h2', 'o2']]), t0 = Date.UTC(2026, 9, 1 + k, 8 + Math.floor(u()*4), Math.floor(u()*60));
    const rows = Array.from({ length: n }, (_, i)=>{ const d = new Date(t0 + i*(12 + Math.floor(u()*25))*60000 + Math.floor(u()*60)*1000), h = d.getUTCHours();
      return [`${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()} ${h % 12 || 12}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} ${h < 12 ? 'AM' : 'PM'}`,
        ...gases.map((g, j)=> u() < 0.08 ? pick(['', 'n.a.']) : (0.02 + 0.03*j + i*0.011*u()).toFixed(5))]; });
    if (u() < 0.25) return alt(rows.map(r=> [r[0].replace(/:\d\d (AM|PM)$/, '').replace(/ (\d+):/, ' $1:'), Object.fromEntries(gases.map((g, j)=> [g === 'h2' ? 'Hydrogen' : 'Oxygen', r[j + 1] === '' || r[j + 1] === 'n.a.' ? undefined : +r[j + 1]*1e4]).filter(e=> e[1] !== undefined))]));
    return ['Injection Date,' + gases.map(g=> g === 'h2' ? 'H2 (A) [%Mol]' : 'O2 (B) [%Mol]').join(','), ...rows.map(r=> r.join(','))].join('\n') + '\n';
  };
  const vals = [null, 'x', -1, 0, 1e307, [], 'one', 'all', 2.5, 30, 'area', 'Torr'];
  const keys = ['mMode', 'aMode', 'qMode', 'tMode', 'pMode', 'startMode', 'endMode', 'mShared', 'aShared', 'qShared', 'tShared', 'pShared', 'startShared', 'endShared', 'pUnit', 'normBy', 'delayAuto', 'delayMan'];
  return Array.from({ length: 60 }, (_, c)=>{
    const n = 1 + Math.floor(u()*4), names = Array.from({ length: n }, (_, k)=> `c${c}f${k}.${u() < 0.2 ? 'txt' : 'csv'}`);
    const files = names.map((name, k)=> ({ name, text: table(k), included: u() < 0.15 ? false : undefined, sample: u() < 0.3 ? pick(names) : undefined }));
    const st = { mMode: pick(['all', 'one']), qMode: pick(['all', 'one']), startMode: pick(['all', 'one']), endMode: pick(['all', 'one']), normBy: pick(['m', 'A']), pUnit: pick(Object.keys(M.P_UNITS)),
      tMode: pick(['all', 'one']), pMode: pick(['all', 'one']), aMode: pick(['all', 'one']), mShared: 5 + u()*20, qShared: 1 + u()*3, tShared: u()*40, pShared: 8e4 + u()*4e4, aShared: 0.5 + u()*3,
      startShared: u()*0.5, endShared: 1 + u()*4, delayAuto: u() < 0.7, delayMan: u()*120, gasSel: { a: pick([['h2'], ['o2'], ['h2', 'o2']]), r: pick([['h2'], ['o2'], ['h2', 'o2']]) },
      ms: names.map(()=> 5 + u()*20), As: names.map(()=> 0.5 + u()*2), Qs: names.map(()=> 1 + u()*3), Ts: names.map(()=> u()*40), Ps: names.map(()=> 9e4 + u()*2e4),
      startArr: names.map(()=> u()*0.6), endArr: names.map(()=> 1 + u()*5), lightOnDates: names.map(()=> u() < 0.7 ? null : Date.UTC(2026, 9, 1, 8, Math.floor(u()*60))) };
    for (const k of keys) if (u() < 0.08) st[k] = pick(vals);
    if (u() < 0.1){ for (const k of ['mMode', 'qMode', 'startMode', 'endMode']) delete st[k]; st.plateauStart = String(u()); st.plateauEnd = '3'; }
    if (u() < 0.1) for (const k of ['tMode', 'tShared', 'Ts', 'pMode', 'pShared', 'Ps', 'pUnit', 'normBy', 'As', 'aMode', 'aShared']) delete st[k];
    return { files, st, decimal: u() < 0.3 ? ',' : '.' };
  });
}
// What gc.js gives of a case (its Production Rate card, no Integration card above).
function runCase(c){
  settings.decimal = c.decimal;
  try {
    const all = c.files.map((x, k)=>{ const d = M.readGc(x.text); return d && !d.error ? M.fileIn(U, { name: x.name, label: x.name.replace(/\.[^.]+$/, ''), ...d, color: '#' + k, rawBytes: enc(x.text), ...(x.included === false ? { included: false, held: {} } : {}), ...(x.sample ? { sample: x.sample } : {}) }) : null; }).filter(Boolean);
    M.relink(all);
    const files = all.filter(f=> f.included !== false && M.isTable(f)), P = M.newParams(files);
    M.restoreParams(U, P, JSON.parse(JSON.stringify(c.st)), files);
    const k = card(P, files, all, 'card');
    return canon([all.map(f=> [f.name, f.sample, f.included]), M.snapshotOf(P), H.paramTableHtml(P, files, HU), k.csvs,
      boxes(all.filter(M.isTable)), all.map((f, i)=> H.sampleCell(all, f, i, HU))]);
  } finally { settings.decimal = '.'; }
}

test('the fixtures as v556\'s page analysed them, and 60 cases as v556\'s gc.js gave them (golden digests)', ()=>{
  const s = pageSession(), page = {};
  for (const [k, list] of Object.entries(s)) page[k] = list.map(e=> [e.name, sha(e.text)]);
  const got = { page, cases: cases().map(c=> sha(runCase(c))) };
  // (the fixtures' mean rates to the digit, as v556's page wrote them)
  assert.equal(s.two.find(e=> e.name.endsWith(' - mean_rates.csv')).text, 'Sample;Mean H2 Production Rate (umol g^-1 h^-1);Mean O2 Production Rate (umol g^-1 h^-1);Interval duration (h);p (atm);T (°C)\nalpha;1285.615928;534.818268;5.7668;1;25\nbeta;915.239971;;5.7668;1;25\n');
  if (UPDATE){ fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + '\n'); return; }
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  assert.deepEqual(got.page, want.page, 'the CSVs as v556\'s page wrote them');
  const off = got.cases.map((h, i)=> h === want.cases[i] ? null : i).filter(i=> i !== null);
  assert.deepEqual(off, [], 'cases whose digest differs');
  assert.equal(got.cases.length, want.cases.length);
});
