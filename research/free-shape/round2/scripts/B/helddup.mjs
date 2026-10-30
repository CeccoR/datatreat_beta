// How many of today's held refinements repeat a frame: up to axis signs (round 1's dedupe),
// and modulo the class by the harness's canonical(). From the pilot's screen logs.
import fs from 'node:fs';
import path from 'node:path';
import { canonical, readResult } from '../harness/lib.mjs';
const dir = process.argv[2] || '../pilot/results/screen';
const files = fs.readdirSync(dir).filter(f=> f.endsWith('.json'));
const sameR = (A, B) => A.every((x, i)=> Math.abs(x - B[i]) < 1e-6);
// up to axis signs: each column equal up to sign
const sameSigns = (a, b) => a.axes.every((c, i)=> Math.abs(Math.abs(c[0]*b.axes[i][0] + c[1]*b.axes[i][1] + c[2]*b.axes[i][2]) - 1) < 1e-9);
let tot = { held: 0, ev: 0, dupS: 0, evS: 0, dupC: 0, evC: 0 };
const byL = {};
for (const f of files){
  const o = readResult(fs.readFileSync(path.join(dir, f), 'utf8'));
  const r = o.records.find(r=> r.method === 'today'); if (!r) continue;
  const held = r.log.filter(e=> !e.rot && e.from);
  const seenS = [], seenC = [];
  const b = byL[o.laue] = byL[o.laue] || { runs: 0, held: 0, dupS: 0, dupC: 0, ev: 0, evC: 0 };
  b.runs++;
  for (const e of held){
    tot.held++; tot.ev += e.ev; b.held++; b.ev += e.ev;
    const s = e.from;
    if (seenS.some(t=> sameSigns(s, t))){ tot.dupS++; tot.evS += e.ev; b.dupS++; } else seenS.push(s);
    const c = canonical(o.phase, s);
    if (seenC.some(t=> sameR(c.R, t.R) && c.dims.every((d, i)=> Math.abs(d - t.dims[i]) < 1e-9*d))){ tot.dupC++; tot.evC += e.ev; b.dupC++; b.evC += e.ev; } else seenC.push(c);
  }
}
console.log(JSON.stringify(tot));
for (const [L, b] of Object.entries(byL)) console.log(L, JSON.stringify(b));
