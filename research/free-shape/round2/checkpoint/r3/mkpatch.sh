#!/bin/sh
# mkpatch.sh: round 3's engine patch against the branch (the full prototype, round 2's parts and round 3's) and
# round 3's own diff against round 2's frozen engine; run from $W (r3-app, r3-gitbase, step6-app beside it).
set -e
W=$(cd "$(dirname "$0")/../.." && pwd); OUT=${1:-$W/fs2/r3/proto}; mkdir -p "$OUT"
for f in xrd-rietveld.js xrd-broad.js xrd-sizeline.js sw.js RIETVELD.md; do cp "$W/r3-app/$f" "$W/r3-gitbase/$f"; done
(cd "$W/r3-gitbase" && git add -A && git diff --cached > "$OUT/engine.patch" && git reset -q && git checkout -q -- . && git clean -qfd)
(cd "$W" && { diff -u step6-app/xrd-rietveld.js r3-app/xrd-rietveld.js || true; diff -u step6-app/RIETVELD.md r3-app/RIETVELD.md || true; } > "$OUT/round3-only.diff")
