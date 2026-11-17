#!/usr/bin/env node
/* node fig-full.mjs cmp.json tag out.svg [title]
   One dot per run of the full batch: the baseline's pattern evaluations (x) against the
   variant's (y), the lines y = x and y = the variant's mean ratio; synthetic runs blue,
   sample-like orange, controls and fixtures gray; a ring around a run the variant did not
   reach (Δ > 1) while the baseline did, a square where the baseline did not and the
   variant did. */
import fs from 'node:fs';
import { C, esc, frame, doc } from './svg.mjs';
const [inp, tag, out, title] = process.argv.slice(2);
const J = JSON.parse(fs.readFileSync(inp, 'utf8')), rows = J.perRun[tag], S = J.summary.find(s=> s.tag === tag);
const W = 760, H = 470, x0 = 80, y0 = 50, w = 400, h = 360;
const F = frame({ x0, y0, w, h, xr: [0, 7000], yr: [0, 7000], xticks: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000], yticks: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000],
  xlabel: 'baseline: pattern evaluations', ylabel: `${tag.replace(/^f-/, '')}: pattern evaluations` });
const body = [F.svg];
body.push(`<line x1="${F.tx(0)}" y1="${F.ty(0)}" x2="${F.tx(7000)}" y2="${F.ty(7000)}" stroke="${C.muted}" stroke-dasharray="3 3"/>`);
const k = S.evalRatio;
body.push(`<line x1="${F.tx(0)}" y1="${F.ty(0)}" x2="${F.tx(7000)}" y2="${F.ty(7000*k)}" stroke="${C.ink2}" stroke-width="1"/>`);
body.push(`<text x="${F.tx(6500)}" y="${F.ty(6500*k) + 16}" font-size="11" text-anchor="middle" fill="${C.ink2}">×${k.toFixed(2)}</text>`, `<text x="${F.tx(6000)}" y="${F.ty(6300)}" font-size="11" fill="${C.muted}">y = x</text>`);
const col = r => r.kind === 'synth' ? C.s1 : r.kind === 'sample' ? C.s2 : C.gray;
const notes = [];
for (const r of rows){
  const x = F.tx(r.bEvals), y = F.ty(r.evals);
  body.push(`<circle cx="${x}" cy="${y}" r="4" fill="${col(r)}" fill-opacity="0.8" stroke="${C.surface}" stroke-width="1"/>`);
  const lost = Number.isFinite(r.delta) && r.delta > 1 && !(r.dBase > 1), won = Number.isFinite(r.dBase) && r.dBase > 1 && !(r.delta > 1);
  if (lost || won){
    const n = notes.length + 1;
    notes.push(`${n}. ${r.run.replace('|', ' #')}: ${lost ? `Δ ${r.delta.toFixed(1)} (baseline ${Number.isFinite(r.dBase) ? r.dBase.toFixed(1) : '—'})` : `baseline Δ ${r.dBase.toFixed(1)} (here ${Number.isFinite(r.delta) ? r.delta.toFixed(1) : '—'})`}`);
    body.push(lost ? `<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="${C.ink}" stroke-width="1.5"/>` : `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" fill="none" stroke="${C.ink2}" stroke-width="1.2"/>`);
    body.push(`<text x="${x + (n % 2 ? 9 : -9)}" y="${y + (n % 2 ? -8 : 14)}" font-size="10" text-anchor="${n % 2 ? 'start' : 'end'}" fill="${C.ink}">${n}</text>`);
  }
}
const lx = x0 + w + 20;
[['synthetic', C.s1], ['sample-like', C.s2], ['controls, fixtures', C.gray]].forEach(([t, c], i)=> body.push(`<circle cx="${lx}" cy="${y0 + 10 + 18*i}" r="4" fill="${c}"/><text x="${lx + 9}" y="${y0 + 14 + 18*i}" font-size="11" fill="${C.ink2}">${t}</text>`));
body.push(`<circle cx="${lx}" cy="${y0 + 70}" r="7" fill="none" stroke="${C.ink}" stroke-width="1.5"/><text x="${lx + 12}" y="${y0 + 74}" font-size="11" fill="${C.ink2}">missed (Δ > 1)</text>`);
body.push(`<rect x="${lx - 6}" y="${y0 + 82}" width="12" height="12" fill="none" stroke="${C.ink2}" stroke-width="1.2"/><text x="${lx + 12}" y="${y0 + 92}" font-size="11" fill="${C.ink2}">baseline missed</text>`);
body.push(`<text x="${lx}" y="${y0 + 120}" font-size="11" fill="${C.ink2}">reached ${S.reached}/${S.judged}</text><text x="${lx}" y="${y0 + 136}" font-size="11" fill="${C.ink2}">baseline ${S.bReached}/${S.bJudged}</text>`);
notes.forEach((t, i)=> body.push(`<text x="${lx}" y="${y0 + 164 + 15*i}" font-size="10" fill="${C.ink2}">${esc(t)}</text>`));
fs.writeFileSync(out, doc(W, H, body.join('\n'), title || ''));
console.log('written', out);
