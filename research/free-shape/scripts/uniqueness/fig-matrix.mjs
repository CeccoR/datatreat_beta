#!/usr/bin/env node
/* node fig-matrix.mjs <tag> <variantA> [variantB]: figs/matrix-<tag>-<A>[-<B>].svg — one row
   per run kept (synthetic grouped by case, then sample-like), six cells per variant: the
   truth's thin, mid and long extents, and their directions. A filled cell: the variant calls
   the quantity determined (an extent within ±25 % at 2σ, a direction within 10°); hollow:
   not determined; blank: no direction (a round section, a ball). Green: accurate against the
   truth (25 %, 10°); orange: not. The wanted picture: no filled orange, few hollow green. */
import fs from 'node:fs';
import path from 'node:path';
import { svgDoc, text, C } from './svg.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const [tag = 'main', ...vs] = process.argv.slice(2);
const variants = vs.length ? vs : ['app', 'profD'];
const rows = JSON.parse(fs.readFileSync(path.join(HERE, 'results', tag, 'score.json'), 'utf8')).filter(r=> r.iv && r.iv.app.truthQ && variants.every(v=> r.iv[v]));
rows.sort((a, b)=> (a.kind === b.kind ? 0 : a.kind === 'synth' ? -1 : 1) || a.run.localeCompare(b.run));
const cw = 13, rh = 11, x0 = 190, top = 92, gapV = 90;
const body = [], roles = ['thin', 'mid', 'long'];
const G = '#1baf7a', O = '#eb6834';
variants.forEach((v, k)=> {
  const xv = x0 + k*(6*cw + gapV);
  body.push(text(xv, top - 30, v, { col: C.ink, weight: 600, size: 12 }));
  ['thin', 'mid', 'long', '∠thin', '∠mid', '∠long'].forEach((h, j)=> body.push(`<text x="${xv + j*cw + cw/2}" y="${top - 6}" font-size="9" fill="${C.ink2}" text-anchor="start" transform="rotate(-55 ${xv + j*cw + cw/2} ${top - 6})">${h}</text>`));
});
const tally = Object.fromEntries(variants.map(v=> [v, { detAcc: 0, detBad: 0, undAcc: 0, undBad: 0 }]));
let y = top, prevCase = null;
for (const r of rows){
  if (r.case !== prevCase){ if (prevCase) y += 3; prevCase = r.case; }
  body.push(text(x0 - 8, y + rh - 2, `${r.kind === 'sample' ? '◆ ' : ''}${r.run}`, { anchor: 'end', size: 9, col: r.kind === 'sample' ? O : C.ink2 }));
  variants.forEach((v, k)=> {
    const xv = x0 + k*(6*cw + gapV), T = r.iv[v].truthQ;
    roles.forEach((role, j)=> {
      const t = T.find(z=> z.role === role); if (!t) return;
      const cell = (xi, det, acc) => {
        if (det == null || acc == null) return;
        const col = acc ? G : O, cx = xv + xi*cw + 1.5, cy = y + 1;
        body.push(det ? `<rect x="${cx}" y="${cy}" width="${cw - 3}" height="${rh - 3}" fill="${col}"/>` : `<rect x="${cx + 0.75}" y="${cy + 0.75}" width="${cw - 4.5}" height="${rh - 4.5}" fill="none" stroke="${col}" stroke-width="1.5"/>`);
        const tl = tally[v]; if (det) acc ? tl.detAcc++ : tl.detBad++; else acc ? tl.undAcc++ : tl.undBad++;
      };
      cell(j, t.detDim, t.accD);
      cell(3 + j, t.detAng, t.accA);
    });
  });
  y += rh;
}
variants.forEach((v, k)=> { const xv = x0 + k*(6*cw + gapV), t = tally[v];
  body.push(text(xv, y + 16, `determined: ${t.detAcc} right, ${t.detBad} wrong`, { size: 10, col: C.ink }), text(xv, y + 30, `not: ${t.undAcc} right, ${t.undBad} wrong`, { size: 10, col: C.ink })); });
const lx = x0 + variants.length*(6*cw + gapV) + 10;
body.push(`<rect x="${lx}" y="${top}" width="10" height="8" fill="${G}"/>`, text(lx + 16, top + 8, 'determined, accurate', { col: C.ink }));
body.push(`<rect x="${lx}" y="${top + 16}" width="10" height="8" fill="${O}"/>`, text(lx + 16, top + 24, 'determined, NOT accurate', { col: C.ink }));
body.push(`<rect x="${lx + 0.75}" y="${top + 32.75}" width="8.5" height="6.5" fill="none" stroke="${G}" stroke-width="1.5"/>`, text(lx + 16, top + 40, 'not determined, accurate', { col: C.ink }));
body.push(`<rect x="${lx + 0.75}" y="${top + 48.75}" width="8.5" height="6.5" fill="none" stroke="${O}" stroke-width="1.5"/>`, text(lx + 16, top + 56, 'not determined, not accurate', { col: C.ink }));
body.push(text(lx, top + 80, 'accurate: within 25 % (extent),', { col: C.ink2 }), text(lx, top + 94, '10° (direction) of the truth', { col: C.ink2 }), text(lx, top + 112, '◆ sample-like proxies', { col: O }));
const W = lx + 230, H = y + 46;
const svg = svgDoc(W, H, body, `What each rule calls determined, against the truth (${tag})`, `${rows.length} runs kept; per run the truth's three extents and their directions (thin: a plate's normal, a needle's section).`);
fs.mkdirSync(path.join(HERE, 'figs'), { recursive: true });
const out = path.join(HERE, 'figs', `matrix-${tag}-${variants.join('-')}.svg`);
fs.writeFileSync(out, svg);
console.log('written', out, JSON.stringify(tally));
