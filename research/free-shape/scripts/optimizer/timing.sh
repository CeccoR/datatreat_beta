#!/bin/sh
# Paired wall times: each run in two processes, [app, X] and [X, app] (the first method of a
# process has cold caches), at most 2 processes at a time, under nice -n 15. X = $1 (a variant).
cd "$(dirname "$0")"
mkdir -p results/t-$1
for r in box-plate110:1 u09:1 ell-plate110:1 cyl-disc110:1 ecyl-plate110:1 u03:1; do
  c=${r%:*}; s=${r#*:}
  nice -n 15 /opt/node22/bin/node h/run.mjs --case $c --seed $s --method methods/v-app.mjs,methods/v-$1.mjs --nolog --out results/t-$1/$c-$s-a.json > /dev/null 2>&1 &
  nice -n 15 /opt/node22/bin/node h/run.mjs --case $c --seed $s --method methods/v-$1.mjs,methods/v-app.mjs --nolog --out results/t-$1/$c-$s-b.json > /dev/null 2>&1
  wait
done
echo timing done
