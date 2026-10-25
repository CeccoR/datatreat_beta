/* What a tab shows beside its state, kept (b2v4): the view a tab had comes back as it was
   after a sleep and a wake and after a reload (its record), and changing it is no step of
   the history and no change unsaved ("*"). Every module: its plots' zooms, its instructions
   shown and the scroll of its lists (utils.js shownOf, for all); DRS's sample on show (no
   part of its state: to b2v4 a woken or reloaded tab showed the first), SEM's editor's zoom
   (to b2v4 fitted again at every show), XRPD's peaks picked (a Scherrer card's, a Rietveld
   card's) and its crystallites' turns; XRPD's pattern and SEM's image on show (in their
   states too, v517, whose records held the one before a step till the next change: a reload
   showed that), and alike a Rietveld card's phase on show, the standard's window's, and
   their unit cells' turns; GC's sample picked (intervals one per sample). Each module's
   project is saved first, so that a "*" would show, and its history is the same throughout. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle, ready, switchTab, saveAs, tabLabels, history, idb } from './helpers.mjs';
import { makeTiff } from './fixtures.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const MIN = 60000;
const tabs = page => page.evaluate(async ()=> (await import('./tabs.js')).tabsNow());
const tick = (page, ms)=> page.evaluate(async ms=> (await import('./tabs.js')).sleepTick(Date.now() + ms), ms);
const starred = async (page, i)=> (await tabLabels(page))[i].endsWith('*');
/* What the tab on show shows: every plot's range (6 digits), the instructions shown, the
   counters and names of what is on show, the rows picked, the lists' scroll, SEM's editor
   (its canvas's pixels, hashed). */
const view = (page, mod)=> page.evaluate(mod=>{
  const root = document.getElementById('tab-' + mod), r6 = v => +(+v).toPrecision(6);
  const plots = [...root.querySelectorAll('svg.plot[id]')].filter(s=> s._plot && s.getClientRects().length).map(s=>{ const P = s._plot; return s.id + ' ' + [P.xmin, P.xmax, P.ymin, P.ymax].map(r6).join(' '); });
  const instr = [...root.querySelectorAll('.instr-info')].map(b=> b.classList.contains('is-on') ? 1 : 0).join('');
  const text = [...root.querySelectorAll('.nav-count, [id$="CurrentLabel"], #semCurName')].filter(e=> e.getClientRects().length).map(e=> e.textContent);
  const picked = [...root.querySelectorAll('tr.selected')].map(tr=> tr.textContent.trim().slice(0, 30));
  const scroll = [...root.querySelectorAll('.sem-thumbs-box, .sem-group-imgs')].map(e=> e.scrollTop + ',' + e.scrollLeft);
  const cv = root.querySelector('#semCropCanvas');
  let ed = null;
  if (cv && cv.width){ const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 0; for (let i = 0; i < d.length; i += 4) h = (Math.imul(h, 31) + d[i]) | 0; ed = cv.width + 'x' + cv.height + ':' + h; }
  return { plots, instr, text, picked, scroll, ed };
}, mod);
const hist = async (page, mod)=>{ const h = await history(page, mod); return h.index + '/' + h.n; };
// A plot zoomed with its tool: a rectangle dragged where nothing of its own takes the
// pointer, tried at a few places till its range changes.
async function zoom(page, id){
  const svg = page.locator('#' + id), wrap = svg.locator('xpath=ancestor::div[contains(@class,"plot-wrap")][1]');
  const range = ()=> page.evaluate(id=>{ const P = document.getElementById(id)._plot; return [P.xmin, P.xmax, P.ymin, P.ymax].join(); }, id);
  const r0 = await range();
  await wrap.locator('.plot-tool-btn[title="Zoom area"]').click();
  for (const [x0, y0] of [[0.35, 0.3], [0.55, 0.55], [0.2, 0.6], [0.65, 0.25]]){
    await svg.scrollIntoViewIfNeeded();
    const b = await svg.boundingBox();
    await page.mouse.move(b.x + b.width*x0, b.y + b.height*y0); await page.mouse.down();
    await page.mouse.move(b.x + b.width*(x0 + 0.12), b.y + b.height*(y0 + 0.15), { steps: 6 }); await page.mouse.up();
    await settle(page);
    if (await range() !== r0) break;
  }
  assert.notEqual(await range(), r0, id + ' zoomed');
  await wrap.locator('.plot-tool-btn[title="Zoom area"]').click();   // (its tool off)
}
// The module's instructions and its first card's shown.
async function instructions(page, mod){
  await page.locator(`#tab-${mod} .instr-info[data-instr]`).first().click();
  const card = page.locator(`#tab-${mod} .an-card .an-head .instr-info`);
  if (await card.count()) await card.first().click();
}
/* The tab at `i` (the other at `j`): its view (`look`'s), its history and no "*" kept
   through a sleep and a wake, a reload with it on show, and a reload with the other on show
   then a switch to it (woken from its record). */
