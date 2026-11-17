#!/bin/sh
cd "$(dirname "$0")"
echo $$ > results/chain.pid
until grep -q "jobs-X2a.txt: done" results/batch5.log; do sleep 15; done
node fam5.mjs --min 4 --json fam5.json > /dev/null && node fboot-jobs.mjs > jobs-FB.txt
for j in FB M N X2b; do node batch5.mjs jobs-$j.txt --timeout 2400 > results/$j.out 2>&1; done
