/* =========================================================
   GC — the Production Rate cards' calculations, which touch no page (gc.js wires them to
   the cards; tests/gcmodel.test.mjs calls them in Node): the gases, the flow's molar volume
   and the pressure's units; a file read (the injection dates in every form both exports
   write, day/month found, the dates that do not exist left out; the default layout and the
   alternative .txt export, ppm as %mol; raw chromatograms told by what they hold); a file as
   a project holds it (a table, raw chromatograms, a pair); the replicates' links and
   samples; the pairs' rows; a card's parameters (all and one, the injection delay, mass or
   area), its tables (each gas's times, flows, rates and production), its mean rates over
   the interval and by sample, the Results' series cut to the interval, what its plots draw
   (the ranges, the interval lines, the bars), its CSVs, its state saved and read back (the
   projects of every version before). Taken out of v556's gc.js with their operations in
   their order: the same numbers to the last bit.

   utils.js's and modkit.js's helpers, which need a page to load, are handed in as one
   object, U = { settings, fmtNum, csvLine, cumtrapz, maxArr, minArr, meanArr, stdArr, objId,
   exactKey, num, numStr, oneOf, dateOf, arrOf, without, wideCsv } (gc.js U).

   A card's settings are its parameters P (newParams; gc.js's card holds them): the
   per-sample arrays ms, As, Qs, Ts, Ps, startArr, endArr, lightOnDates, aligned with the
   included samples (`files`); each parameter's all/one mode and shared value; what the rates
   are normalised by (norm), p's unit, the injection delay, and the gases each section draws
   (gasSel).
========================================================= */
import { textLines, readTable, parseNum, width } from './textdata.js';
import { readTcd } from './gc-tcd.js';
import { looksTcd } from './gc-pair.js';
import { fixed } from './db.js';
import { keepSeen, inKeys } from './alerts.js';

/* ---- The gases, the flow and the pressure (pure: the module's, for every instance) ---- */
// Axis titles. The SVG form carries the superscripts (g⁻¹, cm⁻², h⁻¹); the plain form is
// the matching CSV header.
const SUP1 = '<tspan baseline-shift="super" font-size="8">-1</tspan>';
const SUP2 = '<tspan baseline-shift="super" font-size="8">-2</tspan>';
/* What a card's rates are normalised by (v540), one choice a card so that its plots and its
   bar chart never mix units: the photocatalyst's mass m (mg), the rate in µmol g⁻¹ h⁻¹ and
   the production in µmol g⁻¹, or, for a film, its area A (cm²), in µmol cm⁻² h⁻¹ and
   µmol cm⁻². Both in µmol (from v541; by mass mmol g⁻¹ h⁻¹ and mmol g⁻¹ to v540, the same
   quantity, its numbers now 1000 times those): a gas's flow in µmol/h over the parameter
   as typed, times `per`, the parameter's units in one of the rate's denominator — 1000 mg
   in a g (m mg is m/1000 g), 1 cm² in a cm². Each with its labels, made alike: the axis
   titles (SVG), the CSV headers, the column of the parameter table and of gc_info.csv. */
const normOf = (per, svg, csv, col, colCsv)=> ({ per, col, colCsv,
  rateSvg: `Production Rate (µmol ${svg} h${SUP1})`, cumSvg: `Production (µmol ${svg})`,
  rateCsv: `Production Rate (umol ${csv} h^-1)`, cumCsv: `Production (umol ${csv})`, unitCsv: `umol ${csv} h^-1` });
export const NORM = {
  mass: normOf(1000, `g${SUP1}`, 'g^-1', 'm (mg)', 'm (mg)'),
  area: normOf(1, `cm${SUP2}`, 'cm^-2', 'A (cm²)', 'A (cm^2)'),
};
export const NORMS = Object.keys(NORM);

/* The gases the module can read, in display order. `col` finds the column: the name
   has to carry the formula as a word of its own, or "O2" would also match the "CO2"
   column that sits beside it in a typical GC export. Both gases get the identical
   treatment — %mol, molar flow, normalised (NORM), integrated — since the instrument hands
   over calibrated mole fractions for each. */
export const GASES = [
  { key:'h2', label:'H<sub>2</sub>', csv:'H2', dash:'',    bar:'#3aa0ff',
    col:/(^|[^a-z0-9])h2([^a-z0-9]|$)/ },
  { key:'o2', label:'O<sub>2</sub>', csv:'O2', dash:'5,4', bar:'#ff7a59',
    col:/(^|[^a-z0-9])o2([^a-z0-9]|$)/ },
];
// Plain-text form for series names, where markup would be drawn literally.
export const gasTxt = g => g.csv.replace('2', '₂');
/* A cell with no value: blank or not a number at parse (NaN), null once a project has
   been through JSON. It is left out of its gas's series (tablesOf). A sample has
   a gas when its column holds a value in at least one injection. */
export const noValue = v => !Number.isFinite(v);
export const hasGas = (f, k)=> !!f.gas[k] && !f.gas[k].every(noValue);
/* The injection date is stamped when the run starts, and the sample is injected a
   little later: every injection is moved on by this delay, in seconds, before it is
   set against light-on. "Auto" is the method's own figure, shown in the field. */
export const INJ_DELAY_AUTO = 60.6;
/* The molar volume the flow Q is turned into moles with: an ideal gas at the temperature
   T (°C) and the absolute pressure p the flow is measured at, V_m = R·T/p, 22.414 L/mol
   at 0 °C and 1 atm, 24.465 at 25 °C. T is each card's, all/one as m and Q are: 25 °C in
   a new card and for a new file, 0 °C in a project saved before it existed, whose rates
   were worked out at 22.41396954 L/mol (to v500, whatever the flow meter's). p the same
   way: 1 atm in a new card, for a new file and in a project saved before it, whose rates
   were worked out at it (to v500 p was 1 atm, fixed). */
export const R_ATM = 0.0820573661;    // R, L·atm/(mol·K)
export const molarVolume = (T, p)=> R_ATM*(T + 273.15)/(p/P_ATM);
export const T_NEW = 25, T_OLD = 0, okT = v => v >= -273;
/* p is kept in Pa, as typed in its unit; the unit, the card's, is only how it is shown
   and written, so switching it never moves the pressure. Each unit's size in Pa is a
   fraction, so that a value typed goes to Pa and back exactly where it can (760 Torr is
   101325 Pa); shown to 12 digits, which leaves out the last bit a conversion may add
   (1.1 bar is 110000.00000000001 Pa). Torr is mmHg to 1 part in 7 million. */
export const P_ATM = 101325, P_MAX = 1e300;   // (a p below P_MAX in its unit is a number in Pa)
export const P_UNITS = { atm: [P_ATM, 1], bar: [1e5, 1], kPa: [1000, 1], mbar: [100, 1], Torr: [P_ATM, 760], psi: [6894.757293168361, 1] };
export const toPa = (v, u)=> v*P_UNITS[u][0]/P_UNITS[u][1];
export const inUnit = (pa, u)=> +(pa*P_UNITS[u][1]/P_UNITS[u][0]).toPrecision(12);
/* A pressure as the fields make one: above 0, and at most P_MAX in the largest unit (atm),
   so that it is a number in every unit. One restored or kept for a file past these is
   taken as the default, as a mass or a flow is (a hand-edited project's 1e307 Pa was
   shown as Infinity in Torr, and written so in the CSVs). */
export const okP = v => v > 0 && v <= P_MAX*P_ATM;
// A card's per-sample arrays, as its state names them.
export const PER_SAMPLE = ['ms', 'Qs', 'Ts', 'Ps', 'startArr', 'endArr', 'lightOnDates'];
// A table's empty cells per gas (the rows with no gas value, `emptyRows`, apart: v567).
export function blankCounts(f){ return GASES.map(g=> f.gas[g.key] ? f.gas[g.key].filter(noValue).length : 0); }
// Why a file the GC reader gives nothing for is not loaded (modkit.js dropText's `none`).
export const NOT_GC = 'not a GC table: no injection date and H₂ or O₂ column under a header';

/* ---- Reading a file ---- */
/* An injection date, as both exports write it (one reader for both, v539): day, month and
   year between '/', the month a number or an English name (Nov, November; any case), the
   year of 4 digits or 2 (26 is 2026); then the time, h:mm or h:mm:ss (no seconds: 00),
   with AM or PM or in 24 hours without. 'M/D/YYYY h:mm:ss AM|PM' is the default export's,
   '13/Nov/26 14:13:01' and '13/Nov/2026 14:13' the alternative's. → its fields as they
   stand, [a, b, year, h, min, s, AM|PM], or null for a field of another shape (no line of
   data: 'n.a.', a header). To v538 only the default's, its seconds and AM/PM required. */
