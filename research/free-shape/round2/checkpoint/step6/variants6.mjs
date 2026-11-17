#!/usr/bin/env node
/* The variant runs a tunable needs, chosen from the P records (only rows a setting can change):
   - the start cut: rows whose isotropic fit read no size (Y_s at w0's floor, 1e-3°): SC (PROTO_FILL=4, four random
     starts from their own stream) and SY (PROTO_Y0F=1: the starts' width floored at the instrument's FWHM at the
     range's middle);
   - the minima stage: max 3 (MX) on rows whose stage took more than 3 candidates; rounds 3 (RD) on rows where a
     minimum entered a fourth round (FS.min.rmax).
   node variants6.mjs [--p P] → job lines on stdout */
import { rowsOf, loadX } from './lib6.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ opt[a[i].slice(2)] = a[i + 1]; i++; } }
const X = loadX(rowsOf('tuning'), [opt.p || 'P']), L = [];
const ys = x => x.r.settings ? x.r.settings.ysIso : x.o.iso.Ys;
for (const x of X.filter(x=> ys(x) <= 1e-3)) L.push(`SC ${x.row.id} p PROTO_FILL=4`, `SY ${x.row.id} p PROTO_Y0F=1`);
for (const x of X.filter(x=> x.r.info && x.r.info.minimaStage && x.r.info.minimaStage.cands > 3)) L.push(`MX ${x.row.id} p MIN_SET=max=3`);
for (const x of X.filter(x=> x.r.min && x.r.min.rmax > 3)) L.push(`RD ${x.row.id} p MIN_SET=rounds=3`);
console.log(L.join('\n'));
console.error(`${X.length} records: ${X.filter(x=> ys(x) <= 1e-3).length} at w0's floor, ${X.filter(x=> x.r.info && x.r.info.minimaStage && x.r.info.minimaStage.cands > 3).length} with more than 3 candidates, ${X.filter(x=> x.r.min && x.r.min.rmax > 3).length} with a fourth round`);
