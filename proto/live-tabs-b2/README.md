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
it wakes. **b2v3** (`NOTES-v3.md`), three more of the user's decisions, is in it too: **no
memory budget** (the count and the minutes are the only rules); **any number of tabs open,
at most 20 awake** (Settings), the one shown least lately put to sleep beyond them; and
**arrays fixed, not frozen**, shared by a tab's states, its parked state and its history
without a copy. Where this page gives measurements of the first version, it says so.

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
- **A sleeping SEM tab holds no file's bytes** (b2v2): once its record is written, its
  state and history hold its files by their SHA-256, the bytes being in the store; shown
  again it reads them back, the loader on meanwhile (0.30–0.56 s for 8 images of
  2048 × 2176, 71 MB; `NOTES-v2.md`). The other modules' wakes are as before.
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
  use; what was made of files let go (headers, reduced copies, cards) is kept up to 32 MB
  (`ORPHAN_BYTES`), so that a sleeping tab wakes without making it again.

## Applying

```sh
git apply --check proto/live-tabs-b2/b2.patch && git apply proto/live-tabs-b2/b2.patch
npm test                       # 209 tests, about 12 min
```

`b2.patch` is a git diff against HEAD (app files b93ed5c): 38 files, +3497 −784, b2v2's
and b2v3's changes included (`NOTES-v2.md`, `NOTES-v3.md`). `git apply --check` is clean on
a fresh git-archive of the main tree's HEAD (0ddc38e), and the copy it gives is identical,
file by file, to the tree b2v3's tests ran on. b2v2's (+3292 −756, sha256 db7ae22b…) is in
git at 0ddc38e, the first version's (+2908 −731, 45006d96…) at fabb05b. `git apply -R`
takes it out.

On release the app's own rules still apply: `sw.js` says "Bump CACHE when any precached
asset changes" (`datatreat-v517` → the new version), and the footer's version, README.md and
BACKLOG.md go with it. The patch leaves them to the release.

## What is here

| file | what |
|---|---|
| `b2.patch` | **The whole of b2**, to apply: the five stage patches below, the integration (below: the cross-module test, two rows of tests/README.md and its test count), b2v2's changes (`NOTES-v2.md`: no trim, a sleeping SEM tab without its bytes) and b2v3's (`NOTES-v3.md`: no memory budget; any number of tabs, at most N awake; arrays fixed, not frozen) |
| `core.patch`, `xrd.patch`, `sem.patch`, `drs.patch`, `gc-epr.patch` | **The first version** by stage, for reading: the core against HEAD, each module against HEAD + core. Applied in that order they give the first b2.patch less the integration; `b2.patch` has the later changes (the integration, b2v2) |
| `API.md` | How a module is made per tab, with XRPD as the worked example |
| `NOTES-core.md`, `NOTES-sem.md`, `NOTES-drs.md`, `NOTES-gc-epr.md` | Each stage's notes: what changed, each memory cut with its numbers, its tests (the first version: its trim included) |
| `NOTES-v2.md` | **b2v2**: the trim taken out; a sleeping SEM tab's bytes let go and read back as it wakes; what held ~42 MB a SEM tab in the browser process; tests and numbers |
| `NOTES-v3.md` | **b2v3**: the memory budget taken out; any number of tabs open, a cap on those awake, the strip and the restore at 60 tabs; arrays fixed, not frozen, and the bytes it saves; tests and numbers |
| `measure/` | One script per measurement or check, `lib.mjs` shared; `session.mjs`, `upgrade.mjs` and `trim-nodes.mjs` are the integration's; `lim-*.mjs` the assessment's; `idb-mem.mjs` and `wake-sem.mjs` b2v2's; `fixed.mjs` and `many.mjs` b2v3's. The earlier scripts read the settings and `bytes()` of the versions they measured (`liveMax`, `livePolicy`), which b2v3 has not |
| `results/` | Each measurement's JSON and the suite's logs |

## What changed