const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MON = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const GC_DATE = new RegExp(`^(\\d{1,2}|${MON})\\/(\\d{1,2}|${MON})\\/(\\d{4}|\\d{2})\\s+(\\d{1,2}):(\\d{2})(?::(\\d{2}))?(?:\\s*(AM|PM))?$`, 'i');
// A month's number from its name (1–12), 0 for a number.
export const monthOf = s =>{ const i = /^\d/.test(s) ? -1 : MONTH_NAMES.indexOf(s.slice(0, 3).toLowerCase()); return i + 1; };
export const dateFields = s =>{ const m = String(s || '').trim().match(GC_DATE); return m && !(monthOf(m[1]) && monthOf(m[2])) ? m.slice(1) : null; };
// Whether those fields name their month (the order then is theirs: no day/month to find).
export const namesMonth = m => !!(monthOf(m[0]) || monthOf(m[1]));
/* The moment those fields are, the day first when `dm` (a file read as day/month), or
   null when there is none: a month 1–12, a day 1 to the month's length (29 February in a
   leap year), the hour 1–12 with AM or PM and 0–23 without, minutes and seconds 0–59. A
   month named is the month where it stands, the other number the day, whatever `dm`. To
   v509 none was checked and the Date rolled over: 13/10/2025 was 10 January 2026,
   2/30/2025 2 March, 13:00:00 PM 1 PM. */
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export function parseGCDate(m, dm){
  const [a, b, yy, h, mi, se, ap] = m, na = monthOf(a), nb = monthOf(b);
  const mo = nb || na || +(dm ? b : a), da = nb ? +a : na ? +b : +(dm ? a : b);
  const y = yy.length === 2 ? 2000 + +yy : +yy, hh = +h, s = se === undefined ? 0 : +se;
  const len = mo === 2 && !(y % 4) && (y % 100 || !(y % 400)) ? 29 : MONTH_DAYS[mo - 1];
  if (!(da >= 1 && da <= len && (ap ? hh >= 1 && hh <= 12 : hh <= 23) && +mi <= 59 && s <= 59)) return null;
  return new Date(y, mo - 1, da, ap ? hh % 12 + (/pm/i.test(ap) ? 12 : 0) : hh, +mi, s);
}

/* A GC export, as textdata.js reads a table (its encoding, separator, decimal mark and
   quotes found from the file). Its header names the injection date and at least one
   gas, each in a column of its own: whichever gases it has are read, the rest simply are
   not there for that sample. The header is the first line that names them (to v489 it
   had to be the first line), the data the lines under it with an injection date.
   The dates are read in the instrument's order, month/day, where every one exists so (a
   file of days up to 12 too, either way). A file where some do not is read day/month
   (`dayMonth`) when every one exists so and the times so read go on as the rows do,
   back by an hour at most (a clock put back at the end of summer time): a file saved
   day first. Any other is read month/day, the rows whose date does not exist so left
   out (`badDates`): a month/day file with a mistyped date that would exist day first
   (16/10 among 10/5 and 10/6), whose times would go back months, and one whose dates
   fail both ways. The alerts say both (gc-html.js dateLines); a file with no
   injection left for a date that does not exist is refused with why. To v509 every date
   was month/day, rolled over. A date that names its month (13/Nov/26) has no order to
   find: it is the same either way, and a file of those alone is never day/month
   (`monthNames`: the alert then names no order).
   A cell that is no number ('n.a.', any case, as a blank: parseNum gives NaN) is no value
   for that gas alone; a line that is no data (blank, only separators or tabs, 'n.a.' for
   its date) is passed over unsaid, as ever.
   Two layouts: the default (gcColumns), a header naming the injection date and each
   gas's %mol; the alternative (altColumns, v539), the instrument's .txt, its gases in
   ppm, its files said in an info alert (`altExport`, gc-html.js altLines). */
/* (v549: the column naming each injection, for the calibration's window: the default
   export's Analysis, else a sample's or a name's column; -1 none) */
const NAME_COL = /^(analysis|sample( name| id)?|name|injection name)$/;
const nameCol = fields => fields.map(h=> String(h || '').toLowerCase().replace(/\s+/g, ' ').trim()).findIndex(h=> NAME_COL.test(h));
export function gcColumns(fields){
  const lo = fields.map(h=> h.toLowerCase()), date = lo.findIndex(h=> h.includes('injection date')), gas = {};
  for (const g of GASES){ const i = lo.findIndex(h=> g.col.test(h) && h.includes('%mol')); if (i >= 0 && i !== date) gas[g.key] = i; }
  return date >= 0 && Object.keys(gas).length ? { date, gas, name: nameCol(fields) } : null;
}
/* The alternative export (v539): the instrument's .txt, tab-separated, a header of four
   lines over the injections: the columns' names (No., Inject Time, Area ×3, Amount ×3),
   their units, the channel, and the gas of each Area and Amount column (Hydrogen,
   Nitrogen, Oxygen), the three under the first shifted a cell right by a leading tab. Its
   header is a line naming Inject Time and Amount over a line naming H₂ or O₂, before the
   first line with a date. Its columns are the data's (the lines with a date under it, as
   wide as most of them are), each header line set against them by its right end, where
   they all end whatever their lead (a trailing separator adds none). H₂ and O₂ are the
   Amount columns of Hydrogen and Oxygen, in ppm (readGc: %mol = ppm/10⁴); the Area
   columns and the other gases are left. → { date, gas, alt: true } in the data's columns,
   or null. */
const ALT_GAS = { hydrogen: 'h2', h2: 'h2', oxygen: 'o2', o2: 'o2' };
const cellName = c => String(c || '').toLowerCase().replace(/\s+/g, ' ').trim();
const isAmount = c => /^amount\b/.test(cellName(c));
export function altColumns(fields, rows, h){
  const at = fields.map(cellName).indexOf('inject time');
  if (at < 0 || !fields.some(isAmount)) return null;
  const below = rows.slice(h + 1), dated = r => r.some(c=> dateFields(c)), first = below.findIndex(dated);
  const gasLine = first < 0 ? null : below.slice(0, first).reverse().find(r=> r.some(c=> ALT_GAS[cellName(c)]));
  if (!gasLine) return null;
  // The data's width: the most common among the lines with a date (on a tie the wider).
  const ws = new Map();
  let n = 0, most = 0;
  below.slice(first).filter(dated).forEach(r=>{ const w = width(r); ws.set(w, (ws.get(w) || 0) + 1); });
  ws.forEach((k, w)=>{ if (k > most || (k === most && w > n)){ n = w; most = k; } });
  // Each header line's cell over data column d, by the right ends.
  const o1 = width(fields) - n, og = width(gasLine) - n, date = at - o1, gas = {};
  if (date < 0 || date >= n) return null;
  for (let d = 0; d < n; d++){
    const k = isAmount(fields[d + o1]) && ALT_GAS[cellName(gasLine[d + og])];
    if (k && !(k in gas)) gas[k] = d;
  }
  const nm = nameCol(fields), name = nm < 0 ? -1 : nm - o1;
  return Object.keys(gas).length ? { date, gas, alt: true, name: name >= 0 && name < n ? name : -1 } : null;
}
export function readGc(text, withNames){
  const t = readTable(textLines(text), (f, sep, rows, h)=> gcColumns(f) || altColumns(f, rows, h), (r, c)=> !!dateFields(r[c.date]));
  if (!t) return null;
  const { date, gas: idx, alt, name } = t.cols, injDates = [], gas = {}, names = [];
  // The lines with a date, and its fields; day first when every date exists so and not
  // month first, its times never back by more than an hour.
  const rows = t.rows.map(r=> [r, dateFields(r[date])]).filter(x=> x[1]);
  const md = rows.map(x=> parseGCDate(x[1], false)), df = rows.map(x=> parseGCDate(x[1], true));
  const dm = !md.every(Boolean) && df.every((d, i)=> d && (!i || d - df[i - 1] >= -3600e3));
  const named = rows.every(x=> namesMonth(x[1]));
  let emptyRows = 0, badDates = 0, lost = 0;
  for (const k in idx) gas[k] = [];
  for (const [i, [r]] of rows.entries()){
    const d = (dm ? df : md)[i], vals = {};
    let any = false;
    // (the alternative's ppm as %mol, the unit every table, plot and CSV is in)
    for (const k in idx){ const v = parseNum(r[idx[k]]); vals[k] = isFinite(v) ? (alt ? v/1e4 : v) : NaN; if (isFinite(v)) any = true; }
    // (`lost`: a row with a value whose date does not exist, an injection but for it)
    if (!d){ badDates++; if (any) lost++; continue; }
    // One row, every gas kept on the same time axis; a blank cell stays NaN so the
    // columns never slip out of step with the dates. The analysis leaves it out of
    // that gas's series (tablesOf) and the alerts count it (gc-html.js blankLines).
    // A row with no gas at all is left out, as it was, and the alert counts it too (to
    // v474 it went unsaid).
    if (any){ injDates.push(d); for (const k in idx) gas[k].push(vals[k]); if (name >= 0) names.push(String(r[name] || '').trim()); }
    else emptyRows++;
  }
  /* No injection left: refused with why, the rows with a value whose date went (the other
     rows, none with a gas value, counted beside them), or the rows with a date, none with a
     gas value (v571: to v570 refused as no GC table, "no injection date and H₂ or O₂ column
     under a header", which it has). (dayMonth, badDates, monthNames and altExport only where
     they apply: any other file's record is as it was.) */
  const rest = rows.length - lost;
  if (!injDates.length) return lost ? { error: `no injection to read: ${lost} row${lost > 1 ? 's' : ''} with an injection date that does not exist${rest ? `, ${rest} with no gas value` : ''}` }
    : rows.length ? { error: `no injection to read: ${rest} row${rest > 1 ? 's' : ''} with an injection date and no gas value` } : null;
  for (const k in gas) fixed(gas[k]);
  // (`withNames`, the calibration's window only: each injection's name, null with no column of them)
  return { injDates, gas, emptyRows, ...(dm && { dayMonth: true }), ...(badDates && { badDates }), ...(named && { monthNames: true }), ...(alt && { altExport: true }),
    ...(withNames && { names: name >= 0 ? names : null }) };
}

