#!/usr/bin/env node
/* node fig-landscape.mjs uniq.json out.svg [title]
   The uniqueness analysis (uniq-sum.mjs --json): every converged minimum other than the
   best within Δ ≤ 10, its Δ (x) against the straight-path barrier from the best (y, both
   in the best fit's χ²_ν; the barrier floored at 0.01 on the log scale); synthetic runs
   blue, sample-like orange. Below the line at 1 the two are one valley (no barrier the
   noise would not cross); above it, distinct minima. */
import fs from 'node:fs';
import { C, esc, frame, doc } from './svg.mjs';
const [inp, out, title] = process.argv.slice(2);
const U = JSON.parse(fs.readFileSync(inp, 'utf8'));
const pts = U.flatMap(u=> u.minima.filter(m=> m.vsBest).map(m=> ({ run: u.run, kind: u.kind, d: m.delta, b: m.barrier })));
const W = 700, H = 430, x0 = 80, y0 = 50, w = 420, h = 320;
const F = frame({ x0, y0, w, h, xr: [0, 10], yr: [0.01, 1000], ylog: true, xticks: [0, 2, 4, 6, 8, 10], yticks: [0.01, 0.1, 1, 10, 100, 1000], yfmt: v=> v < 1 ? String(v) : String(v),
  xlabel: 'Δ of the minimum = (χ² − χ²_best)/χ²_ν', ylabel: 'barrier on the straight path (χ²_ν)' });
const body = [F.svg, `<line x1="${x0}" x2="${x0 + w}" y1="${F.ty(1)}" y2="${F.ty(1)}" stroke="${C.ink2}" stroke-dasharray="4 3"/>`,
  `<text x="${x0 + w - 4}" y="${F.ty(1) + 14}" font-size="11" text-anchor="end" fill="${C.ink2}">one valley below</text>`, `<text x="${x0 + w - 4}" y="${F.ty(1) - 6}" font-size="11" text-anchor="end" fill="${C.ink2}">distinct minima above</text>`];
for (const p of pts){
  const y = F.ty(Math.min(1000, Math.max(0.01, p.b)));
  body.push(`<circle cx="${F.tx(Math.min(10, p.d))}" cy="${y}" r="4.5" fill="${p.kind === 'sample' ? C.s2 : C.s1}" fill-opacity="0.8" stroke="${C.surface}" stroke-width="1"><title>${esc(p.run)} Δ ${p.d.toFixed(2)} barrier ${p.b.toFixed(2)}</title></circle>`);
}
const lx = x0 + w + 20;
body.push(`<circle cx="${lx}" cy="${y0 + 10}" r="4.5" fill="${C.s1}"/><text x="${lx + 9}" y="${y0 + 14}" font-size="11" fill="${C.ink2}">synthetic</text>`);
body.push(`<circle cx="${lx}" cy="${y0 + 28}" r="4.5" fill="${C.s2}"/><text x="${lx + 9}" y="${y0 + 32}" font-size="11" fill="${C.ink2}">sample-like</text>`);
const n = pts.length, sep = pts.filter(p=> p.b > 1).length;
body.push(`<text x="${lx}" y="${y0 + 60}" font-size="11" fill="${C.ink2}">${n} minima within Δ 10</text>`, `<text x="${lx}" y="${y0 + 76}" font-size="11" fill="${C.ink2}">of ${U.length} runs: ${sep} behind a</text>`, `<text x="${lx}" y="${y0 + 92}" font-size="11" fill="${C.ink2}">barrier over 1</text>`,
  `<text x="${lx}" y="${y0 + 124}" font-size="10" fill="${C.muted}">barriers ≤ 0 (the path falls</text>`, `<text x="${lx}" y="${y0 + 138}" font-size="10" fill="${C.muted}">all the way) drawn at 0.01,</text>`, `<text x="${lx}" y="${y0 + 152}" font-size="10" fill="${C.muted}">over 1000 at 1000</text>`);
fs.writeFileSync(out, doc(W, H, body.join('\n'), title || ''));
console.log('written', out, n, 'minima', sep, 'separated');
