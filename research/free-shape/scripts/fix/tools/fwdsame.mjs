// Adapted from the review's tool (critic/tools/fwdsame.mjs): fwd's reported solid against the app's, run by run.
//   node fwdsame.mjs <fs>
import fs from 'node:fs'; import path from 'node:path';
import { compareSolids } from '../../harness/lib.mjs';
const FS = process.argv[2];
const R = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/\bInfinity\b/g, '1e308'));
const dirA = path.join(FS, 'harness/results/baseline'), dirB = path.join(FS, 'optimizer/results/f-fwd');
const out = [];
for (const f of fs.readdirSync(dirB).filter(f => /-\d+\.json$/.test(f))) {
  const b = R(path.join(dirB, f)), a = R(path.join(dirA, f));
  const ma = a.records.find(m => m.method === 'baseline'), mb = b.records.find(m => m.method === 'fwd');
  if (!ma.solid || !mb.solid) continue;
  const fix = s => ({ ...s, dims: s.dims.map(d => d > 1e300 ? Infinity : d) });
  const c = compareSolids(fix(mb.solid), fix(ma.solid));
  const fin = c.dimErr.filter(e => Number.isFinite(e));
  out.push({ run: `${a.case}#${a.seed}`, kind: a.kind, dmax: Math.max(...fin.map(Math.abs)), orient: c.orient, held: [ma.held, mb.held] });
}
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
for (const k of ['synth', 'sample']) {
  const o = out.filter(x => x.kind === k);
  console.log(k, o.length, 'runs: max dim diff median', (100 * q(o.map(x => x.dmax), .5)).toFixed(2), '% p90', (100 * q(o.map(x => x.dmax), .9)).toFixed(2), '%; >5 %:', o.filter(x => x.dmax > .05).length, '; orient >2°:', o.filter(x => x.orient > 2).length);
  o.filter(x => x.dmax > .05 || x.orient > 2).forEach(x => console.log('   ', x.run, (100 * x.dmax).toFixed(0) + '%', x.orient == null ? '-' : x.orient.toFixed(1) + '°'));
}
