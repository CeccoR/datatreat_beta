#!/usr/bin/env node
/* The solids told apart: each clean row searched as each of the six solids (batch.mjs
   --shapes all, FS2A_NOEARLY=1 so that every solid is refined to its minimum), per line model.
   Per row and solid: the best exact χ² (free or held, the search's own ends), and
   BIC = χ²/χ²_ν,iso + P·ln N (P the isotropic fit's less Ys, plus the solid's widths and, when
   free, its turns), as freeShape scales its ΔBIC. The chosen solid is the lowest χ² or the
   lowest BIC; the confusion matrix counts true solid × chosen. Also the margins: the true
   solid's χ² and BIC less the best other solid's, in units of χ²_ν (negative: the truth's
   solid wins), and the chosen solid's accuracy where it is the truth's.
   node xconf.mjs --m lor=results/xs-lor,lsq=results/xs-lsq [--rows subclean] [--out f.md] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { readResult } = await import('./harness/lib.mjs');
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const design = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'design', 'design.json'), 'utf8'));
const sub = fs.readFileSync(path.join(HERE, 'subscreen.txt'), 'utf8').split('\n').filter(l=> l && !l.startsWith('#')).map(l=> l.trim().split(/\s+/));
const ids = !opt.rows || opt.rows === 'subclean' ? sub.filter(s=> s[4] === 'none').map(s=> s[0]) : String(opt.rows).split(',');
const SOL = ['box', 'sqbox', 'cylinder', 'ellcyl', 'ellipsoid', 'spheroid'];
const NW = { box: 3, sqbox: 2, cylinder: 2, ellcyl: 3, ellipsoid: 3, spheroid: 2 }, NR = { box: 3, sqbox: 3, cylinder: 2, ellcyl: 3, ellipsoid: 3, spheroid: 2 };
const M = String(opt.m).split(',').map(s=> { const [k, d] = s.split('='); return { name: k, dir: path.resolve(HERE, d) }; });
const f = (x, d = 1) => x == null || !Number.isFinite(x) ? '—' : x.toFixed(d);
const lines = [];
const all = {};
for (const m of M){
  const rows = [];
  for (const id of ids){
    const row = design.rows.find(r=> r.id === id), per = {};
    let iso = null;
    for (const s of SOL){
      const file = path.join(m.dir, `${id}.${s}.json`);
      if (!fs.existsSync(file)) continue;
      const o = readResult(fs.readFileSync(file, 'utf8')), r = o.records.find(x=> x.method === 'today' || x.method === 'hybrid');
      // the hybrid's solids are scored in WPPM (its end: the polished ends' best free and held χ², its WPPM isotropic fit)
      const W = r.extra && r.extra.wppm;
      if (r.method === 'hybrid' && !W) continue;
      iso = W ? { chi2: W.chi2Iso, chi2nu: W.chi2nuIso, N: o.iso.N, P: o.iso.P } : o.iso;
      const N = iso.N, sc = Math.max(1, iso.chi2nu), P0 = iso.P - 1;
      const cf = W ? (W.chi2Free !== undefined ? W.chi2Free : (W.held ? null : W.chi2)) : r.chi2Free, ch = W ? (W.chi2Held !== undefined ? W.chi2Held : (W.held ? W.chi2 : null)) : r.chi2Held;
      const cand = [];
      if (Number.isFinite(cf)) cand.push({ chi2: cf, P: P0 + NW[s] + NR[s], held: false });
      if (Number.isFinite(ch)) cand.push({ chi2: ch, P: P0 + NW[s], held: true });
      if (!cand.length) continue;
      cand.forEach(c=> { c.bic = c.chi2/sc + c.P*Math.log(N); });
      const bc = cand.slice().sort((p, q)=> p.chi2 - q.chi2)[0], bb = cand.slice().sort((p, q)=> p.bic - q.bic)[0];
      per[s] = { chi2: bc.chi2, bic: bb.bic, heldBic: bb.held, dBICiso: bb.bic - (iso.chi2/sc + iso.P*Math.log(N)), out: r.kept ? (r.held ? 'held' : 'free') : r.rejected ? 'rejected' : 'none', acc: r.acc, evals: (r.search ? r.search.evals : r.evals) + (r.extra && r.extra.end ? r.extra.end.evals : 0), ms: (r.search ? r.search.ms : r.ms) + (r.extra && r.extra.end ? r.extra.end.ms : 0), sc };
    }
    const have = SOL.filter(s=> per[s]);
    if (!have.length){ rows.push({ id, row, missing: true }); continue; }
    const byChi = have.slice().sort((p, q)=> per[p].chi2 - per[q].chi2), byBic = have.slice().sort((p, q)=> per[p].bic - per[q].bic);
    const t = row.solid, sc = per[have[0]].sc;
    const others = have.filter(s=> s !== t);
    const mChi = per[t] && others.length ? (per[t].chi2 - Math.min(...others.map(s=> per[s].chi2)))/sc : NaN;
    const mBic = per[t] && others.length ? per[t].bic - Math.min(...others.map(s=> per[s].bic)) : NaN;
    rows.push({ id, row, per, have, byChi, byBic, mChi, mBic, iso });
  }
  all[m.name] = rows;
  lines.push(`## ${m.name}: ${rows.filter(r=> !r.missing).length} rows`, '');
  for (const [key, title] of [['byChi', 'lowest χ²'], ['byBic', 'lowest BIC']]){
    lines.push(`Confusion by ${title} (rows: true solid; columns: chosen):`, '', `| true \\ chosen | ${SOL.join(' | ')} | right |`, `|---|${SOL.map(()=> '---|').join('')}---|`);
    for (const t of SOL){
      const g = rows.filter(r=> !r.missing && r.row.solid === t); if (!g.length) continue;
      lines.push(`| ${t} | ${SOL.map(c=> g.filter(r=> r[key][0] === c).length || '·').join(' | ')} | ${g.filter(r=> r[key][0] === t).length}/${g.length} |`);
    }
    const ok = rows.filter(r=> !r.missing && r[key][0] === r.row.solid).length;
    lines.push('', `Right: ${ok} of ${rows.filter(r=> !r.missing).length}.`, '');
  }
  lines.push('| row | class | truth | iso χ²_ν | ' + SOL.map(s=> s + ' Δχ²/χ²_ν, ΔBIC').join(' | ') + ' | by χ² | by BIC | margin χ² | margin BIC |', `|---|---|---|---|${SOL.map(()=> '---|').join('')}---|---|---|---|`);
  for (const r of rows){
    if (r.missing){ lines.push(`| ${r.id} | — |`); continue; }
    const c0 = Math.min(...r.have.map(s=> r.per[s].chi2)), b0 = Math.min(...r.have.map(s=> r.per[s].bic));
    lines.push(`| ${r.id} | ${r.row.laue} | ${r.row.solid} | ${f(r.iso.chi2nu, 2)} | ${SOL.map(s=> r.per[s] ? `${f((r.per[s].chi2 - c0)/r.per[s].sc)}, ${f(r.per[s].bic - b0, 0)}${r.per[s].heldBic ? 'h' : ''}` : '—').join(' | ')} | ${r.byChi[0]} | ${r.byBic[0]} | ${f(r.mChi)} | ${f(r.mBic, 0)} |`);
  }
  const ev = rows.flatMap(r=> r.missing ? [] : r.have.map(s=> r.per[s].evals)), ms = rows.flatMap(r=> r.missing ? [] : r.have.map(s=> r.per[s].ms));
  lines.push('', `Searches: ${ev.length}, ${f(ev.reduce((s, x)=> s + x, 0)/ev.length, 0)} evaluations and ${f(ms.reduce((s, x)=> s + x, 0)/ms.length/1000)} s each (mean).`, '');
}
const text = lines.join('\n') + '\n';
if (opt.out) fs.writeFileSync(opt.out, text);
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(Object.fromEntries(Object.entries(all).map(([k, rs])=> [k, rs.map(({ row, ...r })=> r)]))));
console.log(text);
