import { settings, fmtNum, csvLine, cumtrapz, maxArr, minArr, meanArr, stdArr, buildAlertsHtml, createDateTimeField, flashFieldInvalid, guardNumericInput, fitCsvIcons, confirmBanner, esc, registerModule, fixed, keeper, objId, exactKey } from './utils.js';
import { Plot, svgEl } from './plot.js';
import { cardInfo, fileSafe, nameDownloads } from './cards.js';
import { moduleKit, wideCsv, isObj, isArr, num, numStr, oneOf, dateOf, arrOf, without, cardList } from './modkit.js';
import { CSV_ICON, plotWrap, viewOf, setView, viewKey, chipRow, toggleChip, valueBars } from './modcharts.js';
import { textLines, readTable, parseNum } from './textdata.js';

/* =========================================================
   GC MODULE

   MADE PER TAB (v518): createGc is the module's factory (utils.js registerModule), each open
   GC tab that is awake an instance of its own, made of its copy of index.html's section
   (root) and a layer (the kinds' menu). Its elements are found in root, a card's in its
   card and in its section of the Results, never in the page: its ids are the page's only
   while it is on show. Its registries go by its key, the tab's id (moduleKit). It draws only
   on show: hidden (a state read out for its CSVs) it works out its tables and rates, which
   the CSVs are made of, and draws nothing; its redraw draws all as it is shown; a tab shown
   again with nothing changed and at the same width draws nothing (its draw key). It has no
   job that runs on while hidden. utils.js registerModule says how a module is made so.
========================================================= */
/* A sample's tables (computeTables: each gas's times, readings, flows and their integral),
   kept by its first gas's readings (utils.js keeper: while a state, a tab asleep or a
   history holds the file) under all they are made from: the injections' dates, the gases'
   readings, the light-on instant, the injection delay and the flow's rate, temperature,
   pressure and the mass. A tab woken, an undo, a redraw and the CSVs take them as made (to
   v517 every redraw made them again). The integral from the interval's start (FmInt) is
   the card's own, made at each change of the interval: it lies on a copy. */
const tablesKept = keeper('gc-tables', 8);

/* ---- The gases, the flow and the pressure (pure: the module's, for every instance) ---- */
// Axis titles. The SVG form carries the g⁻¹/h⁻¹ superscripts; the plain form is the
// matching CSV header.
const SUP1 = '<tspan baseline-shift="super" font-size="8">-1</tspan>';
const LBL_RATE_SVG = `Production Rate (mmol g${SUP1} h${SUP1})`;
const LBL_CUM_SVG  = `Production (mmol g${SUP1})`;
const LBL_RATE_CSV = 'Production Rate (mmol g^-1 h^-1)';
const LBL_CUM_CSV  = 'Production (mmol g^-1)';

/* The gases the module can read, in display order. `col` finds the column: the name
   has to carry the formula as a word of its own, or "O2" would also match the "CO2"
   column that sits beside it in a typical GC export. Both gases get the identical
   treatment — %mol, molar flow, per gram, integrated — since the instrument hands
   over calibrated mole fractions for each. */
const GASES = [
  { key:'h2', label:'H<sub>2</sub>', csv:'H2', dash:'',    bar:'#3aa0ff',
    col:/(^|[^a-z0-9])h2([^a-z0-9]|$)/ },
  { key:'o2', label:'O<sub>2</sub>', csv:'O2', dash:'5,4', bar:'#ff7a59',
    col:/(^|[^a-z0-9])o2([^a-z0-9]|$)/ },
];
// Plain-text form for series names, where markup would be drawn literally.
const gasTxt = g => g.csv.replace('2', '₂');
/* A cell with no value: blank or not a number at parse (NaN), null once a project has
   been through JSON. It is left out of its gas's series (computeTables). A sample has
   a gas when its column holds a value in at least one injection. */
const noValue = v => !Number.isFinite(v);
const hasGas = (f, k)=> !!f.gas[k] && !f.gas[k].every(noValue);
/* The injection date is stamped when the run starts, and the sample is injected a
   little later: every injection is moved on by this delay, in seconds, before it is
   set against light-on. "Auto" is the method's own figure, shown in the field. */
const INJ_DELAY_AUTO = 60.6;
/* The molar volume the flow Q is turned into moles with: an ideal gas at the temperature
   T (°C) and the absolute pressure p the flow is measured at, V_m = R·T/p, 22.414 L/mol
   at 0 °C and 1 atm, 24.465 at 25 °C. T is each card's, all/one as m and Q are: 25 °C in
   a new card and for a new file, 0 °C in a project saved before it existed, whose rates
   were worked out at 22.41396954 L/mol (to v500, whatever the flow meter's). p the same
   way: 1 atm in a new card, for a new file and in a project saved before it, whose rates
   were worked out at it (to v500 p was 1 atm, fixed). */
const R_ATM = 0.0820573661;    // R, L·atm/(mol·K)
const molarVolume = (T, p)=> R_ATM*(T + 273.15)/(p/P_ATM);
const T_NEW = 25, T_OLD = 0, okT = v => v >= -273;
/* p is kept in Pa, as typed in its unit; the unit, the card's, is only how it is shown
   and written, so switching it never moves the pressure. Each unit's size in Pa is a
   fraction, so that a value typed goes to Pa and back exactly where it can (760 Torr is
   101325 Pa); shown to 12 digits, which leaves out the last bit a conversion may add
   (1.1 bar is 110000.00000000001 Pa). Torr is mmHg to 1 part in 7 million. */
const P_ATM = 101325, P_MAX = 1e300;   // (a p below P_MAX in its unit is a number in Pa)
const P_UNITS = { atm: [P_ATM, 1], bar: [1e5, 1], kPa: [1000, 1], mbar: [100, 1], Torr: [P_ATM, 760], psi: [6894.757293168361, 1] };
const toPa = (v, u)=> v*P_UNITS[u][0]/P_UNITS[u][1];
const inUnit = (pa, u)=> +(pa*P_UNITS[u][1]/P_UNITS[u][0]).toPrecision(12);
/* A pressure as the fields make one: above 0, and at most P_MAX in the largest unit (atm),
   so that it is a number in every unit. One restored or kept for a file past these is
   taken as the default, as a mass or a flow is (a hand-edited project's 1e307 Pa was
   shown as Infinity in Torr, and written so in the CSVs). */
const okP = v => v > 0 && v <= P_MAX*P_ATM;
// A card's per-sample arrays, as its state names them.
const PER_SAMPLE = ['ms', 'Qs', 'Ts', 'Ps', 'startArr', 'endArr', 'lightOnDates'];
// (a number however a project's .json writes it: the count goes into markup)
function blankCounts(f){ return GASES.map(g=> f.gas[g.key] ? f.gas[g.key].filter(noValue).length + (+f.emptyRows || 0) : 0); }

/* ---- Reading a file ---- */
/* An injection date as the instrument writes it, 'M/D/YYYY h:mm:ss AM|PM': its fields as
   they stand, or null for a field of another shape (no line of data). */
