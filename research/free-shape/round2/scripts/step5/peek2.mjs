/* STEP5 §4.3–4.4: error kinds and mild shapes per solid under ΔBIC and the adopted rule (keep5.json). */
import { nulls, mild, strong, chi2q } from './keep-rules.mjs';
const K = { tric: 5, mono: 3, orth: 2, tetr: 1, trig: 1, hex: 1, cub: 0 };
const lrt = o => o.G > chi2q(K[o.sys] + 1, 0.001) + 2 && (!o.flag || o.dBIC < -10), bic = o => o.dBIC < -10;
const kinds = ['hump', 'sizedist', 'impurity', 'air', 'po'];
console.log('| error kind | nulls | kept: ΔBIC | the LRT with the check | flagged at keep | real shapes (mild + strong) | kept: ΔBIC | the LRT |');
for (const k of kinds){ const n = nulls.filter(o=> o.error === k), r = [...mild, ...strong].filter(o=> o.error === k);
  console.log(`| ${k} | ${n.length} | ${n.filter(bic).length} | ${n.filter(lrt).length} | ${n.filter(o=> o.flag).length} | ${r.length} | ${r.filter(bic).length} | ${r.filter(lrt).length} |`); }
// by body: mild kept
console.log('\n| body | mild clean: n, ΔBIC, LRT | mild error: n, ΔBIC, LRT |');
for (const s of ['box', 'sqbox', 'cylinder', 'ellcyl', 'ellipsoid', 'spheroid']){ const c = mild.filter(o=> o.solid === s && !o.error), e = mild.filter(o=> o.solid === s && o.error);
  console.log(`| ${s} | ${c.length}, ${c.filter(bic).length}, ${c.filter(lrt).length} | ${e.length}, ${e.filter(bic).length}, ${e.filter(lrt).length} |`); }
const lost = [...mild, ...strong].filter(o=> bic(o) && !lrt(o)); console.log('kept by ΔBIC, not by the LRT:', lost.map(o=> `${o.key} ${o.solid} G ${o.G.toFixed(1)} dBIC ${o.dBIC.toFixed(1)} ${o.flag ? 'F' : ''} ${o.error || ''}`).join('; '));
