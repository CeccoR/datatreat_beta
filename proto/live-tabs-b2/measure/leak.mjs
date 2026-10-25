/* Is an instance let go when its tab sleeps? An XRPD tab blank, of the 12 patterns, of the
   12 refined; a blank XRPD tab shown after it; a WeakRef to the first instance's section;
   the tab put to sleep (tabs.js sleepTick); after a forced GC, the WeakRef emptied or not,
   and Blink's DOM nodes against the blank tab's. Files dropped (lib.mjs drop), not given
   to the input: Playwright's setInputFiles keeps a hold on that input, and so on its
   instance. node leak.mjs → results/leak.json */
import { launch, XRD12, save } from './lib.mjs';
const out = {};
for (const what of ['blank', 'patterns', 'refined']){
  const { app, page, mem, errors, close } = await launch(process.env.B2_BASE || 'http://127.0.0.1:8993', { knobs: { 'datatreat-rv-idle': '1' } });
  if (what === 'refined') await app.xrdRefined();
  else { await app.newTab('xrd'); if (what === 'patterns') await app.files('xrd', XRD12); }
  await app.newTab('xrd');
  await page.evaluate(async ()=>{ const T = await import('./tabs.js'); window.__wr = new WeakRef(T.TABS[0].inst.root); return 1; });
  const before = await mem();
  await app.tick(11*60e3);
  const after = await mem();
  out[what] = { before, after, collected: await page.evaluate(()=> !window.__wr.deref()), errors };
  console.log(what, JSON.stringify(out[what]));
  await close();
}
console.log(save('leak.json', out));
