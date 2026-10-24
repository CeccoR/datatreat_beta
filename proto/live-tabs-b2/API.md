# Making a module per tab (b2): the API

This page says how a module of DataTreat becomes a factory, with one live instance per open
tab, in one page. XRPD is the worked example: `xrd.patch` converts it on top of
`core.patch`. It was written so that SEM, DRS, GC and EPR could be converted from it alone,
and they were (`sem.patch`, `drs.patch`, `gc-epr.patch`; their notes are NOTES-*.md): every
module is now made per tab, and `b2.patch` holds the whole. §12 is the plan those stages
followed. `README.md` holds the state of b2 and its measurements.

## 1. What the shell does

The shell is tabs.js, with the registries in utils.js. Today (v517) a module has one
instance, bound to the page's fixed ids, and its tabs take it in turn. A module made per tab
works differently:

- **One instance per tab that is awake.** Each instance has its own section (a copy of
  index.html's `<section id="tab-<mod>">`), its own layer for windows and menus, its own
  state, undo history, view and jobs.
- **A switch only shows and hides.** The instance's section and layer go into the page and
  the previous instance of the same module comes out, in the same task. Nothing is
  restored, and a job in a tab left goes on.
- **Trim.** After `TRIM_MS` hidden (60 s) the shell calls the instance's `trim()`. The
  instance lets go of what it can make again when it is shown (`show()`).
- **Sleep.** After `settings.sleepMin` minutes hidden (10 by default; Settings › Tabs in
  the background) the tab sleeps:
  - its state is parked (db.js `park`) and its whole undo history with it;
  - its instance is destroyed;
  - the tab stays in the bar.
- **Wake.** A tab shown again while asleep wakes: a new instance is made, put in the page,
  given the parked state (`restoreModuleState`) and then the parked history
  (`setModuleHistory`).
- **Busy tabs never sleep.** A busy tab (`moduleBusy(key)`) is never trimmed or put to
  sleep. Its time hidden counts from the end of its job.
- **The limit.** Beyond `settings.liveMax` tabs awake and not on show (6), the one hidden
  longest that is not busy sleeps. With `settings.livePolicy = 'memory'` the limit is
  `settings.liveMB` instead (1500), the sum of their `bytes()`. Opening a tab is never
  refused for this. MAX_TABS (20 in the bar) is unchanged.
- **Persistence.** A tab's record is written from its live instance while it is awake
  (`park(getModuleState(key))`), otherwise from its parked state. This goes through v517's
  queue and the store of bytes by hash.
- **Reload.** After a reload only the tab on show is woken; the others wake when shown.

A module not converted keeps v517's path unchanged: its one instance, its tabs parked when
left, a question before leaving a tab whose job runs. Both kinds of module work side by
side.

## 2. The checklist

A module is made per tab when:

1. its file calls `registerModule(mod, create)` (utils.js) instead of running an IIFE at load;
2. `create(ctx)` builds everything in `ctx.root` and `ctx.layer`, and finds its elements there,
   never in the document (§3);
3. every registry call takes `ctx.key`, not the module's name (§4);
4. anything it lays over the page (windows, menus, pickers it owns) goes into `ctx.layer` (§5);
5. it draws nothing while `ctx.shown()` is false, and its redraw (registerTabRedraw) draws all
   that changed (§6);
6. a job that may run while its tab is hidden says when it starts and ends (`busyChanged(key)`),
   holds and releases the history as v509's jobs do, and writes only into its own instance (§7);
7. `inst.destroy()` lets go of everything that would outlive it (§8);
8. optionally `inst.trim()`, `inst.show()` and `inst.bytes()` (§9);
9. caches keyed by data (file bytes, frozen arrays) live at module level, shared by the
   instances (§10);
10. its tests still pass, and a test drives two of its tabs at once (§12).

## 3. The instance, its section, its ids

```js
// utils.js
registerModule(mod, create)        // at the module file's load
makeInstance(mod, key, spare)      // the shell's; spare: a tab's (may take index.html's section)
attachInstance(inst) / detachInstance(inst)
create(ctx) → inst
  ctx = { key, mod, root, layer, shown }
    key     the tab's id: the key of every registry (§4)
    root    its section: <section class="tab" id="tab-<mod>">, a copy of index.html's (the first
            tab's instance takes index.html's own, which stays in the page until then, hidden,
            so that the page's ids exist as in v517 before any tab of the module is opened)
    layer   a <div class="inst-layer"> (display: contents) for what it lays over the page
    shown() true while it is the instance on show (its section in the page and active)
  inst = { destroy(), show?(), trim?(), bytes?() }   // the shell adds key, mod, root, layer
```

**The ids belong to the instance on show.** The section and layer of the instance on show
are in the page with today's ids (`#xrdFiles`, `#xrdR2Refine`…), so index.html, the CSS,
the tests and the delegated handlers find them as before. Every other instance of the module
is out of the page. Its ids live in its own detached section, where its own code finds them:

```js
const $ = id => root.querySelector('#' + id);      // never document.getElementById
```

Root-scoped lookups work whether or not the section is in the page. A hidden instance that
works in the background (a refinement writing its results, its status, its progress)
therefore updates its own elements. `document.getElementById` would find the instance on
show, which is another tab's.

**Why detach, not an id swap.** The brief recommended swapping ids: a hidden instance keeps
its elements in the page with prefixed ids, and showing it gives today's ids back. The
shell instead takes the hidden instance's section and layer out of the page. The ids are the
same: the page's belong to the instance on show only. What differs is the mechanism, and the
reason was measured (`results/ids.json`, an XRPD tab of 12 refined patterns: 2050 elements):

- 141 of the elements have an id, and 45 attributes name one of them (for, aria-*,
  data-dl-svg, data-dl-legend, clip-path="url(#…)").
- Both ways cost the same: 19.9 ms to detach and put back, against 19.1 ms to swap. Most of
  that is the section's own style and layout, which a hidden section has none of either
  way.
- The swap also has to rewrite the 45 references, and every kind of reference a module adds
  later. Otherwise a label, a download or a plot's clip points at another instance's
  element or at nothing.
- The swap leaves every hidden instance's elements in every page-wide query
  (`document.querySelectorAll('.tab')`, `svg.plot` on resize, `.modal-backdrop`, `.an-menu`).
- Detaching moves two nodes and rewrites nothing.

The code rule is the same either way: lookups within the instance.

**Where an instance goes.** `attachInstance` puts the section where index.html had it (a
comment marks the place) and the layer at the end of `<body>`. The instance of the same
module that was there before comes out in the same task, so the page keeps its scroll as
v517's single instance kept it. An instance stays in the page while another module's tab
is shown: hidden by `.tab:not(.active)`, as v517's sections are, until another instance of
its module comes in or it sleeps.

## 4. Registries by key

Every registry in utils.js is keyed by the instance's key:

| call | v517 | made per tab |
|---|---|---|
| history | `registerHistory('xrd', snap, restore)` | `registerHistory(key, …)` |
| redraw on show / resize | `registerTabRedraw('xrd', fn)` | `registerTabRedraw(key, fn)` |
| a job | `registerBusy('xrd', { busy, stop })` | `registerBusy(key, …)` and `busyChanged(key)` at its start and end |
| CSVs | `registerCsvExport('xrd', fn)` | `registerCsvExport(key, fn)` |
| has data | `setTabLoaded('xrd', n)` | `setTabLoaded(key, n)` |
| drop zone, file list | `setupDropzone('xrdDropzone', 'xrdFiles', fn)`, `renderUnifiedFileList('xrdFileTableWrap', …)` | the same with elements: `setupDropzone($('xrdDropzone'), $('xrdFiles'), fn)` |

- **A module's name** passed where a key is expected (`getModuleState('xrd')`,
  `moduleBusy('xrd')`, a button's `data-csv-mod="xrd"`, the project bar's `data-module`)
  stands for the instance of that module on show, or the one shown last (utils.js `K`). So
  the delegated CSV buttons, the project bar and the tests work unchanged.
