#!/bin/sh
# run1.sh <root6|root18> <case> <seed> [methods]: one run of the pipeline (uniqueness/methods/u-pipe.mjs,
# plus harness/methods/truth.mjs for synthetic and misfit cases) in a mirror root; the record goes to
# uniqueness/results/main/, and the same file to harness/results/baseline/ and uniqueness/results/jack/
# (where plib.loadRun and score.mjs look). Skips a run already done. Env: FS_BG, FS_JACK.
set -e
# a seed listed as fix/skip-<seed> is not run (the synthetic hold-out was cut to seeds 4 and 5 for time)
[ -f "$(dirname "$0")/skip-$3" ] && exit 0
R=$(cd "$(dirname "$0")/$1" && pwd); C=$2; SEED=$3; M=${4:-../uniqueness/methods/u-pipe.mjs}
F="$R/uniqueness/results/main/$C-$SEED.json"
[ -f "$F" ] && exit 0
mkdir -p "$R/uniqueness/results/main" "$R/harness/results/baseline" "$R/uniqueness/results/jack" "$R/logs"
cd "$R/harness"
nice -n 15 /opt/node22/bin/node run.mjs --case "$C" --seed "$SEED" --method "$M" --out "$F.tmp" > "$R/logs/$C-$SEED.log" 2>&1
mv "$F.tmp" "$F"
cp "$F" "$R/harness/results/baseline/$C-$SEED.json"
cp "$F" "$R/uniqueness/results/jack/$C-$SEED.json"
