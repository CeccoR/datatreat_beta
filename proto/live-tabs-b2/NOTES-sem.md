# SEM made per tab (b2): sem.patch

(b2v2, `NOTES-v2.md`: the trim these notes describe is gone from every module, and a
sleeping SEM tab now lets go of its files' bytes. These notes record the first version as it
was built and measured.)

`sem.patch` makes SEM (sem.js, sem-read.js, sem-read.worker.js, sem-figure.js) a factory as
`API.md` says: one live instance per SEM tab that is awake, in one page. It is a git diff
against HEAD + `core.patch`; `git apply --check` is clean there, and on HEAD + core +
xrd.patch, with or without drs.patch. It also adds `tests/b2sem.test.mjs` (3 tests), a row
for it in `tests/README.md`, and changes two
assertions of `tests/bytestore.test.mjs` that name SEM's record form (below). index.html and
style.css needed no change: the SEM section has no inline handler, and its rules go by ids
and classes that only the instance on show has in the page.

```sh
git apply proto/live-tabs-b2/core.patch && git apply proto/live-tabs-b2/sem.patch
node --test tests/b2sem.test.mjs
```

## The conversion

- **The factory.** `(function(){ … })()` became `createSem({ key, root, layer, shown })`,
  registered with `registerModule('sem', createSem)`. The body keeps its place and
  indentation, as XRPD's did. It returns `{ trim, destroy, bytes }`.
- **Lookups.** The 32 `document.getElementById` (one of them the `$` the intensity section
  used for its own calls) and the 2 page-wide `querySelector(All)` on SEM's elements are
  root-scoped (`$`, `root.querySelector`).
  The page-wide ones left are page things: `main` for the groups' width, the composer's
  `.fig-backdrop`, `elementFromPoint` during a drag.
- **Registries by key.** History, redraw, busy, CSV, has-data, the drop zone and the file
  list take the instance's key or its elements.
- **The layer.** SEM lays only the drag's ghost over the page; it goes in the layer.
- **Drawing on show only.** `renderAll`, `refreshLevels`, `renderThumbs`, `renderGroups` and
  `loadEditorImage` return while the tab is not on show and mark the instance `stale`. The
  tab's redraw draws everything when stale; otherwise it fits the panes and makes the
  editor's image again if it was let go.
- **The reading, a job in the background.** It calls `busyChanged(key)` when files are
  dropped and when their reading ends, so the tab never sleeps while it reads and its time
  hidden counts from the end. It writes into its own instance and is one history step, as
  before. Leaving the tab no longer asks to stop it; closing the tab stops it.