- **Keys and names.** A module not converted registers by its name, which is its key.
  tabs.js `keyOf(tab)` gives a tab's key: its id if its module is made per tab, else the
  module's name. `tabOfKey(key)` gives the tab back.
- **dropKey(key).** The shell calls it after `destroy()`. It removes the key from every
  registry, so an instance need not unregister anything.
- **Every history's changes are heard with the key** (`onAnyChange`). sessions.js uses this
  to autosave and mark unsaved the tab that changed, whether it is shown or not.
- **The undo keys** (Ctrl+Z, Ctrl+Y) act on the history of the instance on show
  (`shownKey()`). The ← → keys click the buttons of the section in the page, which is the
  instance on show.

## 5. The layer

Anything an instance appends to `document.body` in v517 goes into `ctx.layer`, which is in
the page only while the instance is: its modal windows, the deck's kinds menu, menus of its
own. Otherwise a hidden instance's window, with its ids, would stay in the page.

- `createDeck({ …, layer })` (cards.js) puts its kinds menu there. `deck.destroy()` removes
  the menu and its document and window listeners.
- `moduleKit(mod, { …o, root, key, layer })` (modkit.js) finds the module's elements in
  `root`, registers by `key` and gives its deck the layer. `kit.destroy()` destroys the deck.
- Page-wide singletons stay page-wide and are used only on show: the colour and palette
  pickers, `confirmBanner`, `confirmModal`, the figure composer. The composer's memory is
  keyed by the tab that owns the plot (tabs.js `tabOf(node)`).
