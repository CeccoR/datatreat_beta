#!/usr/bin/env node
/* [fix] The in-model floors pooled over noise draws: from an analyse.mjs --json digest whose variants are
   named <model>-<draw> (e.g. lor-im, lor-im2), per model: the truth reference's worst extent (median,
   90th) and the truth's most distinct axis (median, 90th) over all rows × draws, and per draw.
   node fix/floors.mjs results/floors2-digest.json */
import fs from 'node:fs';
const D = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const num = x => typeof x === 'number' ? x : x === 'Infinity' ? Infinity : NaN;
const qtl = (xs, p) => { const s = xs.filter(x=> !Number.isNaN(x)).sort((a, b)=> a - b); const i = (s.length - 1)*p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? s[lo] : !Number.isFinite(s[hi]) ? s[hi] : s[lo] + (s[hi] - s[lo])*(i - lo); };
const pc = x => x === Infinity ? '+∞' : (x >= 0 ? '+' : '') + (100*x).toFixed(1) + ' %';
const V = [...new Set(D.map(d=> d.v))], M = [...new Set(V.map(v=> v.split('-')[0]))];
const row = h => { const w = h.map(d=> Math.max(...d.dimR.map(x=> Math.abs(num(x))))), ax = h.map(d=> num(d.ref.acc.principal)); return `worst ${pc(qtl(w, 0.5))} (${pc(qtl(w, 0.9))}), axis ${qtl(ax, 0.5).toFixed(2)}° (${qtl(ax, 0.9).toFixed(1)}), runs ${h.length}`; };
for (const m of M){
  const vs = V.filter(v=> v.split('-')[0] === m);
  console.log(`${m.padEnd(5)} pooled: ${row(D.filter(d=> vs.includes(d.v) && d.dimR && d.ref && d.ref.acc))} | ` + vs.map(v=> `${v}: ${row(D.filter(d=> d.v === v && d.dimR && d.ref && d.ref.acc))}`).join(' | '));
}
// paired: per row and draw, the worst |extent error| and the axis of one model against another's
const key = d=> d.id + '|' + (d.v.endsWith('2') ? 2 : 1);
const W = (m, d) => Math.max(...d.dimR.map(x=> Math.abs(num(x))));
const pair = (a, b) => {
  const A = D.filter(d=> d.v.split('-')[0] === a && /-im2?$/.test(d.v) && d.dimR), B = D.filter(d=> d.v.split('-')[0] === b && /-im2?$/.test(d.v) && d.dimR);
  let wl = 0, al = 0, n = 0; const dw = [];
  for (const x of A){ const y = B.find(z=> key(z) === key(x)); if (!y) continue; n++; if (W(b, y) < W(a, x)) wl++; if (num(y.ref.acc.principal) < num(x.ref.acc.principal)) al++; dw.push(W(b, y) - W(a, x)); }
  console.log(`${b} better than ${a}: worst extent in ${wl} of ${n} row-draws, axis in ${al} of ${n}; median change of the worst extent ${(100*qtl(dw, 0.5)).toFixed(1)} points`);
};
if (M.includes('ball')){ pair('lor', 'ball'); pair('ball', 'wppm'); pair('lor', 'wppm'); }
