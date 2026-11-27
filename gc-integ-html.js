/* =========================================================
   GC — the Integration cards' words and markup that need no page (gc-integ.js puts them in
   the cards, the calibration's window and their alerts; tests/integmodel.test.mjs reads
   them in Node): the card's instructions (with "From the area to the concentration") and
   the calibration window's, a card's body and the window's, the Windows' fields, the Peaks
   of the chromatogram on show, the status line, the alerts, the notices over a chromatogram,
   the legends, the run overview's chips, the window's files, its standards'
   rows and thumbnails, a standard's fit, a gas's line and its levels. Taken out of v559's
   gc-integ.js as they were: the same markup to the byte.
   What they need from the page is handed in, u = { esc, fileAlertHtml, X_SVG, snavHtml,
   plotWrap, chipRow, PLOT_DL_ICON } (utils.js's esc, file alerts and close icon, snav.js's
   selector, modcharts.js's plot box, chips and download icon: gc-integ.js HU; the compact
   boxes are alerts.js's, v571), the gases'
   words (gasOf) where they say a gas, and the cards' own instructions (cards.js cardInfo)
   where they end with them.
========================================================= */
import { UNITS, CHI2_HIGH, sig, plural, fin, fitMarks, fullName, thumbPoints, levelsOf, windowName, peakName } from './gc-integ-model.js';
import { boxHtml } from './alerts.js';

/* ---- The instructions ---- */
/* "From the area to the concentration", a box of its own in the card's instructions, as the
   Production Rate card's "From the reading to the rates" (gc-html.js RATES_HTML): the
   standards' line, a concentration from it, and the GC software's scale taken over, typeset
   in MathML. */
