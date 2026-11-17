#!/bin/sh
# setup.sh <repository>: step 2's work folder, $W/fs2/step2/h beside the shared fs2 folders, run from
# $W/fs2/step2 with this folder's files copied into h/ (keeping prof/ and bench/).
# - $W/step1-app: the repository's HEAD exported (git archive: the main tree is not touched) with
#   step 1's patch (the prototype as STEP1.md left it: commit b4b283a's proto/engine.patch);
# - $W/step2-app: the same with step 2's patch (../../proto/engine.patch);
# - h/: step 1's harness lib (fs2/harness/lib.mjs, paths on ../.. and the profile from PROTO_PROFILE)
#   and data; eng0 (step 1's engine), eng (step 2's), eng2 (the copy the runs used), eng3 (the
#   prototype's defaults), engxs (eng with PROTO_NOEARLY for the cross-solid searches), and the
#   harness folders h0 (eng0), h2 (eng2), h3 (eng3), hxs (engxs) made by prof/mkhp.sh; the
#   profiling copies prof/engp0, prof/engp and the harness folders hp0, hp.
# The runs used an eng2 made before the 'exact' option and the defaults were written; the final
# engine reproduces its records bit for bit (STEP2.md §2: D3, D3wp), so eng2 here is eng.
set -e
REPO=$1; W=$(cd ../.. && pwd)
for a in step1 step2; do rm -rf "$W/$a-app"; mkdir -p "$W/$a-app"; git -C "$REPO" archive HEAD | tar -x -C "$W/$a-app"; done
git -C "$REPO" show b4b283a:research/free-shape/round2/proto/engine.patch > "$W/step1.patch"
(cd "$W/step1-app" && git apply "$W/step1.patch")
(cd "$W/step2-app" && git apply "$REPO/research/free-shape/round2/proto/engine.patch")
mkdir -p h/data && cp ../harness/data/irf-r1.json h/data/
sed -e "s#import { PHASES } from '../phases/make-phases.mjs';#import { PHASES } from '../../phases/make-phases.mjs';#" \
    -e "s#export const FS2 = path.resolve(HERE, '..');#export const FS2 = path.resolve(HERE, '..', '..');#" \
    -e "s#export const PHASE_OPTS = { size: true, profile: 'lorentz',#export const PHASE_OPTS = { size: true, profile: process.env.PROTO_PROFILE || 'lorentz',#" \
    ../harness/lib.mjs > h/lib.mjs
cd h
node make-eng.mjs "$W/step1-app" && rm -rf eng0 && mv eng eng0
node make-eng.mjs "$W/step2-app"
for e in eng2 eng3 engxs; do rm -rf $e; cp -a eng $e; done
sed -i "s#  if (!(gain > (10 + dPmin\*Math.log(N))/2)){#  if (!process.env.PROTO_NOEARLY \&\& !(gain > (10 + dPmin*Math.log(N))/2)){#" engxs/xrd-rietveld.js
grep -q PROTO_NOEARLY engxs/xrd-rietveld.js
prof/mkhp.sh h0 eng0; prof/mkhp.sh h2 eng2; prof/mkhp.sh h3 eng3; prof/mkhp.sh hxs engxs
sed -i "s#methods, log: !opt.nolog });#methods, log: !opt.nolog, shape: opt.shape || null });#" hxs/run.mjs
node prof/make-prof.mjs eng0 prof/engp0 && node prof/make-prof.mjs && prof/mkhp.sh hp0 prof/engp0 && prof/mkhp.sh hp prof/engp
# then (README.md): node batch2.mjs jobs-sub.txt; node batch2.mjs jobs-screen.txt; xargs -P 3 -L 1 ./runxs.sh < jobs-xs.txt; ...
