#!/usr/bin/env node
/* Why the solids are confused or told apart, per clean sub-screen row and candidate solid:
   - col: what the column lengths alone leave between them (colmatch.json: the intensity-weighted
     rms of ln ⟨L⟩_V, candidate's best match against the truth's, over the measured members);
   - in: the noise-free in-model separation (colsep-none-lor.json: the pattern drawn with the
     engine's own Lorentzian lines, each candidate refined to it; its χ² over the own solid's, at
     the row's counts) = what the column lengths give a fit when the line shape is right;
   - lor, wppm, (lsq): the noisy cross-solid fits (xconf.json): Δχ²/χ²_ν over the row's best
     solid, by model.
   Also: the row's counts, members, distinct ⟨L⟩_V values. Writes a markdown table.
   node why.mjs [--x results/xconf.json] [--out results/why.md] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const R = f => JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8'));
const CM = R('results/colmatch.json'), CS = R('results/colsep-none-lor.json'), X = R(opt.x || 'results/xconf.json');
const design = R('../design/design.json');
const SOL = ['box', 'sqbox', 'cylinder', 'ellcyl', 'ellipsoid', 'spheroid'];
const M = Object.keys(X);
const L = [];
L.push('## What sets the solids apart (clean sub-screen rows)\n');
L.push('Per candidate: col = rms ln ⟨L⟩_V mismatch of its best column-length match (%); in = noise-free in-model Δχ² (engine\'s own lines, the row\'s counts); then, per model, the noisy cross-solid fit\'s Δχ²/χ²_ν over the row\'s best solid (· = the best). The truth\'s own solid in bold.\n');
L.push(`| row | counts | members / distinct ⟨L⟩_V | ${SOL.map(s=> s).join(' | ')} |`);
L.push('|---|---|---|' + SOL.map(()=> '---').join('|') + '|');
const summary = [];
for (const c of CM){
  const row = design.rows.find(r=> r.id === c.id), cs = CS.find(s=> s.id === c.id);
  const own = cs.cand[c.solid].chi2;
  const cells = SOL.map(s=> {
    const parts = [`col ${(100*c.cand[s].rms).toFixed(1)}`, `in ${Math.max(0, cs.cand[s].chi2 - own).toFixed(1)}`];
    for (const m of M){
      const e = X[m].find(r=> r.id === c.id); if (!e || !e.per[s]) { parts.push(`${m} —`); continue; }
      const best = Math.min(...SOL.filter(t=> e.per[t]).map(t=> e.per[t].chi2)), sc = e.per[s].sc || 1;
      const d = (e.per[s].chi2 - best)/Math.max(1, sc);
      parts.push(`${m} ${d < 0.05 ? '·' : d.toFixed(1)}`);
    }
    const t = parts.join(', ');
    return s === c.solid ? `**${t}**` : t;
  });
  L.push(`| ${c.id} | ${row.counts} | ${c.members} / ${c.distinct} | ${cells.join(' | ')} |`);
  // the nearest rival by column lengths, and what each model says of it
  const rivals = SOL.filter(s=> s !== c.solid).sort((p, q)=> c.cand[p].rms - c.cand[q].rms);
  const r1 = rivals[0];
  const sep = {};
  for (const m of M){ const e = X[m].find(r=> r.id === c.id); if (e && e.per[r1] && e.per[c.solid]) sep[m] = (e.per[r1].chi2 - e.per[c.solid].chi2)/Math.max(1, e.per[c.solid].sc || 1); }
  summary.push({ id: c.id, laue: c.laue, solid: c.solid, distinct: c.distinct, members: c.members, counts: row.counts, rival: r1, colRms: c.cand[r1].rms, inModel: cs.cand[r1].chi2 - own, sep });
}
L.push('\n### The nearest rival by column lengths\n');
L.push(`| row | distinct ⟨L⟩_V | counts | rival | col rms | in-model Δχ² | ${M.map(m=> m + ': rival − truth (Δχ²/χ²_ν)').join(' | ')} |`);
L.push('|---|---|---|---|---|---|' + M.map(()=> '---').join('|') + '|');
for (const s of summary) L.push(`| ${s.id} | ${s.distinct} | ${s.counts} | ${s.rival} | ${(100*s.colRms).toFixed(1)} % | ${s.inModel.toFixed(1)} | ${M.map(m=> s.sep[m] != null ? s.sep[m].toFixed(1) : '—').join(' | ')} |`);
fs.writeFileSync(path.join(HERE, opt.out || 'results/why.md'), L.join('\n') + '\n');
fs.writeFileSync(path.join(HERE, (opt.out || 'results/why.md').replace(/\.md$/, '.json')), JSON.stringify(summary, null, 1));
console.log(L.join('\n'));
