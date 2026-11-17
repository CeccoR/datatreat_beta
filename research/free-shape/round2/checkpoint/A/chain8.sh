#!/bin/bash
# After screen-wppm's resumed batch ends: the cross-solid fits with the (b) lsq line (xs-lsq).
cd /tmp/claude-0/-home-user-datatreat-beta/51d5ad4e-64c4-51d8-8fdc-0e18be5b5240/scratchpad/fs2/A
while pgrep -f "batch.mjs --tag screen-wppm" > /dev/null; do sleep 30; done
FS2A_NOEARLY=1 timeout 5400 /opt/node22/bin/node batch.mjs --tag xs-lsq --rows subclean --shapes all --line lsq --method today --timeout 2400 > results/xs-lsq.out 2>&1
echo done > results/chain8.done
