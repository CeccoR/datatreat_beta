#!/bin/sh
# the cross-solid fits without the minima stage (X2), then the mild shapes (M) and the nulls (N)
cd "$(dirname "$0")"
node batch5.mjs jobs-X2.txt --timeout 2400 > results/X2.out 2>&1
node batch5.mjs jobs-M.txt --timeout 2400 > results/M.out 2>&1
node batch5.mjs jobs-N.txt --timeout 2400 > results/N.out 2>&1
