# Backlog

Things looked at and deliberately left for later. Each says what was found and what
was proposed; nothing here is in the code yet.

## DRS

- **R% or F(R) from other instruments.** The Cary 5000's own export (`Wavelength (nm)` and
  `%R` or `F(R)` on its second line) is read silently from its first two columns; since
  v510 any other file is read, with a warning, from the columns its header names (a
  wavelength in nm, and F(R) or %R), and refused when it names none or names them more
  than one way: a file with no header, a JASCO export (its `YUNITS,%R` line, no column
  named), DataTreat's own `reflectance_FR.csv` (its header `wavelength_nm_<label>,<label>`
  names no F(R)). To be refined (postponed): the headers other instruments write (other
  languages, other units), the Cary's `Y Mode` line read as well, a per-file switch for
  when the reading is wrong (the file list's `%R`/`F(R)` note: a click there could switch
  it), and DataTreat's own exports named so that they load back.

## XRPD

- **Kα1/Kα2 separation without fitting, through the standard.** The classic FWHM is
  measured on the unresolved Kα1+Kα2 doublet, whose splitting grows with angle
  (0.06° at 25°, 0.22° at 75°). With a standard chosen, separate the two "easily"
  (no profile fit — e.g. a Rachinger-type stripping, or the doublet width the
  standard shows at each angle) so the sample's Kα1 width is what is sized. Without
  a standard nothing says how the width varies: no Caglioti can be invented, and
  nothing is done.
