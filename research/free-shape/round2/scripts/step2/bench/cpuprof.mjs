import fs from 'node:fs';
const p = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const byId = new Map(p.nodes.map(n=> [n.id, n]));
const self = new Map(), lines = new Map();
const dt = p.timeDeltas; let tot = 0;
const cnt = new Map(); p.samples.forEach((s, i)=> { cnt.set(s, (cnt.get(s) || 0) + (dt[i] || 0)); tot += dt[i] || 0; });
for (const [id, t] of cnt){ const n = byId.get(id), k = n.callFrame.functionName + ':' + (n.callFrame.url.split('/').pop()) + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + t);
  if (n.positionTicks && process.argv[3] && n.callFrame.functionName === process.argv[3]){ const all = n.positionTicks.reduce((a, b)=> a + b.ticks, 0); for (const pt of n.positionTicks) lines.set(pt.line, (lines.get(pt.line) || 0) + t*pt.ticks/all); } }
console.log([...self].sort((a, b)=> b[1] - a[1]).slice(0, 25).map(([k, t])=> (100*t/tot).toFixed(1).padStart(5) + '% ' + k).join('\n'));
if (lines.size) console.log([...lines].sort((a, b)=> b[1] - a[1]).slice(0, 15).map(([l, t])=> `line ${l}: ${(100*t/tot).toFixed(1)}%`).join('\n'));
