// The write-up's summary figure, three panels, from results only:
//  left: every full-set search on one χ² reference (writer/common.json: cost against runs missed);
//  middle: the reporting rules scored alike at degree 6 (cross.json of fix/fixed): the quantities each
//    calls determined, split into those whose truth lies inside the stated interval or radius, those
//    within 25 % or 10° but outside it, and those beyond (80 synthetic runs + 12 proxies);
//  right: the proxies through the background pick (pipe-sum.mjs JSON for u01–u12 and v01–v12):
//    |thickness error| and the normal's error at degree 6 (the app's search), refitted at the picked
//    degree from the degree-6 solid (no search), and searched again at the picked degree.
//   node fig-synthesis.mjs <common.json> <cross.json> <pipe-u.json> <pipe-v.json> out.svg
import fs from 'node:fs';
import { C, svgDoc, panel, dot, text, legend, line } from '../presentation/svg.mjs';

const [fCommon, fCross, fU, fV, out = 'synthesis.svg'] = process.argv.slice(2);
const J = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const common = J(fCommon), cross = J(fCross), PU = J(fU), PV = fs.existsSync(fV) ? J(fV) : [];
const body = [];

// Left: searches.
const fam = { 'app (baseline)': C.ink2, fwd: C.s1, 'c1 = fwd + halving': C.s1, 'c4 = c1 + frames screened': C.s1, cfam: C.s2, '6 screened picks': C.s2, a4: C.s2, a3: C.s2 };
const short = { 'app (baseline)': 'app today', 'c1 = fwd + halving': 'c1', 'c4 = c1 + frames screened': 'c4', '6 screened picks': '6 picks' };
const P = panel({ x: 70, y: 90, w: 360, h: 300, xr: [0, 4000], yr: [0, 10], xticks: [0, 1000, 2000, 3000, 4000], yticks: [0, 2, 4, 6, 8, 10],
  title: 'Searches on one χ² reference (97–98 runs judged)', xlabel: 'pattern evaluations a search (mean, 110 runs)', ylabel: 'runs missed (Δ > 1)' });
body.push(...P.out);
const nudge = { fwd: [8, -8], 'c1 = fwd + halving': [6, 18], 'c4 = c1 + frames screened': [-8, 4], a3: [8, 14], a4: [8, -6], '6 screened picks': [8, 4], cfam: [8, 4], 'app (baseline)': [-8, -12] };
for (const r of common.rows) {
  const x = P.X(r.evals), y = P.Y(r.judged - r.reached);
  body.push(dot(x, y, fam[r.label], `${r.label}: ${Math.round(r.evals)} evaluations, ${r.reached}/${r.judged} reached, ${r.over3} beyond Δ 3`, { r: 5.5, hollow: r.over3s > 0 }));
  const [dx, dy] = nudge[r.label] || [8, 4];
  body.push(text(x + dx, y + dy, `${short[r.label] || r.label} · Δ>3: ${r.over3}`, { col: C.ink, anchor: dx < -5 ? 'end' : 'start' }));
}
body.push(legend(80, 450, [[C.ink2, 'the app\'s search (bf228ee)'], [C.s1, 'optimiser study: Jacobian, halving'], [C.s2, 'starts study: widths-screened starts'], [C.ink2, 'hollow: a proxy beyond Δ 3', true]]));
body.push(text(80, 520, 'c1\'s worst miss (u11, Δ 11.4) is the truth\'s solution.', { size: 10 }));

