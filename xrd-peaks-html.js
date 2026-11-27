/* =========================================================
   XRPD — the peak analysis's words and markup that need no page (xrd-peaks.js puts them in
   the cards; tests/peaksmodel.test.mjs reads them in Node): the peak table with the
   sample's mean size and its warnings, the standard's Caglioti fit, the note of a project
   whose patterns' steps differ, the size chart's chips and the note under it, each from
   plain values; and (v561, to v560 in xrd-peaks.js) the instructions, the card's markup
   (the samples' and the standard's) and its section of the Results, the table with no
   peak, the legends of the Results' plots. utils.js's esc, X_SVG and NORM_OPTIONS,
   modcharts.js's icons and snav.js's snavHtml, which need a page to load, are handed in
   (u: xrd-peaks.js U).
========================================================= */
import { scherrerD, sizeCorr, belowInstr, cagAt } from './xrd-peaks-model.js';

// "mean ± std" (or just "mean" for n=1, "—" for none)
function fmtMeanStd(mean, std, n){
  if (!isFinite(mean)) return '—';
  if (n >= 2 && isFinite(std)) return `${mean.toFixed(1)} ± ${std.toFixed(1)}`;
  return mean.toFixed(1);
}
// A fitted value and its standard error, to the error's second significant digit
// (four significant digits when it has none).
function fmtPar(v, se){
  if (!isFinite(v)) return '—';
  if (!(isFinite(se) && se > 0)) return (+v.toPrecision(4)).toString();
  const d = Math.min(10, Math.max(0, 1 - Math.floor(Math.log10(se))));
  return `${v.toFixed(d)} ± ${se.toFixed(d)}`;
}
const fmtCell = v => isFinite(v) ? v.toFixed(1) : '—';

const outsideStdHtml = (n, span)=> `<div class="alert warn">⚠ ${n} peak${n > 1 ? 's lie' : ' lies'} beyond the standard's peaks (${span[2].toFixed(2)}–${span[3].toFixed(2)}°) by more than ${n > 1 ? 'their' : 'its'} width: there the instrumental width is extrapolated, not measured.</div>`;
const belowInstrHtml = n => `<div class="alert warn">⚠ ${n} peak${n > 1 ? 's are' : ' is'} narrower than the instrumental width at ${n > 1 ? 'their angles' : 'its angle'}, which is not physically possible: the standard is likely unsuitable. ${n > 1 ? 'They are' : 'It is'} left out of the corrected size.</div>`;

/* The note of a project to v510 whose patterns' steps differ, with its × (on: the chips its
   conversion turned to one and still one, N the smoothing's, blWin the SNIP's); none, ''. */
function stepNoteHtml(on, { X_SVG }){
  const what = on.map(m=> m === 'N' ? 'smoothing' : 'SNIP width').join(' and ');
  return on.length ? `<div class="alert warn">⚠ The patterns were measured at different steps: the ${what}, set in points by an older version, ${on.length > 1 ? 'are' : 'is'} kept as ${on.length > 1 ? 'they were' : 'it was'}, a width for each pattern (one). Set one width in all to treat them alike.<button class="alert-dismiss close-x" data-step-x title="Dismiss">${X_SVG(15)}</button></div>` : '';
}

/* The peak table of a pattern's kept peaks (pks, at least one): 2θ, rel intensity, classic
   FWHM, size. With a standard in use (m, its model), the samples show the size both
   without and with the correction. fp: the pattern's settings (K, λ); picked: the 2θ of
   the peak picked, or null; st: a sample's sizes summarised (sampleSizes), its mean and
   its warnings under the table. */
