#!/usr/bin/env node
/* The family bootstrap's jobs (methods/fboot.mjs) from fam5.json: the screening truths whose runner-up
   family lies within --within (40) χ²_ν of the winner, or whose true family does; for each, the general
   member of every family within that of the winner, and the special members of the true and of the
   winning family (the nested test). node fboot-jobs.mjs [--within 40] > jobs-FB.txt */
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const a = process.argv.slice(2), opt = {}; for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) opt[a[i].slice(2)] = a[++i];
const WITHIN = +(opt.within || 40), GEN = { box: 'box', cyl: 'ellcyl', ball: 'ellipsoid' }, SPEC = { box: 'sqbox', cyl: 'cylinder', ball: 'spheroid' };
const R = JSON.parse(fs.readFileSync(path.join(HERE, 'fam5.json'), 'utf8')).filter(o=> o.solid !== 'sphere');
const L = [];
for (const o of R){
  if (!(o.chi.margin < WITHIN || Math.abs(o.chi.trueMargin) < WITHIN)) continue;
  const set = new Set([SPEC[o.trueFam], GEN[o.trueFam], SPEC[o.chi.win]]);
  for (const [F, d] of Object.entries(o.chi.fam)) if (d < WITHIN) set.add(GEN[F]);
  for (const s of set) if (o.have.includes(s)) L.push(`FB ${o.key} ${s} METHOD=fboot,FBOOT_SRC=results/X2/${o.key}.${s}.json`);
}
console.log(L.join('\n'));
