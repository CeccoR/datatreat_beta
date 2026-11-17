#!/bin/sh
# [fix] A second noise draw of the in-model floors (FS2A_INMODEL_SEED=draw2), two lanes.
cd "$(dirname "$0")/.." || exit 1
NODE=/opt/node22/bin/node
export FS2A_INMODEL_SEED=draw2
( $NODE batch.mjs --tag tr-im2-wppm --rows subclean --profile wppm --method truth --kernel inmodel --jobs 1 --timeout 2400 > results/tr-im2-wppm.out 2>&1
  $NODE batch.mjs --tag tr-im2-lor --rows subclean --method truth --kernel inmodel --jobs 1 --timeout 1800 > results/tr-im2-lor.out 2>&1 ) &
( FS2A_WPPM_BALL=1 $NODE batch.mjs --tag tr-im2-ball --rows subclean --profile wppm --method truth --kernel inmodel --jobs 1 --timeout 2400 > results/tr-im2-ball.out 2>&1 ) &
wait
echo done > results/fix-chain2.done
