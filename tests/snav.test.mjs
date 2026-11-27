/* The sample selector (snav.js, v545; v546), one component in every module: `‹ n/N ›` (the
   count centred between the arrows), one group of one fixed width in every module, just
   enough for `‹ 000/000 ›`, and the name with its small down-arrow after it, as long as it
   is: cut with "…" only where it would reach the plot's toolbar beside it (at the line's
   edge where there is none, and on a phone's 375 px with no sideways scroll), whole in its
   tooltip and in the list; the list (the app's menu, as the kinds' one) opened by the name
   or its arrow, closed by Escape, by a click elsewhere or by a choice, worked by the
   keyboard (↑ ↓ Home End Enter, Tab), inside the page short of its scrollbars (v584); ← →
   stepping the samples as before. In DRS (its Tauc
   and Urbach cards), XRPD (the Peaks/Scherrer and the Rietveld card), SEM, Iodometry and
   Custom; GC's Integration card's two (the chromatogram's over the run overview, its
   suspicious names red) in gctcd-ui.test.mjs. Synthetic files only. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle } from './helpers.mjs';
import { drsCsv } from './fixtures.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const LONG = 'a_very_long_sample_name_as_the_instrument_writes_it_2026.11.10_Pt@STO_150_10mg35mlTEOA10_1sccm_17.28';
const MID = 'Pt@STO_150_10mg35mlTEOA10_1sccm_17.28_reflectance';
/* The selector: its arrows' group (its width; `‹ 000/000 ›` written in its count: whether it
   fits, centred, with under a digit to spare), its count, its name (cut or not) and tooltip,
   and the room its line leaves it: its name's group's right edge against the toolbar's left
   edge where the plot's toolbar shares its line (`tb`), else the line's own right edge. */
const look = nav => nav.evaluate(el=>{
  const n = el.querySelector('.snav-name'), c = el.querySelector('.nav-count'), r = s => el.querySelector(s).getBoundingClientRect();
  const was = c.textContent;
  c.textContent = '000/000';
  const rg = document.createRange(); rg.selectNodeContents(c);
  const t = rg.getBoundingClientRect(), p = c.getBoundingClientRect(), cs = getComputedStyle(c);
  const inner = p.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
  const wide = { fits: c.scrollWidth <= c.clientWidth && t.width <= inner + 0.01, spare: inner - t.width, mid: (t.left + t.right)/2 - (p.left + p.right)/2, digit: t.width/6.5 };
  c.textContent = was;
  const row = el.closest('.plot-nav-row'), next = row && row.nextElementSibling;
  const wrap = next && (next.classList.contains('plot-wrap') ? next : next.firstElementChild && next.firstElementChild.classList.contains('plot-wrap') ? next.firstElementChild : null);
  const tb = wrap && wrap.querySelector(':scope > .plot-btn-col');
  const rr = row && row.getBoundingClientRect();
  return { steps: r('.snav-steps').width, wide, count: c.textContent, name: n.textContent, title: n.title, cut: n.scrollWidth > n.clientWidth + 1,
    pick: r('.snav-pick').right, tb: tb && tb.getClientRects().length ? tb.getBoundingClientRect().left : null, row: rr && rr.right,
    tbLine: tb && rr ? Math.abs((tb.getBoundingClientRect().top + tb.getBoundingClientRect().bottom)/2 - (rr.top + rr.bottom)/2) : null };
});
const menu = page => page.$$eval('.snav-menu [data-i]', bs=> bs.map(b=> ({ text: b.querySelector('.snav-item').textContent, cur: b.classList.contains('is-current'), focus: b === document.activeElement })));
const open = page => page.locator('.snav-menu').count().then(n=> n > 0);
// The arrows' group: `‹ 000/000 ›` fits it, just, the count centred; one width everywhere (W, DRS's).
let W = null;
function steps(s, what){
  assert.ok(s.wide.fits && s.wide.spare >= 0 && s.wide.spare < s.wide.digit && Math.abs(s.wide.mid) < 0.5, `${what}: 000/000 in the count: ${JSON.stringify(s.wide)}`);
  if (W == null) W = s.steps;
  assert.ok(Math.abs(s.steps - W) < 0.01, `${what}: the arrows' group ${s.steps} px, DRS's ${W}`);
}