function peakTableHtml(pks, { std, m, fp, picked, st }, { esc, X_SVG }){
  // (only peaks of height 0 left — manual ones on the baseline — none has a relative
  // intensity: a dash; up to v484 0/0 printed NaN%)
  const maxH = Math.max(...pks.map(pk=>pk.height)), relOf = h => maxH > 0 ? (h/maxH*100).toFixed(1) + '%' : '—';
  const showCorr = !!m && !std;
  const sizeCol = !std;
  // The table scrolls sideways in its own box when the screen is narrower than it;
  // the summary and warnings under it stay put.
  let html='<div class="peak-scroll"><table><thead><tr><th>#</th><th>2θ (°)</th><th>Relative Intensity</th><th>FWHM (°)</th>'+(sizeCol?'<th>Crystallite size (nm)</th>':'')+(showCorr?'<th>Crystallite size corr. (nm)</th>':'')+'<th></th></tr></thead><tbody>';
  pks.forEach((pk,i)=>{
    const fwhm = pk.fwhmClassic;
    const sizeRawCell = sizeCol ? `<td>${fmtCell(scherrerD(fwhm, pk.detPos, fp.K, fp.lambda))}</td>` : '';
    const below = showCorr && belowInstr(fwhm, pk.detPos, m);
    const corrCell = showCorr ? (below ? `<td title="Narrower than the instrumental width at this angle">⚠</td>` : `<td>${fmtCell(sizeCorr(fwhm, pk.detPos, fp.K, fp.lambda, m))}</td>`) : '';
    const sel = picked!=null && Math.abs(pk.pos-picked)<1e-9 ? ' selected' : '';
    html+=`<tr class="peak-row${pk.manual?' manual-peak':''}${sel}" data-pos="${esc(pk.pos)}" data-det="${esc(pk.detPos)}"><td>${i+1}</td><td>${pk.pos.toFixed(3)}</td><td>${relOf(pk.height)}</td><td${std && isFinite(pk.fwhmSig) ? ` title="± ${pk.fwhmSig.toPrecision(2)}° (counting statistics)"` : ''}>${isFinite(fwhm)?fwhm.toFixed(3):'—'}</td>${sizeRawCell}${corrCell}<td style="text-align:center"><button class="peak-del is-danger idle-dim" data-det="${esc(pk.detPos)}" data-manual="${pk.manual?1:0}" title="Remove peak">${X_SVG(13)}</button></td></tr>`;
  });
  html+='</tbody></table></div>';
  if (!std){
    html += `<div class="size-summary">Mean crystallite size: <b>${fmtMeanStd(st.rawMean, st.rawStd, st.rawN)} nm</b>`;
    if (st.showCorr) html += `<br>Instr.-corrected: <b>${fmtMeanStd(st.corrMean, st.corrStd, st.corrN)} nm</b>`;
    html += '</div>';
    if (st.below) html += belowInstrHtml(st.below);
    if (st.outside) html += outsideStdHtml(st.outside, st.span);
  }
  return html;
}

/* The standard's Caglioti fit, in the right-hand column, as the Tauc cards give E_g:
   the formula, then one value a line — U, V, W with their standard errors; R² of the
   fit; the RMS of the FWHM residuals, in degrees like the widths in the table; the
   peaks it rests on and their 2θ span. The residual standard error on FWHM² and the
   largest residual are in the tooltips. A curve that drops to zero inside the
   standard's own range is flagged under the box (alert): the width it gives there is not
   physical. m: the standard's model (null: none); nFiles: its files (0: none loaded). */
