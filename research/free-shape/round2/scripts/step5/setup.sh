#!/bin/sh
# setup.sh <repository>: step 5's work folder $W/fs2/step5/h (and h2, the final engine's) beside the shared
# fs2 folders, run from $W/fs2/step5 with this folder's files copied into h/ (methods/ included).
# - $W/step5-app: the repository's HEAD exported (git archive: the main tree is not touched) with the
#   patch (../../proto/engine.patch): the prototype with SHAPE_KEEP and SHAPE_FAMILY;
# - h/lib.mjs: the shared harness lib (fs2/harness/lib.mjs, its paths on ../.., the profile from
#   PROTO_PROFILE), h/data: its standard; step 4's S2 records ($W/fs2/step4/h/results/S2) are read by
#   keep5.mjs (the screening truths). The study's runs used the patch with SHAPE_KEEP's study switches
#   ('all', early, record), which the final patch keeps; rule 'bic' with record off is step 4's to the bit.
set -e
REPO=$1; W=$(cd ../.. && pwd)
rm -rf "$W/step5-app"; mkdir -p "$W/step5-app"; git -C "$REPO" archive HEAD | tar -x -C "$W/step5-app"
(cd "$W/step5-app" && git apply "$REPO/research/free-shape/round2/proto/engine.patch")
mkdir -p h/data h/results && cp ../harness/data/irf-r1.json h/data/
sed -e "s#import { PHASES } from '../phases/make-phases.mjs';#import { PHASES } from '../../phases/make-phases.mjs';#" \
    -e "s#export const FS2 = path.resolve(HERE, '..');#export const FS2 = path.resolve(HERE, '..', '..');#" \
    -e "s#export const PHASE_OPTS = { size: true, profile: 'lorentz',#export const PHASE_OPTS = { size: true, profile: process.env.PROTO_PROFILE || 'lorentz',#" \
    ../harness/lib.mjs > h/lib.mjs
(cd h && node make-eng.mjs "$W/step5-app" && node mkdesign5.mjs)
rm -rf h2 && cp -r h h2 && rm -rf h2/results && mkdir -p h2/results
