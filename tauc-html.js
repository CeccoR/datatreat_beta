/* =========================================================
   DRS — the cards' words and markup that need no page (tauc.js puts them in the cards and
   the Results; tests/taucmodel.test.mjs reads them in Node): the instructions of a Tauc and
   an Urbach card, each card's body (the plot, its selector and legend, the parameters), a
   card's section of the Results, the file list's note, the alerts a card and a chart
   write. Taken out of v555's tauc.js as they were: the same markup to the byte.
   What they need from the page is handed in, u = { esc, plotWrap, snavHtml } (utils.js's
   esc, modcharts.js's plot box, snav.js's sample selector: tauc.js HU), and the cards'
   own instructions (cards.js cardInfo) where they end with them.
========================================================= */
import { EXPONENTS, URB_SUB_COLORS, warnOf } from './tauc-model.js';

// A raised run in an svg label (the plot's axis titles).
export const sup = v => `<tspan baseline-shift="super" font-size="8">${v}</tspan>`;

/* ---- The instructions (cardInfo: the cards' own words after them) ---- */
export const taucInfo = cardInfo => `Drag the vertical lines to set the Tauc linear regression region (red) and the baseline (magenta), or press <b>✦ Suggest intervals</b> to place them automatically from the absorption edge (second-derivative method), for every sample: one common set in <b>all</b> mode, each sample its own in <b>one</b> mode. Within each interval the best fit is chosen by sliding a window (its size is the regression-window value) and minimising <b>NRMSE/R²</b>, where <b>NRMSE = RMSE / (y<sub>max</sub>−y<sub>min</sub>)</b> of the window. Normalising by the y-range keeps the fit on the steep linear part instead of a flat low-value stretch that only has a small absolute RMSE, so it is markedly more stable. E<sub>g</sub> is extracted from both the x-axis intersection and the baseline intersection of the regression line. The <b>Tauc exponent</b> is 2 for direct allowed transitions, 0.5 for indirect allowed, 2/3 for direct forbidden and 1/3 for indirect forbidden ones; changing it places the lines again, as Suggest does (every sample in <b>all</b> mode, the one on show in <b>one</b> mode). Energies are hν = hc/λ (hc = 1239.842 eV·nm). The curve is smoothed with a centred moving average to choose each window, and the line is then fitted to the unsmoothed data inside it: fitted to smoothed values, whose residuals are no longer independent, its errors would come out too small. Where F(R) &lt; 0, [F(R)·hν]<sup>a</sup> has no value for a = 0.5, 2/3 or 1/3: those points are left out, as though not measured, of the smoothing, the derivatives, the suggestion and the fits. <b>Errors</b>: each E<sub>g</sub> uncertainty is the regression's own, its slope and intercept variances and their covariance propagated through the formula, multiplied by <b>Student's t at 99% confidence</b> (two-sided, M − 2 degrees of freedom for each fit). E<sub>g</sub> from the baseline combines both fits and treats them as independent. ${cardInfo}`;
export const urbachInfo = cardInfo => `Below the band gap the absorption tail is exponential, F(R) ∝ exp(hν / E<sub>U</sub>), so <b>ln[F(R)]</b> against hν is a straight line of slope 1 / E<sub>U</sub>. The <b>Tauc reference</b> is the Tauc analysis this one is read against: its linear region is the red band on the plot, and <b>✦ Suggest intervals</b> places the Urbach region, for every sample, below it, where the tail is: from 1 eV under the middle of the Tauc linear region up to where that region starts; the regression window then finds the straightest stretch of the tail inside it by itself. The region follows the reference: when a sample's Tauc linear region moves (its lines, parameters, Suggest), the sample's Urbach region is placed on it again once the change is made (a Tauc line released, a value confirmed), and a new reference places them all. By default the reference is the nearest Tauc card above this one; one chosen by hand stays wherever the cards are moved. With <b>None</b> there is no band and nothing to follow, and the suggestion puts the lines at 25% and 75% of each sample's energy span. Drag the orange lines to set the region by hand: they stay until the reference's region moves again. The lines are always each sample's own: <b>all / one</b> here sets the parameters only. Within the region the best window of the regression-window size is chosen by minimising <b>NRMSE/R²</b> and fitted on the unsmoothed data, as for Tauc. <b>E<sub>U</sub> = 1 / slope</b>; its error is the slope's standard error carried through (σ<sub>m</sub> / m²), multiplied by <b>Student's t at 99% confidence</b> (two-sided, M − 2 degrees of freedom). Points with F(R) ≤ 0 have no logarithm and are left out. <b>Subtracted</b>: the same, with the reference's Tauc baseline taken out of F(R) first. That baseline is a line in the Tauc plot, Y<sub>b</sub> = m·hν + b in [F(R)·hν]<sup>a</sup>, so in F(R) it is <b>F<sub>b</sub> = Y<sub>b</sub><sup>1/a</sup> / hν</b> where Y<sub>b</sub> > 0 (nothing where it is not); ln[F(R) − F<sub>b</sub>] is smoothed and fitted between the same lines, by the same rules, for a second slope and E<sub>U</sub> (subtracted). Its error adds, in quadrature, the fit's own (as for E<sub>U</sub>) and the Tauc baseline's carried through the subtraction: with the window held, the slope's derivatives with respect to the baseline's slope and intercept, J (exact, through F<sub>b</sub>), give its variance J Σ J<sup>T</sup>, Σ the baseline fit's covariance, whose square root, times that fit's own t factor (99%, two-sided, the reference card's baseline regression window − 2 degrees of freedom), is divided by slope² as above; the card's tooltip gives the two parts. The two fits are taken as independent, although the baseline and the Urbach region may share points. On the card's plot its curve is purple and its fit teal (solid in its window, dashed beyond), drawn as the plain ones are; with no reference there is nothing to subtract, and where the baseline lies above F(R) in the region there is no fit, which the card says. In the Results the Urbach plot is two, side by side, each with its own axes: the plain curves and fits on the left, the subtracted ones on the right (empty, and saying why, when there is nothing to subtract); under each, its E<sub>U</sub> chart, the plain E<sub>U</sub> under the plain plot and the subtracted one under the subtracted plot. ${cardInfo}`;

