/* =========================================================
   GC-TCD POOL (prototype)
   Many chromatograms integrated over a few module workers (gc-tcd.worker.js), as the
   Rietveld pool makes them (new Worker(URL, { type: 'module' }), same origin: CSP
   script-src 'self'). Each worker takes the next chromatogram as it ends one; the results
   come back in the columns' order whatever order they end in.

   integrateMany(t, cols, { method, workers, onProgress, signal, makeWorker })
     t: the time (s); cols: one array per chromatogram (NaN where blank, as readTcd gives).
     workers: how many (default navigator.hardwareConcurrency − 1, at least 1: the page
       keeps a core); never more than the chromatograms.
     onProgress(done, total, k, res): after each chromatogram k ends (res its result, or
       { error } when its worker failed).
     signal: an AbortSignal; aborted, every worker is terminated (the only way to stop the
       engine mid-fit) and the promise rejects with an AbortError.
     makeWorker(): a factory for something Worker-like (postMessage, addEventListener,
       removeEventListener, terminate), for tests and Node; default the module worker.
   → Promise of { results: [...] (integrateChromatogram's, or { error }), ms: [per
     chromatogram, in its worker], wall } .
   A chromatogram whose worker fails gets { error } and a fresh worker takes the next one.
   Not shared with the Rietveld pool's cap (Web Locks): when wired into the app, a GC run
   and a refinement at once would each take cores − 1.
========================================================= */
const URL_W = new URL('./gc-tcd.worker.js', import.meta.url);

export function poolSize(){
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2;
  return Math.max(1, cores - 1);
}

const abortError = ()=>{
  const D = globalThis.DOMException;
  if (D) return new D('The integration was cancelled.', 'AbortError');
  const err = new Error('The integration was cancelled.'); err.name = 'AbortError'; return err;
};

export function integrateMany(t, cols, { method, workers, onProgress, signal, makeWorker } = {}){
  const n = cols.length;
  const results = new Array(n), ms = new Array(n).fill(NaN);
  if (!n) return Promise.resolve({ results, ms, wall: 0 });
  if (signal && signal.aborted) return Promise.reject(abortError());
  const make = makeWorker || (()=> new Worker(URL_W, { type: 'module' }));
  const W = Math.max(1, Math.min(n, workers || poolSize()));
  const T0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const tt = Array.from(t);
  return new Promise((resolve, reject)=>{
    let next = 0, done = 0, over = false;
    const live = new Set();
    const finish = (err)=>{
      if (over) return; over = true;
      live.forEach(e=> e.stop());
      live.clear();
      if (signal) signal.removeEventListener('abort', onAbort);
      if (err) reject(err);
      else resolve({ results, ms, wall: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - T0 });
    };
    const onAbort = ()=> finish(abortError());
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    const record = (k, res, time)=>{
      results[k] = res; if (Number.isFinite(time)) ms[k] = time;
      done++;
      if (onProgress){ try { onProgress(done, n, k, res); } catch(e){ /* a progress callback's error is its own */ } }
      if (done === n) finish(null);
    };
    // A lane: one worker taking chromatograms one after the other.
    const lane = ()=>{
      if (over || next >= n) return;
      let w;
      try { w = make(); } catch(e){ finish(e); return; }
      let k = -1;
      const entry = { stop(){ w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); try { w.terminate(); } catch(e){ /* gone */ } } };
      live.add(entry);
      const take = ()=>{
        if (over) return;
        if (next >= n){ live.delete(entry); entry.stop(); return; }
        k = next++;
        w.postMessage({ id: k, t: tt, y: Array.from(cols[k]), method });
      };
      const onMsg = e =>{
        const d = e.data;
        if (over || !d || d.id !== k) return;
        if (d.type === 'result') record(k, d.res, d.ms);
        else record(k, { error: d.message || 'The integration failed' }, NaN);
        take();
      };
      const onErr = e =>{
        if (over) return;
        if (e && e.preventDefault) e.preventDefault();
        live.delete(entry); entry.stop();
        const failed = k;
        if (failed >= 0) record(failed, { error: (e && e.message) || 'The integration worker failed' }, NaN);
        if (!over) lane();                // a fresh worker for the rest
      };
      w.addEventListener('message', onMsg);
      w.addEventListener('error', onErr);
      take();
    };
    for (let i = 0; i < W; i++) lane();
  });
}
