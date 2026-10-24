# UV-Vis DRS made per tab (b2): drs.patch

`drs.patch` makes DRS (tauc.js, its Tauc and Urbach cards) a factory as `API.md` says: one
live instance per DRS tab that is awake, in one page. It is a git diff against HEAD +
`core.patch` and touches tauc.js and one new test file, `tests/b2drs.test.mjs`. index.html
and style.css needed no change (below). It applies cleanly with `git apply --check` on HEAD
+ core.patch and on HEAD + core.patch + xrd.patch; it touches none of XRPD's files.

```sh
git apply proto/live-tabs-b2/core.patch && git apply proto/live-tabs-b2/drs.patch
node --test tests/b2drs.test.mjs
```

## What changed in tauc.js (+110 −36)

- **The factory.** `(function(){ … })()` became `createTauc({ key, root, layer, shown })`,
  registered with `registerModule('tauc', createTauc)`. It returns `{ destroy, bytes }`. The
  body keeps its place and indentation, as XRPD's did; what is pure stays inside it (see
  "Not done").
- **The kit.** `moduleKit('tauc', { root, key, layer, … })`: the registries go by the tab's
  key, the file list, drop zone and alerts are the instance's own, the kinds' menu goes in
  the layer.
- **Lookups.** The 17 lines (18 calls) of `document.getElementById` are gone:
  - the alerts, the two blocks shown with files, the Results list, the three top plots and
    their legends are looked up in `root`;
  - a card's elements (the panel's fields, stats, results, the reference select, the band's
    legend) are looked up in its card (`makePanel(spec, card)`);
  - a card's Results section's (R1, R3, R2, their legends, chips and alerts) are looked up in
    that section (`resEl`).
- **The layer.** DRS lays only the deck's kinds menu over the page.
- **Drawing on show only.** The cards' `initPlot` and `update`, `renderResView` and
  `renderAnalysisRes` return while the tab is not on show and mark the instance stale. The
  tab's redraw draws everything when it is stale or its section's width changed, a card not
  drawn yet with `initPlot`. Otherwise it draws nothing: a tab shown again as it was left is
  only shown. `setupAnalysis` on show sets that draw key.
- **No job, no trim.** DRS has no work that runs on while hidden. `destroy()` is
  `kit.destroy()`: the deck's menu and its document and window listeners. Nothing else
  outlives the instance: no observers, and the drag's rAF throttle draws nothing hidden.
  There is no `trim()`: measured below, the plots are 0.6 MB and take 0.25 s to draw again.
- **`bytes()`** is fitted to what sleep gives back, in the renderer's RSS:
  128 kB, plus, with files, 1 MB per card plus 1 MB, plus 180 bytes per point included.
- **index.html, style.css: unchanged.** The DRS section has no inline handler, and its rules
  (`#taucAlert`, `#taucEgTableWrap`…) go by ids that only the instance on show has in the
  page.

## Memory: what each change gives

Fixture for every number: 10 Cary 5000 exports (tests/fixtures.mjs `caryCsv`: %R,
800–200 nm by 0.5 nm, 1201 points each), with a Tauc card and an Urbach card. Measured with
`measure/drs.mjs` → `results/drs.json` (lib.mjs `mem`: after a forced GC, the JS heap,
Blink's DOM node count and the renderer's RSS from /proc; headless Chromium 141, 4 vCPUs).

| what | before | after | cost |
|---|---|---|---|
| **Energies hν not kept in states.** They are made once per array of wavelengths (a WeakMap by the array), shared by every instance and state, and are not a field of the file's record (non-enumerable). | v517 makes a new hν array per file at every file-list change and every undo, and every history state holds its own: 20 file-list steps grow the heap by 2.4 MB. A state's JSON without bytes is 527 kB. | 20 steps grow it by 0.6 MB. The same state's JSON is 310 kB, so saved projects, tab records and parked tabs are 41% smaller. | None: the same values; the plots' golden hashes are unchanged. A project saved by b2 holds no hν, and v517 makes it again from λ: a b2 state of 3 spectra and both cards, restored into v517 (db.js encode, decode, restoreModuleState), gives the same E_g and E_U with no error. |
| **A woken tab takes its history's arrays.** Each file's λ and F(R) are kept by the file's bytes (a WeakMap by the bytes array, which park and decode share). | A woken tab's files are decode's copies, beside the history's arrays: a second copy of 10 × 2 × 1201 doubles, 190 kB. | One copy. | One comparison of n values per file at a restore from copies (wake, project opened). Not measured separately. |
| **Hidden, nothing is drawn.** | A saved project's state read out for its CSVs (Projects) restores into the module and draws everything twice: 284 ms. | `withState` makes an instance that draws nothing: 27 ms. | None. |
| **Sleep after 10 min** (the shell). | The tab hidden and awake: heap 5.8 MB, 6474 nodes, RSS 172.7 MB (whole page, a blank DRS tab on show). | Asleep: heap 4.9 MB, 3842 nodes, RSS 163.2 MB. v517 with the tab parked: 5.5 MB, 4588 nodes, 166.3 MB. | Waking takes 327 ms (median of 5), against 462 ms for v517's switch to that tab. |
| **No trim (decided).** | Hidden and awake: 5.8 MB heap. | The tab's plots released (plot.js `releasePlot` on each, as a trim would): 5.2 MB heap; RSS within noise. | Drawing them again takes 252 ms (median of 7). It is mostly the analyses: each card's fits for every sample, made again at each redraw. 0.6 MB is not worth 0.25 s at each show, so a hidden DRS tab keeps its plots until it sleeps. |

