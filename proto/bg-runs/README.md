# Background runs: a refinement that goes on in the tab left (backlog 23, option A, prototype)

A prototype, not implemented: nothing in the app's own files is changed. What is here: the
change as two patches against v517 (b93ed5c), `bg-runs.patch` (option A: a Rietveld run
goes on when its tab is left) and `bg-runs-pool.patch` on top of it (Refine all on several
workers at once, one pool for the whole page); the scripts that measured them against
today's app (`measure/`), their raw output (`results/`), the fixtures they read
(`fixtures/`). It is option (a) of BACKLOG.md's "Tabs that work while they are not on show";
option (b1), every tab a page of its own, is `proto/live-tabs/`.

## The answer

It works, it costs next to nothing while working, and it is small. Measured on this machine
(4 CPUs, Chromium 141 headless), 12 XRPD patterns, default settings:

- **Switching is today's**, run or no run: XRPD → XRPD 288 ms with nothing running (today
  284), 304 ms leaving a tab mid-run, 315 ms coming back to it and its run taken back by
  its card (today's 321 for the same transition idle); XRPD → SEM 133–140 ms (today 141).
  Today the first of these asks "Stop it and leave". No question now, no long task added.
- **A run left goes on at its full speed**: Refine all 6.9 s parked (another XRPD tab on
  show) and 7.2 s (a SEM tab of 8 big images on show), 6.9 s today on show. (7.5 s on show
  in the prototype: a parked run lets its worker go at its end, so the card's next run
  starts a new one, 0.6 s slower over its first patterns; a spare kept, or the pool, saves
  it.)
- **Results identical**, bit for bit (everything the worker gave, its times left out): 5 of
  5 runs parked, 5 of 5 left and taken back twice (B, A, B, A mid-run), every run of the
  speed measurements, against a run left on show.
- **Data safe**: at the run's end the parked state holds the 12 results, the parked history
  one step after the state the run started from (no hold left), the database record the 12
  at its first read after the end (5 of 5), the tab marked unsaved; shown again, one undo
  takes the run back and one redo brings it again. A reload mid-run brings back every
  result written so far (3 of 3, 5 of 5 times), unsaved, nothing running.
- **Several at once**: one worker a run, as today's cards. Two tabs refining parked: 8.1 s
  each (24 patterns in 9.6 s from the first click, today 2 × 6.9 s one after the other);
  three: 8.6 s each. The tab on show is barely slowed: the next sample 67 ms with one tab
  refining parked (65 with none), 77 ms with two; the smoothing change 139 ms with one
  (118 with none, 123 with the tab's own run on show).
- **The cost of a parked run** is its writes: each result patched into the parked state
  (under 1 ms) and the tab's record written (IndexedDB's clone of the state, 7 ms on
  average, at most 19 ms; 125 ms in all for 12 results), never a long task. The parked run
  takes less of the main thread than one on show (0.9 against 1.4 s), which draws.
- **Memory**: a worker per run going on (2 MB of heap after GC, some 20–25 MB of RSS at
  its peak), let go at its end; no other cost (a parked tab is parked as today).
- **The pool** (`bg-runs-pool.patch`): Refine all on 3 workers (the cores less one) 3.1 s
  on show and parked (today 6.9 s: 2.3×); two tabs at once 4.1 s each, the cap of 3 shared
  by both; results identical; table below for k = 1..4.

What it takes, to do for real: 2 to 3 working days, pool included (below). Option A does
what was asked of the "fallback" — leave a running tab, keep working, come back — and
switching stays as fast as today, which is 0.13–0.33 s here, not 1 s. It helps the Rietveld
alone: SEM's reading still asks before its tab is left (its module has no detach), and
switching is not faster. If those two matter, (b1) is the way (`proto/live-tabs/`: switches
2.5–3.5 times quicker, everything going on in every tab, at some 110 MB more a SEM tab of
8 images, 3–5 days); the pool goes with either.

## What the prototype is

`bg-runs.patch` (git diff against v517 b93ed5c; `git apply --check` clean):

| file | lines | what |
|---|---|---|
| xrd-rv.js | +239 −129 | the run an object of its own (go, job, halt, parkRun); the card a view of it (attach, detach); "Refine the standard first" a run that waits (pre) |
| tabs.js | +81 −12 | a parked tab's jobs (parkJobs): each result into its state, its record, its "*"; the end into its history; taken back on show; a spinner and progress on the tab; no question on a switch; a close asks and stops them |
| utils.js | +30 −7 | detach/attach in the busy registry; the history parked with the marks of the jobs that go on (getModuleHistory keep, setModuleHistory), releaseParked, releaseLive |
| xrd.js | +16 −5 | the module's detach and attach (every card's run and the standard's); runPatch reading the run's own files; host.id, host.patch |
| sessions.js | +4 −1 | a parked write counted as a change of that tab (a save in flight keeps it unsaved) |
| style.css | +10 | the tab's spinner and progress bar |
| tests/bgruns.test.mjs | +324 | 7 tests (1 min): below |
| tests/rvui.test.mjs | +13 −7 | C: another project opened mid-run asks nothing now; back on the tab, the run shown |
| tests/README.md | +2 −1 | |

How it works:

- **A run is an object of its own** (xrd-rv.js `go(run)`): its patterns, the phases,
  settings and profile it took as it started (as today), the results it starts from
  (`base`: payloadFor reads them, not the card's, which during a run nothing changes for a
  pattern not yet written: Clear and the phases are locked), what it wrote, its mark in the
  history, its worker, its files (whose headers its results go with). Up to v517 all of this
  was the card's closure, and the card instance serves every XRPD project in turn (cards.js
  keeps a card of the same id and kind), which is why leaving the tab had to stop it.
