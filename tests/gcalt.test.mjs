/* GC's alternative export (v539), the instrument's tab-separated .txt, beside the default
   layout, and one reader of dates for both. Every file here is made up for the test.
   - The alternative's header (No., Inject Time, Area and Amount for each gas; then lines of
     units, channel and gases, a cell to the right by a leading tab; names with trailing
     spaces) matched to the data by the right ends: H₂ and O₂ from the Amount columns, N₂
     and the Area columns left, a file of H₂ alone read with it. Its ppm as %mol (ppm/10⁴):
     each injection's rate in gc_raw.csv and the mean rate over an interval as worked out by
     hand, gc_raw.csv writing its concentrations in ppm, headed so; a twin of it in the
     default layout (%mol) reading to the same dates, values and rates.
   - n.a. for one gas: the injection kept for the other, the empty-cells alert counting it;
     a row all n.a. (its date too) and lines of tabs alone passed over, unsaid; the label the
     file's name, its extension aside, as any GC file's.
   - Every date form in both layouts: a year of 4 digits or 2, with seconds or without,
     AM/PM or 24 hours, a month named in any case and in either place; numeric dates still
     found month/day or day/month as before; a date that does not exist (31 November, 24:00,
     13:00 PM, 60 minutes) left out and said, naming no order where the month is named.
   - The info alert: a line per file read as the alternative, none for the default; a
     circled i and azure in both themes, not the warning's colours, under the drop zone in
     the warning's box; dismissed through undo and redo, said for a file dropped since and
     again in a reopened project; a hand-edited project puts nothing but `true` in it, the
     name as text.
   - The default layout as before: the fixture's record (no key more) and its numbers in
     gc_raw.csv; blank lines, lines of separators and rows of n.a. in it unsaid, the file
     reading as without them. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { start, openModule, loadFiles, settle, moduleState, undo, download, readZip, parseCsv, PAYLOAD, injected } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const T = '\t';
/* An alternative export: rows [date, { Hydrogen, Nitrogen, Oxygen: ppm }] (a gas a row does
   not give is n.a.), 'na' for a row all n.a. (its date too), 'tabs' for a line of tabs
   alone; the header as the instrument writes it. The areas, invented, are never read. */
function alt(name, rows, gases = ['Hydrogen', 'Nitrogen', 'Oxygen']){
  const n = gases.length, w = 2 + 2*n;
  const lines = [
    ['No. ', 'Inject Time ', ...gases.map((_, i)=> i === 1 ? 'Area' : 'Area '), ...gases.map((_, i)=> i ? 'Amount ' : 'Amount')].join(T),
    T + ['', '', ...gases.map(()=> 'pA*min'), ...gases.map(()=> '')].join(T),
    T + ['', '', ...Array(2*n).fill('PDD_Ch_1')].join(T),
    T + ['', '', ...gases, ...gases].join(T),
    ...rows.map((r, i)=> r === 'tabs' ? T.repeat(w - 1) : r === 'na' ? [String(140 + i), ...Array(w - 1).fill('n.a.')].join(T)
      : [String(i + 1), r[0], ...gases.map((g, j)=> g in r[1] ? (0.00007*(j + 1)*(i + 2)).toFixed(7) : 'n.a.'), ...gases.map(g=> g in r[1] ? String(r[1][g]) : 'n.a.')].join(T)),
    T.repeat(w - 1),
  ];
  return { name, mimeType: 'text/plain', buffer: Buffer.from(lines.join('\r\n') + '\r\n') };
}
const csv = (name, text)=> ({ name, mimeType: 'text/csv', buffer: Buffer.from(text) });

