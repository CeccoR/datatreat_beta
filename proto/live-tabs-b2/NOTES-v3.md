# b2v3: no memory budget; any number of tabs, a cap on those awake; arrays fixed; what is worked out kept; the loader over every step

Round 3, in `b2.patch` (one git diff against HEAD, the app's files those of v517, b93ed5c).
**Part A** (§1–§3): three of the user's decisions (2, 8, 5a). Nothing else changed, but for
one thing found on the way and needed by the second: a reload reads the tabs' records one a
task (§2). **Part B** (§4–§6): two more (4a, 4-loader), measured against b2v2, then the
limit under the new policy, and the whole suite. **The review** (§7): its findings on parts A
and B, each reproduced, fixed at its root and tested; **the final check** (§8): three more, the
same way.

1. **No memory budget.** The policy, its MB, their Settings rows, every module's `bytes()`
   and what only they used are gone. The rules left: the count of tabs awake, and the
   minutes.
2. **Any number of tabs open, at most N awake.** No tab is refused (v517 and b2v2 refused a
   21st). At most N are awake, the one on show among them (Settings › Tabs in the
   background, 20 by default, in place of L); beyond, the one shown least lately sleeps,
   whenever it was opened. A busy tab never sleeps: the count may go over N until its job
   ends, and the excess then sleeps.
3. **Arrays fixed, not frozen.** An array a module makes and never changes is marked so in a
   registry (db.js `fixed`, a WeakSet), and `park`, `decode` and `stateKey` share it instead
   of copying it or writing it out. XRPD no longer freezes its patterns, and DRS's, GC's
   and EPR's arrays are no longer copied into every state parked.
4. **What is worked out is kept, not worked out again** (part B). Every result a module
   made again at a wake, a redraw or an undo from inputs that had not changed is kept by its
   data (utils.js `keeper`), so that a tab asleep keeps it and an undo finds it: XRPD's
   processing and Rietveld curves, DRS's fits, GC's tables, EPR's smoothing; SEM's
   thumbnails and cards stay while a tab asleep holds their files. An XRPD tab of 12 refined
   patterns wakes in 252 ms (b2v2 438), its longest task 154 ms (345); a DRS tab in 195 ms
   (326).
5. **The loader over every step that may take a while** (part B): wherever a long task
   (over 100 ms) remained without it, a switch to a tab awake at another width and a reload
   with a project changed, it is now on first, a frame drawn, and off after.
6. **The review** (§7): eight findings (nine, one found twice), none rejected. A SEM history
   woken holds one copy of a file's bytes again (it held one a step: 104.5 MB for 32.2); a
   file only its history holds keeps its thumbnail and cards across a wake (an undo made them
   again: 0.54 s, a task of 0.49 s, no loader); a read of a tab's files that fails as a whole leaves the
   tab asleep and its files stored (it woke without them and lost them); the loader over a
   tab left for Settings and shown at another width, and over a project written to a file
   (1.7 s); one record on show after two quick switches; a SEM crop's cards kept for an
   undo; dead code out.

## 1. No memory budget

Taken out, with nothing left that only it used:

- utils.js: `livePolicy` and `liveMB` (and `liveMax`, §2) from the settings and their ranges.
- index.html: the select "Limit the tabs awake in the background by" and the two rows it
  chose between (`.set-row`, styled by nothing).
- tabs.js: `bytesOf`, `overLimit` and its policy, `tabsNow`'s `bytes`, the Settings' wiring
  of the three fields.
- Every module's `bytes()`: xrd.js (`bytesNow`), sem.js, tauc.js, gc.js, epr.js, with their
  comments. API.md §9 keeps what XRPD's estimate was fitted to, as a measurement.
- Tests:
  - `b2xrd` test 3 lost its last step, a tab over 1 MB of estimate put to sleep;
  - `b2sem` test 3 saw the editor's image let go as its tab was hidden through `bytes()`. It
    now counts the canvases made as the tab is shown again: the editor's image (256 px
    wide) is made again, and its thumbnails' and cards' canvases are the same elements,
    marked before;
  - `b2cross`, `b2drs` and `b2gcepr` set `awakeMax: 7` where they set `livePolicy: 'count',
    liveMax: 6`: the same 7 tabs awake.
- The measure scripts of earlier rounds read `bytes` and `liveMax`: they record the
  versions they measured, and are left as they were.

## 2. Any number of tabs open, at most N awake

### What

- **No limit on the tabs open.** MAX_TABS (20) and its banner, "You already have 20 tabs
  open. Close one before opening another.", are gone (tabs.js `openTab`). It was read there
  alone (exported, imported nowhere), and no test asserted the refusal.
- **`settings.awakeMax`**: "Tabs awake at most, the one on show among them", 1–1000, 20 by
  default. It replaces L (`liveMax`: tabs awake not on show, 0–19, 6 by default, so 7 awake).
- **Which tab sleeps** (`keepLimits`): beyond `awakeMax` awake, the one on show counted (also
  while it wakes), the hidden ones that are not busy sleep in the order they were last on
  show (`seenAt`, set as a tab is left), until none is over. b2v2 took them in the order of
  `hidAt`, the time hidden that the minutes count, which a busy tab moves on to its job's
  end, so that a tab whose run ended late counted as shown late. A tab opened first but
  shown often is shown late, and stays awake.
- **Busy tabs** are passed over: the count stays over N while every other tab is asleep or
  busy, and a job's end (`onBusyChange` → `keepLimits`) puts the excess to sleep.
- **Every path keeps the cap.**
  - A new tab, a project opened on show (Projects, Save as) and every wake (a switch, a
    close that lands on a tab asleep, a reload's tab on show) go through `loadTabIfActive`.
    It now keeps the cap before the wake as well as after: the tab to put to sleep is let
    go before the new instance is made, so the page never holds N + 1 instances.
  - A switch to a tab awake keeps it after.
  - Projects' Open selected opens its tabs asleep.
  - A change of the setting applies at once.
- **The strip.** v517 scrolls it (overflow-x, its scrollbar hidden) and scrolls the tab on
  show into it (v506); both hold at 40 and 60 tabs (`b2cap`). A mouse had no way along it:
  the wheel over it scrolled nothing. Measured (15 GC tabs, the strip 1916 px wide in 1054,
  a wheel of 400 px): `scrollLeft` stayed 0 in b2v2 and became 400 in b2v3. tabs.js
  `initBar` now has the wheel over the strip scroll it sideways while it can, then the page
  as before; a trackpad's sideways swipe and Shift+wheel stay the browser's own.
- **No keyboard switching** between tabs exists in the app (the tabs take no focus; ← →
  step the samples): nothing to adapt.

### The places that held at most 20

sessions.js's restore and Projects' Open selected loop over what there is. A close writes
every tab's record again (`persistAll`, v517), `renderTabs` draws every tab, and a reload
reads every record. `measure/many.mjs` → `results/many.json`, on a profile on disk: XRPD
tabs of the 12 patterns (5384 points each) opened in turn, at 20 and at 60 (22 and 62 open
when read: two of the five opens timed stay); medians of 5 opens and of 3 of the rest:

| | 20 tabs | 60 tabs |
|---|---|---|
| a new tab (click → its loader gone + 2 frames) | 94 ms | 95 ms |
| to a tab awake / asleep (woken) | 29 / 201 ms | 44 / 228 ms |
| the strip drawn again (`renderTabs`) | 2.9 ms | 7.5 ms |
| a hidden tab closed: the page's thread / till every record is written | 4.9 / 470 ms | 7.6 / 1270 ms, no long task |
| a reload, till the tab on show is loaded | 470 ms | 792 ms |
| the reload's longest task | 78 ms | **76 ms** (493 ms before the change below) |

- **The reload did not cope**, and is changed. The records came from one `getAll`, one task
  of 0.64 s at 60 such tabs (0.47 s of it in its answer, reading the values: a CPU profile),
  before the shell showed. db.js `readRecs` now reads them by a cursor, in the same
  transaction, one record a task: the longest task 493 → 76 ms at 60 tabs, 142 → 78 ms at
  20 (`results/many-getall.json`, the same script before the change). The reload takes
  0.79 s at 60 (0.84 before).
- **A close writes every record again**: at 60 tabs 1.27 s till all are in the store, the
  page's thread 7.6 ms and no long task. Kept, as v517 has it; a write queued meanwhile (an
  autosave) waits that long.