- **It writes through `run.to`**: the card's view while shown (results, plot, status,
  progress, Cancel: as today), a parked sink once its tab is left.
- **Leaving the tab** (tabs.js stashActive): the module hands its runs over
  (`detachModule`: every Rietveld card's and the standard's), the card is free and shows
  the next project; the tab's state is parked as today, its history with the runs' marks
  kept (`getModuleHistory(mod, true, keep)`), and each run parked with a sink of the tab.
- **A result while parked**: the tab's state patched by the same pure function a live
  run's end uses (xrd.js runPatch, the files' headers from the run's own files), a new
  object (nothing changes a parked state in place: db.js stored() caches by it), the tab
  marked unsaved and its record written (persistTab), so a reload keeps it.
- **The end while parked**: the mark released into the parked history by the UndoStack's
  own release (utils.js releaseParked: a throwaway stack over the parked states), so the
  history is what a run ended on show leaves: the results in every state above the mark and
  one step of their own after it. The worker is let go.
- **Back on the tab**: the state restored as today (with what was written), the history put
  back with its marks (setModuleHistory), and the module takes the runs back (`attachModule`):
  the card of the run's id shows it (Cancel, progress, rows locked, the Settings read only:
  what a step during a run keeps today). It ends there as any run on show.
- **Closing a parked tab while it refines** asks ("closing the tab stops it"), then stops
  it; deleting its project from Projects closes the tab and stops it; closing with Save
  shows the tab (the run taken back) and saves what was written so far. The Projects list's
  exports read the saved project, as today, never the tab. A reload ends the runs (their
  workers die) and keeps what they wrote.
- **"Refine the standard first"**: the sample's run waits for the standard's as a run that
  has not started its patterns (`pre`), so the chain goes on parked too: the standard's
  step, then the samples', in order, as on show.
- **Two tabs at once**: each run its own worker, as two cards today; nothing caps them
  without the pool.

`bg-runs-pool.patch`, on top (xrd-rv.js +117 −57; tests/rvpool.test.mjs +167, 4 tests;
undorun and bgruns take one lane, as their held answers assume, and rietveld.test.mjs for
its Cancel during a Refine all of two patterns, which two lanes end before it):

