#!/usr/bin/env node
/* node card.mjs <tag> [run…] [--variant flip] [--md out.md]: the proposed presentation of a
   free-shape result, one per run: one solid (the reported one), its three extents from the
   thinnest to the longest, each with its interval (2σ of the reported fit ∪ the other
   minima the data do not rule out: flip probability ≥ 5 %) and a word for what the data
   say of it; each extent's direction as the simplest lattice direction within 10°, with
   its radius and word; the other frames when a direction is shared between discrete
   alternatives (Δ, flip probability); one verdict for the whole. Truth beside it where
   there is one. */
import fs from 'node:fs';
import path from 'node:path';
import { readResult } from '../harness/lib.mjs';
import { analyse } from './score.mjs';
import { align, pFlip, fmt, angAx } from './ulib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const a = process.argv.slice(2), opt = { runs: [] };
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } else if (!opt.tag) opt.tag = a[i]; else opt.runs.push(a[i]); }
const V = opt.variant || 'condD', C8 = 8;
// the simplest lattice direction within 10° (cubic: [uvw] ∥ the Cartesian vector), else the nearest
const DIRS = (()=> { const out = []; for (let u = -3; u <= 3; u++) for (let v = -3; v <= 3; v++) for (let w = -3; w <= 3; w++){ const n = u*u + v*v + w*w; if (!n) continue;
  const g = (x, y) => y ? g(y, x % y) : Math.abs(x); if (g(g(u, v), w) !== 1) continue; out.push({ uvw: [u, v, w], n }); } return out.sort((x, y)=> x.n - y.n); })();
const bar = x => x < 0 ? `-${-x}` : String(x);
export function latt(e){
  let best = null, near = null;
  for (const d of DIRS){ const ang = angAx(e, d.uvw); if (!near || ang < near.ang) near = { ...d, ang }; if (!best && ang <= 10) best = { ...d, ang }; }
  const x = best || near, s = Math.sign(x.uvw.find(t=> t !== 0)); // first nonzero positive
  return { label: '[' + x.uvw.map(t=> bar(s*t)).join('') + ']', ang: x.ang, snapped: !!best };
}
const word = (lo, hi) => !Number.isFinite(hi) ? 'lower bound only' : hi/Math.max(lo, 1e-9) <= 1.25*1.25 ? 'determined' : hi/lo <= 2.5 ? 'loosely bounded' : 'poorly bounded';
const aword = r => r == null ? 'none (round)' : r <= 10 ? 'determined' : r <= 30 ? 'loose' : 'not determined';
export function card(r, x){
  const u = r.records[0].info.uniq, rep = u.reported.solid, nu0 = u.nu0, c0 = u.minima[0].chi;
  const order = [0, 1, 2].sort((i, j)=> rep.dims[i] - rep.dims[j]), names = ['thinnest', 'middle', 'longest'];
  const q = x.iv[V].q;
  const alts = u.minima.slice(1).map(m=> ({ D: (m.chi - c0)/nu0, al: align(m.solid, rep, { loose: true }), m })).filter(m=> pFlip(m.D, C8) >= 0.05);
  const lines = [], verdictOf = [];
  order.forEach((i, k)=> {
    const D = rep.dims[i], I = q[i], L = latt(rep.axes[i]);
    const w = word(I.d[0], I.d[1]), aw = aword(I.ang);
    // discrete alternatives for this axis: plausible minima whose paired axis is > 20° away
    const seen = new Set(), other = [];
    for (const m of alts.filter(m=> m.al.per[i].angle != null && m.al.per[i].angle > 20)){
      const lb = latt(m.m.solid.axes[m.al.per[i].fi]).label; if (seen.has(lb) || lb === L.label) continue; seen.add(lb);
      other.push(`${lb} (Δ ${fmt(m.D, 1)}, ${Math.round(100*pFlip(m.D, C8))} %)`);
    }
    lines.push(`${names[k]} ${fmt(D, 1)} nm [${fmt(I.d[0], 1)}–${Number.isFinite(I.d[1]) && I.d[1] < 1000 ? fmt(I.d[1], 1) : '∞'}] ${w}; along ${L.label}${L.snapped ? '' : '?'} ${fmt(L.ang, 1)}° off, ±${I.ang == null ? '—' : fmt(Math.min(90, I.ang), 0)}° ${aw}${other.length ? '; or along ' + other.join(', ') : ''}`);
    verdictOf.push({ k, dim: w === 'determined', dir: I.ang == null ? null : I.ang <= 10 });
  });
  // the most distinct extent (a plate's thickness, a needle's length): its direction within 30°
  // and the thinnest extent determined make the shape resolved in part
  const lg = d => Math.log(Number.isFinite(d) ? d : 1e4), sd = order.map(i=> rep.dims[i]);
  const gapK = k => Math.min(...[0, 1, 2].filter(j=> j !== k).map(j=> Math.abs(lg(sd[k]) - lg(sd[j]))));
  const pk = [0, 1, 2].sort((x, y)=> gapK(y) - gapK(x))[0], pr = q[order[pk]];
  const all = verdictOf.every(v=> v.dim && v.dir !== false);
  const part = verdictOf[0].dim && (pr.ang == null || pr.ang <= 10);
  const verdict = all ? 'unique: every extent and direction determined'
    : part ? `resolved in part: ${verdictOf.filter(v=> !v.dim || v.dir === false).map(v=> names[v.k] + (v.dim ? '' : ' extent') + (v.dir === false ? ' direction' : '')).join(', ')} not determined`
    : 'not resolved: the thinnest extent, or the direction of the most distinct one, is not determined';
  return { run: x.run, type: rep.type, held: x.held, verdict, cls: all ? 'unique' : part ? 'part' : 'none', lines, nAlt: alts.length, truth: r.truth ? r.truth.dims : null, err: x.iv[V].truthQ };
}
if (opt.tag){
  const dir = path.join(HERE, 'results', opt.tag), out = [];
  const files = fs.readdirSync(dir).filter(f=> f.endsWith('.json') && !f.startsWith('score') && f !== 'summary.json').sort();
  for (const fn of files){
    if (opt.runs.length && !opt.runs.some(s=> fn.startsWith(s))) continue;
    const r = readResult(fs.readFileSync(path.join(dir, fn), 'utf8')); if (!r.records || !r.records[0].kept) continue;
    const ref = fs.existsSync(path.join(HERE, '..', 'harness', 'results', 'baseline', fn)) ? readResult(fs.readFileSync(path.join(HERE, '..', 'harness', 'results', 'baseline', fn), 'utf8')) : null;
    const jf = path.join(HERE, 'results', 'jack', fn), jr = fs.existsSync(jf) ? readResult(fs.readFileSync(jf, 'utf8')) : null;
    const x = analyse(r, ref, jr && jr.records && jr.records[0].info ? jr.records[0].info.jack : null); if (!x) continue;
    const c = card(r, x);
    out.push(`**${c.run}** (${c.type}${c.held ? ', held on the lattice' : ''}): ${c.verdict}.` + '\n' + c.lines.map(l=> '- ' + l).join('\n') + (c.truth ? `\n- truth: ${c.truth.join(' × ')} nm; errors ${c.err.map(t=> `${t.role} ${fmt(100*t.err, 0)} %${t.angErr != null ? ' ' + fmt(t.angErr, 1) + '°' : ''}`).join(', ')}` : ''));
  }
  const txt = out.join('\n\n');
  if (opt.md) fs.writeFileSync(opt.md, txt + '\n');
  console.log(txt);
}
