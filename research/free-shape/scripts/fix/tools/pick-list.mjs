// The misfit cases' BIC pick over the refits at degrees 6, 12, 18 (sys.mjs's BIC); prints one job line
// per case whose pick is above 6: the pipeline at that degree in fix/root<degree>.
import fs from 'node:fs';
import path from 'node:path';
const D = process.argv[2], F = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ids = ['box-plate110', 'cyl-disc110', 'ell-plate110', 'sqbox-plate001'].flatMap(b=> [b + '-air', b + '-mix']);
for (const id of ids){
  const vs = [6, 12, 18].map(d=> { const f = path.join(D, `${id}-1-bg${d}.json`); if (!fs.existsSync(f)) return null; const j = JSON.parse(fs.readFileSync(f, 'utf8').replace(/\bInfinity\b/g, '1e308')); if (!j.keep) return null; const k = j[j.keep]; return { d, chi: k.chi, chi2nu: k.chi2nu, P: k.P }; }).filter(Boolean);
  if (vs.length < 3) continue;
  const nu0 = Math.max(1, Math.min(...vs.map(v=> v.chi2nu))), bic = v => v.chi/nu0 + v.P*Math.log(5384);
  const pick = vs.reduce((a, b)=> bic(b) < bic(a) ? b : a).d;
  if (pick > 6) console.log(`cd ${F} && FS_BG=${pick} FS_JACK=flag sh run1.sh root${pick} ${id} 1 ../uniqueness/methods/u-pipe.mjs,methods/truth.mjs`);
}
