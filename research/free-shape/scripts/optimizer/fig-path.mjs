#!/usr/bin/env node
/* node fig-path.mjs out.svg case:seed[,case:seed…] tagA tagB …
   The χ² path of a search: every refine() end (dot) and the running lowest (step line),
   as Δ = (χ² − the run's best χ² found by any of the tags shown)/χ²_ν against the
   pattern evaluations spent, one panel per run, one colour per tag (the first tag may be
   'baseline': harness/results/baseline). Ends with the faces rounded count as they are
   (their χ² within ~1 % of the widths of the exact solid's). */
import fs from 'node:fs';
import path from 'node:path';
import { readResult } from './h/lib.mjs';
import { C, esc, frame, doc } from './svg.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const [out, runsArg, ...tags] = process.argv.slice(2);
const runs = runsArg.split(',');
const dirOf = t => t === 'baseline' ? path.join(HERE, '..', 'harness', 'results', 'baseline') : path.join(HERE, 'results', t);
const cols = [C.gray, C.s1, C.s2, C.s3];
const pw = 380, ph = 220, W = 40 + runs.length*(pw + 80), H = ph + 120;
const body = [];
runs.forEach((rs, ri)=> {
  const [id, seed] = rs.split(':');
  const recs = tags.map(t=> { const f = path.join(dirOf(t), `${id}-${seed}.json`); if (!fs.existsSync(f)) return null; const r = readResult(fs.readFileSync(f, 'utf8')); return { t, r, m: r.records.find(m=> m.method !== 'truth') }; }).filter(Boolean);
  const all = recs.flatMap(o=> o.m.log.filter(e=> Number.isFinite(e.c)).map(e=> e.c));
  const best = Math.min(...all), N = recs[0].r.iso.N, nu = Math.max(1, best/(N - 20));
  const xmax = Math.max(...recs.map(o=> o.m.evals));
  const x0 = 70 + ri*(pw + 80);
  const F = frame({ x0, y0: 50, w: pw, h: ph, xr: [0, xmax*1.02], yr: [0.03, 3000], ylog: true, xticks: [0, 1000, 2000, 3000, 4000, 5000].filter(t=> t <= xmax*1.02), yticks: [0.1, 1, 10, 100, 1000], yfmt: v=> v >= 1 ? String(v) : v.toFixed(1), xlabel: 'pattern evaluations', ylabel: ri ? '' : 'Δ = (χ² − best)/χ²_ν' });
  body.push(F.svg, `<text x="${x0}" y="40" font-size="12" font-weight="600" fill="${C.ink}">${esc(id)} #${seed}</text>`);
  recs.forEach((o, k)=> {
    const col = cols[k % cols.length];
    let run = Infinity, d = '';
    const ends = o.m.log.filter(e=> Number.isFinite(e.c));
    for (const e of ends){
      const y = Math.max(0.03, (e.c - best)/nu);
      body.push(`<circle cx="${F.tx(e.at)}" cy="${F.ty(Math.min(3000, y))}" r="3" fill="${col}" fill-opacity="0.55"/>`);
      if (e.c < run){ const yr = Math.max(0.03, (e.c - best)/nu); d += `${d ? 'L' : 'M'}${F.tx(e.at)},${F.ty(Math.min(3000, run === Infinity ? yr : Math.max(0.03, (run - best)/nu)))}L${F.tx(e.at)},${F.ty(Math.min(3000, yr))}`; run = e.c; }
    }
    d += `L${F.tx(o.m.evals)},${F.ty(Math.max(0.03, (run - best)/nu))}`;
    body.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="2"/>`);
    body.push(`<text x="${x0 + pw - 4}" y="${66 + 16*k}" font-size="11" text-anchor="end" fill="${C.ink2}"><tspan fill="${col}">●</tspan> ${esc(o.t.replace(/^p-|^f-/, ''))}: ${o.m.evals} evaluations</text>`);
  });
});
fs.writeFileSync(out, doc(W, H, body.join('\n')));
console.log('written', out);