const CONC_HTML = (()=>{
  const mi = s => `<mi>${s}</mi>`, mo = s => `<mo>${s}</mo>`, up = s => `<mi mathvariant="normal">${s}</mi>`;
  const mrow = (...xs)=> `<mrow>${xs.join('')}</mrow>`, mfrac = (a, b)=> `<mfrac>${a}${b}</mfrac>`, msub = (a, b)=> `<msub>${a}${b}</msub>`;
  const display = (...xs)=> `<math display="block">${xs.join('')}</math>`, im = (...xs)=> `<math>${xs.join('')}</math>`;
  const A = mi('A'), c = mi('c'), s = mi('s'), b = mi('b'), k = mi('k'), i = mi('i'), eq = mo('='), Ai = msub(A, i), ci = msub(c, msub(mi('T'), i));
  const step = (title, what, eqs, ...lines)=> `<li><b>${title}.</b> ${what}<div class="instr-eqbox">${eqs.join('')}</div>${lines.map(l=> `<div class="instr-units">${l}</div>`).join('')}</li>`;
  return '<div class="instr-math"><h4 class="instr-math-head">From the area to the concentration</h4><ol class="instr-steps">'
    + step('The standards\' line', 'Fitted by least squares to the standards of the gas (free intercept), or through zero.', [display(A, eq, s, mo('⋅'), c, mo('+'), b)],
      `${im(A)}: the fitted area; ${im(c)}: the standard's concentration, in the unit chosen (%mol or ppm); ${im(s)}: the slope, area per unit; ${im(b)}: the intercept (0 through zero).`)
    + step('A concentration from it', 'Each injection\'s area turned back into a concentration; in ppm, divided by 10⁴ for the rates, which take %mol.', [display(c, eq, mfrac(mrow(A, mo('−'), b), s))])
    + step('Without standards: the GC software\'s scale', `For each pair, over its injections ${im(i)} whose table value ${im(ci)} is at least 0.02 %mol for H₂, 0.012 %mol for O₂ (ten of them at least), the median of the area over the table's value; then each concentration.`,
      [display(k, eq, up('median'), mrow(mo('('), mfrac(Ai, ci), mo(')'))), display(c, eq, mfrac(A, k))],
      `${im(k)}: area per %mol; ${im(c)}: %mol. A line through zero, whatever the software's own calibration was.`)
    + '</ol></div>';
})();
// The card's instructions, ending with the cards' own (`tail`: cards.js cardInfo).
export const integInfo = tail => `The <b>Integration</b> card integrates again the raw chromatograms of the thermal-conductivity detector (TCD), the files of a column per injection that the GC software writes beside its table, and hands the results to the <b>Production Rate</b> cards below it. Each injection's <b>H₂ and O₂</b> are fitted together in one <b>window</b> of retention time (268–326 s by default): a smooth baseline (a straight line, with the <b>step</b> the detector makes after O₂), a peak shape for H₂, for O₂ and for the system peak at 310 s (<b>S310</b>, fitted so that its tail does not end up in O₂'s area; the step and S310 are drawn but go no further). The fit is made in <b>two passes</b>: the first, with a robust loss, finds <b>spikes</b> and <b>glitch zones</b> (marked on the plot in red), which the second, an ordinary least-squares fit, leaves out, so that a spike is never read as gas; a fit that looks wrong is started again from a generic start, and the better of the two kept. <b>The selectors</b>: the file (a pair, or raw chromatograms alone) at the top left of the plot, the chromatogram at the top left of the run overview; the arrows step through them (← → the chromatograms), and the name, or the small arrow after it, opens the list of them all, to go straight to one. <b>The plot</b>: the chromatogram on top (raw, model, baseline with its step, H₂, O₂ and S310 each drawn on the baseline, the spikes and glitch zones left out in red, the neighbouring peaks the model has no shape for in grey) and its <b>residuals</b> under it (the data less the model, inside the fit window only; blank outside it). The two share the retention time: a zoom or a pan in either (the one under the pointer) moves both along it at once, each keeping its own vertical scale. The plot holds the whole chromatogram and opens on the H₂/O₂ window, where a double click with a tool on brings it back. Its one toolbar, at its top right, gives both: the images, the CSV (the chromatogram on show, its model and parts and its residuals), and the figure composer, where they are two panels, one of which can be removed. <b>Windows</b>: the method is the card's, in these numbers, which are its source of truth: the fit window's edges (the green lines on the chromatogram drag them as an aid, snapping to the data's 0.2 s, and write into the numbers), with the peaks' nominal places. Moving an edge by 1–2 s changes the areas by a few hundredths of a per cent; by 5 s it reaches the peaks the model has no shape for, the system peak at 262–267.5 s and N₂ from about 330.5 s (grey on the chromatogram), and the fit degrades: the card says so. <b>Peaks</b>: the chromatogram on show, per gas: the area of its fitted shape ± its standard deviation, its apex, χ²<sub>r</sub> (how well the model follows the data: about 1, within the noise), its concentration and the GC table's value; under the table, the units, where a concentration is taken from the GC software's table its k for the file on show, and why the chromatogram is suspicious, if it is. <b>Suspicious</b>: a chromatogram is, for a gas, where χ²<sub>r</sub> is above 4 after the fit's restart (some fits are fragile: the robust pass stops at its 100th evaluation), where the fit did not converge, or where its area is out of proportion with the GC software's table: over the run (the pair), k is the median of area / table value across its injections with a table value, and an injection is suspicious when its area is further from k × its table value than 10 % of that, and than k × 15 ppm (0.0015 %mol, in the table's unit). Areas are compared, not concentrations (with O₂'s free intercept every calibrated value would differ from the table by one factor): a scale that differs from the table's alike at every injection marks none, an injection off on its own does. A glitch zone left out of the fit does not make it suspicious. <b>The colours</b>: in the chromatogram selector and its list, a suspicious chromatogram's name is red (suspicious for either gas); on the run overview a fit is a blue dot, whatever the gas, red where its injection is suspicious for that gas; the GC table's values are small grey crosses, never red, hidden under the fit's dot where the two agree; in Peaks a χ²<sub>r</sub> above 4 and an area out of proportion are red. The <b>run overview</b> shows, for the file chosen, one gas at a time (H₂ or O₂), as area or as concentration: every injection's fit, and the GC table's value beside it (as area, the table's value times the run's k, on the fits' scale), against the injection time (the injection's number when there is no table). A point under the pointer is drawn in a lighter shade and half again as large, and says its injection, its time, the fit, the table's value and χ²<sub>r</sub>; a click shows its chromatogram, whose point stays so, as does one chosen by the arrows, the list or the keys. Integration runs by itself in the background, on workers, when raw chromatograms are first loaded (with the default windows), and for a file or a standard added since (with the windows the results come from). A window's edge changed is not integrated at once: until <b>Integrate</b> (under Peaks, and in the Calibration window) is pressed, the results, the plots, the tables, the calibration and the CSVs stay those of the windows they come from, which a grey line over the button names. Integrate integrates every file and standard with the windows as edited, the chromatogram on show first, its progress and the file it is on over the button, which turns into <b>Stop</b> (everything then stays as it was); once every one is done all of it changes at once, one step of the history (an undo brings back the results before, nothing fitted again). Each row of the CSVs ends with the windows its results come from. <b>Pairs</b>: a table and its raw chromatograms (the same name with _TCD) share a row of the file list; the table's rows with a date are its injections, which must be as many as the chromatograms (else the card says so, and Analysis keeps the table). <b>Concentrations</b>: <b>Calibration…</b> opens the standards' window: drop the GC software's table of the standards together with its raw chromatograms (both are needed, paired by name as in the file list, as many injections as chromatograms; the table names each standard, by its Analysis column, and gives nothing else), see each standard's fit drawn as this card draws a chromatogram (the selector over it, the arrows, ← →, or a click on its row), type each standard's H₂ and O₂ (blank: not a standard of that gas), choose the unit and, per gas, a free intercept (the default: O₂'s response has a real intercept, about −500 ppm, and a line forced through zero biases its low levels by −8 to −26 % while R² barely moves; each level's deviation from the line is shown, since R² cannot tell) or a zero one; the line area = slope × c + intercept is fitted to them and a sample's concentration is (area − intercept) / slope. Standards always win. Without them, the card <b>takes the calibration from the GC software's table</b>: for each pair, k is the median of our area over the table's value across the injections well above the noise (a table value of at least 0.02 %mol for H₂, 0.012 %mol for O₂, ten injections at least), and the concentration is area / k (an info alert says so, and Peaks gives the k of the file on show). <b>The risks of a calibration taken from the GC software</b>, which standards avoid:<ul class="gci-risks"><li>it <b>borrows the software's scale</b>, and assumes that the software's areas are proportional to ours, which a different baseline or peak split breaks (for O₂, on H₂'s tail and before the step, they may well differ);</li><li>the transferred line <b>goes through zero</b>, even if the software's own calibration had an intercept (O₂'s response has one, about −500 ppm: the low levels then come out biased);</li><li>it needs <b>enough injections above the threshold</b> (ten at 0.02 %mol of H₂, 0.012 %mol of O₂): with fewer there is none, and Analysis keeps the table;</li><li>if the <b>software's calibration is wrong, so is this one</b>: it reproduces the table's scale, it does not check it.</li></ul>A Production Rate card takes its values from the nearest Integration card above it; one with none above keeps the tables. ${CONC_HTML}${tail}`;
export const CAL_INFO = `The standards come as a pair, as in the file list: the GC software's table of their injections (its default CSV or its .txt export) and its raw chromatograms (TCD), the same name with _TCD (a browser's " (1)" aside). Drop the two together: either one alone is not loaded (it waits in this window, said in red, until its partner is dropped), nor is a pair whose table has not as many injections as there are chromatograms (one name a chromatogram). The table gives each standard its <b>name</b> and nothing else: its Analysis column (the .txt export's sample column if it has one, else the injection's number); no value or concentration is read from the table or from any name, cal_… included. Each chromatogram is integrated with the windows the card's results come from; windows edited on the card are integrated, the card's files and these standards together, by <b>Integrate</b> on the card or under the standards' table here, the same run (its progress and Stop in both places), applied to both at once when it ends. <b>The plot</b> shows the standard chosen as the card shows a chromatogram, over its residuals (the raw data, the model, the baseline with its step, H₂, O₂ and S310, the spikes and glitch zones left out, the fit window's edges), with the same toolbar; choose it with the selector over the plot (its name opens the list of them all), its arrows or ← →, or a click on its row. <b>Standards</b>: type in each row the standard's H₂ and O₂ concentrations in the unit chosen (blank: not a standard of that gas), and untick a row to leave it out; a name too long for its column is whole in its tooltip. Per gas, the line area = slope × c + intercept is fitted by least squares to the standards (free intercept), or through zero; R², and each level's deviation from the line, say how well it holds. The calibration is this card's, saved with the project and its files, and applies to every pair of the card; a gas with two standards or more (one, through zero) is calibrated, the other taken from the GC software's table. Standards saved without their table (raw chromatograms alone, by an older version) are not opened: drop them again with it.`;

