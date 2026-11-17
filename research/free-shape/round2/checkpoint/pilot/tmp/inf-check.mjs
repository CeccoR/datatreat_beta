import fs from 'node:fs';
const dir = 'results/screen';
for (const f of fs.readdirSync(dir).filter(f=> f.endsWith('.json'))){
  const o = JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8'));
  for (const r of o.records){
    const bad = [];
    if (r.solid && r.solid.dims.some(d=> d == null)) bad.push('solid ' + JSON.stringify(r.solid.dims));
    if (r.acc && (r.acc.dimMax == null || r.acc.dimErr.some(d=> d == null))) bad.push('acc ' + JSON.stringify(r.acc.dimErr) + ' max ' + r.acc.dimMax);
    if (r.freeSolid && r.freeSolid.dims.some(d=> d == null)) bad.push('free ' + JSON.stringify(r.freeSolid.dims));
    if (r.accFree && (r.accFree.dimMax == null || r.accFree.dimErr.some(d=> d == null))) bad.push('accFree ' + JSON.stringify(r.accFree.dimErr));
    if (bad.length) console.log(o.row, r.method, o.truth && o.truth.dims.map(x=>x.toFixed(1)).join('x'), bad.join(' ; '));
  }
}
