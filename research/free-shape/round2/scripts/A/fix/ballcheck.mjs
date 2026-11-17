// [fix] checks of the WPPM ball mode: run once with FS2A_WPPM_BALL=0 and once =1 (FS2A_PROFILE=wppm); prints sums
import fs from 'node:fs';
import { inModelPattern } from './inmodel-lib.mjs';
import { ENG } from '../eng/xrd-rietveld.js';
const design = JSON.parse(fs.readFileSync(new URL('../../design/design.json', import.meta.url), 'utf8'));
for (const id of process.argv.slice(2)){
  const row = design.rows.find(r=> r.id === id);
  const p = inModelPattern(row, { noise: false });
  let s = 0, s2 = 0, mx = 0, imx = 0; for (let i = 0; i < p.yc.length; i++){ s += p.yc[i]; if (p.yc[i] > mx){ mx = p.yc[i]; imx = i; } }
  console.log(id, 'ball', ENG.WPPM_BALL, 'sum', s.toFixed(3), 'max', mx.toFixed(4), 'at', p.x[imx]);
  fs.writeFileSync(`tmp/ballcheck-${id}-${ENG.WPPM_BALL ? 1 : 0}.json`, JSON.stringify(Array.from(p.yc)));
}