/* ---- A card's body ----
   The alerts; then, as a DRS card is laid out, the plot's column at the
   left, as wide as a Tauc card's plot: the file's selector over the plot at its left
   and the plot's toolbar at its right, as a Tauc plot's, the chromatogram over its
   residuals (together a Tauc plot's size), their legend; then the run overview (as
   wide, half as tall) under the chromatogram's selector, its own toolbar at the right of
   that line. At the right, as a Tauc card's parameters: Windows (its title's letters'
   top on the plot frame's, .cap-title, CLAUDE.md), the Peaks of the chromatogram on show,
   Integrate under its words and progress (runHtml; v578: to v577 a status line over the
   card, its progress, Re-integrate and Stop) and Calibration…. p: the card's ids' prefix. */
export const cardHtml = (u, p)=> `
      <div class="gci-alerts" id="${p}Alerts"></div>
      <div class="gci-notice" id="${p}Notice"></div>
      <div class="row gci-row">
        <div class="col mw520 gci-main">
          <div class="plot-nav-row gci-nav">
            <div class="plot-nav-left">${u.snavHtml({ idx: p + 'FileIdx', name: p + 'File', prevCls: 'gci-fprev', nextCls: 'gci-fnext', what: 'file', keys: false, cls: 'gci-fsel' })}</div>
          </div>
          <div class="plot-wrap gci-pair">
            <svg class="plot gci-chrom" id="${p}Chrom"></svg>
            <svg class="plot gci-resid" id="${p}Resid"></svg>
            <button class="btn plot-dl-btn" data-dl-svg="${p}Chrom" data-dl-also="${p}Resid" data-csv-mod="gc" data-csv-names="chromatogram.csv" data-dl-name="GC_chromatogram.svg" data-dl-legend="${p}ChromLegend">${u.PLOT_DL_ICON}</button>
          </div>
          <div id="${p}ChromLegend" class="legend gci-legend"></div>
          <div class="plot-nav-row gci-ov-nav">
            <div class="plot-nav-left">${u.snavHtml({ idx: p + 'InjIdx', name: p + 'Inj', prevCls: 'gci-kprev', nextCls: 'gci-knext', what: 'chromatogram', cls: 'gci-ksel' })}</div>
          </div>${u.plotWrap(p + 'Over', { mod: 'gc', name: 'GC_run_overview.svg', legend: p + 'OverLegend', csv: 'integration.csv', cls: 'gci-over',
            extra: `\n              <span class="plot-chips gci-ov-sel"><span class="gci-ov-gas"></span><span class="gci-ov-y"></span></span>` })}
          <div id="${p}OverLegend" class="legend gci-legend"></div>
        </div>
        <div class="col mw280 gci-side">
          <div class="txt-mini param-head aligned cap-title gci-head gci-win-head"><span>Windows</span><button type="button" class="btn btn-sm gci-reset" title="The engine's default windows" hidden>Default</button></div>
          <div class="peak-box gci-win-box"><div class="gci-method" id="${p}Method"></div></div>
          <div class="txt-mini param-head gci-head gci-values-head"><span>Peaks</span></div>
          <div class="peak-box gci-values-box"><div class="peak-scroll" id="${p}Values"></div></div>
          ${runHtml(p, 'gci-status')}
          <button type="button" class="btn plot-action-btn gci-cal" id="${p}Cal" title="The standards: their raw chromatograms and concentrations">Calibration…</button>
        </div>
      </div>`;

