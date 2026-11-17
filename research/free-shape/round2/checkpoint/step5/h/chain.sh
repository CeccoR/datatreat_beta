#!/bin/sh
# waits for the running X1 batch, then the mild shapes (M) and the nulls (N)
cd "$(dirname "$0")"
while pgrep -f "batch5.mjs jobs-X1.txt" > /dev/null; do sleep 20; done
node batch5.mjs jobs-M.txt --timeout 2400 > results/M.out 2>&1
node batch5.mjs jobs-N.txt --timeout 2400 > results/N.out 2>&1
