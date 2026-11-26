/* =========================================================
   XRPD — the peak analysis's words and markup that need no page (xrd-peaks.js puts them in
   the cards; tests/peaksmodel.test.mjs reads them in Node): the peak table with the
   sample's mean size and its warnings, the standard's Caglioti fit, the note of a project
   whose patterns' steps differ, the size chart's chips and the note under it, each from
   plain values. utils.js's esc and X_SVG, which need a page to load, are handed in
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
  return on.length ? `<div class="alert warn">⚠ The patterns were measured at different steps: the ${what}, set in points up to v510, ${on.length > 1 ? 'are' : 'is'} kept as ${on.length > 1 ? 'they were' : 'it was'}, a width for each pattern (one). Set one width in all to treat them alike.<button class="alert-dismiss close-x" data-step-x title="Dismiss">${X_SVG(15)}</button></div>` : '';
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

export { fmtMeanStd, fmtPar, fmtCell, outsideStdHtml, belowInstrHtml, stepNoteHtml, peakTableHtml, cagliotiHtml, sizeChipsHtml, sizeNoteHtml };