/* ---- Card markup ---- */
// (the sample selector: snav.js, v545)
const navRow = (p, u)=> `
        <div class="plot-nav-row">
          <div class="plot-nav-left">
            ${u.snavHtml({ prev: p + 'Prev', idx: p + 'Idx', next: p + 'Next', name: p + 'CurrentLabel', prevCls: 'an-prev', nextCls: 'an-next' })}
          </div>
        </div>`;
// At the foot of the parameter column, after what it holds.
const suggestBtn = (p, title)=> `
          <button class="btn plot-action-btn" id="${p}Suggest" title="${title}">&#10022; Suggest intervals</button>`;
// A plot's box (modcharts.js). The download names follow the analysis name (tauc.js
// named); a CSV is offered only where there is one to give.
const box = (u, id, legend, csv, extra, cls)=> u.plotWrap(id, { legend, mod: 'tauc', csv: csv ? '-' : '', extra, cls });
// An item [colour, text, attributes].
const legend = (id, items)=> `<div class="legend" id="${id}">${items.map(([c, t, x])=> `<span${x || ''}><i style="background:${c}"></i>${t}</span>`).join('')}</div>`;

function taucBody(p, u){
  return `
      <div class="row" style="align-items:flex-start">
        <div class="col mw520" style="flex:2">
          ${navRow(p, u)}
          ${box(u, p + 'Svg', p + 'Legend', true)}
          ${legend(p + 'Legend', [['#6a7585', 'original'], ['#3aa0ff', 'smoothed'], ['#5fcf6a', 'derivative'], ['#ff5050', 'Tauc linear region'], ['#d050ff', 'baseline']])}
        </div>
        <div class="col mw280" style="align-self:flex-start">
          <div class="txt-mini param-head aligned cap-title"><span>Parameters</span> <button type="button" class="mode-chip" id="${p}ModeAll" title="all: one common setup for every sample. one: each sample fully independent (parameters and interval lines). Switching to one, every sample starts from the common setup; back to all, the common setup is the shown sample's.">all</button></div>
          <div class="param-grid">
            <label class="txt-label" for="${p}A">Tauc exponent</label>
            <select id="${p}A" class="pg-field an-exp">
              ${EXPONENTS.map(e=> `<option value="${e.a}"${e.a === 0.5 ? ' selected' : ''}>${e.label} (${e.name})</option>`).join('')}
            </select>
            <label class="txt-label" for="${p}N">[F(R)hν]<sup id="${p}NExp">0.5</sup> smoothing window</label>
            <input type="number" class="pg-field" id="${p}N" value="1" min="1">
            <label class="txt-label" for="${p}N2">Derivative smoothing window</label>
            <input type="number" class="pg-field" id="${p}N2" value="20" min="1">
            <label class="txt-label" for="${p}M">Tauc linear region regression window</label>
            <input type="number" class="pg-field" id="${p}M" value="25" min="2">
            <div class="pg-stat">NRMSE: <b id="${p}RMSE1">-</b></div>
            <div class="pg-stat">R²: <b id="${p}R21">-</b></div>
            <label class="txt-label" for="${p}M2">Baseline regression window</label>
            <input type="number" class="pg-field" id="${p}M2" value="100" min="2">
            <div class="pg-stat">NRMSE: <b id="${p}RMSE2">-</b></div>
            <div class="pg-stat">R²: <b id="${p}R22">-</b></div>
            <div class="pg-result">
              <div class="pg-stat">E<sub>g</sub> (x-axis): <b id="${p}Eg">-</b></div>
              <div class="pg-stat">E<sub>g</sub> (baseline): <b id="${p}EgInt">-</b></div>
            </div>
          </div>
          <div id="${p}Alert"></div>${suggestBtn(p, 'Propose optimal Tauc-region and baseline intervals from the absorption edge')}
        </div>
      </div>`;
}
function urbachBody(p, u){
  return `
      <div class="row" style="align-items:flex-start">
        <div class="col mw520" style="flex:2">
          ${navRow(p, u)}
          ${box(u, p + 'Svg', p + 'Legend', false)}
          ${legend(p + 'Legend', [['#6a7585', 'original'], ['#3aa0ff', 'smoothed'], ['#5fcf6a', 'derivative'], ['#ff7f0e', 'Urbach region'],
            [URB_SUB_COLORS.curve, 'smoothed, Tauc baseline subtracted', ` id="${p}LegSub"`], [URB_SUB_COLORS.fit, 'Urbach region, subtracted', ` id="${p}LegSubFit"`],
            ['rgba(255,80,80,0.35)', 'Tauc linear region', ` id="${p}LegBand"`]])}
        </div>
        <div class="col mw280" style="align-self:flex-start">
          <div class="txt-mini param-head aligned cap-title"><span>Parameters</span> <button type="button" class="mode-chip" id="${p}ModeAll" title="all: one set of parameters for every sample. one: each sample its own. The interval lines are always each sample's own. Switching to one, every sample starts from the common setup; back to all, the common setup is the shown sample's.">all</button></div>
          <div class="param-grid">
            <label class="txt-label" for="${p}Ref">Tauc reference</label>
            <select id="${p}Ref" class="pg-field an-ref" title="The Tauc analysis whose linear region the Urbach region is placed on"></select>
            <label class="txt-label" for="${p}N">ln[F(R)] smoothing window</label>
            <input type="number" class="pg-field" id="${p}N" value="1" min="1">
            <label class="txt-label" for="${p}N2">Derivative smoothing window</label>
            <input type="number" class="pg-field" id="${p}N2" value="20" min="1">
            <label class="txt-label" for="${p}M">Urbach linear region regression window</label>
            <input type="number" class="pg-field" id="${p}M" value="25" min="2">
            <div class="pg-stat">NRMSE: <b id="${p}RMSE1">-</b></div>
            <div class="pg-stat">R²: <b id="${p}R21">-</b></div>
            <div class="pg-stat pg-gap" title="The fit with the reference Tauc card's baseline taken out of F(R)">NRMSE (subtracted): <b id="${p}RMSE1s">-</b></div>
            <div class="pg-stat" title="The fit with the reference Tauc card's baseline taken out of F(R)">R² (subtracted): <b id="${p}R21s">-</b></div>
            <div class="pg-result">
              <div class="pg-stat">E<sub>U</sub>: <b id="${p}Eu">-</b></div>
              <div class="pg-stat">E<sub>U</sub> (subtracted): <b id="${p}EuS">-</b></div>
            </div>
          </div>
          <div id="${p}Alert"></div>${suggestBtn(p, "Place the Urbach region from 1 eV below the middle of the reference's Tauc linear region to where that region starts (with no reference: at 25% and 75% of the span)")}
        </div>
      </div>`;
}
// A card's body for its kind, its elements' ids its prefix 'an' + its id and a suffix.
export const cardBody = (a, u)=> ({ tauc: taucBody, urbach: urbachBody }[a.type])('an' + a.id, u);

