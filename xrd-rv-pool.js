/* The Rietveld workers' pool (backlog 23): every refinement of the page runs its patterns
   in the workers of one pool, and every page of the app open in the browser (a window, a
   live tab's frame) shares one cap of jobs at once.

   - A job is one pattern in one worker (xrd-rietveld.worker.js runs a message to its end:
     k patterns at once take k workers). It waits for a slot, then takes an idle worker of
     this page or makes one; at its end the worker goes back idle and the slot is free.
     Cancel terminates the worker (the only way to stop the engine) and frees the slot.
   - The slots: CAP of them for the whole browser, as Web Locks named 'datatreat-rv-slot-i'
     (navigator.locks: one origin, every window and frame of it; a page closed or a frame
     removed lets its locks go). A job asks for every slot at once and takes the first it is
     given, the others' requests withdrawn: the oldest job waiting gets the first slot
     freed, whichever page it is in. Without Web Locks (an old browser, not a secure page),
     or with 'datatreat-rv-shared' set to 'off', the cap holds within the page alone.
   - Workers left idle for IDLE seconds are terminated (the engine's caches with them).
   - lanes(): a run's patterns on several jobs at once, its results written in the
     patterns' order (each once those before it are), so that a run of several lanes
     writes what a run of one does, key order included.

   The knobs, localStorage 'datatreat-rv-<k>' (read once, as the first job asks):
   workers  the cap (default: the cores less one, navigator.hardwareConcurrency − 1, at
            least 1: the page's own thread keeps a core);
   lanes    a run's lanes at most (default: the cap; 1: a run's patterns one after the
            other, as up to v517);
   shared   'off': the cap per page, not shared through Web Locks;
   idle     seconds an idle worker is kept (default 60).
   Up to v517 each Rietveld card had a worker of its own, its patterns one after the other,
   and nothing capped the workers of several cards. */
const URL_W = new URL('./xrd-rietveld.worker.js', import.meta.url);
const knob = k =>{ try { return localStorage.getItem('datatreat-rv-' + k); } catch(e){ return null; } };
const int = (k, d)=>{ const v = parseInt(knob(k), 10); return v > 0 ? v : d; };
let CFG = null;
function cfg(){
  if (CFG) return CFG;
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2;
  const cap = int('workers', Math.max(1, cores - 1));
  CFG = { cap, lanes: Math.min(cap, int('lanes', cap)), idle: int('idle', 60)*1000,
    shared: knob('shared') !== 'off' && typeof navigator !== 'undefined' && !!navigator.locks && typeof AbortController !== 'undefined' };
  return CFG;
}
// The pool's settings: the cap, a run's lanes, whether the cap is shared with the other pages.
export const poolCfg = ()=> ({ ...cfg() });

/* ---- The slots ---- */
let local = 0;                    // slots held by this page, when not shared
const localQ = [];                // jobs of this page waiting for one (their grant), in order
/* A slot: resolves to its release (call it once), or rejects when the signal is aborted
   first. */
function slot(signal){
  const c = cfg();
  if (!c.shared){
    return new Promise((resolve, reject)=>{
      const grant = ()=>{ local++; let once = false; resolve(()=>{ if (once) return; once = true; local--; const n = localQ.shift(); if (n) n(); }); };
      if (local < c.cap){ grant(); return; }
      const wait = ()=>{ signal.removeEventListener('abort', gone); grant(); };
      const gone = ()=>{ const i = localQ.indexOf(wait); if (i >= 0) localQ.splice(i, 1); reject(new Error('withdrawn')); };
      localQ.push(wait); signal.addEventListener('abort', gone, { once: true });
    });
  }
  return new Promise((resolve, reject)=>{
    const ask = new AbortController();
    let won = false;
    const gone = ()=>{ if (!won){ ask.abort(); reject(new Error('withdrawn')); } };
    signal.addEventListener('abort', gone, { once: true });
    for (let i = 0; i < c.cap; i++){
      navigator.locks.request('datatreat-rv-slot-' + i, { signal: ask.signal }, ()=>{
        // (given after another: let it go at once; the job's own is held until its release)
        if (won || signal.aborted) return;
        won = true; ask.abort(); signal.removeEventListener('abort', gone);
        return new Promise(free=> resolve(free));
      }).catch(()=>{});      // (the requests withdrawn: AbortError)
    }
  });
}

