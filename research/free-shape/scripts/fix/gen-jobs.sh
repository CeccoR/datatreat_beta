#!/bin/sh
# Writes fix/jobs.txt, the fix runs in the order they ran (one shell command a line), for
#   xargs -P 2 -d '\n' -n 1 sh -c < jobs.txt
# then queue2.sh (the misfit cases searched again at the picked degree).
F=$(cd "$(dirname "$0")" && pwd); S=$(cd "$F/.." && pwd); J=$F/jobs.txt; : > $J
P=$(seq -w 1 12)
for i in $P; do echo "cd $F && FS_BG=18 FS_JACK=always sh run1.sh root18 u$i 1" >> $J; done
for i in $P; do echo "cd $F && FS_BG=6 FS_JACK=always sh run1.sh root6 v$i 1" >> $J; done
for c in box-plate110 cyl-disc110 ell-plate110 sqbox-plate001; do for m in air mix; do echo "cd $F && FS_BG=6 FS_JACK=flag sh run1.sh root6 $c-$m 1 ../uniqueness/methods/u-pipe.mjs,methods/truth.mjs" >> $J; done; done
for i in $P; do echo "cd $F && FS_BG=18 FS_JACK=always sh run1.sh root18 v$i 1" >> $J; done
for c in $(for i in $P; do echo v$i; done) box-plate110-air box-plate110-mix cyl-disc110-air cyl-disc110-mix ell-plate110-air ell-plate110-mix sqbox-plate001-air sqbox-plate001-mix; do for d in 6 12 18; do
  echo "cd $F/root6/presentation && mkdir -p results/refit && [ -f results/refit/$c-1-bg$d.json ] || nice -n 15 node refit.mjs --case $c --seed 1 --bg $d --from baseline --out results/refit/$c-1-bg$d.json >> results/refit/refit.log 2>&1" >> $J; done; done
for i in $P; do echo "cd $F/root6/harness && mkdir -p results/bootmis && [ -f results/bootmis/u$i-1.json ] || UBOOT_DIR=$S/uniqueness/results/main UBOOT_R=12 nice -n 15 node run.mjs --case u$i --seed 1 --method ../uniqueness/methods/u-bootmis.mjs --nolog --out results/bootmis/u$i-1.json > results/bootmis/u$i-1.log 2>&1" >> $J; done
for c in iso-7 iso-20; do for s in $(seq 24 46); do echo "cd $F/root6/harness && mkdir -p results/null && [ -f results/null/$c-$s.json ] || nice -n 15 node run.mjs --case $c --seed $s --method methods/baseline.mjs --nolog --quiet --out results/null/$c-$s.json" >> $J; done; done
for s in 4 5; do for c in $(cd $F/root6/harness && node run.mjs --list | awk -F'\t' '$2=="synth"{print $1}'); do echo "cd $F && FS_BG=6 FS_JACK=flag sh run1.sh root6 $c $s ../uniqueness/methods/u-pipe.mjs,methods/truth.mjs" >> $J; done; done
wc -l $J
