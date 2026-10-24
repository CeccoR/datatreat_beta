# Live tabs: tabs that work while they are not on show (backlog 23, prototype)

A prototype, not implemented: nothing in the app's own files is changed. What is here: the
change as patches against v517 (`live-tabs.patch`, `live-tabs-lean.patch`), the scripts
that measured it against today's app (`measure/`), their raw output (`results/`), the small
fixtures they use (`fixtures/`). The option built is (b1) of BACKLOG.md's "Tabs that work
while they are not on show": every tab a page of its own, in a frame, live at once.

## The answer

It is worth it. Every tab live costs memory and a slower first opening, and nothing else
measured gets slower:

- **Switching** is 2.5–3.5 times quicker, the same whatever the tab holds: 49–64 ms from
  the click to the tab painted (today 122–187 ms), and no long task (today 60–70 ms of them).
- **A refinement goes on in a tab not on show** at its full speed: Refine all of the 12
  patterns 7.1 s hidden, 7.1 s on show, 7.3 s today on show. Chromium does not throttle a
  hidden same-origin frame (60 animation frames and some 240 zero timers a second).
- **Several at once**: Refine all in K tabs at once, one worker each, 1.8× the work of one
  for K = 2, 2.6× for 3, 2.9× for 4 (4 CPUs).
- **Working in the tab on show is not slowed** by 3 or 7 other tabs live, nor by 1–3 hidden
  tabs refining: a smoothing change (12 patterns again, both cards drawn) 120–139 ms median
  in every case, today 120–154 ms.
- **Startup** is quicker and lighter, the tab on show alone made: 0.79 s with 4 or 8 tabs
  stored (today 0.89–0.92 s, which reads every tab's bytes), 212 MB (today 288–383 MB).
- **Memory** is what it costs: a live tab keeps its module's derived data. Per tab, beyond
  today's parked one: an empty tab +5 MB, XRPD of 12 patterns refined +21 MB (+32 MB against
  +11 MB) and a worker, SEM of 8 images 2048² 16-bit +110 MB (+219 against +109 MB: the
  decoded images). Eight SEM tabs: 1.9 GB of renderer against 1.0 GB today.
- **Opening a tab** is a page's start: a blank tab 155–184 ms (today 102–114), a saved
  XRPD project 636 ms (374), a saved SEM project 1048 ms where today's shared cache of
  decoded images already holds it (131 ms); after a reload, nothing of them in memory,
  653 against 556 ms (XRPD) and 1036 against 804 ms (SEM).

What it takes is small, since no module changes: some 450 lines in 10 app files, with one
test, behind Settings › Tabs (off by default, so it can go in as it is and be tried); to
finish it, 3 to 5 working days (below). The memory is the limit, and two of the
optimisations measured answer it: a hidden SEM tab that lets its decoded images go (−71 MB
a tab, its switch 38 → 102 ms), and frames let go beyond a number (8 tabs kept to 3 frames:
679 → 427 MB; a tab let go comes back in 0.66 s, XRPD, or 1.05 s, SEM).

(b2), the modules turned into factories, would give the same behaviour for 10–15 days and
regressions in every module; one realm a tab costs some 7 MB, which is all (b2) would save.
Option (a), the refinement carried on in a parked tab, is not needed once tabs are live: it
helps the Rietveld alone. Several workers for one Refine all (a pool) is a separate change,
good with either: measured on the same machine at 2.5–2.6× (default settings) and 3.3× (a
heavy refinement) with 3–4 workers (b14/map-runs, the step that weighed it).

## What the prototype is

