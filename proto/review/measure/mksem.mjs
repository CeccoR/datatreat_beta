import fs from 'node:fs';
import path from 'node:path';
const { makeTiff } = await import('/home/user/datatreat_beta/tests/fixtures.mjs');
const dir = process.argv[2];
for (let i = 0; i < 8; i++){
  const p = path.join(dir, `img${i + 1}.tif`);
  fs.writeFileSync(p, makeTiff({ W: 2048, H: 2048 + 128, bits: 16, strip: 128, sign: 'R' + (i + 1), pixelNm: i < 4 ? 25 : 50, mag: i < 4 ? 5000 : 2500, seed: 100 + i }));
}
