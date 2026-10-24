/* Switching, HEAD (v517) against b2, the user's case: two XRPD tabs of the 12 patterns
   refined (X1, X2) and a DRS tab (D). Each switch from the click to two frames after the
   loader is gone (lib.mjs timedShow), its long tasks with it; N rounds of X1→X2, X2→X1,
   X1→D, D→X1, medians. In b2 the XRPD tabs stay awake (shown again within TRIM_MS); D is a
   module not made per tab, its one instance holding it while an XRPD tab is on show.
   node switch.mjs [rounds] → results/switch.json */
import path from 'node:path';
import { launch, BASES, FX, timedShow, med, save } from './lib.mjs';
const N = +process.argv[2] || 7, out = {};
for (const tree of ['head', 'b2']){
  const { app, page, errors, close } = await launch(BASES[tree]);
  await app.xrdRefined(); await app.xrdRefined();
  await app.newTab('tauc'); await app.files('tauc', [path.join(FX, 'drs1.csv'), path.join(FX, 'drs2.csv')]);
  await app.show(0);
  const r = { 'X1→X2': [], 'X2→X1': [], 'X1→D': [], 'D→X1': [] };
  for (let i = 0; i < N; i++){
    r['X1→X2'].push(await timedShow(page, 1)); r['X2→X1'].push(await timedShow(page, 0));
    r['X1→D'].push(await timedShow(page, 2)); r['D→X1'].push(await timedShow(page, 0));
  }
  out[tree] = Object.fromEntries(Object.entries(r).map(([k, a])=> [k, { ms: med(a.map(x=> x.ms)), longMs: med(a.map(x=> x.longMs)), max: Math.max(...a.map(x=> x.ms)), all: a.map(x=> x.ms) }]));
  out[tree].errors = errors;
  console.log(tree, JSON.stringify(Object.fromEntries(Object.entries(out[tree]).filter(([k])=> k !== 'errors').map(([k, v])=> [k, [v.ms, v.longMs]]))));
  await close();
}
console.log(save('switch.json', out));
