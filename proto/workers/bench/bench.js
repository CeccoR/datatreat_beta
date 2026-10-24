/* global PerformanceObserver */
/* The pool's bench: the app's own pool (xrd-rv-pool.js lanes, as Refine all calls it), the
   app's worker (xrd-rietveld.worker.js) and the card's payloads (xrd-rv-model.js
   payloadFor), without the card: for settings the measurement scripts cannot reach through
   the page (a heavy refinement) and for the grid of cores × workers (measure/cores.mjs).
   Served from a tree with pool.patch applied, this folder and ../fixtures copied into it as
   bench/ (README). The cap is the page's localStorage 'datatreat-rv-workers', set before it
   loads (one page a k). */
import { readXrdmlScans, decodeXml } from '../xrd-instr.js';
import * as M from '../xrd-rv-model.js';
import { lanes, poolCfg, poolNow } from '../xrd-rv-pool.js';

const NAMES = Array.from({ length: 12 }, (_, i)=> 's' + String(i).padStart(2, '0') + '.xrdml');
let files = null, cifText = null;
async function load(){
  if (files) return;
  cifText = await (await fetch('fixtures/SrTiO3.cif')).text();
  files = [];
  for (const n of NAMES){
    const raw = new Uint8Array(await (await fetch('fixtures/xrd/' + n)).arrayBuffer());
    const xml = new DOMParser().parseFromString(decodeXml(raw), 'text/xml');
    const sc = readXrdmlScans(xml)[0];
    files.push({ name: n, label: n.replace(/\.xrdml$/, ''), x: Object.freeze(Array.from(sc.x)), y: Object.freeze(Array.from(sc.y)), rawBytes: raw,
      ...(sc.varMul ? { varMul: Object.freeze(Array.from(sc.varMul)) } : {}) });
  }
}
// default: the card's defaults (a Lorentzian size, an isotropic strain). heavy: a free
// ellipsoid, ΔB and Sr1's occupancy, with the standard's profile (s11 refined as the
// standard, SrTiO3 its phase, as tests/rvlock does: a profile to cost, not to read).
const OVER = { default: null, heavy: { on: { adp: true, occ: true }, dep: { size: 'ellipsoid', adp: 'overall', occ: 'Sr1' } } };
function phaseOf(over){
  const q = { id: 1, ...M.defSettings(), color: '#d4a72c', prep: M.prepOf(cifText, 'SrTiO3.cif'), off: {} };
  if (over){ q.on = { ...q.on, ...(over.on || {}) }; q.dep = { ...q.dep, ...(over.dep || {}) }; }
  return q;
}
let IRF = null, conf = 'default';
const runOf = std => ({ ph: [phaseOf(OVER[conf])], std: { ...phaseOf(null), ...M.stdSettings() }, start: 'cif', hold: M.HOLD_DEFAULT.slice(), fit: {},
  irf: std ? null : (conf === 'heavy' ? IRF : null), fell: [], bgFreed: [], n: 12, done: 0 });
const sig = r => JSON.stringify({ p: r.params, e: r.esd, s: r.stats, t: r.table, w: r.widths, sh: r.shapes });
let longs = [];
try { new PerformanceObserver(l=> l.getEntries().forEach(e=> longs.push(e.duration))).observe({ type: 'longtask', buffered: false }); } catch(e){}

window.setup = async c =>{
  conf = c; await load();
  if (conf === 'heavy' && !IRF){
    const run = runOf(true), f = files[11];
    const L = lanes(1, { payload: ()=>{ const p = M.payloadFor(f, run, {}, true); delete p.list; return { pay: p, ctx: null }; },
      write: (k, res)=>{ IRF = M.irfOf(f, { [f.name]: M.resultRecord(res, [run.std], true, Date.now()) }); } });
    const { error } = await L.done;
    if (error) throw error;
  }
  return { cfg: poolCfg(), irf: !!IRF };
};
/* One Refine all of the 12 on the pool's lanes (max: at most so many; the cap is the
   pool's): its wall time, each job's start and end (from the lanes' start and done) and
   lane count at its start, the results' signatures in the order written. */
window.run = async (max)=>{
  await load();
  const run = runOf(false), out = [], at = new Array(12), order = [];
  longs = [];
  const t0 = performance.now();
  let busy = 0;
  const L = lanes(12, { max,
    payload: k =>{ const p = M.payloadFor(files[k], run, {}, false); delete p.list; at[k] = { start: performance.now() - t0, busyAtStart: ++busy }; return { pay: p, ctx: k }; },
    write: (k, res)=>{ order.push(k); out[k] = { sig: sig(res), engineMs: res.ms }; },
    progress: (frac, on, k, stage, what)=>{ if (what === 'done'){ at[k].end = performance.now() - t0; busy--; } },
  });
  const { error } = await L.done;
  const wall = performance.now() - t0;
  if (error) throw error;
  return { wall, order, jobs: out.map((o, k)=> ({ name: files[k].name, ...o, ...at[k], ms: at[k].end - at[k].start })), longs: longs.slice(), pool: poolNow() };
};
// The main thread meanwhile: a fixed piece of work (about 10 ms on an idle machine) every
// 200 ms, its duration; and the intervals between animation frames.
let probeOn = false;
function work(n){ let s = 0; for (let i = 0; i < n; i++) s += Math.sqrt(i ^ (s & 1023)); return s; }
window.calibrate = ()=>{ let n = 1e6; for (;;){ const t = performance.now(); work(n); const d = performance.now() - t; if (d > 10) return Math.round(n*10/d); n *= 2; } };
window.probeStart = N =>{
  probeOn = true; const w = [], fr = []; let last = performance.now();
  const tick = ()=>{ if (!probeOn) return; const t = performance.now(); fr.push(t - last); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const iv = setInterval(()=>{ const t = performance.now(); work(N); w.push(performance.now() - t); }, 200);
  window.probeStop = ()=>{ probeOn = false; clearInterval(iv); return { work: w, frames: fr }; };
};
window.benchReady = true;
