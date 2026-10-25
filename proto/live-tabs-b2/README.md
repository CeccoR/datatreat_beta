# b2: every tab truly independent, in one page (backlog 23)

The user's decision after the item 23 assessment, built whole: option b2 with the user's
hybrid and the page's pool of Rietveld workers. **Every module is made per tab**: XRPD, SEM,
DRS, GC and EPR each have one live instance per open tab (its own elements, state, undo
history and view) in one page, and none is left on v517's single instance. It is one patch,
`b2.patch`, kept here and not applied: no app file of v517 (b93ed5c) was changed. The user
decides after seeing it.

**b2v2** (`NOTES-v2.md`), the user's two decisions after the limit's assessment, is in
`b2.patch` now: **no trim** in any module, a hidden tab staying as it was left until it
sleeps; and **a sleeping SEM tab lets go of its files' bytes**, read back from IndexedDB as
it wakes. **b2v3** (`NOTES-v3.md`), five more of the user's decisions, is in it too: **no
memory budget** (the count and the minutes are the only rules); **any number of tabs open,
at most 20 awake** (Settings), the one shown least lately put to sleep beyond them; **arrays
fixed, not frozen**, shared by a tab's states, its parked state and its history without a
copy; **what is worked out is kept, not worked out again** (a tab woken, an undo, a redraw
take it as made); and **the loader over every step that may take a while**, before the work
and off after; then the fixes of its review (`NOTES-v3.md` §7) and of its final check
(§8). **b2v4** (`NOTES-v3.md` §10), the user's three decisions before b2 is applied: **the
origin's storage asked to be kept**; **every tab shows, woken or reloaded, what it showed**
(DRS's sample, every plot's zoom, the instructions shown, the lists scrolled, XRPD's peaks
picked and crystallites turned, SEM's editor zoomed), no step of the history and no "*" for
it; and **a close writes only the records that changed** (a move, a reload alike). Where this
page gives measurements of the first version, it says so.

## What b2 does

- **A switch only shows and hides.** The tab's instance is put into the page and the one
  shown before is taken out, in the same task; nothing is restored. Between two loaded tabs
  of one module it takes 45–116 ms where v517 takes 110–460 ms (below).
- **A job in a tab left goes on.** A Rietveld refinement (on the pool) or a SEM reading runs
  on in its own instance while another tab is shown, writes its results into its own
  history as one step and its own record, and marks its own tab unsaved ("*"). Leaving such
  a tab asks nothing; closing it asks first ("… is running in “T”: closing this tab stops
  it").
- **Hidden, a tab stays as it was left** until it sleeps (b2v2: the first version's 60 s
  trim is gone from every module). Only SEM lets go of the editor's full-size image at
  once, remade in some 27 ms as it is shown.
- **Sleep and wake, the user's hybrid.** A tab not shown for X minutes (10 by default,
  Settings) sleeps: its instance is destroyed, its state and its whole undo history are
  parked as tabs.js parks a tab in v517, and it stays in the bar. Shown again it wakes: a
  new instance, the parked state restored, the history put back, every step of it undoable.
- **What was worked out is kept** (b2v3): a module's results made from data that never
  change (XRPD's processing and Rietveld curves, DRS's fits, GC's tables, EPR's smoothing)
  are kept by the data, so a tab asleep keeps them, a wake, a redraw and an undo to a state
  worked out before take them as made, byte for byte, and only a changed input makes them
  again (utils.js `keeper`, API.md §10). An XRPD tab of 12 refined patterns wakes in 0.25 s
  (b2v2 0.44 s), its longest task 154 ms (345), and holds 3.4 MB more asleep; a DRS tab of
  10 spectra in 0.19 s (0.33). Not in the records: a reload works them out again.
- **The loader before any step that may take a while** (b2v3): a wake, a new tab, a project
  opened, a reload, and now a tab awake shown at another width of the window (or with a
  job's results to draw) and a reload with a project changed: the loader on, a frame drawn,
  the work, the loader off. A tab awake shown as it was left shows at once. Every long task
  over 100 ms on these paths is under it (`measure/loader.mjs`).
- **A sleeping SEM tab holds no file's bytes** (b2v2): once its record is written, its
  state and history hold its files by their SHA-256, the bytes being in the store; shown
  again it reads them back, the loader on meanwhile (0.30–0.56 s for 8 images of
  2048 × 2176, 71 MB; `NOTES-v2.md`). Its thumbnails and cards stay while it sleeps (b2v3:
  to b2v3 32 MB of them for all the tabs asleep, some 9 such tabs' worth).
- **A busy tab never sleeps.** Its time hidden counts from its job's end.
- **Any number of tabs, a cap on those awake** (b2v3). Opening a tab is never refused (v517
  and b2v2 refused a 21st). At most N tabs are awake, the one on show among them (20 by
  default, Settings); beyond, the one shown least lately sleeps, whenever it was opened (a
  tab opened first but shown often stays awake). A busy tab never sleeps: the count may go
  over N until its job ends, the excess then asleep. Every way a tab is opened or woken
  keeps the cap; one opened from Projects comes asleep. The strip of tabs scrolls, the tab
  on show scrolled into it, and the wheel scrolls it sideways (b2v3: a mouse had no way
  along it). (To b2v2: L tabs awake not on show, 6, or a memory budget; both gone.)
- **One pool of Rietveld workers for the whole browser,** capped at cores − 1 (Web Locks),
  as `proto/workers/pool.patch`: Refine all and the runs of hidden tabs go on it, and the
  workers and their engine's caches belong to the pool, kept 60 s idle.
- **A reload** wakes only the tab on show; the others wake as they are shown. Histories do
  not survive a reload, as in v517.
- **What a tab shows comes back with it** (b2v4): woken or reloaded, a tab shows what it
  showed beside its state (the sample or image on show, each plot's zoom, the instructions
  shown, its lists scrolled, the peaks picked, SEM's editor zoomed), kept as it sleeps and
  in its record, never in its history nor in a saved project: no step, no "*" (utils.js
  `shownOf`, the instances' `shows`; API.md §1).
- **A record is written when what it holds changed, and only then** (b2v4): each record's
  `order` is a number of its own, so a close, a move or a reload no longer write every tab's
  record (at 63–65 XRPD tabs a hidden tab closed: 62–64 records and 1.42–1.59 s of writes →
  none, 16–19 ms); and the origin's storage is asked to be kept (`navigator.storage.persist`).
- **The ids belong to the instance on show.** Its section and its layer (windows, menus) are
  in the page with v517's ids, so index.html, the CSS, the delegated handlers and the 183
  tests of v517 find them as before. A hidden instance is out of the page and finds its own
  elements within its section (every lookup root-scoped), so a hidden refinement or reading
  updates its own DOM. Why taking out rather than swapping ids, measured: `API.md` §3.

## Settings

**Settings › Tabs in the background** (index.html; saved with the other settings; a change
applies at once):

| field | default | range | what |
|---|---|---|---|
| Sleep after (minutes not on show) | 10 | 0.1–1440 | X: a tab hidden this long sleeps; a busy one counts from its job's end |
| Tabs awake at most, the one on show among them | 20 | 1–1000 | N (b2v3, `settings.awakeMax`): beyond it the one shown least lately sleeps, a busy one never |

Constants not in Settings:

- the pool: cores − 1 workers, kept 60 s idle (xrd-rv-pool.js; localStorage knobs
  `datatreat-rv-workers`, `-lanes`, `-shared`, `-idle`, for tests and measurements);
- SEM: the reading worker ends 20 s after its last answer; decoded copies of 8-bit images
  are kept up to 32 MB (`DEC_BUDGET`); the editor's pixels are let go 2 s after their last
  use; what was made of a file (header, reduced copy, card) is kept while a tab awake or
  asleep holds it (b2v3; to b2v3 32 MB of it for the files let go, `ORPHAN_BYTES`), so that a
  sleeping tab wakes without making it again;
- what is worked out (utils.js `keeper`): the results of a module's last 4 or 8 keys an
  array of data (API.md §10).

## Applying

```sh
git apply --check proto/live-tabs-b2/b2.patch && git apply proto/live-tabs-b2/b2.patch
npm test                       # 221 tests, about 13 min
```

`b2.patch` is a git diff against HEAD (app files b93ed5c): 41 files, +5087 −937 (sha256
da153713…), b2v2's, b2v3's and b2v4's changes included (`NOTES-v2.md`, `NOTES-v3.md`, b2v4's
in its §10). `git apply --check` is clean on a fresh git-archive of the main tree's HEAD
(ee7bc51), and the copy it gives is identical, file by file, to the tree the last tests ran
on. b2v3's last (+4327 −922, sha256 94eb334d…) is in git at ee7bc51; the final check's
(+4314 −921, 97e036c7…) at bda296f; the review's (+4254 −920, 94b5bd99…; the whole suite
ran on it) at 2f49d4a, b2v3 part B's (+4047 −901, d54978fe…) at a44b222, part A's (+3497
−784, 9f996260…) at 49beb52, b2v2's (+3292 −756, db7ae22b…) at 0ddc38e, the first version's
(+2908 −731, 45006d96…) at fabb05b. `git apply -R` takes it out.

On release the app's own rules still apply: `sw.js` says "Bump CACHE when any precached
asset changes" (`datatreat-v517` → the new version), and the footer's version, README.md and
BACKLOG.md go with it. The patch leaves them to the release.

## What is here

| file | what |
|---|---|
| `b2.patch` | **The whole of b2**, to apply: the five stage patches below, the integration (below: the cross-module test, two rows of tests/README.md and its test count), b2v2's changes (`NOTES-v2.md`: no trim, a sleeping SEM tab without its bytes) and b2v3's (`NOTES-v3.md`: no memory budget; any number of tabs, at most N awake; arrays fixed, not frozen; what is worked out kept; the loader over every step that may take a while; the review's fixes) |
| `core.patch`, `xrd.patch`, `sem.patch`, `drs.patch`, `gc-epr.patch` | **The first version** by stage, for reading: the core against HEAD, each module against HEAD + core. Applied in that order they give the first b2.patch less the integration; `b2.patch` has the later changes (the integration, b2v2) |
| `API.md` | How a module is made per tab, with XRPD as the worked example |
| `NOTES-core.md`, `NOTES-sem.md`, `NOTES-drs.md`, `NOTES-gc-epr.md` | Each stage's notes: what changed, each memory cut with its numbers, its tests (the first version: its trim included) |
| `NOTES-v2.md` | **b2v2**: the trim taken out; a sleeping SEM tab's bytes let go and read back as it wakes; what held ~42 MB a SEM tab in the browser process; tests and numbers |
| `NOTES-v3.md` | **b2v3**: part A, the memory budget taken out; any number of tabs open, a cap on those awake, the strip and the restore at 60 tabs; arrays fixed, not frozen, and the bytes it saves. Part B, what is worked out kept (what, by what key, what it costs, the wakes against b2v2); the loader over every long task of the paths between tabs; the limit under the cap (45 tabs of the mix, 32 of SEM); the whole suite. The review's findings (§7), each fixed and tested; the final check's three (§8); the hash's echo (§9); b2v4 (§10): the storage kept, every tab's view kept through a sleep and a reload, a close writing only what changed, measured |
| `measure/` | One script per measurement or check, `lib.mjs` shared; `session.mjs`, `upgrade.mjs` and `trim-nodes.mjs` are the integration's; `lim-*.mjs` the assessment's; `idb-mem.mjs` and `wake-sem.mjs` b2v2's; `fixed.mjs` and `many.mjs` b2v3's, `kept.mjs`, `loader.mjs` and lim-series's `cap` policy its part B's (`lim-fx.mjs` writes their `ten/` files), `review3/` its review's; `persist.mjs` b2v4's, and `many.mjs` counts the records a close writes (`OUT` names its file). The earlier scripts read the settings and `bytes()` of the versions they measured (`liveMax`, `livePolicy`), which b2v3 has not |
| `results/` | Each measurement's JSON and the suite's logs |

## What changed

| file | lines | what |
|---|---|---|
| utils.js | +375 −75 | every registry by the instance's key (history, redraw, busy, CSV, has-data, the section on show); a module's name stands for its instance on show; `registerModule` (its `asleep`), `makeInstance` (shown only in the page), `attachInstance`, `detachInstance`, `dropKey`, `withState`, `onAnyChange`, `busyChanged`, `dropsBytes`, `asleep`, `vacate`; the undo keys act on the tab on show; the drop zone and file list take elements; the Settings' values (`sleepMin`, `awakeMax`); `stateKey` takes an array fixed by its hash, `fixed` given to the modules; what is worked out kept, `keeper`, `kept`, `objId`, `exactKey`; what an instance shows beside its state (b2v4): `shownOf`, `showAgain`, `zoomAgain`, `shownAgain` (its plots' zooms, instructions shown, lists' scroll) |
| tabs.js | +553 −85 | live instances per tab: show, hide, sleep, wake; the busy exemption; no limit on the tabs open, at most `awakeMax` awake, the one shown least lately asleep beyond (`seenAt`); the wheel along the strip; Settings › Tabs in the background; `sleepTick` and `tabsNow` for the tests; a sleeping SEM tab's bytes let go and read back (`lighten`, `wakeLater`), its records read without them after a reload; a tab awake to draw again shown under the loader (`redrawn`, `showLater`); a load waits for its saved key (`loaded`); its module told which tabs sleep holding what (`held`); a wake whose read fails given up, the tab asleep as it was; the records whose `active` changed written at the switch; a step that is no tab's under the loader (`underLoader`); a tab's width taken only as it is left from show (`view`), a show or wake deferred giving way to Home, Projects or Settings chosen meanwhile; b2v4: each record's `order` its own number, only the records that changed written (`persistMoved`, `rec`), what a tab shows kept asleep, in its record and through a reload (`showsOf`, `shows`, sessionStorage) |
| sessions.js | +137 −100 | autosave, the unsaved mark and Save per tab, shown or not; a hidden tab closed with Save saved as it is; Projects' CSVs through a throwaway instance; Save, exports and Delete wait for a wake reading its bytes; a reloaded project's saved key from a throwaway instance, its load waiting for it; a project written to a file under the loader |
| db.js | +146 −25 | the origin's storage asked to be kept (`keepStorage`, b2v4); arrays fixed (`fixed`, `isFixed`: a WeakSet), which `park` and `decode` share instead of copying them; `unload`, `load`, `unread`; `putRec`'s `also` (a history's files held with a record); the records read without their bytes (`allTabStates(lazy)`), and by a cursor, one a task; `fill` one result for one object met |
| cards.js, modkit.js | +18 −9, +19 −10 | the deck's menu in the instance's layer, `deck.destroy()`; `moduleKit(mod, { root, key, layer })`, `kit.destroy()` |
| plot.js, figure.js | +17 −5, +3 −2 | downloads find their svg from the button; the composer's memory keyed by the tab that owns the plot; a zoom put back as its plot is drawn on the same range (b2v4) |
| index.html, style.css, sw.js | +6, +3, +1 | the Settings rows; `.inst-layer`; xrd-rv-pool.js precached |
| xrd-rv-pool.js | +183 (new) | the pool (proto/workers) |
| xrd.js, xrd-peaks.js, xrd-rv.js, xrd-rv-model.js | +96 −34, +37 −26, +126 −88, +10 −13 | XRPD a factory; Refine all on the pool; its patterns' arrays and its results' lists fixed, not frozen; its processing, instrumental model, Rietveld curves, differences, nets and ticks kept by the pattern (`curveInputs`, `sameInputs` gone with it); its pattern on show, its cards' peaks picked and crystallites' turns given back as a tab wakes or reloads (`shows`, `showNext`, b2v4) |
| sem.js, sem-read.js, sem-read.worker.js, sem-figure.js | +488 −249, +59 −40, +11 −6, +8 −4 | SEM a factory; its files' bytes kept as bytes (not base64), a 16-bit image a view of them; what is made of a file shared by all tabs, and kept while a tab awake or asleep holds it; one reading worker; its tabs asleep without their bytes (`dropBytes`), a history woken holding the files' own RawRefs (`adopt`); a file's card levels for its last 4 crops, kept when the file is read again; its image on show and the editor's zoom kept at a sleep and a reload, the zoom at a show and a resize too (`ed`, b2v4) |
| tauc.js, gc.js, epr.js | +169 −57, +113 −49, +84 −18 | DRS, GC and EPR factories through the kit; DRS's energies and EPR's spectra shared by file; their spectra and GC's gases fixed; DRS's curves and fits, GC's tables and EPR's smoothing kept by the data; DRS's sample on show given back as a tab wakes or reloads (b2v4) |
| tests/ | 10 new files, 7 changed | `b2view` (b2v4: every module's view through a sleep and a reload), `b2store` (b2v4: the storage kept, the records written), `b2xrd`, `b2sem`, `b2drs`, `b2gcepr`, `b2cross` (two tabs of a module, and every module together), `rvpool`, `b2cap` (the cap on the tabs awake, 40 tabs), `b2fixed` (arrays fixed), `b2kept` (what is worked out kept, counted across wakes, its plots golden and its CSVs byte for byte); the steps of `rvui` C and `tabs` that checked v517's question on leaving a busy tab; SEM's stored form in `bytestore`; helpers.mjs freezing every array fixed; the table in tests/README.md |

## Tests and checks

**b2v4** (`NOTES-v3.md` §10): **the whole suite, `DT_ROOT=<tree> npm test`: 221 of 221 pass**
in 14 min 24 s (`results/suite-b2v4.log`), on a fresh git-archive copy of HEAD (ee7bc51) with
the new b2.patch. New: `b2view` (4 tests: every module's view, its project saved, through a
sleep and a wake and two reloads, no step of the history and no "*") and `b2store` (3: the
storage asked to be kept; only the records that changed written, the order and the tab on
show kept; records of v517 and of two windows); all 7 fail on the patch before
(`results/tests-b2v4-old.log`). Before it, the tests of what changed and every b2 test: 63 of
64 (`results/tests-b2v4.log`; `b2sem` 5 looked for the first tab's record by `order` 0, now
by its id), then those touching XRPD's pattern and SEM's image on show, put in the view
last: 41 of 41. Lint: the changed app files exactly their findings before; the new tests and
measure scripts none.

**b2v3's final check** (`NOTES-v3.md` §8): three issues, each reproduced on the review's
tree by the check's script, fixed and given a check that fails there: `b2cap` 3 (a tab chosen
and left within a switch's frames, shown after under the loader), `b2kept` 2 (Settings
clicked within a switch's frames stays on show, the tab awake or asleep), `b2kept` 3 (a SEM
file read again in another tab, its crop's cards kept). The b2 tests named by the check and
those of what changed (`b2cap`, `b2kept`, `b2sem`, `b2xrd`, `b2cross`, `tabs`, `sem`): 27
of 27 (`results/tests-b2v3d.log`); only tabs.js and sem.js changed, the whole suite not run
again. Lint: those two files only their findings before.

**b2v3's review** (`NOTES-v3.md` §7): eight findings, each reproduced on part B's tree, fixed
and tested (each new check fails there). **The whole suite, `DT_ROOT=<tree> npm test`: 213 of
214 pass** in 13 min 3 s (`results/suite-b2v3c.log`), on a fresh git-archive copy of HEAD
with the new b2.patch; the one failure (`bytestore`, a rename in Projects waited 30 s for)
passed 3 times of 3 run again alone on the same tree, its path none the fixes touch. Before
it, every b2 test and those of what changed: 69 of 69 (`results/tests-b2v3c.log`). New:
`b2cap` 3 (one record on show after two quick switches), `b2kept` 4 (a project written to a
file under the loader); more steps in `b2sem` 4–5 and `b2kept` 2–3. Lint: the changed app
files only their part B findings; the tests and `measure/review3/` none.

**b2v3 part B** (`NOTES-v3.md`): **the whole suite, `DT_ROOT=<tree> npm test`: 212 of 212
pass** in 12 min 28 s (`results/suite-b2v3b.log`), on a fresh git-archive copy of HEAD with
the new b2.patch, every array fixed and every result kept frozen by the tests (a write into
one fails them), no page error and no CSP violation where asserted. New: `b2kept` (3 tests:
XRPD, DRS, GC/EPR/SEM woken, nothing made again, counted; their plots the golden hashes of a
first drawing and as before they slept, their CSVs byte for byte; a parameter changed made
again, undo and redo taking what was kept; the loader on a wake and on a tab awake shown at
another width). Lint: every changed file only its b2v2 findings.

**b2v3 part A** (`NOTES-v3.md`): the tests of what changed, not the whole suite: `tabs`,
every b2 test (`b2xrd`, `b2sem`, `b2drs`, `b2gcepr`, `b2cross`), the new `b2cap` (the cap,
40 tabs) and `b2fixed` (arrays fixed), the stores' (`db`, `bytestore`, `roundtrip`), XRPD's
(`xrdcards`, `rvmodel`, `rietveld`, `rvui`, `undorun`), DRS's (`drsread`, `widths-drs`),
GC's (`gcdate`, `gcp`, `gcrep`), DRS/GC/EPR's `modules` and the strip's `narrow`: **126 of
126 pass** on a fresh git-archive copy of HEAD with the new b2.patch, in 7 min 9 s
(`results/suite-b2v3.log`), every array fixed frozen by the tests (helpers.mjs), so that a
write into one would have failed them. Lint as below.

**b2v2** (`NOTES-v2.md`): the user asked for the SEM tests only. `sem`, `b2sem` (6 tests, 3
of them new), `bytestore`, `roundtrip`, `b2xrd` and `b2cross`: **37 of 37 pass** on a fresh
git-archive copy of HEAD with the new b2.patch (`results/suite-b2v2.log`); lint and CSP as
below. The rest of this section is **the first version**, as it was checked:

All on HEAD + b2.patch, headless Chromium (Playwright 1.56), 4 vCPUs:

- **The whole suite, `DT_ROOT=<tree> npm test`: 202 of 202 pass** (v517's 183, the pool's 4,
  the modules' 12, the cross-module 3), in 11 min 4 s, on a fresh git-archive copy of HEAD
  with b2.patch applied (`results/suite-b2.log`). The five stage patches applied as
  delivered passed 199 of 199 here too (10 min 40 s), as the GC/EPR stage had found
  (`results/suite-all-patches.log`).
- **`tests/b2cross.test.mjs`, every module together** (3 tests, about 40 s):
  1. Ten tabs, two of each module, each with its own files and a label of its own: at the
     default limit the three opened first asleep; each shown in turn with its own files and
     whole history, each wake putting the tab not shown for longest to sleep (the LRU); an
     undo in each undoing its own step only, a redo in each; all hidden 11 minutes asleep
     (`sleepTick`), their sections collected (WeakRefs emptied after a forced GC), each
     woken as it was.
  2. A Refine all on the pool in an XRPD tab left at once for SEM, its results held: SEM's
     files read, labels changed, undone and redone, a DRS tab worked in; the XRPD tab awake
     11 minutes on while busy, the DRS tab asleep; at the run's end its step in its own
     history, its record and its "*", SEM's history untouched; the run's step undone in its
     tab; the DRS tab woken as it was.
  3. A saved project of each module edited: a hidden tab closed with Save saved as it is,
     not shown; a reload, the tab on show awake and the others asleep, each with its edit;
     a project reopened from Projects; **Projects' CSVs of each module**, made by a
     throwaway instance, byte for byte its project bar's. No page error and no CSP violation
     in any.
- **From v517 to b2 in one browser** (`measure/upgrade.mjs` → `results/upgrade.json`): one
  tab of each module made, refined and saved in v517, a label left unsaved; the same origin
  then served by b2 and reloaded. 23 of 23 checks pass: the same tabs, the one on show awake
  and the others asleep, each with its edit (SEM's v517 base64 read, its thumbnails drawn;
  XRPD's v517 results there), a step and its undo in each, and Projects' CSVs of each made
  by b2 from v517's records byte for byte those v517's project bar gave.
- **The heavy modules together** (`measure/session.mjs`, below): a refinement of 12
  patterns run hidden on the pool while SEM tabs of 8 full-size images are worked in gives
  results identical to the same refined on show.
- **Lint** (`eslint` with the scratchpad's config) on every changed .js file: no finding
  that v517's same file has not. What is left is v517's own (`crypto`, `Option`, `screen`
  missing from the config's globals; six unused names); sessions.js has five warnings
  fewer. The new and changed tests lint clean with Node's globals added.
- **CSP** (`script-src 'self'; object-src 'none'; base-uri 'self'`): no violation in any of
  the 202 tests (helpers.mjs records them in every page; the b2 tests assert none), nor in
  the scratchpad's `e2e/csp.mjs` (the Rietveld worker, the composer, an alert).
- **The payload fuzz** (the scratchpad's `e2e/fuzz.mjs`, run on a copy that writes into its
  own folder and also counts what was drawn): a markup payload in every string (A), every
  number too (B) and the files' names (F), for every module: **0 elements injected** in the
  Projects list and in the module, with the files listed and plotted (DRS 2 rows and 37
  paths, XRPD 2 and 18, GC 2 and 18, EPR 1 and 4, SEM 3 and 8), no page error.

## The heavy modules together, measured

**The first version** (its 60 s trim, a sleeping SEM tab holding its bytes), off the record
as every measurement then; b2v2's SEM numbers, on disk too, are in `NOTES-v2.md` (26 SEM
tabs of 8 images, all but one asleep, 282 MB in all against 1976).

`measure/session.mjs` → `results/session.json`. One session of ten tabs, two of each
module: DRS, GC and EPR with the fixtures of `proto/live-tabs/fixtures`; XRPD X1 and X2 with
the 12 patterns and the SrTiO3 CIF, refined; SEM A and B with 8 images each of 2048 × 2176
at 16 bits (8.5 MB a file, 16 different files; MB are 2^20 bytes in all these numbers).
Headless Chromium, 4 vCPUs, one tree at a time, nothing else running. Memory after forced
GCs (CDP), SEM A on show; times in the page from the click to two frames after the loader
is gone (lib.mjs `timedShow`).

| | v517 | b2 |
|---|---|---|
| Refine all, 12 patterns | X1 9.8 s, X2 8.7 s, on show (its card's one worker) | X1 5.2 s on show; X2 5.7 s hidden while SEM is worked in (the pool, 3 workers) |
| X2's results | — | identical to X1's (refined on show), times left out |
| SEM B then A shown (8 images each) | 304 ms (max 378) | 70 ms (max 88) idle; 90 ms (max 139) during X2's hidden run |
| SEM A's next image | 31.2 ms | 31.4 ms idle; 42.6 ms (max 60) during the run |
| X1, SEM B, DRS 1 shown from SEM A | 281, 307, 146 ms | each woken from sleep: 535, 180, 144 ms |
| memory: JS heap + ArrayBuffers | 198.5 + 145.0 = **343.5 MB**, every other tab parked | every tab awake 18.5 + 163.0 = **181.5 MB**; at the default limit 181.3; trimmed 173.3; asleep 9.3 + 162.9 = **172.2 MB** |
| DOM nodes | 8018 | 14508 awake, 12140 at the limit, 11015 trimmed, 2870 asleep |
| renderer RSS | 683 MB (589 in an earlier run) | awake 453, trimmed 418, asleep 408 MB |

Medians: 10–12 shows and 5 presses each way (`switchAB`, `next`), 3 wakes. RSS drifts by tens
of MB between runs (memory freed is not all handed back to the system: the earlier run, its
pool workers by mistake kept alive, gave b2 487, 461 and 443 MB); the heap and the
ArrayBuffers are exact, and were the same in both runs.

- **Half v517's memory, before any sleep.** v517 keeps each SEM file as base64 in the heap
  (91 MB a tab of 8) beside its decoded copies; b2 keeps its bytes once, a 16-bit image a
  view of them.
- **What a session asleep holds is SEM's files.** Of the 172 MB, the 16 files' bytes are
  136 MB; the rest is the page itself (a blank page is 2.9 MB of heap and 3.3 MB of
  ArrayBuffers) and the ten tabs' parked states and histories.
- **A hidden refinement costs the tab on show little.** The 4 vCPUs are shared by the 3
  workers and the page: SEM's switch takes 20 ms more while the run goes on, and the run
  takes up to 0.5 s longer than X1's on show with nothing else to do (two runs).
- **XRPD's wake is the slow one** (0.5 s, against v517's 0.3 s switch): profiled, its
  Rietveld curves (131 ms) and its patterns' processing (67 ms) are made again, which sleep
  let go. SEM, DRS, GC and EPR wake in about v517's switch or less.

## The modules, one by one

Times are medians from each stage's notes, in the same way; memory after forced GCs. The
trim column is the first version's: b2v2 has none.

| module | per tab | trim (first version) | job in the background | memory, beyond the conversion | switch, b2 / v517 | woken |
|---|---|---|---|---|---|---|
| XRPD | xrd.js, xrd-peaks.js, xrd-rv.js | plots, processing, curves (−4.7 MB heap a tab of 12 refined) | Refine all, on the pool | parked states share the patterns' arrays (1.5 MB a tab of 12); a fourth array a pattern nothing read, gone (0.5 MB a Scherrer card of 12); the files read cached by their bytes | 93–116 / 312 ms | 485 ms (NOTES-core) |
| SEM | sem.js, sem-read.js, its worker, sem-figure.js | thumbnails, cards, panes; the editor's image at once | the reading | bytes, not base64, a 16-bit image a view of them: a tab of 8 images 72.5 MB above a blank page against 179; one array a file across tabs; the figure's PNGs not kept (−58 MB after an export); one worker, ended 20 s idle | 82 / 112 ms | 226 ms (NOTES-sem) |
| DRS | tauc.js | none (0.6 MB, 0.25 s to redraw) | none | energies made once per wavelength array, not kept in states (a state's JSON −41%); a woken tab takes its history's arrays | 45 / 462 ms | 327 ms (NOTES-drs) |
| GC | gc.js | none (0.2 MB) | none | a hidden tab draws nothing, a saved project's CSVs in 8 ms against 83 | 46 / 161 ms | 145 ms (NOTES-gc-epr) |
| EPR | epr.js | none (0.4 MB) | none | a woken tab takes its history's spectra | 46 / 129 ms | 123 ms (NOTES-gc-epr) |

What a hidden awake tab holds beyond its sleeping form (to b2v2 each module's `bytes()` was
fitted to it): an XRPD tab of 12 refined 5.2 MB of heap and 3345 DOM nodes; a SEM tab of 8
images 3.5 MB once hidden; DRS, GC and EPR tabs of 10 files 0.2–0.8 MB and 600–2800 nodes.
In b2v3 an XRPD tab of 12 patterns holds 0.2 MB less awake and asleep, a DRS or EPR tab of
10 spectra 0.16–0.37 MB less (`NOTES-v3.md`).

## Fixed in the integration

(The first version. b2v2 took out the trim and `releasePlot` with it: the fix below went with
them.)

The five stage patches applied in order without a conflict (the files they share, xrd-rv.js
and tests/README.md, in different places; index.html and style.css only in the core), and
every check above passed on them as they were. One defect the GC/EPR and DRS stages had
found in the core, and measured, was fixed:

- **`releasePlot` let no element go.** A plot's tool buttons keep its Plot until the plot is
  drawn anew, and the Plot kept the groups taken out of the svg, with every element drawn in
  them. It now drops them too (plot.js, 3 lines). XRPD's trim, the only caller, gives back
  626 DOM nodes more of an XRPD tab of 12 refined (7231 → 6605) and 5.7 MB more of RSS (its
  trim 7.2 → 12.9 MB; 3 runs each, `measure/trim-nodes.mjs` → `results/trim-nodes.json`).
  In the session above, trimmed: 11015 nodes against 11999 before the fix.

And the tests: `tests/b2cross.test.mjs` (above), and the rows of `b2drs` and `b2cross` in
tests/README.md, whose count of tests was then 202 (the DRS stage had left its row out, so that
the stage patches would apply one after another); 205 with b2v2's three in `b2sem`.

## Behaviour changes for the user

- Leaving a tab whose job runs asks nothing; the job goes on. Closing it asks.
- A tab shown after sleeping takes 0.12–0.56 s: XRPD's (0.49–0.54 s) is slower than v517's
  switch (0.31 s), since its Rietveld curves (131 ms of it, profiled) and its patterns'
  processing (67 ms) are made again; SEM's (0.30–0.56 s, b2v2) reads its files back from
  the browser's storage, with its loader; DRS's, GC's and EPR's are faster than v517's
  switch.
- A tab hidden is never trimmed (b2v2): one shown again while awake shows at once (an XRPD
  tab left a while 0.11 s, not the first version's 0.41 s), at 8.5 MB more an XRPD tab of
  12 refined, 6 MB more a SEM tab of 8 images, until it sleeps.
- A SEM tab asleep holds its files in the browser's storage only: should the browser clear
  or evict the site's data meanwhile, they come back without their bytes, said so
  (`NOTES-v2.md`).
- **A SEM project file written by b2 cannot be opened by v517**: its files are kept as bytes,
  not base64. v517's records and project files open in b2 (checked above). DRS's projects
  no longer hold the energies; v517 makes them again from the wavelengths (checked by the
  DRS stage: the same E_g and E_U).
- The figure composer opens over the tab on show only, as in v517.
- **Any number of tabs can be open** (b2v3): a 21st is no longer refused. **20 stay awake by
  default**, the one on show among them, where b2v2 kept 7 (6 hidden and the one on show):
  a return to any of the 20 shows at once, and each holds its memory until its minutes put
  it to sleep. Measured per tab (`NOTES-v2.md`, ASSESSMENT.md): a SEM tab of 8 full-size
  images 78 MB awake, 0.6 MB asleep (on disk); an XRPD tab of 12 refined 17 MB awake, 4 MB
  asleep. Twenty SEM tabs of such images awake hold some 1.6 GB, till they sleep; Settings'
  number brings that down. Measured under the cap (`NOTES-v3.md` §6, on disk): 32 SEM tabs
  open, 20 of them awake, 1.72 GB (peak 1.96); 45 tabs of the mix 1.16 GB (1.59).
- The strip of tabs scrolls under the mouse wheel (b2v3); Settings › Tabs in the background
  has the minutes and the number awake only (the policy and the MB are gone).
- **A tab woken shows what it worked out before** (b2v3): XRPD 0.25 s (b2v2 0.44), DRS
  0.19 s (0.33); an undo or a redraw makes nothing again. It holds it asleep: an XRPD tab
  of 12 refined 3.4 MB more, a DRS tab 0.7 MB, a SEM tab its thumbnails and cards (3.4 MB
  for 8 images 2048²). Not across a reload.
- **The loader is up wherever the page would freeze** (b2v3): also over a tab awake shown at
  another width of the window (left for another tab or for Home, Projects or Settings),
  after a reload till a changed project's saved key is taken, and over a project written to
  a file; a tab awake shown as it was left still shows at once.
- Home, Projects or Settings clicked just after a tab stays on show (b2v3's final check: the
  tab came back over it two frames on).
- **A tab woken or reloaded shows what it showed** (b2v4): DRS's sample (to b2v4 the first),
  XRPD's pattern and SEM's image (to b2v4 a reload showed the one before a step), every
  plot's zoom, the instructions shown, its lists scrolled, XRPD's peaks picked and
  crystallites turned, SEM's editor zoomed (to b2v4 fitted again at every show and resize,
  awake too); changing them is no step of the history and no "*". A view changed is written
  with the tab's record 5 s after, or at once as the page goes (sessionStorage); a saved
  project and its file hold none.
- **Closing a tab writes no other tab's record** (b2v4; a move, a reload the same): at 63–65
  XRPD tabs of 12 patterns, 1.42–1.59 s of writes of 62–64 records → none (16–19 ms). The
  storage is asked to be kept (`navigator.storage.persist()`), silently: Chrome and Edge
  decide.
- A SEM tab whose files cannot be read from the browser's storage as it wakes stays asleep,
  Home on show and a banner saying so; shown again it reads them again (b2v3's review: to it
  the tab woke without them and lost them).

## What is left, and the effort to production

**To release b2 as it is: about 2 days.**

1. A review of the patch by the maintainer, and the release's chores (the version, sw.js's
   CACHE, README.md, BACKLOG.md): 1 day.
2. A check in a real Chrome or Edge on the user's machine, with his files: a window left in
   the background (timers held back: sleep comes late, never early; Memory Saver
   discards the whole page, as in v517), real Tescan TIFFs (the zero-copy view needs the
   image's strips in one run at an even offset, as Tescan writes them; synthetic files
   only were measured), his own refinements: 0.5–1 day.

**Memory still to be had, by what it gives** (each measured where said):

1. **Done in b2v2: the bytes of a sleeping SEM tab** are let go (`NOTES-v2.md`): on a profile
   on disk a SEM tab asleep holds 0.6 MB, against 71.1. (The budget by memory that could
   have counted them went in b2v3, as the user decided.)
2. **Done in b2v3: arrays fixed, not frozen** (`NOTES-v3.md`, `results/fixed.json`, JS heap
   on a profile on disk): an XRPD tab of 12 patterns 4.57 → 4.37 MB awake, 1.41 → 1.22 MB
   asleep (0.2 MB, not the 1.5 MB estimated before from random doubles: half its numbers, the
   intensities, are whole numbers here); a DRS tab of 10 spectra 1.06 → 0.77 MB awake
   and 0.46 → 0.28 asleep, an EPR tab of 10 0.72 → 0.35 and 0.33 → 0.18: the copies in their
   parked states gone (asleep), and their history's key no longer writing out every number
   (awake: 317 KB of text for 10 DRS spectra, now 2 KB).
3. (The first version's third item, the trim's, went with the trim.) The Settings' minutes
   and number of tabs awake choose what the hidden tabs hold: a shorter sleep, or fewer
   awake, gives their memory back sooner.

**Time still to be had:** done in b2v3: an XRPD tab's wake keeps its Rietveld curves and
processing (0.44 → 0.25 s), a DRS tab's its fits (0.33 → 0.19 s); what is left of a wake is
its drawing, under the loader. A SEM tab's wake could start its read as the pointer goes
down on its tab (0.2 s of its 0.37). Kept results could go in the records, for the first
wake after a reload (0.2 s an XRPD tab), at 3.4 MB more written at each autosave of such a
tab: not done (NOTES-v3.md §4).

**Not handled, as in v517:** two windows of the app each have their own tabs (they share
the pool's cap); the composer is the tab on show's.

With the time items, about 3 days in all (5 before b2v2 and b2v3 did the memory items).

## Method, trees, housekeeping

- Trees in the scratchpad: `b2int/head` (HEAD), `b2int/t` (HEAD + the five patches, then the
  integration: a local git the patch was made from), `b2int/final2` (a fresh copy of HEAD
  with b2.patch applied, where the final suite ran), `b2int/final` (the same before the
  releasePlot fix: trim-nodes' "without"). Servers on ports 8996, 8997 (b2) and 8998
  (HEAD), stopped by their PIDs. b2v2's: `b2v2/build` (its local git), `b2v2/fresh` (the
  last tests), `b2v2/mnew` and `b2v2/mold` (the measurements'), on ports 8990–8992
  (`NOTES-v2.md`). b2v3's: `b2v3/a` (its local git; served on 8990 for the measurements),
  `b2v3/v2` (b2v2's patch, on 8991), `b2v3/fresh` (the last tests); its part B's `b2v3/b`
  (its local git, served on 8990), `b2v3/bv2` (on 8991), `b2v3/freshB` (the whole suite)
  (`NOTES-v3.md`); its review's `b2v3/refix/w` (its local git, served on 8990), `v3b` (part
  B's patch, on 8991), `fresh` (the whole suite), `probe` (the reviewers' scripts).
- No file of the main tree outside `proto/live-tabs-b2/` was edited, and no git command that
  changes state was run there.
