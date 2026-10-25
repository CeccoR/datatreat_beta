# Making a module per tab (b2): the API

This page says how a module of DataTreat becomes a factory, with one live instance per open
tab, in one page. XRPD is the worked example: `xrd.patch` converts it on top of
`core.patch`. It was written so that SEM, DRS, GC and EPR could be converted from it alone,
and they were (`sem.patch`, `drs.patch`, `gc-epr.patch`; their notes are NOTES-*.md): every
module is now made per tab, and `b2.patch` holds the whole. §12 is the plan those stages
followed. `README.md` holds the state of b2 and its measurements; `NOTES-v2.md` and
`NOTES-v3.md` the later changes in `b2.patch` (no trim; a sleeping SEM tab without its files'
bytes; no memory budget; any number of tabs open, a cap on those awake; arrays fixed, not
frozen; what is worked out kept, not worked out again; the loader over every step that may
take a while), which this page describes as they now are.

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
- **Hidden, as it was left.** A hidden instance keeps all it has until its tab sleeps; it
  may let go at once of what it remakes in under ~50 ms as it is shown (SEM's editor image,
  §9). (The first version of b2 also had a trim, 60 s hidden; b2v2 took it out.)
- **Sleep.** After `settings.sleepMin` minutes hidden (10 by default; Settings › Tabs in
  the background) the tab sleeps:
  - its state is parked (db.js `park`) and its whole undo history with it;
  - its instance is destroyed;
  - the tab stays in the bar;
  - a module registered with `dropBytes` (SEM) lets go of its files' bytes too, once the
    store holds them, and reads them back as it wakes (§9).
- **Wake.** A tab shown again while asleep wakes: a new instance is made, put in the page,
  given the parked state (`restoreModuleState`) and then the parked history
  (`setModuleHistory`). One whose files' bytes were let go reads them first, the loader on
  show (§9); every other wakes at once, as in the first version. What its module worked out
  of its data before it slept is kept (§10): the wake draws it, not works it out again.
