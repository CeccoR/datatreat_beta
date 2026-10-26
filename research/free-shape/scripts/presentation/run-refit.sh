#!/bin/sh
# one refit per line of jobs-refit.txt ("case seed bg"), 2 at a time under nice -n 15; skips done ones
cd "$(dirname "$0")"
mkdir -p results/refit
while read c s b; do
  f="results/refit/$c-$s-bg$b.json"
  [ -f "$f" ] || echo "$c $s $b"
done < jobs-refit.txt | xargs -P 2 -L 1 sh -c 'nice -n 15 /opt/node22/bin/node refit.mjs --case "$0" --seed "$1" --bg "$2" --out "results/refit/$0-$1-bg$2.json" >> results/refit/refit.log 2>&1'
echo done >> results/refit/refit.log