- Plot downloads (plot.js) find their svg and legend from the button outward (`near`), never
  by a page-wide id.

## 6. Drawing on show only

A hidden instance must not draw. It has no size, and a Plot drawn at no size takes 900 × 480
(plot.js `size()`), which wastes time on the page's one thread. The rule:

- Each draw entry point returns early while `!ctx.shown()`.
- The tab's redraw, which goTab calls every time the instance is shown, draws everything
  again where what it shows changed. Draw keys keep that cheap: XRPD's keys include the
  plot's size, so a redraw after nothing changed costs 2–3 ms.
- A job that writes results while hidden needs nothing more. Its results are drawn by that
  redraw.

In XRPD the cards' host gets `hidden: ()=> deck.isFolded(a) || !shown()` and
`unseen: ()=> !shown()`, and xrd-rv.js `draw()` starts with
`if (gone || (host.unseen && host.unseen())) return;`.

## 7. Jobs in the background

A job (a Rietveld run, a SEM reading) has these requirements:

- It runs on in its instance while the tab is hidden, writing only into that instance's
  state and elements (root-scoped).
- It calls `busyChanged(key)` when it starts and when it ends. XRPD's `syncRv()` calls it,
  which `host.onBusy` already runs at both ends. The shell then starts the tab's time hidden
  from the job's end.
- It holds and releases the history as v509's jobs do (`UndoStack.hold` / `release`). The
  result becomes a step of its own in that tab's history, and that tab is autosaved and
  marked unsaved.
- Its `stop()` (registerBusy) is called only when its tab is closed. Closing a busy tab asks
  first: "… is running in “T”: closing this tab stops it".
- **The pool.** Rietveld jobs go to the page's pool (xrd-rv-pool.js, from
  `proto/workers/pool.patch`): one cap of cores − 1 for the whole browser (Web Locks), the
  workers and their engine caches owned by the pool and kept warm 60 s. Instances never own
  workers. A later worker-based job should take the same shape: a module-level pool, jobs
  that can be cancelled, results written by the instance that asked.
- **A test for "is my card still here".** It must survive the instance being hidden.
  `root.isConnected` is false for a hidden instance. XRPD's host gives
  `placed: ()=> live.get(a.id).el === el`, meaning the card is still its deck's.

## 8. destroy()

