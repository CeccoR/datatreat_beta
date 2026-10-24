#!/bin/sh
# Every b2 measurement, one after the other (nothing else running): HEAD on HEAD_BASE
# (default :8994), HEAD + core.patch + xrd.patch on B2_BASE (default :8993). Some 25 min on
# 4 CPUs. Each writes results/<name>.json and prints its summary.
cd "$(dirname "$0")" || exit 1
for s in ids tiers bytes leak switch memory background; do
  echo "== $s"; node $s.mjs || echo "!! $s failed"
done
