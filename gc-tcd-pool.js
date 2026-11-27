/* =========================================================
   GC-TCD POOL (v544)
   Many chromatograms integrated over a few module workers (gc-tcd.worker.js), as the
   Rietveld pool makes them (new Worker(URL, { type: 'module' }), same origin: CSP
   script-src 'self'). Each worker takes the next chromatogram as it ends one; the results
   come back in the jobs' order whatever order they end in.

   integrateMany(jobs, { workers, onProgress, signal, makeWorker })
     jobs: one per chromatogram, { t, y, method }: its time (s) and signal (NaN where blank,
       as readTcd gives), and the method it is integrated with (none: the engine's default).
       Several files and methods in one call (v578: the Integration cards' job, its workers
       kept from one file to the next; to v577 a call a file, its workers made anew).
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
   Not under the Rietveld pool's cap (xrd-rv-pool.js, Web Locks): a GC run and a refinement
   at once each take cores − 1.
========================================================= */
const URL_W = new URL('./gc-tcd.worker.js', import.meta.url);

function poolSize(){
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2;
  return Math.max(1, cores - 1);
}

const abortError = ()=>{
  const D = globalThis.DOMException;
  if (D) return new D('The integration was cancelled.', 'AbortError');
  const err = new Error('The integration was cancelled.'); err.name = 'AbortError'; return err;
};

export function integrateMany(jobs, { workers, onProgress, signal, makeWorker } = {}){
  const n = jobs.length;
  const results = new Array(n), ms = new Array(n).fill(NaN);
  if (!n) return Promise.resolve({ results, ms, wall: 0 });
  if (signal && signal.aborted) return Promise.reject(abortError());
  const make = makeWorker || (()=> new Worker(URL_W, { type: 'module' }));
  const W = Math.max(1, Math.min(n, workers || poolSize()));
  const T0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  // (each time made a plain array once, whichever chromatograms share it)
  const plain = new Map(), tOf = t =>{ let p = plain.get(t); if (!p) plain.set(t, p = Array.from(t)); return p; };
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
        const j = jobs[k];
        w.postMessage({ id: k, t: tOf(j.t), y: Array.from(j.y), method: j.method });
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
