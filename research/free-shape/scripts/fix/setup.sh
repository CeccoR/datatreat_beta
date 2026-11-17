#!/bin/sh
# Builds the mirror roots the fix runs use: fix/root6, fix/root12 and fix/root18, each a copy of the
# scripts the runs and the scoring need (harness, uniqueness, presentation, writer), with
#  - harness/lib.mjs: absolute input paths; the background degree from FS_BG (default 6);
#    two extra misfits in patternOf (c.air: a low-angle exponential the Chebyshev background
#    lacks; c.mix: a second population of the same solid at c.mix.scale × the dimensions,
#    c.mix.f of the volume);
#  - harness/cases.mjs: the case list of fix/cases-extra.mjs (fresh proxies v01–v12, the
#    misfit cases) appended; seeds from FS_SEEDS_SYNTH / FS_SEEDS_SAMPLE when set;
#  - uniqueness/methods/u-pipe.mjs and u-bootmis.mjs (fix/).
# fix/fixed (the studies' results rescored) is made by hand: see ../README.md.
# The engine is the harness's instrumented copy (a symlink: read only).
set -e
FS=$(cd "$(dirname "$0")/.." && pwd)
SCR=$(cd "$FS/.." && pwd)
for R in root6 root12 root18; do
  D="$FS/fix/$R"
  mkdir -p "$D/harness/methods" "$D/harness/results" "$D/uniqueness/methods" "$D/uniqueness/results" "$D/presentation/results" "$D/writer"
  cp "$FS/harness/lib.mjs" "$FS/harness/cases.mjs" "$FS/harness/run.mjs" "$D/harness/"
  cp "$FS/harness/methods/baseline.mjs" "$FS/harness/methods/truth.mjs" "$D/harness/methods/"
  cp -r "$FS/harness/data" "$D/harness/"
  [ -e "$D/harness/eng" ] || ln -s "$FS/harness/eng" "$D/harness/eng"
  cp "$FS/uniqueness/score.mjs" "$FS/uniqueness/ulib.mjs" "$D/uniqueness/"
  cp "$FS/uniqueness/methods/uniq-core.mjs" "$D/uniqueness/methods/"
  cp "$FS/fix/u-pipe.mjs" "$FS/fix/u-bootmis.mjs" "$D/uniqueness/methods/"
  cp "$FS/presentation/plib.mjs" "$FS/presentation/approaches.mjs" "$FS/presentation/eval.mjs" "$FS/presentation/refit.mjs" "$FS/presentation/ulib.mjs" "$D/presentation/"
  node "$FS/fix/patch-mirror.mjs" "$D" "$SCR" "$FS"
done
# the scoring scripts as corrected in review, and the analysis root fix/fixed
sh "$FS/fix/sync.sh"
echo ok
