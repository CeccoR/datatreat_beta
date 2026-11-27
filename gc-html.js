/* =========================================================
   GC — the Production Rate cards' words and markup that need no page (gc.js puts them in
   the cards, the Results and the alerts; tests/gcmodel.test.mjs reads them in Node): the
   instructions (with "From the reading to the rates", its example worked out with the
   module's own numbers), a card's body and its section of the Results, the parameter
   table, a sample's legend entries, the file list's Sample column, the alerts under the
   drop zone (the pairs, the dates, the empty cells, the alternative export: their lines,
   which modkit.js puts in their boxes) and at a card's top (where its values came from).
   Taken out of v556's gc.js as they were: the same markup to the byte.
   What they need from the page is handed in, u = { esc, num, plotWrap, CSV_ICON, alertHtml }
   (utils.js's esc and alerts, modkit.js's num, modcharts.js's plot box and CSV icon: gc.js
   HU), and the cards' own instructions (cards.js cardInfo) where they end with them.
========================================================= */
import { NORM, PER, P_ATM, P_UNITS, INJ_DELAY_AUTO, GASES, molarVolume, inUnit, injDelay, mOf, aOf, qOf, tOf, pOf, startOf, endOf,
  lightOnWarn, lacking, seriesName, gasTxt, blankCounts, byName, headOf, isHead, isTable, isTcd, rowFiles } from './gc-model.js';
import { boxHtml } from './alerts.js';
import { failedWhy } from './gc-integ-html.js';

/* ---- The instructions ---- */
// What T and p are (their columns' titles, and the card's instructions).
export const T_TITLE = 'the temperature the flow Q refers to: for a mass-flow controller (sccm, slpm), the reference temperature of its standard units (Alicat: 25 °C), not that of the gas in the lines or the reactor; for a flow measured as a volume, the gas temperature where it is measured';
export const P_TITLE = 'the absolute pressure the flow Q refers to: for a mass-flow controller, the reference pressure of its standard units (Alicat: 14.696 psia = 1 atm), not that of the gas in the lines or the reactor; for a flow measured as a volume, the absolute pressure of the gas where it is measured (ambient ≈ 1 atm)';
/* "From the reading to the rates" (v542), a box of its own in the card's instructions: the
   steps tablesOf, cumAt and computeRates take for each gas, from an injection's reading to
   its rate, its production and the mean rate, each with a short title, what it means, its
   formula typeset in MathML and the units of its symbols; then those steps worked through
   for an example. The browser draws MathML Core itself, with no script (the CSP stands),
   and cards.js puts the instructions in by innerHTML, which parses MathML as it does SVG.
   As in print: a letter standing for a quantity in italics (mi), the label of a subscript
   (V_m, t_s), a word and Δ upright. The example's numbers are worked out here with the
   module's own molar volume and units, so they are the rates the app gives. */
