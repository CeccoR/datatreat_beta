#!/usr/bin/env node
/* node fig-verdict.mjs <tag> [variant…]: figs/verdict-<tag>.svg — for each quantity of each
   run (an extent, an axis' direction, paired with the truth's), the error against the truth
   (x) and the interval the variant claims (y: an extent's half-width |ln| of its 2σ ∪
   alternatives interval, an axis' radius). On or above the diagonal: the truth is inside.
   Blue synthetic, orange sample-like; one row per variant. */
import fs from 'node:fs';
import path from 'node:path';
import { svgDoc, panel, dot, line, text, legend, C } from './svg.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const [tag = 'main', ...vs] = process.argv.slice(2);
const variants = vs.length ? vs : ['app', 'flip', 'prof'];
const rows = JSON.parse(fs.readFileSync(path.join(HERE, 'results', tag, 'score.json'), 'utf8')).filter(r=> r.iv && r.iv.app.truthQ);
const body = [], H = 230, top = 70;
variants.forEach((v, k)=> {
  const y0 = top + k*(H + 70);
  const P1 = panel({ x: 80, y: y0, w: 330, h: H, xr: [0.003, 10], yr: [0.003, 10], xlog: true, ylog: true, xticks: [0.01, 0.1, 1, 10], yticks: [0.01, 0.1, 1, 10], xlabel: 'extent error vs truth, |ln ratio|', ylabel: 'claimed half-width, |ln|', title: `${v}: extents` });
  const P2 = panel({ x: 520, y: y0, w: 330, h: H, xr: [0, 90], yr: [0, 90], xticks: [0, 15, 30, 45, 60, 75, 90], yticks: [0, 30, 60, 90], xlabel: 'axis angle vs truth (°)', ylabel: 'claimed radius (°)', title: `${v}: directions` });
  body.push(...P1.out, ...P2.out, line([[P1.X(0.003), P1.Y(0.003)], [P1.X(10), P1.Y(10)]], C.ink2, { w: 1, dash: '4 3' }), line([[P2.X(0), P2.Y(0)], [P2.X(90), P2.Y(90)]], C.ink2, { w: 1, dash: '4 3' }));
  const cnt = { d: [0, 0], a: [0, 0] };
  for (const r of rows){
    const col = r.kind === 'sample' ? C.s2 : C.s1, Q = r.iv[v].q;
    for (const t of r.iv[v].truthQ){
      const I = Q[t.fi], hw = Number.isFinite(I.d[1]) && I.d[0] > 0 ? Math.max(Math.log(I.d[1]/r.dims[t.fi]), Math.log(r.dims[t.fi]/I.d[0])) : 10;
      const tip = `${r.run} ${t.role}: truth ${t.T} nm, err ${(100*t.err).toFixed(0)} %, interval ${I.d.map(x=> Number.isFinite(x) ? x.toFixed(1) : '∞').join('–')}`;
      body.push(dot(P1.X(Math.max(0.003, Math.min(10, t.err))), P1.Y(Math.max(0.003, Math.min(10, hw))), col, tip, { r: 3, hollow: !t.covD }));
      cnt.d[t.covD ? 0 : 1]++;
      if (t.angErr != null && I.ang != null){
        body.push(dot(P2.X(Math.min(90, t.angErr)), P2.Y(Math.min(90, I.ang)), col, `${r.run} ${t.role} axis: ${t.angErr.toFixed(1)}° vs ±${I.ang.toFixed(1)}°`, { r: 3, hollow: !t.covA }));
        cnt.a[t.covA ? 0 : 1]++;
      }
    }
  }
  body.push(text(P1.x + 6, P1.y + 14, `inside ${cnt.d[0]}, outside ${cnt.d[1]} (hollow)`), text(P2.x + 6, P2.y + 14, `inside ${cnt.a[0]}, outside ${cnt.a[1]} (hollow)`));
});
body.push(legend(880, 90, [[C.s1, 'synthetic'], [C.s2, 'sample-like'], [C.ink2, 'truth outside', true]]));
const svg = svgDoc(1040, top + variants.length*(H + 70) + 10, body, `Claimed intervals against the truth (${tag})`, 'Each dot: one quantity of one run (3 extents, up to 3 directions). Above the dashed diagonal the 2σ interval contains the truth.');
fs.writeFileSync(path.join(HERE, 'figs', `verdict-${tag}.svg`), svg);
console.log('written figs/verdict-' + tag + '.svg');
