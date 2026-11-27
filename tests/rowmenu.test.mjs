/* A trace list's row menu (v579, BACKLOG 25; utils.js, the row's menu): a right-click anywhere
   on a row of a module's list opens a menu of what the row's include box and its buttons at
   the right do, made from the one list they are made from (filelist-model.js ROW_ACTS), in
   every module that shows the list (DRS, XRPD, GC, EPR, SEM, Custom, Iodometry): its items the
   row's controls' own words and states, the remove last, apart and red; laid over the page,
   nothing of it moved. Each item does what its control does (the module's state after it the
   same as after the control, a removal undone, a download the file's bytes). The keys: the
   ContextMenu key and Shift+F10 in a row, ↓ ↑ Home End round the items, Enter and Space, ← →
   kept from the samples, Escape and Tab giving the focus back to the row. A finger held on a
   row (touch, through CDP) opens it at the finger, the click it ends with eaten; a finger
   moved, the page scrolled, a short tap or a finger on the grip: none. Ctrl+Z, Ctrl+Y and
   Ctrl+Shift+Z close it before they act (xrdcards 22's kinds' menu, the same), and so does
   the list drawn again; inside the window at its edges; the browser's own menu held back on
   the rows alone, and in a name field being typed in left to it; a right-click while a row is
   dragged by its grip does nothing. On macOS (its platform emulated) a Ctrl+click on a grip,
   a row's or a file's, opens the menu and drags nothing (v582); elsewhere Ctrl and the primary
   button drag as ever. Every file made up. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { start, openModule, loadFiles, settle, download, moduleState, history, saveAs, banner, answer } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const W = mod => `#${mod}FileTableWrap`;
const row = (page, mod, k)=> page.locator(`${W(mod)} tr.file-row`).nth(k);
const opened = page => page.locator('.row-menu').count();
// A Cary Kinetics export of two traces (Iodometry), 301 points each.
function kinetics(){
  const tr = [{ name: 'Trace A', inj: 10.05, k: 0.5, wl: '350.0', when: '7/23/2025 10:17:45 AM' }, { name: 'Trace B', inj: 12.05, k: 0.3, wl: '350.0', when: '7/23/2025 12:07:33 PM' }];
  const T = Array.from({ length: 301 }, (_, j)=> +(0.05 + 0.2*j).toFixed(2));
  let s = tr.map(t=> t.name + ',,').join('') + '\r\n' + tr.map(()=> 'Time (sec),Abs,').join('') + '\r\n';
  T.forEach(t=>{ s += tr.map(r=> `${t.toFixed(2)},${(0.2 + (t >= r.inj ? r.k*(1 - Math.exp(-(t - r.inj)/40)) : 0)).toFixed(10)},`).join('') + '\r\n'; });
  s += '\r\n';
  for (const t of tr) s += `${t.name},\r\n${t.name}\r\nCollection Time: ${t.when}\r\nOperator Name  :\r\nKinetics Version 5.3.0.1079\r\nParameter List :\r\nInstrument  Cary 60\r\nWavelength (nm)  ${t.wl}\r\nOrdinate mode  Abs\r\nAve Time (sec)  0.1000\r\nMethod Log     :\r\nEnd Method Modifications\r\n<Current Wavelength> , ${t.wl}\r\n<Cycle Count> , 1\r\n\r\n`;
  return s;
}
const CUSTOM = 'Time (s),Signal (mV),Ref (mV)\n1,2,4\n2,3,5\n3,4,6\n';
// Each module's files and the rows they make.
const FILES = {
  tauc: e=> [e.fx.files.tauc, 2], xrd: e=> [e.fx.files.xrd, 3], gc: e=> [e.fx.files.gc, 2], epr: e=> [e.fx.files.epr, 2], sem: e=> [e.fx.files.sem, 3],
  fig: ()=> [[{ name: 'a.csv', mimeType: 'text/csv', buffer: Buffer.from(CUSTOM) }], 2],
  iodo: e=> [[e.fx.put('kin.csv', kinetics())], 2],
};
async function load(page, mod){
  await openModule(page, mod);
  const [files, n] = FILES[mod](env);
  await loadFiles(page, mod, files, n);
}

// The menu on show, item by item: [role, words, aria-checked, red, control] or 'sep'.
const items = page => page.$$eval('.row-menu > *', els=> els.map(e=> e.getAttribute('role') === 'separator' ? 'sep'
  : [e.getAttribute('role'), e.textContent, e.getAttribute('aria-checked'), e.classList.contains('is-danger'), e.dataset.ctl]));
// What the row's own controls say the menu should be: its box, then its buttons at the right, those
// that are red last, after a line.
const fromRow = (page, mod, k)=> row(page, mod, k).evaluate(r=>{
  const box = r.querySelector('td.incl-cell input[type="checkbox"]'), ctl = el => [...el.classList].find(c=> c === 'dl-file' || c === 'row-del');
  const all = [['menuitemcheckbox', box.title, String(box.checked), false, box.className],
    ...[...r.querySelectorAll('td.row-acts button')].map(b=> ['menuitem', b.title, null, b.classList.contains('is-danger'), ctl(b)])];
  const keep = all.filter(a=> !a[3]), take = all.filter(a=> a[3]);
  return [...keep, ...(keep.length && take.length ? ['sep'] : []), ...take];
});
// Every box laid out in the module's section, and the page's scroll: what opening the menu must not move.
const layout = (page, mod)=> page.evaluate(mod=> [window.scrollX, window.scrollY, document.documentElement.scrollWidth, document.documentElement.scrollHeight,
  ...[...document.querySelectorAll(`#tab-${mod} *`)].filter(e=> e.getClientRects().length).map(e=>{ const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(v=> v.toFixed(2)).join(','); })].join(';'), mod);
const focused = page => page.evaluate(()=>{ const a = document.activeElement; return a.matches('tr.file-row') ? 'row ' + a.dataset.i : a.closest('.row-menu') ? 'item ' + a.textContent : a.tagName + '.' + a.className; });
const rightClick = (page, mod, k, cell = 'td.fname')=> row(page, mod, k).locator(cell).first().click({ button: 'right' });

test('a row\'s menu, in every module: its items the row\'s controls\' own, the remove last, apart and red; nothing of the page moved', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    for (const mod of ['tauc', 'xrd', 'gc', 'epr', 'sem', 'fig', 'iodo']){
      await load(page, mod);
      // (the second row left out by its box: its item unticked)
      await row(page, mod, 1).locator('.file-incl').click(); await settle(page);
      for (const k of [0, 1]){
        const before = await layout(page, mod);
        await rightClick(page, mod, k);
        assert.equal(await opened(page), 1, `${mod} row ${k}: the menu open`);
        const want = await fromRow(page, mod, k);
        assert.deepEqual(await items(page), want, `${mod} row ${k}: the row's controls, in their words and states`);
        assert.deepEqual(want.map(a=> a === 'sep' ? a : [a[1], a[2], a[3]]), [['Include in the analysis', String(!k), false], ['Download its file', null, false], 'sep', ['Remove', null, true]], mod);
        assert.deepEqual(await page.$eval('.row-menu', m=> [m.getAttribute('role'), m.classList.contains('an-menu'), getComputedStyle(m).position]), ['menu', true, 'fixed'], 'the app\'s menu, laid over the page');
        assert.deepEqual(await row(page, mod, k).evaluate(r=> [r.getAttribute('aria-haspopup'), r.getAttribute('aria-expanded'), r.classList.contains('menu-on')]), ['menu', 'true', true], `${mod} row ${k}: its row`);
        assert.equal(await focused(page), 'item Include in the analysis', 'the focus on its first item');
        assert.equal(await layout(page, mod), before, `${mod} row ${k}: nothing moved`);
        await page.keyboard.press('Escape');
        assert.equal(await opened(page), 0);
        assert.equal(await focused(page), 'row ' + k, `${mod} row ${k}: the focus back on the row`);
        assert.deepEqual(await row(page, mod, k).evaluate(r=> [r.hasAttribute('aria-expanded'), r.classList.contains('menu-on')]), [false, false]);
      }
    }
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* Each item against its control, in DRS (the module kit's list), XRPD and SEM (their own
   callbacks): the state after the item the state after the control; a removal undone, the
   rows back; the download the control's. */