const RATES_HTML = (()=>{
  const mi = s => `<mi>${s}</mi>`, up = s => `<mi mathvariant="normal">${s}</mi>`, mn = s => `<mn>${s}</mn>`;
  const mo = (s, a = '')=> `<mo${a}>${s}</mo>`, mtext = s => `<mtext>${s}</mtext>`;
  const mrow = (...xs)=> `<mrow>${xs.join('')}</mrow>`, mfrac = (a, b)=> `<mfrac>${a}${b}</mfrac>`;
  const msub = (a, b)=> `<msub>${a}${b}</msub>`, msup = (a, b)=> `<msup>${a}${b}</msup>`;
  const paren = (...xs)=> mrow(mo('('), ...xs, mo(')')), of = a => mrow(mo('(', ' stretchy="false"'), a, mo(')', ' stretchy="false"'));
  const accent = (s, mark)=> `<mover accent="true">${s}<mo>${mark}</mo></mover>`;
  const slash = mo('/', ' lspace="0" rspace="0"'), dot = mo('⋅'), times = mo('×'), eq = mo('='), thin = '<mspace width="0.17em"/>';
  const nb = '\u00a0';   // (a space mtext keeps at the start of its text)
  const display = (...xs)=> `<math display="block">${xs.join('')}</math>`, im = (...xs)=> `<math>${xs.join('')}</math>`;
  // One of two forms, as LaTeX's cases: a brace, each form with when it applies.
  const cases = rows => mrow(mo('{'), `<mtable class="instr-cases" displaystyle="true">${rows.map(([f, when])=> `<mtr><mtd>${f}${mo(',')}</mtd><mtd>${when}</mtd></mtr>`).join('')}</mtable>`);
  const pow10 = e => msup(mn('10'), mn(e)), sci = (a, e)=> mrow(mn(a), times, pow10(e));
  // A unit after a number, upright, a power as a superscript: unit('L', ['mol', '−1']).
  const unit = (...us)=> '<mspace width="0.3em"/>' + us.map(u=> Array.isArray(u) ? msup(mtext(u[0]), mn(u[1])) : mtext(u)).join(thin);
  const x = mi('x'), c = mi('c'), R = mi('R'), T = mi('T'), p = mi('p'), Q = mi('Q'), F = mi('F'), m = mi('m'), A = mi('A'), r = mi('r'), t = mi('t'), P = mi('P');
  const Vm = msub(mi('V'), up('m')), nd = accent(mi('n'), '˙'), rbar = accent(mi('r'), '¯');
  const ts = msub(t, up('s')), te = msub(t, up('e')), tinj = msub(t, mi('inj')), delay = mrow(up('Δ'), msub(t, mi('delay'))), ton = msub(t, mi('on'));
  const i = mi('i'), n = mi('n'), i1 = mrow(i, mo('+'), mn('1')), tp = msup(t, mo('′'));
  const step = (title, what, eqs, ...lines)=>
    `<li><b>${title}.</b> ${what}<div class="instr-eqbox">${eqs.join('')}</div>${lines.map(l=> `<div class="instr-units">${l}</div>`).join('')}</li>`;
  // The example as the module works it out (tablesOf): 0.05 %mol in 2 mL/min at 25 °C and 1 atm.
  const vm = molarVolume(25, P_ATM), ndot = 2/1000*60/vm, flow = 0.05/100*ndot*1e6;
  const ex = { vm: vm.toFixed(3), nd: (ndot*1e3).toFixed(4), F: flow.toFixed(4),
    rm: (flow/15*NORM.m.per).toFixed(2), ra: (flow/2.5*NORM.A.per).toFixed(5) };
  return '<div class="instr-math"><h4 class="instr-math-head">From the reading to the rates</h4>'
  + `<p class="instr-math-lead">As they are worked out for each gas, from each injection's reading ${im(c)}:</p><ol class="instr-steps">`
  + step('Mole fraction from the reading', 'The part of the gas leaving the reactor that is this gas.',
    [display(x, eq, cases([[mfrac(c, mn('100')), mrow(c, mtext(nb + 'in %mol'))], [mrow(c, dot, pow10('−6')), mrow(c, mtext(nb + 'in ppm'))]]))],
    `${im(x)}: no unit; ${im(c)}: %mol in the default layout, ppm in the alternative export.`)
  + step('Molar flow of the carrier', `The carrier's flow ${im(Q)} in moles per hour, through the molar volume ${im(Vm)} of an ideal gas at ${im(T)} and ${im(p)}: for a mass-flow controller, its reference ${im(T)} and ${im(p)} (see <b>mass-flow controller</b> above).`,
    [display(Vm, eq, mfrac(mrow(R, paren(T, mo('+'), mn('273.15'))), mrow(p, slash, mn('101325')))),
     display(nd, eq, mfrac(Q, mn('1000')), dot, mfrac(mn('60'), Vm))],
    `${im(Vm)}: L mol⁻¹; ${im(R)} = 0.0820573661 L atm mol⁻¹ K⁻¹; ${im(T)}: °C; ${im(p)}: Pa (101325 Pa atm⁻¹); ${im(Q)}: mL min⁻¹, at the controller's reference ${im(T)} and ${im(p)} (1000 mL L⁻¹, 60 min h⁻¹); ${im(nd)}: mol h⁻¹.`,
    `At 1 atm, ${im(Vm)} is 22.414 L mol⁻¹ at 0 °C and 24.465 L mol⁻¹ at 25 °C.`)
  + step('Flow of the gas produced', "This gas's share of that flow, in micromoles per hour.",
    [display(F, eq, x, dot, nd, dot, pow10('6'))],
    `${im(F)}: µmol h⁻¹ (10⁶ µmol mol⁻¹).`,
    `Assumed: the carrier's flow ${im(nd)} is the total flow leaving the reactor, which holds when the products are a small part of it (ppm to a few %mol).`)
  + step('Rate', "The gas's flow over the photocatalyst's mass or, for a film, its area, as the m column's header chooses; as it flows where a sample has none.",
    [display(r, eq, cases([[mfrac(F, mrow(m, slash, mn('1000'))), mtext('by mass')], [mfrac(F, A), mtext('by area')], [F, mtext('not normalised')]]))],
    `${im(r)}: µmol g⁻¹ h⁻¹ with ${im(m)} in mg (1000 mg g⁻¹), µmol cm⁻² h⁻¹ with ${im(A)} in cm², or µmol h⁻¹ not normalised.`)
  + step('Time', "Each injection's time from light-on, in hours.",
    [display(t, eq, mfrac(mrow(tinj, mo('+'), delay, mo('−'), ton), mn('3600')))],
    `${im(t)}: h; ${im(tinj)}, the injection date, ${im(delay)}, the injection delay, and ${im(ton)}, the light-on time: s (3600 s h⁻¹).`,
    `At light-on, ${im(t, eq, mn('0'))}: a point with the last reading before it (${im(r, eq, mn('0'))} if there is none).`)
  + step('Production', `What was made from the interval's start ${im(ts)} to ${im(t)}: the area under ${im(r)}, by trapezoids, ${im(r)} a straight line from one point to the next.`,
    [display(P, of(t), eq, `<msubsup>${mo('∫')}${ts}${t}</msubsup>`, r, thin, up('d'), tp),
     display(P, of(t), eq, `<munderover>${mo('∑')}${mrow(i, eq, mn('0'))}${mrow(n, mo('−'), mn('1'))}</munderover>`,
       mfrac(mrow(msub(r, i), mo('+'), msub(r, i1)), mn('2')), dot, paren(msub(t, i1), mo('−'), msub(t, i)))],
    `${im(P)}: µmol g⁻¹ or µmol cm⁻²; ${im(t)}: h.`,
    `${im(msub(t, mn('0')), eq, ts)} and ${im(msub(t, n), eq, t)}, with the injections and light-on in between; ${im(msub(r, i))} is ${im(r)} at ${im(msub(t, i))}, ${im(msub(r, mn('0')))} and ${im(msub(r, n))} read on the straight line at ${im(ts)} and at ${im(t)}; ${im(P, of(ts), eq, mn('0'))}.`)
  + step('Mean rate', 'The production over the interval divided by its length: the bar and mean_rates.csv.',
    [display(rbar, eq, mfrac(mrow(P, of(te)), mrow(te, mo('−'), ts)))],
    `${im(rbar)}: as ${im(r)}; ${im(ts)}, ${im(te)}: h, the interval taken within the gas's first and last points.`)
  + '</ol><h5 class="instr-math-head">Worked example</h5>'
  + `<p class="instr-math-lead">0.05 %mol in ${im(Q, eq, mn('2'), unit('mL', ['min', '−1']))} at ${im(T, eq, mn('25'), unit('°C'))} and ${im(p, eq, mn('1'), unit('atm'))}, over ${im(m, eq, mn('15'), unit('mg'))} or ${im(A, eq, mn('2.5'), unit(['cm', '2']))}; each value goes on unrounded into the next step.</p><ol class="instr-steps instr-example">`
  + `<li><b>Mole fraction.</b><div class="instr-eqbox">${display(x, eq, mfrac(mn('0.05'), mn('100')), eq, sci('5', '−4'))}</div></li>`
  + `<li><b>Molar flow.</b><div class="instr-eqbox">${display(Vm, eq, mfrac(mrow(mn('0.0820573661'), times, paren(mn('25'), mo('+'), mn('273.15'))), mrow(mn('101325'), slash, mn('101325'))), eq, mn(ex.vm), unit('L', ['mol', '−1']))}`
  + `${display(nd, eq, mfrac(mn('2'), mn('1000')), dot, mfrac(mn('60'), mn(ex.vm)), eq, sci(ex.nd, '−3'), unit('mol', ['h', '−1']))}</div></li>`
  + `<li><b>Flow of the gas.</b><div class="instr-eqbox">${display(F, eq, paren(sci('5', '−4')), times, paren(sci(ex.nd, '−3')), times, pow10('6'), eq, mn(ex.F), unit('µmol', ['h', '−1']))}</div></li>`
  + `<li><b>Rate.</b> By mass, then by area.<div class="instr-eqbox">${display(r, eq, mfrac(mn(ex.F), mrow(mn('15'), slash, mn('1000'))), eq, mn(ex.rm), unit('µmol', ['g', '−1'], ['h', '−1']))}`
  + `${display(r, eq, mfrac(mn(ex.F), mn('2.5')), eq, mn(ex.ra), unit('µmol', ['cm', '−2'], ['h', '−1']))}</div></li>`
  + '</ol></div>';
})();
export const gcInfo = cardInfo => `Set catalyst mass (m) or, for a film, its area (A), carrier gas flow rate (Q), its temperature (T) and pressure (p), the light-on time and the integration interval for each sample to compute mean H₂ and O₂ production rates; the <b>header of the m column</b> chooses for the whole card what the rates are divided by: the photocatalyst's <b>mass</b>, m (mg) (rates in µmol g⁻¹ h⁻¹, production in µmol g⁻¹; the default; to v540 in mmol g⁻¹ h⁻¹ and mmol g⁻¹, so a project saved before shows the same results, their numbers 1000 times what they were) or its <b>area</b>, A (cm²) (µmol cm⁻² h⁻¹ and µmol cm⁻², the usual units for films); the column then shows A, with its own all / one, the masses and the areas both kept apart, so that switching back loses neither and never reads one as the other. The rates are normalised where every sample has a value of the one chosen above 0; a field left empty is none, and while a sample has none the rates are not normalised (µmol h⁻¹ and µmol), a line under the parameters naming the samples. The plots, the bar chart, the CSVs and their headers follow. the <b>H₂ / O₂</b> chips on each plot choose the gases drawn, for Analysis and for Results; the CSVs have every gas, whichever is drawn. Two layouts are read. The <b>default</b>: a header naming the Injection Date and each gas's %mol column (H₂, O₂). The <b>alternative</b>, the instrument's tab-separated .txt export: a header naming Inject Time and its Area and Amount columns, over a line naming each column's gas (Hydrogen, Nitrogen, Oxygen); H₂ and O₂ are read from the Amount columns, in ppm, and worked out as %mol (ppm / 10⁴), gc_raw.csv writing them in ppm (its column headed so), the Area columns and N₂ left out, and an info alert under the drop zone names each file read so. An empty H₂ or O₂ cell, or one reading n.a., leaves that injection out of that gas only, and the alert under the drop zone says how many were skipped; a blank line, a line of separators alone and a row with no date (n.a.) are passed over. An injection date is the day, the month and the year between slashes, the month a number or an English name (Nov, November), the year of 4 digits or 2 (26 is 2026), then the time, h:mm or h:mm:ss, with AM/PM or in 24 hours (14:13). Numeric dates are read month/day, as the instrument writes them, or day/month in a file where some do not exist so and every one does that way, its times going on as the rows do; a month named is read where it stands (13/Nov/26 is 13 November). A row whose date does not exist (2/30, 13/13, 31/Nov, 13:00 PM) is left out, and the alert says either. Use the <b>all / one</b> toggles to share a value across samples or set it per sample. <b>T</b> is ${T_TITLE}. <b>p</b> is ${P_TITLE}; its unit (atm, bar, kPa, mbar, Torr = mmHg, psi) is chosen in its column's header, which converts the values shown, not the pressure. A <b>mass-flow controller</b> (an Alicat MC, say) gives a mass flow as the volume it would take at its reference conditions (sccm, slpm), so the molar flow is n/t = p<sub>ref</sub>·Q/(R·T<sub>ref</sub>) with the controller's reference T and p: the real temperature and pressure of the gas, in the lines or in the reactor, do not enter. Set T and p to its standard conditions: Alicat's default is 25 °C and 14.696 psia (1 atm) for its standard units, 0 °C and 1 atm for its normal ones (NCCM, NLPM), and the device's STP/NTP menu can change them. Its reading is right for the gas it is set to: another gas or a mixture needs that gas chosen on the device, or its correction factor. ${RATES_HTML}A new analysis starts at 25 °C and 1 atm; a project saved before T existed keeps the 0 °C its rates were worked out at, and one saved before p, the 1 atm. The <b>injection delay</b> moves every injection on from its logged date to the moment the sample is actually injected; <b>Auto</b> uses 60.6 s. In per-sample interval mode the vertical lines are coloured by sample: hover or select a table row to highlight its interval on the plot (and vice-versa). <b>Replicates</b>: the <b>Sample</b> column of the file list says which sample each file is: its own (as it starts), or another file's, named by that file's label (a label renamed shows at once and changes no link); a file that heads a group, set to another, takes its group along, and a head removed leaves its group to its next file. The time plots stay one per file; the mean-rate bar chart has one bar per sample, named after its head's label (the first included file's, the head left out), its height the mean of its included files' mean rates, each worked out with its own parameters, and its error bar the files' standard deviation (n − 1 under it; none for a single file); a file left out is out of the mean and of n. With replicates (a sample of more than one included file), mean_rates.csv has a row per sample (each gas's mean, ± and n) and mean_rates_by_file.csv a row per file, as mean_rates.csv has without them. <b>Raw chromatograms</b> (v544): a table paired with its raw chromatograms (they share a row of the file list) takes its H₂ and O₂ from the nearest <b>Integration</b> card above this one, re-integrated, the table still giving the injection times, when the table has as many injections (its rows with a date and a value) as there are chromatograms and the gas has a calibration (the standards, or the GC software's scale taken over); everything after is as above. Where it cannot, the table's own values are used, and an alert at the top of this card says why (the counts differ, no calibration and too few injections to take the software's scale, the integration not done yet). A card with no Integration card above it uses the tables, as before. gc_raw.csv then says, at each injection, which value was used (the <i>source</i> column), with the table's, the re-integrated one and the fitted area beside it. ${cardInfo}`;

