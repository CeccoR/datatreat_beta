import fs from 'node:fs';
import { drawRow } from '../../gen/gen.mjs';
import { truthOf } from '../harness/lib.mjs';
const design = JSON.parse(fs.readFileSync('../design/design.json', 'utf8'));
const row = design.rows.find(r=> r.id === 'box-P4m-near');
const pat = drawRow(row, { noise: false, kernel: 'none' }), T = truthOf(row);
console.log(Object.entries(pat.truth.P).filter(([k])=> /^p1\./.test(k)));
console.log('truthOf W', T.solid.W, 'Q', [0,1,2,3].map(k=> T.P['p1.Q'+k]), Object.keys(T));
