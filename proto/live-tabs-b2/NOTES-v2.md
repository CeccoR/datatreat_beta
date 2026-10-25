# b2v2: no trim; a sleeping SEM tab without its files' bytes

The user's two decisions after the limit's assessment (`proto/ASSESSMENT.md`, "Option b2
built"), made in `b2.patch`, which now holds them (one git diff against HEAD, the app's
files those of v517, b93ed5c). Nothing else changed. The stage patches (`core.patch` …
`gc-epr.patch`) are the first version, as they were; `ASSESSMENT.md` records that version,
measured.

1. **The 60 s trim is gone, from every module.** A hidden tab stays as it was left until it
   sleeps (Settings' X minutes, or the LRU). SEM still lets go of its editor's full-size
   image as its tab is hidden (remade in some 27 ms as it is shown): that is not the trim.
2. **A sleeping SEM tab lets go of its files' bytes**, which IndexedDB's bytes store holds by
   their SHA-256 since v517, and reads them back as it wakes, the loader on meanwhile.

And the question asked beside them: what holds the ~42 MB per SEM tab that the assessment
found in Chromium's browser process. **The measurements' own browser context**: Playwright's
`newContext` is off the record, and there IndexedDB is kept in the browser process's
memory, up to a quota of some 980 MB past which every write fails. On a profile on disk,
as a real browser has, the browser process holds none of it (below).

## 1. No trim

Taken out (no dead code left): tabs.js `TRIM_MS`, the trim in `keepLimits` and in the next
time due, a tab's `trimmed`, the `show()` hook and `tabsNow`'s `trimmed`; xrd.js `trim`,
`show`, `trimmed` and its branch of `bytes()`; xrd-peaks.js `trim`, `again` (and its calls
in `instrModel` and `csvEntries`) and `trimmed`; xrd-rv.js `trim`; plot.js `releasePlot`,
which only the trim called (the integration's fix of it goes with it); sem.js `trim`.
DRS, GC and EPR had none: their comments no longer name it. No Settings row or test hook
named it. `tests/b2sem.test.mjs` test 3 asserted it: it now checks that a SEM tab hidden 9
minutes has let go of nothing more than the editor's image (its thumbnails and cards still
drawn in its section, its `bytes()` the same). `b2xrd` and `b2cross` asserted nothing of
it; they pass as they are.

What it costs and gives, measured (lim-series.mjs; the first version's numbers from
ASSESSMENT.md, b2v2's from the runs below):

| | first version (trimmed) | b2v2 |
|---|---|---|
| SEM tab hidden, awake, Private per tab | 113.8 MB off the record; 72.1 on disk | 123.2; 78.2 (on disk +6: its thumbnails, cards and panes) |
| XRPD tab of 12 refined, hidden | 8.7 MB (ASSESSMENT, `lim-b2-xrd.json`) | 17.2 MB, as `lim-b2nt-xrd.json` (TRIM_MS 10⁹) measured it |
| back to a SEM tab left over a minute | 103 ms median (max 163), trimmed | 75–78 ms (max 111–116), awake |
| back to an XRPD tab left over a minute | 395 ms (max 494), trimmed | 111 ms (max 197), `lim-b2nt-xrd.json` |

## 2. A sleeping SEM tab without its files' bytes

### How

- **The module says so**: `registerModule('sem', createSem, { dropBytes: true })` (utils.js
  `dropsBytes`). No other module does, and nothing changes for them.
- **At sleep** (tabs.js `sleepTab` → `lighten`): the instance is let go as before, its state
  and history parked. Then the tab's record is written with its state, and with the hashes
  of its history's files beside its own (db.js `putRec`'s new `also`, `putTabRec(rec,
  also)`: their bytes put in the store where it lacks them, in the same transaction, the
  record holding them from the sweep). Only once that write is done, and only if the tab is
  still asleep with the same parked state, every array of bytes whose hash the page took is
  replaced in the parked state and history by `{__t:'u8', h}` (db.js `unload`: one object
  for one array, an id where it is met more than once; SEM's RawRef copied as a RawRef, so
  that its JSON, and the history's comparison of states, are the same). Every later write
  of the record of a SEM tab asleep carries its history's hashes too (`heldOf`). A file not
  hashed (no WebCrypto) keeps its bytes; a write that fails (the quota) lets go of none.
  Writes queued before it (an autosave of files just dropped) are written first: the queue
  is in order.
- **Nothing else holds them.** SEM's module-level caches by file: `raws` are WeakRefs;
  `imgs` hold the header, the reduced copy and the card's levels, no bytes; `full` (the
  images at full size, views of the bytes for 16 bits) only those of the tab on show and of
  a reading, let go after the task; the statistics and curves hold none. What a file was
  made into used to go with its last RawRef: it now stays for the files let go last, 32 MB
  at most (`ORPHAN_BYTES`; 0.15 MB an image of 2048²), so that a tab woken draws its
  thumbnails and cards without making them again (below: without it a wake took twice as
  long, with a long task of up to 551 ms).
- **At wake** (`wakeTab` → `wakeLater`): only for a module with `dropBytes` whose parked
  state or history holds references (db.js `unread`); every other wake, and every other
  module's, is the synchronous one, unchanged. The state and history are read back
  together (db.js `load`: an array of the hash the page still holds, another tab's, is
  taken, so that a file shared with an awake tab stays one array and is not read; the rest
  from the store, one transaction), then the tab wakes as before. Meanwhile the loader is
  on and the module has no instance in the page (utils.js `vacate`: its name stands for the
  key woken, which has none yet, so that Ctrl+Z and ← → reach no other tab under the
  loader).
- **Races.** One read a tab, whatever wakes ask for it meanwhile (`t.waking`). The wake is
  given up, the tab staying asleep with its references, if the tab is left (another tab
  shown), closed, or woken otherwise when the read ends; a fixed section shown meanwhile
  (Home) stays on show, the tab woken behind it. A close of the tab waking hides its loader
  (closeTab). A busy tab never sleeps, as before.
- **Missing bytes** (the store cleared or evicted): they come back as none, as a reload
  gives them; SEM leaves those files out of its list and says so in its alerts, as v517
  does for a file whose stored bytes no longer read, and a banner says "“T”: N of its files
  are not stored in this browser any more: it comes back without them." The rest of the tab
  is as it was; an undo to a state that held such a file shows it so too. A read that fails
  as a whole (none of it read) is said so and treated the same; no wake waits forever.
- **Every reader of a sleeping tab's state that needs the bytes**:
  - Save of a hidden tab as it is closed stores its references, the bytes being in the store
    and the project's record holding their hashes from then on;
  - Save, Save as, the exports, the CSVs, Delete and a close that saves of the tab on show
    wait for its wake (`ensureLive()` returns the wake's promise);
  - Projects' CSVs and exports read the saved record with its bytes (`readProject`,
    `exportedProject`), as before;
  - the figure composer opens over the tab on show, awake, its bytes read;
  - a reload: the records of SEM tabs not on show are read without their bytes
    (`allTabStates(lazy)`), those tabs coming back asleep with their references; a project
    opened from Projects in the background lets go of its bytes once its tab's record is
    written (`lighten` from `openTab`);
  - undo and redo after a wake: the history's files were read back with the state, every
    hash the history names, so no step meets a missing file but one the store lost.

### Tests

`tests/b2sem.test.mjs`, 3 tests added (6 in all), on the tree `b2.patch` gives (below):

4. A SEM tab of three images, one removed (its bytes then in the history alone), a second tab
   holding one of the three, awake. Put to sleep while the tabs' records are written (their
   transactions' end held): its arrays kept, a file's WeakRef still full after a forced GC.
   The write let through: its references taken; after a GC the WeakRefs of the two files no
   other tab holds empty, the shared one's full; the store holds all three after a sweep,
   its record naming all three. Woken: its labels, its whole history, its thumbnails, cards
   and editor, its group's figure; the shared file one array with the awake tab's; a file
   downloaded byte for byte; undone, the removed file back (read from the store), down to
   the empty start and up again.
5. With the store's reads held: shown, the loader on, no SEM section in the page, Ctrl+Z
   reaching no tab; left meanwhile: the wake given up, the tab asleep with its references,
   the other tab untouched; shown, left and shown again during one held read: one read, then
   woken; closed during its wake (Don't save): gone, the other tab on show; a file's bytes
   deleted from the store: woken without it, the banner, its alert, the rest as it was, an
   undo to a state with it the same.
6. A saved SEM project's tab edited, then asleep: Projects' CSV of its project the bar's;
   closed hidden with Save: saved with its edit and both files' hashes; reopened from
   Projects, its files byte for byte; a reload: the tab not on show back with its references
   (not their bytes), woken with its file byte for byte.

No page error and no CSP violation in any (the three assert both).

Run, as the user asked, the SEM tests and those of what was touched, not the whole suite:
`sem.test.mjs`, `b2sem.test.mjs`, `bytestore.test.mjs`, `roundtrip.test.mjs`,
`b2xrd.test.mjs`, `b2cross.test.mjs` (`b2xrd` and `b2cross`: the trim's removal; no other
test names the trim). **37 of 37 pass** (`results/suite-b2v2.log`), on a fresh git-archive
copy of HEAD with `b2.patch` applied (2 min 29 s). The patch is a git diff against HEAD,
made on bf07a53; HEAD has since moved to 0089836, which changed BACKLOG.md only: `git apply
--check` is clean on it (checked on the main tree, read-only), and the tree it gives is,
file by file, the one the tests passed on (34 files, +3292 −756).

Lint (`eslint` with the scratchpad's config) on every changed app file: the same findings as
the first version's same file, v517's own (`screen`, `crypto`, `Option`; three unused
names). `tests/b2sem.test.mjs` and the measure scripts lint clean with Node's and the
pages' globals added.

### Memory, measured

`measure/lim-series.mjs`, the sem kind (S0, X0 and N SEM tabs in the background, 8 images
of 2048 × 2176 at 16 bits each, files of their own: 71.3 MB a tab), every tab awake at each
N, then every hidden tab put to sleep in one call and 4 woken; lim-lib.mjs's method (two
forced GCs and a critical memory-pressure signal before each reading; Private =
Private_Clean + Private_Dirty over every Chromium process). Per tab: the slope over N awake;
(asleep − N = 0)/24 asleep. b2v2 waits, before reading the memory asleep, for the SEM tabs
asleep to have let go of their bytes (60 s at most; counted). Two contexts (lim-lib.mjs
`LIM_PROFILE`): off the record, as every earlier run; a profile on disk, as a real browser.

| run | awake, per tab | asleep, per tab | 26 SEM tabs, all but S0 asleep | source |
|---|---|---|---|---|
| first version, off the record | 113.8 MB (ab 71.1, browser 42.1) | 108.4 (ab 71.1, browser 37.4) | 2932.9 MB | `lim-b2-sem.json` |
| b2v2, off the record | 123.2 (ab 71.1, browser 45.0) | 62.7 (ab 23.0, browser 39.9): 17 of 25 tabs without their bytes | 1836.8 MB | `lim-b2v2-sem.json` |
| first version, on disk | 72.1 (ab 71.1, browser 0.1) | 71.1 (ab 71.1) | 1976.3 MB | `lim-b2disk-sem.json` |
| **b2v2, on disk** | 78.2 (ab 71.1, browser 0.1) | **0.6** (ab 0.3) | **281.8 MB** | `lim-b2v2disk-sem.json` |

- **On disk, a sleeping SEM tab costs nothing**: 0.6 MB a tab, against 71.1; the 25 tabs
  asleep hold 14 MB beyond the page with S0 and X0 (267.8 MB at N = 0). The ArrayBuffers
  fall from 1782.7 to 82.6 MB, S0's files and the page's own.
- **Off the record**, 8 of the 25 tabs kept their bytes: their records could not be written,
  past the origin's quota (below), and a tab lets go of nothing the store does not hold.
  The 17 that could gave back 71 MB each (ArrayBuffers 1782.7 → 626.6 MB).
- **Awake** a SEM tab holds 6 MB more than the first version's trimmed one: no trim (§1).
- No error, and no long task over 70 ms from the background in either b2v2 run (the first
  version's: 92 ms off the record).

### The wake

| | wake (click → loader gone + 2 frames) | its longest task | source |
|---|---|---|---|
| first version, off the record / on disk | 245–319 / 259–315 ms | 154–215 / 153–215 ms | `lim-b2-sem.json`, `lim-b2disk-sem.json` |
| b2v2, off the record | 341–470 ms | 110–170 ms | `lim-b2v2-sem.json` |
| b2v2, on disk | 420–517 ms | 103–133 ms | `lim-b2v2disk-sem.json` |
| b2v2, on disk, 20 tabs woken one by one | 305–556 ms, median 370 | 56–118 ms | `measure/wake-sem.mjs` → `results/wake-sem-disk.json` |

- **The read is what is added**: db.js `load` alone, for one tab's state and history (8
  files, 71 MB, nothing of them in the page), took 174–535 ms, median 202 (10 tabs). In the
  CPU profiles (CDP Profiler, 10 wakes) 110–165 ms of it is the page's thread taking the
  values out of IndexedDB's answers, about 15 ms a file, each in a task of its own: the
  rest is the browser's, the page answering meanwhile.
- **The longest task is shorter** than the first version's: the wake's own work is as
  before, and the reduced copies and cards are kept (`ORPHAN_BYTES`).
- **What keeping them gives**: with only the last 64 files' kept (the first try), the 12 of
  20 tabs whose files were older woke in 668–927 ms with a long task of 368–551 ms, the
  statistics (rowSums, histRow), cards (resample) and reduced copies made again
  (`results/wake-sem-disk-orphans64.json`).
- Every wake under 0.6 s; within the user's 1 s.

## 3. What holds ~42 MB a SEM tab in the browser process

`measure/idb-mem.mjs` → `results/idb-mem.json`: a blank page, no app, writing files' bytes
into IndexedDB as the app does since v517 (one Uint8Array a value, a transaction each, 8
files a "tab"); the browser process's Private after each tab, read as lim-lib.mjs reads it.

| | after 1 tab | 4 | 8 | 16 | 20 | the origin's quota |
|---|---|---|---|---|---|---|
| off the record, the measurements' TIFFs (usage 59.9 MB a tab) | 81 MB | 261 | 501 | 981 | 996: writes failing from tab 17 (QuotaExceededError) | 980 MB |
| off the record, noise (68 MB a tab) | 89 | 294 | 567 | 1001: failing from tab 15 | 1001 | 986 MB |
| profile on disk, the TIFFs | 21.4 | 21.5 | 21.5 | 21.6 | 21.6 (1197 MB stored) | 151 GB |
| profile on disk, noise | 20.8 | 20.8 | 20.9 | 21.0 | 21.2 (1360 MB stored) | 151 GB |

(20–21 MB with nothing stored.) Off the record, reading the values back, reloading the page
and deleting the database left the browser process as it was (996 MB). Files made in the
page (`new File` of fetched bytes, as the measurements drop them) take 68.5 MB a tab of 8 in
the browser process while held, and give it all back once let go (22.7 MB).

- **The cause is the context, not the app.** An off-the-record context keeps IndexedDB in
  the browser process's memory, at the size it stores (Chromium compresses: the TIFFs take
  59.9 MB a tab, noise 68), until the origin's quota of some 980 MB, after which every
  write fails. That is the ~42–60 MB a SEM tab and the plateau near 1 GB the assessment
  found in v517, b1 and b2 alike: they all write the same bytes. On a profile on disk it is
  on disk, and the browser process stays at 21–25 MB whatever is stored, in the minimal page
  as in the app (`lim-b2disk-sem.json`, `lim-b2v2disk-sem.json`: 21.0–24.7 MB from N = 0 to
  24).
- **No fix to make in db.js or sem-read.js**: they write each file once, by its hash, and
  hold nothing read back (files dropped are let go after their reading).
- **What it changes**:
  - every per-tab figure of a SEM tab measured off the record (ASSESSMENT.md, the assessment's
    totals) carries 40–60 MB that a real browser does not spend; on disk a SEM tab costs
    its renderer's 72–78 MB awake;
  - off the record, past ~16 SEM tabs of these files the app's records were not being
    written at all (the autosave fails silently); in b2v2 such tabs also keep their bytes
    asleep. A real profile's quota is a share of the disk (151 GB here);
  - measurements of memory should take a profile on disk: `LIM_PROFILE=disk` in lim-lib.mjs.

## Behaviour changes for the user

- A SEM tab shown after sleeping reads its files back: 0.3–0.56 s with its loader, against
  0.25–0.32 s; its longest task is shorter (under 0.14 s).
- A hidden tab is never trimmed: going back to an XRPD tab left a while takes about 0.11 s,
  not 0.4 s; a hidden XRPD tab of 12 refined holds 8.5 MB more until it sleeps, a SEM tab 6.
- A SEM tab asleep depends on the browser's storage for its files: should the browser clear
  or evict the site's data while the page is open, those files come back without their bytes
  when the tab is shown (said so), where before a sleeping tab still held them. The site's
  storage is "best effort" unless it asks to be kept (`navigator.storage.persist()`), which
  the app does not; asking would be one line, the browser deciding.

## Not done, and what is left

- **The memory policy.** `bytes()` still counts only what sleep gave back in the first
  version, never a tab's files; now that sleep gives back a SEM tab's files, the budget by
  memory could count them (ASSESSMENT.md's recommendation 6, refitting `bytes()`, half a
  day). Not asked here.
- **The read's 0.2 s** could start when the pointer goes down on the tab, or be split by
  file; not done.
- Measured headless, on this machine, synthetic files; a real Chrome's IndexedDB on the
  user's disk, with his files, not.

## Method, trees, housekeeping

- Trees in the scratchpad's `b2v2/`: `build` (HEAD + the first b2.patch, a local git, the
  changes made there), `fresh` (a git-archive of HEAD with the new `b2.patch`: the tests'
  last run), `mnew` and `mold` (the new and the first b2.patch, MAX_TABS 32 and the
  measurements' `fx/`, as lim-lib.mjs wants), `blank` (idb-mem.mjs's page). Servers on 8990
  (blank), 8991 (b2v2), 8992 (the first b2), stopped by their PIDs.
- Runs one at a time, the machine otherwise idle (load under 1 at each start). `mnew` holds
  the code of `b2.patch` but for two comments of sem.js reworded after the runs.
- Checks of the patch: `git apply --check` clean on the main tree's HEAD (0089836); the tree
  it gives on a fresh git-archive, `fresh`, is the one the last tests ran on; the patch's
  sha256 is db7ae22b…, the first version's 45006d96… (in git at fabb05b).
- `measure/`: `idb-mem.mjs` and `wake-sem.mjs` new; `lim-lib.mjs` takes `LIM_PROFILE=disk`;
  `lim-series.mjs` waits for the SEM tabs asleep to have let go of their bytes and says how
  many did. `results/`: `lim-b2v2-sem`, `lim-b2v2disk-sem`, `lim-b2disk-sem` (.json, .log),
  `wake-sem-disk.json`, `wake-sem-disk-orphans64.json`, `idb-mem.json` (.log),
  `suite-b2v2.log`.
- No app file of the main tree was edited, and no git command that changes state was run
  there.
