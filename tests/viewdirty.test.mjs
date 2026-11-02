/* What is a change unsaved ("*") and what is a step of the history (v528). Pure visualization
   is a step but no change unsaved, and is kept with the tab's record (a reload shows it): a
   chart's selector of what it draws (DRS's E_g chips, x-axis / baseline; GC's gases, H₂ / O₂;
   XRPD's size chart by sample / by peak) and a card folded or unfolded (every module's cards,
   the Figure's Plot cards among them). A card closed or moved is a change: "*", a step. Each
   module's project is saved first, so that a "*" would show. (SEM has neither a selector of
   the view in its state nor cards; its view — the image on show, the editor's zoom — is no
   part of its state: b2view.test.mjs.) */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { start, openModule, loadFiles, settle, ready, undo, saveAs, tabLabels, history, moduleState } from './helpers.mjs';

let env, dir;
before(async ()=>{
  env = await start();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'datatreat-vd-'));
  fs.writeFileSync(path.join(dir, 'a.csv'), 'Time (s),Signal (mV)\r\n' + [1, 2, 3, 4, 5, 6].map(t=> `${t},${10 + t*1.5}`).join('\r\n') + '\r\n');
});
after(()=>{ if (dir) fs.rmSync(dir, { recursive: true, force: true }); return env && env.close(); });

const card = (mod, id)=> `#tab-${mod} .an-card[data-an="${id}"]`;
const starred = async page => (await tabLabels(page))[0].endsWith('*');
const steps = async (page, mod)=> (await history(page, mod)).index;
const ids = (page, mod)=> page.$$eval(`#tab-${mod} .an-card`, cs=> cs.map(x=> +x.dataset.an));
const rest = async page =>{ await page.waitForTimeout(500); await settle(page); };
async function fold(page, mod, id){ await page.locator(card(mod, id) + ' .an-fold').scrollIntoViewIfNeeded(); await page.click(card(mod, id) + ' .an-fold'); await rest(page); }
const folded = (page, mod, id)=> page.$eval(card(mod, id), c=> c.classList.contains('is-folded'));
async function addCard(page, mod, kind){
  await page.click(`#${mod}AddAn`);
  const item = `.an-menu:not([hidden]) [data-kind${kind ? `="${kind}"` : ''}]`;
  if (await page.locator(item).count()) await page.locator(item).first().click();
  await rest(page);
}
// Card `id` dragged by its grip below the last one.
async function moveDown(page, mod, id){
  const all = await ids(page, mod);
  await page.locator(card(mod, id) + ' .an-grip').scrollIntoViewIfNeeded(); await rest(page);
  const g = await page.locator(card(mod, id) + ' .an-grip').boundingBox();
  await page.mouse.move(g.x + g.width/2, g.y + g.height/2);
  await page.mouse.down(); await page.waitForTimeout(500);
  const last = await page.locator(card(mod, all[all.length - 1])).boundingBox();
  await page.mouse.move(g.x + g.width/2, last.y + last.height*0.9, { steps: 10 }); await page.waitForTimeout(200);
  await page.mouse.up(); await rest(page);
}
// (after the tab's record is written: a change's trailing write comes 5 s after it, sessions.js AUTOSAVE_MS)
async function reload(page){ await page.waitForTimeout(5600); await page.reload(); await ready(page); await settle(page); await page.waitForTimeout(300); }

/* A selector of the view: no "*", one step; undone and redone, still none; kept through a
   reload with no "*". read(): the selector's value in the state; pick(): changes it. */
async function selector(page, mod, read, pick){
  const v0 = await read(), h0 = await steps(page, mod);
  await pick(); await settle(page);
  const v1 = await read();
  assert.notDeepEqual(v1, v0, mod + ': the selector changed the state');
  assert.equal(await steps(page, mod), h0 + 1, mod + ': a step of the history');
  assert.equal(await starred(page), false, mod + ': no change unsaved');
  await undo(page);
  assert.deepEqual(await read(), v0, mod + ': undone');
  assert.equal(await starred(page), false, mod + ': undone, no "*"');
  await undo(page, true);
  assert.deepEqual(await read(), v1, mod + ': redone');
  assert.equal(await starred(page), false, mod + ': redone, no "*"');
  await reload(page);
  assert.deepEqual(await read(), v1, mod + ': reloaded, the view kept');
  assert.equal(await starred(page), false, mod + ': reloaded, no "*"');
}
/* A card folded and unfolded: no "*", a step each; undone, unfolded again, no "*". Then a card
   added (a change), the project saved; the cards moved: "*", a step, undone; one closed: "*". */
