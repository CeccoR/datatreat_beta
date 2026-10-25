# GC and EPR made per tab (b2): gc-epr.patch

`gc-epr.patch` makes GC (gc.js) and EPR (epr.js) factories as `API.md` says: one live
instance per GC or EPR tab that is awake, in one page. It is a git diff against HEAD +
`core.patch`. It touches gc.js, epr.js, one test of `tests/tabs.test.mjs` (below), two rows
of `tests/README.md` and one new test file, `tests/b2gcepr.test.mjs`. index.html and
style.css needed no change (below).

- `git apply --check` is clean on HEAD + core.patch, and on HEAD + core + xrd + drs + sem.
- xrd.patch, drs.patch and sem.patch also apply after it; the only file it shares with them
  is tests/README.md, in rows of its own.
- Applied to a fresh git-archive copy of HEAD after core.patch, the tree is identical, file
  by file, to the one the whole suite passed on.

```sh
git apply proto/live-tabs-b2/core.patch && git apply proto/live-tabs-b2/gc-epr.patch
node --test tests/b2gcepr.test.mjs tests/tabs.test.mjs
```

## What changed in gc.js (+68 −16)

- **The factory.** `(function(){ … })()` became `createGc({ key, root, layer, shown })`,
  registered with `registerModule('gc', createGc)`. It returns `{ destroy, bytes }`. The
  body keeps its place and indentation, as XRPD's and DRS's did.
- **The kit.** `moduleKit('gc', { root, key, layer, … })`: the registries go by the tab's
  key; the file list, drop zone and alerts are the instance's own; the kinds' menu goes in
  the layer.
- **Lookups.** The 5 page-wide lookups are gone:
  - the alerts, `gcAnalyses`, `gcResList` and `gcResultsBar` are looked up in `root`;
  - a card's elements (`gc<id>Svg1`, its parameter table, legends) are looked up in its card,
    those of its section of the Results (`gc<id>SvgRate`, `SvgCum`, `SvgBar`, their
    legends) in that section: `gcCard`'s `$` tries the card, then the section.
- **Drawing on show only.** `drawable()` is `shown()`, or marks the instance stale.
  - `computeAndRenderGc`, `updateRegression`, `computeQuiet` and `bars` draw nothing while
    the tab is not on show.
  - Hidden, they still work out the tables and the rates (`computeTables`,
    `computeRates`) and the Results' visibility. A saved project's CSVs, read out through a
    throwaway instance (utils.js `withState`, from Projects), are made of these, so they
    are the same as before.
  - The tab's redraw draws everything when the instance is stale or its section's width
    changed, and otherwise nothing. `afterFilesChange` on show sets that draw key.
  - The page-wide `fitCsvIcons()` runs only on show; a stale redraw fits the instance's
    icons (`fitCsvIcons(root)`).
- **No job, no trim.**
  - GC has no work that runs on while hidden, so there is nothing for API.md §7.
  - `destroy()` is `kit.destroy()`: the deck's menu and its document and window
    listeners. Every other listener is on the instance's own elements. The hover's rAF is
    one frame. Nothing else outlives the instance: the leak check of the test passes.
  - There is no `trim()` (below).
- **`bytes()`** is fitted to what sleep gives back in the renderer's RSS: 64 kB; with
  files, 0.57 MB a card and 0.17 MB a file a card.