- One pool of workers for the page (every card, the standard, every tab's run), at most
  the cores less one (`localStorage['datatreat-rv-workers']`), idle ones let go after 2 min.
- Refine all runs its patterns on as many lanes (`datatreat-rv-lanes`, default the cap),
  each lane a pattern at a time; a run in another tab waits its turn for a worker (in order).
- Results are written in the patterns' order, each once those before it are, so that the
  results, the history, the record and the saved file are those of one lane, key order
  included. Cancel writes the patterns done (past those under way); an error stops the
  patterns not started and writes those under way.

## How to apply and run

```sh
git apply proto/bg-runs/bg-runs.patch          # clean on v517 (b93ed5c)
git apply proto/bg-runs/bg-runs-pool.patch     # optional, on top
node --test tests/bgruns.test.mjs tests/rvpool.test.mjs
```

The measurements compare copies of the tree, each on its own port (the scripts' defaults;
`HEAD_BASE`, `BG_BASE`, `POOL_BASE` change them):

```sh
R=$PWD D=/tmp/dt-bg; mkdir -p $D/head $D/bg $D/pool
git archive HEAD | tar -x -C $D/head
git archive HEAD | tar -x -C $D/bg && (cd $D/bg && git apply $R/proto/bg-runs/bg-runs.patch)
cp -a $D/bg/. $D/pool && (cd $D/pool && git apply $R/proto/bg-runs/bg-runs-pool.patch)
python3 -m http.server 8980 --bind 127.0.0.1 --directory $D/head &
python3 -m http.server 8981 --bind 127.0.0.1 --directory $D/bg &
python3 -m http.server 8982 --bind 127.0.0.1 --directory $D/pool &
proto/bg-runs/measure/run-all.sh        # some 40 min on 4 CPUs
node proto/bg-runs/measure/summary.mjs  # the tables, from results/*.json
```

Each script says at its head what it does; they run alone too (`node measure/speed.mjs bg
5`). Playwright is the global one (`/opt/node22/lib/node_modules/playwright`); the 8 SEM
TIFFs are made by tests/fixtures.mjs makeTiff into the system's temporary directory.

## Method

This machine: 4 CPUs, 16 GB, Linux; headless Chromium 141 through Playwright, viewport
1400 × 900, service workers blocked, nothing else running while timing (load average
0.7–2.5 during the runs, the measured app's own). Fixtures: the 12 XRDML scans s00–s11
(5384 points, 10–80°, tests/fixtures.mjs xrdml), the SrTiO3 CIF, a DRS spectrum, a GC run,
8 SEM TIFFs of 2048 × 2176, 16-bit. "XRPD tab": the 12 patterns, the CIF on card 2;
"refined": Refine all run to its end without the standard. Default settings throughout.
Today is HEAD (v517) on 8980, bg the patched tree on 8981, pool both patches on 8982.

- **Time**, in the page (`performance.timeOrigin + performance.now()`). A switch: from the
  click on the tab, dispatched in the page, to two animation frames once the module's
  loader is gone; long tasks by a PerformanceObserver. A run: from the click on "Refine
  without the standard" to its end seen (the card's button back to Refine on show; parked,
  the tab without jobs; polled every 20 ms), after Clear all. Medians of 5 (runs) or 7
  (switches), the raw values in the JSON.
- **Main thread**: CDP Performance.getMetrics' TaskDuration from the last switch to the
  runs' end (nothing else done meanwhile); every IndexedDB put timed where it is made (its
  structured clone), by wrapping IDBObjectStore.put in an init script.
- **Interaction**: in the XRPD tab on show (refined), alternately the next sample (→: both
  cards drawn) and the smoothing width of card 1 changed (12 patterns smoothed again, both
  cards drawn, a commit); from the event to two frames; 12 of each, 300 ms apart, only
  while every run of the condition goes on (a run ended is started again).
- **Memory**: after HeapProfiler.collectGarbage (twice), the page's JS heap, each worker's
  (Target.setAutoAttach), the renderer process's VmRSS (/proc); the RSS sampled every
  100 ms during the runs for the peak, without forced GC.
- **Results**: card 2's results, everything the worker gave less its times (`at`, `ms`),
  as JSON, hashed (lib.mjs resHash) and compared pattern by pattern with a run on show.

## Numbers

### Switching (click → tab painted, ms: median (p90), long tasks median ms; 7 each)

| transition | today | prototype |
|---|---|---|
| XRPD A → XRPD B, idle | 284 (291); 196 | 288 (303); 194 |
| XRPD B → SEM, idle | 141 (155); 0 | 133 (146); 0 |
| SEM → XRPD A, idle | 321 (366); 220 | 301 (367); 203 |
| XRPD A → DRS / DRS → GC / GC → XRPD A, idle | 169 / 154 / 169 | 183 / 164 / 155 |
| XRPD A → B, A refining (left mid-run) | asks to stop it | 304 (335); 204 |
| XRPD B → SEM, A refining parked | – | 140 (163); 0 |
| SEM → XRPD A, A refining (taken back) | – | 315 (389); 206 |

