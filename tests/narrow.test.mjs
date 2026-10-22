/* The app at 320 px, a small phone's width: nothing past the window's right edge (the page
   does not scroll sideways) on Home, with no tab open and with three, on the Projects and
   Settings tabs and in each module with its fixtures, every card unfolded. The top bar there
   keeps the brand's mark alone, its name clipped; the tab strip gets about a tab's width and
   scrolls inside itself, each tab and the + reached in it; the home's two tiles stand one
   under the other, as they do up to 357 px. From 340 px up the bar is as it was (to v503):
   the brand's name in full, the bar's 16-px side padding and 8-px gaps; from 358 px the
   tiles stand side by side. The tab on show is scrolled into the strip. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, poke, settle, MODS } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const NARROW = { width: 320, height: 700 };

// What passes the window's right edge, not clipped by a box of its own that ends inside
// the window (a strip, a table that scrolls), nor in a fixed layer (a modal, a banner):
// elements, and runs of text (a label wider than its button); with the page's sideways scroll.
const past = page => page.evaluate(()=>{
  const de = document.documentElement, cw = de.clientWidth, x = scrollX, out = [];
  const name = el => el.id ? '#' + el.id : el.tagName.toLowerCase() + [...el.classList].map(c=> '.' + c).join('');
  const held = el =>{
    for (let p = el; p && p !== document.body; p = p.parentElement){
      const s = getComputedStyle(p);
      if (s.position === 'fixed' || s.overflowX !== 'visible' && p.getBoundingClientRect().right + x <= cw + 0.5) return true;
    }
    return false;
  };
  for (const el of document.querySelectorAll('body *')){
    const r = el.getBoundingClientRect();
    if (r.width && r.right + x > cw + 0.5 && !held(el)) out.push({ what: name(el), right: +(r.right + x).toFixed(2), std: !!el.closest('#xrdR2Std') });
  }
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), rg = document.createRange();
  for (let n; (n = tw.nextNode());){
    if (!n.textContent.trim()) continue;
    rg.selectNodeContents(n);
    const r = rg.getBoundingClientRect(), el = n.parentElement;
    if (r.width && r.right + x > cw + 0.5 && !held(el)) out.push({ what: name(el) + ' "' + n.textContent.trim().slice(0, 30) + '"', right: +(r.right + x).toFixed(2), std: !!el.closest('#xrdR2Std') });
  }
  return { cw, scroll: de.scrollWidth - cw, scrollX: x, past: out };
});
// Nothing past the window, and no sideways scroll (v507: the XRPD Rietveld card's
// 'Instrumental standard…', which ended 0.5 px past at 320, is cut with an ellipsis).
async function fits(page, where){
  const m = await past(page);
  assert.deepEqual(m.past, [], where + ': past the right edge of ' + m.cw);
  assert.equal(m.scroll, 0, where + ': the page scrolls sideways');
  assert.equal(m.scrollX, 0, where + ': the page scrolled sideways');
}
const show = async (page, tab)=>{ await page.click(`#nav button[data-tab="${tab}"]`); await page.waitForSelector(`#tab-${tab}.active`); await settle(page); };

// The top bar's and the home's boxes, for the layout at a width.
const bar = page => page.evaluate(()=>{
  const box = el =>{ const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width }; };
  const h = document.querySelector('header'), h1 = h.querySelector('h1'), hs = getComputedStyle(h), strip = document.getElementById('tabBar');
  const head = document.querySelector('#tab-home .home-head');
  return {
    pad: [hs.paddingLeft, hs.paddingRight], gap: getComputedStyle(document.getElementById('nav')).columnGap, h1margin: getComputedStyle(h1).marginRight,
    brand: { w: h1.clientWidth, sw: h1.scrollWidth, mark: box(h1.querySelector('.logo-mark')).w, text: h1.textContent.trim() },
    gear: box(document.querySelector('#nav .nav-settings')), strip: { ...box(strip), cw: strip.clientWidth, sw: strip.scrollWidth, left: strip.scrollLeft },
    tiles: [...document.querySelectorAll('.home-actions .home-action-btn')].map(box), head: box(head),
  };
});

test('320 px: Home, Projects and Settings fit; the brand its mark, the tiles one under the other', async ()=>{
  const { page, errors, csp, close } = await env.page({ viewport: NARROW });
  try {
    await fits(page, 'Home');
    const b = await bar(page);
    assert.deepEqual([b.brand.w, b.brand.mark, b.brand.text], [23, 23, 'DataTreat'], 'the brand: its mark, its name kept in the text');
    assert.ok(b.brand.sw > b.brand.w, 'the name clipped');
    assert.ok(b.gear.r <= 320 - 8, 'the gear inside the bar: ' + b.gear.r);
    const [p, s] = b.tiles;
    assert.ok(s.t >= p.b, 'the tiles one under the other: ' + JSON.stringify(b.tiles));
    assert.ok(b.tiles.every(t=> t.l >= b.head.l - 0.5 && t.r <= b.head.r + 0.5), 'the tiles inside the card: ' + JSON.stringify(b));
    for (const t of ['projects', 'settings', 'home']){ await show(page, t); await fits(page, t); }
    // The tiles still lead where they did.
    await page.click('.home-action-btn[data-tab="projects"]');
    await page.waitForSelector('#tab-projects.active');
    await fits(page, 'Projects from its tile');
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

for (const mod of MODS){
  test(`320 px: ${mod} with its fixtures, every card unfolded, nothing past the window`, async ()=>{
    const { page, errors, close } = await env.page({ viewport: NARROW });
    try {
      await openModule(page, mod);
      await fits(page, mod + ' new');
      await loadFiles(page, mod, env.fx.files[mod]);
      await poke(page);
      await page.evaluate(()=> scrollTo(0, 0));
      await fits(page, mod + ' loaded');
      await show(page, 'projects');
      await fits(page, 'Projects with ' + mod + ' open');
      assert.deepEqual(errors, []);
    } finally { await close(); }
  });
}

test('320 px, three tabs open: the strip about a tab wide, scrolling inside itself; each tab and the + reached', async ()=>{
  const { page, errors, close } = await env.page({ viewport: NARROW });
  try {
    for (const mod of ['tauc', 'xrd', 'gc']) await openModule(page, mod);
    let b = await bar(page);
    assert.ok(b.strip.cw >= 110, 'the strip about a tab wide: ' + b.strip.cw);
    assert.ok(b.strip.sw > b.strip.cw, 'its tabs scroll inside it');
    // The tab on show (the last opened) scrolled into the strip, its × whole inside it (v507:
    // to v506 the strip stayed on the first tab).
    const x = await page.evaluate(()=>{ const s = document.getElementById('tabBar').getBoundingClientRect(), on = document.querySelector('#tabBar .ptab.is-on'), t = on.getBoundingClientRect(), g = on.querySelector('.ptab-x svg').getBoundingClientRect(); return t.left >= s.left - 0.5 && g.right <= s.right + 0.5; });
    assert.ok(x, 'the tab on show, its × included, inside the strip');
    for (const [i, mod] of [[0, 'tauc'], [2, 'gc'], [1, 'xrd']]){
      await page.locator('#tabBar .ptab').nth(i).locator('.ptab-label').click();
      await page.waitForSelector(`#tab-${mod}.active`);
      await settle(page);
      await fits(page, 'tab ' + mod);
    }
    // To the strip's end: the + inside it, a new project from it.
    await page.evaluate(()=>{ const s = document.getElementById('tabBar'); s.scrollLeft = s.scrollWidth; });
    b = await bar(page);
    assert.ok(b.strip.left > 0, 'the strip scrolled');
    const add = await page.evaluate(()=>{ const s = document.getElementById('tabBar').getBoundingClientRect(), a = document.querySelector('#tabBar .ptab-add').getBoundingClientRect(); return a.left >= s.left && a.right <= s.right + 0.5; });
    assert.ok(add, 'the + inside the strip at its end');
    await page.click('#tabBar .ptab-add');
    await page.click('#projNewModal [data-new-module="epr"]');
    await page.waitForSelector('#tab-epr.active');
    await settle(page);
    assert.equal(await page.locator('#tabBar .ptab').count(), 4);
    await fits(page, 'a fourth tab');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

// From 340 px up the rule for narrow windows takes no part: the layout of v503.
for (const width of [340, 360, 390, 768, 1400]){
  test(`${width} px: the top bar and the home as before, nothing past the window`, async ()=>{
    const { page, errors, close } = await env.page({ viewport: { width, height: 800 } });
    try {
      const b = await bar(page);
      assert.deepEqual([b.pad, b.gap, b.h1margin], [['16px', '16px'], '8px', '16px'], 'the bar\'s padding and gaps');
      assert.ok(b.brand.w > 100 && b.brand.sw <= b.brand.w, 'the brand\'s name in full: ' + JSON.stringify(b.brand));
      const [p, s] = b.tiles;
      // (under 358 px the tiles do not fit side by side and wrap: v507)
      if (width < 358) assert.ok(s.t > p.b - 0.5, 'the tiles one under the other: ' + JSON.stringify(b.tiles));
      else assert.ok(Math.abs(s.t - p.t) < 0.5 && s.l > p.r, 'the tiles side by side: ' + JSON.stringify(b.tiles));
      await fits(page, 'Home');
      for (const mod of ['tauc', 'xrd']) await openModule(page, mod);
      await show(page, 'home');
      await fits(page, 'Home, two tabs');
      assert.deepEqual(errors, []);
    } finally { await close(); }
  });
}
