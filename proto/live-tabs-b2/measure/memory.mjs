/* Memory with k XRPD tabs of the 12 patterns refined (k = 1…4) and a blank XRPD tab on
   show (the first tab, shown again after each one refined): HEAD (v517: one instance, the others parked) against b2 with the k tabs hidden and
   awake (each measured as it comes, all awake: tabs.js's limit is 6, and each was hidden for
   less than TRIM_MS, as tabsNow says), then all trimmed and all asleep (tabs.js sleepTick).
   After a forced GC: the page's JS heap, Blink's DOM nodes, the renderer's RSS; the
   workers' idle time 1 s, so that none of the pool's is left in the numbers.
   node memory.mjs → results/memory.json */
import { launch, BASES, save, sleep } from './lib.mjs';
const K = 4, out = { head: [], b2: [] };
for (const tree of ['head', 'b2']){
  const { app, mem, errors, close } = await launch(BASES[tree], { knobs: { 'datatreat-rv-idle': '1' } });
  await app.newTab('xrd'); await sleep(1500);
  out[tree].push({ k: 0, mem: await mem() });
  for (let k = 1; k <= K; k++){
    await app.xrdRefined();
    await app.show(0); await sleep(1500);
    const row = { k, mem: await mem() };
    if (tree === 'b2') row.tabs = (await app.tabs()).map(t=> (t.awake ? 'awake' : 'asleep') + (t.trimmed ? ', trimmed' : ''));
    out[tree].push(row);
    console.log(tree, JSON.stringify(row));
  }
  if (tree === 'b2'){
    await app.tick(61000); out.b2Trimmed = await mem();
    await app.tick(11*60e3); out.b2Asleep = await mem();
    console.log('b2, the 4 trimmed', JSON.stringify(out.b2Trimmed), 'asleep', JSON.stringify(out.b2Asleep));
  }
  out[tree + 'Errors'] = errors;
  await close();
}
console.log(save('memory.json', out));