async function cards(page, mod, kind, name){
  const h0 = await steps(page, mod);
  await fold(page, mod, 1);
  assert.equal(await folded(page, mod, 1), true);
  assert.equal(await steps(page, mod), h0 + 1, mod + ': the fold a step');
  assert.equal(await starred(page), false, mod + ': folded, no "*"');
  await undo(page); await rest(page);
  assert.equal(await folded(page, mod, 1), false, mod + ': the fold undone');
  assert.equal(await starred(page), false, mod + ': the fold undone, no "*"');
  await undo(page, true); await rest(page);
  assert.equal(await folded(page, mod, 1), true, mod + ': redone');
  await reload(page);
  assert.equal(await folded(page, mod, 1), true, mod + ': reloaded, still folded');
  assert.equal(await starred(page), false, mod + ': reloaded, no "*"');
  await fold(page, mod, 1);
  assert.equal(await starred(page), false, mod + ': unfolded, no "*"');
  // Moved and closed: changes
  await addCard(page, mod, kind);
  assert.equal(await starred(page), true, mod + ': a card added, "*"');
  await saveAs(page, name);
  assert.equal(await starred(page), false);
  const before = await ids(page, mod), h1 = await steps(page, mod);
  await moveDown(page, mod, before[0]);
  assert.notDeepEqual(await ids(page, mod), before, mod + ': moved');
  assert.equal(await steps(page, mod), h1 + 1, mod + ': the move a step');
  assert.equal(await starred(page), true, mod + ': moved, "*"');
  await undo(page); await rest(page);
  assert.deepEqual(await ids(page, mod), before, mod + ': the move undone');
  assert.equal(await starred(page), false, mod + ': the move undone, as saved');
  await page.locator(card(mod, before[1]) + ' .an-close').scrollIntoViewIfNeeded();
  await page.click(card(mod, before[1]) + ' .an-close'); await rest(page);
  assert.deepEqual(await ids(page, mod), before.filter(x=> x !== before[1]), mod + ': closed');
  assert.equal(await starred(page), true, mod + ': closed, "*"');
  await undo(page); await rest(page);
  assert.deepEqual(await ids(page, mod), before, mod + ': the close undone');
  assert.equal(await starred(page), false, mod + ': the close undone, as saved');
}

test('DRS: the E_g chips (x-axis / baseline) and a card\'s fold a step, no "*", kept; a card moved or closed "*"', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', env.fx.files.tauc);
    await saveAs(page, 'View DRS');
    const read = async ()=> (await moduleState(page, 'tauc')).analyses[0].egSel;
    await selector(page, 'tauc', read, async ()=>{ await page.locator('#an1EgSel [data-eg]').first().scrollIntoViewIfNeeded(); await page.click('#an1EgSel [data-eg]'); });
    await cards(page, 'tauc', 'tauc', 'View DRS');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('GC: the gas chips (H₂ / O₂) and a card\'s fold a step, no "*", kept; a card moved or closed "*"', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', env.fx.files.gc);
    await saveAs(page, 'View GC');
    const read = async ()=> (await moduleState(page, 'gc')).cards[0].gasSel;
    const chip = '#tab-gc .an-card[data-an="1"] .gc-gas-chip[data-sec="a"]';
    await selector(page, 'gc', read, async ()=>{ await page.locator(chip).first().scrollIntoViewIfNeeded(); await page.locator(chip).first().click(); });
    await cards(page, 'gc', null, 'View GC');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('XRPD: the size chart by sample / by peak and a card\'s fold a step, no "*", kept; a card moved or closed "*"', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd);
    await saveAs(page, 'View XRPD');
    const st = async ()=> (await moduleState(page, 'xrd')).cards[0];
    assert.equal((await st()).type, 'scherrer');
    const read = async ()=> (await st()).states.scherrer.sizeBy;
    const chip = '#xrdA1SizeBy [data-size-by="peak"]';
    await page.waitForSelector(chip, { state: 'attached' });
    await selector(page, 'xrd', read, async ()=>{ await page.locator(chip).scrollIntoViewIfNeeded(); await page.click(chip); });
    await cards(page, 'xrd', 'scherrer', 'View XRPD');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('EPR: a card\'s fold a step, no "*", kept; a card moved or closed "*"', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'epr');
    await loadFiles(page, 'epr', env.fx.files.epr);
    await saveAs(page, 'View EPR');
    await cards(page, 'epr', null, 'View EPR');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('Figure: a Plot card\'s fold a step, no "*", kept; a card moved or closed "*"; a series added "*"; the Add series window cancelled no "*"', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'fig');
    await loadFiles(page, 'fig', [path.join(dir, 'a.csv')]);
    await addCard(page, 'fig', 'xy');
    await saveAs(page, 'View Figure');
    await cards(page, 'fig', 'bar', 'View Figure');
    // (what a plot draws is no view: a series added is a change)
    // (the Add series window opened and cancelled: nothing)
    await page.click('#fig1Add'); await page.click('.fig-pick:not([style*="none"]) [data-cancel]'); await settle(page);
    assert.equal(await starred(page), false, 'the window cancelled, no "*"');
    await page.click('#fig1Add');
    await page.locator('.fig-pick:not([style*="none"]) input[data-key]').first().check();
    await page.click('.fig-pick:not([style*="none"]) [data-done]'); await settle(page);
    assert.equal(await starred(page), true, 'a series added, "*"');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
