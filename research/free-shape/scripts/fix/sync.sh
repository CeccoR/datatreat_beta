#!/bin/sh
# Copies the scoring scripts (as corrected in review: uniqueness/score.mjs, presentation/approaches.mjs
# and eval.mjs, writer/cross.mjs, cards.mjs, fig-synthesis.mjs) and the study helpers they import into
# the analysis roots: fix/fixed (the studies' results, rescored: harness -> ../harness and
# uniqueness/results/{main,jack} -> the study's, presentation/results/{xclass,refit,sys-*.json} -> the
# study's, as symlinks) and fix/root6, fix/root12, fix/root18 (the review's runs, made by setup.sh).
F=$(cd "$(dirname "$0")" && pwd); S=$(cd "$F/.." && pwd)
for R in fixed root6 root12 root18; do
  [ -d "$F/$R" ] || continue
  mkdir -p "$F/$R/uniqueness" "$F/$R/presentation" "$F/$R/writer"
  cp "$S/uniqueness/ulib.mjs" "$S/uniqueness/score.mjs" "$F/$R/uniqueness/"
  for f in plib.mjs ulib.mjs oneresult.mjs svg.mjs eval.mjs approaches.mjs; do cp "$S/presentation/$f" "$F/$R/presentation/"; done
  cp "$S/writer/cross.mjs" "$S/writer/cards.mjs" "$S/writer/fig-synthesis.mjs" "$F/$R/writer/"
done
