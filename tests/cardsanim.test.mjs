/* The analysis cards animated by the history's steps (cards.js):
   - a fold or an unfold an undo or a redo makes slides as the arrow's does: the same
     duration, easing and keyframes, the unfold's panel drawn before it slides open and
     nothing drawn again while it does, its height sampled frame by frame (XRPD, DRS, GC,
     EPR); an XRPD card a redo folds has its + Add peak left;
   - a card an undo or a redo brings back grows from nothing, drawn before it does; one it
     takes away shrinks to nothing, as a copy no card's selector finds (no id, no field's
     name, inert), gone once shrunk; a card brought back below the window grows as the page
     scrolls down to it (XRPD, DRS, GC, EPR);
   - several cards in one step, animated together; a step taken during another's animation
     (a fold taken over midway, a card taken away while it grows, brought back while its copy
     shrinks, a burst of keys): the cards then as the state has them, none twice, none left
     clipped, faded or at a height; a card still growing folded or unfolded by the next step
     or by its arrow goes on from where it had got to, its height sampled frame by frame with
     no jump (XRPD, DRS, GC, EPR); a move undone and a kind switched back: nothing animated;
     a card a step leaves in its place not put in again (the focus kept in it);
   - nothing animated by a tab switched to, a project opened, a CSV export's state, the
     start, nor with the motion reduced; a step's animations ended at once by such a load. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle, moduleState, switchTab } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const FOLD_MS = 320, EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const card = (mod, id)=> `#tab-${mod} .an-card[data-an="${id}"]`;

/* Every animation made on the cards (Element.animate wrapped): what (a card's body, a card,
   a copy of one taken away), the card's id, the keyframes' heights and opacities, the timing;
   and the plots' data drawn in a card (a mutation of its .plot-gdata), counted against the
   animations made so far, so that a draw after one began is a draw while it runs. Called
   again, it starts the lists afresh. */