- What is per project stays per instance, as it was per module in v517: the dismissed alerts
  (`blankSeen`, `dateSeen`, WeakSets by the file's data) and the cards.

## What changed in epr.js (+80 −15)

- **The factory**: `createEpr`, `registerModule('epr', createEpr)`, `{ destroy, bytes }`,
  the kit given `root, key, layer`, as for GC.
- **Lookups.** The 6 page-wide lookups are gone:
  - the alerts, the pending pairs' alert and `eprAnalyses` are looked up in `root`;
  - the drop zone is set up with its elements (`setupDropzone($('eprDropzone'),
    $('eprFiles'), …)`);
  - a card's plot and legend are looked up in its card.
- **Drawing on show only.** `drawCard` returns while the tab is not on show and marks it
  stale. The redraw has the same draw key as GC's, set by `updateEpr` on show. The CSVs
  are made from the files, never from the plots, so a hidden instance needs nothing more.
- **A woken tab takes its history's spectra** (`keepSpectrum`). A module-level WeakMap keeps
  each spectrum's field and intensities by its `.DTA`'s bytes. Those bytes are the same
  array in the tab's states, its parked state and its record: db.js `park` and `decode`
  keep them.
  - A restore that brings copies (a wake, a project opened) takes the arrays already kept
    for those bytes where the values are the same.
  - A pair dropped registers its own.
  - The arrays are never changed in place, so sharing them is safe.
- **No job, no trim**, `destroy()` is `kit.destroy()`. **`bytes()`**: 128 kB; with
  spectra, 0.5 MB a card and 48 bytes a point a card.

**index.html, style.css: unchanged.** GC's and EPR's sections have no inline handler. Their
rules go by class (`.gc-param-wrap`, `.gc-gas-chip`…) or by ids that only the instance on
show has in the page.

## Memory: what each change gives

Fixtures for every number (`measure/gcepr.mjs` → `results/gcepr.json`):

- **GC:** 10 exports of 72 injections, 18 h at one every 15 min, with H2 and O2
  (`tests/fixtures.mjs` `gcCsv`), and one card.
- **EPR:** 10 BES3T pairs of 1024 points (`eprPair`), and one card.

Each tab was measured beside a blank tab of its module on show. Memory is taken after a forced
GC (lib.mjs `mem`: the whole page's JS heap, Blink's DOM nodes and the renderer's RSS from
/proc), in headless Chromium on 4 vCPUs. The numbers are from the second of two full runs;
where the first differed, it is given in brackets.

| what | before | after | cost |
|---|---|---|---|
| **EPR: a woken tab takes its history's spectra** (keepSpectrum) | Without it (the same tree, keepSpectrum returning its file as it is), a woken tab of 10 spectra holds decode's copies beside its history's arrays: heap 4.5 MB in each of 3 runs | 4.3 MB in each of 3 runs. The live arrays are the history's (checked in the page). One copy of 10 × 2 × 1024 doubles is 0.16 MB | One comparison of n values per file at a restore from copies. Not measured separately |
| **Hidden, nothing is drawn.** A saved project's state read out for its CSVs (Projects) | v517 restores it into the module and draws everything twice: GC 82.6 ms (93.3), EPR 29.2 ms (45.7) | `withState` makes an instance that works out GC's rates and draws nothing: GC 8.4 ms (8.2), EPR 5.0 ms (5.3) | None |
| **Sleep after 10 min** (the shell), GC | The tab hidden and awake: heap 4.5 MB, 6538 nodes, RSS 157.0 MB (160.1). v517 with the tab parked: 4.5 MB, 4296 nodes, 156.4 MB | Asleep: heap 4.3 MB, 3709 nodes, RSS 155.5 MB (156.8) | Waking takes 145 ms (median of 5), against 161 ms (178) for v517's switch to that tab |
| **Sleep after 10 min**, EPR | Hidden and awake: 4.7 MB, 4292 nodes, 154.6 MB. v517 parked: 4.5 MB, 3771 nodes, 153.6 MB | Asleep: 4.3 MB, 3648 nodes, 152.7 MB | Waking takes 123 ms (130), against 129 ms (143) for v517's switch |
| **No trim (decided).** The tab's plots let go: plot.js `releasePlot` on each, as a trim would do | Hidden and awake, as above | GC: heap 4.4 MB, nodes unchanged (6539). EPR: 4.6 MB, nodes unchanged (4292); RSS within noise | Drawing them again takes the whole redraw: 84 ms (90) to show GC after a resize, 45 ms (57) for EPR, against 46 ms for a tab shown as it was left. Not worth it (below) |

**Why no trim.**

- A hidden GC or EPR tab holds little beyond its sleeping form:
  - GC, 10 exports: 0.2 MB of heap and 2830 DOM nodes (table below);
  - EPR, 10 spectra: 0.4 MB of heap and 643 DOM nodes.
- Most of GC's is its parameter table (422 elements of the section's 1417) and its file
  list (401). It shows these as they are, so they cannot be let go. Its four plots are 229
  elements.
- Letting the plots go with `releasePlot` frees no DOM node. `measure/gcepr-release.mjs` →
  `results/gcepr-release.json` shows why:
  - each plot's tool buttons (plot.js `attachTools`: their handlers close over the Plot)
    keep the Plot, and with it the elements `releasePlot` took out of the svg;
  - with the tool rows removed as well, GC goes from 6531 nodes to 6146 and EPR from 4288
    to 4188, and the heap falls by 0.1–0.2 MB;
  - the rows would then have to be made again on show.
