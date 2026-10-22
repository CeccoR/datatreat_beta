# DataTreat's tests

The app itself has no build and no dependency. These tests drive it as a user would, in a
headless Chromium (Playwright), from Node's own test runner: they start a small static
server of their own on a free port, open the app on it, load files made by code, and check
what comes out. Nothing here is part of the app: the service worker does not precache
`tests/`, and GitHub Pages serves the app as before.

## Running them

Once, on a new machine (Node 22 or later, for the test runner's file patterns):

```sh
npm i                              # Playwright 1.56.1, the only dependency, for the tests
npx playwright install chromium    # the browser Playwright drives
```

Then:

```sh
npm test                           # every test file, one after the other
npm run test:update                # the same, writing the plots' golden hashes anew
node --test tests/csv.test.mjs     # one file
node --test --test-name-pattern="Rietveld" "tests/*.test.mjs"   # the tests whose name matches
```

A full run takes about 9 min (116 tests, on the machine they were written on). Each
file opens its own server and browser; each test its own browser context, so IndexedDB,
localStorage and the open tabs start empty every time.

Environment variables:

- `DT_ROOT=<dir>` serves another directory than the repository: a copy of an older
  version, say, to see whether a test fails there.
- `DT_BASE=<url>` uses a server already running instead of starting one.
- `DT_HEADED=1` shows the browser.
- `UPDATE_GOLDEN=1` is what `npm run test:update` does.

What the tests leave behind (a plot that no longer matches its golden hash, the composer's
exports) goes to `tests/out/`, which git ignores.

## What each file covers

| File | What it checks |
|---|---|
| `smoke.test.mjs` | Each module opens in a tab and loads its fixtures with no page error (an app file answering 404 is one) and no Content-Security-Policy violation; all five open at once, each tab showing its own files; under the CSP, the theme set before the first paint, the Rietveld worker loading and answering, an alert's dismiss button working with no inline handler. |
| `escape.test.mjs` | Nothing from outside becomes markup. Per module, a payload that would make an `<i data-x>` goes into the file names (F), into every string of the exported project imported back (A), and also in place of every lone number (B); no such element may appear, in the module or in the Projects list. Page errors fail F and A; under B they are reported (a project of nonsense numbers may not draw), not failed on, but for DRS, GC and EPR, which must open it and draw it with no page error. |
| `tabs.test.mjs` | Closing an inactive tab with unsaved changes and answering Save saves that tab's project, not the one on show (the v468 bug); the unsaved marker after a switch, an edit, its undo, a reload, a value set back by hand; a running job (a busy guard registered by hand, holding no mark of the history): leaving its tab asks, Ctrl+Z undoes nothing and says nothing, "Stop it and leave" stops it, a new project opens beside it when the question is dismissed. |
| `roundtrip.test.mjs` | Files come back byte for byte: an XRPD project saved (IndexedDB, base64), reloaded, exported as a signed `.datatreat` (its SHA-256 signature checked), imported back, a v473–v483 `.json` export (bytes as arrays), a record in the old format (to v470); SEM TIFFs after a reload. Import refuses what is not a project and asks about a file changed after signing or written by a newer version. |
| `rietveld.test.mjs` | A Rietveld refinement of one synthetic pattern with the SrTiO₃ CIF, no standard: asked first, in a modal, the cell found again (a = 3.905 Å within 0.002), Rwp sensible, the module busy meanwhile; Refine all on two patterns cancelled: stopped, nothing written after, not busy. |
| `cardsanim.test.mjs` | The analysis cards animated by the history's steps, in XRPD, DRS, GC and EPR. A fold or unfold made by an undo or a redo slides like the arrow's (same duration, easing and keyframes; the panel is drawn before it slides open and not redrawn while it does; XRPD's + Add peak is turned off when a redo folds its card). A card an undo or a redo brings back grows from nothing, drawn first. One it takes away shrinks as a copy that no card selector finds, then goes. A card brought back below the window grows while the page scrolls down to it. Several cards in one step animate together. A step taken during another's animation (a fold taken over, a card taken away while growing, brought back while its copy shrinks, a burst of keys) ends in the exact state. Undoing a move or a kind switch animates nothing, and a box keeps the focus through an undo. A tab switch, a project opened, a CSV export's state, the start, or reduced motion animate nothing, and such a load ends a step's animations at once. |
| `cifdl.test.mjs` | The Rietveld card's Phases list: each phase's CIF downloaded by its button left of the × (the file list's glyph, titled, named for its phase, sized as the ×, just left of it). A UTF-8 file comes back byte for byte (CRLF, non-ASCII), a UTF-16 one as its text in UTF-8, a UTF-8 one without its BOM. The name is the file's (one with no extension kept as it is), else the phase's name + .cif; the standard's built-in LaB6 downloads as LaB6_NIST-SRM-660c.cif. No row selected, no undo step; Tab, Enter and Space reach it; it works while a run goes on. On a narrow list (375, 360, 1000 px) the space group is left out and the × stays in the row. |
| `rvcif.test.mjs` | The Rietveld card's Phases and Structure boxes: the Structure box empty (no 3D view laid out or painted, no details, its note) wherever there is no phase (a card with none, a new project, a tab switched to, the phase removed, an undo past its CIF, a card added), and the right phase otherwise (each project's own CIF, the standard's LaB6 in its window); with no phase a drop zone in the list's place (click, Enter, Space: the picker), from the first phase + CIF, a one-line zone at the box's foot; CIFs dropped anywhere on the box (several at once, one undo step, the box lit while dragged over, text not taken), a file that is no CIF said and left out (one not named .cif and over 4 MB not read); the standard's window with + CIF taking its own drops; while a run goes on the zones disabled and a drop refused. |
| `rvlock.test.mjs` | The Rietveld card's Phases list while a run goes on: every row's × and tick locked as soon as the run starts (disabled, titled why, 'not-allowed' cursor, no hover colour, the tick dimmed), the download not; a click on them changes nothing (no history step), a click on the row still selects it; + CIF's zone 'not-allowed' too; at 1400 and 375 px; stopped, failed or ended, all as before at once; another card that is not refining is unaffected. The standard's window locks its choices and its CIFs' × while the standard refines (the built-in LaB6's × as before), not while a sample does. |
| `rvui.test.mjs` | The Rietveld card and the instrumental standard: with no refined standard, Refine and Refine all ask in a modal at the centre of the screen (its three answers; Escape, × and a click beside it answer neither; the primary focused, Tab kept inside, focus back on the button that asked); the standard's Settings show only the rows, start groups and Refinement settings that apply to it, none disabled for good, and the samples' keep every row; while the standard refines with its window closed, every card's Instrumental standard… shows it (a card added meanwhile, Home and back, a project opened and the question dismissed, that card undone and redone, an undo stopped silently at the run's start, the window reopened) until the run ends or is stopped. |
| `undorun.test.mjs` | Undo and redo while a job runs, the workers' answers held so that it runs as long as the test needs. A Rietveld run: steps before it (a setting, a card folded, a label) and during it (a card unfolded, a label, a file's colour); Ctrl+Z undoes those taken during it and stops at its start, nothing undone below, nothing said (no banner, no window, no alert), the running card's panel as it was (Cancel, its progress, its rows locked, the Settings open and read only, not built again); Ctrl+Y goes back up; its result then comes in as a step of its own at its start: walking back undoes the steps taken during it (the result kept in each), then the result, then the steps before it, and forward again to the end. Refine all with steps taken between its patterns: every state holds the whole run or none of it, the patterns done kept in the card through an undo to its start. Cancelled with one pattern done: that is its step, a saved project marked unsaved by it and saved with it; cancelled before any: no step, the project still saved. The standard's run the same, its window's panel as it was; then *Refine the standard first*: the standard's step, then the sample's, the step taken meanwhile after them. A card closed during its run comes back by an undo with the pattern done; one switched to Scherrer during its run keeps it. The 80-state limit crossed during a run: undo down to the oldest state kept, the result then in every state, no step of its own. Two sample cards refining at once: the redo branch the later one set aside comes back with the earlier one's result. Two held from one state with a redo branch there: a result of either drops it, in either order. *Refine the standard first* stopped or failed before any result: the redo branch there comes back. While a sample waits for the standard's run, its rows, + CIF, Clear and Settings locked, a click on them no step; an undo during its run leaves the card's inputs as the state on show has them, its end no step of its own. The standard bearing a sample's name: Refine all ends in one step. SEM: Ctrl+Z during a reading undoes the step taken meanwhile and stops silently at its start; Ctrl+Y redoes it; the files land after it, one step, the list and the groups right. |
| `xrdcards.test.mjs` | The analysis cards and the XRPD Scherrer card. + Add peak is left as its card is folded (by the arrow, clicked or by Enter: the button off, the guide gone, no peak placed), not by a move's folds, and as the standard's window closes (× or a click beside it). The baseline's box undone and redone step by step (the box, its window field and the state together, the live state the history step's), under all and one and in the standard's window; a select undone with the focus on it; Ctrl+Z with the focus still on the box just clicked. A card an undo or a redo brings back (closed by its ×, or added) is brought into view, its head on screen under the sticky bar, in XRPD, DRS, GC and EPR; a tab switched to and a project opened with a card more bring nothing into view. |
| `filelist.test.mjs` | The file list, the same in every module (DRS, XRPD, GC, EPR, SEM), at 1400, 800 and 375 px: grip and include box 26 px each, FILE, SAMPLE LABEL and a note with no header at 3 : 3 : 2 of the width left, actions 58 px, measured cell by cell; the note right of the label, DRS's %R or F(R) (its title in full), the others' empty; no sideways scroll, the label field inside its cell; on a phone the field, while typed in, laid over the note and short of the actions. |
| `gcp.test.mjs` | GC's pressure p of the flow: 1 atm by default (in a new card, for a new file, in a project saved before it), V_m = RT/p (a rate at 2 atm twice the one at 1 atm, at 1 atm 1.01325 times the one at 1 bar); its unit (atm, bar, kPa, mbar, Torr, psi) converting the values shown and written, never the pressure, switched round and back; either decimal mark, 0, below 0 or no number refused as m and Q are; all/one, a file added and one left out; the value and the unit as undo/redo steps; a malformed pressure restored at 1 atm; p in gc_info.csv after T and in mean_rates.csv before it; the parameter table at 1300 px and at 1000 px, nothing over its cell. |
| `narrow.test.mjs` | The app at 320 px, a small phone's width: nothing past the window's right edge and no sideways scroll on Home (no tab, three), Projects, Settings and each module with its fixtures, every card unfolded (elements and text runs; what a box of its own clips and fixed layers left out). The top bar keeps the brand's mark alone; the tab strip is about a tab wide (111 px), scrolls inside itself to the tab on show, and each tab and the + are reachable; the home's two tiles stand one under the other (up to 357 px). At 340, 360, 390 and 479 px the bar keeps the brand's mark alone, its padding and gaps tightened, and its strip is at least a tab wide (120 px), the tab on show whole in it; at 480, 768 and 1400 px the bar is as in v503 (16-px side padding, 8-px gaps, the brand's name in full); the tiles side by side from 358 px. |
| `plots.test.mjs` | Every plot SVG of each module (DRS, XRPD, GC, EPR) with its fixtures, every card unfolded and stepped once, hashed and compared with `tests/golden/<module>.json`. A mismatch names the plot; its new markup is written to `tests/out/plots/<module>/`. |
| `composer.test.mjs` | The figure composer of a plot and of an SEM group: opens, exports an SVG (an svg document with the drawing) and a PNG (of the size its footer says), takes the focus (Enter does not press the button behind it), refuses a second composer of either kind while one is open, closes on Escape with the focus back on its button. |
| `csv.test.mjs` | Each module's CSV zip read with an RFC 4180 parser, under the field separator `;` and then `,`, a sample label holding both and a quote: every file parses, is rectangular, holds numbers, and the label comes back whole. The Projects list's CSV of a saved project equals the project bar's. |
| `textdata.test.mjs` | The text reader (`textdata.js`) in Node, no browser: UTF-8 with and without its mark, UTF-16 LE and BE with and without theirs; line ends, quotes (RFC 4180), runs of spaces, a trailing separator; numbers with either decimal mark; the separator found per file (`350,5;0,523`, `350,5 0,523`, a tie going to `,` before spaces); the DRS and GC fixtures written in every dialect read back to the same numbers, three columns and text refused. |
| `textload.test.mjs` | The same dialects and encodings loaded into DRS and GC in one drop beside the fixture, each file to the fixture's numbers (a GC export quoting its `,` decimals included); a file that is not the module's table refused and said; a name already loaded said, and its alert dismissed. |
| `modules.test.mjs` | DRS, GC and EPR. A card unfolded keeps its zoom on the same files and full range, and draws the full range after a file was removed or left out while it was folded, at the width it is laid out at (EPR, GC); a label changed while folded keeps the zoom (GC). DRS: the sample on show followed through a removal before it and a move, the nearest when it is removed itself; a label changed is the card's caption at once, and its undo. GC: an interval bound flipped back to "all" that would end an interval before it starts refused, with the words a value typed is refused with; the flow's temperature T (25 °C, all/one, in `gc_info.csv` and `mean_rates.csv`), the rates at 0 °C over those at 25 °C by 298.15/273.15, a state with no T at 0 °C with its rates as they were, a file added at 25 °C. EPR: a `.DSC` of one point or none refused with why; flat spectra drawn under the global normalisation. DRS: the standard format is the Cary 5000's layout alone, the name on line 1, then `Wavelength (nm)` and `%R` or `F(R)` on line 2 (any separator, decimal mark, case or quotes), the data from line 3: `%R` so, under `;` with `,` decimals and in quotes, loads with no alert; `R%`, `%R` on line 1 or 3, `R %`, `Reflectance (%)`, a JASCO `YUNITS,%R` above `XYDATA` are read as F(R) = (1 − R)²/2R, back to the fixture's F(R), and said ('not a standard format: its header names the reflectance in %'), as is F(R) named elsewhere than on line 2; a file with no header read as F(R) and said, as is one whose columns' header names neither under a line naming R% (`Operator,R%` above `Wavelength (nm),KM`); the points that are no physical value (R outside 0–100 %, R = 0, F(R) < 0, NaN, past the doubles) left out and counted; a file with none left refused with why; the raw file downloaded as it came. DRS, the Cary 5000's own `%R` export (its layout: the name above the header, trailing commas, CRLF, 800 down to 200 nm, the instrument's footer) beside a standard F(R) export, with no alert, and a file of no standard format, with its warning: the file list's note, right of the label with no header, says `%R` or `F(R)` (its title in full; `F(R)` for a project with no reading kept); F(R) the conversion of the values written; the Results' top, F(R) and R (%) against λ side by side and the log plot under them at 2φ : 1; the R (%) plot giving the values back (and, for an F(R) file, R whose F(R) is the file's), its CSV `reflectance_R.csv` too, a file left out of both; its figure composer opening. Malformed projects: every value of a DRS, GC and EPR state put in as `null`, a string, an object in turn, restored as a project is opened: no throw, no page error; a file with nothing to show left out, said, its per-sample settings with it. |
| `db.test.mjs` | The form a module state takes in IndexedDB and in a project file (`db.js`), in Node: bytes as base64, a byte array held in several places written once and read back as one array, dates and other typed arrays, the older forms (bytes as arrays, a dangling reference). |
| `sem.test.mjs` | SEM groups by scale, an excluded image deciding nothing about its group's name or the scope selector; a renamed label shown in the navigation, thumbnails, groups and Reference, and undone; in the crop editor a 2-px drag is no edit, a 20-px one moves both linked crops in one undo step. |

