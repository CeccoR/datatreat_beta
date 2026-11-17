/* A look, not a search: measureWidths on the isotropic fit (its cost and its rows). */
import { measureWidths } from '../h/eng/xrd-widths.js';
export default {
  name: 'peekwidths',
  search(model, k, res, free, opts, E){
    const e0 = E.FS.evals, t0 = Date.now();
    const mw = measureWidths(model, res, { irf: opts.irf });
    console.log('measureWidths', E.FS.evals - e0, 'evals', Date.now() - t0, 'ms');
    const ph = mw.phases[0];
    for (const r of ph.rows) console.log(r.label, r.tt && r.tt.toFixed(2), 'Hs', r.Hs && r.Hs.toFixed(4), '±', r.HsEsd && r.HsEsd.toFixed(4), r.unread || '', r.overlapped ? 'ovl' : '', r.edge ? 'edge' : '', r.weak ? 'weak' : '', r.flat ? 'flat' : '', 'hkl', JSON.stringify(r.hkl));
    E.setParams(model, model.v);
    return null;
  },
};