test('each item does what its control does: include, remove (undone), download', async ()=>{
  const { page, errors, close } = await env.page();
  const pick = async (mod, k, words)=>{ await rightClick(page, mod, k); await page.locator('.row-menu [data-ctl]', { hasText: words }).click(); await settle(page); };
  const rows = mod => page.$$eval(`${W(mod)} tr.file-row`, rs=> rs.map(r=> [r.querySelector('.file-label').value, r.querySelector('.file-incl').checked]));
  try {
    for (const mod of ['tauc', 'xrd', 'sem']){
      await load(page, mod);
      const r0 = await rows(mod), s0 = await moduleState(page, mod), h0 = (await history(page, mod)).index;
      for (const [words, ctl] of [['Include in the analysis', '.file-incl'], ['Remove', '.row-del']]){
        await pick(mod, 1, words);
        const byMenu = await moduleState(page, mod), r1 = await rows(mod);
        assert.equal((await history(page, mod)).index, h0 + 1, `${mod} ${words}: a step`);
        assert.notDeepEqual(r1, r0, `${mod} ${words}: done`);
        await page.keyboard.press('Control+z'); await settle(page);
        assert.deepEqual([await rows(mod), await moduleState(page, mod)], [r0, s0], `${mod} ${words}: undone`);
        await row(page, mod, 1).locator(ctl).click(); await settle(page);
        assert.deepEqual([await rows(mod), await moduleState(page, mod)], [r1, byMenu], `${mod} ${words}: as its control does`);
        await page.keyboard.press('Control+z'); await settle(page);
      }
      const byMenu = await download(page, async ()=>{ await rightClick(page, mod, 0); await page.click('.row-menu [data-ctl="dl-file"]'); });
      assert.equal(await focused(page), 'row 0', mod + ': the focus on the row');
      const byButton = await download(page, ()=> row(page, mod, 0).locator('.dl-file').click());
      assert.equal(byMenu.name, path.basename(FILES[mod](env)[0][0]), mod + ': the file, under its name');
      assert.ok(byMenu.buf.equals(fs.readFileSync(FILES[mod](env)[0][0])) && byMenu.buf.equals(byButton.buf), mod + ': its bytes, as its button gives them');
    }
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('the keys: ContextMenu and Shift+F10 in a row, ↓ ↑ Home End round the items, Enter and Space, ← → kept from the samples, Escape and Tab', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await load(page, 'tauc');
    const count = ()=> page.locator('#tab-tauc .an-card .nav-count').first().textContent();
    const n0 = await count();
    await row(page, 'tauc', 0).locator('.file-incl').focus();
    await page.keyboard.press('ContextMenu');
    assert.equal(await opened(page), 1, 'the ContextMenu key');
    const [m, r] = await Promise.all([page.locator('.row-menu').boundingBox(), row(page, 'tauc', 0).boundingBox()]);
    assert.ok(Math.abs(m.y - (r.y + r.height + 6)) < 1 && Math.abs(m.x - Math.max(8, r.x)) < 1, `under the row, from its left: ${JSON.stringify([m, r])}`);
    const walk = [];
    for (const k of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'ArrowRight', 'ArrowLeft']){ await page.keyboard.press(k); walk.push(await focused(page)); }
    assert.deepEqual(walk.map(w=> w.slice(5)), ['Download its file', 'Remove', 'Include in the analysis', 'Remove', 'Include in the analysis', 'Remove', 'Remove', 'Remove']);
    assert.equal(await count(), n0, '← → do not step the samples under the menu');
    await page.keyboard.press('Escape');
    assert.deepEqual([await opened(page), await focused(page)], [0, 'row 0'], 'Escape: the focus back on the row');
    // Shift+F10 from the row itself; Enter on the download.
    await page.keyboard.press('Shift+F10');
    assert.equal(await opened(page), 1, 'Shift+F10');
    await page.keyboard.press('ArrowDown');
    const d = await download(page, ()=> page.keyboard.press('Enter'));
    assert.equal(d.name, 'drs1.csv');
    assert.deepEqual([await opened(page), await focused(page)], [0, 'row 0']);
    // Space on the box's item: left out; the row drawn again keeps the focus.
    const h0 = (await history(page, 'tauc')).index;
    await page.keyboard.press('Shift+F10'); await page.keyboard.press('Space'); await settle(page);
    assert.deepEqual([await row(page, 'tauc', 0).locator('.file-incl').isChecked(), (await history(page, 'tauc')).index, await focused(page)], [false, h0 + 1, 'row 0']);
    // Tab closes it; the remove's item by the keys; then the focus on the row in its place.
    await page.keyboard.press('Shift+F10'); await page.keyboard.press('Tab');
    assert.deepEqual([await opened(page), await focused(page)], [0, 'row 0'], 'Tab');
    await page.keyboard.press('Shift+F10'); await page.keyboard.press('End'); await page.keyboard.press('Enter'); await settle(page);
    assert.deepEqual([await page.locator(`${W('tauc')} tr.file-row`).count(), await focused(page)], [1, 'row 0'], 'removed, the next row focused');
    // The ContextMenu key in a name field: the field's own menu.
    await row(page, 'tauc', 0).locator('.file-label').focus();
    await page.keyboard.press('ContextMenu');
    assert.equal(await opened(page), 0, 'not from a name field');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a finger held on a row opens its menu, the click it ends with eaten; moved, the page scrolled, a tap or on the grip: none', async ()=>{
  const { page, ctx, errors, close } = await env.page({ touch: true, viewport: { width: 800, height: 600 } });
  try {
    await load(page, 'tauc');
    const cdp = await ctx.newCDPSession(page);
    const at = async (k, sel)=>{ const b = await row(page, 'tauc', k).locator(sel).first().boundingBox(); return { x: b.x + b.width/2, y: b.y + b.height/2 }; };
    const touch = (type, p)=> cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1 }] : [] });
    const hold = async (p, ms, mid)=>{ await touch('touchStart', p); if (mid) await mid(); await page.waitForTimeout(ms); const n = await opened(page); await touch('touchEnd'); await settle(page); return n; };
    const h0 = (await history(page, 'tauc')).index;
    // Held on the file's name: the menu at the finger.
    const p = await at(0, 'td.fname');
    assert.equal(await hold(p, 750), 1, 'held: the menu');
    const m = await page.locator('.row-menu').boundingBox();
    assert.ok(Math.abs(m.x - p.x) < 1 && Math.abs(m.y - p.y) < 1, `at the finger: ${JSON.stringify([m, p])}`);
    assert.equal(await opened(page), 1, 'still open, the finger lifted');
    await page.keyboard.press('Escape');
    // Held on the include box: the box as it was (the click the hold ends with, if any, eaten).
    assert.equal(await hold(await at(0, '.file-incl'), 750), 1);
    assert.deepEqual([await row(page, 'tauc', 0).locator('.file-incl').isChecked(), (await history(page, 'tauc')).index], [true, h0], 'the box untouched');
    // A tap on an item: done.
    const it = await page.locator('.row-menu [data-ctl="row-del"]').boundingBox();
    await page.touchscreen.tap(it.x + it.width/2, it.y + it.height/2); await settle(page);
    assert.deepEqual([await opened(page), await page.locator(`${W('tauc')} tr.file-row`).count(), (await history(page, 'tauc')).index], [0, 1, h0 + 1], 'removed by a tap on its item');
    await page.keyboard.press('Control+z'); await settle(page);
    // Moved 12 px, the page scrolled, a short tap, the grip: no menu.
    const q = await at(1, 'td.fname');
    assert.equal(await hold(q, 750, async ()=>{ for (const dx of [4, 8, 12]){ await touch('touchMove', { x: q.x + dx, y: q.y }); } }), 0, 'moved: none');
    assert.equal(await hold(q, 750, ()=> page.evaluate(()=> window.scrollBy(0, 40))), 0, 'the page scrolled: none');
    await page.evaluate(()=> window.scrollTo(0, 0)); await settle(page);
    assert.equal(await hold(await at(1, 'td.fname'), 120), 0, 'a tap: none');
    await page.waitForTimeout(600);
    assert.equal(await opened(page), 0, 'nor after');
    assert.equal(await hold(await at(1, '.drag-handle'), 750), 0, 'on the grip: none');
    assert.equal(await page.locator(`${W('tauc')} tr.file-row`).count(), 2);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* As the kinds' menu through a step (xrdcards 22): the history's keys close it before they act,
   and the step is done, nothing lost; the list drawn again otherwise closes it too. */