const GC_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i;
const dateFields = s =>{ const m = String(s || '').trim().match(GC_DATE); return m && m.slice(1); };
/* The moment those fields are, the day first when `dm` (a file read as day/month), or
   null when there is none: a month 1–12, a day 1 to the month's length (29 February in a
   leap year), the hour 1–12, minutes and seconds 0–59. To v509 none was checked and the
   Date rolled over: 13/10/2025 was 10 January 2026, 2/30/2025 2 March, 13:00:00 PM 1 PM. */
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function parseGCDate(m, dm){
  const [a, b, y, h, mi, se, ap] = m.map((v, i)=> i < 6 ? +v : v), mo = dm ? b : a, da = dm ? a : b;
  const len = mo === 2 && !(y % 4) && (y % 100 || !(y % 400)) ? 29 : MONTH_DAYS[mo - 1];
  if (!(da >= 1 && da <= len && h >= 1 && h <= 12 && mi <= 59 && se <= 59)) return null;
  return new Date(y, mo - 1, da, h % 12 + (/pm/i.test(ap) ? 12 : 0), mi, se);
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
   fail both ways. The alert says both (dateAlertsHtml); a file with no injection left
   for a date that does not exist is refused with why. To v509 every date was
   month/day, rolled over. */
function gcColumns(fields){
  const lo = fields.map(h=> h.toLowerCase()), date = lo.findIndex(h=> h.includes('injection date')), gas = {};
  for (const g of GASES){ const i = lo.findIndex(h=> g.col.test(h) && h.includes('%mol')); if (i >= 0 && i !== date) gas[g.key] = i; }
  return date >= 0 && Object.keys(gas).length ? { date, gas } : null;
}
function readGc(text){
  const t = readTable(textLines(text), gcColumns, (r, c)=> !!dateFields(r[c.date]));
  if (!t) return null;
  const { date, gas: idx } = t.cols, injDates = [], gas = {};
  // The lines with a date, and its fields; day first when every date exists so and not
  // month first, its times never back by more than an hour.
  const rows = t.rows.map(r=> [r, dateFields(r[date])]).filter(x=> x[1]);
  const md = rows.map(x=> parseGCDate(x[1], false)), df = rows.map(x=> parseGCDate(x[1], true));
  const dm = !md.every(Boolean) && df.every((d, i)=> d && (!i || d - df[i - 1] >= -3600e3));
  let emptyRows = 0, badDates = 0, lost = 0;
  for (const k in idx) gas[k] = [];
  for (const [i, [r]] of rows.entries()){
    const d = (dm ? df : md)[i], vals = {};
    let any = false;
    for (const k in idx){ const v = parseNum(r[idx[k]]); vals[k] = isFinite(v) ? v : NaN; if (isFinite(v)) any = true; }
    // (`lost`: a row with a value whose date does not exist, an injection but for it)
    if (!d){ badDates++; if (any) lost++; continue; }
    // One row, every gas kept on the same time axis; a blank cell stays NaN so the
    // columns never slip out of step with the dates. The analysis leaves it out of
    // that gas's series (computeTables) and the alerts count it (blankAlertsHtml). A
    // row with no gas at all is left out, as it was, and the alert counts it too (to
    // v474 it went unsaid).
    if (any){ injDates.push(d); for (const k in idx) gas[k].push(vals[k]); }
    else emptyRows++;
  }
  /* No injection left: refused with why when a row with a value went for its date (the
     other rows, none with a gas value, counted beside it); by its name alone when no row
     had a value, whatever its date, as at v509. (dayMonth and badDates only where they
     apply: any other file's record is as it was.) */
  const rest = rows.length - lost;
  if (!injDates.length) return lost ? { error: `no injection to read: ${lost} row${lost > 1 ? 's' : ''} with an injection date that does not exist${rest ? `, ${rest} with no gas value` : ''}` } : null;
  for (const k in gas) fixed(gas[k]);
  return { injDates, gas, emptyRows, ...(dm && { dayMonth: true }), ...(badDates && { badDates }) };
}

// The first injection, to the minute: the field shows and sets minutes only, so a
// default carrying the seconds would change the moment the field was merely tabbed
// through — results shifting, and an undo step, with nothing touched.
function firstInjection(f){
  const d = new Date(Math.min(...f.injDates.map(Number))); d.setSeconds(0, 0);
  return d;
}

/* ---- The cards' parts: cells, lines, legends ---- */
// A numeric text cell; `state` = 'on' (editable), 'ro' (read-only) or 'off' (disabled).
function numCell(cls, attrs, value, state){
  const dis = state==='off' ? 'disabled' : (state==='ro' ? 'readonly' : '');
  return `<input class="${cls}" ${attrs} type="text" inputmode="decimal" value="${esc(value)}" ${dis} style="width:100%">`;
}
const modeChip = (pair, mode)=> `<button type="button" class="mode-chip gc-toggle" data-pair="${pair}" title="Switch all / one">${esc(mode)}</button>`;
// A header over a field: its name on the field's left edge, its all/one pill on the
// field's right edge.
const thHead = (label, chip)=> `<div class="gc-th"><span>${label}</span>${chip}</div>`;

// Parse a raw field string into a finite number, or null if incomplete/invalid.
function parseIntervalField(v){
  const s = String(v).trim().replace(',', '.');   // accept comma decimals
  if (s==='' || s==='-' || s==='+' || s==='.' || s==='-.' || s==='+.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// The trapezoid integral `cum` of `f` over `t`, read at any time: the segment it
// falls in integrated up to it. Before the first point there is nothing yet.
function cumAt(t, f, cum, at){
  if (!t.length || at <= t[0]) return 0;
  const n = t.length;
  if (at >= t[n-1]) return cum[n-1];
  let a = 0; while (a + 1 < n && t[a+1] <= at) a++;
  const fa = f[a], fat = fa + (f[a+1] - fa)*(at - t[a])/((t[a+1] - t[a]) || 1);
  return cum[a] + (at - t[a])*(fa + fat)/2;
}

/* One line per sample per gas, the sample's colour throughout and the gas told by
   the dash pattern, so a sample stays recognisable across both gases. The name
   carries the gas only when more than one is on show. */
function drawGasLines(plot, tables, shown, key){
  tables.forEach(d=>{
    shown.forEach(g=>{
      const q = d.gas[g.key];
      if (!q) return;
      // On the gas's own times: an injection it has no value for is not one of its points.
      plot.line(q.t, q[key], d.color, 1.3, g.dash, { label: seriesName(d.label, g, shown), key: d.name + '/' + g.key });
    });
  });
}
const seriesName = (label, g, shown)=> shown.length > 1 ? `${label} ${gasTxt(g)}` : label;

// Legend entries follow the same rule, with a dashed key for a dashed gas.
function gasLegendHtml(d, shown){
  return shown.filter(g=>d.gas[g.key]).map(g=>{
    const key = g.dash
      ? `<i class="mk-dash" style="color:${esc(d.color)}"></i>`
      : `<i style="background:${esc(d.color)}"></i>`;
    return `<span>${key}${esc(seriesName(d.label, g, shown))}</span>`;
  }).join('');
}

/* The top of a time plot's y-range: the highest value of `key` from light-on on
   (t ≥ 0), so what comes before it (a spike, a purge) does not flatten the run; of
   all the points when none is that late. The bottom is always 0. */
function yTop(tables, shown, key){
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

// The straight line between the injections either side of `at`, read there.
function lineAt(t, v, at){
  let a = 0; while (a + 2 < t.length && t[a+1] <= at) a++;
  const w = t[a+1] - t[a];
  return w ? v[a] + (v[a+1] - v[a])*(at - t[a])/w : v[a];
}

/* ---- A card's markup, its kinds and instructions ---- */
const P = a => 'gc' + a.id;
// A plot of a card's, with the gas chips of its section (`sec`: 'a' Analysis, 'r' Results) over it.
const gasPlot = (id, sec, o)=> plotWrap(id, { mod: 'gc', extra: `\n              <span class="gc-gas-sel" data-gas-sec="${sec}"></span>`, ...o });
const cardBody = a => `
      <div class="peak-box" style="margin-top:0;margin-bottom:14px">
        <div class="peak-box-head">
          <span class="txt-mini">Parameters</span>
          <button class="btn table-csv-btn" data-csv-mod="gc" data-csv-names="gc_info.csv" title="Download CSV">${CSV_ICON}</button>
        </div>
        <div class="gc-param-wrap" id="${P(a)}ParamTableWrap"></div>
      </div>
      <div class="row" style="align-items:flex-start">
        <div class="col">
          <p class="txt-caption">Production Rate</p>${gasPlot(P(a) + 'Svg1', 'a', { cls: 'plot-strip', csv: 'gc_raw.csv', name: 'GC_rate.svg', legend: P(a) + 'Legend' })}
        </div>
      </div>
      <div id="${P(a)}Legend" class="legend" style="margin-top:8px"></div>`;
const resHtml = a => `
      <h4 class="res-an-title"></h4>
      <div class="row res-row">
        <div class="col">
          <p class="txt-caption">Production Rate</p>${gasPlot(P(a) + 'SvgRate', 'r', { csv: 'gc_results.csv', name: 'GC_results_rate.svg', legend: P(a) + 'ResLegend' })}
        </div>
        <div class="col">
          <p class="txt-caption">Production</p>${gasPlot(P(a) + 'SvgCum', 'r', { csv: 'gc_results.csv', name: 'GC_results_cumulative.svg', legend: P(a) + 'ResLegend' })}
        </div>
      </div>
      <div id="${P(a)}ResLegend" class="legend" style="margin-top:8px"></div>
      <p class="txt-caption" style="margin-top:14px">Mean Production Rate</p>${gasPlot(P(a) + 'SvgBar', 'r', { cls: 'plot-wide', csv: 'mean_rates.csv', name: 'GC_results.svg', legend: P(a) + 'BarLegend' })}
      <div id="${P(a)}BarLegend" class="legend" style="margin-top:8px"></div>`;
// The analyses' kinds (cards.js), as the menu lists them.
const KINDS = { rate: 'Production Rate' };
// What T and p are (their columns' titles, and the card's instructions).
const T_TITLE = 'the temperature at which the flow Q is measured — for a mass-flow controller, the reference temperature of its standard units (often 0 °C or 20 °C: see its datasheet), not the temperature of its body';
const P_TITLE = 'the absolute pressure the flow Q refers to — for a mass-flow controller, the reference pressure of its standard units (usually 1 atm, 1.01325 bar: see its datasheet); for a flow measured as a volume, the absolute pressure of the gas where it is measured (ambient ≈ 1 atm)';
const GC_INFO = `Set catalyst mass (m), carrier gas flow rate (Q), its temperature (T) and pressure (p), the light-on time and the integration interval for each sample to compute mean H₂ and O₂ production rates; the <b>H₂ / O₂</b> chips on each plot choose the gases drawn, for Analysis and for Results. An empty H₂ or O₂ cell leaves that injection out of that gas only, and the alert under the drop zone says how many were skipped. The injection dates are read month/day, as the instrument writes them, or day/month in a file where some do not exist so and every one does that way, its times going on as the rows do; a row whose date does not exist (2/30, 13/13, 13:00 PM) is left out, and the alert says either. Use the <b>all / one</b> toggles to share a value across samples or set it per sample. <b>T</b> is ${T_TITLE}. <b>p</b> is ${P_TITLE}; its unit (atm, bar, kPa, mbar, Torr = mmHg, psi) is chosen in its column's header, which converts the values shown, not the pressure. The flow is turned into moles with the molar volume of an ideal gas at that temperature and pressure, V<sub>m</sub> = RT/p (22.414 L/mol at 0 °C and 1 atm, 24.465 L/mol at 25 °C and 1 atm). A new analysis starts at 25 °C and 1 atm; a project saved before T existed keeps the 0 °C its rates were worked out at, and one saved before p, the 1 atm. The <b>injection delay</b> moves every injection on from its logged date to the moment the sample is actually injected; <b>Auto</b> uses 60.6 s. In per-sample interval mode the vertical lines are coloured by sample — hover or select a table row to highlight its interval on the plot (and vice-versa). <b>Replicates</b>: the <b>Sample</b> column of the file list says which sample each file is — its own (as it starts), or another file's, by that file's name (a label renamed changes nothing); a file that heads a group, set to another, takes its group along, and a head removed leaves its group to its next file. The time plots stay one per file; the mean-rate bar chart has one bar per sample, named after its head's label (the first included file's, the head left out), its height the mean of its included files' mean rates, each worked out with its own parameters, and its error bar the files' standard deviation (n − 1 under it; none for a single file); a file left out is out of the mean and of n. With replicates (a sample of more than one included file), mean_rates.csv has a row per sample (each gas's mean, ± and n) and mean_rates_by_file.csv a row per file, as mean_rates.csv has without them. ${cardInfo(false, true)}`;

// A GC tab's instance (utils.js makeInstance: ctx { key, root, layer, shown }).
function createGc({ key, root, layer, shown }){
  const $ = id => root.querySelector('#' + id);
  /* Hidden, nothing is drawn (utils.js registerModule): `drawable()` says whether to draw,
     and when not marks the instance to be drawn whole as it is shown (stale). `drawnAt`:
     the width it was last drawn whole at, its draw key (redrawTab). */
  let stale = false, drawnAt = '';
  const drawable = ()=> shown() || !(stale = true);
  /* The module (modkit.js): every file loaded, in list order, {name, label,
     injDates:[Date], gas:{h2:[number], o2:[number]} (the gases it has), emptyRows, and
     dayMonth: true, badDates: n where they apply (readGc), and sample, the file it is a
     replicate of, where it is one (REPLICATES)}, and the included ones, which the analysis
     sees, `files`, with which the per-sample arrays each card keeps are aligned; the
     alerts under the drop zone, the dates read day first or left out and the empty cells
     skipped among them; each card's settings in the history. A gas's values, which
     nothing changes once read, are fixed (db.js: the same array in a tab's states and its
     parked state). */
  const kit = moduleKit('gc', {
    root, key, layer,
    alerts: p =>{ $('gcAlerts').innerHTML = p.invalid + dateAlertsHtml() + blankAlertsHtml() + p.upload; },
    dismiss: { blank: ()=> allFiles.forEach(f=> blankSeen.add(f.gas)), dates: ()=> allFiles.forEach(f=> dateSeen.add(f.gas)) },
    // Every card's per-sample arrays. An excluded file holds its own values; one with none
    // (never so far, or in a card added since) gets the upload defaults.
    slots: ()=> cards().flatMap(a=> live.get(a.id).slots()),
    // (a head removed: its group stays, headed by its next file, relink)
    listed: op =>{ if (op !== 'palette') each(c=> c.unselect()); if (op === 'remove') relink(); },
    refresh: afterFilesChange,
    // The Sample column of the file list (REPLICATES).
    note: sampleCell, noteHead: 'SAMPLE', noteChange: setSample,
    // A label or a colour changed: the zoom kept (the data are the same), a folded card not
    // drawn (to v494 it was, hidden, at no size, and lost its zoom). A file's sample: the
    // mean-rate bars alone, the only plot per sample.
    redraw: what => what === 'note' ? each(c=> c.bars()) : each((c, a)=>{ if (what === 'label') c.renderTable(); if (!deck.isFolded(a)) c.compute(true); else c.computeQuiet(); }),
    cleared: ()=> each(c=> c.clear()),
    snapshot: ()=> ({ cards: cards().map(a=> ({ ...deck.saved(a), ...live.get(a.id).snapshot() })) }),
    /* A file as a restore takes it (modkit RESTORED): its injections, each with a date that
       is one, and the columns of the gases it has beside them, a cell that is no number an
       empty one; none of either, it is left out. A record that is all that already is kept
       as it is: the empty-cell and the dates' alerts dismissed stay so (blankSeen and
       dateSeen mark its gases). */
    file: f =>{
      if (!isArr(f.injDates) || !isObj(f.gas)) return null;
      const n = f.injDates.length, ks = Object.keys(f.gas), emptyRows = num(f.emptyRows, 0, v=> v >= 0);
      if (n && ks.length && f.injDates.every(d=> dateOf(d) === d) && ks.every(k=> GASES.some(g=> g.key === k) && Array.isArray(f.gas[k]) && f.gas[k].length === n)){
        ks.forEach(k=> fixed(f.gas[k]));
        return emptyRows === f.emptyRows ? f : { ...f, emptyRows };
      }
      const at = [], injDates = [], gas = {};
      Array.from(f.injDates).forEach((d, i)=>{ const v = dateOf(d); if (v){ at.push(i); injDates.push(v); } });
      for (const g of GASES){ const a = f.gas[g.key]; if (isArr(a)) gas[g.key] = fixed(at.map(i=> Number.isFinite(a[i]) ? a[i] : NaN)); }
      return injDates.length && Object.keys(gas).length ? { ...f, injDates, gas, emptyRows } : null;
    },
    // A project from before the cards had one analysis, its settings at the top level. A
    // card built afresh takes its settings when its analysis is made (init), its
    // per-sample arrays without the entries of the files the restore left out. The files'
    // samples as they should be (relink): a project from before them, each file its own.
    restore: (s, gone)=>{ relink(); deck.load(cardList(s.cards, KINDS) || [{ ...s, id: 1, type: 'rate' }],
      src=> ({ init: { ...src, ...Object.fromEntries(PER_SAMPLE.filter(k=> k in src).map(k=> [k, without(src[k], gone)])) } }), a=>{ live.get(a.id).restore(a.init); delete a.init; });
      // (what its cards showed, given as its tab woke or the page was reloaded: showNext)
      if (cardsNext){ const v = cardsNext; cardsNext = null; each((c, a)=>{ if (isObj(v[a.id])) c.showNext(v[a.id]); }); } },
    /* Re-fit at the current size, keeping the zoom. Nothing changed since it was all drawn
       (nothing left undrawn while hidden, the same width): nothing to draw, a tab shown
       again as it was left. */
    redrawTab: ()=>{
      const at = String(root.clientWidth);
      if (!stale && at === drawnAt) return;
      stale = false; drawnAt = at;
      fitCsvIcons(root);
      if (files.length){ deck.fitNames(); each((c, a)=>{ if (!deck.isFolded(a)) c.compute(true); else c.computeQuiet(); }); }
    },
    csv: ()=> cards().flatMap(a=> live.get(a.id).exportEntries(fileSafe(a.name))),
  });
  const { all: allFiles, files } = kit;
  const each = fn => cards().forEach(a=> fn(live.get(a.id), a));

  /* ---- REPLICATES ----
     Each file is a sample of its own, or a replicate of another file's: its record's
     `sample`, the name of the file that heads the group, which the list's Sample column
     chooses. Linked by the file's name, its identity in the list (the drop loads no name
     twice), not by its label: a label renamed changes nothing. No chains: a file is linked
     to a head alone (a file linked to none), and a head linked to another takes its group
     along. Every plot and CSV stays per file but the mean-rate bars and mean_rates.csv,
     one per sample (samplesOf, sampleRates). */
  // The files by name, those whose name is theirs alone (`twice`, the others: a hand-edited project's).
  function byName(){
    const by = new Map(), twice = new Set();
    allFiles.forEach(f=>{ if (by.has(f.name)) twice.add(f.name); by.set(f.name, f); });
    twice.forEach(n=> by.delete(n));
    return { by, twice };
  }
  const isHead = f => !('sample' in f);
  /* The links as they should be. A head no longer in the list (removed): its group stays,
     the first of it in list order heading it and the others linked to that one. What a
     project read in may hold besides (RESTORED): a link that is no name, to the file
     itself, to a name two files have, or to a file linked in turn (a chain): taken off,
     the file its own sample. */
  function relink(){
    const { by, twice } = byName(), heir = new Map();
    allFiles.forEach(f=>{
      const s = f.sample;
      if (typeof s !== 'string' || by.has(s) || twice.has(s)) return;
      if (heir.has(s)) f.sample = heir.get(s); else { heir.set(s, f.name); delete f.sample; }
    });
    allFiles.forEach(f=>{ if (isHead(f)) return; const h = typeof f.sample === 'string' && by.get(f.sample); if (!h || h === f || !isHead(h)) delete f.sample; });
  }
  // A file's head: the file it is linked to, or itself.
  const headOf = (f, by)=> (!isHead(f) && by.get(f.sample)) || f;
  /* The file list's Sample column: a select of the file's own name and the heads', in list
     order, on its head's; dimmed with the row when the file is left out, as its label is. */
  function sampleCell(f, i){
    const h = headOf(f, byName().by);
    return `<select class="file-sample" data-i="${i}" aria-label="Sample" title="The sample this file is: its own, or the one another file heads (its replicates)">${
      allFiles.filter(g=> g === f || isHead(g)).map(g=> `<option value="${esc(g.name)}"${g === h ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}</select>`;
  }
  /* File i's sample chosen (modkit noteChange): its own, it heads one again; a head's, it
     joins that one's, with the files it headed. A walk through its select's options
     (`again`: the arrow keys, each a choice, the focus kept) is one choice changed: the
     files it headed as the walk began (`walk`) go with it at each step, and back to it
     with its own. Taken each step from the links then, a head stepped on to a second head
     left its group on the first, and stepped back to its own left it there, the select
     showing what it showed before. */
  let walk = null;
  function setSample(i, name, again){
    const f = allFiles[i], h = byName().by.get(name);
    if (!f || !h || !(h === f || isHead(h))) return;
    if (!again || !walk || walk.f !== f) walk = { f, m: allFiles.filter(g=> g.sample === f.name) };
    walk.m.forEach(g=>{ g.sample = h.name; });
    if (h === f) delete f.sample; else f.sample = h.name;
  }
  /* The samples of the included files, in the order of their first: each { name, label, ks,
     the places of its files among the included }, named after its head (its file's name,
     the key of its bar), labelled with its head's label, or, the head left out, its first
     included file's. Each included file its own: the files, as before replicates. */
  function samplesOf(){
    const { by } = byName(), out = new Map();
    files.forEach((f, k)=>{
      const h = headOf(f, by);
      if (!out.has(h)) out.set(h, { name: h.name, label: (h.included !== false ? h : f).label, ks: [] });
      out.get(h).ks.push(k);
    });
    return [...out.values()];
  }

  // A gas on show: one of the included samples has it (hasGas).
  const gasPresent = k => files.some(f=> hasGas(f, k));
  /* The empty cells skipped, per file and gas: the blank cells of a row kept, and the
     rows with none of the file's gases (dropped at parse, `emptyRows`, an empty cell for
     each gas it has). Read off the loaded files each time, not kept from the drop, so it
     is there again when the project is reopened (or its tab brought back) and goes with
     a file removed. Dismissed, it stays away for the files on show through undo and redo:
     the mark is on the file's data as this load holds them, which the undo steps share,
     so a file dropped anew (a same-named one too), a reopened project, a tab brought back
     are named again, and a dismissal in one tab leaves the others' files named. */
  const blankSeen = new WeakSet();
  function blankAlertsHtml(){
    const lines = [];
    allFiles.forEach(f=>{
      const n = blankCounts(f);
      if (!n.some(Boolean) || blankSeen.has(f.gas)) return;
      lines.push(esc(f.name) + ': ' + GASES.map((g, j)=> n[j] ? `${n[j]} empty ${g.label} cell${n[j] > 1 ? 's' : ''}` : '').filter(Boolean).join(', '));
    });
    return lines.length ? buildAlertsHtml([], lines, 'Empty cells skipped: each injection is left out of that gas only (its rate, production and mean come from the injections with a value):', '', 'gc-dismiss-blank') : '';
  }

  /* The injection dates, said per file: a file read as day/month, the rows left out with
     a date that does not exist (readGc). Read off the loaded files and dismissed as the
     empty cells are (blankSeen), on a mark of its own. */
  const dateSeen = new WeakSet();
  function dateAlertsHtml(){
    const lines = [];
    allFiles.forEach(f=>{
      // (a project's .json may hold anything: only true and a whole count go into markup)
      const dm = f.dayMonth === true, n = num(f.badDates, 0, v=> Number.isInteger(v) && v > 0), say = [];
      if (dm) say.push('dates read as day/month (as month/day, some do not exist)');
      if (n) say.push(`${n} row${n > 1 ? 's' : ''} left out: ${n > 1 ? 'their' : 'its'} injection date does not exist (as ${dm ? 'day/month' : 'month/day'})`);
      if (say.length && !dateSeen.has(f.gas)) lines.push(esc(f.name) + ': ' + say.join('; '));
    });
    return lines.length ? buildAlertsHtml([], lines, 'Injection dates (the instrument writes them month/day):', '', 'gc-dismiss-dates') : '';
  }

  kit.dropText(readGc, ()=> afterFilesChange());

  // (The alerts are drawn with the list, kit.showFiles: the empty-cell alert follows the files.)
  // (all drawn, on show: its draw key, the width it was drawn at)
  function afterFilesChange(){
    kit.showFiles();
    $('gcAnalyses').style.display = files.length ? 'block' : 'none';
    each(c=> c.renderTable());
    if (files.length) each((c, a)=>{ if (!deck.isFolded(a)) c.compute(); else c.computeQuiet(); });
    syncResults();
    if (shown()){ stale = false; drawnAt = String(root.clientWidth); }
    kit.commit();
  }

  /* =========================================================
     A CARD: one analysis of the samples — its masses, flows, light-on times,
     integration intervals and injection delay, its plot, and its section of the
     Results. `a` is its record (cards.js), `card` its element; the state lives here,
     and goes to the history through snapshot / restore.
  ========================================================= */

  // (its elements found in its card, `card`, and its section of the Results, `res`, whether
  // or not they are in the page)
  function gcCard(a, card){
    const px = P(a), $ = id => card.querySelector('#' + px + id) || res.querySelector('#' + px + id);
    // The card's section of the Results, kept in card order under the Results' list.
    const res = document.createElement('div');
    res.className = 'res-an';
    res.dataset.an = a.id;
    res.innerHTML = resHtml(a);
    res.style.display = 'none';
    resList.appendChild(res);
    // The plots' gas chips, the card's and its section's.
    const gasEls = ()=> [...card.querySelectorAll('.gc-gas-sel'), ...res.querySelectorAll('.gc-gas-sel')];

    let ms=[], Qs=[], Ts=[], Ps=[], startArr=[], endArr=[], lightOnDates=[];
    let dataTables=[];
    let plot1;
    /* Analysis and Results choose their gases separately, but every plot inside a
       section follows that section's choice — the chips on each plot are views of one
       set, not five independent ones. Each section holds a SET of gas keys rather than
       one mode, so any combination is reachable and a third gas would need no new
       option; the only rule is that a section can never end up with none. */
    let gasSel = { a: GASES.map(g=>g.key), r: GASES.map(g=>g.key) };
    /* What a section actually draws: chosen, and present in at least one included
       sample; when none chosen is there, every gas that is. Worked out at each render
       from the files of the moment, the choice itself left as the user made it: to v474
       renderGasSel pruned it to the gases loaded, so an O2 file added after an H2-only
       one stayed hidden. */
    function shownGases(sec){
      const there = GASES.filter(g=> gasPresent(g.key));
      const chosen = there.filter(g=> gasSel[sec].includes(g.key));
      return chosen.length ? chosen : there;
    }
    // all/one per parameter: 'all' = one shared value for every sample; 'one' = per-sample.
    // Each of m, Q, T, p, start and end toggles independently. Default: everything shared ('all').
    let mMode='all', qMode='all', tMode='all', pMode='all', startMode='all', endMode='all';
    let mShared=15, qShared=2, tShared=T_NEW, pShared=P_ATM, startShared=0, endShared=24;
    let pUnit = 'atm';
    let delayAuto = true, delayMan = INJ_DELAY_AUTO;
    const injDelay = ()=> delayAuto ? INJ_DELAY_AUTO : delayMan;
    const injectedAt = d => new Date(+d + injDelay()*1000);
    let costResults=[];
    let gcSel=null, gcHov=null;   // selected / hovered sample index (interval interaction)
    // Outgoing plot view captured before a resize/tab-switch redraw recreates the plots,
    // so drawGcData can restore the current zoom instead of snapping to the full range:
    // on the same samples and the same full range only (modcharts setView), so a card
    // unfolded after its files changed shows them all.
    let prevView=null;

    // Effective per-sample values (respect each parameter's all/one mode).
    const mOf     = k => mMode==='all'     ? mShared     : ms[k];
    const qOf     = k => qMode==='all'     ? qShared     : Qs[k];
    const tOf     = k => tMode==='all'     ? tShared     : Ts[k];
    const pOf     = k => pMode==='all'     ? pShared     : Ps[k];   // Pa
    const startOf = k => startMode==='all' ? startShared : startArr[k];
    const endOf   = k => endMode==='all'   ? endShared   : endArr[k];
    // The plot shows per-sample interval lines (interactive) whenever either bound is per-sample.
    const intPerSample = () => startMode==='one' || endMode==='one';

    // A card added with samples loaded starts from the upload defaults for each.
    files.forEach(f=>{ ms.push(15); Qs.push(2); Ts.push(T_NEW); Ps.push(P_ATM); startArr.push(0); endArr.push(24); lightOnDates.push(firstInjection(f)); });

    // Warning when a sample's light-on time is before (or at) its first injection
    function lightOnWarn(i){
      const f = files[i], lo = lightOnDates[i];
      if (!f || !lo || isNaN(+lo)) return false;
      return !f.injDates.some(d => injectedAt(d) < lo);
    }
    function refreshLightOnWarnings(){
      $('ParamTableWrap').querySelectorAll('.gc-row').forEach(r=>{
        const wc = r.querySelector('.gc-warn-cell');
        if (wc) wc.innerHTML = lightOnWarnHtml(+r.dataset.i);
      });
    }
    function lightOnWarnHtml(i){
      return lightOnWarn(i)
        ? '<div class="alert warn" style="margin:0;padding:6px 8px;font-size:11px">⚠ Light-on time is before first injection</div>'
        : '';
    }

    function renderGcParamTable(){
      const wrap = $('ParamTableWrap');
      if (!files.length){ wrap.innerHTML=''; return; }
      // Sample 9 | m 9 | Q 11.5 | T 9 | p 12 | Light-on 20.5 | start 9 | end 9 | warnings 11 (%):
      // at the table's least width, 1000 px (style.css's .gc-param-table min-width), each
      // header's pill beside its name (the name on two lines where it must) and the date
      // field whole. At 860 px, the least width to v500, Q's pill already ran over its
      // cell, and the date field by a few px; with p's column, every pill would.
      const cg = `<colgroup><col style="width:9%"><col style="width:9%"><col style="width:11.5%"><col style="width:9%"><col style="width:12%"><col style="width:20.5%"><col style="width:9%"><col style="width:9%"><col style="width:11%"></colgroup>`;
      const shareState = mode => mode==='all' ? 'on'  : 'off';   // shared "All" row cell
      const cellState  = mode => mode==='all' ? 'ro'  : 'on';    // per-sample row cell
      // Column order: Sample | m | Q | T | p | Light-on | [Interval: start end] | warnings.
      // The delay, one for every sample, on a row of its own above the table and on its
      // columns: its name under Sample, its value under m, the Auto switch under Q.
      // p's unit is chosen in its header, where the other columns name theirs: in the
      // header's own type, its box let out of the line's height as the pill's is (-3 px),
      // so that p's name and pill sit level with the others' and the box with the pill.
      const unitSel = `<select class="gc-unit" aria-label="Unit of p" title="The unit p is shown and written in: switching it converts the values, not the pressure (Torr: mmHg)" style="width:auto;margin:-3px 0;padding:0 2px;border-radius:5px;font:inherit;color:inherit">${
        Object.keys(P_UNITS).map(u=> `<option value="${u}"${u === pUnit ? ' selected' : ''}>${u}</option>`).join('')}</select>`;
      let html = `<div style="overflow-x:auto"><table class="gc-param-table gc-delay" style="width:100%;table-layout:fixed">${cg}<tbody>
        <tr><td class="fname">Injection delay (s)</td>
          <td>${numCell('gcDelay', 'title="From the logged injection date to the actual injection, in seconds"', injDelay(), delayAuto ? 'off' : 'on')}</td>
          <td><label class="pp-check" title="Use the method's delay, ${INJ_DELAY_AUTO} s"><input type="checkbox" class="gcDelayAuto"${delayAuto ? ' checked' : ''}> Auto</label></td>
          <td colspan="6"></td></tr></tbody></table>
        <table class="gc-param-table" style="width:100%;table-layout:fixed">${cg}<thead>
        <tr><th rowspan="2">${thHead('Sample', '')}</th>
          <th rowspan="2">${thHead('m (mg)', modeChip('m',mMode))}</th>
          <th rowspan="2">${thHead('Q (mL/min)', modeChip('q',qMode))}</th>
          <th rowspan="2" title="T: ${T_TITLE}">${thHead('T (°C)', modeChip('t',tMode))}</th>
          <th rowspan="2" title="p: ${P_TITLE}">${thHead('p ' + unitSel, modeChip('p',pMode))}</th>
          <th rowspan="2">${thHead('Light-on date/time', '')}</th>
          <th colspan="2" class="gc-grp"><div class="gc-grp-in">Interval (h)</div></th>
          <th rowspan="2"></th></tr>
        <tr><th>${thHead('start', modeChip('start',startMode))}</th><th>${thHead('end', modeChip('end',endMode))}</th></tr></thead><tbody>`;
      // Shared "all" row
      html += `<tr class="gc-all-row"><td class="fname">All</td>
        <td>${numCell('gcShared','data-f="m"',mShared,shareState(mMode))}</td>
        <td>${numCell('gcShared','data-f="q"',qShared,shareState(qMode))}</td>
        <td>${numCell('gcShared','data-f="t"',tShared,shareState(tMode))}</td>
        <td>${numCell('gcShared','data-f="p"',inUnit(pShared, pUnit),shareState(pMode))}</td>
        <td></td>
        <td>${numCell('gcShared','data-f="start"',startShared,shareState(startMode))}</td>
        <td>${numCell('gcShared','data-f="end"',endShared,shareState(endMode))}</td>
        <td></td></tr>`;
      // Per-sample rows
      files.forEach((f,i)=>{
        html += `<tr class="gc-row" data-i="${i}">
          <td class="fname" title="${esc(f.label)}">${esc(f.label)}</td>
          <td>${numCell('gcCell','data-i="'+i+'" data-f="m"',mOf(i),cellState(mMode))}</td>
          <td>${numCell('gcCell','data-i="'+i+'" data-f="q"',qOf(i),cellState(qMode))}</td>
          <td>${numCell('gcCell','data-i="'+i+'" data-f="t"',tOf(i),cellState(tMode))}</td>
          <td>${numCell('gcCell','data-i="'+i+'" data-f="p"',inUnit(pOf(i), pUnit),cellState(pMode))}</td>
          <td class="gc-date-cell" data-i="${i}"></td>
          <td>${numCell('gcCell','data-i="'+i+'" data-f="start"',startOf(i),cellState(startMode))}</td>
          <td>${numCell('gcCell','data-i="'+i+'" data-f="end"',endOf(i),cellState(endMode))}</td>
          <td class="gc-warn-cell">${lightOnWarnHtml(i)}</td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
      wrap.innerHTML = html;
      if (drawable()) fitCsvIcons();

      const delayIn = wrap.querySelector('.gcDelay'), delayBox = wrap.querySelector('.gcDelayAuto');
      guardNumericInput(delayIn, { min:0 });
      delayIn.addEventListener('change', ()=>{
        delayMan = +delayIn.value;
        refreshLightOnWarnings(); computeAndRenderGc(); kit.commit();
      });
      // Off, the field opens on the value that was in force, ready to be changed.
      delayBox.addEventListener('change', ()=>{
        if (!delayBox.checked && delayAuto) delayMan = INJ_DELAY_AUTO;
        delayAuto = delayBox.checked;
        renderGcParamTable(); computeAndRenderGc(); kit.commit();
      });
      // p's unit: the values shown again in it, the pressure and so the rates as they were.
      // The fields in place, not the table drawn anew, which would take the focus off the
      // select (an arrow key on it is a change at once).
      const unitIn = wrap.querySelector('.gc-unit');
      unitIn.addEventListener('change', ()=>{
        pUnit = oneOf(unitIn.value, Object.keys(P_UNITS));
        wrap.querySelectorAll('input[data-f="p"]').forEach(inp=>{ inp.value = inUnit(inp.classList.contains('gcShared') ? pShared : pOf(+inp.dataset.i), pUnit); });
        kit.commit();
      });

      // all/one toggles: flip a parameter, seeding across the boundary (one→all from
      // sample 0, all→one from the shared value), then re-render + recompute. An interval
      // bound back to all, sample 0's for every sample, is refused as a value typed is,
      // with the same words, where it would not leave each interval's start before its end
      // (intervalWhy; to v494 it was taken as it was).
      wrap.querySelectorAll('.gc-toggle').forEach(btn=> btn.addEventListener('click', ()=>{
        const flip = (mode, shared, arr, setShared)=>{
          if (mode==='one'){ setShared(arr[0]); return 'all'; }
          files.forEach((f,i)=>{ arr[i]=shared; }); return 'one';
        };
        const pair = btn.dataset.pair, back = { start: startMode, end: endMode }[pair] === 'one';
        const why = back ? intervalWhy(pair, (pair === 'start' ? startArr : endArr)[0], true) : null;
        if (why){ flashFieldInvalid(btn); confirmBanner(why, 'OK'); return; }
        switch (pair){
          case 'm':     mMode     = flip(mMode,     mShared,     ms,       v=>mShared=v);     break;
          case 'q':     qMode     = flip(qMode,     qShared,     Qs,       v=>qShared=v);     break;
          case 't':     tMode     = flip(tMode,     tShared,     Ts,       v=>tShared=v);     break;
          case 'p':     pMode     = flip(pMode,     pShared,     Ps,       v=>pShared=v);     break;
          case 'start': startMode = flip(startMode, startShared, startArr, v=>startShared=v); gcSel=gcHov=null; break;
          case 'end':   endMode   = flip(endMode,   endShared,   endArr,   v=>endShared=v);   gcSel=gcHov=null; break;
        }
        renderGcParamTable(); computeAndRenderGc(); kit.commit();
      }));

      // m/Q/T/p inputs (shared + per-sample) — recompute the whole series on a valid change.
      const wireNum = (inp, apply, min = 0.001, max = null)=>{
        guardNumericInput(inp, { min, max });
        const shared = inp.classList.contains('gcShared');
        inp.addEventListener('change', ()=>{
          apply(+inp.value);
          if (shared) mirrorShared(inp.dataset.f, inp.value);
          computeAndRenderGc(); kit.commit();
        });
      };
      wrap.querySelectorAll('.gcShared[data-f="m"]').forEach(inp=> mMode==='all' && wireNum(inp, v=>mShared=v));
      wrap.querySelectorAll('.gcShared[data-f="q"]').forEach(inp=> qMode==='all' && wireNum(inp, v=>qShared=v));
      wrap.querySelectorAll('.gcCell[data-f="m"]').forEach(inp=>{ if(mMode==='one'){ const i=+inp.dataset.i; wireNum(inp, v=>ms[i]=v); }});
      wrap.querySelectorAll('.gcCell[data-f="q"]').forEach(inp=>{ if(qMode==='one'){ const i=+inp.dataset.i; wireNum(inp, v=>Qs[i]=v); }});
      wrap.querySelectorAll('.gcShared[data-f="t"]').forEach(inp=> tMode==='all' && wireNum(inp, v=>tShared=v, -273));
      wrap.querySelectorAll('.gcCell[data-f="t"]').forEach(inp=>{ if(tMode==='one'){ const i=+inp.dataset.i; wireNum(inp, v=>Ts[i]=v, -273); }});
      // p typed in its unit, kept in Pa; 0 and below refused (the least min above 0).
      wrap.querySelectorAll('.gcShared[data-f="p"]').forEach(inp=> pMode==='all' && wireNum(inp, v=>pShared=toPa(v, pUnit), Number.MIN_VALUE, P_MAX));
      wrap.querySelectorAll('.gcCell[data-f="p"]').forEach(inp=>{ if(pMode==='one'){ const i=+inp.dataset.i; wireNum(inp, v=>Ps[i]=toPa(v, pUnit), Number.MIN_VALUE, P_MAX); }});

      // start/end inputs — start and end can be in different modes, so each input is wired
      // independently and validated against the effective counterpart (end>start per sample).
      if (startMode==='all') wireBoundInput(wrap.querySelector('.gcShared[data-f="start"]'), 'start', true, 0);
      if (endMode==='all')   wireBoundInput(wrap.querySelector('.gcShared[data-f="end"]'),   'end',   true, 0);
      files.forEach((f,i)=>{
        if (startMode==='one') wireBoundInput(wrap.querySelector(`.gcCell[data-i="${i}"][data-f="start"]`), 'start', false, i);
        if (endMode==='one')   wireBoundInput(wrap.querySelector(`.gcCell[data-i="${i}"][data-f="end"]`),   'end',   false, i);
      });

      wrap.querySelectorAll('.gc-date-cell').forEach(cell=>{
        const i = +cell.dataset.i;
        const field = createDateTimeField(lightOnDates[i], d=>{
          lightOnDates[i] = d;
          const wc = cell.closest('tr').querySelector('.gc-warn-cell');
          if (wc) wc.innerHTML = lightOnWarnHtml(i);
          computeAndRenderGc(); kit.commit();
        });
        cell.appendChild(field.el);
      });

      // Row ↔ plot interaction (interval mode 'one'): hover highlights the sample's lines
      // on both plots; clicking (off the inputs) toggles the selection.
      wrap.querySelectorAll('.gc-row').forEach(row=>{
        const i = +row.dataset.i;
        row.addEventListener('mouseenter', ()=> setGcHover(i));
        row.addEventListener('mouseleave', ()=> setGcHover(null));
        row.addEventListener('click', e=>{ if (e.target.closest('input, button, .gc-date-cell')) return; selectGc(i); });
      });
      refreshGcRows();
    }

    // Wire a single interval-bound input (start or end; shared or per-sample i). Since the
    // two bounds can be in different all/one modes, each input validates against the
    // effective counterpart so that end>start holds for every affected sample. Invalid
    // input shakes the field and reverts.
    /* With a parameter set to "all", the per-sample cells are read-only echoes of the
       shared value and nothing redraws them on their own, so they are brought into step
       when the shared field is confirmed — otherwise the rows go on showing the old
       number until the next full render. Not while it is typed: a half-written number
       is not a value the samples have. */
    function mirrorShared(field, value){
      $('ParamTableWrap').querySelectorAll(`.gcCell[data-f="${field}"]`)
        .forEach(inp=>{ inp.value = value; });
    }

    /* Why the interval's bound `which` cannot be `v` (null when it can): a start not before
       the end, or an end not after the start, of a sample it applies to (`k`; every sample
       for the common value, isShared). The words are the same when a value typed is refused
       and when the all/one chip is (to v494 a value typed was refused with no word). */
    function intervalWhy(which, v, isShared, k){
      const bad = (isShared ? files.map((_, i)=> i) : [k]).find(i=> which === 'start' ? !(v < endOf(i)) : !(v > startOf(i)));
      if (bad === undefined) return null;
      const who = files.length > 1 ? ` of ${files[bad].label}` : '';
      return which === 'start' ? `The interval must start before it ends: ${v} h is not before the end${who}, ${endOf(bad)} h.`
        : `The interval must end after it starts: ${v} h is not after the start${who}, ${startOf(bad)} h.`;
    }
    function wireBoundInput(inp, which, isShared, i){
      if (!inp) return;
      guardNumericInput(inp, {});
      const echo = ()=>{ if (isShared) mirrorShared(which, inp.value); };
      inp.addEventListener('change', ()=>{
        const cur = isShared ? (which==='start'?startShared:endShared) : (which==='start'?startArr[i]:endArr[i]);
        const v = parseIntervalField(inp.value);
        if (v===null){ inp.value = cur; echo(); return; }
        // A shared start must stay below every sample's end; a per-sample start below its own end.
        const why = intervalWhy(which, v, isShared, i);
        if (why){ flashFieldInvalid(inp); inp.value = cur; echo(); confirmBanner(why, 'OK'); return; }
        if (isShared){ if (which==='start') startShared=v; else endShared=v; }
        else { if (which==='start') startArr[i]=v; else endArr[i]=v; }
        echo();
        updateRegression(); kit.commit();
      });
      inp.addEventListener('keydown', e=>{ if (e.key==='Enter') inp.blur(); });
    }

    // The data and the mean rates, from the card's parameters; `draw` false for a card
    // folded (nothing in it is drawn), whose Results section is still kept up to date.
    function computeTables(){
      dataTables = files.map((f,h)=>{
        const ks = Object.keys(f.gas), lightOn = lightOnDates[h];
        const key = exactKey([f.injDates.map(d=> +d), ks.map(k=> [k, objId(f.gas[k])]), +lightOn, injDelay(), qOf(h), tOf(h), pOf(h), mOf(h)]);
        const made = tablesKept(ks.length ? f.gas[ks[0]] : null, key, ()=> tablesOf(f, h, lightOn)), gas = {};
        for (const k in made.gas) gas[k] = { ...made.gas[k], FmInt: made.gas[k].cum };
        return {t: made.t, gas, name:f.name, label:f.label, color:f.color};
      });
    }
    function tablesOf(f, h, lightOn){
      const hours = d => (d - lightOn)/3600000;
      // The injections in time order; `t`, the sample's times (the light-on instant
      // among them), spans the plot's x-range.
      const rows = f.injDates.map((d,i)=> ({ d: injectedAt(d), i })).sort((a,b)=>a.d-b.d);
      const t = [...rows.map(r=> r.d), lightOn].sort((a,b)=>a-b).map(hours);
      // Total molar flow: mL/min -> L/h -> mol/h at the molar volume of the flow's T and p.
      const F = qOf(h)/1000*60/molarVolume(tOf(h), pOf(h));
      const gas = {};
      for (const k in f.gas){
        /* Each gas on its own times: the injections it has a value for, with the
           light-on instant inserted as an extra point carrying its last reading before
           it (zero if the run starts after it). An empty cell is left out of this gas
           alone, so its rate, production and mean come from the injections it has; to
           v474 it was read as 0 %, which pulled them all down. */
        const pts = rows.filter(r=> !noValue(f.gas[k][r.i])).map(r=> ({ d: r.d, v: f.gas[k][r.i] }));
        if (!pts.length) continue;
        let idxBefore = -1;
        for (let i=0;i<pts.length;i++) if (pts[i].d < lightOn) idxBefore = i;
        pts.push({ d: lightOn, v: idxBefore<0 ? 0 : pts[idxBefore].v });
        pts.sort((a,b)=>a.d-b.d);
        const tHours = pts.map(p=> hours(p.d));
        const pct = pts.map(p=> p.v);
        const flow = pct.map(v=> v/100*F*1e6);             // umol/h of this gas
        const flowM = flow.map(v=> v/mOf(h));              // per mg -> mmol/(g h)
        // From the first injection on; FmInt, from the interval's start (updateRegression).
        const cum = cumtrapz(tHours, flowM);
        gas[k] = { t: tHours, pct, flow, Fm: flowM, cum };
      }
      return {t, gas};
    }
    // (its tab not on show: the tables and the rates worked out, the CSVs' and the Results'
    // own, and nothing drawn: drawn whole as it is shown)
    function computeAndRenderGc(preserveView){
      if (!files.length) return;
      // Snapshot the current zoom before renderGcPlots() builds fresh Plot instances.
      prevView = preserveView ? viewOf($('Svg1')._plot) : null;
      computeTables();
      renderGasSel();
      if (drawable()) renderGcPlots(); else updateRegression();
    }

    /* The gas selector, rendered into the card and its Results section and driving one
       state each. Options the loaded files cannot supply are disabled rather than hidden,
       so the control does not change shape from one data set to the next. */
    function renderGasSel(){
      // A gas no included sample carries cannot be chosen, and is off while it is not
      // there; the chips show what is drawn (shownGases), the choice stays untouched. The
      // last one standing cannot be switched off — the plot would be empty.
      gasEls().forEach(el=>{
        const sec = el.dataset.gasSec;
        el.innerHTML = chipRow(GASES, shownGases(sec).map(g=> g.key), { cls: 'gc-gas-chip', data: g=> `data-gas="${g.key}" data-sec="${sec}"`,
          name: g=> g.csv, can: g=> gasPresent(g.key), why: g=> `No ${g.csv} in the included files` });
      });
    }

    function onGasChip(e){
      const b = e.target.closest('.gc-gas-chip');
      if (!b || b.disabled) return;
      // Switched off, what was on show stays chosen (a fallback included); a gas chosen
      // but not loaded now stays chosen too, for when a file brings it (toggleChip).
      const sec = b.dataset.sec, sel = toggleChip(GASES.map(g=> g.key), gasSel[sec], shownGases(sec).map(g=> g.key), b.dataset.gas);
      if (!sel) return;    // never leave a section with none
      // Switching changes how tall the legend is, which would shift everything below it
      // under the pointer. Hold the clicked chip still and let the page move around it.
      // The chips are rebuilt, so the one to measure afterwards is found by which group
      // it belongs to, not by its selector — every plot in the section has a matching
      // chip and the first one is metres away from the one under the pointer.
      const groups = gasEls();
      const gi = groups.indexOf(b.parentElement);
      const before = b.getBoundingClientRect().top;
      gasSel[sec] = sel;
      renderGasSel();
      computeAndRenderGc(false);     // ranges are rescaled to the gases now on show
      // Corrected in the same task, not on a later frame: reading the chip's box forces
      // the layout, so the final position is known before anything is painted and the
      // page never shows the shifted state on its way back.
      const grp = gasEls()[gi];
      const after = grp && grp.querySelector('.gc-gas-chip');
      if (after) window.scrollBy({ top: after.getBoundingClientRect().top - before, behavior: 'instant' });
      kit.commit();
    }
    card.addEventListener('click', onGasChip);
    res.addEventListener('click', onGasChip);

    function renderGcPlots(){
      const legend = $('Legend'); legend.innerHTML='';
      plot1 = new Plot($('Svg1'), {xlabel:'Time (h)', ylabelSvg:LBL_RATE_SVG});
      const resLegend = $('ResLegend'); resLegend.innerHTML='';
      legend.innerHTML   = dataTables.map(d=> gasLegendHtml(d, shownGases('a'))).join('');
      resLegend.innerHTML = dataTables.map(d=> gasLegendHtml(d, shownGases('r'))).join('');
      plot1.attachTools(plot1.svg.closest('.plot-wrap'));
      updateRegression();
    }

    // Draw the data lines with an x-range spanning both the data and every interval line
    // (so bars are never clipped), y from 0 to the data from light-on on (yTop). Interval lines
    // are drawn as an overlay, redrawn on pan/zoom via _onView.
    function drawGcData(){
      if (!plot1 || !dataTables.length) return;
      // Restore the pre-redraw zoom captured in computeAndRenderGc (resize/tab-switch),
      // then clear it so a subsequent data-driven redraw snaps back to the full range.
      const prev = prevView; prevView = null;
      const allT = dataTables.flatMap(d=>d.t);
      const intPts = dataTables.flatMap((d,k)=>[startOf(k), endOf(k)]);
      const tmin = Math.min(0, minArr(allT), ...intPts);
      const tmax = Math.max(maxArr(allT), ...intPts);
      // Every shown gas shares the axis: they are the same quantity in the same units.
      const shown = shownGases('a');
      const span = key => dataTables.flatMap(d=> shown.filter(g=>d.gas[g.key]).map(g=> d.gas[g.key][key]));
      if (!span('Fm').length) return;
      plot1.setRange(tmin, tmax, 0, yTop(dataTables, shown, 'Fm')*1.05);
      setView(plot1, prev, viewKey(dataTables));
      plot1.drawAxes(); plot1.clearData();
      drawGasLines(plot1, dataTables, shown, 'Fm');
      plot1._onView = ()=> drawGcIntervals(plot1);
      drawGcIntervals(plot1);
    }

    // Integration-interval vertical lines. 'all': one shared pair in the theme-aware
    // grey (--plot-errbar). 'one': a pair per sample in the sample's colour (1px), with
    // an invisible fat hit line for hover/select; hovered/selected lines thicken, the
    // selected pair turns the highlight grey.
    function drawGcIntervals(plot){
      if (!plot) return;
      const g = plot.gOverlay;
      g.querySelectorAll('.gc-int').forEach(e=>e.remove());
      const { h } = plot.size(), m = plot.margin;
      const vline = (xv, o)=>{
        const px = plot.px(xv);
        const ln = svgEl('line',{x1:px,x2:px,y1:m.t,y2:h-m.b,'stroke-width':o.width,'pointer-events':'none','class':'gc-int'+(o.cls?' '+o.cls:'')});
        if (o.color) ln.setAttribute('stroke', o.color);
        g.appendChild(ln);
        if (o.hit){
          const ht = svgEl('line',{x1:px,x2:px,y1:m.t,y2:h-m.b,stroke:'transparent','stroke-width':16,'cursor':'pointer','class':'gc-int'});
          ht.addEventListener('pointerenter', ()=> setGcHover(o.k));
          ht.addEventListener('pointerleave', scheduleClearGcHover);
          ht.addEventListener('click', ()=> selectGc(o.k));
          g.appendChild(ht);
        }
      };
      if (!intPerSample()){
        vline(startShared, {width:1.5, cls:'gc-int-hl'});
        vline(endShared,   {width:1.5, cls:'gc-int-hl'});
      } else {
        dataTables.forEach((d,k)=>{
          const sel = gcSel===k, on = sel || gcHov===k;
          const o = { k, hit:true, width: on?2.6:1, cls: sel?'gc-int-hl':'', color: sel?null:d.color };
          vline(startOf(k), o); vline(endOf(k), o);
        });
      }
    }

    // ---- Row ↔ plot interaction (both respond in unison) ----
    let gcHoverRAF = null;
    function scheduleClearGcHover(){
      if (gcHoverRAF) cancelAnimationFrame(gcHoverRAF);
      gcHoverRAF = requestAnimationFrame(()=>{ gcHoverRAF=null; setGcHover(null); });
    }
    function setGcHover(k){
      if (!intPerSample()) k = null;
      if (gcHoverRAF){ cancelAnimationFrame(gcHoverRAF); gcHoverRAF=null; }
      if (gcHov === k) return;
      gcHov = k;
      drawGcIntervals(plot1); refreshGcRows();
    }
    function selectGc(k){
      if (!intPerSample()) return;
      // Clear any transient hover so the green .hovering tint doesn't linger after a
      // click (mirrors the XRD peak table, whose full re-render drops it).
      if (gcHoverRAF){ cancelAnimationFrame(gcHoverRAF); gcHoverRAF=null; }
      gcHov = null;
      gcSel = (gcSel===k) ? null : k;
      drawGcIntervals(plot1); refreshGcRows();
    }
    function refreshGcRows(){
      $('ParamTableWrap').querySelectorAll('.gc-row').forEach(r=>{
        const k = +r.dataset.i;
        r.classList.toggle('hovering', k===gcHov);
        r.classList.toggle('selected', k===gcSel);
      });
    }

    function computeRates(){
      /* The production is what was made between the interval's lines: none yet at its
         start, wherever that is moved to. Integrated from the first injection it carried
         everything that flowed out before (the dark readings, a purge) into every later
         point. The mean rate below, a difference, is the same either way. */
      dataTables.forEach((d,k)=>{
        const t0 = Math.min(startOf(k), endOf(k));
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
      costResults = dataTables.map((d,k)=>{
        const rate = {}, dt = {};
        for (const key in d.gas){
          const q = d.gas[key], [a, b] = spanOf(q.t, k);
          if (b > a){ rate[key] = (cumAt(q.t, q.Fm, q.cum, b) - cumAt(q.t, q.Fm, q.cum, a)) / (b - a); dt[key] = b - a; }
        }
        const [a0, b0] = spanOf(d.t, k);
        return {name:d.name, label:d.label, rate, dt, span: b0 > a0 ? b0 - a0 : NaN};
      });
    }
    const hasResults = ()=> costResults.some(c=> GASES.some(g=>isFinite(c.rate[g.key])));
    function updateRegression(){
      computeRates();
      const draw = drawable();
      if (draw) drawGcData();
      // Show the Results section before drawing into it: plots sized from a hidden element
      // would measure 0. It stays hidden while no sample has a valid integration interval.
      res.style.display = hasResults() ? '' : 'none';
      syncResults();
      if (draw){ drawResultPlots(); drawBarChart(); }
    }

    // The interval of sample k as far as a gas's data reach: [start, end] within the first
    // and last of its times `t`.
    function spanOf(t, k){
      const n = t.length;
      if (n < 2) return [NaN, NaN];
      return [Math.max(Math.min(startOf(k), endOf(k)), t[0]), Math.min(Math.max(startOf(k), endOf(k)), t[n-1])];
    }
    /* Results series: the Analysis curves between the interval's lines — the injections
       inside it, and at each line the straight line between the injections around it,
       read there — which is what the mean rate integrates. Each gas on its own times, as
       in Analysis; `t`, all of them, spans the x-range. */
    function cutTables(){
      return dataTables.map((d,k)=>{
        const gas = {};
        for (const key in d.gas){
          const q = d.gas[key], [a, b] = spanOf(q.t, k);
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

    // The two Results plots: same quantities as Analysis, between the interval's lines and
    // without the interval overlay (Results shows the retained data only), y from 0 to
    // the data from light-on on, as there.
    function drawResultPlots(){
      const cut = cutTables();
      if (!cut.length || !cut.some(d=>d.t.length)) return;
      const allT = cut.flatMap(d=>d.t);
      const tmin = Math.min(0, minArr(allT)), tmax = maxArr(allT);
      const shown = shownGases('r');
      const mk = (id, ylabelSvg, key)=>{
        const svg = $(id);
        const p = new Plot(svg, {xlabel:'Time (h)', ylabelSvg});
        const arrs = cut.flatMap(d=> shown.filter(g=>d.gas[g.key]).map(g=> d.gas[g.key][key]));
        if (!arrs.length) return;
        p.setRange(tmin, tmax, 0, yTop(cut, shown, key)*1.05);
        p.drawAxes(); p.clearData();
        drawGasLines(p, cut, shown, key);
        p.attachTools(svg.closest('.plot-wrap'));
      };
      mk('SvgRate', LBL_RATE_SVG, 'Fm');
      mk('SvgCum',  LBL_CUM_SVG,  'FmInt');
    }

    /* The mean rates per sample (samplesOf), of each gas: the mean over the sample's files
       of each one's mean rate (costResults: worked out with its own m, Q, T, p, light-on
       and interval), `n` the files with one, and its ± (`err`) the files' standard
       deviation (n − 1 under it); none for one file. To v511 a bar per file, with no ±; in
       v512 the ± was the half-width of the 99 % confidence interval of the mean,
       t(0.995, n − 1)·s/√n. */
    function sampleRates(){
      return samplesOf().map(s=>{
        const rate = {}, err = {}, n = {};
        for (const g of GASES){
          const v = s.ks.map(k=> costResults[k] && costResults[k].rate[g.key]).filter(Number.isFinite);
          n[g.key] = v.length;
          if (!v.length) continue;
          rate[g.key] = meanArr(v);
          err[g.key] = v.length > 1 ? stdArr(v) : NaN;
        }
        return { ...s, rate, err, n };
      });
    }
    /* The mean rates (modcharts.js valueBars), a bar per sample, each shown gas a series of
       its own beside the others in each sample's slot, the way the XRPD size chart pairs
       raw and corrected: coloured by gas (the samples are told apart by their place on the
       axis, the gases would not be) and named by it, as the legend under the chart is; its
       error bar the ± of the sample's replicates. Nothing to show draws nothing: the
       section's visibility is updateRegression's. */
    function drawBarChart(){
      const svg = $('SvgBar'), sm = sampleRates();
      valueBars(svg, { cats: sm, digits: 4, yLabel: LBL_RATE_SVG, legend: $('BarLegend'),
        series: shownGases('r').map(g=> ({ name: gasTxt(g), color: g.bar, vals: sm.map(s=> s.rate[g.key]), errs: sm.map(s=> s.err[g.key]) })),
        chips: svg.closest('.plot-wrap').querySelector('.gc-gas-sel') });
    }

    // The inputs as they were set, in the CSV's decimal separator and not rounded: fmtNum
    // with no decimals wrote a 60.6 s delay as 61.
    const asSet = v => String(v).replace('.', settings.decimal);
    // The card's CSVs, named after it.
    function exportEntries(n){
      if (!dataTables.length) return [];
      const entries = [];
      // One block of columns per sample (each keeps its own time axis). gc_raw.csv carries
      // the full series with every intermediate quantity; gc_results.csv keeps only the
      // three plotted columns, between the interval's lines as plotted.
      // Only what the Results plots are showing: pick H2, O2 or both and it follows.
      const shown = shownGases('r');
      const buildSeriesCsv = (tables, full)=>{
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
          const col = (j, arr)=> rows.map(r=> r.at[j] < 0 ? '' : fmtNum(arr[r.at[j]],5));
          cols.push({h:`Time (h) [${d.label}]`, v:rows.map(r=>fmtNum(r.t,5))});
          qs.forEach(([g, q], j)=>{
            if (full){
              cols.push({h:`${g.csv} (%mol) [${d.label}]`,      v:col(j, q.pct)});
              cols.push({h:`${g.csv} (umol h^-1) [${d.label}]`, v:col(j, q.flow)});
            }
            cols.push({h:`${g.csv} ${LBL_RATE_CSV} [${d.label}]`, v:col(j, q.Fm)});
            cols.push({h:`${g.csv} ${LBL_CUM_CSV} [${d.label}]`,  v:col(j, q.FmInt)});
          });
        });
        return wideCsv(cols);
      };
      entries.push({name:`${n} - gc_raw.csv`,     text:buildSeriesCsv(dataTables, true)});
      entries.push({name:`${n} - gc_results.csv`, text:buildSeriesCsv(cutTables(), false)});
      // mean_rates.csv — bar-plot-like summary (one row per file). One duration column
      // while every file's shown gases cover the same span (a file with none of them,
      // its own span, as before); when a gas of some file reaches less far (an empty
      // cell at the interval's edge), one column per gas for every file.
      // The flow's pressure, in the card's unit, and its temperature last: the rates were
      // worked out at their molar volume (T the last column since v495, p beside it).
      const durs = c => shown.map(g=> fmtNum(c.dt[g.key],4));
      const perGas = shown.length > 1 && costResults.some(c=> new Set(durs(c).filter(Boolean)).size > 1);
      // The columns after the rates, and file k's.
      const tailHead = [...(perGas ? shown.map(g=>`${g.csv} interval duration (h)`) : ['Interval duration (h)']), `p (${pUnit})`, 'T (°C)'];
      const tail = k =>{ const c = costResults[k]; return [...(perGas ? durs(c) : [durs(c).find(Boolean) || fmtNum(c.span,4)]), asSet(inUnit(pOf(k), pUnit)), asSet(tOf(k))]; };
      let t2 = csvLine(['Sample', ...shown.map(g=>`Mean ${g.csv} ${LBL_RATE_CSV}`), ...tailHead]);
      costResults.forEach((c, k)=> t2 += csvLine([c.label, ...shown.map(g=>fmtNum(c.rate[g.key],6)), ...tail(k)]));
      /* With replicates (a sample of more than one included file), mean_rates.csv has a row
         per sample: its name (its bar's), each gas's mean, ± and n (sampleRates), then its
         files' durations, p and T, each one value where they agree, else all of them in
         list order joined by '/' (a gas's duration, of the files that have it); the rows per
         file above are mean_rates_by_file.csv. With none, mean_rates.csv is those, as to
         v511. */
      const sm = sampleRates();
      if (sm.some(s=> s.ks.length > 1)){
        const one = vs =>{ const w = vs.filter(v=> v !== ''); return w.every(v=> v === w[0]) ? (w[0] || '') : w.join('/'); };
        let t4 = csvLine(['Sample', ...shown.flatMap(g=> [`Mean ${g.csv} ${LBL_RATE_CSV}`, `${g.csv} SD (mmol g^-1 h^-1)`, `${g.csv} n`]), ...tailHead]);
        sm.forEach(s=>{
          const tails = s.ks.map(tail);
          t4 += csvLine([s.label, ...shown.flatMap(g=> [fmtNum(s.rate[g.key],6), fmtNum(s.err[g.key],6), String(s.n[g.key])]), ...tailHead.map((_, j)=> one(tails.map(t=> t[j])))]);
        });
        entries.push({name:`${n} - mean_rates.csv`, text:t4}, {name:`${n} - mean_rates_by_file.csv`, text:t2});
      } else entries.push({name:`${n} - mean_rates.csv`, text:t2});
      // gc_info.csv — per-sample inputs + the integration interval used
      // Local time, as the light-on field shows it and as the instrument logged it:
      // toISOString() wrote UTC, two hours early in Italian summer time.
      const pad = n => String(n).padStart(2, '0');
      const fmtDate = v =>{ if (!v) return ''; const d = new Date(v);
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
      let t3 = csvLine(['Sample','m (mg)','Q (mL/min)','T (°C)',`p (${pUnit})`,'Light-on','Interval start (h)','Interval end (h)','Injection delay (s)']);
      dataTables.forEach((d,k)=> t3 += csvLine([d.label, asSet(mOf(k)), asSet(qOf(k)), asSet(tOf(k)), asSet(inUnit(pOf(k), pUnit)), fmtDate(lightOnDates[k]), asSet(startOf(k)), asSet(endOf(k)), asSet(injDelay())]));
      entries.push({name:`${n} - gc_info.csv`, text:t3});
      return entries;
    }

    return {
      res,
      // The per-sample arrays, for the file list (keys the card's own).
      slots: ()=> [
        // (a value held through an exclusion, as a restore takes it: modkit RESTORED)
        { key: a.id + ':m', arr:ms, make: v=> num(v, 15, x=> x > 0) },
        { key: a.id + ':Q', arr:Qs, make: v=> num(v, 2, x=> x > 0) },
        { key: a.id + ':T', arr:Ts, make: v=> num(v, T_NEW, okT) },
        { key: a.id + ':p', arr:Ps, make: v=> num(v, P_ATM, okP) },
        { key: a.id + ':start', arr:startArr, make: v=> num(v, 0) },
        { key: a.id + ':end', arr:endArr, make: v=> num(v, 24) },
        { key: a.id + ':lightOn', arr:lightOnDates, make: (v, f)=> dateOf(v) || (f ? firstInjection(f) : null) },
      ],
      clear(){ [ms,Qs,Ts,Ps,startArr,endArr,lightOnDates].forEach(x=> x.length=0); dataTables=[]; costResults=[]; },
      unselect(){ gcSel = gcHov = null; },
      /* What it shows beside its state (the instance's shows, below): the sample picked in
         its table or on its plot, its interval highlighted (intervals one per sample), by
         its file's name, given back as its tab wakes or the page is reloaded, the card
         restored, where that file is still a sample and the intervals still one per sample. */
      shows(){ return gcSel != null && intPerSample() && files[gcSel] ? { sel: files[gcSel].name } : null; },
      showNext(v){ const k = v && typeof v.sel === 'string' && intPerSample() ? files.findIndex(f=> f.name === v.sel) : -1; if (k >= 0) gcSel = k; },
      // (a file's sample changed: the bars alone are per sample)
      bars(){ if (files.length && drawable()) drawBarChart(); },
      renderTable: renderGcParamTable,
      compute: computeAndRenderGc,
      // A folded card draws nothing; its Results section is drawn all the same.
      computeQuiet(){
        if (!files.length) return;
        computeTables(); renderGasSel(); computeRates();
        res.style.display = hasResults() ? '' : 'none';
        syncResults();
        if (drawable()){ drawResultPlots(); drawBarChart(); }
        $('ResLegend').innerHTML = dataTables.map(d=> gasLegendHtml(d, shownGases('r'))).join('');
      },
      hasResults: ()=> res.style.display !== 'none',
      exportEntries,
      snapshot(){
        return {
          ms: ms.slice(), Qs: Qs.slice(), Ts: Ts.slice(), Ps: Ps.slice(), startArr: startArr.slice(), endArr: endArr.slice(),
          lightOnDates: lightOnDates.map(d=> d ? d.getTime() : null),
          mMode, qMode, tMode, pMode, startMode, endMode, mShared, qShared, tShared, pShared, startShared, endShared, pUnit,
          gasSel: { a:gasSel.a.slice(), r:gasSel.r.slice() },
          delayAuto, delayMan,
        };
      },
      /* Each value as it should be (modkit RESTORED): a mode 'all' or 'one', a mass and a
         flow above 0, a pressure as the fields take it (okP), a temperature from −273 °C,
         p's unit one of its own, a bound and the delay numbers, a light-on a date (else the sample's first injection),
         every per-sample array one entry a sample (to v500 an array that was none threw, a
         value that was no number drew NaN). */
      restore(s0){
        const s = isObj(s0) ? s0 : {}, n = files.length, GK = GASES.map(g=> g.key), mode = v => oneOf(v, ['all', 'one']), pos = v => v > 0;
        // Projects saved before O2 existed, or under the older single-mode selector.
        const fromMode = m => GK.includes(m) ? [m] : GK, sel = v => Array.isArray(v) ? GK.filter(k=> v.includes(k)) : GK;
        const gm = isObj(s.gasMode) ? s.gasMode : {};
        gasSel = isObj(s.gasSel) ? { a: sel(s.gasSel.a), r: sel(s.gasSel.r) } : { a: fromMode(gm.a), r: fromMode(gm.r) };
        ms = arrOf(s.ms, n, v=> num(v, 15, pos)); Qs = arrOf(s.Qs, n, v=> num(v, 2, pos));
        lightOnDates = arrOf(s.lightOnDates, n, (v, i)=> dateOf(v) || firstInjection(files[i]));
        // Projects from before the delay existed take it too, on Auto: the timestamps they
        // were computed from are just as late.
        delayAuto = s.delayAuto !== false;
        delayMan = num(s.delayMan, INJ_DELAY_AUTO, v=> v >= 0);
        if (s.mMode !== undefined || s.intMode !== undefined){
          // Current format: independent per-parameter modes; or paired-mode projects
          // (mqMode / intMode), migrated to independent modes.
          if (s.mMode !== undefined){ mMode = mode(s.mMode); qMode = mode(s.qMode); startMode = mode(s.startMode); endMode = mode(s.endMode); }
          else { mMode = qMode = mode(s.mqMode); startMode = endMode = mode(s.intMode); }
          mShared = num(s.mShared, 15, pos); qShared = num(s.qShared, 2, pos); startShared = num(s.startShared, 0); endShared = num(s.endShared, 24);
        } else {
          // Migrate the oldest projects: a single global interval → interval 'all' mode.
          mMode='one'; qMode='one'; startMode='all'; endMode='all';
          mShared=15; qShared=2;
          startShared = num(numStr(s.plateauStart), 0); endShared = num(numStr(s.plateauEnd), 24);
        }
        startArr = arrOf(s.startArr, n, v=> num(v, startShared)); endArr = arrOf(s.endArr, n, v=> num(v, endShared));
        // A project from before the temperature (none in its state) keeps the 0 °C its rates
        // were worked out at: the field shows it, and it can be changed.
        const T0 = ['tMode', 'tShared', 'Ts'].some(k=> k in s) ? T_NEW : T_OLD;
        tMode = mode(s.tMode); tShared = num(s.tShared, T0, okT); Ts = arrOf(s.Ts, n, v=> num(v, tShared, okT));
        // One from before the pressure was worked out at 1 atm, where a new card starts too.
        pMode = mode(s.pMode); pShared = num(s.pShared, P_ATM, okP); Ps = arrOf(s.Ps, n, v=> num(v, pShared, okP));
        pUnit = oneOf(s.pUnit, Object.keys(P_UNITS));
        gcSel=gcHov=null;
      },
    };
  }

  /* ---- The cards (cards.js), and the Results: each card's section under its name ---- */
  const resList = $('gcResList');
  const live = new Map();       // id → the card's analysis (gcCard)
  let cardsNext = null;         // what the cards of a tab woken or reloaded showed (showNext), by id
  const placeRes = ()=> cards().forEach(a=>{ const c = live.get(a.id); if (c) resList.appendChild(c.res); });
  // The Results card is there while some card has a result to show.
  function syncResults(){
    const on = cards().filter(a=> live.has(a.id) && live.get(a.id).hasResults());
    $('gcResultsBar').style.display = files.length && on.length ? 'block' : 'none';
    cards().forEach(a=>{ const c = live.get(a.id); if (c) c.res.classList.toggle('is-first', a === on[0]); });
  }
  function named(a){
    const card = deck.cardOf(a), c = live.get(a.id);
    if (!card || !c) return;
    const n = fileSafe(a.name);
    card.querySelector('.table-csv-btn').dataset.csvNames = `${n} - gc_info.csv`;
    nameDownloads(card.querySelector('.plot-wrap'), `${n} - GC_rate.svg`, `${n} - gc_raw.csv`);
    c.res.querySelector('.res-an-title').textContent = a.name;
    const w = c.res.querySelectorAll('.plot-wrap');
    nameDownloads(w[0], `${n} - GC_results_rate.svg`, `${n} - gc_results.csv`);
    nameDownloads(w[1], `${n} - GC_results_cumulative.svg`, `${n} - gc_results.csv`);
    nameDownloads(w[2], `${n} - GC_results.svg`, `${n} - mean_rates.csv`);
  }
  const deck = kit.deck({
    kinds: KINDS, info: ()=> GC_INFO, body: cardBody,
    build: (a, card)=>{ const c = gcCard(a, card); live.set(a.id, c); if (a.init){ c.restore(a.init); delete a.init; } },
    drop: a=>{ const c = live.get(a.id); if (c){ c.res.remove(); live.delete(a.id); } syncResults(); },
    autoName: ()=> 'Production Rate', named,
    changed: ()=>{ placeRes(); syncResults(); },
    loaded: placeRes,
    added: a=>{ const c = live.get(a.id); c.renderTable(); if (files.length) c.compute(); },
    wake: a=>{ if (files.length) live.get(a.id).compute(true); },
  });
  const cards = ()=> deck.records;
  // A card's settings in the history (kit.snapshot): its per-sample m/Q/light-on,
  // integration intervals, delay and gases.

  // A new project starts with one card.
  deck.start(['rate']);

  /* ---- The instance (tabs.js) ----
     A GC tab, hidden, holds little beyond its sleeping form (0.2 MB of heap for 10
     exports), most of it its parameter table and file list, which it shows as they are;
     its plots let go gave back nothing measurable, their tool buttons still holding their
     Plots (measured at v518). */
  return {
    // Let go (its tab closed or put to sleep; a state read out for its CSVs): the deck's
    // menu and its listeners. Its section and layer are the shell's to take out.
    destroy(){ kit.destroy(); },
    /* What it shows beside its state (tabs.js, utils.js shownOf): each card's own, by
       its id (the sample picked), given back as its tab wakes or the page is reloaded, to
       the restore. */
    shows(){
      const out = {};
      each((c, a)=>{ const v = c.shows(); if (v) out[a.id] = v; });
      return Object.keys(out).length ? { cards: out } : null;
    },
    showNext(v){ cardsNext = isObj(v) && isObj(v.cards) ? v.cards : null; },
  };
}
registerModule('gc', createGc);
