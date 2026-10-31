#!/usr/bin/env node
/* (a) What the app should try: the family verdict (famverdict.mjs) from a subset of the six searches
   (fam5.mjs --json), against the truth and against the verdict from all six.
   Strategies for a chosen solid s0: 'all' (the six), 'gen' (s0, its nested partner and the three general
   members), 'near' (s0, its nested partner and the general member of the family nearest s0's a priori,
   NEAR), 'one' (s0 alone: today).
   node fam-sub.mjs --in fam5.json --margin 10 --marginMisfit 25 --nest box=4,cyl=6,ball=6 [--choose true|any] */
import fs from 'node:fs';
import { familyVerdict, FAMILY, GENERAL, SPECIAL } from './famverdict.mjs';
const a = process.argv.slice(2), opt = {}; for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) opt[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
const R = JSON.parse(fs.readFileSync(opt.in || 'fam5.json', 'utf8')).filter(o=> o.solid !== 'sphere');
const nest = Object.fromEntries(String(opt.nest || 'box=3.84,cyl=5.99,ball=5.99').split(',').map(kv=> { const [k, v] = kv.split('='); return [k, +v]; }));
const o = { margin: +(opt.margin ?? 10), marginMisfit: +(opt.marginMisfit ?? opt.margin ?? 10), nest, stat: opt.stat || 'chi' };
const NEAR = JSON.parse(opt.near || '{"box":"cyl","cyl":"box","ball":"cyl"}');
const partner = s => FAMILY[s] === 'ball' ? (s === 'ellipsoid' ? 'spheroid' : 'ellipsoid') : GENERAL[FAMILY[s]] === s ? SPECIAL[FAMILY[s]] : GENERAL[FAMILY[s]];
const strat = { all: s0 => Object.keys(FAMILY).filter(s=> s !== 'sphere'), gen: s0 => [...new Set([s0, partner(s0), ...Object.values(GENERAL)])], near: s0 => [...new Set([s0, partner(s0), GENERAL[NEAR[FAMILY[s0]]]])], one: s0 => [s0] };
const verdict = (row, solids) => familyVerdict(solids.filter(s=> row.fits[s]).map(s=> ({ type: s, chi2: row.fits[s].c, P: row.fits[s].P, flagged: row.fits[s].flagged })), { chi2: 0, P: row.Piso }, 1, { ...o, N: row.N });
const tally = {};
for (const row of R){
  const all = verdict(row, strat.all());
  const chosen = opt.choose === 'any' ? Object.keys(FAMILY).filter(s=> s !== 'sphere') : [row.solid];
  for (const s0 of chosen) for (const [nm, fn] of Object.entries(strat)){
    const v = verdict(row, fn(s0)), t = tally[nm] = tally[nm] || { n: 0, right: 0, nd: 0, wrong: 0, ndTruthIn: 0, solidRight: 0, sameAsAll: 0, searches: 0, clean: { right: 0, nd: 0, wrong: 0 }, err: { right: 0, nd: 0, wrong: 0 } };
    t.n++; t.searches += fn(s0).length;
    const k = v.determined ? (v.family === FAMILY[row.solid] ? 'right' : 'wrong') : 'nd';
    t[k]++; t[row.error ? 'err' : 'clean'][k]++;
    if (!v.determined && v.within.includes(FAMILY[row.solid])) t.ndTruthIn++;
    if (v.determined && v.solid === row.solid) t.solidRight++;
    if (v.family === all.family && v.determined === all.determined) t.sameAsAll++;
  }
}
console.log(`${o.stat}: margin ${o.margin}, flagged ${o.marginMisfit}, nest ${JSON.stringify(nest)}, chosen: ${opt.choose || 'true'}`);
console.log('| strategy | searches a fit | right / not determined / wrong | clean | error | n.d. with the truth among those within | determined and the solid itself right | verdict as all six |');
for (const [nm, t] of Object.entries(tally)) console.log(`| ${nm} | ${(t.searches/t.n).toFixed(1)} | ${t.right} / ${t.nd} / ${t.wrong} | ${t.clean.right} / ${t.clean.nd} / ${t.clean.wrong} | ${t.err.right} / ${t.err.nd} / ${t.err.wrong} | ${t.ndTruthIn}/${t.nd} | ${t.solidRight} | ${t.sameAsAll}/${t.n} |`);