/* Integrate, the Rietveld card's Refine's component (xrd-rv-html.js: its words, .rv-status;
   its progress, .rv-prog; its button, .rv-btns, Stop while the run goes on), the card's and its
   calibration window's (v578), one run: `p` their ids' prefix, `cls` the words' class. */
const runHtml = (p, cls)=> `<div id="${p}Status" class="txt-meta rv-status ${cls}" role="status"></div>
          <div id="${p}ProgWrap" class="rv-prog" style="display:none"><div id="${p}ProgBar"></div></div>
          <div class="rv-btns"><button type="button" class="btn gci-integ" id="${p}Integrate">Integrate</button></div>`;

/* ---- Windows: the fit windows' edges, with the peaks' nominal places ---- */
/* A window's and its peaks' names as shown (v578: to v577 their keys, "H2O2", "H2"): a peak of
   a gas by the gas's words (gasOf(g).txt, its subscript: H₂), another as it is (S310); a window
   by its gases', a hyphen between ("H₂-O₂"), else its key (gc-integ-model.js windowName and
   peakName, v582 and v584: the chromatogram's lines and the CSVs name the window so too, its
   legend and its peaks' places the peaks). The keys themselves, the state's, stay as they are. */
/* (m: the method shown; warn: its windows' intrusions (gc-integ-model.js intrusions), a
   compact warning under them (v571: to v570 an amber line); refused: a window's edges not
   taken, { wi, text }, its rule in red under that window (v571, ALERTS-REVIEW.md C19, G11: to
   v570 a warning box "Not taken:" over the chromatogram)) */
export function methodHtml(u, gasOf, m, warn, refused = null){
  const field = (k, v, label)=> `<input type="text" inputmode="decimal" data-k="${k}" value="${u.esc(String(v))}" aria-label="${u.esc(label)}">`;
  return m.windows.map((w, wi)=>{
    const n = windowName(gasOf, w);
    return `<div class="gci-win"><span class="gci-win-name">${u.esc(n)} fit</span>`
      + `<label>from ${field(`w${wi}:from`, w.from, `${n} window from (s)`)}</label>`
      + `<label>to ${field(`w${wi}:to`, w.to, `${n} window to (s)`)} s</label>`
      + `<span class="gci-win-peaks">${(w.peaks || []).map(pk=> `${u.esc(peakName(gasOf, pk))} ${fin(pk.t) ? pk.t.toFixed(1) : ''}`).join(' · ')}</span></div>`
      + (refused && refused.wi === wi ? `<p class="field-rule gci-win-rule" role="alert">${u.esc(refused.text)}</p>` : '');
  }).join('') + boxHtml('warn', warn.length ? warn.map(x=> u.esc(intrusionText(gasOf, x))).join(' ') : '', 'gci-flag');
}
// A window's edge inside a neighbour's peak (an intrusion, { w, z }), and why a window's edges
// are not taken (setMethod: methodHtml's refused), the window named as Windows names it (v581:
// to v580 by its key, "H2O2").
export const intrusionText = (gasOf, { w, z })=> `The ${windowName(gasOf, w)} window (${w.from}–${w.to} s) reaches ${z.name} (${z.from}–${z.to} s), which its model has no peak for: the fit degrades there.`;
export const tooShortText = (gasOf, w)=> `The ${windowName(gasOf, w)} window must start at least 5 s before it ends.`;

