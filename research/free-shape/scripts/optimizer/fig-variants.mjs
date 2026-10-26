#!/usr/bin/env node
/* node fig-variants.mjs cmp.json out.svg [title]
   One row per variant (cmp.mjs --json): its cost in pattern-evaluation equivalents as a
   fraction of the baseline's on the same runs (dot), and whether it reached what the
   baseline reached (blue: every run the baseline reached, and the same outcome; orange:
   not). Right: reached, same outcome, same solid as the baseline. */
import fs from 'node:fs';
import { C, esc, frame, doc } from './svg.mjs';
const [inp, out, title] = process.argv.slice(2);
const J = JSON.parse(fs.readFileSync(inp, 'utf8'));
const rows = J.summary.slice().sort((a, b)=> a.costRatio - b.costRatio);
const label = t => t.replace(/^p-|^f-/, '');
const W = 900, rowH = 22, top = 56, H = top + rows.length*rowH + 76, x0 = 150, w = 380;
const F = frame({ x0, y0: top - 10, w, h: rows.length*rowH + 10, xr: [0, 1.1], yr: [0, 1], xticks: [0, 0.25, 0.5, 0.75, 1], xfmt: v=> v.toFixed(2), xlabel: 'pattern-evaluation equivalents, fraction of the baseline (same runs)' });
const body = [F.svg];
body.push(`<line x1="${F.tx(1)}" x2="${F.tx(1)}" y1="${top - 10}" y2="${top + rows.length*rowH}" stroke="${C.muted}" stroke-dasharray="3 3"/>`);
body.push(`<text x="${x0 + w + 44}" y="${top - 16}" font-size="11" fill="${C.ink2}">reached (Δ ≤ 1) · same outcome · same solid · Δ max</text>`);
rows.forEach((r, i)=> {
  const y = top + i*rowH + rowH/2;
  const ok = r.reached >= r.bReached && r.outMatch === r.runs;
  body.push(`<text x="${x0 - 8}" y="${y + 4}" font-size="12" text-anchor="end" fill="${C.ink}">${esc(label(r.tag))}</text>`);
  body.push(`<line x1="${F.tx(0)}" x2="${F.tx(r.costRatio)}" y1="${y}" y2="${y}" stroke="${C.grid}" stroke-width="2"/>`);
  body.push(`<circle cx="${F.tx(r.costRatio)}" cy="${y}" r="5" fill="${ok ? C.s1 : C.s2}" stroke="${C.surface}" stroke-width="2"/>`);
  body.push(`<text x="${F.tx(r.costRatio) + 9}" y="${y + 4}" font-size="11" fill="${C.ink2}">${r.costRatio.toFixed(2)}</text>`);
  body.push(`<text x="${x0 + w + 44}" y="${y + 4}" font-size="11" fill="${C.ink2}">${r.reached}/${r.judged} · ${r.outMatch}/${r.runs} · ${r.same}/${r.runs} · ${Number.isFinite(r.dMax) ? r.dMax.toFixed(1) : '—'}</text>`);
});
const ly = top + rows.length*rowH + 58;
body.push(`<circle cx="${x0}" cy="${ly}" r="5" fill="${C.s1}"/><text x="${x0 + 10}" y="${ly + 4}" font-size="11" fill="${C.ink2}">reached every run the baseline reached, same outcomes</text>`);
body.push(`<circle cx="${x0 + 380}" cy="${ly}" r="5" fill="${C.s2}"/><text x="${x0 + 390}" y="${ly + 4}" font-size="11" fill="${C.ink2}">lost a run or changed an outcome</text>`);
fs.writeFileSync(out, doc(W, H, body.join('\n'), title || ''));
console.log('written', out);
