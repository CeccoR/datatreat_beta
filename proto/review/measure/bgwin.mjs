/* A refinement while the app's whole page is hidden (another browser tab brought to front):
   visibilityState, animation frames a second, and the run's time, in head and live (a hidden
   frame). node bgwin.mjs <tree> */
import { launch, xrdTab, plainTab, show, realm, startRefine, runEnd, sleep, DRS } from './rlib.mjs';
const tree = process.argv[2];
const env = await launch(tree);
const A = await xrdTab(env);
let s = await show(env, A);
await sleep(500);
const other = await env.ctx.newPage();
await other.goto('about:blank');
await other.bringToFront();
await sleep(1000);
const vis = await s.evaluate(()=> document.visibilityState);
const raf = await s.evaluate(()=> new Promise(r=>{ let n = 0; const t0 = performance.now(); const f = ()=>{ n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); }; requestAnimationFrame(f); setTimeout(()=> r(n), 1500); }));
console.log(tree, 'page behind another tab: visibilityState', vis, '| rAF in 1 s:', raf);
const t0 = await startRefine(s);
const t1 = await Promise.race([runEnd(s), sleep(60000).then(()=> null)]);
console.log(tree, 'Refine all with the page behind another tab:', t1 ? Math.round(t1 - t0) + ' ms' : 'not ended in 60 s');
await env.page.bringToFront();
await env.close();