test('Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z close the menu before they act; the list drawn again closes it', async ()=>{
  const { page, errors, close } = await env.page();
  const rows = ()=> page.$$eval(`${W('tauc')} tr.file-row`, rs=> rs.map(r=> r.querySelector('.file-label').value));
  try {
    await load(page, 'tauc');
    await row(page, 'tauc', 1).locator('.row-del').click(); await settle(page);
    const h = (await history(page, 'tauc')).index;
    for (const [key, n, at] of [['Control+z', 2, h - 1], ['Control+y', 1, h], ['Control+z', 2, h - 1], ['Control+Shift+Z', 1, h]]){
      await rightClick(page, 'tauc', 0);
      assert.equal(await opened(page), 1);
      await page.keyboard.press(key); await settle(page);
      assert.deepEqual([await opened(page), (await rows()).length, (await history(page, 'tauc')).index], [0, n, at], key + ': closed, then done');
    }
    // Nothing lost after: a name typed reaches the state, the menu opens on the rows drawn since.
    const lab = row(page, 'tauc', 0).locator('.file-label');
    await lab.fill('mine'); await lab.press('Enter'); await settle(page);
    assert.equal((await moduleState(page, 'tauc')).files[0].label, 'mine');
    await rightClick(page, 'tauc', 0);
    assert.deepEqual(await items(page), await fromRow(page, 'tauc', 0));
    // The list drawn again with the menu open (its include-all box pressed by a script): closed.
    await page.evaluate(id=> document.querySelector(id + ' .incl-all').click(), W('tauc')); await settle(page);
    assert.equal(await opened(page), 0, 'closed with the list drawn again');
    assert.equal(await row(page, 'tauc', 0).locator('.file-incl').isChecked(), false);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('the menu inside the window: at the pointer where there is room, else over it and short of the right edge', async ()=>{
  const { page, errors, close } = await env.page({ viewport: { width: 375, height: 700 } });
  try {
    await load(page, 'tauc');
    // (the window's bottom 20 px under the last row: no room under it for the menu)
    const r = await row(page, 'tauc', 1).boundingBox(), H = Math.ceil(r.y + r.height + 20), x = r.x + r.width - 3, y = r.y + r.height - 3;
    await page.setViewportSize({ width: 375, height: H }); await settle(page);
    await page.mouse.click(x, y, { button: 'right' });
    const m = await page.locator('.row-menu').boundingBox();
    assert.ok(m.x >= 8 - 0.5 && m.x + m.width <= 375 - 8 + 0.5 && m.y >= 8 - 0.5 && m.y + m.height <= H - 8 + 0.5, `inside the window by 8 px: ${JSON.stringify([m, H])}`);
    assert.ok(Math.abs(m.y + m.height - y) < 1 && Math.abs(m.x + m.width - (375 - 8)) < 1 && m.x < x, `over the pointer, the window ending under it; pushed in from its right edge: ${JSON.stringify([m, x, y])}`);
    assert.equal(await page.evaluate(()=> document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, 'no sideways scroll');
    await page.keyboard.press('Escape');
    // Room: its corner on the pointer.
    await page.setViewportSize({ width: 375, height: 700 }); await settle(page);
    const b = await row(page, 'tauc', 0).locator('td.fname').boundingBox(), px = b.x + 4, py = b.y + 4;
    await page.mouse.click(px, py, { button: 'right' });
    const m2 = await page.locator('.row-menu').boundingBox();
    assert.ok(Math.abs(m2.x - px) < 1 && Math.abs(m2.y - py) < 1, `at the pointer: ${JSON.stringify([m2, px, py])}`);
    // A scroll and a resize close it.
    await page.evaluate(()=> window.scrollBy(0, 30)); await settle(page);
    assert.equal(await opened(page), 0, 'closed by a scroll');
    await page.mouse.click(px, py - 30, { button: 'right' });
    assert.equal(await opened(page), 1);
    await page.setViewportSize({ width: 380, height: 700 }); await settle(page);
    assert.equal(await opened(page), 0, 'closed by a resize');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('the browser\'s own menu held back on the rows alone: the head, the drop zone, a plot and a name field typed in keep it', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await load(page, 'tauc');
    await page.evaluate(()=>{ window.__cm = []; window.addEventListener('contextmenu', e=> window.__cm.push(e.defaultPrevented)); });
    const tried = async loc =>{
      await loc.click({ button: 'right' });
      const r = [await page.evaluate(()=> window.__cm.pop()), await opened(page)];
      await page.keyboard.press('Escape');
      return r;
    };
    assert.deepEqual(await tried(row(page, 'tauc', 0).locator('td.fname')), [true, 1], 'a row: held back, the row\'s menu');
    assert.deepEqual(await tried(row(page, 'tauc', 1).locator('.drag-handle')), [true, 1], 'its grip too');
    assert.deepEqual(await tried(row(page, 'tauc', 1).locator('.file-label')), [true, 1], 'its name field, not typed in');
    assert.deepEqual(await tried(page.locator(`${W('tauc')} thead th`).nth(2)), [false, 0], 'the head');
    assert.deepEqual(await tried(page.locator('#taucDropzone')), [false, 0], 'the drop zone');
    assert.deepEqual(await tried(page.locator('#tab-tauc svg.plot').first()), [false, 0], 'a plot');
    await row(page, 'tauc', 0).locator('.file-label').click();
    assert.deepEqual(await tried(row(page, 'tauc', 0).locator('.file-label')), [false, 0], 'a name field typed in: its own');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a right-click while a row is dragged by its grip does nothing; the drag goes on', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await load(page, 'xrd');
    const names = ()=> page.$$eval(`${W('xrd')} tr.file-row td.fname`, ts=> ts.map(t=> t.textContent));
    const n0 = await names(), h0 = (await history(page, 'xrd')).index;
    // (not dragged: its grip opens the menu, as the rest of the row)
    await rightClick(page, 'xrd', 0, '.drag-handle');
    assert.equal(await opened(page), 1);
    await page.keyboard.press('Escape');
    const g = await row(page, 'xrd', 0).locator('.drag-handle').boundingBox(), r = await row(page, 'xrd', 2).boundingBox();
    await page.mouse.move(g.x + g.width/2, g.y + g.height/2);
    await page.mouse.down();
    await page.mouse.move(g.x + g.width/2, r.y + r.height*0.8, { steps: 8 });
    await page.mouse.down({ button: 'right' });
    assert.equal(await opened(page), 0, 'no menu mid-drag');
    await page.mouse.up({ button: 'right' });
    await page.mouse.up();
    await settle(page);
    assert.deepEqual([await names(), (await history(page, 'xrd')).index, await opened(page)], [[...n0.slice(1), n0[0]], h0 + 1, 0], 'the drag done, as without the right button');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* v582: on macOS a Ctrl+click is the right button's: it comes as the primary button's press,
   Ctrl held, then asks for the menu (contextmenu, dispatched here: Chromium on another system
   asks for none). On a grip, a row's or a file's own, it opens the row's menu and drags
   nothing (to v581 the drag began, and the menu, asked for during it, did not open: the row
   then moved with the pointer). The platform emulated as the browser names it
   (navigator.userAgentData, navigator.platform); on another, Ctrl and the primary button
   drag as ever. */
const asMac = (page, on)=> page.evaluate(on=>{
  for (const [k, v] of [['platform', on ? 'MacIntel' : 'Linux x86_64'], ['userAgentData', { platform: on ? 'macOS' : 'Linux', brands: [], mobile: false }]])
    Object.defineProperty(Navigator.prototype, k, { get: ()=> v, configurable: true });
}, on);
async function ctrlClick(page, grip, to){
  const g = await grip.boundingBox(), x = g.x + g.width/2, y = g.y + g.height/2;
  await page.keyboard.down('Control');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await grip.evaluate((el, [x, y])=> el.dispatchEvent(new PointerEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, ctrlKey: true })), [x, y]);
  await page.mouse.move(x, to, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Control');
  await settle(page);
}
test('macOS: a Ctrl+click on a grip, a row\'s or a file\'s, opens the row\'s menu and drags nothing (v582)', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await load(page, 'xrd');
    const names = ()=> page.$$eval(`${W('xrd')} tr.file-row td.fname`, ts=> ts.map(t=> t.textContent));
    const n0 = await names(), h0 = (await history(page, 'xrd')).index, far = async ()=>{ const r = await row(page, 'xrd', 2).boundingBox(); return r.y + r.height*0.8; };
    // Another system: Ctrl and the primary button on a grip drag the row, as ever.
    await asMac(page, false);
    await ctrlClick(page, row(page, 'xrd', 0).locator('.drag-handle'), await far());
    const n1 = [...n0.slice(1), n0[0]];
    assert.deepEqual([await names(), (await history(page, 'xrd')).index, await opened(page)], [n1, h0 + 1, 0], 'dragged, the menu asked for mid-drag not opened');
    // macOS: the menu, the row where it was.
    await asMac(page, true);
    await ctrlClick(page, row(page, 'xrd', 0).locator('.drag-handle'), await far());
    assert.deepEqual([await opened(page), await names(), (await history(page, 'xrd')).index], [1, n1, h0 + 1], 'the menu open, the row where it was, no step');
    assert.equal(await row(page, 'xrd', 0).evaluate(r=> r.classList.contains('menu-on') && !r.classList.contains('dragging')), true);
    await page.keyboard.press('Escape');
    // A file's own grip (EPR's list, a .DTA and its .DSC): the same.
    await load(page, 'epr');
    const parts = ()=> page.$$eval(`${W('epr')} tr.file-row`, trs=> trs.map(tr=> [...tr.querySelectorAll('.fname-text')].map(e=> e.textContent).join(' + ')));
    const p0 = await parts(), e0 = (await history(page, 'epr')).index, r1 = await row(page, 'epr', 1).boundingBox();
    await ctrlClick(page, row(page, 'epr', 0).locator('.fpart-grip').last(), r1.y + r1.height/2);
    assert.deepEqual([await opened(page), await parts(), (await history(page, 'epr')).index], [1, p0, e0], 'the menu open, the file in its row, no step');
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* ---- v585: the other lists whose rows have actions (utils.js wireRowMenu, ctlMenu) ----
   The Rietveld card's phases (its CIFs: the tick, or in the standard's window the choice, the
   download, the ×), the standard's file in XRPD's standard's window (its ×), GC's Calibration
   window's standards (gctcd-ui.test.mjs) and the Projects list (Export .csv, Export
   .datatreat, Delete): a row's menu read off its own controls, in their names and states, the
   red ones last after a line, a control disabled its item disabled (doing nothing); opened,
   named, keyed and closed as the trace list's, each item doing what its control does, through
   its handler. */
// What a row's controls (`sel`) say its menu should be: [role, words, aria-checked, red, aria-disabled], the red last after a line.
const fromCtls = (loc, sel)=> loc.evaluate((r, sel)=>{
  const all = [...r.querySelectorAll(sel)].map(c=>{ const box = c.type === 'checkbox' || c.type === 'radio';
    return [box ? (c.type === 'radio' ? 'menuitemradio' : 'menuitemcheckbox') : 'menuitem', c.getAttribute('aria-label') || c.title, box ? String(c.checked) : null,
      c.classList.contains('is-danger'), c.disabled || c.getAttribute('aria-disabled') === 'true' ? 'true' : null]; });
  const keep = all.filter(a=> !a[3]), take = all.filter(a=> a[3]);
  return [...keep, ...(keep.length && take.length ? ['sep'] : []), ...take];
}, sel);
// (its words after its icon: the Projects' icons hold letters of their own, CSV, JSON)
const shownItems = page => page.$$eval('.row-menu > *', els=> els.map(e=> e.getAttribute('role') === 'separator' ? 'sep'
  : [e.getAttribute('role'), e.lastChild.textContent, e.getAttribute('aria-checked'), e.classList.contains('is-danger'), e.getAttribute('aria-disabled')]));
// The menu's name, the row's state while it is open, and whether the focus is on the row.
const menuOf = page => page.$eval('.row-menu', m=> [m.getAttribute('role'), m.getAttribute('aria-label'), getComputedStyle(m).position]);
const rowState = loc => loc.evaluate(r=> [r.getAttribute('aria-haspopup'), r.getAttribute('aria-expanded'), r.classList.contains('menu-on'), r.tabIndex]);
const onRow = loc => loc.evaluate(r=> document.activeElement === r);
const item = (page, words)=> page.locator('.row-menu [data-ctl]', { hasText: words });

test('v585: the Rietveld card\'s phases: a row\'s menu of its tick, its download and its ×, read off them; each item its control\'s; the keys; Ctrl+Z', async ()=>{
  const { page, errors, close } = await env.page();
  const P = '#xrdR2', ROW = k => page.locator(`${P}PhaseList .rv-cif`).nth(k), phases = async ()=> (await moduleState(page, 'xrd')).cards.find(c=> c.id === 2).states.rietveld.phases;
  try {
    await load(page, 'xrd');
    await page.setInputFiles(P + 'CifInput', [env.fx.cif, env.fx.tetra]);
    await page.waitForFunction(p=> document.querySelectorAll(p + 'PhaseList .rv-cif').length === 2, P); await settle(page);
    for (const k of [0, 1]){
      await ROW(k).locator('.rv-cif-f').click({ button: 'right' });
      assert.equal(await opened(page), 1, `phase ${k}: the menu`);
      const want = await fromCtls(ROW(k), 'input, button'), name = await ROW(k).evaluate(r=> r.title.split(' · ')[0]);
      assert.deepEqual(await shownItems(page), want, `phase ${k}: its controls, in their names and states`);
      assert.deepEqual(want.map(a=> a === 'sep' ? a : [a[0], a[2], a[3], a[4]]), [['menuitemcheckbox', 'true', false, null], ['menuitem', null, false, null], 'sep', ['menuitem', null, true, null]]);
      assert.deepEqual(want.filter(a=> a !== 'sep').map(a=> a[1]), [`Refine ${name} on this pattern`, `Download the CIF of ${name}`, `Remove ${name}`]);
      assert.deepEqual(await menuOf(page), ['menu', name, 'fixed']);
      assert.deepEqual(await rowState(ROW(k)), ['menu', 'true', true, -1]);
      await page.keyboard.press('Escape');
      assert.deepEqual([await opened(page), await onRow(ROW(k))], [0, true], `phase ${k}: Escape, the focus back on its row`);
    }
    // Each item as its control: the tick (a step, undone), the download (its bytes), the × (undone).
    const h0 = (await history(page, 'xrd')).index, ph0 = await phases();
    await ROW(1).click({ button: 'right' }); await item(page, 'Refine').click(); await settle(page);
    const byMenu = await phases();
    assert.deepEqual([(await history(page, 'xrd')).index, await ROW(1).locator('input[data-on]').isChecked()], [h0 + 1, false], 'the tick: off, a step');
    await page.keyboard.press('Control+z'); await settle(page);
    assert.deepEqual(await phases(), ph0);
    await ROW(1).locator('input[data-on]').click(); await settle(page);
    assert.deepEqual(await phases(), byMenu, 'as its control does');
    await page.keyboard.press('Control+z'); await settle(page);
    const dMenu = await download(page, async ()=>{ await ROW(0).click({ button: 'right' }); await item(page, 'Download').click(); });
    const dBtn = await download(page, ()=> ROW(0).locator('[data-dl]').click());
    assert.deepEqual([dMenu.name, dMenu.buf.equals(dBtn.buf), (await history(page, 'xrd')).index], [dBtn.name, true, h0], 'the download: its button\'s, no step');
    // The keys: Shift+F10 from the row's tick, ↓ to the ×, Enter; the next row focused.
    await ROW(0).locator('input[data-on]').focus();
    await page.keyboard.press('Shift+F10');
    assert.equal(await opened(page), 1, 'Shift+F10');
    await page.keyboard.press('End'); await page.keyboard.press('Enter'); await settle(page);
    assert.deepEqual([await page.locator(`${P}PhaseList .rv-cif`).count(), (await history(page, 'xrd')).index, await onRow(ROW(0))], [1, h0 + 1, true], 'removed by its ×, the row in its place focused');
    // Ctrl+Z with the menu open: closed, then undone.
    await ROW(0).click({ button: 'right' });
    await page.keyboard.press('Control+z'); await settle(page);
    assert.deepEqual([await opened(page), await page.locator(`${P}PhaseList .rv-cif`).count()], [0, 2], 'Ctrl+Z: closed, the phase back');
    /* A scroll: one that moves its row closes it; the press's own, the row scrolled into view
       before the menu opens (its event a frame later), does not (v585: it closed it at once). */
    await page.evaluate(()=> window.scrollTo(0, 0)); await settle(page);
    await ROW(0).locator('.rv-cif-f').click({ button: 'right' }); await settle(page);
    assert.equal(await opened(page), 1, 'scrolled into view by the press: open');
    await page.evaluate(()=> window.scrollBy(0, 40)); await settle(page);
    assert.equal(await opened(page), 0, 'a scroll moving its row: closed');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('v585: the standard\'s window: its phase\'s menu (its choice, the built-in\'s × disabled) and its file\'s (its ×); Escape closes the menu, not the window', async ()=>{
  const { page, errors, close } = await env.page();
  const S = '#xrdStdR', W = '#xrdStdRv', LAB = page.locator(`${S}PhaseList .rv-cif`).first(), FILE = page.locator(`${W} .xrd-std-file .xrd-std-row`);
  try {
    await load(page, 'xrd');
    await page.click('#xrdR2Std'); await page.waitForSelector(W, { state: 'visible' }); await settle(page);
    await LAB.click({ button: 'right' });
    const want = await fromCtls(LAB, 'input, button');
    assert.deepEqual(await shownItems(page), want);
    assert.deepEqual(want.map(a=> a === 'sep' ? a : [a[0], a[2], a[3], a[4]]), [['menuitemradio', 'true', false, null], ['menuitem', null, false, null], 'sep', ['menuitem', null, true, 'true']], 'the choice; the built-in\'s × disabled');
    assert.equal(await item(page, 'Remove').getAttribute('title'), 'Built in: it cannot be removed', 'why, in its tooltip');
    await item(page, 'Remove').click({ force: true }); await settle(page);
    assert.deepEqual([await opened(page), await page.locator(`${S}PhaseList .rv-cif`).count()], [1, 1], 'a disabled item does nothing, the menu open');
    await page.keyboard.press('Escape');
    assert.deepEqual([await opened(page), await page.isVisible(W), await onRow(LAB)], [0, true, true], 'Escape: the menu closed, the window open');
    // The standard's file: its × alone, red, no line; named by its file; Enter removes it, undone.
    await page.setInputFiles(W + 'Files', env.fx.std);
    await FILE.waitFor(); await settle(page);
    const h0 = (await history(page, 'xrd')).index;
    await FILE.locator('.xrd-std-name').click({ button: 'right' });
    assert.deepEqual(await shownItems(page), [['menuitem', 'Remove the standard', null, true, null]]);
    assert.deepEqual(await shownItems(page), await fromCtls(FILE, 'button'));
    assert.deepEqual([(await menuOf(page))[1], ...(await rowState(FILE))], ['s11.xrdml', 'menu', 'true', true, -1]);
    await page.locator(`${W} .xrd-std-head`).click({ position: { x: 4, y: 4 } });
    assert.deepEqual([await opened(page), await page.isVisible(W)], [0, true], 'a press elsewhere in the window closes it');
    await FILE.focus(); await page.keyboard.press('ContextMenu');
    assert.equal(await opened(page), 1, 'the ContextMenu key');
    await page.keyboard.press('Enter'); await settle(page);
    assert.deepEqual([await FILE.count(), (await history(page, 'xrd')).index, await page.isVisible(W)], [0, h0 + 1, true], 'removed, a step');
    await page.keyboard.press('Control+z'); await settle(page);
    assert.equal(await FILE.count(), 1, 'undone');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('v585: the Projects list: a row\'s menu of its buttons, Delete last and red; a finger held; the browser\'s in a name typed in; closed by a press elsewhere, Ctrl+Z, the list drawn again', async ()=>{
  const { page, ctx, errors, close } = await env.page({ touch: true });
  const ROW = page.locator('#sessListWrap tr.sess-row').first();
  try {
    await load(page, 'tauc');
    await saveAs(page, 'P <1>');
    await page.click('#nav button[data-tab="projects"]'); await ROW.waitFor(); await settle(page);
    await ROW.locator('.pill').click({ button: 'right' });
    const want = await fromCtls(ROW, '.row-acts button');
    assert.deepEqual(await shownItems(page), want);
    assert.deepEqual(want, [['menuitem', 'Export .csv', null, false, null], ['menuitem', 'Export .datatreat', null, false, null], 'sep', ['menuitem', 'Delete', null, true, null]]);
    assert.deepEqual([(await menuOf(page))[1], ...(await rowState(ROW))], ['P <1>', 'menu', 'true', true, -1]);
    // Export .datatreat: its button's file; Delete: its question, declined.
    const dMenu = await download(page, ()=> item(page, 'Export .datatreat').click());
    const dBtn = await download(page, ()=> ROW.locator('.pr-json').click());
    assert.equal(dMenu.name, dBtn.name);
    assert.deepEqual(JSON.parse(dMenu.buf.toString('utf8')).state, JSON.parse(dBtn.buf.toString('utf8')).state, 'its project');
    await ROW.locator('.pill').click({ button: 'right' }); await item(page, 'Delete').click();
    assert.equal((await banner(page)).text, 'Delete project “P <1>”? This cannot be undone.');
    await answer(page, 'x');
    assert.equal(await page.locator('#sessListWrap tr.sess-row').count(), 1, 'declined: kept');
    // A finger held on it: the menu at the finger, the click it ends with eaten (the project not opened).
    const cdp = await ctx.newCDPSession(page), b = await ROW.locator('.pill').boundingBox(), p = { x: b.x + b.width/2, y: b.y + b.height/2 };
    const touch = (type, q)=> cdp.send('Input.dispatchTouchEvent', { type, touchPoints: q ? [{ x: q.x, y: q.y, id: 1 }] : [] });
    await touch('touchStart', p); await page.waitForTimeout(750); await touch('touchEnd'); await settle(page);
    assert.deepEqual([await opened(page), await page.isVisible('#sessListWrap')], [1, true], 'held: the menu, the list still on show');
    const m = await page.locator('.row-menu').boundingBox();
    assert.ok(Math.abs(m.x - p.x) < 1 && Math.abs(m.y - p.y) < 1, `at the finger: ${JSON.stringify([m, p])}`);
    // Closed by a press elsewhere, by Ctrl+Z, by the list drawn again (a sort header pressed by a script).
    await page.mouse.click(5, 5);
    assert.equal(await opened(page), 0, 'a press elsewhere');
    await ROW.locator('.pill').click({ button: 'right' }); await page.keyboard.press('Control+z');
    assert.equal(await opened(page), 0, 'Ctrl+Z');
    await ROW.locator('.pill').click({ button: 'right' });
    await page.evaluate(()=> document.querySelector('#sessListWrap .sess-sort').click());
    await page.waitForFunction(()=> !document.querySelector('.row-menu'));
    // The name field typed in: the browser's own menu.
    await page.evaluate(()=>{ window.__cm = []; window.addEventListener('contextmenu', e=> window.__cm.push(e.defaultPrevented)); });
    await ROW.locator('.proj-rename').click();
    await ROW.locator('.proj-rename').click({ button: 'right' });
    assert.deepEqual([await page.evaluate(()=> window.__cm.pop()), await opened(page)], [false, 0], 'a name typed in: its own');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* ---- v587: the lists left whose rows have a × of their own (utils.js wireRowMenu, ctlMenu) ----
   XRPD's peaks table (a sample's card and the standard's window), Iodometry's standards, the
   Custom cards' series and the figure composer's panels and divisions (a division's head where
   the series has more than one): a row's menu of its ×, red, named by its row; opened, keyed and
   closed as every list's, the item doing what the × does, through its handler. */
test('v587: XRPD\'s peaks table: a row\'s menu of its ×, named by its peak; the item removes the peak as its × does; the keys; the standard\'s window\'s table', async ()=>{
  const { page, errors, close } = await env.page();
  const T = '#xrdA1PeakTableWrap', ROW = k => page.locator(`${T} tr.peak-row`).nth(k), n = ()=> page.locator(`${T} tr.peak-row`).count();
  const removed = async ()=> (await moduleState(page, 'xrd')).cards.find(c=> c.id === 1).states.scherrer.removedPeaks;
  try {
    await load(page, 'xrd');
    const n0 = await n(), h0 = (await history(page, 'xrd')).index, r0 = await removed();
    assert.ok(n0 > 2, 'peaks found');
    await ROW(1).locator('td').nth(1).click({ button: 'right' });
    const want = await fromCtls(ROW(1), '.peak-del'), [num, tt] = await ROW(1).evaluate(r=> [r.cells[0].textContent, r.cells[1].textContent]);
    assert.deepEqual([await shownItems(page), want], [want, [['menuitem', 'Remove peak', null, true, null]]], 'its ×, red');
    assert.deepEqual([(await menuOf(page))[1], ...(await rowState(ROW(1)))], [`Peak ${num} at ${tt}°`, 'menu', 'true', true, -1]);
    assert.equal(await ROW(1).evaluate(r=> r.classList.contains('selected')), false, 'not picked by the right button');
    await item(page, 'Remove peak').click(); await settle(page);
    const byMenu = await removed();
    assert.deepEqual([await n(), (await history(page, 'xrd')).index, await onRow(ROW(1))], [n0 - 1, h0 + 1, true], 'removed, a step, the next row focused');
    await page.keyboard.press('Control+z'); await settle(page);
    assert.deepEqual([await n(), await removed()], [n0, r0], 'undone');
    await ROW(1).locator('.peak-del').click(); await settle(page);
    assert.deepEqual(await removed(), byMenu, 'as its × does');
    await page.keyboard.press('Control+z'); await settle(page);
    // The keys: the ContextMenu key on a row, Escape back to it; Shift+F10 and Enter.
    await ROW(0).focus(); await page.keyboard.press('ContextMenu');
    assert.equal(await opened(page), 1, 'the ContextMenu key');
    await page.keyboard.press('Escape');
    assert.deepEqual([await opened(page), await onRow(ROW(0))], [0, true]);
    await page.keyboard.press('Shift+F10'); await page.keyboard.press('Enter'); await settle(page);
    assert.deepEqual([await n(), await onRow(ROW(0))], [n0 - 1, true], 'Enter: removed, the row in its place focused');
    // The standard's window's table: its rows' menu too; Escape closes the menu, not the window.
    const W = '#xrdStdPeaks', SR = page.locator('#xrdStdAPeakTableWrap tr.peak-row');
    await page.click('#xrdA1Std'); await page.waitForSelector(W, { state: 'visible' });
    await page.setInputFiles(W + 'Files', env.fx.std);
    await SR.first().waitFor(); await settle(page);
    const s0 = await SR.count();
    await SR.nth(0).locator('td').nth(1).click({ button: 'right' });
    assert.deepEqual(await shownItems(page), [['menuitem', 'Remove peak', null, true, null]]);
    await page.keyboard.press('Escape');
    assert.deepEqual([await opened(page), await page.isVisible(W)], [0, true], 'Escape: the menu closed, the window open');
    await SR.nth(0).click({ button: 'right' }); await item(page, 'Remove peak').click(); await settle(page);
    assert.equal(await SR.count(), s0 - 1, 'the standard\'s peak removed');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('v587: Iodometry\'s standards: a row\'s menu of its ×, red; the item removes the standard as its × does; Escape closes the menu, not the window', async ()=>{
  const { page, errors, close } = await env.page();
  const CAL = '.iodo-cal:not([style*="none"])', ROW = k => page.locator(`${CAL} .iodo-std tbody tr`).nth(k);
  const vals = ()=> page.$$eval(`${CAL} .iodo-std tbody tr`, rs=> rs.map(r=> [...r.querySelectorAll('input')].map(i=> i.value)));
  const S = [['0', '0.012'], ['1', '0.405'], ['2', '0.83']];
  const fill = async ()=>{ for (let i = 0; i < 3; i++) for (const j of [0, 1]) await ROW(i).locator(`input[data-j="${j}"]`).fill(S[i][j]); await page.click(`${CAL} .iodo-cal-head h3`); };
  try {
    await load(page, 'iodo');
    await page.click('#iodoCalBtn'); await page.waitForSelector(CAL);
    await page.selectOption('#iodoCalMode', 'std');
    await fill();
    await ROW(1).locator('input[data-j="0"]').click({ button: 'right' });
    assert.deepEqual(await shownItems(page), await fromCtls(ROW(1), '[data-del]'));
    assert.deepEqual(await shownItems(page), [['menuitem', 'Remove standard 2', null, true, null]], 'its ×, red');
    assert.equal(await item(page, 'Remove standard 2').getAttribute('title'), 'Remove this standard', 'its tooltip');
    assert.deepEqual([(await menuOf(page))[1], ...(await rowState(ROW(1)))], ['Standard 2', 'menu', 'true', true, -1]);
    await page.keyboard.press('Escape');
    assert.deepEqual([await opened(page), await page.isVisible(CAL), await onRow(ROW(1))], [0, true, true], 'Escape: the menu closed, the window open, the focus on the row');
    await page.keyboard.press('ContextMenu'); await page.keyboard.press('Enter'); await settle(page);
    const byMenu = await vals();
    assert.deepEqual([byMenu, await onRow(ROW(1))], [[S[0], S[2]], true], 'removed, the row in its place focused');
    await page.click(`${CAL} [data-add-std]`); await fill();
    await ROW(1).locator('[data-del]').click(); await settle(page);
    assert.deepEqual(await vals(), byMenu, 'as its × does');
    await page.click(`${CAL} [data-cancel]`);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('v587: Custom\'s series: a row\'s menu of its ×, red, named by the series; the item takes it out of the plot as its × does, undone', async ()=>{
  const { page, errors, close } = await env.page();
  const ROW = k => page.locator('#fig1List .fig-ser').nth(k), n = ()=> page.locator('#fig1List .fig-ser').count();
  try {
    await load(page, 'fig');
    await page.click('#figAddAn'); await page.click('.an-menu:not([hidden]) [data-kind="xy"]'); await settle(page);
    await page.click('#fig1Add'); await page.waitForSelector('.fig-pick:not([style*="none"])');
    await page.locator('.fig-pick:not([style*="none"]) input[data-file]').first().check();
    await page.click('.fig-pick:not([style*="none"]) [data-done]'); await settle(page);
    const n0 = await n(), s0 = await moduleState(page, 'fig'), h0 = (await history(page, 'fig')).index, name = await ROW(0).locator('.fig-ser-name').textContent();
    assert.equal(n0, 2);
    await ROW(0).locator('.fig-ser-name').click({ button: 'right' });
    assert.deepEqual(await shownItems(page), await fromCtls(ROW(0), '.fig-ser-x'));
    assert.deepEqual(await shownItems(page), [['menuitem', `Take ${name} out of the plot`, null, true, null]], 'its ×, red');
    assert.deepEqual([(await menuOf(page))[1], ...(await rowState(ROW(0)))], [name, 'menu', 'true', true, -1]);
    await item(page, 'out of the plot').click(); await settle(page);
    const byMenu = await moduleState(page, 'fig');
    assert.deepEqual([await n(), (await history(page, 'fig')).index, await onRow(ROW(0))], [n0 - 1, h0 + 1, true], 'taken out, a step, the row in its place focused');
    await page.keyboard.press('Control+z'); await settle(page);
    assert.deepEqual(await moduleState(page, 'fig'), s0, 'undone');
    await ROW(0).locator('.fig-ser-x').click(); await settle(page);
    assert.deepEqual(await moduleState(page, 'fig'), byMenu, 'as its × does');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('v587: the figure composer: a panel\'s row and a division\'s head, a menu of their ×, red; each item as its ×; Escape closes the menu, not the composer', async ()=>{
  const { page, errors, close } = await env.page();
  const PANEL = k => page.locator('.fig-backdrop .fig-panel').nth(k), panels = ()=> page.locator('.fig-backdrop .fig-panel').count();
  const HEAD = k => page.locator('.fig-backdrop .fig-dgroup-h').nth(k), drawn = ()=> page.evaluate(()=> document.querySelector('.fig-backdrop .fig-svg').innerHTML);
  try {
    await load(page, 'gc');
    const plot = page.locator('#tab-gc svg[id$="SvgBar"]').first();
    await plot.scrollIntoViewIfNeeded();
    await plot.locator('xpath=ancestor::div[contains(@class,"plot-wrap")]').locator('button[title="Figure composer (advanced export)"]').click();
    await page.waitForSelector('.fig-backdrop .fig-panel');
    // A panel added; its row's menu. (each edit then a pause past the composer's history's
    // 250 ms, so that it is a step of its own)
    await page.click('.fig-backdrop [data-add-panel]'); await settle(page); await page.waitForTimeout(300);
    assert.equal(await panels(), 2);
    const two = await drawn();
    await PANEL(1).locator('b').click({ button: 'right' });
    assert.deepEqual(await shownItems(page), await fromCtls(PANEL(1), '[data-del-panel]'));
    assert.deepEqual(await shownItems(page), [['menuitem', 'Remove panel', null, true, null]], 'its ×, red');
    assert.deepEqual([(await menuOf(page))[1], ...(await rowState(PANEL(1)))], ['Panel 2', 'menu', 'true', true, -1]);
    await page.keyboard.press('Escape');
    assert.deepEqual([await opened(page), await page.locator('.fig-backdrop').count(), await onRow(PANEL(1))], [0, 1, true], 'Escape: the menu closed, the composer open');
    await page.keyboard.press('Shift+F10'); await page.keyboard.press('Enter'); await settle(page); await page.waitForTimeout(300);
    const byMenu = await drawn();
    assert.deepEqual([await panels(), await onRow(PANEL(0))], [1, true], 'removed, the row in its place focused');
    await page.keyboard.press('Control+z'); await settle(page);
    assert.deepEqual([await panels(), await drawn()], [2, two], 'undone (the composer\'s history)');
    await PANEL(1).locator('[data-del-panel]').click(); await settle(page);
    assert.equal(await drawn(), byMenu, 'as its × does');
    // A division added: each head's menu of its ×; one division alone, none.
    const add = page.locator('.fig-backdrop [data-adddiv]').first();
    await add.scrollIntoViewIfNeeded(); await add.click(); await settle(page);
    const name = await HEAD(1).locator('[data-dk]').inputValue();
    await HEAD(1).locator('.fig-fill').click({ button: 'right' });
    assert.deepEqual(await shownItems(page), [['menuitem', 'Remove this division', null, true, null]], 'its ×, red');
    assert.deepEqual([(await menuOf(page))[1], ...(await rowState(HEAD(1)))], [name, 'menu', 'true', true, -1]);
    await item(page, 'Remove this division').click(); await settle(page);
    assert.deepEqual([await page.locator('.fig-backdrop .fig-dgroup-h[aria-haspopup]').count(), await HEAD(0).getAttribute('tabindex')], [0, null], 'removed: one division, no × and no menu');
    await HEAD(0).locator('.fig-fill').click({ button: 'right' });
    assert.equal(await opened(page), 0, 'nothing to remove: no menu');
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
