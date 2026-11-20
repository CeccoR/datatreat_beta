# GC raw chromatograms (TCD): the UI prototype

A prototype of the integration of raw TCD chromatograms into DataTreat's GC module, wired to the
engine of `engine.patch` (`gc-tcd.js`, `gc-tcd-pool.js`, `gc-tcd.worker.js`). Nothing here is
live: it is `ui.patch`, applied on top of `engine.patch`.

- Base: `claude/repo-code-review-sr6c8m` at `2aae130` (v543 + the engine's research files).
- `ui.patch` bumps the app to **v544** (footer, `sw.js` cache) and does not contain the engine:
  apply `engine.patch` first.

## How to apply

```sh
git checkout claude/repo-code-review-sr6c8m        # at 2aae130 or later
git apply research/gc-tcd/proto/engine.patch        # gc-tcd.js, gc-tcd-pool.js, gc-tcd.worker.js, its test and README row
git apply research/gc-tcd/proto/ui.patch            # this prototype
npm run lint
node --test tests/gctcd-engine.test.mjs tests/gctcd-ui.test.mjs
```

`ui.patch` was made with `git diff` against a commit holding `2aae130` plus `engine.patch`
applied, so it applies cleanly after `engine.patch` (its `tests/README.md` hunk sits after the
engine's row).

## What was built, file by file

### `gc-pair.js` (new): the pairing, pure

- `looksTcd(text)`: a file is raw chromatograms when its first lines are numbers only (`;`
  between them, a decimal comma or point, a trailing `;` allowed): told by content, never by name.
  A GC table's first line names its columns.
- `stemOf(name)`: the name's extension off, a browser's duplicate mark ` (1)` off (before and
  after `_TCD`), a final `_TCD` noted and off, lower case.
- `autoPair(rows, added)`: the files dropped paired by name with each other and with files alone
  in the list (a file alone keeps its place and takes its partner; new rows follow in drop order).
  The pairing is by name only: a misnamed table pairs too, and is said (below).
- `dropPart(rows, from, to)`: the second drag handle's semantics: onto a file alone, pair (the
  dragged file's old partner left alone, an emptied row removed); onto a paired file, swap (the
  dragged file takes its place, the displaced file the dragged one's); onto its own partner, the
  two swap order; off every file (`to` null), a paired file stands alone in a new row just under.

### `gc.js`: records, pairs, alerts, cards, Analysis wiring

- **Records.** A row of the trace list is one record: a table (exactly as v543's record), raw
  chromatograms (`{ name, label, color, rawBytes, tcd: { n } }`), or a pair, the first file's
  record with the second as its `mate` (a table first beside raw chromatograms). Only the bytes
  and the column count of raw chromatograms are kept; they are parsed again from the bytes when
  shown or integrated (once per file, cached by its bytes).
- **Samples.** Only a table heading its row is a sample (`moduleKit`'s new `sample` predicate):
  raw chromatograms alone and TCD+TCD pairs have no entry in the per-sample arrays, no Sample
  select, and never reach the Production Rate cards. A pairing change re-aligns the per-sample
  arrays by file name (`regroup`): a table that becomes a pair's second holds its values in
  `held`, as a file left out does, and gets them back when it heads a row again.
- **Drop.** Tables and raw chromatograms are read (`readGcAny`), then paired by name and placed
  (`kit.dropText`'s new `collect`). The first raw chromatograms of a project add an Integration
  card above the first Production Rate card, in the same undo step as the files.
- **Trace list.** Through modkit's `traces`: a pair's row carries both files' bytes (its download
  is both files, zipped), and `parts`/`onPartDrop` give the second drag handle. While no raw
  chromatograms and no pair are loaded, `parts` is null and the list is exactly v543's.
- **Alerts under the drop zone** (`pairAlertsHtml`, yellow, dismissable): two tables paired
  (the first used, the second ignored), two TCD files paired, raw chromatograms alone (all three:
  shown in Integration, left out of Analysis).
- **Cards.** `KINDS` gains `integ: 'Integration'`. The deck offers it on "+" only while raw
  chromatograms are loaded (or an Integration card exists): with tables only, "+" adds a
  Production Rate card with no menu, as before. Kinds are fixed (`fixedKinds`): a card's title
  names its kind but does not switch it.
- **Analysis wiring.** A Production Rate card's values come from the **nearest Integration card
  above it** (`integAbove`, `srcFor`): for a table paired with its raw chromatograms, that card's
  `valuesFor(f)` gives per gas the re-integrated %mol (calibration or transfer) or the table's
  with the reason. `computeTables` takes those arrays in place of the table's (`tablesOf(f, h,
  lightOn, G)`), the table's injection dates giving the times; everything after (rates, interval,
  replicates, normalisation, CSVs) is unchanged. A source box at the card's top says what was
  used (info) and what fell back to the table and why (warning). Rate cards follow their source
  (`ratesFollow`): results arriving, a method or calibration changed, a card moved, added or
  closed.
- **gc_raw.csv**: for a sample paired with raw chromatograms (under an Integration card), per gas,
  after its concentration column: `H2 source [label]` (`reintegrated, calibrated by the
  standards`, `reintegrated, calibration taken from the GC table`, or `table (why)`), `H2 table
  (%mol)`, `H2 reintegrated (%mol)` and `H2 area`, at each injection (the file's unit: ppm for
  the .txt export). The concentration column holds the value used. Tables alone: unchanged.
- The info text (`GC_INFO`) gains a paragraph on where the values come from.

### `gc-integ.js` (new): the Integration card

- **Shared part** (`createInteg`, one per GC tab): the parsed chromatograms (by bytes), the
  results store, and the background job.
  - Results are keyed `bytesKey|methodKey`: a pure function of the file's bytes and the method.
    They are written into **every state of the history that holds the file** (new
    `UndoStack.patch` via `kit.patch`), as no step of their own: an undo never "un-integrates", a
    tab put to sleep keeps them, and they are saved with the project (module state `integ`, only
    the keys in use). Stored compact (JSON, numbers to 8 digits, the peaks' physical parameters
    dropped since `p` holds them); null read back as NaN, never 0.
  - The job: what no result is held for, file after file, through `integrateMany` (workers),
    with progress and Stop. A method change waits 1.2 s for further edits, then integrates; a
    job on a file no longer wanted (its method changed) is aborted. Stop holds the job until
    Re-integrate or new raw chromatograms. Not registered as "busy": undo works during a run,
    the tab may sleep (the job restarts on wake for what is missing).
- **Card**: status bar (progress bar, Stop, Re-integrate, Calibration…), alerts (counts that
  differ, TCD+TCD, no table, unreadable files, the transfer info alert), two selectors with ‹ ›
  (file/pair; chromatogram, `#k of n · dd/mm hh:mm`, ⚠ on suspicious ones; ← → step the
  chromatograms), and:
  - the **chromatogram plot** from `windowCurves`: raw, model, baseline with its step, H₂, O₂ and
    S310 (each peak drawn on the baseline; S310 dotted), spikes (red crosses) and glitch zones
    (red bands) left out, the fit window's edges (draggable green lines, snapping to 0.2 s), the
    peaks' nominal positions (dotted, named), the trapezoids' base intervals (bars at the foot),
    and the neighbouring peaks the model leaves out (S264, N₂; grey zones, named). The x range
    covers the windows and the neighbours; the y range the windows' own data.
  - the **residual** plot under it, same span.
  - the **method box**: the window's edges and the trapezoid intervals as numbers (the source of
    truth; the lines write into them), a warning when the window reaches a neighbouring peak,
    Default. A change is a step; an inverted interval or a window under 5 s is refused.
  - the **values table** of the chromatogram on show (H₂, O₂): area ± sd, trapezoids, fit −
    trap (%), apex, χ²ᵣ, concentration (calibration unit or %mol; "(transfer)" marked), the GC
    table's value; the reasons that mark it.
  - the **run overview**: x the time from the first injection (h) or the injection's number (no
    aligned table), y area or concentration (chips), H₂/O₂ chips; per injection the fit (dot),
    trapezoids (square), the table's value (cross; in area mode on the scale in force);
    suspicious ones ringed; the chromatogram on show a dashed line; a click selects the nearest
    point within 14 px.
  - `integration.csv` (the overview's CSV button and the project's CSVs): every chromatogram's
    areas, sd, trapezoids, apex, χ²ᵣ, %mol, source and flags.
