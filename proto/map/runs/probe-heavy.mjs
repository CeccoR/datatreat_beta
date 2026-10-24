import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8983';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e=> console.log('pageerror', e.message));
await page.goto(BASE + '/bench/bench.html');
await page.waitForFunction(()=> window.benchReady);
const s = await page.evaluate(()=> window.refineStd());
console.log('std', s.ms.toFixed(0), JSON.stringify(s.irf));
const CONF = {
  wppm: { on: { wppm: true } },
  ellipsoid: { dep: { size: 'ellipsoid' } },
  heavy: { on: { adp: true, occ: true }, dep: { size: 'ellipsoid', adp: 'overall', occ: 'Sr1' } },
};
for (const [n, over] of Object.entries(CONF)){
  const t = Date.now();
  const r = await page.evaluate(o=> window.bench({ k: 1, over: o, irf: true, which: [0] }), over);
  r.jobs.forEach(j=> console.log(n, j.name, j.ms.toFixed(0), 'engine', j.engineMs, 'prog', j.nprog, 'res', j.resBytes, 'pay', j.payBytes, j.rwp));
}
await browser.close();
