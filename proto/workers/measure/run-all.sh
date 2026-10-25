#!/bin/sh
# Every measurement, one after the other (nothing else running meanwhile), each one's log in
# results/<name>.log beside its JSON; then the extrapolation (simulate.mjs) and the tables
# (summary.txt). The trees served first (README). Some 50 min on 4 CPUs.
cd "$(dirname "$0")"
R=../results
run(){ n=$1; shift; echo "== $n $(date -u +%H:%M:%S) load $(cut -d' ' -f1-3 /proc/loadavg)" | tee -a $R/run-all.log; "$@" > $R/$n.log 2>&1; s=$?; echo "   done $(date -u +%H:%M:%S) exit $s" | tee -a $R/run-all.log; }
run pool      node pool.mjs 5 head,1,2,3,4
run interact  node interact.mjs 12 head,1,2,3,4
run safety    node safety.mjs 5 3
run bench-heavy node bench.mjs heavy 1,2,3,4 5
run cores     sh cores.sh 5
run tabs      node tabs.mjs 5 bg,bgpool,live,livepool,livelocal
run std       node std.mjs 5 5
node simulate.mjs > $R/simulate.log 2>&1
node summary.mjs > $R/summary.txt 2>&1
