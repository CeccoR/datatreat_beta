# The core and XRPD made per tab (b2): core.patch, xrd.patch

(b2v2, `NOTES-v2.md`: the trim these notes describe is gone from every module, and a
sleeping SEM tab now lets go of its files' bytes. These notes record the first version as it
was built and measured.)

The notes of b2's first stage: the shell, the registries, the sessions, the kit, cards,
plots and the workers' pool (`core.patch`), and XRPD made per tab on it (`xrd.patch`).
`README.md` is the whole of b2; `API.md` says how a module is made per tab, with XRPD as the
worked example. At this stage SEM, DRS, GC and EPR were still single instances on the
compatibility path; their own notes are NOTES-sem.md, NOTES-drs.md and NOTES-gc-epr.md.

## What is here

| file | what |
|---|---|
| `core.patch` | **The core**, a git diff against HEAD (9f2a12e, app files b93ed5c): the shell, the registries, the sessions, the kit, cards, plots, the pool. XRPD, SEM, DRS, GC and EPR stay single instances through the compatibility path |
| `xrd.patch` | **XRPD made per tab**, a git diff against HEAD + core.patch: xrd.js, xrd-peaks.js, xrd-rv.js and XRPD's tests only |
| `API.md` | How a module becomes a factory, with XRPD as the worked example |
| `measure/` | One script per measurement, `lib.mjs` and `run-all.sh` |
| `results/` | Each measurement's JSON and the two full test-suite logs |

Applying:

```sh
git apply --check proto/live-tabs-b2/core.patch && git apply proto/live-tabs-b2/core.patch
git apply --check proto/live-tabs-b2/xrd.patch  && git apply proto/live-tabs-b2/xrd.patch
npm test                                   # or node --test tests/b2xrd.test.mjs
```

Both patches were checked with `git apply --check` on a git-archive copy of HEAD, one after
the other. The result is identical, file by file, to the tree the suite ran on. To take them
out, use `git apply -R` in reverse order.

## What changed

**core.patch** (17 files, +1109 −296; of these, the pool's `xrd-rv-pool.js`,
`tests/rvpool.test.mjs` and Refine's loop in `xrd-rv.js` are `proto/workers/pool.patch` as
it was):