A switch is today's restore either way; the run's detach and attach add nothing
measurable. At each of the 7 rounds the run had written 2 results when left, 5–6 by the
time it was taken back, and ended with its 12 on show. Switching to an XRPD tab of 12
refined patterns took 0.16–0.17 s from a DRS or GC tab and 0.29–0.32 s from the other XRPD
tab or the SEM tab, in both trees: what the tab left costs to park counts as much as the
restore.

### A refinement where it runs (Refine all, 12 patterns; medians of 5)

| tree | case | each run | main thread during it | IndexedDB puts: n, ms, largest | long tasks |
|---|---|---|---|---|---|
| today | on show | 6.89 s | 1.25 s | 2, 16 ms, 9 ms | 57 ms |
| bg | on show | 7.52 s | 1.41 s | 2, 14 ms, 7 ms | 62 ms |
| bg | left for an XRPD tab | 6.89 s | 0.89 s | 18, 125 ms, 11 ms | none |
| bg | left for a SEM tab (8 images) | 7.23 s | 0.98 s | 18, 128 ms, 11 ms | none |
| bg | two tabs at once, a DRS tab on show | 8.14 s each, 9.65 s both | 1.16 s | 35, 253 ms, 17 ms | none |
| bg | three tabs at once | 8.62 s each, 12.4 s all | 1.52 s | 52, 367 ms, 16 ms | none |
| pool | on show | 3.06 s | 0.87 s | 0 | none |
| pool | left for an XRPD tab | 3.09 s | 0.61 s | 16, 107 ms, 13 ms | none |
| pool | left for a SEM tab | 3.22 s | 0.77 s | 16, 111 ms, 12 ms | none |
| pool | two tabs at once | 4.05 s each, 6.0 s both | 0.77 s | 34, 237 ms, 15 ms | none |
| pool | three tabs at once | 5.15 s each, 8.9 s all | 1.02 s | 52, 386 ms, 23 ms | none |

Every run's results identical to the first run on show's. "Both" and "all" count from the
first click, the other tabs' Clear all and Refine all clicked meanwhile (some 1.5 s each).
On show bg's 7.5 s against today's 6.9 s (7.0–7.8 against 6.6–7.2 s) is a new worker's:
each run on show there came after parked runs, which let their workers go at their end, so
the card made a new one, whose first patterns are slower (b14/map-runs: 7.77 s cold against
7.04 s warm); the parked run that began on the card's warm worker (left for an XRPD tab)
took 6.7–7.0 s, today's. The pool keeps its workers: no such cost. The puts are the tab's
record written at each result (12), plus the switches' own.

### Working in the tab on show (ms: median / p90 / max of 12)

| tree | while | next sample | smoothing change |
|---|---|---|---|
| today | nothing runs | 66 / 75 / 77 | 123 / 138 / 140 |
| today | its own Refine all, on show | 61 / 113 / 133 | 121 / 151 / 172 |
| bg | nothing runs | 65 / 75 / 110 | 118 / 135 / 136 |
| bg | its own Refine all, on show | 67 / 112 / 141 | 123 / 151 / 152 |
| bg | 1 tab refining parked | 67 / 78 / 84 | 139 / 157 / 174 |
| bg | 2 tabs refining parked | 77 / 100 / 114 | 138 / 178 / 199 |
| pool | its own Refine all (3 workers) | 72 / 103 / 107 | 134 / 183 / 197 |
| pool | 1 tab refining parked (3 workers) | 73 / 93 / 105 | 144 / 178 / 192 |
| pool | 2 tabs refining parked (3 workers) | 78 / 103 / 108 | 144 / 171 / 186 |

One parked run costs the tab on show about what its own run on show costs today; the
smoothing change, the heavier, takes 15 ms more (a parked result's record written, 7–11 ms,
falls in it now and then). With every core busy (two runs parked plus the page, or the pool's
three workers) the next sample goes 66 → 77 ms and the worst smoothing to some 200 ms.

### Memory (medians of 3; renderer RSS MB; 3 XRPD tabs and a DRS tab, no SEM)