- So a trim would give back at most 0.2 MB of heap and 100–400 nodes a tab. At 6 tabs
  awake and hidden, that is about 1 MB, and every show would cost a redraw. Sleep gives all
  of it back after 10 minutes anyway.

**What a tab awake and hidden holds beyond its sleeping form.** Method: 5 such tabs and a
blank one on show, all 5 kept awake (6 allowed) against each put to sleep as it is left (0
allowed); the difference divided by 5. This calibrates `bytes()`. RSS differences of this
size are at the noise of the method (about ±1 MB a tab between the two runs); the heap and
the nodes were the same in both runs.

| tab | heap | DOM nodes | RSS | bytes() |
|---|---|---|---|---|
| GC blank | 0.02 MB | 248 | 0.1 MB (−0.3) | 0.06 MB |
| GC, 3 exports | 0.08 MB | 1309 | 2.2 MB (1.1) | 1.1 MB |
| GC, 10 exports | 0.20 MB | 2830 | 2.7 MB (2.3) | 2.3 MB |
| GC, 10 exports, 2 cards | 0.38 MB | 4576 | 4.5 MB (4.2) | 4.5 MB |
| EPR blank | 0.02 MB | 184 | −0.2 MB (0) | 0.13 MB |
| EPR, 3 spectra | 0.12 MB | 405 | 0.5 MB (1.5) | 0.77 MB |
| EPR, 10 spectra | 0.40 MB | 643 | 1.0 MB (1.1) | 1.1 MB |
| EPR, 10 spectra, 2 cards | 0.56 MB | 902 | 2.0 MB (2.0) | 2.1 MB |

So GC and EPR tabs are light. At the default limit of 6 tabs awake and hidden, GC tabs of
10 exports and two cards take some 27 MB (6 × 4.5), EPR tabs under half that. Most of it is
Blink's (the tables, the lists, the SVG paths), not the JS heap.

## Times

Medians, from the click to two frames after the loader is gone (lib.mjs `timedShow`): in b2,
14 switches between the two tabs, either way; in v517, 7 each way; 7 shows after a resize;
5 wakes.

| | v517 | b2 |
|---|---|---|
| switch between two GC tabs, the loaded one shown | 161 ms (178): restore and draw | 46 ms either way, both awake (41–50; two frames are 33 ms of it). Nothing is drawn: the draw key |
| the same, the blank one shown | 128 ms | (the same 46 ms) |
| the loaded GC tab shown after the window was resized while it was hidden | — | 84 ms (90): its whole redraw |
| the loaded GC tab woken from sleep | — | 145 ms (144) |
| switch between two EPR tabs, the loaded one shown | 129 ms (143) | 46 ms either way, both awake (36–62) |
| the same, the blank one shown | 111 ms | (the same 46 ms) |
| the loaded EPR tab shown after a resize while hidden | — | 45 ms (57) |
| the loaded EPR tab woken | — | 123 ms (130) |
| a state read out for its CSVs (`withState` / `runWithModuleState`): GC, EPR | 83 ms (93), 29 ms (46) | 8 ms, 5 ms |

## Tests

**Whole suite on HEAD + core.patch + gc-epr.patch: 189 of 189 pass.**

- That is v517's 183, the pool's 4 and these 2.
- Run with `node --test --test-concurrency=1 "tests/*.test.mjs"` on the tree the patch was
  made from, after the two fixes to the tests below; it took 9 min 46 s.
- Log: `results/suite-gc-epr.log`.

**With all five patches (HEAD + core + xrd + drs + sem + gc-epr): 199 of 199 pass.**

- Every module is then made per tab, and none uses the compatibility path.
- The patches were applied in that order to a git-archive copy of HEAD, as they are here
  (sha256 609171eb, 909951de, 24afbd14, 690c0fd0, 8879dd43).
- It took 10 min 27 s. Log: `results/suite-all-patches.log`.
- An earlier run on that tree failed one test, the race in `tabs.test.mjs` described below.

**`tests/b2gcepr.test.mjs`**: the same test for each module, 2 tests in all.

1. Two tabs awake at once:
   - each has its own files, labels, one of its card's parameters (GC's mass m, EPR's
     smoothing width), results (GC's mean-rate bars, EPR's plot) and history;
   - a switch to an awake tab shows its own section, and its plot's curve is the same
     element (not drawn again);
   - undo and redo in one tab leave the other's steps alone.
2. The first tab:
   - awake 9 minutes hidden, asleep at 11 (tabs.js `sleepTick`), its history parked;
   - its section collected: a WeakRef emptied after a CDP GC;
   - woken, its state, its results and its history are as they were;
   - undone step by step to the empty start, then redone to the same state and results.