async function roundTrip(page, mod, i, j, look = ()=> view(page, mod)){
  const v0 = await look(), h0 = await hist(page, mod);
  assert.equal(await starred(page, i), false, 'the view changed: no change unsaved');
  await switchTab(page, j);
  await tick(page, 11*MIN);
  assert.equal((await tabs(page))[i].awake, false, 'asleep');
  await switchTab(page, i);
  assert.equal((await tabs(page))[i].awake, true, 'woken');
  await page.waitForTimeout(300); await settle(page);
  assert.deepEqual(await look(), v0, 'woken: what it showed');
  assert.equal(await hist(page, mod), h0, 'woken: its history as it was, no step more');
  assert.equal(await starred(page, i), false, 'woken: no change unsaved');
  for (const other of [false, true]){
    if (other) await switchTab(page, j);
    await page.reload(); await ready(page); await settle(page);
    if (other){ assert.equal((await tabs(page))[i].awake, false); await switchTab(page, i); }
    await page.waitForTimeout(300); await settle(page);
    assert.deepEqual(await look(), v0, 'reloaded' + (other ? ', shown after' : '') + ': what it showed');
    assert.equal(await hist(page, mod), '0/1', 'reloaded: no step');
    assert.equal(await starred(page, i), false, 'reloaded: no change unsaved');
  }
  return v0;
}

