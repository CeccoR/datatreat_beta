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

A full run takes about 1 min 40 s (51 tests, on the machine they were written on). Each
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
| `escape.test.mjs` | Nothing from outside becomes markup. Per module, a payload that would make an `<i data-x>` goes into the file names (F), into every string of the exported project imported back (A), and also in place of every lone number (B); no such element may appear, in the module or in the Projects list. Page errors fail F and A; under B they are reported (a project of nonsense numbers may not draw), not failed on. |
| `tabs.test.mjs` | Closing an inactive tab with unsaved changes and answering Save saves that tab's project, not the one on show (the v468 bug); the unsaved marker after a switch, an edit, its undo, a reload, a value set back by hand; a running job (a busy guard registered by hand): leaving its tab asks, undo waits, "Stop it and leave" stops it, a new project opens beside it when the question is dismissed. |
| `roundtrip.test.mjs` | Files come back byte for byte: an XRPD project saved (IndexedDB, base64), reloaded, exported as a signed `.datatreat` (its SHA-256 signature checked), imported back, a v473–v483 `.json` export (bytes as arrays), a record in the old format (to v470); SEM TIFFs after a reload. Import refuses what is not a project and asks about a file changed after signing or written by a newer version. |
| `rietveld.test.mjs` | A Rietveld refinement of one synthetic pattern with the SrTiO₃ CIF, no standard: asked first, in a modal, the cell found again (a = 3.905 Å within 0.002), Rwp sensible, the module busy meanwhile; Refine all on two patterns cancelled: stopped, nothing written after, not busy. |
| `rvui.test.mjs` | The Rietveld card and the instrumental standard: with no refined standard, Refine and Refine all ask in a modal at the centre of the screen (its three answers; Escape, × and a click beside it answer neither; the primary focused, Tab kept inside, focus back on the button that asked); the standard's Settings show only the rows, start groups and Refinement settings that apply to it, none disabled for good, and the samples' keep every row; while the standard refines with its window closed, every card's Instrumental standard… shows it (a card added meanwhile, Home and back, a project opened and the question dismissed, an undo refused, the window reopened) until the run ends or is stopped. |
| `plots.test.mjs` | Every plot SVG of each module (DRS, XRPD, GC, EPR) with its fixtures, every card unfolded and stepped once, hashed and compared with `tests/golden/<module>.json`. A mismatch names the plot; its new markup is written to `tests/out/plots/<module>/`. |
| `composer.test.mjs` | The figure composer of a plot and of an SEM group: opens, exports an SVG (an svg document with the drawing) and a PNG (of the size its footer says), takes the focus (Enter does not press the button behind it), refuses a second composer of either kind while one is open, closes on Escape with the focus back on its button. |
| `csv.test.mjs` | Each module's CSV zip read with an RFC 4180 parser, under the field separator `;` and then `,`, a sample label holding both and a quote: every file parses, is rectangular, holds numbers, and the label comes back whole. The Projects list's CSV of a saved project equals the project bar's. |
| `textdata.test.mjs` | The text reader (`textdata.js`) in Node, no browser: UTF-8 with and without its mark, UTF-16 LE and BE with and without theirs; line ends, quotes (RFC 4180), runs of spaces, a trailing separator; numbers with either decimal mark; the separator found per file (`350,5;0,523`, `350,5 0,523`, a tie going to `,` before spaces); the DRS and GC fixtures written in every dialect read back to the same numbers, three columns and text refused. |
| `textload.test.mjs` | The same dialects and encodings loaded into DRS and GC in one drop beside the fixture, each file to the fixture's numbers (a GC export quoting its `,` decimals included); a file that is not the module's table refused and said; a name already loaded said, and its alert dismissed. |
| `db.test.mjs` | The form a module state takes in IndexedDB and in a project file (`db.js`), in Node: bytes as base64, a byte array held in several places written once and read back as one array, dates and other typed arrays, the older forms (bytes as arrays, a dangling reference). |
| `sem.test.mjs` | SEM groups by scale, an excluded image deciding nothing about its group's name or the scope selector; a renamed label shown in the navigation, thumbnails, groups and Reference, and undone; in the crop editor a 2-px drag is no edit, a 20-px one moves both linked crops in one undo step. |

## Fixtures

`fixtures.mjs` makes every test file, the same bytes on every run (a seeded generator for
the noise), into a temporary directory removed at the end: XRDML patterns of a cubic
perovskite (5384 points over 10–80° 2θ, Kα₁ and Kα₂, the cell a little smaller from one
sample to the next), GC exports (H₂ and O₂ by injection time), DRS spectra (F(R) with an
indirect gap and an Urbach tail), a Bruker EPR DSC/DTA pair, Tescan-like TIFFs. The one
file kept as it is, `fixtures/SrTiO3.cif`, is the phase the Rietveld test refines.

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