| tree | runs going on | RSS after GC, during | RSS peak | workers alive / their heap | after the end: RSS, workers |
|---|---|---|---|---|---|
| today | none | 199 | 199 | 1 / 2.0 MB | 199, 1 |
| today | 1 on show | 208 | 245 | 1 / 2.6 MB | 202, 1 |
| bg | none | 213 | 213 | 0 | 212, 0 |
| bg | 1 parked | 217 | 236 | 1 / 1.9 MB | 206, 0 |
| bg | 2 parked | 235 | 266 | 2 / 4.3 MB | 211, 0 |
| bg | 3 parked | 260 | 284 | 3 / 6.3 MB | 214, 0 |
| pool | 1–3 parked | 253–256 | 253–302 | 3 / 6.4–7.8 MB | 201–213, 3 idle |

A parked run is a worker more while it runs (2 MB of heap after GC, some 20–25 MB of RSS at
its peak), let go at its end; the tab itself is parked as today. The pool keeps its workers
for 2 min after their last job: idle, 2 MB of heap each. Without a forced GC its three
long-lived workers keep more garbage: in the speed runs' page (with a SEM tab of 8 images)
the RSS peaks rose over the 5 rounds from 0.68 to 1.14 GB with the pool, 0.64–0.82 GB with
a worker a run.

### Data safety (bg and pool, 5 rounds each, the workers' real timing)

| what | bg | pool |
|---|---|---|
| left after its first result, ended parked: 12 results in the parked state, identical | 5/5 | 5/5 |
| its parked history: one step on top after the state it started from, no hold left | 5/5 | 5/5 |
| the database record at its first read after the end (66–97 ms a read): 12, identical, unsaved | 5/5 | 5/5 |
| shown: identical; one undo: none; one redo: identical | 5/5 | 5/5 |
| left and taken back twice (B after 1, A after 4, B after 6, A after 9): identical, its step | 5/5 | 5/5 |
| reloaded with 3 written parked: 3 in the record, 3 back, identical, unsaved, not running | 5/5 | 5/5 |

The tests (tests/bgruns.test.mjs, the workers' answers held) check the rest one result at
a time: nothing asked on leaving; the parked state, the record and the "*" after one
result; Cancel after it is taken back; two tabs at once; the close and the delete; the
exports; the reload; Refine the standard first left at once (two marks parked, the two
steps in order).

### The pool: Refine all on k workers (medians of 5; bg-runs-pool.patch)

| k workers | on show | parked | two tabs at once: each, both | main thread on show | renderer's high-water mark |
|---|---|---|---|---|---|
| 1 | 7.08 s | 6.93 s | 12.2 s, 14.0 s | 1.27 s | 457 MB |
| 2 | 3.92 s (1.8×) | 3.90 s | 6.18 s, 7.97 s | 1.00 s | 561 MB |
| 3 (the default here) | 3.18 s (2.2×) | 3.08 s | 4.29 s, 6.29 s | 0.94 s | 652 MB |
| 4 | 2.88 s (2.5×) | 2.82 s | 4.02 s, 5.68 s | 0.82 s | 740 MB |

A page of its own for each k (localStorage `datatreat-rv-workers`), three XRPD tabs and a
DRS tab; every run's results identical to k = 1's on show. The b14 bench gave 1.85, 2.61
and 2.54× for 2, 3, 4 workers on the same patterns: in the app the page's own thread takes
part of the fourth core. One worker for the whole page makes two tabs take turns (12.2 s
each, where a worker a run gives 8.1 s): the cap is the cores less one, not one. Each
worker adds some 100 MB to the renderer's high-water mark while the runs go on (garbage
not yet collected); after a forced GC each idle worker is 2 MB of heap and the renderer
199–221 MB, as with none.

## Limits

- **The Rietveld alone.** SEM's reading, the other long job, still asks before its tab is
  left: its busy guard has no detach (its worker's files join the module's list as they
  come; parked, they would have to be written into the tab's state, decoded images and
  all). Any later long job needs a detach and a sink of its own.
- **Switching is today's**: a restore, 0.13–0.33 s here for these tabs (the user's "1 s"
  is not reached), and a large XRPD or SEM project is felt as today.
- **A run does not survive a reload** or the window closed: its workers die. What it wrote
  is kept (each result in the record at once); the tab says nothing of the run stopped.
  The parked history, as today, does not survive a reload either.
- **Each parked result writes the tab's whole record** (its state's clone, 7–19 ms on the
  main thread, 1.6 MB of JSON for 12 patterns): fine at 0.6 s a pattern, 12 a run; a run
  of hundreds of fast patterns would want the writes gathered (below).
