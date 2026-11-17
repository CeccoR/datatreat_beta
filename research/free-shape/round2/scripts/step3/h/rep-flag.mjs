#!/usr/bin/env node
/* Step 3, part 1: the per-line statistics against the error kinds and strengths, and their false
   alarms on the clean rows (an3.mjs load). node rep-flag.mjs [--tag C1] [--rows] */
import { load, f, med } from './an3.mjs';
const opt = { rows: process.argv.includes('--rows') };
const X = load().filter(x=> x.st);
const KINDS = ['none', 'hump', 'sizedist', 'impurity', 'air', 'po'];
const STATS = [
  ['chi2nu', 'global χ²_ν'], ['zglob', 'global χ², z'], ['zdw', 'global Durbin–Watson, z'], ['worstC2', 'worst segment χ²_ν'],
  ['zseg', 'worst segment χ², family-wise z'], ['zsegDW', 'worst segment DW, family-wise z'], ['zsegM', 'worst segment Σr, family-wise z'],
  ['zQ0.25', 'bins 0.25°: Σz², z'], ['zQ1', 'bins 1°: Σz², z'], ['zQ4', 'bins 4°: Σz², z'], ['zb1', 'worst 1° bin, family-wise z'], ['zb4', 'worst 4° bin, family-wise z'],
  ['conc1', 'excess χ² share, worst segment'], ['conc3', 'excess χ² share, worst 3'],
];
const L = [];
L.push('| statistic | clean (39): median, 90 %, max | ' + KINDS.slice(1).map(k=> k + ': median (above clean max)').join(' | ') + ' |', '|---|---|' + KINDS.slice(1).map(()=> '---').join('|') + '|');
for (const [k, nm] of STATS){
  const C = X.filter(x=> x.clean).map(x=> x.st[k]), cmax = Math.max(...C);
  const q = (xs, p) => { const s = [...xs].sort((a, b)=> a - b); return s[Math.min(s.length - 1, Math.floor(p*(s.length - 1) + 0.5))]; };
  L.push(`| ${nm} | ${f(med(C))}, ${f(q(C, 0.9))}, ${f(cmax)} | ` + KINDS.slice(1).map(kd=> { const E = X.filter(x=> x.ek === kd).map(x=> x.st[k]); return `${f(med(E))} (${E.filter(v=> v > cmax).length}/${E.length})`; }).join(' | ') + ' |');
}
console.log(L.join('\n'));
// detection at thresholds
const RULES = [
  ['worst segment χ²_ν > 1.25 (round 1)', x=> x.st.worstC2 > 1.25],
  ['global χ²_ν > 1.05', x=> x.st.chi2nu > 1.05],
  ['global χ², z > 3.09', x=> x.st.zglob > 3.09],
  ['global DW, z > 3.09', x=> x.st.zdw > 3.09],
  ['worst segment χ², fw z > 2.33', x=> x.st.zseg > 2.33],
  ['worst segment χ², fw z > 3.09', x=> x.st.zseg > 3.09],
  ['worst segment DW, fw z > 3.09', x=> x.st.zsegDW > 3.09],
  ['worst segment Σr, fw z > 3.09', x=> x.st.zsegM > 3.09],
  ['bins 1°, Σz² z > 3.09', x=> x.st['zQ1'] > 3.09],
  ['bins 4°, Σz² z > 3.09', x=> x.st['zQ4'] > 3.09],
  ['worst 1° bin, fw z > 3.09', x=> x.st['zb1'] > 3.09],
  ['worst 4° bin, fw z > 3.09', x=> x.st['zb4'] > 3.09],
];
const extra = (process.env.RULES || '').split(';').filter(Boolean).map(s=> [s, new Function('x', 'return ' + s)]);
const L2 = ['', '| rule | clean: false alarms (truths / spheres) | ' + KINDS.slice(1).map(k=> k + ' (s ≥ 0.5)').join(' | ') + ' | error rows | harmful error rows | harmless error rows |', '|---|---|' + KINDS.slice(1).map(()=> '---').join('|') + '|---|---|---|'];
for (const [nm, fn] of [...RULES, ...extra]){
  const c = X.filter(x=> x.clean), e = X.filter(x=> !x.clean);
  const cnt = xs => `${xs.filter(fn).length}/${xs.length}`;
  L2.push(`| ${nm} | ${c.filter(fn).length}/${c.length} (${c.filter(x=> x.row.kind === 'truth').filter(fn).length} / ${c.filter(x=> x.row.kind === 'sphere').filter(fn).length}) | ` + KINDS.slice(1).map(kd=> { const E = e.filter(x=> x.ek === kd); return `${cnt(E)} (${cnt(E.filter(x=> x.es >= 0.5))})`; }).join(' | ') + ` | ${cnt(e)} | ${cnt(e.filter(x=> x.harm))} | ${cnt(e.filter(x=> !x.harm))} |`);
}
console.log(L2.join('\n'));
if (opt.rows){
  console.log('\n| row | error (strength) | outcome | harm | χ²_ν | z glob | z DW | worst seg χ²_ν | z seg | z segDW | z segM | zQ1 | zQ4 | zb1 | conc1 | worst segment |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const x of [...X].sort((p, q)=> (p.ek > q.ek ? 1 : p.ek < q.ek ? -1 : p.es - q.es))){
    const s = x.st, out = x.r.kept ? (x.r.held ? 'held' : 'free') : x.r.early ? 'early' : 'rejected';
    console.log(`| ${x.row.id} | ${x.ek}${x.ek !== 'none' ? ' ' + f(x.es) : ''} | ${out} | ${x.why} | ${f(s.chi2nu, 3)} | ${f(s.zglob, 1)} | ${f(s.zdw, 1)} | ${f(s.worstC2, 3)} | ${f(s.zseg, 1)} | ${f(s.zsegDW, 1)} | ${f(s.zsegM, 1)} | ${f(s['zQ1'], 1)} | ${f(s['zQ4'], 1)} | ${f(s['zb1'], 1)} | ${f(s.conc1)} | ${s.top[0].hkl} ${f(s.top[0].tt, 1)}° |`);
  }
}
// the adopted rule (ADOPT, default the prototype's): per error kind, the strengths it caught and missed
{
  const A = new Function('x', 'return ' + (process.env.ADOPT || 'x.st.zseg > 3.09 || x.st.zb1 > 3.09'));
  const C = new Function('x', 'return x.st.zseg > 3.09');
  console.log(`\n| error | caught (strength; * spoiled) | missed | per-line χ² alone: caught |`);
  console.log('|---|---|---|---|');
  for (const kd of KINDS.slice(1)){
    const E = X.filter(x=> x.ek === kd).sort((p, q)=> p.es - q.es), s = x=> f(x.es) + (x.harm ? '*' : '');
    console.log(`| ${kd} | ${E.filter(A).map(s).join(', ')} | ${E.filter(x=> !A(x)).map(s).join(', ') || '—'} | ${E.filter(C).length}/${E.length} |`);
  }
}
