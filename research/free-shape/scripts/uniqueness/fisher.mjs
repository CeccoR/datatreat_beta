#!/usr/bin/env node
/* node fisher.mjs <tag>: the curvature of χ² at the best free exact fit (its linear covariance,
   shape block: ln W per width, turns about the body axes in °), eigen-decomposed. Each
   eigenvector is named by its largest loading, in roles: a width by the extent it sets
   (thin, mid, long), a turn by the extent it turns about ("turn about thin" = a plate's
   in-plane turn). Counts which combinations are loose (in units of 0.2 in ln W and 10° in a turn: eigen-sd over 1),
   and whether the truth's largest error lies where the loosest combination says. */
import fs from 'node:fs';
import path from 'node:path';
import { readResult, ENG } from '../harness/lib.mjs';
import { align, fmt, median, eigSym } from './ulib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const tag = process.argv[2] || 'main', dir = path.join(HERE, 'results', tag);
const tally = new Map(), rows = [];
for (const fn of fs.readdirSync(dir).filter(f=> f.endsWith('.json') && !f.startsWith('score')).sort()){
  const r = readResult(fs.readFileSync(path.join(dir, fn), 'utf8')); if (!r.records || !r.records[0].kept) continue;
  const u = r.records[0].info.uniq, M = u.minima[0]; if (!M || !M.eig) continue;
  const s = M.solid, B = ENG.BODIES[s.type], nW = B.W.length;
  const order = [0, 1, 2].sort((i, j)=> s.dims[i] - s.dims[j]), role = i => ['thin', 'mid', 'long'][order.indexOf(i)];
  // a width parameter's role: the extent(s) it sets (two-width bodies: W0 sets x and y)
  const wRole = j => nW === 2 ? (j === 0 ? [0, 1] : [2]).map(role).join('+') : role(j);
  const names = M.eig.names.map((nm, k)=> k < nW ? 'ln W ' + wRole(k) : 'turn about ' + role(k - nW));
  // in tolerance units (ln W / 0.2, turns / 10°): an eigen-sd over 1 is a combination looser
  // than the tolerance (mixed units would make the eigenvectors depend on the units chosen)
  const tol = M.eig.names.map((_, k)=> k < nW ? 0.2 : 10);
  const S = M.blk.map((row, i)=> row.map((c, j)=> c/(tol[i]*tol[j])));
  const loose = [];
  if (S.every(rw=> rw.every(Number.isFinite))){
    const e = eigSym(S);
    e.val.forEach((val, k)=> {
      const sd = Math.sqrt(Math.max(0, val)), v = e.vec[k], top = v.map((x, i)=> [x*x, i]).sort((a, b)=> b[0] - a[0]);
      if (sd > 1){ const nm = (top[1][0] > 0.25 ? [names[top[0][1]], names[top[1][1]]].sort() : [names[top[0][1]]]).join(' & '); loose.push({ sd, nm }); tally.set(nm, (tally.get(nm) || 0) + 1); }
    });
  }
  rows.push({ run: `${r.case}#${r.seed}`, kind: r.kind, type: s.type, loose });
}
console.log('| run | loose combinations (sd) |\n|---|---|');
for (const x of rows) console.log(`| ${x.run} | ${x.loose.map(l=> `${l.nm} (×${fmt(l.sd, 1)})`).join('; ') || 'none'} |`);
console.log('\ncounts:', [...tally.entries()].sort((a, b)=> b[1] - a[1]).map(([k, v])=> `${k}: ${v}`).join('; '));
fs.writeFileSync(path.join(HERE, 'results', `fisher-${tag}.json`), JSON.stringify({ rows, tally: [...tally.entries()] }, null, 1));