test('the selector in DRS: one width for ‹ 000/000 ›, the name as long as it is, cut only at the toolbar (whole in its tooltip and the list), the list by the mouse and by the keyboard, ← → as before; every card its own', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    await page.setInputFiles('#taucFiles', [{ name: LONG + '.csv', mimeType: 'text/csv', buffer: drsCsv({ Eg: 3.2 }) }, { name: 'b.csv', mimeType: 'text/csv', buffer: drsCsv({ Eg: 2.9, seed: 4 }) },
      { name: MID + '.csv', mimeType: 'text/csv', buffer: drsCsv({ Eg: 3.0, seed: 5 }) }]);
    await page.waitForFunction(()=> document.querySelectorAll('#taucFileTableWrap tr.file-row').length === 3 && !document.querySelector('.dz-loading'));
    await settle(page);
    const card = page.locator('#tab-tauc .an-card').first(), nav = card.locator('.snav'), pick = nav.locator('.snav-pick');
    let s = await look(nav);
    steps(s, 'DRS');
    // The long name: cut where it would reach the plot's toolbar, on its line (8 px before it), not before.
    assert.deepEqual([s.count, s.name, s.title, s.cut], ['1/3', LONG, LONG, true], 'the long name cut, whole in its tooltip');
    assert.ok(s.tb != null && s.tbLine < 0.5 && Math.abs(s.tb - 8 - s.pick) < 1, `up to the toolbar: the name's end ${s.pick}, the toolbar's start ${s.tb}`);
    // The count centred between the arrows, the arrows at the group's ends, the name after it.
    const g = await nav.evaluate(el=>{ const r = s => el.querySelector(s).getBoundingClientRect(), st = r('.snav-steps'), c = r('.nav-count'), p = r('.an-prev'), n = r('.an-next');
      return { mid: (c.left + c.right)/2 - (st.left + st.right)/2, ends: [p.left - st.left, st.right - n.right], name: r('.snav-pick').left - st.right }; });
    assert.ok(Math.abs(g.mid) < 0.5 && Math.abs(g.ends[0]) < 0.5 && Math.abs(g.ends[1]) < 0.5 && g.name > 0, JSON.stringify(g));
    // A name of 50 characters, which v545's half cut: whole, with room to spare before the toolbar.
    for (let k = 0; k < 2; k++){ await card.locator('.an-next').click(); await settle(page); }
    s = await look(nav);
    assert.deepEqual([s.count, s.name, s.cut], ['3/3', MID, false], 'a name that has the room: not cut');
    assert.ok(s.pick < s.tb - 40, 'clear of the toolbar');
    steps(s, 'DRS, another sample');
    for (let k = 0; k < 2; k++){ await card.locator('.an-prev').click(); await settle(page); }
    // The mouse: the name opens the list (the anchor lit), an item goes to its sample.
    await nav.locator('.snav-name').click();
    assert.ok(await open(page));
    assert.deepEqual((await menu(page)).map(x=> [x.text, x.cur]), [[LONG, true], ['b', false], [MID, false]], 'every sample, whole, the one on show marked');
    assert.deepEqual(await pick.evaluate(b=> [b.getAttribute('aria-expanded'), b.classList.contains('cp-anchored')]), ['true', true]);
    assert.equal(await page.locator('.snav-menu').evaluate(m=> m.classList.contains('an-menu') && m.getAttribute('role')), 'listbox', 'the app\'s menu');
    await page.locator('.snav-menu [data-i="1"]').click(); await settle(page);
    s = await look(nav);
    assert.deepEqual([s.count, s.name, s.cut, await open(page)], ['2/3', 'b', false, false]);
    // Its small arrow opens it too; Escape closes it; so does a click elsewhere.
    await nav.locator('.snav-caret').click({ force: true });
    assert.ok(await open(page));
    await page.keyboard.press('Escape');
    assert.equal(await open(page), false);
    assert.equal(await pick.getAttribute('aria-expanded'), 'false');
    await nav.locator('.snav-name').click();
    await page.locator('#tab-tauc .an-card .param-head').first().click();
    assert.equal(await open(page), false, 'closed by a click elsewhere');
    // The keyboard: Enter on the name opens it on the one on show, ↑ Enter chooses, the focus back on the name.
    await pick.focus(); await page.keyboard.press('Enter');
    assert.deepEqual((await menu(page)).map(x=> x.focus), [false, true, false]);
    await page.keyboard.press('ArrowRight');
    assert.equal((await look(nav)).count, '2/3', '→ in the list steps nothing');
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter'); await settle(page);
    assert.deepEqual([(await look(nav)).count, await open(page), await pick.evaluate(b=> b === document.activeElement)], ['1/3', false, true]);
    await page.keyboard.press('ArrowDown');
    assert.ok(await open(page), '↓ on the name opens it');
    await page.keyboard.press('End'); await page.keyboard.press('Tab');
    assert.equal(await open(page), false, 'Tab closes it');
    assert.equal((await look(nav)).count, '1/3', 'nothing chosen');
    // ← → step the samples as before.
    await page.evaluate(()=> document.activeElement.blur());
    await page.keyboard.press('ArrowRight'); await settle(page);
    assert.equal((await look(nav)).count, '2/3');
    await page.keyboard.press('ArrowLeft'); await settle(page);
    assert.equal((await look(nav)).count, '1/3');
    // A second card (Urbach): its own selector, on the same sample; its list steps every card.
    await page.click('#taucAddAn');
    await page.locator('.an-menu:not([hidden]) [data-kind="urbach"]').click(); await settle(page);
    const nav2 = page.locator('#tab-tauc .an-card').nth(1).locator('.snav');
    steps(await look(nav2), 'Urbach');
    await nav2.locator('.snav-name').click(); await page.locator('.snav-menu [data-i="1"]').click(); await settle(page);
    assert.deepEqual([(await look(nav)).count, (await look(nav2)).count], ['2/3', '2/3']);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

// A Cary 60 Kinetics CSV of two traces (iodo.test.mjs's form), the second's name long.
function cary(){
  const names = ['blank', LONG], t = Array.from({ length: 300 }, (_, j)=> +(0.05 + 0.2*j).toFixed(2));
  let s = names.map(n=> n + ',,').join('') + '\r\n' + names.map(()=> 'Time (sec),Abs,').join('') + '\r\n';
  t.forEach((tt, j)=>{ s += names.map((_, k)=> `${tt.toFixed(2)},${(0.2 + 0.1*k + (j >= 50 ? 0.3*(1 - Math.exp(-(tt - 10)/20)) : 0) + (j === 50 ? 0.1 : 0)).toFixed(6)},`).join('') + '\r\n'; });
  return s + '\r\n';
}
test('the selector in XRPD (Peaks/Scherrer and Rietveld), SEM, Iodometry and Custom: the arrows\' group as wide as DRS\'s, a name cut only at the toolbar, the list straight to an item', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    // Choose the last item in a selector's list: its count and its name follow.
    const last = async (nav, n, what)=>{
      steps(await look(nav), what);
      await nav.locator('.snav-name').click();
      const items = await menu(page);
      assert.equal(items.length, n, what + ': its list');
      await page.locator(`.snav-menu [data-i="${n - 1}"]`).click(); await settle(page);
      const s = await look(nav);
      assert.deepEqual([s.count, s.name], [`${n}/${n}`, items[n - 1].text], what);
      return s;
    };
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd);
    const cards = page.locator('#tab-xrd .an-card');
    await last(cards.nth(0).locator('.snav'), 3, 'XRPD Peaks');
    assert.equal(await cards.nth(1).locator('.nav-count').textContent(), '3/3', 'the Rietveld card on the same pattern');
    await cards.nth(1).locator('.an-prev').click(); await settle(page);
    await last(cards.nth(1).locator('.snav'), 3, 'XRPD Rietveld');
    await openModule(page, 'sem');
    await loadFiles(page, 'sem', env.fx.files.sem);
    await last(page.locator('#tab-sem .sem-work-nav .snav'), 3, 'SEM');
    assert.equal(await page.locator('#semIdx').textContent(), '3/3');
    await openModule(page, 'iodo');
    await loadFiles(page, 'iodo', [env.fx.put('kin2.csv', cary())], 2);
    const s = await last(page.locator('#iodoNav .snav'), 2, 'Iodometry');
    assert.ok(s.cut && s.name === LONG, 'a long name cut');
    assert.ok(Math.abs(s.tb - 8 - s.pick) < 1, `where it would reach the toolbar: ${s.pick}, ${s.tb}`);
    await openModule(page, 'fig');
    const f = (n, k)=> env.fx.put(n, 'x,y\n' + [1, 2, 3, 4].map(x=> `${x},${x*k}`).join('\n') + '\n');
    await loadFiles(page, 'fig', [f('one.csv', 1), f(LONG + '.csv', 2)]);
    await last(page.locator('#figFileNav .snav'), 2, 'Custom');
    assert.equal(await page.locator('#figFileName').getAttribute('title'), LONG + '.csv', 'its tooltip the file\'s name');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('the selector on a phone (375 px): the arrows\' group as wide, a long name cut at its line\'s edge (the toolbar on a line of its own), no sideways scroll', async ()=>{
  const { page, errors, csp, close } = await env.page({ viewport: { width: 375, height: 800 } });
  try {
    await openModule(page, 'tauc');
    await page.setInputFiles('#taucFiles', [{ name: LONG + '.csv', mimeType: 'text/csv', buffer: drsCsv({ Eg: 3.2 }) }, { name: 'b.csv', mimeType: 'text/csv', buffer: drsCsv({ Eg: 2.9, seed: 4 }) }]);
    await page.waitForFunction(()=> document.querySelectorAll('#taucFileTableWrap tr.file-row').length === 2 && !document.querySelector('.dz-loading'));
    await settle(page);
    const nav = page.locator('#tab-tauc .an-card').first().locator('.snav');
    await nav.scrollIntoViewIfNeeded();
    const s = await look(nav);
    steps(s, 'DRS at 375 px');
    assert.ok(s.cut && s.name === LONG, 'the long name cut');
    assert.ok(s.tbLine > 15, 'the toolbar under the selector\'s line');
    assert.ok(Math.abs(s.row - s.pick) < 1, `up to the line's edge: ${s.pick}, ${s.row}`);
    assert.deepEqual(await page.evaluate(()=> [document.documentElement.scrollWidth <= document.documentElement.clientWidth, document.querySelector('#tab-tauc').scrollWidth <= document.querySelector('#tab-tauc').clientWidth]), [true, true], 'no sideways scroll');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* v584: the list inside the page, short of its scrollbars (cards-model.js menuAt with the
   page's clientWidth and clientHeight, as the kinds' menu and the row menu: to v583 the
   window's innerWidth and innerHeight, its edge under the scrollbar). A browser that draws its
   scrollbars, the page wider than the window (a scrollbar along its foot too); the name put at
   the page's right edge, where the list under it would end between the page's foot and the
   window's: over it, and short of the right scrollbar. */
test('the list inside the page, short of its scrollbars: at the right edge, and over its name where the page has no room under it (v584)', async ()=>{
  const { page, errors, csp, close } = await env.page({ scrollbars: true });
  try {
    await openModule(page, 'tauc');
    await page.setInputFiles('#taucFiles', [{ name: 'a.csv', mimeType: 'text/csv', buffer: drsCsv({ Eg: 3.2 }) }, { name: 'b.csv', mimeType: 'text/csv', buffer: drsCsv({ Eg: 2.9, seed: 4 }) }]);
    await page.waitForFunction(()=> document.querySelectorAll('#taucFileTableWrap tr.file-row').length === 2 && !document.querySelector('.dz-loading'));
    await settle(page);
    await page.evaluate(()=>{ const d = document.createElement('div'); d.style.cssText = 'width:3000px;height:1px'; document.body.appendChild(d); });
    const bars = await page.evaluate(()=> [innerWidth - document.documentElement.clientWidth, innerHeight - document.documentElement.clientHeight]);
    assert.ok(bars[0] > 0 && bars[1] > 0, `both scrollbars drawn: ${bars}`);
    const pick = page.locator('#tab-tauc .an-card').first().locator('.snav-pick');
    await pick.click();
    const m0 = await page.locator('.snav-menu').boundingBox();
    await page.keyboard.press('Escape');
    // Its name 40 px wide at the page's right edge, the foot of its list under it half the
    // scrollbar's height past the page's.
    const at = await pick.evaluate((b, mh)=>{
      const cw = document.documentElement.clientWidth, ch = document.documentElement.clientHeight, g = innerHeight - ch;
      Object.assign(b.style, { position: 'fixed', left: (cw - 40) + 'px', width: '40px', top: '0px' });
      const h = b.getBoundingClientRect().height;
      b.style.top = (ch - 8 - 6 - mh + g/2 - h) + 'px';
      return { cw, ch, top: b.getBoundingClientRect().top };
    }, m0.height);
    await pick.click();
    const m = await page.locator('.snav-menu').boundingBox();
    assert.ok(Math.abs(m.x + m.width - (at.cw - 8)) < 1, `its right edge 8 px short of the page's (${at.cw}), not of the window's: ${JSON.stringify(m)}`);
    assert.ok(m.y + m.height <= at.ch - 8 + 0.5 && m.y + m.height <= at.top - 6 + 0.5, `over its name, inside the page's height (${at.ch}): ${JSON.stringify([m, at])}`);
    await page.keyboard.press('Escape');
    assert.equal(await open(page), false);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});
