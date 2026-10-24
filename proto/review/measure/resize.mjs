/* Live tabs: a window resized while an XRPD tab is hidden: is it drawn at the new width once
   shown? Card 2's plot (its svg) width against its box's, before and after; also while a run
   ends hidden. */
import { launch, xrdTab, plainTab, show, realm, startRefine, runEnd, sleep, DRS } from './rlib.mjs';
for (const tree of ['head', 'live']){
  const env = await launch(tree);
  const A = await xrdTab(env), B = await plainTab(env, 'tauc', DRS);
  const widths = s => s.evaluate(()=> [...document.querySelectorAll('#tab-xrd svg')].filter(x=> x.getBoundingClientRect().width > 200).slice(0, 3).map(svg=>{ const b = svg.getBBox(); return { svg: Math.round(svg.getBoundingClientRect().width), content: Math.round(b.x + b.width) }; }));
  let s = await show(env, A);
  console.log(tree, 'A at 1400:', JSON.stringify(await widths(s)));
  await show(env, B);
  await env.page.setViewportSize({ width: 1000, height: 800 });
  await sleep(800);
  s = await show(env, A);
  await sleep(800);
  console.log(tree, 'A shown after resize to 1000 while hidden:', JSON.stringify(await widths(s)));
  // a run that ends while hidden, the window resized meanwhile
  const t = await startRefine(s);
  await env.page.locator('#tabBar .ptab').nth(B).locator('.ptab-label').click().catch(()=>{});
  if (tree === 'live'){
    await env.page.setViewportSize({ width: 1300, height: 850 });
    await runEnd(s);
    await sleep(500);
    s = await show(env, A); await sleep(800);
    console.log(tree, 'A shown after a run ended hidden, window 1300:', JSON.stringify(await widths(s)));
  }
  console.log(tree, 'errors', env.errors);
  await env.close();
}
