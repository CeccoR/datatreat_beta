#!/bin/sh
# Every measurement, one after the other (nothing else running meanwhile), each one's output
# in results/<name>.log beside its JSON. Servers as the README says: HEAD on 8980, bg-runs on
# 8981, bg-runs + pool on 8982 (HEAD_BASE, BG_BASE, POOL_BASE change them).
# REPS, NINT: the repetitions (default 7 switches, 5 runs, 12 interactions, 3 memory).
cd "$(dirname "$0")"
R=../results
mkdir -p $R
run(){ name=$1; shift; echo "$(date -u +%H:%M:%S) $name: node $*" | tee -a $R/run-all.log; node "$@" > $R/$name.log 2>&1; echo "$(date -u +%H:%M:%S) $name: exit $?" | tee -a $R/run-all.log; }
run switch-head  switch.mjs head ${REPS_SW:-7}
run switch-bg    switch.mjs bg ${REPS_SW:-7}
run speed-head   speed.mjs head ${REPS:-5}
run speed-bg     speed.mjs bg ${REPS:-5}
run speed-pool   speed.mjs pool ${REPS:-5}
run interact-head interact.mjs head ${NINT:-12}
run interact-bg   interact.mjs bg ${NINT:-12}
run interact-pool interact.mjs pool ${NINT:-12}
run memory-head  memory.mjs head ${REPS_MEM:-3}
run memory-bg    memory.mjs bg ${REPS_MEM:-3}
run memory-pool  memory.mjs pool ${REPS_MEM:-3}
run safety-bg    safety.mjs bg ${REPS:-5}
run safety-pool  safety.mjs pool ${REPS:-5}
run pool         pool.mjs ${REPS:-5} 1,2,3,4
