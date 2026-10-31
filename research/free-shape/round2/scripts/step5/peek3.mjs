/* STEP5 §3.2: the family verdict at margin 14 / 35: n.d. with the winner wrong or right, the wrong rows, the spheres (fam5.json). */
import fs from 'node:fs';
import { familyVerdict, FAMILY, GENERAL, SPECIAL } from './famverdict.mjs';
const R = JSON.parse(fs.readFileSync('fam5.json', 'utf8'));
const o = { margin: 14, marginMisfit: 35, nest: { box: 3.84, cyl: 5.99, ball: 5.99 }, nestMisfit: 25 };
let ndWrongWin = 0, ndRightWin = 0; const wrong = [], ndOut = [], sph = [];
for (const row of R){
  const sol = ['box', 'sqbox', 'cylinder', 'ellcyl', 'ellipsoid', 'spheroid'].filter(s=> row.fits[s]);
  const v = familyVerdict(sol.map(s=> ({ type: s, chi2: row.fits[s].c, P: row.fits[s].P, flagged: row.fits[s].flagged })), { chi2: 0, P: row.Piso }, 1, o);
  if (row.solid === 'sphere'){ sph.push(`${row.key} ${row.error || '-'}: ${v.determined ? v.family + ' (' + v.solid + ')' : 'n.d. ' + v.within.join('/')} margin ${v.margin.toFixed(1)}`); continue; }
  const T = FAMILY[row.solid];
  if (v.determined && v.family !== T) wrong.push(`${row.key} (${row.error || 'clean'} ${row.strength ? row.strength.toFixed(2) : ''}${row.winFlag ? ', flagged' : ''}): ${v.family} by ${v.margin.toFixed(1)}`);
  if (!v.determined){ if (v.family !== T) ndWrongWin++; else ndRightWin++; if (!v.within.includes(T)) ndOut.push(`${row.key} (${row.error || 'clean'}): ${v.within.join('/')}, truth ${row.chi.fam[T].toFixed(1)} behind`); }
}
console.log('n.d. with the winner wrong', ndWrongWin, 'right', ndRightWin); console.log('wrong:', wrong.join('; ')); console.log('n.d. without the truth:', ndOut.join('; ')); console.log('spheres:\n ' + sph.join('\n '));