// Middle: reporting rules.
const RULES = [
  ['today (P0_app: linear esds, held/free in quadrature, cones 2.45σ)', 'today\'s report', '0'],
  ['E_L6', 'E_L(6): search ends, Δ ≤ 6', '0'],
  ['merged rule with E_L12 (Δ 12.5)', 'recommended: E_L(12.5) + radius + D + jackknife', '0 · +2100 flagged'],
  ['condP (uniqueness)', 'condP: profiles + D + jackknife', '+1040 · +3860 flagged'],
  ['condD (uniqueness)', 'condD: condP + other minima', '+3570 · +7600 flagged'],
];
const x0 = 760, w = 230, top = 90, rowH = 50, max = 300;
body.push(text(500, top - 10, 'Reporting rules: quantities called determined (degree 6)', { col: C.ink, weight: 600 }));
for (let t = 0; t <= 300; t += 100) {
  const x = x0 + w * t / max;
  body.push(`<line x1="${x}" x2="${x}" y1="${top}" y2="${top + rowH * RULES.length}" stroke="${C.grid}"/>`, text(x, top + rowH * RULES.length + 14, String(t), { anchor: 'middle' }));
}
body.push(text(x0 + w / 2, top + rowH * RULES.length + 30, 'extents and directions (80 synthetic runs + 12 proxies)', { anchor: 'middle' }));
RULES.forEach(([key, label, cost], i) => {
  const a = cross.synth[key], b = cross.sample[key];
  const hold = a.dBoth + a.aBoth + b.dBoth + b.aBoth;
  const acc = a.dAcc + a.aAcc + b.dAcc + b.aAcc, det = a.dDet + a.aDet + b.dDet + b.aDet;
  const near = acc - hold, wrong = det - acc;
  const y = top + rowH * i + 8;
  body.push(text(x0 - 8, y + 10, label, { col: C.ink, anchor: 'end' }), text(x0 - 8, y + 24, `evaluations beyond today: ${cost}`, { anchor: 'end', size: 10 }));
  let xx = x0;
  for (const [n, col, tip] of [[hold, C.s3, 'truth inside the stated interval'], [near, C.muted, 'within 25 % / 10°, outside the stated interval'], [wrong, C.s2, 'beyond 25 % / 10°']]) {
    const ww = w * n / max; body.push(`<rect x="${xx.toFixed(1)}" y="${y}" width="${ww.toFixed(1)}" height="16" fill="${col}"><title>${n}: ${tip}</title></rect>`); xx += ww;
  }
  body.push(text(xx + 6, y + 12, `${hold} · ${near} · ${wrong}`, { col: C.ink }));
});
body.push(legend(510, 450, [[C.s3, 'truth inside the stated interval or radius'], [C.muted, 'within 25 % or 10°, outside the stated interval'], [C.s2, 'beyond 25 % or 10°']]));

// Right: the proxies through the background pick.
const stages = [['e6', 'degree 6'], ['pick', 'refit at the pick'], ['e18', 'searched at the pick']];
const val = (r, s) => s === 'pick' ? (r.picks.find(v=> v.d === r.pick) || {}).e : r[s];
const draw = (yOff, title, f, yr, ticks, ylabel) => {
  const Q = panel({ x: 1110, y: yOff, w: 300, h: 140, xr: [0, 3], yr, xticks: [], yticks: ticks, title, ylabel });
  body.push(...Q.out);
  stages.forEach(([, lab], k)=> body.push(text(Q.X(k + 0.5), yOff + 156, lab, { anchor: 'middle', size: 10 })));
  for (const [rows, hollow, col] of [[PU, false, C.s1], [PV, true, C.s2]]) rows.forEach((r, i)=> {
    const pts = stages.map(([s], k)=> { const e = val(r, s); return e ? [Q.X(k + 0.5 + (hollow ? 0.12 : -0.12) + (i - 6)*0.012), Q.Y(f(e))] : null; });
    const ok = pts.filter(Boolean); if (ok.length > 1) body.push(line(ok, col, { w: 0.8, op: 0.35 }));
    pts.forEach((p, k)=> { if (p) body.push(dot(p[0], p[1], col, `${r.id} ${stages[k][1]}: ${f(val(r, stages[k][0])).toFixed(1)}`, { r: 3.2, hollow })); });
  });
};
draw(90, 'Proxies: |thickness error| (%)', e=> 100*Math.abs(e.thin), [0, 30], [0, 10, 20, 30], '%');
draw(300, 'Proxies: plate normal\'s error (°)', e=> e.normal, [0, 10], [0, 5, 10], '°');
body.push(legend(1120, 490, [[C.s1, 'u01–u12 (the proxies of §3.2)'], [C.s2, 'v01–v12 (fresh, no rule set on them)', true]]));

fs.writeFileSync(out, svgDoc(1460, 540, body, 'Efficiency of the search, honesty of the report, and the misfit\'s model term, on the harness\'s truths',
  'Left: Δ against the lowest exact χ² any study found. Middle: determined = interval hi/lo ≤ 1.25² or radius ≤ 10°. Right: BIC picked degree 18 on 23 of 24 proxies (12 on v11); each was searched again at 18.'));
console.log('wrote', out);
