#!/bin/sh
# Line counts behind the inventory's figures that scan.json does not hold: document-level
# lookups per module file, data-csv-mod keys, and the tests' module-id selectors, all read
# from HEAD (git show / git grep: the working tree is not looked at).
# sh proto/map/singletons/counts.sh > proto/map/singletons/counts.txt   (from the repo root)
echo "HEAD $(git rev-parse --short HEAD)"
echo "file getElementById document.querySelector data-csv-mod (lines)"
t1=0; t2=0; t3=0
for f in tauc.js xrd.js xrd-peaks.js xrd-rv.js gc.js epr.js sem.js modkit.js; do
  a=$(git show HEAD:$f | grep -c 'getElementById'); b=$(git show HEAD:$f | grep -c 'document\.querySelector')
  c=$(git show HEAD:$f | grep -c 'data-csv-mod')
  echo "$f $a $b $c"; t1=$((t1 + a)); t2=$((t2 + b)); t3=$((t3 + c))
done
echo "module files, in all: $t1 $t2 $t3 (lookups $((t1 + t2)))"
for f in plot.js cards.js; do echo "$f $(git show HEAD:$f | grep -c 'getElementById') $(git show HEAD:$f | grep -c 'document\.querySelector')"; done
echo "index.html data-csv-mod: $(git show HEAD:index.html | grep -c 'data-csv-mod')"
echo "test files: $(git ls-tree --name-only HEAD tests/ | grep -c 'test\.mjs$')"
echo "test lines with a module-id selector (#tauc… #xrd… #gc… #epr… #sem… #tab-…): $(git grep -c -E '#(tauc|xrd|gc|epr|sem|tab-)[A-Za-z0-9-]*' HEAD -- 'tests/*.mjs' | awk -F: '{s += $3} END {print s}')"
echo "test lines importing ./utils.js in the page: $(git grep -c -E "import\('\./utils\.js'\)" HEAD -- 'tests/*.mjs' | awk -F: '{s += $3} END {print s}')"