Every open tab a page of its own, live at once. The window's page becomes the *shell*: the
tab bar, Home, Projects and Settings. Each tab is `index.html?embed=<tab id>` in an iframe of
the shell, a *tab page*: the whole app in an embedded mode, its own realm (module instance,
DOM, undo history, workers), showing one module and its project bar. A switch hides one
frame and shows another; nothing is parked or restored, nothing stops. No module file is
touched: tauc, xrd*, gc, epr, sem*, modkit, cards and plot run as they are, one instance per
realm, so the singletons of the inventory (72 document-level lookups, 141 template ids, the
registries keyed by module) need no change. The frames are same-origin and not sandboxed:
the CSP (no frame-src, child-src or default-src) allows them, downloads, file pickers and
drops work in them, and the service worker serves `index.html?embed=…` from its cached
`index.html` (it matches with ignoreSearch), so sw.js is unchanged.

`live-tabs.patch` (git diff against v517 b93ed5c; `git apply --check` clean):

| file | lines | what |
|---|---|---|
| tabs.js | +337 | the shell's frames, a tab page's side, the knobs, Settings › Tabs |
| utils.js | +40 −10 | a `storage` listener (settings, theme, recent colours set in one page are every page's at once: to v517 each page read them once); `registerTabSleep`/`tabSleep` |
| db.js | +28 | `readTabState(id)`, `patchTabRec(id, fields)`, `putTabRec(rec, keep)` |
| style.css | +16 | the frames below the shell's top bar; a tab page without header or footer |
| sessions.js | +14 | a tab page has no Projects list (its saves have the shell draw it again), leaves the sweep and the database notices to the shell |
| boot-head.js | +14 | `html.embed` in a tab page; `html.live-shell` when `localStorage['datatreat-live-tabs'] === 'on'` |
| sem.js | +14 | its sleep: the decoded images let go while hidden (knob `free`) |
| figure.js | +10 | the composer's memories pruned by tab only where the page knows every tab |
| index.html | +7 | Settings › Tabs: "One live at a time" (default) or "Each live (prototype)" |
| boot-body.js | +5 | a tab page leaves the hash and the service worker to the shell |
| tests/livetabs.test.mjs | +114 | one test of the live mode, 7 s |

How the two sides work:

- **The shell** keeps each tab's meta (module, title, dirty, project) and its frame, made
  when the tab is first shown. It writes the order and the tab on show alone
  (`patchTabRec`, a read and a write in one transaction), never a state. Its own modules
  stay idle: the Projects list's CSV export of a saved project runs on them, as today.
- **A tab page** reads its own record with its files' bytes (`readTabState`), restores it as
  today's startup does, and writes its state as today's autosave does, with the order and
  the tab on show kept as the shell wrote them (`putTabRec(rec, ['order', 'active'])`: one
  transaction, and a record deleted meanwhile is not made again). Its project bar, banners,
  modals, composer and pickers are its own. A tab it opens (Save as, New project in its
  bar) it writes as a record, then the shell adopts it.
- **IndexedDB, written from several realms**: each realm has its own connection and its own
  queue of writes (db.js, v517), so between realms the order is the database's: two
  read-write transactions on the tabs store run one after the other. Each side writes its
  own fields of a record, read and written in one transaction, so neither undoes the
  other's; a tab page that writes after its record was deleted (its tab closed meanwhile)
  writes nothing; the sweep of bytes, which a tab page may run after a delete, is the one
  transaction over both stores' refs indexes that db.js already made for several windows.
- **They talk by postMessage only**, never by objects: an array made in one realm fails
  another's `instanceof` (29 such checks in the app). Up: `ready`, `meta` (title, dirty,
  project), `busy` (a job runs: ⟳ on the tab), `adopt`, `closed`, `flushed`. Down: `shown`,
  `hidden`, `title` (renamed in Projects), `close?`, `flush`, `key`.
- **Keys**: a click on the bar moves the focus into the frame shown, so Ctrl+Z/Y and ←/→
  reach it; a key pressed with the focus left in the shell is forwarded.
- **Closing** a tab asks in its page: a hidden tab with unsaved work is shown first, then
  asked (today the question comes over the tab on show). A saved, unchanged tab with no
  frame closes at once.
