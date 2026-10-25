#!/bin/sh
# The limit's runs, one at a time (each a browser of its own), the machine otherwise idle.
# Trees served first (see lim-lib.mjs: LIM_B2, LIM_HEAD, LIM_B1, each with fx/ from lim-fx.mjs
# and MAX_TABS 32). Each run's console goes to results/lim-<tree>-<kind>[-policy].log.
# sh lim-run.sh [run …]   a run is tree:kind[:policy[:Ns]], e.g. b2:mix:default
# With no run named, the ones ASSESSMENT.md reports, in the order they ran, then the
# background's jobs, b2 with no trim (LIM_TAG=nt at LIM_B2_NT, a copy with TRIM_MS 1e9) and
# the summary (results/lim-summary.json and .txt).
cd "$(dirname "$0")"
R=../results
all=
if [ $# -eq 0 ]; then
  all=1
  S=0,1,4,8,16,24
  set -- b2:xrd b2:xrdrun b2:sem b2:mix b2:mix:default head:xrd:awake:$S head:sem:awake:$S head:mix:awake:$S \
    b1:xrd:awake:$S b1:sem:awake:$S b1:mix:awake:$S b1:xrdrun:awake:$S
fi
run(){
  for run in "$@"; do
    IFS=: read -r tree kind policy ns <<EOF
$run
EOF
    name=lim-$tree$LIM_TAG-$kind; [ -n "$policy" ] && [ "$policy" != awake ] && name=$name-$policy
    echo "== $LIM_TAG $run $(date -u +%H:%M:%S) load $(cut -d' ' -f1-3 /proc/loadavg)"
    node lim-series.mjs "$tree" "$kind" "${policy:-awake}" $ns > "$R/$name.log" 2>&1
    tail -n 3 "$R/$name.log"
  done
}
run "$@"
if [ -n "$all" ]; then
  node lim-bgjobs.mjs > "$R/lim-b2-bgjobs.log" 2>&1
  (export LIM_TAG=nt LIM_B2="${LIM_B2_NT:-http://127.0.0.1:8963}"; run b2:xrd:awake:$S b2:sem:awake:$S)
  node lim-summary.mjs > "$R/lim-summary.txt" 2>&1
fi