/* A card's section of the Results, for its kind. A Tauc card's: its plot and its E_g chart
   side by side. An Urbach card's: the plain plot and the subtracted one side by side
   (each φ : 1), and each one's E_U chart under it, as wide: plain R1 over R2, subtracted
   R3 over R4. Their rows shared (cap-row), so the charts start level whatever lies
   between. */
export function resHtml(a, u){
  const p = 'an' + a.id;
  if (a.type !== 'tauc') return `
        <h4 class="res-an-title"></h4>
        <div class="row res-row cap-row urb-row">
          <div class="col">
            <p class="txt-caption">Urbach Plot: plain</p>
            ${box(u, p + 'R1', p + 'RL1', true)}
            <div><div id="${p}RL1" class="legend"></div></div>
            <p class="txt-caption">Urbach Energy: plain</p>
            ${box(u, p + 'R2', p + 'RL2', true)}
            <div id="${p}RL2" class="legend"></div>
            <div id="${p}RA" class="bar-alert"></div>
          </div>
          <div class="col">
            <p class="txt-caption">Urbach Plot: subtracted</p>
            ${box(u, p + 'R3', p + 'RL3', true)}
            <div><div id="${p}RL3" class="legend"></div><p id="${p}RS" class="txt-meta" hidden></p></div>
            <p class="txt-caption">Urbach Energy: subtracted</p>
            ${box(u, p + 'R4', p + 'RL4', true)}
            <div id="${p}RL4" class="legend"></div>
            <div id="${p}RA4" class="bar-alert"></div>
          </div>
        </div>`;
  return `
        <h4 class="res-an-title"></h4>
        <div class="row res-row">
          <div class="col">
            <p class="txt-caption">Tauc Plot</p>
            ${box(u, p + 'R1', p + 'RL1', true)}
            <div id="${p}RL1" class="legend"></div>
          </div>
          <div class="col">
            <p class="txt-caption" id="${p}BarTitle">Energy Band Gap</p>
            ${box(u, p + 'R2', p + 'RL2', true, `\n              <span class="plot-chips" id="${p}EgSel"></span>`)}
            <div id="${p}RL2" class="legend"></div>
            <div id="${p}RA" class="bar-alert"></div>
          </div>
        </div>`;
}