- **Several at once share the CPU**: on 4 CPUs two runs parked take 8.1 s each, three
  8.6 s (one alone 6.9 s); without the pool nothing caps the workers (one a run: three tabs
  refining, three workers; today two cards already do so). With the pool one cap holds for
  every tab: one realm (option A has one page), one pool.
- **On more cores** a run's own speed does not change (one worker a run); runs in several
  tabs scale to about the cores less one; the pool's Refine all to some min(k, cores − 1)
  × 0.85, until the 12 patterns' rounds (12/k) are the limit (b14/map-runs, measured on a
  bench: 2.5× on 3–4 workers here, 3.3× with heavy settings).
- **Not done in the prototype**: the run's last words ("From the CIF, no last result to
  start from…") are lost when it ends parked; the tab's progress bar is the runs' average;
  two windows of the app (each restores the same tabs: today's limit); the pool's status
  line lists the patterns under way, the stage of none.

## Optimisations

| what | measured | verdict |
|---|---|---|
| a run's worker its own, let go at its end (bg) | 0 workers once the runs end; the card's next run on a new worker, 0.6 s slower (7.5 against 6.9 s) | as built; one spare worker kept for the next card, or the pool, saves it |
| the pool: Refine all on 3 workers | 6.9 → 3.1 s on show and parked; two tabs 8.1 → 4.1 s each | worth it |
| the pool's workers kept 2 min idle | the next run warm; up to +0.3–0.4 GB of RSS before V8 collects | keep, with a shorter idle (30 s) where memory is short |
| a parked result: the state patched (not decoded and encoded again) | under 1 ms a result | as built |
| the record written at each result | 7 ms (≤ 19) a result, 125 ms a run of 12; a reload loses nothing written | as built; gathered every 2 s if runs ever have many fast patterns |
| results in the patterns' order with lanes | identical files, keys, history, as one lane | needed |
| one live tab per module (A0, not built) | – | would spare XRPD ↔ SEM restores; 1–2 days (b14/map-runs) |

## Effort, to do it for real

- **bg-runs, from this prototype**: 1.5–2 working days. Built: the run as an object, the
  detach/attach protocol, the parked writes and history, the close/delete/save cases, the
  standard's chain, 7 tests; the whole suite passes on the patched tree (190 of 190, the 7
  new among them, in 9.6 min: `results/suite-bg.log`). Left: a review of the names and
  words, RIETVELD.md §Jobs and the user's guide (a refinement goes on when its tab is left;
  closing stops it), the run's last words kept for the tab, a spare worker for the card's
  next run, the version and BACKLOG, tests of a parked run that fails and of the 80-state
  limit crossed while parked.
- **The pool**: 0.5–1 day more. Built: the pool, lanes, ordered writes, cancel and error,
  4 tests; the whole suite passes on the tree with both patches (194 of 194 in 9.9 min,
  `results/suite-pool.log`; its first run failed rietveld.test.mjs's Cancel, which two lanes
  outran: that test now takes one lane, 3 runs of 3 then). Left: the idle time and the default cap decided (memory above), the
  status line with lanes, heavy settings checked in the app (b14's bench: 3.3× on 4).
- **Against (b1)**, live tabs (`proto/live-tabs/`): 3–5 days; switching 2.5–3.5 times
  quicker and every module's work going on, at the memory of every tab kept live. The pool
  goes with either (in (b1) each tab is a realm of its own: a cap across tabs then needs
  Web Locks); the run object is what (a) needs and (b1) does not.

## Files

- `bg-runs.patch`, `bg-runs-pool.patch`: the change, against v517 (b93ed5c), the second on
  top of the first.
- `measure/lib.mjs`: fixtures, the browser, the steps, timing, memory, the results' hash.
  `switch.mjs`, `speed.mjs`, `interact.mjs`, `memory.mjs`, `safety.mjs`, `pool.mjs`: one
  measurement each; `run-all.sh` all of them; `summary.mjs` the tables.
- `results/`: each run's JSON and console log (`<name>-<head|bg|pool>.json`, `.log`),
  `run-all.log` (which ran when), `summary.txt`, the suites' logs on the patched trees
  (`suite-bg.log`; `suite-pool-first.log`, its one failure, and `suite-pool.log` after it
  was fixed).
- `fixtures/`: the 12 XRDML scans, the CIF, the DRS, GC and EPR files the scripts read.