`destroy()` runs when the tab is closed, when it sleeps, and for an instance made only to
read a state out (withState: a saved project's CSVs, the default state). After it nothing
of the instance may be reachable from the page. Let go of:

- listeners on `document` and `window`: use an `AbortController` and pass `{ signal }`, or
  remove them;
- observers (`ResizeObserver`, `MutationObserver` on `document.documentElement`) and
  `matchMedia` and `document.fonts` listeners: their callbacks hold the instance;
- `requestAnimationFrame` loops, timers that re-arm, running Web Animations;
- jobs: cancel them, which terminates their pool workers;
- windows in the layer: not needed, the layer goes with the instance;
- the history and the registries: not needed, the shell calls `dropKey`.

XRPD's destroy:

```js
destroy(){
  [...rvCards()].forEach(i=>{ try { i.cancel(false); } catch(e){} });
  try { stdRv.cancel(false); } catch(e){}
  closeStd();                                   // its keydown listener
  [...live.values(), ...parked.values()].forEach(e=>{ try { if (e.inst.destroy) e.inst.destroy(); } catch(err){} });
  live.clear(); parked.clear();
  [stdPeaks, stdRv].forEach(i=>{ try { i.destroy(); } catch(e){} });
  deck.destroy();
},
```

**How to check for leaks** (`measure/leak.mjs`):

1. Hold a `WeakRef` to the instance's `root` (`TABS[i].inst.root`).
2. Put the tab to sleep (`sleepTick(Date.now() + 11*60e3)`).
3. Force a GC (CDP `HeapProfiler.collectGarbage`) and check `deref()`.

XRPD tabs blank, of 12 patterns and of 12 refined are all collected, and Blink's DOM nodes
fall back to the blank tab's count (3867; `results/leak.json`).

Watch out for Playwright's `setInputFiles`. It keeps a hold on the input it filled, which
retains that instance. Measure with files dropped through a `DragEvent`, as
`measure/lib.mjs` `drop()` does. An element handle not disposed holds its instance too:
`waitForSelector` returns one (helpers.mjs `openModule`), and so does a `waitForFunction`
whose predicate returns an element; return a boolean instead (NOTES-drs.md).

## 9. trim, show, bytes

- **`trim()`.** It runs after the tab has been hidden `TRIM_MS` (60 s), once, and never on a
  busy tab. The instance lets go of what it can make again: derived arrays, its plots
  (plot.js `releasePlot(svg)` empties the svg and drops its Plot and the arrays it keeps).
- **`show()`.** It runs when the instance comes into the page. It remakes what `trim`
  dropped. The redraw that follows draws the plots.
- **The rule.** Drop at hide what can be remade in under ~50 ms. XRPD has none. Remaking its
  12 patterns' processing took 67–86 ms and the redraw 120–240 ms (timed in the page while
  this was decided). So XRPD drops them at `TRIM_MS`, not at hide:

  | XRPD tab, 12 patterns refined, hidden | JS heap | renderer RSS | shown again |
  |---|---|---|---|
  | awake | 12.4 MB | 220 MB | 82 ms |
  | trimmed | 7.7 MB | 197 MB | 409 ms |
  | asleep | 7.5 MB | 176 MB | 485 ms (woken) |

  Source: `results/tiers.json`. The numbers are the whole page's, with a blank XRPD tab on
  show; shown-again times are medians of 7 (5 for a wake). v517's switch between two such
  tabs takes 312 ms (`results/switch.json`).
- **Nothing kept twice, nothing kept for nothing.**
  - xrd-peaks kept a fourth array per pattern (the raw pattern less the baseline) that
    nothing read. It is gone.
  - db.js `park` and `decode` now share frozen arrays of numbers instead of copying them, so a
    parked XRPD state holds the same pattern arrays as its history.
  - xrd.js's cache of files read (`reread`) is per module, keyed by the file's bytes, so a
    tab woken reads nothing again and its patterns are the same arrays.
- **`bytes()`.** It estimates what sleeping would give back: the instance's elements and the
  data it derived and drew. It excludes its files and results, which the parked state and
  the history keep. The memory policy sums it over the hidden awake tabs. Calibrate it with
  `measure/bytes.mjs`. XRPD's:

  ```js
  (1 << 20) + 2048*files + (trimmed ? 5*refinedPoints : 48*points*scherrerCards + 37*refinedPoints)
  ```

  Measured awake over asleep (`results/bytes.json`):

  | XRPD tab | JS heap | DOM nodes | estimate |
  |---|---|---|---|
  | blank | 0.1 MB | 1456 | 1.0 MB |
  | 12 patterns | 3.2 MB | 2535 | 4.0 MB |
  | 12 patterns refined | 5.2 MB | 3345 | 6.3 MB |
  | the same, trimmed | 0.3 MB | 3345 | 1.3 MB |

## 10. Module-level and instance-level

Keep at **module level**, shared by instances:

- pure functions and constants;
- caches keyed by data identity, as `WeakMap`s (XRPD's `reread` by bytes, xrd-peaks' `idOf`);
- pools (workers).

Keep **inside `create`**: everything per project, including what v517 kept in the IIFE:
files, the deck, the cards, alerts, windows, the history.

A cache keyed by data shares memory between tabs holding the same file, and it carries an
instance's work across its sleep.

## 11. The worked example: XRPD

`xrd.patch` touches xrd.js (+122 lines changed), xrd-peaks.js (+24) and xrd-rv.js (+25). It
also adds `tests/b2xrd.test.mjs` (222 lines), changes one step of `tests/rvui.test.mjs` and two
lines of `tests/README.md`. xrd-rv-model.js and xrd-rv-html.js, which hold no state, are
unchanged.