const record = page => page.evaluate(()=>{
  if (window.__rec){ window.__rec.calls = []; window.__rec.anims = []; window.__rec.draws = []; return; }
  const R = window.__rec = { calls: [], anims: [], draws: [] };
  const lists = ['taucAnalyses', 'xrdAnalyses', 'gcAnalyses', 'eprAnalyses'].map(id=> document.getElementById(id));
  const note = ms => ms.forEach(m=>{
    const c = m.target.closest && m.target.closest('[data-an]');
    if (c && m.target.closest('.plot-gdata')) R.draws.push({ id: +c.dataset.an, after: R.calls.length });
  });
  const mo = new MutationObserver(note);
  lists.forEach(l=> mo.observe(l, { subtree: true, childList: true }));
  const A = Element.prototype.animate;
  Element.prototype.animate = function(kf, o){
    note(mo.takeRecords());
    const an = A.call(this, kf, o);
    if (lists.some(l=> l.contains(this))){
      const c = this.closest('.an-card');
      const what = this.classList.contains('an-body') ? 'body' : this.classList.contains('an-card') ? 'card' : lists.includes(this.parentElement) ? 'ghost' : 'other';
      R.anims.push(an);
      R.calls.push({ what, id: c ? +c.dataset.an : null, kf: kf.map(k=> ({ height: parseFloat(k.height), opacity: +k.opacity })), duration: o.duration, easing: o.easing, fill: o.fill || 'auto' });
    }
    return an;
  };
});
const rec = page => page.evaluate(()=> ({ calls: window.__rec.calls, draws: window.__rec.draws }));
// The list's children frame by frame for ms: each card (its id; 0 for a copy), its height,
// opacity, body's height and the plot data it holds; and the page's scroll.
const sample = (page, mod, ms = 700)=> page.evaluate(([mod, ms])=>{
  const list = document.getElementById(mod + 'Analyses'), out = window.__smp = [], t0 = performance.now();
  const f = ()=>{
    const t = performance.now() - t0;
    out.push({ t, y: scrollY, c: [...list.children].filter(e=> !e.classList.contains('an-add-bar')).map(e=>{
      const b = e.querySelector(':scope > .an-body');
      return { id: e.classList.contains('an-card') ? +e.dataset.an : 0, h: e.getBoundingClientRect().height, o: +getComputedStyle(e).opacity,
        bh: b && b.getClientRects().length ? b.getBoundingClientRect().height : 0, plots: e.querySelectorAll('svg.plot .plot-gdata > *').length };
    }) });
    if (t < ms) requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
}, [mod, ms]);
const samples = page => page.evaluate(()=> window.__smp);
// One card's (or the copy's: 0) values over the frames where it is there.
const track = (smp, id, k)=> smp.map(s=> s.c.find(c=> c.id === id)).filter(Boolean).map(c=> c[k]);
// A slide: the values go one way, with frames in between (not a jump).
function slides(v, up, what){
  const lo = Math.min(...v), hi = Math.max(...v), d = (hi - lo) / 100, all = v.map(x=> Math.round((x - lo) / d)).join(' ');
  for (let i = 1; i < v.length; i++) assert.ok(up ? v[i] >= v[i-1] - d : v[i] <= v[i-1] + d, `${what}: one way (in % of the way: ${all})`);
  const mid = new Set(v.filter(x=> x > lo + 2*d && x < hi - 2*d).map(x=> Math.round((x - lo) / d)));
  assert.ok(hi - lo > 0.5 && mid.size >= 4, `${what}: frames in between, ${mid.size} (in % of the way: ${all})`);
}

// The page's animations at a quarter of their pace (DevTools' playback rate), for a step taken
// while another's animation runs: the wait before it is stretched to match (inside), so that it
// lands where it did at full pace, but a machine slowed by the full suite now has 0.8 to 1 s
// more before the animation would end first (v508: at full pace a 120-ms wait, taken under
// that load, once let a copy shrink to its end before the step came).
const PACE = 0.25;
async function pace(page, rate){
  const s = page.__cdp || (page.__cdp = await page.context().newCDPSession(page));
  await s.send('Animation.enable');
  await s.send('Animation.setPlaybackRate', { playbackRate: rate });
}
const inside = (page, ms)=> page.waitForTimeout(ms / PACE);
// Ctrl+Z / Ctrl+Y, no field focused; not waited for.
async function key(page, redo){
  await page.evaluate(()=> document.activeElement && document.activeElement.blur && document.activeElement.blur());
  await page.keyboard.press(redo ? 'Control+y' : 'Control+z');
}
// Nothing animated in the list any more (no copy left, no animation running), the page still.
async function rest(page, mod){
  await page.waitForFunction(mod=>{
    const l = document.getElementById(mod + 'Analyses');
    return ![...l.children].some(e=> !e.classList.contains('an-card') && !e.classList.contains('an-add-bar'))
      && !document.getAnimations().some(a=> a.effect && a.effect.target && l.contains(a.effect.target) && a.playState === 'running');
  }, mod, { timeout: 5000 });
  let y = -1, n = 0;
  for (let i = 0; i < 80 && n < 3; i++){ const v = await page.evaluate(()=> scrollY); n = v === y ? n + 1 : 0; y = v; await page.waitForTimeout(50); }
  await settle(page);
}
// The cards as the state has them, in its order and each once, folded as its record is, and
// nothing left of an animation: no copy, no card or body held at a height, clipped or faded.
async function exact(page, mod, what){
  const s = await moduleState(page, mod), recs = s.cards || s.analyses;
  const dom = await page.evaluate(mod=> [...document.getElementById(mod + 'Analyses').children].filter(e=> !e.classList.contains('an-add-bar')).map(e=>{
    const b = e.querySelector(':scope > .an-body');
    return { card: e.classList.contains('an-card'), id: +e.dataset.an, folded: e.classList.contains('is-folded'), anim: e.classList.contains('an-anim'),
      style: e.getAttribute('style') || '', bstyle: b.getAttribute('style') || '', o: +getComputedStyle(e).opacity, bo: +getComputedStyle(b).opacity,
      shown: b.getClientRects().length > 0, anims: e.getAnimations().length + b.getAnimations().length };
  }), mod);
  assert.deepEqual(dom.map(d=> d.card ? d.id : 'copy'), recs.map(r=> r.id), `${what}: the cards of the state, in its order, each once`);
  dom.forEach((d, i)=>{
    const tag = `${what}, card ${d.id}`;
    assert.equal(d.folded, recs[i].collapsed === true, tag + ': folded as the state has it');
    assert.equal(d.shown, recs[i].collapsed !== true, tag + ': its body shown unless folded');
    assert.deepEqual([d.anim, d.style, d.bstyle, d.o, d.bo, d.anims], [false, '', '', 1, 1, 0], tag + ': nothing left of an animation');
  });
}
// The tab's undo history: its states and index (cards.js loads them as a step only from a key).
const histTo = (page, mod, which)=> page.evaluate(async ([mod, which])=>{
  const u = await import('./utils.js'), h = u.getModuleHistory(mod);
  if (which === 'mark') window.__mark = h.states[h.index];
  else u.setModuleHistory(mod, { states: [window.__mark, h.states[h.index]], index: 1 });
}, [mod, which]);
async function addCard(page, mod){
  await page.click(`#${mod}AddAn`);
  if (await page.locator('.an-menu:not([hidden]) [data-kind]').count()) await page.locator('.an-menu:not([hidden]) [data-kind]').first().click();
  await page.waitForTimeout(500); await rest(page, mod);
}
async function closeCard(page, mod, id){
  await page.locator(card(mod, id) + ' .an-close').scrollIntoViewIfNeeded();
  await page.click(card(mod, id) + ' .an-close'); await rest(page, mod);
}
const fold = async (page, mod, id)=>{ await page.click(card(mod, id) + ' .an-fold'); await rest(page, mod); };
const headInView = (page, mod, id)=> page.evaluate(sel=>{
  const c = document.querySelector(sel);
  if (!c) return null;
  const h = c.querySelector('.an-head').getBoundingClientRect(), top = document.getElementById('topbar').getBoundingClientRect().bottom;
  return h.top >= top && h.bottom <= innerHeight;
}, card(mod, id));

test('(1) a fold an undo or a redo makes slides as the arrow\'s (XRPD, DRS, GC, EPR)', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await record(page);
    for (const mod of ['xrd', 'tauc', 'gc', 'epr']){
      await openModule(page, mod);
      await loadFiles(page, mod, env.fx.files[mod]);
      // The arrow's: folded, unfolded, folded again.
      await record(page); await fold(page, mod, 1);
      const [arrowFold] = (await rec(page)).calls;
      await record(page); await fold(page, mod, 1);
      const [arrowUnfold] = (await rec(page)).calls;
      await fold(page, mod, 1);
      assert.deepEqual([arrowFold.what, arrowUnfold.what, arrowFold.duration, arrowFold.easing], ['body', 'body', FOLD_MS, EASE], mod + ': the arrow\'s slide');
      // Undone: unfolded, as the arrow does it.
      await record(page); await sample(page, mod);
      await key(page); await rest(page, mod);
      let r = await rec(page), smp = await samples(page);
      assert.equal(r.calls.length, 1, mod + ': one animation, the undo\'s unfold');
      const [un] = r.calls;
      assert.deepEqual([un.what, un.id, un.duration, un.easing, un.fill], ['body', 1, arrowUnfold.duration, arrowUnfold.easing, arrowUnfold.fill], mod + ': unfolded by the undo as by the arrow');
      assert.equal(un.kf[0].height, arrowUnfold.kf[0].height, mod + ': from where the arrow\'s starts');
      assert.ok(Math.abs(un.kf[1].height - arrowUnfold.kf[1].height) <= 1, mod + `: to the height the arrow's goes to (${un.kf[1].height}, ${arrowUnfold.kf[1].height})`);
      assert.deepEqual(un.kf.map(k=> k.opacity), arrowUnfold.kf.map(k=> k.opacity), mod + ': faded in as the arrow\'s');
      assert.deepEqual(r.draws.filter(d=> d.id === 1 && d.after > 0), [], mod + ': drawn before it slides open, nothing drawn while it does');
      slides(track(smp, 1, 'bh'), true, mod + ': the undo\'s unfold, the body\'s height');
      await exact(page, mod, mod + ' unfolded by the undo');
      // XRPD: + Add peak on, the card folded by a redo: left.
      if (mod === 'xrd'){
        await page.click('#xrdA1AddPeak');
        const b = await page.locator('#xrdA1Svg').boundingBox();
        await page.mouse.move(b.x + b.width*0.5, b.y + b.height*0.5); await page.mouse.move(b.x + b.width*0.55, b.y + b.height*0.5);
        assert.equal(await page.evaluate(()=> document.getElementById('xrdA1AddPeak').classList.contains('is-on')), true, 'xrd: + Add peak on');
      }
      // Redone: folded, as the arrow does it.
      await record(page); await sample(page, mod);
      await key(page, true); await rest(page, mod);
      r = await rec(page); smp = await samples(page);
      assert.equal(r.calls.length, 1, mod + ': one animation, the redo\'s fold');
      const [fo] = r.calls;
      assert.deepEqual([fo.what, fo.id, fo.duration, fo.easing, fo.fill], ['body', 1, arrowFold.duration, arrowFold.easing, arrowFold.fill], mod + ': folded by the redo as by the arrow');
      assert.ok(Math.abs(fo.kf[0].height - arrowFold.kf[0].height) <= 1 && fo.kf[1].height === 0, mod + ': from the body\'s height to none');
      assert.deepEqual(fo.kf.map(k=> k.opacity), arrowFold.kf.map(k=> k.opacity), mod + ': faded out as the arrow\'s');
      slides(track(smp, 1, 'bh'), false, mod + ': the redo\'s fold, the body\'s height');
      await exact(page, mod, mod + ' folded by the redo');
      if (mod === 'xrd') assert.deepEqual(await page.evaluate(()=> [document.getElementById('xrdA1AddPeak').classList.contains('is-on'), document.querySelectorAll('#xrdA1Svg .add-guide').length]), [false, 0], 'xrd: + Add peak left as the redo folds its card');
    }
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('(2) a card an undo or a redo brings back grows, one it takes away shrinks (XRPD, DRS, GC, EPR)', async ()=>{
  // (a window short enough for the last card to be below it with the page at its top)
  const { page, errors, close } = await env.page({ viewport: { width: 1400, height: 640 } });
  try {
    await record(page);
    for (const mod of ['xrd', 'tauc', 'gc', 'epr']){
      await openModule(page, mod);
      await loadFiles(page, mod, env.fx.files[mod]);
      await addCard(page, mod);
      const n = await page.locator(`#tab-${mod} .an-card`).count(), added = await page.$$eval(`#tab-${mod} .an-card`, cs=> +cs[cs.length - 1].dataset.an);
      // Closed by its ×, in view; brought back by an undo: it grows in its place, drawn first.
      await closeCard(page, mod, 1);
      await record(page); await sample(page, mod);
      await key(page); await rest(page, mod);
      let r = await rec(page), smp = await samples(page);
      const full = await page.$eval(card(mod, 1), c=> c.getBoundingClientRect().height);
      const plots = await page.$eval(card(mod, 1), c=> c.querySelectorAll('svg.plot .plot-gdata > *').length);
      assert.equal(r.calls.length, 1, mod + ': one animation, the card\'s growth');
      const [gr] = r.calls;
      assert.deepEqual([gr.what, gr.id, gr.duration, gr.easing], ['card', 1, FOLD_MS, EASE], mod + ': the card grows, as a fold goes');
      assert.deepEqual(gr.kf.map(k=> [Math.round(k.height), k.opacity]), [[0, 0], [Math.round(full), 1]], mod + ': from nothing to its height, faded in');
      assert.deepEqual(r.draws.filter(d=> d.id === 1 && d.after > 0), [], mod + ': drawn before it grows, nothing drawn while it does');
      const first = smp.map(s=> s.c.find(c=> c.id === 1)).find(Boolean);
      assert.ok(plots > 0 && first.plots === plots && first.h < full/2, mod + `: drawn whole at its first frame, small (${first.h} of ${full}; ${first.plots} of ${plots} plot elements)`);
      slides(track(smp, 1, 'h'), true, mod + ': the card back, its height');
      slides(track(smp, 1, 'o'), true, mod + ': the card back, its opacity');
      assert.equal(await headInView(page, mod, 1), true, mod + ': in view');
      await exact(page, mod, mod + ' card back');
      // Redone: taken away at once (no card 1), a copy shrinking where it was, then nothing.
      await record(page); await sample(page, mod);
      await key(page, true);
      const copy = await page.evaluate(([mod, sel])=>{
        const g = [...document.getElementById(mod + 'Analyses').children].filter(e=> !e.classList.contains('an-card') && !e.classList.contains('an-add-bar'));
        return { card: document.querySelectorAll(sel).length, n: g.length, inert: g[0] && g[0].inert, aria: g[0] && g[0].getAttribute('aria-hidden'), an: g[0] && g[0].hasAttribute('data-an'),
          ids: g[0] ? [...g[0].querySelectorAll('[id]')].filter(e=> !/^an-ghost\d+$/.test(e.id) || e.tagName !== 'clipPath').length : -1, names: g[0] ? g[0].querySelectorAll('[name]').length : -1,
          cards: document.querySelectorAll(`#tab-${mod} .an-card`).length };
      }, [mod, card(mod, 1)]);
      assert.deepEqual(copy, { card: 0, n: 1, inert: true, aria: 'true', an: false, ids: 0, names: 0, cards: n - 1 }, mod + ': the card gone at once, a copy of it no card\'s selector finds');
      await rest(page, mod);
      r = await rec(page); smp = await samples(page);
      assert.deepEqual(r.calls.map(c=> [c.what, c.duration, c.easing, c.fill, Math.round(c.kf[0].height), c.kf[0].opacity, c.kf[1].height, c.kf[1].opacity]),
        [['ghost', FOLD_MS, EASE, 'forwards', Math.round(full), 1, 0, 0]], mod + ': the copy shrinks from the card\'s height to nothing, faded out');
      slides(track(smp, 0, 'h'), false, mod + ': the copy, its height');
      assert.ok(smp[smp.length - 1].c.every(c=> c.id), mod + ': the copy gone once shrunk');
      await exact(page, mod, mod + ' card away');
      // The card added, undone and redone with the page at its top: it grows below the
      // window as the page scrolls down to it.
      await key(page); await rest(page, mod);
      await key(page); await rest(page, mod);
      await page.evaluate(()=> window.scrollTo(0, 0)); await rest(page, mod);
      assert.equal(await page.evaluate(m=> document.getElementById(m + 'AddBar').getBoundingClientRect().top > innerHeight, mod), true, mod + ': the end of the cards below the window');
      await record(page); await sample(page, mod, 1200);
      await key(page, true); await rest(page, mod);
      r = await rec(page); smp = await samples(page);
      assert.deepEqual(r.calls.map(c=> [c.what, c.id]), [['card', added]], mod + ': the card added, redone, grows');
      const y0 = smp[0].y, y1 = smp[smp.length - 1].y, h2 = r.calls[0].kf[1].height;
      assert.ok(y1 > y0, mod + ': the page scrolled down to it');
      assert.ok(smp.some(s=> s.y > y0 + 2 && s.y < y1 - 2 && s.c.some(c=> c.id === added && c.h > 2 && c.h < h2 - 2)), mod + ': growing as the page scrolls');
      assert.equal(await headInView(page, mod, added), true, mod + ': in view');
      await exact(page, mod, mod + ' card added, redone');
    }
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('(4) several cards in a step together; steps taken during an animation; a move undone, a kind switched back', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await record(page);
    const mod = 'gc';
    await openModule(page, mod);
    await loadFiles(page, mod, env.fx.files[mod]);
    await addCard(page, mod);
    // One step from two folded cards and a third added back to the two open: both unfold
    // and the third shrinks away, together (the same start), and back.
    await histTo(page, mod, 'mark');
    await fold(page, mod, 1); await fold(page, mod, 2); await addCard(page, mod);
    await histTo(page, mod, 'set');
    for (const redo of [false, true]){
      await record(page);
      await key(page, redo); await rest(page, mod);
      const r = await rec(page), starts = await page.evaluate(()=> window.__rec.anims.map(a=> a.startTime));
      assert.deepEqual(r.calls.map(c=> [c.what, c.id]).sort(), (redo ? [['body', 1], ['body', 2], ['card', 3]] : [['body', 1], ['body', 2], ['ghost', null]]).sort(), 'several cards in one step: ' + (redo ? 'redo' : 'undo'));
      assert.ok(starts.every(t=> t === starts[0]), 'started together: ' + starts.join(' '));
      await exact(page, mod, 'several in one step, ' + (redo ? 'redone' : 'undone'));
    }
    await key(page); await rest(page, mod);
    await addCard(page, mod);
    await exact(page, mod, 'three cards open');
    // A fold taken over midway: unfolded by an undo, folded by a redo while it slides.
    await pace(page, PACE);
    await fold(page, mod, 1);
    await record(page);
    await key(page); await inside(page, 120); await key(page, true); await rest(page, mod);
    let c = (await rec(page)).calls;
    assert.deepEqual(c.map(x=> [x.what, x.id]), [['body', 1], ['body', 1]], 'unfolded, then folded');
    assert.ok(c[1].kf[0].height > 2 && c[1].kf[0].height < c[0].kf[1].height - 2, `the fold taken over from where the unfold had got to (${c[1].kf[0].height} of ${c[0].kf[1].height})`);
    await exact(page, mod, 'fold taken over');
    await key(page); await rest(page, mod);
    // A card taken away while it grows: its copy shrinks from where it had got to.
    await closeCard(page, mod, 3);
    await record(page);
    await key(page); await inside(page, 120); await key(page, true); await rest(page, mod);
    c = (await rec(page)).calls;
    assert.deepEqual(c.map(x=> x.what), ['card', 'ghost'], 'grown, then taken away');
    assert.ok(c[1].kf[0].height > 2 && c[1].kf[0].height < c[0].kf[1].height - 2, `its copy from where it had got to (${c[1].kf[0].height} of ${c[0].kf[1].height})`);
    await exact(page, mod, 'taken away while it grew');
    // Brought back while its copy shrinks: it grows from there, the copy gone at once (never
    // the card and its copy together).
    await key(page); await rest(page, mod);
    await record(page); await sample(page, mod);
    await key(page, true); await inside(page, 120); await key(page); await rest(page, mod);
    c = (await rec(page)).calls;
    const smp = await samples(page);
    assert.deepEqual(c.map(x=> x.what), ['ghost', 'card'], 'taken away, then back');
    assert.ok(c[1].kf[0].height > 2 && c[1].kf[0].height < c[1].kf[1].height - 2 && c[1].kf[0].opacity > 0, `grown from where its copy had got to (${c[1].kf[0].height} of ${c[1].kf[1].height})`);
    assert.ok(smp.every(s=> s.c.filter(x=> x.id === 3 || x.id === 0).length <= 1), 'never the card and its copy together');
    await exact(page, mod, 'back while its copy shrank');
    await pace(page, 1);
    // A burst of keys: the end exact.
    for (let i = 0; i < 9; i++){ await key(page, i % 2 === 1); await page.waitForTimeout(40); }
    await rest(page, mod);
    await exact(page, mod, 'a burst of undos and redos');
    // A move undone: the order back, nothing animated.
    const ids = ()=> page.$$eval(`#tab-${mod} .an-card`, cs=> cs.map(x=> +x.dataset.an));
    const before = await ids();
    await page.locator(card(mod, before[0]) + ' .an-grip').scrollIntoViewIfNeeded(); await rest(page, mod);
    const g = await page.locator(card(mod, before[0]) + ' .an-grip').boundingBox();
    await page.mouse.move(g.x + g.width/2, g.y + g.height/2);
    await page.mouse.down(); await page.waitForTimeout(500);
    const last = await page.locator(card(mod, before[before.length - 1])).boundingBox();
    await page.mouse.move(g.x + g.width/2, last.y + last.height*0.9, { steps: 10 }); await page.waitForTimeout(200);
    await page.mouse.up(); await rest(page, mod);
    const moved = await ids();
    assert.notDeepEqual(moved, before, 'moved');
    await record(page);
    await key(page); await rest(page, mod);
    assert.deepEqual(await ids(), before, 'the move undone');
    assert.deepEqual((await rec(page)).calls, [], 'nothing animated by the move undone');
    await exact(page, mod, 'move undone');
    // XRPD: a card turned into the other kind, switched back by an undo: rebuilt in place, as
    // a switch is, nothing growing or shrinking.
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd);
    await page.click(card('xrd', 1) + ' .an-type'); await page.click('.an-menu:not([hidden]) [data-kind="rietveld"]'); await rest(page, 'xrd');
    await record(page);
    await key(page); await rest(page, 'xrd');
    assert.deepEqual((await rec(page)).calls, [], 'nothing animated by a kind switched back');
    assert.deepEqual(await page.$$eval('#tab-xrd .an-card', cs=> cs.map(x=> [+x.dataset.an, x.querySelector('.an-type').textContent])), [[1, 'Scherrer'], [2, 'Rietveld']], 'the card back to its kind, in its place');
    await exact(page, 'xrd', 'kind switched back');
    // A card in its place is left there by a step: a box in it keeps the focus (to v503 every
    // card was put in again, and the focus went to the page).
    await page.click('#xrdA1BlOn'); await settle(page);
    await page.keyboard.press('Control+z'); await rest(page, 'xrd');
    assert.equal(await page.evaluate(()=> document.activeElement.id), 'xrdA1BlOn', 'the focus kept on the box an undo set back');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* A card's height and opacity frame by frame for ms, at each frame's own time (the time its
   animations are at), in the frames where it is there. */
const sampleCard = (page, sel, ms)=> page.evaluate(([sel, ms])=>{
  const out = window.__cs = [];
  let t0 = null;
  const f = ts =>{
    if (t0 === null) t0 = ts;
    const c = document.querySelector(sel);
    if (c) out.push({ t: ts - t0, h: c.getBoundingClientRect().height, o: +getComputedStyle(c).opacity });
    if (ts - t0 < ms) requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
}, [sel, ms]);
// No jump from a frame to the next: no faster than a slide over H (the most any of the
// animations spans) or over the whole opacity can go, at the steepest of the fold's curve
// (2.735 times its mean pace), with a fifth more and 2 px to spare.
function noJump(v, H, what){
  const steep = 1.2 * 2.735 / FOLD_MS;
  for (let i = 1; i < v.length; i++){
    const dt = v[i].t - v[i-1].t, dh = Math.abs(v[i].h - v[i-1].h), dop = Math.abs(v[i].o - v[i-1].o);
    assert.ok(dh <= steep * H * dt + 2, `${what}: the height, ${Math.round(v[i-1].h)} to ${Math.round(v[i].h)} px in ${Math.round(dt)} ms (at most ${Math.round(steep * H * dt + 2)})`);
    assert.ok(dop <= steep * dt + 0.02, `${what}: the opacity, ${v[i-1].o} to ${v[i].o} in ${Math.round(dt)} ms`);
  }
}

test('(4) a card still growing folded or unfolded by the next step or by its arrow: it goes on from where it had got to (XRPD, DRS, GC, EPR)', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await record(page);
    for (const mod of ['xrd', 'tauc', 'gc', 'epr']){
      await openModule(page, mod);
      await loadFiles(page, mod, env.fx.files[mod]);
      await addCard(page, mod);
      const id = await page.$$eval(`#tab-${mod} .an-card`, cs=> +cs[cs.length - 1].dataset.an), sel = card(mod, id);
      // The history: the card added (open), folded, unfolded, closed by its ×.
      await fold(page, mod, id); await fold(page, mod, id); await closeCard(page, mod, id);
      const cases = [
        // brought back open by an undo, folded by the next undo as it grows
        ['folded by an undo', true, ()=> key(page)],
        // closed again from folded; brought back folded by an undo, unfolded by the next
        ['unfolded by an undo', false, ()=> key(page), ()=> closeCard(page, mod, id)],
        // closed again; brought back open by an undo, folded by its arrow as it grows
        ['folded by its arrow', true, ()=> page.evaluate(s=> document.querySelector(s).click(), sel + ' .an-fold'), ()=> closeCard(page, mod, id)],
      ];
      for (const [what, folds, then, setup] of cases){
        const tag = `${mod}: a card growing, ${what}`;
        if (setup) await setup();
        await record(page); await sampleCard(page, sel, 1200);
        await pace(page, PACE);
        await key(page); await inside(page, 80); await then(); await rest(page, mod);
        await pace(page, 1);
        const c = (await rec(page)).calls, v = await page.evaluate(()=> window.__cs), end = await page.$eval(sel, e=> e.getBoundingClientRect().height);
        assert.deepEqual(c.map(x=> [x.what, x.id]), [['card', id], ['body', id], ['card', id]], tag + ': grown, then the body\'s slide and the card\'s from where it had got to');
        const [g, , r] = c;
        assert.ok(r.kf[0].height > 2 && r.kf[0].height < g.kf[1].height - 2 && r.kf[0].opacity > 0 && r.kf[0].opacity < 1, `${tag}: taken over midway (${r.kf[0].height} of ${g.kf[1].height} px, opacity ${r.kf[0].opacity})`);
        assert.ok(Math.abs(r.kf[1].height - end) <= 1 && r.kf[1].opacity === 1 && r.duration === FOLD_MS && r.easing === EASE, `${tag}: to its height once ${folds ? 'folded' : 'unfolded'} (${r.kf[1].height}, ${end}), as the fold goes`);
        noJump(v, Math.max(...c.flatMap(x=> x.kf.map(k=> k.height)), ...v.map(s=> s.h)), tag);
        await exact(page, mod, tag);
        assert.equal(await page.$eval(sel, e=> e.classList.contains('is-folded')), folds, tag + ': ' + (folds ? 'folded' : 'open'));
      }
    }
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('(3) nothing animated by a tab switch, a project opened, a CSV export\'s state, the start; nor with the motion reduced', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await record(page);
    const mod = 'gc', calls = async ()=> (await rec(page)).calls;
    // The start, files loaded, a card added and folded by hand (the arrow's own slide aside).
    await openModule(page, mod);
    await loadFiles(page, mod, env.fx.files[mod]);
    await addCard(page, mod);
    assert.deepEqual(await calls(page), [], 'the start and a load: nothing');
    await fold(page, mod, 1);
    // (kept in the page as a project holds it: db.js encode)
    await page.evaluate(async m=>{ const u = await import('./utils.js'), db = await import('./db.js'); window.__both = db.encode(u.getModuleState(m)); }, mod);
    // Tab 2: card 1 closed (an undo and a redo of it: the history's keys behind it) and card 2 folded.
    await openModule(page, mod);
    await loadFiles(page, mod, env.fx.files[mod]);
    await addCard(page, mod);
    await closeCard(page, mod, 1); await key(page); await rest(page, mod); await key(page, true); await rest(page, mod);
    await fold(page, mod, 2);
    await record(page);
    await switchTab(page, 0); await rest(page, mod);
    await exact(page, mod, 'tab 1');
    await switchTab(page, 1); await rest(page, mod);
    await exact(page, mod, 'tab 2');
    assert.deepEqual(await calls(page), [], 'tab switches: nothing animated');
    // A project opened (the tab's restore of it) and a CSV export's state, read in and out.
    await page.evaluate(async m=>{ const u = await import('./utils.js'), db = await import('./db.js'); u.restoreModuleState(m, db.decode(window.__both)); }, mod);
    await rest(page, mod);
    await exact(page, mod, 'project opened');
    await page.evaluate(async m=>{ const u = await import('./utils.js'), s = u.getModuleState(m); u.runWithModuleState(m, { ...s, cards: s.cards.map(c=> ({ ...c, collapsed: !c.collapsed })).slice(1) }, ()=>{}); }, mod);
    await rest(page, mod);
    assert.deepEqual(await calls(page), [], 'a project opened, a CSV export\'s state: nothing animated');
    await exact(page, mod, 'CSV export\'s state');
    // Such a load while a card an undo brought back grows, and while the copy of one a redo
    // took away shrinks, ends them at once.
    const left = m => page.evaluate(m=>{ const l = document.getElementById(m + 'Analyses'); return { copies: [...l.children].filter(e=> !e.classList.contains('an-card') && !e.classList.contains('an-add-bar')).length, animated: [...l.querySelectorAll('.an-card')].filter(e=> e.getAnimations().length || e.getAttribute('style')).length }; }, m);
    const csvState = ()=> page.evaluate(async m=>{ const u = await import('./utils.js'); u.runWithModuleState(m, u.getModuleState(m), ()=>{}); }, mod);
    await closeCard(page, mod, 1);
    await pace(page, PACE);
    await key(page); await inside(page, 60);
    assert.equal((await left(mod)).animated, 1, 'a card growing');
    await csvState();
    assert.deepEqual(await left(mod), { copies: 0, animated: 0 }, 'a CSV export\'s state over a growth: ended at once');
    await rest(page, mod);
    await exact(page, mod, 'after a CSV export\'s state over a growth');
    await key(page, true); await inside(page, 60);
    assert.equal((await left(mod)).copies, 1, 'a copy shrinking');
    await csvState();
    assert.deepEqual(await left(mod), { copies: 0, animated: 0 }, 'a CSV export\'s state over a copy shrinking: ended at once');
    await rest(page, mod);
    await exact(page, mod, 'after a CSV export\'s state over a copy shrinking');
    await pace(page, 1);
    // The motion reduced: the steps put at once, the card back in view all the same.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await key(page); await rest(page, mod);
    await fold(page, mod, 1);
    await record(page);
    await key(page); await rest(page, mod);
    await exact(page, mod, 'reduced: unfolded by an undo');
    await key(page, true); await rest(page, mod);
    await closeCard(page, mod, 1);
    await page.evaluate(()=> window.scrollTo(0, document.documentElement.scrollHeight)); await rest(page, mod);
    await key(page); await rest(page, mod);
    assert.equal(await headInView(page, mod, 1), true, 'reduced: the card back in view');
    await key(page, true);
    assert.equal(await page.evaluate(m=> [...document.getElementById(m + 'Analyses').children].filter(e=> !e.classList.contains('an-card') && !e.classList.contains('an-add-bar')).length, mod), 0, 'reduced: no copy shrinking');
    await rest(page, mod);
    assert.deepEqual(await calls(page), [], 'the motion reduced: nothing animated');
    await exact(page, mod, 'reduced');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
