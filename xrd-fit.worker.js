/* =========================================================
   XRD FIT WORKER
   Runs the heavy multi-start Levenberg–Marquardt whole-pattern
   fit off the main thread. Progress is streamed back as messages.
========================================================= */
import { multiStartFit } from './xrd-fit-core.js';

self.addEventListener('message', async (e)=>{
  const { id, x, y, active, snip, hp } = e.data || {};
  try {
    const res = await multiStartFit(x, y, active, snip, hp, frac=>{
      self.postMessage({ id, type:'progress', frac });
    });
    self.postMessage({ id, type:'result', res });
  } catch (err){
    self.postMessage({ id, type:'error', message: String((err && err.message) || err) });
  }
});
