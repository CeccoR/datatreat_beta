/* =========================================================
   EPR — its words and markup that need no page (epr.js puts them in the cards and the
   alerts; tests/eprmodel.test.mjs reads them in Node): a Stacked Spectra card's
   instructions and body, the alert's title for a lone half of a pair. Taken out of v562's
   epr.js as they were: the same markup to the byte.
   What they need from the page is handed in, u = { plotWrap, NORM_OPTIONS } (modcharts.js's
   plot box, utils.js's normalisations' options: epr.js HU), and the cards' own
   instructions (cards.js cardInfo) where a card's end with them.
========================================================= */
import { DEF } from './epr-model.js';

/* ---- A card's instructions (ending with the cards' own: `tail`, cards.js cardInfo) ---- */
export const eprInfo = tail => `Spectra are stacked for visual comparison, each normalized to the largest peak-to-peak (global) or to its own (local), or left as they are (none: the stacking only spaces them). The <b>smoothing</b> takes at each point the mean of the line through the points over a window w wide (mT, on the field as plotted) centred on it, a box convolution, cut short at the ends; 0 is none. Being a width on the field axis, one setting smooths alike spectra recorded at different steps; its field shows beside it the points it spans at their steps (a range when the steps differ). The field axis is each spectrum's field <b>rescaled to 9.5 GHz</b>, B·(9.5 GHz / ν) with ν the microwave frequency of its .DSC (MWFQ), so that spectra recorded at different frequencies line up by g; the CSV gives the field the same way (Bfield_mT_at_9.5GHz). The top axis reads <b>g = hν / (μ<sub>B</sub>·B)</b> at 9.5 GHz. A file without its frequency is shown on the field it was measured at, and then no g axis can be drawn. ${tail}`;
// A card's elements' ids' prefix.
export const P = a => 'epr' + a.id;
export const cardBody = (a, u)=> `
      <div class="row" style="align-items:flex-start">
        <div class="col mw520" style="flex:2">${u.plotWrap(P(a) + 'Svg', { mod: 'epr', csv: 'epr_spectra.csv', name: 'EPR.svg', legend: P(a) + 'Legend' })}
          <div id="${P(a)}Legend" class="legend"></div>
        </div>
        <div class="col mw260" style="align-self:flex-start">
          <div class="txt-mini param-head aligned-tb cap-title"><span>Parameters</span></div>
          <div class="param-grid">
            <label class="txt-label" for="${P(a)}Norm">Normalization</label>
            <select id="${P(a)}Norm" class="pg-field">${u.NORM_OPTIONS}</select>
            <label class="txt-label" for="${P(a)}Smooth">Smoothing width (mT)</label>
            <label class="pg-field wfield" title="The smoothing box's width, in mT on the plotted field (0: none); beside it, the points it spans at the spectra's steps"><input type="text" inputmode="decimal" id="${P(a)}Smooth" value="${DEF.smoothW}" autocomplete="off" aria-describedby="${P(a)}SmoothPts"><span class="wf-pts" id="${P(a)}SmoothPts"></span></label>
          </div>
        </div>
      </div>`;