function cagliotiHtml(m, nFiles){
  let html = `<div class="txt-mini">Caglioti fit</div><div class="pg-stat cag-formula">FWHM² = U·tan²θ + V·tanθ + W</div>`;
  if (!m || !m.pts.length) return { box: html + `<div class="pg-stat cag-note">${nFiles ? 'No peaks' : 'No standard loaded'}: no instrumental correction.</div>`, alert: '' };
  const n = m.pts.length, lo = m.pts[0].x, hi = m.pts[n-1].x;
  const span = n > 1 ? `, 2θ ${lo.toFixed(2)}–${hi.toFixed(2)}°` : `, 2θ ${lo.toFixed(2)}°`;
  if (!m.fit){
    // What the fit lacks is 3 distinct angles: 3 peaks at 2 (a manual peak put on a
    // detected one) do not make a curve either.
    const nx = new Set(m.pts.map(q=> q.x)).size;
    const lack = nx === n ? `it needs 3 peaks or more` : `it needs peaks at 3 angles or more, and these ${n} lie at ${nx}`;
    return { box: html + `<div class="pg-stat">Peaks: <b>${n}</b>${span}</div>`
      + `<div class="pg-stat cag-note">Not fitted: ${lack}. The instrumental width is ${nx === 1
        ? "the peak's FWHM at every angle" : 'interpolated between the peaks, and held at the end ones beyond them'}.</div>`, alert: '' };
  }
  const f = m.fit;
  html += ['U', 'V', 'W'].map((k, i)=> `<div class="pg-stat">${k}: <b>${fmtPar(f.uvw[i], f.se[i])} °²</b></div>`).join('');
  const dofTxt = `${f.dof} degree${f.dof === 1 ? '' : 's'} of freedom`;
  if (f.dof > 0 && f.weighted) html += `<div class="pg-stat" title="χ² = Σ((FWHM − fit)/σ)² over ${dofTxt}, σ each width's counting uncertainty. About 1: the curve follows the peaks within their counting errors. Well above 1: it does not (Kα₂ partly resolved, asymmetry, a peak that is not the standard's), and U, V, W carry errors scaled by its square root.">χ²<sub>red</sub>: <b>${f.chi2r.toPrecision(2)}</b></div>`;
  html += f.dof > 0
    ? `<div class="pg-stat" title="${f.weighted ? 'Weighted as the fit is (1/σ² on each width)' : `Unweighted: no counting uncertainty for the widths. Residual standard error on FWHM²: ${f.s.toPrecision(2)} °² (${dofTxt})`}">R²: <b>${f.r2.toFixed(4)}</b></div>`
    : `<div class="pg-stat cag-note">Exact through its 3 peaks: no degree of freedom left to judge the fit by.</div>`;
  // To two significant digits: a good standard's residuals are tenths of a
  // thousandth of a degree, which three decimals would show as 0.000°.
  if (f.dof > 0) html += `<div class="pg-stat" title="Largest residual: ${f.maxRes.toPrecision(2)}°">FWHM residual (RMS): <b>${f.rms.toPrecision(2)}°</b></div>`;
  html += `<div class="pg-stat">Peaks: <b>${n}</b>${span}</div>`;
  let neg = false;
  for (let k = 0; k <= 100 && !neg; k++) neg = cagAt(f.uvw, ((lo + (hi - lo)*k/100)/2)*Math.PI/180) <= 0;
  return { box: html, alert: neg ? `<div class="alert warn">⚠ The fitted FWHM² drops to zero inside the standard's range: there the curve is not physical, and no correction is made.</div>` : '' };
}

// The size chart's two chips, one at a time (by: the one on); with a single sample (n: the
// samples processed) there is nothing to compare by peak: none. ok: a reflection is in every
// sample (byPeakOk).
const sizeChipsHtml = (n, ok, by)=> n < 2 ? '' : [['sample', 'by sample'], ['peak', 'by peak']].map(([k, t])=>
  `<button type="button" class="mode-chip plot-chip${by === k ? ' is-on' : ''}" data-size-by="${k}"`
  + `${k === 'peak' && !ok ? ' disabled title="No reflection is found in every sample"' : ` title="Crystallite size ${t}"`}>${t}</button>`).join('');
// What is left out by peak: the reflections not every sample has (R: sizeReflections'), and
// whose they are (labels: the files').
const sizeNoteHtml = (R, by, labels, { esc })=> by === 'peak' && R.extra.length
  ? `Not in every sample, left out: ${R.extra.map(g=> `${g.pos.toFixed(2)}° (${[...g.by.keys()].map(k=> esc(labels[k])).join(', ')})`).join('; ')}.` : '';

/* ---- The instructions: over the cards (PEAKS_INFO) and in the standard's window (STD_INFO);
   xrd-peaks.js gives them to xrd.js as before ---- */
const PEAKS_INFO = `Per-sample view. Raw pattern (grey), smoothing (blue), SNIP baseline (orange) and detected peaks (green). The <b>smoothing</b> takes at each point the mean of the line through the points over a window w wide (°2θ) centred on it, a box convolution, cut short at the ends of the pattern; 0 is none. The <b>SNIP</b> (Statistics-sensitive Non-linear Iterative Peak-clipping) baseline iteratively clips each point downward toward the average of the curve on either side at decreasing distances, from half its width W (°2θ) down to one step, so the peaks are cut away and the slowly varying background is left; its box unticked, there is none, and the pattern is read from zero as it is. Both are widths on the 2θ axis, so that one setting treats alike patterns measured at different steps; each field shows beside its value the points it spans at the step of the pattern on show. Peaks are searched on the smoothed pattern with the baseline taken off: a peak must reach the minimum height and stand out by the minimum prominence (both in % of the highest), and two peaks closer than the minimum distance keep the taller. The FWHM is read where the profile crosses half its height, interpolated between points; the crystallite size is Scherrer's, D = Kλ / (β·cosθ). With an instrumental standard (<b>Instrumental standard…</b>), the instrument's width at each angle is taken off in quadrature, β² = β<sub>obs</sub>² − β<sub>instr</sub>², for the corrected size. <b>+ Add peak</b> places a peak by hand on the plot; the × in a row removes one. Use the <b>all / one</b> toggles to share a value across samples or set it per sample.`;
const STD_INFO = `A measured standard (large, strain-free crystallites — LaB₆, Si…) characterises the instrumental broadening β<sub>instr</sub>(2θ). It is analysed here on its own, always normalised to its highest peak (= 1), with parameters of its own. Its peaks' FWHM are fitted with the Caglioti function, FWHM² = U·tan²θ + V·tanθ + W, which gives the instrument's width at any angle: the samples' corrected sizes take it off in quadrature. One file at a time: a file dropped replaces the one there.`;