/* ---- Raw chromatograms (TCD, v544) ----
   A file is a table or raw chromatograms by what it holds (looksTcd: no header, a line of
   numbers), never by its name. Raw chromatograms are kept as their bytes and the number of
   chromatograms (`tcd: { n }`), read again from the bytes when they are shown or integrated
   (gc-integ.js), but for the drop's own reading, handed over (`seen`) so that it is not
   read twice. A row of the file list is one record: a table, raw chromatograms, or a
   pair, the first file's record with the second as its `mate` (a table first beside raw
   chromatograms). Only a table heading its row is a sample of the analysis (`isTable`). */
// (modkit.js's isObj and isArr, which these records are read with: modkit.js needs a page)
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isArr = v => Array.isArray(v) || (ArrayBuffer.isView(v) && !(v instanceof DataView));
export const isTcd = f => isObj(f) && isObj(f.tcd);
export const isTable = f => isObj(f) && isArr(f.injDates) && isObj(f.gas);
export const hasTcd = r => isTcd(r) || (isObj(r) && isTcd(r.mate));
// (`seen(bytes, read)`: readTcd's result, for the Integration cards: gc-integ.js prime)
export function readGcAny(text, bytes, seen){
  if (!looksTcd(text)) return readGc(text);
  const d = readTcd(text);
  if (d.error) return { error: `raw chromatograms that cannot be read: ${d.error}` };
  seen(bytes, d);
  return { tcd: { n: d.cols.length } };
}

// The first injection, to the minute: the field shows and sets minutes only, so a
// default carrying the seconds would change the moment the field was merely tabbed
// through — results shifting, and an undo step, with nothing touched.
export function firstInjection(f){
  const d = new Date(Math.min(...f.injDates.map(Number))); d.setSeconds(0, 0);
  return d;
}

/* ---- A file as a restore takes it (modkit RESTORED) ---- */
/* A table's record: its injections, each with a date that is one, and the columns of the
   gases it has beside them, a cell that is no number an empty one; none of either, it is
   left out. A record that is all that already is kept as it is: the empty-cell and the
   dates' alerts dismissed stay so (gc.js seen.check and seen.read mark its gases). */
export function tableIn(U, f){
    if (!isArr(f.injDates) || !isObj(f.gas)) return null;
    const n = f.injDates.length, ks = Object.keys(f.gas), emptyRows = U.num(f.emptyRows, 0, v=> v >= 0);
    if (n && ks.length && f.injDates.every(d=> U.dateOf(d) === d) && ks.every(k=> GASES.some(g=> g.key === k) && Array.isArray(f.gas[k]) && f.gas[k].length === n)){
      ks.forEach(k=> fixed(f.gas[k]));
      return emptyRows === f.emptyRows ? f : { ...f, emptyRows };
    }
    const at = [], injDates = [], gas = {};
    Array.from(f.injDates).forEach((d, i)=>{ const v = U.dateOf(d); if (v){ at.push(i); injDates.push(v); } });
    for (const g of GASES){ const a = f.gas[g.key]; if (isArr(a)) gas[g.key] = fixed(at.map(i=> Number.isFinite(a[i]) ? a[i] : NaN)); }
    return injDates.length && Object.keys(gas).length ? { ...f, injDates, gas, emptyRows } : null;
}
/* Raw chromatograms (v544) as a restore takes them: their bytes (none: not stored in this
   browser, the Integration card says so) and how many chromatograms; a pair, its two files
   each taken so (a mate with nothing to show dropped, the first file alone then), the table
   first beside raw chromatograms. A mate's own mate, none; its marks of what was said seen
   those that are one (alerts.js seenIn), as the row's (modkit.js keptFile): it heads a row
   once it is unpaired. */
export function oneIn(U, f){
  if (!isObj(f)) return null;
  const name = typeof f.name === 'string' && f.name ? f.name : 'file', label = typeof f.label === 'string' ? f.label : name.replace(/\.[^.]+$/, '');
  const { mate: _m, ...g } = { ...f, name, label };
  keepSeen(g);
  if (isTcd(g)) return { ...g, tcd: { n: U.num(g.tcd.n, 0, v=> Number.isInteger(v) && v >= 0) }, rawBytes: g.rawBytes instanceof Uint8Array ? g.rawBytes : null };
  return tableIn(U, g);
}
// (a file as a pair's second: its box is the row's, not its own)
export const loose = r =>{ const { included: _i, mate: _m, ...x } = r; return x; };
export function pairIn(U, f){
  const a = oneIn(U, f), b = isObj(f.mate) ? oneIn(U, f.mate) : null;
  const out = f.included === false ? { included: false, held: isObj(f.held) ? f.held : {} } : {};
  if (!a || !b) return a || (b ? { ...loose(b), ...out } : null);
  if (isTcd(a) && isTable(b)) return { ...loose(b), ...out, mate: loose(a) };
  return { ...a, mate: loose(b) };
}
// A file as a restore takes it (tableIn), raw chromatograms and pairs too (pairIn, v544).
export const fileIn = (U, f)=> isTcd(f) || 'mate' in f ? pairIn(U, f) : tableIn(U, f);
/* A state's rows marked by a box's × under the drop zone (alerts.js markSeen's `put`,
   modkit.js markIn): each row's record and its pair's second, so that a file heading its row
   now is marked too where an older state holds it paired (v574: to v573 the rows' records
   alone, and such a file, undone to that state and unpaired, was said again). The state
   itself where none changed. */
export const inRows = (s, mark)=> inKeys(['files'])(s, v =>{
  if (!Array.isArray(v)) return mark(v);
  const w = v.map(r=>{ const g = mark(r), m = isObj(g) && isObj(g.mate) ? mark(g.mate) : null; return m && m !== g.mate ? { ...g, mate: m } : g; });
  return w.some((g, i)=> g !== v[i]) ? w : v;
});

/* ---- REPLICATES ----
   Each file is a sample of its own, or a replicate of another file's: its record's
   `sample`, the name of the file that heads the group, which the list's Sample column
   chooses, by the head's label (v535; its name to v534). Linked by the file's name, its
   identity in the list (the drop loads no name twice), not by its label: a label renamed
   changes no link, only the name shown. No chains: a file is linked
   to a head alone (a file linked to none), and a head linked to another takes its group
   along. Every plot and CSV stays per file but the mean-rate bars and mean_rates.csv,
   one per sample (samplesOf, sampleRates). `all` is every record, in list order. */