**xrd.js**

- `(function(){ … })();` becomes `function createXrd({ key, root, layer, shown }){ … return inst; }`
  and `registerModule('xrd', createXrd)`.
- `document.getElementById(...)` becomes `$(...)` (root-scoped), seven places.
- `setupDropzone` and `renderUnifiedFileList` take elements. The standard windows' drop zones
  take `m.querySelector('#'+id+'Dz')`.
- The standard's two windows are appended to `layer`, and their Escape key acts only on show.
- Registries take `key`. `syncRv()` calls `busyChanged(key)`.
- The cards' host gets `hidden: … || !shown()`, `unseen`, `layer` and `placed`.
- `createDeck({ …, layer })`.
- `reread` moves to module level.
- The returned instance has `destroy`, `trim`, `show` and `bytes`.

**xrd-rv.js**

- `draw()` returns while `host.unseen()`.
- The settings window goes to `host.layer`.
- A sample waiting for the standard's run checks `host.placed()`, not `root.isConnected`.
- `trim(plots)` drops the curves kept and the plots.
- Its Escape key acts only while its window is in the page.

**xrd-peaks.js**

- `trim(plots)` and `again()` let the processing go and remake it.
- `again()` also runs before `instrModel()` and `csvEntries()`, so a trimmed instance answers
  right.
- The unread fourth array is dropped.

**Tests**

- `tests/b2xrd.test.mjs`, 5 tests:
  - two XRPD tabs awake, each with its own files, view and undo;
  - a refinement in a tab left: on the pool, its results bit for bit those of one refined on
    show, its step, its record, its "*";
  - sleep after the minutes set in Settings, the busy exemption, the limit by number and by
    memory, a wake with the whole history;
  - the LRU;
  - a hidden tab saved as it is closed, reopened from Projects, and a reload.
- `tests/rvui.test.mjs`: one step adapted. Leaving a refining XRPD tab no longer asks; this
  is the behaviour b2 is for.

## 12. Converting the other modules

| module | lookups in the page (`map/singletons/counts.txt`) | where |
|---|---|---|
| DRS (tauc.js) | 17 | the kit, plus its own result plots (`taucResSvg0`…) |
| GC (gc.js) | 5 | the kit, plus the results bar |
| EPR (epr.js) | 6 | the kit |
| SEM (sem.js, sem-read.js, sem-figure.js) | 31 + 4 `document.querySelector` | its own; no kit |

**DRS, GC, EPR** use the kit, so most of the conversion is already done there:

1. Wrap the IIFE as `create({ key, root, layer, shown })` and call `registerModule`.
2. `moduleKit(mod, { …o, root, key, layer })`.
3. Replace the module's remaining `document.getElementById` with `root.querySelector('#'+id)`.
4. Return `{ destroy(){ kit.destroy(); …own listeners }, trim?, show?, bytes? }`.
5. Their jobs are synchronous, so there is nothing for §7.
6. Check their `utils.SAMPLE_NAV` selectors (`#tab-tauc .an-prev`): they work as they are,
   since only the instance on show is in the page.

**SEM** is the one that matters for memory: about 109 MB per tab of 8 images in v517, and
more when live (decoded images, canvases, a reading worker). Its conversion is where `trim`
pays:

- Let the decoded images go after `TRIM_MS`, and decode them again on show (measure it
  against the 50 ms rule).
- Keep the files' bytes, which the parked state and history share anyway.
- The reading worker should become a module-level pool like the Rietveld one. Its reading is
  a job (`registerBusy` and `busyChanged`) that writes into its own instance.
- Its 35 page-wide lookups and its figure composer (sem-figure.js) need the §3 and §5
  treatment.
- Its tests (`sem.test.mjs`, `undorun` SEM part) drive one tab. Add a two-tab test, as
  `b2xrd.test.mjs` does.

**What the tests need.** The suite drives the instance on show through the page's ids, so
existing tests pass as long as they act on the tab on show. Tests that assumed leaving a tab
stops its job, or that a module's elements exist with no tab of it open, must be reviewed:

- `rvui` C needed one step changed (leaving no longer asks).
- `cardsanim` still finds `#xrdAnalyses` before any XRPD tab is opened, thanks to the spare
  section (§3).
