#!/bin/sh
# per-evaluation and per-Jacobian wall times (methods/bench.mjs), one process at a time
cd "$(dirname "$0")"
for r in box-plate110:1 u09:1 cyl-disc110:1 ell-plate110:1; do
  c=${r%:*}; s=${r#*:}
  nice -n 15 /opt/node22/bin/node h/run.mjs --case $c --seed $s --method methods/bench.mjs --nolog 2>&1 | grep BENCH
done > results/bench.txt
echo bench done