// The files by name, those whose name is theirs alone (`twice`, the others: a hand-edited project's).
export function byName(all){
  const by = new Map(), twice = new Set();
  all.forEach(f=>{ if (by.has(f.name)) twice.add(f.name); by.set(f.name, f); });
  twice.forEach(n=> by.delete(n));
  return { by, twice };
}
export const isHead = f => !('sample' in f);
/* The links as they should be. A head no longer in the list (removed): its group stays,
   the first of it in list order heading it and the others linked to that one. What a
   project read in may hold besides (RESTORED): a link that is no name, to the file
   itself, to a name two files have, or to a file linked in turn (a chain): taken off,
   the file its own sample. */
export function relink(all){
  const { by, twice } = byName(all), heir = new Map();
  all.forEach(f=>{
    const s = f.sample;
    if (typeof s !== 'string' || by.has(s) || twice.has(s)) return;
    if (heir.has(s)) f.sample = heir.get(s); else { heir.set(s, f.name); delete f.sample; }
  });
  // (raw chromatograms with no table are no sample: no head, linked to none)
  all.forEach(f=>{ if (isHead(f)) return; const h = typeof f.sample === 'string' && by.get(f.sample); if (!h || h === f || !isHead(h) || !isTable(h) || !isTable(f)) delete f.sample; });
}
// A file's head: the file it is linked to, or itself.
export const headOf = (f, by)=> (!isHead(f) && by.get(f.sample)) || f;
/* File i's sample chosen (modkit noteChange): its own, it heads one again; a head's, it
   joins that one's, with the files it headed. A walk through its select's options
   (`again`: the arrow keys, each a choice, the focus kept) is one choice changed: the
   files it headed as the walk began (`walk`) go with it at each step, and back to it
   with its own. Taken each step from the links then, a head stepped on to a second head
   left its group on the first, and stepped back to its own left it there, the select
   showing what it showed before. → the walk, as it goes on (`walk` as it was, where the
   choice is none). */
export function setSample(all, walk, i, name, again){
  const f = all[i], h = byName(all).by.get(name);
  if (!f || !h || !isTable(f) || !isTable(h) || !(h === f || isHead(h))) return walk;
  if (!again || !walk || walk.f !== f) walk = { f, m: all.filter(g=> g.sample === f.name) };
  walk.m.forEach(g=>{ g.sample = h.name; });
  if (h === f) delete f.sample; else f.sample = h.name;
  return walk;
}
/* The samples of the included files (`files`), in the order of their first: each { name,
   label, ks, the places of its files among the included }, named after its head (its
   file's name, the key of its bar), labelled with its head's label, or, the head left
   out, its first included file's. Each included file its own: the files, as before
   replicates. */
export function samplesOf(all, files){
  const { by } = byName(all), out = new Map();
  files.forEach((f, k)=>{
    const h = headOf(f, by);
    if (!out.has(h)) out.set(h, { name: h.name, label: (h.included !== false ? h : f).label, ks: [] });
    out.get(h).ks.push(k);
  });
  return [...out.values()];
}
// A gas on show: one of the included samples has it (hasGas), in its table: a gas the table
// lacks that the raw chromatograms paired with it give (by standards) keeps its chip greyed.
export const gasPresent = (files, k)=> files.some(f=> hasGas(f, k));

/* ---- PAIRS (v544) ----
   A table and its raw chromatograms share a row of the file list: the table's record, the
   raw chromatograms its `mate`. Files dropped pair by their names (gc-pair.js autoPair: the
   same name but for a final _TCD, any case, a browser's " (1)" aside), with each other or
   with a file alone in the list; a file dragged by its own grip onto another pairs or swaps
   (dropPart). Which kind each file is never changes the pairing: two tables or two files
   of raw chromatograms may be paired, which is said (gc-html.js pairNotes): of two
   tables the first is the sample, the second ignored; two files of raw chromatograms have
   no times, no sample. Pairing is a change: a step of the history, saved. */
export const rowFiles = r => r.mate ? [(({ mate: _m, ...x })=> x)(r), r.mate] : [r];
/* The rows given anew (arrays of files): the list's records (`all`) made of them, the
   table first beside raw chromatograms, and the per-sample arrays (`slots`, every card's)
   following the samples by name: a sample still one keeps its entries, one that is a
   pair's second now holds them (`held`, as a file left out does) for when it heads a row
   again, one new takes what it holds or the defaults. `files`, the included samples,
   taken again. */
export function regroup(all, files, S, rows){
  const before = new Map();
  files.forEach((f, k)=> before.set(f.name, S.map(s=> s.arr[k])));
  const recs = rows.filter(r=> r.length).map(r=>{
    let [a, b] = r;
    if (b && isTcd(a) && isTable(b)) [a, b] = [b, a];
    const p = { ...a }; delete p.mate;
    if (!b) return p;
    const q = loose(b);
    if (before.has(q.name)) q.held = Object.fromEntries(S.map((s, j)=> [s.key, before.get(q.name)[j]]));
    return { ...p, mate: q };
  });
  all.splice(0, all.length, ...recs);
  const now = all.filter(f=> f.included !== false && isTable(f));
  S.forEach((s, j)=>{ s.arr.splice(0, s.arr.length, ...now.map(f=> before.has(f.name) ? before.get(f.name)[j] : s.make(isObj(f.held) ? f.held[s.key] : undefined, f))); });
  now.forEach(f=>{ delete f.held; });
  files.splice(0, files.length, ...now);
}
// The trace list's FILE column for a pair's row: each file, and what is wrong with it.
export function partsOf(r){
  const fs = rowFiles(r), two = fs.length > 1, tt = two && isTable(fs[0]) && isTable(fs[1]), cc = two && isTcd(fs[0]) && isTcd(fs[1]);
  return fs.map((f, k)=> ({ name: f.name, warn: tt && k ? 'a second table: ignored (the first is the sample)' : cc ? 'raw chromatograms paired with raw chromatograms: no injection times' : '' }));
}

// The analyses' kinds (cards.js), as the menu lists them.
// (v544: Integration, the raw chromatograms integrated again, gc-integ.js; offered while
// some are loaded, and never a kind a card is switched to: a different analysis)
export const KINDS = { rate: 'Production Rate', integ: 'Integration' };

/* =========================================================
   A CARD's parameters (P): its masses or areas, flows, temperatures, pressures, light-on
   times, integration intervals and injection delay, and the gases each section draws.
========================================================= */
// A card added with samples loaded starts from the upload defaults for each.
export function newParams(files){
  const P = {
    ms: [], As: [], Qs: [], Ts: [], Ps: [], startArr: [], endArr: [], lightOnDates: [],
    /* Analysis and Results choose their gases separately, but every plot inside a
       section follows that section's choice — the chips on each plot are views of one
       set, not five independent ones. Each section holds a SET of gas keys rather than
       one mode, so any combination is reachable and a third gas would need no new
       option; the only rule is that a section can never end up with none. */
    gasSel: { a: GASES.map(g=>g.key), r: GASES.map(g=>g.key) },
    // all/one per parameter: 'all' = one shared value for every sample; 'one' = per-sample.
    // Each of m, A, Q, T, p, start and end toggles independently. Default: everything shared ('all').
    mMode: 'all', aMode: 'all', qMode: 'all', tMode: 'all', pMode: 'all', startMode: 'all', endMode: 'all',
    mShared: 15, aShared: 1, qShared: 2, tShared: T_NEW, pShared: P_ATM, startShared: 0, endShared: 24,
    /* What the rates are normalised by (NORM, v540): 'mass' (m, as to v539) or 'area' (A,
       a film's), the card's one choice. The masses and the areas are both kept, each with
       its all/one, whichever is in force: switching back and forth loses neither. */
    norm: 'mass',
    pUnit: 'atm',
    delayAuto: true, delayMan: INJ_DELAY_AUTO,
  };
  files.forEach(f=>{ P.ms.push(15); P.As.push(1); P.Qs.push(2); P.Ts.push(T_NEW); P.Ps.push(P_ATM); P.startArr.push(0); P.endArr.push(24); P.lightOnDates.push(firstInjection(f)); });
  return P;
}
export const injDelay = P => P.delayAuto ? INJ_DELAY_AUTO : P.delayMan;
export const injectedAt = (P, d)=> new Date(+d + injDelay(P)*1000);
// Effective per-sample values (respect each parameter's all/one mode).
export const mOf     = (P, k)=> P.mMode==='all'     ? P.mShared     : P.ms[k];
export const aOf     = (P, k)=> P.aMode==='all'     ? P.aShared     : P.As[k];   // cm²
// What sample k's rates are divided by: its mass in mg, or its area in cm².
export const perOf   = (P, k)=> P.norm==='area' ? aOf(P, k) : mOf(P, k);
export const qOf     = (P, k)=> P.qMode==='all'     ? P.qShared     : P.Qs[k];
export const tOf     = (P, k)=> P.tMode==='all'     ? P.tShared     : P.Ts[k];
export const pOf     = (P, k)=> P.pMode==='all'     ? P.pShared     : P.Ps[k];   // Pa
export const startOf = (P, k)=> P.startMode==='all' ? P.startShared : P.startArr[k];
export const endOf   = (P, k)=> P.endMode==='all'   ? P.endShared   : P.endArr[k];
// The plot shows per-sample interval lines (interactive) whenever either bound is per-sample.
export const intPerSample = P => P.startMode==='one' || P.endMode==='one';

