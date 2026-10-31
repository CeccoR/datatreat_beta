// The cap's loss: a PX job (the stage uncapped) for every P record whose stage the cap cut, put before the Q jobs
// of jobs-C.txt (the batch reads the file again as slots free).
import fs from 'node:fs';
import { loadX, rowsOf } from './lib3.mjs';
const X = loadX(rowsOf('tuning'), ['P']).filter(x=> x.r.stage && x.r.stage.capped);
const lines = fs.readFileSync('jobs-C.txt', 'utf8').split('\n').filter(l=> !l.startsWith('PX '));
const px = X.map(x=> `PX ${x.row.id} p MIN_SET=capCands=99;capEvals=1e12`);
const i = lines.findIndex(l=> l.startsWith('Q ')), out = [...lines.slice(0, i), ...px, ...lines.slice(i)];
fs.writeFileSync('jobs-C.txt', out.join('\n')); fs.writeFileSync('jobs-X.txt', px.join('\n') + '\n');
console.log(px.length + ' PX jobs');
