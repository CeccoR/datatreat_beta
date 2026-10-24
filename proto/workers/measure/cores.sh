#!/bin/sh
# The grid of cores × workers: bench.mjs (default settings) run with the browser held to the
# first n CPUs (taskset; navigator.hardwareConcurrency then reads n), n = 1..4, k = 1..n+1
# workers, REPS runs each after a warm-up → results/bench-default-cpus<n>.json.
# sh cores.sh [reps, default 5]
cd "$(dirname "$0")"
R=${1:-5}
TAG=cpus1 taskset -c 0 node bench.mjs default 1,2 "$R"
TAG=cpus2 taskset -c 0-1 node bench.mjs default 1,2,3 "$R"
TAG=cpus3 taskset -c 0-2 node bench.mjs default 1,2,3,4 "$R"
TAG=cpus4 taskset -c 0-3 node bench.mjs default 1,2,3,4,5,6,8 "$R"
