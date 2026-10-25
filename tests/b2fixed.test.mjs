/* Arrays fixed (db.js fixed, b2v3): an array a module makes and never changes, marked so,
   shared by park and decode, not copied, and not frozen (to b2v2 XRPD's were frozen, which
   holds a double in twice the memory, and DRS's, GC's and EPR's were copied into every
   state parked). In Node: park and decode give a fixed array back as it is and copy one
   not fixed; encode writes both out alike. In the page, the tests' freezing of each fixed
   array off (window.__freezeFixed): a tab of XRPD, DRS, GC and EPR asleep, its parked
   state holding its history's arrays, none frozen; woken, its instance's the same arrays;
   the history's key of a state (stateKey) taking a fixed array by its hash. With the
   freezing on, as in every other test, a fixed array is frozen, so that a write throws. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle, ready } from './helpers.mjs';

const db = await import('../db.js');

test('park and decode share a fixed array and copy one not fixed; encode writes both out', ()=>{
  const x = db.fixed([1.5, 2.5, 3.5]), y = [4.5, 5.5], s = { files: [{ x, y, n: 'a' }], d: new Date(0) };
  const p = db.park(s), back = db.decode(p);
  assert.equal(p.files[0].x, x, 'parked: the fixed array itself');
  assert.notEqual(p.files[0].y, y, 'parked: a copy of one not fixed');
  assert.deepEqual(p.files[0].y, y);
  assert.equal(back.files[0].x, x, 'decoded: the fixed array itself');
  assert.notEqual(back.files[0].y, p.files[0].y);
  assert.ok(db.isFixed(x) && !db.isFixed(y) && !Object.isFrozen(x), 'fixed, not frozen');
  assert.equal(db.fixed(x), x);
  assert.deepEqual(JSON.parse(JSON.stringify(db.encode(s))).files[0], { x: [1.5, 2.5, 3.5], y: [4.5, 5.5], n: 'a' });
});

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const FILES = ()=> ({ xrd: env.fx.files.xrd, tauc: env.fx.files.tauc, gc: env.fx.files.gc, epr: env.fx.files.epr });

test('a tab of each module asleep holds its history\'s arrays, not frozen; woken, the same; stateKey by hash; a write into a fixed array throws where the tests freeze them', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await page.addInitScript(()=>{ window.__freezeFixed = false; });
    await page.reload(); await ready(page);
    for (const [mod, files] of Object.entries(FILES())){ await openModule(page, mod); await loadFiles(page, mod, files); }
    await openModule(page, 'gc');
    const arrays = ()=> page.evaluate(async ()=>{
      const T = await import('./tabs.js'), u = await import('./utils.js'), db = await import('./db.js');
      const nums = (v, out = [])=>{ if (Array.isArray(v) && db.isFixed(v)) out.push(v); else if (v && typeof v === 'object' && !ArrayBuffer.isView(v)) for (const k in v) nums(v[k], out); return out; };
      window.__a = window.__a || {};
      return T.TABS.slice(0, 4).map(t=>{
        if (t.inst){ const a = nums(u.getModuleState(t.id)); const was = window.__a[t.id]; window.__a[t.id] = a;
          return { mod: t.module, awake: true, n: a.length, same: !!was && a.length === was.length && a.every(x=> was.includes(x)), frozen: a.filter(Object.isFrozen).length }; }
        const p = nums(t.state), h = new Set(t.hist.states.flatMap(s=> nums(s)));
        window.__a[t.id] = p;
        return { mod: t.module, awake: false, n: p.length, shared: p.filter(x=> h.has(x)).length, frozen: p.filter(Object.isFrozen).length };
      });
    });
    await page.evaluate(async ()=> (await import('./tabs.js')).sleepTick(Date.now() + 11*60e3));
    const asleep = await arrays();
    // (XRPD: 2θ and intensities of 3 patterns; DRS: λ and F(R) of 2; GC: H₂ of 2 and O₂ of 1; EPR: field and intensities of 2)
    assert.deepEqual(asleep.map(t=> [t.mod, t.awake, t.n, t.shared, t.frozen]),
      [['xrd', false, 6, 6, 0], ['tauc', false, 4, 4, 0], ['gc', false, 3, 3, 0], ['epr', false, 4, 4, 0]]);
    for (let i = 0; i < 4; i++){ await page.locator('#tabBar .ptab').nth(i).locator('.ptab-label').click(); await settle(page); }
    const woken = await arrays();
    assert.deepEqual(woken.map(t=> [t.mod, t.awake, t.n, t.same, t.frozen]),
      [['xrd', true, 6, true, 0], ['tauc', true, 4, true, 0], ['gc', true, 3, true, 0], ['epr', true, 4, true, 0]], 'woken: the arrays it slept with');
    assert.ok(await page.evaluate(async ()=>{ const u = await import('./utils.js'); return /^\{"x":"nums:3:/.test(u.stateKey({ x: u.fixed([1, 2, 3]) })); }));
    // With the tests' freezing on, a fixed array is frozen: a write into it, in the app's
    // modules (strict), throws.
    await page.addInitScript(()=>{ window.__freezeFixed = true; });
    await page.reload(); await ready(page);
    assert.ok(await page.evaluate(async ()=> Object.isFrozen((await import('./db.js')).fixed([1, 2]))));
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});
