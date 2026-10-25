import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import os from 'node:os';
export const BASE = process.env.BASE || 'http://127.0.0.1:8983';
export const OUT = new URL('./results/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
export const med = a => { const s = a.slice().sort((x, y)=> x - y), n = s.length; return n ? (n % 2 ? s[(n - 1)/2] : (s[n/2 - 1] + s[n/2])/2) : NaN; };
export const pct = (a, p) => { const s = a.slice().sort((x, y)=> x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p*s.length))] : NaN; };
export const load = ()=> os.loadavg().map(x=> +x.toFixed(2));
// Others on the machine: processes over 20 % CPU that are not this script's browser.
export function others(){
  try { return fs.readFileSync('/proc/loadavg', 'utf8').trim(); } catch(e){ return ''; }
}
export async function open(){
  const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e=> errors.push(e.message));
  await page.goto(BASE + '/bench/bench.html');
  await page.waitForFunction(()=> window.benchReady);
  const cdp = await page.context().newCDPSession(page);
  const subs = new Map(); const pending = new Map(); let mid = 1000;
  cdp.on('Target.attachedToTarget', e=>{ if (e.targetInfo.type === 'worker') subs.set(e.sessionId, e.targetInfo); });
  cdp.on('Target.detachedFromTarget', e=> subs.delete(e.sessionId));
  cdp.on('Target.receivedMessageFromTarget', e=>{ const m = JSON.parse(e.message); const p = pending.get(m.id); if (p){ pending.delete(m.id); p(m); } });
  await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: false });
  const send = (sessionId, method, params = {})=> new Promise(res=>{ const id = ++mid; const t = setTimeout(()=>{ pending.delete(id); res({ error: 'timeout' }); }, 5000);
    pending.set(id, m=>{ clearTimeout(t); res(m); }); cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(()=> res({ error: 'gone' })); });
  const bcdp = await browser.newBrowserCDPSession();
  const rendererPid = async ()=> (await bcdp.send('SystemInfo.getProcessInfo')).processInfo.filter(p=> p.type === 'renderer').map(p=> p.id);
  const pids = await rendererPid();
  const status = pid =>{ const t = fs.readFileSync(`/proc/${pid}/status`, 'utf8'); const g = k => +((t.match(new RegExp(k + ':\\s+(\\d+)')) || [])[1] || 0)/1024; return { rss: g('VmRSS'), hwm: g('VmHWM') }; };
  // Memory after a forced GC: the page's heap, each worker's, the renderer's RSS and peak (MB).
  async function mem(gc = true){
    if (gc) await cdp.send('HeapProfiler.collectGarbage');
    const page = (await cdp.send('Runtime.getHeapUsage')).usedSize/1048576;
    const workers = [];
    for (const sid of subs.keys()){
      if (gc){ await send(sid, 'HeapProfiler.enable'); await send(sid, 'HeapProfiler.collectGarbage'); }
      const h = await send(sid, 'Runtime.getHeapUsage');
      if (h.result) workers.push(h.result.usedSize/1048576);
    }
    const st = pids.map(status);
    return { pageHeap: page, workerHeaps: workers, rss: st.reduce((t, s)=> t + s.rss, 0), hwm: st.reduce((t, s)=> t + s.hwm, 0) };
  }
  // The workers' heaps, sampled (no GC) every `every` ms until stop(): the largest each.
  function sampler(every = 100){
    let on = true; const peak = { worker: 0, sumWorkers: 0, rss: 0 };
    (async ()=>{ while (on){
      let sum = 0;
      for (const sid of [...subs.keys()]){ const h = await send(sid, 'Runtime.getHeapUsage'); if (h.result){ const u = h.result.usedSize/1048576; sum += u; if (u > peak.worker) peak.worker = u; } }
      if (sum > peak.sumWorkers) peak.sumWorkers = sum;
      const r = pids.map(status).reduce((t, s)=> t + s.rss, 0); if (r > peak.rss) peak.rss = r;
      await new Promise(r=> setTimeout(r, every)); } })();
    return ()=>{ on = false; return peak; };
  }
  return { browser, page, cdp, mem, sampler, errors, pids, nWorkers: ()=> subs.size };
}
export function save(name, obj){ fs.writeFileSync(OUT + name, JSON.stringify(obj, null, 1)); return OUT + name; }