/* ---- The card's markup (to v560 in xrd-peaks.js), and its section of the Results ----
   utils.js's NORM_OPTIONS, modcharts.js's PLOT_DL_ICON and CSV_ICON and snav.js's snavHtml,
   which need a page to load, are handed in with the rest (u: xrd-peaks.js U). */
const LEGEND = `<div class="legend">
              <span><i style="background:#6a7585"></i>raw</span>
              <span><i style="background:#3aa0ff"></i>smoothed</span>
              <span class="lg-bl"><i style="background:#ff9933"></i>baseline</span>
              <span><i style="background:#5fcf6a"></i>peaks</span>
            </div>`;
// The baseline's box, before its window's title: on (the default), the SNIP baseline.
const BL_TITLE = 'Subtract a SNIP baseline (the background) before the peak search and the FWHM; unticked, none: the pattern is taken as it is, from zero';
const CHIP_TITLE = "Switch all / one: to one, every sample starts from the common value; back to all, the common value is the shown sample's";
const chip = (p, k, mode)=> `<button type="button" class="mode-chip" id="${p}Mode${k}" title="${CHIP_TITLE}">${mode}</button>`;
/* A width's field (the smoothing's, the SNIP's): its value in °2θ and, in the same box after
   it, muted, what it spans in points of the pattern on show (syncHints). The box is a
   label: a click on the points is one in the field. */
const W_TITLE = { Smooth: "The smoothing box's width, in °2θ (0: none); beside it, the points it spans at the step of the pattern on show",
  BlWin: "The SNIP baseline's width, in °2θ: each point is compared with the curve up to half this far on either side; beside it, the points it spans at the step of the pattern on show" };
const wField = (p, id, v)=> `<label class="pg-field wfield" title="${W_TITLE[id]}"><input type="text" inputmode="decimal" id="${p}${id}" value="${v}" autocomplete="off" aria-describedby="${p}${id}Pts"><span class="wf-pts" id="${p}${id}Pts"></span></label>`;
// The card's markup: the samples' card, or the standard's (std).
const cardHtml = (p, std, u)=> std ? stdCardHtml(p, u) : sampleCardHtml(p, u);
/* The standard's: one file, named over it in the window, so its plot has no caption;
   the parameters beside the plot, the Caglioti fit and + Add peak at their foot,
   ending level with the plot's bottom (the frame of the Rietveld card's, .pside). */