- **Peak assignment across samples (crystallite size by peak).** Peaks are matched
  in one greedy sweep in order of 2θ: each joins the current reflection if its
  sample is not in it yet and it lies within √(w² + w̄²) of the reflection's mean
  position (w its FWHM, w̄ the reflection's mean FWHM), else it starts a new one. It
  is order-dependent and compares against the mean only, so two reflections closer
  than about one FWHM can swap peaks. (The Rietveld card's size by peak needs none of
  this: its reflections are its hkl.) Proposed, for the Scherrer card: (1) an optimal
  assignment that keeps the order in 2θ (peaks cannot cross): each sample's peaks
  aligned to one list of reflections by dynamic programming, at the least total distance
  in widths, a peak left unpaired at a cost, in place of the sweep; (2) with a CIF at
  hand (the Rietveld card's phases), each peak given its calculated hkl, so that the
  reflections are named, (110), (200)…, alike in every sample.
- **Free shape: a size distribution and a texture refined with the solid (round 2's open
  limits).** Round 2 (research/free-shape/round2/VALIDATION.md) leaves both as model errors
  the solid takes up: a log-normal size distribution gives every sphere carrying one a
  shape, texture almost every one (49–54 of 60), and both push the solid's family wrong
  beyond any margin; the per-line check flags about half. To try: the solid's scale as a
  log-normal with a refined σ (the line the volume-weighted mean of A(L), tabulated in σ so
  the exact line stays cheap; σ kept only when it pays, as the keep test does), and
  March–Dollase refined with the shape on a low-index axis. Measure whether shape and σ,
  shape and texture separate, on a design with these errors over-represented.
- **Free shape: starts chosen from the peak widths, and the near-equivalent minima
  (prototype, v472).** Tried outside the app, in a copy of the engine that counts the
  pattern's evaluations, on 20 cases with the box and the Sr site refined: the twelve
  samples and 8 synthetic boxes on 36D's grid and state, with Poisson noise. The boxes are
  plates ⟂[110] on the lattice, turned 20° in their plane, near-square and 8° off, a
  ribbon, a needle ∥[111], a block at random and a plate ⟂[100]. Δ below is a χ² over the
  best χ² any run found, divided by χ²_ν.
  - The best minimum is not what fails. The app's 11 starts reach it within Δ 1 on 18 of
    20 cases (36B at 1.5, 38D at 1.4), with 4195 evaluations on average; 40 starts with 6
    refined fully reach it on 20, with 11746. Refined from the true shape, the synthetic
    boxes end no lower (Δ 0–1.1 above). What the data cannot tell apart is the rest: every
    search gives the 12×10×2 nm plate as about 2 × 13–14 × 19–25, and the plate turned 20°
    in its plane fits as well on the lattice (χ² equal within 0.2).
  - Near-equivalent minima are common. For 16 cases, 290 starts each were refined briefly
    and grouped into basins, and the best 14 basins were refined fully. That gives 40
    morphologies (pairs of in-plane families) within Δ 10. Examples: on 33C ⟨111⟩/⟨211⟩
    lies at Δ 0.8 beside ⟨100⟩/⟨110⟩, on 36C three lie at 0.8–3.3, on 37B one at 2.9. The
    app's starts land in 13 of the 40, the lattice frames in 34, an orientation grid in 31
    and 30 random starts in 24.
  - The starts compared (reached = within Δ 1; evaluations are means):

    | Starts | Reached | Evaluations |
    |---|---|---|
    | the app's 11 | 18/20 | 4195 |
    | grid and frames, screened by the peak widths | 20/20 | 2890 |
    | grid and frames, screened by the pattern | 20/20 | 5649 |
    | frames alone, screened by the pattern | 20/20 | 4355 |
    | χ²'s curvature at the sphere (6 starts) | 19/20 | 3516 |
    | the same, faces sharpened 10° → 3° → 1° | 19/20 | 5205 |
    | random, stopped after 5 without a better basin | 19/20 | 3757 |

  Proposed, the widths-screened starts in place of the app's:

  1. Read the peak widths of the isotropic fit (measureWidths), keeping the rows that are
     not unread, overlapped, at an edge, weak or flat. Each row gives its members' normals
     under the Laue group.
  2. Build the candidates:
     - lattice frames: one normal per family of directions with indices up to 2 (on a
       cubic cell ⟨100⟩ ⟨110⟩ ⟨111⟩ ⟨210⟩ ⟨211⟩ ⟨221⟩), with x on each of the 6 simplest
       lattice directions across it;
     - an orientation grid: 3000 super-Fibonacci rotations, kept when 15° apart once the
       crystal's proper rotations and the body's are counted (33 for a box in m-3m).
  3. Give each candidate the template widths, × w0 along x, y, z: a plate 0.5, 0.7, 2.5; a
     needle 1.2, 1.6, 0.4; a ribbon 0.4, 1.2, 2.5, and on the frames the ribbon both ways.
     The square-base box has no ribbon. That makes 243 candidates on a cubic cell.
  4. Screen each candidate with its orientation held:
     - its three widths (log) and a strain X (start 0.05°) are fitted to the rows' widths
       by Nelder–Mead (step 0.35, at most 250 iterations), on χ² = Σ((W − p)/esd)²;
     - p is the FWHM of a sum of equal-area Lorentzians, one per member, each
       0.75|t|/L(t)/cos θ + X tan θ;
     - no pattern is evaluated.
  5. Pick the 6 best distinct candidates: one within 10° of a picked one (symmetry
     counted), with every width within a factor e^0.3, is skipped.
  6. Refine those 6 briefly, then the rest as now: early rejection, the best 3 refined
     fully, polish, exact faces, held on the lattice.
  7. Report the alternatives: final fits grouped by orientation (8°) and widths (e^0.25),
     with the distinct ones within Δ 10 shown as other morphologies with their Δ.

  Open points:
  - measureWidths runs today after autoRefine, in the worker (with isoParams). Here it
    would run before the shape. It is worth checking whether the later reading can reuse it.
  - The 6 picks land in 19 of the 40 morphologies, so step 7 wants more distinct starts
    (one per normal family, say) than the best minimum does.
  - Untested: the sphere-like start kept beside the picks; the square-base box, the
    ellipsoids and other lattices; more than one random seed.
  - The basin of a start was judged on its brief refinement.
  - The same box with its axes permuted can count twice.
- **A broad component under the SrTiO₃ patterns (found in v430).** On the user's twelve
  samples a hump at 29–31° (FWHM 5–7°, 14–37 % of the (110)'s area) lies under the
  pattern, larger the lower the refined Sr occupancy (r −0.89): a disordered, Sr-poor
  part, perhaps the lamellae's surface. The Chebyshev background takes it up only in
  part, and pulled up at 22.7° it takes the weak (100) with it. Proposed: an amorphous
  term in the background (a pseudo-Voigt hump, position and width refined), offered as a
  setting; with it a free-area fit moved (100) from 0–0.2 to 0.2–0.7 of the model.
- **The Ni filter's continuum (found in v430; tried in v432, not kept).** Between the Ni K
  edge (1.488 Å) and Cu Kα₁ the filter passes the tube's continuum: on LaB6_real a step
  under every line, 0.7 per Å of the line's intensity (2–3 % of its area), on its
  low-angle side. The engine draws Kα₁ and Kα₂ only. Tried as a band of wavelengths every
  0.0004 Å from the edge to Kα₁ (and to 1.60 Å), its density fixed at 0.4, 0.8 and 1.2 per
  Å: χ²_ν 4.37 → 4.17 at best (worse above), the first and last lines unchanged, and the
  2–4 % excess on the low side of the lines at 40–90° still there. Not the standard's
  misfit. Not the user's case: research, postponed. When taken up, as an option, worked
  out on synthetic patterns (a known band added) with its density refined and the band's
  shape (the tube's spectrum through the filter).
- **The standard's profile: what else was tried (v432).** The user's LaB6 fitted at χ²_ν
  4.37 (FCJ), its (100) and (110) at 185 and 114 in their windows and its last line 15 %
  short at its top. v432 took it to 2.17 with the Soller model and a sin 2θ shift
  (RIETVELD.md §3.5, §3.7.1). Tried on the way, in a copy of the engine, and not kept
  (χ²_ν of the whole LaB6, with FCJ unless said; last line's window from 24.5):
  - Kα2 with its own Lorentzian width (×1.1–1.35 of Kα1's X; the doublets fitted one by
    one above 100° want 1.09–1.18, as the lines' natural widths differ): 4.35–4.47, last
    line 23.8–22.7.
  - The whole Cu Kα spectrum (Berger's five Lorentzians, TOPAS's CuKa5, each its width):
    4.34–4.55, last line 21–22.
  - The flat sample's aberration (the fixed ½° slit; 1/√ over −α²cotθ/2): 4.86 and 5.45
    (½° and 0.7°): worse.
  - U and W free to go negative: 4.72, worse (W went negative and the Gaussian to its
    floor).
  - A Gaussian term in cot²θ (the X'Celerator's strips off the focusing circle, its 2.122°
    active length): beside the Soller model 2.23 → 2.21, the term refined to 1.1·10⁻⁵ °²
    against the geometry's 1.3·10⁻⁵; real but too small to keep.
  What is left: the (100)'s window at χ²_ν 37, the last line's top 10 % short. Next to try:
  the Ni continuum refined (above), the shape of the Cu Kα lines on top of the Soller model.
- **Rietveld against MAUD (started in v426, on hold).** How far our engine and MAUD
  recover a known truth from synthetic patterns at equal model depth, with a third,
  neutral generator (the Debye scattering equation of atomistic crystallites), to
  guide the calibrations. Done so far, outside the repository: MAUD 3.06 built from
  source and run headless; a model-by-model map with the conversions (MAUD draws a
  Lorentzian sample breadth with √π where π is due, so its Delft sizes and fault
  probabilities need a factor; its log-normal "Distributions" counts the size twice;
  its Warren faults shift no line; it has no free shape, so solids are compared by
  their column lengths along a few directions); runners for both programs, ours also
  with forward differences as MAUD's, and 32 cases; the Debye generator, its checks
  unfinished. Two engine problems it found: a fault probability carried the starting
  cell's error (α·a_start/a_true), fixed in v427 with the calibrations; autoRefine's
  anisotropic-strain stage ended in a wrong minimum on a ZnO case (D 34 nm for 50, a
  strain clipped to 0) that refine() from the same start recovers, to be checked again
  on v427's stages.

## GC

- **Other gases from the raw chromatograms.** The Integration card fits H₂ and O₂ only (one
  window, 268–326 s, with the system peak at 310 s and the baseline step); N₂ and the
  others need windows of their own, as the Python's N₂ window (321–346 s, with the system
  peak at 340 s). With more windows, the chromatogram's initial view and its zoom reset
  (today the H₂/O₂ zone) may change.

## EPR

- **Baseline.** Drawn through the first and last raw points only, so a noisy end
  tilts it. Being reworked by the user; left as it is meanwhile.
- The rest of what the module does not do yet (2D data, a non-linear field axis, spectra
  with and without a frequency on one axis, normalisation by the acquisition's gain,
  scans, power and modulation, the CSV's columns): [EPR-TODO.md](EPR-TODO.md).
- **A pair named after an object's own property is lost (found in v563, as v562 has it).**
  A drop's files are grouped by stem in a plain object (`epr-model.js` `groupsOf`): a pair
  whose stem is a name every object has (`constructor`, `toString`, `valueOf`, …) finds
  that property there instead of a group of its own, its files are written onto it, and
  the pair is neither loaded nor said (no row, no alert); one whose stem is `__proto__`
  writes its files onto every object's prototype (`({}).dsc` is that `.DSC` file from then
  on, until the page is reloaded). Checked on v562 in the browser. Proposed: groups in a
  `Map` (or an object with no prototype), so such a pair loads as any other. Left as it is
  meanwhile (a visible change).

## General

- **Warnings and errors, reviewed by kind.** A map of every message the app shows (276,
  made from the code at v540) proposes for each one: keep, make it error / warn / info
  (the info kind is new in v539), merge it with another that says the same, or drop it.
  It also lists where the modules say the same thing differently.
  `ALERTS-REVIEW.md` keeps the 79 proposed changes and the inconsistencies, in Italian.
  Waiting on the user's choices; the full map is to be made again from the code when this
  is taken up, its line numbers having moved.

- **Long functions.** A handful of functions run to hundreds of lines: `createRietveld`
  (xrd-rv.js, ~1300), `createPeakAnalysis` (xrd-peaks.js, ~1100), `autoRefine`
  (xrd-rietveld.js, ~800), `shapeView` (xrd-shape3d.js, ~750), `drawFigure` (figure.js,
  ~560), and the modules that were one closure each (tauc.js to v555, gc.js to v556,
  sem.js to v557). Not a bug:
  in them a change acts far from where it is made, the parts cannot be tested one by
  one, and a closure holds on to whatever it once referenced (up to v473 a closed
  Scherrer card stayed in memory through its keyboard listener). Proposed: no rewrite;
  split a function when work takes us into it, its calculations moved out into
  functions the tests can call. Done for `createRietveld` in v513: its calculations in
  `xrd-rv-model.js` and its markup in `xrd-rv-html.js`, both tested in Node, the card's
  wiring left in `xrd-rv.js` (2221 lines to 1412), behaviour byte for byte the same. Done
  for `createPeakAnalysis` in v552, the same way: its calculations (the peak search, the
  widths and their uncertainty, the Caglioti fit, the sizes, the settings and the saved
  state read back, the CSVs) in `xrd-peaks-model.js` and its words and markup that need no
  page (the peak table, the Caglioti box, the notes) in `xrd-peaks-html.js`, both tested in
  Node (tests/peaksmodel.test.mjs, against what v551's page wrote), the card's wiring and its
  own markup left in `xrd-peaks.js` (1740 lines to 1120, the function 1368 to 908),
  behaviour byte for byte the same. Done for `autoRefine` in v553, in xrd-rietveld.js itself
  (its stages need some forty of the engine's own functions, and the worker loads the one
  module as before): the function, 796 lines of closures, is now 19 lines of stages, each a
  function of the run's state and of what the stages before it gave (`autoSetup`,
  `startingProfile`, `placePeaks` with `cellStage` and `zeroStage`, `stagePass` with
  `optionalStages`, the detection's `putBackWeak`, `putBackOwn` and `leaveOutNext`,
  `fromLast` with `lastChanges`, `lastValues`, `lastFreeList`, `lastRefine` and
  `lastReport`, and `autoFinish` with `shapeStage` and `autoResult`), the longest 64 lines;
  the file 5258 lines to 5463, the comments on each stage's inputs and outputs. The same
  operations in the same order: on 49 synthetic cases through its branches the result, the
  model after it, the progress, the clock's readings and Math.random's calls are v552's bit
  for bit, 26 of them kept in tests/autorefine.test.mjs (golden digests) beside tests of the
  stages alone. Done for `shapeView` in v554, as for the cards: what it draws, and where, in
  `xrd-shape3d-model.js` (the solid's model and mesh, the ray test, the home view, the
  projection, the shading, the fade mask, the lines and cones cut where the solid hides
  them, the edges, the labels' words and places, the scale bar, the colours and the theme,
  a turn by drag or key, the camera saved and read back, the canvas's size, the words for a
  screen reader), plain functions tested in Node; the canvases and events left in
  `xrd-shape3d.js`, its paint in named stages (`paintSolid`, `paintCones`, `paintEdges`,
  `paintLines`, `paintMarks`) outside the closure, the layers an object of their own: the file
  1385 lines to 622, the function 754 to 262, paint 442 to 23. The same operations in the
  same order: in the browser, 15 solids (plates, needles, sheets, rods, blocks, every
  direction's case) set, dragged, turned by keys, reset, put back, exported, in both themes,
  resized, each again at four other sizes and colours, and two unit cells (whose view shares
  the theme and the triad), 918 steps at each of the pixel ratios 1, 2 and 3, gave v553's
  canvas calls (11.5 million, every number by its shortest round-trip string), pixels, PNGs
  and state; 13 cases kept in tests/shape3d.test.mjs (golden digests of the view's calls on
  a recording page) beside tests of the calculations. Done for `drawFigure` in v555, the same
  way: what the plots' figure draws, and where, in `figure-layout.js` (the ranges and their
  sharing groups, the ticks, linear and log, their minors and words, the sides with room
  beyond them, the margins and the plot area, the tilt of the X names, each panel's frame and
  scales, the grid, the bars, boxes and error bars, a curve's path and symbols, the value
  labels and their ink, the tick marks, the numbers that give way to a neighbour's, the
  category names, the axis titles, the legends, the shared titles, the texture tiles, the
  colours), plain functions tested in Node, handed the model and what they cannot load there
  (the text measured in the figure's font, plot.js's ticks and numbers, utils.js's tilt
  test); the svg left in `figure.js`, painted in named stages (`startFigure`, `paintPanel`,
  `paintSeries`, `paintBars`, `paintBox`, `paintCurve`, `paintAxes`, `paintLegend`): the file
  3797 lines to 3089, the function 558 to 13, the longest stage 42; the model 984. The same
  operations in the same order: in the browser, 162 figures (102 made up: lines, scatters,
  bars, boxes, categories in runs, logs, grids with spans, gaps and sharing groups, every
  legend's place, data labels, textures and divisions, plot areas set by hand; and the plots
  of four modules, from their toolbars and under three sets of settings) at the pixel ratios
  1, 2 and 3 in both themes gave v554's preview, SVG, PNG, footer, controls and kept state to
  the byte; in Node, v554's figure.js against this one on 1500 random figures, 3.7 million
  elements, none different. 24 figures kept in tests/figlayout.test.mjs (golden digests of
  `drawFigure`'s markup on a recording page, figure.js run from its source) beside tests of
  the calculations. Still long in figure.js: `wireControls` (~370), the controls' wiring.
  Done for tauc.js in v556, the first of the modules that were one closure: what DRS works
  out in `tauc-model.js` (the energies, a file read and its points and notes, the
  reflectance, the curves over the points with a value, the window scan and its fit, E_g,
  E_U and the Tauc baseline's part of the subtracted one's error, the suggestion's edge, a
  card's parameters and lines in all and one mode, a project's to v514 and v515 to v519's
  widths in eV, a file taken back in, the panel's state saved and read back, the
  references, the cards of a project from before them, the Results' words, series and
  ranges, the CSVs) and its markup in `tauc-html.js` (the instructions, the cards' bodies,
  a card's section of the Results, the file list's note, the alerts), plain functions tested
  in Node, handed utils.js's and modkit.js's helpers; the page left in `tauc.js`, no longer
  one closure: the instance is a state object (S) the functions at module level take, each
  card's panel a small object over the model with its plot's state (V), its redraw in named
  stages (`drawPanel`: `drawCurve`, `drawFits`, `drawLines`), the Results' and the
  references' functions each of S. The file 2027 lines to 995 (createTauc 1388 to 33,
  makePanel 384 to 36, the longest function 47); the model 1104, the markup 178. Two
  closures that held what was dead let go: a line's drag handlers held the redraw that
  made them (that sample's curves and fits) until the next, and the list of Urbach cards
  a change of the cards had moved stayed after it (closed cards' records with it). The same
  operations in the same order: in the browser, a session of 100 steps (four spectra, the
  Cary's %R export and a file of no standard format among them; every analysis card, its
  exponent, windows, lines dragged, Suggest, all and one, the sample stepped and picked,
  the reference chosen, none and moved to another card, a card moved, switched, folded,
  closed, a label, a file left out and removed, seven undos and four redos, the tab hidden
  and shown, the window resized, saved, reloaded, exported and imported; projects of v514
  in all and one mode, from before the cards, of v515 to v519 in eV, malformed in 270 ways,
  with points of F(R) ≤ 0) gave v555's DOM, field values, state, saved state, history,
  results made and CSVs at every step, and its plots' image exports at eight; in Node, v555's tauc.js run from
  its source against the model on random spectra, states, lines and files, 13213
  comparisons, none different. tests/taucmodel.test.mjs keeps the calculations' tests, the
  fixtures' CSVs as v555's page wrote them and 36 cases as v555's tauc.js gave them (golden
  digests). Done for gc.js in v557, the same way: what a Production Rate card works out in
  `gc-model.js` (the gases, the molar volume and the pressure's units; a file read, its
  injection dates in every form both exports write, day/month found and the dates that do
  not exist left out, the default layout and the alternative .txt export, raw chromatograms
  told by what they hold; a file as a project holds it, a table, raw chromatograms or a
  pair; the replicates' links and samples, the pairs' rows regrouped; a card's parameters
  in all and one mode and the toggle's refusal, its tables, the mean rates over the interval
  and by sample, the Results' series cut to the interval, the plots' ranges, interval lines
  and bars, the CSVs, the state saved and read back from every version) and its markup in
  `gc-html.js` (the instructions with their worked example, a card's body and its section
  of the Results, the parameter table, the legends, the Sample column, the alerts under the
  drop zone and at a card's top), plain functions tested in Node, handed utils.js's and
  modkit.js's helpers; the page left in `gc.js`, no longer one closure: the instance a state
  object (S), each Production Rate card a state object (C) over its parameters (P), its
  table's fields wired by named functions (`wireDelay`, `wireUnit`, `wireNorm`, `wireNums`,
  `wireBounds`, `wireDates`, `wireRows`), its redraw in stages (`compute`: `computeTables`,
  `renderGasSel`, `renderPlots`, `updateRegression` with `drawData`, `drawIntervals`,
  `drawResultPlots`, `drawBarChart`); the Integration cards (gc-integ.js) as they were. The
  file 1780 lines to 786 (createGc 1312 to 41, gcCard 860 to makeCard's 41, its parameter
  table 179 to 15 and its wiring, the longest function 41); the model 927, the markup 326. A
  walk through a Sample select (setSample) no longer keeps the files it named, a file removed
  too, until the next choice: it is let go as the list is drawn anew by any other change.
  The same operations in the same order: in the browser, a session of 389 steps (the
  fixtures, a UTF-16 table with blank and n.a. cells and an Analysis column, the alternative
  export, a day/month file, dates that do not exist, month names, a file refused and one
  dropped twice; the alerts dismissed; m, A, Q, T and p shared and per sample, the units,
  mass and area, a value refused, the delay, light-on moved; the intervals per sample, a
  bound refused and an all/one chip refused, rows and lines hovered and picked; the gas
  chips; replicates chosen, walked and regrouped, a head left out and removed, a label;
  undo and redo; a second card folded through a file left out, a label and a resize, closed
  and brought back, moved; raw chromatograms paired with their tables through an
  Integration card, a count that differs and too few injections, calibrated by standards,
  the cards moved, a pair undone and two tables paired; image, table and plot exports,
  saved, reloaded, a second GC tab, a saved project's CSVs; 20 old projects and 220 states
  malformed) gave v556's DOM, field values, state, history, results made, banners, focus,
  downloads and CSVs at every step; in Node, v556's gc.js and this one, each run from its
  source on a page of stubs, through 3000 random sessions (files of every form, pairs,
  states old and malformed, files removed, left out, moved, regrouped and relabelled, Sample
  walks, cards added, folded, closed and moved, results coming in, the tab hidden): 2.2
  million entries each, none different. tests/gcmodel.test.mjs keeps the calculations'
  tests, the fixtures' CSVs as v556's page wrote them and 60 cases as v556's gc.js gave them
  (golden digests). Done for sem.js in v558, the last of the three, the same way: what SEM
  works out in `sem-model.js` (the crop's rules: fitted to an image, resized by a handle,
  typed, re-ratioed, reset, dragged, its handles and what a press takes; the editor's view
  fitted, zoomed and kept; the levels, each normalisation, an image's curve and its key; the
  settings' scope; the linked crop; the alerts' lines; a file read as the list holds it; the
  groups placed, named, kept in step, moved and reset; what the figure takes of an image,
  and its images for the composer; the state saved and read back from every version; what
  the tab shows beside it; the CSV) and its markup in `sem-html.js` (the alerts, the Image
  box, the groups' boxes, the scope's and the reference's options, the chain on a
  thumbnail), plain functions tested in Node, handed utils.js's and modkit.js's helpers and
  sem.js's own keeping of the files (an image's header, its crop's statistics, the one
  RawRef of its bytes); the page left in `sem.js`, no longer one closure: what the files are
  made into and the reading worker as they were, the instance a state object (S) the
  functions at module level take, its wiring in named functions (`wireLoading`,
  `wireThumbs`, `wireEditor`, `wireCrop`, `wireGroups`, `wireGroupDrag`, `wireIntensity`,
  `wireIntChoices`), the editor drawn in two (`drawEditor`, `drawCrop`). The file 1765 lines
  to 1226 (createSem 1323 to 40, the longest function now; the next 24); the model 719, the
  markup 92. The same operations in the same order: in the browser, a session of 257 steps
  (the three fixtures and ten images more: 8 and 16 bits, pixels made square in both, a
  warning, an image under 64 px, one with no magnification, a big-endian file, one at the
  top levels, names with markup; files refused, skipped and dropped twice, the alerts
  dismissed, undone and redone; the image chosen by the arrows, the keys, a thumbnail and
  the list; the crop typed (a comma, letters, past the edges, under 64 px), every ratio,
  dragged by every handle free and locked, moved out of the image, a click's jitter, hovered
  by a mouse and a finger; Zoom area, the wheel, Pan, Fit and a double click, the zoom kept
  through a resize; links, Link all and Unlink all with an image smaller than the crop;
  every normalisation, the reference, values refused, the image's own correction, the
  Default boxes, a group's scope and back; files left out (the reference among them),
  relabelled, moved, downloaded and removed; groups renamed, emptied, scaled, added, removed
  and reset, images dragged into an empty group, into a new one, onto their own and nowhere,
  by a finger held and one that scrolled; the figure composer opened, edited, exported as
  SVG and PNG, undone while open, its group reset away; the CSVs, saved, exported, reloaded
  with a zoom kept, a second SEM tab reading while hidden; 45 old and malformed states) gave
  v557's DOM, field values and fields flashed invalid, every canvas's pixels, state,
  history, results made (utils.js kept), banners, focus, layers, the composer, downloads and
  CSVs at every step, 5397 fields, none different (v557 against itself, none either); in
  Node, v557's sem.js and this one, each run from its source on a page of stubs recording
  every markup, value, style, class, attribute and canvas call, through 1200 random sessions
  of 80 steps (images of every kind dropped, refused and twice, one at the top levels in 300
  of them; states as saved, old and malformed; the crop typed, re-ratioed, reset and dragged
  by every handle; the view zoomed and panned; links, the settings and their scope; the
  groups edited and images dragged between them; the list's files removed, moved, left out
  and relabelled; the alerts dismissed; undo and redo; the tab hidden, shown and resized;
  time passing; the CSV, what it shows): 37 million entries each, none different. Eight
  mutations of the new code (a crop rule, the histogram's normalisation at the top levels,
  the outline's order, a note of the Image box, a key of a state read back, the groups'
  order, the zoom kept, the alerts' order) were each caught: seven by the browser session,
  six by the Node sessions, six by the new tests (the normalisation's by the tests alone: a
  65535th of the grey, which the 8-bit image does not show). tests/semmodel.test.mjs keeps
  the calculations' tests, the fixtures' CSV as v557's page wrote it and 60 cases as v557's
  sem.js gave them (golden digests). Of the three modules named above none is one closure
  now. Done for `createRietveld`'s wiring in v559, the same way (its calculations and markup
  had gone in v513): what the card's state does in `xrd-rv-model.js` (a phase added and
  removed, the results of files no longer loaded dropped, a group held, a Refinement entry
  taken or refused, what a run takes as it starts and its words, the keys its views are
  kept under, the pattern's frame and rows of ticks, the stacked plot, the size chart's note
  and points, a peak picked and those marked, Williamson–Hall's points and range, the state
  saved and put back, what it shows beside it) and its markup in `xrd-rv-html.js` (the
  instructions, the card's frame and its section of the Results, the settings window, the
  legends, the chips, the solids' boxes, the results' box), plain functions tested in Node,
  utils.js's helpers handed in; the page left in `xrd-rv.js`, no longer one closure: the
  card a state object (S) the functions at module level take, its run in named functions
  (`refine`, `laneHooks`, `written`, `progressed`, `press`, `stdFirst`, `cancel`), its views
  (`draw`, `drawPlot`, `drawPattern`, `drawStacked`, `drawSizes`, `sizePlot`,
  `renderSolids`, `renderWidths`, `drawWH`, `renderResults`, `renderPhases`, `renderCell`)
  and its wiring (`makeSettings`, `wireSettings`, `wireCifs`, `wirePhaseList`,
  `wireButtons`), the listeners in their order. The file 1465 lines to 1235 (createRietveld
  1204 to 12, the longest function now `cardState`'s 51, its state's fields with their
  notes, the next 28); the model 705 lines to 1012, the markup 249 to 450. The same
  operations in the same order: in the browser, a session of 168 steps (four patterns, one
  plate-like; CIFs dropped and picked, refused, UTF-16, a name with markup, downloaded,
  ticked off, removed and undone; Refine and Refine all asking about the standard, every
  answer; the standard loaded, its CIF and the built-in LaB6 chosen, its settings, refined;
  every sample refined, the widths' rows hovered and picked, the size chart by peak and by
  sample, every download; the settings: every mode and depth, the start and its groups,
  every Refinement field (refused, with a comma, at its default), automatic, the size line,
  the normalisation, Defaults, Escape, the backdrop, undo and redo inside; from the last
  result; a free cylinder kept, its PNG, the solid and the cell turned; Cancel, a double
  click, undo during a run, the standard cleared, refined first and cancelled while waited
  for; Clear, Clear all; files relabelled, left out, stepped through the list, removed; the
  card folded, switched to Scherrer and back, a second card added, refined, closed and
  undone, renamed; the CSVs, saved, exported, reloaded, a second XRPD tab refined; 23 old
  and malformed states) gave v558's DOM, field values, canvases' pixels, state, history,
  kept results, banners, the question's window, focus, downloads and CSVs at every step:
  45025 fields, none different (v558 against itself, none either; each result's time and
  duration masked); in Node, v558's xrd-rv.js and this one, each run from its source on a
  page of stubs recording every markup, text, value, property, style, class, attribute,
  dataset write, listener, Plot call (its numbers to the last bit), 3D view's call and
  download, the workers' answers the real engine's (cached by payload), through 1000 random
  sessions of 100 steps (a standard's card and one or two samples'; patterns added, removed,
  left out, relabelled, moved, stepped; CIFs of every kind; the settings in every field;
  runs started, answered, cancelled, double-clicked, let through a few messages at a time,
  undone; Clear; the views clicked; states malformed; the tab hidden and resized; the CSVs,
  shows): 9.4 million entries, none different. Eight mutations of the new code (the
  stacked plot's offset, the gap between the rows of ticks, the order of the groups held,
  χ²'s decimals, the order the listeners are added in, the standard's progress rounded
  down, the order of what the card shows, the results of a file removed kept) were each
  caught by the Node sessions, six by the new tests (not the listeners' order nor that of
  what it shows) and four of the five run in the browser session (the file it removes had
  no result left); the other three act only on what that session does not record.
  tests/rvmodel.test.mjs keeps the state's and markup's tests and 60 cases as v558's
  xrd-rv.js gave them (golden digests). Done for the Integration cards' `createInteg`
  (gc-integ.js) in v560, the same way: what the cards work out in `gc-integ-model.js` (the
  method as a project holds it and its key, v544's results' keys read as v545's, a result as
  the store keeps it; the calibration read back; the raw chromatograms and the calibration's
  tables read once per file; the results taken in, saved and written into the states that
  hold their file; what the job integrates; the entries a card shows and their results under
  the method or the one before it; the standards' names, rows and lines; a gas's
  concentration by the standards' line or the GC software's scale, what Analysis takes of a
  sample; the suspicious rule; the chromatogram over its residuals, the run overview and the
  point nearest the pointer; the status line and the alerts' facts; the CSVs; the
  calibration window's files told by what they hold and paired, a level as typed, a gas's
  line and its levels; the card's state saved and put back) and its markup in
  `gc-integ-html.js` (the instructions, the card's and the calibration window's bodies,
  Windows, Peaks, the status, the alerts, the notices, the legends, the chips, the window's
  files, warning, rows, fit and lines), plain functions tested in Node, utils.js's,
  modkit.js's and plot.js's helpers handed in; the page left in `gc-integ.js`, no longer one
  closure: the instance a state object (S), each card one (C) and its calibration window one
  (W), which the functions at module level take: the job (`ensure`, `later`, `run`, `ran`,
  `runFailed`, `stop`, `paint`), the card's wiring (`makeCard`, `wireNav`, `wireCard`,
  `cardApi`) and drawing (`draw`, `drawPair` with `drawChromPanel` and `drawResidPanel`,
  `overlayOn`, `drawOverview`, `paintHl`, `paintMethod`, `paintValues`, `paintStatus`,
  `paintAlerts`), the window's (`calWindow`, `onCalDrop`, `wireCalEdits`, `onLevel`,
  `wireCalNav`, `selPaint`, `drawStd`, `paintWindow`, `paintFits`, `drawCalGas`), the
  listeners in their order. The file 1346 lines to 715 (createInteg 1189 to 14, its card
  1026 to makeCard's 15, the calibration window 277 to 16, the longest function now 26); the
  model 777 lines, the markup 270. The same operations in the same order: in the browser, a
  session of 136 steps (a table alone, then paired with its raw chromatograms; pairs whose
  counts differ, an injection out of proportion at the rule's edge, a spike, a glitch zone, a
  column ending early, the .txt export in ppm; raw chromatograms alone and two of them paired
  by their grips, a broken file refused; the selectors' arrows, keys and lists; the overview
  hovered and clicked, its gas and y; a window's edge refused, too short, stopped before its
  run and integrated again, reaching a neighbour, dragged, undone and redone, Default; the
  card folded; every download; the calibration window: a lone file waiting, its partner, a
  count that differs, files that are neither, already loaded, levels typed with a comma and
  refused, a row unticked and picked, ← →, its list, ppm, both intercepts, its downloads and
  CSV, Escape, undo and redo, a file removed; a second Integration card, moved and closed; a
  file left out and relabelled; a resize; saved, exported, reloaded with nothing fitted again,
  a second GC tab; an old calibration with no table named by its table after one whose count
  differs; 12 old and malformed states) gave v559's DOM, layer, selectors' lists, field
  values, state, history, kept counts, banners, focus, downloads (SVG, PNG, zip, project) and
  CSVs at every step: 2312 fields, none different (v559 against itself, none either; gc.js's
  tables made or taken from its keeper by the garbage collector's timing, their sum
  compared); in Node, v559's gc-integ.js and this one, each run from its source on a page of
  stubs recording every markup, text, value, property, style, class, attribute, dataset
  write, focus, listener, timer, frame, Plot call (its numbers to the last bit), svgEl,
  selector update, guard and flash, the history patched, the workers' answers the real
  engine's through the real pool (cached by chromatogram and method), through 1000 random
  sessions of 80 steps (rows of every kind added, removed, left out, relabelled and
  unpaired; cards added, folded, moved and closed; the tab hidden; the selectors, the
  overview and its chips; edges typed and dragged, Default; Re-integrate and Stop; results
  coming in one or a few at a time, failing, timers and frames run; the calibration window's
  drops, levels, rows, unit, intercepts, files removed, keys, closed; states and results put
  back, v544's and malformed; what gc.js asks): 2.1 million entries each, none different.
  Eight mutations of the new code (the rule's 10 % made 11 %, the panels' edge, the words of
  a Stop, the hovered point's shade, a level below zero taken, the standard shown after a
  drop, the history's step before the draw, the order the listeners are added in) were each
  caught by the Node sessions, five by the new tests (not the last three, the wiring's), five
  of the six run in the browser session (not the standard after a drop: its drop is made with
  none loaded) and the standard after a drop by the golden cases run through that
  gc-integ.js. tests/integmodel.test.mjs keeps the calculations' and markup's tests and 60 cases and three
  scenes as v559's gc-integ.js gave them (golden digests). Done for `createPeakAnalysis`'s
  wiring (xrd-peaks.js) in v561, which v552 had left one closure of 908 lines: what the card
  works out goes to `xrd-peaks-model.js` with its calculations (the fields: a value typed, a
  width as written kept exact, the store, a width's hint in points, the λ preset; the
  processing's keys; what the plot draws, its curves, the peaks' marks and their colours,
  the guide moved by a key; the Results' stack and the size chart's layout; a chip switched,
  the removed peaks brought back, a peak's ×, the per-sample arrays the file list keeps
  aligned, a state taken, what the card shows beside it), its markup to `xrd-peaks-html.js`
  (the instructions, the card's and the standard's, the Results' section, the table with no
  peak, the legends); the page left in `xrd-peaks.js`, no longer one closure: the instance a
  state object (S), its add-peak mode one (S.A), which the functions at module level take
  (`makeState`, `apiOf`, the fields' `guardFields`, `wireNotes`, `wireModes`, `wireFields`,
  `wireNav` with their handlers, `readInputsToStore`, `writeStoreToInputs`, `syncHints`; the
  processing; the plot's `drawAnalysisInto`, `highlightPanel`, `buildInteractiveMarks`; the
  table's `renderTable`, `paintTable`, `wireRows`; the Results' `drawStackedResults`,
  `renderSizeChart`, `drawSizeBarChart`, `drawBoxes`; the add-peak mode's `wireAdd`,
  `drawGuide`, `setAddMode`, `confirmAdd`, `onAddKey`), the listeners in their order. The
  file 1120 lines to 882 (createPeakAnalysis 908 to 10, the longest function now 33, apiOf);
  the model 645 lines to 919, the markup 118 to 290. The same operations in the same order:
  in the browser, a session of 184 steps (fields set with no file; four patterns, one at
  another step; every field typed, with a comma, refused, emptied, below its least; the
  baseline's box, every chip both ways, the normalisations, the λ presets and a custom λ;
  the selector's arrows, keys and list; rows hovered and picked, the marks hovered and
  clicked, a peak removed, placed by the pointer and by the keys, Escape, a key in a field
  and on a button, ↺, undo; zoomed; every download; by peak and by sample; the standard
  loaded, edited, its peaks removed down to two, one placed, closed while armed, two files
  dropped; a second card armed while the first is folded, named, switched to Rietveld and back, closed,
  undone; a file left out, removed, added; a resize; saved, exported, reloaded, a second
  tab; 15 old and malformed states) gave v560's DOM, every plot's range, entries and marks,
  field values (with each field's exact width and guard), state, history, kept counts,
  banners, focus, downloads and CSVs at every step: 39133 fields, none different (v560
  against itself, none either); in Node, v560's xrd-peaks.js and this one, each run from its
  source on a page of stubs recording every markup, text, value, property, style, class,
  attribute, dataset write, focus, listener, frame, Plot call (its numbers to the last bit),
  svgEl, selector update and guard, through 1000 random sessions of 80 steps: 4.0 million
  entries each, none different. Ten mutations of the new code (a hint's rounding, the
  stack's offset, the hover's reach, the size label's spacing, a peak removed twice, the
  words with no peak, the listeners' order, a chip's text after the fields, ↺ clearing the
  hover, the guide's readout offset) were each caught: nine by the Node sessions (not the
  peak removed twice: no removed peak has a × to click), six by the new tests, five by the
  golden cases run through each tree's xrd-peaks.js, four by the browser session (the
  others act on what it does not reach or record). tests/peaksmodel.test.mjs keeps the
  calculations' tests, the wiring's and the markup's, and 40 cases as v560's xrd-peaks.js
  gave them (golden digests). Done for `createFig` (fig.js) and `createDeck` (cards.js) in
  v562, one closure of 552 lines and one of 515. What the Custom module works out goes to
  `fig-model.js` (a file's table read and kept by its bytes, the roles and the series they
  make, the titles, what a series plots and its keeper, an axis's title, a file and a card as
  a project holds them, the state saved, the series named and coloured, the trace list's
  order, rows and steps, the plots' series that still are, the file on show and the files
  with fewer columns, a plot's series plotted, an operation typed, Add series' files and
  what Done gives, an XY plot's range and error bars, the bars, the boxes and their layout,
  a plot's CSV), its markup to `fig-html.js` (a card's instructions and body, its series'
  rows, the legends, the Data card's head, table and warning, the Add series window); what
  the deck works out to `cards-model.js` (the kinds offered, a record made, a kind and an id
  a state may hold, a record read and saved, the names settled and a name typed, the name
  field's width, the menu's place, the scroll that brings a card back into view, a move's
  places and order, the fold's timing and the box a card grows from), its markup to
  `cards-html.js` (a card, the menu's kinds, the fold button's words). The page left in
  `fig.js` and `cards.js`, no longer one closure: the Custom instance a state object (S),
  the deck one (D), and the kinds' menu one (K), which the functions at module level take
  (fig.js: `makeState`, `kitHooks`, `deckHooks`, `apiOf`, `wireDrop`, `wireData` with
  `onRole`, `onNameIn`, `onNameKey`, `traceList` and `traceCb`, `removeTrace`, `rename`,
  `renderData`, `paintTable`, `rolesChanged`, `paintPanel`, `buildCard`, `onNorm`, `onDel`,
  `onOp`, `wirePick`, `openPick`, `closePick`, `drawCard`, `drawXY`, `drawBars`, `drawBoxes`;
  cards.js: `makeDeck`, `apiOf`, `buildCard`, `mount`, `unmount`, `placeCards`, `wireCard`,
  `leave`, `unghost`, `later`, `stepEnd`, `revealNow`, `quiet`, `setFold`, `startMove`,
  `followMove`, `endMove`, `refreshNames`, `add`, `remove`, `onAdd`, `switchKind`, `load`,
  `loadOne`; the menu's `openMenu`, `closeMenu`, `placeMenu`, `wireMenu`), the listeners in
  their order, the deck's exports (`createDeck`, `cardInfo`, `fileSafe`, `nameDownloads`) as
  they were. fig.js 776 lines to 493 (createFig 552 to 12, the longest function now 24,
  traceCb), its model 400 and markup 100; cards.js 692 to 691 (createDeck 515 to 5, the
  longest now 26, leave), its model 97 and markup 39. The same operations in the same
  order: in the browser, the Custom module end to end (121 steps: six CSVs, one refused and
  one twice, the Data card's arrows and list, roles of every kind, the roles alike, names
  typed, Escape, Tab, emptied; the trace list left out, coloured, a palette, relabelled,
  moved, a trace removed and undone; XY, bar and box cards, Add series' Done, Cancel,
  Escape, a click outside, a file's box; normalisations, operations typed with a comma,
  refused, the same value, an exponent; zoomed; a series taken out; renamed, switched,
  folded, moved, closed, undone and redone; the composer's figure saved and undone; every
  download; saved, exported, reloaded, a second tab; 14 old and malformed states) gave
  v561's DOM, every plot's range and entries, field values, state, history, kept counts,
  banners, focus, menus, downloads and CSV export at every step: 2541 fields, none
  different (v561 against itself, none either); and the cards in DRS, XRPD, GC, EPR and
  Custom (215 steps each run, the motion not reduced and reduced: "+" and its menu, a kind
  switched, renamed, folded, moved and pressed by the grip, closed, undone and redone, cards
  brought back below the window, steps taken while another's animations are held, saved,
  reloaded, tabs switched, a second tab, 24 old and malformed states) gave v561's DOM, the
  animations made (their keyframes and timing), state, history, focus and scroll at every
  step: 4515 fields each, none different reduced; not reduced, two scrolls after a card
  moved by its grip, 2 px apart, as v561 itself gives either from one run to the next
  (v561 against itself, none different either way otherwise). In
  Node, v561's fig.js and cards.js and these, each run from its source on a page of stubs
  recording every markup, text, value, property, style, class, attribute, dataset write,
  focus, listener (the document's and the window's too, with their signals), element made,
  moved and cloned, animation made, cancelled and finished, microtask, frame and scroll, Plot
  call: through 1000 random sessions of 80 steps each (1.6 and 1.5 million entries), none
  different. Fourteen mutations of the new code were each caught by the Node sessions, eight
  by the new tests, three by the golden cases run through each tree's page, six by the
  browser sessions (a repeated name's suffix, the menu's gap, the reveal's margin, an XY
  plot's padding, the words for series left out, a name typed in place drawing the head
  anew; the others act on what they do not reach or record).
  tests/figmodel.test.mjs and tests/cardsmodel.test.mjs keep the calculations' and markup's
  tests and 40 cases each as v561 gave them (golden digests). Done for `createXrd` (xrd.js),
  `createIodo` (iodo.js) and `createEpr` (epr.js) in v563, closures of 488, 407 and 245
  lines. What the XRPD host works out goes to `xrd-model.js` (a file's scans made patterns,
  their arrays made once, a file of a project read again from its bytes and the note when its
  data moved, a file and a project as a restore takes them, a project from before the cards
  migrated, a kind's settings, the files read and lost, the sample on show, the cards'
  records, the per-sample slots, a run's results and instruments patched into the history,
  the cards' states, what the tab shows), its markup to `xrd-html.js` (the standard's
  windows and file, the alerts of a drop there, on the samples' zone and of a restore);
  Iodometry's to `iodo-model.js` (a kinetics file read in four steps and kept by its bytes,
  the injection, the alignment and the reading, the calibration and its window's draft, a
  trace's results and read-outs, the state, the plots' ranges, the readings' layout, the
  CSVs) and `iodo-html.js` (the calibration's summary and window, its rows and fit, the
  legend); EPR's to `epr-model.js` (a pair read: the .DSC, the axis, the .DTA's values, the
  spectrum, why not; a drop's files by stem; a spectrum kept; a file and a card as a project
  holds them; the width typed and its points; the stacking, the plot's options, the CSV's
  columns) and `epr-html.js` (a card's instructions and body). The page left in each, no
  longer one closure: the instance a state object (S) the functions at module level take
  (xrd.js: `makeState`, `apiOf`, `destroy`, `shows`, `onDismiss`, `slots`, `fileCallbacks`,
  `removeAll`, `onDrop`, `addPattern`, `afterFilesChange`, `step`, `makeStd`,
  `stdPeaksHost`, `stdRvHost`, `stdModal`, `onStdDrop`, `setStd`, `openStd`, `closeStd`,
  `syncRv`, `busyOf`, `holder`, `deckHooks`, `buildCard`, `cardHost`, `dropCard`,
  `syncResults`, `named`, `snapshot`, `restore`, `restoreStd`, `redrawTab`, `exportXrdZip`;
  iodo.js: `makeState`, `kitHooks`, `apiOf`, `restore`, `onDrop`, `wireNav`, `wireParams`,
  `takeField`, `paintAnalysis`, `drawAnalysis`, `drawMarks`, `wirePlot`, `pointAt`,
  `onGuide`, `onPlotClick`, `drawResults`, `drawReadings`, `drawAll`, `makeCal`, `openCal`,
  `readDraft`, `sync`, `closeCal`, `onCalClick`; epr.js: `makeState`, `kitHooks`,
  `deckHooks`, `apiOf`, `restore`, `redrawTab`, `onDrop`, `buildCard`, `onNorm`,
  `onSmooth`, `showW`, `syncPts`, `updateEpr`, `drawCard`, `cardCsv`), the listeners in
  their order, the sub-tools (xrd-peaks.js, xrd-rv.js) and the kit and deck given the same
  hooks. xrd.js 700 lines to 550 (createXrd 488 to 18, the longest function now 24, onDrop),
  its model 253 and markup 60; iodo.js 626 to 435 (createIodo 407 to 12, the longest 17),
  its model 351 and markup 54; epr.js 398 to 257 (createEpr 245 to 10, the longest 22,
  drawCard), its model 235 and markup 33. The same operations in the same order: in the
  browser, each module end to end (XRPD 82 steps: patterns, a file of three scans (one not
  of 2θ, one running down, the sample's name), refused files, one twice, a scan removed and
  its file dropped again, the alerts dismissed; the cards' arrows and keys, a kind switched
  and back, a card added, renamed, folded, moved, closed, undone and redone; the standard's
  two windows: opened from each kind of card, instructions, a file dropped, two, one of
  several scans, one refused, removed and undone, closed by ×, Escape and a click beside,
  refined; a CIF, the samples refined, undone and redone; the file list's every step;
  resized; the CSV export; saved, exported, reloaded, a second tab; 11 old and malformed
  states. Iodometry 104 steps: three kinetics files (a ';' one with decimal commas and
  minutes, one tab-separated with no names), two refused, one twice; the selector's arrows,
  keys and list; the reading time and the prominence typed (a comma, refused, emptied, the
  same), Suggest; the plot hovered, left and clicked; the calibration's window in each mode,
  its fields refused and typed, standards added and removed, Enter, Apply, Cancel, ×, a click
  beside, Escape; the file list; every download; saved, reloaded, a second tab; 11 old and
  malformed states. EPR 80 steps: pairs of doubles, floats and shorts, both byte orders,
  complex data, no frequency, refused ones, a lone half, a stem twice; the normalisations, the width typed (a comma, refused, emptied, an
  exponent, Escape); a second card, renamed, folded, moved, closed, undone; the file list;
  every download; saved, reloaded, a second tab; 11 old and malformed states) gave v562's
  DOM, every plot's range and entries, canvases, field values, state, history, kept counts,
  banners, focus, menus, downloads and CSV export at every step: 1722, 2184 and 1680 fields
  (17590, 11421 and 7500 items), none different (v562 against itself, none either). In
  Node, v562's modules and these, each run from its source on a page of stubs recording
  every markup, text, value, property, style, class, attribute, listener, focus, element
  made, Plot call (its arrays by digest), keeper's counts and the history's commits (the
  XRPD host's panels recording stubs: every ask of their host and what it answered),
  through 1000 random sessions of 80 steps each: 3.40, 2.02 and 1.69 million entries, none
  different. Nineteen mutations of the new code were each caught by the Node sessions,
  twelve by the new tests, ten by the golden cases run through each tree's page, twelve by
  the browser sessions (the others act on what they do not reach or record: the order of
  listeners or of writes within a step, a file whose stem is loaded, an instrument of
  another file's bytes). tests/xrdmodel.test.mjs, tests/iodomodel.test.mjs and
  tests/eprmodel.test.mjs keep the calculations' and markup's tests and 40 cases each as
  v562 gave them (golden digests). Still long (v563): `wireControls` (figure.js, 372).
  The others when work takes us into them.
- **Iodometry: a file whose bytes cannot be read ends the whole drop (found in v563, as
  v562 has it).** The drop reads each file's bytes (`file.arrayBuffer()`, iodo.js `onDrop`)
  outside the guard that refuses a file it cannot read: a file gone from the disk after it
  was picked (or any other read error) rejects the drop's promise, an unhandled rejection
  (a page error). The traces of the files read before it are in the module but nothing of
  them is drawn (the list and the cards as they were before the drop), no alert says why,
  no step is taken; the files after it are not read; the traces show at the next change (checked on v562 in the
  browser: three files, the second's read failing: no row, one trace in the state, one
  history entry; the next drop shows two rows). XRPD and EPR refuse such a file with the
  reason and load the others. Proposed: the read inside the guard, the file refused with
  why. Left as it is meanwhile (a visible change).
- **A card's kinds' menu left open through an undo (found in v562, as v561 has it).** A
  card's title opens the kinds' menu; Ctrl+Z (or Ctrl+Y) while it is open loads the step
  without closing it, and a kind then picked in it switches the record the menu was opened
  for, which the step may have taken away: where its card is gone (an added card undone), the
  pick throws (TypeError on `replaceWith`) and nothing else happens; where its id is back
  as another kind (a switch undone), the card on show is rebuilt for the record no longer in
  the deck, and what is done in it after (a name typed, its panel's fields) no longer reaches
  the state. Proposed: a load closes the menu (or a pick acts only on a record still in the
  deck). Left as it is meanwhile (a visible change).
- **The browser storage is shared with every page of the same origin.** On GitHub Pages
  the app lives at `ceccor.github.io/datatreat_beta/`, and every project published under
  `ceccor.github.io` is the same origin: any of them can read and write DataTreat's
  IndexedDB (the saved projects and open tabs) and localStorage (settings, palettes,
  presets). Nothing in the app can wall them apart. Proposed: serve DataTreat from an
  origin of its own (a custom domain for the Pages site, or a dedicated host), and until
  then publish nothing else under `ceccor.github.io` that runs untrusted code.
- **Number arrays as typed arrays.** The patterns, spectra and curves are plain arrays of
  numbers. Chromium stores a frozen one at 16 bytes an element against 8 (measured for
  v518 in Chromium 141: 400 arrays of 5000 doubles, the heap after a GC; the prototype's
  notes, proto/live-tabs-b2/NOTES-drs.md, are in commit fabb05b), which is why v518
  shares them through a registry instead of freezing them. `Float64Array` would hold them
  at 8 bytes, contiguous, and hand them to the workers without conversion. Against: map,
  filter and slice return typed arrays, JSON writes them as objects, so the code that
  builds them and every saved format would change. To take only if memory comes to need
  it.