- **The loader, before any step that may take a while** (b2v3). A wake, a new tab, a
  project opened, a reload: the loader is put on, a frame drawn, then the work, the loader
  off once it is drawn (tabs.js `activateTab`, `loadTabIfActive`). A tab awake shown again
  draws only what changed while hidden: nothing, shown at the width it was left at and
  unchanged (at once); all its plots at another width of the window, or its results where a
  job ended meanwhile: then under the loader too (`redrawn`, `showLater`); the width it was
  drawn at is the one it was left at, for another tab or for Home, Projects or Settings,
  taken only from a tab on show till then (`view` null): one chosen and left again before
  its show keeps its own, one woken behind a fixed section has none (''). A show or wake
  deferred two frames gives way to Home, Projects or Settings chosen meanwhile: the tab
  stays as it was, shown from there under the loader (b2v3's final check). A
  project changed and reloaded keeps the loader on till its saved record is read and its
  key taken (sessions.js `onTabLoaded` gives the promise, tabs.js `loaded` waits for it). A
  step that is no tab's, a project written to a file (its bar's, Projects'), goes through
  tabs.js `underLoader(fn)`: the loader on, a frame drawn, `fn`, the loader off. The
  records whose `active` changes are written at the switch (the tab left) and once the tab
  shown is (its own), so that a switch superseded within its frames leaves one record on
  show.
- **Busy tabs never sleep.** A busy tab (`moduleBusy(key)`) is never put to sleep. Its
  time hidden counts from the end of its job.
- **The cap.** Any number of tabs may be open (b2v3: v517 and b2v2 refused a 21st). At most
  `settings.awakeMax` tabs are awake (20 by default; Settings › Tabs in the background), the
  one on show among them; beyond, those shown least lately (`seenAt`) that are not busy
  sleep, whenever they were opened, so a tab opened first but shown often stays awake. The
  cap is kept at every switch (before the tab shown wakes and after), at each job's end and
  at each change of the setting: tabs busy stay awake over it, the excess put to sleep as
  their jobs end. A tab opened in the background (Projects) is asleep. (To b2v2: L tabs
  awake not on show, or a memory budget over each instance's `bytes()`; both are gone.)
- **Persistence.** A tab's record is written from its live instance while it is awake
  (`park(getModuleState(key))`), otherwise from its parked state. This goes through v517's
  queue and the store of bytes by hash.
- **Reload.** After a reload only the tab on show is woken; the others wake when shown. A
  tab of a `dropBytes` module not on show comes back holding its files' references only,
  read as it wakes.

A module not converted keeps v517's path unchanged: its one instance, its tabs parked when
left, a question before leaving a tab whose job runs. Both kinds of module work side by
side.

## 2. The checklist

A module is made per tab when:

1. its file calls `registerModule(mod, create, opts)` (utils.js) instead of running an IIFE at load;
2. `create(ctx)` builds everything in `ctx.root` and `ctx.layer`, and finds its elements there,
   never in the document (§3);
3. every registry call takes `ctx.key`, not the module's name (§4);
4. anything it lays over the page (windows, menus, pickers it owns) goes into `ctx.layer` (§5);
5. it draws nothing while `ctx.shown()` is false, and its redraw (registerTabRedraw) draws all
   that changed (§6);
6. a job that may run while its tab is hidden says when it starts and ends (`busyChanged(key)`),
   holds and releases the history as v509's jobs do, and writes only into its own instance (§7);
7. `inst.destroy()` lets go of everything that would outlive it (§8);
8. optionally `opts.dropBytes`, for a module whose files are large (§9);
9. the arrays of numbers it makes and never changes in place (a file's data) are fixed
   (`fixed(a)`, utils.js from db.js: shared by the states, a state parked and the history's
   key, not copied, not frozen; §9), and nothing writes into them;
10. caches keyed by data (file bytes, arrays fixed) live at module level, shared by the
   instances; what it works out of its data and parameters, and draws again on a redraw, a
   wake or an undo, it keeps there by the data (utils.js `keeper`, §10);
11. its tests still pass, and a test drives two of its tabs at once (§12).

## 3. The instance, its section, its ids

```js
// utils.js
registerModule(mod, create, opts)  // at the module file's load; opts: { dropBytes } (§9)
makeInstance(mod, key, spare)      // the shell's; spare: a tab's (may take index.html's section)
attachInstance(inst) / detachInstance(inst)
create(ctx) → inst
  ctx = { key, mod, root, layer, shown }
    key     the tab's id: the key of every registry (§4)
    root    its section: <section class="tab" id="tab-<mod>">, a copy of index.html's (the first
            tab's instance takes index.html's own, which stays in the page until then, hidden,
            so that the page's ids exist as in v517 before any tab of the module is opened)
    layer   a <div class="inst-layer"> (display: contents) for what it lays over the page
    shown() true while it is the instance on show (its section in the page and active: one
            made for withState, out of the page, never is, and draws nothing)
  inst = { destroy() }             // the shell adds key, mod, root, layer
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

## 9. What a hidden or sleeping tab lets go; arrays fixed

- **At hide, only what is remade in under ~50 ms.** SEM lets go of its editor's image at
  full size (17 MB of canvas and pixels for 2048², remade in 25–29 ms as it is shown).
  XRPD has nothing so cheap: remaking its 12 patterns' processing took 67–86 ms and the
  redraw 120–240 ms (timed in the page while this was decided). Nothing else is let go
  before the tab sleeps. (The first version of b2 had a trim at `TRIM_MS`, 60 s hidden:
  XRPD let go of its plots, processing and curves, SEM of its thumbnails and cards, and the
  next show drew them again, 0.41 s for XRPD against 0.08; `results/tiers.json`. b2v2 took
  it out, `inst.trim()`, `inst.show()` and plot.js `releasePlot` with it: NOTES-v2.md.)
- **Nothing kept twice, nothing kept for nothing.**
  - xrd-peaks kept a fourth array per pattern (the raw pattern less the baseline) that
    nothing read. It is gone.
  - **Arrays fixed** (b2v3): an array of numbers (or of anything but objects) a module makes
    and never changes in place is fixed, `fixed(a)` (db.js, a WeakSet; utils.js gives it to
    the modules). db.js `park` and `decode` give a fixed array back as it is, not a copy, and
    utils.js `stateKey` takes it by a hash kept for it (`numsKey`), so a tab's parked state,
    its history and its instance hold one array, and the history's key of a state does not
    write its numbers out. Fixed: XRPD's patterns (2θ, intensities, variance factors, where
    a file is read or restored) and its results' lists (xrd-rv-model.js `frozen`, whose
    objects stay frozen), DRS's and EPR's spectra (`keepSpectrum`), GC's gases (`readGc`,
    its restore). To b2v2 XRPD froze its arrays for this, which in Chromium holds a double in
    16 bytes, not 8 (NOTES-drs.md), and DRS's, GC's and EPR's were copied into every state
    parked. Nothing may write into a fixed array: the tests freeze each as it is fixed
    (`window.__freezeFixed`, set by helpers.mjs), so that a write throws there; the app does
    not. Measured in `NOTES-v3.md`.
  - xrd.js's cache of files read (`reread`) is per module, keyed by the file's bytes, so a
    tab woken reads nothing again and its patterns are the same arrays.
- **A sleep without the files' bytes: `registerModule(mod, create, { dropBytes: true })`.**
  For a module whose files are most of what a tab holds (SEM: 71 MB a tab of 8 images of
  2048 × 2176 at 16 bits), the shell lets go of them when the tab sleeps, and reads them
  back from IndexedDB, where the bytes store holds them by their SHA-256 (v517), as it
  wakes (tabs.js `lighten`, `wakeLater`):
  - **At sleep**, the tab's record is written with its state, and with the hashes of its
    history's files beside its own (db.js `putRec`'s `also`: their bytes stored where the
    store lacks them, the record holding them from the sweep). Once that write is done, and
    only then, every array of bytes whose hash the page took is replaced, in the parked
    state and in the parked history, by `{__t:'u8', h}` (db.js `unload`: one object for
    one array, an id where it is met more than once, a class's objects copied as such, so
    that SEM's RawRef keeps its JSON and the history its comparisons). A file not hashed
    (no WebCrypto) keeps its bytes, and a write that fails lets go of none.
  - **Nothing else may hold them.** What a module keeps by file must keep no bytes, or keep
    them weakly, or only for its tabs awake: SEM's `raws` are WeakRefs, `imgs` hold headers,
    reduced copies and card levels, `full` only the images of the tab on show and of a
    reading. What was made of a file let go stays while a tab asleep holds the file, so that
    the tab woken draws its thumbnails and cards without making them again: tabs.js tells
    the module, `registerModule(mod, create, { asleep })`, `asleep(key, v)` with the parked
    state and history's states as a tab sleeps (or is restored or opened asleep) and
    `asleep(key, null)` as it wakes or is closed; SEM keeps the ids they name (b2v3; to b2v3
    the files let go last, 32 MB at most, which some 3.4 MB a tab of 8 images 2048² asleep
    outgrew past 9 such tabs). At a wake `asleep(key, null)` comes once the instance holds
    its state and history: SEM then takes its history's RawRefs as the files' own (`adopt`:
    kept and watched as before the sleep, or the one kept put in their place), so that a
    file the history alone holds keeps what it was made into (b2v3 review: it was let go at
    the wake, and an undo made it again, 0.43 s with no loader for 8 images).
  - **At wake**, the parked state and history are read back together (db.js `load`: an
    array the page still holds of a hash, another tab's, is taken, the rest read from the
    store in one transaction) and the tab then wakes as any other. Meanwhile the loader is
    on and the module has no instance in the page (utils.js `vacate`: its name stands for
    the key woken, so that the undo and arrow keys reach no other tab). One read a tab,
    whatever wakes ask for it; given up if the tab is left, closed or woken otherwise
    meanwhile. Bytes the store no longer has (cleared, evicted) come back as none, said in
    a banner, and the module shows its files without them as it does after a reload (SEM:
    out of the list, said in its alerts). An array met in several places comes back one
    (db.js `fill` gives one object for one met, as `unload` made one: to the review a history
    woken held a copy of a file's bytes at each step that held it). A read that fails as a
    whole gives the wake up (b2v3 review): the tab stays asleep, its references and its
    record as they were, Home on show, a banner saying so; its next show reads again (to
    the review it woke without its files, and its record, written then, lost them for
    good).
  - **Who waits.** `tabs.js ensureLive()` returns the wake's promise: Save, Save as, the
    exports, the CSVs, Delete and a close that saves await it. A tab asleep saved as it is
    closed stores its references, the bytes being in the store. Projects' CSVs and exports
    read the saved record with its bytes (db.js `readProject`), as before.
  - **Only there.** `wakeTab` takes the asynchronous path only for a module registered with
    `dropBytes` whose parked state or history holds references to read (db.js `unread`);
    every other wake, every other module's included, is the synchronous one of the first
    version, unchanged. After a reload, the records of a `dropBytes` module's tabs not on
    show are read without their bytes (db.js `allTabStates(lazy)`).
- **No `bytes()`** (b2v3): the instances' estimates of what sleep gives back went with the
  memory budget, their only reader. What a hidden awake XRPD tab holds beyond its sleeping
  form was measured for them (`results/bytes.json`: blank 0.1 MB of heap and 1456 DOM
  nodes, 12 patterns 3.2 MB and 2535, refined 5.2 MB and 3345).

## 10. Module-level and instance-level

Keep at **module level**, shared by instances:

- pure functions and constants;
- caches keyed by data identity, as `WeakMap`s (XRPD's `reread` by bytes, xrd-peaks' `idOf`,
  DRS's and EPR's `spectra` by bytes);
- **what is worked out of the data** (b2v3, the user's "what has been computed is kept, not
  computed again"): utils.js `keeper(name, n)` gives `kept(data, key, make)`, which keeps
  `make()`'s result by `data`, an array fixed (a `WeakMap`: while a state on show, a tab
  asleep's parked state or a history holds the array, the result is there), under `key`,
  every other input exactly (`exactKey`: JSON with a NaN, an infinity and a −0 its own;
  `objId`: an object by its identity), the last `n` keys an array. An array not fixed keeps
  nothing. A tab woken, an undo to a state worked out before, a redraw and the CSVs take the
  result as it was made: the same object, so the same plots and CSVs byte for byte. Nothing
  may write into a result kept (the tests freeze each, as they freeze arrays fixed).
  `kept.made` and `kept.taken` count them by name. Kept now:

  | module | name | by | what |
  |---|---|---|---|
  | XRPD | `xrd-smoothing`, `xrd-peaks` (8 a pattern) | its intensities | a pattern's smoothing, SNIP baseline and the curve less it, by the widths; its peaks with their FWHMs, by those, the peak search and the peaks added and removed (xrd-peaks.js `procKept`) |
  | | `modelOf` (a `WeakMap`) | the standard's processing | its instrumental model, the Caglioti fit |
  | | `xrd-curves`, `xrd-difference`, `xrd-net` | its intensities | a refined pattern's calculated, background and ticks, its difference and its net pattern, by its 2θ, variance factors, instrument, all the curves take from the result, the phases (structure, colour) and the role (xrd-rv.js `curveKey`) |
  | | `xrd-ticks` | its intensities | a pattern not refined: its phases' reflections |
  | DRS | `drs-curve` (8), `drs-slope` | its F(R) | a card's curve as read and smoothed, its derivative |
  | | `drs-fits` (8) | its F(R) | every fit of a sample and what the card makes of them, by the card's kind, parameters and lines, an Urbach card's by its reference's key too |
  | | `drs-reflectance`, `drs-log` | its F(R) | the Results' R % and log F(R) |
  | GC | `gc-tables` (8) | its first gas's readings | a sample's tables (times, readings, flows, their integral), by its dates, readings, light-on, injection delay and flow parameters |
  | EPR | `epr-smoothed` (8) | its intensities | a spectrum smoothed, by its field and the width |
  | SEM | (`imgs`) | its file's id | its header, reduced copy and card levels (by the part of the image and the size, the last 4; a file read again adds to them), while a tab awake or asleep holds the file (§9) |

  Not kept: what is drawn (a plot's paths, the DOM: a tab asleep has none; awake it keeps
  them), the transforms made as a plot is drawn (a normalisation, an offset), and a few
  formulas over kept results (a Scherrer size from a kept FWHM). Nor in the records: a tab
  reloaded works its results out again as it wakes (§1).
- the registry of arrays fixed (db.js), page-wide;
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
- Its patterns' arrays are fixed (`fixedArrs`, b2v3), not frozen.
- The returned instance has `destroy` (the first version also `trim`, `show` and `bytes`).

**xrd-rv.js**

- `draw()` returns while `host.unseen()`.
- The settings window goes to `host.layer`.
- A sample waiting for the standard's run checks `host.placed()`, not `root.isConnected`.
- Its Escape key acts only while its window is in the page.

**xrd-peaks.js**

- The unread fourth array is dropped. (The first version's `trim(plots)` and `again()`, which
  let the processing go and remade it, went with the trim.)

**Tests**

- `tests/b2xrd.test.mjs`, 5 tests:
  - two XRPD tabs awake, each with its own files, view and undo;
  - a refinement in a tab left: on the pool, its results bit for bit those of one refined on
    show, its step, its record, its "*";
  - sleep after the minutes set in Settings, the busy exemption, the cap on the tabs awake,
    a wake with the whole history (b2v2 also the limit by memory);
  - the LRU;
  - a hidden tab saved as it is closed, reopened from Projects, and a reload.
- `tests/rvui.test.mjs`: one step adapted. Leaving a refining XRPD tab no longer asks; this
  is the behaviour b2 is for.

## 12. Converting the other modules

(The plan the stages followed, as it was written: what they did is in their notes; b2v2 has
no trim, b2v3 no `bytes()`, §9.)

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