/* ---- The parameter table's cells ---- */
// A numeric text cell; `state` = 'on' (editable), 'ro' (read-only) or 'off' (disabled); a value
// that is none (null: a mass or an area left empty), empty.
function numCell(cls, attrs, value, state, u){
  const dis = state==='off' ? 'disabled' : (state==='ro' ? 'readonly' : '');
  return `<input class="${cls}" ${attrs} type="text" inputmode="decimal" value="${u.esc(value)}" ${dis} style="width:100%">`;
}
const modeChip = (pair, mode, u)=> `<button type="button" class="mode-chip gc-toggle" data-pair="${pair}" title="Switch all / one">${u.esc(mode)}</button>`;
// A header over a field: its name on the field's left edge, its all/one pill on the
// field's right edge.
const thHead = (label, chip)=> `<div class="gc-th"><span>${label}</span>${chip}</div>`;

/* ---- A card's markup ---- */
const pre = a => 'gc' + a.id;
// A plot of a card's, with the gas chips of its section (`sec`: 'a' Analysis, 'r' Results) over it.
const gasPlot = (u, id, sec, o)=> u.plotWrap(id, { mod: 'gc', extra: `\n              <span class="gc-gas-sel" data-gas-sec="${sec}"></span>`, ...o });
export const cardBody = (a, u)=> `
      <div class="gc-src" id="${pre(a)}Src"></div>
      <div class="peak-box" style="margin-top:0;margin-bottom:14px">
        <div class="peak-box-head">
          <span class="txt-mini">Parameters</span>
          <button class="btn table-csv-btn" data-csv-mod="gc" data-csv-names="gc_info.csv" title="Download CSV">${u.CSV_ICON}</button>
        </div>
        <div class="gc-param-wrap" id="${pre(a)}ParamTableWrap"></div>
        <p class="field-rule gc-param-rule" id="${pre(a)}ParamRule" role="alert" hidden></p>
        <div class="gc-norm-info" id="${pre(a)}NormInfo"></div>
      </div>
      <div class="row" style="align-items:flex-start">
        <div class="col">
          <p class="txt-caption">Production Rate</p>${gasPlot(u, pre(a) + 'Svg1', 'a', { cls: 'plot-strip', csv: 'gc_raw.csv', name: 'GC_rate.svg', legend: pre(a) + 'Legend' })}
        </div>
      </div>
      <div id="${pre(a)}Legend" class="legend" style="margin-top:8px"></div>
      <p class="txt-meta gc-norate" id="${pre(a)}NoRate" style="display:none;margin-top:8px"></p>`;
