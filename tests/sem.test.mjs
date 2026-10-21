/* SEM: images grouped by scale, an excluded image deciding nothing about its group; a
   renamed label shown everywhere and undone; the crop editor, where a drag of a pixel or
   two is no edit and a real one moves every linked crop by one undo step. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, moduleState, history, undo, settle } from './helpers.mjs';
import { tif } from './fixtures.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

// The groups as shown: "name {captions}", empty ones marked.
const groupsView = page => page.evaluate(()=> [...document.querySelectorAll('#semGroups .sem-group')].filter(g=> g.getClientRects().length)
  .map(g=> g.querySelector('.sem-group-name').value + ' {' + [...g.querySelectorAll('.sem-gimg .sem-thumb-cap')].map(c=> c.textContent).join(',') + '}' + (g.classList.contains('is-empty') ? ' (empty)' : '')));
const scopes = page => page.evaluate(()=> [...document.querySelectorAll('#semIntScope option')].map(o=> o.textContent));
async function include(page, i, on){
  const cb = page.locator(`#semFileTableWrap .file-incl[data-i="${i}"]`);
  if (await cb.isChecked() !== on){ await cb.click(); await settle(page); }
}

test('groups: by scale, an excluded image left out of its group and of its name', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'sem');
    // A 5 kx at 25 nm, B 4.80 kx at 27 nm: one group (within 10 %), named by B's larger pixel.
    await loadFiles(page, 'sem', [tif('a.tif', { sign: 'A', seed: 1, pixelNm: 25, mag: 5000 }), tif('b.tif', { sign: 'B', seed: 2, pixelNm: 27, mag: 4800 })]);
    assert.deepEqual(await groupsView(page), ['4.80 kx {A,B}']);
    await include(page, 1, false);
    assert.deepEqual(await groupsView(page), ['5.00 kx {A}'], 'B excluded');
    // C at 22.8 nm: within 10 % of A, not of B.
    await loadFiles(page, 'sem', [tif('c.tif', { sign: 'C', seed: 3, pixelNm: 22.8, mag: 5480 })]);
    assert.deepEqual(await groupsView(page), ['5.00 kx {A,C}'], 'C joins A, B still out');
    await include(page, 1, true);
    assert.deepEqual(await groupsView(page), ['4.80 kx {A,B,C}'], 'B back');
    // D at 100 nm, alone in its group; excluded, its group hidden and not offered.
    await loadFiles(page, 'sem', [tif('d.tif', { sign: 'D', seed: 4, pixelNm: 100, mag: 1250 })]);
    assert.deepEqual(await groupsView(page), ['1.25 kx {D}', '4.80 kx {A,B,C}']);
    await include(page, 3, false);
    assert.deepEqual(await groupsView(page), ['4.80 kx {A,B,C}'], 'D excluded');
    assert.deepEqual(await scopes(page), ['All', '4.80 kx']);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a renamed label shows everywhere, and its undo too', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'sem');
    await loadFiles(page, 'sem', [tif('a.tif', { sign: 'A', seed: 1, pixelNm: 25, mag: 5000 }), tif('b.tif', { sign: 'B', seed: 2, pixelNm: 100, mag: 1250 })]);
    const seen = ()=> page.evaluate(()=> ({
      nav: document.getElementById('semCurName').textContent,
      thumbs: [...document.querySelectorAll('#semThumbs .sem-thumb-cap')].map(c=> c.textContent),
      groups: [...document.querySelectorAll('#semGroups .sem-gimg')].map(c=> c.title),
      ref: [...document.querySelectorAll('#semRef option')].map(o=> o.textContent),
    }));
    const before = await seen();
    const h0 = await history(page, 'sem');
    const lab = page.locator('#semFileTableWrap .file-label[data-i="0"]');
    await lab.fill('A <renamed> & co'); await lab.press('Enter'); await settle(page);
    const s = await seen();
    assert.equal(s.nav, 'A <renamed> & co');
    assert.ok(s.thumbs.includes('A <renamed> & co') && s.groups.includes('A <renamed> & co') && s.ref.includes('A <renamed> & co'), JSON.stringify(s));
    assert.equal((await history(page, 'sem')).index, h0.index + 1, 'one undo step');
    await undo(page);
    assert.deepEqual(await seen(), before);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('crop: a 2-px drag is no edit, a 20-px one moves both linked crops in one undo step', async ()=>{
  const { page, errors, close } = await env.page({ viewport: { width: 1400, height: 1000 } });
  try {
    await openModule(page, 'sem');
    await loadFiles(page, 'sem', [tif('a.tif', { W: 2048, H: 2058, sign: 'A', seed: 1 }), tif('b.tif', { W: 2048, H: 2058, sign: 'B', seed: 2 })]);
    // Crop 1024 at (512, 512), both linked.
    await page.click('#semCropDef'); await settle(page);
    for (const [id, v] of [['#semCropW', '1024'], ['#semCropX', '512'], ['#semCropY', '512']]){ await page.fill(id, v); await page.press(id, 'Enter'); await settle(page); }
    await page.click('#semLinkAll'); await settle(page);
    const crops = async ()=> (await moduleState(page, 'sem')).files.map(f=> [f.crop.x, f.crop.y, f.crop.w, f.crop.h]);
    assert.deepEqual(await crops(), [[512, 512, 1024, 1024], [512, 512, 1024, 1024]]);
    // The canvas's centre, in the page, at the crop's middle (image 2048 × 2048 under its bar).
    const g = await page.evaluate(()=>{
      const cv = document.getElementById('semCropCanvas'); cv.scrollIntoView({ block: 'center' });
      const b = cv.getBoundingClientRect(), s = Math.min(b.width/2048, b.height/2048);
      return { s, cx: b.left + (b.width - s*2048)/2 + 1024*s, cy: b.top + (b.height - s*2048)/2 + 1024*s };
    });
    const drag = async pts=>{
      await page.mouse.move(...pts[0]); await page.mouse.down();
      for (const p of pts.slice(1)) await page.mouse.move(...p);
      await page.mouse.up(); await settle(page);
    };
    const h0 = await history(page, 'sem');
    await drag([[g.cx, g.cy], [g.cx - 1, g.cy], [g.cx - 2, g.cy]]);
    assert.deepEqual(await crops(), [[512, 512, 1024, 1024], [512, 512, 1024, 1024]], '2-px drag');
    assert.deepEqual(await history(page, 'sem'), h0, '2-px drag: no undo step');
    await drag([[g.cx, g.cy], [g.cx - 10, g.cy], [g.cx - 20, g.cy]]);
    const c = await crops();
    assert.ok(c[0][0] < 512 && c[0][0] > 512 - 2*20/g.s, '20-px drag moved the crop left: ' + c[0][0]);
    assert.deepEqual(c[1], c[0], 'the linked crop moved with it');
    assert.equal((await history(page, 'sem')).index, h0.index + 1, 'one undo step');
    assert.equal(await page.inputValue('#semCropX'), String(c[0][0]));
    await undo(page);
    assert.deepEqual(await crops(), [[512, 512, 1024, 1024], [512, 512, 1024, 1024]], 'undone');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