- **Letting a frame go** (hibernate): the page writes its state, the shell removes the frame,
  and makes it again when the tab is shown (its undo history is not kept: as after a
  reload). Never the tab on show, never a tab where a job runs. Knobs `max` (frames kept,
  the ones shown longest ago let go) and `idle` (minutes not shown).

Knobs, in localStorage as `datatreat-live-<k>` (the measurements set them): `tabs` on/off,
`eager` 1 (every frame made at startup), `max` N, `idle` M, `free` S (seconds hidden
before a module lets its caches go; SEM alone has any), `hide` visibility (frames hidden by
`visibility:hidden` and laid out, instead of `display:none`).

`live-tabs-lean.patch`, on top: a tab page loads its own module alone, not the five
(`modules.js`, imported by tabs.js with a top-level await; the frame's address carries
`&m=<module>`; one line in sw.js's ASSETS). It saves little: an empty tab 5.5 MB of RSS and
1.5 MB of heap instead of 7.1 and 2.1, an XRPD tab nothing (4 tabs: 286 against 287 MB:
its graph is most of the app's), a blank DRS, GC, EPR or SEM tab opened in 139–143 ms
instead of 155–184 (XRPD's 172 either way), a startup 778 against 791 ms. Kept apart, for
later.

## How to apply and run

```sh
git apply proto/live-tabs/live-tabs.patch          # clean on v517 (b93ed5c)
git apply proto/live-tabs/live-tabs-lean.patch     # optional, on top
python3 -m http.server 8000                        # Settings › Tabs › "Each live (prototype)"
node --test tests/livetabs.test.mjs                # the live mode's test (npm test: all)
```

Off (the default) the app is v517's: the whole test suite passes on the patched tree (184
of 184, the new one among them, in 9.4 min: `results/suite-patched.log`). The measurements
compare copies of the tree, each on its own port (the scripts' defaults; `HEAD_BASE`,
`LIVE_BASE` change them):

```sh
R=$PWD D=/tmp/dt-live; mkdir -p $D/head $D/live $D/lean
git archive HEAD | tar -x -C $D/head
git archive HEAD | tar -x -C $D/live && (cd $D/live && git apply $R/proto/live-tabs/live-tabs.patch)
cp -a $D/live/. $D/lean && (cd $D/lean && git apply $R/proto/live-tabs/live-tabs-lean.patch)
python3 -m http.server 8971 --bind 127.0.0.1 --directory $D/head &
python3 -m http.server 8972 --bind 127.0.0.1 --directory $D/live &
python3 -m http.server 8973 --bind 127.0.0.1 --directory $D/lean &
proto/live-tabs/measure/run-all.sh          # 2.5 h, 4 CPUs (SKIP_MEMORY, SKIP_LEAN, SKIP_CEILING)
node proto/live-tabs/measure/summary.mjs    # the tables below, from results/*.json
```

Each script says at its head what it does and takes; they run alone too (`node
measure/switch.mjs live 7`). Playwright is the global one
(`/opt/node22/lib/node_modules/playwright`, Chromium 141.0.7390.37); the 8 SEM TIFFs are
made by tests/fixtures.mjs makeTiff into the system's temporary directory.

## Method

This machine: 4 CPUs (Intel Xeon, 2.1 GHz), 16 GB, Linux; headless Chromium 141 through
Playwright 1.56, viewport 1400 × 900, service workers blocked (but in `sw.mjs`), nothing
else running while timing. Fixtures: the 12 XRDML scans s00–s11 (5384 points each), the
SrTiO3 CIF, 2 DRS spectra, 2 GC runs, an EPR pair, 8 SEM TIFFs of 2048 × 2176, 16-bit
(8.9 MB each). "XRPD refined": the 12 patterns, the CIF on the default Rietveld card,
Refine all run to its end without the standard. Today is HEAD (v517) on 8971, live tabs the
patched tree with `tabs` on, on 8972.

- **Memory**: after `HeapProfiler.collectGarbage` (twice), the renderer process's VmRSS and
  Pss (`/proc/<pid>/status`, `smaps_rollup`; the page's renderer, the largest), the JS heap
  of the page's isolate (`Runtime.getHeapUsage`: same-origin frames share one isolate, so it
  holds every tab), each worker's heap (attached through `Target.setAutoAttach`). Tabs
  built one after the other in one browser, measured after 1, 2, 4 and 8.
- **Time**: in the page, `performance.timeOrigin + performance.now()`, comparable between
  the shell and its frames. A click is dispatched in the page; done is two animation frames
  in the realm that shows the result, once its loader is gone (today's restore, a frame's
  start). Long tasks: a PerformanceObserver in every realm, by their start. Medians of 5 to
  9, the raw values in the JSON.
- **Interaction**: in the XRPD tab on show (12 patterns refined), the smoothing width set to
  the other of 0.25 and 0.30° and dispatched as a change (the 12 patterns smoothed again,
  both cards drawn, a commit), and the next sample (→); 9 each, 300 ms apart.

## Numbers

### Memory (renderer RSS MB / JS heap MB / workers)

| N tabs | empty: today | empty: live | XRPD refined: today | XRPD: live | SEM 8 images: today | SEM: live |
|---|---|---|---|---|---|---|
| 0 | 128 / 2.9 | 128 / 2.9 | 128 / 2.9 | 129 / 2.9 | 128 / 2.9 | 129 / 2.9 |
| 1 | 136 / 3.9 | 145 / 6.3 | 187 / 12.6 / 1 | 196 / 15.0 / 1 | 353 / 95 | 364 / 97 |
| 2 | 139 / 3.9 | 151 / 9.2 | 196 / 15.2 / 1 | 229 / 26.4 / 2 | 450 / 185 | 585 / 191 |
| 4 | 142 / 4.0 | 163 / 13.3 | 205 / 20.3 / 1 | 287 / 46.7 / 4 | 634 / 367 | 1015 / 376 |
| 8 | 143 / 4.1 | 185 / 19.7 | 217 / 30.6 / 1 | 387 / 84.6 / 8 | 999 / 730 | 1877 / 745 |
| per tab | +2 / +0.2 | +7 / +2.1 | +11 / +3.5 | +32 / +10.2 | +109 / +91 | +219 / +93 |

The JS heap of a SEM tab is its files' bytes as base64 (91 MB for 8 images), in both: today
a parked tab keeps them too. What a live SEM tab adds is outside the heap: its decoded
images (8 × 8.4 MB Uint16Array), its canvases, its reading worker. A live XRPD tab adds its
derived data (+7 MB of heap) and its Rietveld worker (2 MB of heap idle, some 7 MB of RSS).
An empty realm, the whole app evaluated again in a frame, costs 2 MB of heap and 7 MB of
RSS: V8 shares the compiled code between the frames. With 8 tabs, every process of the
browser: 242 against 197 MB (empty), 453 against 276 (XRPD), 1998 against 1114 (SEM).
Up to the app's limit, MAX_TABS 20, of SEM tabs with 8 images each (`results/*-ceiling`):
live 4435 MB of renderer and 1848 MB of heap, 20 frames, 20 workers, nothing failed;
today 2095 and 1818 MB. The heap is the files' base64 in both, and its limit (4096 MB, one
for every tab) would come at some 44 such tabs either way; what live adds is outside it,
some 108 MB a SEM tab, and meets the machine's memory first: 4.4 GB is fine on these 16 GB,
not on an 8 GB laptop with a browser full of other tabs.

### Switching (click → tab painted, ms, median of 7, p90)

| to | today | live (display:none) | live (visibility:hidden) |
|---|---|---|---|
| XRPD refined | 183 (236) | 64 (78) | 55 (62) |
| SEM 8 images | 149 (179) | 54 (64) | 51 (75) |
| DRS | 187 (222) | 54 (72) | 47 (66) |
| GC | 170 (192) | 50 (65) | 44 (46) |
| EPR | 122 (147) | 49 (53) | 44 (50) |

Five tabs, each loaded, shown in turn 7 times. Today's switch is a restore (60–70 ms of
long tasks for XRPD, DRS, GC); live it is two frames and a paint (no long task). A frame
hidden by `display:none` keeps its size: what it draws while hidden is drawn at it, and a
window resized meanwhile gives it a resize as it is shown. `visibility:hidden` saves a few
ms more, keeping the hidden frames laid out; `display:none` is kept.