## Fixtures

`fixtures.mjs` makes every test file, the same bytes on every run (a seeded generator for
the noise), into a temporary directory removed at the end: XRDML patterns of a cubic
perovskite (5384 points over 10–80° 2θ, Kα₁ and Kα₂, the cell a little smaller from one
sample to the next), GC exports (H₂ and O₂ by injection time), DRS spectra (F(R) with an
indirect gap and an Urbach tail; R in % as a Cary 5000 exports it, with its layout), a
Bruker EPR DSC/DTA pair, Tescan-like TIFFs. The one file kept as it is,
`fixtures/SrTiO3.cif`, is the phase the Rietveld test refines.

## The golden hashes

A plot's markup is hashed after the clip ids (random when a plot has no id) are dropped,
numbers rounded to 0.01 and embedded images replaced by their hash. It is taken at
1400 × 900, in UTC, with the fonts loaded, after the redraw a window resize makes: a plot's
first drawing, made while the page is still being laid out, can differ in its last digit
from run to run. The text in a plot is laid out by the browser, so the hashes hold for this
Chromium and these fonts: after a change meant to alter the plots, or on a machine where
they all differ, `npm run test:update` writes them again (look at the plots first: the
markup a mismatch leaves in `tests/out/plots/` opens in a browser).

## Writing a test

`helpers.mjs` has what the tests share: `start()` (server, browser, fixtures) and
`env.page()` (the app in a fresh context, its page errors, failed loads of its own files
and CSP violations collected);
`openModule`, `loadFiles`, `poke` (every card unfolded and stepped), `switchTab`, `saveAs`,
`undo`; `moduleState`, `history`, `idb` (the app's own state and stores); `banner`,
`answer` (the confirm banners); `download`, `exportProject`, `importProject`,
`openProject`; `readZip`, `parseCsv`; `plotSvgs`, `golden`. They wait on conditions (the
dropzone's loading, the tab loader, a row in a list, a banner), not on fixed times.
