#!/bin/sh
# setup.sh <repository>: step 6's work folder $W/fs2/step6 (h/ the prototype's harness) beside the shared fs2
# folders, run from $W/fs2/step6 with this folder's files copied in (h/ and h/methods/ included).
# - $W/step6-app: the repository's HEAD exported (git archive: the main tree is not touched) with the frozen
#   patch (../../proto/engine.patch);
# - h/lib.mjs: the shared harness lib (fs2/harness/lib.mjs, its paths on ../.., the profile from PROTO_PROFILE),
#   h/data: its standard; h/design5.json: step 5's derived rows (../step5/mkdesign5.mjs);
# - today's search runs through fs2/pilot/run.mjs on the frozen b9bef5f engine (fs2/harness/eng), its screening
#   records in fs2/pilot/results/screen.
set -e
REPO=$1; W=$(cd ../.. && pwd)
rm -rf "$W/step6-app"; mkdir -p "$W/step6-app"; git -C "$REPO" archive HEAD | tar -x -C "$W/step6-app"
(cd "$W/step6-app" && git apply "$REPO/research/free-shape/round2/proto/engine.patch")
mkdir -p h/data h/results results && cp ../harness/data/irf-r1.json h/data/
sed -e "s#import { PHASES } from '../phases/make-phases.mjs';#import { PHASES } from '../../phases/make-phases.mjs';#" \
    -e "s#export const FS2 = path.resolve(HERE, '..');#export const FS2 = path.resolve(HERE, '..', '..');#" \
    -e "s#export const PHASE_OPTS = { size: true, profile: 'lorentz',#export const PHASE_OPTS = { size: true, profile: process.env.PROTO_PROFILE || 'lorentz',#" \
    ../harness/lib.mjs > h/lib.mjs
cp "$REPO/research/free-shape/round2/scripts/step5/mkdesign5.mjs" h/ && (cd h && node mkdesign5.mjs && node make-eng.mjs "$W/step6-app")
