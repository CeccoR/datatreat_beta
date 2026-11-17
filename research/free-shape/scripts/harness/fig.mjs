#!/usr/bin/env node
/* node fig.mjs --tag <name>  → results/<tag>/fig-cases.svg from its summary.json (table.mjs):
   one row per case, four panels each on its own axis: the search's pattern evaluations,
   Δ (χ² over the best any run found, in χ²_ν; drawn to 30, beyond at the edge), the
   error of the truth's most distinct axis (°), and the largest dimension error (%).
   One dot per noise realisation; hollow where the best minimum was not reached (Δ > 1). */
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const dir = path.join(HERE, 'results', opt.tag);
const S = JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf8'));
const C = { surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', grid: '#e4e3df', s1: '#2a78d6', s2: '#eb6834' };
const cases = S.cases.map(c=> c.case);
const rowH = 15, top = 58, left = 150, pw = 150, gap = 38, H = top + rowH*cases.length + 30;
const panels = [
  { key: 'evals', title: 'evaluations', max: Math.max(1000, ...S.rows.map(r=> r.evals)), fmt: v=> (v/1000).toFixed(0) + 'k', ticks: n=> [0, 2000, 4000, 6000, 8000, 10000].filter(t=> t <= n) },
  { key: 'delta', title: 'Δ (χ²_ν), to 30', max: 30, fmt: v=> String(v), ticks: ()=> [0, 10, 20, 30] },
  { key: 'principal', title: 'normal / axis error (°)', max: 30, fmt: v=> String(v), ticks: ()=> [0, 10, 20, 30] },
  { key: 'dim', title: 'largest dim error (%), to 100', max: 100, fmt: v=> String(v), ticks: ()=> [0, 25, 50, 75, 100] },
];
const W = left + panels.length*(pw + gap) + 10;
const val = (r, k) => k === 'principal' ? (r.acc ? r.acc.principal : null) : k === 'dim' ? (r.acc ? 100*r.acc.dimMax : null) : r[k];
const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="10">`);
out.push(`<rect width="${W}" height="${H}" fill="${C.surface}"/>`);
out.push(`<text x="8" y="16" font-size="12" fill="${C.ink}" font-weight="600">${opt.title || `Free shape, ${opt.tag}: per case and realisation`}</text>`);
out.push(`<text x="8" y="31" fill="${C.ink2}">filled: reached (Δ ≤ 1, dashed line); hollow: not; ×: rejected (no solid). Errors of the reported solid against the truth.</text>`);
cases.forEach((id, i)=> {
  const y = top + rowH*i + rowH/2;
  out.push(`<text x="${left - 8}" y="${y + 3.5}" text-anchor="end" fill="${C.ink}">${id}</text>`);
  if (i % 2 === 0) out.push(`<rect x="${left - 4}" y="${y - rowH/2}" width="${W - left - 6}" height="${rowH}" fill="#f2f1ee" opacity="0.6"/>`);
});
panels.forEach((p, j)=> {
  const x0 = left + j*(pw + gap), X = v => x0 + pw*Math.min(1, Math.max(0, v/p.max));
  out.push(`<text x="${x0}" y="${top - 6}" fill="${C.ink2}" font-weight="600">${p.title}</text>`);
  for (const t of p.ticks(p.max)){ out.push(`<line x1="${X(t)}" x2="${X(t)}" y1="${top}" y2="${H - 26}" stroke="${C.grid}" stroke-width="1"/>`); out.push(`<text x="${X(t)}" y="${H - 14}" text-anchor="middle" fill="${C.ink2}">${p.fmt(t)}</text>`); }
  if (p.key === 'delta') out.push(`<line x1="${X(1)}" x2="${X(1)}" y1="${top}" y2="${H - 26}" stroke="${C.ink2}" stroke-width="1" stroke-dasharray="3 2"/>`);
  for (const r of S.rows){
    const i = cases.indexOf(r.case); if (i < 0) continue;
    const y = top + rowH*i + rowH/2 + (r.seed - 2)*3, v = val(r, p.key);
    if (v == null || !Number.isFinite(v)){ if (p.key !== 'evals' && /rejected/.test(r.outcome)) out.push(`<text x="${x0 + 2}" y="${y + 3}" fill="${C.ink2}">×</text>`); continue; }
    const filled = r.reached !== false;
    out.push(`<circle cx="${X(v).toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="${filled ? C.s1 : C.surface}" stroke="${C.s1}" stroke-width="1.4"><title>${r.case} #${r.seed} ${p.title}: ${v.toFixed(p.key === 'evals' ? 0 : 2)}</title></circle>`);
  }
});
out.push('</svg>');
fs.writeFileSync(path.join(dir, 'fig-cases.svg'), out.join('\n'));
console.log('written', path.join(dir, 'fig-cases.svg'));
