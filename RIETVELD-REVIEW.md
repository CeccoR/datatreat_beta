# Rietveld code review (v425)

This document reports a critical review of all the Rietveld code of the XRPD module, done on v424 (commit 4164b12), and what v425 changed as a result. It covers every module that takes part in a refinement:

- `xrd-data.js` (form factors, anomalous dispersion, masses, element names);
- `xrd-cryst.js` (CIF reading, symmetry from the atoms, reflection lists);
- `xrd-instr.js` (the `.xrdml` header);
- `xrd-broad.js` (WPPM, log-normal sizes, Stephens strain, planar faults);
- `xrd-rietveld.js` (the pattern model, least squares, `autoRefine`, the free shape);
- `xrd-rietveld.worker.js` (the worker and the result lines);
- `xrd-widths.js` (single-peak widths, Williamson–Hall, order tests);
- `xrd-rv.js` (the card);
- `xrd-shape3d.js` (the 3D view of the crystallite);
- the `.xrdml` loading in `xrd.js`.

**How.** The code was cut into eleven slices: five of the engine (`xrd-rietveld.js`), the crystallography, the data and instrument, the broadening models, the worker with the width tests, the card with the 3D view, and one slice that read across the modules for consistency. An independent reviewer read each slice, with `RIETVELD.md` for what the code is meant to do, and tried to reproduce every suspected problem with a script, a derivation or a numerical check. Each finding was then checked by a second, independent reviewer (a skeptic), who wrote scripts of their own and could confirm it, reclassify it or refute it.

**Three classes.**
1. **Errors**: code that is deeply wrong (a wrong formula, sign or index, a wrong result or esd, a crash, a serious inconsistency). All were fixed in v425 (§1).
2. **Imprecisions**: much less serious problems (small mathematical inconsistencies, approximations with a small measurable effect, edge cases, thresholds that look too strict or too loose, misleading but not wrong output, documentation slightly off). They are reported and not fixed (§2).
3. **Calibrations**: every number or rule that was chosen rather than derived from physics, mathematics or the literature (§3).

**Counts.**
- Errors: 11 reported, 11 confirmed, 11 fixed.
- Imprecisions: 88 reported, 86 confirmed, 2 refuted. Nine were reported twice by different reviewers and are merged here, which leaves 77 distinct items. One of them is the same problem as error 9 and is resolved; the old own-evidence rule behind part of another is gone. 76 items stand (§2).
- Calibrations: 402 entries from the eleven reviewers, many of them the same constant seen from different slices. After de-duplication: 254 rows (§3).

**Line numbers** are those of the v425 working tree. Where a row or item names several places, the first is the definition. "§" with a number refers to this document unless it says `RIETVELD.md`.

**v425 as a whole.** The engine suites run before every version gave: `t-unit` 46 of 46 passed; `t-sharp`, `t-synth2` and `t-diag` unchanged; `t-lab6`, `t-sto` and `t-synth` changed only in the last digits (from the `solveLinear` fix, e.g. the LaB₆ zero −0.0345594° → −0.0345593°). The synthetic recovery cases of v424 (WPPM sphere, fcc faults, B per site, Stephens strain) recover their parameters within 1.7 esd. The card's end-to-end suites passed: `rvcard` 25, `rvmodels` 27, `rvshape` 27, `rvtexture` 10, `rvwidths` 21, with no failures.

## 1. Errors found and fixed in v425

### 1.1 The 3D view's cell triad was left-handed, and its arrows pointed against it, about half the time

**What was wrong.** `lattDirection` (`xrd-rietveld.js`) names an axis by its lattice direction and returns R, the Laue operation that takes the direction found to the first member of its family. The drawn cell axes a, b, c are R⁻¹ of the cell's own axes (`cellAxes`). Half of the operations of a centrosymmetric Laue group are improper (det R = −1), and nothing checked which one was taken, so the triad came out mirrored (a × b = −c) whenever R was improper. Separately, each labelled arrow was put on the side of the body axis found, while the direction its label names in that frame could point the other way. The same held for the "across" directions of `latticeAcross`. A comment and `RIETVELD.md` §10.12 said this symptom had been fixed in v422.

**Where.** `lattDirection` (`xrd-rietveld.js`:981), `framedAxes` (:809), `latticeAcross` (:618), drawn by `xrd-shape3d.js`.

**Effect.** Display only: no reported number changed, but the picture and the exported PNG did. Over 200 random orientations per case (SrTiO₃ box and cylinder, rutile box, ZnO cylinder, Pnma box, monoclinic elliptic cylinder), 91–137 triads were left-handed, 98 of 200 to 307 of 600 labelled axis arrows pointed against the triad's axis of the same index, and 77–122 of about 450–520 "across" arrows did too.

**Fix.** `properOp` (:822) returns −R when det R < 0. −1 belongs to every Laue group, and the labels are put in canonical form, so no label changes. `alongLabel` (:828) turns each drawn vector onto the sense of the crystal direction its label names in that frame. `framedAxes` and `latticeAcross` use it, and `lattDirection` returns the proper operation (:1015).

**Verified.** On v425, 1000 random orientations over the five phase and shape pairs gave 0 left-handed triads and 0 of 2600 axis arrows against the triad. The skeptic's run of the same fix found no label changed in 1500 and no line changed except in sign. `freeShape` does not use R, so the fits are untouched.

### 1.2 `solveLinear` solved as if the held linear parameters were 0

**What was wrong.** `solveLinear` (`xrd-rietveld.js`) solves the linear parameters (scales, background terms) exactly for given nonlinear ones. With a subset `which`, it formed the right-hand side from the data alone, Σw·col·y, as if every linear parameter outside the subset were 0, while the calculated pattern (`assemble`) adds those parameters back. Its comment promises the exact conditional optimum.

**Where.** `solveLinear` (`xrd-rietveld.js`:1708).

**Effect.** Synthetic SrTiO₃ with bg1 = −40 and bg2 = 10 held and {scale, bg0} solved: v424 gave bg0 = 142.23, scale = 1.0051 × true, χ² = 3787.68, against the conditional optimum bg0 = 149.23, 0.9981 × true, χ² = 3047.42. The error was latent in the app: under `autoRefine` every non-zero linear parameter is free (left-out scales and an unused 1/2θ term are 0), and inside `refineHeld` a solve is kept only when χ² falls. It was reached through the exported API.

**Fix.** The held non-zero linear terms are subtracted from the data before the solve, on every pass (:1723–1737). The cached background dot products are used only when nothing is held.

**Verified.** The same kind of test on v425 (bg1, bg2 held at their true values) gives scale/true 1.00399, bg0 148.59, χ² 3051.3, identical to Levenberg–Marquardt on the same two parameters. The engine suites changed only in the last digits (LaB₆ 1/2θ term 16400(198) → 16399(198)).

### 1.3 Phase detection kept an absent phase that only took up a broad hump

**What was wrong.** A candidate phase is left out unless its scale is above 3 esd and it has intensity of its own (`ownEvidence`). An absent phase with very broad lines passes both beside an unmodelled amorphous hump: its lines fill the stretches between the real phase's lines, where the own-evidence scale α comes out near 1 by construction, and a single straight background line over all those stretches cannot take up the hump.

**Where.** The end-of-pass test of `autoRefine` (`xrd-rietveld.js`:2540–2568) and `ownEvidence` (:2198).

**Effect.** Synthetic 7 nm SrTiO₃ plus an unmodelled Gaussian hump (80 counts high, 10° wide, at 27°): an absent NaCl was detected in 3 of 3 seeds at 46–48(6) wt %, D = 0.8 nm, its a at the +10.00 % bound and its Ys and Xs at their 10° bounds, with no warning. An absent quartz came out at 33–48 wt %, 0.8 nm. On the user's 37D an absent quartz came out at 72(5) wt %, 0.8(4) nm, and an absent NaCl at 62.2(12) wt %, 3.0(3) nm; the NaCl moved the SrTiO₃ size from 5.4 to 7.8 nm. The same candidates on 33A were correctly left out.

**Fix.** A plausibility test (`implausible`, :2447), applied at the end of each pass when several phases are live (:2547). A significant phase is left out, with the reason in the warning, when:
- a lattice length sits on its ±10 % bound;
- with a standard's profile, its Ys or Xs sits on its upper bound (10°);
- with a standard's profile, its crystallites come out smaller than two of its longest cell edges, or than 1 nm when that is larger.

**Verified.** In the hump case NaCl is now left out ("its cell runs to the ±10 % bound") and so is quartz ("its size broadening runs to its bound"); SrTiO₃ comes out at D = 6.88–6.96 nm. On 37D, absent quartz and rutile are left out (size and strain broadening on their bounds). On 33A the four candidates (NaCl, quartz, rutile, anatase) are still left out. **Limit:** on 37D a NaCl candidate (3 nm, a −0.97 %) passes the significance and plausibility tests, and since neither phase has a line clear of the other's, the own-evidence test drops neither: NaCl stays at 62 wt %. The warning now says that the pattern tells neither whether each phase is there nor their fractions. The truth for 37D is not known.

### 1.4 The own-evidence test dropped present minority phases at 15–36 esd

**What was wrong.** `ownEvidence` looked for a phase's own intensity at the points where it holds at least 2/3 of the calculated Bragg intensity. Beside a broad majority phase, whose Lorentzian tails reach under every line, a minority phase rarely holds 2/3 even at its own peak tops. Where it does (a few points), α and the free straight line are nearly collinear, so α came out NaN or ±0.3: "not told from none". The drop runs only when every phase already passes the 3-esd test, so it overrode any significance.

**Where.** `ownEvidence` (`xrd-rietveld.js`:2198) and the drop at the end of a pass (:2549–2557).

**Effect.** Synthetic 7 nm SrTiO₃ (5000-count peak) plus rutile, refined from the truth: 2, 3 and 5 wt % rutile at 10 nm had their scales at 15, 22 and 36 esd, and removing them raised χ² by 557, 1183 and 3043; 2 and 3 wt % at 20 nm were at 23 and 33 esd, 2 wt % at 30 nm at 27 esd. `autoRefine` left all of them out and reported SrTiO₃ at 100 wt % (for 5 wt % at 10 nm, χ²_ν 1.603 instead of 1.015 with rutile). `RIETVELD.md`'s "5 wt % rutile beside nanocrystalline SrTiO₃ is found every time" held for the 66 nm rutile the rule had been set on. In `t-detect` (66 nm rutile, 8 seeds), 1 wt % was found 0 times and 2 wt % once.

**Fix.** The region is now the phase's clear lines (:2197–2256): its lines above 2 % of its strongest that no line of another phase at least 1/10 as high comes within 1.5 FWHM of (Kα₂ included). α is fitted over ±1.5 FWHM of those lines, with a straight background line for each stretch. The thresholds are unchanged (at least 5 % of the intensity in clear lines, α above 3 esd). When no phase has a clear line, none is dropped, and a warning says so (:2573).

**Verified.** All the synthetic cases are now detected: 2 wt % at 10 nm with W = 0.0182(12), 5 wt % at 10 nm 0.0481(13), 2 wt % at 20 nm 0.0197(8), 5 wt % at 20 nm 0.0497(9), 2 wt % at 60 nm 0.0205(6), 5 wt % at 60 nm 0.0505(6), all at χ²_ν 1.015–1.016 with SrTiO₃ at 6.99–7.00(4) nm. `t-detect`: rutile at 1 wt % found 6 times in 8 (mean W 1.2 %), at 2 wt % 8 in 8 (2.1 %), at 5 and 20 wt % 8 in 8 (5.1 %, 20.1 %); the other `t-detect` cases are unchanged. An absent NaCl on 33A is still left out ("93 % of its calculated intensity lies under SrTiO₃'s peaks, and none of its lines stands clear of theirs").

### 1.5 `findSymmetry` lost operations when the origin was off a symmetry element

**What was wrong.** For each candidate operation, `findSymmetry` (`xrd-cryst.js`) takes the translation t = x_j − R·x₀ from the atoms, snapped to the nearest k/24 when within 1.5·10⁻³, and keeps the operation if every atom maps within 0.01 Å onto one of its kind. Only the snapped t was tested. When t lies within 1.5·10⁻³ of k/24 without being on it, the snap moves every image by up to 1.5·10⁻³ of the cell edge (0.018 Å for a = 12 Å), and a true operation is rejected.

**Where.** `findSymmetry` (`xrd-cryst.js`:785, loop at :811–827).

**Effect.** P1 files shifted by random origins (|s| ≤ 0.1, written to 5 decimals, 200 shifts each): YAG (a = 12.009 Å) lost operations in 67 of 200 and changed crystal system in 3; quartz in 5 (5 of 6 operations, not a group), monoclinic C in 7, corundum in 3, Pnma in 2, anatase in 1. Over the 530 ITA settings at doubled cells, 283 of 2650 shifts lost operations, 140 gave sets that are not groups, some changed system (P42₁2 found orthorhombic, B222 monoclinic), and P6₃ crashed (§1.6). Every operation kept was a true one, so F² and the multiplicities did not change, but the lattice constraint became looser, Laue families split and site orbits were wrong.

**Fix.** The snapped translation is tried first (it keeps the absences exact), then the raw one; the operations kept are de-duplicated on (R, t).

**Verified.** On v425 the sixteen verification P1 files (YAG, quartz, corundum, two monoclinic, Pnma, two anatase, ZnO, SrTiO₃, rutile, a triclinic cell, Mg, NaCl, Si, LaB₆) lose no operation and change no crystal system in 200 random origin shifts each (every set of rotations found is closed). The reviewers found the 530 settings, 1408 special positions and the 42 test CIFs unchanged with the fix.

### 1.6 `classify` crashed on a 6-fold rotation without its 3-fold

**What was wrong.** For the hexagonal system `classify` (`xrd-cryst.js`) needs only a 6-fold, then reads the 3-fold from the operation list. When the set holds no 3-fold the look-up is undefined and `aboutAxis` throws "Cannot read properties of undefined". Such a set is never a group, but it arose from §1.5 and from some cells that are not reduced, where the holohedry keeps the 6-fold and loses its square.

**Where.** `classify` (`xrd-cryst.js`:726, the look-up at :746).

**Effect.** ZnO at three times its cell crashed in 13 of 500 origin shifts, Mg in 1; Mg and ZnO crashed in 144 of 200 non-reduced bases. The CIF could not be loaded, and the message gave no clue.

**Fix.** The 6-fold stands in for the 3-fold when the 3-fold is missing. The constraint then falls back to an isotropic scale, since no conventional basis is found.

**Verified.** On v425, ZnO and Mg at one to three times their cell under random origin shifts give 0 crashes and lose no operation; in 200 non-reduced bases each they give 0 crashes (the lattice symmetry such bases lose is §2.2.2). The 530 standard cells are unchanged.

### 1.7 A named group without operations was accepted when named by its IT number or Hall symbol alone

**What was wrong.** A CIF that names a space group but lists no operations is refused unless its atoms are evidently the whole cell. Without Z the atoms must show the crystal system, the centring and (for a centrosymmetric group) the centre of symmetry the name implies. The lattice letter came only from the H-M symbol, so with an IT number or a Hall symbol alone the centring test was empty, and with a Hall symbol alone the system and centrosymmetry tests were too.

**Where.** `parseCif` (`xrd-cryst.js`:466–486).

**Effect.** Na at 0 0 0 and Cl at ½ ½ ½, formula NaCl, no Z, no operations: named "F m -3 m" it was refused; named by `_space_group_IT_number 225` or by the Hall symbol "-F 4 2 3" it was accepted as two atoms in a primitive cell, which is the CsCl pattern (first lines (100), (110), (111)), with only the generic P1 warning. A P-1 asymmetric unit named by the Hall symbol "-P 1" passed without its inversion.

**Fix.** With no H-M symbol the lattice letter comes from the Hall symbol, and its leading "−" marks a centrosymmetric group. With an IT number alone, a centred group's number (`CENTRED_IT`, :292, from the International Tables; R groups on rhombohedral axes excepted) requires some centring.

**Verified.** On v425 the IT-number-only NaCl is refused ("the atoms lack the lattice centring") and so is the Hall "-P 1" case. Full-cell files named by IT number, Hall or H-M symbol are still accepted, and the 42 test CIFs are unchanged.

### 1.8 The attenuation factors were applied a second time to the `.xrdml` intensities

