// Rietveld worker bench: the card's payloads (xrd-rv-model.js payloadFor), the app's
// worker (xrd-rietveld.worker.js) run serially in one worker, or over a pool of k.
import { readXrdmlScans, decodeXml } from '../xrd-instr.js';
import * as M from '../xrd-rv-model.js';

const NAMES = Array.from({ length: 12 }, (_, i)=> 's' + String(i).padStart(2, '0') + '.xrdml');
let files = null, cifText = null;
async function load(){
  if (files) return;
  cifText = await (await fetch('SrTiO3.cif')).text();
  files = [];
  for (const n of NAMES){
    const raw = new Uint8Array(await (await fetch(n)).arrayBuffer());
    const xml = new DOMParser().parseFromString(decodeXml(raw), 'text/xml');
    const sc = readXrdmlScans(xml)[0];
    const x = Object.freeze(Array.from(sc.x)), y = Object.freeze(Array.from(sc.y));
    files.push({ name: n, label: n.replace(/\.xrdml$/, ''), x, y, rawBytes: raw, ...(sc.varMul ? { varMul: Object.freeze(Array.from(sc.varMul)) } : {}) });
  }
}
// settings: 'default' (size iso, strain iso) or an object merged into the phase's on/dep
function phaseOf(over){
  const d = M.defSettings();
  const q = { id: 1, ...d, color: '#d4a72c', prep: M.prepOf(cifText, 'SrTiO3.cif'), off: {} };
  if (over){ q.on = { ...q.on, ...(over.on || {}) }; q.dep = { ...q.dep, ...(over.dep || {}) }; }
  return q;
}
let IRF = null;
function payloads(over, std = false, which = null, irf = false){
  const q = phaseOf(over);
  const stdQ = { ...phaseOf(null), ...M.stdSettings() };
  const run = { ph: [q], std: stdQ, start: 'cif', hold: M.HOLD_DEFAULT.slice(), fit: {}, irf: irf ? IRF : null, fell: [], bgFreed: [], n: 12, done: 0 };
  const fs = which ? which.map(i=> files[i]) : files;
  return fs.map(f=>{ const p = M.payloadFor(f, run, {}, std); delete p.list; return { name: f.name, p }; });
}
const WURL = new URL('../xrd-rietveld.worker.js', import.meta.url);
let pool = [];
function newWorker(){ return new Worker(WURL, { type: 'module' }); }
function killAll(){ pool.forEach(w=> w.terminate()); pool = []; }
let jobId = 0;
function job(w, p){
  const id = ++jobId, t0 = performance.now();
  return new Promise((res, rej)=>{
    let nprog = 0;
    const on = e =>{ const d = e.data; if (!d || d.id !== id) return;
      if (d.type === 'progress'){ nprog++; return; }
      w.removeEventListener('message', on);
      const t1 = performance.now();
      if (d.type === 'result') res({ ms: t1 - t0, nprog, res: d.res, engineMs: d.res.ms });
      else rej(new Error(d.message)); };
    w.addEventListener('message', on);
    w.addEventListener('error', e=> rej(new Error(e.message || 'worker error')), { once: true });
    w.postMessage({ id, ...p });
  });
}
// The longtasks seen meanwhile.
let longs = [];
try { new PerformanceObserver(l=> l.getEntries().forEach(e=> longs.push(e.duration))).observe({ type: 'longtask', buffered: false }); } catch(e){}
const sig = r => JSON.stringify({ p: r.params, e: r.esd, s: r.stats, t: r.table, w: r.widths, sh: r.shapes });
// Run every payload over k workers (a queue: each free worker takes the next, in order).
// fresh: new workers for this run (else the pool's, kept warm). perJobFresh: a new worker each job.
// The standard: s11 refined in the standard's role (SrTiO3 its phase, as tests/rvlock does),
// its profile (irfOf) kept for the samples' payloads (irf: true).
window.refineStd = async function(){
  await load();
  const w = newWorker(), f = files[11], pay = payloads(null, true, [11])[0];
  const r = await job(w, pay.p); w.terminate();
  const stdQ = { ...phaseOf(null), ...M.stdSettings() };
  const rec = M.resultRecord(r.res, [stdQ], true, Date.now());
  IRF = M.irfOf(f, { [f.name]: rec });
  return { ms: r.ms, irf: IRF, resBytes: JSON.stringify(r.res).length };
};
window.bench = async function({ k = 1, over = null, fresh = false, perJobFresh = false, keep = true, std = false, which = null, irf = false } = {}){
  await load();
  const pays = payloads(over, std, which, irf);
  if (fresh) killAll();
  while (pool.length < k) pool.push(newWorker());
  const ws = pool.slice(0, k);
  longs = [];
  const out = new Array(pays.length);
  let next = 0;
  const t0 = performance.now();
  const lane = async (wi)=>{
    while (next < pays.length){
      const i = next++;
      let w = ws[wi];
      if (perJobFresh){ w.terminate(); w = ws[wi] = pool[wi] = newWorker(); }
      const t = performance.now() - t0;
      const r = await job(w, pays[i].p);
      out[i] = { name: pays[i].name, lane: wi, start: t, ms: r.ms, engineMs: r.engineMs, nprog: r.nprog, sig: sig(r.res), resBytes: JSON.stringify(r.res).length, payBytes: JSON.stringify(pays[i].p).length,
        rwp: r.res.stats && r.res.stats.Rwp, a: r.res.params && r.res.params['p1.a'] };
    }
  };
  await Promise.all(ws.map((_, i)=> lane(i)));
  const wall = performance.now() - t0;
  if (!keep) killAll();
  return { k, wall, jobs: out, longs: longs.slice() };
};
window.killAll = killAll;
window.poolSize = ()=> pool.length;
window.benchReady = true;

// The main thread meanwhile: a fixed piece of work (a loop of N steps, about 10 ms on an
// idle machine) every 200 ms, its duration; and the intervals between animation frames.
let probeOn = false;
function work(n){ let s = 0; for (let i = 0; i < n; i++) s += Math.sqrt(i ^ (s & 1023)); return s; }
window.calibrate = ()=>{ let n = 1e6; for (;;){ const t = performance.now(); work(n); const d = performance.now() - t; if (d > 10) return Math.round(n*10/d); n *= 2; } };
window.probeStart = (N)=>{
  probeOn = true; const w = [], fr = []; let last = performance.now();
  const tick = ()=>{ if (!probeOn) return; const t = performance.now(); fr.push(t - last); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const iv = setInterval(()=>{ const t = performance.now(); work(N); w.push(performance.now() - t); }, 200);
  window.probeStop = ()=>{ probeOn = false; clearInterval(iv); return { work: w, frames: fr }; };
};
