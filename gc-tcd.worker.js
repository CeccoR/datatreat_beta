/* =========================================================
   GC-TCD WORKER (v544)
   Integrates one chromatogram a message with gc-tcd.js, off the page's thread:
   { id, t, y, method } → { id, type: 'result', res, ms } or { id, type: 'error', message }.
   A module worker of the app's own origin, as xrd-rietveld.worker.js (CSP script-src 'self').
========================================================= */
import { integrateChromatogram, DEFAULT_METHOD } from './gc-tcd.js';

self.addEventListener('message', e=>{
  const { id, t, y, method } = e.data || {};
  try {
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const res = integrateChromatogram(t, y, method || DEFAULT_METHOD);
    const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    self.postMessage({ id, type: 'result', res, ms });
  } catch(err){
    self.postMessage({ id, type: 'error', message: String((err && err.message) || err) });
  }
});