## 3. Arrays fixed, not frozen

### How

- **db.js** `fixed(a)` puts an array in a WeakSet and gives it back; `isFixed(a)` asks. `park`
  and `decode` give a fixed array back as it is, not a copy (b2v2: a frozen array of no
  object, `frozenOwn`, gone). `expand`, `stored`, `fill` and `unload` already shared every
  array of no object. utils.js imports both and gives `fixed` to the modules.
- **utils.js** `stateKey` takes a fixed array by a hash kept for it (`numsKey`), where it took
  a frozen one.
- **What is fixed**, where each is made:
  - XRPD's patterns (2θ, intensities, variance factors), where a file is read or restored
    (xrd.js `fixedArrs`, which was `frozenArrs`);
  - the lists in XRPD's results: names of parameters, hkl. xrd-rv-model.js `frozen` fixes
    an array of no object instead of freezing it; the results' objects stay frozen (their
    lists are small: the three largest kinds, 1092 elements in 12 results);
  - DRS's and EPR's spectra (tauc.js and epr.js `keepSpectrum`, at a file's read and its
    restore);
  - GC's gases (gc.js `readGc`, and the restore of a file).
- **Removed**: XRPD's freeze of its arrays, the freeze of the results' lists, db.js
  `frozenOwn`, utils.js's `Object.isFrozen` in `stateKey`. Nothing else read
  `Object.isFrozen`.
- **Nothing writes into a fixed array.**
  - grep over every module and helper (writes by index, `sort`, `reverse`, `fill`, `splice`,
    `push`, `copyWithin` on `x`, `y`, `varMul`, `wl`, `FR`, `b`, `a`, `gas[k]`): only the
    readers write, while they build the arrays, before these are fixed. DRS's `scanRegr`
    reverses a slice of its own.
  - The tests: helpers.mjs sets `window.__freezeFixed`, and db.js then freezes each array
    as it is fixed, so that a write throws in the app's modules (strict). The 126 tests
    below ran so. `b2fixed` checks the freeze, and that without the tests' flag a fixed
    array is not frozen.

### Measured

