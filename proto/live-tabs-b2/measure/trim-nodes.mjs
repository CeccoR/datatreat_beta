/* What an XRPD tab's trim gives back with releasePlot dropping the Plot's groups (b2.patch)
   and without (the five stage patches: the Plot kept by its tool buttons kept every element
   it drew). A tab of the 12 patterns, the CIF, refined, hidden behind a blank XRPD tab: the
   whole page's memory awake, trimmed (tabs.js sleepTick past 60 s), shown again, asleep
   (past 10 min). Each tree on its own port: node trim-nodes.mjs URL_WITH URL_WITHOUT [runs]
   → results/trim-nodes.json */
import { launch, XRD12, save } from './lib.mjs';

const [WITH, WITHOUT, RUNS = 2] = process.argv.slice(2);
async function once(base){
  const L = await launch(base, { knobs: { 'datatreat-rv-idle': '1' } });
  const { app, mem, page } = L;
  await app.newTab('xrd'); await app.files('xrd', XRD12); await app.cif(); await app.refineAll(); await app.refineDone(); await app.settle();
  await app.newTab('xrd'); await page.waitForTimeout(2500);
  const o = { awake: await mem() };
  await app.tick(61000); o.trimmed = await mem();
  await app.show(0); o.shownAgain = await mem(); await app.show(1);
  await app.tick(11*60000); o.asleep = await mem();
  o.errors = L.errors;
  await L.close();
  return o;
}
const out = { with: [], without: [] };
for (let i = 0; i < +RUNS; i++){ out.without.push(await once(WITHOUT)); out.with.push(await once(WITH)); }
console.log(JSON.stringify(out));
console.log(save('trim-nodes.json', { method: 'measure/trim-nodes.mjs: headless Chromium, 4 vCPUs, forced GCs before each reading (lib.mjs mem)', ...out }));