**What a DRS tab awake and hidden holds beyond its sleeping form.** Method: 5 such tabs and a
blank one on show, all 5 kept awake (6 allowed) against each put to sleep as it is left (0
allowed); the difference divided by 5. This calibrates `bytes()`:

| tab | heap | DOM nodes | RSS | bytes() |
|---|---|---|---|---|
| blank | 0.02 MB | 428 | 0.2 MB | 0.1 MB |
| 3 spectra, both cards | 0.44 MB | 2024 | 4.0 MB | 3.7 MB |
| 10 spectra, Tauc card | 0.54 MB | 1711 | 4.1 MB | 4.2 MB |
| 10 spectra, both cards | 0.78 MB | 2632 | 6.5 MB (5.3 MB in an earlier run) | 5.2 MB |

So a DRS tab is light. Even at the default limit of 6 tabs awake and hidden, DRS tabs take
some 40 MB. Most of that is Blink's (the SVG paths), not the JS heap.

## Times (median; lib.mjs `timedShow`: from the click to two frames after the loader is gone)

| | v517 | b2 |
|---|---|---|
| switch between two DRS tabs, the loaded one shown | 462 ms (restore and draw) | 45 ms awake (40–47; two frames are 33 ms of it). Nothing is drawn: the draw key |
| the same, the blank one shown | 245 ms | 45 ms |
| the loaded tab shown after the window was resized while it was hidden | — | 252 ms (its whole redraw) |
| the loaded tab woken from sleep | — | 327 ms |
| a state read out for its CSVs (`withState` / `runWithModuleState`) | 284 ms | 27 ms |

## Tests

- **Whole suite on HEAD + core.patch + drs.patch: 189 of 189 pass** (183, the pool's 4,
  these 2), `node --test --test-concurrency=1 "tests/*.test.mjs"`, 9 min 50 s, on the
  tree the patch was made from. Log: `results/suite-drs.log`.
- **With xrd.patch too** (HEAD + core + xrd + drs): b2drs, b2xrd, tabs, xrdcards and
  cardsanim, 20 of 20 pass. The whole suite was not run on that tree.
- **`tests/b2drs.test.mjs`, 2 tests:**
  1. Two DRS tabs awake at once:
     - each has its own files, labels, card exponent, E_g and history;
     - a switch to an awake tab shows its own section, and its card's plot path is the
       same element (not drawn again);
     - undo and redo in one tab leave the other's steps alone.
  2. A DRS tab with an Urbach card added from the kinds' menu (in its layer):
     - awake 9 minutes hidden, asleep at 11 (tabs.js `sleepTick`), its history parked;
     - its section is collected: a WeakRef emptied after a CDP GC;
     - woken, its state, history, E_g and E_U are as they were;
     - undone step by step to the empty start, then redone to the same state.
- **Pitfall for the other modules' leak tests.** `page.waitForFunction(()=>
  document.querySelector(…))` resolves to a handle on that element, and so does
  `waitForSelector` (helpers.mjs `openModule`). That handle keeps the instance alive, and a
  tab asleep is then never collected. The test's predicates return booleans, and the tab
  to be let go is opened without `openModule`. This adds to API.md §8, which names
  `setInputFiles` only.

## Found outside DRS (for the core and XRPD)

- **A frozen array of doubles takes twice the memory.** In Chromium 141, 16 bytes per
  element against 8 (`results/drs.json` `frozen`: 400 arrays of 5000, heap after GC). V8
  stores a frozen array's elements as boxed numbers.
  - XRPD freezes its patterns' arrays (2θ, intensities, variance factors).
  - core.patch's db.js shares frozen arrays in `park` instead of copying them.
  - The sharing saves one copy while a tab sleeps, but the freeze doubles every such array
    in every state, always: about 1.5 MB per 12 patterns of 5384 points.
  - A registry of arrays `park` may share (a WeakSet that the module adds its arrays to)
    would share them at 8 bytes, without freezing. DRS does not freeze for this reason.
    Its parked state copies its current arrays (190 kB for 10 spectra) until it wakes.
- **DRS's redraw recomputes every analysis.** A cache of each sample's fits, keyed by its
  parameters and lines, would cut the 0.25 s of a resize or a wake. Not done: it is not
  memory, and it changes the analysis code.

## Not done

- **Pure code is not moved out of the factory.** The fitting functions, the file reader,
  the constants and the info texts are still inside the factory, as XRPD's were.
  - Moving them would turn the diff into some 1000 lines of moved code.
  - What it would save is small: a blank instance's whole cost, closures and strings
    included, is 0.02–0.08 MB of heap. That is 0.02 MB awake over asleep (the table above),
    and 0.075 MB when 5 blank tabs are set against 1 in an earlier run of the same kind.
    V8 shares the functions' bytecode between instances.
- **No row in `tests/README.md`.** Each module's patch would edit the same table, so they
  would not apply one after another. The test file's head says what it tests. A row for
  whoever merges:
  `| b2drs.test.mjs | DRS made per tab (b2): two DRS tabs awake at once, each its own files, cards, exponent, E_g and undo, a switch to one awake only showing it (its plot not drawn again); a tab asleep past Settings' minutes, its section collected, woken with its state, its Urbach card and its whole history, undone to the empty start and redone. |`
- **Not run in a real browser window** left in the background, nor on the user's machine
  or files. Headless and unthrottled only, as for the core.