**What was wrong.** `xrd.js` multiplied `<intensities>` by `<beamAttenuationFactors>`. In XRDML the `<intensities>` are already on the unattenuated scale; only the raw `<counts>` of XRDML 2.x need the factors. GenX, xrayutilities, GSAS-II, xylib and xrdtools all read `<intensities>` as given.

**Where.** The `.xrdml` loader in `xrd.js` (:168–184).

**Effect.** Every point counted through the automatic attenuator came out its factor too high, 10–200×: a standard's strongest peaks turned into spikes, and the scale, F², widths and esds were wrong, as was the single-peak FWHM table. In two public files (refnx 180706_HA_DG2, factor 148; GenX XRDML_attenuation, factor 131.32, schema 1.3 as the user's) the stored intensities are continuous across the attenuator switches; multiplied, they jump by 2.2–2.5 decades (949050 → 396931 as stored, 1.25·10⁸ → 3.97·10⁵ multiplied). The user's three files carry no attenuation factors, so their results were not affected.

**Fix.** The rescaling is removed. The variance keeps the factor, var(y) = y·att (over the counting time for a rate), which is right for corrected intensities. The comments and `RIETVELD.md` §2.1 say so.

**Verified.** The loader now leaves the intensities as stored; the user's files load as before.

### 1.9 The Williamson–Hall esds were not scaled by √χ²_ν

**What was wrong.** `williamsonHall` (`xrd-widths.js`) took the esds of the intercept and slope from the points' own esds only. Every other fit in the chain (the single-peak fit, `refine`) scales its covariance by χ²_ν. So when the points scatter more than their esds allow, which is the case where the card calls the line "an average only", the D and ε esds were far too small.

**Where.** `williamsonHall` (`xrd-widths.js`:268, scaling at :283).

**Effect.** On the user's 33A (SrTiO₃, the standard's profile, isotropic model) WH gave χ²_ν = 57.2 (p = 2·10⁻⁴⁸), and the card and the CSV reported D = 7.99(35) nm and ε = 0.0009(5). The esds consistent with the scatter are ±2.64 nm and ±0.0039. Dropping the (110) point alone moves D to 301 nm. On isotropic synthetic data (χ²_ν ≈ 1) the unscaled esds were right.

**Fix.** The esds are multiplied by √max(1, χ²_ν); χ²_ν and p are unchanged.

**Verified.** On 33A the D esd becomes 0.349 × √57.2 = 2.64 nm; the widths suite of the card passes.

### 1.10 The card lost the file's instrument after a saved state, and refined with the Cu defaults

**What was wrong.** `instrOf` (`xrd-rv.js`) reads the instrument from the file's bytes. The module state goes through `db.js` encode and decode on a tab switch, an app reload or a reopened project, which turns those bytes from a `Uint8Array` into a plain array. `TextDecoder` throws on a plain array, the error was caught, and the instrument became null.

**Where.** `instrOf` (`xrd-rv.js`:96).

**Effect.** Every file whose instrument had not been read before the save (all but the one drawn) was refined with Cu Kα₁/Kα₂ (ratio 0.5), a 240 mm goniometer and no monochromator, with the false warning "No instrument description could be read from the file" and an empty instrument line. With a Co or Mo tube, a Kα₁ monochromator or another radius, the cell, the intensities and the displacement were wrong. On the user's 33A the header happens to equal the defaults, so only the warning and the empty line showed.

**Fix.** The bytes are turned into a `Uint8Array` whatever form they come in (a `Uint8Array`, another typed view or a plain array) before decoding.

**Verified.** The v425 `instrOf`, run on 33A after encode, JSON and decode (the bytes a plain array of 20737), reads λ1 1.540598 Å, λ2 1.544426 Å, ratio 0.5, R 240 mm.

### 1.11 A result refined in one role (standard or sample) was used in the other

**What was wrong.** Results were stored by file name only, and `irf()` took the standard's result whatever role it had been refined in. A file refined as a sample and later chosen as the standard handed its sample fit to every other sample as their instrument.

**Where.** `irf`, `refine` and `refresh` in `xrd-rv.js`.

**Effect.** LaB6_real and 33A refined with SrTiO₃ before a standard was chosen: LaB6_real's result is a SrTiO₃ fit (Rwp 41.12 %, a = 4.15673 Å). Once LaB6_real was chosen as the standard, its panel showed that fit as the instrument ("The samples take this profile and zero as their instrument's"), and 33A refined next took {U 0, V 0, W 0.00091, X 0.00883, Y 0.03396, asym 0, zero 0} instead of the standard's {U 0, V 0.000944, W 0, X 0.02823, Y 0.01758, asym 0.0583, zero −0.03454}. Its displacement came out −0.1009(98) instead of −0.0303(98) (7 esd off) and its a 3.91496(78) Å instead of 3.91596(78) Å (1.3 esd), with no sign of it.

**Fix.** Each result records its role (`standard`, :201); for older results the role is inferred (the built-in LaB₆ alone means the standard, :138). `irf()` ignores a standard's result refined as a sample (:140), and `refresh()` drops any result refined in the other role when the standard changes (:596).

**Verified.** By reading the code paths, and the card's end-to-end suites (all passed).

## 2. Imprecisions (reported, not fixed)

Each item gives what is off and how much it matters. Within each group the items are ordered by impact. The reviewers' line numbers were moved to v425.

### 2.1 Data loading, weights and instrument

1. **Every monochromator is taken as graphite (002), and a Kα₂ is kept behind an incident-beam Kα₁ monochromator.** `xrd-rietveld.js`:1236; `xrd-instr.js`:263, 295–296. The reader records that there is a monochromator, its side and its name, but never sets its angle, so the polarisation factor always uses graphite (002) at λ1 (cos²2θ_M = 0.800). A `<hybridMonochromator>` counts as a monochromator too. For an incident-beam monochromator the file's Kα₂ ratio (0.5) is kept with a warning, although such crystals pass Kα₁ alone. *Impact:* with a hybrid 2×Ge(220) the 20°/80° intensity ratio is off by 5 % (K = |cos2θ_M| = 0.703, a perfect crystal), 18 % (K = cos²2θ_M = 0.495) or about 34 % (K = 0.245, the kinematic or four-reflection value), equivalent to a ΔB of 0.15–1.07 Å² over 10–80°; with a Johansson Ge(111), ΔB −0.02 to +0.14 Å². B, occupancies, texture and weight fractions absorb it. The assumption is documented (`RIETVELD.md` §3.4) but not reported for each pattern. The user's Ni-filtered X'Pert has no monochromator.
2. **The variance floor max(y, 1) is applied in the units of y.** `xrd-rietveld.js`:1217; `xrd.js`:184. For counts the floor is one count. For a rate file (varMul = 1/t) it is 1 cps, that is t counts; for attenuated points, 1/att counts. *Impact:* in cps files, points with fewer counts than the counting time in seconds are under-weighted, by up to a factor t. With t = 12.065 s the weight ratio is 0.083 at N ≤ 1, 0.249 at N = 3, 0.663 at N = 8 and 1 from N = 13. On a pure 5-count background, χ²_ν is 1.21 when the data are given as counts and 0.40 when the same data are given as cps (0.82 against 0.17 at 2 counts). The user's files hold counts. A floor of one count in every unit is σ² = max(y, varMul)·varMul.
3. **"The scales are unbiased" under 1/max(y, 1) weights holds only at moderate counts.** `xrd-rietveld.js`:12–15; `RIETVELD.md` §2.1. The background bias is −1.0 to −1.2 counts per point, as stated. The scale bias, from Monte Carlo runs of 2000–6000 realisations, is +0.01 % (background 200 counts, peak area 20000), +0.04 % (50, 2000), +0.4 to +0.55 % (10, 500), +1.3 to +1.5 % (5, 200) and −4.2 % (2, 100). *Impact:* weak phases on low-count patterns get weight fractions biased by about 0.5–1.5 %, below their own esd. Weighting by the model in the last cycles removes both biases.
4. **XRDML 2.x files (`<counts>`) are refused; pre-set-counts scans and counting-time units are not handled.** `xrd.js`:163, 182; `xrd-instr.js`:278–280. The loader looks only for `<intensities>`; XRDML 2.x stores raw `<counts>`, which would also need the attenuation factors (§1.8). `commonCountingTime` is read without its unit (the header reader converts ms). A "pre-set counts" scan (counts about the preset at every point, with per-point `<countingTimes>`) would load as a nearly flat pattern without a warning. *Impact:* a modern 2.x file cannot be loaded at all (it is reported as invalid). The pre-set-counts case rests on xrdtools' handling; no such file was available.
5. **Kα₂ uses Kα₁'s f′ and f″.** `xrd-rietveld.js`:1231; `xrd-data.js`:19. One line is chosen from λ1 and its F² serves both lines; the tabulated Cu Kα₂ column is never read. *Impact:* for Ho with Cu (Kα₁ lies 23 eV below the Ho L₃ edge; f′ −15.247 against −13.914 e) the Kα₂ |f|² is off by 5.6, 7.9 and 11.6 % at s = 0.1, 0.3 and 0.5 Å⁻¹; for Eu 2.9–4.7 %, Gd 1.0–1.6 %, Dy up to 0.9 %, Yb up to 0.3 %; Sr, Ti, O and La under 0.1 %. Diluted to the Kα₂ third of each line. Documented in `RIETVELD.md` §3.3.
6. **No f′ and f″ for Np–Cf, without a warning.** `xrd-data.js`:424. The Chantler tables stop at U; `fprime` returns 0 for Np, Pu, Am, Cm, Bk and Cf, and the only warning concerns the wavelength. *Impact:* |f|² of the heavy atom about 8 % too high at s = 0 and 10 % at higher s, mostly from the missing f′ (about −4.6 e). The file header states Z = 1–92.
7. **Site labels without a type symbol: a two-letter element wins, whatever the case.** `xrd-data.js`:373, 399. "HO1" (a SHELX-style H on O1) reads Ho, "CO1" Co, "HG1" Hg, "Wat" W, silently. Labels such as "Cn1", "NO1", "Hs1" or "Fm1" give no species, and the site is dropped with a warning, instead of falling back to the one-letter reading. "Ti 4+", "Sr2+1" and "O2-a" read as neutral atoms without the fallback flag. *Impact:* only when `_atom_site_type_symbol` is missing or unreadable.
8. **A missing or invalid 2θ start or end is accepted.** `xrd.js`:166. The test uses the global `isFinite`, for which null is finite. A file with `<listPositions>`, a 2θ `<commonPosition>` (an ω or rocking scan), or a parse failure loads with every 2θ equal to 0 instead of being reported invalid.
9. **A UTF-16 `.xrdml` cannot load, and the comment says the opposite.** `xrd.js`:145; `xrd-rv.js`:101. `Blob.text()` and `TextDecoder()` decode UTF-8 only, so a UTF-16 file is reported invalid. `readXrdmlInstrumentText` would handle the byte-order mark itself if given the bytes. Not silent, and rare.

### 2.2 Crystal structures and symmetry (`xrd-cryst.js`)

1. **The 0.01 Å symmetry tolerance is too tight for 3-decimal P1 files with cells over about 10 Å, and nothing makes the result a group.** `xrd-cryst.js`:785 (also :843, :878). Rounding to 3 decimals moves a coordinate by up to 5·10⁻⁴ of the axis, 0.0065 Å on c = 13 Å. *Impact:* corundum P1 at 3 decimals gives 28 of 36 operations (not a group) and centring P instead of R; 0.02 Å recovers 36 and R. The same corundum cell named "R -3 c" without operations or Z is then falsely refused. Over the 530 settings at doubled cells, 8 lose operations at 3 decimals. Four- and five-decimal files are fine. F² is unaffected (it comes from the atoms); the constraint is looser.
2. **The holohedry, built from matrices with entries in {−1, 0, 1}, loses lattice symmetry in cells that are not reduced, and in the orthohexagonal cell.** `xrd-cryst.js`:603. *Impact:* under random unimodular changes of basis, 420 of 530 settings were found in a lower system (79 of 80 bases for Mg, ZnO, quartz and corundum). hcp Mg given in its C-centred orthohexagonal cell (a, √3a, c) is found orthorhombic with b/a free. Standard settings and spglib primitive cells are all correct. Reducing the cell alone would not fix the orthohexagonal case: the primitive lattice must first be built from the pure translations found.
3. **Special positions written with 2 decimals are multiplied.** `xrd-cryst.js`:500. Images closer than 10⁻³ on every axis are merged, and the first is kept. *Impact:* Mg in P6₃/mmc at (0.33, 0.67, ¼) gives 6 atoms instead of 2 (cell mass 145.8 instead of 48.6). With Z the composition check warns, but the phase loads; without Z it is silent ("Z not given: 6 from the cell contents"). F² of that site and the Hill–Howard mass are wrong. 0.333/0.667 and exact thirds are fine.
4. **The Uij basis is fixed in the starting cell while β follows the current reciprocal lengths.** `xrd-cryst.js`:885; `xrd-rietveld.js`:1150. For the primitive cell of a centred orthorhombic or tetragonal lattice refined through its conventional cell, the invariant subspace in U moves with the axial ratios, and the fixed basis no longer keeps RβRᵀ = β. *Impact:* the site symmetry is broken by about the relative change of the axial ratios: up to 0.5 % for moves of 0.5–1.5 %, 2.9 % (Ic2m, I222) for 3–9 %. Only "Uij per site" on such phases; standard settings are exact.
5. **The composition tolerance max(0.05, 2 %) lets a missing site pass in large cells.** `xrd-cryst.js`:580. *Impact:* Si₄₈O₉₅ passes as SiO₂ × 48 and Y₂₄Al₄₀O₉₅ as Y₃Al₅O₁₂ × 8 (1.92 of 96 O allowed). The relative term also absorbs non-stoichiometric occupancies (O 0.98 in SrTiO₃), which a tighter rule must still allow.
6. **The composition check is skipped, with a misleading message, when Z cannot be inferred.** `xrd-cryst.js`:569–575. Z is inferred from the most abundant formula element only. *Impact:* Sr₁Ti₁ against "Sr Ti O3" without Z returns "No formula (or Z) to compare with" although a formula was given, and nothing is flagged, so a CIF whose O sites were all dropped passes the check.
7. **Magnetic CIFs are read as their asymmetric unit in P1, without a refusal.** `xrd-cryst.js`:187, 380. The magnetic operation tags are not read, and a group named by `_space_group_magn.name_BNS` does not count as named, so the refusal of §1.7 does not apply. *Impact:* a MAGNDATA-style LaMnO₃ file gives 0 operations and 4 sites, with no warning about the symmetry. The comment at :68–69 says the trailing time reversal of a magnetic CIF's operations is accepted, which suggests support that is not there. Rare in X-ray work.
8. **`findSymmetry` scales as N² and runs on the page's thread.** `xrd-cryst.js`:811; `xrd-rv.js`:61, 531, 608. *Impact:* YAG P1 supercells take 25–51 ms (160 atoms), 0.3 s (640 atoms) and 6–6.5 s (1280 atoms, 768 operations), with the page frozen. Usability only.

### 2.3 Pattern model, profile and broadening

