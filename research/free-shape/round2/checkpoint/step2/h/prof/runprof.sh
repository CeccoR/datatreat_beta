#!/bin/sh
# prof/runprof.sh <harness dir> <out dir> <row>: one WPPM run (v2, 'briefs') with the timers, nice 15, timeout 1 h.
cd "$(dirname "$0")/.." || exit 1
[ -f "$2/$3.json" ] && exit 0
PROTO_PROFILE=wppm timeout 3600 nice -n 15 node $1/run.mjs --row $3 --method today --out $2/$3.json.part --quiet && mv $2/$3.json.part $2/$3.json
