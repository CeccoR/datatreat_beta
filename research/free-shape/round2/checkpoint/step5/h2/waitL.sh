#!/bin/sh
cd "$(dirname "$0")"
while kill -0 $(cat ../h/results/chain.pid) 2>/dev/null; do sleep 20; done
node batch5.mjs jobs-L.txt --timeout 3600 > results/L.out 2>&1