function stdCardHtml(p, { PLOT_DL_ICON, CSV_ICON }){
  return `
        <div class="pside">
          <div class="plot-nav-row pside-nav"></div>
          <div class="pside-plot">
            <div class="plot-wrap">
              <svg class="plot" id="${p}Svg"></svg>
              <button class="btn plot-dl-btn" data-dl-svg="${p}Svg" data-csv-mod="xrd" data-csv-names="standard.csv" data-dl-name="XRPD_standard.svg">${PLOT_DL_ICON}</button>
            </div>
          </div>
          <div class="pside-under">${LEGEND}</div>
          <div class="pside-col xrd-std-side">
            <div class="txt-mini param-head cap-title"><span>Parameters</span></div>
            <div class="param-grid">
              <label class="txt-label" for="${p}Smooth">Smoothing width (&#176;2&#952;)</label>
              ${wField(p, 'Smooth', 0)}
              <div class="txt-label pg-title"><label class="pg-on" title="${BL_TITLE}"><input type="checkbox" id="${p}BlOn" checked> Baseline SNIP width (&#176;2&#952;)</label></div>
              ${wField(p, 'BlWin', 5)}
              <label class="txt-label" for="${p}PkHeight">Peak min. height (%)</label>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}PkHeight" value="5">
              <label class="txt-label" for="${p}PkProm">Peak min. prominence (%)</label>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}PkProm" value="3">
              <label class="txt-label" for="${p}PkDist">Peak min. distance (&#176;2&#952;)</label>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}PkDist" value="0.3">
            </div>
            <div class="xrd-cag"><div class="pg-result" id="${p}Cag"></div></div>
            <div id="${p}CagAlert" class="cag-alert"></div>
            <button class="btn plot-action-btn" id="${p}AddPeak" title="Add a peak by clicking on the plot">+ Add peak</button>
          </div>
        </div>`
    + peakBoxHtml(p, 'data-csv-names="standard.csv"', CSV_ICON);
}
// The samples': the plot under its sample selector, the parameters beside it.
function sampleCardHtml(p, u){
  const { snavHtml, PLOT_DL_ICON, CSV_ICON } = u;
  return `
        <div class="row" style="align-items:flex-start">
          <div class="col mw520" style="flex:2">
            <div class="plot-nav-row">
              <div class="plot-nav-left">
                ${snavHtml({ prev: p + 'Prev', idx: p + 'Idx', next: p + 'Next', name: p + 'CurrentLabel', prevCls: 'an-prev', nextCls: 'an-next' })}
              </div>
            </div>
            <div class="plot-wrap">
              <svg class="plot" id="${p}Svg"></svg>
              <button class="btn plot-dl-btn" data-dl-svg="${p}Svg" data-csv-mod="xrd" data-csv-base="diffractograms.csv,peaks.csv" data-csv-names="diffractograms.csv,peaks.csv" data-dl-base="XRPD_sample.svg" data-dl-name="XRPD_sample.svg">${PLOT_DL_ICON}</button>
            </div>
            ${LEGEND}
          </div>`
    + sampleParamsHtml(p, u) + `
        </div>`
    + peakBoxHtml(p, 'data-csv-base="peaks.csv" data-csv-names="peaks.csv"', CSV_ICON);
}
// The samples' parameters, each field with its all / one chip; the step note and the buttons under them.
function sampleParamsHtml(p, { NORM_OPTIONS }){
  return `
          <div class="col mw280" style="align-self:flex-start">
            <div class="txt-mini param-head aligned cap-title"><span>Parameters</span></div>
            <div class="param-grid">
              <label class="txt-label" for="${p}Norm">Normalization</label>
              <select id="${p}Norm" class="pg-field">${NORM_OPTIONS}</select>
              <div class="txt-label pg-title">Smoothing width (&#176;2&#952;) ${chip(p, 'N', 'all')}</div>
              ${wField(p, 'Smooth', 0.25)}
              <div class="txt-label pg-title"><label class="pg-on" title="${BL_TITLE}"><input type="checkbox" id="${p}BlOn" checked> Baseline SNIP width (&#176;2&#952;)</label> ${chip(p, 'Bl', 'all')}</div>
              ${wField(p, 'BlWin', 5)}
              <div class="txt-label pg-title">Peak min. height (%) ${chip(p, 'H', 'one')}</div>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}PkHeight" value="5">
              <div class="txt-label pg-title">Peak min. prominence (%) ${chip(p, 'P', 'one')}</div>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}PkProm" value="3">
              <div class="txt-label pg-title">Peak min. distance (&#176;2&#952;) ${chip(p, 'D', 'one')}</div>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}PkDist" value="0.3">
              <div class="txt-label pg-title">Shape factor K ${chip(p, 'K', 'all')}</div>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}K" value="0.9">
              <div class="txt-label pg-title">Wavelength &#955; (&#8491;) ${chip(p, 'L', 'all')}</div>
              <div class="pg-field lambda-field">
                <select id="${p}LambdaSel" class="lambda-sel" title="X-ray source / wavelength">
                  <option value="1.540598">Cu Kα1</option>
                  <option value="1.541838">Cu Kα</option>
                  <option value="1.544426">Cu Kα2</option>
                  <option value="0.709317">Mo Kα1</option>
                  <option value="1.789010">Co Kα1</option>
                  <option value="2.289760">Cr Kα1</option>
                  <option value="custom">Custom</option>
                </select>
                <input type="text" inputmode="decimal" class="lambda-val" id="${p}Lambda" value="1.540598" readonly title="Wavelength (Å)">
              </div>
            </div>
            <div id="${p}StepNote"></div>
            <div class="xrd-pk-btns">
              <button class="btn plot-action-btn" id="${p}AddPeak" title="Add a peak by clicking on the plot">+ Add peak</button>
              <button class="btn plot-action-btn" id="${p}Std" aria-haspopup="dialog" title="The instrumental standard: its file, its peaks and the Caglioti fit that corrects the sizes for the instrument's width">Instrumental standard…</button>
            </div>
          </div>`;
}
// The detected peaks' box under the plot: its reset, its CSV (csv: the button's names), the table.
function peakBoxHtml(p, csv, CSV_ICON){
  return `
        <div class="peak-box" id="${p}PeakBox">
          <div class="peak-box-head">
            <span class="txt-mini">Detected peaks</span>
            <button class="btn nav-arrow peak-reset-btn" id="${p}PkReset" style="display:none" title="Reset peaks">&#8634;</button>
            <button class="btn table-csv-btn" data-csv-mod="xrd" ${csv} title="Download CSV">${CSV_ICON}</button>
          </div>
          <div class="xrd-peak-wrap" id="${p}PeakTableWrap"></div>
        </div>`;
}
// A card's section of the Results: the patterns stacked, and the crystallite sizes.
function resHtml(p, { PLOT_DL_ICON }){
  return `
        <h4 class="res-an-title"></h4>
        <div class="row res-row" style="gap:16px">
          <div class="col mw320" style="flex:1">
            <p class="txt-caption">Analysis</p>
            <div class="plot-wrap">
              <svg class="plot" id="${p}ResSvg"></svg>
              <button class="btn plot-dl-btn" data-dl-svg="${p}ResSvg" data-csv-mod="xrd" data-csv-base="diffractograms.csv" data-csv-names="diffractograms.csv" data-dl-base="XRPD_results_analysis.svg" data-dl-name="XRPD_results_analysis.svg" data-dl-legend="${p}ResLegend">${PLOT_DL_ICON}</button>
            </div>
            <div id="${p}ResLegend" class="legend"></div>
          </div>
          <!-- The crystallite size beside the intensities it is read from. -->
          <div class="col mw320" style="flex:1">
            <p class="txt-caption">Crystallite size</p>
            <div class="plot-wrap">
              <svg class="plot" id="${p}SizeBarSvg"></svg>
              <span class="plot-chips" id="${p}SizeBy"></span>
              <button class="btn plot-dl-btn" data-dl-svg="${p}SizeBarSvg" data-csv-mod="xrd" data-csv-names="crystallite_size.csv,crystallite_size_by_peak.csv" data-dl-name="XRPD_crystallite_size.svg" data-dl-legend="${p}SizeBarLegend">${PLOT_DL_ICON}</button>
            </div>
            <div id="${p}SizeBarLegend" class="legend"></div>
            <div id="${p}SizeByNote" class="txt-meta"></div>
          </div>
        </div>`;
}
// The table's box with no peak to list.
const NO_PEAKS = '<p style="color:var(--muted);margin:6px 0">No peaks found with current parameters.</p>';
// The Results' stacked patterns' legend: those drawn (shown, their indices in fs), each in its colour.
const stackLegendHtml = (fs, shown, { esc })=> shown.map(k=> `<span><i style="background:${esc(fs[k].color)}"></i>${esc(fs[k].label)}</span>`).join('');
// The size chart's legend: its series (xrd-peaks-model.js sizeSeries), each its boxes' colour.
const sizeLegendHtml = SER => SER.map(m=> `<span><i class="mk-box" style="background:${m.color}"></i>${m.name}</span>`).join('');

export { fmtMeanStd, fmtPar, fmtCell, outsideStdHtml, belowInstrHtml, stepNoteHtml, peakTableHtml, cagliotiHtml, sizeChipsHtml, sizeNoteHtml,
  PEAKS_INFO, STD_INFO, cardHtml, resHtml, NO_PEAKS, stackLegendHtml, sizeLegendHtml };
