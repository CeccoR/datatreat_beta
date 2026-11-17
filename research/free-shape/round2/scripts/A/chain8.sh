#!/bin/bash
# After screen-wppm's resumed batch ends: the cross-solid fits with the (b) lsq line (xs-lsq).
cd "$(dirname "$0")" || exit 1
while pgrep -f "batch.mjs --tag screen-wppm" > /dev/null; do sleep 30; done
FS2A_NOEARLY=1 timeout 5400 /opt/node22/bin/node batch.mjs --tag xs-lsq --rows subclean --shapes all --line lsq --method today --timeout 2400 > results/xs-lsq.out 2>&1
echo done > results/chain8.done
