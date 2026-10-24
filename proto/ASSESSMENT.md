# Tabs that work in the background: the assessment (backlog 23)

Nothing is implemented: the app's files are v517's (b93ed5c). This page brings together the
five steps of the assessment: an inventory of what assumes one instance per module, a map
of the Rietveld runs, three prototypes and an independent review. It applies the review's
corrections and ends with a recommendation. Every number was measured on this machine
unless the text says otherwise, and each comes with the raw file it was read from, as a path
relative to `proto/`. `proto/README.md` lists every folder and says how to apply each patch.

## The question

Item 23, in the user's words: tabs that work in the background, done "the hard way", as
independent tabs. A prototype, not implemented, and tested. How slow does it get? What are the
limits? Can it be optimised? If it is not worth it, speed while working is worth a 1 s wait
when changing tab, and a worker in the background will do. In both cases, several workers at
once, tested too. The prototype should be easy to apply later, so that the assessment is not
lost.

Today (v517) there is one module instance per technique, bound to the page's fixed ids. A
tab is a project that takes its module in turn: tabs.js parks the state it leaves and
restores the one it shows. Leaving a tab while a Rietveld refinement runs asks to stop the
run. Each Rietveld card has one worker and refines its patterns one after the other.

| option | what it is | built |
|---|---|---|
| **b1**, live tabs as frames | every tab is an iframe running the whole app in an embedded mode, and the window's page is a shell holding the tab bar. Each tab has its own module instance, DOM, undo history and workers. A switch shows one frame and hides another | `live-tabs/`: `live-tabs.patch`, `live-tabs-lean.patch` |
| **b2**, live tabs as factories | every module becomes a factory with scoped ids and per-instance registries, all tabs in one page | not built: the inventory sized it (`map/singletons/`). At run time it would behave like b1 less one realm per tab |
| **A**, background runs | tabs switch as today; a refinement goes on when its tab is left, and each result is written into the parked tab and its history | `bg-runs/`: `bg-runs.patch`, `bg-runs-pool.patch` |
| **pool**, several workers | Refine all spread over several workers, with one cap for the whole browser | `workers/`: `pool.patch` (HEAD or b1), `pool-on-bg-runs.patch` (A) |

## The answer in short

**Build the pool first. Then build the independent tabs (b1) as a setting, and make them the
default once they have their own tests and have run on the user's machine. Build option A
only if b1 fails there.** By the user's own test b1 is worth it: working in the tab on show is
not slower, whether other tabs are live or refining, and switching is faster. What it costs
is memory and the first visit of each tab after a start. The optimisations already built
contain both. Nor is it the hard way it looked: no analysis module changes. That would be b2,
10–15 days, and nothing measured calls for it.

The numbers that decide it (medians; 12 XRPD patterns of 5384 points with a SrTiO3 phase,
default settings; SEM tabs of 8 images, 2048 × 2176, 16-bit):

| | today | A | b1 | source |
|---|---|---|---|---|
| Refine all, 12 patterns, one worker → pool of 3 | 7.21 → 3.05 s (2.36×) | parked 7.60 s → 3.09 s | hidden 7.04 s → 3.07 s | `review/results/refine-*.json`, `bg-runs/results/speed-pool.json` |
| Working in the XRPD tab while 3 other tabs refine: next sample / smoothing changed | 66 / 128 ms with nothing running | 75 / 148 ms | 77 / 140 ms | `review/results/interact-{head,bg,live}.json` |
| Switch to an XRPD tab, from the other XRPD tab / from the SEM tab | 313 / 347 ms | 311 / 320 ms | 74 / 50 ms | `review/results/switch-*.json` |
| First visit of an XRPD / SEM tab after a reload | 154 / 752 ms | as today | 685 / 1114 ms | `review/results/firstshow-*.json` |
| Renderer memory, 6 tabs (2 XRPD refined, SEM, DRS, GC, EPR) → 8 tabs (+ SEM, + XRPD) | 476 → 522 MB | as today, plus a worker per run | 514 → 819 MB (+8 % → +57 %) | `review/results/memory-{head,live}.json` |

Effort to implement for real: the pool about 1 day. b1 3–5 days as a setting, plus about 2
to run the module tests in live mode before it becomes the default. A 1.5–2 days, plus 0.5–1
for its pool. b2 10–15 days.

## Method

- **Machine**: 4 vCPUs (Intel Xeon 2.1 GHz, KVM, one thread per core as the guest sees it),
  16 GB, Linux. Headless Chromium 141.0.7390.37 through Playwright 1.56, viewport 1400 × 900,
  service workers blocked except where the service worker was under test. One measurement at
  a time, with nothing else running.