// Warning when a sample's light-on time is before (or at) its first injection
export function lightOnWarn(P, files, i){
  const f = files[i], lo = P.lightOnDates[i];
  if (!f || !lo || isNaN(+lo)) return false;
  return !f.injDates.some(d => injectedAt(P, d) < lo);
}

/* What a section actually draws (sec: 'a' Analysis, 'r' Results): chosen, and present in at
   least one included sample; when none chosen is there, every gas that is. Worked out at
   each render from the files of the moment, the choice itself left as the user made it: to
   v474 renderGasSel pruned it to the gases loaded, so an O2 file added after an H2-only
   one stayed hidden. */
export function shownGases(P, files, sec){
  const there = GASES.filter(g=> gasPresent(files, g.key));
  const chosen = there.filter(g=> P.gasSel[sec].includes(g.key));
  return chosen.length ? chosen : there;
}

// Parse a raw field string into a finite number, or null if incomplete/invalid.
export function parseIntervalField(v){
  const s = String(v).trim().replace(',', '.');   // accept comma decimals
  if (s==='' || s==='-' || s==='+' || s==='.' || s==='-.' || s==='+.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
/* Why the interval's bound `which` cannot be `v` (null when it can): a start not before
   the end, or an end not after the start, of a sample it applies to (`k`; every sample
   for the common value, isShared). The words are the same when a value typed is refused
   and when the all/one chip is (to v494 a value typed was refused with no word). */
export function intervalWhy(P, files, which, v, isShared, k){
  const bad = (isShared ? files.map((_, i)=> i) : [k]).find(i=> which === 'start' ? !(v < endOf(P, i)) : !(v > startOf(P, i)));
  if (bad === undefined) return null;
  const who = files.length > 1 ? ` of ${files[bad].label}` : '';
  return which === 'start' ? `The interval must start before it ends: ${v} h is not before the end${who}, ${endOf(P, bad)} h.`
    : `The interval must end after it starts: ${v} h is not after the start${who}, ${startOf(P, bad)} h.`;
}
/* An all/one chip pressed (`pair`, the parameter): flipped, seeding across the boundary
   (one→all from sample 0, all→one from the shared value). An interval bound back to all,
   sample 0's for every sample, is refused as a value typed is, with the same words, where
   it would not leave each interval's start before its end (intervalWhy; to v494 it was
   taken as it was): → why, and nothing changed; else null. */
const MODES = { m: ['mMode', 'mShared', 'ms'], a: ['aMode', 'aShared', 'As'], q: ['qMode', 'qShared', 'Qs'], t: ['tMode', 'tShared', 'Ts'], p: ['pMode', 'pShared', 'Ps'],
  start: ['startMode', 'startShared', 'startArr'], end: ['endMode', 'endShared', 'endArr'] };
export function flipMode(P, files, pair){
  const back = { start: P.startMode, end: P.endMode }[pair] === 'one';
  const why = back ? intervalWhy(P, files, pair, (pair === 'start' ? P.startArr : P.endArr)[0], true) : null;
  if (why) return why;
  const m = MODES[pair];
  if (!m) return null;
  const [mode, shared, arr] = m;
  if (P[mode]==='one'){ P[shared] = P[arr][0]; P[mode] = 'all'; }
  else { files.forEach((f,i)=>{ P[arr][i]=P[shared]; }); P[mode] = 'one'; }
  return null;
}

/* ---- A card's tables ----
   A sample's values (v544): its table's, or, paired with its raw chromatograms and an
   Integration card above the card, that card's (gc-integ.js valuesFor: each gas
   re-integrated where it can be, the table's where it cannot, and why), the table's dates
   giving the times either way: G, the gases' values. Its tables kept by gc.js (tablesKept)
   under all they are made from (tablesKey). */
export const tablesKey = (U, P, f, h, G, lightOn)=>{
  const ks = Object.keys(G);
  return U.exactKey([f.injDates.map(d=> +d), ks.map(k=> [k, U.objId(G[k])]), +lightOn, injDelay(P), qOf(P, h), tOf(P, h), pOf(P, h), P.norm === 'area' ? ['A', aOf(P, h)] : mOf(P, h)]);
};
export function tablesOf(U, P, f, h, lightOn, G = f.gas){
  const hours = d => (d - lightOn)/3600000;
  // The injections in time order; `t`, the sample's times (the light-on instant
  // among them), spans the plot's x-range.
  const rows = f.injDates.map((d,i)=> ({ d: injectedAt(P, d), i })).sort((a,b)=>a.d-b.d);
  const t = [...rows.map(r=> r.d), lightOn].sort((a,b)=>a-b).map(hours);
  // Total molar flow: mL/min -> L/h -> mol/h at the molar volume of the flow's T and p.
  const F = qOf(P, h)/1000*60/molarVolume(tOf(P, h), pOf(P, h));
  const gas = {};
  for (const k in G){
    /* Each gas on its own times: the injections it has a value for, with the
       light-on instant inserted as an extra point carrying its last reading before
       it (zero if the run starts after it). An empty cell is left out of this gas
       alone, so its rate, production and mean come from the injections it has; to
       v474 it was read as 0 %, which pulled them all down. */
    // (`inj`: each point's injection, the light-on instant's -1: gc_raw.csv's sources)
    const pts = rows.filter(r=> !noValue(G[k][r.i])).map(r=> ({ d: r.d, v: G[k][r.i], i: r.i }));
    if (!pts.length) continue;
    let idxBefore = -1;
    for (let i=0;i<pts.length;i++) if (pts[i].d < lightOn) idxBefore = i;
    pts.push({ d: lightOn, v: idxBefore<0 ? 0 : pts[idxBefore].v, i: -1 });
    pts.sort((a,b)=>a.d-b.d);
    const tHours = pts.map(p=> hours(p.d));
    const pct = pts.map(p=> p.v);
    const flow = pct.map(v=> v/100*F*1e6);             // umol/h of this gas
    const flowM = flow.map(v=> v/perOf(P, h)*NORM[P.norm].per);   // per g: µmol/(g h); per cm²: µmol/(cm² h)
    // From the first injection on; FmInt, from the interval's start (computeRates).
    const cum = U.cumtrapz(tHours, flowM);
    gas[k] = { t: tHours, pct, flow, Fm: flowM, cum, inj: pts.map(p=> p.i) };
  }
  return {t, gas};
}
/* A sample's table as the card holds it: the tables as made (kept, shared: nothing writes
   into them), each gas on a copy that takes the integral from the interval's start (FmInt,
   computeRates), and the sample's name, label, colour, whether its file was the alternative
   export's (ppm: its concentrations written in its unit, gc_raw.csv), and its source (`src`,
   with its table's own values, `tab`). */
export function dataTable(made, f, src){
  const gas = {};
  for (const k in made.gas) gas[k] = { ...made.gas[k], FmInt: made.gas[k].cum };
  return {t: made.t, gas, name:f.name, label:f.label, color:f.color, ppm: f.altExport === true, ...(src ? { src, tab: f.gas } : {})};
}

// The trapezoid integral `cum` of `f` over `t`, read at any time: the segment it
// falls in integrated up to it. Before the first point there is nothing yet.
export function cumAt(t, f, cum, at){
  if (!t.length || at <= t[0]) return 0;
  const n = t.length;
  if (at >= t[n-1]) return cum[n-1];
  let a = 0; while (a + 1 < n && t[a+1] <= at) a++;
  const fa = f[a], fat = fa + (f[a+1] - fa)*(at - t[a])/((t[a+1] - t[a]) || 1);
  return cum[a] + (at - t[a])*(fa + fat)/2;
}
// The straight line between the injections either side of `at`, read there.
export function lineAt(t, v, at){
  let a = 0; while (a + 2 < t.length && t[a+1] <= at) a++;
  const w = t[a+1] - t[a];
  return w ? v[a] + (v[a+1] - v[a])*(at - t[a])/w : v[a];
}
// The interval of sample k as far as a gas's data reach: [start, end] within the first
// and last of its times `t`.
export function spanOf(P, t, k){
  const n = t.length;
  if (n < 2) return [NaN, NaN];
  return [Math.max(Math.min(startOf(P, k), endOf(P, k)), t[0]), Math.min(Math.max(startOf(P, k), endOf(P, k)), t[n-1])];
}
/* The rates over the interval, from the card's tables (`dataTables`), each gas's FmInt
   set on them. → the mean rates, a sample each (costResults). */
export function computeRates(P, dataTables){
  /* The production is what was made between the interval's lines: none yet at its
     start, wherever that is moved to. Integrated from the first injection it carried
     everything that flowed out before (the dark readings, a purge) into every later
     point. The mean rate below, a difference, is the same either way. */
  dataTables.forEach((d,k)=>{
    const t0 = Math.min(startOf(P, k), endOf(P, k));
    for (const key in d.gas){ const q = d.gas[key], c0 = cumAt(q.t, q.Fm, q.cum, t0); q.FmInt = q.cum.map(v=> v - c0); }
  });
  /* Mean rate over the interval: the rate taken as the straight line between each
     pair of injections, integrated exactly from the interval's start to its end — an
     end between two injections integrates the line up to it — and divided by the
     duration. Read only off injections inside the interval, the mean lost the stretch
     between the last of them and the line. The interval is what the data cover of it:
     each gas's own data, so its duration `dt` is the gas's too (one with an empty
     cell at the interval's edge reaches less far). `span`, what all the sample's
     times cover, is the duration given for a sample with none of the gases shown. */
  return dataTables.map((d,k)=>{
    const rate = {}, dt = {};
    for (const key in d.gas){
      const q = d.gas[key], [a, b] = spanOf(P, q.t, k);
      if (b > a){ rate[key] = (cumAt(q.t, q.Fm, q.cum, b) - cumAt(q.t, q.Fm, q.cum, a)) / (b - a); dt[key] = b - a; }
    }
    const [a0, b0] = spanOf(P, d.t, k);
    return {name:d.name, label:d.label, rate, dt, span: b0 > a0 ? b0 - a0 : NaN};
  });
}
export const hasResults = costResults => costResults.some(c=> GASES.some(g=>isFinite(c.rate[g.key])));
/* Results series: the Analysis curves between the interval's lines — the injections
   inside it, and at each line the straight line between the injections around it,
   read there — which is what the mean rate integrates. Each gas on its own times, as
   in Analysis; `t`, all of them, spans the x-range. */
export function cutTables(P, dataTables){
  return dataTables.map((d,k)=>{
    const gas = {};
    for (const key in d.gas){
      const q = d.gas[key], [a, b] = spanOf(P, q.t, k);
      if (!(b > a)){ gas[key] = { ...q, t:[], Fm:[], FmInt:[], pct:[], flow:[] }; continue; }
      const inner = q.t.map((_, i)=> i).filter(i=> q.t[i] > a && q.t[i] < b);
      const take = arr => [lineAt(q.t, arr, a), ...inner.map(i=> arr[i]), lineAt(q.t, arr, b)];
      const t = [a, ...inner.map(i=> q.t[i]), b], c0 = q.cum[0] - q.FmInt[0];   // FmInt = cum − c0
      gas[key] = { ...q, t, Fm: take(q.Fm), pct: take(q.pct), flow: take(q.flow),
                   FmInt: t.map(x=> cumAt(q.t, q.Fm, q.cum, x) - c0) };
    }
    return {...d, t: Object.values(gas).flatMap(q=> q.t).sort((x,y)=> x-y), gas};
  });
}
/* The mean rates per sample (samplesOf: `samples`), of each gas: the mean over the
   sample's files of each one's mean rate (costResults: worked out with its own m, Q, T, p,
   light-on and interval), `n` the files with one, and its ± (`err`) the files' standard
   deviation (n − 1 under it); none for one file. To v511 a bar per file, with no ±; in
   v512 the ± was the half-width of the 99 % confidence interval of the mean,
   t(0.995, n − 1)·s/√n. */
export function sampleRates(U, costResults, samples){
  return samples.map(s=>{
    const rate = {}, err = {}, n = {};
    for (const g of GASES){
      const v = s.ks.map(k=> costResults[k] && costResults[k].rate[g.key]).filter(Number.isFinite);
      n[g.key] = v.length;
      if (!v.length) continue;
      rate[g.key] = U.meanArr(v);
      err[g.key] = v.length > 1 ? U.stdArr(v) : NaN;
    }
    return { ...s, rate, err, n };
  });
}

/* ---- What a card's plots draw ---- */
/* The top of a time plot's y-range: the highest value of `key` from light-on on
   (t ≥ 0), so what comes before it (a spike, a purge) does not flatten the run; of
   all the points when none is that late. The bottom is always 0. */
export function yTop(tables, shown, key){
  let hi = -Infinity, any = false;
  const take = after => tables.forEach(d=> shown.forEach(g=>{
    const q = d.gas[g.key]; if (!q) return;
    q.t.forEach((t, i)=>{
      const v = q[key][i];
      if (!isFinite(v) || (after && t < 0)) return;
      hi = Math.max(hi, v); any = true;
    });
  }));
  take(true);
  if (!any) take(false);
  return hi;
}
/* The Analysis plot's range: x spanning both the data and every interval line (so bars
   are never clipped), y from 0 to the data from light-on on (yTop); every shown gas shares
   the axis (the same quantity in the same units). → [xmin, xmax, ymin, ymax], or null
   with nothing of the shown gases to draw. */
export function dataRange(U, P, dataTables, shown){
  const allT = dataTables.flatMap(d=>d.t);
  const intPts = dataTables.flatMap((d,k)=>[startOf(P, k), endOf(P, k)]);
  const tmin = Math.min(0, U.minArr(allT), ...intPts);
  const tmax = Math.max(U.maxArr(allT), ...intPts);
  const span = key => dataTables.flatMap(d=> shown.filter(g=>d.gas[g.key]).map(g=> d.gas[g.key][key]));
  if (!span('Fm').length) return null;
  return [tmin, tmax, 0, yTop(dataTables, shown, 'Fm')*1.05];
}
/* The integration-interval vertical lines. 'all': one shared pair in the theme-aware grey
   (--plot-errbar). 'one': a pair per sample in the sample's colour (1px), with an
   invisible fat hit line for hover/select; hovered/selected lines thicken, the selected
   pair turns the highlight grey. → each line { x, o: { width, cls, color, hit, k } }, in
   the order they are drawn. */
export function intervalLines(P, dataTables, sel, hov){
  const out = [];
  if (!intPerSample(P)){
    out.push({ x: P.startShared, o: {width:1.5, cls:'gc-int-hl'} });
    out.push({ x: P.endShared, o: {width:1.5, cls:'gc-int-hl'} });
  } else {
    dataTables.forEach((d,k)=>{
      const s = sel===k, on = s || hov===k;
      const o = { k, hit:true, width: on?2.6:1, cls: s?'gc-int-hl':'', color: s?null:d.color };
      out.push({ x: startOf(P, k), o }, { x: endOf(P, k), o });
    });
  }
  return out;
}
// The Results plots' x-range (the cut series, `cut`): from 0 or the first time to the last.
// → null with nothing to draw.
export function cutRange(U, cut){
  if (!cut.length || !cut.some(d=>d.t.length)) return null;
  const allT = cut.flatMap(d=>d.t);
  return [Math.min(0, U.minArr(allT)), U.maxArr(allT)];
}
// The mean-rate bars' series: each shown gas a series of its own, its bars a sample each.
export const barSeries = (shown, sm)=> shown.map(g=> ({ name: gasTxt(g), color: g.bar, vals: sm.map(s=> s.rate[g.key]), errs: sm.map(s=> s.err[g.key]) }));
// A series' name: the gas only when more than one is on show.
export const seriesName = (label, g, shown)=> shown.length > 1 ? `${label} ${gasTxt(g)}` : label;

/* ---- A card's CSVs, named after it (`n`) ---- */
// The inputs as they were set, in the CSV's decimal separator and not rounded: fmtNum
// with no decimals wrote a 60.6 s delay as 61.
const asSet = (U, v)=> String(v).replace('.', U.settings.decimal);
/* gc_raw.csv, gc_results.csv, mean_rates.csv (and mean_rates_by_file.csv with
   replicates), gc_info.csv, of the card's tables (`dataTables`), its mean rates
   (`costResults`) and samples (`samples`, samplesOf), `files` the included. */
export function csvEntries(U, P, n, dataTables, costResults, samples, files){
  if (!dataTables.length) return [];
  const entries = [], N = NORM[P.norm];
  // One block of columns per sample (each keeps its own time axis). gc_raw.csv carries
  // the full series with every intermediate quantity; gc_results.csv keeps only the
  // three plotted columns, between the interval's lines as plotted.
  /* Every gas the samples have, whichever the chips show (v530): the chips are a view of
     the plots alone (no change unsaved, v528), so the CSVs never follow them; to v529
     they held only the gases the Results plots showed. */
  const shown = GASES.filter(g=> gasPresent(files, g.key));
  entries.push({name:`${n} - gc_raw.csv`,     text:seriesCsv(U, N, shown, dataTables, true)});
  entries.push({name:`${n} - gc_results.csv`, text:seriesCsv(U, N, shown, cutTables(P, dataTables), false)});
  entries.push(...meanCsvs(U, P, n, N, shown, costResults, samples));
  entries.push({name:`${n} - gc_info.csv`, text:infoCsv(U, P, N, dataTables)});
  return entries;
}
// The time series, a block of columns a sample (`full`: gc_raw.csv's, every quantity).
function seriesCsv(U, N, shown, tables, full){
  const cols=[];
  tables.forEach(d=>{
    // A sample with none of the shown gases contributes nothing, not a bare time
    // column with empty space beside it.
    const qs = shown.filter(g=>d.gas[g.key]).map(g=> [g, d.gas[g.key]]);
    if (!qs.length) return;
    /* The gases each have their own times (an empty cell is not one of its points),
       so they are merged onto one time column: a time they share is one row, and a
       gas with no point at a row leaves its cells there empty, rather than its
       values slipping up against the dates of another gas. */
    const pos = qs.map(()=> 0), rows = [];
    for (;;){
      let tm = Infinity;
      qs.forEach(([, q], j)=>{ if (pos[j] < q.t.length) tm = Math.min(tm, q.t[pos[j]]); });
      if (!(tm < Infinity)) break;
      rows.push({ t: tm, at: qs.map(([, q], j)=> pos[j] < q.t.length && q.t[pos[j]] === tm ? pos[j]++ : -1) });
    }
    const col = (j, arr)=> rows.map(r=> r.at[j] < 0 ? '' : U.fmtNum(arr[r.at[j]],5));
    cols.push({h:`Time (h) [${d.label}]`, v:rows.map(r=>U.fmtNum(r.t,5))});
    qs.forEach(([g, q], j)=>{
      if (full){
        /* The concentration in the file's unit: %mol, or the alternative export's ppm
           (v539), as it read them (%mol × 10⁴), whose values below 1 ppm %mol to five
           decimals would lose (0.141 ppm is 0.0000141 %mol). */
        cols.push(d.ppm ? {h:`${g.csv} (ppm) [${d.label}]`, v:col(j, q.pct.map(v=> v*1e4))}
          : {h:`${g.csv} (%mol) [${d.label}]`,      v:col(j, q.pct)});
        /* A sample paired with its raw chromatograms under an Integration card (v544):
           which value the concentration column holds (`source`), the table's and the
           re-integrated one beside it, and the fitted area, at each injection. */
        if (d.src) cols.push(...sourceCols(U, d, g, q, j, rows));
        cols.push({h:`${g.csv} (umol h^-1) [${d.label}]`, v:col(j, q.flow)});
      }
      cols.push({h:`${g.csv} ${N.rateCsv} [${d.label}]`, v:col(j, q.Fm)});
      cols.push({h:`${g.csv} ${N.cumCsv} [${d.label}]`,  v:col(j, q.FmInt)});
    });
  });
  return U.wideCsv(cols);
}
// (a sample's values re-integrated or kept from its table, and why: v544)
function sourceCols(U, d, g, q, j, rows){
  const s = d.src, k = g.key, u = d.ppm ? 'ppm' : '%mol', m = d.ppm ? 1e4 : 1, ok = Number.isFinite;
  const inj = r => r.at[j] < 0 ? -1 : q.inj[r.at[j]];
  const re = !!(s.gas && s.how[k] && s.how[k] !== 'table');
  const what = !s.gas ? `table (${s.why})` : s.how[k] === 'cal' ? 'reintegrated, calibrated by the standards'
    : s.how[k] === 'transfer' ? 'reintegrated, calibration taken from the GC table' : `table (${s.why[k] || 'no re-integration'})`;
  const at = (arr, f, dec)=> rows.map(r=>{ const i = inj(r), v = i >= 0 && arr ? arr[i] : NaN; return ok(v) ? U.fmtNum(v*f, dec) : ''; });
  return [
    { h: `${g.csv} source [${d.label}]`, v: rows.map(r=> inj(r) < 0 ? '' : what) },
    { h: `${g.csv} table (${u}) [${d.label}]`, v: at(d.tab[k], m, 5) },
    { h: `${g.csv} reintegrated (${u}) [${d.label}]`, v: at(re ? s.gas[k] : null, m, 5) },
    { h: `${g.csv} area [${d.label}]`, v: at(s.areas ? s.areas[k] : null, 1, 3) },
  ];
}
// mean_rates.csv, and with replicates mean_rates_by_file.csv beside it.
function meanCsvs(U, P, n, N, shown, costResults, samples){
  // mean_rates.csv — bar-plot-like summary (one row per file). One duration column
  // while every file's shown gases cover the same span (a file with none of them,
  // its own span, as before); when a gas of some file reaches less far (an empty
  // cell at the interval's edge), one column per gas for every file.
  // The flow's pressure, in the card's unit, and its temperature last: the rates were
  // worked out at their molar volume (T the last column since v495, p beside it).
  const durs = c => shown.map(g=> U.fmtNum(c.dt[g.key],4));
  const perGas = shown.length > 1 && costResults.some(c=> new Set(durs(c).filter(Boolean)).size > 1);
  // The columns after the rates, and file k's.
  const tailHead = [...(perGas ? shown.map(g=>`${g.csv} interval duration (h)`) : ['Interval duration (h)']), `p (${P.pUnit})`, 'T (°C)'];
  const tail = k =>{ const c = costResults[k]; return [...(perGas ? durs(c) : [durs(c).find(Boolean) || U.fmtNum(c.span,4)]), asSet(U, inUnit(pOf(P, k), P.pUnit)), asSet(U, tOf(P, k))]; };
  let t2 = U.csvLine(['Sample', ...shown.map(g=>`Mean ${g.csv} ${N.rateCsv}`), ...tailHead]);
  costResults.forEach((c, k)=> t2 += U.csvLine([c.label, ...shown.map(g=>U.fmtNum(c.rate[g.key],6)), ...tail(k)]));
  /* With replicates (a sample of more than one included file), mean_rates.csv has a row
     per sample: its name (its bar's), each gas's mean, ± and n (sampleRates), then its
     files' durations, p and T, each one value where they agree, else all of them in
     list order joined by '/' (a gas's duration, of the files that have it); the rows per
     file above are mean_rates_by_file.csv. With none, mean_rates.csv is those, as to
     v511. */
  const sm = sampleRates(U, costResults, samples);
  if (sm.some(s=> s.ks.length > 1)){
    const one = vs =>{ const w = vs.filter(v=> v !== ''); return w.every(v=> v === w[0]) ? (w[0] || '') : w.join('/'); };
    let t4 = U.csvLine(['Sample', ...shown.flatMap(g=> [`Mean ${g.csv} ${N.rateCsv}`, `${g.csv} SD (${N.unitCsv})`, `${g.csv} n`]), ...tailHead]);
    sm.forEach(s=>{
      const tails = s.ks.map(tail);
      t4 += U.csvLine([s.label, ...shown.flatMap(g=> [U.fmtNum(s.rate[g.key],6), U.fmtNum(s.err[g.key],6), String(s.n[g.key])]), ...tailHead.map((_, j)=> one(tails.map(t=> t[j])))]);
    });
    return [{name:`${n} - mean_rates.csv`, text:t4}, {name:`${n} - mean_rates_by_file.csv`, text:t2}];
  }
  return [{name:`${n} - mean_rates.csv`, text:t2}];
}
// gc_info.csv — per-sample inputs + the integration interval used
function infoCsv(U, P, N, dataTables){
  // Local time, as the light-on field shows it and as the instrument logged it:
  // toISOString() wrote UTC, two hours early in Italian summer time.
  const pad = n => String(n).padStart(2, '0');
  const fmtDate = v =>{ if (!v) return ''; const d = new Date(v);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  // (the mass, or the area where the card normalises by it: its column, v540)
  let t3 = U.csvLine(['Sample',N.colCsv,'Q (mL/min)','T (°C)',`p (${P.pUnit})`,'Light-on','Interval start (h)','Interval end (h)','Injection delay (s)']);
  dataTables.forEach((d,k)=> t3 += U.csvLine([d.label, asSet(U, perOf(P, k)), asSet(U, qOf(P, k)), asSet(U, tOf(P, k)), asSet(U, inUnit(pOf(P, k), P.pUnit)), fmtDate(P.lightOnDates[k]), asSet(U, startOf(P, k)), asSet(U, endOf(P, k)), asSet(U, injDelay(P))]));
  return t3;
}

/* ---- A card's state ---- */
// The per-sample arrays, for the file list (keys the card's own, `id`).
export const slotsOf = (U, P, id)=> [
  // (a value held through an exclusion, as a restore takes it: modkit RESTORED)
  { key: id + ':m', arr:P.ms, make: v=> U.num(v, 15, x=> x > 0) },
  { key: id + ':A', arr:P.As, make: v=> U.num(v, 1, x=> x > 0) },
  { key: id + ':Q', arr:P.Qs, make: v=> U.num(v, 2, x=> x > 0) },
  { key: id + ':T', arr:P.Ts, make: v=> U.num(v, T_NEW, okT) },
  { key: id + ':p', arr:P.Ps, make: v=> U.num(v, P_ATM, okP) },
  { key: id + ':start', arr:P.startArr, make: v=> U.num(v, 0) },
  { key: id + ':end', arr:P.endArr, make: v=> U.num(v, 24) },
  { key: id + ':lightOn', arr:P.lightOnDates, make: (v, f)=> U.dateOf(v) || (f ? firstInjection(f) : null) },
];
export function snapshotOf(P){
  return {
    ms: P.ms.slice(), Qs: P.Qs.slice(), Ts: P.Ts.slice(), Ps: P.Ps.slice(), startArr: P.startArr.slice(), endArr: P.endArr.slice(),
    lightOnDates: P.lightOnDates.map(d=> d ? d.getTime() : null),
    mMode: P.mMode, qMode: P.qMode, tMode: P.tMode, pMode: P.pMode, startMode: P.startMode, endMode: P.endMode,
    mShared: P.mShared, qShared: P.qShared, tShared: P.tShared, pShared: P.pShared, startShared: P.startShared, endShared: P.endShared, pUnit: P.pUnit,
    gasSel: { a:P.gasSel.a.slice(), r:P.gasSel.r.slice() },
    delayAuto: P.delayAuto, delayMan: P.delayMan,
    norm: P.norm, As: P.As.slice(), aMode: P.aMode, aShared: P.aShared,
  };
}
/* Each value as it should be (modkit RESTORED): a mode 'all' or 'one', a mass, an area
   and a flow above 0, the normalisation 'mass' or 'area' (mass when none), a pressure as the fields take it (okP), a temperature from −273 °C,
   p's unit one of its own, a bound and the delay numbers, a light-on a date (else the sample's first injection),
   every per-sample array one entry a sample (to v500 an array that was none threw, a
   value that was no number drew NaN). */
export function restoreParams(U, P, s0, files){
  const s = isObj(s0) ? s0 : {}, n = files.length, GK = GASES.map(g=> g.key), mode = v => U.oneOf(v, ['all', 'one']), pos = v => v > 0;
  // Projects saved before O2 existed, or under the older single-mode selector.
  const fromMode = m => GK.includes(m) ? [m] : GK, sel = v => Array.isArray(v) ? GK.filter(k=> v.includes(k)) : GK;
  const gm = isObj(s.gasMode) ? s.gasMode : {};
  P.gasSel = isObj(s.gasSel) ? { a: sel(s.gasSel.a), r: sel(s.gasSel.r) } : { a: fromMode(gm.a), r: fromMode(gm.r) };
  P.ms = U.arrOf(s.ms, n, v=> U.num(v, 15, pos)); P.Qs = U.arrOf(s.Qs, n, v=> U.num(v, 2, pos));
  P.lightOnDates = U.arrOf(s.lightOnDates, n, (v, i)=> U.dateOf(v) || firstInjection(files[i]));
  // Projects from before the delay existed take it too, on Auto: the timestamps they
  // were computed from are just as late.
  P.delayAuto = s.delayAuto !== false;
  P.delayMan = U.num(s.delayMan, INJ_DELAY_AUTO, v=> v >= 0);
  if (s.mMode !== undefined || s.intMode !== undefined){
    // Current format: independent per-parameter modes; or paired-mode projects
    // (mqMode / intMode), migrated to independent modes.
    if (s.mMode !== undefined){ P.mMode = mode(s.mMode); P.qMode = mode(s.qMode); P.startMode = mode(s.startMode); P.endMode = mode(s.endMode); }
    else { P.mMode = P.qMode = mode(s.mqMode); P.startMode = P.endMode = mode(s.intMode); }
    P.mShared = U.num(s.mShared, 15, pos); P.qShared = U.num(s.qShared, 2, pos); P.startShared = U.num(s.startShared, 0); P.endShared = U.num(s.endShared, 24);
  } else {
    // Migrate the oldest projects: a single global interval → interval 'all' mode.
    P.mMode='one'; P.qMode='one'; P.startMode='all'; P.endMode='all';
    P.mShared=15; P.qShared=2;
    P.startShared = U.num(U.numStr(s.plateauStart), 0); P.endShared = U.num(U.numStr(s.plateauEnd), 24);
  }
  P.startArr = U.arrOf(s.startArr, n, v=> U.num(v, P.startShared)); P.endArr = U.arrOf(s.endArr, n, v=> U.num(v, P.endShared));
  // A project from before the temperature (none in its state) keeps the 0 °C its rates
  // were worked out at: the field shows it, and it can be changed.
  const T0 = ['tMode', 'tShared', 'Ts'].some(k=> k in s) ? T_NEW : T_OLD;
  P.tMode = mode(s.tMode); P.tShared = U.num(s.tShared, T0, okT); P.Ts = U.arrOf(s.Ts, n, v=> U.num(v, P.tShared, okT));
  // One from before the pressure was worked out at 1 atm, where a new card starts too.
  P.pMode = mode(s.pMode); P.pShared = U.num(s.pShared, P_ATM, okP); P.Ps = U.arrOf(s.Ps, n, v=> U.num(v, P.pShared, okP));
  P.pUnit = U.oneOf(s.pUnit, Object.keys(P_UNITS));
  // What the rates are normalised by (v540): a project from before it, by the mass, as
  // its rates were worked out; its areas, 1 cm², kept for a switch to them.
  P.norm = U.oneOf(s.norm, NORMS);
  P.aMode = mode(s.aMode); P.aShared = U.num(s.aShared, 1, pos); P.As = U.arrOf(s.As, n, v=> U.num(v, 1, pos));
}
/* A project from before the cards had one analysis, its settings at the top level: its
   card's record, as cards.js loads one (`cards` the state's own list, read: modkit
   cardList), and a card's settings as its analysis takes them when it is made (init): its
   per-sample arrays without the entries of the files the restore left out (`gone`). */
export const cardsOf = (s, cards)=> cards || [{ ...s, id: 1, type: 'rate' }];
export const initOf = (U, src, gone)=> ({ ...src, ...Object.fromEntries(PER_SAMPLE.filter(k=> k in src).map(k=> [k, U.without(src[k], gone)])) });
