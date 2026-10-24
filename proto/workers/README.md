# Several workers at once: the Rietveld pool (backlog 23, prototype)

A prototype, not implemented: nothing in the app's own files is changed. What is here: the
change as patches against v517 (b93ed5c) — `pool.patch` (the pool, on HEAD alone or on top
of `proto/live-tabs/live-tabs.patch`, option b1) and `pool-on-bg-runs.patch` (the same pool
on top of `proto/bg-runs/bg-runs.patch`, option A, in place of that folder's
`bg-runs-pool.patch`) —; the bench page that runs the pool's own code without the card
(`bench/`); the scripts that measured it (`measure/`), their raw output (`results/`), the
fixtures they read (`fixtures/`). It answers the "several workers at once" of BACKLOG.md's
"Tabs that work while they are not on show", which both options want.

## The answer

Worth it, with either option, and small: one new module of 183 lines and Refine's loop in
`xrd-rv.js` (+59 −56), no other module touched. Measured on this machine (4 CPUs, Chromium
141 headless), the 12 XRPD patterns:

- **Refine all in the app**: 7.23 s today → 4.13 s on 2 workers, **2.92 s on 3 (2.47×)**,
  2.85 s on 4 (2.54×). With heavy settings (a free ellipsoid, ΔB, an occupancy, the
  standard's profile; on the bench, the same pool code): 54.2 s → 28.4 s on 2, **20.2 s on 3
  (2.68×)**, 16.4 s on 4 (3.32×). Longer jobs scale better: the user's real ones (tens of
  seconds a pattern) are nearer the heavy line.
- **The same results, bit for bit**, every run at every k and in every tree (everything the
  worker gives, its times left out), written in the patterns' order (the results' keys, the
  history's step, the saved file as one worker makes them). Progress never goes back; the
  status names the patterns under way. Cancel stops in 38 ms and keeps every pattern done;
  the history is v509's: one step after the state the run started from, the steps taken
  meanwhile after it, undo and redo right (5 of 5 rounds at the workers' real speed, and
  the tests with held answers).
