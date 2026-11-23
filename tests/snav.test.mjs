/* The sample selector (snav.js, v545), one component in every module: `‹ n/N ›` (the count
   centred between the arrows) and the name with its small down-arrow, two halves of exactly
   one width; a long name cut with "…", whole in its tooltip and in the list; the list (the
   app's menu, as the kinds' one) opened by the name or its arrow, closed by Escape, by a click
   elsewhere or by a choice, worked by the keyboard (↑ ↓ Home End Enter, Tab); ← → stepping
   the samples as before. In DRS (its Tauc and Urbach cards), XRPD (the Peaks/Scherrer and
   the Rietveld card), SEM, Iodometry and Custom; GC's Integration card's two (the
   chromatogram's mirrored, its suspicious names red) in gctcd-ui.test.mjs. Synthetic files
   only. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle } from './helpers.mjs';
import { drsCsv } from './fixtures.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const LONG = 'a_very_long_sample_name_as_the_instrument_writes_it_2026.11.10_Pt@STO_150_10mg35mlTEOA10_1sccm_17.28';
// The selector's two halves (their widths), its count, its name (cut or not) and tooltip.
const look = nav => nav.evaluate(el=>{
  const n = el.querySelector('.snav-name');
  // (the halves: the grid's two columns as laid out; the arrows' group fills its own)
  return { halves: getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat), steps: el.querySelector('.snav-steps').getBoundingClientRect().width, count: el.querySelector('.nav-count').textContent,
    name: n.textContent, title: n.title, cut: n.scrollWidth > n.clientWidth + 1 };
});
const menu = page => page.$$eval('.snav-menu [data-i]', bs=> bs.map(b=> ({ text: b.querySelector('.snav-item').textContent, cur: b.classList.contains('is-current'), focus: b === document.activeElement })));
const open = page => page.locator('.snav-menu').count().then(n=> n > 0);
const same = ([a, b, c], what)=> assert.ok(c === undefined && a > 50 && Math.abs(a - b) < 0.05, `${what}: halves ${a} and ${b}`);

test('the selector in DRS: equal halves, a long name cut (whole in its tooltip and the list), the list by the mouse and by the keyboard, ← → as before; every card its own', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    await page.setInputFiles('#taucFiles', [{ name: LONG + '.csv', mimeType: 'text/csv', buffer: drsCsv({ Eg: 3.2 }) }, { name: 'b.csv', mimeType: 'text/csv', buffer: drsCsv({ Eg: 2.9, seed: 4 }) }]);
    await page.waitForFunction(()=> document.querySelectorAll('#taucFileTableWrap tr.file-row').length === 2 && !document.querySelector('.dz-loading'));
    await settle(page);
    const card = page.locator('#tab-tauc .an-card').first(), nav = card.locator('.snav'), pick = nav.locator('.snav-pick');
    let s = await look(nav);
    same(s.halves, 'DRS');
    assert.ok(Math.abs(s.steps - s.halves[0]) < 0.05, 'the arrows\' group as wide as its half');
    assert.ok(await nav.locator('.snav-pick').evaluate((b, w)=> Math.abs(b.getBoundingClientRect().width - w) < 0.05, s.halves[1]), 'the long name\'s group as wide as its half');
    assert.deepEqual([s.count, s.name, s.title, s.cut], ['1/2', LONG, LONG, true], 'the long name cut, whole in its tooltip');
    // The count centred between the arrows, the arrows at the half's ends.
    const g = await nav.evaluate(el=>{ const r = s => el.querySelector(s).getBoundingClientRect(), st = r('.snav-steps'), c = r('.nav-count'), p = r('.an-prev'), n = r('.an-next');
      return { mid: (c.left + c.right)/2 - (st.left + st.right)/2, ends: [p.left - st.left, st.right - n.right], name: r('.snav-pick').left - st.right }; });
    assert.ok(Math.abs(g.mid) < 0.5 && Math.abs(g.ends[0]) < 0.5 && Math.abs(g.ends[1]) < 0.5 && g.name > 0, JSON.stringify(g));
    // The mouse: the name opens the list (the anchor lit), an item goes to its sample.
    await nav.locator('.snav-name').click();
    assert.ok(await open(page));
    assert.deepEqual((await menu(page)).map(x=> [x.text, x.cur]), [[LONG, true], ['b', false]], 'every sample, whole, the one on show marked');
    assert.deepEqual(await pick.evaluate(b=> [b.getAttribute('aria-expanded'), b.classList.contains('cp-anchored')]), ['true', true]);
    assert.equal(await page.locator('.snav-menu').evaluate(m=> m.classList.contains('an-menu') && m.getAttribute('role')), 'listbox', 'the app\'s menu');
    await page.locator('.snav-menu [data-i="1"]').click(); await settle(page);
    s = await look(nav);
    assert.deepEqual([s.count, s.name, s.cut, await open(page)], ['2/2', 'b', false, false]);
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
    assert.deepEqual((await menu(page)).map(x=> x.focus), [false, true]);
    await page.keyboard.press('ArrowRight');
    assert.equal((await look(nav)).count, '2/2', '→ in the list steps nothing');
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter'); await settle(page);
    assert.deepEqual([(await look(nav)).count, await open(page), await pick.evaluate(b=> b === document.activeElement)], ['1/2', false, true]);
    await page.keyboard.press('ArrowDown');
    assert.ok(await open(page), '↓ on the name opens it');
    await page.keyboard.press('End'); await page.keyboard.press('Tab');
    assert.equal(await open(page), false, 'Tab closes it');
    assert.equal((await look(nav)).count, '1/2', 'nothing chosen');
    // ← → step the samples as before.
    await page.evaluate(()=> document.activeElement.blur());
    await page.keyboard.press('ArrowRight'); await settle(page);
    assert.equal((await look(nav)).count, '2/2');
    await page.keyboard.press('ArrowLeft'); await settle(page);
    assert.equal((await look(nav)).count, '1/2');
    // A second card (Urbach): its own selector, on the same sample; its list steps every card.
    await page.click('#taucAddAn');
    await page.locator('.an-menu:not([hidden]) [data-kind="urbach"]').click(); await settle(page);
    const nav2 = page.locator('#tab-tauc .an-card').nth(1).locator('.snav');
    same((await look(nav2)).halves, 'Urbach');
    await nav2.locator('.snav-name').click(); await page.locator('.snav-menu [data-i="1"]').click(); await settle(page);
    assert.deepEqual([(await look(nav)).count, (await look(nav2)).count], ['2/2', '2/2']);
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
test('the selector in XRPD (Peaks/Scherrer and Rietveld), SEM, Iodometry and Custom: equal halves, the list straight to an item', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    // Choose the last item in a selector's list: its count and its name follow.
    const last = async (nav, n, what)=>{
      same((await look(nav)).halves, what);
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
    await openModule(page, 'fig');
    const f = (n, k)=> env.fx.put(n, 'x,y\n' + [1, 2, 3, 4].map(x=> `${x},${x*k}`).join('\n') + '\n');
    await loadFiles(page, 'fig', [f('one.csv', 1), f(LONG + '.csv', 2)]);
    await last(page.locator('#figFileNav .snav'), 2, 'Custom');
    assert.equal(await page.locator('#figFileName').getAttribute('title'), LONG + '.csv', 'its tooltip the file\'s name');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});