/* ---- The workers of this page ---- */
const idle = [];                  // { w, t: its timer }, the last freed last
let alive = 0;                    // made and not terminated (idle or busy)
function take(){
  const e = idle.pop();
  if (e){ clearTimeout(e.t); return e.w; }
  alive++;
  return new Worker(URL_W, { type: 'module' });
}
function giveBack(w){
  const e = { w, t: setTimeout(()=>{ const i = idle.indexOf(e); if (i >= 0){ idle.splice(i, 1); kill(w); } }, cfg().idle) };
  idle.push(e);
}
function kill(w){ try { w.terminate(); } catch(e){} alive--; }
// Workers made for the next jobs (their module loaded and evaluated meanwhile): up to n
// idle in all, never past the cap. (The standard refined before the samples: theirs warm.)
export function warm(n){
  n = Math.min(n, cfg().cap);
  while (idle.length < n && alive < cfg().cap){ alive++; giveBack(new Worker(URL_W, { type: 'module' })); }
}
// What the pool holds now: workers made (idle or busy), idle, jobs waiting for a slot here.
export const poolNow = ()=> ({ alive, idle: idle.length, waiting: localQ.length });

/* ---- A job ---- */
let ids = 0;
/* One pattern (the worker's payload) in a worker of the pool. Returns { done, cancel }:
   done resolves to the worker's result, or null once cancelled (cancel: the worker
   terminated, nothing of its answer after; a job still waiting for a slot withdrawn), and
   rejects with the worker's error. onProgress(frac, stage) as the worker says. */
export function job(payload, onProgress){
  const ac = new AbortController();
  let w = null, free = null, over = false, onMsg = null, onErr = null, ok, ko;
  const done = new Promise((a, b)=>{ ok = a; ko = b; });
  const end = dead =>{
    if (over) return; over = true;
    if (w){ w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); if (dead) kill(w); else giveBack(w); w = null; }
    if (free){ free(); free = null; }
  };
  slot(ac.signal).then(f=>{
    if (over){ f(); return; }
    free = f; w = take();
    const id = ++ids;
    onMsg = e =>{
      const d = e.data; if (over || !d || d.id !== id) return;
      if (d.type === 'progress'){ if (onProgress) onProgress(d.frac, d.stage); return; }
      end(false);
      if (d.type === 'result') ok(d.res); else ko(new Error(d.message || 'Refinement failed'));
    };
    onErr = e =>{ if (over) return; end(true); ko(new Error(e.message || 'The refinement worker failed')); };
    w.addEventListener('message', onMsg);
    w.addEventListener('error', onErr);
    w.postMessage({ id, ...payload });
  }, ()=>{});
  return { done, cancel(){ if (over) return; ac.abort(); end(true); ok(null); } };
}

/* ---- A run's lanes ----
   n patterns on lanes (at most the pool's lanes, one a pattern): each lane takes the next
   pattern (payload(k) → { pay, ctx }, built as it is taken, in the patterns' order) and
   waits for its job. write(k, res, ctx) is called in the patterns' order, each once those
   before it are written; progress(frac, on, k, stage, what) as the run goes on (frac: its
   share done; on: the patterns under way, in order; what: 'start' as pattern k is taken,
   'progress' as its worker says how far it is (stage: its word, or ''), 'done' as it ends).
   An error (a job's, or payload's) stops the patterns not yet taken; those under way end
   and are written, the failed one not; done then resolves to { error }.
   stop(): every job under way cancelled, nothing of their answers after, and those done
   but held behind one under way written at once, in order (a Cancel keeps what was done).
   Returns { done: Promise<{ error }>, stop, on: ()=> the patterns under way }. */
export function lanes(n, { payload, write, progress, max }){
  const m = Math.max(1, Math.min(n, max || cfg().lanes));
  const got = new Array(n), on = new Map(), jobs = new Set();
  let next = 0, flushed = 0, ended = 0, failed = null, stopped = false;
  const flush = all =>{
    while (flushed < n && (got[flushed] !== undefined || (all && flushed < next))){
      const d = got[flushed++];
      if (d) write(d.k, d.res, d.ctx);
    }
  };
  const under = ()=> [...on.keys()].sort((a, b)=> a - b);
  const tell = (k, stage, what)=>{ if (!progress) return; let s = 0; on.forEach(v=>{ s += v; }); progress((ended + s)/n, under(), k, stage || '', what); };
  const lane = async ()=>{
    while (!stopped && !failed && next < n){
      const k = next++;
      let j = null;
      try {
        const { pay, ctx } = payload(k);
        on.set(k, 0); tell(k, '', 'start');
        j = job(pay, (f, stage)=>{ if (on.has(k)){ on.set(k, f); tell(k, stage, 'progress'); } });
        jobs.add(j);
        const res = await j.done;
        jobs.delete(j); on.delete(k);
        if (stopped || res == null) return;
        got[k] = { k, res, ctx }; ended++;
        flush();
        tell(k, '', 'done');
      } catch(e){
        if (j) jobs.delete(j); on.delete(k);
        if (stopped) return;
        failed = failed || e; got[k] = null; ended++;
        flush();
        return;
      }
    }
  };
  const done = Promise.all(Array.from({ length: m }, lane)).then(()=> ({ error: failed }));
  return { done, on: under,
    stop(){ if (stopped) return; stopped = true; jobs.forEach(j=> j.cancel()); jobs.clear(); on.clear(); flush(true); } };
}
