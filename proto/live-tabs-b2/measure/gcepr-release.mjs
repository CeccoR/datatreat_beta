/* What frees a hidden GC or EPR tab's plots (gc-epr.patch: no trim), the tab of gcepr.mjs's
   fixture (10 files, one card) hidden beside a blank one on show: plot.js releasePlot on
   each plot; then its tool row removed too (its buttons' handlers hold the Plot, and so the
   elements releasePlot took out of the svg); then each svg replaced by an empty copy (its
   own listeners gone). The whole page after a forced GC (lib.mjs mem), one step after the
   other. B2_BASE (HEAD + core.patch + gc-epr.patch). node gcepr-release.mjs →
   results/gcepr-release.json */
import { launch, save } from './lib.mjs';
import { gcCsv, eprPair } from '../../../tests/fixtures.mjs';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-'));
const put = (n, b)=>{ const p = path.join(dir, n); fs.writeFileSync(p, b); return p; };
const gc = Array.from({ length: 10 }, (_, i)=> put(`g${i}.csv`, gcCsv({ n: 72, h2: [0.04 + 0.01*i, 0.1], o2: [0.02, 0.04], seed: 40 + i })));
const epr = Array.from({ length: 10 }, (_, i)=>{ const e = eprPair({ title: 'E' + i, B0: 3380 + 4*i, seed: 60 + i }); return [put(`e${i}.DSC`, e.dsc), put(`e${i}.DTA`, e.dta)]; }).flat();
const out = {};
for (const [mod, f] of [['gc', gc], ['epr', epr]]){
  const { app, page, mem, close } = await launch(process.env.B2_BASE || 'http://127.0.0.1:8966');
  await app.newTab(mod); await app.drop(`#${mod}Dropzone`, f);
  await page.waitForFunction(m=> document.querySelectorAll(`#${m}FileTableWrap tr.file-row`).length >= 10, mod); await app.settle();
  await app.newTab(mod);
  const step = how => page.evaluate(async how=>{ const T = await import('./tabs.js'), P = await import('./plot.js'), root = T.TABS[0].inst.root;
    root.querySelectorAll('svg.plot').forEach(svg=>{
      if (how === 'release') P.releasePlot(svg);
      if (how === 'tools') svg.closest('.plot-wrap').querySelectorAll('.plot-tool-btns').forEach(r=> r.remove());
      if (how === 'svg') svg.replaceWith(svg.cloneNode(false));
    }); }, how);
  const r = { awake: await mem() };
  for (const how of ['release', 'tools', 'svg']){ await step(how); r[how] = await mem(); }
  out[mod] = r; console.log(mod, JSON.stringify(r));
  await close();
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(save('gcepr-release.json', out));