### Opening a tab (click → tab painted, ms, median of 5)

| tab | today | live |
|---|---|---|
| blank XRPD / DRS / GC / EPR / SEM | 114 / 103 / 103 / 102 / 104 | 169 / 169 / 155 / 184 / 169 |
| saved XRPD refined, from Projects, then shown | 374 | 636 |
| saved SEM 8 images, from Projects, then shown | 131 | 1048 |
| the same, the app reloaded first (nothing of it in memory): XRPD / SEM | 556 / 804 | 653 / 1036 |
| a tab let go, shown again: XRPD / SEM | (a switch) | 662 / 1048 |

A live tab's opening is its page's start (the module graph evaluated again, some 60 ms) and
its restore, as today's. Today's SEM opens in 131 ms because the decoded-image cache, one
for every SEM tab, already holds those images; a frame decodes its own.

### Working in the tab on show (event → painted, ms, median / p90 / max of 9)

| while | smoothing: today | live | next sample: today | live |
|---|---|---|---|---|
| no other tab | 136 / 162 / 162 | 128 / 168 / 168 | 73 / 83 / 83 | 59 / 107 / 107 |
| 3 others (SEM, XRPD, DRS) | 120 / 136 / 136 | 120 / 156 / 156 | 60 / 73 / 73 | 62 / 94 / 94 |
| 7 others (+ GC, EPR, SEM, XRPD) | 126 / 139 / 139 | 134 / 149 / 149 | 66 / 77 / 77 | 67 / 75 / 75 |
| its own Refine all running | 154 / 195 / 195 | 138 / 166 / 166 | 67 / 90 / 90 | 72 / 87 / 87 |
| 1 hidden tab refining | – | 123 / 142 / 142 | – | 68 / 91 / 91 |
| 2 hidden tabs refining | – | 139 / 173 / 173 | – | 71 / 99 / 99 |
| 3 hidden tabs refining | – | 136 / 216 / 216 | – | 80 / 101 / 101 |

