#!/usr/bin/env node
/* [fix] mom's search beside its truth reference, for analyse.mjs: results/time/mom/<row>.json (today's
   search, fix/time.mjs) with the truth record of results/tr-mom/<row>.json appended (both start from the
   same deterministic isotropic fit: checked) → results/s-mom/<row>.json. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { readResult, writeResult } = await import('../harness/lib.mjs');
const src = path.join(HERE, 'results', 'time', 'mom'), tr = path.join(HERE, 'results', 'tr-mom'), dst = path.join(HERE, 'results', 's-mom');
fs.mkdirSync(dst, { recursive: true });
let n = 0, isoSame = 0;
for (const f of fs.readdirSync(src).filter(f=> f.endsWith('.json'))){
  if (!fs.existsSync(path.join(tr, f))) continue;
  const o = readResult(fs.readFileSync(path.join(src, f), 'utf8')), t = readResult(fs.readFileSync(path.join(tr, f), 'utf8'));
  if (o.iso.chi2 === t.iso.chi2 && o.iso.evals === t.iso.evals) isoSame++;
  o.records.push(t.records.find(r=> r.method === 'truth'));
  fs.writeFileSync(path.join(dst, f), writeResult(o)); n++;
}
console.log(`s-mom: ${n} rows merged; isotropic fit identical in ${isoSame}`);
