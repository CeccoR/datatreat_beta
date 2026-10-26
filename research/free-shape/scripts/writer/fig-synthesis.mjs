// The write-up's two summary panels, from common.json (common.mjs) and cross.json (cross.mjs):
// left, every full-set search on one χ² reference (cost against runs missed); right, the reporting
// rules scored alike (claims called determined that are right or wrong, synthetic and proxies).
//   node fig-synthesis.mjs <dir with common.json, cross.json> out.svg
import fs from 'node:fs';
import path from 'node:path';
import { C, svgDoc, panel, dot, text, legend } from '../presentation/svg.mjs';

const dir = process.argv[2] || '.', out = process.argv[3] || 'synthesis.svg';
const common = JSON.parse(fs.readFileSync(path.join(dir, 'common.json'), 'utf8'));
const cross = JSON.parse(fs.readFileSync(path.join(dir, 'cross.json'), 'utf8'));
const body = [];

// Left: searches.
const fam = { 'app (baseline)': C.ink2, fwd: C.s1, 'c1 = fwd + halving': C.s1, 'c4 = c1 + frames screened': C.s1, cfam: C.s2, '6 screened picks': C.s2, a4: C.s2, a3: C.s2 };
const short = { 'app (baseline)': 'app today', 'c1 = fwd + halving': 'c1', 'c4 = c1 + frames screened': 'c4', '6 screened picks': '6 picks' };
const P = panel({ x: 70, y: 80, w: 420, h: 300, xr: [0, 4000], yr: [0, 10], xticks: [0, 1000, 2000, 3000, 4000], yticks: [0, 2, 4, 6, 8, 10],
  title: 'Searches on one χ² reference (110 runs, 97–98 judged)', xlabel: 'pattern evaluations a run (mean)', ylabel: 'runs missed (Δ > 1)' });
body.push(...P.out);
const nudge = { fwd: [8, -8], 'c1 = fwd + halving': [6, 18], 'c4 = c1 + frames screened': [-8, 4], a3: [8, 14], a4: [8, -6], '6 screened picks': [8, 4], cfam: [8, 4], 'app (baseline)': [-8, -12] };
for (const r of common.rows) {
  const x = P.X(r.evals), y = P.Y(r.judged - r.reached);
  body.push(dot(x, y, fam[r.label], `${r.label}: ${Math.round(r.evals)} evaluations, ${r.reached}/${r.judged} reached, ${r.over3} beyond Δ 3`, { r: 5.5, hollow: r.over3s > 0 }));
  const [dx, dy] = nudge[r.label] || [8, 4];
  body.push(text(x + dx, y + dy, `${short[r.label] || r.label} · Δ>3: ${r.over3}`, { col: C.ink, anchor: dx < -5 ? 'end' : 'start' }));
}
body.push(legend(80, 440, [[C.ink2, 'the app\'s search (bf228ee)'], [C.s1, 'optimiser study: Jacobian, halving'], [C.s2, 'starts study: widths-screened starts'], [C.ink2, 'hollow: a sample-like proxy beyond Δ 3', true]]));

// Right: reporting rules.
const RULES = [
  ['app today (uniqueness\'s app: linear esds, 2σ)', 'app today (2σ)', '0'],
  ['app today (presentation\'s P0_app: linear esds, held/free in quadrature, cones 2.45σ)', 'app today (held/free, 2.45σ)', '0'],
  ['E_L6', 'E_L6 (search ends, Δ ≤ 6)', '0'],
  ["E_L6 extents, today's angular radius, D rule, jackknife when flagged", 'recommended: E_L6 + radius + D + jackknife', '0 · +2100 flagged'],
  ['condP (uniqueness)', 'condP (profiles + D + jackknife)', '+1040 · +3860 flagged'],
  ['condD (uniqueness)', 'condD (condP + other minima)', '+3570 · +7600 flagged'],
];
const x0 = 760, w = 300, top = 80, rowH = 44, max = 330;
body.push(text(560, top - 10, 'Reporting rules: quantities called determined', { col: C.ink, weight: 600 }));
for (let t = 0; t <= 300; t += 100) {
  const x = x0 + w * t / max;
  body.push(`<line x1="${x}" x2="${x}" y1="${top}" y2="${top + rowH * RULES.length}" stroke="${C.grid}"/>`, text(x, top + rowH * RULES.length + 14, String(t), { anchor: 'middle' }));
}
body.push(text(x0 + w / 2, top + rowH * RULES.length + 30, 'extents and directions called determined (80 synthetic + 12 proxies)', { anchor: 'middle' }));
RULES.forEach(([key, label, cost], i) => {
  const a = cross.synth[key], b = cross.sample[key];
  const right = a.dAcc + a.aAcc + b.dAcc + b.aAcc, wrong = (a.dDet - a.dAcc) + (a.aDet - a.aAcc) + (b.dDet - b.dAcc) + (b.aDet - b.aAcc);
  const y = top + rowH * i + 8;
  body.push(text(x0 - 8, y + 10, label, { col: C.ink, anchor: 'end' }), text(x0 - 8, y + 24, `evaluations beyond today: ${cost}`, { anchor: 'end', size: 10 }));
  const wr = w * right / max, ww = w * wrong / max;
  body.push(`<rect x="${x0}" y="${y}" width="${wr.toFixed(1)}" height="16" fill="${C.s3}"><title>${right} right</title></rect>`);
  body.push(`<rect x="${(x0 + wr).toFixed(1)}" y="${y}" width="${ww.toFixed(1)}" height="16" fill="${C.s2}"><title>${wrong} wrong</title></rect>`);
  body.push(text(x0 + wr + ww + 6, y + 12, `${right} right, ${wrong} wrong`, { col: C.ink }));
});
body.push(legend(770, 440, [[C.s3, 'determined and accurate (25 %, 10°)'], [C.s2, 'determined, not accurate']]));

fs.writeFileSync(out, svgDoc(1180, 520, body, 'Efficiency of the search and honesty of the report, on the harness\'s truths',
  'Left: Δ against the lowest exact χ² any study found. Right: determined = interval hi/lo ≤ 1.25² or radius ≤ 10°; flagged = worst line segment χ²_ν > 1.25 (0 of 80 synthetic, 12 of 12 proxies).'));
console.log('wrote', out);