`measure/fixed.mjs` → `results/fixed.json`, on a profile on disk. One tab beside a blank GC
tab on show; the JS heap after two forced GCs with the tab hidden and awake, then asleep, less
the page with the tab closed; files dropped as a DragEvent; readings 5.5 s after the last
change (sessions.js's trailing autosave holds a tab till then). 3 runs a tree, a browser
each; medians. The runs agreed within 0.02 MB.

| tab | b2v2 awake / asleep | b2v3 awake / asleep | saved awake / asleep | arrays held asleep, b2v2 → b2v3 |
|---|---|---|---|---|
| XRPD, 12 patterns of 5384 points | 4.57 / 1.41 MB | 4.37 / 1.22 MB | 0.20 / 0.18 MB | 24 frozen → 24 not |
| DRS, 10 Cary exports of 1201 points | 1.06 / 0.46 MB | 0.77 / 0.28 MB | 0.29 / 0.18 MB | 40 → 20 (24,020 numbers) |
| EPR, 10 spectra of 1024 points | 0.72 / 0.33 MB | 0.35 / 0.18 MB | 0.37 / 0.16 MB | 40 → 20 (20,480 numbers) |

- **XRPD: 0.2 MB a tab of 12 patterns**, awake and asleep, not the 1.5 MB that
  NOTES-drs.md estimated from arrays of random doubles (16 bytes against 8 for every
  number). Its 129,216 numbers are half intensities, all whole numbers here (checked: every
  intensity array of the 12, the same files byte for byte), and only the 2θ are fractions.
- **DRS and EPR asleep: their parked copies gone**, 0.18 and 0.16 MB, which are their
  24,020 and 20,480 numbers at 8 bytes. Asleep, a tab now holds one array a spectrum where
  it held two.
- **DRS and EPR awake: the history's key.** `stateKey` wrote every number of their spectra
  into the key of the state, which the history keeps: 317 KB of text for 10 DRS spectra,
  2.1 ms to make. It is now 2.2 KB, its arrays taken by their hash once (median of 9).
- GC: its gases are 72 numbers a file; not measured.

## 4. What is worked out, kept (part B, the user's 4a)

"Tutto ciò che è stato già calcolato, salvalo piuttosto che ricalcolarlo." Profiled before
the change (`measure/kept.mjs`'s tab, a CPU profile of its wake): an XRPD tab of 12 refined
patterns woken made its Rietveld curves again (115 ms of a 520 ms wake: `curvesFrom`, for
the pattern drawn and for each pattern's net in the Results) and its patterns' processing
(78 ms: smoothing, SNIP, peaks); a DRS tab of 10 spectra with a Tauc and an Urbach card
every fit, several times over a sample (the card, its Results, the Urbach card's reference,
its band, the regions' keys: 128 ms of 369 in `analyze`, 72 more through `taucWindow`); a
redraw (a resize) the same. GC's redraw made its tables again, EPR's drawing smoothed each
spectrum twice and its CSVs a third time. All of it is now kept.

### How

- **utils.js `keeper(name, n)`** gives `kept(data, key, make)`: `make()`'s result kept by
  `data`, an array fixed (part A's registry), in a `WeakMap`, under `key`, a string of every
  other input; the last `n` keys an array (4, or 8 where a sample has several kinds or
  widths in use). While a state on show, a tab asleep's parked state or a history holds the
  array, it holds its results: **a tab asleep keeps them** with nothing parked beside its
  state, and **an undo to a state worked out before** finds them. An array not fixed keeps
  nothing (its result made each time), so nothing can come from data changed in place.
- **Keys hold every input, exactly**: `exactKey` (JSON, a NaN, an infinity and a −0 written
  as such), arrays and objects by identity (`objId`; a fixed array never changes), a
  result's values as JSON (a result read back by an undo is a copy: the same key). XRPD's
  curves: the pattern's 2θ and variance factors, its instrument, what the curves take of the
  result (parameters, models, textures, its fit settings, its phases and cells), each
  phase's structure (`prep`: one object for one CIF text; the standard's LaB6 now one for
  the page, `LAB6_PREP`) and colour, the role (sample or standard): the inputs the card's
  `curveInputs` compared before, now a key. A changed input gives another key, made anew;
  nothing stale can be shown.
- **The same object back**: a result kept is the one made, so the plots and the CSVs drawn
  from it are those of a fresh computation byte for byte (tests below: the golden hashes,
  which the plots' test takes of a first drawing, met by a woken tab). Nothing writes into
  one: the tests freeze every result kept (`window.__freezeFixed`, as for arrays fixed).
- **Counted**: `kept.made[name]`, `kept.taken[name]` (SEM counts its reduced copies and
  cards there too), for the tests and `measure/kept.mjs`.

### What is kept

| module | kept (name) | by | under |
|---|---|---|---|
| XRPD, peaks (xrd-peaks.js) | smoothing, SNIP baseline, the curve less it (`xrd-smoothing`); peaks with FWHMs and their esds (`xrd-peaks`, 8) | the pattern's intensities | the widths; the peak search, the peaks added and removed (the card's own `procKeys`, now module-wide) |
| | the standard's instrumental model, its Caglioti fit (`modelOf`) | the standard's processing | — |
| XRPD, Rietveld (xrd-rv.js) | calculated, background, ticks (`xrd-curves`); difference (`xrd-difference`); net, for the Results (`xrd-net`); a pattern not refined, its reflections (`xrd-ticks`) | the pattern's intensities | `curveKey` (above) |
| DRS (tauc.js) | a card's curve as read and smoothed (`drs-curve`, 8) and its derivative (`drs-slope`); every fit of a sample and what the card makes of it, E_g, E_U, the subtracted Urbach fit (`drs-fits`, 8); the Results' R % and log F(R) | the spectrum's F(R) | the card's kind, wavelengths, exponent and widths; its lines; an Urbach card's reference's own key for the sample |
| GC (gc.js) | a sample's tables: each gas's times, readings, flows, their integral (`gc-tables`, 8) | its first gas's readings | dates, every gas's readings, light-on, injection delay, flow's rate, T, p, mass |
| EPR (epr.js) | a spectrum smoothed (`epr-smoothed`, 8) | its intensities | its field, the width |
| SEM (sem.js) | header, reduced copy, card levels by the part of the image and the size, the last 4 (`imgs`; §7) | the file's id | — (below) |

- DRS's card no longer fits its sample twice at each drawing (once for its own statistics,
  once in `analyze`): it takes `analyze`'s fits, the same calls on the same inputs. Its
  Results' curves are the card's own kept ones, the same numbers. A fit moved by a line
  being dragged is made, not kept, till the line is let go.
- **SEM, "check it fits": it did not.** What a file is made into (its thumbnail and its
  card's levels) measured 3.4 MB of ArrayBuffers a tab of 8 images of 2048 × 2176 asleep
  (`kept.json`), not the 1.2 MB the comment's 0.15 MB an image gave; b2v2's 32 MB for the
  files let go held some 9 such tabs asleep, and past them the first put to sleep made theirs
  again at their wake (0.67–0.93 s, a long task of 368–551 ms, `NOTES-v2.md`). Now it stays
  while a tab asleep holds the file, and goes with the last such tab closed or woken (its
  RawRef holds it again): tabs.js tells the module which tabs sleep holding what
  (`registerModule`'s new `asleep(key, v)`, called as a tab sleeps, is restored or opened
  asleep, and with null as it wakes or closes), and SEM keeps the ids they name. b2v2 kept
  them also for tabs closed, 32 MB at most; the count of 512 headers is gone too.
- **Not kept**: what is drawn (the DOM, a plot's paths: a tab asleep has none, an awake one
  keeps its own), the transforms a drawing makes (a normalisation, an offset, the derivative
  scaled onto the curve), a Scherrer size from a kept FWHM (a formula at drawing).
- **Not in the records** (my call, by cost): kept results are the page's only. In a record
  they would be written again at every autosave of the tab (an XRPD tab of 12 refined some
  3.4 MB more each time) and carried into project files, for one gain, the first wake after
  a reload (an XRPD tab's 0.2 s), and kept across versions they would need a version in
  their keys. A reload works them out again at the wake, under the loader.

### Measured

`measure/kept.mjs` → `results/kept.json` (`kept.log`): one tab beside a small one on show, a
profile on disk, headless, the machine otherwise idle; memory (JS heap and ArrayBuffers
after two forced GCs and a pressure signal) with the tab hidden awake, then asleep, less the
page with it closed; 4 wakes a run by a real click (pointerdown to two frames after the
loader is gone), the longest task within; 3 runs a tree, a browser each; medians.

| tab | wake, b2v2 → b2v3 (median, max) | longest task in it | memory awake, b2v2 → b2v3 | asleep |
|---|---|---|---|---|
| XRPD, 12 patterns refined | 438 (516) → **252 (283) ms** | 345 (421) → **154 (186) ms** | 6.5 → 7.3 MB | 1.2 → 4.6 MB |
| DRS, 10 spectra, a Tauc and an Urbach card | 326 (370) → **195 (219) ms** | 234 (283) → **114 (131) ms** | 1.4 → 1.4 MB | 0.5 → 1.2 MB |
| GC, 10 files | 122 → 135 ms | none over 50 ms but one (72, 67) | ~0 | ~0 |
| EPR, 10 spectra | 113 → 105 ms | none over 50 ms | 0.6 → 0.3 MB | 0.2 → 0.1 MB |
| SEM, 8 images 2048 × 2176 | 171 → 176 ms | 73 → 75 ms | 67.8 → 71.2 MB | −0.2 → 3.2 MB |

- **Nothing made again by any wake** in b2v3 (`madeByWakes` empty in every run): the 4
  wakes of a run took 16 curves, 144 nets, 48 processings (XRPD), 132 fits (DRS), 40 tables
  (GC), 80 smoothed spectra (EPR) as kept.
- **What kept results cost**: an XRPD tab of 12 refined patterns 0.8 MB awake (its curves as
  Float64Arrays, 1.0 MB of ArrayBuffers, for every pattern now, where b2v2's card kept the
  last pattern drawn) and **3.4 MB asleep** (curves, nets and processing of 12 patterns:
  some 0.28 MB a pattern); a DRS tab of 10 spectra 0.7 MB asleep; GC and EPR below what
  this reads. SEM: its 3.4 MB of thumbnails and cards a tab asleep, which b2v2 kept as well
  but also after the tab was closed (its baseline then held them: hence its −0.2 MB asleep
  and 3.4 MB less awake).
- **The wake's long task is now its drawing**: XRPD's 154 ms are the plots, cards and
  Results drawn as a new instance's section is filled (profiled: no `curvesFrom`,
  `computeBaseline` or fit left in it); DRS's 114 ms the same. Both are under the loader.

## 5. The loader over every step that may take a while (part B, the user's 4-loader)

"Nascondi tutto col caricamento che c'è già oggi", wherever needed. `measure/loader.mjs`
watches every long task (over 100 ms, a PerformanceObserver) on the paths a user takes and
whether the loader was on before it began, a frame drawn between (a requestAnimationFrame),
and still on as it ended. Five tabs (XRPD 12 refined, DRS 10 + Urbach, GC 10, EPR 10, SEM 8
images 2048²), a profile on disk; steps: switches among tabs awake, switches after the
window was narrowed or widened, a run ended in a tab hidden, wakes, new tabs of each module,
a project opened from Projects, an undo and a redo, a reload of the ten tabs.

Found in b2v3 as part A left it (the wakes, new tabs, projects opened and the reload's
restore were already under the loader, tabs.js `activateTab` → `afterPaint` → load):

1. **A tab awake shown at another width of the window**: its redraw, two frames after the
   show (goTab), drew every plot again with no loader: 151 ms for XRPD, 50–82 ms in two
   tasks for DRS.
2. **A reload with a project tab changed**: after the loader went, sessions.js took the
   saved record's key by restoring it into the tab's own instance and back
   (`runWithModuleState`), which drew both: 415–466 ms, the loader gone (CPU profile).

Changed:

- **tabs.js**: a tab awake shown again draws nothing when it is shown at the width (and zoom)
  it was left at and nothing changed meanwhile (its draw keys): shown at once, as before.
  Left at another width, or changed while hidden (its history moved: a job's results), it
  is shown under the loader: on, a frame drawn, the tab put in the page, its redraw, the
  loader off two frames after (`redrawn`, `showLater`; the window's width and zoom kept as a
  tab is left, `view`, for another tab or for a fixed section, §7; `changed` from
  `onAnyChange`). The same for a tab shown back from Home, and for the tab a close lands on.
  A project written to a file goes under the loader too (`underLoader`, §7).
- **sessions.js** `takeSavedKey`: the saved record's key read out of an instance of its own
  (utils.js `withState`), which draws nothing, not the tab's: 140 ms where it was 466; and
  the load of such a tab waits, the loader on, till the record is read and the key taken
  (`onTabLoaded` gives the read's promise, tabs.js `loaded` and `loadTabIfActive` wait for
  it; a wake reading its files' bytes passes it on).
- **utils.js** `makeInstance`: an instance is `shown()` only while its module's section in
  the page is its own, so that `withState`'s, out of the page, never draws (its module's name
  stood for it, which made it draw while that module was on show).

Measured: `results/loader-b2v2.json` and `results/loader-b2v3.json` (same script, each tree).

| step (count) | b2v2: long tasks over 100 ms | not under the loader | b2v3: long tasks over 100 ms | not under the loader |
|---|---|---|---|---|
| switch to a tab awake (10) | none (longest 61 ms) | — | none (longest 69 ms) | — |
| switch after the width changed (6) | 3: XRPD 165, DRS 176, DRS 188 ms | **all 3** | 2: XRPD 145, DRS 111 ms | none |
| a run ended hidden, its tab shown (1) | none | — | none | — |
| wake (5; 3 asleep, 2 awake) | XRPD 417, DRS 298 ms | none | XRPD 167, DRS 167 ms | none |
| new tab of each module (5) | none (longest 92 ms) | — | none (longest 52 ms) | — |
| a project opened from Projects, shown (1) | 390 ms | none | 429 ms | none |
| undo and redo (1) | none (64–74 ms, no loader) | — | none (62–68 ms) | — |
| reload, 10 tabs (1) | 457 and 410 ms (and 56) | none this run | 514 ms | none |

- **Every long task over 100 ms on these paths is under the loader in b2v3**, shown before it
  began with a frame drawn, and on till it ended. In b2v2 the switches after a change of
  width were not (3 of 3). Its reload's second task, the saved key taken by drawing the tab
  twice, was under the loader in this run only because the project's record came back
  before the loader went: in b2v3's own run before the change it did not (415 ms, the loader
  gone, `takeSavedKey` in a CPU profile). b2v3's reload takes the key inside the wake, in
  one task of 514 ms.
- **The longest tasks left are a project's first wake (429 ms: a project read from the
  store has new arrays, nothing kept for them yet) and a reload (514 ms, the same), both
  under the loader.** A wake from sleep is 167 ms at most here; switches to a tab awake stay
  without a loader and without a task over 69 ms.
- A task between 50 and 100 ms, which the brief leaves to the loader's judgement, remains on
  a switch to an awake DRS tab (59–69 ms, in both versions) and on an undo in XRPD (62–74
  ms): no loader there, as in v517.

## 6. The limit under the new policy

`measure/lim-series.mjs` with a new policy, `cap` (b2v3): at most 20 tabs awake
(`awakeMax`, the Settings' default), none put to sleep by its minutes (sleepMin 1440, so
that the cap alone decides), any number of tabs open; a profile on disk (LIM_PROFILE=disk).
`LIM_TAG=v3 sh lim-run.sh b2:mix:cap:0,…,40 b2:sem:cap:0,…,30` → `results/lim-b2v3-mix-cap`
and `lim-b2v3-sem-cap` (`.json`, `.log`); the method of ASSESSMENT.md's "Option b2 built"
otherwise (Private summed over every Chromium process after two GCs and a pressure signal;
peaks every 200 ms; work on show by real keys; switches by real clicks; the background's
long tasks; at the end every hidden tab put to sleep and 4 woken). One run each, the machine
otherwise idle. Files of their own for every tab (`lim-fx.mjs`, now 31 sets). b2v2 refused a
21st tab: no b2v2 run reaches these N; its SEM run on disk to 24 (`lim-b2v2disk-sem.json`,
every tab awake) is the comparison where there is one.

**Mix** (X0 refined and S0 worked in, a DRS, a GC and an EPR tab, then N in the background:
SEM, XRPD refined, XRPD refining in turn; 45 tabs open at N = 40):

| N | Private after GC / peak, MB | awake / asleep / busy | → in X0 | smoothing in X0 | SEM crop | SEM figure | switch to a tab awake / asleep |
|---|---|---|---|---|---|---|---|
| 0 | 325 / 534 | 5 / 0 / 0 | 61 ms | 74 | 39 | 30 | 103 / — |
| 8 | 854 / 1102 | 13 / 0 / 2 | 69 | 88 | 41 | 37 | 87–153 / — |
| 16 | 1203 / 1458 | 20 / 1 / 5 | 63 | 80 | 48 | 30 | 98–139 / — |
| 24 | 1279 / 1584 | 20 / 9 / 8 | 79 | 95 | 53 | 31 | 131–156 / — |
| 32 | 1268 / 1598 | 20 / 17 / 10 | 67 | 103 | 50 | 32 | 131–136 / 274 |
| 40 | **1161 / 1590** | 20 / 25 / 13 | 63 | 85 | 56 | 33 | 124–133 / 488 |

**SEM** (X0, S0, then N SEM tabs of 8 images 2048 × 2176 at 16 bits, 71 MB of files each):

| N | Private after GC / peak, MB | awake / asleep | → in X0 | crop | figure | b2v2 on disk, every tab awake |
|---|---|---|---|---|---|---|
| 0 | 265 / 436 | 2 / 0 | 63 ms | 41 | 30 | 268 / 432 |
| 8 | 877 / 1105 | 10 / 0 | 57 | 44 | 31 | 879 / 1110 |
| 16 | 1507 / 1739 | 18 / 0 | 58 | 44 | 31 | 1512 / 1753 |
| 24 | 1702 / 1934 | 20 / 6 | 59 | 51 | 29 | 2139 / 2371 |
| 30 | **1724 / 1956** | 20 / 12 | 57 | 45 | 31 | — (refused) |

- **The cap holds the memory.** Past 20 tabs a tab more costs what it holds asleep: a SEM
  tab some 3.5 MB (its thumbnails and cards, kept; N = 24 → 30, +21 MB for 6), an XRPD tab
  refined 4.6 MB of heap and ArrayBuffers (`kept.json`: its state, history and kept
  results); the busy XRPD tabs (13 at N = 40) stay awake within the 20, so that fewer SEM
  tabs are (4 at N = 40 against 7 at 24): the mix's Private falls from 1279 to 1161 MB as N
  goes from 24 to 40. b2v2 on disk with every tab awake held 2139 MB at 24 SEM tabs.
- **Within about 3 GB** (the assessment's target, less a peak margin of 0.45 GB): the 20
  tabs awake take what they hold (here 1.6–1.9 GB at their peak with 20 SEM tabs or 13
  refining), and each tab past them some 3.5–5 MB: several hundred more tabs before 3 GB.
  Settings' number is the lever on the awake part.
- **Work on show stays where it was** with 45 tabs open: → 55–83 ms, the SEM crop 38–56,
  the figure 26–37 (ASSESSMENT.md: 72–105, 41–68, 29–37). The smoothing, 66–103 ms, is
  faster than then (141–219): the script types two widths in turn, and from the second time
  each is kept. The longest task within the keys' own windows: 82–160 ms.
- **The background**: no long task in any 4 s idle and none outside the script's own
  actions, at any N, in either run.
- **Wakes** at the end (every hidden tab put to sleep in one call: 19 tabs in 3.6–10.4 ms):
  SEM 405–456 ms (longest task 81–145), XRPD refined 232 ms (143), XRPD refining before
  328 ms (226: its last runs' results were never drawn, so made then); b2v2 on disk woke
  SEM in 420–517 ms (103–133). Every tab asleep: 295 MB (SEM, 32 tabs), 704 MB (mix, 45
  tabs; 873 after the 4 wakes).

## 7. The review's findings

Nine findings of three reviewers on parts A and B, eight distinct (`hideTab`'s twice). Each
reproduced first on a fresh git-archive of HEAD (a44b222) with part B's patch (d54978fe…),
by the reviewer's own script; each fixed at its root, with a test that fails on that tree and
passes on this one (the same test file run with `DT_ROOT` on each); none rejected. Measured
with `measure/review3/` (the reviewers' scripts made portable) → `results/review3.log`: a
profile on disk, headless, one run each, part B's tree on 8991 and this one on 8990, the
machine otherwise idle.

1. **A SEM history woken held a copy of a file's bytes at each step that held it** (db.js
   `fill`). SEM's snapshots share one RawRef a file. `unload` copies it once, so its array is
   met once and its reference gets no id; `fill` then met that one copy at every step and made
   a RawRef each time, its array copied (`b.slice()`) at every step but the first. Now `fill`
   gives one result for one object met (a `Map`), as `unload` made one: the history woken
   holds one RawRef and one array a file, as before its sleep. A record read is as before
   (park and encode make an object a place). `p8-dupmem` (4 images 2048 × 2058 at 16 bits,
   each relabelled, two removed; asleep, woken): the history 4 arrays, 32.2 MB, before the
   sleep, and woken 13 arrays, 104.5 MB (the page's ArrayBuffers after two GCs 53.3 →
   124.7 MB); now 4 arrays, 32.2 MB, and 53.3 MB; the wake 357 → 299 ms. Test: `b2sem` 4,
   the history's RawRefs and arrays counted by file before the sleep and woken, one each
   (c.tif, removed, in two steps).
2. **A wake let go of what was made of a file its history alone held** (sem.js
   `asleepHolds`). At the wake, `asleep(key, null)` found such a file not alive (the
   history's RawRefs were `load`'s copies, in no `raws`) and dropped its header, reduced copy
   and card; an undo bringing it back made them again, with no loader. Now SEM takes, at that
   call, the woken history's RawRefs as the files' own (`adopt`: `rawOf` keeps each where none
   is kept, else puts the one kept in its place), as they were before the sleep: they hold
   what the file was made into, and its end (`gone`) lets it go. `p9-removeall` (8 images
   2048 × 2058, Remove all, a sleep and a wake, Ctrl+Z): 542 ms, a task of 485 ms, no
   loader, 8 reduced copies and 8 cards made; now 158 ms, the longest task 82 ms, nothing
   made (76 ms with the tab awake throughout). Test: `b2sem` 4, an undo after the wake
   bringing back c.tif, which the history alone held: no thumbnail or card made
   (`kept.made`); the census above (one RawRef a file, the state's).
3. **A read of a tab's files failing as a whole woke it without them, and lost them**
   (tabs.js `wakeLater`). Its record, written as it woke, held no file, and a sweep deleted
   bytes that the store held whole. Now such a wake is given up: the tab stays asleep as it
   was (its references, its record), Home is put on show (a fixed section on show stays), a
   banner says its files could not be read and that showing it reads them again; shown again
   (`activateTab`: the tab on show asleep, its wake not going on), it reads them. A reload
   keeps the records it cannot read the same way. Files the store lacks after a read that
   worked still come back without them, said so. Test: `b2sem` 5, the bytes store's reads
   made to throw: the banner, the tab asleep with its references, Home on show, the loader
   off; its record holding its file and the store too after a sweep; shown again, woken with
   it.
4. **A tab left for Home, Projects or Settings took the window's width of the moment another
   tab was chosen from there** (tabs.js `hideTab`; found by two reviewers). Its plots were
   drawn at the width it was left for that section at (`onSectionChange` keeps it), which
   `hideTab` wrote over: shown again at the new width it was not `redrawn`, and drew every
   plot again in one long task with no loader. Now `hideTab` keeps a width kept as the tab
   was left for a fixed section. `p7` (XRPD, 12 patterns refined; Settings, the window 1400 →
   1100 px there, the GC tab, the XRPD tab): no loader, a task of 126 ms; now the loader on,
   its task of 127 ms under it. Test: `b2kept` 2, DRS: Settings, the window changed there,
   another tab, back: the loader on first.
5. **Two switches within a switch's frames left the record of the tab left first on show**
   (tabs.js). The records whose `active` changed were written by the step that showed the
   tab chosen (two frames on, `showLater`; a wake's end, `loadTabIfActive`), which a second
   switch meanwhile skipped: two records `active`, a reload showing the first. Now the tab
   left writes its record at the switch, the tab shown its own as it is shown, and a close
   writes every record at once (their order changed too), not after its step.
   `p-persist`: `persistTab` takes 0.7 ms of the page's thread for an XRPD tab of 12 refined
   (median of 7; its write queued). Test: `b2cap` 3, three GC tabs, two clicks within the
   frames: one record `active`, the last chosen's, on show after a reload.
6. **Dead code** (xrd-rv-model.js): `curveInputs`, `sameArr`, `sameInputs`, which xrd-rv.js
   read to part B (`keeper` took their place), and their comment naming `curveKept`. Taken
   out, `exactJson` kept (`curveKey`'s). Nothing else imports them (grep over the app and the
   tests); the XRPD tests pass.
7. **An undo or a redo of a SEM crop made its group's cards again** (sem.js `cardOf`): a
   file kept one set of card levels, the last made. Now it keeps those of the last 4 parts
   of the image and sizes it took (`imgs`' `cards`, a `Map`, the last used last), 0.08 MB
   each at most (200 px across, 16 bits). Counted (the reviewer's `probe-semcard8`, 8
   images 2048 × 2176, `kept.made`): a crop 1500 px wide made 8 cards, then undo, redo and
   undo 8 each (32 in all); now 8, and none by the three. Test: `b2kept` 3, the fixture's
   three images, a crop 128 px wide made, then undo, redo, undo: none made.
8. **Writing a project to a file froze the page** (sessions.js `exportJson`,
   `exportProjectRecord`; v517's, not part B's): its files' bytes written as base64 in one
   task with no loader (the reviewer's 1.65–1.75 s for a SEM project of 8 images 2048 × 2176,
   90.7 MB, in the tests' context: no IndexedDB in that task). Within the user's "no visible freeze anywhere": now under the loader, a frame
   drawn first (tabs.js `underLoader`), from the project's bar and from Projects (a row, and
   Export selected: on till the last is written). Test: `b2kept` 4, two images 2048 × 2058
   written from the bar and from Projects: each long task with the loader on before it, a
   frame drawn between, the loader off after.

Left as it was: a crop typed on the tab on show makes its group's cards in its own task, with
no loader, as any edit on show does (Not done, below).

## 8. The final check's three

The check of §7's fixes left three issues of low severity, each with a script. Each
reproduced first on a fresh git-archive of HEAD (2f49d4a) with its patch (94b5bd99…) by that
script, fixed at its root, and given a check in the b2 tests that fails on that tree and
passes on this one (the same test files run with `DT_ROOT` on each). Logs:
`results/tests-b2v3d.log` (the scripts' outputs on both trees, the new checks failing on the
old one, the tests below).

1. **A tab chosen and left again before its show took the window of that moment as the one
   it was drawn at** (tabs.js `hideTab`). §7's fix 4 kept the width only for a tab left for
   a fixed section; the cause was wider: `hideTab` took the window of the moment for any tab
   left, also one not on show since it was last left. X (XRPD, 12 refined) left at 1400,
   chosen at 1180 (its show two frames on, `showLater`), and another tab chosen within those
   frames: X took 1180, at which it was never drawn, and shown later at 1180 it was not
   `redrawn`: at once, every plot drawn in one task of 128 ms, no loader. Now a width is
   taken only from a tab on show till then: `showTab` sets `view` to null and every leave
   takes it, so `hideTab` and `onSectionChange` take it only where `view == null`; any other
   keeps the one it was drawn at. A tab woken behind a fixed section (a wake whose read
   ended there, `wakeLater`; a wake asked from there, below) is drawn at no width, `view`
   '', so shown from there it goes under the loader too (it took null: the same gap). Every
   path that shows a tab goes through `showTab` (a switch, `showLater`, a wake, a new tab, a
   reload's, a close's landing), and only `redrawn` reads `view`: nothing else took the width
   `hideTab` wrote. `superseded.mjs` (a profile on disk): X's view 1180 → 1400, the loader off
   → on, its tasks (68, 117 ms) under it. Test: `b2cap` 3, after the two clicks within a
   switch's frames, the first tab shown: the loader on first.
2. **Home, Projects or Settings clicked within a switch's frames was lost** (tabs.js
   `showLater`; `loadTabIfActive` the same). The step deferred two frames checked only that
   its tab was still the active one, which a fixed section does not change: it showed the
   tab (an awake one at another width), or woke and showed it (one asleep: the same probe
   found it), its module back over the section, no nav button on. Now it gives way to a
   fixed section put on show since it began: `showLater` counts them (`_toFixed`, from
   `onSectionChange`) and does not show the tab, its record and the limits as before (its
   `done`); `loadTabIfActive` does not wake it (its module was put on show as it began, so
   `_onFixed` says one came since). The tab stays as it was, its width the one it was drawn
   at (1., above), asleep if it was; shown from the section, under the loader, drawn or woken
   then. A wake asked from a fixed section (`ensureLive`, a close's Save) wakes the tab
   behind it (`loadTab` gives `_onFixed` to `wakeTab`, as `wakeLater` does), no longer over
   it. `quick2.mjs` (the clicks in one task) and `fixed.mjs` (the switch let through first,
   as two clicks are; an awake tab and an asleep one): the GC section on show → Settings, the
   tab shown from there under the loader. Test: `b2kept` 2, DRS, awake at another width and
   then asleep: chosen, Settings clicked before its show (asserted), Settings alone on show,
   the tab as it was; shown from Settings, the loader on first, nothing made again.
3. **A file read again dropped what was kept of it** (sem.js `remember`). §7's fix 7 keeps a
   file's card levels for its last 4 crops; a reading of the same file (in another tab, or
   after its removal) put a new entry in its place, its cards the default crop's alone and
   its reduced copy the reading's, so that the next redo or wake in the first tab made the
   others again (one card a file, 10–15 ms a card of 2048²). Now `remember` adds to the
   entry kept: its cards kept, the reading's added under its key (the last used, 4 at most),
   its reduced copy kept where it has one. `cards.mjs` (re-read, then redo): 1 card made →
   none. Test: `b2kept` 3, after the crop's undo, redo and undo, the same three files read
   in a new SEM tab, back, redone: no card made.

The tests of what changed and the b2 ones named by the check, `b2cap`, `b2kept`, `b2sem`,
`b2xrd`, `b2cross`, `tabs`, `sem`: **27 of 27 pass** (3 min 10 s), no page error and no CSP
violation where they assert it; the new checks fail on the old tree, each where it should
(`b2cap` 3 on the loader, `b2kept` 2 on Settings on show, `b2kept` 3 on the card made). The
whole suite was not run again: nothing outside tabs.js and sem.js changed. Lint: tabs.js and
sem.js exactly their findings before (sem.js's `screen`), `b2cap` and `b2kept` none. The
changes: 5 files, +79 −20 (tabs.js, sem.js; `b2cap`, `b2kept`, tests/README.md's two rows).

## 9. The hash's own echo

The check of §8 found one more case, made by §8's own fix: from Home, Settings (or
Projects) clicked and then a tab whose show is deferred (awake and left at another width:
showLater), before the browser's hashchange for Settings has run. goTab sets the hash, and
the app's hashchange listener (utils.js) ran goTab again for the section already on show:
nothing on screen, but onSectionChange counted it as a fixed section chosen anew, so
showLater gave up the tab's show and the click was lost (Settings stayed on show). Real
input reaches it: two clicks queued behind a long task are dispatched before the
hashchange task.

The fix, one line in utils.js: the listener leaves a section already on show alone (`t !==
_activeTab`). Back and Forward to another section, a deep link and a deliberate click on
Settings or Home are unchanged (a Back/Forward/deep-link probe gives the same sections on
v517, on the patch before this line and after it). Test: `b2kept` 2 ends with the case
(Home; the window narrowed; Settings and then the DRS tab clicked in one task): the tab on
show and its label on. It fails on the patch of §8 (`['tab-settings']`) and passes with the
line. `b2kept`, `b2cap` and `tabs`: 10 of 10. Lint: utils.js its findings before (`screen`),
`b2kept` none. The changes: utils.js +3 −1, `b2kept` +12.

## Tests

### The review's fixes

**The whole suite, `DT_ROOT=<tree> npm test`: 213 of 214 pass** in 13 min 3 s
(`results/suite-b2v3c.log`), on a fresh git-archive copy of HEAD (a44b222) with the new
`b2.patch` (the tree identical, file by file, to a second copy made from the delivered
patch). The one failure, `bytestore`'s "a rename from the list writes the title alone…",
waited 30 s for the tab's new title after a rename in Projects; run again alone on the same
tree it passed 3 times of 3 (2.9 s each, in the log), and it passed in the run below. Its
path (Projects' rename, `retitleProject`, `setTabTitle`) is none these fixes touch: taken
as a failure under load. Two comments (sem.js `adopt`'s, tabs.js `underLoader`'s) were
reworded while the suite ran, in its tree and the work tree alike, files replaced whole.

Before it, on the work tree: the tests of what changed and every b2 test, `b2xrd`, `b2sem`,
`b2drs`, `b2gcepr`, `b2cross`, `b2cap`, `b2fixed`, `b2kept`, `tabs`, `sem`, `db`,
`bytestore`, `roundtrip`, `rvmodel`, `rvui`: **69 of 69 pass** in 4 min 41 s
(`results/tests-b2v3c.log`). The new checks (§7) fail on part B's tree, each where it should:
`b2sem` 4 on the history's census (a.tif and b.tif 3 RawRefs, c.tif 2 arrays), `b2sem` 5 on
the banner (it came back without its files), `b2kept` 2 on the loader after Settings,
`b2kept` 3 on the cards made by the undo, `b2kept` 4 on the loader before the export's long
task, `b2cap` 3 waiting in vain for one record on show. New tests: `b2cap` 3 and `b2kept` 4;
`b2sem` 4 and 5, `b2kept` 2 and 3 have more steps; tests/README.md's rows and count (214).

### Part B

**The whole suite, `DT_ROOT=<tree> npm test`: 212 of 212 pass**, in 12 min 28 s
(`results/suite-b2v3b.log`), on a fresh git-archive copy of HEAD (49beb52) with the new
`b2.patch` applied (the tree identical, file by file, to the one part B's changes and
measurements were made on), every array fixed and every result kept frozen by the tests
(helpers.mjs), no page error and no CSP violation where the tests assert them: v517's 183,
the pool's 4, b2's modules' 15 and cross-module 3, part A's 4 (`b2cap`, `b2fixed`) and the 3
new ones below. Before it, while the changes were made: the tests of each module touched
(XRPD's `b2xrd`, `xrdcards`, `rvui`, `undorun`, `widths`, `rvmodel`; DRS's `b2drs`,
`widths-drs`, `drsread`; GC's and EPR's `b2gcepr`, `gcp`, `gcrep`, `modules`; SEM's `sem`,
`b2sem`; `plots`, `csv`), every b2 test, `tabs`, the stores' (`db`, `bytestore`,
`roundtrip`) and `b2cap`, `b2fixed`: all passed.

New, `tests/b2kept.test.mjs` (3 tests, about 45 s), each with no page error and no CSP
violation (asserted), every result kept frozen by the tests (a write into one throws):

1. **XRPD**: the plots' test's scenario (3 patterns, every card stepped once), its plots the
   golden hashes; another tab shown, the XRPD tab put to sleep and shown (the loader on as
   it wakes): `kept.made` the same across the wake (no smoothing, baseline or peak made
   again), the processing taken, the plots the golden hashes again. The CIF and Refine all:
   the curves made, each pattern's; asleep and woken, nothing made again, the curves and
   nets taken, every plot as before it slept and every CSV byte for byte; narrowed and
   widened, drawn again, nothing made. Settings' background degree 8 and the pattern on show
   refined again: its curves made, its plots changed; undone, the plots as before; redone,
   the new ones; nothing made by either, the curves taken.
2. **DRS**: the plots' scenario, golden; asleep and woken (its cards stepped back to the
   sample shown before: a woken tab shows the first, as in b2v2), no fit, curve or derivative
   made again, golden again. An Urbach card on the Tauc one, both samples shown on it: asleep
   and woken, nothing made again, every plot as before, every CSV byte for byte. The Tauc
   card's exponent 2: both cards' fits made again (4 at least: the Urbach card's subtracted
   ones follow its reference's), plots changed; undone, the plots and CSVs as before; redone,
   the new ones; nothing made by either. Shown from another tab at another width: the loader
   on at once, nothing made, drawn; shown at the width it was left at: no loader.
3. **GC, EPR, SEM**: GC's and EPR's plots golden; asleep and woken, golden again, their CSVs
   byte for byte. A SEM tab of 3 images (dropped, no handle on them) asleep, its record
   written, its bytes taken out, the files' arrays collected (WeakRefs emptied after forced
   GCs): woken, its thumbnails and cards drawn, no table, smoothing, reduced copy or card
   made again by any of the wakes.

The plots' comparisons are at a settled layout (the window narrowed and widened back): a
plot drawn as a section is put in the page can differ in its last digit (0.01 px; b2v2's
woken XRPD tab does too, seen while writing the test), as the plots' test says of a first
drawing. A woken DRS tab shows its first sample, not the one shown before it slept (b2v2
the same): the sample on show is no part of DRS's state.

### Part A

On a fresh git-archive copy of HEAD (0ddc38e) with part A's `b2.patch`, the tests of what
changed, not the whole suite (part B ran it): **126 of 126 pass**, in 7 min 9 s
(`results/suite-b2v3.log`), every array fixed frozen by the tests:

- `tabs`, every b2 test (`b2xrd`, `b2sem`, `b2drs`, `b2gcepr`, `b2cross`), the two new ones;
- the stores' (`db`, `bytestore`, `roundtrip`: db.js changed);
- XRPD's (`xrdcards`, `rvmodel`, `rietveld`, `rvui`, `undorun`: its arrays and results);
- DRS's (`drsread`, `widths-drs`), GC's (`gcdate`, `gcp`, `gcrep`), DRS/GC/EPR's `modules`;
- the strip's `narrow`.

No test file is named `sessions*`; none asserted the 20-tab refusal.

New, `tests/b2cap.test.mjs` (2 tests, 40 s):

1. 40 tabs opened, one module after another: none refused, 20 awake (the default), the 20
   shown last. The first tab shown again between each of ten others it wakes: awake
   throughout, 20 awake at each step, every tab asleep shown less lately than every one
   awake. The strip wider than three times its box; the last and the first tab on show
   scrolled into it, the wheel scrolling it, a 41st tab in view. A reload: 41 tabs back, the
   one on show awake and in view.
2. 25 saved GC projects put in the store; an XRPD tab refining (its workers' answers held),
   then 20 tabs more. The XRPD tab, shown least lately, stays awake and the next two sleep.
   Settings › 5: at once, the busy tab and the 4 shown last. Settings › 1: the busy tab and
   the one on show, over the cap. The run's end: the busy tab asleep. Projects' Open
   selected on the 25: all opened, asleep, the list still on show; one shown, woken.

New, `tests/b2fixed.test.mjs` (2 tests, 5 s):

1. In Node: `park` and `decode` give a fixed array back as it is and copy one not fixed;
   `encode` writes both out alike; fixed is not frozen.
2. The tests' freezing off: a tab of XRPD, DRS, GC and EPR asleep holds its history's arrays
   (6, 4, 3 and 4), none frozen; each woken holds the same ones. `stateKey` takes a fixed
   array by its hash. With the freezing on, a fixed array is frozen.

Changed: `b2xrd` (3: the Settings' number in place of L and the policy, the step by memory
gone; 4: the LRU with 3 awake for L 2), `b2sem` (3, above), `b2cross`, `b2drs`, `b2gcepr`
(`awakeMax: 7`), helpers.mjs (`window.__freezeFixed`), tests/README.md (the rows and the
count, 209). No page error and no CSP violation in the new tests (asserted).

The b2cap test fails on b2v2, as it should: its 21st tab is refused, and the test waits for
it in vain (a timeout in `openModule`).

## Lint

`eslint` with the scratchpad's config, on every changed file: the app's files have exactly
the findings of their b2v2 version (v517's own: `crypto`, `Option`, `screen`, unused names;
sessions.js's import of `runWithModuleState`, which part B no longer uses, taken out), the
tests (`b2kept` too) and the measure scripts (`fixed`, `many`, `kept`, `loader`,
`lim-series`, `lim-fx`) none. The review's: db.js, sem.js, sessions.js, tabs.js and
xrd-rv-model.js exactly part B's findings (compared line for line), `b2sem`, `b2kept`,
`b2cap` and `measure/review3/` none.

## The patch

`b2.patch`, after the final check (§8): one git diff against HEAD (2f49d4a, which committed
the review's; the app's files b93ed5c), 39 files, +4314 −921, sha256 97e036c7…. `git apply
--check` is clean on a fresh git-archive of HEAD, and the tree it gives is identical, file
by file, to the one the tests of §8 ran on. The review's patch (94b5bd99…) is in git at
2f49d4a.

The review's, as it was: one git diff against HEAD (a44b222, which committed part B; the
app's files b93ed5c), 39 files, +4254 −920, sha256 94b5bd99…. The review's own changes are 9
files, +251 −63 (db.js, sem.js, sessions.js, tabs.js, xrd-rv-model.js; `b2sem`, `b2kept`,
`b2cap`, tests/README.md). `git apply --check` is clean on a fresh git-archive of HEAD, and
the tree it gives is identical, file by file, to the one the whole suite ran on. Part B's
patch (d54978fe…) is in git at a44b222.

Part B's, as it was: one git diff against HEAD (49beb52, which committed part A; the app's files
b93ed5c), 39 files, +4047 −901, sha256 d54978fe…. Part B's own changes are 11 files, +602
−169 (`tests/b2kept.test.mjs` 247 lines of them). `git apply --check` is clean on a fresh
git-archive of HEAD, and the tree it gives is identical, file by file, to the one the whole
suite passed on (and to the one the measurements ran on). Part A's patch (+3497 −784,
9f996260…) is in git at 49beb52, b2v2's (db7ae22b…) at 0ddc38e.

## Behaviour changes for the user

- Any number of tabs can be open.
- **20 awake by default**, the one on show among them, where b2v2 kept 7. A return to any of
  the 20 is a show, not a wake (an XRPD tab of 12 patterns: 29–44 ms, against 201–228 ms
  woken), and each holds its memory until its minutes put it to sleep. Per tab, from
  `NOTES-v2.md` and ASSESSMENT.md: a SEM tab of 8 full-size images 78 MB awake and 0.6 MB
  asleep (on disk); an XRPD tab of 12 refined 17 MB and 4 MB.
- The tab asleep first is the one shown least lately, not the one hidden longest: a tab
  whose run ended a moment ago no longer counts as just shown.
- The wheel over the strip of tabs scrolls it.
- Settings › Tabs in the background has two fields: the minutes and the number awake.
- An XRPD tab holds 0.2 MB less; a DRS or EPR tab of 10 spectra 0.16–0.37 MB less.
- Part B: **a tab woken shows what it worked out before, not worked out again**: an XRPD tab
  of 12 refined patterns in 252 ms (438), a DRS tab of 10 spectra in 195 ms (326); an undo
  to a state worked out before, and a redraw at another width, make nothing again. **It
  holds that while asleep**: an XRPD tab of 12 refined 3.4 MB more (4.6 against 1.2), a DRS
  tab 0.7 MB, a SEM tab its thumbnails and cards (3.4 MB a tab of 8 images 2048², which
  b2v2 kept for 9 tabs at most); awake, an XRPD tab 0.8 MB more.
- Part B: **the loader comes up where the page would freeze**: a tab awake shown at another
  width of the window (or with a job's results to draw) shows under the loader, as a wake
  does, its frames before and after costing 60–100 ms (`loader-*.json`, after a change of
  width: XRPD 314 ms against 254, GC 164 against 88, SEM 187 against 88, its redraw long or
  not: which a tab's will be is not known before it runs); one shown as it was left shows
  at once, as before. After a reload, a project tab with unsaved
  changes keeps the loader on till its saved record is read (no 0.4 s freeze after it).
- The review (§7): **a SEM tab whose files cannot be read as it wakes stays asleep**, Home
  on show and a banner saying so, and reads them again when shown (it woke without them, and
  lost them); a project written to a file shows the loader; an undo or redo of a SEM crop
  takes its cards as made; a SEM tab woken holds its history's files once (at most 0.32 MB
  more a file for its card levels of 4 crops, awake or asleep).
- The final check (§8): **Home, Projects or Settings clicked just after a tab stays on show**
  (the tab came back over it); a tab chosen and left again at once, or woken behind one of
  them, shows under the loader at its next show; a SEM file read again keeps its crops' cards.

## Not done, and what is left

- Part B: **kept results are not in the records**: after a reload a tab works them out
  again at its wake (an XRPD tab of 12 refined, some 0.2 s more), under the loader; a
  project opened from Projects the same (its arrays read anew). Why: §4.
- Part B: **a pattern keeps the curves of its last 4 results**, a spectrum the fits of its
  last 8 keys: an undo further back than that works the oldest out again. Bounded so that a
  tab refined many times does not hold every curve of its history.
- Part B: **tasks of 50–100 ms without the loader** remain on a few paths (a switch to an
  awake DRS tab, an undo in XRPD; §5), as in b2v2: under the brief's 100 ms.
- Part B: **what a module draws** is not kept beyond its instance: a woken tab draws its
  plots anew (most of its wake now: 154 ms for XRPD).
- **A close with many tabs** writes every record again (1.27 s at 60 heavy tabs, no long
  task; since the review at the close itself, not after the tab it lands on is shown). Writing only the record whose `active` changed would need the records' `order` to
  survive gaps; not done.
- **A reload of many tabs** reads every tab's state with its bytes, the tabs not on show too
  (0.79 s at 60 XRPD tabs of 12 patterns). Reading those lazily, as SEM's tabs asleep are,
  would make it the tab on show's alone; not asked.
- Nothing is said to the user when a tab sleeps for the cap, as before.
- **An edit on the tab on show** gets no loader (a crop typed: its group's cards made in its
  task; a width typed in XRPD the first time: its processing), as in v517.
- Measured headless on this machine, synthetic and fixture files; not in a real Chrome.

## Method, trees, housekeeping

- Trees in the scratchpad's `b2v3/`:
  - `a`: HEAD and the b2v2 patch committed in a local git, the changes made there, served on
    8990 for the measurements;
  - `v2`: a git-archive of HEAD with b2v2's patch, served on 8991;
  - `fresh`: a git-archive of HEAD with the new patch, where the tests ran;
  - `probe`: the scripts that looked at the state's arrays, the heap, the 60-tab reload's
    CPU profile and the wheel; their numbers are those quoted above.
- Measurements one at a time, the machine otherwise idle (load under 1 at each start).
- The review (§7): in the scratchpad's `b2v3/refix/`: `w` (a git-archive of HEAD a44b222 and
  part B's patch committed in a local git, the fixes made there, served on 8990), `v3b` (the
  same without the fixes, on 8991), `fresh` (a git-archive of HEAD with the new patch: the
  whole suite), `probe` (the reviewers' scripts, run on both; those that give numbers are
  `measure/review3/`).
- `measure/many.mjs` and `measure/fixed.mjs` are new; `results/` gained `many.json`,
  `many-getall.json`, `fixed.json` and `suite-b2v3.log`.
- Part B: in the scratchpad's `b2v3/`: `b` (HEAD 0ddc38e with part A's patch, a local git;
  the changes made there; served on 8990 for every part B measurement), `bv2` (b2v2's patch,
  on 8991), `freshB` (a git-archive of HEAD 49beb52 with the new patch: the whole suite),
  `pk2` (the patch made there), `pb`, `pbt` (the probes: CPU profiles of the wakes and the
  reload, the plots before and after a wake in both versions; their numbers those quoted in
  §4–§5). New `measure/kept.mjs`, `measure/loader.mjs`; `lim-series.mjs`'s `cap` policy;
  `lim-fx.mjs` writes `ten/` (the DRS, GC and EPR files of kept.mjs and loader.mjs); results
  `kept.json`/`.log`, `loader-b2v2.json`/`.log`, `loader-b2v3.json`/`.log`,
  `lim-b2v3-mix-cap.json`/`.log`, `lim-b2v3-sem-cap.json`/`.log`, `suite-b2v3b.log`.
- The final check (§8): in the scratchpad's `b2v3/final/`: `v3c` (a git-archive of HEAD
  2f49d4a with its patch, served on 8991), `w` (the same in a local git, the fixes made there,
  served on 8990; the tests ran there), `pk` (the patch made there), `fresh` (a git-archive of
  HEAD with the new patch: identical to `w`), `scripts/` (`fixed.mjs`, `behind.mjs`).
- My servers on 8990 and 8991 are stopped by their PIDs, found by the port.
- No file of the main tree outside `proto/live-tabs-b2/` was edited, and no git command that
  changes state was run there.
