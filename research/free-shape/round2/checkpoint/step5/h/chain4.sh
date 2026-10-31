#!/bin/sh
cd "$(dirname "$0")"
echo $$ > results/chain.pid
for j in FB M N X2b; do node batch5.mjs jobs-$j.txt --timeout 2400 > results/$j.out 2>&1; done
