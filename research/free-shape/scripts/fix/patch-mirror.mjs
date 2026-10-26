// node patch-mirror.mjs <mirror root> <scratchpad> <fs>: the edits setup.sh describes.
import fs from 'node:fs';
import path from 'node:path';
const [D, SCR, FS] = process.argv.slice(2);
const edit = (f, pairs) => {
  let t = fs.readFileSync(f, 'utf8');
  for (const [a, b] of pairs){ if (!t.includes(a)) throw new Error(`${f}: not found: ${a.slice(0, 80)}`); t = t.replace(a, b); }
  fs.writeFileSync(f, t);
};
edit(path.join(D, 'harness', 'lib.mjs'), [
  ["const SCRATCH = path.resolve(HERE, '..', '..');", `const SCRATCH = ${JSON.stringify(SCR)};`],
  ["path.join(HERE, '..', 'engine', 'xrd-rv.js')", JSON.stringify(path.join(FS, 'engine', 'xrd-rv.js'))],
  ["  const model = buildModel({ x: pat.x, y: pat.y, varMul: pat.varMul, instr: pat.instr, phases: [ph] });\n  const truth =",
   "  const model = buildModel({ x: pat.x, y: pat.y, varMul: pat.varMul, instr: pat.instr, phases: [ph], bgDegree: +(process.env.FS_BG || 6) });\n  const truth ="],
  ["  const r = rng(hash(c.id) ^ Math.imul(seed + 1, 0x9E3779B1));",
   `  // fix: misfits other than the hump (fix/cases-extra.mjs)
  if (c.air){ x.forEach((t, i)=> { yc[i] += c.air.A*Math.exp(-(t - GRID.lo)/c.air.tau); }); }
  if (c.mix){
    const B = BODIES[c.type], w2 = c.dims.map(d=> widthOf(d*c.mix.scale)), P2 = { ...P, 'p1.scale': S };
    Wparams(c.type, w2).forEach((t, i)=> { P2['p1.' + B.W[i]] = t; });
    setParams(m, vecWith(m, P2));
    const net2 = calc(m, null, { internal: true }).perPhase[0];
    for (let i = 0; i < yc.length; i++) yc[i] += c.mix.f*(net2[i] - S*net[i]);
    setParams(m, vecWith(m, { ...P, 'p1.scale': S }));
  }
  const r = rng(hash(c.id) ^ Math.imul(seed + 1, 0x9E3779B1));`],
]);
edit(path.join(D, 'harness', 'cases.mjs'), [
  ['export const CASES = [', `import { VPROX, MISFIT } from ${JSON.stringify(path.join(FS, 'fix', 'cases-extra.mjs'))};\nconst CASES0 = [`],
  ['export const caseById', `const seedsEnv = k => process.env[k] ? process.env[k].split(',').map(Number) : null;
const MIS = MISFIT.map(m=> { const b = CASES0.find(c=> c.id === m.base); return { ...b, ...m, note: undefined }; });
export const CASES = [...CASES0, ...VPROX, ...MIS].map(c=> {
  const s = c.kind === 'synth' ? seedsEnv('FS_SEEDS_SYNTH') : c.kind === 'sample' && !c.fresh ? seedsEnv('FS_SEEDS_SAMPLE') : null;
  return s ? { ...c, seeds: s } : c;
});
export const caseById`],
]);
// plib: FS_DIR is the mirror root already (HERE/..). Nothing to change.
console.log('patched', D);
