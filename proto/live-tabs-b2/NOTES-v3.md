# b2v3: no memory budget; any number of tabs, a cap on those awake; arrays fixed, not frozen

Part A of round 3: three of the user's decisions (2, 8, 5a), made in `b2.patch`, which now
holds them (one git diff against HEAD, the app's files those of v517, b93ed5c). Nothing else
changed, but for one thing found on the way and needed by the second: a reload reads the
tabs' records one a task (§2).

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

## Tests

On a fresh git-archive copy of HEAD with the new `b2.patch` (§ The patch), the tests of what
changed, not the whole suite (part B runs it): **126 of 126 pass**, in 7 min 9 s
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
the findings of their b2v2 version (v517's own: `crypto`, `Option`, `screen`, unused names),
the tests and `measure/fixed.mjs` and `many.mjs` none.

## The patch

`b2.patch`: one git diff against HEAD (0ddc38e; the app's files b93ed5c), 38 files, +3497
−784, sha256 9f996260…; b2v3's own changes are 19 files, +375 −198. `git apply --check` is
clean on a fresh git-archive of HEAD, and the tree it gives is identical, file by file, to
the one the tests passed on. b2v2's patch (db7ae22b…) is in git at 0ddc38e.

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

## Not done, and what is left

- **The whole suite was not run**: part B of round 3 runs it.
- **A close with many tabs** writes every record again (1.27 s at 60 heavy tabs, no long
  task). Writing only the record whose `active` changed would need the records' `order` to
  survive gaps; not done.
- **A reload of many tabs** reads every tab's state with its bytes, the tabs not on show too
  (0.79 s at 60 XRPD tabs of 12 patterns). Reading those lazily, as SEM's tabs asleep are,
  would make it the tab on show's alone; not asked.
- Nothing is said to the user when a tab sleeps for the cap, as before.
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
- `measure/many.mjs` and `measure/fixed.mjs` are new; `results/` gained `many.json`,
  `many-getall.json`, `fixed.json` and `suite-b2v3.log`.
- My servers on 8990 and 8991 are stopped by their PIDs, found by the port.
- No file of the main tree outside `proto/live-tabs-b2/` was edited, and no git command that
  changes state was run there.