/* Why a card with samples has no Results (gc.js shows it under the card, v567: to v566 the
   Results were hidden with no word): no sample's interval overlaps its injections. */
export const NO_RATE = 'No rate to show: no sample\'s interval overlaps its injections.';
export const resHtml = (a, u)=> `
      <h4 class="res-an-title"></h4>
      <div class="row res-row">
        <div class="col">
          <p class="txt-caption">Production Rate</p>${gasPlot(u, pre(a) + 'SvgRate', 'r', { csv: 'gc_results.csv', name: 'GC_results_rate.svg', legend: pre(a) + 'ResLegend' })}
        </div>
        <div class="col">
          <p class="txt-caption">Production</p>${gasPlot(u, pre(a) + 'SvgCum', 'r', { csv: 'gc_results.csv', name: 'GC_results_cumulative.svg', legend: pre(a) + 'ResLegend' })}
        </div>
      </div>
      <div id="${pre(a)}ResLegend" class="legend" style="margin-top:8px"></div>
      <p class="txt-caption" style="margin-top:14px">Mean Production Rate</p>${gasPlot(u, pre(a) + 'SvgBar', 'r', { cls: 'plot-wide', csv: 'mean_rates.csv', name: 'GC_results.svg', legend: pre(a) + 'BarLegend' })}
      <div id="${pre(a)}BarLegend" class="legend" style="margin-top:8px"></div>`;