- **Trees**: git-archive copies of HEAD with their patches applied, each served on its own
  port. The main tree was never edited.
- **Fixtures**: the 12 XRDML scans s00–s11 (5384 points, 10–80°), the SrTiO3 CIF, DRS, GC
  and EPR files (copies are in each prototype's `fixtures/`), and 8 SEM TIFFs of
  2048 × 2176, 16-bit, made by tests/fixtures.mjs makeTiff.
  - "XRPD refined" means the 12 patterns with the CIF on a Rietveld card, Refine all run to
    its end without the standard.
  - "Heavy" means a free ellipsoid, ΔB, Sr1's occupancy and the standard's profile, run on a
    bench page with jobs of 3.8–5.2 s.
  - The user's own heavy refinements take about 45 s a pattern (RIETVELD.md, *Cost*: a shape
    search of 32 s and its esds 13 s), so his case is nearer the heavy numbers than the
    default ones.
- **Time** is measured in the page with `performance.timeOrigin + performance.now()`.
  - The prototypes dispatch the click in the page and stop at two animation frames in the
    realm that shows the result, once its loader is gone.
  - The review used real input (CDP mouse and keyboard) and timed from the event's own
    timeStamp, so a main thread that is busy before the handler runs counts too.
  - A run is timed from the click on Refine to the card's button coming back (polled every
    20 ms; the review used a MutationObserver).
  - Values are medians of 5–14. Long tasks come from a PerformanceObserver in every realm.
- **Memory** is read after a forced GC (`HeapProfiler.collectGarbage` twice):
  - the renderer's VmRSS from /proc (same-origin frames and workers live in the renderer
    process);
  - the JS heap of the page's isolate (`Runtime.getHeapUsage`; one isolate serves every
    same-origin frame);
  - each worker's heap (`Target.setAutoAttach`);
  - peaks, sampled every 100 ms without a GC;
  - and in the review, Private and PSS summed over every Chromium process.
- **CPU**: utime + stime of the renderer's threads from /proc, with the workers' threads and
  the main thread counted apart.
- **Results**: card 2's 12 results, everything the worker returns except its times, hashed.
  The review got the same hash (`0e098f762ba8cae5`) in about 60 runs. Those runs covered
  every tree; a run on show, hidden or parked; every worker count; and 1–3 tabs at once
  (`review/results/refine-*.json`, `concur-*.json`). The prototypes compared the results
  pattern by pattern.
- **Every "hidden" number is unthrottled.** Playwright launches Chromium without background
  throttling.
  - The review re-ran Refine all headful under Xvfb, with those flags removed and the window
    behind another page. It still ended with its 12 results in today's tree, in b1 and in A.
    That output went to the console only; no file was kept.
  - Not tested: a browser tab hidden for minutes, and Chrome's Energy Saver and Memory Saver.
    Both slow or stop the whole page, its workers included, in every option alike.

## Option b1: independent tabs as frames

**What was built.** `live-tabs/live-tabs.patch` adds 450 lines and removes 35 across 10 app
files, plus one test (`tests/livetabs.test.mjs`, 114 lines):

- tabs.js (+337): the shell's frames, and a tab page's own side;
- utils.js: a `storage` listener, so that settings, the theme and the recent colours reach
  every page;
- db.js: a tab page reads and writes its own record, and the shell writes only the order and
  the tab on show;
- small changes in sessions.js, boot-head.js, boot-body.js, style.css, index.html and
  figure.js;
- sem.js (+14): a hidden SEM tab may let its decoded images go.

tauc, xrd\*, gc, epr, modkit, cards and plot are untouched. Each runs once per realm, so its
document-level lookups and fixed ids need no change. Frames are made on a tab's first show and
talk to the shell by postMessage only, since an object from another realm fails the app's
`instanceof` checks. The mode is a choice in Settings › Tabs, off by default. Off, the app is
v517's, and the whole suite passes (184 of 184, `live-tabs/results/suite-patched.log`).
`live-tabs-lean.patch`, on top, makes each frame load only its own module.

**Switching** (median ms). The review used real clicks with two XRPD tabs of 12 refined
patterns, the user's case, 7–14 clicks each. The prototype used one tab per module, 7
dispatched clicks each.

| to | today | b1 | source |
|---|---|---|---|
| XRPD, from the other XRPD tab / from SEM / from DRS (review) | 313 / 347 / 339 | 74 / 50 / 68 | `review/results/switch-{head,live}.json` |
| SEM / DRS, from XRPD (review) | 149 / 180 | 58 / 51 | the same |
| XRPD / SEM / DRS / GC / EPR, one tab each (prototype) | 183 / 149 / 187 / 170 / 122 | 64 / 54 / 54 / 50 / 49 | `live-tabs/results/switch-{head,live}.json` |

