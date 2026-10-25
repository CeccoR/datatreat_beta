/* What an XRPD tab awake and hidden holds beyond its sleeping form (what its sleep gives
   back), against its own estimate (xrd.js bytes): tab A blank, of 12 patterns, of the 12
   refined; tab B blank on show. The JS heap after a forced GC, A awake (untrimmed, then
   trimmed: tabs.js TRIM_MS, run by sleepTick) and asleep; Blink's DOM nodes alike.
   node bytes.mjs → results/bytes.json */
import { launch, XRD12, save, sleep } from './lib.mjs';
const out = {};
for (const what of ['blank', 'patterns', 'refined']){
  const { app, page, mem, errors, close } = await launch(process.env.B2_BASE || 'http://127.0.0.1:8993', { knobs: { 'datatreat-rv-idle': '1' } });
  if (what === 'refined') await app.xrdRefined();
  else { await app.newTab('xrd'); if (what === 'patterns') await app.files('xrd', XRD12); }
  await app.newTab('xrd');
  await sleep(1500);
  const awake = await mem(), est = (await app.tabs())[0].bytes;
  await app.tick(61000);
  const trimmed = await mem(), estT = (await app.tabs())[0].bytes;
  await app.tick(11*60e3);
  const asleep = await mem();
  out[what] = { awake, trimmed, asleep, heapAwake: +(awake.heap - asleep.heap).toFixed(2), heapTrimmed: +(trimmed.heap - asleep.heap).toFixed(2),
    nodesAwake: awake.nodes - asleep.nodes, nodesTrimmed: trimmed.nodes - asleep.nodes, estimate: +(est/1048576).toFixed(2), estimateTrimmed: +(estT/1048576).toFixed(2), errors };
  console.log(what, JSON.stringify(out[what]));
  await close();
}
console.log(save('bytes.json', out));