/* ---- Peaks: the values of the chromatogram on show (gc-integ-model.js peaksOf's v) ---- */
export function valuesHtml(u, gasOf, v){
  if (!v) return '';
  if (v.wait) return `<p class="txt-meta">Not integrated yet.</p>`;
  // (a compact warning, v571: to v570 an amber line, ALERTS-REVIEW.md G08)
  if (v.error != null) return boxHtml('warn', `Not integrated: ${u.esc(v.error)}`, 'gci-flag');
  const { conv, units, tUnit, gs, unitOf } = v;
  const rows = v.rows.map(({ g, x, shown, tShown, off })=> `<tr><td>${gasOf(g).label}</td><td class="${off ? 'gci-bad' : ''}"${off ? ' title="Out of proportion with the GC table"' : ''}>${sig(x.area, 5)} ± ${sig(x.sd, 2)}</td>`
    + `<td>${fin(x.tApex) ? x.tApex.toFixed(2) : '—'}</td><td class="${fin(x.chi2r) && x.chi2r > CHI2_HIGH ? 'gci-bad' : ''}">${fin(x.chi2r) ? x.chi2r.toFixed(2) : '—'}</td>`
    + `<td>${fin(shown) ? shown.toPrecision(4) + (units.length > 1 ? ' ' + u.esc(unitOf(g)) : '') : '—'}</td>`
    + `<td>${fin(tShown) ? tShown.toPrecision(4) : '—'}</td></tr>`);
  /* Under the table (the narrow column keeping its headers short): the columns' units,
     and, where a gas's concentration is taken from the GC software's table (no
     standards), its k for the file on show (the card's info alert does not list them). */
  const cU = units.length === 1 ? units[0] : null;
  const said = cU && v.aligned && cU === tUnit ? [`Conc. and GC table in ${u.esc(cU)}`] : [cU ? `Conc. in ${u.esc(cU)}` : '', v.aligned ? `GC table in ${tUnit}` : ''].filter(Boolean);
  const tr = gs.filter(g=> conv[g] && conv[g].how === 'transfer');
  const from = tr.length ? `${tr.length > 1 ? 'Concentrations' : 'Concentration'} from the GC software's scale (k): k = ${tr.map((g, i)=> `${sig(conv[g].k, 5)}${i ? '' : ' area per %mol'} (${gasOf(g).label}, median of ${conv[g].n} injections)`).join(', ')}.` : '';
  return `<table class="gci-values"><thead><tr><th>Gas</th><th>Area ± sd</th><th>Apex (s)</th><th>χ²<sub>r</sub></th><th>Conc.</th><th>GC table</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
    + (said.length ? `<p class="txt-meta gci-units">${said.join('; ')}.</p>` : '')
    + (from ? `<p class="txt-meta gci-from">${from}</p>` : '')
    + suspiciousHtml(u, v.fl)
    + (v.keys.some(g=> !conv[g] || !conv[g].f) ? `<p class="txt-meta">${v.keys.filter(g=> !conv[g] || !conv[g].f).map(g=> `${gasOf(g).txt}: ${u.esc(conv[g] ? conv[g].why : 'no concentration')}`).join('; ')}.</p>` : '');
}
// Why a chromatogram is suspicious (gc-integ-model.js fitMarks), a compact warning: the card's
// Peaks and the calibration window's standard alike (v571, G08 and G09: to v570 an amber line
// here, a red "⚠" there).
const suspiciousHtml = (u, fl)=> boxHtml('warn', fl.length ? `Suspicious: ${fl.map(u.esc).join('; ')}` : '', 'gci-flag');

/* ---- The status line and the card's alerts ---- */
/* A run that failed (gc-integ.js S.failed, the pool's or the worker's message): in the card's
   status and in the calibration window's, a compact error (v571, ALERTS-REVIEW.md C17, X07:
   to v570 red text in the card, "Stopped…" in the window); a message that says it already, as
   it is. failedWhy, in a line after a name (the Production Rate cards', gc-html.js
   srcAlertsHtml, v584), with no capital and no full stop. */
export function failedWhy(why){
  const m = String(why == null ? '' : why).trim().replace(/[.\s]+$/, '');
  if (!m || /^the integration failed$/i.test(m)) return 'the integration failed';
  return /^the integration (worker )?failed\b/i.test(m) ? m.charAt(0).toLowerCase() + m.slice(1) : `the integration failed: ${m}`;
}
export const failedText = why =>{ const t = failedWhy(why); return t.charAt(0).toUpperCase() + t.slice(1) + '.'; };
// The windows a method's results come from, as Windows names them: "H₂-O₂ fit 268–326 s".
export const windowsText = (gasOf, m)=> m.windows.map(w=> `${windowName(gasOf, w)} fit ${w.from}–${w.to} s`).join(', ');
/* The words over Integrate (x: gc-integ-model.js progressOf's; '' where all is integrated:
   the line folds away), grey but a failure, the facts alone (ALERTS-REVIEW.md R1–R4): what it
   integrates, a run stopped, and, the windows edited, the ones the results come from (v578:
   to v577 "Method changed: …" over the chromatogram, the previous method's results meanwhile).
   `of`: the calibration window's (' of the standards', its counts in x.left). */
export function statusHtml(u, gasOf, x, of = ''){
  const { st, left } = x, was = x.pending ? `the results shown come from ${u.esc(windowsText(gasOf, x.m))}, not from these windows` : '';
  switch (x.state){
    case 'running': return `<span>Integrating… ${st.job.done} / ${st.job.total} chromatograms · ${u.esc(st.job.name)}</span>`;
    case 'failed': return boxHtml('bad', u.esc(failedText(st.failed)));
    case 'stopped': return `<span>Stopped: ${[left ? `${plural(left, 'chromatogram')}${of} not integrated` : '', was].filter(Boolean).join('; ')}.</span>`;
    case 'pending': return `<span>${was.charAt(0).toUpperCase() + was.slice(1)}.</span>`;
    case 'left': return `<span>${plural(left, 'chromatogram')}${of} to integrate.</span>`;
    case 'done': return '';
    default: return `<span class="txt-meta">No raw chromatograms (TCD) loaded: drop them beside their tables.</span>`;
  }
}
// Integrate's tooltip (x: progressOf's).
export const integrateTitle = x => x.state === 'running' ? 'Stop the integration: what is shown stays as it is'
  : x.pending ? 'Integrate every file and standard with the windows as edited: all of it changes at once when they are done'
  : x.left ? 'Integrate the chromatograms not integrated yet' : 'Every chromatogram is integrated with these windows';
/* The calibration window's (v578, its Integrate the card's): the card's run, failure and
   windows, its standards' counts (`left` not integrated, `rows` in all: "n chromatograms
   integrated." when all are; to v577 a line of its own beside the unit). */
export function calStatusHtml(u, gasOf, x, left, rows){
  const state = ['running', 'failed', 'pending'].includes(x.state) ? x.state : x.state === 'stopped' && (left || x.pending) ? 'stopped' : left ? 'left' : 'done';
  return state === 'done' ? `<span>${plural(rows, 'chromatogram')} integrated.</span>` : statusHtml(u, gasOf, { ...x, state, left }, ' of the standards');
}
// A line of the alerts' "to check" (gc-integ-model.js alertFacts's warn).
function warnLine(u, gasOf, w){
  const e = w.e;
  if (w.kind === 'rows') return `${u.esc(e.label)}: ${plural(e.rows, 'injection')} in the table, ${plural(e.n, 'chromatogram')}: not aligned: integrated all the same; Analysis uses the table alone.`;
  return `${u.esc(e.label)}: ${w.out} of ${w.n} injections' ${gasOf(w.g).label} outside the standards' range (${sig(w.lo, 3)}–${sig(w.hi, 3)} %mol): extrapolated${w.below ? `, below the lowest standard, where the intercept (${sig(w.L.intercept, 4)}) weighs most` : ''}.`;
}
/* (f: gc-integ-model.js alertFacts's) Raw chromatograms with no table, or paired with raw
   chromatograms, are said under the drop zone, to check (gc-html.js pairNotes), and in the
   file list's tooltip: here a grey line names them (v567: to v566 a third time, in this
   box). The calibration by the GC software's scale (k) is said in each Production Rate
   card below, with where its risks are written (to v566 an info box of its header alone).
   Compact boxes with no ×: worked out again with the files (v571, ALERTS-REVIEW.md G07: to
   v570 a × took one away until the next drawing). */
export function alertsHtml(u, gasOf, f){
  const errs = f.errs.map(e=> `${u.esc(e.tcd.name)}: ${u.esc(e.d.error)}`), warn = f.warn.filter(w=> w.kind !== 'twin' && w.kind !== 'alone').map(w=> warnLine(u, gasOf, w));
  const shown = f.warn.filter(w=> w.kind === 'twin' || w.kind === 'alone').map(w=> `<p class="txt-meta gci-shown">${u.esc(w.e.label)}: shown here, no injection times.</p>`);
  return (errs.length ? boxHtml('bad', ['Raw chromatograms that could not be read:', ...errs]) : '')
    + (warn.length ? boxHtml('warn', ['Raw chromatograms to check:', ...warn]) : '')
    + shown.join('');
}

/* ---- The chromatogram over its residuals ---- */
/* The notice over a pair of panels (gc-integ.js drawPair): the file that cannot be read
   (`file`), no point in the windows (`what`), not integrated yet; else ''. D:
   gc-integ-model.js chromOf's. A compact box, no × (v571, G07: to v570 a × that held until
   the next drawing). (To v577 also the previous method's, its windows changed: no more.) */
export function pairNotice(u, o, D){
  if (D.fail === 'read') return o.d ? boxHtml('bad', `${u.esc(o.file)}: ${u.esc(o.d.error)}`) : '';
  if (D.fail === 'empty') return boxHtml('warn', `${u.esc(o.what)}: no point in the windows.`);
  if (!D.r) return boxHtml('info', `${u.esc(o.what)}: not integrated yet: the model is drawn once it is.`);
  return '';
}
// Its legend (gc-integ-model.js legendItems's [colour, name, mark]).
export const chromLegendHtml = (u, items)=> items.map(([c, n, kk])=> `<span>${kk ? `<i class="${kk}" style="color:${c}"></i>` : `<i style="background:${c}"></i>`}${u.esc(n)}</span>`).join('')
  + '<span><i class="mk-box gci-mk-nb"></i>peaks the model leaves out</span>';

/* ---- The run overview: its chips and its legend ---- */
// (one gas at a time: a chip chooses it, the other's off)
export const ovGasHtml = (gasOf, keys, g)=> keys.map(k=> `<button type="button" class="mode-chip plot-chip gci-ov-chip${k === g ? ' is-on' : ''}" data-g="${k}" aria-pressed="${k === g}" title="Show ${gasOf(k).txt} (one gas at a time)">${gasOf(k).label}</button>`).join('');
// (area, or the concentration where the gas has one)
export const ovYHtml = (u, O)=> u.chipRow([{ key: 'area', label: 'Area' }, { key: 'conc', label: 'Conc.' }], [O.mode], { cls: 'plot-chip gci-ovy-chip', data: o=> `data-y="${o.key}"`, name: o=> o.label,
  can: o=> o.key === 'area' || !!(O.c && O.c.f), why: ()=> `No calibration of ${O.G.txt} and no table to take a scale from` });
export const overLegendHtml = (O, cFit, cBad)=> `<span><i class="gci-mk gci-mk-dot" style="color:${cFit}"></i>${O.G.txt} fit</span>`
  + (O.bad.some(Boolean) ? `<span><i class="gci-mk gci-mk-dot" style="color:${cBad}"></i>suspicious</span>` : '')
  + (O.table ? `<span><i class="gci-mk gci-mk-x"></i>GC table${O.mode === 'area' ? ' × k' : ''}</span>` : '');

/* ---- The calibration's window ----
   The standards' table and raw chromatograms dropped together, the standard chosen drawn as
   the card's chromatogram over its residuals at the left of the standards' table (CLAUDE.md's
   tops aligned), the card's Integrate under the table (v578), the unit, each gas's line under
   them; with no standards, the drop zone alone (and what a drop said: v578, to v577 an empty
   table, its line, each gas's empty plot). p: the card's ids' prefix. */
export const calHtml = (u, p)=> `
      <div class="xrd-std-box gci-cal-box" role="dialog" aria-modal="true" aria-labelledby="${p}CalTitle" tabindex="-1">
        <div class="xrd-std-head">
          <h3 class="txt-head" id="${p}CalTitle">Calibration<button type="button" class="instr-info" aria-label="Toggle instructions" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none"/></svg></button></h3>
          <button type="button" class="an-ic xrd-std-x" title="Close" aria-label="Close">${u.X_SVG(15)}</button>
        </div>
        <div class="xrd-std-scroll">
          <div class="instr-block xrd-std-instr" style="display:none">${CAL_INFO}</div>
          <div class="dropzone xrd-std-dz gci-cal-dz">
            <div class="dz-icon">⤒</div>
            <div class="dz-title">Drag here the standards' GC table and its raw chromatograms (TCD) together, or click to select them.</div>
            <div class="txt-meta">the table (.csv, or the .txt export) and its _TCD .csv · both needed</div>
            <input type="file" class="gci-cal-in" multiple accept=".csv,.txt,.CSV,.TXT" style="display:none">
          </div>
          <div class="xrd-std-alerts gci-cal-alerts"></div>
          <div class="gci-cal-files"></div>
          <div class="gci-cal-unit"><label class="txt-label">Concentration unit <select class="gci-cal-unit-in" aria-label="Concentration unit">${UNITS.map(un=> `<option value="${un}">${un}</option>`).join('')}</select></label></div>
          <div class="pside gci-cal-pside">
            <div class="plot-nav-row pside-nav gci-cal-nav"><div class="plot-nav-left">${u.snavHtml({ idx: p + 'CalIdx', name: p + 'CalName', prevCls: 'gci-cprev', nextCls: 'gci-cnext', what: 'standard', cls: 'gci-csel' })}</div></div>
            <div class="pside-plot">
              <div class="plot-wrap gci-pair gci-cal-pair">
                <svg class="plot gci-chrom" id="${p}CalChrom"></svg>
                <svg class="plot gci-resid" id="${p}CalResid"></svg>
                <button class="btn plot-dl-btn" data-dl-svg="${p}CalChrom" data-dl-also="${p}CalResid" data-csv-mod="gc" data-csv-names="standard_chromatogram.csv" data-dl-name="GC_standard_chromatogram.svg" data-dl-legend="${p}CalLegend">${u.PLOT_DL_ICON}</button>
              </div>
            </div>
            <div class="pside-under"><div id="${p}CalLegend" class="legend gci-legend gci-cal-legend"></div><div class="txt-meta gci-cal-fit"></div><div class="gci-notice gci-cal-notice"></div></div>
            <div class="pside-col gci-cal-side">
              <div class="txt-mini param-head cap-title gci-cal-head"><span>Standards</span></div>
              <div class="peak-box gci-cal-table"><table class="gci-cal-levels"><thead><tr><th class="gci-cal-k">#</th><th class="gci-cal-th"></th><th class="gci-cal-src">Injection</th><th class="gci-cal-a">H<sub>2</sub> area</th><th class="gci-cal-a">O<sub>2</sub> area</th><th>H<sub>2</sub> <span class="gci-u"></span></th><th>O<sub>2</sub> <span class="gci-u"></span></th><th title="Use this standard">Use</th></tr></thead><tbody></tbody></table></div>
              ${runHtml(p + 'Cal', 'gci-cal-status')}
            </div>
          </div>
          <div class="row gci-cal-fits"></div>
        </div>
      </div>`;
// What a drop did not load, and why; what it held loaded already (utils.js FILE ALERTS).
export const dropAlertHtml = (u, bad, dup = [])=> u.fileAlertHtml('bad', bad.map(u.esc)) + u.fileAlertHtml('dup', dup.map(u.esc));
// The standards' files, each removable; a menu of that × (v585: utils.js STD_ROWS).
export const calFilesHtml = (u, files)=> files.map((f, i)=> `<div class="xrd-std-row" tabindex="-1" aria-haspopup="menu"><span class="txt-mini">Standards</span><span class="xrd-std-name">${u.esc(f.table.name)} + ${u.esc(f.name)}</span><button type="button" class="peak-del is-danger idle-dim" data-cal-del="${i}" title="Remove these standards and their levels">${u.X_SVG(13)}</button></div>`).join('');
// A thumbnail of a standard's chromatogram over the windows (lo–hi): a polyline, no plot.
export function thumbHtml(d, j, lo, hi){
  const W = 72, H = 22, pts = thumbPoints(d, j, lo, hi, W, H);
  if (!pts) return '';
  return `<svg class="gci-thumb" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1"/></svg>`;
}
/* The standards' rows (gc-integ-model.js calRows's): each its number, thumbnail, name (red
   where its fit is suspicious, whole in its tooltip), areas, levels (named by gasOf's display
   names, H₂ and O₂: v585, to v584 "H2", "O2") and Use; `sel` the standard on show, [lo, hi] the
   thumbnails' range. A row takes the focus and has a menu of its Use (v585: gc-integ.js
   wireCalEdits). */