EPR's plot is compared coordinate by coordinate, to 0.02 px. A plot drawn during a tab's
fade in (style.css `tab-fade`, 0.25 s: a redo just after a switch, a wake) measures its box
a fraction of a pixel off, which can turn the second decimal of a coordinate. A first
version compared the paths as text and failed once in a whole-suite run. It is v517's
behaviour too, invisible on screen. With the tolerance, the two tests passed 8 of 8 runs
under a CPU load of 4 busy processes.

**`tests/tabs.test.mjs`, one test changed** ("a running job…").

- It registered by hand a job for `'gc'` and checked v517's question before the GC tab was
  left. That question belongs to the compatibility path (modules not made per tab). With GC
  made per tab, leaving no longer asks: that is what b2 is for, as in XRPD's `rvui` C.
- The job is now registered by the tab's key (`TABS[1].id`, then `busyChanged`). The test
  checks:
  - Ctrl+Z still undoes nothing and says nothing while it runs;
  - leaving the tab asks nothing, and the job goes on;
  - the tab is still awake 11 minutes later;
  - closing it asks ("… is running in “Untitled project 2”: closing this tab stops it",
    × keeps it); "Stop it and close", then "Don't save", closes it and stops the job (the
    core stops it as the tab closes, after the question to save);
  - with the job running in the tab on show, a new project opens on show, nothing asked.
- The question to save comes a frame after "Stop it and close", so the test waits for it by
  its words. helpers.mjs `answer` waits for no banner to be on show, and that frame may
  already have shown the next one. This failed once under load, in the first run with every
  patch (above). Fixed, the test passed alone twice on that tree and once on this one under 5
  busy processes.
- After every patch, no module uses the compatibility path, so this test now covers what a
  busy tab does in b2.

**`tests/README.md`**: the `tabs.test.mjs` row says so, and a `b2gcepr.test.mjs` row is
added right under it.

**No other test needed changing.** gcp, gcrep, gcdate, modules, plots (golden hashes),
roundtrip, csv (a saved project's CSVs from Projects, now through `withState`), composer,
filelist, cardsanim and xrdcards drive the tab on show through the page's ids.

## Found outside GC and EPR (for the core and XRPD)

- **`releasePlot` alone frees no element.** Each plot's tool buttons keep its Plot
  (`attachTools`: `panBtn.onclick = ()=>{ this.setMode(…) }` and the like), and the Plot
  keeps the groups `releasePlot` took out of the svg. Measured for GC and EPR above, and
  consistent with XRPD's own numbers (`results/bytes.json`: 3345 DOM nodes awake and
  trimmed alike). A trim gives back the elements only if it also drops the tool row, or if
  the buttons find their Plot through `svg._plot` instead of holding it.
- **A parked EPR state copies its spectra.** db.js `park` copies arrays that are not frozen.
  A tab asleep therefore holds its spectra twice, in its parked state and in its history:
  0.16 MB for 10 spectra of 1024 points. The registry of shareable arrays that
  NOTES-drs.md proposes would cover it. Freezing is no answer: it doubles the arrays
  (NOTES-drs.md, `frozen`).

## Not done

- **GC keeps no data by the file's bytes, as EPR does.** A woken GC tab holds decode's
  copies of its files' dates and values beside its history's: about 5 kB an export of 72
  injections (72 Dates and 144 numbers; computed, not measured), 50 kB for the 10. A state's
  JSON is 30 kB in all. A cache would cost more code than it saves.
- **EPR's spectra are kept twice in a record and a project.** They are there as their bytes
  and again as numbers in the JSON: a state's JSON without the bytes is 376 kB for 10
  spectra, against 84 kB of bytes.
  - Reading the field and intensities again from the bytes at each restore would cut the
    records, but it would change the format.
  - v517 would then leave such a project's spectra out, since its restore needs them.
  - This is storage, not memory: the history's arrays are shared.
- **Pure code is not moved out of the factories.** The readers (`readGc`, `processPair`),
  the constants and the info texts stay inside, for the reasons NOTES-drs.md gives: a blank
  instance costs 0.02 MB of heap awake over asleep (the table above).
- **`bytes()` is fitted to these fixtures.** GC's goes by files and cards, not by
  injections, which make up a small part (the paths of 72 points).
- **Not run in a real browser window** left in the background, nor on the user's machine or
  files. Headless and unthrottled only, as for the core.