/* ---- The parameter table ----
   The card's parameters (P), a row a sample of `files` (the included), the delay's row
   above; none with no sample. Its fields' wiring is gc.js's (wireParamTable). */
export function paramTableHtml(P, files, u){
  if (!files.length) return '';
  // Sample 8.4 | m 132 px | Q 13.3 | T 10.65 | p 14.4 | Light-on 23.85 | start 10.25 | end
  // 10.25 | warnings 8.9 (%, of what m leaves: a fixed table layout scales them to it, m kept):
  // at the table's least width, 1000 px (style.css's .gc-param-table min-width), each header's
  // pill beside its name (the name on two lines where it must), m's select whole in its compact
  // type (which cannot wrap; 4 px to spare, and a wider one, another system's, cut with "…" in
  // the room its cell leaves it: style.css, v584), and the date field
  // whole (v582: to v581 m 136 px, its select in the header's type, at 1060 px, Sample 10, Q
  // 12.5, T 10, p 13.5, Light-on 22.5, start and end 10, warnings 11.5; to v580 m 9 % at 1000
  // px, its name a word). At 860 px, the least width to v500, Q's pill already ran over its
  // cell, and the date field by a few px; with p's column, every pill would.
  const cg = `<colgroup><col style="width:8.4%"><col style="width:132px"><col style="width:13.3%"><col style="width:10.65%"><col style="width:14.4%"><col style="width:23.85%"><col style="width:10.25%"><col style="width:10.25%"><col style="width:8.9%"></colgroup>`;
  const shareState = mode => mode==='all' ? 'on'  : 'off';   // shared "All" row cell
  const cellState  = mode => mode==='all' ? 'ro'  : 'on';    // per-sample row cell
  // Column order: Sample | m | Q | T | p | Light-on | [Interval: start end] | warnings.
  // The delay, one for every sample, on a row of its own above the table and on its
  // columns: its name under Sample, its value under m, the Auto switch under Q.
  // p's unit is chosen in its header, where the other columns name theirs: in the
  // header's own type, its box let out of the line's height as the pill's is (-3 px),
  // so that p's name and pill sit level with the others' and the box with the pill.
  /* The m column is the area A where the card normalises by it (NORM, v540): its own
     values, all/one and field (data-f "a"), the masses kept as they were. The choice in
     its header (v581: to v580 "Normalize by" on the delay's row), a select in the header's
     own type as p's unit is, its options the column's names; in a compact type (11 px, v582:
     to v581 the header's 12 px, the table then 1060 px at least). */
  const isA = P.normBy === 'A', nf = isA ? 'a' : 'm', nMode = isA ? P.aMode : P.mMode, nShared = isA ? P.aShared : P.mShared, nOf = isA ? aOf : mOf;
  const normSel = `<select class="gc-norm" aria-label="Normalize the rates by m or A" title="What the rates are divided by, for every sample of this card: the photocatalyst's mass m (µmol g⁻¹ h⁻¹) or, for a film, its area A (µmol cm⁻² h⁻¹), each kept apart; a sample with none (its field empty): not normalised (µmol h⁻¹)" style="width:auto;margin:-3px 0;padding:0 2px;border-radius:5px;font:inherit;font-size:11px;color:inherit">${
    PER.map(v=> `<option value="${v}"${v === P.normBy ? ' selected' : ''}>${NORM[v].col}</option>`).join('')}</select>`;
  const unitSel = `<select class="gc-unit" aria-label="Unit of p" title="The unit p is shown and written in: switching it converts the values, not the pressure (Torr: mmHg)" style="width:auto;margin:-3px 0;padding:0 2px;border-radius:5px;font:inherit;color:inherit">${
    Object.keys(P_UNITS).map(un=> `<option value="${un}"${un === P.pUnit ? ' selected' : ''}>${un}</option>`).join('')}</select>`;
  let html = `<div style="overflow-x:auto"><table class="gc-param-table gc-delay" style="width:100%;table-layout:fixed">${cg}<tbody>
        <tr><td class="fname">Injection delay (s)</td>
          <td>${numCell('gcDelay', 'title="From the logged injection date to the actual injection, in seconds"', injDelay(P), P.delayAuto ? 'off' : 'on', u)}</td>
          <td><label class="pp-check" title="Use the method's delay, ${INJ_DELAY_AUTO} s"><input type="checkbox" class="gcDelayAuto"${P.delayAuto ? ' checked' : ''}> Auto</label></td>
          <td colspan="6"></td></tr></tbody></table>
        <table class="gc-param-table" style="width:100%;table-layout:fixed">${cg}<thead>
        <tr><th rowspan="2">${thHead('Sample', '')}</th>
          <th rowspan="2">${thHead(normSel, modeChip(nf,nMode,u))}</th>
          <th rowspan="2">${thHead('Q (mL/min)', modeChip('q',P.qMode,u))}</th>
          <th rowspan="2" title="T: ${T_TITLE}">${thHead('T (°C)', modeChip('t',P.tMode,u))}</th>
          <th rowspan="2" title="p: ${P_TITLE}">${thHead('p ' + unitSel, modeChip('p',P.pMode,u))}</th>
          <th rowspan="2">${thHead('Light-on date/time', '')}</th>
          <th colspan="2" class="gc-grp"><div class="gc-grp-in">Interval (h)</div></th>
          <th rowspan="2"></th></tr>
        <tr><th>${thHead('start', modeChip('start',P.startMode,u))}</th><th>${thHead('end', modeChip('end',P.endMode,u))}</th></tr></thead><tbody>`;
  // Shared "all" row
  html += `<tr class="gc-all-row"><td class="fname">All</td>
        <td>${numCell('gcShared',`data-f="${nf}"`,nShared,shareState(nMode),u)}</td>
        <td>${numCell('gcShared','data-f="q"',P.qShared,shareState(P.qMode),u)}</td>
        <td>${numCell('gcShared','data-f="t"',P.tShared,shareState(P.tMode),u)}</td>
        <td>${numCell('gcShared','data-f="p"',inUnit(P.pShared, P.pUnit),shareState(P.pMode),u)}</td>
        <td></td>
        <td>${numCell('gcShared','data-f="start"',P.startShared,shareState(P.startMode),u)}</td>
        <td>${numCell('gcShared','data-f="end"',P.endShared,shareState(P.endMode),u)}</td>
        <td></td></tr>`;
  // Per-sample rows
  files.forEach((f,i)=>{
    html += `<tr class="gc-row" data-i="${i}">
          <td class="fname" title="${u.esc(f.label)}">${u.esc(f.label)}</td>
          <td>${numCell('gcCell','data-i="'+i+'" data-f="'+nf+'"',nOf(P, i),cellState(nMode),u)}</td>
          <td>${numCell('gcCell','data-i="'+i+'" data-f="q"',qOf(P, i),cellState(P.qMode),u)}</td>
          <td>${numCell('gcCell','data-i="'+i+'" data-f="t"',tOf(P, i),cellState(P.tMode),u)}</td>
          <td>${numCell('gcCell','data-i="'+i+'" data-f="p"',inUnit(pOf(P, i), P.pUnit),cellState(P.pMode),u)}</td>
          <td class="gc-date-cell" data-i="${i}"></td>
          <td>${numCell('gcCell','data-i="'+i+'" data-f="start"',startOf(P, i),cellState(P.startMode),u)}</td>
          <td>${numCell('gcCell','data-i="'+i+'" data-f="end"',endOf(P, i),cellState(P.endMode),u)}</td>
          <td class="gc-warn-cell">${lightOnWarnHtml(P, files, i)}</td>
        </tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}

/* Where the rates are not normalised (gc-model.js normKey: an included sample with no value of
   the quantity chosen, its field left empty), a compact info under the parameters naming the
   samples (v581); else nothing. */
export function normInfoHtml(P, files, u){
  const l = lacking(P, files);
  return l.length ? boxHtml('info', `No ${P.normBy} for ${l.map(f=> u.esc(f.label)).join(', ')}: the rates are not normalised, in µmol h⁻¹ and µmol.`) : '';
}

// The warning beside a sample's row when its light-on time is before (or at) its first
// injection (gc-model.js lightOnWarn): no injection before light-on, the dark reading.
// (the compact box, alerts.js: v571, its look to v570 a style of its own)
export function lightOnWarnHtml(P, files, i){
  return lightOnWarn(P, files, i) ? boxHtml('warn', 'Light-on at or before the first injection: no point before light-on.') : '';
}

/* One line per sample per gas, the sample's colour throughout and the gas told by the
   dash pattern (gc.js drawGasLines); the legend's entries follow the same rule, with a
   dashed key for a dashed gas. */
export function gasLegendHtml(d, shown, u){
  return shown.filter(g=>d.gas[g.key]).map(g=>{
    const key = g.dash
      ? `<i class="mk-dash" style="color:${u.esc(d.color)}"></i>`
      : `<i style="background:${u.esc(d.color)}"></i>`;
    return `<span>${key}${u.esc(seriesName(d.label, g, shown))}</span>`;
  }).join('');
}

/* The file list's Sample column (REPLICATES, gc-model.js): a select of the file itself and
   the heads, in list order (`all`), on its head's; each option the file's name as its
   value (the link) and its label as its text (to v534 its name), the name in its title;
   dimmed with the row when the file is left out, as its label is. A label renamed is shown
   at once (gc.js sampleNames). */
// (by name: a pair's row is a copy of its record, gc.js pairsOf)
const sampleOpt = (g, h, u)=> `<option value="${u.esc(g.name)}" title="${u.esc(g.name)}"${g.name === h.name ? ' selected' : ''}>${u.esc(g.label)}</option>`;
export function sampleCell(all, f, i, u){
  // Raw chromatograms with no table are no sample: no choice (v544).
  if (!isTable(f)) return '';
  const h = headOf(f, byName(all).by);
  return `<select class="file-sample" data-i="${i}" aria-label="Sample" title="The sample this trace is: its own, or the one another trace heads (its replicates), by its label">${
    all.filter(g=> g.name === f.name || (isHead(g) && isTable(g))).map(g=> sampleOpt(g, h, u)).join('')}</select>`;
}

/* ---- The alerts under the drop zone ----
   What the reading of the files said, read off the files in the list (`all`, every record)
   at each draw (modkit.js notes), not kept from the drop: there again as the project is
   reopened (or its tab brought back), gone with a file removed; a box's × marks its files
   seen (alerts.js markSeen: the record's `seen`, which the undo steps and the project keep;
   to v571 a mark on the file's data in memory, which a reopened project lost). One box a kind
   (utils.js FILE ALERTS, v567; to v566 a box each, under headers of their own): to check, the
   pairs that cannot serve the analysis, the rows left out (dates that do not exist, no gas
   value) and the empty cells skipped; how the files were read, the dates read day/month and
   the alternative export. Each line a note about the record that heads its row. */
/* The empty cells skipped, per file and gas (the blank cells of a row kept), and the rows
   with none of the file's gases, left out at parse (`emptyRows`; to v566 counted as an
   empty cell for each gas). */
function blankLines(f, u){
  const n = blankCounts(f), rows = u.num(f.emptyRows, 0, v=> Number.isInteger(v) && v > 0);
  return [...(n.some(Boolean) ? [u.esc(f.name) + ': ' + GASES.map((g, j)=> n[j] ? `${n[j]} empty ${g.label} cell${n[j] > 1 ? 's' : ''}` : '').filter(Boolean).join(', ')
    + ': each of those injections is left out of that gas only, its rate, production and mean from the injections with a value.'] : []),
  ...(rows ? [`${u.esc(f.name)}: ${rows} row${rows > 1 ? 's' : ''} with no gas value left out.`] : [])];
}
/* The injection dates of a file: read as day/month (how it was read), the rows left out with
   a date that does not exist (to check; gc-model.js readGc). A project's .json may hold
   anything: only true and a whole count go into markup. */
const dayMonthLines = (f, u)=> f.dayMonth === true ? [`${u.esc(f.name)}: dates read as day/month.`] : [];
function badDateLines(f, u){
  const n = u.num(f.badDates, 0, v=> Number.isInteger(v) && v > 0);
  return n ? [`${u.esc(f.name)}: ${n} row${n > 1 ? 's' : ''} left out: ${n > 1 ? 'their' : 'its'} injection date does not exist.`] : [];
}
// A file read as the alternative export (gc-model.js readGc, `altExport`).
const altLines = (f, u)=> f.altExport === true ? [`${u.esc(f.name)}: the alternative export (Inject Time, Amount in ppm).`] : [];
/* A row whose files cannot be what their pair needs (PAIRS, gc-model.js): two tables (the
   first used), two files of raw chromatograms, and raw chromatograms with no table, which
   Analysis leaves out. Its note names the issue by its key (alerts.js markOf): the file paired
   with the row's (`pair:` its name) or none (`alone`), so that a × marks that issue alone and
   a pair made wrong again with another file, or the file left alone, is said (v573: to v572
   the row's file marked for the box, whatever it was paired with later). */
function pairNotes(r, u){
  const [a, b] = rowFiles(r), note = (key, line)=> [{ what: 'check', key, line, files: [r] }];
  if (b && isTable(a) && isTable(b)) return note('pair:' + b.name, `${u.esc(r.label)}: two tables paired (${u.esc(a.name)}, ${u.esc(b.name)}): the first is used, as it is alone; ${u.esc(b.name)} is ignored. Drag a file by its own grip to pair it.`);
  if (b && isTcd(a) && isTcd(b)) return note('pair:' + b.name, `${u.esc(r.label)}: two files of raw chromatograms paired (${u.esc(a.name)}, ${u.esc(b.name)}): shown in Integration, left out of Analysis, with no injection times. Drag a file by its own grip to pair it.`);
  return !b && isTcd(a) ? note('alone', `${u.esc(a.name)}: raw chromatograms with no table: shown in Integration, left out of Analysis, with no injection times.`) : [];
}
/* The notes (alerts.js: { what, key, line, files }), in the boxes' order: to check, the pairs
   of every row, then the tables' rows left out and empty cells; how they were read, the
   tables' dates, then their alternative export (these fixed by the table's bytes: no key). */
export function fileNotes(all, u){
  const tables = all.filter(isTable), by = (what, list, lines)=> list.flatMap(f=> lines(f, u).map(line=> ({ what, line, files: [f] })));
  return [...all.flatMap(r=> pairNotes(r, u)), ...by('check', tables, badDateLines), ...by('check', tables, blankLines),
    ...by('read', tables, dayMonthLines), ...by('read', tables, altLines)];
}

/* Where a card's values came from, said at its top (v544): the samples re-integrated, and
   how each gas is made a concentration (the standards, or the GC software's scale, an info
   alert); the samples paired with raw chromatograms that keep their table, and why (a
   warning); those whose integration failed, with the job's message, a compact error first
   (v584, ALERTS-REVIEW.md R1–R4: to v583 "not done yet" in the warning, the failure untold).
   Nothing while no sample is paired or no Integration card is above (`name`, that card's). */
export function srcAlertsHtml(dataTables, name, u){
  const used = [], kept = [], failed = [], txt = Object.fromEntries(GASES.map(g=> [g.key, gasTxt(g)]));
  const k5 = v => Number.isFinite(v) ? String(+v.toPrecision(5)) : '?';
  const how = (s, g)=> s.how[g] === 'cal' ? 'calibrated by the standards' : `by the GC software's scale (k = ${k5(s.k[g] && s.k[g].k)})`;
  dataTables.forEach(d=>{
    const s = d.src;
    if (!s) return;
    if (s.failed){ failed.push(`${u.esc(d.label)}: ${u.esc(failedWhy(s.failed))}.`); return; }
    if (!s.gas){ kept.push(`${u.esc(d.label)}: ${u.esc(s.why)}${s.integ ? ': see the Integration card' : ''}`); return; }
    const re = Object.keys(s.how).filter(g=> s.how[g] !== 'table'), tb = Object.keys(s.how).filter(g=> s.how[g] === 'table');
    if (re.length) used.push(`${u.esc(d.label)}: ${re.map(g=> `${txt[g] || u.esc(g)} ${u.esc(how(s, g))}`).join('; ')}`);
    tb.forEach(g=> kept.push(`${u.esc(d.label)}, ${txt[g] || u.esc(g)}: ${u.esc(s.why[g] || 'the table')}`));
  });
  // (where the GC software's scale is taken: its risks, which the Integration card's
  // instructions give, said once; to v566 an info box of that card's, its header alone)
  if (dataTables.some(d=> d.src && d.src.gas && Object.values(d.src.how).includes('transfer'))) used.push(`The GC software's scale (k): its risks are in the instructions of ${u.esc(name)}.`);
  const head = `The GC software's table used instead of the re-integration (${u.esc(name)}):`;
  return (failed.length ? boxHtml('bad', [head, ...failed]) : '')
    + (used.length ? u.alertHtml('info', `H₂ and O₂ re-integrated from the raw chromatograms (${u.esc(name)}), the times from the tables:`, used) : '')
    + (kept.length ? u.alertHtml('warn', head, kept) : '');
}
