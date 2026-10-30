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