test('DRS: the sample on show, a zoom, the instructions kept through a sleep and a reload; a view change written with its record, no step, no "*"', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', env.fx.files.tauc);
    await saveAs(page, 'View DRS');
    const h0 = await hist(page, 'tauc');
    await page.click('#an1Next'); await settle(page);
    assert.equal(await page.textContent('#an1Idx'), '2/2');
    await zoom(page, 'an1Svg');
    await zoom(page, 'taucResSvg0');
    await instructions(page, 'tauc');
    assert.equal(await hist(page, 'tauc'), h0, 'no step of the history');
    // Written with its record a while after (5 s), nothing else moving: no step, no "*"
    await page.waitForTimeout(5600);
    const rec = (await idb(page, 'tabs')).find(r=> r.module === 'tauc');
    assert.deepEqual(rec.shows.own, { sample: 1, name: 'drs2.csv' }, 'its record holds the sample on show');
    assert.ok(rec.shows.zoom.an1Svg && rec.shows.zoom.taucResSvg0, 'and the zooms');
    assert.equal(rec.dirty, false);
    const v = await roundTrip(page, 'tauc', 1, 0);
    assert.deepEqual(v.text.slice(0, 2), ['2/2', 'drs2']);
    // Stepped back and reloaded at once: the page's hiding writes it
    await page.click('#an1Prev'); await settle(page);
    await page.reload(); await ready(page); await settle(page);
    assert.equal(await page.textContent('#an1Idx'), '1/2');
    assert.equal(await starred(page, 1), false);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

const P = '#xrdR2';
async function refine(page){
  await page.waitForTimeout(650); await page.click(P + 'Refine');
  await page.waitForSelector('.confirm-modal');
  await page.click('.confirm-modal .btn:not(.primary)');
  await page.waitForFunction(s=> document.querySelector(s).textContent === 'Cancel', P + 'Refine');
  await page.waitForFunction(s=> document.querySelector(s).textContent === 'Refine', P + 'Refine', { timeout: 120000, polling: 100 });
  await settle(page);
}
test('XRPD: the pattern on show, zooms, the instructions, the peaks picked and the crystallites\' turns kept through a sleep and a reload, no step, no "*"', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd);
    // A Rietveld result for the pattern on show (the second), for its table of widths
    await page.click('#xrdA1Next'); await settle(page);
    await page.setInputFiles(P + 'CifInput', env.fx.cif);
    await page.waitForSelector(P + 'PhaseList input[data-on]');
    await settle(page);
    await refine(page);
    await saveAs(page, 'View XRPD');
    const h0 = await hist(page, 'xrd');
    await zoom(page, 'xrdA1Svg');
    await zoom(page, 'xrdR2Svg');
    await instructions(page, 'xrd');
    await page.locator('#xrdA1PeakBox .peak-row td').nth(1).click();
    await page.locator(P + 'PkWrap .rv-pk td').first().click();
    await settle(page);
    assert.equal(await page.locator('#tab-xrd tr.selected').count(), 2, 'a peak picked in each card');
    assert.equal(await hist(page, 'xrd'), h0, 'no step of the history');
    const v = await roundTrip(page, 'xrd', 1, 0);
    assert.equal(v.text[0], '2/3', 'the second pattern');
    assert.equal(v.picked.length, 2);
    /* A crystallite's turn (none of the fixtures' results keeps a free shape to turn by hand):
       put in the tab's record as the Rietveld card gives it, the tab asleep; reloaded and
       shown, the card holds it for its solid's drawing, and gives it again through a sleep. */
    const turn = ['s01.xrdml|1|["box",[1,2,3],null]', { v: 1, R: [0, -1, 0, 1, 0, 0, 0, 0, 1], labels: [] }];
    const turns = ()=> page.evaluate(async ()=>{ const t = (await import('./tabs.js')).activeTab(); const v = t.inst.shows(); return v && v.cards[2] && v.cards[2].turns || []; });
    await switchTab(page, 0);
    await tick(page, 11*MIN);
    await page.evaluate(turn=> new Promise((res, rej)=>{
      const q = indexedDB.open('datatreat');
      q.onsuccess = ()=>{
        const tx = q.result.transaction('tabs', 'readwrite'), os = tx.objectStore('tabs');
        os.getAll().onsuccess = e=>{ const r = e.target.result.find(r=> r.module === 'xrd'); r.shows.own.cards[2].turns = [turn]; os.put(r); };
        tx.oncomplete = ()=>{ q.result.close(); res(); }; tx.onerror = ()=> rej(tx.error);
      };
    }), turn);
    await page.reload(); await ready(page); await settle(page);
    await switchTab(page, 1);
    assert.deepEqual((await turns()).find(e=> e[0] === turn[0]), turn, 'reloaded: the turn given to its card');
    assert.deepEqual(await view(page, 'xrd'), v, 'and the rest as it was');
    await switchTab(page, 0); await tick(page, 11*MIN); await switchTab(page, 1);
    assert.deepEqual((await turns()).find(e=> e[0] === turn[0]), turn, 'woken: kept');
    assert.equal(await starred(page, 1), false);
    // A step, nothing else: its record written 5 s after with the pattern (to b2v4 it held the
    // one before till the next change, and a reload showed that)
    await page.click('#xrdA1Next'); await settle(page);
    assert.equal(await page.textContent('#xrdA1Idx'), '3/3');
    await page.waitForTimeout(5600);
    assert.equal((await idb(page, 'tabs')).find(r=> r.module === 'xrd').shows.own.pattern, 's02.xrdml');
    await page.reload(); await ready(page); await settle(page);
    assert.equal(await page.textContent('#xrdA1Idx'), '3/3', 'reloaded: the pattern stepped to');
    assert.equal(await starred(page, 1), false);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* XRPD's Rietveld: the phase on show (a click on its row, no step) and its unit cell turned
   (a drag), a card's and the standard's window's. To b2v4 a reload showed the phase the
   record held (the one before the click, till the next change wrote it), a wake or a
   reload the cells at their home view and the window's instructions shut. */
const S = '#xrdStdR';
const cellHash = (page, pre)=> page.evaluate(pre=>{
  const cv = document.querySelector(pre + 'Cell canvas');
  if (!cv || !cv.width) return null;
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 0;
  for (let i = 0; i < d.length; i += 4) h = (Math.imul(h, 31) + d[i] + d[i+1]*7) | 0;
  return cv.width + 'x' + cv.height + ':' + h;
}, pre);
const phaseOn = (page, pre)=> page.evaluate(pre=> [...document.querySelectorAll(pre + 'PhaseList [data-sel]')].findIndex(e=> e.classList.contains('is-sel')), pre);
async function turnCell(page, pre){
  const cv = page.locator(pre + 'Cell canvas'), h0 = await cellHash(page, pre);
  await cv.scrollIntoViewIfNeeded();
  const b = await cv.boundingBox();
  await page.mouse.move(b.x + b.width*0.5, b.y + b.height*0.5); await page.mouse.down();
  await page.mouse.move(b.x + b.width*0.8, b.y + b.height*0.6, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(100);
  assert.notEqual(await cellHash(page, pre), h0, pre + ': the cell turned');
}
const stdOpen = async page =>{ await page.click(P + 'Std'); await page.waitForSelector('#xrdStdRv', { state: 'visible' }); await settle(page); };
const stdShut = async page =>{ await page.keyboard.press('Escape'); await page.waitForSelector('#xrdStdRv', { state: 'hidden' }); };
const addCif = async (page, pre, n)=>{ await page.setInputFiles(pre + 'CifInput', env.fx.cif); await page.waitForFunction(([pre, n])=> document.querySelectorAll(pre + 'PhaseList [data-sel]').length === n, [pre, n]); await settle(page); };
test('XRPD: the phase on show and its unit cell\'s turn, a Rietveld card\'s and the standard\'s window\'s (its instructions too), kept through a sleep and a reload, no step, no "*"', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd);
    // Two phases in the card, one in the standard's window beside its LaB6: the last added on show
    await addCif(page, P, 1); await addCif(page, P, 2);
    await stdOpen(page); await addCif(page, S, 2); await stdShut(page);
    await saveAs(page, 'View phases');
    const h0 = await hist(page, 'xrd');
    assert.equal(await phaseOn(page, P), 1);
    // The first phase on show, its cell turned; in the standard's window its LaB6, turned
    await page.locator(P + 'PhaseList [data-sel]').nth(0).click({ position: { x: 30, y: 8 } }); await settle(page);
    await turnCell(page, P);
    await stdOpen(page);
    assert.equal(await phaseOn(page, S), 1);
    await page.locator(S + 'PhaseList [data-sel]').nth(0).click({ position: { x: 30, y: 8 } }); await settle(page);
    await turnCell(page, S);
    // and its instructions shown (a window's of its own, in the tab's layer)
    const info = ()=> page.evaluate(()=> document.querySelector('#xrdStdRv .instr-info').classList.contains('is-on'));
    await page.click('#xrdStdRv .instr-info');
    const std = async ()=>{ await stdOpen(page); const v = [await phaseOn(page, S), await cellHash(page, S), await info()]; await stdShut(page); return v; };
    const s0 = [0, await cellHash(page, S), true];
    await stdShut(page);
    assert.equal(await hist(page, 'xrd'), h0, 'no step of the history');
    // Written with its record a while after, nothing else moving
    await page.waitForTimeout(5600);
    const own = (await idb(page, 'tabs')).find(r=> r.module === 'xrd').shows.own, c = (own.cards || {})[2] || {}, r = (own.std || {}).rv || {};
    assert.deepEqual([c.sel && c.sel.id, r.sel && r.sel.id, !!c.cell, !!r.cell], [1, 0, true, true], 'its record holds the phases on show and the cells\' turns');
    const look = async ()=> ({ card: [await phaseOn(page, P), await cellHash(page, P)], std: await std() });
    const v = await roundTrip(page, 'xrd', 1, 0, look);
    assert.deepEqual(v.card[0], 0, 'the card\'s first phase');
    assert.deepEqual(v.std, s0, 'the standard\'s LaB6, turned, its instructions shown');
    // A double click puts the card's cell back home: kept so too
    await page.locator(P + 'Cell canvas').dblclick(); await page.waitForTimeout(100);
    assert.equal((await page.evaluate(async ()=> (await import('./tabs.js')).activeTab().inst.shows())).cards[2].cell, undefined);
    assert.equal(await starred(page, 1), false);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('GC and EPR: zooms, the instructions and GC\'s sample picked kept through a sleep and a reload, no step, no "*"', async ()=>{
  for (const [mod, plots] of [['gc', ['gc1Svg1', 'gc1SvgRate']], ['epr', ['epr1Svg']]]){
    const { page, errors, csp, close } = await env.page();
    try {
      await openModule(page, mod === 'gc' ? 'epr' : 'gc');
      await openModule(page, mod);
      await loadFiles(page, mod, env.fx.files[mod]);
      // (GC: its intervals' starts one per sample, so that a sample can be picked)
      if (mod === 'gc'){ await page.click('#tab-gc .gc-toggle[data-pair="start"]'); await settle(page); }
      await saveAs(page, 'View ' + mod);
      const h0 = await hist(page, mod);
      for (const id of plots) await zoom(page, id);
      await instructions(page, mod);
      // GC: the second sample picked in the card's table, its interval highlighted (to b2v4
      // none after a wake or a reload)
      const hl = ()=> page.locator('#tab-gc .gc-int-hl').count();
      if (mod === 'gc'){ await page.locator('#tab-gc .gc-row').nth(1).locator('td').first().click(); await settle(page); assert.equal(await hl(), 2); }
      assert.equal(await hist(page, mod), h0, mod + ': no step of the history');
      const v = await roundTrip(page, mod, 1, 0, async ()=> ({ ...(await view(page, mod)), ...(mod === 'gc' ? { hl: await hl() } : {}) }));
      assert.equal(v.instr.includes('1'), true);
      if (mod === 'gc') assert.deepEqual([v.picked.length, v.hl], [1, 2], 'GC: the second sample picked');
      assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
    } finally { await close(); }
  }
});

test('SEM: the image on show, the editor\'s zoom, the list of images and a group\'s row scrolled kept through a sleep and a reload, no step, no "*"; the zoom kept at a show and a resize', async ()=>{
  const { page, errors, csp, close } = await env.page({ viewport: { width: 1400, height: 760 } });
  try {
    await openModule(page, 'gc');
    await openModule(page, 'sem');
    const files = Array.from({ length: 12 }, (_, k)=> ({ name: `v${k}.tif`, mimeType: 'image/tiff', buffer: makeTiff({ sign: 'V' + k, seed: 30 + k }) }));
    await loadFiles(page, 'sem', files);
    await saveAs(page, 'View SEM');
    const h0 = await hist(page, 'sem');
    await page.click('#semNext'); await settle(page);
    // The editor zoomed by the wheel, Zoom area on, then panned
    await page.click('#semToolZoom');
    const b = await page.locator('#semCropCanvas').boundingBox();
    await page.mouse.move(b.x + b.width*0.4, b.y + b.height*0.4);
    await page.mouse.wheel(0, -300); await settle(page);
    await page.click('#semToolPan');
    await page.mouse.move(b.x + b.width*0.5, b.y + b.height*0.5); await page.mouse.down();
    await page.mouse.move(b.x + b.width*0.6, b.y + b.height*0.55, { steps: 5 }); await page.mouse.up();
    await page.click('#semToolPan'); await settle(page);
    // The list of images scrolled (the wheel over it)
    const box = page.locator('#tab-sem .sem-thumbs-box');
    assert.ok(await box.evaluate(e=> e.scrollHeight > e.clientHeight + 20), 'the list scrolls');
    const bb = await box.boundingBox();
    await page.mouse.move(bb.x + bb.width/2, bb.y + bb.height/2); await page.mouse.wheel(0, 120); await page.waitForTimeout(300);
    // and its group's row of images turned a page
    await page.click('#tab-sem .sem-page-next'); await page.waitForTimeout(800);
    await instructions(page, 'sem');
    await settle(page);
    assert.equal(await hist(page, 'sem'), h0, 'no step of the history');
    const v0 = await view(page, 'sem');
    assert.notEqual(v0.scroll[0], '0,0', 'the list scrolled');
    assert.notEqual(v0.scroll[1], '0,0', 'the group\'s row turned');
    // Shown again and the window resized: the zoom kept (to b2v4 fitted again)
    await switchTab(page, 0); await switchTab(page, 1);
    assert.deepEqual((await view(page, 'sem')).ed, v0.ed, 'shown again: as it was');
    const v = await roundTrip(page, 'sem', 1, 0);
    assert.equal(v.text[0], '2/12');
    await page.setViewportSize({ width: 1200, height: 760 }); await page.waitForTimeout(500); await settle(page);
    const ed = await page.evaluate(async ()=> (await import('./tabs.js')).activeTab().inst.shows());
    assert.ok(ed && ed.ed && ed.ed.k > 1, 'resized: still zoomed');
    // Fit: fitted, no zoom kept
    await page.click('#semToolFit'); await settle(page);
    assert.equal((await page.evaluate(async ()=> (await import('./tabs.js')).activeTab().inst.shows())).ed, undefined);
    // A step and a reload at once: the page's going keeps it (to b2v4 the record's image)
    await page.click('#semNext'); await settle(page);
    assert.equal(await page.textContent('#semIdx'), '3/12');
    await page.reload(); await ready(page); await settle(page);
    assert.equal(await page.textContent('#semIdx'), '3/12', 'reloaded at once: the image stepped to');
    assert.equal(await starred(page, 1), false);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});