- **utils.js**
  - Every registry is keyed by the instance's key: history, redraw, busy, CSV, has-data, and
    the section on show (`shownKey()`). A module's name stands for its instance on show.
  - `registerModule`, `makeInstance`, `attachInstance`, `detachInstance`, `dropKey`.
  - `withState` makes a throwaway instance to read a saved project's CSVs.
  - `onAnyChange` (every history's changes, with their key) and `busyChanged` / `onBusyChange`.
  - The undo keys act on the instance on show.
  - `setupDropzone` and `renderUnifiedFileList` take elements.
  - The instructions' info buttons work by delegation, so a copied section's buttons work.
  - Settings `sleepMin`, `liveMax`, `livePolicy` and `liveMB`.
- **tabs.js**
  - Live instances per tab: show, hide, trim, sleep, wake.
  - The busy exemption with the countdown from the job's end.
  - The LRU over `liveMax`, or the budget by memory over each instance's `bytes()`.
  - Settings › Tabs in the background.
  - `sleepTick` (the rules run as if time had passed: the tests' hook) and `tabsNow`.
  - Modules not converted keep v517's parking and its question before a busy tab is left.
- **sessions.js**
  - Each tab has its own autosave, unsaved marker and save, shown or not. A tab closed with
    Save is saved as it is, without being shown first.
  - A saved project's CSVs are read through a throwaway instance.
- **db.js**: `park` and `decode` share frozen arrays of numbers instead of copying them.
- **cards.js**: the deck's menu goes in the instance's layer, and `deck.destroy()` removes its
  document and window listeners.
- **modkit.js**: `moduleKit(mod, { …, root, key, layer })` and `kit.destroy()`.
- **plot.js**: downloads find their svg and legend from the button outward; `releasePlot`.
- **figure.js**: the composer's memory is keyed by the tab that owns the plot.
- **index.html**: the Settings rows.
- **style.css**: `.inst-layer`.

**xrd.patch** (6 files, +369 −43, of which 222 lines are the new test): XRPD as a factory, as
`API.md` §11 describes.

## Tests

The whole suite was run with `node --test --test-concurrency=1 "tests/*.test.mjs"` from each
tree, about 10 min each:

| tree | result | log |
|---|---|---|
| HEAD + core.patch | 187 of 187 pass (183 + the pool's 4) | `results/suite-core.log` |
| HEAD + core.patch + xrd.patch | 192 of 192 pass (+ `b2xrd.test.mjs`'s 5) | `results/suite-xrd.log` |

`tests/b2xrd.test.mjs` covers:

- two XRPD tabs awake at once: each its own files, view and undo; a switch to an awake tab
  shows its own section, with nothing restored and no loader;
- a refinement started in a tab and left there, run on the pool: its results identical bit
  for bit to one refined on show, its step in its history, its record written and its "*"
  shown while hidden;
- sleep after the Settings' minutes, through `sleepTick`;
- the busy exemption: still awake 11 minutes after its start while it runs; awake 9 minutes
  after its end; asleep 11 minutes after;
- the limit by number (L = 1) and by memory;
- the LRU (L = 2, four tabs);
- a wake with the whole history, undone step by step to the empty start and redone;
- a hidden tab closed with Save, reopened from Projects, and a reload.

One existing test changed: `rvui.test.mjs` C. Leaving a refining XRPD tab for another project
no longer asks to stop the run, and the test now checks that nothing is asked and the run
goes on.

## Measured

**Method.**

- **Machine.** 4 vCPUs, 16 GB, Linux; headless Chromium through Playwright, viewport
  1400 × 900, service workers blocked.
- **Trees.** HEAD on :8994 and HEAD + both patches on :8993, git-archive copies served by
  `python3 -m http.server`.
- **Files.** Dropped through a `DragEvent` (`lib.mjs drop`). Playwright's `setInputFiles`
  keeps a hold on the input it fills, which keeps that tab's instance from ever being
  collected; found with a WeakRef and a heap snapshot.
- **Fixtures.** `proto/live-tabs/fixtures/`. "12 refined" means s00–s11 with the SrTiO3 CIF
  on card 2, Refine all without the standard, on the pool (cap 3).
- **Time.** In the page, from the click's dispatch to two frames after the loader is gone.
  Long tasks come from a PerformanceObserver.
- **Memory.** Measured after a forced GC (CDP `HeapProfiler.collectGarbage`, twice): the
  page's JS heap (`Runtime.getHeapUsage`), Blink's DOM node counter
  (`Memory.getDOMCounters`) and the renderer's VmRSS from /proc. The workers' idle time is
  set to 1 s (localStorage `datatreat-rv-idle`), so that none is left in the numbers.
- **Medians** of 7 unless said otherwise. One measurement at a time, nothing else running.

**Switching**, the user's case: two XRPD tabs of the 12 refined (X1, X2) and a DRS tab (D),
median ms with long tasks in brackets (`results/switch.json`):

| | HEAD | b2 |
|---|---|---|
| X1 → X2 | 312 (224) | 116 (65) |
| X2 → X1 | 312 (230) | 93 (66) |
| X1 → D | 188 (75) | 89 (51) |
| D → X1 | 187 (67) | 57 (0) |

DRS is not converted, but its one instance keeps holding D while an XRPD tab is on show. So
going back to D restores nothing either.

**An XRPD tab's three states hidden.** A tab of the 12 refined, a blank XRPD tab on show;
the whole page's memory; the time to show the tab again (`results/tiers.json`; wake is the
median of 5):

| A hidden | JS heap | DOM nodes | renderer RSS | shown again |
|---|---|---|---|---|
| awake | 12.4 MB | 7212 | 220 MB | 82 ms |
| trimmed (hidden 60 s) | 7.7 MB | 7212 | 197 MB | 409 ms |
| asleep (hidden 10 min) | 7.5 MB | 3867 | 176 MB | 485 ms (woken) |

The switch to the blank tab took 61 ms.

**Memory with k tabs of the 12 refined**, hidden, and a blank XRPD tab on show
(`results/memory.json`):

| k | HEAD (parked) heap / RSS | b2 awake heap / RSS |
|---|---|---|
| 1 | 10.9 / 218 MB | 12.3 / 223 MB |
| 2 | 13.5 / 234 MB | 19.3 / 240 MB |
| 3 | 16.1 / 271 MB | 26.4 / 259 MB |
| 4 | 18.6 / 272 MB | 33.3 / 274 MB |

The same 4 tabs in b2: trimmed 14.1 / 250 MB; asleep 12.7 / 214 MB.

- **Awake.** Each hidden tab of the 12 refined adds 7.0 MB of heap; a parked tab in v517
  adds 2.6 MB. Both add about 17 MB of RSS, which measures coarsely at this size.
- **Trimmed.** That surplus goes down to under 1 MB of heap.
- **Asleep.** The four tabs cost 5.9 MB of heap less than v517's parked ones: a parked state
  now shares its patterns' arrays with its history (db.js), where v517's copied them,
  1.5 MB a tab.
- **The cap.** The default limit keeps at most 6 tabs awake and hidden. For XRPD tabs like
  these that is some 26 MB of heap beyond v517 (6 × 4.4 MB) before any trim, and about 2 MB
  after it. XRPD is far from the 3 GB allowed; SEM is the module that will spend it
  (`API.md` §12).

**What a hidden awake tab holds beyond its sleep**, against its estimate (`bytes()`, used by
the limit by memory; `results/bytes.json`):

| XRPD tab | heap | DOM nodes | estimate |
|---|---|---|---|
| blank | 0.1 MB | 1456 | 1.0 MB |
| 12 patterns | 3.2 MB | 2535 | 4.0 MB |
| 12 refined | 5.2 MB | 3345 | 6.3 MB |
| 12 refined, trimmed | 0.3 MB | 3345 | 1.3 MB |

**A tab put to sleep is collected.** A WeakRef to its section is emptied after a GC, and DOM
nodes fall back to the blank tab's 3867, for tabs blank, of 12 patterns and of 12 refined
(`results/leak.json`).

**The memory cuts.**

- **At hide: none.** XRPD has nothing it can remake in under ~50 ms. While deciding, the 12
  patterns' processing took 67–86 ms to remake and the plots 120–240 ms to redraw, timed in
  the page.
- **After 60 s hidden: trim.** It drops the plots, the patterns' processing and the
  Rietveld curves kept: 4.7 MB of heap and 23 MB of RSS per tab, at +0.33 s on the next
  show (above).
- **Always.**
  - xrd-peaks no longer computes a fourth array per pattern that nothing read: 0.5 MB per
    Scherrer card of 12 patterns.
  - Parked states share frozen arrays (above).
  - The cache of files read is per module, keyed by the bytes, so a woken tab reuses its
    patterns' arrays.
  - The engine's caches live in the pool's workers only, kept 60 s idle.

**A refinement in a tab not on show.** Tab A refines the 12 patterns hidden while tab B (the
12 refined) is on show and its next sample is pressed every 250 ms. 3 runs
(`results/background.json`):

| | hidden, with B worked in | on show, nothing else |
|---|---|---|
| Refine all, 12 patterns, pool of 3 | 4.3 s | 3.7 s |

| B's next sample (→, both cards drawn) | median | max |
|---|---|---|
| while A refines | 84 ms | 126 ms |
| nothing running | 61 ms | 76 ms |

The hidden run draws nothing until its tab is shown. The difference is B's own drawing
competing for the 4 cores with the 3 workers. Its results are identical to those of a run on
show (`b2xrd.test.mjs`).

**Ids** (`results/ids.json`): an XRPD tab of the 12 refined has 2050 elements, 141 of them
with an id, and 45 attributes naming one. Taking its section and layer out of the page and
back costs 19.9 ms; a swap of ids, rewriting the 45 references, costs 19.1 ms. Most of either
is the section's style and layout. The shell detaches, because a swap must rewrite every
reference and leaves hidden instances in every page-wide query (`API.md` §3).

## Behaviour changes, limits, and what is not done

**Behaviour changes for XRPD tabs:**

- Leaving a tab asks nothing: its run goes on.
- Closing a busy tab asks "… is running in “T”: closing this tab stops it".
- A tab closed with Save is saved without being shown.
- A tab shown after 60 s hidden takes about 0.4 s (its plots are redrawn), after 10 min about
  0.5 s (woken); v517 takes 0.31 s at every switch.
- The page's scroll is kept across a switch, as in v517 (`xrdcards` N1 checks it).

**The compatibility path.** Modules not converted (SEM, DRS, GC, EPR) behave as in v517: one
instance, parked when another tab of theirs comes in, a question before a busy tab is left.
One improvement comes free: their instance keeps holding its tab while a converted module's
tab is shown, so going back to it restores nothing.

**Limits:**

- One main thread and one JS heap for every tab, as in b1 (`ASSESSMENT.md`).
- A hidden tab's work shares the page's thread. XRPD's hidden runs only write results
  (draws wait for the show). SEM's reading of images would be the heavy case.
- The parked history of a sleeping tab stays in memory, as v517 keeps every parked tab's.
- **Timers.** The browser throttles timers in a page left in the background: sleep and trim
  then come late (the next due check is set again when it fires). Chrome's Memory Saver
  discards the whole page, every tab with it, as in v517.

**Not done:**

- SEM, DRS, GC and EPR are not converted. `API.md` §12 gives each one's work.
- Two windows of the app are not handled beyond v517: each has its own tabs and shares the
  pool's cap.
- The composer can only be open over the tab on show (as in v517, the window covers the bar).

**Effort left**, by the inventory's counts and XRPD's conversion:

- DRS, GC, EPR: about half a day each through the kit.
- SEM: 2–3 days (its own lookups, its reading worker as a pool, its figure composer, the trim
  of its decoded images).
- Then the four modules' two-tab tests.
