// Inclusive time of measureWidths' parts in a cpuprofile: node profw.mjs file.cpuprofile
import fs from 'node:fs';
const p = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const byId = new Map(p.nodes.map(n=> [n.id, n])), parent = new Map();
for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
const incl = new Map(), names = ['measureWidths', 'calc', 'fitPeak', 'neighbourErrors', 'predict', 'ownAll', 'phasePattern', 'phasePattern_', 'nelderMead', 'peakShape', 'scatter', 'williamsonHall', 'run', 'readRows', 'screenFn', 'orientationGrid', 'nelderMead'];
p.samples.forEach((s, i)=> {
  const dt = p.timeDeltas[i] || 0, seen = new Set();
  let id = s, under = false; const stack = [];
  while (id != null){ const n = byId.get(id); stack.push(n.callFrame.functionName + '@' + n.callFrame.url.split('/').pop()); id = parent.get(id); }
  if (!stack.some(f=> f.startsWith('measureWidths@'))) return;
  for (const f of stack){ const nm = f.split('@')[0]; if (names.includes(nm) && !seen.has(f)){ seen.add(f); incl.set(f, (incl.get(f) || 0) + dt); } }
});
for (const [f, t] of [...incl.entries()].sort((a, b)=> b[1] - a[1])) console.log((t/1000).toFixed(0).padStart(6), 'ms', f);