export function levelRowsHtml(u, gasOf, rows, sel, lo, hi){
  const area = (x, g)=> x.r && x.r.gases && x.r.gases[g] ? sig(x.r.gases[g].area, 5) : '…';
  const val = v => v == null ? '' : u.esc(String(v));
  return rows.map((x, i)=> `<tr class="peak-row${i === sel ? ' selected' : ''}${x.lv.on ? '' : ' is-excluded'}" data-row="${i}" tabindex="-1" aria-haspopup="menu"><td class="gci-cal-k">${i + 1}</td><td class="gci-cal-th">${thumbHtml(x.d, x.j, lo, hi)}</td><td class="gci-cal-src${fitMarks(x.r).length ? ' gci-bad' : ''}" title="${u.esc(fullName(x))}"><span class="gci-cal-name">${u.esc(x.name)}</span></td><td class="gci-cal-a">${area(x, 'h2')}</td><td class="gci-cal-a">${area(x, 'o2')}</td>`
    + ['h2', 'o2'].map(g=> `<td><input type="text" inputmode="decimal" data-fi="${x.fi}" data-j="${x.j}" data-g="${g}" value="${val(x.lv[g])}" aria-label="${u.esc(gasOf(g).txt)} concentration of ${u.esc(x.name)}" placeholder="—"></td>`).join('')
    + `<td><input type="checkbox" data-fi="${x.fi}" data-j="${x.j}" data-g="on"${x.lv.on ? ' checked' : ''} aria-label="Use ${u.esc(x.name)}"></td></tr>`).join('')
    || `<tr><td colspan="8" class="txt-meta">Drop the standards' GC table and its raw chromatograms above.</td></tr>`;
}
// The standard on show's fit, in a line under its plot: each gas's area and χ²ᵣ; what makes it
// suspicious under it, the card's warning (suspiciousHtml, v571: to v570 a red "⚠" in the line).
export function calFitHtml(u, gasOf, keys, x){
  const r = x && x.r, gs = r && r.gases ? keys.filter(g=> r.gases[g]) : [], fl = r ? fitMarks(r) : [];
  const line = gs.map(g=>{ const v = r.gases[g]; return `${gasOf(g).label}: area ${sig(v.area, 5)} ± ${sig(v.sd, 2)}, χ²<sub>r</sub> ${fin(v.chi2r) ? v.chi2r.toFixed(2) : '—'}`; }).join(' · ');
  return line + suspiciousHtml(u, fl);
}
// Each gas's line: its intercept's chips, its plot, its numbers (drawn after).
export const calFitsHtml = (u, gasOf, keys, p, zero)=> keys.map(g=> `<div class="col gci-cal-gas" data-g="${g}">
            <div class="gci-cal-gas-head"><span class="txt-mini">${gasOf(g).label}</span>
              <span class="gci-cal-zero">${u.chipRow([{ key: 'free', label: 'free intercept' }, { key: 'zero', label: 'zero intercept' }], [zero[g] ? 'zero' : 'free'], { cls: 'plot-chip gci-zero-chip', data: o=> `data-g="${g}" data-zero="${o.key === 'zero' ? 1 : 0}"`, name: o=> o.label })}</span></div>
            ${u.plotWrap(`${p}Cal${g}`, { mod: 'gc', name: `GC_calibration_${gasOf(g).csv}.svg`, legend: '' })}
            <div class="gci-cal-stats"></div></div>`).join('');
