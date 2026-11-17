/* The timers of whole runs (prof/runprof.sh records): per row, CPU of the fit, the share of
   phasePattern and of WPPM's parts, per-evaluation ms, lines, N, read-out points a line.
   node prof/sum-run.mjs <dir> [--md] */
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2], md = process.argv.includes('--md');
const f = (x, d = 1) => Number.isFinite(x) ? x.toFixed(d) : '—';
const K = ['read', 'fft', 'com', 'size', 'fill', 'pair', 'lineNodes'];
const rows = [];
for (const fn of fs.readdirSync(dir).filter(x=> x.endsWith('.json')).sort()){
  const o = JSON.parse(fs.readFileSync(path.join(dir, fn), 'utf8')), P = o.prof; if (!P) continue;
  const ph = P.t.phase, lo = P.t.lineOf || 0;
  const r = { id: o.row, laue: o.laue, cpu: o.cpu.fitMs/1000, ev: P.evals, msEv: ph/P.evals, phaseShare: ph/o.cpu.fitMs,
    parts: Object.fromEntries(K.map(k=> [k, (P.t[k] || 0)/ph])), restLine: (lo - K.reduce((s, k)=> s + (P.t[k] || 0), 0))/ph, restPhase: (ph - lo - (P.t.shapeTs || 0))/ph,
    linesEv: P.lines/P.evals, readLine: P.read/P.lines, N: P.N, nL: P.nL/P.lines, members: P.members/P.lines };
  rows.push(r);
}
const Nmix = N => { const t = Object.values(N).reduce((a, b)=> a + b, 0); return Object.entries(N).sort((a, b)=> +a[0] - +b[0]).map(([k, v])=> `${k >= 1024 ? k/1024 + 'k' : k}:${Math.round(100*v/t)}`).join(' '); };
console.log(md ? '| row | class | CPU s | evaluations | ms an evaluation | phasePattern share of CPU | read-out | FFT | common factor | size A(L) | fill | lineNodes | rest | lines an evaluation | read-out points a line | N (% of lines) |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|' : '');
for (const r of rows){
  const p = r.parts, pc = x => f(100*x, 0) + ' %';
  if (md) console.log(`| ${r.id} | ${r.laue} | ${f(r.cpu, 0)} | ${r.ev} | ${f(r.msEv)} | ${pc(r.phaseShare)} | ${pc(p.read)} | ${pc(p.fft)} | ${pc(p.com)} | ${pc(p.size)} | ${pc(p.fill)} | ${pc(p.lineNodes)} | ${pc(r.restLine + r.restPhase)} | ${f(r.linesEv, 0)} | ${f(r.readLine, 0)} | ${Nmix(r.N)} |`);
  else console.log(`${r.id.padEnd(26)} ${r.laue.padEnd(5)} cpu ${f(r.cpu, 0)} s ev ${r.ev} ${f(r.msEv)} ms/ev phase ${pc(r.phaseShare)} | ${K.map(k=> k + ' ' + pc(p[k])).join(' ')} rest ${pc(r.restLine + r.restPhase)} | lines/ev ${f(r.linesEv, 0)} read/line ${f(r.readLine, 0)} nL ${f(r.nL, 0)} memb/line ${f(r.members, 1)} N ${Nmix(r.N)}`);
}
const S = k => rows.reduce((s, r)=> s + r.parts[k]*r.msEv*r.ev, 0), T = rows.reduce((s, r)=> s + r.msEv*r.ev, 0), C = rows.reduce((s, r)=> s + r.cpu*1000, 0);
console.log(`all ${rows.length}: phasePattern ${f(100*T/C)} % of CPU; of it ${K.map(k=> k + ' ' + f(100*S(k)/T) + ' %').join(', ')}`);
