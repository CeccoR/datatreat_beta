#!/bin/sh
# After the main queue: the misfit cases (fix/cases-extra.mjs MISFIT) searched again at the background
# degree BIC picked from the refits (6, 12, 18), where the pick is above 6. Two at a time, nice -n 15.
F=$(cd "$(dirname "$0")" && pwd)
while [ ! -f "$F/queue.done" ]; do sleep 30; done
/opt/node22/bin/node "$F/tools/pick-list.mjs" "$F/root6/presentation/results/refit" > "$F/jobs2.txt"
xargs -P 2 -d '\n' -n 1 sh -c < "$F/jobs2.txt" > "$F/queue2.log" 2>&1
date > "$F/queue2.done"
