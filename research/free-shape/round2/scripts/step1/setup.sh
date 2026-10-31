#!/bin/sh
# setup.sh <repository root>: step 1's work folder, $W/fs2/step1, beside the shared fs2 folders.
# - app/: the repository's HEAD exported (git archive: the main tree is not touched), the
#   prototype's engine.patch applied (with SHAPE_FWD, as round2/proto/engine.patch now carries it);
# - h/: the harness: fs2/harness/lib.mjs with its paths on ../.. and the phase's profile from
#   PROTO_PROFILE, round 1's standard, these scripts; eng/ built from app/ by make-eng.mjs.
# Run from $W/fs2/step1 with this folder's scripts in h/.
set -e
REPO=$1
mkdir -p app h/data
git -C "$REPO" archive HEAD | tar -x -C app
(cd app && git apply "$REPO/research/free-shape/round2/proto/engine.patch")
cp ../harness/data/irf-r1.json h/data/
sed -e "s#import { PHASES } from '../phases/make-phases.mjs';#import { PHASES } from '../../phases/make-phases.mjs';#" \
    -e "s#export const FS2 = path.resolve(HERE, '..');#export const FS2 = path.resolve(HERE, '..', '..');#" \
    -e "s#export const PHASE_OPTS = { size: true, profile: 'lorentz',#export const PHASE_OPTS = { size: true, profile: process.env.PROTO_PROFILE || 'lorentz',#" \
    ../harness/lib.mjs > h/lib.mjs
(cd h && node make-eng.mjs)
# then, from h/: node batch.mjs jobs0.txt (the identity checks), jobs1.txt (lsq), jobs2.txt (WPPM);
# node score.mjs ... (STEP1.md, "Files")
