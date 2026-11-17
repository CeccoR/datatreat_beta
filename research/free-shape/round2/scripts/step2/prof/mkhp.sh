#!/bin/sh
# prof/mkhp.sh <dir> <engine dir>: a harness copy in <dir> (h/<dir>) whose eng is <engine dir> (a symlink),
# lib.mjs and run.mjs with their paths one level deeper; run.mjs also writes globalThis.__P (the timers).
cd "$(dirname "$0")/.." || exit 1
D=$1; E=$2
mkdir -p $D/data && cp data/irf-r1.json $D/data/
ln -sfn "$(realpath $E)" $D/eng
sed -e "s#'../../phases/make-phases.mjs'#'../../../phases/make-phases.mjs'#" -e "s#path.resolve(HERE, '..', '..');#path.resolve(HERE, '..', '..', '..');#" lib.mjs > $D/lib.mjs
sed -e "s#'../../gen/gen.mjs'#'../../../gen/gen.mjs'#" -e "s#^out.at = new Date#if (globalThis.__P) out.prof = globalThis.__P;\nout.at = new Date#" run.mjs > $D/run.mjs