| file | lines | what |
|---|---|---|
| utils.js | +229 −74 | every registry by the instance's key (history, redraw, busy, CSV, has-data, the section on show); a module's name stands for its instance on show; `registerModule`, `makeInstance`, `attachInstance`, `detachInstance`, `dropKey`, `withState`, `onAnyChange`, `busyChanged`, `dropsBytes`, `vacate`; the undo keys act on the tab on show; the drop zone and file list take elements; the Settings' values (`sleepMin`, `awakeMax`); `stateKey` takes an array fixed by its hash, `fixed` given to the modules |
| tabs.js | +349 −73 | live instances per tab: show, hide, sleep, wake; the busy exemption; no limit on the tabs open, at most `awakeMax` awake, the one shown least lately asleep beyond (`seenAt`); the wheel along the strip; Settings › Tabs in the background; `sleepTick` and `tabsNow` for the tests; a sleeping SEM tab's bytes let go and read back (`lighten`, `wakeLater`), its records read without them after a reload |
| sessions.js | +110 −87 | autosave, the unsaved mark and Save per tab, shown or not; a hidden tab closed with Save saved as it is; Projects' CSVs through a throwaway instance; Save, exports and Delete wait for a wake reading its bytes |
| db.js | +119 −23 | arrays fixed (`fixed`, `isFixed`: a WeakSet), which `park` and `decode` share instead of copying them; `unload`, `load`, `unread`; `putRec`'s `also` (a history's files held with a record); the records read without their bytes (`allTabStates(lazy)`), and by a cursor, one a task |
| cards.js, modkit.js | +18 −9, +19 −10 | the deck's menu in the instance's layer, `deck.destroy()`; `moduleKit(mod, { root, key, layer })`, `kit.destroy()` |
| plot.js, figure.js | +14 −4, +3 −2 | downloads find their svg from the button; the composer's memory keyed by the tab that owns the plot |
| index.html, style.css, sw.js | +6, +3, +1 | the Settings rows; `.inst-layer`; xrd-rv-pool.js precached |
| xrd-rv-pool.js | +183 (new) | the pool (proto/workers) |
| xrd.js, xrd-peaks.js, xrd-rv.js, xrd-rv-model.js | +76 −34, +2 −2, +70 −60, +6 −2 | XRPD a factory; Refine all on the pool; its patterns' arrays and its results' lists fixed, not frozen |
| sem.js, sem-read.js, sem-read.worker.js, sem-figure.js | +405 −242, +59 −40, +11 −6, +8 −4 | SEM a factory; its files' bytes kept as bytes (not base64), a 16-bit image a view of them; what is made of a file shared by all tabs, and kept a while after (32 MB); one reading worker; its tabs asleep without their bytes (`dropBytes`) |
| tauc.js, gc.js, epr.js | +105 −36, +69 −19, +75 −15 | DRS, GC and EPR factories through the kit; DRS's energies and EPR's spectra shared by file; their spectra and GC's gases fixed |
| tests/ | 7 new files, 7 changed | `b2xrd`, `b2sem`, `b2drs`, `b2gcepr`, `b2cross` (two tabs of a module, and every module together), `rvpool`, `b2cap` (the cap on the tabs awake, 40 tabs), `b2fixed` (arrays fixed); the steps of `rvui` C and `tabs` that checked v517's question on leaving a busy tab; SEM's stored form in `bytestore`; helpers.mjs freezing every array fixed; the table in tests/README.md |

## Tests and checks

**b2v3** (`NOTES-v3.md`): the tests of what changed, not the whole suite (the user's round 3
runs it next): `tabs`, every b2 test (`b2xrd`, `b2sem`, `b2drs`, `b2gcepr`, `b2cross`), the
new `b2cap` (the cap, 40 tabs) and `b2fixed` (arrays fixed), the stores' (`db`, `bytestore`,
`roundtrip`), XRPD's (`xrdcards`, `rvmodel`, `rietveld`, `rvui`, `undorun`), DRS's
(`drsread`, `widths-drs`), GC's (`gcdate`, `gcp`, `gcrep`), DRS/GC/EPR's `modules` and the
strip's `narrow`: **126 of 126 pass** on a fresh git-archive copy of HEAD with the new
b2.patch, in 7 min 9 s (`results/suite-b2v3.log`), every array fixed frozen by the tests
(helpers.mjs), so that a write into one would have failed them. Lint as below.

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
  number brings that down.
- The strip of tabs scrolls under the mouse wheel (b2v3); Settings › Tabs in the background
  has the minutes and the number awake only (the policy and the MB are gone).

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

**Time still to be had:** an XRPD tab's wake (0.5 s) would come down to about 0.4 s by
keeping its Rietveld curves by result at module level, at their memory: 0.5 day. A SEM
tab's wake could start its read as the pointer goes down on its tab (0.2 s of its 0.37).

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
  `b2v3/v2` (b2v2's patch, on 8991), `b2v3/fresh` (the last tests) (`NOTES-v3.md`).
- No file of the main tree outside `proto/live-tabs-b2/` was edited, and no git command that
  changes state was run there.
