/* STEP5 §4.3: the clean nulls the 0.99 point keeps; the mild shapes between the rules (keep5.json). */
import { D, nulls, mild, chi2q } from './keep-rules.mjs';
const K = { tric: 5, mono: 3, orth: 2, tetr: 1, trig: 1, hex: 1, cub: 0 };
const T = (o, a, m) => chi2q(K[o.sys] + 1, a) + m;
console.log('clean nulls kept at 0.99:'); for (const o of nulls.filter(o=> !o.error && o.G > T(o, 0.01, 0))) console.log(' ', o.key, o.solid, o.sys, o.G.toFixed(1), T(o, 0.01, 0).toFixed(1), 'D', o.D, 'counts', o.counts);
console.log('mild kept at 0.99 but not 0.999+2:'); for (const o of mild.filter(o=> o.G > T(o, 0.01, 0) && !(o.G > T(o, 0.001, 2)))) console.log(' ', o.key, o.solid, o.sys, 'r', o.r.toFixed(3), o.G.toFixed(1), o.error || '-', o.flag ? 'F' : '');
console.log('mild clean not kept at 0.999+2:'); for (const o of mild.filter(o=> !o.error && !(o.G > T(o, 0.001, 2)))) console.log(' ', o.key, o.solid, o.sys, 'r', o.r.toFixed(3), 'G', o.G.toFixed(1), 'need', T(o, 0.001, 2).toFixed(1), 'counts', o.counts);
console.log('mild clean kept by 0.999+2, not by BIC:'); for (const o of mild.filter(o=> !o.error && o.G > T(o, 0.001, 2) && !(o.dBIC < -10))) console.log(' ', o.key, o.solid, o.sys, 'r', o.r.toFixed(3), 'G', o.G.toFixed(1), 'dBIC', o.dBIC.toFixed(1));
console.log('error nulls kept by 0.999+2+check but not by BIC:'); for (const o of nulls.filter(o=> o.error && o.G > T(o, 0.001, 2) && (!o.flag || o.dBIC < -10) && !(o.dBIC < -10))) console.log(' ', o.key, o.solid, o.sys, o.error, o.G.toFixed(1), 'dBIC', o.dBIC.toFixed(1), o.flag ? 'F' : '');