- **destroy()** stops its reading (its answers dropped, the worker kept for other tabs'),
  aborts its window listener (resize), drops a drag, and closes the figure composer if it
  is this tab's. What the module keeps by file stays while the files are held elsewhere.
- **Module-level, shared by the instances, keyed by the file** (its id, FNV-1a of its bytes
  and their length):
  - `raws`: one RawRef, and so one array of bytes, per file. A file read or restored while
    another tab, a history or a sleeping tab holds it takes the array already held. The
    bytes are compared first, since the id is a 32-bit hash. A FinalizationRegistry drops
    what was made of a file once its last RawRef is collected.
  - `imgs`: the header (with its warning), the reduced copy and the card's levels,
    ~0.15 MB per 2048² image. A tab woken draws its thumbnails without reading its images
    whole.
  - `full`: the image at full size, as one budgeted LRU (`evict`). Only the images of the
    instance on show and of a reading are kept. Copies (below) stay within
    `DEC_BUDGET` = 32 MB, three 2048² images.
  - `statsCache` (64 crops), `lutCache` (≥ 48 curves): made LRU, shared by key.
  - The reading worker: one for all tabs. Jobs carry their owner, and the worker is
    terminated 20 s after its last answer.

## Memory cuts, each measured

Fixture: 8 Tescan-like TIFFs, 2048 × 2176, 16 bits, 8.9 MB each, 71.3 MB in all (the
assessment's size; `tests/fixtures.mjs` `makeTiff`). Script `measure/sem.mjs` →
`results/sem.json`.

How it was measured:

- **Trees.** "core" is HEAD + core.patch, where SEM runs v517's code on the compatibility
  path. "b2" is HEAD + core.patch + sem.patch.
- **Memory.** Headless Chromium, read after two forced GCs:
  - the JS heap (`Runtime.getHeapUsage` usedSize);
  - its ArrayBuffers (`backingStorageSize`, "ab"), where the files' bytes and decoded images
    live;
  - the renderer's RSS from /proc. RSS drifts by ±10–60 MB between runs because freed
    memory is not handed back to the OS, so heap + ab is the exact figure.
- **Shows.** Timed from the click to two frames after the loader is gone (`lib.mjs
  timedShow`), median of 5.
- **Baseline.** A blank page is 2.9 MB heap, 3.3 MB ab, about 130 MB RSS.

| cut | before (core) | after (b2) | cost |
|---|---|---|---|
| **Bytes held as bytes, not base64; a 16-bit image decoded as a view of its bytes** (sem-read.js `view`), tab of 8 on show | heap 94.3, ab 90.8 MB: base64 91.4 + 8 decoded copies 71.3 + editor pixels | heap 3.9, ab 74.8 MB: the bytes 71.3, nothing decoded beside them | none: a decode is a view (0.0 ms), not a copy (6.0 ms; `prim`, below); reading the 8 files 846 / 814 ms against 1230 / 1095 |
| the same, 8 images of 8 bits (an image decoded is a copy) | on show heap 49.2, ab 90.8; hidden the same | on show heap 3.9, ab 66.3 (bytes 35.7 + three copies); hidden heap 4.0, ab 40.8 | an image out of the 32 MB is read again in 11–15 ms when asked for |
| **A hidden tab lets go of its decodes and of the editor's image** (17 MB canvas + 17 MB pixels for 2048²); the thumbnails' data kept | parked: heap 94.4, ab 90.8, RSS 357 | awake hidden: heap 4.0, ab 74.8, RSS 233; `bytes()` 20.3 → 3.5 MB | shown again in 81.9 ms (max 114), the editor's image remade in it (25–29 ms); core's switch 111.6 ms |
| **Trim after 60 s hidden**: thumbnails, cards, editor and histogram panes | RSS 233.2, 5065 nodes | RSS 228.9, 4927 nodes; `bytes()` 0.5 MB | shown in 107.9 ms (max 113) |
| **Sleep**: instance destroyed, state and whole history parked | — | RSS 231.1, 4136 nodes (blank tab's level); a WeakRef to its section emptied after a GC | woken in 226.4 ms (max 245) |
| **One file in two tabs, one array** (`rawOf`): the same 8 files loaded again in a 2nd tab, on show | heap +90.8 MB (a 2nd base64), RSS +48 | heap +0, ab +0, RSS +13.5 | a byte comparison a file read (not timed apart: that reading took 814 ms, the first 846) |
| **The editor's pixels** (an ImageData of the image's size) kept while edited, let go 2 s after | ab 90.8 at 1 s and 3 s after a load | ab 90.8 at 1 s, 74.8 at 3 s (−16 MB) | a curve made after a pause takes 19 ms instead of 9 |
| **Figure export**: the full-size PNGs not kept | ab 94.3 → 152.3 after an SVG export of the 8 (60.8 MB), held until the composer closes | ab 78.3 → 78.4 | none: each export makes them anyway |
| **Reading worker terminated 20 s after its last answer** | 1 worker 22 s after (kept for the page's life) | 0 workers; RSS 241.8 → 237.0 | its isolate held 1.3 MB of heap; the next reading makes a new one (not timed) |

Primitives (`sem.mjs prim`, one 2048 × 2176 file in the page, ms, median of 7, b2 /
core):

- **Reading a file.** Hash 14.0 / 12.8 ms; header 0.1 / 0.1 ms.
- **Its levels.** A view 0.0 ms (b2); a copy 6.0 / 6.2 ms at 16 bits, 15.4 / 10.9 ms at 8
  bits.
- **What is made from them.** Reduced copy 5.6 / 8.5 ms, a crop's statistics 33.5 / 35.9
  ms, the card 12.4 / 12.7 ms.
- **The editor's image.**
  - 9.0 / 8.8 ms with its pixels kept;
  - 19.0 / 19.2 ms with new pixels;
  - 28.8 / 25.4 ms with a new canvas.
- **Base64 (core only).** 5.7 ms to make, 9.2 ms to read back.

What follows from them:

- The 50 ms rule allows letting go of the editor's image at hide.
- The statistics (34 ms an image) are kept by file, across tabs and sleep.
- An 8-bit image outside `DEC_BUDGET` is read again in 11–15 ms.

The figures in one place, for 8 images of 2048² at 16 bits:

- **On show.** b2 holds 72.5 MB above a blank page (heap + ab), against 179 MB on the
  compatibility path, plus the editor's 17 MB canvas in both.
- **Hidden, trimmed or asleep.** b2 holds 72.6 MB, the files' bytes themselves; the
  compatibility path holds 179 MB parked.
- **20 tabs.** The app's limit of 20 such tabs is about 1.45 GB in b2, within the user's
  3 GB. The compatibility path holds 20 × 91.4 MB of base64 plus its decodes up to 128 MB,
  about 2 GB (the assessment measured v517's 20 SEM tabs at 2095 MB RSS, heap 1818 MB).

## Tests

- **Whole suite on HEAD + core.patch + sem.patch:** 190 of 190 pass (187 + the 3 new),
  in a fresh git-archive tree with both patches applied; `results/suite-sem.log`. An earlier
  full run failed one step of test 3, which assumed the editor's pixels were still kept;
  the expectation was corrected and the test passed 3 runs alone.
- **`tests/b2sem.test.mjs`** (3 tests, about 8 s):
  1. Two SEM tabs awake at once, each with its own files, view and undo. A switch shows the
     tab's own section, with nothing restored. a.tif loaded in both tabs is one array of
     bytes, and both tabs' readings use one worker.
  2. A reading going on in a tab left, its worker's answers held:
     - nothing is asked when the tab is left;
     - the tab stays awake 11 minutes later while it reads;
     - its files land in its own list as one step, in its record, with its "*";
     - it is awake 9 minutes after the reading ends and asleep 11 minutes after;
     - woken, it is drawn and its step undoes.
  3. Hidden, trim and sleep:
     - hidden, the editor's image is let go (`bytes()` falls by at least its canvas);
     - trimmed after 61 s, its thumbnails and cards are drawn again on show;
     - asleep after Settings' 10 minutes, it wakes with its whole history, undone step by
       step to the empty start and redone.
- **`tests/bytestore.test.mjs`: two assertions changed, with the record form.** A SEM file's
  bytes are now stored as XRPD's are, `{ id, bytes: {__t:'u8', h} }` instead of
  `{ id, b64: {__t:'b64', h} }`, and a missing file's export says `bytes: null` instead of
  `b64: null`. db.js is unchanged: it already stores byte arrays by hash.
- **Old records and project files** with `b64` are read: `semRestore` turns the base64 into
  bytes once. The next save writes the new form under the same SHA-256, so nothing is stored
  twice. A project file written by b2 cannot be opened by v517.

## Not done, and what would cut more

- **The bytes of a sleeping tab stay in memory.** They are 71 MB for 8 images, nearly all of
  what a sleeping SEM tab holds, and IndexedDB already holds them by hash. Reading them back
  on wake would give that memory back. It needs the core:
  - an asynchronous wake;
  - db.js reading bytes by hash;
  - parked states holding `{__t:'u8', h}` in place of arrays.

  The memory policy cannot see these bytes either: `bytes()` counts only what sleep gives
  back.
- **8-bit images are still decoded as 16-bit copies.** The views need 16 bits in this
  machine's order. Reading 8-bit levels through a ×257 table in the hot loops (statistics,
  curve, reduced copy) would make them views too. resample's float sums would then differ
  in the last bit, so it was left.
- **The editor still draws the whole image at full size** (17 MB for 2048² while shown). A
  canvas at the pane's resolution, drawn again on zoom, would hold a few MB, but it changes
  how the image is drawn.
- **Measurement limits.**
  - Real Tescan files were not measured: synthetic ones only, with the strips in one run at
    an even offset, as Tescan writes them.
  - Not tested in a real browser left in the background.
- **Lint.** sem.js's one lint error (`screen` not defined) is v517's own, left as it was.
