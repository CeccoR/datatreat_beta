// Held refinements of one search that start from the same frame (same 'from' axes up to sign, within 0.01°)
import fs from 'node:fs'; import path from 'node:path';
const H = new URL('../../', import.meta.url).pathname + 'harness';
const { readResult } = await import(H + '/lib.mjs');
const dir = process.argv[2], meth = process.argv[3];
let runs = 0, held = 0, dup = 0, dupEv = 0, heldEv = 0;
for (const f of fs.readdirSync(dir).filter(f=> f.endsWith('.json') && f !== 'summary.json')){
  const r = readResult(fs.readFileSync(path.join(dir, f), 'utf8')); if (!r.records) continue;
  const m = r.records.find(m=> m.method === meth); if (!m) continue; runs++;
  const hs = m.log.filter(e=> !e.rot && e.mi > 8);
  const seen = [];
  for (const e of hs){ held++; heldEv += e.ev;
    const ax = e.from.axes; const same = seen.some(s=> s.every((a, i)=> Math.abs(Math.abs(a[0]*ax[i][0] + a[1]*ax[i][1] + a[2]*ax[i][2]) - 1) < 1e-8));
    if (same){ dup++; dupEv += e.ev; } else seen.push(ax); }
}
console.log(`${meth}: ${runs} runs, ${held} held refinements (${(heldEv/runs).toFixed(0)} evals a run), ${dup} start from a frame already refined (${(dupEv/runs).toFixed(0)} evals a run)`);