Today a switch to XRPD carries 224–241 ms of long tasks (the median per transition). In b1
the median switch has none; the largest long task in 42 switches was 52 ms.

**Opening, first visits and startup** (median ms):

| | today | b1 | source |
|---|---|---|---|
| a blank tab | 102–114 | 155–184 | `live-tabs/results/open-{head,live}.json` |
| a saved XRPD project, from Projects | 374 | 636 | the same |
| a saved SEM project, from Projects, whose images today's shared decoded-image cache already holds | 131 | 1048 | the same |
| the same after a reload: XRPD / SEM | 556 / 804 | 653 / 1036 | `live-tabs/results/opencold-*.json` |
| first visit of a stored tab after a reload: XRPD / SEM / DRS (review, 4 reloads) | 154 / 752 / 154 | 685 / 1114 / 304 | `review/results/firstshow-*.json` |
| startup, 5 tabs stored (review) | 958 ms, 292 MB | 878 ms, 210 MB | `review/results/boot-*.json` |
| startup, 4 / 8 tabs stored (prototype) | 894 / 915 ms; 288 / 383 MB | 791 / 792 ms; 212 / 217 MB | `live-tabs/results/boot-*.json` |

A frame's start costs +52–82 ms on a blank tab; the rest is today's restore. b1 starts
faster only because it makes the tab on show alone, and the cost moves to each tab's first
visit. Today's mode could also restore only the tab on show, so that gain is not b1's alone.

**Memory** (renderer RSS after a GC):

| | today | b1 | source |
|---|---|---|---|
| per tab added, 8 alike: empty / XRPD refined / SEM | +2 / +11 / +109 MB | +7 / +32 / +219 MB | `live-tabs/results/memory-*.json` |
| 6 mixed tabs: 2 XRPD refined, SEM, DRS, GC, EPR (review) | 476 MB | 514 MB (+8 %) | `review/results/memory-{head,live}.json` |
| plus a second SEM tab | +54 MB | +253 MB | the same |
| plus a third XRPD tab: 8 tabs | 522 MB (557 MB private over every process) | 819 MB (854 MB), +57 % | the same |
| 20 SEM tabs, the app's limit (MAX_TABS) | 2095 MB, heap 1818 MB | 4435 MB, heap 1848 MB, nothing failed | `live-tabs/results/memory-*-sem-ceiling.json` |

- A live tab keeps what today is derived again at each restore. For SEM that is the decoded
  images (8 × 8.4 MB), the canvases and the reading worker. For XRPD it is the derived data
  and the Rietveld worker.
- The JS heap limit (4096 MB here) is shared by every tab, since same-origin frames share one
  isolate.
- The review did not force a GC in the workers. Measured that way, each extra live XRPD tab
  added 52–62 MB, against +13 / −8 MB today.