Hidden tabs live, idle, cost the tab on show nothing measurable; hidden refinements run in
their workers, and their pages take each result on the main thread in about a millisecond
(the first up to 200 ms, b14/map-runs). With 3 refining on 4 CPUs every core is busy: the
next sample goes 59–67 → 80 ms, the largest of 9 smoothing changes to 216 ms. The hidden
runs took 8.2–10.9 s each meanwhile by the script's clock, which adds some 0.8 s of its own
(7.1 s alone, timed in the page).

### A refinement where it runs (Refine all, 12 patterns, ms, median of 5)

| | on show | hidden | hidden frame: animation frames / setTimeout(0) a second |
|---|---|---|---|
| today | 7267 | (asked to stop) | – |
| live, display:none | 7077 | 7135 | 61 / 235–241 |
| live, visibility:hidden | 7319 | 6904 | 61 / 229–237 |

| tabs refining at once (one worker each) | each run | all of them | work done vs one |
|---|---|---|---|
| 1 | 6835 | 6835 | 1.00× |
| 2 | 7612 | 7639 | 1.80× |
| 3 | 7837 | 7838 | 2.60× |
| 4 | 9002 | 9325 | 2.90× |

On more cores: each run is a worker, a thread of its own, and the main thread does little
for it, so K runs at once go on scaling up to about the cores less one (the page's own);
memory does not depend on the cores (a worker each: some 2 MB of heap and 7 MB of RSS
idle, 15–42 MB of heap at its peak while it runs, b14/map-runs).

### Startup with N tabs stored (navigation → the tab on show painted, ms, median of 5)

| N | today | live, lazy (default) | live, eager (every frame at once) |
|---|---|---|---|
| 4 (XRPD refined, SEM, DRS, GC) | 894; 288 MB, 105 MB heap | 791; 212 MB, 15 MB heap | 1979 (all 2068); 421 MB |
| 8 (+ EPR, XRPD, SEM, DRS) | 915; 383 MB, 197 MB heap | 792; 217 MB, 15 MB heap | 3422 (all 3617); 643 MB |

Today's startup reads every tab's record with its bytes and keeps them all parked; live
reads the records' meta, and the tab on show alone reads its own. Eager startup makes
every frame at once and the tab on show waits behind them all (one main thread): lazy it is.

### Idle

8 tabs open (XRPD ×2, SEM ×2, DRS ×2, GC, EPR), nothing done for 20 s: the renderer's CPU
0.9 s live, 0.7 s today (a frame looks at its job once a second); renderer 677 against
492 MB.

## Limits

Checked in the app (`measure/limits.mjs`, `results/limits.json`; `measure/sw.mjs`,
`results/sw.json`), all as they should be:

- Keys: after a click on the bar Ctrl+Z, Ctrl+Y undo and redo in the tab on show (the focus
  moved into its frame); with the focus left in the shell (its header clicked) Ctrl+Z and →
  are forwarded to it; a hidden tab's history is never touched.
- A file dropped on a frame's dropzone is read there; a download started in a frame (the
  project's CSV) reaches the browser.
- The decimal separator set in Settings, and the theme toggled in the shell, are every
  frame's at once.
- A project saved in a frame is in the shell's Projects list; renamed there, its tab's label
  and its page's name field follow; saved and unchanged, no "*".
- A hidden tab with unsaved work closed from the bar is shown and asked there; "Don't
  save" closes it and its frame goes.
- Leaving a tab while Refine all runs asks nothing; the bar marks it (⟳); its 12 results are
  written while it is hidden, the tab marked changed; one undo then takes the run back and
  one redo brings it again, as after a run on show.
- A window open in a frame (the XRPD standard's) no longer keeps the bar from switching.
- After a reload: the order the shell wrote, the state each frame wrote (a smoothing width,
  12 results), and one frame made, the tab on show's.
- With the service worker on: the frames are loaded through it and controlled by it, and
  register none of their own; offline, the shell and a new tab's frame come from its cache.

What stays a limit:

- **One process, one main thread, one heap.** Same-origin frames share the renderer
  process, its main thread and its V8 isolate (one JS heap limit, 4096 MB here, for every
  tab). A worker runs beside them, but what a hidden tab does on its main thread (a SEM tab
  reading 8 images, 2–3.6 s; an XRPD tab's 12 patterns read) holds the tab on show
  meanwhile; refinements, in their workers, do not. A renderer that runs out of memory
  takes every tab with it, as today.
- **Memory grows with what is open**: some 220 MB a SEM tab of 8 big images (110 MB more than
  today), 32 MB an XRPD tab, 7 MB an empty one. Twenty SEM tabs of 8 images, the most the
  app opens: 4.4 GB live, 2.1 GB today. The SEM sleep and a limit of
  frames bring it back near today's.
- **Opening is slower**: +53–82 ms a blank tab, +100–260 ms an XRPD project; a SEM project is
  decoded again in each tab that holds it (no cache shared between tabs).
- **Behaviour that changes**: a window open in a tab (a composer, the XRPD standard's, a
  banner) covers that tab alone, and the bar still switches; a hidden tab's question
  (closing with unsaved work) shows the tab first; a tab let go comes back without its undo
  history; settings and the theme reach every page through the storage event, so also
  other windows of the app now.
- **Not done in the prototype**: the composer's memories of a closed tab are forgotten by
  its page only (one closed from the shell without a frame keeps them); several windows of
  the app, each a shell, would each make frames of the same tabs (as today two windows
  restore the same tabs); a job's mark on the tab is looked for once a second.

## Optimisations tried

| what | measured | verdict |
|---|---|---|
| frames made on first show (lazy) | startup 0.79 s and 212 MB against eager 1.98–3.42 s, 421–643 MB | the default |
| a hidden SEM tab lets its decoded images go (`free` 0 s) | 4 hidden SEM tabs: 1021 → 737 MB; a switch to one 38 → 102 ms (its image read again) | worth it; in use after some 30 s hidden (the same memory, later) |
| frames kept to N, the others let go (`max` 3) | 8 tabs: 679 → 427 MB, 4 → 2 workers; one let go shown again in 662 ms (XRPD) / 1048 ms (SEM) | worth it as a ceiling (6–8 frames), not lower |
| two frames let go (XRPD + SEM) | 438 → 193 MB, workers 2 → 0 | |
| a tab page with its own module alone (lean) | an empty tab 5.5 MB RSS, 1.5 MB heap (7.1, 2.1); XRPD the same; a blank tab opened in 139–143 ms (155–184; XRPD 172 both) | a small gain: later |
| hidden by visibility:hidden, laid out | switches 44–55 ms against 49–64 | not worth the layout kept |

## Effort, to do it for real

- **(b1), from this prototype**: 3 to 5 working days with tests. The prototype took one,
  with no module touched. Left: tests for the live mode (a frame accessor in
  tests/helpers.mjs so that the module steps run in the tab's frame, most of the 342
  selectors unchanged, about 1–2 days; the suite as it is keeps testing the parked mode,
  which can stay as the setting's other choice); the hibernation policy and its setting
  (frames kept; SEM's sleep after 30 s); the lean frames' module order checked
  (top-level await); the composer's memories of a tab closed from the shell; the frames'
  focus and titles for accessibility; the service worker's update (the shell reloads the
  frames with it, a frame never by itself); the narrow layout looked at (each frame scrolls
  in itself below the shell's bar).
- **(b2), the factories**: 10–15 days (the inventory: 17 files, some 700 lines, every
  module's DOM wiring, 400 lines of tests), for the same behaviour.
- **(a), a refinement in a parked tab**: a few days; writing a result into a parked state
  costs some 25 ms (park 2.3, key 1.1, decode 5.7, write 15 ms, b14/map-runs), but it helps
  the Rietveld alone and keeps the parking. Not needed with (b1).
- **The worker pool for Refine all**: independent of the above, in xrd-rv.js: 2.5–3.3× on
  4 CPUs (b14/map-runs).

## Files

- `live-tabs.patch`, `live-tabs-lean.patch`: the change, against v517.
- `measure/lib.mjs`: fixtures, the browser, memory, the driver (the same steps on today's
  tabs and on live ones), timing. `memory.mjs`, `switch.mjs`, `open.mjs`, `opencold.mjs`,
  `interaction.mjs`, `refine.mjs`, `boot.mjs`, `opt.mjs`, `limits.mjs`, `sw.mjs`: one
  measurement each; `run-all.sh` all of them; `summary.mjs` the tables.
- `results/`: each run's JSON and console log (`<name>.json`, `<name>.log`; `-lean`: the
  lean frames; `-ceiling`: up to 20 tabs), `summary.txt`; `run-all.log` and `run-rest.log`
  (the last steps, run again after a fix of the scripts) say which ran when.
- `fixtures/`: the 12 XRDML scans, the CIF, DRS, GC and EPR files the scripts read.
