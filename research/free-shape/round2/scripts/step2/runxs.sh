#!/bin/sh
# runxs.sh <tag> <flags> <row> <solid>: a clean row searched as <solid> (WPPM, v2 'briefs', no early rejection),
# hxs/ (the frozen step-2 engine with PROTO_NOEARLY), nice 15, timeout 1 h; results/<tag>/<row>.<solid>.json.
cd "$(dirname "$0")" || exit 1
O=results/$1/$3.$4.json; [ -f "$O" ] && exit 0; mkdir -p results/$1
PROTO_NOEARLY=1 PROTO_PROFILE=wppm PROTO_LINE=lsq PROTO_SEARCH=v2 PROTO_FWD=briefs PROTO_WPPM=$2 timeout 3600 nice -n 15 node hxs/run.mjs --row $3 --shape $4 --method today --out $O.part --quiet && mv $O.part $O && echo "$1 $3 $4 ok" || echo "$1 $3 $4 FAILED"