// H₂ n.a. in its first row, O₂ in its fourth; a row all n.a. and a line of tabs between.
const MAIN = [
  ['13/Nov/26 14:13:01', { Nitrogen: 225.5345, Oxygen: 119.1363 }],
  ['13/Nov/26 14:43:01', { Hydrogen: 0.141, Nitrogen: 205.9831, Oxygen: 99.2521 }],
  'na',
  ['13/Nov/26 15:13:01', { Hydrogen: 412.5, Nitrogen: 210.4, Oxygen: 130.75 }],
  'tabs',
  ['13/Nov/26 15:43:01', { Hydrogen: 455, Nitrogen: 208 }],
  ['13/Nov/26 16:13:01', { Hydrogen: 521.25, Nitrogen: 207.5, Oxygen: 150 }],
];
const MAIN_NAME = 'alt-run 13.11.txt';
// The same injections twice: the alternative in ppm, the default in %mol.
const TWIN_ALT = alt('twin-alt.txt', [['13/Nov/2026 14:13', { Hydrogen: 412, Nitrogen: 300, Oxygen: 187 }], ['13/Nov/2026 14:43', { Hydrogen: 455, Nitrogen: 301 }],
  ['13/Nov/2026 15:13', { Hydrogen: 521, Nitrogen: 302, Oxygen: 230 }], ['13/Nov/2026 15:43', { Hydrogen: 563, Nitrogen: 299, Oxygen: 251 }]]);
const TWIN_DEFAULT = csv('twin-default.csv', 'Injection Date,H2 (A) [%Mol],O2 (A) [%Mol]\n11/13/2026 2:13:00 PM,0.0412,0.0187\n11/13/2026 2:43:00 PM,0.0455,\n11/13/2026 3:13:00 PM,0.0521,0.0230\n11/13/2026 3:43:00 PM,0.0563,0.0251\n');
// H₂ 500 ppm and O₂ 250 ppm at every injection, every 20 min.
const CONST = alt('const.txt', [0, 20, 40, 60, 80].map(m=> [`13/Nov/2026 ${10 + Math.floor(m/60)}:${String(m % 60).padStart(2, '0')}`, { Hydrogen: 500, Nitrogen: 1000, Oxygen: 250 }]));

// By hand: m 15 mg, Q 2 mL/min, at 25 °C and 1 atm (a new card's); the injection delay 60.6 s.
const R = 8.314462618/101.325, F = 2/1000*60/(R*298.15);     // L·atm/(mol·K); mol/h of the flow
const rateOfPpm = ppm => ppm/1e6*F*1e6/15;                     // µmol/h per mg = mmol g⁻¹ h⁻¹
const rateOfPct = pct => pct/100*F*1e6/15;
const DELAY = 60.6;

const files = st => Object.fromEntries(st.files.map(f=> [f.name, f]));
const alerts = page => page.$$eval('#gcAlerts .alert', els=> els.map(e=> e.innerText.split('\n').map(s=> s.trim()).filter(Boolean)));
const INFO_HEAD = 'Read as the alternative export (Inject Time, Amount in ppm), not the default format:';
const infoAlert = async page => (await alerts(page)).find(a=> a[0] === INFO_HEAD) || null;
const dateAlert = async page => (await alerts(page)).find(a=> a[0].startsWith('⚠ Injection dates')) || null;
const blankAlert = async page => (await alerts(page)).find(a=> a[0].startsWith('⚠ Empty cells skipped')) || null;
const zip = async page =>{
  const z = await download(page, ()=> page.click('.proj-csv'));
  return Object.fromEntries(readZip(z.buf).map(e=> [e.name.replace(/^.* - /, ''), parseCsv(e.data.toString('utf8').replace(/^﻿/, ''), ';')]));
};
// A CSV's column by its header, and a row's cell by the header.
const column = (rows, h)=>{ const j = rows[0].indexOf(h); assert.ok(j >= 0, `no column ${h} in ${rows[0].join(' | ')}`); return rows.slice(1).map(r=> r[j]); };
const type = async (page, sel, v)=>{ await page.fill(sel, v); await page.press(sel, 'Enter'); await settle(page); };
const restore = (page, st)=> page.evaluate(async st=>{
  const u = await import('./utils.js'), db = await import('./db.js');
  u.restoreModuleState('gc', db.decode(st));
  for (let i = 0; i < 2; i++) await new Promise(r=> requestAnimationFrame(r));
}, st).then(()=> settle(page));
const encoded = page => page.evaluate(async ()=>{ const u = await import('./utils.js'), db = await import('./db.js'); return db.encode(u.getModuleState('gc')); });
const iso = s => s.slice(0, 19);

