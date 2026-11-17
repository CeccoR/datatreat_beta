/* The Rietveld workers' pool (v518, xrd-rv-pool.js): Refine all runs its patterns on
   several workers at once (its lanes), at most the cap's (localStorage
   'datatreat-rv-workers', else the cores less one) for every run of every page of the app
   (windows, browser tabs: Web Locks). With three lanes the results are those of one,
   bit for bit, written in the patterns' order, one step; answers out of order wait for
   those before them; Cancel writes those done and not the ones under way; an error stops
   the patterns not started, those under way written; two windows on a cap of two run two
   jobs at once in all, the slot freed going to the job waited longest, each window its own
   results in order. The workers' answers are held (window.__hold) and delivered by their
   job's order, the pattern's (__nth). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle, until, undo, moduleState, ready } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const P = '#xrdR2';
// The cap, the workers made and the jobs posted counted, their results held while __hold;
// __nth(j) delivers the held result of the j-th job among those held (0: the earliest);
// __fail makes the next one delivered the worker's error. Before any worker is made.
const pool = (page, cap)=> page.evaluate(cap=>{
  localStorage.setItem('datatreat-rv-workers', String(cap));
  const W = window.Worker; window.__held = []; window.__hold = false; window.__made = 0; window.__posted = 0; window.__fail = false;
  const wrap = fn => e=>{
    if (!(e.data && e.data.type === 'result')) return fn(e);
    const go = ()=> window.__fail ? (window.__fail = false, fn({ data: { ...e.data, type: 'error', message: 'failed for the test' } })) : fn(e);
    if (window.__hold) window.__held.push(Object.assign(go, { k: e.data.id })); else go();
  };
  window.Worker = class extends W {
    constructor(...a){ super(...a); window.__made++; }
    postMessage(...a){ window.__posted++; return super.postMessage(...a); }
    addEventListener(t, fn, o){ if (t !== 'message') return super.addEventListener(t, fn, o); const g = wrap(fn); (this.__m || (this.__m = new Map())).set(fn, g); return super.addEventListener(t, g, o); }
    removeEventListener(t, fn, o){ return super.removeEventListener(t, (t === 'message' && this.__m && this.__m.get(fn)) || fn, o); }
  };
  window.__nth = j =>{ const h = window.__held.slice().sort((a, b)=> a.k - b.k), f = h[j]; if (!f) return false; window.__held.splice(window.__held.indexOf(f), 1); f(); return true; };
  window.__release = ()=>{ window.__hold = false; window.__held.splice(0).sort((a, b)=> a.k - b.k).forEach(f=> f()); };
}, cap);
const held = (page, n)=> until(()=> page.evaluate(n=> window.__held.length >= n, n), { timeout: 120000, what: n + ' answers held' });
const press = async (page, sel)=>{ await page.waitForTimeout(650); await page.click(sel); };
const running = page => page.waitForFunction(s=> document.querySelector(s).textContent === 'Cancel', P + 'Refine');
const idle = page => page.waitForFunction(s=> document.querySelector(s).textContent === 'Refine', P + 'Refine', { timeout: 120000 });
async function refineAll(page){
  await press(page, P + 'RefineAll');
  await page.waitForSelector('.confirm-modal');
  await page.click('.confirm-modal .btn:not(.primary)');
  await running(page);
}
async function xrdTab(page, n){
  await openModule(page, 'xrd');
  await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, n));
  await page.setInputFiles(P + 'CifInput', env.fx.cif);
  await page.waitForSelector(P + 'PhaseList input[data-on]');
  await settle(page);
}
const results = async page => (((await moduleState(page, 'xrd')).cards.find(c=> c.id === 2) || {}).states?.rietveld?.results || {});
const names = async page => Object.keys(await results(page));
// (what the worker gave, its times left out)
const strip = r => JSON.parse(JSON.stringify(r, (k, v)=> k === 'at' || k === 'ms' ? undefined : v));
const steps = page => page.evaluate(async ()=>{ const u = await import('./utils.js'), h = u.getModuleHistory('xrd');
  return { index: h.index, of: h.states.map(s=> Object.keys(((s.cards.find(c=> c.id === 2) || {}).states || {}).rietveld?.results || {}).length) }; });

test('three lanes: the results those of one, bit for bit, in the patterns\' order, one step', async ()=>{
  const one = await env.page(), three = await env.page();
  try {
    const got = {};
    for (const [k, { page }] of [[1, one], [3, three]]){
      await pool(page, k);
      await xrdTab(page, 3);
      const h0 = await steps(page);
      await refineAll(page);
      await idle(page);
      await settle(page);
      got[k] = { res: strip(await results(page)), made: await page.evaluate(()=> window.__made), h0, h: await steps(page) };
    }
    assert.equal(got[1].made, 1); assert.equal(got[3].made, 3);
    assert.deepEqual(Object.keys(got[3].res), ['s00.xrdml', 's01.xrdml', 's02.xrdml'], 'in the patterns\' order');
    assert.deepEqual(got[3].res, got[1].res, 'bit for bit');
    assert.deepEqual(got[3].h.of, [...got[3].h0.of, 3], 'one step');
    assert.deepEqual([one.errors, three.errors], [[], []]);
  } finally { await one.close(); await three.close(); }
});

test('answers out of order wait for those before them; Cancel writes those done, not the ones under way', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await pool(page, 3);
    await xrdTab(page, 3);
    await page.evaluate(()=>{ window.__hold = true; });
    await refineAll(page);
    await held(page, 3);
    assert.match(await page.textContent(P + 'Status'), /Refining s00, s01, s02… \(0 of 3 done\)/);
    await page.evaluate(()=> window.__nth(1));       // s01's
    await settle(page);
    assert.deepEqual(await names(page), [], 's01 waits for s00');
    await page.evaluate(()=> window.__nth(0));       // s00's: both written, in order
    await until(async ()=> (await names(page)).length === 2, { what: 's00 and s01' });
    assert.deepEqual(await names(page), ['s00.xrdml', 's01.xrdml']);
    await press(page, P + 'Refine');                 // (Cancel: s02 under way)
    await idle(page);
    assert.match(await page.textContent(P + 'Status'), /Stopped after 2 of 3 patterns/);
    await page.evaluate(()=> window.__release());
    await settle(page);
    assert.deepEqual(await names(page), ['s00.xrdml', 's01.xrdml'], 'nothing of s02\'s answer after');
    await undo(page);
    assert.deepEqual(await names(page), []);
    await undo(page, true);
    assert.deepEqual(await names(page), ['s00.xrdml', 's01.xrdml']);
    // Cancel with s01 answered and s00 under way: s01 written past it.
    await page.evaluate(()=>{ window.__hold = true; });
    await press(page, P + 'RefineAll');
    await page.waitForSelector('.confirm-modal');
    await page.click('.confirm-modal .btn:not(.primary)');
    await running(page);
    await held(page, 3);
    const before = await results(page);
    await page.evaluate(()=> window.__nth(1));
    await settle(page);
    await press(page, P + 'Refine');
    await idle(page);
    assert.match(await page.textContent(P + 'Status'), /Stopped after 1 of 3 patterns/);
    const after = await results(page);
    assert.equal(after['s00.xrdml'].at, before['s00.xrdml'].at, 's00, under way, kept what it had');
    assert.notEqual(after['s01.xrdml'].at, before['s01.xrdml'].at, 's01, done, written');
    const h = await steps(page);
    assert.equal(h.index, h.of.length - 1);
    await page.evaluate(()=> window.__release());
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('an error in one lane: the patterns not started stop, those under way are written, the failed one not', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await pool(page, 2);
    await xrdTab(page, 3);
    await page.evaluate(()=>{ window.__hold = true; });
    await refineAll(page);
    await held(page, 2);                              // s00 and s01 (s02 not started: two lanes)
    await page.evaluate(()=>{ window.__fail = true; window.__nth(0); });   // s00 fails
    await page.evaluate(()=> window.__nth(0));       // s01's
    await idle(page);
    await settle(page);
    assert.match(await page.textContent(P + 'Status'), /failed for the test/);
    assert.deepEqual(await names(page), ['s01.xrdml'], 's01 written, s00 failed, s02 never started');
    assert.equal(await page.evaluate(()=> window.__posted), 2, 's02 never sent');
    assert.equal(await page.evaluate(()=> window.__held.length), 0);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('two windows on a cap of two: two jobs at once in all, the slot freed to the job waiting longest; each its own results', async ()=>{
  const a = await env.page();
  // (a second window of the app in the same browser profile: the same origin's locks)
  const pb = await a.ctx.newPage();
  const errB = [];
  pb.on('pageerror', e=> errB.push(e.message));
  try {
    await pb.goto(env.base + '/index.html');
    await ready(pb);
    for (const p of [a.page, pb]){ await pool(p, 2); await p.evaluate(()=>{ window.__hold = true; }); }
    await xrdTab(a.page, 3);
    await refineAll(a.page);
    await held(a.page, 2);
    await xrdTab(pb, 2);
    await refineAll(pb);
    await a.page.waitForTimeout(500);
    const posted = async ()=> [await a.page.evaluate(()=> window.__posted), await pb.evaluate(()=> window.__posted)];
    assert.deepEqual(await posted(), [2, 0], 'B waits: both slots A\'s');
    await a.page.evaluate(()=> window.__nth(0));     // A's s00 done: its slot to B's first, waiting since before A's s02 asked
    await until(async ()=> (await posted())[1] === 1, { what: 'B\'s first job' });
    await a.page.waitForTimeout(300);
    assert.deepEqual(await posted(), [2, 1]);
    for (const p of [a.page, pb]) await p.evaluate(()=> window.__release());
    await idle(a.page); await idle(pb);
    await settle(a.page); await settle(pb);
    assert.deepEqual(await names(a.page), ['s00.xrdml', 's01.xrdml', 's02.xrdml']);
    assert.deepEqual(await names(pb), ['s00.xrdml', 's01.xrdml']);
    assert.deepEqual(strip((await results(pb))['s01.xrdml']), strip((await results(a.page))['s01.xrdml']), 'the same pattern, the same result');
    assert.deepEqual([a.errors, errB], [[], []]);
  } finally { await a.close(); }
});