/* The file list's note, right of the label (to v501 a column of its own left of it): how
   the file was read, %R (the reflectance in percent, converted to F(R)) or F(R), its title
   saying it in full: the second column of the standard format; in any other, the column
   its header names (to v509 the second column there too), and a format not standard. A
   project saved before the R% reading holds none: F(R), as it was read. */
const READS = { R: ['%R', 'read as the reflectance in %, converted to F(R)'], F: ['F(R)', 'read as F(R)'] };
export function readNote(f, u){
  const [t, how] = READS[f.read === 'R%' ? 'R' : 'F'], w = f.warn && warnOf(f);
  const title = !w ? `second column ${how}` : w === 'none' ? `second column ${how}, with no header naming it` : `the ${t} column its header names, ${how}; not a standard format`;
  return `<span title="${u.esc(title)}">${u.esc(t)}</span>`;
}

/* ---- Alerts ---- */
// A card's lines holding fewer points with a value than a window.
export const TOO_SMALL = '<div class="alert warn">⚠ Interval too small: too few points for the regression.</div>';
// An Urbach card's subtracted fit that the Tauc baseline blocks (subtracted: its counts).
export const blockedHtml = sb => `<div class="alert warn">⚠ No subtracted fit: the Tauc baseline lies above F(R) at ${sb.lost} of the ${sb.inside} points between the lines${sb.neg ? ' with F(R) > 0' : ''}, where F(R) − F<sub>b</sub> has no logarithm.</div>`;
// Negative values → one alert per series on show, under its chart, listing the
// affected samples (`files`, by label) one per line. Live-computed → no X. An error (v567,
// a warning to v566): a negative E_g or E_U is no result, and its bar is not drawn.
export function negWarnHtml(files, vals, what, u){
  const list = files.filter((f,k)=> isFinite(vals[k]) && vals[k] < 0).map(f=>u.esc(f.label));
  return list.length ? `<div class="alert bad">✕ Negative ${what} for:<br>${list.join('<br>')}</div>` : '';
}