1. **The Lorentzian model reads a true sphere 11–58 % too large, while the documentation says it reads it 19 % too small.** `RIETVELD.md`:863, 931, 1236; `xrd-rietveld.js`:352–357; `xrd-rietveld.worker.js`:140. The factor 1.23 = 1.1067/0.9 relates FWHM readings at equal Ys. A least-squares Lorentzian fitted to a sphere's profile follows its tails, not its FWHM, and comes out narrower, so the size reads high. *Impact:* noise-free WPPM spheres (SrTiO₃, 15–120°, the user's instrument) refined with the Lorentzian model read 8 → 8.91, 20 → 24.55 and 50 → 66.41 nm with Xs held at 0, and 9.26, 24.75 and 79.04 nm with Xs free; 10 and 30 nm read 12.32 and 41.74 nm in another run, with a spurious strain of 2·10⁻⁴ and 8·10⁻⁵. Log-normal spheres with a volume-weighted mean of 10 nm read 11.54 (σ = 0.3), 10.68 (0.5), 9.67 (0.76) and 9.37 nm (0.94). So "about what the Lorentzian model's size reads" (§7.4, the worker's tooltip) holds within 7 % only for σ ≈ 0.5–0.95, and applying the documented 1.23 would move a size further off. "True dimensions" for the Lorentzian model's solids holds only under WPPM. The code computes what it defines (K = 0.9); the documents need correcting.
2. **"All sizes use the same K, so their ratios are free of it" is false for WPPM phases.** `RIETVELD.md`:863; `xrd-widths.js`:238, 284. A WPPM size is a diameter, in which K cancels; the peak table and the Williamson–Hall line are Scherrer readings, K = 0.9 on the corrected FWHM. *Impact:* a WPPM sphere of 10 nm gives table sizes of 8.49–8.78 nm and a WH size of 8.70(3) nm; 25 nm gives 21.3–22.2 nm in the table; a log-normal (σ = 0.94, mean 10 nm) gives 10.1–10.7 nm and WH 10.41(9) nm. A user comparing them sees a 12–15 % gap that does not come from the sample. The tooltips state each convention, but nothing says the two kinds of size are expected to differ.
3. **The reflection list's 0.9 margin covers the ±10 % length bounds, not the ±15° angle bounds.** `xrd-rietveld.js`:1279, 1301 (comment at :48–50). An angle moved within its bounds can raise some d by 16–20 %: β 105° → 90° raises d(101) of a monoclinic cell by 16.2 %, and by 27.8 % with a and c at +10 %; mono.cif with β −15° reaches d/d₀ = 1.178, a triclinic cell with γ −15° 1.196. *Impact:* reflections then enter the high-angle end of the pattern without being in the list, with no warning (4 to 136 hkl missing in the tests, depending on how far the cell moved). Nothing is missing for angle moves of 2–5° with the lengths at their start, and a sound refinement does not move an angle further.
4. **The comment says the list's margin is for a shrinking cell; it is for a growing one.** `xrd-rietveld.js`:1274–1276. A shrinking cell moves lines out of the range; the margin serves a cell growing by up to 1/0.9. Comment only.
5. **Very sharp lines with long axial-divergence tails hit the 300-node cap.** `xrd-rietveld.js`:245. Beyond |dMax| ≈ 100–140 H the node sum ripples in the tail. *Impact:* with an asymmetry of 0.058, 0.13 % of the peak at 2θ = 10° (H = 0.005°), 0.29 % at 8°, 1.1 % at 5°, 1.8 % at 4° and 176°, and 3.7–4.5 % at 4° with H = 0.003°. Only synchrotron-sharp lines (H ≤ 0.01°) below about 10° or above 170°; laboratory lines stay within 0.06 %. The comment and `RIETVELD.md` §3.7 justify the cap by cost only.
6. **WPPM's largest FFT (16384 points) under-samples the sharp members of very anisotropic shapes.** `xrd-broad.js`:207, 217. When the cap is reached the step grows instead of the window shrinking. *Impact:* nanosheets 0.8–2 nm thick with laterals of hundreds of nanometres: 500 × 500 nm boxes give 0.12–1.0 % of the peak (1.0 % for a 1 nm sheet with two equal members); a 100 × 100 × 0.8 nm plate 0.06 %. Ordinary shapes and spheres never reach the cap (about 10⁻⁴ of the peak).
7. **The sphere's log-normal table makes the σ derivative noisy at small σ.** `xrd-broad.js`:132, 139. Its 2048 nodes move with σ and are read linearly, so the central difference in σ (step 10⁻⁴) is off by 11 % at σ = 0.05, 4.6 % at 0.1, 1.0 % at 0.3 and 0.25 % at 1. *Impact:* the values and the χ² minimum are unbiased; the σ esd of a single-line fit is 0.75–0.94 times the exact one at σ = 0.05–0.1 for a 100 nm volume-weighted size, and within 1 % at 20–50 nm. The user's 33A (σ = 0.94) is unaffected. A Catmull-Rom readout of the same table would fix it.
8. **The fault-layer spacing search misses some high-index planes.** `xrd-broad.js`:403. Translations with indices up to ±2 do not reach the plane spacing of (570), (580), (790), (270) or (380) in a primitive cell. *Impact:* the spacing is doubled, κ halved and the refined α doubled. The six fault kinds the card offers are unaffected; the API accepts any single-digit plane.
9. **WPPM ticks ignore σ in their width.** `xrd-rietveld.js`:1545. The tick's FWHM is 1.23·Ys whatever σ; it sets `xrd-widths`' grouping (0.2·H), window (±2.5·H), overlap region (±H/2) and fit bounds (0.25–4·H). *Impact:* tick width over the true FWHM is 1.08 (σ = 0.3), 1.18 (0.5), 1.37–1.41 (0.76), 1.56–1.65 (0.94), 1.93–2.19 (1.2) and up to 3.3 at the bound 1.5. Windows are wider and the grouping more lenient; the fit's ×4 limit is never crossed.
10. **The Lorentzian model gives the Kα₂ line the Kα₁ size reading.** `xrd-rietveld.js`:1372, 1489, 1611–1613. Y + Ys is applied at each line's own θ, but a size broadening is the same in d* for both lines, so the Kα₂ size width should scale by λ2/λ1; WPPM and the fault term do. *Impact:* the Kα₂ size width is 0.25 % narrow; Ys comes out about 0.09 % off. GSAS and FullProf use the same approximation.
11. **With a free shape, WPPM ignores the phase's Ys while the Lorentzian model adds it.** `xrd-rietveld.js`:1372, 1532–1544. *Impact:* changing Ys from 0 to 0.3 with a cylinder changes the calculated pattern by up to 2.33·10⁵ counts (peak 5.4·10⁵) under the Lorentzian model and by exactly 0 under WPPM. `autoRefine` holds Ys at 0 in shape runs, so only `calc()` or `refine()` with a hand-set Ys reach it.
12. **The axial-divergence audit leaves up to 0.17 % of the peak, not about 0.1 %.** `xrd-rietveld.js`:309–311. A held node count may be 0.8 times the one needed before a re-run. *Impact:* worst 0.169 % of the peak (2θ = 40°, H = 0.02°, Lorentzian); 0.25 % at 0.75 times.
13. **Axial-divergence comments: the nodes are up to H/2 apart, and the 3-node bound is 0.0096 %.** `xrd-rietveld.js`:237–238, 246, 272. The largest neighbouring spacing is 0.39–0.45 H (median) and at most 0.51 H; H/4 is the mean. The 3-node shortcut reaches 0.0095 % of the peak (0.007 % stated), and the one-node collapse 0.039 % (not stated). The 0.04 % accuracy claim holds (0.043 %). Documentation only.
14. **The Stephens S_j difference step is coarse where ε₀ is small.** `xrd-rietveld.js`:1114. At the start of its stage (Xs 0.02°, S = 0) the S1 column is about 1 % off; 3·10⁻⁴ at Xs 0.05° and 6·10⁻⁶ at Xs 0.3°. Only the first iterations slow down.
15. **The Stephens forms are orthonormal only to their 600-point quadrature.** `xrd-broad.js`:322, 335. The largest mean is 1.1·10⁻⁵ (cubic) to 5.2·10⁻⁴ (triclinic), the largest cross-covariance 1.5·10⁻³ (triclinic). Negligible; exact sphere moments would make it exact.
16. **`RIETVELD.md`: "the broadening depends on the indices' parity, not on the order" is false for ⅙⟨112⟩ and ⅓⟨1-10⟩ faults.** `RIETVELD.md`:988. For fcc {111} ⅙⟨112⟩ faults at α = 0.03, κ(111) = κ(222) = κ(444) = 2.03·10⁻² Å⁻¹ but κ(333) = 0, and κ(200) = κ(400) = 4.7·10⁻² Å⁻¹ but κ(600) = 0. The code follows Warren (the broadening depends on h·R modulo 1); only the sentence is wrong.
17. **`RIETVELD.md`: "about σ = 0.76 the profile is as Lorentzian as the Scherrer model's" holds by one criterion only.** `RIETVELD.md`:936. ⟨L⟩_A/⟨L⟩_V equals the Lorentzian's 0.5 at σ = 0.758, but FWHM/β reaches the Lorentzian's 2/π at σ ≈ 0.66 (0.590 at 0.76). The warning threshold σ ≥ 0.8 rests on the first.
18. **The strain is defined on the FWHM, which the documents do not flag as a convention.** `RIETVELD.md`:850; `xrd-rietveld.js`:1179, 2870. ε = Xs·(π/180)/4 applies 4ε·tanθ to the Lorentzian FWHM. Stokes and Wilson define the apparent strain on the integral breadth, which for a Lorentzian is π/2 = 1.571 times larger; GSAS-II's microstrain is 4 times this ε. *Impact:* a comparison with literature values needs the factor. The four places that use it agree with each other.

### 2.4 Least squares and esds

1. **A dropped Cholesky pivot leaves its partners with conditional esds.** `xrd-rietveld.js`:80, 2011. Of exactly collinear parameters, the later one in the free list is flagged undetermined (esd NaN), and the others keep the esds they would have if it were held. *Impact:* with X and Xs both free (the profile uses X + Xs), the order [X, Xs] gives X = 0.0686 ± 0.0146 and Xs undetermined, the order [Xs, X] the reverse; 0.0146 is the esd of the sum. It needs |ρ| > 1 − 5·10⁻¹¹; `autoRefine` never frees such pairs, so only API calls reach it.
2. **After "no step lowers χ²", a successful linear re-solve resumes the refinement with λ ≥ 10³.** `xrd-rietveld.js`:1974. Twelve failed tries raise λ by 10¹², and max(λ, 10⁻³) keeps it, so the next step is about 10⁻³ of a Gauss–Newton step, passes the 1 % shift test and stops. *Impact:* in a forced test the refinement stopped 3.6 esd from the minimum, at χ²_ν 1.0374 against 1.0116. The branch never occurred on LaB₆, 33A or 37D. Resetting λ to 10⁻³ fixes it.
3. **`solveLinear` is not a full non-negative least squares.** `xrd-rietveld.js`:1726–1750. Negative scales are set to 0 for up to four passes, never re-admitted, and the fourth pass is not solved again. *Impact:* on distinct phases χ² is at most 4·10⁻⁷ (relative) above the exact optimum; on six copies of SrTiO₃ with cells 0.2–0.8 % apart, up to 0.38 % (Δχ² ≈ 12 at χ² ≈ 3100). A solve is accepted only if it lowers χ². The fix of §1.2 concerns the held terms, not this.
4. **`refine()` reports the iterations, time and stop reason of its last axial-divergence pass only.** `xrd-rietveld.js`:1867–1872. *Impact:* on LaB6_real the "full profile" stage ran 27 + 11 + 4 iterations and reports 4; "widths" ran 12 + 1 and reports 1. The stage times and the worker's total are right. Diagnostics only.

### 2.5 Refinement strategy and phase detection (`autoRefine`)

1. **The 3-esd significance test is weak for very broad phases.** `xrd-rietveld.js`:2422. For broad lines the scale and the width are strongly correlated, so scale/esd understates the evidence. *Impact:* 2 nm rutile at 8 wt % beside 80 nm SrTiO₃ (lines 9 counts high and 4° wide on 150 counts) has scale/esd 1.9–3.0 at the truth, while removing it raises χ² by 24–37; it is never detected. A BIC test would reject it too (5·ln 5251 ≈ 43). A limit to state; between 2 and 3 esd a refit without the phase could decide.
2. **The own-evidence α needs more than 10 points, which is not documented, and the warning then says no line is clear.** `xrd-rietveld.js`:2237, 2554–2556; `RIETVELD.md`:784–788. When a phase has clear lines (at least 5 % of its intensity) but 10 points or fewer in them, α is not computed and the phase is left out with "none of its lines stands clear of theirs", which is not what happened. *Impact:* small minority phases on coarse scans. Measured with the v424 region: SrTiO₃ 10 nm with 1.31 wt % rutile at 40 nm (step 0.02°) had 5.5 % of its intensity alone over 4 points and its scale at 10–15 esd, and was left out with that message.
3. **The reflection count that frees U, V and the asymmetry includes left-out phases.** `xrd-rietveld.js`:2176, 2469–2470. `calc()` makes ticks for every phase, whatever its scale. *Impact:* 33A gives 22 with an absent LaB₆ candidate (10 for SrTiO₃ alone). LaB6_real cut to 20–60° has 6 LaB₆ reflections: alone it holds U, V and the asymmetry; with an absent SrTiO₃ candidate the count is 12 and they are freed on the same 6 lines. Only for a standard, or with `instrumentalProfileFree`, with candidates.
4. **The cell-search warning is wrong for a phase found in the first round but not in the second.** `xrd-rietveld.js`:2388. The second round keeps the first round's cell, yet the warning says the file's cell is kept: a synthetic quartz held at −2.55 % read "no minimum within ±3 % of the file's cell, which is kept". `RIETVELD.md` §6.3 describes it correctly. Text only.
5. **The edge rule shrinks the cell search to ±(range − h/2).** `xrd-rietveld.js`:2065. A true factor within half a grid step of ±3 % lands on the last grid point and counts as no minimum. *Impact:* with a step of 1.5·10⁻³, f = 1.0292 is found and 1.0294–1.0299 are not: 0.04–0.075 % of range lost. A lone phase is rescued by the ±6 % retry; in a multi-phase sample the phase is held at its file cell and usually left out.
6. **The width estimate overestimates sharp lines and can pick a background maximum.** `xrd-rietveld.js`:2157–2171. The FWHM is taken on the Kα₁ + Kα₂ sum after a 3-point smoothing. *Impact:* a synthetic LaB₆ line at 30.3° (Kα₁ FWHM 0.034°) reads 0.067–0.169° at steps 0.0084–0.05° (2–5 times); broad lines within 4–7 %. With a strong 1/2θ background the "strongest peak" was taken on the background at 5.08°. Starting values and scan steps only; `autoRefine` recovered in the tests. Not stated in `RIETVELD.md` §6.1.
7. **The zero scan stops short of +0.3°.** `xrd-rietveld.js`:2396. z runs from −0.3° in steps of H/4 and ends at 0.295° (H = 0.07°), 0.285° (0.13°) or 0.200° (0.5°, 5 points). A zero between the last point and 0.3° reads as an edge minimum (not found), while the warning says ±0.3°. Broad standards only.
8. **The scan's parabolic minimum is fitted to Rwp, not to χ².** `xrd-rietveld.js`:2068–2075. Rwp ∝ √χ² biases the vertex toward the central point: on average 5.5·10⁻⁵ in f (at most 7·10⁻⁵) against 6.5·10⁻⁶ for a χ² parabola, with a step of 1.5·10⁻³. The ±h clamp cannot act. Starting cell and zero only.
9. **Failures in the optional stages are silent or misreported.** `xrd-rietveld.js`:2770–2771, 2501, 2532, 2618–2620. If every brief shape trial throws, the warning reads "not supported by the data (ΔBIC about +Infinity …)". If both log-normal starts throw, there is no warning and the result still says "lognormal" (σ = 0, not refined). An explicit texture axis whose trials throw is listed with r = 1 and no esd. Only unexpected exceptions reach these paths.

### 2.6 Free shape

1. **`SHAPE_SOFT` rounds the faces before the widths scale, so its distortion grows with the body's aspect ratio.** `xrd-rietveld.js`:552, 559. *Impact:* rounded over exact width of an in-plane member: disc 1.022, 1.055, 1.13, 1.26 and 1.95 at aspect ratios 2, 5, 11, 20 and 50; square plate 1.036 to 2.170. The brief, full and polish refinements of a nanosheet run on a body whose in-plane widths are up to twice wrong, and the early rejection reads the brief fits; the final numbers come from the exact solid. The comment's "columns cut short by 13 %" for the 26 × 2.34 nm disc is the width increase; the columns are 11.4 % shorter. The effect on which shape the search ends with was not measured.
2. **The early shape rejection ignores the held-on-lattice route.** `xrd-rietveld.js`:2770–2771. The early test asks a brief gain above (10 + dP·ln N)/2; a held body is kept for a gain above 10 + (dP − nR)·ln N. The gap is 5 − 0.5·ln N: 0.74 at N = 5251, so the intended factor 2 of margin is gone, and negative above N ≈ 22 000 (fine steps, synchrotron data), where shapes the full search would keep are rejected early. The early ΔBIC shown is the free model's, about nR·ln N ≈ 17 above the held one: a 12 × 9 nm cylinder (N = 5251) showed "ΔBIC about +8" while its held fit gives −9.0.
3. **The angular esds interpolate Δχ² linearly between doubling turns, which biases them low.** `xrd-rietveld.js`:683. On an exact parabola the estimate is 0.943–1.000 of the true σ (worst at √2 times a trial step). On synthetic discs, interpolating √Δχ² instead raised the esds by 3 and 12 %.
4. **The angular-esd profile re-refines Xs but holds the Stephens S_j, the log-normal σ, the fault probability and the ADPs.** `xrd-rietveld.js`:868. *Impact:* re-refining S1 raises the tilt esd by 5–8 % (1.091 → 1.149°, 2.777 → 2.937°, 3.265 → 3.533°). Together with item 3 the esds were 9–18 % low on synthetic discs (1.091 → 1.185°, 2.777 → 3.280°). `RIETVELD.md` §10.11 says "the strain" is re-refined.
5. **The angular esds use the threshold max(1, χ²_ν), the linear esds χ²_ν, and the documents say χ²_ν.** `xrd-rietveld.js`:676, 2007; `RIETVELD.md`:1396; `xrd-rietveld.worker.js`:239. For χ²_ν < 1 the angular esds are 1/√χ²_ν larger than the linear convention would give (+5 % at 0.9): the safe side. A documentation mismatch.
6. **An elliptic cylinder whose two cross-section axes are not told apart gets no "across" directions.** `xrd-rietveld.js`:964–965. Such a body is one of revolution, but the "lone axis" rule covers ellipsoids only and the cylinder rule needs two turn parameters, so the list is empty and the view draws it at an arbitrary azimuth. Contradicts `RIETVELD.md` §10.10. Cosmetic.
7. **The legacy v420 ellipsoid's grouping test ignores the covariance of the two widths.** `xrd-rietveld.js`:753. Near-degenerate axes are anticorrelated (ρ ≈ −0.9), so z is overstated about 1.38 times (0.97 against 0.70, 2.95 against 2.13), and pairs with a true z of 1.45–2 are not grouped. Saved v420 results only.
8. **Random starting widths spread differently for the legacy ellipsoid and the bodies.** `xrd-rietveld.js`:2681, 2715. The ellipsoid draws eigenvalues as y0²·e^{0.8g}, so its widths spread as e^{0.4g}; the bodies draw widths as e^{0.8g}. Negligible.
9. **The exact-face refit also runs for ball-based bodies.** `xrd-rietveld.js`:2805. Ellipsoids and spheroids are never rounded; the refit costs about 0.4 s of a 19–34 s search and changes nothing. Time only.
10. **A comment claims no first-order shape effect for "any" symmetry.** `xrd-rietveld.js`:2628. True only for cubic phases: for rutile, doubling a deformation doubles the change in the pattern. `RIETVELD.md` §10.5 says cubic. Comment only.
11. **The eigen-solver stops on an absolute threshold.** `xrd-rietveld.js`:602. Matrices with entries below about 10⁻¹⁵ come back undiagonalised; both callers pass normalised matrices, so it is not reached.
12. **Texture and fault specifications: parsing edge cases.** `xrd-rietveld.js`:481, 1092–1095. " 1 1 0", "1 1 0 " and "[1 1 0]" give no texture, silently; a fault "111:1/0<112>" is accepted with f = ∞, and "6/6" (a lattice translation that broadens nothing) too. The card offers fixed options only, so only API calls or hand-edited states reach them.

### 2.7 Single-peak widths and Williamson–Hall (`xrd-widths.js`)

1. **The single-peak sample width is biased up, and its esd too large, when the sample's broadening is purely Lorentzian.** `xrd-widths.js`:83, 90, 131–139. The sample's Gaussian part is bounded at 0 and noise can only push it up. *Impact:* z means of +0.20 to +0.52 with sd 0.74–0.96 for purely Lorentzian samples: +5 % for a sample width 1.3 times the instrument's, +5 to +10 % on strong peaks for Ys = 0.03°; the esd is up to 1.35 times too large. With a real Gaussian part the width is unbiased (z 0.00 ± 0.99). Small, but the engine's own sample model is purely Lorentzian.
2. **Peaks are dropped from the table without a row.** `xrd-widths.js`:216, 233. A reflection with fewer than 15 weighted points in its window, or whose fit fails, is skipped with no flag. *Impact:* synthetic SrTiO₃ (Ys 0.05°) gives all 19 rows at steps of 0.02–0.05°, 3 rows at 0.06° (WH on 2 points) and none at 0.1° ("fewer than three peaks to read (0)", with no reason given).
3. **The single-peak shape gives Kα₂ the Kα₁ sample widths.** `xrd-widths.js`:44–47. The engine evaluates the sample widths at each line's θ. *Impact:* the model's own widths read 0.016 % (22°) to 0.35 % (127°) wide; at 146° the Kα₂ sample width is 2.8 % narrow and the table size drifts by −0.6 to −0.9 %. Data and model predictions are read the same way, so most of it cancels.
4. **`RIETVELD.md` quotes a 33A order verdict that the code does not give.** `RIETVELD.md`:1537; `xrd-widths.js`:298–300. (110)→(220) = 1.111(40) lies outside 1 ± 2σ, so the code says "size and strain", not "a size". Documentation only.
5. **The labels of coincident reflections change order with the noise.** `xrd-widths.js`:243. 330 and 411 of SrTiO₃ read "411/330" in 180 of 200 refined states and "330/411" in 20. Rows are harder to match between files in `rietveld_peaks.csv`.

### 2.8 Worker, card and 3D view

1. **A sample's result is not flagged when the standard it used has been refined again, and the instrumental profile carries no wavelength or radius.** `xrd-rv.js`:140–143, 201, 476; `xrd-rietveld.js`:2340–2346. `irf()` passes {U, V, W, X, Y, asym, zero}, and `autoRefine` applies them in degrees without comparing λ1 or the radius with the standard's. Each sample stores the profile it used, but the card only checks that there was one. *Impact:* after the standard is refined again (another zero, profile or asymmetry), sample results computed against the earlier one stay on show with no note; a standard from another wavelength or radius is used silently, and the size and strain absorb the difference. v425's role check (§1.11) drops results refined in the other role, not stale ones. "Refine all" heals it.
2. **The Stephens ε₀ is labelled "rms over directions", which it is not once ε² is clipped at 0.** `xrd-rietveld.worker.js`:169; `RIETVELD.md`:951, 966; `xrd-broad.js`:281. *Impact:* with Xs = 0.4° and S1 = −3, 19 % of directions are clipped and the true rms is 5.6 % above ε₀; with Xs = 0.2°, S1 = −3, 35 % and +51 %; with S1 = +1.5, 39 % and +15 %. The per-plane lines are right and flag the clipped directions.
3. **The Stephens S_j depend on the CIF's setting.** `xrd-rietveld.worker.js`:169, 185. The forms are built in the file's own Cartesian frame. *Impact:* a primitive fcc Pt file gives q1 = −2.291 along the conventional (100), a conventional file +2.291, so S1 changes sign with the setting in `rietveld_results.csv`. The per-plane strains are invariant. The tooltip also leaves out the 10⁻⁶ factor.
4. **The uncertainty cones are centred on the lattice-direction arrow, not on the measured axis.** `xrd-shape3d.js`:300–330; `xrd-rietveld.worker.js`:313–314. The esd describes the solid's own axis, which can lie up to 10° from the arrow. *Impact:* a cylinder axis 9.69° from [111] with an esd of 4.28° lies outside its own cone; the v421 33A cylinder ("axis 6.7(6)° from [110]") was drawn as a ±0.6° cone about [110]. The "across" directions get the axis's tilt esd as a cone, although the turn about the axis is free. The label does say "x° off axis". Display only.
5. **The Williamson–Hall axis and tooltips call the corrected FWHM "β".** `xrd-rv.js`:390, 395, 436–438. The plotted y is H·cosθ, read with K = 0.9 on the FWHM, so the numbers are consistent; but `RIETVELD.md`:103 reserves β for the integral breadth, and a reader who takes β literally reads D and ε up to 1.06–1.57 times off.
6. **The Williamson–Hall plot always starts y at 0, and x away from 0.** `xrd-rv.js`:407–409. The lower y limit is max(0, …) of a negative number, always 0, so lower error bars below 0 and a negative intercept (where D is undefined) are cut; x starts near the first point, so the intercept Kλ/D is never on the plot.
7. **`fmtEsd` prints too many digits when the esd is 10 or more in the last digit, or rounds up across a decade.** `xrd-rietveld.worker.js`:27–32; `xrd-rv.js`:342. fmtEsd(125.3, 314) gives "125(314)", (13.2, 107) "13(107)" (quoted in `RIETVELD.md` §10.9), (1.5, 0.0096) "1.500(10)" instead of "1.50(1)". Cosmetic.
8. **The 3D labels and the card format the same angular esd differently.** `xrd-shape3d.js`:51; `xrd-rietveld.worker.js`:232–235. An esd of 0.06° reads ±0.06° on the card and ±0.1° in the view; 9.96° reads ±10.0° and ±10°. Cosmetic.
9. **The instrument line prints a Kα₂ for a single-wavelength beam.** `xrd-rv.js`:483. For a Kα₁-only beam the header reader sets λ2 = λ1 and ratio 0, and the line reads "Kα₂ 1.540598 Å (×0)". Cosmetic.
10. **Descending 2θ scans: the ticks before a refinement and the plot ranges assume an ascending axis.** `xrd-rv.js`:234–240, 263–264. With start > end no tick is kept and the plot range is reversed. The engine handles reversed scans; the host module does not either.
11. **A latent crash in the worker's standard branch.** `xrd-rietveld.worker.js`:122. The ΔB lines are built without a list to push to; with per-site or anisotropic ADPs on the standard the whole run would fail. The built-in LaB₆ has no ADP option, so it cannot be reached today.

### Resolved in v425

- **The Williamson–Hall esds were not scaled by the line's own χ²_ν** (reported as an imprecision by the cross-module reviewer, as an error by the widths reviewer): fixed as error §1.9 (`xrd-widths.js`:283).
- **The own-evidence region "≥ 2/3 of the Bragg intensity"** dropped a 1.31 wt % rutile at 10–15 esd: the region is replaced by the clear-line test (§1.4). What remains of that report (the 10-point limit and the wording of the warning) is item 2.5.2.

## 3. Calibrations

### Summary

The eleven reviewers listed 402 calibration entries. Many were the same constant seen from different slices; the cross-module slice in particular repeated the constants of the others. After de-duplication the catalog has **254 rows**. A row is one constant, or a set of values that act together as one rule (for example the four grid sizes of the cell search). A few rows gather numerical guards or display rules of one module, with every value kept. Physical constants and exact mathematics (wavelengths, form factors, π, ln 2, 8π², the TCH coefficients, ⟨L⟩_V = 3D/4 for a sphere, the International Tables) are not listed; conventions are (K = 0.9, the strain on the FWHM).

| Origin | Rows | Meaning |
|---|---|---|
| arbitrary | 146 | chosen with no stated derivation or test |
| convention | 52 | a common choice of the field or of the program |
| tested-synthetic | 22 | chosen, then checked on synthetic patterns |
| derived-but-approximate | 15 | from an argument, with an approximation in it |
| tuned-on-user-data | 11 | set on the user's own patterns or CIF |
| literature | 8 | taken from a publication or a standard |

Of the 146 arbitrary rows, 14 are display constants of the 3D view. Most of the others are numerical guards, display rules, box bounds, starting values, grid sizes and iteration limits, whose effect is on speed, on where a search looks, or on nothing measurable; the rows whose notes give a measured effect on a result are the ones to watch.

v425 changed the catalog only in phase detection. The own-evidence region "≥ 2/3 of the calculated Bragg intensity" (listed by three reviewers, tuned on the user's SrTiO₃) is gone and has no row. Five new constants decide whether a phase is present (`CLEAR_FWHM` = 1.5, `CLEAR_HEIGHT` = 0.1, and the three plausibility rules of §1.3). The 2 % floor and the local straight line of the own-evidence fit now apply per line and per stretch of points (§3.2.9).

### 3.1 Tuned on the user's own data

| Constant | Where (v425) | Tuned on | Risk for other samples |
|---|---|---|---|
| Axial divergence with S = H (one parameter (S + H)/L) | xrd-rietveld.js:205 | The user's LaB₆: a two-parameter version refined its second parameter to 0. | An instrument with very different sample and slit lengths gets a slightly wrong low-angle tail shape; the amount is still refined on each standard. |
| Four axial-divergence audit passes | xrd-rietveld.js:1867 | The user's LaB₆ (asymmetry 0.02 → 0.058, χ² 8 % off; three passes were used). | A standard with stronger asymmetry or sharper lines may need more; a fourth pass that is still behind is not flagged. |
| Cell search: a minimum on the grid's edge, or a flat curve, means "not found" | xrd-rietveld.js:2065 | Absent rutile, anatase and ZnO beside the user's SrTiO₃ had taken up to 74 wt %. | A true cell within half a step of ±3 % is not found (§2.5.5); in a multi-phase sample that phase is held at its file cell and usually left out. |
| Own evidence: at least 5 % of the intensity in clear lines and α above 3 esd | xrd-rietveld.js:2255 | The user's SrTiO₃ pattern with an absent NaCl, and synthetic rutile beside it (v419–v424); kept with v425's clear lines. | A phase whose lines all overlap another's is neither confirmed nor dropped (only a warning). The detection limit shown, 1–2 wt % rutile beside 7 nm SrTiO₃, holds for that pair. |
| SHAPE_SOFT = sin 2° | xrd-rietveld.js:552 | A disc on the user's SrTiO₃ (aspect about 11) that stopped between χ² 6364 and 6427 depending on its start. | Thin plates and needles (aspect 20–50) are searched on a body 1.3–2 times wrong in-plane (§2.6.1). |
| Bound rule in the comparison of two widths | xrd-rietveld.js:899 | A 37D spheroid whose ±14606° esd made a 2.5 nm plate a near-sphere. | Low: it only sets how a width on its bound is compared. |
| SNAP_DEG = 10° | xrd-rietveld.js:980 | Axes found 2–9° from [111] had been named ⟨433⟩, ⟨332⟩, ⟨443⟩ (the source of these fits is not stated; one reviewer read them as synthetic noise). | An axis up to 10° from a simple direction is named by it (the angle is shown), and only such axes are tried on the lattice. |
| Single-peak isolation with the isotropic fit's neighbours | xrd-widths.js:180 | The (200) of the user's SrTiO₃ read 1.08° or 0.83° depending on whose tails were removed. | For a sample with a real shape, the isotropic model's tails taken off neighbouring peaks can bias overlapped widths. |
| Single-peak window ±max(2.5·H, 0.4°) | xrd-widths.js:212 | A broad (310) of the user's SrTiO₃ read 3 % narrow with a straight background over ±2.5 FWHM (which led to subtracting the refined background); the numbers themselves are not justified. | Broad peaks on curved backgrounds; with the 15-point minimum, scans coarser than about 0.055° lose narrow peaks (§2.7.2). |
| Relative-intensity rule | xrd-widths.js:256 | A (212) cut at 80° on the user's SrTiO₃ read 115 %. | Display only. |
| ΔBIC reading bands (10, 30) between solids | xrd-rietveld.worker.js:337 | "Within what the search itself varies on real data", that is, the user's samples. | Text only, but it tells the user how to read differences between solids; the scatter of the search differs between samples. |

**Close to the user's data, though classed otherwise:**
- the v425 detection constants (`CLEAR_FWHM`, `CLEAR_HEIGHT`, the plausibility rules) were set on synthetic patterns built on the user's 7 nm SrTiO₃ and checked on 33A and 37D;
- `SHAPE_STARTS` (10 starts) was checked with 40 more starts on 37D;
- `LN_STEP` was chosen for run time on 33A (15–23 min point by point);
- `B_DEFAULT` = 0.5 Å² applies to every atom of the user's Materials Project CIF, which gives no B;
- the 240 mm radius and the Cu wavelengths of the fallback instrument are the user's X'Pert's;
- the built-in standard is the user's LaB₆ (NIST SRM 660c).

### 3.2 Catalog

Columns: the constant; its value; where it is set in v425 (the first place is the definition); its role; its origin; a note with its justification and its sensitivity. "§2.x" points to the related imprecision.

#### 3.2.1 Data loading and weights (4)

| Constant | Value | Where (file:line, v425) | Role | Origin | Note |
|---|---|---|---|---|---|
| Attenuation factors used only when complete | same length as the intensities and all finite, else ignored | xrd.js:180 | whether varMul carries the attenuation factor (since v425 the intensities are not rescaled) | arbitrary | No warning when a truncated list is dropped: the attenuator variance is then lost. |
| Rate-unit detection | unit matches /cps\|\/s\|per/i | xrd.js:181 | whether varMul includes 1/t (counting time) | arbitrary | Heuristic; XRDML normally writes "counts". Feeds the variance-floor issue of cps files (§2.1). |
| Variance floor | σ² = max(y, 1)·varMul | xrd-rietveld.js:1217 | weights 1/σ² from the observed counts | convention | As GSAS and FullProf. Background about 1 count/point low; scale bias +0.4 to +1.5 % on backgrounds of 5–10 counts/point. The floor is in y's units (t counts for cps files). |
| MIN_POINTS | 10 weighted points | xrd-rietveld.js:47 | buildModel refuses fewer points | arbitrary | Not tied to the number of parameters; catches only degenerate input. |

#### 3.2.2 Instrument and scattering data (20)

| Constant | Value | Where (file:line, v425) | Role | Origin | Note |
|---|---|---|---|---|---|
| Default anode | Cu | xrd-instr.js:228 | wavelengths when the file names neither a wavelength nor a known anode | convention | "By far the commonest laboratory tube"; warned. Everything is wrong if the tube is not Cu. |
| Anode names recognised in the tube name | Cu, Co, Mo, Cr, Fe, Ag, W, Rh (case-sensitive word) | xrd-instr.js:225 | anode when `<anodeMaterial>` is absent | arbitrary | W and Rh are recognised but have no line table, so they fall back to Cu. |
| ANODE_LINES | Cu 1.540598 / 1.544426 / 1.392250 Å; Co, Mo, Cr, Fe, Ag from Bearden | xrd-instr.js:25 | λ1, λ2, Kβ when the file has no `<usedWavelength>` | literature | Bearden, Rev. Mod. Phys. 39 (1967) 78; Cu as X'Pert Data Collector writes it. About 2·10⁻⁵ relative between tabulations. |
| Built-in Cu fallback (CU) | λ1 1.540598 Å, λ2 1.544426 Å, Kα2/Kα1 0.5, R 240 mm, no monochromator | xrd-rietveld.js:27 | instrument when no instrument object is passed (instr null) | convention | X'Pert values (Hölzer et al. 1997 give 1.5405929 / 1.5444274 Å); warned. This was the silent fallback of §1.10. |
| Default Kα2/Kα1 ratio | 0.5 | xrd-instr.js:229, 239; xrd-rietveld.js:1228 | Kα2 weight when the file has no ratio, or one out of range, or λ2 without a ratio | convention | The 2:1 occupancy of 2p3/2 : 2p1/2; measured 0.50–0.53 depending on the anode. |
| Accepted ratio range | [0, 1] | xrd-instr.js:237 | a ratio outside it is replaced by 0.5 | arbitrary | Only malformed files. |
| Accepted wavelength range | 0 < λ < 10 Å | xrd-instr.js:220 | sanity window for `<kAlpha1/2>`, `<kBeta>` | arbitrary | Only malformed files. |
| Default goniometer radius | 240 mm | xrd-instr.js:247; xrd-rietveld.js:1239 | converts the refined displacement (°) to mm | convention | PANalytical X'Pert/Empyrean, as the user's instrument; Bruker D8 is about 250–300 mm, D2 141 mm. Only the displacement in mm scales with it. |
| Monochromator detection | any element whose name contains "monochromator", diffracted side first | xrd-instr.js:263 | switches on the monochromator polarisation | arbitrary | `<hybridMonochromator>` counts as well; the side only drives a warning. |
| GRAPHITE_D: graphite (002) for every monochromator | d = 3.3539 Å → 2θ_M 26.56°, cos²2θ_M 0.800 at Cu | xrd-rietveld.js:28, 1236 | polarisation factor (1 + cos²2θ_M cos²2θ) whenever a monochromator is present | convention | The d is physical; using graphite for every crystal is a choice (monoAngle is never set). A Ge(220) hybrid (K 0.495) gives an 18 % error in the 20°/80° intensity ratio, ΔB ≈ 0.5 Å² (§2.1). |
| Divergence slit unknown or missing | taken as fixed | xrd-instr.js:294 | intensity geometry assumed | convention | The commonest setting; warned. An automatic slit would leave an uncorrected sinθ factor. |
| Slit-type inference | xsi:type, then the name ("auto", "programm", "fix"), then fixed if an angle is known | xrd-instr.js:197 | divergence-slit warnings | arbitrary | Heuristic; warnings only (the model always assumes a fixed slit). |
| λ2 = λ1 tolerance | 1e-6 Å | xrd-rietveld.js:1230 | below it no Kα2 line is added | arbitrary | Numerical guard. |
| Anomalous dispersion line chosen from λ1 | lineForWavelength(λ1), used for Kα2 too | xrd-rietveld.js:1231 | f′, f″ of both lines | convention | Documented (RIETVELD.md §3.3). Kα2 \|f\|² of Ho with Cu off by 6–12 %, Eu 3–5 %, Gd 1–1.6 %; negligible for Sr, Ti, O. |
| Lines with tabulated f′, f″ | Cu Kα1, Cu Kα2, Co/Mo/Cr/Fe/Ag Kα1 | xrd-data.js:19 | the only wavelengths with anomalous dispersion | convention | Energies from XrayDB 4.5.8. Any other λ (W, Rh, In, Ga jet, synchrotron) runs with f′ = f″ = 0, warned. |
| LINE_TOL | 0.002 Å | xrd-data.js:21 | largest \|λ1 − line\| for which that line's f′, f″ are used | arbitrary | Equals 10 eV at Cu, 49 eV at Mo. A synchrotron λ inside it gets the lab line's values. |
| f′, f″ interpolation of the Chantler grid | f′ linear in E, f″ log-log | xrd-data.js:13 | how the table was produced | convention | Differs from XrayDB's spline by up to 0.15 e near edges. |
| Masses of elements with no standard atomic weight | Tc 97.907, Pm 145, Po 209 … Pu 239.052 … | xrd-data.js:343 | cell mass for Hill–Howard fractions | convention | XrayDB's isotopes (IUPAC quotes Pu as [244]): about 2 % in a Pu phase's mass. |
| Element from a symbol or label | two letters win if they spell any element, case-insensitive | xrd-data.js:373 | reading the element of a site | convention | Only labels without a type symbol: "HO1" reads Ho, "CO1" Co (§2.1). |
| Ion without a Waasmaier–Kirfel fit, or fractional valence | neutral-atom f0 (warned) | xrd-data.js:407 | form factor of S⁶⁺, N³⁻, Fe²·⁵⁺ … | convention | As GSAS-II; about Z − q electrons wrong at low s on that site. |

#### 3.2.3 CIF reading and symmetry (xrd-cryst.js) (31)

| Constant | Value | Where (file:line, v425) | Role | Origin | Note |
|---|---|---|---|---|---|
| B_DEFAULT | 0.5 Å² | xrd-cryst.js:13; xrd-rietveld.js:1147 | B of a site whose CIF gives none; start of B per site | arbitrary | "The usual guess for an inorganic solid at room temperature" (no reference). −16 % on F² at 2θ = 80° (Cu). The user's SrTiO3_mp-5229.cif has no B, so every atom of the user's phases uses it unless B is refined. |
| Numerical guards (CIF and symmetry) | mod1 fold: w > 1 − 1e-9 → 0; snapAngle: within 1e-9° of 60, 90, 120 → exact; Echelon thresholds: pivot 1e-8, coefficients below 1e-12 dropped; Reflection-box slack: +1e-9, qmax·(1 + 1e-9) | xrd-cryst.js:46, 637, 897, 945 | rounding hygiene in folding, metric, Uij constraints and enumeration | arbitrary | No measurable effect (all 15006 tested positions give the right Uij dimension). |
| snapT | multiples of 1/24 within 1.5e-3 | xrd-cryst.js:51, 825 | exact translations in CIF operations and in findSymmetry | derived-but-approximate | 1/24 holds every ITA denominator; the 1.5e-3 window reads "0.3333" as 1/3. Since v425 findSymmetry keeps the snapped t only when it still maps the structure (§1.5). |
| Display rules | Display rounding: fractions with denominators 1…24 within 1e-9, counts to 1e-6 / 3 decimals; closureMisses max: 3 | xrd-cryst.js:100, 130 | text of fractions, counts and the missing-product warning | arbitrary | Display only. |
| opKey resolution | t rounded to 1e-3 | xrd-cryst.js:119 | identity of operations (uniqueOps, closureMisses) | arbitrary | A false "not a group" only for unsnapped t near a rounding boundary. |
| Group-symbol parsing rules | "/", −1, −3 or an orthorhombic mirror/glide symbol → centrosymmetric; H-M patterns → system; Hall "−" → centrosymmetric (v425) | xrd-cryst.js:299, 471 | evidence used by the refusal of a named group without operations | derived-but-approximate | From H-M and Hall grammar; CENTRO_IT and CENTRED_IT are ITA tables. Never wrong on 1590 symbol forms; compact symbols read as unknown. |
| First data block | first block with _atom_site_fract_x | xrd-cryst.js:349 | which structure of a multi-block CIF is read | convention | A warning names the block. |
| Missing or invalid cell angle | 90° with a warning | xrd-cryst.js:360 | replaces the angle | convention | A wrong cell if the angle was really missing on an oblique cell. |
| Degenerate cell | V > 1e-6·abc | xrd-cryst.js:365 | refuses angles that close no cell | arbitrary | No effect on real cells. |
| Hexagonal axes of an R group | \|γ − 120°\| < 0.01° (and a = b to 1e-4) | xrd-cryst.js:389, 475 | number of centring translations; expected centring in the refusal | arbitrary | No effect on real files. |
| Displacement-parameter tag order | U tensor if U_11 is present, else B tags; B_iso, then 8π²U_iso, then B_eq | xrd-cryst.js:399 | which ADPs of the CIF are used | convention | B_eq after Fischer & Tillmanns 1988. |
| Dummy atoms | _atom_site_calc_flag starting "dum" | xrd-cryst.js:418 | skips ring centroids and dummies | convention | CIF dictionary value. |
| Species from the label | label used when the type symbol is missing or unknown | xrd-cryst.js:420 | scattering species | convention | A misnamed label can give the wrong element (§2.1). |
| Occupancy fallback | missing, "?" or negative → 1; warning above 1.0005 | xrd-cryst.js:426 | site occupancy | arbitrary | A negative occupancy silently becomes 1. |
| expandAtoms merge tolerance | 1e-3 (fractional, per axis) | xrd-cryst.js:500 | images of a site counted as one position | tested-synthetic | Set so that 0.333/0.667 merges. 2-decimal special positions are multiplied (Mg 6 instead of 2); in Å it scales with the cell (§2.2). |
| H in the composition check | left out when the formula has H and no site does | xrd-cryst.js:567 | composition check | convention | X-rays rarely locate H. |
| Z inference | most abundant formula element; integer r ≥ 1 with \|r − ri\| < 0.02·ri + 0.01 | xrd-cryst.js:573 | Z when the CIF omits it | arbitrary | Fails, with a misleading message, when that element has no atom (§2.2). |
| Composition tolerance | max(0.05, 0.02·expected) atoms per element | xrd-cryst.js:580 | decides that the cell holds formula × Z | arbitrary | The 2 % part also absorbs non-stoichiometric occupancies; one O missing in 96 passes (§2.2). |
| Uniform-ratio test | every element within 2 % of the same ratio | xrd-cryst.js:584 | message wording only | arbitrary | Message only. |
| Holohedry metric tolerance | rtol 1e-4 on G (≈ 5e-5 on lengths) | xrd-cryst.js:601 | which integer matrices count as lattice symmetry | arbitrary | Pseudo-symmetric cells within 5e-5 are promoted; γ = 119.99° loses the 6-fold. |
| Holohedry matrix entries | {−1, 0, 1} | xrd-cryst.js:603 | search space of lattice symmetry | derived-but-approximate | Enough for reduced and conventional cells; non-reduced and orthohexagonal cells lose symmetry (§2.2). |
| same() tolerance | 1e-4 relative | xrd-cryst.js:632 | equal lengths and angles in classify, conventionalBasis | arbitrary | Matches holohedry's rtol. |
| conventionalBasis vector range | indices −3…3 | xrd-cryst.js:663 | lattice vectors searched for the symmetry axes | arbitrary | 0 fallbacks on spglib primitive cells; larger cells fall back to an isotropic scale. |
| Monoclinic setting | β ≥ 90° | xrd-cryst.js:700 | choice of the conventional monoclinic cell | convention | Usual crystallographic convention. |
| Conventional-cell angle checks | 0.01° | xrd-cryst.js:716, 743 | checks that the conventional and standard cells are what the symmetry implies | arbitrary | No effect on real files. |
| centringOf tolerance | 1e-3 (fractional) | xrd-cryst.js:766 | names the centring from the pure translations | arbitrary | No effect (translations are snapped). |
| findSymmetry tolerance | 0.01 Å | xrd-cryst.js:785 | an operation is kept if every atom maps within it onto one of its kind | convention | pymatgen's default symprec. Too tight for 3-decimal P1 files with cells over ~10 Å: corundum 28/36 operations at 0.01 Å, 36 at 0.02 Å (§2.2). |
| Species-and-occupancy key | occupancy to 3 decimals | xrd-cryst.js:797, 847 | which atoms may map onto each other | arbitrary | 0.3334 and 0.3335 count as different kinds; B is not in the key. |
| atomOrbits and siteAdpBasis tolerance | 0.01 Å | xrd-cryst.js:843, 878 | site grouping and site operations for the Uij constraints | arbitrary | Same value as findSymmetry. |
| Absence phase tolerance | \|h·t − round\| > 0.02 → absent | xrd-cryst.js:977 | systematic absences | derived-but-approximate | Forbidden phases are at least 1/6 from an integer; safe with snapped t. |
| Reflection order and representative | equal d within 1e-9·d; representative with fewest negative indices, then the largest | xrd-cryst.js:982 | order and labels of the reflection list | convention | Matches the tables' (110), (210), (221). |

#### 3.2.4 Profile function and its numerics (16)

| Constant | Value | Where (file:line, v425) | Role | Origin | Note |
|---|---|---|---|---|---|
| HG2_FLOOR | 1e-8 deg² (H_G ≥ 1e-4°); "on the floor" within 100× (1e-6 deg²) | xrd-rietveld.js:32, 1840; xrd-widths.js:29 | Gaussian width floor; U, V, W reported on a bound with esd NaN | arbitrary | Numerical guard. Not reached on the user's LaB6 (minimum H_G² 4.1e-5 deg²). |
| WIN_FWHM | 40 FWHM | xrd-rietveld.js:44; xrd-widths.js:50 | half-width of the window in which each line is computed | derived-but-approximate | 0.8 % of a Lorentzian lies beyond 40 FWHM; 1.6·η % of each area is left to the background. xrd-widths hard-codes the same 40. |
| WIN_MIN | 1.5° | xrd-rietveld.js:45 | smallest window half-width (also FCJ, WPPM) | arbitrary | Below H = 0.0375° it sets the window, so the area left to the background depends on H (0.42·η % at H = 0.01°). |
| Gaussian cut | exp(−40) (\|δ\| < 3.80 H) | xrd-rietveld.js:151 | range of the Gaussian part; FCJ node two-pointer | arbitrary | 4e-18 of the peak. |
| FCJ core radius and blend | R = 1.5·spread + 6H, blend over 2H | xrd-rietveld.js:173 | beyond R the node sum is one peak at the mean shift | tested-synthetic | Claimed 0.005 % of the peak; measured 0.0047 % worst over 792 cases. |
| FCJ with S = H | one parameter (S + H)/L | xrd-rietveld.js:205 | axial divergence | tuned-on-user-data | GSAS-II's SH/L convention; a two-parameter version refined its second parameter to 0 on the user's LaB6. |
| Gauss–Legendre root finding | ≤ 100 Newton iterations, \|dz\| < 1e-15 | xrd-rietveld.js:225; xrd-broad.js:59 | nodes of every GL rule | convention | Numerical Recipes start; moments exact to 6e-15. |
| FCJ_MAX_NODES | 300 | xrd-rietveld.js:245 | cap on FCJ nodes per line | arbitrary | Cost cap. Beyond \|dMax\| ≈ 100–140 H the tails ripple by 0.1–4.5 % of the peak (sharp lines below ~10° or above ~170°) (§2.3). |
| FCJ_G3 | \|dMax\|/H < 0.5 → 3 Gauss nodes | xrd-rietveld.js:246 | shortcut for short tails | tested-synthetic | Comment says ≤ 0.007 %; measured ≤ 0.0096 % of the peak. |
| FCJ one-node collapse | \|dMax\| < 0.05 H | xrd-rietveld.js:272 | one node at the mean shift | arbitrary | Up to 0.039 % of the peak, not documented. |
| FCJ node count | n = ⌈4\|dMax\|/H⌉ + 2, at least 4; 24 GL nodes behind the 3-node path; H floor 1e-4° | xrd-rietveld.js:276 | resolution of the axial-divergence tail | tested-synthetic | Profile within 0.04 % of the peak (measured 0.042 %); spacing is about H/2, not H/4 as the comment says. |
| Numerical guards (profile) | gaussOf degeneracy threshold: n2 > 1e-14; FCJ angle guards: \|cos2θ\| < 1e-12 → none, hMax·(1 − 1e-12); FCJ key packing: (k·65536 + r)·4 + j, members ·64; Cylinder near-axis series: s < 1e-3·c; quatOfRot small angle: \|r\| < 1e-12 | xrd-rietveld.js:260, 267, 397, 417, 1493 | avoid 0/0 and singular ends; cache keys; series switch | arbitrary | No measurable effect; the cylinder series and closed form agree to 1e-12 at the switch. |
| FCJ audit tolerance | held count ≤ 3: any increase; else re-run when the count needed exceeds 1.25× the held one | xrd-rietveld.js:311 | when refine() re-runs with fresh node counts | arbitrary | Comment says the profile stays within 0.1 %; measured 0.17 % of the peak (§2.3). |
| FCJ audit passes | 4 | xrd-rietveld.js:1867 | refine passes with fresh node counts | tuned-on-user-data | Introduced after the user's LaB6 (asym 0.02 → 0.058, χ² 8 % off); LaB6_real used 3. A 4th pass still behind is not flagged. |
| ASYM_START | (S + H)/L = 0.02 | xrd-rietveld.js:54 | start of the asymmetry (its derivative vanishes at 0) | arbitrary | "Soller slits of a few hundredths of a radian"; the user's LaB6 went to 0.058. |
| backFade | lines beyond the pattern fade from max(170°, 2θ_end + 1°) over 5°, smoothstep | xrd-rietveld.js:1471 | lines near 2θ = 180° | tested-synthetic | Added after a synthetic ZnO pattern stopped on a step. Patterns to ≤ 168° are unchanged. |

#### 3.2.5 Size, strain and fault models (23)

| Constant | Value | Where (file:line, v425) | Role | Origin | Note |
|---|---|---|---|---|---|
| K_SCHERRER | 0.9 on the Lorentzian FWHM | xrd-rietveld.js:33, 843; xrd-rietveld.worker.js:130; xrd-widths.js:284 | Ys and shape widths → nm; WPPM reading of Ys; single-peak and WH sizes | convention | "As the Analysis card"; Langford & Wilson 1978. Stokes–Wilson gives 0.849 for a Lorentzian sphere. Every Lorentzian-model size scales with it; under WPPM it cancels (D is the diameter). |
| Strain defined on the FWHM | ε = Xs·(π/180)/4, H_L = 4ε·tanθ; 2εd* in WPPM; ε² clamped at ≥ 0 | xrd-rietveld.js:1179, 1595, 2870; xrd-rietveld.worker.js:164 | microstrain from Xs; WH slope | convention | Stokes–Wilson's form applied to the FWHM: 2/π of the integral-breadth apparent strain; GSAS-II's μstrain is 4× this ε. |
| Wavelength in sizes | λ1 (Kα1) everywhere | xrd-rietveld.js:2866 | λ in D = Kλ/(β cosθ) | convention | λ2/λ1 = 1.0025: negligible. |
| Sphere factor in the member widths | w = 0.75·\|t\|/⟨L⟩_V,base | xrd-rietveld.js:587 | any solid's width is that of the sphere with the same ⟨L⟩_V | derived-but-approximate | ⟨L⟩_V = 3D/4 for a sphere is exact; using it to map solids onto Scherrer widths inherits K = 0.9. |
| Sphere FWHM factor | 1.23 (= 1.1067/0.9) | xrd-rietveld.js:1545, 2347 | WPPM window and grid estimate; WPPM start Ys | derived-but-approximate | Exact for one size; ignores σ, so the tick width of a log-normal line is 1.1–2.2× too wide for σ = 0.3–1.2 (§2.3). |
| Largest crystallites for the WPPM grid | +3σ: e^{−3σ + σ²/2} | xrd-rietveld.js:1530 | narrowest component, which sets the grid step | arbitrary | The algebra is exact; 3σ is a choice. |
| Log-normal parametrisation | volume-weighted, ln s ~ N(3σ², σ²); the parameter is the volume-weighted mean | xrd-broad.js:105 | size distribution | literature | Scardi & Leoni 2001; Langford, Louër & Scardi 2000. |
| LN_NODES | 24 GL nodes over [μ − 7σ, min(ln T, μ + 7σ)] | xrd-broad.js:110, 114 | log-normal average | tested-synthetic | Error ≤ 3e-9 (ball, box), 2.2e-7 (cylinder); the mass below −7σ (1.3e-12) is taken as a = 1. |
| LN_STEP | 0.1σ in ln ℓ₀ | xrd-broad.js:110 | per-member Catmull-Rom table of a box or cylinder | tested-synthetic | Chosen for run time (a free solid with log-normal sizes took 15–23 min point by point on the user's 33A); accuracy 3.5e-6. |
| Sphere log-normal table | 2048 points even in ln ℓ₀ from ln 1e-4 to 3σ² + 6σ; linear readout | xrd-broad.js:132 | tabulated ball average | arbitrary | Values to 7e-6, but the grid moves with σ: dA/dσ off by up to 11 % at σ = 0.05 (§2.3). |
| Table rules and numerical guards | Table cache: 17 tables; Sphere table below its first node: linear continuation; Single-size threshold: σ ≤ 1e-4 → one size; Per-member table use: reach min(ln((n − 1)dL·scale), ln T + 3σ² + 7σ), tabulate when M ≥ 4 and 2M < n − 1; Fourier-coefficient cut: instrument × Lorentzian factor < 1e-8 (after i > 2); Fault-table tolerances: orbit key 1e-6, \|u·n\| < 1e-12, 1 − c < 1e-9, log floor 1e-12 | xrd-broad.js:135, 140, 147, 163, 228, 380 | when to tabulate, how far, when to stop; orbit de-duplication | arbitrary | Performance or ~1e-8 effects; table and point-by-point paths agree to 3.5e-6. |
| FFT size bounds | N_MIN 64, N_MAX 16384 | xrd-broad.js:207 | WPPM grid | arbitrary | Performance cap. Reached only by nanosheets about 1 nm thick with laterals of hundreds of nm: 0.1–1 % of the peak (§2.3). |
| WPPM window | ±(max(40·Hest, 1.5°) + largest FCJ shift) | xrd-broad.js:214 | one FFT period | convention | Same as the pseudo-Voigt's; area about 0.3 % below it (documented). |
| WPPM grid step | Hmin/8 (floor 1e-5°) | xrd-broad.js:215 | sampling of the narrowest component | tested-synthetic | 1.8e-4 of the peak for a pV-only line; error grows as step³. |
| Strain and faults in WPPM | Lorentzian: A = e^{−πWL}, W = 2εd* + κ/π | xrd-broad.js:226 | strain and fault coefficients | convention | Matches the Lorentzian model's 4ε·tanθ and Warren's fault term; not the Warren–Averbach Gaussian strain. |
| Edge lowering of the periodic profile | profile minus its value at ±half | xrd-broad.js:256 | removes the fold-over pedestal | convention | Mirrors the pseudo-Voigt's treatment. |
| Catmull-Rom readout | cubic | xrd-broad.js:268 | reads the FFT grid and the per-member tables | convention | Standard choice. |
| Stephens normalisation | q_j zero mean, unit rms over directions, orthogonal; S_j in 1e-6 of ε² | xrd-broad.js:281; xrd-rietveld.js:1114 | meaning of ε₀ and S_j | convention | A reparametrisation; ε₀ is the rms only when ε² ≥ 0 everywhere (§2.8). |
| Stephens inner product | 600 Fibonacci points; rank threshold 1e-7 of the raw rms; 15 fixed generic points | xrd-broad.js:322, 331, 351 | Gram–Schmidt of the quartic invariants | arbitrary | Means ≤ 5.2e-4 (triclinic), 1.1e-5 (cubic); counts correct for all 11 Laue classes. |
| Faults: every orientation, α per lattice plane | A_F = Π_p (1 − α(1 − c_p))^{L\|u·n_p\|/d} | xrd-broad.js:366 | meaning of the refined α | convention | Warren's single-orientation α = N·α at first order; per layer about α/2 for hcp. |
| Fault displacements | ±R alike; members lying in the plane, else the whole family | xrd-broad.js:392, 395 | which reflections broaden | convention | Faults broaden, never shift: real shifts go into the cell. |
| Layer-spacing search | u, v, w ∈ [−2, 2] plus centrings; projection > 1e-6 Å | xrd-broad.js:403 | d between fault planes | arbitrary | d doubled (κ halved) for planes such as (570), (580), (270) in a P cell (§2.3). |
| Directions fixed at the starting cell | member vectors and Stephens q_j(u) computed once | xrd-rietveld.js:464 | speed | derived-but-approximate | The cell moves by tenths of a per cent; matters only if c/a moves by several %. |

#### 3.2.6 Parameters: bounds, starts and difference steps (28)

| Constant | Value | Where (file:line, v425) | Role | Origin | Note |
|---|---|---|---|---|---|
| LAT_RANGE | ±10 % on a, b, c | xrd-rietveld.js:51, 1301 | box of the lattice lengths | arbitrary | Bounds the search and refinement; v425 also leaves out a phase whose cell runs to it. |
| Reflection-list margin | d_min = 0.9·λmax/(2 sin θ_lim) | xrd-rietveld.js:1279 | fixed hkl list | derived-but-approximate | 1/0.9 = 1.11 covers the ±10 % lengths, not the ±15° angles (§2.3). |
| θ_lim | (2θ_end + 2°)/2, at most 89.9° | xrd-rietveld.js:1278 | upper end of the reflection list | arbitrary | The 2° matches the zero's bound. |
| Cell-angle bounds | ±15°, within [1°, 179°] | xrd-rietveld.js:1301 | box of α, β, γ | arbitrary | No reason given; beyond the list's margin (§2.3). |
| Lattice difference steps | 1e-6·v0 Å; 1e-5° | xrd-rietveld.js:1301 | Jacobian | arbitrary | Accurate to 7e-6 (Lorentzian), 4e-5 (WPPM). |
| Default profile starts | W 0.002 deg², Y 0.03°; zero, disp, U, V, X, asym, Xs, Ys = 0 | xrd-rietveld.js:1257 | starts when prof gives none | arbitrary | autoRefine replaces them. |
| zero | [−2, 2]°, step 1e-5° | xrd-rietveld.js:1258 | zero shift | arbitrary | Step accurate (3.5e-7). |
| disp | [−3, 3]°, step 1e-5° | xrd-rietveld.js:1259 | specimen displacement | arbitrary | ±6.3 mm at 240 mm. |
| U, V, W | U, W ∈ [0, 20] deg², V ∈ [−20, 20] deg², step 1e-6 | xrd-rietveld.js:1260 | Caglioti box | arbitrary | U, W ≥ 0 keep H_G² ≥ 0. Active on the user's LaB6: U = W = 0 at the bound (χ² 4.617 vs 4.534 free, but with H_G² < 0 in range). |
| X, Y | [0, 10]°, step 1e-6 | xrd-rietveld.js:1263 | instrument Lorentzian | arbitrary | The 0 bound is physical. |
| asym | [0, 0.2], step 1e-4 | xrd-rietveld.js:1267 | FCJ (S + H)/L | arbitrary | The user's standard refines to 0.058. |
| Background start | bg0 = 10th percentile of the weighted counts | xrd-rietveld.js:1270 | starting level | arbitrary | Solved linearly afterwards. |
| Background order | Chebyshev T0…T6 | xrd-rietveld.js:1204 | background flexibility | arbitrary | Common choice. Fewer terms leave humps to the phases: on 37D an absent quartz went away at degree 10, NaCl persisted to 14 (v424). |
| 1/2θ background term | used when 2θ_start < 20° | xrd-rietveld.js:1329 | air scatter | arbitrary | Nearly collinear with the Chebyshev terms. |
| Phase scale | start 1e-3, [0, ∞) | xrd-rietveld.js:1295 | scale | arbitrary | Solved linearly; non-negativity physical. |
| ΔB | [−2, 10] Å², step 1e-4, start 0 | xrd-rietveld.js:1303 | one ΔB per phase | arbitrary | Negative B allowed on purpose (warned). |
| Xs, Ys | [0, 10]°, step 1e-6 | xrd-rietveld.js:1304 | phase Lorentzian strain and size | arbitrary | 10° in Ys is D ≈ 0.8 nm; v425 leaves out a phase whose Ys or Xs runs to 10°. |
| March–Dollase r | start 1, [0.2, 5], step 1e-4 | xrd-rietveld.js:1313 | texture | arbitrary | Textures stronger than r = 0.2 cannot be reached. |
| Log-normal σ (LS) | start 0, [0, 1.5], step 1e-4 | xrd-rietveld.js:1110 | size distribution width | arbitrary | At 0 the column is about 0: a run ending at σ = 0 cannot leave it. |
| Stephens S_j | [−1e4, 1e4] (units 1e-6 ε²), step 1e-3 | xrd-rietveld.js:1114 | anisotropic strain | arbitrary | The step is coarse at small ε₀ (1 % column error at Xs = 0.02°, §2.3). |
| Fault probability FA | [0, 0.45], step 1e-5 | xrd-rietveld.js:1125 | fault probability per plane | derived-but-approximate | ln(1 − α(1 − c)) diverges at α = 0.5 for c = −1; 0.45 is a margin. |
| B per site | start mean CIF B (else 0.5 Å²), [−2, 20] Å², step 1e-4 | xrd-rietveld.js:1149 | per-site B | arbitrary | The −2 bound is reached on the user's 33A (B(O) = −2.00). |
| Uij | [−0.5, 0.5] Å², step 1e-6; start = isotropic U projected on the site basis | xrd-rietveld.js:1157 | anisotropic ADPs | arbitrary | The CIF's anisotropic U is not used as the start. |
| Shape widths W | [0, 10]°, start 0, step 1e-6 | xrd-rietveld.js:443 | solid widths | arbitrary | 0 means an unbounded dimension. |
| Rotation vector | [−4, 4] rad, maxStep 0.4 rad | xrd-rietveld.js:444, 1938 | turn of the solid | tested-synthetic | A 4 rad first step threw a disc's axis away (RIETVELD.md §5.5). |
| ellipsoidL L_ij | [−10, 10]°, start 0 | xrd-rietveld.js:440 | legacy v420 ellipsoid | arbitrary | Legacy only. |
| Reference quaternion | (1, 0, 0, 0), never refined | xrd-rietveld.js:446 | chart origin of the orientation | convention | No effect. |
| Numerical guards (Jacobian, V floor) | Relative difference-step floor: h = max(step, 1e-7·\|v\|); V-floor guards: 2θ in [1e-3°, 179.9°] | xrd-rietveld.js:1765, 1823 | Jacobian step for large values; tanθ range of the V floor | arbitrary | Numerical. |

#### 3.2.7 Least squares (11)

| Constant | Value | Where (file:line, v425) | Role | Origin | Note |
|---|---|---|---|---|---|
| Cholesky pivot tolerance | 1e-10·max(1, A_jj) on the correlation-scaled matrix | xrd-rietveld.js:75 | drops a parameter as undetermined (esd NaN) | arbitrary | Needs \|ρ\| > 1 − 5e-11; the partners then keep conditional esds (§2.4). |
| solveLinear | 4 passes of zeroing negative scales; pivot 1e-12 | xrd-rietveld.js:1726, 1743 | linear solve of scales and background | arbitrary | Not a full NNLS; up to 0.38 % in χ² on strongly collinear phases (§2.4). |
| Marquardt damping | λ₀ 1e-3; ×10 on rejection, ÷10 on acceptance; floor 1e-9 | xrd-rietveld.js:1890, 1965, 1970 | LM damping on the correlation-scaled matrix | literature | Marquardt 1963 / Numerical Recipes; the 1e-9 floor is arbitrary. |
| Tries per iteration | 12 | xrd-rietveld.js:1923 | damping increases before "no step lowers χ²" | arbitrary | λ then ends ≥ 1e3 (§2.4). |
| Iteration limits | 40 (refine, each stage, LS and PO trials); 60 (shape refinements); 4 (turnEsds); the brief shape trials' 8 are in §3.2.10 | xrd-rietveld.js:672, 1882, 2417, 2777 | LM iteration caps | arbitrary | LaB6's full profile needed 27 in its first pass; non-convergence is flagged by the worker. |
| Convergence | every shift < 1 % of its esd, or relative χ² decrease < 1e-9 | xrd-rietveld.js:1967 | stop rule | convention | IUCr shift/su < 0.01; with the linear convergence seen on LaB6, about 0.03 esd remain. |
| Linear re-solves | up to 3; LM resumes when the gain > 0.01·χ²_ν, with λ = max(λ, 1e-3) | xrd-rietveld.js:1903, 1911, 1974 | re-solving scales and background inside refine | tested-synthetic | χ² was up to 17 above its minimum on synthetic plates. The max keeps λ ≥ 1e3 after "no step lowers χ²" (§2.4). |
| Covariance scaling | C = (JᵀWJ)⁻¹·χ²_ν, unconditional | xrd-rietveld.js:2007 | esds of refine() | convention | GSAS/FullProf practice; 100-run Monte Carlo: scatter/esd 0.92–1.04. |
| χ²_ν floors elsewhere | max(1, χ²_ν): turnEsds target, ΔBIC, held gain, early rejection, polish; WH esds × √max(1, χ²_ν) (v425); ownEvidence esd × √χ²_ν | xrd-rietveld.js:676, 2796; xrd-widths.js:283 | how misfit enters each esd or decision | convention | The floor at 1 is a choice; it differs from refine()'s unconditional scaling (§2.6). |
| Parameters at a bound | kept in the covariance (esd from curvature), listed in atBound | xrd-rietveld.js:1998 | esds at bounds | tested-synthetic | In a Monte Carlo the size esd was 1.3× its scatter (safe side). |
| TIE | 1e-9 (relative Rwp) | xrd-rietveld.js:56 | ties and flat curves in scans | arbitrary | Which grid point is taken on flat curves. |

#### 3.2.8 autoRefine: starting values, searches and stages (17)

| Constant | Value | Where (file:line, v425) | Role | Origin | Note |
|---|---|---|---|---|---|
| widthEstimate | 3-point boxcar; background = 10th percentile within ±4°; at least 2 steps | xrd-rietveld.js:2160, 2163, 2165, 2171 | H_est for starts and scan steps | arbitrary | Reads sharp lines 2–5× wide (unresolved Kα2 plus smoothing) and can pick a background maximum (§2.5). |
| Starting G/L split without a standard | H_G = H_L = H_est/1.635; U = V = X = 0 | xrd-rietveld.js:2349 | starting instrument profile | derived-but-approximate | 1.635 from TCH at H_G = H_L; the equal split is a choice. Start only. |
| Sample starting width | Ys = max(0, H_est − H_inst)·cosθ (÷1.23 for WPPM), Xs = 0 | xrd-rietveld.js:2347 | start of each phase's size with a standard | derived-but-approximate | FWHMs subtracted linearly, all put in the Lorentzian; every phase starts from the strongest peak. |
| Zero scan | ±0.3°, step max(H_est, 0.02°)/4 | xrd-rietveld.js:2395, 2396 | the standard's zero search | arbitrary | A zero beyond ±0.3° stays 0; the grid stops short of +0.3° (§2.5). |
| Cell-search range | ±3 % (±6 % retry for a lone phase) | xrd-rietveld.js:2103, 2373, 2384 | common factor on each phase's lengths | arbitrary | Doped, DFT or temperature cells a few % off; a cell beyond it is not placed and its lattice is held. |
| Cell-search rounds | 2 with several phases, the second for phases found in the first | xrd-rietveld.js:2374 | multi-phase search | arbitrary | Avoids 0.97² compounding. |
| Cell-search step | last peak moves 1/3 of its FWHM per step; coarse pass widened to suit | xrd-rietveld.js:2118, 2131 | grid of the factor f | derived-but-approximate | The 1/3 is chosen; the 2tanθ is exact. |
| Cell-search grid sizes | single pass up to 161 points (at least 41); coarse 81 points; fine ±2 coarse steps | xrd-rietveld.js:2123, 2124, 2130, 2141 | scan resolution | arbitrary | A fine-pass edge minimum is not checked (0/27 in tests). |
| COARSE_WIN | 10 FWHM | xrd-rietveld.js:46 | window of the coarse pass | arbitrary | Speed; the coarse profile loses up to 6.4·η % of its area. |
| Guards and UI shares | θ cap of the scan step: 89°; No-texture cutoff: \|r − 1\| < 1e-12; Progress share before the shape: 0.5 | xrd-rietveld.js:528, 2116, 2300 | skip r = 1; tanθ guard; progress bar | arbitrary | No effect on results. |
| Edge or flat = not found; ties to the start | argmin on the first/last grid point, or a flat curve, means no minimum | xrd-rietveld.js:2065 | cell kept and held when not found | tuned-on-user-data | Absent rutile, anatase, ZnO beside the user's SrTiO3 took up to 74 wt % without it. Effective range ±(range − h/2) (§2.5). |
| Stage sequence | scales+bg → lattice+disp → widths → X/Xs (+U, V, asym) → Stephens → faults → σ → ADPs → PO; shape last | xrd-rietveld.js:2458 | refinement strategy | arbitrary | Detection is decided before the shape; without a standard the zero is not refined (its error goes into disp and the cell). |
| Reflections to free U, V, asym | ≥ 8 in range | xrd-rietveld.js:2470 | full instrumental profile on the standard | arbitrary | The count includes left-out phases (§2.5). |
| Stephens start | Xs raised to ≥ 0.02° | xrd-rietveld.js:2481 | gives the square root a derivative | arbitrary | Start only. |
| Log-normal starts | σ = 0.3 and 0.6, lower χ² kept | xrd-rietveld.js:2499 | σ has no first derivative at 0 | arbitrary | May miss a minimum outside their basins. |
| March–Dollase starts | r = 0.8 and 1.25 per axis | xrd-rietveld.js:2529 | texture trials | arbitrary | r has no first-order effect at 1 for cubic phases; the axis is chosen by small χ² differences. |
| Texture "auto" axes | (100), (010), (001), (110), (101), (011), (111), one per Laue family | xrd-rietveld.js:505 | axes tried by "best axis" | arbitrary | Misses (104)/(012) of corundum, (112), (1-10) for low symmetry. |

#### 3.2.9 Phase detection (v425 rules) (14)

| Constant | Value | Where (file:line, v425) | Role | Origin | Note |
|---|---|---|---|---|---|
| Significance | scale > 3 esd, after the first stage and at the end of each pass | xrd-rietveld.js:2422 | first leave-out test | convention | 3σ. Weak for very broad phases: 2 nm rutile at 8 wt % has 1.9–3.0 σ while Δχ² = 24–37 (§2.5). |
| Plausibility: cell on its bound | a, b or c within 1e-9 (relative) of the ±10 % bound | xrd-rietveld.js:2447, 2449 | second leave-out test (several phases present) | tested-synthetic | New in v425: catches an absent NaCl that only fits a hump (its a walked to +10.0 %). |
| Plausibility: broadening on its bound | Ys or Xs at its upper bound (10°), with a standard's profile | xrd-rietveld.js:2451 | second leave-out test (several phases present) | tested-synthetic | New in v425: absent quartz beside a hump (Ys = 10°) and on 37D; absent rutile on 37D (Xs). Without a standard it is not applied. |
| Plausibility: crystallites under two cells | D < max(1 nm, 2 × the longest cell edge), with a standard's profile | xrd-rietveld.js:2454 | second leave-out test (several phases present) | tested-synthetic | New in v425. The 3 nm NaCl on 37D passes it; the 1 nm floor and the factor 2 are choices. |
| Clear line: reach | ±1.5 FWHM (CLEAR_FWHM), Kα2 included | xrd-rietveld.js:2197 | a line is clear when no rival line overlaps this reach | tested-synthetic | New in v425 (replaces the "≥ 2/3 of the Bragg intensity" region). Set on synthetic 7 nm SrTiO3 + rutile and absent NaCl; checked on 33A/37D. |
| Clear line: rival height | rival lines at least 1/10 as high (CLEAR_HEIGHT) | xrd-rietveld.js:2197 | which rival lines count | tested-synthetic | New in v425; same tests. |
| Lines counted | above 2 % of the phase's strongest line | xrd-rietveld.js:2221 | denominator of "alone" | arbitrary | Carried over from v424 (then: points above 2 % of the phase's own calculated maximum). |
| Points for α | more than 10 marked points | xrd-rietveld.js:2237 | α computed only above it | arbitrary | Not in RIETVELD.md §6.4; when it fails the warning says no line is clear (§2.5). |
| Local background in the α fit | a straight line c₀ + c₁(2θ − 2θ̄) per stretch of marked points | xrd-rietveld.js:2238 | takes up background and rival tails | arbitrary | v424 had one line for all points. |
| α esd | scaled by √χ²_ν (floor 1e-12) | xrd-rietveld.js:2252 | esd of α | convention | As refine(). |
| Own evidence | alone ≥ 5 % and α > 3 esd | xrd-rietveld.js:2255 | third leave-out test | tuned-on-user-data | Set in v419–v424 on the user's SrTiO3 with absent NaCl and synthetic rutile; kept with the v425 clear-line region. When no phase has a clear line, none is dropped (warning). |
| Drop order | one phase per pass: least "alone", then most "under" | xrd-rietveld.js:2551 | restart rule | arbitrary | Order of removal with several weak phases. |
| Shared-peak warning | α < 0.5 | xrd-rietveld.js:2574 | warns that a fraction rests on shared peaks | arbitrary | Warning only. |
| Twins | same lattice type and atom count, cell mass within 0.1 %, a, b, c within 2 % | xrd-rietveld.js:2196 | two copies of a CIF count as one phase | arbitrary | Allows two size populations of one phase. |

#### 3.2.10 Free shape: search and acceptance (17)

| Constant | Value | Where (file:line, v425) | Role | Origin | Note |
|---|---|---|---|---|---|
| SHAPE_SOFT | sin 2° (faces rounded during the search) | xrd-rietveld.js:552 | smooths the χ² valleys of flat faces | tuned-on-user-data | A disc on the user's SrTiO3 stopped between χ² 6364 and 6427. Distortion grows with aspect: in-plane widths ×1.13 at 11:1, ×1.95 at 50:1 (§2.6). |
| SHAPE_STARTS, SHAPE_FULL | 10 starts (+1 sphere-like), best 3 refined fully | xrd-rietveld.js:2641 | multistart effort | tested-synthetic | 40 more starts on the user's 37D found the same minima; 2 of 7 synthetic boxes ended in a second valley. |
| Brief trials | 8 iterations, one FCJ pass | xrd-rietveld.js:2762 | ranks the starts | tested-synthetic | Within 0.2 χ²_ν of converged on synthetic plates, needles, spheres. |
| Early rejection | brief gain < ½(10 + dP·ln N) | xrd-rietveld.js:2771 | skips the full refinements | tested-synthetic | Timing: YAG 152 → 99 s, SrTiO3 + rutile 35 → 19 s. Ignores the held route (§2.6). |
| Polish | ≤ 2 turns of 0.02 rad; stop when gain < 0.5·max(1, χ²_ν) | xrd-rietveld.js:2787 | escape from symmetric stationary orientations | arbitrary | Low. |
| Shape acceptance | ΔBIC < −10 | xrd-rietveld.js:2833 | keep a free shape | literature | Kass & Raftery "very strong"; 0 of 22 synthetic spheres kept a shape (7 of 12 without the rule). |
| Held-on-lattice test | Δχ²/χ²_ν ≤ 5.99 (2 turns) or 7.81 (3 turns), and lower ΔBIC | xrd-rietveld.js:2820 | keeps the axes on lattice directions | literature | χ² 95 % quantiles; the 95 % level is a choice, motivated by synthetic boxes 8° off ⟨111⟩. |
| BIC sample size | N = all weighted points | xrd-rietveld.js:2650 | ln N penalty | convention | Standard BIC; oversampled points are correlated, so the penalty scales with the step. |
| y0 floor | 1e-3° | xrd-rietveld.js:2651 | scale of the starts when Ys = 0 | arbitrary | Start only. |
| Random seed | 0x9e3779b9 (mulberry32) | xrd-rietveld.js:2655 | reproducible starts | arbitrary | Which minimum is found can depend on it. |
| Start tilt | 0.08 rad Gaussian per component (~6.5° rms) | xrd-rietveld.js:2666 | breaks the symmetry of plate and needle starts | arbitrary | Start only. |
| Body starts | plate (0.5, 0.7, 2.5)·w0, needle (1.2, 1.6, 0.4)·w0; random w0·e^{0.8g} with a uniform turn | xrd-rietveld.js:2712, 2715 | starting shapes | arbitrary | Which valleys are reached. |
| ellipsoidL starts (legacy) | plate 2.5/0.6·y0, needle 0.4/1.4·y0; eigenvalues y0²·e^{0.8g} | xrd-rietveld.js:2679, 2681 | v420 ellipsoid | arbitrary | Spread in ln width half that of the bodies (§2.6). |
| κ quadrature | 400 Fibonacci directions | xrd-rietveld.js:2694 | mean width factor of the base body for the sphere-like start | derived-but-approximate | 1, 0.896, 0.837 equal the 20000-point values to 1e-5. |
| Perpendicular start axis | \|cos\| < 0.1; fallback when \|e_x\| < 0.9 | xrd-rietveld.js:2706 | in-plane axis of the start frame | arbitrary | Start only. |
| Low-index start axes | up to 5 families of [100], [010], [001], [110], [101], [011], [1-10], [10-1], [01-1], [111] | xrd-rietveld.js:1054 | plate and needle start directions | arbitrary | Orthorhombic and lower never get [011] or [111] starts; higher-index habits only through random starts. |
| Second held axis | lattice directions within 0.01° of normal, up to 3, indices ≤ 3 | xrd-rietveld.js:2747 | held frames of 3-axis bodies | arbitrary | Low-symmetry cells may have none (then not held). |

#### 3.2.11 Free shape: reading the result (15)

| Constant | Value | Where (file:line, v425) | Role | Origin | Note |
|---|---|---|---|---|---|
| Bound rule in zr | one width at 0: z = W_other/σ_other | xrd-rietveld.js:899 | whether two widths differ when one is at its bound | tuned-on-user-data | ±14606° on a 37D spheroid had made a 2.5 nm plate a near-sphere. |
| Told apart | widths differ by more than 2σ (with their covariance; the legacy ellipsoid leaves it out, §2.6) | xrd-rietveld.js:753, 902 | groups, "resolved", the kind | convention | A synthetic 12 × 12 nm box read 13(107)/13(106) nm before. |
| Unbounded dimension | lower limit Dof(W + 2σ), shown when ≥ 1 nm | xrd-rietveld.js:859 | "over N nm" | arbitrary | Display. |
| Held-frame esd inflation | Desd ⊕ \|D − D_free\|; esdAngle ≥ freeOff | xrd-rietveld.js:857, 877 | esds of a held result | tested-synthetic | Sizes were 5–11σ off where the frame was wrong; Desd = ∞ if the free width was 0. |
| Kind thresholds | isometric/equant above 0.8; plate, needle, triaxial at ratio 0.5 | xrd-rietveld.js:765, 956 | kind label | arbitrary | Labels only. |
| Direction shown | only when its angular esd ≤ 30° | xrd-rietveld.js:948 | whether an axis gets a lattice direction | arbitrary | Display. |
| SNAP_DEG | 10° | xrd-rietveld.js:980 | simplest lattice direction within it names an axis; axes eligible to be held | tuned-on-user-data | Axes 2–9° from [111] were named ⟨433⟩, ⟨332⟩, ⟨443⟩ (source of the cases not stated; one reviewer read them as synthetic noise). |
| lattDirection search | indices ≤ 4; angle tie 1e-6°; exact hold 0.01° | xrd-rietveld.js:989 | candidate set and ties | arbitrary | None. |
| latticeAcross | indices ≤ 3, within 5° of normal, 2 directions; parallel when \|cos\| > 0.999 | xrd-rietveld.js:618 | directions across a body of revolution | arbitrary | [1-10] of a disc 7° off [110] fell outside 5° (one fit). |
| Family representative | fewest negative indices, then the largest | xrd-rietveld.js:1013 | label of a direction family | convention | Hexagonal a-axes read ⟨110⟩, m-directions ⟨210⟩ (3-index). |
| turnEsds trial turns | 1, 2, 4, 8, 16, 32, 60°; none beyond 60° | xrd-rietveld.js:679 | profile grid of the angular esd | tested-synthetic | Coverage 1.15× over 28 synthetic axes; linear interpolation biases the esd up to 6 % low (§2.6). |
| turnEsds combination | mean of the two senses; first trial over: θ·√(target/Δχ²) | xrd-rietveld.js:688 | one esd from the profile | arbitrary | "On the safe side if χ² rises as \|θ\|". |
| turnEsds re-refined set | linear parameters, texture, W, Xs, the other turns | xrd-rietveld.js:868 | what is refined at each turn | tested-synthetic | 1.6× vs 1.15× coverage; leaving S_j, LS, FA, ADPs held makes the esd 5–8 % low (§2.6). |
| Tilt esd | √((σ_j² + σ_k²)/2) of the two turns that tilt the axis | xrd-rietveld.js:876 | an axis's angular esd | convention | Coverage 1.15× over 28 synthetic axes. |
| eigSym3 | ≤ 60 sweeps; off² < 1e-30 (absolute); skip \|a_pq\| < 1e-300 | xrd-rietveld.js:602 | Jacobi eigen-solver | arbitrary | Fails only for entries below ~1e-15 (unreachable today). |

#### 3.2.12 Single-peak widths and tests (xrd-widths.js) (19)

| Constant | Value | Where (file:line, v425) | Role | Origin | Note |
|---|---|---|---|---|---|
| Isolation model | neighbours and background of the isotropic fit, even when a shape was kept | xrd-widths.js:180 | what is subtracted before each single-peak fit | tuned-on-user-data | The (200) of the user's SrTiO3 read 1.08° or 0.83° depending on which model's tails were removed. |
| Coincident reflections | \|Δ2θ\| < 0.2·min(H) | xrd-widths.js:194 | reflections treated as one peak | arbitrary | Near-coincident pairs fall to the overlap flag. |
| Window | ±max(2.5·H, 0.4°) | xrd-widths.js:212 | points fitted for each peak | tuned-on-user-data | A straight background over ±2.5 FWHM read a broad (310) of the user's SrTiO3 3 % narrow (which led to subtracting the refined background); 2.5 and 0.4° not justified. |
| Edge flag | top ±1.2 FWHM must lie in the pattern | xrd-widths.js:213 | edge peaks kept but not used | arbitrary | Which end peaks are used. |
| Minimum points | 15 weighted points | xrd-widths.js:216 | peaks with fewer are dropped | arbitrary | Silently: scans coarser than ~0.055° lose narrow peaks (§2.7). |
| Overlap flag | other reflections > 30 % of its intensity within ±H/2 | xrd-widths.js:231 | excluded from WH, orders, scores | arbitrary | Number of WH points on dense patterns. |
| "Not broadened" flag | Hs ≤ 2 esd | xrd-widths.js:237 | no per-peak size; excluded from tests | arbitrary | 2σ convention. |
| Weak flag | area ≤ 3 esd | xrd-widths.js:248 | excluded from tests and from the intensity maximum | arbitrary | 3σ convention; the card's table echoes these flags (xrd-rv.js). |
| Relative intensity | only for non-edge peaks with area ≤ the largest non-weak, non-edge area | xrd-widths.js:256 | relative-intensity column | tuned-on-user-data | "A (212) cut at 80° read 115 %" (the user's SrTiO3). |
| Local background in fitPeak | straight line | xrd-widths.js:69 | what the subtracted refined background leaves | arbitrary | Low after subtracting the refined background. |
| Peak identity | \|c − c₀\| ≤ 0.5·H₀; total FWHM within 0.25–4·H₀ | xrd-widths.js:83 | keeps the fit on its reflection (χ² = ∞ outside) | arbitrary | Weak or overlapped peaks only. |
| Nelder–Mead | simplex from ex = max(H₀ − H_i, 0.1·H₀); ≤ 500 iterations; stop at spread < 1e-10 after 40 | xrd-widths.js:92 | optimiser of fitPeak | arbitrary | Seven starts reach the same χ² on usable 33A/37D peaks. |
| Jacobian steps of fitPeak | 1e-4·H₀ (c, hl); max(1e-8, 1e-4·H₀²) (u); one-sided at 0 | xrd-widths.js:117 | covariance of the single-peak fit | arbitrary | Low. |
| Secant span | ±1 esd of hl and u (u clamped at 0) | xrd-widths.js:135 | propagates (hl, u) to the FWHM esds | arbitrary | Overstates the Hs esd up to ~1.35× when u = 0 (§2.7). |
| Williamson–Hall minimum | 3 usable peaks | xrd-widths.js:272 | WH fitted only with ν ≥ 1 | arbitrary | Whether WH is shown. |
| Order pairs | n ∈ {2, 3, 4} | xrd-widths.js:295 | (hkl)/(nh nk nl) pairs tested | arbitrary | Number of order tests. |
| Order-test verdicts | ±2·Resd about 1 and about n | xrd-widths.js:298 | size / strain / size and strain … | arbitrary | 33A: 1.111(40) → "size and strain". |
| WH anisotropy verdict | p < 1e-3 | xrd-rv.js:435 | D and ε labelled "an average only" | arbitrary | Card wording; 33A is at p = 2e-48. |
| χ² survival numerics | ≤ 500 terms, 1e-14, FPMIN 1e-300; NR gammln coefficients | xrd-widths.js:314 | WH p-value | literature | Numerical Recipes gammq; matches scipy to 10 digits down to 3e-161. |

#### 3.2.13 Worker and card: reporting (24)

| Constant | Value | Where (file:line, v425) | Role | Origin | Note |
|---|---|---|---|---|---|
| Esd notation | one significant esd digit, two when it is 1; without esd 6 (worker) or 4 (card) significant digits | xrd-rietveld.worker.js:30; xrd-rv.js:342 | every value(esd) shown | convention | IUCr-like; esds ≥ 10 in the last digit print in full (§2.8). |
| Numerical propagation step | h = max(1e-7, 1e-6·\|p\|), forward difference | xrd-rietveld.worker.js:42 | esds of V, B_eq, log-normal sizes, Stephens per-plane strains | arbitrary | V esd matches 3a²σ_a (0.003634 vs 0.003637). |
| Wide log-normal warning | σ ≥ 0.8 | xrd-rietveld.worker.js:153 | median and number mean rest on the tails | derived-but-approximate | ⟨L⟩_A/⟨L⟩_V = 0.5 at σ = 0.758; by FWHM/β the match is at σ ≈ 0.66 (§2.3). |
| Stephens planes reported | (100), (010), (001), (110), (101), (011), (111), one per Laue family | xrd-rietveld.worker.js:173 | per-plane strain lines | convention | Reporting only. |
| "Not told from no texture" | \|r − 1\| < 2 esd | xrd-rietveld.worker.js:227 | tooltip verdict on r | arbitrary | Tooltip only. |
| Angle display | angle < 0.05° shown as 0; esd shown only ≤ 60°; one significant digit below 0.095°, one decimal below 10° | xrd-rietveld.worker.js:232, 235 | axis angles and angular esds | arbitrary | Differs from the 3D view's format (§2.8). |
| Solid frame for the view | \|x0\| > 1e-6; \|e·z\| > 0.999; at most 3 directions | xrd-rietveld.worker.js:326 | drawn body frame | arbitrary | Drawing only. |
| ΔBIC reading bands | under 10 no preference, 10–30 weak, over 30 telling | xrd-rietveld.worker.js:337 | card text between solids | tuned-on-user-data | "Within what the search itself varies on real data" (the user's samples). |
| Weight fraction shown | only with more than one detected phase | xrd-rietveld.worker.js:355 | Hill–Howard line and CSV row | arbitrary | None. |
| Weight-fraction esd | scales' covariance only (no cell, mass, amorphous content or microabsorption) | xrd-rietveld.js:2879 | Hill–Howard esd | convention | Documented; gradient checked. |
| No broadening | width ≤ 0 → D = ∞, ε = 0 | xrd-rietveld.js:2866 | report | convention | Documented. |
| Built-in LaB6: cell | a = 4.156826 Å (22.5 °C), held, no thermal correction | xrd-rv.js:25 | cell of the standard: fixes zero and profile | literature | NIST SRM 660c. About 1e-5 relative per °C away from 22.5 °C goes into every sample's zero and displacement. |
| Built-in LaB6: B | B(La) 0.25 Å², B(B) 0.35 Å² | xrd-rv.js:43, 44 | standard's intensities | arbitrary | "Typical values"; intensities only. |
| Built-in LaB6: x(B) | 0.1992 | xrd-rv.js:44 | standard's intensities | literature | Eliseev et al. 1986; the test helper uses 0.1975. |
| What the standard passes | {U, V, W, X, Y, asym, zero} | xrd-rv.js:142 | what a sample takes from the standard | convention | λ, radius and 2θ range are not passed or checked (§2.8). |
| Option defaults per phase | profile Lorentzian, strain isotropic, no faults, ADPs from the CIF, no texture, no shape | xrd-rv.js:159 | what a new phase is refined with | arbitrary | The simplest model; results depend on what is left at default. |
| Texture choices | auto, (100), (010), (001), (110), (111) | xrd-rv.js:153 | axes the picker allows | arbitrary | (012) and similar cannot be chosen. |
| Planar-fault kinds | {111}⅙⟨112⟩, (001)⅓⟨1-10⟩, {100}½⟨111⟩, {100}½⟨110⟩, {111}½⟨110⟩, {110}½⟨110⟩ | xrd-rv.js:164 | fault models offered | convention | The common kinds (fcc and hcp stacking, Ruddlesden–Popper, APBs). |
| Texture and fault spec grammar | digits only, or split on spaces/commas; single-digit indices and f = n/m | xrd-rietveld.js:481, 1092 | parsing p.po and p.faults | convention | The card offers fixed options; API edge cases (§2.6). |
| Default λ for ticks | 1.540598 Å | xrd-rv.js:236 | tick positions before a refinement | convention | Same as the engine's CU. |
| θ cap of the tick list | 89.9° | xrd-rv.js:237 | dmin of the pre-refinement list | arbitrary | Avoids sinθ = 1. |
| Legacy migrations | shape true → ellipsoid; card-wide refineB → ADPs "overall"; L11/L22/L33 → ellipsoidL | xrd-rv.js:608 | opening old projects | arbitrary | None on new data. |
| CSV decimals | fixed: 2θ 5, counts 3, Value/Esd 8, R 3; peaks 2θ/FWHM 5, rel 4, η 3, D 4, Δd* 6 | xrd-rv.js:624 | export precision | arbitrary | Values below ~1e-6 lose significant digits. |
| Card display | Card number formats: model widths 3 decimals, solid caption 1 decimal under 10 nm, p exponential below 1e-4; Plot layout: tick rows 0.045·A, gaps 0.02·A, WH margins x ±12 %, y −8 % (clamped at 0) / +18 %; Remembered 3D turns: ≤ 50 entries; Phase colours: 6 CIF colours, LaB6 #4cc9a0 | xrd-rv.js:51, 256, 298, 314, 345, 409, 436 | number formats, plot layout, remembered turns, colours | arbitrary | The WH y clamp at 0 hides negative values (§2.8). |

#### 3.2.14 3D view (display only, xrd-shape3d.js) (15)

| Constant | Value | Where (file:line, v425) | Role | Origin | Note |
|---|---|---|---|---|---|
| Opacities | SOLID_ALPHA 0.66; CONE_ALPHA 0.16, rim stroke 0.5 | xrd-shape3d.js:23, 24 | how much shows through the solid; cones | arbitrary | "The lines through it stay readable"; cones "there, but not in the way". |
| ESD_MAX | 60° | xrd-shape3d.js:25 | beyond it a direction is dashed, without a cone | arbitrary | Matches turnEsds' last trial; the worker already drops axes over 30°. |
| OFF_MIN | 0.05° | xrd-shape3d.js:26 | below it no "x° off axis" line | arbitrary | Same as the worker's "0". |
| Extents drawn | OPEN_RATIO 20 (endless above 20× the smallest other extent); OPEN_CAP 4× the largest closed extent; no extent under 1 % of the largest | xrd-shape3d.js:27, 28, 293 | which dimensions are drawn endless, and how long | arbitrary | Between ~10× and 20× the picture is to scale, above 20× it is not (the caption gives the true sizes). |
| View size | 200–320 CSS px; layers ≤ 2 (solid) / 1.5 (cones) px per CSS px | xrd-shape3d.js:29 | canvas | arbitrary | Performance against sharpness. |
| Home view | azimuth 38°, elevation 24°; directions ≥ 12° apart on screen, azimuth offsets 0, ±8…±40°, end-on below 0.25 | xrd-shape3d.js:38, 88 | initial camera | arbitrary | "No body axis end-on or edge-on, a disc shows its face." |
| Colours and shading | LIGHT ∝ (−0.42, 0.58, 0.70), 96 Lambert levels, shade 0.40 + 0.66·level/96; direction hues 211°, 306°, 125°, 27°, 178°, 348° with HUE_GAP 45°; edges 0.45 of the text colour; colour cache 200 | xrd-shape3d.js:41, 364, 385, 421 | shading and line colours | arbitrary | Cosmetic. |
| Number formats | fmtDeg: integer from 9.95°, one decimal from 0.05°; fmtNm: integer ≥ 100, one decimal ≥ 10 | xrd-shape3d.js:51 | labels | arbitrary | Differs from the card's format (§2.8). |
| Fade towards open ends | from 45 % of the half extent; a sheet fades over its outer 38 %; alpha squared; skipped below 0.01/0.02 | xrd-shape3d.js:169 | endless dimensions | arbitrary | Cosmetic. |
| Tessellation | ellipsoid 40 × 28; cylinder 56 sectors (18 rings open, caps 10); open box faces 16 × 16; cones 8 rings × 16 sectors, split to 8 px (depth 7), 6 bisections, 48 samples + 10 bisections, mask cells 6/3 px | xrd-shape3d.js:210, 324 | meshes and the hiding of lines and cones | arbitrary | Sub-pixel at the view's size; hiding uses the exact solid. |
| Lines, arrows and labels | lines 2 px, dashed [5, 4]; head 9 × 8 px; length max(surface + 0.28·Rs, 0.62·Rs); fonts 12/11 px; label costs: 7.5° grid, gaps 6–34 px, covering a line 300 + 30/px, overlap 600 + 2·area | xrd-shape3d.js:311, 515, 808 | drawing and label placement | arbitrary | Tuned by eye. |
| Scale bar | about 22 % of the view, 1-2-5 × 10ⁿ nm | xrd-shape3d.js:1047 | scale | convention | 1-2-5 series. |
| Cell triad | 18 px arms at (S − 30, 30); away-pointing axes at alpha 0.5; head when projected > 0.3 | xrd-shape3d.js:1053 | a, b, c reference | arbitrary | Since v425 always right-handed (§1.1). |
| Interaction | drag 1.2π rad per view width, after 4 px; double tap 350 ms within 24 px; keys 10° (Shift 2°) | xrd-shape3d.js:1174 | rotation | arbitrary | Cosmetic. |
| PNG export | ≥ 2× pixel ratio; caption band 24 px, 12 px font; light colours, transparent | xrd-shape3d.js:1340 | export | arbitrary | As the app's other figures. |
