/* The fixtures of the limit's measurements (lim-*.mjs), one set per tab, so that no two tabs
   share a file's bytes: b2 keeps one array a SEM file whichever tabs hold it (sem.js rawOf)
   and XRPD reads a file once by its bytes (xrd.js reread), so the same files in every tab
   would measure one tab's data N times over as one.
   - sem/t<k>/img1..8.tif: 2048 × 2176 at 16 bits (the image and a 128-row info bar), as the
     assessment's, made by tests/fixtures.mjs makeTiff, seed 8k + i: 8.5 MB a file;
   - xrd/t<k>/s00..s11.xrdml: the 12 scans with a comment naming the tab after the XML
     declaration (bytes of their own, the same data, so every tab refines alike);
   - the CIF, and DRS, GC and EPR files (shared: 0.1 MB in all).
   node lim-fx.mjs <out dir> <tabs = 26> <app tree, for tests/fixtures.mjs> */
import fs from 'node:fs';
import path from 'node:path';
const SP = '/tmp/claude-0/-home-user-datatreat-beta/51d5ad4e-64c4-51d8-8fdc-0e18be5b5240/scratchpad';
const [out, K = '26', tree] = process.argv.slice(2);
const { makeTiff } = await import(path.resolve(tree, 'tests/fixtures.mjs'));
const mk = d => fs.mkdirSync(path.join(out, d), { recursive: true });
for (let k = 0; k < +K; k++){
  mk(`sem/t${k}`); mk(`xrd/t${k}`);
  for (let i = 1; i <= 8; i++){
    const f = path.join(out, `sem/t${k}/img${i}.tif`);
    if (!fs.existsSync(f)) fs.writeFileSync(f, makeTiff({ W: 2048, H: 2176, bits: 16, strip: 128, sign: `T${k}-${i}`, pixelNm: 25, mag: 5000, seed: 8*k + i }));
  }
  for (let i = 0; i < 12; i++){
    const n = 's' + String(i).padStart(2, '0') + '.xrdml', src = fs.readFileSync(`${SP}/e2e/xrd/${n}`, 'utf8');
    fs.writeFileSync(path.join(out, `xrd/t${k}/${n}`), src.replace(/^(<\?xml[^>]*\?>)/, `$1\n<!-- tab ${k} -->`));
  }
}
mk('small');
for (const [f, to] of [['wf-xrd/rv-busy/SrTiO3.cif', 'SrTiO3.cif'], ['fx/drs1.csv', 'drs1.csv'], ['e2e/alpha.csv', 'alpha.csv'], ['fx/e1.DSC', 'e1.DSC'], ['fx/e1.DTA', 'e1.DTA']])
  fs.copyFileSync(`${SP}/${f}`, path.join(out, 'small', to));
console.log('fixtures in', out);
