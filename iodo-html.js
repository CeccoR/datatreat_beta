/* =========================================================
   IODOMETRY — its words and markup that need no page (iodo.js puts them in the Analysis
   card, its legend and the calibration's window; tests/iodomodel.test.mjs reads them in
   Node): the calibration's summary, the Analysis plot's legend, the calibration's window,
   its standards' rows and its fit's line. Taken out of v562's iodo.js as they were: the
   same markup to the byte.
   What they need from the page is handed in, u = { esc, X_SVG } (utils.js's: iodo.js HU).
========================================================= */
import { CAL_MODES, sig } from './iodo-model.js';

// The calibration as the Analysis card says it (L: its line, iodo-model.js calLine); one
// chosen but incomplete, a warning (v567: to v566 a grey line).
export const calSumHtml = (cal, L, u)=> cal.mode === 'none' ? 'Calibration: <b>none</b>'
  : !L ? '<div class="alert warn compact">⚠ Calibration incomplete: not used.</div>'
  : `Calibration: <b>A = ${u.esc(sig(L.m))} × c ${L.q < 0 ? '−' : '+'} ${u.esc(sig(Math.abs(L.q)))}</b>${Number.isFinite(L.r2) ? `, R² = <b>${u.esc(L.r2.toFixed(4))}</b>` : ''}${cal.unit.trim() ? `, c in <b>${u.esc(cal.unit.trim())}</b>` : ''}`;
// The Analysis plot's legend: [colour, its words (markup)] each.
export const legendHtml = (items, u)=> items.map(([c, t])=> `<span><i style="background:${u.esc(c)}"></i>${t}</span>`).join('');

/* The calibration's window (as XRPD's standard's: a head with its ×, what is under it
   scrolling): the way (none, the line typed, the standards fitted), the unit, the line or
   the standards, the fit shown as they are typed; Cancel and Apply at its foot. */
export const calHtml = u => `
    <div class="iodo-cal-box" role="dialog" aria-modal="true" aria-label="Calibration" tabindex="-1">
      <div class="iodo-cal-head"><h3 class="txt-head">Calibration</h3><button type="button" class="an-ic iodo-cal-x" title="Close" aria-label="Close">${u.X_SVG(15)}</button></div>
      <div class="iodo-cal-scroll">
        <p class="txt-meta iodo-cal-about">The line <b>A = slope × c + intercept</b> turns each reading, the absorbance A at the reading time, into a concentration <b>c = (A − intercept) / slope</b>, in the unit typed here. Type the line's slope and intercept, or the standards (their concentration and the absorbance read for them at the same reading time), fitted by least squares; both are kept, the one chosen used.</p>
        <div class="param-grid">
          <label class="txt-label" for="iodoCalMode">Calibration</label>
          <select class="pg-field" id="iodoCalMode">${Object.entries(CAL_MODES).map(([k, l])=> `<option value="${k}">${l}</option>`).join('')}</select>
          <label class="txt-label" for="iodoCalUnit">Concentration unit</label>
          <input type="text" class="pg-field" id="iodoCalUnit" placeholder="e.g. µM" maxlength="40" autocomplete="off" spellcheck="false">
        </div>
        <div class="param-grid iodo-cal-line">
          <label class="txt-label" for="iodoCalSlope">Slope (absorbance per unit)</label>
          <input type="text" inputmode="decimal" class="pg-field" id="iodoCalSlope" autocomplete="off">
          <label class="txt-label" for="iodoCalIcpt">Intercept (absorbance)</label>
          <input type="text" inputmode="decimal" class="pg-field" id="iodoCalIcpt" autocomplete="off">
        </div>
        <div class="iodo-cal-std">
          <table class="iodo-std"><thead><tr><th>Concentration</th><th>Absorbance</th><th></th></tr></thead><tbody></tbody></table>
          <button type="button" class="btn btn-sm" data-add-std>+ Standard</button>
          <div class="iodo-cal-fit"></div>
        </div>
        <div class="iodo-cal-msg" role="status"></div>
      </div>
      <div class="dt-modal-foot iodo-cal-foot"><button type="button" class="btn" data-cancel>Cancel</button><button type="button" class="btn primary" data-apply>Apply</button></div>
    </div>`;
// The standards' rows: each its concentration and absorbance, and its ×.
export const stdRowsHtml = (stds, u)=> stds.map((p, i)=> `<tr data-i="${i}"><td><input type="text" inputmode="decimal" data-j="0" aria-label="Concentration of standard ${i + 1}" value="${p[0] == null ? '' : u.esc(String(p[0]))}" autocomplete="off"></td>`
  + `<td><input type="text" inputmode="decimal" data-j="1" aria-label="Absorbance of standard ${i + 1}" value="${p[1] == null ? '' : u.esc(String(p[1]))}" autocomplete="off"></td>`
  + `<td><button type="button" class="an-ic" data-del title="Remove this standard" aria-label="Remove standard ${i + 1}">${u.X_SVG(13)}</button></td></tr>`).join('');
// The standards' fit under them (L: the draft's line; n: the standards with both values);
// none, an error (v567: to v566 a grey line): Apply is held back.
export const calFitHtml = (draft, L, n, u)=> draft.mode !== 'std' ? '' : L
  ? `Fit of ${L.n} standards: slope <b>${u.esc(sig(L.m, 6))}</b>, intercept <b>${u.esc(sig(L.q, 6))}</b>, R² = <b>${u.esc(L.r2.toFixed(4))}</b>`
  : `<div class="alert bad compact">✕ ${n} standard${n === 1 ? '' : 's'} with both values: two of different concentrations at least are needed.</div>`;