- **Its cost**: no more CPU (8.65 s a Refine all on 3 workers, 8.98 s today: the same work
  on more cores); memory, an idle worker 2 MB of heap and 8–15 MB of RSS after GC, a running
  one 15–30 MB more at its peak (the renderer's peak 299 MB today, 362 MB on 3 workers); the
  first run of a session is slower (4.25 s on 3 workers, each compiling the engine), and
  making the workers ahead of it does not help (measured). The UI: the next sample is not
  slowed (53–71 ms, today 70), the heaviest interaction (the smoothing changed: 12 patterns
  again, both cards drawn) 130 ms median today during a run, 154 ms on 3 workers, **179 ms
  on 4**: the page needs its core. No long task added.
- **Several tabs at once** (2 and 3 XRPD tabs refining together, 4 CPUs):

  | each run, all of them | 1 tab | 2 tabs | 3 tabs |
  |---|---|---|---|
  | A, a worker a run (bg-runs) | 7.5 s | 8.8 s, 9.9 s | 10.0 s, 12.0 s |
  | A + pool (cap 3 shared) | **3.3 s** | **5.3 s**, 6.4 s | **7.1 s**, 9.3 s |
  | b1, a worker a run (live-tabs) | 7.1 s | 7.4 s, 7.5 s | 8.1 s, 8.3 s |
  | b1 + pool, cap 3 shared by Web Locks | **3.0 s** | **5.6 s**, 5.8 s | 8.1 s, 8.7 s |
  | b1 + pool, cap 3 per frame (up to 9 workers) | 3.1 s | 5.4 s, 5.5 s | 7.5 s, 7.5 s |

  (A's tabs are started one after the other, 1 s apart, b1's at once.) Three runs fill the 4
  cores whatever the workers: the pool gives a run alone 2.3–2.4×, and runs at once share the
  cores. Every run's results identical to today's.
- **The standard alongside the samples**: the reason written in xrd.js ("a batch takes one
  instrumental profile throughout") no longer needs the guard: since v477 every run takes
  the profile as it starts. What still holds is the dependency itself: the samples need the
  standard's result. With the guard lifted (a measurement-only tree), the samples refined
  while another standard file refined came out stale, all 12 in each of 5 rounds, the card
  saying "The standard has been refined again since this result": work to redo. Keep the
  guard; better, a sample's Refine pressed while the standard refines could wait for it as
  "Refine the standard first" does. That chain on the pool: 6.47 s today → **3.22 s**.
- **More cores** (a model fitted on 1, 2, 3 and 4 CPUs, within ±10 % of every measured point
  but two oversubscribed ones; heavy within 3 %): on 8 cores (7 workers) Refine all 3.1–5.1×
  (default) and 4.4–5.8× (heavy) faster than today; on 16 (12 workers, one each) 4.1–8.8×
  and 7.0–11×. The range is the contention between workers (shared caches and memory), as
  measured here (the lower) or none (the higher). The 12 patterns come in rounds: from 6 to
  11 workers two rounds, from 12 one.
- **The cap**: `navigator.hardwareConcurrency − 1`, at least 1, for the whole browser (every
  window and every live tab's frame through Web Locks; tested), the page's own thread keeping
  a core. A knob (`localStorage 'datatreat-rv-workers'`) changes it.

What it takes, to do for real: about a day on top of either option (below). The whole suite
passes on HEAD + `pool.patch` (187 of 187, the 4 new among them, 9.5 min) and on bg-runs +
`pool-on-bg-runs.patch` (195 of 195, 10.3 min; `results/suite-*.log`); on live-tabs +
`pool.patch` the live mode's test and the pool's pass.

## What the pool is

`xrd-rv-pool.js` (new) holds the workers of the page and the cap of jobs at once;
`xrd-rv.js` runs Refine's patterns through it instead of the card's own worker. Nothing else
changes: the run, its hold and release of the history, the guard between the standard and
the samples, the card's panel are v517's.

- **A job** is one pattern in one worker: `xrd-rietveld.worker.js` runs a message to its end,
  so k patterns at once take k workers. A job waits for a slot, then takes an idle worker of
  its page or makes one; at its end the worker goes back idle (warm: its code compiled, its
  caches kept) and the slot is free. Cancel terminates the worker (the only way to stop the
  engine mid-job) and frees the slot.
- **The slots** are the cap for the whole browser: Web Locks named `datatreat-rv-slot-0` …
  `cap − 1` (`navigator.locks`: one origin's, shared by every window and every frame of it;
  a page closed or a frame removed lets its locks go). A job asks for all of them at once and
  takes the first it is given, withdrawing the others: the job that has waited longest gets
  the first slot freed, whichever page or frame it is in, so runs in several tabs take turns
  pattern by pattern. Without Web Locks (not a secure context) the cap holds per page.
- **Workers** are per page (a realm cannot post to another's worker): made when a job wants
  one, kept idle 60 s, then terminated with the engine's caches.
- **Lanes**: Refine all's n patterns go on `min(n, lanes)` lanes, each taking the next
  pattern (its payload built as it is taken, in the patterns' order, as one lane builds it),
  waiting for a slot, refining it. The results are written in the patterns' order, each once
  those before it are (one done early waits): the card's results, the run's `wrote` (the
  history's step), and so the saved file and its key, are those of one lane, key order
  included. Progress is (done + the fractions of those under way)/n, never going back; the
  status says "Refining s07, s08, s09… (7 of 12 done)", and one pattern under way its stages
  as today.
- **Cancel** cancels every job under way (their workers terminated, nothing of their answers
  after) and writes at once, in order, those done behind one under way, before the run ends
  and releases its hold: a run cancelled keeps every pattern finished.
- **An error** in a job stops the patterns not taken; those under way end and are written;
  the failed one is not; the run ends saying the error, as today.
- **Knobs**, localStorage `datatreat-rv-<k>`, read once as the first job asks: `workers` (the
  cap; default the cores less one), `lanes` (a run's at most; default the cap; 1 = today's
  one after the other), `shared` (`off`: the cap per page), `idle` (seconds an idle worker is
  kept, 60).

`pool.patch` (git diff against v517 b93ed5c; `git apply --check` clean on HEAD, on HEAD +
live-tabs.patch, and on HEAD + live-tabs.patch + live-tabs-lean.patch):

| file | lines | what |
|---|---|---|
| xrd-rv-pool.js | +183 (new) | the slots (Web Locks, or per page), the page's workers, `job`, `lanes`; `warm`, `poolNow`, `poolCfg` for the measurements (the app calls `lanes` alone; `warm` can go) |
| xrd-rv.js | +59 −56 | Refine's loop on `lanes` (payload, ordered write, progress and status); Cancel stops the lanes; the card's worker gone |
| sw.js | +1 | the new file in ASSETS (the cache's version is the release's to bump) |
| tests/rvpool.test.mjs | +183 (new) | 4 tests (25 s): below |
| tests/undorun.test.mjs, tests/rietveld.test.mjs | +2 each | one lane: their held answers and their Cancel assume one pattern at a time |
| tests/README.md | +1 | |

`tests/rvpool.test.mjs`, the workers' answers held and delivered by the test: three lanes
give the results of one, bit for bit, in the patterns' order, one step; the status names the
patterns under way; an answer out of order waits for those before it; Cancel writes the
patterns done and not those under way (s01 done past s00 under way, too); an error in one lane
stops the patterns not started and writes those under way; two windows of the app on a cap of
two run two jobs at once in all, the slot freed going to the job that waited longest (with
`shared` off the same test fails: each window runs two).

`pool-on-bg-runs.patch`, on top of bg-runs.patch: the same `xrd-rv-pool.js`; bg-runs's run
(`go`) on `lanes`, `halt` stopping them, the run's own worker gone (+64 −70 in xrd-rv.js); its
tests as bg-runs-pool.patch's (bgruns, undorun, rietveld on one lane) plus rvpool's five
(the four above and two parked tabs refining at once on a cap of two: two workers in all). It
replaces bg-runs-pool.patch, whose inline pool caps within the page only.

## How to apply and run

```sh
git apply proto/workers/pool.patch                          # on v517 (b93ed5c), alone
#   or after option b1:
git apply proto/live-tabs/live-tabs.patch && git apply proto/workers/pool.patch
#   or after option A:
git apply proto/bg-runs/bg-runs.patch && git apply proto/workers/pool-on-bg-runs.patch
node --test tests/rvpool.test.mjs                           # the pool's tests (25 s)
```

The measurements compare copies of the tree, each on its own port (lib.mjs; `<NAME>_BASE`
changes one; `BENCH`, `NOBLOCK_BASE` the bench's and the guard-lifted tree's):

```sh
R=$PWD D=/tmp/dt-workers P=$R/proto
for t in head pool live livepool bg bgpool; do mkdir -p $D/$t; git archive HEAD | tar -x -C $D/$t; done
(cd $D/pool && git apply $P/workers/pool.patch)
(cd $D/live && git apply $P/live-tabs/live-tabs.patch)
(cd $D/livepool && git apply $P/live-tabs/live-tabs.patch && git apply $P/workers/pool.patch)
(cd $D/bg && git apply $P/bg-runs/bg-runs.patch)
(cd $D/bgpool && git apply $P/bg-runs/bg-runs.patch && git apply $P/workers/pool-on-bg-runs.patch)
# measurement only: the pool with the guard between the standard and the samples lifted
cp -a $D/pool $D/noblock
sed -i "s/blocked: ()=> rvCards().some(i=> i.running()) ? .*' : '',/blocked: ()=> '',/; s/blocked: ()=> stdRv.running() ? .*' : '',/blocked: ()=> '',/" $D/noblock/xrd.js
mkdir -p $D/pool/bench && cp $P/workers/bench/* $D/pool/bench/ && cp -r $P/workers/fixtures $D/pool/bench/
i=0; for t in head pool live livepool bg bgpool noblock; do
  python3 -m http.server $((8970+i)) --bind 127.0.0.1 --directory $D/$t & i=$((i+1)); done
proto/workers/measure/run-all.sh        # some 50 min on 4 CPUs, nothing else running
```

`run-all.sh` ends with `simulate.mjs` (the model, from the grid's JSON) and `summary.mjs` (the
tables, `results/summary.txt`). Each script says at its head what it measures and how; each
runs alone too (`node measure/pool.mjs 5 head,3`). Playwright is the global one
(`/opt/node22/lib/node_modules/playwright`). These commands rebuild exactly the trees that
were measured (checked file by file; `pool.patch`'s xrd-rv.js was re-wrapped in two
comments after the runs, its code unchanged).

## Method

This machine: 4 vCPUs (Intel Xeon 2.1 GHz, KVM, 1 thread a core as the guest sees it), 16 GB,
Linux; headless Chromium 141 through Playwright 1.56, viewport 1400 × 900, service workers
blocked; one measurement at a time, nothing else running (load average 0.7–5.6, the measured
browser's own). Fixtures: the 12 XRDML scans s00–s11 (5384 points, 10–80°), the SrTiO3 CIF,
a DRS spectrum; the standard s11 with SrTiO3 chosen as its phase (as tests/rvlock does: a
profile to time, not to read). Default settings unless "heavy" (the bench: a free ellipsoid,
ΔB, Sr1's occupancy, the standard's profile).

- **A run's time**, in the page (`performance.timeOrigin + performance.now()`): from the click
  on "Refine without the standard" to the card's button back to Refine (A, parked: its tab
  without jobs; b1: in its frame), polled every 20 ms, after Clear all. Medians of 5 runs
  after a first (cold) one; the bench: from the first payload to the last result written.
- **CPU**: the renderer process's utime + stime (`/proc/<pid>/stat`, every thread, those ended
  too), its main thread's and its DedicatedWorker threads' (`/proc/<pid>/task`), over each
  run. The main thread's busy time also from CDP (`Performance.getMetrics` TaskDuration).
- **Memory**: after `HeapProfiler.collectGarbage` (twice), the page's heap and each worker's
  (`Target.setAutoAttach`), the renderer's VmRSS (`/proc`; the workers and same-origin frames
  live in it); the RSS sampled every 100 ms during a run, without GC, for the peak.
- **The UI**: long tasks by a PerformanceObserver in every realm; in the XRPD tab on show,
  alternately the next sample (→: both cards drawn) and the smoothing width changed (the 12
  patterns smoothed again, both cards drawn, a commit), from the event to two animation
  frames, 12 of each, 300 ms apart, only while the run goes on. On the bench, a fixed 10 ms
  piece of work every 200 ms on the main thread, its duration.
- **Results**: everything the worker gave (its times `at`, `ms` left out), as JSON, hashed and
  compared with HEAD's first run; their keys against the patterns' order; on the bench the
  signatures (params, esd, stats, CSV table, widths, shapes) against k = 1's, pattern by
  pattern.
- **Cores**: the bench run with the browser held to 1, 2, 3, 4 CPUs (`taskset`; Chromium's
  `navigator.hardwareConcurrency` then reads 1, 2, 3, 4) for k = 1 … n + 1 workers (and 6, 8
  on 4).
- "b14/map-runs" is the step before the prototypes that mapped the runs and benched the
  worker alone (its numbers are quoted in proto/bg-runs and proto/live-tabs too); its bench
  gave the same speed-ups as this one (2.61× on 3, heavy 3.31× on 4).

## Numbers

### 1. Refine all on k workers, in the app (pool.mjs; medians of 5)

| k | wall | vs today | first run (cold) | CPU: all / workers / main | cores busy | long tasks: ms a run (longest) | RSS idle after GC, worker heaps | RSS peak | identical, in order, progress |
|---|---|---|---|---|---|---|---|---|---|
| today (1) | 7.23 s | 1× | 7.20 s | 8.98 / 6.72 / 1.30 s | 0.93 | 76 ms (81) | 184 MB, 2.1 MB | 299 MB | yes, yes, yes |
| 1 | 7.07 s | 1.02× | 7.83 s | 8.82 / 6.49 / 1.35 s | 0.92 | 78 ms (90) | 185 MB, 2.1 MB | 309 MB | yes, yes, yes |
| 2 | 4.13 s | 1.75× | 5.06 s | 9.37 / 7.08 / 1.02 s | 1.71 | 0 (59) | 200 MB, 2 × 2.0 MB | 368 MB | yes, yes, yes |
| **3** | **2.92 s** | **2.47×** | 4.25 s | 8.65 / 7.04 / 0.79 s | 2.41 | 0 (63) | 209 MB, 3 × 2.0 MB | 362 MB | yes, yes, yes |
| 4 | 2.85 s | 2.54× | 4.19 s | 9.18 / 7.15 / 0.77 s | 2.51 | 0 (59) | 217 MB, 4 × 2.0 MB | 399 MB | yes, yes, yes |

The main thread works less on more workers (1.30 → 0.79 s): its share is mostly per second
of run (the progress drawn, the page's timers), not per result (under 1 ms each, 26–31 ms
for the pattern on show: b14/map-runs). The long tasks are the run's end on show (draw,
release, commit: 57–90 ms), in some runs only. The first run of a session pays each worker's
compiling and warming: on three workers +1.3 s and 4.7 s more CPU (13.3 against 8.7 s); on
one, within the runs' own spread (today 7.20 s cold, 6.6–7.8 s warm). The pool keeps its
workers 60 s for the next run.

### 1b. On the bench, heavy settings (bench.mjs; medians of 5)

| k | wall | speed-up | a job (median) | workers' CPU | cores busy | main thread probe (idle 9.4 ms) | RSS: k idle after GC / peak |
|---|---|---|---|---|---|---|---|
| 1 | 54.22 s | 1× | 4.46 s | 52.2 s | 0.96 | 9.4 ms, p95 13.5 | 119 / 182 MB |
| 2 | 28.38 s | 1.91× | 4.80 s | 54.0 s | 1.90 | 9.5, p95 14.3 | 126 / 202 MB |
| 3 | 20.24 s | 2.68× | 4.86 s | 55.5 s | 2.74 | 9.7, p95 15.5 | 134 / 235 MB |
| 4 | 16.36 s | 3.32× | 5.19 s | 55.5 s | 3.40 | 9.8, p95 14.0 | 139 / 262 MB |

Signatures identical to k = 1's in every run, written in order; no long task. Each worker
running heavy jobs adds some 27 MB to the peak, 7 MB idle. Heavy jobs slow each other little
(a job 9 % longer on 3 workers, 16 % on 4); the default ones more (19 % on 3, 34 % on 4: §4).

### 1c. Working while it runs (interact.mjs; ms, median / p90 / max of 12)

| tree, k | nothing runs: next sample | smoothing | its Refine all running: next sample | smoothing |
|---|---|---|---|---|
| today (1) | 63 / 79 / 100 | 124 / 134 / 137 | 70 / 96 / 115 | 130 / 188 / 209 |
| pool, 1 | 63 / 69 / 72 | 122 / 140 / 170 | 53 / 94 / 96 | 126 / 165 / 166 |
| pool, 2 | 62 / 64 / 76 | 125 / 133 / 134 | 65 / 102 / 102 | 124 / 139 / 176 |
| pool, 3 | 64 / 69 / 69 | 117 / 133 / 137 | 71 / 98 / 118 | 154 / 192 / 230 |
| pool, 4 | 65 / 71 / 111 | 122 / 132 / 138 | 67 / 93 / 114 | 179 / 196 / 207 |

With the cores less one the smoothing change takes 24 ms more than today's run (its p90 the
same); with every core taken, 49 ms more. On the bench page, with no app to draw, a 10 ms piece
of work is not slowed at any k, even 2 workers on 1 CPU (6.5–10 ms, as idle): what slows is the
page's own drawing competing for the cores, not the scheduling.

### 1d. Cancel, the history, the workers (safety.mjs; k = 3, 5 rounds at the workers' speed)

Each round: Clear all; Refine all; card 1 folded once 4 results are in (a step during the
run); Cancel once 7 are. Every round: 7 written, in order, each identical to the reference;
the 3 under way not written, nothing written in the 1.5 s after; Cancel to the button back in
38 ms (33–58); the pool's 3 workers, all under way, terminated (0 alive after); the history's
tail the start (no result), the run's step (7, fold as before), the fold's step (7, folded):
undo takes the fold, then the results; redo both back; Refine all again to its end: the 12
identical, new workers made. (A result done behind one under way, written by Cancel, did not
come up at this speed: rvpool.test.mjs makes it with held answers.)

### 2. Runs in several tabs at once (tabs.mjs; medians of 5 rounds; a DRS tab on show)

| tree | tabs | each run | all (first click → last end) | CPU all / main | workers alive | RSS peak | longest long task |
|---|---|---|---|---|---|---|---|
| A (bg) | 1 / 2 / 3 | 7.48 / 8.80 / 9.99 s | 7.48 / 9.86 / 11.98 s | 10.2 / 22.2 / 33.9 s; 1.2 / 2.5 / 3.7 s | 1 / 2 / 3 | 344 / 422 / 482 MB | 86 / 220 / 215 ms |
| A + pool | 1 / 2 / 3 | 3.31 / 5.30 / 7.12 s | 3.31 / 6.38 / 9.25 s | 9.8 / 19.8 / 28.6 s; 0.9 / 2.3 / 3.4 s | 3 | 530 / 647 / 677 MB | 100 / 304 / 233 ms |
| b1 (live) | 1 / 2 / 3 | 7.10 / 7.44 / 8.10 s | 7.10 / 7.47 / 8.31 s | 7.7 / 16.5 / 24.4 s; 0.3 / 0.6 / 0.8 s | 3 (1 a frame) | 375 / 439 / 529 MB | 91 / 54 / 70 ms |
| b1 + pool, shared cap | 1 / 2 / 3 | 2.96 / 5.56 / 8.11 s | 2.96 / 5.84 / 8.69 s | 8.7 / 16.9 / 25.4 s; 0.3 / 0.5 / 0.8 s | 9 (3 a frame) | 604 / 594 / 709 MB | 0 / 62 / 64 ms |
| b1 + pool, cap per frame | 1 / 2 / 3 | 3.08 / 5.43 / 7.47 s | 3.08 / 5.49 / 7.48 s | 9.1 / 19.9 / 27.0 s; 0.2 / 0.6 / 0.9 s | 9 | 617 / 610 / 818 MB | 0 / 71 / 96 ms |

Every run's 12 results identical to today's and in order. In A the tabs' runs start one
after the other (each tab shown, its Refine all clicked, the next: 1.0 s apart; their
switches' restores and the parked writes are A's main-thread cost); in b1 all at once.
Readings:
- **One run alone is 2.3–2.4× faster** on the pool in either option.
- **Several at once share the cores**: on 4 CPUs two runs on the pool take 5.3–5.6 s each
  (a worker a run: 7.4–8.8 s); three take the whole machine whatever
  the workers (7.1–8.1 s each; 36 jobs of 0.6 s on 3–4 cores). The shared cap makes them take
  turns pattern by pattern (b1: 8.1 s each, their ends 1.2–1.4 s apart; with a cap per frame
  the OS shares the cores and they end together).
- **The shared cap leaves the fourth core to the page**, as one tab's run does. With hidden
  frames idle (b1, a DRS tab on show) that core is unused: 9 workers on 4 cores (cap per
  frame) ended three runs in 7.5 s against 8.7 s, at 110 MB more of peak. The tab on show
  keeps its core in exchange (§1c).
- **Workers are per realm**: in b1 each frame that has refined keeps up to 3 idle workers for
  60 s (9 here, 18 MB of heap and some 35 MB of RSS after GC, 200 MB more of peak before V8
  collects their garbage: hwm 764 MB against 567). In A one pool: 3.

### 3. The standard and the samples (std.mjs; medians of 5)

| tree | case | the standard | then the samples | in all |
|---|---|---|---|---|
| today | Refine all → "Refine the standard first", cold | 0.74 s | 6.22 s | 6.94 s |
| today | the same, warm | 0.63 s | 5.77 s | 6.47 s |
| pool, 3 | cold | 0.74 s | 3.40 s | 4.15 s |
| pool, 3 | cold, the samples' 3 workers made as the standard starts (`warm(3)`) | 0.79 s | 3.45 s | 4.22 s |
| pool, 3 | warm | 0.68 s | 2.53 s | **3.22 s** |
| pool, 3, guard lifted | the samples' Refine all, and meanwhile another file (s10) loaded as the standard and refined | 0.98 s | 2.88 s (at once) | 2.88 s; **12 of 12 stale** |

The guard (`host.blocked`, xrd.js: no sample refines while the standard does, nor the other way
round) says "a batch takes one instrumental profile throughout". Since v477 each run copies
the profile as it starts (`run.irf`; xrd-rv-model.js payloadFor), so a batch keeps one
profile with or without the guard. What it still prevents is real: samples refined while the
standard refines are refined against the profile before it, and as the standard's run ends
every one of them is stale (5 rounds out of 5: 12 of 12, `sameIrf` false, the card's note "The
standard has been refined again since this result"). With a pool the dependency stays: the
standard is one pattern, one job, and the samples wait for it (the other workers idle 0.7 s
here; minutes with the user's standard, unless another tab's run takes them — the shared cap
lets it). What would help is a queue, not concurrency: a sample's Refine pressed while the
standard refines waiting for it, as "Refine the standard first" already does, instead of being
refused. Making the samples' workers while the standard runs gains nothing (3.45 against
3.40 s): a cold worker's cost is the engine compiled and warmed in its first job, not its
start.

### 4. Cores, and what to expect on more (bench.mjs under taskset; simulate.mjs)

The bench, default settings, the browser held to n CPUs (wall time, medians of 5):

| CPUs | k = 1 | 2 | 3 | 4 | 5 | 6 | 8 |
|---|---|---|---|---|---|---|---|
| 1 | 6.95 s | 7.57 s | | | | | |
| 2 | 6.78 s | 4.22 s (1.61×) | 4.32 s | | | | |
| 3 | 6.84 s | 4.18 s (1.64×) | 3.30 s (2.07×) | 3.26 s | | | |
| 4 | 7.16 s | 3.77 s (1.90×) | 3.00 s (2.39×) | 2.61 s (2.75×) | 2.76 s | 2.73 s | 2.60 s |

Past the cores nothing is gained and memory grows (8 workers: 161 MB idle, 281 MB peak,
against 117 and 174 for one); results identical at every point. A job's slowdown against one
worker on the same CPUs is fitted by s(k, n) = (1 + c·(min(k, n) − 1))·max(1, (k + m)/n): c the
cost of each other worker running (shared caches, memory), m the cores the page's own threads
take. Fitted on the grid's 12 points: c = 0.11, m = 0.09 (default jobs); heavy jobs c = 0.05.
With the jobs scheduled on the lanes as the pool does, the model gives every measured wall
time within ±10 % but two oversubscribed points (5 and 8 workers on 4 CPUs: +13, +30 %), and
heavy's within 3 % (`results/simulate.log`). For more cores, the cap n − 1:

| cores | workers | rounds of 12 | default: c fitted … c = 0 | heavy: c fitted … c = 0 |
|---|---|---|---|---|
| 4 | 3 | 4 | 3.2 s (2.3×) … 2.6 s (2.7×) | 20.3 s (2.7×) … 18.4 s (2.9×) |
| 8 | 7 | 2 | 2.3 s (3.1×) … 1.4 s (5.1×) | 12.3 s (4.4×) … 9.4 s (5.8×) |
| 12 | 11 | 2 | 1.8 s (3.9×) … 0.9 s (8.0×) | 11.9 s (4.6×) … 7.8 s (6.9×) |
| 16 | 12 | 1 | 1.8 s (4.1×) … 0.8 s (8.8×) | 7.8 s (7.0×) … 4.9 s (11×) |

Against one worker (7.16 s, 54.2 s). The truth on a given machine lies between: the fitted c
is these vCPUs' (a VM whose physical sharing is unknown); a desktop's own cores contend less,
a laptop's (shared power budget, its clock falling as cores fill) as much or more. Three things
shape it:
- **The 12 patterns come in rounds**: 4 workers take 3 rounds, 6 to 11 take two, 12 one. On 12
  cores, 11 workers leave the twelfth pattern to start after the first ends (heavy: 11.9 s);
  12 workers would do it in one (7.8 s). Fewer lanes for the same rounds (6 for 7–11) save
  workers but no time (simulate's column), so the pool does not do it.
- **Logical CPUs**: `hardwareConcurrency` counts threads. On a laptop of 4 cores and 8 threads
  the cap is 7; the hyperthreads add some 20–30 % to 4 cores' work, not 75 % (not measured
  here: this VM shows 1 thread a core).
- **Memory grows with the workers, not the cores**: 7–10 MB of RSS idle and 15–30 MB more
  running each (heavy: 27 MB), more for the user's patterns (the engine's caches: the
  Gauss–Legendre nodes up to 16 MB a worker, the Soller lines up to some 5 MB, RIETVELD.md
  §13.1), each worker its own. 15 workers: some 0.5–0.8 GB at their peak.

## How to cap the pool

- **The cores less one** (`navigator.hardwareConcurrency − 1`, at least 1), the default built.
  On 4 CPUs k = 4 gains 2 % in the app (2.85 against 2.92 s; 13 % on the bench, which draws
  nothing) and costs the tab on show 16 % on its heaviest interaction (179 against 154 ms) and
  a slower start of everything the page does meanwhile. On 8 or more cores the core left is
  1/8 or less: the same rule. One exception worth the knob: on 12 cores the cap 11 leaves the
  twelfth of 12 patterns to a second round (heavy, the model: 11.9 s), 12 workers do them in one
  (7.8 s). Chromium's `hardwareConcurrency` follows the CPUs the browser
  may use (measured with taskset); another browser may report a clamped count, which the knob
  corrects.
- **One cap for the browser**, not per page: the slots are Web Locks of the origin, so two
  windows of the app, or the frames of live tabs (b1), share it (tested). Per page (b1 without
  it) three frames ran 9 workers on 4 CPUs: faster here with the page idle, but the tab on
  show then competes for every core, and memory triples.
- **Lanes per run = the cap** (a run alone takes all of it; several share it pattern by
  pattern, oldest first). The knob `lanes` caps one run (1: today's behaviour).
- **Not by memory**: `navigator.deviceMemory` is Chromium's alone and stops at 8 GB; the
  workers' memory (above) is small beside a SEM tab's. A machine of 2 cores gets 1 worker:
  today's speed, nothing lost.
- **Workers kept idle 60 s** (`idle`): the next run warm (a cold first run of 3 workers is
  1.3 s slower). In b1 each frame keeps its own: a shorter idle for a hidden frame (or the
  idle workers of hidden frames let go at once) would spare the 9-worker peaks of §2.

## Limits

- **A run of one pattern is not faster**: a job is one pattern in one worker, and the engine
  runs it on one thread (its stages, the shape search's starts, the widths are sequential in
  `autoRefine`). Refine on the pattern on show, the standard's run, a run of fewer patterns
  than workers: as today. Splitting the shape search's random starts or the peak widths across
  workers would need changes in xrd-rietveld.js and the worker (not looked at here).
- **The first run of a session** pays each worker's compiling (+1.3 s on 3 workers here);
  making them earlier does not remove it. Workers idle past 60 s pay it again.
- **Each worker builds its own caches** (the engine's memos are per realm, b14/map-runs): k
  workers compute the same Gauss–Legendre orders k times and hold them k times. On the user's
  patterns with Sollers the first calculation of a cold worker can take long (RIETVELD.md
  §13.1: 30 s for an extreme cell, 0.5 s cached): k workers pay it at once, in parallel, not k
  times in a row; the memory is k times.
- **Contention**: k workers make each job slower (default jobs 19 % on 3 workers here, heavy
  9 %); the speed-up is k/(that), less the rounds' tail.
- **Several tabs share the cores**, they do not get more: on 4 CPUs three runs at once take as
  long whatever the workers.
- **Results arrive out of order and wait**: a pattern done early is written only when those
  before it are, so the plot of the pattern on show may come a little later than its job
  ends (by at most the time to finish the patterns before it).
- **Not done in the prototype**: RIETVELD.md §13.1 ("Jobs are serial", "Cancel terminates the
  worker") and the user's guide; the cache version bump (sw.js); with several patterns under
  way the status names them, not their stages; a sample's Refine queued behind the
  standard's run (§3); a shorter idle for hidden frames (b1).

## Optimisations

| what | measured | verdict |
|---|---|---|
| Refine all on the cores less one | 7.23 → 2.92 s (2.47×) in the app, 54 → 20 s heavy (2.68×) | built |
| one cap for every window and frame (Web Locks) | three b1 tabs: 9 → 3 jobs at once, 8.7 s against 7.5 s with the page idle; 9 workers' peaks avoided | built: the UI keeps its core |
| results written in the patterns' order | the same files, keys and history as one worker; the plot of an early pattern waits a little | built: needed |
| workers kept warm 60 s | a run after one: 2.92 s, a cold one 4.25 s | built |
| the samples' workers made as the standard starts | 3.45 against 3.40 s | not worth it: the cost is warming, not starting |
| the cap the cores (k = 4 on 4) | 2.85 against 2.92 s; the smoothing change 179 against 154 ms | no |
| fewer lanes for the same rounds (6 for 7–11 workers) | the model: the same time on 8 cores, slower on 12 | no |
| the longest patterns first (their last result's time) | not measured: shortens the last round when jobs differ much | later, if the user's patterns differ much |
| a sample's Refine waiting for the standard's run | (the chain measured: 3.22 s) | worth doing with the pool |

## Effort, to do it for real

- **The pool on HEAD (`pool.patch`)**: about a day. Built: the module, Refine's loop on it,
  ordered writes, Cancel, errors, the shared cap, 4 tests; the whole suite passes on the patched
  tree (187 of 187, `results/suite-pool.log`). Left: names and words reviewed, RIETVELD.md §13.1 and the
  guide, the version and its cache, the defaults decided (cap, idle), a test of the per-page
  fallback (`shared` off, or no `navigator.locks`).
- **With option A**: `pool-on-bg-runs.patch` instead of bg-runs-pool.patch, the same day
  (195 of 195, `results/suite-bgpool.log`).
- **With option b1**: `pool.patch` as it is (the cap shared across frames by Web Locks; the
  live mode's test passes on it), plus the hidden frames' idle workers let go sooner (an hour).
- **The standard's queue** (§3): half a day, apart.
- **Splitting one pattern across workers**: not estimated; a change of the engine.

## Files

- `pool.patch` (HEAD, or after live-tabs.patch), `pool-on-bg-runs.patch` (after
  bg-runs.patch): the change against v517 (b93ed5c).
- `bench/`: `bench.html`, `bench.js`: the pool's `lanes`, the app's worker and payloads, no
  card (copied into the pool tree as `bench/`, with `fixtures/`).
- `measure/lib.mjs`: the trees, the browser, the steps (on show, parked, in a frame), CPU from
  /proc, memory, timing, the results' hash. `pool.mjs` (§1), `bench.mjs` (§1b, §4), `interact.mjs`
  (§1c), `safety.mjs` (§1d), `tabs.mjs` (§2), `std.mjs` (§3), `cores.sh` (§4's grid),
  `simulate.mjs` (§4's model), `summary.mjs` (the tables); `run-all.sh` all of them.
- `results/`: each script's JSON and log; `bench-default-cpus<n>.json` the grid, `bench-heavy.json`;
  `simulate.json`/`.log`; `summary.txt`; `run-all.log` (which ran when, the load);
  `suite-pool.log`, `suite-bgpool.log` (the whole test suite on the patched trees).
- `fixtures/`: the 12 XRDML scans, the CIF, the DRS spectrum.
