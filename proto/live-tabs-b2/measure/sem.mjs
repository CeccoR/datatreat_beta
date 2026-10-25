/* SEM made per tab (sem.patch) against SEM on the compatibility path (core.patch alone):
   what a SEM tab of 8 images (2048 × 2176, 16 bits, as the assessment's) holds and costs.
   Each tree on its own port: CORE_BASE (HEAD + core.patch, default :8967), B2_BASE (HEAD +
   core.patch + sem.patch, default :8966). Memory after a forced GC: the page's JS heap and
   its ArrayBuffers (Runtime.getHeapUsage usedSize, backingStorageSize: `ab`), Blink's DOM
   nodes, the renderer's RSS and the GPU process's (/proc VmRSS). Phases, each in a fresh
   browser:
   - prim: the primitives' times on one file (sem-read.js, the editor's image);
   - tiers: tab A of the 8 on show; a blank SEM tab B on show (A hidden: parked on core,
     awake on b2); b2: A trimmed (tabs.js sleepTick past TRIM_MS), A asleep; the reading's
     time (the drop to the 8 thumbnails), the memory 1 s, 3 s and 22 s after it (b2: the
     editor's pixels let go 2 s after its last image, the worker 20 s after its last
     file); the time to show A again from B in each state (a click to two frames after
     the loader, lib.mjs timedShow; median of 5); A's bytes() (tabsNow); a WeakRef to A's
     section emptied after its sleep and a GC (b2);
   - bits8: the same at 8 bits a pixel, A on show and hidden;
   - worker: the reading worker 3 s and 22 s after the reading;
   - twice: the same 8 files in A and in B, on show, against B blank;
   - figure: the composer open on A's group after an SVG export (the images at full size).
   node sem.mjs [phase…] → results/sem.json */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, timedShow, med, r1, save, sleep } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { makeTiff } = await import(path.resolve(HERE, '../../../tests/fixtures.mjs'));
const TREES = { core: process.env.CORE_BASE || 'http://127.0.0.1:8967', b2: process.env.B2_BASE || 'http://127.0.0.1:8966' };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-sem-'));
const F8 = Array.from({ length: 8 }, (_, i)=>{
  const p = path.join(dir, `img${i + 1}.tif`);
  fs.writeFileSync(p, makeTiff({ W: 2048, H: 2176, bits: 16, strip: 128, sign: 'S' + (i + 1), pixelNm: 25, mag: 5000, seed: i + 1 }));
  return p;
});
// (the same at 8 bits: an image decoded is a copy, 2 bytes a pixel)
const F8b = Array.from({ length: 8 }, (_, i)=>{
  const p = path.join(dir, `e${i + 1}.tif`);
  fs.writeFileSync(p, makeTiff({ W: 2048, H: 2176, bits: 8, strip: 128, sign: 'E' + (i + 1), pixelNm: 25, mag: 5000, seed: i + 1 }));
  return p;
});
const MIN = 60000, N = 5;
const kb = (txt, k)=> +((txt.match(new RegExp('^' + k + ':\\s+(\\d+)', 'm')) || [])[1] || 0)/1024;
async function open(tree){
  const L = await launch(TREES[tree]);
  const bcdp = await L.browser.newBrowserCDPSession();
  // (the GPU process's RSS beside the renderer's: a canvas may be drawn there)
  L.memAll = async ()=>{
    const m = await L.mem(), u = await L.cdp.send('Runtime.getHeapUsage');
    const g = (await bcdp.send('SystemInfo.getProcessInfo')).processInfo.filter(p=> p.type === 'gpu');
    let gpu = 0; for (const p of g){ try { gpu += kb(fs.readFileSync(`/proc/${p.id}/status`, 'utf8'), 'VmRSS'); } catch(e){} }
    return { ...m, ab: r1((u.backingStorageSize || 0)/1048576), gpu: r1(gpu) };
  };
  // The 8 dropped on the tab on show: ms from the drop to the 8 thumbnails drawn.
  L.load = async (files = F8)=>{
    const list = files.map(f=> [path.basename(f), fs.readFileSync(f).toString('base64')]);
    const ms = await L.page.evaluate(([list])=> new Promise(res=>{
      const dt = new DataTransfer();
      for (const [name, b64] of list) dt.items.add(new File([Uint8Array.fromBase64 ? Uint8Array.fromBase64(b64) : Uint8Array.from(atob(b64), c=> c.charCodeAt(0))], name));
      const t0 = performance.now(), n = list.length;
      document.querySelector('#semDropzone').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
      const wait = ()=> document.querySelectorAll('#semThumbs .sem-thumb canvas').length >= n && !document.querySelector('.dz-loading') ? res(performance.now() - t0) : requestAnimationFrame(wait);
      wait();
    }), [list]);
    await L.app.settle();
    return r1(ms);
  };
  return L;
}
const tabsNow = page => page.evaluate(async ()=> (await import('./tabs.js')).tabsNow());
const shows = async (L, n, before)=>{ const t = []; for (let i = 0; i < n; i++){ await timedShow(L.page, 1); if (before) await before(); t.push(await timedShow(L.page, 0)); } return { ms: med(t.map(x=> x.ms)), max: Math.max(...t.map(x=> x.ms)), longMs: med(t.map(x=> x.longMs)) }; };