/* A gas's numbers under its plot (gc-integ-model.js calGasOf's G): no standard; too few for
   a line; else the line (slope, intercept, R², n) and each level's deviation from it. */
export function calStatsHtml(u, gasOf, g, G, unit, zero){
  if (!G.pts.length) return `<p class="txt-meta">No standard for ${gasOf(g).label}: each pair takes the GC software's scale (k).</p>`;
  const L = G.L;
  if (!L){ const one = new Set(G.xs).size === 1; return `<p class="txt-meta">${plural(G.pts.length, 'standard')}${one ? ' at one concentration' : ''}: a free intercept needs two concentrations at least${zero ? '' : '; a zero intercept fits one'}.</p>`; }
  return `<p class="gci-cal-line">slope <b>${sig(L.slope, 6)}</b> area/${u.esc(unit)}, intercept <b>${sig(L.intercept, 5)}</b>${zero ? ' (fixed)' : ''}, R² = <b>${fin(L.r2) ? L.r2.toFixed(5) : '—'}</b>, n = ${L.n}</p>`
    + `<table class="gci-cal-dev"><thead><tr><th>Level (${u.esc(unit)})</th><th>n</th><th>Mean area</th><th>Line</th><th>Deviation</th></tr></thead><tbody>${levelsOf(L).map(([c, rs])=>{
      const mA = rs.reduce((s, r)=> s + r.area, 0)/rs.length, fit = rs[0].fitted, dev = fit ? 100*(mA - fit)/fit : NaN;
      return `<tr><td>${sig(+c, 5)}</td><td>${rs.length}</td><td>${sig(mA, 5)}</td><td>${sig(fit, 5)}</td><td class="${fin(dev) && Math.abs(dev) > 3 ? 'gci-bad' : ''}">${fin(dev) ? (dev > 0 ? '+' : '') + dev.toFixed(2) + ' %' : '—'}</td></tr>`; }).join('')}</tbody></table>`;
}
