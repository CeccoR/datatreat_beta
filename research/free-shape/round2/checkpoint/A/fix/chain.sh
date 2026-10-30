#!/bin/sh
# [fix] After fix/time.mjs: the noise-free separations (fix/shapesep.mjs) and the in-model floors
# (batch.mjs --kernel inmodel), two lanes, one process each, nice 15, each step with a timeout.
cd "$(dirname "$0")/.." || exit 1
NODE=/opt/node22/bin/node
until grep -q "time: done" results/time/time.log 2>/dev/null; do sleep 30; done
lane1() {
  FS2A_PROFILE=wppm timeout 5400 nice -n 15 $NODE fix/shapesep.mjs --data inmodel --out results/shapesep-inmodel-wppm.json > results/shapesep-inmodel-wppm.out 2>&1
  FS2A_PROFILE=wppm timeout 5400 nice -n 15 $NODE fix/shapesep.mjs --data exact --out results/shapesep-exact-wppm.json > results/shapesep-exact-wppm.out 2>&1
  timeout 3600 nice -n 15 $NODE fix/shapesep.mjs --data inmodel --out results/shapesep-inmodel-lor.json > results/shapesep-inmodel-lor.out 2>&1
  timeout 3600 nice -n 15 $NODE fix/shapesep.mjs --data exact --out results/shapesep-exact-lor.json > results/shapesep-exact-lor.out 2>&1
  $NODE batch.mjs --tag tr-im-lor --rows subclean --method truth --kernel inmodel --jobs 1 --timeout 1800 > results/tr-im-lor.out 2>&1
  echo done > results/fix-lane1.done
}
lane2() {
  FS2A_PROFILE=wppm FS2A_WPPM_BALL=1 timeout 5400 nice -n 15 $NODE fix/shapesep.mjs --data inmodel --out results/shapesep-inmodel-ball.json > results/shapesep-inmodel-ball.out 2>&1
  $NODE batch.mjs --tag tr-im-wppm --rows subclean --profile wppm --method truth --kernel inmodel --jobs 1 --timeout 2400 > results/tr-im-wppm.out 2>&1
  FS2A_WPPM_BALL=1 $NODE batch.mjs --tag tr-im-ball --rows subclean --profile wppm --method truth --kernel inmodel --jobs 1 --timeout 2400 > results/tr-im-ball.out 2>&1
  FS2A_LINE=lsq timeout 3600 nice -n 15 $NODE fix/shapesep.mjs --data exact --out results/shapesep-exact-lsq.json > results/shapesep-exact-lsq.out 2>&1
  echo done > results/fix-lane2.done
}
lane1 & lane2 & wait