**Working in the tab on show** (median ms, the maximum in brackets; the review's real keys, 8
of each; the prototype's dispatched events, 9 of each):

| while | today: next sample / smoothing | b1 | source |
|---|---|---|---|
| nothing else runs (review) | 66 / 128 (73 / 146) | 76 / 136 (98 / 175) | `review/results/interact-{head,live}.json` |
| 1 hidden tab refining (review) | – (it would ask to stop) | 65 / 135 | the same |
| 3 hidden tabs refining (review) | – | 77 / 140 (92 / 179) | the same |
| its own Refine all on show (review) | 77 / 148 | 83 / 137 | the same |
| 7 other tabs live and idle (prototype) | 66 / 126 | 67 / 134 | `live-tabs/results/interaction-*.json` |
| 3 hidden tabs refining (prototype) | – | 80 / 136 (101 / 216) | the same |

Three hidden refinements plus the page fill all 4 CPUs, yet the medians stay within 15 ms of
nothing running.

**The one real limit is the shared main thread.** Same-origin frames share one, and a hidden
tab's main-thread work holds up the tab on show:

- A hidden SEM tab reading 8 images kept the main thread busy 0.75–1.24 s over 1.18–1.51 s of
  wall time.
- Meanwhile keys in the tab on show took 69–72 ms (median), 113–129 ms at most. One key took
  512 ms, behind a 424 ms long task, in a session with 3 XRPD tabs. Those are 15 readings in
  all (`review/results/semhidden*.json`, `interact-live.json`).
- Hidden refinements run in their workers and take about 1 ms of main thread per result
  (`map/runs/results/inapp.json`).

**Refinements:**

| | today | b1 | source |
|---|---|---|---|
| Refine all on show / hidden | 7.21 s / asks to stop it | 7.14 / 7.04 s | `review/results/refine-*.json` |
| K tabs refining at once, wall time for all: K = 1, 2, 3, 4 | – | 6.8, 7.6, 7.8, 9.3 s (1.0, 1.8, 2.6, 2.9× the work of one) | `live-tabs/results/refine-concurrent.json` |
| 3 tabs, 36 patterns, first click to last end | 23.3 s, one after the other | 8.7 s (CPU 25.6 s against 27.5 s) | `review/results/concur-{head,live}-3.json` |

A hidden frame is not throttled: 61 animation frames and 229–241 zero-delay timers a second
(`live-tabs/results/refine-speed-live*.json`).

**Limits:**

- One renderer process, one main thread and one JS heap for every tab. A renderer that runs
  out of memory takes every tab with it, as today.
- Memory grows with what is open, SEM tabs most. 20 SEM tabs fit in 16 GB. On an 8 GB laptop
  with other browser tabs open, a few live SEM tabs are the limit.
- Behaviour changes:
  - a window open in a tab (the composer, the XRPD standard, a banner) covers that tab
    alone, so the tab bar still switches;
  - a hidden tab with unsaved work is shown first when it is closed, then asks;
  - a tab whose frame was let go comes back without its undo history;
  - settings and the theme now reach other windows of the app as well.
- Tests: the live mode has one test; the other 183 run in today's mode. With the pool that
  test failed in 2 of 4 runs (`review/results/t-livepool*.log`). The tab's running mark is
  polled once a second, and a 2-pattern run on 3 workers ends before the poll sees it.
- Not done in the prototype:
  - the composer's memories of a tab closed from the shell without a frame;
  - two app windows, each a shell;
  - the narrow layout;
  - focus and frame titles for accessibility;
  - the service worker's update path (the shell would reload every frame).
- Checked and working (`live-tabs/results/limits.json`, 21 checks; `sw.json`, 3 checks):
  - Ctrl+Z/Y and the arrow keys, by moving focus into the frame or forwarding the key;
  - drag and drop, and downloads;
  - settings and theme sync;
  - save, rename and delete from Projects;
  - undo of a run that ended hidden;
  - the order and the states after a reload;
  - service-worker control of the frames, and offline loading.
  - The review also checked that a hidden tab is redrawn at the new width after the window
    is resized.

**Optimisations (measured):**

| what | measured | verdict | source |
|---|---|---|---|
| frames made on first show (lazy) | startup 0.79 s and 212 MB; all frames at once, 1.98–3.42 s and 421–643 MB | the default | `live-tabs/results/boot-*.json` |
| a hidden SEM tab lets its decoded images go | 4 hidden SEM tabs, 1021 → 737 MB; a switch back, 38 → 102 ms | turn on after about 30 s hidden | `live-tabs/results/opt-free.json` |
| at most N frames, the others let go | 8 tabs with N = 3: 679 → 427 MB, 4 → 2 workers; a tab let go shows again in 0.66 s (XRPD) or 1.05 s (SEM) | as a ceiling of 6–8 | `live-tabs/results/opt-max.json`, `open-live.json` |
| each frame loads only its own module (lean patch) | an empty tab 5.5 MB against 7.1; a blank DRS, GC, EPR or SEM tab opens in 139–143 ms against 155–184; XRPD unchanged | small; later | `live-tabs/results/*-lean.json` |
| frames hidden by visibility:hidden | switches 44–55 ms against 49–64 | not worth keeping hidden frames laid out | `live-tabs/results/switch-live-visibility.json` |

**Effort.** 3–5 days from the prototype, as a setting (`live-tabs/README.md`), 1–2 of them
for live-mode tests through a frame accessor in tests/helpers.mjs. Also left:

- the hibernation policy;
- SEM's release of decoded images after 30 s hidden;
- the lean frames' module order;
- the composer's memories;
- accessibility;
- the service worker's update path;
- the narrow layout;
- the running mark posted when it changes, not polled.

Making b1 the default means running the module tests in live mode as well: about 2 more
days, by the review's estimate.

## Option b2: modules as factories (not built)

Every module is one IIFE, so its state would become per-instance at no cost. What binds a
module to one instance:

- 72 document-level lookups in the module files (`map/singletons/counts.txt`);
- 141 ids built in templates (`map/singletons/scan.json`);
- 6 registries in utils.js keyed by module name;
- 36 listeners on window and document at run time, the same after 5 tabs and every fixture
  is loaded (`map/singletons/probe.json`). Only the XRPD cards can remove theirs.

The tests hold 339 lines with a module-id selector, across 32 files (`counts.txt`).

The inventory put b2 at 10–15 days: about 17 files and 700 lines, some 400 lines of tests,
and regressions possible in every module. At run time it would behave like b1 less one realm
per tab, some 5–7 MB of RSS and 2 MB of heap (`live-tabs/results/memory-*-empty.json`). It
would share the same main thread and hold the same memory for what is open. Nothing measured
makes the case for it over b1.

## Option A: background runs

**What was built.** `bg-runs/bg-runs.patch`:

- **xrd-rv.js** (+239 −129): the run becomes an object of its own (go, job, halt, parkRun)
  and the card a view of it (attach, detach).
- **tabs.js**: a parked tab's jobs. Each result is patched into the parked state by xrd.js
  runPatch, the tab's record is written and its "*" set. At the end the run's mark is
  released into the parked history.
- **utils.js**: the history is parked together with the marks of the runs still going on.
- Small changes in xrd.js, sessions.js and style.css.
- **Tests**: tests/bgruns.test.mjs (7 tests). The suite passes, 190 of 190
  (`bg-runs/results/suite-bg.log`).

"Refine the standard first" also goes on while its tab is parked.

**What it costs:**

| | today | A | source |
|---|---|---|---|
| switches XRPD→XRPD, SEM→XRPD, DRS→XRPD (review) | 313 / 347 / 339 ms | 311 / 320 / 338 ms | `review/results/switch-{head,bg}.json` |
| leaving a tab mid-run; coming back to it, its card taking the run back | asks to stop it | 304 / 315 ms (idle: 288 / 301) | `bg-runs/results/switch-bg.json` |
| Refine all on show / parked (review, 5 in a row) | 7.21 s / – | 7.17 / 7.60 s | `review/results/refine-{head-show,bg-*}.json` |
| main thread during a run, on show / parked behind an XRPD tab | 1.25 s / – | 0.89 s parked | `bg-runs/results/speed-{head,bg}.json` |
| each parked result | – | the state patched in under 1 ms, the record written in about 7 ms (12 per run, 125 ms in all; at most 11 ms, 23 ms with three runs on the pool) | `bg-runs/results/speed-{bg,pool}.json` |
| working while 1 / 3 tabs refine parked: next sample / smoothing (review) | 66 / 128 ms with nothing running | 68 / 136; 75 / 148 (max 211) ms | `review/results/interact-bg.json` |
| memory | – | one worker per run going on: 2 MB of heap after a GC, some 25 MB of RSS at its peak, let go at its end | `bg-runs/results/memory-bg.json` |
| 3 tabs refining, first click to last end (each tab must be shown to start its run) | 23.3 s, one after the other | 13.1 s; 10.0 s each; CPU 35.8 s | `review/results/concur-bg-3.json` |

**Data safety.** The prototype ran 5 rounds each on bg and on bg + pool
(`bg-runs/results/safety-*.json`):

- At a parked run's end the parked state, its history and the database record held the 12
  results. The history was one step after the state the run started from, with no hold left.
- One undo took the run back and one redo brought it again.
- Leaving and coming back twice mid-run gave identical results.
- A reload after 3 parked results brought those 3 back, the tab unsaved and nothing running.

The review found the same: a reload after 4 parked results kept all 4 in 3 of 3 rounds
(`review/results/reloadmid-bg.json`). Today and b1 keep a running refinement's results only
at its end. With a reload 300 ms after the fourth result, the record held something in 1 of
8 rounds today and in 3 of 11 in b1 (`reloadmid-{head-onshow,live,live-onshow}.json`).

**Limits:**

- **The Rietveld alone.** SEM's reading still asks before its tab is left, since its busy
  guard has no detach. Any later long job needs a detach and a sink of its own.
- **Switching stays at today's 0.15–0.35 s.** That is under the user's 1 s, but larger
  projects will feel it as they do today.
- **A reload or a closed window ends the runs.** What they wrote is kept, but the tab does
  not say the run stopped.
- **Each parked result writes the tab's whole record.** That is fine for 12 patterns; runs of
  hundreds of fast patterns would want the writes gathered.
- **It is the slowest way to run several tabs at once.** Each tab has to be shown to start
  its run, and the restores and parked writes share the one main thread.
- **It rewrites the run and undo code of xrd-rv.js**, the app's most delicate part.
- **Not done in the prototype**: the run's last message is lost when it ends parked, and two
  app windows are not handled.

**Optimisations:**

- The pool, below. Parked, Refine all goes from 6.93 to 3.08 s on 3 workers
  (`bg-runs/results/pool.json`).
- A spare worker, so that the card's next run does not start cold.
- Writes gathered every 2 s, if runs ever have many fast patterns.
- A0, one live tab per module (not built, 1–2 days): XRPD ↔ SEM switches would need no
  restore.

**Effort.** 1.5–2 days for bg-runs. The pool on top is 0.5–1 day more with
`pool-on-bg-runs.patch`, whose suite passes 195 of 195 (`workers/results/suite-bgpool.log`).

## Several workers at once

**The pool** (`workers/pool.patch`): a new xrd-rv-pool.js of 183 lines, and Refine's loop in
xrd-rv.js (+59 −56).

- **The cap** is cores − 1 for the whole browser, through Web Locks, so every window and
  every live-tab frame shares it.
- **Workers** belong to their page and are kept warm 60 s.
- **Results** are written in the patterns' order, so the results, the history's step and the
  saved file are those of one worker, key order included.
- **Cancel** writes the patterns already done; an error stops those not yet started.
- **Where it applies**: on HEAD, on b1 as it is, and on A as `pool-on-bg-runs.patch`.
- **Tests**: the suite passes 187 of 187 on HEAD + pool (`workers/results/suite-pool.log`).

| k workers | Refine all, in the app | heavy, bench | RSS idle after a GC / peak (app) | smoothing during the run (app) |
|---|---|---|---|---|
| today | 7.23 s | – | 184 / 299 MB | 130 ms |
| 1 | 7.07 s | 54.2 s | 185 / 309 MB | 126 ms |
| 2 | 4.13 s (1.75×) | 28.4 s (1.91×) | 200 / 368 MB | 124 ms |
| 3 | 2.92 s (2.47×) | 20.2 s (2.68×) | 209 / 362 MB | 154 ms |
| 4 | 2.85 s (2.54×) | 16.4 s (3.32×) | 217 / 399 MB | 179 ms |

Sources: `workers/results/pool.json`, `bench-heavy.json`, `interact.json`. The review
measured 7.21 → 3.05 s on 3 workers (2.36×) and 3.04 s on 4, and the smoothing during a run
148 → 158 ms on 3 (`review/results/refine-pool*.json`, `interact-{head,pool}.json`).

- **Identical results**, bit for bit, at every k and in every tree, in the patterns' order.
- **No extra CPU**: 8.65 s on 3 workers against 8.98 s today.
- **Memory**: an idle worker holds 2 MB of heap and 7–15 MB of RSS; a running one some
  15–35 MB more at its peak (`workers/results/pool.json`, `map/runs/results/pool-default.log`,
  `pool-heavy.log`).
- **The first run of a session is slower**, 4.25 s on 3 workers, because each worker compiles
  the engine. Making the workers early does not help: 4.22 s against 4.15
  (`workers/results/std.json`).
- **Cancel** takes 38 ms and keeps the 7 patterns done (`workers/results/safety.json`).
- **A single pattern is not faster**: one job runs on one worker.
- **"Refine the standard first"**: 6.47 → 3.22 s warm. The guard between the standard and
  the samples is still needed: with it lifted, all 12 samples came out stale in 5 of 5 rounds
  (`workers/results/std.json`).

**More cores.** On the bench, with the browser held to n CPUs by taskset (default settings,
`workers/results/bench-default-cpus*.json`), the best result was:

- 2 CPUs: 1.61× on 2 workers;
- 3 CPUs: 2.07× on 3;
- 4 CPUs: 2.39× on 3 and 2.75× on 4.

A model fitted to that grid (`workers/results/simulate.log`) gives, with the cap at cores −
1:

- 8 cores: 3.1–5.1× faster than today (default) and 4.4–5.8× (heavy);
- 16 cores: 4.1–8.8× and 7.0–11×.

These are extrapolations, not measurements. Hyperthreads were not measured either:
hardwareConcurrency counts them, so a 4-core, 8-thread laptop gets a cap of 7.

**Runs in several tabs at once** (each run, then all of them from first click to last end;
4 CPUs; a DRS tab on show):

| | 1 tab | 2 tabs | 3 tabs | 3 tabs, review |
|---|---|---|---|---|
| today | 7.23 s | one after the other | one after the other | 6.85 s each; 23.3 s |
| A, one worker per run | 7.48 s | 8.80; 9.86 s | 9.99; 11.98 s | 10.0; 13.1 s |
| A + pool, cap 3 | 3.31 s | 5.30; 6.38 s | 7.12; 9.25 s | 7.3; 10.4 s |
| b1, one worker per run | 7.10 s | 7.44; 7.47 s | 8.10; 8.31 s | 8.5; 8.7 s |
| b1 + pool, one shared cap of 3 | 2.96 s | 5.56; 5.84 s | 8.11; 8.69 s | 9.0; 9.7 s |
| b1 + pool, a cap of 3 per frame (up to 9 workers) | 3.08 s | 5.43; 5.49 s | 7.47; 7.48 s | – |

Sources: `workers/results/tabs.json`, and `review/results/concur-*-3.json` for the last
column.

- **One run alone is 2.3–2.4× faster** on the pool, in either option.
- **Several runs share the cores.** Three runs fill 4 CPUs whatever the workers, and in b1
  the shared cap makes three tabs 5–11 % slower than one worker per tab.
- **The shared cap is still the right default.** It keeps a core for the tab on show and the
  memory down: a cap per frame peaked 110 MB higher (818 against 709 MB).

## What the review corrected

The review rebuilt the trees and applied every patch, including the combinations the
READMEs give. It ran the prototypes' tests and repeated the key measurements with its own
scripts (`review/measure/`). It confirmed:

- identical results;
- hidden and parked runs at full speed;
- the pool's speed-up;
- an unslowed tab on show;
- fast live switches;
- faster startup;
- several refinements at once in b1.

Where it disagreed, the reviewed number is the one used above:

| claimed | reviewed | source |
|---|---|---|
| b1 switches 2.5–3.5× quicker (49–64 against 122–187 ms) | With two XRPD tabs of 12 refined patterns, the user's case, today's switch to XRPD is 313–347 ms and b1's 50–74 ms, about 5×. But a tab's first visit after a start or a reload is slower in b1: XRPD 685 against 154 ms, SEM 1114 against 752, DRS 304 against 154. Every switch in both is under the user's 1 s, so the gain does not decide alone | `review/results/switch-*.json`, `firstshow-*.json` |
| b1 memory per SEM tab +219 MB against +109 | It depends on how many SEM tabs are open: one SEM tab among 6 tabs costs +8 % (514 against 476 MB); a second SEM tab adds 253 MB against 54; 8 tabs with 2 SEM cost +57 % (819 against 522 MB). The prototype's figure is for 8 SEM tabs alike | `review/results/memory-{head,live}.json` |
| b1 startup faster and lighter | Holds (878 against 958 ms; 210 against 292 MB), but it comes from making only the tab on show, which today's mode could do as well | `review/results/boot-*.json` |
| a hidden SEM reading of 8 images takes 2–3.6 s of main thread | 0.75–1.24 s busy over 1.2–1.5 s; keys at most 113–129 ms, and one of 512 ms in 15 readings | `review/results/semhidden*.json`, `interact-live.json` |
| "A is not needed once tabs are live" | A gives what was asked for, a refinement going on in the background, at no memory cost. Beyond A, b1 adds faster switches and SEM reading (about 1.3 s) in the background, and needs live-mode tests before it can be the default | judgement on the above |
| A: a parked run at full speed, 6.89 s | 7.60 s in repeated use, against 7.21 s on show today: each parked run lets its worker go, so the next starts cold. The pool or a spare worker removes this | `review/results/refine-bg-parked.json` |
| A: 8.1 s each for two tabs, 8.6 s for three | Three tabs take 10.0 s each and 13.1 s from first click to last end, with 35.8 s of CPU against b1's 25.6 s: A is the slowest way to run several tabs | `review/results/concur-bg-3.json` |
| on b1 + pool the live-mode test passes | It failed in 2 of 4 runs: the running mark, polled once a second, misses a 2-pattern run on 3 workers | `review/results/t-livepool*.log` |
| b1 + pool with one shared cap: 3 tabs in 8.1–8.7 s | 9.7 s for all and 9.0 s each, against 8.7 and 8.5 s with one worker per tab (+11 %). The shared cap is a trade-off for three tabs at once, not a gain | `review/results/concur-live*-3.json` |

## Not measured

- **The user's machine and browser.** The cores model is a model, and hyperthreads were not
  measured.
- **His real refinements in the app**: tens of seconds a pattern, Soller slits. Heavy
  settings were run on the bench only, and "Refine the standard first" was never run in a
  hidden frame.
- **Real background behaviour**: intensive throttling of a browser tab hidden for minutes,
  Energy Saver and Memory Saver, canvases on a GPU, Firefox and Safari.
- **Long sessions with 5–8 live frames**: memory growth per realm, and GC pauses on the one
  heap (one of 424 ms was seen with 7 tabs). Idle frames cost little: 8 tabs idle for 20 s
  used 0.9 s of renderer CPU in b1 against 0.7 s today
  (`live-tabs/results/opt-idle-*.json`).
- **b1 across the app**:
  - a run that fails while hidden;
  - SEM figure composition and export in a frame;
  - two windows, each a shell;
  - long main-thread jobs in a hidden tab other than SEM reading, such as a full-resolution
    figure export or importing many patterns.
- **Projects larger than these fixtures.** Today's switch grows with the project; nobody
  measured where it crosses 1 s.
- **A + pool + a startup that makes only the tab on show** was not built. It would give
  today's switches, the Rietveld in the background and b1's faster startup, at none of b1's
  memory.

## Recommendation

1. **The pool, first and whatever else is decided.** It is about one day of work: a new
   module and Refine's loop. Results are identical bit for bit. Refine all runs 2.4–2.5×
   faster in the app and 2.7–3.3× with heavy settings on 4 CPUs, and more on more cores. The
   cap is cores − 1 for the whole browser. It applies to HEAD now and to either option later.
2. **Then b1, the independent tabs**, because it is what was asked for and the measurements
   answer the user's worry about it:
   - **Working is not slower.** Medians stayed within 15 ms with 3–7 other tabs live, and
     with 1–3 of them refining.
   - **Everything goes on in the background**: the Rietveld at full speed, SEM's reading, and
     any later job.
   - **Several tabs refine together fastest**: 8.7 s for three, against 13.1 s in A.
   - **Switching is about 5× faster** in the user's case.
   - **It does not touch the analysis modules.**

   What it costs:
   - memory: +8 % with one SEM tab, and +220–250 MB for each further SEM tab of 8 images;
   - the first visit of a tab after a start or reload: 0.3–1.1 s;
   - one main thread shared by every tab;
   - a few behaviour changes.

   **Conditions:**
   - **Keep it off by default until the live mode has its own tests.** That means a frame
     accessor in tests/helpers.mjs, so that the module tests run in a frame (about 2 days),
     and a running mark posted when it changes rather than polled.
   - **Turn on the ceiling of 6–8 frames and SEM's release of its decoded images after 30 s
     hidden.**
   - **Use it on the user's own machine, with his real refinements and his usual tabs,
     before it becomes the default.** Two things to watch: memory, and real browser
     throttling with Energy Saver and Memory Saver. b1 stops being worth it on an 8 GB
     machine with several SEM tabs open, or if a hidden tab's main-thread work is felt.
   - **If it fails there, build A + pool.** Both are built and take 2–3 days. This is the
     fallback the user described:
     - switches as today, 0.15–0.35 s, under his 1 s;
     - the Rietveld in the background, and nothing else;
     - no extra memory;
     - each result saved as it arrives, which neither today's mode nor b1 does.
3. **Not to do.**
   - **b2**: three times the effort for the same behaviour.
   - **A and b1 together**: they do not combine (both patches change tabs.js, sessions.js and
     utils.js). A's detached run is needed only in the parked mode, which b1 as the default
     would leave to small machines.

The review would put A before b1, and b1 only if independent tabs are wanted for their own
sake. Both readings rest on the numbers above; they differ on the weight given to what the
user asked for. A is cheaper in memory and risk, keeps each result through a reload, and is
enough if the Rietveld is the only background job that matters. b1 is the independent tabs
that were asked for. On these measurements it costs memory, not working speed.

## Found along the way

- **A setting changed 300 ms before a reload was lost in 6 of 6 rounds**, and once the change
  before it as well. This happened today and in b1 alike: the autosave's flush on unload did
  not land in headless Chromium (`review/results/flush-{head,live}-300.json`). It was not
  checked in a headed browser, and it is worth a look apart from item 23.
- **The guard between the standard and the samples has a stale comment.** It says "a batch
  takes one instrumental profile throughout", which is out of date since v477: each run now
  copies the profile as it starts. What the guard still prevents is real, since samples
  refined against the old profile come out stale. A sample's Refine pressed while the
  standard refines could wait for it instead of being refused, half a day
  (`workers/README.md` §3).
- **Today's switch to an XRPD tab of 12 refined patterns depends on what the XRPD module
  last held.** It takes 0.17–0.18 s when the module last held that same project, and
  0.28–0.35 s when it held another XRPD project (`bg-runs/results/switch-head.json`,
  `live-tabs/results/switch-head.json`, `review/results/switch-head.json`). With two XRPD
  projects open, the user's case, the slower one is the usual one.
