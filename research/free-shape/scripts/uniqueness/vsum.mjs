// verdict classes against 'accurate in full' and the per-role determinedness rates (score10/score15 condD)
import fs from 'node:fs';
const tag = process.argv[2] || 'score10', V = process.argv[3] || 'condD';
const md = fs.readFileSync(new URL(`./results/${tag}/verdicts-${V}.md`, import.meta.url), 'utf8');
const S = JSON.parse(fs.readFileSync(new URL(`./results/${tag}/score.json`, import.meta.url), 'utf8')).filter(r=> r.iv && r.iv[V]);
const tab = {};
for (const ln of md.split('\n').filter(l=> l.startsWith('| ') && !l.startsWith('| case') )){
  const c = ln.split('|').map(s=> s.trim()); const cls = c[3].split(', '), acc = c[6].split(', ');
  cls.forEach((k, i)=> { if (k === 'isotropic') return; const kind = /^u\d/.test(c[1]) ? 'sample' : 'synth'; const t = tab[kind + ' ' + k] || (tab[kind + ' ' + k] = { n: 0, acc: 0 }); t.n++; if (acc[i] === 'yes') t.acc++; });
}
console.log(tag, V, JSON.stringify(tab));
for (const kind of ['synth', 'sample']){
  const Q = S.filter(r=> r.kind === kind).flatMap(r=> r.iv[V].truthQ);
  for (const role of ['thin', 'mid', 'long']){
    const R = Q.filter(t=> t.role === role), A = R.filter(t=> t.detAng != null);
    console.log(kind, role, `extent determined ${R.filter(t=> t.detDim).length}/${R.length} (accurate ${R.filter(t=> t.detDim && t.accD).length}); accurate overall ${R.filter(t=> t.accD).length}; direction determined ${A.filter(t=> t.detAng).length}/${A.length} (accurate ${A.filter(t=> t.detAng && t.accA).length}); accurate overall ${A.filter(t=> t.accA).length}`);
  }
}