const phases = {
  // The primitives on one 2048 × 2176 file in the page, ms, median of 7: its base64 both
  // ways (core), its hash, its header, its levels read as a copy and (b2) as a view, the
  // reduced copy, a crop's statistics, its card, and the editor's image (its levels
  // through a curve into a canvas: the pixels kept, a new ImageData, a new canvas).
  async prim(tree){
    const L = await open(tree), out = {};
    for (const [bits, f] of [[16, F8[0]], [8, F8b[0]]]){
      out['b' + bits] = await L.page.evaluate(async b64=>{
        const R = await import('./sem-read.js'), bytes = Uint8Array.fromBase64(b64);
        const med = a => a.sort((x, y)=> x - y)[a.length >> 1];
        const time = fn =>{ const t = []; let v; for (let i = 0; i < 7; i++){ const t0 = performance.now(); v = fn(); t.push(performance.now() - t0); } return [Math.round(med(t)*10)/10, v]; };
        const o = { size: bytes.length, hash: time(()=> R.hashBytes(bytes))[0], head: time(()=> R.readTescanTiff(bytes, 'x', { head: true }))[0] };
        if (R.toB64){ o.toB64 = time(()=> R.toB64(bytes))[0]; const t = R.toB64(bytes); o.fromB64 = time(()=> R.fromB64(t))[0]; }
        const [tc, r] = time(()=> R.readTescanTiff(bytes, 'x'));
        o.copy = tc;
        const [tv, rv] = time(()=> R.readTescanTiff(bytes, 'x', { view: true }));
        if (rv.view) o.view = tv;
        o.reduced = time(()=> R.reducedCopy(r))[0];
        const c = { x: 0, y: 0, w: r.width, h: r.imageH };
        o.stats = time(()=> R.cropStats(r.pixels, r.width, c))[0];
        o.card = time(()=> R.cardLevels(r, c, r.width, r.imageH))[0];
        const lut = new Uint8ClampedArray(65536); for (let v = 0; v < 65536; v++) lut[v] = v >> 8;
        const cv = document.createElement('canvas'); cv.width = r.width; cv.height = r.imageH;
        const draw = img =>{ const ctx = cv.getContext('2d'), d = new Uint32Array(img.data.buffer), t = new Uint32Array(65536);
          for (let v = 0; v < 65536; v++){ const g = lut[v]; t[v] = 0xff000000 | g << 16 | g << 8 | g; }
          const W = r.width, px = r.pixels; for (let y = 0; y < r.imageH; y++){ const row = y*W; for (let x = 0; x < W; x++) d[row + x] = t[px[row + x]]; }
          ctx.putImageData(img, 0, 0); };
        const keep = cv.getContext('2d').createImageData(r.width, r.imageH);
        o.editorKept = time(()=> draw(keep))[0];
        o.editorNewPixels = time(()=> draw(cv.getContext('2d').createImageData(r.width, r.imageH)))[0];
        o.editorNewCanvas = time(()=>{ cv.width = 0; cv.width = r.width; cv.height = r.imageH; draw(cv.getContext('2d').createImageData(r.width, r.imageH)); })[0];
        return o;
      }, fs.readFileSync(f).toString('base64'));
    }
    await L.close();
    return out;
  },
  async tiers(tree){
    const L = await open(tree), out = {};
    out.blank = await L.memAll();
    await L.app.newTab('sem');
    out.loadMs = await L.load();
    out.after1s = await L.memAll();
    await sleep(2000);
    out.after3s = await L.memAll();
    await sleep(20000);
    out.shown = await L.memAll();
    if (tree === 'b2') out.bytesShown = (await tabsNow(L.page))[0].bytes;
    await L.app.newTab('sem'); await sleep(300);
    out.hidden = await L.memAll();
    out.showHidden = await shows(L, N);
    if (tree === 'b2'){
      await L.app.show(1);
      out.bytesHidden = (await tabsNow(L.page))[0].bytes;
      await L.app.tick(61000); out.trimmed = await L.memAll(); out.bytesTrimmed = (await tabsNow(L.page))[0].bytes;
      out.showTrimmed = await shows(L, N, ()=> L.app.tick(61000));
      await L.app.show(1);
      await L.page.evaluate(async ()=>{ const T = await import('./tabs.js'); window.__wr = new WeakRef(T.TABS[0].inst.root); });
      await L.app.tick(11*MIN); out.asleep = await L.memAll();
      out.collected = await L.page.evaluate(()=> !window.__wr.deref());
      out.showAsleep = await shows(L, N, ()=> L.app.tick(11*MIN));
    }
    out.errors = L.errors;
    await L.close();
    return out;
  },
  // 8 images of 8 bits: on show, then hidden (a blank SEM tab on show).
  async bits8(tree){
    const L = await open(tree), out = {};
    await L.app.newTab('sem'); out.loadMs = await L.load(F8b); await sleep(22000);
    out.shown = await L.memAll();
    await L.app.newTab('sem'); await sleep(300);
    out.hidden = await L.memAll();
    out.errors = L.errors;
    await L.close();
    return out;
  },
  async twice(tree){
    const L = await open(tree), out = {};
    await L.app.newTab('sem'); await L.load();
    await L.app.newTab('sem');
    out.oneAndBlank = await L.memAll();
    out.loadAgainMs = await L.load();
    await sleep(22000);
    out.twice = await L.memAll();
    out.errors = L.errors;
    await L.close();
    return out;
  },
  // The reading worker after the 8 are read: its isolate's JS heap and ArrayBuffers 3 s
  // after (CDP: the page's targets auto-attached, messages through the page's session),
  // and whether it is still there 22 s after.
  async worker(tree){
    const L = await open(tree), out = {}, ws = new Map();
    let id = 0;
    L.cdp.on('Target.attachedToTarget', e=>{ if (e.targetInfo.type === 'worker') ws.set(e.sessionId, new Map()); });
    L.cdp.on('Target.receivedMessageFromTarget', e=>{ const m = JSON.parse(e.message), w = ws.get(e.sessionId); if (w && w.has(m.id)){ w.get(m.id)(m.result); w.delete(m.id); } });
    const ask = (sid, method)=> new Promise(ok=>{ const n = ++id; ws.get(sid).set(n, ok); L.cdp.send('Target.sendMessageToTarget', { sessionId: sid, message: JSON.stringify({ id: n, method }) }); });
    await L.cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: false });
    await L.app.newTab('sem'); await L.load(); await sleep(2000);
    const live = async ()=> (await L.cdp.send('Target.getTargets')).targetInfos.filter(t=> t.type === 'worker').length;
    out.workers3s = await live();
    for (const sid of ws.keys()){
      try { await ask(sid, 'HeapProfiler.collectGarbage'); const u = await ask(sid, 'Runtime.getHeapUsage'); out.heap = r1(u.usedSize/1048576); out.ab = r1((u.backingStorageSize || 0)/1048576); out.total = r1(u.totalSize/1048576); } catch(e){ out.err = String(e); }
    }
    out.rss3s = (await L.memAll()).rss;
    await sleep(20000);
    out.workers22s = await live();
    out.rss22s = (await L.memAll()).rss;
    out.errors = L.errors;
    await L.close();
    return out;
  },
  async figure(tree){
    const L = await open(tree), out = {};
    await L.app.newTab('sem'); await L.load(); await sleep(22000);
    out.shown = await L.memAll();
    await L.page.click('#semGroups .sem-group-fig:not([disabled])');
    await L.page.waitForSelector('.fig-backdrop');
    await sleep(1000);
    out.open = await L.memAll();
    const [d] = await Promise.all([L.page.waitForEvent('download', { timeout: 120000 }), L.page.click('.fig-backdrop [data-fig-svg]')]);
    out.svgBytes = fs.statSync(await d.path()).size;
    await sleep(1000);
    out.afterExport = await L.memAll();
    await L.page.keyboard.press('Escape');
    await sleep(500);
    out.closed = await L.memAll();
    out.errors = L.errors;
    await L.close();
    return out;
  },
};
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(phases);
const file = path.resolve(HERE, '../results/sem.json');
const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
try {
  for (const ph of want) for (const tree of ['core', 'b2']){
    const r = await phases[ph](tree);
    (all[ph] = all[ph] || {})[tree] = r;
    console.log(ph, tree, JSON.stringify(r));
  }
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
console.log(save('sem.json', all));
