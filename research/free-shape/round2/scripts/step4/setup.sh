#!/bin/sh
# setup.sh <repository>: step 4's work folder $W/fs2/step4/h beside the shared fs2 folders, run from
# $W/fs2/step4 with this folder's files copied into h/ (methods/ included).
# - $W/step4-app: the repository's HEAD exported (git archive: the main tree is not touched) with this
#   step's patch (../../proto/engine.patch): the prototype with SHAPE_MINIMA (h/eng);
# - h/lib.mjs: the shared harness lib (fs2/harness/lib.mjs, its paths on ../.. and the profile from
#   PROTO_PROFILE), h/data: its standard; step 3's P1 records ($W/fs2/step3/hp/results/P1) are read by
#   score4.mjs and diag-esd.mjs as the reference without the stage.
set -e
REPO=$1; W=$(cd ../.. && pwd)
rm -rf "$W/step4-app"; mkdir -p "$W/step4-app"; git -C "$REPO" archive HEAD | tar -x -C "$W/step4-app"
(cd "$W/step4-app" && git apply "$REPO/research/free-shape/round2/proto/engine.patch")
mkdir -p h/data h/results && cp ../harness/data/irf-r1.json h/data/
sed -e "s#import { PHASES } from '../phases/make-phases.mjs';#import { PHASES } from '../../phases/make-phases.mjs';#" \
    -e "s#export const FS2 = path.resolve(HERE, '..');#export const FS2 = path.resolve(HERE, '..', '..');#" \
    -e "s#export const PHASE_OPTS = { size: true, profile: 'lorentz',#export const PHASE_OPTS = { size: true, profile: process.env.PROTO_PROFILE || 'lorentz',#" \
    ../harness/lib.mjs > h/lib.mjs
(cd h && node make-eng.mjs "$W/step4-app")
