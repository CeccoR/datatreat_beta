#!/bin/sh
# job.sh <tag> <line> <search> <row>: one run into results/<tag>/<row>.json (nice 15)
D=$(dirname "$0"); mkdir -p "$D/results/$1"
[ -s "$D/results/$1/$4.json" ] && exit 0
PROTO_LINE=$2 PROTO_SEARCH=$3 nice -n 15 node "$D/run.mjs" --row "$4" --method today --quiet --out "$D/results/$1/$4.json" > "$D/results/$1/$4.log" 2>&1 || echo "FAIL $1 $4" >> "$D/results/fail.txt"
