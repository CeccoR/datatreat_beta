#!/bin/sh
# setup.sh <repository>: step 3's work folders $W/fs2/step3/h and hp beside the shared fs2 folders, run from
# $W/fs2/step3 with this folder's h/ and hp/ copied there.
# - $W/step2-app: the repository's HEAD exported (git archive: the main tree is not touched) with step 2's
#   patch (commit 3f53c70's proto/engine.patch): the engine of the C1 runs (h/eng);
# - $W/step3-app: the same with this step's patch (../../proto/engine.patch): the prototype (hp/eng);
# - h/, hp/: step 2's harness lib (fs2/harness/lib.mjs, its paths on ../.. and the profile from PROTO_PROFILE)
#   and data; h/make-eng.mjs is step 2's, hp/make-eng.mjs adds SHAPE_CHECK, lineCheck, lineJack to ENG.
set -e
REPO=$1; W=$(cd ../.. && pwd)
for a in step2 step3; do rm -rf "$W/$a-app"; mkdir -p "$W/$a-app"; git -C "$REPO" archive HEAD | tar -x -C "$W/$a-app"; done
git -C "$REPO" show 3f53c70:research/free-shape/round2/proto/engine.patch > "$W/step2.patch"
(cd "$W/step2-app" && git apply "$W/step2.patch")
(cd "$W/step3-app" && git apply "$REPO/research/free-shape/round2/proto/engine.patch")
for d in h hp; do
  mkdir -p $d/data $d/results && cp ../harness/data/irf-r1.json $d/data/
  sed -e "s#import { PHASES } from '../phases/make-phases.mjs';#import { PHASES } from '../../phases/make-phases.mjs';#" \
      -e "s#export const FS2 = path.resolve(HERE, '..');#export const FS2 = path.resolve(HERE, '..', '..');#" \
      -e "s#export const PHASE_OPTS = { size: true, profile: 'lorentz',#export const PHASE_OPTS = { size: true, profile: process.env.PROTO_PROFILE || 'lorentz',#" \
      ../harness/lib.mjs > $d/lib.mjs
done
cp "$REPO/research/free-shape/round2/scripts/step2/make-eng.mjs" h/
(cd h && node make-eng.mjs "$W/step2-app")
(cd hp && node make-eng.mjs "$W/step3-app")