- **Calibration window** (XRPD standard's window styling): drop the standards' TCD files (each
  column a standard, integrated with the card's method), a level table (index, thumbnail,
  file/column, H₂ and O₂ areas, H₂ and O₂ concentrations typed, Use box), unit %mol/ppm, per gas
  a plot of area vs concentration with the line, free/zero intercept chips (free by default),
  slope, intercept, R², n and a deviation table per level. Edits are live, each a step. A file's
  names (`cal_…`) are never read. Saved with the project, bytes in the bytestore.
- **Info text** (`INTEG_INFO`) with a MathML box "From the area to the concentration".

### Shared files

- `utils.js`: `includedOf`/`setIncluded`/`removeFileAt`/`moveFileTo` take an optional
  `isSample` predicate (default: every record, so every other module is unchanged);
  `UndoStack.patch`; `bytesKey` exported; `renderUnifiedFileList` renders `callbacks.parts` (the
  files of a row, each with its own small grip) and the per-file drag (the whole target file lit,
  dashed on itself to stand alone; a press in place does nothing); `SAMPLE_NAV` gains GC
  (← → step the chromatograms of the first Integration card on show).
- `modkit.js`: `sample` predicate, `kit.isSample`, `kit.patch`, `kit.add` for non-samples,
  `dropText(read, done, { names, collect })` and `read(text, rawBytes)`.
- `cards.js`: `offer()` (the kinds "+" offers now), `fixedKinds`, `add(type, { at, quiet })`.
- `plot.js`: `points(xs, ys, color, r, { shape, fill, width, label, key })`: square, diamond and
  cross marks and filled ones; the default circle is drawn exactly as before (golden hashes
  unchanged).
- `style.css`: the pair rows and grips, the Integration card, the calibration window.
- `index.html`: the GC drop zone's text; v544. `sw.js`: v544, precaches `gc-pair.js`,
  `gc-integ.js`, `gc-tcd.js`, `gc-tcd-pool.js`, `gc-tcd.worker.js`.
- `README.md` (GC section), `tests/README.md` (a row), `tests/gctcd-ui.test.mjs` (10 tests).

## Decisions where the brief was silent

1. **Which Integration card feeds a rate card**: the nearest one above it. A rate card above
   every Integration card keeps the tables, which allows table vs re-integration side by side.
2. **Per gas, not per pair**: H₂ can be calibrated by standards and O₂ transferred, or a gas
   kept from the table (no standards and too few injections above the threshold) while the
   other is re-integrated. Each is said.
3. **"All-n.a. rows don't count"**: the table's injections are the record's `injDates`, i.e. rows
   with a valid date and at least one gas value (rows of n.a. and rows whose date does not exist
   are not injections). A failed fit (NaN area) is left out of that gas only, as an empty cell is.
4. **Integration runs on load and after a method change** (1.2 s after the last edit, so a few
   edits make one run); Re-integrate runs at once what is missing; Stop holds it.
5. **Results are no undo step** but are written into every history state holding the file:
   undo/redo never refit or lose them. They do mark the project unsaved ("*"), since they are
   new content worth saving (a project saved before its integration ended shows "*" when it
   ends).
6. **Selection is a view** (file, chromatogram: kept across sleep via `shows()`, no step); the
   overview's gas and y chips are view keys (a step, no "*"), like Analysis's gas chips.
7. **Suspicious** (after the engine's measurements): H₂ fit vs trapezoids > 3 % *and* > 0.0015
   %mol on the scale in force (the Python's check; 10 sd without a scale); χ²ᵣ > 4; a glitch zone
   excluded; a fit that did not converge. **O₂'s trapezoid difference is shown but not flagged**:
   its right base sits on the step and on the real runs reads 10–28 % below the fit at every
   injection, so flagging it would ring every point.
8. **Transfer thresholds**: `DEFAULT_METHOD.transfer` (H₂ ≥ 0.02 %mol, O₂ ≥ 0.012 %mol, ≥ 10
   injections), per pair.
9. **Method edits**: window edges and trapezoid bases (numbers); the peaks, steps and fit
   settings stay the engine's. A restored method is the default with the saved edges and bases
   laid on it (a window or gas the engine adds later appears by itself; N₂ costs one entry in
   `DEFAULT_METHOD.windows` and the gases' colour map).
10. **Lone TCD**: Integration only; concentrations need standards (no table to transfer from);
    the overview is by injection number.
11. **Pairs of the wrong kind** are allowed and marked in FILE (warning colour, title) besides the
    alert; a TCD+TCD row lists both files in the Integration selector.
12. **Version**: v544 in the footer and the service worker.

## Tests

- New: `tests/gctcd-ui.test.mjs`, 10 tests, synthetic chromatograms from the engine's own model
  (known areas, seeded noise, 250–340 s), all pass.
- The engine's `tests/gctcd-engine.test.mjs`: pass.
- Existing GC tests and those that touch GC (`gcalt`, `gcdate`, `gcnorm`, `gcp`, `gcrep`,
  `filelist`, `plots` (golden hashes unchanged), `viewdirty`, …): see the report in the
  session's final message for the full list run and results.
- `npm run lint`: clean.

## Known gaps

- The Analysis gas chips follow the tables' gases: a table with no O₂ column whose raw
  chromatograms have O₂ (calibrated by standards) gets O₂ re-integrated but its chip may stay
  disabled.
- The calibration window's edits are live steps; there is no Apply/Cancel (XRPD's standard
  window behaves the same).
- `trova_ordine` (the Python's column-to-row check) is not there: a TCD whose columns are not in
  the table's order goes unnoticed when the counts agree (ENGINE.md §8.3).
- The job is not "busy": closing a tab during a run does not ask; the results so far (per file)
  are kept.
- The pool's workers do not share the Rietveld pool's cap.
- Tested at desktop widths; narrow (phone) layouts of the Integration card were looked at only
  briefly.
- The older run whose TCD time restarts mid-file is refused as a file (red alert under the drop
  zone, with the engine's reason); its table loads alone and behaves as today.
