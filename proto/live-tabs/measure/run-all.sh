#!/bin/sh
# Every measurement, one after the other (the machine otherwise idle), each one's console in
# results/<name>.log and its numbers in results/<name>.json. Some 2.5 hours on 4 CPUs.
# The servers first (README): HEAD on 8971, the patched tree on 8972, with the lean patch
# too on 8973. SKIP_MEMORY=1, SKIP_CEILING=1, SKIP_LEAN=1 leave those parts out.
cd "$(dirname "$0")" || exit 1
R=../results
run(){ name=$1; shift; echo "== $name: node $*"; timeout 3600 node "$@" > "$R/$name.log" 2>&1; echo "   exit $?"; }
if [ -z "$SKIP_MEMORY" ]; then
  for s in empty xrd sem; do for m in head live; do run "memory-$m-$s" memory.mjs $m $s; done; done
fi
run switch-head switch.mjs head 7
run switch-live switch.mjs live 7
run switch-live-visibility switch.mjs live 7 visibility
run open-head open.mjs head 5
run open-live open.mjs live 5
run interaction-head interaction.mjs head 9
run interaction-live interaction.mjs live 9
run refine-speed-head refine.mjs speed head 5
run refine-speed-live refine.mjs speed live 5
run refine-speed-live-visibility refine.mjs speed live 5 visibility
run refine-concurrent refine.mjs concurrent 3 4
run boot-head-4 boot.mjs head 4 5
run boot-live-4 boot.mjs live 4 5
run boot-head-8 boot.mjs head 8 5
run boot-live-8 boot.mjs live 8 5
run opt-free opt.mjs free 5
run opt-max opt.mjs max 3
run limits limits.mjs
run opt-idle-head opt.mjs idle head
run opt-idle-live opt.mjs idle live
run opencold-head opencold.mjs head 5
run opencold-live opencold.mjs live 5
run sw sw.mjs
# The memory ceiling: SEM tabs (8 images each) up to MAX_TABS, 20 (~15 min each)
if [ -z "$SKIP_CEILING" ]; then
  ( export TAG=ceiling
    run memory-head-sem-ceiling memory.mjs head sem 8,12,16,20
    run memory-live-sem-ceiling memory.mjs live sem 8,12,16,20 )
fi
# Lean frames (live-tabs-lean.patch on top: a tab's page loads its own module alone), a third
# server on 8973.
if [ -z "$SKIP_LEAN" ]; then
  ( export LIVE_BASE=${LEAN_BASE:-http://127.0.0.1:8973} TAG=lean
    run memory-live-empty-lean memory.mjs live empty
    run memory-live-xrd-lean memory.mjs live xrd 1,2,4
    run open-live-lean open.mjs live 5
    run opencold-live-lean opencold.mjs live 5
    run boot-live-4-lean boot.mjs live 4 5 )
fi
