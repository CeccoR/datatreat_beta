#!/bin/sh
cd "$(dirname "$0")"
until grep -q "jobs-L.txt: done" results/batch5.log 2>/dev/null; do sleep 20; done
node batch5.mjs jobs-F.txt --timeout 3600 > results/F.out 2>&1
