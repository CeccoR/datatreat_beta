/* The last edit before a reload: two smoothing widths typed in card 1 (the first is written at
   once by the autosave's leading edge, the second only by its 5 s trailing write, or by the
   flush on visibilitychange/pagehide), the page reloaded WAIT ms after the second; which
   width comes back. With live tabs the edited tab is a frame (on show). 6 rounds.
   node flush.mjs <tree> [wait=300] */
import { launch, xrdTab, show, realm, sleep, save } from './rlib.mjs';
const [tree, wait = '300'] = process.argv.slice(2);
const env = await launch(tree);
const page = env.page;
const A = await xrdTab(env);
const out = [];
const setW = (s, v)=> s.evaluate(v=>{ const el = document.querySelector('#xrdA1Smooth'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, v);
for (let r = 0; r < 6; r++){
  let s = await show(env, A);
  await sleep(6000);                      // (any earlier trailing write done)
  const v1 = (0.2 + r*0.01).toFixed(2), v2 = (0.4 + r*0.01).toFixed(2);
  await setW(s, v1); await sleep(400);
  await setW(s, v2); await sleep(+wait);
  await page.reload();
  await page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab'), null, { timeout: 60000 });
  s = await show(env, A); await sleep(500);
  const got = await s.evaluate(()=> document.querySelector('#xrdA1Smooth').value);
  out.push({ v1, v2, got, kept: got === v2 ? 'last' : got === v1 ? 'first only' : 'neither' });
  console.log(tree, 'round', r, 'typed', v1, 'then', v2, '→ after reload', got, '(' + out[r].kept + ')');
}
save(`flush-${tree}-${wait}.json`, { tree, wait: +wait, out, errors: env.errors });
await env.close();
