#!/bin/sh
# Every run behind the results, in the order they can be reproduced (at most 2 processes
# at a time, nice -n 15; about 6 h on this shared 4-vCPU machine). The engine copy first.
cd "$(dirname "$0")"
/opt/node22/bin/node make-opt.mjs            # h/eng/xrd-rietveld.js from the harness's copy (opt-eng.diff)
/opt/node22/bin/node variants.mjs            # methods/v-*.mjs
# the Jacobian checks (columns against central differences; timings)
(cd h && /opt/node22/bin/node run.mjs --case box-plate110 --seed 1 --method ../methods/checkjac.mjs --nolog)
# the pilot (18 runs) for each single knob and combination
for v in nocov fwd member broy3 c8 c9 briefShapeXs briefShape brief4 halving halvingDedup dedup heldBrief logW stride2 sur4 sur8 c1 c3 c4 c5 c6 c7; do
  /opt/node22/bin/node pbatch.mjs --tag p-$v --method methods/v-$v.mjs --runs pilot
done
# the robust set (pilot + the 12 sample-like runs)
for v in c10 c11 c12 c13; do /opt/node22/bin/node pbatch.mjs --tag r-$v --method methods/v-$v.mjs --runs robust; done
# full batches (110 runs)
for v in fwd c1 c4; do /opt/node22/bin/node pbatch.mjs --tag f-$v --method methods/v-$v.mjs --runs all; done
# the uniqueness analysis after the c1 search
/opt/node22/bin/node pbatch.mjs --tag u-c1 --method methods/u-c1.mjs --runs robust
# paired wall times and the per-evaluation benchmark
./timing.sh fwd; ./timing.sh c1; ./timing.sh c4; ./bench.sh
# tables and figures
/opt/node22/bin/node cmp.mjs p-nocov p-fwd p-member p-broy3 p-c8 p-c9 p-briefShapeXs p-briefShape p-brief4 p-halving p-halvingDedup p-dedup p-heldBrief p-logW p-stride2 p-sur4 p-sur8 p-c1 p-c3 p-c4 p-c5 p-c6 p-c7 --tref p-nocov --json results/cmp-pilot.json --md results/cmp-pilot.md
/opt/node22/bin/node cmp.mjs f-fwd f-c1 f-c4 --json results/cmp-full.json
/opt/node22/bin/node cmp.mjs f-fwd f-c1 f-c4 r-c10 r-c11 r-c12 r-c13 --only robust --json results/cmp-robust.json
for t in f-fwd f-c1 f-c4; do /opt/node22/bin/node h/table.mjs --tag $t --ref baseline,f-fwd,f-c1,f-c4; done
/opt/node22/bin/node stages.mjs baseline f-fwd f-c1 f-c4 > results/stages-full.txt
/opt/node22/bin/node acc.mjs baseline f-fwd f-c1 f-c4 > results/accuracy.md
/opt/node22/bin/node tsum.mjs c1 c4 fwd > results/timing.txt
/opt/node22/bin/node uniq-sum.mjs u-c1 --json results/uniq-c1.json > results/uniq-c1.txt
/opt/node22/bin/node fig-variants.mjs results/cmp-pilot.json figs/variants.svg "Optimiser variants on the 18 pilot runs: cost against the app's search"
/opt/node22/bin/node fig-full.mjs results/cmp-full.json f-c1 figs/full-c1.svg "fwd + halving (c1) against the app's search, 110 runs"
/opt/node22/bin/node fig-full.mjs results/cmp-full.json f-fwd figs/full-fwd.svg "forward differences (fwd) against the app's search, 110 runs"
/opt/node22/bin/node fig-path.mjs figs/path.svg box-plate110:1,u11:1 baseline f-fwd f-c1
/opt/node22/bin/node fig-landscape.mjs results/uniq-c1.json figs/landscape.svg "Near-equivalent minima after the c1 search: one valley or distinct? (27 runs)"
for f in variants full-c1 full-fwd path landscape; do /opt/node22/bin/node h/svg2png.mjs figs/$f.svg figs/$f.png; done
