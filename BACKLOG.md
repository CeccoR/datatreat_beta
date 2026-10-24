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

## EPR

- **Baseline.** Drawn through the first and last raw points only, so a noisy end
  tilts it. Being reworked by the user; left as it is meanwhile.
- The rest of what the module does not do yet (2D data, a non-linear field axis, spectra
  with and without a frequency on one axis, normalisation by the acquisition's gain,
  scans, power and modulation, the CSV's columns): [EPR-TODO.md](EPR-TODO.md).

## General

- **Long functions.** A handful of functions run to hundreds of lines: `createRietveld`
  (xrd-rv.js, ~1300), `createPeakAnalysis` (xrd-peaks.js, ~1100), `autoRefine`
  (xrd-rietveld.js, ~800), `shapeView` (xrd-shape3d.js, ~750), `drawFigure` (figure.js,
  ~560), and the modules that are one closure each (tauc.js, gc.js, sem.js). Not a bug:
  in them a change acts far from where it is made, the parts cannot be tested one by
  one, and a closure holds on to whatever it once referenced (up to v473 a closed
  Scherrer card stayed in memory through its keyboard listener). Proposed: no rewrite;
  split a function when work takes us into it, its calculations moved out into
  functions the tests can call. Done for `createRietveld` in v513: its calculations in
  `xrd-rv-model.js` and its markup in `xrd-rv-html.js`, both tested in Node, the card's
  wiring left in `xrd-rv.js` (2221 lines to 1412), behaviour byte for byte the same; the
  others when work takes us into them.
- **The browser storage is shared with every page of the same origin.** On GitHub Pages
  the app lives at `ceccor.github.io/datatreat_beta/`, and every project published under
  `ceccor.github.io` is the same origin: any of them can read and write DataTreat's
  IndexedDB (the saved projects and open tabs) and localStorage (settings, palettes,
  presets). Nothing in the app can wall them apart. Proposed: serve DataTreat from an
  origin of its own (a custom domain for the Pages site, or a dedicated host), and until
  then publish nothing else under `ceccor.github.io` that runs untrusted code.
- **Tabs that work while they are not on show.** Only one tab is live: each technique's
  module exists once, bound to the page's fixed ids, and a tab is a project that takes
  its module in turn (tabs.js parks the state it leaves and restores the one it shows).
  So nothing runs in a tab that is not on show, and since v478 leaving a tab while a
  Rietveld refinement runs asks whether to stop it. Two ways out, weighed in v482:
  - *(a) A refinement that carries on in the background.* The run, detached from the
    card instance (cards 1 and 2 serve every XRPD project in turn), keeps going after its
    tab is left and writes each result into that tab's parked state (decoded, updated,
    encoded again, persisted), with its undo history and its "*" decided; coming back
    mid-run re-attaches the card to it (progress, Cancel); closing, deleting, saving or
    exporting the parked project mid-run, and several runs at once, are handled. For:
    small scope (xrd-rv.js, xrd.js, some of tabs.js and sessions.js), the architecture,
    the memory and the switch logic unchanged, the pieces there already (a Worker per
    run, the run object, results by file name). Against: detaching the run from a card
    the next project reuses is delicate; writing into a parked state and its history
    takes care; it helps the Rietveld alone, each later long job needing the same.
    A few days, testing included.
  - *(b) Tabs truly live, one module instance each.* Every tab owns its module's DOM,
    state, undo stack and workers; a switch only shows and hides. For: instant switches
    (no restore, which large XRPD and SEM projects feel), anything can run in the
    background in any module, the parking, the "leaving stops it" question and the state
    swaps for exporting a saved project gone, with whole classes of bugs (v469's save of
    the wrong tab, a card reused across projects, listeners left behind). Against: a
    rewrite — every module is a singleton with fixed ids, document listeners and module
    state, and the core's registries (history, redraw, CSV, busy, the project bar) are
    keyed by module; every open tab keeps its DOM, plots and decoded data in memory (a
    decoded 2048² SEM image is about 8 MB); the shared pickers, composer and banner need
    several owners; regressions in every module, so automated tests first. Weeks; it can
    go in steps (a factory per module with one live instance first, then XRPD alone with
    several), at the price of a mixed model meanwhile.
  To take (a) when waiting on a refinement is what hurts; (b) as a longer rework, after
  the tests, if switch speed or background work in other modules come to matter.
  Assessed after v517, nothing implemented: proto/ASSESSMENT.md (b as frames, b1, built
  and measured beside (a) and a pool of Rietveld workers; each a patch under proto/ ready
  to apply).