test('the alternative export: Amount in ppm as %mol, N₂ and the areas left, n.a. per gas, rows of n.a. and tabs passed over; its rates by hand', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', [alt(MAIN_NAME, MAIN), TWIN_ALT, TWIN_DEFAULT,
      alt('h2only.txt', [['13/Nov/2026 9:00', { Hydrogen: 100, Nitrogen: 5 }], ['13/Nov/2026 9:30', { Hydrogen: 120, Nitrogen: 6 }]], ['Hydrogen', 'Nitrogen']), CONST]);
    const by = files(await moduleState(page, 'gc', true)), f = by[MAIN_NAME];
    // The injections with a date, each gas's Amount over 10⁴ (n.a.: none for that gas alone).
    assert.deepEqual(f.injDates.map(iso), ['2026-11-13T14:13:01', '2026-11-13T14:43:01', '2026-11-13T15:13:01', '2026-11-13T15:43:01', '2026-11-13T16:13:01']);
    assert.deepEqual(f.gas, { h2: [null, 0.141/1e4, 412.5/1e4, 455/1e4, 521.25/1e4], o2: [119.1363/1e4, 99.2521/1e4, 130.75/1e4, null, 150/1e4] }, 'H₂ and O₂ from Amount, N₂ left');
    assert.deepEqual([f.emptyRows, f.altExport, f.monthNames, f.dayMonth, f.badDates], [0, true, true, undefined, undefined]);
    assert.equal(f.label, 'alt-run 13.11', 'the label: the file\'s name, its extension aside, as any GC file\'s');
    assert.deepEqual(Object.keys(by['h2only.txt'].gas), ['h2'], 'H₂ alone');
    assert.deepEqual(by['h2only.txt'].gas.h2, [0.01, 0.012]);
    // The twins: the same dates and the same %mol, to the bit.
    assert.deepEqual(by['twin-alt.txt'].injDates, by['twin-default.csv'].injDates);
    assert.deepEqual(by['twin-alt.txt'].gas, by['twin-default.csv'].gas);
    assert.equal(by['twin-default.csv'].altExport, undefined);
    // Said: the files read as the alternative, in order; the empty cells (n.a. as blank).
    assert.deepEqual(await infoAlert(page), [INFO_HEAD, MAIN_NAME, 'twin-alt.txt', 'h2only.txt', 'const.txt']);
    const blank = await blankAlert(page);
    assert.ok(blank.includes(`${MAIN_NAME}: 1 empty H2 cell, 1 empty O2 cell`), blank.join(' / '));
    assert.equal(await dateAlert(page), null, 'every date exists');

    // gc_raw.csv: each injection's concentration in ppm (its column so headed), its rate by hand.
    let z = await zip(page);
    const raw = z['gc_raw.csv'], L = f.label;
    assert.ok(!raw[0].includes(`H2 (%mol) [${L}]`));
    const t = column(raw, `Time (h) [${L}]`), lightOn = Date.parse('2026-11-13T14:13:00Z');
    const want = MAIN.filter(Array.isArray).map(([d, g])=> ({ t: ((+new Date(Date.parse(`2026-11-13T${d.slice(10)}Z`) + DELAY*1000) - lightOn)/3600e3).toFixed(5), g }));
    for (const [gas, name] of [['h2', 'Hydrogen'], ['o2', 'Oxygen']]){
      const ppm = column(raw, `${gas.toUpperCase()} (ppm) [${L}]`), rate = column(raw, `${gas.toUpperCase()} Production Rate (mmol g^-1 h^-1) [${L}]`);
      for (const w of want){
        const i = t.indexOf(w.t);
        assert.ok(i >= 0, `${gas} at ${w.t} h: a row`);
        if (!(name in w.g)){ assert.deepEqual([ppm[i], rate[i]], ['', ''], `${gas} at ${w.t} h: n.a., no value`); continue; }
        assert.equal(ppm[i], w.g[name].toFixed(5), `${gas} at ${w.t} h: ppm`);
        assert.ok(Math.abs(parseFloat(rate[i]) - rateOfPpm(w.g[name])) <= 6e-6, `${gas} at ${w.t} h: rate ${rate[i]} for ${rateOfPpm(w.g[name])}`);
      }
    }
    // The default twin writes %mol, the alternative ppm; their rates the same.
    assert.deepEqual(column(raw, 'H2 (ppm) [twin-alt]').filter(Boolean), ['0.00000', '412.00000', '455.00000', '521.00000', '563.00000']);
    assert.deepEqual(column(raw, 'H2 (%mol) [twin-default]').filter(Boolean), ['0.00000', '0.04120', '0.04550', '0.05210', '0.05630']);
    for (const g of ['H2', 'O2']) assert.deepEqual(column(raw, `${g} Production Rate (mmol g^-1 h^-1) [twin-alt]`), column(raw, `${g} Production Rate (mmol g^-1 h^-1) [twin-default]`), `${g}: the twins' rates`);

    // The mean rate from 0.5 to 1.2 h: constant concentrations, the constant rate.
    await type(page, '#tab-gc .gcShared[data-f="start"]', '0.5');
    await type(page, '#tab-gc .gcShared[data-f="end"]', '1.2');
    z = await zip(page);
    const mean = z['mean_rates.csv'], row = lab => mean.slice(1).find(r=> r[0] === lab);
    const H2 = mean[0].indexOf('Mean H2 Production Rate (mmol g^-1 h^-1)'), O2 = mean[0].indexOf('Mean O2 Production Rate (mmol g^-1 h^-1)');
    assert.ok(Math.abs(parseFloat(row('const')[H2]) - rateOfPpm(500)) <= 1e-6, `H₂ mean ${row('const')[H2]} for ${rateOfPpm(500)}`);
    assert.ok(Math.abs(parseFloat(row('const')[O2]) - rateOfPpm(250)) <= 1e-6, `O₂ mean ${row('const')[O2]} for ${rateOfPpm(250)}`);
    assert.ok(Math.abs(rateOfPpm(500) - 0.163497) < 1e-6, 'by hand: 500 ppm at 2 mL/min, 25 °C, 1 atm, over 15 mg');
    assert.deepEqual(row('twin-alt').slice(1), row('twin-default').slice(1), 'the twins\' mean rates');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('dates: every form in both layouts, numeric ones found month/day or day/month as before, those that do not exist left out and said', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    const DEF = csv('dates-default.csv', ['Injection Date,H2 (B) [%Mol],O2 (A) [%Mol]',
      '11/13/26 9:00 AM,0.10,0.05', '11/13/2026 9:15:30 AM,0.11,0.06', '11/13/2026 09:30,0.12,n.a.', '11/13/2026 13:45:15,N.A.,0.07',
      '13/Nov/2026 2:00 PM,0.14,0.08', 'Nov/13/26 14:15:00,0.15,0.09', '13/NOVEMBER/26 14:30,0.16,0.10', 'n.a.,n.a.,n.a.', ''].join('\n'));
    const ALT = alt('dates-alt.txt', ['13/Nov/26 14:13:01', '13/Nov/2026 14:43', '13/nov/26 3:13 PM', '13/November/2026 3:43:30 PM', '14/Nov/26 0:13',
      '14/Nov/26 12:43:00 AM', '14/Nov/26 12:13 PM', '31/Nov/26 10:00', '14/Nov/26 24:00', '14/Nov/26 13:00 PM', '14/Nov/26 10:60'].map((d, i)=> [d, { Hydrogen: 100 + i, Oxygen: 50 + i }]));
    await loadFiles(page, 'gc', [DEF, ALT]);
    let by = files(await moduleState(page, 'gc', true));
    const d = by['dates-default.csv'], a = by['dates-alt.txt'];
    assert.deepEqual(d.injDates.map(iso), ['2026-11-13T09:00:00', '2026-11-13T09:15:30', '2026-11-13T09:30:00', '2026-11-13T13:45:15', '2026-11-13T14:00:00', '2026-11-13T14:15:00', '2026-11-13T14:30:00']);
    assert.deepEqual(d.gas, { h2: [0.10, 0.11, 0.12, null, 0.14, 0.15, 0.16], o2: [0.05, 0.06, null, 0.07, 0.08, 0.09, 0.10] }, 'n.a. a blank cell for its gas alone');
    assert.deepEqual([d.emptyRows, d.dayMonth, d.badDates, d.monthNames, d.altExport], [0, undefined, undefined, undefined, undefined]);
    assert.deepEqual(a.injDates.map(iso), ['2026-11-13T14:13:01', '2026-11-13T14:43:00', '2026-11-13T15:13:00', '2026-11-13T15:43:30', '2026-11-14T00:13:00', '2026-11-14T00:43:00', '2026-11-14T12:13:00']);
    assert.deepEqual(a.gas.h2, [100, 101, 102, 103, 104, 105, 106].map(v=> v/1e4));
    assert.deepEqual([a.badDates, a.monthNames, a.dayMonth], [4, true, undefined]);
    // The alert names no order for a month named.
    assert.deepEqual(await dateAlert(page), ['⚠ Injection dates:', 'dates-alt.txt: 4 rows left out: their injection date does not exist']);
    assert.ok((await blankAlert(page)).includes('dates-default.csv: 1 empty H2 cell, 1 empty O2 cell'));
    // Numeric dates in the new forms: day/month found, its month/day twin, a typo left out, as before.
    await loadFiles(page, 'gc', [
      csv('dm24.csv', 'Injection Date,H2 (B) [%Mol]\n13/10/25 23:30,0.1\n13/10/25 23:45,0.2\n14/10/25 0:00,0.3\n14/10/25 0:15:30,0.4\n'),
      csv('md24.csv', 'Injection Date,H2 (B) [%Mol]\n10/13/25 23:30,0.1\n10/13/25 23:45,0.2\n10/14/25 0:00,0.3\n10/14/25 0:15:30,0.4\n'),
      csv('typo24.csv', 'Injection Date,H2 (B) [%Mol]\n10/5/25 23:45,0.1\n16/10/25 0:00,0.2\n10/6/25 0:15,0.3\n10/6/25 0:30,0.4\n')]);
    by = files(await moduleState(page, 'gc', true));
    assert.deepEqual(by['dm24.csv'].injDates.map(iso), ['2025-10-13T23:30:00', '2025-10-13T23:45:00', '2025-10-14T00:00:00', '2025-10-14T00:15:30']);
    assert.deepEqual(by['dm24.csv'].injDates, by['md24.csv'].injDates);
    assert.deepEqual([by['dm24.csv'].dayMonth, by['md24.csv'].dayMonth, by['dm24.csv'].monthNames], [true, undefined, undefined]);
    assert.deepEqual(by['typo24.csv'].injDates.map(iso), ['2025-10-05T23:45:00', '2025-10-06T00:15:00', '2025-10-06T00:30:00']);
    assert.deepEqual([by['typo24.csv'].dayMonth, by['typo24.csv'].badDates], [undefined, 1]);
    assert.deepEqual(await dateAlert(page), ['⚠ Injection dates (the instrument writes them month/day):',
      'dates-alt.txt: 4 rows left out: their injection date does not exist',
      'dm24.csv: dates read as day/month (as month/day, some do not exist)',
      'typo24.csv: 1 row left out: its injection date does not exist (as month/day)']);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('the info alert: for the alternative alone, a circled i in azure in both themes, dismissed through undo and redo, said again in a reopened project', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', [env.fx.files.gc[0]]);
    assert.deepEqual(await alerts(page), [], 'the default: no alert');
    await loadFiles(page, 'gc', [alt(MAIN_NAME, MAIN)]);
    assert.deepEqual(await infoAlert(page), [INFO_HEAD, MAIN_NAME]);
    assert.ok(await blankAlert(page), 'its empty cells said as a warning beside it');
    // Under the drop zone, in the warning's box, its own icon and colours.
    const look = ()=> page.evaluate(()=>{
      const rgb = s => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
      const of = el =>{ const s = getComputedStyle(el); return { color: rgb(s.color), bg: rgb(s.backgroundColor), line: rgb(s.borderTopColor), box: [s.paddingTop, s.paddingRight, s.borderRadius, s.fontSize, s.marginTop, s.borderTopWidth].join(' ') }; };
      const info = document.querySelector('#gcAlerts .alert.info'), warn = document.querySelector('#gcAlerts .alert.warn'), ic = info.querySelector('svg.alert-ic');
      return { info: of(info), warn: of(warn), ic: ic && rgb(getComputedStyle(ic).color), icH: ic && ic.getBoundingClientRect().height,
        under: info.parentElement.id === 'gcAlerts' && info.parentElement.previousElementSibling.id === 'gcDropzone',
        x: !!info.querySelector('.alert-dismiss[data-action="gc-dismiss-alt"]'), text: info.textContent.trim().slice(0, 4) };
    });
    const lum = c =>{ const l = c.map(v=> v/255).map(v=> v <= 0.03928 ? v/12.92 : ((v + 0.055)/1.055)**2.4); return 0.2126*l[0] + 0.7152*l[1] + 0.0722*l[2]; };
    const contrast = (a, b)=>{ const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05)/(Math.min(x, y) + 0.05); };
    for (const theme of ['dark', 'light']){
      await page.evaluate(async t=>{ const u = await import('./utils.js'); u.applyTheme(t); }, theme);
      await settle(page);
      const s = await look();
      assert.ok(s.under && s.x, `${theme}: under the drop zone, with its ×`);
      assert.equal(s.text, 'Read', `${theme}: no ⚠ before its words`);
      assert.deepEqual(s.ic, s.info.color, `${theme}: the icon in the text's colour`);
      assert.ok(s.icH >= 11 && s.icH <= 15, `${theme}: the icon as tall as the text (${s.icH})`);
      assert.equal(s.info.box, s.warn.box, `${theme}: the warning's box`);
      assert.notDeepEqual(s.info.color, s.warn.color, `${theme}: not the warning's colour`);
      assert.notDeepEqual(s.info.bg, s.warn.bg, `${theme}: not the warning's background`);
      for (const c of [s.info.color, s.info.bg, s.info.line]) assert.ok(c[2] > c[0] && c[2] >= c[1], `${theme}: azure, ${c}`);
      assert.ok(theme === 'dark' ? lum(s.info.bg) < 0.05 : lum(s.info.bg) > 0.8, `${theme}: a background of the theme (${s.info.bg})`);
      assert.ok(contrast(s.info.color, s.info.bg) >= 4.5, `${theme}: the text reads (${contrast(s.info.color, s.info.bg).toFixed(2)})`);
    }
    await page.evaluate(async ()=>{ const u = await import('./utils.js'); u.applyTheme('dark'); });
    // Dismissed: the files on show, through undo and redo; a file dropped since said alone.
    await page.click('#gcAlerts [data-action="gc-dismiss-alt"]');
    await settle(page);
    assert.equal(await infoAlert(page), null, 'dismissed');
    assert.ok(await blankAlert(page), 'the warning stays');
    await loadFiles(page, 'gc', [TWIN_ALT, TWIN_DEFAULT]);
    assert.deepEqual(await infoAlert(page), [INFO_HEAD, 'twin-alt.txt'], 'the new file alone');
    await undo(page);
    assert.equal(await infoAlert(page), null, 'undone: the files on show dismissed');
    await undo(page, true);
    assert.deepEqual(await infoAlert(page), [INFO_HEAD, 'twin-alt.txt'], 'redone');
    // A project reopened: said again, for each file read so.
    const st = await encoded(page);
    await restore(page, st);
    assert.deepEqual(await infoAlert(page), [INFO_HEAD, MAIN_NAME, 'twin-alt.txt'], 'reopened');
    // By hand: anything but true says nothing; a name is text.
    const edited = JSON.parse(JSON.stringify(st)), f0 = edited.files.find(f=> f.name === MAIN_NAME);
    edited.files = [PAYLOAD, 'true', 1, null, {}].map((v, i)=> ({ ...f0, altExport: v, name: `${PAYLOAD} ${i}.txt` }));
    edited.files.push({ ...f0, name: PAYLOAD + '.txt' });
    await restore(page, edited);
    assert.equal(await page.locator('#gcFileTableWrap tr.file-row').count(), 6);
    assert.deepEqual(await infoAlert(page), [INFO_HEAD, `${PAYLOAD}.txt`]);
    assert.deepEqual(await injected(page), [], 'nothing from the project made markup');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('the default layout as before: the fixture\'s record and numbers; blank lines, lines of separators and rows of n.a. unsaid', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    const src = fs.readFileSync(env.fx.files.gc[0], 'utf8'), lines = src.trim().split('\n');
    // The same file with lines that are no data between its rows.
    const junk = [lines[0], '', ',,', lines[1], ';;;', '\t\t', lines[2], 'n.a.,n.a.,n.a.', ' , , ', ...lines.slice(3), ',,', ''].join('\n');
    await loadFiles(page, 'gc', [csv(path.basename(env.fx.files.gc[0]), src), csv('alpha-junk.csv', junk)]);
    assert.deepEqual(await alerts(page), [], 'nothing said');
    const by = files(await moduleState(page, 'gc', true)), fx = by[path.basename(env.fx.files.gc[0])];
    assert.deepEqual(Object.keys(fx).sort(), ['color', 'emptyRows', 'gas', 'injDates', 'label', 'name', 'rawBytes'], 'no key more');
    const vals = lines.slice(1).map(l=> l.split(','));
    assert.deepEqual(fx.injDates, vals.map((_, i)=> new Date(Date.UTC(2026, 9, 20, 9, 15*i)).toISOString()));
    assert.deepEqual(fx.gas, { h2: vals.map(v=> parseFloat(v[1])), o2: vals.map(v=> parseFloat(v[2])) });
    assert.deepEqual([by['alpha-junk.csv'].injDates, by['alpha-junk.csv'].gas], [fx.injDates, fx.gas], 'read as without them');
    // gc_raw.csv as before: %mol, its rate by hand.
    const raw = (await zip(page))['gc_raw.csv'];
    const pct = column(raw, 'H2 (%mol) [alpha]'), rate = column(raw, 'H2 Production Rate (mmol g^-1 h^-1) [alpha]');
    assert.ok(!raw[0].some(h=> h.includes('(ppm)')));
    assert.deepEqual(pct.slice(1).filter(Boolean), vals.map(v=> parseFloat(v[1]).toFixed(5)));
    pct.forEach((p, i)=>{ if (p) assert.ok(Math.abs(parseFloat(rate[i]) - rateOfPct(parseFloat(p))) <= 6e-6, `rate at row ${i}`); });
    assert.deepEqual(column(raw, 'O2 Production Rate (mmol g^-1 h^-1) [alpha]'), column(raw, 'O2 Production Rate (mmol g^-1 h^-1) [alpha-junk]'));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
